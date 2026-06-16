/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ShoppingCart, LogIn, LogOut, Store, Search, User, MapPin } from 'lucide-react';
import { User as FirebaseUser, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';

interface NavbarProps {
  user: FirebaseUser | null;
  onOpenDashboard: () => void;
  onOpenCart: () => void;
  cartCount: number;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  selectedCity: string;
  onCityChange: (city: string) => void;
  categories: string[];
  cities: string[];
}

export default function Navbar({
  user,
  onOpenDashboard,
  onOpenCart,
  cartCount,
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  selectedCity,
  onCityChange,
  categories,
  cities,
}: NavbarProps) {
  
  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      // Configure to ask for email access cleanly
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed: ", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed: ", error);
    }
  };

  return (
    <header id="nav_header" className="sticky top-0 z-40 w-full border-b border-[#1A1A1A]/10 bg-[#F9F8F6]/95 backdrop-blur-md text-[#1A1A1A]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-20 items-center justify-between gap-4">
          
          {/* Logo & Branding - Editorial Serif Stylings */}
          <div className="flex items-center gap-4 cursor-pointer" onClick={() => { onCategoryChange(''); onCityChange(''); onSearchChange(''); }}>
            <div className="text-[10px] uppercase tracking-[0.25em] font-semibold opacity-50 hidden xl:block">Est. 2024</div>
            <div className="flex flex-col">
              <span className="text-2xl font-serif italic tracking-tight font-light text-[#1A1A1A]">GuildMarket</span>
              <span className="text-[9px] font-sans uppercase tracking-[0.3em] opacity-45 -mt-0.5 font-semibold">The Crafted Row</span>
            </div>
          </div>

          {/* Search Bar - Sharp & Architectural */}
          <div className="hidden md:flex flex-1 max-w-md relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#1A1A1A]/50" />
            <input
              id="global_search_input"
              type="text"
              placeholder="Search Curations..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full rounded-none border border-[#1A1A1A]/15 bg-transparent py-2 pl-10 pr-4 text-xs uppercase tracking-wider text-[#1A1A1A] placeholder-[#1A1A1A]/35 outline-none transition-all focus:border-[#1A1A1A]"
            />
          </div>

          {/* Quick Controls */}
          <div className="flex items-center gap-4">
            
            {/* City Selector - Sharp Minimal Dropdown */}
            <div className="relative hidden lg:flex items-center gap-1.5 rounded-none border border-[#1A1A1A]/15 bg-transparent px-3 py-1.5 text-[#1A1A1A]">
              <MapPin className="h-3.5 w-3.5 text-[#1A1A1A]/60" />
              <select
                id="city_filter_select"
                value={selectedCity}
                onChange={(e) => onCityChange(e.target.value)}
                className="text-[10px] font-medium uppercase tracking-widest text-[#1A1A1A] bg-transparent outline-none cursor-pointer pr-1"
              >
                <option value="" className="bg-[#F9F8F6]">All Regions</option>
                {cities.map(city => (
                  <option key={city} value={city} className="bg-[#F9F8F6]">{city}</option>
                ))}
              </select>
            </div>

            {/* Shopping Cart button - Subtle outline */}
            <button
              id="navbar_cart_btn"
              onClick={onOpenCart}
              className="relative flex h-9 px-3.5 items-center justify-center rounded-none border border-[#1A1A1A]/15 bg-transparent text-[#1A1A1A] hover:bg-[#1A1A1A]/5 transition-colors"
              aria-label="View shopping cart"
            >
              <span className="text-[10px] uppercase tracking-widest font-semibold mr-1.5 hidden sm:inline">Cart</span>
              <ShoppingCart className="h-4 w-4" />
              {cartCount > 0 && (
                <span id="cart_badge" className="absolute -top-1.5 -right-1.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-[#1A1A1A] text-[9px] font-bold text-white shadow-sm ring-1 ring-[#F9F8F6]">
                  {cartCount}
                </span>
              )}
            </button>

            {/* Seller Account Button / Authentication Actions */}
            {user ? (
              <div className="flex items-center gap-3">
                <button
                  id="dashboard_toggle_btn"
                  onClick={onOpenDashboard}
                  className="hidden sm:inline-flex items-center gap-1.5 rounded-none border border-[#1A1A1A]/30 bg-transparent px-4 py-2 text-[10px] uppercase tracking-widest font-semibold text-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-white transition-all"
                >
                  <Store className="h-3.5 w-3.5" />
                  Seller Studio
                </button>
                
                {/* User avatar and log out profile popover */}
                <div className="group relative flex items-center gap-1">
                  <img
                    id="user_avatar_img"
                    src={user.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${user.displayName || 'Artisan'}`}
                    alt="User profile"
                    className="h-9 w-9 rounded-none object-cover border border-[#1A1A1A]/20 cursor-pointer"
                  />
                  <div className="absolute right-0 top-10 hidden w-48 rounded-none border border-[#1A1A1A]/20 bg-[#F9F8F6] p-2 shadow-md group-hover:block z-50">
                    <div className="px-3 py-2 border-b border-[#1A1A1A]/10">
                      <p className="text-[11px] font-bold uppercase tracking-tight text-[#1A1A1A] truncate">{user.displayName || 'Creator'}</p>
                      <p className="text-[10px] text-[#1A1A1A]/60 truncate font-mono">{user.email}</p>
                    </div>
                    <button
                      id="studio_side_toggle_btn"
                      onClick={onOpenDashboard}
                      className="flex w-full items-center gap-2 rounded-none px-3 py-2 text-left text-[10px] uppercase tracking-widest font-medium text-[#1A1A1A] hover:bg-[#1A1A1A]/5 sm:hidden"
                    >
                      <Store className="h-3.5 w-3.5" />
                      Seller Studio
                    </button>
                    <button
                      id="logout_action_btn"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2 rounded-none px-3 py-2 text-left text-[10px] uppercase tracking-widest font-medium text-red-650 hover:bg-red-50/50"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      Sign Out
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                id="login_action_btn"
                onClick={handleLogin}
                className="inline-flex items-center gap-1.5 rounded-none bg-[#1A1A1A] px-5 py-2 text-[10px] uppercase tracking-[0.2em] font-semibold text-white hover:bg-[#1A1A1A]/85 transition-colors"
              >
                <LogIn className="h-3.5 w-3.5" />
                Sign In
              </button>
            )}

          </div>

        </div>

        {/* Small screen Search, Filter & Categories view - Styled Editorial */}
        <div className="flex md:hidden pb-4 items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#1A1A1A]/50" />
            <input
              id="mobile_search_input"
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full rounded-none border border-[#1A1A1A]/15 bg-transparent py-1.5 pl-8 pr-3 text-xs uppercase tracking-wider outline-none focus:border-[#1A1A1A]"
            />
          </div>
          
          <select
            id="mobile_city_filter"
            value={selectedCity}
            onChange={(e) => onCityChange(e.target.value)}
            className="text-[10px] font-medium uppercase tracking-wider text-[#1A1A1A] bg-transparent border border-[#1A1A1A]/15 rounded-none px-3 py-2 outline-none"
          >
            <option value="" className="bg-[#F9F8F6]">All regions</option>
            {cities.map(city => (
              <option key={city} value={city} className="bg-[#F9F8F6]">{city}</option>
            ))}
          </select>
        </div>

      </div>
    </header>
  );
}
