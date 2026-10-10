// Tela de entrar / cadastrar (#entrar). A mesma tela aparece no painel quando o dono ainda não entrou.
const Conta = (() => {
  const { escapar, toast, linkWhats } = window.TMZ;
  const S = Dados.estado;
  const $ = (sel, raiz = document) => raiz.querySelector(sel);
  const ligados = new WeakSet();
  let aba = "entrar";

  function redes() {
    const c = S.config;
    return [
      [c.instagram, "Instagram", "i-instagram"],
      [c.tiktok, "TikTok", "i-tiktok"],
      [c.facebook, "Facebook", "i-facebook"],
      [c.whatsapp && linkWhats(), "WhatsApp", "i-whatsapp"],
      [c.email && "mailto:" + c.email, "E-mail", "i-email"],
    ].filter(([url]) => url);
  }

  const olho = `<button type="button" data-ver-senha aria-label="Mostrar senha" aria-pressed="false"><svg><use href="#i-olho-off"/></svg></button>`;

  function formEntrar(painel) {
    const c = S.config;
    return `
      <h1>Bem-vindo de volta!</h1>
      <p class="login__sub">${painel ? "Área exclusiva do lojista TMZ." : `Não tem conta? <button type="button" class="login__troca" data-aba-login="cadastrar">Cadastre-se</button>`}</p>
      <form class="login__form" data-form="entrar" novalidate>
        <label class="login__campo"><span>E-mail</span>
          <input name="email" type="email" autocomplete="username" placeholder="seuemail@gmail.com" required>
        </label>
        <label class="login__campo"><span>Senha</span>
          <span class="login__senha"><input name="senha" type="password" autocomplete="current-password" placeholder="••••••" required>${olho}</span>
        </label>
        <div class="login__linha">
          <label class="login__lembrar"><input type="checkbox" name="lembrar"><span>Lembrar de mim</span></label>
          <button type="button" class="login__esqueci" data-esqueci>Esqueci a senha</button>
        </div>
        <p class="login__erro" role="alert" hidden></p>
        <button class="login__entrar">Entrar</button>
      </form>
      ${S.login.tipo === "teste" ? `<p class="login__teste">Modo de teste. Lojista: <b>${escapar(S.login.email)}</b> com ${String(c.pinPainel) === "1234" ? "a senha <b>1234</b>" : "a senha de teste"}. Clientes criam a conta em Cadastre-se.</p>` : ""}`;
  }

  function formCadastrar() {
    return `
      <h1>Crie sua conta!</h1>
      <p class="login__sub">Já tem conta? <button type="button" class="login__troca" data-aba-login="entrar">Entrar</button></p>
      <form class="login__form" data-form="cadastrar" novalidate>
        <label class="login__campo"><span>Nome</span>
          <input name="nome" autocomplete="name" placeholder="Seu nome" required>
        </label>
        <div class="login__dupla">
          <label class="login__campo"><span>E-mail</span>
            <input name="email" type="email" autocomplete="email" placeholder="seuemail@gmail.com" required>
          </label>
          <label class="login__campo"><span>WhatsApp <em>opcional</em></span>
            <input name="whats" type="tel" inputmode="tel" autocomplete="tel" placeholder="(00) 00000-0000">
          </label>
        </div>
        <label class="login__campo"><span>Senha</span>
          <span class="login__senha"><input name="senha" type="password" autocomplete="new-password" placeholder="Pelo menos 6 caracteres" minlength="6" required>${olho}</span>
        </label>
        <label class="login__campo"><span>Confirmar senha</span>
          <input name="senha2" type="password" autocomplete="new-password" placeholder="Repita a senha" required>
        </label>
        <p class="login__erro" role="alert" hidden></p>
        <button class="login__entrar">Criar conta</button>
      </form>`;
  }

  function logado(painel) {
    const conta = S.conta;
    const primeiro = escapar((conta.nome || conta.email).split(" ")[0]);
    if (painel && !conta.admin) {
      return `
        <h1>Sem acesso</h1>
        <p class="login__sub">Você entrou como <b>${escapar(conta.email)}</b>.</p>
        <p class="login__aviso">O painel é só do lojista TMZ. Para gerenciar a loja, saia e entre com o login do dono.</p>
        <div class="login__acoes">
          <button type="button" class="login__entrar" data-sair-conta>Sair e trocar de conta</button>
          <a href="#" class="login__secundario">Voltar à loja</a>
        </div>`;
    }
    return `
      <h1>Olá, ${primeiro}!</h1>
      <p class="login__sub">${escapar(conta.email)}${conta.admin ? " · Lojista" : ""}</p>
      <div class="login__acoes">
        ${conta.admin ? `<a href="#painel" class="login__entrar">Abrir o painel</a>` : `<button type="button" class="login__entrar" data-comprar>Comprar agora</button>`}
        <a href="#reservas" class="login__secundario">Minhas reservas</a>
        <button type="button" class="login__secundario" data-sair-conta>Sair da conta</button>
      </div>`;
  }

  function montar(raiz, { painel = false } = {}) {
    const lista = redes();
    raiz.innerHTML = `
      <div class="login">
        <header class="login__topo">
          <a href="#" class="login__marca"><img src="img/logo-tmz.png" alt="TMZ" width="70" height="20"><span>Store</span></a>
          <nav class="login__menu" aria-label="Loja">
            <a href="#">Início</a><a href="#catalogo">Catálogo</a><a href="#medidas">Medidas</a>
          </nav>
        </header>
        <div class="login__corpo">
          <div class="login__lado">
            ${S.conta ? logado(painel) : aba === "cadastrar" && !painel ? formCadastrar() : formEntrar(painel)}
          </div>
          <div class="login__arte" aria-hidden="true">
            <div class="login__circulo"><img src="img/logo-tmz.png" alt="" width="220" height="62"></div>
            <p>A loja que veste o povo</p>
          </div>
        </div>
        ${lista.length ? `
          <ul class="login__redes" aria-label="Redes sociais">
            ${lista.map(([url, nome, icone]) => `<li><a href="${escapar(url)}" ${url.startsWith("mailto:") ? "" : 'target="_blank" rel="noopener"'} aria-label="${nome}" title="${nome}"><svg><use href="#${icone}"/></svg></a></li>`).join("")}
          </ul>` : ""}
      </div>`;
    raiz.dataset.painel = painel ? "1" : "";
    $(".login__form input", raiz)?.focus({ preventScroll: true });
    if (!ligados.has(raiz)) { ligados.add(raiz); ligar(raiz); }
  }

  function mensagem(raiz, texto, ok) {
    const p = $(".login__erro", raiz);
    if (!p) return;
    p.textContent = texto;
    p.classList.toggle("login__erro--ok", !!ok);
    p.hidden = !texto;
  }

  function ligar(raiz) {
    raiz.addEventListener("click", async (e) => {
      const t = e.target;
      const painel = raiz.dataset.painel === "1";
      const troca = t.closest("[data-aba-login]");
      if (troca) { aba = troca.dataset.abaLogin; return montar(raiz, { painel }); }
      const ver = t.closest("[data-ver-senha]");
      if (ver) {
        const campo = ver.previousElementSibling;
        const mostrar = campo.type === "password";
        raiz.querySelectorAll('input[name^="senha"]').forEach((i) => { i.type = mostrar ? "text" : "password"; });
        ver.setAttribute("aria-pressed", mostrar);
        ver.setAttribute("aria-label", mostrar ? "Esconder senha" : "Mostrar senha");
        ver.querySelector("use").setAttribute("href", mostrar ? "#i-olho" : "#i-olho-off");
        return campo.focus();
      }
      if (t.closest("[data-esqueci]")) {
        const r = await Dados.recuperarSenha($('input[name="email"]', raiz).value);
        return mensagem(raiz, r.ok ? r.msg : r.erro, r.ok || S.login.tipo === "teste");
      }
      if (t.closest("[data-sair-conta]")) {
        Dados.sair();
        aba = "entrar";
        toast("Você saiu da conta");
        return montar(raiz, { painel });
      }
      if (t.closest("[data-comprar]")) {
        location.hash = "";
        setTimeout(() => document.querySelector("[data-abrir-procura]")?.click(), 50);
      }
    });

    raiz.addEventListener("submit", async (e) => {
      const f = e.target.closest("[data-form]");
      if (!f) return;
      e.preventDefault();
      const painel = raiz.dataset.painel === "1";
      const d = Object.fromEntries(new FormData(f));
      const botao = f.querySelector(".login__entrar");
      const vazio = [...f.querySelectorAll("[required]")].find((i) => !i.value.trim());
      if (vazio) { mensagem(raiz, "Preencha todos os campos."); return vazio.focus(); }
      if (f.dataset.form === "cadastrar" && d.senha !== d.senha2) {
        mensagem(raiz, "As senhas não são iguais.");
        return f.elements.senha2.select();
      }
      const texto = botao.textContent;
      botao.disabled = true;
      botao.textContent = f.dataset.form === "entrar" ? "Entrando…" : "Criando conta…";
      const r = f.dataset.form === "entrar"
        ? await Dados.entrar(d.email, d.senha, !!d.lembrar)
        : await Dados.cadastrar(d);
      botao.disabled = false;
      botao.textContent = texto;
      if (!r.ok) {
        mensagem(raiz, r.erro);
        f.elements.senha.select();
        return;
      }
      if (r.confirmar) { aba = "entrar"; montar(raiz, { painel }); return mensagem(raiz, r.msg, true); }
      if (r.aviso) toast(r.aviso);
      aba = "entrar";
      if (painel) return; // o painel se redesenha sozinho quando o dono entra
      if (S.conta.admin) { location.hash = "painel"; return; }
      toast(`Bem-vindo, ${(S.conta.nome || "").split(" ")[0] || "cliente"}!`);
      montar(raiz, { painel });
    });
  }

  // tela #entrar
  const tela = document.getElementById("tela-entrar");
  let aberta = false;
  window.addEventListener("tmz:rota", (e) => {
    aberta = e.detail === "entrar";
    if (aberta) montar(tela);
  });
  if (location.hash === "#entrar") { aberta = true; montar(tela); }
  let contaAntes = JSON.stringify(S.conta);
  Dados.ouvir(() => {
    const agora = JSON.stringify(S.conta);
    if (agora === contaAntes) return;
    contaAntes = agora;
    if (aberta && !tela.contains(document.activeElement)) montar(tela);
  });

  return { montar };
})();
