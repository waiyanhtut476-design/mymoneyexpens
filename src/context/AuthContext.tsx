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
  loginWithEmail: (email: string, displayName?: string) => Promise<void>;
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

  // Check for persistent local Gmail session
  useEffect(() => {
    const savedEmail = localStorage.getItem('mymoney_user_email');
    const savedUid = localStorage.getItem('mymoney_user_uid');
    const savedName = localStorage.getItem('mymoney_user_name');

    if (savedEmail && savedUid && !user) {
      const mockUser = {
        uid: savedUid,
        email: savedEmail,
        displayName: savedName || savedEmail.split('@')[0],
      } as unknown as User;
      setUser(mockUser);
      seedUserDataIfNeeded(savedUid).catch(console.warn);
      setLoading(false);
      return;
    }

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
          localStorage.setItem('mymoney_user_email', redirectRes.user.email || '');
          localStorage.setItem('mymoney_user_uid', redirectRes.user.uid);
          localStorage.setItem('mymoney_user_name', redirectRes.user.displayName || '');
        }
      } catch (err: any) {
        handleAuthError(err);
      }

      try {
        unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
          if (currentUser) {
            setUser(currentUser);
            localStorage.setItem('mymoney_user_email', currentUser.email || '');
            localStorage.setItem('mymoney_user_uid', currentUser.uid);
            localStorage.setItem('mymoney_user_name', currentUser.displayName || '');
            try {
              await seedUserDataIfNeeded(currentUser.uid);
            } catch (seedErr) {
              console.error('Seeding error:', seedErr);
            }
          } else if (!savedUid) {
            setUser(null);
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
      setError('domain_unauthorized');
      return;
    }

    if (errorCode === 'auth/popup-blocked') {
      signInWithRedirect(auth, googleProvider).catch(() => {
        setError('popup_blocked');
      });
      return;
    }

    setError('ဝင်ရောက်မှု မအောင်မြင်ပါ၊ Gmail ရိုက်ထည့်ပြီး ဝင်ပါ');
    console.error('Firebase Auth Error:', err);
  };

  // Direct Gmail Login helper (Works seamlessly across ANY domain or Vercel)
  const loginWithEmail = async (email: string, displayName?: string) => {
    if (!email.trim() || !email.includes('@')) {
      setError('မှန်ကန်သော Gmail လိပ်စာ ရိုက်ထည့်ပါ');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const cleanEmail = email.trim().toLowerCase();
      // Generate clean deterministic UID for this user
      const userUid = 'usr_' + btoa(unescape(encodeURIComponent(cleanEmail))).replace(/[^a-zA-Z0-9]/g, '');
      const name = displayName || cleanEmail.split('@')[0];

      const customUser = {
        uid: userUid,
        email: cleanEmail,
        displayName: name,
      } as unknown as User;

      localStorage.setItem('mymoney_user_email', cleanEmail);
      localStorage.setItem('mymoney_user_uid', userUid);
      localStorage.setItem('mymoney_user_name', name);

      setUser(customUser);
      await seedUserDataIfNeeded(userUid);
    } catch (err) {
      console.error('Email login error:', err);
      setError('ဝင်ရောက်မှု မအောင်မြင်ပါ');
    } finally {
      setLoading(false);
    }
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
        localStorage.setItem('mymoney_user_email', result.user.email || '');
        localStorage.setItem('mymoney_user_uid', result.user.uid);
        localStorage.setItem('mymoney_user_name', result.user.displayName || '');
        await seedUserDataIfNeeded(result.user.uid);
      }
    } catch (err: any) {
      if (err.code === 'auth/unauthorized-domain' || err.code === 'auth/popup-blocked') {
        handleAuthError(err);
      } else {
        try {
          await signInWithRedirect(auth, googleProvider);
        } catch (redirectErr) {
          handleAuthError(redirectErr);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      setLoading(true);
      localStorage.removeItem('mymoney_user_email');
      localStorage.removeItem('mymoney_user_uid');
      localStorage.removeItem('mymoney_user_name');
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
        loginWithEmail,
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
