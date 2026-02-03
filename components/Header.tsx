
import React from 'react';
import { Link } from 'react-router-dom';
import { User } from '../types';

interface HeaderProps {
  cartCount: number;
  user: User | null;
  logout: () => void;
}

const Header: React.FC<HeaderProps> = ({ cartCount, user, logout }) => {
  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-100">
      <div className="container mx-auto px-4 md:px-6 h-16 md:h-20 flex items-center justify-between">
        <Link to="/" className="text-xl md:text-2xl font-black text-black tracking-tightest uppercase italic flex items-center">
          ITX<span className="text-blue-600 ml-1"> SHOP MEER</span>
        </Link>

        <div className="flex items-center space-x-3 md:space-x-6">
          {user ? (
            <div className="flex items-center space-x-3 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100">
              <span className="text-[9px] font-black uppercase tracking-wider text-blue-600">CONSOLE: {user.name}</span>
              <button onClick={logout} className="text-gray-400 hover:text-red-500 transition text-sm"><i className="fas fa-power-off"></i></button>
            </div>
          ) : (
            <div className="flex items-center space-x-4">
              <Link to="/cart" className="relative p-2 text-black hover:text-blue-600 transition">
                <i className="fas fa-shopping-bag text-xl md:text-2xl"></i>
                {cartCount > 0 && (
                  <span className="absolute top-0 right-0 bg-red-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center shadow-lg border border-white">
                    {cartCount}
                  </span>
                )}
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
