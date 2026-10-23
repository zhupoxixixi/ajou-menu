'use strict';
// This cache and scope belong only to /ajou-menu/, separate from Ajou Notices.
const CACHE = 'ajou-menu-v21-20261023-glass-repair';
const ASSETS = ['./', 'index.html', 'styles.css', 'menu.js', 'appearance.js', 'background.js', 'contrast.js', 'menu-data.js', 'favicon.svg', 'manifest.webmanifest', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'assets/default-background.svg'];
const ROOT = new URL('./', self.location.href);
const urls = ASSETS.map(path => new URL(path, ROOT).href);
const failedClients = new Set();

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(urls.map(url => new Request(url, { cache: 'reload' })));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    await Promise.all((await caches.keys()).filter(key => key.startsWith('ajou-menu-') && key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type !== 'menu-cache-status') return;
  event.waitUntil((async () => {
    let ready = false;
    try {
      const cache = await caches.open(CACHE);
      const entries = await Promise.all(urls.map(url => cache.match(url)));
      ready = entries.every(Boolean);
    } catch {}
    event.ports[0]?.postMessage({ ready, fallback: failedClients.has(event.source?.id) });
  })());
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== ROOT.origin || !url.pathname.startsWith(ROOT.pathname)) return;
  url.search = ''; url.hash = '';
  if (!urls.includes(url.href)) return;
  event.respondWith((async () => {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 8000);
    try {
      const response = await fetch(event.request, { cache: 'no-store', signal: abort.signal });
      if (response.status >= 500) throw new Error('Temporary server failure');
      if (response.ok && [ROOT.pathname, `${ROOT.pathname}index.html`].includes(url.pathname)) {
        failedClients.delete(event.resultingClientId || event.clientId);
      }
      // Storage failures must not replace a fresh network response with old data.
      if (response.ok) {
        try {
          const cache = await caches.open(CACHE);
          await cache.put(url.href, response.clone());
        } catch {}
      }
      return response;
    } catch {
      let saved;
      try {
        const cache = await caches.open(CACHE);
        saved = await cache.match(url.href);
      } catch { return Response.error(); }
      if (!saved) return Response.error();
      const affectedIds = [...new Set([event.clientId, event.resultingClientId].filter(Boolean))];
      for (const id of affectedIds) failedClients.add(id);
      event.waitUntil(Promise.all(affectedIds.map(async id => {
        try {
          const client = await self.clients.get(id);
          client?.postMessage({ type: 'menu-offline-fallback' });
        } catch {}
      })).catch(() => {}));
      return saved;
    } finally { clearTimeout(timer); }
  })());
});
