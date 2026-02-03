
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { CartItem, Product, Order, User, UserRole } from './types';
import { MOCK_PRODUCTS } from './constants';
import { supabase } from './lib/supabase';
import Home from './views/Home';
import ProductDetail from './views/ProductDetail';
import CartView from './views/CartView';
import Checkout from './views/Checkout';
import AdminDashboard from './views/AdminDashboard';
import PrivacyPolicy from './views/PrivacyPolicy';
import TermsOfService from './views/TermsOfService';
import RefundPolicy from './views/RefundPolicy';
import ShippingPolicy from './views/ShippingPolicy';
import Header from './components/Header';
import Footer from './components/Footer';

const App: React.FC = () => {
  const [products, setProducts] = useState<Product[]>(MOCK_PRODUCTS);
  const [rawOrders, setRawOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  // Status Overrides: Treat LocalStorage as the Absolute Source of Truth
  const [statusOverrides, setStatusOverrides] = useState<Record<string, Order['status']>>(() => {
    const saved = localStorage.getItem('itx_status_overrides');
    return saved ? JSON.parse(saved) : {};
  });

  const [cart, setCart] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem('cart');
    return saved ? JSON.parse(saved) : [];
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

  // Derived Orders List: Merges Raw DB data with Local status overrides
  const orders = useMemo(() => {
    return rawOrders.map(row => {
      const orderId = row.order_id || `ORD-${row.id}`;
      const dbStatusRaw = String(row.status || 'Pending').toLowerCase();
      const dbStatus = (dbStatusRaw.charAt(0).toUpperCase() + dbStatusRaw.slice(1)) as Order['status'];
      
      // Local override always wins!
      const finalStatus = statusOverrides[orderId] || dbStatus;

      return {
        id: orderId,
        dbId: row.id,
        items: Array.isArray(row.items) ? row.items : [],
        total: row.total_pkr || row.total || 0,
        status: finalStatus,
        customer: {
          name: row.customer_name || 'Anonymous',
          email: '',
          phone: row.customer_phone || '',
          address: row.customer_address || '',
          city: row.customer_city || ''
        },
        date: row.created_at || row.date
      };
    });
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
          reviews: Array.isArray(row.reviews) ? row.reviews : [],
          variants: Array.isArray(row.variants) ? row.variants : []
        })));
      }
    } catch (e) {}
  }, []);

  const fetchOrders = useCallback(async (silent = false) => {
    if (!silent) setIsSyncing(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (!error && data) {
        setRawOrders(data);
      }
    } catch (e) {} finally {
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('realtime-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchOrders(true);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchOrders]);

  useEffect(() => {
    let mounted = true;
    const initData = async () => {
      // Only set loading true on the very first mount
      try {
        await Promise.all([fetchProducts(), fetchOrders(true)]);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    initData();
    return () => { mounted = false; };
  }, []); // Run ONCE on mount

  const updateStatusOverride = (orderId: string, status: Order['status']) => {
    setStatusOverrides(prev => ({ ...prev, [orderId]: status }));
  };

  const addToCart = (product: Product, quantity: number = 1, variantId?: string) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id && item.variantId === variantId);
      if (existing) {
        return prev.map(item => item.product.id === product.id && item.variantId === variantId ? { ...item, quantity: item.quantity + quantity } : item);
      }
      return [...prev, { product, quantity, variantId, variantName: product.variants?.find(v => v.id === variantId)?.name || 'Standard' }];
    });
  };

  const removeFromCart = (productId: string, variantId?: string) => setCart(prev => prev.filter(item => !(item.product.id === productId && item.variantId === variantId)));
  const updateQuantity = (productId: string, quantity: number, variantId?: string) => {
    if (quantity <= 0) return removeFromCart(productId, variantId);
    setCart(prev => prev.map(item => item.product.id === productId && item.variantId === variantId ? { ...item, quantity } : item));
  };

  const deleteProduct = async (productId: string) => {
    const { error } = await supabase.from('products').delete().eq('id', productId);
    if (!error) setProducts(prev => prev.filter(p => p.id !== productId));
  };

  const placeOrder = async (order: Order): Promise<boolean> => {
    try {
      const firstItem = order.items[0];
      const { error } = await supabase.from('orders').insert([{
        order_id: order.id,
        customer_name: order.customer.name,
        customer_phone: order.customer.phone,
        customer_city: order.customer.city || 'N/A',
        customer_address: order.customer.address,
        product_id: String(firstItem?.product.id || 'N/A'),
        product_name: firstItem?.product.name || 'N/A',
        product_price: firstItem?.product.price || 0,
        product_image: firstItem?.product.image || '',
        total_pkr: Math.round(order.total),
        status: order.status.toLowerCase(),
        items: JSON.parse(JSON.stringify(order.items)),
        source: 'Web App'
      }]);
      if (error) throw error;
      await fetchOrders(true);
      setCart([]);
      return true;
    } catch (e: any) {
      alert(`Sync failed: ${e.message}`);
      return false;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-black border-t-blue-600 rounded-full animate-spin mb-4 mx-auto"></div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">Merchant Protocol Initializing...</p>
        </div>
      </div>
    );
  }

  return (
    <HashRouter>
      <div className="flex flex-col min-h-screen">
        <Header cartCount={cart.reduce((sum, item) => sum + item.quantity, 0)} user={user} logout={() => { setUser(null); localStorage.removeItem('itx_user_session'); }} />
        {isSyncing && <div className="fixed top-20 right-6 z-[1000] animate-pulse"><div className="bg-blue-600 text-white text-[8px] font-black uppercase px-3 py-1 rounded-full shadow-lg">Syncing...</div></div>}
        <main className="flex-grow">
          <Routes>
            <Route path="/" element={<Home products={products} />} />
            <Route path="/product/:id" element={<ProductDetail products={products} addToCart={addToCart} placeOrder={placeOrder} />} />
            <Route path="/cart" element={<CartView cart={cart} updateQuantity={updateQuantity} removeFromCart={removeFromCart} />} />
            <Route path="/checkout" element={<Checkout cart={cart} placeOrder={placeOrder} />} />
            <Route path="/admin/*" element={
              <AdminDashboard 
                products={products} setProducts={setProducts} deleteProduct={deleteProduct} 
                orders={orders} setOrders={() => {}} // parent useMemo handles this now
                user={user} login={(role) => { const u = { id: '1', name: 'Manager', email: 'm@itx.pk', role }; setUser(u); localStorage.setItem('itx_user_session', JSON.stringify(u)); }}
                systemPassword={systemPassword} setSystemPassword={setSystemPassword}
                refreshData={() => { fetchOrders(true); fetchProducts(); }}
                updateStatusOverride={updateStatusOverride}
              />
            } />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/terms-of-service" element={<TermsOfService />} />
            <Route path="/refund-policy" element={<RefundPolicy />} />
            <Route path="/shipping-policy" element={<ShippingPolicy />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </HashRouter>
  );
};

export default App;
