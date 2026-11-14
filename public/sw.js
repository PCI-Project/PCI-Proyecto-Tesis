const CACHE_NAME = 'asphalt-pci-pro-cache-v3';

// Assets estáticos que rara vez cambian: seguros para cache-first
const URLS_TO_CACHE = [
  '/manifest.json',
  '/brand/emblema-positivo.svg',
  '/brand/emblema-negativo.svg',
  '/brand/emblema-sobre-turquesa.svg',
  '/brand/horizontal-positivo.svg',
  '/brand/horizontal-negativo.svg',
  '/brand/icono-app.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching static assets');
        return cache.addAll(URLS_TO_CACHE);
      })
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Siempre de la red: index.html, raíz, init.js e index.css (cambian en cada despliegue)
  if (url.pathname === '/' || url.pathname === '/index.html' || url.pathname === '/init.js' || url.pathname === '/index.css') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Si la red falla, intentar caché como respaldo
          if (!response || response.status !== 200) {
            return caches.match(event.request);
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Para el resto de assets estáticos: caché primero, red como respaldo
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});
