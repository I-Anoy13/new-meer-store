
import React, { useState, useMemo, useRef } from 'react';
import { ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line, BarChart, Bar } from 'recharts';
import { UserRole, Product, Variant, Order } from '../types';
import { SystemLog } from '../AdminApp';

const AdminDashboard = (props: any) => {
  const [activeTab, setActiveTab] = useState('analytics');
  const [authKey, setAuthKey] = useState('');
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const soundInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const analytics = useMemo(() => {
    const orders = Array.isArray(props.orders) ? props.orders : [];
    const valid = orders.filter((o: any) => o.status?.toLowerCase() !== 'cancelled');
    const revenue = valid.reduce((acc: number, o: any) => acc + (Number(o.total_pkr || o.total || 0)), 0);
    
    // Group by date for chart
    const dailyData: Record<string, number> = {};
    valid.forEach(o => {
      const date = new Date(o.created_at || o.date).toLocaleDateString();
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

  const handleMediaClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (fileInputRef.current && !isUploading) fileInputRef.current.click();
  };

  const handleSaveProduct = async () => {
    if (!editingProduct.name || !editingProduct.price) {
      alert("Basic info (Name/Price) is missing.");
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
          <div className="w-2 h-2 bg-white rounded-full animate-ping"></div>
          <span className="text-[8px] font-black uppercase tracking-widest">Synchronizing...</span>
        </div>
      )}

      {/* ERROR FINDER LOGS */}
      {showLogs && (
        <div className="fixed inset-0 bg-black/95 z-[3000] p-6 flex flex-col animate-fadeIn">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-black italic uppercase text-blue-500">System Diagnostic</h2>
            <button onClick={() => setShowLogs(false)} className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center"><i className="fas fa-times"></i></button>
          </div>
          <div className="flex-grow overflow-y-auto space-y-2 custom-scrollbar">
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

      {/* GLOBAL TOASTS */}
      <div className="fixed top-20 left-0 right-0 z-[1000] px-6 pointer-events-none flex flex-col items-center space-y-2">
        {props.toasts?.map((t: any) => (
          <div key={t.id} className={`pointer-events-auto px-6 py-3 rounded-2xl shadow-2xl flex items-center justify-between border border-white/10 max-w-md w-full ${t.type === 'error' ? 'bg-red-600' : 'bg-blue-600'}`}>
            <span className="text-[10px] font-black uppercase italic tracking-widest">{t.message}</span>
            <button onClick={() => props.removeToast(t.id)} className="p-2 opacity-50"><i className="fas fa-times"></i></button>
          </div>
        ))}
      </div>

      <header className="sticky top-0 z-[100] bg-black/60 backdrop-blur-xl border-b border-white/5 px-6 py-5 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-black text-[10px] italic">ITX</div>
          <h2 className="text-sm font-black italic uppercase tracking-tighter">Merchant Admin</h2>
        </div>
        <div className="flex items-center space-x-3">
          <button onClick={() => setShowLogs(true)} className="w-10 h-10 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center"><i className="fas fa-terminal text-[10px]"></i></button>
          <button onClick={() => props.refreshData()} className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center"><i className="fas fa-sync-alt text-[10px]"></i></button>
          <button onClick={() => props.logout()} className="w-10 h-10 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center"><i className="fas fa-power-off text-[10px]"></i></button>
        </div>
      </header>

      <main className="px-4 py-6 md:px-6 max-w-4xl mx-auto">
        {activeTab === 'analytics' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 border border-white/10 p-6 rounded-[2rem]">
                <p className="text-[9px] font-black uppercase text-white/30 tracking-[0.2em] mb-1">Gross Revenue</p>
                <h3 className="text-2xl font-black italic">Rs. {analytics.revenue.toLocaleString()}</h3>
              </div>
              <div className="bg-white/5 border border-white/10 p-6 rounded-[2rem]">
                <p className="text-[9px] font-black uppercase text-white/30 tracking-[0.2em] mb-1">Total Orders</p>
                <h3 className="text-2xl font-black italic">{analytics.totalCount}</h3>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 p-6 rounded-[2.5rem]">
              <p className="text-[9px] font-black uppercase text-white/30 tracking-[0.2em] mb-6">Sales Performance (7D)</p>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analytics.chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                    <XAxis dataKey="date" stroke="#ffffff30" fontSize={8} tickLine={false} axisLine={false} />
                    <YAxis stroke="#ffffff30" fontSize={8} tickLine={false} axisLine={false} tickFormatter={(val) => `Rs.${val/1000}k`} />
                    <Tooltip contentStyle={{ backgroundColor: '#000', border: '1px solid #ffffff10', fontSize: '10px', borderRadius: '12px' }} />
                    <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={3} dot={{ fill: '#3b82f6', strokeWidth: 2 }} />
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
                type="text" placeholder="Search orders..." 
                className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-6 py-4 outline-none focus:border-blue-500/50 font-bold text-xs"
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="space-y-4">
              {filteredOrders.length === 0 ? (
                <div className="py-20 text-center opacity-20 font-black uppercase text-[10px]">No orders processed</div>
              ) : (
                filteredOrders.map((o: any) => (
                  <div key={o.order_id || o.id} className="bg-white/5 border border-white/10 rounded-[2rem] p-6 space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-blue-500 mb-1">Order #{o.order_id || o.id}</p>
                        <h4 className="text-sm font-black italic uppercase truncate max-w-[150px]">{o.customer_name}</h4>
                      </div>
                      <select 
                        value={o.status?.toLowerCase() || 'pending'} 
                        onChange={(e) => props.updateStatus(o.order_id || o.id, e.target.value)}
                        className={`text-[9px] font-black uppercase px-3 py-1.5 rounded-full border border-white/10 outline-none bg-black transition-colors ${
                          o.status?.toLowerCase() === 'delivered' ? 'text-green-500' : 
                          o.status?.toLowerCase() === 'cancelled' ? 'text-red-500' : 'text-blue-500'
                        }`}
                      >
                        <option value="pending">Pending</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="shipped">Shipped</option>
                        <option value="delivered">Delivered</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>
                    <div className="text-[10px] text-white/40 font-medium leading-relaxed">
                      <p><i className="fas fa-phone mr-2 text-[8px]"></i> {o.customer_phone}</p>
                      <p className="mt-1"><i className="fas fa-map-marker-alt mr-2 text-[8px]"></i> {o.customer_address}, {o.customer_city}</p>
                    </div>
                    <div className="pt-4 border-t border-white/5 flex justify-between items-center">
                       <p className="text-[9px] font-black uppercase text-white/20">{new Date(o.created_at || o.date).toLocaleString()}</p>
                       <p className="text-sm font-black italic">Rs. {Number(o.total_pkr || o.total || 0).toLocaleString()}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'products' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-black italic uppercase text-blue-500 tracking-tighter">Product Manifest</h3>
              <button onClick={() => setEditingProduct({ name: '', description: '', price: 0, image: '', images: [], category: 'Luxury Artisan', inventory: 10, variants: [] })} className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-2xl"><i className="fas fa-plus"></i></button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {props.products.map((p: Product) => (
                <div key={p.id} className="bg-white/5 border border-white/10 rounded-[2.5rem] overflow-hidden group">
                  <div className="h-44 relative bg-white/5">
                    <img src={p.image || 'https://via.placeholder.com/400'} className="w-full h-full object-cover" />
                    <div className="absolute top-3 right-3 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setEditingProduct(p)} className="w-8 h-8 bg-black/60 backdrop-blur-md rounded-lg flex items-center justify-center border border-white/10"><i className="fas fa-edit text-[10px]"></i></button>
                      <button onClick={() => props.deleteProduct(p.id)} className="w-8 h-8 bg-red-600/60 backdrop-blur-md rounded-lg flex items-center justify-center border border-red-500/10"><i className="fas fa-trash text-[10px]"></i></button>
                    </div>
                  </div>
                  <div className="p-5">
                    <p className="text-[10px] font-black uppercase truncate italic mb-1">{p.name}</p>
                    <p className="text-[11px] font-black text-blue-500">Rs. {p.price.toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="bg-white/5 border border-white/10 p-8 rounded-[2.5rem] space-y-6">
               <h4 className="text-xs font-black uppercase tracking-widest text-blue-500 italic">Order Notifications</h4>
               <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase italic">Enable Sound Alerts</p>
                  <button 
                    onClick={() => props.audioEnabled ? props.disableAudio() : props.enableAudio()} 
                    className={`w-12 h-6 rounded-full transition-colors relative ${props.audioEnabled ? 'bg-blue-600' : 'bg-white/10'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${props.audioEnabled ? 'left-7' : 'left-1'}`}></div>
                  </button>
               </div>
               <div className="flex items-center justify-between pt-4 border-t border-white/5">
                  <div>
                    <p className="text-[10px] font-black uppercase italic">Custom Sound</p>
                    <p className="text-[8px] font-bold text-white/20 mt-1 uppercase">MP3 / WAV ONLY</p>
                  </div>
                  <div className="flex space-x-2">
                    <button onClick={() => props.playTestSound()} className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center"><i className="fas fa-play text-[10px]"></i></button>
                    <button onClick={() => soundInputRef.current?.click()} className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center"><i className="fas fa-upload text-[10px]"></i></button>
                  </div>
                  <input type="file" ref={soundInputRef} className="hidden" accept="audio/*" onChange={(e) => {
                    const f = e.target.files?.[0]; if(!f) return;
                    const r = new FileReader(); r.onload = ev => props.setCustomSound(ev.target?.result as string); r.readAsDataURL(f);
                  }} />
               </div>
            </div>
            
            <div className="bg-white/5 border border-white/10 p-8 rounded-[2.5rem] space-y-6">
               <h4 className="text-xs font-black uppercase tracking-widest text-blue-500 italic">System Integrity</h4>
               <div>
                  <label className="text-[9px] font-black uppercase opacity-30 ml-3">Security Key</label>
                  <input type="text" readOnly value={props.systemPassword} className="w-full mt-2 p-5 bg-black rounded-2xl font-mono text-[10px] border border-white/5 outline-none opacity-50" />
               </div>
            </div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-3xl border border-white/10 px-8 py-5 rounded-full flex items-center space-x-10 z-[200] shadow-2xl">
        <button onClick={() => setActiveTab('analytics')} className={`flex flex-col items-center space-y-1.5 transition-colors ${activeTab === 'analytics' ? 'text-blue-500' : 'text-white/20'}`}><i className="fas fa-chart-pie text-xl"></i></button>
        <button onClick={() => setActiveTab('orders')} className={`flex flex-col items-center space-y-1.5 transition-colors ${activeTab === 'orders' ? 'text-blue-500' : 'text-white/20'}`}><i className="fas fa-shopping-cart text-xl"></i></button>
        <button onClick={() => setActiveTab('products')} className={`flex flex-col items-center space-y-1.5 transition-colors ${activeTab === 'products' ? 'text-blue-500' : 'text-white/20'}`}><i className="fas fa-boxes text-xl"></i></button>
        <button onClick={() => setActiveTab('settings')} className={`flex flex-col items-center space-y-1.5 transition-colors ${activeTab === 'settings' ? 'text-blue-500' : 'text-white/20'}`}><i className="fas fa-cog text-xl"></i></button>
      </nav>

      {/* EXPANDED PRODUCT EDITOR */}
      {editingProduct && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl z-[1100] flex flex-col justify-end animate-fadeIn">
          <div className="bg-[#0a0a0a] w-full rounded-t-[3rem] p-8 space-y-8 animate-slideInTop overflow-y-auto max-h-[95vh] border-t border-white/10 custom-scrollbar">
            <div className="flex justify-between items-center">
               <h4 className="text-xl font-black italic uppercase text-blue-500 tracking-tighter">Refine Manifest</h4>
               <button onClick={() => setEditingProduct(null)} className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center"><i className="fas fa-times"></i></button>
            </div>
            
            <div className="space-y-6">
              <div className="flex space-x-4 overflow-x-auto py-2 no-scrollbar">
                <button onClick={handleMediaClick} disabled={isUploading} className="w-24 h-24 bg-white/5 border border-dashed border-white/20 rounded-3xl flex flex-col items-center justify-center shrink-0">
                  <i className={`fas ${isUploading ? 'fa-spinner fa-spin' : 'fa-camera-retro'} text-xl mb-1`}></i>
                  <span className="text-[8px] font-black uppercase">Add Photo</span>
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

              <div className="space-y-4 pb-24">
                <div className="space-y-1"><label className="text-[9px] font-black uppercase opacity-30 ml-3">Product Name</label><input type="text" className="w-full p-5 bg-white/5 rounded-2xl font-black border border-white/5 outline-none" value={editingProduct.name} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} /></div>
                <div className="space-y-1"><label className="text-[9px] font-black uppercase opacity-30 ml-3">Description</label><textarea className="w-full p-5 bg-white/5 rounded-2xl font-medium border border-white/5 outline-none h-32 resize-none text-xs" value={editingProduct.description} onChange={e => setEditingProduct({...editingProduct, description: e.target.value})} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1"><label className="text-[9px] font-black uppercase opacity-30 ml-3">Retail Price</label><input type="number" className="w-full p-5 bg-white/5 rounded-2xl font-black border border-white/5 outline-none" value={editingProduct.price} onChange={e => setEditingProduct({...editingProduct, price: Number(e.target.value)})} /></div>
                  <div className="space-y-1"><label className="text-[9px] font-black uppercase opacity-30 ml-3">Inventory</label><input type="number" className="w-full p-5 bg-white/5 rounded-2xl font-black border border-white/5 outline-none" value={editingProduct.inventory} onChange={e => setEditingProduct({...editingProduct, inventory: Number(e.target.value)})} /></div>
                </div>
                <div className="space-y-1"><label className="text-[9px] font-black uppercase opacity-30 ml-3">Category</label><input type="text" className="w-full p-5 bg-white/5 rounded-2xl font-black border border-white/5 outline-none" value={editingProduct.category} onChange={e => setEditingProduct({...editingProduct, category: e.target.value})} /></div>
                
                <div className="flex gap-4 pt-10">
                  <button onClick={() => setEditingProduct(null)} className="flex-grow py-5 rounded-2xl font-black uppercase text-[10px] opacity-40 border border-white/10">Discard</button>
                  <button onClick={handleSaveProduct} className="flex-grow py-5 bg-blue-600 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-2xl active:scale-95 transition-all">Publish Live</button>
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
