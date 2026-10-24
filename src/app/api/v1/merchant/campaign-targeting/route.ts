import { NextResponse } from 'next/server';
import vertexAI, { CampaignTargetingEvaluationResult } from '@/lib/vertex';

function validateApiKey(req: Request): boolean {
  const expectedKey = process.env.MERCHANT_API_KEY || 'fastorder_merchant_secure_api_key_2026';
  const headerKey = req.headers.get('x-api-key') || req.headers.get('X-API-KEY');
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  const bearerKey = authHeader?.startsWith('Bearer ') ? authHeader.replace(/^Bearer\s+/, '').trim() : null;

  let queryKey: string | null = null;
  try {
    const url = new URL(req.url);
    queryKey = url.searchParams.get('api_key') || url.searchParams.get('key');
  } catch {}

  const providedKey = (headerKey || bearerKey || queryKey || '').trim();
  return Boolean(providedKey && providedKey === expectedKey.trim());
}

const COUNTRY_NAMES: Record<string, string> = {
  EG: 'مصر',
  SA: 'المملكة العربية السعودية',
  AE: 'الإمارات العربية المتحدة',
  KW: 'الكويت',
  QA: 'قطر',
  OM: 'عمان',
  BH: 'البحرين',
  JO: 'الأردن',
  IQ: 'العراق',
  LY: 'ليبيا',
  US: 'الولايات المتحدة',
};

const RELATIONSHIP_STATUS_MAP: Record<number, string> = {
  1: 'أعزب',
  2: 'في علاقة',
  3: 'متزوج',
  4: 'مخطوب',
  7: 'مطلق',
  8: 'أرمل',
  9: 'منفصل',
  13: 'متزوج حديثاً',
};

const LIFE_EVENTS_MAP: Record<string, string> = {
  'newly-engaged (6 months)': 'المخطوبون حديثاً - 6 أشهر',
  'newly-engaged (3 months)': 'المخطوبون حديثاً - 3 أشهر',
  'newly-engaged (1 year)': 'المخطوبون حديثاً - سنة واحدة',
  'newlywed (1 year)': 'المتزوجون حديثاً - سنة واحدة',
  'newlywed (6 months)': 'المتزوجون حديثاً - 6 أشهر',
  'newlywed (3 months)': 'المتزوجون حديثاً - 3 أشهر',
  'new job': 'بدأ وظيفة جديدة',
  'moved': 'انتقل مؤخراً إلى سكن جديد',
  'away from family': 'يعيش بعيداً عن العائلة',
  'away from hometown': 'يعيش بعيداً عن مسقط رأسه',
  'recently moved': 'انتقل إلى منزل جديد حديثاً',
  'upcoming birthday': 'عيد ميلاد قادم قريباً',
  'anniversary': 'ذكرى سنوية',
  'anniversary (within 30 days)': 'ذكرى سنوية خلال 30 يوماً',
  'friends of newly engaged people': 'أصدقاء المخطوبين حديثاً',
  'friends of newlyweds': 'أصدقاء المتزوجين حديثاً',
  'new relationship': 'علاقة عاطفية جديدة',
};

function translateLifeEvent(name: string): string {
  const lower = (name || '').toLowerCase().trim();
  return LIFE_EVENTS_MAP[lower] || name;
}

function cleanPlaceName(name: string): string {
  if (!name) return 'موقع محدد';
  if (name.includes('مستقبل سيتي')) return 'مستقبل سيتي';
  if (name.includes('العاصمة الادارية')) return 'العاصمة الإدارية الجديدة';
  if (name.includes('العبور الجديدة')) return 'العبور الجديدة';
  let clean = name.replace(/,\s*(القاهرة|مصر|الجيزة).*$/i, '').trim();
  clean = clean.replace(/\s*-\s*[A-Za-z\s]+$/g, '').trim();
  return clean || name;
}

