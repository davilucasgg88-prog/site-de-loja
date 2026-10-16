// Acompanhamento de pedidos: a linha do tempo que o cliente vê (#acompanhar e Minhas reservas)
// e que o dono atualiza no painel. Etapas:
//   entrega:  feito → pago → separando → enviado (com código de rastreio) → entregue
//   retirada: feito → pago → separando → pronto para retirar → retirado
// O pedido guarda: status ("aguardando" | "confirmado" | "retirado" | "cancelado" | "estornado"),
// etapa ("separando" | "enviado" | "pronto") e as datas de cada passo.
const Rastreio = (() => {
  const { escapar, moeda, dataHora } = window.TMZ;
  const S = Dados.estado;

  const TRANSPORTADORAS = {
    correios: { nome: "Correios", link: (c) => `https://rastreamento.correios.com.br/app/index.php?objetos=${encodeURIComponent(c)}` },
    jadlog: { nome: "Jadlog", link: (c) => `https://www.jadlog.com.br/jadlog/tracking?cte=${encodeURIComponent(c)}` },
    loggi: { nome: "Loggi", link: () => "https://www.loggi.com/rastreador/" },
    motoboy: { nome: "Motoboy da loja", link: () => "" },
    outra: { nome: "Outra transportadora", link: () => "" },
  };

  // Soma dias úteis (pula sábado e domingo)
  function diasUteis(inicio, dias) {
    const d = new Date(inicio);
    let n = 0;
    while (n < dias) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && d.getDay() !== 6) n += 1; }
    return d.getTime();
  }

  // Aprovado pelo dono? (pedidos antigos, já em andamento, contam como aprovados)
  const aprovado = (p) => !!p.aprovadoEm || !!p.etapa || p.status === "retirado";
  const dataCurta = (ms) => new Date(ms).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });

  function etapas(p) {
    const entrega = p.receber === "entrega";
    const reserva = p.tipo !== "compra";
    const pago = ["confirmado", "retirado"].includes(p.status) || p.pago;
    const e = p.etapa;
    const lista = [
      { id: "feito", nome: reserva ? "Reserva feita" : "Pedido feito", desc: `Código ${p.codigo}`, em: p.criadoEm },
      {
        id: "aprovado", nome: "Aprovado pela loja",
        desc: aprovado(p)
          ? p.prazoEnvio ? `${entrega ? "Envio" : "Pronto para retirar"} até ${dataCurta(p.prazoEnvio)}` : "Pedido aceito pela loja"
          : S.config.lojaAberta === false ? "A loja está fora do ar agora: aprovamos assim que voltar" : "Esperando a loja confirmar o pedido e o prazo",
        em: aprovado(p) ? p.aprovadoEm || p.confirmadoEm || p.criadoEm : null,
      },
      { id: "pago", nome: reserva ? "Sinal confirmado" : "Pagamento confirmado", desc: pago ? (reserva ? `${moeda(p.sinal)} recebidos` : "Pagamento recebido") : "Aguardando o pagamento", em: pago ? p.confirmadoEm || null : null },
      { id: "separando", nome: "Em separação", desc: "Conferindo e embalando suas peças", em: p.separandoEm || (["enviado", "pronto"].includes(e) || p.status === "retirado" ? p.confirmadoEm : null) },
    ];
    if (entrega) {
      const previsao = p.enviadoEm && p.prazoEntrega ? diasUteis(p.enviadoEm, p.prazoEntrega) : null;
      lista.push({
        id: "enviado", nome: "Enviado", em: p.enviadoEm || (p.status === "retirado" ? p.concluidoEm : null),
        desc: p.rastreio?.codigo ? `${TRANSPORTADORAS[p.rastreio.transportadora]?.nome || "Transportadora"} · ${p.rastreio.codigo}` : "A caminho do seu endereço",
        previsao,
      });
      lista.push({ id: "fim", nome: "Entregue", desc: "Aproveite!", em: p.status === "retirado" ? p.concluidoEm || null : null });
    } else {
      lista.push({ id: "pronto", nome: "Pronto para retirar", desc: p.restante && reserva ? `Leve o código. Falta pagar ${moeda(p.restante)}` : "Leve o código do pedido", em: p.prontoEm || (p.status === "retirado" ? p.concluidoEm : null) });
      lista.push({ id: "fim", nome: "Retirado", desc: "Aproveite!", em: p.status === "retirado" ? p.concluidoEm || null : null });
    }
    // a etapa atual é a última já alcançada; a próxima ainda não tem data
    let atual = -1;
    lista.forEach((x, i) => { x.feito = !!x.em; if (x.feito) atual = i; });
    lista.forEach((x, i) => { x.atual = i === atual; x.proxima = i === atual + 1; });
    return lista;
  }

  // Nome curto da situação, para etiquetas
  function situacao(p) {
    if (p.status === "cancelado") return "Cancelado";
    if (p.status === "estornado") return "Cancelado e devolvido";
    if (!aprovado(p)) return "Aguardando aprovação";
    const atual = etapas(p).find((x) => x.atual);
    return { feito: "Aguardando pagamento", aprovado: p.pago ? "Pago · a separar" : "Aprovado · aguardando pagamento", pago: "Pago · a separar", separando: "Em separação", enviado: "A caminho", pronto: "Pronto para retirar", fim: p.receber === "entrega" ? "Entregue" : "Retirado" }[atual?.id] || "";
  }

  function linha(p, { compacta = false } = {}) {
    if (["cancelado", "estornado"].includes(p.status)) {
      return `<div class="linha-tempo linha-tempo--cancelado"><svg><use href="#i-fechar"/></svg><span><strong>Pedido cancelado</strong>${p.canceladoEm ? ` em ${dataHora(p.canceladoEm)}` : ""}${p.reembolso ? ` · devolução de ${moeda(p.reembolso)}${p.status === "estornado" ? " feita" : " em andamento"}` : ""}</span></div>`;
    }
    const passos = etapas(p);
    const rastreio = p.rastreio?.codigo && TRANSPORTADORAS[p.rastreio.transportadora];
    return `
      <ol class="linha-tempo${compacta ? " linha-tempo--compacta" : ""}">
        ${passos.map((x) => `
          <li class="${x.feito ? "feito" : ""}${x.atual ? " atual" : ""}">
            <span class="linha-tempo__ponto">${x.feito ? `<svg><use href="#i-check"/></svg>` : ""}</span>
            <div class="linha-tempo__texto">
              <strong>${escapar(x.nome)}</strong>
              ${compacta ? "" : `<span>${escapar(x.desc)}</span>`}
              ${x.em ? `<time>${dataHora(x.em)}</time>` : x.proxima ? `<time class="linha-tempo__agora">próxima etapa</time>` : ""}
              ${!compacta && x.id === "enviado" && x.feito && x.previsao && !passos.at(-1).feito ? `<span class="linha-tempo__previsao">Previsão de entrega: até ${new Date(x.previsao).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })}</span>` : ""}
              ${!compacta && x.id === "enviado" && rastreio && x.feito ? `
                <span class="linha-tempo__rastreio">
                  <code>${escapar(p.rastreio.codigo)}</code>
                  <button type="button" class="link-simples" data-copiar-texto="${escapar(p.rastreio.codigo)}">Copiar</button>
                  ${rastreio.link(p.rastreio.codigo) ? `<a class="link-simples" href="${escapar(rastreio.link(p.rastreio.codigo))}" target="_blank" rel="noopener">Rastrear na ${escapar(rastreio.nome)}</a>` : ""}
                </span>` : ""}
            </div>
          </li>`).join("")}
      </ol>`;
  }

  // Link que o cliente recebe para acompanhar
  const linkAcompanhar = (codigo) => `${location.origin}${location.pathname}?pedido=${encodeURIComponent(codigo)}#acompanhar`;

  // Mensagem de WhatsApp do dono para o cliente, conforme a etapa
  function mensagem(p) {
    const nome = (p.cliente?.nome || "").split(" ")[0];
    const oi = `Oi${nome ? ", " + nome : ""}!`;
    const link = `\n\nAcompanhe aqui: ${linkAcompanhar(p.codigo)}`;
    p = { ...p, codigo: p.numero ? `nº ${p.numero} (${p.codigo})` : p.codigo }; // mensagens citam o número e o código
    const atual = etapas(p).find((x) => x.proxima)?.id;
    if (aprovado(p) && !p.etapa && p.status !== "retirado" && p.prazoEnvio && (p.pago || atual === "pago")) {
      return `${oi} Seu pedido ${p.codigo} foi aprovado! ${p.receber === "entrega" ? "Enviamos" : "Fica pronto para retirar"} até ${dataCurta(p.prazoEnvio)}.${p.pago ? "" : " Assim que o pagamento cair, começamos a separar."}${link}`;
    }
    if (p.status === "retirado") return `${oi} Seu pedido ${p.codigo} foi ${p.receber === "entrega" ? "entregue" : "retirado"}. Obrigado por comprar na ${S.config.nome}! 🖤`;
    if (atual === "pago") return `${oi} Recebemos o seu pedido ${p.codigo}. Assim que o pagamento cair, a gente separa as peças.${link}`;
    if (atual === "separando") return `${oi} Pagamento do pedido ${p.codigo} confirmado! Já estamos separando suas peças.${link}`;
    if (p.etapa === "separando") return `${oi} Suas peças do pedido ${p.codigo} já estão sendo separadas e embaladas. ${p.receber === "entrega" ? "Avisamos quando sair para entrega." : "Avisamos quando estiver pronto para retirar."}${link}`;
    if (p.etapa === "enviado") {
      const t = TRANSPORTADORAS[p.rastreio?.transportadora];
      return `${oi} Seu pedido ${p.codigo} saiu para entrega${t ? ` pela ${t.nome}` : ""}.${p.rastreio?.codigo ? ` Código de rastreio: ${p.rastreio.codigo}.` : ""}${link}`;
    }
    if (p.etapa === "pronto") return `${oi} Seu pedido ${p.codigo} está pronto para retirar${S.config.endereco ? ` em ${S.config.endereco}` : " na loja"}.${p.restante && p.tipo !== "compra" ? ` Falta pagar ${moeda(p.restante)} na retirada.` : ""} Leve o código do pedido.${link}`;
    return `${oi} Novidades do seu pedido ${p.codigo}.${link}`;
  }

  return { aprovado, dataCurta, etapas, linha, situacao, mensagem, linkAcompanhar, TRANSPORTADORAS, diasUteis };
})();
