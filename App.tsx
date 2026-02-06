
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
    
    {/* Admin Live Indicator */}
    {user?.role === UserRole.ADMIN && (
      <div className="fixed top-20 left-6 z-[1000] flex items-center space-x-2 bg-white/90 backdrop-blur shadow-sm border border-gray-100 px-3 py-1.5 rounded-full scale-90 md:scale-100 origin-left">
        <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
        <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">{isLive ? 'Live Pulse Active' : 'Connecting...'}</span>
      </div>
    )}

    {isSyncing && (
      <div className="fixed top-20 right-6 z-[1000] animate-pulse">
        <div className="bg-blue-600 text-white text-[8px] font-black uppercase px-3 py-1 rounded-full shadow-lg">Syncing...</div>
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

  const audioContextRef = useRef<AudioContext | null>(null);
  const channelRef = useRef<any>(null);

  // MASTER BACKGROUND PERSISTENCE: Silent Oscillator loop
  const primeEngine = useCallback(() => {
    try {
      if (!audioContextRef.current) {
        const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        g.gain.value = 0.0001; // Silent
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start();
        audioContextRef.current = ctx;
        
        if ('mediaSession' in navigator) {
          navigator.mediaSession.metadata = new MediaMetadata({
            title: 'ITX MASTER PULSE',
            artist: 'BACKGROUND MONITOR ACTIVE',
            album: 'Ready for Orders'
          });
        }
        console.log("ENGINE: Global Pulse Engaged.");
      }
    } catch (e) {}
  }, []);

  // GLOBAL ADMIN REALTIME LISTENER
  const setupGlobalListener = useCallback(() => {
    if (user?.role !== UserRole.ADMIN) return;

    if (channelRef.current) supabase.removeChannel(channelRef.current);

    console.log("ENGINE: Initializing Global Order Watcher...");
    const channel = supabase.channel('global_itx_v100')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
        console.log("ENGINE: Global Inbound Captured.");
        
        // 1. SOUND ALERT
        try {
          const ctx = new ((window as any).AudioContext || (window as any).webkitAudioContext)();
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(440, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
          g.gain.setValueAtTime(0, ctx.currentTime);
          g.gain.linearRampToValueAtTime(0.7, ctx.currentTime + 0.05);
          g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 2.0);
          osc.connect(g); g.connect(ctx.destination);
          osc.start(); osc.stop(ctx.currentTime + 2.0);
        } catch {}

        // 2. SYSTEM NOTIFICATION
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: 'TRIGGER_NOTIFICATION',
            title: '🚨 NEW ORDER RECEIVED!',
            body: `Rs. ${payload.new.total_pkr || payload.new.total} — ${payload.new.customer_name}`,
            orderId: payload.new.order_id || payload.new.id
          });
        }
      })
      .subscribe((status) => {
        setIsLive(status === 'SUBSCRIBED');
      });

    channelRef.current = channel;
  }, [user]);

  useEffect(() => {
    setupGlobalListener();

    // Re-sync on tab focus or network change
    const handleReSync = () => {
      if (document.visibilityState === 'visible' && user?.role === UserRole.ADMIN) {
        setupGlobalListener();
        if (audioContextRef.current) audioContextRef.current.resume();
      }
    };

    window.addEventListener('focus', handleReSync);
    window.addEventListener('online', handleReSync);
    document.addEventListener('visibilitychange', handleReSync);

    return () => {
      window.removeEventListener('focus', handleReSync);
      window.removeEventListener('online', handleReSync);
      document.removeEventListener('visibilitychange', handleReSync);
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [user, setupGlobalListener]);

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(cart));
    localStorage.setItem('itx_cached_products', JSON.stringify(products));
  }, [cart, products]);

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
          category: row.category || 'Luxury',
          inventory: Number(row.inventory || 0),
          rating: Number(row.rating || 5),
          reviews: [],
          variants: Array.isArray(row.variants) ? row.variants : []
        })));
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

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

  const placeOrder = async (order: Order): Promise<boolean> => {
    setIsSyncing(true);
    try {
      const firstItem = order.items[0];
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
        total_pkr: Math.round(Number(order.total) || 0),
        status: 'pending',
        items: order.items,
        source: 'Web App'
      };
      const { error } = await supabase.from('orders').insert([payload]);
      if (error) throw error;
      setCart([]);
      return true;
    } catch (e: any) {
      return false;
    } finally {
      setIsSyncing(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="w-8 h-8 border-2 border-black/5 border-t-black rounded-full animate-spin"></div>
    </div>
  );

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <Suspense fallback={null}>
      <MainLayout cartCount={cartCount} user={user} logout={() => { setUser(null); localStorage.removeItem('itx_user_session'); }} isSyncing={isSyncing} isLive={isLive}>
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
