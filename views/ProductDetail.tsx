
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

// Reliable High-Quality Person Photos for Social Proof
const CUSTOMER_DPS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=150&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=150&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=150&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=150&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?q=80&w=150&auto=format&fit=crop"
];

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
    const vInterval = setInterval(() => {
      setViewers(prev => {
        const next = prev + (Math.random() > 0.5 ? 1 : -1);
        return next < 20 ? 20 : next > 45 ? 45 : next;
      });
    }, 4000);

    const stockInterval = setInterval(() => {
      setUnitsLeft(prev => (prev > 2 ? prev - (Math.random() > 0.95 ? 1 : 0) : prev));
    }, 20000);

    const notifyInterval = setInterval(() => {
      const name = NAMES[Math.floor(Math.random() * NAMES.length)];
      const city = CITIES[Math.floor(Math.random() * CITIES.length)];
      setPurchaseNotification({ name, city });
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
        <h2 className="text-xl font-bold">Product Not Found</h2>
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
          <p className="text-[10px] font-bold uppercase tracking-widest">Secure Checkout — Cash On Delivery</p>
          <button onClick={() => setIsOrderPortalActive(false)} className="text-white/60 hover:text-white uppercase text-[10px] font-bold">
            Close <i className="fas fa-times ml-1"></i>
          </button>
        </div>

        <div className="flex-grow overflow-y-auto pb-12">
          <div className="container mx-auto px-6 py-8 max-w-md">
            {!orderSuccess ? (
              <>
                <div className="mb-8 text-center">
                  <h1 className="text-xl font-bold uppercase tracking-tight text-black">Order Details</h1>
                  <p className="text-gray-500 text-[10px] mt-2 uppercase font-semibold tracking-wider">Fast delivery across Pakistan</p>
                </div>

                <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 flex items-center space-x-4 mb-8">
                  <img src={product.image} className="w-16 h-16 rounded-xl object-cover border shadow-sm" />
                  <div className="flex-grow min-w-0">
                    <h3 className="text-xs font-bold text-black truncate uppercase tracking-tight">{product.name}</h3>
                    <p className="text-black font-bold text-base mt-1">Rs. {currentPrice.toLocaleString()}</p>
                  </div>
                </div>

                <form onSubmit={handleQuickOrder} className="space-y-4">
                  <input required type="text" className="w-full bg-white border border-gray-200 rounded-xl px-5 py-3 font-semibold text-sm outline-none focus:border-black" placeholder="Your Full Name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                  <input required type="tel" className="w-full bg-white border border-gray-200 rounded-xl px-5 py-3 font-semibold text-sm outline-none focus:border-black" placeholder="Phone Number (03XXXXXXXXX)" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                  <input required type="text" className="w-full bg-white border border-gray-200 rounded-xl px-5 py-3 font-semibold text-sm outline-none focus:border-black" placeholder="City" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} />
                  <textarea required className="w-full bg-white border border-gray-200 rounded-xl px-5 py-3 font-semibold text-sm outline-none h-24 resize-none leading-relaxed" placeholder="Complete Delivery Address" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
                  <button type="submit" disabled={isSubmitting} className="w-full bg-black text-white font-bold uppercase py-4 rounded-xl hover:bg-blue-600 transition shadow-lg text-xs tracking-wider animate-pulse-red">
                    {isSubmitting ? <i className="fas fa-circle-notch fa-spin"></i> : `ORDER NOW - Rs. ${currentPrice.toLocaleString()}`}
                  </button>
                </form>
              </>
            ) : (
              <div className="text-center py-20 animate-fadeIn">
                <div className="w-16 h-16 bg-green-500 text-white rounded-full flex items-center justify-center mx-auto mb-6 text-2xl">
                  <i className="fas fa-check"></i>
                </div>
                <h2 className="text-2xl font-bold mb-2 text-black">Order Placed!</h2>
                <p className="text-gray-500 text-sm mb-8">Your Order ID is #{orderSuccess.id}</p>
                <button onClick={() => { setIsOrderPortalActive(false); setOrderSuccess(null); }} className="w-full bg-black text-white font-bold uppercase py-4 rounded-xl text-xs tracking-widest">Back to Shop</button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white animate-fadeIn pb-24 lg:pb-0 relative text-black overflow-x-hidden font-sans">
      <div className="bg-red-600 text-white py-1.5 text-center sticky top-16 z-50">
        <span className="text-[9px] font-bold uppercase tracking-[0.2em]">OFFER EXPIRES IN: {formatTime(timeLeft)}</span>
      </div>

      <div className="container mx-auto px-4 md:px-6 py-6 lg:py-12 relative">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          {/* Left Column: Image Gallery */}
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

              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex space-x-2">
                {productImages.map((_, i) => (
                  <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${activeImageIdx === i ? 'bg-black w-4' : 'bg-black/20'}`}></div>
                ))}
              </div>
            </div>
            
            <div className="flex gap-3 overflow-x-auto no-scrollbar py-4 px-2">
              {productImages.map((img, idx) => (
                <button key={idx} onClick={() => scrollToImage(idx)} className={`w-14 h-14 rounded-xl overflow-hidden border-2 shrink-0 transition-all shadow-sm ${activeImageIdx === idx ? 'border-black scale-105 shadow-md' : 'border-gray-100'}`}>
                  <img src={img} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>

            <div className="mt-2 animate-fadeIn min-h-[70px]">
              {purchaseNotification ? (
                <div className="bg-white border border-gray-100 p-4 rounded-2xl flex items-center space-x-3 animate-slideInLeft shadow-xl ring-1 ring-gray-50">
                  <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white shrink-0 shadow-md">
                    <i className="fas fa-check-circle text-base"></i>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold leading-tight uppercase tracking-tight">
                      <span className="text-black">{purchaseNotification.name}</span> from <span className="text-blue-600">{purchaseNotification.city}</span>
                    </p>
                    <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest mt-1">Verified Purchase Confirmed!</p>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-2xl border-2 border-dashed border-gray-100 flex items-center justify-center bg-gray-50/30">
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest flex items-center">
                    <i className="fas fa-shield-alt mr-2 text-xs"></i> Verified by ITX Secure Checkout
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Product Info */}
          <div className="lg:col-span-6 flex flex-col justify-center">
            <h1 className="text-2xl lg:text-3xl font-bold leading-tight text-black uppercase tracking-tight mb-4">{product.name}</h1>
            
            <div className="flex items-center space-x-4 mb-8">
              <span className="text-2xl lg:text-3xl font-bold text-black tracking-tight">Rs. {currentPrice.toLocaleString()}</span>
              <span className="text-[9px] font-bold text-green-600 bg-green-50 px-3 py-1 rounded-full border border-green-100 uppercase tracking-widest shadow-sm">FREE DELIVERY</span>
            </div>

            <div className="mb-8 bg-gray-50 p-5 rounded-2xl border border-gray-100">
              <p className="text-[9px] font-bold text-red-600 mb-2 uppercase tracking-widest flex items-center">
                <i className="fas fa-fire mr-2 animate-bounce"></i> Hurry! Only {unitsLeft} units remaining
              </p>
              <div className="w-full h-2 bg-white rounded-full p-0.5 border border-gray-100">
                <div className="h-full bg-red-600 rounded-full transition-all duration-1000 shadow-sm" style={{ width: `${(unitsLeft / 14) * 100}%` }}></div>
              </div>
            </div>

            <div className="mb-3 flex items-center space-x-2 pl-1">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-600"></span>
              </span>
              <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">{viewers} people viewing now</span>
            </div>

            <button 
              onClick={() => setIsOrderPortalActive(true)} 
              className="w-full bg-black text-white font-bold text-sm md:text-base uppercase tracking-widest py-5 rounded-2xl hover:bg-blue-600 transition-all duration-500 shadow-xl active:scale-[0.98] animate-pulse-red group relative overflow-hidden"
            >
              <span className="relative z-10">ORDER NOW - CASH ON DELIVERY</span>
            </button>

            {/* Happy Customers with Fixed Reliable DPs */}
            <div className="mt-8 flex flex-col items-center p-6 bg-white rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex -space-x-3 mb-4">
                  {CUSTOMER_DPS.map((url, i) => (
                    <img key={i} className="inline-block h-10 w-10 rounded-full ring-2 ring-white object-cover shadow-sm" src={url} alt={`Verified Customer ${i + 1}`} />
                  ))}
                  <div className="h-10 w-10 rounded-full ring-2 ring-white bg-black flex items-center justify-center text-[9px] font-bold text-white shadow-sm uppercase">+12k</div>
                </div>
                <div className="text-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-black mb-1.5">10,000+ Happy Customers</p>
                  <div className="flex justify-center text-yellow-400 space-x-0.5 text-xs">
                    <i className="fas fa-star"></i>
                    <i className="fas fa-star"></i>
                    <i className="fas fa-star"></i>
                    <i className="fas fa-star"></i>
                    <i className="fas fa-star"></i>
                  </div>
                </div>
            </div>

            <div className="my-10">
               <h3 className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-4 flex items-center">
                 <span className="w-6 h-[1px] bg-gray-200 mr-3"></span> Product Details
               </h3>
               <p className="text-sm text-gray-700 leading-relaxed font-medium italic border-l-2 border-black pl-5 whitespace-pre-wrap">
                 {product.description}
               </p>
            </div>

            <div className="grid grid-cols-2 gap-3 border-t border-gray-100 pt-8">
              {TRUST_BADGES.map((badge, idx) => (
                <div key={idx} className="flex items-center space-x-3 group">
                  <div className="w-10 h-10 flex items-center justify-center bg-gray-50 rounded-xl text-blue-600 shadow-inner group-hover:scale-105 transition-transform">
                    <i className={`fas ${badge.icon} text-sm`}></i>
                  </div>
                  <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest leading-tight">{badge.text}</span>
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
