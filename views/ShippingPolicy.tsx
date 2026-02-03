
import React from 'react';

const ShippingPolicy: React.FC = () => {
  return (
    <div className="container mx-auto px-6 py-16 max-w-4xl animate-fadeIn text-black">
      <h1 className="text-2xl font-bold mb-8 border-b border-gray-100 pb-4 uppercase tracking-tight text-black">Shipping & Delivery Policy</h1>
      
      <div className="space-y-8 text-sm text-gray-700 leading-relaxed font-normal">
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wide mb-3 text-black">1. Delivery Timeframes</h2>
          <p>
            Orders within major cities are typically delivered within 2-3 business days. Remote areas may take 4-5 business days.
          </p>
        </section>

        <section>
          <h2 className="text-sm font-bold uppercase tracking-wide mb-3 text-black">2. Shipping Charges</h2>
          <p>
            <strong>ITX SHOP MEER</strong> offers FREE EXPRESS SHIPPING on all orders nationwide across Pakistan.
          </p>
        </section>

        <section className="bg-blue-50 p-6 rounded-xl border border-blue-100 mt-12">
          <p className="text-[10px] font-bold uppercase tracking-widest text-blue-800">
            For logistical inquiries: meer.malika6644@gmail.com
          </p>
        </section>
      </div>
    </div>
  );
};

export default ShippingPolicy;
