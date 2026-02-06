
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { Product, Order, User, UserRole } from './types';
import { MOCK_PRODUCTS } from './constants';
import { supabase } from './lib/supabase';
import AdminDashboard from './views/AdminDashboard';

const AdminApp: React.FC = () => {
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
  const heartbeatTimerRef = useRef<any>(null);

  const [statusOverrides, setStatusOverrides] = useState<Record<string, Order['status']>>(() => {
    const saved = localStorage.getItem('itx_status_overrides');
    return saved ? JSON.parse(saved) : {};
  });

  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('itx_user_session');
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    localStorage.setItem('itx_cached_orders', JSON.stringify(rawOrders));
    localStorage.setItem('itx_status_overrides', JSON.stringify(statusOverrides));
    localStorage.setItem('itx_total_count', totalDbCount.toString());
  }, [rawOrders, totalDbCount, statusOverrides]);

  // HEARTBEAT PROTOCOL: Play a 0.01s beep at ultra-low volume every 20s
  // This is the "Nuclear Option" for iOS background persistence.
  const playHeartbeat = useCallback(() => {
    try {
      const ctx = audioContextRef.current;
      if (!ctx || ctx.state === 'suspended') return;
      
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1, now); // Inaudible frequency
      g.gain.setValueAtTime(0.001, now); // Almost zero volume
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
      
      osc.connect(g);
      g.connect(ctx.destination);
      
      osc.start(now);
      osc.stop(now + 0.1);
    } catch (e) {}
  }, []);

  const initAudio = useCallback(async () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 44100 });
      }
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      
      // Start Heartbeat Timer
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = setInterval(playHeartbeat, 20000);
      
      if ("Notification" in window && Notification.permission !== "granted") {
        await Notification.requestPermission();
      }
      
      if (navigator.serviceWorker?.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'START_BACKGROUND_SYNC' });
      }
      setAudioReady(true);
    } catch (e) {
      setAudioReady(false);
    }
  }, [playHeartbeat]);

  const triggerAlert = useCallback(async (order?: any) => {
    try {
      const ctx = audioContextRef.current || new (window.AudioContext || (window as any).webkitAudioContext)();
      if (!audioContextRef.current) audioContextRef.current = ctx;
      if (ctx.state === 'suspended') await ctx.resume();

      const now = ctx.currentTime;
      // Multi-tone chime for maximum wake potential
      [440, 554.37, 659.25, 880].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + (i * 0.15));
        g.gain.setValueAtTime(0, now + (i * 0.15));
        g.gain.linearRampToValueAtTime(0.5, now + (i * 0.15) + 0.05);
        g.gain.exponentialRampToValueAtTime(0.001, now + (i * 0.15) + 2.0);
        osc.connect(g); g.connect(ctx.destination);
        osc.start(now + (i * 0.15)); osc.stop(now + (i * 0.15) + 2.0);
      });

      if (order && Notification.permission === "granted") {
        new Notification('🚨 ORDER RECEIVED', {
          body: `Rs. ${order.total_pkr || order.total} — ${order.customer_name}`,
          icon: 'https://images.unsplash.com/photo-1614164185128-e4ec99c436d7?q=80&w=192&h=192&auto=format&fit=crop',
          requireInteraction: true,
          tag: 'itx-alert-' + (order.id || Date.now())
        });
      }
    } catch (e) {}
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      // HARD FIX FOR '98': Direct fetch of all IDs to bypass header count limits
      const { data: allIds, error: countErr } = await supabase
        .from('orders')
        .select('id');
      
      if (!countErr && allIds) {
        setTotalDbCount(allIds.length);
      }

      // FETCH VIEWABLE LIST
      const { data, error: dataErr } = await supabase.from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (!dataErr && data) {
        setRawOrders(data);
        data.forEach(o => processedRef.current.add(String(o.order_id || o.id)));
        setLastSyncTime(new Date());
      }
    } catch (e) {}
  }, []);

  const addRealtimeOrder = useCallback((newOrder: any) => {
    const id = String(newOrder.order_id || newOrder.id);
    if (processedRef.current.has(id)) return;
    processedRef.current.add(id);
    
    setRawOrders(prev => [newOrder, ...prev].slice(0, 100));
    setTotalDbCount(prev => prev + 1);
    setLastSyncTime(new Date());
    triggerAlert(newOrder);
  }, [triggerAlert]);

  const setupMasterSync = useCallback(() => {
    if (user?.role !== UserRole.ADMIN) return;
    if (masterChannelRef.current) supabase.removeChannel(masterChannelRef.current);

    const channel = supabase.channel('itx_immortal_v50')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, payload => {
        addRealtimeOrder(payload.new);
      })
      .subscribe(status => {
        setIsLive(status === 'SUBSCRIBED');
        if (status === 'SUBSCRIBED') setLastSyncTime(new Date());
      });

    masterChannelRef.current = channel;
  }, [user, addRealtimeOrder]);

  const purgeDatabase = async () => {
    if (!window.confirm("Delete ALL order records?")) return;
    try {
      await supabase.from('orders').delete().neq('customer_name', 'RESERVED_KEY_X_999');
      setRawOrders([]);
      setTotalDbCount(0);
      processedRef.current.clear();
      setLastSyncTime(new Date());
    } catch (e) {}
  };

  useEffect(() => {
    const handleWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === 'NEW_ORDER_DETECTED') addRealtimeOrder(event.data.order);
    };
    navigator.serviceWorker?.addEventListener('message', handleWorkerMessage);
    return () => navigator.serviceWorker?.removeEventListener('message', handleWorkerMessage);
  }, [addRealtimeOrder]);

  useEffect(() => {
    setupMasterSync();
    const handleGlobalFocus = () => {
      if (document.visibilityState === 'visible') {
        initAudio(); // Resume heartbeat
        setupMasterSync(); // Reconnect socket
        fetchOrders(); // Sync data
      }
    };
    window.addEventListener('focus', handleGlobalFocus);
    document.addEventListener('visibilitychange', handleGlobalFocus);
    return () => {
      window.removeEventListener('focus', handleGlobalFocus);
      document.removeEventListener('visibilitychange', handleGlobalFocus);
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
    };
  }, [setupMasterSync, fetchOrders, initAudio]);

  useEffect(() => {
    fetchOrders().finally(() => setLoading(false));
  }, [fetchOrders]);

  const formattedOrders = useMemo((): Order[] => {
    return rawOrders.map(o => ({
      id: o.order_id || String(o.id),
      items: Array.isArray(o.items) ? o.items : [],
      total: Number(o.total_pkr || o.total || 0),
      status: (statusOverrides[o.order_id || String(o.id)] || (o.status ? o.status.charAt(0).toUpperCase() + o.status.slice(1) : 'Pending')) as Order['status'],
      customer: { name: o.customer_name || 'Anonymous', email: '', phone: o.customer_phone || '', address: o.customer_address || '', city: o.customer_city || '' },
      date: o.created_at || new Date().toISOString()
    }));
  }, [rawOrders, statusOverrides]);

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a0a]">
      <div className="w-8 h-8 border border-white/10 border-t-white rounded-full animate-spin mb-4"></div>
      <p className="text-[10px] font-black text-white/40 uppercase tracking-widest italic">Terminal Active...</p>
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
            systemPassword={localStorage.getItem('systemPassword') || 'admin123'}
            initAudio={initAudio}
            refreshData={fetchOrders}
            purgeDatabase={purgeDatabase}
            updateStatusOverride={async (id: string, status: Order['status']) => {
              await supabase.from('orders').update({ status: status.toLowerCase() }).match({ order_id: id });
              setStatusOverrides(prev => ({ ...prev, [id]: status }));
            }}
            testAlert={() => triggerAlert({ total: 0, customer_name: 'AUDIO_LINK_TEST' })}
          />
        } />
      </Routes>
    </HashRouter>
  );
};

export default AdminApp;
