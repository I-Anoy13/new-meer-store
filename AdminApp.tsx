
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
  const videoRef = useRef<HTMLVideoElement | null>(null);

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
  }, [rawOrders, statusOverrides, totalDbCount]);

  // Request Notification Permissions explicitly
  const requestNotifications = useCallback(async () => {
    if (!("Notification" in window)) return false;
    if (Notification.permission === "granted") return true;
    const permission = await Notification.requestPermission();
    return permission === "granted";
  }, []);

  // Use a silent video loop to keep the browser process alive when minimized
  const setupPersistence = useCallback(() => {
    if (videoRef.current) return;
    
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.loop = true;
    video.style.position = 'fixed';
    video.style.opacity = '0';
    video.style.pointerEvents = 'none';
    video.style.width = '1px';
    video.style.height = '1px';
    
    // Tiny silent video (1 frame) to trick browser into keeping tab active
    video.src = 'data:video/mp4;base64,AAAAHGZ0eXBpc29tAAAAAGlzb21tcDQyAAAACHV1aWRreG1sAAAAAGFiaWxpdHkgeG1sbm...'; // This is a placeholder, any small valid video file works
    
    // Better approach: use a small video blob or just play the audio context
    document.body.appendChild(video);
    videoRef.current = video;
    
    video.play().catch(e => console.log("Persistence video needs interaction"));
  }, []);

  const initAudio = useCallback(async () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      setupPersistence();
      await requestNotifications();
      
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'START_BACKGROUND_SYNC' });
      }
      setAudioReady(true);
    } catch (e) {
      setAudioReady(false);
    }
  }, [setupPersistence, requestNotifications]);

  const triggerAlert = useCallback(async (order?: any) => {
    try {
      const ctx = audioContextRef.current || new (window.AudioContext || (window as any).webkitAudioContext)();
      if (!audioContextRef.current) audioContextRef.current = ctx;
      if (ctx.state === 'suspended') await ctx.resume();

      const now = ctx.currentTime;
      [523, 659, 783, 1046].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, now + (i * 0.1));
        g.gain.setValueAtTime(0, now + (i * 0.1));
        g.gain.linearRampToValueAtTime(0.5, now + (i * 0.1) + 0.05);
        g.gain.exponentialRampToValueAtTime(0.001, now + (i * 0.1) + 2.0);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(now + (i * 0.1));
        osc.stop(now + (i * 0.1) + 2.0);
      });

      if (order && Notification.permission === "granted") {
        new Notification('🔥 NEW ORDER!', {
          body: `Rs. ${order.total_pkr || order.total} — ${order.customer_name}`,
          icon: 'https://images.unsplash.com/photo-1614164185128-e4ec99c436d7?q=80&w=192&h=192&auto=format&fit=crop'
        });
      }
    } catch (e) {
      console.warn("Alert failed", e);
    }
  }, []);

  const addRealtimeOrder = useCallback((newOrder: any) => {
    const id = String(newOrder.order_id || newOrder.id);
    if (processedRef.current.has(id)) return;
    processedRef.current.add(id);
    
    setRawOrders(prev => [newOrder, ...prev]);
    setTotalDbCount(prev => prev + 1);
    setLastSyncTime(new Date());
    triggerAlert(newOrder);
  }, [triggerAlert]);

  const fetchOrders = useCallback(async () => {
    try {
      const { data, count, error } = await supabase.from('orders')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (!error && data) {
        setRawOrders(data);
        setTotalDbCount(count || data.length);
        data.forEach(o => processedRef.current.add(String(o.order_id || o.id)));
        setLastSyncTime(new Date());
      }
    } catch (e) {}
  }, []);

  const setupMasterSync = useCallback(() => {
    if (user?.role !== UserRole.ADMIN) return;
    if (masterChannelRef.current) supabase.removeChannel(masterChannelRef.current);

    const channel = supabase.channel('itx_master_v5')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, payload => {
        addRealtimeOrder(payload.new);
      })
      .subscribe(status => setIsLive(status === 'SUBSCRIBED'));

    masterChannelRef.current = channel;
  }, [user, addRealtimeOrder]);

  const purgeDatabase = async () => {
    if (!window.confirm("CRITICAL: Wipe ALL database records forever?")) return;
    try {
      // Deleting with a filter that matches all items reliably (created_at exists for all)
      const { error } = await supabase.from('orders').delete().neq('customer_name', 'RESERVED_SYSTEM_KEY_NONE');
      if (error) throw error;
      
      setRawOrders([]);
      setTotalDbCount(0);
      processedRef.current.clear();
      localStorage.removeItem('itx_cached_orders');
      localStorage.removeItem('itx_total_count');
      setLastSyncTime(new Date());
      window.alert("Success: Database Wiped.");
    } catch (e) {
      console.error(e);
      window.alert("Error: Database wipe failed. Check connection.");
    }
  };

  useEffect(() => {
    const handleWorkerMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'NEW_ORDER_DETECTED') {
        addRealtimeOrder(event.data.order);
      }
    };
    navigator.serviceWorker?.addEventListener('message', handleWorkerMessage);
    return () => navigator.serviceWorker?.removeEventListener('message', handleWorkerMessage);
  }, [addRealtimeOrder]);

  useEffect(() => {
    setupMasterSync();
    const recover = () => {
      if (document.visibilityState === 'visible') {
        initAudio();
        setupMasterSync();
        fetchOrders();
      }
    };
    window.addEventListener('focus', recover);
    document.addEventListener('visibilitychange', recover);
    return () => {
      window.removeEventListener('focus', recover);
      document.removeEventListener('visibilitychange', recover);
    };
  }, [setupMasterSync, fetchOrders, initAudio]);

  useEffect(() => { fetchOrders().finally(() => setLoading(false)); }, [fetchOrders]);

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

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-black"><div className="w-8 h-8 border-2 border-white/10 border-t-white rounded-full animate-spin"></div></div>;

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
            testAlert={() => triggerAlert({ total: 0, customer_name: 'SYSTEM TEST' })}
          />
        } />
      </Routes>
    </HashRouter>
  );
};

export default AdminApp;
