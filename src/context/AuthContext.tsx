import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  AuthError,
} from 'firebase/auth';
import { auth, googleProvider, isFirebaseConfigured } from '../firebase';
import { seedUserDataIfNeeded } from '../services/seedService';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  isInAppBrowser: boolean;
  isConfigured: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isInAppBrowser, setIsInAppBrowser] = useState<boolean>(false);

  // Detect in-app browsers
  useEffect(() => {
    if (typeof window !== 'undefined' && navigator.userAgent) {
      const ua = navigator.userAgent || navigator.vendor || (window as any).opera;
      const inAppPattern = /(FBAN|FBAV|Instagram|Line|Twitter|MicroMessenger|musical_ly|BytedanceWebview)/i;
      if (inAppPattern.test(ua)) {
        setIsInAppBrowser(true);
      }
    }
  }, []);

  // Listen to redirect auth result and onAuthStateChanged
  useEffect(() => {
    let unsubscribe: () => void = () => {};

    const handleAuthInit = async () => {
      if (!auth) {
        setLoading(false);
        return;
      }

      try {
        const redirectRes = await getRedirectResult(auth).catch((err: AuthError) => {
          handleAuthError(err);
          return null;
        });

        if (redirectRes?.user) {
          await seedUserDataIfNeeded(redirectRes.user.uid);
        }
      } catch (err: any) {
        handleAuthError(err);
      }

      try {
        unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
          setUser(currentUser);
          if (currentUser) {
            try {
              await seedUserDataIfNeeded(currentUser.uid);
            } catch (seedErr) {
              console.error('Seeding error:', seedErr);
            }
          }
          setLoading(false);
        });
      } catch (err) {
        console.warn('onAuthStateChanged error:', err);
        setLoading(false);
      }
    };

    handleAuthInit();

    return () => {
      unsubscribe();
    };
  }, []);

  const handleAuthError = (err: any) => {
    if (!err) return;
    const errorCode = err.code || '';

    if (
      errorCode === 'auth/popup-closed-by-user' ||
      errorCode === 'auth/cancelled-popup-request'
    ) {
      setError(null);
      return;
    }

    if (errorCode === 'auth/unauthorized-domain') {
      setError('Firebase တွင် ဤ domain ကို ခွင့်ပြုရန် လိုအပ်ပါသည် (Authorized Domain)');
      return;
    }

    if (errorCode === 'auth/popup-blocked') {
      signInWithRedirect(auth, googleProvider).catch(() => {
        setError('ဝင်ရောက်မှု မအောင်မြင်ပါ၊ Browser တွင် Popup ခွင့်ပြုပြီး ထပ်ကြိုးစားပါ');
      });
      return;
    }

    setError('ဝင်ရောက်မှု မအောင်မြင်ပါ၊ ထပ်ကြိုးစားပါ');
    console.error('Firebase Auth Error:', err);
  };

  const loginWithGoogle = async () => {
    setError(null);
    setLoading(true);

    if (isInAppBrowser) {
      setError('Google Login အတွက် Chrome (သို့) Safari ဖြင့် ဖွင့်ပါ');
      setLoading(false);
      return;
    }

    if (!isFirebaseConfigured || !auth) {
      setError('Firebase Setup ပြုလုပ်ရန် လိုအပ်ပါသည်');
      setLoading(false);
      return;
    }

    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user) {
        await seedUserDataIfNeeded(result.user.uid);
      }
    } catch (err: any) {
      if (err.code === 'auth/popup-blocked') {
        try {
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch (redirectErr) {
          handleAuthError(redirectErr);
        }
      } else {
        handleAuthError(err);
      }
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      setLoading(true);
      if (auth) {
        await signOut(auth);
      }
      setUser(null);
      setError(null);
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setLoading(false);
    }
  };

  const clearError = () => {
    setError(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        isInAppBrowser,
        isConfigured: isFirebaseConfigured,
        loginWithGoogle,
        logout,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
