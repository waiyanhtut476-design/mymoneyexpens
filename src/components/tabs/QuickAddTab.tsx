import React, { useState, useEffect, useRef } from 'react';
import {
  collection,
  addDoc,
  doc,
  onSnapshot,
  updateDoc,
  increment,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  CurrencyCode,
  TransactionType,
  Wallet,
  UserSettings,
} from '../../types';

export const QuickAddTab: React.FC = () => {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [transactionType, setTransactionType] = useState<TransactionType>('expense');
  const [amountStr, setAmountStr] = useState<string>('0');
  const [currency, setCurrency] = useState<CurrencyCode>('THB');
  const [selectedCategory, setSelectedCategory] = useState<string>(EXPENSE_CATEGORIES[0].id);
  const [note, setNote] = useState<string>('');
  const [date, setDate] = useState<string>(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });

  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [selectedWalletId, setSelectedWalletId] = useState<string>('');
  const [toWalletId, setToWalletId] = useState<string>('');
  const [settings, setSettings] = useState<UserSettings | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showToast, setShowToast] = useState(false);

  // Gemini OCR Receipt Scanner State
  const [isScanning, setIsScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [scanSuccessBanner, setScanSuccessBanner] = useState<boolean>(false);

  // Subscribe to wallets and user settings
  useEffect(() => {
    if (!user?.uid || !db) return;

    // Wallets listener
    const walletsRef = collection(db, 'users', user.uid, 'wallets');
    const unsubWallets = onSnapshot(
      walletsRef,
      (snapshot) => {
        const loaded: Wallet[] = [];
        snapshot.forEach((snap) => {
          loaded.push({ id: snap.id, ...(snap.data() as any) });
        });
        setWallets(loaded);
        if (loaded.length > 0 && !selectedWalletId) {
          setSelectedWalletId(loaded[0].id);
          if (loaded.length > 1) {
            setToWalletId(loaded[1].id);
          }
        }
      },
      (err) => console.warn('Wallets snapshot warning:', err)
    );

    // Settings listener
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

    return () => {
      unsubWallets();
      unsubSettings();
    };
  }, [user?.uid]);

  const numAmount = parseFloat(amountStr) || 0;
  const usdRate = settings?.fxRates?.USD || 35;
  const mmkRate = settings?.fxRates?.MMK || 0.0165;

  // Calculate THB base equivalent using fxRates
  const calculateBaseTHB = (amt: number, curr: CurrencyCode): number => {
    if (curr === 'THB') return amt;
    if (curr === 'USD') return amt * usdRate;
    if (curr === 'MMK') return amt * mmkRate;
    return amt;
  };

  const amountBaseTHB = calculateBaseTHB(numAmount, currency);

  // Numpad Handlers
  const handleNumClick = (val: string) => {
    if (amountStr === '0' && val !== '.') {
      setAmountStr(val);
    } else {
      if (val === '.' && amountStr.includes('.')) return;
      if (amountStr.length < 9) {
        setAmountStr(amountStr + val);
      }
    }
  };

  const handleQuickAdd = (addValue: number) => {
    const current = parseFloat(amountStr) || 0;
    const updated = current + addValue;
    setAmountStr(String(updated));
  };

  const handleDelete = () => {
    if (amountStr.length <= 1) {
      setAmountStr('0');
    } else {
      setAmountStr(amountStr.slice(0, -1));
    }
  };

  const handleClear = () => {
    setAmountStr('0');
  };

  // Receipt Scanner Handler using server-side Gemini OCR
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsScanning(true);
      setScanMessage(null);
      setScanSuccessBanner(false);

      // Convert file to base64
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = reader.result as string;

        try {
          const res = await fetch('/api/scan-receipt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageBase64: base64Data,
              mimeType: file.type || 'image/jpeg',
            }),
          });

          const data = await res.json();

          if (data.success && data.data) {
            const result = data.data;
            setTransactionType('expense');

            if (result.amount) {
              setAmountStr(String(result.amount));
            }
            if (result.currency && ['THB', 'USD', 'MMK'].includes(result.currency)) {
              setCurrency(result.currency as CurrencyCode);
            }
            if (result.categoryId && EXPENSE_CATEGORIES.some((c) => c.id === result.categoryId)) {
              setSelectedCategory(result.categoryId);
            }
            if (result.merchant || result.note) {
              const fullNote = [result.merchant, result.note].filter(Boolean).join(' - ');
              setNote(fullNote);
            }
            if (result.date) {
              setDate(result.date);
            }

            setScanSuccessBanner(true);
          } else {
            setScanMessage(data.message || 'ဖတ်မရပါ၊ ကိုယ်တိုင်ဖြည့်ပါ');
          }
        } catch (scanErr) {
          console.error('Scan API error:', scanErr);
          setScanMessage('ဖတ်မရပါ၊ ကိုယ်တိုင်ဖြည့်ပါ');
        } finally {
          setIsScanning(false);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }
      };

      reader.readAsDataURL(file);
    } catch (err) {
      console.error('File read error:', err);
      setIsScanning(false);
      setScanMessage('ဖတ်မရပါ၊ ကိုယ်တိုင်ဖြည့်ပါ');
    }
  };

  // Submit to Firestore
  const handleSaveTransaction = async () => {
    if (numAmount <= 0 || !user?.uid || !db || isSubmitting) return;

    try {
      setIsSubmitting(true);

      const fromWallet = wallets.find((w) => w.id === selectedWalletId);
      const destWallet =
        transactionType === 'transfer' ? wallets.find((w) => w.id === toWalletId) : null;

      const currentCategoryObj =
        transactionType === 'expense'
          ? EXPENSE_CATEGORIES.find((c) => c.id === selectedCategory)
          : transactionType === 'income'
          ? INCOME_CATEGORIES.find((c) => c.id === selectedCategory)
          : null;

      const categoryName = currentCategoryObj ? currentCategoryObj.name : 'လွှဲပြောင်းမှု';

      // 1. Write transaction document to users/{uid}/transactions
      const transactionsRef = collection(db, 'users', user.uid, 'transactions');
      await addDoc(transactionsRef, {
        type: transactionType,
        amount: numAmount,
        currency,
        amountBase: Number(amountBaseTHB.toFixed(2)),
        walletId: selectedWalletId || 'default',
        walletName: fromWallet?.name || 'ပိုက်ဆံအိတ်',
        ...(transactionType === 'transfer' && {
          toWalletId,
          toWalletName: destWallet?.name || 'ပိုက်ဆံအိတ်',
        }),
        categoryId: transactionType === 'transfer' ? 'transfer' : selectedCategory,
        category: categoryName,
        note: note.trim(),
        date,
        createdAt: serverTimestamp(),
      });

      // 2. Adjust wallet balances in Firestore
      if (selectedWalletId && fromWallet) {
        const fromWalletRef = doc(db, 'users', user.uid, 'wallets', selectedWalletId);
        if (transactionType === 'expense' || transactionType === 'transfer') {
          await updateDoc(fromWalletRef, {
            currentBalance: increment(-numAmount),
          });
        } else if (transactionType === 'income') {
          await updateDoc(fromWalletRef, {
            currentBalance: increment(numAmount),
          });
        }
      }

      if (transactionType === 'transfer' && toWalletId && destWallet) {
        const toWalletRef = doc(db, 'users', user.uid, 'wallets', toWalletId);
        await updateDoc(toWalletRef, {
          currentBalance: increment(numAmount),
        });
      }

      // 3. Show Toast & Reset Form
      setShowToast(true);
      setAmountStr('0');
      setNote('');
      setScanSuccessBanner(false);

      setTimeout(() => {
        setShowToast(false);
      }, 2500);
    } catch (err) {
      console.error('Save transaction error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const currencySymbol = currency === 'THB' ? '฿' : currency === 'USD' ? '$' : 'K';
  const categoriesList = transactionType === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  return (
    <div className="flex flex-col w-full pb-8 select-none relative">
      {/* Toast Notification */}
      {showToast && (
        <div className="fixed top-18 left-1/2 -translate-x-1/2 z-50 bg-[#166534] text-white px-5 py-2.5 rounded-full shadow-lg flex items-center gap-2 animate-bounce text-xs font-bold">
          <span className="material-symbols-outlined text-lg">check_circle</span>
          <span>စာရင်း သိမ်းပြီးပါပြီ ✓</span>
        </div>
      )}

      {/* OCR Failure Alert Toast */}
      {scanMessage && (
        <div className="fixed top-18 left-1/2 -translate-x-1/2 z-50 bg-[#DC2626] text-white px-5 py-2.5 rounded-full shadow-lg flex items-center gap-2 text-xs font-bold animate-fadeIn">
          <span className="material-symbols-outlined text-lg">error</span>
          <span>{scanMessage}</span>
          <button onClick={() => setScanMessage(null)} className="ml-2 text-white/80 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {/* Hidden File Input for Receipt Capture */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Top Header Row with Receipt Scanner Button */}
      <div className="flex items-center justify-between gap-2 mb-2 px-0.5">
        <span className="text-[11px] font-bold text-[#82756A] uppercase tracking-wider">
          စာရင်းအသစ် ထည့်သွင်းခြင်း
        </span>

        {/* ပြေစာစကင် (Scan Receipt) Button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isScanning}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#E7DFD5] hover:border-[#7D562D] rounded-full text-xs font-bold text-[#7D562D] shadow-xs active:scale-95 transition-all cursor-pointer disabled:opacity-50"
        >
          {isScanning ? (
            <>
              <span className="material-symbols-outlined text-base animate-spin text-[#0891B2]">
                progress_activity
              </span>
              <span className="text-[#0891B2]">ဖတ်ရှုနေပါသည်...</span>
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-base text-[#D4A373]">
                document_scanner
              </span>
              <span>ပြေစာစကင်</span>
            </>
          )}
        </button>
      </div>

      {/* Pre-fill Success Review Banner */}
      {scanSuccessBanner && (
        <div className="mb-2.5 bg-[#A6F4B5]/30 border border-[#166534]/30 rounded-[16px] p-2.5 flex items-center justify-between gap-2 text-xs text-[#166534] font-medium animate-fadeIn">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-lg font-bold">auto_awesome</span>
            <span>ပြေစာမှ အချက်အလက်များ ဖြည့်ပေးထားပါသည် (စစ်ဆေးပြီး သိမ်းဆည်းပါ)</span>
          </div>
          <button
            onClick={() => setScanSuccessBanner(false)}
            className="text-[#166534] hover:opacity-70 text-sm font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* 1. Top Type Switcher: ထွက်ငွေ / ဝင်ငွေ / လွှဲပြောင်း */}
      <div className="bg-[#FAF2EB] p-1 rounded-[20px] border border-[#E7DFD5] flex items-center justify-between gap-1 shadow-xs">
        <button
          onClick={() => {
            setTransactionType('expense');
            setSelectedCategory(EXPENSE_CATEGORIES[0].id);
          }}
          className={`flex-1 py-2.5 text-center rounded-[16px] text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
            transactionType === 'expense'
              ? 'bg-white text-[#DC2626] shadow-xs'
              : 'text-[#82756A] hover:text-[#1E1B17]'
          }`}
        >
          <span className="material-symbols-outlined text-base">arrow_outward</span>
          <span>ထွက်ငွေ</span>
        </button>

        <button
          onClick={() => {
            setTransactionType('income');
            setSelectedCategory(INCOME_CATEGORIES[0].id);
          }}
          className={`flex-1 py-2.5 text-center rounded-[16px] text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
            transactionType === 'income'
              ? 'bg-white text-[#166534] shadow-xs'
              : 'text-[#82756A] hover:text-[#1E1B17]'
          }`}
        >
          <span className="material-symbols-outlined text-base">arrow_downward</span>
          <span>ဝင်ငွေ</span>
        </button>

        <button
          onClick={() => setTransactionType('transfer')}
          className={`flex-1 py-2.5 text-center rounded-[16px] text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
            transactionType === 'transfer'
              ? 'bg-white text-[#0891B2] shadow-xs'
              : 'text-[#82756A] hover:text-[#1E1B17]'
          }`}
        >
          <span className="material-symbols-outlined text-base">sync_alt</span>
          <span>လွှဲပြောင်း</span>
        </button>
      </div>

      {/* 2. Currency Selector & Rate Glance Bar */}
      <div className="flex items-center justify-between mt-3 px-1">
        {/* Currency Toggle */}
        <div className="flex items-center gap-1 bg-white border border-[#E7DFD5] p-1 rounded-full shadow-xs">
          {(['THB', 'USD', 'MMK'] as CurrencyCode[]).map((c) => (
            <button
              key={c}
              onClick={() => setCurrency(c)}
              className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
                currency === c
                  ? 'bg-[#7D562D] text-white shadow-xs'
                  : 'text-[#82756A] hover:text-[#1E1B17]'
              }`}
            >
              {c} {c === 'THB' ? '(฿)' : c === 'USD' ? '($)' : '(K)'}
            </button>
          ))}
        </div>

        {/* Live FX Rate Glance from Settings */}
        <div className="text-[10px] font-semibold text-[#0891B2] bg-[#76DCFF]/20 px-2.5 py-1 rounded-full flex items-center gap-1">
          <span className="material-symbols-outlined text-xs">trending_up</span>
          <span>1 USD ≈ {usdRate} THB</span>
        </div>
      </div>

      {/* 3. Large Amount Display + THB Base Conversion */}
      <div className="my-3 py-3 bg-white rounded-[22px] border border-[#E7DFD5] shadow-xs text-center relative overflow-hidden">
        <span className="text-[11px] font-semibold text-[#82756A] block mb-1">
          {transactionType === 'expense'
            ? 'သုံးစွဲငွေ ပမာဏ'
            : transactionType === 'income'
            ? 'ရရှိငွေ ပမာဏ'
            : 'လွှဲပြောင်းမည့် ပမာဏ'}
        </span>

        <div className="flex items-baseline justify-center gap-2">
          <span className="text-2xl sm:text-3xl font-bold text-[#D4A373]">
            {currencySymbol}
          </span>
          <span className="text-4xl sm:text-5xl font-extrabold text-[#1E1B17] tracking-tight tabular-nums">
            {amountStr}
          </span>
        </div>

        {/* Base Currency Equivalent Display */}
        <div className="mt-1.5 inline-flex items-center gap-1 px-3 py-0.5 rounded-full bg-[#FAF2EB] text-[#50453B] text-xs font-semibold">
          <span>
            ≈ {amountBaseTHB.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} THB
          </span>
          <span className="material-symbols-outlined text-xs text-[#166534]">check_circle</span>
        </div>
      </div>

      {/* 4. Category Grid (3 Columns) for Expense & Income */}
      {transactionType !== 'transfer' && (
        <div className="bg-white rounded-[22px] p-4 border border-[#E7DFD5] shadow-xs mb-3">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-bold text-[#1E1B17] flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base text-[#7D562D]">category</span>
              <span>အမျိုးအစား ရွေးချယ်ပါ</span>
            </span>
            <span className="text-[10px] text-[#82756A]">
              {categoriesList.length} မျိုး
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            {categoriesList.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`p-3 rounded-[18px] border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer text-center relative ${
                    isSelected
                      ? 'bg-[#FAF2EB] border-[#7D562D] ring-2 ring-[#7D562D]/20 shadow-xs scale-[1.02]'
                      : 'bg-[#FFFDF7] border-[#E7DFD5] hover:bg-[#FAF2EB]'
                  }`}
                >
                  <span className="text-2xl">{cat.icon}</span>
                  <span className="text-[11px] font-bold text-[#1E1B17] leading-tight truncate max-w-full">
                    {cat.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. Wallet Selector, Date & Note Section */}
      <div className="bg-white rounded-[22px] p-4 border border-[#E7DFD5] shadow-xs mb-3 space-y-3">
        {/* Wallet Picker */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div>
            <label className="text-[11px] font-bold text-[#82756A] block mb-1">
              {transactionType === 'transfer' ? 'မှ (From Wallet)' : 'ပိုက်ဆံအိတ် ရွေးပါ'}
            </label>
            <div className="relative">
              <select
                value={selectedWalletId}
                onChange={(e) => setSelectedWalletId(e.target.value)}
                className="w-full bg-[#FAF2EB] border border-[#E7DFD5] rounded-[16px] px-3 py-2.5 text-xs font-bold text-[#1E1B17] outline-none appearance-none cursor-pointer"
              >
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} (฿{(w.currentBalance ?? w.initialBalance ?? 0).toLocaleString()})
                  </option>
                ))}
              </select>
              <span className="material-symbols-outlined text-base text-[#82756A] absolute right-3 top-2.5 pointer-events-none">
                expand_more
              </span>
            </div>
          </div>

          {/* Transfer Destination Wallet */}
          {transactionType === 'transfer' && (
            <div>
              <label className="text-[11px] font-bold text-[#82756A] block mb-1">
                သို့ (To Wallet)
              </label>
              <div className="relative">
                <select
                  value={toWalletId}
                  onChange={(e) => setToWalletId(e.target.value)}
                  className="w-full bg-[#FAF2EB] border border-[#E7DFD5] rounded-[16px] px-3 py-2.5 text-xs font-bold text-[#1E1B17] outline-none appearance-none cursor-pointer"
                >
                  {wallets
                    .filter((w) => w.id !== selectedWalletId)
                    .map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} (฿{(w.currentBalance ?? w.initialBalance ?? 0).toLocaleString()})
                      </option>
                    ))}
                </select>
                <span className="material-symbols-outlined text-base text-[#82756A] absolute right-3 top-2.5 pointer-events-none">
                  expand_more
                </span>
              </div>
            </div>
          )}

          {/* Date Picker */}
          <div>
            <label className="text-[11px] font-bold text-[#82756A] block mb-1">
              ရက်စွဲ (Date)
            </label>
            <div className="flex items-center bg-[#FAF2EB] border border-[#E7DFD5] rounded-[16px] px-3 py-2 text-xs font-bold text-[#1E1B17]">
              <span className="material-symbols-outlined text-base text-[#7D562D] mr-2">
                calendar_today
              </span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="bg-transparent border-0 outline-none text-xs font-bold text-[#1E1B17] w-full cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Note / Merchant Input */}
        <div>
          <label className="text-[11px] font-bold text-[#82756A] block mb-1">
            မှတ်ချက် / ဆိုင်အမည် (Note)
          </label>
          <div className="flex items-center bg-[#FAF2EB] border border-[#E7DFD5] rounded-[16px] px-3 py-2.5 text-xs text-[#1E1B17]">
            <span className="material-symbols-outlined text-base text-[#82756A] mr-2">
              edit_note
            </span>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="ဥပမာ - Roast & Co ကော်ဖီ၊ နေ့လယ်စာ..."
              className="bg-transparent border-0 outline-none text-xs text-[#1E1B17] placeholder:text-[#82756A] w-full"
            />
          </div>
        </div>
      </div>

      {/* 6. Quick Increment Buttons Row (+50, +100, +500, +1,000, ရှင်း) */}
      <div className="flex items-center justify-between gap-1.5 mb-2.5 px-0.5">
        {[50, 100, 500, 1000].map((inc) => (
          <button
            key={inc}
            onClick={() => handleQuickAdd(inc)}
            className="flex-1 py-2 bg-white rounded-[14px] border border-[#E7DFD5] text-xs font-bold text-[#7D562D] shadow-xs active:scale-95 transition-all cursor-pointer tabular-nums text-center"
          >
            +{inc.toLocaleString()}
          </button>
        ))}
        <button
          onClick={handleClear}
          className="px-3 py-2 bg-[#FFDAD6]/50 rounded-[14px] border border-[#DC2626]/20 text-xs font-bold text-[#DC2626] shadow-xs active:scale-95 transition-all cursor-pointer"
        >
          ရှင်း (C)
        </button>
      </div>

      {/* 7. Numpad Keypad (0-9, ., ⌫) */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0'].map((key) => (
          <button
            key={key}
            onClick={() => handleNumClick(key)}
            className="h-12 bg-white rounded-[18px] border border-[#E7DFD5] text-lg font-bold text-[#1E1B17] shadow-xs active:bg-[#FAF2EB] active:scale-95 transition-all cursor-pointer flex items-center justify-center tabular-nums"
          >
            {key}
          </button>
        ))}
        <button
          onClick={handleDelete}
          className="h-12 bg-[#FAF2EB] rounded-[18px] border border-[#E7DFD5] text-base font-bold text-[#1E1B17] shadow-xs active:scale-95 transition-all cursor-pointer flex items-center justify-center"
        >
          <span className="material-symbols-outlined text-xl">backspace</span>
        </button>
      </div>

      {/* 8. Save Button (Disabled if amount is 0) */}
      <button
        onClick={handleSaveTransaction}
        disabled={numAmount <= 0 || isSubmitting}
        className={`w-full h-14 rounded-[20px] font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer active:scale-98 ${
          numAmount <= 0 || isSubmitting
            ? 'bg-[#E7DFD5] text-[#82756A] cursor-not-allowed opacity-70'
            : transactionType === 'expense'
            ? 'bg-[#D4A373] text-[#1E1B17] hover:bg-[#C59260] shadow-md shadow-[#D4A373]/30'
            : transactionType === 'income'
            ? 'bg-[#166534] text-white hover:bg-[#1f6c3a] shadow-md shadow-[#166534]/30'
            : 'bg-[#0891B2] text-white hover:bg-[#006780] shadow-md shadow-[#0891B2]/30'
        }`}
      >
        {isSubmitting ? (
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-xl animate-spin">progress_activity</span>
            <span>သိမ်းဆည်းနေပါသည်...</span>
          </div>
        ) : (
          <>
            <span className="material-symbols-outlined text-xl">check</span>
            <span>
              {transactionType === 'expense'
                ? 'စာရင်းသိမ်းမည် (Save Expense)'
                : transactionType === 'income'
                ? 'ဝင်ငွေသိမ်းမည် (Save Income)'
                : 'လွှဲပြောင်းမှုသိမ်းမည် (Save Transfer)'}
            </span>
          </>
        )}
      </button>
    </div>
  );
};
