import { NextResponse } from 'next/server';
import { metaAdLibraryEngine } from '@/lib/meta-ad-library';

interface CacheItem {
  ads: any[];
  metaEstimatedTotal?: string;
  timestamp: number;
}

// In-memory cache map for competitor ads (TTL: 1 hour)
const memoryCache = new Map<string, CacheItem>();
const CACHE_TTL_MS = 60 * 60 * 1000;

function validateApiKey(req: Request): boolean {
  const expectedKey = process.env.MERCHANT_API_KEY || 'fastorder_merchant_secure_api_key_2026';
  const headerKey = req.headers.get('x-api-key') || req.headers.get('X-API-KEY');
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  const bearerKey = authHeader?.startsWith('Bearer ') ? authHeader.replace(/^Bearer\s+/, '').trim() : null;

  const providedKey = (headerKey || bearerKey || '').trim();
  return Boolean(providedKey && providedKey === expectedKey.trim());
}

function buildMetaAdLibrarySearchUrl(query: string, country: string = 'EG', status: string = 'active'): string {
  return `https://www.facebook.com/ads/library/?active_status=${encodeURIComponent(
    status.toLowerCase()
  )}&ad_type=all&country=${encodeURIComponent(
    country
  )}&is_targeted_country=false&media_type=all&q=${encodeURIComponent(query)}&search_type=keyword_unordered`;
}

function extractPhoneNumbers(text: string = ''): string[] {
  if (!text) return [];
  // Match Egyptian phone numbers, hotlines, and international formats
  const phoneRegex = /(?:\+?20\s?|0)?1[0125]\d{8}|\b1[569]\d{3}\b|\+?\d{9,14}/g;
  const matches = text.match(phoneRegex) || [];
  const cleanMatches = matches
    .map((p) => p.replace(/[\s-]/g, ''))
    .filter((p) => p.length >= 5 && p.length <= 15);
  return Array.from(new Set(cleanMatches));
}

function getMediaTypeLabel(mediaType: string): string {
  switch (mediaType) {
    case 'VIDEO':
      return 'فيديو 🎥';
    case 'CAROUSEL':
      return 'ألبوم صور (كاروسيل) 🎠';
    case 'IMAGE':
      return 'صورة 🖼️';
    case 'TEXT':
      return 'نص فقط 📄';
    default:
      return 'وسائط متعددة 🎬';
  }
}

function getPlatformsLabel(platforms: string[] = []): string {
  const hasFb = platforms.some((p) => p.toLowerCase().includes('facebook'));
  const hasInsta = platforms.some((p) => p.toLowerCase().includes('instagram'));

  if (hasFb && hasInsta) return 'فيسبوك وإنستغرام 📱';
  if (hasInsta) return 'إنستغرام فقط 📸';
  if (hasFb) return 'فيسبوك فقط 📘';
  return 'ميتا (فيسبوك وإنستغرام) 🌐';
}

function formatWhatsAppBatchMessage(params: {
  query: string;
  country: string;
  page: number;
  limit: number;
  totalAdsCount: number;
  ads: any[];
  searchUrl: string;
  hasMore: boolean;
  nextPage: number | null;
}): string {
  const { query, country, page, ads, searchUrl, hasMore, nextPage } = params;
  const numbers = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

  let msg = `📊 *إعلانات المنافسين من مكتبة الإعلانات*\n`;
  msg += `🔍 *كلمة البحث:* "${query}"\n`;
  msg += `🌍 *الدولة:* ${country === 'EG' ? 'مصر 🇪🇬' : country}\n`;
  msg += `📄 *الدفعة:* رقم ${page} (عرض ${ads.length} إعلانات)\n`;
  msg += `🔗 *رابط البحث المباشر في المكتبة:*\n${searchUrl}\n`;
  msg += `══════════════\n`;

  ads.forEach((ad, idx) => {
    const icon = numbers[idx] || `📌`;
    msg += `${icon} *${ad.page_name}*\n`;
    msg += `• 🎯 الهدف: *${ad.cta_label}*\n`;
    msg += `• ⏳ مدة التشغيل: *${ad.duration_text}* (منذ ${ad.start_date})\n`;
    msg += `• 🎬 نوع الإعلان: *${ad.media_type_label}*\n`;
    msg += `• 📱 المنصات: *${ad.platforms_label}*\n`;

    if (ad.phone_numbers && ad.phone_numbers.length > 0) {
      msg += `• 📞 أرقام التواصل: \`${ad.phone_numbers.join(' - ')}\`\n`;
    }

    // Snippet of copy text
    const cleanText = (ad.primary_text || '').replace(/\s+/g, ' ').trim();
    if (cleanText) {
      const snippet = cleanText.length > 220 ? cleanText.slice(0, 217) + '...' : cleanText;
      msg += `• 📝 نص الإعلان:\n"${snippet}"\n`;
    }

    msg += `• 🔗 رابط الإعلان بالمكتبة: ${ad.ad_library_url}\n\n`;
  });

  msg += `══════════════\n`;
  if (hasMore) {
    msg += `💡 *لعرض الـ ${params.limit} إعلانات التالية:* اكتب كلمة *"المزيد"* أو اطلب الصفحة رقم (${nextPage}).`;
  } else {
    msg += `✅ تم عرض جميع إعلانات المنافسين المتاحة لهذه الكلمة.`;
  }

  return msg;
}

