
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { Product, Order, User, UserRole } from './types';
import AdminDashboard from './views/AdminDashboard';

const ADMIN_SUPABASE_URL = 'https://hwkotlfmxuczloonjziz.supabase.co';
const ADMIN_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3a290bGZteHVjemxvb25qeml6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyMzE5ODUsImV4cCI6MjA4NDgwNzk4NX0.GUFuxE-xMBy4WawTWbiyCOWr3lcqNF7BoqQ55-UMe3Y';

const adminSupabase = createClient(ADMIN_SUPABASE_URL, ADMIN_SUPABASE_KEY, {
  auth: { persistSession: false },
  realtime: { params: { eventsPerSecond: 10 } }
});

const AdminApp: React.FC = () => {
  const [rawOrders, setRawOrders] = useState<any[]>(() => {
    const saved = localStorage.getItem('itx_cached_orders');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [totalDbCount, setTotalDbCount] = useState<number>(0);
  const [activeVisitors, setActiveVisitors] = useState<any[]>([]);
  const [liveActivities, setLiveActivities] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());
  
  const processedRef = useRef<Set<string>>(new Set());
  const masterChannelRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const persistenceVideoRef = useRef<HTMLVideoElement | null>(null);
  const retryTimeoutRef = useRef<any>(null);

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
  }, [rawOrders, statusOverrides]);

  // THE PERSISTENCE HACK: Keeps the browser process alive in the background
  const startPersistenceLayer = useCallback(() => {
    if (persistenceVideoRef.current) return;

    const video = document.createElement('video');
    video.setAttribute('playsinline', '');
    video.setAttribute('muted', '');
    video.setAttribute('loop', '');
    video.style.position = 'fixed';
    video.style.opacity = '0.001';
    video.style.pointerEvents = 'none';
    video.style.width = '1px';
    video.style.height = '1px';
    // A silent 1-second MP4 loop to prevent the OS from suspending the tab
    video.src = 'data:video/mp4;base64,AAAAHGZ0eXBpc29tAAAAAGlzb21tcDQyAAAACHV1aWRreG1sAAAAAGFiaWxpdHkgeG1sbnM9Imh0dHA6Ly9ucy5hZG9iZS5jb20vYWJpbGl0eS8iPjxhYmlsaXR5OnN5c3RlbT48YWJpbGl0eTpkZXZpY2U+PG9zPnVuaXg8L29zPjwvYWJpbGl0eTpkZXZpY2U+PC9hYmlsaXR5OnN5c3RlbT48L2FiaWxpdHk+AAAAbG1vb3YAAABsbXZoZAAAAAAAAAAAAAAAAAAAA+gAAAPoAAEAAAEAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAABidHJhazAAAAHkdGtoZAAAAAMAAAAAAAAAAAAAA+gAAAPoAAAAAAABAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAABkbWRpYQAALW1kaGQAAAAAAAAAAAAAAAAAAD6AAAA+gAFVx9v/AAAAAAAALWhkbHIAAAAAAAAAAHZpZGVvAAAAAAAAAAAAAAAAVmlkZW9IYW5kbGVyAAAAAVxtZGlhAAAALW1pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAAU9zdGJsAAAAp3N0c2QAAAAAAAAAAQAAAJZhdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAHgAeABIAAAASAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGP//AAAALWF2Y0MBQsAM/+EAFWdCwAwU9mAsX+AAB9AAAfQAAAgAAAH0AAAgAAYhB9mP4wAAABhzdHRzAAAAAAAAAAEAAAABAAAD6AAAAFpzdHNjAAAAAAAAAAEAAAABAAAAAQAAAAEAAAAUc3RzegAAAAAAAAAAAAAAAgAAABRzdGNvAAAAAAAAAAEAAAAwAAAAYXVkcmEAAABhdWRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAAD9zZ3BkAAAAAAAAAHRyb2wAAAABAAAALXRyb2wAAAAAAAEAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAYW1lZXRyYWsAAA==';
    
    document.body.appendChild(video);
    video.play().catch(() => {
      console.log('Persistence video blocked - user interaction required');
    });
    persistenceVideoRef.current = video;

    // Wake Lock API (if supported)
    if ('wakeLock' in navigator) {
      (navigator as any).wakeLock.request('screen').catch(() => {});
    }
  }, []);

  const triggerShopifyAlert = useCallback(async (order?: any) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') await ctx.resume();

      const now = ctx.currentTime;
      
      const osc1 = ctx.createOscillator();
      const g1 = ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(800, now);
      osc1.frequency.exponentialRampToValueAtTime(1400, now + 0.05);
      g1.gain.setValueAtTime(0, now);
      g1.gain.linearRampToValueAtTime(0.3, now + 0.01);
      g1.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc1.connect(g1); g1.connect(ctx.destination);
      osc1.start(now); osc1.stop(now + 0.1);

      const osc2 = ctx.createOscillator();
      const g2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(2489, now + 0.08); 
      g2.gain.setValueAtTime(0, now + 0.08);
      g2.gain.linearRampToValueAtTime(0.4, now + 0.09);
      g2.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
      osc2.connect(g2); g2.connect(ctx.destination);
      osc2.start(now + 0.08); osc2.stop(now + 1.2);

      if (order && Notification.permission === "granted") {
        new Notification('💰 NEW ITX SALE!', {
          body: `Rs. ${order.total_pkr || order.total} — ${order.customer_name}`,
          icon: 'https://images.unsplash.com/photo-1614164185128-e4ec99c436d7?q=80&w=192&h=192&auto=format&fit=crop',
          tag: 'itx-sale',
          requireInteraction: true
        });
      }
    } catch (e) {}
  }, []);

  const fetchOrdersAndCount = useCallback(async () => {
    try {
      const { data: idData, error: countErr } = await adminSupabase.from('orders').select('id');
      if (!countErr && idData) {
        setTotalDbCount(idData.length);
      }

      const { data, error: dataErr } = await adminSupabase.from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (!dataErr && data) {
        setRawOrders(data);
        data.forEach(o => processedRef.current.add(String(o.order_id || o.id)));
        setLastSyncTime(new Date());
      }
    } catch (e) {} finally {
      setLoading(false);
    }
  }, []);

  const handleRealtimeInsert = useCallback((newOrder: any) => {
    const id = String(newOrder.order_id || newOrder.id);
    if (processedRef.current.has(id)) return;
    processedRef.current.add(id);
    
    setRawOrders(prev => [newOrder, ...prev].slice(0, 100));
    setTotalDbCount(prev => prev + 1);
    setLastSyncTime(new Date());
    triggerShopifyAlert(newOrder);
  }, [triggerShopifyAlert]);

  const setupMasterRelay = useCallback(() => {
    if (user?.role !== UserRole.ADMIN) return;
    
    if (masterChannelRef.current) {
      adminSupabase.removeChannel(masterChannelRef.current);
    }

    const channel = adminSupabase.channel('itx_master_command_v5')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, payload => {
        handleRealtimeInsert(payload.new);
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const visitors = Object.values(state).flat();
        setActiveVisitors(visitors);
      })
      .on('broadcast', { event: 'activity' }, (payload) => {
        setLiveActivities(prev => [{ ...payload.payload, time: new Date() }, ...prev].slice(0, 5));
      })
      .subscribe(status => {
        setIsLive(status === 'SUBSCRIBED');
        if (status === 'SUBSCRIBED') {
          setLastSyncTime(new Date());
          
          if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage('PING_SENTINEL');
          }
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          retryTimeoutRef.current = setTimeout(setupMasterRelay, 5000);
        }
      });

    masterChannelRef.current = channel;
  }, [user, handleRealtimeInsert]);

  const initAudioAndPersistence = useCallback(async () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (audioContextRef.current.state === 'suspended') await audioContextRef.current.resume();
      
      startPersistenceLayer();
      
      if (Notification.permission !== "granted") await Notification.requestPermission();
      setAudioReady(true);
      fetchOrdersAndCount();
    } catch (e) {}
  }, [fetchOrdersAndCount, startPersistenceLayer]);

  useEffect(() => {
    if (user?.role === UserRole.ADMIN) {
      setupMasterRelay();
      fetchOrdersAndCount();
      // Auto-init persistence if user session exists
      startPersistenceLayer();
    } else {
      setLoading(false);
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchOrdersAndCount();
        setupMasterRelay();
        if (audioContextRef.current?.state === 'suspended') audioContextRef.current.resume();
        if (persistenceVideoRef.current?.paused) persistenceVideoRef.current.play().catch(() => {});
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    };
  }, [user, setupMasterRelay, fetchOrdersAndCount, startPersistenceLayer]);

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
      <p className="text-[10px] font-black text-white/40 uppercase tracking-widest italic">Activating Master Link...</p>
    </div>
  );

  return (
    <HashRouter>
      <Routes>
        <Route path="*" element={
          <AdminDashboard 
            orders={formattedOrders}
            totalDbCount={totalDbCount}
            activeVisitors={activeVisitors}
            liveActivities={liveActivities}
            user={user}
            isLive={isLive}
            audioReady={audioReady}
            lastSyncTime={lastSyncTime}
            login={(role: UserRole) => {
              const u: User = { id: 'master', email: 'admin@itx.com', role, name: 'Master' };
              setUser(u);
              localStorage.setItem('itx_user_session', JSON.stringify(u));
              initAudioAndPersistence();
            }}
            logout={() => { setUser(null); localStorage.removeItem('itx_user_session'); }}
            systemPassword={localStorage.getItem('systemPassword') || 'admin123'}
            initAudio={initAudioAndPersistence}
            refreshData={fetchOrdersAndCount}
            purgeDatabase={async () => {
              if (window.confirm("PURGE ALL DATA?")) {
                await adminSupabase.from('orders').delete().gt('id', 0);
                fetchOrdersAndCount();
              }
            }}
            updateStatusOverride={async (id: string, status: Order['status']) => {
              await adminSupabase.from('orders').update({ status: status.toLowerCase() }).match({ order_id: id });
              setStatusOverrides(prev => ({ ...prev, [id]: status }));
            }}
            testAlert={() => triggerShopifyAlert({ total: 0, customer_name: 'TEST SALE' })}
          />
        } />
      </Routes>
    </HashRouter>
  );
};

export default AdminApp;
