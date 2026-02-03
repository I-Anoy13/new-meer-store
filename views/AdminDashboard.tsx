
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
          images: data[0].features || [],
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
      await query;
    } finally { setIsUpdatingStatus(false); }
  };

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-32 flex flex-col items-center">
        <h2 className="text-4xl font-serif font-bold italic uppercase mb-2">Access Portal</h2>
        <form onSubmit={(e) => { e.preventDefault(); if (adminPasswordInput === systemPassword) login(UserRole.ADMIN); }} className="w-full max-w-xs space-y-6">
          <input type="password" placeholder="Passkey" className="w-full p-6 bg-white border rounded-3xl text-center outline-none font-bold" value={adminPasswordInput} onChange={(e) => setAdminPasswordInput(e.target.value)} />
          <button type="submit" className="w-full p-6 bg-black text-white rounded-3xl font-black uppercase tracking-widest italic">Authenticate</button>
        </form>
      </div>
    );
  }

  return (
    <div className="bg-[#fcfcfc] min-h-screen pb-24 text-black">
      {/* MOBILE HEADER */}
      <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-md px-4 py-4 border-b border-gray-100 flex lg:hidden justify-between items-center">
         <h1 className="text-xl font-serif font-bold italic">ITX <span className="text-blue-600">Console</span></h1>
         <button onClick={handleRefresh} className={`p-2 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`}><i className="fas fa-sync-alt"></i></button>
      </div>

      <div className="container mx-auto px-4 lg:px-12 py-6 lg:py-16">
        
        {/* MOBILE NAVIGATION PILLS */}
        <div className="flex overflow-x-auto no-scrollbar gap-2 mb-8 lg:hidden">
            {['overview', 'products', 'orders', 'settings'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab as any)} className={`px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border ${activeTab === tab ? 'bg-black text-white border-black shadow-lg' : 'bg-white text-gray-400 border-gray-100'}`}>
                {tab}
              </button>
            ))}
        </div>

        {/* Tab Content: Overview */}
        {activeTab === 'overview' && (
          <div className="space-y-6 lg:space-y-12 animate-fadeIn">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-8">
              <div className="bg-black text-white p-8 lg:p-10 rounded-[2rem] shadow-2xl relative overflow-hidden">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-3 italic">Gross Revenue</p>
                <p className="text-3xl lg:text-4xl font-serif font-bold italic">Rs. {analyticsData.revenue.toLocaleString()}</p>
              </div>
              <div className="bg-white p-8 lg:p-10 rounded-[2rem] border border-gray-100 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-300 mb-3 italic">Processed Ledger</p>
                <p className="text-3xl lg:text-4xl font-serif font-bold italic">{analyticsData.count} <span className="text-xs text-gray-300 ml-1">Orders</span></p>
              </div>
              <div className="bg-white p-8 lg:p-10 rounded-[2rem] border border-gray-100 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-300 mb-3 italic">Active Collection</p>
                <p className="text-3xl lg:text-4xl font-serif font-bold italic">{products.length} <span className="text-xs text-gray-300 ml-1">Items</span></p>
              </div>
            </div>

            <div className="bg-white p-6 lg:p-12 rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
               <div className="h-64 lg:h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analyticsData.chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 8, fontWeight: 900, fill: '#cbd5e1'}} />
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
            <div className="lg:col-span-5 order-2 lg:order-1">
               <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm">
                  <h3 className="text-xs font-black uppercase mb-8 italic">Add New Masterpiece</h3>
                  <form onSubmit={handleCreateProduct} className="space-y-4">
                    <label className="block w-full h-32 bg-gray-50 border-2 border-dashed border-gray-100 rounded-3xl flex flex-col items-center justify-center cursor-pointer">
                      <i className="fas fa-camera text-gray-300 mb-2"></i>
                      <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Add Photos</p>
                      <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
                    </label>
                    <input required type="text" placeholder="Title" className="w-full bg-gray-50 p-4 rounded-xl text-sm font-bold" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} />
                    <input required type="number" placeholder="Price (PKR)" className="w-full bg-gray-50 p-4 rounded-xl text-sm font-bold" value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: e.target.value})} />
                    {/* Preserves spaces in description */}
                    <textarea required placeholder="Artisanal Description" className="w-full bg-gray-50 p-4 rounded-xl text-sm font-bold h-40 resize-none" value={newProduct.description} onChange={e => setNewProduct({...newProduct, description: e.target.value})} />
                    <button type="submit" disabled={isAddingProduct} className="w-full bg-black text-white py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest italic shadow-xl">
                      {isAddingProduct ? 'Processing...' : 'Register Item'}
                    </button>
                  </form>
               </div>
            </div>

            <div className="lg:col-span-7 space-y-4 order-1 lg:order-2">
               {products.map(p => (
                 <div key={p.id} className="bg-white p-4 rounded-[1.5rem] border border-gray-100 shadow-sm flex items-center gap-4">
                    <img src={p.image} className="w-16 h-16 rounded-xl object-cover shrink-0" />
                    <div className="flex-grow min-w-0">
                       <h4 className="text-sm font-serif font-bold italic truncate">{p.name}</h4>
                       <p className="text-[9px] font-black text-blue-600 uppercase">Rs. {p.price.toLocaleString()}</p>
                    </div>
                    <button onClick={() => deleteProduct(p.id)} className="w-10 h-10 bg-red-50 text-red-500 rounded-xl flex items-center justify-center"><i className="fas fa-trash-alt text-xs"></i></button>
                 </div>
               ))}
            </div>
          </div>
        )}

        {/* Tab Content: Orders */}
        {activeTab === 'orders' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="relative w-full">
                <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 text-xs"></i>
                <input type="text" placeholder="Filter by ID or Name..." className="w-full bg-white rounded-2xl border border-gray-100 pl-12 pr-6 py-4 text-xs font-bold uppercase shadow-sm" value={orderSearch} onChange={e => setOrderSearch(e.target.value)} />
            </div>

            <div className="grid grid-cols-1 gap-3">
               {filteredOrders.map(o => (
                 <div key={o.id} onClick={() => setViewingOrder(o)} className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer active:scale-[0.98] transition-all">
                    <div className="flex items-center space-x-4">
                       <div className={`w-2 h-2 rounded-full ${o.status === 'Pending' ? 'bg-yellow-400 animate-pulse' : o.status === 'Cancelled' ? 'bg-red-500' : 'bg-green-600'}`}></div>
                       <div>
                         <p className="text-[8px] font-black text-gray-300 uppercase tracking-widest mb-0.5">#{o.id}</p>
                         <h4 className="text-sm font-serif font-bold italic">{o.customer?.name}</h4>
                       </div>
                    </div>
                    <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 pt-3 md:pt-0">
                       <p className="text-lg font-black italic">Rs. {o.total.toLocaleString()}</p>
                       <div className={`px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest italic shadow-sm ${o.status === 'Pending' ? 'bg-yellow-50 text-yellow-600' : o.status === 'Cancelled' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                         {o.status}
                       </div>
                    </div>
                 </div>
               ))}
            </div>
          </div>
        )}

        {/* Tab Content: Settings */}
        {activeTab === 'settings' && (
          <div className="animate-fadeIn max-w-xl mx-auto space-y-6">
            <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm">
              <h3 className="text-[10px] font-black uppercase mb-6 italic">Master Security</h3>
              <input type="password" className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-6 py-4 font-bold text-sm" value={systemPassword} onChange={(e) => setSystemPassword(e.target.value)} />
            </div>
          </div>
        )}
      </div>

      {/* MOBILE-OPTIMIZED ORDER OVERLAY */}
      {viewingOrder && (
        <div className="fixed inset-0 z-[2000] flex items-end bg-black/80 backdrop-blur-xl animate-fadeIn">
          <div className="bg-white w-full h-[90vh] rounded-t-[3rem] overflow-hidden flex flex-col relative shadow-2xl">
            <div className="px-8 py-6 border-b flex justify-between items-center bg-white sticky top-0 z-10">
               <div>
                  <h2 className="text-xl font-serif font-bold italic">Order Details</h2>
                  <p className="text-[8px] font-black text-blue-600 uppercase tracking-widest">#{viewingOrder.id}</p>
               </div>
               <button onClick={() => setViewingOrder(null)} className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center"><i className="fas fa-times"></i></button>
            </div>

            <div className="flex-grow overflow-y-auto p-8 pb-32 space-y-8">
               <div className="space-y-4">
                  <h4 className="text-[9px] font-black uppercase text-gray-300 border-b pb-2">Customer Info</h4>
                  <div className="flex justify-between items-center group">
                    <p className="text-sm font-bold uppercase italic">{viewingOrder.customer?.name}</p>
                    <button onClick={() => handleCopy(viewingOrder.customer?.name || '', 'name')} className="text-gray-200"><i className="fas fa-copy"></i></button>
                  </div>
                  <div className="flex justify-between items-center group">
                    <p className="text-sm font-bold uppercase italic">{viewingOrder.customer?.phone}</p>
                    <button onClick={() => handleCopy(viewingOrder.customer?.phone || '', 'phone')} className="text-gray-200"><i className="fas fa-copy"></i></button>
                  </div>
               </div>

               <div className="space-y-4">
                  <h4 className="text-[9px] font-black uppercase text-gray-300 border-b pb-2">Full Address</h4>
                  <p className="text-sm font-bold leading-relaxed italic">{viewingOrder.customer?.address}</p>
               </div>

               <div className="bg-gray-50 rounded-2xl p-6 space-y-4">
                  <h4 className="text-[9px] font-black uppercase text-gray-400">Order Items</h4>
                  {viewingOrder.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between">
                       <p className="text-xs font-bold italic">{item.product.name} (x{item.quantity})</p>
                       <p className="text-xs font-black">Rs. {(item.product.price * item.quantity).toLocaleString()}</p>
                    </div>
                  ))}
               </div>
            </div>

            <div className="absolute bottom-0 left-0 right-0 bg-black p-8 flex flex-col gap-4 border-t border-white/10">
               <div className="flex justify-between items-center">
                  <p className="text-2xl font-serif font-bold italic text-white">Rs. {viewingOrder.total.toLocaleString()}</p>
                  <div className="relative">
                    <select value={viewingOrder.status} onChange={(e) => handleStatusChange(viewingOrder.id, e.target.value as any, viewingOrder.dbId)} className="bg-white/10 border border-white/20 text-[10px] font-black uppercase px-6 py-4 rounded-xl text-white outline-none appearance-none italic">
                      {['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'].map(s => <option key={s} value={s} className="text-black">{s}</option>)}
                    </select>
                  </div>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