function parseLocations(geoLocations: any): string {
  if (!geoLocations) return 'غير محدد';

  const parts: string[] = [];

  // 1. Places (Named radius pins)
  if (Array.isArray(geoLocations.places) && geoLocations.places.length > 0) {
    const placesList = geoLocations.places.map((p: any) => {
      const name = cleanPlaceName(p.name);
      const radius = p.radius ? ` (+${p.radius} كم)` : '';
      return `${name}${radius}`;
    });

    if (placesList.length > 6) {
      parts.push(`محددة في ${placesList.length} منطقة رئيسية بالقاهرة والجيزة والمدن الجديدة (${placesList.join(' ، ')})`);
    } else {
      parts.push(placesList.join(' ، '));
    }
  }

  // 2. Custom pins/locations
  if (Array.isArray(geoLocations.custom_locations) && geoLocations.custom_locations.length > 0) {
    const customList = geoLocations.custom_locations.map((loc: any) => {
      const name = (loc.name || loc.address_string || 'موقع محدد').replace(/\(.*?\)/g, '').trim();
      const radius = loc.radius ? ` (+${loc.radius} كم)` : '';
      return `${name}${radius}`;
    });
    parts.push(customList.join(' ، '));
  }

  // 3. Cities
  if (Array.isArray(geoLocations.cities) && geoLocations.cities.length > 0) {
    const cityList = geoLocations.cities.map((c: any) => {
      const radius = c.radius ? ` (+${c.radius} كم)` : '';
      return `${(c.name || 'مدينة').replace(/\(.*?\)/g, '').trim()}${radius}`;
    });
    parts.push(cityList.join(' ، '));
  }

  // 4. Regions / Governorates
  if (Array.isArray(geoLocations.regions) && geoLocations.regions.length > 0) {
    const regionList = geoLocations.regions.map((r: any) => (r.name || 'محافظة').replace(/\(.*?\)/g, '').trim());
    parts.push(regionList.join(' ، '));
  }

  // 5. Countries
  if (Array.isArray(geoLocations.countries) && geoLocations.countries.length > 0) {
    const countryList = geoLocations.countries.map((c: string) => COUNTRY_NAMES[c.toUpperCase()] || c);
    if (parts.length === 0) {
      parts.push(`${countryList.join(' ، ')} بالكامل`);
    } else {
      parts.push(`في ${countryList.join(' ، ')}`);
    }
  }

  return parts.length > 0 ? parts.join(' | ') : 'مصر بالكامل';
}

function parseGender(genders?: number[]): string {
  if (!genders || genders.length === 0 || genders.length === 2) {
    return 'الجميع - رجال ونساء';
  }
  if (genders.includes(1)) return 'رجال فقط';
  if (genders.includes(2)) return 'نساء فقط';
  return 'الجميع';
}

function parseAgeRange(targeting: any): string {
  if (Array.isArray(targeting?.age_range) && targeting.age_range.length === 2) {
    const min = targeting.age_range[0] || 18;
    const max = targeting.age_range[1];
    const maxStr = max ? (max >= 65 ? '65+ سنة' : `${max} سنة`) : '65+ سنة';
    return `${min} - ${maxStr}`;
  }

  const minAge = targeting?.age_min || 18;
  const max = targeting?.age_max;
  const maxAge = max ? (max >= 65 ? '65+ سنة' : `${max} سنة`) : '65+ سنة';
  return `${minAge} - ${maxAge}`;
}

