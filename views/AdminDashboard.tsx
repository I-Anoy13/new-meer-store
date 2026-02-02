
import React, { useState, useMemo, useRef } from 'react';
import { Product, Order, User, UserRole, Variant } from '../types';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
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
  const [uploading, setUploading] = useState(false);

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    e.currentTarget.src = PLACEHOLDER_IMAGE;
  };

  // Monthly Sales Trend Data Calculation
  const salesTrendData = useMemo(() => {
    const data = [];
    const now = new Date();
    
    // Calculate for last 6 months
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthLabel = d.toLocaleString('default', { month: 'short' });
      const yearLabel = d.getFullYear();
      
      const monthlyOrders = orders.filter(o => {
        const orderDate = new Date(o.date);
        return orderDate.getMonth() === d.getMonth() && orderDate.getFullYear() === d.getFullYear();
      });

      const revenue = monthlyOrders.reduce((sum, o) => sum + o.total, 0);
      const volume = monthlyOrders.length;

      data.push({
        name: `${monthLabel} ${yearLabel}`,
        revenue,
        orders: volume
      });
    }
    return data;
  }, [orders]);

  // Filter & Sort States
  const [productSearch, setProductSearch] = useState('');
  const [productCategoryFilter, setProductCategoryFilter] = useState('All');
  const [productStockFilter, setProductStockFilter] = useState('All');
  const [productSort, setProductSort] = useState<'name-asc' | 'name-desc' | 'price-asc' | 'price-desc' | 'stock-asc' | 'stock-desc'>('name-asc');

  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('All');
  const [orderSort, setOrderSort] = useState<'date-desc' | 'date-asc' | 'total-desc' | 'total-asc'>('date-desc');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [newPassword, setNewPassword] = useState('');

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

  const filteredProducts = useMemo(() => {
    let result = [...products];

    if (productSearch) {
      result = result.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()));
    }

    if (productCategoryFilter !== 'All') {
      result = result.filter(p => p.category === productCategoryFilter);
    }

    if (productStockFilter === 'Low') {
      result = result.filter(p => p.inventory < 10 && p.inventory > 0);
    } else if (productStockFilter === 'Out') {
      result = result.filter(p => p.inventory === 0);
    }

    result.sort((a, b) => {
      switch (productSort) {
        case 'name-asc': return a.name.localeCompare(b.name);
        case 'name-desc': return b.name.localeCompare(a.name);
        case 'price-asc': return a.price - b.price;
        case 'price-desc': return b.price - a.price;
        case 'stock-asc': return a.inventory - b.inventory;
        case 'stock-desc': return b.inventory - a.inventory;
        default: return 0;
      }
    });

    return result;
  }, [products, productSearch, productCategoryFilter, productStockFilter, productSort]);

  const filteredOrders = useMemo(() => {
    let result = [...orders];

    if (orderSearch) {
      result = result.filter(o => 
        o.customer.name.toLowerCase().includes(orderSearch.toLowerCase()) || 
        o.id.toLowerCase().includes(orderSearch.toLowerCase())
      );
    }

    if (orderStatusFilter !== 'All') {
      result = result.filter(o => o.status === orderStatusFilter);
    }

    result.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      switch (orderSort) {
        case 'date-desc': return dateB - dateA;
        case 'date-asc': return dateA - dateB;
        case 'total-desc': return b.total - a.total;
        case 'total-asc': return a.total - b.total;
        default: return 0;
      }
    });

    return result;
  }, [orders, orderSearch, orderStatusFilter, orderSort]);

  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category));
    return ['All', ...Array.from(cats)];
  }, [products]);

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
    alert("Passkey Updated Successfully");
  };

  const handleDelete = async (e: React.MouseEvent, productId: string) => {
    e.preventDefault();
    if (window.confirm('WARNING: Are you sure you want to permanently delete this product from the ITX database?')) {
      deleteProduct(productId);
    }
  };

  const handleStatusChange = async (orderId: string, status: Order['status']) => {
    const { error } = await supabase.from('orders').update({ status }).eq('id', orderId);
    if (!error) {
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `product-images/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('products')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('products')
        .getPublicUrl(filePath);

      setProductForm(prev => ({ ...prev, image: data.publicUrl }));
    } catch (error: any) {
      alert('Error uploading image: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProduct) {
      const updatedProduct = { ...editingProduct, ...productForm };
      const { error } = await supabase.from('products').update(updatedProduct).eq('id', editingProduct.id);
      if (!error) {
        setProducts(prev => prev.map(p => p.id === editingProduct.id ? updatedProduct : p));
      }
    } else {
      const newProduct: Product = {
        ...productForm,
        id: `PROD-${Date.now()}`,
        rating: 5,
        reviews: []
      } as Product;
      const { error } = await supabase.from('products').insert([newProduct]);
      if (!error) {
        setProducts(prev => [newProduct, ...prev]);
      }
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

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-40 flex flex-col items-center">
        <div className="w-24 h-24 bg-black rounded-3xl flex items-center justify-center mb-10 text-4xl text-white shadow-2xl">
          <i className="fas fa-terminal"></i>
        </div>
        <h2 className="text-4xl font-serif italic font-bold tracking-tight uppercase mb-8 text-black">ITX SHOP MEER CONSOLE</h2>
        <form onSubmit={handleAdminLogin} className="w-full max-w-sm space-y-4">
          <input 
            type="password" 
            placeholder="System Password" 
            className={`w-full p-6 bg-white border ${loginError ? 'border-red-500' : 'border-gray-100'} rounded-2xl font-black text-center outline-none focus:ring-1 focus:ring-black transition shadow-sm text-black`}
            value={adminPasswordInput}
            onChange={(e) => setAdminPasswordInput(e.target.value)}
          />
          <button type="submit" className="w-full p-6 bg-black text-white rounded-2xl font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-xl flex items-center justify-center">
            Log into ITX System <i className="fas fa-key ml-4"></i>
          </button>
        </form>
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
              <span className="w-2 h-2 bg-green-500 rounded-full mr-3"></span> {user.name} • Live Supabase Connected
            </p>
          </div>
          
          <div className="flex bg-white rounded-2xl p-2 border border-gray-200 shadow-sm overflow-x-auto">
            {['overview', 'products', 'orders', 'settings'].map(tab => (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab as any)} 
                className={`px-10 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-black text-white shadow-lg' : 'text-gray-400 hover:text-black hover:bg-gray-50'}`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-10">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
              <div className="bg-black text-white p-10 rounded-3xl shadow-xl">
                  <p className="text-[11px] font-black uppercase opacity-60 mb-3">Total Revenue (PKR)</p>
                  <p className="text-4xl font-black">Rs. {totalRevenue.toLocaleString()}</p>
              </div>
              <div className="bg-white p-10 rounded-3xl border border-gray-100 shadow-sm">
                  <p className="text-[11px] font-black uppercase text-gray-400 mb-3">Pending Orders</p>
                  <p className="text-4xl font-black text-black">{pendingOrdersCount}</p>
              </div>
              <div className="bg-white p-10 rounded-3xl border border-gray-100 shadow-sm">
                  <p className="text-[11px] font-black uppercase text-gray-400 mb-3">Vault SKU Items</p>
                  <p className="text-4xl font-black text-black">{activeProductsCount}</p>
              </div>
              <div className="bg-red-500 text-white p-10 rounded-3xl shadow-lg">
                  <p className="text-[11px] font-black uppercase opacity-60 mb-3">Low Stock Alerts</p>
                  <p className="text-4xl font-black">{lowStockCount}</p>
              </div>
            </div>

            {/* Sales Trends Section */}
            <div className="bg-white p-10 rounded-[2.5rem] border border-gray-100 shadow-sm">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
                <div>
                  <h3 className="text-2xl font-serif italic font-bold text-black uppercase tracking-tight">Monthly Performance Trends</h3>
                  <p className="text-gray-400 text-[10px] font-black uppercase tracking-[0.2em] mt-1">Rolling 6-Month Sales Ledger</p>
                </div>
                <div className="flex space-x-6">
                  <div className="flex items-center space-x-2">
                    <span className="w-3 h-3 bg-black rounded-full"></span>
                    <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">Revenue</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
                    <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">Order Volume</span>
                  </div>
                </div>
              </div>

              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={salesTrendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#000000" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#000000" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f1f1" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fontWeight: 900, fill: '#9ca3af' }}
                      dy={10}
                    />
                    <YAxis 
                      yAxisId="left"
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fontWeight: 900, fill: '#9ca3af' }}
                      tickFormatter={(value) => `Rs.${(value / 1000)}k`}
                    />
                    <YAxis 
                      yAxisId="right"
                      orientation="right"
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fontWeight: 900, fill: '#3b82f6' }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        borderRadius: '16px', 
                        border: '1px solid #f1f1f1', 
                        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                        padding: '12px'
                      }}
                      itemStyle={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}
                      labelStyle={{ fontSize: '11px', fontWeight: 900, marginBottom: '8px', borderBottom: '1px solid #f1f1f1', paddingBottom: '4px' }}
                    />
                    <Area 
                      yAxisId="left"
                      type="monotone" 
                      dataKey="revenue" 
                      stroke="#000000" 
                      strokeWidth={3}
                      fillOpacity={1} 
                      fill="url(#colorRevenue)" 
                    />
                    <Area 
                      yAxisId="right"
                      type="monotone" 
                      dataKey="orders" 
                      stroke="#3b82f6" 
                      strokeWidth={3}
                      fillOpacity={1} 
                      fill="url(#colorOrders)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'products' && (
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <h2 className="text-4xl font-serif italic font-bold uppercase text-black">Inventory Registry</h2>
              <button onClick={() => openModal()} className="bg-black text-white px-10 py-5 rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-blue-600 transition shadow-xl">
                Add New SKU
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="Search Timepieces..." 
                  className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-[10px] font-black uppercase outline-none focus:ring-1 focus:ring-black transition"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                />
                <i className="fas fa-search absolute right-4 top-1/2 -translate-y-1/2 text-gray-300"></i>
              </div>
              <select 
                className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-[10px] font-black uppercase outline-none focus:ring-1 focus:ring-black transition"
                value={productCategoryFilter}
                onChange={(e) => setProductCategoryFilter(e.target.value)}
              >
                {categories.map(cat => <option key={cat} value={cat}>{cat.toUpperCase()}</option>)}
              </select>
              <select 
                className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-[10px] font-black uppercase outline-none focus:ring-1 focus:ring-black transition"
                value={productStockFilter}
                onChange={(e) => setProductStockFilter(e.target.value)}
              >
                <option value="All">ALL STOCK LEVELS</option>
                <option value="Low">LOW STOCK ( &lt; 10 )</option>
                <option value="Out">OUT OF STOCK</option>
              </select>
              <select 
                className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-[10px] font-black uppercase outline-none focus:ring-1 focus:ring-black transition"
                value={productSort}
                onChange={(e) => setProductSort(e.target.value as any)}
              >
                <option value="name-asc">NAME: A-Z</option>
                <option value="name-desc">NAME: Z-A</option>
                <option value="price-asc">PRICE: LOW-HIGH</option>
                <option value="price-desc">PRICE: HIGH-LOW</option>
                <option value="stock-asc">STOCK: LOW-HIGH</option>
                <option value="stock-desc">STOCK: HIGH-LOW</option>
              </select>
            </div>

            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
               <table className="w-full text-left">
                  <thead className="bg-gray-50/50">
                    <tr>
                      <th className="px-10 py-8 text-[11px] font-black uppercase tracking-widest text-gray-400">SKU</th>
                      <th className="px-10 py-8 text-[11px] font-black uppercase tracking-widest text-gray-400">Stock</th>
                      <th className="px-10 py-8 text-[11px] font-black uppercase tracking-widest text-gray-400 text-right">Price</th>
                      <th className="px-10 py-8 text-[11px] font-black uppercase tracking-widest text-gray-400 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map(p => (
                      <tr key={p.id} className="border-t border-gray-50">
                        <td className="px-10 py-8">
                          <div className="flex items-center space-x-4">
                            <img 
                              src={p.image} 
                              onError={handleImageError}
                              className="w-10 h-10 rounded-lg object-cover" 
                            />
                            <span className="font-black uppercase italic">{p.name}</span>
                          </div>
                        </td>
                        <td className="px-10 py-8">
                          <span className={`font-black text-[10px] px-3 py-1 rounded-full ${p.inventory < 10 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                            {p.inventory} UNITS
                          </span>
                        </td>
                        <td className="px-10 py-8 text-right font-serif font-bold italic">Rs. {p.price.toLocaleString()}</td>
                        <td className="px-10 py-8 text-right">
                           <button onClick={() => openModal(p)} className="text-blue-600 mr-4 font-black uppercase text-[10px] hover:underline">Edit</button>
                           <button onClick={(e) => handleDelete(e, p.id)} className="text-red-600 font-black uppercase text-[10px] hover:underline">Delete</button>
                        </td>
                      </tr>
                    ))}
                    {filteredProducts.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-10 py-20 text-center text-gray-400 font-black uppercase tracking-widest">No matching items found in the vault</td>
                      </tr>
                    )}
                  </tbody>
               </table>
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="space-y-8">
            <h2 className="text-4xl font-serif italic font-bold uppercase text-black">Live Fulfilment Ledger</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="Search Customer or Order ID..." 
                  className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-[10px] font-black uppercase outline-none focus:ring-1 focus:ring-black transition"
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                />
                <i className="fas fa-search absolute right-4 top-1/2 -translate-y-1/2 text-gray-300"></i>
              </div>
              <select 
                className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-[10px] font-black uppercase outline-none focus:ring-1 focus:ring-black transition"
                value={orderStatusFilter}
                onChange={(e) => setOrderStatusFilter(e.target.value)}
              >
                <option value="All">ALL STATUSES</option>
                <option value="Pending">PENDING</option>
                <option value="Confirmed">CONFIRMED</option>
                <option value="Shipped">SHIPPED</option>
                <option value="Delivered">DELIVERED</option>
                <option value="Cancelled">CANCELLED</option>
              </select>
              <select 
                className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-[10px] font-black uppercase outline-none focus:ring-1 focus:ring-black transition"
                value={orderSort}
                onChange={(e) => setOrderSort(e.target.value as any)}
              >
                <option value="date-desc">DATE: NEWEST FIRST</option>
                <option value="date-asc">DATE: OLDEST FIRST</option>
                <option value="total-desc">TOTAL: HIGH-LOW</option>
                <option value="total-asc">TOTAL: LOW-HIGH</option>
              </select>
            </div>

            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
               <table className="w-full text-left">
                  <thead className="bg-gray-50/50">
                    <tr>
                      <th className="px-10 py-8 text-[11px] font-black uppercase tracking-widest text-gray-400">Order ID</th>
                      <th className="px-10 py-8 text-[11px] font-black uppercase tracking-widest text-gray-400">Customer</th>
                      <th className="px-10 py-8 text-[11px] font-black uppercase tracking-widest text-gray-400">Date</th>
                      <th className="px-10 py-8 text-[11px] font-black uppercase tracking-widest text-gray-400">Total</th>
                      <th className="px-10 py-8 text-[11px] font-black uppercase tracking-widest text-gray-400">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map(o => (
                      <tr key={o.id} className="border-t border-gray-50">
                        <td className="px-10 py-8 font-black text-xs text-blue-600">#{o.id}</td>
                        <td className="px-10 py-8">
                          <div className="flex flex-col">
                            <span className="font-black uppercase italic">{o.customer.name}</span>
                            <span className="text-[9px] text-gray-400 font-bold">{o.customer.city}</span>
                          </div>
                        </td>
                        <td className="px-10 py-8 text-[10px] font-black text-gray-500">{new Date(o.date).toLocaleDateString()}</td>
                        <td className="px-10 py-8 font-serif font-bold italic">Rs. {o.total.toLocaleString()}</td>
                        <td className="px-10 py-8">
                           <select 
                            value={o.status}
                            onChange={(e) => handleStatusChange(o.id, e.target.value as any)}
                            className="bg-gray-50 border border-gray-200 text-[10px] font-black uppercase px-4 py-2 rounded-xl focus:ring-1 focus:ring-black outline-none"
                           >
                            <option value="Pending">PENDING</option>
                            <option value="Confirmed">CONFIRMED</option>
                            <option value="Shipped">SHIPPED</option>
                            <option value="Delivered">DELIVERED</option>
                            <option value="Cancelled">CANCELLED</option>
                           </select>
                        </td>
                      </tr>
                    ))}
                    {filteredOrders.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-10 py-20 text-center text-gray-400 font-black uppercase tracking-widest">No matching orders found in the ledger</td>
                      </tr>
                    )}
                  </tbody>
               </table>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="bg-white rounded-[2.5rem] p-12 max-w-2xl border border-gray-100 shadow-sm">
             <h2 className="text-4xl font-serif italic font-bold uppercase mb-8 text-black">Console Settings</h2>
             <form onSubmit={handlePasswordChange} className="space-y-6">
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-widest text-gray-400 mb-2 italic">New Console Passkey</label>
                  <input 
                    type="password" 
                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-6 py-5 font-bold focus:ring-1 focus:ring-black outline-none transition text-black"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
                <button type="submit" className="bg-black text-white px-10 py-5 rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-blue-600 transition shadow-xl italic">
                  Update Passkey
                </button>
             </form>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl p-10 overflow-y-auto max-h-[90vh] custom-scrollbar">
            <h2 className="text-2xl font-serif font-bold italic uppercase mb-8 text-black">{editingProduct ? 'Edit Timepiece' : 'Register New Timepiece'}</h2>
            <form onSubmit={handleSaveProduct} className="space-y-6">
               <div className="flex flex-col items-center mb-6">
                 <div 
                   onClick={() => fileInputRef.current?.click()}
                   className="w-32 h-32 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 transition-colors overflow-hidden relative group"
                 >
                   {productForm.image ? (
                     <>
                       <img 
                        src={productForm.image} 
                        onError={handleImageError}
                        className="w-full h-full object-cover" 
                       />
                       <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                         <i className="fas fa-camera text-white"></i>
                       </div>
                     </>
                   ) : (
                     <>
                       <i className={`fas ${uploading ? 'fa-spinner fa-spin' : 'fa-camera'} text-gray-300 text-2xl mb-2`}></i>
                       <span className="text-[8px] font-black text-gray-400 uppercase">Upload Frame</span>
                     </>
                   )}
                   <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleImageUpload} 
                    className="hidden" 
                    accept="image/*"
                   />
                 </div>
                 <p className="mt-2 text-[9px] font-black text-gray-400 uppercase tracking-widest">Click icon to upload asset</p>
               </div>

               <input 
                required
                className="w-full bg-gray-50 border border-gray-100 rounded-xl px-5 py-4 font-bold text-black focus:ring-1 focus:ring-black outline-none"
                placeholder="Timepiece Name"
                value={productForm.name}
                onChange={e => setProductForm({...productForm, name: e.target.value})}
               />
               <textarea 
                required
                className="w-full bg-gray-50 border border-gray-100 rounded-xl px-5 py-4 font-bold text-black h-32 resize-none focus:ring-1 focus:ring-black outline-none"
                placeholder="Artisanal Description"
                value={productForm.description}
                onChange={e => setProductForm({...productForm, description: e.target.value})}
               />
               <div className="grid grid-cols-2 gap-6">
                  <input 
                    required type="number"
                    className="bg-gray-50 border border-gray-100 rounded-xl px-5 py-4 font-bold text-black focus:ring-1 focus:ring-black outline-none"
                    placeholder="MSRP (PKR)"
                    value={productForm.price || ''}
                    onChange={e => setProductForm({...productForm, price: Number(e.target.value)})}
                  />
                  <input 
                    required type="number"
                    className="bg-gray-50 border border-gray-100 rounded-xl px-5 py-4 font-bold text-black focus:ring-1 focus:ring-black outline-none"
                    placeholder="Inventory Count"
                    value={productForm.inventory || ''}
                    onChange={e => setProductForm({...productForm, inventory: Number(e.target.value)})}
                  />
               </div>
               <div className="space-y-2">
                 <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest italic ml-1">Asset URL Reference</label>
                 <input 
                  required
                  className="w-full bg-gray-50 border border-gray-100 rounded-xl px-5 py-4 font-bold text-black focus:ring-1 focus:ring-black outline-none"
                  placeholder="Master Image URL (Auto-filled on upload)"
                  value={productForm.image}
                  onChange={e => setProductForm({...productForm, image: e.target.value})}
                 />
               </div>
               <div className="space-y-2">
                 <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest italic ml-1">Video Resource (Optional)</label>
                 <input 
                  className="w-full bg-gray-50 border border-gray-100 rounded-xl px-5 py-4 font-bold text-black focus:ring-1 focus:ring-black outline-none"
                  placeholder="Asset Video URL (MP4)"
                  value={productForm.video}
                  onChange={e => setProductForm({...productForm, video: e.target.value})}
                 />
               </div>
               <div className="flex space-x-4 pt-4">
                  <button type="submit" disabled={uploading} className="flex-grow bg-black text-white py-5 rounded-xl font-black uppercase tracking-widest italic hover:bg-blue-600 transition disabled:bg-gray-400">
                    {editingProduct ? 'Update ITX Database' : 'Register in ITX Vault'}
                  </button>
                  <button type="button" onClick={closeModal} className="bg-gray-100 text-black px-10 py-5 rounded-xl font-black uppercase tracking-widest italic hover:bg-gray-200 transition">Cancel</button>
               </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
