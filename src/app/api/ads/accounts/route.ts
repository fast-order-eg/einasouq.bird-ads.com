import { NextResponse } from 'next/server';
import metaClient from '@/lib/meta';
import prisma from '@/lib/db';

const KNOWN_RESTRICTED_BIZ_IDS = new Set([
  '1161649586027995', // 2 2 - تم تقييد الحساب
  '105312565251932',  // 3selsawy - الأصول مقيدة
  '1244428047671482', // 1 1 - الأصول مقيدة خلال آخر 30 من الأيام
]);

function computeBusinessStatus(b: any, existingMeta: any = {}): 'ACTIVE' | 'RESTRICTED' {
  const bizId = String(b.id || b.externalId);

  // 1. Explicit custom_status from user/system
  if (existingMeta?.custom_status === 'RESTRICTED') return 'RESTRICTED';
  if (existingMeta?.custom_status === 'ACTIVE') return 'ACTIVE';

  // 2. Known restricted portfolios from Meta Business Support Home
  if (KNOWN_RESTRICTED_BIZ_IDS.has(bizId)) {
    return 'RESTRICTED';
  }

  // 3. Inspect owned ad accounts
  const owned = b.owned_ad_accounts?.data || b.owned_ad_accounts || existingMeta?.owned_ad_accounts || [];
  const ownedList = Array.isArray(owned) ? owned : [];

  if (ownedList.length > 0) {
    const hasViolation = ownedList.some((a: any) => a.account_status === 2 || (a.disable_reason && a.disable_reason > 0));
    const hasActiveOwned = ownedList.some((a: any) => a.account_status === 1);

    if (hasViolation && !hasActiveOwned) {
      return 'RESTRICTED';
    }
    if (hasActiveOwned) {
      return 'ACTIVE';
    }
    // If all owned accounts are disabled / closed
    return 'RESTRICTED';
  }

  // 4. If only client accounts, check if all are disabled
  const client = b.client_ad_accounts?.data || b.client_ad_accounts || existingMeta?.client_ad_accounts || [];
  const clientList = Array.isArray(client) ? client : [];
  const linked = b.ad_accounts || existingMeta?.ad_accounts || [];
  const allAccounts = linked.length > 0 ? linked : clientList;

  if (allAccounts.length > 0) {
    const hasAnyActive = allAccounts.some((a: any) => a.account_status === 1);
    if (!hasAnyActive) {
      return 'RESTRICTED';
    }
  }

  // 5. Preserved status if was restricted
  if (existingMeta?.status === 'RESTRICTED') {
    return 'RESTRICTED';
  }

  return 'ACTIVE';
}

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
            business: meta.business || null,
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

              // Fallback to link from adAccounts if not already in meta.ad_accounts
              let adAccountsList = meta.ad_accounts || [];
              if (!adAccountsList || adAccountsList.length === 0) {
                adAccountsList = adAccounts
                  .filter((a) => a.business?.id === b.externalId)
                  .map((a) => ({
                    id: a.account_id || a.id,
                    name: a.name,
                    account_status: a.account_status,
                    amount_spent: a.amount_spent,
                    available_funds: a.available_funds,
                  }));
              }

              const status = computeBusinessStatus({ id: b.externalId, ...meta, ad_accounts: adAccountsList }, meta);

              return {
                id: b.externalId,
                name: b.name,
                note: meta.note || null,
                note_updated_at: meta.note_updated_at || null,
                custom_status: meta.custom_status || null,
                ...meta,
                status,
                ad_accounts: adAccountsList,
                ad_accounts_count: adAccountsList.length,
              };
            });
          } else {
            businesses = await metaClient.getBusinesses();
          }
        } catch (bErr) {
          console.error('[Accounts API] Error loading businesses from DB:', bErr);
        }

        // Reverse link & status sync: Ensure ad accounts have accurate business info and status!
        const bizByAccMap = new Map();
        for (const b of businesses) {
          for (const item of (b.ad_accounts || [])) {
            const cleanId = String(item.id || item.account_id || '').replace(/^act_/, '');
            if (cleanId && !bizByAccMap.has(cleanId)) {
              bizByAccMap.set(cleanId, {
                id: b.id,
                name: b.name,
                verification_status: b.verification_status,
                status: b.status,
              });
            }
          }
        }
        for (const acc of adAccounts) {
          const cleanId = String(acc.account_id || acc.id || '').replace(/^act_/, '');
          if (!acc.business || !acc.business.id) {
            if (bizByAccMap.has(cleanId)) {
              acc.business = bizByAccMap.get(cleanId);
            }
          } else {
            const matchingBiz = businesses.find((b: any) => String(b.id) === String(acc.business.id));
            if (matchingBiz) {
              acc.business.status = matchingBiz.status;
            }
          }
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

    // Prefetch all existing ad account assets from DB into a map (1 fast query instead of 136)
    const existingAssets = await prisma.metaAsset.findMany({
      where: { assetType: 'AD_ACCOUNT' },
    });
    const assetMap = new Map(existingAssets.map((asset) => [asset.externalId, asset]));

    const enrichedAccounts: any[] = [];
    const now = new Date();

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

      // Check existing note, is_excluded, and analyses from DB prefetch map
      let existingNote: string | null = null;
      let existingNoteDate: string | null = null;
      let isExcluded = accountStatus !== 1;
      let campaignAnalyses: any = null;
      let existingParsedMeta: any = {};

      const existingAsset = assetMap.get(formattedExternalId);

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

      // Fast in-memory active campaigns check from nested campaigns data already returned by getAdAccounts
      let activeCampsCount = 0;
      if (accountStatus === 1 && !isExcluded) {
        if (a.campaigns?.data && Array.isArray(a.campaigns.data)) {
          activeCampsCount = a.campaigns.data.filter((c: any) => {
            const isPaused = c.status === 'PAUSED' || c.effective_status === 'PAUSED' || c.effective_status === 'CAMPAIGN_PAUSED' || c.effective_status === 'ADSET_PAUSED';
            const isEnded = c.stop_time && new Date(c.stop_time) < now;
            const innerAds = c.ads?.data || [];
            const hasDisapprovedAds = innerAds.some((ad: any) => ad.effective_status === 'DISAPPROVED');
            const hasActiveAds = innerAds.length > 0 ? innerAds.some((ad: any) => ad.effective_status === 'ACTIVE') : false;
            return !isPaused && !isEnded && !hasDisapprovedAds && hasActiveAds;
          }).length;
        } else if (Array.isArray(existingParsedMeta.campaigns_cache)) {
          activeCampsCount = existingParsedMeta.campaigns_cache.filter((c: any) => c.delivery_status === 'ACTIVE').length;
        }
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
        business: a.business || existingParsedMeta.business || null,
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
        business: a.business || existingParsedMeta.business || null,
        _formattedExternalId: formattedExternalId,
        _metaPayload: metaPayload,
      });
    }

    // Parallel batch upsert accounts to DB (chunks of 20)
    for (let i = 0; i < enrichedAccounts.length; i += 20) {
      const chunk = enrichedAccounts.slice(i, i + 20);
      await Promise.all(
        chunk.map(async (acc) => {
          try {
            await prisma.metaAsset.upsert({
              where: { externalId: acc._formattedExternalId },
              update: {
                name: acc.name,
                isAuthorized: acc.account_status === 1,
                metadataJson: JSON.stringify(acc._metaPayload),
                updatedAt: new Date(),
              },
              create: {
                connectionId: connection?.id,
                assetType: 'AD_ACCOUNT',
                externalId: acc._formattedExternalId,
                name: acc.name,
                category: 'Ad Account',
                isAuthorized: acc.account_status === 1,
                metadataJson: JSON.stringify(acc._metaPayload),
              },
            });
          } catch (dbErr) {
            console.error('[Accounts API] DB save error for account:', acc._formattedExternalId, dbErr);
          }
        })
      );
    }

    // Clean internal properties before returning
    for (const acc of enrichedAccounts) {
      delete acc._formattedExternalId;
      delete acc._metaPayload;
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

    // Enrich businesses with accounts, notes, and status
    const existingBizAssets = await prisma.metaAsset.findMany({
      where: { assetType: 'BUSINESS' },
    });
    const bizAssetMap = new Map(existingBizAssets.map((asset) => [asset.externalId, asset]));

    const enrichedBusinesses = businesses.map((b) => {
      const existingBizAsset = bizAssetMap.get(b.id);
      let existingBizMeta: any = {};
      if (existingBizAsset?.metadataJson) {
        try { existingBizMeta = JSON.parse(existingBizAsset.metadataJson); } catch (e) {}
      }

      const matchedFromAccounts = enrichedAccounts
        .filter((a) => a.business?.id === b.id)
        .map((a) => ({
          id: a.account_id || a.id,
          name: a.name,
          account_status: a.account_status,
          amount_spent: a.amount_spent,
          available_funds: a.available_funds,
        }));

      const owned = (b.owned_ad_accounts?.data || []).map((a: any) => ({
        id: (a.account_id || a.id || '').replace(/^act_/, ''),
        name: a.name,
        account_status: a.account_status,
        disable_reason: a.disable_reason,
        is_owned: true,
      }));
      const client = (b.client_ad_accounts?.data || []).map((a: any) => ({
        id: (a.account_id || a.id || '').replace(/^act_/, ''),
        name: a.name,
        account_status: a.account_status,
        disable_reason: a.disable_reason,
        is_owned: false,
      }));

      const accMap = new Map();
      for (const item of [...matchedFromAccounts, ...owned, ...client]) {
        if (item.id && !accMap.has(item.id)) {
          accMap.set(item.id, item);
        }
      }
      const linkedAccounts = Array.from(accMap.values());

      const status = computeBusinessStatus({
        ...b,
        owned_ad_accounts: owned,
        client_ad_accounts: client,
        ad_accounts: linkedAccounts,
      }, existingBizMeta);

      const customStatus = existingBizMeta.custom_status || (status === 'RESTRICTED' && KNOWN_RESTRICTED_BIZ_IDS.has(b.id) ? 'RESTRICTED' : undefined);

      return {
        ...b,
        owned_ad_accounts: owned,
        client_ad_accounts: client,
        note: existingBizMeta.note || null,
        note_updated_at: existingBizMeta.note_updated_at || null,
        custom_status: customStatus || null,
        status,
        ad_accounts: linkedAccounts,
        ad_accounts_count: linkedAccounts.length,
      };
    });

    // Parallel persist businesses to DB
    await Promise.all(
      enrichedBusinesses.map(async (b) => {
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
      })
    );

    // Reverse link & status sync: Ensure ad accounts have accurate business info and status!
    const liveBizByAccMap = new Map();
    for (const b of enrichedBusinesses) {
      for (const item of (b.ad_accounts || [])) {
        const cleanId = String(item.id || item.account_id || '').replace(/^act_/, '');
        if (cleanId && !liveBizByAccMap.has(cleanId)) {
          liveBizByAccMap.set(cleanId, {
            id: b.id,
            name: b.name,
            verification_status: b.verification_status,
            status: b.status,
          });
        }
      }
    }
    for (const acc of enrichedAccounts) {
      const cleanId = String(acc.account_id || acc.id || '').replace(/^act_/, '');
      if (!acc.business || !acc.business.id) {
        if (liveBizByAccMap.has(cleanId)) {
          acc.business = liveBizByAccMap.get(cleanId);
        }
      } else {
        const matchingBiz = enrichedBusinesses.find((b: any) => String(b.id) === String(acc.business.id));
        if (matchingBiz) {
          acc.business.status = matchingBiz.status;
        }
      }
    }

    const totalActiveCampaigns = activeVisibleEnriched.reduce((acc, a) => acc + (a.active_campaigns_count || 0), 0);

    const lastUpdated = new Date().toISOString();

    return NextResponse.json({
      success: true,
      fromDb: false,
      lastUpdated,
      adAccounts: enrichedAccounts,
      businesses: enrichedBusinesses,
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
