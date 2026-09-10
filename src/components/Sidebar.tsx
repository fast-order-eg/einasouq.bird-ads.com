'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Compass,
  FileText,
  Layers,
  Activity,
  Sparkles,
  Search,
  History,
  Star,
  ChevronDown,
  ChevronLeft,
  Bot,
  Facebook,
  Library,
  CreditCard,
  ShieldAlert,
  X,
  LogOut,
} from 'lucide-react';
import { useMobileNav } from '@/context/MobileNavContext';

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { isOpen, closeMobileNav } = useMobileNav();

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch (e) {
      console.error('Logout error:', e);
      window.location.href = '/login';
    }
  };

  const renderNavItems = () => (
    <>
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src="/brand-logo.png"
            alt="عين السوق"
            className="w-10 h-10 rounded-2xl object-cover shadow-lg shadow-indigo-500/30 shrink-0 border border-indigo-500/40"
          />
          <div>
            <h1 className="font-black text-lg text-white leading-tight">عين السوق</h1>
            <p className="text-[11px] text-indigo-400 font-medium">رادار وتحليل إعلانات المنافسين</p>
          </div>
        </div>

        {/* Mobile Close Button */}
        <button
          onClick={closeMobileNav}
          className="lg:hidden w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer transition-all"
          aria-label="إغلاق القائمة"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-4 space-y-3 overflow-y-auto">
        {/* Dashboard Link */}
        <Link
          href="/"
          onClick={closeMobileNav}
          className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
            pathname === '/'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 font-bold'
              : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <LayoutDashboard className={`w-4 h-4 ${pathname === '/' ? 'text-white' : 'text-slate-400'}`} />
          <span>الرئيسية والمؤشرات</span>
        </Link>

        {/* Section 1: رادار إعلانات المنافسين */}
        <div className="pt-2">
          <div className="px-3 py-1.5 text-[11px] font-bold text-indigo-400 uppercase tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-indigo-400" />
              رادار إعلانات المنافسين
            </span>
          </div>

          <div className="mt-1 space-y-1 pr-1">
            {/* 1. بحث */}
            <Link
              href="/discovery"
              onClick={closeMobileNav}
              className={`flex items-center gap-3 px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${
                pathname === '/discovery'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-bold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Search className={`w-4 h-4 ${pathname === '/discovery' ? 'text-white' : 'text-indigo-400'}`} />
              <span>بحث الإعلانات</span>
            </Link>

            {/* 2. السجلات */}
            <Link
              href="/history"
              onClick={closeMobileNav}
              className={`flex items-center gap-3 px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${
                pathname === '/history'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-bold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <History className={`w-4 h-4 ${pathname === '/history' ? 'text-white' : 'text-purple-400'}`} />
              <span>سجلات البحث</span>
            </Link>

            {/* 3. المفضلة */}
            <Link
              href="/favorites"
              onClick={closeMobileNav}
              className={`flex items-center gap-3 px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${
                pathname === '/favorites'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-bold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Star className={`w-4 h-4 ${pathname === '/favorites' ? 'text-yellow-300 fill-yellow-300' : 'text-amber-400'}`} />
              <span>المفضلة</span>
            </Link>
          </div>
        </div>

        {/* Section 2: ملفاتك الشخصية وصفحاتك */}
        <div className="pt-2">
          <div className="px-3 py-1.5 text-[11px] font-bold text-indigo-400 uppercase tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Facebook className="w-3.5 h-3.5 text-blue-400" />
              ملفاتك الشخصية وصفحاتك
            </span>
          </div>

          <div className="mt-1 space-y-1 pr-1">
            {/* 1. الصفحات والملفات */}
            <Link
              href="/pages"
              onClick={closeMobileNav}
              className={`flex items-center gap-3 px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${
                pathname === '/pages'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-bold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Layers className={`w-4 h-4 ${pathname === '/pages' ? 'text-white' : 'text-blue-400'}`} />
              <span>ملفاتك الشخصية وصفحاتك</span>
            </Link>

            {/* 2. سجل التحليلات السابقة */}
            <Link
              href="/pages/history"
              onClick={closeMobileNav}
              className={`flex items-center gap-3 px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${
                pathname === '/pages/history'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-bold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <History className={`w-4 h-4 ${pathname === '/pages/history' ? 'text-white' : 'text-emerald-400'}`} />
              <span>سجل التحليلات السابقة</span>
            </Link>
          </div>
        </div>

        {/* Section 3: إدارة الحسابات وجودتها */}
        <div className="pt-2">
          <div className="px-3 py-1.5 text-[11px] font-bold text-indigo-400 uppercase tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-indigo-400" />
              إدارة الحسابات وجودتها
            </span>
          </div>

          <div className="mt-1 space-y-1 pr-1">
            {/* 1. الحسابات الإعلانية */}
            <Link
              href="/ad-accounts"
              onClick={closeMobileNav}
              className={`flex items-center gap-3 px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${
                pathname === '/ad-accounts'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-bold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <CreditCard className={`w-4 h-4 ${pathname === '/ad-accounts' ? 'text-white' : 'text-indigo-400'}`} />
              <span>الحسابات الإعلانية</span>
            </Link>

            {/* 2. جودة الحساب */}
            <Link
              href="/ad-accounts/quality"
              onClick={closeMobileNav}
              className={`flex items-center gap-3 px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${
                pathname === '/ad-accounts/quality'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-bold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <ShieldAlert className={`w-4 h-4 ${pathname === '/ad-accounts/quality' ? 'text-white' : 'text-rose-400'}`} />
              <span>جودة الحساب</span>
            </Link>
          </div>
        </div>
      </nav>

      {/* System Engine Status */}
      <div className="p-4 m-3 rounded-2xl bg-slate-900/90 border border-slate-800/80 space-y-3 shadow-md">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
            <Bot className="w-3.5 h-3.5 text-violet-400" />
            محرك الذكاء
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold">
            Gemini 2.5 Pro
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
            <Facebook className="w-3.5 h-3.5 text-blue-400" />
            اتصال Meta
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-bold">
            177 صفحة وحساب
          </span>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="w-64 bg-[#0d1322] border-l border-slate-800/80 hidden lg:flex flex-col shrink-0 min-h-screen sticky top-0 h-screen">
        {renderNavItems()}
      </aside>

      {/* Mobile Slide-Over Drawer with Backdrop */}
      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
            onClick={closeMobileNav}
          />
          {/* Drawer Panel */}
          <aside className="fixed inset-y-0 right-0 w-72 max-w-[85vw] bg-[#0d1322] border-l border-slate-800/80 flex flex-col shadow-2xl z-50">
            {renderNavItems()}
          </aside>
        </div>
      )}
    </>
  );
}
