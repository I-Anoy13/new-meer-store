
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area 
} from 'recharts';
import { supabase } from '../lib/supabase';
import { UserRole, Order, Product } from '../types';

/* 
 * ITX MASTER CONSOLE - ALWAYS LIVE EDITION
 * Fully automated real-time synchronization with background persistence.
 * Device-wide notifications via Service Worker.
 */

const AdminDashboard = (props: any) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [authKey, setAuthKey] = useState('');
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [timeRange, setTimeRange] = useState('6months'); 
  const [isLive, setIsLive] = useState(false);
  const [wakeLock, setWakeLock] = useState<any>(null);

  // Notification & Audio Logic
  const [recentOrderAlert, setRecentOrderAlert] = useState<any>(null);
  const [muted, setMuted] = useState(false);
  const [customAlertBase64, setCustomAlertBase64] = useState<string | null>(() => localStorage.getItem('itx_custom_alert'));
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Analytics calculated from current state
  const analytics = useMemo(() => {
    const now = new Date();
    const rangeMs = timeRange === '7days' ? 7 * 86400000 : timeRange === '30days' ? 30 * 86400000 : 180 * 86400000;
    
    const filteredOrders = props.orders.filter((o: Order) => {
      const orderDate = new Date(o.date);
      return (now.getTime() - orderDate.getTime()) <= rangeMs;
    });

    const valid = filteredOrders.filter((o: Order) => o.status !== 'Cancelled');
    const revenue = valid.reduce((acc: number, o: Order) => acc + (Number(o.total) || 0), 0);
    const pendingCount = filteredOrders.filter((o: Order) => o.status === 'Pending').length;
    const deliveredCount = filteredOrders.filter((o: Order) => o.status === 'Delivered').length;

    const chartData = [];
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const mLabel = monthNames[d.getMonth()];
      const mYear = d.getFullYear();
      const mOrders = props.orders.filter((o: Order) => {
        const od = new Date(o.date);
        return od.getMonth() === d.getMonth() && od.getFullYear() === mYear && o.status !== 'Cancelled';
      });
      chartData.push({ name: mLabel, revenue: mOrders.reduce((sum: number, o: Order) => sum + o.total, 0) });
    }

    return { revenue, pendingCount, deliveredCount, total: filteredOrders.length, chartData };
  }, [props.orders, timeRange]);

  // Request Wake Lock to keep dashboard active in background
  const requestWakeLock = useCallback(async () => {
    try {
      if ('wakeLock' in navigator) {
        const lock = await (navigator as any).wakeLock.request('screen');
        setWakeLock(lock);
        console.log("Wake Lock Active: Console pinned to memory.");
      }
    } catch (err) {
      console.warn("Wake Lock failed (likely battery saver):", err);
    }
  }, []);

  useEffect(() => {
    if (props.user) {
      requestWakeLock();
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') requestWakeLock();
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);
      return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
  }, [props.user, requestWakeLock]);

  const triggerOrderAlert = useCallback((order: any) => {
    // 1. Instant Modal Alert for Active Users
    setRecentOrderAlert(order);
    setTimeout(() => setRecentOrderAlert(null), 20000);

    // 2. Audible Alert (Requires interaction once per session)
    if (!muted) {
      if (customAlertBase64 && audioRef.current) {
        audioRef.current.play().catch(() => console.log("Audio requires interaction."));
      } else {
        try {
          const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
          if (AudioCtx) {
            const ctx = new AudioCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(523.25, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(1046.5, ctx.currentTime + 0.1);
            gain.gain.setValueAtTime(0, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
            osc.connect(gain); gain.connect(ctx.destination);
            osc.start(); osc.stop(ctx.currentTime + 0.6);
          }
        } catch {}
      }
    }

    // 3. DEVICE-WIDE PUSH (via Service Worker Message)
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'TRIGGER_NOTIFICATION',
        title: '🚨 NEW ORDER RECEIVED',
        body: `Order #${order.order_id || order.id} from ${order.customer_name}. Total: Rs. ${order.total_pkr || order.total}`,
        orderId: order.order_id || order.id
      });
    } else if ('Notification' in window && Notification.permission === 'granted') {
      // Fallback to standard notification if SW is not controlling yet
      new Notification('🚨 NEW ORDER', {
         body: `From ${order.customer_name} • Rs. ${order.total_pkr || order.total}`,
         icon: 'https://images.unsplash.com/photo-1614164185128-e4ec99c436d7?q=80&w=192&h=192&auto=format&fit=crop'
      });
    }
  }, [muted, customAlertBase64]);

  // Handle custom sound upload for order alerts
  const handleSoundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setCustomAlertBase64(base64);
        localStorage.setItem('itx_custom_alert', base64);
        window.alert('Notification sound updated successfully.');
      };
      reader.readAsDataURL(file);
    }
  };

  // PERSISTENT REAL-TIME SYNC ENGINE (Aggressive Reconnect)
  useEffect(() => {
    if (!props.user) return;
    
    console.log("Establishing Master Stream...");
    const channel = supabase.channel('master_sync_v3')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
        console.log("STREAM: Inbound Packet Captured.");
        // Immediate local state update
        props.addRealtimeOrder(payload.new);
        triggerOrderAlert(payload.new);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, () => {
        props.refreshData(); // Sync status changes
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsLive(true);
        } else {
          setIsLive(false);
          // Retry logic is built into Supabase-js, but we signal visually
        }
      });

    return () => { supabase.removeChannel(channel); };
  }, [props.user, props.addRealtimeOrder, props.refreshData, triggerOrderAlert]);

  if (!props.user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="bg-white p-10 md:p-16 rounded-[4rem] shadow-2xl w-full max-w-sm border border-gray-100">
          <div className="text-center mb-12">
            <h1 className="text-3xl font-black uppercase tracking-tighter italic">ITX CONSOLE</h1>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-3 italic">Authorized Master Access</p>
          </div>
          <div className="space-y-5">
            <input 
              type="password" value={authKey}
              onChange={(e) => setAuthKey(e.target.value)}
              placeholder="System Hash Key"
              className="w-full p-6 border-2 border-gray-100 rounded-[2rem] font-black text-center bg-gray-50 outline-none focus:border-blue-600 transition-all text-sm"
            />
            <button 
              onClick={() => {
                if (authKey === props.systemPassword) props.login(UserRole.ADMIN);
                else window.alert('Authorization rejected.');
              }}
              className="w-full bg-black text-white p-6 rounded-[2rem] font-black uppercase text-xs tracking-widest hover:bg-blue-600 transition-all shadow-2xl active:scale-95"
            >
              Unlock Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f3f4f6] text-black font-sans pb-24 md:pb-0 selection:bg-blue-100">
      <audio ref={audioRef} src={customAlertBase64 || undefined} />

      {/* FLOATING TOP ALERTS (ACTIVE SESSION) */}
      {recentOrderAlert && (
        <div className="fixed top-0 left-0 right-0 z-[100] p-4 animate-slideInTop">
          <div className="bg-black text-white p-5 md:p-8 rounded-[2.5rem] md:rounded-full shadow-2xl flex items-center justify-between border border-white/10 max-w-2xl mx-auto ring-4 ring-blue-600/20">
            <div className="flex items-center space-x-5 min-w-0">
              <div className="w-14 h-14 bg-blue-600 rounded-3xl flex items-center justify-center animate-bounce flex-shrink-0 shadow-lg shadow-blue-500/20">
                <i className="fas fa-shopping-bag text-lg"></i>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-400 italic mb-1">Incoming Real-time Order</p>
                <p className="font-bold text-sm md:text-lg truncate tracking-tight">#{recentOrderAlert.order_id || recentOrderAlert.id} — {recentOrderAlert.customer_name}</p>
              </div>
            </div>
            <button onClick={() => setRecentOrderAlert(null)} className="ml-6 w-12 h-12 rounded-2xl bg-white/5 hover:bg-white/10 transition flex-shrink-0">
              <i className="fas fa-times"></i>
            </button>
          </div>
        </div>
      )}

      {/* HEADER SECTION (NO SYNC BUTTON - FULLY AUTO) */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-2xl border-b border-gray-200 h-20 md:h-24 flex items-center justify-between px-8 md:px-12">
        <div className="flex items-center space-x-12">
          <div className="flex flex-col">
            <h2 className="text-sm md:text-lg font-black italic tracking-tighter uppercase leading-none">ITX MASTER</h2>
            <div className="flex items-center gap-2 mt-1.5">
              <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-green-500 shadow-[0_0_10px_#22c55e]' : 'bg-red-500'} animate-pulse`}></div>
              <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">{isLive ? 'SYSTEM LIVE' : 'SYNCING'}</span>
            </div>
          </div>
          <nav className="hidden lg:flex space-x-10 text-[11px] font-black uppercase tracking-widest">
            <button onClick={() => setActiveTab('overview')} className={activeTab === 'overview' ? 'text-blue-600' : 'text-gray-400 hover:text-black transition'}>Overview</button>
            <button onClick={() => setActiveTab('orders')} className={activeTab === 'orders' ? 'text-blue-600' : 'text-gray-400 hover:text-black transition'}>Inbound Feed</button>
            <button onClick={() => setActiveTab('inventory')} className={activeTab === 'inventory' ? 'text-blue-600' : 'text-gray-400 hover:text-black transition'}>Stock Manager</button>
            <button onClick={() => setActiveTab('sys')} className={activeTab === 'sys' ? 'text-blue-600' : 'text-gray-400 hover:text-black transition'}>Settings</button>
          </nav>
        </div>
        <div className="flex items-center space-x-4">
          <button onClick={() => setMuted(!muted)} className={`w-12 h-12 rounded-2xl border-2 flex items-center justify-center transition shadow-sm ${muted ? 'bg-red-50 text-red-500 border-red-100' : 'bg-white text-gray-300 border-gray-100'}`}>
            <i className={`fas ${muted ? 'fa-bell-slash' : 'fa-bell'} text-sm`}></i>
          </button>
          <div className="hidden md:flex bg-zinc-900 text-white px-8 py-3.5 rounded-[1.8rem] text-[10px] font-black uppercase tracking-widest shadow-xl items-center gap-3">
            <i className="fas fa-satellite-dish text-blue-500 animate-ping"></i> Connection Healthy
          </div>
        </div>
      </header>

      {/* DASHBOARD CONTENT */}
      <main className="p-6 md:p-12 max-w-7xl mx-auto space-y-12">
        {activeTab === 'overview' && (
          <div className="animate-fadeIn space-y-12">
            <div className="flex justify-between items-center px-2">
              <h3 className="font-black text-[10px] md:text-xs uppercase tracking-widest text-gray-400 italic">Financial Performance</h3>
              <div className="flex bg-gray-200/50 p-1 rounded-2xl border border-gray-200">
                {['7days', '30days', '6months'].map(r => (
                  <button key={r} onClick={() => setTimeRange(r)} className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${timeRange === r ? 'bg-white shadow-md text-blue-600' : 'text-gray-400'}`}>
                    {r.replace('days', 'd').replace('months', 'm')}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-10">
              {[
                { label: 'Revenue', val: `Rs. ${analytics.revenue.toLocaleString()}`, color: 'text-black' },
                { label: 'Total Orders', val: analytics.total, color: 'text-black' },
                { label: 'Pending Packets', val: analytics.pendingCount, color: 'text-blue-600' },
                { label: 'Fulfillment Rate', val: `${analytics.total ? Math.round((analytics.deliveredCount / analytics.total) * 100) : 0}%`, color: 'text-green-600' }
              ].map((s, i) => (
                <div key={i} className="bg-white border border-gray-200 p-8 md:p-10 rounded-[2.5rem] md:rounded-[3rem] shadow-sm hover:shadow-xl transition-all duration-500 group">
                  <p className="text-[8px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 group-hover:text-blue-500 transition">{s.label}</p>
                  <p className={`text-2xl md:text-4xl font-black tracking-tighter italic ${s.color}`}>{s.val}</p>
                </div>
              ))}
            </div>

            <div className="bg-white border border-gray-200 p-8 md:p-14 rounded-[3rem] md:rounded-[4rem] shadow-sm">
              <h4 className="text-[10px] font-black uppercase tracking-widest mb-12 text-zinc-300 italic">Inbound Revenue Distribution</h4>
              <div className="h-64 md:h-96 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analytics.chartData}>
                    <defs>
                      <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 900, fill: '#9ca3af'}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 900, fill: '#9ca3af'}} />
                    <Tooltip contentStyle={{borderRadius: '1.5rem', border: 'none', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.1)'}} />
                    <Area type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={6} fillOpacity={1} fill="url(#colorRev)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="animate-fadeIn space-y-6 md:space-y-8">
            <div className="flex justify-between items-center px-4">
              <h3 className="font-black text-[10px] md:text-xs uppercase tracking-widest text-gray-400 italic">Order Stream Feed</h3>
              <p className="text-[10px] font-black text-blue-600 uppercase italic flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-ping"></span>
                Listening for Activity...
              </p>
            </div>
            {props.orders.length === 0 ? (
              <div className="bg-white p-32 rounded-[4rem] text-center border-2 border-dashed border-gray-200">
                <i className="fas fa-radar text-4xl text-gray-100 mb-6"></i>
                <p className="text-[11px] font-black uppercase text-gray-300 tracking-[0.2em]">Standing by for Inbound Traffic...</p>
              </div>
            ) : (
              props.orders.map((o: Order) => (
                <div key={o.id} onClick={() => setSelectedOrder(o)} className="bg-white border border-gray-200 p-6 md:p-10 rounded-[2.5rem] md:rounded-[4rem] flex flex-col gap-6 md:flex-row md:justify-between md:items-center shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all cursor-pointer group">
                  <div className="flex items-center space-x-6 md:space-x-10 min-w-0">
                    <div className={`w-16 h-16 md:w-20 md:h-20 rounded-[1.5rem] md:rounded-[2.5rem] flex items-center justify-center font-black text-lg md:text-2xl border-4 transition-all duration-500 ${o.status === 'Delivered' ? 'bg-green-50 text-green-500 border-green-100' : 'bg-gray-50 border-gray-50 text-gray-400 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-500'}`}>
                      {String(o.status).charAt(0)}
                    </div>
                    <div className="min-w-0 flex-grow">
                      <div className="flex items-center gap-3 md:gap-4">
                        <p className="font-black text-lg md:text-2xl tracking-tighter italic">#{o.id}</p>
                        <span className={`text-[9px] md:text-[11px] font-black px-3 py-1 rounded-xl uppercase tracking-widest border-2 ${o.status === 'Pending' ? 'border-amber-200 text-amber-600 bg-amber-50 animate-pulse' : 'border-gray-100 text-gray-400 bg-gray-50'}`}>
                          {o.status}
                        </span>
                      </div>
                      <p className="text-[11px] md:text-[14px] font-bold text-gray-400 uppercase mt-3 tracking-wide truncate">{o.customer.name} • {o.customer.city || 'Unknown Loc'}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between md:justify-end md:space-x-16 border-t md:border-t-0 pt-6 md:pt-0 border-gray-100">
                    <div className="md:text-right">
                      <p className="hidden md:block text-[10px] font-black text-gray-300 uppercase mb-2 italic">Gross Settlement</p>
                      <p className="text-xl md:text-3xl font-black italic tracking-tighter">Rs. {o.total.toLocaleString()}</p>
                    </div>
                    <select 
                      value={o.status} 
                      onClick={(e) => e.stopPropagation()}
                      onChange={e => props.updateStatusOverride?.(o.id, e.target.value as any)}
                      className="border-2 border-gray-100 p-4 md:p-5 rounded-[1.5rem] md:rounded-[2rem] text-[10px] md:text-[12px] font-black uppercase bg-gray-50 outline-none focus:border-blue-600 transition shadow-sm min-w-[140px] md:min-w-[200px]"
                    >
                      <option value="Pending">Pending</option>
                      <option value="Confirmed">Confirmed</option>
                      <option value="Shipped">Shipped</option>
                      <option value="Delivered">Delivered</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'inventory' && (
          <div className="animate-fadeIn space-y-10">
             <div className="flex justify-between items-center px-4">
              <h3 className="font-black text-[10px] md:text-xs uppercase tracking-widest text-gray-400 italic">Inventory Controller</h3>
              <button 
                onClick={() => setIsAddProductOpen(true)}
                className="bg-black text-white px-10 py-5 rounded-[2rem] text-[10px] md:text-[12px] font-black uppercase tracking-widest shadow-2xl active:scale-95 transition hover:bg-blue-600"
              >
                + New Stock Entry
              </button>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 md:gap-10">
              {props.products.map((itm: Product) => (
                <div key={itm.id} className="bg-white border border-gray-200 p-6 rounded-[2.5rem] md:rounded-[4rem] group relative shadow-sm hover:shadow-2xl transition-all duration-700">
                  <div className="aspect-square relative mb-6 overflow-hidden rounded-[2rem] md:rounded-[3rem]">
                    <img src={itm.image} className="w-full h-full object-cover group-hover:scale-110 transition duration-1000" alt="" />
                    <button onClick={(e) => { e.stopPropagation(); if(confirm('Erase product from ledger?')) props.deleteProduct(itm.id); }} className="absolute top-4 right-4 bg-red-600 text-white w-10 h-10 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-2xl">
                      <i className="fas fa-trash-alt text-[11px]"></i>
                    </button>
                  </div>
                  <p className="text-[8px] md:text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2 italic">{itm.category}</p>
                  <p className="text-[12px] md:text-[16px] font-black truncate uppercase tracking-tight text-zinc-800">{itm.name}</p>
                  <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-50">
                    <span className="text-[12px] md:text-[16px] font-black italic">Rs. {itm.price.toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'sys' && (
          <div className="max-w-3xl bg-white border border-gray-200 p-10 md:p-20 rounded-[4rem] md:rounded-[6rem] shadow-sm animate-fadeIn space-y-16 mx-auto">
            <div className="space-y-10">
              <p className="text-[11px] md:text-[13px] font-black text-gray-400 uppercase tracking-widest italic border-b border-gray-100 pb-4">Logic & Alert Configuration</p>
              
              <div className="bg-gray-50 p-8 md:p-14 rounded-[3.5rem] md:rounded-[4.5rem] border border-gray-200 shadow-inner space-y-12">
                <div className="space-y-8">
                  <label className="block text-[9px] md:text-[11px] font-black uppercase text-gray-400 tracking-widest italic">Inbound Signal Chime</label>
                  <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center">
                    <input type="file" accept="audio/*" onChange={handleSoundUpload} className="hidden" id="sound-upload" />
                    <label htmlFor="sound-upload" className="cursor-pointer bg-white border-2 border-gray-200 px-10 py-4 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest hover:border-black transition-all shadow-sm">
                      {customAlertBase64 ? 'Update Frequency' : 'Upload Alert Signal'}
                    </label>
                    <div className="flex gap-4">
                      <button onClick={() => triggerOrderAlert({ order_id: 'TEST_PKT', customer_name: 'PWA System', total: 0 })} className="w-14 h-14 rounded-[1.5rem] bg-blue-600 text-white flex items-center justify-center shadow-2xl active:scale-90 transition-all shadow-blue-500/30"><i className="fas fa-play text-sm"></i></button>
                      {customAlertBase64 && (
                        <button onClick={() => { localStorage.removeItem('itx_custom_alert'); setCustomAlertBase64(null); }} className="w-14 h-14 rounded-[1.5rem] bg-red-50 text-red-500 border-2 border-red-100 flex items-center justify-center hover:bg-red-100 transition"><i className="fas fa-trash text-sm"></i></button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-10 border-t border-gray-200">
                  <p className="text-[9px] md:text-[11px] font-black uppercase text-gray-400 mb-8 tracking-widest italic">Device-Wide Broadcast Authorization</p>
                  <button 
                    onClick={() => {
                      Notification.requestPermission().then(perm => {
                        const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
                        if (AudioCtx) {
                          const ctx = new AudioCtx();
                          ctx.resume().then(() => alert(`Background Mode: ${perm}. System fully primed.`));
                        }
                      });
                    }} 
                    className="w-full bg-black text-white px-8 py-6 rounded-[2rem] text-[11px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-2xl"
                  >
                    Authorize Notifications & Background Refresh
                  </button>
                  <p className="text-[9px] text-gray-400 mt-5 text-center font-bold uppercase tracking-tight italic">Recommended: Toggle this once per day to ensure session persistence.</p>
                </div>
              </div>
            </div>

            <div className="pt-12 border-t border-gray-100">
              <p className="text-[11px] md:text-[13px] font-black text-gray-400 mb-10 uppercase tracking-widest italic">Admin Cryptography</p>
              <div className="flex gap-6">
                <input 
                  value={props.systemPassword} 
                  onChange={e => props.setSystemPassword(e.target.value)} 
                  className="border-2 border-gray-100 p-6 rounded-[2rem] w-full text-sm font-black bg-gray-50 outline-none focus:border-blue-500 shadow-inner" 
                  placeholder="Console Passkey"
                />
                <button onClick={() => { localStorage.setItem('systemPassword', props.systemPassword); window.alert('Master Hash Verified and Saved.'); }} className="bg-black text-white px-12 rounded-[2rem] text-[10px] font-black uppercase tracking-widest active:scale-95 transition shadow-2xl">Confirm</button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MOBILE PERSISTENT BOTTOM NAV */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-3xl border-t border-gray-200 h-24 flex items-center justify-around px-6 z-[80] shadow-[0_-15px_30px_-5px_rgba(0,0,0,0.08)]">
        {[
          { id: 'overview', icon: 'fa-chart-pie', label: 'Stats' },
          { id: 'orders', icon: 'fa-stream', label: 'Feed' },
          { id: 'inventory', icon: 'fa-warehouse', label: 'Stock' },
          { id: 'sys', icon: 'fa-shield-halved', label: 'Admin' }
        ].map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id)} 
            className={`flex flex-col items-center gap-2 transition-all duration-300 ${activeTab === tab.id ? 'text-blue-600 scale-110' : 'text-gray-400'}`}
          >
            <div className={`w-12 h-12 rounded-[1.2rem] flex items-center justify-center transition-all ${activeTab === tab.id ? 'bg-blue-50' : 'bg-transparent'}`}>
              <i className={`fas ${tab.icon} text-xl`}></i>
            </div>
            <span className="text-[9px] font-black uppercase tracking-widest">{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* FULL-SCREEN OVERLAY: Record View */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-3xl z-[150] flex items-center justify-center p-0 md:p-8 animate-fadeIn">
          <div className="bg-white p-8 md:p-16 w-full h-full md:h-auto md:max-w-4xl md:rounded-[4rem] shadow-2xl relative overflow-y-auto custom-scrollbar">
            <button onClick={() => setSelectedOrder(null)} className="absolute top-10 right-10 text-gray-400 hover:text-black text-3xl transition duration-300"><i className="fas fa-times"></i></button>
            <div className="flex items-center space-x-8 mb-16">
              <span className="text-2xl md:text-5xl font-black italic tracking-tighter uppercase text-zinc-900">Transaction Details</span>
              <span className="px-6 py-2.5 bg-blue-600 text-white text-[11px] font-black rounded-full uppercase tracking-widest shadow-2xl shadow-blue-500/30">ID: #{selectedOrder.id}</span>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 mb-16">
              <div className="space-y-10">
                <h4 className="text-[11px] font-black uppercase tracking-widest text-gray-300 border-b border-gray-100 pb-4 italic">Entity Information</h4>
                <div className="group">
                  <p className="text-[9px] font-black uppercase text-gray-400 mb-2 tracking-widest group-hover:text-blue-500 transition">Customer Name</p>
                  <p className="font-bold text-xl md:text-2xl tracking-tight text-zinc-800 italic">{selectedOrder.customer.name}</p>
                </div>
                <div className="group">
                  <p className="text-[9px] font-black uppercase text-gray-400 mb-2 tracking-widest group-hover:text-blue-500 transition">Contact Endpoint</p>
                  <p className="font-black text-xl md:text-2xl text-blue-600 italic underline underline-offset-[12px] decoration-blue-100">{selectedOrder.customer.phone}</p>
                </div>
                <div className="group">
                  <p className="text-[9px] font-black uppercase text-gray-400 mb-2 tracking-widest group-hover:text-blue-500 transition">Logistics Destination</p>
                  <p className="font-bold text-sm md:text-base leading-relaxed text-gray-600 italic">{selectedOrder.customer.address}, {selectedOrder.customer.city || 'N/A'}</p>
                </div>
              </div>
              <div className="bg-zinc-50 p-10 rounded-[4rem] border border-zinc-100 shadow-inner">
                <h4 className="text-[11px] font-black uppercase tracking-widest text-zinc-400 border-b border-zinc-200 pb-4 mb-10">Consolidated Manifest</h4>
                <div className="space-y-6">
                  {selectedOrder.items.map((itm, i) => (
                    <div key={i} className="flex items-center space-x-6 bg-white p-4 rounded-3xl shadow-sm border border-zinc-100">
                      <div className="w-16 h-16 rounded-[1.5rem] overflow-hidden border-2 border-white bg-white shadow-md flex-shrink-0">
                        <img src={itm.product.image} className="w-full h-full object-cover" />
                      </div>
                      <div className="min-w-0 flex-grow">
                        <p className="text-[14px] md:text-[15px] font-black uppercase tracking-tight text-zinc-800 truncate">{itm.product.name}</p>
                        <p className="text-[11px] font-bold text-zinc-400 mt-1.5 uppercase">Unit Qty: {itm.quantity} • Value: Rs. {itm.product.price.toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="flex flex-col md:flex-row justify-between items-center pt-12 border-t border-gray-100 gap-12">
              <div className="flex items-center space-x-6 w-full md:w-auto">
                <a href={`tel:${selectedOrder.customer.phone}`} className="bg-green-500 text-white w-16 h-16 rounded-[2rem] flex items-center justify-center hover:bg-green-600 transition-all shadow-2xl shadow-green-500/20 flex-shrink-0 active:scale-90"><i className="fas fa-phone text-xl"></i></a>
                <p className="text-[11px] font-black uppercase tracking-widest italic text-zinc-400">Initiate Voice Comm</p>
              </div>
              <div className="text-right w-full md:w-auto">
                <p className="text-[11px] font-black text-gray-300 uppercase tracking-widest mb-3 italic">Total Settlement Value</p>
                <p className="text-5xl md:text-6xl font-black italic tracking-tighter text-blue-600">Rs. {selectedOrder.total.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