async function enrichAdCreative(
  adset: any,
  adsList: any[],
  token: string
): Promise<{
  postText: string;
  imageUrl: string | null;
  mediaType: 'VIDEO' | 'IMAGE' | 'CAROUSEL' | 'TEXT';
  cta: string | null;
  adName?: string;
}> {
  // Find ads belonging to this specific ad set
  const adsetAds = adsList.filter((a: any) => String(a.adset_id) === String(adset.id));
  const candidateAds = adsetAds.length > 0 ? adsetAds : adsList;

  const activeAd =
    candidateAds.find((a: any) => a.effective_status === 'ACTIVE' || a.status === 'ACTIVE') ||
    candidateAds[0] ||
    {};

  const creative = activeAd.creative || {};
  let postText = creative.body || creative.title || '';
  let imageUrl = creative.image_url || creative.thumbnail_url || null;
  let mediaType: 'VIDEO' | 'IMAGE' | 'CAROUSEL' | 'TEXT' = 'IMAGE';

  // Video identification
  const videoId = creative.video_id || creative.object_story_spec?.video_data?.video_id;
  if (videoId) {
    mediaType = 'VIDEO';
    if (!imageUrl) {
      try {
        const vRes = await fetch(
          `https://graph.facebook.com/v21.0/${videoId}?fields=id,picture&access_token=${token}`,
          { signal: AbortSignal.timeout(4000) }
        );
        const vData = await vRes.json();
        if (vData.picture) imageUrl = vData.picture;
      } catch {}
    }
  }

  // Post story identification (for full message text, carousel or high-res images)
  const storyId = creative.effective_object_story_id || creative.object_story_id;
  if (storyId) {
    try {
      const postRes = await fetch(
        `https://graph.facebook.com/v21.0/${storyId}?fields=id,message,attachments{media,subattachments{media},type,media_type}&access_token=${token}`,
        { signal: AbortSignal.timeout(4000) }
      );
      const postData = await postRes.json();
      if (postData.message && (!postText || postText.length < 40)) {
        postText = postData.message;
      }
      const att = postData.attachments?.data?.[0];
      if (att) {
        if (att.media_type === 'video' || att.type === 'video_inline') {
          mediaType = 'VIDEO';
        } else if (att.subattachments?.data?.length > 1) {
          mediaType = 'CAROUSEL';
        }
        if (!imageUrl && att.media?.image?.src) {
          imageUrl = att.media.image.src;
        }
      }
    } catch {}
  }

  if (!postText && creative.object_story_spec?.link_data?.message) {
    postText = creative.object_story_spec.link_data.message;
  }

  return {
    postText: postText || 'إعلان ترويجي على منصات ميتا',
    imageUrl,
    mediaType,
    cta: creative.call_to_action_type || null,
    adName: activeAd.name,
  };
}

