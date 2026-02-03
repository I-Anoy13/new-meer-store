
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
  updateStatusOverride?: (orderId: string, status: Order['status']) => void;
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
  refreshData,
  updateStatusOverride
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'products' | 'orders' | 'settings'>('overview');
  const [dateRange, setDateRange] = useState<'today' | '7d' | '30d' | 'all'>('7d');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [isAudioUnlocked, setIsAudioUnlocked] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState<string | null>(null);
  
  const prevOrderCount = useRef(orders.length);

  const playAlert = () => {
    if (!isAudioUnlocked) return;
    const audio = new Audio(DEFAULT_ALERT_TONE);
    audio.play().catch(e => console.warn('Audio play failed:', e));
  };

  useEffect(() => {
    if (orders.length > prevOrderCount.current && prevOrderCount.current > 0) {
      playAlert();
    }
    prevOrderCount.current = orders.length;
  }, [orders.length]);

  const unlockAudio = () => {
    setIsAudioUnlocked(true);
    const audio = new Audio(DEFAULT_ALERT_TONE);
    audio.muted = true;
    audio.play().then(() => {
      audio.pause();
      audio.muted = false;
    }).catch(() => {});
  };

  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('All');

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopyStatus(field);
    setTimeout(() => setCopyStatus(null), 2000);
  };

  const handleStatusChange = async (orderId: string, status: Order['status'], dbId?: number) => {
    if (isUpdatingStatus) return;
    setIsUpdatingStatus(true);
    setUpdateSuccess(null);

    // 1. PERSIST LOCALLY FIRST (Absolute Priority)
    if (updateStatusOverride) {
      updateStatusOverride(orderId, status);
    }

    // 2. UPDATE OPTIMISTIC STATE (Immediate UI Refresh)
    // We update the local orders array so the change is visible immediately in the ledger
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
    
    // We also update the viewing order so the modal shows the change immediately
    if (viewingOrder?.id === orderId) {
      setViewingOrder(prev => prev ? { ...prev, status } : null);
    }

    try {
      // 3. SILENT DB SYNC
      // We attempt to update the database, but if it fails, our Local Override handles the view.
      const dbStatus = status.toLowerCase();
      
      let query = supabase.from('orders').update({ status: dbStatus });
      if (dbId) {
        query = query.eq('id', dbId);
      } else {
        query = query.eq('order_id', orderId);
      }

      const { error } = await query;
      if (error) {
        console.warn(`Database sync skipped for ${orderId}:`, error.message);
      } else {
        console.log(`Persistence sequence confirmed for: ${orderId}`);
        setUpdateSuccess(`${status} Saved`);
      }
      
      // We DON'T call refreshData() here to prevent the UI from "directing back" 
      // or resetting the modal state. The local update is enough.

      setTimeout(() => setUpdateSuccess(null), 3000);
    } catch (error: any) {
      console.warn("DB Background Sync failed. Local persistence remains active.");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const analyticsData = useMemo(() => {
    const revenue = orders.reduce((sum, o) => sum + o.total, 0);
    const count = orders.length;
    const chartMap: Record<string, number> = {};
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - i);
      return d.toLocaleDateString('en-US', { weekday: 'short' });
    }).reverse();
    last7Days.forEach(day => chartMap[day] = 0);
    orders.forEach(o => {
      const day = new Date(o.date).toLocaleDateString('en-US', { weekday: 'short' });
      if (chartMap.hasOwnProperty(day)) chartMap[day] += o.total;
    });
    return { revenue, count, chartData: Object.entries(chartMap).map(([name, value]) => ({ name, value })) };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    let result = [...orders];
    if (orderSearch) {
      const s = orderSearch.toLowerCase();
      result = result.filter(o => o.customer.name.toLowerCase().includes(s) || o.id.toLowerCase().includes(s));
    }
    if (orderStatusFilter !== 'All') result = result.filter(o => o.status === orderStatusFilter);
    return result;
  }, [orders, orderSearch, orderStatusFilter]);

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-32 flex flex-col items-center">
        <h2 className="text-2xl font-serif italic font-bold uppercase mb-8 text-black">Console Secure Login</h2>
        <form onSubmit={(e) => { e.preventDefault(); if (adminPasswordInput === systemPassword) login(UserRole.ADMIN); }} className="w-full max-w-xs space-y-4">
          <input type="password" placeholder="Passkey" required className="w-full p-6 bg-white border border-gray-100 rounded-2xl font-black text-center outline-none shadow-sm text-black italic" value={adminPasswordInput} onChange={(e) => setAdminPasswordInput(e.target.value)} />
          <button type="submit" className="w-full p-6 bg-black text-white rounded-2xl font-black uppercase tracking-widest hover:bg-blue-600 transition shadow-xl italic">Verify Merchant</button>
        </form>
      </div>
    );
  }

  return (
    <div className="bg-[#fafafa] min-h-screen pb-24 text-black overflow-x-hidden">
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
            {['overview', 'products', 'orders', 'settings'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab as any)} className={`flex-1 lg:flex-none px-4 py-2 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-black text-white shadow-md' : 'text-gray-400 hover:text-black'}`}>
                {tab}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-8 animate-fadeIn">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
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
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h2 className="text-xl font-serif italic font-bold uppercase">Order Ledger</h2>
              <div className="bg-white rounded-xl border border-gray-200 px-4 py-2 w-full sm:w-64 flex items-center shadow-sm">
                <i className="fas fa-search text-gray-300 mr-2 text-[10px]"></i>
                <input type="text" placeholder="Search ID or Name..." className="bg-transparent w-full text-[9px] font-bold uppercase outline-none" value={orderSearch} onChange={e => setOrderSearch(e.target.value)} />
              </div>
            </div>

            <div className="space-y-3">
               {filteredOrders.length > 0 ? filteredOrders.map(o => (
                 <div key={o.id} onClick={() => setViewingOrder(o)} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm active:scale-[0.98] transition-all cursor-pointer hover:border-blue-200">
                    <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-50">
                       <span className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest italic shadow-sm transition-all duration-300 ${
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
                          <p className="text-[7px] font-black uppercase text-gray-400 tracking-widest mb-1 italic">Amount Payable</p>
                          <p className="text-[10px] font-black text-blue-600 italic">Rs. {o.total.toLocaleString()}</p>
                       </div>
                    </div>
                 </div>
               )) : (
                 <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-gray-200">
                    <p className="text-[9px] font-black uppercase text-gray-400 tracking-widest italic">No matching order records</p>
                 </div>
               )}
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
                  <h2 className="text-xl font-serif font-bold italic uppercase text-black">Order Manifest</h2>
                  <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest italic mt-1">ID: #{viewingOrder.id}</p>
               </div>
               <button onClick={() => setViewingOrder(null)} className="w-8 h-8 bg-gray-50 rounded-full flex items-center justify-center hover:bg-black hover:text-white transition"><i className="fas fa-times text-xs"></i></button>
            </div>
            
            <div className="space-y-6 mb-8 text-black">
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
                    </div>
                  </div>
               </div>
            </div>
            
            <div className="bg-black text-white p-6 rounded-[1.5rem] flex flex-col sm:flex-row justify-between items-center gap-4">
               <div className="text-center sm:text-left">
                  <p className="text-[7px] font-black uppercase opacity-60 mb-1 italic tracking-widest">Update Order Status</p>
                  <p className="text-xl font-black italic">Rs. {viewingOrder.total.toLocaleString()}</p>
                  {updateSuccess && <p className="text-[8px] font-black uppercase text-green-400 animate-pulse mt-1"><i className="fas fa-check-circle"></i> {updateSuccess}</p>}
               </div>
               <div className="w-full sm:w-auto relative">
                  {isUpdatingStatus && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10 rounded-lg">
                      <i className="fas fa-circle-notch fa-spin text-white"></i>
                    </div>
                  )}
                  <select 
                    disabled={isUpdatingStatus}
                    value={viewingOrder.status} 
                    onChange={(e) => handleStatusChange(viewingOrder.id, e.target.value as any, viewingOrder.dbId)} 
                    className="w-full bg-white/10 border border-white/20 text-[9px] font-black uppercase px-6 py-3 rounded-lg outline-none italic cursor-pointer appearance-none text-center disabled:opacity-50"
                  >
                    {['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'].map(s => <option key={s} value={s} className="text-black">{s}</option>)}
                  </select>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
