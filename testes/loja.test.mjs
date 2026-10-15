// Testes da TMZ STORE no navegador (Chromium), no computador e no celular.
// Rodar:  npm install  →  npx playwright install chromium  →  npm test
// Sobe um servidor local com a loja e um Supabase falso (testes/supabase-falso.mjs).
import { chromium } from "playwright";
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { iniciarSupabaseFalso } from "./supabase-falso.mjs";

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const PORTA = 8131;
const PORTA_SUPA = 8132;
const BASE = `http://localhost:${PORTA}/`;
const TIPOS = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json" };

/* ---------- mini executor de testes ---------- */
const testes = [];
const teste = (nome, fn) => testes.push({ nome, fn });
function confere(condicao, mensagem) { if (!condicao) throw new Error(mensagem); }

/* ---------- servidores ---------- */
const site = http.createServer(async (req, res) => {
  const caminho = normalize(decodeURIComponent(new URL(req.url, BASE).pathname)).replace(/^(\.\.[/\\])+/, "");
  try {
    const arquivo = join(RAIZ, caminho.endsWith("/") ? caminho + "index.html" : caminho);
    const corpo = await readFile(arquivo);
    res.writeHead(200, { "Content-Type": TIPOS[extname(arquivo)] || "application/octet-stream" });
    res.end(corpo);
  } catch { res.writeHead(404); res.end(); }
}).listen(PORTA);
const supa = await iniciarSupabaseFalso(PORTA_SUPA);
const navegador = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});

const VIACEP = { "20040020": { uf: "RJ", localidade: "Rio de Janeiro", logradouro: "Avenida Rio Branco", bairro: "Centro" }, "01001000": { uf: "SP", localidade: "São Paulo", logradouro: "Praça da Sé", bairro: "Sé" } };
async function abrir({ largura = 1280, altura = 900, supabase = false, hash = "" } = {}) {
  const ctx = await navegador.newContext({ viewport: { width: largura, height: altura } });
  await ctx.route("https://viacep.com.br/**", (r) => {
    const cep = r.request().url().match(/ws\/(\d+)/)[1];
    r.fulfill({ contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(VIACEP[cep] ? { cep, ...VIACEP[cep] } : { erro: true }) });
  });
  if (supabase) {
    await ctx.route("**/js/produtos.js", async (r) => {
      const res = await r.fetch();
      const t = (await res.text()).replace('supabaseUrl: ""', `supabaseUrl: "http://localhost:${PORTA_SUPA}"`).replace('supabaseChave: ""', 'supabaseChave: "chave-anon"');
      r.fulfill({ response: res, body: t });
    });
  }
  await ctx.addInitScript(() => { sessionStorage.setItem("insta-minimizado", "1"); localStorage.setItem("tmz-aviso-dados", "1"); });
  const p = await ctx.newPage();
  p.erros = [];
  p.on("pageerror", (e) => p.erros.push(e.message));
  await p.goto(BASE + (hash ? "#" + hash : ""));
  await p.waitForTimeout(700);
  return p;
}
const fechar = async (p) => { const erros = p.erros; await p.context().close(); confere(!erros.length, "Erros no navegador: " + erros.join(" | ")); };
const ir = (p, hash) => p.evaluate((h) => { location.hash = h; }, hash).then(() => p.waitForTimeout(350));
const adicionar = (p, id) => p.evaluate((id) => document.querySelector(`#grade [data-add="${id}"]`).click(), String(id));
const texto = async (p, sel) => (await p.textContent(sel)).replace(/\s+/g, " ").trim();
const entrarComoDono = async (p) => {
  await ir(p, "entrar");
  await p.fill("#tela-entrar [name=email]", "admin@tmzstore.com.br");
  await p.fill("#tela-entrar [name=senha]", "1234");
  await p.click("#tela-entrar .login__entrar");
  await p.waitForTimeout(600);
};

/* ---------- loja ---------- */
teste("a página inicial abre com produtos, categorias e sem erros", async () => {
  const p = await abrir();
  confere((await p.locator("#grade .card, #grade article").count()) >= 6, "catálogo vazio");
  confere((await p.locator("#circulos .circulo").count()) >= 4, "categorias não apareceram");
  confere((await p.title()).includes("TMZ"), "título errado");
  await fechar(p);
});

