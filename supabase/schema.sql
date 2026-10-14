-- =====================================================================
-- TMZ STORE · banco de dados no Supabase
-- Cole tudo em Supabase → SQL Editor → New query → Run.
-- Antes de rodar, troque o e-mail do dono na linha marcada com  <<<
-- =====================================================================

-- Uma tabela guarda todos os "documentos" da loja, no mesmo formato que o site já usa:
--   loja/config, loja/categorias      → textos, cupons, frete, contato (todos leem, só o dono altera)
--   produtos/<id>                     → catálogo (todos leem, só o dono altera)
--   reservas/<id do cliente>          → pedidos e reservas de cada cliente
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

-- Quem é o dono (único e-mail com acesso ao painel)
create table if not exists public.admins (email text primary key);
insert into public.admins (email) values ('admin@tmzstore.com.br')   -- <<< troque pelo e-mail do dono
on conflict do nothing;

create or replace function public.eh_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
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
drop policy if exists "cliente le o seu" on public.docs;
create policy "cliente le o seu" on public.docs for select
  using (colecao in ('reservas', 'carrinhos', 'visitas', 'contas', 'avisos') and id = auth.uid()::text);

drop policy if exists "cliente cria o seu" on public.docs;
create policy "cliente cria o seu" on public.docs for insert
  with check (colecao in ('reservas', 'carrinhos', 'visitas', 'contas', 'avisos') and id = auth.uid()::text);

drop policy if exists "cliente altera o seu" on public.docs;
create policy "cliente altera o seu" on public.docs for update
  using (colecao in ('reservas', 'carrinhos', 'visitas', 'contas', 'avisos') and id = auth.uid()::text)
  with check (colecao in ('reservas', 'carrinhos', 'visitas', 'contas', 'avisos') and id = auth.uid()::text);

-- O cliente vê se o pagamento do próprio pedido foi aprovado (sem ver os dos outros)
create or replace function public.status_pagamento(codigo text) returns jsonb
language sql stable security definer set search_path = public as $$
  select d.dados from public.docs d
  where d.colecao = 'pagamentos' and d.id = codigo
    and exists (
      select 1 from public.docs r
      where r.colecao = 'reservas' and r.id = auth.uid()::text
        and r.dados -> 'lista' @> jsonb_build_array(jsonb_build_object('codigo', codigo))
    );
$$;
grant execute on function public.status_pagamento(text) to anon, authenticated;

-- Acompanhar pedido: qualquer pessoa com o código e os 4 últimos números do WhatsApp vê a situação
-- (sem endereço nem telefone; do cliente só o primeiro nome)
create or replace function public.rastrear_pedido(codigo text, final_telefone text) returns jsonb
language sql stable security definer set search_path = public as $$
  select (p - 'cliente') || jsonb_build_object('cliente', jsonb_build_object('nome', split_part(p -> 'cliente' ->> 'nome', ' ', 1)))
  from public.docs d, jsonb_array_elements(d.dados -> 'lista') p
  where d.colecao = 'reservas'
    and d.dados -> 'lista' @> jsonb_build_array(jsonb_build_object('codigo', codigo))
    and p ->> 'codigo' = codigo
    and length(regexp_replace(final_telefone, '\D', '', 'g')) = 4
    and right(regexp_replace(p -> 'cliente' ->> 'telefone', '\D', '', 'g'), 4) = regexp_replace(final_telefone, '\D', '', 'g')
  limit 1;
$$;
grant execute on function public.rastrear_pedido(text, text) to anon, authenticated;

-- Para achar rápido o pedido pelo código (usado pelo pagamento)
create index if not exists docs_lista_gin on public.docs using gin ((dados -> 'lista'));
