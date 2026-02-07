
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

  // Sync selected order if it updates in the background
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
    const todayCount = orders.filter((o: Order) => {
      const d = new Date(o.date);
      const today = new Date();
      return d.getDate() === today.getDate() && d.getMonth() === today.getMonth();
    }).length;

    const chartData = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const dateStr = d.toLocaleDateString('en-US', { weekday: 'short' });
      const dayOrders = orders.filter((o: Order) => {
        const od = new Date(o.date);
        return od.getDate() === d.getDate() && od.getMonth() === d.getMonth() && o.status !== 'Cancelled';
      });
      chartData.push({ 
        name: dateStr, 
        revenue: dayOrders.reduce((sum: number, o: Order) => sum + (Number(o.total) || 0), 0) 
      });
    }
    return { revenue, pendingCount, todayCount, chartData };
  }, [props.orders]);

  if (!props.user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-8 animate-fadeIn">
        <div className="w-full max-w-sm">
          <div className="mb-12 text-center">
            <div className="w-20 h-20 bg-blue-600 rounded-[2.5rem] mx-auto mb-6 flex items-center justify-center shadow-[0_0_50px_rgba(37,99,235,0.3)]">
              <i className="fas fa-lock text-white text-3xl"></i>
            </div>
            <h1 className="text-3xl font-black italic tracking-tighter text-white uppercase">ITX ADMIN</h1>
            <p className="text-[10px] font-black text-blue-500/50 uppercase tracking-[0.4em] mt-2">Authentication Required</p>
          </div>
          
          <div className="space-y-4">
            <input 
              type="password" 
              value={authKey} 
              onChange={e => setAuthKey(e.target.value)} 
              onKeyDown={e => e.key === 'Enter' && (authKey === props.systemPassword ? props.login(UserRole.ADMIN) : alert('Access Denied'))}
              placeholder="Admin Passkey" 
              className="w-full p-5 bg-white/5 border border-white/10 rounded-2xl text-white outline-none focus:ring-2 ring-blue-500 text-center font-black text-lg tracking-[0.5em] placeholder:tracking-normal placeholder:text-white/20" 
            />
            <button 
              onClick={() => { if (authKey === props.systemPassword) props.login(UserRole.ADMIN); else alert('Access Denied'); }} 
              className="w-full bg-blue-600 text-white p-5 rounded-2xl font-black uppercase text-xs tracking-widest active:scale-95 transition-all shadow-xl shadow-blue-600/20"
            >
              Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  const StatusBadge = ({ status }: { status: string }) => {
    const styles: any = {
      Pending: "bg-amber-500/10 text-amber-500 border-amber-500/20",
      Confirmed: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      Shipped: "bg-purple-500/10 text-purple-500 border-purple-500/20",
      Delivered: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
      Cancelled: "bg-red-500/10 text-red-500 border-red-500/20"
    };
    return (
      <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${styles[status] || styles.Pending}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-32 animate-fadeIn selection:bg-blue-500/30">
      {/* HEADER */}
      <header className="sticky top-0 z-[100] bg-black/60 backdrop-blur-xl border-b border-white/5 px-6 py-5 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-black text-[10px] italic text-white">ITX</div>
          <h2 className="text-sm font-black italic tracking-tighter uppercase">E-COMMERCE ADMIN</h2>
        </div>
        <div className="flex items-center space-x-4">
          <button onClick={() => props.refreshData()} className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center active:rotate-180 transition-transform duration-500">
            <i className="fas fa-sync-alt text-[10px]"></i>
          </button>
          <div className="w-10 h-10 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center" onClick={() => props.logout()}>
            <i className="fas fa-power-off text-[10px]"></i>
          </div>
        </div>
      </header>

      <main className="px-6 py-8">
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            <section>
              <p className="text-[10px] font-black uppercase text-white/30 tracking-[0.3em] mb-4">Store Overview</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/5 border border-white/10 p-6 rounded-[2rem]">
                  <p className="text-[8px] font-black text-blue-500 uppercase tracking-widest mb-2">Total Revenue</p>
                  <p className="text-xl font-black italic">Rs. {analytics.revenue.toLocaleString()}</p>
                </div>
                <div className="bg-white/5 border border-white/10 p-6 rounded-[2rem]">
                  <p className="text-[8px] font-black text-emerald-500 uppercase tracking-widest mb-2">Total Orders</p>
                  <p className="text-xl font-black italic">{props.orders.length}</p>
                </div>
              </div>
            </section>

            <section className="bg-white/5 border border-white/10 p-6 rounded-[2.5rem]">
              <div className="flex justify-between items-center mb-6">
                <p className="text-[10px] font-black uppercase text-white/30 tracking-[0.3em]">Sales Performance</p>
                <span className="text-[9px] font-black text-emerald-500 uppercase bg-emerald-500/10 px-2 py-1 rounded-md">+12.5%</span>
              </div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analytics.chartData}>
                    <defs>
                      <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={4} fill="url(#colorRev)" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#000', border: 'none', borderRadius: '15px', fontSize: '10px', fontWeight: '900' }}
                      itemStyle={{ color: '#fff' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section>
              <div className="flex justify-between items-center mb-4">
                <p className="text-[10px] font-black uppercase text-white/30 tracking-[0.3em]">Recent Orders</p>
                <button onClick={() => setActiveTab('orders')} className="text-[10px] font-black uppercase text-blue-500">View All</button>
              </div>
              <div className="space-y-3">
                {props.orders.slice(0, 3).map((o: Order) => (
                  <div key={o.id} onClick={() => setSelectedOrder(o)} className="bg-white/5 border border-white/10 p-5 rounded-3xl flex items-center justify-between active:scale-[0.98] transition-transform">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-white/5 rounded-2xl flex items-center justify-center font-black text-blue-500 text-[10px]">#{o.id.slice(-3)}</div>
                      <div>
                        <p className="text-xs font-black uppercase tracking-tight">{o.customer.name}</p>
                        <p className="text-[9px] text-white/40 font-black uppercase">{new Date(o.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    </div>
                    <p className="text-xs font-black italic">Rs. {o.total.toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* ORDERS TAB */}
        {activeTab === 'orders' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black italic uppercase tracking-tighter">Order Management</h3>
              <div className="bg-white/5 px-4 py-2 rounded-full border border-white/10 text-[9px] font-black uppercase tracking-widest">
                {props.orders.length} TOTAL
              </div>
            </div>
            
            {props.orders.map((o: Order) => (
              <div key={o.id} onClick={() => setSelectedOrder(o)} className="bg-white/5 border border-white/10 p-6 rounded-[2rem] space-y-4 active:scale-[0.98] transition-transform">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em] mb-1">ORDER #{o.id}</p>
                    <p className="text-sm font-black uppercase tracking-tight">{o.customer.name}</p>
                  </div>
                  <StatusBadge status={o.status} />
                </div>
                <div className="flex justify-between items-end pt-4 border-t border-white/5">
                   <div>
                      <p className="text-[8px] font-black text-white/30 uppercase tracking-widest mb-1">Location</p>
                      <p className="text-[10px] font-black uppercase text-white/60">{o.customer.city || 'N/A'}</p>
                   </div>
                   <p className="text-sm font-black italic text-white">Rs. {o.total.toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* PRODUCTS TAB */}
        {activeTab === 'products' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-black italic uppercase tracking-tighter">Product Catalog</h3>
              <button 
                onClick={() => setEditingProduct({ name: '', description: '', price: 0, image: '', images: [], category: 'Luxury', inventory: 10, variants: [] })}
                className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center shadow-lg shadow-blue-600/20"
              >
                <i className="fas fa-plus text-xs"></i>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {props.products.map((p: Product) => (
                <div key={p.id} className="bg-white/5 border border-white/10 rounded-[2rem] overflow-hidden group">
                  <div className="h-40 relative">
                    <img src={p.image} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent"></div>
                    <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest">
                       STOCK: {p.inventory}
                    </div>
                  </div>
                  <div className="p-4 space-y-3">
                    <p className="text-[10px] font-black uppercase truncate tracking-tight">{p.name}</p>
                    <div className="flex justify-between items-center">
                      <p className="text-[10px] font-black text-blue-500 italic">Rs. {p.price.toLocaleString()}</p>
                      <button onClick={() => setEditingProduct(p)} className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center">
                        <i className="fas fa-edit text-[8px]"></i>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* BOTTOM NAVIGATION */}
      <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-2xl border border-white/10 h-20 px-8 rounded-[2.5rem] flex items-center space-x-12 z-[200] shadow-2xl shadow-black">
        <button onClick={() => setActiveTab('overview')} className={`flex flex-col items-center space-y-1 ${activeTab === 'overview' ? 'text-blue-500' : 'text-white/30'}`}>
          <i className="fas fa-chart-line text-lg"></i>
          <span className="text-[7px] font-black uppercase tracking-widest">Dashboard</span>
        </button>
        <button onClick={() => setActiveTab('orders')} className={`flex flex-col items-center space-y-1 ${activeTab === 'orders' ? 'text-blue-500' : 'text-white/30'}`}>
          <i className="fas fa-shopping-bag text-lg"></i>
          <span className="text-[7px] font-black uppercase tracking-widest">Orders</span>
        </button>
        <button onClick={() => setActiveTab('products')} className={`flex flex-col items-center space-y-1 ${activeTab === 'products' ? 'text-blue-500' : 'text-white/30'}`}>
          <i className="fas fa-boxes text-lg"></i>
          <span className="text-[7px] font-black uppercase tracking-widest">Inventory</span>
        </button>
      </nav>

      {/* ORDER DETAIL ACTION SHEET */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[300] flex flex-col justify-end animate-fadeIn">
          <div className="absolute inset-0" onClick={() => setSelectedOrder(null)}></div>
          <div className="bg-[#0f0f0f] w-full rounded-t-[3rem] p-8 space-y-8 relative animate-slideInTop shadow-[0_-20px_50px_rgba(0,0,0,0.5)] border-t border-white/5 overflow-y-auto max-h-[90vh]">
            <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-2"></div>
            
            <div className="flex justify-between items-start">
               <div>
                  <h4 className="text-2xl font-black italic uppercase tracking-tighter">Order Details</h4>
                  <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em] mt-1">ID: {selectedOrder.id}</p>
               </div>
               <button onClick={() => setSelectedOrder(null)} className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center"><i className="fas fa-times"></i></button>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="bg-white/5 p-6 rounded-[2rem] border border-white/10">
                <p className="text-[8px] font-black text-white/20 uppercase tracking-[0.3em] mb-4">Customer Information</p>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase text-white/40">Name</span>
                    <span className="text-xs font-black">{selectedOrder.customer.name}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase text-white/40">Phone</span>
                    <a href={`tel:${selectedOrder.customer.phone}`} className="text-xs font-black text-blue-500 underline">{selectedOrder.customer.phone}</a>
                  </div>
                  <div className="pt-4 border-t border-white/5">
                     <span className="text-[8px] font-black uppercase text-white/20 block mb-2">Shipping Address</span>
                     <p className="text-[11px] font-medium leading-relaxed text-white/80">{selectedOrder.customer.address}, {selectedOrder.customer.city}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white/5 p-6 rounded-[2rem] border border-white/10">
                <p className="text-[8px] font-black text-white/20 uppercase tracking-[0.3em] mb-4">Order Summary</p>
                <div className="space-y-3">
                  {selectedOrder.items.map((item: any, i: number) => (
                    <div key={i} className="flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase truncate max-w-[200px]">{item.product.name}</span>
                      <span className="text-xs font-black italic">x{item.quantity}</span>
                    </div>
                  ))}
                  <div className="pt-4 mt-4 border-t border-white/5 flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase text-blue-500">Order Total</span>
                    <span className="text-lg font-black italic">Rs. {selectedOrder.total.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-[9px] font-black text-center uppercase text-white/20 tracking-widest">Update Order Status</p>
              <div className="grid grid-cols-2 gap-3">
                {['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'].map(s => (
                  <button 
                    key={s}
                    disabled={isUpdatingStatus}
                    onClick={async () => {
                      setIsUpdatingStatus(true);
                      await props.updateStatus(selectedOrder.id, s, selectedOrder.dbId);
                      setIsUpdatingStatus(false);
                    }}
                    className={`py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all ${selectedOrder.status === s ? 'bg-blue-600 text-white shadow-[0_0_30px_rgba(37,99,235,0.3)]' : 'bg-white/5 text-white/40 border border-white/5'}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            
            <button 
              onClick={() => {
                const text = `Name: ${selectedOrder.customer.name}\nPhone: ${selectedOrder.customer.phone}\nCity: ${selectedOrder.customer.city || 'N/A'}\nAddress: ${selectedOrder.customer.address}`;
                navigator.clipboard.writeText(text);
                alert('Customer Details Copied to Clipboard');
              }}
              className="w-full py-4 border border-white/10 rounded-2xl font-black uppercase text-[9px] tracking-[0.3em] text-white/40"
            >
              Copy Customer Details
            </button>
          </div>
        </div>
      )}

      {/* PRODUCT ACTION SHEET */}
      {editingProduct && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[300] flex flex-col justify-end animate-fadeIn">
          <div className="absolute inset-0" onClick={() => setEditingProduct(null)}></div>
          <div className="bg-[#0a0a0a] w-full rounded-t-[3rem] p-8 space-y-6 relative animate-slideInTop overflow-y-auto max-h-[90vh] border-t border-white/10">
            <div className="flex justify-between items-center mb-4">
               <h4 className="text-xl font-black italic uppercase tracking-tighter">{editingProduct.id ? 'Edit Product' : 'Add New Product'}</h4>
               <button onClick={() => setEditingProduct(null)} className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center"><i className="fas fa-times"></i></button>
            </div>

            <div className="space-y-5">
              <div className="flex space-x-4 overflow-x-auto py-2 no-scrollbar">
                <button onClick={() => fileInputRef.current?.click()} className="w-20 h-20 bg-white/5 border-2 border-dashed border-white/10 rounded-3xl flex flex-col items-center justify-center text-white/20 shrink-0">
                  <i className={`fas ${isUploading ? 'fa-spinner fa-spin' : 'fa-camera'} text-lg mb-1`}></i>
                  <span className="text-[7px] font-black uppercase">Photos</span>
                </button>
                {editingProduct.images?.map((img: string, i: number) => (
                  <div key={i} className="w-20 h-20 rounded-3xl overflow-hidden border border-white/10 shrink-0 relative group">
                    <img src={img} className="w-full h-full object-cover" />
                    <button onClick={() => setEditingProduct({...editingProduct, images: editingProduct.images.filter((_:any,idx:number)=>idx!==i)})} className="absolute inset-0 bg-red-500/80 opacity-0 group-hover:opacity-100 transition flex items-center justify-center"><i className="fas fa-trash"></i></button>
                  </div>
                ))}
                <input type="file" multiple ref={fileInputRef} className="hidden" onChange={async (e) => {
                  const files = e.target.files; if(!files) return;
                  setIsUploading(true);
                  const newImages = [...(editingProduct.images || [])];
                  for(let i=0; i<files.length; i++) {
                    const url = await props.uploadMedia(files[i]);
                    if(url) { newImages.push(url); if(!editingProduct.image) editingProduct.image = url; }
                  }
                  setEditingProduct({...editingProduct, images: newImages});
                  setIsUploading(false);
                }} />
              </div>

              <div className="space-y-4">
                <input type="text" placeholder="Product Name" className="w-full p-5 bg-white/5 rounded-2xl font-black outline-none text-xs border border-white/5" value={editingProduct.name} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} />
                <div className="grid grid-cols-2 gap-4">
                  <input type="number" placeholder="Price (PKR)" className="w-full p-5 bg-white/5 rounded-2xl font-black outline-none text-xs border border-white/5" value={editingProduct.price} onChange={e => setEditingProduct({...editingProduct, price: Number(e.target.value)})} />
                  <input type="number" placeholder="Inventory Quantity" className="w-full p-5 bg-white/5 rounded-2xl font-black outline-none text-xs border border-white/5" value={editingProduct.inventory} onChange={e => setEditingProduct({...editingProduct, inventory: Number(e.target.value)})} />
                </div>
                <textarea placeholder="Product Description" className="w-full p-5 bg-white/5 rounded-2xl font-black outline-none h-32 resize-none text-xs border border-white/5" value={editingProduct.description} onChange={e => setEditingProduct({...editingProduct, description: e.target.value})} />
              </div>

              <div className="flex gap-4 pt-6">
                 <button onClick={() => setEditingProduct(null)} className="flex-grow py-5 rounded-2xl font-black uppercase text-[10px] text-white/40 border border-white/10">Cancel</button>
                 <button onClick={async () => { if(await props.saveProduct(editingProduct)) setEditingProduct(null); }} className="flex-grow py-5 bg-blue-600 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-blue-600/20">Save Product</button>
              </div>
              
              {editingProduct.id && (
                <button onClick={() => { if(confirm('Permanently delete this product?')) props.deleteProduct(editingProduct.id); setEditingProduct(null); }} className="w-full py-4 text-red-500 font-black uppercase text-[8px] tracking-widest opacity-40 hover:opacity-100 transition-opacity">Delete Product</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
