
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Product, Order } from '../types';
import { TRUST_BADGES } from '../constants';

interface ProductDetailProps {
  products: Product[];
  addToCart: (product: Product, quantity: number, variantId?: string) => void;
  placeOrder: (order: Order) => void;
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

  // Fake Purchase Notification Logic
  const [purchaseNotice, setPurchaseNotice] = useState<{ name: string, city: string } | null>(null);
  const [showPurchaseNotice, setShowPurchaseNotice] = useState(false);

  useEffect(() => {
    const triggerNotice = () => {
      const name = MUSLIM_NAMES[Math.floor(Math.random() * MUSLIM_NAMES.length)];
      const city = PAKISTAN_CITIES[Math.floor(Math.random() * PAKISTAN_CITIES.length)];
      setPurchaseNotice({ name, city });
      setShowPurchaseNotice(true);

      setTimeout(() => {
        setShowPurchaseNotice(false);
      }, 5000); // Show for 5 seconds
    };

    // Trigger faster on first landing
    const initialDelay = setTimeout(triggerNotice, 2000);
    const interval = setInterval(triggerNotice, 20000); 

    return () => {
      clearTimeout(initialDelay);
      clearInterval(interval);
    };
  }, []);

  // Dynamic Viewer Logic - 3 second gap
  const [viewers, setViewers] = useState(() => Math.floor(Math.random() * (25 - 12 + 1)) + 12);
  
  useEffect(() => {
    const viewerTimer = setInterval(() => {
      setViewers(prev => {
        const change = Math.floor(Math.random() * 5) - 2;
        const newVal = prev + change;
        return Math.max(8, Math.min(45, newVal));
      });
    }, 3000); 
    return () => clearInterval(viewerTimer);
  }, []);

