
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { Product, Order, User, UserRole } from './types';
import AdminDashboard from './views/AdminDashboard';

const SUPABASE_URL = 'https://hwkotlfmxuczloonjziz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3a290bGZteHVjemxvb25qeml6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyMzE5ODUsImV4cCI6MjA4NDgwNzk4NX0.GUFuxE-xMBy4WawTWbiyCOWr3lcqNF7BoqQ55-UMe3Y';

const adminSupabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const AdminApp: React.FC = () => {
  const [rawOrders, setRawOrders] = useState<any[]>(() => {
    const saved = localStorage.getItem('itx_cached_orders');
    return saved ? JSON.parse(saved) : [];
  });
  const [totalDbCount, setTotalDbCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const processedIds = useRef<Set<string>>(new Set());

  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('itx_user_session');
    return saved ? JSON.parse(saved) : null;
  });

  const playKaching = useCallback(async () => {
    try {
      if (!audioContextRef.current) audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') await ctx.resume();
      const now = ctx.currentTime;
      
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(2489, now); // Metallic high note
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.5, now + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, now + 1);
      osc.connect(g); g.connect(ctx.destination);
      osc.start(); osc.stop(now + 1);
    } catch (e) {}
  }, []);

  const refreshData = useCallback(async () => {
    try {
      const { data, error } = await adminSupabase.from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (!error && data) {
        setRawOrders(data);
        setTotalDbCount(data.length); // Fallback count
        data.forEach(o => processedIds.current.add(String(o.order_id || o.id)));
        setLastSyncTime(new Date());
      }
    } catch (e) {} finally {
      setLoading(false);
    }
  }, []);

  // Listen for signals from the Service Worker Sentinel
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'NEW_ORDER_DETECTED') {
        const newOrder = event.data.order;
        const id = String(newOrder.order_id || newOrder.id);
        
        if (!processedIds.current.has(id)) {
          processedIds.current.add(id);
          setRawOrders(prev => [newOrder, ...prev].slice(0, 100));
          setTotalDbCount(c => c + 1);
          playKaching();
          setLastSyncTime(new Date());
        }
      }
      if (event.data.type === 'SENTINEL_ALIVE') {
        setIsLive(true);
      }
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);
    
    // Heartbeat check
    const pingInterval = setInterval(() => {
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage('REQUEST_SENTINEL_STATUS');
      }
    }, 5000);

    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
      clearInterval(pingInterval);
    };
  }, [playKaching]);

  useEffect(() => {
    if (user?.role === UserRole.ADMIN) {
      refreshData();
    } else {
      setLoading(false);
    }
  }, [user, refreshData]);

  const formattedOrders = useMemo((): Order[] => {
    return rawOrders.map(o => ({
      id: o.order_id || String(o.id),
      items: Array.isArray(o.items) ? o.items : [],
      total: Number(o.total_pkr || o.total || 0),
      status: (o.status ? o.status.charAt(0).toUpperCase() + o.status.slice(1) : 'Pending') as Order['status'],
      customer: { name: o.customer_name || 'Anonymous', email: '', phone: o.customer_phone || '', address: o.customer_address || '', city: o.customer_city || '' },
      date: o.created_at || new Date().toISOString()
    }));
  }, [rawOrders]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
      <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
    </div>
  );

  return (
    <HashRouter>
      <Routes>
        <Route path="*" element={
          <AdminDashboard 
            orders={formattedOrders}
            totalDbCount={totalDbCount}
            activeVisitors={[]} // Simplified for reliability
            liveActivities={[]}
            user={user}
            isLive={isLive}
            audioReady={audioReady}
            lastSyncTime={lastSyncTime}
            login={(role: UserRole) => {
              const u: User = { id: 'master', email: 'admin@itx.com', role, name: 'Master' };
              setUser(u);
              localStorage.setItem('itx_user_session', JSON.stringify(u));
              if (Notification.permission !== 'granted') Notification.requestPermission();
              setAudioReady(true);
            }}
            logout={() => { setUser(null); localStorage.removeItem('itx_user_session'); }}
            systemPassword={localStorage.getItem('systemPassword') || 'admin123'}
            initAudio={() => {
              if (Notification.permission !== 'granted') Notification.requestPermission();
              setAudioReady(true);
            }}
            refreshData={refreshData}
            testAlert={() => playKaching()}
          />
        } />
      </Routes>
    </HashRouter>
  );
};

export default AdminApp;
