
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { Product, Order, User, UserRole } from './types';
import { MOCK_PRODUCTS } from './constants';
import { supabase } from './lib/supabase';
import AdminDashboard from './views/AdminDashboard';

const AdminApp: React.FC = () => {
  const [products, setProducts] = useState<Product[]>(MOCK_PRODUCTS);
  const [rawOrders, setRawOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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
    localStorage.setItem('itx_status_overrides', JSON.stringify(statusOverrides));
  }, [statusOverrides]);

  const orders = useMemo(() => {
    return rawOrders.map((row): Order | null => {
      if (!row) return null;
      const orderId = row.order_id || (row.id ? `ORD-${row.id}` : 'ORD-UNKNOWN');
      const dbStatusRaw = String(row.status || 'Pending').toLowerCase();
      const capitalized = dbStatusRaw.charAt(0).toUpperCase() + dbStatusRaw.slice(1);
      const dbStatus = (capitalized || 'Pending') as Order['status'];
      const finalStatus = statusOverrides[orderId] || dbStatus;
      const totalAmount = row.subtotal_pkr ?? row.total_pkr ?? row.total ?? 0;

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
      const { data, error } = await supabase.from('orders').select('*');
      if (!error && data) {
        setRawOrders(data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
      }
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    Promise.all([fetchProducts(), fetchOrders()]).finally(() => setLoading(false));
  }, [fetchProducts, fetchOrders]);

  const updateStatusOverride = (orderId: string, status: Order['status']) => {
    setStatusOverrides(prev => ({ ...prev, [orderId]: status }));
  };

  const deleteProduct = async (productId: string) => {
    const { error } = await supabase.from('products').delete().eq('id', productId);
    if (!error) setProducts(prev => prev.filter(p => p.id !== productId));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f6f6f7]">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-black border-t-blue-600 rounded-full animate-spin mb-4 mx-auto"></div>
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Loading Console...</p>
        </div>
      </div>
    );
  }

  return (
    <HashRouter>
      <Routes>
        <Route path="/*" element={
          <AdminDashboard 
            products={products} setProducts={setProducts} deleteProduct={deleteProduct} 
            orders={orders} setOrders={() => {}} 
            user={user} login={(role) => { const u = { id: '1', name: 'Manager', email: 'm@itx.pk', role }; setUser(u); localStorage.setItem('itx_user_session', JSON.stringify(u)); }}
            systemPassword={systemPassword} setSystemPassword={setSystemPassword}
            refreshData={() => { fetchOrders(); fetchProducts(); }}
            updateStatusOverride={updateStatusOverride}
          />
        } />
      </Routes>
    </HashRouter>
  );
};

export default AdminApp;
