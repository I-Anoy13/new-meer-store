import React, { useState, useMemo, useEffect } from 'react';
import { Product, Order, User, UserRole } from '../types';
import { supabase } from '../lib/supabase';

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

const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
  products, setProducts, deleteProduct, orders, user, login, systemPassword, refreshData, updateStatusOverride
}) => {
  const [activeNav, setActiveNav] = useState('Home');
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null);
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [dateRange, setDateRange] = useState<'Today' | 'Yesterday' | 'Last 7 Days' | 'All Time'>('All Time');
  
  // Refined Notification State
  const [notificationStatus, setNotificationStatus] = useState<string>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'unsupported';
  });
  
  const [newProduct, setNewProduct] = useState({ name: '', price: '', category: 'Watches', description: '' });
  const [mainImageFile, setMainImageFile] = useState<File | null>(null);

  // Notification Engine - Safely handled for mobile
  useEffect(() => {
    if (user && notificationStatus === 'granted' && 'Notification' in window) {
      const channel = supabase
        .channel('admin-notifications-v2')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
          const newOrder = payload.new;
          try {
            // Check for service worker registration to show background notification if possible
            if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
               navigator.serviceWorker.ready.then(registration => {
                 // Fix: Removed 'vibrate' property to resolve TypeScript error 'NotificationOptions' does not contain 'vibrate'
                 registration.showNotification("🔔 New Order Received!", {
                   body: `${newOrder.customer_name} from ${newOrder.customer_city} spent Rs. ${newOrder.total_pkr}`,
                   icon: 'https://images.unsplash.com/photo-1614164185128-e4ec99c436d7?q=80&w=192&h=192&auto=format&fit=crop'
                 });
               });
            } else {
               new Notification("🔔 New Order Received!", {
                 body: `${newOrder.customer_name} from ${newOrder.customer_city} spent Rs. ${newOrder.total_pkr}`,
                 icon: 'https://images.unsplash.com/photo-1614164185128-e4ec99c436d7?q=80&w=192&h=192&auto=format&fit=crop'
               });
            }
          } catch (e) {
            console.warn("Notification failed", e);
          }
          refreshData();
        })
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [user, notificationStatus, refreshData]);

  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      setNotificationStatus(permission);
    } else {
      // Logic for iOS Safari: Tell them to Add to Home Screen
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isIOS) {
        alert("To enable notifications on iPhone:\n1. Tap 'Share' button\n2. Select 'Add to Home Screen'\n3. Open ITX from your home screen.");
      } else {
        alert("This browser does not support system notifications. Try Chrome or install the app.");
      }
    }
  };

  const menuItems = [
    { label: 'Home', icon: 'fa-house' },
    { label: 'Orders', icon: 'fa-shopping-cart', badge: orders.filter(o => o.status === 'Pending').length },
    { label: 'Products', icon: 'fa-box' },
    { label: 'Customers', icon: 'fa-user-group' },
    { label: 'Analytics', icon: 'fa-chart-line' },
  ];

  const handleRefresh = async () => {
    setIsRefreshing(true);
    refreshData();
    setTimeout(() => setIsRefreshing(false), 800);
  };

  const copyToClipboard = (text: string, fieldId: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 1500);
  };

  const filteredOrders = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterday = today - 86400000;
    const last7Days = today - (7 * 86400000);

    return orders.filter(order => {
      const orderDate = new Date(order.date).getTime();
      if (dateRange === 'Today') return orderDate >= today;
      if (dateRange === 'Yesterday') return orderDate >= yesterday && orderDate < today;
      if (dateRange === 'Last 7 Days') return orderDate >= last7Days;
      return true;
    });
  }, [orders, dateRange]);

  const totalSales = useMemo(() => filteredOrders.reduce((sum, o) => sum + o.total, 0), [filteredOrders]);

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mainImageFile) return alert("Please upload a product image.");
    setIsAddingProduct(true);
    try {
      const fileExt = mainImageFile.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('products').upload(`products/${fileName}`, mainImageFile);
      if (uploadError) throw uploadError;

      const { data: publicUrl } = supabase.storage.from('products').getPublicUrl(`products/${fileName}`);
      const payload = {
        name: newProduct.name,
        price_pkr: Number(newProduct.price),
        image: publicUrl.publicUrl,
        category: newProduct.category,
        description: newProduct.description,
        status: 'active',
        inventory: 10
      };
      const { data, error } = await supabase.from('products').insert([payload]).select();
      if (!error && data) {
        setProducts(prev => [...prev, {
          id: String(data[0].id),
          name: data[0].name,
          description: data[0].description,
          price: Number(data[0].price_pkr),
          image: data[0].image,
          category: data[0].category,
          inventory: 10,
          rating: 5,
          reviews: []
        }]);
        setNewProduct({ name: '', price: '', category: 'Watches', description: '' });
        setMainImageFile(null);
        alert("Product added successfully.");
        setActiveNav('Products');
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally { setIsAddingProduct(false); }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#f1f1f1] flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white p-10 rounded-[2rem] shadow-2xl border border-gray-100">
          <div className="text-center mb-10">
            <h1 className="text-3xl font-black italic tracking-tighter uppercase">ITX<span className="text-blue-600">STORE</span></h1>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-2">Admin Login</p>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); if (adminPasswordInput === systemPassword) login(UserRole.ADMIN); }} className="space-y-6">
            <input 
              type="password" 
              placeholder="Admin Password" 
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-4 text-center font-black focus:outline-none focus:border-black transition text-lg"
              value={adminPasswordInput}
              onChange={(e) => setAdminPasswordInput(e.target.value)}
            />
            <button type="submit" className="w-full bg-black text-white py-4 rounded-2xl font-black uppercase tracking-[0.2em] text-xs hover:bg-gray-800 transition shadow-lg active:scale-[0.98]">Access Store Manager</button>
          </form>
        </div>
      </div>
    );
  }

  const CopyBtn = ({ text, id }: { text: string, id: string }) => (
    <button onClick={(e) => { e.stopPropagation(); copyToClipboard(text, id); }} className={`ml-2 p-1.5 transition-all ${copiedField === id ? 'text-green-600 bg-green-50' : 'text-gray-400 hover:text-black hover:bg-gray-100'} rounded-lg`}>
      <i className={`fas ${copiedField === id ? 'fa-check' : 'fa-copy'} text-[10px]`}></i>
    </button>
  );

  return (
    <div className="flex h-screen bg-[#f6f6f7] text-[#1a1c1d] overflow-hidden font-sans relative">
      {isSidebarOpen && <div className="fixed inset-0 bg-black/40 z-[100] lg:hidden backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)}></div>}
      
      {/* SIDEBAR */}
      <aside className={`fixed inset-y-0 left-0 w-[260px] bg-[#1a1c1d] flex flex-col shrink-0 z-[110] transition-transform duration-300 lg:translate-x-0 lg:static ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 bg-blue-600 text-white rounded-lg flex items-center justify-center text-lg font-black">I</div>
            <div className="font-black text-sm tracking-tight text-white uppercase">ITX Admin</div>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-gray-400"><i className="fas fa-times"></i></button>
        </div>
        <nav className="flex-grow px-3 py-6 space-y-1">
          {menuItems.map(item => (
            <button 
              key={item.label}
              onClick={() => { setActiveNav(item.label); setIsSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-xs font-bold transition-all ${activeNav === item.label ? 'bg-[#30373e] text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
            >
              <div className="flex items-center space-x-4">
                <i className={`fas ${item.icon} w-5 text-center ${activeNav === item.label ? 'text-blue-500' : 'text-gray-500'}`}></i>
                <span className="tracking-wide uppercase">{item.label}</span>
              </div>
              {item.badge ? <span className="bg-blue-600 text-white px-2 py-0.5 rounded text-[10px] font-black">{item.badge}</span> : null}
            </button>
          ))}
        </nav>
        
        {/* PWA / NOTIFICATION STATUS */}
        <div className="p-4 border-t border-gray-800">
           <button 
             onClick={requestNotificationPermission}
             className={`w-full flex items-center space-x-3 p-3 rounded-xl transition-all ${notificationStatus === 'granted' ? 'bg-green-500/10' : 'bg-yellow-500/10'}`}
           >
              <div className={`w-2 h-2 rounded-full ${notificationStatus === 'granted' ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : notificationStatus === 'unsupported' ? 'bg-red-500' : 'bg-yellow-500 animate-pulse shadow-[0_0_10px_rgba(234,179,8,0.5)]'}`}></div>
              <div className="text-left overflow-hidden">
                 <p className="text-[9px] font-black text-white uppercase tracking-widest truncate">
                    {notificationStatus === 'unsupported' ? 'Install ITX App' : 'Notifications'}
                 </p>
                 <p className="text-[8px] text-gray-400 uppercase font-bold truncate">
                    {notificationStatus === 'granted' ? 'System Active' : notificationStatus === 'unsupported' ? 'Add to Home Screen' : 'Setup Required'}
                 </p>
              </div>
           </button>
        </div>
      </aside>

      <div className="flex-grow flex flex-col min-w-0 w-full overflow-hidden">
        <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0 z-50">
          <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden text-gray-500 hover:text-black transition"><i className="fas fa-bars"></i></button>
          <div className="flex items-center space-x-6">
            <button onClick={handleRefresh} className={`text-gray-400 hover:text-black transition-all ${isRefreshing ? 'animate-spin' : ''}`}><i className="fas fa-sync-alt text-sm"></i></button>
            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-xs font-black border border-gray-200 uppercase tracking-tighter text-gray-500">ITX</div>
          </div>
        </header>

        <main className="flex-grow overflow-y-auto p-4 md:p-10 animate-fadeIn custom-scrollbar">
          {activeNav === 'Home' && (
            <div className="max-w-6xl mx-auto space-y-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h2 className="text-2xl font-black tracking-tight uppercase">Store Overview</h2>
                <div className="flex items-center bg-white rounded-xl border border-gray-200 p-1 shadow-sm overflow-x-auto no-scrollbar">
                  {(['Today', 'Yesterday', 'Last 7 Days', 'All Time'] as const).map((range) => (
                    <button 
                      key={range}
                      onClick={() => setDateRange(range)}
                      className={`whitespace-nowrap px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${dateRange === range ? 'bg-gray-100 text-black shadow-inner' : 'text-gray-400 hover:text-black hover:bg-gray-50'}`}
                    >
                      {range}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { label: 'Total Revenue', val: `Rs. ${totalSales.toLocaleString()}`, color: 'text-blue-600' },
                  { label: 'Total Orders', val: filteredOrders.length.toString(), color: 'text-gray-900' },
                  { label: 'Active Customers', val: [...new Set(filteredOrders.map(o => o.customer.phone))].length.toString(), color: 'text-gray-900' },
                  { label: 'Avg Order Value', val: `Rs. ${filteredOrders.length > 0 ? Math.round(totalSales / filteredOrders.length).toLocaleString() : 0}`, color: 'text-gray-400' },
                ].map((stat, i) => (
                  <div key={i} className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-4">{stat.label}</span>
                    <span className={`text-2xl font-black ${stat.color} tracking-tighter`}>{stat.val}</span>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-100 font-black uppercase text-[10px] tracking-widest text-gray-400">Recent Stream ({dateRange})</div>
                <div className="divide-y divide-gray-50">
                  {filteredOrders.slice(0, 5).map(o => (
                    <div key={o.id} onClick={() => setViewingOrder(o)} className="p-5 flex justify-between items-center hover:bg-gray-50 cursor-pointer transition">
                      <div className="min-w-0">
                        <p className="text-sm font-black text-gray-900 truncate">#{o.id} — {o.customer.name}</p>
                        <p className="text-[10px] text-gray-400 font-bold mt-1 uppercase tracking-widest">{o.customer.city} — {new Date(o.date).toLocaleDateString()}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className="text-sm font-black text-gray-900">Rs. {o.total.toLocaleString()}</span>
                        <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase border ${o.status === 'Pending' ? 'bg-yellow-50 text-yellow-600 border-yellow-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>{o.status}</span>
                      </div>
                    </div>
                  ))}
                  {filteredOrders.length === 0 && <div className="p-20 text-center text-gray-300 uppercase text-xs font-black">No transaction stream found for this period</div>}
                </div>
              </div>
            </div>
          )}

          {activeNav === 'Orders' && (
            <div className="max-w-6xl mx-auto space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-black tracking-tight uppercase">Order Management</h2>
                <div className="text-[10px] font-black uppercase text-gray-400 tracking-widest bg-white px-4 py-2 rounded-xl border border-gray-100 shadow-sm">
                  Total: {orders.length} Orders
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs min-w-[800px]">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400 tracking-widest">Order ID / Status</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400 tracking-widest">Customer Details</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400 tracking-widest">Shipping City</th>
                        <th className="px-6 py-4 text-right text-[10px] font-black uppercase text-gray-400 tracking-widest">Order Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {orders.map(o => (
                        <tr key={o.id} onClick={() => setViewingOrder(o)} className="hover:bg-gray-50 cursor-pointer transition">
                          <td className="px-6 py-5">
                            <div className="flex flex-col space-y-1">
                              <span className="font-black text-blue-600 text-sm">#{o.id}</span>
                              <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black w-fit uppercase border ${o.status === 'Pending' ? 'bg-yellow-50 text-yellow-600 border-yellow-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>{o.status}</span>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <div className="font-black uppercase tracking-tight text-gray-900">{o.customer.name}</div>
                            <div className="text-[10px] text-gray-400 mt-1 font-bold tracking-widest">{o.customer.phone}</div>
                          </td>
                          <td className="px-6 py-5">
                            <div className="font-black uppercase tracking-widest text-gray-700 text-[11px]">{o.customer.city || 'N/A'}</div>
                          </td>
                          <td className="px-6 py-5 text-right font-black text-sm text-gray-900">Rs. {o.total.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeNav === 'Products' && (
            <div className="max-w-6xl mx-auto space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-black tracking-tight uppercase">Product Catalog</h2>
                <button onClick={() => setActiveNav('AddProduct')} className="bg-black text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-800 transition shadow-lg active:scale-95">Add New Product</button>
              </div>
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400 tracking-widest">Product Info</th>
                      <th className="px-6 py-4 text-center text-[10px] font-black uppercase text-gray-400 tracking-widest">Price</th>
                      <th className="px-6 py-4 text-center text-[10px] font-black uppercase text-gray-400 tracking-widest">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {products.map(p => (
                      <tr key={p.id}>
                        <td className="px-6 py-5 flex items-center space-x-4">
                          <img src={p.image} className="w-12 h-12 rounded-xl object-cover border border-gray-100 shadow-sm" />
                          <span className="font-black text-gray-900 uppercase tracking-tight">{p.name}</span>
                        </td>
                        <td className="px-6 py-5 text-center font-bold text-gray-900">Rs. {p.price.toLocaleString()}</td>
                        <td className="px-6 py-5 text-center">
                          <button onClick={() => { if(window.confirm('Delete this product permanently?')) deleteProduct(p.id); }} className="text-red-400 hover:text-red-600 p-2 transition-colors"><i className="fas fa-trash-can"></i></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeNav === 'AddProduct' && (
            <div className="max-w-3xl mx-auto space-y-8 pb-20">
              <h2 className="text-2xl font-black tracking-tight uppercase">Add New Product</h2>
              <div className="bg-white p-8 rounded-[2rem] border border-gray-200 shadow-sm space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-6">
                    <div>
                      <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 tracking-widest">Product Name</label>
                      <input type="text" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-5 py-4 text-sm font-black outline-none focus:border-black" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} placeholder="e.g. MEER Royal Oak" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 tracking-widest">Retail Price (PKR)</label>
                      <input type="number" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-5 py-4 text-sm font-black outline-none focus:border-black" value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: e.target.value})} placeholder="45000" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 tracking-widest">Category</label>
                      <select className="w-full bg-gray-50 border border-gray-200 rounded-xl px-5 py-4 text-[11px] font-black uppercase tracking-widest outline-none cursor-pointer focus:border-black" value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value})}>
                        <option>Watches</option>
                        <option>Luxury Artisan</option>
                        <option>Professional</option>
                        <option>Minimalist / Heritage</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-6">
                    <div>
                      <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 tracking-widest">Product Image</label>
                      <div className="border-2 border-dashed border-gray-200 rounded-2xl p-10 text-center hover:border-black transition cursor-pointer relative bg-gray-50 group">
                        <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => setMainImageFile(e.target.files ? e.target.files[0] : null)} />
                        <i className="fas fa-image text-3xl text-gray-300 mb-3 group-hover:text-black transition-colors"></i>
                        <p className="text-[10px] font-black uppercase text-gray-400 truncate tracking-widest">{mainImageFile ? mainImageFile.name : 'Upload Photo'}</p>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 tracking-widest">Product Description</label>
                      <textarea className="w-full bg-gray-50 border border-gray-200 rounded-xl px-5 py-4 text-sm font-bold outline-none h-24 resize-none leading-relaxed focus:border-black" value={newProduct.description} onChange={e => setNewProduct({...newProduct, description: e.target.value})} placeholder="Describe features..." />
                    </div>
                  </div>
                </div>
                <button onClick={handleCreateProduct} disabled={isAddingProduct} className="w-full bg-black text-white font-black uppercase py-5 rounded-2xl text-[11px] tracking-[0.4em] hover:bg-blue-600 transition shadow-xl active:scale-[0.98]">
                  {isAddingProduct ? <i className="fas fa-circle-notch fa-spin"></i> : 'Publish Product to Catalog'}
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ORDER DETAILS MODAL */}
      {viewingOrder && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[95vh] border border-gray-100">
            <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-sm font-black tracking-widest uppercase text-gray-900 flex items-center gap-3">
                <i className="fas fa-receipt text-blue-600"></i> Order Fulfillment: #{viewingOrder.id}
              </h2>
              <button onClick={() => setViewingOrder(null)} className="text-gray-400 hover:text-black transition-all hover:scale-110 p-2"><i className="fas fa-times text-xl"></i></button>
            </div>
            <div className="flex-grow overflow-y-auto p-10 space-y-12 custom-scrollbar">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                <div className="space-y-8">
                  <div className="bg-gray-50 rounded-3xl p-8 border border-gray-100 shadow-inner">
                    <h3 className="text-[10px] font-black uppercase text-gray-400 mb-6 tracking-widest flex items-center gap-2">
                       <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div> Items Summary
                    </h3>
                    <div className="space-y-6">
                      {viewingOrder.items.map((item, i) => (
                        <div key={i} className="flex items-center space-x-6 pb-6 border-b border-gray-200 last:border-0 last:pb-0">
                          <img src={item.product.image} className="w-16 h-16 rounded-2xl object-cover border border-white shadow-md shrink-0" />
                          <div className="flex-grow min-w-0">
                            <p className="text-sm font-black uppercase tracking-tight truncate text-gray-900">{item.product.name}</p>
                            <p className="text-[10px] text-gray-500 font-bold mt-1 uppercase tracking-tight">Quantity: {item.quantity}</p>
                            {item.variantName && <p className="text-[9px] text-blue-500 font-black uppercase mt-0.5">{item.variantName}</p>}
                          </div>
                          <p className="text-base font-black text-gray-900">Rs. {(item.product.price * item.quantity).toLocaleString()}</p>
                        </div>
                      ))}
                    </div>
                    <div className="pt-6 border-t border-gray-200 mt-6 flex justify-between items-center font-black">
                      <span className="text-[10px] uppercase text-gray-400 tracking-widest">Total Payable (COD)</span>
                      <span className="text-xl text-blue-600 tracking-tighter">Rs. {viewingOrder.total.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-8">
                  <div className="bg-white rounded-3xl border border-gray-200 p-8 shadow-sm">
                    <h3 className="text-[10px] font-black uppercase text-gray-400 mb-6 tracking-widest flex items-center gap-2">
                       <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div> Customer Details
                    </h3>
                    <div className="space-y-6">
                      <div className="flex justify-between items-center group">
                        <div className="min-w-0">
                          <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest mb-1">Customer Name</p>
                          <p className="text-sm font-black text-blue-600 uppercase tracking-tighter truncate">{viewingOrder.customer.name}</p>
                        </div>
                        <CopyBtn text={viewingOrder.customer.name} id="m-name" />
                      </div>
                      <div className="flex justify-between items-center group">
                        <div className="min-w-0">
                          <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest mb-1">Phone Number</p>
                          <p className="text-sm font-black text-gray-900 tracking-tight">{viewingOrder.customer.phone}</p>
                        </div>
                        <CopyBtn text={viewingOrder.customer.phone} id="m-phone" />
                      </div>
                      <div className="pt-6 border-t border-gray-50">
                        <div className="flex justify-between items-start group mb-4">
                           <div className="min-w-0">
                              <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest mb-1">Shipping City</p>
                              <p className="text-sm font-black text-gray-900 uppercase tracking-widest">{viewingOrder.customer.city || 'N/A'}</p>
                           </div>
                           <CopyBtn text={viewingOrder.customer.city || ''} id="m-city" />
                        </div>
                        <div className="flex justify-between items-start group">
                           <div className="min-w-0">
                              <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest mb-1">Street Address</p>
                              <p className="text-xs font-bold leading-relaxed text-gray-500 italic max-w-[200px]">"{viewingOrder.customer.address}"</p>
                           </div>
                           <CopyBtn text={viewingOrder.customer.address} id="m-addr" />
                        </div>
                      </div>
                    </div>
                    <div className="pt-8 border-t border-gray-100 mt-8">
                      <p className="text-[9px] font-black text-gray-400 uppercase mb-4 tracking-widest">Order Status</p>
                      <div className="relative">
                        <select 
                          value={viewingOrder.status}
                          onChange={(e) => updateStatusOverride && updateStatusOverride(viewingOrder.id, e.target.value as any)}
                          className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-4 px-5 text-[11px] font-black uppercase tracking-widest outline-none cursor-pointer focus:border-black appearance-none transition-colors"
                        >
                          {['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <i className="fas fa-chevron-down absolute right-5 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none text-[10px]"></i>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-8 border-t border-gray-100 flex justify-center bg-gray-50/30">
               <button onClick={() => setViewingOrder(null)} className="w-full sm:w-auto min-w-[300px] bg-black text-white px-12 py-5 rounded-[2rem] text-[10px] font-black uppercase tracking-[0.4em] shadow-xl hover:bg-gray-800 transition active:scale-[0.98] shadow-black/20">Close Fulfillment View</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;