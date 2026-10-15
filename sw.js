/* Catch's offline helper: keeps the app's own files on the device so it opens without a connection.
   The page itself is fetched fresh when online (so updates arrive); everything it uses is versioned (?v=…)
   and kept once fetched. Database requests pass straight through — the app keeps its own copy of the archive. */
const CACHE = 'catch-v1';

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const res = await fetch('./', { cache:'no-cache' });
    const html = await res.clone().text();
    await cache.put('./', res);
    // keep every local script the page loads
    const files = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]).filter(u => !/^https?:/.test(u));
    await Promise.all(files.map(f => cache.add(f).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for(const k of await caches.keys()) if(k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

function withTimeout(promise, ms){
  return Promise.race([promise, new Promise((_, no) => setTimeout(() => no(new Error('timeout')), ms))]);
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);

  // the page: fresh when possible, the kept copy when offline (share links like ?url=… open it too)
  if(req.mode === 'navigate'){
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try{
        const res = await withTimeout(fetch(req), 4000);
        if(res.ok) cache.put('./', res.clone());
        return res;
      }catch(e){
        return (await cache.match('./')) || Response.error();
      }
    })());
    return;
  }

  // the app's files and its fonts: use the kept copy, fetch and keep it if missing
  const own = url.origin === self.location.origin;
  const fonts = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if(!own && !fonts) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req);
    if(hit) return hit;
    const res = await fetch(req);
    if(res.ok) cache.put(req, res.clone());
    return res;
  })());
});
