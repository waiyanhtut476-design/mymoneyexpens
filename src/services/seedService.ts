import { doc, getDoc, setDoc, collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { UserSettings } from '../types';

/**
 * Checks if the user profile/settings already exist in Firestore (users/{uid}/settings/main).
 * If not, seeds default settings and initial 2 wallets (လက်ထဲငွေသား, ဘဏ်စာရင်း).
 */
export async function seedUserDataIfNeeded(uid: string): Promise<boolean> {
  if (!uid || !db) return false;

  try {
    const settingsDocRef = doc(db, 'users', uid, 'settings', 'main');
    const settingsSnap = await getDoc(settingsDocRef);

    if (!settingsSnap.exists()) {
      // 1. Create main settings
      const defaultSettings: UserSettings = {
        fxRates: {
          USD: 35,
          MMK: 0.0165,
        },
        monthlyBudget: 0,
        baseCurrency: 'THB',
        language: 'my',
        createdAt: serverTimestamp(),
      };

      await setDoc(settingsDocRef, defaultSettings);

      // 2. Check and seed initial 2 wallets
      const walletsRef = collection(db, 'users', uid, 'wallets');
      const walletsSnap = await getDocs(walletsRef);

      if (walletsSnap.empty) {
        // Wallet 1: လက်ထဲငွေသား (Cash)
        await addDoc(walletsRef, {
          name: 'လက်ထဲငွေသား',
          type: 'cash',
          currency: 'THB',
          initialBalance: 0,
          currentBalance: 0,
          createdAt: serverTimestamp(),
        });

        // Wallet 2: ဘဏ်စာရင်း (Bank)
        await addDoc(walletsRef, {
          name: 'ဘဏ်စာရင်း',
          type: 'bank',
          currency: 'THB',
          initialBalance: 0,
          currentBalance: 0,
          createdAt: serverTimestamp(),
        });
      }

      return true; // Seeded newly
    }

    return false; // Already existed
  } catch (error) {
    console.error('Error in seedUserDataIfNeeded:', error);
    return false;
  }
}
