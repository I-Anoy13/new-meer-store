
// Import Supabase from ESM
import { createClient } from 'https://esm.sh/@supabase/supabase-js@^2.93.3';

const SUPABASE_URL = 'https://hwkotlfmxuczloonjziz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3a290bGZteHVjemxvb25qeml6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyMzE5ODUsImV4cCI6MjA4NDgwNzk4NX0.GUFuxE-xMBy4WawTWbiyCOWr3lcqNF7BoqQ55-UMe3Y';

const CACHE_NAME = 'itx-master-v105';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Background Subscription logic
let channel = null;

function setupBackgroundListener() {
  if (channel) return;

  channel = supabase.channel('background-orders')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
      const order = payload.new;
      
      // 1. Show Notification
      self.registration.showNotification('🔥 NEW ORDER RECEIVED!', {
        body: `Rs. ${order.total_pkr || order.total} — ${order.customer_name} from ${order.customer_city || 'City'}`,
        icon: 'https://images.unsplash.com/photo-1614164185128-e4ec99c436d7?q=80&w=192&h=192&auto=format&fit=crop',
        vibrate: [500, 100, 500, 100, 500],
        tag: 'new-order-alert',
        requireInteraction: true,
        data: { url: '/admin' }
      });

      // 2. Broadcast to all open tabs
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'NEW_ORDER_DETECTED',
            order: order
          });
        });
      });
    })
    .subscribe();
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
  setupBackgroundListener();
});

// Re-establish on any wake event
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'START_BACKGROUND_SYNC') {
    setupBackgroundListener();
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
