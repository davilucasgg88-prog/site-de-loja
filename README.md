# TMZ STORE

TMZ, a loja que veste o povo. Loja online em HTML, CSS e JavaScript puro, sem build.

**Para colocar no ar:** siga o [COLOCAR-NO-AR.md](COLOCAR-NO-AR.md) (Supabase, Mercado Pago, publicação
e domínio). Antes de divulgar, faça o [ROTEIRO-DE-TESTES.md](ROTEIRO-DE-TESTES.md) com pessoas reais.

## O que tem

**Loja**, nesta ordem: topo com "Comprar agora", destaque principal com miniaturas, destaques da semana,
categorias em círculo, catálogo com filtros por categoria, produto em destaque (escolhido no painel),
avaliações, chamada final e rodapé com atendimento e redes.
- Faixa de avisos no topo e tema claro/escuro pela lua
- "Compre agora" abre a tela "O que você procura?" com o estoque de cada categoria
- Produto esgotado não pode ir para o carrinho; o carrinho respeita o estoque
- Tela do produto com "Comprar agora", "Adicionar ao carrinho" e "Reservar e retirar na loja"
- "Combina com" na tela do produto e "Complete o look" no carrinho: sugere peças de categorias
  que combinam (bermuda → camiseta, chinelo, boné…). O dono escolhe as combinações em
  Painel → Categorias

**Provador TMZ / Guia de medidas** (`#medidas`): no topo do site, um card com manequim mostra as
medidas da peça (A, B, C, D) para cada tamanho do P ao GG, em centímetros, para camisetas, bermudas
e calçados. A tela completa tem também calças e bonés, tabela de todos os tamanhos e uma calculadora
("Descubra seu tamanho") que recomenda o tamanho pela medida do corpo. Os valores iniciais estão em
`MEDIDAS` (`js/produtos.js`) e o dono ajusta em Painel → Medidas. A tela do produto tem link para o guia.

**Cupons de desconto:** na finalização o cliente digita o cupom (ou chega por um link
`?cupom=CODIGO`, que já aplica sozinho). Tipos: % de desconto, R$ de desconto ou frete grátis, com
compra mínima, validade, limite de usos, 1 uso por cliente e categoria. O aviso do Instagram mostra
um cupom com o botão "Usar cupom". No painel (aba Cupons): criar, editar, ligar/desligar, excluir,
copiar o link e ver usos, vendas e desconto dado por cupom. As regras ficam em `js/cupons.js`.
Sem servidor, o limite total de usos é conferido com os pedidos que o navegador enxerga.

**Frete pelo CEP:** o cliente digita o CEP no carrinho ou na compra; o ViaCEP preenche rua, bairro e
cidade, e o frete e o prazo saem pela distância da loja (mesma cidade, mesmo estado, mesma região ou
resto do Brasil). Tabela, cidade da loja e frete grátis em Painel → Configurações (`js/frete.js`).

**Aprovação de pedidos e loja ON/OFF:** todo pedido novo chega como "Aguardando aprovação". No painel
o dono aprova e define o prazo de envio (dias úteis); o cliente vê "Aprovado pela loja · envio até
dd/mm", e pedidos fora do prazo aparecem como "Atrasado". A chave **Loja ON/OFF** no topo do menu do
painel pausa as aprovações: com a loja OFF, o cliente vê um aviso (texto editável em Configurações),
os pedidos continuam chegando e ficam na fila, e só podem ser aprovados quando voltar para ON.

**Acompanhar pedido** (`#acompanhar`, `js/rastreio.js`): linha do tempo do pedido (feito → pago → em
separação → enviado com código de rastreio e previsão → entregue; ou pronto para retirar → retirado).
O cliente abre pelo link `?pedido=TMZ-AB12C#acompanhar` ou digita o código e os 4 últimos números do
WhatsApp, de qualquer aparelho (no Supabase pela função `rastrear_pedido`, sem mostrar endereço nem
telefone). No painel, a aba Pedidos tem um **quadro** por etapa (A pagar, Separar, Em separação,
Enviados e prontos, Concluídos), botões para avançar cada etapa, transportadora e código de rastreio,
e **Avisar cliente**, que abre o WhatsApp com a mensagem da etapa e o link de acompanhamento.

