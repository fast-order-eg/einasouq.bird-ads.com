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
 * دالة مساعدة لاستخراج نوع وعدد النتائج وتكلفة النتيجة (CPA) بدقة حسب هدف الحملة
 */
function extractResultsAndCpa(
  objectiveStr: string,
  actions: any[] = [],
  costPerActions: any[] = [],
  spend: number,
  clicks: number,
  hasMessagingCta: boolean = false
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
    // 1. حملات الرسائل والواتساب
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
    resultType = 'messages';
    resultLabel = 'رسائل';
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
 * دالة مساعدة لاستخراج رابط المنشور والمعاينة المباشر للإعلان
 */
function extractAdUrls(cr: any = {}) {
  let postUrl: string | null = null;

  if (cr.instagram_permalink_url) {
    postUrl = cr.instagram_permalink_url;
  } else if (cr.effective_object_story_id) {
    const parts = String(cr.effective_object_story_id).split('_');
    if (parts.length === 2) {
      postUrl = `https://www.facebook.com/${parts[0]}/posts/${parts[1]}`;
    } else {
      postUrl = `https://www.facebook.com/${cr.effective_object_story_id}`;
    }
  }

  const previewUrl = postUrl || cr.link_url || null;

  return {
    post_url: postUrl,
    preview_url: previewUrl,
    link_url: cr.link_url || null,
  };
}

async function handleRequest(campaignIds: string[], datePreset: string = 'last_7d', forceRefresh: boolean = false) {
  const token = process.env.META_USER_TOKEN;
  if (!token) {
    return { success: false, error: 'توكن الوصول لـ Meta Graph API غير مهيأ في الخادم', status: 500 };
  }

  const cleanIds = Array.from(new Set(campaignIds.map((id) => String(id).trim()).filter(Boolean)));
  if (cleanIds.length === 0) {
    return { success: false, error: 'قائمة معرفات الحملات (campaign_ids) مطلوبة وفارغة', status: 400 };
  }

  const cacheKey = `merchant_${cleanIds.slice().sort().join('_')}_${datePreset}`;
  if (!forceRefresh) {
    const cached = memoryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return { success: true, data: { ...cached.data, from_cache: true } };
    }
  }

  // Preset mapping and sanitization
  const validPresets = ['today', 'yesterday', 'last_3d', 'last_7d', 'last_14d', 'last_30d', 'this_month', 'last_month', 'maximum'];
  const safePreset = validPresets.includes(datePreset) ? datePreset : 'last_7d';

  // Construct Meta Graph API field query with attribution windows and account attribution setting
  const insightsSubquery = `insights.date_preset(${safePreset}).use_account_attribution_setting(true).action_attribution_windows(['7d_click','1d_view']){spend,impressions,reach,clicks,cpc,cpm,ctr,actions,action_values,cost_per_action_type,purchase_roas}`;
  const fields = [
    'id',
    'name',
    'status',
    'effective_status',
    'objective',
    'daily_budget',
    'lifetime_budget',
    'start_time',
    'stop_time',
    insightsSubquery,
    `adsets{id,name,status,effective_status,daily_budget,lifetime_budget,start_time,end_time,targeting,${insightsSubquery}}`,
    `ads{id,name,status,effective_status,adset_id,creative{id,name,title,body,image_url,thumbnail_url,video_id,link_url,call_to_action_type,effective_object_story_id,instagram_permalink_url},${insightsSubquery}}`,
  ].join(',');

  try {
    const url = `https://graph.facebook.com/v21.0/?ids=${cleanIds.join(',')}&fields=${encodeURIComponent(fields)}&access_token=${token}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    const rawData = await res.json();

    if (rawData.error) {
      return {
        success: false,
        error: rawData.error.message || 'خطأ في جلب بيانات الحملات من فيسبوك',
        status: 502,
      };
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

    const formattedCampaigns = cleanIds.map((cId) => {
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

      // Determine Results & CPA according to objective
      const { resultsCount, resultType, resultLabel, cpa } = extractResultsAndCpa(
        camp.objective,
        actions,
        costPerActions,
        spend,
        clicks,
        hasMessagingCta
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
      const rawAdsets = camp.adsets?.data || [];
      if (!resolvedStopTime && rawAdsets.length > 0) {
        for (const aset of rawAdsets) {
          if (aset.end_time) {
            resolvedStopTime = aset.end_time;
            break;
          }
        }
      }

      // Format AdSets
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
          hasMessagingCta
        );

        return {
          id: aset.id,
          name: aset.name,
          status: aset.status,
          effective_status: aset.effective_status,
          start_time: aset.start_time || null,
          stop_time: aset.end_time || null,
          daily_budget: aset.daily_budget ? parseFloat(aset.daily_budget) / 100 : null,
          spend: Number(aSpend.toFixed(2)),
          results: asetRes.resultsCount,
          result_type: asetRes.resultType,
          result_label: asetRes.resultLabel,
          cpa: asetRes.cpa,
          ctr: Number(aCtr.toFixed(2)),
        };
      });

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
          hasMessagingCta
        );

        const urls = extractAdUrls(cr);

        return {
          id: ad.id,
          name: ad.name,
          adset_id: ad.adset_id,
          status: ad.status,
          effective_status: ad.effective_status,
          spend: Number(adSpend.toFixed(2)),
          clicks: adClicks,
          ctr: Number(adCtr.toFixed(2)),
          results: adRes.resultsCount,
          cpa: adRes.cpa,
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
            link_url: urls.link_url,
            effective_object_story_id: cr.effective_object_story_id || null,
            instagram_permalink_url: cr.instagram_permalink_url || null,
          },
        };
      });

      return {
        id: camp.id,
        name: camp.name,
        status: camp.status,
        effective_status: camp.effective_status,
        objective: camp.objective || 'OUTCOME_TRAFFIC',
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
      currency: 'EGP',
      summary: {
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
    const { campaign_ids, date_preset, force_refresh } = body;

    if (!Array.isArray(campaign_ids) || campaign_ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'مصفوفة campaign_ids مطلوبة ويجب أن تحتوي على معرف حملة واحد على الأقل' },
        { status: 400 }
      );
    }

    const result = await handleRequest(campaign_ids, date_preset, Boolean(force_refresh));
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
  const datePreset = searchParams.get('date_preset') || 'last_7d';
  const forceRefresh = searchParams.get('force_refresh') === 'true';

  const campaignIds = idsParam.split(',').map((id) => id.trim()).filter(Boolean);
  if (campaignIds.length === 0) {
    return NextResponse.json(
      { success: false, error: 'المعلمة campaign_ids مطلوبة كقائمة مفصولة بفواصل في الرابط ?campaign_ids=123,456' },
      { status: 400 }
    );
  }

  const result = await handleRequest(campaignIds, datePreset, forceRefresh);
  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.status || 500 });
  }

  return NextResponse.json({ success: true, ...result.data });
}
