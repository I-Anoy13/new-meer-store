
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { Product, Order, User, UserRole } from './types';
import { MOCK_PRODUCTS } from './constants';
import { supabase } from './lib/supabase';
import AdminDashboard from './views/AdminDashboard';

const AdminApp: React.FC = () => {
  const [products] = useState<Product[]>(() => {
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
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());
  
  const processedRef = useRef<Set<string>>(new Set());
  const masterChannelRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const heartbeatRef = useRef<number | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

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

  // Sync state to storage
  useEffect(() => {
    localStorage.setItem('itx_cached_orders', JSON.stringify(rawOrders));
    localStorage.setItem('itx_status_overrides', JSON.stringify(statusOverrides));
    localStorage.setItem('itx_total_count', totalDbCount.toString());
  }, [rawOrders, statusOverrides, totalDbCount]);

  const initAudio = useCallback(async () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 44100 });
      }
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      // Silent heartbeat: keeps the browser from sleeping the JS thread entirely
      if (!heartbeatRef.current) {
        heartbeatRef.current = window.setInterval(() => {
          if (audioContextRef.current?.state === 'running') {
            const osc = audioContextRef.current.createOscillator();
            const g = audioContextRef.current.createGain();
            g.gain.value = 0.0000001; 
            osc.connect(g);
            g.connect(audioContextRef.current.destination);
            osc.start();
            osc.stop(audioContextRef.current.currentTime + 0.05);
          }
        }, 15000); 
      }
      setAudioReady(audioContextRef.current.state === 'running');
    } catch (e) {
      console.warn("Audio Context init failed:", e);
      setAudioReady(false);
    }
  }, []);

  const triggerInstantAlert = useCallback(async (order: any) => {
    if (user?.role !== UserRole.ADMIN) return;
    
    try {
      const ctx = audioContextRef.current || new (window.AudioContext || (window as any).webkitAudioContext)();
      if (!audioContextRef.current) audioContextRef.current = ctx;
      if (ctx.state === 'suspended') await ctx.resume();

      const now = ctx.currentTime;
      [1046, 1318].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = idx === 0 ? 'sine' : 'square';
        osc.frequency.setValueAtTime(freq, now);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.8, now + 0.1);
        osc.frequency.exponentialRampToValueAtTime(freq, now + 0.2);
        
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(0.8, now + 0.05);
        g.gain.exponentialRampToValueAtTime(0.001, now + 3.0);
        
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 3.0);
      });
      setAudioReady(true);
    } catch (e) {
      setAudioReady(false);
    }

    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'TRIGGER_NOTIFICATION',
        title: '🚨 NEW ORDER!',
        body: `Rs. ${order.total_pkr || order.total} — ${order.customer_name}`,
        orderId: order.order_id || order.id
      });
    }
    if (navigator.vibrate) navigator.vibrate([1000, 200, 1000]);
  }, [user]);

  const addRealtimeOrder = useCallback((newOrder: any) => {
    const id = newOrder.order_id || String(newOrder.id);
    if (processedRef.current.has(id)) return;
    processedRef.current.add(id);
    
    setRawOrders(prev => {
      if (prev.some(o => (o.order_id || String(o.id)) === id)) return prev;
      return [newOrder, ...prev];
    });
    setTotalDbCount(prev => prev + 1);
    setLastSyncTime(new Date());
    triggerInstantAlert(newOrder);
  }, [triggerInstantAlert]);

  const fetchOrders = useCallback(async () => {
    try {
      const { data, error, count } = await supabase.from('orders')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .limit(5000);

      if (!error && data) {
        setRawOrders(data);
        setTotalDbCount(count || data.length);
        data.forEach(o => processedRef.current.add(o.order_id || String(o.id)));
        setLastSyncTime(new Date());
      }
    } catch (e) { console.error("Admin fetch error:", e); }
  }, []);

  const setupMasterSync = useCallback(() => {
    if (user?.role !== UserRole.ADMIN) return;

    if (masterChannelRef.current) {
      supabase.removeChannel(masterChannelRef.current);
    }

    // Use presence to keep connection alive
    const channel = supabase.channel('itx_master_v2', {
      config: { broadcast: { self: true, ack: true }, presence: { key: 'master_admin' } }
    })
    .on('broadcast', { event: 'new_order_pulse' }, (payload) => {
      addRealtimeOrder(payload.payload);
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
      addRealtimeOrder(payload.new);
    })
    .subscribe((status) => {
      setIsLive(status === 'SUBSCRIBED');
      if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = window.setTimeout(setupMasterSync, 5000);
      }
    });

    masterChannelRef.current = channel;
  }, [user, addRealtimeOrder]);

  const purgeDatabase = async () => {
    if (!window.confirm("ARE YOU SURE? This wipes ALL test data forever.")) return;
    try {
      const { error } = await supabase.from('orders').delete().neq('id', 0);
      if (error) throw error;
      setRawOrders([]);
      setTotalDbCount(0);
      processedRef.current.clear();
      localStorage.removeItem('itx_cached_orders');
      localStorage.removeItem('itx_total_count');
      setLastSyncTime(new Date());
      window.alert("History Wiped.");
    } catch (e) {
      window.alert("Purge failed.");
    }
  };

  useEffect(() => {
    setupMasterSync();
    
    // Recovery fetch when app becomes visible (Delta Sync)
    const handleReactivation = () => {
      if (document.visibilityState === 'visible') {
        setupMasterSync();
        fetchOrders();
        initAudio();
      }
    };

    window.addEventListener('focus', handleReactivation);
    document.addEventListener('visibilitychange', handleReactivation);
    
    return () => {
      window.removeEventListener('focus', handleReactivation);
      document.removeEventListener('visibilitychange', handleReactivation);
      if (masterChannelRef.current) supabase.removeChannel(masterChannelRef.current);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
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

  const updateStatusOverride = async (id: string, status: Order['status']) => {
    try {
      const { error } = await supabase.from('orders').update({ status: status.toLowerCase() }).eq('order_id', id);
      if (error) await supabase.from('orders').update({ status: status.toLowerCase() }).eq('id', id);
      
      setStatusOverrides(prev => ({ ...prev, [id]: status }));
      setRawOrders(prev => prev.map(o => (o.order_id || String(o.id)) === id ? { ...o, status } : o));
    } catch (e) { console.error(e); }
  };

  const formattedOrders = useMemo((): Order[] => {
    return rawOrders.map(o => ({
      id: o.order_id || String(o.id),
      items: Array.isArray(o.items) ? o.items : [],
      total: Number(o.total_pkr || o.total || 0),
      status: (statusOverrides[o.order_id || String(o.id)] || (o.status ? o.status.charAt(0).toUpperCase() + o.status.slice(1) : 'Pending')) as Order['status'],
      customer: {
        name: o.customer_name || 'Anonymous',
        email: '',
        phone: o.customer_phone || '',
        address: o.customer_address || '',
        city: o.customer_city || ''
      },
      date: o.created_at || new Date().toISOString()
    }));
  }, [rawOrders, statusOverrides]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
      <div className="w-8 h-8 border-2 border-white/10 border-t-white rounded-full animate-spin"></div>
    </div>
  );

  return (
    <HashRouter>
      <Routes>
        <Route path="*" element={
          <AdminDashboard 
            orders={formattedOrders}
            totalDbCount={totalDbCount}
            user={user}
            isLive={isLive}
            audioReady={audioReady}
            lastSyncTime={lastSyncTime}
            login={(role: UserRole) => {
              const u: User = { id: 'master', email: 'admin@itx.com', role, name: 'Master' };
              setUser(u);
              localStorage.setItem('itx_user_session', JSON.stringify(u));
              initAudio();
            }}
            logout={() => { setUser(null); localStorage.removeItem('itx_user_session'); }}
            systemPassword={systemPassword}
            initAudio={initAudio}
            refreshData={fetchOrders}
            purgeDatabase={purgeDatabase}
            updateStatusOverride={updateStatusOverride}
            testAlert={() => triggerInstantAlert({ total: 5000, customer_name: 'TEST USER' })}
          />
        } />
      </Routes>
    </HashRouter>
  );
};

export default AdminApp;
