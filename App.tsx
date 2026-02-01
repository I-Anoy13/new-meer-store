
import React, { useState, useEffect, useCallback } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { CartItem, Product, Order, User, UserRole } from './types';
import { MOCK_PRODUCTS } from './constants';
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
  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem('products');
    return saved ? JSON.parse(saved) : MOCK_PRODUCTS;
  });

  const [cart, setCart] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem('cart');
    return saved ? JSON.parse(saved) : [];
  });

  const [orders, setOrders] = useState<Order[]>(() => {
    const saved = localStorage.getItem('orders');
    return saved ? JSON.parse(saved) : [];
  });

  const [systemPassword, setSystemPassword] = useState<string>(() => {
    return localStorage.getItem('systemPassword') || 'admin123';
  });

  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    localStorage.setItem('products', JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem('orders', JSON.stringify(orders));
  }, [orders]);

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

  const deleteProduct = useCallback((productId: string) => {
    setProducts(prev => prev.filter(p => p.id !== productId));
  }, []);

  const clearCart = () => setCart([]);

  const placeOrder = (order: Order) => {
    setOrders(prev => [order, ...prev]);
    clearCart();
  };

  const login = (role: UserRole) => {
    setUser({ id: '1', name: 'Store Manager', email: 'manager@elitehorology.pk', role });
  };

  const logout = () => setUser(null);

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
                setProducts={setProducts} 
                deleteProduct={deleteProduct} 
                orders={orders} 
                setOrders={setOrders} 
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
