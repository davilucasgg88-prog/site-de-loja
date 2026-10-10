# TMZ STORE

TMZ, a loja que veste o povo. Loja online em HTML, CSS e JavaScript puro, sem dependências e sem build.

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

**Login do painel** (`#painel`): tela "Bem-vindo de volta!" com e-mail, senha (com olho para mostrar),
"Lembrar de mim", "Esqueci a senha", a logo TMZ no círculo e as redes da loja na lateral.
Só um login entra: o e-mail em `ACESSO.emailAdmin` (`js/produtos.js`). Depois de 5 erros seguidos,
a tela espera 1 minuto.
- **Login de verdade (Supabase):** crie um projeto grátis em supabase.com, crie o usuário do dono em
  *Authentication → Users → Add user* (com o e-mail e a senha dele) e desligue *Allow new users to sign up*
  em *Authentication → Sign In / Providers*. Preencha `supabaseUrl` e `supabaseChave` (a chave **anon public**)
  em `ACESSO`. A senha fica só no Supabase e "Esqueci a senha" manda o link por e-mail.
- **Sem Supabase (teste):** entra com o e-mail de `ACESSO` e a senha de teste (inicial `1234`,
  muda em Configurações). Fica no navegador, então não é proteção de verdade.

**Painel do lojista** (botão "Painel" no topo ou "Área do lojista" no rodapé):
- Resumo: pagamentos pendentes, pedidos para retirar/enviar, devoluções, faturamento e visitas de hoje
- Faturamento: total de 7/30/90 dias, ticket médio, a receber, devolvido, gráfico por dia,
  mais vendidos e divisão por forma de compra (conta o que o dono confirmou como pago)
- Histórico de compras: todos os pedidos com busca, filtro de período e situação, e exportação em CSV
- Visitas: pessoas por dia, páginas abertas, comparação com ontem e taxa de conversão
  (visitas do dono não entram; no modo local só conta o próprio navegador)
- Contato e links: WhatsApp, e-mail, endereço, horário, Instagram, TikTok, Facebook e um link extra
- Pedidos e reservas: confirmar sinal recebido (baixa o estoque), marcar retirado/enviado,
  cancelar com o valor de devolução já calculado, registrar devolução feita, voltar peças ao estoque
- Produtos e preços: preço e preço antigo editáveis direto na tabela, filtro "só ofertas", somar entradas, +/− unidade, ligar/desligar oferta, cadastrar, editar
  (com foto), excluir. Serve para qualquer produto, inclusive celulares
- Categorias: criar (ex.: Celulares), renomear, trocar foto, remover
- Destaque e textos: título, palavra vazada, subtítulo, botão, produto em destaque, foto e textos da chamada final e faixa do topo, com prévia
- Configurações: WhatsApp, Instagram, chave Pix, frete e regras de reserva

## Onde ficam os dados

`js/dados.js` tem dois modos:

- **Nuvem** — quando o site roda como artifact do Claude, usa o banco compartilhado do artifact.
  O que o dono muda no painel aparece para todos; cada cliente só vê as próprias reservas.
  O painel abre só para quem administra o artifact.
- **Local** — em qualquer outra hospedagem (GitHub Pages, Netlify…) guarda tudo no navegador.
  Bom para testar o fluxo inteiro. O painel abre com o login acima.

> **Para a loja no ar com clientes reais** é preciso um servidor: no modo local, cada navegador
> tem sua própria cópia dos dados, então o que o dono muda não chega aos clientes e as reservas
> não chegam ao dono. A troca é só em `js/dados.js`: as funções `salvarProduto`, `criarPedido`,
> `atualizarPedido` etc. passam a gravar num backend (o mesmo Supabase do login, com regras que só deixam
> o e-mail do dono alterar produtos e ver pedidos).

**Pagamento:** o site não cobra sozinho. O cliente paga o sinal por Pix e manda o comprovante
pelo WhatsApp; o dono confirma no painel. Para cobrança automática, integre um gateway
(Mercado Pago, Pagar.me, etc.) no mesmo ponto em que o pedido é criado.

## Valores iniciais

`js/produtos.js` tem o catálogo e os textos iniciais (`LOJA`, `DESTAQUE`, `CATEGORIAS`, `PRODUTOS`).
Depois do primeiro acesso ao painel, vale o que estiver salvo nele.

`COMENTARIOS` são exemplos (`exemplo: true`); troque pelos comentários reais dos clientes para
sumir o aviso "Comentários de exemplo".

O site abre no tema claro; a lua no topo liga o modo escuro e a escolha fica salva no navegador.
As cores dos dois temas ficam no topo de `css/style.css` (`:root` é o claro, `html[data-tema="escuro"]` o escuro);
banner, fotos e cards de categoria ficam escuros nos dois (classe `ilha-escura`). As telas novas estão em `css/telas.css`.
As fontes (Anton nos títulos e Inter no texto) estão em `fonts/`.

## Rodar

```bash
python3 -m http.server 8000
```

Publica direto no GitHub Pages: *Settings → Pages → Deploy from branch*.
