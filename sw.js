
const CACHE_NAME = 'itx-meer-v11-always-on';
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
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) => Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      ))
    ])
  );
});

// Robust Background Notification Bridge
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'TRIGGER_NOTIFICATION') {
    const { title, options } = event.data;
    
    // Ensure we can show notifications even if the app is backgrounded
    event.waitUntil(
      self.registration.showNotification(title, {
        ...options,
        badge: 'https://images.unsplash.com/photo-1614164185128-e4ec99c436d7?q=80&w=96&h=96&auto=format&fit=crop',
        vibrate: [500, 110, 500, 110, 450, 110, 200, 110, 170, 40, 450, 110, 200, 110, 170, 40],
        requireInteraction: true,
        renotify: true,
        tag: 'itx-order-alert',
        data: { url: '/admin.html' }
      })
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('admin.html') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow('/admin.html');
    })
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.hostname.includes('supabase.co')) return;
  event.respondWith(
    caches.match(event.request).then((res) => res || fetch(event.request))
  );
});
