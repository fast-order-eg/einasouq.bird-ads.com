import { NextResponse } from 'next/server';

interface CacheItem {
  data: any;
  timestamp: number;
}

// In-memory cache map to avoid hitting Meta rate limits (TTL: 5 minutes)
const memoryCache = new Map<string, CacheItem>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function validateApiKey(req: Request): boolean {
  const expectedKey = process.env.MERCHANT_API_KEY || 'fastorder_merchant_secure_api_key_2026';
  const headerKey = req.headers.get('x-api-key') || req.headers.get('X-API-KEY');
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  const bearerKey = authHeader?.startsWith('Bearer ') ? authHeader.replace(/^Bearer\s+/, '').trim() : null;

  const providedKey = (headerKey || bearerKey || '').trim();
  return Boolean(providedKey && providedKey === expectedKey.trim());
}

/**
 * تطبيع النصوص العربية لتحسين دقة البحث (يوحد الألف والياء والتاء المربوطة ويزيل التشكيل)
 */
function normalizeArabicText(text: string): string {
  if (!text) return '';
  return text
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u065F]/g, '');
}

/**
 * تطبيع المدخلات الزمنية لدعم الكلمات العربية والإنجليزية لميتا Graph API
 */
function normalizeDatePreset(preset?: string): string {
  if (!preset) return 'last_7d';
  const p = preset.trim().toLowerCase();
  if (['الكل', 'كل الفترات', 'الإجمالي', 'الاجمالي', 'all', 'all_time', 'maximum'].includes(p)) return 'maximum';
  if (['اليوم', 'today'].includes(p)) return 'today';
  if (['امس', 'أمس', 'yesterday'].includes(p)) return 'yesterday';
  if (['اخر 3 ايام', 'آخر 3 أيام', 'last_3d'].includes(p)) return 'last_3d';
  if (['اخر 7 ايام', 'آخر 7 أيام', 'last_7d'].includes(p)) return 'last_7d';
  if (['اخر 14 يوم', 'آخر 14 يوم', 'last_14d'].includes(p)) return 'last_14d';
  if (['اخر 30 يوم', 'آخر 30 يوم', 'last_30d'].includes(p)) return 'last_30d';
  if (['هذا الشهر', 'الشهر الحالي', 'this_month'].includes(p)) return 'this_month';
  if (['الشهر الماضي', 'اخر شهر', 'آخر شهر', 'last_month'].includes(p)) return 'last_month';

  const validPresets = ['today', 'yesterday', 'last_3d', 'last_7d', 'last_14d', 'last_30d', 'this_month', 'last_month', 'maximum'];
  return validPresets.includes(p) ? p : 'last_7d';
}

/**
 * تطبيع فلتر الحالة المدخل لدعم العربية والإنجليزية
 */
function normalizeStatusFilter(filter?: string): string {
  if (!filter) return 'ACTIVE';
  const f = filter.trim().toUpperCase();
  if (['ACTIVE', 'نشطة', 'نشط', 'شغالة', 'شغال'].includes(f)) return 'ACTIVE';
  if (['PAUSED', 'متوقفة', 'متوقف', 'موقوفة'].includes(f)) return 'PAUSED';
  if (['ALL', 'الكل', 'جميع', 'كافة', 'كل', 'المكتملة', 'المكتمله', 'المنتهية', 'المنتهيه', 'المرفوضة', 'المرفوضه', 'COMPLETED'].includes(f)) return 'ALL';
  return f;
}

/**
 * استخراج سبب الرفض البشري من كائن ad_review_feedback
 */
function extractDisapprovalReason(feedback: any): string | null {
  if (!feedback) return null;
  if (feedback.global && typeof feedback.global === 'object') {
    const keys = Object.keys(feedback.global);
    if (keys.length > 0) return keys[0];
  }
  if (feedback.placement_specific && typeof feedback.placement_specific === 'object') {
    for (const p of Object.values(feedback.placement_specific)) {
      if (p && typeof p === 'object') {
        const k = Object.keys(p);
        if (k.length > 0) return k[0];
      }
    }
  }
  return null;
}

/**
 * استخراج ملخص المشاكل أو الأخطاء من issues_info
 */
function extractIssueSummary(issues: any[]): string | null {
  if (!Array.isArray(issues) || issues.length === 0) return null;
  const first = issues[0];
  return first?.error_summary || first?.error_message || null;
}

/**
 * تبني استعلام الفترة الزمنية لـ Meta Graph API
 * ملاحظة هامة: بريسيتات ميتا مثل last_7d و last_3d و last_14d و last_30d تستبعد اليوم الحالي تلقائياً (Not including today).
 * لذلك نقوم بتحويلها إلى time_range يشمل اليوم الحالي حتى اللحظة لضمان مطابقة توقعات التاجر وأوردرات المتجر.
 */
function buildInsightsTimeClause(
  safePreset: string,
  customTimeRange?: { since: string; until: string } | null
): { clause: string; rangeKey: string } {
  if (customTimeRange?.since && customTimeRange?.until) {
    const since = customTimeRange.since.trim();
    const until = customTimeRange.until.trim();
    return {
      clause: `time_range({'since':'${since}','until':'${until}'})`,
      rangeKey: `custom_${since}_${until}`,
    };
  }

  // حساب تاريخ اليوم بتوقيت القاهرة Africa/Cairo
  const now = new Date();
  const cairoFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const todayStr = cairoFormatter.format(now); // YYYY-MM-DD
  const [y, m, d] = todayStr.split('-').map(Number);
  const todayDate = new Date(Date.UTC(y, m - 1, d));

  const formatUtc = (date: Date) => date.toISOString().split('T')[0];

  if (safePreset === 'last_7d') {
    const since = new Date(todayDate);
    since.setUTCDate(todayDate.getUTCDate() - 6);
    return {
      clause: `time_range({'since':'${formatUtc(since)}','until':'${todayStr}'})`,
      rangeKey: `last_7d_${todayStr}`,
    };
  }

  if (safePreset === 'last_3d') {
    const since = new Date(todayDate);
    since.setUTCDate(todayDate.getUTCDate() - 2);
    return {
      clause: `time_range({'since':'${formatUtc(since)}','until':'${todayStr}'})`,
      rangeKey: `last_3d_${todayStr}`,
    };
  }

  if (safePreset === 'last_14d') {
    const since = new Date(todayDate);
    since.setUTCDate(todayDate.getUTCDate() - 13);
    return {
      clause: `time_range({'since':'${formatUtc(since)}','until':'${todayStr}'})`,
      rangeKey: `last_14d_${todayStr}`,
    };
  }

  if (safePreset === 'last_30d') {
    const since = new Date(todayDate);
    since.setUTCDate(todayDate.getUTCDate() - 29);
    return {
      clause: `time_range({'since':'${formatUtc(since)}','until':'${todayStr}'})`,
      rangeKey: `last_30d_${todayStr}`,
    };
  }

  // today, yesterday, this_month, last_month, maximum تعتمد على بريسيت ميتا الأصلي
  return {
    clause: `date_preset(${safePreset})`,
    rangeKey: safePreset,
  };
}

