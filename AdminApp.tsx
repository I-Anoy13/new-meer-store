import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { Product, Order, User, UserRole } from './types';
import { MOCK_PRODUCTS } from './constants';
import { supabase } from './lib/supabase';
import AdminDashboard from './views/AdminDashboard';

/* 
 * ADMIN CORE APPLICATION 
 * Synchronizes real Supabase data streams for the Dashboard.
 */

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

  const orders = useMemo(() => {
    return rawOrders.map((row): Order | null => {
      if (!row) return null;
      // Normalizing Order ID from Supabase row
      const orderId = row.order_id || (row.id ? `ORD-${row.id}` : 'ORD-UNKNOWN');
      
      // Normalizing Status
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
    }).filter((o): o is Order => o !== null);
  }, [rawOrders, statusOverrides]);

  const fetchProducts = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('products').select('*');
      if (!error && data) {
        setProducts(data.map(row => ({
          id: String(row.id),
          name: row.name || 'Untitled Item',
          description: row.description || '',
          price: Number(row.price_pkr || row.price || 0),
          image: row.image || row.image_url || 'https://via.placeholder.com/800x1000',
          category: row.category || 'Luxury',
          inventory: Number(row.inventory || 0),
          rating: Number(row.rating || 5),
          reviews: []
        })));
      }
    } catch (e) { console.error(e); }
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('orders')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) {
        setRawOrders(data);
      }
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      await Promise.allSettled([fetchProducts(), fetchOrders()]);
      if (mounted) setLoading(false);
    };
    init();
    return () => { mounted = false; };
  }, [fetchProducts, fetchOrders]);

  const updateStatusOverride = async (orderId: string, status: Order['status']) => {
    // Optimistic Update
    setStatusOverrides(prev => ({ ...prev, [orderId]: status }));
    try {
      // Find the db ID if possible or use order_id
      const { error } = await supabase.from('orders')
        .update({ status: status.toLowerCase() })
        .eq('order_id', orderId);
      
      if (error) throw error;
    } catch (e) { 
      console.error("Status Sync Error:", e);
      // Revert if error
      setStatusOverrides(prev => {
        const next = { ...prev };
        delete next[orderId];
        return next;
      });
    }
  };

  const deleteProduct = async (productId: string) => {
    const { error } = await supabase.from('products').delete().eq('id', productId);
    if (!error) setProducts(prev => prev.filter(p => p.id !== productId));
  };

  if (loading && rawOrders.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center animate-pulse">
          <div className="w-12 h-12 border-2 border-white/10 border-t-white rounded-full animate-spin mb-4 mx-auto"></div>
          <p className="text-[10px] font-black uppercase text-white tracking-widest">Initalizing Core...</p>
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
            deleteProduct={deleteProduct} 
            orders={orders} 
            user={user} 
            login={(role: UserRole) => { 
              const u = { id: '1', name: 'Master', email: 'itx@me.pk', role }; 
              setUser(u); 
              localStorage.setItem('itx_user_session', JSON.stringify(u)); 
            }}
            systemPassword={systemPassword} 
            setSystemPassword={setSystemPassword}
            refreshData={() => { fetchOrders(); fetchProducts(); }}
            updateStatusOverride={updateStatusOverride}
          />
        } />
      </Routes>
    </HashRouter>
  );
};

export default AdminApp;
