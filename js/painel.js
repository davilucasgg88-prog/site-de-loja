// Painel do lojista: estoque, produtos, categorias, textos do destaque, pedidos e reservas.
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const S = Dados.estado;
  const { combinaDe, moeda, escapar, dataHora, hora, toast, iconeCat, categoria, nomeTipo, NOMES_STATUS, centavos, digitos } = window.TMZ;
  const raiz = $("#painel");

  const ui = { periodo: 30, histPeriodo: 30, histStatus: "todos", histBusca: "", soOfertas: false, aba: "resumo", filtro: "aguardando", busca: "", catFiltro: "", editando: null, cancelando: null, excluindo: null, aberto: false };

  const ABAS = [
    ["resumo", "Resumo", "i-painel"],
    ["faturamento", "Faturamento", "i-grafico"],
    ["pedidos", "Pedidos e reservas", "i-relogio"],
    ["historico", "Histórico de compras", "i-lista"],
    ["clientes", "Clientes", "i-usuario"],
    ["visitas", "Visitas", "i-olho"],
    ["produtos", "Produtos e preços", "i-tag"],
    ["categorias", "Categorias", "i-sacola"],
    ["destaque", "Destaque e textos", "i-editar"],
    ["medidas", "Medidas", "i-regua"],
    ["contato", "Contato e links", "i-link"],
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
            <button type="button" class="link-simples tema-btn"><svg class="lua"><use href="#i-lua"/></svg><svg class="sol"><use href="#i-sol"/></svg>Trocar tema</button>
            <a href="#" class="link-simples"><svg><use href="#i-voltar"/></svg>Ver a loja</a>
            <button type="button" class="link-simples" data-sair>Sair da conta</button>
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

  // Sem o dono logado, o painel mostra a tela de entrar (js/conta.js)
  function renderEntrada() {
    Conta.montar(raiz, { painel: true });
  }

  function renderAba() {
    const alvo = $("#painel-aba", raiz);
    if (!alvo) return;
    alvo.innerHTML = ({ resumo, faturamento, pedidos, historico, clientes, visitas, produtos, categorias, destaque, config, medidas, contato })[ui.aba]();
    if (ui.aba === "destaque") atualizarPrevia();
    if (ui.aba === "clientes") carregarClientes();
  }

  // Abas com formulário não são redesenhadas quando os dados mudam, para não apagar o que está sendo digitado
  const abasDeFormulario = ["clientes", "categorias", "destaque", "config", "medidas", "contato"];

  /* ---------- resumo ---------- */
  function resumo() {
    const aguardando = S.pedidos.filter((p) => p.status === "aguardando");
    const confirmados = S.pedidos.filter((p) => p.status === "confirmado");
    const baixos = S.produtos.filter((p) => estoque(p) <= 5).sort((a, b) => estoque(a) - estoque(b));
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
        <button type="button" class="kpi" data-ir="faturamento">
          <span>Faturamento · 30 dias</span><strong>${moeda(somaPeriodo(30))}</strong>
          <small>Hoje: ${moeda(somaPeriodo(1))}</small>
        </button>
        <button type="button" class="kpi" data-ir="visitas">
          <span>Visitas hoje</span><strong>${visitasDoDia(0).pessoas}</strong>
          <small>${visitasDoDia(0).vistas} páginas abertas</small>
        </button>
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
    const lista = S.produtos.filter((p) => (!ui.catFiltro || p.categoria === ui.catFiltro) && (!ui.soOfertas || p.oferta) && (!termo || p.nome.toLowerCase().includes(termo)));
    const total = S.produtos.reduce((s, p) => s + estoque(p), 0);
    return `
      <header class="painel__cabeca">
        <div><p class="rotulo">Catálogo</p><h1>Produtos e estoque</h1><p class="painel__sub">${S.produtos.length} produtos · ${total} peças em estoque</p></div>
        <button type="button" class="btn" data-novo-produto><svg><use href="#i-mais"/></svg>Novo produto</button>
      </header>
      <div class="barra-ferramentas">
        <label class="campo campo--busca"><span class="sr">Buscar produto</span><input type="search" id="busca-produto" placeholder="Buscar produto" value="${escapar(ui.busca)}"></label>
        <label class="campo campo--curto"><span class="sr">Categoria</span>
          <select id="filtro-categoria" aria-label="Categoria"><option value="">Todas as categorias</option>${S.categorias.map((c) => `<option value="${escapar(c.id)}" ${ui.catFiltro === c.id ? "selected" : ""}>${escapar(c.nome)}</option>`).join("")}</select>
        </label>
        <label class="chip-mini chip-mini--grande"><input type="checkbox" id="so-ofertas" ${ui.soOfertas ? "checked" : ""}><span>Só ofertas</span></label>
      </div>
      <p class="nota nota--topo">Mude o preço direto na tabela: digite e saia do campo para salvar. "de" é o preço antigo, que mostra o desconto na loja.</p>
      <div class="tabela-produtos" role="table" aria-label="Produtos">
        <div class="tp-linha tp-cabeca" role="row"><span>Produto</span><span>Preço</span><span>Estoque</span><span>Entrada</span><span>Oferta</span><span></span></div>
        ${lista.map((p) => `
          <div class="tp-linha${estoque(p) === 0 ? " tp-linha--zerada" : ""}" role="row">
            <div class="tp-produto">
              <span class="tp-foto">${p.imagem ? `<img src="${escapar(p.imagem)}" alt="">` : `<svg><use href="#i-${iconeCat(p.categoria)}"/></svg>`}</span>
              <span><strong>${escapar(p.nome)}</strong><small>${escapar(categoria(p.categoria).nome)}</small></span>
            </div>
            <div class="tp-preco">
              <label class="preco-rapido"><span>R$</span><input type="number" step="0.01" min="0" value="${Number(p.preco).toFixed(2)}" data-preco="${escapar(p.id)}" aria-label="Preço de ${escapar(p.nome)}"></label>
              <label class="preco-rapido preco-rapido--antigo" title="Preço antigo (deixe vazio para tirar o desconto)"><span>de</span><input type="number" step="0.01" min="0" value="${p.precoAntigo ? Number(p.precoAntigo).toFixed(2) : ""}" placeholder="—" data-preco-antigo="${escapar(p.id)}" aria-label="Preço antigo de ${escapar(p.nome)}"></label>
            </div>
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
          <label class="campo"><span>Detalhes <em>um por linha, opcional</em></span><textarea name="detalhes" rows="3" placeholder="Malha 100% algodão&#10;Tamanhos do P ao GG">${escapar((p.detalhes || []).join("\n"))}</textarea></label>
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
  function reduzirFoto(arquivo, maximo = 700) {
    return new Promise((ok, falha) => {
      const leitor = new FileReader();
      leitor.onerror = falha;
      leitor.onload = () => {
        const im = new Image();
        im.onerror = falha;
        im.onload = () => {
          const escala = Math.min(1, maximo / Math.max(im.width, im.height));
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
      detalhes: (f.detalhes || "").split("\n").map((l) => l.trim()).filter(Boolean),
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
        <div><p class="rotulo">Organização</p><h1>Categorias</h1><p class="painel__sub">Aparecem no menu lateral, nos círculos e na tela "O que você procura?". Em "Combina com", marque o que sugerir junto (ex.: bermuda sugere camiseta e chinelo).</p></div>
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
              <div class="combina-chips">
                <span>Combina com</span>
                ${S.categorias.filter((o) => o.id !== c.id).map((o) => `
                  <label class="chip-mini"><input type="checkbox" value="${escapar(o.id)}" data-combina ${combinaDe(c.id).includes(o.id) ? "checked" : ""}><span>${escapar(o.nome)}</span></label>`).join("")}
              </div>
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
      const combina = [...li.querySelectorAll("[data-combina]:checked")].map((i) => i.value);
      // mantém ids de categorias que ainda não existem (ex.: bermudas) que já estavam na lista
      const existentes = new Set(S.categorias.map((c) => c.id));
      combinaDe(li.dataset.catId).filter((id) => !existentes.has(id)).forEach((id) => combina.push(id));
      return { ...atual, id: li.dataset.catId, nome: li.querySelector("[data-nome-cat]").value.trim() || li.dataset.catId, imagem: imagem || undefined, combina };
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
          <h2>Produto em destaque</h2>
          <label class="campo"><span>Produto mostrado na seção "Produto em destaque"</span>
            <select name="produtoDestaque">
              <option value="">Automático (primeira oferta com foto)</option>
              ${S.produtos.map((p) => `<option value="${escapar(p.id)}" ${String(c.produtoDestaque) === p.id ? "selected" : ""}>${escapar(p.nome)}</option>`).join("")}
            </select>
          </label>
          <p class="nota">Os detalhes da lista aparecem do cadastro do produto (campo "Detalhes").</p>
        </section>
        <section class="bloco">
          <h2>Chamada final</h2>
          <div class="foto-campo">
            <div class="foto-campo__previa foto-campo__previa--larga" id="previa-banner"><img src="${escapar(c.bannerImagem || "img/banner.jpg")}" alt=""></div>
            <div>
              <label class="btn btn--contorno btn--pequeno"><svg><use href="#i-upload"/></svg>Trocar foto<input type="file" accept="image/*" id="foto-banner" hidden></label>
              ${c.bannerImagem ? `<button type="button" class="link-simples" data-banner-padrao>Voltar à foto padrão</button>` : ""}
              <p class="nota">Aparece ao fundo da chamada final, perto do rodapé.</p>
            </div>
          </div>
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

  /* ---------- medidas ---------- */
  function medidas() {
    const tabs = window.Medidas.tabelas();
    const fmt = (v) => (v ?? "");
    return `
      <header class="painel__cabeca">
        <div><p class="rotulo">Provador</p><h1>Tabela de medidas</h1><p class="painel__sub">Medidas da peça em centímetros, do P ao GG. A coluna "veste" é a medida do corpo usada para recomendar o tamanho.</p></div>
      </header>
      <form id="form-medidas" class="form-painel">
        ${Object.entries(tabs).map(([cat, t]) => `
          <section class="bloco">
            <h2>${escapar(t.nome)}</h2>
            <div class="tabela-medidas__rolagem">
              <table class="tabela-editavel">
                <thead><tr><th>Tam.</th>${t.campos.map((c) => `<th>${escapar(c.nome)}</th>`).join("")}<th>Veste de</th><th>até</th></tr></thead>
                <tbody>${window.Medidas.TAMANHOS.map((x) => `
                  <tr><th>${x}</th>${t.campos.map((c) => `<td><input ${c.texto ? "" : 'type="number" step="0.1" min="0"'} data-cat="${cat}" data-tam="${x}" data-campo="${c.id}" value="${escapar(fmt(t.tamanhos[x][c.id]))}" aria-label="${escapar(t.nome)} ${x} ${escapar(c.nome)}"></td>`).join("")}
                  <td><input type="number" step="0.1" min="0" data-cat="${cat}" data-tam="${x}" data-campo="corpo0" value="${fmt(t.tamanhos[x].corpo[0])}" aria-label="${escapar(t.nome)} ${x} veste de"></td>
                  <td><input type="number" step="0.1" min="0" data-cat="${cat}" data-tam="${x}" data-campo="corpo1" value="${fmt(t.tamanhos[x].corpo[1])}" aria-label="${escapar(t.nome)} ${x} veste até"></td></tr>`).join("")}
                </tbody>
              </table>
            </div>
          </section>`).join("")}
        <footer class="barra-salvar"><button type="button" class="link-simples" data-medidas-padrao>Voltar às medidas padrão</button><button class="btn">Salvar medidas</button></footer>
      </form>`;
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
          <p class="nota">Login do dono: <b>${escapar(S.login.email)}</b>. Só ele entra no painel.</p>
          ${S.login.tipo === "teste" ? `
          ${campo("pinPainel", "Senha de teste", "text", 'minlength="4"')}
          <p class="nota">Esta senha só vale no modo de teste e fica no navegador. Para a loja no ar, ligue o login no Supabase (veja o README): a senha passa a ficar só no servidor.</p>` : `
          <p class="nota">A senha fica no Supabase. Para trocar, use "Esqueci a senha" na tela de login.</p>`}
        </section>` : ""}
        <footer class="barra-salvar"><button class="btn">Salvar configurações</button></footer>
      </form>`;
  }

  /* ---------- números: faturamento e visitas ---------- */
  const DIA = 864e5;
  const chaveDia = (ms) => new Date(ms).toLocaleDateString("sv-SE");
  const inicioDoDia = (offset = 0) => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime() - offset * DIA; };

  // Cada dinheiro que entrou ou saiu, com a data: pagamento, restante na retirada e devoluções feitas
  function lancamentos() {
    const l = [];
    S.pedidos.forEach((p) => {
      if (!p.pago) return;
      const pago = p.tipo === "compra" ? p.total : p.sinal;
      l.push({ em: p.confirmadoEm || p.criadoEm, valor: pago, p });
      if (p.tipo !== "compra" && p.status === "retirado" && p.restante) l.push({ em: p.concluidoEm || p.confirmadoEm || p.criadoEm, valor: p.restante, p });
      if (p.status === "estornado" && p.reembolso) l.push({ em: p.estornadoEm || p.canceladoEm || Date.now(), valor: -p.reembolso, p });
    });
    return l;
  }
  function somaPeriodo(dias) {
    const desde = inicioDoDia(dias - 1);
    return centavos(lancamentos().filter((x) => x.em >= desde).reduce((s, x) => s + x.valor, 0));
  }
  function visitasDoDia(offset) {
    return S.visitas[chaveDia(inicioDoDia(offset))] || { pessoas: 0, vistas: 0 };
  }

  // Gráfico de barras de uma série: barras finas com ponta arredondada e dica ao passar o mouse
  function grafico(dados, formatar, rotulo) {
    const L = 720, A = 220, M = { t: 16, r: 8, b: 26, l: 8 };
    const max = Math.max(1, ...dados.map((d) => d.valor));
    const passo = (L - M.l - M.r) / dados.length;
    const larg = Math.max(4, passo - 4);
    const y = (v) => M.t + (A - M.t - M.b) * (1 - Math.max(0, v) / max);
    const barras = dados.map((d, i) => {
      const x = M.l + i * passo + (passo - larg) / 2;
      const topo = y(d.valor);
      const h = Math.max(d.valor > 0 ? 2 : 0, A - M.b - topo);
      const r = Math.min(4, larg / 2, h);
      const caminho = h ? `M${x} ${A - M.b}V${A - M.b - h + r}Q${x} ${A - M.b - h} ${x + r} ${A - M.b - h}H${x + larg - r}Q${x + larg} ${A - M.b - h} ${x + larg} ${A - M.b - h + r}V${A - M.b}Z` : "";
      return `<g class="barra"><rect class="barra__alvo" x="${M.l + i * passo}" y="${M.t}" width="${passo}" height="${A - M.t - M.b}"/>${caminho ? `<path d="${caminho}"/>` : ""}<title>${escapar(d.titulo)}: ${escapar(formatar(d.valor))}</title></g>`;
    }).join("");
    const marcas = dados.map((d, i) => (i % 5 === 0 || i === dados.length - 1) ? `<text x="${M.l + i * passo + passo / 2}" y="${A - 8}">${escapar(d.curto)}</text>` : "").join("");
    return `
      <figure class="grafico">
        <figcaption>${escapar(rotulo)} <span>máx. ${escapar(formatar(max))}</span></figcaption>
        <svg viewBox="0 0 ${L} ${A}" role="img" aria-label="${escapar(rotulo)}">
          <line class="grafico__base" x1="${M.l}" x2="${L - M.r}" y1="${A - M.b}" y2="${A - M.b}"/>
          <line class="grafico__grade" x1="${M.l}" x2="${L - M.r}" y1="${y(max / 2)}" y2="${y(max / 2)}"/>
          ${barras}<g class="grafico__eixo">${marcas}</g>
        </svg>
        <div class="grafico__dica" hidden></div>
      </figure>`;
  }
  function serieDias(dias, valorDoDia) {
    return Array.from({ length: dias }, (_, i) => {
      const ms = inicioDoDia(dias - 1 - i);
      const d = new Date(ms);
      return { valor: valorDoDia(chaveDia(ms), ms), titulo: d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" }), curto: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) };
    });
  }
  const periodos = (atual, attr) => `<div class="filtros">${[[7, "7 dias"], [30, "30 dias"], [90, "90 dias"]].map(([n, t]) => `<button type="button" class="filtro${atual === n ? " ativo" : ""}" ${attr}="${n}">${t}</button>`).join("")}</div>`;

  /* ---------- faturamento ---------- */
  function faturamento() {
    const dias = ui.periodo;
    const desde = inicioDoDia(dias - 1);
    const lanc = lancamentos();
    const noPeriodo = lanc.filter((x) => x.em >= desde);
    const total = centavos(noPeriodo.reduce((s, x) => s + x.valor, 0));
    const pagos = S.pedidos.filter((p) => p.pago && (p.confirmadoEm || p.criadoEm) >= desde);
    const ticket = pagos.length ? total / pagos.length : 0;
    const porDia = {};
    lanc.forEach((x) => { const k = chaveDia(x.em); porDia[k] = (porDia[k] || 0) + x.valor; });
    const aReceber = S.pedidos.filter((p) => p.status === "aguardando").reduce((s, p) => s + p.sinal, 0) + S.pedidos.filter((p) => p.status === "confirmado").reduce((s, p) => s + (p.restante || 0), 0);
    const devolvido = noPeriodo.filter((x) => x.valor < 0).reduce((s, x) => s - x.valor, 0);
    // mais vendidos (pedidos pagos que não foram cancelados)
    const vendidos = {};
    S.pedidos.filter((p) => p.pago && !["cancelado", "estornado"].includes(p.status) && (p.confirmadoEm || p.criadoEm) >= desde)
      .forEach((p) => p.itens.forEach((i) => { const v = vendidos[i.nome] || (vendidos[i.nome] = { qtd: 0, valor: 0 }); v.qtd += i.qtd; v.valor += i.qtd * i.preco; }));
    const top = Object.entries(vendidos).sort((a, b) => b[1].valor - a[1].valor).slice(0, 6);
    const maxTop = Math.max(1, ...top.map(([, v]) => v.valor));
    const porForma = ["compra", "reserva30", "reserva50"].map((t) => {
      const ps = pagos.filter((p) => p.tipo === t);
      return { t, qtd: ps.length, valor: ps.reduce((s, p) => s + (t === "compra" ? p.total : p.sinal + (p.status === "retirado" ? p.restante : 0)), 0) };
    });
    return `
      <header class="painel__cabeca">
        <div><p class="rotulo">Dinheiro</p><h1>Faturamento</h1><p class="painel__sub">Conta o que foi confirmado como pago no painel, menos as devoluções feitas.</p></div>
        ${periodos(dias, "data-periodo")}
      </header>
      <div class="kpis">
        <div class="kpi"><span>Faturamento · ${dias} dias</span><strong>${moeda(total)}</strong><small>Hoje: ${moeda(somaPeriodo(1))}</small></div>
        <div class="kpi"><span>Pedidos pagos</span><strong>${pagos.length}</strong><small>Ticket médio ${moeda(ticket)}</small></div>
        <div class="kpi"><span>A receber</span><strong>${moeda(aReceber)}</strong><small>Sinais pendentes e restantes</small></div>
        <div class="kpi"><span>Devolvido</span><strong>${moeda(devolvido)}</strong><small>Estornos no período</small></div>
      </div>
      <section class="bloco">${grafico(serieDias(dias, (k) => Math.max(0, porDia[k] || 0)), moeda, `Faturamento por dia · últimos ${dias} dias`)}</section>
      <div class="duas-colunas">
        <section class="bloco">
          <header class="bloco__topo"><h2>Mais vendidos</h2></header>
          ${top.length ? `<ul class="ranking">${top.map(([nome, v]) => `
            <li><span class="ranking__nome">${escapar(nome)}<small>${v.qtd} un.</small></span><i style="--p:${(v.valor / maxTop) * 100}%"></i><b>${moeda(v.valor)}</b></li>`).join("")}</ul>`
            : `<p class="vazio-curto">Os produtos aparecem aqui quando houver pedidos pagos no período.</p>`}
        </section>
        <section class="bloco">
          <header class="bloco__topo"><h2>Por forma de compra</h2></header>
          <ul class="lista-curta">${porForma.map((f) => `
            <li><span>${f.t === "compra" ? "Compra completa" : f.t === "reserva30" ? `Reserva ${S.config.reservaPercentual}%` : `Reserva ${moeda(S.config.reservaFixa)}`}</span><span class="lista-curta__cat">${f.qtd} ${f.qtd === 1 ? "pedido" : "pedidos"}</span><b>${moeda(f.valor)}</b></li>`).join("")}</ul>
        </section>
      </div>`;
  }

  /* ---------- histórico de compras ---------- */
  function filtrarHistorico() {
    const desde = ui.histPeriodo ? inicioDoDia(ui.histPeriodo - 1) : 0;
    const termo = ui.histBusca.trim().toLowerCase();
    return S.pedidos
      .filter((p) => p.criadoEm >= desde)
      .filter((p) => ui.histStatus === "todos" || p.status === ui.histStatus)
      .filter((p) => !termo || `${p.codigo} ${p.cliente?.nome} ${p.cliente?.telefone} ${p.itens.map((i) => i.nome).join(" ")}`.toLowerCase().includes(termo))
      .sort((a, b) => b.criadoEm - a.criadoEm);
  }
  /* ---------- clientes cadastrados ---------- */
  function clientes() {
    return `
      <header class="painel__cabeca">
        <div><p class="rotulo">Contas</p><h1>Clientes</h1><p class="painel__sub" id="clientes-total">Carregando…</p></div>
      </header>
      <div id="clientes-lista"></div>`;
  }
  async function carregarClientes() {
    const alvo = $("#clientes-lista", raiz);
    let lista;
    try { lista = await Dados.listarClientes(); } catch { lista = []; }
    if (!alvo?.isConnected) return;
    if (lista === null) {
      $("#clientes-total", raiz).textContent = "As contas ficam no Supabase";
      alvo.innerHTML = `<p class="nota">Veja e gerencie as contas em Authentication → Users, no painel do Supabase.</p>`;
      return;
    }
    lista.sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0));
    $("#clientes-total", raiz).textContent = `${lista.length} ${lista.length === 1 ? "conta criada" : "contas criadas"}`;
    alvo.innerHTML = lista.length ? `
      <div class="tabela-medidas__rolagem">
        <table class="tabela-historico">
          <thead><tr><th>Cliente</th><th>E-mail</th><th>WhatsApp</th><th>Cadastro</th><th>Compras</th></tr></thead>
          <tbody>${lista.map((c) => {
            const compras = S.pedidos.filter((p) => (p.cliente?.email || "").toLowerCase() === c.email).length;
            return `
            <tr>
              <td><strong>${escapar(c.nome)}</strong></td>
              <td>${escapar(c.email)}</td>
              <td>${c.whats ? `<a href="https://wa.me/${digitos(c.whats).length <= 11 ? "55" : ""}${digitos(c.whats)}" target="_blank" rel="noopener">${escapar(c.whats)}</a>` : "—"}</td>
              <td>${c.criadoEm ? dataHora(c.criadoEm) : "—"}</td>
              <td class="num">${compras}</td>
            </tr>`;
          }).join("")}</tbody>
        </table>
      </div>` : `<p class="vazio-curto">Ninguém criou conta ainda. Os clientes se cadastram pelo ícone de pessoa no topo da loja.</p>`;
  }

  function historico() {
    const lista = filtrarHistorico();
    const soma = lista.filter((p) => p.pago).reduce((s, p) => s + (p.tipo === "compra" ? p.total : p.sinal), 0);
    return `
      <header class="painel__cabeca">
        <div><p class="rotulo">Registro</p><h1>Histórico de compras</h1><p class="painel__sub">${lista.length} ${lista.length === 1 ? "pedido" : "pedidos"} · ${moeda(soma)} já pagos</p></div>
        <button type="button" class="btn btn--contorno" data-exportar ${lista.length ? "" : "disabled"}><svg><use href="#i-upload"/></svg>Exportar planilha (CSV)</button>
      </header>
      <div class="barra-ferramentas">
        <label class="campo campo--busca"><span class="sr">Buscar</span><input type="search" id="busca-historico" placeholder="Buscar por cliente, código, telefone ou produto" value="${escapar(ui.histBusca)}"></label>
        <label class="campo campo--curto"><span class="sr">Período</span>
          <select id="hist-periodo">${[[7, "Últimos 7 dias"], [30, "Últimos 30 dias"], [90, "Últimos 90 dias"], [0, "Tudo"]].map(([n, t]) => `<option value="${n}" ${ui.histPeriodo === n ? "selected" : ""}>${t}</option>`).join("")}</select>
        </label>
        <label class="campo campo--curto"><span class="sr">Situação</span>
          <select id="hist-status"><option value="todos">Todas as situações</option>${Object.entries(NOMES_STATUS).map(([k, v]) => `<option value="${k}" ${ui.histStatus === k ? "selected" : ""}>${v}</option>`).join("")}</select>
        </label>
      </div>
      ${lista.length ? `
      <div class="tabela-medidas__rolagem">
        <table class="tabela-historico">
          <thead><tr><th>Data</th><th>Código</th><th>Cliente</th><th>Itens</th><th>Forma</th><th>Total</th><th>Pago</th><th>Situação</th></tr></thead>
          <tbody>${lista.map((p) => `
            <tr>
              <td>${dataHora(p.criadoEm)}</td>
              <td class="tabela-historico__cod">${escapar(p.codigo)}</td>
              <td><strong>${escapar(p.cliente?.nome)}</strong><small>${escapar(p.cliente?.telefone || "")}</small></td>
              <td>${p.itens.map((i) => `${i.qtd}× ${escapar(i.nome)}`).join("<br>")}</td>
              <td>${escapar(nomeTipo(p))}<small>${p.receber === "entrega" ? "Entrega" : "Retirada"}</small></td>
              <td class="num">${moeda(p.total)}</td>
              <td class="num">${p.pago ? moeda(p.tipo === "compra" ? p.total : p.sinal + (p.status === "retirado" ? p.restante : 0)) : "—"}</td>
              <td><span class="status status--${p.status}">${NOMES_STATUS[p.status]}</span></td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>` : `<p class="vazio-curto">Nenhum pedido nesse filtro.</p>`}`;
  }
  async function exportarCSV() {
    const lista = filtrarHistorico();
    const campo = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const linhas = [["Data", "Código", "Cliente", "Telefone", "E-mail", "Itens", "Forma", "Receber", "Endereço", "Total", "Sinal", "Restante", "Pago", "Situação", "Devolução"]]
      .concat(lista.map((p) => [dataHora(p.criadoEm), p.codigo, p.cliente?.nome, p.cliente?.telefone, p.cliente?.email, p.itens.map((i) => `${i.qtd}x ${i.nome}`).join("; "), nomeTipo(p), p.receber, `${p.cliente?.endereco || ""} ${p.cliente?.cep || ""}`.trim(), p.total, p.sinal, p.restante, p.pago ? "sim" : "não", NOMES_STATUS[p.status], p.reembolso ?? ""]));
    const texto = "\ufeff" + linhas.map((l) => l.map(campo).join(";")).join("\r\n");
    const nome = `tmz-historico-${chaveDia(Date.now())}.csv`;
    const downloads = await window.claude?.use?.("downloads").catch(() => null);
    if (downloads) {
      try { await downloads.save({ filename: nome, data: new Blob([texto], { type: "text/csv" }) }); } catch (e) { if (e?.code !== "declined") toast("Não deu para baixar aqui."); }
      return;
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([texto], { type: "text/csv;charset=utf-8" }));
    a.download = nome;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  /* ---------- visitas ---------- */
  function visitas() {
    const dias = ui.periodo;
    const serie = serieDias(dias, (k) => (S.visitas[k] || {}).pessoas || 0);
    const soma = (n, campo) => serieDias(n, (k) => (S.visitas[k] || {})[campo] || 0).reduce((s, d) => s + d.valor, 0);
    const pessoas = soma(dias, "pessoas");
    const pedidosPeriodo = S.pedidos.filter((p) => p.criadoEm >= inicioDoDia(dias - 1)).length;
    const hoje = visitasDoDia(0), ontem = visitasDoDia(1);
    const variacao = ontem.pessoas ? Math.round(((hoje.pessoas - ontem.pessoas) / ontem.pessoas) * 100) : null;
    return `
      <header class="painel__cabeca">
        <div><p class="rotulo">Movimento</p><h1>Visitas</h1><p class="painel__sub">Quantas pessoas abriram a loja por dia. Suas próprias visitas como dono não entram na conta.</p></div>
        ${periodos(dias, "data-periodo")}
      </header>
      ${S.modo === "local" ? `<p class="faixa-aviso">No modo de teste só dá para contar as visitas deste navegador. Com o site no servidor, aqui aparecem as visitas de todos os clientes.</p>` : ""}
      <div class="kpis">
        <div class="kpi"><span>Hoje</span><strong>${hoje.pessoas}</strong><small>${variacao == null ? "Sem visitas ontem para comparar" : `${variacao >= 0 ? "+" : ""}${variacao}% em relação a ontem`}</small></div>
        <div class="kpi"><span>Ontem</span><strong>${ontem.pessoas}</strong><small>${ontem.vistas} páginas abertas</small></div>
        <div class="kpi"><span>Pessoas · ${dias} dias</span><strong>${pessoas}</strong><small>${soma(dias, "vistas")} páginas abertas</small></div>
        <div class="kpi"><span>Conversão · ${dias} dias</span><strong>${pessoas ? ((pedidosPeriodo / pessoas) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : 0}%</strong><small>${pedidosPeriodo} pedidos e reservas</small></div>
      </div>
      <section class="bloco">${grafico(serie, (v) => `${v} ${v === 1 ? "pessoa" : "pessoas"}`, `Pessoas por dia · últimos ${dias} dias`)}</section>`;
  }

  /* ---------- contato e links ---------- */
  function contato() {
    const c = S.config;
    const campo = (nome, rotulo, tipo = "text", extra = "") => `<label class="campo"><span>${rotulo}</span><input name="${nome}" type="${tipo}" value="${escapar(c[nome] ?? "")}" ${extra}></label>`;
    return `
      <header class="painel__cabeca">
        <div><p class="rotulo">Onde te achar</p><h1>Contato e links</h1><p class="painel__sub">Aparecem no rodapé, nos botões de WhatsApp e no aviso do Instagram. Deixe vazio o que não usa.</p></div>
      </header>
      <form id="form-contato" class="form-painel">
        <section class="bloco">
          <h2>Atendimento</h2>
          <div class="campos-2">${campo("whatsapp", "WhatsApp da loja (com DDI e DDD)", "tel", 'placeholder="5511999999999"')}${campo("email", "E-mail", "email", 'placeholder="contato@tmzstore.com"')}</div>
          <div class="campos-2">${campo("endereco", "Endereço da loja", "text", 'placeholder="Rua, número, bairro, cidade"')}${campo("horario", "Horário de funcionamento", "text", 'placeholder="Seg–Sáb 9h–19h"')}</div>
        </section>
        <section class="bloco">
          <h2>Redes e links</h2>
          <div class="campos-2">${campo("instagram", "Instagram (link)", "url", 'placeholder="https://www.instagram.com/tmz_storee/"')}${campo("tiktok", "TikTok (link)", "url", 'placeholder="https://www.tiktok.com/@..."')}</div>
          <div class="campos-2">${campo("facebook", "Facebook (link)", "url", 'placeholder="https://facebook.com/..."')}${campo("linkExtra", "Outro link (catálogo, Linktree…)", "url", 'placeholder="https://..."')}</div>
          ${campo("linkExtraNome", "Nome do outro link", "text", 'placeholder="Catálogo completo"')}
        </section>
        <footer class="barra-salvar"><button class="btn">Salvar contato e links</button></footer>
      </form>`;
  }

  /* ---------- eventos ---------- */
  raiz.addEventListener("click", async (e) => {
    const t = e.target;
    const aba = t.closest("[data-aba]");
    if (aba) { ui.aba = aba.dataset.aba; ui.cancelando = null; ui.excluindo = null; render(); $("#painel").scrollTop = 0; return; }
    const ir = t.closest("[data-ir]");
    if (ir) { ui.aba = ir.dataset.ir; if (ir.dataset.filtro) ui.filtro = ir.dataset.filtro; render(); return; }
    const per = t.closest("[data-periodo]");
    if (per) { ui.periodo = Number(per.dataset.periodo); return renderAba(); }
    if (t.closest("[data-exportar]")) return exportarCSV();
    if (t.closest("[data-banner-padrao]")) { await Dados.salvarConfig({ bannerImagem: "" }); toast("Foto padrão de volta"); return renderAba(); }
    if (t.closest("[data-medidas-padrao]")) { await Dados.salvarConfig({ medidas: null }); toast("Medidas padrão restauradas"); return renderAba(); }
    if (t.closest("[data-sair]")) { Dados.sair(); location.hash = ""; return; }
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
      await Dados.salvarCategorias([...lerCategoriasDoForm(), { id, nome, combina: (typeof COMBINA_PADRAO !== "undefined" && COMBINA_PADRAO[id]) || [] }]);
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
    if (t.id === "so-ofertas") { ui.soOfertas = t.checked; renderAba(); }
    if (t.id === "hist-periodo") { ui.histPeriodo = Number(t.value); renderAba(); }
    if (t.id === "hist-status") { ui.histStatus = t.value; renderAba(); }
    if (t.matches("[data-preco], [data-preco-antigo]")) {
      const id = t.dataset.preco || t.dataset.precoAntigo;
      const prod = S.produtos.find((x) => x.id === id);
      const v = t.value === "" ? null : centavos(t.value);
      if (!prod) return;
      if (t.dataset.preco && !(v > 0)) { toast("O preço precisa ser maior que zero"); t.value = Number(prod.preco).toFixed(2); return; }
      await Dados.salvarProduto({ ...prod, [t.dataset.preco ? "preco" : "precoAntigo"]: v });
      toast(t.dataset.preco ? `Preço de ${prod.nome}: ${moeda(v)}` : v ? `Preço antigo: ${moeda(v)}` : "Desconto removido");
    }
    if (t.id === "foto-banner" && t.files[0]) {
      try {
        const url = await reduzirFoto(t.files[0], 1400);
        await Dados.salvarConfig({ bannerImagem: url });
        toast("Foto do banner trocada");
        renderAba();
      } catch { toast("Não deu para ler essa imagem"); }
    }
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
    if (e.target.id === "busca-historico") {
      ui.histBusca = e.target.value;
      const pos = e.target.selectionStart;
      renderAba();
      const campo = $("#busca-historico", raiz);
      campo.focus();
      campo.setSelectionRange(pos, pos);
    }
  });

  raiz.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    const botao = f.querySelector("button:not([type=button])");
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
      if (f.id === "form-medidas") {
        const novo = {};
        f.querySelectorAll("input[data-cat]").forEach((i) => {
          const { cat, tam, campo } = i.dataset;
          const alvo = ((novo[cat] ||= {})[tam] ||= { corpo: [0, 0] });
          const texto = i.type !== "number";
          const v = texto ? i.value.trim() : Number(String(i.value).replace(",", ".")) || 0;
          if (campo === "corpo0") alvo.corpo[0] = v; else if (campo === "corpo1") alvo.corpo[1] = v; else alvo[campo] = v;
        });
        await Dados.salvarConfig({ medidas: novo });
        toast("Medidas salvas. O provador já usa os novos valores.");
      }
      if (f.id === "form-contato") {
        const d = Object.fromEntries(new FormData(f));
        d.whatsapp = digitos(d.whatsapp);
        Object.keys(d).forEach((k) => { d[k] = String(d[k]).trim(); });
        await Dados.salvarConfig(d);
        toast("Contato e links salvos");
      }
      if (f.id === "form-config") {
        const d = Object.fromEntries(new FormData(f));
        ["frete", "freteGratisAcima", "reservaPercentual", "reservaFixa", "estornoJanelaMin", "estornoDepoisPerc"].forEach((k) => { d[k] = Math.max(0, Number(d[k]) || 0); });
        d.reservaPercentual = Math.min(99, Math.max(1, d.reservaPercentual));
        d.estornoDepoisPerc = Math.min(100, d.estornoDepoisPerc);
        if (d.pinPainel !== undefined && String(d.pinPainel).trim().length < 4) { toast("A senha precisa de pelo menos 4 caracteres"); return; }
        await Dados.salvarConfig(d);
        toast("Configurações salvas");
        renderAba();
      }
    } catch { toast("Não deu para salvar. Tente de novo."); }
    finally { if (botao) botao.disabled = false; }
  });

  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && ui.editando) fecharEditor(); });
  raiz.addEventListener("pointermove", (e) => {
    const g = e.target.closest(".grafico .barra");
    const fig = e.target.closest(".grafico");
    if (!fig) return;
    const dica = fig.querySelector(".grafico__dica");
    if (!g) { dica.hidden = true; return; }
    const r = fig.getBoundingClientRect();
    dica.textContent = g.querySelector("title").textContent;
    dica.hidden = false;
    dica.style.left = `${Math.min(r.width - 150, Math.max(0, e.clientX - r.left - 70))}px`;
    dica.style.top = `${e.clientY - r.top - 44}px`;
  });
  raiz.addEventListener("pointerleave", () => raiz.querySelectorAll(".grafico__dica").forEach((d) => { d.hidden = true; }), true);

  /* ---------- quando abrir e quando os dados mudarem ---------- */
  window.addEventListener("tmz:rota", (e) => {
    ui.aberto = e.detail === "painel";
    if (ui.aberto) render();
  });
  // abriu o site direto em #painel
  if (location.hash === "#painel") { ui.aberto = true; render(); }
  let eraAdmin = S.admin;
  let contaAntes = JSON.stringify(S.conta);
  Dados.ouvir(() => {
    if (!ui.aberto) return;
    if (S.admin !== eraAdmin) { eraAdmin = S.admin; contaAntes = JSON.stringify(S.conta); return render(); }
    if (!S.admin) {
      // tela de entrar: só redesenha quando a conta muda, para não apagar o que está sendo digitado
      if (JSON.stringify(S.conta) === contaAntes) return;
      contaAntes = JSON.stringify(S.conta);
      return render();
    }
    if (ui.editando || abasDeFormulario.includes(ui.aba) || raiz.contains(document.activeElement) && document.activeElement.matches("input[type=number], #busca-produto, #busca-historico")) {
      // só atualiza o contador do menu
      const aguardando = S.pedidos.filter((p) => p.status === "aguardando").length;
      const b = raiz.querySelector('[data-aba="pedidos"]');
      if (b) { b.querySelector(".contagem")?.remove(); if (aguardando) b.insertAdjacentHTML("beforeend", `<b class="contagem">${aguardando}</b>`); }
      return;
    }
    render();
  });
})();
