const CACHE = 'gl-logistics-v1786477780';

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Не кэшируем ничего — всегда свежий контент
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});