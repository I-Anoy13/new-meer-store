
import React from 'react';
import { Link } from 'react-router-dom';

const Footer: React.FC = () => {
  return (
    <footer className="bg-white border-t border-gray-100 pt-16 pb-12">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-12 mb-16">
          <div>
            <h4 className="font-black text-[11px] uppercase tracking-[0.3em] text-gray-400 mb-6">Legal & Policy</h4>
            <ul className="space-y-3 text-sm text-gray-600 font-medium">
              <li><Link to="/privacy-policy" className="hover:text-blue-600 transition italic">Privacy Policy (GDPR)</Link></li>
              <li><Link to="/terms-of-service" className="hover:text-blue-600 transition italic">Terms of Service</Link></li>
              <li><Link to="/refund-policy" className="hover:text-blue-600 transition italic">Refund Policy (COD)</Link></li>
              <li><Link to="/shipping-policy" className="hover:text-blue-600 transition italic">Shipping Procedures</Link></li>
              <li><Link to="/admin" className="text-gray-300 hover:text-black transition italic text-[10px] mt-4 block uppercase tracking-widest font-black">Admin Console</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-black text-[11px] uppercase tracking-[0.3em] text-gray-400 mb-6">Client Services</h4>
            <ul className="space-y-3 text-sm text-gray-600 font-medium">
              <li><Link to="/" className="hover:text-blue-600 transition italic">Support Inquiry</Link></li>
              <li><Link to="/" className="hover:text-blue-600 transition italic">Global FAQ</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-black text-[11px] uppercase tracking-[0.3em] text-gray-400 mb-6">ITX SHOP MEER</h4>
            <p className="text-sm text-gray-500 leading-relaxed italic font-medium">
              Specializing in high-performance horology and artisanal luxury. Premium delivery across Pakistan.
            </p>
          </div>
          <div>
            <h4 className="font-black text-[11px] uppercase tracking-[0.3em] text-gray-400 mb-6">Keep Updated</h4>
            <div className="flex">
              <input type="email" placeholder="Email" className="bg-gray-50 border border-gray-100 rounded-l-xl px-4 py-3 text-xs w-full focus:outline-none focus:ring-1 focus:ring-black" />
              <button className="bg-black text-white px-6 py-3 rounded-r-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition">Join</button>
            </div>
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row justify-between items-center pt-10 border-t border-gray-50 text-[10px] text-gray-400 uppercase tracking-[0.4em] font-black italic">
          <p>&copy; 2024 ITX SHOP MEER. AUTHENTICITY GUARANTEED.</p>
          <div className="flex space-x-8 mt-6 md:mt-0 text-gray-300">
            <i className="fab fa-instagram hover:text-black cursor-pointer transition"></i>
            <i className="fab fa-tiktok hover:text-black cursor-pointer transition"></i>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
