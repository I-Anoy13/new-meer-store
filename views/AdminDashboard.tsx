
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [dateRange, setDateRange] = useState<'Today' | 'All Time'>('Today');
  const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'online' | 'error' | 'idle'>('idle');
  const [lastAlertTime, setLastAlertTime] = useState<string | null>(null);
  const [permStatus, setPermStatus] = useState<string>(Notification.permission);
  const [isArming, setIsArming] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const chimeRef = useRef<HTMLAudioElement | null>(null);
  const channelRef = useRef<any>(null);

  const [isAudioUnlocked, setIsAudioUnlocked] = useState(() => localStorage.getItem('itx_v19_unlocked') === 'true');
  const [customSound, setCustomSound] = useState<string | null>(() => localStorage.getItem('itx_v19_tone'));

  // 1. Initialize Audio Element
  useEffect(() => {
    if (!chimeRef.current) {
      chimeRef.current = new Audio(customSound || DEFAULT_CHIME);
      chimeRef.current.preload = "auto";
    }
    chimeRef.current.src = customSound || DEFAULT_CHIME;
  }, [customSound]);

  // 2. The Alert Function
  const triggerAlert = (order: any) => {
    const time = new Date().toLocaleTimeString();
    setLastAlertTime(time);
    
    const name = order.customer_name || 'New Client';
    const amount = order.total_pkr || order.total || 0;
    const orderId = order.order_id || `ORD-${order.id}`;

    console.log(`[REALTIME EVENT] Order detected: ${orderId} - ${name}`);

    // A. Visual Tab Flash
    let flash = 0;
    const original = document.title;
    const interval = setInterval(() => {
      document.title = (flash % 2 === 0) ? "🚨 NEW ORDER! 🚨" : original;
      if (++flash > 12) { clearInterval(interval); document.title = original; }
    }, 500);

    // B. Instant Sound
    if (isAudioUnlocked) {
      if (audioContextRef.current?.state === 'suspended') {
        audioContextRef.current.resume();
      }
      if (chimeRef.current) {
        chimeRef.current.currentTime = 0;
        chimeRef.current.volume = 1.0;
        chimeRef.current.play().catch(e => console.error("Audio Playback Error:", e));
      }
    }

    // C. Background Push Notification
    if ('serviceWorker' in navigator && Notification.permission === 'granted') {
      navigator.serviceWorker.ready.then(reg => {
        reg.active?.postMessage({
          type: 'TRIGGER_NOTIFICATION',
          title: `🔥 NEW ORDER: Rs. ${amount.toLocaleString()}`,
          orderId: orderId, // Crucial for unique alerts
          options: {
            body: `Customer: ${name}\nLocation: ${order.customer_city || 'Pakistan'}\nTap to open dashboard.`,
            tag: orderId, // Ensure unique notification per order
          }
        });
      });
    }
  };

  // 3. Robust Realtime Connection
  const connectToCloud = () => {
    // Only connect if not already online
    if (channelRef.current && realtimeStatus === 'online') return;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    setRealtimeStatus('connecting');
    console.log("[SOCKET] Connecting to Supabase stream...");

    const channel = supabase.channel('itx_v19_master_stream', {
      config: {
        broadcast: { self: true },
        presence: { key: 'admin-console' }
      }
    });

    channel
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
        const newOrder = payload.new;
        // 1. Update List
        setOrders(newOrder);
        // 2. Fire Alert
        triggerAlert(newOrder);
      })
      .subscribe((status) => {
        console.log(`[SOCKET STATUS] ${status}`);
        if (status === 'SUBSCRIBED') {
          setRealtimeStatus('online');
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setRealtimeStatus('error');
          // Slow reconnect to prevent blinking
          setTimeout(connectToCloud, 10000);
        }
      });

    channelRef.current = channel;
  };

  useEffect(() => {
    if (!user) return;
    connectToCloud();
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [user]);

  // 4. Persistence & Focus
  useEffect(() => {
    const handleSync = () => {
      setPermStatus(Notification.permission);
      if (document.visibilityState === 'visible') {
        refreshData();
        if (audioContextRef.current?.state === 'suspended') {
          audioContextRef.current.resume();
        }
      }
    };
    window.addEventListener('focus', handleSync);
    document.addEventListener('visibilitychange', handleSync);
    return () => {
      window.removeEventListener('focus', handleSync);
      document.removeEventListener('visibilitychange', handleSync);
    };
  }, [refreshData]);

  // 5. SECURE UNLOCK (Fixes the 'Stuck Loading' issue)
  const unlockSystem = async () => {
    if (isArming) return;
    setIsArming(true);

    try {
      // Step A: Immediate Audio Capturing (SYCHRONOUS-ish)
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      // Must call resume in the user click handler
      await audioContextRef.current.resume();

      // Step B: Warm up the Audio element
      if (chimeRef.current) {
        // Play and immediately pause to 'unlock' the element
        chimeRef.current.volume = 0.001; 
        await chimeRef.current.play();
        chimeRef.current.pause();
        chimeRef.current.currentTime = 0;
        chimeRef.current.volume = 1.0;
      }

      // Step C: Notifications
      const permission = await Notification.requestPermission();
      setPermStatus(permission);

      // Step D: Mark as Unlocked
      setIsAudioUnlocked(true);
      localStorage.setItem('itx_v19_unlocked', 'true');
      
      // Send a test alert to confirm
      triggerAlert({
        customer_name: 'SYSTEM CHECK',
        total: 0,
        order_id: 'ITX-TEST'
      });

    } catch (err) {
      console.error("Unlock Error:", err);
      alert("Browser blocked the unlock. Please try tapping again.");
    } finally {
      setIsArming(false); // ALWAYS release the loading state
    }
  };

  const menuItems = [
    { label: 'Home', icon: 'fa-house' },
    { label: 'Orders', icon: 'fa-shopping-cart', badge: orders.filter(o => o.status === 'Pending').length },
    { label: 'Products', icon: 'fa-box' },
    { label: 'Settings', icon: 'fa-gears' },
  ];

  const filteredOrders = useMemo(() => {
    const today = new Date().toDateString();
    return orders.filter(o => dateRange === 'Today' ? new Date(o.date).toDateString() === today : true);
  }, [orders, dateRange]);

  const totalSales = useMemo(() => filteredOrders.reduce((s, o) => s + o.total, 0), [filteredOrders]);

  if (!user) {
    return (
      <div className="min-h-screen bg-[#1a1c1d] flex items-center justify-center p-6">
        <div className="w-full max-w-sm bg-white p-12 rounded-[3rem] shadow-2xl text-center">
          <h1 className="text-3xl font-black italic tracking-tighter uppercase mb-10">ITX<span className="text-blue-600">ADMIN</span></h1>
          <form onSubmit={(e) => { e.preventDefault(); if (adminPasswordInput === systemPassword) login(UserRole.ADMIN); }} className="space-y-6">
            <input 
              type="password" 
              placeholder="System Passcode" 
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-6 py-4 text-center font-black focus:border-blue-600 outline-none transition"
              value={adminPasswordInput}
              onChange={(e) => setAdminPasswordInput(e.target.value)}
            />
            <button type="submit" className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg hover:bg-black transition">Enter Dashboard</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#f6f6f7] text-[#1a1c1d] overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 w-[270px] bg-[#1a1c1d] flex flex-col z-[110] transition-transform lg:translate-x-0 lg:static ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-8 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 bg-blue-600 text-white rounded-lg flex items-center justify-center text-lg font-black italic">I</div>
            <div className="font-black text-xs tracking-tight text-white uppercase tracking-widest">ITX Console</div>
          </div>
        </div>
        
        <nav className="flex-grow px-4 py-8 space-y-1">
          {menuItems.map(item => (
            <button 
              key={item.label}
              onClick={() => { setActiveNav(item.label); setIsSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl text-[10px] font-black transition-all uppercase tracking-widest ${activeNav === item.label ? 'bg-blue-600 text-white shadow-xl shadow-blue-900/40' : 'text-gray-400 hover:bg-white/5'}`}
            >
              <div className="flex items-center space-x-4">
                <i className={`fas ${item.icon} w-5 text-center`}></i>
                <span>{item.label}</span>
              </div>
              {item.badge ? <span className="bg-white/10 px-2 py-0.5 rounded font-bold">{item.badge}</span> : null}
            </button>
          ))}
        </nav>

        <div className="p-6 border-t border-gray-800 space-y-3">
           {!isAudioUnlocked ? (
             <button 
               onClick={unlockSystem} 
               disabled={isArming}
               className={`w-full bg-blue-600 text-white p-5 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-3 shadow-lg shadow-blue-600/30 active:scale-95 transition-all ${isArming ? 'opacity-50 pointer-events-none' : 'animate-pulse hover:bg-blue-500'}`}
             >
               <i className={isArming ? "fas fa-circle-notch fa-spin" : "fas fa-shield-halved"}></i>
               {isArming ? "Arming..." : "Enable Alerts"}
             </button>
           ) : (
             <div className="space-y-3">
                <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Stream Health</span>
                    <div className={`w-1.5 h-1.5 rounded-full ${realtimeStatus === 'online' ? 'bg-green-500 animate-ping' : 'bg-red-500'}`}></div>
                  </div>
                  <p className="text-[9px] font-black text-white uppercase tracking-tight">Status: {realtimeStatus.toUpperCase()}</p>
                </div>
                <button onClick={() => triggerAlert({customer_name: 'TEST', total: 0})} className="w-full bg-white/5 text-gray-500 hover:text-white p-3 rounded-xl text-[8px] font-black uppercase tracking-widest border border-white/5 transition">Test Sound</button>
             </div>
           )}
        </div>
      </aside>

      <div className="flex-grow flex flex-col min-w-0 w-full overflow-hidden">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 shrink-0 z-50 shadow-sm">
          <div className="flex items-center space-x-4">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden text-gray-500 p-2"><i className="fas fa-bars text-xl"></i></button>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                 <span className={`w-2 h-2 rounded-full ${realtimeStatus === 'online' ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`}></span>
                 <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Socket: {realtimeStatus}</span>
              </div>
              <div className="flex items-center gap-2">
                 <i className={`fas fa-bell ${permStatus === 'granted' ? 'text-blue-500' : 'text-red-400 animate-pulse'}`}></i>
                 <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Push: {permStatus}</span>
              </div>
            </div>
          </div>
          {lastAlertTime && (
            <div className="bg-blue-50 text-blue-600 px-5 py-2 rounded-full border border-blue-100 flex items-center gap-2 animate-fadeIn shadow-sm">
               <span className="text-[10px] font-black uppercase tracking-widest italic">Order Activity: {lastAlertTime}</span>
            </div>
          )}
        </header>

        <main className="flex-grow overflow-y-auto p-6 md:p-12 animate-fadeIn custom-scrollbar">
          {activeNav === 'Home' && (
            <div className="max-w-7xl mx-auto space-y-10">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
                <div>
                  <h2 className="text-4xl font-black tracking-tighter uppercase text-black italic">Master Console</h2>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mt-2">Shop Operations Controller</p>
                </div>
                <div className="flex bg-white rounded-2xl border border-gray-200 p-1.5 shadow-sm">
                  {(['Today', 'All Time'] as const).map((range) => (
                    <button key={range} onClick={() => setDateRange(range)} className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${dateRange === range ? 'bg-black text-white shadow-xl' : 'text-gray-400 hover:text-black'}`}>{range}</button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                {[
                  { label: 'Revenue Generated', val: `Rs. ${totalSales.toLocaleString()}`, color: 'text-blue-600', icon: 'fa-money-bill-trend-up' },
                  { label: 'Orders Captured', val: filteredOrders.length.toString(), color: 'text-black', icon: 'fa-shopping-basket' },
                  { label: 'Cloud Stream', val: realtimeStatus.toUpperCase(), color: realtimeStatus === 'online' ? 'text-green-500' : 'text-red-500', icon: 'fa-signal' },
                  { label: 'Security Module', val: isAudioUnlocked ? 'ARMED' : 'IDLE', color: isAudioUnlocked ? 'text-blue-600' : 'text-gray-300', icon: 'fa-user-shield' },
                ].map((stat, i) => (
                  <div key={i} className="bg-white p-10 rounded-[2.5rem] border border-gray-100 shadow-sm hover:border-blue-300 transition-all group relative overflow-hidden">
                    <div className="relative z-10">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-6 group-hover:text-blue-600 transition-colors">{stat.label}</span>
                      <span className={`text-4xl font-black ${stat.color} tracking-tighter block`}>{stat.val}</span>
                    </div>
                    <i className={`fas ${stat.icon} absolute -bottom-4 -right-4 text-gray-50 text-6xl group-hover:text-blue-50 transition-colors`}></i>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-[3rem] border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-10 border-b border-gray-50 flex items-center justify-between bg-gray-50/10">
                   <h3 className="font-black uppercase text-[11px] tracking-widest text-black flex items-center gap-3 italic">
                     <i className="fas fa-bolt text-blue-600"></i>
                     Live Transaction Log
                   </h3>
                   <div className="flex items-center space-x-3">
                      <div className={`w-2 h-2 rounded-full ${realtimeStatus === 'online' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{realtimeStatus === 'online' ? 'Connected' : 'Connecting'}</span>
                   </div>
                </div>
                <div className="divide-y divide-gray-50">
                  {filteredOrders.slice(0, 20).map(o => (
                    <div key={o.id} onClick={() => setViewingOrder(o)} className="p-8 flex justify-between items-center hover:bg-gray-50 cursor-pointer transition animate-fadeIn group">
                      <div className="min-w-0">
                        <p className="text-base font-black text-gray-900 group-hover:text-blue-600 transition truncate uppercase tracking-tight">#{o.id} — {o.customer.name}</p>
                        <p className="text-[10px] text-gray-400 font-bold mt-2 uppercase tracking-widest flex items-center gap-2">
                           <i className="fas fa-location-dot"></i> {o.customer.city || 'Pakistan'} • {new Date(o.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-3">
                        <span className="text-lg font-black text-gray-900">Rs. {o.total.toLocaleString()}</span>
                        <span className={`px-4 py-1 rounded-full text-[9px] font-black uppercase border ${o.status === 'Pending' ? 'bg-yellow-50 text-yellow-600 border-yellow-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>{o.status}</span>
                      </div>
                    </div>
                  ))}
                  {filteredOrders.length === 0 && <div className="p-40 text-center text-gray-300 uppercase text-[12px] font-black italic tracking-widest">Awaiting First Cloud Event...</div>}
                </div>
              </div>
            </div>
          )}

          {activeNav === 'Settings' && (
            <div className="max-w-2xl mx-auto space-y-10 pb-20">
               <h2 className="text-4xl font-black tracking-tighter uppercase text-black italic">Settings</h2>
               <div className="bg-white p-12 rounded-[3.5rem] border border-gray-200 shadow-xl space-y-12">
                  <div>
                    <h3 className="text-[11px] font-black uppercase text-gray-400 mb-8 tracking-widest">Alert Configuration</h3>
                    <div className="space-y-6">
                      <div className="flex items-center justify-between p-8 bg-gray-50 rounded-[2.5rem] border border-gray-200">
                        <div className="flex items-center gap-6">
                           <div className="w-14 h-14 bg-black text-white rounded-2xl flex items-center justify-center shadow-xl"><i className="fas fa-volume-high text-xl"></i></div>
                           <div>
                              <p className="text-sm font-black uppercase tracking-tight">Active Tone</p>
                              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{customSound ? 'Custom Sound' : 'Standard Chime'}</p>
                           </div>
                        </div>
                        <button onClick={() => chimeRef.current?.play()} className="bg-white text-black border border-gray-200 px-8 py-4 rounded-2xl text-[10px] font-black uppercase hover:bg-black hover:text-white transition shadow-sm">Test</button>
                      </div>
                      <div className="relative border-2 border-dashed border-gray-200 rounded-[2.5rem] p-16 text-center bg-gray-50/50 hover:border-blue-600 transition-all cursor-pointer group">
                        <input type="file" accept="audio/*" onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              const base64 = event.target?.result as string;
                              setCustomSound(base64);
                              localStorage.setItem('itx_v19_tone', base64);
                              alert("Order chime updated.");
                            };
                            reader.readAsDataURL(file);
                          }
                        }} className="absolute inset-0 opacity-0 cursor-pointer" />
                        <i className="fas fa-music text-4xl text-gray-300 mb-6 group-hover:text-blue-600 transition"></i>
                        <p className="text-[11px] font-black uppercase text-gray-400 tracking-widest">Update Order Sound (MP3)</p>
                      </div>
                    </div>
                  </div>
                  <div className="pt-12 border-t border-gray-100">
                     <h3 className="text-[11px] font-black uppercase text-gray-400 mb-8 tracking-widest">Admin Protection</h3>
                     <div className="bg-gray-50 p-8 rounded-[2.5rem] border border-gray-200">
                        <input type="text" value={systemPassword} onChange={(e) => { setSystemPassword(e.target.value); localStorage.setItem('systemPassword', e.target.value); }} className="w-full bg-white border border-gray-100 rounded-2xl px-8 py-5 text-base font-black outline-none focus:border-blue-600 shadow-sm text-center" />
                     </div>
                  </div>
               </div>
            </div>
          )}

          {activeNav === 'Orders' && (
            <div className="max-w-7xl mx-auto space-y-10">
              <h2 className="text-4xl font-black tracking-tighter uppercase text-black italic">Transaction Log</h2>
              <div className="bg-white rounded-[3rem] border border-gray-200 shadow-sm overflow-hidden">
                <table className="w-full text-left text-sm min-w-[900px]">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-10 py-6 text-[10px] font-black uppercase text-gray-400 tracking-widest">Ref ID</th>
                      <th className="px-10 py-6 text-[10px] font-black uppercase text-gray-400 tracking-widest">Customer Name</th>
                      <th className="px-10 py-6 text-[10px] font-black uppercase text-gray-400 tracking-widest">Location</th>
                      <th className="px-10 py-6 text-right text-[10px] font-black uppercase text-gray-400 tracking-widest">Invoice Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 font-medium text-black">
                    {orders.map(o => (
                      <tr key={o.id} onClick={() => setViewingOrder(o)} className="hover:bg-blue-50/40 cursor-pointer transition group">
                        <td className="px-10 py-8 font-black text-blue-600 group-hover:underline">#{o.id}</td>
                        <td className="px-10 py-8 font-black uppercase tracking-tight">{o.customer.name}</td>
                        <td className="px-10 py-8 font-black uppercase text-gray-400 italic">{o.customer.city || 'N/A'}</td>
                        <td className="px-10 py-8 text-right font-black text-lg">Rs. {o.total.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Invoice Modal */}
      {viewingOrder && (
        <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-xl flex items-center justify-center p-6 animate-fadeIn">
          <div className="bg-white w-full max-w-5xl rounded-[3.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
            <div className="p-10 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-lg font-black tracking-widest uppercase text-gray-900 italic">Invoice Viewer: #{viewingOrder.id}</h2>
              <button onClick={() => setViewingOrder(null)} className="text-gray-400 hover:text-black p-3 transition bg-white rounded-full shadow-sm"><i className="fas fa-times text-2xl"></i></button>
            </div>
            <div className="flex-grow overflow-y-auto p-12 space-y-12 custom-scrollbar">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
                <div className="space-y-10">
                  <div className="bg-gray-50 rounded-[2.5rem] p-10 border border-gray-100 shadow-inner">
                    <h3 className="text-[11px] font-black uppercase text-gray-400 mb-8 tracking-widest flex items-center gap-2">
                       <i className="fas fa-box-open text-blue-600"></i> Order Contents
                    </h3>
                    <div className="space-y-8">
                      {viewingOrder.items.map((item, i) => (
                        <div key={i} className="flex items-center space-x-8 pb-8 border-b border-gray-200 last:border-0 last:pb-0">
                          <img src={item.product.image} className="w-24 h-24 rounded-3xl object-cover border-2 border-white shadow-xl shrink-0" />
                          <div className="flex-grow min-w-0">
                            <p className="text-lg font-black uppercase tracking-tight truncate text-gray-900">{item.product.name}</p>
                            <p className="text-[11px] text-gray-400 font-bold mt-2 uppercase tracking-widest">Qty: {item.quantity} • {item.variantName}</p>
                          </div>
                          <p className="text-xl font-black text-gray-900">Rs. {(item.product.price * item.quantity).toLocaleString()}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="space-y-10">
                  <div className="bg-white rounded-[2.5rem] border border-gray-100 p-10 shadow-xl">
                    <h3 className="text-[11px] font-black uppercase text-gray-400 mb-8 tracking-widest flex items-center gap-2">
                       <i className="fas fa-truck-fast text-blue-600"></i> Logistics Data
                    </h3>
                    <div className="space-y-8">
                      <div>
                        <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-2 italic">Client</p>
                        <p className="text-lg font-black text-blue-600 uppercase truncate leading-none">{viewingOrder.customer.name}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-8">
                        <div>
                          <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-2 italic">Phone</p>
                          <p className="text-base font-black text-gray-900">{viewingOrder.customer.phone}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-2 italic">City</p>
                          <p className="text-base font-black text-gray-900 uppercase">{viewingOrder.customer.city}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-2 italic">Shipping Address</p>
                        <p className="text-sm font-bold text-gray-600 leading-relaxed italic border-l-2 border-gray-100 pl-4">{viewingOrder.customer.address}</p>
                      </div>
                    </div>
                    <div className="pt-10 border-t border-gray-100 mt-10">
                      <p className="text-[10px] font-black text-gray-400 uppercase mb-5 tracking-widest italic">Update Status</p>
                      <select 
                        value={viewingOrder.status}
                        onChange={(e) => updateStatusOverride && updateStatusOverride(viewingOrder.id, e.target.value as any)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-5 px-6 text-sm font-black uppercase outline-none focus:border-blue-600 transition shadow-sm"
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
