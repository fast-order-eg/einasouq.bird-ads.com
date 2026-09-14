import { NextResponse } from 'next/server';
import metaClient from '@/lib/meta';
import prisma from '@/lib/db';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { accountId, forceRefresh, datePreset, timeRange } = body;

    if (!accountId) {
      return NextResponse.json({ success: false, error: 'معرف الحساب الإعلاني مطلوب' }, { status: 400 });
    }

    const formattedExternalId = accountId.startsWith('act_') ? accountId : `act_${accountId}`;
    const cleanId = accountId.replace(/^act_/, '');

    // 1. Check Database Cache if not force-refreshing and no specific datePreset
    const isCustomDate = Boolean((datePreset && datePreset !== 'maximum') || (timeRange && timeRange.since));

    if (!forceRefresh && !isCustomDate) {
      const asset = await prisma.metaAsset.findFirst({
        where: {
          OR: [
            { externalId: formattedExternalId },
            { externalId: cleanId },
          ],
        },
      });

      if (asset && asset.metadataJson) {
        try {
          const meta = JSON.parse(asset.metadataJson);
          if (meta.campaigns_cache && Array.isArray(meta.campaigns_cache) && meta.campaigns_cache.length > 0) {
            return NextResponse.json({
              success: true,
              fromDb: true,
              accountId: cleanId,
              cachedAt: meta.last_inspected_at || asset.updatedAt,
              campaigns: meta.campaigns_cache,
              ads: meta.ads_cache || [],
              note: meta.note || null,
              savedAnalyses: meta.campaign_analyses || {},
            });
          }
        } catch (e) {
          console.error('[Account Ads API] Error parsing DB cache:', e);
        }
      }
    }

    // 2. Fetch fresh from Meta Graph API with datePreset / timeRange
    console.log(`[Account Ads API] Fetching fresh campaigns/ads for ${formattedExternalId} (preset: ${datePreset || 'maximum'})...`);
    const result = await metaClient.getAccountCampaignsAndAds(cleanId, {
      datePreset: datePreset || 'maximum',
      timeRange: timeRange || undefined,
    });
    const now = new Date();

    const processedCampaigns = (result.campaigns || []).map((c: any) => {
      const isEnded = c.stop_time && new Date(c.stop_time) < now;
      const isPaused = c.status === 'PAUSED' || c.effective_status === 'PAUSED';
      const ads = c.ads?.data || [];
      const hasActiveAds = ads.some((a: any) => a.effective_status === 'ACTIVE');
      const hasDisapprovedAds = ads.some((a: any) => a.effective_status === 'DISAPPROVED' || a.effective_status === 'WITH_ISSUES');

      let deliveryStatus: 'ACTIVE' | 'NOT_DELIVERING' | 'PAUSED' | 'COMPLETED' = 'ACTIVE';
      let deliveryLabel = 'نشطة';

      if (isPaused) {
        deliveryStatus = 'PAUSED';
        deliveryLabel = 'متوقفة مؤقتاً';
      } else if (isEnded) {
        deliveryStatus = 'COMPLETED';
        deliveryLabel = 'انتهت / مكتملة';
      } else if (hasDisapprovedAds || !hasActiveAds) {
        deliveryStatus = 'NOT_DELIVERING';
        deliveryLabel = hasDisapprovedAds ? 'لا يتم العرض / إعلانات مرفوضة' : 'لا يتم العرض / لا توجد إعلانات نشطة';
      }

      return {
        ...c,
        delivery_status: deliveryStatus,
        delivery_label: deliveryLabel,
        has_active_ads: hasActiveAds,
        has_disapproved_ads: hasDisapprovedAds,
        is_ended: isEnded,
      };
    });

    // Sort campaigns: Active delivering first
    processedCampaigns.sort((a: any, b: any) => {
      const rank = (s: string) => {
        if (s === 'ACTIVE') return 1;
        if (s === 'PAUSED') return 2;
        if (s === 'NOT_DELIVERING') return 3;
        return 4;
      };
      if (rank(a.delivery_status) !== rank(b.delivery_status)) {
        return rank(a.delivery_status) - rank(b.delivery_status);
      }
      const spendA = parseFloat(a.insights?.data?.[0]?.spend || '0');
      const spendB = parseFloat(b.insights?.data?.[0]?.spend || '0');
      return spendB - spendA;
    });

    // 3. Save to Database Cache (if default preset)
    let savedAnalyses: any = {};
    try {
      const existing = await prisma.metaAsset.findFirst({
        where: {
          OR: [
            { externalId: formattedExternalId },
            { externalId: cleanId },
          ],
        },
      });

      if (existing) {
        let meta: any = {};
        if (existing.metadataJson) {
          try {
            meta = JSON.parse(existing.metadataJson);
          } catch (e) {}
        }

        savedAnalyses = meta.campaign_analyses || {};

        if (!isCustomDate) {
          meta.campaigns_cache = processedCampaigns;
          meta.ads_cache = result.ads || [];
          meta.last_inspected_at = new Date().toISOString();

          await prisma.metaAsset.update({
            where: { id: existing.id },
            data: {
              metadataJson: JSON.stringify(meta),
              updatedAt: new Date(),
            },
          });
        }
      }
    } catch (dbErr) {
      console.error('[Account Ads API] Error saving to DB:', dbErr);
    }

    return NextResponse.json({
      success: true,
      fromDb: false,
      accountId: cleanId,
      cachedAt: new Date().toISOString(),
      datePreset: datePreset || 'maximum',
      timeRange: timeRange || null,
      campaigns: processedCampaigns,
      ads: result.ads || [],
      savedAnalyses,
    });
  } catch (err: any) {
    console.error('[Account Ads API] Error:', err);
    return NextResponse.json({ success: false, error: err.message || 'خطأ في الخادم' }, { status: 500 });
  }
}
