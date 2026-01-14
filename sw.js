const CACHE_NAME = 'asphalt-pci-pro-cache-v1';
const URLS_TO_CACHE = [
  BASE,
  new URL('index.html', BASE).href,
  new URL('init.js', BASE).href,
  new URL('manifest.json', BASE).href
  // The index.tsx and CDN dependencies will be fetched by the browser when it loads index.html
  // and are best handled by the standard HTTP cache.
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(URLS_TO_CACHE))
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
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return response from cache if available.
        if (response) {
          return response;
        }
        // Otherwise, fetch from the network.
        return fetch(event.request);
      })
  );
});
