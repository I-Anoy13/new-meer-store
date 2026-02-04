
const CACHE_NAME = 'itx-meer-v6-hyper';
const ASSETS = [
  '/',
  '/index.html',
  '/admin.html',
  '/manifest.json',
  '/manifest-admin.json'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.map((key) => {
        if (key !== CACHE_NAME) return caches.delete(key);
      })
    ))
  );
});

// Hyper-fast Stale-while-revalidate
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Never cache database or real-time calls
  if (url.hostname.includes('supabase.co')) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networked = fetch(event.request).then((response) => {
        const cacheCopy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cacheCopy));
        return response;
      }).catch(() => cached);
      
      return cached || networked;
    })
  );
});
