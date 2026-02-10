
import React, { useState, useMemo, useRef } from 'react';
import { ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line } from 'recharts';
import { UserRole, Product, Variant, Order } from '../types';
import { SystemLog } from '../AdminApp';

const AdminDashboard = (props: any) => {
  const [activeTab, setActiveTab] = useState('analytics');
  const [authKey, setAuthKey] = useState('');
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const soundInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Analytics Logic
  const formatCompactNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return num.toString();
  };

  const analytics = useMemo(() => {
    const orders = Array.isArray(props.orders) ? props.orders : [];
    const valid = orders.filter((o: any) => o.status?.toLowerCase() !== 'cancelled');
    const revenue = valid.reduce((acc: number, o: any) => acc + (Number(o.total_pkr || o.total || 0)), 0);
    
    const dailyData: Record<string, number> = {};
    valid.forEach(o => {
      const date = new Date(o.created_at || o.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      dailyData[date] = (dailyData[date] || 0) + (Number(o.total_pkr || o.total || 0));
    });

    const chartData = Object.keys(dailyData).map(date => ({ date, revenue: dailyData[date] })).slice(-7);
    return { revenue, totalCount: orders.length, chartData };
  }, [props.orders]);

  const filteredOrders = useMemo(() => {
    const orders = Array.isArray(props.orders) ? props.orders : [];
    if (!searchQuery) return orders;
    const q = searchQuery.toLowerCase();
    return orders.filter((o: any) => 
      String(o.order_id || o.id).toLowerCase().includes(q) || 
      String(o.customer_name).toLowerCase().includes(q)
    );
  }, [props.orders, searchQuery]);

  const copyOrderDetails = (o: any) => {
    const text = `ITX ORDER MANIFEST\n---\nID: ${o.order_id || o.id}\nCustomer: ${o.customer_name}\nPhone: ${o.customer_phone}\nAddress: ${o.customer_address}, ${o.customer_city}\nTotal: Rs. ${Number(o.total_pkr || o.total).toLocaleString()}\nStatus: ${o.status?.toUpperCase()}`;
    navigator.clipboard.writeText(text);
    alert("Manifest copied to clipboard!");
  };

  const handleMediaClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (fileInputRef.current && !isUploading) fileInputRef.current.click();
  };

  const handleSaveProduct = async () => {
    if (!editingProduct.name || !editingProduct.price) {
      alert("Required info (Name/Price) missing.");
      return;
    }
    const success = await props.saveProduct(editingProduct);
    if (success) setEditingProduct(null);
  };

  if (!props.user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-8">
        <div className="w-full max-w-sm text-center">
          <div className="w-20 h-20 bg-blue-600 rounded-3xl mx-auto mb-10 flex items-center justify-center shadow-2xl">
            <i className="fas fa-shield-alt text-white text-3xl"></i>
          </div>
          <input 
            type="password" value={authKey} onChange={e => setAuthKey(e.target.value)} 
            placeholder="System Access Key" className="w-full p-5 bg-white/5 border border-white/10 rounded-2xl text-white outline-none focus:ring-2 ring-blue-500 mb-4 text-center font-black" 
          />
          <button onClick={() => authKey === props.systemPassword ? props.login(UserRole.ADMIN) : alert('Key Refused')} className="w-full bg-blue-600 text-white p-5 rounded-2xl font-black uppercase text-xs">Initialize Command</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-32 animate-fadeIn selection:bg-blue-500/30">
      {/* SYNC INDICATOR */}
      {props.isSyncing && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[2000] bg-blue-600/90 backdrop-blur-md px-4 py-1.5 rounded-full flex items-center space-x-2 border border-blue-400/30 shadow-2xl">
          <div className="w-1.5 h-1.5 bg-white rounded-full animate-ping"></div>
          <span className="text-[7px] font-black uppercase tracking-widest">Live Sync Active</span>
        </div>
      )}

      {/* ERROR FINDER */}
      {showLogs && (
        <div className="fixed inset-0 bg-black/95 z-[3000] p-6 flex flex-col animate-fadeIn">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-black italic uppercase text-blue-500">Diagnostic Logs</h2>
            <button onClick={() => setShowLogs(false)} className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center"><i className="fas fa-times"></i></button>
          </div>
          <div className="flex-grow overflow-y-auto space-y-2 custom-scrollbar pb-20">
            {props.logs.map((log: SystemLog) => (
              <div key={log.id} className={`p-3 rounded-lg border text-[10px] ${log.type === 'error' ? 'bg-red-500/10 border-red-500/20' : 'bg-white/5 border-white/10'}`}>
                <div className="flex justify-between font-black uppercase opacity-40 mb-1">
                  <span>{log.module}</span><span>{log.timestamp}</span>
                </div>
                <p className="font-bold">{log.message}</p>
                {log.details && <pre className="mt-1 text-[8px] opacity-30 whitespace-pre-wrap">{JSON.stringify(log.details, null, 2)}</pre>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* HEADER */}
      <header className="sticky top-0 z-[100] bg-black/60 backdrop-blur-xl border-b border-white/5 px-6 py-5 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-black text-[10px] italic">ITX</div>
          <h2 className="text-sm font-black italic uppercase tracking-tighter">Merchant Admin</h2>
        </div>
        <div className="flex items-center space-x-3">
          <button onClick={() => setShowLogs(true)} className="w-10 h-10 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center"><i className="fas fa-terminal text-[10px]"></i></button>
          <button onClick={() => props.refreshData()} className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center"><i className="fas fa-sync-alt text-[10px]"></i></button>
        </div>
      </header>

      <main className="px-4 py-6 md:px-6 max-w-4xl mx-auto">
        {activeTab === 'analytics' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 border border-white/10 p-6 rounded-[2rem]">
                <p className="text-[9px] font-black uppercase text-white/30 tracking-[0.2em] mb-1">Gross Revenue</p>
                <h3 className="text-3xl font-black italic">Rs. {formatCompactNumber(analytics.revenue)}</h3>
              </div>
              <div className="bg-white/5 border border-white/10 p-6 rounded-[2rem]">
                <p className="text-[9px] font-black uppercase text-white/30 tracking-[0.2em] mb-1">Total Flow</p>
                <h3 className="text-3xl font-black italic">{analytics.totalCount}</h3>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 p-6 rounded-[2.5rem]">
              <p className="text-[9px] font-black uppercase text-white/30 tracking-[0.2em] mb-6">Sales Performance (7D)</p>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analytics.chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                    <XAxis dataKey="date" stroke="#ffffff20" fontSize={8} tickLine={false} axisLine={false} />
                    <YAxis stroke="#ffffff20" fontSize={8} tickLine={false} axisLine={false} tickFormatter={(val) => `Rs.${formatCompactNumber(val)}`} />
                    <Tooltip contentStyle={{ backgroundColor: '#000', border: '1px solid #ffffff10', fontSize: '10px', borderRadius: '12px' }} itemStyle={{ color: '#3b82f6' }} />
                    <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={4} dot={{ fill: '#3b82f6', r: 4 }} activeDot={{ r: 6, stroke: '#fff' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="relative">
              <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-white/20 text-xs"></i>
              <input 
                type="text" placeholder="Search orders by ID or Name..." 
                className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-6 py-4 outline-none focus:border-blue-500/50 font-bold text-xs"
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="space-y-4">
              {filteredOrders.map((o: any) => (
                <div 
                  key={o.order_id || o.id} 
                  onClick={() => setSelectedOrder(o)}
                  className="bg-white/5 border border-white/10 rounded-[2rem] p-6 cursor-pointer hover:bg-white/[0.07] transition-all group"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-blue-500">Order #{o.order_id || o.id}</p>
                      <h4 className="text-sm font-black italic uppercase group-hover:text-blue-400 transition-colors">{o.customer_name}</h4>
                    </div>
                    <span className={`text-[8px] font-black uppercase px-3 py-1.5 rounded-full border border-white/10 bg-black ${
                      o.status?.toLowerCase() === 'delivered' ? 'text-green-500 border-green-500/20' : 
                      o.status?.toLowerCase() === 'cancelled' ? 'text-red-500 border-red-500/20' : 'text-blue-500'
                    }`}>
                      {o.status || 'Pending'}
                    </span>
                  </div>
                  <div className="flex justify-between items-end">
                    <p className="text-[10px] text-white/40 font-black uppercase italic">{new Date(o.created_at || o.date).toLocaleDateString()}</p>
                    <p className="text-base font-black italic">Rs. {Number(o.total_pkr || o.total || 0).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'products' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex justify-between items-center px-2">
              <h3 className="text-xl font-black italic uppercase text-blue-500 tracking-tighter">Manifest</h3>
              <button onClick={() => setEditingProduct({ name: '', description: '', price: 0, image: '', images: [], category: 'Luxury Artisan', inventory: 10, variants: [] })} className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-2xl"><i className="fas fa-plus"></i></button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {props.products.map((p: Product) => (
                <div key={p.id} className="bg-white/5 border border-white/10 rounded-[2.5rem] overflow-hidden group">
                  <div className="h-44 relative bg-white/5">
                    <img src={p.image || 'https://via.placeholder.com/400'} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-3">
                      <button onClick={() => setEditingProduct(p)} className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center"><i className="fas fa-edit text-xs"></i></button>
                      <button onClick={() => props.deleteProduct(p.id)} className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center"><i className="fas fa-trash text-xs"></i></button>
                    </div>
                  </div>
                  <div className="p-5">
                    <p className="text-[10px] font-black uppercase truncate italic mb-1">{p.name}</p>
                    <p className="text-[11px] font-black text-blue-500 italic">Rs. {p.price.toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-6 animate-fadeIn pb-20">
            <div className="bg-white/5 border border-white/10 p-8 rounded-[2.5rem] space-y-6">
               <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-500 italic">Global Alerts</h4>
               <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase italic">Audio Notifications</p>
                  <button onClick={() => props.audioEnabled ? props.disableAudio() : props.enableAudio()} className={`w-12 h-6 rounded-full relative transition-colors ${props.audioEnabled ? 'bg-blue-600' : 'bg-white/10'}`}>
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${props.audioEnabled ? 'left-7' : 'left-1'}`}></div>
                  </button>
               </div>
               <div className="flex items-center justify-between pt-4 border-t border-white/5">
                  <p className="text-[10px] font-black uppercase italic">Custom Sound</p>
                  <div className="flex space-x-2">
                    <button onClick={() => props.playTestSound()} className="w-9 h-9 bg-white/5 rounded-xl flex items-center justify-center"><i className="fas fa-play text-[10px]"></i></button>
                    <button onClick={() => soundInputRef.current?.click()} className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center"><i className="fas fa-upload text-[10px]"></i></button>
                  </div>
                  <input type="file" ref={soundInputRef} className="hidden" accept="audio/*" onChange={(e) => {
                    const f = e.target.files?.[0]; if(!f) return;
                    const r = new FileReader(); r.onload = ev => props.setCustomSound(ev.target?.result as string); r.readAsDataURL(f);
                  }} />
               </div>
            </div>
          </div>
        )}
      </main>

      {/* FOOTER NAV */}
      <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-3xl border border-white/10 px-8 py-5 rounded-full flex items-center space-x-10 z-[200] shadow-2xl">
        <button onClick={() => setActiveTab('analytics')} className={`flex flex-col items-center space-y-1.5 ${activeTab === 'analytics' ? 'text-blue-500' : 'text-white/20'}`}><i className="fas fa-chart-pie text-xl"></i></button>
        <button onClick={() => setActiveTab('orders')} className={`flex flex-col items-center space-y-1.5 ${activeTab === 'orders' ? 'text-blue-500' : 'text-white/20'}`}><i className="fas fa-shopping-cart text-xl"></i></button>
        <button onClick={() => setActiveTab('products')} className={`flex flex-col items-center space-y-1.5 ${activeTab === 'products' ? 'text-blue-500' : 'text-white/20'}`}><i className="fas fa-boxes text-xl"></i></button>
        <button onClick={() => setActiveTab('settings')} className={`flex flex-col items-center space-y-1.5 ${activeTab === 'settings' ? 'text-blue-500' : 'text-white/20'}`}><i className="fas fa-cog text-xl"></i></button>
      </nav>

      {/* ORDER INSPECTOR */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[2000] flex flex-col justify-end">
          <div className="bg-[#0a0a0a] w-full max-h-[85vh] rounded-t-[3rem] p-8 space-y-8 animate-slideInTop border-t border-white/10 overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest italic">Order Inspector</p>
                <h3 className="text-xl font-black italic uppercase">Manifest #{selectedOrder.order_id || selectedOrder.id}</h3>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center"><i className="fas fa-times"></i></button>
            </div>

            <div className="space-y-6">
               <div className="bg-white/5 rounded-2xl p-6 border border-white/5 space-y-4">
                  <div className="flex justify-between"><p className="text-[10px] font-black uppercase text-white/30">Customer</p><p className="text-xs font-bold">{selectedOrder.customer_name}</p></div>
                  <div className="flex justify-between"><p className="text-[10px] font-black uppercase text-white/30">Contact</p><p className="text-xs font-bold text-blue-500">{selectedOrder.customer_phone}</p></div>
                  <div className="flex justify-between"><p className="text-[10px] font-black uppercase text-white/30">Location</p><p className="text-xs font-bold text-right max-w-[150px]">{selectedOrder.customer_address}, {selectedOrder.customer_city}</p></div>
               </div>

               <div className="space-y-3">
                  <p className="text-[10px] font-black uppercase text-white/30 ml-2">Shipment Payload</p>
                  <div className="bg-white/5 rounded-2xl p-5 border border-white/5 flex items-center space-x-4">
                     <img src={selectedOrder.product_image} className="w-12 h-12 rounded-xl object-cover" />
                     <div className="flex-grow">
                        <p className="text-[11px] font-black uppercase italic">{selectedOrder.product_name}</p>
                        <p className="text-[9px] font-bold text-white/30 uppercase mt-0.5">Quantity: 1 Unit</p>
                     </div>
                     <p className="text-sm font-black italic">Rs. {Number(selectedOrder.total_pkr || selectedOrder.total).toLocaleString()}</p>
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => copyOrderDetails(selectedOrder)} className="py-5 bg-white/5 border border-white/10 rounded-2xl font-black uppercase text-[10px] tracking-widest italic flex items-center justify-center">
                    <i className="fas fa-copy mr-2"></i> Copy Manifest
                  </button>
                  <select 
                    value={selectedOrder.status?.toLowerCase() || 'pending'} 
                    onChange={(e) => {
                      props.updateStatus(selectedOrder.order_id || selectedOrder.id, e.target.value);
                      setSelectedOrder(null);
                    }}
                    className="py-5 bg-blue-600 rounded-2xl font-black uppercase text-[10px] text-center outline-none"
                  >
                    <option value="pending">Mark Pending</option>
                    <option value="confirmed">Confirm Sale</option>
                    <option value="shipped">Hand to Rider</option>
                    <option value="delivered">Completed</option>
                    <option value="cancelled">Void Sale</option>
                  </select>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* PRODUCT EDITOR */}
      {editingProduct && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl z-[2000] flex flex-col justify-end animate-fadeIn">
          <div className="bg-[#0a0a0a] w-full rounded-t-[3rem] p-8 space-y-8 animate-slideInTop overflow-y-auto max-h-[95vh] border-t border-white/10 custom-scrollbar">
            <div className="flex justify-between items-center">
               <h4 className="text-xl font-black italic uppercase text-blue-500 tracking-tighter">Edit Artifact</h4>
               <button onClick={() => setEditingProduct(null)} className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center"><i className="fas fa-times"></i></button>
            </div>
            
            <div className="space-y-6">
              <div className="flex space-x-4 overflow-x-auto py-2 no-scrollbar">
                <button onClick={handleMediaClick} disabled={isUploading} className="w-24 h-24 bg-white/5 border border-dashed border-white/20 rounded-3xl flex flex-col items-center justify-center shrink-0">
                  <i className={`fas ${isUploading ? 'fa-spinner fa-spin' : 'fa-camera-retro'} text-xl mb-1`}></i>
                  <span className="text-[8px] font-black uppercase">Add Media</span>
                </button>
                {editingProduct.images?.map((img: string, i: number) => (
                  <div key={i} className="w-24 h-24 rounded-3xl overflow-hidden border border-white/10 shrink-0 relative group">
                    <img src={img} className="w-full h-full object-cover" />
                    <button onClick={() => setEditingProduct({...editingProduct, images: editingProduct.images.filter((_:any,idx:number)=>idx!==i)})} className="absolute inset-0 bg-red-600/80 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"><i className="fas fa-trash"></i></button>
                  </div>
                ))}
                <input type="file" multiple ref={fileInputRef} className="hidden" accept="image/*" onChange={async (e) => {
                  const files = e.target.files; if(!files) return;
                  setIsUploading(true);
                  for(let i=0; i<files.length; i++) {
                    const url = await props.uploadMedia(files[i]);
                    if(url) setEditingProduct((prev:any) => ({ ...prev, images: [...(prev.images || []), url], image: prev.image || url }));
                  }
                  setIsUploading(false); e.target.value = '';
                }} />
              </div>

              <div className="space-y-6 pb-24">
                <div className="space-y-1"><label className="text-[9px] font-black uppercase opacity-30 ml-3">Product Identity</label><input type="text" className="w-full p-5 bg-white/5 rounded-2xl font-black border border-white/5 outline-none" value={editingProduct.name} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} /></div>
                <div className="space-y-1"><label className="text-[9px] font-black uppercase opacity-30 ml-3">Base Price (PKR)</label><input type="number" className="w-full p-5 bg-white/5 rounded-2xl font-black border border-white/5 outline-none" value={editingProduct.price} onChange={e => setEditingProduct({...editingProduct, price: Number(e.target.value)})} /></div>
                
                {/* VARIANTS SECTION */}
                <div className="space-y-4">
                   <div className="flex justify-between items-center px-2">
                     <label className="text-[9px] font-black uppercase opacity-30">Configurations / Variants</label>
                     <button 
                        onClick={() => setEditingProduct({...editingProduct, variants: [...(editingProduct.variants || []), { id: Date.now().toString(), name: 'New Variant', price: editingProduct.price }]})}
                        className="text-[9px] font-black uppercase text-blue-500 underline"
                     >
                       + Add Variant
                     </button>
                   </div>
                   <div className="space-y-3">
                      {(editingProduct.variants || []).map((v: Variant, idx: number) => (
                        <div key={v.id} className="bg-black border border-white/5 p-4 rounded-2xl flex items-center space-x-3">
                           <input 
                              type="text" 
                              className="bg-transparent text-[10px] font-black uppercase outline-none flex-grow" 
                              value={v.name} 
                              onChange={e => {
                                const newVariants = [...editingProduct.variants];
                                newVariants[idx].name = e.target.value;
                                setEditingProduct({...editingProduct, variants: newVariants});
                              }}
                           />
                           <input 
                              type="number" 
                              className="bg-transparent text-[10px] font-black w-20 text-blue-500 outline-none" 
                              value={v.price} 
                              onChange={e => {
                                const newVariants = [...editingProduct.variants];
                                newVariants[idx].price = Number(e.target.value);
                                setEditingProduct({...editingProduct, variants: newVariants});
                              }}
                           />
                           <button onClick={() => setEditingProduct({...editingProduct, variants: editingProduct.variants.filter((_:any, i:number)=>i!==idx)})} className="text-red-500 opacity-40"><i className="fas fa-times"></i></button>
                        </div>
                      ))}
                   </div>
                </div>

                <div className="space-y-1"><label className="text-[9px] font-black uppercase opacity-30 ml-3">Inventory Manifest</label><input type="number" className="w-full p-5 bg-white/5 rounded-2xl font-black border border-white/5 outline-none" value={editingProduct.inventory} onChange={e => setEditingProduct({...editingProduct, inventory: Number(e.target.value)})} /></div>
                
                <div className="flex gap-4 pt-6">
                  <button onClick={() => setEditingProduct(null)} className="flex-grow py-5 rounded-2xl font-black uppercase text-[10px] opacity-40 border border-white/10 italic">Discard</button>
                  <button onClick={handleSaveProduct} className="flex-grow py-5 bg-blue-600 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-2xl active:scale-95 transition-all italic">Publish Artifact</button>
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
