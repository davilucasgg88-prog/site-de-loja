// Conexão com o Supabase (servidor da loja). Usada quando ACESSO.supabaseUrl e supabaseChave
// estão preenchidos. Oferece o mesmo jeito de ler e gravar que o resto do site já usa
// (doc(...).get/set/onSnapshot e collection(...).get/onSnapshot), em cima da tabela "docs"
// criada pelo supabase/schema.sql. Todo visitante ganha uma sessão anônima, para que as
// regras do banco deixem cada um gravar só os próprios pedidos, carrinhos e visitas.
const Supa = (() => {
  const url = () => String(ACESSO.supabaseUrl || "").replace(/\/+$/, "");
  const chave = () => ACESSO.supabaseChave;
  const ativo = () => !!(ACESSO.supabaseUrl && ACESSO.supabaseChave);
  const CHAVE_ANON = "tmz-sessao-anonima";

  let tokenAtual = () => chave();

  async function pedir(caminho, { metodo = "GET", corpo, token, cabecalhos = {} } = {}) {
    const r = await fetch(url() + caminho, {
      method: metodo,
      headers: {
        apikey: chave(),
        Authorization: "Bearer " + (token || (await tokenAtual())),
        ...(corpo !== undefined ? { "Content-Type": "application/json" } : {}),
        ...cabecalhos,
      },
      body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
    });
    const texto = await r.text();
    let dados = null;
    try { dados = texto ? JSON.parse(texto) : null; } catch { dados = texto; }
    if (!r.ok) {
      const erro = new Error((dados && (dados.message || dados.msg || dados.error_description)) || `Erro ${r.status}`);
      erro.status = r.status;
      erro.dados = dados;
      throw erro;
    }
    return dados;
  }

  /* ---------- sessão anônima ---------- */
  function lerAnon() { try { return JSON.parse(localStorage.getItem(CHAVE_ANON)); } catch { return null; } }
  function gravarAnon(s) { try { localStorage.setItem(CHAVE_ANON, JSON.stringify(s)); } catch {} }
  const sessaoDe = (d) => ({ token: d.access_token, renovar: d.refresh_token, expira: Date.now() + d.expires_in * 1000, uid: d.user?.id, email: d.user?.email || "" });

  async function sessaoAnonima() {
    let s = lerAnon();
    if (s && Date.now() < s.expira - 60000) return s;
    if (s?.renovar) {
      try {
        s = sessaoDe(await pedir("/auth/v1/token?grant_type=refresh_token", { metodo: "POST", corpo: { refresh_token: s.renovar }, token: chave() }));
        gravarAnon(s);
        return s;
      } catch {}
    }
    // Precisa de "Allow anonymous sign-ins" ligado em Authentication → Sign In / Providers
    s = sessaoDe(await pedir("/auth/v1/signup", { metodo: "POST", corpo: { data: {} }, token: chave() }));
    gravarAnon(s);
    return s;
  }

  /* ---------- documentos ---------- */
  const separar = (caminho) => { const [colecao, ...resto] = caminho.split("/"); return [colecao, resto.join("/")]; };
  const enc = encodeURIComponent;
  const vigias = new Set(); // atualizações periódicas ativas (para desligar ao trocar de conta)

  function vigiar(buscar, fn, aoErrar, intervalo) {
    let ultimo = "";
    let vivo = true;
    async function rodar() {
      if (!vivo) return;
      try {
        const snap = await buscar();
        const marca = JSON.stringify(snap._marca);
        if (marca !== ultimo) { ultimo = marca; fn(snap); }
      } catch (e) { aoErrar?.(e); }
    }
    rodar();
    const t = setInterval(() => { if (document.visibilityState === "visible") rodar(); }, intervalo);
    const visivel = () => { if (document.visibilityState === "visible") rodar(); };
    document.addEventListener("visibilitychange", visivel);
    const parar = () => { vivo = false; clearInterval(t); document.removeEventListener("visibilitychange", visivel); vigias.delete(vigia); };
    const vigia = { parar, rodar };
    vigias.add(vigia);
    return parar;
  }
  // Depois de gravar, atualiza na hora quem está vigiando
  const atualizarTudo = () => vigias.forEach((v) => v.rodar());

  const banco = {
    doc(caminho) {
      const [colecao, id] = separar(caminho);
      const buscar = async () => {
        const linhas = await pedir(`/rest/v1/docs?colecao=eq.${enc(colecao)}&id=eq.${enc(id)}&select=dados,atualizado`);
        const linha = linhas[0];
        return { exists: !!linha, data: () => linha?.dados, _marca: linha?.atualizado || null };
      };
      return {
        get: buscar,
        async set(dados) {
          await pedir("/rest/v1/docs?on_conflict=colecao,id", {
            metodo: "POST", corpo: { colecao, id, dados },
            cabecalhos: { Prefer: "resolution=merge-duplicates,return=minimal" },
          });
          atualizarTudo();
        },
        async delete() {
          await pedir(`/rest/v1/docs?colecao=eq.${enc(colecao)}&id=eq.${enc(id)}`, { metodo: "DELETE", cabecalhos: { Prefer: "return=minimal" } });
          atualizarTudo();
        },
        onSnapshot(fn, aoErrar) { return vigiar(buscar, fn, aoErrar, 20000); },
      };
    },
    collection(colecao) {
      const buscar = async () => {
        const linhas = await pedir(`/rest/v1/docs?colecao=eq.${enc(colecao)}&select=id,dados,atualizado&order=id`);
        return {
          empty: !linhas.length,
          docs: linhas.map((l) => ({ id: l.id, data: () => l.dados })),
          _marca: linhas.map((l) => l.id + l.atualizado),
        };
      };
      return { get: buscar, onSnapshot(fn, aoErrar) { return vigiar(buscar, fn, aoErrar, 15000); } };
    },
    fechar() { [...vigias].forEach((v) => v.parar()); },
  };

  // Funções do servidor (Edge Functions): pagamento online
  async function funcao(nome, corpo) {
    return pedir(`/functions/v1/${nome}`, { metodo: "POST", corpo });
  }
  async function rpc(nome, args) {
    return pedir(`/rest/v1/rpc/${nome}`, { metodo: "POST", corpo: args });
  }

  return {
    ativo, pedir, sessaoAnonima, banco, funcao, rpc,
    usarToken(fn) { tokenAtual = fn; },
  };
})();
