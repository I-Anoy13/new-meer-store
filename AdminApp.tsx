
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
  const persistenceNodeRef = useRef<AudioBufferSourceNode | null>(null);

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

  // The "Life Support" Audio Loop
  const startPersistenceEngine = useCallback(() => {
    if (!audioContextRef.current) return;
    
    // Stop previous if exists
    if (persistenceNodeRef.current) {
      persistenceNodeRef.current.stop();
    }

    // Create a 1-second buffer of extremely low-level white noise
    const bufferSize = audioContextRef.current.sampleRate * 2;
    const buffer = audioContextRef.current.createBuffer(1, bufferSize, audioContextRef.current.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.0001; // Tiny noise, enough to keep thread active
    }

    const source = audioContextRef.current.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    
    const gain = audioContextRef.current.createGain();
    gain.gain.value = 0.001; // Practically inaudible
    
    source.connect(gain);
    gain.connect(audioContextRef.current.destination);
    source.start();
    persistenceNodeRef.current = source;
    setAudioReady(true);
  }, []);

  const initAudio = useCallback(async () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      startPersistenceEngine();
      
      // Tell Service Worker to wake up background sync
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'START_BACKGROUND_SYNC' });
      }
    } catch (e) {
      setAudioReady(false);
    }
  }, [startPersistenceEngine]);

  const triggerAlert = useCallback(async () => {
    if (!audioContextRef.current) return;
    if (audioContextRef.current.state === 'suspended') await audioContextRef.current.resume();

    const now = audioContextRef.current.currentTime;
    [523, 659, 783, 1046].forEach((freq, i) => {
      const osc = audioContextRef.current!.createOscillator();
      const g = audioContextRef.current!.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, now + (i * 0.1));
      g.gain.setValueAtTime(0, now + (i * 0.1));
      g.gain.linearRampToValueAtTime(0.5, now + (i * 0.1) + 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, now + (i * 0.1) + 2.0);
      osc.connect(g);
      g.connect(audioContextRef.current!.destination);
      osc.start(now + (i * 0.1));
      osc.stop(now + (i * 0.1) + 2.0);
    });
  }, []);

  const addRealtimeOrder = useCallback((newOrder: any) => {
    const id = newOrder.order_id || String(newOrder.id);
    if (processedRef.current.has(id)) return;
    processedRef.current.add(id);
    
    setRawOrders(prev => [newOrder, ...prev]);
    setTotalDbCount(prev => prev + 1);
    setLastSyncTime(new Date());
    triggerAlert();
  }, [triggerAlert]);

  const fetchOrders = useCallback(async () => {
    try {
      const { data, count } = await supabase.from('orders')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .limit(100);
      if (data) {
        setRawOrders(data);
        setTotalDbCount(count || data.length);
        data.forEach(o => processedRef.current.add(o.order_id || String(o.id)));
        setLastSyncTime(new Date());
      }
    } catch (e) {}
  }, []);

  const setupMasterSync = useCallback(() => {
    if (user?.role !== UserRole.ADMIN) return;
    if (masterChannelRef.current) supabase.removeChannel(masterChannelRef.current);

    const channel = supabase.channel('itx_v5_master')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, payload => {
        addRealtimeOrder(payload.new);
      })
      .subscribe(status => setIsLive(status === 'SUBSCRIBED'));

    masterChannelRef.current = channel;
  }, [user, addRealtimeOrder]);

  // Sync with Service Worker
  useEffect(() => {
    const handleWorkerMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'NEW_ORDER_DETECTED') {
        addRealtimeOrder(event.data.order);
      }
    };
    navigator.serviceWorker.addEventListener('message', handleWorkerMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleWorkerMessage);
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
            purgeDatabase={async () => {
              if (window.confirm("Wipe all data?")) {
                await supabase.from('orders').delete().neq('id', 0);
                setRawOrders([]);
                setTotalDbCount(0);
              }
            }}
            updateStatusOverride={async (id: string, status: Order['status']) => {
              await supabase.from('orders').update({ status: status.toLowerCase() }).eq('order_id', id);
              setStatusOverrides(prev => ({ ...prev, [id]: status }));
            }}
            testAlert={triggerAlert}
          />
        } />
      </Routes>
    </HashRouter>
  );
};

export default AdminApp;
