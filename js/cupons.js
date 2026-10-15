// Cupons de desconto: regras e cálculo, usados na finalização da compra e no painel.
// Cada cupom fica em config.cupons:
// { codigo, tipo: "percentual" | "valor" | "frete", valor, minimo, validade: "AAAA-MM-DD" | "",
//   limite: 0 (sem limite) | n, umPorCliente, categoria: "" (todas) | id, ativo, criadoEm }
const Cupons = (() => {
  const S = Dados.estado;
  const centavos = (n) => Math.round(n * 100) / 100;
  const real = (n) => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  // data de hoje no horário de Brasília (igual ao servidor), em qualquer fuso do aparelho
  const hoje = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
  const limpar = (codigo) => String(codigo || "").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");

  const lista = () => (Array.isArray(S.config.cupons) ? S.config.cupons : []);
  const achar = (codigo) => lista().find((c) => c.codigo === limpar(codigo));
  const valido = (p) => !["cancelado", "estornado"].includes(p.status);

  // Pedidos que usaram o cupom (o dono vê todos; o cliente, só os dele)
  const pedidosCom = (codigo, pedidos = S.pedidos) => pedidos.filter((p) => p.cupom?.codigo === codigo && valido(p));

  function descrever(c) {
    if (c.tipo === "frete") return "Frete grátis";
    if (c.tipo === "valor") return `${real(c.valor)} OFF`;
    return `${Number(c.valor)}% OFF`;
  }

  function regras(c, nomeCategoria = (id) => id) {
    const r = [];
    if (Number(c.minimo) > 0) r.push(`acima de ${real(c.minimo)}`);
    if (c.categoria) r.push(`só ${nomeCategoria(c.categoria)}`);
    if (c.validade) r.push(`até ${c.validade.split("-").reverse().slice(0, 2).join("/")}`);
    if (Number(c.limite) > 0) r.push(`${c.limite} usos`);
    if (c.umPorCliente) r.push("1 por cliente");
    return r;
  }

  // t = { itens: [{ p, qtd }], subtotal, frete }
  function avaliar(codigo, t, nomeCategoria = (id) => id) {
    const c = achar(codigo);
    if (!c || !c.ativo) return { ok: false, erro: "Cupom não encontrado. Confira o código." };
    if (c.validade && hoje() > c.validade) return { ok: false, erro: "Este cupom já venceu." };
    if (Number(c.limite) > 0 && pedidosCom(c.codigo).length >= Number(c.limite)) return { ok: false, erro: "Este cupom esgotou." };
    if (c.umPorCliente) {
      // na nuvem cada cliente só enxerga os próprios pedidos; no modo local separa pelo e-mail da conta
      const meus = S.modo === "local"
        ? S.pedidos.filter((p) => (S.conta?.email ? (p.cliente?.email || "").toLowerCase() === S.conta.email : p.dono === "local"))
        : S.meusPedidos;
      if (pedidosCom(c.codigo, meus).length) return { ok: false, erro: "Você já usou este cupom." };
    }
    const minimo = Number(c.minimo) || 0;
    if (t.subtotal < minimo) return { ok: false, erro: `Vale para compras a partir de ${real(minimo)}. Faltam ${real(minimo - t.subtotal)}.` };
    const base = c.categoria
      ? centavos(t.itens.filter(({ p }) => p.categoria === c.categoria).reduce((s, { p, qtd }) => s + p.preco * qtd, 0))
      : t.subtotal;
    if (!base) return { ok: false, erro: `Este cupom vale só para ${nomeCategoria(c.categoria)}.` };
    let desconto = 0;
    if (c.tipo === "percentual") desconto = centavos(base * Math.min(100, Number(c.valor) || 0) / 100);
    if (c.tipo === "valor") desconto = Math.min(base, Number(c.valor) || 0);
    return { ok: true, cupom: c, desconto, freteGratis: c.tipo === "frete" };
  }

  // Números de um cupom para o painel
  function numeros(codigo) {
    const pedidos = pedidosCom(codigo);
    const pagos = pedidos.filter((p) => p.pago);
    return {
      usos: pedidos.length,
      vendas: centavos(pagos.reduce((s, p) => s + p.total, 0)),
      desconto: centavos(pedidos.reduce((s, p) => s + (p.cupom.desconto || 0) + (p.cupom.freteGratis ? p.cupom.freteEconomizado || 0 : 0), 0)),
    };
  }

  function gerarCodigo(prefixo = "TMZ") {
    const letras = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let c = "";
    for (let i = 0; i < 5; i++) c += letras[Math.floor(Math.random() * letras.length)];
    return `${prefixo}${c}`;
  }

  return { hoje, lista, achar, avaliar, descrever, regras, numeros, pedidosCom, gerarCodigo, limpar };
})();
