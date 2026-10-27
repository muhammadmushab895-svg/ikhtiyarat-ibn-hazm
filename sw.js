const CACHE_NAME = 'ibnhazm-turath-v3';
const STATIC_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './data-kitabs.js',
  './data-masail.js',
  './data-curated.js',
  './data-turath-cache.js',
  './manifest.json',
  './icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-caching static assets for Ibn Hazm');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key !== 'turath-pages-cache') {
            console.log('[SW] Deleting old foreign cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // تخزين صفحات تراث الرقمية في الكاش لتعمل دون إنترنت
  if (url.pathname.startsWith('/api/turath/') || url.hostname === 'api.turath.io') {
    event.respondWith(
      caches.open('turath-pages-cache').then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          return fetch(event.request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => {
            return new Response(JSON.stringify({
              error: 'Offline',
              message: 'الصفحة غير مخزنة في الذاكرة دون اتصال.'
            }), {
              headers: { 'Content-Type': 'application/json; charset=utf-8' }
            });
          });
        });
      })
    );
    return;
  }

  // الملفات الثابتة للتطبيق
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && event.request.method === 'GET') {
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse.clone()));
        }
        return networkResponse;
      }).catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
