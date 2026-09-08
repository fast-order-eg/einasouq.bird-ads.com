'use client';

import React, { useState, useEffect } from 'react';
import {
  Search,
  Bot,
  Globe,
  Layers,
  Sparkles,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Award,
  Lightbulb,
  CheckCircle2,
  AlertCircle,
  X,
  TrendingUp,
  Image as ImageIcon,
  Video,
  Download,
  Copy,
  Check,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Star,
  Camera,
  MessageCircle,
  MessageSquare,
  ShoppingBag,
  FileText,
  Phone,
  Link2,
  Play,
  Wand2,
  ArrowDown,
} from 'lucide-react';
import { formatDateEn } from '@/lib/utils';

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
}

interface CreativeAnalysisSchema {
  hook: { type: string; text: string };
  offer: { present: boolean; type: string; details: string };
  problem_addressed: string;
  benefit_promised: string;
  audience_hypothesis: string;
  cta: string;
  funnel_stage: string;
  observed_creative_strength_score: number;
  paid_ad_verdict?: {
    rating: 'ممتاز' | 'جيد جداً' | 'جيد' | 'ضعيف' | 'سيء جداً';
    status_label: string;
    summary: string;
  };
  visual_analysis: string;
  copy_analysis: string;
  strengths: string[];
  weaknesses: string[];
  action_plan?: {
    step_1_hook: string;
    step_2_offer: string;
    step_3_execution: string;
  };
  strategic_recommendations: string[];
}

interface NicheAngle {
  category: string;
  keywords: string[];
}

function getVerdictColor(rating: string = '') {
  if (rating.includes('ممتاز')) return { bg: 'bg-emerald-950/60 border-emerald-500/70 text-emerald-300', badge: 'bg-emerald-500 text-slate-950 font-extrabold' };
  if (rating.includes('جيد جداً')) return { bg: 'bg-blue-950/60 border-blue-500/70 text-blue-300', badge: 'bg-blue-500 text-white font-extrabold' };
  if (rating.includes('جيد')) return { bg: 'bg-indigo-950/60 border-indigo-500/70 text-indigo-300', badge: 'bg-indigo-500 text-white font-extrabold' };
  if (rating.includes('ضعيف')) return { bg: 'bg-amber-950/60 border-amber-500/70 text-amber-300', badge: 'bg-amber-500 text-slate-950 font-extrabold' };
  return { bg: 'bg-rose-950/60 border-rose-500/70 text-rose-300', badge: 'bg-rose-600 text-white font-extrabold' };
}

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

