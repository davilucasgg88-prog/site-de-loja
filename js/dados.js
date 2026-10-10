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
  lerLocal();

  /* ---------- modo nuvem (artifact) ---------- */
  async function conectar() {
    if (!window.claude?.use) return;
    const [banco, user] = await Promise.all([window.claude.use("db"), window.claude.use("user")]);
    if (!banco) return;
    db = banco;
    estado.modo = "nuvem";
    podeEditar = user ? await user.canEdit() : false;
    estado.admin = podeEditar && !!estado.conta?.admin;
    estado.uid = user ? await user.id() : null;
    await retomarSessaoNuvem();
    estado.pedidos = [];
    estado.meusPedidos = [];
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
      produtosNaNuvem = !s.empty;
      estado.produtos = produtosNaNuvem
        ? s.docs.map((d) => ({ ...d.data(), id: d.id })).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
        : padrao().produtos;
      avisar();
    }, () => {});
    if (estado.admin) ouvirAdminNuvem();
    if (estado.uid) {
      db.doc("reservas/" + estado.uid).onSnapshot((s) => {
        estado.meusPedidos = s.exists ? (s.data().lista || []).map((p) => ({ ...p, dono: estado.uid })) : [];
        avisar();
      }, () => {});
    }
  }

  // Pedidos de todos e visitas: só depois que o dono entra
  function ouvirAdminNuvem() {
    if (ouvindoAdmin || !db) return;
    ouvindoAdmin = true;
    db.collection("reservas").onSnapshot((s) => {
      estado.pedidos = s.docs.flatMap((d) => (d.data().lista || []).map((p) => ({ ...p, dono: d.id })));
      avisar();
    }, () => {});
    ouvirVisitasNuvem();
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
    estado.admin = !!s?.admin && (estado.modo === "local" || podeEditar);
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
    tipo: "servidor", email: limpar(d.user?.email), nome: d.user?.user_metadata?.nome || "",
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
    if (s.tipo !== "servidor" || Date.now() < s.expira - 60000) return;
    try {
      const { ok, dados } = await supabase("token?grant_type=refresh_token", { refresh_token: s.renovar });
      if (!ok) throw new Error();
      gravarSessao(sessaoSupabase(dados), s.lembrar);
    } catch {
      apagarSessao();
      aplicarSessao(null);
    }
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
      return concluir(sessaoSupabase(r.dados), lembrar);
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
      return concluir(sessaoSupabase(r.dados), true);
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
  }

  // Lista de clientes para o painel (sem as senhas)
  async function listarClientes() {
    const tirar = ({ sal, hash, sessao, ...c }) => c;
    if (naNuvem()) {
      const snap = await db.collection("contas").get();
      return snap.docs.map((d) => d.data()).filter((c) => c.hash).map(tirar);
    }
    if (estado.login.tipo === "teste") return Object.entries(contasLocais()).map(([email, c]) => tirar({ email, ...c }));
    return null; // no Supabase a lista fica em Authentication → Users
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

  conectar().then(() => {
    if (estado.modo !== "nuvem") return;
    if (estado.admin) ouvirAdminNuvem(); else registrarVisitaNuvem();
  }).catch(() => {});

  return {
    estado,
    ouvir(fn) { ouvintes.add(fn); fn(estado); return () => ouvintes.delete(fn); },
    reembolso,
    salvarProduto, apagarProduto, ajustarEstoque, salvarCategorias, salvarConfig,
    criarPedido, atualizarPedido, entrar, cadastrar, sair, recuperarSenha, listarClientes, novoId,
  };
})();
