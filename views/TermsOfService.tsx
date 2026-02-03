
import React from 'react';

const TermsOfService: React.FC = () => {
  return (
    <div className="container mx-auto px-6 py-16 max-w-4xl animate-fadeIn">
      <h1 className="text-2xl font-bold mb-8 border-b border-gray-100 pb-4 uppercase tracking-tight text-black">Terms of Service</h1>
      <div className="space-y-8 text-sm text-gray-700 leading-relaxed">
        <section>
          <h2 className="text-sm font-bold text-black uppercase tracking-wide mb-3">1. Agreement to Terms</h2>
          <p>By accessing ITX SHOP MEER, you agree to be bound by these Terms of Service. If you do not agree, please refrain from using our services.</p>
        </section>
        <section>
          <h2 className="text-sm font-bold text-black uppercase tracking-wide mb-3">2. Product Authenticity</h2>
          <p>All timepieces sold on ITX SHOP MEER are guaranteed authentic. We specialize in high-performance horology and artisan luxury.</p>
        </section>
        <section>
          <h2 className="text-sm font-bold text-black uppercase tracking-wide mb-3">3. Order Acceptance</h2>
          <p>We reserve the right to refuse or cancel any order for reasons including but not limited to: product availability, errors in pricing, or suspicion of fraudulent activity.</p>
        </section>
        <section>
          <h2 className="text-sm font-bold text-black uppercase tracking-wide mb-3">4. Limitation of Liability</h2>
          <p>ITX SHOP MEER shall not be liable for any indirect, incidental, or consequential damages resulting from the use or inability to use our products.</p>
        </section>
      </div>
    </div>
  );
};

export default TermsOfService;
