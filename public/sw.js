// Service worker: la página abre al instante y funciona sin señal con los últimos datos bajados.
// Lo que cambia se pide primero a la red; fuentes e íconos salen del caché.
const VERSION = 'qac-v1';
const BASE = ['/', '/index.html', '/styles.css', '/app.js', '/escudo.svg', '/fonts/archivo-variable.woff2', '/icono-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(BASE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;

  // Datos, página, código y estilos: red primero (siempre lo último publicado); sin señal, la copia guardada.
  const clave = req.mode === 'navigate' ? '/index.html' : url.pathname;
  if (req.mode === 'navigate' || url.pathname.startsWith('/data/') || /\.(js|css|html|webmanifest)$/.test(url.pathname)) {
    e.respondWith(
      fetch(req).then((r) => {
        const copia = r.clone();
        if (r.ok) caches.open(VERSION).then((c) => c.put(clave, copia));
        return r;
      }).catch(() => caches.match(clave)),
    );
    return;
  }

  // Fuentes e íconos: caché primero y se renuevan por detrás.
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((guardada) => {
      const nueva = fetch(req).then((r) => {
        if (r.ok) { const copia = r.clone(); caches.open(VERSION).then((c) => c.put(req, copia)); }
        return r;
      }).catch(() => guardada);
      return guardada || nueva;
    }),
  );
});
