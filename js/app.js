(() => {
  const $ = (s) => document.querySelector(s);
  const moeda = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const escapar = (t) => String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const CHAVE = "carrinho-loja";

  const estado = {
    categoria: "Todos",
    busca: "",
    ordem: "relevancia",
    carrinho: carregar(),
  };

  function carregar() {
    try { return JSON.parse(localStorage.getItem(CHAVE)) || {}; } catch { return {}; }
  }
  function salvar() {
    try { localStorage.setItem(CHAVE, JSON.stringify(estado.carrinho)); } catch {}
  }

  const porId = (id) => PRODUTOS.find((p) => p.id === Number(id));
  const visual = (p) => p.imagem
    ? `<img src="${escapar(p.imagem)}" alt="${escapar(p.nome)}" loading="lazy">`
    : `<span aria-hidden="true">${p.emoji || "📦"}</span>`;
  const desconto = (p) => p.precoAntigo ? Math.round((1 - p.preco / p.precoAntigo) * 100) : 0;

  /* Informações da loja */
  document.title = LOJA.nome;
  ["#nome-loja", "#nome-rodape", "#nome-copy"].forEach((s) => ($(s).textContent = LOJA.nome));
  $("#ano").textContent = new Date().getFullYear();
  $("#frete-gratis").textContent = moeda(LOJA.freteGratisAcima);
  $("#link-whats").href = `https://wa.me/${LOJA.whatsapp}`;

  /* Categorias */
  const categorias = ["Todos", ...new Set(PRODUTOS.map((p) => p.categoria))];
  function renderCategorias() {
    $("#categorias").innerHTML = categorias
      .map((c) => `<button role="tab" aria-selected="${c === estado.categoria}" data-cat="${escapar(c)}">${escapar(c)}</button>`)
      .join("");
  }
  $("#categorias").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    estado.categoria = b.dataset.cat;
    renderCategorias();
    renderGrade();
  });

  /* Grade de produtos */
  function filtrados() {
    const termo = estado.busca.trim().toLowerCase();
    let lista = PRODUTOS.filter((p) =>
      (estado.categoria === "Todos" || p.categoria === estado.categoria) &&
      (!termo || `${p.nome} ${p.categoria} ${p.descricao}`.toLowerCase().includes(termo))
    );
    const ordens = {
      menor: (a, b) => a.preco - b.preco,
      maior: (a, b) => b.preco - a.preco,
      nome: (a, b) => a.nome.localeCompare(b.nome, "pt-BR"),
      relevancia: (a, b) => (b.destaque ? 1 : 0) - (a.destaque ? 1 : 0),
    };
    return [...lista].sort(ordens[estado.ordem]);
  }

  function precoHTML(p) {
    return `<div class="preco"><strong>${moeda(p.preco)}</strong>${p.precoAntigo ? `<s>${moeda(p.precoAntigo)}</s>` : ""}</div>
      <span class="parcela">ou 6x de ${moeda(p.preco / 6)} sem juros</span>`;
  }

  function renderGrade() {
    const lista = filtrados();
    $("#vazio").hidden = lista.length > 0;
    $("#grade").innerHTML = lista.map((p) => `
      <article class="card">
        <button class="card__img" data-ver="${p.id}" aria-label="Ver ${escapar(p.nome)}">
          ${visual(p)}
          ${desconto(p) ? `<span class="selo">-${desconto(p)}%</span>` : ""}
        </button>
        <div class="card__info">
          <span class="card__cat">${escapar(p.categoria)}</span>
          <h3 class="card__nome">${escapar(p.nome)}</h3>
          ${precoHTML(p)}
          <button class="btn btn--primario" data-add="${p.id}">Adicionar</button>
        </div>
      </article>`).join("");
  }

  $("#grade").addEventListener("click", (e) => {
    const add = e.target.closest("[data-add]");
    const ver = e.target.closest("[data-ver]");
    if (add) adicionar(add.dataset.add);
    else if (ver) abrirProduto(ver.dataset.ver);
  });

  let atraso;
  $("#busca").addEventListener("input", (e) => {
    clearTimeout(atraso);
    atraso = setTimeout(() => {
      estado.busca = e.target.value;
      renderGrade();
    }, 150);
  });
  $("#ordenar").addEventListener("change", (e) => {
    estado.ordem = e.target.value;
    renderGrade();
  });

  /* Detalhe do produto */
  const modalProduto = $("#modal-produto");
  function abrirProduto(id) {
    const p = porId(id);
    $("#detalhe").innerHTML = `
      <div class="detalhe">
        <div class="card__img">${visual(p)}${desconto(p) ? `<span class="selo">-${desconto(p)}%</span>` : ""}</div>
        <div>
          <span class="card__cat">${escapar(p.categoria)}</span>
          <h2>${escapar(p.nome)}</h2>
          ${precoHTML(p)}
          <p>${escapar(p.descricao)}</p>
          <button class="btn btn--primario btn--bloco" data-add-modal="${p.id}">Adicionar ao carrinho</button>
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

  document.querySelectorAll("dialog").forEach((d) => {
    d.addEventListener("click", (e) => {
      if (e.target === d || e.target.closest("[data-fechar]")) d.close();
    });
  });

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
    const itens = Object.entries(estado.carrinho)
      .map(([id, qtd]) => ({ p: porId(id), qtd }))
      .filter((i) => i.p);
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
        <div class="item__img">${visual(p)}</div>
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

  /* Checkout */
  const modalCheckout = $("#modal-checkout");
  $("#finalizar").addEventListener("click", () => {
    $("#checkout-total").textContent = moeda(totais().total);
    abrirCarrinho(false);
    modalCheckout.showModal();
  });

  $("#form-checkout").cep.addEventListener("input", (e) => {
    const d = e.target.value.replace(/\D/g, "").slice(0, 8);
    e.target.value = d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
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
    toast("Pedido enviado! Obrigado pela compra 💜");
  });

  /* Newsletter */
  $("#form-news").addEventListener("submit", (e) => {
    e.preventDefault();
    e.target.reset();
    toast("Cadastro feito! Fique de olho no seu e-mail.");
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
    window.scrollTo({ top: 0 });
  });

  renderCategorias();
  renderGrade();
  renderCarrinho();
})();
