
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { UserRole, Order, Product } from '../types';

const AdminDashboard = (props: any) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [authKey, setAuthKey] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  useEffect(() => {
    if (selectedOrder && props.orders) {
      const match = props.orders.find((o: Order) => 
        String(o.id) === String(selectedOrder.id) || 
        (o.dbId && String(o.dbId) === String(selectedOrder.dbId))
      );
      if (match && match.status !== selectedOrder.status) {
        setSelectedOrder(match);
      }
    }
  }, [props.orders, selectedOrder]);

  const analytics = useMemo(() => {
    const orders = Array.isArray(props.orders) ? props.orders : [];
    const valid = orders.filter((o: Order) => o.status !== 'Cancelled');
    const revenue = valid.reduce((acc: number, o: Order) => acc + (Number(o.total) || 0), 0);
    const pendingCount = orders.filter((o: Order) => o.status === 'Pending').length;
    const deliveredCount = orders.filter((o: Order) => o.status === 'Delivered').length;

    const chartData = [];
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mLabel = monthNames[d.getMonth()];
      const mOrders = orders.filter((o: Order) => {
        if (!o.date) return false;
        const od = new Date(o.date);
        return od.getMonth() === d.getMonth() && od.getFullYear() === d.getFullYear() && o.status !== 'Cancelled';
      });
      chartData.push({ 
        name: mLabel, 
        revenue: mOrders.reduce((sum: number, o: Order) => sum + (Number(o.total) || 0), 0) 
      });
    }
    return { revenue, pendingCount, deliveredCount, chartData };
  }, [props.orders]);

  if (!props.user) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6 animate-fadeIn">
        <div className="bg-white p-8 md:p-12 rounded-[2.5rem] shadow-2xl w-full max-w-sm text-center">
          <h1 className="text-2xl font-black italic tracking-tighter uppercase mb-2 text-black">ITX MASTER</h1>
          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-8 italic">Access Point</p>
          <input 
            type="password" 
            value={authKey} 
            onChange={e => setAuthKey(e.target.value)} 
            onKeyDown={e => e.key === 'Enter' && (authKey === props.systemPassword ? props.login(UserRole.ADMIN) : alert('Access Denied'))}
            placeholder="Passkey" 
            className="w-full p-4 border border-gray-100 rounded-2xl bg-gray-50 mb-4 outline-none focus:ring-2 ring-black text-center font-bold text-sm" 
          />
          <button onClick={() => { if (authKey === props.systemPassword) props.login(UserRole.ADMIN); else alert('Access Denied'); }} className="w-full bg-black text-white p-4 rounded-2xl font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all shadow-xl">Authenticate</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9fb] text-black pb-32 animate-fadeIn">
      <header className="sticky top-0 z-[150] bg-white/80 backdrop-blur-3xl border-b border-gray-100 h-16 md:h-20 flex items-center justify-between px-4 md:px-12">
        <div className="flex items-center space-x-6">
          <h2 className="text-base md:text-xl font-black italic tracking-tighter uppercase">ITX MASTER</h2>
          <nav className="hidden lg:flex space-x-8 text-[10px] font-black uppercase tracking-widest italic">
            {['overview', 'orders', 'products'].map(t => (
              <button key={t} onClick={() => setActiveTab(t)} className={activeTab === t ? 'text-blue-600' : 'text-gray-400 hover:text-black transition'}>{t}</button>
            ))}
          </nav>
        </div>
        <div className="flex space-x-2 md:space-x-4">
           <button onClick={() => props.refreshData()} className="bg-black text-white p-2 md:p-3 rounded-full shadow-lg hover:scale-110 transition-transform"><i className="fas fa-sync-alt text-[10px]"></i></button>
           <button onClick={() => props.logout()} className="bg-red-50 text-red-600 p-2 md:p-3 rounded-full hover:bg-red-600 hover:text-white transition-colors"><i className="fas fa-power-off text-[10px]"></i></button>
        </div>
      </header>

      <main className="p-4 md:p-12 max-w-7xl mx-auto">
        {activeTab === 'overview' && (
          <div className="space-y-6 md:space-y-8">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              {[
                { label: 'Revenue', val: `Rs. ${analytics.revenue.toLocaleString()}`, icon: 'fa-wallet' },
                { label: 'Manifests', val: (props.orders || []).length, icon: 'fa-file-invoice' },
                { label: 'Successful', val: analytics.deliveredCount, icon: 'fa-check-circle' },
                { label: 'Awaiting', val: analytics.pendingCount, icon: 'fa-clock' }
              ].map((s, i) => (
                <div key={i} className="bg-white p-5 md:p-8 rounded-[1.5rem] border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                  <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center text-gray-400 mb-4"><i className={`fas ${s.icon} text-[10px]`}></i></div>
                  <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">{s.label}</p>
                  <p className="text-sm md:text-xl font-black italic text-black truncate">{s.val}</p>
                </div>
              ))}
            </div>
            <div className="bg-white p-6 md:p-10 rounded-[2rem] border border-gray-100 h-[300px] md:h-[400px] shadow-sm">
              <h3 className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-6 italic">Growth Projection</h3>
              <ResponsiveContainer width="100%" height="85%">
                <AreaChart data={analytics.chartData}>
                  <defs><linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/><stop offset="95%" stopColor="#2563eb" stopOpacity={0}/></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f1f1" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 900, fill: '#bbb'}} />
                  <YAxis hide />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.05)', fontSize: '10px', fontWeight: '900' }} />
                  <Area type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={3} fill="url(#colorRev)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="space-y-3 md:space-y-4">
            {(props.orders || []).length === 0 ? (
              <div className="py-32 text-center opacity-20"><i className="fas fa-box-open text-5xl mb-4"></i><p className="text-[10px] font-black uppercase italic tracking-widest">No Manifests Detected</p></div>
            ) : props.orders.map((o: Order) => (
              <div key={o.id} onClick={() => setSelectedOrder(o)} className="bg-white p-5 md:p-7 rounded-[1.5rem] border border-gray-100 shadow-sm hover:shadow-lg transition-all cursor-pointer group flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div className="flex items-center space-x-5">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs border-2 ${o.status === 'Cancelled' ? 'bg-red-50 text-red-600 border-red-100' : o.status === 'Pending' ? 'bg-gray-50 text-gray-400 border-gray-100' : 'bg-green-50 text-green-600 border-green-100'}`}>{o.status.charAt(0)}</div>
                  <div>
                    <p className="font-black text-sm italic text-black uppercase tracking-tighter">#{o.id}</p>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{new Date(o.date).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="flex-grow grid grid-cols-2 gap-4 text-[10px] font-black uppercase">
                  <div><p className="text-gray-400 text-[8px] mb-0.5">Customer</p><p className="truncate max-w-[120px]">{o.customer.name}</p></div>
                  <div><p className="text-gray-400 text-[8px] mb-0.5">Total</p><p className="text-blue-600 italic">Rs. {o.total.toLocaleString()}</p></div>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest ${o.status === 'Delivered' ? 'bg-green-100 text-green-700' : o.status === 'Cancelled' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>{o.status}</span>
                  <i className="fas fa-chevron-right text-gray-200 hidden md:block"></i>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'products' && (
          <div className="space-y-6 md:space-y-8">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-black italic uppercase italic">Inventory Manifest</h2>
              <button onClick={() => setEditingProduct({ name: '', description: '', price: 0, image: '', images: [], category: 'Luxury', inventory: 10, variants: [] })} className="bg-black text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest italic">Add Product</button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {(props.products || []).map((p: Product) => (
                <div key={p.id} className="bg-white rounded-[1.5rem] border border-gray-100 overflow-hidden shadow-sm group hover:shadow-xl transition-all">
                  <div className="h-32 md:h-44 relative overflow-hidden">
                    <img src={p.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
                    <p className="absolute bottom-3 left-4 text-[9px] font-black text-white italic uppercase truncate w-[80%]">{p.name}</p>
                  </div>
                  <div className="p-4 md:p-5">
                    <div className="flex justify-between items-center mb-5">
                      <p className="text-xs font-black italic">Rs. {p.price.toLocaleString()}</p>
                      <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{p.inventory} PCS</span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setEditingProduct(p)} className="flex-grow bg-black text-white py-2.5 rounded-lg font-black uppercase text-[8px] tracking-widest italic">Edit</button>
                      <button onClick={() => { if(window.confirm('Erase Manifest?')) props.deleteProduct(p.id); }} className="bg-red-50 text-red-600 p-2.5 rounded-lg hover:bg-red-600 hover:text-white transition-colors"><i className="fas fa-trash text-[10px]"></i></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* MOBILE NAV */}
      <nav className="lg:hidden fixed bottom-6 left-6 right-6 bg-white/90 backdrop-blur-2xl border border-gray-100 h-16 rounded-2xl flex items-center justify-around z-[200] shadow-2xl">
        {['overview', 'orders', 'products'].map(t => (
          <button key={t} onClick={() => setActiveTab(t)} className={`p-4 transition-colors ${activeTab === t ? 'text-blue-600' : 'text-gray-300'}`}>
            <i className={`fas fa-${t === 'overview' ? 'chart-pie' : t === 'orders' ? 'list' : 'box'} text-lg`}></i>
          </button>
        ))}
      </nav>

      {/* ORDER DETAIL MODAL */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[300] flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white w-full max-w-4xl p-6 md:p-10 rounded-[2.5rem] relative shadow-2xl overflow-y-auto max-h-[90vh]">
            <button onClick={() => setSelectedOrder(null)} className="absolute top-6 right-6 text-gray-300 hover:text-black transition-colors"><i className="fas fa-times text-xl"></i></button>
            <h4 className="text-lg md:text-xl font-black italic uppercase mb-8">Manifest <span className="text-blue-600">#{selectedOrder.id}</span></h4>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12">
              <div className="space-y-4">
                <label className="text-[9px] font-black uppercase text-gray-400 block italic tracking-widest mb-4">Logistical Intel</label>
                {[['Name', selectedOrder.customer.name], ['Phone', selectedOrder.customer.phone], ['City', selectedOrder.customer.city || 'N/A']].map(([label, val]) => (
                  <div key={label} className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex items-center justify-between">
                    <div><span className="text-[7px] font-black uppercase text-gray-400 block mb-0.5">{label}</span><p className="text-xs font-black">{val}</p></div>
                    <button onClick={() => navigator.clipboard.writeText(val || '')} className="text-gray-300 hover:text-blue-600 p-2"><i className="fas fa-copy text-[10px]"></i></button>
                  </div>
                ))}
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 min-h-[80px]">
                  <span className="text-[7px] font-black uppercase text-gray-400 block mb-0.5">Full Address</span>
                  <p className="text-[10px] font-bold text-gray-600 leading-relaxed italic">{selectedOrder.customer.address}</p>
                </div>
              </div>
              <div className="space-y-8">
                <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
                  <label className="text-[9px] font-black uppercase text-gray-400 block mb-4 italic tracking-widest">Manifest Contents</label>
                  <div className="space-y-3">
                    {(selectedOrder.items || []).map((itm: any, i: number) => (
                      <div key={i} className="bg-white p-3 rounded-xl border border-gray-100 flex justify-between items-center">
                        <p className="text-[10px] font-black uppercase text-black truncate">{itm.product?.name || 'Item'}</p>
                        <span className="text-blue-600 font-black italic text-xs ml-4">x{itm.quantity}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 pt-4 border-t border-gray-200 flex justify-between items-center"><p className="text-[9px] font-black uppercase text-gray-400 tracking-widest">Total Due</p><p className="text-base font-black italic">Rs. {selectedOrder.total.toLocaleString()}</p></div>
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-4 block italic">Change Status</label>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                    {['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'].map(s => (
                      <button 
                        key={s}
                        disabled={isUpdatingStatus}
                        onClick={async () => {
                          setIsUpdatingStatus(true);
                          await props.updateStatus(selectedOrder.id, s, selectedOrder.dbId);
                          setIsUpdatingStatus(false);
                        }}
                        className={`py-3 rounded-xl font-black uppercase text-[7px] tracking-widest transition-all ${selectedOrder.status === s ? 'bg-black text-white shadow-xl scale-105' : 'bg-white text-gray-400 border border-gray-100 hover:border-black hover:text-black'}`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {editingProduct && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-3xl z-[300] flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white w-full max-w-xl p-8 md:p-10 rounded-[2.5rem] overflow-y-auto max-h-[90vh]">
            <h4 className="text-lg font-black italic uppercase mb-8">Product Manifest</h4>
            <div className="space-y-4">
              <div className="flex gap-4 overflow-x-auto py-2 no-scrollbar">
                <button onClick={() => fileInputRef.current?.click()} className="w-16 h-16 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center text-gray-300 hover:text-black transition shrink-0">
                  <i className={`fas ${isUploading ? 'fa-spinner fa-spin' : 'fa-plus'} mb-1`}></i>
                  <span className="text-[7px] font-black">MEDIA</span>
                </button>
                {(editingProduct.images || []).map((img: string, i: number) => (
                  <div key={i} className="w-16 h-16 rounded-xl overflow-hidden border border-gray-100 relative group shrink-0">
                    <img src={img} className="w-full h-full object-cover" />
                    <button onClick={() => {
                      const newImgs = editingProduct.images.filter((_:any, idx:number) => idx !== i);
                      setEditingProduct({...editingProduct, images: newImgs, image: newImgs[0] || ''});
                    }} className="absolute inset-0 bg-red-600/80 text-white opacity-0 group-hover:opacity-100 transition flex items-center justify-center"><i className="fas fa-trash text-[10px]"></i></button>
                  </div>
                ))}
                <input type="file" multiple ref={fileInputRef} className="hidden" onChange={async (e) => {
                  const files = e.target.files;
                  if (!files || files.length === 0) return;
                  setIsUploading(true);
                  const newImages = [...(editingProduct.images || [])];
                  for (let i = 0; i < files.length; i++) {
                    const url = await props.uploadMedia(files[i]);
                    if (url) {
                      newImages.push(url);
                      if (!editingProduct.image) editingProduct.image = url;
                    }
                  }
                  setEditingProduct({ ...editingProduct, images: newImages });
                  setIsUploading(false);
                }} accept="image/*" />
              </div>
              <input type="text" placeholder="Name" className="w-full p-4 bg-gray-50 rounded-xl font-bold outline-none text-xs" value={editingProduct.name} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} />
              <div className="grid grid-cols-2 gap-4">
                <input type="number" placeholder="Price (PKR)" className="w-full p-4 bg-gray-50 rounded-xl font-bold outline-none text-xs" value={editingProduct.price} onChange={e => setEditingProduct({...editingProduct, price: Number(e.target.value)})} />
                <input type="number" placeholder="Stock" className="w-full p-4 bg-gray-50 rounded-xl font-bold outline-none text-xs" value={editingProduct.inventory} onChange={e => setEditingProduct({...editingProduct, inventory: Number(e.target.value)})} />
              </div>
              <textarea placeholder="Description" className="w-full p-4 bg-gray-50 rounded-xl font-bold outline-none h-24 resize-none text-xs" value={editingProduct.description} onChange={e => setEditingProduct({...editingProduct, description: e.target.value})} />
            </div>
            <div className="flex gap-4 mt-10">
              <button onClick={() => setEditingProduct(null)} className="flex-grow bg-gray-50 text-gray-400 py-4 rounded-xl font-black uppercase text-[10px] italic">Discard</button>
              <button onClick={async () => { if(await props.saveProduct(editingProduct)) setEditingProduct(null); }} className="flex-grow bg-black text-white py-4 rounded-xl font-black uppercase text-[10px] shadow-xl italic tracking-widest">Store Manifest</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
