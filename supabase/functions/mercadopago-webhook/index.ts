// Recebe o aviso do Mercado Pago quando um pagamento muda de situação.
// Pagamento aprovado: confirma o pedido, marca como pago e dá baixa no estoque, sozinho.
// O aviso não é confiável por si: a função consulta o pagamento direto na API do Mercado Pago.
import { admin, acharPedido, cors, json } from "../_compartilhado/loja.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = new URL(req.url);
    const corpo = await req.json().catch(() => ({}));
    const tipo = corpo.type || corpo.topic || url.searchParams.get("type") || url.searchParams.get("topic");
    const id = corpo.data?.id || url.searchParams.get("data.id") || url.searchParams.get("id");
    if (tipo !== "payment" || !id) return json({ ok: true, ignorado: true });

    const tokenMp = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN")!;
    const r = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, { headers: { Authorization: `Bearer ${tokenMp}` } });
    if (!r.ok) return json({ ok: false }, 502);
    const mp = await r.json();
    const codigo = mp.external_reference;
    if (!codigo) return json({ ok: true, ignorado: true });

    const db = admin();
    const { data: atual } = await db.from("docs").select("dados").eq("colecao", "pagamentos").eq("id", codigo).maybeSingle();
    const registro = { ...(atual?.dados || {}), codigo, mpId: mp.id, status: mp.status, valorPago: mp.transaction_amount, aprovadoEm: mp.date_approved, verificado: true };
    await db.from("docs").upsert({ colecao: "pagamentos", id: codigo, dados: registro });

    if (mp.status !== "approved") return json({ ok: true, status: mp.status });

    const achado = await acharPedido(db, codigo);
    if (!achado) return json({ ok: true, semPedido: true });
    const { pedido } = achado;
    if (pedido.pago) return json({ ok: true, jaPago: true });
    if (registro.valor && Math.abs(Number(mp.transaction_amount) - Number(registro.valor)) > 0.01) {
      return json({ ok: false, erro: "Valor pago diferente do cobrado" }, 409);
    }

    // baixa no estoque
    for (const item of pedido.itens || []) {
      const { data: prod } = await db.from("docs").select("dados").eq("colecao", "produtos").eq("id", String(item.id)).maybeSingle();
      if (!prod) continue;
      const estoque = Math.max(0, (Number(prod.dados.estoque) || 0) - (Number(item.qtd) || 0));
      await db.from("docs").update({ dados: { ...prod.dados, estoque } }).eq("colecao", "produtos").eq("id", String(item.id));
    }

    const agora = Date.now();
    // deno-lint-ignore no-explicit-any
    const lista = achado.lista.map((p: any) => p.codigo !== codigo ? p : {
      ...p, status: "confirmado", pago: true, confirmadoEm: agora, estoqueBaixado: true,
      pagamento: p.tipo === "compra" ? "Pix (Mercado Pago)" : p.pagamento, pagamentoVerificado: true,
      historico: [...(p.historico || []), { em: agora, status: "confirmado" }],
    });
    await db.from("docs").update({ dados: { lista } }).eq("colecao", "reservas").eq("id", achado.dono);
    return json({ ok: true, confirmado: codigo });
  } catch (e) {
    return json({ ok: false, erro: e instanceof Error ? e.message : "erro" }, 400);
  }
});
