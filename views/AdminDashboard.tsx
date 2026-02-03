
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Product, Order, User, UserRole, Variant } from '../types';
import { supabase } from '../lib/supabase';
import { PLACEHOLDER_IMAGE } from '../constants';

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

const PRESET_SOUNDS = [
  { name: 'Default Chime', url: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3' },
  { name: 'Elegant Bell', url: 'https://assets.mixkit.co/active_storage/sfx/1070/1070-preview.mp3' },
  { name: 'Digital Alert', url: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3' },
  { name: 'Store Bell', url: 'https://assets.mixkit.co/active_storage/sfx/133/133-preview.mp3' }
];

const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
  products, orders, user, login, systemPassword, setSystemPassword, refreshData, updateStatusOverride
}) => {
  // PERSISTENCE: Ensure we stay on the Orders tab
  const [activeTab, setActiveTab] = useState<'overview' | 'products' | 'orders' | 'settings'>(() => {
    return (localStorage.getItem('itx_admin_tab') as any) || 'orders';
  });

  // NOTIFICATION SETTINGS with Fallbacks
  const [selectedSoundUrl, setSelectedSoundUrl] = useState<string>(() => {
    return localStorage.getItem('itx_alert_url') || PRESET_SOUNDS[0].url;
  });
  const [customSoundBase64, setCustomSoundBase64] = useState<string | null>(() => {
    return localStorage.getItem('itx_custom_alert_b64');
  });
  const [isUsingCustom, setIsUsingCustom] = useState<boolean>(() => {
    return localStorage.getItem('itx_use_custom_alert') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('itx_admin_tab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    localStorage.setItem('itx_alert_url', selectedSoundUrl);
    localStorage.setItem('itx_use_custom_alert', String(isUsingCustom));
    if (customSoundBase64) {
      localStorage.setItem('itx_custom_alert_b64', customSoundBase64);
    }
  }, [selectedSoundUrl, isUsingCustom, customSoundBase64]);

  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState<string | null>(null);
  const [orderSearch, setOrderSearch] = useState('');
  const [isAudioUnlocked, setIsAudioUnlocked] = useState(false);

  const prevOrderCount = useRef(orders.length);

  // Safe Audio Playback Engine
  const playAlert = () => {
    if (!isAudioUnlocked) return;
    
    // Validate source to prevent "No supported source found" error
    const source = (isUsingCustom && customSoundBase64) ? customSoundBase64 : selectedSoundUrl;
    
    // Final safety check: if both sources are empty, use preset 0
    const finalSource = source && source.length > 10 ? source : PRESET_SOUNDS[0].url;

    try {
      const audio = new Audio(finalSource);
      audio.onerror = () => console.warn('Notification audio failed to load: Invalid source.');
      audio.play().catch(e => {
        // Silently handle autostart/load failures
        console.debug('Audio playback deferred:', e.message);
      });
    } catch (err) {
      console.warn('Audio construction failed.');
    }
  };

  useEffect(() => {
    if (orders.length > prevOrderCount.current && prevOrderCount.current > 0) {
      playAlert();
    }
    prevOrderCount.current = orders.length;
  }, [orders.length]);

  const unlockAudio = () => {
    setIsAudioUnlocked(true);
    const source = (isUsingCustom && customSoundBase64) ? customSoundBase64 : selectedSoundUrl;
    const finalSource = source && source.length > 10 ? source : PRESET_SOUNDS[0].url;
    
    try {
      const audio = new Audio(finalSource);
      audio.muted = true;
      audio.play().then(() => {
        audio.pause();
        audio.muted = false;
      }).catch(() => {});
    } catch (e) {}
  };

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopyStatus(field);
    setTimeout(() => setCopyStatus(null), 2000);
  };

  const handleCustomSoundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("Sound file too large (Max 2MB)");
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setCustomSoundBase64(base64);
        setIsUsingCustom(true);
        // Instant test
        new Audio(base64).play().catch(() => {});
      };
      reader.readAsDataURL(file);
    }
  };

  const handleStatusChange = async (orderId: string, status: Order['status'], dbId?: number) => {
    if (isUpdatingStatus) return;
    setIsUpdatingStatus(true);
    setUpdateSuccess(null);

    // 1. Update UI Instantly (Local Override)
    if (updateStatusOverride) {
      updateStatusOverride(orderId, status);
    }

    // 2. Keep the modal open and update its view
    if (viewingOrder?.id === orderId) {
      setViewingOrder(prev => prev ? { ...prev, status } : null);
    }

    try {
      // 3. Update Database Silently
      const dbStatus = status.toLowerCase();
      let query = supabase.from('orders').update({ status: dbStatus });
      
      if (dbId) query = query.eq('id', dbId);
      else query = query.eq('order_id', orderId);

      const { error } = await query;
      if (!error) {
        setUpdateSuccess(`${status} Confirmed`);
      }
      // Note: We avoid a hard refresh here to keep the user on the current Order page
      setTimeout(() => setUpdateSuccess(null), 3000);
    } catch (e) {
      console.warn("DB Update deferred. Change is saved locally.");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const analyticsData = useMemo(() => {
    const revenue = orders.reduce((sum, o) => sum + o.total, 0);
    const count = orders.length;
    return { revenue, count };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    let result = [...orders];
    if (orderSearch) {
      const s = orderSearch.toLowerCase();
      result = result.filter(o => o.customer.name.toLowerCase().includes(s) || o.id.toLowerCase().includes(s));
    }
    return result;
  }, [orders, orderSearch]);

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
          <div className="bg-blue-600 text-white p-4 rounded-2xl mb-8 flex items-center justify-between shadow-lg animate-fadeIn">
             <div className="flex items-center space-x-3">
                <i className="fas fa-bullhorn text-sm"></i>
                <p className="font-bold text-[9px] uppercase tracking-widest leading-tight">Authorize Real-Time Audio Alerts</p>
             </div>
             <button onClick={unlockAudio} className="bg-white text-blue-600 px-3 py-1.5 rounded-lg font-black uppercase text-[8px] tracking-widest shadow-md italic">Allow Audio</button>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 animate-fadeIn">
            <div className="bg-black text-white p-8 rounded-3xl shadow-xl">
              <p className="text-[9px] font-black uppercase opacity-60 mb-2 tracking-widest italic">Revenue Flow</p>
              <p className="text-3xl font-black italic">Rs. {analyticsData.revenue.toLocaleString()}</p>
            </div>
            <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
              <p className="text-[9px] font-black uppercase text-gray-400 mb-2 tracking-widest italic">Total Orders</p>
              <p className="text-3xl font-black italic">{analyticsData.count}</p>
            </div>
            <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
              <p className="text-[9px] font-black uppercase text-gray-400 mb-2 tracking-widest italic">Listings</p>
              <p className="text-3xl font-black italic">{products.length}</p>
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-serif italic font-bold uppercase">Order Ledger</h2>
              <input type="text" placeholder="Search ID..." className="bg-white rounded-xl border border-gray-200 px-4 py-2 text-[9px] font-bold uppercase outline-none shadow-sm w-48" value={orderSearch} onChange={e => setOrderSearch(e.target.value)} />
            </div>

            <div className="space-y-3">
               {filteredOrders.length > 0 ? filteredOrders.map(o => (
                 <div key={o.id} onClick={() => setViewingOrder(o)} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm active:scale-[0.98] transition-all cursor-pointer hover:border-blue-200">
                    <div className="flex justify-between items-center mb-4">
                       <span className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest italic shadow-sm ${
                         o.status === 'Pending' ? 'bg-yellow-400 text-white' : 
                         o.status === 'Cancelled' ? 'bg-red-500 text-white' :
                         'bg-green-600 text-white'
                       }`}>
                         {o.status}
                       </span>
                       <p className="text-blue-600 font-black text-xs">#{o.id}</p>
                    </div>
                    <div className="flex justify-between items-center">
                       <p className="text-[10px] font-black uppercase truncate italic text-black">{o.customer.name}</p>
                       <p className="text-[10px] font-black text-blue-600 italic">Rs. {o.total.toLocaleString()}</p>
                    </div>
                 </div>
               )) : <p className="text-center py-12 text-[9px] uppercase font-black text-gray-300 tracking-widest italic">No orders logged</p>}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-12 animate-fadeIn max-w-2xl mx-auto py-8">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
              <h3 className="text-sm font-black uppercase tracking-[0.2em] mb-6 text-black italic flex items-center">
                <i className="fas fa-lock mr-2 text-blue-600"></i> Authentication
              </h3>
              <div className="space-y-4">
                <label className="block text-[10px] font-black uppercase text-gray-400 italic">Master Console Passkey</label>
                <input 
                  type="password" 
                  className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 font-bold focus:outline-none focus:ring-2 focus:ring-black transition"
                  value={systemPassword}
                  onChange={(e) => setSystemPassword(e.target.value)}
                />
              </div>
            </div>

            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
              <h3 className="text-sm font-black uppercase tracking-[0.2em] mb-6 text-black italic flex items-center">
                <i className="fas fa-bell mr-2 text-blue-600"></i> Order Notifications
              </h3>
              <div className="space-y-8">
                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-400 italic mb-4">Alert Sound</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {PRESET_SOUNDS.map((sound) => (
                      <button 
                        key={sound.name}
                        onClick={() => {
                          setSelectedSoundUrl(sound.url);
                          setIsUsingCustom(false);
                          const audio = new Audio(sound.url);
                          audio.play().catch(() => {});
                        }}
                        className={`px-4 py-3 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all text-left flex justify-between items-center ${
                          !isUsingCustom && selectedSoundUrl === sound.url 
                            ? 'bg-black text-white border-black shadow-lg' 
                            : 'bg-white text-gray-500 border-gray-100 hover:border-blue-600'
                        }`}
                      >
                        {sound.name}
                        {(!isUsingCustom && selectedSoundUrl === sound.url) && <i className="fas fa-check-circle text-blue-400"></i>}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-50">
                  <label className="block text-[10px] font-black uppercase text-gray-400 italic mb-4">Custom Notification Tone</label>
                  <div className="flex flex-col sm:flex-row gap-4 items-center">
                    <label className="w-full sm:w-auto px-6 py-4 bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl cursor-pointer hover:border-blue-600 transition text-center group">
                      <input type="file" className="hidden" accept="audio/mpeg,audio/wav" onChange={handleCustomSoundUpload} />
                      <i className="fas fa-upload text-gray-300 group-hover:text-blue-600 mb-2 block"></i>
                      <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">Upload MP3/WAV</span>
                    </label>
                    
                    {customSoundBase64 && (
                      <button 
                        onClick={() => {
                          setIsUsingCustom(true);
                          new Audio(customSoundBase64).play().catch(() => {});
                        }}
                        className={`flex-grow px-6 py-4 rounded-2xl border flex items-center justify-between text-[9px] font-black uppercase tracking-widest transition-all ${
                          isUsingCustom 
                            ? 'bg-black text-white border-black shadow-lg' 
                            : 'bg-white text-gray-500 border-gray-100 hover:border-blue-600'
                        }`}
                      >
                        <span className="flex items-center"><i className="fas fa-music mr-3"></i> My Custom Tone</span>
                        <i className="fas fa-play-circle text-xs"></i>
                      </button>
                    )}
                  </div>
                  {customSoundBase64 && (
                    <button 
                      onClick={() => { setCustomSoundBase64(null); setIsUsingCustom(false); localStorage.removeItem('itx_custom_alert_b64'); }}
                      className="mt-4 text-[8px] font-black uppercase text-red-400 hover:text-red-600 transition tracking-widest italic"
                    >
                      Delete Custom Tone
                    </button>
                  )}
                </div>

                <div className="pt-4">
                  <button 
                    onClick={playAlert}
                    className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] italic shadow-xl hover:bg-blue-600 transition"
                  >
                    <i className="fas fa-volume-up mr-2"></i> Test Current Sound
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {viewingOrder && (
        <div className="fixed inset-0 z-[500] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-white rounded-t-[2rem] md:rounded-[2.5rem] w-full max-w-xl p-8 overflow-y-auto max-h-[92vh] md:max-h-[95vh] custom-scrollbar shadow-2xl">
            <div className="flex justify-between items-start mb-8 text-black">
               <div>
                  <h2 className="text-xl font-serif font-bold italic uppercase">Order Manifest</h2>
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
                  <div className="sm:col-span-2">
                    <p className="text-[7px] font-black uppercase text-gray-400 mb-1 italic tracking-widest px-1">Shipping Address</p>
                    <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100">
                       <p className="font-bold italic text-[10px] leading-relaxed text-black">{viewingOrder.customer.address}</p>
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
                  {isUpdatingStatus && <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10 rounded-lg"><i className="fas fa-circle-notch fa-spin text-white"></i></div>}
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
