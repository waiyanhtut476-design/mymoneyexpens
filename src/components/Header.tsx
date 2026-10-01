import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export const Header: React.FC<HeaderProps> = ({ title, subtitle = 'MyMoney' }) => {
  const { user, logout } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const displayName = user?.displayName || user?.email?.split('@')[0] || 'အသုံးပြုသူ';
  const photoURL = user?.photoURL;

  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-[#FAF6EE]/90 backdrop-blur-md border-b border-[#E7DFD5] shadow-xs">
      <div className="max-w-[420px] mx-auto h-16 px-4 flex items-center justify-between gap-2">
        {/* Brand & Active Screen Title */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-[#D4A373] text-white flex items-center justify-center shrink-0 shadow-xs">
            <span className="material-symbols-outlined text-lg">account_balance_wallet</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] uppercase font-bold text-[#82756A] tracking-wider truncate">
              {subtitle}
            </span>
            <h1 className="text-base font-bold text-[#1E1B17] truncate leading-tight">
              {title}
            </h1>
          </div>
        </div>

        {/* User Avatar & Logout Action Area */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Currency / Status Pill */}
          <div className="hidden sm:flex items-center gap-1 bg-[#FFFDF7] border border-[#E7DFD5] px-2.5 py-1 rounded-full text-xs font-semibold text-[#50453B]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#166534]"></span>
            <span>THB (฿)</span>
          </div>

          {/* User Profile Avatar with Name & Logout Trigger */}
          <div className="relative">
            <button
              onClick={() => setShowLogoutConfirm(!showLogoutConfirm)}
              className="flex items-center gap-2 p-1 pl-2 pr-1.5 rounded-full bg-[#FFFDF7] border border-[#E7DFD5] hover:border-[#D4A373] transition-all cursor-pointer shadow-xs active:scale-95"
              title="အကောင့် ရွေးချယ်စရာများ"
            >
              <span className="text-xs font-bold text-[#1E1B17] max-w-[80px] truncate">
                {displayName}
              </span>
              {photoURL ? (
                <img
                  src={photoURL}
                  alt={displayName}
                  className="w-7 h-7 rounded-full object-cover border border-[#E7DFD5]"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-[#D4A373] text-white flex items-center justify-center text-xs font-bold">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
            </button>

            {/* Logout Dropdown Modal / Popover */}
            {showLogoutConfirm && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-[#E7DFD5] rounded-[18px] shadow-xl p-2 z-50 animate-fadeIn">
                <div className="px-3 py-2 border-b border-[#E7DFD5]/60 mb-1">
                  <p className="text-xs font-bold text-[#1E1B17] truncate">{displayName}</p>
                  <p className="text-[10px] text-[#82756A] truncate">{user?.email}</p>
                </div>
                <button
                  onClick={() => {
                    setShowLogoutConfirm(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-[#DC2626] hover:bg-[#FFDAD6]/50 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">logout</span>
                  <span>ထွက်မည် (Logout)</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
