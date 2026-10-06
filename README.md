# Site de Loja

Loja online estática (HTML, CSS e JavaScript puro), sem dependências e sem build.

## Recursos
- Catálogo com categorias, busca e ordenação por preço/nome
- Página de detalhe do produto (modal) com selo de desconto e parcelamento
- Carrinho lateral com quantidades, frete grátis acima de um valor e persistência no navegador
- Finalização do pedido pelo WhatsApp com resumo completo
- Layout responsivo e tema escuro automático

## Como usar
Abra `index.html` no navegador, ou sirva a pasta:

```bash
python3 -m http.server 8000
```

## Personalizar
Edite `js/produtos.js`:
- `LOJA.nome`, `LOJA.whatsapp` (DDI+DDD+número), `LOJA.frete` e `LOJA.freteGratisAcima`
- A lista `PRODUTOS` — use `imagem: "img/arquivo.jpg"` para fotos reais (sem imagem, mostra o emoji)

As cores ficam no topo de `css/style.css` (`--cor-primaria`, `--cor-destaque`).

## Publicar
Funciona direto no GitHub Pages: *Settings → Pages → Deploy from branch*.
