import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WelcomeScreen } from './components/WelcomeScreen';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { OverviewTab } from './components/tabs/OverviewTab';
import { HistoryTab } from './components/tabs/HistoryTab';
import { QuickAddTab } from './components/tabs/QuickAddTab';
import { WalletsTab } from './components/tabs/WalletsTab';
import { TabType } from './types';

const MainApp: React.FC = () => {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  // Loading spinner during auth initialization
  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF6EE] flex flex-col items-center justify-center p-6 text-center select-none">
        <div className="w-16 h-16 rounded-[20px] bg-[#D4A373] text-white flex items-center justify-center shadow-md mb-4 animate-bounce">
          <span className="material-symbols-outlined text-3xl">account_balance_wallet</span>
        </div>
        <h2 className="text-lg font-bold text-[#1E1B17] mb-1">MyMoney</h2>
        <div className="flex items-center gap-2 text-xs font-semibold text-[#82756A]">
          <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
          <span>ဒေတာများကို ဆွဲတင်နေသည်...</span>
        </div>
      </div>
    );
  }

  // Not logged in -> Show Welcome / Login Screen
  if (!user) {
    return <WelcomeScreen />;
  }

  // Titles for each tab
  const tabTitles: Record<TabType, { title: string; subtitle: string }> = {
    overview: { title: 'ပင်မ မျက်နှာပြင်', subtitle: 'MyMoney Overview' },
    history: { title: 'စာရင်းနှင့် စစ်တမ်း', subtitle: 'History & Analytics' },
    'quick-add': { title: 'စာရင်း အသစ်သွင်းမည်', subtitle: 'Quick Add' },
    wallets: { title: 'ပိုက်ဆံအိတ်နှင့် ဘတ်ဂျက်', subtitle: 'Budgets & Wallets' },
  };

  const currentTabInfo = tabTitles[activeTab];

  return (
    <div className="min-h-screen bg-[#FAF6EE] text-[#3A2A1A] flex flex-col">
      {/* Fixed Header */}
      <Header title={currentTabInfo.title} subtitle={currentTabInfo.subtitle} />

      {/* Main Content Area */}
      <main className="flex-1 max-w-[420px] w-full mx-auto px-4 pt-20 pb-24">
        {activeTab === 'overview' && (
          <OverviewTab onNavigate={(tab) => setActiveTab(tab)} />
        )}
        {activeTab === 'history' && <HistoryTab />}
        {activeTab === 'quick-add' && <QuickAddTab />}
        {activeTab === 'wallets' && <WalletsTab />}
      </main>

      {/* Fixed Bottom Navigation */}
      <BottomNav activeTab={activeTab} onSelectTab={(tab) => setActiveTab(tab)} />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
