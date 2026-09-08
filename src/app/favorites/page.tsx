'use client';

import React, { useState, useEffect } from 'react';
import {
  Star,
  Search,
  Filter,
  Trash2,
  Edit3,
  ExternalLink,
  Bot,
  Globe,
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
  Layers,
  MessageCircle,
  MessageSquare,
  ShoppingBag,
  FileText,
  Play,
  Phone,
  Bookmark,
  FolderHeart,
  Link2,
} from 'lucide-react';

interface FavoriteItem {
  id: string;
  adLibraryId: string;
  customTitle: string;
  category: string;
  pageName: string;
  pageProfileUrl?: string;
  primaryText: string;
  startDate?: string;
  formattedStartDate?: string;
  daysActiveLabel?: string;
  status: string;
  mediaType: 'IMAGE' | 'VIDEO' | 'CAROUSEL' | 'TEXT';
  imageUrl?: string;
  images: string[];
  videoUrl?: string;
  ctaType?: string;
  ctaLabel?: string;
  snapshotUrl: string;
  publisherPlatforms: string[];
  country: string;
  analysis?: any;
  notes?: string;
  createdAt: string;
}

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

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedMediaType, setSelectedMediaType] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Modals & Active state
  const [expandedAdIds, setExpandedAdIds] = useState<Record<string, boolean>>({});
  const [carouselIndexMap, setCarouselIndexMap] = useState<Record<string, number>>({});
  const [editingFavorite, setEditingFavorite] = useState<FavoriteItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Active playing videos on demand (saves internet bandwidth)
  const [playingVideoIds, setPlayingVideoIds] = useState<Record<string, boolean>>({});

  const handlePlayInlineVideo = (e: React.MouseEvent, favId: string) => {
    e.stopPropagation();
    setPlayingVideoIds((prev) => ({ ...prev, [favId]: true }));
  };

  const [activeModalAnalysis, setActiveModalAnalysis] = useState<{ ad: any; analysis: any } | null>(null);
  const [selectedMediaAd, setSelectedMediaAd] = useState<{ ad: any; imageIndex: number } | null>(null);
  const [copiedText, setCopiedText] = useState(false);

  const fetchFavorites = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedCategory !== 'ALL') params.set('category', selectedCategory);
      if (selectedMediaType !== 'ALL') params.set('mediaType', selectedMediaType);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());

      const res = await fetch(`/api/favorites?${params.toString()}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.favorites)) {
        setFavorites(data.favorites);
        if (Array.isArray(data.categories)) {
          setCategories(data.categories);
        }
      }
    } catch (err) {
      console.error('Failed to load favorites:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFavorites();
  }, [selectedCategory, selectedMediaType]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchFavorites();
  };

  const handleDeleteFavorite = async (id: string, customTitle: string) => {
    if (!confirm(`هل أنت متأكد من حذف "${customTitle}" من المفضلة؟`)) return;
    try {
      const res = await fetch(`/api/favorites?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setFavorites((prev) => prev.filter((f) => f.id !== id));
      }
    } catch (err) {
      console.error('Delete favorite failed:', err);
    }
  };

  const handleOpenEdit = (fav: FavoriteItem) => {
    setEditingFavorite(fav);
    setEditTitle(fav.customTitle);
    setEditCategory(fav.category || 'عام');
    setEditNotes(fav.notes || '');
  };

  const handleSaveEdit = async () => {
    if (!editingFavorite) return;
    setSavingEdit(true);
    try {
      const res = await fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editingFavorite,
          customTitle: editTitle,
          category: editCategory,
          notes: editNotes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setFavorites((prev) =>
          prev.map((f) =>
            f.id === editingFavorite.id
              ? { ...f, customTitle: editTitle, category: editCategory, notes: editNotes }
              : f
          )
        );
        setEditingFavorite(null);
      }
    } catch (err) {
      console.error('Update favorite failed:', err);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleAnalyzeAd = async (fav: FavoriteItem) => {
    if (fav.analysis) {
      setActiveModalAnalysis({ ad: fav, analysis: fav.analysis });
      return;
    }

    try {
      const res = await fetch('/api/ads/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adText: fav.primaryText,
          pageName: fav.pageName,
          platform: fav.publisherPlatforms[0] || 'Facebook',
          snapshotUrl: fav.snapshotUrl,
          imageUrl: fav.imageUrl,
          postId: fav.adLibraryId,
        }),
      });

      const data = await res.json();
      if (data.success && data.analysis) {
        // Save analysis to favorite
        await fetch('/api/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...fav,
            analysis: data.analysis,
          }),
        });

        setFavorites((prev) =>
          prev.map((f) => (f.id === fav.id ? { ...f, analysis: data.analysis } : f))
        );
        setActiveModalAnalysis({ ad: fav, analysis: data.analysis });
      }
    } catch (err) {
      console.error('Analysis failed:', err);
    }
  };

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

  const toggleExpand = (id: string) => {
    setExpandedAdIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleNextCarouselImage = (e: React.MouseEvent, adId: string, total: number) => {
    e.stopPropagation();
    setCarouselIndexMap((prev) => ({
      ...prev,
      [adId]: ((prev[adId] || 0) + 1) % total,
    }));
  };

  const handlePrevCarouselImage = (e: React.MouseEvent, adId: string, total: number) => {
    e.stopPropagation();
    setCarouselIndexMap((prev) => ({
      ...prev,
      [adId]: ((prev[adId] || 0) - 1 + total) % total,
    }));
  };

  const uniqueBrands = new Set(favorites.map((f) => f.pageName)).size;

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              أرشيف الإعلانات المفضلة المحفوظة دائمياً
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            الإعلانات المفضلة (Creative Swipe File)
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            أرشيفك الشخصي الدائم لأفضل إعلانات المنافسين والفيديوهات والهوكات الإبداعية، محفوظة بقاعدة البيانات حتى لو توقف الإعلان على فيسبوك.
          </p>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 flex items-center justify-between shadow-lg">
          <div>
            <div className="text-xs text-slate-400">إجمالي المحفوظات</div>
            <div className="text-xl font-extrabold text-amber-300 mt-1">{favorites.length} إعلان ⭐</div>
          </div>
          <div className="p-3 rounded-xl bg-amber-500/20 text-amber-400">
            <FolderHeart className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 flex items-center justify-between shadow-lg">
          <div>
            <div className="text-xs text-slate-400">المعلنين والصفحات</div>
            <div className="text-xl font-extrabold text-white mt-1">{uniqueBrands} صفحة</div>
          </div>
          <div className="p-3 rounded-xl bg-indigo-600/20 text-indigo-400">
            <Globe className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 flex items-center justify-between shadow-lg">
          <div>
            <div className="text-xs text-slate-400">فيديوهات وريلز</div>
            <div className="text-xl font-extrabold text-purple-400 mt-1">
              {favorites.filter((f) => f.mediaType === 'VIDEO').length} فيديو
            </div>
          </div>
          <div className="p-3 rounded-xl bg-purple-600/20 text-purple-400">
            <Video className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 flex items-center justify-between shadow-lg">
          <div>
            <div className="text-xs text-slate-400">المحللة بالذكاء الاصطناعي</div>
            <div className="text-xl font-extrabold text-emerald-400 mt-1">
              {favorites.filter((f) => f.analysis).length} تقرير جاهز
            </div>
          </div>
          <div className="p-3 rounded-xl bg-emerald-600/20 text-emerald-400">
            <Bot className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث في المفضلة باسم الإعلان، الصفحة، الملاحظات، أو نص الإعلان..."
              className="w-full pr-11 pl-4 py-3 rounded-2xl bg-slate-950 border border-slate-700/80 text-white placeholder:text-slate-500 text-xs sm:text-sm font-medium focus:outline-none focus:border-amber-500"
            />
          </div>
          <button
            type="submit"
            className="px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer"
          >
            <Search className="w-4 h-4" />
            <span>بحث في المفضلة</span>
          </button>
        </form>

        {/* Categories Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs text-slate-400 font-bold ml-1">التصنيف:</span>
          <button
            onClick={() => setSelectedCategory('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedCategory === 'ALL'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            الكل ({favorites.length})
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}

          <div className="mr-auto flex items-center gap-2">
            <span className="text-xs text-slate-400 font-bold">الوسائط:</span>
            <select
              value={selectedMediaType}
              onChange={(e) => setSelectedMediaType(e.target.value)}
              className="bg-slate-950 text-white font-bold text-xs px-3 py-1.5 rounded-xl border border-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="ALL">كل الوسائط</option>
              <option value="VIDEO">فيديو فقط</option>
              <option value="IMAGE">صور فقط</option>
              <option value="CAROUSEL">كاروسيل</option>
            </select>
          </div>
        </div>
      </div>

      {/* Favorites Grid */}
      {loading ? (
        <div className="py-20 text-center space-y-4 rounded-3xl bg-slate-900/40 border border-slate-800/80">
          <RefreshCw className="w-10 h-10 text-amber-400 animate-spin mx-auto" />
          <p className="text-sm font-bold text-white">جاري تحميل المفضلة...</p>
        </div>
      ) : favorites.length === 0 ? (
        <div className="py-20 text-center space-y-4 rounded-3xl bg-slate-900/40 border border-slate-800/80 p-8">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto shadow-inner">
            <Star className="w-8 h-8 fill-amber-400/20" />
          </div>
          <div className="space-y-2 max-w-md mx-auto">
            <h3 className="text-base sm:text-lg font-bold text-white">لا توجد إعلانات في المفضلة بعد</h3>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              أثناء استكشاف إعلانات المنافسين في صفحة «بحث الإعلانات»، اضغط على علامة النجمة ⭐ على أي إعلان أو فيديو يعجبك لحفظه وتصنيفه والرجوع إليه في أي وقت.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 xl:gap-6.5">
          {favorites.map((fav) => {
            const isExpanded = expandedAdIds[fav.id];
            const textLength = fav.primaryText.length;
            const displayText = isExpanded ? fav.primaryText : fav.primaryText.slice(0, 180);
            const imagesList = fav.images && fav.images.length > 0 ? fav.images : (fav.imageUrl ? [fav.imageUrl] : []);
            const currentImgIdx = carouselIndexMap[fav.id] || 0;
            const activeImageSrc = imagesList[currentImgIdx] || fav.imageUrl;

            return (
              <div
                key={fav.id}
                className="rounded-3xl bg-slate-900/85 border border-slate-800 hover:border-amber-500/40 transition-all flex flex-col justify-between overflow-hidden shadow-xl hover:shadow-2xl group"
              >
                {/* Card Top: Custom Title & Edit/Delete Controls */}
                <div className="p-4 border-b border-slate-800/70 space-y-2.5 bg-slate-900/50">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      {/* Category Badge & Star */}
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] font-bold">
                          🏷️ {fav.category || 'عام'}
                        </span>
                        {fav.mediaType === 'CAROUSEL' && (
                          <span className="px-2 py-0.5 rounded-md bg-purple-950/80 border border-purple-500/40 text-purple-300 text-[10px] font-bold">
                            🎠 كاروسيل
                          </span>
                        )}
                      </div>

                      {/* Custom Title */}
                      <h3 className="text-sm font-extrabold text-white group-hover:text-amber-300 transition-colors truncate">
                        {fav.customTitle}
                      </h3>

                      {/* Page Name */}
                      <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                        <span>الصفحة:</span>
                        <span className="font-semibold text-slate-200 truncate">{fav.pageName}</span>
                      </div>
                    </div>

                    {/* Action buttons: Edit & Delete */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleOpenEdit(fav)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-indigo-600/30 text-slate-400 hover:text-white transition-all cursor-pointer"
                        title="تعديل اسم الإعلان والتصنيف والملاحظات"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteFavorite(fav.id, fav.customTitle)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-600/30 text-slate-400 hover:text-rose-300 transition-all cursor-pointer"
                        title="حذف من المفضلة"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Notes box if available */}
                  {fav.notes && (
                    <div className="p-2 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] text-amber-200/90 leading-relaxed font-medium">
                      <span className="font-bold text-amber-400">💡 ملاحظة: </span>
                      {fav.notes}
                    </div>
                  )}
                </div>

                {/* Media Player / Lightbox */}
                <div className="relative w-full h-52 bg-slate-950 overflow-hidden border-b border-slate-800/70 group/media flex items-center justify-center">
                  {fav.videoUrl ? (
                    <div className="relative w-full h-full flex items-center justify-center bg-black">
                      {playingVideoIds[fav.id] ? (
                        <video
                          controls
                          autoPlay
                          playsInline
                          className="max-h-full max-w-full object-contain w-full h-full"
                        >
                          <source src={fav.videoUrl} type="video/mp4" />
                          <source src={fav.videoUrl} />
                        </video>
                      ) : (
                        <div
                          className="relative w-full h-full cursor-pointer flex items-center justify-center bg-slate-950 group/vid"
                          onClick={(e) => handlePlayInlineVideo(e, fav.id)}
                        >
                          {activeImageSrc ? (
                            <img
                              src={activeImageSrc}
                              alt={fav.pageName}
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
                          setSelectedMediaAd({ ad: fav, imageIndex: 0 });
                        }}
                        className="absolute top-2 left-2 p-1.5 rounded-lg bg-black/80 hover:bg-black text-white text-[11px] font-bold flex items-center gap-1 shadow-md transition-all cursor-pointer z-20"
                        title="تكبير وعرض كامل الفيديو"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : activeImageSrc ? (
                    <div
                      className="relative w-full h-full cursor-pointer flex items-center justify-center bg-slate-950"
                      onClick={() => setSelectedMediaAd({ ad: fav, imageIndex: currentImgIdx })}
                    >
                      <img
                        src={activeImageSrc}
                        alt={fav.pageName}
                        className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />

                      {imagesList.length > 1 && (
                        <>
                          <button
                            onClick={(e) => handlePrevCarouselImage(e, fav.id, imagesList.length)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/80 hover:bg-black text-white transition-all shadow-md z-10"
                            title="السابق"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => handleNextCarouselImage(e, fav.id, imagesList.length)}
                            className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/80 hover:bg-black text-white transition-all shadow-md z-10"
                            title="التالي"
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
                          <Maximize2 className="w-3.5 h-3.5 text-amber-400" />
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

                {/* Ad Copy */}
                <div className="p-4 flex-1 space-y-2">
                  <div className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap font-normal">
                    {displayText}
                    {textLength > 180 && !isExpanded && '...'}
                  </div>

                  {textLength > 180 && (
                    <button
                      onClick={() => toggleExpand(fav.id)}
                      className="text-[11px] text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 pt-1 cursor-pointer"
                    >
                      <span>{isExpanded ? 'عرض أقل' : `عرض باقي الإعلان (${textLength} حرف)`}</span>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>

                {/* Footer Controls */}
                <div className="p-3.5 border-t border-slate-800/70 bg-slate-950/70 space-y-2">
                  <div className="flex items-center gap-2">
                    {/* Gemini AI Deconstruct */}
                    <button
                      onClick={() => handleAnalyzeAd(fav)}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        fav.analysis
                          ? 'bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-500/50 text-emerald-300'
                          : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                      }`}
                    >
                      {fav.analysis ? (
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

                    {/* Snapshot / Facebook link */}
                    <a
                      href={fav.snapshotUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-all"
                      title="فتح بمكتبة إعلانات فيسبوك"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Favorite Modal */}
      {editingFavorite && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white font-bold text-base">
                <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
                <span>تعديل بيانات الإعلان في المفضلة</span>
              </div>
              <button
                onClick={() => setEditingFavorite(null)}
                className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-bold block mb-1">اسم الإعلان المخصص:</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-medium focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-slate-300 font-bold block mb-1">المجال / التصنيف:</label>
                <input
                  type="text"
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  placeholder="مثال: ملابس رجالي، عقارات، كورس تسويق..."
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-medium focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-slate-300 font-bold block mb-1">ملاحظات الميديا باير (اختياري):</label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="اكتب سبب حفظ الإعلان أو نقاط القوة في الهوك والعرض..."
                  rows={3}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-medium focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setEditingFavorite(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-bold"
              >
                إلغاء
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={savingEdit}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md"
              >
                {savingEdit ? 'جاري الحفظ...' : 'حفظ التعديلات ⭐'}
              </button>
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
                <span className="font-bold text-white text-sm">{selectedMediaAd.ad.customTitle || selectedMediaAd.ad.pageName}</span>
                <span className="text-slate-400 text-xs">• {selectedMediaAd.ad.category}</span>
              </div>
              <button
                onClick={() => setSelectedMediaAd(null)}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer"
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
                  </video>
                </div>
              ) : (selectedMediaAd.ad.images && selectedMediaAd.ad.images.length > 0) || selectedMediaAd.ad.imageUrl ? (
                (() => {
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
                            onClick={() =>
                              setSelectedMediaAd((prev) =>
                                prev ? { ...prev, imageIndex: (prev.imageIndex + 1) % imgs.length } : null
                              )
                            }
                            className="absolute left-4 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/80 hover:bg-black text-white transition-all shadow-xl cursor-pointer z-10"
                          >
                            <ChevronLeft className="w-5 h-5" />
                          </button>
                          <div className="absolute top-4 right-4 px-3 py-1 rounded-lg bg-black/80 backdrop-blur-md text-white text-xs font-mono z-10">
                            {currentIdx + 1} / {imgs.length}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })()
              ) : (
                <div className="text-slate-500 text-sm">لا توجد وسائط لهذا الإعلان</div>
              )}
            </div>

            <div className="p-4 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {(selectedMediaAd.ad.imageUrl || selectedMediaAd.ad.videoUrl) && (
                  <button
                    onClick={() => {
                      const imgs = selectedMediaAd.ad.images && selectedMediaAd.ad.images.length > 0 ? selectedMediaAd.ad.images : [selectedMediaAd.ad.imageUrl!];
                      const mediaToDownload = selectedMediaAd.ad.videoUrl || imgs[selectedMediaAd.imageIndex] || selectedMediaAd.ad.imageUrl || '';
                      handleDownloadMedia(
                        mediaToDownload,
                        `favorite_${selectedMediaAd.ad.adLibraryId}_${selectedMediaAd.ad.videoUrl ? 'video.mp4' : 'image.jpg'}`
                      );
                    }}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>تحميل إلى جهازك 💾</span>
                  </button>
                )}

                <button
                  onClick={() => handleCopyText(selectedMediaAd.ad.primaryText)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  {copiedText ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedText ? 'تم نسخ النص!' : 'نسخ نص الإعلان'}</span>
                </button>
              </div>

              <a
                href={selectedMediaAd.ad.snapshotUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs flex items-center gap-1.5 transition-all"
              >
                <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
                <span>فتح فيسبوك</span>
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
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                    تقرير الذكاء الاصطناعي المحفوظ ⭐
                  </span>
                  <span className="text-slate-400 text-xs">• {activeModalAnalysis.ad.customTitle || activeModalAnalysis.ad.pageName}</span>
                </div>
                <h3 className="text-lg font-bold text-white">
                  التحليل الاستراتيجي للإعلان المحفوظ (Gemini 2.5 Pro)
                </h3>
              </div>
              <button
                onClick={() => setActiveModalAnalysis(null)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm text-slate-300">
              {activeModalAnalysis.analysis.paid_ad_verdict && (
                <div
                  className={`p-5 rounded-2xl border ${
                    getVerdictColor(activeModalAnalysis.analysis.paid_ad_verdict.rating).bg
                  } space-y-2`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-white text-base flex items-center gap-2">
                      <Award className="w-5 h-5" />
                      <span>حكم وتقييم الإعلان للميديا باير</span>
                    </span>
                    <span
                      className={`px-3 py-1 rounded-full text-xs ${
                        getVerdictColor(activeModalAnalysis.analysis.paid_ad_verdict.rating).badge
                      }`}
                    >
                      {activeModalAnalysis.analysis.paid_ad_verdict.status_label ||
                        activeModalAnalysis.analysis.paid_ad_verdict.rating}
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
                    <span>نوع وطريقة الهوك (Hook Type):</span>
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
                    <span>العرض التجاري (Offer):</span>
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
                    <span>نقاط القوة الترويجية:</span>
                  </div>
                  <ul className="space-y-1 text-xs text-slate-300 list-disc list-inside">
                    {(activeModalAnalysis.analysis.strengths || ['وضوح العرض', 'استهداف مباشر']).map(
                      (s: string, idx: number) => (
                        <li key={idx}>{s}</li>
                      )
                    )}
                  </ul>
                </div>

                <div className="p-4 rounded-2xl bg-rose-950/20 border border-rose-900/40 space-y-2">
                  <div className="text-xs text-rose-400 font-bold flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4" />
                    <span>نقاط الضعف وفرص التفوق:</span>
                  </div>
                  <ul className="space-y-1 text-xs text-slate-300 list-disc list-inside">
                    {(activeModalAnalysis.analysis.weaknesses || ['عدم إبراز ضمانات كافية']).map(
                      (w: string, idx: number) => (
                        <li key={idx}>{w}</li>
                      )
                    )}
                  </ul>
                </div>
              </div>

              {activeModalAnalysis.analysis.action_plan && (
                <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="text-xs text-indigo-400 font-bold flex items-center gap-1.5">
                    <Lightbulb className="w-4 h-4 text-amber-400" />
                    <span>خطة التغلب على هذا الإعلان (3 خطوات تنفيذية):</span>
                  </div>
                  <div className="space-y-2 text-xs text-slate-300">
                    <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                      <span className="font-bold text-indigo-300">1. الهوك الإبداعي: </span>
                      {activeModalAnalysis.analysis.action_plan.step_1_hook}
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                      <span className="font-bold text-indigo-300">2. تطوير العرض: </span>
                      {activeModalAnalysis.analysis.action_plan.step_2_offer}
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                      <span className="font-bold text-indigo-300">3. الاستهداف والتنفيذ: </span>
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
                <span>فتح بمكتبة إعلانات فيسبوك</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <button
                onClick={() => setActiveModalAnalysis(null)}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all cursor-pointer"
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
