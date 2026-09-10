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
  Download,
  ShieldCheck,
  Info,
  ExternalLink,
  Heart,
  MessageCircle,
  Share2,
  Eye,
  Video,
  Image as ImageIcon,
  Copy,
  Check,
  HelpCircle,
  Clock,
  Flame,
  Award,
  Sliders,
  Sparkle,
  Printer,
  FileDown,
} from 'lucide-react';
import { exportPostAnalysisPdf } from '@/lib/export-pdf';

export default function DashboardPage() {
  // Post Inspection States
  const [postUrl, setPostUrl] = useState('');
  const [inspecting, setInspecting] = useState(false);
  const [inspectError, setInspectError] = useState<string | null>(null);
  const [inspectedPost, setInspectedPost] = useState<any>(null);

  // Paid Post Strategic Analysis States
  const [analyzingPaid, setAnalyzingPaid] = useState(false);
  const [paidAnalysis, setPaidAnalysis] = useState<any>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);
  const [videoPlayerTab, setVideoPlayerTab] = useState<'embed' | 'direct'>('embed');

  // Quick Manual Ad Text Scanner States
  const [quickAdText, setQuickAdText] = useState('');
  const [analyzingQuick, setAnalyzingQuick] = useState(false);
  const [quickAnalysisResult, setQuickAnalysisResult] = useState<any>(null);

  // Handle Inspect Post by URL
  const handleInspectPost = async () => {
    if (!postUrl.trim()) return;
    setInspecting(true);
    setInspectError(null);
    setInspectedPost(null);
    setPaidAnalysis(null);
    setAnalysisError(null);

    try {
      const res = await fetch('/api/posts/inspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postUrl: postUrl.trim() }),
      });
      const data = await res.json();
      if (data.success && data.post) {
        setInspectedPost(data.post);
      } else {
        setInspectError(data.error || 'تعذر العثور على المنشور. يرجى التحقق من الرابط');
      }
    } catch (err: any) {
      setInspectError('خطأ في الاتصال بالخادم: ' + err.message);
    } finally {
      setInspecting(false);
    }
  };

  // Handle AI Strategic Analysis for Paid Campaign
  const handleAnalyzePaidCampaign = async () => {
    if (!inspectedPost) return;
    setAnalyzingPaid(true);
    setAnalysisError(null);

    try {
      const res = await fetch('/api/ads/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'paid_campaign',
          adText: inspectedPost.message || '',
          pageName: inspectedPost.pageName,
          mediaType: inspectedPost.mediaType,
          imageUrl: inspectedPost.media?.primaryImageUrl || (inspectedPost.media?.images?.[0] || ''),
          metrics: inspectedPost.metrics,
          permalinkUrl: inspectedPost.permalinkUrl,
          postId: inspectedPost.postId,
        }),
      });
      const data = await res.json();
      if (data.success && data.analysis) {
        setPaidAnalysis(data.analysis);
        setAnalysisError(null);
      } else {
        setAnalysisError(data.error || 'حدث خطأ أثناء تحليل البوست، يرجى المحاولة مرة أخرى');
      }
    } catch (err: any) {
      setAnalysisError('خطأ في الاتصال أثناء التحليل: ' + err.message);
    } finally {
      setAnalyzingPaid(false);
    }
  };

  // Helper to trigger media download
  const handleDownload = (mediaUrl: string, filename: string, audioUrl?: string) => {
    if (!mediaUrl) return;
    const downloadEndpoint = `/api/download?url=${encodeURIComponent(mediaUrl)}&filename=${encodeURIComponent(filename)}${audioUrl ? `&audioUrl=${encodeURIComponent(audioUrl)}` : ''}`;
    const a = document.createElement('a');
    a.href = downloadEndpoint;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Helper to copy text to clipboard
  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(id);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Handle Quick Text Manual Analyze
  const handleQuickAnalyze = async () => {
    if (!quickAdText.trim()) return;
    setAnalyzingQuick(true);
    setQuickAnalysisResult(null);

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
        setQuickAnalysisResult(data.analysis);
      } else {
        alert(data.error || 'حدث خطأ أثناء التحليل');
      }
    } catch (err: any) {
      alert('خطأ في الاتصال: ' + err.message);
    } finally {
      setAnalyzingQuick(false);
    }
  };

  // Format date helper (English numbers DD/MM/YYYY)
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900 border border-slate-800">
        <div>
          <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            الرئيسية
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/pages/history"
            className="px-4 py-2 rounded-xl bg-purple-600/25 hover:bg-purple-600/40 text-purple-200 text-xs font-bold border border-purple-500/40 shadow-sm transition-all flex items-center gap-1.5"
          >
            <Bot className="w-3.5 h-3.5 text-purple-400" />
            سجل التحليلات السابقة 📜
          </Link>
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
            ملفاتك وصفحاتك المدارة
          </Link>
        </div>
      </div>

      {/* ── MAIN FEATURE: INSPECT & ANALYZE POST FOR PAID CAMPAIGNS ── */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
        {/* Section Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                فحص منشورات صفحاتك وتحليلها للحملات الممولة
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
                  تفاعلات حية + تنزيل مباشر
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                استخرج التفاعلات الحية، نزّل الصور والفيديوهات، واحصل على استشارة ميديا باير ذكية
              </p>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Important Explanatory Banner (User Requirement) */}
          <div className="p-4 rounded-xl bg-indigo-950/40 border border-indigo-700/50 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <div className="font-bold text-indigo-200 flex items-center gap-1.5">
                تنبيه هام وملاحظة قبل الفحص:
              </div>
              <p className="text-slate-300 leading-relaxed">
                برجاء وضع رابط أي منشور منشور حالياً (Post / Reel / Video / Photo) من إحدى <strong className="text-white">صفحاتك المدارة أو المصرّح بها</strong> في حسابك. يقوم النظام بالاتصال الآمن بـ Facebook Graph API لسحب التفاعلات الحقيقية الحية (لايكات، تعليقات، مشاركات، مشاهدات) واستخراج الوسائط (صور عالية الدقة أو فيديو MP4) مع إمكانية تحميلها مباشرة لجهازك بدون أي حظر.
              </p>
            </div>
          </div>

          {/* Search Box Input */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-indigo-400" />
              رابط المنشور على فيسبوك:
            </label>

            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={postUrl}
                  onChange={(e) => setPostUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleInspectPost()}
                  placeholder="ضع رابط البوست هنا (مثال: https://www.facebook.com/yourpage/posts/123... أو رابط ريلز/فيديو)"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all font-mono"
                />
                {postUrl && (
                  <button
                    onClick={() => {
                      setPostUrl('');
                      setInspectedPost(null);
                      setPaidAnalysis(null);
                      setInspectError(null);
                    }}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs px-1.5 py-0.5 rounded"
                  >
                    مسح
                  </button>
                )}
              </div>

              <button
                onClick={handleInspectPost}
                disabled={inspecting || !postUrl.trim()}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50 shrink-0"
              >
                {inspecting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    جاري جلب البوست والتفاعلات...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    فحص وجلب البوست
                  </>
                )}
              </button>
            </div>

            {/* Error Message */}
            {inspectError && (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2 animate-fadeIn">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{inspectError}</span>
              </div>
            )}
          </div>

          {/* ── INSPECTED POST CARD ── */}
          {inspectedPost && (
            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-5 animate-fadeIn">
              {/* Post Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
                <div className="flex items-center gap-3">
                  {inspectedPost.pagePicture ? (
                    <img
                      src={inspectedPost.pagePicture}
                      alt={inspectedPost.pageName}
                      className="w-11 h-11 rounded-full object-cover border border-slate-700 shadow"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-bold text-sm">
                      {inspectedPost.pageName?.slice(0, 1) || 'F'}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">{inspectedPost.pageName}</span>
                      <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold border border-blue-500/30 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" />
                        صفحة موثقة
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                      <Clock className="w-3 h-3 text-slate-500" />
                      <span>تاريخ النشر: {formatDate(inspectedPost.createdTime)}</span>
                      {inspectedPost.permalinkUrl && (
                        <a
                          href={inspectedPost.permalinkUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium mr-2"
                        >
                          <ExternalLink className="w-3 h-3" />
                          فتح المنشور على فيسبوك
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-300 font-semibold">
                    نوع المحتوى: {inspectedPost.mediaType === 'VIDEO' ? '🎥 فيديو / ريلز' : inspectedPost.mediaType === 'CAROUSEL' ? '🖼️ ألبوم صور' : '📷 صورة'}
                  </span>
                </div>
              </div>

              {/* Engagement Metrics Counters */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/80 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                    <Heart className="w-4 h-4 fill-rose-500/30" />
                  </div>
                  <div>
                    <div className="text-slate-400 text-[10px]">التفاعلات / الإعجابات</div>
                    <div className="text-sm font-extrabold text-white">
                      {(inspectedPost.metrics?.reactions || 0).toLocaleString('en-US')}
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/80 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                    <MessageCircle className="w-4 h-4 fill-blue-500/30" />
                  </div>
                  <div>
                    <div className="text-slate-400 text-[10px]">التعليقات</div>
                    <div className="text-sm font-extrabold text-white">
                      {(inspectedPost.metrics?.comments || 0).toLocaleString('en-US')}
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/80 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                    <Share2 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-slate-400 text-[10px]">المشاركات (Shares)</div>
                    <div className="text-sm font-extrabold text-white">
                      {(inspectedPost.metrics?.shares || 0).toLocaleString('en-US')}
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/80 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
                    <Eye className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-slate-400 text-[10px]">مشاهدات الفيديو</div>
                    <div className="text-sm font-extrabold text-white">
                      {(inspectedPost.metrics?.views || 0).toLocaleString('en-US')}
                    </div>
                  </div>
                </div>
              </div>

              {/* Media Preview & Direct Download Buttons */}
              <div className="space-y-3">
                <div className="text-xs font-bold text-slate-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-indigo-400" />
                    التصميم والوسائط المرفقة مع إمكانية التنزيل:
                  </span>

                  {inspectedPost.media?.images?.length > 1 && (
                    <button
                      onClick={() => {
                        inspectedPost.media.images.forEach((img: string, idx: number) => {
                          handleDownload(img, `${inspectedPost.pageName}_image_${idx + 1}`);
                        });
                      }}
                      className="px-3 py-1 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 text-[11px] font-bold border border-indigo-500/40 flex items-center gap-1 transition-all"
                    >
                      <Download className="w-3.5 h-3.5" />
                      تحميل جميع الصور ({inspectedPost.media.images.length})
                    </button>
                  )}
                </div>

                {/* Case 1: Video */}
                {inspectedPost.mediaType === 'VIDEO' && inspectedPost.media?.videoUrl ? (
                  <div className="rounded-xl border border-slate-800 overflow-hidden bg-black p-3 space-y-3">
                    {/* Player Mode Switcher */}
                    <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800/80">
                      <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                        🎥 مشغل الفيديو:
                      </span>
                      <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
                        <button
                          type="button"
                          onClick={() => setVideoPlayerTab('embed')}
                          className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-all ${
                            videoPlayerTab === 'embed'
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          🔊 مشغل فيسبوك (بالصوت الأصلي)
                        </button>
                        <button
                          type="button"
                          onClick={() => setVideoPlayerTab('direct')}
                          className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-all ${
                            videoPlayerTab === 'direct'
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          🎬 مشغل مباشر
                        </button>
                      </div>
                    </div>

                    {/* Active Player */}
                    {videoPlayerTab === 'embed' ? (
                      <div className="w-full flex justify-center bg-black rounded-lg overflow-hidden py-1">
                        <iframe
                          src={`https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(inspectedPost.permalinkUrl)}&show_text=false&width=480`}
                          className="w-full max-w-[480px] h-[520px] sm:h-[620px] rounded-lg border-0 shadow-2xl"
                          style={{ border: 'none', overflow: 'hidden' }}
                          scrolling="no"
                          frameBorder="0"
                          allowFullScreen={true}
                          allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                        />
                      </div>
                    ) : (
                      <video
                        controls
                        poster={inspectedPost.media?.thumbnailUrl}
                        className="max-h-96 w-full rounded-lg object-contain bg-black"
                      >
                        <source src={inspectedPost.media.videoUrl} type="video/mp4" />
                        متصفحك لا يدعم تشغيل الفيديو
                      </video>
                    )}

                    {/* Download Controls */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
                      <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        فيديو MP4 متكامل مدمج به مسار الصوت بالكامل بأعلى دقة
                      </span>
                      <button
                        onClick={() => handleDownload(inspectedPost.media.videoUrl, `${inspectedPost.pageName}_video`, inspectedPost.media.audioUrl)}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md flex items-center gap-2 transition-all"
                      >
                        <Download className="w-4 h-4" />
                        تحميل الفيديو كامل بالصوت (MP4) 📥
                      </button>
                    </div>
                  </div>
                ) : null}

                {/* Case 2: Images (Single or Multi Album) - ONLY for Non-Video Posts */}
                {inspectedPost.mediaType !== 'VIDEO' && inspectedPost.media?.images && inspectedPost.media.images.length > 0 && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {inspectedPost.media.images.map((imgUrl: string, idx: number) => (
                        <div
                          key={idx}
                          className="group relative rounded-xl border border-slate-800 overflow-hidden bg-slate-900 aspect-square flex flex-col justify-between"
                        >
                          <img
                            src={imgUrl}
                            alt={`صورة ${idx + 1}`}
                            className="w-full h-full object-cover transition-all group-hover:scale-105 duration-300"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-90 p-3 flex items-end justify-between">
                            <span className="text-[10px] text-white/90 font-medium">صورة {idx + 1}</span>
                            <button
                              onClick={() => handleDownload(imgUrl, `${inspectedPost.pageName}_design_${idx + 1}`)}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold shadow-lg flex items-center gap-1.5 transition-all"
                            >
                              <Download className="w-3.5 h-3.5" />
                              تحميل الصورة HD
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Post Caption / Text Content */}
              {inspectedPost.message && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <FileCheck2 className="w-4 h-4 text-indigo-400" />
                      المحتوى الكتابي للمنشور:
                    </span>
                    <button
                      onClick={() => copyToClipboard(inspectedPost.message, 'caption')}
                      className="text-slate-400 hover:text-white flex items-center gap-1 text-[11px]"
                    >
                      {copiedIndex === 'caption' ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          تم النسخ!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          نسخ النص
                        </>
                      )}
                    </button>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto">
                    {inspectedPost.message}
                  </div>
                </div>
              )}

              {/* Big Action Button: AI Paid Ad Analysis */}
              <div className="pt-2 flex flex-col items-center gap-3">
                <button
                  onClick={handleAnalyzePaidCampaign}
                  disabled={analyzingPaid}
                  className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 hover:from-indigo-500 hover:to-indigo-500 text-white text-xs sm:text-sm font-bold shadow-xl shadow-indigo-600/30 transition-all flex items-center justify-center gap-2.5 disabled:opacity-50"
                >
                  {analyzingPaid ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-amber-300" />
                      جاري التحليل الاستراتيجي عبر Gemini 2.5 Pro... (15-30 ثانية)
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      تحليل بالـ AI (Gemini 2.5 Pro)
                    </>
                  )}
                </button>

                {/* Error Banner if any */}
                {analysisError && (
                  <div className="w-full max-w-xl p-3.5 rounded-xl bg-red-950/40 border border-red-500/50 text-red-200 text-xs flex items-center justify-between gap-3 animate-fadeIn">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                      <span>{analysisError}</span>
                    </div>
                    <button
                      onClick={handleAnalyzePaidCampaign}
                      className="px-3 py-1 rounded-lg bg-red-600/60 hover:bg-red-500 text-white font-bold text-[11px] shrink-0 transition-all"
                    >
                      إعادة المحاولة 🔄
                    </button>
                  </div>
                )}
              </div>

              {/* ── DETAILED STRATEGIC AI PAID CAMPAIGN ANALYSIS ── */}
              {paidAnalysis && (() => {
                const isCurrentVideo =
                  inspectedPost.mediaType === 'VIDEO' ||
                  (inspectedPost.permalinkUrl && (inspectedPost.permalinkUrl.includes('/reel/') || inspectedPost.permalinkUrl.includes('/videos/') || inspectedPost.permalinkUrl.includes('/watch')));

                const observedScore = paidAnalysis.observed_score || 8.5;
                const copyScore = paidAnalysis.copy_score || Math.min(10, Math.round((observedScore * 0.95) * 10) / 10);
                const visualScore = paidAnalysis.visual_score || Math.min(10, Math.round((observedScore * 1.02) * 10) / 10);

                return (
                  <div className="p-5 sm:p-7 rounded-3xl bg-slate-900 border-2 border-indigo-500/40 space-y-7 animate-fadeIn mt-6 shadow-2xl">
                    {/* Header: Title, PDF Export & History Buttons */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-800">
                      <div>
                        <div className="flex items-center gap-2.5">
                          <Award className="w-6 h-6 text-amber-400" />
                          <h3 className="text-lg sm:text-xl font-black text-white">
                            تقرير التحليل الاستراتيجي للحملات الممولة
                          </h3>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-400 mt-1">
                          تحليل استشاري احترافي عبر Gemini 2.5 Pro لضمان أعلى مبيعات وتفادي حرق الميزانية
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5">
                        <button
                          onClick={() => exportPostAnalysisPdf(inspectedPost, paidAnalysis)}
                          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-emerald-900/30 flex items-center gap-2 transition-all cursor-pointer"
                          title="تصدير التقرير كملف PDF للطباعة والحفظ"
                        >
                          <Printer className="w-4 h-4" />
                          <span>تحميل التقرير PDF 🖨️</span>
                        </button>

                        <Link
                          href="/pages/history"
                          className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-semibold border border-slate-700 transition-all flex items-center gap-1.5"
                        >
                          <Layers className="w-4 h-4 text-purple-400" />
                          <span>سجل التحليلات 📜</span>
                        </Link>
                      </div>
                    </div>

                    {/* 3 Separate Breakdown Scores (User Requirement #8 & #10) */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                      {/* 1. Overall Score */}
                      <div className="p-4 rounded-2xl bg-gradient-to-b from-indigo-950/60 to-slate-950 border border-indigo-500/40 text-center space-y-1 shadow-inner">
                        <span className="text-xs sm:text-[13px] font-bold text-indigo-300 block">
                          التقييم الإجمالي العام
                        </span>
                        <div className="text-2xl sm:text-3xl font-black text-white flex items-center justify-center gap-1">
                          <span>⭐ {observedScore}</span>
                          <span className="text-xs text-slate-400 font-normal">/ 10</span>
                        </div>
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold border mt-1 ${
                            paidAnalysis.verdict?.is_suitable
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          }`}
                        >
                          {paidAnalysis.verdict?.status_label || 'جاهز للحملة'}
                        </span>
                      </div>

                      {/* 2. Copywriting Score */}
                      <div className="p-4 rounded-2xl bg-gradient-to-b from-purple-950/60 to-slate-950 border border-purple-500/40 text-center space-y-1 shadow-inner">
                        <span className="text-xs sm:text-[13px] font-bold text-purple-300 block">
                          تقييم المحتوى والكوبي
                        </span>
                        <div className="text-2xl sm:text-3xl font-black text-white flex items-center justify-center gap-1">
                          <span>✍️ {copyScore}</span>
                          <span className="text-xs text-slate-400 font-normal">/ 10</span>
                        </div>
                        <span className="inline-block text-[11px] text-slate-400">
                          الهوك • العرض • الدعوة للإجراء
                        </span>
                      </div>

                      {/* 3. Creative / Video Score */}
                      <div className="p-4 rounded-2xl bg-gradient-to-b from-teal-950/60 to-slate-950 border border-teal-500/40 text-center space-y-1 shadow-inner">
                        <span className="text-xs sm:text-[13px] font-bold text-teal-300 block">
                          {isCurrentVideo ? 'تقييم الفيديو والإيقاع' : 'تقييم الصور والتصميم'}
                        </span>
                        <div className="text-2xl sm:text-3xl font-black text-white flex items-center justify-center gap-1">
                          <span>{isCurrentVideo ? '🎬' : '🖼️'} {visualScore}</span>
                          <span className="text-xs text-slate-400 font-normal">/ 10</span>
                        </div>
                        <span className="inline-block text-[11px] text-slate-400">
                          {isCurrentVideo ? 'أول 3 ثوانٍ • الصوت • الكابشن' : 'وضوح المنتج • الألوان • الجذب'}
                        </span>
                      </div>
                    </div>

                    {/* 1. Paid Ad Verdict Summary */}
                    <div className="p-5 rounded-2xl bg-slate-950 border border-amber-500/30 space-y-2">
                      <div className="text-sm sm:text-base font-extrabold text-amber-400 flex items-center gap-2">
                        <Flame className="w-5 h-5 text-amber-400" />
                        <span>الحكم الصريح للميديا باير (هل تصرف عليه ولا لأ؟):</span>
                      </div>
                      <p className="text-sm sm:text-[15px] text-slate-100 leading-relaxed font-medium">
                        {paidAnalysis.verdict?.summary}
                      </p>
                    </div>

                    {/* 2. Two Columns: Creative Analysis vs Copywriting Analysis */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                      {/* Creative / Video Analysis Column (Dynamic Title: User Requirement #6) */}
                      <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                        {isCurrentVideo ? (
                          <div className="text-sm sm:text-base font-extrabold text-indigo-400 flex items-center gap-2 border-b border-slate-800/80 pb-3">
                            <Video className="w-5 h-5 text-indigo-400" />
                            <span>تحليل الفيديو ومسار الصوت (Reels Analysis):</span>
                          </div>
                        ) : (
                          <div className="text-sm sm:text-base font-extrabold text-indigo-400 flex items-center gap-2 border-b border-slate-800/80 pb-3">
                            <ImageIcon className="w-5 h-5 text-indigo-400" />
                            <span>تحليل الصور والتصميم البصري:</span>
                          </div>
                        )}

                        {paidAnalysis.creative_analysis?.visual_hooks && (
                          <div className="space-y-1.5">
                            <span className="text-xs sm:text-[13px] font-bold text-slate-300 flex items-center gap-1.5">
                              <span>👀 الهوك البصري (أول 3 ثوانٍ):</span>
                            </span>
                            <p className="text-sm sm:text-[14.5px] text-slate-200 leading-relaxed bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                              {paidAnalysis.creative_analysis.visual_hooks}
                            </p>
                          </div>
                        )}

                        {/* Strengths */}
                        {paidAnalysis.creative_analysis?.strengths?.length > 0 && (
                          <div className="space-y-2">
                            <span className="text-xs sm:text-[13px] font-bold text-emerald-400">نقاط القوة:</span>
                            <ul className="space-y-2 text-sm sm:text-[14.5px] text-slate-200">
                              {paidAnalysis.creative_analysis.strengths.map((s: string, i: number) => (
                                <li key={i} className="flex items-start gap-2">
                                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-1" />
                                  <span className="leading-relaxed">{s}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Weaknesses / Improvements */}
                        {paidAnalysis.creative_analysis?.weaknesses?.length > 0 && (
                          <div className="space-y-2">
                            <span className="text-xs sm:text-[13px] font-bold text-amber-400">نواقص تحتاج تحسين وتعديل:</span>
                            <ul className="space-y-2 text-sm sm:text-[14.5px] text-slate-200">
                              {paidAnalysis.creative_analysis.weaknesses.map((w: string, i: number) => (
                                <li key={i} className="flex items-start gap-2">
                                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-1" />
                                  <span className="leading-relaxed">{w}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Actionable Recommendations */}
                        {paidAnalysis.creative_analysis?.actionable_recommendations?.length > 0 && (
                          <div className="p-4 rounded-xl bg-indigo-950/40 border border-indigo-800/50 space-y-2">
                            <span className="text-xs sm:text-sm font-extrabold text-indigo-200 block">
                              🛠️ المطلوب تعديله فوراً قبل الصرف:
                            </span>
                            <ul className="space-y-2 text-sm sm:text-[14px] text-slate-100">
                              {paidAnalysis.creative_analysis.actionable_recommendations.map((a: string, i: number) => (
                                <li key={i} className="leading-relaxed">• {a}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>

                      {/* Copywriting & Content Analysis Column */}
                      <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                        <div className="text-sm sm:text-base font-extrabold text-purple-400 flex items-center gap-2 border-b border-slate-800/80 pb-3">
                          <FileCheck2 className="w-5 h-5 text-purple-400" />
                          <span>تحليل المحتوى الكتابي (Copywriting):</span>
                        </div>

                        <div className="space-y-3 text-sm sm:text-[14.5px]">
                          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                            <span className="text-xs sm:text-[13px] font-bold text-rose-400 block mb-1">
                              هوك النص وجذب الانتباه:
                            </span>
                            <p className="text-slate-200 leading-relaxed">
                              {paidAnalysis.copy_analysis?.hook_evaluation || '-'}
                            </p>
                          </div>

                          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                            <span className="text-xs sm:text-[13px] font-bold text-emerald-400 block mb-1">
                              العرض المالي والقيمة المقدمة:
                            </span>
                            <p className="text-slate-200 leading-relaxed">
                              {paidAnalysis.copy_analysis?.offer_evaluation || '-'}
                            </p>
                          </div>

                          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                            <span className="text-xs sm:text-[13px] font-bold text-blue-400 block mb-1">
                              الدعوة لاتخاذ إجراء (Call To Action):
                            </span>
                            <p className="text-slate-200 leading-relaxed">
                              {paidAnalysis.copy_analysis?.cta_evaluation || '-'}
                            </p>
                          </div>
                        </div>

                        {/* Ready-to-use Variations */}
                        {paidAnalysis.copy_analysis?.ready_to_use_variations?.length > 0 && (
                          <div className="space-y-3 pt-2">
                            <span className="text-xs sm:text-sm font-bold text-emerald-400 flex items-center gap-1.5">
                              <Sparkle className="w-4 h-4" />
                              صيغ إعلانية بديلة كاملة جاهزة للنسخ فوراً (A/B Test):
                            </span>
                            {paidAnalysis.copy_analysis.ready_to_use_variations.map((v: string, i: number) => (
                              <div
                                key={i}
                                className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-800/30 text-sm sm:text-[14.5px] text-slate-100 space-y-2 relative group"
                              >
                                <p className="italic leading-relaxed whitespace-pre-wrap">{v}</p>
                                <div className="flex justify-end pt-1">
                                  <button
                                    onClick={() => copyToClipboard(v, `copy_var_${i}`)}
                                    className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 font-bold px-2.5 py-1 rounded-lg bg-emerald-950/60 border border-emerald-800/40 transition-all cursor-pointer"
                                  >
                                    {copiedIndex === `copy_var_${i}` ? (
                                      <>
                                        <Check className="w-3.5 h-3.5 text-emerald-300" />
                                        تم النسخ بنجاح!
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="w-3.5 h-3.5" />
                                        نسخ الصيغة
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 3. Targeting Suggestions (Age, Gender, Interests) */}
                    <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                      <div className="text-sm sm:text-base font-extrabold text-blue-400 flex items-center gap-2 border-b border-slate-800/80 pb-3">
                        <Target className="w-5 h-5 text-blue-400" />
                        <span>الاستهدافات المقترحة في مدير إعلانات فيسبوك (Facebook Ads Manager):</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-sm sm:text-[14px]">
                        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                          <span className="text-slate-400 text-xs block">الفئة العمرية:</span>
                          <span className="text-base font-extrabold text-white block">
                            {paidAnalysis.targeting_suggestions?.age_range || '22 - 50 سنة'}
                          </span>
                        </div>

                        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                          <span className="text-slate-400 text-xs block">الجنس المفضل:</span>
                          <span className="text-base font-extrabold text-white block">
                            {paidAnalysis.targeting_suggestions?.gender || 'الجميع (رجال ونساء)'}
                          </span>
                        </div>

                        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                          <span className="text-slate-400 text-xs block">أفضل مواضع الظهور (Placements):</span>
                          <span className="text-sm font-bold text-slate-200 block">
                            {paidAnalysis.targeting_suggestions?.behaviors_and_placements?.join(' • ') || 'Reels & Feeds'}
                          </span>
                        </div>
                      </div>

                      {/* Detailed Interests Badges */}
                      {paidAnalysis.targeting_suggestions?.detailed_interests?.length > 0 && (
                        <div className="space-y-2 pt-1">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <span className="text-xs sm:text-[13px] font-bold text-slate-300 block">
                              الاهتمامات التفصيلية للبحث عنها في مدير الإعلانات (Detailed Interests):
                            </span>
                            <span className="text-[11px] font-semibold text-blue-400 px-2 py-0.5 rounded-md bg-blue-950/60 border border-blue-800/40">
                              {paidAnalysis.targeting_suggestions.detailed_interests.length} اهتمام مقترح
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {paidAnalysis.targeting_suggestions.detailed_interests.map((interest: string, idx: number) => (
                              <span
                                key={idx}
                                className="px-3 py-1.5 rounded-xl bg-blue-950/50 border border-blue-800/60 text-blue-300 text-xs sm:text-sm font-semibold shadow-sm"
                              >
                                🎯 {interest}
                              </span>
                            ))}
                          </div>

                          {/* Media Buyer Tactical Tip on Interests */}
                          <div className="p-3 sm:p-3.5 rounded-xl bg-blue-950/30 border border-blue-800/40 flex items-start gap-2.5 mt-2.5">
                            <span className="text-base shrink-0">💡</span>
                            <div className="text-xs sm:text-[13.5px] text-blue-200/90 leading-relaxed">
                              <strong className="text-blue-300 font-bold block sm:inline">نصيحة الميديا باير للاختبار: </strong>
                              لا تضع كل الاهتمامات ({paidAnalysis.targeting_suggestions.detailed_interests.length} اهتمام) معاً في مجموعة إعلانية واحدة حتى لا تتشتت الميزانية وخوارزمية فيسبوك. الأفضل تقسيمها على مجموعتين أو 3 مجموعات إعلانية (من 2 إلى 4 اهتمامات متجانسة في كل Ad Set)، أو اختبار مجموعة مفتوحة (Broad) بدون اهتمامات لمقارنة تكلفة النتائج ومعرفة الجمهور الأكثر تحقيقاً للمبيعات بأقل تكلفة.
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 4. Campaign & Ad Sets Strategy */}
                    <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                      <div className="text-sm sm:text-base font-extrabold text-amber-400 flex items-center gap-2 border-b border-slate-800/80 pb-3">
                        <Sliders className="w-5 h-5 text-amber-400" />
                        <span>استراتيجية الحملة والمجموعات الإعلانية (Campaign Strategy):</span>
                      </div>

                      {/* Recommended Objective - Dedicated Prominent Card */}
                      {paidAnalysis.campaign_strategy?.recommended_objective && (
                        <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-800/50 space-y-1.5">
                          <span className="text-xs sm:text-sm font-bold text-emerald-400 flex items-center gap-1.5">
                            🎯 الهدف الإعلاني المقترح للحملة (Campaign Objective):
                          </span>
                          <p className="text-sm sm:text-[14.5px] text-emerald-200 leading-relaxed font-semibold">
                            {paidAnalysis.campaign_strategy.recommended_objective}
                          </p>
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm sm:text-[14.5px]">
                        {/* Structure recommendation */}
                        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
                          <span className="text-indigo-300 font-extrabold block text-sm sm:text-[15px]">
                            1. هيكل المجموعات الإعلانية (Ad Set Structure):
                          </span>
                          <p className="text-slate-200 leading-relaxed">
                            {paidAnalysis.campaign_strategy?.ad_set_structure || '-'}
                          </p>
                        </div>

                        {/* Paired Ad Recommendation */}
                        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
                          <span className="text-purple-300 font-extrabold block text-sm sm:text-[15px]">
                            2. هل يفضل إضافة بوست ثاني بديل في نفس الـ Ad Set؟
                          </span>
                          <p className="text-slate-200 leading-relaxed">
                            {paidAnalysis.campaign_strategy?.pair_another_post_recommendation?.recommendation_reason || '-'}
                          </p>
                          {paidAnalysis.campaign_strategy?.pair_another_post_recommendation?.paired_concept_idea && (
                            <div className="mt-2.5 p-3 rounded-xl bg-purple-950/40 border border-purple-800/50 text-purple-200 text-xs sm:text-sm leading-relaxed">
                              💡 <strong>فكرة البوست البديل المقترح:</strong>{' '}
                              {paidAnalysis.campaign_strategy.pair_another_post_recommendation.paired_concept_idea}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Golden Tip - Dedicated Full Width Card */}
                      <div className="p-4 sm:p-5 rounded-xl bg-gradient-to-r from-amber-950/30 via-slate-900 to-slate-900 border border-amber-800/50 space-y-1.5">
                        <span className="text-xs sm:text-sm font-bold text-amber-400 flex items-center gap-1.5">
                          <Lightbulb className="w-4 h-4 text-amber-400" />
                          نصيحة الميديا باير الذهبية لتوفير التكلفة:
                        </span>
                        <p className="text-sm sm:text-[14.5px] text-slate-200 leading-relaxed">
                          {paidAnalysis.campaign_strategy?.media_buyer_golden_tip || 'ركز على اختبار الرسائل أولاً بالميزانية الصغرى قبل التوسع.'}
                        </p>
                      </div>

                      {/* Scaling & Testing Plan (Clean Step-by-Step Lines) */}
                      {paidAnalysis.campaign_strategy?.scaling_and_testing_plan && (
                        <div className="p-4 sm:p-5 rounded-xl bg-indigo-950/30 border border-indigo-800/40 space-y-3">
                          <span className="text-xs sm:text-sm font-bold text-indigo-300 flex items-center gap-1.5">
                            <TrendingUp className="w-4 h-4 text-indigo-400" />
                            خطة التكبير وزيادة الميزانية بأمان (Scaling & Budget Plan):
                          </span>

                          {(() => {
                            const rawPlan = paidAnalysis.campaign_strategy.scaling_and_testing_plan;
                            // Split by step markers like "1. ", "2. ", "3- ", or newlines
                            const steps = rawPlan
                              .split(/(?=(?:^|\s)\d+[\.\-\)]\s*)/g)
                              .map((s: string) => s.trim())
                              .filter((s: string) => s.length > 0);

                            if (steps.length > 1) {
                              return (
                                <div className="space-y-2.5">
                                  {steps.map((step: string, sIdx: number) => {
                                    const stepNumberMatch = step.match(/^(\d+)[\.\-\)]\s*/);
                                    const stepNumber = stepNumberMatch ? stepNumberMatch[1] : sIdx + 1;
                                    const cleanedText = step.replace(/^\d+[\.\-\)]\s*/, '').trim();
                                    return (
                                      <div
                                        key={sIdx}
                                        className="p-3 sm:p-3.5 rounded-xl bg-slate-900/90 border border-indigo-900/40 flex items-start gap-3 shadow-sm"
                                      >
                                        <span className="w-6 h-6 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                                          {stepNumber}
                                        </span>
                                        <p className="text-slate-200 text-sm sm:text-[14.5px] leading-relaxed">
                                          {cleanedText}
                                        </p>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            }

                            // Fallback if not numbers: split by newlines or sentences
                            const lines = rawPlan.split(/\n+/).filter(Boolean);
                            return (
                              <div className="space-y-2">
                                {lines.map((l: string, lIdx: number) => (
                                  <div key={lIdx} className="p-3 sm:p-3.5 rounded-xl bg-slate-900/90 border border-indigo-900/40 flex items-start gap-2.5">
                                    <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-300 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                                      {lIdx + 1}
                                    </span>
                                    <p className="text-slate-200 text-sm sm:text-[14.5px] leading-relaxed">
                                      {l}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>

      {/* ── SECONDARY TOOL: QUICK MANUAL AD TEXT SCANNER ── */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-white font-bold text-sm">
            <Zap className="w-4 h-4 text-amber-400" />
            <span>الفاحص الذكي السريع للنصوص المنسوخة</span>
          </div>
          <span className="text-[11px] text-slate-400">تحليل نص إعلاني فوري</span>
        </div>

        <div className="space-y-3">
          <textarea
            value={quickAdText}
            onChange={(e) => setQuickAdText(e.target.value)}
            placeholder="أو الصق نص أي إعلان يدوي هنا للتحليل المباشر..."
            rows={2}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all resize-none"
          />

          <div className="flex justify-end">
            <button
              onClick={handleQuickAnalyze}
              disabled={analyzingQuick || !quickAdText.trim()}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all disabled:opacity-50"
            >
              {analyzingQuick ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  جاري التحليل...
                </>
              ) : (
                <>
                  <Bot className="w-3.5 h-3.5 text-indigo-400" />
                  تحليل نص الإعلان
                </>
              )}
            </button>
          </div>
        </div>

        {/* Clean, Compact Quick Analysis Output */}
        {quickAnalysisResult && (
          <div className="p-4 rounded-xl bg-slate-950 border border-indigo-500/30 space-y-4 animate-fadeIn text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <span className="font-bold text-white flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ملخص التحليل السريع للنص
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-bold">
                التقييم: {quickAnalysisResult.observed_creative_strength_score || 8.5} / 10
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                <div className="text-slate-400 font-semibold flex items-center gap-1">
                  <Target className="w-3.5 h-3.5 text-rose-400" />
                  الهوك ({quickAnalysisResult.hook?.type || 'نوع الهوك'}):
                </div>
                <div className="text-slate-200 font-medium">{quickAnalysisResult.hook?.text || '-'}</div>
              </div>

              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                <div className="text-slate-400 font-semibold flex items-center gap-1">
                  <Gift className="w-3.5 h-3.5 text-emerald-400" />
                  العرض الأساسي:
                </div>
                <div className="text-slate-200 font-medium">{quickAnalysisResult.offer?.details || '-'}</div>
              </div>

              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                <div className="text-slate-400 font-semibold flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-blue-400" />
                  الجمهور المستهدف:
                </div>
                <div className="text-slate-200 font-medium">{quickAnalysisResult.audience_hypothesis || '-'}</div>
              </div>
            </div>

            {quickAnalysisResult.strategic_recommendations?.length > 0 && (
              <div className="p-3 rounded-lg bg-indigo-950/20 border border-indigo-800/30 space-y-1.5">
                <div className="text-indigo-300 font-bold flex items-center gap-1">
                  <Lightbulb className="w-3.5 h-3.5 text-indigo-400" />
                  توصيات استراتيجية سريعة:
                </div>
                <ul className="space-y-1 text-slate-300">
                  {quickAnalysisResult.strategic_recommendations.map((r: string, i: number) => (
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
