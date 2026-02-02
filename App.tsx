
import React, { useState, useEffect, useCallback } from 'react';
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
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const [cart, setCart] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem('cart');
    return saved ? JSON.parse(saved) : [];
  });

  const [systemPassword, setSystemPassword] = useState<string>(() => {
    return localStorage.getItem('systemPassword') || 'admin123';
  });

  const [user, setUser] = useState<User | null>(null);

  // Sync Products from Supabase
  const fetchProducts = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('products').select('*');
      if (error) throw error;
      if (data && data.length > 0) {
        setProducts(data);
      }
    } catch (error) {
      console.warn('Using local product vault (Supabase unreachable)');
    }
  }, []);

  // Sync Orders from Supabase
  const fetchOrders = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('date', { ascending: false });
      if (error) throw error;
      if (data) {
        setOrders(data);
      }
    } catch (error) {
      console.warn('Could not sync order ledger from Supabase');
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const initData = async () => {
      setLoading(true);
      
      // Attempt to fetch, but don't let it block the app for more than 4 seconds
      const timeoutPromise = new Promise(resolve => setTimeout(resolve, 4000));
      
      try {
        await Promise.race([
          Promise.all([fetchProducts(), fetchOrders()]),
          timeoutPromise
        ]);
      } catch (e) {
        console.error('Data initialization encountered an error:', e);
      }

      if (mounted) setLoading(false);
    };

    initData();
    return () => { mounted = false; };
  }, [fetchProducts, fetchOrders]);

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    localStorage.setItem('systemPassword', systemPassword);
  }, [systemPassword]);

  const addToCart = (product: Product, quantity: number = 1, variantId?: string) => {
    const variant = product.variants?.find(v => v.id === variantId);
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id && item.variantId === variantId);
      if (existing) {
        return prev.map(item => 
          item.product.id === product.id && item.variantId === variantId 
            ? { ...item, quantity: item.quantity + quantity } 
            : item
        );
      }
      return [...prev, { product, quantity, variantId, variantName: variant?.name || 'Standard' }];
    });
  };

  const removeFromCart = (productId: string, variantId?: string) => {
    setCart(prev => prev.filter(item => !(item.product.id === productId && item.variantId === variantId)));
  };

  const updateQuantity = (productId: string, quantity: number, variantId?: string) => {
    if (quantity <= 0) {
      removeFromCart(productId, variantId);
      return;
    }
    setCart(prev => prev.map(item => 
      item.product.id === productId && item.variantId === variantId 
        ? { ...item, quantity } 
        : item
    ));
  };

  const handleSetProducts = (newProductsAction: React.SetStateAction<Product[]>) => {
    setProducts(newProductsAction);
  };

  const deleteProduct = useCallback(async (productId: string) => {
    const { error } = await supabase.from('products').delete().eq('id', productId);
    if (!error) {
      setProducts(prev => prev.filter(p => p.id !== productId));
    }
  }, []);

  const clearCart = () => setCart([]);

  const placeOrder = async (order: Order) => {
    try {
      const { error } = await supabase.from('orders').insert([order]);
      if (error) throw error;
    } catch (e) {
      console.error('Failed to save order to database:', e);
    }
    setOrders(prev => [order, ...prev]);
    clearCart();
  };

  const handleUpdateOrders = (newOrdersAction: React.SetStateAction<Order[]>) => {
    setOrders(newOrdersAction);
  };

  const login = (role: UserRole) => {
    setUser({ id: '1', name: 'Store Manager', email: 'manager@elitehorology.pk', role });
  };

  const logout = () => setUser(null);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-black border-t-blue-600 rounded-full animate-spin mb-4 mx-auto"></div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">Loading ITX Vault...</p>
        </div>
      </div>
    );
  }

  return (
    <HashRouter>
      <div className="flex flex-col min-h-screen">
        <Header cartCount={cart.reduce((sum, item) => sum + item.quantity, 0)} user={user} logout={logout} />
        
        <main className="flex-grow">
          <Routes>
            <Route path="/" element={<Home products={products} />} />
            <Route path="/product/:id" element={<ProductDetail products={products} addToCart={addToCart} placeOrder={placeOrder} />} />
            <Route path="/cart" element={<CartView cart={cart} updateQuantity={updateQuantity} removeFromCart={removeFromCart} />} />
            <Route path="/checkout" element={<Checkout cart={cart} placeOrder={placeOrder} />} />
            <Route path="/admin/*" element={
              <AdminDashboard 
                products={products} 
                setProducts={handleSetProducts} 
                deleteProduct={deleteProduct} 
                orders={orders} 
                setOrders={handleUpdateOrders} 
                user={user} 
                login={login}
                systemPassword={systemPassword}
                setSystemPassword={setSystemPassword}
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
