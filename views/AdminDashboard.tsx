import React, { useState, useEffect, useCallback } from 'react';
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

const AdminDashboard: React.FC<AdminDashboardProps> = (p) => {
  const [active, setActive] = useState('orders');
  const [pass, setPass] = useState('');
  const [addMode, setAddMode] = useState(false);
  const [toast, setToast] = useState('');
  
  const [n, setN] = useState('');
  const [pr, setPr] = useState(0);
  const [img, setImg] = useState('');

  const chime = useCallback(() => {
    try {
      const Win = window as any;
      const Ctx = Win.AudioContext || Win.webkitAudioContext;
      if (!Ctx) return;
      const c = new Ctx();
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(880, c.currentTime);
      g.gain.setValueAtTime(0, c.currentTime);
      g.gain.linearRampToValueAtTime(0.1, c.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.5);
      o.connect(g);
      g.connect(c.destination);
      o.start();
      o.stop(c.currentTime + 0.5);
    } catch (err) {}
  }, []);

  useEffect(() => {
    if (!p.user) return;
    const sub = supabase.channel('adm_stream')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'orders' 
      }, (payload) => {
        p.setOrders(payload.new);
        setToast('NEW ORDER DETECTED');
        chime();
        setTimeout(() => setToast(''), 3000);
      }).subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [p.user, p.setOrders, chime]);

  if (!p.user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm border">
          <h1 className="text-xl font-black mb-6 text-center tracking-tighter">
            ITX ADMIN
          </h1>
          <input 
            type="password" 
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            placeholder="System Key"
            className="w-full p-4 bg-gray-50 border rounded-xl mb-4 font-bold"
          />
          <button 
            onClick={() => pass === p.systemPassword ? p.login(UserRole.ADMIN) : alert('ERR')}
            className="w-full bg-black text-white p-4 rounded-xl font-bold uppercase text-xs"
          >
            Authenticate
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-black font-sans">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-blue-600 text-white p-4 rounded-xl shadow-2xl font-black text-[10px] animate-bounce">
          {toast}
        </div>
      )}

      <nav className="border-b sticky top-0 bg-white/90 backdrop-blur z-40">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex space-x-8">
            <button onClick={() => setActive('orders')} className={active === 'orders' ? 'text-blue-600 font-bold' : 'text-gray-400 font-bold'}>ORDERS</button>
            <button onClick={() => setActive('items')} className={active === 'items' ? 'text-blue-600 font-bold' : 'text-gray-400 font-bold'}>ITEMS</button>
            <button onClick={() => setActive('sys')} className={active === 'sys' ? 'text-blue-600 font-bold' : 'text-gray-400 font-bold'}>SYSTEM</button>
          </div>
          <button onClick={p.refreshData} className="text-gray-300"><i className="fas fa-sync"></i></button>
        </div>
      </nav>

      <main className="container mx-auto px-6 py-10">
        {active === 'orders' && (
          <div className="space-y-4">
            {p.orders.map(o => (
              <div key={o.id} className="border p-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-black">#{o.id}</span>
                    <span className="text-[10px] bg-gray-100 px-2 py-0.5 rounded font-bold">{o.status}</span>
                  </div>
                  <p className="text-xs text-gray-500 font-bold uppercase mt-1">{o.customer.name} - {o.customer.city}</p>
                  <p className="text-[10px] text-blue-600 font-bold mt-1">{o.customer.phone}</p>
                </div>
                <div className="flex items-center space-x-4 w-full md:w-auto justify-between">
                  <span className="font-black text-lg">Rs. {o.total}</span>
                  <select 
                    value={o.status} 
                    onChange={e => p.updateStatusOverride?.(o.id, e.target.value as any)}
                    className="border p-2 rounded-lg text-[10px] font-bold uppercase"
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

        {active === 'items' && (
          <div>
            <button onClick={() => setAddMode(true)} className="bg-black text-white px-6 py-3 rounded-xl mb-8 font-bold text-[10px]">NEW PRODUCT</button>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {p.products.map(itm => (
                <div key={itm.id} className="border rounded-2xl overflow-hidden group">
                  <div className="aspect-video relative">
                    <img src={itm.image} className="w-full h-full object-cover" alt="" />
                    <button onClick={() => p.deleteProduct(itm.id)} className="absolute top-2 right-2 w-8 h-8 bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg"><i className="fas fa-trash text-[10px]"></i></button>
                  </div>
                  <div className="p-4">
                    <p className="font-bold text-sm uppercase">{itm.name}</p>
                    <p className="text-blue-600 font-black text-sm mt-1">Rs. {itm.price}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {active === 'sys' && (
          <div className="max-w-sm">
            <h2 className="text-xs font-bold text-gray-400 mb-4">SECURITY CONFIG</h2>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={p.systemPassword} 
                onChange={e => p.setSystemPassword(e.target.value)} 
                className="border p-4 rounded-xl w-full font-bold text-sm" 
              />
              <button 
                onClick={() => {
                  localStorage.setItem('systemPassword', p.systemPassword);
                  setToast('SAVED');
                  setTimeout(() => setToast(''), 2000);
                }} 
                className="bg-black text-white px-6 rounded-xl font-bold text-[10px]"
              >
                SAVE
              </button>
            </div>
          </div>
        )}
      </main>

      {addMode && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-6 z-50 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-3xl w-full max-w-md shadow-2xl">
            <h2 className="font-black text-lg mb-6 tracking-tight">NEW ITEM</h2>
            <div className="space-y-4">
              <input className="w-full border p-4 rounded-xl text-sm font-bold" placeholder="Name" value={n} onChange={e => setN(e.target.value)} />
              <input className="w-full border p-4 rounded-xl text-sm font-bold" placeholder="Price" type="number" value={pr} onChange={e => setPr(Number(e.target.value))} />
              <input className="w-full border p-4 rounded-xl text-sm font-bold" placeholder="Img URL" value={img} onChange={e => setImg(e.target.value)} />
              <button 
                className="w-full bg-black text-white p-4 rounded-xl font-bold text-xs mt-4"
                onClick={async () => {
                  if (!n || !pr || !img) return alert('Fill all');
                  await supabase.from('products').insert([{
                    name: n, 
                    price_pkr: pr, 
                    image: img, 
                    description: n, 
                    category: 'Luxury', 
                    inventory: 10
                  }]);
                  p.refreshData();
                  setAddMode(false);
                  setN(''); setPr(0); setImg('');
                }}
              >
                PUBLISH
              </button>
              <button className="w-full text-gray-400 font-bold text-[10px]" onClick={() => setAddMode(false)}>CLOSE</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
