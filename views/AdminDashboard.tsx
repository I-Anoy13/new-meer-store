
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
import { UserRole, Order, Product, Variant } from '../types';

/* 
 * ITX MASTER CONSOLE - MOBILE OPTIMIZED EDITION
 * Features: Responsive Layouts, Prominent Order Status, Custom Alerts, PWA Ready.
 */

const AdminDashboard = (props: any) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [authKey, setAuthKey] = useState('');
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [timeRange, setTimeRange] = useState('6months'); 

  // Notification & Audio State
  const [recentOrderAlert, setRecentOrderAlert] = useState<any>(null);
  const [muted, setMuted] = useState(false);
  const [customAlertBase64, setCustomAlertBase64] = useState<string | null>(() => localStorage.getItem('itx_custom_alert'));
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Product Form State
  const [pName, setPName] = useState('');
  const [pPrice, setPPrice] = useState(0);
  const [pImage, setPImage] = useState('');
  const [pDesc, setPDesc] = useState('');
  const [pCat, setPCat] = useState('Luxury');
  const [pVariants, setPVariants] = useState('');

  // Number Formatter
  const formatCompact = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return num.toString();
  };

  // Analytics Logic
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

  // Fix: Implemented handleSoundUpload to process audio file selection and persistence
  const handleSoundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setCustomAlertBase64(base64);
        localStorage.setItem('itx_custom_alert', base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerOrderAlert = useCallback((order: any) => {
    setRecentOrderAlert(order);
    setTimeout(() => setRecentOrderAlert(null), 10000);

    if (!muted) {
      if (customAlertBase64 && audioRef.current) {
        audioRef.current.play().catch(e => console.error(e));
      } else {
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
      }
    }

    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('NEW ORDER', {
        body: `Order #${order.order_id || order.id} from ${order.customer_name}`,
        icon: 'https://images.unsplash.com/photo-1614164185128-e4ec99c436d7?w=192'
      });
    }
  }, [muted, customAlertBase64]);

  useEffect(() => {
    if (!props.user) return;
    const channel = supabase.channel('dashboard_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
        props.refreshData();
        triggerOrderAlert(payload.new);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [props.user, props.refreshData, triggerOrderAlert]);

  if (!props.user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="bg-white p-8 md:p-12 rounded-[2.5rem] shadow-2xl w-full max-w-sm">
          <div className="text-center mb-10">
            <h1 className="text-xl md:text-2xl font-black uppercase tracking-tighter italic">ITX CONSOLE</h1>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-2">Security Required</p>
          </div>
          <div className="space-y-4">
            <input 
              type="password" value={authKey}
              onChange={(e) => setAuthKey(e.target.value)}
              placeholder="Passkey"
              className="w-full p-4 border-2 border-gray-100 rounded-2xl font-black text-center bg-gray-50 outline-none focus:border-blue-600 transition-all text-sm"
            />
            <button 
              onClick={() => {
                if (authKey === props.systemPassword) props.login(UserRole.ADMIN);
                else window.alert('Invalid credentials.');
              }}
              className="w-full bg-black text-white p-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-blue-600 transition-all"
            >
              Authorize
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-black font-sans pb-20 md:pb-0">
      <audio ref={audioRef} src={customAlertBase64 || undefined} />

      {/* MOBILE OPTIMIZED ALERT */}
      {recentOrderAlert && (
        <div className="fixed top-0 left-0 right-0 z-[100] p-4 animate-slideInTop">
          <div className="bg-black text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between border border-white/10 max-w-md mx-auto">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center animate-bounce">
                <i className="fas fa-shopping-bag text-xs"></i>
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-black uppercase tracking-widest opacity-50 truncate">New Inbound Order</p>
                <p className="font-bold text-xs truncate">#{recentOrderAlert.order_id || recentOrderAlert.id} — {recentOrderAlert.customer_name}</p>
              </div>
            </div>
            <button onClick={() => setRecentOrderAlert(null)} className="ml-4 w-8 h-8 rounded-lg hover:bg-white/10 transition"><i className="fas fa-times text-xs"></i></button>
          </div>
        </div>
      )}

      {/* STICKY HEADER */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b h-16 md:h-20 flex items-center justify-between px-4 md:px-10">
        <div className="flex items-center space-x-4 md:space-x-12">
          <h2 className="text-xs md:text-sm font-black italic tracking-tighter uppercase">ITX MASTER</h2>
          <nav className="hidden md:flex space-x-8 text-[11px] font-black uppercase tracking-widest">
            <button onClick={() => setActiveTab('overview')} className={activeTab === 'overview' ? 'text-blue-600' : 'text-gray-400'}>Overview</button>
            <button onClick={() => setActiveTab('orders')} className={activeTab === 'orders' ? 'text-blue-600' : 'text-gray-400'}>Orders</button>
            <button onClick={() => setActiveTab('inventory')} className={activeTab === 'inventory' ? 'text-blue-600' : 'text-gray-400'}>Stock</button>
          </nav>
        </div>
        <div className="flex items-center space-x-2 md:space-x-4">
          <button onClick={() => setMuted(!muted)} className={`w-9 h-9 md:w-10 md:h-10 rounded-xl border flex items-center justify-center transition ${muted ? 'bg-red-50 text-red-500 border-red-100' : 'text-gray-300'}`}>
            <i className={`fas ${muted ? 'fa-bell-slash' : 'fa-bell'} text-xs`}></i>
          </button>
          <button onClick={props.refreshData} className="bg-gray-50 p-2 md:px-5 md:py-2.5 rounded-xl border hover:bg-white transition text-blue-600 flex items-center">
            <i className="fas fa-sync-alt text-xs md:mr-2"></i>
            <span className="hidden md:inline text-[10px] font-black uppercase">Sync</span>
          </button>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="p-4 md:p-10 max-w-7xl mx-auto space-y-6 md:space-y-10">
        {activeTab === 'overview' && (
          <div className="animate-fadeIn space-y-6 md:space-y-10">
            {/* PERFORMANCE RANGE PICKER */}
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
              <h3 className="font-black text-[10px] md:text-xs uppercase tracking-widest text-gray-400 italic">Financial Summary</h3>
              <div className="flex bg-gray-100 p-1 rounded-xl w-fit">
                {['7days', '30days', '6months'].map(r => (
                  <button key={r} onClick={() => setTimeRange(r)} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition ${timeRange === r ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400'}`}>
                    {r.replace('days', 'd').replace('months', 'm')}
                  </button>
                ))}
              </div>
            </div>

            {/* QUICK STATS - Optimized for 2 cols on mobile */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-8">
              {[
                { label: 'Revenue', val: `Rs. ${formatCompact(analytics.revenue)}`, color: 'text-black' },
                { label: 'Orders', val: analytics.total, color: 'text-black' },
                { label: 'Pending', val: analytics.pendingCount, color: 'text-blue-600' },
                { label: 'Completion', val: `${analytics.total ? Math.round((analytics.deliveredCount / analytics.total) * 100) : 0}%`, color: 'text-gray-400' }
              ].map((s, i) => (
                <div key={i} className="bg-white border border-gray-100 p-4 md:p-8 rounded-[1.5rem] md:rounded-[2.5rem] shadow-sm">
                  <p className="text-[8px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 md:mb-3">{s.label}</p>
                  <p className={`text-xl md:text-3xl font-black tracking-tighter italic ${s.color}`}>{s.val}</p>
                </div>
              ))}
            </div>

            {/* CHART VIEW */}
            <div className="bg-white border border-gray-100 p-6 md:p-10 rounded-[2rem] md:rounded-[3.5rem] shadow-sm overflow-hidden">
               <h4 className="text-[10px] font-black uppercase tracking-widest mb-6">Revenue Trend (Last 6m)</h4>
               <div className="h-48 md:h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={analytics.chartData}>
                      <defs>
                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f1f1" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 800, fill: '#9ca3af'}} />
                      <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 800, fill: '#9ca3af'}} tickFormatter={v => formatCompact(v)} />
                      <Tooltip contentStyle={{borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                      <Area type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                    </AreaChart>
                  </ResponsiveContainer>
               </div>
            </div>

            {/* RECENT FEED - STATUS VISIBLE */}
            <div className="bg-white border border-gray-100 p-6 md:p-10 rounded-[2rem] md:rounded-[3.5rem] shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h4 className="text-[10px] font-black uppercase tracking-widest">Recent Activity</h4>
                <button onClick={() => setActiveTab('orders')} className="text-[9px] font-black text-blue-600 uppercase">View All</button>
              </div>
              <div className="space-y-4">
                {props.orders.slice(0, 5).map((o: Order) => (
                  <div key={o.id} onClick={() => setSelectedOrder(o)} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0 cursor-pointer hover:px-2 transition-all">
                    <div className="flex items-center space-x-3 md:space-x-5 min-w-0">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${o.status === 'Pending' ? 'bg-amber-400 animate-pulse' : o.status === 'Delivered' ? 'bg-green-500' : 'bg-blue-400'}`}></div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate uppercase">#{o.id} — {o.customer.name}</p>
                        <p className="text-[9px] text-gray-400 font-bold uppercase">{o.customer.city}</p>
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end">
                      <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest mb-1 ${o.status === 'Pending' ? 'bg-amber-50 text-amber-600' : 'bg-gray-50 text-gray-400'}`}>
                        {o.status}
                      </span>
                      <p className="text-[9px] font-black text-black">Rs. {o.total.toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="animate-fadeIn space-y-4 md:space-y-6">
            <div className="flex justify-between items-center px-2">
              <h3 className="font-black text-[10px] md:text-xs uppercase tracking-widest text-gray-400 italic">Order Ledger</h3>
              <p className="text-[9px] font-black text-gray-300 uppercase">{props.orders.length} Total</p>
            </div>
            {props.orders.map((o: Order) => (
              <div key={o.id} onClick={() => setSelectedOrder(o)} className="bg-white border border-gray-100 p-4 md:p-8 rounded-[1.5rem] md:rounded-[2.8rem] flex flex-col gap-4 md:flex-row md:justify-between md:items-center shadow-sm hover:shadow-lg transition-all cursor-pointer group">
                <div className="flex items-center space-x-4 md:space-x-6 min-w-0">
                  <div className="w-12 h-12 md:w-16 md:h-16 bg-gray-50 rounded-2xl flex items-center justify-center font-black text-xs md:text-lg border-2 border-transparent group-hover:bg-blue-600 group-hover:text-white transition-all">
                    {String(o.status).charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-black text-sm md:text-lg tracking-tighter">#{o.id}</p>
                      <span className={`md:hidden text-[7px] font-black px-1.5 py-0.5 rounded-md uppercase border ${o.status === 'Pending' ? 'border-amber-200 text-amber-600 bg-amber-50' : 'border-gray-200 text-gray-400 bg-gray-50'}`}>
                        {o.status}
                      </span>
                    </div>
                    <p className="text-[9px] md:text-[11px] font-bold text-gray-400 uppercase mt-1 tracking-widest truncate">{o.customer.name} • {o.customer.city}</p>
                    <p className="text-[9px] font-black text-blue-600 italic mt-1">{o.customer.phone}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between md:justify-end md:space-x-12 border-t md:border-t-0 pt-4 md:pt-0">
                  <div className="md:text-right">
                    <p className="hidden md:block text-[10px] font-black text-gray-300 uppercase mb-1">Total Amount</p>
                    <p className="text-sm md:text-xl font-black italic">Rs. {o.total.toLocaleString()}</p>
                  </div>
                  <select 
                    value={o.status} 
                    onClick={(e) => e.stopPropagation()}
                    onChange={e => props.updateStatusOverride?.(o.id, e.target.value as any)}
                    className="border-2 p-2 md:p-4 rounded-xl md:rounded-2xl text-[9px] md:text-[11px] font-black uppercase bg-gray-50 outline-none focus:border-blue-600 transition shadow-sm min-w-[100px] md:min-w-[160px]"
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
            <div className="flex justify-between items-center">
              <h3 className="font-black text-[10px] md:text-xs uppercase tracking-widest text-gray-400 italic">Inventory</h3>
              <button 
                onClick={() => setIsAddProductOpen(true)}
                className="bg-black text-white px-6 md:px-10 py-3 md:py-4 rounded-xl md:rounded-3xl text-[9px] md:text-[11px] font-black uppercase tracking-widest shadow-xl active:scale-95 transition"
              >
                + Add Item
              </button>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-8">
              {props.products.map((itm: Product) => (
                <div key={itm.id} className="bg-white border border-gray-100 p-3 md:p-6 rounded-[1.5rem] md:rounded-[3.5rem] group relative shadow-sm hover:shadow-xl transition-all">
                  <div className="aspect-square relative mb-3 md:mb-6 overflow-hidden rounded-[1.2rem] md:rounded-[2.5rem]">
                    <img src={itm.image} className="w-full h-full object-cover transition duration-500 group-hover:scale-110" alt="" />
                    <button onClick={(e) => { e.stopPropagation(); if(confirm('Delete?')) props.deleteProduct(itm.id); }} className="absolute top-2 right-2 md:top-4 md:right-4 bg-red-600 text-white w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-xl">
                      <i className="fas fa-trash-alt text-[10px]"></i>
                    </button>
                  </div>
                  <div className="px-1">
                    <p className="text-[7px] md:text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1 italic">{itm.category}</p>
                    <p className="text-[10px] md:text-[14px] font-black truncate uppercase text-zinc-800 mb-2">{itm.name}</p>
                    <div className="flex justify-between items-center pt-2 border-t border-gray-50">
                      <span className="text-[10px] md:text-[14px] font-black">Rs. {itm.price.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'sys' && (
          <div className="max-w-2xl bg-white border border-gray-100 p-6 md:p-12 rounded-[2rem] md:rounded-[4rem] shadow-sm animate-fadeIn space-y-8 md:space-y-12 mx-auto">
            <div>
              <p className="text-[9px] md:text-[11px] font-black text-gray-400 mb-4 md:mb-8 uppercase tracking-widest italic">PWA Alert Control</p>
              <div className="bg-gray-50 p-6 md:p-10 rounded-[1.5rem] md:rounded-[2.5rem] border border-gray-100 shadow-inner space-y-6">
                <div>
                  <label className="block text-[8px] md:text-[10px] font-black uppercase text-gray-400 mb-4 tracking-widest italic">Alert Frequency Library</label>
                  <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                    <input type="file" accept="audio/*" onChange={handleSoundUpload} className="hidden" id="sound-upload" />
                    <label htmlFor="sound-upload" className="cursor-pointer bg-white border border-gray-100 px-6 py-3 md:px-8 md:py-4 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest hover:border-black transition-all shadow-sm">
                      {customAlertBase64 ? 'Update Sound' : 'Upload File'}
                    </label>
                    <div className="flex gap-2 md:gap-3">
                      <button onClick={() => triggerOrderAlert({ order_id: 'TEST', customer_name: 'Test Node', total: 0 })} className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition"><i className="fas fa-play text-xs"></i></button>
                      {customAlertBase64 && (
                        <button onClick={() => { localStorage.removeItem('itx_custom_alert'); setCustomAlertBase64(null); }} className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-red-50 text-red-500 border border-red-100 flex items-center justify-center"><i className="fas fa-trash text-xs"></i></button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="pt-4 border-t border-gray-200">
                  <button onClick={() => Notification.requestPermission()} className="bg-white border px-4 py-2 rounded-lg text-[8px] font-black uppercase tracking-widest hover:bg-black hover:text-white transition">Request Push Access</button>
                </div>
              </div>
            </div>
            <div className="pt-6 border-t border-gray-100">
              <p className="text-[9px] md:text-[11px] font-black text-gray-400 mb-4 md:mb-8 uppercase tracking-widest italic">Security</p>
              <div className="flex gap-3">
                <input 
                  value={props.systemPassword} 
                  onChange={e => props.setSystemPassword(e.target.value)} 
                  className="border border-gray-100 p-4 rounded-xl w-full text-xs font-bold bg-gray-50 outline-none focus:border-blue-500 shadow-inner" 
                  placeholder="Master Key"
                />
                <button onClick={() => { localStorage.setItem('systemPassword', props.systemPassword); window.alert('Secured.'); }} className="bg-black text-white px-6 rounded-xl text-[9px] font-black uppercase tracking-widest">Update</button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MOBILE BOTTOM NAVIGATION */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 h-16 flex items-center justify-around px-4 z-50">
        <button onClick={() => setActiveTab('overview')} className={`flex flex-col items-center gap-1 ${activeTab === 'overview' ? 'text-blue-600' : 'text-gray-400'}`}>
          <i className="fas fa-chart-line text-lg"></i>
          <span className="text-[8px] font-black uppercase">Home</span>
        </button>
        <button onClick={() => setActiveTab('orders')} className={`flex flex-col items-center gap-1 ${activeTab === 'orders' ? 'text-blue-600' : 'text-gray-400'}`}>
          <i className="fas fa-shopping-cart text-lg"></i>
          <span className="text-[8px] font-black uppercase">Orders</span>
        </button>
        <button onClick={() => setActiveTab('inventory')} className={`flex flex-col items-center gap-1 ${activeTab === 'inventory' ? 'text-blue-600' : 'text-gray-400'}`}>
          <i className="fas fa-box text-lg"></i>
          <span className="text-[8px] font-black uppercase">Stock</span>
        </button>
        <button onClick={() => setActiveTab('sys')} className={`flex flex-col items-center gap-1 ${activeTab === 'sys' ? 'text-blue-600' : 'text-gray-400'}`}>
          <i className="fas fa-cog text-lg"></i>
          <span className="text-[8px] font-black uppercase">Setup</span>
        </button>
      </nav>

      {/* MODAL OVERLAYS - FULL SCREEN ON MOBILE */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[60] flex items-center justify-center p-0 md:p-6 animate-fadeIn">
          <div className="bg-white p-6 md:p-12 w-full h-full md:h-auto md:max-w-2xl md:rounded-[4rem] shadow-2xl relative overflow-y-auto">
            <button onClick={() => setSelectedOrder(null)} className="absolute top-6 right-6 md:top-10 md:right-10 text-gray-400 hover:text-black text-xl transition"><i className="fas fa-times"></i></button>
            <div className="flex items-center space-x-4 mb-8 md:mb-12">
              <span className="text-xl md:text-3xl font-black italic tracking-tighter uppercase">Record View</span>
              <span className="px-3 py-1 bg-blue-600 text-white text-[8px] font-black rounded-full uppercase tracking-widest shadow-lg shadow-blue-200">#{selectedOrder.id}</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 mb-8 md:mb-12">
              <div className="space-y-6">
                <h4 className="text-[9px] font-black uppercase tracking-widest text-gray-300 border-b pb-2 italic">Client Info</h4>
                <div>
                  <p className="text-[9px] font-black uppercase text-gray-400 mb-1">Name</p>
                  <p className="font-bold text-base">{selectedOrder.customer.name}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase text-gray-400 mb-1">Contact</p>
                  <p className="font-black text-base text-blue-600 italic">{selectedOrder.customer.phone}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase text-gray-400 mb-1">Destination</p>
                  <p className="font-bold text-sm leading-relaxed text-gray-600">{selectedOrder.customer.address}, {selectedOrder.customer.city}</p>
                </div>
              </div>
              <div className="bg-zinc-50 p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] border border-zinc-100 shadow-inner">
                <h4 className="text-[9px] font-black uppercase tracking-widest text-zinc-400 border-b border-zinc-200 pb-2 mb-6">Manifest</h4>
                <div className="space-y-4">
                  {selectedOrder.items.map((itm, i) => (
                    <div key={i} className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-xl overflow-hidden border bg-white shadow-sm">
                        <img src={itm.product.image} className="w-full h-full object-cover" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-tight text-zinc-800 truncate">{itm.product.name}</p>
                        <p className="text-[8px] font-bold text-zinc-400">Qty: {itm.quantity} — Rs. {itm.product.price.toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="flex flex-col md:flex-row justify-between items-center pt-8 border-t border-gray-100 gap-6">
              <div className="flex items-center space-x-4 w-full md:w-auto">
                <a href={`tel:${selectedOrder.customer.phone}`} className="bg-green-500 text-white w-12 h-12 rounded-2xl flex items-center justify-center hover:bg-green-600 shadow-lg shadow-green-100 flex-shrink-0 transition-transform active:scale-90"><i className="fas fa-phone"></i></a>
                <p className="text-[10px] font-black uppercase tracking-widest italic text-zinc-400">Direct Contact</p>
              </div>
              <div className="text-right w-full md:w-auto">
                <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-1 italic">Settlement Amount</p>
                <p className="text-3xl font-black italic tracking-tighter text-blue-600">Rs. {selectedOrder.total.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {isAddProductOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[200] flex items-center justify-center p-0 md:p-6 animate-fadeIn">
          <div className="bg-white p-6 md:p-12 w-full h-full md:h-auto md:max-w-md md:rounded-[4rem] shadow-2xl relative overflow-y-auto">
            <button onClick={() => setIsAddProductOpen(false)} className="absolute top-6 right-6 md:top-10 md:right-10 text-gray-400 hover:text-black text-xl transition"><i className="fas fa-times"></i></button>
            <h3 className="text-2xl md:text-3xl font-black italic tracking-tighter uppercase mb-8">Stock Entry</h3>
            <div className="space-y-4 md:space-y-6">
              <input className="w-full border p-4 rounded-xl text-xs font-bold bg-zinc-50 focus:border-blue-500 outline-none transition-all" placeholder="Item Title" value={pName} onChange={e => setPName(e.target.value)} />
              <div className="grid grid-cols-2 gap-3">
                <input className="w-full border p-4 rounded-xl text-xs font-bold bg-zinc-50 focus:border-blue-500 outline-none" placeholder="Price" type="number" value={pPrice} onChange={e => setPPrice(Number(e.target.value))} />
                <input className="w-full border p-4 rounded-xl text-xs font-bold bg-zinc-50 focus:border-blue-500 outline-none" placeholder="Variants" value={pVariants} onChange={e => setPVariants(e.target.value)} />
              </div>
              <input className="w-full border p-4 rounded-xl text-xs font-bold bg-zinc-50 focus:border-blue-500 outline-none" placeholder="Cover Image URL" value={pImage} onChange={e => setPImage(e.target.value)} />
              <textarea className="w-full border p-4 rounded-xl text-xs font-bold bg-zinc-50 focus:border-blue-500 outline-none h-24 resize-none" placeholder="Item Story" value={pDesc} onChange={e => setPDesc(e.target.value)} />
              <select className="w-full border p-4 rounded-xl text-xs font-bold bg-zinc-50" value={pCat} onChange={e => setPCat(e.target.value)}>
                <option value="Luxury">Luxury Artisan</option>
                <option value="Minimalist">Minimalist / Heritage</option>
                <option value="Professional">Professional Series</option>
              </select>
              <button 
                className="w-full bg-black text-white p-5 rounded-2xl font-black text-xs uppercase tracking-widest mt-4 shadow-xl active:scale-95 transition"
                onClick={async () => {
                  if(!pName || !pPrice || !pImage) return window.alert('Metadata missing.');
                  const variantArr = pVariants.split(',').filter(v => v.trim()).map(v => ({ id: `v-${Math.random().toString(36).substr(2, 5)}`, name: v.trim(), price: pPrice }));
                  const { error } = await supabase.from('products').insert([{ 
                    name: pName, price_pkr: pPrice, image: pImage, 
                    description: pDesc || pName, category: pCat, inventory: 15, variants: variantArr 
                  }]);
                  if (error) window.alert('Error: ' + error.message);
                  else { props.refreshData(); setIsAddProductOpen(false); setPName(''); setPPrice(0); setPImage(''); setPVariants(''); setPDesc(''); }
                }}
              >
                Publish Live
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
