
import React, { useState, useMemo } from 'react';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area 
} from 'recharts';
import { UserRole, Order, Product } from '../types';

const AdminDashboard = (props: any) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [authKey, setAuthKey] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [showInsight, setShowInsight] = useState<string | null>(null);

  const analytics = useMemo(() => {
    const valid = props.orders.filter((o: Order) => o.status !== 'Cancelled');
    const revenue = valid.reduce((acc: number, o: Order) => acc + (Number(o.total) || 0), 0);
    const pendingCount = props.orders.filter((o: Order) => o.status === 'Pending').length;
    const deliveredCount = props.orders.filter((o: Order) => o.status === 'Delivered').length;

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
    
    return { revenue, pendingCount, deliveredCount, chartData };
  }, [props.orders]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard');
  };

  if (!props.user) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6">
        <div className="bg-white p-12 rounded-[3rem] shadow-2xl w-full max-w-sm text-center animate-fadeIn">
          <h1 className="text-3xl font-black italic tracking-tighter uppercase mb-2 text-black">ITX COMMAND</h1>
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
              else alert('Invalid Passkey');
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
    <div className="min-h-screen bg-[#f8f9fb] text-black pb-32">
      <header className="sticky top-0 z-[150] bg-white/80 backdrop-blur-3xl border-b border-gray-100 h-20 flex items-center justify-between px-6 lg:px-12">
        <div className="flex items-center space-x-12">
          <div>
            <h2 className="text-lg lg:text-xl font-black italic tracking-tighter uppercase leading-none">ITX MASTER</h2>
            <div className="flex items-center gap-2 mt-1.5">
              <div className={`w-2 h-2 rounded-full ${props.isLive ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
              <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">Database Linked</span>
            </div>
          </div>
          <nav className="hidden lg:flex space-x-8 text-[11px] font-black uppercase tracking-widest">
            {['overview', 'orders', 'products', 'sys'].map(t => (
              <button key={t} onClick={() => setActiveTab(t)} className={activeTab === t ? 'text-blue-600' : 'text-gray-400 hover:text-black transition'}>
                {t}
              </button>
            ))}
          </nav>
        </div>
        <div className="flex items-center space-x-4">
           <button onClick={() => props.refreshData()} className="bg-black text-white p-3 rounded-full hover:rotate-180 transition-all duration-700 shadow-lg">
             <i className="fas fa-sync-alt text-xs"></i>
           </button>
           <button onClick={() => props.logout()} className="bg-red-50 text-red-600 p-3 rounded-full hover:bg-red-600 hover:text-white transition">
             <i className="fas fa-power-off text-xs"></i>
           </button>
        </div>
      </header>

      <main className="p-6 lg:p-12 max-w-7xl mx-auto space-y-8">
        {activeTab === 'overview' && (
          <div className="animate-fadeIn space-y-8">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
              {[
                { label: 'Revenue', val: `Rs. ${analytics.revenue.toLocaleString()}`, color: 'text-black', icon: 'fa-money-bill-wave', id: 'rev' },
                { label: 'Total Orders', val: props.orders.length, color: 'text-black', icon: 'fa-shopping-cart', id: 'ord' },
                { label: 'Delivered', val: analytics.deliveredCount, color: 'text-green-600', icon: 'fa-check-double', id: 'del' },
                { label: 'Pending', val: analytics.pendingCount, color: 'text-blue-600', icon: 'fa-clock', id: 'pen' }
              ].map((s, i) => (
                <div key={i} onClick={() => setShowInsight(s.id)} className="bg-white p-6 lg:p-8 rounded-[2rem] border border-gray-100 shadow-sm flex flex-col justify-between items-start group hover:shadow-xl transition-all cursor-pointer">
                  <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-300 group-hover:bg-blue-50 group-hover:text-blue-600 mb-4">
                    <i className={`fas ${s.icon} text-xs`}></i>
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">{s.label}</p>
                    <p className={`text-xl lg:text-2xl font-black italic tracking-tighter ${s.color}`}>{s.val}</p>
                  </div>
                </div>
              ))}
            </div>

            {showInsight && (
              <div className="bg-blue-600 text-white p-8 rounded-[3rem] animate-fadeIn flex justify-between items-center">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest mb-2 italic">Detailed Insight: {showInsight.toUpperCase()}</h3>
                  <p className="text-sm font-medium opacity-80">
                    {showInsight === 'rev' ? 'Showing all-time gross revenue from verified sales.' : 
                     showInsight === 'ord' ? `System is managing ${props.orders.length} unique order manifests.` :
                     showInsight === 'del' ? 'Successful deliveries tracked by logistics team.' :
                     'Orders awaiting dispatch or confirmation.'}
                  </p>
                </div>
                <button onClick={() => setShowInsight(null)} className="p-2 hover:bg-white/20 rounded-full transition"><i className="fas fa-times"></i></button>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 bg-white p-8 lg:p-12 rounded-[3rem] border border-gray-100 h-[400px]">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-8 italic">Growth Trajectory</h3>
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

              <div className="bg-white border border-gray-100 p-8 rounded-[3rem] flex flex-col">
                 <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-8 italic">Inventory Alert</h3>
                 <div className="space-y-4 overflow-y-auto max-h-[250px] pr-2 custom-scrollbar">
                    {props.products.map((p: Product) => (
                      <div key={p.id} className="flex items-center justify-between p-3 rounded-2xl bg-gray-50">
                        <div className="flex items-center gap-3">
                          <img src={p.image} className="w-8 h-8 rounded-lg object-cover" />
                          <p className="text-[10px] font-black uppercase truncate max-w-[120px]">{p.name}</p>
                        </div>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded ${p.inventory < 5 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                          {p.inventory} left
                        </span>
                      </div>
                    ))}
                 </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="animate-fadeIn space-y-4">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black italic uppercase">Order Manifests</h2>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{props.orders.length} TOTAL</span>
            </div>
            {props.orders.map((o: Order) => (
              <div key={o.id} className="bg-white p-6 lg:p-10 rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-xl transition-all relative overflow-hidden group">
                <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-6">
                  <div className="flex items-center space-x-6">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl border-2 transition-all group-hover:bg-black group-hover:text-white group-hover:border-black ${o.status === 'Delivered' ? 'bg-green-50 text-green-500 border-green-100' : 'bg-gray-50 text-gray-400 border-gray-50'}`}>
                      {o.status.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-3">
                        <p className="font-black text-lg italic tracking-tighter text-black">#{o.id}</p>
                        <button onClick={() => copyToClipboard(o.id)} className="text-gray-300 hover:text-blue-600 transition"><i className="fas fa-copy text-[10px]"></i></button>
                      </div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                        {new Date(o.date).toLocaleDateString()} • {new Date(o.date).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-12 lg:flex-grow lg:justify-around px-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                         <span className="text-[9px] font-black text-gray-400 uppercase">Customer:</span>
                         <p className="text-[11px] font-black uppercase text-black">{o.customer.name}</p>
                         <button onClick={() => copyToClipboard(o.customer.name)} className="text-gray-300 hover:text-blue-600"><i className="fas fa-copy text-[9px]"></i></button>
                      </div>
                      <div className="flex items-center gap-2">
                         <span className="text-[9px] font-black text-gray-400 uppercase">Phone:</span>
                         <p className="text-[11px] font-black uppercase text-blue-600">{o.customer.phone}</p>
                         <button onClick={() => copyToClipboard(o.customer.phone)} className="text-gray-300 hover:text-blue-600"><i className="fas fa-copy text-[9px]"></i></button>
                      </div>
                      <div className="flex items-center gap-2">
                         <span className="text-[9px] font-black text-gray-400 uppercase">Address:</span>
                         <p className="text-[10px] font-bold text-gray-500 truncate max-w-[150px]">{o.customer.address}</p>
                         <button onClick={() => copyToClipboard(o.customer.address)} className="text-gray-300 hover:text-blue-600"><i className="fas fa-copy text-[9px]"></i></button>
                      </div>
                    </div>
                    
                    <div className="flex flex-col lg:items-end justify-center">
                       <p className="text-lg font-black italic text-black">Rs. {o.total.toLocaleString()}</p>
                       <div className="mt-2 flex items-center gap-3">
                         <select 
                            value={o.status} 
                            onChange={e => props.updateStatus(o.id, e.target.value)}
                            className="bg-gray-50 border-none text-[9px] font-black uppercase px-3 py-1.5 rounded-lg outline-none focus:ring-1 ring-black cursor-pointer"
                          >
                            {['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                          <button onClick={() => setSelectedOrder(o)} className="text-gray-400 hover:text-black transition"><i className="fas fa-external-link-alt text-xs"></i></button>
                       </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'products' && (
          <div className="animate-fadeIn space-y-8">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-black italic uppercase">Product Command</h2>
              <button 
                onClick={() => setEditingProduct({ name: '', description: '', price: 0, image: '', category: 'Luxury', inventory: 10, variants: [] })}
                className="bg-black text-white px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl"
              >
                <i className="fas fa-plus mr-2"></i> New Product
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {props.products.map((p: Product) => (
                <div key={p.id} className="bg-white rounded-[2.5rem] border border-gray-100 overflow-hidden shadow-sm hover:shadow-xl transition-all group">
                  <div className="h-48 relative">
                    <img src={p.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
                    <div className="absolute bottom-4 left-6">
                      <p className="text-[9px] font-black text-white/70 uppercase tracking-widest">{p.category}</p>
                      <h4 className="text-lg font-black italic text-white uppercase truncate max-w-[200px]">{p.name}</h4>
                    </div>
                  </div>
                  <div className="p-6">
                    <div className="flex justify-between items-center mb-6">
                      <p className="text-lg font-black italic">Rs. {p.price.toLocaleString()}</p>
                      <span className={`text-[10px] font-black px-3 py-1 rounded-full ${p.inventory < 5 ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-400'}`}>
                        {p.inventory} STOCK
                      </span>
                    </div>
                    <div className="flex gap-3">
                      <button 
                        onClick={() => setEditingProduct(p)}
                        className="flex-grow bg-black text-white py-3 rounded-xl font-black uppercase text-[10px] tracking-widest"
                      >
                        Edit Details
                      </button>
                      <button 
                        onClick={() => { if(window.confirm('Delete this product?')) props.deleteProduct(p.id); }}
                        className="bg-red-50 text-red-600 p-3 rounded-xl hover:bg-red-600 hover:text-white transition"
                      >
                        <i className="fas fa-trash"></i>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'sys' && (
          <div className="bg-white p-12 rounded-[3rem] border border-gray-100 max-w-2xl mx-auto space-y-12 animate-fadeIn text-center">
            <h3 className="text-[11px] font-black uppercase tracking-widest text-gray-400 italic border-b pb-4">System Utilities</h3>
            <div className="grid grid-cols-1 gap-4">
               <button onClick={() => props.testAlert()} className="w-full bg-blue-600 text-white p-6 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-black transition">
                 <i className="fas fa-bell mr-2"></i> Trigger Signal Test
               </button>
               <button onClick={() => props.initAudio()} className="w-full bg-gray-50 text-gray-400 p-6 rounded-2xl font-black uppercase text-xs tracking-widest border border-gray-100 hover:text-black transition">
                 <i className="fas fa-volume-up mr-2"></i> Calibrate Audio Engine
               </button>
            </div>
            <div className="p-6 bg-gray-50 rounded-2xl">
               <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                 Last Sync: {props.lastSyncTime.toLocaleTimeString()} <br/>
                 Database Status: {props.isLive ? 'STABLE' : 'CONNECTING...'}
               </p>
            </div>
          </div>
        )}
      </main>

      <nav className="lg:hidden fixed bottom-6 left-6 right-6 bg-white/90 backdrop-blur-2xl border border-gray-100 h-16 rounded-3xl flex items-center justify-around z-[200] shadow-2xl">
        {[
          { id: 'overview', icon: 'fa-chart-pie' },
          { id: 'orders', icon: 'fa-list' },
          { id: 'products', icon: 'fa-box' },
          { id: 'sys', icon: 'fa-cog' }
        ].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} className={`p-4 ${activeTab === t.id ? 'text-blue-600' : 'text-gray-300'} transition-all`}>
            <i className={`fas ${t.icon} text-lg`}></i>
          </button>
        ))}
      </nav>

      {/* PRODUCT MODAL */}
      {editingProduct && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[300] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg p-10 rounded-[3rem] animate-fadeIn max-h-[90vh] overflow-y-auto custom-scrollbar">
            <h4 className="text-2xl font-black italic uppercase mb-8">Product Manifest</h4>
            <div className="space-y-4">
               <div>
                 <label className="text-[9px] font-black uppercase text-gray-400 mb-2 block">Product Name</label>
                 <input type="text" className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none" value={editingProduct.name} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} />
               </div>
               <div>
                 <label className="text-[9px] font-black uppercase text-gray-400 mb-2 block">Price (PKR)</label>
                 <input type="number" className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none" value={editingProduct.price} onChange={e => setEditingProduct({...editingProduct, price: e.target.value})} />
               </div>
               <div>
                 <label className="text-[9px] font-black uppercase text-gray-400 mb-2 block">Inventory Count</label>
                 <input type="number" className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none" value={editingProduct.inventory} onChange={e => setEditingProduct({...editingProduct, inventory: e.target.value})} />
               </div>
               <div>
                 <label className="text-[9px] font-black uppercase text-gray-400 mb-2 block">Image URL</label>
                 <input type="text" className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none" value={editingProduct.image} onChange={e => setEditingProduct({...editingProduct, image: e.target.value})} />
               </div>
               <div>
                 <label className="text-[9px] font-black uppercase text-gray-400 mb-2 block">Description</label>
                 <textarea className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none h-24" value={editingProduct.description} onChange={e => setEditingProduct({...editingProduct, description: e.target.value})} />
               </div>
            </div>
            <div className="flex gap-3 mt-10">
              <button onClick={() => setEditingProduct(null)} className="flex-grow bg-gray-100 text-gray-400 py-4 rounded-2xl font-black uppercase text-[10px]">Cancel</button>
              <button 
                onClick={async () => {
                   const ok = await props.saveProduct(editingProduct);
                   if(ok) setEditingProduct(null);
                }}
                className="flex-grow bg-black text-white py-4 rounded-2xl font-black uppercase text-[10px]"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ORDER DETAIL MODAL */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-3xl z-[300] flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white w-full max-w-2xl p-10 rounded-[3rem] relative shadow-2xl max-h-[90vh] overflow-y-auto">
            <button onClick={() => setSelectedOrder(null)} className="absolute top-8 right-8 text-gray-300 hover:text-black transition">
              <i className="fas fa-times text-2xl"></i>
            </button>
            <h4 className="text-3xl font-black italic tracking-tighter uppercase mb-10">Order Manifest <span className="text-blue-600 ml-2">#{selectedOrder.id}</span></h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-6">
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase mb-2">Customer</p>
                  <p className="font-black text-xl flex items-center gap-2">
                    {selectedOrder.customer.name}
                    <button onClick={() => copyToClipboard(selectedOrder.customer.name)}><i className="fas fa-copy text-xs text-gray-200"></i></button>
                  </p>
                  <p className="text-sm font-bold text-blue-600 flex items-center gap-2">
                    {selectedOrder.customer.phone}
                    <button onClick={() => copyToClipboard(selectedOrder.customer.phone)}><i className="fas fa-copy text-xs text-gray-200"></i></button>
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase mb-2">Delivery Address</p>
                  <p className="text-sm font-bold text-gray-500 italic leading-relaxed">
                    {selectedOrder.customer.address}
                    <button onClick={() => copyToClipboard(selectedOrder.customer.address)} className="ml-2"><i className="fas fa-copy text-xs text-gray-200"></i></button>
                  </p>
                </div>
              </div>
              <div className="bg-gray-50 p-6 rounded-2xl">
                 <p className="text-[10px] font-black text-gray-400 uppercase mb-4 italic">Item Manifest</p>
                 <div className="space-y-4">
                   {selectedOrder.items.map((itm: any, i: number) => (
                     <div key={i} className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-100">
                       <div>
                         <p className="text-[11px] font-black uppercase truncate max-w-[150px]">{itm.product?.name || 'Item'}</p>
                         <p className="text-[9px] font-bold text-gray-400 uppercase">{itm.variantName}</p>
                       </div>
                       <p className="text-[11px] font-black text-blue-600 italic">x{itm.quantity}</p>
                     </div>
                   ))}
                 </div>
              </div>
            </div>
            <div className="mt-10 pt-8 border-t border-gray-100 flex flex-col md:flex-row gap-4">
               <button 
                  onClick={() => {
                    const phone = selectedOrder.customer.phone.replace(/[^0-9]/g, '');
                    window.open(`https://wa.me/${phone}?text=Assalam-o-Alaikum ${selectedOrder.customer.name}, ITX MEER SHOP here. Confirming your order #${selectedOrder.id}.`, '_blank');
                  }}
                  className="flex-grow bg-[#25D366] text-white p-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl"
               >
                 <i className="fab fa-whatsapp mr-2"></i> Confirm WhatsApp
               </button>
               <button 
                  onClick={() => window.print()}
                  className="flex-grow bg-black text-white p-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl"
               >
                 <i className="fas fa-print mr-2"></i> Print Invoice
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
