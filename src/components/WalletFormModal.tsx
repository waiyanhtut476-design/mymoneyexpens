import React, { useState, useEffect } from 'react';
import { collection, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Wallet, WalletType, CurrencyCode } from '../types';

interface WalletFormModalProps {
  wallet?: Wallet | null;
  isOpen: boolean;
  onClose: () => void;
}

export const WalletFormModal: React.FC<WalletFormModalProps> = ({ wallet, isOpen, onClose }) => {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [type, setType] = useState<WalletType>('bank');
  const [currency, setCurrency] = useState<CurrencyCode>('THB');
  const [initialBalance, setInitialBalance] = useState<string>('0');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (wallet) {
      setName(wallet.name || '');
      setType(wallet.type || 'bank');
      setCurrency(wallet.currency || 'THB');
      setInitialBalance(String(wallet.initialBalance || 0));
    } else {
      setName('');
      setType('bank');
      setCurrency('THB');
      setInitialBalance('0');
    }
  }, [wallet, isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!name.trim() || !user?.uid || !db || isSaving) return;

    try {
      setIsSaving(true);
      const parsedBalance = parseFloat(initialBalance) || 0;

      if (wallet?.id) {
        // Update existing wallet
        const walletRef = doc(db, 'users', user.uid, 'wallets', wallet.id);
        await updateDoc(walletRef, {
          name: name.trim(),
          type,
          currency,
          initialBalance: parsedBalance,
          updatedAt: serverTimestamp(),
        });
      } else {
        // Create new wallet
        const walletsRef = collection(db, 'users', user.uid, 'wallets');
        await addDoc(walletsRef, {
          name: name.trim(),
          type,
          currency,
          initialBalance: parsedBalance,
          currentBalance: parsedBalance,
          createdAt: serverTimestamp(),
        });
      }

      onClose();
    } catch (err) {
      console.error('Error saving wallet:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#1E1B17]/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-[360px] rounded-[24px] p-5 border border-[#E7DFD5] shadow-2xl animate-fadeIn">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#D4A373]/20 text-[#7D562D] flex items-center justify-center">
              <span className="material-symbols-outlined text-xl">
                {wallet ? 'edit' : 'account_balance_wallet'}
              </span>
            </div>
            <h3 className="text-sm font-bold text-[#1E1B17]">
              {wallet ? 'ပိုက်ဆံအိတ် ပြင်ဆင်ရန်' : 'ပိုက်ဆံအိတ် အသစ်ထည့်ရန်'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-[#FAF2EB] text-[#82756A] flex items-center justify-center hover:text-[#1E1B17] cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>

        <div className="space-y-3 mb-4">
          {/* Wallet Name */}
          <div>
            <label className="text-[11px] font-bold text-[#82756A] block mb-1">
              ပိုက်ဆံအိတ် / ဘဏ်အမည်
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ဥပမာ - KBZ Bank, K-Bank, Cash..."
              className="w-full bg-[#FAF2EB] border border-[#E7DFD5] rounded-[14px] px-3 py-2 text-xs font-bold text-[#1E1B17] outline-none placeholder:font-normal placeholder:text-[#82756A]"
            />
          </div>

          {/* Wallet Type */}
          <div>
            <label className="text-[11px] font-bold text-[#82756A] block mb-1">
              အမျိုးအစား
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: 'bank', label: 'ဘဏ်', icon: 'account_balance' },
                { id: 'cash', label: 'ငွေသား', icon: 'payments' },
                { id: 'card', label: 'ကတ်', icon: 'credit_card' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setType(t.id as WalletType)}
                  className={`py-2 px-2 rounded-[12px] border text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                    type === t.id
                      ? 'bg-[#FAF2EB] border-[#7D562D] text-[#7D562D] shadow-xs'
                      : 'bg-white border-[#E7DFD5] text-[#82756A]'
                  }`}
                >
                  <span className="material-symbols-outlined text-base">{t.icon}</span>
                  <span className="text-[10px]">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Currency */}
          <div>
            <label className="text-[11px] font-bold text-[#82756A] block mb-1">
              ငွေကြေးအမျိုးအစား
            </label>
            <div className="flex gap-2">
              {(['THB', 'USD', 'MMK'] as CurrencyCode[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCurrency(c)}
                  className={`flex-1 py-1.5 rounded-[12px] border text-xs font-bold transition-all cursor-pointer ${
                    currency === c
                      ? 'bg-[#7D562D] border-[#7D562D] text-white shadow-xs'
                      : 'bg-[#FAF2EB] border-[#E7DFD5] text-[#82756A]'
                  }`}
                >
                  {c} {c === 'THB' ? '(฿)' : c === 'USD' ? '($)' : '(K)'}
                </button>
              ))}
            </div>
          </div>

          {/* Initial Balance */}
          <div>
            <label className="text-[11px] font-bold text-[#82756A] block mb-1">
              အစလက်ကျန်ငွေ (Initial Balance)
            </label>
            <input
              type="number"
              value={initialBalance}
              onChange={(e) => setInitialBalance(e.target.value)}
              className="w-full bg-[#FAF2EB] border border-[#E7DFD5] rounded-[14px] px-3 py-2 text-xs font-bold text-[#1E1B17] outline-none tabular-nums"
              placeholder="0"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 bg-[#FAF2EB] text-[#82756A] font-bold text-xs rounded-[16px] hover:bg-[#E7DFD5] transition-colors cursor-pointer"
          >
            မလုပ်တော့ပါ
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!name.trim() || isSaving}
            className="flex-1 py-2.5 bg-[#D4A373] text-[#1E1B17] font-bold text-xs rounded-[16px] shadow-sm hover:bg-[#C59260] transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isSaving ? 'သိမ်းနေသည်...' : wallet ? 'ပြင်ဆင်မည်' : 'ထည့်သွင်းမည်'}
          </button>
        </div>
      </div>
    </div>
  );
};
