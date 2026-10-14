// Deixa a loja abrir rápido e funcionar sem internet.
// Páginas e scripts: tenta a rede primeiro (sempre a versão nova) e usa a cópia guardada se cair.
// Imagens e fontes: usa a cópia guardada e atualiza por trás.
const VERSAO = "tmz-v1";
const BASICO = ["./", "index.html", "css/fonts.css", "css/style.css", "css/telas.css", "img/logo-tmz.png", "img/icones/icone-192.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(BASICO)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSAO).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return; // Supabase, ViaCEP, pagamento: sempre direto
  const estatico = /\.(png|jpe?g|svg|webp|woff2?)$/.test(url.pathname);
  if (estatico) {
    e.respondWith(caches.open(VERSAO).then(async (c) => {
      const guardado = await c.match(req);
      const rede = fetch(req).then((r) => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => guardado);
      return guardado || rede;
    }));
    return;
  }
  e.respondWith(fetch(req).then((r) => {
    if (r.ok) { const copia = r.clone(); caches.open(VERSAO).then((c) => c.put(req, copia)); }
    return r;
  }).catch(() => caches.match(req).then((r) => r || caches.match("index.html"))));
});
