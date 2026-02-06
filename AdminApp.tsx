
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
  const videoPersistenceRef = useRef<HTMLVideoElement | null>(null);

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

  // iOS BACKGROUND HACK: Silent Video Loop
  // This keeps the JavaScript thread active even when the PWA is minimized
  const startPersistence = useCallback(() => {
    if (!videoPersistenceRef.current) {
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.loop = true;
      video.style.position = 'fixed';
      video.style.top = '-100px';
      video.style.width = '1px';
      video.style.height = '1px';
      video.style.opacity = '0';
      // Tiny silent mp4 blob
      video.src = 'data:video/mp4;base64,AAAAHGZ0eXBpc29tAAAAAGlzb21tcDQyAAAACHV1aWRreG1sAAAAAGFiaWxpdHkgeG1sbnM9Imh0dHA6Ly9ucy5hZG9iZS5jb20vYWJpbGl0eS8iPjxhYmlsaXR5OnN5c3RlbT48YWJpbGl0eTpkZXZpY2U+PG9zPnVuaXg8L29zPjwvYWJpbGl0eTpkZXZpY2U+PC9hYmlsaXR5OnN5c3RlbT48L2FiaWxpdHk+AAAAbG1vb3YAAABsbXZoZAAAAAAAAAAAAAAAAAAAA+gAAAPoAAEAAAEAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAABidHJhazAAAAHkdGtoZAAAAAMAAAAAAAAAAAAAA+gAAAPoAAAAAAABAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAABkbWRpYQAALW1kaGQAAAAAAAAAAAAAAAAAAD6AAAA+gAFVx9v/AAAAAAAALWhkbHIAAAAAAAAAAHZpZGVvAAAAAAAAAAAAAAAAVmlkZW9IYW5kbGVyAAAAAVxtZGlhAAAALW1pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAAU9zdGJsAAAAp3N0c2QAAAAAAAAAAQAAAJZhdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAHgAeABIAAAASAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGP//AAAALWF2Y0MBQsAM/+EAFWdCwAwU9mAsX+AAB9AAAfQAAAgAAAH0AAAgAAYhB9mP4wAAABhzdHRzAAAAAAAAAAEAAAABAAAD6AAAAFpzdHNjAAAAAAAAAAEAAAABAAAAAQAAAAEAAAAUc3RzegAAAAAAAAAAAAAAAgAAABRzdGNvAAAAAAAAAAEAAAAwAAAAYXVkcmEAAABhdWRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAAD9zZ3BkAAAAAAAAAHRyb2wAAAABAAAALXRyb2wAAAAAAAEAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAYW1lZXRyYWsAAA==';
      document.body.appendChild(video);
      videoPersistenceRef.current = video;
    }
    
    videoPersistenceRef.current.play().catch(e => {
      console.log("Persistence pending user gesture...");
    });
  }, []);

  const initAudio = useCallback(async () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      
      startPersistence();
      
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
  }, [startPersistence]);

  const triggerAlert = useCallback(async (order?: any) => {
    try {
      const ctx = audioContextRef.current || new (window.AudioContext || (window as any).webkitAudioContext)();
      if (!audioContextRef.current) audioContextRef.current = ctx;
      if (ctx.state === 'suspended') await ctx.resume();

      const now = ctx.currentTime;
      [880, 1108, 1318, 1760].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, now + (i * 0.1));
        g.gain.setValueAtTime(0, now + (i * 0.1));
        g.gain.linearRampToValueAtTime(0.5, now + (i * 0.1) + 0.05);
        g.gain.exponentialRampToValueAtTime(0.001, now + (i * 0.1) + 1.5);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(now + (i * 0.1));
        osc.stop(now + (i * 0.1) + 1.5);
      });

      if (order && Notification.permission === "granted") {
        const notif = new Notification('🚨 ITX ORDER!', {
          body: `Rs. ${order.total_pkr || order.total} — ${order.customer_name}`,
          icon: 'https://images.unsplash.com/photo-1614164185128-e4ec99c436d7?q=80&w=192&h=192&auto=format&fit=crop',
          tag: 'itx-alert',
          requireInteraction: true
        });
        notif.onclick = () => { window.focus(); notif.close(); };
      }
    } catch (e) {
      console.warn("Alert failed", e);
    }
  }, []);

  const addRealtimeOrder = useCallback((newOrder: any) => {
    const id = String(newOrder.order_id || newOrder.id);
    if (processedRef.current.has(id)) return;
    processedRef.current.add(id);
    
    setRawOrders(prev => {
      const exists = prev.some(o => String(o.order_id || o.id) === id);
      if (exists) return prev;
      return [newOrder, ...prev];
    });
    
    setTotalDbCount(prev => prev + 1);
    setLastSyncTime(new Date());
    triggerAlert(newOrder);
  }, [triggerAlert]);

  const fetchOrders = useCallback(async () => {
    try {
      // 1. DIRECT COUNT FETCH: Fix the '98' issue by getting absolute count from DB
      const { count: dbCount, error: countErr } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true });
      
      if (!countErr && dbCount !== null) {
        setTotalDbCount(dbCount);
      }

      // 2. DATA LIST FETCH
      const { data, error: dataErr } = await supabase.from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (!dataErr && data) {
        setRawOrders(data);
        data.forEach(o => processedRef.current.add(String(o.order_id || o.id)));
        setLastSyncTime(new Date());
      }
    } catch (e) { console.error("Fetch Error:", e); }
  }, []);

  const setupMasterSync = useCallback(() => {
    if (user?.role !== UserRole.ADMIN) return;
    if (masterChannelRef.current) {
      supabase.removeChannel(masterChannelRef.current);
    }

    // High priority socket channel
    const channel = supabase.channel('itx_immortal_v30')
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
    if (!window.confirm("⚠️ WIPE ENTIRE DATABASE?")) return;
    try {
      const { error } = await supabase.from('orders').delete().neq('customer_name', 'RESERVED_KEY_X_999');
      if (!error) {
        setRawOrders([]);
        setTotalDbCount(0);
        processedRef.current.clear();
        setLastSyncTime(new Date());
        window.alert("Cleared.");
      }
    } catch (e) { window.alert("Failed."); }
  };

  useEffect(() => {
    const handleWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === 'NEW_ORDER_DETECTED') {
        addRealtimeOrder(event.data.order);
      }
    };
    navigator.serviceWorker?.addEventListener('message', handleWorkerMessage);
    return () => navigator.serviceWorker?.removeEventListener('message', handleWorkerMessage);
  }, [addRealtimeOrder]);

  // SELF-HEALING: Every 45 seconds, check if socket is dead. If so, poll.
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isLive || document.visibilityState === 'hidden') {
        fetchOrders();
      }
    }, 45000);
    return () => clearInterval(interval);
  }, [isLive, fetchOrders]);

  useEffect(() => {
    setupMasterSync();
    const handleReactivation = () => {
      if (document.visibilityState === 'visible') {
        initAudio();
        setupMasterSync();
        fetchOrders();
      }
    };
    window.addEventListener('focus', handleReactivation);
    document.addEventListener('visibilitychange', handleReactivation);
    return () => {
      window.removeEventListener('focus', handleReactivation);
      document.removeEventListener('visibilitychange', handleReactivation);
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
      <div className="w-10 h-10 border-2 border-white/10 border-t-white rounded-full animate-spin mb-4"></div>
      <p className="text-[10px] font-black text-white/40 uppercase tracking-widest italic">Signal Search...</p>
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
            testAlert={() => triggerAlert({ total: 999, customer_name: 'TERMINAL TEST' })}
          />
        } />
      </Routes>
    </HashRouter>
  );
};

export default AdminApp;
