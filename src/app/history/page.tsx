'use client';

import React, { useState, useEffect } from 'react';
import {
  History,
  Search,
  Bot,
  Calendar,
  Layers,
  ExternalLink,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Image as ImageIcon,
  Award,
  Lightbulb,
  X,
  TrendingUp,
  Video,
  ChevronDown,
  ChevronUp,
  Download,
  Copy,
  Check,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Star,
  Globe,
  Camera,
  FolderOpen,
  MessageCircle,
  MessageSquare,
  ShoppingBag,
  FileText,
  Phone,
  Link2,
  Play,
} from 'lucide-react';
import { formatDateEn } from '@/lib/utils';

interface SearchRunItem {
  id: string;
  searchTerms: string;
  countries: string;
  resultCount: number;
  executionMs: number;
  status: string;
  createdAt: string;
  samplePages: string[];
  analyzedCount: number;
}

interface AdItem {
  id: string;
  adLibraryId: string;
  pageId?: string;
  pageName: string;
  pageProfileUrl?: string;
  firstSeen?: string;
  startDate?: string;
  formattedStartDate?: string;
  daysActive?: number;
  daysActiveLabel?: string;
  status: 'ACTIVE' | 'INACTIVE';
  ctaType?: 'MESSENGER' | 'WHATSAPP' | 'PURCHASE' | 'LEADS' | 'WEBSITE' | 'CALL' | 'APP' | 'NO_BUTTON';
  ctaLabel?: string;
  publisherPlatforms: string[];
  country: string;
  primaryText: string;
  snapshotUrl: string;
  mediaType: 'IMAGE' | 'VIDEO' | 'CAROUSEL' | 'TEXT';
  imageUrl?: string;
  images?: string[];
  videoUrl?: string;
  query?: string;
  analysis?: any;
}

// ═══════════════════════════════════════════
// Helper: Format Arabic Date nicely
// ═══════════════════════════════════════════
function formatArabicDateTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    const hours = d.getHours().toString().padStart(2, '0');
    const mins = d.getMinutes().toString().padStart(2, '0');
    return `${day}/${month}/${year} • ${hours}:${mins}`;
  } catch {
    return isoString;
  }
}

// ═══════════════════════════════════════════
// Helper: CTA Badge Style & Icon
// ═══════════════════════════════════════════
function getCtaBadgeStyle(type?: string) {
  switch (type) {
    case 'WHATSAPP': return 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300';
    case 'MESSENGER': return 'bg-blue-950/80 border-blue-500/60 text-blue-300';
    case 'PURCHASE': return 'bg-purple-950/80 border-purple-500/60 text-purple-300';
    case 'LEADS': return 'bg-amber-950/80 border-amber-500/60 text-amber-300';
    case 'CALL': return 'bg-rose-950/80 border-rose-500/60 text-rose-300';
    case 'APP': return 'bg-indigo-950/80 border-indigo-500/60 text-indigo-300';
    case 'WEBSITE': return 'bg-cyan-950/80 border-cyan-500/60 text-cyan-300';
    default: return 'bg-slate-900/80 border-slate-700/80 text-slate-400';
  }
}

function renderCtaIcon(type?: string) {
  switch (type) {
    case 'WHATSAPP': return <MessageCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
    case 'MESSENGER': return <MessageSquare className="w-3.5 h-3.5 text-blue-400 shrink-0" />;
    case 'PURCHASE': return <ShoppingBag className="w-3.5 h-3.5 text-purple-400 shrink-0" />;
    case 'LEADS': return <FileText className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
    case 'CALL': return <Phone className="w-3.5 h-3.5 text-rose-400 shrink-0" />;
    case 'APP': return <Download className="w-3.5 h-3.5 text-indigo-400 shrink-0" />;
    case 'WEBSITE': return <Globe className="w-3.5 h-3.5 text-cyan-400 shrink-0" />;
    default: return <AlertCircle className="w-3.5 h-3.5 text-slate-500 shrink-0" />;
  }
}

// ═══════════════════════════════════════════
// Helper: Verdict Color
// ═══════════════════════════════════════════
function getVerdictColor(rating: string = '') {
  if (rating.includes('ممتاز')) return { bg: 'bg-emerald-950/60 border-emerald-500/70 text-emerald-300', badge: 'bg-emerald-500 text-slate-950 font-extrabold' };
  if (rating.includes('جيد جداً')) return { bg: 'bg-blue-950/60 border-blue-500/70 text-blue-300', badge: 'bg-blue-500 text-white font-extrabold' };
  if (rating.includes('جيد')) return { bg: 'bg-indigo-950/60 border-indigo-500/70 text-indigo-300', badge: 'bg-indigo-500 text-white font-extrabold' };
  if (rating.includes('ضعيف')) return { bg: 'bg-amber-950/60 border-amber-500/70 text-amber-300', badge: 'bg-amber-500 text-slate-950 font-extrabold' };
  return { bg: 'bg-rose-950/60 border-rose-500/70 text-rose-300', badge: 'bg-rose-600 text-white font-extrabold' };
}

