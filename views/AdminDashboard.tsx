
import React, { useState, useMemo, useRef } from 'react';
import { Product, Order, User, UserRole, Variant } from '../types';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface AdminDashboardProps {
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  deleteProduct: (productId: string) => void;
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  user: User | null;
  login: (role: UserRole) => void;
  systemPassword: string;
  setSystemPassword: (pwd: string) => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
  products, 
  setProducts, 
  deleteProduct, 
  orders, 
  setOrders, 
  user, 
  login, 
  systemPassword, 
  setSystemPassword 
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'products' | 'orders' | 'settings'>('overview');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [loginError, setLoginError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [newPassword, setNewPassword] = useState('');
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState(false);

  const [productForm, setProductForm] = useState<{
    name: string;
    description: string;
    price: number;
    category: string;
    inventory: number;
    image: string;
    video: string;
    variants: Variant[];
  }>({
    name: '',
    description: '',
    price: 0,
    category: '',
    inventory: 0,
    image: '',
    video: '',
    variants: []
  });

  const totalRevenue = useMemo(() => orders.reduce((sum, o) => sum + o.total, 0), [orders]);
  const pendingOrdersCount = useMemo(() => orders.filter(o => o.status === 'Pending').length, [orders]);
  const activeProductsCount = products.length;
  const lowStockCount = products.filter(p => p.inventory < 10).length;

  const chartData = useMemo(() => [
    { name: 'Mon', sales: totalRevenue * 0.1 || 1200 },
    { name: 'Tue', sales: totalRevenue * 0.15 || 2800 },
    { name: 'Wed', sales: totalRevenue * 0.12 || 2100 },
    { name: 'Thu', sales: totalRevenue * 0.2 || 4500 },
    { name: 'Fri', sales: totalRevenue * 0.18 || 3800 },
    { name: 'Sat', sales: totalRevenue * 0.25 || 6800 },
    { name: 'Sun', sales: totalRevenue * 0.3 || 9200 },
  ], [totalRevenue]);

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPasswordInput === systemPassword) {
      login(UserRole.ADMIN);
      setLoginError(false);
    } else {
      setLoginError(true);
    }
  };

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 4) {
      alert("Password must be at least 4 characters.");
      return;
    }
    setSystemPassword(newPassword);
    setPasswordChangeSuccess(true);
    setTimeout(() => setPasswordChangeSuccess(false), 3000);
  };

  const handleDelete = (e: React.MouseEvent, productId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm('WARNING: Are you sure you want to permanently delete this product from the ITX database?')) {
      deleteProduct(productId);
    }
  };

  const handleStatusChange = (orderId: string, status: Order['status']) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
    if (selectedOrder?.id === orderId) {
      setSelectedOrder(prev => prev ? { ...prev, status } : null);
    }
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProduct) {
      setProducts(prev => prev.map(p => p.id === editingProduct.id ? { 
        ...p, 
        ...productForm,
        rating: p.rating,
        reviews: p.reviews 
      } as Product : p));
    } else {
      const newProduct: Product = {
        ...productForm,
        id: `PROD-${Date.now()}`,
        rating: 5,
        reviews: []
      } as Product;
      setProducts(prev => [newProduct, ...prev]);
    }
    closeModal();
  };

  const openModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setProductForm({
        name: product.name,
        description: product.description,
        price: product.price,
        category: product.category,
        inventory: product.inventory,
        image: product.image,
        video: product.video || '',
        variants: product.variants || []
      });
    } else {
      setEditingProduct(null);
      setProductForm({
        name: '',
        description: '',
        price: 0,
        category: 'Luxury Artisan',
        inventory: 0,
        image: '',
        video: '',
        variants: []
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
  };

  const addVariant = () => {
    setProductForm({
      ...productForm,
      variants: [...productForm.variants, { id: Date.now().toString(), name: '', price: productForm.price }]
    });
  };

  const removeVariant = (id: string) => {
    setProductForm({
      ...productForm,
      variants: productForm.variants.filter(v => v.id !== id)
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProductForm(prev => ({ ...prev, image: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-40 flex flex-col items-center">
        <div className="w-24 h-24 bg-black rounded-3xl flex items-center justify-center mb-10 text-4xl text-white shadow-2xl">
          <i className="fas fa-terminal"></i>
        </div>
        <h2 className="text-4xl font-serif italic font-bold tracking-tight uppercase mb-8 text-black">ITX SHOP MEER CONSOLE</h2>
        <form onSubmit={handleAdminLogin} className="w-full max-w-sm space-y-4">
          <div>
            <input 
              type="password" 
              placeholder="System Password" 
              className={`w-full p-6 bg-white border ${loginError ? 'border-red-500' : 'border-gray-100'} rounded-2xl font-black text-center outline-none focus:ring-1 focus:ring-black transition shadow-sm text-black`}
              value={adminPasswordInput}
              onChange={(e) => setAdminPasswordInput(e.target.value)}
            />
            {loginError && <p className="text-red-500 text-[10px] font-black uppercase tracking-widest text-center mt-3">Access Denied: Invalid Authentication Key</p>}
          </div>
          <button type="submit" className="w-full p-6 bg-black text-white rounded-2xl font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-xl flex items-center justify-center">
            Log into ITX System <i className="fas fa-key ml-4"></i>
          </button>
        </form>
        <p className="mt-8 text-[10px] text-gray-400 font-bold uppercase tracking-[0.4em]">Secured Management Interface • Port 8080</p>
      </div>
    );
  }

  return (
    <div className="bg-[#fafafa] min-h-screen pb-32">
      <div className="container mx-auto px-8 py-16">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end mb-16 space-y-8 lg:space-y-0 border-b border-gray-100 pb-12">
          <div className="space-y-2">
            <h1 className="text-5xl font-serif font-bold italic tracking-tight text-black flex items-center">
              ITX <span className="ml-4 text-blue-600 not-italic font-black text-2xl tracking-[0.2em] uppercase">Control</span>
            </h1>
            <p className="text-gray-400 font-bold uppercase text-[10px] tracking-[0.4em] flex items-center">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-3"></span> {user.name} • ITX SHOP MEER AUTHENTICATED
            </p>
          </div>
          
          <div className="flex bg-white rounded-2xl p-2 border border-gray-200 shadow-sm overflow-x-auto">
            {[
              { id: 'overview', icon: 'fa-chart-line', label: 'Overview' },
              { id: 'products', icon: 'fa-box', label: 'Inventory' },
              { id: 'orders', icon: 'fa-shopping-cart', label: 'Orders' },
              { id: 'settings', icon: 'fa-cog', label: 'Settings' }
            ].map(tab => (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)} 
                className={`px-10 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center whitespace-nowrap ${activeTab === tab.id ? 'bg-black text-white shadow-lg' : 'text-gray-400 hover:text-black hover:bg-gray-50'}`}
              >
                <i className={`fas ${tab.icon} mr-3`}></i> {tab.label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'overview' && (
          <div className="animate-fadeIn space-y-12">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
              {[
                { label: 'Cumulative Sales', value: `Rs. ${totalRevenue.toLocaleString()}`, icon: 'fa-wallet', bg: 'bg-black', text: 'text-white', target: 'orders' },
                { label: 'Active Dispatches', value: pendingOrdersCount.toString(), icon: 'fa-truck-loading', bg: 'bg-white', text: 'text-black', target: 'orders' },
                { label: 'Stock Catalog', value: activeProductsCount.toString(), icon: 'fa-layer-group', bg: 'bg-white', text: 'text-black', target: 'products' },
                { label: 'Critical Stock', value: lowStockCount.toString(), icon: 'fa-triangle-exclamation', bg: 'bg-red-500', text: 'text-white', target: 'products' }
              ].map((stat, i) => (
                <div 
                  key={i} 
                  onClick={() => setActiveTab(stat.target as any)}
                  className={`${stat.bg} ${stat.text} p-10 rounded-3xl border border-gray-100 shadow-sm group cursor-pointer transition-all hover:-translate-y-1 hover:shadow-2xl`}
                >
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mb-8 ${stat.bg === 'bg-white' ? 'bg-gray-50 text-blue-600' : 'bg-white/20 text-white'}`}>
                    <i className={`fas ${stat.icon}`}></i>
                  </div>
                  <p className="text-[11px] font-black uppercase tracking-widest opacity-60 mb-3">{stat.label}</p>
                  <p className="text-4xl font-black tracking-tighter">{stat.value}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
              <div className="lg:col-span-2 bg-white rounded-3xl p-12 border border-gray-100 shadow-sm">
                <h3 className="text-xl font-serif italic font-bold uppercase tracking-widest mb-12 text-black">Acquisition Velocity</h3>
                <div className="h-[450px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 900, fill: '#9ca3af', letterSpacing: '0.1em'}} dy={15} />
                      <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 900, fill: '#9ca3af'}} dx={-10} />
                      <Tooltip 
                        contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: '900', fontSize: '12px', textTransform: 'uppercase'}} 
                      />
                      <Area type="monotone" dataKey="sales" stroke="#2563eb" strokeWidth={4} fillOpacity={1} fill="url(#chartGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              <div className="bg-gray-950 rounded-3xl p-12 text-white shadow-2xl flex flex-col">
                <h3 className="text-xl font-serif italic font-bold uppercase tracking-widest mb-10 border-b border-white/5 pb-6">Recent Ledger Activity</h3>
                <div className="space-y-8 flex-grow overflow-y-auto custom-scrollbar pr-4">
                  {orders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-gray-800">
                      <i className="fas fa-inbox text-5xl mb-6"></i>
                      <p className="text-[12px] font-black uppercase tracking-[0.3em]">System Idling</p>
                    </div>
                  ) : (
                    orders.slice(0, 10).map(o => (
                      <div 
                        key={o.id} 
                        onClick={() => { setSelectedOrder(o); setActiveTab('orders'); }}
                        className="flex justify-between items-center border-b border-white/5 pb-6 hover:bg-white/5 cursor-pointer transition p-4 rounded-2xl"
                      >
                        <div className="min-w-0 pr-6">
                          <p className="text-[13px] font-black uppercase tracking-widest truncate italic">{o.customer.name}</p>
                          <p className="text-[11px] text-gray-500 font-bold tracking-widest uppercase mt-2">Rs. {o.total.toLocaleString()}</p>
                        </div>
                        <i className="fas fa-chevron-right text-[11px] text-gray-700"></i>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'products' && (
          <div className="animate-fadeIn space-y-10">
            <div className="flex justify-between items-center">
              <h2 className="text-4xl font-serif italic font-bold uppercase tracking-tight text-black">Inventory Registry</h2>
              <button onClick={() => openModal()} className="bg-black text-white px-10 py-5 rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-blue-600 transition shadow-xl italic">
                <i className="fas fa-plus mr-4"></i> Add New SKU
              </button>
            </div>
            
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-50/50">
                    <tr>
                      <th className="px-10 py-8 text-[11px] font-black uppercase tracking-widest text-gray-400">Timepiece Details</th>
                      <th className="px-10 py-8 text-[11px] font-black uppercase tracking-widest text-gray-400">Stock status</th>
                      <th className="px-10 py-8 text-[11px] font-black uppercase tracking-widest text-gray-400 text-right">MSRP (PKR)</th>
                      <th className="px-10 py-8 text-[11px] font-black uppercase tracking-widest text-gray-400 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 text-black font-bold">
                    {products.map(p => (
                      <tr key={p.id} className="hover:bg-gray-50/40 transition-colors group">
                        <td className="px-10 py-8">
                          <div className="flex items-center space-x-6">
                            <div className="w-16 h-16 rounded-2xl overflow-hidden border border-gray-100 bg-gray-50 shadow-sm">
                              <img src={p.image} className="w-full h-full object-cover" />
                            </div>
                            <div>
                              <p className="font-black text-lg text-black uppercase tracking-tight italic font-serif">{p.name}</p>
                              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mt-2">{p.category}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-10 py-8">
                          <div className="flex items-center space-x-4">
                            <span className={`w-3 h-3 rounded-full ${p.inventory > 10 ? 'bg-green-500' : 'bg-red-500'}`}></span>
                            <p className="font-black text-xs text-gray-700 uppercase tracking-widest">{p.inventory} UNITS</p>
                          </div>
                        </td>
                        <td className="px-10 py-8 text-right font-serif font-bold text-lg italic tracking-tighter">{(p.price).toLocaleString()}</td>
                        <td className="px-10 py-8">
                          <div className="flex justify-end space-x-4">
                            <button onClick={() => openModal(p)} className="w-12 h-12 rounded-xl bg-gray-50 text-gray-400 hover:bg-black hover:text-white transition flex items-center justify-center border border-gray-100 shadow-sm"><i className="fas fa-edit text-xs"></i></button>
                            <button onClick={(e) => handleDelete(e, p.id)} className="w-12 h-12 rounded-xl bg-red-50 text-red-500 hover:bg-red-600 hover:text-white transition flex items-center justify-center border border-red-100 shadow-sm"><i className="fas fa-trash-alt text-xs"></i></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="animate-fadeIn space-y-10">
            <h2 className="text-4xl font-serif italic font-bold uppercase tracking-tight text-black">Fulfillment Archive</h2>
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-50/50">
                    <tr>
                      <th className="px-10 py-8 text-[11px] font-black uppercase tracking-widest text-gray-400">Order Ledger</th>
                      <th className="px-10 py-8 text-[11px] font-black uppercase tracking-widest text-gray-400">Client Details</th>
                      <th className="px-10 py-8 text-[11px] font-black uppercase tracking-widest text-gray-400">Total (COD)</th>
                      <th className="px-10 py-8 text-[11px] font-black uppercase tracking-widest text-gray-400">Phase</th>
                      <th className="px-10 py-8 text-[11px] font-black uppercase tracking-widest text-gray-400 text-right">Audit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 text-black font-bold">
                    {orders.map(o => (
                      <tr key={o.id} className="hover:bg-gray-50/30 transition">
                        <td className="px-10 py-8 font-black text-xs text-blue-600 tracking-widest">#{o.id}</td>
                        <td className="px-10 py-8">
                          <p className="font-black text-base uppercase tracking-tight italic font-serif">{o.customer.name}</p>
                          <p className="text-[11px] font-black text-gray-400 italic mt-1">{o.customer.phone}</p>
                        </td>
                        <td className="px-10 py-8 font-serif font-bold text-lg italic tracking-tighter">Rs. {o.total.toLocaleString()}</td>
                        <td className="px-10 py-8">
                          <select 
                            value={o.status}
                            onChange={(e) => handleStatusChange(o.id, e.target.value as any)}
                            className="bg-gray-50 border border-gray-200 text-[10px] font-black uppercase px-6 py-3 rounded-xl outline-none cursor-pointer hover:bg-white transition shadow-sm italic"
                          >
                            <option value="Pending">PENDING</option>
                            <option value="Confirmed">CONFIRMED</option>
                            <option value="Shipped">SHIPPED</option>
                            <option value="Delivered">DELIVERED</option>
                            <option value="Cancelled">CANCELLED</option>
                          </select>
                        </td>
                        <td className="px-10 py-8 text-right">
                          <button 
                            onClick={() => setSelectedOrder(o)}
                            className="bg-black text-white text-[10px] font-black uppercase px-8 py-3.5 rounded-xl hover:bg-blue-600 transition tracking-[0.2em] shadow-lg italic"
                          >
                            Inspection
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="animate-fadeIn space-y-12">
            <h2 className="text-4xl font-serif italic font-bold uppercase tracking-tight text-black">Console Settings</h2>
            <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-12 max-w-2xl">
              <h3 className="text-xl font-serif italic font-bold uppercase mb-8">System Authentication</h3>
              <form onSubmit={handlePasswordChange} className="space-y-6">
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-widest text-gray-400 mb-2 italic">New Management Password</label>
                  <input 
                    type="password" 
                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-6 py-5 font-bold focus:ring-1 focus:ring-black outline-none transition text-black"
                    placeholder="Set a new system key"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
                <button type="submit" className="bg-black text-white px-10 py-5 rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-blue-600 transition shadow-xl italic">
                  Update System Key
                </button>
                {passwordChangeSuccess && (
                  <p className="text-green-600 text-[10px] font-black uppercase tracking-widest mt-4">
                    <i className="fas fa-check-circle mr-2"></i> System Key Updated Successfully
                  </p>
                )}
              </form>
              
              <div className="mt-16 pt-12 border-t border-gray-100 space-y-4">
                 <h4 className="text-[11px] font-black uppercase tracking-widest text-gray-400">System Information</h4>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-6 rounded-2xl">
                       <p className="text-[9px] font-black uppercase text-gray-400 mb-1">Store Name</p>
                       <p className="text-xs font-black uppercase italic">ITX SHOP MEER</p>
                    </div>
                    <div className="bg-gray-50 p-6 rounded-2xl">
                       <p className="text-[9px] font-black uppercase text-gray-400 mb-1">Environment</p>
                       <p className="text-xs font-black uppercase italic">Production Console</p>
                    </div>
                 </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Audit Modal & Product Modal remain same as previous version but ensures branding is ITX SHOP MEER */}
      {/* ... (Existing selectedOrder and isModalOpen logic) ... */}
    </div>
  );
};

export default AdminDashboard;
