// Cria o pedido. O navegador manda só o que o cliente escolheu (itens, forma, CEP, dados de contato,
// cupom); preços, frete, desconto, sinal e código são calculados AQUI, e o pedido é gravado em
// pedidos/<código>, onde o cliente pode ler mas não alterar.
import { admin, cors, json, lerLoja, novoCodigo, recalcular, usuario } from "../_compartilhado/loja.ts";

const texto = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);
const digitos = (v: unknown) => String(v ?? "").replace(/\D/g, "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const db = admin();
    const quem = await usuario(db, req);
    if (!quem) return json({ erro: "Sessão inválida. Recarregue a página." }, 401);
    const e = await req.json();

    // validação do que veio do navegador
    const tipo = ["compra", "reserva30", "reserva50"].includes(e.tipo) ? e.tipo : null;
    if (!tipo) return json({ erro: "Forma de compra inválida" }, 400);
    const receber = tipo === "reserva30" ? "retirada" : e.receber === "retirada" ? "retirada" : "entrega";
    if (!Array.isArray(e.itens) || !e.itens.length || e.itens.length > 30) return json({ erro: "Carrinho inválido" }, 400);
    const itens = e.itens.map((i: { id: unknown; qtd: unknown }) => ({ id: texto(i.id, 60), qtd: Math.floor(Number(i.qtd)) }));
    if (itens.some((i: { id: string; qtd: number }) => !i.id || !(i.qtd >= 1 && i.qtd <= 20))) return json({ erro: "Quantidade inválida" }, 400);
    const cliente = {
      nome: texto(e.cliente?.nome, 80), telefone: texto(e.cliente?.telefone, 20), email: texto(e.cliente?.email, 120).toLowerCase(),
      cep: receber === "entrega" ? texto(e.cliente?.cep, 9) : "", endereco: receber === "entrega" ? texto(e.cliente?.endereco, 200) : "",
    };
    if (cliente.nome.length < 3) return json({ erro: "Escreva seu nome completo." }, 400);
    if (digitos(cliente.telefone).length < 10 || digitos(cliente.telefone).length > 13) return json({ erro: "Confira o WhatsApp, com DDD." }, 400);
    if (receber === "entrega" && (digitos(cliente.cep).length !== 8 || cliente.endereco.length < 8)) return json({ erro: "Confira o CEP e o endereço." }, 400);
    const pagamento = tipo === "compra" && ["Pix", "Cartão de crédito", "Boleto"].includes(e.pagamento) ? e.pagamento : "Pix";

    const { config, produtos } = await lerLoja(db);
    if (!produtos.size) return json({ erro: "A loja ainda não publicou o catálogo." }, 409);
    const conta = await recalcular({ itens, receber, tipo, cliente, cupom: e.cupom ? { codigo: texto(e.cupom, 30).toUpperCase() } : null }, config, produtos);

    // cupom: limite de usos e 1 por cliente (pela conta e pelo WhatsApp)
    if (conta.cupom) {
      const c = conta.cupom as { codigo: string; limite?: number; umPorCliente?: boolean };
      const { data: usos } = await db.from("docs").select("dados->dono, dados->cliente->>telefone")
        .eq("colecao", "pedidos").eq("dados->cupom->>codigo", c.codigo).not("dados->>status", "in", '("cancelado","estornado")');
      const lista = (usos || []) as Record<string, string>[];
      if (Number(c.limite) > 0 && lista.length >= Number(c.limite)) return json({ erro: "Este cupom esgotou." }, 409);
      const zap = digitos(cliente.telefone).slice(-9);
      if (c.umPorCliente && lista.some((u) => u.dono === quem.id || digitos(u.telefone).slice(-9) === zap)) {
        return json({ erro: "Você já usou este cupom." }, 409);
      }
    }

    const agora = Date.now();
    const pedido = {
      codigo: novoCodigo(), dono: quem.id, tipo, receber, pagamento, cliente,
      itens: conta.itens.map(({ id, nome, preco, qtd }) => ({ id, nome, preco, qtd })),
      subtotal: conta.subtotal, frete: conta.frete, total: conta.total,
      sinal: conta.cobrar, cobrar: conta.cobrar, restante: Math.round((conta.total - conta.cobrar) * 100) / 100,
      prazoEntrega: receber === "entrega" ? conta.prazo : null,
      cupom: conta.cupom ? { codigo: (conta.cupom as { codigo: string }).codigo, desconto: conta.desconto, freteGratis: (conta.cupom as { tipo: string }).tipo === "frete", freteEconomizado: Math.round((conta.freteSemCupom - conta.frete) * 100) / 100 } : null,
      regra: { janelaMin: Number(config.estornoJanelaMin ?? 60), percDepois: Number(config.estornoDepoisPerc ?? 50) },
      criadoEm: agora, status: "aguardando", pago: false, historico: [{ em: agora, status: "aguardando" }],
    };
    const { error } = await db.from("docs").insert({ colecao: "pedidos", id: pedido.codigo, dados: pedido });
    if (error) throw error;
    return json({ pedido });
  } catch (e) {
    return json({ erro: e instanceof Error ? e.message : "Erro inesperado" }, 400);
  }
});
