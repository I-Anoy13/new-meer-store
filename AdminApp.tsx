
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { Product, Order, User, UserRole } from './types';
import { MOCK_PRODUCTS } from './constants';
import { supabase } from './lib/supabase';
import AdminDashboard from './views/AdminDashboard';

const AdminApp: React.FC = () => {
  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem('itx_cached_products');
    return saved ? JSON.parse(saved) : MOCK_PRODUCTS;
  });
  
  const [rawOrders, setRawOrders] = useState<any[]>(() => {
    const saved = localStorage.getItem('itx_cached_orders');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [totalDbCount, setTotalDbCount] = useState<number>(0);
  const [loading, setLoading] = useState(rawOrders.length === 0);
  const [isLive, setIsLive] = useState(false);
  const processedRef = useRef<Set<string>>(new Set());
  const masterChannelRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const [statusOverrides, setStatusOverrides] = useState<Record<string, Order['status']>>(() => {
    const saved = localStorage.getItem('itx_status_overrides');
    return saved ? JSON.parse(saved) : {};
  });

  const [systemPassword, setSystemPassword] = useState<string>(() => {
    return localStorage.getItem('systemPassword') || 'admin123';
  });

  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('itx_user_session');
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    localStorage.setItem('itx_cached_products', JSON.stringify(products));
    localStorage.setItem('itx_cached_orders', JSON.stringify(rawOrders));
    localStorage.setItem('itx_status_overrides', JSON.stringify(statusOverrides));
  }, [products, rawOrders, statusOverrides]);

  const initAudio = useCallback(async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }
    console.log("Audio Engine Waked: ", audioContextRef.current.state);
  }, []);

  const triggerInstantAlert = useCallback((order: any) => {
    if (user?.role !== UserRole.ADMIN) return;

    // Pulse Sound
    try {
      const ctx = audioContextRef.current || new (window.AudioContext || (window as any).webkitAudioContext)();
      if (!audioContextRef.current) audioContextRef.current = ctx;
      
      const playPulse = () => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sawtooth';
        // Higher frequency for better visibility in noisy rooms
        osc.frequency.setValueAtTime(880, ctx.currentTime); 
        osc.frequency.exponentialRampToValueAtTime(1400, ctx.currentTime + 0.15);
        g.gain.setValueAtTime(0, ctx.currentTime);
        g.gain.linearRampToValueAtTime(0.6, ctx.currentTime + 0.05);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
        osc.connect(g); g.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + 1.2);
      };

      if (ctx.state === 'suspended') {
        ctx.resume().then(playPulse);
      } else {
        playPulse();
      }
    } catch (e) {
      console.error("Sonic Pulse Failed:", e);
    }

    // PWA Notification
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'TRIGGER_NOTIFICATION',
        title: '🚨 ORDER ALERT: ITX SHOP',
        body: `Rs. ${order.total_pkr || order.total} — ${order.customer_name} from ${order.customer_city || 'Pakistan'}`,
        orderId: order.order_id || order.id
      });
    }
  }, [user]);

  const normalizeOrder = (row: any): Order | null => {
    if (!row) return null;
    const orderId = row.order_id || (row.id ? `ORD-${row.id}` : 'ORD-UNKNOWN');
    const dbStatusRaw = String(row.status || 'Pending').toLowerCase();
    const capitalized = dbStatusRaw.charAt(0).toUpperCase() + dbStatusRaw.slice(1);
    const dbStatus = (capitalized || 'Pending') as Order['status'];
    const finalStatus = statusOverrides[orderId] || dbStatus;
    const totalAmount = row.total_pkr ?? row.subtotal_pkr ?? row.total ?? 0;

    return {
      id: orderId,
      dbId: row.id ? Number(row.id) : undefined,
      items: Array.isArray(row.items) ? row.items : [],
      total: Number(totalAmount),
      status: finalStatus,
      customer: {
        name: row.customer_name || 'Anonymous',
        email: '',
        phone: row.customer_phone || '',
        address: row.customer_address || '',
        city: row.customer_city || ''
      },
      date: row.created_at || row.date || new Date().toISOString()
    };
  };

  const orders = useMemo(() => {
    return rawOrders.map(normalizeOrder).filter((o): o is Order => o !== null);
  }, [rawOrders, statusOverrides]);

  const addRealtimeOrder = useCallback((newOrder: any) => {
    const id = newOrder.order_id || String(newOrder.id);
    if (processedRef.current.has(id)) return;
    processedRef.current.add(id);
    setRawOrders(prev => [newOrder, ...prev]);
    setTotalDbCount(prev => prev + 1); // Increment accurate total
    triggerInstantAlert(newOrder);
  }, [triggerInstantAlert]);

  const setupMasterSync = useCallback(() => {
    if (user?.role !== UserRole.ADMIN) return;

    if (masterChannelRef.current) {
      supabase.removeChannel(masterChannelRef.current);
    }

    const channel = supabase.channel('itx_master_link')
      .on('broadcast', { event: 'new_order_pulse' }, (payload) => {
        addRealtimeOrder(payload.payload);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
        addRealtimeOrder(payload.new);
      })
      .subscribe((status) => {
        setIsLive(status === 'SUBSCRIBED');
      });

    masterChannelRef.current = channel;
  }, [user, addRealtimeOrder]);

  useEffect(() => {
    setupMasterSync();
    
    const handleFocus = () => {
      if (document.visibilityState === 'visible') {
        setupMasterSync();
        initAudio(); // Re-wake audio on focus
      }
    };
    
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
      if (masterChannelRef.current) supabase.removeChannel(masterChannelRef.current);
    };
  }, [setupMasterSync, initAudio]);

  const fetchOrders = useCallback(async () => {
    try {
      // FIX: By default Supabase caps at 100. We use count: exact and a larger limit.
      const { data, error, count } = await supabase.from('orders')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .limit(1000); // Fetch more than the 100 limit

      if (!error && data) {
        setRawOrders(data);
        setTotalDbCount(count || data.length);
        data.forEach(o => processedRef.current.add(o.order_id || String(o.id)));
      }
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      await fetchOrders();
      if (mounted) setLoading(false);
    };
    init();
    return () => { mounted = false; };
  }, [fetchOrders]);

  const updateStatusOverride = async (orderId: string, status: Order['status']) => {
    setStatusOverrides(prev => ({ ...prev, [orderId]: status }));
    try {
      const { error } = await supabase.from('orders')
        .update({ status: status.toLowerCase() })
        .eq('order_id', orderId);
      if (error) throw error;
    } catch (e) { 
      setStatusOverrides(prev => {
        const next = { ...prev };
        delete next[orderId];
        return next;
      });
    }
  };

  if (loading && rawOrders.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center animate-pulse">
          <div className="w-12 h-12 border-2 border-white/10 border-t-white rounded-full animate-spin mb-4 mx-auto"></div>
          <p className="text-[10px] font-black uppercase text-white tracking-widest">Waking Master Terminal...</p>
        </div>
      </div>
    );
  }

  return (
    <HashRouter>
      <Routes>
        <Route path="/*" element={
          <AdminDashboard 
            products={products} 
            orders={orders} 
            totalDbCount={totalDbCount}
            user={user} 
            isLive={isLive}
            login={(role: UserRole) => { 
              const u = { id: '1', name: 'Master', email: 'itx@me.pk', role }; 
              setUser(u); 
              localStorage.setItem('itx_user_session', JSON.stringify(u)); 
              initAudio(); // Initialize audio on login interaction
            }}
            initAudio={initAudio}
            testAlert={() => triggerInstantAlert({total: 0, customer_name: 'TEST ALERT', customer_city: 'SYSTEM'})}
            systemPassword={systemPassword} 
            setSystemPassword={setSystemPassword}
            refreshData={fetchOrders}
            addRealtimeOrder={addRealtimeOrder}
            updateStatusOverride={updateStatusOverride}
          />
        } />
      </Routes>
    </HashRouter>
  );
};

export default AdminApp;
