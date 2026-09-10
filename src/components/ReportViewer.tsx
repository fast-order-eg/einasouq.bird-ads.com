'use client';

import React, { useState, useRef } from 'react';
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
  ExternalLink,
  ShieldAlert,
  CheckCircle2,
} from 'lucide-react';

interface ReportViewerProps {
  reportMarkdown: string;
  pageName: string;
  initialFullscreen?: boolean;
  onClose?: () => void;
}

export default function ReportViewer({
  reportMarkdown,
  pageName,
  initialFullscreen = false,
  onClose,
}: ReportViewerProps) {
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(initialFullscreen);
  const inlineContentRef = useRef<HTMLDivElement>(null);
  const modalContentRef = useRef<HTMLDivElement>(null);

  const handleCopy = () => {
    navigator.clipboard.writeText(reportMarkdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  // Helper to generate clean, printable HTML document for multi-page PDF output
  const generatePrintableHtml = (contentHtml: string) => {
    const formattedDate = new Date().toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>تقرير فحص جاهزية الصفحة للإعلانات - ${pageName}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    @page {
      size: A4 portrait;
      margin: 15mm 12mm 15mm 12mm;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: 'Cairo', system-ui, -apple-system, sans-serif;
      background: #ffffff !important;
      color: #1e293b !important;
      margin: 0;
      padding: 0;
      direction: rtl;
      text-align: right;
      line-height: 1.75;
      font-size: 13px;
    }
    .print-header {
      border-bottom: 2.5px solid #4f46e5;
      padding-bottom: 14px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .print-title {
      font-size: 19px;
      font-weight: 800;
      color: #1e1b4b;
      margin: 0 0 4px 0;
    }
    .print-meta {
      font-size: 12px;
      color: #64748b;
      margin: 0;
    }
    .print-badge {
      display: inline-block;
      background: #eef2ff;
      color: #4338ca;
      font-size: 11px;
      font-weight: 700;
      padding: 4px 12px;
      border-radius: 9999px;
      border: 1px solid #c7d2fe;
    }
    h1, h2, h3, h4 {
      page-break-after: avoid;
      break-after: avoid;
    }
    h1 {
      font-size: 17px;
      font-weight: 800;
      color: #312e81;
      border-bottom: 1.5px solid #e2e8f0;
      padding-bottom: 6px;
      margin-top: 22px;
      margin-bottom: 10px;
    }
    h2 {
      font-size: 15px;
      font-weight: 700;
      color: #b45309;
      margin-top: 18px;
      margin-bottom: 8px;
      border-bottom: 1px dashed #e2e8f0;
      padding-bottom: 4px;
    }
    h3 {
      font-size: 13.5px;
      font-weight: 700;
      color: #047857;
      margin-top: 14px;
      margin-bottom: 6px;
    }
    p {
      margin: 8px 0;
      color: #334155;
      line-height: 1.75;
    }
    table {
      width: 100% !important;
      border-collapse: collapse !important;
      margin: 16px 0 22px 0 !important;
      font-size: 12px !important;
      page-break-inside: auto !important;
      break-inside: auto !important;
    }
    tr {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    th, td {
      border: 1px solid #cbd5e1 !important;
      padding: 9px 12px !important;
      text-align: right !important;
      vertical-align: top !important;
    }
    th {
      background-color: #f1f5f9 !important;
      color: #0f172a !important;
      font-weight: 700 !important;
    }
    td {
      background-color: #ffffff !important;
      color: #334155 !important;
    }
    ul, ol {
      padding-right: 22px;
      margin: 8px 0;
    }
    li {
      margin-bottom: 5px;
      color: #334155;
    }
    strong {
      font-weight: 700;
      color: #0f172a;
    }
    hr {
      border: none;
      border-top: 1px solid #e2e8f0;
      margin: 18px 0;
    }
    div {
      background: transparent !important;
      box-shadow: none !important;
      border-color: #cbd5e1 !important;
      overflow: visible !important;
      max-height: none !important;
    }
  </style>
</head>
<body>
  <div class="print-header">
    <div>
      <h1 class="print-title">تقرير فحص جاهزية الصفحة للإعلانات (Ad Readiness Audit)</h1>
      <p class="print-meta">الصفحة المفحوصة: <strong>${pageName}</strong> &bull; تاريخ الفحص: ${formattedDate} &bull; نظام التدقيق: Gemini CRO Expert</p>
    </div>
    <div class="print-badge">عين السوق &bull; تقرير معتمد</div>
  </div>
  <div class="print-content">
    ${contentHtml}
  </div>
</body>
</html>`;
  };

  // Dedicated Print handler using an isolated iframe for flawless multi-page pagination
  const handlePrint = () => {
    const contentEl =
      modalContentRef.current ||
      inlineContentRef.current ||
      document.querySelector('.custom-markdown');

    if (!contentEl) {
      window.print();
      return;
    }

    const printHtml = generatePrintableHtml(contentEl.innerHTML);

    // Create an invisible iframe
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.setAttribute('aria-hidden', 'true');
    document.body.appendChild(iframe);

    const frameDoc = iframe.contentWindow?.document;
    if (!frameDoc || !iframe.contentWindow) {
      window.print();
      return;
    }

    frameDoc.open();
    frameDoc.write(printHtml);
    frameDoc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (e) {
        console.error('Iframe print failed, falling back to window.print():', e);
        window.print();
      } finally {
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 1500);
      }
    }, 400);
  };

  // Open standalone view in a separate tab for full-screen inspection & printing
  const handleOpenStandalone = () => {
    const contentEl =
      modalContentRef.current ||
      inlineContentRef.current ||
      document.querySelector('.custom-markdown');

    const contentHtml = contentEl ? contentEl.innerHTML : '';
    const formattedDate = new Date().toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const standaloneHtml = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>معاينة كاملة - تقرير فحص جاهزية الصفحة (${pageName})</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    @page {
      size: A4 portrait;
      margin: 15mm 12mm 15mm 12mm;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: 'Cairo', system-ui, -apple-system, sans-serif;
      background: #0b0f19;
      color: #0f172a;
      margin: 0;
      padding: 0;
      direction: rtl;
      text-align: right;
    }
    .toolbar {
      position: sticky;
      top: 0;
      background: #0f172a;
      color: #ffffff;
      padding: 12px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 2px solid #6366f1;
      z-index: 1000;
      box-shadow: 0 4px 20px rgba(0,0,0,0.4);
    }
    .toolbar-title {
      font-size: 14px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 18px;
      border-radius: 10px;
      font-family: 'Cairo', sans-serif;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      border: none;
      transition: all 0.2s;
    }
    .btn-print {
      background: #10b981;
      color: #ffffff;
    }
    .btn-print:hover {
      background: #059669;
    }
    .btn-close {
      background: #334155;
      color: #ffffff;
    }
    .btn-close:hover {
      background: #475569;
    }
    .doc-container {
      max-width: 960px;
      margin: 30px auto;
      background: #ffffff;
      padding: 48px;
      border-radius: 24px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
      line-height: 1.8;
      font-size: 13.5px;
    }
    .report-header {
      border-bottom: 2.5px solid #4f46e5;
      padding-bottom: 16px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .report-title {
      font-size: 21px;
      font-weight: 900;
      color: #1e1b4b;
      margin: 0 0 6px 0;
    }
    .report-meta {
      font-size: 12px;
      color: #64748b;
      margin: 0;
    }
    .report-badge {
      background: #eef2ff;
      color: #4338ca;
      font-size: 11px;
      font-weight: 700;
      padding: 4px 12px;
      border-radius: 9999px;
      border: 1px solid #c7d2fe;
    }
    h1, h2, h3, h4 {
      page-break-after: avoid;
      break-after: avoid;
    }
    h1 {
      font-size: 18px;
      font-weight: 800;
      color: #312e81;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 8px;
      margin-top: 26px;
      margin-bottom: 12px;
    }
    h2 {
      font-size: 16px;
      font-weight: 700;
      color: #b45309;
      margin-top: 22px;
      margin-bottom: 10px;
      border-bottom: 1px dashed #e2e8f0;
      padding-bottom: 4px;
    }
    h3 {
      font-size: 14.5px;
      font-weight: 700;
      color: #047857;
      margin-top: 18px;
      margin-bottom: 8px;
    }
    p {
      margin: 8px 0;
      color: #334155;
    }
    table {
      width: 100% !important;
      border-collapse: collapse !important;
      margin: 18px 0 24px 0 !important;
      font-size: 12.5px !important;
      page-break-inside: auto !important;
      break-inside: auto !important;
    }
    tr {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    th, td {
      border: 1px solid #cbd5e1 !important;
      padding: 10px 14px !important;
      text-align: right !important;
      vertical-align: top !important;
    }
    th {
      background-color: #f8fafc !important;
      color: #0f172a !important;
      font-weight: 700 !important;
    }
    td {
      background-color: #ffffff !important;
      color: #334155 !important;
    }
    ul, ol {
      padding-right: 24px;
      margin: 10px 0;
    }
    li {
      margin-bottom: 6px;
      color: #334155;
    }
    strong {
      font-weight: 700;
      color: #0f172a;
    }
    hr {
      border: none;
      border-top: 1px solid #e2e8f0;
      margin: 22px 0;
    }
    div {
      background: transparent !important;
      box-shadow: none !important;
      border-color: #cbd5e1 !important;
      overflow: visible !important;
      max-height: none !important;
    }
    @media print {
      body {
        background: #ffffff !important;
      }
      .toolbar {
        display: none !important;
      }
      .doc-container {
        max-width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        box-shadow: none !important;
        border-radius: 0 !important;
      }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <div class="toolbar-title">
      <span>📄 تقرير فحص جاهزية الصفحة: <strong>${pageName}</strong></span>
    </div>
    <div style="display: flex; gap: 10px;">
      <button onclick="window.print()" class="btn btn-print">
        🖨️ طباعة / حفظ كـ PDF (جميع الصفحات)
      </button>
      <button onclick="window.close()" class="btn btn-close">
        إغلاق المعاينة
      </button>
    </div>
  </div>
  <div class="doc-container">
    <div class="report-header">
      <div>
        <h1 class="report-title">تقرير فحص جاهزية الصفحة للإعلانات (Ad Readiness Audit)</h1>
        <p class="report-meta">الصفحة المفحوصة: <strong>${pageName}</strong> &bull; تاريخ الفحص: ${formattedDate} &bull; تم عبر: عين السوق (Gemini CRO Expert)</p>
      </div>
      <div class="report-badge">عين السوق &bull; تقرير معتمد</div>
    </div>
    <div>
      ${contentHtml}
    </div>
  </div>
</body>
</html>`;

    const newWin = window.open('', '_blank');
    if (!newWin) {
      alert('يرجى السماح بالنوافذ المنبثقة لفتح التقرير في نافذة مستقلة');
      return;
    }

    newWin.document.open();
    newWin.document.write(standaloneHtml);
    newWin.document.close();
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
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Maximize2 className="w-3.5 h-3.5 text-indigo-400" />
              <span>تكبير الشاشة</span>
            </button>

            <button
              onClick={handleOpenStandalone}
              title="عرض التقرير الكامل في نافذة مستقلة"
              className="px-3 py-2 rounded-xl bg-indigo-950 hover:bg-indigo-900 text-indigo-200 text-xs font-semibold border border-indigo-700/60 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
              <span>معاينة في صفحة مستقلة</span>
            </button>

            <button
              onClick={handlePrint}
              title="تحميل أو طباعة التقرير بصيغة PDF كامل الصفحات"
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-all flex items-center gap-1.5 shadow-md cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>تحميل / طباعة PDF</span>
            </button>

            <button
              onClick={handleCopy}
              className="px-3 py-2 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 text-xs font-semibold border border-indigo-500/40 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'تم النسخ!' : 'نسخ التقرير'}</span>
            </button>

            {onClose && (
              <button
                onClick={onClose}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all text-xs cursor-pointer"
                title="إغلاق التقرير"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Rendered Markdown Body (Inline) */}
        <div
          ref={inlineContentRef}
          id="report-content-inline"
          className="max-h-[700px] overflow-y-auto pr-2 custom-markdown print-area leading-relaxed text-sm text-slate-200 space-y-4"
        >
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
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
          <div className="w-full max-w-6xl max-h-[94vh] bg-slate-900 border-2 border-indigo-500/70 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 px-6 sm:px-8 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 no-print">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  <Sparkles className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-white">
                    فحص وتدقيق جاهزية الصفحة للإعلانات (Fullscreen Audit View)
                  </h2>
                  <p className="text-xs text-slate-400">الصفحة: {pageName}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleOpenStandalone}
                  title="فتح في صفحة مستقلة كاملة"
                  className="px-3 py-2 rounded-xl bg-indigo-950 hover:bg-indigo-900 text-indigo-200 text-xs font-semibold border border-indigo-700/60 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="hidden sm:inline">معاينة في صفحة مستقلة</span>
                </button>

                <button
                  onClick={handlePrint}
                  title="تحميل أو طباعة التقرير بصيغة PDF كامل الصفحات"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-all flex items-center gap-2 shadow-md cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>تحميل / طباعة PDF</span>
                </button>

                <button
                  onClick={handleCopy}
                  className="px-3.5 py-2 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 text-xs font-semibold border border-indigo-500/40 transition-all flex items-center gap-2 cursor-pointer"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span className="hidden sm:inline">{copied ? 'تم النسخ!' : 'نسخ'}</span>
                </button>

                <button
                  onClick={() => setIsFullscreen(false)}
                  title="تصغير الشاشة"
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
                >
                  <Minimize2 className="w-5 h-5" />
                </button>

                {onClose && (
                  <button
                    onClick={onClose}
                    title="إغلاق"
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>

            {/* Modal Body */}
            <div
              ref={modalContentRef}
              id="report-content-modal"
              className="p-6 sm:p-8 overflow-y-auto flex-1 leading-loose text-base text-slate-200 space-y-4 print-area"
            >
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