teste("todas as telas abrem direto pelo link, sem erros", async () => {
  for (const h of ["carrinho", "compra", "reservas", "medidas", "entrar", "acompanhar", "privacidade", "trocas", "termos", "painel"]) {
    const p = await abrir({ hash: h });
    const aberta = await p.evaluate(() => [...document.querySelectorAll(".tela")].filter((t) => !t.hidden).map((t) => t.id).join());
    confere(h === "compra" ? aberta === "tela-carrinho" : aberta.length > 0, `#${h} não abriu (${aberta || "nenhuma tela"})`);
    await fechar(p);
  }
  const p = await abrir();
  await p.goto(BASE + "?pedido=TMZ-AAAAA#acompanhar");
  await p.waitForTimeout(500);
  confere((await p.inputValue("#form-acompanhar [name=codigo]")) === "TMZ-AAAAA", "link do pedido não preencheu o código");
  await fechar(p);
});

teste("nenhuma tela tem rolagem para o lado no celular", async () => {
  const p = await abrir({ largura: 360, altura: 780 });
  for (const h of ["", "carrinho", "medidas", "entrar", "trocas", "reservas"]) {
    await ir(p, h);
    const sobra = await p.evaluate(() => {
      const tela = [...document.querySelectorAll(".tela")].find((t) => !t.hidden);
      const alvo = tela || document.documentElement;
      return alvo.scrollWidth - alvo.clientWidth;
    });
    confere(sobra <= 1, `tela "${h || "início"}" passa da largura em ${sobra}px`);
  }
  await fechar(p);
});

teste("carrinho soma, calcula frete pelo CEP e aplica cupom", async () => {
  const p = await abrir();
  await adicionar(p, 7);
  await adicionar(p, 1);
  await ir(p, "carrinho");
  confere((await texto(p, "#subtotal")) === "R$ 189,80", "subtotal errado: " + (await texto(p, "#subtotal")));
  await p.type("#cep-carrinho input", "20040020");
  await p.waitForTimeout(600);
  confere((await texto(p, "#cep-carrinho-info")).includes("Rio de Janeiro/RJ"), "CEP não encontrou a cidade");
  confere((await texto(p, "#frete")) === "R$ 24,90", "frete da região errado: " + (await texto(p, "#frete")));
  await p.click("#ir-compra");
  await p.waitForTimeout(400);
  await p.fill("#cupom-caixa input", "BEMVINDO10");
  await p.click("#cupom-caixa button");
  await p.waitForTimeout(300);
  const totais = await texto(p, "#compra-totais");
  confere(totais.includes("− R$ 18,98") && totais.includes("R$ 195,72"), "cupom não aplicou: " + totais);
  await fechar(p);
});

teste("compra completa registra o pedido com código e endereço do CEP", async () => {
  const p = await abrir();
  await adicionar(p, 4);
  await ir(p, "compra");
  await p.fill("#c-nome", "Teste da Silva");
  await p.fill("#c-telefone", "11988887777");
  await p.type("#c-cep", "01001000");
  await p.waitForTimeout(600);
  confere((await p.inputValue("#c-endereco")).startsWith("Praça da Sé"), "endereço não veio do CEP");
  await p.fill("#c-endereco", "Praça da Sé, 10, Sé, São Paulo - SP");
  await p.click("#confirmar-compra");
  await p.waitForTimeout(600);
  confere(/TMZ-[A-Z0-9]{5}/.test(await texto(p, "#compra-ok")), "pedido sem código");
  const pedido = await p.evaluate(() => Dados.estado.pedidos.at(-1));
  confere(pedido.frete === 12 && pedido.prazoEntrega === 2, "frete da mesma cidade errado");
  await fechar(p);
});

teste("reserva de 30% pede aceite das regras", async () => {
  const p = await abrir();
  await adicionar(p, 3);
  await ir(p, "carrinho");
  await p.click('#resumo [data-modo="reserva30"]');
  await p.waitForTimeout(400);
  await p.fill("#c-nome", "Ana Reserva");
  await p.fill("#c-telefone", "11977776666");
  await p.click("#confirmar-compra");
  confere((await texto(p, "#erro-compra")).includes("aceita as regras"), "deixou reservar sem aceitar");
  await p.check("#c-aceite");
  await p.click("#confirmar-compra");
  await p.waitForTimeout(500);
  confere((await texto(p, "#compra-ok")).includes("R$ 56,97"), "sinal de 30% errado");
  await fechar(p);
});

