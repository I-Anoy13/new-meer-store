
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { Product, Order, User, UserRole } from './types';
import { MOCK_PRODUCTS } from './constants';
import { supabase } from './lib/supabase';
import AdminDashboard from './views/AdminDashboard';

const AdminApp: React.FC = () => {
  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem('itx_cached_products');
    return saved ? JSON.parse(saved) : MOCK_PRODUCTS;
  });
  
  const [rawOrders, setRawOrders] = useState<any[]>(() => {
    const saved = localStorage.getItem('itx_cached_orders');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [loading, setLoading] = useState(rawOrders.length === 0);
  const [isLive, setIsLive] = useState(false);
  const processedRef = useRef<Set<string>>(new Set());
  const masterChannelRef = useRef<any>(null);

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

  useEffect(() => {
    localStorage.setItem('itx_cached_products', JSON.stringify(products));
    localStorage.setItem('itx_cached_orders', JSON.stringify(rawOrders));
    localStorage.setItem('itx_status_overrides', JSON.stringify(statusOverrides));
  }, [products, rawOrders, statusOverrides]);

  const triggerInstantAlert = useCallback((order: any) => {
    // Only play sound if this is the active Admin console
    if (user?.role !== UserRole.ADMIN) return;

    try {
      const ctx = new ((window as any).AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(523, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1046, ctx.currentTime + 0.1);
      g.gain.setValueAtTime(0, ctx.currentTime);
      g.gain.linearRampToValueAtTime(0.8, ctx.currentTime + 0.05);
      g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 2.5);
      osc.connect(g); g.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 2.5);
    } catch (e) {
      console.warn("Audio Alert failed - interaction required.");
    }

    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'TRIGGER_NOTIFICATION',
        title: '🚨 NEW ORDER RECEIVED!',
        body: `Rs. ${order.total_pkr || order.total} — ${order.customer_name}`,
        orderId: order.order_id || order.id
      });
    }
  }, [user]);

  const normalizeOrder = (row: any): Order | null => {
    if (!row) return null;
    const orderId = row.order_id || (row.id ? `ORD-${row.id}` : 'ORD-UNKNOWN');
    const dbStatusRaw = String(row.status || 'Pending').toLowerCase();
    const capitalized = dbStatusRaw.charAt(0).toUpperCase() + dbStatusRaw.slice(1);
    const dbStatus = (capitalized || 'Pending') as Order['status'];
    const finalStatus = statusOverrides[orderId] || dbStatus;
    const totalAmount = row.total_pkr ?? row.subtotal_pkr ?? row.total ?? 0;

    return {
      id: orderId,
      dbId: row.id ? Number(row.id) : undefined,
      items: Array.isArray(row.items) ? row.items : [],
      total: Number(totalAmount),
      status: finalStatus,
      customer: {
        name: row.customer_name || 'Anonymous',
        email: '',
        phone: row.customer_phone || '',
        address: row.customer_address || '',
        city: row.customer_city || ''
      },
      date: row.created_at || row.date || new Date().toISOString()
    };
  };

  const orders = useMemo(() => {
    return rawOrders.map(normalizeOrder).filter((o): o is Order => o !== null);
  }, [rawOrders, statusOverrides]);

  const addRealtimeOrder = useCallback((newOrder: any) => {
    const id = newOrder.order_id || String(newOrder.id);
    if (processedRef.current.has(id)) return;
    processedRef.current.add(id);
    setRawOrders(prev => [newOrder, ...prev]);
    triggerInstantAlert(newOrder);
  }, [triggerInstantAlert]);

  const setupMasterSync = useCallback(() => {
    if (user?.role !== UserRole.ADMIN) return;

    if (masterChannelRef.current) {
      supabase.removeChannel(masterChannelRef.current);
    }

    const channel = supabase.channel('itx_master_link')
      .on('broadcast', { event: 'new_order_pulse' }, (payload) => {
        addRealtimeOrder(payload.payload);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
        addRealtimeOrder(payload.new);
      })
      .subscribe((status) => {
        setIsLive(status === 'SUBSCRIBED');
      });

    masterChannelRef.current = channel;
  }, [user, addRealtimeOrder]);

  useEffect(() => {
    setupMasterSync();
    
    const handleFocus = () => {
      if (document.visibilityState === 'visible') setupMasterSync();
    };
    
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
      if (masterChannelRef.current) supabase.removeChannel(masterChannelRef.current);
    };
  }, [setupMasterSync]);

  const fetchOrders = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('orders')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) {
        setRawOrders(data);
        data.forEach(o => processedRef.current.add(o.order_id || String(o.id)));
      }
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      await fetchOrders();
      if (mounted) setLoading(false);
    };
    init();
    return () => { mounted = false; };
  }, [fetchOrders]);

  const updateStatusOverride = async (orderId: string, status: Order['status']) => {
    setStatusOverrides(prev => ({ ...prev, [orderId]: status }));
    try {
      const { error } = await supabase.from('orders')
        .update({ status: status.toLowerCase() })
        .eq('order_id', orderId);
      if (error) throw error;
    } catch (e) { 
      setStatusOverrides(prev => {
        const next = { ...prev };
        delete next[orderId];
        return next;
      });
    }
  };

  if (loading && rawOrders.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center animate-pulse">
          <div className="w-12 h-12 border-2 border-white/10 border-t-white rounded-full animate-spin mb-4 mx-auto"></div>
          <p className="text-[10px] font-black uppercase text-white tracking-widest">Waking Master Terminal...</p>
        </div>
      </div>
    );
  }

  return (
    <HashRouter>
      <Routes>
        <Route path="/*" element={
          <AdminDashboard 
            products={products} 
            orders={orders} 
            user={user} 
            isLive={isLive}
            login={(role: UserRole) => { 
              const u = { id: '1', name: 'Master', email: 'itx@me.pk', role }; 
              setUser(u); 
              localStorage.setItem('itx_user_session', JSON.stringify(u)); 
            }}
            systemPassword={systemPassword} 
            setSystemPassword={setSystemPassword}
            refreshData={fetchOrders}
            addRealtimeOrder={addRealtimeOrder}
            updateStatusOverride={updateStatusOverride}
          />
        } />
      </Routes>
    </HashRouter>
  );
};

export default AdminApp;
