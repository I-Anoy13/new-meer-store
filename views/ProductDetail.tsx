
import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Product, Order } from '../types';
import { TRUST_BADGES, PLACEHOLDER_IMAGE } from '../constants';

interface ProductDetailProps {
  products: Product[];
  addToCart: (product: Product, quantity: number, variantId?: string) => void;
  placeOrder: (order: Order) => Promise<boolean>;
}

const NAMES = ['Ahmed', 'Fatima', 'Zaid', 'Aisha', 'Bilal', 'Maryam', 'Omar', 'Zainab', 'Hamza', 'Sara', 'Usman', 'Hiba', 'Mustafa', 'Noor', 'Raza', 'Sana'];
const CITIES = ['Karachi', 'Lahore', 'Islamabad', 'Faisalabad', 'Rawalpindi', 'Multan', 'Quetta', 'Peshawar', 'Sialkot', 'Gujranwala'];

const ProductDetail: React.FC<ProductDetailProps> = ({ products, addToCart, placeOrder }) => {
  const { id } = useParams<{ id: string }>();
  const galleryRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  const product = products.find(p => p.id === id);
  const productImages = product?.images && product.images.length > 0 ? product.images : [product?.image || PLACEHOLDER_IMAGE];

  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [selectedVariant, setSelectedVariant] = useState(product?.variants?.[0]?.id || '');
  const [quantity, setQuantity] = useState(1);
  const [isOrderPortalActive, setIsOrderPortalActive] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<{ id: string } | null>(null);
  const [viewers, setViewers] = useState(25 + Math.floor(Math.random() * 15));
  const [purchaseNotification, setPurchaseNotification] = useState<{name: string, city: string} | null>(null);
  const [unitsLeft, setUnitsLeft] = useState(14);

  useEffect(() => {
    // Viewer simulation
    const vInterval = setInterval(() => {
      setViewers(prev => {
        const next = prev + (Math.random() > 0.5 ? 1 : -1);
        return next < 20 ? 20 : next > 45 ? 45 : next;
      });
    }, 4000);

    // Stock simulation - slow decrease for realism
    const stockInterval = setInterval(() => {
      setUnitsLeft(prev => (prev > 2 ? prev - (Math.random() > 0.95 ? 1 : 0) : prev));
    }, 20000);

    // 5-second purchase notification interval as requested
    const notifyInterval = setInterval(() => {
      const name = NAMES[Math.floor(Math.random() * NAMES.length)];
      const city = CITIES[Math.floor(Math.random() * CITIES.length)];
      setPurchaseNotification({ name, city });
      // Keep visible for a decent amount of time within the 5s window
      setTimeout(() => setPurchaseNotification(null), 3800);
    }, 5000);

    return () => {
      clearInterval(vInterval);
      clearInterval(stockInterval);
      clearInterval(notifyInterval);
    };
  }, []);

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
      <div className="container mx-auto px-4 py-32 text-center font-sans">
        <h2 className="text-2xl font-bold">Product Not Found</h2>
        <Link to="/" className="text-blue-600 mt-4 inline-block font-semibold hover:underline">Return to Home</Link>
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

  const scrollToImage = (idx: number) => {
    setActiveImageIdx(idx);
    if (galleryRef.current) {
      const width = galleryRef.current.offsetWidth;
      galleryRef.current.scrollTo({ left: width * idx, behavior: 'smooth' });
    }
  };

  if (isOrderPortalActive) {
    return (
      <div className="fixed inset-0 bg-white z-[100] flex flex-col animate-fadeIn overflow-hidden font-sans">
        <div className="bg-black text-white py-4 px-6 sticky top-0 z-50 flex justify-between items-center">
          <p className="text-xs font-bold uppercase tracking-wider">Secure Checkout — Cash On Delivery</p>
          <button onClick={() => setIsOrderPortalActive(false)} className="text-white/60 hover:text-white uppercase text-xs font-bold">
            Close <i className="fas fa-times ml-1"></i>
          </button>
        </div>

        <div className="flex-grow overflow-y-auto pb-12">
          <div className="container mx-auto px-6 py-8 max-w-md">
            {!orderSuccess ? (
              <>
                <div className="mb-8 text-center">
                  <h1 className="text-2xl font-bold uppercase tracking-tight text-black">Order Details</h1>
                  <p className="text-gray-500 text-xs mt-2 uppercase font-semibold">Fast delivery across Pakistan</p>
                </div>

                <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 flex items-center space-x-4 mb-8">
                  <img src={product.image} className="w-20 h-20 rounded-xl object-cover border shadow-sm" />
                  <div className="flex-grow min-w-0">
                    <h3 className="text-sm font-bold text-black truncate uppercase">{product.name}</h3>
                    <p className="text-black font-black text-lg mt-1">Rs. {currentPrice.toLocaleString()}</p>
                  </div>
                </div>

                <form onSubmit={handleQuickOrder} className="space-y-4">
                  <input required type="text" className="w-full bg-white border border-gray-200 rounded-xl px-5 py-4 font-semibold outline-none focus:border-black" placeholder="Your Full Name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                  <input required type="tel" className="w-full bg-white border border-gray-200 rounded-xl px-5 py-4 font-semibold outline-none focus:border-black" placeholder="Phone Number (03XXXXXXXXX)" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                  <input required type="text" className="w-full bg-white border border-gray-200 rounded-xl px-5 py-4 font-semibold outline-none focus:border-black" placeholder="City" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} />
                  <textarea required className="w-full bg-white border border-gray-200 rounded-xl px-5 py-4 font-semibold outline-none h-32 resize-none leading-relaxed" placeholder="Complete Delivery Address" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
                  <button type="submit" disabled={isSubmitting} className="w-full bg-black text-white font-black uppercase py-5 rounded-xl hover:bg-blue-600 transition shadow-lg text-sm italic animate-pulse-red">
                    {isSubmitting ? <i className="fas fa-circle-notch fa-spin"></i> : `ORDER NOW - Rs. ${currentPrice.toLocaleString()}`}
                  </button>
                </form>
              </>
            ) : (
              <div className="text-center py-20 animate-fadeIn">
                <div className="w-20 h-20 bg-green-500 text-white rounded-full flex items-center justify-center mx-auto mb-6 text-3xl">
                  <i className="fas fa-check"></i>
                </div>
                <h2 className="text-3xl font-bold mb-2 text-black">Order Placed!</h2>
                <p className="text-gray-500 mb-8">Your Order ID is #{orderSuccess.id}</p>
                <button onClick={() => { setIsOrderPortalActive(false); setOrderSuccess(null); }} className="w-full bg-black text-white font-bold uppercase py-5 rounded-xl">Back to Shop</button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white animate-fadeIn pb-24 lg:pb-0 relative text-black overflow-x-hidden font-sans">
      <div className="bg-red-600 text-white py-2 text-center sticky top-16 z-50">
        <span className="text-[10px] font-bold uppercase tracking-wider">OFFER EXPIRES IN: {formatTime(timeLeft)}</span>
      </div>

      <div className="container mx-auto px-4 md:px-6 py-6 lg:py-16 relative">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          {/* Left Column: Image Gallery & Notification Area */}
          <div className="lg:col-span-6">
            <div className="relative aspect-square bg-gray-50 rounded-[2rem] overflow-hidden border border-gray-100 shadow-xl">
              <div 
                ref={galleryRef}
                className="flex w-full h-full overflow-x-auto snap-x snap-mandatory no-scrollbar"
                onScroll={(e) => {
                  const target = e.currentTarget;
                  const idx = Math.round(target.scrollLeft / target.offsetWidth);
                  if (idx !== activeImageIdx) setActiveImageIdx(idx);
                }}
              >
                {productImages.map((img, i) => (
                  <div key={i} className="w-full h-full shrink-0 snap-center">
                    <img src={img} alt={`${product.name} ${i}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>

              {/* Mobile Slide Indicator Dots */}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex space-x-2">
                {productImages.map((_, i) => (
                  <div key={i} className={`w-2 h-2 rounded-full transition-all duration-300 ${activeImageIdx === i ? 'bg-black w-6' : 'bg-black/20'}`}></div>
                ))}
              </div>
            </div>
            
            {/* Small Images (Thumbnails) */}
            <div className="flex gap-3 overflow-x-auto no-scrollbar py-4 px-2">
              {productImages.map((img, idx) => (
                <button key={idx} onClick={() => scrollToImage(idx)} className={`w-16 h-16 rounded-xl overflow-hidden border-2 shrink-0 transition-all shadow-sm ${activeImageIdx === idx ? 'border-black scale-105 shadow-lg' : 'border-gray-100'}`}>
                  <img src={img} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>

            {/* In-Place Purchase Popup (Beneath Main Product Pictures) */}
            <div className="mt-2 animate-fadeIn min-h-[80px]">
              {purchaseNotification ? (
                <div className="bg-white border border-gray-100 p-5 rounded-[1.5rem] flex items-center space-x-4 animate-slideInLeft shadow-2xl shadow-green-500/5 ring-1 ring-gray-50">
                  <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center text-white shrink-0 shadow-lg">
                    <i className="fas fa-check-circle text-lg"></i>
                  </div>
                  <div>
                    <p className="text-[12px] font-black leading-tight uppercase tracking-tight">
                      <span className="text-black">{purchaseNotification.name}</span> from <span className="text-blue-600">{purchaseNotification.city}</span>
                    </p>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.1em] mt-1 italic">Verified Purchase Confirmed!</p>
                  </div>
                </div>
              ) : (
                <div className="p-5 rounded-[1.5rem] border-2 border-dashed border-gray-100 flex items-center justify-center bg-gray-50/30">
                  <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest flex items-center">
                    <i className="fas fa-shield-alt mr-2"></i> Verified by ITX Secure Checkout
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Product Info & Purchase Button */}
          <div className="lg:col-span-6 flex flex-col justify-center">
            <h1 className="text-4xl lg:text-6xl font-black leading-none text-black uppercase tracking-tighter mb-4">{product.name}</h1>
            
            <div className="flex items-center space-x-6 mb-8">
              <span className="text-4xl lg:text-5xl font-black italic text-black tracking-tighter">Rs. {currentPrice.toLocaleString()}</span>
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-green-600 bg-green-50 px-4 py-1.5 rounded-full border border-green-100 uppercase tracking-[0.2em] shadow-sm">FREE DELIVERY</span>
              </div>
            </div>

            <div className="mb-8 bg-gray-50 p-6 rounded-3xl border border-gray-100">
              <p className="text-[10px] font-black text-red-600 mb-3 uppercase tracking-[0.2em] flex items-center">
                <i className="fas fa-fire mr-2 animate-bounce"></i> Hurry! Only {unitsLeft} units remaining
              </p>
              <div className="w-full h-3 bg-white rounded-full p-0.5 border border-gray-100">
                <div className="h-full bg-red-600 rounded-full transition-all duration-1000 shadow-sm" style={{ width: `${(unitsLeft / 14) * 100}%` }}></div>
              </div>
            </div>

            {/* Live Visitors Count - Prominently over the Order Button */}
            <div className="mb-3 flex items-center space-x-2 pl-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600"></span>
              </span>
              <span className="text-[11px] font-black text-black uppercase tracking-widest">{viewers} people are viewing this product right now</span>
            </div>

            <button 
              onClick={() => setIsOrderPortalActive(true)} 
              className="w-full bg-black text-white font-black text-lg md:text-xl uppercase tracking-[0.15em] py-8 px-10 rounded-[2rem] hover:bg-blue-600 transition-all duration-500 shadow-2xl active:scale-[0.98] italic animate-pulse-red relative group overflow-hidden"
            >
              <span className="relative z-10">ORDER NOW - CASH ON DELIVERY</span>
              <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity"></div>
            </button>

            {/* Customer Avatars Section */}
            <div className="mt-8 flex flex-col items-center p-8 bg-white rounded-3xl border border-gray-100 shadow-sm">
                <div className="flex -space-x-4 mb-5">
                  <img className="inline-block h-12 w-12 rounded-full ring-4 ring-white object-cover shadow-md" src="https://images.unsplash.com/photo-1614283233556-f35b0c801ef1?q=80&w=150&auto=format&fit=crop" alt="Cust 1" />
                  <img className="inline-block h-12 w-12 rounded-full ring-4 ring-white object-cover shadow-md" src="https://images.unsplash.com/photo-1589156280159-27698a70f29e?q=80&w=150&auto=format&fit=crop" alt="Cust 2" />
                  <img className="inline-block h-12 w-12 rounded-full ring-4 ring-white object-cover shadow-md" src="https://images.unsplash.com/photo-1628157588553-5eeea00af15c?q=80&w=150&auto=format&fit=crop" alt="Cust 3" />
                  <img className="inline-block h-12 w-12 rounded-full ring-4 ring-white object-cover shadow-md" src="https://images.unsplash.com/photo-1594744803329-e58b31de8bf5?q=80&w=150&auto=format&fit=crop" alt="Cust 4" />
                  <img className="inline-block h-12 w-12 rounded-full ring-4 ring-white object-cover shadow-md" src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=150&auto=format&fit=crop" alt="Cust 5" />
                  <div className="h-12 w-12 rounded-full ring-4 ring-white bg-black flex items-center justify-center text-[11px] font-black text-white shadow-md uppercase">+12k</div>
                </div>
                <div className="text-center">
                  <p className="text-[12px] font-black uppercase tracking-[0.25em] text-black italic mb-2 underline decoration-blue-600 decoration-2 underline-offset-4">10,000+ Verified Happy Customers</p>
                  <div className="flex justify-center text-yellow-400 space-x-1">
                    <i className="fas fa-star"></i>
                    <i className="fas fa-star"></i>
                    <i className="fas fa-star"></i>
                    <i className="fas fa-star"></i>
                    <i className="fas fa-star"></i>
                  </div>
                </div>
            </div>

            {/* Description Section - Not shrunken (whitespace-pre-wrap) */}
            <div className="my-12">
               <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-400 mb-6 flex items-center">
                 <span className="w-8 h-[1px] bg-gray-200 mr-4"></span> CRAFTSMANSHIP NOTES
               </h3>
               <p className="text-lg text-gray-700 leading-relaxed font-medium italic border-l-4 border-black pl-8 whitespace-pre-wrap">
                 {product.description}
               </p>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-gray-100 pt-10">
              {TRUST_BADGES.map((badge, idx) => (
                <div key={idx} className="flex items-center space-x-3 group">
                  <div className="w-12 h-12 flex items-center justify-center bg-gray-50 rounded-2xl text-blue-600 shadow-inner group-hover:scale-110 transition-transform duration-300">
                    <i className={`fas ${badge.icon} text-lg`}></i>
                  </div>
                  <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest leading-tight">{badge.text}</span>
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
