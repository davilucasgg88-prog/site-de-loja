// Supabase de mentira para os testes. Segue as mesmas regras do supabase/schema.sql e das funções:
// - auth: sessão anônima, cadastro e login
// - tabela docs com as regras de acesso (cliente lê os próprios pedidos e não grava pedidos)
// - funções pedido (recalcula preço, frete e cupom), pagamento, migrar
// - rpc status_pagamento, rastrear_pedido, cancelar_pedido
// - /teste/aprovar faz o que o webhook + confirmar_pagamento fazem quando o Pix cai
import http from "node:http";
import crypto from "node:crypto";

export function iniciarSupabaseFalso(porta = 8124) { return new Promise((pronto) => {
const ADMIN = "admin@tmzstore.com.br";
const usuarios = new Map(); // email -> {id, senha}
const tokens = new Map();   // token -> {id, email, anonimo}
const docs = new Map();     // "colecao/id" -> {dados, atualizado}
let ultimoNumero = 0;       // sequência pedido_numero
const agoraIso = () => new Date().toISOString() + Math.random();
const sessao = (u) => { const t = crypto.randomUUID(); tokens.set(t, u); return { access_token: t, refresh_token: "r" + t, expires_in: 3600, user: { id: u.id, email: u.email || "", is_anonymous: !!u.anonimo } }; };
const PROPRIAS = ["carrinhos", "visitas", "contas", "avisos"];
const ehAdmin = (u) => u?.email === ADMIN;
const podeLer = (u, col, id, dados) => ["loja", "produtos"].includes(col) || ehAdmin(u)
  || (u && PROPRIAS.includes(col) && id === u.id) || (u && col === "pedidos" && dados?.dono === u.id);
const podeGravar = (u, col, id) => col !== "pagamentos" && (ehAdmin(u) || (u && PROPRIAS.includes(col) && id === u.id));
const ler = (req) => new Promise((ok) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => { try { ok(b ? JSON.parse(b) : {}); } catch { ok({}); } }); });
const gravar = (k, dados) => docs.set(k, { dados, atualizado: agoraIso() });
const doc = (k) => docs.get(k)?.dados;
const digitos = (v) => String(v ?? "").replace(/\D/g, "");
const centavos = (n) => Math.round(n * 100) / 100;

// mesmo cálculo de supabase/functions/_compartilhado/loja.ts (frete pela faixa do CEP)
const FAIXAS = [[1000, 19999, "SP"], [20000, 28999, "RJ"], [29000, 29999, "ES"], [30000, 39999, "MG"], [69000, 69299, "AM"], [80000, 87999, "PR"], [90000, 99999, "RS"]];
const REG = { SP: "Sudeste", RJ: "Sudeste", ES: "Sudeste", MG: "Sudeste", AM: "Norte", PR: "Sul", RS: "Sul" };
const CIDADES = { "20040020": "Rio de Janeiro", "01001000": "São Paulo" };
function recalcular(e, cfg) {
  let subtotal = 0;
  const itens = [];
  for (const i of e.itens) {
    const p = doc("produtos/" + i.id);
    if (!p) throw new Error(`Produto ${i.id} não existe mais`);
    if ((Number(p.estoque) || 0) < i.qtd) throw new Error(`${p.nome}: estoque insuficiente`);
    subtotal += p.preco * i.qtd;
    itens.push({ id: String(i.id), nome: p.nome, preco: p.preco, qtd: i.qtd, categoria: p.categoria });
  }
  subtotal = centavos(subtotal);
  let frete = 0, prazo = null;
  if (e.receber === "entrega" && !(cfg.freteGratisAcima > 0 && subtotal >= cfg.freteGratisAcima)) {
    const cep = digitos(e.cliente.cep), n = Number(cep.slice(0, 5));
    const uf = FAIXAS.find(([a, b]) => n >= a && n <= b)?.[2];
    const tab = cfg.freteTabela || {};
    let f = "brasil";
    if (uf === cfg.lojaUF) f = CIDADES[cep] === cfg.lojaCidade ? "cidade" : "estado";
    else if (REG[uf] && REG[uf] === REG[cfg.lojaUF]) f = "regiao";
    frete = cfg.freteModo === "regiao" ? tab[f].valor : cfg.frete;
    prazo = cfg.freteModo === "regiao" ? tab[f].prazo : null;
  }
  const freteSemCupom = frete;
  let desconto = 0, cupom = null;
  const c = (cfg.cupons || []).find((x) => x.codigo === e.cupom && x.ativo && subtotal >= (x.minimo || 0));
  if (c) {
    if (c.tipo === "percentual") desconto = centavos(subtotal * c.valor / 100);
    if (c.tipo === "valor") desconto = Math.min(subtotal, c.valor);
    if (c.tipo === "frete") frete = 0;
    cupom = c;
  }
  const total = centavos(subtotal - desconto + frete);
  let cobrar = total;
  if (e.tipo === "reserva30") cobrar = centavos(total * cfg.reservaPercentual / 100);
  if (e.tipo === "reserva50") cobrar = Math.min(cfg.reservaFixa, total);
  return { itens, subtotal, frete, freteSemCupom, prazo, desconto, cupom, total, cobrar };
}

const servidor = http.createServer(async (req, res) => {
  const cab = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "*", "Content-Type": "application/json" };
  const enviar = (st, corpo) => { res.writeHead(st, cab); res.end(corpo === undefined ? "" : JSON.stringify(corpo)); };
  if (req.method === "OPTIONS") return enviar(200);
  const u = new URL(req.url, "http://x");
  const tk = (req.headers.authorization || "").replace("Bearer ", "");
  const quem = tokens.get(tk) || null;
  const corpo = await ler(req);

  /* auth */
  if (u.pathname === "/auth/v1/signup") {
    if (!corpo.email) return enviar(200, sessao({ id: crypto.randomUUID(), email: "", anonimo: true }));
    if (usuarios.has(corpo.email)) return enviar(422, { msg: "User already registered" });
    const novo = { id: crypto.randomUUID(), senha: corpo.password };
    usuarios.set(corpo.email, novo);
    return enviar(200, sessao({ id: novo.id, email: corpo.email }));
  }
  if (u.pathname === "/auth/v1/token") {
    if (u.searchParams.get("grant_type") === "password") {
      const c = usuarios.get(corpo.email);
      if (!c || c.senha !== corpo.password) return enviar(400, { error_description: "Invalid login credentials" });
      return enviar(200, sessao({ id: c.id, email: corpo.email }));
    }
    const ant = tokens.get(String(corpo.refresh_token).slice(1));
    return ant ? enviar(200, sessao(ant)) : enviar(400, {});
  }
  if (u.pathname.startsWith("/auth/v1/")) return enviar(200, {});

  /* tabela docs */
  if (u.pathname === "/rest/v1/docs") {
    if (!quem && tk !== "chave-anon") return enviar(401, { message: "JWT" });
    const col = (u.searchParams.get("colecao") || "").replace("eq.", "");
    const id = u.searchParams.get("id")?.replace("eq.", "");
    if (req.method === "GET") {
      const linhas = [...docs.entries()].filter(([k]) => k.startsWith(col + "/") && (id === undefined || k === col + "/" + id))
        .map(([k, v]) => ({ id: k.slice(col.length + 1), dados: v.dados, atualizado: v.atualizado }))
        .filter((l) => podeLer(quem, col, l.id, l.dados));
      return enviar(200, linhas);
    }
    if (req.method === "POST") {
      if (!podeGravar(quem, corpo.colecao, corpo.id)) return enviar(403, { message: "new row violates row-level security policy" });
      gravar(corpo.colecao + "/" + corpo.id, corpo.dados);
      return enviar(201);
    }
    if (req.method === "DELETE") { if (!podeGravar(quem, col, id)) return enviar(403, {}); docs.delete(col + "/" + id); return enviar(204); }
  }

  /* rpc */
  if (u.pathname === "/rest/v1/rpc/status_pagamento") {
    const pg = doc("pagamentos/" + corpo.codigo), pe = doc("pedidos/" + corpo.codigo);
    return enviar(200, pg && pe?.dono === quem?.id ? { status: pg.status, valorPago: pg.valorPago } : null);
  }
  if (u.pathname === "/rest/v1/rpc/rastrear_pedido") {
    const p = doc("pedidos/" + String(corpo.codigo).toUpperCase());
    if (!p || !digitos(p.cliente?.telefone).endsWith(digitos(corpo.final_telefone)) || digitos(corpo.final_telefone).length !== 4) return enviar(200, null);
    const { cliente, dono, ...resto } = p;
    return enviar(200, { ...resto, cliente: { nome: cliente.nome.split(" ")[0] } });
  }
  if (u.pathname === "/rest/v1/rpc/cancelar_pedido") {
    const p = doc("pedidos/" + corpo.p_codigo);
    if (!p || p.dono !== quem?.id) return enviar(400, { message: "Pedido não encontrado" });
    if (p.tipo === "compra" || !["aguardando", "confirmado"].includes(p.status)) return enviar(400, { message: "Este pedido não pode mais ser cancelado por aqui. Fale com a loja." });
    const pago = p.pago ? p.sinal : 0;
    const valor = Date.now() <= p.criadoEm + p.regra.janelaMin * 60000 ? pago : Math.round(pago * p.regra.percDepois) / 100;
    gravar("pedidos/" + p.codigo, { ...p, status: "cancelado", canceladoEm: Date.now(), canceladoPor: "cliente", reembolso: valor });
    return enviar(200, { reembolso: valor });
  }

  /* funções */
  if (u.pathname === "/functions/v1/pedido") {
    if (!quem) return enviar(401, { erro: "Sessão inválida" });
    try {
      const cfg = doc("loja/config");
      const c = recalcular({ ...corpo, itens: corpo.itens.map((i) => ({ id: String(i.id), qtd: Math.floor(i.qtd) })) }, cfg);
      if (c.cupom?.umPorCliente) {
        const usado = [...docs].some(([k, v]) => k.startsWith("pedidos/") && v.dados.cupom?.codigo === c.cupom.codigo && (v.dados.dono === quem.id || digitos(v.dados.cliente.telefone).slice(-9) === digitos(corpo.cliente.telefone).slice(-9)));
        if (usado) return enviar(409, { erro: "Você já usou este cupom." });
      }
      const agora = Date.now();
      const codigo = "TMZ-" + crypto.randomBytes(8).toString("hex").toUpperCase().replace(/[^A-Z2-9]/g, "X").slice(0, 8);
      const tipo = corpo.tipo, receber = tipo === "reserva30" ? "retirada" : corpo.receber;
      const pedido = {
        numero: ++ultimoNumero, codigo, dono: quem.id, tipo, receber, pagamento: corpo.pagamento || "Pix", cliente: corpo.cliente,
        itens: c.itens.map(({ categoria, ...i }) => i), subtotal: c.subtotal, frete: c.frete, total: c.total, sinal: c.cobrar, cobrar: c.cobrar,
        restante: centavos(c.total - c.cobrar), prazoEntrega: receber === "entrega" ? c.prazo : null,
        cupom: c.cupom ? { codigo: c.cupom.codigo, desconto: c.desconto, freteGratis: c.cupom.tipo === "frete", freteEconomizado: centavos(c.freteSemCupom - c.frete) } : null,
        regra: { janelaMin: cfg.estornoJanelaMin, percDepois: cfg.estornoDepoisPerc },
        criadoEm: agora, status: "aguardando", pago: false, historico: [{ em: agora, status: "aguardando" }],
      };
      gravar("pedidos/" + codigo, pedido);
      return enviar(200, { pedido });
    } catch (e) { return enviar(400, { erro: e.message }); }
  }
  if (u.pathname === "/functions/v1/migrar") {
    const anon = tokens.get(corpo.tokenAnonimo);
    if (!quem || quem.anonimo || !anon?.anonimo) return enviar(200, { movidos: 0 });
    let n = 0;
    for (const [k, v] of docs) if (k.startsWith("pedidos/") && v.dados.dono === anon.id) { gravar(k, { ...v.dados, dono: quem.id }); n++; }
    return enviar(200, { movidos: n });
  }
  if (u.pathname === "/functions/v1/pagamento") {
    const p = doc("pedidos/" + corpo.codigo);
    if (!p || p.dono !== quem?.id) return enviar(404, { erro: "Pedido não encontrado" });
    const dados = { codigo: corpo.codigo, dono: p.dono, status: "pending", valor: p.cobrar, qrCopiaECola: "00020126580014br.gov.bcb.pix0136TESTE-" + corpo.codigo, qrImagem: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==" };
    gravar("pagamentos/" + corpo.codigo, dados);
    return enviar(200, dados);
  }

  /* o que o webhook + confirmar_pagamento fazem quando o Pix é aprovado (idempotente) */
  if (u.pathname === "/teste/aprovar") {
    const codigo = u.searchParams.get("codigo");
    const pg = doc("pagamentos/" + codigo);
    gravar("pagamentos/" + codigo, { ...pg, status: "approved", valorPago: pg.valor, verificado: true });
    const p = doc("pedidos/" + codigo);
    if (!p || p.pago || p.status !== "aguardando") return enviar(200, { resultado: "ja-pago" });
    const baixas = {};
    for (const it of p.itens) {
      const pr = doc("produtos/" + it.id);
      if (!pr) continue;
      const novo = Math.max(0, pr.estoque - it.qtd);
      baixas[it.id] = (baixas[it.id] || 0) + (pr.estoque - novo);
      gravar("produtos/" + it.id, { ...pr, estoque: novo });
    }
    gravar("pedidos/" + codigo, { ...p, status: "confirmado", pago: true, confirmadoEm: Date.now(), estoqueBaixado: true, pagamentoVerificado: true, baixas });
    return enviar(200, { resultado: "confirmado" });
  }
  if (u.pathname === "/teste/docs") return enviar(200, Object.fromEntries([...docs].map(([k, v]) => [k, v.dados])));
  enviar(404, {});
}).listen(porta, () => pronto(servidor));
}); }
