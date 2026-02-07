
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

const AdminApp: React.FC = () => {
  // Robust localStorage initialization with try-catch
  const [rawOrders, setRawOrders] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('itx_admin_orders_cache');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("[Admin State] Failed to load cached orders:", e);
      return [];
    }
  });
  
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const processedIds = useRef<Set<string>>(new Set());

  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('itx_user_session');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  // Sync cache to localStorage whenever orders change
  useEffect(() => {
    try {
      if (rawOrders && rawOrders.length > 0) {
        localStorage.setItem('itx_admin_orders_cache', JSON.stringify(rawOrders));
      }
    } catch (e) {}
  }, [rawOrders]);

  const playKaching = useCallback(async () => {
    try {
      if (!audioContextRef.current) audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') await ctx.resume();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine'; osc.frequency.setValueAtTime(2489, now); 
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.5, now + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
      osc.connect(g); g.connect(ctx.destination);
      osc.start(); osc.stop(now + 1.2);
    } catch (e) {}
  }, []);

  const refreshOrders = useCallback(async (isSilent = false) => {
    try {
      const { data, error } = await adminSupabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000); 
      
      if (!error && data) {
        setRawOrders(data);
        data.forEach(o => processedIds.current.add(String(o.order_id || o.id)));
      }
    } catch (e) {
      console.error("[Admin App] Order Fetch Failed:", e);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, []);

  const refreshProducts = useCallback(async () => {
    try {
      const { data, error } = await adminSupabase.from('products').select('*').order('created_at', { ascending: false });
      if (!error && data) {
        setProducts(data.map(p => ({
          id: String(p.id),
          name: p.name,
          description: p.description || '',
          price: Number(p.price_pkr || p.price || 0),
          image: p.image || p.image_url || '',
          images: Array.isArray(p.images) ? p.images : (p.image ? [p.image] : []),
          category: p.category || 'Luxury',
          inventory: Number(p.inventory || 0),
          rating: Number(p.rating || 5),
          reviews: [],
          variants: Array.isArray(p.variants) ? p.variants : []
        })));
      }
    } catch (e) {
      console.error("[Admin App] Product Fetch Failed:", e);
    }
  }, []);

  const initData = useCallback(async () => {
    setLoading(true);
    // Add a safety timeout to ensure the blank screen clears
    const safetyTimeout = setTimeout(() => setLoading(false), 5000);
    
    await Promise.allSettled([refreshOrders(), refreshProducts()]);
    
    clearTimeout(safetyTimeout);
    setLoading(false);
  }, [refreshOrders, refreshProducts]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && user?.role === UserRole.ADMIN) {
        refreshOrders(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [user, refreshOrders]);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'NEW_ORDER_DETECTED') {
        const newOrder = event.data.order;
        const id = String(newOrder.order_id || newOrder.id);
        if (!processedIds.current.has(id)) {
          processedIds.current.add(id);
          setRawOrders(prev => [newOrder, ...prev]);
          playKaching();
        }
      }
      if (event.data.type === 'SENTINEL_ALIVE') setIsLive(true);
    };
    navigator.serviceWorker.addEventListener('message', handleMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleMessage);
  }, [playKaching]);

  useEffect(() => {
    if (user?.role === UserRole.ADMIN) {
      initData();
    } else {
      setLoading(false);
    }
  }, [user, initData]);

  const updateOrderStatus = async (id: string, status: string, dbId: any) => {
    const cleanStatus = status.toLowerCase();
    const previousState = JSON.parse(JSON.stringify(rawOrders));
    
    setRawOrders(prev => prev.map(o => {
      const isMatch = String(o.id) === String(dbId) || String(o.order_id) === String(id);
      return isMatch ? { ...o, status: cleanStatus } : o;
    }));

    try {
      const targetPk = isNaN(Number(dbId)) ? dbId : Number(dbId);
      const { error } = await adminSupabase
        .from('orders')
        .update({ status: cleanStatus })
        .eq('id', targetPk);
      
      if (error) {
        const { error: fbError } = await adminSupabase
          .from('orders')
          .update({ status: cleanStatus })
          .eq('order_id', id);
        
        if (fbError) throw fbError;
      }
    } catch (err: any) {
      console.error("[Admin App] Status Update Failed:", err);
      setRawOrders(previousState);
      alert(`Update Failed: ${err.message}`);
    }
  };

  const formattedOrders = useMemo((): Order[] => {
    if (!rawOrders) return [];
    return rawOrders.map(o => {
      let cleanStatus: Order['status'] = 'Pending';
      if (o.status) {
        const s = o.status.toLowerCase();
        if (s === 'confirmed') cleanStatus = 'Confirmed';
        else if (s === 'shipped') cleanStatus = 'Shipped';
        else if (s === 'delivered') cleanStatus = 'Delivered';
        else if (s === 'cancelled') cleanStatus = 'Cancelled';
        else cleanStatus = 'Pending';
      }

      // Safe JSON parsing for items
      let parsedItems = [];
      try {
        parsedItems = typeof o.items === 'string' ? JSON.parse(o.items) : (Array.isArray(o.items) ? o.items : []);
      } catch (e) {
        console.warn(`[Admin App] Corrupted items in order ${o.order_id || o.id}`);
      }

      return {
        id: o.order_id || String(o.id),
        dbId: o.id,
        items: parsedItems,
        total: Number(o.total_pkr || o.total || 0),
        status: cleanStatus,
        customer: { 
          name: o.customer_name || 'Anonymous', 
          email: '', 
          phone: o.customer_phone || '', 
          address: o.customer_address || '', 
          city: o.customer_city || '' 
        },
        date: o.created_at || new Date().toISOString()
      };
    });
  }, [rawOrders]);

  const uploadMedia = async (file: File): Promise<string | null> => {
    try {
      const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '')}`;
      const { data, error } = await adminSupabase.storage.from('products').upload(fileName, file);
      if (error) throw error;
      const { data: { publicUrl } } = adminSupabase.storage.from('products').getPublicUrl(data.path);
      return publicUrl;
    } catch (err) {
      console.error("[Admin App] Upload Error:", err);
      return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
          <p className="text-[10px] font-black uppercase text-white/40 tracking-widest italic">Syncing Manifest...</p>
        </div>
      </div>
    );
  }

  return (
    <HashRouter>
      <Routes>
        <Route path="*" element={
          <AdminDashboard 
            orders={formattedOrders}
            products={products}
            user={user}
            isLive={isLive}
            audioReady={audioReady}
            login={(role: UserRole) => {
              const u: User = { id: 'master', email: 'admin@itx.com', role, name: 'Master' };
              setUser(u);
              localStorage.setItem('itx_user_session', JSON.stringify(u));
              if (Notification.permission !== 'granted') Notification.requestPermission();
              setAudioReady(true);
            }}
            logout={() => { 
              setUser(null); 
              localStorage.removeItem('itx_user_session');
              localStorage.removeItem('itx_admin_orders_cache');
            }}
            systemPassword={localStorage.getItem('systemPassword') || 'admin123'}
            initAudio={() => {
              if (Notification.permission !== 'granted') Notification.requestPermission();
              setAudioReady(true);
            }}
            refreshData={initData}
            updateStatus={updateOrderStatus}
            uploadMedia={uploadMedia}
            saveProduct={async (p: any) => {
              const payload = {
                name: p.name,
                description: p.description,
                price_pkr: Number(p.price),
                image: p.image,
                images: p.images,
                category: p.category,
                inventory: Number(p.inventory),
                variants: p.variants
              };
              const { error } = p.id ? await adminSupabase.from('products').update(payload).eq('id', p.id) : await adminSupabase.from('products').insert([payload]);
              if (!error) refreshProducts();
              return !error;
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
