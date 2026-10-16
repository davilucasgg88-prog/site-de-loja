-- =====================================================================
-- TMZ STORE · banco de dados no Supabase
-- Cole tudo em Supabase → SQL Editor → New query → Run.
-- Antes de rodar, troque o e-mail do dono na linha marcada com  <<<
-- =====================================================================

-- Uma tabela guarda todos os "documentos" da loja, no mesmo formato que o site já usa:
--   loja/config, loja/categorias      → textos, cupons, frete, contato (todos leem, só o dono altera)
--   produtos/<id>                     → catálogo (todos leem, só o dono altera)
--   pedidos/<código>                  → pedidos e reservas (só o servidor e o dono gravam; o cliente lê os seus)
--   carrinhos/<id do cliente>         → carrinhos de cada cliente
--   visitas/<id do cliente>           → visitas por dia
--   contas/<id do cliente>            → nome e WhatsApp de quem criou conta
--   avisos/<id do cliente>            → pedidos de "Avise-me quando chegar"
--   pagamentos/<código do pedido>     → pagamentos confirmados pelo Mercado Pago (só o servidor grava)
create table if not exists public.docs (
  colecao    text        not null,
  id         text        not null,
  dados      jsonb       not null default '{}'::jsonb,
  atualizado timestamptz not null default now(),
  primary key (colecao, id)
);
-- Nenhum documento passa de 600 KB (fotos já chegam reduzidas); impede encher o banco
alter table public.docs drop constraint if exists docs_tamanho;
alter table public.docs add constraint docs_tamanho check (pg_column_size(dados) < 600000);

-- Quem é o dono (único e-mail com acesso ao painel)
create table if not exists public.admins (email text primary key);
insert into public.admins (email) values ('admin@tmzstore.com.br')   -- <<< troque pelo e-mail do dono
on conflict do nothing;

-- Dono = usuário logado, com e-mail CONFIRMADO, não anônimo, cujo e-mail está em admins.
-- (Conta criada por terceiros com o e-mail do dono, sem confirmar, não vira dono.)
create or replace function public.eh_admin() returns boolean
language sql stable security definer set search_path = public, auth as $$
  select exists (
    select 1 from auth.users u join public.admins a on lower(a.email) = lower(u.email)
    where u.id = auth.uid() and u.email_confirmed_at is not null and coalesce(u.is_anonymous, false) = false
  );
$$;

-- Atualiza a data de modificação sozinho
create or replace function public.tocar() returns trigger language plpgsql as $$
begin new.atualizado := now(); return new; end; $$;
drop trigger if exists docs_tocar on public.docs;
create trigger docs_tocar before update on public.docs for each row execute function public.tocar();

-- ---------------------------------------------------------------------
-- Regras de acesso (RLS): o navegador só faz o que estas regras deixam
-- ---------------------------------------------------------------------
alter table public.docs enable row level security;
alter table public.admins enable row level security;

drop policy if exists "loja e produtos: todos leem" on public.docs;
create policy "loja e produtos: todos leem" on public.docs for select
  using (colecao in ('loja', 'produtos'));

drop policy if exists "dono le tudo" on public.docs;
create policy "dono le tudo" on public.docs for select
  using (public.eh_admin());

drop policy if exists "dono altera tudo" on public.docs;
create policy "dono altera tudo" on public.docs for all
  using (public.eh_admin() and colecao <> 'pagamentos')
  with check (public.eh_admin() and colecao <> 'pagamentos');

-- Cada visitante (inclusive anônimo) lê e grava só o próprio documento
-- Pedidos: o cliente só LÊ os próprios; criar, pagar e cancelar passam pelo servidor
drop policy if exists "cliente le os seus pedidos" on public.docs;
create policy "cliente le os seus pedidos" on public.docs for select
  using (colecao = 'pedidos' and dados ->> 'dono' = auth.uid()::text);

drop policy if exists "cliente le o seu" on public.docs;
create policy "cliente le o seu" on public.docs for select
  using (colecao in ('carrinhos', 'visitas', 'contas', 'avisos') and id = auth.uid()::text);

drop policy if exists "cliente cria o seu" on public.docs;
create policy "cliente cria o seu" on public.docs for insert
  with check (colecao in ('carrinhos', 'visitas', 'contas', 'avisos') and id = auth.uid()::text);

drop policy if exists "cliente altera o seu" on public.docs;
create policy "cliente altera o seu" on public.docs for update
  using (colecao in ('carrinhos', 'visitas', 'contas', 'avisos') and id = auth.uid()::text)
  with check (colecao in ('carrinhos', 'visitas', 'contas', 'avisos') and id = auth.uid()::text);

