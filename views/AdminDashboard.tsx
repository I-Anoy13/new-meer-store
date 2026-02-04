
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
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null);
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [dateRange, setDateRange] = useState<'Today' | 'All Time'>('Today');
  const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'online' | 'error'>('connecting');
  const [isBackgrounded, setIsBackgrounded] = useState(false);
  
  const [newProduct, setNewProduct] = useState({ name: '', price: '', category: 'Watches', description: '' });
  const [mainImageFile, setMainImageFile] = useState<File | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isAudioUnlocked, setIsAudioUnlocked] = useState(() => localStorage.getItem('itx_alert_unlocked') === 'true');
  const [customSound, setCustomSound] = useState<string | null>(() => localStorage.getItem('itx_custom_tone'));

  // Initialize Audio
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio(customSound || DEFAULT_CHIME);
    } else {
      audioRef.current.src = customSound || DEFAULT_CHIME;
    }
    audioRef.current.preload = "auto";
  }, [customSound]);

  const triggerAlert = (name: string, amount: number) => {
    // 1. Audio Alert
    if (audioRef.current && isAudioUnlocked) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => console.log("Audio play blocked."));
    }

    // 2. System Notification via Service Worker (Most Reliable for Background)
    if (Notification.permission === 'granted' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(registration => {
        registration.active?.postMessage({
          type: 'SHOW_NOTIFICATION',
          title: `🔔 NEW ORDER: Rs. ${amount.toLocaleString()}`,
          options: {
            body: `Customer: ${name}`,
            icon: 'https://images.unsplash.com/photo-1614164185128-e4ec99c436d7?q=80&w=192&h=192&auto=format&fit=crop',
            tag: 'new-order',
            requireInteraction: true,
            silent: false
          }
        });
      });
    }
  };

  // HYPER-RELIABLE Real-time Engine
  useEffect(() => {
    if (!user) return;

    const setupRealtime = () => {
      const channel = supabase.channel('itx_always_on_v9', {
        config: {
          broadcast: { self: true },
          presence: { key: 'admin-' + Math.floor(Math.random() * 1000) }
        }
      });

      channel
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
          setOrders(payload.new);
          triggerAlert(payload.new.customer_name || 'Customer', payload.new.total_pkr || 0);
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') setRealtimeStatus('online');
          if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
            setRealtimeStatus('error');
            setTimeout(setupRealtime, 5000); // Attempt auto-recovery
          }
        });

      return channel;
    };

    const channel = setupRealtime();
    return () => { supabase.removeChannel(channel); };
  }, [user, isAudioUnlocked, customSound]);

  // VISIBILITY HANDLING: Instant Sync on Restore
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log("Welcome back! Instant Re-sync triggered.");
        setIsBackgrounded(false);
        refreshData(); // Fetch missed orders immediately
      } else {
        setIsBackgrounded(true);
        console.log("Dashboard minimized. Background persistence active.");
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [refreshData]);

  const unlockSystem = async () => {
    const permission = await Notification.requestPermission();
    if (audioRef.current) {
      try {
        await audioRef.current.play();
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        setIsAudioUnlocked(true);
        localStorage.setItem('itx_alert_unlocked', 'true');
        if (permission === 'granted') {
          triggerAlert("Console Active", 0);
        }
      } catch (e) {
        alert("Action required: Allow sound and notifications for instant alerts.");
      }
    }
  };

  const menuItems = [
    { label: 'Home', icon: 'fa-house' },
    { label: 'Orders', icon: 'fa-shopping-cart', badge: orders.filter(o => o.status === 'Pending').length },
    { label: 'Products', icon: 'fa-box' },
    { label: 'Settings', icon: 'fa-gears' },
  ];

  const filteredOrders = useMemo(() => {
    const todayStr = new Date().toDateString();
    return orders.filter(o => {
      if (dateRange === 'Today') return new Date(o.date).toDateString() === todayStr;
      return true;
    });
  }, [orders, dateRange]);

  const totalSales = useMemo(() => filteredOrders.reduce((sum, o) => sum + o.total, 0), [filteredOrders]);

  if (!user) {
    return (
      <div className="min-h-screen bg-[#1a1c1d] flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white p-10 rounded-[2.5rem] shadow-2xl">
          <div className="text-center mb-10">
            <h1 className="text-3xl font-black italic tracking-tighter uppercase">ITX<span className="text-blue-600">STORE</span></h1>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-2">Secure Management</p>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); if (adminPasswordInput === systemPassword) login(UserRole.ADMIN); }} className="space-y-6">
            <input 
              type="password" 
              placeholder="Admin Key" 
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-4 text-center font-black focus:outline-none focus:border-blue-600 transition"
              value={adminPasswordInput}
              onChange={(e) => setAdminPasswordInput(e.target.value)}
            />
            <button type="submit" className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg">Access</button>
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
            <div className="w-9 h-9 bg-blue-600 text-white rounded-lg flex items-center justify-center text-lg font-black italic shadow-lg">I</div>
            <div className="font-black text-xs tracking-tight text-white uppercase">ITX Always-On</div>
          </div>
        </div>
        
        <nav className="flex-grow px-3 py-6 space-y-1">
          {menuItems.map(item => (
            <button 
              key={item.label}
              onClick={() => { setActiveNav(item.label); setIsSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl text-[10px] font-black transition-all uppercase tracking-widest ${activeNav === item.label ? 'bg-blue-600 text-white shadow-xl' : 'text-gray-400 hover:bg-white/5'}`}
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
               <i className="fas fa-bolt"></i> Start Live Mode
             </button>
           ) : (
             <div className="space-y-2">
                <div className="flex items-center space-x-3 p-3 bg-white/5 rounded-xl border border-white/10">
                  <div className={`w-2 h-2 rounded-full ${realtimeStatus === 'online' ? 'bg-green-500 animate-ping' : 'bg-red-500'}`}></div>
                  <div className="text-left">
                    <p className="text-[9px] font-black text-white uppercase tracking-widest">Always-On Connection</p>
                    <p className="text-[8px] text-gray-400 font-bold uppercase">{realtimeStatus.toUpperCase()}</p>
                  </div>
                </div>
                <button onClick={() => triggerAlert("SYSTEM TEST", 0)} className="w-full bg-white/5 text-gray-400 hover:text-white p-2 rounded-lg text-[8px] font-black uppercase tracking-widest border border-white/5 transition">Test Chime</button>
             </div>
           )}
        </div>
      </aside>

      <div className="flex-grow flex flex-col min-w-0 w-full overflow-hidden">
        <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0 z-50 shadow-sm">
          <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden text-gray-500"><i className="fas fa-bars"></i></button>
          <div className="flex items-center space-x-6">
            <div className="flex items-center gap-2">
               <div className={`w-1.5 h-1.5 rounded-full ${isBackgrounded ? 'bg-yellow-500' : 'bg-green-500'}`}></div>
               <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                  {isBackgrounded ? 'Background Listening' : 'Active Foreground'}
               </div>
            </div>
          </div>
        </header>

        <main className="flex-grow overflow-y-auto p-4 md:p-10 animate-fadeIn custom-scrollbar">
          {activeNav === 'Home' && (
            <div className="max-w-6xl mx-auto space-y-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <h2 className="text-3xl font-black tracking-tighter uppercase text-black">Insights</h2>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Live Management Hub</p>
                </div>
                <div className="flex bg-white rounded-2xl border border-gray-200 p-1.5 shadow-sm">
                  {(['Today', 'All Time'] as const).map((range) => (
                    <button key={range} onClick={() => setDateRange(range)} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${dateRange === range ? 'bg-black text-white' : 'text-gray-400 hover:text-black'}`}>{range}</button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { label: 'Total Sales', val: `Rs. ${totalSales.toLocaleString()}`, color: 'text-blue-600' },
                  { label: 'Orders Received', val: filteredOrders.length.toString(), color: 'text-black' },
                  { label: 'Registered Cust.', val: [...new Set(filteredOrders.map(o => o.customer.phone))].length.toString(), color: 'text-black' },
                  { label: 'Cloud Status', val: realtimeStatus.toUpperCase(), color: realtimeStatus === 'online' ? 'text-green-500' : 'text-red-500' },
                ].map((stat, i) => (
                  <div key={i} className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm hover:border-blue-200 transition-all group">
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-5 group-hover:text-blue-600">{stat.label}</span>
                    <span className={`text-3xl font-black ${stat.color} tracking-tighter`}>{stat.val}</span>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-8 border-b border-gray-50 flex items-center justify-between bg-gray-50/20">
                   <h3 className="font-black uppercase text-[10px] tracking-widest text-black">Instant Order Stream</h3>
                   <div className="flex items-center space-x-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
                      <span className="text-[9px] font-bold text-blue-500 uppercase tracking-widest">Listening...</span>
                   </div>
                </div>
                <div className="divide-y divide-gray-50">
                  {filteredOrders.slice(0, 15).map(o => (
                    <div key={o.id} onClick={() => setViewingOrder(o)} className="p-6 flex justify-between items-center hover:bg-gray-50 cursor-pointer transition animate-fadeIn group">
                      <div className="min-w-0">
                        <p className="text-sm font-black text-gray-900 group-hover:text-blue-600 transition truncate">#{o.id} — {o.customer.name}</p>
                        <p className="text-[9px] text-gray-400 font-bold mt-1 uppercase tracking-widest">{o.customer.city} — {new Date(o.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className="text-sm font-black text-gray-900">Rs. {o.total.toLocaleString()}</span>
                        <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase border ${o.status === 'Pending' ? 'bg-yellow-50 text-yellow-600 border-yellow-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>{o.status}</span>
                      </div>
                    </div>
                  ))}
                  {filteredOrders.length === 0 && <div className="p-32 text-center text-gray-300 uppercase text-[10px] font-black italic tracking-widest">Awaiting Activity...</div>}
                </div>
              </div>
            </div>
          )}

          {activeNav === 'Settings' && (
            <div className="max-w-2xl mx-auto space-y-8 pb-12">
               <h2 className="text-3xl font-black tracking-tighter uppercase text-black">Configuration</h2>
               <div className="bg-white p-10 rounded-[3rem] border border-gray-200 shadow-xl space-y-10">
                  <div>
                    <h3 className="text-[10px] font-black uppercase text-gray-400 mb-6 tracking-widest">Alert Sound</h3>
                    <div className="space-y-6">
                      <div className="flex items-center justify-between p-6 bg-gray-50 rounded-[2rem] border border-gray-200">
                        <div className="flex items-center gap-5">
                           <div className="w-12 h-12 bg-black text-white rounded-2xl flex items-center justify-center shadow-lg"><i className="fas fa-music"></i></div>
                           <div>
                              <p className="text-xs font-black uppercase">Active Tone</p>
                              <p className="text-[9px] text-gray-400 font-bold uppercase">{customSound ? 'Custom MP3' : 'Standard Chime'}</p>
                           </div>
                        </div>
                        <button onClick={() => audioRef.current?.play()} className="bg-white text-black border border-gray-200 px-6 py-3 rounded-xl text-[10px] font-black uppercase hover:bg-black hover:text-white transition shadow-sm">Test</button>
                      </div>
                      <div className="relative border-2 border-dashed border-gray-200 rounded-[2rem] p-12 text-center bg-gray-50/50 hover:border-blue-600 transition-all cursor-pointer group">
                        <input type="file" accept="audio/*" onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              const base64 = event.target?.result as string;
                              setCustomSound(base64);
                              localStorage.setItem('itx_custom_tone', base64);
                              alert("Order tone updated.");
                            };
                            reader.readAsDataURL(file);
                          }
                        }} className="absolute inset-0 opacity-0 cursor-pointer" />
                        <i className="fas fa-upload text-3xl text-gray-300 mb-4 group-hover:text-blue-600 transition"></i>
                        <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Upload Custom Chime (MP3)</p>
                      </div>
                    </div>
                  </div>
                  <div className="pt-10 border-t border-gray-100">
                     <h3 className="text-[10px] font-black uppercase text-gray-400 mb-6 tracking-widest">System Security</h3>
                     <div className="bg-gray-50 p-6 rounded-[2rem] border border-gray-200">
                        <input type="text" value={systemPassword} onChange={(e) => { setSystemPassword(e.target.value); localStorage.setItem('systemPassword', e.target.value); }} className="w-full bg-white border border-gray-100 rounded-2xl px-6 py-4 text-sm font-black outline-none focus:border-blue-600 shadow-sm" />
                     </div>
                  </div>
               </div>
            </div>
          )}

          {activeNav === 'Orders' && (
            <div className="max-w-6xl mx-auto space-y-6">
              <h2 className="text-3xl font-black tracking-tighter uppercase text-black">Order Log</h2>
              <div className="bg-white rounded-[2rem] border border-gray-200 shadow-sm overflow-hidden">
                <table className="w-full text-left text-xs min-w-[800px]">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-8 py-5 text-[9px] font-black uppercase text-gray-400 tracking-widest">Ref ID</th>
                      <th className="px-8 py-5 text-[9px] font-black uppercase text-gray-400 tracking-widest">Customer</th>
                      <th className="px-8 py-5 text-[9px] font-black uppercase text-gray-400 tracking-widest">City</th>
                      <th className="px-8 py-5 text-right text-[9px] font-black uppercase text-gray-400 tracking-widest">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 font-medium">
                    {orders.map(o => (
                      <tr key={o.id} onClick={() => setViewingOrder(o)} className="hover:bg-blue-50/50 cursor-pointer transition">
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

      {/* Order Detail Modal */}
      {viewingOrder && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
            <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-sm font-black tracking-widest uppercase text-gray-900">Order: #{viewingOrder.id}</h2>
              <button onClick={() => setViewingOrder(null)} className="text-gray-400 hover:text-black p-2 transition"><i className="fas fa-times text-xl"></i></button>
            </div>
            <div className="flex-grow overflow-y-auto p-10 space-y-12 custom-scrollbar">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                <div className="space-y-8">
                  <div className="bg-gray-50 rounded-3xl p-8 border border-gray-100">
                    <h3 className="text-[10px] font-black uppercase text-gray-400 mb-6 tracking-widest">Ordered Items</h3>
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
                    <h3 className="text-[10px] font-black uppercase text-gray-400 mb-6 tracking-widest">Delivery Details</h3>
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
                        <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest mb-1">Full Address</p>
                        <p className="text-xs font-bold text-gray-500 leading-relaxed">{viewingOrder.customer.address}</p>
                      </div>
                    </div>
                    <div className="pt-8 border-t border-gray-100 mt-8">
                      <p className="text-[9px] font-black text-gray-400 uppercase mb-4 tracking-widest">Order Status</p>
                      <select 
                        value={viewingOrder.status}
                        onChange={(e) => updateStatusOverride && updateStatusOverride(viewingOrder.id, e.target.value as any)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-4 px-5 text-[11px] font-black uppercase outline-none focus:border-blue-600 transition"
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
