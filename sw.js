
import { createClient } from 'https://esm.sh/@supabase/supabase-js@^2.93.3';

const SUPABASE_URL = 'https://hwkotlfmxuczloonjziz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3a290bGZteHVjemxvb25qeml6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyMzE5ODUsImV4cCI6MjA4NDgwNzk4NX0.GUFuxE-xMBy4WawTWbiyCOWr3lcqNF7BoqQ55-UMe3Y';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
let channel = null;

function setupBackgroundListener() {
  if (channel) channel.unsubscribe();

  // SW listens to the omega terminal channel for new orders
  channel = supabase.channel('itx_admin_terminal_omega_v9')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
      const order = payload.new;
      
      const notificationOptions = {
        body: `New Order: Rs. ${order.total_pkr || order.total} — ${order.customer_name}`,
        icon: 'https://images.unsplash.com/photo-1614164185128-e4ec99c436d7?q=80&w=192&h=192&auto=format&fit=crop',
        vibrate: [200, 100, 200, 100, 400],
        tag: 'order-alert-' + (order.order_id || order.id),
        requireInteraction: true,
        data: { url: '/admin' }
      };

      self.registration.showNotification('🚨 ITX ORDER RECEIVED', notificationOptions);

      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: 'NEW_ORDER_DETECTED', order: order });
        });
      });
    })
    .subscribe((status) => {
      if (status !== 'SUBSCRIBED') {
        setTimeout(setupBackgroundListener, 10000);
      }
    });
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
  setupBackgroundListener();
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'START_BACKGROUND_SYNC') {
    setupBackgroundListener();
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = new URL('/admin', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (let client of windowClients) {
        if (client.url === targetUrl && 'focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