/**
 * دالة مساعدة لجلب قائمة معرفات الحملات التابعة لحساب إعلاني معين
 */
async function fetchCampaignIdsForAccount(
  accountId: string,
  token: string,
  statusFilter?: string,
  search?: string
): Promise<{ success: boolean; ids: string[]; error?: string }> {
  try {
    const cleanAccId = accountId.trim();
    const formattedAccId = cleanAccId.startsWith('act_') ? cleanAccId : `act_${cleanAccId}`;
    const cleanStatus = normalizeStatusFilter(statusFilter);

    let url = `https://graph.facebook.com/v21.0/${formattedAccId}/campaigns?fields=id,name,status,effective_status,objective,updated_time,start_time,created_time&limit=100&access_token=${token}`;

    if (cleanStatus === 'ALL') {
      // لا يتم تطبيق أي فلتر لجلب جميع الحملات بما فيها المتوقفة والمكتملة
    } else if (cleanStatus === 'ACTIVE') {
      // جلب الحملات النشطة وقيد المراجعة وفي مرحلة التحضير والتي بها مشاكل أو تم رفضها
      url += `&effective_status=['ACTIVE','PENDING_REVIEW','IN_PROCESS','WITH_ISSUES','DISAPPROVED']`;
    } else if (cleanStatus === 'PAUSED') {
      url += `&effective_status=['PAUSED','CAMPAIGN_PAUSED','ADSET_PAUSED']`;
    } else {
      url += `&effective_status=['${cleanStatus}']`;
    }

    const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
    const data = await res.json();

    if (data.error) {
      return { success: false, ids: [], error: data.error.message || 'فشل جلب حملات الحساب الإعلاني' };
    }

    let campaigns = data.data || [];

    // الترتيب حسب الأحدث تنازلياً دائماً
    campaigns.sort((a: any, b: any) => {
      const timeA = new Date(a.updated_time || a.start_time || a.created_time || 0).getTime();
      const timeB = new Date(b.updated_time || b.start_time || b.created_time || 0).getTime();
      return timeB - timeA;
    });

    if (search && search.trim()) {
      const qNorm = normalizeArabicText(search);
      campaigns = campaigns.filter((c: any) => {
        if (!c.name) return false;
        return normalizeArabicText(c.name).includes(qNorm);
      });
    }

    const ids = campaigns.map((c: any) => c.id).slice(0, 30);
    return { success: true, ids };
  } catch (err: any) {
    return { success: false, ids: [], error: err.message || 'خطأ أثناء الاتصال بميتا لجلب حملات الحساب' };
  }
}

/**
 * دالة مساعدة لجلب رصيد الحساب الإعلاني (للدفع المسبق والرصيد المتاح)
 */
async function fetchAccountBalanceInfo(accountId: string, token: string): Promise<{
  account_id: string;
  account_name: string;
  account_status: number;
  currency: string;
  balance: number;
  balance_formatted: string;
  is_prepay: boolean;
  spend_cap: number;
  amount_spent: number;
} | null> {
  try {
    const cleanAccId = accountId.trim();
    const formattedId = cleanAccId.startsWith('act_') ? cleanAccId : `act_${cleanAccId}`;
    const fields = 'id,name,account_id,account_status,currency,amount_spent,balance,spend_cap,is_prepay_account,funding_source_details{display_string}';
    const url = `https://graph.facebook.com/v21.0/${formattedId}?fields=${encodeURIComponent(fields)}&access_token=${token}`;

    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const data = await res.json();

    if (data.error || !data.id) {
      return null;
    }

    const spendCap = parseFloat(data.spend_cap || '0') / 100;
    const amountSpent = parseFloat(data.amount_spent || '0') / 100;
    const rawBalance = parseFloat(data.balance || '0') / 100;

    let availableBalance = 0;
    if (spendCap > 0 && spendCap >= amountSpent) {
      availableBalance = Number((spendCap - amountSpent).toFixed(2));
    } else if (rawBalance > 0) {
      availableBalance = Number(rawBalance.toFixed(2));
    }

    const currency = data.currency || 'EGP';

    return {
      account_id: data.account_id || cleanAccId.replace('act_', ''),
      account_name: data.name || '',
      account_status: data.account_status,
      currency,
      balance: availableBalance,
      balance_formatted: `${availableBalance} ${currency}`,
      is_prepay: Boolean(data.is_prepay_account),
      spend_cap: spendCap,
      amount_spent: amountSpent,
    };
  } catch (err: any) {
    console.error('[Fetch Account Balance Error]:', err.message);
    return null;
  }
}

/**
 * دالة مساعدة لاستخراج نوع وعدد النتائج وتكلفة النتيجة (CPA) بدقة حسب هدف الحملة
 */
