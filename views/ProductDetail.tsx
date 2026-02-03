
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Product, Order } from '../types';
import { TRUST_BADGES, PLACEHOLDER_IMAGE } from '../constants';

interface ProductDetailProps {
  products: Product[];
  addToCart: (product: Product, quantity: number, variantId?: string) => void;
  placeOrder: (order: Order) => Promise<boolean>;
}

const MUSLIM_NAMES = ['Ahmed', 'Fatima', 'Zaid', 'Aisha', 'Bilal', 'Maryam', 'Omar', 'Zainab', 'Hamza', 'Sara', 'Usman', 'Hiba', 'Mustafa', 'Noor', 'Raza', 'Sana'];
const PAKISTAN_CITIES = ['Karachi', 'Lahore', 'Islamabad', 'Faisalabad', 'Rawalpindi', 'Multan', 'Quetta', 'Peshawar', 'Sialkot', 'Gujranwala'];

const ProductDetail: React.FC<ProductDetailProps> = ({ products, addToCart, placeOrder }) => {
  const { id } = useParams<{ id: string }>();
  const product = products.find(p => p.id === id);
  const [selectedVariant, setSelectedVariant] = useState(product?.variants?.[0]?.id || '');
  const [quantity, setQuantity] = useState(1);
  const [isOrderPortalActive, setIsOrderPortalActive] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<{ id: string } | null>(null);

  // Urgency State: Fixed at 14 units per request
  const [unitsLeft, setUnitsLeft] = useState(14);

  // Purchase Popup State
  const [purchaseNotification, setPurchaseNotification] = useState<{name: string, city: string} | null>(null);

  useEffect(() => {
    if (isOrderPortalActive) {
      window.scrollTo(0, 0);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => { document.body.style.overflow = 'auto'; };
  }, [isOrderPortalActive]);

  const [viewers, setViewers] = useState(18 + Math.floor(Math.random() * 6));
  
  useEffect(() => {
    const interval = setInterval(() => {
      // Metric: People Watching
      setViewers(prev => {
        const next = prev + (Math.random() > 0.5 ? 1 : -1);
        return next < 18 ? 18 : next > 25 ? 25 : next;
      });
      
      // Occasionally decrease stock
      if (Math.random() > 0.85) {
        setUnitsLeft(prev => prev > 2 ? prev - 1 : 2);
      }
    }, 4500);

    // Purchase Notification Cycle
    const notifyInterval = setInterval(() => {
      const name = MUSLIM_NAMES[Math.floor(Math.random() * MUSLIM_NAMES.length)];
      const city = PAKISTAN_CITIES[Math.floor(Math.random() * PAKISTAN_CITIES.length)];
      setPurchaseNotification({ name, city });
      
      // Auto hide after 5 seconds
      setTimeout(() => setPurchaseNotification(null), 5000);
    }, 12000); // Appear every 12 seconds

    return () => {
      clearInterval(interval);
      clearInterval(notifyInterval);
    };
  }, []);

  // Timer: Exactly 60 minutes
  const [timeLeft, setTimeLeft] = useState(3600);
  useEffect(() => {
    const timer = setInterval(() => setTimeLeft(prev => (prev > 0 ? prev - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const [formData, setFormData] = useState({ name: '', phone: '', city: '', address: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!product) {
    return (
      <div className="container mx-auto px-4 py-32 text-center text-black">
        <h2 className="text-3xl font-serif font-bold italic uppercase tracking-tighter text-black">Watch Not Found</h2>
        <Link to="/" className="text-blue-600 mt-6 inline-block font-black uppercase text-[10px] tracking-widest hover:underline italic">Return to Collection</Link>
      </div>
    );
  }

  const variantObj = product.variants?.find(v => v.id === selectedVariant);
  const currentPrice = variantObj?.price || product.price;

  const handleQuickOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const timestamp = Date.now().toString().slice(-6);
    const newOrderId = `ORD-${timestamp}`;
    const newOrder: Order = {
      id: newOrderId,
      items: [{ product, quantity, variantId: selectedVariant, variantName: variantObj?.name || 'Standard' }],
      total: currentPrice * quantity,
      status: 'Pending',
      customer: { name: formData.name, email: '', phone: formData.phone, address: formData.address, city: formData.city },
      date: new Date().toISOString()
    };
    const success = await placeOrder(newOrder);
    if (success) setOrderSuccess({ id: newOrderId });
    setIsSubmitting(false);
  };

  if (isOrderPortalActive) {
    return (
      <div className="fixed inset-0 bg-white z-[100] flex flex-col animate-fadeIn overflow-hidden">
        <div className="bg-black text-white py-4 px-6 sticky top-0 z-50 flex justify-between items-center shadow-lg">
          <div className="flex items-center space-x-2">
             <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
             <p className="text-[10px] font-black uppercase tracking-[0.2em] italic">Checkout — COD Secure</p>
          </div>
          <button onClick={() => setIsOrderPortalActive(false)} className="text-white/60 hover:text-white transition uppercase text-[10px] font-black tracking-widest">
            Close <i className="fas fa-times ml-1"></i>
          </button>
        </div>

        <div className="flex-grow overflow-y-auto custom-scrollbar pb-12">
          <div className="container mx-auto px-6 py-8 max-w-md">
            {!orderSuccess ? (
              <>
                <div className="mb-8 text-center">
                  <h1 className="text-2xl font-serif font-bold italic uppercase tracking-tighter text-black leading-tight">Cash On Delivery</h1>
                  <p className="text-blue-600 text-[10px] font-black uppercase tracking-[0.3em] italic mt-2">Verified Merchant Protocol</p>
                </div>

                <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 flex items-center space-x-4 mb-8">
                  <img src={product.image} className="w-20 h-20 rounded-xl object-cover border shadow-sm" />
                  <div className="flex-grow min-w-0">
                    <h3 className="text-sm font-black uppercase italic text-black truncate">{product.name}</h3>
                    <p className="text-blue-600 font-black text-lg italic mt-1">Rs. {currentPrice.toLocaleString()}</p>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="text-[8px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-black uppercase tracking-widest">In Stock</span>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleQuickOrder} className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 px-1 italic tracking-widest">Full Recipient Name</label>
                    <input required type="text" className="w-full bg-white border border-gray-200 rounded-2xl px-5 py-4 font-bold outline-none text-black focus:border-black transition text-base italic shadow-sm" placeholder="ENTER FULL NAME" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 px-1 italic tracking-widest">WhatsApp / Phone</label>
                      <input required type="tel" className="w-full bg-white border border-gray-200 rounded-2xl px-5 py-4 font-bold outline-none text-black focus:border-black transition text-base italic shadow-sm" placeholder="03XXXXXXXXX" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 px-1 italic tracking-widest">City</label>
                      <input required type="text" className="w-full bg-white border border-gray-200 rounded-2xl px-5 py-4 font-bold outline-none text-black focus:border-black transition text-base italic shadow-sm" placeholder="Karachi, Lahore, etc." value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 px-1 italic tracking-widest">Full Delivery Address</label>
                    <textarea required className="w-full bg-white border border-gray-200 rounded-2xl px-5 py-4 font-bold outline-none h-32 resize-none text-black focus:border-black transition text-base italic leading-relaxed shadow-sm" placeholder="Street, Landmark, House No." value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
                  </div>

                  <div className="pt-4 text-black">
                    <button type="submit" disabled={isSubmitting} className="w-full bg-black text-white font-black uppercase py-5 rounded-2xl hover:bg-blue-600 transition shadow-xl tracking-[0.2em] text-sm italic active:scale-95 animate-pulse-red">
                      {isSubmitting ? <i className="fas fa-circle-notch fa-spin text-lg"></i> : `Confirm Order — Rs. ${currentPrice.toLocaleString()}`}
                    </button>
                    
                    <div className="mt-6 bg-blue-50 border border-blue-100 p-4 rounded-2xl text-center">
                      <p className="text-[10px] font-black uppercase text-blue-800 tracking-[0.2em] italic">
                        <i className="fas fa-truck-fast mr-2"></i> Free Express Shipping
                      </p>
                      <p className="text-[8px] font-bold text-blue-400 uppercase tracking-widest mt-1">Payment will be collected upon delivery</p>
                    </div>
                  </div>
                </form>
              </>
            ) : (
              <div className="text-center py-20 animate-fadeIn">
                <div className="w-20 h-20 bg-green-500 text-white rounded-full flex items-center justify-center mx-auto mb-6 text-3xl shadow-lg animate-bounce">
                  <i className="fas fa-check"></i>
                </div>
                <h2 className="text-3xl font-serif font-bold italic uppercase mb-2 text-black">Order Dispatched</h2>
                <p className="text-gray-500 mb-8 font-bold italic text-xs tracking-[0.3em] uppercase">MANIFEST RECORD: <span className="text-black font-black">#{orderSuccess.id}</span></p>
                <button onClick={() => { setIsOrderPortalActive(false); setOrderSuccess(null); }} className="w-full bg-black text-white font-black uppercase tracking-[0.3em] py-5 rounded-2xl shadow-xl hover:bg-blue-600 transition text-xs italic">Return To Collection</button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white animate-fadeIn pb-24 lg:pb-0 relative text-black overflow-x-hidden">
      {/* PURCHASE POPUP - FIXED IN MID VIEWPORT, SLIDES WITH SCROLLING */}
      {purchaseNotification && (
        <div className="fixed inset-y-0 left-0 z-[100] flex items-center pl-6 pointer-events-none">
          <div className="bg-white/95 backdrop-blur-md border border-gray-100 p-4 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] flex items-center space-x-4 animate-slideInLeft max-w-[280px] pointer-events-auto">
            <div className="w-12 h-12 bg-green-600 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-lg shadow-green-200">
              <i className="fas fa-shopping-cart text-sm"></i>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-black italic leading-none truncate">
                {purchaseNotification.name} from {purchaseNotification.city}
              </p>
              <p className="text-[9px] font-bold text-gray-500 uppercase mt-1.5">Just ordered this item!</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-red-600 text-white py-2 text-center sticky top-16 z-50 shadow-md">
        <div className="container mx-auto px-4 flex items-center justify-center space-x-2 md:space-x-6">
          <span className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] animate-pulse">FLASH SALE — 25% DISCOUNT RESERVED</span>
          <div className="h-3 w-px bg-white/30"></div>
          <span className="text-[10px] md:text-xs font-mono font-bold tracking-widest uppercase">ENDS: {formatTime(timeLeft)}</span>
        </div>
      </div>

      <div className="container mx-auto px-4 md:px-6 py-4 lg:py-16 relative">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-16">
          <div className="lg:col-span-5">
            <div className="relative aspect-[4/5] bg-gray-50 rounded-[1.5rem] md:rounded-[2.5rem] overflow-hidden shadow-inner border border-gray-100 flex items-center justify-center group">
              <img src={product.image} alt={product.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
              <div className="absolute top-4 left-4 bg-red-600 text-white px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest italic shadow-lg">-25% OFF</div>
              <div className="absolute bottom-4 left-4 bg-black/70 backdrop-blur-md text-white px-3 py-1.5 rounded-full flex items-center space-x-2 border border-white/10">
                 <span className="flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-1.5 w-1.5 rounded-full bg-green-400 opacity-75"></span><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500"></span></span>
                 <span className="text-[9px] font-black uppercase tracking-widest">{viewers} People Watching</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 flex flex-col justify-center">
            <div className="mb-2">
               <span className="text-blue-600 text-[9px] font-black uppercase tracking-widest italic">{product.category}</span>
               <h1 className="text-2xl md:text-5xl lg:text-7xl font-serif font-bold italic uppercase leading-tight mt-1 italic text-black">{product.name}</h1>
            </div>
            
            <div className="flex items-center space-x-4 mb-6">
              <div className="flex flex-col"><span className="text-2xl md:text-4xl font-black italic text-black">Rs. {currentPrice.toLocaleString()}</span><span className="text-[10px] text-gray-400 line-through font-bold italic">Rs. {(currentPrice / 0.75).toLocaleString()}</span></div>
              <span className="text-[9px] font-black text-green-600 bg-green-50 px-3 py-1.5 rounded-full uppercase italic border border-green-100">Free COD Express</span>
            </div>

            <div className="mb-4 space-y-2">
              <div className="flex justify-between items-end">
                <p className="text-[10px] font-black uppercase tracking-widest text-red-600 italic">
                  <i className="fas fa-fire mr-1"></i> Hurry! Only {unitsLeft} units left in stock
                </p>
                <p className="text-[9px] font-bold text-gray-400 uppercase italic">Limited Availability</p>
              </div>
              <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-red-600 transition-all duration-1000" 
                  style={{ width: `${(unitsLeft / 20) * 100}%` }}
                ></div>
              </div>
            </div>

            {/* HAPPY CUSTOMERS CLUSTER - UPON COD BUTTON */}
            <div className="mb-6 pt-2 flex flex-col items-center sm:items-start">
               <div className="flex -space-x-3 mb-3">
                  <img className="inline-block h-10 w-10 rounded-full ring-4 ring-white object-cover" src="https://images.unsplash.com/photo-1614283233556-f35b0c801ef1?q=80&w=100&auto=format&fit=crop" alt="User 1" />
                  <img className="inline-block h-10 w-10 rounded-full ring-4 ring-white object-cover" src="https://images.unsplash.com/photo-1589156280159-27698a70f29e?q=80&w=100&auto=format&fit=crop" alt="User 2" />
                  <img className="inline-block h-10 w-10 rounded-full ring-4 ring-white object-cover" src="https://images.unsplash.com/photo-1628157588553-5eeea00af15c?q=80&w=100&auto=format&fit=crop" alt="User 3" />
                  <img className="inline-block h-10 w-10 rounded-full ring-4 ring-white object-cover" src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=100&auto=format&fit=crop" alt="User 4" />
                  <div className="h-10 w-10 rounded-full ring-4 ring-white bg-black flex items-center justify-center text-[10px] font-black text-white">+82</div>
               </div>
               <div className="text-center sm:text-left">
                  <div className="flex justify-center sm:justify-start text-yellow-500 mb-1 space-x-0.5">
                    <i className="fas fa-star text-[10px]"></i>
                    <i className="fas fa-star text-[10px]"></i>
                    <i className="fas fa-star text-[10px]"></i>
                    <i className="fas fa-star text-[10px]"></i>
                    <i className="fas fa-star text-[10px]"></i>
                  </div>
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-black italic">10,000+ Happy Customers & Growing</p>
               </div>
            </div>

            <div className="mb-4">
              <button onClick={() => setIsOrderPortalActive(true)} className="w-full bg-black text-white font-black text-[12px] md:text-[14px] uppercase tracking-[0.2em] py-5 px-10 rounded-xl hover:bg-blue-600 transition shadow-2xl active:scale-95 italic animate-attention animate-pulse-red">ORDER NOW - CASH ON DELIVERY <i className="fas fa-arrow-right ml-2 text-xs"></i></button>
            </div>

            {/* DESCRIPTION - DOWN FROM COD BUTTON */}
            <div className="mb-8 max-w-xl">
               <p className="text-sm text-gray-700 leading-relaxed italic font-medium border-l-2 border-black/10 pl-4">{product.description}</p>
            </div>

            <div className="mb-10 bg-blue-50 border border-blue-100 p-4 rounded-2xl text-center sm:text-left">
              <p className="text-[10px] font-black uppercase text-blue-800 tracking-[0.2em] italic">
                <i className="fas fa-truck-fast mr-2"></i> Free Express Shipping Nationwide
              </p>
              <p className="text-[9px] font-bold text-blue-400 uppercase tracking-widest mt-1">Authentic Premium Quality Guaranteed</p>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-gray-100 pt-8">
              {TRUST_BADGES.map((badge, idx) => (
                <div key={idx} className="flex items-center space-x-2">
                  <div className="w-8 h-8 md:w-12 md:h-12 flex items-center justify-center bg-gray-50 rounded-lg text-blue-600 border border-gray-100"><i className={`fas ${badge.icon} text-sm md:text-lg`}></i></div>
                  <span className="text-[8px] md:text-[9px] font-black uppercase tracking-widest text-gray-500 italic leading-tight">{badge.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetail;
