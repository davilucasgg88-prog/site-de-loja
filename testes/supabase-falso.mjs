// Supabase de mentira para testes: auth (anônimo, cadastro, login), tabela docs com as mesmas regras do schema.sql,
// rpc status_pagamento e as funções pagamento / aprovar (simula o webhook do Mercado Pago).
import http from 'node:http';
import crypto from 'node:crypto';

export function iniciarSupabaseFalso(porta = 8124) { return new Promise((pronto) => {
const ADMIN = 'admin@tmzstore.com.br';
const usuarios = new Map(); // email -> {id, senha}
const tokens = new Map();   // token -> {id, email}
const docs = new Map();     // "colecao/id" -> {dados, atualizado}
const sessao = (u) => { const t = crypto.randomUUID(); tokens.set(t, u); return { access_token: t, refresh_token: 'r' + t, expires_in: 3600, user: { id: u.id, email: u.email || '' } }; };
const PROPRIAS = ['reservas', 'carrinhos', 'visitas', 'contas', 'avisos'];
const podeLer = (u, col, id) => ['loja', 'produtos'].includes(col) || (u?.email === ADMIN) || (u && PROPRIAS.includes(col) && id === u.id);
const podeGravar = (u, col, id) => col !== 'pagamentos' && ((u?.email === ADMIN) || (u && PROPRIAS.includes(col) && id === u.id));
function ler(req) { return new Promise((ok) => { let b = ''; req.on('data', (c) => b += c); req.on('end', () => { try { ok(b ? JSON.parse(b) : {}); } catch { ok({}); } }); }); }
const servidor = http.createServer(async (req, res) => {
  const cab = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*', 'Content-Type': 'application/json' };
  const enviar = (st, corpo) => { res.writeHead(st, cab); res.end(corpo === undefined ? '' : JSON.stringify(corpo)); };
  if (req.method === 'OPTIONS') return enviar(200);
  const u = new URL(req.url, 'http://x');
  const tk = (req.headers.authorization || '').replace('Bearer ', '');
  const quem = tokens.get(tk) || null;
  const corpo = await ler(req);
  if (u.pathname === '/auth/v1/signup') {
    if (!corpo.email) return enviar(200, sessao({ id: crypto.randomUUID(), email: '' }));
    if (usuarios.has(corpo.email)) return enviar(422, { msg: 'User already registered' });
    const novo = { id: crypto.randomUUID(), senha: corpo.password }; usuarios.set(corpo.email, novo);
    return enviar(200, sessao({ id: novo.id, email: corpo.email }));
  }
  if (u.pathname === '/auth/v1/token') {
    if (u.searchParams.get('grant_type') === 'password') {
      const c = usuarios.get(corpo.email);
      if (!c || c.senha !== corpo.password) return enviar(400, { error_description: 'Invalid login credentials' });
      return enviar(200, sessao({ id: c.id, email: corpo.email }));
    }
    const ant = tokens.get(String(corpo.refresh_token).slice(1));
    return ant ? enviar(200, sessao(ant)) : enviar(400, {});
  }
  if (u.pathname.startsWith('/auth/v1/')) return enviar(200, {});
  if (u.pathname === '/rest/v1/docs') {
    if (!quem && tk !== 'chave-anon') return enviar(401, { message: 'JWT' });
    const col = (u.searchParams.get('colecao') || '').replace('eq.', '');
    const id = u.searchParams.get('id')?.replace('eq.', '');
    if (req.method === 'GET') {
      const linhas = [...docs.entries()].filter(([k]) => k.startsWith(col + '/') && (id === undefined || k === col + '/' + id))
        .map(([k, v]) => ({ id: k.slice(col.length + 1), dados: v.dados, atualizado: v.atualizado }))
        .filter((l) => podeLer(quem, col, l.id));
      return enviar(200, linhas);
    }
    if (req.method === 'POST') {
      if (!podeGravar(quem, corpo.colecao, corpo.id)) return enviar(403, { message: 'new row violates row-level security policy' });
      docs.set(corpo.colecao + '/' + corpo.id, { dados: corpo.dados, atualizado: new Date().toISOString() + Math.random() });
      return enviar(201);
    }
    if (req.method === 'DELETE') { if (!podeGravar(quem, col, id)) return enviar(403, {}); docs.delete(col + '/' + id); return enviar(204); }
  }
  if (u.pathname === '/rest/v1/rpc/status_pagamento') {
    const pg = docs.get('pagamentos/' + corpo.codigo);
    const meu = docs.get('reservas/' + quem?.id)?.dados?.lista?.some((p) => p.codigo === corpo.codigo);
    return enviar(200, pg && meu ? pg.dados : null);
  }
  if (u.pathname === '/functions/v1/pagamento') {
    const meu = docs.get('reservas/' + quem?.id)?.dados?.lista?.find((p) => p.codigo === corpo.codigo);
    if (!meu) return enviar(404, { erro: 'Pedido não encontrado' });
    const valor = meu.tipo === 'compra' ? meu.total : meu.sinal;
    const dados = { codigo: corpo.codigo, status: 'pending', valor, qrCopiaECola: '00020126580014br.gov.bcb.pix0136TESTE-' + corpo.codigo, qrImagem: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==' };
    docs.set('pagamentos/' + corpo.codigo, { dados, atualizado: 'x' });
    return enviar(200, dados);
  }
  if (u.pathname === '/teste/aprovar') { // o que o webhook faz no servidor de verdade
    const codigo = u.searchParams.get('codigo');
    const pg = docs.get('pagamentos/' + codigo);
    pg.dados = { ...pg.dados, status: 'approved', valorPago: pg.dados.valor, verificado: true };
    for (const [k, v] of docs) if (k.startsWith('reservas/')) {
      const ped = v.dados.lista?.find((p) => p.codigo === codigo);
      if (!ped) continue;
      for (const it of ped.itens) { const pr = docs.get('produtos/' + it.id); if (pr) { pr.dados = { ...pr.dados, estoque: pr.dados.estoque - it.qtd }; pr.atualizado = new Date().toISOString() + Math.random(); } }
      v.dados = { lista: v.dados.lista.map((p) => p.codigo === codigo ? { ...p, status: 'confirmado', pago: true, confirmadoEm: Date.now(), estoqueBaixado: true, pagamentoVerificado: true } : p) };
      v.atualizado = new Date().toISOString() + Math.random();
    }
    return enviar(200, { ok: true });
  }
  if (u.pathname === '/teste/docs') return enviar(200, Object.fromEntries([...docs].map(([k, v]) => [k, v.dados])));
  enviar(404, {});
}).listen(porta, () => pronto(servidor));
}); }
