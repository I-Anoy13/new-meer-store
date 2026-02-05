import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  LineChart, 
  Line, 
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
 * ITX MASTER CONSOLE - ANALYTICS & OPERATIONS SUITE
 * Features: Recharts Sales Trends, Custom Alerts, Shopify-style Performance Dash.
 */

const AdminDashboard = (props: any) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [authKey, setAuthKey] = useState('');
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [timeRange, setTimeRange] = useState('6months'); // '7days' | '30days' | '6months'

  // Instant Notification & Custom Sound State
  const [recentOrderAlert, setRecentOrderAlert] = useState<any>(null);
  const [muted, setMuted] = useState(false);
  const [customAlertBase64, setCustomAlertBase64] = useState<string | null>(() => localStorage.getItem('itx_custom_alert'));
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Form State
  const [pName, setPName] = useState('');
  const [pPrice, setPPrice] = useState(0);
  const [pImage, setPImage] = useState('');
  const [pDesc, setPDesc] = useState('');
  const [pCat, setPCat] = useState('Luxury');
  const [pVariants, setPVariants] = useState<string>('');

  // Number Formatter (100k, 1m)
  const formatCompact = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return num.toString();
  };

  // Analytics Engine
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

    // Monthly Chart Data (Last 6 Months)
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const chartData = [];
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
        orders: mOrders.length
      });
    }

    return { revenue, pendingCount, deliveredCount, total: filteredOrders.length, chartData };
  }, [props.orders, timeRange]);

  const triggerAudioAlert = useCallback(() => {
    if (muted) return;
    if (customAlertBase64) {
      if (audioRef.current) audioRef.current.play().catch(e => console.error(e));
    } else {
      try {
        const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1046.5, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + 0.4);
      } catch (err) { console.error(err); }
    }
  }, [muted, customAlertBase64]);

  const handleSoundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const b64 = event.target?.result as string;
      setCustomAlertBase64(b64);
      localStorage.setItem('itx_custom_alert', b64);
      window.alert('Notification sound updated.');
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (!props.user) return;
    const channel = supabase.channel('order_sync_v2');
    channel.on('postgres_changes', 
      { event: 'INSERT', schema: 'public', table: 'orders' }, 
      (payload) => {
        const order = payload.new;
        props.refreshData(); 
        setRecentOrderAlert(order);
        triggerAudioAlert();
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('NEW ORDER', {
            body: `Rs. ${order.total_pkr || order.total} from ${order.customer_name}`,
            icon: 'https://images.unsplash.com/photo-1614164185128-e4ec99c436d7?w=128'
          });
        }
        setTimeout(() => setRecentOrderAlert(null), 12000);
      }
    ).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [props.user, props.refreshData, triggerAudioAlert]);

  if (!props.user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6">
        <div className="bg-white p-12 rounded-[3rem] shadow-2xl w-full max-w-sm border border-white/10">
          <div className="text-center mb-10">
            <h1 className="text-2xl font-black uppercase tracking-tighter text-black italic">ITX CONSOLE</h1>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-2 italic">Secured Login</p>
          </div>
          <div className="space-y-6">
            <input 
              type="password" value={authKey}
              onChange={(e) => setAuthKey(e.target.value)}
              placeholder="Authorization Key"
              className="w-full p-5 border-2 border-gray-100 rounded-3xl font-black text-center bg-gray-50 outline-none focus:border-blue-600 transition-all"
            />
            <button 
              onClick={() => {
                if (authKey === props.systemPassword) props.login(UserRole.ADMIN);
                else window.alert('Access Denied');
              }}
              className="w-full bg-black text-white p-5 rounded-3xl font-black uppercase text-xs tracking-[0.2em] shadow-xl hover:bg-blue-600 transition-all active:scale-95"
            >
              Verify
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fcfcfd] text-black font-sans selection:bg-blue-100">
      <audio ref={audioRef} src={customAlertBase64 || undefined} />

      {/* FLOATING ALERT */}
      {recentOrderAlert && (
        <div className="fixed top-0 left-0 right-0 z-[100] animate-slideInTop">
          <div className="bg-black text-white p-6 shadow-2xl flex items-center justify-between mx-auto max-w-4xl md:mt-4 md:rounded-[2.5rem] border border-white/10">
            <div className="flex items-center space-x-6">
              <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center animate-bounce">
                <i className="fas fa-shopping-bag text-white"></i>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest opacity-50 italic">New Order Detected</p>
                <p className="font-bold text-sm">#{recentOrderAlert.order_id} — {recentOrderAlert.customer_name}</p>
              </div>
            </div>
            <div className="flex items-center space-x-8">
              <div className="text-right">
                <p className="text-[9px] font-black uppercase opacity-40">Total</p>
                <p className="font-black text-blue-400">Rs. {recentOrderAlert.total_pkr || recentOrderAlert.total}</p>
              </div>
              <button onClick={() => setRecentOrderAlert(null)} className="w-10 h-10 rounded-full hover:bg-white/10 transition"><i className="fas fa-times"></i></button>
            </div>
          </div>
          <div className="h-1 bg-blue-600 w-full md:max-w-4xl md:mx-auto md:rounded-full overflow-hidden mt-1">
            <div className="h-full bg-white/40 animate-progress"></div>
          </div>
        </div>
      )}

      <header className="border-b h-20 flex items-center px-10 justify-between bg-white/90 backdrop-blur-2xl sticky top-0 z-40">
        <div className="flex items-center space-x-12">
          <h2 className="text-sm font-black italic tracking-tighter uppercase border-r pr-8 border-gray-100">ITX MASTER</h2>
          <nav className="flex space-x-8 text-[11px] font-black uppercase tracking-widest">
            <button onClick={() => setActiveTab('overview')} className={activeTab === 'overview' ? 'text-blue-600 border-b-2 border-blue-600 pb-1' : 'text-gray-400 hover:text-black transition'}>Performance</button>
            <button onClick={() => setActiveTab('orders')} className={activeTab === 'orders' ? 'text-blue-600 border-b-2 border-blue-600 pb-1' : 'text-gray-400 hover:text-black transition'}>Order Stream</button>
            <button onClick={() => setActiveTab('inventory')} className={activeTab === 'inventory' ? 'text-blue-600 border-b-2 border-blue-600 pb-1' : 'text-gray-400 hover:text-black transition'}>Inventory</button>
            <button onClick={() => setActiveTab('sys')} className={activeTab === 'sys' ? 'text-blue-600 border-b-2 border-blue-600 pb-1' : 'text-gray-400 hover:text-black transition'}>Control</button>
          </nav>
        </div>
        
        <div className="flex items-center space-x-6">
          <button onClick={() => setMuted(!muted)} className={`w-10 h-10 rounded-2xl border flex items-center justify-center transition-all ${muted ? 'bg-red-50 text-red-500 border-red-100' : 'text-gray-300 hover:border-black hover:text-black'}`}>
            <i className={muted ? 'fas fa-bell-slash text-xs' : 'fas fa-bell text-xs'}></i>
          </button>
          <button onClick={props.refreshData} className="bg-gray-50 text-[10px] font-black uppercase tracking-widest px-6 py-2.5 rounded-2xl border border-gray-200 hover:bg-white transition flex items-center shadow-sm">
            <i className="fas fa-sync-alt mr-2 text-blue-600"></i> Sync Cloud
          </button>
        </div>
      </header>

      <main className="container mx-auto p-10 max-w-7xl">
        {activeTab === 'overview' && (
          <div className="animate-fadeIn space-y-10">
            {/* PERFORMANCE HEADER */}
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-black text-xs uppercase tracking-widest text-gray-400">Shopify-style Analytics</h3>
              <div className="flex bg-gray-100 p-1 rounded-2xl space-x-1 border">
                {['7days', '30days', '6months'].map(r => (
                  <button 
                    key={r}
                    onClick={() => setTimeRange(r)}
                    className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition ${timeRange === r ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400'}`}
                  >
                    {r.replace('days', ' Days').replace('months', ' Months')}
                  </button>
                ))}
              </div>
            </div>

            {/* KEY STATS */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              {[
                { label: 'Net Revenue', val: `Rs. ${formatCompact(analytics.revenue)}`, color: 'text-black' },
                { label: 'Orders', val: formatCompact(analytics.total), color: 'text-black' },
                { label: 'Pending Queue', val: analytics.pendingCount, color: 'text-blue-600' },
                { label: 'Conversion', val: `${analytics.total ? Math.round((analytics.deliveredCount / analytics.total) * 100) : 0}%`, color: 'text-gray-400' }
              ].map((s, i) => (
                <div key={i} className="bg-white border p-8 rounded-[2.5rem] shadow-sm hover:shadow-md transition group">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 group-hover:text-blue-600 transition">{s.label}</p>
                  <p className={`text-4xl font-black tracking-tighter italic ${s.color}`}>{s.val}</p>
                </div>
              ))}
            </div>

            {/* SALES CHART */}
            <div className="bg-white border p-10 rounded-[3.5rem] shadow-sm">
              <div className="flex justify-between items-center mb-10">
                <div>
                  <h3 className="font-black text-xs uppercase tracking-widest text-black">Monthly Sales Trends</h3>
                  <p className="text-[10px] font-bold text-gray-400 uppercase mt-1">Order Volume vs Revenue</p>
                </div>
                <div className="flex items-center space-x-6 text-[10px] font-black uppercase tracking-widest">
                   <span className="flex items-center"><span className="w-3 h-3 bg-blue-600 rounded-full mr-2"></span> Revenue</span>
                   <span className="flex items-center"><span className="w-3 h-3 bg-gray-300 rounded-full mr-2"></span> Orders</span>
                </div>
              </div>
              
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analytics.chartData}>
                    <defs>
                      <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f1f1" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fontSize: 10, fontWeight: 900, fill: '#9ca3af'}} 
                      dy={15}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fontSize: 10, fontWeight: 900, fill: '#9ca3af'}} 
                      tickFormatter={(v) => formatCompact(v)}
                    />
                    <Tooltip 
                      contentStyle={{borderRadius: '1.5rem', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '1.5rem'}}
                      itemStyle={{fontSize: '10px', fontWeight: 900, textTransform: 'uppercase'}}
                      labelStyle={{fontSize: '12px', fontWeight: 900, marginBottom: '0.5rem'}}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={4} fillOpacity={1} fill="url(#colorRev)" dot={{ r: 4, fill: '#2563eb', strokeWidth: 2, stroke: '#fff' }} />
                    <Line type="monotone" dataKey="orders" stroke="#e5e7eb" strokeWidth={2} dot={{ r: 3, fill: '#e5e7eb' }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* RECENT FEED */}
            <div className="bg-white border p-10 rounded-[3.5rem] shadow-sm">
              <div className="flex justify-between items-center mb-8">
                <h3 className="font-black text-xs uppercase tracking-widest text-gray-400">Live Activity Feed</h3>
                <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest animate-pulse">Syncing...</span>
              </div>
              <div className="space-y-6">
                {props.orders.slice(0, 6).map((o: Order) => (
                  <div key={o.id} className="flex items-center justify-between py-5 border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition px-4 -mx-4 rounded-2xl group">
                    <div className="flex items-center space-x-5">
                      <div className={`w-3 h-3 rounded-full ${o.status === 'Pending' ? 'bg-amber-400 animate-pulse' : 'bg-green-400'}`}></div>
                      <p className="text-sm font-bold uppercase tracking-tight group-hover:text-blue-600 transition">#{o.id} — {o.customer.name}</p>
                    </div>
                    <div className="flex items-center space-x-8">
                       <span className="text-[11px] font-black text-black">Rs. {o.total.toLocaleString()}</span>
                       <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest italic">{new Date(o.date).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="space-y-6 animate-fadeIn">
             <div className="flex justify-between items-center px-4 mb-2">
               <h3 className="font-black text-xs uppercase tracking-widest text-gray-400">Detailed Transaction Log</h3>
               <p className="text-[10px] font-black uppercase text-gray-300">Total Records: {props.orders.length}</p>
             </div>
            {props.orders.map((o: Order) => (
              <div key={o.id} onClick={() => setSelectedOrder(o)} className="bg-white border p-8 rounded-[2.8rem] flex flex-col md:flex-row justify-between items-start md:items-center gap-8 shadow-sm hover:shadow-xl transition-all cursor-pointer group">
                <div className="flex items-center space-x-6">
                  <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center font-black text-lg border-2 border-transparent group-hover:bg-blue-600 group-hover:text-white transition-all duration-300">
                    {String(o.status).charAt(0)}
                  </div>
                  <div>
                    <p className="font-black text-lg tracking-tighter">#{o.id}</p>
                    <p className="text-[11px] font-bold text-gray-400 uppercase mt-1 tracking-widest">{o.customer.name} — {o.customer.city}</p>
                    <div className="flex items-center mt-3 space-x-4">
                       <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100 uppercase italic tracking-widest">{o.customer.phone}</span>
                       <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{new Date(o.date).toLocaleTimeString()}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-12 w-full md:w-auto border-t md:border-t-0 pt-6 md:pt-0">
                  <div className="text-right">
                    <p className="text-[10px] font-black text-gray-300 uppercase mb-1">Total PKR</p>
                    <p className="text-2xl font-black italic tracking-tighter">Rs. {o.total.toLocaleString()}</p>
                  </div>
                  <select 
                    value={o.status} 
                    onClick={(e) => e.stopPropagation()}
                    onChange={e => props.updateStatusOverride?.(o.id, e.target.value as any)}
                    className="border-2 p-4 rounded-2xl text-[11px] font-black uppercase bg-gray-50 outline-none focus:border-blue-600 transition shadow-sm min-w-[160px]"
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
          <div className="animate-fadeIn">
            <div className="flex justify-between items-center mb-12">
              <h3 className="font-black text-xs uppercase tracking-widest text-gray-400 italic">Inventory Manager</h3>
              <button 
                onClick={() => setIsAddProductOpen(true)}
                className="bg-black text-white px-10 py-4.5 rounded-3xl text-[11px] font-black uppercase tracking-widest shadow-2xl hover:bg-blue-600 transition-all active:scale-95"
              >
                + New Product Entry
              </button>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
              {props.products.map((itm: Product) => (
                <div key={itm.id} className="bg-white border-2 border-gray-100 p-6 rounded-[3.5rem] group relative shadow-sm hover:shadow-2xl transition-all duration-500">
                  <div className="aspect-square relative mb-6 overflow-hidden rounded-[2.5rem]">
                    <img src={itm.image} className="w-full h-full object-cover group-hover:scale-110 transition duration-1000" alt="" />
                    <button onClick={(e) => { e.stopPropagation(); props.deleteProduct(itm.id); }} className="absolute top-4 right-4 bg-red-600 text-white w-10 h-10 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-xl hover:rotate-12">
                      <i className="fas fa-trash-alt text-xs"></i>
                    </button>
                  </div>
                  <div className="px-2">
                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1.5 italic">{itm.category}</p>
                    <p className="text-[14px] font-black truncate uppercase tracking-tight mb-2 text-zinc-800">{itm.name}</p>
                    <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-50">
                      <span className="text-[14px] font-black">Rs. {itm.price.toLocaleString()}</span>
                      <span className="text-[10px] font-bold text-gray-300 uppercase">Qty: {itm.inventory || 10}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'sys' && (
          <div className="max-w-2xl bg-white border p-12 rounded-[4rem] shadow-sm animate-fadeIn space-y-12">
            <div>
              <p className="text-[11px] font-black text-gray-400 mb-8 uppercase tracking-widest italic">Global Notification Controller</p>
              <div className="bg-gray-50 p-10 rounded-[2.5rem] border border-gray-100 shadow-inner">
                <label className="block text-[10px] font-black uppercase text-gray-400 mb-4 tracking-[0.2em] italic">Alert Sound Frequency (.mp3/.wav)</label>
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                  <input type="file" accept="audio/*" onChange={handleSoundUpload} className="hidden" id="sound-upload" />
                  <label htmlFor="sound-upload" className="cursor-pointer bg-white border-2 border-gray-100 px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:border-black transition-all shadow-sm">
                    {customAlertBase64 ? 'Replace Sound Library' : 'Upload Audio Trigger'}
                  </label>
                  {customAlertBase64 && (
                    <div className="flex gap-3">
                      <button onClick={triggerAudioAlert} className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-200"><i className="fas fa-play"></i></button>
                      <button onClick={() => { localStorage.removeItem('itx_custom_alert'); setCustomAlertBase64(null); }} className="w-12 h-12 rounded-2xl bg-red-50 text-red-500 border border-red-100 flex items-center justify-center"><i className="fas fa-trash"></i></button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-6">
              <p className="text-[11px] font-black text-gray-400 mb-8 uppercase tracking-widest italic">Console Security</p>
              <div className="flex gap-4">
                <input 
                  value={props.systemPassword} 
                  onChange={e => props.setSystemPassword(e.target.value)} 
                  className="border-2 border-gray-100 p-5 rounded-2xl w-full text-sm font-bold bg-gray-50 outline-none focus:border-blue-500 transition shadow-inner" 
                  placeholder="Update Passkey"
                />
                <button onClick={() => { localStorage.setItem('systemPassword', props.systemPassword); window.alert('Security Protocol Updated'); }} className="bg-black text-white px-10 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl">Apply</button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* DETAILED ORDER OVERLAY */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[60] flex items-center justify-center p-6 animate-fadeIn">
          <div className="bg-white p-12 rounded-[4rem] w-full max-w-2xl shadow-2xl relative overflow-y-auto max-h-[90vh] border border-white/20">
            <button onClick={() => setSelectedOrder(null)} className="absolute top-10 right-10 text-gray-300 hover:text-black text-2xl transition"><i className="fas fa-times"></i></button>
            <div className="flex items-center space-x-6 mb-12">
              <span className="text-3xl font-black italic tracking-tighter uppercase text-zinc-800">Order Record</span>
              <span className="px-6 py-2 bg-blue-600 text-white text-[10px] font-black rounded-full uppercase tracking-widest shadow-lg shadow-blue-200">#{selectedOrder.id}</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-12">
              <div className="space-y-8">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-300 border-b pb-3 italic">Customer Identity</h4>
                <div>
                  <p className="text-[10px] font-black uppercase text-gray-400 mb-2">Full Legal Name</p>
                  <p className="font-bold text-lg tracking-tight text-zinc-800">{selectedOrder.customer.name}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-gray-400 mb-2">Verified Contact</p>
                  <p className="font-black text-lg text-blue-600 italic">{selectedOrder.customer.phone}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-gray-400 mb-2">Logistics Destination</p>
                  <p className="font-bold text-sm leading-relaxed text-gray-600 italic">{selectedOrder.customer.address}, {selectedOrder.customer.city}</p>
                </div>
              </div>
              <div className="bg-zinc-50 p-10 rounded-[3rem] border border-zinc-100 shadow-inner">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 border-b border-zinc-200 pb-3 mb-8">Order Contents</h4>
                <div className="space-y-6">
                  {selectedOrder.items.map((itm, i) => (
                    <div key={i} className="flex items-center space-x-5">
                      <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-white shadow-md">
                        <img src={itm.product.image} className="w-full h-full object-cover" />
                      </div>
                      <div>
                        <p className="text-[12px] font-black uppercase tracking-tight text-zinc-800">{itm.product.name}</p>
                        <p className="text-[10px] font-bold text-zinc-400 mt-1">Qty: {itm.quantity} — Rs. {itm.product.price.toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="flex justify-between items-center pt-10 border-t border-gray-100">
              <div className="flex items-center space-x-4">
                <a href={`tel:${selectedOrder.customer.phone}`} className="bg-green-500 text-white w-14 h-14 rounded-3xl flex items-center justify-center hover:bg-green-600 transition-all shadow-xl shadow-green-100"><i className="fas fa-phone"></i></a>
                <p className="text-[11px] font-black uppercase tracking-widest italic text-zinc-400">Direct Connect</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-black text-gray-300 uppercase tracking-widest mb-1">Total COD Value</p>
                <p className="text-4xl font-black italic tracking-tighter text-blue-600">Rs. {selectedOrder.total.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD PRODUCT MODAL */}
      {isAddProductOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[200] flex items-center justify-center p-6 animate-fadeIn">
          <div className="bg-white p-12 rounded-[4.5rem] w-full max-w-md shadow-2xl relative border border-white/20">
            <button onClick={() => setIsAddProductOpen(false)} className="absolute top-10 right-10 text-gray-300 hover:text-black text-2xl transition"><i className="fas fa-times"></i></button>
            <h3 className="text-3xl font-black italic tracking-tighter uppercase mb-10 text-zinc-800">Add to Archive</h3>
            <div className="space-y-6">
              <input className="w-full border-2 border-zinc-50 p-5 rounded-2xl text-xs font-bold bg-zinc-50 focus:border-blue-500 outline-none transition-all shadow-inner" placeholder="Product Title" value={pName} onChange={e => setPName(e.target.value)} />
              <div className="grid grid-cols-2 gap-4">
                <input className="w-full border-2 border-zinc-50 p-5 rounded-2xl text-xs font-bold bg-zinc-50 focus:border-blue-500 outline-none transition-all shadow-inner" placeholder="Price (PKR)" type="number" value={pPrice} onChange={e => setPPrice(Number(e.target.value))} />
                <input className="w-full border-2 border-zinc-50 p-5 rounded-2xl text-xs font-bold bg-zinc-50 focus:border-blue-500 outline-none transition-all shadow-inner" placeholder="Variants (Gold, ...)" value={pVariants} onChange={e => setPVariants(e.target.value)} />
              </div>
              <input className="w-full border-2 border-zinc-50 p-5 rounded-2xl text-xs font-bold bg-zinc-50 focus:border-blue-500 outline-none transition-all shadow-inner" placeholder="Image URL" value={pImage} onChange={e => setPImage(e.target.value)} />
              <textarea className="w-full border-2 border-zinc-50 p-5 rounded-2xl text-xs font-bold bg-zinc-50 focus:border-blue-500 outline-none h-28 resize-none transition-all shadow-inner" placeholder="Story / Description" value={pDesc} onChange={e => setPDesc(e.target.value)} />
              <select className="w-full border-2 border-zinc-50 p-5 rounded-2xl text-xs font-bold bg-zinc-50 focus:border-blue-500" value={pCat} onChange={e => setPCat(e.target.value)}>
                <option value="Luxury">Luxury Artisan</option>
                <option value="Minimalist">Minimalist / Heritage</option>
                <option value="Professional">Professional Series</option>
              </select>
              <button 
                className="w-full bg-black text-white p-6 rounded-[2.5rem] font-black text-xs uppercase tracking-[0.2em] mt-8 shadow-2xl shadow-blue-100 hover:bg-blue-600 transition-all active:scale-95"
                onClick={async () => {
                  if(!pName || !pPrice || !pImage) return window.alert('Archiving denied: Missing metadata.');
                  const variantArr = pVariants.split(',').filter(v => v.trim()).map(v => ({
                    id: `v-${Math.random().toString(36).substr(2, 5)}`,
                    name: v.trim(),
                    price: pPrice
                  }));
                  const { error } = await supabase.from('products').insert([{ 
                    name: pName, price_pkr: pPrice, image: pImage, 
                    description: pDesc || pName, category: pCat, inventory: 15,
                    variants: variantArr
                  }]);
                  if (error) window.alert('System Error: ' + error.message);
                  else { props.refreshData(); setIsAddProductOpen(false); setPName(''); setPPrice(0); setPImage(''); setPVariants(''); setPDesc(''); }
                }}
              >
                Publish Live Collection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