teste("cadastro, login e sair da conta", async () => {
  const p = await abrir({ hash: "entrar" });
  await p.click('#tela-entrar [data-aba-login="cadastrar"]');
  await p.fill("#tela-entrar [name=nome]", "Bruno Teste");
  await p.fill("#tela-entrar [name=email]", "bruno@teste.com");
  await p.fill("#tela-entrar [name=senha]", "segredo1");
  await p.fill("#tela-entrar [name=senha2]", "segredo1");
  await p.click("#tela-entrar .login__entrar");
  await p.waitForTimeout(500);
  confere((await texto(p, "#tela-entrar h1")).includes("Bruno"), "cadastro não entrou");
  await p.click("#tela-entrar [data-sair-conta]");
  await p.fill("#tela-entrar [name=email]", "bruno@teste.com");
  await p.fill("#tela-entrar [name=senha]", "errada");
  await p.click("#tela-entrar .login__entrar");
  await p.waitForTimeout(300);
  confere((await texto(p, "#tela-entrar .login__erro")).includes("incorretos"), "aceitou senha errada");
  await fechar(p);
});

teste("painel só abre para o dono e todas as abas carregam", async () => {
  const p = await abrir({ hash: "painel" });
  confere(!(await p.isVisible(".painel__lado")), "painel abriu sem login");
  await entrarComoDono(p);
  await ir(p, "painel");
  confere(await p.isVisible(".painel__lado"), "dono não entrou no painel");
  const abas = await p.$$eval("[data-aba]", (els) => els.map((e) => e.dataset.aba));
  for (const aba of abas) {
    await p.click(`[data-aba="${aba}"]`);
    await p.waitForTimeout(150);
    confere((await p.textContent("#painel-aba")).trim().length > 20, `aba ${aba} vazia`);
  }
  await fechar(p);
});

teste("dono edita produtos em massa e a loja mostra na hora", async () => {
  const p = await abrir();
  await entrarComoDono(p);
  await ir(p, "painel");
  await p.click('[data-aba="produtos"]');
  await p.click('[data-prod-modo="tudo"]');
  await p.fill('.edicao-item:nth-child(1) [data-campo="nome"]', "Camiseta Editada");
  await p.fill('.edicao-item:nth-child(1) [data-campo="preco"]', "77.70");
  await p.click("[data-massa-salvar]");
  await p.waitForTimeout(500);
  await ir(p, "");
  const grade = await texto(p, "#grade");
  confere(grade.includes("Camiseta Editada") && grade.includes("77,70"), "mudança não apareceu na loja");
  await fechar(p);
});

teste("várias fotos de uma vez viram rascunhos e entram na loja ao ganhar preço", async () => {
  const p = await abrir();
  await entrarComoDono(p);
  await ir(p, "painel");
  await p.click('[data-aba="produtos"]');
  await p.setInputFiles("[data-fotos-lote]", [join(RAIZ, "img/camiseta-lacoste.jpg"), join(RAIZ, "img/oculos-juliet.jpg")]);
  await p.waitForTimeout(1500);
  const rascunhos = await p.evaluate(() => Dados.estado.produtos.filter((x) => x.rascunho).map((x) => x.nome));
  confere(rascunhos.length === 2, "não criou os 2 rascunhos: " + rascunhos.join());
  await ir(p, "");
  confere(!(await texto(p, "#grade")).includes("Camiseta lacoste"), "rascunho apareceu na loja");
  await ir(p, "painel");
  await p.click('[data-aba="produtos"]');
  await p.fill('.edicao-item--rascunho:nth-child(1) [data-campo="nome"]', "Camiseta Nova do Insta");
  await p.fill('.edicao-item--rascunho:nth-child(1) [data-campo="preco"]', "129.90");
  await p.click("[data-massa-salvar]");
  await p.waitForTimeout(500);
  await ir(p, "");
  const grade = await texto(p, "#grade");
  confere(grade.includes("Camiseta Nova do Insta") && grade.includes("129,90"), "produto com preço não entrou na loja");
  confere(await p.evaluate(() => Dados.estado.produtos.filter((x) => x.rascunho).length === 1), "o outro deveria seguir em rascunho");
  await fechar(p);
});

