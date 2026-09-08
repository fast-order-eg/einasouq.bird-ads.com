'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Facebook,
  RefreshCw,
  MessageSquare,
  Share2,
  Heart,
  Bot,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Search,
  Link as LinkIcon,
  ExternalLink,
  Zap,
  ChevronDown,
  Clapperboard,
  Video,
  Images,
  Image as ImageIcon,
  FileText,
  MousePointerClick,
  Eye,
  RotateCw,
  Database,
  Lightbulb,
  Palette,
  Edit3,
  Sparkles,
  Maximize2,
  X,
  Award,
  TrendingUp,
} from 'lucide-react';
import { formatDateArabic } from '@/lib/utils';
import ReportViewer from '@/components/ReportViewer';

// Helper to accurately identify media format
function getMediaInfo(post: any) {
  const url = post.permalink_url || '';
  const att = post.attachments?.data?.[0];
  const subCount = att?.subattachments?.data?.length || 0;

  if (url.includes('/reel/') || url.includes('/videos/') || att?.type === 'video_inline' || att?.media_type === 'video') {
    if (url.includes('/reel/')) {
      return {
        label: '🎬 فيديو ريلز (Reel)',
        icon: Clapperboard,
        badgeClass: 'text-purple-300 bg-purple-950/70 border-purple-700/80',
      };
    }
    return {
      label: '🎥 فيديو (Video)',
      icon: Video,
      badgeClass: 'text-indigo-300 bg-indigo-950/70 border-indigo-700/80',
    };
  }

  if (subCount > 1 || att?.type === 'album') {
    return {
      label: `🖼️ ألبوم (${subCount > 1 ? subCount : 'عدة'} صور)`,
      icon: Images,
      badgeClass: 'text-blue-300 bg-blue-950/70 border-blue-700/80',
    };
  }

  if (att?.media_type === 'photo' || att?.type === 'photo') {
    return {
      label: '📷 صورة واحدة',
      icon: ImageIcon,
      badgeClass: 'text-emerald-300 bg-emerald-950/70 border-emerald-700/80',
    };
  }

  return {
    label: '📝 منشور نصي',
    icon: FileText,
    badgeClass: 'text-slate-300 bg-slate-900 border-slate-700',
  };
}

// Helper to accurately identify CTA Button status
function getCtaInfo(post: any) {
  const text = (post.message || '') + ' ' + (post.attachments?.data?.[0]?.description || '');
  const attType = post.attachments?.data?.[0]?.type || '';

  if (attType.includes('direct_response') || text.includes('واتساب') || text.includes('01') || text.includes('wa.me')) {
    if (text.includes('واتساب') || text.includes('wa.me') || text.includes('واتس')) {
      return {
        label: '💬 زر / تواصل واتساب',
        badgeClass: 'text-emerald-400 bg-emerald-950/60 border-emerald-700/70',
      };
    }
    return {
      label: '📩 زر إرسال رسالة (Message)',
      badgeClass: 'text-blue-400 bg-blue-950/60 border-blue-700/70',
    };
  }

  if (text.includes('ابعت') || text.includes('رسائل') || text.includes('خاص')) {
    return {
      label: '📩 توجيه للرسائل (Inbox)',
      badgeClass: 'text-indigo-300 bg-indigo-950/60 border-indigo-700/70',
    };
  }

  if (text.includes('رابط') || text.includes('http') || text.includes('لينك')) {
    return {
      label: '🌐 رابط خارجي / موقع',
      badgeClass: 'text-violet-300 bg-violet-950/60 border-violet-700/70',
    };
  }

  return {
    label: '🚫 بدون زر (منشور عادي)',
    badgeClass: 'text-slate-400 bg-slate-900 border-slate-800',
  };
}

// Helper to format Verdict Badge Colors
function getVerdictColor(rating: string = '') {
  if (rating.includes('ممتاز')) {
    return {
      bg: 'bg-emerald-950/60 border-emerald-500/70 text-emerald-300',
      badge: 'bg-emerald-500 text-slate-950 font-extrabold',
    };
  }
  if (rating.includes('جيد جداً')) {
    return {
      bg: 'bg-blue-950/60 border-blue-500/70 text-blue-300',
      badge: 'bg-blue-500 text-white font-extrabold',
    };
  }
  if (rating.includes('جيد')) {
    return {
      bg: 'bg-indigo-950/60 border-indigo-500/70 text-indigo-300',
      badge: 'bg-indigo-500 text-white font-extrabold',
    };
  }
  if (rating.includes('ضعيف')) {
    return {
      bg: 'bg-amber-950/60 border-amber-500/70 text-amber-300',
      badge: 'bg-amber-500 text-slate-950 font-extrabold',
    };
  }
  return {
    bg: 'bg-rose-950/60 border-rose-500/70 text-rose-300',
    badge: 'bg-rose-600 text-white font-extrabold',
  };
}