async function handleCompetitorAds(params: {
  query: string;
  country?: string;
  limit?: number;
  page?: number;
  offset?: number;
  mediaType?: string;
  status?: string;
  forceRefresh?: boolean;
}) {
  const cleanQuery = (params.query || '').trim();
  const cleanCountry = (params.country || 'EG').trim().toUpperCase();
  const limit = Math.max(1, Math.min(Number(params.limit) || 5, 50));
  const page = Math.max(1, Number(params.page) || 1);
  const status = (params.status || 'ACTIVE').toUpperCase() === 'ALL' ? 'ALL' : 'ACTIVE';
  const mediaType = (params.mediaType || 'ALL').toUpperCase();
  const forceRefresh = Boolean(params.forceRefresh);

  if (!cleanQuery) {
    return {
      success: false,
      error: 'الرجاء إدخال كلمة البحث أو اسم/رابط صفحة المنافس (query / search_terms)',
      status: 400,
    };
  }

  const cacheKey = `comp_ads_${cleanQuery.toLowerCase()}_${cleanCountry}_${status}_${mediaType}`;
  let allAds: any[] = [];
  let metaEstimatedTotal: string | undefined = undefined;

  // 1. Try to get cached pool of ads
  if (!forceRefresh) {
    const cached = memoryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS && cached.ads.length > 0) {
      allAds = cached.ads;
      metaEstimatedTotal = cached.metaEstimatedTotal;
    }
  }

  // 2. If no cache or forced refresh, scrape from Meta Ad Library
  if (allAds.length === 0) {
    console.log(`[Merchant Competitor Ads] Fetching fresh ads from Meta Ad Library for "${cleanQuery}"...`);
    const searchRes = await metaAdLibraryEngine.searchAds({
      query: cleanQuery,
      country: cleanCountry,
      activeStatus: status as any,
      mediaType: mediaType as any,
      limit: 50, // Scrape a solid pool of 50 ads so subsequent pagination is instant
    });

    allAds = searchRes.ads || [];
    metaEstimatedTotal = searchRes.metaEstimatedTotal;

    if (allAds.length > 0) {
      memoryCache.set(cacheKey, {
        ads: allAds,
        metaEstimatedTotal,
        timestamp: Date.now(),
      });
    }
  }

  // 3. Calculate pagination slices
  const effectiveOffset = params.offset !== undefined ? Math.max(0, Number(params.offset)) : (page - 1) * limit;
  const paginatedSlice = allAds.slice(effectiveOffset, effectiveOffset + limit);
  const totalCachedAds = allAds.length;
  const hasMore = effectiveOffset + limit < totalCachedAds;
  const nextPage = hasMore ? page + 1 : null;
  const nextOffset = hasMore ? effectiveOffset + limit : null;

  const searchUrl = buildMetaAdLibrarySearchUrl(cleanQuery, cleanCountry, status);

  // 4. Map ads to structured and rich partner format
  const formattedAds = paginatedSlice.map((ad: any, index: number) => {
    const phones = extractPhoneNumbers(ad.primaryText || '');
    const directLibraryUrl = ad.adLibraryId
      ? `https://www.facebook.com/ads/library/?id=${ad.adLibraryId}`
      : ad.snapshotUrl;

    return {
      index: effectiveOffset + index + 1,
      id: ad.id || `ad_${ad.adLibraryId}`,
      ad_library_id: ad.adLibraryId,
      ad_library_url: directLibraryUrl,
      snapshot_url: ad.snapshotUrl,
      page_name: ad.pageName,
      page_id: ad.pageId || '',
      page_profile_url:
        ad.pageProfileUrl || `https://www.facebook.com/search/pages/?q=${encodeURIComponent(ad.pageName)}`,
      start_date: ad.formattedStartDate || ad.startDate || 'نشط حالياً',
      days_active: ad.daysActive || 1,
      duration_text: ad.daysActiveLabel || 'شغال حالياً 🔥',
      is_active: ad.status === 'ACTIVE',
      status: ad.status || 'ACTIVE',
      status_label: ad.status === 'ACTIVE' ? '🟢 نشط حالياً' : '⏸️ غير نشط',
      cta_type: ad.ctaType || 'NO_BUTTON',
      cta_label: ad.ctaLabel || 'بدون زر تفاعلي',
      primary_text: ad.primaryText || '',
      link_title: ad.linkTitle || '',
      link_caption: ad.linkCaption || '',
      link_description: ad.linkDescription || '',
      phone_numbers: phones,
      primary_phone: phones[0] || null,
      media_type: ad.mediaType || 'IMAGE',
      media_type_label: getMediaTypeLabel(ad.mediaType),
      image_url: ad.imageUrl || (ad.images && ad.images[0]) || null,
      images: ad.images || (ad.imageUrl ? [ad.imageUrl] : []),
      video_url: ad.videoUrl || null,
      is_video: Boolean(ad.videoUrl || ad.mediaType === 'VIDEO'),
      publisher_platforms: ad.publisherPlatforms || ['facebook', 'instagram'],
      platforms_label: getPlatformsLabel(ad.publisherPlatforms),
      country: ad.country || cleanCountry,
      query: cleanQuery,
    };
  });

  const formattedMessage = formatWhatsAppBatchMessage({
    query: cleanQuery,
    country: cleanCountry,
    page,
    limit,
    totalAdsCount: totalCachedAds,
    ads: formattedAds,
    searchUrl,
    hasMore,
    nextPage,
  });

  const payload = {
    query: cleanQuery,
    country: cleanCountry,
    search_url: searchUrl,
    meta_estimated_total: metaEstimatedTotal || (totalCachedAds > 0 ? `~${totalCachedAds}+ إعلان` : '0 إعلان'),
    pagination: {
      current_page: page,
      limit,
      offset: effectiveOffset,
      returned_count: formattedAds.length,
      total_cached_ads: totalCachedAds,
      has_more: hasMore,
      next_page: nextPage,
      next_offset: nextOffset,
    },
    ads: formattedAds,
    formatted_message: formattedMessage,
    cached_at: new Date().toISOString(),
  };

  return { success: true, data: payload };
}

