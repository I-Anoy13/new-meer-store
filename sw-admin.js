
const CACHE_NAME = 'itx-admin-v25';
const ASSETS = ['/admin.html', '/manifest-admin.json'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => k !== CACHE_NAME && caches.delete(k))))
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'TRIGGER_NOTIFICATION') {
    const { title, body, orderId } = event.data;
    const options = {
      body: body || 'New Order Received',
      icon: 'https://images.unsplash.com/photo-1614164185128-e4ec99c436d7?q=80&w=192&h=192&auto=format&fit=crop',
      badge: 'https://images.unsplash.com/photo-1614164185128-e4ec99c436d7?q=80&w=96&h=96&auto=format&fit=crop',
      vibrate: [500, 200, 500, 200, 500],
      tag: orderId || `order-${Date.now()}`,
      renotify: true,
      requireInteraction: true,
      data: { url: '/admin.html' }
    };

    event.waitUntil(self.registration.showNotification(title, options));
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
