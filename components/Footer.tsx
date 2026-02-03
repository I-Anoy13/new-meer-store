
import React from 'react';
import { Link } from 'react-router-dom';

const Footer: React.FC = () => {
  return (
    <footer className="bg-white border-t border-gray-100 pt-12 pb-8">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">
          <div>
            <h4 className="font-bold text-[10px] uppercase tracking-wide text-gray-400 mb-5">Legal</h4>
            <ul className="space-y-2 text-xs text-gray-600 font-medium">
              <li><Link to="/privacy-policy" className="hover:text-blue-600 transition">Privacy Policy</Link></li>
              <li><Link to="/terms-of-service" className="hover:text-blue-600 transition">Terms of Service</Link></li>
              <li><Link to="/refund-policy" className="hover:text-blue-600 transition">Refund Policy</Link></li>
              <li><Link to="/shipping-policy" className="hover:text-blue-600 transition">Shipping Policy</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-[10px] uppercase tracking-wide text-gray-400 mb-5">Support</h4>
            <ul className="space-y-2 text-xs text-gray-600 font-medium">
              <li><Link to="/" className="hover:text-blue-600 transition">Inquiry</Link></li>
              <li><Link to="/" className="hover:text-blue-600 transition">FAQ</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-[10px] uppercase tracking-wide text-gray-400 mb-5">About ITX</h4>
            <p className="text-xs text-gray-500 leading-relaxed font-medium">
              Specializing in high-performance horology and artisanal luxury. Premium delivery across Pakistan.
            </p>
          </div>
          <div>
            <h4 className="font-bold text-[10px] uppercase tracking-wide text-gray-400 mb-5">Updates</h4>
            <div className="flex">
              <input type="email" placeholder="Email" className="bg-gray-50 border border-gray-100 rounded-l-lg px-3 py-2 text-[10px] w-full focus:outline-none" />
              <button className="bg-black text-white px-4 py-2 rounded-r-lg text-[10px] font-bold uppercase tracking-wide hover:bg-blue-600 transition">Join</button>
            </div>
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row justify-between items-center pt-8 border-t border-gray-50 text-[9px] text-gray-400 uppercase font-bold italic">
          <p>&copy; 2024 ITX SHOP MEER. AUTHENTICITY GUARANTEED.</p>
          <div className="flex space-x-6 mt-4 md:mt-0 text-gray-300">
            <i className="fab fa-instagram hover:text-black cursor-pointer transition"></i>
            <i className="fab fa-tiktok hover:text-black cursor-pointer transition"></i>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
