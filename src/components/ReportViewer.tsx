'use client';

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Sparkles,
  Maximize2,
  Minimize2,
  Printer,
  Copy,
  Check,
  X,
  FileText,
  ShieldAlert,
  CheckCircle2,
} from 'lucide-react';

interface ReportViewerProps {
  reportMarkdown: string;
  pageName: string;
  onClose?: () => void;
}

export default function ReportViewer({ reportMarkdown, pageName, onClose }: ReportViewerProps) {
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(reportMarkdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      {/* Inline Report Card */}
      <div className="p-6 rounded-2xl bg-slate-950/90 border-2 border-indigo-500/60 text-slate-100 shadow-2xl space-y-5 animate-fadeIn">
        {/* Header Actions Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4 no-print">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Sparkles className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                فحص جاهزية الصفحة للإعلانات (Ad Readiness Audit)
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30">
                  Gemini 2.5 Pro (CRO Expert)
                </span>
              </h3>
              <p className="text-xs text-slate-400">الصفحة المفحوصة: {pageName}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsFullscreen(true)}
              title="تكبير التقرير في نافذة كاملة"
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all flex items-center gap-1.5 shadow-sm"
            >
              <Maximize2 className="w-3.5 h-3.5 text-indigo-400" />
              <span>تكبير الشاشة</span>
            </button>

            <button
              onClick={handlePrint}
              title="تحميل أو طباعة التقرير بصيغة PDF"
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-all flex items-center gap-1.5 shadow-md"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>تحميل / طباعة PDF</span>
            </button>

            <button
              onClick={handleCopy}
              className="px-3.5 py-2 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 text-xs font-semibold border border-indigo-500/40 transition-all flex items-center gap-1.5"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'تم النسخ!' : 'نسخ التقرير'}</span>
            </button>

            {onClose && (
              <button
                onClick={onClose}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all text-xs"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Rendered Markdown Body */}
        <div className="max-h-[700px] overflow-y-auto pr-2 custom-markdown print-area leading-relaxed text-sm text-slate-200 space-y-4">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              table: ({ node, ...props }) => (
                <div className="overflow-x-auto my-4 rounded-xl border border-slate-800">
                  <table className="w-full text-right text-xs border-collapse bg-slate-900/50" {...props} />
                </div>
              ),
              thead: ({ node, ...props }) => <thead className="bg-slate-800/90 text-indigo-200 border-b border-slate-700" {...props} />,
              th: ({ node, ...props }) => <th className="py-3 px-4 font-bold text-right" {...props} />,
              td: ({ node, ...props }) => <td className="py-2.5 px-4 border-b border-slate-800/60 text-slate-300" {...props} />,
              h1: ({ node, ...props }) => <h1 className="text-xl font-black text-indigo-300 border-b border-slate-800 pb-2.5 mt-2" {...props} />,
              h2: ({ node, ...props }) => <h2 className="text-lg font-bold text-amber-300 mt-5 border-b border-slate-800/60 pb-1" {...props} />,
              h3: ({ node, ...props }) => <h3 className="text-base font-bold text-emerald-300 mt-4" {...props} />,
              ul: ({ node, ...props }) => <ul className="list-disc list-inside space-y-1.5 my-2 text-slate-300" {...props} />,
              ol: ({ node, ...props }) => <ol className="list-decimal list-inside space-y-1.5 my-2 text-slate-300" {...props} />,
              li: ({ node, ...props }) => <li className="leading-relaxed" {...props} />,
              strong: ({ node, ...props }) => <strong className="font-bold text-white" {...props} />,
              hr: ({ node, ...props }) => <hr className="my-4 border-slate-800" {...props} />,
            }}
          >
            {reportMarkdown}
          </ReactMarkdown>
        </div>
      </div>

      {/* Fullscreen Modal View */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-8 animate-fadeIn">
          <div className="w-full max-w-6xl max-h-[92vh] bg-slate-900 border-2 border-indigo-500/70 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 px-8 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  <Sparkles className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">فحص وتدقيق جاهزية الصفحة للإعلانات (Fullscreen Audit View)</h2>
                  <p className="text-xs text-slate-400">{pageName}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handlePrint}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-all flex items-center gap-2 shadow-md"
                >
                  <Printer className="w-4 h-4" />
                  <span>تحميل / طباعة PDF</span>
                </button>

                <button
                  onClick={handleCopy}
                  className="px-4 py-2 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 text-xs font-semibold border border-indigo-500/40 transition-all flex items-center gap-2"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'تم النسخ!' : 'نسخ التقرير'}</span>
                </button>

                <button
                  onClick={() => setIsFullscreen(false)}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all"
                >
                  <Minimize2 className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-8 overflow-y-auto flex-1 leading-loose text-base text-slate-200 space-y-4">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  table: ({ node, ...props }) => (
                    <div className="overflow-x-auto my-6 rounded-2xl border border-slate-800 shadow-lg">
                      <table className="w-full text-right text-sm border-collapse bg-slate-950/70" {...props} />
                    </div>
                  ),
                  thead: ({ node, ...props }) => <thead className="bg-slate-800 text-indigo-200 border-b border-slate-700" {...props} />,
                  th: ({ node, ...props }) => <th className="py-4 px-5 font-bold text-right" {...props} />,
                  td: ({ node, ...props }) => <td className="py-3.5 px-5 border-b border-slate-800/80 text-slate-200" {...props} />,
                  h1: ({ node, ...props }) => <h1 className="text-2xl font-black text-indigo-300 border-b border-slate-800 pb-3 mt-4" {...props} />,
                  h2: ({ node, ...props }) => <h2 className="text-xl font-bold text-amber-300 mt-6 border-b border-slate-800/80 pb-2" {...props} />,
                  h3: ({ node, ...props }) => <h3 className="text-lg font-bold text-emerald-300 mt-5" {...props} />,
                  ul: ({ node, ...props }) => <ul className="list-disc list-inside space-y-2.5 my-3 text-slate-300" {...props} />,
                  ol: ({ node, ...props }) => <ol className="list-decimal list-inside space-y-2.5 my-3 text-slate-300" {...props} />,
                  li: ({ node, ...props }) => <li className="leading-relaxed text-slate-200" {...props} />,
                  strong: ({ node, ...props }) => <strong className="font-bold text-white" {...props} />,
                  hr: ({ node, ...props }) => <hr className="my-6 border-slate-800" {...props} />,
                }}
              >
                {reportMarkdown}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