teste("avise-me quando chegar: cliente entra na lista e o dono avisa", async () => {
  const p = await abrir();
  await p.evaluate(() => Dados.ajustarEstoque("10", -Dados.estado.produtos.find((x) => x.id === "10").estoque));
  await p.evaluate(() => document.querySelector('#grade [data-ver="10"]').click());
  await p.waitForTimeout(300);
  await p.fill("[data-aviso] [name=contato]", "11966665555");
  await p.click("[data-aviso] button");
  await p.waitForTimeout(400);
  confere(await p.isVisible(".aviso-chegar--ok"), "não confirmou a lista de espera");
  await p.keyboard.press("Escape");
  await entrarComoDono(p);
  await p.evaluate(() => Dados.ajustarEstoque("10", 5));
  await ir(p, "painel");
  await p.click('[data-aba="espera"]');
  await p.click("[data-abrir-espera]");
  const link = await p.getAttribute(".espera-contatos a", "href");
  confere(link.startsWith("https://wa.me/5511966665555"), "link do WhatsApp errado: " + link);
  await p.click("[data-avisados]");
  await p.waitForTimeout(300);
  confere((await texto(p, "#painel-aba")).includes("Ninguém na lista de espera"), "lista não limpou");
  await fechar(p);
});

teste("acompanhar pedido: dono avança as etapas e o cliente vê pelo código", async () => {
  const p = await abrir();
  await adicionar(p, 1);
  await ir(p, "compra");
  await p.fill("#c-nome", "Rita Rastreio");
  await p.fill("#c-telefone", "11955554321");
  await p.type("#c-cep", "20040020");
  await p.waitForTimeout(500);
  await p.fill("#c-endereco", "Avenida Rio Branco, 1, Centro, Rio de Janeiro - RJ");
  await p.click("#confirmar-compra");
  await p.waitForTimeout(500);
  const codigo = (await texto(p, ".concluido__codigo")).match(/TMZ-[A-Z0-9]{5}/)[0];
  await entrarComoDono(p);
  await ir(p, "painel");
  await p.click('[data-aba="pedidos"]');
  const coluna = async (id) => texto(p, `.quadro__coluna--${id}`);
  confere((await coluna("pagar")).includes(codigo), "pedido não está em A pagar");
  await p.click(`.quadro__coluna--pagar [data-acao="confirmar"]`);
  await p.waitForTimeout(300);
  await p.click(`.quadro__coluna--separar [data-acao="separar"]`);
  await p.waitForTimeout(300);
  confere((await coluna("separando")).includes(codigo), "pedido não foi para Em separação");
  await p.click(".quadro__coluna--separando [data-enviar-chave]");
  await p.waitForTimeout(300);
  await p.selectOption("#envio-transportadora", "correios");
  await p.fill("#envio-codigo", "aa123456789br");
  await p.click('[data-acao="enviar-ok"]');
  await p.waitForTimeout(300);
  const aviso = await p.getAttribute(".pedido--destaque .avisar-cliente, .avisar-cliente", "href");
  confere(decodeURIComponent(aviso).includes("AA123456789BR") && decodeURIComponent(aviso).includes("#acompanhar"), "mensagem do WhatsApp sem rastreio ou link");
  // cliente acompanha em outro aparelho (busca pelo código e telefone)
  await p.evaluate(() => sessionStorage.removeItem("tmz-sessao"));
  await ir(p, "acompanhar");
  await p.fill("#form-acompanhar [name=codigo]", codigo.toLowerCase());
  await p.fill("#form-acompanhar [name=final]", "0000");
  await p.click("#form-acompanhar button");
  await p.waitForTimeout(300);
  confere(!(await p.isHidden("#erro-acompanhar")) || (await texto(p, "#acompanhar-resultado")).includes(codigo), "busca não respondeu");
  await p.fill("#form-acompanhar [name=final]", "4321");
  await p.click("#form-acompanhar button");
  await p.waitForTimeout(300);
  const resultado = await texto(p, "#acompanhar-resultado");
  confere(resultado.includes("Enviado") && resultado.includes("AA123456789BR") && resultado.includes("Previsão de entrega"), "linha do tempo sem envio: " + resultado.slice(0, 200));
  await fechar(p);
});

