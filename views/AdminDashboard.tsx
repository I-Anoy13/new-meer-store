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

const AdminDashboard: React.FC<AdminDashboardProps> = (props) => {
  const [tab, setTab] = useState<'orders' | 'products' | 'settings'>('orders');
  const [pin, setPin] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [alerts, setAlerts] = useState<{id: string, msg: string}[]>([]);
  const [form, setForm] = useState<Partial<Product>>({
    name: '',
    price: 0,
    description: '',
    image: '',
    category: 'Luxury',
    inventory: 10
  });

  const notify = useCallback(() => {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  }, []);

  const pushAlert = useCallback((m: string) => {
    const id = Math.random().toString();
    setAlerts(curr => [...curr, { id, msg: m }]);
    setTimeout(() => {
      setAlerts(curr => curr.filter(a => a.id !== id));
    }, 3000);
  }, []);

  useEffect(() => {
    if (!props.user) return;
    const chan = supabase.channel('stream')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'orders' }, 
        (p) => {
          props.setOrders(p.new);
          pushAlert('Order: ' + (p.new.customer_name || 'New'));
          notify();
        }
      ).subscribe();
    return () => { supabase.removeChannel(chan); };
  }, [props.user, props.setOrders, notify, pushAlert]);

  if (!props.user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-10 rounded-3xl shadow-xl border w-full max-w-sm">
          <h1 className="text-xl font-black mb-6 text-center">ADMIN CONSOLE</h1>
          <input 
            type="password" 
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="Access Key"
            className="w-full p-4 bg-gray-50 border rounded-xl mb-4 font-bold"
          />
          <button 
            onClick={() => pin === props.systemPassword ? props.login(UserRole.ADMIN) : alert('Fail')}
            className="w-full bg-black text-white p-4 rounded-xl font-bold"
          >
            LOGIN
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-black font-sans">
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {alerts.map(a => (
          <div key={a.id} className="bg-black text-white p-4 rounded-xl shadow-2xl text-[10px] font-bold">
            {a.msg}
          </div>
        ))}
      </div>

      <header className="border-b sticky top-0 bg-white/90 backdrop-blur z-40">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex space-x-6">
            <button onClick={() => setTab('orders')} className={tab === 'orders' ? 'text-blue-600 font-bold' : 'text-gray-400'}>ORDERS</button>
            <button onClick={() => setTab('products')} className={tab === 'products' ? 'text-blue-600 font-bold' : 'text-gray-400'}>ITEMS</button>
            <button onClick={() => setTab('settings')} className={tab === 'settings' ? 'text-blue-600 font-bold' : 'text-gray-400'}>SYSTEM</button>
          </div>
          <button onClick={props.refreshData} className="text-gray-400"><i className="fas fa-sync"></i></button>
        </div>
      </header>

      <main className="container mx-auto px-6 py-10">
        {tab === 'orders' && (
          <div className="space-y-4">
            {props.orders.map(o => (
              <div key={o.id} className="border p-6 rounded-2xl flex justify-between items-center">
                <div>
                  <p className="font-bold">#{o.id} - {o.customer.name}</p>
                  <p className="text-xs text-gray-400">{o.customer.phone} - {o.customer.city}</p>
                </div>
                <div className="flex items-center space-x-4">
                  <p className="font-black">Rs. {o.total}</p>
                  <select 
                    value={o.status} 
                    onChange={e => props.updateStatusOverride?.(o.id, e.target.value as any)}
                    className="border p-2 rounded-lg text-xs font-bold"
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

        {tab === 'products' && (
          <div>
            <button onClick={() => setShowAdd(true)} className="bg-black text-white p-4 rounded-xl mb-8 font-bold text-xs">ADD NEW PRODUCT</button>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {props.products.map(p => (
                <div key={p.id} className="border rounded-2xl overflow-hidden">
                  <img src={p.image} className="w-full aspect-video object-cover" alt="" />
                  <div className="p-4 flex justify-between">
                    <div><p className="font-bold text-sm">{p.name}</p><p className="text-xs text-blue-600">Rs. {p.price}</p></div>
                    <button onClick={() => props.deleteProduct(p.id)} className="text-red-500"><i className="fas fa-trash"></i></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'settings' && (
          <div className="max-w-sm">
            <label className="text-[10px] font-bold text-gray-400">ACCESS KEY</label>
            <div className="flex mt-2">
              <input 
                type="text" 
                value={props.systemPassword} 
                onChange={e => props.setSystemPassword(e.target.value)} 
                className="border p-4 rounded-l-xl w-full font-bold" 
              />
              <button onClick={() => localStorage.setItem('systemPassword', props.systemPassword)} className="bg-black text-white px-6 rounded-r-xl font-bold text-xs">SAVE</button>
            </div>
          </div>
        )}
      </main>

      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-6 z-50">
          <div className="bg-white p-8 rounded-3xl w-full max-w-md">
            <h2 className="font-bold mb-6">NEW PRODUCT</h2>
            <div className="space-y-4">
              <input className="w-full border p-3 rounded-xl" placeholder="Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
              <input className="w-full border p-3 rounded-xl" placeholder="Price" type="number" value={form.price} onChange={e => setForm({...form, price: Number(e.target.value)})} />
              <input className="w-full border p-3 rounded-xl" placeholder="Image URL" value={form.image} onChange={e => setForm({...form, image: e.target.value})} />
              <button 
                className="w-full bg-black text-white p-4 rounded-xl font-bold"
                onClick={async () => {
                  await supabase.from('products').insert([{
                    name: form.name, 
                    price_pkr: form.price, 
                    image: form.image, 
                    description: form.name, 
                    category: 'Luxury', 
                    inventory: 10
                  }]);
                  props.refreshData();
                  setShowAdd(false);
                }}
              >
                SAVE PRODUCT
              </button>
              <button className="w-full text-gray-400 font-bold" onClick={() => setShowAdd(false)}>CANCEL</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
