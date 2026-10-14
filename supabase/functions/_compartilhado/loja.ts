// Regras de preço usadas pelas funções de pagamento. Repetem, no servidor, as contas do site
// (js/cupons.js e js/frete.js), para que o valor cobrado não dependa do que o navegador mandou.
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
export const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...cors, "Content-Type": "application/json" } });

export function admin(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
}

const centavos = (n: number) => Math.round(n * 100) / 100;

const FAIXAS: [number, number, string][] = [
  [1000, 19999, "SP"], [20000, 28999, "RJ"], [29000, 29999, "ES"], [30000, 39999, "MG"],
  [40000, 48999, "BA"], [49000, 49999, "SE"], [50000, 56999, "PE"], [57000, 57999, "AL"],
  [58000, 58999, "PB"], [59000, 59999, "RN"], [60000, 63999, "CE"], [64000, 64999, "PI"],
  [65000, 65999, "MA"], [66000, 68899, "PA"], [68900, 68999, "AP"], [69000, 69299, "AM"],
  [69300, 69399, "RR"], [69400, 69899, "AM"], [69900, 69999, "AC"], [70000, 72799, "DF"],
  [72800, 72999, "GO"], [73000, 73699, "DF"], [73700, 76799, "GO"], [76800, 76999, "RO"],
  [77000, 77999, "TO"], [78000, 78899, "MT"], [79000, 79999, "MS"], [80000, 87999, "PR"],
  [88000, 89999, "SC"], [90000, 99999, "RS"],
];
const REGIOES: Record<string, string[]> = {
  Norte: ["AC", "AP", "AM", "PA", "RO", "RR", "TO"],
  Nordeste: ["AL", "BA", "CE", "MA", "PB", "PE", "PI", "RN", "SE"],
  "Centro-Oeste": ["DF", "GO", "MT", "MS"],
  Sudeste: ["ES", "MG", "RJ", "SP"],
  Sul: ["PR", "RS", "SC"],
};
const TABELA_PADRAO: Record<string, { valor: number; prazo: number }> = {
  cidade: { valor: 12, prazo: 2 }, estado: { valor: 19.9, prazo: 4 },
  regiao: { valor: 24.9, prazo: 6 }, brasil: { valor: 34.9, prazo: 9 },
};
const regiaoDe = (uf: string) => Object.entries(REGIOES).find(([, ufs]) => ufs.includes(uf))?.[0] || "";
const semAcento = (t: string) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

async function destinoDoCep(cep: string) {
  const d = String(cep || "").replace(/\D/g, "");
  const n = Number(d.slice(0, 5));
  let uf = FAIXAS.find(([de, ate]) => n >= de && n <= ate)?.[2] || "";
  let cidade = "";
  try {
    const r = await fetch(`https://viacep.com.br/ws/${d}/json/`);
    const j = await r.json();
    if (!j.erro) { uf = j.uf; cidade = j.localidade; }
  } catch { /* fica com o estado pela faixa do CEP */ }
  return { uf, cidade };
}

// deno-lint-ignore no-explicit-any
type Config = Record<string, any>;

// Recalcula o pedido com os preços, cupons e frete guardados no servidor
// deno-lint-ignore no-explicit-any
export async function recalcular(pedido: any, config: Config, produtos: Map<string, any>) {
  let subtotal = 0;
  const itens = [];
  for (const i of pedido.itens || []) {
    const p = produtos.get(String(i.id));
    const qtd = Math.max(1, Math.floor(Number(i.qtd) || 0));
    if (!p) throw new Error(`Produto ${i.id} não existe mais`);
    if ((Number(p.estoque) || 0) < qtd) throw new Error(`${p.nome}: estoque insuficiente`);
    subtotal += Number(p.preco) * qtd;
    itens.push({ id: String(i.id), nome: p.nome, preco: Number(p.preco), qtd, categoria: p.categoria });
  }
  subtotal = centavos(subtotal);

  // frete
  let frete = 0;
  const limite = Number(config.freteGratisAcima) || 0;
  if (pedido.receber === "entrega" && subtotal > 0 && !(limite > 0 && subtotal >= limite)) {
    if (config.freteModo === "regiao") {
      const dest = await destinoDoCep(pedido.cliente?.cep);
      const tabela = { ...TABELA_PADRAO, ...(config.freteTabela || {}) };
      let faixa = "brasil";
      if (dest.uf === config.lojaUF) faixa = dest.cidade && semAcento(dest.cidade) === semAcento(config.lojaCidade) ? "cidade" : "estado";
      else if (regiaoDe(dest.uf) && regiaoDe(dest.uf) === regiaoDe(config.lojaUF)) faixa = "regiao";
      frete = Number(tabela[faixa].valor) || 0;
    } else {
      frete = Number(config.frete) || 0;
    }
  }

  // cupom
  let desconto = 0;
  const codigo = pedido.cupom?.codigo;
  if (codigo) {
    // deno-lint-ignore no-explicit-any
    const c = (config.cupons || []).find((x: any) => x.codigo === codigo);
    const hoje = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
    const valido = c && c.ativo && !(c.validade && hoje > c.validade) && subtotal >= (Number(c.minimo) || 0);
    if (valido) {
      const base = c.categoria ? itens.filter((i) => i.categoria === c.categoria).reduce((s, i) => s + i.preco * i.qtd, 0) : subtotal;
      if (c.tipo === "percentual") desconto = centavos(base * Math.min(100, Number(c.valor) || 0) / 100);
      if (c.tipo === "valor") desconto = Math.min(base, Number(c.valor) || 0);
      if (c.tipo === "frete") frete = 0;
    }
  }

  const total = centavos(subtotal - desconto + frete);
  let cobrar = total;
  if (pedido.tipo === "reserva30") cobrar = centavos(total * (Number(config.reservaPercentual) || 30) / 100);
  if (pedido.tipo === "reserva50") cobrar = Math.min(Number(config.reservaFixa) || 50, total);
  return { itens, subtotal, frete, desconto, total, cobrar };
}

// Acha o pedido pelo código dentro de reservas/<cliente>
export async function acharPedido(db: SupabaseClient, codigo: string) {
  const { data, error } = await db.from("docs").select("id,dados")
    .eq("colecao", "reservas").contains("dados", { lista: [{ codigo }] }).limit(1);
  if (error) throw error;
  const doc = data?.[0];
  // deno-lint-ignore no-explicit-any
  const pedido = doc?.dados?.lista?.find((p: any) => p.codigo === codigo);
  return doc && pedido ? { dono: doc.id as string, lista: doc.dados.lista, pedido } : null;
}

export async function lerLoja(db: SupabaseClient) {
  const [{ data: cfg }, { data: prods }] = await Promise.all([
    db.from("docs").select("dados").eq("colecao", "loja").eq("id", "config").maybeSingle(),
    db.from("docs").select("id,dados").eq("colecao", "produtos"),
  ]);
  // deno-lint-ignore no-explicit-any
  const produtos = new Map<string, any>((prods || []).map((p: any) => [String(p.id), p.dados]));
  return { config: (cfg?.dados || {}) as Config, produtos };
}
