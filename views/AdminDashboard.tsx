
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
  const [isPWA, setIsPWA] = useState(false);

  // FIX: Calculate filteredOrders and totalSales based on dateRange selection
  const filteredOrders = useMemo(() => {
    if (dateRange === 'All Time') return orders;
    const today = new Date().toDateString();
    return orders.filter(o => {
      try {
        return new Date(o.date).toDateString() === today;
      } catch (e) {
        return false;
      }
    });
  }, [orders, dateRange]);

  const totalSales = useMemo(() => {
    return filteredOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  }, [filteredOrders]);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const chimeRef = useRef<HTMLAudioElement | null>(null);
  const channelRef = useRef<any>(null);

  const [isAudioUnlocked, setIsAudioUnlocked] = useState(() => localStorage.getItem('itx_v22_unlocked') === 'true');
  const [customSound, setCustomSound] = useState<string | null>(() => localStorage.getItem('itx_v22_tone'));

  // Detect iOS Standalone Mode
  useEffect(() => {
    const isStandalone = (window.navigator as any).standalone || window.matchMedia('(display-mode: standalone)').matches;
    setIsPWA(!!isStandalone);
  }, []);

  // Initialize Audio Object
  useEffect(() => {
    if (!chimeRef.current) {
      chimeRef.current = new Audio(customSound || DEFAULT_CHIME);
      chimeRef.current.preload = "auto";
    }
    chimeRef.current.src = customSound || DEFAULT_CHIME;
  }, [customSound]);

  // iOS-Reliable Alert Logic
  const triggerAlert = (order: any) => {
    const time = new Date().toLocaleTimeString();
    setLastAlertTime(time);
    
    const name = order.customer_name || 'New Client';
    const amount = order.total_pkr || order.total || 0;
    const orderId = order.order_id || `ORD-${order.id}`;

    // A. Vibration & Flash (Browser Context)
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    
    // B. Sound Engine (iPhone Focus)
    if (isAudioUnlocked) {
      if (audioContextRef.current?.state === 'suspended') {
        audioContextRef.current.resume();
      }
      
      // 1. Try MP3 Playback
      if (chimeRef.current) {
        chimeRef.current.currentTime = 0;
        chimeRef.current.volume = 1.0;
        const playPromise = chimeRef.current.play();
        
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            // 2. Fallback to Oscillator Beep (Harder for iOS to block)
            if (audioContextRef.current) {
              const osc = audioContextRef.current.createOscillator();
              const gain = audioContextRef.current.createGain();
              osc.connect(gain);
              gain.connect(audioContextRef.current.destination);
              gain.gain.setValueAtTime(0, audioContextRef.current.currentTime);
              gain.gain.linearRampToValueAtTime(0.5, audioContextRef.current.currentTime + 0.05);
              gain.gain.linearRampToValueAtTime(0, audioContextRef.current.currentTime + 0.3);
              osc.frequency.setValueAtTime(880, audioContextRef.current.currentTime);
              osc.start();
              osc.stop(audioContextRef.current.currentTime + 0.3);
            }
          });
        }
      }
    }

    // C. PWA Push Alert (Crucial for background orders)
    if ('serviceWorker' in navigator && Notification.permission === 'granted') {
      navigator.serviceWorker.ready.then(reg => {
        reg.active?.postMessage({
          type: 'TRIGGER_NOTIFICATION',
          title: `🔥 Rs. ${amount.toLocaleString()}`,
          orderId: orderId,
          options: {
            body: `Customer: ${name}\nCity: ${order.customer_city || 'N/A'}`
          }
        });
      });
    }
  };

  // Resilient Realtime Handler (iOS Tab-Suspension proof)
  const initCloudSync = () => {
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    
    setRealtimeStatus('connecting');
    const channel = supabase.channel(`itx_safari_${Math.random().toString(36).slice(2, 7)}`);

    channel
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
        setOrders(payload.new);
        triggerAlert(payload.new);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setRealtimeStatus('online');
        else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setRealtimeStatus('error');
          setTimeout(initCloudSync, 10000);
        }
      });

    channelRef.current = channel;
  };

  useEffect(() => {
    if (user) initCloudSync();
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current); };
  }, [user]);

  // Sync state when Safari tab becomes active
  useEffect(() => {
    const handleSync = () => {
      setPermStatus(Notification.permission);
      if (document.visibilityState === 'visible') {
        refreshData();
        if (realtimeStatus !== 'online') initCloudSync();
        if (audioContextRef.current?.state === 'suspended') audioContextRef.current.resume();
      }
    };
    window.addEventListener('focus', handleSync);
    document.addEventListener('visibilitychange', handleSync);
    return () => {
      window.removeEventListener('focus', handleSync);
      document.removeEventListener('visibilitychange', handleSync);
    };
  }, [refreshData, realtimeStatus]);

  // MANDATORY IPHONE UNLOCK HANDLER
  const unlockSystem = async () => {
    if (isArming) return;
    setIsArming(true);

    try {
      // 1. Create AudioContext INSIDE the user gesture (Required for Safari)
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioCtx();
      }
      await audioContextRef.current.resume();

      // 2. Play a test beep to "prime" the speaker
      const osc = audioContextRef.current.createOscillator();
      const gain = audioContextRef.current.createGain();
      osc.connect(gain); gain.connect(audioContextRef.current.destination);
      gain.gain.value = 0.01; osc.start(); osc.stop(audioContextRef.current.currentTime + 0.1);

      // 3. Prime the Audio element
      if (chimeRef.current) {
        chimeRef.current.muted = true;
        await chimeRef.current.play();
        chimeRef.current.pause();
        chimeRef.current.muted = false;
      }

      // 4. Handle Notification Permission
      const permission = await Notification.requestPermission();
      setPermStatus(permission);

      // 5. Success State
      setIsAudioUnlocked(true);
      localStorage.setItem('itx_v22_unlocked', 'true');
      
      // Test Trigger
      triggerAlert({ customer_name: 'ITX SYSTEM', total: 0, order_id: 'ITX-ARMED' });
      
    } catch (err) {
      console.error(err);
      alert("iPhone blocked audio. Please use Safari and try tapping again.");
    } finally {
      setIsArming(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#1a1c1d] flex items-center justify-center p-6">
        <div className="w-full max-w-sm bg-white p-12 rounded-[2.5rem] shadow-2xl text-center">
          <h1 className="text-3xl font-black italic tracking-tighter uppercase mb-8">ITX<span className="text-blue-600">ADMIN</span></h1>
          <form onSubmit={(e) => { e.preventDefault(); if (adminPasswordInput === systemPassword) login(UserRole.ADMIN); }} className="space-y-6">
            <input 
              type="password" placeholder="Passcode" 
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-6 py-4 text-center font-black focus:border-blue-600 outline-none"
              value={adminPasswordInput} onChange={(e) => setAdminPasswordInput(e.target.value)}
            />
            <button type="submit" className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg active:bg-black transition">Login</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#f6f6f7] text-[#1a1c1d] overflow-hidden font-sans">
      <aside className={`fixed inset-y-0 left-0 w-[270px] bg-[#1a1c1d] flex flex-col z-[110] transition-transform lg:translate-x-0 lg:static ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-8 border-b border-gray-800 flex items-center justify-between text-white">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center text-lg font-black italic">I</div>
            <div className="font-black text-xs tracking-widest uppercase">ITX Persistent</div>
          </div>
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

        <div className="p-6 border-t border-gray-800 space-y-3">
           {!isAudioUnlocked ? (
             <button 
               onClick={unlockSystem} disabled={isArming}
               className={`w-full bg-blue-600 text-white p-5 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-3 shadow-lg transition-all ${isArming ? 'opacity-50' : 'animate-pulse'}`}
             >
               <i className={isArming ? "fas fa-circle-notch fa-spin" : "fas fa-shield-halved"}></i>
               {isArming ? "Arming..." : "Enable Alerts"}
             </button>
           ) : (
             <div className="space-y-3">
                <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                   <div className="flex items-center justify-between mb-2 text-[8px] font-black text-gray-400 uppercase tracking-widest italic">
                     <span>Guardian Active</span>
                     <div className={`w-1.5 h-1.5 rounded-full ${realtimeStatus === 'online' ? 'bg-green-500 animate-ping' : 'bg-red-500'}`}></div>
                   </div>
                   <p className="text-[9px] font-black text-white uppercase">Sync: {realtimeStatus}</p>
                </div>
                {!isPWA && (
                   <div className="p-3 bg-yellow-600/10 rounded-xl border border-yellow-600/20 text-center animate-fadeIn">
                      <p className="text-[8px] font-bold text-yellow-500 uppercase leading-tight">Add to Home Screen for background alerts</p>
                   </div>
                )}
                <button onClick={() => triggerAlert({customer_name: 'TEST', total: 0})} className="w-full bg-white/5 text-gray-500 hover:text-white p-3 rounded-xl text-[8px] font-black uppercase tracking-widest border border-white/5 transition active:bg-white/10">Test Chime</button>
             </div>
           )}
        </div>
      </aside>

      <div className="flex-grow flex flex-col min-w-0 w-full overflow-hidden">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 shrink-0 z-50 shadow-sm">
          <div className="flex items-center space-x-4">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden text-gray-500 p-2"><i className="fas fa-bars text-xl"></i></button>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400">
                 <span className={`w-2 h-2 rounded-full ${realtimeStatus === 'online' ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`}></span>
                 <span>Stream: {realtimeStatus}</span>
              </div>
            </div>
          </div>
          {lastAlertTime && (
            <div className="bg-blue-50 text-blue-600 px-5 py-2 rounded-full border border-blue-100 flex items-center gap-2 animate-fadeIn shadow-sm">
               <span className="text-[10px] font-black uppercase tracking-widest italic">Event: {lastAlertTime}</span>
            </div>
          )}
        </header>

        <main className="flex-grow overflow-y-auto p-6 md:p-12 animate-fadeIn custom-scrollbar">
          {activeNav === 'Home' && (
            <div className="max-w-7xl mx-auto space-y-10">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
                <div>
                  <h2 className="text-4xl font-black tracking-tighter uppercase text-black italic leading-none">Console</h2>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mt-2">Live Monitor</p>
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
                  { label: 'Orders', val: filteredOrders.length.toString(), color: 'text-black' },
                  { label: 'Cloud Stream', val: realtimeStatus.toUpperCase(), color: realtimeStatus === 'online' ? 'text-green-500' : 'text-red-500' },
                  { label: 'Guardian', val: isAudioUnlocked ? 'ARMED' : 'IDLE', color: isAudioUnlocked ? 'text-blue-600' : 'text-gray-300' },
                ].map((stat, i) => (
                  <div key={i} className="bg-white p-10 rounded-[2.5rem] border border-gray-100 shadow-sm transition-all group">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-6 group-hover:text-blue-600">{stat.label}</span>
                    <span className={`text-4xl font-black ${stat.color} tracking-tighter block`}>{stat.val}</span>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-[3rem] border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-10 border-b border-gray-50 flex items-center justify-between bg-gray-50/10">
                   <h3 className="font-black uppercase text-[11px] tracking-widest text-black flex items-center gap-3 italic">
                     <i className="fas fa-bolt text-blue-600"></i>
                     Live Transaction Log
                   </h3>
                </div>
                <div className="divide-y divide-gray-50">
                  {filteredOrders.slice(0, 20).map(o => (
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
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Invoice Modal */}
      {viewingOrder && (
        <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-xl flex items-center justify-center p-6 animate-fadeIn">
          <div className="bg-white w-full max-w-4xl rounded-[3.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-10 border-b border-gray-100 flex justify-between items-center shrink-0">
              <h2 className="text-lg font-black tracking-widest uppercase text-gray-900 italic">#{viewingOrder.id}</h2>
              <button onClick={() => setViewingOrder(null)} className="text-gray-400 hover:text-black transition"><i className="fas fa-times text-2xl"></i></button>
            </div>
            <div className="flex-grow overflow-y-auto p-12 space-y-12 custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
                <div>
                  <h3 className="text-[11px] font-black uppercase text-gray-400 mb-8 tracking-widest italic">Contents</h3>
                  <div className="space-y-6">
                    {viewingOrder.items.map((item, i) => (
                      <div key={i} className="flex items-center space-x-6 pb-6 border-b border-gray-200 last:border-0">
                        <img src={item.product.image} className="w-16 h-16 rounded-2xl object-cover border shadow-sm" />
                        <div className="flex-grow min-w-0">
                          <p className="text-sm font-black uppercase truncate text-gray-900">{item.product.name}</p>
                          <p className="text-[10px] text-gray-400 font-bold uppercase italic">Qty: {item.quantity}</p>
                        </div>
                        <p className="text-base font-black text-gray-900">Rs. {(item.product.price * item.quantity).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="text-[11px] font-black uppercase text-gray-400 mb-8 tracking-widest italic">Shipping</h3>
                  <div className="space-y-6 bg-gray-50 p-8 rounded-3xl border border-gray-100">
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
