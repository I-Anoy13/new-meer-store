
const CACHE_NAME = 'itx-master-v99';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Listener for messages from the App UI to trigger system-level alerts
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'TRIGGER_NOTIFICATION') {
    const { title, body, orderId } = event.data;
    const options = {
      body: body,
      icon: 'https://images.unsplash.com/photo-1614164185128-e4ec99c436d7?q=80&w=192&h=192&auto=format&fit=crop',
      badge: 'https://images.unsplash.com/photo-1614164185128-w=96&h=96&auto=format&fit=crop',
      vibrate: [500, 100, 500, 100, 500], // Aggressive vibration
      tag: 'new-order-alert', // Same tag means new orders replace old ones (prevents clutter)
      renotify: true,
      requireInteraction: true, // IMPORTANT: Notification stays until user swipes
      data: { url: '/admin.html' },
      actions: [
        { action: 'open', title: '🚀 VIEW ORDER' }
      ]
    };
    event.waitUntil(self.registration.showNotification(title, options));
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = new URL('/admin.html', self.location.origin).href;
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
