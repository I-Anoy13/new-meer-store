
import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { HashRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { CartItem, Product, Order, User, UserRole } from './types';
import { MOCK_PRODUCTS } from './constants';
import { supabase } from './lib/supabase';
import Home from './views/Home';
import ProductDetail from './views/ProductDetail';
import CartView from './views/CartView';
import Checkout from './views/Checkout';
import PrivacyPolicy from './views/PrivacyPolicy';
import TermsOfService from './views/TermsOfService';
import RefundPolicy from './views/RefundPolicy';
import ShippingPolicy from './views/ShippingPolicy';
import Header from './components/Header';
import Footer from './components/Footer';
import AdminDashboard from './views/AdminDashboard';

// Helper component to track and restore last route for PWA users
const SessionRestorer: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [hasRestored, setHasRestored] = useState(false);

  useEffect(() => {
    // On mount, if we are at root and have a saved route, restore it
    const isPWA = window.matchMedia('(display-mode: standalone)').matches;
    if (!hasRestored && isPWA && location.pathname === '/') {
      const savedRoute = localStorage.getItem('itx_last_route');
      if (savedRoute && savedRoute !== '/') {
        navigate(savedRoute);
      }
    }
    setHasRestored(true);
  }, [hasRestored, location, navigate]);

  useEffect(() => {
    // Save current route whenever it changes (if it's an admin route or home)
    if (location.pathname.startsWith('/admin') || location.pathname === '/') {
      localStorage.setItem('itx_last_route', location.pathname + location.search + location.hash);
    }
  }, [location]);

  return null;
};

const MainLayout: React.FC<{
  children: React.ReactNode;
  cartCount: number;
  user: User | null;
  logout: () => void;
  isSyncing: boolean;
}> = ({ children, cartCount, user, logout, isSyncing }) => (
  <div className="flex flex-col min-h-screen">
    <Header cartCount={cartCount} user={user} logout={logout} />
    {isSyncing && (
      <div className="fixed top-20 right-6 z-[1000] animate-pulse">
        <div className="bg-blue-600 text-white text-[8px] font-black uppercase px-3 py-1 rounded-full shadow-lg">Cloud Syncing...</div>
      </div>
    )}
    <main className="flex-grow">{children}</main>
    <Footer />
  </div>
);

const App: React.FC = () => {
  const [products, setProducts] = useState<Product[]>(MOCK_PRODUCTS);
  const [rawOrders, setRawOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

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
      if (error) throw error;
      if (data) {
        setProducts(data.map(row => ({
          id: String(row.id),
          name: row.name || 'Untitled Item',
          description: row.description || '',
          price: Number(row.price_pkr || row.price || 0),
          image: row.image || row.image_url || 'https://via.placeholder.com/800x1000',
          images: Array.isArray(row.features) ? row.features : (row.image ? [row.image] : []),
          category: row.category || 'Luxury',
          inventory: Number(row.inventory || 0),
          rating: Number(row.rating || 5),
          reviews: Array.isArray(row.reviews) ? row.reviews : [],
          variants: Array.isArray(row.variants) ? row.variants : []
        })));
      }
    } catch (e) {
      console.error("Product Sync Failure:", e);
    }
  }, []);

  const fetchOrders = useCallback(async (silent = false) => {
    if (!silent) setIsSyncing(true);
    try {
      const { data, error } = await supabase.from('orders').select('*');
      if (error) throw error;
      if (data) {
        const sortedData = [...data].sort((a, b) => {
          const dateA = new Date(a.created_at || a.date || 0).getTime();
          const dateB = new Date(b.created_at || b.date || 0).getTime();
          return dateB - dateA;
        });
        setRawOrders(sortedData);
      }
    } catch (e) {
      console.error("Order Sync Failure:", e);
    } finally {
      if (!silent) setIsSyncing(false);
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
      try {
        await Promise.allSettled([fetchProducts(), fetchOrders(true)]);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    initData();
    return () => { mounted = false; };
  }, [fetchProducts, fetchOrders]);

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
      const totalAmount = Math.round(Number(order.total) || 0);
      const payload = {
        order_id: order.id,
        customer_name: order.customer.name,
        customer_phone: order.customer.phone,
        customer_city: order.customer.city || 'N/A',
        customer_address: order.customer.address,
        product_id: String(firstItem?.product.id || 'N/A'),
        product_name: firstItem?.product.name || 'N/A',
        product_price: Number(firstItem?.product.price || 0),
        product_image: firstItem?.product.image || '',
        total_pkr: totalAmount,
        subtotal_pkr: totalAmount,
        status: order.status.toLowerCase(),
        items: order.items,
        source: 'Web App'
      };
      const { error } = await supabase.from('orders').insert([payload]);
      if (error) throw error;
      await fetchOrders(true);
      setCart([]);
      return true;
    } catch (e: any) {
      console.error("Order Failure:", e);
      return false;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-black border-t-blue-600 rounded-full animate-spin mb-4 mx-auto"></div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">Booting ITX Core...</p>
        </div>
      </div>
    );
  }

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <HashRouter>
      <SessionRestorer />
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center bg-white">
          <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
        </div>
      }>
        <Routes>
          {/* Admin Route - No main layout */}
          <Route path="/admin/*" element={
            <AdminDashboard 
              products={products} setProducts={setProducts} deleteProduct={deleteProduct} 
              orders={orders} setOrders={() => {}} 
              user={user} login={(role) => { const u = { id: '1', name: 'Manager', email: 'm@itx.pk', role }; setUser(u); localStorage.setItem('itx_user_session', JSON.stringify(u)); }}
              systemPassword={systemPassword} setSystemPassword={setSystemPassword}
              refreshData={() => { fetchOrders(); fetchProducts(); }}
              updateStatusOverride={updateStatusOverride}
            />
          } />

          {/* Customer Routes - With main layout */}
          <Route path="/*" element={
            <MainLayout cartCount={cartCount} user={user} logout={() => { setUser(null); localStorage.removeItem('itx_user_session'); }} isSyncing={isSyncing}>
              <Routes>
                <Route path="/" element={<Home products={products} />} />
                <Route path="/product/:id" element={<ProductDetail products={products} addToCart={addToCart} placeOrder={placeOrder} />} />
                <Route path="/cart" element={<CartView cart={cart} updateQuantity={updateQuantity} removeFromCart={removeFromCart} />} />
                <Route path="/checkout" element={<Checkout cart={cart} placeOrder={placeOrder} />} />
                <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                <Route path="/terms-of-service" element={<TermsOfService />} />
                <Route path="/refund-policy" element={<RefundPolicy />} />
                <Route path="/shipping-policy" element={<ShippingPolicy />} />
              </Routes>
            </MainLayout>
          } />
        </Routes>
      </Suspense>
    </HashRouter>
  );
};

export default App;