// ═══════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════
export default function HistoryPage() {
  const [activeTab, setActiveTab] = useState<'RUNS' | 'ANALYZED'>('RUNS');
  const [runs, setRuns] = useState<SearchRunItem[]>([]);
  const [analyzedAds, setAnalyzedAds] = useState<AdItem[]>([]);
  const [searchFilter, setSearchFilter] = useState('');
  const [loading, setLoading] = useState(true);

  // Selected Run View
  const [selectedRun, setSelectedRun] = useState<SearchRunItem | null>(null);
  const [runAds, setRunAds] = useState<AdItem[]>([]);
  const [loadingRunAds, setLoadingRunAds] = useState(false);
  const [analyzingAdId, setAnalyzingAdId] = useState<string | null>(null);

  // Ad Interaction state
  const [expandedAdIds, setExpandedAdIds] = useState<Record<string, boolean>>({});
  const [carouselIndexMap, setCarouselIndexMap] = useState<Record<string, number>>({});
  const [activeModalAnalysis, setActiveModalAnalysis] = useState<{ ad: AdItem; analysis: any } | null>(null);
  const [selectedMediaAd, setSelectedMediaAd] = useState<{ ad: AdItem; imageIndex: number } | null>(null);
  const [copiedText, setCopiedText] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [darkPostModal, setDarkPostModal] = useState<any | null>(null);

  // Video error state tracking
  const [videoErrorIds, setVideoErrorIds] = useState<Record<string, boolean>>({});

  // Star / Favorite modal
  const [favoriteModalAd, setFavoriteModalAd] = useState<AdItem | null>(null);
  const [favTitle, setFavTitle] = useState('');
  const [favCategory, setFavCategory] = useState('عام');
  const [favNotes, setFavNotes] = useState('');
  const [favoritedIds, setFavoritedIds] = useState<Record<string, boolean>>({});
  const [savingFav, setSavingFav] = useState(false);
  const [savedFavSuccess, setSavedFavSuccess] = useState(false);

  // ─────────── Fetch Data ───────────
  const fetchHistory = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchFilter.trim()) params.set('search', searchFilter.trim());
      const res = await fetch(`/api/history?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setRuns(data.runs || []);
        setAnalyzedAds(data.analyzedAds || []);
      }
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
    fetch('/api/favorites')
      .then((r) => r.json())
      .then((d) => {
        if (d.success && Array.isArray(d.favorites)) {
          const map: Record<string, boolean> = {};
          d.favorites.forEach((f: any) => { map[f.adLibraryId] = true; });
          setFavoritedIds(map);
        }
      })
      .catch(console.error);
  }, []);

  // ─────────── Load Run Ads ───────────
  const handleOpenRunAds = async (run: SearchRunItem) => {
    setSelectedRun(run);
    setLoadingRunAds(true);
    try {
      const res = await fetch(`/api/history?runId=${run.id}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.ads)) {
        setRunAds(data.ads);
      } else {
        setRunAds([]);
      }
    } catch (err) {
      console.error('Failed to load run ads:', err);
      setRunAds([]);
    } finally {
      setLoadingRunAds(false);
    }
  };

  // ─────────── Delete Run ───────────
  const handleDeleteRun = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('هل أنت متأكد من حذف سجل البحث هذا؟')) return;
    try {
      const res = await fetch(`/api/history?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setRuns((prev) => prev.filter((r) => r.id !== id));
        if (selectedRun?.id === id) { setSelectedRun(null); setRunAds([]); }
      }
    } catch (err) {
      console.error('Delete run failed:', err);
    }
  };

  // ─────────── Analyze Ad ───────────
  const handleAnalyzeAd = async (ad: AdItem) => {
    if (ad.analysis) { setActiveModalAnalysis({ ad, analysis: ad.analysis }); return; }
    setAnalyzingAdId(ad.id);
    try {
      const res = await fetch('/api/ads/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adText: ad.primaryText, pageName: ad.pageName, platform: ad.publisherPlatforms[0] || 'Facebook', snapshotUrl: ad.snapshotUrl, imageUrl: ad.imageUrl, postId: ad.adLibraryId }),
      });
      const data = await res.json();
      if (data.success && data.analysis) {
        setRunAds((prev) => prev.map((a) => (a.id === ad.id ? { ...a, analysis: data.analysis } : a)));
        setActiveModalAnalysis({ ad, analysis: data.analysis });
      }
    } catch (err) {
      console.error('Analysis failed:', err);
    } finally {
      setAnalyzingAdId(null);
    }
  };

  // ─────────── Dark Post Finder ───────────
  const handleOpenRealPostFinder = (ad: AdItem) => {
    const cleanPage = (ad.pageName || '').trim();
    const cleanText = (ad.primaryText || '').trim();
    const firstLine = cleanText.split('\n')[0]?.slice(0, 45) || '';
    let baseProfile = ad.pageProfileUrl || `https://www.facebook.com/${encodeURIComponent(cleanPage)}`;
    const cleanBase = baseProfile.replace(/\/$/, '');
    const photosUrl = cleanBase.includes('profile.php') ? `${cleanBase}&sk=photos` : `${cleanBase}/photos`;
    const postsUrl = cleanBase;
    const searchFbUrl = `https://www.facebook.com/search/posts/?q=${encodeURIComponent(cleanPage + ' ' + firstLine)}`;
    setDarkPostModal({ pageName: cleanPage, pageProfileUrl: cleanBase, photosUrl, postsUrl, searchFbUrl, firstLine, snapshotUrl: ad.snapshotUrl, isCarousel: ad.mediaType === 'CAROUSEL' });
  };

  // ─────────── Favorite ───────────
  const handleOpenFavoriteModal = (e: React.MouseEvent, ad: AdItem) => {
    e.preventDefault();
    e.stopPropagation();
    setFavoriteModalAd(ad);
    const term = ad.query || selectedRun?.searchTerms || '';
    const suggestedTitle = `إعلان ${term ? term + ' - ' : ''}${ad.pageName}`.trim();
    setFavTitle(suggestedTitle || ad.pageName);
    let cat = 'عام';
    const text = ((ad.primaryText || '') + ' ' + term).toLowerCase();
    if (text.includes('بولو') || text.includes('تيشرت') || text.includes('ملابس') || text.includes('قميص') || text.includes('شوز')) cat = 'ملابس وأزياء';
    else if (text.includes('عقار') || text.includes('شقق') || text.includes('كمبوند') || text.includes('فيلا')) cat = 'عقارات';
    else if (text.includes('تسويق') || text.includes('اعلانات') || text.includes('ميديا')) cat = 'تسويق وإعلانات';
    else if (text.includes('ايفون') || text.includes('iphone') || text.includes('ساعة') || text.includes('موبايل')) cat = 'إلكترونيات وأجهزة';
    else if (text.includes('كورس') || text.includes('دورة') || text.includes('تدريب')) cat = 'تعليم وكورسات';
    else if (text.includes('مطعم') || text.includes('اكل') || text.includes('وجبة')) cat = 'مطاعم وأغذية';
    else if (text.includes('عيادة') || text.includes('اسنان') || text.includes('تجميل') || text.includes('دكتور')) cat = 'صحة وطب';
    setFavCategory(cat);
    setFavNotes('');
    setSavedFavSuccess(false);
  };

  const handleSaveFavorite = async () => {
    if (!favoriteModalAd) return;
    setSavingFav(true);
    try {
      const res = await fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adLibraryId: favoriteModalAd.adLibraryId, customTitle: favTitle, category: favCategory,
          pageName: favoriteModalAd.pageName, pageProfileUrl: favoriteModalAd.pageProfileUrl,
          primaryText: favoriteModalAd.primaryText, startDate: favoriteModalAd.startDate,
          formattedStartDate: favoriteModalAd.formattedStartDate, daysActiveLabel: favoriteModalAd.daysActiveLabel,
          status: favoriteModalAd.status, mediaType: favoriteModalAd.mediaType,
          imageUrl: favoriteModalAd.imageUrl, images: favoriteModalAd.images,
          videoUrl: favoriteModalAd.videoUrl, ctaType: favoriteModalAd.ctaType,
          ctaLabel: favoriteModalAd.ctaLabel, snapshotUrl: favoriteModalAd.snapshotUrl,
          publisherPlatforms: favoriteModalAd.publisherPlatforms, country: favoriteModalAd.country,
          analysis: favoriteModalAd.analysis, notes: favNotes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setFavoritedIds((prev) => ({ ...prev, [favoriteModalAd.adLibraryId]: true }));
        setSavedFavSuccess(true);
        setTimeout(() => { setFavoriteModalAd(null); setSavedFavSuccess(false); }, 1200);
      }
    } catch (err) {
      console.error('Save favorite failed:', err);
    } finally {
      setSavingFav(false);
    }
  };

  // ─────────── Media & Copy ───────────
  const handleDownloadMedia = async (url: string, filename: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl; a.download = filename;
      document.body.appendChild(a); a.click();
      window.URL.revokeObjectURL(blobUrl);
      document.body.removeChild(a);
    } catch (e) { window.open(url, '_blank'); }
  };

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const handleCopySnippet = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  const toggleExpand = (id: string) => setExpandedAdIds((prev) => ({ ...prev, [id]: !prev[id] }));

  const handleNextCarouselImage = (e: React.MouseEvent, adId: string, total: number) => {
    e.stopPropagation();
    setCarouselIndexMap((prev) => ({ ...prev, [adId]: ((prev[adId] || 0) + 1) % total }));
  };

  const handlePrevCarouselImage = (e: React.MouseEvent, adId: string, total: number) => {
    e.stopPropagation();
    setCarouselIndexMap((prev) => ({ ...prev, [adId]: ((prev[adId] || 0) - 1 + total) % total }));
  };

  // ═══════════════════════════════════════════
  // Reusable Ad Card Component
  // ═══════════════════════════════════════════
  const renderAdCard = (ad: AdItem) => {
    const isExpanded = expandedAdIds[ad.id];
    const textLength = ad.primaryText.length;
    const displayText = isExpanded ? ad.primaryText : ad.primaryText.slice(0, 180);
    const isAnalyzingThis = analyzingAdId === ad.id;
    const hasAnalysis = Boolean(ad.analysis);

    // Media resolution
    const imagesList = ad.images && ad.images.length > 0 ? ad.images : (ad.imageUrl ? [ad.imageUrl] : []);
    const currentImgIdx = carouselIndexMap[ad.id] || 0;
    const activeImageSrc = imagesList[currentImgIdx] || ad.imageUrl;

    const hasPlayableVideo = Boolean(ad.videoUrl) && !videoErrorIds[ad.id];
    const isVideoAd = ad.mediaType === 'VIDEO';

    return (
      <div
        key={ad.id}
        className="rounded-3xl bg-slate-900/85 border border-slate-800 hover:border-purple-500/40 transition-all flex flex-col justify-between overflow-hidden shadow-xl hover:shadow-2xl group"
      >
        {/* ── Top: Page Info & Meta ── */}
        <div className="p-4 border-b border-slate-800/70 space-y-2.5 bg-slate-900/40">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-bold text-white group-hover:text-purple-300 transition-colors truncate">
                  {ad.pageName}
                </h3>
                <a
                  href={ad.pageProfileUrl || `https://www.facebook.com/search/pages/?q=${encodeURIComponent(ad.pageName)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="p-1 rounded-md bg-slate-800 hover:bg-indigo-600/30 text-slate-400 hover:text-white transition-all shrink-0"
                  title="زيارة صفحة المنافس على فيسبوك"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="w-3 h-3 text-indigo-400" />
                </a>
              </div>
              <div className="space-y-1 mt-1.5 text-[11px]">
                <div className="flex items-center gap-1 text-slate-300">
                  <span className="text-slate-400">تاريخ الإعلان:</span>
                  <span className="font-bold text-white font-mono">{formatDateEn(ad.formattedStartDate || ad.startDate)}</span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="px-2 py-0.5 rounded-md bg-purple-950/70 border border-purple-500/30 text-purple-300 text-[10.5px] font-medium">
                    ⏱️ {ad.daysActiveLabel || 'مؤرشف'}
                  </span>
                  <span className="text-slate-500 font-mono text-[10px]">ID: {ad.adLibraryId}</span>
                  {isVideoAd && (
                    <span className="px-2 py-0.5 rounded-md bg-rose-950/80 border border-rose-500/40 text-rose-300 text-[10px] font-bold flex items-center gap-1">
                      <Video className="w-3 h-3 text-rose-400" />
                      فيديو
                    </span>
                  )}
                  {ad.mediaType === 'CAROUSEL' && (
                    <span className="px-2 py-0.5 rounded-md bg-purple-950/80 border border-purple-500/40 text-purple-300 text-[10px] font-bold">
                      🎠 كاروسيل
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Star Button */}
            <button
              type="button"
              onClick={(e) => handleOpenFavoriteModal(e, ad)}
              className={`p-1.5 rounded-xl border transition-all cursor-pointer ${
                favoritedIds[ad.adLibraryId]
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                  : 'bg-slate-800/80 hover:bg-amber-500/20 border-slate-700/80 text-slate-400 hover:text-amber-300'
              }`}
              title={favoritedIds[ad.adLibraryId] ? 'محفوظ في المفضلة ⭐' : 'إضافة للمفضلة ⭐'}
            >
              <Star className={`w-3.5 h-3.5 ${favoritedIds[ad.adLibraryId] ? 'fill-amber-400 text-amber-400' : ''}`} />
            </button>
          </div>

          {/* Platforms */}
          <div className="flex items-center gap-1 text-[10px] text-slate-400">
            <span className="text-slate-500">المنصات:</span>
            {ad.publisherPlatforms.map((p) => (
              <span key={p} className="px-1.5 py-0.5 rounded bg-slate-950 text-slate-300 border border-slate-800">{p}</span>
            ))}
          </div>
        </div>

        {/* ── Media Preview ── */}
        <div className="relative w-full h-52 bg-slate-950 overflow-hidden border-b border-slate-800/70 group/media flex items-center justify-center">
          {hasPlayableVideo ? (
            <div className="relative w-full h-full flex items-center justify-center bg-black">
              <video
                controls
                playsInline
                preload="metadata"
                poster={activeImageSrc}
                className="max-h-full max-w-full object-contain"
                onError={() => setVideoErrorIds((prev) => ({ ...prev, [ad.id]: true }))}
              >
                <source src={ad.videoUrl} type="video/mp4" />
                <source src={ad.videoUrl} />
              </video>
              <button
                type="button"
                onClick={() => setSelectedMediaAd({ ad, imageIndex: 0 })}
                className="absolute top-2 left-2 p-1.5 rounded-lg bg-black/80 hover:bg-black text-white text-[11px] font-bold flex items-center gap-1 shadow-md transition-all cursor-pointer z-10"
                title="تكبير الفيديو"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : isVideoAd && activeImageSrc ? (
            /* ── Video Ad with Poster image (Click to view full video on FB) ── */
            <div
              className="relative w-full h-full cursor-pointer flex items-center justify-center bg-slate-950 group/vid"
              onClick={() => setSelectedMediaAd({ ad, imageIndex: 0 })}
            >
              <img
                src={activeImageSrc}
                alt={ad.pageName}
                className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-500"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-slate-950/30 flex items-center justify-center transition-all">
                <div className="w-12 h-12 rounded-full bg-indigo-600/90 hover:bg-indigo-500 text-white flex items-center justify-center shadow-2xl group-hover/vid:scale-110 transition-transform">
                  <Play className="w-6 h-6 fill-white ml-0.5" />
                </div>
              </div>
              <div className="absolute top-2 right-2 px-2.5 py-1 rounded-xl bg-black/85 backdrop-blur-sm border border-slate-700 text-white text-[10.5px] font-bold flex items-center gap-1.5 z-10 shadow-lg">
                <Video className="w-3.5 h-3.5 text-rose-400" />
                <span>فيديو إعلاني</span>
              </div>
              <div className="absolute bottom-2 inset-x-2 opacity-0 group-hover/vid:opacity-100 transition-opacity flex justify-center z-10">
                <span className="px-3 py-1.5 rounded-xl bg-slate-900/95 text-white text-xs font-bold flex items-center gap-1.5 shadow-xl border border-slate-700">
                  <Maximize2 className="w-3.5 h-3.5 text-indigo-400" />
                  معاينة الفيديو
                </span>
              </div>
            </div>
          ) : activeImageSrc ? (
            <div
              className="relative w-full h-full cursor-pointer flex items-center justify-center bg-slate-950"
              onClick={() => setSelectedMediaAd({ ad, imageIndex: currentImgIdx })}
            >
              <img
                src={activeImageSrc}
                alt={ad.pageName}
                className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-500"
                loading="lazy"
              />
              {imagesList.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={(e) => handlePrevCarouselImage(e, ad.id, imagesList.length)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/80 hover:bg-black text-white transition-all shadow-md z-10"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleNextCarouselImage(e, ad.id, imagesList.length)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/80 hover:bg-black text-white transition-all shadow-md z-10"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-black/80 text-white text-[10px] font-mono z-10">
                    {currentImgIdx + 1} / {imagesList.length}
                  </div>
                </>
              )}
              <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover/media:opacity-100 transition-opacity flex items-center justify-center">
                <span className="px-3 py-1.5 rounded-xl bg-slate-900/90 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg border border-slate-700">
                  <Maximize2 className="w-3.5 h-3.5 text-indigo-400" />
                  تكبير وحفظ
                </span>
              </div>
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-600 text-xs">إعلان نصي بدون وسائط</div>
          )}
        </div>

        {/* ── Ad Copy Body ── */}
        <div className="p-4 flex-1 space-y-2">
          <div className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap font-normal">
            {displayText}
            {textLength > 180 && !isExpanded && '...'}
          </div>
          {textLength > 180 && (
            <button
              type="button"
              onClick={() => toggleExpand(ad.id)}
              className="text-[11px] text-purple-400 hover:text-purple-300 font-semibold flex items-center gap-1 pt-1 cursor-pointer"
            >
              <span>{isExpanded ? 'عرض أقل' : `عرض باقي الإعلان (${textLength} حرف)`}</span>
              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>

        {/* ── Footer Actions — Same as Discovery Page ── */}
        <div className="p-3.5 border-t border-slate-800/70 bg-slate-950/70 space-y-2.5">
          {/* Row 1: CTA Badge + Real Post Link */}
          <div className="flex items-center justify-between gap-2">
            <div
              className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border flex items-center gap-1.5 truncate ${getCtaBadgeStyle(ad.ctaType)}`}
              title={`هدف الإعلان: ${ad.ctaLabel || 'بدون زر تفاعلي'}`}
            >
              {renderCtaIcon(ad.ctaType)}
              <span className="truncate">{ad.ctaLabel || 'بدون زر تفاعلي'}</span>
            </div>

            <button
              type="button"
              onClick={() => handleOpenRealPostFinder(ad)}
              className="px-2.5 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 hover:border-indigo-500/50 text-indigo-300 hover:text-white transition-all text-[11px] font-bold flex items-center gap-1 shrink-0 cursor-pointer shadow-sm"
              title="فتح خيارات الوصول للمنشور الحقيقي"
            >
              <Link2 className="w-3 h-3 text-indigo-400" />
              <span>رابط المنشور</span>
            </button>
          </div>

          {/* Row 2: AI Analyze + Facebook Snapshot */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleAnalyzeAd(ad)}
              disabled={isAnalyzingThis}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                hasAnalysis
                  ? 'bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-500/50 text-emerald-300'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20'
              }`}
            >
              {isAnalyzingThis ? (
                <><RefreshCw className="w-3.5 h-3.5 animate-spin" /><span>جاري التحليل...</span></>
              ) : hasAnalysis ? (
                <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /><span>عرض التحليل الذكي ✨</span></>
              ) : (
                <><Bot className="w-3.5 h-3.5" /><span>تحليل بـ Gemini 2.5 Pro</span></>
              )}
            </button>

            {/* مكتبة الإعلانات */}
            <a
              href={ad.snapshotUrl}
              target="_blank" rel="noopener noreferrer"
              className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white transition-all flex items-center justify-center shrink-0"
              title="فتح في مكتبة إعلانات فيسبوك"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="w-4 h-4 text-indigo-400" />
            </a>

            {/* تحميل */}
            {(ad.videoUrl || activeImageSrc) && (
              <button
                type="button"
                onClick={() => {
                  const src = ad.videoUrl || activeImageSrc!;
                  handleDownloadMedia(src, `ad_${ad.adLibraryId}.${ad.videoUrl ? 'mp4' : 'jpg'}`);
                }}
                className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white transition-all flex items-center justify-center shrink-0"
                title="تحميل الصورة أو الفيديو"
              >
                <Download className="w-4 h-4 text-purple-400" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════
  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/30 flex items-center gap-1">
              <History className="w-3 h-3 text-purple-400" />
              أرشيف استعلامات مكتبة الإعلانات والتحليلات
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            سجلات البحث والتحليلات المحفوظة
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            استعراض فوري لجميع عمليات البحث السابقة والإعلانات المستخرجة وتحليلات الذكاء الاصطناعي المخزنة بقاعدة البيانات بدون أي انتظار.
          </p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => { setActiveTab('RUNS'); setSelectedRun(null); }}
          className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'RUNS'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <FolderOpen className="w-4 h-4" />
          <span>عمليات البحث السابقة ({runs.length})</span>
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('ANALYZED'); setSelectedRun(null); }}
          className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'ANALYZED'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Bot className="w-4 h-4 text-emerald-300" />
          <span>الإعلانات المحللة بالذكاء الاصطناعي ({analyzedAds.length})</span>
        </button>
      </div>

      {/* ─── SELECTED RUN: Show ads of a run ─── */}
      {selectedRun ? (
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* Run Header */}
          <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSelectedRun(null)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
                title="الرجوع لقائمة السجلات"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-purple-400 font-bold">نتائج البحث المحفوظة:</span>
                  <span className="text-lg font-black text-white">«{selectedRun.searchTerms}»</span>
                  <span className="text-xs px-2 py-0.5 rounded-md bg-slate-800 text-slate-300">
                    {selectedRun.countries === 'EG' ? '🇪🇬 مصر' : selectedRun.countries}
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-1 flex items-center gap-3">
                  <span>تاريخ البحث: {formatArabicDateTime(selectedRun.createdAt)}</span>
                  <span>•</span>
                  <span>{runAds.length} إعلان محفوظ</span>
                </div>
              </div>
            </div>
          </div>

          {loadingRunAds ? (
            <div className="py-20 text-center space-y-4 rounded-3xl bg-slate-900/40 border border-slate-800/80">
              <RefreshCw className="w-10 h-10 text-purple-400 animate-spin mx-auto" />
              <p className="text-sm font-bold text-white">جاري استرجاع الإعلانات من قاعدة البيانات...</p>
            </div>
          ) : runAds.length === 0 ? (
            <div className="py-20 text-center space-y-2 rounded-3xl bg-slate-900/40 border border-slate-800/80">
              <p className="text-base font-bold text-white">لا توجد إعلانات مخزنة لهذا السجل</p>
              <p className="text-xs text-slate-400">الإعلانات تُحفظ فقط عند البحث الأول — السجلات القديمة قبل التحديث لا تحمل snapshots.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 xl:gap-6.5">
              {runAds.map((ad) => renderAdCard(ad))}
            </div>
          )}
        </div>
      ) : activeTab === 'RUNS' ? (
        /* ─── RUNS LIST ─── */
        <div className="space-y-4">
          {loading ? (
            <div className="py-20 text-center space-y-4 rounded-3xl bg-slate-900/40 border border-slate-800/80">
              <RefreshCw className="w-10 h-10 text-purple-400 animate-spin mx-auto" />
              <p className="text-sm font-bold text-white">جاري تحميل سجلات البحث السابقة...</p>
            </div>
          ) : runs.length === 0 ? (
            <div className="py-20 text-center space-y-3 rounded-3xl bg-slate-900/40 border border-slate-800/80 p-8">
              <History className="w-12 h-12 text-slate-600 mx-auto" />
              <h3 className="text-base font-bold text-white">لا توجد عمليات بحث مسجلة حتى الآن</h3>
              <p className="text-xs text-slate-400">أي عملية بحث تقوم بها في صفحة «بحث الإعلانات» ستُحفظ تلقائياً هنا للرجوع الفوري لها.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {runs.map((run) => (
                <div
                  key={run.id}
                  onClick={() => handleOpenRunAds(run)}
                  className="p-5 rounded-3xl bg-slate-900/85 border border-slate-800 hover:border-purple-500/50 hover:bg-slate-850 transition-all cursor-pointer shadow-lg hover:shadow-2xl flex flex-col justify-between group"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-[11px] font-bold text-purple-400 mb-0.5">كلمة البحث:</div>
                        <h3 className="text-base font-black text-white group-hover:text-purple-300 transition-colors">
                          «{run.searchTerms}»
                        </h3>
                      </div>
                      <span className="px-2.5 py-1 rounded-xl bg-purple-950/70 border border-purple-500/30 text-purple-300 text-xs font-black">
                        {run.resultCount} إعلان
                      </span>
                    </div>

                    {run.samplePages.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-[10.5px] text-slate-400">أبرز صفحات المنافسين:</div>
                        <div className="flex flex-wrap gap-1">
                          {run.samplePages.map((p, i) => (
                            <span key={i} className="px-2 py-0.5 rounded-md bg-slate-950 text-slate-300 text-[10.5px] border border-slate-800">
                              {p}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="pt-4 mt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      <span>{formatArabicDateTime(run.createdAt)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {run.analyzedCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-950/70 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
                          ✨ {run.analyzedCount} مفكَّك
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => handleDeleteRun(run.id, e)}
                        className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-950/60 text-slate-500 hover:text-rose-400 transition-all cursor-pointer"
                        title="حذف هذا السجل"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* ─── ANALYZED ADS LIST ─── */
        <div className="space-y-4">
          {analyzedAds.length === 0 ? (
            <div className="py-20 text-center space-y-3 rounded-3xl bg-slate-900/40 border border-slate-800/80 p-8">
              <Bot className="w-12 h-12 text-slate-600 mx-auto" />
              <h3 className="text-base font-bold text-white">لا توجد إعلانات مفككة حتى الآن</h3>
              <p className="text-xs text-slate-400">اضغط على «تحليل بـ Gemini» على أي إعلان وسيُحفظ هنا للمراجعة الدائمة.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 xl:gap-6.5">
              {analyzedAds.map((ad) => renderAdCard(ad))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          MODALS — All same as discovery page
          ════════════════════════════════════════════════════ */}

      {/* Favorite Modal */}
      {favoriteModalAd && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white font-bold text-base">
                <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
                <span>حفظ الإعلان في المفضلة ⭐</span>
              </div>
              <button type="button" onClick={() => setFavoriteModalAd(null)} className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            {savedFavSuccess ? (
              <div className="py-6 text-center space-y-2">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto animate-bounce" />
                <p className="text-sm font-bold text-white">تم الحفظ في المفضلة بنجاح! ⭐</p>
                <p className="text-xs text-slate-400">ستجده دائماً في صفحة «المفضلة» حتى لو انتهى الإعلان</p>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-slate-300 font-bold block mb-1">اسم الإعلان:</label>
                  <input type="text" value={favTitle} onChange={(e) => setFavTitle(e.target.value)} className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-amber-500" />
                </div>
                <div>
                  <label className="text-slate-300 font-bold block mb-1">المجال / التصنيف:</label>
                  <input type="text" value={favCategory} onChange={(e) => setFavCategory(e.target.value)} className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-amber-500" />
                </div>
                <div>
                  <label className="text-slate-300 font-bold block mb-1">ملاحظاتك (اختياري):</label>
                  <textarea value={favNotes} onChange={(e) => setFavNotes(e.target.value)} placeholder="سبب إعجابك بالإعلان، الهوك، نقاط القوة..." rows={3} className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-amber-500" />
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setFavoriteModalAd(null)} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-bold cursor-pointer">إلغاء</button>
                  <button type="button" onClick={handleSaveFavorite} disabled={savingFav} className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md cursor-pointer">
                    {savingFav ? 'جاري الحفظ...' : 'حفظ في المفضلة ⭐'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Real Post Finder Modal */}
      {darkPostModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
                  <Link2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">الوصول للمنشور التفاعلي على فيسبوك</h3>
                  <p className="text-xs text-slate-400 font-semibold">{darkPostModal.pageName}</p>
                </div>
              </div>
              <button type="button" onClick={() => setDarkPostModal(null)} className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {darkPostModal.isCarousel && (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200">
                <div className="font-extrabold text-amber-300 flex items-center gap-1.5 mb-1">
                  <span>🎠</span><span>إعلان كاروسيل — Dark Post محتمل</span>
                </div>
                <p className="text-[11.5px] text-slate-300 leading-relaxed">إعلانات الكاروسيل تُنشأ عبر مدير الإعلانات وتكون Dark Posts بنسبة 99%.</p>
              </div>
            )}

            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-[11px] text-slate-400">نص المنشور:</div>
                <div className="text-xs font-bold text-white truncate mt-0.5">«{darkPostModal.firstLine}»</div>
              </div>
              <button type="button" onClick={() => handleCopySnippet(darkPostModal.firstLine)} className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold flex items-center gap-1 shrink-0 cursor-pointer">
                {copiedSnippet ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedSnippet ? 'تم النسخ!' : 'نسخ النص'}</span>
              </button>
            </div>

            <div className="space-y-2.5 pt-1">
              <a href={darkPostModal.searchFbUrl} target="_blank" rel="noopener noreferrer" className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-extrabold text-xs sm:text-sm flex items-center justify-between transition-all shadow-lg group">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-xl bg-white/20"><Search className="w-4 h-4 text-white" /></div>
                  <div className="text-right">
                    <div>🔍 فتح وبحث فوري عن المنشور بحسابك</div>
                    <div className="text-[10px] font-normal text-indigo-100 opacity-90">يفتح البحث التفاعلي في فيسبوك</div>
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 shrink-0" />
              </a>

              <a href={darkPostModal.photosUrl} target="_blank" rel="noopener noreferrer" className="w-full py-3 px-4 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-between transition-all border border-slate-700">
                <div className="flex items-center gap-2"><Camera className="w-4 h-4 text-emerald-400" /><span>📷 فتح ألبوم صور الصفحة</span></div>
                <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
              </a>

              <a href={darkPostModal.postsUrl} target="_blank" rel="noopener noreferrer" className="w-full py-2.5 px-4 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white font-bold text-xs flex items-center justify-between transition-all border border-slate-800">
                <div className="flex items-center gap-2"><Globe className="w-4 h-4 text-indigo-400" /><span>📝 تصفح تايم لاين الصفحة الكامل</span></div>
                <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
              </a>

              <a href={darkPostModal.snapshotUrl} target="_blank" rel="noopener noreferrer" className="w-full py-2.5 px-4 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white font-bold text-xs flex items-center justify-between transition-all border border-slate-800/80">
                <div className="flex items-center gap-2"><Layers className="w-4 h-4 text-purple-400" /><span>فتح لقطة الإعلان الرسمية بمكتبة فيسبوك</span></div>
                <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Media Lightbox Modal */}
      {selectedMediaAd && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-3xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-sm">{selectedMediaAd.ad.pageName}</span>
                <span className="text-slate-400 text-xs">• {formatDateEn(selectedMediaAd.ad.formattedStartDate || selectedMediaAd.ad.startDate)}</span>
              </div>
              <button type="button" onClick={() => setSelectedMediaAd(null)} className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative flex-1 bg-black p-3 flex items-center justify-center overflow-auto min-h-[380px]">
              {selectedMediaAd.ad.videoUrl && !videoErrorIds[selectedMediaAd.ad.id] ? (
                <div className="w-full flex items-center justify-center py-2">
                  <video
                    controls
                    autoPlay
                    playsInline
                    poster={selectedMediaAd.ad.imageUrl}
                    className="max-h-[72vh] w-auto max-w-full object-contain rounded-2xl shadow-2xl bg-black"
                    onError={() => setVideoErrorIds((prev) => ({ ...prev, [selectedMediaAd.ad.id]: true }))}
                  >
                    <source src={selectedMediaAd.ad.videoUrl} type="video/mp4" />
                    <source src={selectedMediaAd.ad.videoUrl} />
                  </video>
                </div>
              ) : selectedMediaAd.ad.mediaType === 'VIDEO' ? (
                /* Video ad without active mp4 link or expired link: Show high-res poster and Direct FB watch CTA */
                <div className="relative w-full h-full flex flex-col items-center justify-center gap-4 py-6">
                  {selectedMediaAd.ad.imageUrl && (
                    <img
                      src={selectedMediaAd.ad.imageUrl}
                      alt={selectedMediaAd.ad.pageName}
                      className="max-h-[55vh] max-w-full object-contain rounded-2xl shadow-2xl border border-slate-800"
                    />
                  )}
                  <div className="text-center space-y-2 max-w-md">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-950/80 border border-rose-500/40 text-rose-300 text-xs font-bold">
                      <Video className="w-3.5 h-3.5 text-rose-400" />
                      <span>فيديو إعلاني (Facebook Ad Video)</span>
                    </div>
                    <p className="text-xs text-slate-300">
                      يمكنك تشغيل ومشاهدة الفيديو بجودته الأصلية بالكامل مع الصوت المباشر من مكتبة إعلانات فيسبوك:
                    </p>
                    <a
                      href={selectedMediaAd.ad.snapshotUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs sm:text-sm shadow-xl transition-all"
                    >
                      <Play className="w-4 h-4 fill-white" />
                      <span>مشاهدة الفيديو على مكتبة فيسبوك الرسمية</span>
                      <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                    </a>
                  </div>
                </div>
              ) : (() => {
                const imgs = selectedMediaAd.ad.images && selectedMediaAd.ad.images.length > 0 ? selectedMediaAd.ad.images : [selectedMediaAd.ad.imageUrl!];
                const currentIdx = selectedMediaAd.imageIndex;
                const curImg = imgs[currentIdx] || imgs[0];
                return (
                  <div className="relative w-full h-full flex items-center justify-center">
                    <img src={curImg} alt={selectedMediaAd.ad.pageName} className="max-h-[72vh] max-w-full object-contain rounded-2xl shadow-2xl" />
                    {imgs.length > 1 && (
                      <>
                        <button type="button" onClick={() => setSelectedMediaAd((prev) => prev ? { ...prev, imageIndex: (prev.imageIndex - 1 + imgs.length) % imgs.length } : null)} className="absolute right-4 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/80 hover:bg-black text-white transition-all shadow-xl cursor-pointer z-10">
                          <ChevronRight className="w-5 h-5" />
                        </button>
                        <button type="button" onClick={() => setSelectedMediaAd((prev) => prev ? { ...prev, imageIndex: (prev.imageIndex + 1) % imgs.length } : null)} className="absolute left-4 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/80 hover:bg-black text-white transition-all shadow-xl cursor-pointer z-10">
                          <ChevronLeft className="w-5 h-5" />
                        </button>
                        <div className="absolute top-4 right-4 px-3 py-1 rounded-lg bg-black/80 text-white text-xs font-mono z-10">{currentIdx + 1} / {imgs.length}</div>
                      </>
                    )}
                  </div>
                );
              })()}
            </div>

            <div className="p-4 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {(selectedMediaAd.ad.imageUrl || selectedMediaAd.ad.videoUrl) && (
                  <button type="button" onClick={() => {
                    const imgs = selectedMediaAd.ad.images && selectedMediaAd.ad.images.length > 0 ? selectedMediaAd.ad.images : [selectedMediaAd.ad.imageUrl!];
                    const src = selectedMediaAd.ad.videoUrl || imgs[selectedMediaAd.imageIndex] || selectedMediaAd.ad.imageUrl || '';
                    handleDownloadMedia(src, `ad_${selectedMediaAd.ad.adLibraryId}.${selectedMediaAd.ad.videoUrl ? 'mp4' : 'jpg'}`);
                  }} className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer">
                    <Download className="w-4 h-4" /><span>تحميل 💾</span>
                  </button>
                )}
                <button type="button" onClick={() => handleCopyText(selectedMediaAd.ad.primaryText)} className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1.5 cursor-pointer">
                  {copiedText ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedText ? 'تم النسخ!' : 'نسخ نص الإعلان'}</span>
                </button>
              </div>
              <a href={selectedMediaAd.ad.snapshotUrl} target="_blank" rel="noopener noreferrer" className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs flex items-center gap-1.5">
                <ExternalLink className="w-3.5 h-3.5 text-indigo-400" /><span>مكتبة الإعلانات</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* AI Analysis Modal */}
      {activeModalAnalysis && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-800 flex items-start justify-between gap-4 bg-slate-950/60">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">تحليل الذكاء الاصطناعي</span>
                  <span className="text-slate-400 text-xs">• {activeModalAnalysis.ad.pageName}</span>
                </div>
                <h3 className="text-lg font-bold text-white">التقرير التحليلي الاستراتيجي للإعلان (Gemini 2.5 Pro)</h3>
              </div>
              <button type="button" onClick={() => setActiveModalAnalysis(null)} className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm text-slate-300">
              {activeModalAnalysis.analysis.paid_ad_verdict && (
                <div className={`p-5 rounded-2xl border ${getVerdictColor(activeModalAnalysis.analysis.paid_ad_verdict.rating).bg} space-y-2`}>
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-white text-base flex items-center gap-2"><Award className="w-5 h-5" /><span>حكم وتقييم الإعلان للميديا باير</span></span>
                    <span className={`px-3 py-1 rounded-full text-xs ${getVerdictColor(activeModalAnalysis.analysis.paid_ad_verdict.rating).badge}`}>
                      {activeModalAnalysis.analysis.paid_ad_verdict.status_label || activeModalAnalysis.analysis.paid_ad_verdict.rating}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed opacity-95">{activeModalAnalysis.analysis.paid_ad_verdict.summary}</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-2">
                  <div className="text-xs text-indigo-400 font-bold flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-rose-400" /><span>نوع الهوك:</span></div>
                  <div className="text-sm font-bold text-white">{activeModalAnalysis.analysis.hook?.type || 'هوك مباشر'}</div>
                  <p className="text-xs text-slate-400 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">"{activeModalAnalysis.analysis.hook?.text || activeModalAnalysis.ad.primaryText.slice(0, 80)}"</p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-2">
                  <div className="text-xs text-purple-400 font-bold flex items-center gap-1.5"><TrendingUp className="w-4 h-4" /><span>العرض التجاري:</span></div>
                  <div className="text-sm font-bold text-white">{activeModalAnalysis.analysis.offer?.type || 'عرض بيع مباشر'}</div>
                  <p className="text-xs text-slate-400 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">{activeModalAnalysis.analysis.offer?.details || 'عرض تنافسي'}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-900/40 space-y-2">
                  <div className="text-xs text-emerald-400 font-bold flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /><span>نقاط القوة:</span></div>
                  <ul className="space-y-1 text-xs text-slate-300 list-disc list-inside">
                    {(activeModalAnalysis.analysis.strengths || ['وضوح العرض']).map((s: string, idx: number) => <li key={idx}>{s}</li>)}
                  </ul>
                </div>
                <div className="p-4 rounded-2xl bg-rose-950/20 border border-rose-900/40 space-y-2">
                  <div className="text-xs text-rose-400 font-bold flex items-center gap-1.5"><AlertCircle className="w-4 h-4" /><span>نقاط الضعف:</span></div>
                  <ul className="space-y-1 text-xs text-slate-300 list-disc list-inside">
                    {(activeModalAnalysis.analysis.weaknesses || ['عدم إبراز ضمانات']).map((w: string, idx: number) => <li key={idx}>{w}</li>)}
                  </ul>
                </div>
              </div>

              {activeModalAnalysis.analysis.action_plan && (
                <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="text-xs text-indigo-400 font-bold flex items-center gap-1.5"><Lightbulb className="w-4 h-4 text-amber-400" /><span>خطة التغلب على هذا الإعلان:</span></div>
                  <div className="space-y-2 text-xs text-slate-300">
                    <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800"><span className="font-bold text-indigo-300">1. الهوك: </span>{activeModalAnalysis.analysis.action_plan.step_1_hook}</div>
                    <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800"><span className="font-bold text-indigo-300">2. العرض: </span>{activeModalAnalysis.analysis.action_plan.step_2_offer}</div>
                    <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800"><span className="font-bold text-indigo-300">3. الاستهداف: </span>{activeModalAnalysis.analysis.action_plan.step_3_execution}</div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
              <a href={activeModalAnalysis.ad.snapshotUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-slate-400 hover:text-white flex items-center gap-1">
                <span>فتح على مكتبة فيسبوك</span><ExternalLink className="w-3 h-3" />
              </a>
              <button type="button" onClick={() => setActiveModalAnalysis(null)} className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer">إغلاق</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
