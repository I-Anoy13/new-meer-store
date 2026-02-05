import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { UserRole } from '../types';

/*
 * ADMIN DASHBOARD - REAL-TIME NOTIFICATION ENGINE
 * Optimized for instant alerts and build stability.
 */

const AdminDashboard = (props: any) => {
  const [tab, setTab] = useState('orders');
  const [key, setKey] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  
  // Notification States
  const [newOrderAlert, setNewOrderAlert] = useState<any>(null);
  const [isMuted, setIsMuted] = useState(false);

  const [n, setN] = useState('');
  const [p, setP] = useState(0);
  const [u, setU] = useState('');

  // Built-in Audio Ping (Web Audio API)
  const playPing = useCallback(() => {
    if (isMuted) return;
    try {
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.5);
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch (e) {
      console.error('Audio fail', e);
    }
  }, [isMuted]);

  // Request Notification Permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Real-time listener
  useEffect(() => {
    if (!props.user) return;
    
    const channel = supabase.channel('realtime_orders');
    channel.on('postgres_changes', 
      { event: 'INSERT', schema: 'public', table: 'orders' }, 
      (payload) => {
        const order = payload.new;
        // 1. Update UI List
        props.setOrders(order);
        
        // 2. Set Visual Bar
        setNewOrderAlert(order);
        
        // 3. Play Sound
        playPing();
        
        // 4. Browser Notification
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('NEW ORDER: ' + order.customer_name, {
            body: 'Amount: Rs. ' + (order.total_pkr || order.total),
            icon: 'https://images.unsplash.com/photo-1614164185128-e4ec99c436d7?w=128'
          });
        }

        // Auto-clear visual bar after 10 seconds
        setTimeout(() => setNewOrderAlert(null), 10000);
      }
    ).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [props.user, props.setOrders, playPing]);

  if (!props.user) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white p-10 rounded-[2rem] shadow-2xl w-full max-w-sm border border-gray-100">
          <h1 className="text-xl font-black mb-8 text-center uppercase tracking-tighter">Admin Console</h1>
          <input 
            type="password" 
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Security Key"
            className="w-full p-4 border rounded-2xl mb-6 font-bold text-center bg-gray-50"
          />
          <button 
            onClick={() => {
              if (key === props.systemPassword) props.login(UserRole.ADMIN);
              else window.alert('Access Denied');
            }}
            className="w-full bg-black text-white p-5 rounded-2xl font-black uppercase text-xs tracking-widest"
          >
            Authenticate
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fcfcfc] text-black font-sans">
      {/* INSTANT NOTIFICATION BAR */}
      {newOrderAlert && (
        <div className="fixed top-0 left-0 right-0 z-[100] animate-slideInTop">
          <div className="bg-blue-600 text-white p-4 shadow-2xl flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center animate-pulse">
                <i className="fas fa-shopping-cart"></i>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest opacity-80">New Order Detected</p>
                <p className="font-bold text-sm">#{newOrderAlert.order_id} — {newOrderAlert.customer_name}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="font-black text-sm px-3 py-1 bg-white/20 rounded-lg">
                Rs. {newOrderAlert.total_pkr || newOrderAlert.total}
              </span>
              <button 
                onClick={() => setNewOrderAlert(null)}
                className="w-8 h-8 flex items-center justify-center hover:bg-white/20 rounded-full transition"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
          </div>
          <div className="h-1 bg-white/30 w-full overflow-hidden">
            <div className="h-full bg-white animate-progress"></div>
          </div>
        </div>
      )}

      <header className="border-b h-16 flex items-center px-6 justify-between bg-white/80 backdrop-blur sticky top-0 z-40">
        <div className="flex items-center space-x-8">
          <div className="flex space-x-6 text-[10px] font-black uppercase">
            <button onClick={() => setTab('orders')} className={tab === 'orders' ? 'text-blue-600' : 'text-gray-400'}>Orders</button>
            <button onClick={() => setTab('items')} className={tab === 'items' ? 'text-blue-600' : 'text-gray-400'}>Inventory</button>
            <button onClick={() => setTab('sys')} className={tab === 'sys' ? 'text-blue-600' : 'text-gray-400'}>System</button>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => setIsMuted(!isMuted)} 
            className={`w-8 h-8 rounded-full border flex items-center justify-center transition ${isMuted ? 'bg-red-50 text-red-500 border-red-100' : 'text-gray-300'}`}
          >
            <i className={isMuted ? 'fas fa-volume-mute text-xs' : 'fas fa-volume-up text-xs'}></i>
          </button>
          <button onClick={props.refreshData} className="text-gray-300 hover:text-black transition uppercase text-[10px] font-black">
            <i className="fas fa-sync-alt"></i>
          </button>
        </div>
      </header>

      <main className="container mx-auto p-6 max-w-5xl">
        {tab === 'orders' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xs font-black uppercase tracking-widest text-gray-400">Order Management</h2>
              <span className="text-[10px] font-bold bg-gray-100 px-3 py-1 rounded-full">{props.orders.length} TOTAL</span>
            </div>
            {props.orders.map((o: any) => (
              <div key={o.id} className="bg-white border p-6 rounded-3xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-blue-600 font-black text-xs">
                    {String(o.status).charAt(0)}
                  </div>
                  <div>
                    <p className="font-black text-sm tracking-tight">#{o.id}</p>
                    <p className="text-[10px] uppercase text-gray-400 font-bold mt-1">{o.customer.name} — {o.customer.city}</p>
                    <p className="text-[9px] text-blue-600 font-bold mt-1 uppercase tracking-widest italic">{o.customer.phone}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-6 w-full md:w-auto justify-between border-t md:border-t-0 pt-4 md:pt-0">
                  <span className="font-black text-lg">Rs. {o.total}</span>
                  <select 
                    value={o.status} 
                    onChange={e => props.updateStatusOverride?.(o.id, e.target.value as any)}
                    className="border p-3 rounded-2xl text-[10px] font-black uppercase bg-gray-50 outline-none focus:ring-2 ring-blue-100"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Shipped">Shipped</option>
                    <option value="Delivered">Delivered</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'items' && (
          <div>
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-xs font-black uppercase tracking-widest text-gray-400">Product Catalog</h2>
              <button 
                onClick={() => setIsAddOpen(true)} 
                className="bg-black text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-black/10"
              >
                + New Product
              </button>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              {props.products.map((itm: any) => (
                <div key={itm.id} className="bg-white border p-4 rounded-3xl group relative shadow-sm">
                  <div className="aspect-square relative mb-4 overflow-hidden rounded-2xl">
                    <img src={itm.image} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" alt="" />
                    <button 
                      onClick={() => props.deleteProduct(itm.id)} 
                      className="absolute top-2 right-2 bg-red-600 text-white w-8 h-8 rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition"
                    >
                      <i className="fas fa-trash text-[10px]"></i>
                    </button>
                  </div>
                  <p className="text-[11px] font-black truncate uppercase tracking-tight mb-1">{itm.name}</p>
                  <p className="text-[11px] font-black text-blue-600">Rs. {itm.price}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'sys' && (
          <div className="max-w-md bg-white border p-8 rounded-[2.5rem] shadow-sm">
            <p className="text-[10px] font-black text-gray-400 mb-6 uppercase tracking-[0.2em]">Security Configuration</p>
            <div className="space-y-6">
              <div>
                <label className="block text-[9px] font-bold uppercase text-gray-400 mb-2 italic">Master Password</label>
                <div className="flex gap-3">
                  <input 
                    value={props.systemPassword} 
                    onChange={e => props.setSystemPassword(e.target.value)} 
                    className="border p-4 rounded-2xl w-full text-sm font-bold bg-gray-50 focus:outline-none focus:ring-2 ring-blue-100" 
                  />
                  <button 
                    onClick={() => { localStorage.setItem('systemPassword', props.systemPassword); window.alert('Settings Updated'); }}
                    className="bg-black text-white px-8 rounded-2xl text-[10px] font-black uppercase"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {isAddOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 z-50">
          <div className="bg-white p-10 rounded-[3rem] w-full max-w-sm shadow-2xl relative animate-fadeIn">
            <button onClick={() => setIsAddOpen(false)} className="absolute top-8 right-8 text-gray-300 hover:text-black">
              <i className="fas fa-times text-xl"></i>
            </button>
            <h2 className="font-black text-xl mb-8 uppercase tracking-tighter italic">Add to Inventory</h2>
            <div className="space-y-4">
              <input className="w-full border p-4 rounded-2xl text-xs font-bold bg-gray-50" placeholder="Product Name" value={n} onChange={e => setN(e.target.value)} />
              <input className="w-full border p-4 rounded-2xl text-xs font-bold bg-gray-50" placeholder="Price (PKR)" type="number" value={p} onChange={e => setP(Number(e.target.value))} />
              <input className="w-full border p-4 rounded-2xl text-xs font-bold bg-gray-50" placeholder="Image URL" value={u} onChange={e => setU(e.target.value)} />
              <button 
                className="w-full bg-black text-white p-5 rounded-2xl font-black text-xs uppercase tracking-widest mt-6 shadow-xl shadow-black/20"
                onClick={async () => {
                  if(!n || !p || !u) return window.alert('Fill all fields');
                  await supabase.from('products').insert([{ name: n, price_pkr: p, image: u, description: n, category: 'Luxury', inventory: 10 }]);
                  props.refreshData(); setIsAddOpen(false); setN(''); setP(0); setU('');
                }}
              >
                Publish Product
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
