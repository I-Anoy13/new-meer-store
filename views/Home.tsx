
import React from 'react';
import { Link } from 'react-router-dom';
import { Product } from '../types';
import { PLACEHOLDER_IMAGE } from '../constants';

interface HomeProps {
  products: Product[];
}

const Home: React.FC<HomeProps> = ({ products }) => {
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    e.currentTarget.src = PLACEHOLDER_IMAGE;
  };

  return (
    <div className="animate-fadeIn pb-12">
      {/* Hero Section - Optimized for Mobile */}
      <section className="relative h-[85vh] md:h-[80vh] bg-black text-white flex items-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1614164185128-e4ec99c436d7?auto=format&fit=crop&q=80&w=2000" 
            className="w-full h-full object-cover opacity-30 scale-105" 
            alt="Luxury Watch Background"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent md:bg-gradient-to-r"></div>
        </div>
        
        <div className="container mx-auto px-6 relative z-10">
          <div className="max-w-3xl">
            <span className="text-blue-500 font-black uppercase tracking-[0.3em] md:tracking-[0.4em] text-[9px] md:text-xs mb-4 block animate-slideDown italic">Est. 2024 • Horological Boutique</span>
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-black mb-6 tracking-tighter uppercase italic leading-[1.0] md:leading-[0.9]">
              Horological <br/><span className="text-white/30">Excellence</span>
            </h1>
            <p className="text-gray-300 text-base md:text-lg mb-10 max-w-xl font-medium leading-relaxed italic border-l-2 border-blue-600 pl-4 md:pl-6">
              Curating Pakistan's most exclusive artisan timepieces. Premium horology delivered via our verified Cash On Delivery network.
            </p>
            <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
              <button onClick={() => document.getElementById('collection')?.scrollIntoView({behavior: 'smooth'})} className="bg-white text-black font-black px-10 py-5 rounded-full text-[11px] uppercase tracking-[0.2em] hover:bg-blue-600 hover:text-white transition-all transform active:scale-95 italic text-center">
                Explore Collection
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Products - Grid Polished for Mobile */}
      <section id="collection" className="container mx-auto px-4 py-12 md:py-24">
        <div className="flex flex-col md:flex-row items-end justify-between mb-10 md:mb-16 gap-4">
          <div className="max-w-xl">
            <span className="text-blue-600 font-black uppercase tracking-widest text-[9px] md:text-[10px] mb-2 block italic">Verified Masterpieces</span>
            <h2 className="text-3xl md:text-4xl font-black uppercase italic tracking-tighter text-black">The Boutique Collection</h2>
          </div>
          <div className="hidden md:block h-px flex-grow bg-gray-100 mx-12"></div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-12 lg:gap-16">
          {products.map(product => (
            <Link key={product.id} to={`/product/${product.id}`} className="group block">
              <div className="relative aspect-[4/5] mb-5 overflow-hidden bg-gray-50 rounded-[1.5rem] md:rounded-[2.5rem] shadow-sm border border-transparent group-hover:border-gray-100 transition-all">
                <img 
                  src={product.image} 
                  alt={product.name} 
                  onError={handleImageError}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000"
                />
                <div className="absolute top-4 left-4 md:top-6 md:left-6 bg-white/90 backdrop-blur-md px-4 py-1.5 rounded-full text-[8px] md:text-[9px] font-black uppercase tracking-widest text-black shadow-sm italic">
                  {product.category}
                </div>
                {/* Mobile quick view icon */}
                <div className="absolute bottom-4 right-4 bg-black/20 backdrop-blur-md p-3 rounded-full md:hidden">
                   <i className="fas fa-arrow-right text-white text-xs"></i>
                </div>
              </div>
              <div className="flex justify-between items-start px-1">
                <div>
                  <h3 className="text-lg md:text-xl font-black uppercase italic tracking-tighter group-hover:text-blue-600 transition-colors leading-tight">{product.name}</h3>
                  <div className="flex items-center space-x-2 mt-1">
                    <p className="text-[10px] md:text-[11px] font-black uppercase tracking-widest text-blue-600 italic">Rs. {product.price.toLocaleString()}</p>
                    <span className="text-[8px] text-gray-300 font-black italic line-through">Rs. {(product.price / 0.75).toLocaleString()}</span>
                  </div>
                </div>
                <div className="hidden md:flex w-10 h-10 rounded-full bg-black text-white items-center justify-center opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0 shadow-lg shadow-black/20">
                  <i className="fas fa-arrow-right text-xs"></i>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Trust Section for Mobile Polish */}
      <section className="bg-gray-50 py-16 mt-12">
         <div className="container mx-auto px-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
               <div className="space-y-4">
                  <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto shadow-sm text-blue-600">
                     <i className="fas fa-shield-alt text-2xl"></i>
                  </div>
                  <h4 className="font-black uppercase italic tracking-widest text-sm">Verified Authentic</h4>
                  <p className="text-xs text-gray-500 italic px-8">Every timepiece undergoes rigorous horological inspection.</p>
               </div>
               <div className="space-y-4">
                  <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto shadow-sm text-blue-600">
                     <i className="fas fa-truck-fast text-2xl"></i>
                  </div>
                  <h4 className="font-black uppercase italic tracking-widest text-sm">Express COD</h4>
                  <p className="text-xs text-gray-500 italic px-8">Nationwide doorstep delivery with cash on delivery security.</p>
               </div>
               <div className="space-y-4">
                  <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto shadow-sm text-blue-600">
                     <i className="fas fa-award text-2xl"></i>
                  </div>
                  <h4 className="font-black uppercase italic tracking-widest text-sm">7-Day Warranty</h4>
                  <p className="text-xs text-gray-500 italic px-8">Complete peace of mind with our standard return protocol.</p>
               </div>
            </div>
         </div>
      </section>
    </div>
  );
};

export default Home;
