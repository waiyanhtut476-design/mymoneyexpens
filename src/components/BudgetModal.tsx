import React, { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';

interface BudgetModalProps {
  currentBudget: number;
  isOpen: boolean;
  onClose: () => void;
}

export const BudgetModal: React.FC<BudgetModalProps> = ({ currentBudget, isOpen, onClose }) => {
  const { user } = useAuth();
  const [budgetStr, setBudgetStr] = useState<string>(String(currentBudget || 15000));
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!user?.uid || !db) return;
    const num = parseFloat(budgetStr) || 0;
    try {
      setIsSaving(true);
      const settingsRef = doc(db, 'users', user.uid, 'settings', 'main');
      await updateDoc(settingsRef, {
        monthlyBudget: num,
      });
      onClose();
    } catch (err) {
      console.error('Error updating budget:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#1E1B17]/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-[340px] rounded-[24px] p-5 border border-[#E7DFD5] shadow-2xl animate-fadeIn">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#D4A373]/20 text-[#7D562D] flex items-center justify-center">
              <span className="material-symbols-outlined text-xl">savings</span>
            </div>
            <h3 className="text-sm font-bold text-[#1E1B17]">လစဉ် ဘတ်ဂျက်သတ်မှတ်ရန်</h3>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-[#FAF2EB] text-[#82756A] flex items-center justify-center hover:text-[#1E1B17] cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>

        <p className="text-xs text-[#82756A] mb-3">
          နေ့စဉ် Safe-to-Spend တွက်ချက်ရန် တစ်လစာ သုံးစွဲမည့် ပမာဏကို ထည့်ပါ
        </p>

        <div className="flex items-center bg-[#FAF2EB] border border-[#E7DFD5] rounded-[16px] px-3 py-2.5 mb-4">
          <span className="text-base font-bold text-[#7D562D] mr-2">฿ (THB)</span>
          <input
            type="number"
            value={budgetStr}
            onChange={(e) => setBudgetStr(e.target.value)}
            className="bg-transparent border-0 outline-none text-base font-extrabold text-[#1E1B17] w-full tabular-nums"
            placeholder="ဥပမာ - 15000"
          />
        </div>

        {/* Preset quick budget chips */}
        <div className="flex items-center gap-1.5 mb-4 overflow-x-auto no-scrollbar">
          {[10000, 15000, 20000, 30000, 45000].map((b) => (
            <button
              key={b}
              onClick={() => setBudgetStr(String(b))}
              className="px-2.5 py-1 rounded-full bg-[#FAF2EB] hover:bg-[#D4A373]/20 text-[11px] font-bold text-[#7D562D] shrink-0 border border-[#E7DFD5] cursor-pointer transition-colors"
            >
              ฿{b.toLocaleString()}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-[#FAF2EB] text-[#82756A] font-bold text-xs rounded-[16px] hover:bg-[#E7DFD5] transition-colors cursor-pointer"
          >
            မလုပ်တော့ပါ
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 py-2.5 bg-[#D4A373] text-[#1E1B17] font-bold text-xs rounded-[16px] shadow-sm hover:bg-[#C59260] transition-colors cursor-pointer"
          >
            {isSaving ? 'သိမ်းနေသည်...' : 'အတည်ပြုမည်'}
          </button>
        </div>
      </div>
    </div>
  );
};
