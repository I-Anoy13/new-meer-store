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
 * ITX MASTER CONSOLE - PRO MOBILE EDITION
 * Optimized for Shopify-style management on the go.
 */

const AdminDashboard = (props: any) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [authKey, setAuthKey] = useState('');
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [timeRange, setTimeRange] = useState('6months'); 

  // Real-time Notification States
  const [recentOrderAlert, setRecentOrderAlert] = useState<any>(null);
  const [muted, setMuted] = useState(false);
  const [customAlertBase64, setCustomAlertBase64] = useState<string | null>(() => localStorage.getItem('itx_custom_alert'));
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Analytics Engine - Processes real Supabase data
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
    
    // Generate 6 months of data for the chart
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const mLabel = monthNames[d.getMonth()];
      const mYear = d.getFullYear();
      const mOrders = props.orders.filter((o: Order) => {
        const od = new Date(o.date);
        return od.getMonth() === d.getMonth() && od.getFullYear() === mYear && o.status !== 'Cancelled';
      });
      chartData.push({ 
        name: mLabel, 
        revenue: mOrders.reduce((sum: number, o: Order) => sum + o.total, 0),
        count: mOrders.length
      });
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
        window.alert('Custom sound uploaded. Test it with the play button.');
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerOrderAlert = useCallback((order: any) => {
    setRecentOrderAlert(order);
    setTimeout(() => setRecentOrderAlert(null), 10000);

    if (!muted) {
      if (customAlertBase64 && audioRef.current) {
        audioRef.current.play().catch(e => console.error("Audio error:", e));
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
      new Notification('NEW ORDER RECEIVED', {
        body: `Order #${order.order_id || order.id} from ${order.customer_name}`,
        icon: 'https://images.unsplash.com/photo-1614164185128-e4ec99c436d7?w=128'
      });
    }
  }, [muted, customAlertBase64]);

  // Establish Real-time Sync
  useEffect(() => {
    if (!props.user) return;
    const channel = supabase.channel('itx_realtime_dashboard')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
        props.refreshData(); // Triggers a re-fetch in AdminApp
        triggerOrderAlert(payload.new);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [props.user, props.refreshData, triggerOrderAlert]);

  if (!props.user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="bg-white p-10 md:p-12 rounded-[2.5rem] shadow-2xl w-full max-w-sm">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-black uppercase tracking-tighter italic">ITX CONSOLE</h1>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-2">Access Portal</p>
          </div>
          <div className="space-y-4">
            <input 
              type="password" value={authKey}
              onChange={(e) => setAuthKey(e.target.value)}
              placeholder="System Passkey"
              className="w-full p-4 border-2 border-gray-100 rounded-2xl font-black text-center bg-gray-50 outline-none focus:border-blue-600 transition-all text-sm"
            />
            <button 
              onClick={() => {
                if (authKey === props.systemPassword) props.login(UserRole.ADMIN);
                else window.alert('Authorization failed.');
              }}
              className="w-full bg-black text-white p-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-blue-600 transition-all active:scale-95"
            >
              Authenticate
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f8f9] text-black font-sans pb-24 md:pb-0">
      <audio ref={audioRef} src={customAlertBase64 || undefined} />

      {/* TOP NOTIFICATION BAR (Mobile & Desktop) */}
      {recentOrderAlert && (
        <div className="fixed top-0 left-0 right-0 z-[100] p-4 animate-slideInTop">
          <div className="bg-black text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between border border-white/10 max-w-2xl mx-auto ring-4 ring-blue-600/20">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center animate-bounce">
                <i className="fas fa-shopping-bag text-xs"></i>
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-black uppercase tracking-widest opacity-50 italic">New Incoming Order</p>
                <p className="font-bold text-xs truncate">#{recentOrderAlert.order_id || recentOrderAlert.id} — {recentOrderAlert.customer_name}</p>
              </div>
            </div>
            <button onClick={() => setRecentOrderAlert(null)} className="ml-4 w-8 h-8 rounded-lg hover:bg-white/10 transition"><i className="fas fa-times text-xs"></i></button>
          </div>
        </div>
      )}

      {/* DESKTOP HEADER */}
      <header className="hidden md:flex sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b h-20 items-center justify-between px-10">
        <div className="flex items-center space-x-12">
          <h2 className="text-sm font-black italic tracking-tighter uppercase">ITX MASTER</h2>
          <nav className="flex space-x-8 text-[11px] font-black uppercase tracking-widest">
            <button onClick={() => setActiveTab('overview')} className={activeTab === 'overview' ? 'text-blue-600 border-b-2 border-blue-600 pb-1' : 'text-gray-400'}>Analytics</button>
            <button onClick={() => setActiveTab('orders')} className={activeTab === 'orders' ? 'text-blue-600 border-b-2 border-blue-600 pb-1' : 'text-gray-400'}>Orders Feed</button>
            <button onClick={() => setActiveTab('inventory')} className={activeTab === 'inventory' ? 'text-blue-600 border-b-2 border-blue-600 pb-1' : 'text-gray-400'}>Inventory</button>
            <button onClick={() => setActiveTab('sys')} className={activeTab === 'sys' ? 'text-blue-600 border-b-2 border-blue-600 pb-1' : 'text-gray-400'}>Config</button>
          </nav>
        </div>
        <div className="flex items-center space-x-4">
          <button onClick={() => setMuted(!muted)} className={`w-10 h-10 rounded-xl border flex items-center justify-center transition shadow-sm ${muted ? 'bg-red-50 text-red-500 border-red-100' : 'text-gray-300'}`}>
            <i className={`fas ${muted ? 'fa-bell-slash' : 'fa-bell'} text-xs`}></i>
          </button>
          <button onClick={props.refreshData} className="bg-black text-white px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-blue-600 transition">
            <i className="fas fa-sync-alt mr-2"></i> Cloud Sync
          </button>
        </div>
      </header>

      {/* MOBILE HEADER */}
      <header className="md:hidden flex h-16 items-center justify-between px-6 bg-white border-b sticky top-0 z-40">
        <h2 className="text-xs font-black italic uppercase">ITX MASTER</h2>
        <div className="flex items-center space-x-2">
          <button onClick={() => setMuted(!muted)} className={`w-8 h-8 rounded-lg flex items-center justify-center ${muted ? 'text-red-500' : 'text-gray-300'}`}>
            <i className={`fas ${muted ? 'fa-bell-slash' : 'fa-bell'} text-xs`}></i>
          </button>
          <button onClick={props.refreshData} className="text-blue-600 p-2"><i className="fas fa-sync-alt text-xs"></i></button>
        </div>
      </header>

      <main className="p-4 md:p-10 max-w-7xl mx-auto space-y-8 md:space-y-10">
        {activeTab === 'overview' && (
          <div className="animate-fadeIn space-y-8">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
              <h3 className="font-black text-[10px] md:text-xs uppercase tracking-widest text-gray-400 italic">Financial Summary</h3>
              <div className="flex bg-gray-200 p-1 rounded-xl w-fit self-start md:self-auto">
                {['7days', '30days', '6months'].map(r => (
                  <button key={r} onClick={() => setTimeRange(r)} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition ${timeRange === r ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400'}`}>
                    {r.replace('days', 'd').replace('months', 'm')}
                  </button>
                ))}
              </div>
            </div>

            {/* QUICK STATS - Bento Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-8">
              {[
                { label: 'Revenue', val: `Rs. ${analytics.revenue.toLocaleString()}`, color: 'text-black', icon: 'fa-wallet' },
                { label: 'Total Orders', val: analytics.total, color: 'text-black', icon: 'fa-shopping-cart' },
                { label: 'Pending', val: analytics.pendingCount, color: 'text-blue-600', icon: 'fa-clock' },
                { label: 'Success Rate', val: `${analytics.total ? Math.round((analytics.deliveredCount / analytics.total) * 100) : 0}%`, color: 'text-gray-400', icon: 'fa-chart-pie' }
              ].map((s, i) => (
                <div key={i} className="bg-white border border-gray-100 p-5 md:p-8 rounded-[1.5rem] md:rounded-[2.5rem] shadow-sm relative overflow-hidden group">
                  <p className="text-[8px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 md:mb-3">{s.label}</p>
                  <p className={`text-xl md:text-3xl font-black tracking-tighter italic ${s.color}`}>{s.val}</p>
                  <i className={`fas ${s.icon} absolute -bottom-2 -right-2 text-4xl opacity-[0.03] group-hover:scale-110 transition-transform`}></i>
                </div>
              ))}
            </div>

            {/* PERFORMANCE TREND */}
            <div className="bg-white border border-gray-100 p-6 md:p-10 rounded-[2rem] md:rounded-[3.5rem] shadow-sm">
              <h4 className="text-[10px] font-black uppercase tracking-widest mb-8 text-zinc-400">Monthly Revenue Stream</h4>
              <div className="h-48 md:h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analytics.chartData}>
                    <defs>
                      <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.12}/>
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f1f1" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 900, fill: '#9ca3af'}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 900, fill: '#9ca3af'}} tickFormatter={v => v >= 1000 ? (v/1000).toFixed(0)+'K' : v} />
                    <Tooltip contentStyle={{borderRadius: '1.2rem', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)'}} />
                    <Area type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={4} fillOpacity={1} fill="url(#colorRev)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="animate-fadeIn space-y-4 md:space-y-6">
            <div className="flex justify-between items-center px-2">
              <h3 className="font-black text-[10px] md:text-xs uppercase tracking-widest text-gray-400 italic">Live Inbound Stream</h3>
              <p className="text-[9px] font-black text-gray-300 uppercase">{props.orders.length} Entries</p>
            </div>
            {props.orders.length === 0 ? (
              <div className="bg-white p-20 rounded-[3rem] border border-dashed border-gray-200 text-center">
                <p className="text-[10px] font-black uppercase text-gray-300">No transactions recorded yet.</p>
              </div>
            ) : (
              props.orders.map((o: Order) => (
                <div key={o.id} onClick={() => setSelectedOrder(o)} className="bg-white border border-gray-100 p-5 md:p-8 rounded-[1.8rem] md:rounded-[2.8rem] flex flex-col gap-4 md:flex-row md:justify-between md:items-center shadow-sm hover:shadow-lg transition-all cursor-pointer group">
                  <div className="flex items-center space-x-4 md:space-x-7 min-w-0">
                    <div className={`w-14 h-14 md:w-16 md:h-16 rounded-[1.2rem] md:rounded-2xl flex items-center justify-center font-black text-sm md:text-lg border-2 transition-all ${o.status === 'Delivered' ? 'bg-green-50 text-green-500 border-green-100' : 'bg-gray-50 border-gray-50 text-gray-400 group-hover:bg-blue-600 group-hover:text-white'}`}>
                      {String(o.status).charAt(0)}
                    </div>
                    <div className="min-w-0 flex-grow">
                      <div className="flex items-center gap-2">
                        <p className="font-black text-sm md:text-xl tracking-tighter">#{o.id}</p>
                        <span className={`text-[8px] md:text-[9px] font-black px-2 py-0.5 rounded-lg uppercase tracking-widest border ${o.status === 'Pending' ? 'border-amber-200 text-amber-600 bg-amber-50 animate-pulse' : 'border-gray-100 text-gray-400 bg-gray-50'}`}>
                          {o.status}
                        </span>
                      </div>
                      <p className="text-[10px] md:text-[12px] font-bold text-gray-400 uppercase mt-1 tracking-wide truncate">{o.customer.name} • {o.customer.city}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between md:justify-end md:space-x-12 border-t md:border-t-0 pt-4 md:pt-0">
                    <div className="md:text-right">
                      <p className="hidden md:block text-[9px] font-black text-gray-300 uppercase mb-1 italic">Settlement</p>
                      <p className="text-base md:text-2xl font-black italic">Rs. {o.total.toLocaleString()}</p>
                    </div>
                    <select 
                      value={o.status} 
                      onClick={(e) => e.stopPropagation()}
                      onChange={e => props.updateStatusOverride?.(o.id, e.target.value as any)}
                      className="border-2 p-2.5 md:p-4 rounded-xl md:rounded-2xl text-[9px] md:text-[11px] font-black uppercase bg-gray-50 outline-none focus:border-blue-600 transition shadow-sm min-w-[120px] md:min-w-[180px]"
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
          <div className="animate-fadeIn space-y-6">
            <div className="flex justify-between items-center px-2">
              <h3 className="font-black text-[10px] md:text-xs uppercase tracking-widest text-gray-400 italic">Inventory Controller</h3>
              <button 
                onClick={() => setIsAddProductOpen(true)}
                className="bg-black text-white px-6 md:px-10 py-3 md:py-4 rounded-xl md:rounded-3xl text-[9px] md:text-[11px] font-black uppercase tracking-widest shadow-xl active:scale-95 transition"
              >
                + New Product
              </button>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-8">
              {props.products.map((itm: Product) => (
                <div key={itm.id} className="bg-white border border-gray-100 p-4 rounded-[1.8rem] md:rounded-[3rem] group relative shadow-sm hover:shadow-xl transition-all">
                  <div className="aspect-square relative mb-4 overflow-hidden rounded-[1.2rem] md:rounded-[2rem]">
                    <img src={itm.image} className="w-full h-full object-cover group-hover:scale-110 transition duration-500" alt="" />
                    <button onClick={(e) => { e.stopPropagation(); if(confirm('Delete permanently?')) props.deleteProduct(itm.id); }} className="absolute top-3 right-3 bg-red-600 text-white w-8 h-8 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-xl">
                      <i className="fas fa-trash-alt text-[10px]"></i>
                    </button>
                  </div>
                  <p className="text-[7px] md:text-[9px] font-black text-blue-600 uppercase tracking-widest mb-1 italic">{itm.category}</p>
                  <p className="text-[11px] md:text-[14px] font-black truncate uppercase tracking-tight text-zinc-800">{itm.name}</p>
                  <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-50">
                    <span className="text-[11px] md:text-[14px] font-black italic">Rs. {itm.price.toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'sys' && (
          <div className="max-w-2xl bg-white border border-gray-100 p-6 md:p-12 rounded-[2rem] md:rounded-[4rem] shadow-sm animate-fadeIn space-y-10 mx-auto">
            <div>
              <p className="text-[9px] md:text-[11px] font-black text-gray-400 mb-6 md:mb-8 uppercase tracking-widest italic">PWA Alert Hub</p>
              <div className="bg-gray-50 p-6 md:p-10 rounded-[1.8rem] md:rounded-[2.5rem] border border-gray-100 shadow-inner space-y-8">
                <div>
                  <label className="block text-[8px] md:text-[10px] font-black uppercase text-gray-400 mb-4 tracking-widest italic">Order Notification Sound</label>
                  <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                    <input type="file" accept="audio/*" onChange={handleSoundUpload} className="hidden" id="sound-upload" />
                    <label htmlFor="sound-upload" className="cursor-pointer bg-white border border-gray-100 px-6 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest hover:border-black transition shadow-sm">
                      {customAlertBase64 ? 'Update Sound' : 'Upload File'}
                    </label>
                    <div className="flex gap-2">
                      <button onClick={() => triggerOrderAlert({ order_id: 'TEST', customer_name: 'Test System', total: 0 })} className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-lg active:scale-90 transition"><i className="fas fa-play text-xs"></i></button>
                      {customAlertBase64 && (
                        <button onClick={() => { localStorage.removeItem('itx_custom_alert'); setCustomAlertBase64(null); }} className="w-10 h-10 rounded-xl bg-red-50 text-red-500 border border-red-100 flex items-center justify-center"><i className="fas fa-trash text-xs"></i></button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="pt-6 border-t border-gray-200">
                  <button onClick={() => Notification.requestPermission()} className="bg-black text-white px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-blue-600 transition">Request Device Access</button>
                </div>
              </div>
            </div>

            <div className="pt-8 border-t border-gray-100">
              <p className="text-[9px] md:text-[11px] font-black text-gray-400 mb-6 md:mb-8 uppercase tracking-widest italic">Security Management</p>
              <div className="flex gap-3">
                <input 
                  value={props.systemPassword} 
                  onChange={e => props.setSystemPassword(e.target.value)} 
                  className="border border-gray-100 p-4 rounded-xl md:rounded-2xl w-full text-xs font-bold bg-gray-50 outline-none focus:border-blue-500 shadow-inner" 
                  placeholder="Master Passkey"
                />
                <button onClick={() => { localStorage.setItem('systemPassword', props.systemPassword); window.alert('Security Hash Updated.'); }} className="bg-black text-white px-8 rounded-xl text-[9px] font-black uppercase tracking-widest active:scale-95 transition shadow-lg">Update</button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MOBILE BOTTOM NAVIGATION */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-gray-100 h-20 flex items-center justify-around px-4 z-[80] shadow-[0_-10px_25px_-5px_rgba(0,0,0,0.05)]">
        {[
          { id: 'overview', icon: 'fa-chart-line', label: 'Home' },
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

      {/* MODAL OVERLAYS */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[90] flex items-center justify-center p-0 md:p-6 animate-fadeIn">
          <div className="bg-white p-6 md:p-12 w-full h-full md:h-auto md:max-w-2xl md:rounded-[4rem] shadow-2xl relative overflow-y-auto">
            <button onClick={() => setSelectedOrder(null)} className="absolute top-6 right-6 md:top-10 md:right-10 text-gray-400 hover:text-black text-xl md:text-2xl transition"><i className="fas fa-times"></i></button>
            <div className="flex items-center space-x-5 mb-8 md:mb-12">
              <span className="text-xl md:text-3xl font-black italic tracking-tighter uppercase">Record View</span>
              <span className="px-4 py-1.5 bg-blue-600 text-white text-[8px] md:text-[10px] font-black rounded-full uppercase tracking-widest shadow-lg shadow-blue-200">#{selectedOrder.id}</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 mb-8 md:mb-12">
              <div className="space-y-6">
                <h4 className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-gray-300 border-b pb-2 italic">Client Profile</h4>
                <div>
                  <p className="text-[8px] md:text-[9px] font-black uppercase text-gray-400 mb-1 tracking-widest">Full Name</p>
                  <p className="font-bold text-base md:text-lg tracking-tight">{selectedOrder.customer.name}</p>
                </div>
                <div>
                  <p className="text-[8px] md:text-[9px] font-black uppercase text-gray-400 mb-1 tracking-widest">Verified Phone</p>
                  <p className="font-black text-base md:text-lg text-blue-600 italic underline decoration-blue-100 underline-offset-4">{selectedOrder.customer.phone}</p>
                </div>
                <div>
                  <p className="text-[8px] md:text-[9px] font-black uppercase text-gray-400 mb-1 tracking-widest">Destination</p>
                  <p className="font-bold text-xs md:text-sm leading-relaxed text-gray-600 italic">{selectedOrder.customer.address}, {selectedOrder.customer.city}</p>
                </div>
              </div>
              <div className="bg-zinc-50 p-6 rounded-[2rem] md:rounded-[3rem] border border-zinc-100 shadow-inner">
                <h4 className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-zinc-400 border-b border-zinc-200 pb-2 mb-6">Manifest</h4>
                <div className="space-y-4">
                  {selectedOrder.items.map((itm, i) => (
                    <div key={i} className="flex items-center space-x-4">
                      <div className="w-12 h-12 rounded-xl overflow-hidden border bg-white shadow-sm">
                        <img src={itm.product.image} className="w-full h-full object-cover" />
                      </div>
                      <div className="min-w-0 flex-grow">
                        <p className="text-[11px] md:text-[12px] font-black uppercase tracking-tight text-zinc-800 truncate">{itm.product.name}</p>
                        <p className="text-[9px] md:text-[10px] font-bold text-zinc-400 mt-1">Qty: {itm.quantity} • Rs. {itm.product.price.toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="flex flex-col md:flex-row justify-between items-center pt-8 border-t border-gray-100 gap-8">
              <div className="flex items-center space-x-4 w-full md:w-auto">
                <a href={`tel:${selectedOrder.customer.phone}`} className="bg-green-500 text-white w-12 h-12 rounded-2xl flex items-center justify-center hover:bg-green-600 transition-all shadow-xl shadow-green-100 flex-shrink-0 active:scale-90"><i className="fas fa-phone"></i></a>
                <p className="text-[10px] font-black uppercase tracking-widest italic text-zinc-400">Direct Contact Hub</p>
              </div>
              <div className="text-right w-full md:w-auto">
                <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-1 italic">Settlement Total</p>
                <p className="text-3xl md:text-4xl font-black italic tracking-tighter text-blue-600">Rs. {selectedOrder.total.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {isAddProductOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[200] flex items-center justify-center p-0 md:p-6 animate-fadeIn">
          <div className="bg-white p-6 md:p-12 w-full h-full md:h-auto md:max-w-md md:rounded-[4.5rem] shadow-2xl relative overflow-y-auto">
            <button onClick={() => setIsAddProductOpen(false)} className="absolute top-6 right-6 md:top-10 md:right-10 text-gray-400 hover:text-black text-xl transition"><i className="fas fa-times"></i></button>
            <h3 className="text-2xl md:text-3xl font-black italic tracking-tighter uppercase mb-8">Stock Entry</h3>
            <div className="space-y-4 md:space-y-6">
              <input className="w-full border-2 border-zinc-50 p-4 md:p-5 rounded-2xl text-[11px] md:text-xs font-bold bg-zinc-50 focus:border-blue-500 outline-none transition-all shadow-inner" placeholder="Item Name" />
              <div className="grid grid-cols-2 gap-3 md:gap-4">
                <input className="w-full border-2 border-zinc-50 p-4 md:p-5 rounded-2xl text-[11px] md:text-xs font-bold bg-zinc-50 focus:border-blue-500 outline-none transition-all shadow-inner" placeholder="Price (PKR)" type="number" />
                <input className="w-full border-2 border-zinc-50 p-4 md:p-5 rounded-2xl text-[11px] md:text-xs font-bold bg-zinc-50 focus:border-blue-500 outline-none transition-all shadow-inner" placeholder="Variants" />
              </div>
              <input className="w-full border-2 border-zinc-50 p-4 md:p-5 rounded-2xl text-[11px] md:text-xs font-bold bg-zinc-50 focus:border-blue-500 outline-none transition-all shadow-inner" placeholder="Cover Image URL" />
              <textarea className="w-full border-2 border-zinc-50 p-4 md:p-5 rounded-2xl text-[11px] md:text-xs font-bold bg-zinc-50 focus:border-blue-500 outline-none h-24 md:h-28 resize-none transition-all shadow-inner" placeholder="Specifications" />
              <button className="w-full bg-black text-white p-5 md:p-6 rounded-2xl md:rounded-[2.5rem] font-black text-xs uppercase tracking-widest mt-6 md:mt-8 shadow-2xl active:scale-95 transition-all">Publish Live Collection</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
