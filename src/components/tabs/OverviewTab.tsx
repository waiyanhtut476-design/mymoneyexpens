import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, doc, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { Wallet, UserSettings, TabType, Transaction, EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../../types';
import { BudgetModal } from '../BudgetModal';

interface OverviewTabProps {
  onNavigate: (tab: TabType) => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);

  const displayName = user?.displayName?.split(' ')[0] || 'မိတ်ဆွေ';

  // Format today's date in Myanmar context
  const now = new Date();
  const currentDay = now.getDate();
  const year = now.getFullYear();
  const month = now.getMonth();
  const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
  const daysRemaining = Math.max(1, totalDaysInMonth - currentDay + 1);

  const monthNames = [
    'ဇန်နဝါရီ', 'ဖေဖော်ဝါရီ', 'မတ်', 'ဧပြီ', 'မေ', 'ဇွန်',
    'ဇူလိုင်', 'သြဂုတ်', 'စက်တင်ဘာ', 'အောက်တိုဘာ', 'နိုဝင်ဘာ', 'ဒီဇင်ဘာ'
  ];
  const formattedDate = `${now.getDate()} ${monthNames[month]} ${year}`;

  // Firestore real-time listeners
  useEffect(() => {
    if (!user?.uid || !db) {
      setLoading(false);
      return;
    }

    // 1. Wallets listener
    const walletsRef = collection(db, 'users', user.uid, 'wallets');
    const unsubWallets = onSnapshot(
      walletsRef,
      (snapshot) => {
        const loaded: Wallet[] = [];
        snapshot.forEach((docSnap) => {
          loaded.push({ id: docSnap.id, ...(docSnap.data() as any) });
        });
        setWallets(loaded);
        setLoading(false);
      },
      (err) => {
        console.warn('Wallets snapshot warning:', err);
        setLoading(false);
      }
    );

    // 2. Settings listener
    const settingsRef = doc(db, 'users', user.uid, 'settings', 'main');
    const unsubSettings = onSnapshot(
      settingsRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setSettings(docSnap.data() as UserSettings);
        }
      },
      (err) => console.warn('Settings snapshot warning:', err)
    );

    // 3. Transactions listener
    const txRef = collection(db, 'users', user.uid, 'transactions');
    const txQuery = query(txRef, orderBy('createdAt', 'desc'));
    const unsubTx = onSnapshot(
      txQuery,
      (snapshot) => {
        const list: Transaction[] = [];
        snapshot.forEach((snap) => {
          list.push({ id: snap.id, ...(snap.data() as any) });
        });
        setTransactions(list);
      },
      (err) => console.warn('Transactions snapshot warning:', err)
    );

    return () => {
      unsubWallets();
      unsubSettings();
      unsubTx();
    };
  }, [user?.uid]);

  // Dynamic balance calculations across transactions
  const walletCalculatedBalances: Record<string, number> = {};
  wallets.forEach((w) => {
    walletCalculatedBalances[w.id] = Number(w.initialBalance || 0);
  });

  let monthlyExpenseTHB = 0;
  let monthlyIncomeTHB = 0;

  const currentMonthStr = `${year}-${String(month + 1).padStart(2, '0')}`;

  transactions.forEach((tx) => {
    const baseAmount = tx.amountBase || tx.amount || 0;
    const isCurrentMonth = tx.date ? tx.date.startsWith(currentMonthStr) : true;

    if (tx.type === 'expense') {
      if (isCurrentMonth) monthlyExpenseTHB += baseAmount;
      if (tx.walletId && walletCalculatedBalances[tx.walletId] !== undefined) {
        walletCalculatedBalances[tx.walletId] -= tx.amount;
      }
    } else if (tx.type === 'income') {
      if (isCurrentMonth) monthlyIncomeTHB += baseAmount;
      if (tx.walletId && walletCalculatedBalances[tx.walletId] !== undefined) {
        walletCalculatedBalances[tx.walletId] += tx.amount;
      }
    } else if (tx.type === 'transfer') {
      if (tx.walletId && walletCalculatedBalances[tx.walletId] !== undefined) {
        walletCalculatedBalances[tx.walletId] -= tx.amount;
      }
      if (tx.toWalletId && walletCalculatedBalances[tx.toWalletId] !== undefined) {
        walletCalculatedBalances[tx.toWalletId] += tx.amount;
      }
    }
  });

  // Calculate total balance in THB
  const totalBalanceTHB = wallets.reduce((sum, w) => {
    const bal = walletCalculatedBalances[w.id] ?? w.currentBalance ?? w.initialBalance ?? 0;
    // convert to THB if currency is different
    if (w.currency === 'USD') return sum + bal * (settings?.fxRates?.USD || 35);
    if (w.currency === 'MMK') return sum + bal * (settings?.fxRates?.MMK || 0.0165);
    return sum + bal;
  }, 0);

  const usdRate = settings?.fxRates?.USD || 35;
  const approxUSD = (totalBalanceTHB / usdRate).toFixed(0);

  // Safe to spend calculation: (monthlyBudget - thisMonthExpenses) ÷ daysRemaining
  const monthlyBudget = settings?.monthlyBudget || 0;
  const budgetRemaining = Math.max(0, monthlyBudget - monthlyExpenseTHB);
  const safeToSpendPerDay = monthlyBudget > 0 ? Math.floor(budgetRemaining / daysRemaining) : 0;
  const budgetPercentUsed = monthlyBudget > 0 ? Math.min(100, Math.round((monthlyExpenseTHB / monthlyBudget) * 100)) : 0;

  const getCategoryIcon = (tx: Transaction) => {
    if (tx.type === 'transfer') return 'sync_alt';
    const foundExp = EXPENSE_CATEGORIES.find((c) => c.id === tx.categoryId);
    if (foundExp) return foundExp.icon;
    const foundInc = INCOME_CATEGORIES.find((c) => c.id === tx.categoryId);
    if (foundInc) return foundInc.icon;
    return 'payments';
  };

  return (
    <div className="flex flex-col gap-4 w-full pb-8 select-none">
      {/* 1. Greeting + Date Ribbon (NomadKit Header Card) */}
      <div className="bg-[#FAF2EB] rounded-[20px] p-3.5 border border-[#E7DFD5] flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-[#D4A373]/20 text-[#7D562D] flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-xl">person</span>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-[#1E1B17] truncate">
              မင်္ဂလာပါ, {displayName} 👋
            </p>
            <p className="text-[11px] text-[#82756A] truncate">
              {formattedDate}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-end shrink-0">
          <span className="px-2.5 py-0.5 rounded-full bg-[#166534]/15 text-[#166534] text-[10px] font-bold">
            Day {currentDay}/{totalDaysInMonth}
          </span>
          <span className="text-[10px] text-[#82756A] mt-0.5">
            ကျန် {daysRemaining} ရက်
          </span>
        </div>
      </div>

      {/* 2. Total Balance (THB) + USD Equivalence + FX Update Badge */}
      <div className="bg-white rounded-[22px] p-5 border border-[#E7DFD5] shadow-xs relative overflow-hidden">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-bold text-[#82756A] uppercase tracking-wider">
            စုစုပေါင်း လက်ကျန်ငွေ
          </span>
          <div className="flex items-center gap-1 text-[11px] font-bold text-[#0891B2] bg-[#76DCFF]/20 px-2.5 py-0.5 rounded-full">
            <span className="material-symbols-outlined text-xs">sync_alt</span>
            <span>FX အပ်ဒိတ်</span>
          </div>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-3xl sm:text-4xl font-extrabold text-[#1E1B17] tracking-tight tabular-nums">
            ฿{totalBalanceTHB.toLocaleString()}
          </span>
          <span className="text-xs sm:text-sm font-semibold text-[#82756A] tabular-nums">
            ≈ ${Number(approxUSD).toLocaleString()} USD
          </span>
        </div>

        {/* 3. Monthly Income / Expense 2-Card Row */}
        <div className="grid grid-cols-2 gap-2.5 mt-4">
          <div className="bg-[#FAF2EB] p-3 rounded-[16px] flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#166534]/15 text-[#166534] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-lg font-bold">arrow_downward</span>
            </div>
            <div className="min-w-0">
              <span className="text-[10px] text-[#82756A] block font-medium">ဒီလ ဝင်ငွေ</span>
              <span className="text-xs sm:text-sm font-bold text-[#166534] tabular-nums truncate block">
                +฿{monthlyIncomeTHB.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="bg-[#FAF2EB] p-3 rounded-[16px] flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#DC2626]/15 text-[#DC2626] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-lg font-bold">arrow_upward</span>
            </div>
            <div className="min-w-0">
              <span className="text-[10px] text-[#82756A] block font-medium">ဒီလ ထွက်ငွေ</span>
              <span className="text-xs sm:text-sm font-bold text-[#DC2626] tabular-nums truncate block">
                -฿{monthlyExpenseTHB.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Safe-to-Spend (ဒီနေ့သုံးနိုင်သောငွေ) Card */}
      <div className="bg-white rounded-[22px] p-4.5 border border-[#E7DFD5] shadow-xs">
        {monthlyBudget === 0 ? (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-[#D4A373]/20 text-[#7D562D] flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-xl">savings</span>
              </div>
              <div>
                <h3 className="text-xs font-bold text-[#1E1B17]">ဒီနေ့သုံးနိုင်သောငွေ (Safe-to-Spend)</h3>
                <p className="text-[11px] text-[#82756A]">လစဉ်ဘတ်ဂျက် မသတ်မှတ်ရသေးပါ</p>
              </div>
            </div>
            <button
              onClick={() => setIsBudgetModalOpen(true)}
              className="px-3 py-2 bg-[#D4A373] text-[#1E1B17] text-xs font-bold rounded-[14px] shadow-xs hover:bg-[#C59260] active:scale-95 transition-all cursor-pointer shrink-0"
            >
              လစဉ်ဘတ်ဂျက် သတ်မှတ်ပါ
            </button>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-lg text-[#7D562D]">savings</span>
                <span className="text-xs font-bold text-[#1E1B17]">ဒီနေ့သုံးနိုင်သောငွေ (Safe-to-Spend)</span>
              </div>
              <button
                onClick={() => setIsBudgetModalOpen(true)}
                className="text-xs font-bold text-[#7D562D] tabular-nums hover:underline cursor-pointer"
              >
                ฿{safeToSpendPerDay.toLocaleString()} / ရက်
              </button>
            </div>

            <p className="text-[11px] text-[#82756A]">
              လကုန်ရန် {daysRemaining} ရက် ကျန်ရှိမှုအပေါ် တွက်ချက်ထားသည်
            </p>

            {/* Progress Bar */}
            <div className="w-full bg-[#FAF2EB] rounded-full h-2.5 my-2.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  budgetPercentUsed > 85 ? 'bg-[#DC2626]' : 'bg-[#D4A373]'
                }`}
                style={{ width: `${budgetPercentUsed}%` }}
              ></div>
            </div>

            <div className="flex justify-between text-[11px] text-[#82756A]">
              <span>သုံးပြီး ฿{monthlyExpenseTHB.toLocaleString()} ({budgetPercentUsed}%)</span>
              <span className="text-[#166534] font-semibold">ကျန်ငွေ ฿{budgetRemaining.toLocaleString()}</span>
            </div>
          </div>
        )}
      </div>

      {/* 5. Wallets Summary (Horizontal Scroll Carousel) */}
      <div>
        <div className="flex items-center justify-between mb-2 px-0.5">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-base text-[#7D562D]">account_balance_wallet</span>
            <h3 className="text-xs font-bold text-[#1E1B17]">ပိုက်ဆံအိတ်များ ({wallets.length})</h3>
          </div>
          <button
            onClick={() => onNavigate('wallets')}
            className="text-xs font-bold text-[#0891B2] hover:underline cursor-pointer"
          >
            အားလုံးကြည့်ရန် →
          </button>
        </div>

        <div className="flex gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory py-1 px-0.5">
          {wallets.map((wallet) => {
            const currentBal = walletCalculatedBalances[wallet.id] ?? wallet.currentBalance ?? wallet.initialBalance ?? 0;
            return (
              <div
                key={wallet.id}
                className="snap-start shrink-0 w-[200px] bg-white rounded-[20px] p-3.5 border border-[#E7DFD5] shadow-xs flex flex-col justify-between"
              >
                <div className="flex items-start justify-between mb-2">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      wallet.type === 'bank'
                        ? 'bg-[#006780]/15 text-[#006780]'
                        : 'bg-[#7D562D]/15 text-[#7D562D]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-lg">
                      {wallet.type === 'bank' ? 'account_balance' : 'payments'}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FAF2EB] text-[#82756A]">
                    {wallet.currency}
                  </span>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-[#1E1B17] truncate">{wallet.name}</h4>
                  <p className="text-sm font-extrabold text-[#7D562D] tabular-nums mt-0.5">
                    {wallet.currency === 'THB' ? '฿' : wallet.currency === 'USD' ? '$' : 'K'}
                    {currentBal.toLocaleString()}
                  </p>
                </div>
              </div>
            );
          })}

          {/* Add Wallet Shortcut Card */}
          <button
            onClick={() => onNavigate('wallets')}
            className="snap-start shrink-0 w-[140px] bg-[#FAF2EB] hover:bg-[#FAF2EB]/80 rounded-[20px] p-3.5 border border-dashed border-[#E7DFD5] flex flex-col items-center justify-center gap-1.5 text-center cursor-pointer transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-white text-[#7D562D] flex items-center justify-center shadow-xs">
              <span className="material-symbols-outlined text-lg">add</span>
            </div>
            <span className="text-xs font-bold text-[#7D562D]">+ ထည့်မည်</span>
          </button>
        </div>
      </div>

      {/* 6. Recent 5 Transactions */}
      <div>
        <div className="flex items-center justify-between mb-2 px-0.5">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-base text-[#7D562D]">receipt_long</span>
            <h3 className="text-xs font-bold text-[#1E1B17]">လတ်တလော စာရင်းများ</h3>
          </div>
          <button
            onClick={() => onNavigate('history')}
            className="text-xs font-bold text-[#0891B2] hover:underline cursor-pointer"
          >
            အားလုံးကြည့်ရန် ({transactions.length}) →
          </button>
        </div>

        <div className="space-y-2">
          {transactions.slice(0, 5).map((tx) => {
            const isExpense = tx.type === 'expense';
            const isIncome = tx.type === 'income';
            return (
              <div
                key={tx.id}
                className="bg-white p-3.5 rounded-[18px] border border-[#E7DFD5] shadow-xs flex items-center justify-between gap-3 hover:border-[#D4A373] transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-[#FAF2EB] flex items-center justify-center text-lg shrink-0">
                    {getCategoryIcon(tx)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#1E1B17] truncate">
                      {tx.note || tx.category || 'စာရင်း'}
                    </p>
                    <div className="flex items-center gap-1.5 text-[10px] text-[#82756A] truncate">
                      <span>{tx.category}</span>
                      <span>•</span>
                      <span>{tx.walletName || 'ပိုက်ဆံအိတ်'}</span>
                      <span>•</span>
                      <span>{tx.date}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span
                    className={`text-xs font-bold tabular-nums block ${
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

          {/* Empty State */}
          {transactions.length === 0 && !loading && (
            <div className="bg-white rounded-[20px] p-6 border border-[#E7DFD5] shadow-xs text-center flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-[#FAF2EB] text-[#7D562D] flex items-center justify-center mb-2">
                <span className="material-symbols-outlined text-2xl">post_add</span>
              </div>
              <p className="text-xs font-bold text-[#1E1B17]">ပထမဆုံး စာရင်းသွင်းကြည့်ပါ</p>
              <p className="text-[11px] text-[#82756A] mt-0.5 mb-3">
                ဝင်ငွေ၊ ထွက်ငွေများကို စတင်မှတ်သားနိုင်ပါပြီ
              </p>
              <button
                onClick={() => onNavigate('quick-add')}
                className="px-4 py-2 bg-[#D4A373] text-[#1E1B17] text-xs font-bold rounded-[14px] shadow-xs hover:bg-[#C59260] active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-base">add</span>
                <span>စာရင်းသွင်းရန်</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Budget Setter Modal */}
      <BudgetModal
        isOpen={isBudgetModalOpen}
        onClose={() => setIsBudgetModalOpen(false)}
        currentBudget={monthlyBudget}
      />
    </div>
  );
};