-- O cliente vê se o pagamento do próprio pedido foi aprovado (sem ver os dos outros)
create or replace function public.status_pagamento(codigo text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('status', pg.dados ->> 'status', 'valorPago', pg.dados -> 'valorPago')
  from public.docs pg join public.docs pe on pe.colecao = 'pedidos' and pe.id = pg.id
  where pg.colecao = 'pagamentos' and pg.id = codigo and pe.dados ->> 'dono' = auth.uid()::text;
$$;
grant execute on function public.status_pagamento(text) to anon, authenticated;

-- Acompanhar pedido: com o código e os 4 últimos números do WhatsApp, qualquer pessoa vê a situação
-- (sem endereço nem telefone; do cliente só o primeiro nome)
create or replace function public.rastrear_pedido(codigo text, final_telefone text) returns jsonb
language sql stable security definer set search_path = public as $$
  select (d.dados - 'cliente' - 'dono') || jsonb_build_object('cliente', jsonb_build_object('nome', split_part(d.dados -> 'cliente' ->> 'nome', ' ', 1)))
  from public.docs d
  where d.colecao = 'pedidos' and d.id = upper(codigo)
    and length(regexp_replace(final_telefone, '\D', '', 'g')) = 4
    and right(regexp_replace(d.dados -> 'cliente' ->> 'telefone', '\D', '', 'g'), 4) = regexp_replace(final_telefone, '\D', '', 'g');
$$;
grant execute on function public.rastrear_pedido(text, text) to anon, authenticated;

-- Número do pedido: 1, 2, 3… sem repetir, mesmo com vários pedidos ao mesmo tempo.
-- Só o servidor (função pedido) pega o próximo número.
create sequence if not exists public.pedido_numero start 1;
create or replace function public.proximo_numero_pedido() returns bigint
language sql security definer set search_path = public as $$ select nextval('public.pedido_numero'); $$;
revoke execute on function public.proximo_numero_pedido() from public, anon, authenticated;

-- Pagamento aprovado: trava o pedido, confere o valor, baixa o estoque e confirma, tudo de uma vez.
-- Chamado só pela função mercadopago-webhook (service role). Repetir o aviso não baixa o estoque de novo.
create or replace function public.confirmar_pagamento(p_codigo text, p_mp_id text, p_valor numeric) returns text
language plpgsql security definer set search_path = public as $$
declare
  ped jsonb;
  item jsonb;
  est int;
  novo int;
  baixas jsonb := '{}'::jsonb;
  agora bigint := (extract(epoch from now()) * 1000)::bigint;
begin
  select dados into ped from public.docs where colecao = 'pedidos' and id = p_codigo for update;
  if ped is null then return 'sem-pedido'; end if;
  if coalesce((ped ->> 'pago')::boolean, false) then return 'ja-pago'; end if;
  if ped ->> 'status' not in ('aguardando') then return 'status-' || (ped ->> 'status'); end if;
  if abs(p_valor - (ped ->> 'cobrar')::numeric) > 0.01 then return 'valor-diferente'; end if;
  -- baixa o estoque e guarda quanto saiu de cada produto (para devolver o mesmo se cancelar)
  for item in select * from jsonb_array_elements(ped -> 'itens') loop
    select coalesce((dados ->> 'estoque')::int, 0) into est from public.docs
      where colecao = 'produtos' and id = item ->> 'id' for update;
    if est is null then continue; end if;
    novo := greatest(0, est - (item ->> 'qtd')::int);
    update public.docs set dados = jsonb_set(dados, '{estoque}', to_jsonb(novo)) where colecao = 'produtos' and id = item ->> 'id';
    baixas := baixas || jsonb_build_object(item ->> 'id', coalesce((baixas ->> (item ->> 'id'))::int, 0) + (est - novo));
  end loop;
  update public.docs set dados = dados || jsonb_build_object(
      'status', 'confirmado', 'pago', true, 'confirmadoEm', agora, 'estoqueBaixado', true,
      'pagamentoVerificado', true, 'baixas', baixas, 'pagamento', case when ped ->> 'tipo' = 'compra' then 'Pix (Mercado Pago)' else ped ->> 'pagamento' end,
      'mpId', p_mp_id,
      'historico', coalesce(dados -> 'historico', '[]'::jsonb) || jsonb_build_array(jsonb_build_object('em', agora, 'status', 'confirmado')))
    where colecao = 'pedidos' and id = p_codigo;
  return 'confirmado';
end;
$$;
revoke execute on function public.confirmar_pagamento(text, text, numeric) from public, anon, authenticated;

-- Cliente cancela a própria reserva; o valor a devolver sai da regra gravada no pedido
create or replace function public.cancelar_pedido(p_codigo text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  ped jsonb;
  pago numeric;
  valor numeric;
  agora bigint := (extract(epoch from now()) * 1000)::bigint;
begin
  select dados into ped from public.docs where colecao = 'pedidos' and id = p_codigo for update;
  if ped is null or ped ->> 'dono' is distinct from auth.uid()::text then raise exception 'Pedido não encontrado'; end if;
  if ped ->> 'tipo' = 'compra' or ped ->> 'status' not in ('aguardando', 'confirmado') or ped ? 'etapa' and ped ->> 'etapa' in ('enviado', 'pronto') then
    raise exception 'Este pedido não pode mais ser cancelado por aqui. Fale com a loja.';
  end if;
  pago := case when coalesce((ped ->> 'pago')::boolean, false) then (ped ->> 'sinal')::numeric else 0 end;
  valor := case when agora <= (ped ->> 'criadoEm')::bigint + coalesce((ped -> 'regra' ->> 'janelaMin')::int, 60) * 60000
                then pago else round(pago * coalesce((ped -> 'regra' ->> 'percDepois')::numeric, 50)) / 100 end;
  update public.docs set dados = dados || jsonb_build_object(
      'status', 'cancelado', 'canceladoEm', agora, 'canceladoPor', 'cliente', 'reembolso', valor,
      'historico', coalesce(dados -> 'historico', '[]'::jsonb) || jsonb_build_array(jsonb_build_object('em', agora, 'status', 'cancelado')))
    where colecao = 'pedidos' and id = p_codigo;
  return jsonb_build_object('reembolso', valor);
end;
$$;
grant execute on function public.cancelar_pedido(text) to authenticated;

-- Para achar rápido os pedidos de cada cliente
create index if not exists docs_pedidos_dono on public.docs ((dados ->> 'dono')) where colecao = 'pedidos';
