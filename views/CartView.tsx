
import React from 'react';
import { Link } from 'react-router-dom';
import { CartItem } from '../types';

interface CartViewProps {
  cart: CartItem[];
  updateQuantity: (productId: string, quantity: number, variantId?: string) => void;
  removeFromCart: (productId: string, variantId?: string) => void;
}

const CartView: React.FC<CartViewProps> = ({ cart, updateQuantity, removeFromCart }) => {
  const subtotal = cart.reduce((sum, item) => sum + (item.variantId ? item.product.variants?.find(v => v.id === item.variantId)?.price || item.product.price : item.product.price) * item.quantity, 0);

  if (cart.length === 0) {
    return (
      <div className="container mx-auto px-4 py-32 text-center animate-fadeIn">
        <div className="mb-6">
          <i className="fas fa-shopping-bag text-5xl text-gray-100"></i>
        </div>
        <h2 className="text-xl font-bold uppercase tracking-tight mb-3">Your Bag is Empty</h2>
        <p className="text-sm text-gray-500 mb-8">Looks like you haven't added anything yet.</p>
        <Link to="/" className="bg-black text-white px-8 py-3 rounded-lg text-xs font-bold uppercase tracking-wide transition-all inline-block">
          Start Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-16 animate-fadeIn">
      <h1 className="text-xl md:text-2xl font-bold uppercase tracking-tight mb-10">Shopping Bag <span className="text-gray-300">({cart.length})</span></h1>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-8">
          <div className="space-y-6">
            {cart.map((item, idx) => {
              const currentPrice = item.variantId ? item.product.variants?.find(v => v.id === item.variantId)?.price || item.product.price : item.product.price;
              
              return (
                <div key={`${item.product.id}-${item.variantId || idx}`} className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-4 pb-6 border-b border-gray-100 group">
                  <div className="w-full sm:w-24 aspect-square bg-gray-100 rounded-lg overflow-hidden shrink-0">
                    <img src={item.product.image} alt={item.product.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-grow text-center sm:text-left">
                    <h3 className="text-sm font-bold uppercase text-black group-hover:text-blue-600 transition">{item.product.name}</h3>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wide mt-1">
                      {item.product.category} {item.variantName && `| ${item.variantName}`}
                    </p>
                    <div className="flex items-center justify-center sm:justify-start mt-4 space-x-4">
                      <div className="flex items-center border border-gray-200 rounded-lg px-2 py-0.5 bg-gray-50">
                        <button onClick={() => updateQuantity(item.product.id, item.quantity - 1, item.variantId)} className="p-2 text-gray-400 hover:text-black"><i className="fas fa-minus text-[10px]"></i></button>
                        <span className="w-6 text-center font-bold text-xs">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.product.id, item.quantity + 1, item.variantId)} className="p-2 text-gray-400 hover:text-black"><i className="fas fa-plus text-[10px]"></i></button>
                      </div>
                      <button onClick={() => removeFromCart(item.product.id, item.variantId)} className="text-[10px] font-bold uppercase text-red-500 hover:text-red-700 underline">Remove</button>
                    </div>
                  </div>
                  <div className="text-base font-bold text-black sm:w-32 text-center sm:text-right">
                    Rs. {(currentPrice * item.quantity).toLocaleString()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-4">
          <div className="bg-gray-50 rounded-xl p-6 border border-gray-200 sticky top-24">
            <h4 className="text-[10px] font-bold uppercase tracking-wide mb-6">Order Summary</h4>
            <div className="space-y-4 mb-6">
              <div className="flex justify-between text-xs font-bold text-gray-500 uppercase">
                <span>Subtotal</span>
                <span className="text-black">Rs. {subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs font-bold text-gray-500 uppercase">
                <span>Shipping</span>
                <span className="text-green-600">FREE</span>
              </div>
              <div className="pt-4 border-t border-gray-200 flex justify-between items-center">
                <span className="text-sm font-bold uppercase">Total</span>
                <span className="text-lg font-bold text-blue-600">Rs. {subtotal.toLocaleString()}</span>
              </div>
            </div>
            
            <Link 
              to="/checkout" 
              className="w-full block bg-black text-white text-center py-3.5 rounded-lg font-bold uppercase text-xs tracking-wide hover:bg-blue-600 transition shadow-lg"
            >
              Checkout — COD
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CartView;
