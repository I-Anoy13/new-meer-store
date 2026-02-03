
import React from 'react';

const RefundPolicy: React.FC = () => {
  return (
    <div className="container mx-auto px-6 py-16 max-w-4xl animate-fadeIn text-black">
      <h1 className="text-2xl font-bold mb-8 border-b border-gray-100 pb-4 uppercase tracking-tight text-black">Refund Policy</h1>
      
      <div className="space-y-8 text-sm text-gray-700 leading-relaxed font-normal">
        <p>
          We have a <strong>7-day return policy</strong>, which means you have 7 days after receiving your item to request a return.
        </p>

        <p>
          To be eligible for a return, your item must be in the same condition that you received it, unworn or unused, with tags, and in its original packaging.
        </p>

        <section>
          <h2 className="text-sm font-bold uppercase tracking-wide mb-3 text-black">How to Start a Return</h2>
          <p>
            To start a return, contact us at <strong>meer.malika6644@gmail.com</strong>. Returns must be sent to our hub in Karachi.
          </p>
        </section>

        <section>
          <h2 className="text-sm font-bold uppercase tracking-wide mb-3 text-black">Exchanges</h2>
          <p>
            The fastest way to ensure you get what you want is to return the item you have, and once the return is accepted, make a separate purchase for the new item.
          </p>
        </section>

        <section>
          <h2 className="text-sm font-bold uppercase tracking-wide mb-3 text-black">Refunds</h2>
          <p>
            We will notify you once we’ve received and inspected your return. If approved, you’ll be automatically refunded on your original payment method within 10 business days.
          </p>
        </section>
      </div>
    </div>
  );
};

export default RefundPolicy;
