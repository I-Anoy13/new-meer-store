
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Product, Order, User, UserRole, Variant } from '../types';
import { supabase } from '../lib/supabase';
import { PLACEHOLDER_IMAGE } from '../constants';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';

interface AdminDashboardProps {
  products: Product[];
  setProducts: (action: React.SetStateAction<Product[]>) => void;
  deleteProduct: (productId: string) => void;
  orders: Order[];
  setOrders: (action: React.SetStateAction<Order[]>) => void;
  user: User | null;
  login: (role: UserRole) => void;
  systemPassword: string;
  setSystemPassword: (pwd: string) => void;
  refreshData: () => void;
}

const DEFAULT_ALERT_TONE = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';

const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
  products, 
  setProducts, 
  deleteProduct, 
  orders, 
  setOrders, 
  user, 
  login, 
  systemPassword, 
  setSystemPassword,
  refreshData
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'products' | 'orders' | 'settings'>('overview');
  const [dateRange, setDateRange] = useState<'today' | '7d' | '30d' | 'all'>('7d');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [isAudioUnlocked, setIsAudioUnlocked] = useState(false);
  
  // Notification Settings
  const [notificationsEnabled] = useState(() => {
    return localStorage.getItem('itx_notifications_enabled') === 'true';
  });
  const [customTone] = useState<string | null>(() => {
    return localStorage.getItem('itx_custom_tone');
  });

  const prevOrderCount = useRef(orders.length);

  // Audio Playback Logic
  const playAlert = () => {
    if (!notificationsEnabled || !isAudioUnlocked) return;
    const toneToPlay = customTone || DEFAULT_ALERT_TONE;
    const audio = new Audio(toneToPlay);
    audio.play().catch(e => console.warn('Audio play failed:', e));
  };

  // Watch for new orders and play sound
  useEffect(() => {
    if (orders.length > prevOrderCount.current && prevOrderCount.current > 0) {
      playAlert();
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("NEW ORDER RECEIVED", {
          body: `Order from ${orders[0].customer.name} - Rs. ${orders[0].total.toLocaleString()}`,
          icon: "/favicon.ico"
        });
      }
    }
    prevOrderCount.current = orders.length;
  }, [orders.length]);

  const unlockAudio = () => {
    setIsAudioUnlocked(true);
    const audio = new Audio(customTone || DEFAULT_ALERT_TONE);
    audio.muted = true;
    audio.play().then(() => {
      audio.pause();
      audio.muted = false;
    }).catch(() => {});
  };

  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('All');
  const [newPassword, setNewPassword] = useState('');

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopyStatus(field);
    setTimeout(() => setCopyStatus(null), 2000);
  };

  const handleStatusChange = async (orderId: string, status: Order['status']) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
    if (viewingOrder?.id === orderId) {
      setViewingOrder(prev => prev ? { ...prev, status } : null);
    }
    await supabase.from('orders').update({ status: status.toLowerCase() }).eq('order_id', orderId);
  };

  const analyticsData = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const filteredByDate = orders.filter(o => {
      const orderTime = new Date(o.date).getTime();
      if (dateRange === 'today') return orderTime >= today;
      if (dateRange === '7d') return orderTime >= today - (7 * 24 * 60 * 60 * 1000);
      if (dateRange === '30d') return orderTime >= today - (30 * 24 * 60 * 60 * 1000);
      return true;
    });
    const revenue = filteredByDate.reduce((sum, o) => sum + o.total, 0);
    const count = filteredByDate.length;
    const chartMap: Record<string, number> = {};
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - i);
      return d.toLocaleDateString('en-US', { weekday: 'short' });
    }).reverse();
    last7Days.forEach(day => chartMap[day] = 0);
    filteredByDate.forEach(o => {
      const day = new Date(o.date).toLocaleDateString('en-US', { weekday: 'short' });
      if (chartMap.hasOwnProperty(day)) chartMap[day] += o.total;
    });
    return { revenue, count, chartData: Object.entries(chartMap).map(([name, value]) => ({ name, value })) };
  }, [orders, dateRange]);

  const filteredOrders = useMemo(() => {
    let result = [...orders];
    if (orderSearch) {
      const s = orderSearch.toLowerCase();
      result = result.filter(o => o.customer.name.toLowerCase().includes(s) || o.id.toLowerCase().includes(s) || (o.customer.city && o.customer.city.toLowerCase().includes(s)));
    }
    if (orderStatusFilter !== 'All') result = result.filter(o => o.status === orderStatusFilter);
    return result;
  }, [orders, orderSearch, orderStatusFilter]);

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-32 flex flex-col items-center">
        <h2 className="text-2xl md:text-3xl font-serif italic font-bold uppercase mb-8 text-black">Console Secure Login</h2>
        <form onSubmit={(e) => { e.preventDefault(); if (adminPasswordInput === systemPassword) login(UserRole.ADMIN); }} className="w-full max-w-xs space-y-4">
          <input type="password" placeholder="Passkey" required className="w-full p-6 bg-white border border-gray-100 rounded-2xl font-black text-center outline-none shadow-sm text-black italic" value={adminPasswordInput} onChange={(e) => setAdminPasswordInput(e.target.value)} />
          <button type="submit" className="w-full p-6 bg-black text-white rounded-2xl font-black uppercase tracking-widest hover:bg-blue-600 transition shadow-xl italic">Verify Merchant</button>
        </form>
      </div>
    );
  }

  return (
    <div className="bg-[#fafafa] min-h-screen pb-24 text-black overflow-x-hidden">
      {/* Mobile Top Stats - Clean Professional Design */}
      <div className="md:hidden grid grid-cols-2 gap-2 p-2 pt-4 sticky top-16 z-30 bg-[#fafafa]/90 backdrop-blur-md border-b border-gray-100">
         <div className="bg-black text-white p-4 rounded-xl shadow-lg flex flex-col justify-center">
            <p className="text-[7px] font-black uppercase opacity-60 tracking-widest italic mb-0.5">Live Sales</p>
            <p className="text-xs font-black italic">Rs. {analyticsData.revenue.toLocaleString()}</p>
         </div>
         <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-center">
            <p className="text-[7px] font-black uppercase text-gray-400 tracking-widest italic mb-0.5">Orders</p>
            <p className="text-xs font-black italic">{analyticsData.count}</p>
         </div>
      </div>

      <div className="container mx-auto px-4 md:px-8 py-4 md:py-12">
        {!isAudioUnlocked && (
          <div className="bg-blue-600 text-white p-4 rounded-2xl mb-8 flex items-center justify-between shadow-lg animate-pulse">
             <div className="flex items-center space-x-3">
                <i className="fas fa-bullhorn text-sm"></i>
                <p className="font-bold text-[9px] uppercase tracking-widest leading-tight">Authorize Real-Time Audio Alerts</p>
             </div>
             <button onClick={unlockAudio} className="bg-white text-blue-600 px-3 py-1.5 rounded-lg font-black uppercase text-[8px] tracking-widest shadow-md italic">Allow</button>
          </div>
        )}

        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4">
          <div className="space-y-0.5">
            <h1 className="text-2xl font-serif font-bold italic">ITX <span className="text-blue-600">Console</span></h1>
            <p className="text-[8px] font-black uppercase tracking-[0.2em] text-gray-400 italic">Merchant Master Protocol</p>
          </div>
          
          <div className="flex bg-white rounded-xl p-1 border border-gray-200 shadow-sm w-full lg:w-auto overflow-x-auto no-scrollbar">
            {['overview', 'listings', 'orders', 'settings'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab === 'listings' ? 'products' : tab as any)} className={`flex-1 lg:flex-none px-4 py-2 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${((activeTab === 'products' && tab === 'listings') || activeTab === tab) ? 'bg-black text-white shadow-md' : 'text-gray-400 hover:text-black'}`}>
                {tab}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-8 animate-fadeIn">
            <div className="hidden md:grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-black text-white p-8 rounded-3xl shadow-xl">
                <p className="text-[9px] font-black uppercase opacity-60 mb-2 tracking-widest">Revenue Flow</p>
                <p className="text-3xl font-black italic">Rs. {analyticsData.revenue.toLocaleString()}</p>
              </div>
              <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
                <p className="text-[9px] font-black uppercase text-gray-400 mb-2 tracking-widest italic">Order Count</p>
                <p className="text-3xl font-black italic">{analyticsData.count}</p>
              </div>
              <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
                <p className="text-[9px] font-black uppercase text-gray-400 mb-2 tracking-widest italic">Live Listings</p>
                <p className="text-3xl font-black italic">{products.length}</p>
              </div>
            </div>

            <div className="bg-white p-6 md:p-10 rounded-3xl border border-gray-100 shadow-sm">
                <h3 className="text-[10px] font-black uppercase tracking-widest mb-10 italic">Analytics Distribution</h3>
                <div className="h-[250px] md:h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analyticsData.chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 8, fontWeight: 900, fill: '#9ca3af'}} />
                      <YAxis axisLine={false} tickLine={false} tick={{fontSize: 8, fontWeight: 900, fill: '#9ca3af'}} />
                      <Tooltip />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {analyticsData.chartData.map((_, index) => <Cell key={`cell-${index}`} fill={index === analyticsData.chartData.length - 1 ? '#2563eb' : '#000'} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
            </div>
          </div>
        )}

        {activeTab === 'products' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-serif italic font-bold uppercase">Listings</h2>
              <button onClick={() => setIsModalOpen(true)} className="bg-black text-white px-5 py-2.5 rounded-xl text-[8px] font-black uppercase tracking-widest shadow-lg italic">+ New Listing</button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
               {products.map(p => (
                 <div key={p.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center space-x-4">
                    <img src={p.image} className="w-14 h-14 rounded-xl object-cover border" />
                    <div className="flex-grow min-w-0">
                       <p className="font-black uppercase text-[10px] truncate italic text-black">{p.name}</p>
                       <p className="text-[8px] font-bold text-gray-400 uppercase italic">Availability: {p.inventory}</p>
                       <p className="text-[10px] font-black mt-1 italic text-blue-600">Rs. {p.price.toLocaleString()}</p>
                    </div>
                    <button onClick={() => deleteProduct(p.id)} className="text-red-500 p-2"><i className="fas fa-trash-alt text-sm"></i></button>
                 </div>
               ))}
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h2 className="text-xl font-serif italic font-bold uppercase">Order Ledger</h2>
              <div className="bg-white rounded-xl border border-gray-200 px-4 py-2 w-full sm:w-64 flex items-center shadow-sm">
                <i className="fas fa-search text-gray-300 mr-2 text-[10px]"></i>
                <input type="text" placeholder="Search ID, Name or City..." className="bg-transparent w-full text-[9px] font-bold uppercase outline-none" value={orderSearch} onChange={e => setOrderSearch(e.target.value)} />
              </div>
            </div>

            {/* HIGH-VISIBILITY MOBILE CARDS: STATUS & ID FIRST */}
            <div className="space-y-3">
               {filteredOrders.length > 0 ? filteredOrders.map(o => (
                 <div key={o.id} onClick={() => setViewingOrder(o)} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm active:scale-[0.98] transition-all cursor-pointer">
                    {/* TOP ROW: STATUS AND ID */}
                    <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-50">
                       <span className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest italic shadow-sm ${
                         o.status === 'Pending' ? 'bg-yellow-400 text-white' : 
                         o.status === 'Cancelled' ? 'bg-red-500 text-white' :
                         'bg-green-600 text-white'
                       }`}>
                         {o.status}
                       </span>
                       <p className="text-blue-600 font-black text-xs">#{o.id}</p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                       <div>
                          <p className="text-[7px] font-black uppercase text-gray-400 tracking-widest mb-1 italic">Recipient Name</p>
                          <p className="text-[10px] font-black uppercase truncate italic text-black">{o.customer.name}</p>
                       </div>
                       <div>
                          <p className="text-[7px] font-black uppercase text-gray-400 tracking-widest mb-1 italic">Shipping City</p>
                          <p className="text-[10px] font-black uppercase text-blue-600 italic truncate">{o.customer.city || 'N/A'}</p>
                       </div>
                    </div>
                    
                    <div className="mt-4 flex justify-between items-center">
                       <div className="flex flex-col">
                          <p className="text-[7px] font-black uppercase text-gray-400 italic">Total Amount (COD)</p>
                          <p className="font-black italic text-[11px] text-black">Rs. {o.total.toLocaleString()}</p>
                       </div>
                       <i className="fas fa-chevron-right text-gray-200 text-xs"></i>
                    </div>
                 </div>
               )) : (
                 <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-gray-200">
                    <i className="fas fa-box-open text-3xl text-gray-100 mb-4"></i>
                    <p className="text-[9px] font-black uppercase text-gray-400 tracking-widest italic">No matching order records</p>
                 </div>
               )}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fadeIn">
            <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm">
              <h2 className="text-xl font-serif italic font-bold mb-6 uppercase italic">Protocol Settings</h2>
              <form onSubmit={(e) => { e.preventDefault(); if (newPassword) { setSystemPassword(newPassword); alert("Master passkey updated."); } }} className="space-y-6">
                <div>
                   <label className="block text-[8px] font-black uppercase text-gray-400 mb-2 italic tracking-widest px-1">Merchant Master Passkey</label>
                   <input type="password" required className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 font-bold outline-none italic" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                </div>
                <button type="submit" className="w-full bg-black text-white py-4 rounded-xl text-[9px] font-black uppercase italic hover:bg-blue-600 shadow-xl tracking-widest transition">Update Access Protocol</button>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* Order Detail Overlay */}
      {viewingOrder && (
        <div className="fixed inset-0 z-[500] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-white rounded-t-[2rem] md:rounded-[2.5rem] w-full max-w-xl p-8 overflow-y-auto max-h-[92vh] md:max-h-[95vh] custom-scrollbar shadow-2xl">
            <div className="flex justify-between items-start mb-8">
               <div>
                  <h2 className="text-xl font-serif font-bold italic uppercase italic text-black">Order Manifest</h2>
                  <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest italic mt-1">ID: #{viewingOrder.id}</p>
               </div>
               <button onClick={() => setViewingOrder(null)} className="w-8 h-8 bg-gray-50 rounded-full flex items-center justify-center hover:bg-black hover:text-white transition"><i className="fas fa-times text-xs"></i></button>
            </div>
            
            <div className="space-y-6 mb-8">
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {['name', 'phone', 'city'].map((f) => (
                    <div key={f}>
                      <p className="text-[7px] font-black uppercase text-gray-400 mb-1 italic tracking-widest px-1">{f}</p>
                      <div className="flex items-center justify-between bg-gray-50 p-3.5 rounded-xl border border-gray-100">
                        <p className="font-black uppercase text-[11px] italic truncate text-black">{(viewingOrder.customer as any)[f] || 'N/A'}</p>
                        <button onClick={() => handleCopy((viewingOrder.customer as any)[f] || '', f)} className="text-gray-300 hover:text-blue-600 ml-2"><i className={`fas ${copyStatus === f ? 'fa-check text-green-500' : 'fa-copy'} text-[10px]`}></i></button>
                      </div>
                    </div>
                  ))}
                  <div>
                    <p className="text-[7px] font-black uppercase text-gray-400 mb-1 italic tracking-widest px-1">Full Shipping Address</p>
                    <div className="bg-gray-50 p-3.5 rounded-xl flex items-center justify-between border border-gray-100">
                       <p className="font-bold italic text-[9px] leading-relaxed line-clamp-2 text-black"> {viewingOrder.customer.address} </p>
                       <button onClick={() => handleCopy(viewingOrder.customer.address, 'address')} className="text-gray-300 hover:text-blue-600 ml-2 shrink-0"><i className={`fas ${copyStatus === 'address' ? 'fa-check text-green-500' : 'fa-copy'} text-[10px]`}></i></button>
                    </div>
                  </div>
               </div>
               
               <div>
                  <h3 className="text-[8px] font-black uppercase text-gray-400 mb-3 italic tracking-widest px-1">Reservation Contents</h3>
                  <div className="space-y-2">
                    {viewingOrder.items.map((it, i) => (
                      <div key={i} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <img src={it.product.image} className="w-10 h-10 rounded-lg object-cover border" />
                        <div className="flex-grow min-w-0">
                          <p className="font-black uppercase text-[9px] italic truncate text-black">{it.product.name}</p>
                          <p className="text-[7px] font-bold text-gray-400 uppercase italic mt-0.5">Edition: {it.variantName || 'Standard'}</p>
                        </div>
                        <p className="font-black text-[9px] italic whitespace-nowrap ml-2 text-black">Rs. {it.product.price.toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
               </div>
            </div>
            
            <div className="bg-black text-white p-6 rounded-[1.5rem] flex flex-col sm:flex-row justify-between items-center gap-4">
               <div className="text-center sm:text-left">
                  <p className="text-[7px] font-black uppercase opacity-60 mb-1 italic tracking-widest">To Collect (COD)</p>
                  <p className="text-xl font-black italic">Rs. {viewingOrder.total.toLocaleString()}</p>
               </div>
               <div className="w-full sm:w-auto">
                  <select value={viewingOrder.status} onChange={(e) => handleStatusChange(viewingOrder.id, e.target.value as any)} className="w-full bg-white/10 border border-white/20 text-[9px] font-black uppercase px-6 py-3 rounded-lg outline-none italic cursor-pointer appearance-none text-center">
                    {['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'].map(s => <option key={s} value={s} className="text-black">{s}</option>)}
                  </select>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* Listing Management Overlay */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
           <div className="bg-white rounded-[2rem] w-full max-w-md p-8 shadow-2xl">
              <div className="flex justify-between items-center mb-8 border-b pb-4">
                 <h2 className="text-xl font-serif italic font-bold uppercase italic text-black">New Listing Protocol</h2>
                 <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-black transition"><i className="fas fa-times"></i></button>
              </div>
              <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 mb-8">
                 <p className="text-[9px] font-black uppercase text-blue-800 tracking-widest italic mb-2">Listing Creation</p>
                 <p className="text-[10px] font-medium text-blue-700 italic">Merchant should finalize listing assets and inventory levels via standard console procedures.</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="w-full bg-black text-white py-4 rounded-xl font-black uppercase italic shadow-lg tracking-widest hover:bg-blue-600 transition">Return to Ledger</button>
           </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
