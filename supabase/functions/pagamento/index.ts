// Cria a cobrança Pix no Mercado Pago para um pedido da loja.
// O site chama com { codigo } logo depois de criar o pedido. O valor vem do pedido gravado pelo
// servidor (função pedido), nunca do navegador.
import { admin, acharPedido, cors, json, usuario } from "../_compartilhado/loja.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { codigo } = await req.json();
    if (!/^TMZ-[A-Z0-9]{5,10}$/.test(String(codigo || ""))) return json({ erro: "Pedido inválido" }, 400);
    const db = admin();
    const quem = await usuario(db, req);
    if (!quem) return json({ erro: "Sessão inválida" }, 401);
    const pedido = await acharPedido(db, codigo);
    if (!pedido || pedido.dono !== quem.id) return json({ erro: "Pedido não encontrado" }, 404);
    if (pedido.status !== "aguardando" || pedido.pago) return json({ erro: "Este pedido não está esperando pagamento" }, 409);

    // Já tem cobrança válida? devolve a mesma
    const { data: atual } = await db.from("docs").select("dados").eq("colecao", "pagamentos").eq("id", codigo).maybeSingle();
    const ant = atual?.dados;
    if (ant?.qrCopiaECola && ant.status === "pending" && ant.expira && Date.parse(ant.expira) > Date.now() + 60000) return json(ant);

    const tokenMp = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!tokenMp) return json({ erro: "Pagamento online não configurado" }, 503);
    const { data: cfg } = await db.from("docs").select("dados").eq("colecao", "loja").eq("id", "config").maybeSingle();
    const nomeLoja = cfg?.dados?.nome || "TMZ STORE";
    const nome = String(pedido.cliente?.nome || "Cliente").trim().split(/\s+/);
    const tentativa = (ant?.tentativa || 0) + 1;

    const r = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenMp}`, "Content-Type": "application/json", "X-Idempotency-Key": `${codigo}-${tentativa}` },
      body: JSON.stringify({
        transaction_amount: Number(pedido.cobrar),
        description: `${nomeLoja} · ${pedido.tipo === "compra" ? "Pedido" : "Sinal da reserva"} ${codigo}`,
        payment_method_id: "pix",
        external_reference: codigo,
        notification_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/mercadopago-webhook`,
        date_of_expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString().replace("Z", "-00:00"),
        payer: { email: pedido.cliente?.email || quem.email || `cliente+${codigo.toLowerCase()}@tmzstore.com.br`, first_name: nome[0], last_name: nome.slice(1).join(" ") || "-" },
      }),
    });
    const mp = await r.json();
    if (!r.ok) return json({ erro: "O Mercado Pago recusou a cobrança", detalhe: mp?.message }, 502);

    const dados = {
      codigo, dono: pedido.dono, mpId: String(mp.id), status: mp.status, valor: Number(pedido.cobrar), tentativa,
      qrCopiaECola: mp.point_of_interaction?.transaction_data?.qr_code,
      qrImagem: mp.point_of_interaction?.transaction_data?.qr_code_base64,
      link: mp.point_of_interaction?.transaction_data?.ticket_url,
      expira: mp.date_of_expiration, criadoEm: Date.now(),
    };
    await db.from("docs").upsert({ colecao: "pagamentos", id: codigo, dados });
    return json(dados);
  } catch (e) {
    return json({ erro: e instanceof Error ? e.message : "Erro inesperado" }, 400);
  }
});
