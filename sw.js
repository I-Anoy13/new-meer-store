
const CACHE_NAME = 'itx-v22-safari';
const ASSETS = ['/', '/index.html', '/admin.html', '/manifest.json', '/manifest-admin.json'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) => Promise.all(keys.map((k) => k !== CACHE_NAME && caches.delete(k))))
    ])
  );
});

// Listener for background order triggers from the app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'TRIGGER_NOTIFICATION') {
    const { title, options, orderId } = event.data;
    
    const notificationPromise = self.registration.showNotification(title, {
      ...options,
      icon: 'https://images.unsplash.com/photo-1614164185128-e4ec99c436d7?q=80&w=192&h=192&auto=format&fit=crop',
      badge: 'https://images.unsplash.com/photo-1614164185128-e4ec99c436d7?q=80&w=96&h=96&auto=format&fit=crop',
      vibrate: [500, 100, 500],
      requireInteraction: true,
      tag: orderId || `order-${Date.now()}`, // Force unique to prevent stacking
      renotify: true,
      data: { url: '/admin.html' }
    });

    event.waitUntil(notificationPromise);
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('admin.html') && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('/admin.html');
    })
  );
});
