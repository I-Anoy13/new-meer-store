
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

const AdminDashboard = (props: any) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [authKey, setAuthKey] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [timeRange, setTimeRange] = useState('6months'); 
  const [notifPermission, setNotifPermission] = useState(Notification.permission);
  
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
      const d = new Date(); d.setMonth(d.getMonth() - i);
      const mLabel = monthNames[d.getMonth()];
      const mYear = d.getFullYear();
      const mOrders = props.orders.filter((o: Order) => {
        const od = new Date(o.date);
        return od.getMonth() === d.getMonth() && od.getFullYear() === mYear && o.status !== 'Cancelled';
      });
      chartData.push({ name: mLabel, revenue: mOrders.reduce((sum: number, o: Order) => sum + o.total, 0) });
    }
    
    return { revenue, pendingCount, deliveredCount, total: props.totalDbCount || 0, chartData };
  }, [props.orders, props.totalDbCount, timeRange]);

  const formattedHeartbeat = useMemo(() => {
    if (!props.lastSyncTime) return 'Never';
    return props.lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }, [props.lastSyncTime]);

  if (!props.user) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6 text-black">
        <div className="bg-white p-10 md:p-16 rounded-[4rem] shadow-2xl w-full max-w-sm">
          <div className="text-center mb-12">
            <h1 className="text-3xl font-black uppercase tracking-tighter italic">ITX CONSOLE</h1>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-3 italic">Master Authorization Required</p>
          </div>
          <div className="space-y-5">
            <input 
              type="password" value={authKey}
              onChange={(e) => setAuthKey(e.target.value)}
              placeholder="Enter Passkey"
              className="w-full p-6 border-2 border-gray-100 rounded-[2rem] font-black text-center bg-gray-50 outline-none focus:border-blue-600 transition-all text-sm"
            />
            <button 
              onClick={() => {
                if (authKey === props.systemPassword) props.login(UserRole.ADMIN);
                else window.alert('Access Denied.');
              }}
              className="w-full bg-black text-white p-6 rounded-[2rem] font-black uppercase text-xs tracking-widest hover:bg-blue-600 transition-all shadow-2xl active:scale-95"
            >
              Enter Terminal
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f3f4f6] text-black font-sans pb-24 md:pb-0">
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-3xl border-b border-gray-200 h-20 md:h-24 flex items-center justify-between px-8 md:px-12">
        <div className="flex items-center space-x-12">
          <div className="flex flex-col">
            <h2 className="text-sm md:text-lg font-black italic tracking-tighter uppercase leading-none">ITX MASTER</h2>
            <div className="flex items-center gap-3 mt-2">
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${props.isLive ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                <span className="text-[9px] font-black uppercase tracking-widest text-gray-400 leading-none">Socket</span>
              </div>
              <div 
                className={`flex items-center gap-1.5 cursor-pointer px-2 py-0.5 rounded-full border transition-colors ${props.audioReady ? 'bg-green-50 border-green-100 text-green-600' : 'bg-red-50 border-red-100 text-red-600 animate-pulse'}`}
                onClick={() => props.initAudio?.()}
              >
                <i className={`fas ${props.audioReady ? 'fa-volume-up' : 'fa-volume-mute'} text-[9px]`}></i>
                <span className="text-[9px] font-black uppercase tracking-widest leading-none">Alerts</span>
              </div>
            </div>
          </div>
          <nav className="hidden lg:flex space-x-10 text-[11px] font-black uppercase tracking-widest">
            {['overview', 'orders', 'sys'].map(t => (
              <button key={t} onClick={() => setActiveTab(t)} className={activeTab === t ? 'text-blue-600' : 'text-gray-400 hover:text-black transition'}>
                {t}
              </button>
            ))}
          </nav>
        </div>
        <div className="flex items-center space-x-8">
           <div className="hidden lg:flex flex-col items-end">
             <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Last Signal</span>
             <span className="text-[10px] font-black text-black">{formattedHeartbeat}</span>
           </div>
           <button onClick={() => props.refreshData?.()} className="hidden md:flex bg-zinc-900 text-white px-8 py-3.5 rounded-[1.8rem] text-[10px] font-black uppercase tracking-widest shadow-xl items-center gap-3 hover:bg-black transition active:scale-95">
             <i className="fas fa-sync-alt text-blue-400"></i> REFRESH
          </button>
        </div>
      </header>

      <main className="p-6 md:p-12 max-w-7xl mx-auto space-y-12">
        {activeTab === 'overview' && (
          <div className="animate-fadeIn space-y-12">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-10">
              {[
                { label: 'Revenue', val: `Rs. ${analytics.revenue.toLocaleString()}`, color: 'text-black' },
                { label: 'Orders Total', val: analytics.total, color: 'text-black' },
                { label: 'Active Pending', val: analytics.pendingCount, color: 'text-blue-600' },
                { label: 'Success Rate', val: `${analytics.total ? Math.round((analytics.deliveredCount / (analytics.total || 1)) * 100) : 0}%`, color: 'text-green-600' }
              ].map((s, i) => (
                <div key={i} className="bg-white border border-gray-200 p-8 md:p-10 rounded-[2.5rem] md:rounded-[3rem] shadow-sm hover:shadow-xl transition-all duration-500 group">
                  <p className="text-[8px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 group-hover:text-blue-500 transition">{s.label}</p>
                  <p className={`text-2xl md:text-4xl font-black tracking-tighter italic ${s.color}`}>{s.val}</p>
                </div>
              ))}
            </div>

            <div className="bg-white p-10 rounded-[4rem] border border-gray-200 shadow-sm h-[400px]">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-8 italic">Revenue Trajectory</h3>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analytics.chartData}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f1f1" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 800, fill: '#999'}} dy={10} />
                  <YAxis hide />
                  <Tooltip 
                    contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', fontWeight: '900', fontSize: '11px', textTransform: 'uppercase' }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={4} fillOpacity={1} fill="url(#colorRev)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="animate-fadeIn space-y-6 md:space-y-8">
            <div className="flex justify-between items-center px-4">
              <h3 className="font-black text-[10px] md:text-xs uppercase tracking-widest text-gray-400 italic">Master Order Feed ({props.orders.length})</h3>
            </div>
            {props.orders.length === 0 ? (
              <div className="text-center py-32 bg-white rounded-[4rem] border border-dashed border-gray-200">
                <i className="fas fa-satellite text-4xl text-gray-100 mb-6 animate-bounce"></i>
                <p className="text-gray-400 font-black uppercase text-[10px] tracking-widest">Awaiting incoming signals...</p>
              </div>
            ) : (
              props.orders.map((o: Order) => (
                <div key={o.id} onClick={() => setSelectedOrder(o)} className="bg-white border border-gray-200 p-6 md:p-10 rounded-[2.5rem] md:rounded-[4rem] flex flex-col gap-6 md:flex-row md:justify-between md:items-center shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all cursor-pointer group">
                  <div className="flex items-center space-x-6 md:space-x-10 min-w-0">
                    <div className={`w-16 h-16 md:w-20 md:h-20 rounded-[1.5rem] md:rounded-[2.5rem] flex items-center justify-center font-black text-lg md:text-2xl border-4 transition-all duration-500 ${o.status === 'Delivered' ? 'bg-green-50 text-green-500 border-green-100' : 'bg-gray-50 border-gray-50 text-gray-400 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-500'}`}>
                      {String(o.status).charAt(0)}
                    </div>
                    <div className="min-w-0 flex-grow">
                      <p className="font-black text-lg md:text-2xl tracking-tighter italic">#{o.id}</p>
                      <p className="text-[11px] md:text-[14px] font-bold text-gray-400 uppercase mt-2 tracking-wide truncate">{o.customer.name} • {o.customer.city}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between md:justify-end md:space-x-16 border-t md:border-t-0 pt-6 md:pt-0 border-gray-100">
                    <p className="text-xl md:text-3xl font-black italic tracking-tighter">Rs. {o.total.toLocaleString()}</p>
                    <select 
                      value={o.status} 
                      onClick={(e) => e.stopPropagation()}
                      onChange={e => props.updateStatusOverride?.(o.id, e.target.value as any)}
                      className="border-2 border-gray-100 p-4 md:p-5 rounded-[1.5rem] md:rounded-[2rem] text-[10px] md:text-[12px] font-black uppercase bg-gray-50 focus:border-blue-600 outline-none transition shadow-sm"
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

        {activeTab === 'sys' && (
          <div className="max-w-3xl bg-white border border-gray-200 p-10 md:p-20 rounded-[4rem] md:rounded-[6rem] shadow-sm animate-fadeIn space-y-16 mx-auto">
             <div className="space-y-8">
                <p className="text-[11px] font-black uppercase text-gray-400 tracking-widest italic border-b pb-4">Persistence Monitoring</p>
                <div className="bg-gray-50 p-10 rounded-[3rem] border border-gray-100 space-y-10">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button 
                      onClick={() => {
                        props.initAudio?.();
                        props.testAlert?.();
                      }}
                      className="w-full bg-blue-600 text-white py-6 rounded-[2rem] text-[11px] font-black uppercase tracking-widest hover:bg-black transition shadow-2xl"
                    >
                      <i className="fas fa-volume-up mr-2"></i> Sound Test Alert
                    </button>
                    <button 
                      onClick={() => props.refreshData?.()}
                      className="w-full bg-black text-white py-6 rounded-[2rem] text-[11px] font-black uppercase tracking-widest hover:bg-zinc-800 transition shadow-2xl"
                    >
                      <i className="fas fa-sync mr-2"></i> Manual Heartbeat
                    </button>
                  </div>

                  <div className="p-6 bg-white rounded-3xl border border-gray-100">
                    <p className="text-[10px] font-black uppercase text-gray-400 mb-2">Notification Health</p>
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold ${notifPermission === 'granted' ? 'text-green-600' : 'text-red-600'}`}>
                        {notifPermission.toUpperCase()}
                      </span>
                      {notifPermission !== 'granted' && (
                        <button 
                          onClick={async () => {
                            const res = await Notification.requestPermission();
                            setNotifPermission(res);
                          }}
                          className="text-[9px] font-black text-blue-600 underline uppercase"
                        >
                          Enable Notifications
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="pt-10 border-t border-gray-200">
                    <p className="text-[10px] font-black uppercase text-red-500 tracking-widest mb-4 italic">Destruction Utility</p>
                    <button 
                      onClick={() => props.purgeDatabase?.()}
                      className="w-full bg-red-50 text-red-600 border border-red-100 py-6 rounded-[2rem] text-[11px] font-black uppercase tracking-widest hover:bg-red-600 hover:text-white transition shadow-sm"
                    >
                      <i className="fas fa-trash-alt mr-2"></i> Wipe Database History
                    </button>
                  </div>

                  <p className="text-[10px] text-gray-400 text-center font-bold uppercase italic leading-relaxed">
                    <i className="fas fa-info-circle mr-2 text-blue-500"></i>
                    Last Heartbeat: {formattedHeartbeat}. The terminal uses a silent video/audio stream and a Service Worker to keep background sync alive. Ensure notifications are allowed for real-time alerts.
                  </p>
                </div>
             </div>
          </div>
        )}
      </main>

      {/* MOBILE NAV */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-3xl border-t border-gray-200 h-24 flex items-center justify-around px-6 z-[80] shadow-[0_-15px_30px_-5px_rgba(0,0,0,0.08)]">
        {[
          { id: 'overview', icon: 'fa-chart-pie', label: 'Stats' },
          { id: 'orders', icon: 'fa-stream', label: 'Orders' },
          { id: 'sys', icon: 'fa-terminal', label: 'Sys' }
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex flex-col items-center gap-2 ${activeTab === tab.id ? 'text-blue-600 scale-110' : 'text-gray-400'}`}>
            <div className={`w-12 h-12 rounded-[1.2rem] flex items-center justify-center ${activeTab === tab.id ? 'bg-blue-50' : 'bg-transparent'}`}>
              <i className={`fas ${tab.icon} text-xl`}></i>
            </div>
            <span className="text-[9px] font-black uppercase tracking-widest">{tab.label}</span>
          </button>
        ))}
      </nav>

      {selectedOrder && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-3xl z-[150] flex items-center justify-center p-0 md:p-8 animate-fadeIn">
          <div className="bg-white p-8 md:p-16 w-full h-full md:h-auto md:max-w-4xl md:rounded-[4rem] shadow-2xl relative overflow-y-auto custom-scrollbar">
            <button onClick={() => setSelectedOrder(null)} className="absolute top-10 right-10 text-gray-400 hover:text-black text-3xl"><i className="fas fa-times"></i></button>
            <div className="flex items-center space-x-8 mb-16 text-black">
              <span className="text-2xl md:text-5xl font-black italic tracking-tighter uppercase text-zinc-900">Order Manifest</span>
              <span className="px-6 py-2.5 bg-blue-600 text-white text-[11px] font-black rounded-full uppercase tracking-widest shadow-2xl">#{selectedOrder.id}</span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 mb-16 text-black">
              <div className="space-y-10">
                <h4 className="text-[11px] font-black uppercase tracking-widest text-gray-300 border-b border-gray-100 pb-4 italic">Customer Entity</h4>
                <div>
                  <p className="text-[9px] font-black uppercase text-gray-400 mb-2 tracking-widest">Name</p>
                  <p className="font-bold text-xl md:text-2xl tracking-tight italic">{selectedOrder.customer.name}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase text-gray-400 mb-2 tracking-widest">Contact</p>
                  <p className="font-black text-xl md:text-2xl text-blue-600 italic underline underline-offset-[12px]">{selectedOrder.customer.phone}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase text-gray-400 mb-2 tracking-widest">Ship-to Address</p>
                  <p className="font-bold text-sm md:text-base leading-relaxed text-gray-600 italic">{selectedOrder.customer.address}, {selectedOrder.customer.city || 'N/A'}</p>
                </div>
              </div>
              <div className="bg-zinc-50 p-10 rounded-[4rem] border border-zinc-100 shadow-inner text-black">
                <h4 className="text-[11px] font-black uppercase tracking-widest text-zinc-400 border-b border-zinc-200 pb-4 mb-10 italic">Items Summary</h4>
                <div className="space-y-6">
                  {selectedOrder.items.map((itm, i) => (
                    <div key={i} className="flex items-center space-x-6 bg-white p-4 rounded-3xl shadow-sm">
                      <div className="w-16 h-16 rounded-[1.5rem] overflow-hidden">
                        <img src={itm.product.image} className="w-full h-full object-cover" />
                      </div>
                      <div className="min-w-0 flex-grow">
                        <p className="text-[14px] font-black uppercase tracking-tight truncate">{itm.product.name}</p>
                        <p className="text-[11px] font-bold text-zinc-400 mt-1.5 uppercase">Qty: {itm.quantity}</p>
                      </div>
                    </div>
                  ))}
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
