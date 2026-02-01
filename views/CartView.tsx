
import React from 'react';
import { Link } from 'react-router-dom';
import { CartItem } from '../types';

interface CartViewProps {
  cart: CartItem[];
  updateQuantity: (productId: string, quantity: number, variantId?: string) => void;
  removeFromCart: (productId: string, variantId?: string) => void;
}

const CartView: React.FC<CartViewProps> = ({ cart, updateQuantity, removeFromCart }) => {
  const subtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  if (cart.length === 0) {
    return (
      <div className="container mx-auto px-4 py-32 text-center animate-fadeIn">
        <div className="mb-8">
          <i className="fas fa-shopping-bag text-8xl text-gray-100"></i>
        </div>
        <h2 className="text-4xl font-black uppercase tracking-tighter mb-4">Your Bag is Empty</h2>
        <p className="text-gray-500 mb-8 font-medium">Looks like you haven't added anything to your cart yet.</p>
        <Link to="/" className="bg-black text-white px-10 py-4 rounded-full font-black uppercase tracking-tight hover:scale-105 transition-transform inline-block">
          Start Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-16 animate-fadeIn">
      <h1 className="text-4xl font-black uppercase italic tracking-tighter mb-12">Shopping Bag <span className="text-gray-300">({cart.length})</span></h1>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-8">
          <div className="space-y-8">
            {cart.map((item, idx) => (
              <div key={`${item.product.id}-${item.variantId || idx}`} className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-6 pb-8 border-b border-gray-100 group">
                <div className="w-full sm:w-32 aspect-square bg-gray-100 rounded-2xl overflow-hidden shrink-0">
                  <img src={item.product.image} alt={item.product.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-grow text-center sm:text-left">
                  <h3 className="text-xl font-black uppercase tracking-tight text-black group-hover:text-blue-600 transition">{item.product.name}</h3>
                  <p className="text-sm text-gray-500 font-bold uppercase tracking-widest mt-1">
                    Category: {item.product.category} {item.variantId && `| Variant: ${item.variantId}`}
                  </p>
                  <div className="flex items-center justify-center sm:justify-start mt-6 space-x-4">
                    <div className="flex items-center border-2 border-gray-100 rounded-full px-3 py-1 bg-gray-50">
                      <button onClick={() => updateQuantity(item.product.id, item.quantity - 1, item.variantId)} className="p-2 text-gray-400 hover:text-black"><i className="fas fa-minus text-xs"></i></button>
                      <span className="w-8 text-center font-black text-sm">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.product.id, item.quantity + 1, item.variantId)} className="p-2 text-gray-400 hover:text-black"><i className="fas fa-plus text-xs"></i></button>
                    </div>
                    <button onClick={() => removeFromCart(item.product.id, item.variantId)} className="text-[10px] font-black uppercase tracking-widest text-red-500 hover:text-red-700 underline">Remove</button>
                  </div>
                </div>
                <div className="text-xl font-black tracking-tighter text-black sm:w-32 text-center sm:text-right">
                  Rs. {(item.product.price * item.quantity).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-4">
          <div className="bg-gray-50 rounded-3xl p-8 sticky top-24">
            <h4 className="text-lg font-black uppercase tracking-widest mb-6">Order Summary</h4>
            <div className="space-y-4 mb-8">
              <div className="flex justify-between text-sm font-bold uppercase tracking-widest text-gray-500">
                <span>Subtotal</span>
                <span className="text-black">Rs. {subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm font-bold uppercase tracking-widest text-gray-500">
                <span>Shipping</span>
                <span className="text-green-600 font-black">FREE</span>
              </div>
              <div className="flex justify-between text-sm font-bold uppercase tracking-widest text-gray-500">
                <span>Tax</span>
                <span className="text-black">Rs. 0</span>
              </div>
              <div className="pt-4 border-t border-gray-200 flex justify-between items-center">
                <span className="text-xl font-black uppercase tracking-tighter">Total</span>
                <span className="text-2xl font-black tracking-tighter text-blue-600">Rs. {subtotal.toLocaleString()}</span>
              </div>
            </div>
            
            <Link 
              to="/checkout" 
              className="w-full block bg-black text-white text-center py-5 rounded-full font-black uppercase tracking-tight text-lg hover:bg-blue-600 transition shadow-xl"
            >
              Checkout — COD
            </Link>
            
            <div className="mt-8 space-y-4">
              <div className="flex items-center space-x-3 text-gray-400">
                <i className="fas fa-shield-check"></i>
                <span className="text-[10px] font-bold uppercase tracking-widest">Fast Delivery in Pakistan</span>
              </div>
              <div className="flex items-center space-x-3 text-gray-400">
                <i className="fas fa-truck-fast"></i>
                <span className="text-[10px] font-bold uppercase tracking-widest">Estimated Arrival: 2-3 Days</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CartView;
