import React, { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  doc,
  deleteDoc,
  updateDoc,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { Wallet, UserSettings, EXPENSE_CATEGORIES, CategoryBudget, Transaction } from '../../types';
import { WalletFormModal } from '../WalletFormModal';
import { CategoryBudgetModal } from '../CategoryBudgetModal';

export const WalletsTab: React.FC = () => {
  const { user } = useAuth();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [budgets, setBudgets] = useState<Record<string, CategoryBudget>>({});
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [selectedWalletForEdit, setSelectedWalletForEdit] = useState<Wallet | null>(null);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [selectedCategoryForBudget, setSelectedCategoryForBudget] = useState<string | null>(null);
  const [isCategoryBudgetModalOpen, setIsCategoryBudgetModalOpen] = useState(false);

  // Delete Wallet Confirmation State
  const [walletToDelete, setWalletToDelete] = useState<Wallet | null>(null);
  const [txCountForDeleteWallet, setTxCountForDeleteWallet] = useState<number>(0);
  const [isDeleting, setIsDeleting] = useState(false);

  // Settings edit state
  const [monthlyBudgetInput, setMonthlyBudgetInput] = useState<string>('0');
  const [usdRateInput, setUsdRateInput] = useState<string>('35');
  const [mmkRateInput, setMmkRateInput] = useState<string>('0.0165');
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsSavedToast, setSettingsSavedToast] = useState(false);

  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  useEffect(() => {
    if (!user?.uid || !db) {
      setLoading(false);
      return;
    }

    // 1. Wallets Listener
    const walletsRef = collection(db, 'users', user.uid, 'wallets');
    const unsubWallets = onSnapshot(
      walletsRef,
      (snapshot) => {
        const items: Wallet[] = [];
        snapshot.forEach((docSnap) => {
          items.push({ id: docSnap.id, ...(docSnap.data() as any) });
        });
        setWallets(items);
        setLoading(false);
      },
      (err) => console.warn('Wallets snapshot warning:', err)
    );

    // 2. Settings Listener
    const settingsRef = doc(db, 'users', user.uid, 'settings', 'main');
    const unsubSettings = onSnapshot(
      settingsRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as UserSettings;
          setSettings(data);
          setMonthlyBudgetInput(String(data.monthlyBudget || 0));
          setUsdRateInput(String(data.fxRates?.USD || 35));
          setMmkRateInput(String(data.fxRates?.MMK || 0.0165));
        }
      },
      (err) => console.warn('Settings snapshot warning:', err)
    );

    // 3. Category Budgets Listener
    const budgetsRef = collection(db, 'users', user.uid, 'budgets');
    const unsubBudgets = onSnapshot(
      budgetsRef,
      (snapshot) => {
        const map: Record<string, CategoryBudget> = {};
        snapshot.forEach((docSnap) => {
          const b = docSnap.data() as CategoryBudget;
          map[b.categoryId || docSnap.id] = { id: docSnap.id, ...b };
        });
        setBudgets(map);
      },
      (err) => console.warn('Budgets snapshot warning:', err)
    );

    // 4. Transactions Listener for Realtime calculations
    const txRef = collection(db, 'users', user.uid, 'transactions');
    const unsubTx = onSnapshot(
      txRef,
      (snapshot) => {
        const list: Transaction[] = [];
        snapshot.forEach((snap) => {
          list.push({ id: snap.id, ...(snap.data() as any) });
        });
        setTransactions(list);
      },
      (err) => console.warn('Tx snapshot warning:', err)
    );

    return () => {
      unsubWallets();
      unsubSettings();
      unsubBudgets();
      unsubTx();
    };
  }, [user?.uid]);

  // Calculate wallet dynamic balances
  const walletBalances: Record<string, number> = {};
  wallets.forEach((w) => {
    walletBalances[w.id] = Number(w.initialBalance || 0);
  });

  // Calculate category spending for this month
  const categorySpendingThisMonth: Record<string, number> = {};
  EXPENSE_CATEGORIES.forEach((c) => {
    categorySpendingThisMonth[c.id] = 0;
  });

  transactions.forEach((tx) => {
    const isThisMonth = tx.date ? tx.date.startsWith(currentMonthStr) : true;
    const baseAmt = tx.amountBase || tx.amount || 0;

    if (tx.type === 'expense') {
      if (tx.walletId && walletBalances[tx.walletId] !== undefined) {
        walletBalances[tx.walletId] -= tx.amount;
      }
      if (isThisMonth && tx.categoryId) {
        categorySpendingThisMonth[tx.categoryId] =
          (categorySpendingThisMonth[tx.categoryId] || 0) + baseAmt;
      }
    } else if (tx.type === 'income') {
      if (tx.walletId && walletBalances[tx.walletId] !== undefined) {
        walletBalances[tx.walletId] += tx.amount;
      }
    } else if (tx.type === 'transfer') {
      if (tx.walletId && walletBalances[tx.walletId] !== undefined) {
        walletBalances[tx.walletId] -= tx.amount;
      }
      if (tx.toWalletId && walletBalances[tx.toWalletId] !== undefined) {
        walletBalances[tx.toWalletId] += tx.amount;
      }
    }
  });

  // Delete wallet action handler
  const promptDeleteWallet = async (wallet: Wallet) => {
    if (!user?.uid || !db) return;
    setWalletToDelete(wallet);
    try {
      const q = query(
        collection(db, 'users', user.uid, 'transactions'),
        where('walletId', '==', wallet.id)
      );
      const snap = await getDocs(q);
      setTxCountForDeleteWallet(snap.size);
    } catch {
      setTxCountForDeleteWallet(0);
    }
  };

  const confirmDeleteWallet = async () => {
    if (!user?.uid || !db || !walletToDelete || isDeleting) return;
    try {
      setIsDeleting(true);
      const wRef = doc(db, 'users', user.uid, 'wallets', walletToDelete.id);
      await deleteDoc(wRef);
      setWalletToDelete(null);
    } catch (err) {
      console.error('Error deleting wallet:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Save Settings handler (Total Budget & FX Rates)
  const handleSaveSettings = async () => {
    if (!user?.uid || !db || isSavingSettings) return;
    try {
      setIsSavingSettings(true);
      const settingsRef = doc(db, 'users', user.uid, 'settings', 'main');
      await updateDoc(settingsRef, {
        monthlyBudget: parseFloat(monthlyBudgetInput) || 0,
        fxRates: {
          USD: parseFloat(usdRateInput) || 35,
          MMK: parseFloat(mmkRateInput) || 0.0165,
        },
      });
      setSettingsSavedToast(true);
      setTimeout(() => setSettingsSavedToast(false), 2000);
    } catch (err) {
      console.error('Error updating settings:', err);
    } finally {
      setIsSavingSettings(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 w-full pb-8 select-none relative">
      {/* Toast Alert */}
      {settingsSavedToast && (
        <div className="fixed top-18 left-1/2 -translate-x-1/2 z-50 bg-[#166534] text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-1.5 text-xs font-bold animate-bounce">
          <span className="material-symbols-outlined text-base">check_circle</span>
          <span>ဆက်တင်များ သိမ်းပြီးပါပြီ ✓</span>
        </div>
      )}

      {/* SECTION 1: Wallets List & Add Button */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-lg text-[#7D562D]">account_balance_wallet</span>
            <h2 className="text-sm font-bold text-[#1E1B17]">ပိုက်ဆံအိတ်များ ({wallets.length})</h2>
          </div>
          <button
            onClick={() => {
              setSelectedWalletForEdit(null);
              setIsWalletModalOpen(true);
            }}
            className="flex items-center gap-1 px-3 py-1.5 bg-[#D4A373] text-[#1E1B17] hover:bg-[#C59260] rounded-[14px] text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm font-bold">add</span>
            <span>အသစ်ထည့်ရန်</span>
          </button>
        </div>

        <div className="space-y-2.5">
          {wallets.map((w) => {
            const currentBal = walletBalances[w.id] ?? w.currentBalance ?? w.initialBalance ?? 0;
            return (
              <div
                key={w.id}
                className="bg-white p-4 rounded-[22px] border border-[#E7DFD5] shadow-xs flex items-center justify-between gap-3 hover:border-[#D4A373] transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      w.type === 'bank'
                        ? 'bg-[#006780]/15 text-[#006780]'
                        : 'bg-[#7D562D]/15 text-[#7D562D]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-xl">
                      {w.type === 'bank' ? 'account_balance' : w.type === 'cash' ? 'payments' : 'credit_card'}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-xs font-bold text-[#1E1B17] truncate">{w.name}</h4>
                      <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-[#FAF2EB] text-[#82756A] font-bold uppercase">
                        {w.currency}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#82756A] mt-0.5">
                      အစလက်ကျန်: {w.currency === 'THB' ? '฿' : w.currency === 'USD' ? '$' : 'K'}
                      {(w.initialBalance || 0).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right mr-1">
                    <span className="text-sm font-extrabold text-[#7D562D] tabular-nums block">
                      {w.currency === 'THB' ? '฿' : w.currency === 'USD' ? '$' : 'K'}
                      {currentBal.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-[#82756A] font-medium">လက်ကျန်</span>
                  </div>

                  {/* Edit Button */}
                  <button
                    onClick={() => {
                      setSelectedWalletForEdit(w);
                      setIsWalletModalOpen(true);
                    }}
                    className="w-8 h-8 rounded-full bg-[#FAF2EB] text-[#82756A] hover:text-[#7D562D] flex items-center justify-center cursor-pointer transition-colors active:scale-90"
                    title="ပြင်မည်"
                  >
                    <span className="material-symbols-outlined text-base">edit</span>
                  </button>

                  {/* Delete Button */}
                  <button
                    onClick={() => promptDeleteWallet(w)}
                    className="w-8 h-8 rounded-full bg-[#FFDAD6]/40 text-[#DC2626] hover:bg-[#FFDAD6] flex items-center justify-center cursor-pointer transition-colors active:scale-90"
                    title="ဖျက်မည်"
                  >
                    <span className="material-symbols-outlined text-base">delete</span>
                  </button>
                </div>
              </div>
            );
          })}

          {wallets.length === 0 && !loading && (
            <div className="text-center py-6 text-xs text-[#82756A] bg-white rounded-[20px] border border-[#E7DFD5]">
              ပိုက်ဆံအိတ် မရှိသေးပါ
            </div>
          )}
        </div>
      </div>

      {/* SECTION 2: Category Monthly Budgets & Color-coded Progress Bar */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-lg text-[#7D562D]">donut_large</span>
            <h2 className="text-sm font-bold text-[#1E1B17]">Category အလိုက် လစဉ်ဘတ်ဂျက်</h2>
          </div>
          <span className="text-[10px] font-semibold text-[#82756A]">
            နှိပ်၍ သတ်မှတ်နိုင်သည်
          </span>
        </div>

        <div className="space-y-2.5">
          {EXPENSE_CATEGORIES.map((cat) => {
            const budgetLimit = budgets[cat.id]?.monthlyLimit || 0;
            const spent = categorySpendingThisMonth[cat.id] || 0;
            const percent = budgetLimit > 0 ? Math.round((spent / budgetLimit) * 100) : 0;

            // Progress bar color constraint:
            // < 80% -> Green (#166534), 80-99% -> Yellow (#CA8A04), >= 100% -> Red (#DC2626)
            let barColor = 'bg-[#166534]';
            let badgeBg = 'bg-[#A6F4B5]/40 text-[#166534]';
            let statusLabel = 'ပုံမှန်';

            if (budgetLimit === 0) {
              barColor = 'bg-[#82756A]';
              badgeBg = 'bg-[#FAF2EB] text-[#82756A]';
              statusLabel = 'မသတ်မှတ်ရသေး';
            } else if (percent >= 100) {
              barColor = 'bg-[#DC2626]';
              badgeBg = 'bg-[#FFDAD6] text-[#DC2626]';
              statusLabel = 'ကျော်လွန်';
            } else if (percent >= 80) {
              barColor = 'bg-[#CA8A04]';
              badgeBg = 'bg-[#FEF08A] text-[#854D0E]';
              statusLabel = 'သတိပြုရန်';
            }

            return (
              <div
                key={cat.id}
                onClick={() => {
                  setSelectedCategoryForBudget(cat.id);
                  setIsCategoryBudgetModalOpen(true);
                }}
                className="bg-white p-3.5 rounded-[20px] border border-[#E7DFD5] shadow-xs cursor-pointer hover:border-[#D4A373] transition-all"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{cat.icon}</span>
                    <div>
                      <h4 className="text-xs font-bold text-[#1E1B17]">{cat.name}</h4>
                      <p className="text-[10px] text-[#82756A]">
                        {budgetLimit > 0
                          ? `ဘတ်ဂျက် ฿${budgetLimit.toLocaleString()}`
                          : 'ဘတ်ဂျက် မသတ်မှတ်ရသေးပါ'}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs font-bold text-[#1E1B17] tabular-nums block">
                      ฿{spent.toLocaleString()}
                    </span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${badgeBg}`}>
                      {budgetLimit > 0 ? `${percent}% • ${statusLabel}` : statusLabel}
                    </span>
                  </div>
                </div>

                {/* Progress Bar with strictly checked 3 colors */}
                <div className="w-full bg-[#FAF2EB] rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                    style={{ width: `${Math.min(100, percent)}%` }}
                  ></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 3: Settings (Total Budget & Exchange Rates USD, MMK) */}
      <div className="bg-white rounded-[24px] p-5 border border-[#E7DFD5] shadow-xs">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-xl bg-[#0891B2]/15 text-[#0891B2] flex items-center justify-center">
            <span className="material-symbols-outlined text-lg">tune</span>
          </div>
          <div>
            <h3 className="text-xs font-bold text-[#1E1B17]">ဘတ်ဂျက်နှင့် ငွေလဲနှုန်း ဆက်တင်</h3>
            <p className="text-[10px] text-[#82756A]">လစဉ် စုစုပေါင်းဘတ်ဂျက်နှင့် FX နှုန်းများ ပြင်ရန်</p>
          </div>
        </div>

        <div className="space-y-3 mb-4">
          {/* Total Monthly Budget */}
          <div>
            <label className="text-[11px] font-bold text-[#82756A] block mb-1">
              လစဉ် စုစုပေါင်း ဘတ်ဂျက် (THB)
            </label>
            <div className="flex items-center bg-[#FAF2EB] border border-[#E7DFD5] rounded-[14px] px-3 py-2">
              <span className="text-xs font-bold text-[#7D562D] mr-2">฿</span>
              <input
                type="number"
                value={monthlyBudgetInput}
                onChange={(e) => setMonthlyBudgetInput(e.target.value)}
                className="bg-transparent border-0 outline-none text-xs font-extrabold text-[#1E1B17] w-full tabular-nums"
                placeholder="0"
              />
            </div>
          </div>

          {/* FX Rates: USD & MMK */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-[11px] font-bold text-[#82756A] block mb-1">
                1 USD = (THB)
              </label>
              <div className="flex items-center bg-[#FAF2EB] border border-[#E7DFD5] rounded-[14px] px-3 py-2">
                <input
                  type="number"
                  step="0.01"
                  value={usdRateInput}
                  onChange={(e) => setUsdRateInput(e.target.value)}
                  className="bg-transparent border-0 outline-none text-xs font-extrabold text-[#1E1B17] w-full tabular-nums"
                />
                <span className="text-[10px] text-[#82756A] font-bold ml-1">฿</span>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-[#82756A] block mb-1">
                1 MMK = (THB)
              </label>
              <div className="flex items-center bg-[#FAF2EB] border border-[#E7DFD5] rounded-[14px] px-3 py-2">
                <input
                  type="number"
                  step="0.0001"
                  value={mmkRateInput}
                  onChange={(e) => setMmkRateInput(e.target.value)}
                  className="bg-transparent border-0 outline-none text-xs font-extrabold text-[#1E1B17] w-full tabular-nums"
                />
                <span className="text-[10px] text-[#82756A] font-bold ml-1">฿</span>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={handleSaveSettings}
          disabled={isSavingSettings}
          className="w-full py-3 bg-[#D4A373] hover:bg-[#C59260] text-[#1E1B17] rounded-[16px] text-xs font-bold shadow-xs active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-1.5"
        >
          <span className="material-symbols-outlined text-base">save</span>
          <span>{isSavingSettings ? 'သိမ်းနေသည်...' : 'ဆက်တင် သိမ်းဆည်းမည်'}</span>
        </button>
      </div>

      {/* Delete Confirmation Popup */}
      {walletToDelete && (
        <div className="fixed inset-0 z-50 bg-[#1E1B17]/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-[340px] rounded-[24px] p-5 border border-[#E7DFD5] shadow-2xl animate-fadeIn text-center">
            <div className="w-12 h-12 rounded-full bg-[#FFDAD6] text-[#DC2626] flex items-center justify-center mx-auto mb-3">
              <span className="material-symbols-outlined text-2xl">delete_forever</span>
            </div>
            <h3 className="text-sm font-bold text-[#1E1B17] mb-1">
              "{walletToDelete.name}" ကို ဖျက်မည်လား?
            </h3>
            {txCountForDeleteWallet > 0 ? (
              <div className="p-2.5 bg-[#FFDAD6]/50 rounded-[14px] text-xs text-[#DC2626] text-left mb-4">
                <p className="font-bold flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">warning</span>
                  <span>သတိပေးချက်</span>
                </p>
                <p className="mt-0.5">
                  ဒီပိုက်ဆံအိတ်တွင် စာရင်းမှတ်တမ်း {txCountForDeleteWallet} ခု ရှိနေပါသည်။ ဖျက်ပါက ထိုမှတ်တမ်းများပါ ထိခိုက်နိုင်ပါသည်။
                </p>
              </div>
            ) : (
              <p className="text-xs text-[#82756A] mb-4">
                ဤပိုက်ဆံအိတ်ကို အပြီးအပိုင် ဖျက်ပစ်ပါမည်။
              </p>
            )}

            <div className="flex items-center gap-2">
              <button
                onClick={() => setWalletToDelete(null)}
                className="flex-1 py-2.5 bg-[#FAF2EB] text-[#82756A] font-bold text-xs rounded-[16px] hover:bg-[#E7DFD5] cursor-pointer"
              >
                မဖျက်တော့ပါ
              </button>
              <button
                onClick={confirmDeleteWallet}
                disabled={isDeleting}
                className="flex-1 py-2.5 bg-[#DC2626] text-white font-bold text-xs rounded-[16px] shadow-sm hover:bg-[#B91C1C] cursor-pointer"
              >
                {isDeleting ? 'ဖျက်နေသည်...' : 'အတည်ပြု ဖျက်မည်'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Wallet Add / Edit Modal */}
      <WalletFormModal
        isOpen={isWalletModalOpen}
        wallet={selectedWalletForEdit}
        onClose={() => {
          setIsWalletModalOpen(false);
          setSelectedWalletForEdit(null);
        }}
      />

      {/* Category Budget Modal */}
      <CategoryBudgetModal
        isOpen={isCategoryBudgetModalOpen}
        categoryId={selectedCategoryForBudget}
        currentLimit={
          selectedCategoryForBudget ? budgets[selectedCategoryForBudget]?.monthlyLimit || 0 : 0
        }
        onClose={() => {
          setIsCategoryBudgetModalOpen(false);
          setSelectedCategoryForBudget(null);
        }}
      />
    </div>
  );
};
