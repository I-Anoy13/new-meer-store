
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
  const keepAliveAudioRef = useRef<HTMLAudioElement | null>(null);

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

  const setupPersistence = useCallback(() => {
    // Standard iOS persistence hack: Silent looping audio
    if (!keepAliveAudioRef.current) {
      const audio = new Audio();
      // Very short silent base64 wav loop
      audio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
      audio.loop = true;
      audio.muted = false; // Must be false to count as "active" audio on some iOS versions
      audio.volume = 0.01; // Effectively silent
      keepAliveAudioRef.current = audio;
    }
    
    keepAliveAudioRef.current.play().catch(() => {
      console.log("Audio block: Needs user gesture");
      setAudioReady(false);
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
      
      setupPersistence();
      
      if ("Notification" in window && Notification.permission !== "granted") {
        await Notification.requestPermission();
      }
      
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'START_BACKGROUND_SYNC' });
      }
      setAudioReady(true);
    } catch (e) {
      setAudioReady(false);
    }
  }, [setupPersistence]);

  const triggerAlert = useCallback(async (order?: any) => {
    try {
      const ctx = audioContextRef.current || new (window.AudioContext || (window as any).webkitAudioContext)();
      if (!audioContextRef.current) audioContextRef.current = ctx;
      if (ctx.state === 'suspended') await ctx.resume();

      const now = ctx.currentTime;
      // High-pitch alert sequence
      [880, 1108, 1318, 1760].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + (i * 0.15));
        g.gain.setValueAtTime(0, now + (i * 0.15));
        g.gain.linearRampToValueAtTime(0.6, now + (i * 0.15) + 0.05);
        g.gain.exponentialRampToValueAtTime(0.001, now + (i * 0.15) + 1.0);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(now + (i * 0.15));
        osc.stop(now + (i * 0.15) + 1.0);
      });

      // UI Notifications (if permitted)
      if (order && Notification.permission === "granted") {
        const notif = new Notification('🚨 ITX NEW ORDER!', {
          body: `Rs. ${order.total_pkr || order.total} — ${order.customer_name}`,
          icon: 'https://images.unsplash.com/photo-1614164185128-e4ec99c436d7?q=80&w=192&h=192&auto=format&fit=crop',
          tag: 'itx-alert',
          silent: false
        });
        notif.onclick = () => window.focus();
      }
    } catch (e) {
      console.warn("Alert trigger failed:", e);
    }
  }, []);

  const addRealtimeOrder = useCallback((newOrder: any) => {
    const id = String(newOrder.order_id || newOrder.id);
    if (processedRef.current.has(id)) return;
    processedRef.current.add(id);
    
    setRawOrders(prev => {
      const isDuplicate = prev.some(o => String(o.order_id || o.id) === id);
      if (isDuplicate) return prev;
      return [newOrder, ...prev];
    });
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
    } catch (e) { console.error("Fetch Error:", e); }
  }, []);

  const setupMasterSync = useCallback(() => {
    if (user?.role !== UserRole.ADMIN) return;
    if (masterChannelRef.current) {
      supabase.removeChannel(masterChannelRef.current);
    }

    const channel = supabase.channel('itx_terminal_v10')
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
    if (!window.confirm("⚠️ IRREVERSIBLE: Delete ALL orders from Database?")) return;
    
    try {
      // Use a filter that is guaranteed to match all rows in Supabase
      const { error } = await supabase.from('orders').delete().gt('id', -1);
      
      if (error) {
        // Fallback for non-integer ID tables
        const { error: error2 } = await supabase.from('orders').delete().neq('customer_name', '!!!EMPTY_FILTER_HACK!!!');
        if (error2) throw error2;
      }
      
      setRawOrders([]);
      setTotalDbCount(0);
      processedRef.current.clear();
      localStorage.removeItem('itx_cached_orders');
      localStorage.removeItem('itx_total_count');
      setLastSyncTime(new Date());
      window.alert("Database Wiped Successfully.");
    } catch (e) {
      console.error("Purge Error:", e);
      window.alert("Failed to wipe database. Check Supabase permissions.");
    }
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

  useEffect(() => {
    setupMasterSync();
    const handleReactivation = () => {
      if (document.visibilityState === 'visible') {
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
  }, [setupMasterSync, fetchOrders]);

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
      <div className="w-10 h-10 border-2 border-white/5 border-t-white rounded-full animate-spin mb-4"></div>
      <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] italic">System Booting...</p>
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
              initAudio(); // Initialize audio loop on login (user gesture)
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
            testAlert={() => triggerAlert({ total: 0, customer_name: 'TEST ALERT' })}
          />
        } />
      </Routes>
    </HashRouter>
  );
};

export default AdminApp;
