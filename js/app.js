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
  const qtdPorCategoria = (id) => PRODUTOS.filter((p) => p.categoria === id).length;
  $("#circulos").innerHTML = CATEGORIAS.filter((c) => c.imagem).map((c) => {
    const qtd = qtdPorCategoria(c.id);
    return `
    <button class="circulo" data-cat="${c.id}">
      <span class="circulo__anel">
        <span class="circulo__img"><img src="${escapar(c.imagem)}" alt=""></span>
        <span class="circulo__ir" aria-hidden="true"><svg><use href="#i-arrow"/></svg></span>
      </span>
      <span class="circulo__nome">${escapar(c.nome)}</span>
      <span class="circulo__qtd">${qtd} ${qtd === 1 ? "produto" : "produtos"}</span>
    </button>`;
  }).join("");

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
      f === "ofertas" ? "Ofertas do dia" : f === "todos" ? "Todos os produtos" : categoria(f).nome;
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
        <button class="card__img" data-ver="${p.id}" aria-label="Ver ${escapar(p.nome)}">${img(p)}</button>
        <div class="card__linha">
          <h3 class="card__nome">${escapar(p.nome)}</h3>
          <button class="add" data-add="${p.id}" aria-label="Adicionar ${escapar(p.nome)} ao carrinho"><svg><use href="#i-cart"/></svg></button>
        </div>
        ${precos(p)}
        ${p.estoque > 0 && p.estoque <= 5 ? `<span class="card__estoque">Últimas ${p.estoque} peças</span>` : ""}
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
      $("#titulo-ofertas").textContent = estado.busca.trim() ? `Resultados para "${estado.busca.trim()}"` : "Ofertas do dia";
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
          <button class="btn btn--bloco" data-add-modal="${p.id}">Adicionar ao carrinho</button>
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
    toast(`${porId(id).nome} adicionado ao carrinho`);
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
          <button class="remover" data-remover="${p.id}">Remover</button>
        </div>
        <div class="qtd">
          <button data-menos="${p.id}" aria-label="Diminuir">−</button>
          <span>${qtd}</span>
          <button data-mais="${p.id}" aria-label="Aumentar">+</button>
        </div>
      </li>`).join("");
    $("#subtotal").textContent = moeda(t.subtotal);
    $("#frete").textContent = t.frete ? moeda(t.frete) : "Grátis";
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
      `*Novo pedido — ${LOJA.nome}*`,
      "",
      ...t.itens.map(({ p, qtd }) => `• ${qtd}x ${p.nome} — ${moeda(p.preco * qtd)}`),
      "",
      `Subtotal: ${moeda(t.subtotal)}`,
      `Frete: ${t.frete ? moeda(t.frete) : "Grátis"}`,
      `*Total: ${moeda(t.total)}*`,
      "",
      `Nome: ${dados.nome}`,
      `Telefone: ${dados.telefone}`,
      `Endereço: ${dados.endereco} — CEP ${dados.cep}`,
      `Pagamento: ${dados.pagamento}`,
    ];
    window.open(`https://wa.me/${LOJA.whatsapp}?text=${encodeURIComponent(linhas.join("\n"))}`, "_blank");
    estado.carrinho = {};
    salvar();
    renderCarrinho();
    e.target.reset();
    modalCheckout.close();
    toast("Pedido enviado! Obrigado por comprar na TMZ.");
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

  /* Faixa de avisos no topo */
  const avisos = [
    `Frete grátis acima de ${moeda(LOJA.freteGratisAcima)}`,
    "Peças peruanas de primeira linha",
    "Enviamos para todo o Brasil",
    "Siga @tmz_storee",
  ];
  const linhaAvisos = avisos.map((a) => `<span>${escapar(a)}</span>`).join("");
  $("#faixa").innerHTML = `<div>${linhaAvisos}</div><div aria-hidden="true">${linhaAvisos}</div>`;

  /* Compre agora: "O que você procura?" com estoque por categoria */
  const modalProcura = $("#modal-procura");
  function estoqueCategoria(id) {
    const itens = PRODUTOS.filter((p) => p.categoria === id);
    return { itens: itens.length, estoque: itens.reduce((s, p) => s + (p.estoque || 0), 0) };
  }
  function abrirProcura() {
    const dados = CATEGORIAS.map((c) => ({ c, ...estoqueCategoria(c.id) }));
    const maior = Math.max(1, ...dados.map((d) => d.estoque));
    $("#procura-grade").innerHTML = dados.map(({ c, itens, estoque }) => {
      const vazio = estoque === 0;
      const visual = c.imagem ? `<img src="${escapar(c.imagem)}" alt="" loading="lazy">` : `<svg class="opcao__icone"><use href="#i-${c.id}"/></svg>`;
      const info = vazio
        ? `<span class="opcao__status">${itens === 0 ? "Em breve" : "Esgotado"}</span>`
        : `<span class="opcao__qtd"><strong>${estoque}</strong> ${estoque === 1 ? "peça" : "peças"}</span>
           <span class="opcao__nivel" style="--n:${Math.max(6, (estoque / maior) * 100)}%"></span>`;
      return `
        <button type="button" class="opcao${vazio ? " opcao--vazio" : ""}${!vazio && estoque <= 5 ? " opcao--baixo" : ""}" data-procura="${c.id}" ${vazio ? "disabled" : ""}
          aria-label="${escapar(c.nome)}: ${vazio ? (itens === 0 ? "em breve" : "esgotado") : `${estoque} em estoque`}">
          ${visual}
          <span class="opcao__seta" aria-hidden="true"><svg><use href="#i-arrow"/></svg></span>
          <span class="opcao__corpo">
            <span class="opcao__nome">${escapar(c.nome)}</span>
            ${info}
          </span>
        </button>`;
    }).join("");
    modalProcura.showModal();
  }
  $("#compre-agora").addEventListener("click", abrirProcura);
  modalProcura.addEventListener("click", (e) => {
    const opcao = e.target.closest("[data-procura]");
    if (!opcao || opcao.disabled) return;
    modalProcura.close();
    filtrar(opcao.dataset.procura);
    $("#ofertas").scrollIntoView({ behavior: "smooth" });
  });

  /* Avaliações */
  function estrelas(n) {
    return Array.from({ length: 5 }, (_, i) =>
      `<svg class="${i < Math.round(n) ? "" : "apagada"}"><use href="#i-estrela"/></svg>`).join("");
  }
  function iniciais(nome) {
    return nome.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  }
  function cartaoComentario(c) {
    return `
      <article class="depo">
        <svg class="depo__aspas" aria-hidden="true"><use href="#i-aspas"/></svg>
        <span class="estrelas" role="img" aria-label="Nota ${c.nota} de 5">${estrelas(c.nota)}</span>
        <p class="depo__texto">${escapar(c.texto)}</p>
        ${c.produto ? `<span class="depo__produto">${escapar(c.produto)}</span>` : ""}
        <div class="depo__autor">
          <span class="depo__avatar" aria-hidden="true">${escapar(iniciais(c.nome))}</span>
          <div><div class="depo__nome">${escapar(c.nome)}</div><div class="depo__cidade">${escapar(c.cidade || "")}</div></div>
        </div>
      </article>`;
  }
  function renderComentarios() {
    const lista = typeof COMENTARIOS === "undefined" ? [] : COMENTARIOS;
    if (!lista.length) { $("#comentarios").hidden = true; return; }
    const media = lista.reduce((s, c) => s + c.nota, 0) / lista.length;
    $("#placar-media").textContent = media.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    $("#placar-estrelas").innerHTML = estrelas(media);
    $("#placar-total").textContent = `${lista.length} ${lista.length === 1 ? "avaliação" : "avaliações"}`;
    $("#placar-barras").innerHTML = [5, 4, 3, 2, 1].map((n) => {
      const qtd = lista.filter((c) => c.nota === n).length;
      return `<li><span>${n}</span><i style="--p:${(qtd / lista.length) * 100}%"></i><span>${qtd}</span></li>`;
    }).join("");
    $("#aviso-exemplo").hidden = !lista.some((c) => c.exemplo);

    // Duas esteiras em sentidos opostos; cada trilho é duplicado para o loop não ter emenda
    const metade = Math.ceil(lista.length / 2);
    [[lista.slice(0, metade), "#esteira-1"], [lista.slice(metade).length ? lista.slice(metade) : lista, "#esteira-2"]]
      .forEach(([itens, alvo]) => {
        const cartoes = itens.map(cartaoComentario).join("");
        const el = $(alvo);
        el.innerHTML = `<div class="esteira__trilho">${cartoes}</div><div class="esteira__trilho" aria-hidden="true">${cartoes}</div>`;
        el.style.setProperty("--duracao", `${Math.max(itens.length, 3) * 15}s`);
      });
  }
  // Brilho que acompanha o mouse nos cartões
  $("#comentarios").addEventListener("pointermove", (e) => {
    const card = e.target.closest(".depo");
    if (!card) return;
    const r = card.getBoundingClientRect();
    card.style.setProperty("--x", `${e.clientX - r.left}px`);
    card.style.setProperty("--y", `${e.clientY - r.top}px`);
  });
  $("#link-avaliar").href = LOJA.instagram;
  renderComentarios();

  /* CEP com máscara */
  $("#form-checkout").cep.addEventListener("input", (e) => {
    const d = e.target.value.replace(/\D/g, "").slice(0, 8);
    e.target.value = d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
  });

  /* Aviso do Instagram: abre centralizado ao entrar; o X fecha e deixa uma bolha para reabrir */
  const CHAVE_INSTA = "insta-minimizado";
  const insta = $("#insta");
  const bolha = $("#insta-bolha");
  function mostrarInsta(aberto) {
    insta.hidden = !aberto;
    $("#insta-fundo").hidden = !aberto;
    bolha.hidden = aberto;
    document.body.style.overflow = aberto ? "hidden" : "";
    if (aberto) $("#insta-fechar").focus();
    try { sessionStorage.setItem(CHAVE_INSTA, aberto ? "0" : "1"); } catch {}
  }
  $("#insta-fechar").addEventListener("click", () => mostrarInsta(false));
  bolha.addEventListener("click", () => mostrarInsta(true));
  let minimizado = false;
  try { minimizado = sessionStorage.getItem(CHAVE_INSTA) === "1"; } catch {}
  if (minimizado) bolha.hidden = false;
  else setTimeout(() => mostrarInsta(true), 2500);

  renderGrade();
  renderCarrinho();
})();
