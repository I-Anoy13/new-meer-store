
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Product, Order, User, UserRole, Variant } from '../types';
import { supabase } from '../lib/supabase';
import { PLACEHOLDER_IMAGE } from '../constants';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';

interface AdminDashboardProps {
  products: Product[];
  setProducts: (action: React.SetStateAction<Product[]>) => void;
  deleteProduct: (productId: string) => void;
  orders: Order[];
  setOrders: (action: React.SetStateAction<Order[]>) => void;
  user: User | null;
  login: (role: UserRole) => void;
  systemPassword: string;
  setSystemPassword: (pwd: string) => void;
  refreshData: () => void;
}

const DEFAULT_ALERT_TONE = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';

const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
  products, 
  setProducts, 
  deleteProduct, 
  orders, 
  setOrders, 
  user, 
  login, 
  systemPassword, 
  setSystemPassword,
  refreshData
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'products' | 'orders' | 'settings'>('overview');
  const [dateRange, setDateRange] = useState<'today' | '7d' | '30d' | 'all'>('7d');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [loginError, setLoginError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [liveVisitors, setLiveVisitors] = useState(1);
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  
  // Notification Settings
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    return localStorage.getItem('itx_notifications_enabled') === 'true';
  });
  const [customTone, setCustomTone] = useState<string | null>(() => {
    return localStorage.getItem('itx_custom_tone');
  });

  const prevOrderCount = useRef(orders.length);

  // Filters & Sorting
  const [productSearch, setProductSearch] = useState('');
  const [productCategoryFilter, setProductCategoryFilter] = useState('All');
  const [productSort, setProductSort] = useState<'name-asc' | 'name-desc' | 'price-asc' | 'price-desc'>('name-asc');
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('All');

  const [newPassword, setNewPassword] = useState('');

  // Product Form with Variants
  const [productForm, setProductForm] = useState<{
    name: string;
    description: string;
    price: number;
    category: string;
    inventory: number;
    image: string;
    variants: Variant[];
  }>({
    name: '',
    description: '',
    price: 0,
    category: 'Luxury Artisan',
    inventory: 0,
    image: '',
    variants: []
  });

  const [newVariant, setNewVariant] = useState({ name: '', price: 0 });

  // Real Visitor Monitoring
  useEffect(() => {
    const fetchVisitors = async () => {
      try {
        const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const { count, error } = await supabase
          .from('visitors')
          .select('*', { count: 'exact', head: true })
          .gt('last_seen', fiveMinsAgo);
        
        if (!error && count !== null) {
          setLiveVisitors(Math.max(1, count));
        }
      } catch (e) {
        setLiveVisitors(1);
      }
    };

    fetchVisitors();
    const interval = setInterval(fetchVisitors, 10000);
    return () => clearInterval(interval);
  }, []);

  // New Order Alert Logic
  useEffect(() => {
    if (notificationsEnabled && orders.length > prevOrderCount.current) {
      const toneToPlay = customTone || DEFAULT_ALERT_TONE;
      const audio = new Audio(toneToPlay);
      audio.play().catch(() => {});
      
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("NEW ORDER RECEIVED", {
          body: `Order from ${orders[0].customer.name} - Rs. ${orders[0].total.toLocaleString()}`,
          icon: "/favicon.ico"
        });
      }
    }
    prevOrderCount.current = orders.length;
  }, [orders, notificationsEnabled, customTone]);

  const toggleNotifications = () => {
    const nextValue = !notificationsEnabled;
    setNotificationsEnabled(nextValue);
    localStorage.setItem('itx_notifications_enabled', String(nextValue));
    if (nextValue && "Notification" in window) Notification.requestPermission();
  };

  const handleToneUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setCustomTone(base64);
        localStorage.setItem('itx_custom_tone', base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopyStatus(field);
    setTimeout(() => setCopyStatus(null), 2000);
  };

  const handleStatusChange = async (orderId: string, status: Order['status']) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
    if (viewingOrder?.id === orderId) {
      setViewingOrder(prev => prev ? { ...prev, status } : null);
    }
    const { error } = await supabase.from('orders').update({ status: status.toLowerCase() }).eq('order_id', orderId);
    if (error) {
      alert("Sync failed. Refreshing...");
      refreshData();
    }
  };

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProductForm(prev => ({ ...prev, image: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const addVariant = () => {
    if (newVariant.name && newVariant.price > 0) {
      setProductForm(prev => ({
        ...prev,
        variants: [...prev.variants, { id: Math.random().toString(36).substr(2, 9), ...newVariant }]
      }));
      setNewVariant({ name: '', price: 0 });
    }
  };

  const removeVariant = (id: string) => {
    setProductForm(prev => ({
      ...prev,
      variants: prev.variants.filter(v => v.id !== id)
    }));
  };

  const formatCompact = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'm';
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return num.toLocaleString();
  };

  const analyticsData = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    
    const filteredByDate = orders.filter(o => {
      const orderTime = new Date(o.date).getTime();
      if (dateRange === 'today') return orderTime >= today;
      if (dateRange === '7d') return orderTime >= today - (7 * 24 * 60 * 60 * 1000);
      if (dateRange === '30d') return orderTime >= today - (30 * 24 * 60 * 60 * 1000);
      return true;
    });

    const revenue = filteredByDate.reduce((sum, o) => sum + o.total, 0);
    const count = filteredByDate.length;
    
    const chartMap: Record<string, number> = {};
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toLocaleDateString('en-US', { weekday: 'short' });
    }).reverse();

    last7Days.forEach(day => chartMap[day] = 0);
    
    filteredByDate.forEach(o => {
      const day = new Date(o.date).toLocaleDateString('en-US', { weekday: 'short' });
      if (chartMap.hasOwnProperty(day)) {
        chartMap[day] = (chartMap[day] || 0) + o.total;
      }
    });

    const chartData = Object.entries(chartMap).map(([name, value]) => ({ name, value }));
    return { revenue, count, chartData };
  }, [orders, dateRange]);

  const filteredProducts = useMemo(() => {
    let result = [...products];
    if (productSearch) result = result.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()));
    if (productCategoryFilter !== 'All') result = result.filter(p => p.category === productCategoryFilter);
    result.sort((a, b) => {
      if (productSort === 'price-asc') return a.price - b.price;
      if (productSort === 'price-desc') return b.price - a.price;
      return a.name.localeCompare(b.name);
    });
    return result;
  }, [products, productSearch, productCategoryFilter, productSort]);

  const filteredOrders = useMemo(() => {
    let result = [...orders];
    if (orderSearch) result = result.filter(o => o.customer.name.toLowerCase().includes(orderSearch.toLowerCase()) || o.id.toLowerCase().includes(orderSearch.toLowerCase()));
    if (orderStatusFilter !== 'All') result = result.filter(o => o.status === orderStatusFilter);
    result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return result;
  }, [orders, orderSearch, orderStatusFilter]);

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const { error } = await supabase.from('products').insert([{
        name: productForm.name,
        description: productForm.description,
        price_pkr: productForm.price,
        inventory: productForm.inventory,
        image: productForm.image,
        category: productForm.category,
        variants: productForm.variants
      }]);
      if (error) throw error;
      setProductForm({ name: '', description: '', price: 0, category: 'Luxury Artisan', inventory: 0, image: '', variants: [] });
      setIsModalOpen(false);
      refreshData();
    } catch (error: any) { alert(error.message); } finally { setIsSaving(false); }
  };

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-40 flex flex-col items-center">
        <div className="w-24 h-24 bg-black rounded-3xl flex items-center justify-center mb-10 text-4xl text-white shadow-2xl"><i className="fas fa-terminal"></i></div>
        <h2 className="text-4xl font-serif italic font-bold uppercase mb-8 text-black">ITX Console Login</h2>
        <form onSubmit={(e) => { e.preventDefault(); if (adminPasswordInput === systemPassword) login(UserRole.ADMIN); else setLoginError(true); }} className="w-full max-w-sm space-y-4">
          <input type="password" placeholder="System Password" required className={`w-full p-6 bg-white border ${loginError ? 'border-red-500' : 'border-gray-100'} rounded-2xl font-black text-center outline-none focus:ring-1 focus:ring-black transition shadow-sm text-black`} value={adminPasswordInput} onChange={(e) => setAdminPasswordInput(e.target.value)} />
          <button type="submit" className="w-full p-6 bg-black text-white rounded-2xl font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-xl">Secure Login <i className="fas fa-key ml-4"></i></button>
        </form>
      </div>
    );
  }

  return (
    <div className="bg-[#fafafa] min-h-screen pb-32">
      <div className="container mx-auto px-8 py-12">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-12 gap-6">
          <div className="space-y-1">
            <h1 className="text-4xl font-serif font-bold italic text-black">Store <span className="not-italic text-blue-600">Analytics</span></h1>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">Merchant: {user.name}</p>
          </div>
          <div className="flex bg-white rounded-2xl p-1.5 border border-gray-200 shadow-sm overflow-x-auto">
            {['overview', 'products', 'orders', 'settings'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab as any)} className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-black text-white shadow-lg' : 'text-gray-400 hover:text-black hover:bg-gray-50'}`}>{tab}</button>
            ))}
          </div>
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-10 animate-fadeIn">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
              <div className="lg:col-span-4 flex items-center space-x-6">
                 <div className="relative">
                    <div className="w-12 h-12 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center animate-pulse shadow-sm">
                       <i className="fas fa-signal text-lg"></i>
                    </div>
                    <span className="absolute -top-1 -right-1 flex h-4 w-4">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-4 w-4 bg-green-600"></span>
                    </span>
                 </div>
                 <div>
                    <p className="text-[11px] font-black uppercase tracking-widest text-black mb-1">Real-Time Traffic</p>
                    <div className="flex items-center space-x-3">
                       <span className="text-2xl font-black text-green-600">{liveVisitors}</span>
                       <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Active Browsers</span>
                    </div>
                 </div>
              </div>
              <div className="lg:col-span-8 flex justify-end">
                <div className="flex space-x-2 bg-gray-50 p-1 rounded-xl">
                  {['today', '7d', '30d', 'all'].map(r => (
                    <button key={r} onClick={() => setDateRange(r as any)} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${dateRange === r ? 'bg-black text-white shadow-md' : 'text-gray-400 hover:text-black'}`}>{r.toUpperCase()}</button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-black text-white p-8 rounded-3xl shadow-xl">
                <p className="text-[10px] font-black uppercase opacity-60 mb-3 tracking-widest">Total Sales Volume</p>
                <p className="text-4xl font-black">Rs. {formatCompact(analyticsData.revenue)}</p>
              </div>
              <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm text-black">
                <p className="text-[10px] font-black uppercase text-gray-400 mb-3 tracking-widest italic">Success Ledger</p>
                <p className="text-4xl font-black">{analyticsData.count} Orders</p>
              </div>
              <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm text-black">
                <p className="text-[10px] font-black uppercase text-gray-400 mb-3 tracking-widest italic">Live Inventory</p>
                <p className="text-4xl font-black">{products.length} SKUs</p>
              </div>
            </div>

            <div className="bg-white p-10 rounded-3xl border border-gray-100 shadow-sm">
                <h3 className="text-[11px] font-black uppercase tracking-widest text-black mb-10 italic">Revenue Pulse Curve</h3>
                <div className="h-[350px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analyticsData.chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 900, fill: '#9ca3af'}} />
                      <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 900, fill: '#9ca3af'}} tickFormatter={(v) => formatCompact(v)} />
                      <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '10px', fontWeight: 900}} />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                        {analyticsData.chartData.map((_, index) => <Cell key={`cell-${index}`} fill={index === analyticsData.chartData.length - 1 ? '#2563eb' : '#000'} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
            </div>
          </div>
        )}

        {activeTab === 'products' && (
          <div className="space-y-8 animate-fadeIn text-black">
            <div className="flex justify-between items-center"><h2 className="text-3xl font-serif italic font-bold uppercase">Product Listings</h2><button onClick={() => setIsModalOpen(true)} className="bg-black text-white px-10 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition shadow-xl">Create Listing</button></div>
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
               <table className="w-full text-left">
                  <thead className="bg-gray-50/50"><tr><th className="px-10 py-6 text-[10px] font-black text-gray-400 uppercase">Product</th><th className="px-10 py-6 text-[10px] font-black text-gray-400 uppercase">Stock</th><th className="px-10 py-6 text-[10px] font-black text-gray-400 uppercase text-right">Price</th><th className="px-10 py-6 text-[10px] font-black text-gray-400 uppercase text-right">Action</th></tr></thead>
                  <tbody>{filteredProducts.map(p => (
                    <tr key={p.id} className="border-t border-gray-50">
                      <td className="px-10 py-6 flex items-center space-x-4"><img src={p.image} className="w-12 h-12 rounded-xl object-cover border" /><span className="font-black uppercase italic text-xs">{p.name}</span></td>
                      <td className="px-10 py-6 font-black text-[10px]">{p.inventory} UNITS</td>
                      <td className="px-10 py-6 text-right font-black">Rs. {p.price.toLocaleString()}</td>
                      <td className="px-10 py-6 text-right"><button onClick={() => deleteProduct(p.id)} className="text-red-500 font-black uppercase text-[10px]">Remove</button></td>
                    </tr>
                  ))}</tbody>
               </table>
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="space-y-8 animate-fadeIn text-black">
            <h2 className="text-3xl font-serif italic font-bold uppercase">Order Ledger</h2>
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
               <table className="w-full text-left">
                  <thead className="bg-gray-50/50"><tr><th className="px-10 py-6 text-[10px] font-black text-gray-400 uppercase">Order ID</th><th className="px-10 py-6 text-[10px] font-black text-gray-400 uppercase">Customer</th><th className="px-10 py-6 text-[10px] font-black text-gray-400 uppercase">City</th><th className="px-10 py-6 text-[10px] font-black text-gray-400 uppercase">Amount</th><th className="px-10 py-6 text-[10px] font-black text-gray-400 uppercase">Status</th></tr></thead>
                  <tbody>{filteredOrders.map(o => (
                    <tr key={o.id} onClick={() => setViewingOrder(o)} className="border-t border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors">
                      <td className="px-10 py-6 font-black text-xs text-blue-600">#{o.id}</td>
                      <td className="px-10 py-6 font-black uppercase text-xs">{o.customer.name}</td>
                      <td className="px-10 py-6 font-black uppercase text-[10px] text-gray-400">{o.customer.city || 'N/A'}</td>
                      <td className="px-10 py-6 font-black">Rs. {o.total.toLocaleString()}</td>
                      <td className="px-10 py-6"><span className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase ${o.status === 'Pending' ? 'bg-yellow-50 text-yellow-600' : 'bg-green-50 text-green-600'}`}>{o.status}</span></td>
                    </tr>
                  ))}</tbody>
               </table>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fadeIn text-black">
            <div className="bg-white rounded-[2.5rem] p-12 border border-gray-100 shadow-sm">
              <h2 className="text-3xl font-serif italic font-bold mb-8 uppercase">Order Notifications</h2>
              <div className="space-y-8">
                <div className="flex items-center justify-between p-6 bg-gray-50 rounded-2xl border border-gray-100">
                  <div>
                    <h3 className="font-black uppercase text-sm mb-1 italic">Alert System</h3>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-relaxed">Trigger tone when a new order arrives.</p>
                  </div>
                  <button onClick={toggleNotifications} className={`w-14 h-8 rounded-full transition-all relative flex items-center px-1 ${notificationsEnabled ? 'bg-green-500' : 'bg-gray-300'}`}>
                    <div className={`w-6 h-6 bg-white rounded-full shadow-md transition-all ${notificationsEnabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
                  </button>
                </div>
                <div className="p-6 bg-gray-50 rounded-2xl border border-gray-100">
                  <h3 className="font-black uppercase text-sm mb-4 italic">Notification Tone</h3>
                  <div className="flex flex-col space-y-4">
                    <label className="flex items-center justify-center border-2 border-dashed border-gray-200 rounded-xl p-6 cursor-pointer hover:border-blue-600 transition">
                       <div className="text-center">
                          <i className="fas fa-music text-blue-600 mb-2"></i>
                          <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">{customTone ? 'Tone Uploaded' : 'Upload MP3/WAV'}</p>
                       </div>
                       <input type="file" className="hidden" accept="audio/*" onChange={handleToneUpload} />
                    </label>
                    {customTone && (
                      <div className="flex items-center space-x-3">
                        <button onClick={() => new Audio(customTone).play()} className="bg-blue-600 text-white p-3 rounded-xl shadow-md"><i className="fas fa-play"></i></button>
                        <button onClick={() => { setCustomTone(null); localStorage.removeItem('itx_custom_tone'); }} className="bg-red-500 text-white p-3 rounded-xl shadow-md"><i className="fas fa-trash"></i></button>
                        <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest italic">Custom active</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-[2.5rem] p-12 border border-gray-100 shadow-sm">
              <h2 className="text-3xl font-serif italic font-bold mb-8 uppercase">Security Guard</h2>
              <form onSubmit={(e) => { e.preventDefault(); if (newPassword) { setSystemPassword(newPassword); alert("Access updated."); } }} className="space-y-6">
                <div><label className="block text-[10px] font-black uppercase text-gray-400 mb-2 italic">New Console Passkey</label><input type="password" required className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-6 py-4 font-bold outline-none" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></div>
                <button type="submit" className="bg-black text-white px-10 py-4 rounded-xl text-[10px] font-black uppercase italic hover:bg-blue-600 shadow-xl transition">Patch System</button>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* Product Listing Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl p-10 overflow-y-auto max-h-[90vh] custom-scrollbar text-black">
            <h2 className="text-2xl font-serif font-bold italic uppercase mb-8 border-b pb-4">New Listing</h2>
            <form onSubmit={handleSaveProduct} className="space-y-6">
               <div className="grid grid-cols-1 gap-6">
                  <input required className="w-full bg-gray-50 border border-gray-100 rounded-xl px-5 py-4 font-bold outline-none" placeholder="Product Name" value={productForm.name} onChange={e => setProductForm({...productForm, name: e.target.value})} />
                  <textarea required className="w-full bg-gray-50 border border-gray-100 rounded-xl px-5 py-4 font-bold h-32 outline-none resize-none" placeholder="Description" value={productForm.description} onChange={e => setProductForm({...productForm, description: e.target.value})} />
                  <div className="grid grid-cols-2 gap-4">
                    <input required type="number" className="w-full bg-gray-50 border border-gray-100 rounded-xl px-5 py-4 font-bold outline-none" placeholder="Base Price (PKR)" value={productForm.price || ''} onChange={e => setProductForm({...productForm, price: Number(e.target.value)})} />
                    <input required type="number" className="w-full bg-gray-50 border border-gray-100 rounded-xl px-5 py-4 font-bold outline-none" placeholder="Initial Stock" value={productForm.inventory || ''} onChange={e => setProductForm({...productForm, inventory: Number(e.target.value)})} />
                  </div>
                  
                  <div className="p-6 bg-gray-50 rounded-2xl border border-gray-100">
                    <h3 className="text-[11px] font-black uppercase tracking-widest text-gray-400 mb-4 italic">Edition Variations</h3>
                    <div className="space-y-3 mb-4">
                      {productForm.variants.map((v) => (
                        <div key={v.id} className="flex justify-between items-center bg-white p-3 rounded-xl border border-gray-100">
                          <div><span className="font-black text-xs uppercase">{v.name}</span><span className="ml-3 text-[10px] text-blue-600 font-bold">Rs. {v.price.toLocaleString()}</span></div>
                          <button type="button" onClick={() => removeVariant(v.id)} className="text-red-500 text-xs"><i className="fas fa-trash"></i></button>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-3">
                      <input className="flex-grow bg-white border border-gray-200 rounded-lg px-4 py-2 text-xs font-bold" placeholder="Edition Name" value={newVariant.name} onChange={e => setNewVariant({...newVariant, name: e.target.value})} />
                      <input type="number" className="w-24 bg-white border border-gray-200 rounded-lg px-4 py-2 text-xs font-bold" placeholder="Price" value={newVariant.price || ''} onChange={e => setNewVariant({...newVariant, price: Number(e.target.value)})} />
                      <button type="button" onClick={addVariant} className="bg-black text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase">Add</button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[10px] font-black uppercase text-gray-400 mb-1 italic">Listing Image Asset</label>
                    <label className="flex-grow bg-gray-50 border border-gray-100 border-dashed rounded-xl px-5 py-4 font-bold cursor-pointer hover:bg-gray-100 transition flex items-center justify-center text-xs uppercase italic">
                       <i className="fas fa-upload mr-2 text-blue-600"></i> {productForm.image ? 'File Selected' : 'Upload Image File'}
                       <input type="file" className="hidden" accept="image/*" onChange={handleImageFile} />
                    </label>
                    {productForm.image && <img src={productForm.image} className="mt-2 w-20 h-20 rounded-xl object-cover border" alt="Preview" />}
                  </div>
               </div>
               <div className="flex space-x-4 pt-10"><button type="submit" disabled={isSaving} className="flex-grow bg-black text-white py-5 rounded-xl font-black uppercase italic shadow-2xl">{isSaving ? 'Processing...' : 'Publish Listing'}</button><button type="button" onClick={() => setIsModalOpen(false)} className="bg-gray-100 px-10 py-5 rounded-xl font-black uppercase">Cancel</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Detailed Order Modal */}
      {viewingOrder && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fadeIn">
          <div className="bg-white rounded-[2.5rem] w-full max-w-3xl p-12 overflow-y-auto max-h-[95vh] custom-scrollbar shadow-2xl border border-gray-100 text-black">
            <div className="flex justify-between items-start mb-12">
               <div><h2 className="text-3xl font-serif font-bold italic uppercase leading-tight mb-2">Order Manifest</h2><p className="text-[10px] font-black text-blue-600 uppercase tracking-widest italic">Order ID: #{viewingOrder.id}</p></div>
               <button onClick={() => setViewingOrder(null)} className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center hover:bg-black hover:text-white transition"><i className="fas fa-times"></i></button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-12">
               <div className="space-y-6">
                  <h3 className="text-[11px] font-black uppercase tracking-widest text-gray-400 italic border-b border-gray-100 pb-2">Customer Info</h3>
                  {['name', 'phone', 'city'].map((field) => (
                    <div key={field} className="group relative">
                      <p className="text-[9px] font-black uppercase text-gray-400 mb-1 italic">{field}</p>
                      <div className="flex items-center justify-between bg-gray-50/50 p-3 rounded-xl border border-transparent hover:border-gray-100 transition">
                        <p className="font-black uppercase text-lg">{(viewingOrder.customer as any)[field] || 'N/A'}</p>
                        <button onClick={() => handleCopy((viewingOrder.customer as any)[field] || '', field)} className="text-gray-400 hover:text-blue-600 p-2"><i className={`fas ${copyStatus === field ? 'fa-check text-green-500' : 'fa-copy'}`}></i></button>
                      </div>
                    </div>
                  ))}
               </div>
               <div className="space-y-6">
                  <h3 className="text-[11px] font-black uppercase tracking-widest text-gray-400 italic border-b border-gray-100 pb-2">Logistics</h3>
                  <div className="group relative">
                    <p className="text-[9px] font-black uppercase text-gray-400 mb-1 italic">Delivery Address</p>
                    <div className="bg-gray-50 p-4 rounded-xl border border-dashed border-gray-200 relative">
                      <p className="font-bold italic text-sm leading-relaxed pr-10">{viewingOrder.customer.address}</p>
                      <button onClick={() => handleCopy(viewingOrder.customer.address, 'address')} className="absolute top-2 right-2 text-gray-400 hover:text-blue-600 p-2"><i className={`fas ${copyStatus === 'address' ? 'fa-check text-green-500' : 'fa-copy'}`}></i></button>
                    </div>
                  </div>
                  <div><p className="text-[9px] font-black uppercase text-gray-400 mb-1 italic">Payment Protocol</p><p className="font-black uppercase text-blue-600 bg-blue-50 px-3 py-1 rounded-lg inline-block text-[10px]">Cash On Delivery (COD)</p></div>
               </div>
            </div>

            <div className="mb-12">
               <h3 className="text-[11px] font-black uppercase tracking-widest text-gray-400 italic border-b border-gray-100 pb-2 mb-6 uppercase">Order Contents</h3>
               <div className="space-y-4">
                  {viewingOrder.items.map((item, i) => (
                    <div key={i} className="flex items-center space-x-6 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                      <img src={item.product.image} className="w-16 h-16 rounded-xl object-cover shadow-sm" />
                      <div className="flex-grow">
                         <p className="font-black uppercase text-sm">{item.product.name}</p>
                         <p className="text-[10px] font-bold text-gray-400 uppercase mt-1 italic">Variant: {item.variantName || 'Standard'}</p>
                      </div>
                      <div className="text-right">
                         <p className="font-black text-sm">Rs. {item.product.price.toLocaleString()}</p>
                         <p className="text-[10px] font-bold text-gray-400 uppercase italic">Qty: {item.quantity}</p>
                      </div>
                    </div>
                  ))}
               </div>
            </div>

            <div className="flex flex-col md:flex-row justify-between items-center p-8 bg-black text-white rounded-3xl mb-12">
               <div className="mb-4 md:mb-0"><p className="text-[10px] font-black uppercase tracking-widest opacity-60 italic mb-2">Total Amount Payable</p><p className="text-4xl font-black italic">Rs. {viewingOrder.total.toLocaleString()}</p></div>
               <div className="flex items-center space-x-4">
                  <select value={viewingOrder.status} onChange={(e) => handleStatusChange(viewingOrder.id, e.target.value as any)} className="bg-white/10 border border-white/20 text-[11px] font-black uppercase px-6 py-4 rounded-xl outline-none hover:bg-white/20 transition cursor-pointer">
                    {['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'].map(s => <option key={s} value={s} className="text-black">{s}</option>)}
                  </select>
                  <button onClick={() => window.print()} className="w-14 h-14 bg-blue-600 rounded-xl flex items-center justify-center hover:bg-blue-700 transition"><i className="fas fa-print"></i></button>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
