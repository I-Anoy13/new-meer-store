
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
  const [permStatus, setPermStatus] = useState<string>(Notification.permission || 'default');
  const [isArming, setIsArming] = useState(false);
  const [isPWA, setIsPWA] = useState(false);
  const [wakeLock, setWakeLock] = useState<any>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const chimeRef = useRef<HTMLAudioElement | null>(null);
  const channelRef = useRef<any>(null);
  const heartbeatTimer = useRef<any>(null);
  const pollTimer = useRef<any>(null);

  const [isAudioUnlocked, setIsAudioUnlocked] = useState(() => localStorage.getItem('itx_v24_unlocked') === 'true');

  // 1. Detect Environment
  useEffect(() => {
    const isStandalone = (window.navigator as any).standalone || window.matchMedia('(display-mode: standalone)').matches;
    setIsPWA(!!isStandalone);
  }, []);

  // 2. Data Calculations (Fixing the undefined errors)
  const filteredOrders = useMemo(() => {
    if (dateRange === 'All Time') return orders;
    const today = new Date().toDateString();
    return orders.filter(o => {
      try {
        return new Date(o.date).toDateString() === today;
      } catch (e) { return false; }
    });
  }, [orders, dateRange]);

  const totalSales = useMemo(() => {
    return filteredOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  }, [filteredOrders]);

  // 3. Audio & Wake Lock Engine
  const triggerAlert = (order: any) => {
    const time = new Date().toLocaleTimeString();
    setLastAlertTime(time);
    
    const name = order.customer_name || 'New Order';
    const amount = order.total_pkr || order.total || 0;
    const orderId = order.order_id || `ORD-${order.id || Date.now()}`;

    // A. Vibration
    if ("vibrate" in navigator) navigator.vibrate([400, 100, 400]);

    // B. Sound (Forced Bypass)
    if (isAudioUnlocked) {
      if (audioContextRef.current?.state === 'suspended') audioContextRef.current.resume();

      // Attempt MP3
      if (chimeRef.current) {
        chimeRef.current.currentTime = 0;
        chimeRef.current.volume = 1.0;
        chimeRef.current.play().catch(() => {
          // Fallback to pure Web Audio Oscillator (iOS-safe)
          if (audioContextRef.current) {
            const osc = audioContextRef.current.createOscillator();
            const g = audioContextRef.current.createGain();
            osc.connect(g); g.connect(audioContextRef.current.destination);
            osc.type = 'square';
            osc.frequency.setValueAtTime(880, audioContextRef.current.currentTime);
            g.gain.setValueAtTime(0, audioContextRef.current.currentTime);
            g.gain.linearRampToValueAtTime(0.4, audioContextRef.current.currentTime + 0.1);
            g.gain.linearRampToValueAtTime(0, audioContextRef.current.currentTime + 0.6);
            osc.start(); osc.stop(audioContextRef.current.currentTime + 0.7);
          }
        });
      }
    }

    // C. PWA Push
    if ('serviceWorker' in navigator && Notification.permission === 'granted') {
      navigator.serviceWorker.ready.then(reg => {
        reg.active?.postMessage({
          type: 'TRIGGER_NOTIFICATION',
          title: `🔥 NEW ORDER: Rs. ${amount.toLocaleString()}`,
          options: { body: `Client: ${name}\nCity: ${order.customer_city || 'Pakistan'}`, tag: orderId }
        });
      });
    }
  };

  // 4. Synchronous Sync System
  const initSync = async () => {
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    if (pollTimer.current) clearInterval(pollTimer.current);

    setRealtimeStatus('connecting');

    const channel = supabase.channel(`itx_infinity_${Math.random().toString(36).slice(7)}`);
    channel
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (p) => {
        setOrders(p.new);
        triggerAlert(p.new);
      })
      .subscribe(s => setRealtimeStatus(s === 'SUBSCRIBED' ? 'online' : 'error'));
    
    channelRef.current = channel;

    // Background Poll Backup
    pollTimer.current = setInterval(async () => {
      const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(5);
      if (data) {
        data.forEach(order => {
          const id = order.order_id || `ORD-${order.id}`;
          if (!orders.some(o => o.id === id)) {
            setOrders(order);
            triggerAlert(order);
          }
        });
      }
    }, 15000);
  };

  useEffect(() => {
    if (user) initSync();
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      if (pollTimer.current) clearInterval(pollTimer.current);
      if (heartbeatTimer.current) clearInterval(heartbeatTimer.current);
      if (wakeLock) wakeLock.release();
    };
  }, [user]);

  // 5. The Ultimate iOS Unlock
  const armGuardian = async () => {
    if (isArming) return;
    setIsArming(true);

    try {
      // Step A: Wake Lock (Keep Screen ON - Required for reliable background sound on iOS)
      if ('wakeLock' in navigator) {
        try {
          const lock = await (navigator as any).wakeLock.request('screen');
          setWakeLock(lock);
          console.log("[SYSTEM] Wake Lock Active. Phone will not sleep.");
        } catch (e) { console.warn("Wake Lock denied."); }
      }

      // Step B: Audio Context Priming
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!audioContextRef.current) audioContextRef.current = new AudioCtx();
      await audioContextRef.current.resume();

      // Step C: Audio Element Setup
      if (!chimeRef.current) chimeRef.current = new Audio(DEFAULT_CHIME);
      chimeRef.current.muted = true;
      await chimeRef.current.play();
      chimeRef.current.pause();
      chimeRef.current.muted = false;

      // Step D: Notification Access
      const permission = await Notification.requestPermission();
      setPermStatus(permission);

      // Step E: Heartbeat (Prevents iOS from suspending the process)
      if (heartbeatTimer.current) clearInterval(heartbeatTimer.current);
      heartbeatTimer.current = setInterval(() => {
        if (audioContextRef.current) {
          const osc = audioContextRef.current.createOscillator();
          const g = audioContextRef.current.createGain();
          osc.connect(g); g.connect(audioContextRef.current.destination);
          g.gain.value = 0.001; // Silent heartbeat
          osc.start(); osc.stop(audioContextRef.current.currentTime + 0.1);
        }
      }, 25000);

      setIsAudioUnlocked(true);
      localStorage.setItem('itx_v24_unlocked', 'true');
      triggerAlert({ customer_name: 'ITX SYSTEM', total: 0, order_id: 'ARMED' });

    } catch (err) {
      console.error(err);
      alert("Arming failed. Please use Safari on iPhone.");
    } finally {
      setIsArming(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#1a1c1d] flex items-center justify-center p-6 font-sans">
        <div className="w-full max-w-sm bg-white p-12 rounded-[3rem] shadow-2xl text-center">
          <h1 className="text-3xl font-black italic tracking-tighter uppercase mb-8">ITX<span className="text-blue-600">ADMIN</span></h1>
          <form onSubmit={(e) => { e.preventDefault(); if (adminPasswordInput === systemPassword) login(UserRole.ADMIN); }} className="space-y-6">
            <input 
              type="password" placeholder="Passcode" 
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-6 py-4 text-center font-black focus:border-blue-600 outline-none"
              value={adminPasswordInput} onChange={(e) => setAdminPasswordInput(e.target.value)}
            />
            <button type="submit" className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg active:scale-95 transition">Login Console</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#f6f6f7] text-[#1a1c1d] overflow-hidden font-sans">
      <aside className={`fixed inset-y-0 left-0 w-[280px] bg-[#1a1c1d] flex flex-col z-[110] transition-transform lg:translate-x-0 lg:static ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-8 border-b border-gray-800 flex items-center space-x-3 text-white">
          <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center text-lg font-black italic shadow-lg shadow-blue-600/20">I</div>
          <div className="font-black text-xs tracking-widest uppercase">Console v24</div>
        </div>
        
        <nav className="flex-grow px-4 py-8 space-y-1">
          {['Home', 'Orders', 'Products', 'Settings'].map(label => (
            <button 
              key={label} onClick={() => { setActiveNav(label); setIsSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeNav === label ? 'bg-blue-600 text-white shadow-xl shadow-blue-900/40' : 'text-gray-400 hover:bg-white/5'}`}
            >
              <div className="flex items-center space-x-4">
                <i className={`fas ${label === 'Home' ? 'fa-house' : label === 'Orders' ? 'fa-shopping-cart' : label === 'Products' ? 'fa-box' : 'fa-gears'} w-5 text-center`}></i>
                <span>{label}</span>
              </div>
            </button>
          ))}
        </nav>

        <div className="p-6 border-t border-gray-800 space-y-3">
           {!isAudioUnlocked || !wakeLock ? (
             <button 
               onClick={armGuardian} disabled={isArming}
               className={`w-full bg-blue-600 text-white p-6 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-3 shadow-lg transition-all ${isArming ? 'opacity-50' : 'animate-pulse'}`}
             >
               <i className={isArming ? "fas fa-circle-notch fa-spin" : "fas fa-shield-halved"}></i>
               {isArming ? "Initializing..." : "ARM SYSTEM"}
             </button>
           ) : (
             <div className="space-y-3">
                <div className="p-4 bg-green-500/10 rounded-2xl border border-green-500/20">
                   <div className="flex items-center justify-between mb-2 text-[8px] font-black text-green-500 uppercase tracking-widest italic">
                     <span>Infinity Guard ON</span>
                     <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-ping"></div>
                   </div>
                   <p className="text-[9px] font-black text-white uppercase tracking-tight">System Status: ARMED</p>
                </div>
                {!isPWA && (
                   <div className="p-3 bg-blue-600/10 rounded-xl border border-blue-600/20 text-center">
                      <p className="text-[8px] font-bold text-blue-400 uppercase leading-tight">Must "Add to Home Screen" for background alerts</p>
                   </div>
                )}
                <button onClick={() => triggerAlert({customer_name: 'TEST', total: 0})} className="w-full bg-white/5 text-gray-500 hover:text-white p-3 rounded-xl text-[8px] font-black uppercase tracking-widest border border-white/5 transition">Test Chime</button>
             </div>
           )}
        </div>
      </aside>

      <div className="flex-grow flex flex-col min-w-0 w-full overflow-hidden">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 shrink-0 z-50">
          <div className="flex items-center space-x-4">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden text-gray-500 p-2"><i className="fas fa-bars text-xl"></i></button>
            <div className="flex items-center gap-6 text-[10px] font-black uppercase tracking-widest text-gray-400">
               <div className="flex items-center gap-2">
                 <span className={`w-2 h-2 rounded-full ${realtimeStatus === 'online' ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`}></span>
                 <span>Stream: {realtimeStatus}</span>
               </div>
               <div className="flex items-center gap-2">
                 <i className={`fas fa-bell ${permStatus === 'granted' ? 'text-blue-500' : 'text-red-400'}`}></i>
                 <span>Push: {permStatus}</span>
               </div>
            </div>
          </div>
          {lastAlertTime && (
            <div className="bg-blue-50 text-blue-600 px-5 py-2 rounded-full border border-blue-100 flex items-center gap-2 animate-fadeIn">
               <span className="text-[10px] font-black uppercase tracking-widest italic">Last Event: {lastAlertTime}</span>
            </div>
          )}
        </header>

        <main className="flex-grow overflow-y-auto p-6 md:p-12 animate-fadeIn custom-scrollbar">
          {activeNav === 'Home' && (
            <div className="max-w-7xl mx-auto space-y-10">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
                <div>
                  <h2 className="text-4xl font-black tracking-tighter uppercase text-black italic leading-none">Monitor</h2>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mt-2">Active Order Analytics</p>
                </div>
                <div className="flex bg-white rounded-2xl border border-gray-200 p-1.5 shadow-sm">
                  {['Today', 'All Time'].map((range) => (
                    <button key={range} onClick={() => setDateRange(range as any)} className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${dateRange === range ? 'bg-black text-white shadow-xl' : 'text-gray-400 hover:text-black'}`}>{range}</button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                {[
                  { label: 'Revenue', val: `Rs. ${totalSales.toLocaleString()}`, color: 'text-blue-600' },
                  { label: 'Total Orders', val: filteredOrders.length.toString(), color: 'text-black' },
                  { label: 'Sync Status', val: realtimeStatus.toUpperCase(), color: realtimeStatus === 'online' ? 'text-green-500' : 'text-red-500' },
                  { label: 'Guard Status', val: wakeLock ? 'WAKE LOCK ACTIVE' : 'SYSTEM IDLE', color: wakeLock ? 'text-blue-600' : 'text-gray-300' },
                ].map((stat, i) => (
                  <div key={i} className="bg-white p-10 rounded-[2.5rem] border border-gray-100 shadow-sm transition-all hover:border-blue-300">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-6">{stat.label}</span>
                    <span className={`text-4xl font-black ${stat.color} tracking-tighter block`}>{stat.val}</span>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-[3rem] border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-10 border-b border-gray-50 flex items-center justify-between bg-gray-50/10">
                   <h3 className="font-black uppercase text-[11px] tracking-widest text-black italic flex items-center gap-3">
                     <i className="fas fa-bolt text-blue-600"></i> Live Activity
                   </h3>
                </div>
                <div className="divide-y divide-gray-50">
                  {filteredOrders.slice(0, 30).map(o => (
                    <div key={o.id} onClick={() => setViewingOrder(o)} className="p-8 flex justify-between items-center hover:bg-gray-50 cursor-pointer transition animate-fadeIn group">
                      <div className="min-w-0">
                        <p className="text-base font-black text-gray-900 group-hover:text-blue-600 transition truncate uppercase tracking-tight">#{o.id} — {o.customer.name}</p>
                        <p className="text-[10px] text-gray-400 font-bold mt-2 uppercase tracking-widest italic">{o.customer.city || 'N/A'} • {new Date(o.date).toLocaleTimeString()}</p>
                      </div>
                      <div className="flex flex-col items-end gap-3 text-right">
                        <span className="text-lg font-black text-gray-900">Rs. {o.total.toLocaleString()}</span>
                        <span className={`px-4 py-1 rounded-full text-[9px] font-black uppercase border ${o.status === 'Pending' ? 'bg-yellow-50 text-yellow-600 border-yellow-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>{o.status}</span>
                      </div>
                    </div>
                  ))}
                  {filteredOrders.length === 0 && <div className="p-40 text-center text-gray-300 uppercase text-[12px] font-black italic tracking-widest">Listening for Cloud Activity...</div>}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Viewing Order Modal */}
      {viewingOrder && (
        <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-xl flex items-center justify-center p-6 animate-fadeIn">
          <div className="bg-white w-full max-w-4xl rounded-[3.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-10 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 shrink-0">
              <h2 className="text-lg font-black tracking-widest uppercase text-gray-900 italic">#{viewingOrder.id}</h2>
              <button onClick={() => setViewingOrder(null)} className="text-gray-400 hover:text-black transition p-2"><i className="fas fa-times text-2xl"></i></button>
            </div>
            <div className="flex-grow overflow-y-auto p-12 space-y-12 custom-scrollbar">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                  <div className="space-y-8">
                     <h3 className="text-[11px] font-black uppercase text-gray-400 tracking-widest italic">Contents</h3>
                     {viewingOrder.items.map((item, i) => (
                       <div key={i} className="flex items-center gap-6 pb-6 border-b border-gray-100 last:border-0">
                          <img src={item.product.image} className="w-16 h-16 rounded-2xl object-cover border shadow-sm" />
                          <div>
                             <p className="text-sm font-black uppercase tracking-tight text-gray-900">{item.product.name}</p>
                             <p className="text-[10px] text-gray-400 font-bold uppercase italic">Quantity: {item.quantity}</p>
                          </div>
                          <p className="ml-auto text-base font-black">Rs. {(item.product.price * item.quantity).toLocaleString()}</p>
                       </div>
                     ))}
                  </div>
                  <div className="space-y-8">
                     <h3 className="text-[11px] font-black uppercase text-gray-400 tracking-widest italic">Shipping Data</h3>
                     <div className="bg-gray-50 p-8 rounded-3xl border border-gray-200 space-y-6">
                        <div>
                          <p className="text-[10px] font-black text-gray-300 uppercase italic">Client</p>
                          <p className="text-lg font-black text-blue-600 uppercase">{viewingOrder.customer.name}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-gray-300 uppercase italic">Contact</p>
                          <p className="text-base font-black text-gray-900">{viewingOrder.customer.phone}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-gray-300 uppercase italic">City</p>
                          <p className="text-base font-black text-gray-900 uppercase italic">{viewingOrder.customer.city || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-gray-300 uppercase italic">Address</p>
                          <p className="text-sm font-bold text-gray-600 leading-relaxed italic border-l-2 border-gray-200 pl-4">{viewingOrder.customer.address}</p>
                        </div>
                        <div className="pt-6 border-t border-gray-200">
                          <select 
                            value={viewingOrder.status}
                            onChange={(e) => updateStatusOverride && updateStatusOverride(viewingOrder.id, e.target.value as any)}
                            className="w-full bg-white border border-gray-200 rounded-2xl py-4 px-6 text-xs font-black uppercase outline-none focus:border-blue-600 transition"
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
