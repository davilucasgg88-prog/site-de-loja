// Catálogo da loja. Edite esta lista para cadastrar seus produtos.
// "oferta: true" coloca o produto em "Ofertas do dia".
// "estoque" é a quantidade disponível; a tela "O que você procura?" soma o estoque de cada categoria.
const LOJA = {
  nome: "TMZ STORE",
  whatsapp: "5500000000000", // DDI + DDD + número, só dígitos
  instagram: "https://www.instagram.com/tmz_storee/",
  moeda: "BRL",
  idioma: "pt-BR",
  freteGratisAcima: 299,
  frete: 19.9,
};

const CATEGORIAS = [
  { id: "camisetas", nome: "Camisetas", imagem: "img/cat-camisetas.jpg" },
  { id: "oculos", nome: "Óculos", imagem: "img/cat-oculos.jpg" },
  { id: "wearables", nome: "Relógios", imagem: "img/cat-wearables.jpg" },
  { id: "audio", nome: "Fones", imagem: "img/cat-audio.jpg" },
  { id: "accessories", nome: "Acessórios" },
  { id: "gaming", nome: "Games", imagem: "img/cat-gaming.jpg" },
  { id: "cameras", nome: "Câmeras", imagem: "img/cat-cameras.jpg" },
];

const PRODUTOS = [
  { id: 1, nome: "Fone Bluetooth Pro", categoria: "audio", estoque: 15, preco: 149.9, precoAntigo: 199.9, imagem: "img/deal-buds.jpg", oferta: true, descricao: "Fone sem fio com cancelamento de ruído e até 24 horas de bateria com o estojo." },
  { id: 2, nome: "Relógio Smart X", categoria: "wearables", estoque: 8, preco: 249.9, precoAntigo: 349.9, imagem: "img/deal-watch.jpg", oferta: true, descricao: "Tela sempre ligada, monitor de batimentos e sono, resistente à água." },
  { id: 3, nome: "Óculos Juliet", categoria: "oculos", estoque: 12, preco: 189.9, precoAntigo: 249.9, imagem: "img/oculos-juliet.jpg", oferta: true, descricao: "Óculos peruano de primeira linha, armação metálica cromada e lentes escuras espelhadas." },
  { id: 4, nome: "Camiseta Lacoste Faixa", categoria: "camisetas", estoque: 24, preco: 119.9, precoAntigo: 159.9, imagem: "img/camiseta-lacoste.jpg", oferta: true, descricao: "Camiseta peruana de primeira linha, malha de algodão com faixa preta e estampa Lacoste." },
  { id: 6, nome: "Headphone Max", categoria: "audio", estoque: 6, preco: 299.9, precoAntigo: 399.9, imagem: "img/cat-audio.jpg", descricao: "Headphone com som imersivo e até 40 horas de bateria." },
  { id: 7, nome: "Controle sem fio", categoria: "gaming", estoque: 10, preco: 179.9, imagem: "img/cat-gaming.jpg", descricao: "Controle sem fio com baixa latência e vibração." },
  { id: 8, nome: "Câmera Z", categoria: "cameras", estoque: 3, preco: 2999.9, imagem: "img/cat-cameras.jpg", descricao: "Câmera com sensor de 24 MP e vídeo em 4K." },
];

// Comentários da seção "Avaliações". Os abaixo são EXEMPLOS para mostrar o visual:
// troque pelos comentários reais dos seus clientes e apague "exemplo: true".
// Enquanto houver algum exemplo, o site mostra o aviso "Comentários de exemplo".
const COMENTARIOS = [
  { nome: "Rafael S.", cidade: "São Paulo, SP", nota: 5, produto: "Camiseta Lacoste Faixa", texto: "Malha grossa, costura caprichada e o caimento ficou perfeito. Já vou pegar mais duas cores.", exemplo: true },
  { nome: "Juliana M.", cidade: "Belo Horizonte, MG", nota: 5, produto: "Óculos Juliet", texto: "O óculos é pesado, bem acabado e a lente é escura de verdade. Chegou em 4 dias.", exemplo: true },
  { nome: "Lucas P.", cidade: "Recife, PE", nota: 5, produto: "Camiseta Lacoste Faixa", texto: "Atendimento rápido no WhatsApp, tiraram todas as minhas dúvidas de tamanho antes de fechar.", exemplo: true },
  { nome: "Bruna A.", cidade: "Curitiba, PR", nota: 4, produto: "Relógio Smart X", texto: "Gostei muito do relógio. Só demorou um pouco mais para chegar por causa da transportadora.", exemplo: true },
  { nome: "Diego R.", cidade: "Salvador, BA", nota: 5, produto: "Óculos Juliet", texto: "Comprei pro meu irmão e ele não tira do rosto. Embalagem bem protegida.", exemplo: true },
  { nome: "Camila T.", cidade: "Goiânia, GO", nota: 5, produto: "Fone Bluetooth Pro", texto: "Bateria dura o dia inteiro e o som é muito limpo. Preço justo demais.", exemplo: true },
  { nome: "Matheus L.", cidade: "Rio de Janeiro, RJ", nota: 5, produto: "Camiseta Lacoste Faixa", texto: "Terceira compra na TMZ. Sempre o mesmo padrão de qualidade, recomendo de olho fechado.", exemplo: true },
  { nome: "Ana C.", cidade: "Fortaleza, CE", nota: 5, produto: "Headphone Max", texto: "Chegou certinho, bem embalado e igual às fotos. Já indiquei para as amigas.", exemplo: true },
];
