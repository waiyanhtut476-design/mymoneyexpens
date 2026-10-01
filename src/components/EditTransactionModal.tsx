import React, { useState, useEffect } from 'react';
import { doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import {
  Transaction,
  Wallet,
  UserSettings,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  CurrencyCode,
} from '../types';

interface EditTransactionModalProps {
  transaction: Transaction | null;
  wallets: Wallet[];
  settings: UserSettings | null;
  isOpen: boolean;
  onClose: () => void;
}

export const EditTransactionModal: React.FC<EditTransactionModalProps> = ({
  transaction,
  wallets,
  settings,
  isOpen,
  onClose,
}) => {
  const { user } = useAuth();
  const [amountStr, setAmountStr] = useState('0');
  const [currency, setCurrency] = useState<CurrencyCode>('THB');
  const [categoryId, setCategoryId] = useState('');
  const [walletId, setWalletId] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState('');

  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (transaction) {
      setAmountStr(String(transaction.amount || 0));
      setCurrency(transaction.currency || 'THB');
      setCategoryId(transaction.categoryId || '');
      setWalletId(transaction.walletId || (wallets[0]?.id || ''));
      setNote(transaction.note || '');
      setDate(transaction.date || new Date().toISOString().split('T')[0]);
      setShowDeleteConfirm(false);
    }
  }, [transaction, isOpen, wallets]);

  if (!isOpen || !transaction) return null;

  const usdRate = settings?.fxRates?.USD || 35;
  const mmkRate = settings?.fxRates?.MMK || 0.0165;

  const calculateBaseTHB = (amt: number, curr: CurrencyCode): number => {
    if (curr === 'THB') return amt;
    if (curr === 'USD') return amt * usdRate;
    if (curr === 'MMK') return amt * mmkRate;
    return amt;
  };

  const handleUpdate = async () => {
    if (!user?.uid || !db || !transaction.id || isSaving) return;
    const numAmt = parseFloat(amountStr) || 0;
    if (numAmt <= 0) return;

    try {
      setIsSaving(true);
      const chosenWallet = wallets.find((w) => w.id === walletId);
      const chosenCat =
        EXPENSE_CATEGORIES.find((c) => c.id === categoryId) ||
        INCOME_CATEGORIES.find((c) => c.id === categoryId);

      const baseTHB = calculateBaseTHB(numAmt, currency);

      const txRef = doc(db, 'users', user.uid, 'transactions', transaction.id);
      await updateDoc(txRef, {
        amount: numAmt,
        currency,
        amountBase: Number(baseTHB.toFixed(2)),
        categoryId,
        category: chosenCat?.name || transaction.category || 'စာရင်း',
        walletId,
        walletName: chosenWallet?.name || transaction.walletName || 'ပိုက်ဆံအိတ်',
        note: note.trim(),
        date,
        updatedAt: serverTimestamp(),
      });

      onClose();
    } catch (err) {
      console.error('Error updating transaction:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!user?.uid || !db || !transaction.id || isDeleting) return;
    try {
      setIsDeleting(true);
      const txRef = doc(db, 'users', user.uid, 'transactions', transaction.id);
      await deleteDoc(txRef);
      onClose();
    } catch (err) {
      console.error('Error deleting transaction:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const categories = transaction.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <div className="fixed inset-0 z-50 bg-[#1E1B17]/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-[360px] rounded-[24px] p-5 border border-[#E7DFD5] shadow-2xl animate-fadeIn">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#D4A373]/20 text-[#7D562D] flex items-center justify-center">
              <span className="material-symbols-outlined text-xl">edit_note</span>
            </div>
            <h3 className="text-sm font-bold text-[#1E1B17]">စာရင်း ပြင်ဆင်ရန် / ဖျက်ရန်</h3>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-[#FAF2EB] text-[#82756A] flex items-center justify-center hover:text-[#1E1B17] cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>

        {/* Delete confirmation state */}
        {showDeleteConfirm ? (
          <div className="py-3 text-center animate-fadeIn">
            <div className="w-12 h-12 rounded-full bg-[#FFDAD6] text-[#DC2626] flex items-center justify-center mx-auto mb-2">
              <span className="material-symbols-outlined text-2xl">delete</span>
            </div>
            <h4 className="text-xs font-bold text-[#1E1B17] mb-1">ဤစာရင်းကို အပြီးဖျက်မည်လား?</h4>
            <p className="text-[11px] text-[#82756A] mb-4">ဖျက်ပြီးပါက ပြန်လည်ရယူ၍ မရနိုင်ပါ။</p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2 bg-[#FAF2EB] text-[#82756A] font-bold text-xs rounded-[14px]"
              >
                မဖျက်ပါ
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 py-2 bg-[#DC2626] text-white font-bold text-xs rounded-[14px] shadow-sm hover:bg-[#B91C1C]"
              >
                {isDeleting ? 'ဖျက်နေသည်...' : 'အတည်ပြု ဖျက်မည်'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Amount & Currency */}
            <div>
              <label className="text-[11px] font-bold text-[#82756A] block mb-1">ငွေပမာဏ</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  className="flex-1 bg-[#FAF2EB] border border-[#E7DFD5] rounded-[14px] px-3 py-2 text-sm font-bold text-[#1E1B17] outline-none tabular-nums"
                />
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                  className="bg-[#FAF2EB] border border-[#E7DFD5] rounded-[14px] px-2.5 py-2 text-xs font-bold text-[#1E1B17] outline-none"
                >
                  <option value="THB">THB (฿)</option>
                  <option value="USD">USD ($)</option>
                  <option value="MMK">MMK (K)</option>
                </select>
              </div>
            </div>

            {/* Category */}
            {transaction.type !== 'transfer' && (
              <div>
                <label className="text-[11px] font-bold text-[#82756A] block mb-1">အမျိုးအစား</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full bg-[#FAF2EB] border border-[#E7DFD5] rounded-[14px] px-3 py-2 text-xs font-bold text-[#1E1B17] outline-none"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.icon} {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Wallet */}
            <div>
              <label className="text-[11px] font-bold text-[#82756A] block mb-1">ပိုက်ဆံအိတ်</label>
              <select
                value={walletId}
                onChange={(e) => setWalletId(e.target.value)}
                className="w-full bg-[#FAF2EB] border border-[#E7DFD5] rounded-[14px] px-3 py-2 text-xs font-bold text-[#1E1B17] outline-none"
              >
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.currency})
                  </option>
                ))}
              </select>
            </div>

            {/* Date & Note */}
            <div>
              <label className="text-[11px] font-bold text-[#82756A] block mb-1">ရက်စွဲ</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-[#FAF2EB] border border-[#E7DFD5] rounded-[14px] px-3 py-2 text-xs font-bold text-[#1E1B17] outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-[#82756A] block mb-1">မှတ်ချက်</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="မှတ်ချက်..."
                className="w-full bg-[#FAF2EB] border border-[#E7DFD5] rounded-[14px] px-3 py-2 text-xs text-[#1E1B17] outline-none"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="px-3 py-2.5 bg-[#FFDAD6]/60 text-[#DC2626] font-bold text-xs rounded-[16px] hover:bg-[#FFDAD6] cursor-pointer"
              >
                ဖျက်မည်
              </button>
              <button
                type="button"
                onClick={handleUpdate}
                disabled={isSaving}
                className="flex-1 py-2.5 bg-[#D4A373] text-[#1E1B17] font-bold text-xs rounded-[16px] shadow-sm hover:bg-[#C59260] cursor-pointer"
              >
                {isSaving ? 'သိမ်းနေသည်...' : 'ပြင်ဆင်မှု သိမ်းမည်'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
