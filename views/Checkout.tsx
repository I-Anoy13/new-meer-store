
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { CartItem, Order } from '../types';

interface CheckoutProps {
  cart: CartItem[];
  placeOrder: (order: Order) => void;
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const newOrderId = `ORD-${Math.floor(Math.random() * 900000) + 100000}`;
    
    setTimeout(() => {
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
      
      placeOrder(newOrder);
      setOrderId(newOrderId);
      setIsOrdered(true);
      setIsSubmitting(false);
    }, 1500);
  };

  if (isOrdered) {
    return (
      <div className="container mx-auto px-4 py-32 text-center animate-fadeIn">
        <div className="w-24 h-24 bg-green-500 text-white rounded-full flex items-center justify-center mx-auto mb-8 text-4xl shadow-lg animate-bounce">
          <i className="fas fa-check"></i>
        </div>
        <h1 className="text-4xl font-black uppercase tracking-tighter mb-4 text-black">Thank You for Your Order!</h1>
        <p className="text-gray-600 mb-8 max-w-md mx-auto text-lg">
          Your order has been placed successfully. Your Order ID is <span className="font-black text-black">#{orderId}</span>.
        </p>
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6 mb-10 max-w-sm mx-auto">
          <p className="text-blue-800 font-bold">
            <i className="fas fa-truck mr-2"></i> 
            Your parcel will be delivered within 3-4 days.
          </p>
        </div>
        <Link to="/" className="bg-black text-white px-10 py-4 rounded-full font-black uppercase tracking-tight hover:scale-105 transition-transform inline-block italic">
          Continue Shopping
        </Link>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="container mx-auto px-4 py-32 text-center">
        <h2 className="text-2xl font-black mb-4 text-black">YOUR BAG IS EMPTY</h2>
        <Link to="/" className="text-blue-600 font-bold">Return to Shop</Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-16 max-w-5xl">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-7">
          <div className="bg-white rounded-[2.5rem] p-10 border border-gray-100 shadow-xl shadow-gray-100/50">
            <div className="mb-10 text-center lg:text-left">
              <h2 className="text-3xl font-black uppercase tracking-tighter italic text-black">Cash On Delivery</h2>
              <p className="text-gray-400 font-bold text-xs uppercase tracking-widest mt-2">Complete your details to place order</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 gap-6 text-black">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2 italic">Full Name</label>
                  <input 
                    required
                    type="text" 
                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 font-bold focus:outline-none focus:ring-2 focus:ring-black transition" 
                    placeholder="Enter your full name"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2 italic">Phone Number</label>
                  <input 
                    required
                    type="tel" 
                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 font-bold focus:outline-none focus:ring-2 focus:ring-black transition" 
                    placeholder="e.g. 03xx-xxxxxxx"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2 italic">City</label>
                  <input 
                    required
                    type="text" 
                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 font-bold focus:outline-none focus:ring-2 focus:ring-black transition" 
                    placeholder="e.g. Karachi, Lahore, Islamabad"
                    value={formData.city}
                    onChange={(e) => setFormData({...formData, city: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2 italic">Full Address</label>
                  <textarea 
                    required
                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 font-bold focus:outline-none focus:ring-2 focus:ring-black transition h-32 resize-none" 
                    placeholder="House no, Street, Area..."
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                  />
                </div>
              </div>

              <div className="pt-6">
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="w-full bg-black text-white font-black uppercase py-6 rounded-2xl hover:bg-blue-600 transition shadow-2xl shadow-blue-500/20 disabled:bg-gray-400 group relative overflow-hidden italic"
                >
                  {isSubmitting ? (
                    <i className="fas fa-circle-notch fa-spin"></i>
                  ) : (
                    <span className="relative z-10">
                      Place Order — Rs. {subtotal.toLocaleString()} 
                      <i className="fas fa-arrow-right ml-3 group-hover:translate-x-1 transition-transform"></i>
                    </span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="bg-gray-50 rounded-[2.5rem] p-8 border border-gray-200 sticky top-24">
            <h4 className="text-xs font-black uppercase tracking-widest mb-8 flex items-center text-black">
              <i className="fas fa-shopping-bag mr-3 text-blue-600"></i> Order Review
            </h4>
            <div className="space-y-5 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar mb-8 text-black">
              {cart.map((item, i) => (
                <div key={i} className="flex space-x-4 items-center bg-white p-3 rounded-2xl border border-gray-100">
                  <div className="w-16 h-16 rounded-xl overflow-hidden border border-gray-50 shrink-0">
                    <img src={item.product.image} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-grow min-w-0">
                    <p className="text-xs font-black truncate uppercase">{item.product.name}</p>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Qty: {item.quantity}</p>
                  </div>
                  <p className="text-sm font-black whitespace-nowrap">Rs. {(item.product.price * item.quantity).toLocaleString()}</p>
                </div>
              ))}
            </div>
            
            <div className="pt-6 border-t border-gray-200 space-y-4 text-black">
              <div className="flex justify-between text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
                <span>Shipping Fee</span>
                <span className="text-green-600">Free Delivery</span>
              </div>
              <div className="flex justify-between items-center text-2xl font-black uppercase tracking-tighter">
                <span>Amount Payable</span>
                <span className="text-blue-600">Rs. {subtotal.toLocaleString()}</span>
              </div>
            </div>

            {/* Social Proof Section - Happy Customers with Pakistani style DPs */}
            <div className="mt-8 pt-8 border-t border-gray-200">
              <div className="flex flex-col items-center">
                <div className="flex -space-x-3 mb-4">
                  <img className="inline-block h-10 w-10 rounded-full ring-4 ring-gray-50 object-cover" src="https://images.unsplash.com/photo-1614283233556-f35b0c801ef1?q=80&w=100&auto=format&fit=crop" alt="Pakistani DP 1" />
                  <img className="inline-block h-10 w-10 rounded-full ring-4 ring-gray-50 object-cover" src="https://images.unsplash.com/photo-1589156280159-27698a70f29e?q=80&w=100&auto=format&fit=crop" alt="Pakistani DP 2" />
                  <img className="inline-block h-10 w-10 rounded-full ring-4 ring-gray-50 object-cover" src="https://images.unsplash.com/photo-1628157588553-5eeea00af15c?q=80&w=100&auto=format&fit=crop" alt="Pakistani DP 3" />
                  <img className="inline-block h-10 w-10 rounded-full ring-4 ring-gray-50 object-cover" src="https://images.unsplash.com/photo-1594744803329-e58b31de8bf5?q=80&w=100&auto=format&fit=crop" alt="Pakistani DP 4" />
                  <img className="inline-block h-10 w-10 rounded-full ring-4 ring-gray-50 object-cover" src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=100&auto=format&fit=crop" alt="Pakistani DP 5" />
                  <div className="h-10 w-10 rounded-full ring-4 ring-gray-50 bg-black flex items-center justify-center text-[10px] font-black text-white">+82</div>
                </div>
                <div className="text-center">
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-black italic">10,000+ Happy Customers</p>
                  <div className="flex justify-center text-yellow-500 mt-1 space-x-0.5">
                    <i className="fas fa-star text-[10px]"></i>
                    <i className="fas fa-star text-[10px]"></i>
                    <i className="fas fa-star text-[10px]"></i>
                    <i className="fas fa-star text-[10px]"></i>
                    <i className="fas fa-star text-[10px]"></i>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 p-4 bg-white rounded-2xl border border-gray-200 text-center">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 italic">
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
