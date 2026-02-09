
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line } from 'recharts';
import { UserRole, Order, Product, Variant } from '../types';

const AdminDashboard = (props: any) => {
  const [activeTab, setActiveTab] = useState('analytics');
  const [authKey, setAuthKey] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Search and Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

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

  // Number Formatter
  const formatCompactNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return num.toString();
  };

  const analytics = useMemo(() => {
    const orders = Array.isArray(props.orders) ? props.orders : [];
    const valid = orders.filter((o: Order) => o.status !== 'Cancelled');
    const revenue = valid.reduce((acc: number, o: Order) => acc + (Number(o.total) || 0), 0);
    const pendingCount = orders.filter((o: Order) => o.status === 'Pending').length;
    const totalCount = orders.length;

    const trendData = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthLabel = d.toLocaleString('en-US', { month: 'short' });
      const yearLabel = d.getFullYear().toString().slice(-2);
      
      const startOfMonth = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
      const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
      
      const monthOrders = orders.filter(o => {
        const od = new Date(o.date).getTime();
        return od >= startOfMonth && od <= endOfMonth && o.status !== 'Cancelled';
      });

      trendData.push({
        name: `${monthLabel} '${yearLabel}`,
        revenue: monthOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0),
        orders: monthOrders.length
      });
    }

    return { revenue, pendingCount, totalCount, trendData };
  }, [props.orders]);

  const filteredOrders = useMemo(() => {
    return props.orders.filter((o: Order) => {
      const matchesSearch = 
        o.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
        o.customer.name.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === 'All' || o.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [props.orders, searchQuery, statusFilter]);

  const StatusBadge = ({ status, minimal = false }: { status: string, minimal?: boolean }) => {
    const configs: any = {
      Pending: { style: "bg-amber-500/10 text-amber-500 border-amber-500/20", icon: "fa-clock", dot: "bg-amber-500" },
      Confirmed: { style: "bg-blue-500/10 text-blue-500 border-blue-500/20", icon: "fa-check-circle", dot: "bg-blue-500" },
      Shipped: { style: "bg-purple-500/10 text-purple-500 border-purple-500/20", icon: "fa-truck-fast", dot: "bg-purple-500" },
      Delivered: { style: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20", icon: "fa-box-check", dot: "bg-emerald-500" },
      Cancelled: { style: "bg-red-500/10 text-red-500 border-red-500/20", icon: "fa-times-circle", dot: "bg-red-500" }
    };
    const config = configs[status] || configs.Pending;
    if (minimal) return <span className={`w-2 h-2 rounded-full border border-white/10 ${config.dot} mr-2`}></span>;
    return (
      <span className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[7px] font-black uppercase tracking-[0.1em] border ${config.style}`}>
        <i className={`fas ${config.icon}`}></i>
        <span>{status}</span>
      </span>
    );
  };

  const handleMediaClick = () => {
    if (fileInputRef.current && !isUploading) {
      fileInputRef.current.click();
    }
  };

  const handleAddVariant = () => {
    const variants = editingProduct.variants || [];
    setEditingProduct({
      ...editingProduct,
      variants: [...variants, { id: `VAR-${Date.now()}`, name: '', price: editingProduct.price, inventory: editingProduct.inventory }]
    });
  };

  const handleUpdateVariant = (index: number, field: string, value: any) => {
    const variants = [...(editingProduct.variants || [])];
    variants[index] = { ...variants[index], [field]: value };
    setEditingProduct({ ...editingProduct, variants });
  };

  const handleRemoveVariant = (index: number) => {
    const variants = (editingProduct.variants || []).filter((_: any, i: number) => i !== index);
    setEditingProduct({ ...editingProduct, variants });
  };

  if (!props.user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-8 animate-fadeIn">
        <div className="w-full max-w-sm">
          <div className="mb-12 text-center">
            <div className="w-20 h-20 bg-blue-600 rounded-3xl mx-auto mb-6 flex items-center justify-center shadow-[0_0_50px_rgba(37,99,235,0.3)]">
              <i className="fas fa-lock text-white text-3xl"></i>
            </div>
            <h1 className="text-3xl font-black italic tracking-tighter text-white uppercase">Merchant Login</h1>
            <p className="text-[10px] font-black text-blue-500/50 uppercase tracking-[0.4em] mt-2">Authentication Required</p>
          </div>
          
          <div className="space-y-4">
            <input 
              type="password" 
              value={authKey} 
              onChange={e => setAuthKey(e.target.value)} 
              onKeyDown={e => e.key === 'Enter' && (authKey === props.systemPassword ? props.login(UserRole.ADMIN) : alert('Incorrect Access Key'))}
              placeholder="Store Secret Key" 
              className="w-full p-5 bg-white/5 border border-white/10 rounded-2xl text-white outline-none focus:ring-2 ring-blue-500 text-center font-black text-lg tracking-[0.5em] placeholder:tracking-normal placeholder:text-white/20" 
            />
            <button 
              onClick={() => { if (authKey === props.systemPassword) props.login(UserRole.ADMIN); else alert('Incorrect Access Key'); }} 
              className="w-full bg-blue-600 text-white p-5 rounded-2xl font-black uppercase text-xs tracking-widest active:scale-95 transition-all shadow-xl"
            >
              Access Store Console
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-32 animate-fadeIn selection:bg-blue-500/30">
      {/* GLOBAL NOTIFICATIONS */}
      <div className="fixed top-24 left-0 right-0 z-[500] px-6 pointer-events-none flex flex-col items-center space-y-3">
        {props.toasts?.map((toast: any) => (
          <div key={toast.id} className="pointer-events-auto bg-blue-600 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center space-x-4 animate-slideInTop border border-white/10 max-w-md w-full">
            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
              <i className="fas fa-shopping-cart text-xs"></i>
            </div>
            <div className="flex-grow">
              <p className="text-[10px] font-black uppercase tracking-widest italic">{toast.message}</p>
              {toast.orderId && <p className="text-[8px] text-white/50 font-black mt-0.5">Order ID: #{toast.orderId}</p>}
            </div>
            <button onClick={() => { setActiveTab('orders'); setSelectedOrder(props.orders.find((o:any)=>o.id===toast.orderId)); }} className="bg-white/10 px-3 py-1.5 rounded-lg text-[8px] font-black uppercase hover:bg-white/20">Manage</button>
          </div>
        ))}
      </div>

      {/* NAVIGATION BAR */}
      <header className="sticky top-0 z-[100] bg-black/60 backdrop-blur-xl border-b border-white/5 px-6 py-5 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-black text-[10px] italic text-white">ITX</div>
          <h2 className="text-sm font-black italic tracking-tighter uppercase">Merchant Admin</h2>
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

      <main className="px-4 py-6 md:px-6">
        {/* DASHBOARD TAB - ANALYTICS */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <section className="flex flex-col md:flex-row md:justify-between md:items-center space-y-4 md:space-y-0 px-2">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                    <h3 className="text-sm font-black italic uppercase tracking-tighter">Store Performance</h3>
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse ring-4 ring-emerald-500/20"></div>
                </div>
                <button 
                  onClick={props.audioEnabled ? props.disableAudio : props.enableAudio} 
                  className={`flex items-center space-x-1.5 px-3 py-1 border rounded-full transition-all ${props.audioEnabled ? 'bg-blue-600/10 border-blue-500/20 text-blue-500' : 'bg-white/5 border-white/10 text-white/20'}`}
                >
                    <i className={`fas ${props.audioEnabled ? 'fa-volume-up' : 'fa-volume-mute'} text-[8px]`}></i>
                    <span className="text-[7px] font-black uppercase tracking-widest">{props.audioEnabled ? 'Alerts Active' : 'Silent Mode'}</span>
                </button>
              </div>
            </section>

            {/* KPI CARDS */}
            <section>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-white/5 border border-white/10 p-5 rounded-3xl">
                  <p className="text-[6px] font-black text-blue-500 uppercase tracking-widest mb-1">Gross Revenue</p>
                  <p className="text-sm font-black italic">Rs.{formatCompactNumber(analytics.revenue)}</p>
                </div>
                <div className="bg-white/5 border border-white/10 p-5 rounded-3xl">
                  <p className="text-[6px] font-black text-emerald-500 uppercase tracking-widest mb-1">Total Orders</p>
                  <p className="text-sm font-black italic">{analytics.totalCount}</p>
                </div>
                <div className="bg-white/5 border border-white/10 p-5 rounded-3xl">
                  <p className="text-[6px] font-black text-amber-500 uppercase tracking-widest mb-1">Pending Orders</p>
                  <p className="text-sm font-black italic">{analytics.pendingCount}</p>
                </div>
              </div>
            </section>

            {/* SALES TREND CHART */}
            <section className="bg-white/5 border border-white/10 p-6 rounded-[2.5rem]">
              <p className="text-[10px] font-black uppercase text-white/30 tracking-[0.2em] mb-8">Sales Trends</p>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analytics.trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#ffffff20', fontSize: 8, fontWeight: 900 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#ffffff20', fontSize: 8, fontWeight: 900 }} tickFormatter={(val) => `Rs.${formatCompactNumber(val)}`} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f0f0f', border: '1px solid #ffffff10', borderRadius: '20px' }} />
                    <Line type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={5} dot={{ r: 0 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section>
              <div className="flex justify-between items-center mb-4 px-2">
                <p className="text-[10px] font-black uppercase text-white/30 tracking-[0.3em]">Recent Transactions</p>
                <button onClick={() => setActiveTab('orders')} className="text-[9px] font-black uppercase text-blue-500 underline">View Full History</button>
              </div>
              <div className="space-y-3">
                {props.orders.slice(0, 5).map((o: Order) => (
                  <div key={o.id} onClick={() => { setActiveTab('orders'); setSelectedOrder(o); }} className="bg-white/5 border border-white/10 p-5 rounded-[1.8rem] flex items-center justify-between active:scale-[0.98] transition-transform">
                    <div className="flex items-center space-x-4 overflow-hidden">
                      <div className="w-10 h-10 bg-white/5 rounded-2xl flex items-center justify-center font-black text-blue-500 text-[9px] shrink-0">#{o.id.slice(-4)}</div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-black uppercase truncate">{o.customer.name}</p>
                        <div className="flex items-center mt-0.5"><StatusBadge status={o.status} minimal /><p className="text-[9px] text-white/30 font-black uppercase tracking-wider">{o.status}</p></div>
                      </div>
                    </div>
                    <p className="text-[11px] font-black italic shrink-0">Rs. {o.total.toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* ORDERS TAB */}
        {activeTab === 'orders' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="flex justify-between items-center px-2 mb-6">
              <h3 className="text-xl font-black italic uppercase tracking-tighter">Order History</h3>
              <div className="relative w-48">
                 <input 
                    type="text" 
                    placeholder="Search orders..." 
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-4 py-2 text-[10px] outline-none"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                 />
                 <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-white/20 text-[9px]"></i>
              </div>
            </div>
            
            {filteredOrders.length > 0 ? (
              filteredOrders.map((o: Order) => (
                <div key={o.id} onClick={() => setSelectedOrder(o)} className="bg-white/5 border border-white/10 p-6 rounded-[2rem] space-y-5 active:scale-[0.98] transition-transform">
                  <div className="flex justify-between items-start">
                    <div className="min-w-0 pr-4">
                      <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1.5">Record ID: {o.id}</p>
                      <p className="text-sm font-black uppercase truncate">{o.customer.name}</p>
                    </div>
                    <StatusBadge status={o.status} />
                  </div>
                  <div className="flex justify-between items-end pt-5 border-t border-white/5">
                    <div><p className="text-[8px] font-black text-white/20 uppercase tracking-widest mb-1">Customer Location</p><p className="text-[10px] font-black uppercase text-white/50">{o.customer.city || 'Standard Area'}</p></div>
                    <p className="text-sm font-black italic text-white">Rs. {o.total.toLocaleString()}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-24 text-center">
                <i className="fas fa-search text-white/5 text-5xl mb-6"></i>
                <p className="text-[11px] font-black text-white/20 uppercase tracking-[0.4em]">Zero Search Results</p>
              </div>
            )}
          </div>
        )}

        {/* PRODUCTS TAB */}
        {activeTab === 'products' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex justify-between items-center px-2">
              <h3 className="text-xl font-black italic uppercase tracking-tighter">Product Catalog</h3>
              <button onClick={() => setEditingProduct({ name: '', description: '', price: 0, image: '', images: [], category: 'Luxury', inventory: 10, variants: [] })} className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-600/30 active:scale-95 transition-all">
                <i className="fas fa-plus text-sm"></i>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {props.products.map((p: Product) => (
                <div key={p.id} className="bg-white/5 border border-white/10 rounded-[2.2rem] overflow-hidden group">
                  <div className="h-40 relative">
                    <img src={p.image || 'https://via.placeholder.com/400'} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
                    <div className={`absolute bottom-3 left-3 px-3 py-1 backdrop-blur-md rounded-xl text-[8px] font-black uppercase tracking-widest border border-white/10 ${p.inventory <= 0 ? 'bg-red-600 text-white' : 'bg-black/40 text-white/80'}`}>
                        {p.inventory <= 0 ? 'Out of Stock' : `Inventory: ${p.inventory}`}
                    </div>
                  </div>
                  <div className="p-4 space-y-3">
                    <p className="text-[10px] font-black uppercase truncate tracking-tight">{p.name}</p>
                    <div className="flex justify-between items-center">
                      <p className="text-[10px] font-black text-blue-500 italic">Rs. {p.price.toLocaleString()}</p>
                      <button onClick={() => setEditingProduct(p)} className="w-9 h-9 bg-white/5 rounded-xl flex items-center justify-center border border-white/5 active:bg-white/10"><i className="fas fa-edit text-[10px]"></i></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* FOOTER NAVIGATION */}
      <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-2xl border border-white/10 h-18 px-8 rounded-full flex items-center space-x-12 z-[200] shadow-2xl shadow-black max-w-[95vw]">
        <button onClick={() => setActiveTab('analytics')} className={`flex flex-col items-center space-y-1.5 transition-colors ${activeTab === 'analytics' ? 'text-blue-500' : 'text-white/20'}`}>
          <i className="fas fa-chart-line text-lg"></i>
          <span className="text-[7px] font-black uppercase tracking-widest">Performance</span>
        </button>
        <button onClick={() => setActiveTab('orders')} className={`flex flex-col items-center space-y-1.5 transition-colors ${activeTab === 'orders' ? 'text-blue-500' : 'text-white/20'}`}>
          <i className="fas fa-shopping-bag text-lg"></i>
          <span className="text-[7px] font-black uppercase tracking-widest">Orders</span>
        </button>
        <button onClick={() => setActiveTab('products')} className={`flex flex-col items-center space-y-1.5 transition-colors ${activeTab === 'products' ? 'text-blue-500' : 'text-white/20'}`}>
          <i className="fas fa-boxes text-lg"></i>
          <span className="text-[7px] font-black uppercase tracking-widest">Inventory</span>
        </button>
      </nav>

      {/* ORDER DETAILS MODAL */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[600] flex flex-col justify-end animate-fadeIn">
          <div className="absolute inset-0" onClick={() => setSelectedOrder(null)}></div>
          <div className="bg-[#0f0f0f] w-full rounded-t-[3rem] p-8 space-y-8 relative animate-slideInTop shadow-2xl border-t border-white/10 overflow-y-auto max-h-[98vh] custom-scrollbar">
            <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-2"></div>
            <div className="flex justify-between items-start">
               <div className="min-w-0 pr-8">
                  <h4 className="text-2xl font-black italic uppercase tracking-tighter">Order Summary</h4>
                  <p className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] mt-1 truncate">Transaction ID: #{selectedOrder.id}</p>
               </div>
               <button onClick={() => setSelectedOrder(null)} className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center border border-white/10 shrink-0"><i className="fas fa-times text-sm"></i></button>
            </div>
            <div className="space-y-6">
              <div className="bg-white/5 p-6 rounded-[2.5rem] border border-white/10 space-y-5">
                <div className="flex justify-between items-center mb-2"><p className="text-[8px] font-black text-white/30 uppercase tracking-[0.2em]">Customer Information</p><StatusBadge status={selectedOrder.status} /></div>
                {[{ label: 'Full Name', value: selectedOrder.customer.name }, { label: 'Contact Number', value: selectedOrder.customer.phone, isPhone: true }, { label: 'Shipping City', value: selectedOrder.customer.city || 'N/A' }].map((field, idx) => (
                  <div key={idx} className="flex justify-between items-center">
                    <div className="flex flex-col min-w-0 pr-4"><span className="text-[9px] font-black uppercase text-white/20">{field.label}</span>{field.isPhone ? <a href={`tel:${field.value}`} className="text-sm font-black text-blue-500 underline truncate">{field.value}</a> : <span className="text-sm font-black truncate">{field.value}</span>}</div>
                    <button onClick={() => { navigator.clipboard.writeText(field.value); }} className="w-8 h-8 bg-blue-600/20 text-blue-500 rounded-xl flex items-center justify-center shrink-0 border border-blue-500/10 active:bg-blue-600 active:text-white transition-all"><i className="fas fa-copy text-[10px]"></i></button>
                  </div>
                ))}
                <div className="pt-5 border-t border-white/5">
                  <span className="text-[8px] font-black uppercase text-white/20 block mb-1.5">Shipping Address Details</span>
                  <p className="text-xs font-medium leading-relaxed text-white/80">{selectedOrder.customer.address}</p>
                </div>
              </div>
              <div className="bg-white/5 p-6 rounded-[2.5rem] border border-white/10 space-y-5">
                <p className="text-[8px] font-black text-white/30 uppercase tracking-[0.2em]">Items Manifest</p>
                <div className="space-y-4">
                  {selectedOrder.items.map((item: any, i: number) => (
                    <div key={i} className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-white/5 rounded-2xl overflow-hidden border border-white/10 shrink-0"><img src={item.product?.image} className="w-full h-full object-cover" /></div>
                      <div className="flex-grow min-w-0">
                        <div className="flex justify-between items-start"><span className="text-[10px] font-black uppercase truncate pr-2">{item.product?.name}</span><span className="text-[10px] font-black italic text-blue-500">Rs. {(item.product?.price * item.quantity).toLocaleString()}</span></div>
                        <div className="flex justify-between items-center mt-1"><span className="text-[8px] font-black text-white/30 uppercase tracking-widest">{item.variantName || 'Standard Edition'}</span><span className="text-[10px] font-black text-white/60">Qty: {item.quantity}</span></div>
                      </div>
                    </div>
                  ))}
                  <div className="pt-5 mt-2 border-t border-white/5 flex justify-between items-center"><span className="text-[10px] font-black uppercase text-blue-400">Grand Total</span><span className="text-xl font-black italic">Rs. {selectedOrder.total.toLocaleString()}</span></div>
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-[9px] font-black text-center uppercase text-white/20 tracking-[0.3em]">Update Order Status</p>
                <div className="grid grid-cols-2 gap-2 pb-10">
                  {['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'].map(s => (
                    <button key={s} disabled={isUpdatingStatus} onClick={async () => { setIsUpdatingStatus(true); await props.updateStatus(selectedOrder.id, s, selectedOrder.dbId); setIsUpdatingStatus(false); }} className={`py-4 rounded-2xl font-black uppercase text-[9px] tracking-widest transition-all border ${selectedOrder.status === s ? 'bg-blue-600 text-white border-blue-500' : 'bg-white/5 text-white/30 border-white/5'}`}>{s}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PRODUCT EDITOR MODAL */}
      {editingProduct && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl z-[600] flex flex-col justify-end animate-fadeIn">
          <div className="absolute inset-0" onClick={() => setEditingProduct(null)}></div>
          <div className="bg-[#0a0a0a] w-full rounded-t-[3rem] p-8 space-y-8 relative animate-slideInTop overflow-y-auto max-h-[95vh] border-t border-white/10 custom-scrollbar">
            <div className="flex justify-between items-center"><h4 className="text-xl font-black italic uppercase tracking-tighter">{editingProduct.id ? 'Edit Product Details' : 'Add New Product'}</h4><button onClick={() => setEditingProduct(null)} className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center border border-white/5 shrink-0"><i className="fas fa-times text-sm"></i></button></div>
            <div className="space-y-6">
              <div className="flex space-x-4 overflow-x-auto py-2 no-scrollbar">
                {/* Product Image Gallery Management */}
                <button 
                  type="button" 
                  onClick={handleMediaClick} 
                  disabled={isUploading}
                  className="w-20 h-20 bg-white/5 border border-dashed border-white/10 rounded-3xl flex flex-col items-center justify-center text-white/20 shrink-0 active:scale-95 transition-all hover:bg-white/10 disabled:opacity-50"
                >
                  <i className={`fas ${isUploading ? 'fa-spinner fa-spin' : 'fa-camera'} text-lg mb-1`}></i>
                  <span className="text-[7px] font-black uppercase">Add Images</span>
                </button>
                {editingProduct.images?.map((img: string, i: number) => (
                  <div key={i} className="w-20 h-20 rounded-3xl overflow-hidden border border-white/10 shrink-0 relative group">
                    <img src={img} className="w-full h-full object-cover" />
                    <button onClick={() => setEditingProduct({...editingProduct, images: editingProduct.images.filter((_:any,idx:number)=>idx!==i)})} className="absolute inset-0 bg-red-600/80 opacity-0 group-hover:opacity-100 transition flex items-center justify-center"><i className="fas fa-trash text-sm"></i></button>
                  </div>
                ))}
                {/* Hidden File Input supporting multiple files */}
                <input 
                  type="file" 
                  multiple 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*" 
                  onChange={async (e) => {
                    const files = e.target.files; 
                    if(!files || files.length === 0) return;
                    setIsUploading(true);
                    
                    const uploadResults = [];
                    for(let i=0; i<files.length; i++) { 
                      const url = await props.uploadMedia(files[i]); 
                      if(url) uploadResults.push(url); 
                    }
                    
                    if (uploadResults.length > 0) {
                      const updatedImages = [...(editingProduct.images || []), ...uploadResults];
                      setEditingProduct({ 
                        ...editingProduct, 
                        images: updatedImages, 
                        image: editingProduct.image || uploadResults[0] 
                      });
                    }
                    
                    setIsUploading(false);
                    if (e.target) e.target.value = '';
                  }} 
                />
              </div>

              <div className="space-y-4 pb-20">
                <div className="space-y-1.5"><label className="text-[9px] font-black uppercase text-white/30 ml-3">Product Title</label><input type="text" className="w-full p-5 bg-white/5 rounded-2xl font-black outline-none text-[12px] border border-white/5" value={editingProduct.name} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} /></div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5"><label className="text-[9px] font-black uppercase text-white/30 ml-3">Base Retail Price (PKR)</label><input type="number" className="w-full p-5 bg-white/5 rounded-2xl font-black outline-none text-[12px] border border-white/5" value={editingProduct.price} onChange={e => setEditingProduct({...editingProduct, price: Number(e.target.value)})} /></div>
                  <div className="space-y-1.5"><label className="text-[9px] font-black uppercase text-white/30 ml-3">Inventory Level</label><input type="number" className="w-full p-5 bg-white/5 rounded-2xl font-black outline-none text-[12px] border border-white/5" value={editingProduct.inventory} onChange={e => setEditingProduct({...editingProduct, inventory: Number(e.target.value)})} /></div>
                </div>
                
                <div className="space-y-1.5"><label className="text-[9px] font-black uppercase text-white/30 ml-3">Collection Category</label><input type="text" className="w-full p-5 bg-white/5 rounded-2xl font-black outline-none text-[12px] border border-white/5" value={editingProduct.category} onChange={e => setEditingProduct({...editingProduct, category: e.target.value})} /></div>
                <div className="space-y-1.5"><label className="text-[9px] font-black uppercase text-white/30 ml-3">Product Description</label><textarea className="w-full p-5 bg-white/5 rounded-2xl font-black outline-none h-32 resize-none text-[12px] border border-white/5" value={editingProduct.description} onChange={e => setEditingProduct({...editingProduct, description: e.target.value})} /></div>
                
                {/* Variant Configuration Management */}
                <div className="space-y-4 border-t border-white/10 pt-6">
                  <div className="flex justify-between items-center">
                    <h5 className="text-[10px] font-black uppercase tracking-widest italic text-blue-500">Variants & Options</h5>
                    <button type="button" onClick={handleAddVariant} className="bg-blue-600 px-4 py-1.5 rounded-xl text-[8px] font-black uppercase text-white shadow-lg active:scale-95 transition-all">+ Add Option</button>
                  </div>
                  
                  <div className="space-y-3">
                    {(editingProduct.variants || []).map((v: Variant, idx: number) => (
                      <div key={v.id || idx} className="bg-white/5 p-4 rounded-[1.5rem] border border-white/5 space-y-3 animate-fadeIn">
                        <div className="flex justify-between items-center">
                          <input 
                            type="text" 
                            placeholder="e.g. XL Size, Premium Leather" 
                            className="bg-transparent font-black text-[10px] outline-none w-full mr-4 text-white placeholder:text-white/20"
                            value={v.name}
                            onChange={(e) => handleUpdateVariant(idx, 'name', e.target.value)}
                          />
                          <button onClick={() => handleRemoveVariant(idx)} className="text-red-500 active:scale-125 transition-transform"><i className="fas fa-trash text-[10px]"></i></button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[7px] font-black uppercase text-white/20">Retail Price (PKR)</label>
                            <input type="number" className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-[10px] font-black outline-none" value={v.price} onChange={(e) => handleUpdateVariant(idx, 'price', Number(e.target.value))} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[7px] font-black uppercase text-white/20">Variant Stock</label>
                            <input type="number" className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-[10px] font-black outline-none" value={v.inventory || 0} onChange={(e) => handleUpdateVariant(idx, 'inventory', Number(e.target.value))} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-4 pt-10 pb-20">
                  <button onClick={() => setEditingProduct(null)} className="flex-grow py-5 rounded-2xl font-black uppercase text-[10px] text-white/40 border border-white/10 active:bg-white/5 transition-colors">Discard</button>
                  <button onClick={async () => { if(await props.saveProduct(editingProduct)) setEditingProduct(null); }} className="flex-grow py-5 bg-blue-600 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-2xl shadow-blue-600/30 active:scale-95 transition-all">Publish Product</button>
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
