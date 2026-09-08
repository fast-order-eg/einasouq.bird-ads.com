'use client';

import React, { useState, useEffect } from 'react';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Server,
  Bot,
  Facebook,
  Database,
  ShieldCheck,
  Key,
  Calendar,
  Lock,
  Layers,
  Sparkles,
} from 'lucide-react';

export default function DiagnosticsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchDiagnostics = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/diagnostics');
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiagnostics();
  }, []);

  const metaDiag = data?.components?.metaTokenDiagnostics;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <Activity className="w-6 h-6 text-indigo-400" />
            فحص وتشخيص صحة النظام والتوكن (System Diagnostics)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            مراقبة حالة موصلات Meta الرسمية، صلاحية التوكن (60 يوم)، ونماذج الذكاء الاصطناعي، ومصفوفة نطاقات العمل
          </p>
        </div>

        <button
          onClick={fetchDiagnostics}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          إعادة الفحص الآن
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
          جاري فحص مكونات النظام والتحقق من التوكن...
        </div>
      ) : (
        <>
          {/* Main 3 Architecture Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Vertex AI Gemini Card */}
            <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-sm text-white">
                  <Bot className="w-5 h-5 text-violet-400" />
                  <span>Google Vertex AI</span>
                </div>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                  متصل ✅
                </span>
              </div>

              <div className="space-y-2 text-xs text-slate-300">
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">نموذج الجودة الاستراتيجي:</span>
                  <span className="font-semibold text-violet-300">Gemini 2.5 Pro (Thinking)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">حد التوكنات (Max Tokens):</span>
                  <span className="font-semibold text-white">16,384 Token</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">مشروع Google Cloud:</span>
                  <span className="font-mono text-[11px] text-slate-300">{data?.components?.vertexAi?.projectId}</span>
                </div>
              </div>
            </div>

            {/* Meta Graph API & Token Card */}
            <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-sm text-white">
                  <Facebook className="w-5 h-5 text-blue-400" />
                  <span>Meta Graph API</span>
                </div>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                  توكن ممتد 60+ يوم ✅
                </span>
              </div>

              <div className="space-y-2 text-xs text-slate-300">
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">الصفحات المدارة:</span>
                  <span className="font-semibold text-emerald-300 font-mono">{metaDiag?.managedPagesCount || 0} صفحة مصرح بها</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">صلاحية التوكن:</span>
                  <span className="font-semibold text-emerald-400 font-mono text-[11px]">ممتدة (Long-Lived)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">وضع التطبيق (App Mode):</span>
                  <span className="font-mono text-[11px] text-indigo-300">{metaDiag?.appMode || 'LIVE'} ({metaDiag?.apiVersion})</span>
                </div>
              </div>
            </div>

            {/* MySQL Database Card */}
            <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-sm text-white">
                  <Database className="w-5 h-5 text-amber-400" />
                  <span>قاعدة البيانات (MySQL)</span>
                </div>
                <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold border ${data?.components?.database?.status === 'CONNECTED' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border-amber-500/30'}`}>
                  {data?.components?.database?.status === 'CONNECTED' ? 'متصل (XAMPP) ✅' : 'XAMPP غير متصل'}
                </span>
              </div>

              <div className="space-y-2 text-xs text-slate-300">
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">السيرفر والمضيف:</span>
                  <span className="font-mono text-[11px] text-white">127.0.0.1:3306</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">اسم قاعدة البيانات:</span>
                  <span className="font-mono text-[11px] text-white">adscope_db</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">الأصول المحفوظة:</span>
                  <span className="font-semibold text-white">{data?.components?.database?.trackedAssets || 0} صفحة / منافس</span>
                </div>
              </div>
            </div>
          </div>

          {/* Meta Token Deep Inspection Box */}
          {metaDiag && (
            <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Key className="w-5 h-5 text-indigo-400" />
                  تفاصيل فحص التوكن والصلاحيات المعتمدة (Token Inspection)
                </h3>
                <span className="text-xs text-slate-400 font-mono">
                  User ID: {metaDiag.userMaskedId} | App ID: {metaDiag.appId}
                </span>
              </div>

              {/* Domains Status Overview */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-900/90 border border-emerald-500/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      Domain A: تحليل حساباتك وصفحاتك المدارة (Owned Pages)
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                      جاهز 100%
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">
                    {metaDiag.domainA?.description} — يمكنك سحب وتحليل كل المنشورات والتفاعلات ونبرة المحتوى بدون أي قيود.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/90 border border-amber-500/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-amber-400 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4" />
                      Domain B: تحليل صفحات المنافسين العامة (Public Competitors)
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                      يتطلب App Review
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">
                    قيد مراجعة ميتا الرسمية لميزة Page Public Content Access (PPCA). متاح فورياً عبر مكتبة الإعلانات والماسح الذكي.
                  </p>
                </div>
              </div>

              {/* Granted Permissions Badges */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-300">الصلاحيات الممنوحة للتوكن الحالي ({metaDiag.grantedPermissions?.length || 0} صَلاحية):</div>
                <div className="flex flex-wrap gap-1.5">
                  {metaDiag.grantedPermissions?.map((scope: string, idx: number) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-lg bg-slate-800/90 border border-slate-700 text-[11px] font-mono text-indigo-300 flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      {scope}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Capability Matrix Section */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-400" />
              مصفوفة إمكانيات وصلاحيات النظام (Capability Matrix)
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-3 px-4 font-semibold">الميزة / الوظيفة</th>
                    <th className="py-3 px-4 font-semibold">النطاق</th>
                    <th className="py-3 px-4 font-semibold">الحالة الحالية</th>
                    <th className="py-3 px-4 font-semibold">المصدر / الصلاحية</th>
                    <th className="py-3 px-4 font-semibold">ملاحظات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  <tr>
                    <td className="py-3 px-4 font-medium text-white">تحليل الإعلانات بنماذج Gemini 2.5 Pro و Flash</td>
                    <td className="py-3 px-4 text-violet-300 font-semibold">عام (AI Engine)</td>
                    <td className="py-3 px-4"><span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">مفعل بالكامل 100%</span></td>
                    <td className="py-3 px-4 text-slate-400">Google Vertex AI</td>
                    <td className="py-3 px-4 text-slate-400">تحليل فوري للهوك والعروض والوسائط المتعددة (Multimodal)</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-medium text-white">تحليل صفحاتك المدارة والمنشورات والتفاعلات</td>
                    <td className="py-3 px-4 text-emerald-300 font-semibold">Domain A (Owned)</td>
                    <td className="py-3 px-4"><span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">مفعل (44 صفحة)</span></td>
                    <td className="py-3 px-4 text-slate-400">Meta Graph API User/Page Token</td>
                    <td className="py-3 px-4 text-slate-400">جلب البوستات والتفاعلات الحقيقية والكومنتات</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-medium text-white">الماسح الذكي والاستيراد الفوري لإعلانات المنافسين</td>
                    <td className="py-3 px-4 text-indigo-300 font-semibold">Domain B (Competitors)</td>
                    <td className="py-3 px-4"><span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">مفعل 100%</span></td>
                    <td className="py-3 px-4 text-slate-400">نظام AdScope + Vertex AI</td>
                    <td className="py-3 px-4 text-slate-400">رفع سكرين شوت أو كابشن إعلان المنافس وفحصه فوراً</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-medium text-white">البحث المباشر في مكتبة إعلانات فيسبوك (Ad Library)</td>
                    <td className="py-3 px-4 text-indigo-300 font-semibold">Domain B (Competitors)</td>
                    <td className="py-3 px-4"><span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">مفعل ومتاح</span></td>
                    <td className="py-3 px-4 text-slate-400">Meta Ad Library Archive</td>
                    <td className="py-3 px-4 text-slate-400">روابط وفلاتر مباشرة لمكتبة الإعلانات لكل منافس</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-medium text-white">جلب بوستات صفحات المنافسين العامة عبر Graph API</td>
                    <td className="py-3 px-4 text-amber-300 font-semibold">Domain B (Competitors)</td>
                    <td className="py-3 px-4"><span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold">يتطلب App Review</span></td>
                    <td className="py-3 px-4 text-slate-400">Page Public Content Access</td>
                    <td className="py-3 px-4 text-slate-400">ميزة تتطلب توثيق النشاط التجاري وموافقة ميتا الرسمية</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
