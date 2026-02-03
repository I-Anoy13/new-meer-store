
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

  // Product Form State
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
      audio.play().catch(e => console.debug('Audio deferred:', e.message));
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
      if (file.size > 2 * 1024 * 1024) {
        alert("Sound file too large (Max 2MB)");
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setCustomSoundBase64(base64);
        setIsUsingCustom(true);
        // Instant test
        new Audio(base64).play().catch(() => {});
      };
      reader.readAsDataURL(file);
    }
  };

  const addVariantField = () => {
    setNewProductVariants([...newProductVariants, { name: '', price: '' }]);
  };

  const removeVariantField = (index: number) => {
    setNewProductVariants(newProductVariants.filter((_, i) => i !== index));
  };

  const handleVariantChange = (index: number, field: 'name' | 'price', value: string) => {
    const updated = [...newProductVariants];
    updated[index][field] = value;
    setNewProductVariants(updated);
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
    } finally {
      setIsAddingProduct(false);
    }
  };

  const analyticsData = useMemo(() => {
    const revenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
    const count = orders.length;

    const dailyMap: Record<string, number> = {};
    orders.forEach(o => {
      const date = new Date(o.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      dailyMap[date] = (dailyMap[date] || 0) + (o.total || 0);
    });

    const chartData = Object.entries(dailyMap).map(([name, value]) => ({ name, value })).reverse().slice(-7);
    return { revenue, count, chartData };
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
    } catch (e) {} finally {
      setIsUpdatingStatus(false);
    }
  };

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-32 flex flex-col items-center">
        <h2 className="text-2xl font-serif italic font-bold uppercase mb-8 text-black">Console Secure Login</h2>
        <form onSubmit={(e) => { e.preventDefault(); if (adminPasswordInput === systemPassword) login(UserRole.ADMIN); }} className="w-full max-w-xs space-y-4">
          <input type="password" placeholder="Passkey" required className="w-full p-6 bg-white border border-gray-100 rounded-2xl font-black text-center outline-none shadow-sm text-black italic" value={adminPasswordInput} onChange={(e) => setAdminPasswordInput(e.target.value)} />
          <button type="submit" className="w-full p-6 bg-black text-white rounded-2xl font-black uppercase tracking-widest hover:bg-blue-600 transition shadow-xl italic">Verify Merchant</button>
        </form>
      </div>
    );
  }

  return (
    <div className="bg-[#fafafa] min-h-screen pb-24 text-black overflow-x-hidden">
      <div className="container mx-auto px-4 md:px-8 py-4 md:py-12">
        
        {!isAudioUnlocked && (
          <div className="bg-blue-600 text-white p-4 rounded-2xl mb-8 flex items-center justify-between shadow-lg animate-fadeIn">
             <div className="flex items-center space-x-3">
                <i className="fas fa-bullhorn text-sm"></i>
                <p className="font-bold text-[9px] uppercase tracking-widest leading-tight">Authorize Real-Time Audio Alerts</p>
             </div>
             <button onClick={unlockAudio} className="bg-white text-blue-600 px-3 py-1.5 rounded-lg font-black uppercase text-[8px] tracking-widest shadow-md italic">Allow Audio</button>
          </div>
        )}

        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4">
          <div className="flex items-center space-x-6">
            <div className="space-y-0.5">
              <h1 className="text-2xl font-serif font-bold italic">ITX <span className="text-blue-600">Console</span></h1>
              <p className="text-[8px] font-black uppercase tracking-[0.2em] text-gray-400 italic">Merchant Master Protocol</p>
            </div>
            <button 
              onClick={handleRefresh} 
              className={`w-10 h-10 rounded-xl bg-white border border-gray-100 flex items-center justify-center text-gray-400 hover:text-blue-600 transition-all shadow-sm ${isRefreshing ? 'animate-spin text-blue-600' : ''}`}
            >
              <i className="fas fa-sync-alt text-xs"></i>
            </button>
          </div>
          
          <div className="flex bg-white rounded-xl p-1 border border-gray-200 shadow-sm w-full lg:w-auto overflow-x-auto no-scrollbar">
            {['overview', 'products', 'orders', 'settings'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab as any)} className={`flex-1 lg:flex-none px-4 py-2 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-black text-white shadow-md' : 'text-gray-400 hover:text-black'}`}>
                {tab}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-8 animate-fadeIn">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-black text-white p-8 rounded-3xl shadow-xl">
                <p className="text-[9px] font-black uppercase opacity-60 mb-2 tracking-widest italic">Revenue Flow</p>
                <p className="text-3xl font-black italic">Rs. {analyticsData.revenue.toLocaleString()}</p>
              </div>
              <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
                <p className="text-[9px] font-black uppercase text-gray-400 mb-2 tracking-widest italic">Total Orders</p>
                <p className="text-3xl font-black italic">{analyticsData.count}</p>
              </div>
              <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
                <p className="text-[9px] font-black uppercase text-gray-400 mb-2 tracking-widest italic">Listings</p>
                <p className="text-3xl font-black italic">{products.length}</p>
              </div>
            </div>

            <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm">
               <h3 className="text-sm font-black uppercase tracking-widest mb-8 italic">Revenue Trends (Daily)</h3>
               <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analyticsData.chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 900, fill: '#ccc'}} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 900, fill: '#ccc'}} />
                      <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '10px', fontWeight: 'bold'}} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {analyticsData.chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={index === analyticsData.chartData.length - 1 ? '#2563eb' : '#000'} />
                        ))}
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
               <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm sticky top-24">
                  <h3 className="text-xs font-black uppercase tracking-widest mb-6 italic">Add New Watch</h3>
                  <form onSubmit={handleCreateProduct} className="space-y-4">
                    {/* Image Upload Area */}
                    <div className="relative group">
                      <label className="block w-full aspect-video bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl cursor-pointer hover:border-black transition flex flex-col items-center justify-center overflow-hidden">
                        {imagePreview ? (
                          <img src={imagePreview} className="w-full h-full object-cover" />
                        ) : (
                          <>
                            <i className="fas fa-camera text-gray-300 text-2xl mb-2"></i>
                            <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">Upload Media</span>
                          </>
                        )}
                        <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                      </label>
                      {imagePreview && (
                        <button onClick={(e) => { e.preventDefault(); setImagePreview(null); setNewProduct(p => ({...p, image: ''})); }} className="absolute top-2 right-2 bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-[10px] shadow-lg">
                          <i className="fas fa-times"></i>
                        </button>
                      )}
                    </div>

                    <input required type="text" placeholder="Watch Name" className="w-full bg-gray-50 p-4 rounded-xl text-[10px] font-bold outline-none border border-transparent focus:border-black" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} />
                    <input required type="number" placeholder="Base Price (PKR)" className="w-full bg-gray-50 p-4 rounded-xl text-[10px] font-bold outline-none border border-transparent focus:border-black" value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: e.target.value})} />
                    <textarea required placeholder="Description" className="w-full bg-gray-50 p-4 rounded-xl text-[10px] font-bold outline-none border border-transparent focus:border-black h-24" value={newProduct.description} onChange={e => setNewProduct({...newProduct, description: e.target.value})} />
                    
                    {/* Variants Section */}
                    <div className="pt-4 border-t border-gray-50">
                       <div className="flex justify-between items-center mb-3">
                         <h4 className="text-[9px] font-black uppercase tracking-widest text-gray-400 italic">Style Variants</h4>
                         <button type="button" onClick={addVariantField} className="text-[9px] font-black uppercase tracking-widest text-blue-600 hover:text-black transition">+ Add Style</button>
                       </div>
                       <div className="space-y-2">
                         {newProductVariants.map((v, i) => (
                           <div key={i} className="flex space-x-2 items-center animate-fadeIn">
                             <input required type="text" placeholder="Name (e.g. Gold)" className="flex-grow bg-gray-50 p-2 rounded-lg text-[9px] font-bold outline-none border border-transparent focus:border-black" value={v.name} onChange={e => handleVariantChange(i, 'name', e.target.value)} />
                             <input type="number" placeholder="Price" className="w-20 bg-gray-50 p-2 rounded-lg text-[9px] font-bold outline-none border border-transparent focus:border-black" value={v.price} onChange={e => handleVariantChange(i, 'price', e.target.value)} />
                             <button type="button" onClick={() => removeVariantField(i)} className="text-red-400 hover:text-red-600 transition"><i className="fas fa-times text-[10px]"></i></button>
                           </div>
                         ))}
                       </div>
                    </div>

                    <button type="submit" disabled={isAddingProduct} className="w-full bg-black text-white py-4 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-blue-600 transition italic shadow-lg">
                      {isAddingProduct ? 'Syncing...' : 'Add Listing'}
                    </button>
                  </form>
               </div>
            </div>

            <div className="lg:col-span-8 space-y-4">
               <h3 className="text-xs font-black uppercase tracking-widest mb-2 italic px-2">Current Collection</h3>
               {products.length > 0 ? products.map(p => (
                 <div key={p.id} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center gap-4">
                    <img src={p.image} className="w-20 h-20 rounded-2xl object-cover border" />
                    <div className="flex-grow min-w-0">
                       <h4 className="text-sm font-black uppercase italic text-black truncate">{p.name}</h4>
                       <p className="text-[10px] font-bold text-blue-600 mt-0.5">Base: Rs. {p.price.toLocaleString()}</p>
                       {p.variants && p.variants.length > 0 && (
                         <div className="flex flex-wrap gap-2 mt-2">
                           {p.variants.map((v, idx) => (
                             <span key={idx} className="text-[8px] bg-gray-50 text-gray-500 px-2 py-0.5 rounded-full font-black uppercase tracking-tighter italic border border-gray-100">
                               {v.name} (Rs. {v.price.toLocaleString()})
                             </span>
                           ))}
                         </div>
                       )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <button onClick={() => deleteProduct(p.id)} className="w-10 h-10 rounded-2xl bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition flex items-center justify-center shadow-sm">
                         <i className="fas fa-trash text-xs"></i>
                      </button>
                    </div>
                 </div>
               )) : (
                 <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
                    <p className="text-[10px] font-black uppercase text-gray-300 italic">No timepieces listed</p>
                 </div>
               )}
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-serif italic font-bold uppercase">Order Ledger</h2>
              <input type="text" placeholder="Search ID/Name..." className="bg-white rounded-xl border border-gray-200 px-4 py-2 text-[9px] font-bold uppercase outline-none shadow-sm w-48 lg:w-64" value={orderSearch} onChange={e => setOrderSearch(e.target.value)} />
            </div>

            <div className="space-y-3">
               {filteredOrders.length > 0 ? filteredOrders.map(o => (
                 <div key={o.id} onClick={() => setViewingOrder(o)} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm active:scale-[0.98] transition-all cursor-pointer hover:border-blue-200">
                    <div className="flex justify-between items-center mb-4">
                       <span className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest italic shadow-sm ${
                         o.status === 'Pending' ? 'bg-yellow-400 text-white' : 
                         o.status === 'Cancelled' ? 'bg-red-500 text-white' :
                         'bg-green-600 text-white'
                       }`}>
                         {o.status}
                       </span>
                       <p className="text-blue-600 font-black text-xs">#{o.id}</p>
                    </div>
                    <div className="flex justify-between items-center">
                       <p className="text-[10px] font-black uppercase truncate italic text-black">{o.customer?.name || 'Anonymous'}</p>
                       <p className="text-[10px] font-black text-blue-600 italic">Rs. {(o.total || 0).toLocaleString()}</p>
                    </div>
                 </div>
               )) : (
                 <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
                    <i className="fas fa-inbox text-4xl text-gray-100 mb-4 block"></i>
                    <p className="text-[9px] uppercase font-black text-gray-300 tracking-widest italic">No orders found</p>
                 </div>
               )}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-12 animate-fadeIn max-w-2xl mx-auto py-8">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
              <h3 className="text-sm font-black uppercase tracking-[0.2em] mb-6 text-black italic flex items-center">
                <i className="fas fa-lock mr-2 text-blue-600"></i> Authentication
              </h3>
              <div className="space-y-4">
                <label className="block text-[10px] font-black uppercase text-gray-400 italic">Master Console Passkey</label>
                <input type="password" className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 font-bold focus:outline-none focus:ring-2 focus:ring-black transition text-black" value={systemPassword} onChange={(e) => setSystemPassword(e.target.value)} />
              </div>
            </div>

            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
              <h3 className="text-sm font-black uppercase tracking-[0.2em] mb-6 text-black italic flex items-center">
                <i className="fas fa-bell mr-2 text-blue-600"></i> Order Notifications
              </h3>
              <div className="space-y-8">
                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-400 italic mb-4">Alert Sound</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {PRESET_SOUNDS.map((sound) => (
                      <button key={sound.name} onClick={() => { setSelectedSoundUrl(sound.url); setIsUsingCustom(false); new Audio(sound.url).play().catch(() => {}); }} className={`px-4 py-3 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all text-left flex justify-between items-center ${!isUsingCustom && selectedSoundUrl === sound.url ? 'bg-black text-white border-black shadow-lg' : 'bg-white text-gray-500 border-gray-100 hover:border-blue-600'}`}>{sound.name}{(!isUsingCustom && selectedSoundUrl === sound.url) && <i className="fas fa-check-circle text-blue-400"></i>}</button>
                    ))}
                  </div>
                </div>

                {/* Custom Sound UI RESTORED */}
                <div className="pt-4 border-t border-gray-50">
                  <label className="block text-[10px] font-black uppercase text-gray-400 italic mb-4">Custom Notification Tone</label>
                  <div className="flex flex-col sm:flex-row gap-4 items-center">
                    <label className="w-full sm:w-auto px-6 py-4 bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl cursor-pointer hover:border-black transition text-center group">
                      <input type="file" className="hidden" accept="audio/mpeg,audio/wav" onChange={handleCustomSoundUpload} />
                      <i className="fas fa-upload text-gray-300 group-hover:text-black mb-2 block"></i>
                      <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">Upload MP3/WAV</span>
                    </label>
                    
                    {customSoundBase64 && (
                      <button 
                        onClick={() => {
                          setIsUsingCustom(true);
                          new Audio(customSoundBase64).play().catch(() => {});
                        }}
                        className={`flex-grow px-6 py-4 rounded-2xl border flex items-center justify-between text-[9px] font-black uppercase tracking-widest transition-all ${
                          isUsingCustom 
                            ? 'bg-black text-white border-black shadow-lg' 
                            : 'bg-white text-gray-500 border-gray-100 hover:border-black'
                        }`}
                      >
                        <span className="flex items-center"><i className="fas fa-music mr-3"></i> My Custom Tone</span>
                        <i className="fas fa-play-circle text-xs"></i>
                      </button>
                    )}
                  </div>
                  {customSoundBase64 && (
                    <button 
                      onClick={() => { setCustomSoundBase64(null); setIsUsingCustom(false); localStorage.removeItem('itx_custom_alert_b64'); }}
                      className="mt-4 text-[8px] font-black uppercase text-red-400 hover:text-red-600 transition tracking-widest italic"
                    >
                      Delete Custom Tone
                    </button>
                  )}
                </div>

                <div className="pt-4">
                  <button 
                    onClick={playAlert}
                    className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] italic shadow-xl hover:bg-blue-600 transition"
                  >
                    <i className="fas fa-volume-up mr-2"></i> Test Current Sound
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {viewingOrder && (
        <div className="fixed inset-0 z-[500] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-white rounded-t-[2rem] md:rounded-[2.5rem] w-full max-w-xl p-8 overflow-y-auto max-h-[92vh] md:max-h-[95vh] custom-scrollbar shadow-2xl">
            <div className="flex justify-between items-start mb-8 text-black">
               <div>
                  <h2 className="text-xl font-serif font-bold italic uppercase">Order Manifest</h2>
                  <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest italic mt-1">ID: #{viewingOrder.id}</p>
               </div>
               <button onClick={() => setViewingOrder(null)} className="w-8 h-8 bg-gray-50 rounded-full flex items-center justify-center hover:bg-black hover:text-white transition"><i className="fas fa-times text-xs"></i></button>
            </div>
            
            <div className="space-y-6 mb-8 text-black">
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {['name', 'phone', 'city'].map((f) => (
                    <div key={f}>
                      <p className="text-[7px] font-black uppercase text-gray-400 mb-1 italic tracking-widest px-1">{f}</p>
                      <div className="flex items-center justify-between bg-gray-50 p-3.5 rounded-xl border border-gray-100">
                        <p className="font-black uppercase text-[11px] italic truncate text-black">{(viewingOrder.customer as any)[f] || 'N/A'}</p>
                        <button onClick={() => handleCopy((viewingOrder.customer as any)[f] || '', f)} className="text-gray-300 hover:text-blue-600 ml-2"><i className={`fas ${copyStatus === f ? 'fa-check text-green-500' : 'fa-copy'} text-[10px]`}></i></button>
                      </div>
                    </div>
                  ))}
                  <div className="sm:col-span-2">
                    <p className="text-[7px] font-black uppercase text-gray-400 mb-1 italic tracking-widest px-1">Shipping Address</p>
                    <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100">
                       <p className="font-bold italic text-[10px] leading-relaxed text-black">{viewingOrder.customer?.address || 'N/A'}</p>
                    </div>
                  </div>
               </div>
            </div>
            
            <div className="bg-black text-white p-6 rounded-[1.5rem] flex flex-col sm:flex-row justify-between items-center gap-4">
               <div className="text-center sm:text-left">
                  <p className="text-[7px] font-black uppercase opacity-60 mb-1 italic tracking-widest">Update Order Status</p>
                  <p className="text-xl font-black italic">Rs. {(viewingOrder.total || 0).toLocaleString()}</p>
               </div>
               <div className="w-full sm:w-auto relative">
                  {isUpdatingStatus && <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10 rounded-lg"><i className="fas fa-circle-notch fa-spin text-white"></i></div>}
                  <select 
                    disabled={isUpdatingStatus}
                    value={viewingOrder.status} 
                    onChange={(e) => handleStatusChange(viewingOrder.id, e.target.value as any, viewingOrder.dbId)} 
                    className="w-full bg-white/10 border border-white/20 text-[9px] font-black uppercase px-6 py-3 rounded-lg outline-none italic cursor-pointer appearance-none text-center disabled:opacity-50"
                  >
                    {['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'].map(s => <option key={s} value={s} className="text-black">{s}</option>)}
                  </select>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
