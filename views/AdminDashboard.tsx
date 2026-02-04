import React, { useState, useEffect, useCallback } from 'react';
import { Product, Order, User, UserRole } from '../types';
import { supabase } from '../lib/supabase';

export interface AdminDashboardProps {
  products: Product[];
  setProducts: (action: React.SetStateAction<Product[]>) => void;
  deleteProduct: (productId: string) => void;
  orders: Order[];
  setOrders: (newRawOrder: any) => void;
  user: User | null;
  login: (role: UserRole) => void;
  systemPassword: string;
  setSystemPassword: (pwd: string) => void;
  refreshData: () => void;
  updateStatusOverride?: (orderId: string, status: Order['status']) => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({
  products,
  deleteProduct,
  orders,
  setOrders,
  user,
  login,
  systemPassword,
  setSystemPassword,
  refreshData,
  updateStatusOverride
}) => {
  const [activeTab, setActiveTab] = useState<'orders' | 'products' | 'settings'>('orders');
  const [loginInput, setLoginInput] = useState('');
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [toasts, setToasts] = useState<{ id: string; message: string }[]>([]);
  const [newProduct, setNewProduct] = useState<Partial<Product>>({
    name: '',
    price: 0,
    description: '',
    image: '',
    category: 'Luxury',
    inventory: 10
  });

  // Synthesize a notification sound via Web Audio API (No strings/files needed)
  const playChime = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const playTone = (freq: number, start: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.1, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + duration);
      };
      playTone(880, ctx.currentTime, 0.4);
      playTone(1108.73, ctx.currentTime + 0.1, 0.5);
    } catch (e) {
      console.warn("Audio blocked: user interaction required.");
    }
  }, []);

  const addToast = useCallback((msg: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message: msg }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  // Listen for incoming orders in real-time via Supabase
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('admin_order_stream')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
        setOrders(payload.new);
        addToast(`New Order Received: ${payload.new.customer_name || 'Anonymous'}`);
        playChime();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, setOrders, playChime, addToast]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginInput === systemPassword) {
      login(UserRole.ADMIN);
    } else {
      alert('Unauthorized Access Key');
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: newProduct.name,
      price_pkr: newProduct.price,
      description: newProduct.description,
      image: newProduct.image,
      category: newProduct.category,
      inventory: newProduct.inventory,
      rating: 5,
      features: [newProduct.image]
    };
    const { data, error } = await supabase.from('products').insert([payload]).select();
    if (!error && data) {
      refreshData();
      setIsAddingProduct(false);
      setNewProduct({ name: '', price: 0, description: '', image: '', category: 'Luxury', inventory: 10 });
      addToast("Product added to catalog");
    } else {
      alert('Failed to add product');
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-3xl p-10 shadow-2xl border border-gray-100 text-center">
          <h1 className="text-2xl font-black italic uppercase tracking-tighter mb-2">ITX <span className="text-blue-600">CONSOLE</span></h1>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-8">Management Terminal</p>
          <form onSubmit={handleLogin} className="space-y-4">
            <input 
              type="password" 
              value={loginInput}
              onChange={(e) => setLoginInput(e.target.value)}
              placeholder="System Access Key" 
              className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <button type="submit" className="w-full bg-black text-white py-4 rounded-2xl font-bold uppercase text-xs tracking-widest hover:bg-blue-600 transition shadow-lg">
              Authenticate
            </button>
          </form>
          <a href="/" className="mt-8 block text-[10px] font-bold uppercase text-gray-300 hover:text-black transition">Back to Storefront</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-black font-sans pb-24">
      <div className="fixed top-6 right-6 z-[100] space-y-3 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="bg-black text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center space-x-4 animate-fadeIn border border-white/10 pointer-events-auto">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
            <span className="text-[10px] font-bold uppercase tracking-widest">{t.message}</span>
          </div>
        ))}
      </div>

      <header className="border-b border-gray-100 sticky top-0 bg-white/90 backdrop-blur-md z-40">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-10">
            <h2 className="text-lg font-black italic uppercase tracking-tighter">ITX <span className="text-blue-600">CMS</span></h2>
            <nav className="flex space-x-8">
              {['orders', 'products', 'settings'].map((tab) => (
                <button 
                  key={tab}
                  onClick={() => setActiveTab(tab as any)} 
                  className={`text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === tab ? 'text-blue-600 border-b-2 border-blue-600 pb-1' : 'text-gray-400 hover:text-black'}`}
                >
                  {tab}
                </button>
              ))}
            </nav>
          </div>
          <button onClick={() => { refreshData(); playChime(); }} className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 hover:text-blue-600 transition">
            <i className="fas fa-sync-alt text-xs"></i>
          </button>
        </div>
      </header>

      <main className="container mx-auto px-6 py-10">
        {activeTab === 'orders' && (
          <div className="animate-fadeIn">
            <h1 className="text-2xl font-bold uppercase tracking-tight italic mb-10">Live Order Feed</h1>
            <div className="grid grid-cols-1 gap-6">
              {orders.length === 0 ? (
                <div className="py-20 text-center border-2 border-dashed border-gray-100 rounded-3xl text-gray-300 uppercase text-[10px] font-bold tracking-widest">
                  Awaiting first order...
                </div>
              ) : orders.map((order) => (
                <div key={order.id} className="bg-white border border-gray-100 rounded-3xl p-8 hover:shadow-2xl transition-all border-l-4 border-l-blue-600">
                  <div className="flex flex-col md:flex-row justify-between gap-6">
                    <div className="space-y-4">
                      <div className="flex items-center space-x-4">
                        <span className="text-sm font-black text-black">#{order.id}</span>
                        <span className={`text-[9px] font-bold uppercase px-3 py-1 rounded-full ${
                          order.status === 'Delivered' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'
                        }`}>{order.status}</span>
                      </div>
                      <div className="text-xs font-bold text-gray-500 uppercase">
                        {order.customer.name} • <a href={`tel:${order.customer.phone}`} className="text-blue-600">{order.customer.phone}</a>
                        <p className="mt-2 text-black lowercase first-letter:uppercase">{order.customer.address}, {order.customer.city}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-6">
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Total Amount</p>
                        <p className="text-lg font-black text-black">Rs. {order.total.toLocaleString()}</p>
                      </div>
                      <select 
                        value={order.status}
                        onChange={(e) => updateStatusOverride?.(order.id, e.target.value as any)}
                        className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-[10px] font-bold uppercase focus:ring-2 focus:ring-blue-600 outline-none"
                      >
                        <option value="Pending">Pending</option>
                        <option value="Confirmed">Confirmed</option>
                        <option value="Shipped">Shipped</option>
                        <option value="Delivered">Delivered</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'products' && (
          <div className="animate-fadeIn">
            <div className="flex justify-between items-center mb-10">
              <h1 className="text-2xl font-bold uppercase tracking-tight italic">Product Catalog</h1>
              <button onClick={() => setIsAddingProduct(true)} className="bg-black text-white px-8 py-4 rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-blue-600 transition shadow-xl">
                Create New <i className="fas fa-plus ml-2"></i>
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {products.map(p => (
                <div key={p.id} className="bg-white border border-gray-100 rounded-3xl overflow-hidden hover:shadow-xl transition-all group">
                  <div className="aspect-[4/3] relative">
                    <img src={p.image} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    <button onClick={() => deleteProduct(p.id)} className="absolute top-4 right-4 w-10 h-10 bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-lg">
                      <i className="fas fa-trash-alt text-xs"></i>
                    </button>
                  </div>
                  <div className="p-6">
                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">{p.category}</p>
                    <h4 className="text-sm font-bold uppercase text-black">{p.name}</h4>
                    <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-50">
                      <span className="text-blue-600 font-black">Rs. {p.price.toLocaleString()}</span>
                      <span className="text-[10px] font-bold text-gray-400">Stock: {p.inventory}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="animate-fadeIn max-w-lg">
            <h1 className="text-2xl font-bold uppercase tracking-tight italic mb-10">System Preferences</h1>
            <div className="bg-gray-50 rounded-3xl p-8 border border-gray-100">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">Master Access Key</label>
              <div className="flex space-x-3">
                <input 
                  type="text" 
                  value={systemPassword}
                  onChange={(e) => setSystemPassword(e.target.value)}
                  className="flex-grow bg-white border border-gray-200 rounded-2xl px-6 py-4 font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button 
                  onClick={() => {
                    localStorage.setItem('systemPassword', systemPassword);
                    addToast('System Key Synchronized');
                  }}
                  className="bg-black text-white px-8 py-4 rounded-2xl font-bold uppercase text-[10px] tracking-widest hover:bg-blue-600 transition"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {isAddingProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl p-10 w-full max-w-md animate-fadeIn shadow-2xl relative">
            <button onClick={() => setIsAddingProduct(false)} className="absolute top-6 right-6 text-gray-300 hover:text-black transition">
              <i className="fas fa-times text-xl"></i>
            </button>
            <h2 className="text-xl font-bold uppercase italic tracking-tight mb-8">Product Specification</h2>
            <form onSubmit={handleAddProduct} className="space-y-4">
              <input required placeholder="Name" className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-6 py-4 text-sm font-bold" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} />
              <input required type="number" placeholder="Price (PKR)" className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-6 py-4 text-sm font-bold" value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: Number(e.target.value)})} />
              <input required placeholder="Image URL" className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-6 py-4 text-sm font-bold" value={newProduct.image} onChange={e => setNewProduct({...newProduct, image: e.target.value})} />
              <input required placeholder="Category" className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-6 py-4 text-sm font-bold" value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value})} />
              <textarea required placeholder="Description" className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-6 py-4 text-sm font-bold h-24 resize-none" value={newProduct.description} onChange={e => setNewProduct({...newProduct, description: e.target.value})} />
              <button type="submit" className="w-full bg-black text-white py-5 rounded-2xl font-bold uppercase text-xs tracking-widest hover:bg-blue-600 transition shadow-xl mt-4">
                Deploy Product
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;