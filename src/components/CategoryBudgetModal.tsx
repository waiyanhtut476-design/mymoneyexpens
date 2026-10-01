import React, { useState, useEffect } from 'react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { EXPENSE_CATEGORIES } from '../types';

interface CategoryBudgetModalProps {
  categoryId: string | null;
  currentLimit: number;
  isOpen: boolean;
  onClose: () => void;
}

export const CategoryBudgetModal: React.FC<CategoryBudgetModalProps> = ({
  categoryId,
  currentLimit,
  isOpen,
  onClose,
}) => {
  const { user } = useAuth();
  const [limitStr, setLimitStr] = useState<string>('5000');
  const [isSaving, setIsSaving] = useState(false);

  const category = EXPENSE_CATEGORIES.find((c) => c.id === categoryId);

  useEffect(() => {
    if (isOpen) {
      setLimitStr(currentLimit > 0 ? String(currentLimit) : '5000');
    }
  }, [isOpen, currentLimit]);

  if (!isOpen || !category) return null;

  const handleSave = async () => {
    if (!user?.uid || !db || isSaving) return;

    try {
      setIsSaving(true);
      const limitNum = parseFloat(limitStr) || 0;
      const budgetDocRef = doc(db, 'users', user.uid, 'budgets', category.id);
      await setDoc(
        budgetDocRef,
        {
          categoryId: category.id,
          monthlyLimit: limitNum,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      onClose();
    } catch (err) {
      console.error('Error saving category budget:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#1E1B17]/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-[340px] rounded-[24px] p-5 border border-[#E7DFD5] shadow-2xl animate-fadeIn">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{category.icon}</span>
            <div>
              <h3 className="text-xs font-bold text-[#1E1B17]">{category.name}</h3>
              <p className="text-[10px] text-[#82756A]">လစဉ် ဘတ်ဂျက် သတ်မှတ်ရန်</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-[#FAF2EB] text-[#82756A] flex items-center justify-center hover:text-[#1E1B17] cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>

        <div className="flex items-center bg-[#FAF2EB] border border-[#E7DFD5] rounded-[16px] px-3 py-2.5 mb-3">
          <span className="text-sm font-bold text-[#7D562D] mr-2">฿ (THB)</span>
          <input
            type="number"
            value={limitStr}
            onChange={(e) => setLimitStr(e.target.value)}
            className="bg-transparent border-0 outline-none text-base font-extrabold text-[#1E1B17] w-full tabular-nums"
            placeholder="0"
          />
        </div>

        {/* Quick Presets */}
        <div className="flex items-center gap-1.5 mb-4 overflow-x-auto no-scrollbar">
          {[2000, 5000, 8000, 12000, 20000].map((val) => (
            <button
              key={val}
              type="button"
              onClick={() => setLimitStr(String(val))}
              className="px-2.5 py-1 rounded-full bg-[#FAF2EB] hover:bg-[#D4A373]/20 text-[11px] font-bold text-[#7D562D] shrink-0 border border-[#E7DFD5] cursor-pointer transition-colors"
            >
              ฿{val.toLocaleString()}
            </button>
          ))}
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
            disabled={isSaving}
            className="flex-1 py-2.5 bg-[#D4A373] text-[#1E1B17] font-bold text-xs rounded-[16px] shadow-sm hover:bg-[#C59260] transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isSaving ? 'သိမ်းနေသည်...' : 'သတ်မှတ်မည်'}
          </button>
        </div>
      </div>
    </div>
  );
};