export async function POST(req: Request) {
  if (!validateApiKey(req)) {
    return NextResponse.json(
      { success: false, error: 'غير مصرح بالدخول: مفتاح الـ API غير صالح (Invalid API Key)' },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const query = body.query || body.search_terms || body.keyword || body.q || '';
    const country = body.country || 'EG';
    const limit = body.limit !== undefined ? Number(body.limit) : 5;
    const page = body.page !== undefined ? Number(body.page) : 1;
    const offset = body.offset !== undefined ? Number(body.offset) : undefined;
    const mediaType = body.media_type || body.mediaType || 'ALL';
    const status = body.status || body.activeStatus || 'ACTIVE';
    const forceRefresh = Boolean(body.force_refresh);

    const res = await handleCompetitorAds({
      query,
      country,
      limit,
      page,
      offset,
      mediaType,
      status,
      forceRefresh,
    });

    if (!res.success) {
      return NextResponse.json({ success: false, error: res.error }, { status: res.status || 400 });
    }

    return NextResponse.json({ success: true, ...res.data });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'خطأ في معالجة جسم الطلب (JSON body)' },
      { status: 400 }
    );
  }
}

export async function GET(req: Request) {
  if (!validateApiKey(req)) {
    return NextResponse.json(
      { success: false, error: 'غير مصرح بالدخول: مفتاح الـ API غير صالح (Invalid API Key)' },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(req.url);
  const query =
    searchParams.get('query') ||
    searchParams.get('q') ||
    searchParams.get('keyword') ||
    searchParams.get('search_terms') ||
    '';
  const country = searchParams.get('country') || 'EG';
  const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : 5;
  const page = searchParams.get('page') ? Number(searchParams.get('page')) : 1;
  const offset = searchParams.get('offset') ? Number(searchParams.get('offset')) : undefined;
  const mediaType = searchParams.get('media_type') || 'ALL';
  const status = searchParams.get('status') || 'ACTIVE';
  const forceRefresh = searchParams.get('force_refresh') === 'true';

  const res = await handleCompetitorAds({
    query,
    country,
    limit,
    page,
    offset,
    mediaType,
    status,
    forceRefresh,
  });

  if (!res.success) {
    return NextResponse.json({ success: false, error: res.error }, { status: res.status || 400 });
  }

  return NextResponse.json({ success: true, ...res.data });
}
