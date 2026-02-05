import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { UserRole, Order, Product, Variant } from '../types';

/* 
 * ITX MASTER CONSOLE - PREMIER EDITION
 * Features: Real-time Streams, Custom Audio Alerts, Inventory CRUD w/ Variants.
 */

const AdminDashboard = (props: any) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [authKey, setAuthKey] = useState('');
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Instant Notification & Custom Sound State
  const [recentOrderAlert, setRecentOrderAlert] = useState<any>(null);
  const [muted, setMuted] = useState(false);
  const [customAlertBase64, setCustomAlertBase64] = useState<string | null>(() => localStorage.getItem('itx_custom_alert'));
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Product Form State (Restored full set)
  const [pName, setPName] = useState('');
  const [pPrice, setPPrice] = useState(0);
  const [pImage, setPImage] = useState('');
  const [pDesc, setPDesc] = useState('');
  const [pCat, setPCat] = useState('Luxury');
  const [pVariants, setPVariants] = useState<string>(''); // comma separated for simplicity

  // Analytics Engine
  const analytics = useMemo(() => {
    const valid = props.orders.filter((o: Order) => o.status !== 'Cancelled');
    const revenue = valid.reduce((acc: number, o: Order) => acc + (Number(o.total) || 0), 0);
    const pendingCount = props.orders.filter((o: Order) => o.status === 'Pending').length;
    const deliveredCount = props.orders.filter((o: Order) => o.status === 'Delivered').length;
    return { revenue, pendingCount, deliveredCount, total: props.orders.length };
  }, [props.orders]);

  // Audio Engine: Custom or Generated Ping
  const triggerAudioAlert = useCallback(() => {
    if (muted) return;
    
    if (customAlertBase64) {
      if (audioRef.current) {
        audioRef.current.play().catch(e => console.error("Audio error", e));
      }
    } else {
      // Fallback: Web Audio API generated high-fidelity ping
      try {
        const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1046.5, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + 0.4);
      } catch (err) { console.error('Ping fail:', err); }
    }
  }, [muted, customAlertBase64]);

  // Sound File Handler
  const handleSoundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const b64 = event.target?.result as string;
      setCustomAlertBase64(b64);
      localStorage.setItem('itx_custom_alert', b64);
      window.alert('Custom notification sound updated.');
    };
    reader.readAsDataURL(file);
  };

  // Browser Push Registration
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Real-time Order Synchronizer
  useEffect(() => {
    if (!props.user) return;
    const channel = supabase.channel('order_stream');
    channel.on('postgres_changes', 
      { event: 'INSERT', schema: 'public', table: 'orders' }, 
      (payload) => {
        const order = payload.new;
        props.refreshData(); 
        setRecentOrderAlert(order);
        triggerAudioAlert();
        
        if (Notification.permission === 'granted') {
          new Notification('NEW ORDER INBOUND', {
            body: `Rs. ${order.total_pkr || order.total} — ${order.customer_name}`,
            icon: 'https://images.unsplash.com/photo-1614164185128-e4ec99c436d7?w=128'
          });
        }
        setTimeout(() => setRecentOrderAlert(null), 12000);
      }
    ).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [props.user, props.refreshData, triggerAudioAlert]);

  if (!props.user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6">
        <div className="bg-white p-12 rounded-[3rem] shadow-2xl w-full max-w-sm border border-white/10 animate-fadeIn">
          <div className="text-center mb-10">
            <h1 className="text-2xl font-black uppercase tracking-tighter text-black italic">ITX CONSOLE</h1>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-2">Secured Access</p>
          </div>
          <div className="space-y-6">
            <input 
              type="password" value={authKey}
              onChange={(e) => setAuthKey(e.target.value)}
              placeholder="Security Key"
              className="w-full p-5 border-2 border-gray-100 rounded-3xl font-black text-center bg-gray-50 outline-none focus:border-blue-600 transition-all text-sm"
            />
            <button 
              onClick={() => {
                if (authKey === props.systemPassword) props.login(UserRole.ADMIN);
                else window.alert('Access Denied');
              }}
              className="w-full bg-black text-white p-5 rounded-3xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-blue-600 transition-all active:scale-95"
            >
              Verify Identity
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fcfcfc] text-black font-sans">
      <audio ref={audioRef} src={customAlertBase64 || undefined} />

      {/* TOP NOTIFICATION BAR */}
      {recentOrderAlert && (
        <div className="fixed top-0 left-0 right-0 z-[100] animate-slideInTop">
          <div className="bg-black text-white p-6 shadow-2xl flex items-center justify-between mx-auto max-w-4xl md:mt-4 md:rounded-[2.5rem] border border-white/10">
            <div className="flex items-center space-x-6">
              <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center animate-bounce">
                <i className="fas fa-shopping-bag"></i>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest opacity-50">Instant Order Detected</p>
                <p className="font-bold text-sm">#{recentOrderAlert.order_id} — {recentOrderAlert.customer_name}</p>
              </div>
            </div>
            <div className="flex items-center space-x-8">
              <div className="text-right">
                <p className="text-[9px] font-black uppercase opacity-40">Amount</p>
                <p className="font-black text-blue-400">Rs. {recentOrderAlert.total_pkr || recentOrderAlert.total}</p>
              </div>
              <button onClick={() => setRecentOrderAlert(null)} className="w-10 h-10 rounded-full hover:bg-white/10 transition"><i className="fas fa-times"></i></button>
            </div>
          </div>
          <div className="h-1 bg-blue-600 w-full md:max-w-4xl md:mx-auto md:rounded-full overflow-hidden mt-2 shadow-sm">
            <div className="h-full bg-white/40 animate-progress"></div>
          </div>
        </div>
      )}

      <header className="border-b h-20 flex items-center px-10 justify-between bg-white/80 backdrop-blur-2xl sticky top-0 z-40">
        <div className="flex items-center space-x-12">
          <h2 className="text-sm font-black italic tracking-tighter uppercase border-r pr-8">ITX MASTER</h2>
          <nav className="flex space-x-8 text-[11px] font-black uppercase tracking-widest">
            <button onClick={() => setActiveTab('overview')} className={activeTab === 'overview' ? 'text-blue-600 underline underline-offset-8' : 'text-gray-400'}>Overview</button>
            <button onClick={() => setActiveTab('orders')} className={activeTab === 'orders' ? 'text-blue-600 underline underline-offset-8' : 'text-gray-400'}>Orders</button>
            <button onClick={() => setActiveTab('inventory')} className={activeTab === 'inventory' ? 'text-blue-600 underline underline-offset-8' : 'text-gray-400'}>Inventory</button>
            <button onClick={() => setActiveTab('sys')} className={activeTab === 'sys' ? 'text-blue-600 underline underline-offset-8' : 'text-gray-400'}>System</button>
          </nav>
        </div>
        
        <div className="flex items-center space-x-6">
          <button onClick={() => setMuted(!muted)} className={`w-10 h-10 rounded-2xl border flex items-center justify-center transition ${muted ? 'bg-red-50 text-red-500 border-red-100' : 'text-gray-300'}`}>
            <i className={muted ? 'fas fa-volume-mute text-xs' : 'fas fa-volume-up text-xs'}></i>
          </button>
          <button onClick={props.refreshData} className="text-gray-400 hover:text-black transition uppercase text-[10px] font-black flex items-center">
            <i className="fas fa-sync-alt mr-2"></i> Sync
          </button>
        </div>
      </header>

      <main className="container mx-auto p-10 max-w-7xl">
        {activeTab === 'overview' && (
          <div className="animate-fadeIn space-y-10">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              {[
                { label: 'Revenue', val: `Rs. ${analytics.revenue.toLocaleString()}`, color: 'text-black' },
                { label: 'Orders', val: analytics.total, color: 'text-black' },
                { label: 'Pending', val: analytics.pendingCount, color: 'text-blue-600' },
                { label: 'Success Rate', val: `${analytics.total ? Math.round((analytics.deliveredCount / analytics.total) * 100) : 0}%`, color: 'text-black' }
              ].map((s, i) => (
                <div key={i} className="bg-white border p-8 rounded-[2.5rem] shadow-sm">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">{s.label}</p>
                  <p className={`text-3xl font-black tracking-tighter italic ${s.color}`}>{s.val}</p>
                </div>
              ))}
            </div>

            <div className="bg-white border p-10 rounded-[3.5rem] shadow-sm">
              <h3 className="font-black text-xs uppercase tracking-widest mb-8 text-gray-400">Activity Ledger</h3>
              <div className="space-y-6">
                {props.orders.slice(0, 5).map((o: Order) => (
                  <div key={o.id} className="flex items-center justify-between py-5 border-b border-gray-50 last:border-0">
                    <div className="flex items-center space-x-5">
                      <div className={`w-3 h-3 rounded-full ${o.status === 'Pending' ? 'bg-amber-400 animate-pulse' : 'bg-green-400'}`}></div>
                      <p className="text-sm font-bold uppercase tracking-tight">#{o.id} — {o.customer.name}</p>
                    </div>
                    <span className="text-[10px] font-black text-gray-300 uppercase">{new Date(o.date).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="space-y-6 animate-fadeIn">
            {props.orders.map((o: Order) => (
              <div key={o.id} onClick={() => setSelectedOrder(o)} className="bg-white border p-8 rounded-[2.8rem] flex flex-col md:flex-row justify-between items-start md:items-center gap-8 shadow-sm hover:shadow-xl transition-all cursor-pointer group">
                <div className="flex items-center space-x-6">
                  <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center font-black text-lg border group-hover:bg-blue-600 group-hover:text-white transition">
                    {String(o.status).charAt(0)}
                  </div>
                  <div>
                    <p className="font-black text-lg tracking-tighter">#{o.id}</p>
                    <p className="text-[11px] font-bold text-gray-400 uppercase mt-1 tracking-widest">{o.customer.name} — {o.customer.city}</p>
                    <p className="text-[10px] text-blue-600 font-bold mt-2 uppercase tracking-widest italic">{o.customer.phone}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-12 w-full md:w-auto border-t md:border-t-0 pt-6 md:pt-0">
                  <div className="text-right">
                    <p className="text-[10px] font-black text-gray-300 uppercase mb-1">Total Amount</p>
                    <p className="text-xl font-black">Rs. {o.total.toLocaleString()}</p>
                  </div>
                  <select 
                    value={o.status} 
                    onClick={(e) => e.stopPropagation()}
                    onChange={e => props.updateStatusOverride?.(o.id, e.target.value as any)}
                    className="border p-4 rounded-2xl text-[11px] font-black uppercase bg-gray-50 outline-none focus:ring-2 ring-blue-100 min-w-[150px]"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Confirmed">Confirmed</option>
                    <option value="Shipped">Shipped</option>
                    <option value="Delivered">Delivered</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'inventory' && (
          <div className="animate-fadeIn">
            <div className="flex justify-between items-center mb-12">
              <h3 className="font-black text-xs uppercase tracking-widest text-gray-400">Stock Management</h3>
              <button 
                onClick={() => setIsAddProductOpen(true)}
                className="bg-black text-white px-10 py-4 rounded-3xl text-[11px] font-black uppercase tracking-widest shadow-2xl hover:bg-blue-600 transition"
              >
                + New Product
              </button>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
              {props.products.map((itm: Product) => (
                <div key={itm.id} className="bg-white border p-6 rounded-[3rem] group relative shadow-sm hover:shadow-md transition">
                  <div className="aspect-square relative mb-6 overflow-hidden rounded-[2.2rem]">
                    <img src={itm.image} className="w-full h-full object-cover group-hover:scale-110 transition duration-700" alt="" />
                    <button onClick={(e) => { e.stopPropagation(); props.deleteProduct(itm.id); }} className="absolute top-4 right-4 bg-red-600 text-white w-10 h-10 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-xl">
                      <i className="fas fa-trash-alt text-xs"></i>
                    </button>
                  </div>
                  <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1.5">{itm.category}</p>
                  <p className="text-[13px] font-black truncate uppercase tracking-tight mb-2">{itm.name}</p>
                  <p className="text-[14px] font-black">Rs. {itm.price.toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'sys' && (
          <div className="max-w-2xl bg-white border p-12 rounded-[3.5rem] shadow-sm animate-fadeIn space-y-12">
            <div>
              <p className="text-[11px] font-black text-gray-400 mb-8 uppercase tracking-widest">Notification Settings</p>
              <div className="bg-gray-50 p-8 rounded-[2rem] border">
                <label className="block text-[9px] font-black uppercase text-gray-400 mb-4 tracking-widest">Custom Order Sound (.mp3/.wav)</label>
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                  <input type="file" accept="audio/*" onChange={handleSoundUpload} className="hidden" id="sound-upload" />
                  <label htmlFor="sound-upload" className="cursor-pointer bg-white border px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black hover:text-white transition shadow-sm">
                    {customAlertBase64 ? 'Replace Sound' : 'Upload Sound File'}
                  </label>
                  {customAlertBase64 && (
                    <div className="flex gap-2">
                      <button onClick={triggerAudioAlert} className="px-6 py-3 rounded-2xl bg-blue-50 text-blue-600 text-[10px] font-black uppercase">Play Test</button>
                      <button onClick={() => { localStorage.removeItem('itx_custom_alert'); setCustomAlertBase64(null); }} className="px-6 py-3 rounded-2xl bg-red-50 text-red-600 text-[10px] font-black uppercase">Reset</button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div>
              <p className="text-[11px] font-black text-gray-400 mb-8 uppercase tracking-widest">Security Configuration</p>
              <div className="flex gap-4">
                <input 
                  value={props.systemPassword} 
                  onChange={e => props.setSystemPassword(e.target.value)} 
                  className="border p-4 rounded-2xl w-full text-sm font-bold bg-gray-50 outline-none focus:border-blue-500" 
                  placeholder="Master Pass"
                />
                <button onClick={() => { localStorage.setItem('systemPassword', props.systemPassword); window.alert('Security Saved'); }} className="bg-black text-white px-10 rounded-2xl text-[10px] font-black uppercase">Save</button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* DETAILED ORDER MODAL */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-lg z-[60] flex items-center justify-center p-6 animate-fadeIn">
          <div className="bg-white p-12 rounded-[3.5rem] w-full max-w-2xl shadow-2xl relative overflow-y-auto max-h-[90vh]">
            <button onClick={() => setSelectedOrder(null)} className="absolute top-10 right-10 text-gray-300 hover:text-black text-2xl transition"><i className="fas fa-times"></i></button>
            <div className="flex items-center space-x-6 mb-12">
              <span className="text-3xl font-black italic tracking-tighter uppercase">Transaction Record</span>
              <span className="px-4 py-1.5 bg-blue-50 text-blue-600 text-[10px] font-black rounded-full uppercase tracking-widest">#{selectedOrder.id}</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-12">
              <div className="space-y-6">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-300 border-b pb-2">Customer Profile</h4>
                <div>
                  <p className="text-[10px] font-black uppercase text-gray-400 mb-1">Full Name</p>
                  <p className="font-bold text-sm">{selectedOrder.customer.name}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-gray-400 mb-1">Phone / WhatsApp</p>
                  <p className="font-bold text-sm text-blue-600">{selectedOrder.customer.phone}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-gray-400 mb-1">Shipping Address</p>
                  <p className="font-bold text-sm leading-relaxed">{selectedOrder.customer.address}, {selectedOrder.customer.city}</p>
                </div>
              </div>
              <div className="bg-gray-50 p-8 rounded-[2.5rem] border">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-300 border-b border-gray-100 pb-2 mb-6">Line Items</h4>
                <div className="space-y-4">
                  {selectedOrder.items.map((itm, i) => (
                    <div key={i} className="flex items-center space-x-4">
                      <img src={itm.product.image} className="w-12 h-12 rounded-xl object-cover border" />
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-tight">{itm.product.name}</p>
                        <p className="text-[9px] font-bold text-gray-400">Qty: {itm.quantity} — Rs. {itm.product.price.toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="flex justify-between items-center pt-10 border-t border-gray-100">
              <a href={`tel:${selectedOrder.customer.phone}`} className="bg-green-500 text-white px-8 py-4 rounded-3xl flex items-center justify-center hover:bg-green-600 transition shadow-lg text-[11px] font-black uppercase">
                <i className="fas fa-phone mr-2"></i> Contact Client
              </a>
              <div className="text-right">
                <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Payable (COD)</p>
                <p className="text-3xl font-black italic tracking-tighter">Rs. {selectedOrder.total.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD PRODUCT MODAL */}
      {isAddProductOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-lg z-[200] flex items-center justify-center p-6 animate-fadeIn">
          <div className="bg-white p-12 rounded-[4rem] w-full max-w-md shadow-2xl relative">
            <button onClick={() => setIsAddProductOpen(false)} className="absolute top-10 right-10 text-gray-300 hover:text-black text-2xl transition"><i className="fas fa-times"></i></button>
            <h3 className="text-3xl font-black italic tracking-tighter uppercase mb-10">Add to Collection</h3>
            <div className="space-y-5">
              <input className="w-full border p-4 rounded-2xl text-xs font-bold bg-gray-50 focus:border-blue-500 outline-none transition-all" placeholder="Product Title" value={pName} onChange={e => setPName(e.target.value)} />
              <input className="w-full border p-4 rounded-2xl text-xs font-bold bg-gray-50 focus:border-blue-500 outline-none transition-all" placeholder="Retail Price (PKR)" type="number" value={pPrice} onChange={e => setPPrice(Number(e.target.value))} />
              <input className="w-full border p-4 rounded-2xl text-xs font-bold bg-gray-50 focus:border-blue-500 outline-none transition-all" placeholder="Image URL" value={pImage} onChange={e => setPImage(e.target.value)} />
              <input className="w-full border p-4 rounded-2xl text-xs font-bold bg-gray-50 focus:border-blue-500 outline-none transition-all" placeholder="Variants (e.g. Gold, Silver)" value={pVariants} onChange={e => setPVariants(e.target.value)} />
              <textarea className="w-full border p-4 rounded-2xl text-xs font-bold bg-gray-50 focus:border-blue-500 outline-none h-24 resize-none transition-all" placeholder="Short Description" value={pDesc} onChange={e => setPDesc(e.target.value)} />
              <select className="w-full border p-4 rounded-2xl text-xs font-bold bg-gray-50" value={pCat} onChange={e => setPCat(e.target.value)}>
                <option value="Luxury">Luxury Artisan</option>
                <option value="Minimalist">Minimalist / Heritage</option>
                <option value="Professional">Professional Series</option>
              </select>
              <button 
                className="w-full bg-black text-white p-5 rounded-3xl font-black text-xs uppercase tracking-widest mt-6 shadow-2xl shadow-black/20 hover:bg-blue-600 transition-all hover:scale-105 active:scale-95"
                onClick={async () => {
                  if(!pName || !pPrice || !pImage) return window.alert('Details missing.');
                  // Parse variants
                  const variantArr: Variant[] = pVariants.split(',').filter(v => v.trim()).map(v => ({
                    id: `v-${Math.random().toString(36).substr(2, 5)}`,
                    name: v.trim(),
                    price: pPrice
                  }));
                  
                  const { error } = await supabase.from('products').insert([{ 
                    name: pName, price_pkr: pPrice, image: pImage, 
                    description: pDesc || pName, category: pCat, inventory: 15,
                    variants: variantArr
                  }]);
                  if (error) window.alert('Error: ' + error.message);
                  else { props.refreshData(); setIsAddProductOpen(false); setPName(''); setPPrice(0); setPImage(''); setPVariants(''); setPDesc(''); }
                }}
              >
                Publish Live
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
