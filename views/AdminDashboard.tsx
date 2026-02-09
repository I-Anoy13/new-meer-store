
import React, { useState, useMemo, useRef } from 'react';
import { ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line } from 'recharts';
import { UserRole, Product, Variant, Order } from '../types';
import { SystemLog } from '../AdminApp';

const AdminDashboard = (props: any) => {
  const [activeTab, setActiveTab] = useState('analytics');
  const [authKey, setAuthKey] = useState('');
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const soundInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [showLogs, setShowLogs] = useState(false);

  // Search and Filter State
  const [searchQuery, setSearchQuery] = useState('');

  const formatCompactNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return num.toString();
  };

  const analytics = useMemo(() => {
    const orders = Array.isArray(props.orders) ? props.orders : [];
    const valid = orders.filter((o: any) => o.status !== 'cancelled');
    const revenue = valid.reduce((acc: number, o: any) => acc + (Number(o.total_pkr || o.total || 0)), 0);
    const totalCount = orders.length;

    return { revenue, totalCount };
  }, [props.orders]);

  const handleMediaClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (fileInputRef.current && !isUploading) fileInputRef.current.click();
  };

  const handleSaveProduct = async () => {
    if (!editingProduct.name || !editingProduct.price) {
      alert("Basic info (Name/Price) is missing.");
      return;
    }
    setIsSavingProduct(true);
    const success = await props.saveProduct(editingProduct);
    setIsSavingProduct(false);
    if (success) setEditingProduct(null);
  };

  if (!props.user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="mb-12 text-center">
            <div className="w-20 h-20 bg-blue-600 rounded-3xl mx-auto mb-6 flex items-center justify-center shadow-2xl">
              <i className="fas fa-terminal text-white text-3xl"></i>
            </div>
            <h1 className="text-3xl font-black italic tracking-tighter text-white uppercase">Console Access</h1>
          </div>
          <div className="space-y-4">
            <input 
              type="password" 
              value={authKey} 
              onChange={e => setAuthKey(e.target.value)} 
              onKeyDown={e => e.key === 'Enter' && (authKey === props.systemPassword ? props.login(UserRole.ADMIN) : alert('Key Refused'))}
              placeholder="System Access Key" 
              className="w-full p-5 bg-white/5 border border-white/10 rounded-2xl text-white outline-none focus:ring-2 ring-blue-500 text-center font-black" 
            />
            <button 
              onClick={() => { if (authKey === props.systemPassword) props.login(UserRole.ADMIN); else alert('Key Refused'); }} 
              className="w-full bg-blue-600 text-white p-5 rounded-2xl font-black uppercase text-xs"
            >
              Initialize Command
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-32 animate-fadeIn">
      {/* ERROR FINDER OVERLAY */}
      {showLogs && (
        <div className="fixed inset-0 bg-black/95 z-[2000] p-6 flex flex-col animate-fadeIn">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-black italic uppercase text-blue-500 tracking-tighter">Diagnostic Error Finder</h2>
            <button onClick={() => setShowLogs(false)} className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center"><i className="fas fa-times"></i></button>
          </div>
          <div className="flex-grow overflow-y-auto space-y-3 custom-scrollbar">
            {props.logs.length === 0 ? (
              <p className="text-center text-white/20 py-20 font-black uppercase tracking-widest italic">No active logs detected</p>
            ) : (
              props.logs.map((log: SystemLog) => (
                <div key={log.id} className={`p-4 rounded-xl border ${
                  log.type === 'error' ? 'bg-red-500/10 border-red-500/20' : 
                  log.type === 'warning' ? 'bg-amber-500/10 border-amber-500/20' : 
                  'bg-white/5 border-white/10'
                }`}>
                  <div className="flex justify-between items-start mb-1">
                    <span className={`text-[8px] font-black uppercase tracking-widest ${
                      log.type === 'error' ? 'text-red-500' : 
                      log.type === 'warning' ? 'text-amber-500' : 'text-blue-500'
                    }`}>[{log.module}] - {log.timestamp}</span>
                    <span className="text-[7px] font-black text-white/30">{log.type.toUpperCase()}</span>
                  </div>
                  <p className="text-xs font-bold">{log.message}</p>
                  {log.details && (
                    <pre className="mt-2 text-[8px] bg-black/50 p-2 rounded overflow-x-auto text-white/60 font-mono">
                      {typeof log.details === 'string' ? log.details : JSON.stringify(log.details, null, 2)}
                    </pre>
                  )}
                </div>
              ))
            )}
          </div>
          <div className="mt-4 p-4 bg-blue-600/10 rounded-xl border border-blue-500/20">
             <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest italic">Developer Tip:</p>
             <p className="text-[10px] text-white/60 mt-1">Check if Supabase Storage bucket 'products' exists and has Public RLS policies.</p>
          </div>
        </div>
      )}

      {/* GLOBAL PERSISTENT TOASTS */}
      <div className="fixed top-24 left-0 right-0 z-[1000] px-6 pointer-events-none flex flex-col items-center space-y-3">
        {props.toasts?.map((toast: any) => (
          <div key={toast.id} className={`pointer-events-auto px-6 py-4 rounded-2xl shadow-2xl flex items-center space-x-4 animate-slideInTop border border-white/10 max-w-md w-full ${
            toast.type === 'success' ? 'bg-emerald-600' : toast.type === 'error' ? 'bg-red-600' : 'bg-blue-600'
          }`}>
            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
              <i className={`fas ${toast.type === 'success' ? 'fa-check' : 'fa-exclamation-triangle'} text-xs`}></i>
            </div>
            <div className="flex-grow">
              <p className="text-[10px] font-black uppercase tracking-widest italic">{toast.message}</p>
            </div>
            {toast.persistent && (
              <button onClick={() => props.removeToast(toast.id)} className="text-white/40 hover:text-white transition p-2">
                <i className="fas fa-times text-[10px]"></i>
              </button>
            )}
          </div>
        ))}
      </div>

      {/* HEADER */}
      <header className="sticky top-0 z-[100] bg-black/60 backdrop-blur-xl border-b border-white/5 px-6 py-5 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-black text-[10px] italic text-white">ITX</div>
          <h2 className="text-sm font-black italic tracking-tighter uppercase">Merchant Admin</h2>
        </div>
        <div className="flex items-center space-x-3">
          <button onClick={() => setShowLogs(true)} className="w-10 h-10 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center border border-red-500/10">
            <i className="fas fa-bug text-[10px]"></i>
          </button>
          <button onClick={() => props.refreshData()} className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center"><i className="fas fa-sync-alt text-[10px]"></i></button>
          <div className="w-10 h-10 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center cursor-pointer" onClick={() => props.logout()}><i className="fas fa-power-off text-[10px]"></i></div>
        </div>
      </header>

      <main className="px-4 py-6 md:px-6">
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <div className="bg-white/5 border border-white/10 p-6 rounded-[2.5rem]">
              <p className="text-[10px] font-black uppercase text-white/30 tracking-[0.2em] mb-4">Total Revenue</p>
              <h3 className="text-4xl font-black italic tracking-tighter">Rs. {formatCompactNumber(analytics.revenue)}</h3>
            </div>
            
            <section className="bg-white/5 border border-white/10 p-6 rounded-[2.5rem] space-y-6">
              <p className="text-[10px] font-black uppercase text-white/30 tracking-[0.2em]">Notification Console</p>
              <div className="flex items-center justify-between bg-black/40 p-4 rounded-2xl border border-white/5">
                 <div>
                   <p className="text-[9px] font-black uppercase tracking-widest italic text-white/80">Alert Sound Profile</p>
                   <p className="text-[7px] font-black uppercase text-white/20 mt-1">{props.customSound ? 'User Custom File Active' : 'System Default Active'}</p>
                 </div>
                 <div className="flex items-center space-x-2">
                    <button onClick={() => props.playTestSound()} className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center hover:bg-white/10 transition-colors"><i className="fas fa-play text-[10px]"></i></button>
                    <button onClick={() => soundInputRef.current?.click()} className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center hover:bg-blue-500 transition-colors"><i className="fas fa-upload text-[10px]"></i></button>
                    <input type="file" ref={soundInputRef} className="hidden" accept="audio/*" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const r = new FileReader();
                      r.onload = ev => props.setCustomSound(ev.target?.result as string);
                      r.readAsDataURL(file);
                    }} />
                 </div>
              </div>
            </section>

            <button onClick={() => setActiveTab('products')} className="w-full bg-blue-600/10 border border-blue-500/20 p-6 rounded-[2rem] flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-blue-500">Inventory Overview</span>
              <span className="text-xl font-black italic">{props.products.length} Items</span>
            </button>
          </div>
        )}

        {activeTab === 'products' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex justify-between items-center px-2">
              <h3 className="text-xl font-black italic uppercase tracking-tighter text-blue-500">Product Inventory</h3>
              <button onClick={() => setEditingProduct({ name: '', description: '', price: 0, image: '', images: [], category: 'Luxury Artisan', inventory: 10, variants: [] })} className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-2xl active:scale-95 transition-all">
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
                        {p.inventory <= 0 ? 'Out of Stock' : `Stock: ${p.inventory}`}
                    </div>
                  </div>
                  <div className="p-4 space-y-3">
                    <p className="text-[10px] font-black uppercase truncate italic">{p.name}</p>
                    <div className="flex justify-between items-center">
                      <p className="text-[10px] font-black text-blue-500 italic">Rs. {p.price.toLocaleString()}</p>
                      <button onClick={() => setEditingProduct(p)} className="w-9 h-9 bg-white/5 rounded-xl flex items-center justify-center active:bg-white/10 transition-colors"><i className="fas fa-edit text-[10px]"></i></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* FOOTER NAV */}
      <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-2xl border border-white/10 h-18 px-8 rounded-full flex items-center space-x-12 z-[200] shadow-2xl max-w-[95vw]">
        <button onClick={() => setActiveTab('analytics')} className={`flex flex-col items-center space-y-1.5 transition-colors ${activeTab === 'analytics' ? 'text-blue-500' : 'text-white/20'}`}>
          <i className="fas fa-chart-line text-lg"></i>
          <span className="text-[7px] font-black uppercase tracking-widest">Dashboard</span>
        </button>
        <button onClick={() => setActiveTab('products')} className={`flex flex-col items-center space-y-1.5 transition-colors ${activeTab === 'products' ? 'text-blue-500' : 'text-white/20'}`}>
          <i className="fas fa-boxes text-lg"></i>
          <span className="text-[7px] font-black uppercase tracking-widest">Catalog</span>
        </button>
      </nav>

      {/* PRODUCT EDITOR */}
      {editingProduct && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl z-[1100] flex flex-col justify-end animate-fadeIn">
          <div className="absolute inset-0" onClick={() => !isSavingProduct && setEditingProduct(null)}></div>
          <div className="bg-[#0a0a0a] w-full rounded-t-[3rem] p-8 space-y-8 relative animate-slideInTop overflow-y-auto max-h-[95vh] border-t border-white/10 custom-scrollbar">
            <div className="flex justify-between items-center">
               <h4 className="text-xl font-black italic uppercase tracking-tighter text-blue-500">Edit Manifest</h4>
               <button onClick={() => setEditingProduct(null)} className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center"><i className="fas fa-times"></i></button>
            </div>
            
            <div className="space-y-6">
              <div className="flex space-x-4 overflow-x-auto py-2 no-scrollbar">
                <button 
                  type="button" 
                  onClick={handleMediaClick} 
                  disabled={isUploading}
                  className="w-20 h-20 bg-white/5 border border-dashed border-white/10 rounded-3xl flex flex-col items-center justify-center text-white/20 shrink-0 hover:bg-white/10"
                >
                  <i className={`fas ${isUploading ? 'fa-spinner fa-spin' : 'fa-camera'} text-lg mb-1`}></i>
                  <span className="text-[7px] font-black uppercase">Add Photo</span>
                </button>
                {editingProduct.images?.map((img: string, i: number) => (
                  <div key={i} className="w-20 h-20 rounded-3xl overflow-hidden border border-white/10 shrink-0 relative group">
                    <img src={img} className="w-full h-full object-cover" />
                    <button onClick={() => setEditingProduct({...editingProduct, images: editingProduct.images.filter((_:any,idx:number)=>idx!==i)})} className="absolute inset-0 bg-red-600/80 opacity-0 group-hover:opacity-100 transition flex items-center justify-center"><i className="fas fa-trash text-sm"></i></button>
                  </div>
                ))}
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
                    const results = [];
                    for(let i=0; i<files.length; i++) { 
                      const url = await props.uploadMedia(files[i]); 
                      if(url) results.push(url); 
                    }
                    if (results.length > 0) {
                      setEditingProduct({ ...editingProduct, images: [...(editingProduct.images || []), ...results], image: editingProduct.image || results[0] });
                    }
                    setIsUploading(false);
                    e.target.value = '';
                  }} 
                />
              </div>

              <div className="space-y-4 pb-20">
                <div className="space-y-1.5"><label className="text-[9px] font-black uppercase text-white/30 ml-3">Product Name</label><input type="text" className="w-full p-5 bg-white/5 rounded-2xl font-black outline-none border border-white/5" value={editingProduct.name} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5"><label className="text-[9px] font-black uppercase text-white/30 ml-3">Price (PKR)</label><input type="number" className="w-full p-5 bg-white/5 rounded-2xl font-black outline-none border border-white/5" value={editingProduct.price} onChange={e => setEditingProduct({...editingProduct, price: Number(e.target.value)})} /></div>
                  <div className="space-y-1.5"><label className="text-[9px] font-black uppercase text-white/30 ml-3">Stock</label><input type="number" className="w-full p-5 bg-white/5 rounded-2xl font-black outline-none border border-white/5" value={editingProduct.inventory} onChange={e => setEditingProduct({...editingProduct, inventory: Number(e.target.value)})} /></div>
                </div>
                <div className="flex gap-4 pt-10 pb-20">
                  <button onClick={() => setEditingProduct(null)} className="flex-grow py-5 rounded-2xl font-black uppercase text-[10px] text-white/40 border border-white/10">Discard</button>
                  <button 
                    onClick={handleSaveProduct} 
                    disabled={isSavingProduct || isUploading}
                    className="flex-grow py-5 bg-blue-600 rounded-2xl font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all disabled:opacity-50"
                  >
                    {isSavingProduct ? <i className="fas fa-circle-notch fa-spin mr-2"></i> : 'Publish Update'}
                  </button>
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
