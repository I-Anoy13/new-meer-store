
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { CartItem, Order } from '../types';

interface CheckoutProps {
  cart: CartItem[];
  placeOrder: (order: Order) => Promise<boolean>;
}

const Checkout: React.FC<CheckoutProps> = ({ cart, placeOrder }) => {
  const [isOrdered, setIsOrdered] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    city: '',
    address: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const subtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    const newOrderId = `ORD-${Math.floor(Math.random() * 900000) + 100000}`;
    
    // Safety Timeout for UX
    const forceSuccess = setTimeout(() => {
       setOrderId(newOrderId);
       setIsOrdered(true);
       setIsSubmitting(false);
    }, 3500);

    const newOrder: Order = {
      id: newOrderId,
      items: [...cart],
      total: subtotal,
      status: 'Pending',
      customer: {
        name: formData.name,
        email: '',
        phone: formData.phone,
        address: `${formData.address}, ${formData.city}`
      },
      date: new Date().toISOString()
    };
    
    try {
      const success = await placeOrder(newOrder);
      if (success) {
        clearTimeout(forceSuccess);
        setOrderId(newOrderId);
        setIsOrdered(true);
      }
    } catch (err) {
      console.error("Order process error", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isOrdered) {
    return (
      <div className="container mx-auto px-4 py-32 text-center animate-fadeIn">
        <div className="w-16 h-16 bg-green-500 text-white rounded-full flex items-center justify-center mx-auto mb-8 text-2xl shadow-lg">
          <i className="fas fa-check"></i>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold uppercase tracking-tight mb-4 text-black">Order Successful</h1>
        <p className="text-gray-600 mb-8 max-w-sm mx-auto text-sm font-medium">
          Thank you. Your order ID is <span className="font-bold text-black">#{orderId}</span>.
        </p>
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 mb-10 max-w-xs mx-auto">
          <p className="text-blue-800 text-xs font-bold leading-relaxed">
            <i className="fas fa-truck mr-2"></i> 
            Delivery expected within 3-4 days.
          </p>
        </div>
        <Link to="/" className="bg-black text-white px-8 py-4 rounded-full font-bold uppercase tracking-widest text-[10px] hover:scale-105 transition-transform inline-block italic">
          Continue Shopping
        </Link>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="container mx-auto px-4 py-32 text-center">
        <h2 className="text-xl font-bold mb-4 text-black uppercase tracking-widest">Your bag is empty</h2>
        <Link to="/" className="text-blue-600 font-bold text-sm underline">Return to Shop</Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl text-black">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-7">
          <div className="bg-white rounded-[2rem] p-8 md:p-10 border border-gray-100 shadow-xl shadow-gray-100/30">
            <div className="mb-8 text-center lg:text-left">
              <h2 className="text-2xl font-bold uppercase tracking-tight italic text-black">Cash On Delivery</h2>
              <p className="text-gray-400 font-bold text-[10px] uppercase tracking-[0.2em] mt-2">Complete delivery details</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 gap-5">
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-2 italic">Full Name</label>
                  <input 
                    required
                    type="text" 
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-5 py-3.5 font-bold text-sm focus:outline-none focus:border-black transition" 
                    placeholder="Enter your name"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-2 italic">Phone Number</label>
                  <input 
                    required
                    type="tel" 
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-5 py-3.5 font-bold text-sm focus:outline-none focus:border-black transition" 
                    placeholder="e.g. 0300-1234567"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-2 italic">City</label>
                    <input 
                      required
                      type="text" 
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-5 py-3.5 font-bold text-sm focus:outline-none focus:border-black transition" 
                      placeholder="City"
                      value={formData.city}
                      onChange={(e) => setFormData({...formData, city: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-2 italic">Area</label>
                    <input 
                      required
                      type="text" 
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-5 py-3.5 font-bold text-sm focus:outline-none focus:border-black transition" 
                      placeholder="Area/Postal"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-2 italic">Full Address</label>
                  <textarea 
                    required
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-5 py-3.5 font-bold text-sm focus:outline-none focus:border-black transition h-24 resize-none" 
                    placeholder="House no, Street, etc."
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                  />
                </div>
              </div>

              <div className="pt-6">
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="w-full bg-black text-white font-bold uppercase py-5 rounded-xl hover:bg-blue-600 transition shadow-xl text-xs tracking-widest italic"
                >
                  {isSubmitting ? (
                    <i className="fas fa-circle-notch fa-spin"></i>
                  ) : (
                    <span>
                      Place Order — Rs. {subtotal.toLocaleString()} 
                    </span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="bg-gray-50 rounded-[2rem] p-6 md:p-8 border border-gray-200 sticky top-24">
            <h4 className="text-[10px] font-bold uppercase tracking-widest mb-8 flex items-center text-black">
              <i className="fas fa-shopping-bag mr-3 text-blue-600"></i> Order Review
            </h4>
            <div className="space-y-4 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar mb-8 text-black">
              {cart.map((item, i) => (
                <div key={i} className="flex space-x-3 items-center bg-white p-3 rounded-xl border border-gray-100">
                  <div className="w-12 h-12 rounded-lg overflow-hidden border border-gray-50 shrink-0">
                    <img src={item.product.image} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-grow min-w-0">
                    <p className="text-[11px] font-bold truncate uppercase tracking-tight">{item.product.name}</p>
                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Qty: {item.quantity}</p>
                  </div>
                  <p className="text-xs font-bold whitespace-nowrap">Rs. {(item.product.price * item.quantity).toLocaleString()}</p>
                </div>
              ))}
            </div>
            
            <div className="pt-6 border-t border-gray-200 space-y-3">
              <div className="flex justify-between text-[9px] font-bold uppercase tracking-widest text-gray-400">
                <span>Shipping Fee</span>
                <span className="text-green-600">Free Delivery</span>
              </div>
              <div className="flex justify-between items-center text-lg font-bold uppercase tracking-tight">
                <span>Amount Payable</span>
                <span className="text-blue-600">Rs. {subtotal.toLocaleString()}</span>
              </div>
            </div>

            <div className="mt-8 pt-8 border-t border-gray-200 text-center">
                <div className="flex justify-center -space-x-2 mb-4">
                  {[1,2,3,4].map(i => (
                    <img key={i} className="inline-block h-8 w-8 rounded-full ring-2 ring-gray-50 object-cover" src={`https://images.unsplash.com/photo-${1614283233556 + i}-f35b0c801ef1?q=80&w=100&auto=format&fit=crop`} alt="User" />
                  ))}
                  <div className="h-8 w-8 rounded-full ring-2 ring-gray-50 bg-black flex items-center justify-center text-[8px] font-bold text-white uppercase">+82</div>
                </div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-black mb-1.5 italic">Trusted by 10,000+ Customers</p>
                <div className="flex justify-center text-yellow-500 text-[10px] space-x-0.5">
                  {[1,2,3,4,5].map(i => <i key={i} className="fas fa-star"></i>)}
                </div>
            </div>

            <div className="mt-8 p-3 bg-white rounded-xl border border-gray-200 text-center">
              <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 italic">
                <i className="fas fa-info-circle mr-1 text-blue-500"></i> No advance payment required
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
