
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
  const [isSyncing, setIsSyncing] = useState(false);

  // Source of Truth: Local Status Overrides
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

  // Save overrides to storage whenever they change
  useEffect(() => {
    localStorage.setItem('itx_status_overrides', JSON.stringify(statusOverrides));
  }, [statusOverrides]);

  const updateStatusOverride = (orderId: string, status: Order['status']) => {
    setStatusOverrides(prev => ({ ...prev, [orderId]: status }));
  };

  const fetchProducts = useCallback(async () => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.from('products').select('*');
      if (error) throw error;
      if (data) {
        const mappedProducts: Product[] = data.map(row => ({
          id: String(row.id),
          name: row.name || 'Untitled Item',
          description: row.description || '',
          price: Number(row.price_pkr || row.price || 0),
          image: row.image || row.image_url || 'https://via.placeholder.com/800x1000',
          video: row.video || '',
          category: row.category || 'Luxury',
          inventory: Number(row.inventory || row.stock || 0),
          rating: Number(row.rating || 5),
          reviews: Array.isArray(row.reviews) ? row.reviews : [],
          variants: Array.isArray(row.variants) ? row.variants : []
        }));
        setProducts(mappedProducts);
      }
    } catch (error) {
      console.warn('Sync Products Error:', error);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const fetchOrders = useCallback(async () => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      if (data) {
        const mappedOrders: Order[] = data.map(row => {
          const orderId = row.order_id || `ORD-${row.id}`;
          
          // CRITICAL: HARD OVERRIDE Logic
          // We prioritize statusOverrides from LocalStorage above all else
          const dbStatusRaw = String(row.status || 'Pending').toLowerCase();
          const dbStatus = (dbStatusRaw.charAt(0).toUpperCase() + dbStatusRaw.slice(1)) as Order['status'];
          
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
        setOrders(mappedOrders);
      }
    } catch (error) {
      console.warn('Sync Orders Error:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [statusOverrides]);

  useEffect(() => {
    const channel = supabase
      .channel('realtime-orders')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          // Silent re-fetch, statusOverrides will handle the UI consistency
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchOrders]);

  useEffect(() => {
    let mounted = true;
    const initData = async () => {
      setLoading(true);
      try {
        await Promise.all([fetchProducts(), fetchOrders()]);
      } catch (e) {
        console.error('Data init error:', e);
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

  const deleteProduct = useCallback(async (productId: string) => {
    const { error } = await supabase.from('products').delete().eq('id', productId);
    if (!error) {
      setProducts(prev => prev.filter(p => p.id !== productId));
    }
  }, []);

  const clearCart = () => setCart([]);

  const placeOrder = async (order: Order): Promise<boolean> => {
    try {
      const firstItem = order.items[0];
      const dbPayload = {
        order_id: order.id,
        customer_name: order.customer.name,
        customer_phone: order.customer.phone,
        customer_city: order.customer.city || 'N/A',
        customer_address: order.customer.address,
        product_id: String(firstItem?.product.id || 'N/A'),
        product_name: firstItem?.product.name || 'N/A',
        product_price: firstItem?.product.price || 0,
        product_image: firstItem?.product.image || '',
        subtotal_pkr: Math.round(order.total),
        shipping_pkr: 0,
        total_pkr: Math.round(order.total),
        status: order.status.toLowerCase(),
        payment_method: 'cod',
        items: JSON.parse(JSON.stringify(order.items)),
        source: 'Web App'
      };

      const { error } = await supabase.from('orders').insert([dbPayload]);
      if (error) throw error;

      await fetchOrders();
      clearCart();
      return true;
    } catch (e: any) {
      console.error('Order Error:', e.message);
      alert(`Order sync failed: ${e.message}`);
      return false;
    }
  };

  const login = (role: UserRole) => {
    const newUser = { id: '1', name: 'Store Manager', email: 'manager@itxshop.pk', role };
    setUser(newUser);
    localStorage.setItem('itx_user_session', JSON.stringify(newUser));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('itx_user_session');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-black border-t-blue-600 rounded-full animate-spin mb-4 mx-auto"></div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">Securely loading store data...</p>
        </div>
      </div>
    );
  }

  return (
    <HashRouter>
      <div className="flex flex-col min-h-screen">
        <Header cartCount={cart.reduce((sum, item) => sum + item.quantity, 0)} user={user} logout={logout} />
        
        {isSyncing && (
          <div className="fixed top-20 right-6 z-[1000] animate-pulse">
            <div className="bg-blue-600 text-white text-[8px] font-black uppercase px-3 py-1 rounded-full shadow-lg flex items-center">
              <i className="fas fa-sync fa-spin mr-2"></i> Syncing Data
            </div>
          </div>
        )}

        <main className="flex-grow">
          <Routes>
            <Route path="/" element={<Home products={products} />} />
            <Route path="/product/:id" element={<ProductDetail products={products} addToCart={addToCart} placeOrder={placeOrder} />} />
            <Route path="/cart" element={<CartView cart={cart} updateQuantity={updateQuantity} removeFromCart={removeFromCart} />} />
            <Route path="/checkout" element={<Checkout cart={cart} placeOrder={placeOrder} />} />
            <Route path="/admin/*" element={
              <AdminDashboard 
                products={products} 
                setProducts={setProducts} 
                deleteProduct={deleteProduct} 
                orders={orders} 
                setOrders={setOrders} 
                user={user} 
                login={login}
                systemPassword={systemPassword}
                setSystemPassword={setSystemPassword}
                refreshData={() => { fetchOrders(); fetchProducts(); }}
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
