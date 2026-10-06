(() => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);
  const fmt = new Intl.NumberFormat(LOJA.idioma, { style: "currency", currency: LOJA.moeda });
  const moeda = (v) => fmt.format(v);
  const escapar = (t) => String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const CHAVE = "carrinho-loja";

  // filtro: "ofertas" (padrão), "todos" ou o id de uma categoria
  const estado = { filtro: "ofertas", busca: "", carrinho: carregar() };

  function carregar() {
    try { return JSON.parse(localStorage.getItem(CHAVE)) || {}; } catch { return {}; }
  }
  function salvar() {
    try { localStorage.setItem(CHAVE, JSON.stringify(estado.carrinho)); } catch {}
  }

  const porId = (id) => PRODUTOS.find((p) => p.id === Number(id));
  const categoria = (id) => CATEGORIAS.find((c) => c.id === id);
  const desconto = (p) => (p.precoAntigo ? Math.round((1 - p.preco / p.precoAntigo) * 100) : 0);
  const img = (p) => `<img src="${escapar(p.imagem)}" alt="${escapar(p.nome)}" loading="lazy">`;

  /* Informações da loja */
  document.title = LOJA.nome;
  $("#nome-copy").textContent = LOJA.nome;
  $("#ano").textContent = new Date().getFullYear();
  $("#link-whats").href = `https://wa.me/${LOJA.whatsapp}`;

  /* Categorias: menu lateral e círculos */
  $("#lateral-cats").innerHTML = CATEGORIAS.map((c) =>
    `<a href="#ofertas" data-cat="${c.id}"><svg><use href="#i-${c.id}"/></svg>${escapar(c.nome)}</a>`).join("");
  $("#circulos").innerHTML = CATEGORIAS.filter((c) => c.imagem).map((c) => `
    <button class="circulo" data-cat="${c.id}">
      <span class="circulo__img"><img src="${escapar(c.imagem)}" alt=""></span>${escapar(c.nome)}
    </button>`).join("");

  document.addEventListener("click", (e) => {
    const cat = e.target.closest("[data-cat]");
    const todos = e.target.closest("[data-todos], #ver-todos");
    if (cat) {
      if (!cat.dataset.cat) { e.preventDefault(); filtrar("ofertas"); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
      filtrar(cat.dataset.cat);
      if (cat.tagName === "BUTTON") $("#ofertas").scrollIntoView({ behavior: "smooth" });
    } else if (todos) {
      filtrar("todos");
    }
  });

  function filtrar(f) {
    estado.filtro = f;
    $$(".lateral a").forEach((a) => a.classList.toggle("ativo", (a.dataset.cat || "ofertas") === f));
    $$(".circulo").forEach((b) => b.classList.toggle("ativo", b.dataset.cat === f));
    $("#titulo-ofertas").textContent =
      f === "ofertas" ? "Deals of the day" : f === "todos" ? "All products" : categoria(f).nome;
    $("#ver-todos").hidden = f === "todos";
    renderGrade();
  }

  /* Grade de produtos */
  function lista() {
    const termo = estado.busca.trim().toLowerCase();
    if (termo) {
      return PRODUTOS.filter((p) => `${p.nome} ${categoria(p.categoria).nome} ${p.descricao}`.toLowerCase().includes(termo));
    }
    if (estado.filtro === "ofertas") return PRODUTOS.filter((p) => p.oferta);
    if (estado.filtro === "todos") return PRODUTOS;
    return PRODUTOS.filter((p) => p.categoria === estado.filtro);
  }

  function precos(p) {
    return `<div class="card__precos"><strong>${moeda(p.preco)}</strong>${p.precoAntigo ? `<s>${moeda(p.precoAntigo)}</s>` : ""}${desconto(p) ? `<span class="selo">-${desconto(p)}%</span>` : ""}</div>`;
  }

  function renderGrade() {
    const itens = lista();
    $("#vazio").hidden = itens.length > 0;
    $("#grade").innerHTML = itens.map((p) => `
      <article class="card">
        <button class="card__img" data-ver="${p.id}" aria-label="View ${escapar(p.nome)}">${img(p)}</button>
        <div class="card__linha">
          <h3 class="card__nome">${escapar(p.nome)}</h3>
          <button class="add" data-add="${p.id}" aria-label="Add ${escapar(p.nome)} to cart"><svg><use href="#i-cart"/></svg></button>
        </div>
        ${precos(p)}
      </article>`).join("");
  }

  $("#grade").addEventListener("click", (e) => {
    const add = e.target.closest("[data-add]");
    const ver = e.target.closest("[data-ver]");
    if (add) adicionar(add.dataset.add);
    else if (ver) abrirProduto(ver.dataset.ver);
  });

  /* Busca e menu mobile */
  $("#abrir-busca").addEventListener("click", () => {
    const barra = $("#busca-barra");
    barra.hidden = !barra.hidden;
    if (!barra.hidden) $("#busca").focus();
  });
  let atraso;
  $("#busca").addEventListener("input", (e) => {
    clearTimeout(atraso);
    atraso = setTimeout(() => {
      estado.busca = e.target.value;
      $("#titulo-ofertas").textContent = estado.busca.trim() ? `Results for "${estado.busca.trim()}"` : "Deals of the day";
      renderGrade();
      if (estado.busca.trim()) $("#ofertas").scrollIntoView({ behavior: "smooth" });
    }, 250);
  });
  $("#abrir-menu").addEventListener("click", () => $("#menu").classList.toggle("aberto"));
  $("#menu").addEventListener("click", () => $("#menu").classList.remove("aberto"));

  /* Detalhe do produto */
  const modalProduto = $("#modal-produto");
  function abrirProduto(id) {
    const p = porId(id);
    $("#detalhe").innerHTML = `
      <div class="detalhe">
        <div class="detalhe__img">${img(p)}</div>
        <div>
          <span class="detalhe__cat">${escapar(categoria(p.categoria).nome)}</span>
          <h3>${escapar(p.nome)}</h3>
          ${precos(p)}
          <p>${escapar(p.descricao)}</p>
          <button class="btn btn--bloco" data-add-modal="${p.id}">Add to cart</button>
        </div>
      </div>`;
    modalProduto.showModal();
  }
  modalProduto.addEventListener("click", (e) => {
    const add = e.target.closest("[data-add-modal]");
    if (add) {
      adicionar(add.dataset.addModal);
      modalProduto.close();
    }
  });
  $$("dialog").forEach((d) => d.addEventListener("click", (e) => {
    if (e.target === d || e.target.closest("[data-fechar]")) d.close();
  }));

  /* Carrinho */
  function adicionar(id) {
    estado.carrinho[id] = (estado.carrinho[id] || 0) + 1;
    salvar();
    renderCarrinho();
    const c = $("#contador");
    c.classList.remove("pulse");
    void c.offsetWidth;
    c.classList.add("pulse");
    toast(`${porId(id).nome} added to cart`);
  }

  function alterar(id, delta) {
    const q = (estado.carrinho[id] || 0) + delta;
    if (q <= 0) delete estado.carrinho[id];
    else estado.carrinho[id] = q;
    salvar();
    renderCarrinho();
  }

  function totais() {
    const itens = Object.entries(estado.carrinho).map(([id, qtd]) => ({ p: porId(id), qtd })).filter((i) => i.p);
    const subtotal = itens.reduce((s, i) => s + i.p.preco * i.qtd, 0);
    const frete = subtotal === 0 || subtotal >= LOJA.freteGratisAcima ? 0 : LOJA.frete;
    const quantidade = itens.reduce((s, i) => s + i.qtd, 0);
    return { itens, subtotal, frete, total: subtotal + frete, quantidade };
  }

  function renderCarrinho() {
    const t = totais();
    $("#contador").textContent = t.quantidade;
    $("#carrinho-vazio").hidden = t.itens.length > 0;
    $("#resumo").hidden = t.itens.length === 0;
    $("#itens").innerHTML = t.itens.map(({ p, qtd }) => `
      <li class="item">
        <div class="item__img">${img(p)}</div>
        <div>
          <div class="item__nome">${escapar(p.nome)}</div>
          <div class="item__preco">${moeda(p.preco)}</div>
          <button class="remover" data-remover="${p.id}">Remove</button>
        </div>
        <div class="qtd">
          <button data-menos="${p.id}" aria-label="Decrease">−</button>
          <span>${qtd}</span>
          <button data-mais="${p.id}" aria-label="Increase">+</button>
        </div>
      </li>`).join("");
    $("#subtotal").textContent = moeda(t.subtotal);
    $("#frete").textContent = t.frete ? moeda(t.frete) : "Free";
    $("#total").textContent = moeda(t.total);
  }

  $("#itens").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.mais) alterar(b.dataset.mais, 1);
    if (b.dataset.menos) alterar(b.dataset.menos, -1);
    if (b.dataset.remover) alterar(b.dataset.remover, -Infinity);
  });

  const painel = $("#carrinho");
  function abrirCarrinho(abrir) {
    painel.classList.toggle("aberto", abrir);
    painel.setAttribute("aria-hidden", String(!abrir));
    $("#fundo").hidden = !abrir;
    document.body.style.overflow = abrir ? "hidden" : "";
  }
  $("#abrir-carrinho").addEventListener("click", () => abrirCarrinho(true));
  $("#fechar-carrinho").addEventListener("click", () => abrirCarrinho(false));
  $("#fundo").addEventListener("click", () => abrirCarrinho(false));
  document.addEventListener("keydown", (e) => e.key === "Escape" && abrirCarrinho(false));

  /* Checkout via WhatsApp */
  const modalCheckout = $("#modal-checkout");
  $("#finalizar").addEventListener("click", () => {
    $("#checkout-total").textContent = moeda(totais().total);
    abrirCarrinho(false);
    modalCheckout.showModal();
  });

  $("#form-checkout").addEventListener("submit", (e) => {
    e.preventDefault();
    const dados = Object.fromEntries(new FormData(e.target));
    const t = totais();
    const linhas = [
      `*New order — ${LOJA.nome}*`,
      "",
      ...t.itens.map(({ p, qtd }) => `• ${qtd}x ${p.nome} — ${moeda(p.preco * qtd)}`),
      "",
      `Subtotal: ${moeda(t.subtotal)}`,
      `Shipping: ${t.frete ? moeda(t.frete) : "Free"}`,
      `*Total: ${moeda(t.total)}*`,
      "",
      `Name: ${dados.nome}`,
      `Phone: ${dados.telefone}`,
      `Address: ${dados.endereco} — ZIP ${dados.cep}`,
      `Payment: ${dados.pagamento}`,
    ];
    window.open(`https://wa.me/${LOJA.whatsapp}?text=${encodeURIComponent(linhas.join("\n"))}`, "_blank");
    estado.carrinho = {};
    salvar();
    renderCarrinho();
    e.target.reset();
    modalCheckout.close();
    toast("Order sent! Thank you for shopping with us.");
  });

  /* Toast */
  let timerToast;
  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.add("visivel");
    clearTimeout(timerToast);
    timerToast = setTimeout(() => el.classList.remove("visivel"), 2400);
  }

  $("#logo").addEventListener("click", (e) => {
    e.preventDefault();
    filtrar("ofertas");
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  /* Aviso do Instagram: aparece ao entrar e minimiza para uma bolha */
  const CHAVE_INSTA = "insta-minimizado";
  const insta = $("#insta");
  const bolha = $("#insta-bolha");
  function mostrarInsta(aberto) {
    insta.hidden = !aberto;
    bolha.hidden = aberto;
    try { sessionStorage.setItem(CHAVE_INSTA, aberto ? "0" : "1"); } catch {}
  }
  $("#insta-fechar").addEventListener("click", () => mostrarInsta(false));
  bolha.addEventListener("click", () => mostrarInsta(true));
  let minimizado = false;
  try { minimizado = sessionStorage.getItem(CHAVE_INSTA) === "1"; } catch {}
  if (minimizado) bolha.hidden = false;
  else setTimeout(() => mostrarInsta(true), 1200);

  renderGrade();
  renderCarrinho();
})();
