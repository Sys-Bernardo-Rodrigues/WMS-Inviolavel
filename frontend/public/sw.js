const CACHE_NAME = 'inviolavel-wms-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/manifest.json'
];

// Install Event
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event (Network falling back to Cache)
self.addEventListener('fetch', (e) => {
  // Only handle GET requests and exclude API requests
  if (e.request.method !== 'GET' || e.request.url.includes('/api/')) {
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        // Cache the response if it is valid
        const resClone = res.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(e.request, resClone);
        });
        return res;
      })
      .catch(() => {
        // Fallback to cache if network fails
        return caches.match(e.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // If offline page is not cached, return index.html for navigation requests
          if (e.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
      })
  );
});
