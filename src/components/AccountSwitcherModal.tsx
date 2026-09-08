'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  ShieldCheck,
  Key,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  HelpCircle,
  Sparkles,
  Layers,
  ArrowRight,
  Info,
  Users,
  Check,
  LogOut,
} from 'lucide-react';

interface SavedAccountItem {
  id: string;
  name: string;
  picture: string | null;
  daysRemaining: number;
  isActive: boolean;
  lastActiveAt: string;
}

interface AccountData {
  user: {
    id: string;
    name: string;
    picture: string | null;
  };
  tokenInfo: {
    isValid: boolean;
    type: string;
    application: string;
    appId: string;
    scopes: string[];
    expiresAt: string | null;
    dataAccessExpiresAt: string | null;
    daysRemaining: number;
    isLongLived: boolean;
  };
  savedAccounts?: SavedAccountItem[];
  managedPagesCount: number;
}

interface AccountSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccountChanged?: (account: any) => void;
}

export default function AccountSwitcherModal({
  isOpen,
  onClose,
  onAccountChanged,
}: AccountSwitcherModalProps) {
  const [accountData, setAccountData] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(false);
  const [newToken, setNewToken] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showGuide, setShowGuide] = useState(false);

  const handleSystemLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/login';
    } catch (e) {
      window.location.href = '/login';
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchAccount();
      setMessage(null);
      setNewToken('');
    }
  }, [isOpen]);

  const fetchAccount = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/meta/account');
      const data = await res.json();
      if (data.success) {
        setAccountData(data);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchToSaved = async (userId: string) => {
    setSwitchingId(userId);
    setMessage(null);

    try {
      const res = await fetch('/api/auth/meta/account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ switchUserId: userId }),
      });
      const data = await res.json();

      if (data.success) {
        setMessage({
          type: 'success',
          text: data.message || 'تم التبديل بنجاح!',
        });
        await fetchAccount();
        if (onAccountChanged) {
          onAccountChanged(data);
        }
      } else {
        setMessage({
          type: 'error',
          text: data.error || 'فشل التبديل للحساب',
        });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: 'حدث خطأ في الاتصال: ' + err.message });
    } finally {
      setSwitchingId(null);
    }
  };

  const handleAddNewAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newToken.trim()) return;

    setSubmitting(true);
    setMessage(null);

    try {
      const res = await fetch('/api/auth/meta/account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: newToken.trim(), autoExchange: true }),
      });
      const data = await res.json();

      if (data.success) {
        setMessage({
          type: 'success',
          text: data.message || 'تم ربط الحساب وتمديده لـ 60 يوم بنجاح!',
        });
        setNewToken('');
        await fetchAccount();
        if (onAccountChanged) {
          onAccountChanged(data);
        }
      } else {
        setMessage({
          type: 'error',
          text: data.error || 'فشل ربط الحساب، تأكد من صحة التوكن والصلاحيات',
        });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: 'حدث خطأ في الاتصال: ' + err.message });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-3xl max-h-[92vh] rounded-3xl shadow-2xl overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-slate-900 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">إدارة وتبديل حسابات فيسبوك (Facebook Multi-Account)</h2>
              <p className="text-xs text-slate-400">التبديل بين حسابات فيسبوك المحفوظة بضغطة زر وتمديد الصلاحية لـ 60/90 يوماً</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-6">
          {message && (
            <div
              className={`p-3.5 rounded-xl text-xs flex items-center gap-2 ${
                message.type === 'success'
                  ? 'bg-emerald-950/40 border border-emerald-800/60 text-emerald-300'
                  : 'bg-rose-950/40 border border-rose-800/60 text-rose-300'
              }`}
            >
              {message.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{message.text}</span>
            </div>
          )}

          {/* Saved Accounts Switcher List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-300">
              <span className="flex items-center gap-1.5">
                <Users className="w-4 h-4 text-indigo-400" />
                الحسابات المربوطة والمحفوظة في النظام:
              </span>
              <span className="text-slate-500 font-normal">انقر على أي حساب للتبديل الفوري إليه</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {accountData?.savedAccounts && accountData.savedAccounts.length > 0 ? (
                accountData.savedAccounts.map((acc) => (
                  <div
                    key={acc.id}
                    className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                      acc.isActive
                        ? 'bg-indigo-950/30 border-indigo-500/60 shadow-md ring-1 ring-indigo-500/40'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {acc.picture ? (
                        <img
                          src={acc.picture}
                          alt={acc.name}
                          className="w-10 h-10 rounded-xl object-cover border border-slate-700 shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center font-bold text-white shrink-0">
                          {acc.name ? acc.name.charAt(0) : 'U'}
                        </div>
                      )}

                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-white truncate">{acc.name}</h4>
                        <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1 mt-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                          متبقي {acc.daysRemaining} يوم
                        </span>
                      </div>
                    </div>

                    <div>
                      {acc.isActive ? (
                        <span className="px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          النشط
                        </span>
                      ) : (
                        <button
                          onClick={() => handleSwitchToSaved(acc.id)}
                          disabled={switchingId !== null}
                          className="px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-500/40 text-indigo-300 hover:text-white text-xs font-bold transition-all flex items-center gap-1 disabled:opacity-50"
                        >
                          {switchingId === acc.id ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                          ) : (
                            <span>تبديل</span>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-2 py-4 text-center text-xs text-slate-500">
                  جاري تحميل الحسابات...
                </div>
              )}
            </div>
          </div>

          {/* Form: Add or Connect Another Account */}
          <form onSubmit={handleAddNewAccount} className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                إضافة / ربط أكونت فيسبوك إضافي جديد
              </h3>

              <button
                type="button"
                onClick={() => setShowGuide(!showGuide)}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>{showGuide ? 'إخفاء الدليل' : 'إزاي أجيب التوكن؟'}</span>
              </button>
            </div>

            {showGuide && (
              <div className="p-4 rounded-xl bg-slate-900 border border-indigo-500/30 space-y-2.5 text-xs leading-relaxed animate-fadeIn">
                <div className="font-bold text-indigo-300 flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-indigo-400" />
                  طريقة استخراج التوكن في 3 خطوات:
                </div>
                <ol className="space-y-1.5 text-slate-300 list-decimal list-inside pr-1 text-[11px]">
                  <li>
                    افتح{' '}
                    <a
                      href="https://developers.facebook.com/tools/explorer"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-400 underline inline-flex items-center gap-0.5"
                    >
                      Graph API Explorer <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </li>
                  <li>اختار تطبيقك (<strong className="text-white">bird ads</strong>) وفي User or Page اختار <strong className="text-white">User Token</strong> مع الصلاحيات.</li>
                  <li>اضغط <strong className="text-white">Generate Access Token</strong> وانسخ التوكن والصقه هنا.</li>
                </ol>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[11px] font-semibold text-slate-300 block">
                رمز الوصول الجديد (Access Token):
              </label>
              <textarea
                value={newToken}
                onChange={(e) => setNewToken(e.target.value)}
                placeholder="EAAGpjUD5m1cBA..."
                rows={2}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-xs font-mono focus:border-indigo-500 focus:outline-none transition-all placeholder:text-slate-600"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || !newToken.trim()}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>جاري التحقق وتمديد الصلاحية لـ 60 يوم...</span>
                </>
              ) : (
                <>
                  <Key className="w-3.5 h-3.5" />
                  <span>تفعيل الحساب الجديد وتمديد الصلاحية لـ 60 يوم 🚀</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Modal Bottom Bar: System User & Prominent Logout Button */}
        <div className="p-4 sm:p-5 bg-slate-950/95 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 sticky bottom-0 z-10 backdrop-blur-md">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center font-bold text-sm text-white shadow-lg shadow-indigo-600/30 shrink-0">
              <User className="w-5 h-5 text-white" />
            </div>
            <div className="text-right">
              <div className="text-xs font-bold text-slate-100 flex items-center gap-2">
                <span>جلسة النظام النشطة:</span>
                <span className="text-indigo-400 font-bold">عين السوق</span>
              </div>
              <div className="text-[11px] text-slate-400">
                للخروج من لوحة التحكم والعودة لشاشة تسجيل الدخول
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSystemLogout}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 hover:text-rose-100 border border-rose-500/40 hover:border-rose-500/60 text-xs font-bold transition-all shadow-sm cursor-pointer active:scale-95 text-center"
          >
            تسجيل الخروج
          </button>
        </div>
      </div>
    </div>
  );
}