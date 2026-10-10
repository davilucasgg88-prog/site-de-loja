// Catálogo da loja. Edite esta lista para cadastrar seus produtos.
// "oferta: true" coloca o produto em "Ofertas do dia".
// "estoque" é a quantidade disponível; a tela "O que você procura?" soma o estoque de cada categoria.
// Valores iniciais. Depois que o site estiver no ar, o dono muda tudo isso pelo
// Painel do lojista (botão "Painel" no topo ou link "Área do lojista" no rodapé).
const LOJA = {
  nome: "TMZ STORE",
  whatsapp: "5500000000000", // DDI + DDD + número, só dígitos
  instagram: "https://www.instagram.com/tmz_storee/",
  moeda: "BRL",
  idioma: "pt-BR",
  freteGratisAcima: 299,
  frete: 19.9,
  // Pagamento do sinal das reservas
  pixChave: "",            // ex.: CNPJ, e-mail, telefone ou chave aleatória
  pixNome: "TMZ STORE",
  // Loja física (aparece no rodapé quando preenchido)
  endereco: "",
  horario: "",
  email: "",
  tiktok: "",
  facebook: "",
  linkExtra: "",
  linkExtraNome: "",
  bannerImagem: "",
  // Produto da seção "Produto em destaque" (id); vazio = primeira oferta com foto
  produtoDestaque: "4",
  // Regras de reserva
  reservaPercentual: 30,   // reserva pagando 30% e retirando na loja
  reservaFixa: 50,         // reserva pagando R$ 50 e o resto depois
  estornoJanelaMin: 60,    // cancelando dentro desse tempo, devolve 100% do sinal
  estornoDepoisPerc: 50,   // depois disso, devolve essa % do sinal
  // PIN do painel quando o site roda sem servidor (só para testes, não é segurança de verdade)
  pinPainel: "1234",
};

// Textos do destaque, do banner e da faixa do topo
const DESTAQUE = {
  linha1: "TMZ, a loja",
  linha2: "que veste",
  linha3: "o povo",
  vazada: "povo",
  sub: "Peças peruanas de primeira linha",
  texto: "Lacoste, Nike, Tommy Hilfiger e muito mais, com acabamento de qualidade e entrega para todo o Brasil.",
  botao: "Compre agora",
  bannerTag: "Oferta exclusiva",
  bannerTitulo: "Até 40% off",
  bannerSub: "Em peças selecionadas",
  bannerTexto: "Só por tempo limitado. Não fique de fora!",
  bannerBotao: "Aproveitar oferta",
  avisos: ["Frete grátis acima de R$ 299", "Peças peruanas de primeira linha", "Enviamos para todo o Brasil", "Siga @tmz_storee"],
};

// "combina": categorias sugeridas em "Combina com" quando o cliente olha um produto desta.
// Ids que ainda não existem (bermudas, calcados, bones, celulares) passam a valer
// assim que o dono criar a categoria com esse nome no painel.
const CATEGORIAS = [
  { id: "camisetas", nome: "Camisetas", imagem: "img/cat-camisetas.jpg", combina: ["bermudas", "calcados", "oculos", "bones", "wearables"] },
  { id: "oculos", nome: "Óculos", imagem: "img/cat-oculos.jpg", combina: ["camisetas", "bones", "wearables", "bermudas"] },
  { id: "wearables", nome: "Relógios", imagem: "img/cat-wearables.jpg", combina: ["camisetas", "oculos", "audio"] },
  { id: "audio", nome: "Fones", imagem: "img/cat-audio.jpg", combina: ["celulares", "wearables", "gaming", "camisetas"] },
  { id: "accessories", nome: "Acessórios", combina: ["camisetas", "bermudas", "oculos"] },
  { id: "gaming", nome: "Games", imagem: "img/cat-gaming.jpg", combina: ["audio", "camisetas"] },
  { id: "cameras", nome: "Câmeras", imagem: "img/cat-cameras.jpg", combina: ["accessories", "celulares", "audio"] },
];

