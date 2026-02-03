
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
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<{ id: string } | null>(null);

  // Flash Sale Timer
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

  // Fake Purchase Notification
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
    const initialDelay = setTimeout(triggerNotice, 2000);
    const interval = setInterval(triggerNotice, 20000);
    return () => { clearTimeout(initialDelay); clearInterval(interval); };
  }, []);

  // MOBILE: Professional Body Scroll Lock
  useEffect(() => {
    if (isOrderModalOpen) {
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
      return () => {
        const scrollY = document.body.style.top;
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        document.body.style.overflow = '';
        window.scrollTo(0, parseInt(scrollY || '0') * -1);
      };
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
        <h2 className="text-3xl font-serif font-bold italic uppercase tracking-tighter italic">Timepiece Not Found</h2>
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
    <div className="bg-white animate-fadeIn pb-24 lg:pb-0 relative text-black">
      {/* Flash Sale Banner */}
      <div className="bg-red-600 text-white py-3 text-center overflow-hidden">
        <div className="container mx-auto px-4 flex items-center justify-center space-x-4">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] animate-pulse">Exclusive Flash Sale — 25% Reserved Discount</span>
          <div className="h-4 w-px bg-white/30 hidden md:block"></div>
          <span className="text-xs md:text-sm font-mono font-bold tracking-widest">ENDS IN: {formatTime(timeLeft)}</span>
        </div>
      </div>

      <div className="container mx-auto px-6 py-12 lg:py-20 relative">
        {/* Fake Purchase Notice Popup */}
        <div className={`fixed bottom-24 right-6 md:absolute md:top-0 md:right-0 z-40 transition-all duration-700 transform ${showPurchaseNotice ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0 pointer-events-none'}`}>
          <div className="bg-white/95 backdrop-blur-xl border border-blue-100 p-4 rounded-2xl shadow-2xl flex items-center space-x-4 min-w-[280px]">
            <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center shrink-0 animate-bounce"><i className="fas fa-shopping-bag text-xs"></i></div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-600 mb-0.5 italic">Live Acquisition</p>
              <p className="text-[11px] font-bold text-black leading-tight italic">{purchaseNotice?.name} from {purchaseNotice?.city}<br/><span className="text-gray-400 italic">just acquired this piece</span></p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
          <div className="lg:col-span-5">
            <div className="relative aspect-[4/5] min-h-[400px] bg-gray-50 rounded-[2rem] overflow-hidden shadow-sm border border-gray-100 flex items-center justify-center group">
              <img src={product.image} alt={product.name} onError={handleImageError} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
            </div>
          </div>

          <div className="lg:col-span-7 flex flex-col justify-center">
            <h1 className="text-4xl lg:text-7xl font-serif font-bold italic uppercase leading-tight mb-6 italic">{product.name}</h1>
            <div className="flex items-center space-x-6 mb-8">
              <div className="flex flex-col">
                <span className="text-4xl font-black">Rs. {currentPrice.toLocaleString()}</span>
                <span className="text-[10px] text-gray-400 line-through font-bold">Rs. {(currentPrice * 1.25).toLocaleString()}</span>
              </div>
              <span className="text-xs font-bold text-blue-600 bg-blue-50 px-4 py-1.5 rounded-full uppercase italic border border-blue-100 italic">Cash On Delivery</span>
            </div>
            <p className="text-gray-600 text-lg leading-relaxed mb-8 italic">{product.description}</p>

            {/* Variant Selector */}
            {product.variants && product.variants.length > 0 && (
              <div className="mb-10">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-4 italic">Select Edition</p>
                <div className="flex flex-wrap gap-4">
                  {product.variants.map((v) => (
                    <button key={v.id} onClick={() => setSelectedVariant(v.id)} className={`px-6 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${selectedVariant === v.id ? 'bg-black text-white border-black shadow-xl scale-105' : 'bg-white text-gray-400 border-gray-100 hover:border-black hover:text-black'}`}>
                      {v.name}
                      <span className="block text-[8px] opacity-60 mt-1 italic">Rs. {v.price.toLocaleString()}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Happy Customer & Ratings Section */}
            <div className="mb-8 p-6 bg-gray-50 rounded-[2rem] border border-gray-100 border-dashed">
              <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-6">
                <div className="flex -space-x-3">
                  {[1, 2, 3, 4, 5].map(i => (
                    <img key={i} className="inline-block h-10 w-10 rounded-full ring-4 ring-white object-cover" src={`https://i.pravatar.cc/150?u=${i + 30}`} alt="customer" />
                  ))}
                  <div className="h-10 w-10 rounded-full ring-4 ring-white bg-black flex items-center justify-center text-[10px] font-black text-white">+15k</div>
                </div>
                <div className="text-center sm:text-left">
                   <p className="text-[12px] font-black uppercase tracking-[0.2em] italic">Artisan Approved</p>
                   <div className="flex justify-center sm:justify-start text-yellow-500 mt-1 space-x-1">
                      {[1, 2, 3, 4, 5].map(i => <i key={i} className="fas fa-star text-[10px]"></i>)}
                      <span className="ml-2 text-[9px] font-black text-gray-400 italic">(4.9/5 Rating)</span>
                   </div>
                </div>
              </div>
            </div>

            <button onClick={() => setIsOrderModalOpen(true)} className="w-full lg:w-max bg-black text-white font-black text-[12px] uppercase tracking-[0.3em] py-6 px-16 rounded-xl hover:bg-blue-600 transition shadow-2xl active:scale-95 italic">
              Order Cash On Delivery
            </button>

            <div className="grid grid-cols-2 gap-8 border-t border-gray-100 pt-12 mt-12">
              {TRUST_BADGES.map((badge, idx) => (
                <div key={idx} className="flex items-center space-x-5">
                  <div className="w-14 h-14 flex items-center justify-center bg-gray-50 rounded-2xl text-blue-600 border border-gray-100"><i className={`fas ${badge.icon} text-xl`}></i></div>
                  <span className="text-[11px] font-black uppercase tracking-widest text-gray-500 italic">{badge.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {isOrderModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-md animate-fadeIn p-4 overflow-hidden">
          <div className="bg-white rounded-[2.5rem] w-full max-w-xl max-h-[95vh] flex flex-col shadow-2xl border border-gray-100 overflow-hidden">
            <div className="p-6 md:p-10 overflow-y-auto custom-scrollbar flex-grow">
              {!orderSuccess ? (
                <>
                  <div className="flex justify-between items-start mb-6">
                    <h2 className="text-xl md:text-2xl font-serif font-bold uppercase italic tracking-tighter italic text-black">Recipient Manifest</h2>
                    <button onClick={() => setIsOrderModalOpen(false)} className="text-gray-400 hover:text-black transition p-2"><i className="fas fa-times text-2xl"></i></button>
                  </div>
                  <form onSubmit={handleQuickOrder} className="space-y-5">
                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex items-center space-x-4 mb-4 text-black">
                      <img src={product.image} className="w-12 h-12 rounded-xl object-cover" />
                      <div>
                        <p className="font-black text-xs uppercase italic">{product.name}</p>
                        <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest mt-0.5 italic">PKR {(currentPrice * quantity).toLocaleString()} • {variantName}</p>
                      </div>
                    </div>
                    {['name', 'phone', 'city'].map(field => (
                      <div key={field}>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5 px-1 italic">{field === 'phone' ? 'Phone Number' : field}</label>
                        <input required type={field === 'phone' ? 'tel' : 'text'} className="w-full bg-white border border-gray-200 rounded-xl px-5 py-4 font-bold outline-none text-black focus:ring-1 focus:ring-black transition uppercase text-xs italic" placeholder={`Enter ${field}`} value={(formData as any)[field]} onChange={e => setFormData({...formData, [field]: e.target.value})} />
                      </div>
                    ))}
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5 px-1 italic">Delivery Address</label>
                      <textarea required className="w-full bg-white border border-gray-200 rounded-xl px-5 py-4 font-bold outline-none h-20 resize-none text-black focus:ring-1 focus:ring-black transition uppercase text-xs italic" placeholder="Street, Area, House details..." value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
                    </div>
                    <button type="submit" disabled={isSubmitting} className="w-full bg-black text-white font-black uppercase py-5 rounded-xl hover:bg-blue-600 transition shadow-2xl tracking-[0.2em] text-xs italic active:scale-95 italic">
                      {isSubmitting ? <i className="fas fa-circle-notch fa-spin"></i> : `Complete Order — COD`}
                    </button>
                    <p className="text-[9px] text-center font-black uppercase text-green-600 tracking-widest italic pt-2">Free Express Shipping Nationwide</p>
                  </form>
                </>
              ) : (
                <div className="text-center py-10 flex flex-col items-center justify-center h-full text-black">
                  <div className="w-20 h-20 bg-green-500 text-white rounded-full flex items-center justify-center mx-auto mb-8 text-3xl shadow-2xl"><i className="fas fa-check"></i></div>
                  <h3 className="text-3xl font-serif font-bold italic uppercase mb-2 italic">Order Confirmed</h3>
                  <p className="text-gray-500 mb-8 font-bold italic text-sm tracking-widest italic">ORDER ID: <span className="text-black">#{orderSuccess.id}</span></p>
                  <button onClick={() => { setIsOrderModalOpen(false); setOrderSuccess(null); }} className="w-full max-w-xs bg-black text-white font-black uppercase tracking-[0.4em] py-5 rounded-xl shadow-lg hover:bg-gray-800 transition text-[10px] italic">Close Ledger</button>
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