function extractResultsAndCpa(
  objectiveStr: string,
  actions: any[] = [],
  costPerActions: any[] = [],
  spend: number,
  clicks: number,
  hasMessagingCta: boolean = false,
  channelInfo?: { isInstagram?: boolean; isWhatsapp?: boolean; isMessenger?: boolean }
) {
  const obj = (objectiveStr || '').toUpperCase();

  const getActionValue = (types: string[]): number => {
    for (const type of types) {
      const match = actions.find((a) => a.action_type === type);
      if (match && match.value) {
        const val = parseInt(match.value, 10);
        if (!isNaN(val) && val > 0) return val;
      }
    }
    return 0;
  };

  const getCpaValue = (types: string[]): number | null => {
    for (const type of types) {
      const match = costPerActions.find((a) => a.action_type === type);
      if (match && match.value) {
        const val = parseFloat(match.value);
        if (!isNaN(val) && val > 0) return Number(val.toFixed(2));
      }
    }
    return null;
  };

  const isMessagingObjective =
    obj === 'MESSAGES' ||
    obj === 'OUTCOME_ENGAGEMENT' ||
    hasMessagingCta;

  const isSalesObjective =
    obj === 'OUTCOME_SALES' ||
    obj === 'CONVERSIONS';

  const isLeadsObjective =
    obj === 'OUTCOME_LEADS' ||
    obj === 'LEAD_GENERATION';

  let resultsCount = 0;
  let resultType = 'click';
  let resultLabel = 'نقرات على الرابط';
  let cpa = 0;

  if (isMessagingObjective) {
    // 1. حملات الرسائل والواتساب وإنستغرام دايركت
    const msgCount = getActionValue([
      'onsite_conversion.messaging_conversation_started_7d',
      'onsite_conversion.total_messaging_connection',
      'messaging_conversation_started_7d',
      'onsite_conversion.messaging_first_reply',
    ]);
    const metaCpa = getCpaValue([
      'onsite_conversion.messaging_conversation_started_7d',
      'onsite_conversion.total_messaging_connection',
    ]);

    resultsCount = msgCount;
    if (channelInfo?.isInstagram) {
      resultType = 'instagram';
      resultLabel = 'رسائل إنستغرام دايركت';
    } else if (channelInfo?.isWhatsapp) {
      resultType = 'whatsapp';
      resultLabel = 'رسائل واتساب';
    } else if (channelInfo?.isMessenger) {
      resultType = 'messenger';
      resultLabel = 'رسائل ماسنجر';
    } else {
      resultType = 'messages';
      resultLabel = 'رسائل';
    }
    cpa = metaCpa !== null ? metaCpa : (resultsCount > 0 ? Number((spend / resultsCount).toFixed(2)) : 0);
  } else if (isSalesObjective) {
    // 2. حملات مبيعات المتجر (Conversions / Pixel Purchases)
    const purchases = getActionValue([
      'purchase',
      'offsite_conversion.fb_pixel_purchase',
      'omni_purchase',
      'onsite_web_purchase',
      'web_in_store_purchase',
    ]);
    const metaCpa = getCpaValue([
      'purchase',
      'offsite_conversion.fb_pixel_purchase',
      'omni_purchase',
    ]);

    resultsCount = purchases;
    resultType = 'purchase';
    resultLabel = 'طلبات شراء (متجر)';
    cpa = metaCpa !== null ? metaCpa : (resultsCount > 0 ? Number((spend / resultsCount).toFixed(2)) : 0);
  } else if (isLeadsObjective) {
    // 3. حملات بيانات العملاء المحتملين
    const leads = getActionValue([
      'lead',
      'onsite_conversion.lead',
      'onsite_conversion.lead_grouped',
    ]);
    const metaCpa = getCpaValue(['lead', 'onsite_conversion.lead']);

    resultsCount = leads;
    resultType = 'lead';
    resultLabel = 'بيانات عملاء';
    cpa = metaCpa !== null ? metaCpa : (resultsCount > 0 ? Number((spend / resultsCount).toFixed(2)) : 0);
  } else {
    // 4. حملات أخرى / ترافيك أو اكتشاف تلقائي
    const purchases = getActionValue(['purchase', 'offsite_conversion.fb_pixel_purchase', 'omni_purchase']);
    const msgCount = getActionValue(['onsite_conversion.messaging_conversation_started_7d', 'onsite_conversion.total_messaging_connection']);
    const leads = getActionValue(['lead', 'onsite_conversion.lead']);

    if (purchases > 0) {
      resultsCount = purchases;
      resultType = 'purchase';
      resultLabel = 'طلبات شراء (متجر)';
      cpa = Number((spend / resultsCount).toFixed(2));
    } else if (msgCount > 0) {
      resultsCount = msgCount;
      resultType = 'messages';
      resultLabel = 'رسائل';
      cpa = Number((spend / resultsCount).toFixed(2));
    } else if (leads > 0) {
      resultsCount = leads;
      resultType = 'lead';
      resultLabel = 'بيانات عملاء';
      cpa = Number((spend / resultsCount).toFixed(2));
    } else {
      resultsCount = clicks;
      resultType = 'click';
      resultLabel = 'زيارات ونقرات';
      cpa = clicks > 0 ? Number((spend / clicks).toFixed(2)) : 0;
    }
  }

  return { resultsCount, resultType, resultLabel, cpa };
}

/**
 * دالة مساعدة لاستخراج رابط المنشور والمعاينة المباشر للإعلان وتحديد المنصة الأصلية بدقة
 */
function extractAdUrls(cr: any = {}, campaignName: string = '', adName: string = '') {
  let instagramUrl: string | null = null;
  let facebookUrl: string | null = null;

  // 1. استخراج رابط إنستغرام لو موجود
  if (cr.instagram_permalink_url) {
    instagramUrl = cr.instagram_permalink_url;
  }

  // 2. استخراج رابط فيسبوك لو المنشور منشور على صفحة فيسبوك
  const fbStoryId = cr.object_story_id || cr.effective_object_story_id;
  if (fbStoryId) {
    const parts = String(fbStoryId).split('_');
    if (parts.length === 2) {
      facebookUrl = `https://www.facebook.com/posts/${parts[1]}`;
    } else {
      facebookUrl = `https://www.facebook.com/${fbStoryId}`;
    }
  }

  // 3. تحديد المنصة الأصلية الأساسية (Facebook vs Instagram)
  const hasSourceInsta = Boolean(cr.source_instagram_media_id);
  const hasOriginalFbPost = Boolean(cr.object_story_id);
  const campNameLower = (campaignName || '').toLowerCase();
  const adNameLower = (adName || '').toLowerCase();
  const cta = (cr.call_to_action_type || cr.cta_type || '').toUpperCase();

  const isInstaNamed =
    campNameLower.includes('انستا') ||
    campNameLower.includes('انستجرام') ||
    campNameLower.includes('انستقرام') ||
    campNameLower.includes('insta') ||
    campNameLower.includes('instagram') ||
    adNameLower.includes('انستا') ||
    adNameLower.includes('انستجرام') ||
    adNameLower.includes('انستقرام') ||
    adNameLower.includes('insta') ||
    adNameLower.includes('instagram');

  const isInstaCta = cta === 'INSTAGRAM_MESSAGE' || cta.includes('INSTAGRAM');
  const isFbNamed = campNameLower.includes('فيس') || campNameLower.includes('فيسبوك') || campNameLower.includes('facebook') || campNameLower.includes('fb');

  let isInstagramPrimary = false;

  if (hasSourceInsta || isInstaCta || instagramUrl) {
    isInstagramPrimary = true;
  } else if (isInstaNamed) {
    isInstagramPrimary = true;
  } else if (hasOriginalFbPost && !isFbNamed) {
    isInstagramPrimary = false;
  } else if (facebookUrl) {
    isInstagramPrimary = false;
  }

  const platform: 'INSTAGRAM' | 'FACEBOOK' = isInstagramPrimary ? 'INSTAGRAM' : 'FACEBOOK';
  const platformLabel = isInstagramPrimary ? 'إنستغرام' : 'فيسبوك';
  const postUrl = isInstagramPrimary ? (instagramUrl || facebookUrl) : (facebookUrl || instagramUrl);
  const postUrlLabel = isInstagramPrimary ? 'رابط المنشور (إنستغرام)' : 'رابط المنشور (فيسبوك)';

  const previewUrl = postUrl || cr.link_url || null;

  return {
    post_url: postUrl,
    preview_url: previewUrl,
    link_url: cr.link_url || null,
    instagram_url: instagramUrl,
    facebook_url: facebookUrl,
    platform,
    platform_label: platformLabel,
    post_url_label: postUrlLabel,
    has_both: Boolean(facebookUrl && instagramUrl),
  };
}

