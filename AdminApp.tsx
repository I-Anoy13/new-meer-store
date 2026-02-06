
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
  
  const [totalDbCount, setTotalDbCount] = useState<number>(() => {
    return Number(localStorage.getItem('itx_total_count')) || 0;
  });
  
  const [loading, setLoading] = useState(rawOrders.length === 0);
  const [isLive, setIsLive] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  
  const processedRef = useRef<Set<string>>(new Set());
  const masterChannelRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const heartbeatIntervalRef = useRef<number | null>(null);

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
    localStorage.setItem('itx_total_count', totalDbCount.toString());
  }, [products, rawOrders, statusOverrides, totalDbCount]);

  // Audio Engine with Persistence Heartbeat
  const initAudio = useCallback(async () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      // Start a silent heartbeat to keep the engine from sleeping
      if (!heartbeatIntervalRef.current) {
        heartbeatIntervalRef.current = window.setInterval(() => {
          if (audioContextRef.current?.state === 'running') {
            const osc = audioContextRef.current.createOscillator();
            const g = audioContextRef.current.createGain();
            g.gain.value = 0.000001; // Silent but registered
            osc.connect(g);
            g.connect(audioContextRef.current.destination);
            osc.start();
            osc.stop(audioContextRef.current.currentTime + 0.1);
          }
        }, 25000);
      }

      setAudioReady(audioContextRef.current.state === 'running');
    } catch (e) {
      console.warn("Audio Context setup failed:", e);
      setAudioReady(false);
    }
  }, []);

  const triggerInstantAlert = useCallback(async (order: any) => {
    if (user?.role !== UserRole.ADMIN) return;

    try {
      const ctx = audioContextRef.current || new (window.AudioContext || (window as any).webkitAudioContext)();
      if (!audioContextRef.current) audioContextRef.current = ctx;
      
      if (ctx.state === 'suspended') await ctx.resume();

      const playLoudAlert = () => {
        const now = ctx.currentTime;
        // Two oscillators for a richer, more piercing sound
        [880, 1100].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = idx === 0 ? 'square' : 'sawtooth';
          osc.frequency.setValueAtTime(freq, now);
          osc.frequency.exponentialRampToValueAtTime(freq * 1.5, now + 0.2);
          osc.frequency.exponentialRampToValueAtTime(freq, now + 0.4);
          osc.frequency.exponentialRampToValueAtTime(freq * 1.5, now + 0.6);
          
          g.gain.setValueAtTime(0, now);
          g.gain.linearRampToValueAtTime(0.6, now + 0.05);
          g.gain.exponentialRampToValueAtTime(0.001, now + 2.0);
          
          osc.connect(g);
          g.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 2.0);
        });
      };

      playLoudAlert();
      setAudioReady(true);
    } catch (e) {
      setAudioReady(false);
      console.error("Alert failed:", e);
    }

    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'TRIGGER_NOTIFICATION',
        title: '🔥 NEW ORDER RECEIVED!',
        body: `Rs. ${order.total_pkr || order.total} — ${order.customer_name} from ${order.customer_city || 'City'}`,
        orderId: order.order_id || order.id
      });
    }
    if (navigator.vibrate) navigator.vibrate([1000, 500, 1000]);
  }, [user]);

  const addRealtimeOrder = useCallback((newOrder: any) => {
    const id = newOrder.order_id || String(newOrder.id);
    if (processedRef.current.has(id)) return;
    processedRef.current.add(id);
    setRawOrders(prev => [newOrder, ...prev]);
    setTotalDbCount(prev => prev + 1);
    triggerInstantAlert(newOrder);
  }, [triggerInstantAlert]);

  const setupMasterSync = useCallback(() => {
    if (user?.role !== UserRole.ADMIN) return;

    if (masterChannelRef.current) {
      supabase.removeChannel(masterChannelRef.current);
    }

    // High priority broadcast channel
    const channel = supabase.channel('itx_master_link', {
      config: { broadcast: { self: true, ack: true } }
    })
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

  const fetchOrders = useCallback(async () => {
    try {
      const { data, error, count } = await supabase.from('orders')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .limit(5000);

      if (!error && data) {
        setRawOrders(data);
        setTotalDbCount(count || data.length);
        processedRef.current.clear();
        data.forEach(o => processedRef.current.add(o.order_id || String(o.id)));
      }
    } catch (e) { console.error(e); }
  }, []);

  const purgeDatabase = async () => {
    if (!window.confirm("CRITICAL: This will wipe ALL order history from the database. Proceed?")) return;
    try {
      const { error } = await supabase.from('orders').delete().neq('id', 0);
      if (error) throw error;
      setRawOrders([]);
      setTotalDbCount(0);
      processedRef.current.clear();
      localStorage.removeItem('itx_cached_orders');
      localStorage.removeItem('itx_total_count');
      window.alert("Database Purged Successfully.");
    } catch (e) {
      window.alert("Purge Failed: " + (e as Error).message);
    }
  };

  useEffect(() => {
    setupMasterSync();
    const handleReSync = () => {
      if (document.visibilityState === 'visible') {
        setupMasterSync();
        fetchOrders(); // Refresh data on return
        initAudio();   // Re-prime audio engine
      }
    };
    window.addEventListener('focus', handleReSync);
    window.addEventListener('online', handleReSync);
    document.addEventListener('visibilitychange', handleReSync);
    
    return () => {
      window.removeEventListener('focus', handleReSync);
      window.removeEventListener('online', handleReSync);
      document.removeEventListener('visibilitychange', handleReSync);
      if (masterChannelRef.current) supabase.removeChannel(masterChannelRef.current);
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
    };
  }, [setupMasterSync, fetchOrders, initAudio]);

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
            orders={rawOrders.map(o => ({
              id: o.order_id || `ORD-${o.id}`,
              items: Array.isArray(o.items) ? o.items : [],
              total: Number(o.total_pkr || o.total || 0),
              status: statusOverrides[o.order_id || `ORD-${o.id}`] || (o.status?.charAt(0).toUpperCase() + o.status?.slice(1)) || 'Pending',
              customer: { name: o.customer_name, phone: o.customer_phone, city: o.customer_city, address: o.customer_address },
              date: o.created_at
            }))} 
            totalDbCount={totalDbCount}
            user={user} 
            isLive={isLive}
            audioReady={audioReady}
            login={(role: UserRole) => { 
              const u = { id: '1', name: 'Master', email: 'itx@me.pk', role }; 
              setUser(u); 
              localStorage.setItem('itx_user_session', JSON.stringify(u)); 
              initAudio();
            }}
            initAudio={initAudio}
            testAlert={() => triggerInstantAlert({total: 0, customer_name: 'TEST', customer_city: 'SYSTEM'})}
            purgeDatabase={purgeDatabase}
            systemPassword={systemPassword} 
            setSystemPassword={setSystemPassword}
            refreshData={fetchOrders}
            updateStatusOverride={updateStatusOverride}
          />
        } />
      </Routes>
    </HashRouter>
  );
};

export default AdminApp;
