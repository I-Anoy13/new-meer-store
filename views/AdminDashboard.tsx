
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
import { UserRole, Order, Product } from '../types';

const AdminDashboard = (props: any) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [authKey, setAuthKey] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  
  const analytics = useMemo(() => {
    const valid = props.orders.filter((o: Order) => o.status !== 'Cancelled');
    const revenue = valid.reduce((acc: number, o: Order) => acc + (Number(o.total) || 0), 0);
    const pendingCount = props.orders.filter((o: Order) => o.status === 'Pending').length;

    const chartData = [];
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      const mLabel = monthNames[d.getMonth()];
      const mOrders = props.orders.filter((o: Order) => {
        const od = new Date(o.date);
        return od.getMonth() === d.getMonth() && od.getFullYear() === d.getFullYear() && o.status !== 'Cancelled';
      });
      chartData.push({ name: mLabel, revenue: mOrders.reduce((sum: number, o: Order) => sum + o.total, 0) });
    }
    
    return { revenue, pendingCount, chartData };
  }, [props.orders]);

  if (!props.user) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6">
        <div className="bg-white p-12 rounded-[3rem] shadow-2xl w-full max-w-sm text-center">
          <h1 className="text-3xl font-black italic tracking-tighter uppercase mb-2">ITX COMMAND</h1>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-8">Authorization Required</p>
          <input 
            type="password" value={authKey}
            onChange={(e) => setAuthKey(e.target.value)}
            placeholder="Security Passkey"
            className="w-full p-4 border border-gray-100 rounded-2xl bg-gray-50 mb-4 outline-none focus:ring-2 ring-black transition text-center font-bold"
          />
          <button 
            onClick={() => {
              if (authKey === props.systemPassword) props.login(UserRole.ADMIN);
              else alert('Invalid');
            }}
            className="w-full bg-black text-white p-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition"
          >
            Access Terminal
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9fb] text-black">
      {/* MASTER HEADER */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-3xl border-b border-gray-100 h-20 flex items-center justify-between px-8">
        <div className="flex items-center space-x-12">
          <div>
            <h2 className="text-xl font-black italic tracking-tighter uppercase leading-none">ITX MASTER</h2>
            <div className="flex items-center gap-2 mt-1.5">
              <div className={`w-2 h-2 rounded-full ${props.isLive ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
              <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">Live Relay</span>
            </div>
          </div>
          <nav className="hidden lg:flex space-x-8 text-[11px] font-black uppercase tracking-widest">
            {['overview', 'orders', 'live', 'sys'].map(t => (
              <button key={t} onClick={() => setActiveTab(t)} className={activeTab === t ? 'text-blue-600' : 'text-gray-400 hover:text-black transition'}>
                {t}
              </button>
            ))}
          </nav>
        </div>
        <div className="flex items-center space-x-4">
           <div 
             className={`px-4 py-2 rounded-full border flex items-center gap-2 cursor-pointer transition-all ${props.audioReady ? 'bg-blue-50 border-blue-100 text-blue-600' : 'bg-red-50 border-red-100 text-red-600 animate-pulse'}`}
             onClick={() => props.initAudio()}
           >
             <i className={`fas ${props.audioReady ? 'fa-volume-up' : 'fa-volume-mute'} text-[10px]`}></i>
             <span className="text-[9px] font-black uppercase tracking-widest">{props.audioReady ? 'Alerts On' : 'Unlock Audio'}</span>
           </div>
           <button onClick={() => props.refreshData()} className="bg-black text-white p-3 rounded-full hover:rotate-180 transition-all duration-700">
             <i className="fas fa-sync-alt text-xs"></i>
           </button>
        </div>
      </header>

      <main className="p-8 max-w-7xl mx-auto space-y-8 pb-32">
        {activeTab === 'overview' && (
          <div className="animate-fadeIn space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[
                { label: 'Total Revenue', val: `Rs. ${analytics.revenue.toLocaleString()}`, color: 'text-black', icon: 'fa-money-bill-wave' },
                { label: 'Total Sales', val: props.totalDbCount, color: 'text-black', icon: 'fa-shopping-cart' },
                { label: 'Live Visitors', val: props.activeVisitors.length, color: 'text-green-600', icon: 'fa-users' },
                { label: 'Pending Action', val: analytics.pendingCount, color: 'text-blue-600', icon: 'fa-clock' }
              ].map((s, i) => (
                <div key={i} className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm flex justify-between items-start group">
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">{s.label}</p>
                    <p className={`text-2xl font-black italic tracking-tighter ${s.color}`}>{s.val}</p>
                  </div>
                  <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-300 group-hover:bg-blue-50 group-hover:text-blue-600 transition">
                    <i className={`fas ${s.icon} text-xs`}></i>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 bg-white p-10 rounded-[3rem] border border-gray-100 h-[400px]">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-8 italic">Store Performance</h3>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analytics.chartData}>
                    <defs>
                      <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f1f1" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 900, fill: '#999'}} />
                    <YAxis hide />
                    <Tooltip contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }} />
                    <Area type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={4} fill="url(#colorRev)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-black text-white p-8 rounded-[3rem] shadow-xl flex flex-col">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-6 italic">Live Activity Feed</h3>
                <div className="flex-grow space-y-6 overflow-y-auto custom-scrollbar pr-2">
                  {props.liveActivities.length === 0 ? (
                    <p className="text-[10px] text-gray-600 italic">Listening for store signals...</p>
                  ) : (
                    props.liveActivities.map((act: any, i: number) => (
                      <div key={i} className="flex items-center gap-4 border-l-2 border-blue-600 pl-4 py-1 animate-fadeIn">
                        <div>
                          <p className="text-[11px] font-black uppercase tracking-tight">{act.name} placed an order</p>
                          <p className="text-[9px] text-gray-500 font-bold">{new Date(act.time).toLocaleTimeString()}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="animate-fadeIn space-y-4">
            {props.orders.map((o: Order) => (
              <div key={o.id} onClick={() => setSelectedOrder(o)} className="bg-white p-6 md:p-10 rounded-[2.5rem] border border-gray-100 flex flex-col md:flex-row justify-between items-center shadow-sm hover:shadow-xl transition-all cursor-pointer group">
                <div className="flex items-center space-x-8">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl border-2 ${o.status === 'Delivered' ? 'bg-green-50 text-green-500 border-green-100' : 'bg-gray-50 text-gray-400 group-hover:bg-black group-hover:text-white transition'}`}>
                    {o.status.charAt(0)}
                  </div>
                  <div>
                    <p className="font-black text-xl italic tracking-tighter">#{o.id}</p>
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">{o.customer.name} • {o.customer.city}</p>
                  </div>
                </div>
                <div className="flex items-center gap-12 mt-6 md:mt-0">
                  <p className="text-xl font-black italic">Rs. {o.total.toLocaleString()}</p>
                  <select 
                    value={o.status} 
                    onClick={(e) => e.stopPropagation()}
                    onChange={e => props.updateStatusOverride(o.id, e.target.value)}
                    className="p-3 rounded-xl border border-gray-100 bg-gray-50 text-[10px] font-black uppercase outline-none focus:ring-2 ring-black"
                  >
                    {['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'live' && (
          <div className="animate-fadeIn grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {props.activeVisitors.map((v: any, i: number) => (
              <div key={i} className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-ping"></div>
                </div>
                <h4 className="text-xl font-black italic uppercase mb-2">Visitor {i+1}</h4>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Location</span>
                    <span className="text-[10px] font-black text-blue-600 uppercase">{v.city || 'Pakistan'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Activity</span>
                    <span className="text-[10px] font-black text-black uppercase truncate ml-4">{v.last_view || 'Browsing'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Role</span>
                    <span className="text-[10px] font-black text-gray-400 uppercase">{v.role}</span>
                  </div>
                </div>
              </div>
            ))}
            {props.activeVisitors.length === 0 && (
              <div className="col-span-full py-32 text-center opacity-40">
                <i className="fas fa-satellite-dish text-4xl mb-6"></i>
                <p className="text-[10px] font-black uppercase tracking-widest">Awaiting visitor signals...</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'sys' && (
          <div className="bg-white p-12 rounded-[3rem] border border-gray-100 max-w-2xl mx-auto space-y-12">
            <h3 className="text-[11px] font-black uppercase tracking-widest text-gray-400 italic border-b pb-4">Terminal Maintenance</h3>
            <div className="grid grid-cols-1 gap-4">
               <button onClick={() => props.testAlert()} className="w-full bg-blue-600 text-white p-6 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-black transition">
                 <i className="fas fa-volume-up mr-2"></i> Test Sale Alert
               </button>
               <button onClick={() => props.purgeDatabase()} className="w-full bg-red-50 text-red-600 p-6 rounded-2xl font-black uppercase text-xs tracking-widest border border-red-100 hover:bg-red-600 hover:text-white transition">
                 <i className="fas fa-trash-alt mr-2"></i> Wipe Master Orders
               </button>
            </div>
            <div className="p-6 bg-gray-50 rounded-2xl text-center">
               <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-relaxed">
                 Master Heartbeat: {props.lastSyncTime.toLocaleTimeString()} <br/>
                 Database Status: {props.isLive ? 'CONNECTED' : 'OFFLINE'}
               </p>
            </div>
          </div>
        )}
      </main>

      {/* MOBILE MASTER NAV */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-gray-100 h-20 flex items-center justify-around z-[100]">
        {[
          { id: 'overview', icon: 'fa-chart-pie' },
          { id: 'orders', icon: 'fa-list' },
          { id: 'live', icon: 'fa-broadcast-tower' },
          { id: 'sys', icon: 'fa-cog' }
        ].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} className={`p-4 ${activeTab === t.id ? 'text-blue-600 scale-125' : 'text-gray-300'} transition-all`}>
            <i className={`fas ${t.icon}`}></i>
          </button>
        ))}
      </nav>

      {/* ORDER DETAILS MODAL */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-3xl z-[200] flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white w-full max-w-2xl p-10 rounded-[3rem] relative shadow-2xl">
            <button onClick={() => setSelectedOrder(null)} className="absolute top-8 right-8 text-gray-300 hover:text-black transition">
              <i className="fas fa-times text-2xl"></i>
            </button>
            <h4 className="text-3xl font-black italic tracking-tighter uppercase mb-10">Order Manifest <span className="text-blue-600 ml-2">#{selectedOrder.id}</span></h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-6">
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase mb-2">Customer</p>
                  <p className="font-black text-xl">{selectedOrder.customer.name}</p>
                  <p className="text-sm font-bold text-blue-600">{selectedOrder.customer.phone}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase mb-2">Address</p>
                  <p className="text-sm font-bold text-gray-500 italic">{selectedOrder.customer.address}</p>
                </div>
              </div>
              <div className="bg-gray-50 p-6 rounded-2xl">
                 <p className="text-[10px] font-black text-gray-400 uppercase mb-4">Line Items</p>
                 <div className="space-y-4">
                   {selectedOrder.items.map((itm, i) => (
                     <div key={i} className="flex justify-between items-center bg-white p-3 rounded-xl border border-gray-100">
                       <p className="text-[11px] font-black uppercase truncate max-w-[150px]">{itm.product.name}</p>
                       <p className="text-[10px] font-bold text-blue-600">x{itm.quantity}</p>
                     </div>
                   ))}
                 </div>
              </div>
            </div>
            <button 
               onClick={() => {
                 window.open(`https://wa.me/${selectedOrder.customer.phone.replace(/[^0-9]/g, '')}?text=Hello ${selectedOrder.customer.name}, ITX MEER SHOP confirming order #${selectedOrder.id}`, '_blank');
               }}
               className="w-full bg-[#25D366] text-white p-4 rounded-2xl font-black uppercase text-xs tracking-widest mt-10 shadow-xl hover:scale-[1.02] transition"
            >
              <i className="fab fa-whatsapp mr-2"></i> Confirm via WhatsApp
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
