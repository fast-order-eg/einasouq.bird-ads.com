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

          return {
            id: a.externalId,
            account_id: a.externalId.replace(/^act_/, ''),
            name: a.name,
            account_status: accountStatus,
            currency: meta.currency || 'EGP',
            amount_spent: meta.amount_spent || '0',
            available_funds: meta.available_funds || '0.00',
            active_campaigns_count: meta.active_campaigns_count || 0,
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

        const totalSpent = adAccounts.reduce((acc, a) => acc + parseFloat(a.amount_spent || '0') / 100, 0);
        const totalAvailableFunds = adAccounts.reduce((acc, a) => acc + parseFloat(a.available_funds || '0'), 0);
        const totalActiveCampaigns = adAccounts.reduce((acc, a) => acc + (a.active_campaigns_count || 0), 0);

        return NextResponse.json({
          success: true,
          fromDb: true,
          adAccounts,
          businesses,
          summary: {
            totalAccounts: adAccounts.length,
            activeAccounts: adAccounts.filter(a => a.account_status === 1 && !a.is_excluded).length,
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

      let availableFunds = '0.00';
      const balance = parseFloat(a.balance || '0') / 100;
      const spendCap = parseFloat(a.spend_cap || '0') / 100;
      const amountSpent = parseFloat(a.amount_spent || '0') / 100;

      if (spendCap > 0 && amountSpent > 0 && spendCap > amountSpent) {
        availableFunds = (spendCap - amountSpent).toFixed(2);
      } else if (balance > 0) {
        availableFunds = balance.toFixed(2);
      }

      // Check existing note, is_excluded, and analyses
      let existingNote: string | null = null;
      let existingNoteDate: string | null = null;
      let isExcluded = accountStatus !== 1;
      let campaignAnalyses: any = null;

      const existingAsset = await prisma.metaAsset.findFirst({
        where: { externalId: formattedExternalId },
      });

      if (existingAsset?.metadataJson) {
        try {
          const parsed = JSON.parse(existingAsset.metadataJson);
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

      // Quick active campaigns count check
      let activeCampsCount = 0;
      if (accountStatus === 1 && !isExcluded) {
        try {
          const campsRes = await fetch(`https://graph.facebook.com/v21.0/${formattedExternalId}/campaigns?fields=id,status,effective_status&effective_status=['ACTIVE']&limit=50&access_token=${process.env.META_USER_TOKEN}`);
          const campsData = await campsRes.json();
          if (campsData.data && Array.isArray(campsData.data)) {
            activeCampsCount = campsData.data.length;
          }
        } catch (e) {}
      }

      const metaPayload = {
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

    const totalSpent = enrichedAccounts.reduce((acc, a) => acc + parseFloat(a.amount_spent || '0') / 100, 0);
    const totalAvailableFunds = enrichedAccounts.reduce((acc, a) => acc + parseFloat(a.available_funds || '0'), 0);
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

    const totalActiveCampaigns = enrichedAccounts.reduce((acc, a) => acc + (a.active_campaigns_count || 0), 0);

    return NextResponse.json({
      success: true,
      fromDb: false,
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
