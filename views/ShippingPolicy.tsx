
import React from 'react';

const ShippingPolicy: React.FC = () => {
  return (
    <div className="container mx-auto px-6 py-24 max-w-4xl animate-fadeIn text-black">
      <h1 className="text-5xl font-serif font-bold italic mb-12 border-b pb-6 text-black">Shipping & Delivery Policy</h1>
      
      <div className="prose prose-lg text-gray-800 space-y-8 font-medium italic leading-relaxed">
        <section>
          <h2 className="text-2xl font-black uppercase tracking-widest mb-4 italic text-black">1. Delivery Timeframes</h2>
          <p>
            Orders within major cities are typically delivered within 2-3 business days. Remote areas may take 4-5 business days. Once an order is placed, you will receive confirmation of your shipment's status.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-black uppercase tracking-widest mb-4 italic text-black">2. Shipping Charges</h2>
          <p>
            <strong>ITX SHOP MEER</strong> offers FREE EXPRESS SHIPPING on all orders nationwide across Pakistan. We do not apply any hidden shipping fees at checkout.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-black uppercase tracking-widest mb-4 italic text-black">3. Tracking</h2>
          <p>
            Once your order is handed over to our logistical partners, you will receive a tracking ID via SMS or email to monitor your shipment's journey.
          </p>
        </section>

        <section className="bg-blue-50 p-8 rounded-3xl border border-blue-100 mt-12">
          <p className="text-sm font-black uppercase tracking-widest text-blue-800 italic">
            For logistical inquiries, please contact our dispatch desk at meer.malika6644@gmail.com.
          </p>
        </section>
      </div>
    </div>
  );
};

export default ShippingPolicy;
