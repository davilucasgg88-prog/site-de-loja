(() => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);
  const S = Dados.estado;
  const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const moeda = (v) => fmt.format(Number(v) || 0);
  const centavos = (v) => Math.round((Number(v) || 0) * 100) / 100;
  const escapar = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const hora = (ms) => new Date(ms).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const dataHora = (ms) => new Date(ms).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const digitos = (t) => String(t || "").replace(/\D/g, "");
  const CHAVE_CARRINHO = "carrinho-loja";

  const estado = { filtro: "todos", busca: "", carrinho: lerCarrinho(), modo: "compra", ultimoPedido: null, cupom: lerCupom(), destino: null };

  // Cupom escolhido: vem do link (?cupom=CODIGO) ou do campo na finalização
  function lerCupom() {
    const doLink = Cupons.limpar(new URLSearchParams(location.search).get("cupom"));
    if (doLink) { try { sessionStorage.setItem("tmz-cupom", doLink); } catch {} return doLink; }
    try { return sessionStorage.getItem("tmz-cupom") || ""; } catch { return ""; }
  }
  function guardarCupom(codigo) {
    estado.cupom = codigo;
    try { codigo ? sessionStorage.setItem("tmz-cupom", codigo) : sessionStorage.removeItem("tmz-cupom"); } catch {}
  }

  function lerCarrinho() {
    try { return JSON.parse(localStorage.getItem(CHAVE_CARRINHO)) || {}; } catch { return {}; }
  }
  let avisoCarrinho = null;
  function gravarCarrinho() {
    try { localStorage.setItem(CHAVE_CARRINHO, JSON.stringify(estado.carrinho)); } catch {}
    // registra o carrinho para o painel (espera parar de mexer para não gravar a cada clique)
    clearTimeout(avisoCarrinho);
    avisoCarrinho = setTimeout(() => {
      Dados.registrarCarrinho(itensCarrinho().map(({ p, qtd }) => ({ id: p.id, nome: p.nome, preco: p.preco, qtd })));
    }, 700);
  }

  /* ---------- consultas ---------- */
  const porId = (id) => S.produtos.find((p) => p.id === String(id));
  const categoria = (id) => S.categorias.find((c) => c.id === id) || { id, nome: id || "Outros" };
  const iconeCat = (id) => (document.getElementById("i-" + id) ? id : "tag");
  const imagemCat = (c) => c.imagem || S.produtos.find((p) => p.categoria === c.id && p.imagem)?.imagem || "";
  const desconto = (p) => (p.precoAntigo > p.preco ? Math.round((1 - p.preco / p.precoAntigo) * 100) : 0);
  const estoque = (p) => Math.max(0, Number(p?.estoque) || 0);
  const img = (p) => (p.imagem ? `<img src="${escapar(p.imagem)}" alt="${escapar(p.nome)}" loading="lazy">` : `<svg class="sem-foto"><use href="#i-${iconeCat(p.categoria)}"/></svg>`);
  const linkWhats = (texto) => `https://wa.me/${digitos(S.config.whatsapp)}${texto ? "?text=" + encodeURIComponent(texto) : ""}`;

  /* ---------- textos editáveis ---------- */
  function renderTextos() {
    const c = S.config;
    document.title = c.nome || "TMZ STORE";
    const linhas = [c.linha1, c.linha2, c.linha3].filter(Boolean).map((l) => {
      const seguro = escapar(l);
      const vazada = (c.vazada || "").trim();
      if (!vazada) return seguro;
      const i = l.toLowerCase().lastIndexOf(vazada.toLowerCase());
      return i < 0 ? seguro : escapar(l.slice(0, i)) + `<span>${escapar(l.slice(i, i + vazada.length))}</span>` + escapar(l.slice(i + vazada.length));
    });
    $("#hero-titulo").innerHTML = linhas.join("<br>");
    $("#hero-sub").textContent = c.sub || "";
    $("#hero-texto").textContent = c.texto || "";
    $("#hero-botao").textContent = c.botao || "Compre agora";
    $("#banner-tag").textContent = c.bannerTag || "";
    $("#banner-titulo").textContent = c.bannerTitulo || "";
    $("#banner-sub").textContent = c.bannerSub || "";
    $("#banner-texto").textContent = c.bannerTexto || "";
    $("#banner-botao").textContent = c.bannerBotao || "Ver ofertas";
    $("#link-whats").href = linkWhats();
    $("#link-avaliar").href = c.instagram || "#";
    const redes = [
      [c.instagram, "Instagram"], [c.tiktok, "TikTok"], [c.facebook, "Facebook"],
      [c.email ? `mailto:${c.email}` : "", c.email], [c.linkExtra, c.linkExtraNome || "Mais links"],
    ].filter(([url]) => url);
    $("#rodape-redes").innerHTML = redes.map(([url, nome]) => `<li><a href="${escapar(url)}" ${url.startsWith("mailto:") ? "" : 'target="_blank" rel="noopener"'}>${escapar(nome)}</a></li>`).join("");
    $("#cta-final-img").src = c.bannerImagem || "img/produtos/banner-tmz.svg";
    const cupomInsta = c.cupomInsta && Cupons.achar(c.cupomInsta);
    const caixaInsta = $("#insta-cupom");
    caixaInsta.hidden = !(cupomInsta?.ativo && !(cupomInsta.validade && new Date().toLocaleDateString("sv-SE") > cupomInsta.validade));
    if (!caixaInsta.hidden) {
      caixaInsta.querySelector("code").textContent = cupomInsta.codigo;
      caixaInsta.querySelector("small").textContent = `${Cupons.descrever(cupomInsta)}${Number(cupomInsta.minimo) > 0 ? ` acima de ${moeda(cupomInsta.minimo)}` : ""}`;
    }
    $("#selo-troca").textContent = `Troca em até ${Number(c.prazoTroca) || 30} dias`;
    $("#rodape-cnpj").textContent = c.cnpj ? ` ${c.razaoSocial || c.nome} · ${c.cnpj.replace(/\D/g, "").length > 11 ? "CNPJ" : "CPF"} ${c.cnpj}` : "";
    $("#rodape-endereco").hidden = !c.endereco;
    $("#rodape-endereco").textContent = c.endereco || "";
    $("#rodape-horario").hidden = !c.horario;
    $("#rodape-horario").textContent = c.horario || "";
    const avisos = (c.avisos || []).filter(Boolean);
    $(".faixa").hidden = !avisos.length;
    const linha = avisos.map((a) => `<span>${escapar(a)}</span>`).join("");
    $("#faixa").innerHTML = `<div>${linha}</div><div aria-hidden="true">${linha}</div>`;
    $("#botao-painel").hidden = !S.admin;
    const entrar = $("#botao-entrar");
    entrar.classList.toggle("logado", !!S.conta);
    entrar.title = S.conta ? "Minha conta" : "Entrar ou cadastrar";
    entrar.setAttribute("aria-label", entrar.title);
  }

  /* ---------- categorias ---------- */
  function renderCategorias() {
    const comProdutos = S.categorias.filter((c) => S.produtos.some((p) => p.categoria === c.id));
    const temOferta = S.produtos.some((p) => p.oferta);
    $("#filtros-catalogo").innerHTML = [["todos", "Todos"], ...(temOferta ? [["ofertas", "Ofertas"]] : []), ...comProdutos.map((c) => [c.id, c.nome])]
      .map(([id, nome]) => `<button type="button" class="filtro-chip" role="tab" data-filtro="${escapar(id)}">${escapar(nome)}</button>`).join("");
    $("#circulos").innerHTML = S.categorias.filter((c) => imagemCat(c)).map((c) => {
      const qtd = S.produtos.filter((p) => p.categoria === c.id).length;
      return `
      <button class="circulo" data-cat="${escapar(c.id)}">
        <span class="circulo__anel ilha-escura">
          <span class="circulo__img"><img src="${escapar(imagemCat(c))}" alt=""></span>
          <span class="circulo__ir" aria-hidden="true"><svg><use href="#i-arrow"/></svg></span>
        </span>
        <span class="circulo__nome">${escapar(c.nome)}</span>
        <span class="circulo__qtd">${qtd} ${qtd === 1 ? "produto" : "produtos"}</span>
      </button>`;
    }).join("");
    marcarFiltro();
  }

  document.addEventListener("click", (e) => {
    const cat = e.target.closest("[data-cat]");
    const todos = e.target.closest("[data-todos], #ver-todos");
    if (cat) {
      filtrar(cat.dataset.cat);
      $("#catalogo").scrollIntoView({ behavior: "smooth" });
    } else if (todos) {
      filtrar("todos");
    }
    const chip = e.target.closest("[data-filtro]");
    if (chip && chip.closest("#filtros-catalogo")) filtrar(chip.dataset.filtro);
    if (e.target.closest("[data-abrir-procura]")) abrirProcura();
    // cartões fora da grade (destaques, miniaturas do topo, produto em destaque)
    const area = e.target.closest("#destaques-grade, #hero-miniaturas, #produto-destaque");
    if (area) {
      const alvo = e.target.closest("[data-ver], [data-add], [data-comprar], [data-reservar]");
      if (!alvo) return;
      if (alvo.dataset.add) adicionar(alvo.dataset.add);
      else if (alvo.dataset.comprar) irParaCompra(alvo.dataset.comprar, "compra");
      else if (alvo.dataset.reservar) irParaCompra(alvo.dataset.reservar, "reserva30");
      else abrirProduto(alvo.dataset.ver);
    }
  });

  function marcarFiltro() {
    const f = estado.filtro;
    $$("#filtros-catalogo [data-filtro]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.filtro === f)));
    $$(".circulo").forEach((b) => b.classList.toggle("ativo", b.dataset.cat === f));
  }

  function filtrar(f) {
    estado.filtro = f;
    marcarFiltro();
    $("#titulo-ofertas").textContent = f === "ofertas" ? "Ofertas" : f === "todos" ? "Catálogo" : categoria(f).nome;
    $("#ver-todos").hidden = true;
    renderGrade();
  }

  /* ---------- vitrine: miniaturas do topo, destaques e produto em destaque ---------- */
  const comFoto = (p) => p.imagem && estoque(p) > 0;
  function ofertasPrimeiro() {
    return [...S.produtos].sort((a, b) => (b.oferta ? 1 : 0) - (a.oferta ? 1 : 0));
  }

  function renderMiniaturas() {
    // até 3 peças de categorias diferentes, ofertas primeiro
    const vistas = new Set();
    const lista = ofertasPrimeiro().filter((p) => comFoto(p) && !vistas.has(p.categoria) && vistas.add(p.categoria)).slice(0, 3);
    $("#hero-miniaturas").innerHTML = lista.map((p) => `
      <button type="button" class="miniatura ilha-escura" data-ver="${escapar(p.id)}" aria-label="Ver ${escapar(p.nome)}">
        <img src="${escapar(p.imagem)}" alt="">
        <span><b>${escapar(p.nome)}</b>${moeda(p.preco)}</span>
      </button>`).join("");
  }

  function renderDestaques() {
    const lista = ofertasPrimeiro().filter((p) => estoque(p) > 0).slice(0, 3);
    $("#destaques").hidden = !lista.length;
    $("#destaques-grade").innerHTML = lista.map((p) => `
      <article class="destaque">
        <button type="button" class="destaque__foto ilha-escura" data-ver="${escapar(p.id)}" aria-label="Ver ${escapar(p.nome)}">
          ${img(p)}
          ${desconto(p) ? `<span class="selo">-${desconto(p)}%</span>` : ""}
        </button>
        <div class="destaque__info">
          <span class="destaque__cat">${escapar(categoria(p.categoria).nome)}</span>
          <h3>${escapar(p.nome)}</h3>
          <p>${escapar(p.descricao || "")}</p>
          <div class="destaque__rodape">
            ${precos(p)}
            <div class="destaque__botoes">
              <button type="button" class="icone-acao icone-acao--borda" data-add="${escapar(p.id)}" aria-label="Adicionar ${escapar(p.nome)} ao carrinho"><svg><use href="#i-cart"/></svg></button>
              <button type="button" class="btn btn--pequeno" data-comprar="${escapar(p.id)}">Comprar agora</button>
            </div>
          </div>
        </div>
      </article>`).join("");
  }

  function renderProdutoDestaque() {
    const alvo = $("#produto-destaque");
    const p = porId(S.config.produtoDestaque) || ofertasPrimeiro().find((x) => estoque(x) > 0 && x.imagem);
    alvo.hidden = !p;
    if (!p) return;
    const detalhes = Array.isArray(p.detalhes) ? p.detalhes.filter(Boolean) : [];
    const q = estoque(p);
    alvo.innerHTML = `
      <div class="vitrine">
        <button type="button" class="vitrine__foto ilha-escura" data-ver="${escapar(p.id)}" aria-label="Ver ${escapar(p.nome)}">${img(p)}</button>
        <div class="vitrine__info">
          <p class="rotulo">Produto em destaque · ${escapar(categoria(p.categoria).nome)}</p>
          <h2 class="titulo-grande">${escapar(p.nome)}</h2>
          <p class="vitrine__desc">${escapar(p.descricao || "")}</p>
          ${detalhes.length ? `<ul class="vitrine__detalhes">${detalhes.map((d) => `<li><svg><use href="#i-check"/></svg>${escapar(d)}</li>`).join("")}</ul>` : ""}
          <div class="vitrine__preco">${precos(p)}<span>${q === 0 ? "Esgotado" : q <= 5 ? `Últimas ${q} peças` : `${q} em estoque`}</span></div>
          ${q === 0 ? "" : `
          <div class="vitrine__acoes">
            <button type="button" class="btn btn--grande" data-comprar="${escapar(p.id)}">Comprar agora <svg><use href="#i-arrow"/></svg></button>
            <button type="button" class="btn btn--grande btn--contorno" data-reservar="${escapar(p.id)}">Reservar e retirar</button>
            <button type="button" class="icone-acao icone-acao--borda icone-acao--grande" data-add="${escapar(p.id)}" aria-label="Adicionar ao carrinho"><svg><use href="#i-cart"/></svg></button>
          </div>`}
        </div>
      </div>`;
  }

  /* ---------- produtos ---------- */
  function lista() {
    const termo = estado.busca.trim().toLowerCase();
    if (termo) return S.produtos.filter((p) => `${p.nome} ${categoria(p.categoria).nome} ${p.descricao}`.toLowerCase().includes(termo));
    if (estado.filtro === "ofertas") return S.produtos.filter((p) => p.oferta);
    if (estado.filtro === "todos") return S.produtos;
    return S.produtos.filter((p) => p.categoria === estado.filtro);
  }

  function precos(p) {
    return `<div class="card__precos"><strong>${moeda(p.preco)}</strong>${p.precoAntigo > p.preco ? `<s>${moeda(p.precoAntigo)}</s>` : ""}${desconto(p) ? `<span class="selo">-${desconto(p)}%</span>` : ""}</div>`;
  }

  function avisoEstoque(p) {
    const q = estoque(p);
    if (q === 0) return `<span class="card__estoque card__estoque--fim">Esgotado</span>`;
    if (q <= 5) return `<span class="card__estoque">Últimas ${q} ${q === 1 ? "peça" : "peças"}</span>`;
    return "";
  }

  function renderGrade() {
    const itens = lista();
    $("#vazio").hidden = itens.length > 0;
    $("#grade").innerHTML = itens.map((p) => `
      <article class="card${estoque(p) === 0 ? " card--esgotado" : ""}">
        <button class="card__img" data-ver="${escapar(p.id)}" aria-label="Ver ${escapar(p.nome)}">${img(p)}</button>
        <div class="card__linha">
          <h3 class="card__nome">${escapar(p.nome)}</h3>
          <button class="add" data-add="${escapar(p.id)}" aria-label="Adicionar ${escapar(p.nome)} ao carrinho" ${estoque(p) === 0 ? "disabled" : ""}><svg><use href="#i-cart"/></svg></button>
        </div>
        ${precos(p)}
        ${avisoEstoque(p)}
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
      $("#titulo-ofertas").textContent = estado.busca.trim() ? `Resultados para "${estado.busca.trim()}"` : "Catálogo";
      renderGrade();
      if (estado.busca.trim()) $("#catalogo").scrollIntoView({ behavior: "smooth" });
    }, 250);
  });
  $("#abrir-menu").addEventListener("click", () => $("#menu").classList.toggle("aberto"));
  $("#menu").addEventListener("click", () => $("#menu").classList.remove("aberto"));

  /* ---------- sugestões "Combina com" ---------- */
  function combinaDe(catId) {
    const c = categoria(catId);
    if (Array.isArray(c.combina)) return c.combina;
    return CATEGORIAS.find((x) => x.id === catId)?.combina || (typeof COMBINA_PADRAO !== "undefined" && COMBINA_PADRAO[catId]) || [];
  }

  // Produtos de categorias que combinam com as dos produtos-base, com estoque e fora do carrinho
  function sugestoes(base, limite = 4) {
    const idsBase = new Set(base.map((p) => p.id));
    const catsBase = new Set(base.map((p) => p.categoria));
    const prioridade = [];
    base.forEach((p) => combinaDe(p.categoria).forEach((c) => { if (!catsBase.has(c) && !prioridade.includes(c)) prioridade.push(c); }));
    const livre = (p) => !idsBase.has(p.id) && !estado.carrinho[p.id] && estoque(p) > 0;
    const escolhidos = [];
    // um de cada categoria combinada primeiro, para variar o look
    for (const c of prioridade) {
      const opcoes = S.produtos.filter((p) => p.categoria === c && livre(p)).sort((a, b) => (b.oferta ? 1 : 0) - (a.oferta ? 1 : 0));
      if (opcoes[0]) escolhidos.push(opcoes[0]);
      if (escolhidos.length >= limite) return escolhidos;
    }
    for (const c of prioridade) {
      S.produtos.filter((p) => p.categoria === c && livre(p) && !escolhidos.includes(p)).forEach((p) => escolhidos.length < limite && escolhidos.push(p));
    }
    // completa com ofertas de outras categorias
    S.produtos.filter((p) => livre(p) && !escolhidos.includes(p) && !catsBase.has(p.categoria))
      .sort((a, b) => (b.oferta ? 1 : 0) - (a.oferta ? 1 : 0))
      .forEach((p) => escolhidos.length < limite && escolhidos.push(p));
    return escolhidos;
  }

  function cartaoSugestao(p) {
    return `
      <article class="sugestao">
        <button type="button" class="sugestao__foto" data-ver-sugestao="${escapar(p.id)}" aria-label="Ver ${escapar(p.nome)}">${img(p)}</button>
        <div class="sugestao__info">
          <span class="sugestao__cat">${escapar(categoria(p.categoria).nome)}</span>
          <button type="button" class="sugestao__nome" data-ver-sugestao="${escapar(p.id)}">${escapar(p.nome)}</button>
          <strong>${moeda(p.preco)}</strong>
        </div>
        <button type="button" class="sugestao__add" data-add-sugestao="${escapar(p.id)}" aria-label="Adicionar ${escapar(p.nome)} ao carrinho"><svg><use href="#i-mais"/></svg></button>
      </article>`;
  }

  /* Detalhe do produto */
  const modalProduto = $("#modal-produto");
  function abrirProduto(id) {
    const p = porId(id);
    if (!p) return;
    const q = estoque(p);
    const sug = sugestoes([p], 3);
    const c = S.config;
    $("#detalhe").innerHTML = `
      <div class="detalhe">
        <div class="detalhe__img">${img(p)}</div>
        <div class="detalhe__info">
          <span class="detalhe__cat">${escapar(categoria(p.categoria).nome)}</span>
          <h3>${escapar(p.nome)}</h3>
          ${precos(p)}
          <p>${escapar(p.descricao)}</p>
          ${typeof MEDIDAS !== "undefined" && MEDIDAS[p.categoria] ? `<a class="detalhe__medidas" href="#medidas" data-medidas="${escapar(p.categoria)}"><svg><use href="#i-regua"/></svg>Guia de medidas: P ao GG em cm</a>` : ""}
          <p class="detalhe__estoque">${q === 0 ? "Esgotado no momento" : q <= 5 ? `Últimas ${q} ${q === 1 ? "peça" : "peças"}` : `${q} peças em estoque`}</p>
          ${q === 0 ? formAviso(p) : `
          <div class="detalhe__acoes">
            <button type="button" class="btn btn--bloco btn--grande" data-comprar="${escapar(p.id)}">Comprar agora <svg><use href="#i-arrow"/></svg></button>
            <button type="button" class="btn btn--bloco btn--contorno" data-add-modal="${escapar(p.id)}"><svg><use href="#i-cart"/></svg>Adicionar ao carrinho</button>
            <button type="button" class="detalhe__reservar" data-reservar="${escapar(p.id)}">
              <svg><use href="#i-relogio"/></svg>
              <span><strong>Reservar e retirar na loja</strong>Pague ${c.reservaPercentual}% agora (${moeda(p.preco * c.reservaPercentual / 100)}) e o resto na retirada</span>
            </button>
          </div>`}
        </div>
      </div>
      ${sug.length ? `
      <section class="combina">
        <h4 class="combina__titulo">Combina com</h4>
        <div class="combina__lista">${sug.map(cartaoSugestao).join("")}</div>
      </section>` : ""}`;
    if (!modalProduto.open) modalProduto.showModal();
    $("#detalhe").scrollIntoView?.({ block: "start" });
    modalProduto.scrollTop = 0;
  }

  // Produto esgotado: "Avise-me quando chegar"
  const CHAVE_AVISOS = "tmz-avisos-meus";
  function meusAvisos() { try { return JSON.parse(localStorage.getItem(CHAVE_AVISOS)) || {}; } catch { return {}; } }
  function formAviso(p) {
    const ja = meusAvisos()[p.id];
    if (ja) {
      return `<div class="aviso-chegar aviso-chegar--ok"><svg><use href="#i-check"/></svg><span><strong>Você está na lista de espera.</strong>Avisamos em ${escapar(ja)} assim que chegar.</span></div>`;
    }
    return `
      <form class="aviso-chegar" data-aviso="${escapar(p.id)}" novalidate>
        <p><strong>Avise-me quando chegar</strong>Deixe seu WhatsApp ou e-mail e você fica sabendo primeiro.</p>
        <span class="cupom-form__linha">
          <input name="contato" value="${escapar(S.conta?.whats || S.conta?.email || "")}" placeholder="WhatsApp ou e-mail" autocomplete="tel" aria-label="WhatsApp ou e-mail">
          <button class="btn btn--pequeno">Me avise</button>
        </span>
        <p class="aviso-chegar__erro" role="alert" hidden></p>
      </form>`;
  }
  $("#detalhe").addEventListener("submit", async (e) => {
    const f = e.target.closest("[data-aviso]");
    if (!f) return;
    e.preventDefault();
    const contato = f.contato.value.trim();
    const zap = digitos(contato);
    const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contato);
    const erroEl = f.querySelector(".aviso-chegar__erro");
    if (!email && zap.length < 10) { erroEl.textContent = "Digite um WhatsApp com DDD ou um e-mail."; erroEl.hidden = false; return f.contato.focus(); }
    const p = porId(f.dataset.aviso);
    const botao = f.querySelector("button");
    botao.disabled = true;
    try {
      await Dados.pedirAviso(p, email ? contato : zap);
      const meus = meusAvisos();
      meus[p.id] = email ? contato : `(${zap.slice(0, 2)}) ${zap.slice(2, -4)}-${zap.slice(-4)}`;
      try { localStorage.setItem(CHAVE_AVISOS, JSON.stringify(meus)); } catch {}
      f.outerHTML = formAviso(p);
      toast("Pronto! Você está na lista de espera");
    } catch {
      botao.disabled = false;
      erroEl.textContent = "Não deu para salvar agora. Tente de novo.";
      erroEl.hidden = false;
    }
  });

  function irParaCompra(id, modo) {
    const p = porId(id);
    if (!p) return;
    if (!estado.carrinho[p.id]) adicionar(p.id, true);
    estado.modo = modo;
    modalProduto.close();
    location.hash = "compra";
  }

  modalProduto.addEventListener("click", (e) => {
    const add = e.target.closest("[data-add-modal]");
    const comprar = e.target.closest("[data-comprar]");
    const reservar = e.target.closest("[data-reservar]");
    const ver = e.target.closest("[data-ver-sugestao]");
    const addSug = e.target.closest("[data-add-sugestao]");
    if (add) { adicionar(add.dataset.addModal); modalProduto.close(); }
    else if (comprar) irParaCompra(comprar.dataset.comprar, "compra");
    else if (reservar) irParaCompra(reservar.dataset.reservar, "reserva30");
    else if (ver) abrirProduto(ver.dataset.verSugestao);
    else if (addSug) { adicionar(addSug.dataset.addSugestao); addSug.classList.add("feito"); addSug.innerHTML = '<svg><use href="#i-check"/></svg>'; addSug.disabled = true; }
  });
  $$("dialog").forEach((d) => d.addEventListener("click", (e) => {
    if (e.target === d || e.target.closest("[data-fechar]")) d.close();
  }));

  /* ---------- carrinho ---------- */
  function adicionar(id, silencioso) {
    const p = porId(id);
    if (!p) return;
    const atual = estado.carrinho[p.id] || 0;
    if (atual >= estoque(p)) { toast(estoque(p) ? `Só temos ${estoque(p)} em estoque` : "Produto esgotado"); return; }
    estado.carrinho[p.id] = atual + 1;
    gravarCarrinho();
    renderCarrinho();
    const c = $("#contador");
    c.classList.remove("pulse");
    void c.offsetWidth;
    c.classList.add("pulse");
    if (!silencioso) toast(`${p.nome} adicionado ao carrinho`);
  }

  function alterar(id, delta) {
    const p = porId(id);
    let q = (estado.carrinho[id] || 0) + delta;
    if (p && q > estoque(p)) { q = estoque(p); toast(`Só temos ${estoque(p)} em estoque`); }
    if (q <= 0) delete estado.carrinho[id]; else estado.carrinho[id] = q;
    gravarCarrinho();
    renderCarrinho();
  }

  function itensCarrinho() {
    return Object.entries(estado.carrinho).map(([id, qtd]) => ({ p: porId(id), qtd })).filter((i) => i.p);
  }

  function totais(receber = "entrega") {
    const itens = itensCarrinho();
    const subtotal = centavos(itens.reduce((s, i) => s + i.p.preco * i.qtd, 0));
    const limite = Number(S.config.freteGratisAcima) || 0;
    const gratis = limite > 0 && subtotal >= limite;
    const calc = Frete.calcular(estado.destino, S.config);
    let frete = 0;
    let freteFalta = false; // frete por região e o cliente ainda não deu o CEP
    if (receber === "entrega" && subtotal > 0 && !gratis) {
      if (calc) frete = calc.valor; else freteFalta = true;
    }
    const quantidade = itens.reduce((s, i) => s + i.qtd, 0);
    return { itens, subtotal, frete, freteFalta, prazo: receber === "entrega" ? calc?.prazo ?? null : null, total: centavos(subtotal + frete), quantidade };
  }

  /* ---------- CEP e frete ---------- */
  function lerCep() { try { return sessionStorage.getItem("tmz-cep") || ""; } catch { return ""; } }
  const textoPrazo = (dias) => (dias ? `chega em até ${dias} ${dias === 1 ? "dia útil" : "dias úteis"}` : "");
  async function usarCep(cep) {
    const d = digitos(cep);
    if (d.length !== 8) return null;
    try { sessionStorage.setItem("tmz-cep", d); } catch {}
    const destino = await Frete.buscarCep(d);
    if (digitos(cep) !== d) return destino;
    estado.destino = destino;
    renderCarrinho();
    if (telaAtual === "compra" && $("#compra-ok").hidden) renderCompra();
    return destino;
  }
  function descreverDestino(t) {
    const dest = estado.destino;
    if (!dest) return "";
    if (dest.invalido) return `<span class="cep-info__erro">CEP não encontrado. Confira os números.</span>`;
    const lugar = dest.cidade ? `${escapar(dest.cidade)}/${escapar(dest.uf)}` : escapar(dest.uf);
    const valor = t.subtotal && !t.frete && !t.freteFalta ? "frete grátis" : t.freteFalta ? "" : moeda(t.frete);
    return `<svg><use href="#i-truck"/></svg><span>Entrega para <strong>${lugar}</strong>${valor ? ` · ${valor}` : ""}${t.prazo ? ` · ${textoPrazo(t.prazo)}` : ""}</span>`;
  }

  function renderCarrinho() {
    const t = totais();
    $("#contador").textContent = t.quantidade;
    $("#carrinho-qtd").textContent = t.quantidade ? `(${t.quantidade})` : "";
    $("#carrinho-vazio").hidden = t.itens.length > 0;
    $("#resumo").hidden = t.itens.length === 0;
    $("#itens").innerHTML = t.itens.map(({ p, qtd }) => `
      <li class="linha">
        <div class="linha__img">${img(p)}</div>
        <div class="linha__info">
          <span class="linha__cat">${escapar(categoria(p.categoria).nome)}</span>
          <strong class="linha__nome">${escapar(p.nome)}</strong>
          <span class="linha__unit">${moeda(p.preco)} cada · ${estoque(p)} em estoque</span>
        </div>
        <div class="contador-qtd" role="group" aria-label="Quantidade de ${escapar(p.nome)}">
          <button type="button" data-menos="${escapar(p.id)}" aria-label="Diminuir"><svg><use href="#i-menos"/></svg></button>
          <output>${qtd}</output>
          <button type="button" data-mais="${escapar(p.id)}" aria-label="Aumentar" ${qtd >= estoque(p) ? "disabled" : ""}><svg><use href="#i-mais"/></svg></button>
        </div>
        <strong class="linha__total">${moeda(p.preco * qtd)}</strong>
        <button type="button" class="linha__remover" data-remover="${escapar(p.id)}" aria-label="Remover ${escapar(p.nome)}"><svg><use href="#i-lixo"/></svg></button>
      </li>`).join("");
    const sug = t.itens.length ? sugestoes(t.itens.map((i) => i.p), 3) : [];
    $("#carrinho-sugestoes").hidden = !sug.length;
    $("#carrinho-sugestoes-lista").innerHTML = sug.map(cartaoSugestao).join("");
    $("#subtotal").textContent = moeda(t.subtotal);
    $("#frete").textContent = t.freteFalta ? "Calcule pelo CEP" : t.frete ? moeda(t.frete) : "Grátis";
    $("#cep-carrinho-info").innerHTML = descreverDestino(t);
    const campoCep = $("#cep-carrinho input");
    if (campoCep && !campoCep.value && estado.destino) campoCep.value = estado.destino.cep.replace(/(\d{5})(\d{3})/, "$1-$2");
    $("#total").textContent = moeda(t.total);
    const limite = Number(S.config.freteGratisAcima) || 0;
    const falta = centavos(limite - t.subtotal);
    $("#frete-msg").innerHTML = falta > 0 ? `Faltam <strong>${moeda(falta)}</strong> para o frete grátis` : "Você ganhou <strong>frete grátis</strong> para entrega";
    $("#frete-progresso").style.width = `${limite ? Math.min(100, (t.subtotal / limite) * 100) : 100}%`;
  }

  $("#itens").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.mais) alterar(b.dataset.mais, 1);
    if (b.dataset.menos) alterar(b.dataset.menos, -1);
    if (b.dataset.remover) alterar(b.dataset.remover, -Infinity);
  });
  $("#abrir-carrinho").addEventListener("click", () => { location.hash = "carrinho"; });
  $("#carrinho-sugestoes").addEventListener("click", (e) => {
    const ver = e.target.closest("[data-ver-sugestao]");
    const add = e.target.closest("[data-add-sugestao]");
    if (add) adicionar(add.dataset.addSugestao);
    else if (ver) abrirProduto(ver.dataset.verSugestao);
  });
  document.addEventListener("click", (e) => {
    const modo = e.target.closest("[data-modo]");
    if (modo) estado.modo = modo.dataset.modo;
    if (e.target.closest("#ir-compra")) estado.modo = "compra";
    const ofertas = e.target.closest("[data-ir-ofertas]");
    if (ofertas) { e.preventDefault(); history.pushState(null, "", location.pathname + location.search); rota(); filtrar("todos"); $("#catalogo").scrollIntoView(); }
  });

  /* ---------- compra e reserva ---------- */
  const form = $("#form-compra");

  function modosDisponiveis(total) {
    const c = S.config;
    return [
      { id: "compra", nome: "Compra completa", resumo: "Pague o valor total agora", detalhe: "Entrega em casa ou retirada na loja" },
      { id: "reserva30", nome: `Reserva ${c.reservaPercentual}%`, resumo: `Pague ${c.reservaPercentual}% agora`, detalhe: "Retire na loja e pague o resto lá" },
      { id: "reserva50", nome: `Reserva ${moeda(c.reservaFixa)}`, resumo: `Pague ${moeda(c.reservaFixa)} agora`, detalhe: "Pague o restante depois", oculto: total <= c.reservaFixa },
    ].filter((m) => !m.oculto);
  }

  // Aplica o cupom (se houver) sobre os totais
  function comCupom(t) {
    if (!estado.cupom) return { ...t, desconto: 0, cupom: null, cupomErro: "" };
    const av = Cupons.avaliar(estado.cupom, t, (id) => categoria(id).nome);
    if (!av.ok) return { ...t, desconto: 0, cupom: null, cupomErro: av.erro };
    const frete = av.freteGratis ? 0 : t.frete;
    return { ...t, desconto: av.desconto, frete, freteEconomizado: centavos(t.frete - frete), cupom: av.cupom, cupomErro: "", total: centavos(t.subtotal - av.desconto + frete) };
  }

  function calcular() {
    const receber = estado.modo === "reserva30" ? "retirada" : form.receber.value;
    const t = comCupom(totais(receber));
    const c = S.config;
    let sinal = t.total;
    if (estado.modo === "reserva30") sinal = centavos(t.total * c.reservaPercentual / 100);
    if (estado.modo === "reserva50") sinal = Math.min(Number(c.reservaFixa), t.total);
    return { ...t, receber, sinal, restante: centavos(t.total - sinal) };
  }

  function prepararCompra() {
    const t = totais();
    $("#compra-formulario").hidden = false;
    $("#compra-ok").hidden = true;
    if (!t.itens.length) { location.hash = "carrinho"; return; }
    // cliente com conta: já preenche os dados
    if (S.conta && !S.conta.admin) {
      [["#c-nome", S.conta.nome], ["#c-telefone", S.conta.whats], ["#c-email", S.conta.email]].forEach(([sel, v]) => {
        const campo = $(sel);
        if (campo && !campo.value && v) campo.value = v;
      });
    }
    if (!form.cep.value && estado.destino && !estado.destino.invalido) form.cep.value = estado.destino.cep.replace(/(\d{5})(\d{3})/, "$1-$2");
    if (!modosDisponiveis(t.total).some((m) => m.id === estado.modo)) estado.modo = "compra";
    renderCompra();
  }

  function renderCompra() {
    const calc = calcular();
    const c = S.config;
    const reserva = estado.modo !== "compra";
    $("#compra-titulo").textContent = reserva ? "Reservar suas peças" : "Finalizar compra";
    $("#modos").innerHTML = modosDisponiveis(totais().total).map((m) => {
      const ativo = m.id === estado.modo;
      const agora = m.id === "compra" ? calcular().total : m.id === "reserva30" ? centavos(comCupom(totais("retirada")).total * c.reservaPercentual / 100) : Number(c.reservaFixa);
      return `
        <label class="modo${ativo ? " modo--ativo" : ""}">
          <input type="radio" name="modo" value="${m.id}" ${ativo ? "checked" : ""}>
          <span class="modo__topo"><span class="modo__nome">${escapar(m.nome)}</span><span class="modo__marca" aria-hidden="true"></span></span>
          <span class="modo__valor">${moeda(agora)}<small> agora</small></span>
          <span class="modo__det">${escapar(m.resumo)}. ${escapar(m.detalhe)}.</span>
        </label>`;
    }).join("");

    // forma de receber
    $("#receber").hidden = estado.modo === "reserva30";
    $("#campos-endereco").hidden = calc.receber !== "entrega";

    // pagamento
    $("#formas-pagamento").hidden = reserva;
    $("#nota-pagamento").innerHTML = reserva
      ? `O sinal de <strong>${moeda(calc.sinal)}</strong> é pago por Pix. ${c.pixChave ? "A chave aparece na próxima tela." : "Enviamos a chave Pix pelo WhatsApp."}`
      : "Depois de confirmar, você envia o pedido pelo WhatsApp e combinamos o pagamento.";
    $("#regras-reserva").hidden = !reserva;
    if (reserva) {
      const devolveDepois = centavos(calc.sinal * c.estornoDepoisPerc / 100);
      $("#regras-lista").innerHTML = [
        `Você paga <strong>${moeda(calc.sinal)}</strong> agora para segurar as peças.`,
        estado.modo === "reserva30"
          ? `O restante, <strong>${moeda(calc.restante)}</strong>, você paga na loja quando for retirar.`
          : `O restante, <strong>${moeda(calc.restante)}</strong>, você paga depois, antes de ${calc.receber === "entrega" ? "enviarmos" : "retirar"}.`,
        "As peças ficam separadas para você assim que confirmarmos o pagamento do sinal.",
        `Desistiu em até <strong>${duracao(c.estornoJanelaMin)}</strong> depois de reservar? Devolvemos <strong>100%</strong> do sinal.`,
        `Depois desse prazo, devolvemos <strong>${c.estornoDepoisPerc}%</strong> do sinal (${moeda(devolveDepois)}).`,
      ].map((r) => `<li>${r}</li>`).join("");
    }

    // resumo lateral
    $("#compra-itens").innerHTML = calc.itens.map(({ p, qtd }) => `
      <li><span class="mini__img">${img(p)}<b>${qtd}</b></span><span class="mini__nome">${escapar(p.nome)}</span><span>${moeda(p.preco * qtd)}</span></li>`).join("");
    $("#compra-totais").innerHTML = `
      <div><dt>Subtotal</dt><dd>${moeda(calc.subtotal)}</dd></div>
      ${calc.desconto ? `<div class="resumo__desconto"><dt>Cupom ${escapar(calc.cupom.codigo)}</dt><dd>− ${moeda(calc.desconto)}</dd></div>` : ""}
      <div><dt>Frete</dt><dd>${calc.receber === "retirada" ? "Retirada na loja" : calc.freteFalta ? "Informe o CEP" : calc.frete ? moeda(calc.frete) : calc.cupom?.tipo === "frete" && calc.freteEconomizado ? `<s>${moeda(calc.freteEconomizado)}</s> Grátis` : "Grátis"}</dd></div>
      <div class="resumo__total"><dt>Total</dt><dd>${moeda(calc.total)}</dd></div>
      ${reserva ? `
      <div class="resumo__agora"><dt>Pagar agora</dt><dd>${moeda(calc.sinal)}</dd></div>
      <div><dt>${estado.modo === "reserva30" ? "Pagar na retirada" : "Pagar depois"}</dt><dd>${moeda(calc.restante)}</dd></div>` : ""}`;
    renderCupom(calc);
    $("#cep-info").innerHTML = calc.receber === "entrega" ? descreverDestino(calc) : "";
    $("#confirmar-compra").textContent = reserva ? `Reservar e pagar ${moeda(calc.sinal)}` : "Confirmar pedido";
    $("#erro-compra").hidden = true;
  }

  function renderCupom(calc) {
    const caixa = $("#cupom-caixa");
    if (calc.cupom) {
      caixa.innerHTML = `
        <div class="cupom-aplicado">
          <svg><use href="#i-cupom"/></svg>
          <div><strong>${escapar(calc.cupom.codigo)}</strong><span>${escapar(Cupons.descrever(calc.cupom))}${calc.desconto ? ` · você economiza ${moeda(calc.desconto)}` : calc.freteEconomizado ? ` · você economiza ${moeda(calc.freteEconomizado)}` : calc.receber === "retirada" ? " · vale na entrega" : ""}</span></div>
          <button type="button" class="link-simples" data-tirar-cupom>Remover</button>
        </div>`;
      return;
    }
    const aberto = caixa.querySelector("form");
    const digitado = aberto ? aberto.cupom.value : estado.cupom;
    caixa.innerHTML = `
      <form class="cupom-form" id="form-cupom" novalidate>
        <label class="campo"><span>Cupom de desconto</span>
          <span class="cupom-form__linha">
            <input name="cupom" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="Digite o código" value="${escapar(digitado)}">
            <button class="btn btn--contorno btn--pequeno">Aplicar</button>
          </span>
        </label>
        ${calc.cupomErro ? `<p class="cupom-form__erro" role="alert">${escapar(calc.cupomErro)}</p>` : ""}
      </form>`;
  }
  $("#cupom-caixa").addEventListener("submit", (e) => {
    e.preventDefault();
    const codigo = Cupons.limpar(e.target.cupom.value);
    if (!codigo) return e.target.cupom.focus();
    guardarCupom(codigo);
    renderCompra();
    const calc = calcular();
    if (calc.cupom) toast(`Cupom ${codigo} aplicado`);
    else $("#cupom-caixa input")?.select();
  });
  $("#cupom-caixa").addEventListener("click", (e) => {
    if (!e.target.closest("[data-tirar-cupom]")) return;
    guardarCupom("");
    renderCompra();
  });

  function duracao(min) {
    min = Number(min) || 0;
    if (min % 60 === 0) return min === 60 ? "1 hora" : `${min / 60} horas`;
    return `${min} minutos`;
  }

  form.addEventListener("change", (e) => {
    if (e.target.name === "modo") estado.modo = e.target.value;
    if (["modo", "receber", "pagamento"].includes(e.target.name)) renderCompra();
  });
  const mascaraCep = (campo) => {
    const d = digitos(campo.value).slice(0, 8);
    campo.value = d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
    return d;
  };
  $("#c-cep").addEventListener("input", async (e) => {
    const d = mascaraCep(e.target);
    if (d.length !== 8) return;
    const dest = await usarCep(d);
    // preenche o endereço com a rua, o bairro e a cidade; o cliente só completa o número
    const end = $("#c-endereco");
    if (dest?.confirmado && !end.value.trim()) {
      end.value = [dest.logradouro, "", dest.bairro, `${dest.cidade} - ${dest.uf}`].filter((x, i) => x || i === 1).join(", ").replace(/^, /, "");
      const pos = dest.logradouro ? dest.logradouro.length + 2 : 0;
      end.focus();
      end.setSelectionRange(pos, pos);
    }
  });
  $("#cep-carrinho").addEventListener("input", (e) => {
    const d = mascaraCep(e.target);
    if (d.length === 8) usarCep(d);
  });
  $("#cep-carrinho").addEventListener("submit", (e) => {
    e.preventDefault();
    const campo = e.target.querySelector("input");
    if (digitos(campo.value).length !== 8) { toast("Digite os 8 números do CEP"); return campo.focus(); }
    usarCep(campo.value);
  });
  $("#c-telefone").addEventListener("input", (e) => {
    const d = digitos(e.target.value).slice(0, 11);
    e.target.value = d.length > 6 ? `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}` : d.length > 2 ? `(${d.slice(0, 2)}) ${d.slice(2)}` : d;
  });

  function erro(msg, campo) {
    const el = $("#erro-compra");
    el.textContent = msg;
    el.hidden = false;
    if (campo) campo.focus();
    return false;
  }

  function validar(calc) {
    if (form.nome.value.trim().length < 3) return erro("Escreva seu nome completo.", form.nome);
    if (digitos(form.telefone.value).length < 10) return erro("Confira o número de WhatsApp, com DDD.", form.telefone);
    if (calc.receber === "entrega") {
      if (digitos(form.cep.value).length !== 8) return erro("Confira o CEP: são 8 números.", form.cep);
      if (estado.destino?.invalido) return erro("Não encontramos esse CEP. Confira os números.", form.cep);
      if (calc.freteFalta) return erro("Espere o frete ser calculado pelo CEP.", form.cep);
      if (form.endereco.value.trim().length < 8) return erro("Escreva o endereço completo para a entrega.", form.endereco);
    }
    const semEstoque = calc.itens.find(({ p, qtd }) => qtd > estoque(p));
    if (semEstoque) return erro(`${semEstoque.p.nome}: só temos ${estoque(semEstoque.p)} em estoque. Ajuste no carrinho.`);
    if (estado.modo !== "compra" && !form.aceite.checked) return erro("Para reservar, marque que aceita as regras da reserva.", form.aceite);
    return true;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const calc = calcular();
    if (!validar(calc)) return;
    const botao = $("#confirmar-compra");
    botao.disabled = true;
    botao.textContent = "Registrando…";
    try {
      const pedido = await Dados.criarPedido({
        tipo: estado.modo,
        itens: calc.itens.map(({ p, qtd }) => ({ id: p.id, nome: p.nome, preco: p.preco, qtd })),
        subtotal: calc.subtotal, frete: calc.frete, total: calc.total, sinal: calc.sinal, restante: calc.restante,
        cupom: calc.cupom ? { codigo: calc.cupom.codigo, desconto: calc.desconto, freteGratis: calc.cupom.tipo === "frete", freteEconomizado: calc.freteEconomizado || 0 } : null,
        receber: calc.receber,
        prazoEntrega: calc.receber === "entrega" ? calc.prazo : null,
        pagamento: estado.modo === "compra" ? form.pagamento.value : "Pix",
        cliente: {
          nome: form.nome.value.trim(), telefone: form.telefone.value.trim(), email: form.email.value.trim(),
          cep: calc.receber === "entrega" ? form.cep.value.trim() : "", endereco: calc.receber === "entrega" ? form.endereco.value.trim() : "",
        },
        regra: { janelaMin: S.config.estornoJanelaMin, percDepois: S.config.estornoDepoisPerc },
      });
      estado.ultimoPedido = pedido;
      clearTimeout(avisoCarrinho);
      await Dados.concluirCarrinho(pedido);
      if (pedido.cupom) guardarCupom("");
      estado.carrinho = {};
      try { localStorage.setItem(CHAVE_CARRINHO, "{}"); } catch {}
      renderCarrinho();
      mostrarConcluido(pedido);
    } catch (err) {
      erro(err?.message === "sem-identidade"
        ? "Não conseguimos registrar por aqui. Envie seu pedido pelo WhatsApp que a gente reserva para você."
        : "Não deu para registrar agora. Tente de novo em instantes.");
    } finally {
      botao.disabled = false;
      renderCompra();
    }
  });

  function mensagemPedido(p) {
    const tipo = { compra: "Pedido", reserva30: "Reserva", reserva50: "Reserva" }[p.tipo];
    return [
      `*${tipo} ${p.codigo} — ${S.config.nome}*`,
      "",
      ...p.itens.map((i) => `• ${i.qtd}x ${i.nome} — ${moeda(i.preco * i.qtd)}`),
      "",
      p.cupom ? `Cupom ${p.cupom.codigo}: ${p.cupom.desconto ? "− " + moeda(p.cupom.desconto) : "frete grátis"}` : "",
      `Total: ${moeda(p.total)}`,
      p.tipo !== "compra" ? `Sinal pago agora: ${moeda(p.sinal)}\nRestante: ${moeda(p.restante)}` : `Pagamento: ${p.pagamento}`,
      p.receber === "entrega" ? `Entrega: ${p.cliente.endereco} — CEP ${p.cliente.cep}` : "Retirada na loja",
      `Nome: ${p.cliente.nome}`,
      p.tipo !== "compra" ? "\nSegue o comprovante do Pix." : "",
    ].join("\n");
  }

  function mostrarConcluido(p) {
    const reserva = p.tipo !== "compra";
    const c = S.config;
    $("#compra-formulario").hidden = true;
    const ok = $("#compra-ok");
    ok.hidden = false;
    ok.innerHTML = `
      <div class="concluido__selo"><svg><use href="#i-check"/></svg></div>
      <p class="rotulo">${reserva ? "Reserva registrada" : "Pedido registrado"}</p>
      <h1 class="tela__titulo">${reserva ? "Falta só o Pix do sinal" : "Agora é só enviar no WhatsApp"}</h1>
      <p class="concluido__codigo">Código <strong>${escapar(p.codigo)}</strong></p>
      <div class="concluido__grade">
        <div class="cartao-pix">
          ${reserva ? `
            <span class="cartao-pix__rotulo">Pague por Pix</span>
            <strong class="cartao-pix__valor">${moeda(p.sinal)}</strong>
            ${c.pixChave ? `
              <span class="cartao-pix__rotulo">Chave Pix · ${escapar(c.pixNome || c.nome)}</span>
              <div class="copiar"><code id="chave-pix">${escapar(c.pixChave)}</code><button type="button" class="btn btn--contorno btn--pequeno" id="copiar-pix"><svg><use href="#i-copiar"/></svg>Copiar</button></div>`
              : `<p class="cartao-pix__aviso">Peça a chave Pix pelo WhatsApp no botão abaixo.</p>`}
            <a class="btn btn--bloco" href="${escapar(linkWhats(mensagemPedido(p)))}" target="_blank" rel="noopener">Enviar comprovante no WhatsApp <svg><use href="#i-arrow"/></svg></a>`
          : `
            <span class="cartao-pix__rotulo">Total do pedido</span>
            <strong class="cartao-pix__valor">${moeda(p.total)}</strong>
            <p class="cartao-pix__aviso">Pagamento escolhido: ${escapar(p.pagamento)}. Combinamos tudo pelo WhatsApp.</p>
            <a class="btn btn--bloco" href="${escapar(linkWhats(mensagemPedido(p)))}" target="_blank" rel="noopener">Enviar pedido no WhatsApp <svg><use href="#i-arrow"/></svg></a>`}
        </div>
        <ol class="proximos">
          ${reserva ? `
            <li><strong>Pague o sinal</strong><span>Faça o Pix de ${moeda(p.sinal)} e mande o comprovante.</span></li>
            <li><strong>Separamos suas peças</strong><span>Assim que o pagamento cair, a reserva aparece como confirmada.</span></li>
            <li><strong>${p.tipo === "reserva30" ? "Retire na loja" : "Pague o restante"}</strong><span>Restante de ${moeda(p.restante)} ${p.tipo === "reserva30" ? "pago na retirada" : "pago antes da retirada ou envio"}.</span></li>`
          : `
            <li><strong>Envie o pedido</strong><span>O botão ao lado abre o WhatsApp com tudo preenchido.</span></li>
            <li><strong>Pagamento</strong><span>Combinamos o pagamento e o ${p.receber === "entrega" ? "envio" : "horário da retirada"}.</span></li>`}
        </ol>
      </div>
      ${reserva ? `<p class="concluido__prazo"><svg><use href="#i-relogio"/></svg>Cancelando até ${hora(p.criadoEm + c.estornoJanelaMin * 60000)}, devolvemos 100% do sinal. Depois disso, ${c.estornoDepoisPerc}%.</p>` : ""}
      <div class="concluido__acoes">
        <a class="btn btn--contorno" href="#reservas">Ver minhas reservas</a>
        <a class="link-simples" href="#">Voltar à loja</a>
      </div>`;
    $("#tela-compra").scrollTop = 0;
    if (pagamentoOnline(p)) cobrarOnline(p);
  }

  /* ---------- pagamento online (Mercado Pago, pelo servidor) ---------- */
  const pagamentoOnline = (p) => Supa.ativo() && S.modo === "nuvem" && S.config.pagamentoOnline && (p.tipo !== "compra" || p.pagamento === "Pix");
  let vigiaPagamento = null;
  async function cobrarOnline(p) {
    const cartao = $("#compra-ok .cartao-pix");
    if (!cartao) return;
    const valor = p.tipo === "compra" ? p.total : p.sinal;
    cartao.innerHTML = `<span class="cartao-pix__rotulo">Pix · ${moeda(valor)}</span><div class="pix-carregando"><span></span>Gerando o QR Code…</div>`;
    let cobranca;
    try { cobranca = await Supa.funcao("pagamento", { codigo: p.codigo }); }
    catch (err) {
      cartao.innerHTML = `
        <span class="cartao-pix__rotulo">Pix · ${moeda(valor)}</span>
        <p class="cartao-pix__aviso">Não deu para gerar o Pix agora (${escapar(err.message)}). Fale com a gente no WhatsApp que finalizamos por lá.</p>
        <a class="btn btn--bloco" href="${escapar(linkWhats(mensagemPedido(p)))}" target="_blank" rel="noopener">Falar no WhatsApp <svg><use href="#i-arrow"/></svg></a>`;
      return;
    }
    $("#compra-ok h1").textContent = "Pague com Pix";
    cartao.innerHTML = `
      <span class="cartao-pix__rotulo">Escaneie no app do banco</span>
      <strong class="cartao-pix__valor">${moeda(cobranca.valor)}</strong>
      ${cobranca.qrImagem ? `<img class="pix-qr" src="data:image/png;base64,${escapar(cobranca.qrImagem)}" alt="QR Code do Pix" width="220" height="220">` : ""}
      <span class="cartao-pix__rotulo">Ou copie o código</span>
      <div class="copiar"><code id="chave-pix">${escapar(cobranca.qrCopiaECola || "")}</code><button type="button" class="btn btn--contorno btn--pequeno" id="copiar-pix"><svg><use href="#i-copiar"/></svg>Copiar</button></div>
      <p class="pix-status" id="pix-status"><span class="pix-status__ponto"></span>Aguardando o pagamento. Esta tela atualiza sozinha.</p>`;
    clearInterval(vigiaPagamento);
    const conferir = async () => {
      if (!$("#pix-status")) { clearInterval(vigiaPagamento); return; }
      try {
        const r = await Supa.rpc("status_pagamento", { codigo: p.codigo });
        if (r?.status === "approved") {
          clearInterval(vigiaPagamento);
          $("#compra-ok h1").textContent = p.tipo === "compra" ? "Pagamento aprovado!" : "Reserva confirmada!";
          cartao.innerHTML = `
            <div class="pix-aprovado"><svg><use href="#i-check"/></svg></div>
            <strong class="cartao-pix__valor">${moeda(r.valorPago || cobranca.valor)} pagos</strong>
            <p class="cartao-pix__aviso">${p.tipo === "compra" ? `Já estamos separando seu pedido. ${p.receber === "entrega" ? "Avisamos quando sair para entrega." : "Avisamos quando estiver pronto para retirar."}` : "Suas peças estão separadas. É só retirar na loja com o código."}</p>
            <a class="btn btn--bloco btn--contorno" href="${escapar(linkWhats(`Oi! Paguei o pedido ${p.codigo} pelo site.`))}" target="_blank" rel="noopener">Falar com a loja</a>`;
        }
      } catch {}
    };
    vigiaPagamento = setInterval(conferir, 5000);
  }

  document.addEventListener("click", async (e) => {
    if (!e.target.closest("#copiar-pix")) return;
    const chave = $("#chave-pix")?.textContent || "";
    try { await navigator.clipboard.writeText(chave); toast("Chave Pix copiada"); }
    catch {
      const r = document.createRange();
      r.selectNodeContents($("#chave-pix"));
      getSelection().removeAllRanges();
      getSelection().addRange(r);
      toast("Chave selecionada. Copie com Ctrl+C");
    }
  });

  /* ---------- minhas reservas ---------- */
  const NOMES_STATUS = { aguardando: "Aguardando pagamento", confirmado: "Confirmado", retirado: "Concluído", cancelado: "Cancelado", estornado: "Estorno feito" };
  const NOMES_TIPO = { compra: "Compra", reserva30: "Reserva %", reserva50: "Reserva fixa" };
  const nomeTipo = (p) => p.tipo === "reserva30" ? `Reserva ${S.config.reservaPercentual}%` : p.tipo === "reserva50" ? `Reserva ${moeda(p.sinal)}` : "Compra";
  let cancelando = null;

  function renderReservas() {
    const lista = [...S.meusPedidos].sort((a, b) => b.criadoEm - a.criadoEm);
    const alvo = $("#lista-reservas");
    if (!lista.length) {
      alvo.innerHTML = `
        <div class="sacola__vazia">
          <svg><use href="#i-relogio"/></svg>
          <h2>Nenhuma reserva por aqui</h2>
          <p>Quando você reservar ou fizer um pedido, ele aparece nesta tela.</p>
          <a href="#" class="btn" data-ir-ofertas>Ver ofertas <svg><use href="#i-arrow"/></svg></a>
        </div>`;
      return;
    }
    const agora = Date.now();
    alvo.innerHTML = lista.map((p) => {
      const reserva = p.tipo !== "compra";
      const r = Dados.reembolso(p, agora);
      const encerrado = ["cancelado", "estornado"].includes(p.status);
      const podeCancelar = reserva && ["aguardando", "confirmado"].includes(p.status);
      const restanteMin = Math.max(0, Math.ceil((r.limite - agora) / 60000));
      return `
        <article class="pedido${encerrado ? " pedido--encerrado" : ""}">
          <header class="pedido__topo">
            <div>
              <span class="pedido__codigo">${escapar(p.codigo)}</span>
              <span class="pedido__data">${dataHora(p.criadoEm)}</span>
            </div>
            <span class="etiqueta">${escapar(nomeTipo(p))}</span>
            <span class="status status--${p.status}">${NOMES_STATUS[p.status] || p.status}</span>
          </header>
          ${Rastreio.linha(p, { compacta: true })}
          <a class="pedido__acompanhar" href="?pedido=${encodeURIComponent(p.codigo)}#acompanhar"><svg><use href="#i-truck"/></svg>Acompanhar entrega e detalhes</a>
          <ul class="pedido__itens">${p.itens.map((i) => `<li><span>${i.qtd}×</span>${escapar(i.nome)}<b>${moeda(i.preco * i.qtd)}</b></li>`).join("")}</ul>
          <dl class="pedido__valores">
            <div><dt>Total</dt><dd>${moeda(p.total)}</dd></div>
            ${reserva ? `<div><dt>Sinal</dt><dd>${moeda(p.sinal)}${p.pago ? " · pago" : ""}</dd></div><div><dt>Restante</dt><dd>${moeda(p.restante)}</dd></div>` : ""}
            ${encerrado && p.reembolso != null ? `<div><dt>Devolução</dt><dd>${moeda(p.reembolso)}</dd></div>` : ""}
          </dl>
          ${podeCancelar ? `
            <footer class="pedido__rodape">
              <p class="pedido__prazo">${r.dentro
                ? `<svg><use href="#i-relogio"/></svg><span>Devolução total se cancelar nos próximos <strong>${restanteMin} min</strong> (até ${hora(r.limite)})</span>`
                : `<svg><use href="#i-relogio"/></svg><span>Prazo de devolução total encerrado às ${hora(r.limite)}</span>`}</p>
              ${cancelando === p.codigo ? `
                <div class="confirmar-cancelar">
                  <p>${r.pago ? `Você recebe de volta <strong>${moeda(r.valor)}</strong> de ${moeda(r.pago)} pagos.` : "Você ainda não pagou o sinal, então não há valor a devolver."}</p>
                  <button type="button" class="btn btn--perigo btn--pequeno" data-cancelar-ok="${escapar(p.codigo)}">Confirmar cancelamento</button>
                  <button type="button" class="link-simples" data-cancelar-nao>Manter reserva</button>
                </div>`
              : `<button type="button" class="link-simples" data-cancelar="${escapar(p.codigo)}">Cancelar reserva</button>`}
            </footer>` : ""}
        </article>`;
    }).join("");
  }

  /* ---------- acompanhar pedido ---------- */
  let pedidoAcompanhado = null;
  function prepararAcompanhar() {
    const f = $("#form-acompanhar");
    const codigo = new URLSearchParams(location.search).get("pedido");
    if (codigo && !f.codigo.value) f.codigo.value = codigo;
    $("#erro-acompanhar").hidden = true;
    const meu = codigo && S.meusPedidos.find((p) => p.codigo === codigo.toUpperCase());
    if (meu) { pedidoAcompanhado = meu.codigo; renderAcompanhar(meu); }
    else if (!pedidoAcompanhado) { $("#acompanhar-resultado").innerHTML = ""; (f.codigo.value ? f.final : f.codigo).focus({ preventScroll: true }); }
  }
  function renderAcompanhar(p) {
    const entrega = p.receber === "entrega";
    $("#acompanhar-resultado").innerHTML = `
      <article class="acompanhar__cartao">
        <header class="acompanhar__topo">
          <div>
            <span class="pedido__codigo">${escapar(p.codigo)}</span>
            <span class="pedido__data">${escapar(nomeTipo(p))} · ${dataHora(p.criadoEm)}${p.cliente?.nome ? ` · ${escapar(p.cliente.nome.split(" ")[0])}` : ""}</span>
          </div>
          <span class="status status--${["cancelado", "estornado"].includes(p.status) ? "cancelado" : p.status}">${escapar(Rastreio.situacao(p))}</span>
        </header>
        ${Rastreio.linha(p)}
        <div class="acompanhar__resumo">
          <ul class="pedido__itens">${p.itens.map((i) => `<li><span>${i.qtd}×</span>${escapar(i.nome)}<b>${moeda(i.preco * i.qtd)}</b></li>`).join("")}</ul>
          <dl class="pedido__valores">
            <div><dt>Total</dt><dd>${moeda(p.total)}</dd></div>
            <div><dt>${entrega ? "Entrega" : "Retirada"}</dt><dd>${entrega ? (p.prazoEntrega ? `até ${p.prazoEntrega} dias úteis` : "pelo CEP") : escapar(S.config.endereco || "na loja")}</dd></div>
          </dl>
        </div>
        <footer class="acompanhar__pe">
          <a class="btn btn--contorno" href="${escapar(linkWhats(`Oi! Quero falar sobre o pedido ${p.codigo}.`))}" target="_blank" rel="noopener">Falar com a loja</a>
          <button type="button" class="link-simples" data-copiar-texto="${escapar(Rastreio.linkAcompanhar(p.codigo))}">Copiar link deste pedido</button>
        </footer>
      </article>`;
  }
  $("#form-acompanhar").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    const erroEl = $("#erro-acompanhar");
    const codigo = f.codigo.value.trim().toUpperCase();
    if (!/^TMZ-[A-Z0-9]{5}$/.test(codigo)) { erroEl.textContent = "O código tem este formato: TMZ-AB12C. Ele está na mensagem do pedido."; erroEl.hidden = false; return f.codigo.focus(); }
    f.codigo.value = codigo;
    const botao = f.querySelector("button");
    botao.disabled = true;
    const p = await Dados.buscarPedido(codigo, f.final.value);
    botao.disabled = false;
    if (!p) {
      erroEl.textContent = digitos(f.final.value).length < 4 ? "Digite também os 4 últimos números do WhatsApp usado na compra." : "Não achamos esse pedido. Confira o código e os números do WhatsApp.";
      erroEl.hidden = false;
      $("#acompanhar-resultado").innerHTML = "";
      return;
    }
    erroEl.hidden = true;
    pedidoAcompanhado = p.codigo;
    renderAcompanhar(p);
  });
  // copiar código de rastreio ou link
  document.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-copiar-texto]");
    if (!b) return;
    try { await navigator.clipboard.writeText(b.dataset.copiarTexto); toast("Copiado"); }
    catch { prompt("Copie:", b.dataset.copiarTexto); }
  });

  $("#lista-reservas").addEventListener("click", async (e) => {
    const pedir = e.target.closest("[data-cancelar]");
    const ok = e.target.closest("[data-cancelar-ok]");
    if (pedir) { cancelando = pedir.dataset.cancelar; renderReservas(); return; }
    if (e.target.closest("[data-cancelar-nao]")) { cancelando = null; renderReservas(); return; }
    if (ok) {
      const p = S.meusPedidos.find((x) => x.codigo === ok.dataset.cancelarOk);
      if (!p) return;
      const r = Dados.reembolso(p);
      ok.disabled = true;
      try {
        await Dados.atualizarPedido(p.dono, p.codigo, { status: "cancelado", canceladoEm: Date.now(), canceladoPor: "cliente", reembolso: r.valor });
        toast(r.valor ? `Reserva cancelada. Devolução de ${moeda(r.valor)} em andamento.` : "Reserva cancelada.");
      } catch { toast("Não deu para cancelar agora. Tente de novo."); }
      cancelando = null;
      renderReservas();
    }
  });
  setInterval(() => { if (!$("#tela-reservas").hidden) renderReservas(); }, 30000);

  /* ---------- telas cheias (rotas por #) ---------- */
  const TELAS = { carrinho: "#tela-carrinho", compra: "#tela-compra", reservas: "#tela-reservas", medidas: "#tela-medidas", entrar: "#tela-entrar", painel: "#painel",
    acompanhar: "#tela-acompanhar", privacidade: "#tela-doc", trocas: "#tela-doc", termos: "#tela-doc" };
  let rolagemLoja = 0;
  let telaAtual = "";

  function rota() {
    const h = location.hash.slice(1);
    const nova = h in TELAS ? h : "";
    if (nova && !telaAtual) rolagemLoja = window.scrollY;
    Object.values(TELAS).forEach((sel) => { $(sel).hidden = sel !== TELAS[nova]; });
    document.body.classList.toggle("com-tela", !!nova);
    if (nova === "carrinho") renderCarrinho();
    if (nova === "compra") prepararCompra();
    if (nova === "reservas") { cancelando = null; renderReservas(); }
    if (nova === "acompanhar") prepararAcompanhar();
    if (nova && nova !== telaAtual) {
      $(TELAS[nova]).scrollTop = 0;
      $$("dialog[open]").forEach((d) => d.close());
    } else if (telaAtual) {
      window.scrollTo(0, rolagemLoja);
    }
    telaAtual = nova;
    window.dispatchEvent(new CustomEvent("tmz:rota", { detail: nova }));
  }
  window.addEventListener("hashchange", rota);
  // links "Voltar" (href="#") fecham a tela sem pular para o topo
  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href="#"]');
    if (!a || !telaAtual || a.id === "logo") return;
    e.preventDefault();
    history.pushState(null, "", location.pathname + location.search);
    rota();
  });

  /* ---------- toast ---------- */
  let timerToast;
  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.add("visivel");
    clearTimeout(timerToast);
    timerToast = setTimeout(() => el.classList.remove("visivel"), 2600);
  }

  $("#logo").addEventListener("click", (e) => {
    e.preventDefault();
    if (telaAtual) { history.pushState(null, "", location.pathname + location.search); rota(); }
    filtrar("todos");
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  /* ---------- "O que você procura?" ---------- */
  const modalProcura = $("#modal-procura");
  function estoqueCategoria(id) {
    const itens = S.produtos.filter((p) => p.categoria === id);
    return { itens: itens.length, estoque: itens.reduce((s, p) => s + estoque(p), 0) };
  }
  function abrirProcura() {
    const dados = S.categorias.map((c) => ({ c, ...estoqueCategoria(c.id) }));
    const maior = Math.max(1, ...dados.map((d) => d.estoque));
    $("#procura-grade").innerHTML = dados.map(({ c, itens, estoque: q }) => {
      const vazio = q === 0;
      const foto = imagemCat(c);
      const visual = foto ? `<img src="${escapar(foto)}" alt="" loading="lazy">` : `<svg class="opcao__icone"><use href="#i-${iconeCat(c.id)}"/></svg>`;
      const info = vazio
        ? `<span class="opcao__status">${itens === 0 ? "Em breve" : "Esgotado"}</span>`
        : `<span class="opcao__qtd"><strong>${q}</strong> ${q === 1 ? "peça" : "peças"}</span>
           <span class="opcao__nivel" style="--n:${Math.max(6, (q / maior) * 100)}%"></span>`;
      return `
        <button type="button" class="opcao${vazio ? " opcao--vazio" : ""}${!vazio && q <= 5 ? " opcao--baixo" : ""}" data-procura="${escapar(c.id)}" ${vazio ? "disabled" : ""}
          aria-label="${escapar(c.nome)}: ${vazio ? (itens === 0 ? "em breve" : "esgotado") : `${q} em estoque`}">
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
    $("#catalogo").scrollIntoView({ behavior: "smooth" });
  });

  /* ---------- avaliações ---------- */
  function estrelas(n) {
    return Array.from({ length: 5 }, (_, i) => `<svg class="${i < Math.round(n) ? "" : "apagada"}"><use href="#i-estrela"/></svg>`).join("");
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
  $("#comentarios").addEventListener("pointermove", (e) => {
    const card = e.target.closest(".depo");
    if (!card) return;
    const r = card.getBoundingClientRect();
    card.style.setProperty("--x", `${e.clientX - r.left}px`);
    card.style.setProperty("--y", `${e.clientY - r.top}px`);
  });
  renderComentarios();

  /* ---------- aviso do Instagram ---------- */
  const CHAVE_INSTA = "insta-minimizado";
  const insta = $("#insta");
  const bolha = $("#insta-bolha");
  function mostrarInsta(aberto) {
    insta.hidden = !aberto;
    $("#insta-fundo").hidden = !aberto;
    bolha.hidden = aberto;
    document.body.classList.toggle("com-aviso", aberto);
    if (aberto) insta.focus({ preventScroll: true });
    try { sessionStorage.setItem(CHAVE_INSTA, aberto ? "0" : "1"); } catch {}
  }
  $("#insta-fechar").addEventListener("click", () => mostrarInsta(false));
  $("#insta-cupom button").addEventListener("click", async () => {
    const codigo = $("#insta-cupom code").textContent;
    guardarCupom(codigo);
    try { await navigator.clipboard.writeText(codigo); } catch {}
    toast(`Cupom ${codigo} guardado: ele entra sozinho na finalização`);
  });
  bolha.addEventListener("click", () => mostrarInsta(true));
  let minimizado = false;
  try { minimizado = sessionStorage.getItem(CHAVE_INSTA) === "1"; } catch {}
  if (minimizado) bolha.hidden = false;
  else setTimeout(() => { if (!telaAtual) mostrarInsta(true); else bolha.hidden = false; }, 2500);

  /* ---------- quando os dados mudam ---------- */
  Dados.ouvir(() => {
    renderTextos();
    renderCategorias();
    filtrar(estado.filtro in { todos: 1, ofertas: 1 } || S.categorias.some((c) => c.id === estado.filtro) ? estado.filtro : "todos");
    renderMiniaturas();
    renderDestaques();
    renderProdutoDestaque();
    // tira do carrinho o que sumiu do catálogo
    Object.keys(estado.carrinho).forEach((id) => { if (!porId(id)) delete estado.carrinho[id]; });
    renderCarrinho();
    if (telaAtual === "compra" && $("#compra-ok").hidden) renderCompra();
    if (telaAtual === "reservas") renderReservas();
    if (telaAtual === "acompanhar" && pedidoAcompanhado) {
      const atual = [...S.meusPedidos, ...S.pedidos].find((p) => p.codigo === pedidoAcompanhado);
      if (atual) renderAcompanhar(atual);
    }
  });

  /* ---------- tema claro / escuro ---------- */
  function aplicarTema(escuro, animar) {
    const raiz = document.documentElement;
    if (animar) {
      raiz.classList.add("trocando-tema");
      setTimeout(() => raiz.classList.remove("trocando-tema"), 400);
    }
    if (escuro) raiz.dataset.tema = "escuro"; else delete raiz.dataset.tema;
    $$(".tema-btn").forEach((b) => {
      b.setAttribute("aria-label", escuro ? "Ativar modo claro" : "Ativar modo escuro");
      b.title = escuro ? "Modo claro" : "Modo escuro";
    });
    try { localStorage.setItem("tmz-tema", escuro ? "escuro" : "claro"); } catch {}
  }
  document.addEventListener("click", (e) => {
    if (e.target.closest(".tema-btn")) aplicarTema(document.documentElement.dataset.tema !== "escuro", true);
  });
  aplicarTema(document.documentElement.dataset.tema === "escuro");

  $("#ano").textContent = new Date().getFullYear();
  if (lerCep()) usarCep(lerCep());
  // Abre a tela do link só depois que todos os scripts carregaram (rastreio, medidas, painel…)
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", rota);
  else setTimeout(rota);

  // utilidades para o painel
  window.TMZ = { combinaDe, moeda, escapar, dataHora, hora, toast, iconeCat, imagemCat, categoria, nomeTipo, NOMES_STATUS, duracao, centavos, digitos, linkWhats };
})();
