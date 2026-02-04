
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Product, Order, User, UserRole } from '../types';
import { supabase } from '../lib/supabase';

interface AdminDashboardProps {
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

const DEFAULT_CHIME = "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3";

const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
  products, setProducts, deleteProduct, orders, setOrders, user, login, systemPassword, setSystemPassword, refreshData, updateStatusOverride
}) => {
  const [activeNav, setActiveNav] = useState('Home');
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null);
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [dateRange, setDateRange] = useState<'Today' | 'Yesterday' | 'Last 7 Days' | 'All Time'>('All Time');
  
  const [newProduct, setNewProduct] = useState({ name: '', price: '', category: 'Watches', description: '' });
  const [mainImageFile, setMainImageFile] = useState<File | null>(null);

  // Audio & Notification Logic
  const [isAudioUnlocked, setIsAudioUnlocked] = useState(false);
  const [customSound, setCustomSound] = useState<string | null>(() => localStorage.getItem('itx_custom_tone'));
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio(customSound || DEFAULT_CHIME);
    } else {
      audioRef.current.src = customSound || DEFAULT_CHIME;
    }
    audioRef.current.load();
  }, [customSound]);

  const triggerAlert = (customerName: string, amount: number) => {
    // Instant Sound
    if (audioRef.current && isAudioUnlocked) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(e => console.warn("Sound blocked.", e));
    }
    
    // Instant System Notification
    if (Notification.permission === 'granted') {
      new Notification(`New Order: Rs. ${amount}`, {
        body: `Customer: ${customerName}`,
        icon: 'https://images.unsplash.com/photo-1614164185128-e4ec99c436d7?q=80&w=192&h=192&auto=format&fit=crop',
        silent: false
      });
    }
  };

  // INSTANT Real-time Engine
  useEffect(() => {
    if (user) {
      console.log("ITX Real-time Listening Active...");
      const channel = supabase
        .channel('admin_live_stream_v5')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
          const newRow = payload.new;
          console.log("⚡ INSTANT ORDER DATA:", newRow);
          
          // 1. Play Sound & Notify immediately using payload data
          triggerAlert(newRow.customer_name, newRow.total_pkr);
          
          // 2. Inject directly into state (NO REFETCH NEEDED)
          setOrders(newRow);
        })
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }
  }, [user, isAudioUnlocked, customSound]); // Removed refreshData from deps to avoid loops

  const unlockAudio = () => {
    setIsAudioUnlocked(true);
    if (audioRef.current) {
      audioRef.current.play().then(() => {
        audioRef.current?.pause();
        audioRef.current!.currentTime = 0;
      });
    }
    if (Notification.permission !== 'granted') {
      Notification.requestPermission();
    }
  };

  const handleToneUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.includes('audio')) return alert("Please pick an MP3/Audio file.");
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setCustomSound(base64);
        localStorage.setItem('itx_custom_tone', base64);
        alert("Custom Alert Saved!");
      };
      reader.readAsDataURL(file);
    }
  };

  const menuItems = [
    { label: 'Home', icon: 'fa-house' },
    { label: 'Orders', icon: 'fa-shopping-cart', badge: orders.filter(o => o.status === 'Pending').length },
    { label: 'Products', icon: 'fa-box' },
    { label: 'Settings', icon: 'fa-gears' },
  ];

  const handleRefresh = async () => {
    setIsRefreshing(true);
    refreshData();
    setTimeout(() => setIsRefreshing(false), 800);
  };

  const copyToClipboard = (text: string, fieldId: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 1500);
  };

  const filteredOrders = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterday = today - 86400000;
    const last7Days = today - (7 * 86400000);

    return orders.filter(order => {
      const orderDate = new Date(order.date).getTime();
      if (dateRange === 'Today') return orderDate >= today;
      if (dateRange === 'Yesterday') return orderDate >= yesterday && orderDate < today;
      if (dateRange === 'Last 7 Days') return orderDate >= last7Days;
      return true;
    });
  }, [orders, dateRange]);

  const totalSales = useMemo(() => filteredOrders.reduce((sum, o) => sum + o.total, 0), [filteredOrders]);

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mainImageFile) return alert("Please upload a product image.");
    setIsAddingProduct(true);
    try {
      const fileExt = mainImageFile.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('products').upload(`products/${fileName}`, mainImageFile);
      if (uploadError) throw uploadError;

      const { data: publicUrl } = supabase.storage.from('products').getPublicUrl(`products/${fileName}`);
      const payload = {
        name: newProduct.name,
        price_pkr: Number(newProduct.price),
        image: publicUrl.publicUrl,
        category: newProduct.category,
        description: newProduct.description,
        status: 'active',
        inventory: 10
      };
      const { data, error } = await supabase.from('products').insert([payload]).select();
      if (!error && data) {
        setProducts(prev => [{
          id: String(data[0].id),
          name: data[0].name,
          description: data[0].description,
          price: Number(data[0].price_pkr),
          image: data[0].image,
          category: data[0].category,
          inventory: 10,
          rating: 5,
          reviews: []
        }, ...prev]);
        setNewProduct({ name: '', price: '', category: 'Watches', description: '' });
        setMainImageFile(null);
        alert("Published!");
        setActiveNav('Products');
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally { setIsAddingProduct(false); }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#f1f1f1] flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white p-10 rounded-[2rem] shadow-2xl border border-gray-100">
          <div className="text-center mb-10">
            <h1 className="text-3xl font-black italic tracking-tighter uppercase">ITX<span className="text-blue-600">STORE</span></h1>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-2">Console Locked</p>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); if (adminPasswordInput === systemPassword) login(UserRole.ADMIN); }} className="space-y-6">
            <input 
              type="password" 
              placeholder="Admin Password" 
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-4 text-center font-black focus:outline-none focus:border-black transition text-lg"
              value={adminPasswordInput}
              onChange={(e) => setAdminPasswordInput(e.target.value)}
            />
            <button type="submit" className="w-full bg-black text-white py-4 rounded-2xl font-black uppercase tracking-[0.2em] text-xs hover:bg-gray-800 transition shadow-lg">Access Console</button>
          </form>
        </div>
      </div>
    );
  }

  const CopyBtn = ({ text, id }: { text: string, id: string }) => (
    <button onClick={(e) => { e.stopPropagation(); copyToClipboard(text, id); }} className={`ml-2 p-1.5 transition-all ${copiedField === id ? 'text-green-600 bg-green-50' : 'text-gray-400 hover:text-black hover:bg-gray-100'} rounded-lg`}>
      <i className={`fas ${copiedField === id ? 'fa-check' : 'fa-copy'} text-[10px]`}></i>
    </button>
  );

  return (
    <div className="flex h-screen bg-[#f6f6f7] text-[#1a1c1d] overflow-hidden font-sans relative">
      {isSidebarOpen && <div className="fixed inset-0 bg-black/40 z-[100] lg:hidden backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)}></div>}
      
      <aside className={`fixed inset-y-0 left-0 w-[260px] bg-[#1a1c1d] flex flex-col shrink-0 z-[110] transition-transform duration-300 lg:translate-x-0 lg:static ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 bg-blue-600 text-white rounded-lg flex items-center justify-center text-lg font-black">I</div>
            <div className="font-black text-sm tracking-tight text-white uppercase">ITX Admin</div>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-gray-400"><i className="fas fa-times"></i></button>
        </div>
        
        <nav className="flex-grow px-3 py-6 space-y-1">
          {menuItems.map(item => (
            <button 
              key={item.label}
              onClick={() => { setActiveNav(item.label); setIsSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-xs font-bold transition-all ${activeNav === item.label ? 'bg-[#30373e] text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
            >
              <div className="flex items-center space-x-4">
                <i className={`fas ${item.icon} w-5 text-center ${activeNav === item.label ? 'text-blue-500' : 'text-gray-500'}`}></i>
                <span className="tracking-wide uppercase">{item.label}</span>
              </div>
              {item.badge ? <span className="bg-blue-600 text-white px-2 py-0.5 rounded text-[10px] font-black">{item.badge}</span> : null}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-800 space-y-2">
           {!isAudioUnlocked ? (
             <button onClick={unlockAudio} className="w-full bg-blue-600 text-white p-3 rounded-xl font-black uppercase text-[9px] tracking-widest animate-pulse flex items-center justify-center gap-2">
               <i className="fas fa-volume-high"></i> Unlock Alerts
             </button>
           ) : (
             <div className="flex items-center space-x-3 p-3 bg-white/5 rounded-xl border border-white/10">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-ping"></div>
                <div className="text-left">
                  <p className="text-[9px] font-black text-white uppercase tracking-widest">Live Instant</p>
                  <p className="text-[8px] text-gray-400 font-bold uppercase">Sound & Sync Active</p>
                </div>
             </div>
           )}
        </div>
      </aside>

      <div className="flex-grow flex flex-col min-w-0 w-full overflow-hidden">
        <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0 z-50">
          <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden text-gray-500"><i className="fas fa-bars"></i></button>
          <div className="flex items-center space-x-6">
            <button onClick={handleRefresh} className={`text-gray-400 hover:text-black transition-all ${isRefreshing ? 'animate-spin' : ''}`}><i className="fas fa-sync-alt text-sm"></i></button>
            <div className="text-xs font-black uppercase tracking-tighter text-gray-500">Console Management</div>
          </div>
        </header>

        <main className="flex-grow overflow-y-auto p-4 md:p-10 animate-fadeIn custom-scrollbar">
          {activeNav === 'Home' && (
            <div className="max-w-6xl mx-auto space-y-8">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black tracking-tight uppercase">Dashboard</h2>
                <div className="flex bg-white rounded-xl border border-gray-200 p-1 shadow-sm">
                  {(['Today', 'Yesterday', 'All Time'] as const).map((range) => (
                    <button key={range} onClick={() => setDateRange(range as any)} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest ${dateRange === range ? 'bg-gray-100 text-black' : 'text-gray-400 hover:text-black'}`}>{range}</button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { label: 'Revenue', val: `Rs. ${totalSales.toLocaleString()}`, color: 'text-blue-600' },
                  { label: 'Orders', val: filteredOrders.length.toString(), color: 'text-gray-900' },
                  { label: 'New Cust.', val: [...new Set(filteredOrders.map(o => o.customer.phone))].length.toString(), color: 'text-gray-900' },
                  { label: 'Status', val: 'LIVE', color: 'text-green-500' },
                ].map((stat, i) => (
                  <div key={i} className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-4">{stat.label}</span>
                    <span className={`text-2xl font-black ${stat.color} tracking-tighter`}>{stat.val}</span>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-100 font-black uppercase text-[10px] tracking-widest text-gray-400">⚡ Instant Order Feed</div>
                <div className="divide-y divide-gray-50">
                  {filteredOrders.slice(0, 5).map(o => (
                    <div key={o.id} onClick={() => setViewingOrder(o)} className="p-5 flex justify-between items-center hover:bg-gray-50 cursor-pointer transition animate-fadeIn">
                      <div className="min-w-0">
                        <p className="text-sm font-black text-gray-900 truncate">#{o.id} — {o.customer.name}</p>
                        <p className="text-[10px] text-gray-400 font-bold mt-1 uppercase tracking-widest">{o.customer.city} — {new Date(o.date).toLocaleTimeString()}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className="text-sm font-black text-gray-900">Rs. {o.total.toLocaleString()}</span>
                        <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase border ${o.status === 'Pending' ? 'bg-yellow-50 text-yellow-600 border-yellow-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>{o.status}</span>
                      </div>
                    </div>
                  ))}
                  {filteredOrders.length === 0 && <div className="p-20 text-center text-gray-300 uppercase text-xs font-black">Waiting for orders...</div>}
                </div>
              </div>
            </div>
          )}

          {activeNav === 'Settings' && (
            <div className="max-w-2xl mx-auto space-y-8">
               <h2 className="text-2xl font-black tracking-tight uppercase">Settings</h2>
               <div className="bg-white p-8 rounded-[2rem] border border-gray-200 shadow-sm space-y-8">
                  <div>
                    <h3 className="text-[10px] font-black uppercase text-gray-400 mb-4 tracking-widest">Instant Audio Tone</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-200">
                        <div className="flex items-center gap-4">
                           <div className="w-10 h-10 bg-black text-white rounded-xl flex items-center justify-center"><i className="fas fa-music text-xs"></i></div>
                           <div>
                              <p className="text-xs font-black uppercase tracking-tight">Active Tone</p>
                              <p className="text-[10px] text-gray-400 font-bold uppercase">{customSound ? 'Custom MP3' : 'System Default'}</p>
                           </div>
                        </div>
                        <button onClick={() => audioRef.current?.play()} className="bg-white text-black border border-gray-200 px-4 py-2 rounded-lg text-[10px] font-black uppercase">Test Tone</button>
                      </div>
                      <div className="relative border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center bg-gray-50 hover:border-black transition cursor-pointer group">
                        <input type="file" accept="audio/mpeg,audio/wav,audio/mp3" onChange={handleToneUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                        <i className="fas fa-file-audio text-2xl text-gray-300 mb-2 group-hover:text-black transition"></i>
                        <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Select MP3 Alert File</p>
                      </div>
                      {customSound && <button onClick={() => { setCustomSound(null); localStorage.removeItem('itx_custom_tone'); }} className="w-full text-red-500 font-black uppercase text-[10px] tracking-widest hover:underline">Reset Tone</button>}
                    </div>
                  </div>
                  <div className="pt-8 border-t border-gray-100">
                     <h3 className="text-[10px] font-black uppercase text-gray-400 mb-4 tracking-widest">Master Password</h3>
                     <input type="text" value={systemPassword} onChange={(e) => { setSystemPassword(e.target.value); localStorage.setItem('systemPassword', e.target.value); }} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-black outline-none focus:border-black" />
                  </div>
               </div>
            </div>
          )}

          {activeNav === 'Orders' && (
            <div className="max-w-6xl mx-auto space-y-6">
              <h2 className="text-2xl font-black tracking-tight uppercase">Orders</h2>
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <table className="w-full text-left text-xs min-w-[800px]">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400 tracking-widest">ID</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400 tracking-widest">Customer</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400 tracking-widest">City</th>
                      <th className="px-6 py-4 text-right text-[10px] font-black uppercase text-gray-400 tracking-widest">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {orders.map(o => (
                      <tr key={o.id} onClick={() => setViewingOrder(o)} className="hover:bg-gray-50 cursor-pointer transition">
                        <td className="px-6 py-5 font-black text-blue-600">#{o.id}</td>
                        <td className="px-6 py-5 font-black uppercase tracking-tight text-gray-900">{o.customer.name}</td>
                        <td className="px-6 py-5 font-black uppercase text-gray-700">{o.customer.city || 'N/A'}</td>
                        <td className="px-6 py-5 text-right font-black text-sm">Rs. {o.total.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeNav === 'Products' && (
            <div className="max-w-6xl mx-auto space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-black tracking-tight uppercase">Products</h2>
                <button onClick={() => setActiveNav('AddProduct')} className="bg-black text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest">Add New</button>
              </div>
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400 tracking-widest">Product Info</th>
                      <th className="px-6 py-4 text-center text-[10px] font-black uppercase text-gray-400 tracking-widest">Price</th>
                      <th className="px-6 py-4 text-center text-[10px] font-black uppercase text-gray-400 tracking-widest">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {products.map(p => (
                      <tr key={p.id}>
                        <td className="px-6 py-5 flex items-center space-x-4">
                          <img src={p.image} className="w-12 h-12 rounded-xl object-cover border border-gray-100" />
                          <span className="font-black text-gray-900 uppercase tracking-tight">{p.name}</span>
                        </td>
                        <td className="px-6 py-5 text-center font-bold text-gray-900">Rs. {p.price.toLocaleString()}</td>
                        <td className="px-6 py-5 text-center">
                          <button onClick={() => { if(window.confirm('Delete?')) deleteProduct(p.id); }} className="text-red-400 hover:text-red-600 p-2"><i className="fas fa-trash-can"></i></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeNav === 'AddProduct' && (
            <div className="max-w-2xl mx-auto space-y-8">
               <div className="flex items-center gap-4">
                  <button onClick={() => setActiveNav('Products')} className="p-2 hover:bg-gray-100 rounded-lg"><i className="fas fa-arrow-left"></i></button>
                  <h2 className="text-2xl font-black tracking-tight uppercase">New Product</h2>
               </div>
               <form onSubmit={handleCreateProduct} className="bg-white p-8 rounded-[2rem] border border-gray-200 shadow-sm space-y-6">
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest block mb-2">Name</label>
                      <input required type="text" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-black outline-none focus:border-black" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest block mb-2">Price (PKR)</label>
                        <input required type="number" value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-black outline-none focus:border-black" />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest block mb-2">Category</label>
                        <select value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-black outline-none uppercase text-[10px]">
                          <option>Watches</option>
                          <option>Luxury Artisan</option>
                          <option>Professional Series</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest block mb-2">Photo</label>
                      <div className="relative border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center bg-gray-50 hover:border-black transition cursor-pointer group">
                        <input type="file" accept="image/*" onChange={e => setMainImageFile(e.target.files?.[0] || null)} className="absolute inset-0 opacity-0 cursor-pointer" />
                        <i className="fas fa-image text-2xl text-gray-300 mb-2 group-hover:text-black transition"></i>
                        <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">{mainImageFile ? mainImageFile.name : 'Click to Upload'}</p>
                      </div>
                    </div>
                  </div>
                  <button type="submit" disabled={isAddingProduct} className="w-full bg-black text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg">
                    {isAddingProduct ? <i className="fas fa-circle-notch fa-spin"></i> : 'Publish'}
                  </button>
               </form>
            </div>
          )}
        </main>
      </div>

      {viewingOrder && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
            <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-sm font-black tracking-widest uppercase text-gray-900 flex items-center gap-3">#{viewingOrder.id}</h2>
              <button onClick={() => setViewingOrder(null)} className="text-gray-400 hover:text-black p-2"><i className="fas fa-times text-xl"></i></button>
            </div>
            <div className="flex-grow overflow-y-auto p-10 space-y-12 custom-scrollbar">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                <div className="space-y-8">
                  <div className="bg-gray-50 rounded-3xl p-8 border border-gray-100">
                    <h3 className="text-[10px] font-black uppercase text-gray-400 mb-6 tracking-widest">Order Items</h3>
                    <div className="space-y-6">
                      {viewingOrder.items.map((item, i) => (
                        <div key={i} className="flex items-center space-x-6 pb-6 border-b border-gray-200 last:border-0 last:pb-0">
                          <img src={item.product.image} className="w-16 h-16 rounded-2xl object-cover border shadow-md shrink-0" />
                          <div className="flex-grow min-w-0">
                            <p className="text-sm font-black uppercase tracking-tight truncate text-gray-900">{item.product.name}</p>
                            <p className="text-[10px] text-gray-500 font-bold mt-1">Qty: {item.quantity}</p>
                          </div>
                          <p className="text-base font-black text-gray-900">Rs. {(item.product.price * item.quantity).toLocaleString()}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="space-y-8">
                  <div className="bg-white rounded-3xl border border-gray-200 p-8 shadow-sm">
                    <h3 className="text-[10px] font-black uppercase text-gray-400 mb-6 tracking-widest">Customer</h3>
                    <div className="space-y-6">
                      <div>
                        <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest mb-1">Name</p>
                        <p className="text-sm font-black text-blue-600 uppercase truncate">{viewingOrder.customer.name}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest mb-1">Phone</p>
                        <p className="text-sm font-black text-gray-900">{viewingOrder.customer.phone}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest mb-1">Address</p>
                        <p className="text-xs font-bold text-gray-500">{viewingOrder.customer.address}</p>
                      </div>
                    </div>
                    <div className="pt-8 border-t border-gray-100 mt-8">
                      <p className="text-[9px] font-black text-gray-400 uppercase mb-4 tracking-widest">Current Status</p>
                      <select 
                        value={viewingOrder.status}
                        onChange={(e) => updateStatusOverride && updateStatusOverride(viewingOrder.id, e.target.value as any)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-4 px-5 text-[11px] font-black uppercase outline-none"
                      >
                        {['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
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
