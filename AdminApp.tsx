
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { Product, Order, User, UserRole } from './types';
import AdminDashboard from './views/AdminDashboard';

const SUPABASE_URL = 'https://hwkotlfmxuczloonjziz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3a290bGZteHVjemxvb25qeml6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyMzE5ODUsImV4cCI6MjA4NDgwNzk4NX0.GUFuxE-xMBy4WawTWbiyCOWr3lcqNF7BoqQ55-UMe3Y';

const adminSupabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

interface AdminToast {
  id: number;
  message: string;
  orderId?: string;
}

const DEFAULT_ALERT_URL = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';

const AdminApp: React.FC = () => {
  const recentUpdates = useRef<Record<string, { status: string, time: number }>>({});
  const [rawOrders, setRawOrders] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('itx_admin_orders_cache');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });
  
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<AdminToast[]>([]);
  const [audioEnabled, setAudioEnabled] = useState(() => {
    return localStorage.getItem('itx_admin_audio_enabled') === 'true';
  });
  
  const [customSound, setCustomSound] = useState<string | null>(() => {
    return localStorage.getItem('itx_admin_custom_sound');
  });
  
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('itx_user_session');
      return saved ? JSON.parse(saved) : null;
    } catch (e) { return null; }
  });

  const playNotificationSound = useCallback(() => {
    if (!audioEnabled) return;
    try {
      // Use custom sound if available, otherwise default
      const soundSrc = customSound || DEFAULT_ALERT_URL;
      const audio = new Audio(soundSrc);
      audio.play().catch(e => console.warn('[Admin] Audio playback blocked by browser policies. Interaction required.'));
    } catch (e) {
      console.error('[Admin] Sound playback error:', e);
    }
  }, [audioEnabled, customSound]);

  const addAdminToast = useCallback((message: string, orderId?: string) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, orderId }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 10000); // Extended toast duration for better visibility
  }, []);

  const syncToStorage = useCallback((data: any[]) => {
    try { localStorage.setItem('itx_admin_orders_cache', JSON.stringify(data)); } catch (e) {}
  }, []);

  const refreshOrders = useCallback(async (isSilent = false) => {
    try {
      const { data, error } = await adminSupabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000); 
      
      if (!error && data) {
        if (!isSilent && rawOrders.length > 0) {
          const currentIds = new Set(rawOrders.map(o => String(o.order_id || o.id)));
          const newOrders = data.filter(o => !currentIds.has(String(o.order_id || o.id)));
          
          if (newOrders.length > 0) {
            playNotificationSound();
            newOrders.forEach(o => {
              addAdminToast(`New Order from ${o.customer_name}`, o.order_id || String(o.id));
            });
          }
        }

        const mergedData = data.map(serverOrder => {
          const id = String(serverOrder.order_id || serverOrder.id);
          const localIntent = recentUpdates.current[id];
          if (localIntent && (Date.now() - localIntent.time < 30000)) {
            return { ...serverOrder, status: localIntent.status };
          }
          return serverOrder;
        });

        setRawOrders(mergedData);
        syncToStorage(mergedData);
      }
    } catch (e) {
      console.error("[Admin] Sync Failure:", e);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [syncToStorage, rawOrders, playNotificationSound, addAdminToast]);

  const refreshProducts = useCallback(async () => {
    try {
      const { data, error } = await adminSupabase.from('products').select('*').order('created_at', { ascending: false });
      if (!error && data) {
        setProducts(data.map(p => {
          let parsedImages = [];
          try {
            parsedImages = typeof p.images === 'string' ? JSON.parse(p.images) : (Array.isArray(p.images) ? p.images : []);
          } catch(e) { parsedImages = []; }

          let parsedVariants = [];
          try {
            parsedVariants = typeof p.variants === 'string' ? JSON.parse(p.variants) : (Array.isArray(p.variants) ? p.variants : []);
          } catch(e) { parsedVariants = []; }

          return {
            id: String(p.id),
            name: p.name || 'Product',
            description: p.description || '',
            price: Number(p.price || p.price_pkr || 0),
            image: p.image || p.image_url || parsedImages[0] || '',
            images: parsedImages.length > 0 ? parsedImages : (p.image ? [p.image] : []),
            category: p.category || 'Luxury',
            inventory: Number(p.inventory || 0),
            rating: Number(p.rating || 5),
            reviews: [],
            variants: parsedVariants
          };
        }));
      }
    } catch (e) {
      console.error("[Admin] Product Refresh Error:", e);
    }
  }, []);

  const initData = useCallback(async () => {
    await Promise.allSettled([refreshOrders(), refreshProducts()]);
    setLoading(false);
  }, [refreshOrders, refreshProducts]);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const handleMessage = (event: MessageEvent) => {
        if (event.data?.type === 'NEW_ORDER_DETECTED') {
          const order = event.data.order;
          console.log('[Realtime] Instant order detected:', order.id);
          addAdminToast(`New Order from ${order.customer_name}`, order.order_id || String(order.id));
          playNotificationSound();
          refreshOrders(true);
        }
      };
      navigator.serviceWorker.addEventListener('message', handleMessage);
      return () => navigator.serviceWorker.removeEventListener('message', handleMessage);
    }
  }, [refreshOrders, playNotificationSound, addAdminToast]);

  useEffect(() => {
    if (user?.role === UserRole.ADMIN) {
      initData();
      const interval = setInterval(() => refreshOrders(true), 30000);
      return () => clearInterval(interval);
    } else {
      setLoading(false);
    }
  }, [user, initData, refreshOrders]);

  const updateOrderStatus = async (id: string, status: string, dbId: any) => {
    const cleanStatus = status.toLowerCase();
    const orderKey = String(id);
    recentUpdates.current[orderKey] = { status: cleanStatus, time: Date.now() };

    const nextState = rawOrders.map(o => {
      const match = String(o.id) === String(dbId) || String(o.order_id) === orderKey;
      return match ? { ...o, status: cleanStatus } : o;
    });
    setRawOrders(nextState);
    syncToStorage(nextState);

    try {
      const numericDbId = !isNaN(Number(dbId)) ? Number(dbId) : null;
      let updateResult;
      if (numericDbId !== null) {
        updateResult = await adminSupabase.from('orders').update({ status: cleanStatus }).eq('id', numericDbId).select();
      }
      if (!updateResult || !updateResult.data || updateResult.data.length === 0) {
        updateResult = await adminSupabase.from('orders').update({ status: cleanStatus }).eq('order_id', orderKey).select();
      }
      if (updateResult.error) throw updateResult.error;
    } catch (err: any) {
      console.error("[Admin] Update failed:", err);
      delete recentUpdates.current[orderKey];
      refreshOrders(true);
    }
  };

  const formattedOrders = useMemo((): Order[] => {
    return rawOrders.map(o => {
      let cleanStatus: Order['status'] = 'Pending';
      const s = String(o.status || '').toLowerCase();
      if (s === 'confirmed') cleanStatus = 'Confirmed';
      else if (s === 'shipped') cleanStatus = 'Shipped';
      else if (s === 'delivered') cleanStatus = 'Delivered';
      else if (s === 'cancelled') cleanStatus = 'Cancelled';

      let parsedItems = [];
      try {
        parsedItems = typeof o.items === 'string' ? JSON.parse(o.items) : (Array.isArray(o.items) ? o.items : []);
      } catch (e) {}

      return {
        id: o.order_id || String(o.id),
        dbId: o.id,
        items: parsedItems,
        total: Number(o.total_pkr || o.total || 0),
        status: cleanStatus,
        customer: { 
          name: o.customer_name || 'Customer', 
          email: '', 
          phone: o.customer_phone || '', 
          address: o.customer_address || '', 
          city: o.customer_city || '' 
        },
        date: o.created_at || new Date().toISOString()
      };
    });
  }, [rawOrders]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
      <div className="flex flex-col items-center space-y-4">
        <div className="w-8 h-8 border-2 border-white/10 border-t-blue-500 rounded-full animate-spin"></div>
        <p className="text-[10px] font-black uppercase text-white/30 tracking-[0.4em]">Syncing Store Data...</p>
      </div>
    </div>
  );

  return (
    <HashRouter>
      <Routes>
        <Route path="*" element={
          <AdminDashboard 
            orders={formattedOrders}
            products={products}
            user={user}
            toasts={toasts}
            audioEnabled={audioEnabled}
            customSound={customSound}
            setCustomSound={(base64: string | null) => {
              setCustomSound(base64);
              if (base64) localStorage.setItem('itx_admin_custom_sound', base64);
              else localStorage.removeItem('itx_admin_custom_sound');
            }}
            playTestSound={() => playNotificationSound()}
            enableAudio={() => {
                setAudioEnabled(true);
                localStorage.setItem('itx_admin_audio_enabled', 'true');
                playNotificationSound();
                if (Notification.permission === 'default') Notification.requestPermission();
            }}
            disableAudio={() => {
                setAudioEnabled(false);
                localStorage.setItem('itx_admin_audio_enabled', 'false');
            }}
            login={(role: UserRole) => {
              const u: User = { id: 'admin', email: 'admin@itx.com', role, name: 'Store Manager' };
              setUser(u);
              localStorage.setItem('itx_user_session', JSON.stringify(u));
              if (Notification.permission === 'default') Notification.requestPermission();
            }}
            logout={() => { 
              setUser(null); 
              localStorage.removeItem('itx_user_session');
              localStorage.removeItem('itx_admin_orders_cache');
            }}
            systemPassword={localStorage.getItem('systemPassword') || 'admin123'}
            refreshData={initData}
            updateStatus={updateOrderStatus}
            uploadMedia={async (file: File) => {
              try {
                const name = `prod-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '')}`;
                const { data, error } = await adminSupabase.storage.from('products').upload(name, file, {
                  cacheControl: '3600',
                  upsert: true
                });
                
                if (error) throw error;
                const { data: { publicUrl } } = adminSupabase.storage.from('products').getPublicUrl(data.path);
                return publicUrl;
              } catch (e) { 
                console.error("[Upload] Error:", e);
                return null; 
              }
            }}
            saveProduct={async (p: any) => {
              try {
                const productImages = Array.isArray(p.images) ? p.images : [];
                const primaryImage = p.image || productImages[0] || '';

                const payload = { 
                  name: p.name, 
                  description: p.description, 
                  price: Number(p.price),
                  price_pkr: Number(p.price), 
                  image: primaryImage,
                  image_url: primaryImage, 
                  images: productImages, 
                  category: p.category, 
                  inventory: Number(p.inventory), 
                  variants: Array.isArray(p.variants) ? p.variants : [],
                  updated_at: new Date().toISOString()
                };

                let result;
                if (p.id && p.id !== 'undefined') {
                  result = await adminSupabase.from('products').update(payload).eq('id', p.id);
                } else {
                  result = await adminSupabase.from('products').insert([payload]);
                }

                if (result.error) throw result.error;
                await refreshProducts();
                return true;
              } catch (e) {
                console.error("[Admin] Product Save Failure:", e);
                return false;
              }
            }}
            deleteProduct={async (id: string) => {
              const { error } = await adminSupabase.from('products').delete().eq('id', id);
              if (!error) refreshProducts();
            }}
          />
        } />
      </Routes>
    </HashRouter>
  );
};

export default AdminApp;
