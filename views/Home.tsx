
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
      <section className="relative h-[50vh] md:h-[60vh] bg-black text-white flex items-center">
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1614164185128-e4ec99c436d7?auto=format&fit=crop&q=80&w=2000" 
            className="w-full h-full object-cover opacity-40" 
            alt="Watch Banner"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent"></div>
        </div>
        
        <div className="container mx-auto px-6 relative z-10">
          <div className="max-w-2xl">
            <h1 className="text-2xl md:text-4xl font-bold mb-4 tracking-tight leading-tight">
              Premium <br/>Timepieces
            </h1>
            <p className="text-gray-300 text-sm md:text-base mb-8 max-w-lg font-medium leading-relaxed">
              Discover Pakistan's exclusive collection of luxury watches. High-performance horology delivered straight to your door with Cash on Delivery.
            </p>
            <button onClick={() => document.getElementById('collection')?.scrollIntoView({behavior: 'smooth'})} className="bg-white text-black font-bold px-6 py-3 rounded-lg text-xs uppercase hover:bg-gray-200 transition-all tracking-wide">
              Shop the Collection
            </button>
          </div>
        </div>
      </section>

      <section id="collection" className="container mx-auto px-4 py-16">
        <div className="mb-10 text-center md:text-left">
            <h2 className="text-xl font-bold text-black uppercase tracking-tight">New Arrivals</h2>
            <div className="h-0.5 w-10 bg-blue-600 mt-2 mx-auto md:mx-0"></div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-10">
          {products.map(product => (
            <Link key={product.id} to={`/product/${product.id}`} className="group block">
              <div className="relative aspect-square mb-4 overflow-hidden bg-gray-50 rounded-xl border border-gray-100 group-hover:border-blue-200 transition-all">
                <img 
                  src={product.image} 
                  alt={product.name} 
                  onError={handleImageError}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute top-4 left-4 bg-white/90 px-2 py-1 rounded text-[10px] font-bold uppercase text-black tracking-wide">
                  {product.category}
                </div>
              </div>
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-sm font-bold text-black group-hover:text-blue-600 transition-colors uppercase tracking-tight">{product.name}</h3>
                  <p className="text-sm font-semibold text-gray-500 mt-1">Rs. {product.price.toLocaleString()}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="bg-gray-50 py-16">
         <div className="container mx-auto px-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
               <div className="p-8 bg-white rounded-xl shadow-sm border border-gray-100">
                  <i className="fas fa-check-circle text-xl text-blue-600 mb-4"></i>
                  <h4 className="font-bold uppercase text-xs tracking-wide mb-2">Verified Quality</h4>
                  <p className="text-xs text-gray-500 leading-relaxed">Each piece is inspected for accuracy and craftsmanship.</p>
               </div>
               <div className="p-8 bg-white rounded-xl shadow-sm border border-gray-100">
                  <i className="fas fa-truck-fast text-xl text-blue-600 mb-4"></i>
                  <h4 className="font-bold uppercase text-xs tracking-wide mb-2">Free Delivery</h4>
                  <p className="text-xs text-gray-500 leading-relaxed">Fast Cash on Delivery available across Pakistan.</p>
               </div>
               <div className="p-8 bg-white rounded-xl shadow-sm border border-gray-100">
                  <i className="fas fa-history text-xl text-blue-600 mb-4"></i>
                  <h4 className="font-bold uppercase text-xs tracking-wide mb-2">Easy Returns</h4>
                  <p className="text-xs text-gray-500 leading-relaxed">7-day hassle-free inspection and return period.</p>
               </div>
            </div>
         </div>
      </section>
    </div>
  );
};

export default Home;