**Avise-me quando chegar:** produto esgotado mostra um campo para o cliente deixar WhatsApp ou e-mail.
Em Painel → Lista de espera o dono vê o que mais procuram e, quando repõe, avisa cada um com um clique.

**Páginas legais** (`#privacidade`, `#trocas`, `#termos`, `js/legal.js`): Política de Privacidade (LGPD),
Trocas e Devoluções (CDC, com os 7 dias de arrependimento) e Termos de Uso, preenchidas com razão
social, CNPJ, contato e regras de reserva da loja. Vale revisar com um advogado.

**Carrinho** (`#carrinho`): tela cheia com quantidades, barra de frete grátis e resumo.

**Compra e reserva** (`#compra`), três formas:
| Forma | Paga agora | Restante |
|---|---|---|
| Compra completa | 100% | — (entrega ou retirada) |
| Reserva % (padrão 30%) | 30% do total, por Pix | na loja, na retirada |
| Reserva fixa (padrão R$ 50) | R$ 50, por Pix | depois, antes da retirada ou do envio |

Regra de cancelamento das reservas (mostrada e aceita antes de reservar):
cancelando em até 1 hora depois de reservar, devolve 100% do sinal pago; depois disso, devolve 50%.
Os valores (30%, R$ 50, 1 hora, 50%) são editáveis no painel.

**Minhas reservas** (`#reservas`): o cliente acompanha o status, vê o prazo de devolução total
e cancela, com o valor a devolver calculado pela regra.

**Entrar / Cadastrar** (`#entrar`, ícone de pessoa no topo): tela "Bem-vindo de volta!" com e-mail,
senha (olho para mostrar), "Lembrar de mim", "Esqueci a senha" e "Cadastre-se", com a logo TMZ no
círculo e as redes da loja na lateral. O cliente cria conta com nome, e-mail, WhatsApp e senha; logado,
os dados já vêm preenchidos na compra.
**Só um login abre o painel:** o e-mail em `ACESSO.emailAdmin` (`js/produtos.js`). Qualquer outra conta
vê "Sem acesso". Depois de 5 erros seguidos, a tela espera 1 minuto.
- **Login de verdade (Supabase):** crie um projeto grátis em supabase.com, crie o usuário do dono em
  *Authentication → Users → Add user* e preencha `supabaseUrl` e `supabaseChave` (a chave **anon public**)
  em `ACESSO`. Contas e senhas ficam só no servidor e "Esqueci a senha" manda o link por e-mail.
- **No esboço publicado no Claude:** as contas ficam no banco da loja (`contas/<id de quem acessa>`,
  senha só como hash). Cada pessoa só lê a própria conta e o dono vê todas em Painel → Clientes.
- **Sem Supabase (teste):** o dono entra com o e-mail de `ACESSO` e a senha de teste (inicial `1234`,
  muda em Configurações); as contas de clientes ficam no navegador (senha guardada só como hash).
  Não é proteção de verdade.

**Painel do lojista** (botão "Painel" no topo ou "Área do lojista" no rodapé):
- Resumo com a lista "Para abrir a loja" (o que falta configurar) e Lista de espera ("Avise-me quando chegar")
- Carrinhos: todo carrinho montado na loja, com ID (CRT-…), cliente, itens, valor, última mudança e
  situação: aguardando, abandonado (parado há 1 hora), concluído (com o ID do pedido, que abre no
  histórico) ou esvaziado. Mostra taxa de conversão, valor abandonado e botão para chamar no WhatsApp
- Clientes: contas criadas, com e-mail, WhatsApp, data de cadastro e número de compras
- Resumo: pagamentos pendentes, pedidos para retirar/enviar, devoluções, faturamento e visitas de hoje
- Faturamento: total de 7/30/90 dias, ticket médio, a receber, devolvido, gráfico por dia,
  mais vendidos e divisão por forma de compra (conta o que o dono confirmou como pago)
- Histórico de compras: todos os pedidos com busca, filtro de período e situação, e exportação em CSV
- Visitas: pessoas por dia, páginas abertas, comparação com ontem e taxa de conversão
  (visitas do dono não entram; no modo local só conta o próprio navegador)
