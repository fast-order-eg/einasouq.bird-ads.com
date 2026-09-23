import { NextResponse } from 'next/server';
import metaClient from '@/lib/meta';
import prisma from '@/lib/db';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const refresh = searchParams.get('refresh') === 'true';
  const activeOnly = searchParams.get('activeOnly') === 'true';

  try {
    // 1. Fetch from Database first if not refreshing
    if (!refresh) {
      const savedAccounts = await prisma.metaAsset.findMany({
        where: { assetType: 'AD_ACCOUNT' },
        orderBy: { updatedAt: 'desc' },
      });

      if (savedAccounts && savedAccounts.length > 0) {
        const adAccounts = savedAccounts.map((a) => {
          let meta: any = {};
          if (a.metadataJson) {
            try {
              meta = JSON.parse(a.metadataJson);
            } catch (e) {}
          }
          const accountStatus = meta.account_status !== undefined ? meta.account_status : (a.isAuthorized ? 1 : 2);
          const isExcluded = meta.is_excluded !== undefined ? meta.is_excluded : (accountStatus !== 1);

          let activeCampaignsCount = meta.active_campaigns_count || 0;
          if (Array.isArray(meta.campaigns_cache)) {
            activeCampaignsCount = meta.campaigns_cache.filter((c: any) => c.delivery_status === 'ACTIVE').length;
          }
          if (accountStatus !== 1 || isExcluded) {
            activeCampaignsCount = 0;
          }

          const roundedFunds = Math.round(parseFloat(meta.available_funds || '0')).toString();

          return {
            id: a.externalId,
            account_id: a.externalId.replace(/^act_/, ''),
            name: a.name,
            account_status: accountStatus,
            currency: meta.currency || 'EGP',
            amount_spent: meta.amount_spent || '0',
            available_funds: roundedFunds,
            active_campaigns_count: activeCampaignsCount,
            has_cache: Boolean(meta.campaigns_cache && meta.campaigns_cache.length > 0),
            note: meta.note || null,
            note_updated_at: meta.note_updated_at || null,
            is_excluded: isExcluded,
            campaign_analyses_count: meta.campaign_analyses ? Object.keys(meta.campaign_analyses).length : 0,
          };
        });

        // Sort: Active & Running first, Disabled and Excluded last
        adAccounts.sort((a, b) => {
          if (a.is_excluded !== b.is_excluded) return a.is_excluded ? 1 : -1;
          if (a.account_status !== b.account_status) {
            if (a.account_status === 1) return -1;
            if (b.account_status === 1) return 1;
          }
          if (b.active_campaigns_count !== a.active_campaigns_count) {
            return b.active_campaigns_count - a.active_campaigns_count;
          }
          const fundsA = parseFloat(a.available_funds || '0');
          const fundsB = parseFloat(b.available_funds || '0');
          if (fundsB !== fundsA) return fundsB - fundsA;
          return parseFloat(b.amount_spent || '0') - parseFloat(a.amount_spent || '0');
        });

        let businesses: any[] = [];
        try {
          const savedBusinesses = await prisma.metaAsset.findMany({
            where: { assetType: 'BUSINESS' },
            orderBy: { name: 'asc' },
          });
          if (savedBusinesses && savedBusinesses.length > 0) {
            businesses = savedBusinesses.map((b) => {
              let meta: any = {};
              try { meta = JSON.parse(b.metadataJson || '{}'); } catch(e) {}
              return {
                id: b.externalId,
                name: b.name,
                ...meta,
              };
            });
          } else {
            businesses = await metaClient.getBusinesses();
          }
        } catch (bErr) {
          console.error('[Accounts API] Error loading businesses from DB:', bErr);
        }

        const activeVisibleAccounts = adAccounts.filter(a => a.account_status === 1 && !a.is_excluded);
        const totalSpent = Math.round(activeVisibleAccounts.reduce((acc, a) => acc + parseFloat(a.amount_spent || '0') / 100, 0));
        const totalAvailableFunds = Math.round(activeVisibleAccounts.reduce((acc, a) => acc + parseFloat(a.available_funds || '0'), 0));
        const totalActiveCampaigns = activeVisibleAccounts.reduce((acc, a) => acc + (a.active_campaigns_count || 0), 0);

        const lastUpdated = savedAccounts[0]?.updatedAt ? new Date(savedAccounts[0].updatedAt).toISOString() : new Date().toISOString();

        return NextResponse.json({
          success: true,
          fromDb: true,
          lastUpdated,
          adAccounts,
          businesses,
          summary: {
            totalAccounts: adAccounts.length,
            activeAccounts: activeVisibleAccounts.length,
            excludedAccounts: adAccounts.filter(a => a.is_excluded).length,
            disabledAccounts: adAccounts.filter(a => a.account_status !== 1).length,
            totalActiveCampaigns,
            totalSpent,
            totalAvailableFunds,
          },
        });
      }
    }

    // 2. Fetch fresh from Meta
    const metaAccounts = await metaClient.getAdAccounts();
    const businesses = await metaClient.getBusinesses();

    const connection = await prisma.metaConnection.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });

    const enrichedAccounts: any[] = [];

    for (const a of metaAccounts) {
      const cleanId = a.account_id || a.id.replace(/^act_/, '');
      const formattedExternalId = a.id.startsWith('act_') ? a.id : `act_${cleanId}`;
      const accountStatus = a.account_status !== undefined ? a.account_status : 1;

      let availableFunds = '0';
      const balance = parseFloat(a.balance || '0') / 100;
      const spendCap = parseFloat(a.spend_cap || '0') / 100;
      const amountSpent = parseFloat(a.amount_spent || '0') / 100;

      if (spendCap > 0 && amountSpent > 0 && spendCap > amountSpent) {
        availableFunds = Math.round(spendCap - amountSpent).toString();
      } else if (balance > 0) {
        availableFunds = Math.round(balance).toString();
      }

      // Check existing note, is_excluded, and analyses
      let existingNote: string | null = null;
      let existingNoteDate: string | null = null;
      let isExcluded = accountStatus !== 1;
      let campaignAnalyses: any = null;
      let existingParsedMeta: any = {};

      const existingAsset = await prisma.metaAsset.findFirst({
        where: { externalId: formattedExternalId },
      });

      if (existingAsset?.metadataJson) {
        try {
          const parsed = JSON.parse(existingAsset.metadataJson);
          existingParsedMeta = parsed;
          if (parsed.note) {
            existingNote = parsed.note;
            existingNoteDate = parsed.note_updated_at;
          }
          if (parsed.is_excluded !== undefined) {
            isExcluded = parsed.is_excluded;
          }
          if (parsed.campaign_analyses) {
            campaignAnalyses = parsed.campaign_analyses;
          }
        } catch (e) {}
      }

      // Accurate active campaigns count check (excludes paused, ended/completed, disapproved, or 0 active ads)
      let activeCampsCount = 0;
      if (accountStatus === 1 && !isExcluded) {
        try {
          const filterParam = encodeURIComponent(JSON.stringify([{ field: 'effective_status', operator: 'IN', value: ['ACTIVE'] }]));
          const campsRes = await fetch(`https://graph.facebook.com/v21.0/${formattedExternalId}/campaigns?fields=id,status,effective_status,stop_time,ads.limit(10){effective_status}&filtering=${filterParam}&limit=100&access_token=${process.env.META_USER_TOKEN}`);
          const campsData = await campsRes.json();
          if (campsData.data && Array.isArray(campsData.data)) {
            const now = new Date();
            activeCampsCount = campsData.data.filter((c: any) => {
              const isPaused = c.status === 'PAUSED' || c.effective_status === 'PAUSED' || c.effective_status === 'CAMPAIGN_PAUSED' || c.effective_status === 'ADSET_PAUSED';
              const isEnded = c.stop_time && new Date(c.stop_time) < now;
              const innerAds = c.ads?.data || [];
              const hasDisapprovedAds = innerAds.some((ad: any) => ad.effective_status === 'DISAPPROVED');
              const hasActiveAds = innerAds.length > 0 ? innerAds.some((ad: any) => ad.effective_status === 'ACTIVE') : false;
              return !isPaused && !isEnded && !hasDisapprovedAds && hasActiveAds;
            }).length;
          }
        } catch (e) {}
      }

      const metaPayload = {
        ...existingParsedMeta,
        account_status: accountStatus,
        currency: a.currency,
        amount_spent: a.amount_spent,
        available_funds: availableFunds,
        active_campaigns_count: activeCampsCount,
        note: existingNote,
        note_updated_at: existingNoteDate,
        is_excluded: isExcluded,
        campaign_analyses: campaignAnalyses,
      };

      enrichedAccounts.push({
        ...a,
        account_id: cleanId,
        available_funds: availableFunds,
        active_campaigns_count: activeCampsCount,
        has_cache: Boolean(existingParsedMeta.campaigns_cache && existingParsedMeta.campaigns_cache.length > 0),
        note: existingNote,
        note_updated_at: existingNoteDate,
        is_excluded: isExcluded,
        campaign_analyses_count: campaignAnalyses ? Object.keys(campaignAnalyses).length : 0,
      });

      try {
        await prisma.metaAsset.upsert({
          where: { externalId: formattedExternalId },
          update: {
            name: a.name,
            isAuthorized: accountStatus === 1,
            metadataJson: JSON.stringify(metaPayload),
            updatedAt: new Date(),
          },
          create: {
            connectionId: connection?.id,
            assetType: 'AD_ACCOUNT',
            externalId: formattedExternalId,
            name: a.name,
            category: 'Ad Account',
            isAuthorized: accountStatus === 1,
            metadataJson: JSON.stringify(metaPayload),
          },
        });
      } catch (dbErr) {
        console.error('[Accounts API] DB save error:', dbErr);
      }
    }

    // Sort: Active & Running first, Disabled and Excluded last
    enrichedAccounts.sort((a, b) => {
      if (a.is_excluded !== b.is_excluded) return a.is_excluded ? 1 : -1;
      if (a.account_status !== b.account_status) {
        if (a.account_status === 1) return -1;
        if (b.account_status === 1) return 1;
      }
      if (b.active_campaigns_count !== a.active_campaigns_count) {
        return b.active_campaigns_count - a.active_campaigns_count;
      }
      const fundsA = parseFloat(a.available_funds || '0');
      const fundsB = parseFloat(b.available_funds || '0');
      if (fundsB !== fundsA) return fundsB - fundsA;
      return parseFloat(b.amount_spent || '0') - parseFloat(a.amount_spent || '0');
    });

    const activeVisibleEnriched = enrichedAccounts.filter(a => a.account_status === 1 && !a.is_excluded);
    const totalSpent = Math.round(activeVisibleEnriched.reduce((acc, a) => acc + parseFloat(a.amount_spent || '0') / 100, 0));
    const totalAvailableFunds = Math.round(activeVisibleEnriched.reduce((acc, a) => acc + parseFloat(a.available_funds || '0'), 0));
    // Persist businesses to DB
    for (const b of businesses) {
      try {
        await prisma.metaAsset.upsert({
          where: { externalId: b.id },
          update: {
            name: b.name,
            assetType: 'BUSINESS',
            metadataJson: JSON.stringify(b),
            updatedAt: new Date(),
          },
          create: {
            connectionId: connection?.id || null,
            externalId: b.id,
            name: b.name,
            assetType: 'BUSINESS',
            isAuthorized: true,
            metadataJson: JSON.stringify(b),
          },
        });
      } catch (bErr) {}
    }

    const totalActiveCampaigns = activeVisibleEnriched.reduce((acc, a) => acc + (a.active_campaigns_count || 0), 0);

    const lastUpdated = new Date().toISOString();

    return NextResponse.json({
      success: true,
      fromDb: false,
      lastUpdated,
      adAccounts: enrichedAccounts,
      businesses,
      summary: {
        totalAccounts: enrichedAccounts.length,
        activeAccounts: enrichedAccounts.filter(a => a.account_status === 1 && !a.is_excluded).length,
        excludedAccounts: enrichedAccounts.filter(a => a.is_excluded).length,
        disabledAccounts: enrichedAccounts.filter(a => a.account_status !== 1).length,
        totalActiveCampaigns,
        totalSpent,
        totalAvailableFunds,
      },
    });
  } catch (err: any) {
    console.error('[Accounts API] Error:', err);
    return NextResponse.json({ success: false, error: err.message || 'خطأ في الخادم' }, { status: 500 });
  }
}
