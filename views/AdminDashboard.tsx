
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

interface VisualToast {
  id: string;
  title: string;
  body: string;
  amount: string;
  order: any;
}

const CHIME_URL = "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3";

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
  const [isArming, setIsArming] = useState(false);
  const [isPWA, setIsPWA] = useState(false);
  const [isAudioUnlocked, setIsAudioUnlocked] = useState(() => localStorage.getItem('itx_v25_unlocked') === 'true');
  const [permStatus, setPermStatus] = useState<string>(Notification.permission);
  
  // New v26 Toast State
  const [toasts, setToasts] = useState<VisualToast[]>([]);
  const [isPulsing, setIsPulsing] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const chimeRef = useRef<HTMLAudioElement | null>(null);
  const silentLoopRef = useRef<any>(null);
  const wakeLockRef = useRef<any>(null);
  const channelRef = useRef<any>(null);

  // Environment Check
  useEffect(() => {
    const isStandalone = (window.navigator as any).standalone || window.matchMedia('(display-mode: standalone)').matches;
    setIsPWA(!!isStandalone);
    setPermStatus(Notification.permission);
  }, []);

  // Data Selectors
  const filteredOrders = useMemo(() => {
    if (dateRange === 'All Time') return orders;
    const today = new Date().toDateString();
    return orders.filter(o => {
      try { return new Date(o.date).toDateString() === today; } catch(e) { return false; }
    });
  }, [orders, dateRange]);

  const totalSales = useMemo(() => filteredOrders.reduce((s, o) => s + (Number(o.total) || 0), 0), [filteredOrders]);

  // THE GUARD TRIGGER (Updated for v26 Toast)
  const triggerAlert = (order: any) => {
    const time = new Date().toLocaleTimeString();
    setLastAlertTime(time);
    
    const name = order.customer_name || 'New Client';
    const amountVal = order.total_pkr || order.total || 0;
    const amountStr = `Rs. ${amountVal.toLocaleString()}`;
    const orderId = order.order_id || `ORD-${order.id || Date.now()}`;

    // 1. SHOW ON-SCREEN NOTIFICATION BAR
    const newToast: VisualToast = {
      id: Math.random().toString(36).substring(7),
      title: `NEW ORDER RECEIVED`,
      body: `${name} from ${order.customer_city || 'Pakistan'}`,
      amount: amountStr,
      order: order
    };
    setToasts(prev => [newToast, ...prev]);
    setIsPulsing(true);
    setTimeout(() => setIsPulsing(false), 5000);

    // Auto-dismiss toast
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== newToast.id));
    }, 12000);

    // 2. PHYSICAL VIBRATE
    if (navigator.vibrate) {
       navigator.vibrate([400, 100, 400, 100, 600]);
    }

    // 3. AUDIO PLAYBACK
    if (isAudioUnlocked) {
      if (audioContextRef.current?.state === 'suspended') audioContextRef.current.resume();
      if (chimeRef.current) {
        chimeRef.current.currentTime = 0;
        chimeRef.current.play().catch(() => {
          if (audioContextRef.current) {
            const osc = audioContextRef.current.createOscillator();
            const g = audioContextRef.current.createGain();
            osc.connect(g); g.connect(audioContextRef.current.destination);
            osc.type = 'square';
            osc.frequency.setValueAtTime(880, audioContextRef.current.currentTime);
            g.gain.setValueAtTime(0, audioContextRef.current.currentTime);
            g.gain.linearRampToValueAtTime(0.5, audioContextRef.current.currentTime + 0.05);
            g.gain.linearRampToValueAtTime(0, audioContextRef.current.currentTime + 0.4);
            osc.start(); osc.stop(audioContextRef.current.currentTime + 0.5);
          }
        });
      }
    }

    // 4. PWA SYSTEM NOTIFICATION (For Locked Screen)
    if ('serviceWorker' in navigator && Notification.permission === 'granted') {
      navigator.serviceWorker.ready.then(reg => {
        reg.active?.postMessage({
          type: 'TRIGGER_NOTIFICATION',
          title: `🛍️ ${amountStr}`,
          body: `CUSTOMER: ${name}\nID: ${orderId}`,
          orderId: orderId
        });
      });
    }
  };

  // PERSISTENT SYNC ENGINE
  const initSync = async () => {
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    setRealtimeStatus('connecting');

    const channel = supabase.channel(`itx_v26_${Math.random().toString(36).slice(7)}`);
    channel
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
        setOrders(payload.new);
        triggerAlert(payload.new);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setRealtimeStatus('online');
        else {
          setRealtimeStatus('error');
          setTimeout(initSync, 10000);
        }
      });
    channelRef.current = channel;
  };

  useEffect(() => {
    if (user) {
      initSync();
      const ticker = setInterval(refreshData, 30000);
      return () => {
        clearInterval(ticker);
        if (channelRef.current) supabase.removeChannel(channelRef.current);
      };
    }
  }, [user]);

  // FOREGROUND RESTORATION
  useEffect(() => {
    const handleSync = async () => {
      if (document.visibilityState === 'visible') {
        refreshData();
        if (audioContextRef.current?.state === 'suspended') audioContextRef.current.resume();
        setPermStatus(Notification.permission);
      }
    };
    window.addEventListener('focus', handleSync);
    document.addEventListener('visibilitychange', handleSync);
    return () => {
      window.removeEventListener('focus', handleSync);
      document.removeEventListener('visibilitychange', handleSync);
    };
  }, [refreshData]);

  // ARM GESTURE
  const armSystem = async () => {
    if (isArming) return;
    setIsArming(true);

    try {
      if ('wakeLock' in navigator) {
        try { wakeLockRef.current = await (navigator as any).wakeLock.request('screen'); } catch (e) {}
      }
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!audioContextRef.current) audioContextRef.current = new AudioCtx();
      await audioContextRef.current.resume();

      if (!chimeRef.current) chimeRef.current = new Audio(CHIME_URL);
      chimeRef.current.muted = true;
      await chimeRef.current.play();
      chimeRef.current.pause();
      chimeRef.current.muted = false;

      if (silentLoopRef.current) clearInterval(silentLoopRef.current);
      silentLoopRef.current = setInterval(() => {
        if (audioContextRef.current) {
          const osc = audioContextRef.current.createOscillator();
          const g = audioContextRef.current.createGain();
          osc.connect(g); g.connect(audioContextRef.current.destination);
          g.gain.setValueAtTime(0.001, audioContextRef.current.currentTime);
          osc.start(); osc.stop(audioContextRef.current.currentTime + 0.1);
        }
      }, 20000);

      const permission = await Notification.requestPermission();
      setPermStatus(permission);

      setIsAudioUnlocked(true);
      localStorage.setItem('itx_v25_unlocked', 'true');
      triggerAlert({ customer_name: 'MASTER', total: 0, order_id: 'SYSTEM-ARMED' });

    } catch (err) {
      alert("Activation blocked. Please use Safari on iPhone.");
    } finally {
      setIsArming(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#1a1c1d] flex items-center justify-center p-6">
        <div className="w-full max-w-sm bg-white p-12 rounded-[3rem] shadow-2xl text-center">
          <h1 className="text-3xl font-black italic tracking-tighter uppercase mb-8">ITX<span className="text-blue-600">ADMIN</span></h1>
          <form onSubmit={(e) => { e.preventDefault(); if (adminPasswordInput === systemPassword) login(UserRole.ADMIN); }} className="space-y-6">
            <input 
              type="password" placeholder="Passcode" 
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-6 py-4 text-center font-black focus:border-blue-600 outline-none"
              value={adminPasswordInput} onChange={(e) => setAdminPasswordInput(e.target.value)}
            />
            <button type="submit" className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg active:scale-95 transition">Enter Console</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#f6f6f7] text-[#1a1c1d] overflow-hidden font-sans relative">
      
      {/* v26 NOTIFICATION BAR OVERLAY */}
      <div className="fixed top-0 left-0 right-0 z-[500] pointer-events-none p-4 flex flex-col items-center gap-3">
        {toasts.map((toast) => (
          <div 
            key={toast.id} 
            className="w-full max-w-md bg-white border border-gray-100 shadow-[0_20px_60px_rgba(0,0,0,0.15)] rounded-[2rem] p-5 flex items-center gap-5 animate-slideInTop pointer-events-auto cursor-pointer relative overflow-hidden group active:scale-95 transition-transform"
            onClick={() => {
               const found = orders.find(o => o.id === (toast.order.order_id || `ORD-${toast.order.id}`));
               if (found) setViewingOrder(found);
               setToasts(prev => prev.filter(t => t.id !== toast.id));
            }}
          >
            {/* Countdown bar */}
            <div className="absolute bottom-0 left-0 h-1 bg-blue-600 animate-progress"></div>
            
            <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-xl shadow-lg shadow-blue-600/30">
               <i className="fas fa-shopping-cart"></i>
            </div>
            
            <div className="flex-grow min-w-0">
               <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest italic mb-1">{toast.title}</h4>
               <p className="text-sm font-black text-black truncate uppercase leading-tight">{toast.body}</p>
               <p className="text-xs font-bold text-gray-400 mt-1">{toast.amount}</p>
            </div>
            
            <button className="bg-gray-50 p-3 rounded-xl text-gray-300 hover:text-black transition">
               <i className="fas fa-chevron-right"></i>
            </button>
          </div>
        ))}
      </div>

      <aside className={`fixed inset-y-0 left-0 w-[280px] bg-[#1a1c1d] flex flex-col z-[110] transition-transform lg:translate-x-0 lg:static ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-8 border-b border-gray-800 flex items-center space-x-3 text-white">
          <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center text-lg font-black italic">I</div>
          <div className="font-black text-[10px] tracking-widest uppercase">Console v26</div>
        </div>
        
        <nav className="flex-grow px-4 py-8 space-y-1">
          {['Home', 'Orders', 'Products', 'Settings'].map(label => (
            <button 
              key={label} onClick={() => { setActiveNav(label); setIsSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeNav === label ? 'bg-blue-600 text-white shadow-xl' : 'text-gray-400 hover:bg-white/5'}`}
            >
              <div className="flex items-center space-x-4">
                <i className={`fas ${label === 'Home' ? 'fa-house' : label === 'Orders' ? 'fa-shopping-cart' : label === 'Products' ? 'fa-box' : 'fa-gears'} w-5 text-center`}></i>
                <span>{label}</span>
              </div>
            </button>
          ))}
        </nav>

        <div className="p-6 border-t border-gray-800 space-y-4">
           <div className="space-y-2">
              {[
                { label: 'PWA Ready', ok: isPWA },
                { label: 'Alert Guard', ok: permStatus === 'granted' },
                { label: 'Audio Guard', ok: isAudioUnlocked }
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                  <span className="text-[9px] font-bold text-gray-500 uppercase">{item.label}</span>
                  <div className={`w-2 h-2 rounded-full ${item.ok ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500'}`}></div>
                </div>
              ))}
           </div>

           {!isAudioUnlocked ? (
             <button 
               onClick={armSystem} disabled={isArming}
               className="w-full bg-blue-600 text-white p-5 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-3 shadow-lg transition-all animate-pulse"
             >
               <i className={isArming ? "fas fa-circle-notch fa-spin" : "fas fa-shield-halved"}></i>
               {isArming ? "Arming..." : "ARM GUARDIAN"}
             </button>
           ) : (
             <div className="p-4 bg-green-500/10 rounded-2xl border border-green-500/20 text-center">
                <p className="text-[9px] font-black text-green-500 uppercase tracking-widest italic">Monitoring Active</p>
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
                 <span className={`w-2 h-2 rounded-full ${realtimeStatus === 'online' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
                 <span>Stream: {realtimeStatus}</span>
               </div>
            </div>
          </div>
          {lastAlertTime && (
            <div className="bg-blue-600 text-white px-5 py-2 rounded-full flex items-center gap-2 animate-fadeIn shadow-xl shadow-blue-600/20">
               <span className="text-[10px] font-black uppercase tracking-widest italic">New Event {lastAlertTime}</span>
            </div>
          )}
        </header>

        <main className={`flex-grow overflow-y-auto p-6 md:p-12 animate-fadeIn custom-scrollbar transition-all duration-700 ${isPulsing ? 'bg-blue-50/50' : ''}`}>
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
                  { label: 'Net Revenue', val: `Rs. ${totalSales.toLocaleString()}`, color: 'text-blue-600' },
                  { label: 'New Orders', val: filteredOrders.length.toString(), color: 'text-black' },
                  { label: 'Sync Status', val: realtimeStatus.toUpperCase(), color: realtimeStatus === 'online' ? 'text-green-500' : 'text-red-500' },
                  { label: 'Guard Mode', val: isAudioUnlocked ? 'ARMED' : 'IDLE', color: isAudioUnlocked ? 'text-blue-600' : 'text-gray-300' },
                ].map((stat, i) => (
                  <div key={i} className={`bg-white p-10 rounded-[2.5rem] border border-gray-100 shadow-sm transition-all duration-500 ${isPulsing ? 'border-blue-300 scale-105 shadow-xl' : ''}`}>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-6">{stat.label}</span>
                    <span className={`text-4xl font-black ${stat.color} tracking-tighter block`}>{stat.val}</span>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-[3rem] border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-10 border-b border-gray-50 flex items-center justify-between bg-gray-50/10">
                   <h3 className="font-black uppercase text-[11px] tracking-widest text-black italic flex items-center gap-3">
                     <i className={`fas fa-wave-square text-blue-600 ${realtimeStatus === 'online' ? 'animate-pulse' : ''}`}></i> Transaction Log
                   </h3>
                </div>
                <div className="divide-y divide-gray-50">
                  {filteredOrders.slice(0, 40).map(o => (
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
        <div className="fixed inset-0 z-[600] bg-black/70 backdrop-blur-xl flex items-center justify-center p-6 animate-fadeIn">
          <div className="bg-white w-full max-w-4xl rounded-[3.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-10 border-b border-gray-100 flex justify-between items-center shrink-0">
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
                             <p className="text-[10px] text-gray-400 font-bold uppercase italic">Qty: {item.quantity}</p>
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
                          <p className="text-[10px] font-black text-gray-300 uppercase italic">Address</p>
                          <p className="text-sm font-bold text-gray-600 leading-relaxed italic border-l-2 border-gray-200 pl-4">{viewingOrder.customer.address}</p>
                        </div>
                        <div className="pt-6 border-t border-gray-200">
                          <select 
                            value={viewingOrder.status}
                            onChange={(e) => updateStatusOverride && updateStatusOverride(viewingOrder.id, e.target.value as any)}
                            className="w-full bg-white border border-gray-200 rounded-2xl py-4 px-6 text-xs font-black uppercase outline-none focus:border-blue-600"
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