async function handleRequest(
  campaignIds: string[],
  datePreset: string = 'last_7d',
  forceRefresh: boolean = false,
  extraMetadata: { account_id?: string; search?: string } = {},
  customTimeRange?: { since: string; until: string } | null
) {
  const token = process.env.META_USER_TOKEN;
  if (!token) {
    return { success: false, error: 'توكن الوصول لـ Meta Graph API غير مهيأ في الخادم', status: 500 };
  }

  const cleanIds = Array.from(new Set(campaignIds.map((id) => String(id).trim()).filter(Boolean)));
  if (cleanIds.length === 0) {
    return { success: false, error: 'قائمة معرفات الحملات (campaign_ids) مطلوبة وفارغة', status: 400 };
  }

  const safePreset = normalizeDatePreset(datePreset);
  const { clause: timeClause, rangeKey } = buildInsightsTimeClause(safePreset, customTimeRange);
  const cacheKey = `merchant_${cleanIds.slice().sort().join('_')}_${rangeKey}`;
  if (!forceRefresh) {
    const cached = memoryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return { success: true, data: { ...cached.data, from_cache: true } };
    }
  }

  // Construct Meta Graph API field query with attribution windows and account attribution setting
  const insightsSubquery = `insights.${timeClause}.use_account_attribution_setting(true).action_attribution_windows(['7d_click','1d_view']){spend,impressions,reach,clicks,cpc,cpm,ctr,actions,action_values,cost_per_action_type,purchase_roas}`;
  const fields = [
    'id',
    'name',
    'account_id',
    'status',
    'effective_status',
    'objective',
    'daily_budget',
    'lifetime_budget',
    'start_time',
    'stop_time',
    insightsSubquery,
    `adsets{id,name,status,effective_status,daily_budget,lifetime_budget,start_time,end_time,destination_type,optimization_goal,targeting,${insightsSubquery}}`,
    `ads{id,name,status,effective_status,adset_id,ad_review_feedback,issues_info,creative{id,name,title,body,image_url,thumbnail_url,video_id,link_url,call_to_action_type,object_story_id,source_instagram_media_id,effective_object_story_id,instagram_permalink_url,asset_feed_spec},${insightsSubquery}}`,
  ].join(',');

  try {
    let effectiveIds = [...cleanIds];
    const url = `https://graph.facebook.com/v21.0/?ids=${effectiveIds.join(',')}&fields=${encodeURIComponent(fields)}&access_token=${token}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    let rawData: any = await res.json();

    // If batch fails (e.g. one ID is an Ad ID / AdSet ID lacking 'objective', or a deleted ID),
    // automatically resolve any Ad/AdSet IDs to their parent campaign_id and fetch individually
    if (rawData.error) {
      const recoveredData: Record<string, any> = {};
      const resolvedIds: string[] = [];

      await Promise.all(
        effectiveIds.map(async (id) => {
          try {
            let targetCampaignId = id;
            // Check if this ID is an Ad or AdSet that has a parent campaign_id
            const probeRes = await fetch(
              `https://graph.facebook.com/v21.0/${id}?fields=id,campaign_id&access_token=${token}`,
              { signal: AbortSignal.timeout(8000) }
            );
            const probeJson = await probeRes.json();
            if (probeJson?.campaign_id) {
              targetCampaignId = String(probeJson.campaign_id);
            }

            const singleRes = await fetch(
              `https://graph.facebook.com/v21.0/${targetCampaignId}?fields=${encodeURIComponent(fields)}&access_token=${token}`,
              { signal: AbortSignal.timeout(12000) }
            );
            const singleJson = await singleRes.json();
            if (singleJson && !singleJson.error && singleJson.id) {
              recoveredData[targetCampaignId] = singleJson;
              resolvedIds.push(targetCampaignId);
            } else {
              resolvedIds.push(id);
            }
          } catch {
            resolvedIds.push(id);
          }
        })
      );

      if (Object.keys(recoveredData).length > 0) {
        rawData = recoveredData;
        effectiveIds = Array.from(new Set(resolvedIds));
      } else {
        return {
          success: false,
          error: rawData.error.message || 'خطأ في جلب بيانات الحملات من فيسبوك',
          status: 200,
        };
      }
    }

    // Resolve Account ID and fetch fresh balance info
    let resolvedAccountId = extraMetadata.account_id || null;
    if (!resolvedAccountId) {
      for (const cId of effectiveIds) {
        if (rawData[cId]?.account_id) {
          resolvedAccountId = rawData[cId].account_id;
          break;
        }
      }
    }

    let accountInfo: any = null;
    if (resolvedAccountId) {
      accountInfo = await fetchAccountBalanceInfo(resolvedAccountId, token);
    }

    let totalSpend = 0;
    let totalDailyBudget = 0;
    let totalPurchases = 0;
    let totalPurchaseValue = 0;
    let totalConversations = 0;
    let totalLeads = 0;
    let totalImpressions = 0;
    let totalReach = 0;
    let totalClicks = 0;
    let activeCampaignsCount = 0;

    const formattedCampaigns = effectiveIds.map((cId) => {
      const camp = rawData[cId];
      if (!camp) {
        return {
          id: cId,
          name: `حملة #${cId}`,
          status: 'NOT_FOUND',
          effective_status: 'NOT_FOUND',
          start_time: null,
          stop_time: null,
          error: 'الحملة غير موجودة أو انتهت صلاحية الوصول إليها',
        };
      }

      const isActive = camp.status === 'ACTIVE' && camp.effective_status === 'ACTIVE';
      if (isActive) activeCampaignsCount++;

      const campInsights = camp.insights?.data?.[0] || {};
      const spend = parseFloat(campInsights.spend || '0');
      const impressions = parseInt(campInsights.impressions || '0', 10);
      const reach = parseInt(campInsights.reach || '0', 10);
      const clicks = parseInt(campInsights.clicks || '0', 10);
      const ctr = parseFloat(campInsights.ctr || '0');

      // Budgets
      const dailyBudgetNum = camp.daily_budget ? parseFloat(camp.daily_budget) / 100 : 0;
      const lifetimeBudgetNum = camp.lifetime_budget ? parseFloat(camp.lifetime_budget) / 100 : 0;
      if (isActive && dailyBudgetNum > 0) {
        totalDailyBudget += dailyBudgetNum;
      }

      // Check if primary CTA in campaign is messaging
      const rawAds = camp.ads?.data || [];
      const hasMessagingCta = rawAds.some((ad: any) => {
        const cta = ad.creative?.call_to_action_type;
        return cta === 'MESSAGE_PAGE' || cta === 'SEND_MESSAGE' || cta === 'WHATSAPP_MESSAGE';
      });

      // Actions extraction
      const actions: any[] = campInsights.actions || [];
      const actionValues: any[] = campInsights.action_values || [];
      const costPerActions: any[] = campInsights.cost_per_action_type || [];

      // Purchases & Value
      const purchaseAction = actions.find(
        (a) => a.action_type === 'purchase' || a.action_type === 'omni_purchase' || a.action_type === 'offsite_conversion.fb_pixel_purchase' || a.action_type === 'onsite_web_purchase'
      );
      const purchases = parseInt(purchaseAction?.value || '0', 10);

      const purchaseValAction = actionValues.find(
        (a) => a.action_type === 'purchase' || a.action_type === 'omni_purchase'
      );
      const purchaseValue = parseFloat(purchaseValAction?.value || '0');

      // Conversations
      const msgAction = actions.find(
        (a) =>
          a.action_type === 'onsite_conversion.messaging_conversation_started_7d' ||
          a.action_type === 'onsite_conversion.total_messaging_connection' ||
          a.action_type === 'messaging_conversation_started_7d'
      );
      const conversations = parseInt(msgAction?.value || '0', 10);

      // Leads
      const leadAction = actions.find((a) => a.action_type === 'lead' || a.action_type === 'onsite_conversion.lead');
      const leads = parseInt(leadAction?.value || '0', 10);

      const rawAdsets = camp.adsets?.data || [];
      const primaryDest = (rawAdsets[0]?.destination_type || '').toUpperCase();
      const campNameLower = (camp.name || '').toLowerCase();

      const isInstaCamp =
        primaryDest.includes('INSTAGRAM') ||
        campNameLower.includes('انستا') ||
        campNameLower.includes('انستجرام') ||
        campNameLower.includes('انستقرام') ||
        campNameLower.includes('instagram') ||
        campNameLower.includes('insta') ||
        rawAds.some((ad: any) => {
          const cta = (ad.creative?.call_to_action_type || '').toUpperCase();
          const cr = ad.creative || {};
          return cta === 'INSTAGRAM_MESSAGE' || cta.includes('INSTAGRAM') || Boolean(cr.instagram_permalink_url);
        });

      const isWhatsappCamp =
        primaryDest.includes('WHATSAPP') ||
        campNameLower.includes('واتس') ||
        campNameLower.includes('whatsapp') ||
        rawAds.some((ad: any) => (ad.creative?.call_to_action_type || '').toUpperCase() === 'WHATSAPP_MESSAGE');

      const isMessengerCamp =
        primaryDest.includes('MESSENGER') ||
        campNameLower.includes('ماسنجر') ||
        campNameLower.includes('messenger');

      const campChannelInfo = { isInstagram: isInstaCamp, isWhatsapp: isWhatsappCamp, isMessenger: isMessengerCamp };

      // Determine Results & CPA according to objective
      const { resultsCount, resultType, resultLabel, cpa } = extractResultsAndCpa(
        camp.objective,
        actions,
        costPerActions,
        spend,
        clicks,
        hasMessagingCta,
        campChannelInfo
      );

      // Conversion Rate (Results ÷ Clicks)
      const conversionRate = clicks > 0 ? Number(((resultsCount / clicks) * 100).toFixed(2)) : 0;

      // ROAS (Return On Ad Spend)
      let roas = 0;
      if (campInsights.purchase_roas?.[0]?.value) {
        roas = Number(parseFloat(campInsights.purchase_roas[0].value).toFixed(2));
      } else if (spend > 0 && purchaseValue > 0) {
        roas = Number((purchaseValue / spend).toFixed(2));
      }

      // Aggregate global counters
      totalSpend += spend;
      totalImpressions += impressions;
      totalReach += reach;
      totalClicks += clicks;
      totalPurchases += purchases;
      totalPurchaseValue += purchaseValue;
      totalConversations += conversations;
      totalLeads += leads;

      // Determine Stop Time from Campaign or Adsets
      let resolvedStopTime = camp.stop_time || null;
      if (!resolvedStopTime && rawAdsets.length > 0) {
        for (const aset of rawAdsets) {
          if (aset.end_time) {
            resolvedStopTime = aset.end_time;
            break;
          }
        }
      }

      // Format Ads and Creatives
      const ads = rawAds.map((ad: any) => {
        const adInsights = ad.insights?.data?.[0] || {};
        const adSpend = parseFloat(adInsights.spend || '0');
        const adClicks = parseInt(adInsights.clicks || '0', 10);
        const adCtr = parseFloat(adInsights.ctr || '0');
        const adActions: any[] = adInsights.actions || [];
        const adCostPerActions: any[] = adInsights.cost_per_action_type || [];
        const cr = ad.creative || {};

        const adRes = extractResultsAndCpa(
          camp.objective,
          adActions,
          adCostPerActions,
          adSpend,
          adClicks,
          hasMessagingCta,
          campChannelInfo
        );

        const urls = extractAdUrls(cr, camp.name, ad.name);
        const adDisapproval = extractDisapprovalReason(ad.ad_review_feedback);
        const adIssue = extractIssueSummary(ad.issues_info);

        return {
          id: ad.id,
          name: ad.name,
          adset_id: ad.adset_id,
          status: ad.status,
          effective_status: ad.effective_status,
          disapproval_reason: adDisapproval || null,
          issue_summary: adIssue || null,
          spend: Number(adSpend.toFixed(2)),
          clicks: adClicks,
          ctr: Number(adCtr.toFixed(2)),
          results: adRes.resultsCount,
          cpa: adRes.cpa,
          post_url: urls.post_url,
          post_url_label: urls.post_url_label,
          platform: urls.platform,
          platform_label: urls.platform_label,
          instagram_url: urls.instagram_url,
          facebook_url: urls.facebook_url,
          creative: {
            title: cr.title || '',
            body: cr.body || '',
            image_url: cr.image_url || cr.thumbnail_url || null,
            thumbnail_url: cr.thumbnail_url || cr.image_url || null,
            video_id: cr.video_id || null,
            is_video: Boolean(cr.video_id),
            cta_type: cr.call_to_action_type || 'LEARN_MORE',
            preview_url: urls.preview_url,
            post_url: urls.post_url,
            post_url_label: urls.post_url_label,
            platform: urls.platform,
            platform_label: urls.platform_label,
            link_url: urls.link_url,
            effective_object_story_id: cr.effective_object_story_id || null,
            instagram_permalink_url: cr.instagram_permalink_url || urls.instagram_url || null,
            facebook_post_url: urls.facebook_url,
          },
        };
      });

      // Format AdSets (including their respective ads)
      const adsets = rawAdsets.map((aset: any) => {
        const aInsights = aset.insights?.data?.[0] || {};
        const aSpend = parseFloat(aInsights.spend || '0');
        const aClicks = parseInt(aInsights.clicks || '0', 10);
        const aCtr = parseFloat(aInsights.ctr || '0');
        const aActions: any[] = aInsights.actions || [];
        const aCostPerActions: any[] = aInsights.cost_per_action_type || [];

        const asetRes = extractResultsAndCpa(
          camp.objective,
          aActions,
          aCostPerActions,
          aSpend,
          aClicks,
          hasMessagingCta,
          campChannelInfo
        );

        const adsetAds = ads.filter((a: any) => a.adset_id === aset.id);

        return {
          id: aset.id,
          name: aset.name,
          status: aset.status,
          effective_status: aset.effective_status,
          destination_type: aset.destination_type || null,
          optimization_goal: aset.optimization_goal || null,
          targeting: aset.targeting || null,
          start_time: aset.start_time || null,
          stop_time: aset.end_time || null,
          daily_budget: aset.daily_budget ? parseFloat(aset.daily_budget) / 100 : null,
          spend: Number(aSpend.toFixed(2)),
          results: asetRes.resultsCount,
          result_type: asetRes.resultType,
          result_label: asetRes.resultLabel,
          cpa: asetRes.cpa,
          ctr: Number(aCtr.toFixed(2)),
          ads_count: adsetAds.length,
          ads: adsetAds,
        };
      });

      // Primary / Active ad resolution
      const disapprovedAd = ads.find((a: any) => a.effective_status === 'DISAPPROVED' || a.status === 'DISAPPROVED');
      const withIssuesAd = ads.find((a: any) => a.effective_status === 'WITH_ISSUES');
      const pendingReviewAd = ads.find((a: any) => a.effective_status === 'PENDING_REVIEW');
      const inProcessAd = ads.find((a: any) => a.effective_status === 'IN_PROCESS');
      const activeAd = ads.find((a: any) => a.effective_status === 'ACTIVE') || disapprovedAd || withIssuesAd || pendingReviewAd || inProcessAd || ads[0] || null;

      const primaryUrls = activeAd ? extractAdUrls(rawAds.find((r: any) => r.id === activeAd.id)?.creative, camp.name, activeAd.name) : null;
      const isInstagram = isInstaCamp || primaryUrls?.platform === 'INSTAGRAM' || Boolean(primaryUrls?.instagram_url);

      // Check if ended / completed
      const stopMs = resolvedStopTime ? new Date(resolvedStopTime).getTime() : NaN;
      const isCompleted = !isNaN(stopMs) && stopMs <= Date.now();

      const disapprovalReason = disapprovedAd?.disapproval_reason || activeAd?.disapproval_reason || null;
      const issueSummary = withIssuesAd?.issue_summary || activeAd?.issue_summary || null;

      let statusLabel = 'غير معروف';
      if (camp.status === 'DELETED' || camp.effective_status === 'DELETED') {
        statusLabel = '🗑️ محذوفة';
      } else if (camp.status === 'ARCHIVED' || camp.effective_status === 'ARCHIVED') {
        statusLabel = '📁 مؤرشفة';
      } else if (isCompleted) {
        statusLabel = '🏁 مكتملة (انتهت فترتها)';
      } else if (camp.effective_status === 'DISAPPROVED' || Boolean(disapprovedAd)) {
        statusLabel = disapprovalReason ? `❌ إعلان مرفوض (${disapprovalReason})` : '❌ إعلان مرفوض';
      } else if (camp.effective_status === 'WITH_ISSUES' || Boolean(withIssuesAd)) {
        statusLabel = issueSummary ? `⚠️ به مشاكل (${issueSummary})` : '⚠️ إعلان به مشاكل';
      } else if (camp.effective_status === 'PENDING_REVIEW' || Boolean(pendingReviewAd)) {
        statusLabel = '⏳ قيد المراجعة';
      } else if (camp.effective_status === 'IN_PROCESS' || Boolean(inProcessAd)) {
        statusLabel = '⚙️ في مرحلة التحضير';
      } else if (camp.status === 'PAUSED' || camp.effective_status === 'PAUSED' || camp.effective_status === 'CAMPAIGN_PAUSED') {
        statusLabel = '⏸️ متوقفة';
      } else if (camp.status === 'ACTIVE' && camp.effective_status === 'ACTIVE') {
        statusLabel = '🟢 نشطة';
      } else {
        const eff = camp.effective_status || camp.status || '';
        if (eff === 'CAMPAIGN_PAUSED' || eff === 'ADSET_PAUSED') statusLabel = '⏸️ متوقفة';
        else if (eff === 'PREAPPROVED') statusLabel = '✅ تمت الموافقة المسبقة';
        else if (eff === 'PENDING_BILLING_INFO') statusLabel = '💳 بانتظار بيانات الدفع';
        else statusLabel = eff || 'غير نشطة';
      }

      const isUnderReviewOrPrep = ['PENDING_REVIEW', 'IN_PROCESS'].includes(camp.effective_status) || Boolean(pendingReviewAd) || Boolean(inProcessAd);
      const isActuallyActive = !isCompleted && (camp.status === 'ACTIVE' && (camp.effective_status === 'ACTIVE' || isUnderReviewOrPrep));

      return {
        id: camp.id,
        name: camp.name,
        account_id: camp.account_id || resolvedAccountId || null,
        account_name: accountInfo?.account_name || null,
        account_balance: accountInfo?.balance ?? null,
        account_balance_formatted: accountInfo?.balance_formatted ?? null,
        status: camp.status,
        effective_status: camp.effective_status,
        status_label: statusLabel,
        is_active: isActuallyActive,
        is_completed: isCompleted,
        disapproval_reason: disapprovalReason || null,
        issue_summary: issueSummary || null,
        objective: camp.objective || 'OUTCOME_TRAFFIC',
        destination_type: rawAdsets[0]?.destination_type || null,
        optimization_goal: rawAdsets[0]?.optimization_goal || null,
        publisher_platforms: rawAdsets[0]?.targeting?.publisher_platforms || null,
        start_time: camp.start_time || null,
        stop_time: resolvedStopTime,
        budget: dailyBudgetNum > 0 ? dailyBudgetNum : lifetimeBudgetNum,
        budget_type: dailyBudgetNum > 0 ? 'DAILY' : lifetimeBudgetNum > 0 ? 'LIFETIME' : 'CAMPAIGN_BUDGET',
        spend: Number(spend.toFixed(2)),
        results: resultsCount,
        result_type: resultType,
        result_label: resultLabel,
        cpa: cpa,
        roas: roas,
        conversion_rate: conversionRate,
        ctr: Number(ctr.toFixed(2)),
        impressions: impressions,
        reach: reach,
        clicks: clicks,
        // روابط ومنصة الحملة المباشرة لتسهيل قراءتها للبوتات والـ AI
        post_url: primaryUrls?.post_url || null,
        post_url_label: primaryUrls?.post_url_label || (isInstagram ? 'رابط المنشور (إنستغرام)' : 'رابط المنشور (فيسبوك)'),
        platform: primaryUrls?.platform || (isInstagram ? 'INSTAGRAM' : 'FACEBOOK'),
        platform_label: primaryUrls?.platform_label || (isInstagram ? 'إنستغرام' : 'فيسبوك'),
        instagram_url: primaryUrls?.instagram_url || null,
        facebook_url: primaryUrls?.facebook_url || null,
        primary_ad: activeAd ? {
          id: activeAd.id,
          name: activeAd.name,
          status: activeAd.status,
          effective_status: activeAd.effective_status,
          disapproval_reason: disapprovalReason || null,
          issue_summary: issueSummary || null,
          post_url: primaryUrls?.post_url || null,
          post_url_label: primaryUrls?.post_url_label || null,
          platform: primaryUrls?.platform || null,
          platform_label: primaryUrls?.platform_label || null,
          instagram_permalink_url: primaryUrls?.instagram_url || null,
          preview_url: primaryUrls?.preview_url || null,
          image_url: activeAd.creative?.image_url || null,
          cta_type: activeAd.creative?.cta_type || null,
        } : null,
        adsets: adsets,
        ads: ads,
      };
    });

    // Summary calculation
    const overallResults = totalPurchases > 0 ? totalPurchases : totalConversations > 0 ? totalConversations : totalLeads > 0 ? totalLeads : totalClicks;
    const overallResultLabel = totalPurchases > 0 ? 'طلبات شراء (متجر)' : totalConversations > 0 ? 'رسائل' : totalLeads > 0 ? 'بيانات عملاء' : 'زيارات ونقرات';
    const overallCpa = overallResults > 0 ? Number((totalSpend / overallResults).toFixed(2)) : 0;
    const overallCtr = totalImpressions > 0 ? Number(((totalClicks / totalImpressions) * 100).toFixed(2)) : 0;
    const overallConversionRate = totalClicks > 0 ? Number(((overallResults / totalClicks) * 100).toFixed(2)) : 0;
    const overallRoas = totalSpend > 0 && totalPurchaseValue > 0 ? Number((totalPurchaseValue / totalSpend).toFixed(2)) : 0;

    const payload = {
      date_preset: safePreset,
      timezone: 'Africa/Cairo',
      timezone_offset: '+03:00',
      currency: accountInfo?.currency || 'EGP',
      ...(resolvedAccountId ? { account_id: resolvedAccountId } : {}),
      ...(extraMetadata.search ? { search_filter: extraMetadata.search } : {}),
      account: accountInfo ? {
        id: accountInfo.account_id,
        name: accountInfo.account_name,
        status: accountInfo.account_status,
        balance: accountInfo.balance,
        balance_formatted: accountInfo.balance_formatted,
        currency: accountInfo.currency,
        is_prepay_account: accountInfo.is_prepay,
      } : null,
      summary: {
        account_id: resolvedAccountId || null,
        account_name: accountInfo?.account_name || null,
        account_balance: accountInfo?.balance ?? null,
        account_balance_formatted: accountInfo?.balance_formatted ?? null,
        is_prepay_account: accountInfo?.is_prepay ?? false,
        total_spend: Number(totalSpend.toFixed(2)),
        total_budget_daily: Number(totalDailyBudget.toFixed(2)),
        total_results: overallResults,
        total_purchases: totalPurchases,
        total_conversations: totalConversations,
        total_leads: totalLeads,
        result_label: overallResultLabel,
        average_cpa: overallCpa,
        average_ctr: overallCtr,
        conversion_rate: overallConversionRate,
        roas: overallRoas,
        total_impressions: totalImpressions,
        total_reach: totalReach,
        total_clicks: totalClicks,
        active_campaigns_count: activeCampaignsCount,
        total_campaigns_count: formattedCampaigns.length,
      },
      campaigns: formattedCampaigns,
      cached_at: new Date().toISOString(),
    };

    // Save to memory cache
    memoryCache.set(cacheKey, { data: payload, timestamp: Date.now() });

    return { success: true, data: payload };
  } catch (err: any) {
    console.error('[Merchant Campaigns Summary API Error]:', err);
    return {
      success: false,
      error: err.message || 'حدث خطأ غير متوقع أثناء معالجة بيانات الحملات',
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
    const { campaign_ids, account_id, status_filter, search, date_preset, force_refresh, time_range, since, until } = body;

    let customTimeRange: { since: string; until: string } | null = null;
    if (time_range?.since && time_range?.until) {
      customTimeRange = { since: String(time_range.since).trim(), until: String(time_range.until).trim() };
    } else if (since && until) {
      customTimeRange = { since: String(since).trim(), until: String(until).trim() };
    }

    let targetCampaignIds: string[] = [];
    const extraMeta: { account_id?: string; search?: string } = {};

    if (Array.isArray(campaign_ids) && campaign_ids.length > 0) {
      targetCampaignIds = campaign_ids.map((id) => String(id).trim()).filter(Boolean);
    } else if (account_id && String(account_id).trim()) {
      const token = process.env.META_USER_TOKEN;
      if (!token) {
        return NextResponse.json(
          { success: false, error: 'توكن الوصول لـ Meta Graph API غير مهيأ في الخادم' },
          { status: 500 }
        );
      }
      extraMeta.account_id = String(account_id).trim();
      if (search && String(search).trim()) extraMeta.search = String(search).trim();

      const fetchRes = await fetchCampaignIdsForAccount(account_id, token, status_filter, search);
      if (!fetchRes.success) {
        return NextResponse.json(
          { success: false, error: fetchRes.error },
          { status: 400 }
        );
      }

      if (fetchRes.ids.length === 0) {
        const emptyAccInfo = await fetchAccountBalanceInfo(account_id, token);
        return NextResponse.json({
          success: true,
          account_id: extraMeta.account_id,
          date_preset: normalizeDatePreset(date_preset),
          timezone: 'Africa/Cairo',
          currency: emptyAccInfo?.currency || 'EGP',
          account: emptyAccInfo ? {
            id: emptyAccInfo.account_id,
            name: emptyAccInfo.account_name,
            status: emptyAccInfo.account_status,
            balance: emptyAccInfo.balance,
            balance_formatted: emptyAccInfo.balance_formatted,
            currency: emptyAccInfo.currency,
            is_prepay_account: emptyAccInfo.is_prepay,
          } : null,
          summary: {
            account_id: extraMeta.account_id,
            account_name: emptyAccInfo?.account_name || null,
            account_balance: emptyAccInfo?.balance ?? null,
            account_balance_formatted: emptyAccInfo?.balance_formatted ?? null,
            is_prepay_account: emptyAccInfo?.is_prepay ?? false,
            total_spend: 0,
            total_budget_daily: 0,
            total_results: 0,
            total_purchases: 0,
            total_conversations: 0,
            total_leads: 0,
            result_label: 'لا توجد حملات',
            average_cpa: 0,
            average_ctr: 0,
            conversion_rate: 0,
            roas: 0,
            total_impressions: 0,
            total_reach: 0,
            total_clicks: 0,
            active_campaigns_count: 0,
            total_campaigns_count: 0,
          },
          campaigns: [],
          message: 'لم يتم العثور على أي حملات مطابقة في هذا الحساب الإعلاني',
        });
      }

      targetCampaignIds = fetchRes.ids;
    } else {
      return NextResponse.json(
        { success: false, error: 'يجب توفير إما مصفوفة campaign_ids أو معرف الحساب الإعلاني account_id' },
        { status: 400 }
      );
    }

    const result = await handleRequest(targetCampaignIds, date_preset, Boolean(force_refresh), extraMeta, customTimeRange);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status || 500 });
    }

    return NextResponse.json({ success: true, ...result.data });
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
  const idsParam = searchParams.get('campaign_ids') || searchParams.get('ids') || '';
  const accountIdParam = searchParams.get('account_id') || searchParams.get('account') || '';
  const statusFilter = searchParams.get('status') || searchParams.get('status_filter') || '';
  const search = searchParams.get('search') || searchParams.get('q') || '';
  const datePreset = searchParams.get('date_preset') || 'last_7d';
  const forceRefresh = searchParams.get('force_refresh') === 'true';
  const sinceParam = searchParams.get('since');
  const untilParam = searchParams.get('until');
  let customTimeRange: { since: string; until: string } | null = null;
  if (sinceParam && untilParam) {
    customTimeRange = { since: sinceParam.trim(), until: untilParam.trim() };
  }

  let targetCampaignIds: string[] = idsParam.split(',').map((id) => id.trim()).filter(Boolean);
  const extraMeta: { account_id?: string; search?: string } = {};

  if (targetCampaignIds.length === 0 && accountIdParam.trim()) {
    const token = process.env.META_USER_TOKEN;
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'توكن الوصول لـ Meta Graph API غير مهيأ في الخادم' },
        { status: 500 }
      );
    }
    extraMeta.account_id = accountIdParam.trim();
    if (search.trim()) extraMeta.search = search.trim();

    const fetchRes = await fetchCampaignIdsForAccount(accountIdParam, token, statusFilter, search);
    if (!fetchRes.success) {
      return NextResponse.json(
        { success: false, error: fetchRes.error },
        { status: 400 }
      );
    }

    if (fetchRes.ids.length === 0) {
      const emptyAccInfo = await fetchAccountBalanceInfo(accountIdParam, token);
      return NextResponse.json({
        success: true,
        account_id: extraMeta.account_id,
        date_preset: normalizeDatePreset(datePreset),
        timezone: 'Africa/Cairo',
        currency: emptyAccInfo?.currency || 'EGP',
        account: emptyAccInfo ? {
          id: emptyAccInfo.account_id,
          name: emptyAccInfo.account_name,
          status: emptyAccInfo.account_status,
          balance: emptyAccInfo.balance,
          balance_formatted: emptyAccInfo.balance_formatted,
          currency: emptyAccInfo.currency,
          is_prepay_account: emptyAccInfo.is_prepay,
        } : null,
        summary: {
          account_id: extraMeta.account_id,
          account_name: emptyAccInfo?.account_name || null,
          account_balance: emptyAccInfo?.balance ?? null,
          account_balance_formatted: emptyAccInfo?.balance_formatted ?? null,
          is_prepay_account: emptyAccInfo?.is_prepay ?? false,
          total_spend: 0,
          total_budget_daily: 0,
          total_results: 0,
          total_purchases: 0,
          total_conversations: 0,
          total_leads: 0,
          result_label: 'لا توجد حملات',
          average_cpa: 0,
          average_ctr: 0,
          conversion_rate: 0,
          roas: 0,
          total_impressions: 0,
          total_reach: 0,
          total_clicks: 0,
          active_campaigns_count: 0,
          total_campaigns_count: 0,
        },
        campaigns: [],
        message: 'لم يتم العثور على أي حملات مطابقة في هذا الحساب الإعلاني',
      });
    }

    targetCampaignIds = fetchRes.ids;
  } else if (targetCampaignIds.length === 0) {
    return NextResponse.json(
      { success: false, error: 'يجب توفير إما المعلمة campaign_ids أو account_id في الرابط' },
      { status: 400 }
    );
  }

  const result = await handleRequest(targetCampaignIds, datePreset, forceRefresh, extraMeta, customTimeRange);
  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.status || 500 });
  }

  return NextResponse.json({ success: true, ...result.data });
}
