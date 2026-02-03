
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Product, Order, User, UserRole } from '../types';
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

const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
  products, setProducts, deleteProduct, orders, user, login, systemPassword, setSystemPassword, refreshData, updateStatusOverride
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'products' | 'orders' | 'settings'>(() => {
    return (localStorage.getItem('itx_admin_tab') as any) || 'overview';
  });

  const [newProduct, setNewProduct] = useState({ name: '', price: '', category: 'Watches', description: '' });
  const [newProductImages, setNewProductImages] = useState<string[]>([]);
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null);
  const [orderSearch, setOrderSearch] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  useEffect(() => {
    localStorage.setItem('itx_admin_tab', activeTab);
  }, [activeTab]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    refreshData();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAddingProduct(true);
    try {
      const payload = {
        name: newProduct.name,
        price_pkr: Number(newProduct.price),
        image: newProductImages[0] || PLACEHOLDER_IMAGE,
        features: newProductImages.length > 0 ? newProductImages : [PLACEHOLDER_IMAGE],
        category: newProduct.category,
        description: newProduct.description,
        inventory: 10,
        status: 'active'
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
          reviews: [],
          variants: []
        }]);
        setNewProduct({ name: '', price: '', category: 'Watches', description: '' });
        setNewProductImages([]);
        alert("Product listed successfully.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsAddingProduct(false);
    }
  };

  const handleStatusChange = async (orderId: string, status: Order['status'], dbId?: number) => {
    if (isUpdatingStatus) return;
    setIsUpdatingStatus(true);
    if (updateStatusOverride) updateStatusOverride(orderId, status);
    if (viewingOrder?.id === orderId) setViewingOrder(prev => prev ? { ...prev, status } : null);
    try {
      let query = supabase.from('orders').update({ status: status.toLowerCase() });
      if (dbId) query = query.eq('id', dbId);
      else query = query.eq('order_id', orderId);
      await query;
    } finally { setIsUpdatingStatus(false); }
  };

  const filteredOrders = useMemo(() => {
    return orders.filter(o => 
      o.customer.name.toLowerCase().includes(orderSearch.toLowerCase()) || 
      o.id.toLowerCase().includes(orderSearch.toLowerCase())
    );
  }, [orders, orderSearch]);

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-32 flex flex-col items-center">
        <h2 className="text-xl font-bold mb-8 uppercase tracking-tight">Admin Access</h2>
        <form onSubmit={(e) => { e.preventDefault(); if (adminPasswordInput === systemPassword) login(UserRole.ADMIN); }} className="w-full max-w-xs space-y-4">
          <input type="password" placeholder="Passkey" className="w-full p-3 border rounded-lg text-center font-bold outline-none text-sm" value={adminPasswordInput} onChange={(e) => setAdminPasswordInput(e.target.value)} />
          <button type="submit" className="w-full p-3 bg-black text-white rounded-lg font-bold uppercase tracking-wide text-xs">Login</button>
        </form>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen pb-20">
      <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-50 flex justify-between items-center">
        <h1 className="text-sm font-bold uppercase tracking-wide">Admin Console</h1>
        <button onClick={handleRefresh} className={`p-2 text-sm ${isRefreshing ? 'animate-spin' : ''}`}><i className="fas fa-sync-alt"></i></button>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="flex overflow-x-auto gap-2 mb-8 no-scrollbar">
            {['overview', 'products', 'orders', 'settings'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab as any)} className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wide whitespace-nowrap border ${activeTab === tab ? 'bg-black text-white border-black' : 'bg-white text-gray-500 border-gray-200'}`}>
                {tab}
              </button>
            ))}
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-4">
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-black text-white p-6 rounded-xl">
                   <p className="text-[10px] font-bold uppercase tracking-wide opacity-60 mb-1">Total Revenue</p>
                   <p className="text-xl font-bold">Rs. {orders.reduce((s,o) => s+o.total, 0).toLocaleString()}</p>
                </div>
                <div className="bg-white p-6 rounded-xl border border-gray-200">
                   <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Total Orders</p>
                   <p className="text-xl font-bold text-black">{orders.length}</p>
                </div>
                <div className="bg-white p-6 rounded-xl border border-gray-200">
                   <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Items</p>
                   <p className="text-xl font-bold text-black">{products.length}</p>
                </div>
             </div>
          </div>
        )}

        {activeTab === 'products' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
             <div className="bg-white p-6 rounded-xl border border-gray-200">
                <h3 className="text-xs font-bold uppercase mb-6 tracking-wide">List New Product</h3>
                <form onSubmit={handleCreateProduct} className="space-y-4">
                   <input required type="text" placeholder="Product Name" className="w-full p-3 bg-gray-50 rounded-lg font-bold text-xs outline-none" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} />
                   <input required type="number" placeholder="Price (PKR)" className="w-full p-3 bg-gray-50 rounded-lg font-bold text-xs outline-none" value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: e.target.value})} />
                   <textarea required placeholder="Product Description" className="w-full p-3 bg-gray-50 rounded-lg font-bold text-xs h-32 outline-none whitespace-pre-wrap" value={newProduct.description} onChange={e => setNewProduct({...newProduct, description: e.target.value})} />
                   <button type="submit" disabled={isAddingProduct} className="w-full bg-black text-white py-3 rounded-lg font-bold uppercase text-[10px] tracking-wide">
                      {isAddingProduct ? 'Processing...' : 'List Product'}
                   </button>
                </form>
             </div>

             <div className="space-y-3">
                {products.map(p => (
                  <div key={p.id} className="bg-white p-3 rounded-xl border border-gray-200 flex items-center justify-between">
                     <div className="flex items-center space-x-3">
                        <img src={p.image} className="w-10 h-10 rounded-lg object-cover" />
                        <div>
                           <p className="text-xs font-bold">{p.name}</p>
                           <p className="text-[10px] text-blue-600 font-bold">Rs. {p.price.toLocaleString()}</p>
                        </div>
                     </div>
                     <button onClick={() => deleteProduct(p.id)} className="text-red-500 p-2 text-sm"><i className="fas fa-trash"></i></button>
                  </div>
                ))}
             </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="space-y-4">
             <input type="text" placeholder="Search customer or ID..." className="w-full p-3 bg-white border border-gray-200 rounded-lg font-bold text-xs outline-none" value={orderSearch} onChange={e => setOrderSearch(e.target.value)} />
             <div className="grid grid-cols-1 gap-2">
                {filteredOrders.map(o => (
                  <div key={o.id} onClick={() => setViewingOrder(o)} className="bg-white p-4 rounded-xl border border-gray-200 flex justify-between items-center cursor-pointer hover:border-black transition">
                     <div>
                        <p className="text-[10px] font-bold text-gray-400">#{o.id}</p>
                        <p className="font-bold text-xs">{o.customer.name}</p>
                     </div>
                     <div className="text-right">
                        <p className="font-bold text-xs">Rs. {o.total.toLocaleString()}</p>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${o.status === 'Pending' ? 'bg-yellow-50 text-yellow-600' : 'bg-green-50 text-green-600'}`}>{o.status}</span>
                     </div>
                  </div>
                ))}
             </div>
          </div>
        )}
      </div>

      {viewingOrder && (
        <div className="fixed inset-0 z-[100] bg-black/40 flex items-end">
           <div className="bg-white w-full max-w-lg mx-auto h-[70vh] rounded-t-2xl p-6 overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                 <h2 className="text-lg font-bold uppercase tracking-tight">Order Details</h2>
                 <button onClick={() => setViewingOrder(null)} className="p-2"><i className="fas fa-times"></i></button>
              </div>
              
              <div className="space-y-5">
                 <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Customer</p>
                    <p className="text-sm font-bold">{viewingOrder.customer.name}</p>
                 </div>
                 <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Contact</p>
                    <p className="text-sm font-bold text-blue-600">{viewingOrder.customer.phone}</p>
                 </div>
                 <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Address</p>
                    <p className="text-xs font-medium text-gray-700">{viewingOrder.customer.address}</p>
                 </div>
                 <div className="bg-gray-50 p-4 rounded-xl">
                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Items</p>
                    {viewingOrder.items.map((item, i) => (
                      <div key={i} className="flex justify-between py-1 text-[11px] font-bold">
                         <span>{item.product.name} (x{item.quantity})</span>
                         <span>Rs. {(item.product.price * item.quantity).toLocaleString()}</span>
                      </div>
                    ))}
                 </div>
              </div>

              <div className="mt-8 pt-6 border-t border-gray-100 flex items-center justify-between">
                 <p className="text-lg font-bold">Rs. {viewingOrder.total.toLocaleString()}</p>
                 <select value={viewingOrder.status} onChange={e => handleStatusChange(viewingOrder.id, e.target.value as any, viewingOrder.dbId)} className="bg-black text-white p-2 rounded-lg font-bold text-[10px] outline-none">
                    {['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
                 </select>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
