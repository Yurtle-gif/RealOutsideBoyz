// Real Outside Boyz offline cache: the page is network-first so updates arrive, everything else cache-first after the first play.
const CACHE = 'rob-v6';
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'])));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  // Google Maps Platform content (3D tiles, Draco decoders, logo) must not be cached by us (Google terms); the local key file stays network-only too.
  const u = new URL(req.url);
  if (u.hostname === 'tile.googleapis.com' || u.hostname === 'maps.gstatic.com' || u.hostname === 'www.gstatic.com' || u.pathname.endsWith('/config.local.js')) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put('./index.html', cp)); return r; }).catch(() => caches.match('./index.html')));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
    if (r.ok || r.type === 'opaque') { const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)).catch(() => {}); }
    return r;
  })));
});
