
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Product, Order, User, UserRole } from '../types';
import { supabase } from '../lib/supabase';

export interface AdminDashboardProps {
  products: Product[];
  setProducts: (action: React.SetStateAction<Product[]>) => void;
  deleteProduct: (productId: string) => void;
  orders: Order[];
  setOrders: (newRawOrder: any) => void;
  user: User | null;
  login: (role: UserRole) => void;
  systemPassword: string;
  setSystemPassword: (pwd: string) => void;
  refreshData: () => void;
  updateStatusOverride?: (orderId: string, status: Order['status']) => void;
}

// Added the component implementation and default export to fix the import error in AdminApp.tsx
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
  const [activeTab, setActiveTab] = useState<'orders' | 'products' | 'settings'>('orders');
  const [loginInput, setLoginInput] = useState('');
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [newProduct, setNewProduct] = useState<Partial<Product>>({
    name: '',
    price: 0,
    description: '',
    image: '',
    category: 'Luxury',
    inventory: 10
  });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginInput === systemPassword) {
      login(UserRole.ADMIN);
    } else {
      alert('Invalid Access Key');
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data, error } = await supabase.from('products').insert([
        {
          name: newProduct.name,
          price_pkr: newProduct.price,
          description: newProduct.description,
          image: newProduct.image,
          category: newProduct.category,
          inventory: newProduct.inventory,
          rating: 5,
          features: [newProduct.image]
        }
      ]).select();

      if (error) throw error;
      if (data) {
        refreshData();
        setIsAddingProduct(false);
        setNewProduct({ name: '', price: 0, description: '', image: '', category: 'Luxury', inventory: 10 });
      }
    } catch (err) {
      console.error(err);
      alert('Failed to add product');
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-xl border border-gray-100">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-black italic uppercase tracking-tighter text-black mb-2">ITX <span className="text-blue-600">CONSOLE</span></h1>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Restricted Access Area</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="relative">
              <i className="fas fa-lock absolute left-4 top-1/2 -translate-y-1/2 text-gray-300"></i>
              <input 
                type="password" 
                value={loginInput}
                onChange={(e) => setLoginInput(e.target.value)}
                placeholder="Access Key" 
                className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
            </div>
            <button type="submit" className="w-full bg-black text-white py-4 rounded-2xl font-bold uppercase text-xs tracking-widest hover:bg-blue-600 transition-all shadow-lg">
              Unlock Terminal
            </button>
          </form>
          <div className="mt-8 text-center">
            <a href="/" className="text-[10px] font-bold uppercase text-gray-400 hover:text-black transition">Return to Storefront</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-black font-sans pb-20">
      <div className="border-b border-gray-100 sticky top-0 bg-white/80 backdrop-blur-md z-40">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-8">
            <h2 className="text-lg font-black italic uppercase tracking-tighter">ITX <span className="text-blue-600">CMS</span></h2>
            <nav className="hidden md:flex space-x-6">
              <button 
                onClick={() => setActiveTab('orders')} 
                className={`text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === 'orders' ? 'text-blue-600 border-b-2 border-blue-600 pb-1' : 'text-gray-400 hover:text-black'}`}
              >
                Orders
              </button>
              <button 
                onClick={() => setActiveTab('products')} 
                className={`text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === 'products' ? 'text-blue-600 border-b-2 border-blue-600 pb-1' : 'text-gray-400 hover:text-black'}`}
              >
                Inventory
              </button>
              <button 
                onClick={() => setActiveTab('settings')} 
                className={`text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === 'settings' ? 'text-blue-600 border-b-2 border-blue-600 pb-1' : 'text-gray-400 hover:text-black'}`}
              >
                System
              </button>
            </nav>
          </div>
          <div className="flex items-center space-x-4">
             <button onClick={refreshData} className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-all">
                <i className="fas fa-sync-alt text-xs"></i>
             </button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        {activeTab === 'orders' && (
          <div className="animate-fadeIn">
            <div className="flex justify-between items-center mb-8">
              <h1 className="text-2xl font-bold uppercase tracking-tight italic">Order Stream</h1>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50 px-3 py-1 rounded-full border border-gray-100">
                Total Orders: {orders.length}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {orders.map((order) => (
                <div key={order.id} className="bg-white border border-gray-100 rounded-2xl p-6 hover:shadow-xl hover:shadow-gray-100/50 transition-all">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center space-x-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg ${
                        order.status === 'Delivered' ? 'bg-green-50 text-green-600' : 
                        order.status === 'Cancelled' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
                      }`}>
                        <i className={`fas ${
                          order.status === 'Delivered' ? 'fa-check-double' : 
                          order.status === 'Cancelled' ? 'fa-times' : 'fa-clock'
                        }`}></i>
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="text-sm font-bold uppercase text-black">#{order.id}</h4>
                          <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${
                            order.status === 'Delivered' ? 'bg-green-50 text-green-600' : 
                            order.status === 'Cancelled' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
                          }`}>
                            {order.status}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-gray-400 mt-1 uppercase tracking-tight">{order.customer.name} • {order.customer.city}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Amount</p>
                        <p className="text-sm font-black text-black">Rs. {order.total.toLocaleString()}</p>
                      </div>
                      <select 
                        value={order.status}
                        onChange={(e) => updateStatusOverride?.(order.id, e.target.value as Order['status'])}
                        className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-[10px] font-bold uppercase outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="Pending">Pending</option>
                        <option value="Confirmed">Confirmed</option>
                        <option value="Shipped">Shipped</option>
                        <option value="Delivered">Delivered</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="mt-6 pt-6 border-t border-gray-50 grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                      <h5 className="text-[9px] font-bold uppercase text-gray-400 mb-3 tracking-widest">Items</h5>
                      <div className="space-y-3">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex items-center space-x-3 bg-gray-50/50 p-2 rounded-lg">
                            <img src={item.product.image} className="w-8 h-8 rounded object-cover border" />
                            <span className="text-[10px] font-bold uppercase text-gray-700">{item.quantity}x {item.product.name} ({item.variantName})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h5 className="text-[9px] font-bold uppercase text-gray-400 mb-3 tracking-widest">Shipping Address</h5>
                      <p className="text-xs font-bold text-gray-600 leading-relaxed uppercase tracking-tight">{order.customer.address}, {order.customer.city}</p>
                      <p className="text-xs font-bold text-blue-600 mt-2"><i className="fas fa-phone mr-1"></i> {order.customer.phone}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'products' && (
          <div className="animate-fadeIn">
            <div className="flex justify-between items-center mb-8">
              <h1 className="text-2xl font-bold uppercase tracking-tight italic">Inventory</h1>
              <button 
                onClick={() => setIsAddingProduct(true)}
                className="bg-black text-white px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-blue-600 transition shadow-lg"
              >
                Add Product <i className="fas fa-plus ml-2"></i>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map(product => (
                <div key={product.id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden hover:shadow-xl transition-all group">
                  <div className="relative aspect-video">
                    <img src={product.image} className="w-full h-full object-cover" />
                    <div className="absolute top-4 right-4 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => {
                          if (window.confirm('Delete this product?')) {
                            deleteProduct(product.id);
                          }
                        }}
                        className="w-8 h-8 bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition"
                      >
                        <i className="fas fa-trash-alt text-[10px]"></i>
                      </button>
                    </div>
                  </div>
                  <div className="p-5">
                    <h4 className="text-sm font-bold uppercase text-black tracking-tight">{product.name}</h4>
                    <p className="text-[10px] font-bold text-gray-400 mt-1 uppercase">{product.category}</p>
                    <div className="flex justify-between items-center mt-6">
                      <p className="text-sm font-black text-blue-600">Rs. {product.price.toLocaleString()}</p>
                      <p className="text-[10px] font-bold text-gray-500 uppercase">Stock: {product.inventory}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="animate-fadeIn max-w-lg">
            <h1 className="text-2xl font-bold uppercase tracking-tight italic mb-8">System Settings</h1>
            <div className="bg-white border border-gray-100 rounded-2xl p-8 space-y-6">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Admin Access Key</label>
                <div className="flex space-x-2">
                  <input 
                    type="text" 
                    value={systemPassword}
                    onChange={(e) => setSystemPassword(e.target.value)}
                    className="flex-grow bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button 
                    onClick={() => {
                      localStorage.setItem('systemPassword', systemPassword);
                      alert('Access Key Updated');
                    }}
                    className="bg-black text-white px-6 py-3 rounded-xl font-bold uppercase text-[10px] tracking-widest hover:bg-blue-600 transition"
                  >
                    Save
                  </button>
                </div>
              </div>
              
              <div className="pt-6 border-t border-gray-50">
                <p className="text-[10px] font-bold uppercase text-gray-400 mb-4">Database Health</p>
                <div className="flex items-center space-x-3 text-green-500">
                  <i className="fas fa-check-circle"></i>
                  <span className="text-xs font-bold uppercase">Supabase Connected</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {isAddingProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md animate-slideInUp shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold uppercase italic tracking-tight">New Product</h2>
              <button onClick={() => setIsAddingProduct(false)} className="text-gray-400 hover:text-black">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <form onSubmit={handleAddProduct} className="space-y-4">
              <input required type="text" placeholder="Product Name" className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm font-bold" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} />
              <input required type="number" placeholder="Price (PKR)" className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm font-bold" value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: Number(e.target.value)})} />
              <input required type="text" placeholder="Image URL" className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm font-bold" value={newProduct.image} onChange={e => setNewProduct({...newProduct, image: e.target.value})} />
              <input required type="text" placeholder="Category" className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm font-bold" value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value})} />
              <textarea required placeholder="Description" className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm font-bold h-24 resize-none" value={newProduct.description} onChange={e => setNewProduct({...newProduct, description: e.target.value})} />
              <button type="submit" className="w-full bg-black text-white py-4 rounded-xl font-bold uppercase text-xs tracking-widest hover:bg-blue-600 transition shadow-lg">
                Finalize Product
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
