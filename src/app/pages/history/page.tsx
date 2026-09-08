'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Facebook,
  Bot,
  RefreshCw,
  Search,
  Sparkles,
  Calendar,
  Layers,
  FileText,
  ExternalLink,
  MessageSquare,
  Heart,
  Share2,
  Eye,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Award,
  ChevronDown,
  ChevronUp,
  X,
  Maximize2,
  ArrowRight,
} from 'lucide-react';
import { formatDateArabic } from '@/lib/utils';
import ReportViewer from '@/components/ReportViewer';

export default function PagesHistoryPage() {
  const [activeTab, setActiveTab] = useState<'PAGES' | 'POSTS'>('PAGES');
  const [pages, setPages] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & Report Viewer
  const [selectedReport, setSelectedReport] = useState<{ report: string; pageName: string } | null>(null);
  const [selectedPostAnalysis, setSelectedPostAnalysis] = useState<any | null>(null);
  const [expandedPostIds, setExpandedPostIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/pages/history');
      const data = await res.json();
      if (data.success) {
        setPages(data.pages || []);
        setPosts(data.posts || []);
      }
    } catch (e) {
      console.error('Failed to load pages history:', e);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedPostIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredPages = pages.filter((p) =>
    searchQuery.trim() === '' ||
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.category && p.category.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredPosts = posts.filter((p) =>
    searchQuery.trim() === '' ||
    p.pageName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.analysis?.summary && p.analysis.summary.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-indigo-600/20 text-indigo-400 text-xs font-bold border border-indigo-500/30 flex items-center gap-1.5">
              <Bot className="w-3.5 h-3.5" />
              أرشيف الذكاء الاصطناعي
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2.5 mt-2">
            <Layers className="w-6 h-6 text-indigo-400" />
            <span>سجلات صفحاتك ومنشوراتك</span>
          </h1>
          <p className="text-xs text-slate-400">
            جميع تقارير الفحص الشامل للجاهزية الإعلانية (Ad Readiness Audit) وتحليلات المنشورات التي قمت بها سابقاً.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/pages"
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all border border-slate-700 flex items-center gap-2 shadow-sm"
          >
            <Facebook className="w-4 h-4 text-indigo-400" />
            <span>الذهاب للملفات والصفحات</span>
          </Link>
          <button
            onClick={fetchHistory}
            disabled={loading}
            className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md flex items-center gap-1.5 text-xs font-bold cursor-pointer disabled:opacity-50"
            title="تحديث السجلات الآن"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">تحديث السجلات</span>
          </button>
        </div>
      </div>

      {/* Tabs & Search Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-4 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Switcher Tabs */}
        <div className="flex items-center gap-2 w-full sm:w-auto p-1 bg-slate-950 rounded-2xl border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('PAGES')}
            className={`flex-1 sm:flex-initial px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'PAGES'
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Facebook className="w-4 h-4" />
            <span>تقارير الصفحات المفحوصة ({pages.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('POSTS')}
            className={`flex-1 sm:flex-initial px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'POSTS'
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Bot className="w-4 h-4" />
            <span>تحليلات المنشورات الفردية ({posts.length})</span>
          </button>
        </div>

        {/* Real-Time Filter Search */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={activeTab === 'PAGES' ? 'ابحث باسم الصفحة المفحوصة...' : 'ابحث باسم الصفحة أو نص المنشور...'}
            className="w-full pr-10 pl-8 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-all shadow-inner"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="py-20 text-center space-y-3 bg-slate-900/40 rounded-3xl border border-slate-800">
          <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mx-auto" />
          <p className="text-sm text-slate-300 font-bold">جاري تحميل سجلات وتقارير صفحاتك...</p>
        </div>
      ) : activeTab === 'PAGES' ? (
        /* ── Audited Pages Grid ── */
        filteredPages.length === 0 ? (
          <div className="py-16 text-center space-y-4 bg-slate-900/40 rounded-3xl border border-slate-800 p-6">
            <Layers className="w-12 h-12 text-slate-600 mx-auto" />
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">لا توجد تقارير صفحات حتى الآن</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                اذهب إلى صفحة &quot;ملفاتك الشخصية وصفحاتك&quot; واضغط على زر &quot;فحص جاهزية الصفحة للإعلانات&quot; لتوليد تقرير شامل بالذكاء الاصطناعي وسيتم حفظه هنا تلقائياً.
              </p>
            </div>
            <Link
              href="/pages"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg transition-all"
            >
              <span>الذهاب لفحص صفحة الآن</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredPages.map((p) => (
              <div
                key={p.id}
                className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl hover:border-slate-700 transition-all flex flex-col justify-between space-y-4 group"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {p.pictureUrl ? (
                        <img
                          src={p.pictureUrl}
                          alt={p.name}
                          className="w-12 h-12 rounded-2xl object-cover border border-slate-700 shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-2xl bg-indigo-950 border border-indigo-800/80 flex items-center justify-center text-indigo-300 font-black text-lg shrink-0">
                          {p.name ? p.name.charAt(0) : 'P'}
                        </div>
                      )}
                      <div>
                        <h3 className="font-extrabold text-sm text-white group-hover:text-indigo-300 transition-colors line-clamp-1">
                          {p.name}
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                          <span className="px-2 py-0.5 rounded-md bg-slate-950 text-[10px] text-indigo-300 border border-slate-800">
                            🏷️ {p.category}
                          </span>
                          <span>👥 {Number(p.fanCount || 0).toLocaleString()} متابع</span>
                        </div>
                      </div>
                    </div>

                    <a
                      href={`https://www.facebook.com/${p.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-indigo-600/30 text-slate-400 hover:text-white transition-all shrink-0"
                      title="زيارة الصفحة على فيسبوك"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                        تاريخ الفحص:
                      </span>
                      <span className="font-semibold text-white font-mono">
                        {p.auditReportDate ? formatDateArabic(p.auditReportDate) : 'حديثاً'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>تقرير الجاهزية الإعلانية مكتمل ومحفوظ</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedReport({ report: p.auditReport, pageName: p.name })}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>عرض التقرير الكامل</span>
                  </button>

                  <Link
                    href="/pages"
                    className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all text-xs font-bold shrink-0"
                    title="فتح الصفحة لإعادة الفحص"
                  >
                    <Sparkles className="w-4 h-4 text-amber-300" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* ── Analyzed Posts Grid ── */
        filteredPosts.length === 0 ? (
          <div className="py-16 text-center space-y-4 bg-slate-900/40 rounded-3xl border border-slate-800 p-6">
            <Bot className="w-12 h-12 text-slate-600 mx-auto" />
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">لا توجد تحليلات منشورات حتى الآن</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                عند فتح أي منشور داخل &quot;ملفاتك الشخصية وصفحاتك&quot; والضغط على &quot;تحليل بالذكاء الاصطناعي&quot; سيظهر التقرير هنا بشكل دائم.
              </p>
            </div>
            <Link
              href="/pages"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg transition-all"
            >
              <span>الذهاب لتحليل منشور الآن</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredPosts.map((post) => {
              const isExpanded = expandedPostIds[post.id];
              const textLength = (post.message || '').length;

              return (
                <div
                  key={post.id}
                  className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl hover:border-slate-700 transition-all flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    {/* Page Header */}
                    <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-3">
                      <div className="flex items-center gap-2">
                        {post.pagePictureUrl ? (
                          <img
                            src={post.pagePictureUrl}
                            alt={post.pageName}
                            className="w-7 h-7 rounded-lg object-cover border border-slate-700"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-lg bg-indigo-950 flex items-center justify-center text-indigo-300 font-bold text-xs">
                            {post.pageName.charAt(0)}
                          </div>
                        )}
                        <span className="font-bold text-xs text-white truncate">{post.pageName}</span>
                      </div>

                      <span className="text-[10px] text-slate-400 font-mono">
                        {post.createdTime ? formatDateArabic(post.createdTime) : ''}
                      </span>
                    </div>

                    {/* Post Text snippet */}
                    <div className="text-xs text-slate-200 leading-relaxed font-normal">
                      {isExpanded || textLength <= 140
                        ? post.message || 'منشور وسائط بدون نص'
                        : post.message.slice(0, 140) + '...'}
                      {textLength > 140 && (
                        <button
                          type="button"
                          onClick={() => toggleExpand(post.id)}
                          className="text-[11px] text-purple-400 hover:text-purple-300 font-bold block mt-1 cursor-pointer"
                        >
                          {isExpanded ? 'عرض أقل' : 'عرض باقي المنشور'}
                        </button>
                      )}
                    </div>

                    {/* Stats & Readiness Rating Badge */}
                    <div className="flex items-center justify-between gap-2 pt-1 text-[11px]">
                      <div className="flex items-center gap-2 text-slate-400">
                        <span className="flex items-center gap-1">
                          <Heart className="w-3 h-3 text-rose-400" />
                          {post.reactionsCount || 0}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageSquare className="w-3 h-3 text-blue-400" />
                          {post.commentsCount || 0}
                        </span>
                        <span className="flex items-center gap-1">
                          <Share2 className="w-3 h-3 text-emerald-400" />
                          {post.sharesCount || 0}
                        </span>
                      </div>

                      {post.analysis?.readinessRating && (
                        <span className="px-2 py-0.5 rounded-lg bg-purple-950/80 border border-purple-500/40 text-purple-300 font-bold text-[10px]">
                          ⭐ {post.analysis.readinessRating}
                        </span>
                      )}
                    </div>

                    {/* AI Hook or Summary snippet */}
                    {post.analysis?.hookStrength && (
                      <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 font-semibold">قوة الهوك:</span>
                          <span className="text-indigo-300 font-bold">{post.analysis.hookStrength}</span>
                        </div>
                        {post.analysis.primaryRecommendation && (
                          <div className="text-amber-300/90 text-[10.5px] line-clamp-1">
                            💡 {post.analysis.primaryRecommendation}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedPostAnalysis(post)}
                      className="flex-1 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white font-bold text-xs border border-indigo-500/40 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Bot className="w-3.5 h-3.5" />
                      <span>عرض تفاصيل التحليل</span>
                    </button>

                    {post.permalinkUrl && (
                      <a
                        href={post.permalinkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all text-xs"
                        title="فتح المنشور على فيسبوك"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* ── Page Strategy Report Modal ── */}
      {selectedReport && (
        <ReportViewer
          reportMarkdown={selectedReport.report}
          pageName={selectedReport.pageName}
          onClose={() => setSelectedReport(null)}
        />
      )}

      {/* ── Single Post Analysis Modal ── */}
      {selectedPostAnalysis && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-white">تحليل المنشور الإعلاني بالذكاء الاصطناعي</h3>
                  <p className="text-xs text-slate-400">{selectedPostAnalysis.pageName}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedPostAnalysis(null)}
                className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Post Message */}
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-300 leading-relaxed max-h-32 overflow-y-auto">
              <span className="font-bold text-slate-400 block mb-1">نص المنشور:</span>
              {selectedPostAnalysis.message}
            </div>

            {/* Structured Analysis View */}
            {selectedPostAnalysis.analysis && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                    <span className="text-[11px] text-slate-400">تقييم الجاهزية:</span>
                    <div className="text-sm font-bold text-purple-300">
                      ⭐ {selectedPostAnalysis.analysis.readinessRating || 'جاهز'}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                    <span className="text-[11px] text-slate-400">قوة الهوك الافتتاحي:</span>
                    <div className="text-sm font-bold text-indigo-300">
                      🎯 {selectedPostAnalysis.analysis.hookStrength || 'متوسط'}
                    </div>
                  </div>
                </div>

                {selectedPostAnalysis.analysis.strengths && (
                  <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-800/40 text-xs space-y-1.5">
                    <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      نقاط القوة:
                    </span>
                    <p className="text-emerald-200/90 leading-relaxed font-normal">
                      {Array.isArray(selectedPostAnalysis.analysis.strengths)
                        ? selectedPostAnalysis.analysis.strengths.join(' • ')
                        : selectedPostAnalysis.analysis.strengths}
                    </p>
                  </div>
                )}

                {selectedPostAnalysis.analysis.weaknesses && (
                  <div className="p-3.5 rounded-xl bg-rose-950/20 border border-rose-800/40 text-xs space-y-1.5">
                    <span className="font-bold text-rose-400 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5" />
                      نقاط التحسين والضعف:
                    </span>
                    <p className="text-rose-200/90 leading-relaxed font-normal">
                      {Array.isArray(selectedPostAnalysis.analysis.weaknesses)
                        ? selectedPostAnalysis.analysis.weaknesses.join(' • ')
                        : selectedPostAnalysis.analysis.weaknesses}
                    </p>
                  </div>
                )}

                {selectedPostAnalysis.analysis.primaryRecommendation && (
                  <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-800/40 text-xs space-y-1.5">
                    <span className="font-bold text-amber-400 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      التوصية لتحويله إلى إعلان ممول ناجح:
                    </span>
                    <p className="text-amber-200/90 leading-relaxed font-normal">
                      {selectedPostAnalysis.analysis.primaryRecommendation}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
