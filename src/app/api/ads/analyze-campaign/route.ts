import { NextResponse } from 'next/server';
import vertexAI from '@/lib/vertex';
import prisma from '@/lib/db';
async function enrichAdsWithMedia(ads: any[], userToken: string) {
  if (!ads || ads.length === 0 || !userToken) return ads;

  const pageTokens = new Map<string, string>();
  try {
    const pageUrl = `https://graph.facebook.com/v21.0/me/accounts?fields=id,access_token&limit=100&access_token=${userToken}`;
    const res: any = await fetch(pageUrl, { signal: AbortSignal.timeout(5000) });
    const data: any = await res.json();
    (data.data || []).forEach((p: any) => {
      if (p.id && p.access_token) pageTokens.set(p.id, p.access_token);
    });
  } catch (e) {
    console.error('[enrichAdsWithMedia] Error fetching page tokens:', e);
  }

  // Only enrich top spending ads (up to 4 ads) to keep Meta API roundtrip under 3-4s
  const topAds = ads.slice(0, 4);

  await Promise.all(
    topAds.map(async (ad: any) => {
      const cr = ad.creative || {};
      const videoId = cr.video_id || cr.object_story_spec?.video_data?.video_id;
      const storyId = cr.effective_object_story_id || cr.object_story_id || '';
      const pageId = storyId ? storyId.split('_')[0] : '';
      const pageToken = pageTokens.get(pageId) || userToken;

      // 1. Fetch direct MP4 source for video
      if (videoId && !cr.video_source) {
        try {
          const vUrl = `https://graph.facebook.com/v21.0/${videoId}?fields=id,source,picture,length&access_token=${pageToken}`;
          const vRes: any = await fetch(vUrl, { signal: AbortSignal.timeout(4000) });
          const vData: any = await vRes.json();
          if (vData.source) {
            cr.video_source = vData.source;
          }
        } catch (e) {
          console.error(`[enrichAdsWithMedia] Error fetching video source for ${videoId}:`, e);
        }
      }

      // 2. Fetch full resolution images from post attachments
      if (storyId) {
        try {
          const pUrl = `https://graph.facebook.com/v21.0/${storyId}?fields=id,attachments{media,subattachments{media}}&access_token=${pageToken}`;
          const pRes: any = await fetch(pUrl, { signal: AbortSignal.timeout(4000) });
          const pData: any = await pRes.json();
          const att = pData.attachments?.data?.[0];
          const sub = att?.subattachments?.data || [];
          const extractedImages: string[] = [];
          if (sub.length > 0) {
            sub.forEach((s: any) => {
              if (s.media?.image?.src) extractedImages.push(s.media.image.src);
            });
          } else if (att?.media?.image?.src) {
            extractedImages.push(att.media.image.src);
          }
          if (extractedImages.length > 0) {
            cr.images = extractedImages;
            cr.thumbnail_url = extractedImages[0];
          }
        } catch (e) {
          console.error(`[enrichAdsWithMedia] Error fetching post images for ${storyId}:`, e);
        }
      }

      if (!cr.images || cr.images.length === 0) {
        const fallback = cr.image_url || cr.thumbnail_url;
        cr.images = fallback ? [fallback] : [];
      }
    })
  );

  return ads;
}

export async function POST(req: Request) {
  try {
    const { campaign, accountId, accountName, currency } = await req.json();

    if (!campaign || !campaign.id) {
      return NextResponse.json({ success: false, error: 'بيانات الحملة الإعلانية مطلوبة' }, { status: 400 });
    }

    // Always fetch fresh adsets targeting and ads video details directly from Meta if missing
    let enrichedCampaign = { ...campaign };
    const token = process.env.META_USER_TOKEN;

    if (token && campaign.id) {
      try {
        const campUrl = `https://graph.facebook.com/v21.0/${campaign.id}?fields=id,name,objective,daily_budget,lifetime_budget,stop_time,insights.date_preset(maximum){spend,impressions,reach,clicks,cpc,cpm,ctr,frequency,cost_per_action_type,actions,action_values},adsets{id,name,status,effective_status,targeting,optimization_goal,billing_event,daily_budget,lifetime_budget,insights.date_preset(maximum){spend,impressions,reach,clicks,cpc,cpm,ctr,actions,cost_per_action_type}},ads{id,name,status,effective_status,adset_id,creative{id,name,title,body,image_url,thumbnail_url,video_id,object_story_spec,effective_object_story_id,object_story_id,link_url,instagram_permalink_url,call_to_action_type},insights.date_preset(maximum){spend,impressions,reach,clicks,cpc,cpm,ctr,frequency,cost_per_action_type,actions,action_values,video_p25_watched_actions,video_p50_watched_actions,video_p100_watched_actions,video_avg_time_watched_actions}}&access_token=${token}`;
        const res = await fetch(campUrl);
        const data = await res.json();
        if (data.name) enrichedCampaign.name = data.name;
        if (data.objective) enrichedCampaign.objective = data.objective;
        if (data.daily_budget) enrichedCampaign.daily_budget = data.daily_budget;
        if (data.lifetime_budget) enrichedCampaign.lifetime_budget = data.lifetime_budget;
        if (data.insights?.data && data.insights.data.length > 0) {
          enrichedCampaign.insights = data.insights;
        }
        if (data.adsets?.data && data.adsets.data.length > 0) {
          enrichedCampaign.adsets = data.adsets;
        }
        if (data.ads?.data && data.ads.data.length > 0) {
          enrichedCampaign.ads = data.ads;
        }
      } catch (e) {
        console.error('[Analyze Campaign API] Error fetching fresh campaign details from Meta:', e);
      }
    }

    // Enrich ads with full-resolution images and direct MP4 video sources
    if (token && enrichedCampaign.ads) {
      const adsList = enrichedCampaign.ads?.data || enrichedCampaign.ads || [];
      await enrichAdsWithMedia(adsList, token);
    }

    // Run deep AI strategic analysis via Gemini 2.5 Pro
    const analysis = await vertexAI.analyzeCampaignPerformance(enrichedCampaign, {
      accountName: accountName || 'حساب إعلاني',
      currency: currency || 'EGP',
    });

    // Save Analysis to Database in MetaAsset.metadataJson under campaign_analyses
    if (accountId) {
      try {
        const formattedExternalId = accountId.startsWith('act_') ? accountId : `act_${accountId}`;
        const cleanId = accountId.replace(/^act_/, '');

        const asset = await prisma.metaAsset.findFirst({
          where: {
            OR: [
              { externalId: formattedExternalId },
              { externalId: cleanId },
            ],
          },
        });

        if (asset) {
          let meta: any = {};
          if (asset.metadataJson) {
            try {
              meta = JSON.parse(asset.metadataJson);
            } catch (e) {}
          }

          if (!meta.campaign_analyses) {
            meta.campaign_analyses = {};
          }

          meta.campaign_analyses[campaign.id] = {
            campaign_id: campaign.id,
            campaign_name: campaign.name,
            analyzed_at: new Date().toISOString(),
            analysis: analysis,
          };

          await prisma.metaAsset.update({
            where: { id: asset.id },
            data: {
              metadataJson: JSON.stringify(meta),
              updatedAt: new Date(),
            },
          });
        }
      } catch (dbErr) {
        console.error('[Analyze Campaign API] Error saving analysis to DB:', dbErr);
      }
    }

    return NextResponse.json({
      success: true,
      campaignId: campaign.id,
      analysis,
      analyzedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[Analyze Campaign API] Error:', err);
    return NextResponse.json({ success: false, error: err.message || 'خطأ في الخادم' }, { status: 500 });
  }
}