export default function DiscoveryPage() {
  const [searchTerms, setSearchTerms] = useState('');
  const [country, setCountry] = useState('EG');
  const [statusFilter, setStatusFilter] = useState<'ACTIVE' | 'ALL'>('ACTIVE');
  const [mediaFilter, setMediaFilter] = useState<'ALL' | 'IMAGE' | 'VIDEO'>('ALL');
  const [ads, setAds] = useState<AdItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // AI Niche Assistant State
  const [nichePrompt, setNichePrompt] = useState('');
  const [isGeneratingKeywords, setIsGeneratingKeywords] = useState(false);
  const [isGeneratingMoreKeywords, setIsGeneratingMoreKeywords] = useState(false);
  const [aiSuggestedKeywords, setAiSuggestedKeywords] = useState<string[]>([]);
  const [aiExplanation, setAiExplanation] = useState('');
  const [aiAngles, setAiAngles] = useState<NicheAngle[]>([]);
  const [activeSelectedKeyword, setActiveSelectedKeyword] = useState<string | null>(null);

  // Pagination / Load More state
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasReachedEnd, setHasReachedEnd] = useState(false);
  const [metaEstimatedTotal, setMetaEstimatedTotal] = useState<string | null>(null);

  // Analysis state
  const [analyzingAdId, setAnalyzingAdId] = useState<string | null>(null);
  const [analysisMap, setAnalysisMap] = useState<Record<string, CreativeAnalysisSchema>>({});
  const [activeModalAnalysis, setActiveModalAnalysis] = useState<{ ad: AdItem; analysis: CreativeAnalysisSchema } | null>(null);

  // Expanded copies
  const [expandedAdIds, setExpandedAdIds] = useState<Record<string, boolean>>({});

  // Carousel indices
  const [carouselIndexMap, setCarouselIndexMap] = useState<Record<string, number>>({});

  // Active playing videos on demand (saves internet bandwidth)
  const [playingVideoIds, setPlayingVideoIds] = useState<Record<string, boolean>>({});

  const handlePlayInlineVideo = (e: React.MouseEvent, adId: string) => {
    e.stopPropagation();
    setPlayingVideoIds((prev) => ({ ...prev, [adId]: true }));
  };

  // Media Lightbox Modal
  const [selectedMediaAd, setSelectedMediaAd] = useState<{ ad: AdItem; imageIndex: number } | null>(null);
  const [copiedText, setCopiedText] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  // Real Post Finder Modal
  const [darkPostModal, setDarkPostModal] = useState<any | null>(null);

  // Favorites state
  const [favoriteModalAd, setFavoriteModalAd] = useState<AdItem | null>(null);
  const [favTitle, setFavTitle] = useState('');
  const [favCategory, setFavCategory] = useState('عام');
  const [favNotes, setFavNotes] = useState('');
  const [favoritedIds, setFavoritedIds] = useState<Record<string, boolean>>({});
  const [savingFav, setSavingFav] = useState(false);
  const [savedFavSuccess, setSavedFavSuccess] = useState(false);

  // ─────────── Load Saved Session on Mount ───────────
  useEffect(() => {
    try {
      // 1. Search session
      const saved = sessionStorage.getItem('adscope_last_search');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.searchTerms) setSearchTerms(parsed.searchTerms);
        if (parsed.country) setCountry(parsed.country);
        if (parsed.statusFilter) setStatusFilter(parsed.statusFilter);
        if (parsed.mediaFilter) setMediaFilter(parsed.mediaFilter);
        if (parsed.metaEstimatedTotal) setMetaEstimatedTotal(parsed.metaEstimatedTotal);
        if (Array.isArray(parsed.ads) && parsed.ads.length > 0) {
          setAds(parsed.ads);
          setHasSearched(true);
        }
      }

      // 2. AI Niche Assistant session
      const savedAi = sessionStorage.getItem('adscope_ai_niche_state');
      if (savedAi) {
        const parsedAi = JSON.parse(savedAi);
        if (parsedAi.nichePrompt) setNichePrompt(parsedAi.nichePrompt);
        if (Array.isArray(parsedAi.suggestedKeywords)) setAiSuggestedKeywords(parsedAi.suggestedKeywords);
        if (parsedAi.explanation) setAiExplanation(parsedAi.explanation);
        if (Array.isArray(parsedAi.angles)) setAiAngles(parsedAi.angles);
        if (parsedAi.activeSelectedKeyword) setActiveSelectedKeyword(parsedAi.activeSelectedKeyword);
      }
    } catch (e) {
      console.warn('Failed to restore session state:', e);
    }

    // 3. Load favorites list for stars
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

  // ─────────── Save Search State ───────────
  const saveSearchState = (
    term: string,
    currentAds: AdItem[],
    currentCountry: string,
    currentStatus: string,
    currentMedia: string,
    metaTotal?: string | null
  ) => {
    try {
      sessionStorage.setItem(
        'adscope_last_search',
        JSON.stringify({
          searchTerms: term,
          country: currentCountry,
          statusFilter: currentStatus,
          mediaFilter: currentMedia,
          ads: currentAds,
          metaEstimatedTotal: metaTotal !== undefined ? metaTotal : metaEstimatedTotal,
          hasSearched: true,
        })
      );
    } catch (e) {
      console.warn('Failed to save search state:', e);
    }
  };

  // ─────────── Save AI Niche State ───────────
  const saveAiNicheState = (prompt: string, keywords: string[], explanation: string, angles: NicheAngle[], selected: string | null) => {
    try {
      sessionStorage.setItem(
        'adscope_ai_niche_state',
        JSON.stringify({
          nichePrompt: prompt,
          suggestedKeywords: keywords,
          explanation,
          angles,
          activeSelectedKeyword: selected,
        })
      );
    } catch (e) {}
  };

  // ─────────── Reset Search ───────────
  const handleResetSearch = () => {
    setSearchTerms('');
    setAds([]);
    setHasSearched(false);
    setAnalysisMap({});
    setExpandedAdIds({});
    setCarouselIndexMap({});
    setActiveSelectedKeyword(null);
    try {
      sessionStorage.removeItem('adscope_last_search');
    } catch (e) {}
  };

  // ─────────── Clear AI Niche Box ───────────
  const handleClearAiNiche = () => {
    setNichePrompt('');
    setAiSuggestedKeywords([]);
    setAiExplanation('');
    setAiAngles([]);
    setActiveSelectedKeyword(null);
    try {
      sessionStorage.removeItem('adscope_ai_niche_state');
    } catch (e) {}
  };

  // ─────────── AI Generate Niche Keywords ───────────
  const handleGenerateNicheKeywords = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!nichePrompt.trim() || isGeneratingKeywords) return;

    setIsGeneratingKeywords(true);
    try {
      const res = await fetch('/api/ads/suggest-keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: nichePrompt.trim(), country }),
      });

      const data = await res.json();
      if (data.success && Array.isArray(data.suggestedTerms)) {
        setAiSuggestedKeywords(data.suggestedTerms);
        setAiExplanation(data.explanation || '');
        setAiAngles(data.angles || []);
        saveAiNicheState(nichePrompt.trim(), data.suggestedTerms, data.explanation || '', data.angles || [], null);
      }
    } catch (err) {
      console.error('Failed to generate AI keywords:', err);
    } finally {
      setIsGeneratingKeywords(false);
    }
  };

  // ─────────── AI Generate More / Alternative Keywords ───────────
  const handleGenerateMoreKeywords = async () => {
    if (!nichePrompt.trim() || isGeneratingMoreKeywords || isGeneratingKeywords) return;

    setIsGeneratingMoreKeywords(true);
    try {
      const res = await fetch('/api/ads/suggest-keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: nichePrompt.trim(),
          country,
          excludeTerms: aiSuggestedKeywords,
        }),
      });

      const data = await res.json();
      if (data.success && Array.isArray(data.suggestedTerms) && data.suggestedTerms.length > 0) {
        const uniqueNewTerms = data.suggestedTerms.filter((t: string) => !aiSuggestedKeywords.includes(t));
        const combinedTerms = [...aiSuggestedKeywords, ...(uniqueNewTerms.length > 0 ? uniqueNewTerms : data.suggestedTerms)];

        const combinedAngles = [...(aiAngles || [])];
        if (Array.isArray(data.angles)) {
          data.angles.forEach((newAng: NicheAngle) => {
            const existing = combinedAngles.find((a) => a.category === newAng.category);
            if (existing) {
              existing.keywords = Array.from(new Set([...existing.keywords, ...newAng.keywords]));
            } else {
              combinedAngles.push(newAng);
            }
          });
        }

        setAiSuggestedKeywords(combinedTerms);
        setAiExplanation(data.explanation || aiExplanation);
        setAiAngles(combinedAngles);
        saveAiNicheState(nichePrompt.trim(), combinedTerms, data.explanation || aiExplanation, combinedAngles, activeSelectedKeyword);
      }
    } catch (err) {
      console.error('Failed to generate more AI keywords:', err);
    } finally {
      setIsGeneratingMoreKeywords(false);
    }
  };

  // ─────────── Perform Live Search ───────────
  const handleSearch = async (overrideTerm?: string) => {
    const termToSearch = (overrideTerm ?? searchTerms).trim();
    if (!termToSearch) return;

    if (overrideTerm) {
      setSearchTerms(overrideTerm);
      setActiveSelectedKeyword(overrideTerm);
      saveAiNicheState(nichePrompt, aiSuggestedKeywords, aiExplanation, aiAngles, overrideTerm);
    }

    setLoading(true);
    setHasSearched(true);
    setHasReachedEnd(false);

    try {
      const res = await fetch('/api/ads/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          searchTerms: termToSearch,
          query: termToSearch,
          country,
          adActiveStatus: statusFilter,
          activeStatus: statusFilter,
          mediaType: mediaFilter,
          limit: 50,
        }),
      });

      const data = await res.json();
      if (data.success && Array.isArray(data.ads)) {
        setAds(data.ads);
        const metaTotal = data.metaEstimatedTotal || null;
        setMetaEstimatedTotal(metaTotal);
        saveSearchState(termToSearch, data.ads, country, statusFilter, mediaFilter, metaTotal);
        setHasReachedEnd(false);
      } else {
        setAds([]);
        setMetaEstimatedTotal(null);
        saveSearchState(termToSearch, [], country, statusFilter, mediaFilter, null);
        setHasReachedEnd(true);
      }
    } catch (err) {
      console.error('Search failed:', err);
      setAds([]);
    } finally {
      setLoading(false);
    }
  };

  // ─────────── Load More Ads (Pagination on Demand) ───────────
  const handleLoadMore = async () => {
    const termToSearch = searchTerms.trim();
    if (!termToSearch || isLoadingMore || loading) return;

    setIsLoadingMore(true);
    try {
      const targetLimit = Math.max(ads.length + 50, 90);
      const res = await fetch('/api/ads/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          searchTerms: termToSearch,
          query: termToSearch,
          country,
          adActiveStatus: statusFilter,
          activeStatus: statusFilter,
          mediaType: mediaFilter,
          limit: targetLimit,
        }),
      });

      const data = await res.json();
      if (data.success && Array.isArray(data.ads)) {
        const metaTotal = data.metaEstimatedTotal || metaEstimatedTotal;
        if (metaTotal) setMetaEstimatedTotal(metaTotal);

        // Find newly discovered unique ads
        const existingLibraryIds = new Set(ads.map((a) => a.adLibraryId));
        const newlyFetchedAds = data.ads.filter((a: AdItem) => !existingLibraryIds.has(a.adLibraryId));

        if (newlyFetchedAds.length > 0) {
          const mergedAds = [...ads, ...newlyFetchedAds];
          setAds(mergedAds);
          saveSearchState(termToSearch, mergedAds, country, statusFilter, mediaFilter, metaTotal);
          setHasReachedEnd(false);
        } else {
          setHasReachedEnd(true);
        }
      } else {
        setHasReachedEnd(true);
      }
    } catch (err) {
      console.error('Load more failed:', err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // ─────────── Analyze Ad with Gemini ───────────
  const handleAnalyzeAd = async (ad: AdItem) => {
    if (analysisMap[ad.id]) {
      setActiveModalAnalysis({ ad, analysis: analysisMap[ad.id] });
      return;
    }

    setAnalyzingAdId(ad.id);
    try {
      const res = await fetch('/api/ads/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adText: ad.primaryText,
          pageName: ad.pageName,
          platform: ad.publisherPlatforms[0] || 'Facebook',
          snapshotUrl: ad.snapshotUrl,
          imageUrl: ad.imageUrl,
          postId: ad.adLibraryId,
        }),
      });

      const data = await res.json();
      if (data.success && data.analysis) {
        setAnalysisMap((prev) => ({ ...prev, [ad.id]: data.analysis }));
        setActiveModalAnalysis({ ad, analysis: data.analysis });
      }
    } catch (err) {
      console.error('Analysis failed:', err);
    } finally {
      setAnalyzingAdId(null);
    }
  };

  // ─────────── Real Post Finder ───────────
  const handleOpenRealPostFinder = (ad: AdItem) => {
    const cleanPage = (ad.pageName || '').trim();
    const cleanText = (ad.primaryText || '').trim();
    const firstLine = cleanText.split('\n')[0]?.slice(0, 45) || '';
    let baseProfile = ad.pageProfileUrl || ('https://www.facebook.com/' + encodeURIComponent(cleanPage));
    const cleanBase = baseProfile.replace(/\/$/, '');
    const photosUrl = cleanBase.includes('profile.php') ? (cleanBase + '&sk=photos') : (cleanBase + '/photos');
    const postsUrl = cleanBase;
    const searchFbUrl = 'https://www.facebook.com/search/posts/?q=' + encodeURIComponent(cleanPage + ' ' + firstLine);
    setDarkPostModal({
      pageName: cleanPage,
      pageProfileUrl: cleanBase,
      photosUrl,
      postsUrl,
      searchFbUrl,
      firstLine,
      snapshotUrl: ad.snapshotUrl,
      isCarousel: ad.mediaType === 'CAROUSEL',
    });
  };

  // ─────────── Favorite Modal ───────────
  const handleOpenFavoriteModal = (e: React.MouseEvent, ad: AdItem) => {
    e.preventDefault();
    e.stopPropagation();
    setFavoriteModalAd(ad);
    const suggestedTitle = ('إعلان ' + (searchTerms ? searchTerms + ' - ' : '') + ad.pageName).trim();
    setFavTitle(suggestedTitle || ad.pageName);

    let cat = 'عام';
    const text = ((ad.primaryText || '') + ' ' + searchTerms).toLowerCase();
    if (text.includes('بولو') || text.includes('تيشرت') || text.includes('ملابس') || text.includes('قميص') || text.includes('شوز')) cat = 'ملابس وأزياء';
    else if (text.includes('عقار') || text.includes('شقق') || text.includes('كمبوند') || text.includes('فيلا')) cat = 'عقارات';
    else if (text.includes('حشرات') || text.includes('رش') || text.includes('ابادة') || text.includes('مكافحة')) cat = 'خدمات وإبادة حشرات';
    else if (text.includes('تسويق') || text.includes('اعلانات') || text.includes('ميديا')) cat = 'تسويق وإعلانات';
    else if (text.includes('ايفون') || text.includes('iphone') || text.includes('ساعة') || text.includes('موبايل')) cat = 'إلكترونيات وأجهزة';
    else if (text.includes('كورس') || text.includes('دورة') || text.includes('الماني') || text.includes('تعليم')) cat = 'تعليم وكورسات';
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
          adLibraryId: favoriteModalAd.adLibraryId,
          customTitle: favTitle,
          category: favCategory,
          pageName: favoriteModalAd.pageName,
          pageProfileUrl: favoriteModalAd.pageProfileUrl,
          primaryText: favoriteModalAd.primaryText,
          startDate: favoriteModalAd.startDate,
          formattedStartDate: favoriteModalAd.formattedStartDate,
          daysActiveLabel: favoriteModalAd.daysActiveLabel,
          status: favoriteModalAd.status,
          mediaType: favoriteModalAd.mediaType,
          imageUrl: favoriteModalAd.imageUrl,
          images: favoriteModalAd.images,
          videoUrl: favoriteModalAd.videoUrl,
          ctaType: favoriteModalAd.ctaType,
          ctaLabel: favoriteModalAd.ctaLabel,
          snapshotUrl: favoriteModalAd.snapshotUrl,
          publisherPlatforms: favoriteModalAd.publisherPlatforms,
          country: favoriteModalAd.country,
          analysis: analysisMap[favoriteModalAd.id] || null,
          notes: favNotes,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setFavoritedIds((prev) => ({ ...prev, [favoriteModalAd.adLibraryId]: true }));
        setSavedFavSuccess(true);
        setTimeout(() => {
          setFavoriteModalAd(null);
          setSavedFavSuccess(false);
        }, 1200);
      }
    } catch (err) {
      console.error('Save favorite failed:', err);
    } finally {
      setSavingFav(false);
    }
  };

  // ─────────── Download & Copy ───────────
  const handleDownloadMedia = async (url: string, filename: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(blobUrl);
      document.body.removeChild(a);
    } catch (e) {
      window.open(url, '_blank');
    }
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

  const toggleExpand = (id: string) => {
    setExpandedAdIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleNextCarouselImage = (e: React.MouseEvent, adId: string, total: number) => {
    e.stopPropagation();
    setCarouselIndexMap((prev) => ({ ...prev, [adId]: ((prev[adId] || 0) + 1) % total }));
  };

  const handlePrevCarouselImage = (e: React.MouseEvent, adId: string, total: number) => {
    e.stopPropagation();
    setCarouselIndexMap((prev) => ({ ...prev, [adId]: ((prev[adId] || 0) - 1 + total) % total }));
  };

  const activeAdsCount = ads.filter((a) => a.status === 'ACTIVE').length;

  return (
    <div className="space-y-6 pb-16">
      {/* ── Page Header (Clean, Subtitle Removed) ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              ⚡ محرك مكتبة إعلانات فيسبوك الرسمية (Meta Ad Library)
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              تحليل Gemini 2.5 Pro
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            استكشاف وتحليل إعلانات المنافسين
          </h1>
        </div>

        {hasSearched && (
          <button
            onClick={handleResetSearch}
            className="px-4 py-2 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-300 hover:text-white text-xs font-bold flex items-center gap-2 transition-all cursor-pointer self-start md:self-auto shadow-md"
            title="مسح نتائج البحث والبدء من جديد"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
            <span>إعادة ضبط البحث</span>
          </button>
        )}
      </div>

      {/* ── 🔥 NEW: AI Niche & Keyword Discovery Hub ── */}
      <div className="bg-gradient-to-br from-indigo-950/70 via-slate-900/90 to-purple-950/60 border border-indigo-500/40 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400">
              <Wand2 className="w-5 h-5 text-indigo-400 animate-pulse" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-white flex items-center gap-2">
                <span>مساعد استخراج الكلمات المفتاحية بالذكاء الاصطناعي</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  AI Smart Prompt
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                اكتب أي مجال أو نشاط تريده وسيقوم الذكاء الاصطناعي بالتفكير واستخراج أدق الكلمات الإعلانية التي يستخدمها المنافسون الفعليون:
              </p>
            </div>
          </div>

          {(nichePrompt || aiSuggestedKeywords.length > 0) && (
            <button
              type="button"
              onClick={handleClearAiNiche}
              className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shrink-0"
              title="إعادة ضبط ومسح مساعد الكلمات"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">مسح الاقتراحات</span>
            </button>
          )}
        </div>

        {/* AI Prompt Input Form */}
        <form onSubmit={handleGenerateNicheKeywords} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Sparkles className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-indigo-400 pointer-events-none" />
            <input
              type="text"
              value={nichePrompt}
              onChange={(e) => setNichePrompt(e.target.value)}
              placeholder="اكتب مجالك أو طلبك (مثال: شركة ابادة حشرات في مصر، كورسات الماني، عيادة اسنان، براند عبايات خليجي)..."
              className="w-full pr-11 pl-10 py-3.5 rounded-2xl bg-slate-950/90 border border-indigo-500/40 text-white placeholder:text-slate-500 text-xs sm:text-sm font-medium focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all shadow-inner"
            />
            {nichePrompt && (
              <button
                type="button"
                onClick={() => setNichePrompt('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer"
                title="مسح النص"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={isGeneratingKeywords || !nichePrompt.trim()}
            className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-extrabold text-xs sm:text-sm shadow-lg shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 shrink-0 disabled:opacity-50 cursor-pointer"
          >
            {isGeneratingKeywords ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>جاري التفكير والتوليد...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>استخراج الكلمات بالذكاء الاصطناعي</span>
              </>
            )}
          </button>
        </form>

        {/* AI Suggested Keywords Interactive Chips */}
        {aiSuggestedKeywords.length > 0 && (
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4 animate-in fade-in duration-200">
            {aiExplanation && (
              <div className="flex items-start gap-2.5 text-xs text-indigo-200/90 font-medium leading-relaxed bg-indigo-950/40 p-3 rounded-xl border border-indigo-500/20 shadow-sm">
                <Lightbulb className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>{aiExplanation}</span>
              </div>
            )}

            {aiAngles && aiAngles.length > 0 ? (
              <div className="space-y-3">
                <div className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
                  <span>🎯 زوايا وكلمات البحث المقترحة (اضغط على أي كلمة للبحث الفوري):</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {aiAngles.map((ang, aIdx) => (
                    <div key={aIdx} className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-2">
                      <div className="text-[11px] font-extrabold text-indigo-300 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                        <span>{ang.category}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {ang.keywords.map((term, kIdx) => {
                          const isSelected = activeSelectedKeyword === term || searchTerms === term;
                          return (
                            <button
                              key={kIdx}
                              type="button"
                              onClick={() => handleSearch(term)}
                              className={'px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm ' + (
                                isSelected
                                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white border border-emerald-400 shadow-emerald-600/25 scale-105'
                                  : 'bg-slate-950 hover:bg-indigo-600 text-slate-200 hover:text-white border border-slate-800 hover:border-indigo-400'
                              )}
                            >
                              <Search className="w-3 h-3 text-indigo-300" />
                              <span>{term}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <div className="text-[11px] font-bold text-slate-400 mb-2 flex items-center gap-1.5">
                  <span>🎯 اضغط على أي كلمة مفتاحية للبحث عن إعلاناتها فوراً:</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {aiSuggestedKeywords.map((term, idx) => {
                    const isSelected = activeSelectedKeyword === term || searchTerms === term;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSearch(term)}
                        className={'px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm ' + (
                          isSelected
                            ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white border border-emerald-400 shadow-emerald-600/25 scale-105'
                            : 'bg-slate-900 hover:bg-indigo-600 text-slate-200 hover:text-white border border-slate-700/80 hover:border-indigo-400'
                        )}
                      >
                        <Search className="w-3 h-3 text-indigo-300" />
                        <span>{term}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* AI Suggestion Action Bar */}
            <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2.5">
              <button
                type="button"
                onClick={handleGenerateMoreKeywords}
                disabled={isGeneratingMoreKeywords || isGeneratingKeywords}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600/30 via-indigo-600/30 to-pink-600/30 hover:from-purple-600/50 hover:to-pink-600/50 border border-purple-500/40 text-purple-200 hover:text-white text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-sm disabled:opacity-50"
              >
                {isGeneratingMoreKeywords ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-purple-300" />
                    <span>جاري التفكير في كلمات وزوايا أخرى مختلفة...</span>
                  </>
                ) : (
                  <>
                    <Wand2 className="w-3.5 h-3.5 text-amber-300" />
                    <span>توليد كلمات وزوايا أخرى مختلفة (المزيد من الأفكار) ➕</span>
                  </>
                )}
              </button>

              <div className="text-[11px] text-slate-400">
                إجمالي الكلمات المقترحة: <span className="font-bold text-indigo-300">{aiSuggestedKeywords.length} كلمة</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Main Search Control Hub ── */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch();
          }}
          className="space-y-4"
        >
          {/* Main Search Input & CTA */}
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-5 h-5 absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchTerms}
                onChange={(e) => setSearchTerms(e.target.value)}
                placeholder="ابحث بالمنتج، الكلمة المفتاحية، أو رابط صفحة المنافس (مثال: شركة ابادة حشرات، اعلانات ممولة، تيشرت بولو)..."
                className="w-full pr-12 pl-11 py-3.5 rounded-2xl bg-slate-950 border border-slate-700/80 text-white placeholder:text-slate-500 text-sm font-medium focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-inner"
              />
              {searchTerms && (
                <button
                  type="button"
                  onClick={() => setSearchTerms('')}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-all flex items-center justify-center cursor-pointer"
                  title="مسح النص"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Search Button */}
            <button
              type="submit"
              disabled={loading || !searchTerms.trim()}
              className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 shrink-0 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>جاري البحث...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>بحث</span>
                </>
              )}
            </button>

            {/* Button: مكتبة الإعلانات */}
            <a
              href={'https://www.facebook.com/ads/library/?active_status=' + (statusFilter === 'ACTIVE' ? 'active' : 'all') + '&ad_type=all&country=' + country + '&is_targeted_country=false&media_type=' + mediaFilter.toLowerCase() + '&q=' + encodeURIComponent(searchTerms.trim()) + '&search_type=keyword_unordered'}
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-3.5 rounded-2xl bg-slate-950 hover:bg-slate-800 border border-slate-700/80 hover:border-slate-600 text-slate-300 hover:text-white font-bold text-sm transition-all flex items-center justify-center gap-2 shrink-0 shadow-sm"
              title="فتح نفس الكلمة والدولة في مكتبة إعلانات فيسبوك الرسمية"
            >
              <ExternalLink className="w-4 h-4 text-indigo-400" />
              <span>مكتبة الإعلانات</span>
            </a>
          </div>

          {/* Filters Bar */}
          <div className="flex flex-wrap items-center gap-3 pt-2 text-xs">
            {/* Country Selector */}
            <div className="flex items-center gap-2 bg-slate-950 px-3.5 py-2 rounded-xl border border-slate-800">
              <Globe className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-slate-400 font-medium">الدولة:</span>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="bg-transparent text-white font-bold focus:outline-none cursor-pointer text-xs"
              >
                <option value="EG" className="bg-slate-900 text-white">🇪🇬 مصر (EG)</option>
                <option value="SA" className="bg-slate-900 text-white">🇸🇦 السعودية (SA)</option>
                <option value="AE" className="bg-slate-900 text-white">🇦🇪 الإمارات (AE)</option>
                <option value="KW" className="bg-slate-900 text-white">🇰🇼 الكويت (KW)</option>
                <option value="QA" className="bg-slate-900 text-white">🇶🇦 قطر (QA)</option>
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2 bg-slate-950 px-3.5 py-2 rounded-xl border border-slate-800">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-slate-400 font-medium">حالة الإعلان:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-transparent text-white font-bold focus:outline-none cursor-pointer text-xs"
              >
                <option value="ACTIVE" className="bg-slate-900 text-white">🟢 النشطة حالياً فقط</option>
                <option value="ALL" className="bg-slate-900 text-white">الكل (نشط وغير نشط)</option>
              </select>
            </div>

            {/* Media Filter */}
            <div className="flex items-center gap-2 bg-slate-950 px-3.5 py-2 rounded-xl border border-slate-800">
              <ImageIcon className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-slate-400 font-medium">الوسائط:</span>
              <select
                value={mediaFilter}
                onChange={(e) => setMediaFilter(e.target.value as any)}
                className="bg-transparent text-white font-bold focus:outline-none cursor-pointer text-xs"
              >
                <option value="ALL" className="bg-slate-900 text-white">كل الوسائط</option>
                <option value="IMAGE" className="bg-slate-900 text-white">صور فقط</option>
                <option value="VIDEO" className="bg-slate-900 text-white">فيديو فقط</option>
              </select>
            </div>
          </div>
        </form>
      </div>

      {/* ── Metrics Summary Bar ── */}
      {hasSearched && !loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 flex items-center justify-between shadow-lg">
            <div>
              <div className="text-xs text-slate-400">إجمالي الإعلانات المرصودة</div>
              <div className="text-xl font-extrabold text-white mt-1">{ads.length} إعلان</div>
              {metaEstimatedTotal && (
                <div className="text-[10.5px] text-amber-300 font-bold mt-0.5 flex items-center gap-1">
                  <span>🎯</span>
                  <span>{metaEstimatedTotal}</span>
                </div>
              )}
            </div>
            <div className="p-3 rounded-xl bg-indigo-600/20 text-indigo-400">
              <Layers className="w-5 h-5" />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 flex items-center justify-between shadow-lg">
            <div>
              <div className="text-xs text-slate-400">الإعلانات النشطة</div>
              <div className="text-xl font-extrabold text-emerald-400 mt-1">{activeAdsCount} نشط</div>
            </div>
            <div className="p-3 rounded-xl bg-emerald-600/20 text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 flex items-center justify-between shadow-lg">
            <div>
              <div className="text-xs text-slate-400">فيديوهات وريلز</div>
              <div className="text-xl font-extrabold text-purple-400 mt-1">
                {ads.filter((a) => a.mediaType === 'VIDEO').length} فيديو
              </div>
            </div>
            <div className="p-3 rounded-xl bg-purple-600/20 text-purple-400">
              <Video className="w-5 h-5" />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 flex items-center justify-between shadow-lg">
            <div>
              <div className="text-xs text-slate-400">إعلانات تم تحليلها</div>
              <div className="text-xl font-extrabold text-indigo-400 mt-1">
                {Object.keys(analysisMap).length} تقرير
              </div>
            </div>
            <div className="p-3 rounded-xl bg-indigo-600/20 text-indigo-400">
              <Bot className="w-5 h-5" />
            </div>
          </div>
        </div>
      )}

      {/* ── Ads Grid Section ── */}
      <div>
        {loading ? (
          <div className="py-20 text-center space-y-4 rounded-3xl bg-slate-900/40 border border-slate-800/80">
            <RefreshCw className="w-10 h-10 text-indigo-500 animate-spin mx-auto" />
            <div className="space-y-1">
              <p className="text-sm font-bold text-white">جاري استخراج وفحص إعلانات المنافسين الحية بدقة...</p>
              <p className="text-xs text-slate-400">يتم الاتصال المباشر بمكتبة إعلانات فيسبوك الرسمية وسحب النصوص الكاملة والصور الأصلية والفيديوهات</p>
            </div>
          </div>
        ) : !hasSearched ? (
          <div className="py-20 text-center space-y-4 rounded-3xl bg-slate-900/40 border border-slate-800/80 p-8">
            <div className="w-16 h-16 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto shadow-inner">
              <Search className="w-8 h-8" />
            </div>
            <div className="space-y-2 max-w-md mx-auto">
              <h3 className="text-base sm:text-lg font-bold text-white">ابدأ استكشاف إعلانات المنافسين الحية</h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                استخدم مساعد الذكاء الاصطناعي أعلاه لتوليد الكلمات المفتاحية لمجالك أو اكتب الكلمة المفتاحية مباشرة في شريط البحث.
              </p>
            </div>
          </div>
        ) : ads.length === 0 ? (
          <div className="py-20 text-center space-y-4 rounded-3xl bg-slate-900/40 border border-slate-800/80">
            <div className="w-14 h-14 rounded-2xl bg-slate-800/80 text-slate-400 flex items-center justify-center mx-auto">
              <Search className="w-7 h-7" />
            </div>
            <div className="space-y-1.5">
              <p className="text-base font-bold text-white">لم يتم العثور على إعلانات مطابقة</p>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                جرب تغيير الكلمة المفتاحية، أو كتابة اسم عام للمنتج، أو توسيع الفلاتر لعرض جميع الإعلانات.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 xl:gap-6.5">
            {ads.map((ad) => {
              const isExpanded = expandedAdIds[ad.id];
              const textLength = ad.primaryText.length;
              const displayText = isExpanded ? ad.primaryText : ad.primaryText.slice(0, 180);
              const isAnalyzingThis = analyzingAdId === ad.id;
              const hasAnalysis = Boolean(analysisMap[ad.id]);

              const imagesList = ad.images && ad.images.length > 0 ? ad.images : (ad.imageUrl ? [ad.imageUrl] : []);
              const currentImgIdx = carouselIndexMap[ad.id] || 0;
              const activeImageSrc = imagesList[currentImgIdx] || ad.imageUrl;

              return (
                <div
                  key={ad.id}
                  className="rounded-3xl bg-slate-900/85 border border-slate-800 hover:border-slate-700/90 transition-all flex flex-col justify-between overflow-hidden shadow-xl hover:shadow-2xl group"
                >
                  {/* Card Top: Page Info & Meta */}
                  <div className="p-4 border-b border-slate-800/70 space-y-2.5 bg-slate-900/40">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors truncate">
                            {ad.pageName}
                          </h3>
                          <a
                            href={ad.pageProfileUrl || ('https://www.facebook.com/search/pages/?q=' + encodeURIComponent(ad.pageName))}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 rounded-md bg-slate-800 hover:bg-indigo-600/30 text-slate-400 hover:text-white transition-all shrink-0"
                            title="زيارة صفحة المنافس على فيسبوك مباشرة"
                          >
                            <ExternalLink className="w-3 h-3 text-indigo-400" />
                          </a>
                        </div>

                        {/* Start Date & Days Active Duration */}
                        <div className="space-y-1 mt-1.5 text-[11px]">
                          <div className="flex items-center gap-1 text-slate-300">
                            <span className="text-slate-400">تاريخ الإعلان:</span>
                            <span className="font-bold text-white font-mono">{formatDateEn(ad.formattedStartDate || ad.startDate)}</span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="px-2 py-0.5 rounded-md bg-indigo-950/70 border border-indigo-500/30 text-indigo-300 text-[10.5px] font-medium inline-flex items-center gap-1">
                              ⏱️ {ad.daysActiveLabel || 'شغال حالياً'}
                            </span>
                            <span className="text-slate-500 font-mono text-[10px]">ID: {ad.adLibraryId}</span>
                            {ad.mediaType === 'CAROUSEL' && (
                              <span className="px-2 py-0.5 rounded-md bg-purple-950/80 border border-purple-500/40 text-purple-300 text-[10px] font-bold inline-flex items-center gap-1">
                                🎠 كاروسيل ({imagesList.length} صور)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Star Button & Status Badge */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => handleOpenFavoriteModal(e, ad)}
                          className={'p-1.5 rounded-xl border transition-all cursor-pointer ' + (
                            favoritedIds[ad.adLibraryId]
                              ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-sm shadow-amber-500/20'
                              : 'bg-slate-800/80 hover:bg-amber-500/20 border-slate-700/80 text-slate-400 hover:text-amber-300'
                          )}
                          title={favoritedIds[ad.adLibraryId] ? 'تم الحفظ في المفضلة ⭐' : 'إضافة إلى المفضلة ⭐'}
                        >
                          <Star className={'w-3.5 h-3.5 ' + (favoritedIds[ad.adLibraryId] ? 'fill-amber-400 text-amber-400' : '')} />
                        </button>
                        <span
                          className={'px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ' + (
                            ad.status === 'ACTIVE'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          )}
                        >
                          {ad.status === 'ACTIVE' ? 'نشط 🟢' : 'غير نشط'}
                        </span>
                      </div>
                    </div>

                    {/* Platforms */}
                    <div className="flex items-center gap-1 text-[10px] text-slate-400">
                      <span className="text-slate-500">المنصات:</span>
                      {ad.publisherPlatforms.map((p) => (
                        <span key={p} className="px-1.5 py-0.5 rounded bg-slate-950 text-slate-300 border border-slate-800">
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Creative Media Preview */}
                  <div className="relative w-full h-52 bg-slate-950 overflow-hidden border-b border-slate-800/70 group/media flex items-center justify-center">
                    {ad.videoUrl ? (
                      <div className="relative w-full h-full flex items-center justify-center bg-black">
                        {playingVideoIds[ad.id] ? (
                          <video
                            controls
                            autoPlay
                            playsInline
                            className="max-h-full max-w-full object-contain w-full h-full"
                          >
                            <source src={ad.videoUrl} type="video/mp4" />
                            <source src={ad.videoUrl} />
                          </video>
                        ) : (
                          <div
                            className="relative w-full h-full cursor-pointer flex items-center justify-center bg-slate-950 group/vid"
                            onClick={(e) => handlePlayInlineVideo(e, ad.id)}
                          >
                            {activeImageSrc ? (
                              <img
                                src={activeImageSrc}
                                alt={ad.pageName}
                                className="w-full h-full object-cover group-hover/vid:scale-105 transition-transform duration-500 opacity-90"
                                loading="lazy"
                              />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center">
                                <Video className="w-12 h-12 text-slate-700" />
                              </div>
                            )}

                            {/* Center Play Button Overlay */}
                            <div className="absolute inset-0 bg-slate-950/40 group-hover/vid:bg-slate-950/20 transition-all flex items-center justify-center">
                              <div className="w-12 h-12 rounded-full bg-indigo-600/90 group-hover/vid:bg-indigo-500 group-hover/vid:scale-110 text-white flex items-center justify-center shadow-xl shadow-indigo-600/50 transition-all border border-white/20">
                                <Play className="w-5 h-5 fill-white ml-0.5" />
                              </div>
                            </div>

                            {/* Top Badges */}
                            <div className="absolute top-2 right-2 px-2.5 py-1 rounded-xl bg-black/85 backdrop-blur-sm border border-slate-700 text-white text-[10.5px] font-bold flex items-center gap-1.5 z-10 shadow-lg">
                              <Video className="w-3.5 h-3.5 text-rose-400" />
                              <span>فيديو إعلاني</span>
                            </div>

                            {/* Bottom Hint */}
                            <div className="absolute bottom-2 inset-x-2 flex justify-center z-10">
                              <span className="px-2.5 py-1 rounded-lg bg-slate-900/90 text-indigo-300 text-[10.5px] font-bold flex items-center gap-1 shadow-lg border border-slate-700">
                                <Play className="w-3 h-3 fill-indigo-400" />
                                <span>اضغط للتشغيل (توفير الباقة)</span>
                              </span>
                            </div>
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedMediaAd({ ad, imageIndex: 0 });
                          }}
                          className="absolute top-2 left-2 p-1.5 rounded-lg bg-black/80 hover:bg-black text-white text-[11px] font-bold flex items-center gap-1 shadow-md transition-all cursor-pointer z-20"
                          title="تكبير وعرض كامل الفيديو في نافذة مستقلة"
                        >
                          <Maximize2 className="w-3.5 h-3.5" />
                        </button>
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

                        {/* Multi-Image Carousel Arrows */}
                        {imagesList.length > 1 && (
                          <>
                            <button
                              onClick={(e) => handlePrevCarouselImage(e, ad.id, imagesList.length)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/80 hover:bg-black text-white transition-all shadow-md z-10"
                              title="الصورة السابقة"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => handleNextCarouselImage(e, ad.id, imagesList.length)}
                              className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/80 hover:bg-black text-white transition-all shadow-md z-10"
                              title="الصورة التالية"
                            >
                              <ChevronLeft className="w-4 h-4" />
                            </button>
                            <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-sm text-white text-[10px] font-mono z-10">
                              {currentImgIdx + 1} / {imagesList.length}
                            </div>
                          </>
                        )}

                        <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover/media:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <span className="px-3 py-1.5 rounded-xl bg-slate-900/90 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg border border-slate-700">
                            <Maximize2 className="w-3.5 h-3.5 text-indigo-400" />
                            <span>تكبير وحفظ الصورة</span>
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-600 text-xs">
                        إعلان نصي بدون وسائط
                      </div>
                    )}
                  </div>

                  {/* Full Ad Copy Body */}
                  <div className="p-4 flex-1 space-y-2">
                    <div className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap font-normal">
                      {displayText}
                      {textLength > 180 && !isExpanded && '...'}
                    </div>

                    {textLength > 180 && (
                      <button
                        onClick={() => toggleExpand(ad.id)}
                        className="text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 pt-1 cursor-pointer"
                      >
                        <span>{isExpanded ? 'عرض أقل' : ('عرض باقي الإعلان (' + textLength + ' حرف)')}</span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>

                  {/* Action Controls & AI */}
                  <div className="p-3.5 border-t border-slate-800/70 bg-slate-950/70 space-y-2.5">
                    {/* Row 1: CTA Badge + Real Post Link */}
                    <div className="flex items-center justify-between gap-2">
                      <div
                        className={'px-2.5 py-1 rounded-xl text-[11px] font-bold border flex items-center gap-1.5 truncate ' + getCtaBadgeStyle(ad.ctaType)}
                        title={'هدف الإعلان: ' + (ad.ctaLabel || 'بدون زر تفاعلي')}
                      >
                        {renderCtaIcon(ad.ctaType)}
                        <span className="truncate">{ad.ctaLabel || 'بدون زر تفاعلي'}</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleOpenRealPostFinder(ad)}
                        className="px-2.5 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 hover:border-indigo-500/50 text-indigo-300 hover:text-white transition-all text-[11px] font-bold flex items-center gap-1 shrink-0 cursor-pointer shadow-sm"
                        title="فتح خيارات الوصول للمنشور الحقيقي وصفحة المعلن"
                      >
                        <Link2 className="w-3 h-3 text-indigo-400" />
                        <span>رابط المنشور</span>
                      </button>
                    </div>

                    {/* Row 2: AI Analyze + Facebook Snapshot */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleAnalyzeAd(ad)}
                        disabled={isAnalyzingThis}
                        className={'flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ' + (
                          hasAnalysis
                            ? 'bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-500/50 text-emerald-300'
                            : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20'
                        )}
                      >
                        {isAnalyzingThis ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>جاري التحليل...</span>
                          </>
                        ) : hasAnalysis ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span>عرض التحليل الذكي ✨</span>
                          </>
                        ) : (
                          <>
                            <Bot className="w-3.5 h-3.5" />
                            <span>تحليل بـ Gemini 2.5 Pro</span>
                          </>
                        )}
                      </button>

                      {/* مكتبة الإعلانات */}
                      <a
                        href={ad.snapshotUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white transition-all flex items-center justify-center shrink-0"
                        title="فتح في مكتبة إعلانات فيسبوك"
                      >
                        <ExternalLink className="w-4 h-4 text-indigo-400" />
                      </a>

                      {/* تحميل */}
                      {(ad.videoUrl || activeImageSrc) && (
                        <button
                          type="button"
                          onClick={() => {
                            const src = ad.videoUrl || activeImageSrc!;
                            handleDownloadMedia(src, 'ad_' + ad.adLibraryId + '.' + (ad.videoUrl ? 'mp4' : 'jpg'));
                          }}
                          className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white transition-all flex items-center justify-center shrink-0"
                          title="تحميل الصورة أو الفيديو للجهاز"
                        >
                          <Download className="w-4 h-4 text-purple-400" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Load More Action Bar ── */}
          <div className="pt-8 pb-4 flex flex-col items-center justify-center gap-3.5">
            <button
              type="button"
              onClick={handleLoadMore}
              disabled={isLoadingMore || loading}
              className="px-8 py-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-extrabold text-xs sm:text-sm shadow-xl shadow-indigo-600/30 hover:shadow-indigo-600/50 transition-all flex items-center gap-3 cursor-pointer disabled:opacity-50 group scale-100 hover:scale-105 active:scale-95"
            >
              {isLoadingMore ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin text-white" />
                  <span>جاري سحب وتعميق البحث في مكتبة إعلانات فيسبوك...</span>
                </>
              ) : (
                <>
                  <ArrowDown className="w-5 h-5 group-hover:translate-y-1 transition-transform text-amber-300" />
                  <span>تحميل المزيد من إعلانات المنافسين ⏬</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-xs font-bold text-white">
                    +50 إعلان إضافي
                  </span>
                </>
              )}
            </button>

            <div className="text-xs text-slate-400 font-medium flex items-center gap-2">
              <span>تم رصد وعرض <span className="text-indigo-300 font-bold">{ads.length}</span> إعلان نشط للمنافسين</span>
              {metaEstimatedTotal && (
                <span className="text-slate-500 font-normal">
                  (من إجمالي تقديري <span className="text-amber-400 font-bold">{metaEstimatedTotal}</span> في مكتبة فيسبوك)
                </span>
              )}
            </div>
          </div>
        </>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════
          MODALS
          ════════════════════════════════════════════════════ */}

      {/* ── Favorite / Star Modal ── */}
      {favoriteModalAd && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white font-bold text-base">
                <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
                <span>حفظ الإعلان في المفضلة ⭐</span>
              </div>
              <button
                type="button"
                onClick={() => setFavoriteModalAd(null)}
                className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
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
                  <input
                    type="text"
                    value={favTitle}
                    onChange={(e) => setFavTitle(e.target.value)}
                    placeholder="اكتب اسماً مخصصاً لتذكره..."
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-bold block mb-1">المجال / التصنيف:</label>
                  <input
                    type="text"
                    value={favCategory}
                    onChange={(e) => setFavCategory(e.target.value)}
                    placeholder="مثال: ملابس، عقارات، خدمات، تسويق..."
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-bold block mb-1">ملاحظاتك (اختياري):</label>
                  <textarea
                    value={favNotes}
                    onChange={(e) => setFavNotes(e.target.value)}
                    placeholder="سبب إعجابك بالإعلان، الهوك، زاوية العرض، أفكار لتطبيقها..."
                    rows={3}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setFavoriteModalAd(null)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-bold cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveFavorite}
                    disabled={savingFav}
                    className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md cursor-pointer"
                  >
                    {savingFav ? 'جاري الحفظ...' : 'حفظ في المفضلة ⭐'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Real Post Finder Modal ── */}
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
              <button
                type="button"
                onClick={() => setDarkPostModal(null)}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {darkPostModal.isCarousel && (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200">
                <div className="font-extrabold text-amber-300 flex items-center gap-1.5 mb-1">
                  <span>🎠</span>
                  <span>إعلان كاروسيل — Dark Post محتمل</span>
                </div>
                <p className="text-[11.5px] text-slate-300 leading-relaxed">
                  إعلانات الكاروسيل تُنشأ عبر مدير الإعلانات وتكون Dark Posts بنسبة 99%، مما يعني أنها تظهر للمستهدفين بالإعلان فقط ولا تظهر على الصفحة الرئيسية.
                </p>
              </div>
            )}

            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-[11px] text-slate-400">نص المنشور:</div>
                <div className="text-xs font-bold text-white truncate mt-0.5">«{darkPostModal.firstLine}»</div>
              </div>
              <button
                type="button"
                onClick={() => handleCopySnippet(darkPostModal.firstLine)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold flex items-center gap-1 shrink-0 cursor-pointer"
              >
                {copiedSnippet ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedSnippet ? 'تم النسخ!' : 'نسخ النص'}</span>
              </button>
            </div>

            <div className="space-y-2.5 pt-1">
              <a
                href={darkPostModal.searchFbUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-extrabold text-xs sm:text-sm flex items-center justify-between transition-all shadow-lg group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-xl bg-white/20">
                    <Search className="w-4 h-4 text-white" />
                  </div>
                  <div className="text-right">
                    <div>🔍 فتح وبحث فوري عن المنشور بحسابك</div>
                    <div className="text-[10px] font-normal text-indigo-100 opacity-90">يفتح البحث التفاعلي في فيسبوك بنص المنشور واسم الصفحة</div>
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 shrink-0" />
              </a>

              <a
                href={darkPostModal.photosUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 px-4 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-between transition-all border border-slate-700"
              >
                <div className="flex items-center gap-2">
                  <Camera className="w-4 h-4 text-emerald-400" />
                  <span>📷 فتح ألبوم صور الصفحة (توجد به البوستات المنشورة)</span>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
              </a>

              <a
                href={darkPostModal.postsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 px-4 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white font-bold text-xs flex items-center justify-between transition-all border border-slate-800"
              >
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-indigo-400" />
                  <span>📝 تصفح تايم لاين الصفحة الكامل</span>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
              </a>

              <a
                href={darkPostModal.snapshotUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 px-4 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white font-bold text-xs flex items-center justify-between transition-all border border-slate-800/80"
              >
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-purple-400" />
                  <span>فتح لقطة الإعلان الرسمية بمكتبة فيسبوك</span>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ── Media Lightbox Modal ── */}
      {selectedMediaAd && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-3xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-sm">{selectedMediaAd.ad.pageName}</span>
                <span className="text-slate-400 text-xs">• {formatDateEn(selectedMediaAd.ad.formattedStartDate || selectedMediaAd.ad.startDate)}</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMediaAd(null)}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative flex-1 bg-black p-3 flex items-center justify-center overflow-auto min-h-[380px]">
              {selectedMediaAd.ad.videoUrl ? (
                <div className="w-full flex items-center justify-center py-2">
                  <video
                    controls
                    autoPlay
                    playsInline
                    poster={selectedMediaAd.ad.imageUrl}
                    className="max-h-[72vh] w-auto max-w-full object-contain rounded-2xl shadow-2xl bg-black"
                  >
                    <source src={selectedMediaAd.ad.videoUrl} type="video/mp4" />
                    <source src={selectedMediaAd.ad.videoUrl} />
                  </video>
                </div>
              ) : (() => {
                const imgs = selectedMediaAd.ad.images && selectedMediaAd.ad.images.length > 0 ? selectedMediaAd.ad.images : [selectedMediaAd.ad.imageUrl!];
                const currentIdx = selectedMediaAd.imageIndex;
                const curImg = imgs[currentIdx] || imgs[0];
                return (
                  <div className="relative w-full h-full flex items-center justify-center">
                    <img
                      src={curImg}
                      alt={selectedMediaAd.ad.pageName}
                      className="max-h-[72vh] max-w-full object-contain rounded-2xl shadow-2xl"
                    />
                    {imgs.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedMediaAd((prev) =>
                              prev ? { ...prev, imageIndex: (prev.imageIndex - 1 + imgs.length) % imgs.length } : null
                            )
                          }
                          className="absolute right-4 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/80 hover:bg-black text-white transition-all shadow-xl cursor-pointer z-10"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedMediaAd((prev) =>
                              prev ? { ...prev, imageIndex: (prev.imageIndex + 1) % imgs.length } : null
                            )
                          }
                          className="absolute left-4 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/80 hover:bg-black text-white transition-all shadow-xl cursor-pointer z-10"
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </button>
                        <div className="absolute top-4 right-4 px-3 py-1 rounded-lg bg-black/80 text-white text-xs font-mono z-10">
                          {currentIdx + 1} / {imgs.length}
                        </div>
                      </>
                    )}
                  </div>
                );
              })()}
            </div>

            <div className="p-4 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {(selectedMediaAd.ad.imageUrl || selectedMediaAd.ad.videoUrl) && (
                  <button
                    type="button"
                    onClick={() => {
                      const imgs = selectedMediaAd.ad.images && selectedMediaAd.ad.images.length > 0 ? selectedMediaAd.ad.images : [selectedMediaAd.ad.imageUrl!];
                      const src = selectedMediaAd.ad.videoUrl || imgs[selectedMediaAd.imageIndex] || selectedMediaAd.ad.imageUrl || '';
                      handleDownloadMedia(src, 'ad_' + selectedMediaAd.ad.adLibraryId + '.' + (selectedMediaAd.ad.videoUrl ? 'mp4' : 'jpg'));
                    }}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>تحميل 💾</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleCopyText(selectedMediaAd.ad.primaryText)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedText ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedText ? 'تم النسخ!' : 'نسخ نص الإعلان'}</span>
                </button>
              </div>

              <a
                href={selectedMediaAd.ad.snapshotUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
                <span>مكتبة الإعلانات</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ── AI Analysis Modal (Replaced تحليل with تحليل) ── */}
      {activeModalAnalysis && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-800 flex items-start justify-between gap-4 bg-slate-950/60">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    تحليل الذكاء الاصطناعي
                  </span>
                  <span className="text-slate-400 text-xs">• {activeModalAnalysis.ad.pageName}</span>
                </div>
                <h3 className="text-lg font-bold text-white">
                  التقرير التحليلي الاستراتيجي للإعلان (Gemini 2.5 Pro)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModalAnalysis(null)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm text-slate-300">
              {activeModalAnalysis.analysis.paid_ad_verdict && (
                <div className={'p-5 rounded-2xl border ' + getVerdictColor(activeModalAnalysis.analysis.paid_ad_verdict.rating).bg + ' space-y-2'}>
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-white text-base flex items-center gap-2">
                      <Award className="w-5 h-5" />
                      <span>حكم وتقييم الإعلان للميديا باير</span>
                    </span>
                    <span className={'px-3 py-1 rounded-full text-xs ' + getVerdictColor(activeModalAnalysis.analysis.paid_ad_verdict.rating).badge}>
                      {activeModalAnalysis.analysis.paid_ad_verdict.status_label || activeModalAnalysis.analysis.paid_ad_verdict.rating}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed opacity-95">
                    {activeModalAnalysis.analysis.paid_ad_verdict.summary}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-2">
                  <div className="text-xs text-indigo-400 font-bold flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-rose-400" />
                    <span>نوع الهوك:</span>
                  </div>
                  <div className="text-sm font-bold text-white">
                    {activeModalAnalysis.analysis.hook?.type || 'هوك مباشر'}
                  </div>
                  <p className="text-xs text-slate-400 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                    "{activeModalAnalysis.analysis.hook?.text || activeModalAnalysis.ad.primaryText.slice(0, 80)}"
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-2">
                  <div className="text-xs text-purple-400 font-bold flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4" />
                    <span>العرض التجاري:</span>
                  </div>
                  <div className="text-sm font-bold text-white">
                    {activeModalAnalysis.analysis.offer?.type || 'عرض بيع مباشر'}
                  </div>
                  <p className="text-xs text-slate-400 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                    {activeModalAnalysis.analysis.offer?.details || 'عرض تنافسي'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-900/40 space-y-2">
                  <div className="text-xs text-emerald-400 font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>نقاط القوة:</span>
                  </div>
                  <ul className="space-y-1 text-xs text-slate-300 list-disc list-inside">
                    {(activeModalAnalysis.analysis.strengths || ['وضوح العرض']).map((s, idx) => (
                      <li key={idx}>{s}</li>
                    ))}
                  </ul>
                </div>

                <div className="p-4 rounded-2xl bg-rose-950/20 border border-rose-900/40 space-y-2">
                  <div className="text-xs text-rose-400 font-bold flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4" />
                    <span>نقاط الضعف:</span>
                  </div>
                  <ul className="space-y-1 text-xs text-slate-300 list-disc list-inside">
                    {(activeModalAnalysis.analysis.weaknesses || ['عدم إبراز ضمانات']).map((w, idx) => (
                      <li key={idx}>{w}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {activeModalAnalysis.analysis.action_plan && (
                <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="text-xs text-indigo-400 font-bold flex items-center gap-1.5">
                    <Lightbulb className="w-4 h-4 text-amber-400" />
                    <span>خطة التغلب على هذا الإعلان:</span>
                  </div>
                  <div className="space-y-2 text-xs text-slate-300">
                    <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                      <span className="font-bold text-indigo-300">1. الهوك: </span>
                      {activeModalAnalysis.analysis.action_plan.step_1_hook}
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                      <span className="font-bold text-indigo-300">2. العرض: </span>
                      {activeModalAnalysis.analysis.action_plan.step_2_offer}
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                      <span className="font-bold text-indigo-300">3. الاستهداف: </span>
                      {activeModalAnalysis.analysis.action_plan.step_3_execution}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
              <a
                href={activeModalAnalysis.ad.snapshotUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
              >
                <span>فتح على مكتبة فيسبوك</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <button
                type="button"
                onClick={() => setActiveModalAnalysis(null)}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
