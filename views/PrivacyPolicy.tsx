
import React from 'react';

const PrivacyPolicy: React.FC = () => {
  return (
    <div className="container mx-auto px-6 py-16 max-w-4xl animate-fadeIn text-black">
      <h1 className="text-2xl font-bold mb-8 border-b border-gray-100 pb-4 uppercase tracking-tight">Privacy Policy</h1>
      <p className="text-[10px] text-gray-400 mb-8 font-bold uppercase tracking-widest">Last updated: January 22, 2026</p>
      
      <div className="space-y-8 text-sm text-gray-700 leading-relaxed font-normal">
        <p>
          <strong>ITX SHOP MEER</strong> operates this store and website, including all related information, content, features, tools, products and services, in order to provide you, the customer, with a curated shopping experience (the "Services"). ITX SHOP MEER is powered by independent open-source technologies, which enables us to provide the Services to you. This Privacy Policy describes how we collect, use, and disclose your personal information when you visit, use, or make a purchase or other transaction using the Services or otherwise communicate with us.
        </p>

        <p>
          Please read this Privacy Policy carefully. By using and accessing any of the Services, you acknowledge that you have read this Privacy Policy and understand the collection, use, and disclosure of your information as described in this Privacy Policy.
        </p>

        <section>
          <h2 className="text-sm font-bold uppercase tracking-wide mb-4 text-black">Personal Information We Collect</h2>
          <p>
            We may collect or process the following categories of personal information:
          </p>
          <ul className="list-disc pl-5 space-y-3 mt-4 text-gray-600">
            <li><strong>Contact details:</strong> including name, shipping address, phone number, and email.</li>
            <li><strong>Financial information:</strong> transaction details for Cash on Delivery processing.</li>
            <li><strong>Usage information:</strong> information regarding your interaction with our store.</li>
            <li><strong>Device information:</strong> information about your device, browser, or IP address.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-sm font-bold uppercase tracking-wide mb-4 text-black">How We Use Your Information</h2>
          <p>
            We use your personal information to fulfill orders, provide customer support, and improve our services. We also use data for security and fraud prevention.
          </p>
        </section>

        <section className="bg-gray-50 p-6 rounded-xl border border-gray-100">
          <h2 className="text-sm font-bold uppercase tracking-wide mb-3 text-black">Contact Support</h2>
          <p>
            Should you have any questions about our privacy practices, please email us at <strong>meer.malika6644@gmail.com</strong>.
          </p>
          <p className="mt-4 font-bold text-xs">ITX SHOP MEER</p>
        </section>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
