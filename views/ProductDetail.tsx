
import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Product, Order } from '../types';
import { TRUST_BADGES, PLACEHOLDER_IMAGE } from '../constants';

interface ProductDetailProps {
  products: Product[];
  addToCart: (product: Product, quantity: number, variantId?: string) => void;
  placeOrder: (order: Order) => Promise<boolean>;
}

const ProductDetail: React.FC<ProductDetailProps> = ({ products, addToCart, placeOrder }) => {
  const { id } = useParams<{ id: string }>();
  const galleryRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => { window.scrollTo(0, 0); }, [id]);

  const product = products.find(p => p.id === id);
  const productImages = product?.images && product.images.length > 0 ? product.images : [product?.image || PLACEHOLDER_IMAGE];

  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [selectedVariant, setSelectedVariant] = useState(product?.variants?.[0]?.id || '');
  const [isOrderPortalActive, setIsOrderPortalActive] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<{ id: string } | null>(null);
  const [viewers, setViewers] = useState(25 + Math.floor(Math.random() * 15));
  const [unitsLeft, setUnitsLeft] = useState(14);
  const [formData, setFormData] = useState({ name: '', phone: '', city: '', address: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Flash Sale Timer (1 Hour)
  const [timeLeft, setTimeLeft] = useState(3600); 

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => prev > 0 ? prev - 1 : 0);
    }, 1000);
    const vInterval = setInterval(() => setViewers(prev => Math.min(45, Math.max(20, prev + (Math.random() > 0.5 ? 1 : -1)))), 4000);
    const stockInterval = setInterval(() => setUnitsLeft(prev => (prev > 2 ? prev - (Math.random() > 0.98 ? 1 : 0) : prev)), 20000);
    return () => { clearInterval(timer); clearInterval(vInterval); clearInterval(stockInterval); };
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!product) return (
    <div className="container mx-auto px-4 py-32 text-center">
      <h2 className="text-lg font-black uppercase italic">Product Manifest Lost</h2>
      <Link to="/" className="text-blue-600 mt-4 inline-block font-black underline italic uppercase text-xs">Return to Home</Link>
    </div>
  );

  const variantObj = product.variants?.find(v => v.id === selectedVariant);
  const currentPrice = variantObj?.price || product.price;

  const handleQuickOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    const newOrderId = `ORD-${Date.now().toString().slice(-6)}`;
    const newOrder: Order = {
      id: newOrderId,
      items: [{ product, quantity: 1, variantId: selectedVariant, variantName: variantObj?.name || 'Standard' }],
      total: currentPrice,
      status: 'Pending',
      customer: { name: formData.name, email: '', phone: formData.phone, address: formData.address, city: formData.city },
      date: new Date().toISOString()
    };
    if (await placeOrder(newOrder)) setOrderSuccess({ id: newOrderId });
    else alert("Placement Failed. Please check your internet connection.");
    setIsSubmitting(false);
  };

  const scrollToImage = (idx: number) => {
    if (idx < 0) idx = productImages.length - 1;
    if (idx >= productImages.length) idx = 0;
    setActiveImageIdx(idx);
    if (galleryRef.current) {
      galleryRef.current.scrollTo({ left: galleryRef.current.offsetWidth * idx, behavior: 'smooth' });
    }
  };

  const nextImage = () => scrollToImage(activeImageIdx + 1);
  const prevImage = () => scrollToImage(activeImageIdx - 1);

  if (isOrderPortalActive) {
    return (
      <div className="fixed inset-0 bg-white z-[200] flex flex-col animate-fadeIn overflow-hidden">
        <div className="bg-black text-white py-5 px-6 flex justify-between items-center">
          <p className="text-[10px] font-black uppercase tracking-widest italic">Secure Order — Cash On Delivery</p>
          <button onClick={() => setIsOrderPortalActive(false)} className="text-white/40 hover:text-white uppercase text-[10px] font-black">Close</button>
        </div>
        <div className="flex-grow overflow-y-auto pb-12">
          <div className="container mx-auto px-6 py-8 max-w-md">
            {!orderSuccess ? (
              <>
                <div className="mb-10 text-center"><h1 className="text-2xl font-black uppercase italic tracking-tighter">Order Processing</h1></div>
                <div className="bg-gray-50 rounded-3xl p-5 border border-gray-100 flex items-center space-x-6 mb-10">
                  <img src={product.image} className="w-16 h-16 rounded-2xl object-cover border shadow-sm" />
                  <div>
                    <h3 className="text-xs font-black text-black uppercase">{product.name}</h3>
                    <p className="text-black font-black text-lg italic mt-1">Rs. {currentPrice.toLocaleString()}</p>
                  </div>
                </div>
                <form onSubmit={handleQuickOrder} className="space-y-4">
                  <input required type="text" className="w-full bg-white border border-gray-100 rounded-2xl px-5 py-4 font-bold text-sm outline-none focus:border-black" placeholder="Full Name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                  <input required type="tel" className="w-full bg-white border border-gray-100 rounded-2xl px-5 py-4 font-bold text-sm outline-none focus:border-black" placeholder="Phone Number" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                  <input required type="text" className="w-full bg-white border border-gray-100 rounded-2xl px-5 py-4 font-bold text-sm outline-none focus:border-black" placeholder="City" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} />
                  <textarea required className="w-full bg-white border border-gray-100 rounded-2xl px-5 py-4 font-bold text-sm outline-none h-28 resize-none" placeholder="Complete Delivery Address" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
                  <button type="submit" disabled={isSubmitting} className="w-full bg-black text-white font-black uppercase py-5 rounded-2xl hover:bg-blue-600 transition shadow-2xl text-[10px] tracking-widest italic">{isSubmitting ? <i className="fas fa-circle-notch fa-spin"></i> : `Place Order — Rs. ${currentPrice.toLocaleString()}`}</button>
                </form>
              </>
            ) : (
              <div className="text-center py-20 animate-fadeIn">
                <div className="w-16 h-16 bg-green-500 text-white rounded-full flex items-center justify-center mx-auto mb-8 text-2xl shadow-xl"><i className="fas fa-check"></i></div>
                <h2 className="text-2xl font-black italic uppercase mb-2">Order Confirmed</h2>
                <p className="text-gray-400 text-xs font-black uppercase mb-12">Order #{orderSuccess.id}</p>
                <button onClick={() => { setIsOrderPortalActive(false); setOrderSuccess(null); }} className="w-full bg-black text-white font-black uppercase py-5 rounded-2xl text-[10px] tracking-widest">Back to Gallery</button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white animate-fadeIn pb-32 lg:pb-12 text-black">
      <div className="container mx-auto px-4 md:px-12 py-8 lg:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20">
          <div className="lg:col-span-7">
            <div className="relative aspect-[4/5] bg-gray-50 rounded-[2.5rem] overflow-hidden border border-gray-100 shadow-sm group">
              <div ref={galleryRef} className="flex w-full h-full overflow-x-auto snap-x snap-mandatory no-scrollbar" onScroll={e => setActiveImageIdx(Math.round(e.currentTarget.scrollLeft / e.currentTarget.offsetWidth))}>
                {productImages.map((img, i) => (
                  <div key={i} className="w-full h-full shrink-0 snap-center"><img src={img} className="w-full h-full object-cover" /></div>
                ))}
              </div>
              
              {/* Carousel Controls */}
              {productImages.length > 1 && (
                <>
                  <button onClick={prevImage} className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg transition-opacity md:opacity-0 group-hover:opacity-100">
                    <i className="fas fa-chevron-left text-xs"></i>
                  </button>
                  <button onClick={nextImage} className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg transition-opacity md:opacity-0 group-hover:opacity-100">
                    <i className="fas fa-chevron-right text-xs"></i>
                  </button>
                </>
              )}

              <div className="absolute top-6 right-6 bg-red-600 text-white px-4 py-2 rounded-full font-black text-[10px] uppercase tracking-widest animate-pulse z-10">
                Flash Sale: {formatTime(timeLeft)}
              </div>
              <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex space-x-2">
                {productImages.map((_, i) => (
                  <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all duration-500 ${activeImageIdx === i ? 'bg-black w-6' : 'bg-black/10'}`}></div>
                ))}
              </div>
            </div>
            <div className="flex gap-4 overflow-x-auto no-scrollbar py-6 px-4">
              {productImages.map((img, idx) => (
                <button key={idx} onClick={() => scrollToImage(idx)} className={`w-20 h-20 rounded-2xl overflow-hidden border-2 shrink-0 transition-all ${activeImageIdx === idx ? 'border-black' : 'border-gray-100 opacity-40'}`}><img src={img} className="w-full h-full object-cover" /></button>
              ))}
            </div>
          </div>
          <div className="lg:col-span-5 flex flex-col justify-center">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 italic">{product.category}</p>
            <h1 className="text-3xl lg:text-4xl font-black leading-none italic uppercase tracking-tighter mb-6">{product.name}</h1>
            <div className="flex items-center space-x-6 mb-10">
              <span className="text-3xl font-black italic">Rs. {currentPrice.toLocaleString()}</span>
              <span className="text-[9px] font-black text-green-600 bg-green-50 px-3 py-1.5 rounded-full border border-green-100 uppercase italic">Free Delivery</span>
            </div>
            <div className="mb-10 bg-gray-50 p-6 rounded-[2rem] border border-gray-100">
              <p className="text-[10px] font-black text-red-600 mb-4 uppercase italic flex items-center"><i className="fas fa-bolt mr-2"></i> Only {unitsLeft} units remaining</p>
              <div className="w-full h-1 bg-white rounded-full overflow-hidden"><div className="h-full bg-red-600 transition-all duration-1000" style={{ width: `${(unitsLeft / 14) * 100}%` }}></div></div>
            </div>
            
            <div className="mb-8 space-y-4">
              <div className="flex items-center space-x-3 pl-2">
                <div className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span></div>
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 italic">{viewers} people watching</span>
              </div>

              {/* HAPPY CUSTOMER SECTION */}
              <div className="flex items-center space-x-4 bg-gray-50/50 p-4 rounded-2xl border border-gray-100/50">
                <div className="flex -space-x-2">
                  {[1, 2, 3].map(i => (
                    <img key={i} className="inline-block h-8 w-8 rounded-full ring-2 ring-white object-cover shadow-sm" src={`https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=100&h=100&auto=format&fit=crop&sig=${i}`} alt="Customer" />
                  ))}
                  <div className="h-8 w-8 rounded-full ring-2 ring-white bg-blue-600 flex items-center justify-center text-[8px] font-black text-white">+12k</div>
                </div>
                <div>
                   <div className="flex text-yellow-500 text-[8px] mb-0.5">
                     {[1,2,3,4,5].map(i => <i key={i} className="fas fa-star"></i>)}
                   </div>
                   <p className="text-[9px] font-black uppercase tracking-widest text-black/60 italic">Trusted by 12,000+ Happy Customers</p>
                </div>
              </div>
            </div>

            <button onClick={() => setIsOrderPortalActive(true)} className="w-full bg-black text-white font-black text-xs uppercase tracking-widest py-6 rounded-2xl shadow-2xl active:scale-[0.98] transition-all italic">Order Now — Cash On Delivery</button>
            <div className="mt-12 space-y-8">
               <div className="border-l-2 border-black pl-6">
                 <h3 className="text-[10px] font-black uppercase text-gray-400 mb-3 italic">Item Specification</h3>
                 <p className="text-sm font-medium leading-relaxed opacity-70 whitespace-pre-wrap">{product.description}</p>
               </div>
               <div className="grid grid-cols-2 gap-6 pt-10 border-t border-gray-100">
                 {TRUST_BADGES.map((b, i) => (
                   <div key={i} className="flex items-center space-x-3"><div className="w-8 h-8 flex items-center justify-center bg-gray-50 rounded-xl text-blue-600"><i className={`fas ${b.icon} text-xs`}></i></div><span className="text-[9px] font-black text-gray-400 uppercase tracking-tight">{b.text}</span></div>
                 ))}
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetail;
