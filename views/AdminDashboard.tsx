
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
  const [showLogs, setShowLogs] = useState(false);

  const analytics = useMemo(() => {
    const orders = Array.isArray(props.orders) ? props.orders : [];
    const valid = orders.filter((o: any) => o.status !== 'cancelled');
    const revenue = valid.reduce((acc: number, o: any) => acc + (Number(o.total_pkr || o.total || 0)), 0);
    return { revenue, totalCount: orders.length };
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

      {/* ERROR FINDER */}
      {showLogs && (
        <div className="fixed inset-0 bg-black/95 z-[3000] p-6 flex flex-col animate-fadeIn">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-black italic uppercase text-blue-500">System Logs</h2>
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

      {/* TOASTS */}
      <div className="fixed top-20 left-0 right-0 z-[1000] px-6 pointer-events-none flex flex-col items-center space-y-2">
        {props.toasts?.map((t: any) => (
          <div key={t.id} className={`pointer-events-auto px-6 py-3 rounded-2xl shadow-2xl flex items-center justify-between border border-white/10 max-w-md w-full ${t.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'}`}>
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

      <main className="px-4 py-6 md:px-6">
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <div className="bg-white/5 border border-white/10 p-8 rounded-[2.5rem] relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform"><i className="fas fa-coins text-6xl"></i></div>
              <p className="text-[10px] font-black uppercase text-white/30 tracking-[0.2em] mb-2">Portfolio Value</p>
              <h3 className="text-4xl font-black italic">Rs. {analytics.revenue.toLocaleString()}</h3>
            </div>
            <button onClick={() => setActiveTab('products')} className="w-full bg-blue-600/10 border border-blue-500/20 p-8 rounded-[2.5rem] flex items-center justify-between group">
              <span className="text-xs font-black uppercase text-blue-500">Catalog Inventory</span>
              <span className="text-2xl font-black italic group-hover:translate-x-2 transition-transform">{props.products.length} Items <i className="fas fa-chevron-right text-xs ml-2"></i></span>
            </button>
          </div>
        )}

        {activeTab === 'products' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-black italic uppercase text-blue-500 tracking-tighter">Active Manifest</h3>
              <button onClick={() => setEditingProduct({ name: '', description: '', price: 0, image: '', images: [], category: 'Luxury Artisan', inventory: 10, variants: [] })} className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-2xl"><i className="fas fa-plus"></i></button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {props.products.map((p: Product) => (
                <div key={p.id} className="bg-white/5 border border-white/10 rounded-[2rem] overflow-hidden">
                  <div className="h-40 bg-white/5 relative">
                    <img src={p.image || 'https://via.placeholder.com/400'} className="w-full h-full object-cover" />
                    <button onClick={() => setEditingProduct(p)} className="absolute bottom-3 right-3 w-10 h-10 bg-black/60 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/10"><i className="fas fa-edit text-xs"></i></button>
                  </div>
                  <div className="p-4"><p className="text-[10px] font-black uppercase truncate italic">{p.name}</p><p className="text-[10px] font-black text-blue-500 mt-1">Rs. {p.price.toLocaleString()}</p></div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-2xl border border-white/10 px-10 py-5 rounded-full flex items-center space-x-16 z-[200] shadow-2xl">
        <button onClick={() => setActiveTab('analytics')} className={`flex flex-col items-center space-y-1.5 ${activeTab === 'analytics' ? 'text-blue-500' : 'text-white/20'}`}><i className="fas fa-chart-line text-xl"></i></button>
        <button onClick={() => setActiveTab('products')} className={`flex flex-col items-center space-y-1.5 ${activeTab === 'products' ? 'text-blue-500' : 'text-white/20'}`}><i className="fas fa-boxes text-xl"></i></button>
      </nav>

      {editingProduct && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl z-[1100] flex flex-col justify-end">
          <div className="bg-[#0a0a0a] w-full rounded-t-[3rem] p-8 space-y-8 animate-slideInTop overflow-y-auto max-h-[90vh] border-t border-white/10 custom-scrollbar">
            <div className="flex justify-between items-center">
               <h4 className="text-xl font-black italic uppercase text-blue-500 tracking-tighter">Refine Manifest</h4>
               <button onClick={() => setEditingProduct(null)} className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center"><i className="fas fa-times"></i></button>
            </div>
            
            <div className="space-y-6">
              <div className="flex space-x-4 overflow-x-auto py-2 no-scrollbar">
                <button 
                  onClick={handleMediaClick} disabled={isUploading}
                  className="w-24 h-24 bg-white/5 border border-dashed border-white/20 rounded-3xl flex flex-col items-center justify-center shrink-0"
                >
                  <i className={`fas ${isUploading ? 'fa-spinner fa-spin' : 'fa-camera-retro'} text-xl mb-1`}></i>
                  <span className="text-[8px] font-black uppercase">Add Photo</span>
                </button>
                {editingProduct.images?.map((img: string, i: number) => (
                  <div key={i} className="w-24 h-24 rounded-3xl overflow-hidden border border-white/10 shrink-0 relative group">
                    <img src={img} className="w-full h-full object-cover" />
                    <button onClick={() => setEditingProduct({...editingProduct, images: editingProduct.images.filter((_:any,idx:number)=>idx!==i)})} className="absolute inset-0 bg-red-600/80 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"><i className="fas fa-trash"></i></button>
                  </div>
                ))}
                <input 
                  type="file" multiple ref={fileInputRef} className="hidden" accept="image/*" 
                  onChange={async (e) => {
                    const files = e.target.files; if(!files) return;
                    setIsUploading(true);
                    for(let i=0; i<files.length; i++) {
                      const url = await props.uploadMedia(files[i]);
                      if(url) {
                        setEditingProduct(prev => ({ 
                          ...prev, 
                          images: [...(prev.images || []), url],
                          image: prev.image || url
                        }));
                      }
                    }
                    setIsUploading(false);
                    e.target.value = '';
                  }} 
                />
              </div>

              <div className="space-y-4 pb-12">
                <div className="space-y-1"><label className="text-[9px] font-black uppercase opacity-30 ml-3">Product Name</label><input type="text" className="w-full p-5 bg-white/5 rounded-2xl font-black border border-white/5 outline-none focus:border-blue-500/50" value={editingProduct.name} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1"><label className="text-[9px] font-black uppercase opacity-30 ml-3">Retail Price (PKR)</label><input type="number" className="w-full p-5 bg-white/5 rounded-2xl font-black border border-white/5 outline-none focus:border-blue-500/50" value={editingProduct.price} onChange={e => setEditingProduct({...editingProduct, price: Number(e.target.value)})} /></div>
                  <div className="space-y-1"><label className="text-[9px] font-black uppercase opacity-30 ml-3">Unit Stock</label><input type="number" className="w-full p-5 bg-white/5 rounded-2xl font-black border border-white/5 outline-none focus:border-blue-500/50" value={editingProduct.inventory} onChange={e => setEditingProduct({...editingProduct, inventory: Number(e.target.value)})} /></div>
                </div>
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
