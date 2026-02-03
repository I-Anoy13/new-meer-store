
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
  
  // Filtering
  const [dateRange, setDateRange] = useState('Today');
  const [newProduct, setNewProduct] = useState({ name: '', price: '', category: 'Watches', description: '' });
  const [mainImageFile, setMainImageFile] = useState<File | null>(null);

  const menuItems = [
    { label: 'Home', icon: 'fa-house' },
    { label: 'Orders', icon: 'fa-shopping-cart', badge: orders.filter(o => o.status === 'Pending').length },
    { label: 'Products', icon: 'fa-tags' },
    { label: 'Customers', icon: 'fa-users' },
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
    const todayStr = now.toISOString().split('T')[0];
    return orders.filter(order => {
      if (dateRange === 'Today') return new Date(order.date).toISOString().split('T')[0] === todayStr;
      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
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
        alert("Product listed.");
        setActiveNav('Products');
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally { setIsAddingProduct(false); }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#f1f1f1] flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white p-10 rounded-3xl shadow-2xl border border-gray-100">
          <div className="text-center mb-10">
            <h1 className="text-3xl font-black italic tracking-tighter uppercase">ITX<span className="text-blue-600">ADMIN</span></h1>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-2">Enterprise Access Required</p>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); if (adminPasswordInput === systemPassword) login(UserRole.ADMIN); }} className="space-y-6">
            <input 
              type="password" 
              placeholder="••••••••" 
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-4 text-center font-black focus:outline-none focus:border-black transition text-lg"
              value={adminPasswordInput}
              onChange={(e) => setAdminPasswordInput(e.target.value)}
            />
            <button type="submit" className="w-full bg-black text-white py-4 rounded-2xl font-black uppercase tracking-[0.2em] text-xs hover:bg-gray-800 transition shadow-lg active:scale-[0.98]">Authorize Portal</button>
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
      {isSidebarOpen && <div className="fixed inset-0 bg-black/60 z-[100] lg:hidden backdrop-blur-md" onClick={() => setIsSidebarOpen(false)}></div>}
      
      {/* SIDEBAR - DARK SHOPIFY Polaris STYLE */}
      <aside className={`fixed inset-y-0 left-0 w-[260px] bg-[#1a1c1d] flex flex-col shrink-0 z-[110] transition-transform duration-300 lg:translate-x-0 lg:static ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 bg-blue-600 text-white rounded-lg flex items-center justify-center text-lg font-black shadow-lg">I</div>
            <div className="font-black text-sm tracking-tight text-white uppercase">ITX Admin</div>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-gray-400"><i className="fas fa-times"></i></button>
        </div>
        <nav className="flex-grow px-3 py-6 space-y-1 overflow-y-auto custom-scrollbar">
          {menuItems.map(item => (
            <button 
              key={item.label}
              onClick={() => { setActiveNav(item.label); setIsSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-xs font-bold transition-all ${activeNav === item.label ? 'bg-[#30373e] text-white border border-white/5' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
            >
              <div className="flex items-center space-x-4">
                <i className={`fas ${item.icon} w-5 text-center ${activeNav === item.label ? 'text-blue-500' : 'text-gray-500'}`}></i>
                <span className="tracking-wide uppercase">{item.label}</span>
              </div>
              {item.badge ? <span className="bg-blue-600 text-white px-2 py-0.5 rounded text-[10px] font-black">{item.badge}</span> : null}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-800">
           <div className="bg-gray-900 rounded-xl p-4 flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center text-xs font-black text-gray-400">M</div>
              <div className="truncate">
                 <p className="text-[10px] font-black text-white uppercase">Master Admin</p>
                 <p className="text-[9px] text-gray-500 uppercase font-bold">ITX HQ</p>
              </div>
           </div>
        </div>
      </aside>

      <div className="flex-grow flex flex-col min-w-0 w-full overflow-hidden">
        <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0 z-50 shadow-sm">
          <div className="flex items-center space-x-4">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden text-gray-500 hover:text-black transition"><i className="fas fa-bars"></i></button>
            <div className="hidden sm:flex items-center space-x-2 text-[10px] font-black uppercase text-gray-400 tracking-widest">
               <span>Portal</span> <i className="fas fa-chevron-right text-[8px]"></i> <span className="text-gray-900">{activeNav}</span>
            </div>
          </div>
          <div className="flex items-center space-x-6">
            <button onClick={handleRefresh} className={`text-gray-400 hover:text-black transition-all ${isRefreshing ? 'animate-spin' : ''}`}><i className="fas fa-sync-alt text-sm"></i></button>
            <div className="h-8 w-[1px] bg-gray-100"></div>
            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-xs font-black border border-gray-200 uppercase">ITX</div>
          </div>
        </header>

        <main className="flex-grow overflow-y-auto p-4 md:p-8 lg:p-12 custom-scrollbar animate-fadeIn">
          {activeNav === 'Home' && (
            <div className="max-w-6xl mx-auto space-y-10">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <h2 className="text-3xl font-black tracking-tight">Store Overview</h2>
                <div className="flex items-center gap-2 bg-white p-1 rounded-2xl border border-gray-200 shadow-sm">
                  {['Today', 'Yesterday', 'All Time'].map(range => (
                    <button key={range} onClick={() => setDateRange(range)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${dateRange === range ? 'bg-gray-100 text-black shadow-inner' : 'text-gray-400 hover:text-black hover:bg-gray-50'}`}>{range}</button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { label: 'Total Sales', val: `Rs. ${totalSales.toLocaleString()}`, color: 'text-blue-600' },
                  { label: 'Total Orders', val: filteredOrders.length.toString(), color: 'text-gray-900' },
                  { label: 'Sessions', val: '1,420', color: 'text-gray-900' },
                  { label: 'Conversion', val: '0.0%', color: 'text-gray-400' },
                ].map((stat, i) => (
                  <div key={i} className="bg-white p-8 rounded-[2rem] border border-gray-200 shadow-sm hover:shadow-md transition-all">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] block mb-4">{stat.label}</span>
                    <span className={`text-3xl font-black ${stat.color} tracking-tighter`}>{stat.val}</span>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-[2.5rem] border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                   <h3 className="text-sm font-black uppercase tracking-widest text-gray-900">Recent Stream</h3>
                   <button onClick={() => setActiveNav('Orders')} className="text-blue-600 text-[10px] font-black uppercase tracking-widest hover:underline">Full Log</button>
                </div>
                <div className="divide-y divide-gray-50">
                  {filteredOrders.slice(0, 8).map(o => (
                    <div key={o.id} onClick={() => setViewingOrder(o)} className="p-6 flex justify-between items-center hover:bg-gray-50 cursor-pointer transition group">
                      <div className="flex items-center space-x-6">
                        <div className={`w-2.5 h-2.5 rounded-full ${o.status === 'Pending' ? 'bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.5)]' : 'bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.5)]'}`}></div>
                        <div>
                          <p className="text-sm font-black text-gray-900 group-hover:text-blue-600 transition uppercase tracking-tight">#{o.id} — {o.customer.name}</p>
                          <p className="text-[10px] text-gray-400 font-bold mt-1 uppercase tracking-widest">{new Date(o.date).toLocaleDateString()} at {new Date(o.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                      </div>
                      <div className="text-right">
                         <p className="text-sm font-black text-gray-900 tracking-tight">Rs. {o.total.toLocaleString()}</p>
                         <span className={`inline-block mt-1 px-3 py-1 rounded-lg text-[9px] font-black uppercase border ${o.status === 'Pending' ? 'bg-yellow-50 text-yellow-600 border-yellow-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>{o.status}</span>
                      </div>
                    </div>
                  ))}
                  {filteredOrders.length === 0 && <div className="py-20 text-center text-gray-300 italic uppercase text-[10px] tracking-widest">No activity found</div>}
                </div>
              </div>
            </div>
          )}

          {activeNav === 'Orders' && (
            <div className="max-w-6xl mx-auto space-y-8">
              <div className="flex justify-between items-center">
                <h2 className="text-3xl font-black tracking-tight">Commercial Log</h2>
                <button className="bg-white border border-gray-200 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 transition shadow-sm">Export Stream</button>
              </div>
              <div className="bg-white rounded-[2.5rem] border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs min-w-[700px]">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="px-8 py-5 text-[10px] font-black uppercase text-gray-400 tracking-widest">Transaction / Status</th>
                        <th className="px-8 py-5 text-[10px] font-black uppercase text-gray-400 tracking-widest">Client Intelligence</th>
                        <th className="px-8 py-5 text-right text-[10px] font-black uppercase text-gray-400 tracking-widest">Settlement</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredOrders.map(o => (
                        <tr key={o.id} onClick={() => setViewingOrder(o)} className="hover:bg-gray-50/80 cursor-pointer transition">
                          <td className="px-8 py-6">
                            <div className="flex flex-col space-y-2">
                              <span className="font-black text-blue-600 text-sm">#{o.id}</span>
                              <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black w-fit uppercase border ${o.status === 'Pending' ? 'bg-yellow-50 text-yellow-600 border-yellow-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>{o.status}</span>
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <div className="font-black text-gray-900 uppercase tracking-tight text-sm">{o.customer.name}</div>
                            <div className="text-[10px] text-gray-400 font-bold mt-1 tracking-widest">{o.customer.phone}</div>
                          </td>
                          <td className="px-8 py-6 text-right font-black text-gray-900 text-base">Rs. {o.total.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeNav === 'Products' && (
            <div className="max-w-6xl mx-auto space-y-8">
              <div className="flex justify-between items-center">
                <h2 className="text-3xl font-black tracking-tight">Inventory Cloud</h2>
                <button onClick={() => setActiveNav('AddProduct')} className="bg-black text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-800 transition shadow-xl active:scale-[0.98]">Deploy Item</button>
              </div>
              <div className="bg-white rounded-[2.5rem] border border-gray-200 shadow-sm overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-8 py-5 text-[10px] font-black uppercase text-gray-400 tracking-widest">Asset Details</th>
                      <th className="px-8 py-5 text-center text-[10px] font-black uppercase text-gray-400 tracking-widest">Management</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {products.map(p => (
                      <tr key={p.id} className="hover:bg-gray-50 transition">
                        <td className="px-8 py-6 flex items-center space-x-6">
                          <img src={p.image} className="w-14 h-14 rounded-2xl object-cover border border-gray-100 shadow-sm" />
                          <div>
                             <p className="font-black text-gray-900 uppercase tracking-tight text-sm">{p.name}</p>
                             <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">{p.category}</p>
                          </div>
                        </td>
                        <td className="px-8 py-6 text-center">
                          <button onClick={() => { if(window.confirm('Delete this asset permanently?')) deleteProduct(p.id); }} className="text-red-400 hover:text-red-600 transition p-3"><i className="fas fa-trash-can text-base"></i></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeNav === 'AddProduct' && (
            <div className="max-w-4xl mx-auto space-y-10 pb-20 animate-fadeIn">
              <div className="flex items-center space-x-4">
                 <button onClick={() => setActiveNav('Products')} className="w-12 h-12 rounded-2xl bg-white border border-gray-200 text-gray-400 hover:text-black transition flex items-center justify-center shadow-sm"><i className="fas fa-arrow-left"></i></button>
                 <h2 className="text-3xl font-black tracking-tight">New Asset Deployment</h2>
              </div>
              <div className="bg-white p-10 rounded-[2.5rem] border border-gray-200 shadow-sm space-y-8">
                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-400 mb-3 tracking-widest">Item Designation</label>
                  <input type="text" className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-6 py-5 text-sm font-black uppercase outline-none focus:border-black transition" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} placeholder="e.g. Royal Oak Titanium" />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-400 mb-3 tracking-widest">Primary Media Perspective</label>
                  <div className="border-2 border-dashed border-gray-200 rounded-3xl p-12 text-center bg-gray-50 hover:border-blue-500 transition cursor-pointer relative group">
                     <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => setMainImageFile(e.target.files ? e.target.files[0] : null)} />
                     <i className="fas fa-cloud-arrow-up text-5xl text-gray-200 mb-4 group-hover:text-blue-500 transition-all"></i>
                     <p className="text-[10px] font-black uppercase text-gray-400 tracking-[0.2em]">{mainImageFile ? mainImageFile.name : 'Click or Drag Media Perspective'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-gray-400 mb-3 tracking-widest">Valuation (PKR)</label>
                    <input type="number" className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-6 py-5 text-sm font-black outline-none focus:border-black transition" value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: e.target.value})} placeholder="25000" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-gray-400 mb-3 tracking-widest">Collection Sector</label>
                    <select className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-6 py-5 text-xs font-black uppercase tracking-widest outline-none cursor-pointer focus:border-black transition" value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value})}>
                      <option>Watches</option>
                      <option>Luxury Artisan</option>
                      <option>Professional</option>
                    </select>
                  </div>
                </div>
                <button onClick={handleCreateProduct} disabled={isAddingProduct} className="w-full bg-blue-600 text-white font-black uppercase py-6 rounded-3xl text-xs tracking-[0.4em] hover:bg-blue-700 transition shadow-2xl shadow-blue-500/30 flex items-center justify-center space-x-3 active:scale-[0.98]">
                   {isAddingProduct ? <i className="fas fa-circle-notch fa-spin"></i> : <span>Authorize Deployment</span>}
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* PORTAL MODAL - SHOPIFY-STYLE DETAIL VIEW */}
      {viewingOrder && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-xl flex items-center justify-center p-0 sm:p-8 overflow-y-auto animate-fadeIn">
          <div className="bg-white w-full max-w-5xl rounded-none sm:rounded-[3rem] shadow-[0_35px_60px_-15px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col h-full sm:h-auto sm:max-h-[92vh]">
            <div className="bg-white p-8 border-b border-gray-100 flex justify-between items-center shrink-0">
              <h2 className="text-sm font-black tracking-widest uppercase">Portal Access: #{viewingOrder.id}</h2>
              <button onClick={() => setViewingOrder(null)} className="text-gray-400 p-2 hover:text-black transition-all hover:scale-110"><i className="fas fa-times text-2xl"></i></button>
            </div>
            <div className="flex-grow overflow-y-auto p-8 md:p-12 space-y-12 custom-scrollbar">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                <div className="lg:col-span-7 space-y-8">
                  <div className="bg-gray-50 rounded-[2.5rem] p-10 border border-gray-100 shadow-inner">
                    <h3 className="text-[10px] font-black uppercase text-gray-400 mb-8 tracking-[0.3em]">Commercial Contents</h3>
                    <div className="space-y-8">
                      {viewingOrder.items.map((item, i) => (
                        <div key={i} className="flex items-center space-x-8 pb-8 border-b border-gray-200 last:border-0 last:pb-0">
                          <img src={item.product.image} className="w-20 h-20 rounded-3xl object-cover border border-white shadow-xl" />
                          <div className="flex-grow min-w-0">
                            <p className="text-base font-black text-gray-900 uppercase tracking-tight truncate">{item.product.name}</p>
                            <p className="text-[10px] text-gray-400 font-bold mt-1 uppercase tracking-widest">Qty Authorized: {item.quantity}</p>
                          </div>
                          <p className="text-lg font-black text-blue-600">Rs. {(item.product.price * item.quantity).toLocaleString()}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-12 pt-10 border-t border-gray-300 flex justify-between items-center">
                      <span className="text-xs font-black uppercase text-gray-400 tracking-widest">Net Commercial Settlement</span>
                      <span className="text-3xl font-black text-gray-900 tracking-tighter">Rs. {viewingOrder.total.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                <div className="lg:col-span-5 space-y-8">
                  <div className="bg-white rounded-[2.5rem] border border-gray-200 p-10 shadow-sm space-y-8">
                    <h3 className="text-[10px] font-black uppercase text-gray-400 tracking-[0.3em]">Client Intelligence</h3>
                    <div className="space-y-6">
                      <div>
                        <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest mb-1.5">Identified Label</p>
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-black text-blue-600 uppercase truncate">{viewingOrder.customer.name}</p>
                          <CopyBtn text={viewingOrder.customer.name} id="modal-name" />
                        </div>
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest mb-1.5">Communication Line</p>
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-bold text-gray-900 tracking-tight">{viewingOrder.customer.phone}</p>
                          <CopyBtn text={viewingOrder.customer.phone} id="modal-phone" />
                        </div>
                      </div>
                      <div className="pt-6 border-t border-gray-50">
                        <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest mb-1.5">Precise Destination</p>
                        <div className="flex items-start justify-between gap-4">
                          <p className="text-xs font-bold leading-relaxed text-gray-500 italic">"{viewingOrder.customer.address}, {viewingOrder.customer.city || 'N/A'}"</p>
                          <CopyBtn text={viewingOrder.customer.address} id="modal-addr" />
                        </div>
                      </div>
                    </div>
                    <div className="pt-10 border-t border-gray-100">
                      <p className="text-[9px] font-black text-gray-400 uppercase mb-6 tracking-widest">Update Lifecycle State</p>
                      <select 
                        value={viewingOrder.status}
                        onChange={(e) => updateStatusOverride && updateStatusOverride(viewingOrder.id, e.target.value as any)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-[1.5rem] py-5 px-6 text-xs font-black uppercase tracking-widest outline-none cursor-pointer focus:border-black transition appearance-none"
                      >
                        {['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-white p-8 border-t border-gray-100 flex justify-center items-center shrink-0">
               <button onClick={() => setViewingOrder(null)} className="w-full sm:w-auto min-w-[300px] bg-black text-white px-12 py-5 rounded-[2rem] text-[10px] font-black uppercase tracking-[0.4em] shadow-[0_20px_40px_-15px_rgba(0,0,0,0.3)] hover:bg-gray-800 transition active:scale-[0.98]">Exit Command Portal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
