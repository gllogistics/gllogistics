const CACHE = 'gl-logistics-v1';
const STATIC = [
  '/', '/staff-dashboard.html', '/staff-cargo', '/trip-report',
  '/invoice', '/clients.html',
  '/js/trip-report2.js', '/js/staff-cargo.js', '/js/dropzone.js',
  '/images/gl_logo_icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC).catch(()=>{})));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (e.request.url.includes('gl-api.gltransam.workers.dev')) return;
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});