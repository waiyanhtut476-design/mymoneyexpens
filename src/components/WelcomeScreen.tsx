import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export const WelcomeScreen: React.FC = () => {
  const {
    loginWithGoogle,
    loginAsGuest,
    loading,
    error,
    isUnauthorizedDomain,
    currentHost,
    isInAppBrowser,
  } = useAuth();

  const [copied, setCopied] = useState(false);

  const handleCopyDomain = () => {
    if (currentHost) {
      navigator.clipboard.writeText(currentHost);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF6EE] text-[#3A2A1A] flex flex-col justify-between px-6 py-8 max-w-[420px] mx-auto select-none">
      {/* Top Brand Pill & Live Currency Indicator */}
      <div className="flex flex-col items-center gap-3">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#FFFDF7] border border-[#E7DFD5] shadow-xs">
          <span className="w-2 h-2 rounded-full bg-[#0891B2] animate-pulse"></span>
          <span className="text-xs font-semibold text-[#50453B] tracking-wide">
            THB ฿ • USD $ • MMK K
          </span>
        </div>
      </div>

      {/* Hero Content Section */}
      <div className="flex flex-col items-center text-center my-auto py-4">
        {/* Logo Visual Avatar Container */}
        <div className="relative mb-5">
          <div className="w-22 h-22 rounded-[24px] bg-[#D4A373] flex items-center justify-center text-white shadow-lg shadow-[#D4A373]/30 transform -rotate-3 hover:rotate-0 transition-transform">
            <span className="material-symbols-outlined text-4xl">account_balance_wallet</span>
          </div>
          <div className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-[#166534] text-white flex items-center justify-center shadow-md border-2 border-[#FAF6EE]">
            <span className="material-symbols-outlined text-lg">payments</span>
          </div>
        </div>

        {/* App Title & Tagline */}
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#1E1B17] mb-2 font-['Plus_Jakarta_Sans']">
          MyMoney
        </h1>
        <p className="text-sm font-medium text-[#50453B] leading-relaxed max-w-[290px] mb-5">
          သင်၏ နေ့စဉ် ငွေကြေးဝင်ထွက်နှင့် ဘတ်ဂျက်ကို စနစ်တကျ မှတ်သားပါ
        </p>

        {/* Feature Highlights Minimalist Pills */}
        <div className="grid grid-cols-2 gap-2.5 w-full max-w-[320px] mb-5">
          <div className="flex items-center gap-2 p-2.5 rounded-[16px] bg-[#FFFDF7] border border-[#E7DFD5]">
            <span className="material-symbols-outlined text-lg text-[#7D562D]">currency_exchange</span>
            <span className="text-[11px] font-semibold text-[#3A2A1A]">ငွေကြေး ၃ မျိုး (THB, USD, MMK)</span>
          </div>
          <div className="flex items-center gap-2 p-2.5 rounded-[16px] bg-[#FFFDF7] border border-[#E7DFD5]">
            <span className="material-symbols-outlined text-lg text-[#166534]">pie_chart</span>
            <span className="text-[11px] font-semibold text-[#3A2A1A]">လစဉ် ဘတ်ဂျက် စီမံမှု</span>
          </div>
        </div>

        {/* In-app Browser Warning Alert */}
        {isInAppBrowser && (
          <div className="w-full bg-[#FFDAD6] border border-[#DC2626]/20 text-[#93000A] p-3 rounded-[18px] mb-3 text-xs text-left flex items-start gap-2.5">
            <span className="material-symbols-outlined text-base shrink-0 mt-0.5">warning</span>
            <div>
              <p className="font-bold">In-App Browser သတိပေးချက်</p>
              <p className="mt-0.5">Google Login အတွက် Chrome (သို့) Safari ဖြင့် ဖွင့်ပါ</p>
            </div>
          </div>
        )}

        {/* Unauthorized Domain Explanation Box */}
        {isUnauthorizedDomain && (
          <div className="w-full bg-[#FFDAD6]/60 border border-[#DC2626]/30 text-[#93000A] p-3.5 rounded-[20px] mb-3 text-xs text-left space-y-2 animate-fadeIn">
            <div className="flex items-center gap-1.5 font-bold">
              <span className="material-symbols-outlined text-base text-[#DC2626]">info</span>
              <span>Firebase Domain ခွင့်ပြုချက် လိုအပ်သည်</span>
            </div>
            <p className="text-[11px] text-[#50453B] leading-relaxed">
              Google Login အသုံးပြုရန် Firebase Console &gt; Authentication &gt; Settings &gt; Authorized domains တွင် အောက်ပါ domain ကို ထည့်သွင်းပေးရပါမည်:
            </p>
            <div className="flex items-center justify-between bg-white border border-[#E7DFD5] rounded-xl px-2.5 py-1.5">
              <span className="font-mono text-[10px] text-[#1E1B17] truncate">{currentHost}</span>
              <button
                onClick={handleCopyDomain}
                className="text-[10px] font-bold text-[#0891B2] hover:underline cursor-pointer ml-2 shrink-0"
              >
                {copied ? 'ကူးပြီး ✓' : 'Copy'}
              </button>
            </div>
          </div>
        )}

        {/* General Error Alert Display */}
        {error && !isUnauthorizedDomain && (
          <div className="w-full bg-[#FFDAD6] border border-[#DC2626]/30 text-[#93000A] p-3 rounded-[18px] mb-3 text-xs text-left flex items-start gap-2 animate-fadeIn">
            <span className="material-symbols-outlined text-base shrink-0 mt-0.5">error</span>
            <p className="font-semibold leading-snug">{error}</p>
          </div>
        )}
      </div>

      {/* Bottom Action Buttons */}
      <div className="flex flex-col gap-2.5 w-full max-w-[360px] mx-auto pb-2">
        {/* Google Sign In Button */}
        <button
          onClick={loginWithGoogle}
          disabled={loading}
          className="w-full h-13 bg-white text-[#1E1B17] font-semibold text-sm rounded-[18px] border border-[#E7DFD5] shadow-xs hover:shadow-md hover:bg-[#FFFDF7] active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 px-4 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
        >
          {loading ? (
            <div className="flex items-center gap-2 text-[#7D562D]">
              <span className="material-symbols-outlined text-xl animate-spin">progress_activity</span>
              <span className="text-xs">ချိတ်ဆက်နေသည်...</span>
            </div>
          ) : (
            <>
              {/* Google G Icon */}
              <svg className="w-4.5 h-4.5 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span className="font-bold">Google ဖြင့် ဝင်မည်</span>
            </>
          )}
        </button>

        {/* Instant Access / Demo Mode Button */}
        <button
          onClick={loginAsGuest}
          disabled={loading}
          className="w-full h-12 bg-[#FAF2EB] hover:bg-[#E7DFD5] text-[#7D562D] font-bold text-xs rounded-[18px] border border-[#E7DFD5] active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <span className="material-symbols-outlined text-base">bolt</span>
          <span>အစမ်းအသုံးပြုမည် (Instant Access)</span>
        </button>

        <p className="text-center text-[10px] text-[#82756A] pt-0.5">
          လုံခြုံစိတ်ချရသော Firebase Authentication & Cloud Firestore
        </p>
      </div>
    </div>
  );
};
