
const CACHE_NAME = 'itx-master-v101';
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/admin.html',
  '/admin',
  '/manifest.json',
  '/manifest-admin.json'
];

// Install: Cache the app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(SHELL_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  clients.claim();
});

// Fetch: Network-first falling back to cache
self.addEventListener('fetch', (event) => {
  // Skip cross-origin and non-GET requests
  if (!event.request.url.startsWith(self.location.origin) || event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // If it's a valid response, clone and cache it
        if (response && response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // If network fails, try the cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          
          // If it's a navigation request and nothing is found, return the appropriate shell
          if (event.request.mode === 'navigate') {
            if (event.request.url.includes('/admin')) {
              return caches.match('/admin.html');
            }
            return caches.match('/index.html');
          }
        });
      })
  );
});

// Notification handling
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'TRIGGER_NOTIFICATION') {
    const { title, body, orderId } = event.data;
    const options = {
      body: body,
      icon: 'https://images.unsplash.com/photo-1614164185128-e4ec99c436d7?q=80&w=192&h=192&auto=format&fit=crop',
      badge: 'https://images.unsplash.com/photo-1614164185128-w=96&h=96&auto=format&fit=crop',
      vibrate: [500, 100, 500, 100, 500],
      tag: 'new-order-alert',
      renotify: true,
      requireInteraction: true,
      data: { url: '/admin' },
      actions: [
        { action: 'open', title: '🚀 VIEW ORDER' }
      ]
    };
    event.waitUntil(self.registration.showNotification(title, options));
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = new URL('/admin', self.location.origin).href;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === urlToOpen && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(urlToOpen);
    })
  );
});