teste("painel altera a loja inteira: textos, produtos, categorias, contato, frete, reserva, medidas e cupons", async () => {
  const p = await abrir();
  await entrarComoDono(p);
  await ir(p, "painel");
  const aba = async (id) => { await p.click(`[data-aba="${id}"]`); await p.waitForTimeout(200); };
  const salvar = async (form) => { await p.click(`#${form} button.btn:not([type=button])`); await p.waitForTimeout(350); };
  const preencher = (form, campo, valor) => p.fill(`#${form} [name="${campo}"]`, valor);
  const loja = async () => { await ir(p, ""); await p.waitForTimeout(250); };
  const voltar = async () => { await ir(p, "painel"); };
  const erros = [];
  const checa = (ok, nome) => { if (!ok) erros.push(nome); };

  // Destaque e textos
  await aba("destaque");
  await preencher("form-destaque", "linha1", "Novo título");
  await preencher("form-destaque", "sub", "Coleção de verão");
  await preencher("form-destaque", "bannerTitulo", "Queima total");
  await p.fill('#form-destaque [name="avisos"]', "Aviso de teste do painel");
  await p.selectOption('#form-destaque [name="produtoDestaque"]', "6");
  await salvar("form-destaque");
  await loja();
  checa((await texto(p, "#hero-titulo")).includes("Novo título"), "título do topo");
  checa((await texto(p, "#hero-sub")) === "Coleção de verão", "subtítulo");
  checa((await texto(p, "#banner-titulo")) === "Queima total", "banner");
  checa((await texto(p, "#faixa")).includes("Aviso de teste do painel"), "faixa de avisos");
  checa((await texto(p, "#produto-destaque")).includes("Polo Piquet Grafite"), "produto em destaque");

  // Produto: nome, preço, preço antigo, estoque, oferta, descrição
  await voltar(); await aba("produtos");
  await p.click('[data-editar="9"]');
  await p.fill('#form-produto [name="nome"]', "Chinelo Editado");
  await p.fill('#form-produto [name="preco"]', "44.40");
  await p.fill('#form-produto [name="precoAntigo"]', "60");
  await p.fill('#form-produto [name="estoque"]', "3");
  await p.fill('#form-produto [name="descricao"]', "Descrição nova do chinelo");
  await p.click('#form-produto [type="submit"]');
  await p.waitForTimeout(400);
  await loja();
  const grade = await texto(p, "#grade");
  checa(grade.includes("Chinelo Editado") && grade.includes("44,40"), "nome e preço do produto");
  checa(grade.includes("-26%"), "desconto pelo preço antigo");
  await p.evaluate(() => document.querySelector('#grade [data-ver="9"]').click());
  await p.waitForTimeout(300);
  const modal = await texto(p, "#detalhe");
  checa(modal.includes("Descrição nova do chinelo") && modal.includes("Últimas 3"), "descrição e estoque");
  await p.keyboard.press("Escape");

  // Categoria: renomear
  await voltar(); await aba("categorias");
  await p.fill('#lista-categorias li[data-cat-id="bones"] [data-nome-cat]', "Bonés e Toucas");
  await salvar("form-categorias");
  await loja();
  checa((await texto(p, "#circulos")).includes("Bonés e Toucas"), "nome da categoria");

  // Contato e links
  await voltar(); await aba("contato");
  await preencher("form-contato", "whatsapp", "5521988887777");
  await preencher("form-contato", "endereco", "Rua Nova, 50, Centro");
  await preencher("form-contato", "tiktok", "https://www.tiktok.com/@tmz");
  await preencher("form-contato", "cnpj", "12.345.678/0001-90");
  await preencher("form-contato", "razaoSocial", "TMZ Comércio LTDA");
  await salvar("form-contato");
  await loja();
  checa((await p.getAttribute("#link-whats", "href")).includes("5521988887777"), "WhatsApp");
  checa((await texto(p, "#rodape-endereco")) === "Rua Nova, 50, Centro", "endereço");
  checa((await texto(p, "#rodape-redes")).includes("TikTok"), "rede social");
  checa((await texto(p, "#rodape-cnpj")).includes("12.345.678/0001-90"), "CNPJ no rodapé");

  // Configurações: Pix, frete, reserva
  await voltar(); await aba("config");
  await preencher("form-config", "pixChave", "pix@teste.com");
  await preencher("form-config", "reservaPercentual", "40");
  await p.selectOption('#form-config [name="freteModo"]', "fixo");
  await preencher("form-config", "frete", "15");
  await preencher("form-config", "freteGratisAcima", "500");
  await salvar("form-config");
  await adicionar(p, 7);
  await ir(p, "carrinho");
  checa((await texto(p, "#frete")) === "R$ 15,00", "frete fixo");
  checa((await texto(p, "#frete-msg")).includes("410,10"), "frete grátis acima de");
  await p.click('#resumo [data-modo="reserva30"]');
  await p.waitForTimeout(300);
  checa((await texto(p, "#modos")).includes("Reserva 40%"), "porcentagem da reserva");

  // Medidas
  await voltar(); await aba("medidas");
  await p.fill('#form-medidas input[data-cat="camisetas"][data-tam="M"][data-campo="largura"]', "60");
  await salvar("form-medidas");
  await ir(p, "medidas");
  checa((await texto(p, "#medidas-conteudo")).includes("60"), "medidas em cm");

  // Cupom novo
  await voltar(); await aba("cupons");
  await p.fill('#form-cupom-painel [name="codigo"]', "TESTE20");
  await p.selectOption('#form-cupom-painel [name="tipo"]', "valor");
  await p.fill('#form-cupom-painel [name="valor"]', "20");
  await p.click("#form-cupom-painel button:not([type=button])");
  await p.waitForTimeout(300);
  await ir(p, "compra");
  await p.fill("#cupom-caixa input", "teste20");
  await p.click("#cupom-caixa button");
  await p.waitForTimeout(300);
  checa((await texto(p, "#compra-totais")).includes("− R$ 20,00"), "cupom criado no painel");

  confere(!erros.length, "não refletiu na loja: " + erros.join(", "));
  await fechar(p);
});

