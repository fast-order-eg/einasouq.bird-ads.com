'use client';

import React, { useState } from 'react';
import {
  FileText,
  Bot,
  Sparkles,
  RefreshCw,
  Copy,
  CheckCircle2,
  Printer,
} from 'lucide-react';
import { INITIAL_COMPETITOR_ADS } from '@/lib/mock-data';
import ReportViewer from '@/components/ReportViewer';

export default function ReportsPage() {
  const [competitorName, setCompetitorName] = useState('Bird Technology');
  const [selectedAdsCount, setSelectedAdsCount] = useState(3);
  const [generating, setGenerating] = useState(false);
  const [reportOutput, setReportOutput] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerateReport = async () => {
    if (!competitorName.trim()) return;
    setGenerating(true);
    setReportOutput(null);

    const adsPayload = INITIAL_COMPETITOR_ADS.slice(0, selectedAdsCount).map((a) => ({
      text: a.primaryText,
      date: a.firstSeen,
      format: a.mediaType,
    }));

    try {
      const res = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          competitorName,
          ads: adsPayload,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setReportOutput(data.report);
      } else {
        alert(data.error || 'حدث خطأ أثناء إنشاء التقرير');
      }
    } catch (err: any) {
      alert('خطأ في الاتصال: ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = () => {
    if (!reportOutput) return;
    navigator.clipboard.writeText(reportOutput);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-900 border border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-400" />
            تقارير تحليل المنافسين
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            ملخص استراتيجي ونقاط القوة والضعف وأفكار إعلانية مضادة بـ Gemini 2.5 Pro
          </p>
        </div>
      </div>

      {/* Generator Form */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-8 space-y-1">
            <label className="text-xs text-slate-300 font-semibold">اسم المنافس / العلامة التجارية:</label>
            <input
              type="text"
              value={competitorName}
              onChange={(e) => setCompetitorName(e.target.value)}
              placeholder="مثال: Bird Technology"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="sm:col-span-4 flex items-end">
            <button
              onClick={handleGenerateReport}
              disabled={generating || !competitorName.trim()}
              className="w-full h-[38px] inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition-all disabled:opacity-50"
            >
              {generating ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  جاري التوليد...
                </>
              ) : (
                <>
                  <Bot className="w-3.5 h-3.5" />
                  توليد التقرير السريع
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Report Output */}
      {reportOutput && (
        <ReportViewer
          reportMarkdown={reportOutput}
          pageName={competitorName}
          onClose={() => setReportOutput(null)}
        />
      )}
    </div>
  );
}
