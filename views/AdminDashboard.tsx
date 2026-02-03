
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
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [isAudioUnlocked, setIsAudioUnlocked] = useState(false);
  
  // Notification Settings
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    return localStorage.getItem('itx_notifications_enabled') === 'true';
  });
  const [customTone, setCustomTone] = useState<string | null>(() => {
    return localStorage.getItem('itx_custom_tone');
  });

  const prevOrderCount = useRef(orders.length);

  // Audio Playback Logic
  const playAlert = () => {
    if (!notificationsEnabled || !isAudioUnlocked) return;
    const toneToPlay = customTone || DEFAULT_ALERT_TONE;
    const audio = new Audio(toneToPlay);
    audio.play().catch(e => console.warn('Audio play failed:', e));
  };

  // Watch for new orders and play sound
  useEffect(() => {
    if (orders.length > prevOrderCount.current && prevOrderCount.current > 0) {
      playAlert();
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("NEW ORDER RECEIVED", {
          body: `Order from ${orders[0].customer.name} - Rs. ${orders[0].total.toLocaleString()}`,
          icon: "/favicon.ico"
        });
      }
    }
    prevOrderCount.current = orders.length;
  }, [orders.length, notificationsEnabled, isAudioUnlocked, customTone]);

  const unlockAudio = () => {
    setIsAudioUnlocked(true);
    const audio = new Audio(customTone || DEFAULT_ALERT_TONE);
    audio.muted = true;
    audio.play().then(() => {
      audio.pause();
      audio.muted = false;
    }).catch(() => {});
  };

  const [productSearch, setProductSearch] = useState('');
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
        alert("Alert tone updated.");
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
    await supabase.from('orders').update({ status: status.toLowerCase() }).eq('order_id', orderId);
  };

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setProductForm(prev => ({ ...prev, image: reader.result as string }));
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
    setProductForm(prev => ({ ...prev, variants: prev.variants.filter(v => v.id !== id) }));
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
      const d = new Date(); d.setDate(d.getDate() - i);
      return d.toLocaleDateString('en-US', { weekday: 'short' });
    }).reverse();
    last7Days.forEach(day => chartMap[day] = 0);
    filteredByDate.forEach(o => {
      const day = new Date(o.date).toLocaleDateString('en-US', { weekday: 'short' });
      if (chartMap.hasOwnProperty(day)) chartMap[day] += o.total;
    });
    return { revenue, count, chartData: Object.entries(chartMap).map(([name, value]) => ({ name, value })) };
  }, [orders, dateRange]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()));
  }, [products, productSearch]);

  const filteredOrders = useMemo(() => {
    let result = [...orders];
    if (orderSearch) {
      const s = orderSearch.toLowerCase();
      result = result.filter(o => o.customer.name.toLowerCase().includes(s) || o.id.toLowerCase().includes(s) || (o.customer.city && o.customer.city.toLowerCase().includes(s)));
    }
    if (orderStatusFilter !== 'All') result = result.filter(o => o.status === orderStatusFilter);
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
    } catch (e: any) { alert(e.message); } finally { setIsSaving(false); }
  };

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-32 flex flex-col items-center">
        <h2 className="text-3xl font-serif italic font-bold uppercase mb-8 text-black">Console Secure Login</h2>
        <form onSubmit={(e) => { e.preventDefault(); if (adminPasswordInput === systemPassword) login(UserRole.ADMIN); else setLoginError(true); }} className="w-full max-w-xs space-y-4">
          <input type="password" placeholder="Passkey" required className="w-full p-6 bg-white border border-gray-100 rounded-2xl font-black text-center outline-none shadow-sm text-black" value={adminPasswordInput} onChange={(e) => setAdminPasswordInput(e.target.value)} />
          <button type="submit" className="w-full p-6 bg-black text-white rounded-2xl font-black uppercase tracking-widest hover:bg-blue-600 transition shadow-xl italic">Authorize</button>
        </form>
      </div>
    );
  }

  return (
    <div className="bg-[#fafafa] min-h-screen pb-32 text-black">
      <div className="container mx-auto px-4 md:px-8 py-8 md:py-12">
        {/* Mobile Audio Unlock */}
        {!isAudioUnlocked && (
          <div className="bg-blue-600 text-white p-6 rounded-3xl mb-8 flex flex-col md:flex-row items-center justify-between shadow-2xl animate-pulse">
             <div className="flex items-center space-x-4 mb-4 md:mb-0">
                <i className="fas fa-volume-up text-xl"></i>
                <p className="font-bold text-xs uppercase tracking-widest">Enable Real-Time Audio Notifications</p>
             </div>
             <button onClick={unlockAudio} className="bg-white text-blue-600 px-8 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg italic">Unlock Audio</button>
          </div>
        )}

        {/* Dashboard Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 md:mb-12 gap-6">
          <div className="space-y-1">
            <h1 className="text-3xl md:text-4xl font-serif font-bold italic">ITX <span className="text-blue-600">Console</span></h1>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 italic">Merchant: {user.name} • Live Monitor Active</p>
          </div>
          <div className="flex bg-white rounded-2xl p-1.5 border border-gray-200 shadow-sm w-full lg:w-auto overflow-x-auto no-scrollbar">
            {['overview', 'products', 'orders', 'settings'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab as any)} className={`flex-shrink-0 px-6 md:px-8 py-3 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-black text-white shadow-lg' : 'text-gray-400 hover:text-black hover:bg-gray-50'}`}>
                {tab === 'products' ? 'Listings' : tab}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-8 animate-fadeIn">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="bg-black text-white p-6 md:p-8 rounded-3xl shadow-xl">
                <p className="text-[9px] font-black uppercase opacity-60 mb-2 tracking-widest">Revenue</p>
                <p className="text-2xl md:text-3xl font-black italic">Rs. {analyticsData.revenue.toLocaleString()}</p>
              </div>
              <div className="bg-white p-6 md:p-8 rounded-3xl border border-gray-100 shadow-sm">
                <p className="text-[9px] font-black uppercase text-gray-400 mb-2 tracking-widest italic">Orders</p>
                <p className="text-2xl md:text-3xl font-black italic">{analyticsData.count}</p>
              </div>
              <div className="bg-white p-6 md:p-8 rounded-3xl border border-gray-100 shadow-sm">
                <p className="text-[9px] font-black uppercase text-gray-400 mb-2 tracking-widest italic">Listings</p>
                <p className="text-2xl md:text-3xl font-black italic">{products.length}</p>
              </div>
            </div>

            <div className="bg-white p-6 md:p-10 rounded-3xl border border-gray-100 shadow-sm">
                <h3 className="text-[10px] font-black uppercase tracking-widest mb-8 italic">Revenue Pulse</h3>
                <div className="h-[250px] md:h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analyticsData.chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 900, fill: '#9ca3af'}} />
                      <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 900, fill: '#9ca3af'}} />
                      <Tooltip />
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
          <div className="space-y-6 animate-fadeIn">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl md:text-3xl font-serif italic font-bold uppercase">Inventory</h2>
              <button onClick={() => setIsModalOpen(true)} className="bg-black text-white px-6 md:px-10 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl italic">New Listing</button>
            </div>
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden overflow-x-auto">
               <table className="w-full text-left min-w-[600px]">
                  <thead className="bg-gray-50/50"><tr><th className="px-6 md:px-10 py-6 text-[9px] font-black text-gray-400 uppercase">Listing</th><th className="px-6 md:px-10 py-6 text-[9px] font-black text-gray-400 uppercase">Price</th><th className="px-6 md:px-10 py-6 text-[9px] font-black text-gray-400 uppercase text-right">Action</th></tr></thead>
                  <tbody>{filteredProducts.map(p => (
                    <tr key={p.id} className="border-t border-gray-50">
                      <td className="px-6 md:px-10 py-6 flex items-center space-x-4"><img src={p.image} className="w-10 h-10 rounded-lg object-cover" /><span className="font-black uppercase italic text-xs truncate max-w-[150px]">{p.name}</span></td>
                      <td className="px-6 md:px-10 py-6 font-black text-xs italic">Rs. {p.price.toLocaleString()}</td>
                      <td className="px-6 md:px-10 py-6 text-right"><button onClick={() => deleteProduct(p.id)} className="text-red-500 font-black uppercase text-[9px] tracking-widest italic">Delete</button></td>
                    </tr>
                  ))}</tbody>
               </table>
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h2 className="text-2xl md:text-3xl font-serif italic font-bold uppercase">Order Ledger</h2>
              <div className="bg-white rounded-xl border border-gray-200 px-4 py-2 w-full sm:w-64">
                <input type="text" placeholder="Search ID, Name or City..." className="bg-transparent w-full text-[10px] font-bold uppercase outline-none" value={orderSearch} onChange={e => setOrderSearch(e.target.value)} />
              </div>
            </div>
            
            {/* Desktop View Table */}
            <div className="hidden md:block bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden overflow-x-auto">
               <table className="w-full text-left min-w-[800px]">
                  <thead className="bg-gray-50/50"><tr><th className="px-10 py-6 text-[9px] font-black text-gray-400 uppercase">Status & ID</th><th className="px-10 py-6 text-[9px] font-black text-gray-400 uppercase">Customer</th><th className="px-10 py-6 text-[9px] font-black text-gray-400 uppercase">City</th><th className="px-10 py-6 text-[9px] font-black text-gray-400 uppercase">Total</th></tr></thead>
                  <tbody>{filteredOrders.map(o => (
                    <tr key={o.id} onClick={() => setViewingOrder(o)} className="border-t border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors">
                      <td className="px-10 py-6">
                        <div className="flex items-center space-x-3">
                           <span className={`w-2 h-2 rounded-full ${o.status === 'Pending' ? 'bg-yellow-400' : 'bg-green-500'}`}></span>
                           <span className="font-black text-xs text-blue-600">#{o.id}</span>
                        </div>
                        <p className={`text-[8px] font-black uppercase mt-1 ${o.status === 'Pending' ? 'text-yellow-600' : 'text-green-600'}`}>{o.status}</p>
                      </td>
                      <td className="px-10 py-6 font-black uppercase text-xs">{o.customer.name}</td>
                      <td className="px-10 py-6 font-black uppercase text-[10px] text-gray-400 italic">{o.customer.city || 'N/A'}</td>
                      <td className="px-10 py-6 font-black text-xs">Rs. {o.total.toLocaleString()}</td>
                    </tr>
                  ))}</tbody>
               </table>
            </div>

            {/* Mobile Card List View */}
            <div className="md:hidden space-y-4">
              {filteredOrders.map(o => (
                <div key={o.id} onClick={() => setViewingOrder(o)} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm active:scale-95 transition-transform">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest italic mb-1">Order Identifier</p>
                      <p className="font-black text-blue-600">#{o.id}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase ${o.status === 'Pending' ? 'bg-yellow-50 text-yellow-600' : 'bg-green-50 text-green-600'}`}>{o.status}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest italic mb-1">Customer</p>
                      <p className="text-[10px] font-black uppercase truncate">{o.customer.name}</p>
                    </div>
                    <div>
                      <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest italic mb-1">City</p>
                      <p className="text-[10px] font-black uppercase italic text-gray-400">{o.customer.city || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-50 flex justify-between items-center">
                    <p className="text-[10px] font-black italic">Rs. {o.total.toLocaleString()}</p>
                    <i className="fas fa-chevron-right text-gray-200 text-xs"></i>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fadeIn">
            <div className="bg-white rounded-[2rem] p-8 md:p-12 border border-gray-100 shadow-sm">
              <h2 className="text-2xl font-serif italic font-bold mb-8 uppercase italic">Protocol Alerts</h2>
              <div className="space-y-8">
                <div className="flex items-center justify-between p-6 bg-gray-50 rounded-2xl">
                  <div>
                    <h3 className="font-black uppercase text-xs mb-1">Audio Notifications</h3>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest leading-relaxed">Play alert on new orders</p>
                  </div>
                  <button onClick={toggleNotifications} className={`w-12 h-7 rounded-full transition-all relative flex items-center px-1 ${notificationsEnabled ? 'bg-green-500' : 'bg-gray-300'}`}>
                    <div className={`w-5 h-5 bg-white rounded-full shadow-md transition-all ${notificationsEnabled ? 'translate-x-5' : 'translate-x-0'}`}></div>
                  </button>
                </div>
                <label className="flex items-center justify-center border-2 border-dashed border-gray-200 rounded-2xl p-8 cursor-pointer hover:border-blue-600 transition bg-gray-50/50">
                   <div className="text-center">
                      <i className="fas fa-music text-blue-600 mb-2"></i>
                      <p className="text-[9px] font-black uppercase text-gray-400 tracking-widest italic">{customTone ? 'Tone Uploaded' : 'Change Alert Tone'}</p>
                   </div>
                   <input type="file" className="hidden" accept="audio/*" onChange={handleToneUpload} />
                </label>
              </div>
            </div>
            <div className="bg-white rounded-[2rem] p-8 md:p-12 border border-gray-100 shadow-sm">
              <h2 className="text-2xl font-serif italic font-bold mb-8 uppercase italic">Master Security</h2>
              <form onSubmit={(e) => { e.preventDefault(); if (newPassword) { setSystemPassword(newPassword); alert("Passkey updated."); } }} className="space-y-6">
                <div>
                   <label className="block text-[9px] font-black uppercase text-gray-400 mb-2 italic tracking-widest">New System Passkey</label>
                   <input type="password" required className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-6 py-4 font-bold outline-none" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                </div>
                <button type="submit" className="w-full bg-black text-white py-5 rounded-2xl text-[10px] font-black uppercase italic hover:bg-blue-600 transition shadow-xl italic tracking-widest">Update Security Protocol</button>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* Listing Creation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="bg-white rounded-[2rem] w-full max-w-2xl p-8 md:p-10 overflow-y-auto max-h-[90vh] custom-scrollbar shadow-2xl">
            <div className="flex justify-between items-center mb-8 border-b pb-4">
              <h2 className="text-xl font-serif font-bold italic uppercase italic">Create New Listing</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-black"><i className="fas fa-times"></i></button>
            </div>
            <form onSubmit={handleSaveProduct} className="space-y-6">
               <div className="grid grid-cols-1 gap-6">
                  <input required className="w-full bg-gray-50 border border-gray-100 rounded-xl px-5 py-4 font-bold outline-none italic" placeholder="Product Name" value={productForm.name} onChange={e => setProductForm({...productForm, name: e.target.value})} />
                  <textarea required className="w-full bg-gray-50 border border-gray-100 rounded-xl px-5 py-4 font-bold h-24 outline-none resize-none italic" placeholder="Full Description" value={productForm.description} onChange={e => setProductForm({...productForm, description: e.target.value})} />
                  <div className="grid grid-cols-2 gap-4">
                    <input required type="number" className="w-full bg-gray-50 border border-gray-100 rounded-xl px-5 py-4 font-bold outline-none italic" placeholder="Base Price" value={productForm.price || ''} onChange={e => setProductForm({...productForm, price: Number(e.target.value)})} />
                    <input required type="number" className="w-full bg-gray-50 border border-gray-100 rounded-xl px-5 py-4 font-bold outline-none italic" placeholder="Stock Level" value={productForm.inventory || ''} onChange={e => setProductForm({...productForm, inventory: Number(e.target.value)})} />
                  </div>
                  
                  <div className="p-6 bg-gray-50 rounded-2xl border border-gray-100">
                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-4 italic">Available Editions / Variants</p>
                    <div className="space-y-2 mb-4">
                      {productForm.variants.map((v) => (
                        <div key={v.id} className="flex justify-between items-center bg-white p-3 rounded-xl border border-gray-100">
                          <span className="font-black text-[10px] uppercase italic">{v.name} (Rs. {v.price.toLocaleString()})</span>
                          <button type="button" onClick={() => removeVariant(v.id)} className="text-red-500 text-xs"><i className="fas fa-trash"></i></button>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-3">
                      <input className="flex-grow bg-white border border-gray-200 rounded-lg px-4 py-2 text-[10px] font-bold uppercase" placeholder="Edition Name" value={newVariant.name} onChange={e => setNewVariant({...newVariant, name: e.target.value})} />
                      <input type="number" className="w-20 bg-white border border-gray-200 rounded-lg px-4 py-2 text-[10px] font-bold uppercase" placeholder="Price" value={newVariant.price || ''} onChange={e => setNewVariant({...newVariant, price: Number(e.target.value)})} />
                      <button type="button" onClick={addVariant} className="bg-black text-white px-4 py-2 rounded-lg text-[9px] font-black uppercase">Add</button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[9px] font-black uppercase text-gray-400 mb-2 italic">Listing Asset</label>
                    <label className="w-full bg-gray-50 border border-gray-200 border-dashed rounded-xl px-5 py-8 cursor-pointer hover:bg-gray-100 transition flex flex-col items-center justify-center">
                       <i className="fas fa-cloud-upload-alt text-blue-600 mb-2 text-xl"></i>
                       <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">{productForm.image ? 'Image Loaded' : 'Upload Listing Image'}</span>
                       <input type="file" className="hidden" accept="image/*" onChange={handleImageFile} />
                    </label>
                  </div>
               </div>
               <button type="submit" disabled={isSaving} className="w-full bg-black text-white py-5 rounded-2xl font-black uppercase italic shadow-2xl tracking-widest">{isSaving ? 'Processing...' : 'Publish Listing'}</button>
            </form>
          </div>
        </div>
      )}

      {/* Order Detail Manifest Modal */}
      {viewingOrder && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="bg-white rounded-[2rem] w-full max-w-2xl p-6 md:p-10 overflow-y-auto max-h-[95vh] custom-scrollbar shadow-2xl">
            <div className="flex justify-between items-start mb-10">
               <div>
                  <h2 className="text-2xl font-serif font-bold italic uppercase italic">Order Manifest</h2>
                  <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest italic mt-1">ID: #{viewingOrder.id}</p>
               </div>
               <button onClick={() => setViewingOrder(null)} className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center hover:bg-black hover:text-white transition"><i className="fas fa-times"></i></button>
            </div>
            <div className="space-y-8 mb-10">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {['name', 'phone', 'city'].map((f) => (
                    <div key={f} className="relative">
                      <p className="text-[8px] font-black uppercase text-gray-400 mb-1 italic tracking-widest">{f}</p>
                      <div className="flex items-center justify-between bg-gray-50 p-4 rounded-xl">
                        <p className="font-black uppercase text-sm truncate">{(viewingOrder.customer as any)[f] || 'N/A'}</p>
                        <button onClick={() => handleCopy((viewingOrder.customer as any)[f] || '', f)} className="text-gray-400 hover:text-blue-600 ml-2"><i className={`fas ${copyStatus === f ? 'fa-check text-green-500' : 'fa-copy'} text-xs`}></i></button>
                      </div>
                    </div>
                  ))}
                  <div>
                    <p className="text-[8px] font-black uppercase text-gray-400 mb-1 italic tracking-widest">Address</p>
                    <div className="bg-gray-50 p-4 rounded-xl flex items-center justify-between">
                       <p className="font-bold italic text-xs leading-relaxed truncate"> {viewingOrder.customer.address} </p>
                       <button onClick={() => handleCopy(viewingOrder.customer.address, 'address')} className="text-gray-400 hover:text-blue-600 ml-2"><i className={`fas ${copyStatus === 'address' ? 'fa-check text-green-500' : 'fa-copy'} text-xs`}></i></button>
                    </div>
                  </div>
               </div>
               
               <div>
                  <h3 className="text-[9px] font-black uppercase text-gray-400 mb-4 italic tracking-widest">Items Reserved</h3>
                  <div className="space-y-3">
                    {viewingOrder.items.map((it, i) => (
                      <div key={i} className="flex items-center space-x-4 p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <img src={it.product.image} className="w-12 h-12 rounded-lg object-cover" />
                        <div className="flex-grow">
                          <p className="font-black uppercase text-[10px] italic">{it.product.name}</p>
                          <p className="text-[8px] font-bold text-gray-400 uppercase italic">Edition: {it.variantName || 'Standard'}</p>
                        </div>
                        <p className="font-black text-[10px] italic whitespace-nowrap">Rs. {it.product.price.toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
               </div>
            </div>
            
            <div className="bg-black text-white p-8 rounded-3xl flex flex-col md:flex-row justify-between items-center gap-6">
               <div className="text-center md:text-left">
                  <p className="text-[9px] font-black uppercase opacity-60 mb-1 italic tracking-widest">Total Payable (COD)</p>
                  <p className="text-3xl font-black italic">Rs. {viewingOrder.total.toLocaleString()}</p>
               </div>
               <select value={viewingOrder.status} onChange={(e) => handleStatusChange(viewingOrder.id, e.target.value as any)} className="bg-white/10 border border-white/20 text-[10px] font-black uppercase px-6 py-4 rounded-xl outline-none italic cursor-pointer">
                 {['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'].map(s => <option key={s} value={s} className="text-black">{s}</option>)}
               </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
