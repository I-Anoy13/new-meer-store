
import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { CartItem, Product, Order, User } from './types';
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

const AppContent: React.FC = () => {
  const [products, setProducts] = useState<Product[]>(MOCK_PRODUCTS);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  const [cart, setCart] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem('cart');
    return saved ? JSON.parse(saved) : [];
  });

  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('itx_user_session');
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(cart));
  }, [cart]);

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

  useEffect(() => {
    let mounted = true;
    const initData = async () => {
      try {
        await fetchProducts();
      } finally {
        if (mounted) setLoading(false);
      }
    };
    initData();
    return () => { mounted = false; };
  }, [fetchProducts]);

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
      setCart([]);
      return true;
    } catch (e: any) {
      console.error("Order Failure:", e);
      return false;
    } finally {
      setIsSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-black border-t-blue-600 rounded-full animate-spin mb-4 mx-auto"></div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">Loading ITX Store...</p>
        </div>
      </div>
    );
  }

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <Suspense fallback={null}>
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
    </Suspense>
  );
};

const App: React.FC = () => (
  <HashRouter>
    <AppContent />
  </HashRouter>
);

export default App;