- Contato e links: WhatsApp, e-mail, endereço, horário, Instagram, TikTok, Facebook e um link extra
- Pedidos e reservas: confirmar sinal recebido (baixa o estoque), marcar retirado/enviado,
  cancelar com o valor de devolução já calculado, registrar devolução feita, voltar peças ao estoque
- Produtos e preços, botão "Várias fotos": escolha até 40 fotos de uma vez (ex.: as do Instagram salvas
  no celular); cada uma vira um produto em rascunho, fora da loja até ganhar preço
- Produtos e preços, modo "Editar todos os produtos": nome, descrição, foto (envio ou link), categoria,
  preço e preço antigo de todos os produtos numa lista só; as mudanças ficam marcadas e vão para a loja
  no "Salvar tudo"
- Produtos e preços: preço e preço antigo editáveis direto na tabela, filtro "só ofertas", somar entradas, +/− unidade, ligar/desligar oferta, cadastrar, editar
  (com foto), excluir. Serve para qualquer produto, inclusive celulares
- Categorias: criar (ex.: Celulares), renomear, trocar foto, remover
- Destaque e textos: título, palavra vazada, subtítulo, botão, produto em destaque, foto e textos da chamada final e faixa do topo, com prévia
- Configurações: WhatsApp, Instagram, chave Pix, frete e regras de reserva

## Onde ficam os dados

`js/dados.js` tem três modos, escolhidos sozinhos:

- **Servidor (Supabase)**, quando `ACESSO.supabaseUrl` e `supabaseChave` estão preenchidos em
  `js/produtos.js`: produtos, pedidos, clientes, carrinhos e visitas ficam no banco, iguais em todos os
  aparelhos. Login de verdade e regras de acesso no servidor (`supabase/schema.sql`). Cada visitante
  ganha uma sessão anônima para o carrinho e os pedidos; ao criar conta, eles passam para a conta.
  Conexão em `js/supabase.js`.
- **Nuvem do Claude**, quando o site roda como artifact: usa o banco compartilhado do artifact.
- **Local**, em qualquer outra hospedagem sem Supabase: guarda tudo no navegador. Bom para testar.

**Pagamento:** sem o Mercado Pago, o cliente paga pela chave Pix e manda o comprovante no WhatsApp;
o dono confirma no painel. Com o Supabase e o Mercado Pago (Painel → Configurações → Pagamento online),
o cliente vê o QR Code do Pix, o servidor recalcula o valor (`supabase/functions/pagamento`) e, quando o
Pix cai, o webhook (`supabase/functions/mercadopago-webhook`) confirma o pedido e baixa o estoque.

## Valores iniciais

`js/produtos.js` tem o catálogo e os textos iniciais (`LOJA`, `DESTAQUE`, `CATEGORIAS`, `PRODUTOS`).
Depois do primeiro acesso ao painel, vale o que estiver salvo nele.

`COMENTARIOS` são exemplos (`exemplo: true`); troque pelos comentários reais dos clientes para
sumir o aviso "Comentários de exemplo".

O site abre no tema claro; a lua no topo liga o modo escuro e a escolha fica salva no navegador.
As cores dos dois temas ficam no topo de `css/style.css` (`:root` é o claro, `html[data-tema="escuro"]` o escuro);
banner, fotos e cards de categoria ficam escuros nos dois (classe `ilha-escura`). As telas novas estão em `css/telas.css`.
As fontes (Anton nos títulos e Inter no texto) estão em `fonts/`.

## Rodar e testar

```bash
python3 -m http.server 8000     # abre em http://localhost:8000
npm install && npx playwright install chromium
npm test                         # 11 testes no navegador, inclusive com um Supabase falso
```

Os testes rodam no GitHub a cada push (`.github/workflows/testes.yml`). A publicação no GitHub Pages
(`.github/workflows/publicar.yml`) só acontece se eles passarem. O site é instalável como app
(`manifest.webmanifest`, `sw.js`) e tem prévia para WhatsApp e redes (`img/icones/og.png`).