// Combinações para categorias que o dono ainda pode criar no painel
const COMBINA_PADRAO = {
  bermudas: ["camisetas", "calcados", "bones", "oculos"],
  shorts: ["camisetas", "calcados", "bones", "oculos"],
  calcados: ["bermudas", "camisetas", "meias", "bones"],
  bones: ["camisetas", "oculos", "bermudas"],
  calcas: ["camisetas", "calcados", "bones"],
  celulares: ["audio", "wearables", "accessories"],
};

const PRODUTOS = [
  { id: 1, nome: "Fone Bluetooth Pro", categoria: "audio", estoque: 15, preco: 149.9, precoAntigo: 199.9, imagem: "img/deal-buds.jpg", oferta: true, descricao: "Fone sem fio com cancelamento de ruído e até 24 horas de bateria com o estojo." },
  { id: 2, nome: "Relógio Smart X", categoria: "wearables", estoque: 8, preco: 249.9, precoAntigo: 349.9, imagem: "img/deal-watch.jpg", oferta: true, descricao: "Tela sempre ligada, monitor de batimentos e sono, resistente à água." },
  { id: 3, nome: "Óculos Juliet", categoria: "oculos", estoque: 12, preco: 189.9, precoAntigo: 249.9, imagem: "img/oculos-juliet.jpg", oferta: true, descricao: "Óculos peruano de primeira linha, armação metálica cromada e lentes escuras espelhadas.", detalhes: ["Armação metálica cromada", "Lentes escuras espelhadas", "Acompanha estojo"] },
  { id: 4, nome: "Camiseta Lacoste Faixa", categoria: "camisetas", estoque: 24, preco: 119.9, precoAntigo: 159.9, imagem: "img/camiseta-lacoste.jpg", oferta: true, descricao: "Camiseta peruana de primeira linha, malha de algodão com faixa preta e estampa Lacoste.", detalhes: ["Malha de algodão encorpada", "Faixa preta com estampa frontal", "Etiqueta e acabamento de primeira linha", "Tamanhos do P ao GG"] },
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

// Guia de medidas (Provador TMZ). Valores de referência em centímetros, do P ao GG.
// O dono ajusta pelo Painel → Medidas com as medidas reais das peças.
// "campos": medidas da peça (aparecem no manequim com as letras A, B, C, D).
// "corpo": medida do corpo usada para recomendar o tamanho [mínimo, máximo].
const MEDIDAS = {
  camisetas: {
    nome: "Camisetas", figura: "tronco",
    campos: [
      { id: "largura", nome: "Largura", dica: "De uma axila à outra, com a peça esticada na mesa." },
      { id: "comprimento", nome: "Comprimento", dica: "Do ponto mais alto do ombro até a barra." },
      { id: "ombro", nome: "Ombro", dica: "De uma costura do ombro até a outra." },
      { id: "manga", nome: "Manga", dica: "Da costura do ombro até a ponta da manga." },
    ],
    corpo: { nome: "Tórax", dica: "Passe a fita em volta do peito, na altura das axilas, sem apertar." },
    tamanhos: {
      P: { largura: 50, comprimento: 70, ombro: 44, manga: 20, corpo: [88, 94] },
      M: { largura: 53, comprimento: 72, ombro: 46, manga: 21, corpo: [94, 100] },
      G: { largura: 56, comprimento: 74, ombro: 48, manga: 22, corpo: [100, 106] },
      GG: { largura: 59, comprimento: 76, ombro: 50, manga: 23, corpo: [106, 112] },
    },
  },
  bermudas: {
    nome: "Bermudas e shorts", figura: "bermuda",
    campos: [
      { id: "cintura", nome: "Cintura", dica: "Contorno do cós, sem esticar o elástico." },
      { id: "quadril", nome: "Quadril", dica: "Contorno na parte mais larga do quadril." },
      { id: "comprimento", nome: "Comprimento", dica: "Do cós até a barra, pela lateral." },
      { id: "entreperna", nome: "Entreperna", dica: "Da costura do gancho até a barra." },
    ],
    corpo: { nome: "Cintura", dica: "Passe a fita na altura do umbigo, sem apertar." },
    tamanhos: {
      P: { cintura: 76, quadril: 98, comprimento: 47, entreperna: 19, corpo: [72, 78] },
      M: { cintura: 82, quadril: 102, comprimento: 48, entreperna: 20, corpo: [78, 84] },
      G: { cintura: 88, quadril: 106, comprimento: 49, entreperna: 21, corpo: [84, 90] },
      GG: { cintura: 94, quadril: 110, comprimento: 50, entreperna: 22, corpo: [90, 96] },
    },
  },
  calcas: {
    nome: "Calças", figura: "calca",
    campos: [
      { id: "cintura", nome: "Cintura", dica: "Contorno do cós, com a calça fechada." },
      { id: "quadril", nome: "Quadril", dica: "Contorno na parte mais larga do quadril." },
      { id: "comprimento", nome: "Comprimento", dica: "Do cós até a barra, pela lateral." },
      { id: "entreperna", nome: "Entreperna", dica: "Da costura do gancho até a barra." },
    ],
    corpo: { nome: "Cintura", dica: "Passe a fita na altura do umbigo, sem apertar." },
    tamanhos: {
      P: { cintura: 76, quadril: 98, comprimento: 102, entreperna: 76, corpo: [72, 78] },
      M: { cintura: 82, quadril: 102, comprimento: 104, entreperna: 78, corpo: [78, 84] },
      G: { cintura: 88, quadril: 106, comprimento: 106, entreperna: 80, corpo: [84, 90] },
      GG: { cintura: 94, quadril: 110, comprimento: 108, entreperna: 82, corpo: [90, 96] },
    },
  },
  bones: {
    nome: "Bonés", figura: "cabeca",
    campos: [
      { id: "circunferencia", nome: "Circunferência", dica: "Contorno interno do boné, na faixa de suor." },
      { id: "aba", nome: "Aba", dica: "Da costura da copa até a ponta da aba." },
    ],
    corpo: { nome: "Cabeça", dica: "Passe a fita 2 cm acima das sobrancelhas e das orelhas." },
    tamanhos: {
      P: { circunferencia: 55, aba: 7, corpo: [54, 55.5] },
      M: { circunferencia: 57, aba: 7, corpo: [55.5, 57.5] },
      G: { circunferencia: 59, aba: 7.5, corpo: [57.5, 59.5] },
      GG: { circunferencia: 61, aba: 7.5, corpo: [59.5, 61.5] },
    },
  },
  calcados: {
    nome: "Calçados e sandálias", figura: "pe",
    campos: [
      { id: "palmilha", nome: "Palmilha", dica: "Comprimento interno, do calcanhar até a ponta." },
      { id: "largura", nome: "Largura", dica: "Parte mais larga do pé, na altura dos dedos." },
      { id: "numeracao", nome: "Numeração", dica: "Numeração brasileira equivalente.", texto: true },
    ],
    corpo: { nome: "Comprimento do pé", dica: "Pise numa folha, marque o calcanhar e o dedo maior e meça a distância." },
    tamanhos: {
      P: { palmilha: 25, largura: 9.4, numeracao: "37–38", corpo: [24, 25] },
      M: { palmilha: 26.3, largura: 9.8, numeracao: "39–40", corpo: [25, 26.3] },
      G: { palmilha: 27.6, largura: 10.2, numeracao: "41–42", corpo: [26.3, 27.6] },
      GG: { palmilha: 28.9, largura: 10.6, numeracao: "43–44", corpo: [27.6, 28.9] },
    },
  },
};
