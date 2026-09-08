'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, Shield, User, Globe, Bell, Key, ChevronDown, Menu, LogOut } from 'lucide-react';
import AccountSwitcherModal from './AccountSwitcherModal';
import { useMobileNav } from '@/context/MobileNavContext';

export default function Navbar() {
  const router = useRouter();
  const { toggleMobileNav } = useMobileNav();
  const [currentUser, setCurrentUser] = useState<{
    name: string;
    email: string;
    role: string;
  } | null>(null);
  const [account, setAccount] = useState<{
    name: string;
    picture: string | null;
    daysRemaining: number;
    connected: boolean;
  }>({
    name: 'Rady Mohamed',
    picture: null,
    daysRemaining: 60,
    connected: true,
  });
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetchAccountData();
    fetchCurrentUserData();
  }, []);

  const fetchCurrentUserData = async () => {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      if (data.authenticated && data.user) {
        setCurrentUser(data.user);
      }
    } catch (e) {
      console.warn('Navbar fetch current user error:', e);
    }
  };

  const handleSystemLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/login';
    } catch (e) {
      window.location.href = '/login';
    }
  };

  const fetchAccountData = async () => {
    try {
      const res = await fetch('/api/auth/meta/account');
      const data = await res.json();
      if (data.success && data.user) {
        setAccount({
          name: data.user.name,
          picture: data.user.picture,
          daysRemaining: data.tokenInfo?.daysRemaining ?? 60,
          connected: true,
        });
      }
    } catch (e) {
      console.warn('Navbar fetch account error:', e);
    }
  };

  const handleAccountChanged = (newAccount: any) => {
    if (newAccount?.user) {
      setAccount({
        name: newAccount.user.name,
        picture: newAccount.user.picture,
        daysRemaining: newAccount.tokenInfo?.daysRemaining ?? 60,
        connected: true,
      });
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    }
  };

  return (
    <>
      <header className="h-16 bg-[#0d1322]/80 backdrop-blur-md border-b border-slate-800/80 px-3 sm:px-6 flex items-center justify-between sticky top-0 z-30 w-full">
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Hamburger Menu Button for Mobile */}
          <button
            onClick={toggleMobileNav}
            aria-label="فتح القائمة الجانبية"
            className="lg:hidden p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition-all cursor-pointer shrink-0"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* API Readiness Badge */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-950/60 border border-emerald-800/60 text-emerald-400 text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>الذكاء الاصطناعي متصل</span>
          </div>

          {/* Interactive Dynamic User profile & Account Switcher Trigger */}
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-800/70 hover:bg-slate-700/80 border border-slate-700/80 hover:border-indigo-500/50 text-slate-200 text-sm transition-all group shadow-sm shrink-0"
            title="انقر لتغيير أو ربط حساب فيسبوك جديد وفحص الصلاحيات"
          >
            {account.picture ? (
              <img
                src={account.picture}
                alt={account.name}
                className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg object-cover border border-indigo-500/50 group-hover:scale-105 transition-transform"
              />
            ) : (
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-xs text-white">
                {account.name ? account.name.charAt(0) : 'U'}
              </div>
            )}

            <div className="flex flex-col items-start text-right">
              <span className="font-semibold text-xs group-hover:text-indigo-300 transition-colors leading-tight max-w-[90px] sm:max-w-none truncate">
                {account.name}
              </span>
              <span className="text-[9px] sm:text-[10px] text-emerald-400 font-medium leading-none mt-0.5 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                متبقي {account.daysRemaining} يوم
              </span>
            </div>

            <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-white transition-colors mr-0.5 hidden sm:inline" />
          </button>
        </div>
      </header>

      {/* Account Switcher Modal */}
      <AccountSwitcherModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAccountChanged={handleAccountChanged}
      />
    </>
  );
}
