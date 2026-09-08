'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  Search,
  Bot,
  TrendingUp,
  Layers,
  FileCheck2,
  ArrowLeft,
  CheckCircle2,
  Zap,
  RefreshCw,
  Target,
  Gift,
  Users,
  AlertTriangle,
  Lightbulb,
} from 'lucide-react';

export default function DashboardPage() {
  const [quickAdText, setQuickAdText] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);

  const handleQuickAnalyze = async () => {
    if (!quickAdText.trim()) return;
    setAnalyzing(true);
    setAnalysisResult(null);

    try {
      const res = await fetch('/api/ads/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adText: quickAdText,
          pageName: 'إعلان مخصص',
          platform: 'Meta',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setAnalysisResult(data.analysis);
      } else {
        alert(data.error || 'حدث خطأ أثناء التحليل');
      }
    } catch (err: any) {
      alert('خطأ في الاتصال: ' + err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 max-w-6xl mx-auto">
      {/* Top Banner - Clean & Simple */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900 border border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            عين السوق
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            رادار إعلانات المنافسين وفحص جاهزية صفحاتك بالذكاء الاصطناعي
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/discovery"
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition-all flex items-center gap-1.5"
          >
            <Search className="w-3.5 h-3.5" />
            رادار إعلانات المنافسين
          </Link>
          <Link
            href="/pages"
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-all flex items-center gap-1.5"
          >
            <Layers className="w-3.5 h-3.5 text-blue-400" />
            ملفاتك الشخصية وصفحاتك
          </Link>
        </div>
      </div>

      {/* Quick AI Scanner */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-white font-bold text-sm">
            <Zap className="w-4 h-4 text-amber-400" />
            <span>الفاحص الذكي السريع للإعلانات</span>
            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold border border-amber-500/30">
              قريباً
            </span>
          </div>
          <span className="text-[11px] text-slate-400">تحليل لحظي بدون رغي</span>
        </div>

        <div className="space-y-3">
          <textarea
            value={quickAdText}
            onChange={(e) => setQuickAdText(e.target.value)}
            placeholder="الصق نص أي إعلان هنا للتحليل المباشر..."
            rows={2}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all resize-none"
          />

          <div className="flex justify-end">
            <button
              onClick={handleQuickAnalyze}
              disabled={analyzing || !quickAdText.trim()}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition-all disabled:opacity-50"
            >
              {analyzing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  جاري التحليل...
                </>
              ) : (
                <>
                  <Bot className="w-3.5 h-3.5" />
                  تحليل الإعلان
                </>
              )}
            </button>
          </div>
        </div>

        {/* Clean, Compact Analysis Output */}
        {analysisResult && (
          <div className="p-4 rounded-xl bg-slate-950 border border-indigo-500/30 space-y-4 animate-fadeIn text-xs">
            {/* Header / Score */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <span className="font-bold text-white flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ملخص التحليل السريع
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-bold">
                التقييم: {analysisResult.observed_creative_strength_score || 8.5} / 10
              </span>
            </div>

            {/* Quick Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                <div className="text-slate-400 font-semibold flex items-center gap-1">
                  <Target className="w-3.5 h-3.5 text-rose-400" />
                  الهوك ({analysisResult.hook?.type || 'نوع الهوك'}):
                </div>
                <div className="text-slate-200 font-medium">{analysisResult.hook?.text || '-'}</div>
              </div>

              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                <div className="text-slate-400 font-semibold flex items-center gap-1">
                  <Gift className="w-3.5 h-3.5 text-emerald-400" />
                  العرض الأساسي:
                </div>
                <div className="text-slate-200 font-medium">{analysisResult.offer?.details || '-'}</div>
              </div>

              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                <div className="text-slate-400 font-semibold flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-blue-400" />
                  الجمهور المستهدف:
                </div>
                <div className="text-slate-200 font-medium">{analysisResult.audience_hypothesis || '-'}</div>
              </div>
            </div>

            {/* Strengths & Flaws in 2 clean columns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-800/30 space-y-1.5">
                <div className="text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  نقاط القوة:
                </div>
                <ul className="space-y-1 text-slate-300">
                  {analysisResult.strengths?.map((s: string, i: number) => (
                    <li key={i}>• {s}</li>
                  ))}
                </ul>
              </div>

              <div className="p-3 rounded-lg bg-amber-950/20 border border-amber-800/30 space-y-1.5">
                <div className="text-amber-400 font-bold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  الثغرات ونقاط التحسين:
                </div>
                <ul className="space-y-1 text-slate-300">
                  {analysisResult.weaknesses?.map((w: string, i: number) => (
                    <li key={i}>• {w}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Recommendations */}
            {analysisResult.strategic_recommendations?.length > 0 && (
              <div className="p-3 rounded-lg bg-indigo-950/20 border border-indigo-800/30 space-y-1.5">
                <div className="text-indigo-300 font-bold flex items-center gap-1">
                  <Lightbulb className="w-3.5 h-3.5 text-indigo-400" />
                  أفكار سريعة للتفوق عليه:
                </div>
                <ul className="space-y-1 text-slate-300">
                  {analysisResult.strategic_recommendations?.map((r: string, i: number) => (
                    <li key={i}>💡 {r}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
