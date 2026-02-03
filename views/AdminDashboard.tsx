
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Product, Order, User, UserRole, Variant } from '../types';
import { supabase } from '../lib/supabase';
import { PLACEHOLDER_IMAGE } from '../constants';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

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
  updateStatusOverride?: (orderId: string, status: Order['status']) => void;
}

const PRESET_SOUNDS = [
  { name: 'Default Chime', url: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3' },
  { name: 'Elegant Bell', url: 'https://assets.mixkit.co/active_storage/sfx/1070/1070-preview.mp3' },
  { name: 'Digital Alert', url: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3' },
  { name: 'Store Bell', url: 'https://assets.mixkit.co/active_storage/sfx/133/133-preview.mp3' }
];

const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
  products, setProducts, deleteProduct, orders, user, login, systemPassword, setSystemPassword, refreshData, updateStatusOverride
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'products' | 'orders' | 'settings'>(() => {
    return (localStorage.getItem('itx_admin_tab') as any) || 'overview';
  });

  const [selectedSoundUrl, setSelectedSoundUrl] = useState<string>(() => {
    return localStorage.getItem('itx_alert_url') || PRESET_SOUNDS[0].url;
  });
  const [customSoundBase64, setCustomSoundBase64] = useState<string | null>(() => {
    return localStorage.getItem('itx_custom_alert_b64');
  });
  const [isUsingCustom, setIsUsingCustom] = useState<boolean>(() => {
    return localStorage.getItem('itx_use_custom_alert') === 'true';
  });

  const [newProduct, setNewProduct] = useState({ name: '', price: '', image: '', category: 'Luxury', description: '' });
  const [newProductVariants, setNewProductVariants] = useState<{name: string, price: string}[]>([]);
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('itx_admin_tab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    localStorage.setItem('itx_alert_url', selectedSoundUrl);
    localStorage.setItem('itx_use_custom_alert', String(isUsingCustom));
    if (customSoundBase64) {
      localStorage.setItem('itx_custom_alert_b64', customSoundBase64);
    }
  }, [selectedSoundUrl, isUsingCustom, customSoundBase64]);

  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState<string | null>(null);
  const [orderSearch, setOrderSearch] = useState('');
  const [isAudioUnlocked, setIsAudioUnlocked] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const prevOrderCount = useRef(orders.length);

  const playAlert = () => {
    if (!isAudioUnlocked) return;
    const source = (isUsingCustom && customSoundBase64) ? customSoundBase64 : selectedSoundUrl;
    const finalSource = source && source.length > 10 ? source : PRESET_SOUNDS[0].url;
    try {
      const audio = new Audio(finalSource);
      audio.play().catch(() => {});
    } catch (err) {}
  };

  useEffect(() => {
    if (orders.length > prevOrderCount.current && prevOrderCount.current > 0) {
      playAlert();
    }
    prevOrderCount.current = orders.length;
  }, [orders.length]);

  const unlockAudio = () => {
    setIsAudioUnlocked(true);
    const source = (isUsingCustom && customSoundBase64) ? customSoundBase64 : selectedSoundUrl;
    const finalSource = source && source.length > 10 ? source : PRESET_SOUNDS[0].url;
    try {
      const audio = new Audio(finalSource);
      audio.muted = true;
      audio.play().then(() => { audio.pause(); audio.muted = false; }).catch(() => {});
    } catch (e) {}
  };

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopyStatus(field);
    setTimeout(() => setCopyStatus(null), 2000);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    refreshData();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setImagePreview(base64);
        setNewProduct(prev => ({ ...prev, image: base64 }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCustomSoundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { alert("Sound file too large (Max 2MB)"); return; }
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setCustomSoundBase64(base64);
        setIsUsingCustom(true);
        new Audio(base64).play().catch(() => {});
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAddingProduct(true);
    const variants = newProductVariants
      .filter(v => v.name.trim() !== '')
      .map((v, i) => ({
        id: `v-${Date.now()}-${i}`,
        name: v.name,
        price: Number(v.price) || Number(newProduct.price)
      }));
    try {
      const { data, error } = await supabase.from('products').insert([{
        name: newProduct.name,
        price_pkr: Number(newProduct.price),
        image: newProduct.image || PLACEHOLDER_IMAGE,
        category: newProduct.category,
        description: newProduct.description,
        inventory: 10,
        variants: variants
      }]).select();
      if (!error && data) {
        setProducts(prev => [...prev, {
          id: String(data[0].id),
          name: data[0].name,
          description: data[0].description,
          price: Number(data[0].price_pkr),
          image: data[0].image,
          category: data[0].category,
          inventory: 10,
          rating: 5,
          reviews: [],
          variants: data[0].variants || []
        }]);
        setNewProduct({ name: '', price: '', image: '', category: 'Luxury', description: '' });
        setNewProductVariants([]);
        setImagePreview(null);
      }
    } finally { setIsAddingProduct(false); }
  };

  const analyticsData = useMemo(() => {
    const revenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
    const dailyMap: Record<string, number> = {};
    orders.forEach(o => {
      const date = new Date(o.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      dailyMap[date] = (dailyMap[date] || 0) + (o.total || 0);
    });
    const chartData = Object.entries(dailyMap).map(([name, value]) => ({ name, value })).reverse().slice(-7);
    return { revenue, count: orders.length, chartData };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    let result = [...orders];
    if (orderSearch) {
      const s = orderSearch.toLowerCase();
      result = result.filter(o => 
        (o.customer?.name || '').toLowerCase().includes(s) || 
        (o.id || '').toLowerCase().includes(s) ||
        (o.customer?.phone || '').includes(s)
      );
    }
    return result;
  }, [orders, orderSearch]);

  const handleStatusChange = async (orderId: string, status: Order['status'], dbId?: number) => {
    if (isUpdatingStatus) return;
    setIsUpdatingStatus(true);
    if (updateStatusOverride) updateStatusOverride(orderId, status);
    if (viewingOrder?.id === orderId) setViewingOrder(prev => prev ? { ...prev, status } : null);
    try {
      const dbStatus = status.toLowerCase();
      let query = supabase.from('orders').update({ status: dbStatus });
      if (dbId) query = query.eq('id', dbId);
      else query = query.eq('order_id', orderId);
      const { error } = await query;
      if (!error) setUpdateSuccess(`${status} Confirmed`);
      setTimeout(() => setUpdateSuccess(null), 3000);
    } finally { setIsUpdatingStatus(false); }
  };

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-32 flex flex-col items-center">
        <h2 className="text-2xl font-serif italic font-bold uppercase mb-8 text-black">Console Login</h2>
        <form onSubmit={(e) => { e.preventDefault(); if (adminPasswordInput === systemPassword) login(UserRole.ADMIN); }} className="w-full max-w-xs space-y-4">
          <input type="password" placeholder="Passkey" className="w-full p-6 bg-white border rounded-2xl text-center outline-none text-black" value={adminPasswordInput} onChange={(e) => setAdminPasswordInput(e.target.value)} />
          <button type="submit" className="w-full p-6 bg-black text-white rounded-2xl font-black uppercase tracking-widest hover:bg-blue-600 transition italic">Enter ITX Console</button>
        </form>
      </div>
    );
  }

  return (
    <div className="bg-[#fafafa] min-h-screen pb-24 text-black overflow-x-hidden">
      <div className="container mx-auto px-4 md:px-8 py-4 md:py-12">
        {!isAudioUnlocked && (
          <div className="bg-blue-600 text-white p-4 rounded-2xl mb-8 flex items-center justify-between shadow-lg">
             <p className="font-bold text-[9px] uppercase tracking-widest leading-tight">Authorize Audio Alerts</p>
             <button onClick={unlockAudio} className="bg-white text-blue-600 px-3 py-1.5 rounded-lg font-black uppercase text-[8px] tracking-widest italic">Allow Audio</button>
          </div>
        )}

        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4">
          <div className="flex items-center space-x-6">
            <h1 className="text-2xl font-serif font-bold italic">ITX <span className="text-blue-600">Console</span></h1>
            <button onClick={handleRefresh} className={`w-10 h-10 rounded-xl bg-white border flex items-center justify-center text-gray-400 hover:text-blue-600 transition-all ${isRefreshing ? 'animate-spin text-blue-600' : ''}`}><i className="fas fa-sync-alt text-xs"></i></button>
          </div>
          <div className="flex bg-white rounded-xl p-1 border shadow-sm overflow-x-auto no-scrollbar">
            {['overview', 'products', 'orders', 'settings'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab as any)} className={`px-4 py-2 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-black text-white shadow-md' : 'text-gray-400 hover:text-black'}`}>{tab}</button>
            ))}
          </div>
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-8 animate-fadeIn">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
              <div className="bg-black text-white p-8 rounded-3xl shadow-xl">
                <p className="text-[9px] font-black uppercase opacity-60 mb-2 italic">Revenue Flow</p>
                <p className="text-3xl font-black italic">Rs. {analyticsData.revenue.toLocaleString()}</p>
              </div>
              <div className="bg-white p-8 rounded-3xl border shadow-sm">
                <p className="text-[9px] font-black uppercase text-gray-400 mb-2 italic">Total Orders</p>
                <p className="text-3xl font-black italic">{analyticsData.count}</p>
              </div>
              <div className="bg-white p-8 rounded-3xl border shadow-sm">
                <p className="text-[9px] font-black uppercase text-gray-400 mb-2 italic">Listings</p>
                <p className="text-3xl font-black italic">{products.length}</p>
              </div>
            </div>
            <div className="bg-white p-8 rounded-[2rem] border shadow-sm">
               <h3 className="text-sm font-black uppercase tracking-widest mb-8 italic">Revenue Trends (Daily)</h3>
               <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analyticsData.chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 900, fill: '#ccc'}} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 900, fill: '#ccc'}} />
                      <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '10px'}} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {analyticsData.chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={index === analyticsData.chartData.length - 1 ? '#2563eb' : '#000'} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
               </div>
            </div>
          </div>
        )}

        {activeTab === 'products' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fadeIn">
            <div className="lg:col-span-4">
               <div className="bg-white p-6 rounded-3xl border shadow-sm sticky top-24">
                  <h3 className="text-xs font-black uppercase tracking-widest mb-6 italic">Add Watch</h3>
                  <form onSubmit={handleCreateProduct} className="space-y-4">
                    <label className="block w-full aspect-video bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl cursor-pointer hover:border-black transition flex flex-col items-center justify-center overflow-hidden">
                      {imagePreview ? <img src={imagePreview} className="w-full h-full object-cover" /> : <span className="text-[9px] font-black text-gray-400">UPLOAD MEDIA</span>}
                      <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                    </label>
                    <input required type="text" placeholder="Watch Name" className="w-full bg-gray-50 p-4 rounded-xl text-[10px] font-bold outline-none border focus:border-black" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} />
                    <input required type="number" placeholder="Base Price" className="w-full bg-gray-50 p-4 rounded-xl text-[10px] font-bold outline-none border focus:border-black" value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: e.target.value})} />
                    <textarea required placeholder="Description" className="w-full bg-gray-50 p-4 rounded-xl text-[10px] font-bold outline-none border focus:border-black h-24" value={newProduct.description} onChange={e => setNewProduct({...newProduct, description: e.target.value})} />
                    <div className="pt-4 border-t">
                       <button type="button" onClick={() => setNewProductVariants([...newProductVariants, {name: '', price: ''}])} className="text-[9px] font-black uppercase text-blue-600 mb-2">+ Add Variant</button>
                       {newProductVariants.map((v, i) => (
                         <div key={i} className="flex space-x-2 mb-2">
                           <input type="text" placeholder="Style" className="flex-grow bg-gray-50 p-2 rounded-lg text-[9px] border outline-none" value={v.name} onChange={e => { const updated = [...newProductVariants]; updated[i].name = e.target.value; setNewProductVariants(updated); }} />
                           <input type="number" placeholder="Price" className="w-20 bg-gray-50 p-2 rounded-lg text-[9px] border outline-none" value={v.price} onChange={e => { const updated = [...newProductVariants]; updated[i].price = e.target.value; setNewProductVariants(updated); }} />
                         </div>
                       ))}
                    </div>
                    <button type="submit" disabled={isAddingProduct} className="w-full bg-black text-white py-4 rounded-xl font-black uppercase text-[10px] hover:bg-blue-600 transition italic shadow-lg">
                      {isAddingProduct ? 'Syncing...' : 'Add Listing'}
                    </button>
                  </form>
               </div>
            </div>
            <div className="lg:col-span-8 space-y-4">
               <h3 className="text-xs font-black uppercase mb-2 italic">Collection</h3>
               {products.map(p => (
                 <div key={p.id} className="bg-white p-6 rounded-3xl border shadow-sm flex flex-col md:flex-row md:items-center gap-4">
                    <img src={p.image} className="w-20 h-20 rounded-2xl object-cover border" />
                    <div className="flex-grow min-w-0">
                       <h4 className="text-sm font-black uppercase italic truncate">{p.name}</h4>
                       <p className="text-[10px] font-bold text-blue-600">Base: Rs. {p.price.toLocaleString()}</p>
                    </div>
                    <button onClick={() => deleteProduct(p.id)} className="w-10 h-10 rounded-2xl bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition flex items-center justify-center shadow-sm"><i className="fas fa-trash text-xs"></i></button>
                 </div>
               ))}
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-serif italic font-bold uppercase">Order Ledger</h2>
              <input type="text" placeholder="Search ID/Name..." className="bg-white rounded-xl border px-4 py-2 text-[9px] font-bold uppercase outline-none shadow-sm w-48" value={orderSearch} onChange={e => setOrderSearch(e.target.value)} />
            </div>
            <div className="space-y-3">
               {filteredOrders.map(o => (
                 <div key={o.id} onClick={() => setViewingOrder(o)} className="bg-white p-5 rounded-2xl border shadow-sm cursor-pointer hover:border-blue-200">
                    <div className="flex justify-between items-center mb-4">
                       <span className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase italic ${o.status === 'Pending' ? 'bg-yellow-400' : 'bg-green-600 text-white'}`}>{o.status}</span>
                       <p className="text-blue-600 font-black text-xs">#{o.id}</p>
                    </div>
                    <div className="flex justify-between items-center">
                       <p className="text-[10px] font-black uppercase italic">{o.customer?.name || 'Anonymous'}</p>
                       <p className="text-[10px] font-black text-blue-600 italic">Rs. {(o.total || 0).toLocaleString()}</p>
                    </div>
                 </div>
               ))}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-12 animate-fadeIn max-w-2xl mx-auto py-8">
            <div className="bg-white p-8 rounded-3xl shadow-sm border">
              <h3 className="text-sm font-black uppercase mb-6 italic"><i className="fas fa-lock mr-2 text-blue-600"></i> Authentication</h3>
              <input type="password" className="w-full bg-gray-50 border rounded-2xl px-5 py-4 font-bold focus:outline-none focus:ring-2 focus:ring-black" value={systemPassword} onChange={(e) => setSystemPassword(e.target.value)} />
            </div>
            <div className="bg-white p-8 rounded-3xl shadow-sm border">
              <h3 className="text-sm font-black uppercase mb-6 italic"><i className="fas fa-bell mr-2 text-blue-600"></i> Order Notifications</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
                {PRESET_SOUNDS.map((sound) => (
                  <button key={sound.name} onClick={() => { setSelectedSoundUrl(sound.url); setIsUsingCustom(false); new Audio(sound.url).play().catch(() => {}); }} className={`px-4 py-3 rounded-xl border text-[9px] font-black uppercase text-left flex justify-between items-center ${!isUsingCustom && selectedSoundUrl === sound.url ? 'bg-black text-white shadow-lg' : 'bg-white text-gray-500'}`}>{sound.name}</button>
                ))}
              </div>
              <div className="pt-4 border-t">
                <label className="block text-[10px] font-black uppercase text-gray-400 italic mb-4">Custom Tone</label>
                <div className="flex flex-col sm:flex-row gap-4">
                  <label className="px-6 py-4 bg-gray-50 border-2 border-dashed rounded-2xl cursor-pointer hover:border-black transition text-center flex-grow">
                    <input type="file" className="hidden" accept="audio/*" onChange={handleCustomSoundUpload} />
                    <span className="text-[9px] font-black uppercase text-gray-400">UPLOAD MP3/WAV</span>
                  </label>
                  {customSoundBase64 && (
                    <button onClick={() => { setIsUsingCustom(true); new Audio(customSoundBase64).play().catch(() => {}); }} className={`px-6 py-4 rounded-2xl border flex items-center justify-between text-[9px] font-black uppercase ${isUsingCustom ? 'bg-black text-white' : 'bg-white'}`}>PLAY CUSTOM</button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {viewingOrder && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-white rounded-[2.5rem] w-full max-w-xl p-8 overflow-y-auto max-h-[90vh] shadow-2xl">
            <div className="flex justify-between items-start mb-8 text-black">
               <h2 className="text-xl font-serif font-bold italic uppercase">Order Detail</h2>
               <button onClick={() => setViewingOrder(null)} className="w-8 h-8 bg-gray-50 rounded-full flex items-center justify-center"><i className="fas fa-times"></i></button>
            </div>
            <div className="space-y-6 mb-8 text-black">
              {['name', 'phone', 'city', 'address'].map(f => (
                <div key={f} className="flex justify-between border-b pb-2">
                  <span className="text-[10px] font-black uppercase text-gray-400">{f}</span>
                  <span className="text-[10px] font-bold italic">{(viewingOrder.customer as any)[f] || 'N/A'}</span>
                </div>
              ))}
            </div>
            <div className="bg-black text-white p-6 rounded-[1.5rem] flex flex-col sm:flex-row justify-between items-center gap-4">
               <p className="text-xl font-black italic">Rs. {(viewingOrder.total || 0).toLocaleString()}</p>
               <select value={viewingOrder.status} onChange={(e) => handleStatusChange(viewingOrder.id, e.target.value as any, viewingOrder.dbId)} className="bg-white/10 border border-white/20 text-[9px] font-black uppercase px-6 py-3 rounded-lg outline-none italic cursor-pointer">
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
