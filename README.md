# TMZ STORE

TMZ, a loja que veste o povo. Loja online em HTML, CSS e JavaScript puro, sem dependências e sem build.

## O que tem

**Loja**
- Destaque, faixa de avisos, categorias em círculo, "Ofertas do dia", banner e avaliações
- "Compre agora" abre a tela "O que você procura?" com o estoque de cada categoria
- Produto esgotado não pode ir para o carrinho; o carrinho respeita o estoque
- Tela do produto com "Comprar agora", "Adicionar ao carrinho" e "Reservar e retirar na loja"
- "Combina com" na tela do produto e "Complete o look" no carrinho: sugere peças de categorias
  que combinam (bermuda → camiseta, chinelo, boné…). O dono escolhe as combinações em
  Painel → Categorias

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

**Painel do lojista** (`#painel`, botão "Painel" no topo ou "Área do lojista" no rodapé):
- Resumo: pagamentos pendentes, pedidos para retirar/enviar, devoluções, estoque baixo
- Pedidos e reservas: confirmar sinal recebido (baixa o estoque), marcar retirado/enviado,
  cancelar com o valor de devolução já calculado, registrar devolução feita, voltar peças ao estoque
- Produtos e estoque: somar entradas, +/− unidade, ligar/desligar oferta, cadastrar, editar
  (com foto), excluir. Serve para qualquer produto, inclusive celulares
- Categorias: criar (ex.: Celulares), renomear, trocar foto, remover
- Destaque e textos: título, palavra vazada, subtítulo, botão, banner e faixa do topo, com prévia
- Configurações: WhatsApp, Instagram, chave Pix, frete e regras de reserva

## Onde ficam os dados

`js/dados.js` tem dois modos:

- **Nuvem** — quando o site roda como artifact do Claude, usa o banco compartilhado do artifact.
  O que o dono muda no painel aparece para todos; cada cliente só vê as próprias reservas.
  O painel abre só para quem administra o artifact.
- **Local** — em qualquer outra hospedagem (GitHub Pages, Netlify…) guarda tudo no navegador.
  Bom para testar o fluxo inteiro. O painel abre com PIN (inicial `1234`).

> **Para a loja no ar com clientes reais** é preciso um servidor: no modo local, cada navegador
> tem sua própria cópia dos dados, então o que o dono muda não chega aos clientes e as reservas
> não chegam ao dono. A troca é só em `js/dados.js`: as funções `salvarProduto`, `criarPedido`,
> `atualizarPedido` etc. passam a gravar num backend (Firebase, Supabase ou uma API própria), com
> login de verdade para o painel no lugar do PIN.

**Pagamento:** o site não cobra sozinho. O cliente paga o sinal por Pix e manda o comprovante
pelo WhatsApp; o dono confirma no painel. Para cobrança automática, integre um gateway
(Mercado Pago, Pagar.me, etc.) no mesmo ponto em que o pedido é criado.

## Valores iniciais

`js/produtos.js` tem o catálogo e os textos iniciais (`LOJA`, `DESTAQUE`, `CATEGORIAS`, `PRODUTOS`).
Depois do primeiro acesso ao painel, vale o que estiver salvo nele.

`COMENTARIOS` são exemplos (`exemplo: true`); troque pelos comentários reais dos clientes para
sumir o aviso "Comentários de exemplo".

As cores ficam no topo de `css/style.css`; as telas novas em `css/telas.css`.
As fontes (Barlow, Barlow Condensed e Inter) estão em `fonts/`.

## Rodar

```bash
python3 -m http.server 8000
```

Publica direto no GitHub Pages: *Settings → Pages → Deploy from branch*.
