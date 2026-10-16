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
    carrinhos: [],
    avisos: [],
  });

  const estado = {
    modo: "local",
    admin: false,
    uid: "local",
    ...padrao(),
    meusPedidos: [],
    produtosProntos: true, // false enquanto o catálogo do servidor ainda não chegou
    pagamentos: {}, // { "TMZ-AB12C": { status: "approved", valorPago, ... } } (só o dono enxerga)
    visitas: {}, // { "2026-10-10": { pessoas, vistas } } — só o dono enxerga
  };

  let db = null;
  let podeEditar = false;  // na nuvem: a conta do Claude pode alterar o banco
  let ouvindoAdmin = false;
  let produtosNaNuvem = false;
  let categoriasNaNuvem = false;

  function avisar() {
    estado.meusPedidos = estado.modo === "local"
      ? estado.pedidos.filter((p) => p.dono === "local")
      : estado.meusPedidos;
    ouvintes.forEach((fn) => fn(estado));
  }

  /* ---------- limpeza do que vem dos clientes ---------- */
  // Pedidos, carrinhos e avisos são gravados pelo navegador do cliente (nos modos sem servidor) e
  // podem chegar malformados ou maliciosos: aqui cada campo volta ao tipo e aos valores esperados.
  const STATUS_PEDIDO = ["aguardando", "confirmado", "retirado", "cancelado", "estornado"];
  const numero = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const quando = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : undefined);
  const txt = (v, max = 200) => (v == null ? "" : String(v).slice(0, max));
  const limparItens = (itens) => (Array.isArray(itens) ? itens.slice(0, 50) : []).map((i) => ({
    id: txt(i?.id, 60), nome: txt(i?.nome, 120), preco: numero(i?.preco), qtd: Math.max(0, Math.floor(numero(i?.qtd))),
  }));
  function limparPedido(p, dono) {
    if (!p || typeof p !== "object") return null;
    const c = p.cliente && typeof p.cliente === "object" ? p.cliente : {};
    return {
      ...p,
      dono: txt(dono ?? p.dono, 80), codigo: txt(p.codigo, 20),
      tipo: ["compra", "reserva30", "reserva50"].includes(p.tipo) ? p.tipo : "compra",
      status: STATUS_PEDIDO.includes(p.status) ? p.status : "aguardando",
      etapa: ["separando", "enviado", "pronto"].includes(p.etapa) ? p.etapa : undefined,
      receber: p.receber === "retirada" ? "retirada" : "entrega",
      itens: limparItens(p.itens),
      subtotal: numero(p.subtotal), frete: numero(p.frete), total: numero(p.total), sinal: numero(p.sinal),
      restante: numero(p.restante), cobrar: numero(p.cobrar ?? p.sinal),
      reembolso: p.reembolso == null ? undefined : numero(p.reembolso),
      prazoEntrega: p.prazoEntrega == null ? null : numero(p.prazoEntrega),
      pago: p.pago === true, estoqueBaixado: p.estoqueBaixado === true, pagamentoVerificado: p.pagamentoVerificado === true,
      pagamento: txt(p.pagamento, 40),
      cliente: { nome: txt(c.nome, 80), telefone: txt(c.telefone, 20), email: txt(c.email, 120), cep: txt(c.cep, 9), endereco: txt(c.endereco, 200) },
      cupom: p.cupom && typeof p.cupom === "object" ? { codigo: txt(p.cupom.codigo, 30), desconto: numero(p.cupom.desconto), freteGratis: p.cupom.freteGratis === true, freteEconomizado: numero(p.cupom.freteEconomizado) } : null,
      rastreio: p.rastreio && typeof p.rastreio === "object" ? { transportadora: txt(p.rastreio.transportadora, 20), codigo: txt(p.rastreio.codigo, 40) } : undefined,
      regra: p.regra && typeof p.regra === "object" ? { janelaMin: numero(p.regra.janelaMin), percDepois: numero(p.regra.percDepois) } : undefined,
      numero: Number.isInteger(Number(p.numero)) && Number(p.numero) > 0 ? Number(p.numero) : undefined,
      aprovadoEm: quando(p.aprovadoEm), prazoEnvio: quando(p.prazoEnvio), prazoEnvioDias: p.prazoEnvioDias == null ? undefined : numero(p.prazoEnvioDias),
      criadoEm: numero(p.criadoEm), confirmadoEm: quando(p.confirmadoEm), separandoEm: quando(p.separandoEm), enviadoEm: quando(p.enviadoEm),
      prontoEm: quando(p.prontoEm), concluidoEm: quando(p.concluidoEm), canceladoEm: quando(p.canceladoEm), estornadoEm: quando(p.estornadoEm),
      canceladoPor: ["cliente", "loja"].includes(p.canceladoPor) ? p.canceladoPor : undefined,
      baixas: p.baixas && typeof p.baixas === "object" ? Object.fromEntries(Object.entries(p.baixas).slice(0, 50).map(([k, v]) => [txt(k, 60), numero(v)])) : undefined,
      historico: (Array.isArray(p.historico) ? p.historico.slice(0, 30) : []).map((h) => ({ em: numero(h?.em), status: txt(h?.status, 20) })),
    };
  }
  function limparCarrinho(c, dono) {
    if (!c || typeof c !== "object") return null;
    const cl = c.cliente && typeof c.cliente === "object" ? c.cliente : null;
    return {
      dono: txt(dono ?? c.dono, 80), id: txt(c.id, 20), criadoEm: numero(c.criadoEm), atualizadoEm: numero(c.atualizadoEm),
      itens: limparItens(c.itens), valor: numero(c.valor), status: ["aberto", "concluido", "vazio"].includes(c.status) ? c.status : "aberto",
      pedido: c.pedido ? txt(c.pedido, 20) : undefined,
      cliente: cl ? { nome: txt(cl.nome, 80), email: txt(cl.email, 120), whats: txt(cl.whats, 20) } : null,
    };
  }
  function limparAviso(a, dono) {
    if (!a || typeof a !== "object") return null;
    return {
      dono: txt(dono ?? a.dono, 80), id: txt(a.id, 40), produtoId: txt(a.produtoId, 60), produto: txt(a.produto, 120),
      contato: txt(a.contato, 120), nome: txt(a.nome, 80), criadoEm: numero(a.criadoEm), avisadoEm: quando(a.avisadoEm) || null,
    };
  }
  const limparLista = (lista, fn, dono) => (Array.isArray(lista) ? lista : []).map((x) => fn(x, dono)).filter(Boolean);

  /* ---------- modo local ---------- */
  function lerLocal() {
    try {
      const salvo = JSON.parse(localStorage.getItem(CHAVE_LOCAL));
      if (!salvo) return;
      const base = padrao();
      estado.config = { ...base.config, ...(salvo.config || {}) };
      if (Array.isArray(salvo.categorias)) estado.categorias = salvo.categorias;
      if (Array.isArray(salvo.produtos)) estado.produtos = salvo.produtos;
      if (Array.isArray(salvo.pedidos)) estado.pedidos = limparLista(salvo.pedidos, limparPedido);
      if (Array.isArray(salvo.carrinhos)) estado.carrinhos = limparLista(salvo.carrinhos, limparCarrinho);
      if (Array.isArray(salvo.avisos)) estado.avisos = limparLista(salvo.avisos, limparAviso);
    } catch {}
  }
  function gravarLocal() {
    try {
      gravarLocal.cheio = false;
      localStorage.setItem(CHAVE_LOCAL, JSON.stringify({
        config: estado.config, categorias: estado.categorias, produtos: estado.produtos, pedidos: estado.pedidos,
        carrinhos: estado.carrinhos, avisos: estado.avisos,
      }));
    } catch { gravarLocal.cheio = true; } // navegador sem espaço (fotos grandes demais)
  }
  lerLocal();

  /* ---------- modo nuvem (artifact) ---------- */
  async function conectar() {
    if (Supa.ativo()) return conectarSupabase();
    if (!window.claude?.use) return;
    const [banco, user] = await Promise.all([window.claude.use("db"), window.claude.use("user")]);
    if (!banco) return;
    db = banco;
    estado.modo = "nuvem";
    podeEditar = user ? await user.canEdit() : false;
    estado.admin = podeEditar && !!estado.conta?.admin;
    estado.uid = user ? await user.id() : null;
    await retomarSessaoNuvem();
    assinar();
  }

  /* ---------- modo servidor (Supabase) ---------- */
  // Cada visitante tem uma sessão: a da conta (se entrou) ou uma anônima. As regras do banco
  // usam o id dessa sessão para deixar cada um gravar só o que é seu.
  async function conectarSupabase() {
    let anon = null;
    try { anon = await Supa.sessaoAnonima(); } catch { anon = null; }
    const conta = lerSessao();
    const logado = conta?.tipo === "servidor" && conta.token ? conta : null;
    if (!logado && !anon) return; // sem sessão (anônimo desligado no Supabase): fica no modo local
    Supa.usarToken(tokenDaVez);
    if (db) db.fechar?.();
    db = Supa.banco;
    estado.modo = "nuvem";
    estado.uid = logado ? logado.uid : anon.uid;
    podeEditar = !!logado && limpar(logado.email) === emailDono();
    estado.admin = podeEditar && !!estado.conta?.admin;
    ouvindoAdmin = false;
    meusCarrinhosNuvem = null;
    assinar();
    if (estado.admin) semear().catch(() => {});
  }

  // Token usado nas leituras e gravações: o da conta (renovado quando vence) ou o anônimo
  let renovando = null;
  async function tokenDaVez() {
    const s = lerSessao();
    if (s?.tipo === "servidor" && s.token) {
      if (Date.now() < s.expira - 60000) return s.token;
      renovando = renovando || supabase("token?grant_type=refresh_token", { refresh_token: s.renovar })
        .then(({ ok, dados }) => { if (ok) { const nova = sessaoSupabase(dados); gravarSessao(nova, s.lembrar); return nova.token; } throw new Error(); })
        .finally(() => { renovando = null; });
      try { return await renovando; } catch { apagarSessao(); aplicarSessao(null); setTimeout(() => reconectar().catch(() => {}), 0); }
    }
    return (await Supa.sessaoAnonima()).token;
  }

  // Na primeira vez que o dono entra, grava no servidor o catálogo, as categorias e a configuração
  // (o pagamento online confere preços e cupons por eles)
  async function semear() {
    const [config, cats, prods] = await Promise.all([db.doc("loja/config").get(), db.doc("loja/categorias").get(), db.collection("produtos").get()]);
    if (!config.exists) { const { nome, moeda, idioma, pinPainel, ...resto } = estado.config; await db.doc("loja/config").set(resto); }
    if (!cats.exists) await db.doc("loja/categorias").set({ lista: estado.categorias });
    const publicado = config.exists && config.data().catalogoPublicado;
    if (prods.empty && !publicado) { produtosNaNuvem = false; estado.produtosProntos = true; await garantirCatalogo(); }
  }

  // Trocou de conta (entrou, saiu ou criou conta): reconecta com a sessão nova
  async function reconectar() {
    if (!Supa.ativo()) return;
    await conectarSupabase();
    avisar();
  }

  // Leva os pedidos e carrinhos feitos antes de entrar (sessão anônima) para a conta
  async function migrarAnonimo(sessao) {
    let anon;
    try { anon = await Supa.sessaoAnonima(); } catch { return; }
    if (!anon?.uid || anon.uid === sessao.uid) return;
    try { await Supa.pedir("/functions/v1/migrar", { metodo: "POST", token: sessao.token, corpo: { tokenAnonimo: anon.token } }); } catch {}
    for (const colecao of ["carrinhos"]) {
      try {
        const deles = await Supa.pedir(`/rest/v1/docs?colecao=eq.${colecao}&id=eq.${anon.uid}&select=dados`, { token: anon.token });
        const listaAnon = deles[0]?.dados?.lista || [];
        if (!listaAnon.length) continue;
        const meus = await Supa.pedir(`/rest/v1/docs?colecao=eq.${colecao}&id=eq.${sessao.uid}&select=dados`, { token: sessao.token });
        const lista = meus[0]?.dados?.lista || [];
        const chave = (x) => x.codigo || x.id;
        const juntos = [...lista, ...listaAnon.filter((x) => !lista.some((y) => chave(y) === chave(x)))];
        await Supa.pedir("/rest/v1/docs?on_conflict=colecao,id", {
          metodo: "POST", token: sessao.token, corpo: { colecao, id: sessao.uid, dados: { lista: juntos } },
          cabecalhos: { Prefer: "resolution=merge-duplicates,return=minimal" },
        });
        await Supa.pedir("/rest/v1/docs?on_conflict=colecao,id", {
          metodo: "POST", token: anon.token, corpo: { colecao, id: anon.uid, dados: { lista: [] } },
          cabecalhos: { Prefer: "resolution=merge-duplicates,return=minimal" },
        });
      } catch {}
    }
  }

  function assinar() {
    estado.produtosProntos = false; // o carrinho só descarta itens depois que o catálogo do servidor chegar
    estado.pedidos = [];
    estado.meusPedidos = [];
    estado.carrinhos = [];
    estado.avisos = [];
    estado.visitas = {};
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
      estado.produtosProntos = true;
      produtosNaNuvem = !s.empty;
      estado.produtos = produtosNaNuvem
        ? s.docs.map((d) => ({ ...d.data(), id: d.id })).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
        : estado.config.catalogoPublicado ? [] : padrao().produtos;
      avisar();
    }, () => {});
    if (estado.admin) ouvirAdminNuvem();
    if (estado.modo === "nuvem" && !podeEditar && estado.uid) registrarVisitaNuvem();
    if (Supa.ativo()) {
      // Pedidos ficam em pedidos/<código>, gravados só pelo servidor. As regras do banco entregam ao
      // cliente só os dele; ao dono, todos.
      db.collection("pedidos").onSnapshot((s) => {
        const todos = s.docs.map((d) => limparPedido({ ...d.data(), codigo: d.id })).filter(Boolean);
        estado.meusPedidos = todos.filter((p) => p.dono === estado.uid);
        if (estado.admin) estado.pedidos = todos;
        avisar();
      }, () => {});
    } else if (estado.uid) {
      db.doc("reservas/" + estado.uid).onSnapshot((s) => {
        estado.meusPedidos = s.exists ? limparLista(s.data().lista, limparPedido, estado.uid) : [];
        avisar();
      }, () => {});
    }
  }

  // Pedidos de todos e visitas: só depois que o dono entra
  function ouvirAdminNuvem() {
    if (ouvindoAdmin || !db) return;
    ouvindoAdmin = true;
    if (!Supa.ativo()) {
      db.collection("reservas").onSnapshot((s) => {
        estado.pedidos = s.docs.flatMap((d) => limparLista(d.data().lista, limparPedido, d.id));
        avisar();
      }, () => {});
    }
    // Pagamentos confirmados pelo Mercado Pago: só o servidor grava, então é o que vale como "verificado"
    if (Supa.ativo()) {
      db.collection("pagamentos").onSnapshot((s) => {
        estado.pagamentos = Object.fromEntries(s.docs.map((d) => [d.id, d.data()]));
        avisar();
      }, () => {});
    }
    db.collection("avisos").onSnapshot((s) => {
      estado.avisos = s.docs.flatMap((d) => limparLista(d.data().lista, limparAviso, d.id));
      avisar();
    }, () => {});
    db.collection("carrinhos").onSnapshot((s) => {
      estado.carrinhos = s.docs.flatMap((d) => limparLista(d.data().lista, limparCarrinho, d.id));
      avisar();
    }, () => {});
    ouvirVisitasNuvem();
  }

  // Na primeira edição do dono, grava o catálogo inicial inteiro na nuvem
  // Só uma vez na vida da loja (marcado em config.catalogoPublicado): se o dono apagar todos os
  // produtos depois, o catálogo de exemplo não volta.
  async function garantirCatalogo() {
    if (produtosNaNuvem || estado.config.catalogoPublicado || !estado.produtosProntos) return;
    for (const [i, p] of estado.produtos.entries()) await db.doc("produtos/" + p.id).set({ ...p, ordem: p.ordem ?? i });
    produtosNaNuvem = true;
    await salvarConfig({ catalogoPublicado: true });
  }

  /* ---------- utilidades ---------- */
  const novoId = (prefixo) => prefixo + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  function codigoPedido() {
    // 8 caracteres do gerador criptográfico: impossível de adivinhar
    const letras = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    return "TMZ-" + [...crypto.getRandomValues(new Uint8Array(8))].map((b) => letras[b % 32]).join("");
  }


  // Regra de cancelamento das reservas
  function reembolso(pedido, agora = Date.now()) {
    const cfg = estado.config;
    const pago = pedido.pago ? pedido.sinal : 0;
    const janela = pedido.regra?.janelaMin ?? cfg.estornoJanelaMin;
    const perc = pedido.regra?.percDepois ?? cfg.estornoDepoisPerc;
    const limite = pedido.criadoEm + janela * 60000;
    const dentro = agora <= limite;
    const valor = dentro ? pago : Math.round(pago * perc) / 100;
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
      const anterior = i >= 0 ? estado.produtos[i] : null;
      if (i >= 0) estado.produtos[i] = produto; else estado.produtos.push(produto);
      gravarLocal();
      if (gravarLocal.cheio) {
        // não coube: desfaz para a loja não mostrar algo que não foi salvo
        if (anterior) estado.produtos[i] = anterior; else estado.produtos.pop();
        throw new Error("Sem espaço no navegador para essa foto. Use uma foto menor ou ligue o servidor.");
      }
      avisar();
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

  // Soma ou tira unidades. Devolve quanto mudou de fato (o estoque nunca fica negativo).
  async function ajustarEstoque(id, delta) {
    let p = estado.produtos.find((x) => x.id === id);
    if (estado.modo === "nuvem" && produtosNaNuvem) {
      try { const snap = await db.doc("produtos/" + id).get(); if (snap.exists) p = { ...snap.data(), id }; } catch {}
    }
    if (!p) return 0;
    const antes = Math.max(0, Number(p.estoque) || 0);
    const depois = Math.max(0, antes + delta);
    await salvarProduto({ ...p, estoque: depois });
    return depois - antes;
  }

  // Versão mais recente de um pedido (antes de confirmar, cancelar ou devolver ao estoque)
  async function lerPedido(dono, codigo) {
    if (estado.modo === "nuvem") {
      try {
        if (Supa.ativo()) { const s = await db.doc("pedidos/" + codigo).get(); return s.exists ? limparPedido({ ...s.data(), codigo }) : null; }
        const s = await db.doc("reservas/" + dono).get();
        return limparLista(s.exists ? s.data().lista : [], limparPedido, dono).find((p) => p.codigo === codigo) || null;
      } catch { return null; }
    }
    return estado.pedidos.find((p) => p.codigo === codigo) || null;
  }

  async function salvarCategorias(lista) {
    if (estado.modo === "nuvem") await db.doc("loja/categorias").set({ lista });
    else { estado.categorias = lista; gravarLocal(); avisar(); }
  }

  async function salvarConfig(parcial) {
    if (estado.modo === "nuvem") {
      // relê a configuração do servidor e muda só o que veio (duas gravações seguidas não se desfazem)
      let atual = {};
      try { const s = await db.doc("loja/config").get(); atual = s.exists ? s.data() : {}; } catch {}
      const { nome, moeda, idioma, pinPainel, ...resto } = { ...padrao().config, ...atual, ...parcial };
      await db.doc("loja/config").set(resto); // a senha de teste (pinPainel) nunca vai para o banco público
      estado.config = { ...estado.config, ...resto };
      avisar();
    } else { estado.config = { ...estado.config, ...parcial }; gravarLocal(); avisar(); }
  }

  async function criarPedido(pedido) {
    if (Supa.ativo() && estado.modo === "nuvem") {
      // No servidor: o navegador manda só as escolhas; preços, frete, desconto e código saem de lá
      const r = await Supa.funcao("pedido", {
        tipo: pedido.tipo, receber: pedido.receber, pagamento: pedido.pagamento,
        itens: pedido.itens.map((i) => ({ id: i.id, qtd: i.qtd })), cliente: pedido.cliente, cupom: pedido.cupom?.codigo || null,
      });
      const novo = limparPedido(r.pedido);
      estado.meusPedidos = [...estado.meusPedidos.filter((p) => p.codigo !== novo.codigo), novo];
      avisar();
      return novo;
    }
    // número crescente (1, 2, 3…): no modo local, o maior já usado + 1. No servidor sai de uma
    // sequência do banco; no esboço do Claude, o painel numera pela ordem de chegada.
    const numero = estado.modo === "local" ? estado.pedidos.reduce((m, p) => Math.max(m, Number(p.numero) || 0), 0) + 1 : undefined;
    const novo = { ...pedido, numero, codigo: codigoPedido(), criadoEm: Date.now(), status: "aguardando", pago: false, historico: [{ em: Date.now(), status: "aguardando" }] };
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
    if (Supa.ativo() && estado.modo === "nuvem") {
      // Só o dono da loja altera pedidos (as regras do banco barram o resto). Lê a versão atual antes,
      // para não desfazer o que o servidor (pagamento) ou outro aparelho acabou de gravar.
      const ref = db.doc("pedidos/" + codigo);
      const snap = await ref.get();
      if (!snap.exists) throw new Error("Pedido não encontrado");
      const atual = snap.data();
      const novo = { ...atual, ...mudancas };
      if (mudancas.status && mudancas.status !== atual.status) novo.historico = [...(atual.historico || []), { em: Date.now(), status: mudancas.status }];
      await ref.set(novo);
      return;
    }
    if (estado.modo === "nuvem") {
      // Banco do esboço: relê a lista do cliente antes de mudar só este pedido, para não apagar pedidos novos
      const ref = db.doc("reservas/" + dono);
      const snap = await ref.get();
      const lista = (snap.exists ? snap.data().lista || [] : []).map((p) => {
        if (p.codigo !== codigo) return p;
        const at = { ...p, ...mudancas };
        if (mudancas.status && mudancas.status !== p.status) at.historico = [...(p.historico || []), { em: Date.now(), status: mudancas.status }];
        return at;
      });
      await ref.set({ lista });
      return;
    }
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

  // Cliente cancela a própria reserva: no servidor, pela função cancelar_pedido (valor calculado lá)
  async function cancelarMeuPedido(p) {
    if (Supa.ativo() && estado.modo === "nuvem") {
      const r = await Supa.rpc("cancelar_pedido", { p_codigo: p.codigo });
      estado.meusPedidos = estado.meusPedidos.map((x) => (x.codigo === p.codigo ? { ...x, status: "cancelado", reembolso: r.reembolso, canceladoEm: Date.now(), canceladoPor: "cliente" } : x));
      avisar();
      return r.reembolso;
    }
    if (!["aguardando", "confirmado"].includes(p.status) || p.tipo === "compra" || ["enviado", "pronto"].includes(p.etapa)) throw new Error("não pode");
    const valor = reembolso(p).valor;
    await atualizarPedido(p.dono, p.codigo, { status: "cancelado", canceladoEm: Date.now(), canceladoPor: "cliente", reembolso: valor });
    return valor;
  }

  /* ---------- contas: entrar e cadastrar ---------- */
  // Qualquer cliente pode criar conta. O painel abre só para o e-mail ACESSO.emailAdmin.
  //  - Com o Supabase configurado: contas e senhas ficam no servidor.
  //  - Sem ele: as contas ficam neste navegador (senha guardada como hash) e o dono entra
  //    com a senha de teste. Serve para testar; não é proteção de verdade.
  const CHAVE_SESSAO = "tmz-sessao";
  const CHAVE_CONTAS = "tmz-contas";
  const servidor = () => (ACESSO.supabaseUrl && ACESSO.supabaseChave ? ACESSO.supabaseUrl.replace(/\/+$/, "") : "");
  const emailDono = () => String(ACESSO.emailAdmin || "").trim().toLowerCase();
  const limpar = (email) => String(email || "").trim().toLowerCase();
  estado.login = { tipo: servidor() ? "servidor" : "teste", email: emailDono() };
  estado.conta = null; // { nome, email, whats, admin }
  let tentativas = 0;
  let bloqueadoAte = 0;

  // o navegador pode bloquear o armazenamento (aba anônima, esboço publicado): aí a sessão vale só na memória
  const lojas = () => ["localStorage", "sessionStorage"].flatMap((n) => { try { return [window[n]]; } catch { return []; } });
  function lerSessao() {
    for (const loja of lojas()) {
      try { const s = JSON.parse(loja.getItem(CHAVE_SESSAO)); if (s) return { ...s, lembrar: loja === window.localStorage }; } catch {}
    }
    return null;
  }
  function gravarSessao(sessao, lembrar) {
    apagarSessao();
    try { (lembrar ? localStorage : sessionStorage).setItem(CHAVE_SESSAO, JSON.stringify(sessao)); } catch {}
  }
  function apagarSessao() {
    lojas().forEach((loja) => { try { loja.removeItem(CHAVE_SESSAO); } catch {} });
  }
  const sessaoValida = (s) => s && s.email && s.tipo === estado.login.tipo && (!s.admin || limpar(s.email) === emailDono());

  function aplicarSessao(s) {
    estado.conta = s ? { nome: s.nome || "", email: s.email, whats: s.whats || "", admin: !!s.admin } : null;
    estado.admin = !!s?.admin && (Supa.ativo() ? podeEditar : estado.modo === "local" || podeEditar);
    if (estado.admin && estado.modo === "nuvem") ouvirAdminNuvem();
    avisar();
  }

  async function supabase(caminho, corpo, token) {
    const r = await fetch(servidor() + "/auth/v1/" + caminho, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: ACESSO.supabaseChave, Authorization: "Bearer " + (token || ACESSO.supabaseChave) },
      body: JSON.stringify(corpo || {}),
    });
    const dados = await r.json().catch(() => ({}));
    return { ok: r.ok, dados };
  }
  const sessaoSupabase = (d, extra) => ({
    tipo: "servidor", uid: d.user?.id, email: limpar(d.user?.email), nome: d.user?.user_metadata?.nome || "",
    whats: d.user?.user_metadata?.whats || "", admin: limpar(d.user?.email) === emailDono(),
    token: d.access_token, renovar: d.refresh_token, expira: Date.now() + d.expires_in * 1000, ...extra,
  });

  // Senhas das contas de teste: hash SHA-256 com sal, nunca o texto da senha
  async function resumo(sal, senha) {
    const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(sal + ":" + senha));
    return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  function contasLocais() {
    try { return JSON.parse(localStorage.getItem(CHAVE_CONTAS)) || {}; } catch { return {}; }
  }

  // Ao abrir o site: retoma a sessão salva (e renova o acesso no Supabase quando venceu)
  async function retomarSessao() {
    const s = lerSessao();
    if (!sessaoValida(s)) { if (s) apagarSessao(); return; }
    aplicarSessao(s);
    // a sessão do servidor é renovada por tokenDaVez() na primeira leitura (uma renovação só por vez)
  }

  function bloqueio() {
    if (Date.now() < bloqueadoAte) {
      return { ok: false, erro: `Muitas tentativas. Espere ${Math.ceil((bloqueadoAte - Date.now()) / 1000)} segundos.` };
    }
    return null;
  }
  function falhou(erro) {
    tentativas += 1;
    if (tentativas >= 5) { bloqueadoAte = Date.now() + 60000; tentativas = 0; }
    return { ok: false, erro };
  }
  // No esboço publicado (sem Supabase) as contas ficam no banco da loja, em contas/<id de quem acessa>:
  // cada pessoa só lê a própria conta e o dono vê a lista de clientes.
  const naNuvem = () => estado.login.tipo === "teste" && estado.modo === "nuvem" && db && estado.uid;
  const refConta = () => db.doc("contas/" + estado.uid);
  async function lerContaNuvem() {
    const snap = await refConta().get();
    return snap.exists ? snap.data() : null;
  }
  async function gravarContaNuvem(campos) {
    const atual = (await lerContaNuvem()) || {};
    await refConta().set({ ...atual, ...campos });
  }
  async function retomarSessaoNuvem() {
    if (!naNuvem()) return;
    try {
      const conta = await lerContaNuvem();
      const s = conta?.sessao;
      if (sessaoValida(s)) aplicarSessao(s);
    } catch {}
  }

  async function concluirServidor(sessao, lembrar, perfil) {
    tentativas = 0;
    if (perfil) sessao = { ...sessao, nome: sessao.nome || perfil.nome, whats: sessao.whats || perfil.whats };
    gravarSessao(sessao, lembrar);
    await migrarAnonimo(sessao);
    if (perfil) {
      try {
        await Supa.pedir("/rest/v1/docs?on_conflict=colecao,id", {
          metodo: "POST", token: sessao.token, corpo: { colecao: "contas", id: sessao.uid, dados: perfil },
          cabecalhos: { Prefer: "resolution=merge-duplicates,return=minimal" },
        });
      } catch {}
    }
    aplicarSessao(sessao);
    await reconectar();
    aplicarSessao(sessao);
    return { ok: true };
  }

  function concluir(sessao, lembrar) {
    tentativas = 0;
    gravarSessao(sessao, lembrar);
    if (naNuvem()) gravarContaNuvem({ sessao }).catch(() => {});
    aplicarSessao(sessao);
    if (sessao.admin && estado.modo === "nuvem" && !podeEditar) {
      return { ok: true, aviso: "Você entrou, mas esta cópia da loja só pode ser alterada pela conta que a publicou." };
    }
    return { ok: true };
  }

  async function entrar(email, senha, lembrar) {
    const b = bloqueio(); if (b) return b;
    email = limpar(email);
    if (estado.login.tipo === "servidor") {
      let r;
      try { r = await supabase("token?grant_type=password", { email, password: senha }); }
      catch { return { ok: false, erro: "Sem conexão com o servidor. Tente de novo." }; }
      if (!r.ok) {
        if (/confirm/i.test(r.dados.msg || r.dados.error_description || "")) return { ok: false, erro: "Confirme seu e-mail pelo link que enviamos e tente de novo." };
        return falhou("E-mail ou senha incorretos.");
      }
      return concluirServidor(sessaoSupabase(r.dados), lembrar);
    }
    if (email === emailDono()) {
      if (String(senha) !== String(estado.config.pinPainel)) return falhou("E-mail ou senha incorretos.");
      return concluir({ tipo: "teste", email, nome: "Lojista TMZ", admin: true }, lembrar);
    }
    let conta;
    if (naNuvem()) {
      try { conta = await lerContaNuvem(); } catch { return { ok: false, erro: "Sem conexão. Tente de novo." }; }
      if (conta && conta.email !== email) conta = null;
    } else {
      conta = contasLocais()[email];
    }
    if (!conta?.hash || conta.hash !== await resumo(conta.sal, senha)) return falhou("E-mail ou senha incorretos.");
    return concluir({ tipo: "teste", email, nome: conta.nome, whats: conta.whats, admin: false }, lembrar);
  }

  async function cadastrar({ nome, email, whats, senha }) {
    const b = bloqueio(); if (b) return b;
    email = limpar(email);
    nome = String(nome || "").trim();
    if (nome.length < 2) return { ok: false, erro: "Digite seu nome." };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, erro: "Digite um e-mail válido." };
    if (String(senha).length < 6) return { ok: false, erro: "A senha precisa ter pelo menos 6 caracteres." };
    if (email === emailDono()) return { ok: false, erro: "Este e-mail já tem conta. Use Entrar." };
    if (estado.login.tipo === "servidor") {
      let r;
      try { r = await supabase("signup", { email, password: senha, data: { nome, whats } }); }
      catch { return { ok: false, erro: "Sem conexão com o servidor. Tente de novo." }; }
      if (!r.ok) {
        const msg = r.dados.msg || r.dados.error_description || "";
        return { ok: false, erro: /registered|exists/i.test(msg) ? "Este e-mail já tem conta. Use Entrar." : "Não deu para criar a conta. Tente de novo." };
      }
      if (!r.dados.access_token) return { ok: true, confirmar: true, msg: "Conta criada! Enviamos um link para o seu e-mail. Confirme e depois entre." };
      return concluirServidor(sessaoSupabase(r.dados), true, { nome, email, whats, criadoEm: Date.now() });
    }
    const sal = crypto.getRandomValues(new Uint32Array(4)).join("-");
    const nova = { nome, email, whats, sal, hash: await resumo(sal, senha), criadoEm: Date.now() };
    if (naNuvem()) {
      try {
        const atual = await lerContaNuvem();
        if (atual?.hash) {
          return { ok: false, erro: atual.email === email ? "Este e-mail já tem conta. Use Entrar." : `Você já tem uma conta (${atual.email}). Use Entrar.` };
        }
        await gravarContaNuvem(nova);
      } catch { return { ok: false, erro: "Não deu para salvar a conta. Tente de novo." }; }
      return concluir({ tipo: "teste", email, nome, whats, admin: false }, true);
    }
    const contas = contasLocais();
    if (contas[email]) return { ok: false, erro: "Este e-mail já tem conta. Use Entrar." };
    contas[email] = nova;
    try { localStorage.setItem(CHAVE_CONTAS, JSON.stringify(contas)); }
    catch { return { ok: false, erro: "Este navegador não deixou salvar a conta." }; }
    return concluir({ tipo: "teste", email, nome, whats, admin: false }, true);
  }

  function sair() {
    const s = lerSessao();
    if (s?.tipo === "servidor") supabase("logout", {}, s.token).catch(() => {});
    apagarSessao();
    if (naNuvem()) gravarContaNuvem({ sessao: null }).catch(() => {});
    aplicarSessao(null);
    if (s?.tipo === "servidor") reconectar().catch(() => {});
  }

  // Lista de clientes para o painel (sem as senhas)
  async function listarClientes() {
    const tirar = ({ sal, hash, sessao, ...c }) => c;
    if (naNuvem()) {
      const snap = await db.collection("contas").get();
      return snap.docs.map((d) => d.data()).filter((c) => c.hash).map(tirar);
    }
    if (estado.login.tipo === "teste") return Object.entries(contasLocais()).map(([email, c]) => tirar({ email, ...c }));
    if (Supa.ativo() && db) {
      const snap = await db.collection("contas").get();
      return snap.docs.map((d) => d.data()).filter((c) => c.email).map(tirar);
    }
    return null;
  }

  async function recuperarSenha(email) {
    email = limpar(email);
    if (!email) return { ok: false, erro: "Digite seu e-mail para receber o link." };
    if (estado.login.tipo !== "servidor") {
      return { ok: false, erro: "No modo de teste não dá para mandar e-mail. Com o login no servidor (Supabase), chega um link para criar uma nova senha." };
    }
    try { await supabase("recover", { email }); } catch { return { ok: false, erro: "Sem conexão com o servidor. Tente de novo." }; }
    return { ok: true, msg: "Se este e-mail tiver conta, chega um link para criar uma nova senha." };
  }
  retomarSessao();

  /* ---------- carrinhos ---------- */
  // Cada carrinho que alguém monta vira um registro: aguardando (ainda montando), concluído (virou
  // pedido), esvaziado ou, depois de 1 hora parado, abandonado. Na nuvem cada visitante grava só
  // carrinhos/<id dele>; o dono vê todos.
  const CHAVE_CARRINHO_ATUAL = "tmz-carrinho-id";
  let carrinhoAtual = null;
  try { carrinhoAtual = sessionStorage.getItem(CHAVE_CARRINHO_ATUAL) || localStorage.getItem(CHAVE_CARRINHO_ATUAL); } catch {}
  function guardarCarrinhoAtual(id) {
    carrinhoAtual = id;
    ["localStorage", "sessionStorage"].forEach((n) => {
      try { id ? window[n].setItem(CHAVE_CARRINHO_ATUAL, id) : window[n].removeItem(CHAVE_CARRINHO_ATUAL); } catch {}
    });
  }
  function codigoCarrinho() {
    const letras = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let c = "";
    for (let i = 0; i < 5; i++) c += letras[Math.floor(Math.random() * letras.length)];
    return "CRT-" + c;
  }
  let meusCarrinhosNuvem = null;
  async function listaCarrinhos() {
    if (estado.modo !== "nuvem") return estado.carrinhos;
    if (!meusCarrinhosNuvem) {
      const snap = await db.doc("carrinhos/" + estado.uid).get();
      meusCarrinhosNuvem = snap.exists ? snap.data().lista || [] : [];
    }
    return meusCarrinhosNuvem;
  }
  async function gravarCarrinhos(lista) {
    lista = lista.slice(-40); // guarda os 40 mais recentes de cada visitante
    if (estado.modo === "nuvem") {
      meusCarrinhosNuvem = lista;
      await db.doc("carrinhos/" + estado.uid).set({ lista });
    } else {
      estado.carrinhos = lista;
      gravarLocal(); avisar();
    }
  }
  const quemCompra = () => (estado.conta && !estado.conta.admin
    ? { nome: estado.conta.nome, email: estado.conta.email, whats: estado.conta.whats } : null);

  // itens: [{ id, nome, preco, qtd }]
  async function registrarCarrinho(itens) {
    if (estado.modo === "nuvem" && !estado.uid) return;
    try {
      const lista = [...(await listaCarrinhos())];
      const agora = Date.now();
      const valor = Math.round(itens.reduce((s, i) => s + i.preco * i.qtd, 0) * 100) / 100;
      const i = lista.findIndex((c) => c.id === carrinhoAtual && c.status === "aberto");
      if (!itens.length) {
        if (i >= 0) lista[i] = { ...lista[i], status: "vazio", atualizadoEm: agora };
        guardarCarrinhoAtual(null);
      } else if (i >= 0) {
        lista[i] = { ...lista[i], itens, valor, atualizadoEm: agora, cliente: quemCompra() || lista[i].cliente || null };
      } else {
        const novo = { id: codigoCarrinho(), criadoEm: agora, atualizadoEm: agora, itens, valor, status: "aberto", cliente: quemCompra() };
        lista.push(novo);
        guardarCarrinhoAtual(novo.id);
      }
      await gravarCarrinhos(lista);
    } catch {}
  }

  // O carrinho virou pedido
  async function concluirCarrinho(pedido) {
    if (!carrinhoAtual) return;
    try {
      const lista = [...(await listaCarrinhos())];
      const i = lista.findIndex((c) => c.id === carrinhoAtual);
      if (i >= 0) {
        lista[i] = {
          ...lista[i], status: "concluido", pedido: pedido.codigo, atualizadoEm: Date.now(),
          cliente: { nome: pedido.cliente?.nome, email: pedido.cliente?.email, whats: pedido.cliente?.telefone },
        };
        await gravarCarrinhos(lista);
      }
    } catch {}
    guardarCarrinhoAtual(null);
  }

  /* ---------- acompanhar pedido ---------- */
  // Acha o pedido pelo código e pelos 4 últimos números do WhatsApp usado na compra
  async function buscarPedido(codigo, final) {
    codigo = String(codigo || "").trim().toUpperCase();
    final = String(final || "").replace(/\D/g, "").slice(-4);
    const confere = (p) => p.codigo === codigo && String(p.cliente?.telefone || "").replace(/\D/g, "").endsWith(final);
    const meu = estado.meusPedidos.find((p) => p.codigo === codigo);
    if (meu) return meu; // pedido feito neste aparelho ou nesta conta: não precisa do telefone
    if (final.length < 4) return null;
    const local = (estado.modo === "local" || estado.admin) && estado.pedidos.find(confere);
    if (local) return local;
    if (Supa.ativo() && estado.modo === "nuvem") {
      try { return (await Supa.rpc("rastrear_pedido", { codigo, final_telefone: final })) || null; } catch { return null; }
    }
    return null;
  }

  /* ---------- avise-me quando chegar ---------- */
  // Cliente deixa o contato num produto esgotado; o dono vê a lista de espera e avisa quando repõe.
  async function pedirAviso(produto, contato) {
    const aviso = {
      id: novoId("av"), produtoId: String(produto.id), produto: produto.nome, contato: String(contato).trim(),
      nome: estado.conta?.nome || "", criadoEm: Date.now(), avisadoEm: null,
    };
    if (estado.modo === "nuvem") {
      if (!estado.uid) throw new Error("sem-identidade");
      const ref = db.doc("avisos/" + estado.uid);
      const snap = await ref.get();
      const lista = (snap.exists ? snap.data().lista || [] : []).filter((a) => !(a.produtoId === aviso.produtoId && !a.avisadoEm));
      await ref.set({ lista: [...lista, aviso].slice(-50) });
    } else {
      estado.avisos = [...estado.avisos.filter((a) => !(a.produtoId === aviso.produtoId && a.contato === aviso.contato && !a.avisadoEm)), { ...aviso, dono: "local" }];
      gravarLocal(); avisar();
    }
    return aviso;
  }
  // Dono marca como avisados todos que esperavam o produto
  async function marcarAvisados(produtoId) {
    const agora = Date.now();
    const marcar = (a) => (a.produtoId === String(produtoId) && !a.avisadoEm ? { ...a, avisadoEm: agora } : a);
    if (estado.modo === "nuvem") {
      const donos = [...new Set(estado.avisos.filter((a) => a.produtoId === String(produtoId) && !a.avisadoEm).map((a) => a.dono))];
      for (const dono of donos) {
        const lista = estado.avisos.filter((a) => a.dono === dono).map(({ dono: _, ...a }) => marcar(a));
        await db.doc("avisos/" + dono).set({ lista });
      }
    } else {
      estado.avisos = estado.avisos.map(marcar);
      gravarLocal(); avisar();
    }
  }

  /* ---------- visitas diárias ---------- */
  const hoje = () => new Date().toLocaleDateString("sv-SE"); // AAAA-MM-DD no fuso do visitante
  function podar(dias) {
    const limite = new Date(Date.now() - 120 * 864e5).toLocaleDateString("sv-SE");
    Object.keys(dias).forEach((d) => { if (d < limite) delete dias[d]; });
    return dias;
  }
  function visitasLocais() {
    try { estado.visitas = JSON.parse(localStorage.getItem("tmz-visitas")) || {}; } catch { estado.visitas = {}; }
  }
  function registrarVisitaLocal() {
    visitasLocais();
    if (estado.admin || location.hash === "#painel") return; // visitas do dono não entram na conta
    const d = hoje();
    const v = estado.visitas[d] || { pessoas: 0, vistas: 0 };
    let jaContou = false;
    try { jaContou = sessionStorage.getItem("tmz-visita-dia") === d || localStorage.getItem("tmz-visitante-dia") === d; } catch {}
    v.vistas += 1;
    if (!jaContou) v.pessoas += 1;
    estado.visitas[d] = v;
    try {
      localStorage.setItem("tmz-visitas", JSON.stringify(podar(estado.visitas)));
      localStorage.setItem("tmz-visitante-dia", d);
      sessionStorage.setItem("tmz-visita-dia", d);
    } catch {}
  }
  // Na nuvem cada visitante grava só o próprio documento (visitas/<id>); o dono soma todos.
  async function registrarVisitaNuvem() {
    if (!estado.uid || podeEditar) return;
    try {
      const ref = db.doc("visitas/" + estado.uid);
      const snap = await ref.get();
      const dias = podar({ ...(snap.exists ? snap.data().dias || {} : {}) });
      dias[hoje()] = (dias[hoje()] || 0) + 1;
      await ref.set({ dias });
    } catch {}
  }
  function ouvirVisitasNuvem() {
    db.collection("visitas").onSnapshot((s) => {
      const total = {};
      s.docs.forEach((doc) => {
        Object.entries(doc.data().dias || {}).forEach(([d, n]) => {
          const v = total[d] || (total[d] = { pessoas: 0, vistas: 0 });
          v.pessoas += 1;
          v.vistas += Number(n) || 0;
        });
      });
      estado.visitas = total;
      avisar();
    }, () => {});
  }
  registrarVisitaLocal();

  conectar().catch(() => {});

  return {
    estado,
    ouvir(fn) { ouvintes.add(fn); fn(estado); return () => ouvintes.delete(fn); },
    reembolso,
    salvarProduto, apagarProduto, ajustarEstoque, salvarCategorias, salvarConfig,
    criarPedido, atualizarPedido, cancelarMeuPedido, lerPedido, entrar, cadastrar, sair, recuperarSenha, listarClientes, registrarCarrinho, concluirCarrinho, pedirAviso, marcarAvisados, buscarPedido, novoId,
  };
})();
