# TMZ STORE

Loja online estática (HTML, CSS e JavaScript puro), sem dependências e sem build.
TMZ, a loja que veste o povo. Página inicial em preto e branco: menu lateral de categorias, hero, faixa de vantagens,
categorias em círculo, "Ofertas do dia", banner de oferta e avaliações de clientes.

## Recursos
- Filtro por categoria (menu lateral e círculos) e busca
- Página de detalhe do produto (modal) com selo de desconto e parcelamento
- Carrinho lateral com quantidades, frete grátis acima de um valor e persistência no navegador
- Finalização do pedido pelo WhatsApp com resumo completo
- Layout responsivo (menu hambúrguer no celular)

## Como usar
Abra `index.html` no navegador, ou sirva a pasta:

```bash
python3 -m http.server 8000
```

## Personalizar
Edite `js/produtos.js`:
- `LOJA.nome`, `LOJA.whatsapp` (DDI+DDD+número), `LOJA.moeda`/`LOJA.idioma`, `LOJA.frete` e `LOJA.freteGratisAcima`
- `CATEGORIAS` (menu lateral e círculos) e `PRODUTOS` — `oferta: true` coloca o produto em "Ofertas do dia"
- `estoque` em cada produto — a tela "O que você procura?" (botão "Compre agora") mostra a soma por categoria
- `COMENTARIOS` — os atuais são exemplos (`exemplo: true`); troque pelos comentários reais dos clientes para sumir o aviso "Comentários de exemplo"
- As imagens ficam em `img/`; troque pelos seus arquivos mantendo o nome ou altere o caminho

As cores ficam no topo de `css/style.css` (`--acento` é a cor de destaque; hoje branco).
As fontes (Barlow, Barlow Condensed e Inter) estão em `fonts/`, sem depender do Google Fonts.

## Publicar
Funciona direto no GitHub Pages: *Settings → Pages → Deploy from branch*.
