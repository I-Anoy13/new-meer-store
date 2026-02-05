
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
 * ITX MASTER CONSOLE - PRO LIVE EDITION
 * Features:
 * - Persistent Real-time Supabase Listeners
 * - Background PWA Notifications (SW based)
 * - Custom Audio Chime Management
 * - No Manual Sync Required
 */

const AdminDashboard = (props: any) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [authKey, setAuthKey] = useState('');
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [timeRange, setTimeRange] = useState('6months'); 
  const [isLive, setIsLive] = useState(false);

  // Notification & Audio Logic
  const [recentOrderAlert, setRecentOrderAlert] = useState<any>(null);
  const [muted, setMuted] = useState(false);
  const [customAlertBase64, setCustomAlertBase64] = useState<string | null>(() => localStorage.getItem('itx_custom_alert'));
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Analytics calculated from real order data
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

  const handleSoundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setCustomAlertBase64(base64);
        localStorage.setItem('itx_custom_alert', base64);
        window.alert('Custom notification sound saved.');
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerOrderAlert = useCallback((order: any) => {
    // 1. UI Feedback
    setRecentOrderAlert(order);
    setTimeout(() => setRecentOrderAlert(null), 15000);

    // 2. Audio Chime
    if (!muted) {
      if (customAlertBase64 && audioRef.current) {
        audioRef.current.play().catch(() => {
          console.log("Auto-play blocked, interaction required.");
        });
      } else {
        // Fallback synthetic chime
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
            gain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
            osc.connect(gain); gain.connect(ctx.destination);
            osc.start(); osc.stop(ctx.currentTime + 0.5);
          }
        } catch {}
      }
    }

    // 3. System Notification
    if ('serviceWorker' in navigator && Notification.permission === 'granted') {
      navigator.serviceWorker.ready.then((registration) => {
        registration.showNotification(`NEW ORDER: #${order.order_id || order.id}`, {
          body: `${order.customer_name} from ${order.customer_city || 'Pakistan'} placed an order worth Rs. ${order.total_pkr || order.total}`,
          icon: 'https://images.unsplash.com/photo-1614164185128-e4ec99c436d7?q=80&w=192&h=192&auto=format&fit=crop',
          badge: 'https://images.unsplash.com/photo-1614164185128-e4ec99c436d7?q=80&w=192&h=192&auto=format&fit=crop',
          tag: 'itx-order-' + order.id,
          requireInteraction: true,
          vibrate: [200, 100, 200]
        } as any);
      });
    }
  }, [muted, customAlertBase64]);

  // PRIMARY REAL-TIME SYNC HUB
  useEffect(() => {
    if (!props.user) return;
    
    console.log("Initializing Real-time Sync Channel...");
    const channel = supabase.channel('order_stream_v1')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
        console.log("Real-time INSERT Detected:", payload.new);
        props.refreshData(); // Triggers re-fetch in AdminApp.tsx
        triggerOrderAlert(payload.new);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setIsLive(true);
        else setIsLive(false);
      });

    return () => { supabase.removeChannel(channel); };
  }, [props.user, props.refreshData, triggerOrderAlert]);

  // Splash/Login Screen
  if (!props.user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="bg-white p-10 md:p-12 rounded-[3rem] shadow-2xl w-full max-w-sm border border-gray-100">
          <div className="text-center mb-10">
            <h1 className="text-3xl font-black uppercase tracking-tighter italic text-black">ITX CONSOLE</h1>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-2 italic">Secured Management Portal</p>
          </div>
          <div className="space-y-4">
            <input 
              type="password" value={authKey}
              onChange={(e) => setAuthKey(e.target.value)}
              placeholder="Authorization Key"
              className="w-full p-5 border-2 border-gray-100 rounded-3xl font-black text-center bg-gray-50 outline-none focus:border-blue-600 transition-all text-sm"
            />
            <button 
              onClick={() => {
                if (authKey === props.systemPassword) props.login(UserRole.ADMIN);
                else window.alert('Authorization failed.');
              }}
              className="w-full bg-black text-white p-5 rounded-3xl font-black uppercase text-xs tracking-widest hover:bg-blue-600 transition-all shadow-xl active:scale-95"
            >
              Enter Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-black font-sans pb-24 md:pb-0 overflow-x-hidden">
      <audio ref={audioRef} src={customAlertBase64 || undefined} />

      {/* FLOATING IN-APP NOTIFICATION */}
      {recentOrderAlert && (
        <div className="fixed top-0 left-0 right-0 z-[100] p-4 animate-slideInTop">
          <div className="bg-black text-white p-4 md:p-6 rounded-2xl md:rounded-full shadow-2xl flex items-center justify-between border border-white/10 max-w-2xl mx-auto ring-4 ring-blue-600/20">
            <div className="flex items-center space-x-4 min-w-0">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center animate-bounce flex-shrink-0">
                <i className="fas fa-shopping-bag text-xs"></i>
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-black uppercase tracking-widest opacity-50 italic">New Inbound Order</p>
                <p className="font-bold text-xs md:text-sm truncate">#{recentOrderAlert.order_id || recentOrderAlert.id} • {recentOrderAlert.customer_name}</p>
              </div>
            </div>
            <button onClick={() => setRecentOrderAlert(null)} className="ml-4 w-8 h-8 rounded-lg hover:bg-white/10 transition flex-shrink-0">
              <i className="fas fa-times text-xs"></i>
            </button>
          </div>
        </div>
      )}

      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b h-16 md:h-20 flex items-center justify-between px-6 md:px-10">
        <div className="flex items-center space-x-4 md:space-x-12">
          <div className="flex items-center gap-2.5">
            <h2 className="text-xs md:text-sm font-black italic tracking-tighter uppercase">ITX MASTER</h2>
            <div className={`w-2.5 h-2.5 rounded-full ${isLive ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 'bg-red-500 shadow-[0_0_8px_#ef4444]'} animate-pulse`}></div>
          </div>
          <nav className="hidden md:flex space-x-8 text-[11px] font-black uppercase tracking-widest">
            <button onClick={() => setActiveTab('overview')} className={activeTab === 'overview' ? 'text-blue-600' : 'text-gray-400'}>Analytics</button>
            <button onClick={() => setActiveTab('orders')} className={activeTab === 'orders' ? 'text-blue-600' : 'text-gray-400'}>Orders</button>
            <button onClick={() => setActiveTab('inventory')} className={activeTab === 'inventory' ? 'text-blue-600' : 'text-gray-400'}>Stock</button>
            <button onClick={() => setActiveTab('sys')} className={activeTab === 'sys' ? 'text-blue-600' : 'text-gray-400'}>System</button>
          </nav>
        </div>
        <div className="flex items-center space-x-3">
          <button onClick={() => setMuted(!muted)} className={`w-9 h-9 md:w-10 md:h-10 rounded-xl border flex items-center justify-center transition shadow-sm ${muted ? 'bg-red-50 text-red-500 border-red-100' : 'bg-white text-gray-300'}`}>
            <i className={`fas ${muted ? 'fa-bell-slash' : 'fa-bell'} text-xs`}></i>
          </button>
          <button onClick={props.refreshData} className="bg-black text-white px-5 py-2 md:px-7 md:py-2.5 rounded-xl md:rounded-2xl hover:bg-blue-600 transition text-[10px] font-black uppercase tracking-widest shadow-lg flex items-center">
            <i className="fas fa-sync-alt mr-2"></i> <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="p-4 md:p-10 max-w-7xl mx-auto space-y-8">
        {activeTab === 'overview' && (
          <div className="animate-fadeIn space-y-8">
            <div className="flex justify-between items-center px-1">
              <h3 className="font-black text-[10px] md:text-xs uppercase tracking-widest text-gray-400 italic">Financial Summary</h3>
              <div className="flex bg-gray-200 p-1 rounded-xl">
                {['7days', '30days', '6months'].map(r => (
                  <button key={r} onClick={() => setTimeRange(r)} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition ${timeRange === r ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400'}`}>
                    {r.replace('days', 'd').replace('months', 'm')}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-8">
              {[
                { label: 'Revenue', val: `Rs. ${analytics.revenue.toLocaleString()}`, color: 'text-black' },
                { label: 'Total Orders', val: analytics.total, color: 'text-black' },
                { label: 'Unfulfilled', val: analytics.pendingCount, color: 'text-blue-600' },
                { label: 'Success Rate', val: `${analytics.total ? Math.round((analytics.deliveredCount / analytics.total) * 100) : 0}%`, color: 'text-green-600' }
              ].map((s, i) => (
                <div key={i} className="bg-white border border-gray-100 p-6 md:p-8 rounded-[1.8rem] md:rounded-[2.5rem] shadow-sm relative overflow-hidden group hover:shadow-md transition">
                  <p className="text-[8px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 md:mb-3">{s.label}</p>
                  <p className={`text-xl md:text-3xl font-black tracking-tighter italic ${s.color}`}>{s.val}</p>
                </div>
              ))}
            </div>

            <div className="bg-white border border-gray-100 p-6 md:p-10 rounded-[2rem] md:rounded-[3.5rem] shadow-sm">
              <h4 className="text-[10px] font-black uppercase tracking-widest mb-8 text-zinc-300">Revenue Performance Trend</h4>
              <div className="h-56 md:h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analytics.chartData}>
                    <defs>
                      <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15}/>
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f1f1" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 900, fill: '#9ca3af'}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 900, fill: '#9ca3af'}} />
                    <Tooltip contentStyle={{borderRadius: '1.2rem', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)'}} />
                    <Area type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={5} fillOpacity={1} fill="url(#colorRev)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="animate-fadeIn space-y-4 md:space-y-6">
            <div className="flex justify-between items-center px-2">
              <h3 className="font-black text-[10px] md:text-xs uppercase tracking-widest text-gray-400 italic">Inbound Feed</h3>
              <p className="text-[9px] font-black text-gray-300 uppercase">{props.orders.length} Records</p>
            </div>
            {props.orders.map((o: Order) => (
              <div key={o.id} onClick={() => setSelectedOrder(o)} className="bg-white border border-gray-100 p-5 md:p-8 rounded-[2rem] md:rounded-[3rem] flex flex-col gap-4 md:flex-row md:justify-between md:items-center shadow-sm hover:shadow-xl transition-all cursor-pointer group">
                <div className="flex items-center space-x-5 md:space-x-8 min-w-0">
                  <div className={`w-14 h-14 md:w-16 md:h-16 rounded-[1.2rem] md:rounded-3xl flex items-center justify-center font-black text-sm md:text-lg border-2 transition-all duration-300 ${o.status === 'Delivered' ? 'bg-green-50 text-green-500 border-green-100' : 'bg-gray-50 border-gray-50 text-gray-400 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-500'}`}>
                    {String(o.status).charAt(0)}
                  </div>
                  <div className="min-w-0 flex-grow">
                    <div className="flex items-center gap-2 md:gap-3">
                      <p className="font-black text-sm md:text-xl tracking-tighter">#{o.id}</p>
                      <span className={`text-[8px] md:text-[10px] font-black px-2 py-0.5 rounded-lg uppercase tracking-widest border ${o.status === 'Pending' ? 'border-amber-200 text-amber-600 bg-amber-50 animate-pulse' : 'border-gray-100 text-gray-400 bg-gray-50'}`}>
                        {o.status}
                      </span>
                    </div>
                    <p className="text-[10px] md:text-[12px] font-bold text-gray-400 uppercase mt-1.5 tracking-wide truncate">{o.customer.name} • {o.customer.city}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between md:justify-end md:space-x-12 border-t md:border-t-0 pt-4 md:pt-0">
                  <div className="md:text-right">
                    <p className="hidden md:block text-[9px] font-black text-gray-300 uppercase mb-1 italic">Settlement Total</p>
                    <p className="text-base md:text-2xl font-black italic tracking-tighter">Rs. {o.total.toLocaleString()}</p>
                  </div>
                  <select 
                    value={o.status} 
                    onClick={(e) => e.stopPropagation()}
                    onChange={e => props.updateStatusOverride?.(o.id, e.target.value as any)}
                    className="border-2 p-3 md:p-4 rounded-xl md:rounded-2xl text-[9px] md:text-[11px] font-black uppercase bg-gray-50 outline-none focus:border-blue-600 transition shadow-sm min-w-[120px] md:min-w-[180px]"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Confirmed">Confirmed</option>
                    <option value="Shipped">Shipped</option>
                    <option value="Delivered">Delivered</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'inventory' && (
          <div className="animate-fadeIn space-y-6">
             <div className="flex justify-between items-center px-2">
              <h3 className="font-black text-[10px] md:text-xs uppercase tracking-widest text-gray-400 italic">Inventory Controller</h3>
              <button 
                onClick={() => setIsAddProductOpen(true)}
                className="bg-black text-white px-7 md:px-12 py-3.5 md:py-4.5 rounded-2xl md:rounded-[2.5rem] text-[9px] md:text-[11px] font-black uppercase tracking-widest shadow-xl active:scale-95 transition hover:bg-blue-600"
              >
                + Publish Collection
              </button>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8">
              {props.products.map((itm: Product) => (
                <div key={itm.id} className="bg-white border border-gray-100 p-4 md:p-6 rounded-[1.8rem] md:rounded-[3rem] group relative shadow-sm hover:shadow-2xl transition-all">
                  <div className="aspect-square relative mb-5 overflow-hidden rounded-[1.2rem] md:rounded-[2.2rem]">
                    <img src={itm.image} className="w-full h-full object-cover group-hover:scale-110 transition duration-700" alt="" />
                    <button onClick={(e) => { e.stopPropagation(); if(confirm('Delete?')) props.deleteProduct(itm.id); }} className="absolute top-3 right-3 bg-red-600 text-white w-9 h-9 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-xl">
                      <i className="fas fa-trash-alt text-[10px]"></i>
                    </button>
                  </div>
                  <p className="text-[7px] md:text-[9px] font-black text-blue-600 uppercase tracking-widest mb-1.5 italic">{itm.category}</p>
                  <p className="text-[11px] md:text-[14px] font-black truncate uppercase tracking-tight text-zinc-800">{itm.name}</p>
                  <div className="flex justify-between items-center mt-3.5 pt-3.5 border-t border-gray-50">
                    <span className="text-[11px] md:text-[14px] font-black italic">Rs. {itm.price.toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'sys' && (
          <div className="max-w-2xl bg-white border border-gray-100 p-8 md:p-14 rounded-[3rem] md:rounded-[5rem] shadow-sm animate-fadeIn space-y-12 mx-auto">
            <div className="space-y-8">
              <p className="text-[10px] md:text-[12px] font-black text-gray-400 uppercase tracking-widest italic">PWA Alert Hub</p>
              
              <div className="bg-gray-50 p-6 md:p-12 rounded-[2.5rem] md:rounded-[3.5rem] border border-gray-100 shadow-inner space-y-10">
                <div className="space-y-6">
                  <label className="block text-[8px] md:text-[10px] font-black uppercase text-gray-400 tracking-widest italic">Custom Order Chime (MP3/WAV)</label>
                  <div className="flex flex-col sm:flex-row gap-5 items-start sm:items-center">
                    <input type="file" accept="audio/*" onChange={handleSoundUpload} className="hidden" id="sound-upload" />
                    <label htmlFor="sound-upload" className="cursor-pointer bg-white border-2 border-gray-100 px-8 py-3.5 rounded-2xl text-[9px] font-black uppercase tracking-widest hover:border-black transition shadow-sm">
                      {customAlertBase64 ? 'Update Trigger' : 'Upload Chime'}
                    </label>
                    <div className="flex gap-3">
                      <button onClick={() => triggerOrderAlert({ order_id: 'TEST', customer_name: 'PWA Node', total: 0 })} className="w-11 h-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg active:scale-90 transition"><i className="fas fa-play text-xs"></i></button>
                      {customAlertBase64 && (
                        <button onClick={() => { localStorage.removeItem('itx_custom_alert'); setCustomAlertBase64(null); }} className="w-11 h-11 rounded-2xl bg-red-50 text-red-500 border border-red-100 flex items-center justify-center"><i className="fas fa-trash text-xs"></i></button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-8 border-t border-gray-200">
                  <p className="text-[8px] md:text-[10px] font-black uppercase text-gray-400 mb-6 tracking-widest italic">Device Authorization</p>
                  <button 
                    onClick={() => {
                      // Request Permission + Unlock AudioContext (User Gesture)
                      Notification.requestPermission().then(perm => {
                        const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
                        if (AudioCtx) {
                          const ctx = new AudioCtx();
                          ctx.resume().then(() => {
                            window.alert(`System Warm-up Complete. Status: ${perm}`);
                          });
                        }
                      });
                    }} 
                    className="w-full bg-black text-white px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition shadow-xl"
                  >
                    Authorize Notifications & Audio
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-10 border-t border-gray-100">
              <p className="text-[10px] md:text-[12px] font-black text-gray-400 mb-8 uppercase tracking-widest italic">Security Configuration</p>
              <div className="flex gap-4">
                <input 
                  value={props.systemPassword} 
                  onChange={e => props.setSystemPassword(e.target.value)} 
                  className="border-2 border-gray-50 p-5 rounded-2xl md:rounded-3xl w-full text-xs font-bold bg-gray-50 outline-none focus:border-blue-500 shadow-inner" 
                  placeholder="Master Passkey"
                />
                <button onClick={() => { localStorage.setItem('systemPassword', props.systemPassword); window.alert('Security Hash Updated.'); }} className="bg-black text-white px-10 rounded-2xl md:rounded-3xl text-[9px] font-black uppercase tracking-widest active:scale-95 transition shadow-lg">Save</button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MOBILE BOTTOM NAV */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-gray-100 h-20 flex items-center justify-around px-4 z-[80] shadow-[0_-10px_25px_-5px_rgba(0,0,0,0.05)]">
        {[
          { id: 'overview', icon: 'fa-chart-line', label: 'Dash' },
          { id: 'orders', icon: 'fa-shopping-cart', label: 'Feed' },
          { id: 'inventory', icon: 'fa-box', label: 'Stock' },
          { id: 'sys', icon: 'fa-cog', label: 'Config' }
        ].map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id)} 
            className={`flex flex-col items-center gap-1.5 transition-all ${activeTab === tab.id ? 'text-blue-600 scale-110' : 'text-gray-400'}`}
          >
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${activeTab === tab.id ? 'bg-blue-50' : 'bg-transparent'}`}>
              <i className={`fas ${tab.icon} text-lg`}></i>
            </div>
            <span className="text-[8px] font-black uppercase tracking-widest">{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* MODAL: Order Details */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl z-[90] flex items-center justify-center p-0 md:p-6 animate-fadeIn">
          <div className="bg-white p-6 md:p-14 w-full h-full md:h-auto md:max-w-3xl md:rounded-[4rem] shadow-2xl relative overflow-y-auto custom-scrollbar">
            <button onClick={() => setSelectedOrder(null)} className="absolute top-8 right-8 text-gray-400 hover:text-black text-2xl transition"><i className="fas fa-times"></i></button>
            <div className="flex items-center space-x-6 mb-12">
              <span className="text-xl md:text-4xl font-black italic tracking-tighter uppercase text-zinc-900">Record View</span>
              <span className="px-5 py-2 bg-blue-600 text-white text-[10px] font-black rounded-full uppercase tracking-widest shadow-xl shadow-blue-200">#{selectedOrder.id}</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-12">
              <div className="space-y-8">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-300 border-b pb-3 italic">Client Dossier</h4>
                <div>
                  <p className="text-[8px] md:text-[9px] font-black uppercase text-gray-400 mb-1.5 tracking-widest">Legal Name</p>
                  <p className="font-bold text-lg md:text-xl tracking-tight text-zinc-800">{selectedOrder.customer.name}</p>
                </div>
                <div>
                  <p className="text-[8px] md:text-[9px] font-black uppercase text-gray-400 mb-1.5 tracking-widest">Mobile Contact</p>
                  <p className="font-black text-lg md:text-xl text-blue-600 italic underline underline-offset-8 decoration-blue-100">{selectedOrder.customer.phone}</p>
                </div>
                <div>
                  <p className="text-[8px] md:text-[9px] font-black uppercase text-gray-400 mb-1.5 tracking-widest">Fulfillment Point</p>
                  <p className="font-bold text-sm leading-relaxed text-gray-600 italic">{selectedOrder.customer.address}, {selectedOrder.customer.city}</p>
                </div>
              </div>
              <div className="bg-zinc-50 p-8 rounded-[2.5rem] md:rounded-[4rem] border border-zinc-100 shadow-inner">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 border-b border-zinc-200 pb-3 mb-8">Order Manifest</h4>
                <div className="space-y-5">
                  {selectedOrder.items.map((itm, i) => (
                    <div key={i} className="flex items-center space-x-5">
                      <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-white bg-white shadow-md flex-shrink-0">
                        <img src={itm.product.image} className="w-full h-full object-cover" />
                      </div>
                      <div className="min-w-0 flex-grow">
                        <p className="text-[12px] md:text-[13px] font-black uppercase tracking-tight text-zinc-800 truncate">{itm.product.name}</p>
                        <p className="text-[10px] font-bold text-zinc-400 mt-1">Qty: {itm.quantity} • Rs. {itm.product.price.toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="flex flex-col md:flex-row justify-between items-center pt-10 border-t border-gray-100 gap-10">
              <div className="flex items-center space-x-5 w-full md:w-auto">
                <a href={`tel:${selectedOrder.customer.phone}`} className="bg-green-500 text-white w-14 h-14 rounded-[1.8rem] flex items-center justify-center hover:bg-green-600 transition shadow-xl shadow-green-100 flex-shrink-0 active:scale-90"><i className="fas fa-phone text-lg"></i></a>
                <p className="text-[10px] font-black uppercase tracking-widest italic text-zinc-400">Direct Comms Hub</p>
              </div>
              <div className="text-right w-full md:w-auto">
                <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-1.5 italic">Total Settlement</p>
                <p className="text-4xl md:text-5xl font-black italic tracking-tighter text-blue-600">Rs. {selectedOrder.total.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
