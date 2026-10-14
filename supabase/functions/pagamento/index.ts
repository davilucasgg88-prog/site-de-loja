// Cria a cobrança Pix no Mercado Pago para um pedido da loja.
// O site chama com { codigo } logo depois de registrar o pedido; a função confere de quem é o
// pedido, recalcula o valor no servidor e devolve o QR Code e o "Pix copia e cola".
import { admin, acharPedido, cors, json, lerLoja, recalcular } from "../_compartilhado/loja.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { codigo } = await req.json();
    if (!codigo) return json({ erro: "Pedido sem código" }, 400);

    // Quem está pedindo (sessão anônima ou conta) precisa ser o dono do pedido
    const db = admin();
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: quem } = await db.auth.getUser(token);
    if (!quem?.user) return json({ erro: "Sessão inválida" }, 401);

    const achado = await acharPedido(db, codigo);
    if (!achado || achado.dono !== quem.user.id) return json({ erro: "Pedido não encontrado" }, 404);

    // Já tem cobrança? devolve a mesma
    const { data: pago } = await db.from("docs").select("dados").eq("colecao", "pagamentos").eq("id", codigo).maybeSingle();
    if (pago?.dados?.qrCopiaECola && pago.dados.status !== "cancelled") return json(pago.dados);

    const { config, produtos } = await lerLoja(db);
    if (!produtos.size) return json({ erro: "Catálogo ainda não foi publicado pelo dono" }, 409);
    const conta = await recalcular(achado.pedido, config, produtos);

    const tokenMp = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!tokenMp) return json({ erro: "Pagamento online não configurado" }, 503);
    const base = Deno.env.get("SUPABASE_URL")!;
    const email = achado.pedido.cliente?.email || quem.user.email || `cliente+${codigo.toLowerCase()}@tmzstore.com.br`;
    const nome = String(achado.pedido.cliente?.nome || "Cliente").trim().split(/\s+/);

    const r = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenMp}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": `${codigo}-${conta.cobrar}`,
      },
      body: JSON.stringify({
        transaction_amount: conta.cobrar,
        description: `${config.nome || "TMZ STORE"} · ${achado.pedido.tipo === "compra" ? "Pedido" : "Sinal da reserva"} ${codigo}`,
        payment_method_id: "pix",
        external_reference: codigo,
        notification_url: `${base}/functions/v1/mercadopago-webhook`,
        date_of_expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString().replace("Z", "-00:00"),
        payer: { email, first_name: nome[0], last_name: nome.slice(1).join(" ") || "-" },
      }),
    });
    const mp = await r.json();
    if (!r.ok) return json({ erro: "O Mercado Pago recusou a cobrança", detalhe: mp?.message }, 502);

    const dados = {
      codigo, mpId: mp.id, status: mp.status, valor: conta.cobrar, total: conta.total,
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
