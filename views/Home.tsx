
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
    <div className="animate-fadeIn">
      {/* Hero Section */}
      <section className="relative h-[80vh] bg-black text-white flex items-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1614164185128-e4ec99c436d7?auto=format&fit=crop&q=80&w=2000" 
            className="w-full h-full object-cover opacity-30" 
            alt="Luxury Watch Background"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/40 to-transparent"></div>
        </div>
        
        <div className="container mx-auto px-6 relative z-10">
          <div className="max-w-3xl">
            <span className="text-blue-500 font-black uppercase tracking-[0.4em] text-xs mb-4 block animate-slideDown">Est. 2024 • Horological Collection</span>
            <h1 className="text-6xl md:text-8xl font-black mb-6 tracking-tighter uppercase italic leading-[0.9]">
              Horological <br/><span className="text-white/40">Mastery</span>
            </h1>
            <p className="text-gray-300 text-lg mb-10 max-w-xl font-medium leading-relaxed italic border-l-2 border-blue-600 pl-6">
              Curating Pakistan's most exclusive timepieces. Experience artisan engineering delivered via our premium Cash On Delivery service.
            </p>
            <div className="flex space-x-4">
              <button onClick={() => document.getElementById('collection')?.scrollIntoView({behavior: 'smooth'})} className="bg-white text-black font-black px-10 py-5 rounded-full text-xs uppercase tracking-[0.2em] hover:bg-blue-600 hover:text-white transition-all transform hover:scale-105">
                Explore Collection
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section id="collection" className="container mx-auto px-4 py-24">
        <div className="flex flex-col md:flex-row items-end justify-between mb-16 gap-4">
          <div className="max-w-xl">
            <span className="text-blue-600 font-black uppercase tracking-widest text-[10px] mb-2 block">Curated Releases</span>
            <h2 className="text-4xl font-black uppercase italic tracking-tighter text-black">The Collection</h2>
          </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-12">
          {products.map(product => (
            <Link key={product.id} to={`/product/${product.id}`} className="group">
              <div className="relative aspect-[4/5] mb-6 overflow-hidden bg-gray-50 rounded-[2rem] shadow-sm">
                <img 
                  src={product.image} 
                  alt={product.name} 
                  onError={handleImageError}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000"
                />
                <div className="absolute top-6 left-6 bg-white/90 backdrop-blur-md px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest text-black shadow-sm">
                  {product.category}
                </div>
              </div>
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-black uppercase italic tracking-tighter group-hover:text-blue-600 transition-colors">{product.name}</h3>
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mt-1 italic">Rs. {product.price.toLocaleString()}</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
                  <i className="fas fa-arrow-right"></i>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
};

// Fixed: Added default export for Home component
export default Home;
