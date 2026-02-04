
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
  const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'online' | 'error'>('connecting');
  
  const [newProduct, setNewProduct] = useState({ name: '', price: '', category: 'Watches', description: '' });
  const [mainImageFile, setMainImageFile] = useState<File | null>(null);

  // Persistence Refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isAudioUnlocked, setIsAudioUnlocked] = useState(() => localStorage.getItem('itx_alert_unlocked') === 'true');
  const [customSound, setCustomSound] = useState<string | null>(() => localStorage.getItem('itx_custom_tone'));

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio(customSound || DEFAULT_CHIME);
    } else {
      audioRef.current.src = customSound || DEFAULT_CHIME;
    }
    audioRef.current.load();
  }, [customSound]);

  const triggerAlert = (name: string, amount: number) => {
    console.log("🔔 TRIGGERING ALERT FOR:", name);
    
    // 1. Instant Sound
    if (audioRef.current && isAudioUnlocked) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(e => console.error("Sound play failed:", e));
    }

    // 2. Bar Notification
    if (Notification.permission === 'granted') {
      try {
        const n = new Notification("NEW ORDER RECEIVED!", {
          body: `Order from ${name} for Rs. ${amount.toLocaleString()}`,
          icon: 'https://images.unsplash.com/photo-1614164185128-e4ec99c436d7?q=80&w=192&h=192&auto=format&fit=crop',
          tag: 'new-order',
          requireInteraction: true
        });
        n.onclick = () => { window.focus(); setActiveNav('Orders'); n.close(); };
      } catch (e) { console.error("Notification creation failed:", e); }
    } else {
      console.warn("Notifications not granted by user.");
    }
  };

  // HYPER-RELIABLE Real-time Engine
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('admin_instant_stream_v6', {
        config: {
          broadcast: { self: true },
          presence: { key: 'admin' }
        }
      })
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'orders' 
      }, (payload) => {
        const newRow = payload.new;
        setOrders(newRow);
        triggerAlert(newRow.customer_name || 'Customer', newRow.total_pkr || 0);
      })
      .subscribe((status) => {
        console.log("Supabase Realtime Status:", status);
        if (status === 'SUBSCRIBED') setRealtimeStatus('online');
        if (status === 'CLOSED' || status === 'CHANNEL_ERROR') setRealtimeStatus('error');
      });

    return () => { supabase.removeChannel(channel); };
  }, [user, isAudioUnlocked, customSound]);

  const unlockSystem = async () => {
    // Permission request must be user-triggered
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      new Notification("ITX Store Console", { body: "Alerts and notifications are now active." });
    }

    if (audioRef.current) {
      audioRef.current.play().then(() => {
        audioRef.current?.pause();
        audioRef.current!.currentTime = 0;
        setIsAudioUnlocked(true);
        localStorage.setItem('itx_alert_unlocked', 'true');
      });
    }
  };

  const testAlert = () => {
    triggerAlert("TEST SYSTEM", 9999);
  };

  const handleToneUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setCustomSound(base64);
        localStorage.setItem('itx_custom_tone', base64);
        alert("Alert Tone Updated!");
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

  const filteredOrders = useMemo(() => {
    const todayStr = new Date().toDateString();
    return orders.filter(o => {
      const oDate = new Date(o.date).toDateString();
      if (dateRange === 'Today') return oDate === todayStr;
      return true;
    });
  }, [orders, dateRange]);

  const totalSales = useMemo(() => filteredOrders.reduce((sum, o) => sum + o.total, 0), [filteredOrders]);

  if (!user) {
    return (
      <div className="min-h-screen bg-[#1a1c1d] flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white p-10 rounded-[2.5rem] shadow-2xl border border-white/10">
          <div className="text-center mb-12">
            <h1 className="text-3xl font-black italic tracking-tighter uppercase">ITX<span className="text-blue-600">STORE</span></h1>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-2">Administrative Hub</p>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); if (adminPasswordInput === systemPassword) login(UserRole.ADMIN); }} className="space-y-6">
            <input 
              type="password" 
              placeholder="System Password" 
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-4 text-center font-black focus:outline-none focus:border-blue-600 transition text-lg"
              value={adminPasswordInput}
              onChange={(e) => setAdminPasswordInput(e.target.value)}
            />
            <button type="submit" className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black uppercase tracking-[0.2em] text-xs hover:bg-black transition shadow-lg">Open Console</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#f6f6f7] text-[#1a1c1d] overflow-hidden font-sans relative">
      <aside className={`fixed inset-y-0 left-0 w-[260px] bg-[#1a1c1d] flex flex-col z-[110] transition-transform lg:translate-x-0 lg:static ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 bg-blue-600 text-white rounded-lg flex items-center justify-center text-lg font-black italic">I</div>
            <div className="font-black text-xs tracking-tight text-white uppercase">Management</div>
          </div>
        </div>
        
        <nav className="flex-grow px-3 py-6 space-y-1">
          {menuItems.map(item => (
            <button 
              key={item.label}
              onClick={() => { setActiveNav(item.label); setIsSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl text-[10px] font-black transition-all uppercase tracking-widest ${activeNav === item.label ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-white/5'}`}
            >
              <div className="flex items-center space-x-4">
                <i className={`fas ${item.icon} w-5 text-center`}></i>
                <span>{item.label}</span>
              </div>
              {item.badge ? <span className="bg-white/10 px-2 py-0.5 rounded text-[9px]">{item.badge}</span> : null}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-800 space-y-2">
           {!isAudioUnlocked ? (
             <button onClick={unlockSystem} className="w-full bg-blue-600 text-white p-3 rounded-xl font-black uppercase text-[9px] tracking-widest animate-pulse flex items-center justify-center gap-2">
               <i className="fas fa-bolt"></i> Enable Live Alerts
             </button>
           ) : (
             <div className="space-y-2">
                <div className="flex items-center space-x-3 p-3 bg-white/5 rounded-xl border border-white/10">
                  <div className={`w-2 h-2 rounded-full ${realtimeStatus === 'online' ? 'bg-green-500 animate-ping' : 'bg-red-500'}`}></div>
                  <div className="text-left">
                    <p className="text-[9px] font-black text-white uppercase tracking-widest">System Online</p>
                    <p className="text-[8px] text-gray-400 font-bold uppercase">{realtimeStatus.toUpperCase()}</p>
                  </div>
                </div>
                <button onClick={testAlert} className="w-full bg-white/5 text-gray-400 hover:text-white p-2 rounded-lg text-[8px] font-black uppercase tracking-widest border border-white/5 transition">Test Alert Signal</button>
             </div>
           )}
        </div>
      </aside>

      <div className="flex-grow flex flex-col min-w-0 w-full overflow-hidden">
        <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0 z-50 shadow-sm">
          <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden text-gray-500"><i className="fas fa-bars"></i></button>
          <div className="flex items-center space-x-6">
            <button onClick={handleRefresh} className={`text-gray-400 hover:text-blue-600 transition-all ${isRefreshing ? 'animate-spin' : ''}`}><i className="fas fa-sync-alt text-sm"></i></button>
            <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">ITX-CONSOLE <span className="text-blue-600 ml-2">V2.0</span></div>
          </div>
        </header>

        <main className="flex-grow overflow-y-auto p-4 md:p-10 animate-fadeIn custom-scrollbar">
          {activeNav === 'Home' && (
            <div className="max-w-6xl mx-auto space-y-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <h2 className="text-3xl font-black tracking-tighter uppercase">Overview</h2>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Live Store Analytics</p>
                </div>
                <div className="flex bg-white rounded-2xl border border-gray-200 p-1.5 shadow-sm">
                  {(['Today', 'All Time'] as const).map((range) => (
                    <button key={range} onClick={() => setDateRange(range)} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${dateRange === range ? 'bg-black text-white' : 'text-gray-400 hover:text-black'}`}>{range}</button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { label: 'Revenue', val: `Rs. ${totalSales.toLocaleString()}`, color: 'text-blue-600' },
                  { label: 'Orders', val: filteredOrders.length.toString(), color: 'text-black' },
                  { label: 'Customers', val: [...new Set(filteredOrders.map(o => o.customer.phone))].length.toString(), color: 'text-black' },
                  { label: 'Live Link', val: 'CONNECTED', color: 'text-green-500' },
                ].map((stat, i) => (
                  <div key={i} className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm hover:border-blue-200 transition-all">
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-5">{stat.label}</span>
                    <span className={`text-3xl font-black ${stat.color} tracking-tighter`}>{stat.val}</span>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-8 border-b border-gray-50 flex items-center justify-between">
                   <h3 className="font-black uppercase text-[10px] tracking-widest text-black">Instant Order Stream</h3>
                   <div className="flex items-center space-x-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
                      <span className="text-[9px] font-bold text-blue-500 uppercase tracking-widest">Real-time Ready</span>
                   </div>
                </div>
                <div className="divide-y divide-gray-50">
                  {filteredOrders.slice(0, 10).map(o => (
                    <div key={o.id} onClick={() => setViewingOrder(o)} className="p-6 flex justify-between items-center hover:bg-gray-50 cursor-pointer transition animate-fadeIn group">
                      <div className="min-w-0">
                        <p className="text-sm font-black text-gray-900 group-hover:text-blue-600 transition truncate">#{o.id} — {o.customer.name}</p>
                        <p className="text-[9px] text-gray-400 font-bold mt-1 uppercase tracking-widest">{o.customer.city} — {new Date(o.date).toLocaleTimeString()}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className="text-sm font-black text-gray-900">Rs. {o.total.toLocaleString()}</span>
                        <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase border ${o.status === 'Pending' ? 'bg-yellow-50 text-yellow-600 border-yellow-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>{o.status}</span>
                      </div>
                    </div>
                  ))}
                  {filteredOrders.length === 0 && <div className="p-32 text-center text-gray-300 uppercase text-xs font-black">No recent activity detected</div>}
                </div>
              </div>
            </div>
          )}

          {activeNav === 'Settings' && (
            <div className="max-w-2xl mx-auto space-y-8 pb-12">
               <h2 className="text-3xl font-black tracking-tighter uppercase">Configuration</h2>
               <div className="bg-white p-10 rounded-[3rem] border border-gray-200 shadow-xl space-y-10">
                  <div>
                    <h3 className="text-[10px] font-black uppercase text-gray-400 mb-6 tracking-widest">Audio Notifications</h3>
                    <div className="space-y-6">
                      <div className="flex items-center justify-between p-6 bg-gray-50 rounded-[2rem] border border-gray-200">
                        <div className="flex items-center gap-5">
                           <div className="w-12 h-12 bg-black text-white rounded-2xl flex items-center justify-center shadow-lg"><i className="fas fa-volume-high"></i></div>
                           <div>
                              <p className="text-xs font-black uppercase">Active Sound</p>
                              <p className="text-[9px] text-gray-400 font-bold uppercase">{customSound ? 'Custom MP3' : 'Standard Chime'}</p>
                           </div>
                        </div>
                        <button onClick={() => audioRef.current?.play()} className="bg-white text-black border border-gray-200 px-6 py-3 rounded-xl text-[10px] font-black uppercase hover:bg-black hover:text-white transition shadow-sm">Test</button>
                      </div>
                      <div className="relative border-2 border-dashed border-gray-200 rounded-[2rem] p-12 text-center bg-gray-50/50 hover:border-blue-600 transition-all cursor-pointer group">
                        <input type="file" accept="audio/*" onChange={handleToneUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                        <i className="fas fa-cloud-arrow-up text-3xl text-gray-300 mb-4 group-hover:text-blue-600 transition"></i>
                        <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Drop MP3 Tone Here</p>
                      </div>
                    </div>
                  </div>
                  <div className="pt-10 border-t border-gray-100">
                     <h3 className="text-[10px] font-black uppercase text-gray-400 mb-6 tracking-widest">Master Security</h3>
                     <div className="bg-gray-50 p-6 rounded-[2rem] border border-gray-200">
                        <input type="text" value={systemPassword} onChange={(e) => { setSystemPassword(e.target.value); localStorage.setItem('systemPassword', e.target.value); }} className="w-full bg-white border border-gray-100 rounded-2xl px-6 py-4 text-sm font-black outline-none focus:border-blue-600 shadow-sm" />
                     </div>
                  </div>
               </div>
            </div>
          )}

          {activeNav === 'Orders' && (
            <div className="max-w-6xl mx-auto space-y-6">
              <h2 className="text-3xl font-black tracking-tighter uppercase">Order Log</h2>
              <div className="bg-white rounded-[2rem] border border-gray-200 shadow-sm overflow-hidden">
                <table className="w-full text-left text-xs min-w-[800px]">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-8 py-5 text-[9px] font-black uppercase text-gray-400 tracking-widest">Reference</th>
                      <th className="px-8 py-5 text-[9px] font-black uppercase text-gray-400 tracking-widest">Customer</th>
                      <th className="px-8 py-5 text-[9px] font-black uppercase text-gray-400 tracking-widest">Location</th>
                      <th className="px-8 py-5 text-right text-[9px] font-black uppercase text-gray-400 tracking-widest">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 font-medium">
                    {orders.map(o => (
                      <tr key={o.id} onClick={() => setViewingOrder(o)} className="hover:bg-blue-50/30 cursor-pointer transition">
                        <td className="px-8 py-6 font-black text-blue-600">#{o.id}</td>
                        <td className="px-8 py-6 font-black uppercase text-gray-900 tracking-tight">{o.customer.name}</td>
                        <td className="px-8 py-6 font-black uppercase text-gray-500">{o.customer.city || 'N/A'}</td>
                        <td className="px-8 py-6 text-right font-black text-sm">Rs. {o.total.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;
