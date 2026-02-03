
import React, { useState, useMemo, useEffect } from 'react';
import { Product, Order, User, UserRole } from '../types';
import { supabase } from '../lib/supabase';
import { PLACEHOLDER_IMAGE } from '../constants';
import { 
  LineChart, Line, ResponsiveContainer 
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

const sparkData = [
  { v: 10 }, { v: 15 }, { v: 8 }, { v: 22 }, { v: 18 }, { v: 25 }, { v: 20 }
];

const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
  products, setProducts, deleteProduct, orders, user, login, systemPassword, setSystemPassword, refreshData, updateStatusOverride
}) => {
  const [activeNav, setActiveNav] = useState('Home');
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null);
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  
  // Date Filtering State
  const [dateRange, setDateRange] = useState('Today');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Product state
  const [newProduct, setNewProduct] = useState({ 
    name: '', 
    price: '', 
    category: 'Watches', 
    description: ''
  });
  const [mainImageFile, setMainImageFile] = useState<File | null>(null);
  const [extraImageFiles, setExtraImageFiles] = useState<File[]>([]);
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const menuItems = [
    { label: 'Home', icon: 'fa-house' },
    { label: 'Orders', icon: 'fa-box-archive', badge: orders.filter(o => o.status === 'Pending').length },
    { label: 'Products', icon: 'fa-tags' },
    { label: 'Customers', icon: 'fa-user' },
    { label: 'Analytics', icon: 'fa-chart-simple' },
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

  // Analytics Filter Logic
  const filteredOrders = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    return orders.filter(order => {
      const orderDate = new Date(order.date);
      const orderDateStr = orderDate.toISOString().split('T')[0];

      if (dateRange === 'Today') return orderDateStr === todayStr;
      if (dateRange === 'Yesterday') {
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        return orderDateStr === yesterday.toISOString().split('T')[0];
      }
      if (dateRange === 'Last 7 Days') {
        const last7 = new Date(now);
        last7.setDate(last7.getDate() - 7);
        return orderDate >= last7;
      }
      if (dateRange === 'Last 30 Days') {
        const last30 = new Date(now);
        last30.setDate(last30.getDate() - 30);
        return orderDate >= last30;
      }
      if (dateRange === 'Custom' && customStartDate && customEndDate) {
        const start = new Date(customStartDate);
        const end = new Date(customEndDate);
        end.setHours(23, 59, 59, 999);
        return orderDate >= start && orderDate <= end;
      }
      return true; // All Time
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [orders, dateRange, customStartDate, customEndDate]);

  const totalSales = useMemo(() => filteredOrders.reduce((sum, o) => sum + o.total, 0), [filteredOrders]);

  const uploadFile = async (file: File): Promise<string | null> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `products/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('products')
      .upload(filePath, file);

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return null;
    }

    const { data } = supabase.storage.from('products').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mainImageFile) {
      alert("Please upload a main product image.");
      return;
    }
    
    setIsAddingProduct(true);
    try {
      const mainImageUrl = await uploadFile(mainImageFile);
      if (!mainImageUrl) throw new Error("Main image upload failed");

      const extraUrls: string[] = [];
      for (const file of extraImageFiles) {
        const url = await uploadFile(file);
        if (url) extraUrls.push(url);
      }

      const payload = {
        name: newProduct.name,
        price_pkr: Number(newProduct.price),
        image: mainImageUrl,
        features: extraUrls.length > 0 ? extraUrls : [mainImageUrl],
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
          images: data[0].features || [],
          category: data[0].category,
          inventory: 10,
          rating: 5,
          reviews: []
        }]);
        setNewProduct({ name: '', price: '', category: 'Watches', description: '' });
        setMainImageFile(null);
        setExtraImageFiles([]);
        alert("Product listed successfully.");
        setActiveNav('Products');
      } else if (error) {
        alert("Error: " + error.message);
      }
    } catch (err: any) {
      alert("Error creating product: " + err.message);
    } finally { setIsAddingProduct(false); }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#f1f1f1] flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white p-6 md:p-8 rounded-2xl shadow-xl border border-gray-200">
          <div className="flex justify-center mb-8">
            <div className="text-2xl font-black italic">ITX<span className="text-blue-600">ADMIN</span></div>
          </div>
          <h2 className="text-center font-bold text-gray-800 mb-6 uppercase tracking-widest text-[10px]">Access Restricted</h2>
          <form onSubmit={(e) => { e.preventDefault(); if (adminPasswordInput === systemPassword) login(UserRole.ADMIN); }} className="space-y-4">
            <input 
              type="password" 
              placeholder="System Passkey" 
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm font-bold focus:outline-none focus:border-black transition text-center"
              value={adminPasswordInput}
              onChange={(e) => setAdminPasswordInput(e.target.value)}
            />
            <button type="submit" className="w-full bg-black text-white py-3.5 rounded-lg font-bold uppercase tracking-widest text-[10px] hover:bg-gray-800 transition">Enter Dashboard</button>
          </form>
        </div>
      </div>
    );
  }

  const CopyBtn = ({ text, id }: { text: string, id: string }) => (
    <button 
      onClick={(e) => { e.stopPropagation(); copyToClipboard(text, id); }}
      className={`ml-2 p-1.5 transition-all ${copiedField === id ? 'text-green-600 bg-green-50' : 'text-gray-400 hover:text-black hover:bg-gray-100'} rounded-lg`}
      title="Copy"
    >
      <i className={`fas ${copiedField === id ? 'fa-check' : 'fa-copy'} text-[10px]`}></i>
    </button>
  );

  const SidebarContent = () => (
    <>
      <div className="p-4 flex items-center justify-between">
         <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-black text-white rounded-lg flex items-center justify-center text-xs font-bold">I</div>
            <div className="font-bold text-sm truncate">Its Shop U K</div>
         </div>
         <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-gray-500"><i className="fas fa-times"></i></button>
      </div>

      <nav className="flex-grow px-2 py-4 space-y-0.5 overflow-y-auto">
        {menuItems.map(item => (
          <button 
            key={item.label}
            onClick={() => { setActiveNav(item.label); setIsSidebarOpen(false); }}
            className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-semibold transition group ${activeNav === item.label ? 'bg-white shadow-sm text-black' : 'text-gray-600 hover:bg-gray-200'}`}
          >
            <div className="flex items-center space-x-3">
              <i className={`fas ${item.icon} w-4 text-center ${activeNav === item.label ? 'text-black' : 'text-gray-500'}`}></i>
              <span>{item.label}</span>
            </div>
            {item.badge && <span className="bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded text-[10px] font-bold">{item.badge}</span>}
          </button>
        ))}
      </nav>

      <div className="p-2 border-t border-gray-200">
         <button className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-200 transition">
           <i className="fas fa-gear w-4 text-center text-gray-500"></i>
           <span>Settings</span>
         </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-[#f1f1f1] text-[#303030] overflow-hidden font-sans relative">
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-[100] lg:hidden backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)}></div>
      )}

      <aside className={`fixed inset-y-0 left-0 w-[240px] bg-[#ebebeb] border-r border-gray-300 flex flex-col shrink-0 z-[110] transition-transform duration-300 lg:translate-x-0 lg:static ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <SidebarContent />
      </aside>

      <div className="flex-grow flex flex-col min-w-0 w-full">
        <header className="h-12 bg-[#1a1a1a] flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden text-white mr-4"><i className="fas fa-bars"></i></button>
            <div className="relative w-full max-w-xs md:max-w-md hidden sm:block">
              <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-[10px]"></i>
              <input type="text" placeholder="Search" className="w-full bg-[#303030] text-gray-300 rounded-lg pl-9 pr-12 py-1 text-xs outline-none focus:bg-[#404040] transition" />
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <button onClick={handleRefresh} className={`text-gray-400 hover:text-white transition ${isRefreshing ? 'animate-spin' : ''}`}><i className="fas fa-sync-alt"></i></button>
            <div className="bg-[#bc83f8] text-black w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold">IK</div>
          </div>
        </header>

        <main className="flex-grow overflow-y-auto p-4 md:p-8 custom-scrollbar">
          {activeNav === 'Home' && (
            <div className="max-w-5xl mx-auto space-y-6">
              {/* DATE FILTERS */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
                  {['Today', 'Yesterday', 'Last 7 Days', 'Last 30 Days', 'All Time', 'Custom'].map(range => (
                    <button 
                      key={range}
                      onClick={() => {
                        setDateRange(range);
                        if (range === 'Custom') setShowDatePicker(!showDatePicker);
                        else setShowDatePicker(false);
                      }}
                      className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-[10px] md:text-xs font-bold border transition-all ${dateRange === range ? 'bg-black text-white border-black shadow-lg' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                    >
                      {range} {range === 'Custom' && <i className={`fas fa-chevron-${showDatePicker ? 'up' : 'down'} ml-2`}></i>}
                    </button>
                  ))}
                </div>

                {showDatePicker && dateRange === 'Custom' && (
                  <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm animate-fadeIn flex flex-wrap gap-4 items-end">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Start Date</label>
                      <input 
                        type="date" 
                        className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-black"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">End Date</label>
                      <input 
                        type="date" 
                        className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-black"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                      />
                    </div>
                    <button 
                      onClick={() => setShowDatePicker(false)}
                      className="bg-black text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-gray-800"
                    >
                      Apply
                    </button>
                  </div>
                )}
              </div>

              {/* STATS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Sessions', val: '30' },
                  { label: 'Total sales', val: `Rs. ${totalSales.toLocaleString()}` },
                  { label: 'Orders', val: filteredOrders.length.toString() },
                  { label: 'Conversion rate', val: '0%' },
                ].map((stat, i) => (
                  <div key={i} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">{stat.label}</span>
                    <span className="text-xl font-black">{stat.val}</span>
                  </div>
                ))}
              </div>

              {/* RECENT ORDERS OVERVIEW */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                  <h2 className="font-bold text-[10px] uppercase tracking-widest text-gray-400">Filtered Insights</h2>
                  <button onClick={() => setActiveNav('Orders')} className="text-blue-600 text-[10px] font-bold uppercase underline tracking-tighter hover:text-blue-800">Explore Orders</button>
                </div>
                <div className="divide-y divide-gray-100">
                  {filteredOrders.slice(0, 8).map(o => (
                    <div key={o.id} onClick={() => setViewingOrder(o)} className="p-4 flex justify-between items-center hover:bg-gray-50 cursor-pointer transition group">
                      <div className="min-w-0 flex-grow">
                        <div className="flex items-center space-x-2 mb-1.5">
                          <span className="text-xs font-bold text-blue-600 group-hover:underline">#{o.id}</span>
                          <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wide shadow-sm border ${o.status === 'Pending' ? 'bg-yellow-50 text-yellow-600 border-yellow-100' : 'bg-green-50 text-green-600 border-green-100'}`}>{o.status}</span>
                        </div>
                        <p className="text-[10px] font-semibold text-gray-600 truncate">{o.customer.name}</p>
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-xs font-black">Rs. {o.total.toLocaleString()}</p>
                        <p className="text-[9px] text-gray-400 mt-1 uppercase font-bold tracking-tighter">
                          {new Date(o.date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                        </p>
                      </div>
                    </div>
                  ))}
                  {filteredOrders.length === 0 && (
                    <div className="p-16 text-center text-gray-300">
                      <i className="fas fa-calendar-times text-4xl mb-4 opacity-10"></i>
                      <p className="text-[10px] font-bold uppercase tracking-widest">No data for this period</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeNav === 'Orders' && (
            <div className="max-w-6xl mx-auto space-y-4">
               <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                     <h2 className="font-bold text-sm">Comprehensive Order Log</h2>
                  </div>
                  <div className="overflow-x-auto">
                     <table className="w-full text-left text-xs min-w-[650px]">
                        <thead className="bg-[#f9f9f9] text-gray-500 uppercase font-bold border-b border-gray-100">
                           <tr>
                              <th className="px-4 py-3">Order Context</th>
                              <th className="px-4 py-3">Customer Profile</th>
                              <th className="px-4 py-3 text-center">Precise Timestamp</th>
                              <th className="px-4 py-3 text-right">Settlement</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                           {filteredOrders.map(o => (
                             <tr key={o.id} onClick={() => setViewingOrder(o)} className="hover:bg-gray-50 cursor-pointer transition">
                                <td className="px-4 py-4">
                                  <div className="flex flex-col space-y-1.5">
                                    <div className="flex items-center">
                                      <span className="font-black text-blue-600">#{o.id}</span>
                                      <CopyBtn text={o.id} id={`list-id-${o.id}`} />
                                    </div>
                                    <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black w-fit uppercase border ${o.status === 'Pending' ? 'bg-yellow-50 text-yellow-600 border-yellow-100' : 'bg-green-50 text-green-600 border-green-100'}`}>{o.status}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-4">
                                  <div className="flex items-center font-bold text-gray-800">
                                    {o.customer.name}
                                    <CopyBtn text={o.customer.name} id={`list-name-${o.id}`} />
                                  </div>
                                  <div className="text-[10px] text-gray-400 font-medium mt-1">{o.customer.phone}</div>
                                </td>
                                <td className="px-4 py-4 text-center">
                                  <div className="text-gray-900 font-bold uppercase tracking-tight">{new Date(o.date).toLocaleDateString()}</div>
                                  <div className="text-[10px] text-gray-400 font-bold mt-0.5">{new Date(o.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                </td>
                                <td className="px-4 py-4 text-right font-black text-gray-900">
                                  Rs. {o.total.toLocaleString()}
                                </td>
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
                   <h2 className="text-xl font-bold">Inventory System</h2>
                   <button onClick={() => setActiveNav('AddProduct')} className="bg-black text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-gray-800 transition shadow-md">List New Item</button>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                   <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs min-w-[500px]">
                        <thead className="bg-[#f9f9f9] text-gray-500 uppercase font-bold border-b border-gray-100">
                           <tr>
                              <th className="px-4 py-3">Product Visual</th>
                              <th className="px-4 py-3">Collection</th>
                              <th className="px-4 py-3 text-center">Control</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                           {products.map(p => (
                             <tr key={p.id} className="hover:bg-gray-50 transition">
                                <td className="px-4 py-3">
                                   <div className="flex items-center space-x-3">
                                      <img src={p.image} className="w-10 h-10 rounded-lg object-cover border shrink-0 shadow-sm" />
                                      <span className="font-bold text-gray-900 truncate max-w-[200px]">{p.name}</span>
                                   </div>
                                </td>
                                <td className="px-4 py-3 text-gray-500 font-bold uppercase tracking-widest">{p.category}</td>
                                <td className="px-4 py-3 text-center">
                                   <button onClick={() => { if(window.confirm('Delete this product permanently?')) deleteProduct(p.id); }} className="text-red-400 hover:text-red-600 transition p-2"><i className="fas fa-trash-can"></i></button>
                                </td>
                             </tr>
                           ))}
                        </tbody>
                      </table>
                   </div>
                </div>
             </div>
          )}

          {activeNav === 'AddProduct' && (
             <div className="max-w-3xl mx-auto space-y-6 animate-fadeIn pb-20">
                <div className="flex items-center space-x-3">
                   <button onClick={() => setActiveNav('Products')} className="text-gray-400 hover:text-black transition"><i className="fas fa-arrow-left"></i></button>
                   <h2 className="text-xl font-bold">Create Listing</h2>
                </div>
                <div className="space-y-6">
                   <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                      <h3 className="text-xs font-bold uppercase text-gray-400 mb-6 tracking-widest">Metadata</h3>
                      <div className="space-y-4">
                        <div>
                           <label className="block text-[10px] font-bold uppercase text-gray-500 mb-2">Item Title</label>
                           <input required type="text" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm font-bold outline-none focus:border-black transition" placeholder="e.g. Vintage Skeleton II" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} />
                        </div>
                        <div>
                           <label className="block text-[10px] font-bold uppercase text-gray-500 mb-2">Extended Description</label>
                           <textarea required className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none h-32 focus:border-black transition leading-relaxed" placeholder="Mention specs, movement, and glass type..." value={newProduct.description} onChange={e => setNewProduct({...newProduct, description: e.target.value})} />
                        </div>
                      </div>
                   </div>

                   <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                      <h3 className="text-xs font-bold uppercase text-gray-400 mb-6 tracking-widest">Multimedia Asset Upload</h3>
                      <div className="space-y-6">
                        <div>
                           <label className="block text-[10px] font-bold uppercase text-gray-500 mb-2">Primary Listing Thumbnail</label>
                           <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-black transition cursor-pointer relative group bg-gray-50/50">
                              <input 
                                type="file" 
                                accept="image/*" 
                                className="absolute inset-0 opacity-0 cursor-pointer" 
                                onChange={(e) => setMainImageFile(e.target.files ? e.target.files[0] : null)}
                              />
                              <i className="fas fa-cloud-arrow-up text-3xl text-gray-300 mb-3 group-hover:text-black transition"></i>
                              <p className="text-[10px] font-black uppercase text-gray-500 tracking-widest">{mainImageFile ? mainImageFile.name : 'Choose Main Perspective'}</p>
                           </div>
                        </div>
                        <div>
                           <label className="block text-[10px] font-bold uppercase text-gray-500 mb-2">Auxiliary Gallery Views</label>
                           <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-black transition cursor-pointer relative group bg-gray-50/50">
                              <input 
                                type="file" 
                                accept="image/*" 
                                multiple 
                                className="absolute inset-0 opacity-0 cursor-pointer" 
                                onChange={(e) => setExtraImageFiles(e.target.files ? Array.from(e.target.files) : [])}
                              />
                              <i className="fas fa-images text-3xl text-gray-300 mb-3 group-hover:text-black transition"></i>
                              <p className="text-[10px] font-black uppercase text-gray-500 tracking-widest">
                                {extraImageFiles.length > 0 ? `${extraImageFiles.length} Perspectives Ready` : 'Upload Secondary Angles'}
                              </p>
                           </div>
                        </div>
                      </div>
                   </div>

                   <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                      <h3 className="text-xs font-bold uppercase text-gray-400 mb-6 tracking-widest">Commercial Controls</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                           <label className="block text-[10px] font-bold uppercase text-gray-500 mb-2">Retail Valuation (PKR)</label>
                           <input required type="number" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm font-bold outline-none focus:border-black transition" value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: e.target.value})} />
                        </div>
                        <div>
                           <label className="block text-[10px] font-bold uppercase text-gray-500 mb-2">Portfolio Segment</label>
                           <select className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm font-bold outline-none focus:border-black transition appearance-none" value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value})}>
                             <option>Watches</option>
                             <option>Luxury Artisan</option>
                             <option>Minimalist</option>
                           </select>
                        </div>
                      </div>
                   </div>

                   <button 
                      onClick={handleCreateProduct}
                      disabled={isAddingProduct} 
                      className="w-full bg-black text-white font-black uppercase py-5 rounded-xl text-xs tracking-[0.2em] hover:bg-gray-800 transition shadow-2xl flex items-center justify-center space-x-3 active:scale-[0.98]"
                   >
                      {isAddingProduct ? <i className="fas fa-circle-notch fa-spin"></i> : <span>SYNCHRONIZE LISTING</span>}
                   </button>
                </div>
             </div>
          )}
        </main>
      </div>

      {/* DETAILED ORDER MODAL */}
      {viewingOrder && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-md flex items-center justify-center p-0 sm:p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-[#f1f1f1] w-full max-w-4xl rounded-none sm:rounded-[2rem] shadow-2xl overflow-hidden flex flex-col h-full sm:h-auto sm:max-h-[92vh]">
            <div className="bg-white p-5 border-b border-gray-200 flex justify-between items-center shrink-0">
              <div className="flex items-center space-x-3">
                 <div className="flex items-center">
                   <h2 className="text-sm font-black text-gray-900 tracking-tight">PORTAL: #{viewingOrder.id}</h2>
                   <CopyBtn text={viewingOrder.id} id="modal-id" />
                 </div>
                 <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest border ${viewingOrder.status === 'Pending' ? 'bg-yellow-50 text-yellow-600 border-yellow-100' : 'bg-green-50 text-green-600 border-green-100'}`}>{viewingOrder.status}</span>
              </div>
              <button onClick={() => setViewingOrder(null)} className="text-gray-400 p-2 hover:text-black transition"><i className="fas fa-times text-lg"></i></button>
            </div>
            
            <div className="flex-grow overflow-y-auto p-4 md:p-8 space-y-8">
               <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  {/* Left: Items */}
                  <div className="lg:col-span-7 space-y-6">
                     <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                        <h3 className="text-[10px] font-black uppercase text-gray-400 mb-6 tracking-[0.2em]">Transaction Contents</h3>
                        <div className="space-y-5">
                          {viewingOrder.items.map((item, i) => (
                             <div key={i} className="flex items-center space-x-5 pb-5 border-b border-gray-50 last:border-0 last:pb-0">
                                <img src={item.product.image} className="w-14 h-14 rounded-xl object-cover border shrink-0 shadow-sm" />
                                <div className="flex-grow min-w-0">
                                   <p className="text-xs font-black text-gray-900 truncate uppercase">{item.product.name}</p>
                                   <p className="text-[10px] text-gray-400 font-bold mt-1 uppercase">Unit Qty: {item.quantity}</p>
                                </div>
                                <p className="text-sm font-black whitespace-nowrap text-blue-600">Rs. {(item.product.price * item.quantity).toLocaleString()}</p>
                             </div>
                          ))}
                        </div>
                        <div className="mt-8 pt-6 border-t border-gray-100 flex justify-between items-center">
                           <span className="text-[10px] font-black uppercase text-gray-400">Net Settlement</span>
                           <span className="text-lg font-black">Rs. {viewingOrder.total.toLocaleString()}</span>
                        </div>
                     </div>
                  </div>

                  {/* Right: Customer Intelligence */}
                  <div className="lg:col-span-5 space-y-6">
                     <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                        <h3 className="text-[10px] font-black uppercase text-gray-400 mb-6 tracking-[0.2em]">Customer Profile</h3>
                        <div className="space-y-5">
                           <div className="group">
                              <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest mb-1">Identified Name</p>
                              <div className="flex items-center justify-between">
                                 <p className="text-sm font-black text-blue-600 uppercase truncate">{viewingOrder.customer.name}</p>
                                 <CopyBtn text={viewingOrder.customer.name} id="modal-cust-name" />
                              </div>
                           </div>
                           <div className="group">
                              <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest mb-1">Direct Contact</p>
                              <div className="flex items-center justify-between">
                                 <p className="text-sm font-bold tracking-tighter">{viewingOrder.customer.phone}</p>
                                 <CopyBtn text={viewingOrder.customer.phone} id="modal-cust-phone" />
                              </div>
                           </div>
                           <div className="pt-5 border-t border-gray-50 group">
                              <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest mb-1">Logistics: City</p>
                              <div className="flex items-center justify-between">
                                 <p className="text-xs font-black text-gray-800 uppercase tracking-tight">{viewingOrder.customer.city || 'UNDEFINED'}</p>
                                 <CopyBtn text={viewingOrder.customer.city || ''} id="modal-cust-city" />
                              </div>
                           </div>
                           <div className="group">
                              <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest mb-1">Target Address</p>
                              <div className="flex items-start justify-between gap-4">
                                 <p className="text-xs font-bold leading-relaxed text-gray-600 italic">"{viewingOrder.customer.address}"</p>
                                 <CopyBtn text={viewingOrder.customer.address} id="modal-cust-address" />
                              </div>
                           </div>
                        </div>

                        <div className="pt-6 border-t border-gray-100 mt-6">
                           <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-3">Lifecycle State</p>
                           <div className="relative">
                              <select 
                                value={viewingOrder.status}
                                onChange={(e) => updateStatusOverride && updateStatusOverride(viewingOrder.id, e.target.value as any)}
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-4 text-[11px] font-black uppercase tracking-widest outline-none appearance-none cursor-pointer focus:border-black transition"
                              >
                                {['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                              <i className="fas fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none text-[10px]"></i>
                           </div>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
            <div className="bg-white p-5 border-t border-gray-200 flex justify-end items-center gap-4 shrink-0">
               <button onClick={() => setViewingOrder(null)} className="flex-grow sm:flex-none bg-black text-white px-10 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:bg-gray-800 transition active:scale-[0.98]">CLOSE COMMAND PORTAL</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
