
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

  // Body scroll lock implementation
  useEffect(() => {
    if (isOrderModalOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.height = '100vh';
    } else {
      document.body.style.overflow = 'unset';
      document.body.style.height = 'auto';
    }
    return () => {
      document.body.style.overflow = 'unset';
      document.body.style.height = 'auto';
    };
  }, [isOrderModalOpen]);

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    e.currentTarget.src = PLACEHOLDER_IMAGE;
  };

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

  const [timeLeft, setTimeLeft] = useState(3600);
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    city: '',
    address: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!product) {
    return (
      <div className="container mx-auto px-4 py-32 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-black uppercase italic font-serif">Product Not Found</h2>
        <Link to="/" className="text-blue-600 mt-6 inline-block font-black uppercase text-xs tracking-widest hover:underline">Return to Collection</Link>
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
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const newOrderId = `ORD-${timestamp}-${random}`;
    
    const newOrder: Order = {
      id: newOrderId,
      items: [{ 
        product, 
        quantity, 
        variantId: selectedVariant,
        variantName: variantName 
      }],
      total: currentPrice * quantity,
      status: 'Pending',
      customer: {
        name: formData.name,
        email: '',
        phone: formData.phone,
        address: formData.address,
        city: formData.city
      },
      date: new Date().toISOString()
    };
    
    const success = await placeOrder(newOrder);
    if (success) {
      setOrderSuccess({ id: newOrderId });
    }
    setIsSubmitting(false);
  };

  return (
    <div className="bg-white animate-fadeIn pb-24 lg:pb-0 relative">
      <div className="bg-red-600 text-white py-3 text-center overflow-hidden">
        <div className="container mx-auto px-4 flex items-center justify-center space-x-4">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] animate-pulse">
            Exclusive Flash Sale — 25% Reserved Discount
          </span>
          <div className="h-4 w-px bg-white/30 hidden md:block"></div>
          <span className="text-xs md:text-sm font-mono font-bold">
            ENDS IN: {formatTime(timeLeft)}
          </span>
        </div>
      </div>

      <div className="container mx-auto px-6 py-12 lg:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
          <div className="lg:col-span-5">
            <div className="relative aspect-[4/5] min-h-[400px] w-full bg-gray-50 rounded-2xl overflow-hidden shadow-sm group border border-gray-100 flex items-center justify-center">
              {product.video ? (
                <video src={product.video} poster={product.image} autoPlay muted loop playsInline className="w-full h-full object-cover" />
              ) : (
                <img src={product.image} alt={product.name} onError={handleImageError} className="w-full h-full object-cover" />
              )}
              <div className="absolute top-6 left-6 z-10">
                <div className="bg-black/80 backdrop-blur-md text-white px-4 py-2 rounded-full flex items-center space-x-2 border border-white/10 shadow-lg">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-ping"></span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-red-100">Exclusive Drop</span>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 flex flex-col justify-center relative">
            <div className={`absolute -top-6 right-0 z-40 transition-all duration-700 transform ${showPurchaseNotice ? 'translate-y-0 opacity-100' : '-translate-y-8 opacity-0 pointer-events-none'}`}>
              <div className="bg-white/95 backdrop-blur-xl border border-blue-100 p-4 rounded-2xl shadow-2xl flex items-center space-x-4 min-w-[280px]">
                <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center shrink-0 animate-bounce"><i className="fas fa-shopping-bag text-xs"></i></div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-600 mb-0.5">Live Order</p>
                  <p className="text-[11px] font-bold text-black leading-tight">{purchaseNotice?.name} from {purchaseNotice?.city}<br/><span className="text-gray-400 italic">just acquired this piece</span></p>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-3 mb-4">
              <span className="text-gray-500 font-bold uppercase tracking-widest text-[11px]">{product.category} Series</span>
              <div className="h-1 w-1 bg-gray-300 rounded-full"></div>
              <span className="text-red-600 font-black uppercase tracking-widest text-[11px] flex items-center"><i className="fas fa-fire mr-1"></i> High Interest</span>
            </div>

            <h1 className="text-4xl lg:text-7xl font-serif font-bold tracking-tight text-black mb-6 leading-tight uppercase italic">{product.name}</h1>
            
            <div className="flex items-center space-x-6 mb-8">
              <div className="flex flex-col">
                 <span className="text-4xl font-black text-black tracking-tighter">Rs. {currentPrice.toLocaleString()}</span>
                 <span className="text-[11px] text-gray-400 line-through font-bold">Rs. {(currentPrice * 1.25).toLocaleString()}</span>
              </div>
              <span className="text-xs font-bold text-blue-600 bg-blue-50 px-4 py-1.5 rounded-full uppercase tracking-wider border border-blue-100 italic font-serif">Order Now — Cash On Delivery</span>
            </div>

            <p className="text-gray-600 text-lg leading-relaxed mb-8 max-w-2xl font-medium italic">{product.description}</p>

            {product.variants && product.variants.length > 0 && (
              <div className="mb-10">
                <p className="text-[11px] font-black uppercase tracking-widest text-gray-400 mb-4 italic">Available Editions</p>
                <div className="flex flex-wrap gap-4">
                  {product.variants.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => setSelectedVariant(v.id)}
                      className={`px-6 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all duration-300 ${
                        selectedVariant === v.id 
                          ? 'bg-black text-white border-black shadow-xl scale-105' 
                          : 'bg-white text-gray-400 border-gray-100 hover:border-black hover:text-black'
                      }`}
                    >
                      {v.name}
                      <span className="block text-[8px] opacity-60 mt-1">Rs. {v.price.toLocaleString()}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-8 p-6 bg-gray-50/50 rounded-3xl border border-gray-100 border-dashed">
              <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-8">
                <div className="flex -space-x-4">
                  {[1,2,3,4,5,6].map(i => (
                    <img key={i} className="inline-block h-12 w-12 rounded-full ring-4 ring-white object-cover shadow-sm transition-transform hover:scale-110" src={`https://i.pravatar.cc/150?u=${i + 40}`} alt="Customer" />
                  ))}
                  <div className="h-12 w-12 rounded-full ring-4 ring-white bg-black flex items-center justify-center text-[11px] font-black text-white shadow-sm">+8k</div>
                </div>
                <div className="text-center sm:text-left">
                  <p className="text-[14px] font-black uppercase tracking-[0.2em] text-black italic leading-none">Global Enthusiasts</p>
                  <div className="flex justify-center sm:justify-start text-yellow-500 mt-2 space-x-1">
                    {[1,2,3,4,5].map(i => <i key={i} className="fas fa-star text-[12px]"></i>)}
                    <span className="ml-3 text-[10px] font-black text-gray-400 uppercase tracking-widest italic">(4.9/5 Rating)</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 mb-12">
              <div className="flex items-center border border-gray-100 rounded-xl px-4 py-2 bg-gray-50/50">
                <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="p-3 text-gray-400 hover:text-black transition"><i className="fas fa-minus text-xs"></i></button>
                <span className="w-12 text-center font-black text-lg">{quantity}</span>
                <button onClick={() => setQuantity(quantity + 1)} className="p-3 text-gray-400 hover:text-black transition"><i className="fas fa-plus text-xs"></i></button>
              </div>
              <button onClick={() => setIsOrderModalOpen(true)} className="flex-grow bg-black text-white font-black text-[12px] uppercase tracking-[0.3em] py-6 px-12 rounded-xl hover:bg-blue-600 transition shadow-2xl active:scale-[0.98] relative overflow-hidden group italic">
                <span className="relative z-10">Cash On Delivery</span>
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-black opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-8 border-t border-gray-100 pt-12">
              {TRUST_BADGES.map((badge, idx) => (
                <div key={idx} className="flex items-center space-x-5 group">
                  <div className="w-14 h-14 flex items-center justify-center bg-gray-50 rounded-2xl text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all duration-500 shadow-sm border border-gray-100"><i className={`fas ${badge.icon} text-xl`}></i></div>
                  <span className="text-[11px] font-black uppercase tracking-widest text-gray-500 italic">{badge.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {isOrderModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-md animate-fadeIn overflow-hidden">
          <div className="bg-white rounded-[2.5rem] w-full max-w-xl h-full sm:h-auto sm:max-h-[95vh] flex flex-col shadow-2xl border border-gray-100 overflow-hidden m-0 sm:m-4">
            <div className="p-8 md:p-12 overflow-y-auto custom-scrollbar flex-grow">
              {!orderSuccess ? (
                <>
                  <div className="flex justify-between items-start mb-8 text-black">
                    <h2 className="text-xl md:text-2xl font-serif font-bold uppercase italic tracking-tighter leading-tight max-w-[90%]">Shipping Information</h2>
                    <button onClick={() => setIsOrderModalOpen(false)} className="text-gray-400 hover:text-black transition p-2"><i className="fas fa-times text-2xl"></i></button>
                  </div>
                  <form onSubmit={handleQuickOrder} className="space-y-6 pb-6">
                    <div className="p-6 bg-gray-50 rounded-2xl border border-gray-100 flex items-center space-x-6 mb-4 text-black">
                      <img src={product.image} onError={handleImageError} className="w-16 h-16 rounded-xl object-cover shadow-md" />
                      <div>
                        <p className="font-black text-sm uppercase tracking-tight italic">{product.name}</p>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Edition: {variantName}</p>
                        <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-1">PKR {(currentPrice * quantity).toLocaleString()}</p>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-black uppercase tracking-widest text-gray-400 mb-2 px-1 italic">Full Recipient Name</label>
                      <input required type="text" className="w-full bg-white border border-gray-200 rounded-xl px-5 py-4 font-bold outline-none text-black focus:ring-1 focus:ring-black transition" placeholder="Enter Full Name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-[11px] font-black uppercase tracking-widest text-gray-400 mb-2 px-1 italic">Contact Number</label>
                      <input required type="tel" className="w-full bg-white border border-gray-200 rounded-xl px-5 py-4 font-bold outline-none text-black focus:ring-1 focus:ring-black transition" placeholder="03XX-XXXXXXX" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="block text-[11px] font-black uppercase tracking-widest text-gray-400 mb-2 px-1 italic">City</label>
                        <input required type="text" className="w-full bg-white border border-gray-200 rounded-xl px-5 py-4 font-bold outline-none text-black focus:ring-1 focus:ring-black transition" placeholder="e.g. Lahore" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} />
                      </div>
                      <div className="flex flex-col justify-end pb-4 text-right"><span className="text-[10px] font-black text-green-600 uppercase italic tracking-widest">Free Express Shipping</span></div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-black uppercase tracking-widest text-gray-400 mb-2 px-1 italic">Delivery Address</label>
                      <textarea required className="w-full bg-white border border-gray-200 rounded-xl px-5 py-4 font-bold outline-none h-24 resize-none text-black focus:ring-1 focus:ring-black transition" placeholder="Full Street, House, Area details..." value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
                    </div>
                    <button type="submit" disabled={isSubmitting} className="w-full bg-black text-white font-black uppercase py-6 rounded-xl hover:bg-blue-600 transition shadow-2xl tracking-[0.2em] text-sm italic active:scale-95 transition-transform">
                      {isSubmitting ? <i className="fas fa-circle-notch fa-spin"></i> : `Complete Order — Cash On Delivery`}
                    </button>
                  </form>
                </>
              ) : (
                <div className="text-center py-10 flex flex-col items-center justify-center h-full">
                  <div className="w-24 h-24 bg-green-500 text-white rounded-full flex items-center justify-center mx-auto mb-10 text-4xl shadow-2xl"><i className="fas fa-check"></i></div>
                  <h3 className="text-4xl font-serif font-bold uppercase mb-3 italic text-black">Order Placed</h3>
                  <p className="text-gray-500 mb-10 font-bold italic text-sm tracking-widest">Ref: <span className="text-black">#{orderSuccess.id}</span></p>
                  <button onClick={() => { setIsOrderModalOpen(false); setOrderSuccess(null); }} className="w-full max-w-xs bg-black text-white font-black uppercase tracking-[0.4em] py-5 rounded-xl shadow-lg hover:bg-gray-800 transition text-xs italic">Back to Store</button>
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
