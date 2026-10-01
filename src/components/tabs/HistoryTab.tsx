import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { Transaction, Wallet, UserSettings, EXPENSE_CATEGORIES } from '../../types';
import { EditTransactionModal } from '../EditTransactionModal';

type PeriodType = 'today' | 'week' | 'month';

export const HistoryTab: React.FC = () => {
  const { user } = useAuth();
  const [period, setPeriod] = useState<PeriodType>('month');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit modal state
  const [selectedTxForEdit, setSelectedTxForEdit] = useState<Transaction | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  useEffect(() => {
    if (!user?.uid || !db) {
      setLoading(false);
      return;
    }

    // 1. Transactions Listener
    const txRef = collection(db, 'users', user.uid, 'transactions');
    const txQuery = query(txRef, orderBy('date', 'desc'), orderBy('createdAt', 'desc'));
    const unsubTx = onSnapshot(
      txQuery,
      (snapshot) => {
        const list: Transaction[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...(docSnap.data() as any) });
        });
        setTransactions(list);
        setLoading(false);
      },
      (err) => console.warn('HistoryTab snapshot warning:', err)
    );

    // 2. Wallets Listener
    const walletsRef = collection(db, 'users', user.uid, 'wallets');
    const unsubWallets = onSnapshot(walletsRef, (snapshot) => {
      const wList: Wallet[] = [];
      snapshot.forEach((docSnap) => {
        wList.push({ id: docSnap.id, ...(docSnap.data() as any) });
      });
      setWallets(wList);
    });

    // 3. Settings Listener
    const settingsRef = doc(db, 'users', user.uid, 'settings', 'main');
    const unsubSettings = onSnapshot(settingsRef, (docSnap) => {
      if (docSnap.exists()) {
        setSettings(docSnap.data() as UserSettings);
      }
    });

    return () => {
      unsubTx();
      unsubWallets();
      unsubSettings();
    };
  }, [user?.uid]);

  // Date filtering logic
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Start of this week (Monday)
  const dayOfWeek = now.getDay() || 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - dayOfWeek + 1);
  const mondayStr = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;

  const periodFilteredTx = transactions.filter((tx) => {
    if (!tx.date) return true;
    if (period === 'today') return tx.date === todayStr;
    if (period === 'week') return tx.date >= mondayStr && tx.date <= todayStr;
    if (period === 'month') return tx.date.startsWith(currentMonthStr);
    return true;
  });

  // Calculate expense for current period
  const totalPeriodExpense = periodFilteredTx
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + (t.amountBase || t.amount || 0), 0);

  // Category breakdown for expenses in this period
  const categoryExpenses: Record<string, number> = {};
  EXPENSE_CATEGORIES.forEach((c) => {
    categoryExpenses[c.id] = 0;
  });

  periodFilteredTx
    .filter((t) => t.type === 'expense')
    .forEach((t) => {
      if (t.categoryId) {
        categoryExpenses[t.categoryId] =
          (categoryExpenses[t.categoryId] || 0) + (t.amountBase || t.amount || 0);
      }
    });

  const activeCategoryList = EXPENSE_CATEGORIES.map((c) => ({
    ...c,
    amount: categoryExpenses[c.id] || 0,
    percentage:
      totalPeriodExpense > 0
        ? Math.round(((categoryExpenses[c.id] || 0) / totalPeriodExpense) * 100)
        : 0,
  })).sort((a, b) => b.amount - a.amount);

  // Filter transactions by search query and category
  const searchedTransactions = periodFilteredTx.filter((t) => {
    const matchesCategory =
      selectedCategoryFilter === 'all' || t.categoryId === selectedCategoryFilter;
    if (!matchesCategory) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (t.note && t.note.toLowerCase().includes(q)) ||
      (t.category && t.category.toLowerCase().includes(q)) ||
      (t.walletName && t.walletName.toLowerCase().includes(q))
    );
  });

  // Group by Date
  const groupedTransactions: Record<string, Transaction[]> = {};
  searchedTransactions.forEach((tx) => {
    const key = tx.date || 'အခြားရက်';
    if (!groupedTransactions[key]) {
      groupedTransactions[key] = [];
    }
    groupedTransactions[key].push(tx);
  });

  // CSV Export handler
  const handleExportCSV = () => {
    if (transactions.length === 0) return;
    const headers = ['Date', 'Type', 'Category', 'Note', 'Wallet', 'Amount', 'Currency', 'AmountBase_THB'];
    const rows = transactions.map((t) => [
      `"${t.date || ''}"`,
      `"${t.type}"`,
      `"${t.category || ''}"`,
      `"${(t.note || '').replace(/"/g, '""')}"`,
      `"${t.walletName || ''}"`,
      t.amount,
      `"${t.currency}"`,
      t.amountBase || t.amount,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `mymoney_transactions_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Compute SVG Donut segments
  let cumulativePercent = 0;
  const donutSegments = activeCategoryList
    .filter((c) => c.amount > 0)
    .map((c) => {
      const strokeLength = (c.percentage / 100) * 238.76;
      const strokeOffset = -((cumulativePercent / 100) * 238.76);
      cumulativePercent += c.percentage;
      return {
        ...c,
        strokeLength,
        strokeOffset,
      };
    });

  return (
    <div className="flex flex-col gap-4 w-full pb-8 select-none relative">
      {/* 1. Header with Period Tab & CSV Export Button */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[10px] font-bold text-[#82756A] uppercase tracking-wider">
            စစ်တမ်းနှင့် စာရင်း
          </span>
          <h2 className="text-xl font-bold text-[#1E1B17]">စာရင်းမှတ်တမ်း</h2>
        </div>

        {/* CSV Export Button */}
        <button
          onClick={handleExportCSV}
          disabled={transactions.length === 0}
          className="flex items-center gap-1.5 bg-white border border-[#E7DFD5] hover:border-[#7D562D] text-[#7D562D] px-3 py-1.5 rounded-[14px] text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-base">download</span>
          <span>CSV ထုတ်ယူရန်</span>
        </button>
      </div>

      {/* Segmented Period Tabs: ဒီနေ့ / ဒီအပတ် / ဒီလ */}
      <div className="bg-[#FAF2EB] p-1 rounded-[18px] border border-[#E7DFD5] flex items-center justify-between gap-1 shadow-xs">
        {[
          { id: 'today', label: 'ဒီနေ့' },
          { id: 'week', label: 'ဒီအပတ်' },
          { id: 'month', label: 'ဒီလ' },
        ].map((p) => (
          <button
            key={p.id}
            onClick={() => setPeriod(p.id as PeriodType)}
            className={`flex-1 py-2 text-center rounded-[14px] text-xs font-bold transition-all cursor-pointer ${
              period === p.id
                ? 'bg-white text-[#7D562D] shadow-xs'
                : 'text-[#82756A] hover:text-[#1E1B17]'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* 2. Total Expense Banner with Period Comparison */}
      <div className="bg-white rounded-[22px] p-4.5 border border-[#E7DFD5] shadow-xs">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-[#82756A]">
            {period === 'today' ? 'ယနေ့ သုံးစွဲငွေ' : period === 'week' ? 'ဒီအပတ် သုံးစွဲငွေ' : 'ဒီလ သုံးစွဲငွေ'}
          </span>
          <div className="flex items-center gap-1 bg-[#A6F4B5]/40 text-[#166534] px-2 py-0.5 rounded-full text-[10px] font-bold">
            <span className="material-symbols-outlined text-xs">trending_down</span>
            <span>-12% ယခင်ကာလထက်</span>
          </div>
        </div>

        <div className="flex items-baseline gap-1.5 my-1">
          <span className="text-3xl font-extrabold text-[#1E1B17] tabular-nums">
            ฿{totalPeriodExpense.toLocaleString()}
          </span>
          <span className="text-xs font-semibold text-[#82756A]">THB</span>
        </div>
      </div>

      {/* 3. Donut Chart & Category Breakdown List */}
      <div className="bg-white rounded-[22px] p-4.5 border border-[#E7DFD5] shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-[#1E1B17] flex items-center gap-1.5">
            <span className="material-symbols-outlined text-base text-[#7D562D]">donut_large</span>
            <span>သုံးစွဲမှု အချိုးအစား (Donut Chart)</span>
          </h3>
          <span className="text-[10px] text-[#82756A] font-semibold">
            {donutSegments.length} အမျိုးအစား
          </span>
        </div>

        {totalPeriodExpense > 0 ? (
          <div className="flex flex-col sm:flex-row items-center gap-5 py-2">
            {/* SVG Donut Chart */}
            <div className="relative flex items-center justify-center shrink-0">
              <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" fill="none" r="38" stroke="#FAF2EB" strokeWidth="12" />
                {donutSegments.map((seg) => (
                  <circle
                    key={seg.id}
                    cx="50"
                    cy="50"
                    fill="none"
                    r="38"
                    stroke={seg.color}
                    strokeWidth="12"
                    strokeDasharray={`${seg.strokeLength} 238.76`}
                    strokeDashoffset={seg.strokeOffset}
                    className="transition-all duration-700 hover:opacity-80"
                  />
                ))}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                <span className="text-[10px] text-[#82756A]">နံပါတ် ၁</span>
                <span className="text-xs font-bold text-[#1E1B17] truncate max-w-[80px]">
                  {activeCategoryList[0]?.name.split(' ')[0]}
                </span>
                <span className="text-xs font-extrabold text-[#7D562D]">
                  {activeCategoryList[0]?.percentage}%
                </span>
              </div>
            </div>

            {/* Category Percentages & Amount Bars */}
            <div className="w-full flex flex-col gap-2">
              {activeCategoryList
                .filter((c) => c.amount > 0)
                .map((cat) => (
                  <div key={cat.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }}></span>
                        <span className="font-semibold text-[#1E1B17] truncate">{cat.icon} {cat.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="font-bold text-[#1E1B17] tabular-nums">฿{cat.amount.toLocaleString()}</span>
                        <span className="text-[10px] text-[#82756A]">({cat.percentage}%)</span>
                      </div>
                    </div>
                    <div className="w-full bg-[#FAF2EB] rounded-full h-1.5 overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${cat.percentage}%`, backgroundColor: cat.color }}></div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-6 text-xs text-[#82756A] bg-[#FFFDF7] rounded-[16px] border border-[#E7DFD5]">
            ဤကာလအတွက် သုံးစွဲမှု စာရင်းမရှိသေးပါ
          </div>
        )}
      </div>

      {/* 4. Search Bar & Horizontal Category Filter Chips */}
      <div>
        <div className="bg-white rounded-[16px] p-2.5 border border-[#E7DFD5] flex items-center gap-2 shadow-xs mb-2">
          <span className="material-symbols-outlined text-[#82756A] text-lg ml-1">search</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ဆိုင်အမည်၊ မှတ်ချက် ရှာရန်..."
            className="flex-1 bg-transparent border-0 outline-none text-xs text-[#1E1B17] placeholder:text-[#82756A]"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-[#82756A] hover:text-[#1E1B17]">
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          )}
        </div>

        {/* Category Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          <button
            onClick={() => setSelectedCategoryFilter('all')}
            className={`px-3 py-1 rounded-full text-xs font-bold shrink-0 transition-all cursor-pointer ${
              selectedCategoryFilter === 'all'
                ? 'bg-[#7D562D] text-white shadow-xs'
                : 'bg-white border border-[#E7DFD5] text-[#82756A]'
            }`}
          >
            အားလုံး
          </button>
          {EXPENSE_CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCategoryFilter(c.id)}
              className={`px-3 py-1 rounded-full text-xs font-bold shrink-0 transition-all cursor-pointer flex items-center gap-1 ${
                selectedCategoryFilter === c.id
                  ? 'bg-[#7D562D] text-white shadow-xs'
                  : 'bg-white border border-[#E7DFD5] text-[#82756A]'
              }`}
            >
              <span>{c.icon}</span>
              <span>{c.name.split(' ')[0]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 5. Grouped Transaction List (Tap to Edit/Delete) */}
      <div className="space-y-4">
        {Object.entries(groupedTransactions).map(([dateStr, items]) => (
          <div key={dateStr} className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold text-[#1E1B17]">{dateStr}</span>
              <span className="text-[10px] text-[#82756A] font-semibold">{items.length} ခု</span>
            </div>

            {items.map((tx) => {
              const isExpense = tx.type === 'expense';
              const isIncome = tx.type === 'income';
              const catObj = EXPENSE_CATEGORIES.find((c) => c.id === tx.categoryId);

              return (
                <div
                  key={tx.id}
                  onClick={() => {
                    setSelectedTxForEdit(tx);
                    setIsEditModalOpen(true);
                  }}
                  className="bg-white p-3.5 rounded-[18px] border border-[#E7DFD5] shadow-xs flex items-center justify-between gap-3 hover:border-[#D4A373] active:scale-[0.99] transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-[#FAF2EB] flex items-center justify-center text-lg shrink-0">
                      {tx.type === 'transfer' ? '🔁' : catObj?.icon || (isIncome ? '💼' : '📦')}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#1E1B17] truncate">
                        {tx.note || tx.category || 'စာရင်း'}
                      </p>
                      <div className="flex items-center gap-1.5 text-[10px] text-[#82756A] truncate">
                        <span>{tx.category}</span>
                        <span>•</span>
                        <span>{tx.walletName || 'ပိုက်ဆံအိတ်'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span
                      className={`text-xs font-extrabold tabular-nums block ${
                        isExpense
                          ? 'text-[#DC2626]'
                          : isIncome
                          ? 'text-[#166534]'
                          : 'text-[#0891B2]'
                      }`}
                    >
                      {isExpense ? '-' : isIncome ? '+' : ''}
                      {tx.currency === 'THB' ? '฿' : tx.currency === 'USD' ? '$' : 'K'}
                      {tx.amount.toLocaleString()}
                    </span>
                    {tx.currency !== 'THB' && (
                      <span className="text-[10px] text-[#82756A] block tabular-nums">
                        ≈ ฿{tx.amountBase?.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        {searchedTransactions.length === 0 && !loading && (
          <div className="bg-white rounded-[20px] p-6 border border-[#E7DFD5] shadow-xs text-center flex flex-col items-center justify-center min-h-[140px]">
            <div className="w-12 h-12 rounded-full bg-[#FAF2EB] text-[#7D562D] flex items-center justify-center mb-2">
              <span className="material-symbols-outlined text-2xl">receipt_long</span>
            </div>
            <p className="text-xs font-bold text-[#1E1B17]">ဤကာလတွင် စာရင်းမှတ်တမ်း မရှိသေးပါ</p>
            <p className="text-[11px] text-[#82756A] mt-0.5">
              အောက်ခြေ "+" ခလုတ်ဖြင့် စာရင်းအသစ် စတင်ထည့်သွင်းပါ
            </p>
          </div>
        )}
      </div>

      {/* Edit / Delete Transaction Modal */}
      <EditTransactionModal
        isOpen={isEditModalOpen}
        transaction={selectedTxForEdit}
        wallets={wallets}
        settings={settings}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedTxForEdit(null);
        }}
      />
    </div>
  );
};
