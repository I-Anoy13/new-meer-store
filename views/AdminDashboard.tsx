
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

  // Helper to get status color classes
  const getStatusClasses = (status: string) => {
    switch (status) {
      case 'Confirmed':
      case 'Delivered':
        return 'bg-green-50 text-green-600 border-green-100';
      case 'Shipped':
        return 'bg-blue-50 text-blue-600 border-blue-100';
      case 'Cancelled':
        return 'bg-red-50 text-red-600 border-red-100';
      case 'Pending':
      default:
        return 'bg-gray-50 text-gray-400 border-gray-100';
    }
  };

  const getBadgeClasses = (status: string) => {
    switch (status) {
      case 'Confirmed':
      case 'Delivered':
        return 'bg-green-100 text-green-700';
      case 'Shipped':
        return 'bg-blue-100 text-blue-700';
      case 'Cancelled':
        return 'bg-red-100 text-red-700';
      case 'Pending':
      default:
        return 'bg-blue-100 text-blue-700';
    }
  };

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
    if (!text) return;
    navigator.clipboard.writeText(text);
    alert('Copied: ' + text);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !editingProduct) return;
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
  };

  const handleStatusChange = async (orderId: string, newStatus: string, dbId: any) => {
    if (isUpdatingStatus) return;
    setIsUpdatingStatus(true);
    try {
      // First update the local state for immediate feedback
      if (selectedOrder) {
        setSelectedOrder({ ...selectedOrder, status: newStatus as any });
      }
      // Then trigger the async update in the parent
      await props.updateStatus(orderId, newStatus, dbId);
    } catch (e) {
      alert("Failed to update status on server. Please try again.");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  if (!props.user) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6">
        <div className="bg-white p-8 md:p-12 rounded-[2.5rem] md:rounded-[3rem] shadow-2xl w-full max-w-sm text-center animate-fadeIn">
          <h1 className="text-2xl md:text-3xl font-black italic tracking-tighter uppercase mb-2 text-black">ITX MASTER</h1>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-8">Access Terminal</p>
          <input type="password" value={authKey} onChange={e => setAuthKey(e.target.value)} placeholder="Passkey" className="w-full p-4 border border-gray-100 rounded-2xl bg-gray-50 mb-4 outline-none focus:ring-2 ring-black text-center font-bold" />
          <button onClick={() => { if (authKey === props.systemPassword) props.login(UserRole.ADMIN); else alert('Access Denied'); }} className="w-full bg-black text-white p-4 rounded-2xl font-black uppercase text-xs tracking-widest active:scale-95 transition shadow-xl">Connect</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9fb] text-black pb-32">
      <header className="sticky top-0 z-[150] bg-white/80 backdrop-blur-3xl border-b border-gray-100 h-16 md:h-20 flex items-center justify-between px-4 md:px-12">
        <div className="flex items-center space-x-6 md:space-x-12">
          <h2 className="text-base md:text-xl font-black italic tracking-tighter uppercase">ITX MASTER</h2>
          <nav className="hidden lg:flex space-x-8 text-[11px] font-black uppercase tracking-widest">
            {['overview', 'orders', 'products'].map(t => (
              <button key={t} onClick={() => setActiveTab(t)} className={activeTab === t ? 'text-blue-600' : 'text-gray-400 hover:text-black transition'}>{t}</button>
            ))}
          </nav>
        </div>
        <div className="flex space-x-2 md:space-x-4">
           <button onClick={() => props.refreshData()} className="bg-black text-white p-2 md:p-3 rounded-full shadow-lg"><i className="fas fa-sync-alt text-[10px] md:text-xs"></i></button>
           <button onClick={() => props.logout()} className="bg-red-50 text-red-600 p-2 md:p-3 rounded-full"><i className="fas fa-power-off text-[10px] md:text-xs"></i></button>
        </div>
      </header>

      <main className="p-4 md:p-12 max-w-7xl mx-auto">
        {activeTab === 'overview' && (
          <div className="space-y-6 md:space-y-8 animate-fadeIn">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              {[
                { label: 'Revenue', val: `Rs. ${analytics.revenue.toLocaleString()}`, icon: 'fa-wallet' },
                { label: 'Manifests', val: props.orders.length, icon: 'fa-file-invoice' },
                { label: 'Successful', val: analytics.deliveredCount, icon: 'fa-check-circle' },
                { label: 'Awaiting', val: analytics.pendingCount, icon: 'fa-clock' }
              ].map((s, i) => (
                <div key={i} className="bg-white p-5 md:p-8 rounded-[1.5rem] md:rounded-[2rem] border border-gray-100 shadow-sm">
                  <div className="w-8 h-8 md:w-10 md:h-10 bg-gray-50 rounded-lg md:rounded-xl flex items-center justify-center text-gray-400 mb-3 md:mb-4"><i className={`fas ${s.icon} text-[10px] md:text-xs`}></i></div>
                  <p className="text-[8px] md:text-[9px] font-black text-gray-400 uppercase tracking-widest">{s.label}</p>
                  <p className="text-sm md:text-xl font-black italic text-black break-words">{s.val}</p>
                </div>
              ))}
            </div>
            <div className="bg-white p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] border border-gray-100 h-[300px] md:h-[400px]">
              <h3 className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-gray-400 mb-6 md:mb-8 italic">Revenue Growth</h3>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analytics.chartData}>
                  <defs><linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/><stop offset="95%" stopColor="#2563eb" stopOpacity={0}/></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f1f1" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 8, fontWeight: 900, fill: '#999'}} />
                  <YAxis hide />
                  <Tooltip contentStyle={{ borderRadius: '15px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.05)', fontSize: '10px' }} />
                  <Area type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={3} fill="url(#colorRev)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="space-y-3 md:space-y-4 animate-fadeIn">
            {props.orders.map((o: Order) => (
              <div key={o.id} onClick={() => setSelectedOrder(o)} className="bg-white p-5 md:p-8 rounded-[1.5rem] md:rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer group">
                <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                  <div className="flex items-center space-x-4 md:space-x-6">
                    <div className={`w-10 h-10 md:w-12 md:h-12 rounded-lg md:rounded-xl flex items-center justify-center font-black text-xs md:text-sm border-2 ${getStatusClasses(o.status)}`}>{o.status.charAt(0)}</div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-black text-sm md:text-base italic text-black">#{o.id}</p>
                        <span className={`md:hidden px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-tighter ${getBadgeClasses(o.status)}`}>{o.status}</span>
                      </div>
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{new Date(o.date).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex-grow grid grid-cols-2 md:grid-cols-2 gap-4 text-[10px] md:text-[11px] font-black uppercase">
                    <div>
                      <p className="text-gray-400 text-[8px] mb-0.5 md:mb-1">Customer</p>
                      <p className="truncate">{o.customer.name}</p>
                      <p className="text-gray-400 font-bold">{o.customer.phone}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-[8px] mb-0.5 md:mb-1">Total Due</p>
                      <p className="text-blue-600">Rs. {o.total.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="hidden md:flex items-center gap-4">
                    <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${getBadgeClasses(o.status)}`}>{o.status}</span>
                    <i className="fas fa-chevron-right text-gray-200"></i>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'products' && (
          <div className="space-y-6 md:space-y-8 animate-fadeIn">
            <div className="flex justify-between items-center">
              <h2 className="text-lg md:text-xl font-black italic uppercase">Inventory</h2>
              <button onClick={() => setEditingProduct({ name: '', description: '', price: 0, image: '', images: [], category: 'Luxury', inventory: 10, variants: [] })} className="bg-black text-white px-5 md:px-8 py-2 md:py-3 rounded-xl md:rounded-2xl font-black uppercase text-[8px] md:text-[10px] tracking-widest">Add Product</button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
              {props.products.map((p: Product) => (
                <div key={p.id} className="bg-white rounded-[1.5rem] md:rounded-[2.5rem] border border-gray-100 overflow-hidden shadow-sm group">
                  <div className="h-32 md:h-48 relative">
                    <img src={p.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                    <div className="absolute bottom-2 md:bottom-4 left-3 md:left-6"><p className="text-[8px] md:text-[10px] font-black text-white italic uppercase truncate max-w-[100px]">{p.name}</p></div>
                  </div>
                  <div className="p-4 md:p-6">
                    <div className="flex flex-col md:flex-row justify-between md:items-center mb-4 md:mb-6 gap-1 md:gap-0">
                      <p className="text-xs md:text-base font-black italic">Rs. {p.price.toLocaleString()}</p>
                      <span className="text-[8px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest">{p.inventory} PCS</span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setEditingProduct(p)} className="flex-grow bg-black text-white py-2 md:py-3 rounded-lg md:rounded-xl font-black uppercase text-[8px] md:text-[9px]">Edit</button>
                      <button onClick={() => { if(window.confirm('Delete?')) props.deleteProduct(p.id); }} className="bg-red-50 text-red-600 p-2 md:p-3 rounded-lg md:rounded-xl"><i className="fas fa-trash text-[10px]"></i></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* MOBILE NAV */}
      <nav className="lg:hidden fixed bottom-4 left-4 right-4 bg-white/90 backdrop-blur-2xl border border-gray-100 h-16 rounded-2xl flex items-center justify-around z-[200] shadow-2xl">
        {['overview', 'orders', 'products'].map(t => (
          <button key={t} onClick={() => setActiveTab(t)} className={`p-4 transition-colors ${activeTab === t ? 'text-blue-600' : 'text-gray-300'}`}>
            <i className={`fas fa-${t === 'overview' ? 'chart-pie' : t === 'orders' ? 'list' : 'box'} text-lg`}></i>
          </button>
        ))}
      </nav>

      {/* ORDER DETAIL MODAL */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[300] flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white w-full max-w-4xl p-6 md:p-12 rounded-[2rem] md:rounded-[3rem] relative shadow-2xl overflow-y-auto max-h-[90vh]">
            <button onClick={() => setSelectedOrder(null)} className="absolute top-6 right-6 md:top-8 md:right-8 text-gray-300 hover:text-black transition-colors"><i className="fas fa-times text-xl md:text-2xl"></i></button>
            <h4 className="text-lg md:text-2xl font-black italic uppercase mb-8 md:mb-10">Manifest <span className="text-blue-600">#{selectedOrder.id}</span></h4>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12">
              <div className="space-y-6 md:space-y-8">
                {/* Customer Info Section */}
                <div>
                  <label className="text-[9px] md:text-[10px] font-black uppercase text-gray-400 block mb-3 md:mb-4 italic tracking-widest">Customer Details</label>
                  <div className="space-y-3 md:space-y-4">
                    {/* Name */}
                    <div className="bg-gray-50 p-3 md:p-4 rounded-xl md:rounded-2xl border border-gray-100 flex items-center justify-between">
                      <div className="min-w-0 flex-grow">
                        <span className="text-[7px] md:text-[8px] font-black uppercase text-gray-400 block mb-0.5 md:mb-1">Full Name</span>
                        <p className="text-xs md:text-sm font-black text-black truncate">{selectedOrder.customer.name}</p>
                      </div>
                      <button onClick={() => copyToClipboard(selectedOrder.customer.name)} className="bg-white text-gray-300 p-2 md:p-2.5 rounded-lg md:rounded-xl hover:text-blue-600 shadow-sm transition-all shrink-0 ml-3 md:ml-4"><i className="fas fa-copy text-[10px]"></i></button>
                    </div>

                    {/* Phone */}
                    <div className="bg-gray-50 p-3 md:p-4 rounded-xl md:rounded-2xl border border-gray-100 flex items-center justify-between">
                      <div className="min-w-0 flex-grow">
                        <span className="text-[7px] md:text-[8px] font-black uppercase text-gray-400 block mb-0.5 md:mb-1">Phone Number</span>
                        <p className="text-xs md:text-sm font-black text-blue-600 truncate">{selectedOrder.customer.phone}</p>
                      </div>
                      <button onClick={() => copyToClipboard(selectedOrder.customer.phone)} className="bg-white text-gray-300 p-2 md:p-2.5 rounded-lg md:rounded-xl hover:text-blue-600 shadow-sm transition-all shrink-0 ml-3 md:ml-4"><i className="fas fa-copy text-[10px]"></i></button>
                    </div>

                    {/* City */}
                    <div className="bg-gray-50 p-3 md:p-4 rounded-xl md:rounded-2xl border border-gray-100 flex items-center justify-between">
                      <div className="min-w-0 flex-grow">
                        <span className="text-[7px] md:text-[8px] font-black uppercase text-gray-400 block mb-0.5 md:mb-1">City</span>
                        <p className="text-xs md:text-sm font-black text-black uppercase truncate">{selectedOrder.customer.city || 'N/A'}</p>
                      </div>
                      <button onClick={() => copyToClipboard(selectedOrder.customer.city || '')} className="bg-white text-gray-300 p-2 md:p-2.5 rounded-lg md:rounded-xl hover:text-blue-600 shadow-sm transition-all shrink-0 ml-3 md:ml-4"><i className="fas fa-copy text-[10px]"></i></button>
                    </div>

                    {/* Address */}
                    <div className="bg-gray-50 p-3 md:p-4 rounded-xl md:rounded-2xl border border-gray-100 flex items-start justify-between">
                      <div className="min-w-0 flex-grow">
                        <span className="text-[7px] md:text-[8px] font-black uppercase text-gray-400 block mb-0.5 md:mb-1">Shipping Address</span>
                        <p className="text-[10px] md:text-xs font-bold text-gray-600 leading-relaxed italic">{selectedOrder.customer.address}</p>
                      </div>
                      <button onClick={() => copyToClipboard(selectedOrder.customer.address)} className="bg-white text-gray-300 p-2 md:p-2.5 rounded-lg md:rounded-xl hover:text-blue-600 shadow-sm transition-all shrink-0 ml-3 md:ml-4"><i className="fas fa-copy text-[10px]"></i></button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6 md:space-y-8">
                {/* Order Summary Section */}
                <div className="bg-gray-50 p-6 md:p-8 rounded-[1.5rem] md:rounded-[2.5rem] border border-gray-100">
                  <label className="text-[9px] md:text-[10px] font-black uppercase text-gray-400 block mb-4 md:mb-6 italic tracking-widest">Ordered Items</label>
                  <div className="space-y-3 md:space-y-4">
                    {selectedOrder.items.map((itm: any, i: number) => (
                      <div key={i} className="bg-white p-4 md:p-5 rounded-xl md:rounded-2xl border border-gray-100 flex justify-between items-center shadow-sm">
                        <div className="min-w-0">
                          <p className="text-[10px] md:text-[11px] font-black uppercase text-black truncate">{itm.product?.name || 'Item'}</p>
                          {itm.variantName && (
                            <span className="text-[7px] md:text-[8px] font-black uppercase text-blue-500 tracking-widest block mt-0.5 md:mt-1">Variant: {itm.variantName}</span>
                          )}
                        </div>
                        <span className="text-blue-600 font-black italic ml-3 md:ml-4 shrink-0 text-xs md:text-sm">x{itm.quantity}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 md:mt-8 pt-4 md:pt-6 border-t border-gray-200 flex justify-between items-center">
                    <p className="text-[9px] md:text-[10px] font-black uppercase text-gray-400 tracking-widest">Total Payable</p>
                    <p className="text-base md:text-xl font-black italic text-black">Rs. {selectedOrder.total.toLocaleString()}</p>
                  </div>
                </div>

                {/* Status Update Grid */}
                <div>
                  <label className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4 md:mb-6 block italic">Update Status</label>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 md:gap-3">
                    {['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'].map(s => {
                      const isActive = selectedOrder.status === s;
                      let activeStyle = 'bg-black text-white';
                      if (isActive && (s === 'Confirmed' || s === 'Delivered')) activeStyle = 'bg-green-600 text-white shadow-lg shadow-green-100';
                      if (isActive && s === 'Cancelled') activeStyle = 'bg-red-600 text-white shadow-lg shadow-red-100';
                      if (isActive && s === 'Shipped') activeStyle = 'bg-blue-600 text-white shadow-lg shadow-blue-100';

                      return (
                        <button 
                          key={s}
                          disabled={isUpdatingStatus}
                          onClick={() => handleStatusChange(selectedOrder.id, s, selectedOrder.dbId)}
                          className={`py-3 md:py-4 rounded-xl md:rounded-2xl font-black uppercase text-[7px] md:text-[8px] tracking-widest transition-all ${isActive ? `${activeStyle} scale-105 z-10` : 'bg-white text-gray-400 border border-gray-100 hover:border-black hover:text-black'}`}
                        >
                          {isUpdatingStatus && isActive ? <i className="fas fa-circle-notch fa-spin"></i> : s}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PRODUCT MANIFEST MODAL */}
      {editingProduct && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-3xl z-[300] flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white w-full max-w-xl p-6 md:p-12 rounded-[2rem] md:rounded-[3rem] overflow-y-auto max-h-[90vh]">
            <h4 className="text-lg md:text-2xl font-black italic uppercase mb-8 md:mb-10">Product Manifest</h4>
            <div className="space-y-4 md:space-y-5">
              <div className="flex gap-4 overflow-x-auto py-2 no-scrollbar">
                <button onClick={() => fileInputRef.current?.click()} className="w-16 h-16 md:w-20 md:h-20 border-2 border-dashed border-gray-200 rounded-xl md:rounded-2xl flex flex-col items-center justify-center text-gray-300 hover:text-black hover:border-black transition shrink-0">
                  {isUploading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-plus mb-1"></i>}
                  <span className="text-[7px] md:text-[8px] font-black">MEDIA</span>
                </button>
                {editingProduct.images?.map((img: string, i: number) => (
                  <div key={i} className="w-16 h-16 md:w-20 md:h-20 rounded-xl md:rounded-2xl overflow-hidden border border-gray-100 relative group shrink-0">
                    <img src={img} className="w-full h-full object-cover" />
                    <button onClick={() => {
                      const newImgs = editingProduct.images.filter((_:any, idx:number) => idx !== i);
                      setEditingProduct({...editingProduct, images: newImgs, image: newImgs[0] || ''});
                    }} className="absolute inset-0 bg-red-600/80 text-white opacity-0 group-hover:opacity-100 transition flex items-center justify-center"><i className="fas fa-trash text-xs"></i></button>
                  </div>
                ))}
                <input type="file" multiple ref={fileInputRef} className="hidden" onChange={handleFileUpload} accept="image/*" />
              </div>
              <input type="text" placeholder="Product Name" className="w-full p-3 md:p-4 bg-gray-50 rounded-xl md:rounded-2xl font-bold outline-none text-xs md:text-sm" value={editingProduct.name} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} />
              <div className="grid grid-cols-2 gap-3 md:gap-4">
                <input type="number" placeholder="Price (PKR)" className="w-full p-3 md:p-4 bg-gray-50 rounded-xl md:rounded-2xl font-bold outline-none text-xs md:text-sm" value={editingProduct.price} onChange={e => setEditingProduct({...editingProduct, price: Number(e.target.value)})} />
                <input type="number" placeholder="Inventory" className="w-full p-3 md:p-4 bg-gray-50 rounded-xl md:rounded-2xl font-bold outline-none text-xs md:text-sm" value={editingProduct.inventory} onChange={e => setEditingProduct({...editingProduct, inventory: Number(e.target.value)})} />
              </div>
              <textarea placeholder="Description" className="w-full p-3 md:p-4 bg-gray-50 rounded-xl md:rounded-2xl font-bold outline-none h-24 md:h-32 resize-none text-xs md:text-sm" value={editingProduct.description} onChange={e => setEditingProduct({...editingProduct, description: e.target.value})} />
            </div>
            <div className="flex gap-3 md:gap-4 mt-8 md:mt-12">
              <button onClick={() => setEditingProduct(null)} className="flex-grow bg-gray-50 text-gray-400 py-3 md:py-4 rounded-xl md:rounded-2xl font-black uppercase text-[8px] md:text-[10px]">Discard</button>
              <button onClick={async () => { if(await props.saveProduct(editingProduct)) setEditingProduct(null); }} className="flex-grow bg-black text-white py-3 md:py-4 rounded-xl md:rounded-2xl font-black uppercase text-[8px] md:text-[10px] shadow-xl">Store Manifest</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
