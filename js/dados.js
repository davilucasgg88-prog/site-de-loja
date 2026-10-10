// Camada de dados da loja: produtos, categorias, textos, configurações e pedidos.
//
// Dois modos:
//  - "nuvem": quando o site roda como artifact do Claude, usa o banco compartilhado.
//    O que o dono muda no painel aparece para todo mundo.
//  - "local": em qualquer outra hospedagem (GitHub Pages, etc.) guarda no navegador.
//    Serve para testar; numa loja de verdade cada cliente veria só o próprio
//    navegador. Para produção, troque este arquivo por um backend (veja o README).
const Dados = (() => {
  const CHAVE_LOCAL = "tmz-dados-v1";
  const ouvintes = new Set();

  const padrao = () => ({
    config: { ...LOJA, ...DESTAQUE, avisos: [...DESTAQUE.avisos] },
    categorias: CATEGORIAS.map((c) => ({ ...c })),
    produtos: PRODUTOS.map((p) => ({ ...p, id: String(p.id) })),
    pedidos: [],
  });

  const estado = {
    modo: "local",
    admin: false,
    uid: "local",
    ...padrao(),
    meusPedidos: [],
  };

  let db = null;
  let produtosNaNuvem = false;
  let categoriasNaNuvem = false;

  function avisar() {
    estado.meusPedidos = estado.modo === "local"
      ? estado.pedidos.filter((p) => p.dono === "local")
      : estado.meusPedidos;
    ouvintes.forEach((fn) => fn(estado));
  }

  /* ---------- modo local ---------- */
  function lerLocal() {
    try {
      const salvo = JSON.parse(localStorage.getItem(CHAVE_LOCAL));
      if (!salvo) return;
      const base = padrao();
      estado.config = { ...base.config, ...(salvo.config || {}) };
      if (Array.isArray(salvo.categorias)) estado.categorias = salvo.categorias;
      if (Array.isArray(salvo.produtos)) estado.produtos = salvo.produtos;
      if (Array.isArray(salvo.pedidos)) estado.pedidos = salvo.pedidos;
    } catch {}
  }
  function gravarLocal() {
    try {
      localStorage.setItem(CHAVE_LOCAL, JSON.stringify({
        config: estado.config, categorias: estado.categorias, produtos: estado.produtos, pedidos: estado.pedidos,
      }));
    } catch {}
  }
  try { estado.admin = sessionStorage.getItem("tmz-painel") === "1"; } catch {}
  lerLocal();

  /* ---------- modo nuvem (artifact) ---------- */
  async function conectar() {
    if (!window.claude?.use) return;
    const [banco, user] = await Promise.all([window.claude.use("db"), window.claude.use("user")]);
    if (!banco) return;
    db = banco;
    estado.modo = "nuvem";
    estado.admin = user ? await user.canEdit() : false;
    estado.uid = user ? await user.id() : null;
    estado.pedidos = [];
    estado.meusPedidos = [];
    estado.config = padrao().config;
    avisar();

    db.doc("loja/config").onSnapshot((s) => {
      estado.config = { ...padrao().config, ...(s.exists ? s.data() : {}) };
      avisar();
    }, () => {});
    db.doc("loja/categorias").onSnapshot((s) => {
      categoriasNaNuvem = s.exists && Array.isArray(s.data().lista);
      estado.categorias = categoriasNaNuvem ? s.data().lista.map((c) => ({ ...c })) : padrao().categorias;
      avisar();
    }, () => {});
    db.collection("produtos").onSnapshot((s) => {
      produtosNaNuvem = !s.empty;
      estado.produtos = produtosNaNuvem
        ? s.docs.map((d) => ({ ...d.data(), id: d.id })).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
        : padrao().produtos;
      avisar();
    }, () => {});
    if (estado.admin) {
      db.collection("reservas").onSnapshot((s) => {
        estado.pedidos = s.docs.flatMap((d) => (d.data().lista || []).map((p) => ({ ...p, dono: d.id })));
        avisar();
      }, () => {});
    }
    if (estado.uid) {
      db.doc("reservas/" + estado.uid).onSnapshot((s) => {
        estado.meusPedidos = s.exists ? (s.data().lista || []).map((p) => ({ ...p, dono: estado.uid })) : [];
        avisar();
      }, () => {});
    }
  }

  // Na primeira edição do dono, grava o catálogo inicial inteiro na nuvem
  async function garantirCatalogo() {
    if (!produtosNaNuvem) {
      for (const [i, p] of estado.produtos.entries()) await db.doc("produtos/" + p.id).set({ ...p, ordem: p.ordem ?? i });
      produtosNaNuvem = true;
    }
  }

  /* ---------- utilidades ---------- */
  const novoId = (prefixo) => prefixo + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  function codigoPedido() {
    const letras = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let c = "";
    for (let i = 0; i < 5; i++) c += letras[Math.floor(Math.random() * letras.length)];
    return "TMZ-" + c;
  }

  // Regra de cancelamento das reservas
  function reembolso(pedido, agora = Date.now()) {
    const cfg = estado.config;
    const pago = pedido.pago ? pedido.sinal : 0;
    const limite = pedido.criadoEm + cfg.estornoJanelaMin * 60000;
    const dentro = agora <= limite;
    const valor = dentro ? pago : Math.round(pago * cfg.estornoDepoisPerc) / 100;
    return { pago, dentro, limite, valor };
  }

  /* ---------- escrita ---------- */
  async function salvarProduto(p) {
    const produto = { ...p, id: p.id || novoId("p") };
    if (estado.modo === "nuvem") {
      await garantirCatalogo();
      if (produto.ordem == null) produto.ordem = Date.now();
      await db.doc("produtos/" + produto.id).set(produto);
    } else {
      const i = estado.produtos.findIndex((x) => x.id === produto.id);
      if (i >= 0) estado.produtos[i] = produto; else estado.produtos.push(produto);
      gravarLocal(); avisar();
    }
    return produto;
  }

  async function apagarProduto(id) {
    if (estado.modo === "nuvem") {
      await garantirCatalogo();
      await db.doc("produtos/" + id).delete();
    } else {
      estado.produtos = estado.produtos.filter((p) => p.id !== id);
      gravarLocal(); avisar();
    }
  }

  async function ajustarEstoque(id, delta) {
    const p = estado.produtos.find((x) => x.id === id);
    if (!p) return;
    return salvarProduto({ ...p, estoque: Math.max(0, (Number(p.estoque) || 0) + delta) });
  }

  async function salvarCategorias(lista) {
    if (estado.modo === "nuvem") await db.doc("loja/categorias").set({ lista });
    else { estado.categorias = lista; gravarLocal(); avisar(); }
  }

  async function salvarConfig(parcial) {
    const config = { ...estado.config, ...parcial };
    if (estado.modo === "nuvem") {
      const { nome, moeda, idioma, ...resto } = config;
      await db.doc("loja/config").set(resto);
    } else { estado.config = config; gravarLocal(); avisar(); }
  }

  async function criarPedido(pedido) {
    const novo = { ...pedido, codigo: codigoPedido(), criadoEm: Date.now(), status: "aguardando", pago: false, historico: [{ em: Date.now(), status: "aguardando" }] };
    if (estado.modo === "nuvem") {
      if (!estado.uid) throw new Error("sem-identidade");
      const lista = estado.meusPedidos.map(({ dono, ...p }) => p);
      await db.doc("reservas/" + estado.uid).set({ lista: [...lista, novo] });
    } else {
      estado.pedidos.push({ ...novo, dono: "local" });
      gravarLocal(); avisar();
    }
    return novo;
  }

  async function atualizarPedido(dono, codigo, mudancas) {
    const fonte = estado.modo === "nuvem"
      ? (dono === estado.uid && !estado.admin ? estado.meusPedidos : estado.pedidos.filter((p) => p.dono === dono))
      : estado.pedidos;
    const lista = fonte.map((p) => {
      if (p.codigo !== codigo) return p;
      const atualizado = { ...p, ...mudancas };
      if (mudancas.status && mudancas.status !== p.status) {
        atualizado.historico = [...(p.historico || []), { em: Date.now(), status: mudancas.status }];
      }
      return atualizado;
    });
    if (estado.modo === "nuvem") {
      await db.doc("reservas/" + dono).set({ lista: lista.map(({ dono: _, ...p }) => p) });
    } else {
      estado.pedidos = lista;
      gravarLocal(); avisar();
    }
  }

  function entrarPainelLocal(pin) {
    if (estado.modo !== "local" || String(pin) !== String(estado.config.pinPainel)) return false;
    estado.admin = true;
    try { sessionStorage.setItem("tmz-painel", "1"); } catch {}
    avisar();
    return true;
  }
  function sairPainelLocal() {
    if (estado.modo !== "local") return;
    estado.admin = false;
    try { sessionStorage.removeItem("tmz-painel"); } catch {}
    avisar();
  }

  conectar().catch(() => {});

  return {
    estado,
    ouvir(fn) { ouvintes.add(fn); fn(estado); return () => ouvintes.delete(fn); },
    reembolso,
    salvarProduto, apagarProduto, ajustarEstoque, salvarCategorias, salvarConfig,
    criarPedido, atualizarPedido, entrarPainelLocal, sairPainelLocal, novoId,
  };
})();
