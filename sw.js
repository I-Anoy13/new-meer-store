
import { createClient } from 'https://esm.sh/@supabase/supabase-js@^2.93.3';

const SUPABASE_URL = 'https://hwkotlfmxuczloonjziz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3a290bGZteHVjemxvb25qeml6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyMzE5ODUsImV4cCI6MjA4NDgwNzk4NX0.GUFuxE-xMBy4WawTWbiyCOWr3lcqNF7BoqQ55-UMe3Y';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
let channel = null;

const NOTIFY_ICON = 'https://images.unsplash.com/photo-1614164185128-e4ec99c436d7?q=80&w=192&h=192&auto=format&fit=crop';

function initRealtime() {
  if (channel) channel.unsubscribe();

  channel = supabase.channel('order-sentinel')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
      const order = payload.new;
      console.log('[SW Sentinel] New order detected:', order.id);
      
      // 1. Trigger OS Notification
      self.registration.showNotification('💰 NEW ORDER RECEIVED', {
        body: `Order #${order.order_id || order.id} - Rs. ${order.total_pkr || order.total} from ${order.customer_name}`,
        icon: NOTIFY_ICON,
        badge: NOTIFY_ICON,
        vibrate: [500, 110, 500, 110, 450, 110, 200, 110, 170, 40, 450, 110, 200, 110, 170, 40],
        tag: 'new-order-' + (order.order_id || order.id),
        data: { url: '/admin.html' },
        requireInteraction: true
      });

      // 2. Broadcast to any open Admin windows for instant UI update and sound
      self.clients.matchAll({ type: 'window' }).then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'NEW_ORDER_DETECTED',
            order: order
          });
        });
      });
    })
    .subscribe((status) => {
      console.log('[SW Sentinel] Connection status:', status);
      if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
        setTimeout(initRealtime, 5000); 
      }
    });
}

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim().then(() => initRealtime()));
});

self.addEventListener('message', (event) => {
  if (event.data === 'REQUEST_SENTINEL_STATUS') {
    if (!channel) initRealtime();
    event.source.postMessage({ type: 'SENTINEL_ALIVE' });
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clients => {
      for (const client of clients) {
        if (client.url.includes('admin') && 'focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('/admin.html');
    })
  );
});