teste("páginas de privacidade, trocas e termos", async () => {
  const p = await abrir({ hash: "trocas" });
  confere((await texto(p, "#doc-conteudo")).includes("7 dias"), "trocas sem o prazo de arrependimento");
  await ir(p, "privacidade");
  confere((await texto(p, "#doc-conteudo")).includes("LGPD"), "privacidade sem LGPD");
  await ir(p, "termos");
  confere((await texto(p, "#doc-titulo")) === "Termos de Uso", "termos não abriu");
  await fechar(p);
});

/* ---------- com o servidor (Supabase falso) ---------- */
teste("servidor: Pix online, aprovação automática e baixa no estoque", async () => {
  await fetch(`http://localhost:${PORTA_SUPA}/auth/v1/signup`, { method: "POST", body: JSON.stringify({ email: "admin@tmzstore.com.br", password: "SenhaForte9" }) });
  const dono = await abrir({ supabase: true });
  await ir(dono, "entrar");
  await dono.fill("#tela-entrar [name=email]", "admin@tmzstore.com.br");
  await dono.fill("#tela-entrar [name=senha]", "SenhaForte9");
  await dono.click("#tela-entrar .login__entrar");
  await dono.waitForTimeout(1500);
  confere(await dono.evaluate(() => Dados.estado.admin), "dono não virou admin no servidor");
  await dono.click('[data-aba="config"]');
  await dono.check('[name="pagamentoOnline"]');
  await dono.click("#form-config .barra-salvar .btn");
  await dono.waitForTimeout(700);

  const cli = await abrir({ supabase: true });
  await cli.waitForTimeout(800);
  confere(await cli.evaluate(() => Dados.estado.modo === "nuvem" && !Dados.estado.admin), "cliente em modo errado");
  const proibido = await cli.evaluate(async () => { try { await Supa.banco.doc("produtos/7").set({ preco: 1 }); return false; } catch (e) { return e.status === 403; } });
  confere(proibido, "cliente conseguiu alterar um produto");
  await adicionar(cli, 7);
  await ir(cli, "compra");
  await cli.fill("#c-nome", "Paula Souza");
  await cli.fill("#c-telefone", "21988887777");
  await cli.type("#c-cep", "20040020");
  await cli.waitForTimeout(600);
  await cli.fill("#c-endereco", "Avenida Rio Branco, 100, Centro, Rio de Janeiro - RJ");
  await cli.click("#confirmar-compra");
  await cli.waitForTimeout(1500);
  confere(await cli.isVisible(".pix-qr"), "QR Code do Pix não apareceu");
  const codigo = (await texto(cli, ".concluido__codigo")).match(/TMZ-[A-Z0-9]{5}/)[0];
  await fetch(`http://localhost:${PORTA_SUPA}/teste/aprovar?codigo=${codigo}`);
  await cli.waitForTimeout(5800);
  confere((await texto(cli, "#compra-ok h1")) === "Pagamento aprovado!", "cliente não viu a aprovação");
  const docs = await (await fetch(`http://localhost:${PORTA_SUPA}/teste/docs`)).json();
  confere(docs["produtos/7"].estoque === 19, "estoque não baixou");
  const outro = await abrir({ supabase: true, hash: "acompanhar" });
  await outro.fill("#form-acompanhar [name=codigo]", codigo);
  await outro.fill("#form-acompanhar [name=final]", "1234");
  await outro.click("#form-acompanhar button");
  await outro.waitForTimeout(500);
  confere((await texto(outro, "#erro-acompanhar")).includes("Não achamos"), "achou o pedido com o telefone errado");
  await outro.fill("#form-acompanhar [name=final]", "7777");
  await outro.click("#form-acompanhar button");
  await outro.waitForTimeout(500);
  const visto = await texto(outro, "#acompanhar-resultado");
  confere(visto.includes("Pagamento confirmado") && visto.includes("Paula") && !visto.includes("Rio Branco"), "rastreio de outro aparelho errado: " + visto.slice(0, 160));
  await fechar(outro);
  await dono.waitForTimeout(16000); // o painel atualiza os pagamentos a cada 15 s
  await dono.click('[data-aba="pedidos"]');
  await dono.click('[data-ped-vista="lista"]');
  await dono.click('[data-filtro-pedido="todos"]').catch(() => {});
  confere((await texto(dono, ".pedidos--painel")).includes("Pix verificado"), "painel não mostrou o Pix verificado");
  await fechar(cli);
  await fechar(dono);
});

