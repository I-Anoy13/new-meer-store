import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { UserRole } from '../types';

/*
 * ADMIN PANEL - STABLE BUILD VERSION
 * Strict ASCII-only, short-line, single-quote implementation.
 */

const AdminDashboard = (p: any) => {
  const [tab, setTab] = useState('orders');
  const [key, setKey] = useState('');
  const [isAdd, setIsAdd] = useState(false);
  const [msg, setMsg] = useState('');
  
  const [fName, setFName] = useState('');
  const [fPrice, setFPrice] = useState(0);
  const [fImg, setFImg] = useState('');

  useEffect(() => {
    if (!p.user) return;
    const c = supabase.channel('adm_sync');
    c.on('postgres_changes', { 
      event: 'INSERT', 
      schema: 'public', 
      table: 'orders' 
    }, (res) => {
      p.setOrders(res.new);
      setMsg('ORDER');
      setTimeout(() => setMsg(''), 3000);
    }).subscribe();
    return () => { supabase.removeChannel(c); };
  }, [p.user, p.setOrders]);

  if (!p.user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm border">
          <h1 className="text-lg font-black mb-6 text-center">CONSOLE</h1>
          <input 
            type="password" value={key}
            onChange={(e) => setKey(e.target.value)}
            className="w-full p-4 border rounded-xl mb-4 font-bold"
            placeholder="Access Key"
          />
          <button 
            onClick={() => {
              if (key === p.systemPassword) p.login(UserRole.ADMIN);
              else alert('Invalid');
            }}
            className="w-full bg-black text-white p-4 rounded-xl font-bold uppercase"
          >
            Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-black">
      {msg && (
        <div className="fixed top-4 right-4 bg-blue-600 text-white p-4 rounded-xl z-50">
          {msg}
        </div>
      )}

      <nav className="border-b h-16 flex items-center px-6 justify-between sticky top-0 bg-white z-40">
        <div className="flex space-x-6 text-[10px] font-black uppercase">
          <button onClick={() => setTab('orders')} className={tab === 'orders' ? 'text-blue-600' : 'text-gray-400'}>Orders</button>
          <button onClick={() => setTab('items')} className={tab === 'items' ? 'text-blue-600' : 'text-gray-400'}>Items</button>
          <button onClick={() => setTab('sys')} className={tab === 'sys' ? 'text-blue-600' : 'text-gray-400'}>System</button>
        </div>
        <button onClick={p.refreshData} className="text-gray-300">Sync</button>
      </nav>

      <main className="p-6">
        {tab === 'orders' && (
          <div className="space-y-2">
            {p.orders.map((o: any) => (
              <div key={o.id} className="border p-4 rounded-xl flex justify-between items-center">
                <div>
                  <p className="font-bold">#{o.id}</p>
                  <p className="text-[10px] uppercase text-gray-400">{o.customer.name}</p>
                </div>
                <select 
                  value={o.status} 
                  onChange={e => p.updateStatusOverride?.(o.id, e.target.value as any)}
                  className="border p-2 rounded text-[10px] font-bold"
                >
                  <option value="Pending">Pending</option>
                  <option value="Shipped">Shipped</option>
                  <option value="Delivered">Delivered</option>
                </select>
              </div>
            ))}
          </div>
        )}

        {tab === 'items' && (
          <div>
            <button onClick={() => setIsAdd(true)} className="bg-black text-white px-4 py-2 rounded mb-4 text-[10px]">ADD PRODUCT</button>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {p.products.map((itm: any) => (
                <div key={itm.id} className="border p-2 rounded-xl">
                  <img src={itm.image} className="w-full aspect-video object-cover rounded mb-2" alt="" />
                  <p className="text-[9px] font-bold truncate">{itm.name}</p>
                  <button onClick={() => p.deleteProduct(itm.id)} className="text-red-500 text-[9px] font-bold mt-1">DELETE</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'sys' && (
          <div className="max-w-xs">
            <p className="text-[10px] font-bold text-gray-400 mb-2">MASTER KEY</p>
            <input 
              value={p.systemPassword} 
              onChange={e => p.setSystemPassword(e.target.value)} 
              className="border p-3 rounded-xl w-full text-sm font-bold" 
            />
          </div>
        )}
      </main>

      {isAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-2xl w-full max-w-sm">
            <h3 className="font-bold mb-4">NEW ITEM</h3>
            <input className="w-full border p-3 rounded-xl mb-2" placeholder="Title" value={fName} onChange={e => setFName(e.target.value)} />
            <input className="w-full border p-3 rounded-xl mb-2" placeholder="Price" type="number" value={fPrice} onChange={e => setFPrice(Number(e.target.value))} />
            <input className="w-full border p-3 rounded-xl mb-4" placeholder="Image URL" value={fImg} onChange={e => setFImg(e.target.value)} />
            <button 
              className="w-full bg-black text-white p-3 rounded-xl font-bold"
              onClick={async () => {
                if(!fName || !fPrice || !fImg) return;
                await supabase.from('products').insert([{
                  name: fName, price_pkr: fPrice, image: fImg, 
                  description: fName, category: 'Luxury', inventory: 10
                }]);
                p.refreshData(); setIsAdd(false);
              }}
            >
              SAVE
            </button>
            <button className="w-full mt-2 text-gray-400 text-sm" onClick={() => setIsAdd(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;