function formatAdsetEvaluationParts(
  campaign: any,
  adsetItem: any,
  index: number,
  total: number
): { part1: string; part2: string } {
  const currentTargeting = adsetItem.current_targeting;
  const creative = adsetItem.ad_creative;
  const evaluation: CampaignTargetingEvaluationResult = adsetItem.evaluation;
  const isMulti = total > 1;

  const mediaLabel =
    creative.media_type === 'VIDEO'
      ? 'فيديو / ريلز 🎬'
      : creative.media_type === 'CAROUSEL'
      ? 'ألبوم صور / كاروسيل 📸'
      : 'صورة / تصميم 🎨';

  // ── الجزء الأول: فحص الاستهداف الحالي ومطابقته للبوست ──
  const groupLabel = isMulti ? ` (${index + 1} من ${total})` : '';
  let part1 = `🎯 *تقرير فحص وتدقيق استهداف المجموعة الإعلانية${groupLabel}* 📊\n`;
  part1 += `📌 *الحملة:* ${campaign.name || 'حملة إعلانية'} (ID: \`${campaign.id}\`)\n`;
  part1 += `📂 *المجموعة الإعلانية:* ${adsetItem.adset_name || 'المجموعة الأساسية'}\n`;
  part1 += `🎬 *نوع المحتوى المرئي:* ${mediaLabel}\n`;

  if (creative?.body) {
    const cleanSnippet = creative.body.trim().split('\n')[0].slice(0, 90);
    part1 += `📝 *محتوى البوست:* "${cleanSnippet}..."\n`;
  }

  part1 += `══════════════════════════\n`;
  part1 += `⚙️ *الاستهداف الحالي في مدير الإعلانات:*\n`;
  part1 += `• *السن:* [${currentTargeting.ageRange}]\n`;
  part1 += `• *النوع:* [${currentTargeting.gender}]\n`;

  if (currentTargeting.locations && currentTargeting.locations.startsWith('محددة في')) {
    part1 += `• *المناطق:* ${currentTargeting.locations}\n`;
  } else {
    part1 += `• *المناطق:* [${currentTargeting.locations}]\n`;
  }

  part1 += `• *نوع الاستهداف:* [${currentTargeting.targetingType}]\n`;

  if (currentTargeting.demographics && currentTargeting.demographics.length > 0) {
    part1 += `• *البيانات الديموغرافية والحالة:* ${currentTargeting.demographics.map((d: string) => `[${d}]`).join(' | ')}\n`;
  }

  if (currentTargeting.interests && currentTargeting.interests.length > 0) {
    part1 += `• *الاهتمامات الحالية:* ${currentTargeting.interests.map((i: string) => `[${i}]`).join(' | ')}\n`;
  } else if (currentTargeting.isAdvantageAudience) {
    part1 += `• *الاهتمامات التفصيلية:* يعتمد كلياً على خوارزمية أدفانتج بلس الموسعة (بدون اهتمامات يدوية).\n`;
  } else {
    part1 += `• *الاهتمامات:* لا توجد اهتمامات تفصيلية محددة (استهداف عام مفتوح).\n`;
  }

  if (currentTargeting.behaviors && currentTargeting.behaviors.length > 0) {
    part1 += `• *السلوكيات الحالية:* ${currentTargeting.behaviors.map((b: string) => `[${b}]`).join(' | ')}\n`;
  }

  if (currentTargeting.exclusions && currentTargeting.exclusions.length > 0) {
    part1 += `• *الاستبعادات:* ${currentTargeting.exclusions.join(' | ')}\n`;
  }

  part1 += `══════════════════════════\n`;
  part1 += `🏆 *تقييم الذكاء الاصطناعي للاستهداف:*\n`;
  part1 += `⭐ *درجة الملاءمة لمحتوى البوست:* [${evaluation.targeting_suitability_score} / 10]\n`;
  part1 += `⚖️ *القرار:* [${evaluation.verdict?.decision_label || evaluation.verdict?.status_label || '🟡 استهداف مقبول ويحتاج تحسين'}]\n\n`;
  part1 += `🔍 *تحليل ملاءمة الاستهداف مع البوست (${mediaLabel}):*\n`;
  part1 += `${evaluation.suitability_analysis || evaluation.verdict?.summary}\n`;

  const critique = evaluation.current_targeting_critique;
  if (critique?.keep_items && critique.keep_items.length > 0) {
    part1 += `\n✅ *ما ننصحك بالإبقاء عليه (شغال صح ومناسب):*\n`;
    critique.keep_items.forEach((item: string) => {
      part1 += `• ${item}\n`;
    });
  }

  if (critique?.remove_items && critique.remove_items.length > 0) {
    part1 += `\n❌ *ما يجب حذفه فوراً (سبب هدر الميزانية):*\n`;
    critique.remove_items.forEach((item: string) => {
      part1 += `• ${item}\n`;
    });
  }

  // ── الجزء الثاني: مقترحات الاستهداف الأفضل وتعديل الجمهور ──
  let part2 = `🚀 *مقترحات الاستهداف الأفضل للمجموعة${groupLabel}* 🎯\n`;
  part2 += `📂 *المجموعة:* ${adsetItem.adset_name}\n`;
  if (adsetItem.user_directive) {
    part2 += `📝 *بناءً على ملاحظاتك:* "${adsetItem.user_directive}"\n`;
  }
  part2 += `(مختارة حصرياً من قاموس ميتا الرسمي المعتمد)\n`;
  part2 += `══════════════════════════\n`;
  part2 += `🎯 *الاهتمامات البديلة الأنسب (5 خيارات دقيقة):*\n`;

  const suggestedInterests = evaluation.suggested_targeting?.detailed_interests || [];
  if (suggestedInterests.length > 0) {
    suggestedInterests.slice(0, 6).forEach((item) => {
      const cleanName = item.interest.replace(/^\[+|\]+$/g, '').trim();
      part2 += `  🎯 [${cleanName}] - ${item.reason}\n`;
    });
  } else {
    part2 += `  🎯 [Online shopping] - استهداف مباشر للمشترين عبر الإنترنت الأكثر تفاعلاً.\n`;
  }

  if (evaluation.suggested_targeting?.behaviors) {
    const cleanBehaviors = evaluation.suggested_targeting.behaviors.replace(/\[\[/g, '[').replace(/\]\]/g, ']');
    part2 += `\n• *السلوكيات المقترحة:* ${cleanBehaviors}\n`;
  }

  if (evaluation.suggested_targeting?.narrowing_technique) {
    part2 += `\n⚙️ *طريقة تضييق الجمهور بزر [تقييد جمهورك بشكل أكبر]:*\n`;
    part2 += `${evaluation.suggested_targeting.narrowing_technique}\n`;
  }

  part2 += `\n👥 *التعديل المقترح للجمهور:*\n`;
  const sugAge = (evaluation.suggested_targeting?.suggested_age_range || '24 - 45 سنة').replace(/^\[+|\]+$/g, '');
  const sugRationale = evaluation.suggested_targeting?.suggested_age_rationale || '';
  part2 += `• *السن المقترح:* [${sugAge}]${sugRationale ? ` - ${sugRationale}` : ''}\n`;
  part2 += `• *النوع المقترح:* [${(evaluation.suggested_targeting?.suggested_gender || 'الجميع').replace(/^\[+|\]+$/g, '')}]\n`;

  if (evaluation.suggested_targeting?.suggested_placements) {
    part2 += `• *مواضع الظهور الفعالة:* [${evaluation.suggested_targeting.suggested_placements}]\n`;
  }

  part2 += `══════════════════════════\n`;
  part2 += `🌟 *الزتونة ونصيحة الميديا باير:*\n`;
  part2 += `"${evaluation.media_buyer_golden_tip}"`;

  return { part1: part1.trim(), part2: part2.trim() };
}

