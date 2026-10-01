import React from 'react';
import { TabType } from '../types';

interface BottomNavProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onSelectTab }) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#FAF6EE]/95 backdrop-blur-xl border-t border-[#E7DFD5] shadow-[0_-2px_12px_rgba(87,83,78,0.06)] pb-[env(safe-area-inset-bottom,0px)]">
      <div className="max-w-[420px] mx-auto flex items-center justify-around h-16 px-2 relative select-none">
        {/* Tab 1: ပင်မ (Overview / Home) */}
        <button
          onClick={() => onSelectTab('overview')}
          className={`flex flex-col items-center justify-center min-w-[64px] min-h-[48px] gap-0.5 transition-all cursor-pointer ${
            activeTab === 'overview'
              ? 'text-[#7D562D] font-bold scale-105'
              : 'text-[#82756A] hover:text-[#3A2A1A]'
          }`}
          aria-label="ပင်မ"
        >
          <span className="material-symbols-outlined text-[24px]">dashboard</span>
          <span className="text-[11px] leading-none">ပင်မ</span>
        </button>

        {/* Tab 2: စာရင်း (History / Transactions) */}
        <button
          onClick={() => onSelectTab('history')}
          className={`flex flex-col items-center justify-center min-w-[64px] min-h-[48px] gap-0.5 transition-all cursor-pointer ${
            activeTab === 'history'
              ? 'text-[#7D562D] font-bold scale-105'
              : 'text-[#82756A] hover:text-[#3A2A1A]'
          }`}
          aria-label="စာရင်း"
        >
          <span className="material-symbols-outlined text-[24px]">insert_chart</span>
          <span className="text-[11px] leading-none">စာရင်း</span>
        </button>

        {/* Center Floating Action Button: စာရင်းသွင်း (+) */}
        <button
          onClick={() => onSelectTab('quick-add')}
          className="flex flex-col items-center justify-center min-w-[64px] min-h-[48px] gap-0.5 -mt-6 group cursor-pointer"
          aria-label="စာရင်းသွင်း"
        >
          <div
            className={`w-13 h-13 rounded-full flex items-center justify-center text-white shadow-[0_6px_16px_rgba(212,163,115,0.5)] transition-all active:scale-95 ${
              activeTab === 'quick-add'
                ? 'bg-[#7D562D] ring-4 ring-[#FAF6EE]'
                : 'bg-[#D4A373] group-hover:bg-[#C59260] ring-4 ring-[#FAF6EE]'
            }`}
          >
            <span className="material-symbols-outlined text-2xl font-bold">add</span>
          </div>
          <span
            className={`text-[11px] leading-none font-medium mt-0.5 ${
              activeTab === 'quick-add' ? 'text-[#7D562D] font-bold' : 'text-[#82756A]'
            }`}
          >
            စာရင်းသွင်း
          </span>
        </button>

        {/* Tab 4: ပိုက်ဆံအိတ် (Wallets & Budget) */}
        <button
          onClick={() => onSelectTab('wallets')}
          className={`flex flex-col items-center justify-center min-w-[64px] min-h-[48px] gap-0.5 transition-all cursor-pointer ${
            activeTab === 'wallets'
              ? 'text-[#7D562D] font-bold scale-105'
              : 'text-[#82756A] hover:text-[#3A2A1A]'
          }`}
          aria-label="ပိုက်ဆံအိတ်"
        >
          <span className="material-symbols-outlined text-[24px]">account_balance_wallet</span>
          <span className="text-[11px] leading-none">ပိုက်ဆံအိတ်</span>
        </button>
      </div>
    </nav>
  );
};
