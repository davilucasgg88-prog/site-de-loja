// Provador TMZ: manequim com as medidas de cada tamanho (P ao GG) e calculadora de tamanho.
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const { escapar, toast } = window.TMZ;
  const TAMANHOS = ["P", "M", "G", "GG"];
  const LETRAS = "ABCD";
  const num = (v) => (typeof v === "number" ? v.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : escapar(v));

  // tabela atual (o painel pode sobrescrever em config.medidas)
  function tabelas() {
    const salvo = Dados.estado.config.medidas;
    if (!salvo) return MEDIDAS;
    const junto = {};
    Object.keys(MEDIDAS).forEach((k) => {
      junto[k] = { ...MEDIDAS[k], tamanhos: { ...MEDIDAS[k].tamanhos, ...(salvo[k] || {}) } };
    });
    return junto;
  }

  const estado = { mini: { cat: "camisetas", tam: "M" }, tela: { cat: "camisetas", tam: "M", resultado: null } };

  /* ---------- desenho do manequim ---------- */
  const corpoSVG = `
    <ellipse class="mq-corpo" cx="150" cy="60" rx="29" ry="35"/>
    <path class="mq-corpo" d="M138 92h24l3 24h-30z"/>
    <path class="mq-corpo" d="M118 114C100 118 86 126 80 140C74 162 76 200 82 236C86 262 88 286 90 306C92 330 88 352 86 372H214C212 352 208 330 210 306C212 286 214 262 218 236C224 200 226 162 220 140C214 126 200 118 182 114Z"/>
    <path class="mq-corpo" d="M80 142C66 152 60 182 58 222C56 262 56 300 60 338H74C76 300 78 262 82 230Z"/>
    <path class="mq-corpo" d="M220 142C234 152 240 182 242 222C244 262 244 300 240 338H226C224 300 222 262 218 230Z"/>
    <path class="mq-corpo" d="M90 372C92 430 96 500 102 588H128C132 520 140 450 148 382Z"/>
    <path class="mq-corpo" d="M210 372C208 430 204 500 198 588H172C168 520 160 450 152 382Z"/>
    <ellipse class="mq-corpo" cx="113" cy="598" rx="22" ry="9"/>
    <ellipse class="mq-corpo" cx="187" cy="598" rx="22" ry="9"/>
    <path class="mq-costura" d="M150 120V370M100 306Q150 316 200 306"/>`;

  const PECAS = {
    tronco: `<path class="mq-peca" d="M116 112C98 118 82 126 74 140L52 196L78 208L88 176C86 220 88 300 86 360H214C212 300 214 220 212 176L222 208L248 196L226 140C218 126 202 118 184 112C178 124 166 130 150 130S122 124 116 112Z"/>`,
    bermuda: `<path class="mq-peca" d="M88 298H212C214 340 216 400 214 470H158L150 392L142 470H86C84 400 86 340 88 298Z"/>`,
    calca: `<path class="mq-peca" d="M88 298H212C214 360 210 480 202 590H160L150 392L140 590H98C90 480 86 360 88 298Z"/>`,
    cabeca: `<path class="mq-peca" d="M118 54C118 32 132 20 150 20S182 32 182 54Z M180 52C196 52 214 56 222 62C210 66 194 64 180 60Z"/>`,
  };

  function linha(x1, y1, x2, y2, i, lx, ly) {
    return `
      <g class="mq-medida" data-i="${i}">
        <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>
        <circle cx="${x1}" cy="${y1}" r="3"/><circle cx="${x2}" cy="${y2}" r="3"/>
        <g class="mq-tag" transform="translate(${lx} ${ly})"><circle r="11"/><text dy="4">${LETRAS[i]}</text></g>
      </g>`;
  }
  function contorno(cx, cy, rx, ry, i, lx, ly) {
    return `
      <g class="mq-medida" data-i="${i}">
        <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" class="mq-tracejada"/>
        <g class="mq-tag" transform="translate(${lx} ${ly})"><circle r="11"/><text dy="4">${LETRAS[i]}</text></g>
      </g>`;
  }

  const MEDICOES = {
    tronco: [
      linha(78, 204, 222, 204, 0, 150, 190),
      linha(262, 114, 262, 360, 1, 262, 96),
      linha(86, 136, 214, 136, 2, 150, 150),
      linha(68, 140, 46, 200, 3, 34, 214),
    ],
    bermuda: [
      contorno(150, 304, 64, 9, 0, 62, 304),
      contorno(150, 356, 66, 10, 1, 60, 356),
      linha(262, 300, 262, 470, 2, 262, 282),
      linha(150, 394, 150, 470, 3, 150, 488),
    ],
    calca: [
      contorno(150, 304, 64, 9, 0, 62, 304),
      contorno(150, 356, 66, 10, 1, 60, 356),
      linha(262, 300, 262, 590, 2, 262, 282),
      linha(150, 394, 150, 590, 3, 150, 612),
    ],
    cabeca: [
      contorno(150, 54, 36, 10, 0, 206, 40),
      linha(182, 62, 222, 62, 1, 236, 78),
    ],
  };

  function figuraPe() {
    return `
      <svg class="manequim" viewBox="0 0 300 640" aria-hidden="true">
        <defs><linearGradient id="mq-grad-pe" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2a2d"/><stop offset="1" stop-color="#151517"/></linearGradient></defs>
        <path class="mq-corpo" fill="url(#mq-grad-pe)" d="M150 590C112 590 96 560 98 520C100 470 92 420 88 360C84 300 82 250 86 200C90 150 108 116 140 108C170 102 196 114 206 142C216 172 214 222 210 272C206 332 202 382 204 442C206 502 196 590 150 590Z"/>
        <g class="mq-costura">
          <ellipse cx="112" cy="134" rx="11" ry="15"/><ellipse cx="136" cy="118" rx="10" ry="13"/><ellipse cx="160" cy="116" rx="9" ry="12"/>
          <ellipse cx="181" cy="124" rx="8" ry="11"/><ellipse cx="198" cy="140" rx="7" ry="10"/>
        </g>
        <path class="mq-peca" d="M150 600C104 600 86 566 88 520C90 470 82 420 78 360C74 300 72 250 78 196C84 146 106 104 144 98C178 92 208 110 218 142C228 176 224 226 220 276C216 334 214 384 216 444C218 506 206 600 150 600Z"/>
        ${linha(256, 106, 256, 590, 0, 256, 88)}
        ${linha(82, 300, 214, 300, 1, 150, 286)}
      </svg>`;
  }

  function figura(tipo, tamanho) {
    if (tipo === "pe") return figuraPe();
    const escala = { P: 0.95, M: 0.99, G: 1.03, GG: 1.07 }[tamanho] || 1;
    return `
      <svg class="manequim" viewBox="0 0 300 640" aria-hidden="true">
        <defs>
          <linearGradient id="mq-grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2c2c2f"/><stop offset="1" stop-color="#141416"/></linearGradient>
          <radialGradient id="mq-luz" cx="50%" cy="35%" r="60%"><stop offset="0" stop-color="#fff" stop-opacity=".08"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
        </defs>
        <ellipse cx="150" cy="300" rx="140" ry="300" fill="url(#mq-luz)"/>
        <g fill="url(#mq-grad)">${corpoSVG}</g>
        <g class="mq-escala" style="transform: scaleX(${escala})">${PECAS[tipo] || ""}</g>
        ${(MEDICOES[tipo] || []).join("")}
        <ellipse cx="150" cy="616" rx="96" ry="10" class="mq-chao"/>
      </svg>`;
  }

  /* ---------- partes reutilizadas ---------- */
  function abas(cats, atual, nome) {
    return `<div class="prov-abas" role="tablist">${cats.map((k) => `
      <button type="button" role="tab" class="prov-aba" data-${nome}-cat="${k}" aria-selected="${k === atual}">${escapar(tabelas()[k].nome)}</button>`).join("")}</div>`;
  }
  function chips(atual, nome) {
    return `<div class="prov-tams" role="radiogroup" aria-label="Tamanho">${TAMANHOS.map((t) => `
      <button type="button" role="radio" class="prov-tam" data-${nome}-tam="${t}" aria-checked="${t === atual}">${t}</button>`).join("")}</div>`;
  }
  function leitura(cat, tam, compacto) {
    const t = tabelas()[cat];
    const v = t.tamanhos[tam];
    return `
      <ul class="prov-leitura${compacto ? " prov-leitura--mini" : ""}">
        ${t.campos.map((c, i) => `
          <li data-i="${c.texto ? "" : i}">
            ${c.texto ? `<span class="prov-letra prov-letra--vazia">#</span>` : `<span class="prov-letra">${LETRAS[i]}</span>`}
            <span class="prov-nome">${escapar(c.nome)}${compacto ? "" : `<small>${escapar(c.dica)}</small>`}</span>
            <b>${num(v[c.id])}${c.texto ? "" : "<em> cm</em>"}</b>
          </li>`).join("")}
      </ul>
      <p class="prov-corpo">Veste ${escapar(t.corpo.nome.toLowerCase())} de <b>${num(v.corpo[0])} a ${num(v.corpo[1])} cm</b></p>`;
  }

  /* ---------- card no topo do site ---------- */
  const MINI = ["camisetas", "bermudas", "calcados"];
  function renderMini() {
    const alvo = $("#provador-mini");
    if (!alvo) return;
    const { cat, tam } = estado.mini;
    alvo.innerHTML = `
      <header class="prov-mini__topo">
        <span class="prov-mini__marca"><i></i>Provador TMZ</span>
        <span class="prov-mini__unidade">medidas em cm</span>
      </header>
      ${abas(MINI, cat, "mini")}
      <div class="prov-mini__corpo">
        <div class="prov-mini__figura">${figura(tabelas()[cat].figura, tam)}</div>
        <div class="prov-mini__dados">
          ${chips(tam, "mini")}
          ${leitura(cat, tam, true)}
          <a class="btn btn--bloco btn--pequeno" href="#medidas" data-medidas="${cat}">Meu tamanho <svg><use href="#i-arrow"/></svg></a>
        </div>
      </div>`;
  }

  /* ---------- tela completa ---------- */
  function renderTela() {
    const alvo = $("#medidas-conteudo");
    if (!alvo) return;
    const { cat, tam, resultado } = estado.tela;
    const t = tabelas()[cat];
    alvo.innerHTML = `
      ${abas(Object.keys(tabelas()), cat, "tela")}
      <div class="provador">
        <div class="provador__palco ilha-escura">
          <div class="provador__grade-fundo" aria-hidden="true"></div>
          <span class="provador__escala" aria-hidden="true">${TAMANHOS.map((x) => `<i class="${x === tam ? "ativo" : ""}">${x}</i>`).join("")}</span>
          ${figura(t.figura, tam)}
        </div>
        <div class="provador__info">
          <div class="provador__linha">
            <h2 class="titulo-grande">${escapar(t.nome)}</h2>
            ${chips(tam, "tela")}
          </div>
          ${leitura(cat, tam, false)}

          <form class="calc" id="form-calc">
            <h3>Descubra seu tamanho</h3>
            <p>${escapar(t.corpo.dica)}</p>
            <div class="calc__linha">
              <label class="campo"><span>Seu ${escapar(t.corpo.nome.toLowerCase())} (cm)</span>
                <input id="calc-medida" type="number" inputmode="decimal" step="0.1" min="1" required placeholder="Ex.: ${num(t.tamanhos.M.corpo[0] + 2)}" value="${resultado ? resultado.valor : ""}">
              </label>
              <button class="btn">Calcular</button>
            </div>
            ${resultado ? `
              <div class="calc__resultado" role="status">
                <span class="calc__tam">${resultado.tam}</span>
                <p>${resultado.texto}</p>
              </div>` : ""}
          </form>
        </div>
      </div>

      <section class="tabela-medidas">
        <h3>Tabela completa · ${escapar(t.nome)}</h3>
        <div class="tabela-medidas__rolagem">
          <table>
            <thead><tr><th>Tamanho</th>${t.campos.map((c) => `<th>${escapar(c.nome)}${c.texto ? "" : " (cm)"}</th>`).join("")}<th>${escapar(t.corpo.nome)} (cm)</th></tr></thead>
            <tbody>${TAMANHOS.map((x) => {
              const v = t.tamanhos[x];
              return `<tr class="${x === tam ? "ativo" : ""}" data-tela-tam="${x}"><th>${x}</th>${t.campos.map((c) => `<td>${num(v[c.id])}</td>`).join("")}<td>${num(v.corpo[0])}–${num(v.corpo[1])}</td></tr>`;
            }).join("")}</tbody>
          </table>
        </div>
        <p class="nota">Medidas de referência da peça, podendo variar 1 a 2 cm. Em dúvida entre dois tamanhos, escolha o maior para um caimento mais solto.</p>
      </section>`;
  }

  function recomendar(cat, valor) {
    const t = tabelas()[cat];
    const faixas = TAMANHOS.map((x) => ({ x, de: t.tamanhos[x].corpo[0], ate: t.tamanhos[x].corpo[1] }));
    const dentro = faixas.filter((f) => valor >= f.de && valor <= f.ate);
    const nome = t.corpo.nome.toLowerCase();
    if (dentro.length) {
      const f = dentro[dentro.length - 1];
      const meio = (f.de + f.ate) / 2;
      const perto = dentro.length > 1 || Math.abs(valor - f.ate) < 0.6;
      return {
        tam: f.x, valor,
        texto: perto && f.x !== "P"
          ? `Seu ${nome} de ${num(valor)} cm está no limite entre ${dentro.length > 1 ? dentro[0].x : f.x} e ${f.x}. O <b>${f.x}</b> veste mais solto.`
          : `Seu ${nome} de ${num(valor)} cm fica ${valor < meio ? "na parte de baixo" : "na parte de cima"} da faixa do <b>${f.x}</b> (${num(f.de)}–${num(f.ate)} cm).`,
      };
    }
    if (valor < faixas[0].de) return { tam: "P", valor, texto: `Seu ${nome} de ${num(valor)} cm é menor que a nossa faixa. O <b>P</b> é o mais próximo e deve ficar folgado.` };
    return { tam: "GG", valor, texto: `Seu ${nome} de ${num(valor)} cm passa da nossa faixa. O <b>GG</b> é o maior que temos e pode ficar justo. Fale com a gente no WhatsApp.` };
  }

  /* ---------- eventos ---------- */
  document.addEventListener("click", (e) => {
    const t = e.target;
    const miniCat = t.closest("[data-mini-cat]");
    if (miniCat) { estado.mini.cat = miniCat.dataset.miniCat; return renderMini(); }
    const miniTam = t.closest("[data-mini-tam]");
    if (miniTam) { estado.mini.tam = miniTam.dataset.miniTam; return renderMini(); }
    const ir = t.closest("[data-medidas]");
    if (ir) { estado.tela = { cat: ir.dataset.medidas in tabelas() ? ir.dataset.medidas : "camisetas", tam: estado.mini.tam, resultado: null }; }
    const telaCat = t.closest("[data-tela-cat]");
    if (telaCat) { estado.tela = { cat: telaCat.dataset.telaCat, tam: estado.tela.tam, resultado: null }; return renderTela(); }
    const telaTam = t.closest("[data-tela-tam]");
    if (telaTam) { estado.tela.tam = telaTam.dataset.telaTam; return renderTela(); }
  });
  // passar o mouse numa medida acende a linha correspondente no manequim
  document.addEventListener("pointerover", (e) => {
    const li = e.target.closest(".prov-leitura li[data-i]");
    const raiz = e.target.closest("#provador-mini, #medidas-conteudo");
    if (!raiz) return;
    raiz.querySelectorAll(".mq-medida").forEach((g) => g.classList.toggle("acesa", !!li && g.dataset.i === li.dataset.i));
  });
  document.addEventListener("submit", (e) => {
    if (e.target.id !== "form-calc") return;
    e.preventDefault();
    const valor = parseFloat(String($("#calc-medida").value).replace(",", "."));
    if (!(valor > 0)) { toast("Digite a medida em centímetros"); return; }
    const r = recomendar(estado.tela.cat, valor);
    estado.tela.resultado = r;
    estado.tela.tam = r.tam;
    renderTela();
  });

  window.addEventListener("tmz:rota", (e) => { if (e.detail === "medidas") renderTela(); });
  Dados.ouvir(() => { renderMini(); if (location.hash === "#medidas") renderTela(); });
  if (location.hash === "#medidas") renderTela();

  window.Medidas = { tabelas, TAMANHOS, renderMini, renderTela };
})();