export async function POST(req: Request) {
  if (!validateApiKey(req)) {
    return NextResponse.json(
      { success: false, error: 'غير مصرّح: برجاء إرسال مفتاح الـ API الصحيح في x-api-key' },
      { status: 401 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const rawInput =
      body.campaign_id ||
      body.campaignId ||
      body.id ||
      body.query ||
      body.text ||
      '';

    const idMatch = String(rawInput).match(/\d{9,25}/);
    if (!idMatch) {
      return NextResponse.json(
        {
          success: false,
          error:
            'برجاء إرسال رقم الحملة الإعلانية المكون من أرقام في حقل campaign_id (مثال: 6935431244770 أو "استهداف 6935431244770")',
        },
        { status: 400 }
      );
    }

    const inputId = idMatch[0];

    // Extract user custom instructions / notes if any (e.g. "استهداف بديل 120251807851810053 ركز على تجار الجملة وبلاش بيوتي سنتر")
    let userDirective = body.notes || body.directive || body.custom_instructions || '';
    if (!userDirective) {
      const cleaned = String(rawInput)
        .replace(inputId, '')
        .replace(/^(استهداف|بديل|فحص|تحليل|تدقيق|حملة|تقرير)\s*/gi, '')
        .replace(/^(استهداف|بديل|فحص|تحليل|تدقيق|حملة|تقرير)\s*/gi, '')
        .trim();
      if (cleaned.length >= 3) {
        userDirective = cleaned;
      }
    }

    const token = process.env.META_USER_TOKEN;

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: 'رمز الوصول لميتا META_USER_TOKEN غير مهيأ على السيرفر.',
        },
        { status: 500 }
      );
    }

    // Step 1: Check if inputId is an ad or adset, resolve to parent campaign_id
    let effectiveCampaignId = inputId;
    try {
      const checkRes = await fetch(
        `https://graph.facebook.com/v21.0/${inputId}?fields=id,campaign_id&access_token=${token}`
      );
      const checkData = await checkRes.json();
      if (checkData.campaign_id) {
        effectiveCampaignId = checkData.campaign_id;
      }
    } catch {}

    // Step 2: Fetch Campaign, Adsets, and Ads from Meta Graph API
    const campFields =
      'id,name,objective,status,effective_status,adsets{id,name,status,effective_status,targeting,optimization_goal,billing_event,daily_budget,lifetime_budget},ads{id,name,status,effective_status,adset_id,creative{id,name,title,body,image_url,thumbnail_url,video_id,object_story_spec,effective_object_story_id,object_story_id,link_url,instagram_permalink_url,call_to_action_type}}';

    const campUrl = `https://graph.facebook.com/v21.0/${effectiveCampaignId}?fields=${encodeURIComponent(campFields)}&access_token=${token}`;
    const campRes = await fetch(campUrl);
    const campData = await campRes.json();

    if (campData.error || !campData.id) {
      return NextResponse.json(
        {
          success: false,
          error:
            campData.error?.message ||
            `تعذر العثور على الحملة الإعلانية برقم (${effectiveCampaignId}). تأكد من صحة رقم الحملة وصلاحية الوصول إليها.`,
        },
        { status: 404 }
      );
    }

    // Step 3: Extract AdSets (Support Multiple Ad Sets!)
    const adsetsList = campData.adsets?.data || [];
    if (adsetsList.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: `لا توجد مجموعات إعلانية (Ad Sets) تابعة للحملة رقم (${effectiveCampaignId}).`,
        },
        { status: 404 }
      );
    }

    // Filter adsets: prefer active ad sets, or non-deleted ad sets if all paused.
    let targetAdsets = adsetsList.filter(
      (a: any) => a.effective_status === 'ACTIVE' || a.status === 'ACTIVE'
    );

    if (targetAdsets.length === 0) {
      targetAdsets = adsetsList.filter(
        (a: any) =>
          !['DELETED', 'ARCHIVED'].includes(a.effective_status) &&
          !['DELETED', 'ARCHIVED'].includes(a.status)
      );
    }

    if (targetAdsets.length === 0) {
      targetAdsets = adsetsList;
    }

    // Limit to top 3 ad sets for performance and WhatsApp message limits
    targetAdsets = targetAdsets.slice(0, 3);
    const adsList = campData.ads?.data || [];

    // Step 4: Evaluate Each Ad Set Concurrently
    const adsetResults = await Promise.all(
      targetAdsets.map(async (adset: any, index: number) => {
        const enrichedCreative = await enrichAdCreative(adset, adsList, token);
        const targeting = adset.targeting || {};

        const isAdvantageAudience = Boolean(
          targeting.targeting_automation?.advantage_audience === 1 ||
          targeting.targeting_automation?.advantage_detailed_targeting === 1 ||
          targeting.targeting_optimization === 'expansion_all'
        );

        const targetingType = isAdvantageAudience
          ? 'استهداف أدفانتج بلس - Advantage+ Audience'
          : 'استهداف تفصيلي يدوي - Manual Targeting';

        const ageRange = parseAgeRange(targeting);
        const gender = parseGender(targeting.genders);
        const locations = parseLocations(targeting.geo_locations);

        const interests: string[] = [];
        const behaviors: string[] = [];
        const demographics: string[] = [];
        const exclusions: string[] = [];

        const flexible = targeting.flexible_spec || [];
        flexible.forEach((spec: any) => {
          if (Array.isArray(spec.interests)) {
            spec.interests.forEach((item: any) => {
              const cleanName = (item.name || '').replace(/\s*\((.*?)\)/g, ' - $1').trim();
              if (cleanName && !interests.includes(cleanName)) interests.push(cleanName);
            });
          }
          if (Array.isArray(spec.behaviors)) {
            spec.behaviors.forEach((item: any) => {
              const cleanName = (item.name || '').replace(/\s*\((.*?)\)/g, ' - $1').trim();
              if (cleanName && !behaviors.includes(cleanName)) behaviors.push(cleanName);
            });
          }
          if (Array.isArray(spec.demographics)) {
            spec.demographics.forEach((item: any) => {
              const cleanName = (item.name || '').replace(/\s*\((.*?)\)/g, ' - $1').trim();
              if (cleanName && !demographics.includes(cleanName)) demographics.push(cleanName);
            });
          }
          if (Array.isArray(spec.life_events)) {
            spec.life_events.forEach((item: any) => {
              const label = `مناسبة شخصية: ${translateLifeEvent(item.name || '')}`;
              if (!demographics.includes(label)) demographics.push(label);
            });
          }
          if (Array.isArray(spec.relationship_statuses)) {
            spec.relationship_statuses.forEach((id: number) => {
              const label = `الحالة الاجتماعية: ${RELATIONSHIP_STATUS_MAP[id] || `حالة اجتماعية (${id})`}`;
              if (!demographics.includes(label)) demographics.push(label);
            });
          }
        });

        if (Array.isArray(targeting.interests)) {
          targeting.interests.forEach((item: any) => {
            const cleanName = (item.name || '').replace(/\s*\((.*?)\)/g, ' - $1').trim();
            if (cleanName && !interests.includes(cleanName)) interests.push(cleanName);
          });
        }
        if (Array.isArray(targeting.behaviors)) {
          targeting.behaviors.forEach((item: any) => {
            const cleanName = (item.name || '').replace(/\s*\((.*?)\)/g, ' - $1').trim();
            if (cleanName && !behaviors.includes(cleanName)) behaviors.push(cleanName);
          });
        }
        if (Array.isArray(targeting.demographics)) {
          targeting.demographics.forEach((item: any) => {
            const cleanName = (item.name || '').replace(/\s*\((.*?)\)/g, ' - $1').trim();
            if (cleanName && !demographics.includes(cleanName)) demographics.push(cleanName);
          });
        }
        if (Array.isArray(targeting.life_events)) {
          targeting.life_events.forEach((item: any) => {
            const label = `مناسبة شخصية: ${translateLifeEvent(item.name || '')}`;
            if (!demographics.includes(label)) demographics.push(label);
          });
        }
        if (Array.isArray(targeting.relationship_statuses)) {
          targeting.relationship_statuses.forEach((id: number) => {
            const label = `الحالة الاجتماعية: ${RELATIONSHIP_STATUS_MAP[id] || `حالة اجتماعية (${id})`}`;
            if (!demographics.includes(label)) demographics.push(label);
          });
        }

        if (targeting.exclusions) {
          if (Array.isArray(targeting.exclusions.interests)) {
            targeting.exclusions.interests.forEach((i: any) => {
              const cleanName = (i.name || '').replace(/\s*\((.*?)\)/g, ' - $1').trim();
              exclusions.push(`استبعاد: ${cleanName}`);
            });
          }
          if (Array.isArray(targeting.exclusions.behaviors)) {
            targeting.exclusions.behaviors.forEach((b: any) => {
              const cleanName = (b.name || '').replace(/\s*\((.*?)\)/g, ' - $1').trim();
              exclusions.push(`استبعاد: ${cleanName}`);
            });
          }
        }

        const currentTargetingParsed = {
          ageRange,
          gender,
          locations,
          targetingType,
          interests,
          behaviors,
          demographics,
          exclusions,
          isAdvantageAudience,
        };

        const evaluation = await vertexAI.evaluateCampaignTargeting({
          campaignName: campData.name || 'حملة إعلانية',
          adsetName: adset.name || `المجموعة الإعلانية رقم ${index + 1}`,
          postText: enrichedCreative.postText,
          imageUrl: enrichedCreative.imageUrl || undefined,
          mediaType: enrichedCreative.mediaType,
          userDirective: userDirective || undefined,
          currentTargeting: currentTargetingParsed,
        });

        return {
          adset_id: adset.id,
          adset_name: adset.name,
          status: adset.effective_status || adset.status,
          user_directive: userDirective || undefined,
          current_targeting: currentTargetingParsed,
          ad_creative: {
            body: enrichedCreative.postText,
            image_url: enrichedCreative.imageUrl,
            media_type: enrichedCreative.mediaType,
            cta: enrichedCreative.cta,
            ad_name: enrichedCreative.adName,
          },
          evaluation,
        };
      })
    );

    // Step 5: Format Output for WhatsApp
    const messageParts: string[] = [];
    adsetResults.forEach((adsetItem, idx) => {
      const { part1, part2 } = formatAdsetEvaluationParts(
        campData,
        adsetItem,
        idx,
        adsetResults.length
      );
      messageParts.push(part1);
      messageParts.push(part2);
    });

    const fullMessage = messageParts.join('\n\n══════════════════════════════\n\n');

    return NextResponse.json({
      success: true,
      campaign_id: campData.id,
      campaign_name: campData.name,
      objective: campData.objective,
      status: campData.effective_status || campData.status,
      adsets_count: adsetResults.length,
      adsets: adsetResults,
      // For backward compatibility if single adset
      current_targeting: adsetResults[0]?.current_targeting,
      ad_creative: adsetResults[0]?.ad_creative,
      evaluation: adsetResults[0]?.evaluation,
      formatted_message: fullMessage,
      formatted_message_parts: messageParts,
    });
  } catch (err: any) {
    console.error('[Campaign Targeting API Error]:', err);
    return NextResponse.json(
      {
        success: false,
        error: `حدث خطأ أثناء فحص استهداف الحملة: ${err.message || err}`,
      },
      { status: 500 }
    );
  }
}

// Support GET requests as well
export async function GET(req: Request) {
  if (!validateApiKey(req)) {
    return NextResponse.json(
      { success: false, error: 'غير مصرّح: برجاء إرسال مفتاح الـ API الصحيح في x-api-key' },
      { status: 401 }
    );
  }

  const url = new URL(req.url);
  const rawInput =
    url.searchParams.get('campaign_id') ||
    url.searchParams.get('campaignId') ||
    url.searchParams.get('id') ||
    url.searchParams.get('query') ||
    '';
  const notes = url.searchParams.get('notes') || url.searchParams.get('directive') || '';

  const mockReq = new Request(req.url, {
    method: 'POST',
    headers: req.headers,
    body: JSON.stringify({ campaign_id: rawInput, notes }),
  });

  return await POST(mockReq);
}
