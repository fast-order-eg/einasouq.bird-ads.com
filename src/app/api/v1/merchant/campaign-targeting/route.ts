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

function parseLocations(geoLocations: any): string {
  if (!geoLocations) return 'غير محدد';

  const parts: string[] = [];

  // 1. Custom pins/locations
  if (Array.isArray(geoLocations.custom_locations) && geoLocations.custom_locations.length > 0) {
    const customList = geoLocations.custom_locations.map((loc: any) => {
      const name = loc.name || loc.address_string || 'موقع محدد';
      const radius = loc.radius ? ` (نطاق ${loc.radius} كم)` : '';
      return `${name}${radius}`;
    });
    parts.push(customList.join(' ، '));
  }

  // 2. Cities
  if (Array.isArray(geoLocations.cities) && geoLocations.cities.length > 0) {
    const cityList = geoLocations.cities.map((c: any) => {
      const radius = c.radius ? ` (+${c.radius} كم)` : '';
      return `${c.name || 'مدينة'}${radius}`;
    });
    parts.push(cityList.join(' ، '));
  }

  // 3. Regions / Governorates
  if (Array.isArray(geoLocations.regions) && geoLocations.regions.length > 0) {
    const regionList = geoLocations.regions.map((r: any) => r.name || 'محافظة');
    parts.push(regionList.join(' ، '));
  }

  // 4. Countries
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
    return 'الجميع (رجال ونساء)';
  }
  if (genders.includes(1)) return 'رجال فقط';
  if (genders.includes(2)) return 'نساء فقط';
  return 'الجميع';
}

function parseAgeRange(min?: number, max?: number): string {
  const minAge = min || 18;
  const maxAge = max ? (max >= 65 ? '65+ سنة' : `${max} سنة`) : '65+ سنة';
  return `${minAge} - ${maxAge}`;
}

