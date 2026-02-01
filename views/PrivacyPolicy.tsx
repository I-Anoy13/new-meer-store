
import React from 'react';

const PrivacyPolicy: React.FC = () => {
  return (
    <div className="container mx-auto px-6 py-24 max-w-4xl animate-fadeIn text-black">
      <h1 className="text-5xl font-serif font-bold italic mb-12 border-b pb-6">Privacy Policy</h1>
      <p className="text-sm text-gray-500 mb-8 font-bold uppercase tracking-widest">Last updated: January 22, 2026</p>
      
      <div className="prose prose-lg text-gray-800 space-y-8 font-medium italic leading-relaxed">
        <p>
          <strong>ITX SHOP MEER</strong> operates this store and website, including all related information, content, features, tools, products and services, in order to provide you, the customer, with a curated shopping experience (the "Services"). ITX SHOP MEER is powered by independent open-source technologies, which enables us to provide the Services to you. This Privacy Policy describes how we collect, use, and disclose your personal information when you visit, use, or make a purchase or other transaction using the Services or otherwise communicate with us. If there is a conflict between our Terms of Service and this Privacy Policy, this Privacy Policy controls with respect to the collection, processing, and disclosure of your personal information.
        </p>

        <p>
          Please read this Privacy Policy carefully. By using and accessing any of the Services, you acknowledge that you have read this Privacy Policy and understand the collection, use, and disclosure of your information as described in this Privacy Policy.
        </p>

        <section>
          <h2 className="text-2xl font-black uppercase tracking-widest mb-4 italic text-black">Personal Information We Collect or Process</h2>
          <p>
            When we use the term "personal information," we are referring to information that identifies or can reasonably be linked to you or another person. Personal information does not include information that is collected anonymously or that has been de-identified, so that it cannot identify or be reasonably linked to you. We may collect or process the following categories of personal information, including inferences drawn from this personal information:
          </p>
          <ul className="list-disc pl-6 space-y-4 mt-6">
            <li><strong>Contact details:</strong> including your name, address, billing address, shipping address, phone number, and email address.</li>
            <li><strong>Financial information:</strong> including transaction details, payment confirmation and other payment details for Cash on Delivery processing.</li>
            <li><strong>Account information:</strong> including your preferences and settings.</li>
            <li><strong>Transaction information:</strong> including the items you view, put in your cart, or purchase, and your past transactions.</li>
            <li><strong>Communications with us:</strong> including the information you include in communications with us, for example, when sending a customer support inquiry.</li>
            <li><strong>Device information:</strong> including information about your device, browser, or network connection, your IP address, and other unique identifiers.</li>
            <li><strong>Usage information:</strong> including information regarding your interaction with the Services, including how and when you interact with or navigate the Services.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-black uppercase tracking-widest mb-4 italic text-black">How We Use Your Personal Information</h2>
          <p>
            Depending on how you interact with us or which of the Services you use, we may use personal information for:
          </p>
          <ul className="list-disc pl-6 space-y-4 mt-6">
            <li><strong>Provide, Tailor, and Improve the Services:</strong> Processing orders, fulfilling shipments, and creating a customized shopping experience.</li>
            <li><strong>Marketing and Advertising:</strong> Show you online advertisements for products or services based on your activity, including TikTok advertising measurement.</li>
            <li><strong>Security and Fraud Prevention:</strong> Detect and prevent fraudulent activity and protect our business.</li>
            <li><strong>Communicating with You:</strong> Effective customer support and maintaining our relationship.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-black uppercase tracking-widest mb-4 italic text-black">Security and Retention</h2>
          <p>
            Please be aware that no security measures are perfect or impenetrable. We recommend that you do not use unsecure channels to communicate sensitive or confidential information to us.
          </p>
        </section>

        <section className="bg-gray-50 p-8 rounded-3xl border border-gray-100">
          <h2 className="text-2xl font-black uppercase tracking-widest mb-4 italic text-black">Contact</h2>
          <p>
            Should you have any questions about our privacy practices or this Privacy Policy, or if you would like to exercise any of the rights available to you, please email us at <strong>meer.malika6644@gmail.com</strong>.
          </p>
          <p className="mt-4 font-black">ITX SHOP MEER</p>
        </section>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
