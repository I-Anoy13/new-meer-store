
import React, { useState, useEffect } from 'react';
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
  const [isOrderPortalActive, setIsOrderPortalActive] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<{ id: string } | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [id, isOrderPortalActive]);

  const [viewers, setViewers] = useState(18 + Math.floor(Math.random() * 6));
  useEffect(() => {
    const interval = setInterval(() => {
      setViewers(prev => {
        const next = prev + (Math.random() > 0.5 ? 1 : -1);
        return next < 18 ? 18 : next > 23 ? 23 : next;
      });
    }, 4500);
    return () => clearInterval(interval);
  }, []);

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

  const [purchaseNotice, setPurchaseNotice] = useState<{ name: string, city: string } | null>(null);
  const [showPurchaseNotice, setShowPurchaseNotice] = useState(false);

  useEffect(() => {
    if (isOrderPortalActive) return;
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
  }, [isOrderPortalActive]);

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
      <div className="bg-white min-h-screen animate-fadeIn pb-2">
        <div className="bg-black text-white py-0.5 px-3 sticky top-0 z-50 flex justify-between items-center shadow-sm">
          <div className="flex items-center space-x-1">
             <div className="w-1 h-1 rounded-full bg-green-500 animate-pulse"></div>
             <p className="text-[4px] font-black uppercase tracking-[0.1em] italic">Checkout — COD</p>
          </div>
          <button onClick={() => setIsOrderPortalActive(false)} className="text-white/60 hover:text-white transition uppercase text-[4px] font-black tracking-widest">
            Close <i className="fas fa-times ml-0.5"></i>
          </button>
        </div>

        <div className="container mx-auto px-4 max-w-[260px] py-1">
          {!orderSuccess ? (
            <>
              <div className="mb-0.5 text-center">
                <h1 className="text-[10px] font-serif font-bold italic uppercase tracking-tighter text-black leading-none mb-0.5">Quick Order</h1>
                <p className="text-blue-600 text-[3px] font-black uppercase tracking-[0.2em] italic">Official Store • Secure Link</p>
              </div>

              <div className="bg-gray-50 rounded p-1 border border-gray-100 flex items-center space-x-1 mb-1">
                <img src={product.image} className="w-5 h-5 rounded-sm object-cover border" />
                <div className="flex-grow min-w-0">
                  <h3 className="text-[6px] font-black uppercase italic text-black truncate leading-none">{product.name}</h3>
                  <p className="text-blue-600 font-black text-[5px] italic mt-0.5">Rs. {currentPrice.toLocaleString()}</p>
                </div>
              </div>

              <form onSubmit={handleQuickOrder} className="space-y-0.5">
                <div>
                  <label className="block text-[4px] font-black uppercase text-gray-400 mb-0.5 px-0.5 italic">Recipient Name</label>
                  <input required type="text" className="w-full bg-white border border-gray-200 rounded px-1 py-1 font-bold outline-none text-black focus:border-black transition uppercase text-[7px] italic" placeholder="Full Name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-1">
                  <div>
                    <label className="block text-[4px] font-black uppercase text-gray-400 mb-0.5 px-0.5 italic">WhatsApp/Phone</label>
                    <input required type="tel" className="w-full bg-white border border-gray-200 rounded px-1 py-1 font-bold outline-none text-black focus:border-black transition uppercase text-[7px] italic" placeholder="03xx..." value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-[4px] font-black uppercase text-gray-400 mb-0.5 px-0.5 italic">City</label>
                    <input required type="text" className="w-full bg-white border border-gray-200 rounded px-1 py-1 font-bold outline-none text-black focus:border-black transition uppercase text-[7px] italic" placeholder="City" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} />
                  </div>
                </div>
                <div>
                  <label className="block text-[4px] font-black uppercase text-gray-400 mb-0.5 px-0.5 italic">Full Delivery Address</label>
                  <textarea required className="w-full bg-white border border-gray-200 rounded px-1 py-1 font-bold outline-none h-8 resize-none text-black focus:border-black transition uppercase text-[7px] italic leading-tight" placeholder="Street, landmark..." value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
                </div>

                <div className="pt-0.5">
                  <button type="submit" disabled={isSubmitting} className="w-full bg-black text-white font-black uppercase py-2 rounded hover:bg-blue-600 transition shadow-md tracking-[0.2em] text-[6px] italic active:scale-95 animate-pulse-red">
                    {isSubmitting ? <i className="fas fa-circle-notch fa-spin text-[6px]"></i> : `Place COD Order — Rs. ${currentPrice.toLocaleString()}`}
                  </button>
                  <p className="text-[3px] text-center font-black uppercase text-gray-300 tracking-[0.3em] mt-1 italic">Verification call will follow order</p>
                </div>
              </form>
            </>
          ) : (
            <div className="text-center py-4 animate-fadeIn">
              <div className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center mx-auto mb-1 text-[8px] shadow-sm animate-bounce">
                <i className="fas fa-check"></i>
              </div>
              <h2 className="text-[10px] font-serif font-bold italic uppercase mb-0.5 text-black">Order Dispatched</h2>
              <p className="text-gray-500 mb-2 font-bold italic text-[5px] tracking-widest uppercase">MANIFEST: <span className="text-black font-black">#{orderSuccess.id}</span></p>
              <button onClick={() => { setIsOrderPortalActive(false); setOrderSuccess(null); }} className="w-full bg-black text-white font-black uppercase tracking-[0.3em] py-1.5 rounded shadow-sm hover:bg-blue-600 transition text-[5px] italic">Back To Store</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white animate-fadeIn pb-24 lg:pb-0 relative text-black overflow-x-hidden">
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
                 <span className="text-[9px] font-black uppercase tracking-widest">{viewers} Browsing Now</span>
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
            <div className="mb-8">
              <button onClick={() => setIsOrderPortalActive(true)} className="w-full bg-black text-white font-black text-[12px] md:text-[14px] uppercase tracking-[0.2em] py-5 px-10 rounded-xl hover:bg-blue-600 transition shadow-2xl active:scale-95 italic animate-attention animate-pulse-red">Order Cash On Delivery <i className="fas fa-arrow-right ml-2 text-xs"></i></button>
            </div>
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
    </div>
  );
};

export default ProductDetail;
