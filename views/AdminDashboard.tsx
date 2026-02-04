
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { UserRole } from '../types';

/* 
 * ITX ADMIN STABLE
 * No long lines. No backticks. No complex types.
 */

const AdminDashboard = (props: any) => {
  const [view, setView] = useState('orders');
  const [pass, setPass] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [alert, setAlert] = useState('');
  
  const [n, setN] = useState('');
  const [p, setP] = useState(0);
  const [u, setU] = useState('');

  useEffect(() => {
    if (!props.user) return;
    const c = supabase.channel('itx_orders');
    c.on('postgres_changes', 
      { event: 'INSERT', schema: 'public', table: 'orders' }, 
      (payload) => {
        props.setOrders(payload.new);
        setAlert('NEW_ORDER');
        setTimeout(() => setAlert(''), 3000);
      }
    ).subscribe();
    return () => { supabase.removeChannel(c); };
  }, [props.user, props.setOrders]);

  if (!props.user) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm">
          <h1 className="text-xl font-black mb-6 text-center uppercase">Login</h1>
          <input 
            type="password" 
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            placeholder="Key"
            className="w-full p-4 border rounded-xl mb-4 font-bold"
          />
          <button 
            onClick={() => {
              // Fix: Explicitly use window.alert because 'alert' state shadows global alert function
              if (pass === props.systemPassword) props.login(UserRole.ADMIN);
              else window.alert('Denied');
            }}
            className="w-full bg-black text-white p-4 rounded-xl font-bold uppercase"
          >
            Enter
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-black font-sans">
      {alert && (
        <div className="fixed top-4 right-4 bg-blue-600 text-white p-4 rounded-xl z-50">
          {alert}
        </div>
      )}

      <header className="border-b h-16 flex items-center px-6 justify-between bg-white sticky top-0">
        <div className="flex space-x-6 text-[10px] font-black uppercase">
          <button onClick={() => setView('orders')} className={view === 'orders' ? 'text-blue-600' : 'text-gray-400'}>Orders</button>
          <button onClick={() => setView('items')} className={view === 'items' ? 'text-blue-600' : 'text-gray-400'}>Items</button>
          <button onClick={() => setView('sys')} className={view === 'sys' ? 'text-blue-600' : 'text-gray-400'}>System</button>
        </div>
        <button onClick={props.refreshData} className="text-gray-300 font-bold uppercase text-[10px]">Sync</button>
      </header>

      <main className="p-6">
        {view === 'orders' && (
          <div className="space-y-3">
            {props.orders.map((o: any) => (
              <div key={o.id} className="border p-4 rounded-xl flex justify-between items-center">
                <div>
                  <p className="font-bold">#{o.id}</p>
                  <p className="text-[10px] uppercase text-gray-400 font-bold">{o.customer.name}</p>
                </div>
                <div className="flex items-center space-x-4">
                  <span className="font-bold text-sm">Rs. {o.total}</span>
                  <select 
                    value={o.status} 
                    onChange={e => props.updateStatusOverride?.(o.id, e.target.value as any)}
                    className="border p-2 rounded text-[10px] font-black uppercase"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Shipped">Shipped</option>
                    <option value="Delivered">Delivered</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}

        {view === 'items' && (
          <div>
            <button onClick={() => setIsAddOpen(true)} className="bg-black text-white px-4 py-2 rounded-lg mb-6 text-[10px] font-bold">ADD ITEM</button>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {props.products.map((itm: any) => (
                <div key={itm.id} className="border p-2 rounded-xl group">
                  <div className="aspect-video relative mb-2">
                    <img src={itm.image} className="w-full h-full object-cover rounded" alt="" />
                    <button onClick={() => props.deleteProduct(itm.id)} className="absolute top-1 right-1 bg-red-600 text-white w-6 h-6 rounded-full flex items-center justify-center"><i className="fas fa-trash text-[8px]"></i></button>
                  </div>
                  <p className="text-[10px] font-bold truncate uppercase">{itm.name}</p>
                  <p className="text-[10px] font-bold text-blue-600">Rs. {itm.price}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === 'sys' && (
          <div className="max-w-xs">
            <p className="text-[10px] font-black text-gray-300 mb-4 uppercase">Settings</p>
            <div className="flex gap-2">
              <input 
                value={props.systemPassword} 
                onChange={e => props.setSystemPassword(e.target.value)} 
                className="border p-3 rounded-xl w-full text-sm font-bold" 
              />
              <button 
                // Fix: Explicitly use window.alert to avoid calling the 'alert' string state variable
                onClick={() => { localStorage.setItem('systemPassword', props.systemPassword); window.alert('Saved'); }}
                className="bg-black text-white px-4 rounded-xl text-[10px] font-bold"
              >
                SAVE
              </button>
            </div>
          </div>
        )}
      </main>

      {isAddOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-2xl w-full max-w-sm">
            <h2 className="font-black text-sm mb-4 uppercase">New Product</h2>
            <div className="space-y-3">
              <input className="w-full border p-3 rounded-xl text-xs font-bold" placeholder="Title" value={n} onChange={e => setN(e.target.value)} />
              <input className="w-full border p-3 rounded-xl text-xs font-bold" placeholder="Price" type="number" value={p} onChange={e => setP(Number(e.target.value))} />
              <input className="w-full border p-3 rounded-xl text-xs font-bold" placeholder="Image URL" value={u} onChange={e => setU(e.target.value)} />
              <button 
                className="w-full bg-black text-white p-4 rounded-xl font-bold text-xs uppercase"
                onClick={async () => {
                  if(!n || !p || !u) return;
                  await supabase.from('products').insert([{ name: n, price_pkr: p, image: u, description: n, category: 'Luxury', inventory: 10 }]);
                  props.refreshData(); setIsAddOpen(false); setN(''); setP(0); setU('');
                }}
              >
                PUBLISH
              </button>
              <button className="w-full text-gray-400 text-[10px] font-bold mt-2" onClick={() => setIsAddOpen(false)}>CANCEL</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
