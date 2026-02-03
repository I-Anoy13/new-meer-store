
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
  
  // FIX: Force scroll to top when product ID changes
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  const product = products.find(p => p.id === id);
  
  const productImages = product?.images && product.images.length > 0 
    ? product.images 
    : [product?.image || PLACEHOLDER_IMAGE];

  const [activeImage, setActiveImage] = useState(productImages[0]);
  const [selectedVariant, setSelectedVariant] = useState(product?.variants?.[0]?.id || '');
  const [quantity, setQuantity] = useState(1);
  const [isOrderPortalActive, setIsOrderPortalActive] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<{ id: string } | null>(null);

  useEffect(() => {
    if (productImages.length > 0) {
      setActiveImage(productImages[0]);
    }
  }, [id, productImages]);

  const [unitsLeft, setUnitsLeft] = useState(14);
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
      setViewers(prev => {
        const next = prev + (Math.random() > 0.5 ? 1 : -1);
        return next < 18 ? 18 : next > 25 ? 25 : next;
      });
      if (Math.random() > 0.85) {
        setUnitsLeft(prev => prev > 2 ? prev - 1 : 2);
      }
    }, 4500);

    const notifyInterval = setInterval(() => {
      const name = MUSLIM_NAMES[Math.floor(Math.random() * MUSLIM_NAMES.length)];
      const city = PAKISTAN_CITIES[Math.floor(Math.random() * PAKISTAN_CITIES.length)];
      setPurchaseNotification({ name, city });
      setTimeout(() => setPurchaseNotification(null), 5000);
    }, 12000);

    return () => {
      clearInterval(interval);
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
                  </div>
                </div>

                <form onSubmit={handleQuickOrder} className="space-y-6">
                  <input required type="text" className="w-full bg-white border border-gray-200 rounded-2xl px-5 py-4 font-bold outline-none text-black focus:border-black transition text-base italic shadow-sm" placeholder="ENTER FULL NAME" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                  <input required type="tel" className="w-full bg-white border border-gray-200 rounded-2xl px-5 py-4 font-bold outline-none text-black focus:border-black transition text-base italic shadow-sm" placeholder="03XXXXXXXXX" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                  <input required type="text" className="w-full bg-white border border-gray-200 rounded-2xl px-5 py-4 font-bold outline-none text-black focus:border-black transition text-base italic shadow-sm" placeholder="CITY" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} />
                  <textarea required className="w-full bg-white border border-gray-200 rounded-2xl px-5 py-4 font-bold outline-none h-32 resize-none text-black focus:border-black transition text-base italic leading-relaxed shadow-sm" placeholder="FULL DELIVERY ADDRESS" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
                  <button type="submit" disabled={isSubmitting} className="w-full bg-black text-white font-black uppercase py-5 rounded-2xl hover:bg-blue-600 transition shadow-xl tracking-[0.2em] text-sm italic animate-pulse-red">
                    {isSubmitting ? <i className="fas fa-circle-notch fa-spin text-lg"></i> : `Confirm Order — Rs. ${currentPrice.toLocaleString()}`}
                  </button>
                </form>
              </>
            ) : (
              <div className="text-center py-20 animate-fadeIn">
                <div className="w-20 h-20 bg-green-500 text-white rounded-full flex items-center justify-center mx-auto mb-6 text-3xl shadow-lg animate-bounce">
                  <i className="fas fa-check"></i>
                </div>
                <h2 className="text-3xl font-serif font-bold italic uppercase mb-2 text-black">Order Dispatched</h2>
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
      {purchaseNotification && (
        <div className="fixed bottom-6 left-6 z-[100] pointer-events-none">
          <div className="bg-white/95 backdrop-blur-md border border-gray-100 p-4 rounded-3xl shadow-2xl flex items-center space-x-4 animate-slideInLeft pointer-events-auto">
            <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center text-white shrink-0">
              <i className="fas fa-shopping-cart text-xs"></i>
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-black italic">
              {purchaseNotification.name} from {purchaseNotification.city} just bought this!
            </p>
          </div>
        </div>
      )}

      <div className="bg-red-600 text-white py-2 text-center sticky top-16 z-50 shadow-md">
        <div className="container mx-auto px-4 flex items-center justify-center space-x-6">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] animate-pulse">FLASH SALE ENDS: {formatTime(timeLeft)}</span>
        </div>
      </div>

      <div className="container mx-auto px-4 md:px-6 py-4 lg:py-16 relative">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16">
          <div className="lg:col-span-5">
            <div className="relative aspect-[4/5] bg-gray-50 rounded-[2rem] overflow-hidden shadow-inner border border-gray-100 flex items-center justify-center">
              <img src={activeImage} alt={product.name} className="w-full h-full object-cover transition-transform duration-700" />
            </div>
            
            {productImages.length > 1 && (
              <div className="flex space-x-3 overflow-x-auto no-scrollbar py-4">
                {productImages.map((img, idx) => (
                  <button key={idx} onClick={() => setActiveImage(img)} className={`w-20 h-20 rounded-xl overflow-hidden border-2 shrink-0 transition-all ${activeImage === img ? 'border-black scale-105' : 'border-gray-100 opacity-60'}`}>
                    <img src={img} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-7 flex flex-col justify-center">
            <span className="text-blue-600 text-[9px] font-black uppercase tracking-widest italic">{product.category}</span>
            <h1 className="text-3xl md:text-6xl font-serif font-bold italic uppercase leading-tight mt-2 text-black">{product.name}</h1>
            
            <div className="flex items-center space-x-4 my-6">
              <span className="text-3xl font-black italic text-black">Rs. {currentPrice.toLocaleString()}</span>
              <span className="text-[9px] font-black text-green-600 bg-green-50 px-3 py-1.5 rounded-full uppercase italic border border-green-100">Free Express Delivery</span>
            </div>

            <div className="mb-4">
              <div className="flex justify-between items-end mb-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-red-600 italic">Hurry! Only {unitsLeft} left</p>
              </div>
              <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-red-600" style={{ width: `${(unitsLeft / 20) * 100}%` }}></div>
              </div>
            </div>

            <button onClick={() => setIsOrderPortalActive(true)} className="w-full bg-black text-white font-black text-[14px] uppercase tracking-[0.2em] py-6 px-10 rounded-2xl hover:bg-blue-600 transition shadow-2xl active:scale-95 italic animate-pulse-red">ORDER NOW - CASH ON DELIVERY</button>

            {/* FIX: Preserve spaces and line breaks with whitespace-pre-wrap */}
            <div className="my-8 max-w-xl">
               <p className="text-sm text-gray-700 leading-relaxed italic font-medium border-l-2 border-black/10 pl-6 whitespace-pre-wrap">
                 {product.description}
               </p>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-gray-100 pt-8">
              {TRUST_BADGES.map((badge, idx) => (
                <div key={idx} className="flex items-center space-x-2">
                  <div className="w-10 h-10 flex items-center justify-center bg-gray-50 rounded-lg text-blue-600"><i className={`fas ${badge.icon} text-sm`}></i></div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-gray-500 italic leading-tight">{badge.text}</span>
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
