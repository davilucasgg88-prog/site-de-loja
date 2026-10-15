// Recebe o aviso do Mercado Pago quando um pagamento muda de situação.
// 1. Confere a assinatura do aviso (x-signature) com MERCADOPAGO_WEBHOOK_SECRET.
// 2. Consulta o pagamento direto na API do Mercado Pago (o aviso não é confiável por si).
// 3. Aprovado: a função do banco confirmar_pagamento trava o pedido, confere o valor, baixa o
//    estoque e confirma, uma vez só (avisos repetidos não baixam o estoque de novo).
import { admin, cors, json } from "../_compartilhado/loja.ts";

async function assinaturaValida(req: Request, idPagamento: string) {
  const segredo = Deno.env.get("MERCADOPAGO_WEBHOOK_SECRET");
  if (!segredo) return true; // sem segredo configurado, vale só a consulta na API (passo 2)
  const partes = Object.fromEntries((req.headers.get("x-signature") || "").split(",").map((p) => p.trim().split("=")));
  const ts = partes.ts, v1 = partes.v1;
  if (!ts || !v1) return false;
  const manifesto = `id:${idPagamento.toLowerCase()};request-id:${req.headers.get("x-request-id") || ""};ts:${ts};`;
  const chave = await crypto.subtle.importKey("raw", new TextEncoder().encode(segredo), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const assinatura = new Uint8Array(await crypto.subtle.sign("HMAC", chave, new TextEncoder().encode(manifesto)));
  const hex = [...assinatura].map((b) => b.toString(16).padStart(2, "0")).join("");
  return hex.length === v1.length && [...hex].every((c, i) => c === v1[i]);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = new URL(req.url);
    const corpo = await req.json().catch(() => ({}));
    const tipo = corpo.type || corpo.topic || url.searchParams.get("type") || url.searchParams.get("topic");
    const id = String(corpo.data?.id || url.searchParams.get("data.id") || url.searchParams.get("id") || "");
    if (tipo !== "payment" || !/^\d{1,20}$/.test(id)) return json({ ok: true, ignorado: true });
    if (!(await assinaturaValida(req, id))) return json({ ok: false, erro: "assinatura inválida" }, 401);

    const tokenMp = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN")!;
    const r = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, { headers: { Authorization: `Bearer ${tokenMp}` } });
    if (!r.ok) return json({ ok: false }, 502);
    const mp = await r.json();
    const codigo = String(mp.external_reference || "");
    if (!/^TMZ-[A-Z0-9]{5,10}$/.test(codigo)) return json({ ok: true, ignorado: true });

    const db = admin();
    const { data: atual } = await db.from("docs").select("dados").eq("colecao", "pagamentos").eq("id", codigo).maybeSingle();
    // só aceita o pagamento que esta loja criou para este pedido
    if (atual?.dados?.mpId && atual.dados.mpId !== String(mp.id) && atual.dados.status === "approved") return json({ ok: true, ignorado: true });
    const registro = {
      ...(atual?.dados || {}), codigo, mpId: String(mp.id), status: mp.status, valorPago: mp.transaction_amount,
      aprovadoEm: mp.date_approved, verificado: true, atualizadoEm: Date.now(),
    };
    await db.from("docs").upsert({ colecao: "pagamentos", id: codigo, dados: registro });

    if (mp.status !== "approved") return json({ ok: true, status: mp.status });
    const { data: resultado, error } = await db.rpc("confirmar_pagamento", { p_codigo: codigo, p_mp_id: String(mp.id), p_valor: Number(mp.transaction_amount) });
    if (error) throw error;
    return json({ ok: true, resultado });
  } catch (e) {
    return json({ ok: false, erro: e instanceof Error ? e.message : "erro" }, 400);
  }
});
