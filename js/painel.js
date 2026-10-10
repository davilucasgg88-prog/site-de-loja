// Painel do lojista: estoque, produtos, categorias, textos do destaque, pedidos e reservas.
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const S = Dados.estado;
  const { moeda, escapar, dataHora, hora, toast, iconeCat, categoria, nomeTipo, NOMES_STATUS, centavos, digitos } = window.TMZ;
  const raiz = $("#painel");

  const ui = { aba: "resumo", filtro: "aguardando", busca: "", catFiltro: "", editando: null, cancelando: null, excluindo: null, aberto: false };

  const ABAS = [
    ["resumo", "Resumo", "i-painel"],
    ["pedidos", "Pedidos e reservas", "i-relogio"],
    ["produtos", "Produtos e estoque", "i-tag"],
    ["categorias", "Categorias", "i-sacola"],
    ["destaque", "Destaque e textos", "i-editar"],
    ["config", "Configurações", "i-loja"],
  ];

  const estoque = (p) => Math.max(0, Number(p.estoque) || 0);
  const tempo = (ms) => {
    const min = Math.round((Date.now() - ms) / 60000);
    if (min < 1) return "agora";
    if (min < 60) return `há ${min} min`;
    if (min < 1440) return `há ${Math.floor(min / 60)} h`;
    return dataHora(ms);
  };
  const pendentesEstorno = () => S.pedidos.filter((p) => p.status === "cancelado" && p.reembolso > 0);

  /* ---------- casca ---------- */
  function render() {
    if (!S.admin) return renderEntrada();
    const aguardando = S.pedidos.filter((p) => p.status === "aguardando").length;
    raiz.innerHTML = `
      <div class="painel">
        <aside class="painel__lado">
          <a href="#" class="painel__marca"><img src="img/logo-tmz.png" alt="TMZ" width="84" height="24"><span>Painel</span></a>
          <nav class="painel__nav">
            ${ABAS.map(([id, nome, icone]) => `
              <button type="button" class="${ui.aba === id ? "ativo" : ""}" data-aba="${id}">
                <svg><use href="#${icone}"/></svg><span>${nome}</span>
                ${id === "pedidos" && aguardando ? `<b class="contagem">${aguardando}</b>` : ""}
              </button>`).join("")}
          </nav>
          <div class="painel__pe">
            <a href="#" class="link-simples"><svg><use href="#i-voltar"/></svg>Ver a loja</a>
            ${S.modo === "local" ? `<button type="button" class="link-simples" data-sair>Sair do painel</button>` : ""}
          </div>
        </aside>
        <main class="painel__area" id="painel-area">
          ${S.modo === "local" ? `<p class="faixa-aviso">Modo de teste: as mudanças ficam salvas só neste navegador. Para valer para todos os clientes, o site precisa de um servidor (veja o README).</p>` : ""}
          <div id="painel-aba"></div>
        </main>
      </div>
      <div class="gaveta" id="gaveta" hidden></div>`;
    renderAba();
  }

  function renderEntrada() {
    raiz.innerHTML = `
      <div class="entrada">
        <a href="#" class="tela__voltar"><svg><use href="#i-voltar"/></svg><span>Voltar à loja</span></a>
        <div class="entrada__caixa">
          <img src="img/logo-tmz.png" alt="TMZ" width="110" height="31">
          <h1>Área do lojista</h1>
          ${S.modo === "nuvem"
            ? `<p>Só quem administra a loja acessa o painel. Entre com a conta do dono para continuar.</p>`
            : `<p>Digite o PIN do painel para gerenciar estoque, ofertas e reservas.</p>
               <form id="form-pin" class="entrada__form">
                 <label class="campo"><span>PIN</span><input id="pin" type="password" inputmode="numeric" autocomplete="current-password" required></label>
                 <p class="erro-form" id="erro-pin" role="alert" hidden>PIN incorreto.</p>
                 <button class="btn btn--bloco">Entrar</button>
               </form>
               <p class="entrada__nota">PIN inicial: 1234. Troque em Configurações depois de entrar.</p>`}
        </div>
      </div>`;
    $("#pin", raiz)?.focus();
  }

  function renderAba() {
    const alvo = $("#painel-aba", raiz);
    if (!alvo) return;
    alvo.innerHTML = ({ resumo, pedidos, produtos, categorias, destaque, config })[ui.aba]();
    if (ui.aba === "destaque") atualizarPrevia();
  }

  // Abas com formulário não são redesenhadas quando os dados mudam, para não apagar o que está sendo digitado
  const abasDeFormulario = ["categorias", "destaque", "config"];

  /* ---------- resumo ---------- */
  function resumo() {
    const aguardando = S.pedidos.filter((p) => p.status === "aguardando");
    const confirmados = S.pedidos.filter((p) => p.status === "confirmado");
    const baixos = S.produtos.filter((p) => estoque(p) <= 5).sort((a, b) => estoque(a) - estoque(b));
    const recebido = S.pedidos.filter((p) => p.pago && p.status !== "estornado").reduce((s, p) => s + (p.tipo === "compra" ? p.total : p.sinal), 0);
    const recentes = [...S.pedidos].sort((a, b) => b.criadoEm - a.criadoEm).slice(0, 5);
    return `
      <header class="painel__cabeca">
        <div><p class="rotulo">Hoje</p><h1>Resumo da loja</h1></div>
      </header>
      <div class="kpis">
        <button type="button" class="kpi" data-ir="pedidos" data-filtro="aguardando">
          <span>Aguardando pagamento</span><strong>${aguardando.length}</strong>
          <small>${moeda(aguardando.reduce((s, p) => s + p.sinal, 0))} a receber</small>
        </button>
        <button type="button" class="kpi" data-ir="pedidos" data-filtro="confirmado">
          <span>Para retirar ou enviar</span><strong>${confirmados.length}</strong>
          <small>${moeda(confirmados.reduce((s, p) => s + p.restante, 0))} ainda a receber</small>
        </button>
        <button type="button" class="kpi" data-ir="pedidos" data-filtro="cancelado">
          <span>Devoluções pendentes</span><strong>${pendentesEstorno().length}</strong>
          <small>${moeda(pendentesEstorno().reduce((s, p) => s + p.reembolso, 0))} para devolver</small>
        </button>
        <div class="kpi">
          <span>Recebido</span><strong>${moeda(recebido)}</strong>
          <small>Sinais e pedidos confirmados</small>
        </div>
      </div>
      <div class="duas-colunas">
        <section class="bloco">
          <header class="bloco__topo"><h2>Últimos pedidos</h2><button type="button" class="link-simples" data-ir="pedidos" data-filtro="todos">Ver todos</button></header>
          ${recentes.length ? `<ul class="lista-curta">${recentes.map((p) => `
            <li><span class="lista-curta__cod">${escapar(p.codigo)}</span><span>${escapar(p.cliente?.nome || "")}</span>
            <span class="status status--${p.status}">${NOMES_STATUS[p.status]}</span><b>${moeda(p.total)}</b></li>`).join("")}</ul>`
            : `<p class="vazio-curto">Nenhum pedido ainda. Eles aparecem aqui assim que alguém comprar ou reservar.</p>`}
        </section>
        <section class="bloco">
          <header class="bloco__topo"><h2>Estoque baixo</h2><button type="button" class="link-simples" data-ir="produtos">Gerenciar</button></header>
          ${baixos.length ? `<ul class="lista-curta">${baixos.slice(0, 6).map((p) => `
            <li><span>${escapar(p.nome)}</span><span class="lista-curta__cat">${escapar(categoria(p.categoria).nome)}</span>
            <b class="${estoque(p) === 0 ? "texto-alerta" : ""}">${estoque(p) === 0 ? "Esgotado" : `${estoque(p)} un.`}</b></li>`).join("")}</ul>`
            : `<p class="vazio-curto">Todos os produtos têm mais de 5 unidades.</p>`}
        </section>
      </div>`;
  }

  /* ---------- pedidos ---------- */
  const FILTROS = [["aguardando", "Aguardando"], ["confirmado", "Confirmados"], ["retirado", "Concluídos"], ["cancelado", "Cancelados"], ["todos", "Todos"]];

  function pedidos() {
    const contar = (f) => f === "todos" ? S.pedidos.length : f === "cancelado" ? S.pedidos.filter((p) => ["cancelado", "estornado"].includes(p.status)).length : S.pedidos.filter((p) => p.status === f).length;
    const lista = S.pedidos
      .filter((p) => ui.filtro === "todos" || (ui.filtro === "cancelado" ? ["cancelado", "estornado"].includes(p.status) : p.status === ui.filtro))
      .sort((a, b) => b.criadoEm - a.criadoEm);
    return `
      <header class="painel__cabeca">
        <div><p class="rotulo">Vendas</p><h1>Pedidos e reservas</h1></div>
      </header>
      <div class="filtros">${FILTROS.map(([id, nome]) => `<button type="button" class="filtro${ui.filtro === id ? " ativo" : ""}" data-filtro-pedido="${id}">${nome}<b>${contar(id)}</b></button>`).join("")}</div>
      <div class="pedidos pedidos--painel">
        ${lista.length ? lista.map(cartaoPedido).join("") : `<p class="vazio-curto">Nada por aqui.</p>`}
      </div>`;
  }

  function cartaoPedido(p) {
    const reserva = p.tipo !== "compra";
    const r = Dados.reembolso(p);
    const chave = `${p.dono}|${p.codigo}`;
    const zap = digitos(p.cliente?.telefone);
    let acoes = "";
    if (ui.cancelando === chave) {
      acoes = `
        <div class="confirmar-cancelar confirmar-cancelar--painel">
          <label class="campo campo--curto"><span>Valor a devolver</span><input type="number" step="0.01" min="0" id="valor-devolver" value="${r.valor.toFixed(2)}"></label>
          <p class="nota">${r.pago ? `Pela regra: ${r.dentro ? "dentro do prazo, devolve 100%" : `fora do prazo, devolve ${S.config.estornoDepoisPerc}%`} de ${moeda(r.pago)} pagos.` : "O sinal ainda não foi pago."}</p>
          ${p.estoqueBaixado ? `<label class="aceite"><input type="checkbox" id="voltar-estoque" checked><span>Voltar as peças para o estoque</span></label>` : ""}
          <div class="linha-botoes">
            <button type="button" class="btn btn--perigo btn--pequeno" data-acao="cancelar-ok" data-chave="${escapar(chave)}">Confirmar cancelamento</button>
            <button type="button" class="link-simples" data-acao="cancelar-nao">Voltar</button>
          </div>
        </div>`;
    } else if (p.status === "aguardando") {
      acoes = `<button type="button" class="btn btn--pequeno" data-acao="confirmar" data-chave="${escapar(chave)}"><svg><use href="#i-check"/></svg>${reserva ? `Sinal de ${moeda(p.sinal)} recebido` : "Pagamento recebido"}</button>
               <button type="button" class="link-simples" data-acao="cancelar" data-chave="${escapar(chave)}">Cancelar</button>`;
    } else if (p.status === "confirmado") {
      acoes = `<button type="button" class="btn btn--pequeno" data-acao="concluir" data-chave="${escapar(chave)}"><svg><use href="#i-check"/></svg>${p.receber === "entrega" ? "Marcar como enviado" : "Marcar como retirado"}${reserva && p.restante ? ` (+${moeda(p.restante)})` : ""}</button>
               <button type="button" class="link-simples" data-acao="cancelar" data-chave="${escapar(chave)}">Cancelar</button>`;
    } else if (p.status === "cancelado") {
      acoes = `${p.reembolso > 0 ? `<button type="button" class="btn btn--pequeno" data-acao="estornar" data-chave="${escapar(chave)}">Devolução de ${moeda(p.reembolso)} feita</button>` : ""}
               ${p.estoqueBaixado ? `<button type="button" class="link-simples" data-acao="repor" data-chave="${escapar(chave)}">Voltar peças ao estoque</button>` : ""}`;
    } else if (p.status === "estornado" && p.estoqueBaixado) {
      acoes = `<button type="button" class="link-simples" data-acao="repor" data-chave="${escapar(chave)}">Voltar peças ao estoque</button>`;
    }
    return `
      <article class="pedido">
        <header class="pedido__topo">
          <div><span class="pedido__codigo">${escapar(p.codigo)}</span><span class="pedido__data">${tempo(p.criadoEm)}</span></div>
          <span class="etiqueta">${escapar(nomeTipo(p))}</span>
          <span class="status status--${p.status}">${NOMES_STATUS[p.status]}</span>
        </header>
        <div class="pedido__cliente">
          <strong>${escapar(p.cliente?.nome)}</strong>
          ${zap ? `<a href="https://wa.me/55${zap.replace(/^55/, "")}?text=${encodeURIComponent(`Oi, ${p.cliente.nome.split(" ")[0]}! Sobre o pedido ${p.codigo} na ${S.config.nome}:`)}" target="_blank" rel="noopener">${escapar(p.cliente.telefone)}</a>` : ""}
          <span>${p.receber === "entrega" ? `Entrega · ${escapar(p.cliente?.endereco)} · CEP ${escapar(p.cliente?.cep)}` : "Retirada na loja"}</span>
        </div>
        <ul class="pedido__itens">${p.itens.map((i) => `<li><span>${i.qtd}×</span>${escapar(i.nome)}<b>${moeda(i.preco * i.qtd)}</b></li>`).join("")}</ul>
        <dl class="pedido__valores">
          <div><dt>Total</dt><dd>${moeda(p.total)}</dd></div>
          ${reserva ? `<div><dt>Sinal</dt><dd>${moeda(p.sinal)}${p.pago ? " · pago" : ""}</dd></div><div><dt>Restante</dt><dd>${moeda(p.restante)}</dd></div>` : `<div><dt>Pagamento</dt><dd>${escapar(p.pagamento)}</dd></div>`}
          ${p.reembolso != null && ["cancelado", "estornado"].includes(p.status) ? `<div><dt>Devolver</dt><dd>${moeda(p.reembolso)}</dd></div>` : ""}
        </dl>
        ${reserva && ["aguardando", "confirmado"].includes(p.status) ? `<p class="pedido__prazo"><svg><use href="#i-relogio"/></svg><span>${r.dentro ? `Devolução total se cancelar até ${hora(r.limite)}` : `Desde ${hora(r.limite)} a devolução é de ${S.config.estornoDepoisPerc}%`}</span></p>` : ""}
        ${p.status === "cancelado" && p.canceladoPor ? `<p class="pedido__prazo">Cancelado ${p.canceladoPor === "cliente" ? "pelo cliente" : "pela loja"} em ${dataHora(p.canceladoEm)}</p>` : ""}
        ${acoes ? `<footer class="pedido__acoes">${acoes}</footer>` : ""}
      </article>`;
  }

  async function acaoPedido(acao, chave, botao) {
    if (acao === "cancelar-nao") { ui.cancelando = null; return renderAba(); }
    if (acao === "cancelar") { ui.cancelando = chave; return renderAba(); }
    const [dono, codigo] = chave.split("|");
    const p = S.pedidos.find((x) => x.dono === dono && x.codigo === codigo);
    if (!p) return;
    botao && (botao.disabled = true);
    try {
      if (acao === "confirmar") {
        for (const i of p.itens) await Dados.ajustarEstoque(i.id, -i.qtd);
        await Dados.atualizarPedido(dono, codigo, { status: "confirmado", pago: true, estoqueBaixado: true, confirmadoEm: Date.now() });
        toast("Pagamento confirmado e estoque atualizado");
      }
      if (acao === "concluir") {
        await Dados.atualizarPedido(dono, codigo, { status: "retirado", concluidoEm: Date.now() });
        toast("Pedido concluído");
      }
      if (acao === "cancelar-ok") {
        const valor = centavos(Math.max(0, Number($("#valor-devolver", raiz)?.value) || 0));
        const repor = p.estoqueBaixado && $("#voltar-estoque", raiz)?.checked;
        if (repor) for (const i of p.itens) await Dados.ajustarEstoque(i.id, i.qtd);
        await Dados.atualizarPedido(dono, codigo, { status: valor > 0 ? "cancelado" : "estornado", canceladoEm: Date.now(), canceladoPor: "loja", reembolso: valor, estoqueBaixado: p.estoqueBaixado && !repor });
        ui.cancelando = null;
        toast(valor > 0 ? `Cancelado. Devolva ${moeda(valor)} ao cliente.` : "Pedido cancelado");
      }
      if (acao === "estornar") {
        await Dados.atualizarPedido(dono, codigo, { status: "estornado", estornadoEm: Date.now() });
        toast("Devolução registrada");
      }
      if (acao === "repor") {
        for (const i of p.itens) await Dados.ajustarEstoque(i.id, i.qtd);
        await Dados.atualizarPedido(dono, codigo, { estoqueBaixado: false });
        toast("Peças devolvidas ao estoque");
      }
    } catch { toast("Não deu para salvar. Tente de novo."); }
    renderAba();
  }

  /* ---------- produtos ---------- */
  function produtos() {
    const termo = ui.busca.trim().toLowerCase();
    const lista = S.produtos.filter((p) => (!ui.catFiltro || p.categoria === ui.catFiltro) && (!termo || p.nome.toLowerCase().includes(termo)));
    const total = S.produtos.reduce((s, p) => s + estoque(p), 0);
    return `
      <header class="painel__cabeca">
        <div><p class="rotulo">Catálogo</p><h1>Produtos e estoque</h1><p class="painel__sub">${S.produtos.length} produtos · ${total} peças em estoque</p></div>
        <button type="button" class="btn" data-novo-produto><svg><use href="#i-mais"/></svg>Novo produto</button>
      </header>
      <div class="barra-ferramentas">
        <label class="campo campo--busca"><span class="sr">Buscar produto</span><input type="search" id="busca-produto" placeholder="Buscar produto" value="${escapar(ui.busca)}"></label>
        <label class="campo campo--curto"><span class="sr">Categoria</span>
          <select id="filtro-categoria"><option value="">Todas as categorias</option>${S.categorias.map((c) => `<option value="${escapar(c.id)}" ${ui.catFiltro === c.id ? "selected" : ""}>${escapar(c.nome)}</option>`).join("")}</select>
        </label>
      </div>
      <div class="tabela-produtos" role="table" aria-label="Produtos">
        <div class="tp-linha tp-cabeca" role="row"><span>Produto</span><span>Preço</span><span>Estoque</span><span>Entrada</span><span>Oferta</span><span></span></div>
        ${lista.map((p) => `
          <div class="tp-linha${estoque(p) === 0 ? " tp-linha--zerada" : ""}" role="row">
            <div class="tp-produto">
              <span class="tp-foto">${p.imagem ? `<img src="${escapar(p.imagem)}" alt="">` : `<svg><use href="#i-${iconeCat(p.categoria)}"/></svg>`}</span>
              <span><strong>${escapar(p.nome)}</strong><small>${escapar(categoria(p.categoria).nome)}</small></span>
            </div>
            <div class="tp-preco"><strong>${moeda(p.preco)}</strong>${p.precoAntigo > p.preco ? `<s>${moeda(p.precoAntigo)}</s>` : ""}</div>
            <div class="contador-qtd contador-qtd--painel" aria-label="Estoque de ${escapar(p.nome)}">
              <button type="button" data-estoque="-1" data-id="${escapar(p.id)}" aria-label="Tirar uma unidade" ${estoque(p) === 0 ? "disabled" : ""}><svg><use href="#i-menos"/></svg></button>
              <output class="${estoque(p) <= 5 ? "baixo" : ""}">${estoque(p)}</output>
              <button type="button" data-estoque="1" data-id="${escapar(p.id)}" aria-label="Somar uma unidade"><svg><use href="#i-mais"/></svg></button>
            </div>
            <form class="tp-entrada" data-entrada="${escapar(p.id)}">
              <input type="number" min="1" step="1" placeholder="+ qtd" aria-label="Quantidade que chegou de ${escapar(p.nome)}">
              <button type="submit" class="btn btn--contorno btn--pequeno">Somar</button>
            </form>
            <label class="interruptor" title="Mostrar em Ofertas do dia">
              <input type="checkbox" data-oferta="${escapar(p.id)}" ${p.oferta ? "checked" : ""}><span></span><b class="sr">Em oferta</b>
            </label>
            <div class="tp-acoes">
              <button type="button" class="icone-acao" data-editar="${escapar(p.id)}" aria-label="Editar ${escapar(p.nome)}"><svg><use href="#i-editar"/></svg></button>
              ${ui.excluindo === p.id
                ? `<button type="button" class="btn btn--perigo btn--pequeno" data-excluir-ok="${escapar(p.id)}">Excluir?</button>`
                : `<button type="button" class="icone-acao" data-excluir="${escapar(p.id)}" aria-label="Excluir ${escapar(p.nome)}"><svg><use href="#i-lixo"/></svg></button>`}
            </div>
          </div>`).join("")}
        ${lista.length ? "" : `<p class="vazio-curto">Nenhum produto encontrado.</p>`}
      </div>`;
  }

  function abrirEditor(id) {
    const novo = id === "novo";
    const p = novo ? { nome: "", categoria: S.categorias[0]?.id || "", preco: "", precoAntigo: "", estoque: 0, descricao: "", imagem: "", oferta: false } : S.produtos.find((x) => x.id === id);
    if (!p) return;
    ui.editando = id;
    const g = $("#gaveta", raiz);
    g.hidden = false;
    g.innerHTML = `
      <div class="gaveta__fundo" data-fechar-gaveta></div>
      <form class="gaveta__painel" id="form-produto" novalidate>
        <header class="gaveta__topo">
          <h2>${novo ? "Novo produto" : "Editar produto"}</h2>
          <button type="button" class="fechar" data-fechar-gaveta aria-label="Fechar"><svg><use href="#i-fechar"/></svg></button>
        </header>
        <div class="gaveta__corpo">
          <div class="foto-campo">
            <div class="foto-campo__previa" id="previa-foto">${p.imagem ? `<img src="${escapar(p.imagem)}" alt="">` : `<svg><use href="#i-upload"/></svg>`}</div>
            <div>
              <label class="btn btn--contorno btn--pequeno"><svg><use href="#i-upload"/></svg>Enviar foto<input type="file" accept="image/*" id="foto-arquivo" hidden></label>
              <p class="nota">JPG ou PNG. A foto é reduzida automaticamente.</p>
              <input type="hidden" name="imagem" value="${escapar(p.imagem)}">
            </div>
          </div>
          <label class="campo"><span>Nome</span><input name="nome" value="${escapar(p.nome)}" required></label>
          <label class="campo"><span>Categoria</span>
            <select name="categoria">${S.categorias.map((c) => `<option value="${escapar(c.id)}" ${p.categoria === c.id ? "selected" : ""}>${escapar(c.nome)}</option>`).join("")}</select>
          </label>
          <div class="campos-2">
            <label class="campo"><span>Preço (R$)</span><input name="preco" type="number" step="0.01" min="0" value="${escapar(p.preco)}" required></label>
            <label class="campo"><span>Preço antigo <em>opcional</em></span><input name="precoAntigo" type="number" step="0.01" min="0" value="${escapar(p.precoAntigo || "")}"></label>
          </div>
          <label class="campo"><span>Estoque (unidades)</span><input name="estoque" type="number" step="1" min="0" value="${escapar(estoque(p))}"></label>
          <label class="campo"><span>Descrição</span><textarea name="descricao" rows="4">${escapar(p.descricao)}</textarea></label>
          <label class="aceite"><input type="checkbox" name="oferta" ${p.oferta ? "checked" : ""}><span>Mostrar em <strong>Ofertas do dia</strong></span></label>
          <p class="erro-form" id="erro-produto" role="alert" hidden></p>
        </div>
        <footer class="gaveta__rodape">
          <button type="button" class="link-simples" data-fechar-gaveta>Cancelar</button>
          <button class="btn" type="submit">${novo ? "Cadastrar produto" : "Salvar alterações"}</button>
        </footer>
      </form>`;
    $("[name=nome]", g).focus();
  }

  function fecharEditor() {
    ui.editando = null;
    const g = $("#gaveta", raiz);
    if (g) { g.hidden = true; g.innerHTML = ""; }
  }

  // Reduz a foto para caber no banco (no máximo ~700 px)
  function reduzirFoto(arquivo) {
    return new Promise((ok, falha) => {
      const leitor = new FileReader();
      leitor.onerror = falha;
      leitor.onload = () => {
        const im = new Image();
        im.onerror = falha;
        im.onload = () => {
          const escala = Math.min(1, 700 / Math.max(im.width, im.height));
          const c = document.createElement("canvas");
          c.width = Math.round(im.width * escala);
          c.height = Math.round(im.height * escala);
          const ctx = c.getContext("2d");
          ctx.fillStyle = "#0b0b0c";
          ctx.fillRect(0, 0, c.width, c.height);
          ctx.drawImage(im, 0, 0, c.width, c.height);
          ok(c.toDataURL("image/jpeg", 0.82));
        };
        im.src = leitor.result;
      };
      leitor.readAsDataURL(arquivo);
    });
  }

  async function salvarEditor(form) {
    const f = Object.fromEntries(new FormData(form));
    const erroEl = $("#erro-produto", raiz);
    const preco = centavos(f.preco);
    if (!f.nome.trim()) { erroEl.textContent = "Dê um nome ao produto."; erroEl.hidden = false; return; }
    if (!(preco > 0)) { erroEl.textContent = "Informe o preço."; erroEl.hidden = false; return; }
    const antigo = S.produtos.find((x) => x.id === ui.editando) || {};
    const produto = {
      ...antigo,
      id: ui.editando === "novo" ? undefined : ui.editando,
      nome: f.nome.trim(), categoria: f.categoria, preco,
      precoAntigo: f.precoAntigo ? centavos(f.precoAntigo) : null,
      estoque: Math.max(0, parseInt(f.estoque, 10) || 0),
      descricao: f.descricao.trim(), imagem: f.imagem, oferta: form.oferta.checked,
    };
    const botao = form.querySelector("[type=submit]");
    botao.disabled = true;
    try {
      await Dados.salvarProduto(produto);
      toast(ui.editando === "novo" ? "Produto cadastrado" : "Produto salvo");
      fecharEditor();
      renderAba();
    } catch {
      erroEl.textContent = "Não deu para salvar. Se a foto for muito grande, tente outra.";
      erroEl.hidden = false;
      botao.disabled = false;
    }
  }

  /* ---------- categorias ---------- */
  const slug = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "cat";

  function categorias() {
    return `
      <header class="painel__cabeca">
        <div><p class="rotulo">Organização</p><h1>Categorias</h1><p class="painel__sub">Aparecem no menu lateral, nos círculos e na tela "O que você procura?".</p></div>
      </header>
      <form id="form-categorias" class="bloco">
        <ul class="lista-categorias" id="lista-categorias">
          ${S.categorias.map((c) => {
            const qtd = S.produtos.filter((p) => p.categoria === c.id).length;
            return `
            <li data-cat-id="${escapar(c.id)}">
              <span class="tp-foto">${c.imagem ? `<img src="${escapar(c.imagem)}" alt="">` : `<svg><use href="#i-${iconeCat(c.id)}"/></svg>`}</span>
              <label class="campo"><span class="sr">Nome</span><input value="${escapar(c.nome)}" data-nome-cat></label>
              <input type="hidden" value="${escapar(c.imagem || "")}" data-img-cat>
              <span class="lista-categorias__qtd">${qtd} ${qtd === 1 ? "produto" : "produtos"}</span>
              <label class="icone-acao" title="Trocar foto"><svg><use href="#i-upload"/></svg><input type="file" accept="image/*" data-foto-cat hidden></label>
              <button type="button" class="icone-acao" data-remover-cat ${qtd ? `disabled title="Mova ou exclua os produtos antes"` : `aria-label="Remover categoria"`}><svg><use href="#i-lixo"/></svg></button>
            </li>`;
          }).join("")}
        </ul>
        <div class="nova-categoria">
          <label class="campo"><span>Nova categoria</span><input id="nova-categoria" placeholder="Ex.: Celulares"></label>
          <button type="button" class="btn btn--contorno" data-add-cat><svg><use href="#i-mais"/></svg>Adicionar</button>
        </div>
        <footer class="bloco__rodape"><button class="btn">Salvar categorias</button></footer>
      </form>`;
  }

  function lerCategoriasDoForm() {
    return [...raiz.querySelectorAll("#lista-categorias li")].map((li) => {
      const atual = S.categorias.find((c) => c.id === li.dataset.catId) || {};
      const imagem = li.querySelector("[data-img-cat]").value;
      return { ...atual, id: li.dataset.catId, nome: li.querySelector("[data-nome-cat]").value.trim() || li.dataset.catId, imagem: imagem || undefined };
    });
  }

  /* ---------- destaque ---------- */
  function destaque() {
    const c = S.config;
    const campo = (nome, rotulo, extra = "") => `<label class="campo"><span>${rotulo}</span><input name="${nome}" value="${escapar(c[nome] || "")}" ${extra}></label>`;
    return `
      <header class="painel__cabeca">
        <div><p class="rotulo">Vitrine</p><h1>Destaque e textos</h1><p class="painel__sub">O que o cliente vê logo ao entrar no site.</p></div>
      </header>
      <form id="form-destaque" class="form-painel">
        <section class="bloco">
          <h2>Destaque principal</h2>
          <div class="previa-hero" aria-hidden="true"><div id="previa-titulo"></div><p id="previa-sub"></p></div>
          <div class="campos-3">${campo("linha1", "Linha 1")}${campo("linha2", "Linha 2")}${campo("linha3", "Linha 3")}</div>
          <div class="campos-2">${campo("vazada", "Palavra vazada (só contorno)")}${campo("botao", "Texto do botão")}</div>
          ${campo("sub", "Subtítulo")}
          <label class="campo"><span>Texto</span><textarea name="texto" rows="3">${escapar(c.texto || "")}</textarea></label>
        </section>
        <section class="bloco">
          <h2>Banner de oferta</h2>
          <div class="campos-2">${campo("bannerTag", "Etiqueta")}${campo("bannerTitulo", "Título")}</div>
          <div class="campos-2">${campo("bannerSub", "Subtítulo")}${campo("bannerBotao", "Texto do botão")}</div>
          ${campo("bannerTexto", "Texto")}
        </section>
        <section class="bloco">
          <h2>Faixa do topo</h2>
          <label class="campo"><span>Um aviso por linha</span><textarea name="avisos" rows="4">${escapar((c.avisos || []).join("\n"))}</textarea></label>
        </section>
        <footer class="barra-salvar"><button class="btn">Salvar textos</button></footer>
      </form>`;
  }

  function atualizarPrevia() {
    const f = $("#form-destaque", raiz);
    if (!f) return;
    const vaz = f.vazada.value.trim().toLowerCase();
    $("#previa-titulo", raiz).innerHTML = [f.linha1.value, f.linha2.value, f.linha3.value].filter(Boolean).map((l) => {
      const i = vaz ? l.toLowerCase().lastIndexOf(vaz) : -1;
      return i < 0 ? escapar(l) : escapar(l.slice(0, i)) + `<span>${escapar(l.slice(i, i + vaz.length))}</span>` + escapar(l.slice(i + vaz.length));
    }).join("<br>");
    $("#previa-sub", raiz).textContent = f.sub.value;
  }

  /* ---------- configurações ---------- */
  function config() {
    const c = S.config;
    const campo = (nome, rotulo, tipo = "text", extra = "") => `<label class="campo"><span>${rotulo}</span><input name="${nome}" type="${tipo}" value="${escapar(c[nome] ?? "")}" ${extra}></label>`;
    return `
      <header class="painel__cabeca">
        <div><p class="rotulo">Loja</p><h1>Configurações</h1></div>
      </header>
      <form id="form-config" class="form-painel">
        <section class="bloco">
          <h2>Contato</h2>
          <div class="campos-2">${campo("whatsapp", "WhatsApp da loja (com DDI e DDD)", "tel", 'placeholder="5511999999999"')}${campo("instagram", "Link do Instagram", "url")}</div>
        </section>
        <section class="bloco">
          <h2>Pix para os sinais</h2>
          <div class="campos-2">${campo("pixChave", "Chave Pix")}${campo("pixNome", "Nome de quem recebe")}</div>
          <p class="nota">Sem chave cadastrada, o cliente pede a chave pelo WhatsApp.</p>
        </section>
        <section class="bloco">
          <h2>Frete</h2>
          <div class="campos-2">${campo("frete", "Valor do frete (R$)", "number", 'step="0.01" min="0"')}${campo("freteGratisAcima", "Frete grátis acima de (R$)", "number", 'step="0.01" min="0"')}</div>
        </section>
        <section class="bloco">
          <h2>Regras de reserva</h2>
          <div class="campos-2">${campo("reservaPercentual", "Reserva com retirada: % pago agora", "number", 'min="1" max="99"')}${campo("reservaFixa", "Reserva fixa: valor pago agora (R$)", "number", 'step="0.01" min="1"')}</div>
          <div class="campos-2">${campo("estornoJanelaMin", "Prazo para devolução total (minutos)", "number", 'min="0"')}${campo("estornoDepoisPerc", "Depois do prazo, devolve (% do sinal)", "number", 'min="0" max="100"')}</div>
          <p class="nota">Hoje: quem desiste em até ${escapar(c.estornoJanelaMin)} minutos recebe o sinal inteiro de volta; depois disso, recebe ${escapar(c.estornoDepoisPerc)}%. Mudanças valem para as próximas reservas.</p>
        </section>
        ${S.modo === "local" ? `
        <section class="bloco">
          <h2>Acesso ao painel</h2>
          ${campo("pinPainel", "PIN do painel", "text", 'inputmode="numeric" minlength="4"')}
          <p class="nota">Este PIN só protege o modo de teste. Numa loja no ar, o acesso deve ser por login no servidor.</p>
        </section>` : ""}
        <footer class="barra-salvar"><button class="btn">Salvar configurações</button></footer>
      </form>`;
  }

  /* ---------- eventos ---------- */
  raiz.addEventListener("click", async (e) => {
    const t = e.target;
    const aba = t.closest("[data-aba]");
    if (aba) { ui.aba = aba.dataset.aba; ui.cancelando = null; ui.excluindo = null; render(); $("#painel").scrollTop = 0; return; }
    const ir = t.closest("[data-ir]");
    if (ir) { ui.aba = ir.dataset.ir; if (ir.dataset.filtro) ui.filtro = ir.dataset.filtro; render(); return; }
    if (t.closest("[data-sair]")) { Dados.sairPainelLocal(); location.hash = ""; return; }
    const filtro = t.closest("[data-filtro-pedido]");
    if (filtro) { ui.filtro = filtro.dataset.filtroPedido; ui.cancelando = null; renderAba(); return; }
    const acao = t.closest("[data-acao]");
    if (acao) { acaoPedido(acao.dataset.acao, acao.dataset.chave, acao); return; }

    // produtos
    if (t.closest("[data-novo-produto]")) return abrirEditor("novo");
    const editar = t.closest("[data-editar]");
    if (editar) return abrirEditor(editar.dataset.editar);
    if (t.closest("[data-fechar-gaveta]")) return fecharEditor();
    const excluir = t.closest("[data-excluir]");
    if (excluir) { ui.excluindo = excluir.dataset.excluir; return renderAba(); }
    const excluirOk = t.closest("[data-excluir-ok]");
    if (excluirOk) {
      await Dados.apagarProduto(excluirOk.dataset.excluirOk);
      ui.excluindo = null; toast("Produto excluído"); return renderAba();
    }
    const est = t.closest("[data-estoque]");
    if (est) { est.disabled = true; await Dados.ajustarEstoque(est.dataset.id, Number(est.dataset.estoque)); return; }

    // categorias
    if (t.closest("[data-add-cat]")) {
      const campo = $("#nova-categoria", raiz);
      const nome = campo.value.trim();
      if (!nome) return campo.focus();
      let id = slug(nome);
      const ids = new Set(lerCategoriasDoForm().map((c) => c.id));
      while (ids.has(id)) id += "-2";
      await Dados.salvarCategorias([...lerCategoriasDoForm(), { id, nome }]);
      toast(`Categoria ${nome} criada`);
      return renderAba();
    }
    const rem = t.closest("[data-remover-cat]");
    if (rem && !rem.disabled) {
      const id = rem.closest("li").dataset.catId;
      await Dados.salvarCategorias(lerCategoriasDoForm().filter((c) => c.id !== id));
      toast("Categoria removida");
      return renderAba();
    }
  });

  raiz.addEventListener("change", async (e) => {
    const t = e.target;
    if (t.matches("[data-oferta]")) {
      const p = S.produtos.find((x) => x.id === t.dataset.oferta);
      if (p) { await Dados.salvarProduto({ ...p, oferta: t.checked }); toast(t.checked ? "Produto em Ofertas do dia" : "Produto saiu das ofertas"); }
    }
    if (t.id === "filtro-categoria") { ui.catFiltro = t.value; renderAba(); }
    if (t.id === "foto-arquivo" && t.files[0]) {
      try {
        const url = await reduzirFoto(t.files[0]);
        $("#form-produto [name=imagem]", raiz).value = url;
        $("#previa-foto", raiz).innerHTML = `<img src="${url}" alt="">`;
      } catch { toast("Não deu para ler essa imagem"); }
    }
    if (t.matches("[data-foto-cat]") && t.files[0]) {
      try {
        const url = await reduzirFoto(t.files[0]);
        const li = t.closest("li");
        li.querySelector("[data-img-cat]").value = url;
        li.querySelector(".tp-foto").innerHTML = `<img src="${url}" alt="">`;
      } catch { toast("Não deu para ler essa imagem"); }
    }
  });

  raiz.addEventListener("input", (e) => {
    if (e.target.id === "busca-produto") {
      ui.busca = e.target.value;
      const pos = e.target.selectionStart;
      renderAba();
      const campo = $("#busca-produto", raiz);
      campo.focus();
      campo.setSelectionRange(pos, pos);
    }
    if (e.target.closest("#form-destaque")) atualizarPrevia();
  });

  raiz.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    const botao = f.querySelector("button:not([type=button])");
    if (f.id === "form-pin") {
      if (Dados.entrarPainelLocal($("#pin", raiz).value)) render();
      else { $("#erro-pin", raiz).hidden = false; $("#pin", raiz).select(); }
      return;
    }
    if (f.matches("[data-entrada]")) {
      const n = parseInt(f.querySelector("input").value, 10);
      if (!(n > 0)) return f.querySelector("input").focus();
      await Dados.ajustarEstoque(f.dataset.entrada, n);
      toast(`+${n} no estoque`);
      return;
    }
    if (f.id === "form-produto") return salvarEditor(f);
    if (botao) botao.disabled = true;
    try {
      if (f.id === "form-categorias") {
        await Dados.salvarCategorias(lerCategoriasDoForm());
        toast("Categorias salvas");
      }
      if (f.id === "form-destaque") {
        const d = Object.fromEntries(new FormData(f));
        d.avisos = d.avisos.split("\n").map((l) => l.trim()).filter(Boolean);
        await Dados.salvarConfig(d);
        toast("Textos salvos. Já aparecem na loja.");
      }
      if (f.id === "form-config") {
        const d = Object.fromEntries(new FormData(f));
        ["frete", "freteGratisAcima", "reservaPercentual", "reservaFixa", "estornoJanelaMin", "estornoDepoisPerc"].forEach((k) => { d[k] = Math.max(0, Number(d[k]) || 0); });
        d.reservaPercentual = Math.min(99, Math.max(1, d.reservaPercentual));
        d.estornoDepoisPerc = Math.min(100, d.estornoDepoisPerc);
        d.whatsapp = digitos(d.whatsapp);
        if (d.pinPainel !== undefined && String(d.pinPainel).trim().length < 4) { toast("O PIN precisa de pelo menos 4 números"); return; }
        await Dados.salvarConfig(d);
        toast("Configurações salvas");
        renderAba();
      }
    } catch { toast("Não deu para salvar. Tente de novo."); }
    finally { if (botao) botao.disabled = false; }
  });

  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && ui.editando) fecharEditor(); });

  /* ---------- quando abrir e quando os dados mudarem ---------- */
  window.addEventListener("tmz:rota", (e) => {
    ui.aberto = e.detail === "painel";
    if (ui.aberto) render();
  });
  // abriu o site direto em #painel
  if (location.hash === "#painel") { ui.aberto = true; render(); }
  let eraAdmin = S.admin;
  Dados.ouvir(() => {
    if (!ui.aberto) return;
    if (S.admin !== eraAdmin) { eraAdmin = S.admin; return render(); }
    if (ui.editando || abasDeFormulario.includes(ui.aba) || raiz.contains(document.activeElement) && document.activeElement.matches("input[type=number], #busca-produto")) {
      // só atualiza o contador do menu
      const aguardando = S.pedidos.filter((p) => p.status === "aguardando").length;
      const b = raiz.querySelector('[data-aba="pedidos"]');
      if (b) { b.querySelector(".contagem")?.remove(); if (aguardando) b.insertAdjacentHTML("beforeend", `<b class="contagem">${aguardando}</b>`); }
      return;
    }
    render();
  });
})();
