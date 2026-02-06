
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { Product, Order, User, UserRole } from './types';
import AdminDashboard from './views/AdminDashboard';

// Isolated Admin Client to prevent conflict with main site session
const ADMIN_SUPABASE_URL = 'https://hwkotlfmxuczloonjziz.supabase.co';
const ADMIN_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3a290bGZteHVjemxvb25qeml6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyMzE5ODUsImV4cCI6MjA4NDgwNzk4NX0.GUFuxE-xMBy4WawTWbiyCOWr3lcqNF7BoqQ55-UMe3Y';
const adminSupabase = createClient(ADMIN_SUPABASE_URL, ADMIN_SUPABASE_KEY);

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
  const heartbeatIntervalRef = useRef<any>(null);

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

  // THE PERSISTENCE HACK: Silent 1x1 looping video to keep iOS JS alive
  const startPersistenceMedia = useCallback(() => {
    if (videoPersistenceRef.current) return;
    try {
      const v = document.createElement('video');
      v.setAttribute('playsinline', '');
      v.setAttribute('muted', '');
      v.setAttribute('loop', '');
      v.style.position = 'fixed';
      v.style.bottom = '0';
      v.style.right = '0';
      v.style.width = '1px';
      v.style.height = '1px';
      v.style.opacity = '0.01';
      v.style.pointerEvents = 'none';
      v.src = 'data:video/mp4;base64,AAAAHGZ0eXBpc29tAAAAAGlzb21tcDQyAAAACHV1aWRreG1sAAAAAGFiaWxpdHkgeG1sbnM9Imh0dHA6Ly9ucy5hZG9iZS5jb20vYWJpbGl0eS8iPjxhYmlsaXR5OnN5c3RlbT48YWJpbGl0eTpkZXZpY2U+PG9zPnVuaXg8L29zPjwvYWJpbGl0eTpkZXZpY2U+PC9hYmlsaXR5OnN5c3RlbT48L2FiaWxpdHk+AAAAbG1vb3YAAABsbXZoZAAAAAAAAAAAAAAAAAAAA+gAAAPoAAEAAAEAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAABidHJhazAAAAHkdGtoZAAAAAMAAAAAAAAAAAAAA+gAAAPoAAAAAAABAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAABkbWRpYQAALW1kaGQAAAAAAAAAAAAAAAAAAD6AAAA+gAFVx9v/AAAAAAAALWhkbHIAAAAAAAAAAHZpZGVvAAAAAAAAAAAAAAAAVmlkZW9IYW5kbGVyAAAAAVxtZGlhAAAALW1pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAAU9zdGJsAAAAp3N0c2QAAAAAAAAAAQAAAJZhdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAHgAeABIAAAASAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGP//AAAALWF2Y0MBQsAM/+EAFWdCwAwU9mAsX+AAB9AAAfQAAAgAAAH0AAAgAAYhB9mP4wAAABhzdHRzAAAAAAAAAAEAAAABAAAD6AAAAFpzdHNjAAAAAAAAAAEAAAABAAAAAQAAAAEAAAAUc3RzegAAAAAAAAAAAAAAAgAAABRzdGNvAAAAAAAAAAEAAAAwAAAAYXVkcmEAAABhdWRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAAD9zZ3BkAAAAAAAAAHRyb2wAAAABAAAALXRyb2wAAAAAAAEAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAYW1lZXRyYWsAAA==';
      document.body.appendChild(v);
      v.play().catch(() => console.log("Media Play Interrupted"));
      videoPersistenceRef.current = v;
    } catch (e) {}
  }, []);

  const triggerAlert = useCallback(async (order?: any) => {
    try {
      const ctx = audioContextRef.current || new (window.AudioContext || (window as any).webkitAudioContext)();
      if (!audioContextRef.current) audioContextRef.current = ctx;
      if (ctx.state === 'suspended') await ctx.resume();

      const now = ctx.currentTime;
      // High-Frequency Alarm for wake-up
      [880, 1046, 1318].forEach((f, i) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, now + (i * 0.15));
        g.gain.setValueAtTime(0, now + (i * 0.15));
        g.gain.linearRampToValueAtTime(0.5, now + (i * 0.15) + 0.05);
        g.gain.exponentialRampToValueAtTime(0.001, now + (i * 0.15) + 2.0);
        osc.connect(g); g.connect(ctx.destination);
        osc.start(now + (i * 0.15)); osc.stop(now + (i * 0.15) + 2.0);
      });

      if (order && Notification.permission === "granted") {
        new Notification('🚨 NEW ORDER DETECTED', {
          body: `Rs. ${order.total_pkr || order.total} — ${order.customer_name}`,
          icon: 'https://images.unsplash.com/photo-1614164185128-e4ec99c436d7?q=80&w=192&h=192&auto=format&fit=crop',
          requireInteraction: true,
          tag: 'itx-alert'
        });
      }
    } catch (e) {}
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      // THE DEFINITIVE FIX FOR '98': Direct ID fetch bypassing count metadata
      const { data: idList, error: countErr } = await adminSupabase
        .from('orders')
        .select('id')
        .limit(10000);
      
      if (!countErr && idList) {
        setTotalDbCount(idList.length);
      }

      // Fetch visible feed
      const { data, error: dataErr } = await adminSupabase.from('orders')
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
    
    if (masterChannelRef.current) {
      adminSupabase.removeChannel(masterChannelRef.current);
    }

    // New unique channel name to avoid collision with main site
    const channel = adminSupabase.channel('itx_admin_terminal_omega_99')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, payload => {
        addRealtimeOrder(payload.new);
      })
      .subscribe(status => {
        const connected = status === 'SUBSCRIBED';
        setIsLive(connected);
        if (connected) setLastSyncTime(new Date());
        else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
            setTimeout(setupMasterSync, 3000);
        }
      });

    masterChannelRef.current = channel;
  }, [user, addRealtimeOrder]);

  const initAudio = useCallback(async () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      
      startPersistenceMedia();
      
      if (Notification.permission !== "granted") {
        await Notification.requestPermission();
      }
      
      setAudioReady(true);
      fetchOrders();
    } catch (e) {
      setAudioReady(false);
    }
  }, [startPersistenceMedia, fetchOrders]);

  useEffect(() => {
    const handleReSync = () => {
      if (document.visibilityState === 'visible') {
        if (audioContextRef.current?.state === 'suspended') audioContextRef.current.resume();
        setupMasterSync();
        fetchOrders();
      }
    };
    window.addEventListener('focus', handleReSync);
    document.addEventListener('visibilitychange', handleReSync);
    return () => {
      window.removeEventListener('focus', handleReSync);
      document.removeEventListener('visibilitychange', handleReSync);
    };
  }, [setupMasterSync, fetchOrders]);

  useEffect(() => {
    if (user?.role === UserRole.ADMIN) {
      setupMasterSync();
      fetchOrders().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [user, setupMasterSync, fetchOrders]);

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
            purgeDatabase={async () => {
              if (window.confirm("IRREVERSIBLE: Wipe all history?")) {
                await adminSupabase.from('orders').delete().neq('customer_name', 'SECRET_PROTECTION_KEY');
                setRawOrders([]);
                setTotalDbCount(0);
                fetchOrders();
              }
            }}
            updateStatusOverride={async (id: string, status: Order['status']) => {
              await adminSupabase.from('orders').update({ status: status.toLowerCase() }).match({ order_id: id });
              setStatusOverrides(prev => ({ ...prev, [id]: status }));
            }}
            testAlert={() => triggerAlert({ total: 0, customer_name: 'TEST' })}
          />
        } />
      </Routes>
    </HashRouter>
  );
};

export default AdminApp;
