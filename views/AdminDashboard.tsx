
import React, { useState, useMemo, useRef } from 'react';
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
  setSystemPassword,
  refreshData
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'products' | 'orders' | 'settings'>('overview');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [loginError, setLoginError] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

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
    category: 'Luxury Artisan',
    inventory: 0,
    image: '',
    video: '',
    variants: []
  });

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    e.currentTarget.src = PLACEHOLDER_IMAGE;
  };

  const totalRevenue = useMemo(() => orders.reduce((sum, o) => sum + o.total, 0), [orders]);
  const pendingOrdersCount = useMemo(() => orders.filter(o => o.status === 'Pending').length, [orders]);
  const activeProductsCount = products.length;
  const lowStockCount = products.filter(p => p.inventory < 10).length;

  const filteredProducts = useMemo(() => {
    let result = [...products];
    if (productSearch) result = result.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()));
    if (productCategoryFilter !== 'All') result = result.filter(p => p.category === productCategoryFilter);
    if (productStockFilter === 'Low') result = result.filter(p => p.inventory < 10 && p.inventory > 0);
    else if (productStockFilter === 'Out') result = result.filter(p => p.inventory === 0);
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
    if (orderSearch) result = result.filter(o => o.customer.name.toLowerCase().includes(orderSearch.toLowerCase()) || o.id.toLowerCase().includes(orderSearch.toLowerCase()));
    if (orderStatusFilter !== 'All') result = result.filter(o => o.status === orderStatusFilter);
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

  const categories = useMemo(() => ['All', ...Array.from(new Set(products.map(p => p.category)))], [products]);

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPasswordInput === systemPassword) { login(UserRole.ADMIN); setLoginError(false); }
    else setLoginError(true);
  };

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 4) return alert("Password must be at least 4 characters.");
    setSystemPassword(newPassword);
    alert("Passkey Updated Successfully");
  };

  const handleDelete = async (e: React.MouseEvent, productId: string) => {
    e.preventDefault();
    if (window.confirm('Delete this product from the ITX database?')) deleteProduct(productId);
  };

  const handleStatusChange = async (orderId: string, status: Order['status']) => {
    const { error } = await supabase
      .from('orders')
      .update({ status: status.toLowerCase() })
      .eq('order_id', orderId);
    
    if (!error) {
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
    } else {
      console.error('Update status error:', error.message);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    const BUCKET_NAME = 'product-images';
    
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(fileName);

      setProductForm(prev => ({ ...prev, image: publicUrlData.publicUrl }));
    } catch (error: any) { 
      alert(`VAULT STORAGE ERROR: ${error.message}`); 
    }
    finally { setUploading(false); }
  };

  const addVariant = () => {
    const newVariant: Variant = {
      id: `VAR-${Date.now()}`,
      name: '',
      price: productForm.price || 0
    };
    setProductForm(prev => ({ ...prev, variants: [...prev.variants, newVariant] }));
  };

  const removeVariant = (id: string) => {
    setProductForm(prev => ({ ...prev, variants: prev.variants.filter(v => v.id !== id) }));
  };

  const updateVariant = (id: string, field: keyof Variant, value: any) => {
    setProductForm(prev => ({
      ...prev,
      variants: prev.variants.map(v => v.id === id ? { ...v, [field]: value } : v)
    }));
  };

  const SQL_FIX_SCRIPT = `
-- 1. FIX THE 'id' COLUMN (Change from UUID to TEXT)
-- This is critical because the app uses custom string IDs like 'PROD-...'
ALTER TABLE public.products ALTER COLUMN id TYPE text;

-- 2. ENSURE ALL COLUMNS EXIST
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS variants jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS video text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS rating numeric DEFAULT 5;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS reviews jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();

-- 3. ENSURE PERMISSIONS ARE OPEN
ALTER TABLE public.products DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.products TO anon, authenticated, service_role;

-- 4. REFRESH TABLE CACHE
NOTIFY pgrst, 'reload schema';
`;

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    
    const productId = editingProduct ? editingProduct.id : `PROD-${Date.now()}`;
    
    const productData = {
      id: productId,
      name: productForm.name,
      description: productForm.description,
      price: productForm.price,
      category: productForm.category,
      inventory: productForm.inventory,
      image: productForm.image,
      video: productForm.video || '',
      variants: productForm.variants,
      rating: editingProduct?.rating || 5,
      reviews: editingProduct?.reviews || []
    };

    try {
      const { error } = await supabase
        .from('products')
        .upsert([productData], { onConflict: 'id' });

      if (error) throw error;

      setIsModalOpen(false);
      refreshData(); 
      alert('SUCCESS: Timepiece published to ITX Vault.');
    } catch (error: any) {
      console.error('DATABASE ERROR:', error);
      
      const errorMsg = error.message.toLowerCase();
      const isMissingColumn = errorMsg.includes('column') || errorMsg.includes('not found');
      const isUuidError = errorMsg.includes('uuid') || errorMsg.includes('invalid input syntax');

      if (isMissingColumn || isUuidError) {
        let diagnostic = "DATABASE MISMATCH DETECTED:\n\n";
        if (isUuidError) diagnostic += "- Your 'id' column is likely 'uuid' type but needs to be 'text'.\n";
        if (isMissingColumn) diagnostic += "- Your 'products' table is missing columns like 'image' or 'variants'.\n";
        
        if (window.confirm(`${diagnostic}\nWould you like to copy the REPAIR SQL script to your clipboard?`)) {
          navigator.clipboard.writeText(SQL_FIX_SCRIPT);
          alert('SQL COPIED! Go to Supabase > SQL Editor > Paste > Run.');
        }
      } else {
        alert(`PUBLISH ERROR: ${error.message}`);
      }
    } finally {
      setIsSaving(false);
    }
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

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-40 flex flex-col items-center">
        <div className="w-24 h-24 bg-black rounded-3xl flex items-center justify-center mb-10 text-4xl text-white shadow-2xl"><i className="fas fa-terminal"></i></div>
        <h2 className="text-4xl font-serif italic font-bold uppercase mb-8 text-black">ITX SHOP MEER CONSOLE</h2>
        <form onSubmit={handleAdminLogin} className="w-full max-w-sm space-y-4">
          <input type="password" placeholder="System Password" className={`w-full p-6 bg-white border ${loginError ? 'border-red-500' : 'border-gray-100'} rounded-2xl font-black text-center outline-none focus:ring-1 focus:ring-black transition shadow-sm text-black`} value={adminPasswordInput} onChange={(e) => setAdminPasswordInput(e.target.value)} />
          <button type="submit" className="w-full p-6 bg-black text-white rounded-2xl font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-xl flex items-center justify-center">Log into ITX System <i className="fas fa-key ml-4"></i></button>
        </form>
      </div>
    );
  }

  return (
    <div className="bg-[#fafafa] min-h-screen pb-32">
      <div className="container mx-auto px-8 py-16">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end mb-16 space-y-8 lg:space-y-0 border-b border-gray-100 pb-12">
          <div className="space-y-2">
            <h1 className="text-5xl font-serif font-bold italic tracking-tight text-black flex items-center">ITX <span className="ml-4 text-blue-600 not-italic font-black text-2xl tracking-[0.2em] uppercase">Control</span></h1>
            <div className="flex items-center space-x-4">
              <p className="text-gray-400 font-bold uppercase text-[10px] tracking-[0.4em] flex items-center"><span className="w-2 h-2 bg-green-500 rounded-full mr-3"></span> {user.name}</p>
              <button onClick={refreshData} className="text-blue-600 hover:text-blue-800 text-[9px] font-black uppercase tracking-widest flex items-center transition">
                <i className="fas fa-sync-alt mr-2"></i> Synchronize Vault
              </button>
            </div>
          </div>
          <div className="flex bg-white rounded-2xl p-2 border border-gray-200 shadow-sm overflow-x-auto">
            {['overview', 'products', 'orders', 'settings'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab as any)} className={`px-10 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-black text-white shadow-lg' : 'text-gray-400 hover:text-black hover:bg-gray-50'}`}>{tab}</button>
            ))}
          </div>
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-10">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
              <div className="bg-black text-white p-10 rounded-3xl shadow-xl"><p className="text-[11px] font-black uppercase opacity-60 mb-3">Total Revenue (PKR)</p><p className="text-4xl font-black">Rs. {totalRevenue.toLocaleString()}</p></div>
              <div className="bg-white p-10 rounded-3xl border border-gray-100 shadow-sm"><p className="text-[11px] font-black uppercase text-gray-400 mb-3">Pending Orders</p><p className="text-4xl font-black text-black">{pendingOrdersCount}</p></div>
              <div className="bg-white p-10 rounded-3xl border border-gray-100 shadow-sm"><p className="text-[11px] font-black uppercase text-gray-400 mb-3">Vault SKU Items</p><p className="text-4xl font-black text-black">{activeProductsCount}</p></div>
              <div className="bg-red-500 text-white p-10 rounded-3xl shadow-lg"><p className="text-[11px] font-black uppercase opacity-60 mb-3">Low Stock Alerts</p><p className="text-4xl font-black">{lowStockCount}</p></div>
            </div>
          </div>
        )}

        {activeTab === 'products' && (
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6"><h2 className="text-4xl font-serif italic font-bold uppercase text-black">Inventory Registry</h2><button onClick={() => openModal()} className="bg-black text-white px-10 py-5 rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-blue-600 transition shadow-xl">Add New SKU</button></div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
              <div className="relative"><input type="text" placeholder="Search..." className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-[10px] font-black outline-none" value={productSearch} onChange={(e) => setProductSearch(e.target.value)} /><i className="fas fa-search absolute right-4 top-1/2 -translate-y-1/2 text-gray-300"></i></div>
              <select className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-[10px] font-black uppercase" value={productCategoryFilter} onChange={(e) => setProductCategoryFilter(e.target.value)}>{categories.map(cat => <option key={cat} value={cat}>{cat.toUpperCase()}</option>)}</select>
              <select className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-[10px] font-black uppercase" value={productStockFilter} onChange={(e) => setProductStockFilter(e.target.value)}><option value="All">STOCK LEVELS</option><option value="Low">LOW STOCK</option><option value="Out">OUT OF STOCK</option></select>
              <select className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-[10px] font-black uppercase" value={productSort} onChange={(e) => setProductSort(e.target.value as any)}><option value="name-asc">NAME: A-Z</option><option value="price-asc">PRICE: LOW-HIGH</option><option value="stock-asc">STOCK: LOW-HIGH</option></select>
            </div>
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden text-black">
               <table className="w-full text-left">
                  <thead className="bg-gray-50/50"><tr><th className="px-10 py-8 text-[11px] font-black text-gray-400">SKU / Model</th><th className="px-10 py-8 text-[11px] font-black text-gray-400">Inventory</th><th className="px-10 py-8 text-[11px] font-black text-gray-400">Editions / Variants</th><th className="px-10 py-8 text-[11px] font-black text-gray-400 text-right">Base Price</th><th className="px-10 py-8 text-[11px] font-black text-gray-400 text-right">Action</th></tr></thead>
                  <tbody>{filteredProducts.map(p => (
                    <tr key={p.id} className="border-t border-gray-50 group hover:bg-gray-50/50 transition-colors">
                      <td className="px-10 py-8 flex items-center space-x-4">
                        <img src={p.image} onError={handleImageError} className="w-14 h-14 rounded-2xl object-cover shadow-sm border border-gray-100" />
                        <div className="flex flex-col">
                          <span className="font-black uppercase italic text-sm">{p.name}</span>
                          <span className="text-[9px] text-gray-400 font-bold tracking-widest uppercase">{p.category}</span>
                        </div>
                      </td>
                      <td className="px-10 py-8">
                        <span className={`font-black text-[9px] px-3 py-1 rounded-full ${p.inventory < 10 ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-green-50 text-green-600 border border-green-100'}`}>
                          {p.inventory} UNITS
                        </span>
                      </td>
                      <td className="px-10 py-8">
                        <div className="flex flex-col gap-1">
                          {p.variants && p.variants.length > 0 ? (
                            p.variants.map((v, i) => (
                              <div key={i} className="flex items-center space-x-2">
                                <span className="w-1 h-1 bg-blue-500 rounded-full"></span>
                                <span className="text-[9px] font-black text-gray-600 uppercase italic">
                                  {v.name} <span className="text-blue-600 ml-1">Rs.{v.price.toLocaleString()}</span>
                                </span>
                              </div>
                            ))
                          ) : (
                            <span className="text-[9px] font-bold text-gray-300 uppercase italic">Standard Model</span>
                          )}
                        </div>
                      </td>
                      <td className="px-10 py-8 text-right font-serif font-bold italic text-xl">Rs. {p.price.toLocaleString()}</td>
                      <td className="px-10 py-8 text-right whitespace-nowrap">
                        <button onClick={() => openModal(p)} className="text-blue-600 mr-6 font-black uppercase text-[10px] tracking-widest hover:underline">Modify</button>
                        <button onClick={(e) => handleDelete(e, p.id)} className="text-red-600 font-black uppercase text-[10px] tracking-widest hover:underline">Remove</button>
                      </td>
                    </tr>
                  ))}</tbody>
               </table>
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="space-y-8">
            <h2 className="text-4xl font-serif italic font-bold uppercase text-black">Live Fulfilment Ledger</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
              <div className="relative"><input type="text" placeholder="Search..." className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-[10px] font-black outline-none" value={orderSearch} onChange={(e) => setOrderSearch(e.target.value)} /><i className="fas fa-search absolute right-4 top-1/2 -translate-y-1/2 text-gray-300"></i></div>
              <select className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-[10px] font-black uppercase" value={orderStatusFilter} onChange={(e) => setOrderStatusFilter(e.target.value)}><option value="All">ALL STATUSES</option><option value="Pending">PENDING</option><option value="Confirmed">CONFIRMED</option><option value="Shipped">SHIPPED</option><option value="Delivered">DELIVERED</option></select>
              <select className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-[10px] font-black uppercase" value={orderSort} onChange={(e) => setOrderSort(e.target.value as any)}><option value="date-desc">NEWEST FIRST</option><option value="total-desc">TOTAL: HIGH-LOW</option></select>
            </div>
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden text-black">
               <table className="w-full text-left">
                  <thead className="bg-gray-50/50"><tr><th className="px-10 py-8 text-[11px] font-black text-gray-400">Order ID</th><th className="px-10 py-8 text-[11px] font-black text-gray-400">Customer</th><th className="px-10 py-8 text-[11px] font-black text-gray-400">Date</th><th className="px-10 py-8 text-[11px] font-black text-gray-400">Total</th><th className="px-10 py-8 text-[11px] font-black text-gray-400">Status</th></tr></thead>
                  <tbody>{filteredOrders.map(o => (<tr key={o.id} className="border-t border-gray-50"><td className="px-10 py-8 font-black text-xs text-blue-600">#{o.id}</td><td className="px-10 py-8 flex flex-col"><span className="font-black uppercase italic">{o.customer.name}</span><span className="text-[9px] text-gray-400 font-bold">{o.customer.city}</span></td><td className="px-10 py-8 text-[10px] font-black text-gray-500">{new Date(o.date).toLocaleDateString()}</td><td className="px-10 py-8 font-serif font-bold italic">Rs. {o.total.toLocaleString()}</td><td className="px-10 py-8"><select value={o.status} onChange={(e) => handleStatusChange(o.id, e.target.value as any)} className="bg-gray-50 border border-gray-200 text-[10px] font-black px-4 py-2 rounded-xl focus:ring-1 focus:ring-black outline-none"><option value="Pending">PENDING</option><option value="Confirmed">CONFIRMED</option><option value="Shipped">SHIPPED</option><option value="Delivered">DELIVERED</option><option value="Cancelled">CANCELLED</option></select></td></tr>))}</tbody>
               </table>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="bg-white rounded-[2.5rem] p-12 max-w-2xl border border-gray-100 shadow-sm">
             <h2 className="text-4xl font-serif italic font-bold uppercase mb-8 text-black">Console Settings</h2>
             <form onSubmit={handlePasswordChange} className="space-y-12">
                <div className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-widest text-gray-400 mb-2 italic">New Console Passkey</label>
                    <input type="password" className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-6 py-5 font-bold outline-none text-black" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                  </div>
                  <button type="submit" className="bg-black text-white px-10 py-5 rounded-xl text-[11px] font-black uppercase italic hover:bg-blue-600 shadow-xl transition">Update Passkey</button>
                </div>

                <div className="pt-12 border-t border-gray-100">
                  <h3 className="text-lg font-black uppercase tracking-widest text-red-600 mb-4 flex items-center italic">
                    <i className="fas fa-hammer mr-3"></i> Sync Database Schema
                  </h3>
                  <p className="text-xs text-gray-500 mb-6 font-medium leading-relaxed">
                    If you are seeing <strong>"invalid input syntax for type uuid"</strong> or <strong>"could not find image column"</strong>, your table needs a structural fix. 
                    This script changes your <strong>id</strong> column to <strong>text</strong> and adds missing columns.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button 
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(SQL_FIX_SCRIPT);
                        alert('FIX SCRIPT COPIED!\n\n1. Go to Supabase > SQL Editor\n2. New Query > Paste > Run.\n\nThis fix allows the app to save custom IDs and images.');
                      }} 
                      className="bg-black text-white px-8 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition shadow-lg"
                    >
                      Copy Fix SQL (UUID to Text)
                    </button>
                    <button 
                      type="button"
                      onClick={async () => {
                        const { data, error } = await supabase.from('products').select('*').limit(1);
                        if (error) alert(`DIAGNOSTIC FAILED:\n${error.message}\n\nTIP: Run the fix script above.`);
                        else alert(`DIAGNOSTIC PASSED:\nConnected to 'products' table successfully.`);
                      }} 
                      className="bg-gray-100 text-black border border-gray-200 px-8 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-200 transition"
                    >
                      Test Connection
                    </button>
                  </div>
                </div>
             </form>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl p-10 overflow-y-auto max-h-[90vh] custom-scrollbar">
            <h2 className="text-2xl font-serif font-bold italic uppercase mb-8 text-black border-b border-gray-100 pb-4">
              {editingProduct ? `Modify Entry: ${editingProduct.name}` : 'Register New Timepiece'}
            </h2>
            <form onSubmit={handleSaveProduct} className="space-y-6">
               <div className="flex flex-col items-center mb-6">
                 <div onClick={() => fileInputRef.current?.click()} className="w-40 h-40 bg-gray-50 rounded-[2rem] border-2 border-dashed border-gray-200 flex flex-col items-center justify-center cursor-pointer overflow-hidden relative group">
                   {productForm.image ? (
                     <>
                       <img src={productForm.image} onError={handleImageError} className="w-full h-full object-cover" />
                       <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                         <i className="fas fa-camera text-white text-2xl"></i>
                       </div>
                     </>
                   ) : (
                     <>
                       <i className={`fas ${uploading ? 'fa-spinner fa-spin' : 'fa-camera'} text-gray-300 text-3xl mb-3`}></i>
                       <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest text-center px-4">Upload Display Image</span>
                     </>
                   )}
                   <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" />
                 </div>
                 {productForm.image && <p className="text-[8px] text-green-600 font-black uppercase tracking-[0.2em] mt-3 italic"><i className="fas fa-check-circle mr-1"></i> Image Staged for ITX Vault</p>}
               </div>
               
               <div className="space-y-4 text-black">
                 <div className="grid grid-cols-1 gap-4">
                    <label className="block text-[10px] font-black uppercase text-gray-400 px-1 italic">Model Designation</label>
                    <input required className="w-full bg-gray-50 border border-gray-100 rounded-xl px-5 py-4 font-bold outline-none text-black placeholder:text-gray-300" placeholder="Model Name (e.g. Royal Oak Skeleton)" value={productForm.name} onChange={e => setProductForm({...productForm, name: e.target.value})} />
                 </div>
                 
                 <div className="grid grid-cols-1 gap-4">
                    <label className="block text-[10px] font-black uppercase text-gray-400 px-1 italic">Artisan Narrative</label>
                    <textarea required className="w-full bg-gray-50 border border-gray-100 rounded-xl px-5 py-4 font-bold h-32 resize-none outline-none text-black placeholder:text-gray-300" placeholder="Describe the craftsmanship and origins..." value={productForm.description} onChange={e => setProductForm({...productForm, description: e.target.value})} />
                 </div>
                 
                 <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 px-1 italic">Retail Price (PKR)</label>
                      <input required type="number" className="w-full bg-gray-50 border border-gray-100 rounded-xl px-5 py-4 font-bold outline-none text-black" placeholder="Price" value={productForm.price || ''} onChange={e => setProductForm({...productForm, price: Number(e.target.value)})} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 px-1 italic">Vault Inventory</label>
                      <input required type="number" className="w-full bg-gray-50 border border-gray-100 rounded-xl px-5 py-4 font-bold outline-none text-black" placeholder="Stock Level" value={productForm.inventory || ''} onChange={e => setProductForm({...productForm, inventory: Number(e.target.value)})} />
                    </div>
                 </div>

                 <div className="pt-6 border-t border-gray-100">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-[11px] font-black uppercase tracking-widest text-black flex items-center">
                        <i className="fas fa-layer-group mr-2 text-blue-600"></i> Product Variations
                      </h3>
                      <button type="button" onClick={addVariant} className="text-[8px] font-black bg-blue-600 text-white px-3 py-2 rounded-lg uppercase tracking-widest hover:bg-black transition">+ New Variant</button>
                    </div>
                    <div className="space-y-3">
                      {productForm.variants.map((variant) => (
                        <div key={variant.id} className="grid grid-cols-12 gap-3 items-center bg-gray-50/50 p-3 rounded-2xl border border-gray-100 group">
                          <div className="col-span-6">
                            <input className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-black" placeholder="Variant Name (e.g. Gold Plated)" value={variant.name} onChange={e => updateVariant(variant.id, 'name', e.target.value)} />
                          </div>
                          <div className="col-span-4">
                            <input type="number" className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-black" placeholder="Price" value={variant.price || ''} onChange={e => updateVariant(variant.id, 'price', Number(e.target.value))} />
                          </div>
                          <div className="col-span-2 text-right">
                            <button type="button" onClick={() => removeVariant(variant.id)} className="text-gray-300 hover:text-red-600 transition transform hover:scale-110"><i className="fas fa-minus-circle text-lg"></i></button>
                          </div>
                        </div>
                      ))}
                      {productForm.variants.length === 0 && (
                        <p className="text-[8px] text-gray-300 text-center py-4 border border-dashed border-gray-200 rounded-2xl font-black uppercase tracking-widest italic">No custom variations added</p>
                      )}
                    </div>
                 </div>
               </div>

               <div className="flex space-x-4 pt-10 sticky bottom-0 bg-white pb-2">
                  <button type="submit" disabled={uploading || isSaving} className="flex-grow bg-black text-white py-6 rounded-2xl font-black uppercase italic hover:bg-blue-600 transition disabled:bg-gray-400 shadow-2xl flex items-center justify-center space-x-3">
                    {isSaving ? <><i className="fas fa-satellite fa-spin"></i> <span>Syncing ITX Vault...</span></> : (editingProduct ? <>Update Record</> : <>Publish to Store</>)}
                  </button>
                  <button type="button" onClick={() => setIsModalOpen(false)} className="bg-gray-100 text-black px-10 py-6 rounded-2xl font-black uppercase hover:bg-gray-200 transition">Cancel</button>
               </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
