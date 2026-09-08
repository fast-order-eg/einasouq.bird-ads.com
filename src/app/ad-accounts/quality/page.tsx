'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  RotateCw,
  Copy,
  Check,
  ExternalLink,
  Search,
  XCircle,
  Eye,
  Building2,
  CreditCard,
  Megaphone,
  CheckCircle2,
  Maximize2
} from 'lucide-react';

// Global client-side memory cache for instant 0ms switching
let globalQualityCache: any = null;

export default function AccountQualityPage() {
  const [loading, setLoading] = useState(!globalQualityCache);
  const [syncing, setSyncing] = useState(false);
  const [adAccounts, setAdAccounts] = useState<any[]>(globalQualityCache?.adAccounts || []);
  const [businesses, setBusinesses] = useState<any[]>(globalQualityCache?.businesses || []);
  const [searchQuery, setSearchQuery] = useState('');
  const [reasonFilter, setReasonFilter] = useState<'ALL' | 'POLICY' | 'PAYMENT' | 'OTHER'>('ALL');

  // Selected Account for Ads Inspection Modal
  const [inspectingAccount, setInspectingAccount] = useState<any | null>(null);
  const [loadingAds, setLoadingAds] = useState(false);
  const [accountAds, setAccountAds] = useState<any[]>([]);
  const [adsError, setAdsError] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Copy feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const fetchQualityAccounts = async (forceRefresh = false) => {
    if (forceRefresh) setSyncing(true);
    else if (adAccounts.length === 0) setLoading(true);

    try {
      const res = await fetch(`/api/ads/accounts?quality=true${forceRefresh ? '&refresh=true' : ''}`);
      const data = await res.json();
      if (data.success) {
        globalQualityCache = data;
        setAdAccounts(data.adAccounts || []);
        setBusinesses(data.businesses || []);
        try {
          localStorage.setItem('adscope_cached_quality_accounts', JSON.stringify(data));
        } catch (e) {}
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  };

  useEffect(() => {
    if (globalQualityCache && globalQualityCache.adAccounts && globalQualityCache.adAccounts.length > 0) {
      setAdAccounts(globalQualityCache.adAccounts);
      setBusinesses(globalQualityCache.businesses || []);
      setLoading(false);
      return;
    }

    try {
      const cached = localStorage.getItem('adscope_cached_quality_accounts');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.adAccounts && parsed.adAccounts.length > 0) {
          globalQualityCache = parsed;
          setAdAccounts(parsed.adAccounts);
          setBusinesses(parsed.businesses || []);
          setLoading(false);
          return;
        }
      }
    } catch (e) {}

    fetchQualityAccounts(false);
  }, []);

  const handleInspectAccount = async (account: any) => {
    setInspectingAccount(account);
    setLoadingAds(true);
    setAdsError(null);
    setAccountAds([]);

    try {
      const res = await fetch('/api/ads/account-ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: account.account_id || account.id }),
      });
      const data = await res.json();
      if (data.success) {
        setAccountAds(data.ads || []);
      } else {
        setAdsError(data.error || 'تعذر جلب إعلانات هذا الحساب');
      }
    } catch (err: any) {
      setAdsError(err.message || 'خطأ في الاتصال');
    } finally {
      setLoadingAds(false);
    }
  };

  const getReasonInfo = (reasonCode: number, status: number) => {
    if (status === 3) {
      return {
        label: 'تعليق بسبب مديونية أو تسوية مالية',
        desc: 'الحساب عليه مبالغ مستحقة لم يتم تسويتها أو فشل في وسيلة الدفع.',
        type: 'PAYMENT',
        color: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
      };
    }

    switch (reasonCode) {
      case 1:
        return {
          label: 'انتهاك سياسات الإعلانات (Advertising Policies)',
          desc: 'تم تعطيل الحساب بسبب مخالفة معايير فيسبوك الإعلانية أو جودة المحتوى.',
          type: 'POLICY',
          color: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
        };
      case 2:
        return {
          label: 'مراجعة حقوق الملكية الفكرية (IP Review)',
          desc: 'تم إيقاف الحساب بسبب بلاغات ملكية فكرية أو علامات تجارية.',
          type: 'POLICY',
          color: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
        };
      case 3:
        return {
          label: 'مخاطر أمان وسيلة الدفع (Risk Payment)',
          desc: 'اشتباه أمني في البطاقة الائتمانية أو عملية الدفع الأخيرة.',
          type: 'PAYMENT',
          color: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
        };
      default:
        return {
          label: 'تقييد الحساب الإعلاني (Account Disabled)',
          desc: 'الحساب معطل بقرار من فيسبوك ويتطلب تقديم طلب مراجعة.',
          type: 'OTHER',
          color: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
        };
    }
  };

  const filteredRestrictedAccounts = useMemo(() => {
    return adAccounts.filter((a) => {
      const pureId = (a.account_id || a.id || '').replace(/^act_/, '');
      const matchesSearch =
        (a.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        pureId.includes(searchQuery);

      if (!matchesSearch) return false;

      const reason = getReasonInfo(a.disable_reason, a.account_status);
      if (reasonFilter === 'POLICY') return reason.type === 'POLICY';
      if (reasonFilter === 'PAYMENT') return reason.type === 'PAYMENT';

      return true;
    });
  }, [adAccounts, searchQuery, reasonFilter]);

  return (
    <div className="p-3 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-rose-600/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white">جودة الحساب والتقييدات الإعلانية</h1>
              <p className="text-xs text-slate-400 mt-0.5">رصد وفحص كافة الحسابات ومديري الأعمال المقيدة والمعطلة مع أسباب الإيقاف ونسخ البيانات فوراً</p>
            </div>
          </div>
        </div>

        <button
          onClick={() => fetchQualityAccounts(true)}
          disabled={syncing || loading}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-bold border border-slate-700 transition-all cursor-pointer w-full sm:w-auto"
        >
          <RotateCw className={`w-4 h-4 ${syncing ? 'animate-spin text-rose-400' : ''}`} />
          <span>{syncing ? 'جاري التحديث...' : 'تحديث'}</span>
        </button>
      </div>

      {/* Top Banner Alert */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-rose-950/40 via-slate-900 to-slate-900 border border-rose-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-100 text-sm">
              تم رصد <span className="text-rose-400 font-black text-base">{adAccounts.length}</span> حساب إعلاني مقيد أو معطل
            </h3>
            <p className="text-xs text-slate-400">
              يمكنك نسخ معرف الحساب واسمه بنقرة واحدة لتقديم طلب مراجعة في مركز جودة الحساب الرسمي
            </p>
          </div>
        </div>

        <a
          href="https://business.facebook.com/accountquality"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 font-bold text-xs border border-rose-500/40 transition-all shrink-0"
        >
          <span>مركز جودة الحساب في فيسبوك</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Search & Filter bar */}
      <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800/80 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'ALL', label: `كل الحسابات المقيدة (${adAccounts.length})` },
              { id: 'POLICY', label: 'انتهاك سياسات الإعلانات' },
              { id: 'PAYMENT', label: 'مشكلات دفع ومديونية' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setReasonFilter(f.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  reasonFilter === f.id
                    ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                    : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative flex-1 max-w-xs">
            <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث باسم الحساب أو رقم الـ ID..."
              className="w-full pl-4 pr-10 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-rose-500/80 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Restricted Accounts List */}
      {loading ? (
        <div className="py-20 text-center space-y-3">
          <RotateCw className="w-8 h-8 text-rose-400 animate-spin mx-auto" />
          <p className="text-sm text-slate-400">جاري فحص الحسابات المقيدة والمعطلة...</p>
        </div>
      ) : filteredRestrictedAccounts.length === 0 ? (
        <div className="py-16 text-center rounded-2xl bg-slate-900/40 border border-slate-800 space-y-2">
          <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
          <p className="text-sm text-slate-200 font-bold">لا توجد حسابات مطابقة لمعايير البحث</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredRestrictedAccounts.map((a) => {
            const reason = getReasonInfo(a.disable_reason, a.account_status);
            const spentAmount = (parseFloat(a.amount_spent || '0') / 100).toLocaleString('en-US', { maximumFractionDigits: 2 });
            const balanceAmount = (parseFloat(a.balance || '0') / 100).toLocaleString('en-US', { maximumFractionDigits: 2 });
            const pureId = (a.account_id || a.id || '').replace(/^act_/, '');

            return (
              <div
                key={pureId}
                className="p-5 rounded-2xl bg-slate-900/90 border border-rose-500/20 hover:border-rose-500/40 transition-all space-y-4 shadow-sm"
              >
                {/* Header: Reason badge + Currency */}
                <div className="flex items-start justify-between gap-2">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${reason.color}`}>
                    <XCircle className="w-3.5 h-3.5 shrink-0" />
                    <span className="line-clamp-1">{reason.label}</span>
                  </span>
                  <span className="text-[11px] font-black px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                    {a.currency}
                  </span>
                </div>

                {/* Account Details with Copy Buttons */}
                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-2">
                  {/* Account Name */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 font-medium">اسم الحساب:</span>
                      <span className="font-black text-slate-100 text-sm line-clamp-1" title={a.name}>
                        {a.name}
                      </span>
                    </div>
                    <button
                      onClick={() => copyToClipboard(a.name, `name-${pureId}`)}
                      className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all"
                    >
                      {copiedId === `name-${pureId}` ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400">تم</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-slate-400" />
                          <span>نسخ الاسم</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Account Pure Number ID */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-mono">
                      <span className="text-xs text-slate-500 font-sans">رقم الحساب:</span>
                      <span className="font-bold text-indigo-300 text-xs tracking-wide">
                        {pureId}
                      </span>
                    </div>
                    <button
                      onClick={() => copyToClipboard(pureId, `id-${pureId}`)}
                      className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all"
                    >
                      {copiedId === `id-${pureId}` ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400">تم</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-slate-400" />
                          <span>نسخ الرقم</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Reason description */}
                <p className="text-xs text-slate-400 leading-relaxed">
                  {reason.desc}
                </p>

                {/* Stats Summary */}
                <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800/60">
                  <span>المصروف: <strong className="text-slate-200 font-bold">{spentAmount} {a.currency}</strong></span>
                  <span>المديونية: <strong className={`font-bold ${parseFloat(a.balance) > 0 ? 'text-amber-400' : 'text-slate-400'}`}>{balanceAmount} {a.currency}</strong></span>
                </div>

                {/* Bottom Actions */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-800/60">
                  <button
                    onClick={() => handleInspectAccount(a)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 transition-all cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 text-indigo-400" />
                    <span>فحص الإعلانات المعطلة</span>
                  </button>

                  <a
                    href={`https://business.facebook.com/accountquality/?account_id=${pureId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 py-2 px-3 rounded-xl bg-rose-600/10 hover:bg-rose-600/20 text-rose-400 font-bold text-xs border border-rose-500/30 transition-all"
                  >
                    <span>طلب مراجعة</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Inspect Ads Modal */}
      {inspectingAccount && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-rose-600/20 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                  <Megaphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-white text-base leading-snug">{inspectingAccount.name}</h3>
                  <p className="text-xs text-rose-400 font-mono">الحساب معطل • رقم الحساب: {(inspectingAccount.account_id || inspectingAccount.id || '').replace(/^act_/, '')}</p>
                </div>
              </div>

              <button
                onClick={() => setInspectingAccount(null)}
                className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-all cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {loadingAds ? (
                <div className="py-16 text-center space-y-3">
                  <RotateCw className="w-7 h-7 text-rose-400 animate-spin mx-auto" />
                  <p className="text-sm text-slate-400">جاري فحص الإعلانات التي كانت داخل هذا الحساب المعطل...</p>
                </div>
              ) : adsError ? (
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                  {adsError}
                </div>
              ) : accountAds.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-sm">
                  لا توجد إعلانات مسجلة داخل هذا الحساب
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-xs text-slate-400 font-bold">
                    الإعلانات في هذا الحساب ({accountAds.length}):
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {accountAds.map((ad) => {
                      const creative = ad.creative || {};
                      const thumb = creative.thumbnail_url || creative.image_url;
                      const insight = ad.insights?.data?.[0];

                      return (
                        <div
                          key={ad.id}
                          className="p-4 rounded-2xl bg-slate-950 border border-slate-800/90 space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                              {ad.status}
                            </span>
                            <span className="text-[10px] font-mono text-slate-500">ID: {ad.id}</span>
                          </div>

                          <div className="flex gap-3">
                            {thumb && (
                              <div
                                onClick={() => setPreviewImage(thumb)}
                                className="relative group cursor-pointer w-20 h-20 rounded-xl overflow-hidden shrink-0 border border-slate-800"
                              >
                                <img
                                  src={thumb}
                                  alt="Creative"
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[10px] font-bold gap-1">
                                  <Maximize2 className="w-3 h-3" />
                                </div>
                              </div>
                            )}
                            <div className="flex-1 space-y-1">
                              <h4 className="text-xs font-bold text-slate-200 line-clamp-1">{ad.name}</h4>
                              <p className="text-[11px] text-slate-400 line-clamp-3 leading-relaxed">
                                {creative.body || creative.title || 'بدون نص إعلاني'}
                              </p>
                            </div>
                          </div>

                          {insight && (
                            <div className="grid grid-cols-3 gap-1 pt-2 border-t border-slate-800/60 text-[10px] text-center font-bold">
                              <div className="p-1 rounded bg-slate-900 text-emerald-400">
                                {insight.spend} {inspectingAccount.currency}
                              </div>
                              <div className="p-1 rounded bg-slate-900 text-purple-300">
                                CTR: {insight.ctr ? parseFloat(insight.ctr).toFixed(1) : 0}%
                              </div>
                              <div className="p-1 rounded bg-slate-900 text-indigo-400">
                                {insight.clicks || 0} نقرة
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-60 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="relative max-w-2xl max-h-[85vh] rounded-2xl overflow-hidden border border-slate-700 shadow-2xl">
            <img src={previewImage} alt="Ad Preview" className="max-w-full max-h-[85vh] object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}
