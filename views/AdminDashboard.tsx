import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { UserRole, Order } from '../types';

/*
 * ADMIN DASHBOARD - FULL FUNCTIONAL + REAL-TIME NOTIFICATIONS
 * Features: Inventory CRUD, Order Status, Stats, Audio/Visual Alerts.
 */

const AdminDashboard = (props: any) => {
  const [tab, setTab] = useState('overview');
  const [key, setKey] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  
  // Real-time Alerts
  const [newOrderAlert, setNewOrderAlert] = useState<any>(null);
  const [isMuted, setIsMuted] = useState(false);

  // Form State
  const [n, setN] = useState('');
  const [p, setP] = useState(0);
  const [u, setU] = useState('');

  // Stats calculation
  const stats = useMemo(() => {
    const totalRev = props.orders.reduce((sum: number, o: Order) => 
      o.status !== 'Cancelled' ? sum + o.total : sum, 0);
    const pending = props.orders.filter((o: Order) => o.status === 'Pending').length;
    return { totalRev, pending, totalCount: props.orders.length };
  }, [props.orders]);

  // Audio Ping Engine
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
    } catch (e) { console.error(e); }
  }, [isMuted]);

  // Browser Notifications Request
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Real-time Event Listener
  useEffect(() => {
    if (!props.user) return;
    
    const channel = supabase.channel('order_monitor');
    channel.on('postgres_changes', 
      { event: 'INSERT', schema: 'public', table: 'orders' }, 
      (payload) => {
        const order = payload.new;
        // 1. Refresh list
        props.refreshData();
        
        // 2. Alert UI
        setNewOrderAlert(order);
        
        // 3. Audio
        playPing();
        
        // 4. System Push
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('NEW ORDER: ' + (order.customer_name || 'Customer'), {
            body: 'Amount: Rs. ' + (order.total_pkr || order.total),
            icon: 'https://images.unsplash.com/photo-1614164185128-e4ec99c436d7?w=128'
          });
        }

        setTimeout(() => setNewOrderAlert(null), 10000);
      }
    ).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [props.user, props.refreshData, playPing]);

  if (!props.user) {
    return (
      <div className="min-h-screen bg-[#111] flex items-center justify-center p-4">
        <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl w-full max-w-sm border border-white/10">
          <h1 className="text-xl font-black mb-8 text-center uppercase tracking-tighter">ITX Console</h1>
          <input 
            type="password" value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Security Key"
            className="w-full p-4 border rounded-2xl mb-6 font-bold text-center bg-gray-50 outline-none focus:ring-2 ring-blue-100"
          />
          <button 
            onClick={() => {
              if (key === props.systemPassword) props.login(UserRole.ADMIN);
              else window.alert('Access Denied');
            }}
            className="w-full bg-black text-white p-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-black/10"
          >
            Authenticate
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa] text-black font-sans selection:bg-blue-100">
      {/* REAL-TIME NOTIFICATION BAR */}
      {newOrderAlert && (
        <div className="fixed top-0 left-0 right-0 z-[100] animate-slideInTop">
          <div className="bg-black text-white p-5 shadow-2xl flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center animate-pulse">
                <i className="fas fa-shopping-cart text-sm"></i>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Instant Order Notification</p>
                <p className="font-bold text-sm">#{newOrderAlert.order_id} — {newOrderAlert.customer_name}</p>
              </div>
            </div>
            <div className="flex items-center space-x-6">
              <span className="font-black text-sm px-4 py-1.5 bg-white/10 rounded-xl">Rs. {newOrderAlert.total_pkr || newOrderAlert.total}</span>
              <button onClick={() => setNewOrderAlert(null)} className="text-white/40 hover:text-white"><i className="fas fa-times"></i></button>
            </div>
          </div>
          <div className="h-1 bg-blue-600 w-full overflow-hidden">
            <div className="h-full bg-white/30 animate-progress"></div>
          </div>
        </div>
      )}

      <header className="border-b h-16 flex items-center px-8 justify-between bg-white/80 backdrop-blur-md sticky top-0 z-40">
        <div className="flex space-x-8 text-[10px] font-black uppercase tracking-widest">
          <button onClick={() => setTab('overview')} className={tab === 'overview' ? 'text-blue-600' : 'text-gray-400'}>Overview</button>
          <button onClick={() => setTab('orders')} className={tab === 'orders' ? 'text-blue-600' : 'text-gray-400'}>Orders</button>
          <button onClick={() => setTab('items')} className={tab === 'items' ? 'text-blue-600' : 'text-gray-400'}>Inventory</button>
          <button onClick={() => setTab('sys')} className={tab === 'sys' ? 'text-blue-600' : 'text-gray-400'}>Settings</button>
        </div>
        
        <div className="flex items-center space-x-4">
          <button onClick={() => setIsMuted(!isMuted)} className={`w-8 h-8 rounded-full border flex items-center justify-center transition ${isMuted ? 'bg-red-50 text-red-500 border-red-100' : 'text-gray-300'}`}>
            <i className={isMuted ? 'fas fa-volume-mute text-xs' : 'fas fa-volume-up text-xs'}></i>
          </button>
          <button onClick={props.refreshData} className="text-gray-300 hover:text-black transition uppercase text-[10px] font-black flex items-center">
            <i className="fas fa-sync-alt mr-2"></i> Sync
          </button>
        </div>
      </header>

      <main className="container mx-auto p-8 max-w-6xl">
        {tab === 'overview' && (
          <div className="animate-fadeIn">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
              <div className="bg-white border p-8 rounded-[2rem] shadow-sm">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Revenue</p>
                <p className="text-3xl font-black">Rs. {stats.totalRev.toLocaleString()}</p>
              </div>
              <div className="bg-white border p-8 rounded-[2rem] shadow-sm">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Pending</p>
                <p className="text-3xl font-black text-blue-600">{stats.pending}</p>
              </div>
              <div className="bg-white border p-8 rounded-[2rem] shadow-sm">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Total Sales</p>
                <p className="text-3xl font-black">{stats.totalCount}</p>
              </div>
            </div>
          </div>
        )}

        {tab === 'orders' && (
          <div className="space-y-4 animate-fadeIn">
            <h2 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-6">Recent Transactions</h2>
            {props.orders.map((o: Order) => (
              <div key={o.id} className="bg-white border p-6 rounded-3xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6 group hover:shadow-xl transition-shadow duration-300">
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center font-black text-xs border">
                    {o.status === 'Delivered' ? <i className="fas fa-check text-green-500"></i> : String(o.status).charAt(0)}
                  </div>
                  <div>
                    <p className="font-black text-sm tracking-tighter">#{o.id}</p>
                    <p className="text-[10px] uppercase text-gray-400 font-bold mt-1">{o.customer.name} — {o.customer.city}</p>
                    <p className="text-[9px] text-blue-600 font-bold mt-1 uppercase tracking-widest italic">{o.customer.phone}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-8 w-full md:w-auto justify-between border-t md:border-t-0 pt-4 md:pt-0">
                  <span className="font-black text-lg">Rs. {o.total.toLocaleString()}</span>
                  <select 
                    value={o.status} 
                    onChange={e => props.updateStatusOverride?.(o.id, e.target.value as any)}
                    className="border p-3 rounded-2xl text-[10px] font-black uppercase bg-gray-50 outline-none focus:ring-2 ring-blue-100 cursor-pointer"
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
          <div className="animate-fadeIn">
            <div className="flex justify-between items-center mb-10">
              <h2 className="text-xs font-black uppercase tracking-widest text-gray-400">Inventory Manager</h2>
              <button onClick={() => setIsAddOpen(true)} className="bg-black text-white px-8 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-black/10 hover:scale-105 transition">
                + Add Product
              </button>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
              {props.products.map((itm: any) => (
                <div key={itm.id} className="bg-white border p-5 rounded-[2.5rem] group relative shadow-sm hover:shadow-md transition">
                  <div className="aspect-square relative mb-5 overflow-hidden rounded-[1.8rem]">
                    <img src={itm.image} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt="" />
                    <button onClick={() => props.deleteProduct(itm.id)} className="absolute top-3 right-3 bg-red-600 text-white w-9 h-9 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-lg">
                      <i className="fas fa-trash text-[11px]"></i>
                    </button>
                  </div>
                  <p className="text-[11px] font-black truncate uppercase tracking-tight mb-1.5">{itm.name}</p>
                  <p className="text-[12px] font-black text-blue-600">Rs. {itm.price.toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'sys' && (
          <div className="max-w-md bg-white border p-10 rounded-[3rem] animate-fadeIn">
            <p className="text-[10px] font-black text-gray-400 mb-8 uppercase tracking-[0.2em]">Security Configuration</p>
            <div className="space-y-8">
              <div>
                <label className="block text-[9px] font-bold uppercase text-gray-400 mb-3 italic">Master Access Key</label>
                <div className="flex gap-4">
                  <input 
                    value={props.systemPassword} 
                    onChange={e => props.setSystemPassword(e.target.value)} 
                    className="border p-4 rounded-2xl w-full text-sm font-bold bg-gray-50 focus:outline-none focus:ring-2 ring-blue-100" 
                  />
                  <button onClick={() => { localStorage.setItem('systemPassword', props.systemPassword); window.alert('Settings Updated'); }} className="bg-black text-white px-10 rounded-2xl text-[10px] font-black uppercase">Save</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {isAddOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-6 z-[200]">
          <div className="bg-white p-12 rounded-[3.5rem] w-full max-w-md shadow-2xl relative animate-fadeIn">
            <button onClick={() => setIsAddOpen(false)} className="absolute top-10 right-10 text-gray-300 hover:text-black"><i className="fas fa-times text-2xl"></i></button>
            <h2 className="font-black text-2xl mb-10 uppercase tracking-tighter italic">Add to Collection</h2>
            <div className="space-y-5">
              <input className="w-full border p-4 rounded-2xl text-xs font-bold bg-gray-50" placeholder="Product Title" value={n} onChange={e => setN(e.target.value)} />
              <input className="w-full border p-4 rounded-2xl text-xs font-bold bg-gray-50" placeholder="Price (PKR)" type="number" value={p} onChange={e => setP(Number(e.target.value))} />
              <input className="w-full border p-4 rounded-2xl text-xs font-bold bg-gray-50" placeholder="High-Res Image URL" value={u} onChange={e => setU(e.target.value)} />
              <button 
                className="w-full bg-black text-white p-5 rounded-2xl font-black text-xs uppercase tracking-widest mt-8 shadow-2xl shadow-black/20 hover:bg-blue-600 transition"
                onClick={async () => {
                  if(!n || !p || !u) return window.alert('Please complete all fields');
                  await supabase.from('products').insert([{ name: n, price_pkr: p, image: u, description: n, category: 'Luxury', inventory: 10 }]);
                  props.refreshData(); setIsAddOpen(false); setN(''); setP(0); setU('');
                }}
              >
                Publish Live
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