  // Flash Sale Timer Logic (60 Minutes)
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
        <h2 className="text-3xl font-bold tracking-tight">TIMEPIECE NOT FOUND</h2>
        <Link to="/" className="text-blue-600 mt-6 inline-block font-semibold hover:underline">Return to Collection</Link>
      </div>
    );
  }

  const handleQuickOrder = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const newOrderId = `ORD-${Math.floor(Math.random() * 900000) + 100000}`;
    
    setTimeout(() => {
      const variantObj = product.variants?.find(v => v.id === selectedVariant);
      const variantName = variantObj?.name || "Standard Edition";
      const price = variantObj?.price || product.price;

      const newOrder: Order = {
        id: newOrderId,
        items: [{ 
          product, 
          quantity, 
          variantId: selectedVariant,
          variantName: variantName 
        }],
        total: price * quantity,
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
      
      placeOrder(newOrder);
      setOrderSuccess({ id: newOrderId });
      setIsSubmitting(false);
    }, 1200);
  };

  return (
    <div className="bg-white animate-fadeIn pb-24 lg:pb-0 relative">
      
      {/* Flash Sale Banner */}
      <div className="bg-red-600 text-white py-3 text-center overflow-hidden">
        <div className="container mx-auto px-4 flex items-center justify-center space-x-4">
          <span className="text-[10px] md:text-xs font-black uppercase tracking-[0.2em] animate-pulse">
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
            <div className="relative aspect-[4/5] min-h-[500px] w-full bg-gray-50 rounded-2xl overflow-hidden shadow-sm group border border-gray-100 flex items-center justify-center">
              {product.video ? (
                <video 
                  src={product.video} 
                  poster={product.image}
                  autoPlay 
                  muted 
                  loop 
                  playsInline 
                  className="w-full h-full object-cover" 
                />
              ) : (
                <img 
                  src={product.image} 
                  alt={product.name} 
                  className="w-full h-full object-cover" 
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=800';
                  }}
                />
              )}
              
              <div className="absolute top-6 left-6 z-10">
                <div className="bg-black/80 backdrop-blur-md text-white px-4 py-2 rounded-full flex items-center space-x-2 border border-white/10 shadow-lg">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-ping"></span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-red-100">11 pieces remaining</span>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 flex flex-col justify-center relative">
            
            {/* NEW: Fake Purchase Notification positioned "OVER DESCRIPTION" */}
            <div className={`absolute -top-4 right-0 z-40 transition-all duration-700 transform ${showPurchaseNotice ? 'translate-y-0 opacity-100' : '-translate-y-8 opacity-0 pointer-events-none'}`}>
              <div className="bg-white/95 backdrop-blur-xl border border-blue-100 p-4 rounded-2xl shadow-2xl flex items-center space-x-4 min-w-[280px]">
                <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center shrink-0 animate-bounce">
                  <i className="fas fa-shopping-bag text-xs"></i>
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-600 mb-0.5">Live Acquisition</p>
                  <p className="text-[11px] font-bold text-black leading-tight">
                    {purchaseNotice?.name} from {purchaseNotice?.city}
                    <br/><span className="text-gray-400 italic">ordered this item just now</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-3 mb-4">
              <span className="text-gray-500 font-bold uppercase tracking-widest text-[11px]">{product.category} Series</span>
              <div className="h-1 w-1 bg-gray-300 rounded-full"></div>
              <span className="text-red-600 font-black uppercase tracking-widest text-[11px] flex items-center">
                <i className="fas fa-fire mr-1"></i> High Demand
              </span>
            </div>

            <h1 className="text-4xl lg:text-7xl font-serif font-bold tracking-tight text-black mb-6 leading-tight uppercase italic">{product.name}</h1>
            
            <div className="flex items-center space-x-6 mb-8">
              <div className="flex flex-col">
                 <span className="text-4xl font-black text-black tracking-tighter">Rs. {product.price.toLocaleString()}</span>
                 <span className="text-[11px] text-gray-400 line-through font-bold">Rs. {(product.price * 1.25).toLocaleString()}</span>
              </div>
              <span className="text-xs font-bold text-blue-600 bg-blue-50 px-4 py-1.5 rounded-full uppercase tracking-wider border border-blue-100 italic font-serif">Order Now Pay Cash On Delivery</span>
            </div>

            {/* Dynamic Live Shopper Urgency */}
            <div className="mb-10 flex items-center space-x-2 text-gray-500 transition-all">
               <i className="fas fa-eye text-sm text-green-500 animate-pulse"></i>
               <span className="text-xs font-bold uppercase tracking-widest">
                 <span className="text-black inline-block min-w-[20px]">{viewers}</span> people watching this timepiece right now
               </span>
            </div>

            <p className="text-gray-600 text-lg leading-relaxed mb-6 max-w-2xl font-medium">{product.description}</p>

            {/* Social Proof - 10,000+ Happy Customers (Below Description) */}
            <div className="mb-10 flex items-center space-x-5 bg-gray-50/50 p-6 rounded-2xl border border-gray-100 max-w-fit shadow-sm">
              <div className="flex -space-x-3">
                <img className="inline-block h-12 w-12 rounded-full ring-4 ring-white object-cover" src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=120&auto=format&fit=crop" alt="" />
                <img className="inline-block h-12 w-12 rounded-full ring-4 ring-white object-cover" src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=120&auto=format&fit=crop" alt="" />
                <img className="inline-block h-12 w-12 rounded-full ring-4 ring-white object-cover" src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=120&auto=format&fit=crop" alt="" />
                <img className="inline-block h-12 w-12 rounded-full ring-4 ring-white object-cover" src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=120&auto=format&fit=crop" alt="" />
                <img className="inline-block h-12 w-12 rounded-full ring-4 ring-white object-cover" src="https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=120&auto=format&fit=crop" alt="" />
                <div className="h-12 w-12 rounded-full ring-4 ring-white bg-black flex items-center justify-center text-[10px] font-black text-white">+82</div>
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-black uppercase tracking-[0.2em] text-black italic">10,000+ Happy Customers</span>
                <div className="flex text-yellow-500 mt-1 space-x-1">
                  <i className="fas fa-star text-[10px]"></i>
                  <i className="fas fa-star text-[10px]"></i>
                  <i className="fas fa-star text-[10px]"></i>
                  <i className="fas fa-star text-[10px]"></i>
                  <i className="fas fa-star text-[10px]"></i>
                  <span className="text-[10px] text-gray-400 font-black ml-2 uppercase">5.0 Rating</span>
                </div>
              </div>
            </div>

            {product.variants && product.variants.length > 0 && (
              <div className="mb-10">
                <h4 className="text-[10px] font-black uppercase tracking-widest mb-4 text-gray-400 italic">Select Specification:</h4>
                <div className="flex flex-wrap gap-3">
                  {product.variants.map(v => (
                    <button 
                      key={v.id}
                      onClick={() => setSelectedVariant(v.id)}
                      className={`px-6 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${selectedVariant === v.id ? 'bg-black text-white border-black shadow-xl scale-105' : 'bg-white text-gray-400 border-gray-100 hover:border-black hover:text-black'}`}
                    >
                      {v.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              <div className="flex items-center border border-gray-100 rounded-xl px-4 py-2 bg-gray-50/50">
                <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="p-3 text-gray-400 hover:text-black transition"><i className="fas fa-minus text-xs"></i></button>
                <span className="w-12 text-center font-black text-lg">{quantity}</span>
                <button onClick={() => setQuantity(quantity + 1)} className="p-3 text-gray-400 hover:text-black transition"><i className="fas fa-plus text-xs"></i></button>
              </div>
              <button 
                onClick={() => setIsOrderModalOpen(true)}
                className="flex-grow bg-black text-white font-black text-[11px] uppercase tracking-[0.3em] py-6 px-12 rounded-xl hover:bg-blue-600 transition shadow-2xl active:scale-[0.98] relative overflow-hidden group italic"
              >
                <span className="relative z-10">Order Now — Cash On Delivery</span>
                <div className="absolute inset-0 bg-blue-700 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-8 border-t border-gray-100 pt-12">
              {TRUST_BADGES.map((badge, idx) => (
                <div key={idx} className="flex items-center space-x-5 group">
                  <div className="w-12 h-12 flex items-center justify-center bg-gray-50 rounded-2xl text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all duration-500">
                    <i className={`fas ${badge.icon} text-xl`}></i>
                  </div>
                  <span className="text-[11px] font-black uppercase tracking-widest text-gray-500">{badge.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {isOrderModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fadeIn">
          <div className="bg-white rounded-[2.5rem] w-full max-w-xl overflow-hidden shadow-2xl border border-gray-100 overflow-y-auto max-h-[95vh] custom-scrollbar">
            <div className="p-8 md:p-12">
              {!orderSuccess ? (
                <>
                  <div className="flex justify-between items-center mb-8">
                    <h2 className="text-3xl font-serif font-bold uppercase italic tracking-tighter text-black">Acquisition Registry</h2>
                    <button onClick={() => setIsOrderModalOpen(false)} className="text-gray-400 hover:text-black transition">
                      <i className="fas fa-times text-2xl"></i>
                    </button>
                  </div>
                  
                  {/* Trust Badge / Happy Customers inside Modal */}
                  <div className="mb-8 flex items-center space-x-4 bg-gray-50/80 p-4 rounded-2xl border border-gray-100">
                    <div className="flex -space-x-2">
                      <img className="inline-block h-8 w-8 rounded-full ring-2 ring-white object-cover" src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=80&auto=format&fit=crop" alt="" />
                      <img className="inline-block h-8 w-8 rounded-full ring-2 ring-white object-cover" src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=80&auto=format&fit=crop" alt="" />
                      <img className="inline-block h-8 w-8 rounded-full ring-2 ring-white object-cover" src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=80&auto=format&fit=crop" alt="" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-black">10,000+ Happy Customers</p>
                      <div className="flex text-yellow-500 space-x-0.5">
                        <i className="fas fa-star text-[8px]"></i><i className="fas fa-star text-[8px]"></i><i className="fas fa-star text-[8px]"></i><i className="fas fa-star text-[8px]"></i><i className="fas fa-star text-[8px]"></i>
                      </div>
                    </div>
                  </div>

                  <form onSubmit={handleQuickOrder} className="space-y-6">
                    <div className="p-6 bg-gray-50 rounded-2xl border border-gray-100 flex items-center space-x-6 mb-4 text-black">
                      <img src={product.image} className="w-16 h-16 rounded-xl object-cover shadow-md" />
                      <div>
                        <p className="font-black text-sm uppercase tracking-tight">{product.name}</p>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">
                          {product.variants?.find(v => v.id === selectedVariant)?.name || 'Standard Edition'} • PKR {(product.price * quantity).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-black uppercase tracking-widest text-gray-400 mb-2 px-1 italic">Recipient Full Name</label>
                      <input required type="text" className="w-full bg-white border border-gray-200 rounded-xl px-5 py-4 font-bold focus:ring-1 focus:ring-black outline-none transition text-black" placeholder="Your Name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-[11px] font-black uppercase tracking-widest text-gray-400 mb-2 px-1 italic">Active Phone Contact</label>
                      <input required type="tel" className="w-full bg-white border border-gray-200 rounded-xl px-5 py-4 font-bold focus:ring-1 focus:ring-black outline-none transition text-black" placeholder="03XX-XXXXXXX" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="block text-[11px] font-black uppercase tracking-widest text-gray-400 mb-2 px-1 italic">City</label>
                        <input required type="text" className="w-full bg-white border border-gray-200 rounded-xl px-5 py-4 font-bold focus:ring-1 focus:ring-black outline-none transition text-black" placeholder="e.g. Karachi" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} />
                      </div>
                      <div className="flex flex-col justify-end pb-4 text-right">
                         <span className="text-[10px] font-black text-green-600 uppercase italic tracking-widest">Free Shipping</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-black uppercase tracking-widest text-gray-400 mb-2 px-1 italic">Logistical Address</label>
                      <textarea required className="w-full bg-white border border-gray-200 rounded-xl px-5 py-4 font-bold focus:ring-1 focus:ring-black outline-none transition h-24 resize-none text-black" placeholder="Full Detailed Shipping Address..." value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
                    </div>
                    <button type="submit" disabled={isSubmitting} className="w-full bg-black text-white font-black uppercase py-6 rounded-xl hover:bg-blue-600 transition shadow-2xl tracking-[0.2em] text-sm italic">
                      {isSubmitting ? <i className="fas fa-circle-notch fa-spin"></i> : `Order Now — Cash On Delivery`}
                    </button>
                  </form>
                </>
              ) : (
                <div className="text-center py-10">
                  <div className="w-24 h-24 bg-black text-white rounded-full flex items-center justify-center mx-auto mb-10 text-4xl shadow-2xl">
                    <i className="fas fa-check"></i>
                  </div>
                  <h3 className="text-4xl font-serif font-bold uppercase mb-3 italic text-black">Registry Logged</h3>
                  <p className="text-gray-500 mb-10 font-bold italic text-sm tracking-widest">Order Ledger ID: <span className="text-black">#{orderSuccess.id}</span></p>
                  <div className="bg-gray-50 p-8 rounded-[2rem] mb-12 border border-gray-100 shadow-inner">
                    <p className="text-gray-700 font-black text-[11px] uppercase tracking-[0.3em] italic leading-relaxed">
                      Your master timepiece will be escorted by our logistics partner within 3-5 business days. Settlement due upon arrival.
                    </p>
                  </div>
                  <button onClick={() => { setIsOrderModalOpen(false); setOrderSuccess(null); }} className="w-full bg-black text-white font-black uppercase tracking-[0.4em] py-5 rounded-xl shadow-lg hover:bg-gray-800 transition text-xs italic">Back to ITX Collection</button>
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
