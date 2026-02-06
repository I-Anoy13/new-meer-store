
import { createClient } from 'https://esm.sh/@supabase/supabase-js@^2.93.3';

const SUPABASE_URL = 'https://hwkotlfmxuczloonjziz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3a290bGZteHVjemxvb25qeml6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyMzE5ODUsImV4cCI6MjA4NDgwNzk4NX0.GUFuxE-xMBy4WawTWbiyCOWr3lcqNF7BoqQ55-UMe3Y';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
let backgroundChannel = null;

// The Background Sentinel: Stays alive as long as the OS allows the worker to run
function startSentinel() {
  if (backgroundChannel) {
    backgroundChannel.unsubscribe();
  }

  // Use a dedicated high-priority channel for background alerts
  backgroundChannel = supabase.channel('itx_background_sentinel_v1')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
      const order = payload.new;
      
      // Trigger a system-level notification (Works even if tab is closed)
      const notificationOptions = {
        body: `💰 NEW SALE: Rs. ${order.total_pkr || order.total} from ${order.customer_name}`,
        icon: 'https://images.unsplash.com/photo-1614164185128-e4ec99c436d7?q=80&w=192&h=192&auto=format&fit=crop',
        badge: 'https://images.unsplash.com/photo-1614164185128-e4ec99c436d7?q=80&w=96&h=96&auto=format&fit=crop',
        vibrate: [500, 110, 500, 110, 450, 110, 200, 110, 170, 40, 450, 110, 200, 110, 170, 40],
        tag: 'itx-sale-alert',
        renotify: true,
        requireInteraction: true,
        data: { url: '/admin.html' },
        actions: [
          { action: 'open', title: 'View Order' }
        ]
      };

      self.registration.showNotification('ITX MASTER: NEW ORDER', notificationOptions);
    })
    .subscribe((status) => {
      console.log('Sentinel Status:', status);
      // Auto-retry if the OS throttles the connection
      if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
        setTimeout(startSentinel, 5000);
      }
    });
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      // Start the sentinel immediately on activation
      startSentinel()
    ])
  );
});

// If the app is opened, it can ping the worker to ensure the sentinel is awake
self.addEventListener('message', (event) => {
  if (event.data === 'PING_SENTINEL') {
    startSentinel();
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = new URL('/admin.html', self.location.origin).href;
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
