
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

  // Advanced Filtering State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState({ start: '', end: '' });
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);

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

  const filteredOrders = useMemo(() => {
    return props.orders.filter((o: Order) => {
      const matchesSearch = 
        o.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
        o.customer.name.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === 'All' || o.status === statusFilter;
      
      let matchesDate = true;
      if (dateFilter.start || dateFilter.end) {
        const orderDate = new Date(o.date).getTime();
        if (dateFilter.start) {
          const start = new Date(dateFilter.start).getTime();
          if (orderDate < start) matchesDate = false;
        }
        if (dateFilter.end) {
          const end = new Date(dateFilter.end).setHours(23, 59, 59, 999);
          if (orderDate > end) matchesDate = false;
        }
      }
      
      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [props.orders, searchQuery, statusFilter, dateFilter]);

  const StatusBadge = ({ status, minimal = false }: { status: string, minimal?: boolean }) => {
    const configs: any = {
      Pending: {
        style: "bg-amber-500/10 text-amber-500 border-amber-500/20",
        icon: "fa-clock",
        dot: "bg-amber-500"
      },
      Confirmed: {
        style: "bg-blue-500/10 text-blue-500 border-blue-500/20",
        icon: "fa-check-circle",
        dot: "bg-blue-500"
      },
      Shipped: {
        style: "bg-purple-500/10 text-purple-500 border-purple-500/20",
        icon: "fa-truck-fast",
        dot: "bg-purple-500"
      },
      Delivered: {
        style: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
        icon: "fa-box-check",
        dot: "bg-emerald-500"
      },
      Cancelled: {
        style: "bg-red-500/10 text-red-500 border-red-500/20",
        icon: "fa-times-circle",
        dot: "bg-red-500"
      }
    };
    
    const config = configs[status] || configs.Pending;
    
    if (minimal) {
        return <span className={`w-2 h-2 rounded-full border border-white/10 ${config.dot} mr-2`}></span>;
    }

    return (
      <span className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[7px] font-black uppercase tracking-[0.1em] border ${config.style}`}>
        <i className={`fas ${config.icon}`}></i>
        <span>{status}</span>
      </span>
    );
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    const toast = document.createElement('div');
    toast.className = 'fixed bottom-24 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest z-[1000] animate-fadeIn shadow-2xl';
    toast.innerText = `${label} COPIED`;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('opacity-0');
      setTimeout(() => document.body.removeChild(toast), 300);
    }, 2000);
  };

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

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-32 animate-fadeIn selection:bg-blue-500/30">
      {/* HEADER */}
      <header className="sticky top-0 z-[100] bg-black/60 backdrop-blur-xl border-b border-white/5 px-6 py-5 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-black text-[10px] italic text-white">ITX</div>
          <h2 className="text-sm font-black italic tracking-tighter uppercase">ADMIN PANEL</h2>
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
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <section>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/5 border border-white/10 p-5 rounded-[2rem]">
                  <p className="text-[7px] font-black text-blue-500 uppercase tracking-widest mb-1">Total Sales</p>
                  <p className="text-lg font-black italic">Rs. {analytics.revenue.toLocaleString()}</p>
                </div>
                <div className="bg-white/5 border border-white/10 p-5 rounded-[2rem]">
                  <p className="text-[7px] font-black text-emerald-500 uppercase tracking-widest mb-1">Total Orders</p>
                  <p className="text-lg font-black italic">{props.orders.length}</p>
                </div>
              </div>
            </section>

            <section className="bg-white/5 border border-white/10 p-5 rounded-[2rem]">
              <div className="flex justify-between items-center mb-6">
                <p className="text-[10px] font-black uppercase text-white/30 tracking-[0.2em]">Live Trends</p>
                <span className="text-[8px] font-black text-emerald-500 uppercase bg-emerald-500/10 px-2 py-1 rounded-md">Realtime</span>
              </div>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analytics.chartData}>
                    <defs>
                      <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={3} fill="url(#colorRev)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section>
              <div className="flex justify-between items-center mb-4 px-2">
                <p className="text-[9px] font-black uppercase text-white/30 tracking-[0.3em]">Quick Look</p>
                <button onClick={() => setActiveTab('orders')} className="text-[9px] font-black uppercase text-blue-500 underline">Browse All</button>
              </div>
              <div className="space-y-2">
                {props.orders.slice(0, 5).map((o: Order) => (
                  <div key={o.id} onClick={() => setSelectedOrder(o)} className="bg-white/5 border border-white/10 p-4 rounded-2xl flex items-center justify-between active:scale-[0.98] transition-transform">
                    <div className="flex items-center space-x-3 overflow-hidden">
                      <div className="w-9 h-9 bg-white/5 rounded-xl flex items-center justify-center font-black text-blue-500 text-[8px] shrink-0 border border-white/5">#{o.id.slice(-4)}</div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase truncate tracking-tight">{o.customer.name}</p>
                        <div className="flex items-center mt-0.5">
                            <StatusBadge status={o.status} minimal />
                            <p className="text-[8px] text-white/30 font-black uppercase tracking-wider">{o.status}</p>
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                        <p className="text-[10px] font-black italic">Rs. {o.total.toLocaleString()}</p>
                        <p className="text-[7px] text-white/20 uppercase font-black">{new Date(o.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* ORDERS TAB */}
        {activeTab === 'orders' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="flex flex-col space-y-4 mb-6">
              <div className="flex justify-between items-center px-2">
                <h3 className="text-lg font-black italic uppercase tracking-tighter">Orders Pipeline</h3>
                <div className="flex items-center space-x-2">
                  <button 
                    onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)}
                    className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all ${isFilterPanelOpen ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white/5 border-white/10 text-white/40'}`}
                  >
                    <i className="fas fa-filter text-[10px]"></i>
                  </button>
                  <div className="bg-blue-600/10 px-3 py-1.5 rounded-full border border-blue-600/20 text-[8px] font-black uppercase text-blue-500 tracking-widest">
                    {filteredOrders.length} RESULTS
                  </div>
                </div>
              </div>

              {/* SEARCH & FILTER CONTROLS */}
              <div className="px-2 space-y-3">
                <div className="relative">
                  <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-white/20 text-[10px]"></i>
                  <input 
                    type="text" 
                    placeholder="Search Order ID or Customer Name..." 
                    className="w-full bg-white/5 border border-white/10 rounded-2xl pl-10 pr-4 py-3.5 font-black text-[10px] outline-none focus:border-blue-500/50 transition-all placeholder:text-white/10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                {isFilterPanelOpen && (
                  <div className="bg-white/5 border border-white/10 p-5 rounded-[2rem] space-y-5 animate-fadeIn">
                    <div className="space-y-3">
                      <p className="text-[7px] font-black text-white/20 uppercase tracking-[0.4em]">Status Filter</p>
                      <div className="flex flex-wrap gap-2">
                        {['All', 'Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'].map(status => (
                          <button 
                            key={status}
                            onClick={() => setStatusFilter(status)}
                            className={`px-4 py-2 rounded-xl text-[8px] font-black uppercase transition-all border ${statusFilter === status ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white/5 border-white/10 text-white/30'}`}
                          >
                            {status}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <p className="text-[7px] font-black text-white/20 uppercase tracking-[0.4em]">Date Range</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[6px] font-black uppercase text-white/10 ml-2">From</label>
                          <input 
                            type="date" 
                            className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-[10px] text-white/60 outline-none"
                            value={dateFilter.start}
                            onChange={(e) => setDateFilter({...dateFilter, start: e.target.value})}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[6px] font-black uppercase text-white/10 ml-2">To</label>
                          <input 
                            type="date" 
                            className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-[10px] text-white/60 outline-none"
                            value={dateFilter.end}
                            onChange={(e) => setDateFilter({...dateFilter, end: e.target.value})}
                          />
                        </div>
                      </div>
                    </div>

                    <button 
                      onClick={() => {
                        setSearchQuery('');
                        setStatusFilter('All');
                        setDateFilter({ start: '', end: '' });
                      }}
                      className="w-full py-3 bg-white/5 text-[8px] font-black uppercase text-white/20 hover:text-white transition-colors"
                    >
                      Reset All Filters
                    </button>
                  </div>
                )}
              </div>
            </div>
            
            {filteredOrders.length > 0 ? (
              filteredOrders.map((o: Order) => (
                <div key={o.id} onClick={() => setSelectedOrder(o)} className="bg-white/5 border border-white/10 p-5 rounded-[1.8rem] space-y-4 active:scale-[0.98] transition-transform">
                  <div className="flex justify-between items-start">
                    <div className="min-w-0">
                      <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest mb-1">ID: {o.id}</p>
                      <p className="text-xs font-black uppercase truncate pr-4">{o.customer.name}</p>
                    </div>
                    <StatusBadge status={o.status} />
                  </div>
                  <div className="flex justify-between items-end pt-3 border-t border-white/5">
                    <div>
                        <p className="text-[7px] font-black text-white/20 uppercase tracking-widest mb-0.5">Destination</p>
                        <p className="text-[9px] font-black uppercase text-white/50">{o.customer.city || 'Not Provided'}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[7px] font-black text-white/20 uppercase tracking-widest mb-0.5">Settlement</p>
                        <p className="text-xs font-black italic text-white">Rs. {o.total.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-20 text-center">
                <i className="fas fa-search text-white/5 text-4xl mb-4"></i>
                <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">No matching orders found</p>
              </div>
            )}
          </div>
        )}

        {/* PRODUCTS TAB */}
        {activeTab === 'products' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex justify-between items-center px-2">
              <h3 className="text-lg font-black italic uppercase tracking-tighter">Stock Management</h3>
              <button 
                onClick={() => setEditingProduct({ name: '', description: '', price: 0, image: '', images: [], category: 'Luxury', inventory: 10, variants: [] })}
                className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center shadow-lg shadow-blue-600/20"
              >
                <i className="fas fa-plus text-xs"></i>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {props.products.map((p: Product) => (
                <div key={p.id} className="bg-white/5 border border-white/10 rounded-[1.8rem] overflow-hidden group">
                  <div className="h-32 relative">
                    <img src={p.image} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
                    <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/40 backdrop-blur-md rounded-md text-[7px] font-black uppercase tracking-widest border border-white/10">
                       INV: {p.inventory}
                    </div>
                  </div>
                  <div className="p-3 space-y-2">
                    <p className="text-[9px] font-black uppercase truncate tracking-tight h-4">{p.name}</p>
                    <div className="flex justify-between items-center">
                      <p className="text-[9px] font-black text-blue-500 italic">Rs. {p.price.toLocaleString()}</p>
                      <button onClick={() => setEditingProduct(p)} className="w-7 h-7 bg-white/5 rounded-lg flex items-center justify-center border border-white/5">
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

      {/* BOTTOM NAVIGATION - COMPACT FOR MOBILE */}
      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-2xl border border-white/10 h-16 px-6 rounded-full flex items-center space-x-10 z-[200] shadow-2xl shadow-black max-w-[90vw]">
        <button onClick={() => setActiveTab('overview')} className={`flex flex-col items-center space-y-1 transition-colors ${activeTab === 'overview' ? 'text-blue-500' : 'text-white/20'}`}>
          <i className="fas fa-chart-line text-base"></i>
          <span className="text-[6px] font-black uppercase tracking-widest">Dash</span>
        </button>
        <button onClick={() => setActiveTab('orders')} className={`flex flex-col items-center space-y-1 transition-colors ${activeTab === 'orders' ? 'text-blue-500' : 'text-white/20'}`}>
          <i className="fas fa-shopping-bag text-base"></i>
          <span className="text-[6px] font-black uppercase tracking-widest">Orders</span>
        </button>
        <button onClick={() => setActiveTab('products')} className={`flex flex-col items-center space-y-1 transition-colors ${activeTab === 'products' ? 'text-blue-500' : 'text-white/20'}`}>
          <i className="fas fa-boxes text-base"></i>
          <span className="text-[6px] font-black uppercase tracking-widest">Stock</span>
        </button>
      </nav>

      {/* ORDER DETAIL ACTION SHEET - MOBILE OPTIMIZED */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[300] flex flex-col justify-end animate-fadeIn">
          <div className="absolute inset-0" onClick={() => setSelectedOrder(null)}></div>
          <div className="bg-[#0f0f0f] w-full rounded-t-[2.5rem] p-6 space-y-6 relative animate-slideInTop shadow-[0_-15px_40px_rgba(0,0,0,0.6)] border-t border-white/10 overflow-y-auto max-h-[95vh] custom-scrollbar">
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-2"></div>
            
            <div className="flex justify-between items-start">
               <div className="min-w-0">
                  <h4 className="text-xl font-black italic uppercase tracking-tighter">Order Summary</h4>
                  <p className="text-[8px] font-black text-white/30 uppercase tracking-[0.2em] mt-0.5 truncate pr-4">ID: {selectedOrder.id}</p>
               </div>
               <button onClick={() => setSelectedOrder(null)} className="w-8 h-8 bg-white/5 rounded-full flex items-center justify-center shrink-0 border border-white/10"><i className="fas fa-times text-xs"></i></button>
            </div>

            <div className="space-y-4">
              <div className="bg-white/5 p-5 rounded-3xl border border-white/10">
                <div className="flex justify-between items-center mb-4">
                  <p className="text-[7px] font-black text-white/30 uppercase tracking-[0.2em]">Shipment Details</p>
                  <StatusBadge status={selectedOrder.status} />
                </div>
                <div className="space-y-4">
                  {[
                    { label: 'Name', value: selectedOrder.customer.name, copyLabel: 'NAME' },
                    { label: 'Phone', value: selectedOrder.customer.phone, copyLabel: 'PHONE', isPhone: true },
                    { label: 'City', value: selectedOrder.customer.city || 'Not Set', copyLabel: 'CITY' }
                  ].map((field, idx) => (
                    <div key={idx} className="flex justify-between items-center">
                        <div className="flex flex-col min-w-0 pr-4">
                          <span className="text-[8px] font-black uppercase text-white/20">{field.label}</span>
                          {field.isPhone ? (
                             <a href={`tel:${field.value}`} className="text-[11px] font-black text-blue-500 underline truncate">{field.value}</a>
                          ) : (
                             <span className="text-[11px] font-black truncate">{field.value}</span>
                          )}
                        </div>
                        <button onClick={() => copyToClipboard(field.value, field.copyLabel)} className="w-7 h-7 bg-blue-600/20 text-blue-500 rounded-lg flex items-center justify-center transition-all hover:bg-blue-600 hover:text-white border border-blue-500/20 shrink-0">
                          <i className="fas fa-copy text-[9px]"></i>
                        </button>
                    </div>
                  ))}
                  <div className="pt-4 border-t border-white/5 flex justify-between items-start">
                     <div className="flex-grow min-w-0">
                        <span className="text-[7px] font-black uppercase text-white/20 block mb-1">Address</span>
                        <p className="text-[10px] font-medium leading-relaxed text-white/80 pr-3">{selectedOrder.customer.address}</p>
                     </div>
                     <button onClick={() => copyToClipboard(selectedOrder.customer.address, 'ADDRESS')} className="w-7 h-7 bg-blue-600/20 text-blue-500 rounded-lg flex items-center justify-center hover:bg-blue-600 hover:text-white border border-blue-500/20 shrink-0 mt-1">
                       <i className="fas fa-copy text-[9px]"></i>
                     </button>
                  </div>
                </div>
              </div>

              <div className="bg-white/5 p-5 rounded-3xl border border-white/10">
                <p className="text-[7px] font-black text-white/30 uppercase tracking-[0.2em] mb-4">Manifest</p>
                <div className="space-y-4">
                  {selectedOrder.items.map((item: any, i: number) => (
                    <div key={i} className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-white/5 rounded-xl overflow-hidden border border-white/10 shrink-0">
                        <img src={item.product?.image || item.product?.image_url} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-grow min-w-0">
                        <div className="flex justify-between items-start">
                          <span className="text-[9px] font-black uppercase truncate pr-2">{item.product?.name}</span>
                          <span className="text-[9px] font-black italic text-blue-500 whitespace-nowrap">Rs. {(item.product?.price * item.quantity).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center mt-0.5">
                          <span className="text-[7px] font-black text-white/30 uppercase tracking-widest">{item.variantName || 'Base'}</span>
                          <span className="text-[9px] font-black text-white/60">x{item.quantity}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="pt-4 mt-2 border-t border-white/5 flex justify-between items-center">
                    <span className="text-[9px] font-black uppercase text-blue-400">Total Settlement</span>
                    <span className="text-base font-black italic">Rs. {selectedOrder.total.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <p className="text-[8px] font-black text-center uppercase text-white/20 tracking-[0.3em]">Logistics Update</p>
              <div className="grid grid-cols-2 gap-2">
                {['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'].map(s => {
                  const configs: any = {
                    Pending: "hover:bg-amber-500/20 text-amber-500 border-amber-500/10",
                    Confirmed: "hover:bg-blue-500/20 text-blue-500 border-blue-500/10",
                    Shipped: "hover:bg-purple-500/20 text-purple-500 border-purple-500/10",
                    Delivered: "hover:bg-emerald-500/20 text-emerald-500 border-emerald-500/10",
                    Cancelled: "hover:bg-red-500/20 text-red-500 border-red-500/10"
                  };
                  const activeConfigs: any = {
                    Pending: "bg-amber-500 text-white shadow-amber-500/30",
                    Confirmed: "bg-blue-500 text-white shadow-blue-500/30",
                    Shipped: "bg-purple-500 text-white shadow-purple-500/30",
                    Delivered: "bg-emerald-500 text-white shadow-emerald-500/30",
                    Cancelled: "bg-red-500 text-white shadow-red-500/30"
                  };
                  
                  return (
                    <button 
                      key={s}
                      disabled={isUpdatingStatus}
                      onClick={async () => {
                        setIsUpdatingStatus(true);
                        await props.updateStatus(selectedOrder.id, s, selectedOrder.dbId);
                        setIsUpdatingStatus(false);
                      }}
                      className={`py-3.5 rounded-xl font-black uppercase text-[8px] tracking-widest transition-all border ${selectedOrder.status === s ? activeConfigs[s] + ' shadow-lg scale-95' : configs[s] + ' bg-white/5 opacity-50'}`}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>
            
            <button 
              onClick={() => {
                const text = `Name: ${selectedOrder.customer.name}\nPhone: ${selectedOrder.customer.phone}\nCity: ${selectedOrder.customer.city || 'N/A'}\nAddress: ${selectedOrder.customer.address}`;
                copyToClipboard(text, 'MANIFEST');
              }}
              className="w-full py-4 border border-white/5 bg-white/[0.02] rounded-2xl font-black uppercase text-[8px] tracking-[0.4em] text-white/20 active:text-white active:bg-white/10 transition-all"
            >
              Export Full Package Info
            </button>
          </div>
        </div>
      )}

      {/* PRODUCT ACTION SHEET - MOBILE OPTIMIZED */}
      {editingProduct && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[300] flex flex-col justify-end animate-fadeIn">
          <div className="absolute inset-0" onClick={() => setEditingProduct(null)}></div>
          <div className="bg-[#0a0a0a] w-full rounded-t-[2.5rem] p-6 space-y-6 relative animate-slideInTop overflow-y-auto max-h-[90vh] border-t border-white/10 custom-scrollbar">
            <div className="flex justify-between items-center mb-2">
               <h4 className="text-lg font-black italic uppercase tracking-tighter">{editingProduct.id ? 'Edit Item' : 'New Arrival'}</h4>
               <button onClick={() => setEditingProduct(null)} className="w-9 h-9 bg-white/5 rounded-full flex items-center justify-center border border-white/5"><i className="fas fa-times text-xs"></i></button>
            </div>

            <div className="space-y-4">
              <div className="flex space-x-3 overflow-x-auto py-2 no-scrollbar">
                <button onClick={() => fileInputRef.current?.click()} className="w-16 h-16 bg-white/5 border border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center text-white/20 shrink-0">
                  <i className={`fas ${isUploading ? 'fa-spinner fa-spin' : 'fa-camera'} text-sm mb-1`}></i>
                  <span className="text-[6px] font-black uppercase">Add Media</span>
                </button>
                {editingProduct.images?.map((img: string, i: number) => (
                  <div key={i} className="w-16 h-16 rounded-2xl overflow-hidden border border-white/10 shrink-0 relative group">
                    <img src={img} className="w-full h-full object-cover" />
                    <button onClick={() => setEditingProduct({...editingProduct, images: editingProduct.images.filter((_:any,idx:number)=>idx!==i)})} className="absolute inset-0 bg-red-600/80 opacity-0 group-hover:opacity-100 transition flex items-center justify-center"><i className="fas fa-trash text-[10px]"></i></button>
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

              <div className="space-y-3">
                <div className="space-y-1">
                   <label className="text-[7px] font-black uppercase text-white/30 ml-2">Label</label>
                   <input type="text" placeholder="Watch Model Name" className="w-full p-4 bg-white/5 rounded-xl font-black outline-none text-[10px] border border-white/5" value={editingProduct.name} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[7px] font-black uppercase text-white/30 ml-2">Price (PKR)</label>
                    <input type="number" className="w-full p-4 bg-white/5 rounded-xl font-black outline-none text-[10px] border border-white/5" value={editingProduct.price} onChange={e => setEditingProduct({...editingProduct, price: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[7px] font-black uppercase text-white/30 ml-2">Inventory</label>
                    <input type="number" className="w-full p-4 bg-white/5 rounded-xl font-black outline-none text-[10px] border border-white/5" value={editingProduct.inventory} onChange={e => setEditingProduct({...editingProduct, inventory: Number(e.target.value)})} />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[7px] font-black uppercase text-white/30 ml-2">Manifest</label>
                  <textarea placeholder="Technical specifications..." className="w-full p-4 bg-white/5 rounded-xl font-black outline-none h-28 resize-none text-[10px] border border-white/5" value={editingProduct.description} onChange={e => setEditingProduct({...editingProduct, description: e.target.value})} />
                </div>
              </div>

              <div className="flex gap-3 pt-4 pb-8">
                 <button onClick={() => setEditingProduct(null)} className="flex-grow py-4 rounded-xl font-black uppercase text-[9px] text-white/40 border border-white/10 active:bg-white/5">Abort</button>
                 <button onClick={async () => { if(await props.saveProduct(editingProduct)) setEditingProduct(null); }} className="flex-grow py-4 bg-blue-600 rounded-xl font-black uppercase text-[9px] tracking-widest shadow-xl shadow-blue-600/20 active:scale-95 transition-transform">Commit Update</button>
              </div>
              
              {editingProduct.id && (
                <button onClick={() => { if(confirm('Permanently decommission this item?')) props.deleteProduct(editingProduct.id); setEditingProduct(null); }} className="w-full py-4 text-red-500 font-black uppercase text-[7px] tracking-widest opacity-30 hover:opacity-100 transition-opacity">Decommission Product</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
