
import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Product, Order } from '../types';
import { TRUST_BADGES, PLACEHOLDER_IMAGE } from '../constants';

interface ProductDetailProps {
  products: Product[];
  addToCart: (product: Product, quantity: number, variantId?: string) => void;
  placeOrder: (order: Order) => Promise<boolean>;
}

const MUSLIM_NAMES = ['Ahmed', 'Fatima', 'Zaid', 'Aisha', 'Bilal', 'Maryam', 'Omar', 'Zainab', 'Hamza', 'Sara', 'Usman', 'Hiba', 'Mustafa', 'Noor'];
const PAKISTAN_CITIES = ['Karachi', 'Lahore', 'Islamabad', 'Faisalabad', 'Rawalpindi', 'Multan', 'Quetta', 'Peshawar', 'Sialkot', 'Gujranwala'];

const ProductDetail: React.FC<ProductDetailProps> = ({ products, addToCart, placeOrder }) => {
  const { id } = useParams<{ id: string }>();
  const product = products.find(p => p.id === id);
  const [selectedVariant, setSelectedVariant] = useState(product?.variants?.[0]?.id || '');
  const [quantity, setQuantity] = useState(1);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<{ id: string } | null>(null);
  const modalScrollRef = useRef<HTMLDivElement>(null);

  // Ensure customer starts at the top of the page on landing
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [id]);

  // Reset modal scroll on open
  useEffect(() => {
    if (isOrderModalOpen && modalScrollRef.current) {
      modalScrollRef.current.scrollTop = 0;
    }
  }, [isOrderModalOpen]);

  // Fake Live Viewers - small figure 18-23 with green indicator
  const [viewers, setViewers] = useState(18 + Math.floor(Math.random() * 6));
  useEffect(() => {
    const interval = setInterval(() => {
      setViewers(prev => {
        const change = Math.random() > 0.5 ? 1 : -1;
        const next = prev + change;
        if (next < 18) return 18;
        if (next > 23) return 23;
        return next;
      });
    }, 4500);
    return () => clearInterval(interval);
  }, []);

  // Flash Sale Timer
  const [timeLeft, setTimeLeft] = useState(3600 + Math.floor(Math.random() * 3600));
  useEffect(() => {
    const timer = setInterval(() => setTimeLeft(prev => (prev > 0 ? prev - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Fake Purchase Notification - FIXED POSITION for visibility anywhere on the page
  const [purchaseNotice, setPurchaseNotice] = useState<{ name: string, city: string } | null>(null);
  const [showPurchaseNotice, setShowPurchaseNotice] = useState(false);

  useEffect(() => {
    const triggerNotice = () => {
      const name = MUSLIM_NAMES[Math.floor(Math.random() * MUSLIM_NAMES.length)];
      const city = PAKISTAN_CITIES[Math.floor(Math.random() * PAKISTAN_CITIES.length)];
      setPurchaseNotice({ name, city });
      setShowPurchaseNotice(true);
      setTimeout(() => setShowPurchaseNotice(false), 5000);
    };
    const initialDelay = setTimeout(triggerNotice, 3000);
    const interval = setInterval(triggerNotice, 25000);
    return () => { clearTimeout(initialDelay); clearInterval(interval); };
  }, []);

  // Professional Body Scroll Lock when modal is open
  useEffect(() => {
    if (isOrderModalOpen) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = 'unset'; };
    }
  }, [isOrderModalOpen]);

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    e.currentTarget.src = PLACEHOLDER_IMAGE;
  };

  const [formData, setFormData] = useState({ name: '', phone: '', city: '', address: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!product) {
    return (
      <div className="container mx-auto px-4 py-32 text-center text-black">
        <h2 className="text-3xl font-serif font-bold italic uppercase tracking-tighter text-black">Piece Not Found</h2>
        <Link to="/" className="text-blue-600 mt-6 inline-block font-black uppercase text-[10px] tracking-widest hover:underline italic">Return to Collection</Link>
      </div>
    );
  }

  const variantObj = product.variants?.find(v => v.id === selectedVariant);
  const currentPrice = variantObj?.price || product.price;
  const variantName = variantObj?.name || "Standard Edition";

  const handleQuickOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const timestamp = Date.now().toString().slice(-6);
    const newOrderId = `ORD-${timestamp}`;
    const newOrder: Order = {
      id: newOrderId,
      items: [{ product, quantity, variantId: selectedVariant, variantName }],
      total: currentPrice * quantity,
      status: 'Pending',
      customer: { name: formData.name, email: '', phone: formData.phone, address: formData.address, city: formData.city },
      date: new Date().toISOString()
    };
    const success = await placeOrder(newOrder);
    if (success) setOrderSuccess({ id: newOrderId });
    setIsSubmitting(false);
  };

  return (
    <div className="bg-white animate-fadeIn pb-24 lg:pb-0 relative text-black overflow-x-hidden">
      {/* 1st Sight: Flash Sale Sticky Banner */}
      <div className="bg-red-600 text-white py-2 text-center sticky top-16 z-50 shadow-md">
        <div className="container mx-auto px-4 flex items-center justify-center space-x-2 md:space-x-6">
          <span className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] animate-pulse">FLASH SALE — 25% DISCOUNT RESERVED</span>
          <div className="h-3 w-px bg-white/30"></div>
          <span className="text-[10px] md:text-xs font-mono font-bold tracking-widest uppercase">ENDS: {formatTime(timeLeft)}</span>
        </div>
      </div>

      <div className="container mx-auto px-4 md:px-6 py-4 lg:py-16 relative">
        {/* Fixed Purchase Popup - Always visible on scroll */}
        <div className={`fixed bottom-24 left-4 right-4 md:left-auto md:right-8 z-[100] transition-all duration-700 transform ${showPurchaseNotice ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0 pointer-events-none'}`}>
          <div className="bg-white/95 backdrop-blur-xl border border-blue-100 p-4 rounded-2xl shadow-2xl flex items-center space-x-3 mx-auto max-w-[320px]">
            <div className="w-10 h-10 bg-green-500 text-white rounded-full flex items-center justify-center shrink-0 animate-bounce shadow-md"><i className="fas fa-check-circle text-sm"></i></div>
            <div>
              <p className="text-[8px] font-black uppercase tracking-[0.2em] text-blue-600 mb-0.5 italic">Live Acquisition</p>
              <p className="text-[10px] font-bold text-black leading-tight italic">
                {purchaseNotice?.name} from {purchaseNotice?.city}<br/>
                <span className="text-gray-400 font-normal">just ordered this masterpiece</span>
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-16">
          {/* 1st Sight: Prominent Product Image */}
          <div className="lg:col-span-5">
            <div className="relative aspect-[4/5] bg-gray-50 rounded-[1.5rem] md:rounded-[2.5rem] overflow-hidden shadow-inner border border-gray-100 flex items-center justify-center group">
              <img src={product.image} alt={product.name} onError={handleImageError} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
              <div className="absolute top-4 left-4 bg-red-600 text-white px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest italic shadow-lg">-25% OFF</div>
              
              {/* Live Viewers Indicator - Small & Green */}
              <div className="absolute bottom-4 left-4 bg-black/70 backdrop-blur-md text-white px-3 py-1.5 rounded-full flex items-center space-x-2 border border-white/10">
                 <span className="flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-1.5 w-1.5 rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500"></span>
                 </span>
                 <span className="text-[9px] font-black uppercase tracking-widest">{viewers} Live Viewers</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 flex flex-col justify-center">
            <div className="mb-2">
               <span className="text-blue-600 text-[9px] font-black uppercase tracking-widest italic">{product.category}</span>
               <h1 className="text-2xl md:text-5xl lg:text-7xl font-serif font-bold italic uppercase leading-tight mt-1 italic text-black">{product.name}</h1>
            </div>

            <div className="flex items-center space-x-4 mb-6">
              <div className="flex flex-col">
                <span className="text-2xl md:text-4xl font-black italic text-black">Rs. {currentPrice.toLocaleString()}</span>
                <span className="text-[10px] text-gray-400 line-through font-bold italic">Rs. {(currentPrice / 0.75).toLocaleString()}</span>
              </div>
              <span className="text-[9px] font-black text-green-600 bg-green-50 px-3 py-1.5 rounded-full uppercase italic border border-green-100">Free COD Express</span>
            </div>

            {/* Happy Customer Social Proof */}
            <div className="mb-6 p-4 bg-gray-50 rounded-2xl border border-gray-100 border-dashed">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="flex -space-x-2">
                    {[1, 2, 3].map(i => (
                      <img key={i} className="inline-block h-8 w-8 rounded-full ring-2 ring-white object-cover" src={`https://i.pravatar.cc/150?u=${i + 70}`} alt="client" />
                    ))}
                    <div className="h-8 w-8 rounded-full ring-2 ring-white bg-black flex items-center justify-center text-[8px] font-black text-white">+18k</div>
                  </div>
                  <div className="hidden sm:block">
                    <div className="flex text-yellow-500 space-x-0.5">
                        {[1, 2, 3, 4, 5].map(i => <i key={i} className="fas fa-star text-[7px]"></i>)}
                    </div>
                    <p className="text-[8px] font-black uppercase tracking-widest text-gray-400 italic">10,000+ Happy Customers</p>
                  </div>
                </div>
                <div className="text-right">
                   <p className="text-[9px] font-black uppercase text-blue-600 italic leading-none">Verified Horology</p>
                   <p className="text-[8px] font-bold text-gray-400 uppercase mt-0.5">Pakistan's Choice</p>
                </div>
              </div>
            </div>

            <p className="text-gray-600 text-sm md:text-lg leading-relaxed mb-6 italic">{product.description}</p>

            {/* Shaking COD Button */}
            <div className="mb-8">
              <button onClick={() => setIsOrderModalOpen(true)} className="w-full bg-black text-white font-black text-[12px] md:text-[14px] uppercase tracking-[0.2em] py-5 px-10 rounded-xl hover:bg-blue-600 transition shadow-2xl active:scale-95 italic animate-attention animate-pulse-red">
                Order Cash On Delivery <i className="fas fa-arrow-right ml-2 text-xs"></i>
              </button>
              <p className="text-[8px] text-center font-black uppercase text-gray-400 tracking-[0.3em] mt-3 italic">Payment strictly upon receipt of parcel</p>
            </div>

            {/* Editions Selection */}
            {product.variants && product.variants.length > 0 && (
              <div className="mb-10">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 mb-3 italic">Available Editions</p>
                <div className="grid grid-cols-2 gap-2">
                  {product.variants.map((v) => (
                    <button key={v.id} onClick={() => setSelectedVariant(v.id)} className={`px-3 py-3 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${selectedVariant === v.id ? 'bg-black text-white border-black shadow-md scale-[1.02]' : 'bg-white text-gray-400 border-gray-100 hover:border-black'}`}>
                      {v.name}
                      <span className="block text-[7px] opacity-60 mt-0.5 italic">Rs. {v.price.toLocaleString()}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 border-t border-gray-100 pt-8 mt-4 mb-12">
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

      {/* COD ORDER FORM MODAL - SCROLLABLE FOR MOBILE */}
      {isOrderModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md animate-fadeIn p-2 sm:p-4 overflow-hidden">
          <div ref={modalScrollRef} className="bg-white rounded-[1.5rem] sm:rounded-[2rem] w-full max-w-xl max-h-[92vh] flex flex-col shadow-2xl border border-gray-100 overflow-y-auto custom-scrollbar">
            <div className="p-5 sm:p-10 flex flex-col">
              {!orderSuccess ? (
                <>
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h2 className="text-xl sm:text-2xl font-serif font-bold uppercase italic tracking-tighter text-black">Cash on delivery</h2>
                      <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-1 italic">10,000+ Happy Customers In Pakistan</p>
                    </div>
                    <button onClick={() => setIsOrderModalOpen(false)} className="text-gray-400 hover:text-black transition p-2"><i className="fas fa-times text-2xl"></i></button>
                  </div>
                  
                  <form onSubmit={handleQuickOrder} className="space-y-4">
                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex items-center space-x-4 mb-2 text-black">
                      <img src={product.image} className="w-12 h-12 rounded-xl object-cover border" />
                      <div>
                        <p className="font-black text-[10px] uppercase italic">{product.name}</p>
                        <p className="text-[8px] font-black text-blue-600 uppercase tracking-widest mt-0.5 italic">Pay Rs. {(currentPrice * quantity).toLocaleString()} at door</p>
                      </div>
                    </div>
                    
                    {['name', 'phone', 'city'].map(field => (
                      <div key={field}>
                        <label className="block text-[8px] font-black uppercase tracking-widest text-gray-400 mb-1 px-1 italic">
                          {field === 'phone' ? 'Mobile Number' : field}
                        </label>
                        <input 
                          required 
                          type={field === 'phone' ? 'tel' : 'text'} 
                          className="w-full bg-white border border-gray-200 rounded-xl px-5 py-3 font-bold outline-none text-black focus:ring-1 focus:ring-black transition uppercase text-xs italic" 
                          placeholder={field === 'phone' ? 'Enter Mobile Number' : `Enter ${field}`} 
                          value={(formData as any)[field]} 
                          onChange={e => setFormData({...formData, [field]: e.target.value})} 
                        />
                      </div>
                    ))}
                    
                    <div>
                      <label className="block text-[8px] font-black uppercase tracking-widest text-gray-400 mb-1 px-1 italic">Full Delivery Address</label>
                      <textarea 
                        required 
                        className="w-full bg-white border border-gray-200 rounded-xl px-5 py-3 font-bold outline-none h-24 resize-none text-black focus:ring-1 focus:ring-black transition uppercase text-xs italic" 
                        placeholder="Area, Street, House details..." 
                        value={formData.address} 
                        onChange={e => setFormData({...formData, address: e.target.value})} 
                      />
                    </div>
                    
                    <button type="submit" disabled={isSubmitting} className="w-full bg-black text-white font-black uppercase py-5 rounded-xl hover:bg-blue-600 transition shadow-2xl tracking-[0.2em] text-[11px] italic active:scale-95 mt-4">
                      {isSubmitting ? <i className="fas fa-circle-notch fa-spin"></i> : `Complete Your Order`}
                    </button>
                    
                    <div className="flex items-center justify-center space-x-3 pt-4 border-t border-gray-100 mt-2">
                      <div className="flex text-yellow-500 text-[10px] space-x-1">
                        <i className="fas fa-star"></i><i className="fas fa-star"></i><i className="fas fa-star"></i><i className="fas fa-star"></i><i className="fas fa-star"></i>
                      </div>
                      <span className="text-[9px] font-black uppercase text-black italic">10,000+ Pakistan Customers</span>
                    </div>
                  </form>
                </>
              ) : (
                <div className="text-center py-10 flex flex-col items-center justify-center text-black">
                  <div className="w-16 h-16 bg-green-500 text-white rounded-full flex items-center justify-center mx-auto mb-6 text-2xl shadow-xl"><i className="fas fa-check"></i></div>
                  <h3 className="text-2xl font-serif font-bold italic uppercase mb-2 italic">Order Success</h3>
                  <p className="text-gray-500 mb-8 font-bold italic text-[10px] tracking-widest italic uppercase">Tracking ID: <span className="text-black">#{orderSuccess.id}</span></p>
                  <button onClick={() => { setIsOrderModalOpen(false); setOrderSuccess(null); }} className="w-full max-w-xs bg-black text-white font-black uppercase tracking-[0.4em] py-4 rounded-xl shadow-lg hover:bg-gray-800 transition text-[9px] italic">Continue Shopping</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductDetail;
