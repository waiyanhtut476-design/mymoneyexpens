export type CurrencyCode = 'THB' | 'USD' | 'MMK';

export interface CurrencyFxRates {
  USD: number; // e.g. 35 THB
  MMK: number; // e.g. 0.0165 THB (1 MMK ≈ 0.0165 THB / 1 THB ≈ 60.6 MMK)
}

export interface UserSettings {
  fxRates: CurrencyFxRates;
  monthlyBudget: number;
  baseCurrency: CurrencyCode;
  language: string;
  createdAt?: any;
  updatedAt?: any;
}

export type WalletType = 'cash' | 'bank' | 'card' | 'other';

export interface Wallet {
  id: string;
  name: string;
  type: WalletType;
  currency: CurrencyCode;
  initialBalance: number;
  currentBalance?: number;
  createdAt?: any;
  updatedAt?: any;
}

export type TransactionType = 'expense' | 'income' | 'transfer';

export interface Transaction {
  id?: string;
  amount: number;
  currency: CurrencyCode;
  amountBase: number; // THB value calculated via fxRates
  type: TransactionType;
  categoryId?: string;
  category?: string;
  note?: string;
  walletId: string;
  walletName?: string;
  toWalletId?: string;
  toWalletName?: string;
  date: string; // YYYY-MM-DD
  createdAt?: any;
}

export type TabType = 'overview' | 'history' | 'quick-add' | 'wallets';

export const EXPENSE_CATEGORIES = [
  { id: 'food', name: 'အစားအစာ & ကော်ဖီ', icon: '🍜', code: 'restaurant', color: '#D4A373' },
  { id: 'housing', name: 'နေထိုင်ရေး', icon: '🏠', code: 'apartment', color: '#7D562D' },
  { id: 'work', name: 'အလုပ်နေရာ', icon: '💻', code: 'laptop_mac', color: '#006780' },
  { id: 'travel', name: 'ခရီးသွားလာရေး', icon: '🚌', code: 'directions_bus', color: '#76DCFF' },
  { id: 'shopping', name: 'ဈေးဝယ်', icon: '🛒', code: 'shopping_bag', color: '#CA8A04' },
  { id: 'entertainment', name: 'အပန်းဖြေ', icon: '🎬', code: 'movie', color: '#9333EA' },
  { id: 'other', name: 'အခြား', icon: '📦', code: 'inventory_2', color: '#82756A' },
] as const;

export const INCOME_CATEGORIES = [
  { id: 'salary', name: 'လစာ', icon: '💼', code: 'work', color: '#2E7D4F' },
  { id: 'freelance', name: 'Freelance', icon: '🧑💻', code: 'terminal', color: '#166534' },
  { id: 'other_income', name: 'အခြားဝင်ငွေ', icon: '💰', code: 'paid', color: '#0891B2' },
] as const;

export interface CategoryBudget {
  id?: string;
  categoryId: string;
  monthlyLimit: number;
  updatedAt?: any;
}

