
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

  const [newProduct, setNewProduct] = useState({ name: '', price: '', category: 'Luxury', description: '' });
  const [newProductImages, setNewProductImages] = useState<string[]>([]);
  const [newProductVariants, setNewProductVariants] = useState<{name: string, price: string}[]>([]);
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

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
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach((file: File) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64 = event.target?.result as string;
          setNewProductImages(prev => [...prev, base64]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removeNewImage = (index: number) => {
    setNewProductImages(prev => prev.filter((_, i) => i !== index));
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
    setSubmissionStatus(null);

    const variants = newProductVariants
      .filter(v => v.name.trim() !== '')
      .map((v, i) => ({
        id: `v-${Date.now()}-${i}`,
        name: v.name,
        price: Number(v.price) || Number(newProduct.price)
      }));

    try {
      // Logic adjusted to match the provided SQL schema:
      // - 'image' column exists (using first uploaded image)
      // - 'features' column used for the full array of images (jsonb)
      // - 'variants' column exists (jsonb)
      const payload = {
        name: newProduct.name,
        price_pkr: Number(newProduct.price),
        image: newProductImages[0] || PLACEHOLDER_IMAGE,
        features: newProductImages.length > 0 ? newProductImages : [PLACEHOLDER_IMAGE],
        category: newProduct.category,
        description: newProduct.description,
        inventory: 10,
        variants: variants,
        status: 'active'
      };

      const { data, error } = await supabase.from('products').insert([payload]).select();

      if (error) {
        console.error("Supabase Error:", error);
        setSubmissionStatus({ type: 'error', message: `Sync Failed: ${error.message}` });
        return;
      }

      if (data && data.length > 0) {
        setProducts(prev => [...prev, {
          id: String(data[0].id),
          name: data[0].name,
          description: data[0].description,
          price: Number(data[0].price_pkr),
          image: data[0].image,
          images: data[0].features || [], // features stores our images
          category: data[0].category,
          inventory: 10,
          rating: 5,
          reviews: [],
          variants: data[0].variants || []
        }]);
        
        setNewProduct({ name: '', price: '', category: 'Luxury', description: '' });
        setNewProductImages([]);
        setNewProductVariants([]);
        setSubmissionStatus({ type: 'success', message: 'Masterwork Registered Successfully' });
        setTimeout(() => setSubmissionStatus(null), 5000);
      }
    } catch (err: any) {
      setSubmissionStatus({ type: 'error', message: `Failure: ${err.message}` });
    } finally { 
      setIsAddingProduct(false); 
    }
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
    } finally { setIsUpdatingStatus(false); }
  };

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-32 flex flex-col items-center">
        <div className="mb-12 text-center">
          <h2 className="text-4xl font-serif italic font-bold uppercase mb-2 text-black">Console Access</h2>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-400">Restricted Merchant Environment</p>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); if (adminPasswordInput === systemPassword) login(UserRole.ADMIN); }} className="w-full max-w-xs space-y-6">
          <input 
            type="password" 
            placeholder="Security Passkey" 
            className="w-full p-6 bg-white border border-gray-100 rounded-3xl text-center outline-none text-black font-bold focus:border-black transition-all shadow-sm" 
            value={adminPasswordInput} 
            onChange={(e) => setAdminPasswordInput(e.target.value)} 
          />
          <button type="submit" className="w-full p-6 bg-black text-white rounded-3xl font-black uppercase tracking-[0.3em] hover:bg-blue-600 transition shadow-2xl italic text-[11px]">Authenticate Protocol</button>
        </form>
      </div>
    );
  }

  return (
    <div className="bg-[#fcfcfc] min-h-screen pb-24 text-black overflow-x-hidden">
      {/* Fixed Header Bar for Mobile */}
      <div className="lg:hidden sticky top-0 z-50 bg-white/80 backdrop-blur-md px-6 py-4 border-b border-gray-100 flex justify-between items-center">
         <h1 className="text-xl font-serif font-bold italic">ITX <span className="text-blue-600">Console</span></h1>
         <button onClick={handleRefresh} className={`text-gray-400 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`}><i className="fas fa-sync-alt text-sm"></i></button>
      </div>

      <div className="container mx-auto px-4 md:px-12 py-6 md:py-16">
        
        {/* Status Notifications */}
        {submissionStatus && (
          <div className="fixed bottom-6 left-4 right-4 z-[1000] p-5 rounded-2xl shadow-2xl animate-fadeIn bg-black text-white">
            <div className="flex items-center space-x-3">
              <i className={`fas ${submissionStatus.type === 'success' ? 'fa-check-circle text-green-500' : 'fa-exclamation-triangle text-red-500'}`}></i>
              <p className="text-[11px] font-black uppercase tracking-widest">{submissionStatus.message}</p>
              <button onClick={() => setSubmissionStatus(null)} className="ml-auto opacity-50"><i className="fas fa-times"></i></button>
            </div>
          </div>
        )}

        {/* Dashboard Header - Hidden on small mobile in favor of fixed bar */}
        <div className="hidden lg:flex flex-col lg:flex-row justify-between items-start lg:items-end mb-16 gap-8">
          <div className="space-y-3">
            <div className="flex items-center space-x-4">
              <h1 className="text-4xl md:text-5xl font-serif font-bold italic tracking-tighter">ITX <span className="text-blue-600">Console</span></h1>
              <button onClick={handleRefresh} className={`w-12 h-12 rounded-full bg-white border border-gray-100 shadow-sm flex items-center justify-center text-gray-300 hover:text-blue-600 transition-all ${isRefreshing ? 'animate-spin text-blue-600' : ''}`}>
                <i className="fas fa-sync-alt text-xs"></i>
              </button>
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.5em] text-gray-400 italic">Merchant Master Interface • v2.0</p>
          </div>
          
          <nav className="flex bg-white/50 backdrop-blur-md rounded-2xl p-1.5 border border-gray-100 shadow-sm overflow-x-auto no-scrollbar">
            {['overview', 'products', 'orders', 'settings'].map(tab => (
              <button 
                key={tab} 
                onClick={() => setActiveTab(tab as any)} 
                className={`px-6 py-3 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] transition-all whitespace-nowrap ${activeTab === tab ? 'bg-black text-white shadow-xl' : 'text-gray-400 hover:text-black'}`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>

        {/* Mobile Navigation Pills */}
        <div className="lg:hidden mb-8 overflow-x-auto no-scrollbar flex items-center space-x-3 px-2">
            {['overview', 'products', 'orders', 'settings'].map(tab => (
              <button 
                key={tab} 
                onClick={() => setActiveTab(tab as any)} 
                className={`px-5 py-3 rounded-full text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap border shadow-sm ${activeTab === tab ? 'bg-black text-white border-black' : 'bg-white text-gray-400 border-gray-100'}`}
              >
                {tab}
              </button>
            ))}
        </div>

        {/* Tab Content: Overview */}
        {activeTab === 'overview' && (
          <div className="space-y-8 lg:space-y-12 animate-fadeIn px-2">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-8">
              <div className="bg-black text-white p-8 lg:p-10 rounded-[2rem] lg:rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
                <div className="relative z-10">
                  <p className="text-[9px] lg:text-[10px] font-black uppercase tracking-[0.3em] opacity-40 mb-3 italic">Gross Revenue</p>
                  <p className="text-3xl lg:text-4xl font-serif font-bold italic">Rs. {analyticsData.revenue.toLocaleString()}</p>
                </div>
              </div>
              <div className="bg-white p-8 lg:p-10 rounded-[2rem] lg:rounded-[2.5rem] border border-gray-100 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-[9px] lg:text-[10px] font-black uppercase tracking-[0.3em] text-gray-300 mb-3 italic">Ledger</p>
                  <p className="text-3xl lg:text-4xl font-serif font-bold italic">{analyticsData.count} <span className="text-[10px] uppercase font-black text-gray-300 ml-1">Orders</span></p>
                </div>
                <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center text-gray-300 lg:hidden">
                    <i className="fas fa-shopping-bag"></i>
                </div>
              </div>
              <div className="bg-white p-8 lg:p-10 rounded-[2rem] lg:rounded-[2.5rem] border border-gray-100 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-[9px] lg:text-[10px] font-black uppercase tracking-[0.3em] text-gray-300 mb-3 italic">Portfolio</p>
                  <p className="text-3xl lg:text-4xl font-serif font-bold italic">{products.length} <span className="text-[10px] uppercase font-black text-gray-300 ml-1">Items</span></p>
                </div>
                 <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center text-gray-300 lg:hidden">
                    <i className="fas fa-gem"></i>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 lg:p-12 rounded-[2rem] lg:rounded-[3rem] border border-gray-100 shadow-sm overflow-hidden">
               <div className="flex justify-between items-center mb-10">
                 <h3 className="text-[10px] font-black uppercase tracking-[0.3em] italic">Performance Flow</h3>
                 <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">7-Day Analysis</span>
               </div>
               <div className="h-64 lg:h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analyticsData.chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 8, fontWeight: 900, fill: '#cbd5e1'}} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{fontSize: 8, fontWeight: 900, fill: '#cbd5e1'}} />
                      <Tooltip contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.1)', fontSize: '9px', fontWeight: 'bold', padding: '12px'}} />
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

        {/* Tab Content: Products */}
        {activeTab === 'products' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 animate-fadeIn">
            <div className="lg:col-span-5 order-2 lg:order-1 px-2">
               <div className="bg-white p-8 lg:p-10 rounded-[2rem] lg:rounded-[2.5rem] border border-gray-100 shadow-sm">
                  <h3 className="text-xs font-black uppercase tracking-[0.4em] mb-8 italic">New Specification</h3>
                  <form onSubmit={handleCreateProduct} className="space-y-6">
                    <div className="space-y-4">
                      <label className="block w-full h-32 bg-gray-50 border-2 border-dashed border-gray-100 rounded-3xl cursor-pointer hover:border-black transition-all flex flex-col items-center justify-center overflow-hidden group">
                        <i className="fas fa-camera text-gray-300 text-2xl mb-2"></i>
                        <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Add Photos</p>
                        <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
                      </label>
                      {newProductImages.length > 0 && (
                        <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
                          {newProductImages.map((img, idx) => (
                            <div key={idx} className="relative aspect-square w-16 h-16 rounded-xl overflow-hidden border shrink-0">
                              <img src={img} className="w-full h-full object-cover" />
                              <button type="button" onClick={() => removeNewImage(idx)} className="absolute top-0.5 right-0.5 bg-black/50 text-white w-4 h-4 rounded-full flex items-center justify-center text-[7px]"><i className="fas fa-times"></i></button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <div className="space-y-4">
                      <input required type="text" placeholder="Timepiece Title" className="w-full bg-gray-50 p-4 rounded-xl text-xs font-bold outline-none border border-transparent focus:border-black transition" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} />
                      <input required type="number" placeholder="Valuation (PKR)" className="w-full bg-gray-50 p-4 rounded-xl text-xs font-bold outline-none border border-transparent focus:border-black transition" value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: e.target.value})} />
                      <textarea required placeholder="Artisanal Narrative" className="w-full bg-gray-50 p-4 rounded-xl text-xs font-bold outline-none border border-transparent focus:border-black transition h-32 resize-none" value={newProduct.description} onChange={e => setNewProduct({...newProduct, description: e.target.value})} />
                    </div>

                    <div className="pt-6 border-t border-gray-50">
                       <button type="button" onClick={() => setNewProductVariants([...newProductVariants, {name: '', price: ''}])} className="text-[9px] font-black uppercase text-blue-600 mb-4">+ Add Style</button>
                       <div className="space-y-3">
                         {newProductVariants.map((v, i) => (
                           <div key={i} className="flex space-x-2 items-center">
                             <input required type="text" placeholder="Style Name" className="flex-grow bg-gray-50 p-3 rounded-xl text-[10px] font-bold outline-none" value={v.name} onChange={e => { const updated = [...newProductVariants]; updated[i].name = e.target.value; setNewProductVariants(updated); }} />
                             <input type="number" placeholder="Price" className="w-20 bg-gray-50 p-3 rounded-xl text-[10px] font-bold outline-none" value={v.price} onChange={e => { const updated = [...newProductVariants]; updated[i].price = e.target.value; setNewProductVariants(updated); }} />
                             <button type="button" onClick={() => setNewProductVariants(newProductVariants.filter((_, idx) => idx !== i))} className="text-red-400"><i className="fas fa-times text-xs"></i></button>
                           </div>
                         ))}
                       </div>
                    </div>

                    <button type="submit" disabled={isAddingProduct} className="w-full bg-black text-white py-5 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] shadow-xl italic active:scale-95 disabled:opacity-50">
                      {isAddingProduct ? 'Syncing...' : 'Register Timepiece'}
                    </button>
                  </form>
               </div>
            </div>

            <div className="lg:col-span-7 space-y-4 order-1 lg:order-2 px-2">
               <h3 className="text-[10px] font-black uppercase tracking-[0.4em] mb-4 italic text-gray-400">Archived Inventory</h3>
               {products.length > 0 ? products.map(p => (
                 <div key={p.id} className="bg-white p-5 lg:p-8 rounded-[1.5rem] lg:rounded-[2rem] border border-gray-100 shadow-sm flex items-center gap-4 lg:gap-6 group">
                    <div className="w-16 h-16 lg:w-24 lg:h-24 rounded-2xl overflow-hidden shrink-0 border border-gray-50 shadow-inner">
                      <img src={p.image} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-grow min-w-0">
                       <h4 className="text-sm lg:text-lg font-serif font-bold italic truncate">{p.name}</h4>
                       <p className="text-[9px] font-black text-blue-600 mt-0.5 uppercase tracking-widest">Rs. {p.price.toLocaleString()}</p>
                    </div>
                    <button onClick={() => deleteProduct(p.id)} className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition flex items-center justify-center shrink-0">
                         <i className="fas fa-trash-alt text-xs"></i>
                    </button>
                 </div>
               )) : (
                 <div className="text-center py-20 bg-white rounded-[2rem] border-2 border-dashed border-gray-100 text-gray-200">
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] italic">Portfolio Vacant</p>
                 </div>
               )}
            </div>
          </div>
        )}

        {/* Tab Content: Orders */}
        {activeTab === 'orders' && (
          <div className="space-y-6 lg:space-y-10 animate-fadeIn px-2">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <h2 className="text-2xl lg:text-3xl font-serif italic font-bold">Order Ledger</h2>
              <div className="relative w-full md:w-80">
                <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 text-[10px]"></i>
                <input type="text" placeholder="Search Master ID..." className="w-full bg-white rounded-xl border border-gray-100 pl-10 pr-6 py-3.5 text-[9px] font-bold uppercase outline-none shadow-sm focus:border-black transition-all" value={orderSearch} onChange={e => setOrderSearch(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
               {filteredOrders.length > 0 ? filteredOrders.map(o => (
                 <div key={o.id} onClick={() => setViewingOrder(o)} className="bg-white p-6 lg:p-8 rounded-[1.5rem] lg:rounded-[2rem] border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer active:scale-[0.98] transition-all">
                    <div className="flex items-center space-x-4">
                       <div className={`w-2 h-2 rounded-full ${o.status === 'Pending' ? 'bg-yellow-400 animate-pulse' : o.status === 'Cancelled' ? 'bg-red-500' : 'bg-green-600'}`}></div>
                       <div>
                         <p className="text-[8px] font-black text-gray-300 uppercase tracking-widest mb-0.5">#{o.id}</p>
                         <h4 className="text-sm font-serif font-bold italic">{o.customer?.name}</h4>
                       </div>
                    </div>
                    <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 pt-3 md:pt-0">
                       <div className="text-left md:text-right">
                          <p className="text-lg font-black italic">Rs. {o.total.toLocaleString()}</p>
                       </div>
                       <div className={`px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest italic shadow-sm ${o.status === 'Pending' ? 'bg-yellow-50 text-yellow-600' : o.status === 'Cancelled' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                         {o.status}
                       </div>
                    </div>
                 </div>
               )) : (
                 <div className="text-center py-20 text-gray-200">
                    <p className="text-[10px] uppercase font-black tracking-[0.3em] italic">No Transactions Logged</p>
                 </div>
               )}
            </div>
          </div>
        )}

        {/* Tab Content: Settings */}
        {activeTab === 'settings' && (
          <div className="space-y-8 animate-fadeIn max-w-xl mx-auto py-6 px-2">
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] italic mb-8">Security Protocol</h3>
              <input type="password" className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-6 py-4 font-bold focus:outline-none text-black text-sm" value={systemPassword} onChange={(e) => setSystemPassword(e.target.value)} />
            </div>

            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] italic mb-8">Audio Profiles</h3>
              <div className="grid grid-cols-1 gap-2">
                {PRESET_SOUNDS.map((sound) => (
                  <button key={sound.name} onClick={() => { setSelectedSoundUrl(sound.url); setIsUsingCustom(false); new Audio(sound.url).play().catch(() => {}); }} className={`px-5 py-4 rounded-xl border text-[9px] font-black uppercase tracking-widest text-left flex justify-between items-center transition-all ${!isUsingCustom && selectedSoundUrl === sound.url ? 'bg-black text-white' : 'bg-white text-gray-400 border-gray-100'}`}>
                    {sound.name}
                    {(!isUsingCustom && selectedSoundUrl === sound.url) && <i className="fas fa-check-circle text-blue-400"></i>}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Optimized Order Manifest Modal for Mobile */}
      {viewingOrder && (
        <div className="fixed inset-0 z-[2000] flex items-end lg:items-center justify-center bg-black/80 backdrop-blur-xl animate-fadeIn p-0 lg:p-6">
          <div className="bg-white w-full lg:max-w-2xl h-[92vh] lg:h-auto lg:rounded-[3rem] overflow-hidden flex flex-col relative shadow-2xl">
            {/* Modal Header */}
            <div className="px-8 py-6 border-b border-gray-50 flex justify-between items-center bg-white sticky top-0 z-10">
               <div>
                  <h2 className="text-2xl font-serif font-bold italic">Manifest</h2>
                  <p className="text-[8px] font-black text-blue-600 uppercase tracking-widest">REF: #{viewingOrder.id}</p>
               </div>
               <button onClick={() => setViewingOrder(null)} className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center"><i className="fas fa-times"></i></button>
            </div>

            {/* Modal Content Scroll Area */}
            <div className="flex-grow overflow-y-auto custom-scrollbar p-8 pb-32">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
                  <div className="space-y-4">
                     <h4 className="text-[9px] font-black uppercase tracking-widest text-gray-300 italic border-b pb-2">Logistics Profile</h4>
                     {[
                       {label: 'RECIPIENT', value: viewingOrder.customer?.name},
                       {label: 'CONTACT', value: viewingOrder.customer?.phone},
                       {label: 'CITY', value: viewingOrder.customer?.city}
                     ].map((item, i) => (
                       <div key={i}>
                          <p className="text-[7px] font-black uppercase text-gray-400 tracking-tighter">{item.label}</p>
                          <div className="flex items-center justify-between group">
                            <p className="text-sm font-bold uppercase italic">{item.value || 'N/A'}</p>
                            <button onClick={() => handleCopy(item.value || '', item.label)} className="text-gray-200"><i className="fas fa-copy text-[10px]"></i></button>
                          </div>
                       </div>
                     ))}
                  </div>
                  <div className="space-y-4">
                     <h4 className="text-[9px] font-black uppercase tracking-widest text-gray-300 italic border-b pb-2">Manifest Address</h4>
                     <p className="text-xs font-bold leading-relaxed">{viewingOrder.customer?.address || 'N/A'}</p>
                  </div>
               </div>

               <div className="bg-gray-50 rounded-2xl p-6 space-y-4 mb-8">
                  <h4 className="text-[9px] font-black uppercase tracking-widest text-gray-400 italic">Inventory Invoiced</h4>
                  {viewingOrder.items.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between border-b border-white/50 pb-3 last:border-0">
                       <p className="text-xs font-bold italic truncate max-w-[70%]">{item.product.name} (x{item.quantity})</p>
                       <p className="text-xs font-black">Rs. {(item.product.price * item.quantity).toLocaleString()}</p>
                    </div>
                  ))}
               </div>
            </div>

            {/* Fixed Footer Status Switcher for Mobile */}
            <div className="absolute bottom-0 left-0 right-0 bg-black p-6 lg:p-8 flex flex-col lg:flex-row justify-between items-center gap-4 lg:gap-8 border-t border-white/10">
               <div className="text-center lg:text-left">
                  <p className="text-[8px] font-black uppercase opacity-40 tracking-widest text-white italic">Manifest Total</p>
                  <p className="text-2xl font-serif font-bold italic text-white">Rs. {viewingOrder.total.toLocaleString()}</p>
               </div>
               <div className="w-full lg:w-48 relative">
                  <select 
                    disabled={isUpdatingStatus}
                    value={viewingOrder.status} 
                    onChange={(e) => handleStatusChange(viewingOrder.id, e.target.value as any, viewingOrder.dbId)} 
                    className="w-full bg-white/10 border border-white/20 text-[10px] font-black uppercase px-6 py-4 rounded-xl text-white outline-none appearance-none text-center italic"
                  >
                    {['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'].map(s => <option key={s} value={s} className="text-black">{s}</option>)}
                  </select>
                  {isUpdatingStatus && <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10 rounded-xl"><i className="fas fa-circle-notch fa-spin text-white"></i></div>}
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
