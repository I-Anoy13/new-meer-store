
import React, { useState, useEffect, useCallback, Suspense, useRef } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
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
import AIConcierge from './components/AIConcierge';

const MainLayout: React.FC<{
  children: React.ReactNode;
  cartCount: number;
  user: User | null;
  logout: () => void;
  isSyncing: boolean;
  isLive: boolean;
}> = ({ children, cartCount, user, logout, isSyncing, isLive }) => (
  <div className="flex flex-col min-h-screen">
    <Header cartCount={cartCount} user={user} logout={logout} />
    
    {user?.role === UserRole.ADMIN && (
      <div className="fixed top-20 left-6 z-[1000] flex items-center space-x-2 bg-white/90 backdrop-blur shadow-sm border border-gray-100 px-3 py-1.5 rounded-full scale-90 md:scale-100 origin-left transition-all duration-500">
        <div className={`w-2 h-2 rounded-full transition-colors duration-500 ${isLive ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
        <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">
          {isLive ? 'Master Link Active' : 'Relay Disconnected'}
        </span>
      </div>
    )}

    {isSyncing && (
      <div className="fixed top-20 right-6 z-[1000] animate-pulse">
        <div className="bg-blue-600 text-white text-[8px] font-black uppercase px-3 py-1 rounded-full shadow-lg italic">Signal Sent!</div>
      </div>
    )}
    <main className="flex-grow">{children}</main>
    <AIConcierge />
    <Footer />
  </div>
);

const AppContent: React.FC = () => {
  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem('itx_cached_products');
    return saved ? JSON.parse(saved) : MOCK_PRODUCTS;
  });
  
  const [loading, setLoading] = useState(products.length === 0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [cart, setCart] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem('cart');
    return saved ? JSON.parse(saved) : [];
  });

  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('itx_user_session');
    return saved ? JSON.parse(saved) : null;
  });

  const presenceChannelRef = useRef<any>(null);

  const setupActivePresence = useCallback(async () => {
    if (presenceChannelRef.current) {
      supabase.removeChannel(presenceChannelRef.current);
    }

    // ACTIVE PRESENCE: Allows the Admin to see exactly who is on the site
    const channel = supabase.channel('itx_active_sessions_v3', {
      config: { presence: { key: 'visitor' } }
    });

    channel.subscribe(async (status) => {
      setIsLive(status === 'SUBSCRIBED');
      if (status === 'SUBSCRIBED') {
        const userCity = await fetch('https://ipapi.co/json/').then(r => r.json()).then(d => d.city).catch(() => 'Unknown');
        channel.track({
          online_at: new Date().toISOString(),
          city: userCity,
          role: user?.role || 'CUSTOMER',
          last_view: window.location.hash
        });
      }
    });

    presenceChannelRef.current = channel;
  }, [user]);

  useEffect(() => {
    setupActivePresence();
    const handleReSync = () => { if (document.visibilityState === 'visible') setupActivePresence(); };
    window.addEventListener('focus', handleReSync);
    return () => {
      window.removeEventListener('focus', handleReSync);
      if (presenceChannelRef.current) supabase.removeChannel(presenceChannelRef.current);
    };
  }, [setupActivePresence]);

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
          reviews: [],
          variants: Array.isArray(row.variants) ? row.variants : []
        })));
      }
    } catch (e) {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const addToCart = (product: Product, quantity: number = 1, variantId?: string) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id && item.variantId === variantId);
      if (existing) return prev.map(item => item.product.id === product.id && item.variantId === variantId ? { ...item, quantity: item.quantity + quantity } : item);
      return [...prev, { product, quantity, variantId, variantName: product.variants?.find(v => v.id === variantId)?.name || 'Standard' }];
    });
  };

  const removeFromCart = (productId: string, variantId?: string) => setCart(prev => prev.filter(item => !(item.product.id === productId && item.variantId === variantId)));
  const updateQuantity = (productId: string, quantity: number, variantId?: string) => {
    if (quantity <= 0) return removeFromCart(productId, variantId);
    setCart(prev => prev.map(item => item.product.id === productId && item.variantId === variantId ? { ...item, quantity } : item));
  };

  const placeOrder = async (order: Order): Promise<boolean> => {
    setIsSyncing(true);
    const orderId = order.id;
    const firstItem = order.items[0];
    const payload = {
      order_id: orderId,
      customer_name: order.customer.name,
      customer_phone: order.customer.phone,
      customer_city: order.customer.city || 'N/A',
      customer_address: order.customer.address,
      product_id: String(firstItem?.product.id || 'N/A'),
      product_name: firstItem?.product.name || 'N/A',
      product_price: Number(firstItem?.product.price || 0),
      product_image: firstItem?.product.image || '',
      total_pkr: Math.round(Number(order.total) || 0),
      status: 'pending',
      items: order.items,
      source: 'ITX_ACTIVE_TRANS_V5'
    };

    // Broadcast Activity to Admin
    if (presenceChannelRef.current) {
      presenceChannelRef.current.send({
        type: 'broadcast',
        event: 'activity',
        payload: { type: 'ORDER_PLACED', name: order.customer.name }
      });
    }

    const { error } = await supabase.from('orders').insert([payload]);
    if (error) {
       console.error("Order Fail:", error);
       setIsSyncing(false);
       return false;
    }

    setCart([]);
    await new Promise(r => setTimeout(r, 600));
    setIsSyncing(false);
    return true;
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="w-8 h-8 border-2 border-black/5 border-t-black rounded-full animate-spin"></div>
    </div>
  );

  return (
    <Suspense fallback={null}>
      <MainLayout cartCount={cart.reduce((sum, item) => sum + item.quantity, 0)} user={user} logout={() => { setUser(null); localStorage.removeItem('itx_user_session'); }} isSyncing={isSyncing} isLive={isLive}>
        <Routes>
          <Route path="/" element={<Home products={products} />} />
          <Route path="/product/:id" element={<ProductDetail products={products} addToCart={addToCart} placeOrder={placeOrder} />} />
          <Route path="/cart" element={<CartView cart={cart} updateQuantity={updateQuantity} removeFromCart={removeFromCart} />} />
          <Route path="/checkout" element={<Checkout cart={cart} placeOrder={placeOrder} />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/terms-of-service" element={<TermsOfService />} />
          <Route path="/refund-policy" element={<RefundPolicy />} />
          <Route path="/shipping-policy" element={<ShippingPolicy />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </MainLayout>
    </Suspense>
  );
};

const App: React.FC = () => (
  <HashRouter>
    <AppContent />
  </HashRouter>
);

export default App;
