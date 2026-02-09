
import React, { useState, useEffect, useCallback, Suspense } from 'react';
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

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'info' | 'error';
}

const MainLayout: React.FC<{
  children: React.ReactNode;
  cartCount: number;
  user: User | null;
  logout: () => void;
  toasts: Toast[];
  removeToast: (id: number) => void;
}> = ({ children, cartCount, user, logout, toasts, removeToast }) => (
  <div className="flex flex-col min-h-screen bg-white">
    <Header cartCount={cartCount} user={user} logout={logout} />
    <main className="flex-grow">{children}</main>
    
    {/* Toast Notifications */}
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[1000] flex flex-col items-center space-y-3 pointer-events-none">
      {toasts.map((toast) => (
        <div 
          key={toast.id}
          className="bg-black text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center space-x-3 animate-fadeIn pointer-events-auto border border-white/10 min-w-[280px]"
        >
          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
            toast.type === 'success' ? 'bg-green-500' : toast.type === 'error' ? 'bg-red-500' : 'bg-blue-600'
          }`}>
            <i className={`fas ${
              toast.type === 'success' ? 'fa-check' : toast.type === 'error' ? 'fa-exclamation-triangle' : 'fa-info'
            } text-[10px]`}></i>
          </div>
          <div className="flex-grow">
            <p className="text-[10px] font-black uppercase tracking-widest italic">{toast.message}</p>
          </div>
          <button onClick={() => removeToast(toast.id)} className="text-white/40 hover:text-white transition p-2">
            <i className="fas fa-times text-[10px]"></i>
          </button>
          <div className="absolute bottom-0 left-0 h-0.5 bg-blue-600 animate-progress w-full"></div>
        </div>
      ))}
    </div>

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
  const [cart, setCart] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem('cart');
    return saved ? JSON.parse(saved) : [];
  });

  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('itx_user_session');
    return saved ? JSON.parse(saved) : null;
  });

  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      removeToast(id);
    }, 4000);
  };

  const removeToast = (id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const fetchProducts = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('products').select('*');
      if (!error && data) {
        setProducts(data.map(row => ({
          id: String(row.id),
          name: row.name,
          description: row.description || '',
          price: Number(row.price_pkr || row.price || 0),
          image: row.image || row.image_url || 'https://via.placeholder.com/800x1000',
          images: Array.isArray(row.images) ? row.images : (row.image ? [row.image] : []),
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
    addToast('Item added to your bag', 'success');
  };

  const removeFromCart = (productId: string, variantId?: string) => {
    setCart(prev => prev.filter(item => !(item.product.id === productId && item.variantId === variantId)));
    addToast('Item removed from bag', 'info');
  };

  const updateQuantity = (productId: string, quantity: number, variantId?: string) => {
    if (quantity <= 0) return removeFromCart(productId, variantId);
    setCart(prev => prev.map(item => item.product.id === productId && item.variantId === variantId ? { ...item, quantity } : item));
  };

  const placeOrder = async (order: Order): Promise<boolean> => {
    try {
      const firstItem = order.items[0];
      const roundedTotal = Math.round(Number(order.total) || 0);
      
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
        total_pkr: roundedTotal,
        subtotal_pkr: roundedTotal,
        status: 'pending',
        items: JSON.stringify(order.items),
        created_at: new Date().toISOString()
      };

      const { error } = await supabase.from('orders').insert([payload]);
      if (error) {
        console.error("Database Insert Error:", error.message);
        throw error;
      }

      setCart([]);
      localStorage.removeItem('cart');
      addToast('Order placed successfully!', 'success');
      return true;
    } catch (err) {
      console.error("[CRITICAL] Order Placement Failed:", err);
      addToast('Failed to place order. Try again.', 'error');
      return false;
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="w-8 h-8 border-2 border-black/5 border-t-black rounded-full animate-spin"></div>
    </div>
  );

  return (
    <Suspense fallback={null}>
      <MainLayout 
        cartCount={cart.reduce((sum, item) => sum + item.quantity, 0)} 
        user={user} 
        logout={() => { setUser(null); localStorage.removeItem('itx_user_session'); }}
        toasts={toasts}
        removeToast={removeToast}
      >
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
