
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
  const heartbeatIntervalRef = useRef<any>(null);
  const reconnectTimeoutRef = useRef<any>(null);

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

  // IMMORTAL HEARTBEAT: Uses Web Audio to keep the JS thread alive on iOS background
  const playPulse = useCallback(() => {
    if (!audioContextRef.current || audioContextRef.current.state === 'suspended') return;
    try {
      const osc = audioContextRef.current.createOscillator();
      const gain = audioContextRef.current.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1, audioContextRef.current.currentTime);
      gain.gain.setValueAtTime(0.001, audioContextRef.current.currentTime);
      osc.connect(gain);
      gain.connect(audioContextRef.current.destination);
      osc.start();
      osc.stop(audioContextRef.current.currentTime + 0.1);
    } catch (e) {}
  }, []);

  const triggerAlert = useCallback(async (order?: any) => {
    try {
      const ctx = audioContextRef.current || new (window.AudioContext || (window as any).webkitAudioContext)();
      if (!audioContextRef.current) audioContextRef.current = ctx;
      if (ctx.state === 'suspended') await ctx.resume();

      const now = ctx.currentTime;
      // Loud Attention Chime
      [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + (i * 0.1));
        g.gain.setValueAtTime(0, now + (i * 0.1));
        g.gain.linearRampToValueAtTime(0.8, now + (i * 0.1) + 0.05);
        g.gain.exponentialRampToValueAtTime(0.001, now + (i * 0.1) + 1.2);
        osc.connect(g); g.connect(ctx.destination);
        osc.start(now + (i * 0.1)); osc.stop(now + (i * 0.1) + 1.2);
      });

      if (order && Notification.permission === "granted") {
        new Notification('🚨 NEW ORDER', {
          body: `Rs. ${order.total_pkr || order.total} — ${order.customer_name}`,
          icon: 'https://images.unsplash.com/photo-1614164185128-e4ec99c436d7?q=80&w=192&h=192&auto=format&fit=crop',
          tag: 'itx-' + (order.order_id || order.id),
          requireInteraction: true
        });
      }
    } catch (e) {}
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      // THE DEFINITIVE FIX FOR '98': Fetch IDs with no limit to get the actual count
      // Supabase count property is most reliable when head is true
      const { count, error: countErr } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true });
      
      if (!countErr && count !== null) {
        setTotalDbCount(count);
      } else {
        // Fallback: If metadata count fails, fetch all IDs (up to 1000)
        const { data: allIds } = await supabase.from('orders').select('id').limit(1000);
        if (allIds) setTotalDbCount(allIds.length);
      }

      // Fetch visible feed
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
    
    // Clear existing
    if (masterChannelRef.current) {
      supabase.removeChannel(masterChannelRef.current);
    }

    const channel = supabase.channel('itx_terminal_final_v1')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, payload => {
        addRealtimeOrder(payload.new);
      })
      .subscribe(status => {
        const connected = status === 'SUBSCRIBED';
        setIsLive(connected);
        if (connected) {
          setLastSyncTime(new Date());
          if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        } else {
          // Auto-reconnect loop
          reconnectTimeoutRef.current = setTimeout(() => {
            setupMasterSync();
          }, 5000);
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
      
      // Start the heartbeat pulse
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = setInterval(playPulse, 15000);
      
      if (Notification.permission !== "granted") {
        await Notification.requestPermission();
      }
      
      setAudioReady(true);
      fetchOrders();
    } catch (e) {
      setAudioReady(false);
    }
  }, [playPulse, fetchOrders]);

  useEffect(() => {
    // Listen for Service Worker discoveries
    const handleSWMessage = (event: MessageEvent) => {
      if (event.data?.type === 'NEW_ORDER_DETECTED') {
        addRealtimeOrder(event.data.order);
      }
    };
    navigator.serviceWorker?.addEventListener('message', handleSWMessage);

    // Visibility Handling
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        if (audioContextRef.current?.state === 'suspended') audioContextRef.current.resume();
        setupMasterSync();
        fetchOrders();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);

    return () => {
      navigator.serviceWorker?.removeEventListener('message', handleSWMessage);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
    };
  }, [addRealtimeOrder, setupMasterSync, fetchOrders]);

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
              if (window.confirm("IRREVERSIBLE: Wipe all order records?")) {
                await supabase.from('orders').delete().gt('id', 0);
                setRawOrders([]);
                setTotalDbCount(0);
                fetchOrders();
              }
            }}
            updateStatusOverride={async (id: string, status: Order['status']) => {
              await supabase.from('orders').update({ status: status.toLowerCase() }).match({ order_id: id });
              setStatusOverrides(prev => ({ ...prev, [id]: status }));
            }}
            testAlert={() => triggerAlert({ total: 9999, customer_name: 'TEST CONNECTION' })}
          />
        } />
      </Routes>
    </HashRouter>
  );
};

export default AdminApp;
