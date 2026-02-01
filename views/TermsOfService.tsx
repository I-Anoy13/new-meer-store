
import React from 'react';

const TermsOfService: React.FC = () => {
  return (
    <div className="container mx-auto px-6 py-24 max-w-4xl animate-fadeIn">
      <h1 className="text-5xl font-serif font-bold italic mb-12 border-b pb-6">Terms of Service</h1>
      <div className="prose prose-lg text-gray-600 space-y-8 font-medium italic">
        <section>
          <h2 className="text-2xl font-black text-black uppercase tracking-widest mb-4 italic">1. Agreement to Terms</h2>
          <p>By accessing ITX SHOP MEER, you agree to be bound by these Terms of Service. If you do not agree, please refrain from using our services.</p>
        </section>
        <section>
          <h2 className="text-2xl font-black text-black uppercase tracking-widest mb-4 italic">2. Product Authenticity</h2>
          <p>All timepieces sold on ITX SHOP MEER are guaranteed authentic. We specialize in high-performance horology and artisan luxury.</p>
        </section>
        <section>
          <h2 className="text-2xl font-black text-black uppercase tracking-widest mb-4 italic">3. Order Acceptance</h2>
          <p>We reserve the right to refuse or cancel any order for reasons including but not limited to: product availability, errors in pricing, or suspicion of fraudulent activity.</p>
        </section>
        <section>
          <h2 className="text-2xl font-black text-black uppercase tracking-widest mb-4 italic">4. Limitation of Liability</h2>
          <p>ITX SHOP MEER shall not be liable for any indirect, incidental, or consequential damages resulting from the use or inability to use our products.</p>
        </section>
      </div>
    </div>
  );
};

export default TermsOfService;
