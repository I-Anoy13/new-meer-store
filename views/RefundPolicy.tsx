import React from 'react';

const RefundPolicy: React.FC = () => {
  return (
    <div className="container mx-auto px-6 py-24 max-w-4xl animate-fadeIn text-black">
      <h1 className="text-5xl font-serif font-bold italic mb-12 border-b pb-6 text-black">Refund Policy</h1>
      
      <div className="prose prose-lg text-gray-800 space-y-8 font-medium italic leading-relaxed">
        <p>
          We have a <strong>7-day return policy</strong>, which means you have 7 days after receiving your item to request a return.
        </p>

        <p>
          To be eligible for a return, your item must be in the same condition that you received it, unworn or unused, with tags, and in its original packaging. You’ll also need the receipt or proof of purchase.
        </p>

        <section>
          <h2 className="text-2xl font-black uppercase tracking-widest mb-4 italic text-black">How to Start a Return</h2>
          <p>
            To start a return, you can contact us at <strong>meer.malika6644@gmail.com</strong>. Please note that returns will need to be sent to our distribution hub in Karachi.
          </p>
          <p className="mt-4">
            If your return is accepted, we’ll send you a return shipping label, as well as instructions on how and where to send your package. Items sent back to us without first requesting a return will not be accepted.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-black uppercase tracking-widest mb-4 italic text-black">Damages and issues</h2>
          <p>
            Please inspect your order upon reception and contact us immediately if the item is defective, damaged or if you receive the wrong item, so that we can evaluate the issue and make it right.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-black uppercase tracking-widest mb-4 italic text-black">Exceptions / non-returnable items</h2>
          <p>
            Certain types of items cannot be returned, like custom products (such as special orders or personalized items). Unfortunately, we cannot accept returns on sale items or gift cards.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-black uppercase tracking-widest mb-4 italic text-black">Exchanges</h2>
          <p>
            The fastest way to ensure you get what you want is to return the item you have, and once the return is accepted, make a separate purchase for the new item.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-black uppercase tracking-widest mb-4 italic text-black">Refunds</h2>
          <p>
            We will notify you once we’ve received and inspected your return, and let you know if the refund was approved or not. If approved, you’ll be automatically refunded on your original payment method (Bank Transfer or Mobile Wallet for COD orders) within 10 business days.
          </p>
          <p className="mt-4">
            If more than 15 business days have passed since we’ve approved your return, please contact us at <strong>meer.malika6644@gmail.com</strong>.
          </p>
        </section>
      </div>
    </div>
  );
};

export default RefundPolicy;
