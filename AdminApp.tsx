
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
  const recentUpdates = useRef<Record<string, { status: string, time: number }>>({});
  const [rawOrders, setRawOrders] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('itx_admin_orders_cache');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
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
    } catch (e) { return null; }
  });

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 2000);
    return () => clearTimeout(timer);
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
        .limit(200); 
      
      if (!error && data) {
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
        mergedData.forEach(o => processedIds.current.add(String(o.order_id || o.id)));
      }
    } catch (e) {
      console.error("[Admin App] Sync Failed:", e);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [syncToStorage]);

  const refreshProducts = useCallback(async () => {
    try {
      const { data, error } = await adminSupabase.from('products').select('*').order('created_at', { ascending: false });
      if (!error && data) {
        setProducts(data.map(p => ({
          id: String(p.id),
          name: p.name || 'Product',
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
    } catch (e) {}
  }, []);

  const initData = useCallback(async () => {
    await Promise.allSettled([refreshOrders(), refreshProducts()]);
    setLoading(false);
  }, [refreshOrders, refreshProducts]);

  useEffect(() => {
    if (user?.role === UserRole.ADMIN) initData();
    else setLoading(false);
  }, [user, initData]);

  useEffect(() => {
    const onResume = () => {
      if (document.visibilityState === 'visible' && user?.role === UserRole.ADMIN) refreshOrders(true);
    };
    document.addEventListener('visibilitychange', onResume);
    return () => document.removeEventListener('visibilitychange', onResume);
  }, [user, refreshOrders]);

  const updateOrderStatus = async (id: string, status: string, dbId: any) => {
    const cleanStatus = status.toLowerCase();
    const orderKey = String(id);
    
    // 1. Mark as local intent
    recentUpdates.current[orderKey] = { status: cleanStatus, time: Date.now() };

    // 2. Optimistic UI update
    const nextState = rawOrders.map(o => {
      const match = String(o.id) === String(dbId) || String(o.order_id) === orderKey;
      return match ? { ...o, status: cleanStatus } : o;
    });
    setRawOrders(nextState);
    syncToStorage(nextState);

    try {
      // Correctly cast dbId: Supabase 'id' is usually an integer
      const numericDbId = !isNaN(Number(dbId)) ? Number(dbId) : null;
      
      let updateResult;
      
      // Attempt 1: Using the Numeric Primary Key (id)
      if (numericDbId !== null) {
        updateResult = await adminSupabase
          .from('orders')
          .update({ status: cleanStatus })
          .eq('id', numericDbId)
          .select();
      }

      // Attempt 2: Fallback to the String order_id if Attempt 1 failed or wasn't possible
      if (!updateResult || !updateResult.data || updateResult.data.length === 0) {
        updateResult = await adminSupabase
          .from('orders')
          .update({ status: cleanStatus })
          .eq('order_id', orderKey)
          .select();
      }

      if (updateResult.error) throw updateResult.error;
      
      if (!updateResult.data || updateResult.data.length === 0) {
        throw new Error("PERMISSION_DENIED_OR_NOT_FOUND");
      }

      console.log(`[Persistence] Manifest ${id} locked as ${cleanStatus}`);
    } catch (err: any) {
      console.error("[Persistence Critical]", err);
      delete recentUpdates.current[orderKey];
      
      let msg = "The database rejected this change.";
      if (err.message === "PERMISSION_DENIED_OR_NOT_FOUND") {
        msg = "Manifest Update Rejected: Permission Denied.\n\nFIX: Go to Supabase SQL Editor and run:\nALTER TABLE orders DISABLE ROW LEVEL SECURITY;";
      } else {
        msg = `System Error: ${err.message}`;
      }
      
      alert(msg);
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

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
      <div className="flex flex-col items-center space-y-4">
        <div className="w-5 h-5 border-2 border-white/10 border-t-white rounded-full animate-spin"></div>
        <p className="text-[8px] font-black uppercase text-white/20 tracking-[0.4em]">Vault Accessing...</p>
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
            isLive={isLive}
            audioReady={audioReady}
            login={(role: UserRole) => {
              const u: User = { id: 'master', email: 'admin@itx.com', role, name: 'Master' };
              setUser(u);
              localStorage.setItem('itx_user_session', JSON.stringify(u));
              if (Notification.permission === 'default') Notification.requestPermission();
              setAudioReady(true);
            }}
            logout={() => { 
              setUser(null); 
              localStorage.removeItem('itx_user_session');
              localStorage.removeItem('itx_admin_orders_cache');
            }}
            systemPassword={localStorage.getItem('systemPassword') || 'admin123'}
            initAudio={() => {
              if (Notification.permission === 'default') Notification.requestPermission();
              setAudioReady(true);
            }}
            refreshData={initData}
            updateStatus={updateOrderStatus}
            uploadMedia={async (file: File) => {
              try {
                const name = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '')}`;
                const { data, error } = await adminSupabase.storage.from('products').upload(name, file);
                if (error) return null;
                const { data: { publicUrl } } = adminSupabase.storage.from('products').getPublicUrl(data.path);
                return publicUrl;
              } catch (e) { return null; }
            }}
            saveProduct={async (p: any) => {
              const payload = { name: p.name, description: p.description, price_pkr: Number(p.price), image: p.image, images: p.images, category: p.category, inventory: Number(p.inventory), variants: p.variants };
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
