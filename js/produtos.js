// Catálogo da loja. Edite esta lista para cadastrar seus produtos.
// "oferta: true" coloca o produto em "Deals of the Day".
const LOJA = {
  nome: "NEXORA",
  whatsapp: "5500000000000", // DDI + DDD + número, só dígitos
  moeda: "USD",
  idioma: "en-US",
  freteGratisAcima: 199,
  frete: 9.99,
};

const CATEGORIAS = [
  { id: "smartphones", nome: "Smartphones", imagem: "img/cat-smartphones.jpg" },
  { id: "laptops", nome: "Laptops", imagem: "img/cat-laptops.jpg" },
  { id: "wearables", nome: "Wearables", imagem: "img/cat-wearables.jpg" },
  { id: "audio", nome: "Audio", imagem: "img/cat-audio.jpg" },
  { id: "accessories", nome: "Accessories" },
  { id: "gaming", nome: "Gaming", imagem: "img/cat-gaming.jpg" },
  { id: "cameras", nome: "Cameras", imagem: "img/cat-cameras.jpg" },
];

const PRODUTOS = [
  { id: 1, nome: "Nexora Buds Pro", categoria: "audio", preco: 49.99, precoAntigo: 69.99, imagem: "img/deal-buds.jpg", oferta: true, descricao: "True wireless earbuds with active noise cancelling and 24h battery with the charging case." },
  { id: 2, nome: "Nexora Watch X", categoria: "wearables", preco: 129.99, precoAntigo: 199.99, imagem: "img/deal-watch.jpg", oferta: true, descricao: "Always-on display, heart-rate and sleep tracking, water resistant up to 50m." },
  { id: 3, nome: "Nexora Laptop Air", categoria: "laptops", preco: 799.99, precoAntigo: 999.99, imagem: "img/deal-laptop.jpg", oferta: true, descricao: "Ultra-thin aluminium body, 14\" display, 16GB RAM and 512GB SSD." },
  { id: 4, nome: "Nexora Phone 15", categoria: "smartphones", preco: 699.99, precoAntigo: 899.99, imagem: "img/deal-phone.jpg", oferta: true, descricao: "Triple camera system, 6.1\" OLED display and all-day battery." },
  { id: 5, nome: "Nexora Phone 15 Pro", categoria: "smartphones", preco: 999.99, imagem: "img/cat-smartphones.jpg", descricao: "Titanium design, pro camera system and 120Hz display." },
  { id: 6, nome: "Nexora Headphones Max", categoria: "audio", preco: 249.99, precoAntigo: 329.99, imagem: "img/cat-audio.jpg", descricao: "Over-ear headphones with immersive sound and 40h battery." },
  { id: 7, nome: "Nexora Controller", categoria: "gaming", preco: 59.99, imagem: "img/cat-gaming.jpg", descricao: "Wireless controller with low latency and haptic feedback." },
  { id: 8, nome: "Nexora Cam Z", categoria: "cameras", preco: 1199.99, imagem: "img/cat-cameras.jpg", descricao: "Mirrorless camera with 24MP sensor and 4K video." },
];
