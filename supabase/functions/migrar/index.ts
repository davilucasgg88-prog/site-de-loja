// Quando o cliente entra na conta, leva para ela os pedidos feitos antes, na sessão anônima.
// Recebe o token da conta (Authorization) e o token anônimo (corpo); confere os dois no Supabase.
import { admin, cors, json, usuario } from "../_compartilhado/loja.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const db = admin();
    const conta = await usuario(db, req);
    const { tokenAnonimo } = await req.json();
    const { data: anon } = await db.auth.getUser(String(tokenAnonimo || ""));
    if (!conta || conta.is_anonymous || !anon?.user?.is_anonymous) return json({ movidos: 0 });
    const { data } = await db.from("docs").select("id,dados").eq("colecao", "pedidos").eq("dados->>dono", anon.user.id);
    for (const linha of data || []) {
      await db.from("docs").update({ dados: { ...linha.dados, dono: conta.id } }).eq("colecao", "pedidos").eq("id", linha.id);
    }
    return json({ movidos: (data || []).length });
  } catch (e) {
    return json({ erro: e instanceof Error ? e.message : "erro" }, 400);
  }
});
