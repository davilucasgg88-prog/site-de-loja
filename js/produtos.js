// Catálogo da loja. Edite esta lista para cadastrar seus produtos.
// "imagem" pode ser uma URL (ex.: "img/camiseta.jpg"); se vazio, usa o emoji.
const LOJA = {
  nome: "Minha Loja",
  whatsapp: "5500000000000", // DDI + DDD + número, só dígitos
  freteGratisAcima: 199,
  frete: 19.9,
};

const PRODUTOS = [
  { id: 1, nome: "Camiseta Básica Algodão", categoria: "Roupas", preco: 59.9, precoAntigo: 79.9, emoji: "👕", imagem: "", descricao: "Camiseta 100% algodão, confortável e durável. Disponível do P ao GG.", destaque: true },
  { id: 2, nome: "Calça Jeans Slim", categoria: "Roupas", preco: 149.9, emoji: "👖", imagem: "", descricao: "Jeans com elastano, modelagem slim e lavagem média." },
  { id: 3, nome: "Moletom com Capuz", categoria: "Roupas", preco: 129.9, precoAntigo: 169.9, emoji: "🧥", imagem: "", descricao: "Moletom flanelado por dentro, ideal para dias frios." },
  { id: 4, nome: "Tênis Casual", categoria: "Calçados", preco: 219.9, emoji: "👟", imagem: "", descricao: "Tênis leve com solado de borracha e palmilha macia.", destaque: true },
  { id: 5, nome: "Sandália Conforto", categoria: "Calçados", preco: 89.9, emoji: "🩴", imagem: "", descricao: "Sandália anatômica para o dia a dia." },
  { id: 6, nome: "Bota Couro", categoria: "Calçados", preco: 299.9, precoAntigo: 349.9, emoji: "🥾", imagem: "", descricao: "Bota de couro legítimo com costura reforçada." },
  { id: 7, nome: "Relógio Minimalista", categoria: "Acessórios", preco: 179.9, emoji: "⌚", imagem: "", descricao: "Pulseira de aço inox, resistente à água.", destaque: true },
  { id: 8, nome: "Óculos de Sol", categoria: "Acessórios", preco: 99.9, emoji: "🕶️", imagem: "", descricao: "Lentes com proteção UV400." },
  { id: 9, nome: "Mochila Urbana", categoria: "Acessórios", preco: 159.9, precoAntigo: 199.9, emoji: "🎒", imagem: "", descricao: "Compartimento para notebook de até 15,6\" e tecido impermeável." },
  { id: 10, nome: "Boné Aba Curva", categoria: "Acessórios", preco: 49.9, emoji: "🧢", imagem: "", descricao: "Ajuste traseiro com fivela metálica." },
  { id: 11, nome: "Fone Bluetooth", categoria: "Eletrônicos", preco: 199.9, precoAntigo: 249.9, emoji: "🎧", imagem: "", descricao: "Até 30 horas de bateria e cancelamento de ruído.", destaque: true },
  { id: 12, nome: "Caixa de Som Portátil", categoria: "Eletrônicos", preco: 249.9, emoji: "🔊", imagem: "", descricao: "Som potente, à prova d'água (IPX7)." },
];
