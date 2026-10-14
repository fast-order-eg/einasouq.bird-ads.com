import { NextResponse } from 'next/server';
import vertexAI from '@/lib/vertex';

interface CacheItem {
  data: any;
  timestamp: number;
}

const memoryCache = new Map<string, CacheItem>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache

function validateApiKey(req: Request): boolean {
  const expectedKey = process.env.MERCHANT_API_KEY || 'fastorder_merchant_secure_api_key_2026';
  const headerKey = req.headers.get('x-api-key') || req.headers.get('X-API-KEY');
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  const bearerKey = authHeader?.startsWith('Bearer ') ? authHeader.replace(/^Bearer\s+/, '').trim() : null;

  const providedKey = (headerKey || bearerKey || '').trim();
  return Boolean(providedKey && providedKey === expectedKey.trim());
}

function buildMetaAdLibrarySearchUrl(query: string, country: string = 'EG'): string {
  return `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=${encodeURIComponent(
    country
  )}&is_targeted_country=false&media_type=all&q=${encodeURIComponent(query)}&search_type=keyword_unordered`;
}

function formatWhatsAppMessage(
  prompt: string,
  country: string,
  suggestedItems: { keyword: string; search_url: string }[],
  angles: Array<{ category: string; keywords: string[] }> | any[] = [],
  explanation: string = ''
): string {
  const numbers = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
  let msg = `🎯 *اقتراحات الكلمات البحثية لمكتبة الإعلانات*\n`;
  msg += `🔍 *المجال المطلوب:* ${prompt}\n`;
  msg += `🌍 *الدولة:* ${country === 'EG' ? 'مصر 🇪🇬' : country}\n`;
  msg += `══════════════\n`;
  msg += `💡 *أقوى الكلمات المفتاحية للبحث عن المنافسين:*\n\n`;

  suggestedItems.forEach((item, idx) => {
    const icon = numbers[idx] || `🔹`;
    msg += `${icon} *${item.keyword}*\n`;
    msg += `🔗 رابط البحث المباشر: ${item.search_url}\n\n`;
  });

  if (angles && angles.length > 0) {
    msg += `══════════════\n`;
    msg += `📌 *زوايا الاستهداف المقترحة (Hooks):*\n`;
    angles.forEach((angle: any) => {
      if (typeof angle === 'string') {
        msg += `• ${angle}\n`;
      } else if (angle && typeof angle === 'object') {
        const cat = angle.category || 'فئة';
        const kws = Array.isArray(angle.keywords) ? angle.keywords.join('، ') : '';
        msg += `• *${cat}:* ${kws}\n`;
      }
    });
    msg += `\n`;
  }

  if (explanation && explanation.trim()) {
    msg += `💡 *تحليل الذكاء الاصطناعي:*\n${explanation.trim()}\n\n`;
  }

  msg += `══════════════\n`;
  msg += `👉 *لجلب إعلانات المنافسين:* اختر أي كلمة من القائمة وابحث بها مباشرة لسحب الإعلانات الحية!`;

  return msg;
}

async function handleSuggestKeywords(
  prompt: string,
  country: string = 'EG',
  excludeTerms: string[] = [],
  forceRefresh: boolean = false
) {
  const cleanPrompt = prompt.trim();
  const cleanCountry = (country || 'EG').trim().toUpperCase();

  if (!cleanPrompt) {
    return {
      success: false,
      error: 'الرجاء إدخال مجال البحث أو وصف النشاط (prompt / query)',
      status: 400,
    };
  }

  const cacheKey = `suggest_${cleanPrompt.toLowerCase()}_${cleanCountry}`;
  if (!forceRefresh) {
    const cached = memoryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return { success: true, data: { ...cached.data, from_cache: true } };
    }
  }

  try {
    const result = await vertexAI.suggestNicheKeywords(cleanPrompt, cleanCountry, excludeTerms);
    const rawTerms = Array.isArray(result.suggestedTerms) ? result.suggestedTerms : [];

    const suggestedItems = rawTerms.map((term: string) => ({
      keyword: term.trim(),
      search_url: buildMetaAdLibrarySearchUrl(term.trim(), cleanCountry),
    }));

    const formattedMessage = formatWhatsAppMessage(
      cleanPrompt,
      cleanCountry,
      suggestedItems,
      result.angles || [],
      result.explanation || ''
    );

    const payload = {
      query: cleanPrompt,
      country: cleanCountry,
      count: suggestedItems.length,
      keywords_list: suggestedItems.map((i) => i.keyword),
      suggested_keywords: suggestedItems,
      angles: result.angles || [],
      explanation: result.explanation || '',
      formatted_message: formattedMessage,
      created_at: new Date().toISOString(),
    };

    memoryCache.set(cacheKey, { data: payload, timestamp: Date.now() });

    return { success: true, data: payload };
  } catch (error: any) {
    console.error('[Merchant Suggest Keywords API Error]:', error);
    return {
      success: false,
      error: error.message || 'فشل توليد الكلمات المفتاحية بالذكاء الاصطناعي',
      status: 500,
    };
  }
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
    const prompt = body.prompt || body.query || body.niche || body.search || '';
    const country = body.country || 'EG';
    const excludeTerms = Array.isArray(body.exclude_terms || body.excludeTerms)
      ? body.exclude_terms || body.excludeTerms
      : [];
    const forceRefresh = Boolean(body.force_refresh);

    const res = await handleSuggestKeywords(prompt, country, excludeTerms, forceRefresh);
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
  const prompt =
    searchParams.get('prompt') ||
    searchParams.get('q') ||
    searchParams.get('query') ||
    searchParams.get('niche') ||
    '';
  const country = searchParams.get('country') || 'EG';
  const excludeParam = searchParams.get('exclude') || searchParams.get('exclude_terms') || '';
  const excludeTerms = excludeParam
    ? excludeParam.split(',').map((s) => s.trim()).filter(Boolean)
    : [];
  const forceRefresh = searchParams.get('force_refresh') === 'true';

  const res = await handleSuggestKeywords(prompt, country, excludeTerms, forceRefresh);
  if (!res.success) {
    return NextResponse.json({ success: false, error: res.error }, { status: res.status || 400 });
  }

  return NextResponse.json({ success: true, ...res.data });
}