export default function PagesAnalyticsPage() {
  const [pages, setPages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPage, setSelectedPage] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [visibleCount, setVisibleCount] = useState(5);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [refreshingPage, setRefreshingPage] = useState(false);
  const [refreshingPostId, setRefreshingPostId] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isFromCache, setIsFromCache] = useState(false);
  const [pageSearchQuery, setPageSearchQuery] = useState('');
  const [syncingAll, setSyncingAll] = useState(false);

  // Fullscreen Modal for PC viewing
  const [modalPost, setModalPost] = useState<any | null>(null);

  // Client-side Memory Cache for instant zero-latency switching
  const memoryCache = useRef<Record<string, { posts: any[]; analyses: Record<string, any>; strategyReport?: string }>>({});

  // Strategy Report & Single Post Analysis state
  const [analyzingStrategy, setAnalyzingStrategy] = useState(false);
  const [strategyReport, setStrategyReport] = useState<string | null>(null);
  const [analyzingPostId, setAnalyzingPostId] = useState<string | null>(null);
  const [postAnalyses, setPostAnalyses] = useState<Record<string, any>>({});

  useEffect(() => {
    // Instant cache read to eliminate any flicker when navigating back
    try {
      const cached = localStorage.getItem('adscope_managed_pages_v2');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setPages(parsed);
          setLoading(false);

          // Re-select previous page if was open
          const lastPageId = sessionStorage.getItem('adscope_last_selected_page_id');
          if (lastPageId) {
            const match = parsed.find((p: any) => p.id === lastPageId);
            if (match) {
              handleSelectPage(match, false);
            }
          }
        }
      }
    } catch (e) {}

    fetchPages(false);
  }, []);

  const fetchPages = async (forceRefresh = false) => {
    if (forceRefresh) {
      setSyncingAll(true);
    } else if (pages.length === 0) {
      setLoading(true);
    }

    try {
      const res = await fetch(`/api/pages/list${forceRefresh ? '?refresh=true' : ''}`);
      const data = await res.json();
      if (data.success && data.pages) {
        setPages(data.pages);
        try {
          localStorage.setItem('adscope_managed_pages_v2', JSON.stringify(data.pages));
        } catch (e) {}
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setSyncingAll(false);
    }
  };

  const getPostsFromLocal = (pageId: string) => {
    if (memoryCache.current[pageId]) return memoryCache.current[pageId];
    try {
      const saved = localStorage.getItem(`adscope_page_posts_${pageId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        memoryCache.current[pageId] = parsed;
        return parsed;
      }
    } catch (e) {}
    return null;
  };

  const handleSelectPage = async (page: any, isManualRefresh = false) => {
    setSelectedPage(page);
    setVisibleCount(5);
    setSearchError(null);
    try {
      sessionStorage.setItem('adscope_last_selected_page_id', page.id);
    } catch (e) {}

    // Pre-load saved audit report from DB if present
    if (page.auditReport && !isManualRefresh) {
      setStrategyReport(page.auditReport);
    } else if (!isManualRefresh) {
      setStrategyReport(null);
    }

    // 1. Instant check in Memory & Local Storage Cache (0ms delay)
    if (!isManualRefresh) {
      const localCached = getPostsFromLocal(page.id);
      if (localCached && localCached.posts && localCached.posts.length > 0) {
        setPosts(localCached.posts);
        setPostAnalyses(localCached.analyses || {});
        if (localCached.strategyReport) {
          setStrategyReport(localCached.strategyReport);
        }
        setIsFromCache(true);
        setLoadingPosts(false);
        return;
      }
    }

    if (isManualRefresh) {
      setRefreshingPage(true);
      // مسح الكاش القديم عشان التفاعلات تتحدث صح
      try {
        localStorage.removeItem(`adscope_page_posts_${page.id}`);
      } catch (e) {}
      delete memoryCache.current[page.id];
    } else {
      setLoadingPosts(true);
      setPosts([]);
    }

    try {
      const res = await fetch('/api/pages/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageId: page.id,
          pageToken: page.access_token,
          forceRefresh: isManualRefresh,
        }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        const sorted = (data.data.posts || []).sort(
          (a: any, b: any) => new Date(b.created_time).getTime() - new Date(a.created_time).getTime()
        );
        setPosts(sorted);
        setIsFromCache(!!data.data.fromDb);

        // Pre-load any existing analyses saved in MySQL DB
        const initialAnalyses: Record<string, any> = {};
        sorted.forEach((p: any) => {
          if (p.analysis) {
            initialAnalyses[p.id] = p.analysis;
          }
        });
        setPostAnalyses(initialAnalyses);

        // If DB has auditReport saved, load it
        const finalAudit = data.data.auditReport || page.auditReport;
        if (finalAudit) {
          setStrategyReport(finalAudit);
        }

        // Save to in-memory & LocalStorage cache permanently
        const cachePayload = {
          posts: sorted,
          analyses: initialAnalyses,
          strategyReport: finalAudit,
        };
        memoryCache.current[page.id] = cachePayload;
        try {
          localStorage.setItem(`adscope_page_posts_${page.id}`, JSON.stringify(cachePayload));
        } catch (e) {}
      } else {
        setSearchError(data.error || 'تعذر جلب المنشورات');
      }
    } catch (err: any) {
      console.error(err);
      setSearchError(err.message || 'فشل في تحميل منشورات الصفحة');
    } finally {
      setLoadingPosts(false);
      setRefreshingPage(false);
    }
  };

  // Refresh single post
  const handleRefreshSinglePost = async (postId: string) => {
    setRefreshingPostId(postId);
    try {
      const res = await fetch('/api/pages/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          singlePostId: postId,
          pageToken: selectedPage?.access_token,
        }),
      });
      const data = await res.json();
      if (data.success && data.post) {
        setPosts((prev) => {
          const updated = prev.map((p) => (p.id === postId ? { ...p, ...data.post } : p));
          if (selectedPage?.id && memoryCache.current[selectedPage.id]) {
            memoryCache.current[selectedPage.id].posts = updated;
          }
          return updated;
        });

        if (data.post.analysis) {
          setPostAnalyses((prev) => {
            const next = { ...prev, [postId]: data.post.analysis };
            if (selectedPage?.id && memoryCache.current[selectedPage.id]) {
              memoryCache.current[selectedPage.id].analyses = next;
            }
            return next;
          });
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setRefreshingPostId(null);
    }
  };

  // Analyze single individual post with Multimodal Image & Text via Gemini 2.5 Pro
  const handleAnalyzeSinglePost = async (post: any) => {
    if (!post.message && !post.attachments?.data?.[0]?.imageUrl) return;
    setAnalyzingPostId(post.id);

    const media = getMediaInfo(post);
    const cta = getCtaInfo(post);
    const imageUrl = post.attachments?.data?.[0]?.imageUrl;

    try {
      const res = await fetch('/api/ads/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId: post.id,
          pageId: selectedPage?.id,
          imageUrl,
          adText: `[نوع المحتوى: ${media.label} | الزر المكتشف: ${cta.label} | التفاعلات: ${post.reactions?.summary?.total_count || 0} تفاعل، ${post.comments?.summary?.total_count || 0} تعليق، ${post.views || 0} مشاهدة]\n` + (post.message || ''),
          pageName: selectedPage?.name || 'منشور فيسبوك',
        }),
      });

      const data = await res.json();
      if (data.success) {
        setPostAnalyses((prev) => {
          const next = {
            ...prev,
            [post.id]: data.analysis,
          };
          if (selectedPage?.id && memoryCache.current[selectedPage.id]) {
            memoryCache.current[selectedPage.id].analyses = next;
          }
          return next;
        });
      } else {
        alert(data.error || 'تعذر تحليل المنشور');
      }
    } catch (err: any) {
      alert('خطأ في التحليل: ' + err.message);
    } finally {
      setAnalyzingPostId(null);
    }
  };

  // Analyze Full Page Strategy & Ad Readiness Audit
  const handleAnalyzePageStrategy = async (forceReAudit = false) => {
    if (!selectedPage || posts.length === 0) return;
    setAnalyzingStrategy(true);

    try {
      const res = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageId: selectedPage.id,
          competitorName: selectedPage.name,
          forceRefresh: forceReAudit,
          pageMetrics: {
            fanCount: selectedPage.fan_count || selectedPage.fanCount || 0,
            followersCount: selectedPage.followers_count || selectedPage.fan_count || 0,
            category: selectedPage.category || 'صفحة نشاط تجاري',
            about: selectedPage.about || selectedPage.bio || '',
            bio: selectedPage.bio || selectedPage.about || '',
            coverUrl: selectedPage.coverUrl || selectedPage.cover?.source,
            pictureUrl: selectedPage.pictureUrl || selectedPage.picture?.data?.url,
            logoUrl: selectedPage.pictureUrl || selectedPage.picture?.data?.url,
            hasLogo: Boolean(selectedPage.pictureUrl || selectedPage.picture?.data?.url),
            hasCover: Boolean(selectedPage.coverUrl || selectedPage.cover?.source),
            website: selectedPage.website,
            phone: selectedPage.phone,
            whatsapp: selectedPage.whatsappNumber || selectedPage.phone,
            address: selectedPage.singleLineAddress || selectedPage.single_line_address,
          },
          ads: posts.slice(0, 12).map((p) => ({
            text: `[${getMediaInfo(p).label}] ${p.message || 'منشور وسائط'}\n(تفاعلات: ${p.reactions?.summary?.total_count || 0} إعجاب، ${p.comments?.summary?.total_count || 0} تعليق، ${p.views || 0} مشاهدة)`,
            date: p.created_time,
            format: getMediaInfo(p).label,
            engagement: `${p.reactions?.summary?.total_count || 0} إعجاب، ${p.comments?.summary?.total_count || 0} تعليق، ${p.shares?.count || 0} مشاركة`,
          })),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStrategyReport(data.report);
        setSelectedPage((prev: any) => (prev ? { ...prev, auditReport: data.report } : prev));
      } else {
        alert(data.error || 'تعذر توليد تقرير الفحص');
      }
    } catch (err: any) {
      alert('خطأ في توليد تقرير الفحص: ' + err.message);
    } finally {
      setAnalyzingStrategy(false);
    }
  };

  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + 5);
  };

  const visiblePosts = posts.slice(0, visibleCount);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Right Sidebar: Pages List */}
        <div className="lg:col-span-4 space-y-3">
          <div className="text-sm font-bold text-slate-300 px-1 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Facebook className="w-4 h-4 text-indigo-400" />
              <span>ملفاتك الشخصية وصفحاتك</span>
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-indigo-300 font-semibold border border-slate-700">
                {pages.length} صفحة
              </span>
              <button
                onClick={() => fetchPages(true)}
                disabled={syncingAll || loading}
                title="مزامنة وتحديث جميع الصفحات مع فيسبوك وحفظها في قاعدة البيانات"
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-indigo-300 transition-all border border-slate-700 flex items-center gap-1 text-xs"
              >
                <RotateCw className={`w-3.5 h-3.5 ${syncingAll ? 'animate-spin text-indigo-400' : ''}`} />
                <span className="text-[10px] hidden sm:inline">{syncingAll ? 'جاري المزامنة...' : 'مزامنة'}</span>
              </button>
            </div>
          </div>

          {/* Quick Real-Time Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={pageSearchQuery}
              onChange={(e) => setPageSearchQuery(e.target.value)}
              placeholder="ابحث باسم الصفحة أو الحساب..."
              className="w-full pr-9 pl-8 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-all shadow-inner"
            />
            {pageSearchQuery && (
              <button
                type="button"
                onClick={() => setPageSearchQuery('')}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-white"
                title="مسح البحث"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="space-y-2 max-h-[320px] lg:max-h-[720px] overflow-y-auto pr-1">
            {pages
              .filter((p) =>
                pageSearchQuery.trim() === '' ||
                p.name.toLowerCase().includes(pageSearchQuery.toLowerCase()) ||
                (p.category && p.category.toLowerCase().includes(pageSearchQuery.toLowerCase()))
              )
              .map((p) => {
                const isSelected = selectedPage?.id === p.id;
                const pageUrl = `https://www.facebook.com/${p.id}`;

                return (
                  <div
                    key={p.id}
                    onClick={() => handleSelectPage(p)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between group gap-2.5 ${
                      isSelected
                        ? 'bg-indigo-950/80 border-indigo-500 shadow-md ring-1 ring-indigo-500/30'
                        : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {/* Page Thumbnail Avatar & Name */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {p.pictureUrl ? (
                        <img
                          src={p.pictureUrl}
                          alt={p.name}
                          className="w-8 h-8 rounded-xl object-cover border border-slate-700/80 shrink-0 bg-slate-950 shadow-sm"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-900/60 to-purple-900/60 border border-indigo-700/50 flex items-center justify-center text-indigo-300 font-bold text-xs shrink-0 shadow-inner">
                          {p.name ? p.name.charAt(0) : 'P'}
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-xs sm:text-sm text-white truncate group-hover:text-indigo-300 transition-colors leading-tight">
                          {p.name}
                        </div>
                        {p.category && (
                          <div className="text-[10px] text-slate-400 truncate mt-0.5 font-medium">
                            {p.category}
                          </div>
                        )}
                      </div>
                    </div>

                    <a
                      href={pageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      title="فتح الصفحة على فيسبوك"
                      className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-indigo-400 transition-all shrink-0"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                );
              })}
            {pages.filter((p) =>
              pageSearchQuery.trim() === '' ||
              p.name.toLowerCase().includes(pageSearchQuery.toLowerCase()) ||
              (p.category && p.category.toLowerCase().includes(pageSearchQuery.toLowerCase()))
            ).length === 0 && (
              <div className="p-4 text-center text-xs text-slate-500 bg-slate-900/50 rounded-xl border border-slate-800">
                لا توجد صفحات أو حسابات مطابقة لكلمة البحث &quot;{pageSearchQuery}&quot;
              </div>
            )}
          </div>
        </div>

        {/* Left Side: Posts Feed */}
        <div className="lg:col-span-8 space-y-5">
          {selectedPage ? (
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-5 shadow-lg">
              {/* Header: Page Name + Facebook Link + Cache Badge + Sync Button + Full Strategy Button */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  {selectedPage.pictureUrl ? (
                    <img
                      src={selectedPage.pictureUrl}
                      alt={selectedPage.name}
                      className="w-10 h-10 rounded-2xl object-cover border border-slate-700 shadow-md shrink-0 bg-slate-950"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-2xl bg-indigo-950 border border-indigo-700/60 flex items-center justify-center text-indigo-300 font-bold text-sm shrink-0">
                      {selectedPage.name ? selectedPage.name.charAt(0) : 'P'}
                    </div>
                  )}

                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-white">{selectedPage.name}</h3>
                      <a
                        href={`https://www.facebook.com/${selectedPage.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="زيارة الصفحة على فيسبوك"
                        className="text-indigo-400 hover:text-indigo-300"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                    {selectedPage.category && (
                      <span className="text-[11px] text-slate-400 font-medium">{selectedPage.category}</span>
                    )}
                  </div>



                  <button
                    onClick={() => handleSelectPage(selectedPage, true)}
                    disabled={refreshingPage || loadingPosts}
                    title="تحديث وسحب أحدث المنشورات الآن"
                    className="p-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-indigo-300 transition-all border border-slate-700 flex items-center gap-1.5 text-xs font-semibold"
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${refreshingPage ? 'animate-spin text-indigo-400' : ''}`} />
                    <span>تحديث المنشورات</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleAnalyzePageStrategy(!!strategyReport)}
                    disabled={analyzingStrategy || posts.length === 0}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {analyzingStrategy ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        جاري فحص الجاهزية للإعلانات...
                      </>
                    ) : strategyReport ? (
                      <>
                        <RotateCw className="w-4 h-4 text-amber-300" />
                        إعادة فحص الجاهزية (تحديث الذكاء الاصطناعي)
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-amber-300" />
                        فحص جاهزية الصفحة للإعلانات (Ad Readiness Audit)
                      </>
                    )}
                  </button>
                </div>
              </div>

              {searchError && (
                <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-800/40 text-sm text-amber-300 flex items-center gap-2.5">
                  <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
                  <span>{searchError}</span>
                </div>
              )}

              {/* Full Page Ad Readiness Audit Report Box */}
              {strategyReport && (
                <ReportViewer
                  reportMarkdown={strategyReport}
                  pageName={selectedPage.name}
                  onClose={() => setStrategyReport(null)}
                />
              )}

              {/* Posts List */}
              <div className="space-y-4">
                {loadingPosts ? (
                  <div className="py-16 text-center text-sm text-slate-400 flex items-center justify-center gap-2.5">
                    <RefreshCw className="w-5 h-5 animate-spin text-indigo-400" />
                    جاري تحميل المنشورات والتفاعلات...
                  </div>
                ) : posts.length === 0 ? (
                  <div className="py-12 text-center text-sm text-slate-500 bg-slate-950 rounded-xl">
                    لا توجد منشورات متاحة.
                  </div>
                ) : (
                  <>
                    <div className="space-y-5">
                      {visiblePosts.map((post, idx) => {
                        const postUrl =
                          post.permalink_url || `https://www.facebook.com/${post.id}`;
                        const isAnalyzingThis = analyzingPostId === post.id;
                        const isRefreshingThis = refreshingPostId === post.id;
                        const postAnalysis = postAnalyses[post.id] || post.analysis;

                        const media = getMediaInfo(post);
                        const cta = getCtaInfo(post);

                        const totalReactions = post.reactions?.summary?.total_count || 0;
                        const totalComments = post.comments?.summary?.total_count || 0;
                        const totalShares = post.shares?.count || 0;
                        const totalViews = post.views || 0;
                        const imageUrl = post.attachments?.data?.[0]?.imageUrl;

                        const verdict = postAnalysis?.paid_ad_verdict;
                        const verdictColors = getVerdictColor(verdict?.rating || '');

                        return (
                          <div
                            key={post.id}
                            className="p-5 rounded-2xl bg-slate-950 border border-slate-800/90 space-y-4 transition-all hover:border-slate-700 shadow-sm"
                          >
                            {/* Top row: Date + Badges + Single Post Refresh + Post Link */}
                            <div className="flex flex-wrap items-center justify-between gap-3 text-xs border-b border-slate-800/60 pb-3">
                              <div className="flex flex-wrap items-center gap-2.5">
                                <span className="flex items-center gap-1.5 text-slate-400 font-medium">
                                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                                  منشور #{idx + 1} • {formatDateArabic(post.created_time)}
                                </span>

                                <span
                                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold ${media.badgeClass}`}
                                >
                                  {media.label}
                                </span>

                                <span
                                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold ${cta.badgeClass}`}
                                >
                                  <MousePointerClick className="w-3.5 h-3.5" />
                                  {cta.label}
                                </span>
                              </div>

                              <div className="flex items-center gap-2.5">
                                <button
                                  onClick={() => handleRefreshSinglePost(post.id)}
                                  disabled={isRefreshingThis}
                                  title="تحديث هذا البوست وتفاعلاته الآن"
                                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-indigo-300 transition-all"
                                >
                                  <RotateCw className={`w-3.5 h-3.5 ${isRefreshingThis ? 'animate-spin text-indigo-400' : ''}`} />
                                </button>

                                <a
                                  href={postUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="فتح هذا المنشور على فيسبوك"
                                  className="flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 font-semibold px-3 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 transition-all shrink-0"
                                >
                                  <span>رابط المنشور</span>
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              </div>
                            </div>

                            {/* Content Body: Image Thumbnail + Text */}
                            <div className="flex flex-col sm:flex-row gap-4">
                              {imageUrl && (
                                <div className="sm:w-40 shrink-0">
                                  <div
                                    onClick={() => setModalPost({ post, analysis: postAnalysis })}
                                    className="relative group cursor-pointer overflow-hidden rounded-xl border border-slate-800"
                                  >
                                    <img
                                      src={imageUrl}
                                      alt="إعلان"
                                      className="w-full h-40 object-cover group-hover:scale-105 transition-transform duration-300"
                                    />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-bold gap-1">
                                      <Maximize2 className="w-4 h-4" />
                                      <span>تكبير</span>
                                    </div>
                                  </div>
                                </div>
                              )}

                              <div className="flex-1">
                                <p className="text-sm text-slate-100 leading-relaxed whitespace-pre-line font-normal">
                                  {post.message || 'منشور وسائط / بدون نص'}
                                </p>
                              </div>
                            </div>

                            {/* Bottom row: Real Live Interactions + Single Post Analysis Button */}
                            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800/60 text-xs">
                              {/* Live Interactions */}
                              <div className="flex items-center gap-5 text-slate-300 font-bold">
                                {totalViews > 0 && (
                                  <span className="flex items-center gap-1.5 text-purple-400" title="المشاهدات">
                                    <Eye className="w-4 h-4" />
                                    {totalViews} مشاهدة
                                  </span>
                                )}
                                <span className="flex items-center gap-1.5 text-rose-400" title="التفاعلات / الإعجابات">
                                  <Heart className="w-4 h-4" />
                                  {totalReactions} تفاعل
                                </span>
                                <span className="flex items-center gap-1.5 text-blue-400" title="التعليقات">
                                  <MessageSquare className="w-4 h-4" />
                                  {totalComments} تعليق
                                </span>
                                <span className="flex items-center gap-1.5 text-emerald-400" title="المشاركات">
                                  <Share2 className="w-4 h-4" />
                                  {totalShares} شير
                                </span>
                              </div>

                              <div className="flex items-center gap-2">
                                {postAnalysis && (
                                  <button
                                    onClick={() => setModalPost({ post, analysis: postAnalysis })}
                                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all flex items-center gap-1.5 border border-slate-700"
                                    title="تكبير التحليل لشاشة كاملة على الكمبيوتر"
                                  >
                                    <Maximize2 className="w-3.5 h-3.5 text-indigo-400" />
                                    <span>تكبير التحليل ⛶</span>
                                  </button>
                                )}

                                <button
                                  onClick={() => handleAnalyzeSinglePost(post)}
                                  disabled={isAnalyzingThis}
                                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition-all disabled:opacity-50"
                                >
                                  {isAnalyzingThis ? (
                                    <>
                                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                      جاري التحليل بـ Gemini 2.5 Pro...
                                    </>
                                  ) : postAnalysis ? (
                                    <>
                                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                                      إعادة التحليل
                                    </>
                                  ) : (
                                    <>
                                      <Zap className="w-3.5 h-3.5 text-amber-300" />
                                      تحليل هذا المنشور بالذكاء
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>

                            {/* Deep Multimodal AI Breakdown (Gemini 2.5 Pro) */}
                            {postAnalysis && (
                              <div className="mt-4 p-5 rounded-2xl bg-slate-900 border border-indigo-500/50 space-y-4 text-sm animate-fadeIn shadow-inner">
                                {/* Header: Model Badge & Score */}
                                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                                  <div className="flex items-center gap-2.5">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                                    <span className="font-bold text-white text-base">
                                      تحليل الإعلان الاستراتيجي (Gemini 2.5 Pro)
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <span className="px-3 py-1 rounded-xl bg-indigo-500/20 text-indigo-300 font-extrabold text-sm border border-indigo-500/40">
                                      التقييم: {postAnalysis.observed_creative_strength_score || 8.5}/10
                                    </span>
                                  </div>
                                </div>

                                {/* Banner: Paid Ad Suitability Verdict (تقييم الجدوى للإعلان الممول) */}
                                {verdict && (
                                  <div className={`p-4 rounded-xl border ${verdictColors.bg} space-y-2`}>
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <div className="flex items-center gap-2">
                                        <Award className="w-5 h-5 shrink-0" />
                                        <span className="font-bold text-sm text-white">
                                          الحكم النهائي لجدوى الإعلان الممول:
                                        </span>
                                        <span className={`px-2.5 py-0.5 rounded-lg text-xs ${verdictColors.badge}`}>
                                          {verdict.rating}
                                        </span>
                                      </div>

                                      <span className="font-bold text-xs">
                                        {verdict.status_label}
                                      </span>
                                    </div>

                                    <p className="text-xs sm:text-sm leading-relaxed text-slate-100 font-medium pt-1">
                                      {verdict.summary}
                                    </p>
                                  </div>
                                )}

                                {/* Row 1: Hook, Offer, Audience */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                                    <span className="text-slate-400 block font-bold mb-1">🎯 الهوك:</span>
                                    <span className="text-slate-100 font-medium">{postAnalysis.hook?.text || '-'}</span>
                                  </div>
                                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                                    <span className="text-slate-400 block font-bold mb-1">🎁 العرض:</span>
                                    <span className="text-slate-100 font-medium">{postAnalysis.offer?.details || '-'}</span>
                                  </div>
                                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                                    <span className="text-slate-400 block font-bold mb-1">👥 الجمهور المستهدف:</span>
                                    <span className="text-slate-100 font-medium">{postAnalysis.audience_hypothesis || '-'}</span>
                                  </div>
                                </div>

                                {/* Row 2: Visual Analysis & Copy Analysis */}
                                {(postAnalysis.visual_analysis || postAnalysis.copy_analysis) && (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
                                    {postAnalysis.visual_analysis && (
                                      <div className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-800/40 text-purple-200">
                                        <strong className="flex items-center gap-2 text-purple-300 font-bold mb-1.5 text-sm">
                                          <Palette className="w-4 h-4" />
                                          تحليل التصميم والعناصر البصرية:
                                        </strong>
                                        <p className="text-slate-200 leading-relaxed font-normal">{postAnalysis.visual_analysis}</p>
                                      </div>
                                    )}

                                    {postAnalysis.copy_analysis && (
                                      <div className="p-3.5 rounded-xl bg-blue-950/20 border border-blue-800/40 text-blue-200">
                                        <strong className="flex items-center gap-2 text-blue-300 font-bold mb-1.5 text-sm">
                                          <Edit3 className="w-4 h-4" />
                                          تحليل النص الإعلاني (الكوبي):
                                        </strong>
                                        <p className="text-slate-200 leading-relaxed font-normal">{postAnalysis.copy_analysis}</p>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Row 3: Strengths & Weaknesses */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
                                  <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-800/40 text-emerald-300 space-y-2">
                                    <strong className="block font-bold text-sm">✅ نقاط القوة:</strong>
                                    <ul className="space-y-1.5 text-slate-200 font-normal">
                                      {postAnalysis.strengths?.map((s: string, i: number) => (
                                        <li key={i} className="flex items-start gap-1.5">
                                          <span className="text-emerald-400 font-bold">•</span>
                                          <span>{s}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>

                                  <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-800/40 text-amber-300 space-y-2">
                                    <strong className="block font-bold text-sm">⚠️ نقاط التحسين والتعديل:</strong>
                                    <ul className="space-y-1.5 text-slate-200 font-normal">
                                      {postAnalysis.weaknesses?.map((w: string, i: number) => (
                                        <li key={i} className="flex items-start gap-1.5">
                                          <span className="text-amber-400 font-bold">•</span>
                                          <span>{w}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                </div>

                                {/* Row 4: "المطلوب تنفيذه فوراً" بالعامية المصرية */}
                                {postAnalysis.action_plan && postAnalysis.action_plan.length > 0 && (
                                  <div className="p-4 rounded-xl bg-gradient-to-r from-amber-950/40 to-indigo-950/40 border border-amber-500/50 text-xs sm:text-sm space-y-2.5">
                                    <strong className="text-amber-300 flex items-center gap-2 font-bold text-sm sm:text-base">
                                      <Lightbulb className="w-5 h-5 text-amber-400" />
                                      💡 المطلوب تنفيذه فوراً لتحقيق أعلى مبيعات (بالعامية المصرية):
                                    </strong>
                                    <div className="space-y-2 pr-2">
                                      {postAnalysis.action_plan.map((act: string, i: number) => (
                                        <div key={i} className="flex items-start gap-2.5 text-slate-100">
                                          <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-bold text-xs shrink-0 mt-0.5">
                                            خطوة {i + 1}
                                          </span>
                                          <span className="font-medium leading-relaxed">{act}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Pagination */}
                    {posts.length > visibleCount && (
                      <div className="pt-3 text-center">
                        <button
                          onClick={handleLoadMore}
                          className="px-8 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold border border-slate-700 transition-all flex items-center gap-2 mx-auto shadow-md"
                        >
                          <ChevronDown className="w-4 h-4" />
                          <span>عرض المزيد (+5 منشورات أقدم)</span>
                          <span className="text-xs text-slate-400 mr-1">
                            (معروض {visibleCount} من {posts.length})
                          </span>
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="p-16 text-center rounded-3xl bg-slate-900/70 border border-slate-800 text-slate-400 space-y-4 shadow-xl flex flex-col items-center justify-center min-h-[520px]">
              <div className="p-5 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-inner">
                <Facebook className="w-12 h-12" />
              </div>
              <div className="space-y-2 max-w-md">
                <h3 className="text-xl font-bold text-white">اختر صفحة من القائمة للبدء</h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  انقر على أي صفحة من صفحاتك المدارة على اليمين لعرض منشوراتها وتفاعلاتها وإجراء فحص الجاهزية للإعلانات (Ad Readiness Audit) بالذكاء الاصطناعي.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* FULLSCREEN / EXPANDED PC MODAL */}
      {modalPost && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-8 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-5xl max-h-[92vh] rounded-2xl shadow-2xl overflow-y-auto flex flex-col">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-slate-900 z-10">
              <div className="flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                <h2 className="text-lg font-bold text-white">
                  عرض التحليل المكبر بالكامل (شاشة الكمبيوتر)
                </h2>
                <span className="text-xs px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 font-bold">
                  Gemini 2.5 Pro
                </span>
              </div>
              <button
                onClick={() => setModalPost(null)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Media & Post Text Section */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 bg-slate-950 p-5 rounded-2xl border border-slate-800">
                {modalPost.post.attachments?.data?.[0]?.imageUrl && (
                  <div className="md:col-span-4 flex justify-center">
                    <img
                      src={modalPost.post.attachments.data[0].imageUrl}
                      alt="تصميم الإعلان"
                      className="max-h-80 w-auto object-contain rounded-xl border border-slate-800 shadow-md"
                    />
                  </div>
                )}
                <div className={modalPost.post.attachments?.data?.[0]?.imageUrl ? 'md:col-span-8 space-y-3' : 'md:col-span-12 space-y-3'}>
                  <div className="flex items-center gap-3 text-xs text-slate-400 border-b border-slate-800 pb-2">
                    <span>{formatDateArabic(modalPost.post.created_time)}</span>
                    <span>•</span>
                    <span className="text-indigo-400 font-bold">{getMediaInfo(modalPost.post).label}</span>
                    <span>•</span>
                    <span className="text-emerald-400 font-bold">{getCtaInfo(modalPost.post).label}</span>
                  </div>
                  <p className="text-base text-slate-100 leading-relaxed whitespace-pre-line font-medium">
                    {modalPost.post.message || 'منشور وسائط بدون نص'}
                  </p>
                </div>
              </div>

              {/* Analysis Breakdown */}
              {modalPost.analysis ? (
                <div className="space-y-5">
                  {/* Verdict Banner */}
                  {modalPost.analysis.paid_ad_verdict && (
                    <div className={`p-5 rounded-2xl border ${getVerdictColor(modalPost.analysis.paid_ad_verdict.rating).bg} space-y-3`}>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <Award className="w-6 h-6 shrink-0" />
                          <span className="font-extrabold text-base text-white">
                            الحكم النهائي لجدوى الإعلان الممول:
                          </span>
                          <span className={`px-3 py-1 rounded-lg text-sm ${getVerdictColor(modalPost.analysis.paid_ad_verdict.rating).badge}`}>
                            {modalPost.analysis.paid_ad_verdict.rating}
                          </span>
                        </div>
                        <span className="font-bold text-sm">
                          {modalPost.analysis.paid_ad_verdict.status_label}
                        </span>
                      </div>
                      <p className="text-sm leading-relaxed text-slate-100 font-medium">
                        {modalPost.analysis.paid_ad_verdict.summary}
                      </p>
                    </div>
                  )}

                  {/* 3 Columns: Hook, Offer, Audience */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-slate-400 block font-bold text-xs mb-1">🎯 نوع وصياغة الهوك:</span>
                      <p className="text-slate-100 font-medium">{modalPost.analysis.hook?.text || '-'}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-slate-400 block font-bold text-xs mb-1">🎁 العرض التسويقي:</span>
                      <p className="text-slate-100 font-medium">{modalPost.analysis.offer?.details || '-'}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-slate-400 block font-bold text-xs mb-1">👥 الجمهور المستهدف:</span>
                      <p className="text-slate-100 font-medium">{modalPost.analysis.audience_hypothesis || '-'}</p>
                    </div>
                  </div>

                  {/* Visual & Copy Analysis */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    {modalPost.analysis.visual_analysis && (
                      <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-800/40 text-purple-200">
                        <strong className="flex items-center gap-2 text-purple-300 font-bold mb-2">
                          <Palette className="w-4 h-4" />
                          تحليل التصميم والعناصر البصرية:
                        </strong>
                        <p className="text-slate-200 leading-relaxed font-normal">{modalPost.analysis.visual_analysis}</p>
                      </div>
                    )}
                    {modalPost.analysis.copy_analysis && (
                      <div className="p-4 rounded-xl bg-blue-950/20 border border-blue-800/40 text-blue-200">
                        <strong className="flex items-center gap-2 text-blue-300 font-bold mb-2">
                          <Edit3 className="w-4 h-4" />
                          تحليل النص الإعلاني (الكوبي):
                        </strong>
                        <p className="text-slate-200 leading-relaxed font-normal">{modalPost.analysis.copy_analysis}</p>
                      </div>
                    )}
                  </div>

                  {/* Strengths & Weaknesses */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-800/40 text-emerald-300 space-y-2">
                      <strong className="block font-bold text-base">✅ نقاط القوة:</strong>
                      <ul className="space-y-2 text-slate-200">
                        {modalPost.analysis.strengths?.map((s: string, i: number) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-emerald-400 font-bold">•</span>
                            <span className="leading-relaxed">{s}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-800/40 text-amber-300 space-y-2">
                      <strong className="block font-bold text-base">⚠️ نقاط التحسين والتعديل:</strong>
                      <ul className="space-y-2 text-slate-200">
                        {modalPost.analysis.weaknesses?.map((w: string, i: number) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-amber-400 font-bold">•</span>
                            <span className="leading-relaxed">{w}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Action Plan */}
                  {modalPost.analysis.action_plan && (
                    <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-950/40 to-indigo-950/40 border border-amber-500/50 space-y-3">
                      <strong className="text-amber-300 flex items-center gap-2 font-bold text-base">
                        <Lightbulb className="w-5 h-5 text-amber-400" />
                        💡 المطلوب تنفيذه فوراً لتحقيق أعلى مبيعات (بالعامية المصرية):
                      </strong>
                      <div className="space-y-2.5 pr-2">
                        {modalPost.analysis.action_plan.map((act: string, i: number) => (
                          <div key={i} className="flex items-start gap-3 text-slate-100 text-sm">
                            <span className="px-2.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-bold text-xs shrink-0 mt-0.5">
                              خطوة {i + 1}
                            </span>
                            <span className="font-medium leading-relaxed">{act}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-10 text-slate-400">
                  لم يتم تحليل هذا المنشور بعد. اضغط على زر التحليل في الشاشة الرئيسية.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