function formatCampaignTargetingForWhatsApp(
  campaign: any,
  adset: any,
  creative: any,
  currentTargeting: any,
  evaluation: CampaignTargetingEvaluationResult
): { fullMessage: string; parts: string[] } {
  // ── الجزء الأول: فحص الاستهداف الحالي والتقييم ──
  let part1 = `🎯 *تقرير فحص وتدقيق استهداف الحملة* 📊\n`;
  part1 += `📌 *الحملة:* ${campaign.name || 'حملة إعلانية'} (ID: \`${campaign.id}\`)\n`;
  if (adset?.name) {
    part1 += `📂 *المجموعة الإعلانية:* ${adset.name}\n`;
  }
  if (creative?.body || creative?.title) {
    const cleanSnippet = (creative.body || creative.title || '').trim().split('\n')[0].slice(0, 90);
    part1 += `📝 *محتوى البوست:* "${cleanSnippet}..."\n`;
  }
  part1 += `══════════════════════════\n`;
  part1 += `⚙️ *الاستهداف الحالي في مدير الإعلانات:*\n`;
  part1 += `• *السن:* [${currentTargeting.ageRange}]\n`;
  part1 += `• *النوع:* [${currentTargeting.gender}]\n`;
  part1 += `• *المناطق:* [${currentTargeting.locations}]\n`;
  part1 += `• *نوع الاستهداف:* [${currentTargeting.targetingType}]\n`;

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
  part1 += `⭐ *درجة الملاءمة للبوست:* [${evaluation.targeting_suitability_score} / 10]\n`;
  part1 += `⚖️ *القرار:* [${evaluation.verdict?.decision_label || evaluation.verdict?.status_label || '🟡 استهداف مقبول ويحتاج تحسين'}]\n\n`;
  part1 += `🔍 *تحليل ملاءمة الاستهداف مع البوست:*\n`;
  part1 += `${evaluation.suitability_analysis || evaluation.verdict?.summary}\n`;

  // ── الجزء الثاني: مقترحات الاستهداف الأفضل وتعديل الجمهور ──
  let part2 = `🚀 *مقترحات الاستهداف الأفضل للبوست* 🎯\n`;
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

  const parts = [part1.trim(), part2.trim()];
  const fullMessage = parts.join('\n\n══════════════════════════════\n\n');
  return { fullMessage, parts };
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

    // Step 1: Check if inputId is an ad or adset, resolve to campaign_id
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
      'id,name,objective,status,effective_status,adsets{id,name,status,effective_status,targeting,optimization_goal,billing_event,daily_budget,lifetime_budget},ads{id,name,status,effective_status,creative{id,name,title,body,image_url,thumbnail_url,video_id,object_story_spec,effective_object_story_id,object_story_id,link_url,instagram_permalink_url,call_to_action_type}}';

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

    // Step 3: Extract AdSet & Targeting Information
    const adsetsList = campData.adsets?.data || [];
    const activeAdset =
      adsetsList.find((a: any) => a.effective_status === 'ACTIVE' || a.status === 'ACTIVE') ||
      adsetsList[0] ||
      {};

    const targeting = activeAdset.targeting || {};

    const isAdvantageAudience = Boolean(
      targeting.targeting_automation?.advantage_audience === 1 ||
      targeting.targeting_automation?.advantage_detailed_targeting === 1 ||
      targeting.targeting_optimization === 'expansion_all'
    );

    const targetingType = isAdvantageAudience
      ? 'استهداف أدفانتج بلس (Advantage+ Audience)'
      : 'استهداف تفصيلي يدوي (Manual Targeting)';

    const ageRange = parseAgeRange(targeting.age_min, targeting.age_max);
    const gender = parseGender(targeting.genders);
    const locations = parseLocations(targeting.geo_locations);

    // Extract Interests, Behaviors, Demographics
    const interests: string[] = [];
    const behaviors: string[] = [];
    const demographics: string[] = [];
    const exclusions: string[] = [];

    const flexible = targeting.flexible_spec || [];
    flexible.forEach((spec: any) => {
      if (Array.isArray(spec.interests)) {
        spec.interests.forEach((item: any) => {
          if (item.name) interests.push(item.name);
        });
      }
      if (Array.isArray(spec.behaviors)) {
        spec.behaviors.forEach((item: any) => {
          if (item.name) behaviors.push(item.name);
        });
      }
      if (Array.isArray(spec.demographics)) {
        spec.demographics.forEach((item: any) => {
          if (item.name) demographics.push(item.name);
        });
      }
    });

    if (Array.isArray(targeting.interests)) {
      targeting.interests.forEach((item: any) => {
        if (item.name && !interests.includes(item.name)) interests.push(item.name);
      });
    }
    if (Array.isArray(targeting.behaviors)) {
      targeting.behaviors.forEach((item: any) => {
        if (item.name && !behaviors.includes(item.name)) behaviors.push(item.name);
      });
    }

    if (targeting.exclusions) {
      if (Array.isArray(targeting.exclusions.interests)) {
        targeting.exclusions.interests.forEach((i: any) => exclusions.push(`استبعاد: ${i.name}`));
      }
      if (Array.isArray(targeting.exclusions.behaviors)) {
        targeting.exclusions.behaviors.forEach((b: any) => exclusions.push(`استبعاد: ${b.name}`));
      }
    }

    // Step 4: Extract Ad Creative & Post Information
    const adsList = campData.ads?.data || [];
    const activeAd =
      adsList.find((a: any) => a.effective_status === 'ACTIVE' || a.status === 'ACTIVE') ||
      adsList[0] ||
      {};

    const creative = activeAd.creative || {};
    let postText = creative.body || creative.title || '';
    let imageUrl = creative.image_url || creative.thumbnail_url || '';

    // If text is short and there's a connected post ID, try fetching the full post
    const storyId = creative.effective_object_story_id || creative.object_story_id;
    if (storyId && (!postText || postText.length < 30)) {
      try {
        const postRes = await fetch(
          `https://graph.facebook.com/v21.0/${storyId}?fields=id,message,attachments{media,subattachments{media}}&access_token=${token}`
        );
        const postData = await postRes.json();
        if (postData.message) {
          postText = postData.message;
        }
        const attImg = postData.attachments?.data?.[0]?.media?.image?.src;
        if (attImg && !imageUrl) {
          imageUrl = attImg;
        }
      } catch {}
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

    // Step 5: Run AI Evaluation with Gemini 3.8 Flash
    const evaluation = await vertexAI.evaluateCampaignTargeting({
      campaignName: campData.name || 'حملة إعلانية',
      adsetName: activeAdset.name || undefined,
      postText: postText || campData.name || 'إعلان ترويجي على ميتا',
      imageUrl: imageUrl || undefined,
      currentTargeting: currentTargetingParsed,
    });

    // Step 6: Format Output for WhatsApp
    const { fullMessage, parts } = formatCampaignTargetingForWhatsApp(
      campData,
      activeAdset,
      creative,
      currentTargetingParsed,
      evaluation
    );

    return NextResponse.json({
      success: true,
      campaign_id: campData.id,
      campaign_name: campData.name,
      objective: campData.objective,
      status: campData.effective_status || campData.status,
      adset_name: activeAdset.name || null,
      current_targeting: currentTargetingParsed,
      ad_creative: {
        body: postText,
        image_url: imageUrl || null,
        cta: creative.call_to_action_type || null,
      },
      evaluation,
      formatted_message: fullMessage,
      formatted_message_parts: parts,
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

// Support GET requests as well for easy browser or webhook queries
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

  const mockReq = new Request(req.url, {
    method: 'POST',
    headers: req.headers,
    body: JSON.stringify({ campaign_id: rawInput }),
  });

  return await POST(mockReq);
}
