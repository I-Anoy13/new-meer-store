import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { UserRole } from '../types';

/* 
 * ADMIN DASHBOARD - STABLE BUILD VERSION 
 * Optimized to prevent TS1002 Unterminated String errors.
 */

const AdminDashboard = (props: any) => {
  const [activeTab, setActiveTab] = useState('orders');
  const [authKey, setAuthKey] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  
  const [formName, setFormName] = useState('');
  const [formPrice, setFormPrice] = useState(0);
  const [formImg, setFormImg] = useState('');

  useEffect(() => {
    if (!props.user) return;
    const channel = supabase.channel('order_sync')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'orders' 
      }, (payload) => {
        props.setOrders(payload.new);
        setStatusMsg('NEW ORDER RECEIVED');
        setTimeout(() => setStatusMsg(''), 4000);
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [props.user, props.setOrders]);

  if (!props.user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white p-10 rounded-3xl shadow-2xl w-full max-w-sm border">
          <h1 className="text-xl font-black mb-8 text-center uppercase">System Login</h1>
          <input 
            type="password" 
            value={authKey}
            onChange={(e) => setAuthKey(e.target.value)}
            className="w-full p-4 bg-gray-50 border rounded-2xl mb-6 font-bold"
            placeholder="Access Key"
          />
          <button 
            onClick={() => {
              if (authKey === props.systemPassword) {
                props.login(UserRole.ADMIN);
              } else {
                alert('Access Denied');
              }
            }}
            className="w-full bg-black text-white p-4 rounded-2xl font-bold text-xs uppercase"
          >
            Authenticate
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-black font-sans">
      {statusMsg && (
        <div className="fixed top-6 right-6 bg-blue-600 text-white px-6 py-4 rounded-2xl shadow-2xl z-50 font-black text-[10px] animate-bounce">
          {statusMsg}
        </div>
      )}

      <nav className="border-b sticky top-0 bg-white/90 backdrop-blur z-40">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex space-x-8 text-[10px] font-black uppercase">
            <button 
              onClick={() => setActiveTab('orders')} 
              className={activeTab === 'orders' ? 'text-blue-600' : 'text-gray-400'}
            >
              Orders
            </button>
            <button 
              onClick={() => setActiveTab('items')} 
              className={activeTab === 'items' ? 'text-blue-600' : 'text-gray-400'}
            >
              Inventory
            </button>
            <button 
              onClick={() => setActiveTab('sys')} 
              className={activeTab === 'sys' ? 'text-blue-600' : 'text-gray-400'}
            >
              System
            </button>
          </div>
          <button onClick={props.refreshData} className="text-gray-300">
            <i className="fas fa-sync-alt"></i>
          </button>
        </div>
      </nav>

      <main className="container mx-auto px-6 py-10">
        {activeTab === 'orders' && (
          <div className="space-y-4">
            {props.orders.length === 0 ? (
              <p className="text-center py-20 text-gray-300 font-bold uppercase text-xs">No orders yet</p>
            ) : props.orders.map((o: any) => (
              <div key={o.id} className="border p-6 rounded-3xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                  <div className="flex items-center space-x-3 mb-2">
                    <span className="font-black text-sm">#{o.id}</span>
                    <span className="text-[9px] bg-gray-100 px-2 py-0.5 rounded-full font-bold uppercase">{o.status}</span>
                  </div>
                  <p className="text-xs font-bold uppercase text-gray-400">{o.customer.name} — {o.customer.city}</p>
                </div>
                <div className="flex items-center space-x-6 w-full md:w-auto justify-between">
                  <span className="font-black text-lg">Rs. {o.total}</span>
                  <select 
                    value={o.status} 
                    onChange={e => props.updateStatusOverride?.(o.id, e.target.value as any)}
                    className="border p-3 rounded-xl text-[10px] font-bold uppercase bg-gray-50"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Confirmed">Confirmed</option>
                    <option value="Shipped">Shipped</option>
                    <option value="Delivered">Delivered</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'items' && (
          <div>
            <button 
              onClick={() => setIsAdding(true)} 
              className="bg-black text-white px-8 py-4 rounded-2xl mb-10 font-bold text-[10px] uppercase tracking-widest"
            >
              New Product
            </button>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {props.products.map((itm: any) => (
                <div key={itm.id} className="border rounded-3xl overflow-hidden group">
                  <div className="aspect-video relative">
                    <img src={itm.image} className="w-full h-full object-cover" alt="" />
                    <button 
                      onClick={() => props.deleteProduct(itm.id)} 
                      className="absolute top-4 right-4 w-10 h-10 bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg"
                    >
                      <i className="fas fa-trash-alt text-xs"></i>
                    </button>
                  </div>
                  <div className="p-6">
                    <p className="font-black text-sm uppercase mb-1">{itm.name}</p>
                    <p className="text-blue-600 font-black text-sm">Rs. {itm.price}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'sys' && (
          <div className="max-w-md bg-gray-50 p-8 rounded-3xl border">
            <h2 className="text-[10px] font-black text-gray-400 uppercase mb-6">Security Settings</h2>
            <div className="flex gap-4">
              <input 
                type="text" 
                value={props.systemPassword} 
                onChange={e => props.setSystemPassword(e.target.value)} 
                className="border p-4 rounded-2xl w-full font-bold text-sm"
              />
              <button 
                onClick={() => {
                  localStorage.setItem('systemPassword', props.systemPassword);
                  alert('System Key Updated');
                }} 
                className="bg-black text-white px-8 rounded-2xl font-bold text-[10px] uppercase"
              >
                Save
              </button>
            </div>
          </div>
        )}
      </main>

      {isAdding && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-6 z-[100] backdrop-blur-sm">
          <div className="bg-white p-10 rounded-[2.5rem] w-full max-w-md shadow-2xl relative">
            <button onClick={() => setIsAdding(false)} className="absolute top-8 right-8 text-gray-300 hover:text-black">
              <i className="fas fa-times text-xl"></i>
            </button>
            <h2 className="font-black text-xl mb-8 uppercase italic">Create Product</h2>
            <div className="space-y-4">
              <input className="w-full border p-4 rounded-2xl text-sm font-bold bg-gray-50" placeholder="Product Title" value={formName} onChange={e => setFormName(e.target.value)} />
              <input className="w-full border p-4 rounded-2xl text-sm font-bold bg-gray-50" placeholder="Price (PKR)" type="number" value={formPrice} onChange={e => setFormPrice(Number(e.target.value))} />
              <input className="w-full border p-4 rounded-2xl text-sm font-bold bg-gray-50" placeholder="Image URL" value={formImg} onChange={e => setFormImg(e.target.value)} />
              <button 
                className="w-full bg-black text-white p-5 rounded-2xl font-black text-xs uppercase tracking-widest mt-4 shadow-xl"
                onClick={async () => {
                  if (!formName || !formPrice || !formImg) return alert('All fields required');
                  await supabase.from('products').insert([{
                    name: formName, 
                    price_pkr: formPrice, 
                    image: formImg, 
                    description: formName, 
                    category: 'Luxury', 
                    inventory: 10
                  }]);
                  props.refreshData();
                  setIsAdding(false);
                  setFormName(''); setFormPrice(0); setFormImg('');
                }}
              >
                Deploy Item
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;