teste("servidor: o que o dono muda aparece no aparelho do cliente sem recarregar", async () => {
  await fetch(`http://localhost:${PORTA_SUPA}/auth/v1/signup`, { method: "POST", body: JSON.stringify({ email: "admin@tmzstore.com.br", password: "SenhaForte9" }) });
  const cli = await abrir({ supabase: true });
  await cli.waitForTimeout(1000);
  const dono = await abrir({ supabase: true });
  await ir(dono, "entrar");
  await dono.fill("#tela-entrar [name=email]", "admin@tmzstore.com.br");
  await dono.fill("#tela-entrar [name=senha]", "SenhaForte9");
  await dono.click("#tela-entrar .login__entrar");
  await dono.waitForTimeout(1500);
  await dono.click('[data-aba="destaque"]');
  await dono.fill('#form-destaque [name="linha1"]', "Mudou no outro celular");
  await dono.click("#form-destaque button.btn:not([type=button])");
  await dono.waitForTimeout(400);
  await dono.click('[data-aba="produtos"]');
  await dono.click('[data-prod-modo="tudo"]');
  await dono.fill('.edicao-item:nth-child(2) [data-campo="nome"]', "Camiseta Remota");
  await dono.fill('.edicao-item:nth-child(2) [data-campo="preco"]', "88.80");
  await dono.click("[data-massa-salvar]");
  await dono.waitForTimeout(600);
  // o cliente não recarrega: a loja atualiza sozinha em até 20 segundos
  let ok = false;
  for (let i = 0; i < 25 && !ok; i++) {
    await cli.waitForTimeout(1000);
    ok = (await texto(cli, "#hero-titulo")).includes("Mudou no outro celular") && (await texto(cli, "#grade")).includes("Camiseta Remota") && (await texto(cli, "#grade")).includes("88,80");
  }
  confere(ok, "a mudança do dono não chegou ao cliente");
  await fechar(dono);
  await fechar(cli);
});

/* ---------- roda ---------- */
let falhas = 0;
const so = process.env.SO; // rodar só os testes com esse trecho no nome: SO=cupom npm test
for (const t of testes.filter((x) => !so || x.nome.includes(so))) {
  const inicio = Date.now();
  try {
    await t.fn();
    console.log(`  ✓ ${t.nome} (${((Date.now() - inicio) / 1000).toFixed(1)}s)`);
  } catch (e) {
    falhas += 1;
    console.log(`  ✗ ${t.nome}\n      ${e.message.split("\n").slice(0, 3).join("\n      ")}`);
  }
}
const rodados = testes.filter((x) => !so || x.nome.includes(so)).length;
console.log(`\n${rodados - falhas} de ${rodados} testes passaram`);
await navegador.close();
site.close();
supa.close();
process.exit(falhas ? 1 : 0);
