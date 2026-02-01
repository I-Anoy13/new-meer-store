
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
    <header className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="text-2xl font-black text-black tracking-tighter uppercase italic">
          ITX<span className="text-blue-600"> SHOP MEER</span>
        </Link>

        <nav className="hidden md:flex items-center space-x-8 text-sm font-medium">
          <Link to="/" className="hover:text-blue-600 transition uppercase tracking-widest text-[11px] font-bold">The Collection</Link>
          {/* Admin link removed to hide it from customers */}
        </nav>

        <div className="flex items-center space-x-4">
          {user ? (
            <div className="flex items-center space-x-3">
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-1 rounded">MGR: {user.name}</span>
              <button onClick={logout} className="text-gray-400 hover:text-red-500 transition"><i className="fas fa-sign-out-alt"></i></button>
            </div>
          ) : (
            <Link to="/cart" className="relative p-2 text-gray-800 hover:text-blue-600 transition">
              <i className="fas fa-shopping-bag text-xl"></i>
              {cartCount > 0 && (
                <span className="absolute top-0 right-0 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center shadow-lg">
                  {cartCount}
                </span>
              )}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
