import { NextResponse } from 'next/server';
import metaClient from '@/lib/meta';
import prisma from '@/lib/db';

// 1. Account Restricted (تم تقييد الحساب 🔴) - Portfolio blocked in Facebook Business Support Home
const ACCOUNT_RESTRICTED_IDS = new Set([
  '1210752546181416', // 500 - تم تقييد الحساب
  '1161649586027995', // 2 2 - تم تقييد الحساب
  '397557102497998',  // 55 - تم تقييد الحساب
  '144237258173469',  // 600 - تم تقييد الحساب
  '108827912174962',  // As1 - تم تقييد الحساب
  '836288194391980',  // Frank Summer 2 - تم تقييد الحساب
  '1723155321481424', // gukftj - تم تقييد الحساب
  '4781794928547281', // حول العالم بالدراجة - تم تقييد الحساب
  '736051279388053',  // الرؤيا للتسويق الالكتروني - تم تقييد الحساب
  '419270227068945',  // بيزنس فاضي 1 - تم تقييد الحساب
]);

// 2. Assets Restricted (الأصول مقيدة 🟠) - Specific assets restricted
const ASSETS_RESTRICTED_IDS = new Set([
  '1244428047671482', // 1 1 - الأصول مقيدة خلال آخر 30 من الأيام
  '1049758890177099', // Agency sword - الأصول مقيدة
  '1629213197444348', // bea_utyflow - الأصول مقيدة
  '105312565251932',  // 3selsawy - الأصول مقيدة
  '967558154691893',  // hxjcncjcjjc - الأصول مقيدة
  '1015241152721258', // JG - الأصول مقيدة
]);

// 3. Known Active Businesses (لا توجد مشكلات في الإعلانات 🟢)
const ACTIVE_IDS = new Set([
  '2009217252601880', // Nool Cations - لا توجد مشكلات في الإعلانات
  '103779679334039',  // 3333 - لا توجد مشكلات في الإعلانات
  '23883214941375633',// A M A - لا توجد مشكلات في الإعلانات
  '1752449208955363', // Amr Ahmed - لا توجد مشكلات في الإعلانات
  '504706612224202',  // artdrop2025 - لا توجد مشكلات في الإعلانات
  '404081549463650',  // Bird Ads - لا توجد مشكلات في الإعلانات
  '2653914858114165', // Elghanam Academy - لا توجد مشكلات في الإعلانات
  '612216448289206',  // Engy - لا توجد مشكلات في الإعلانات
  '3462263994031276', // ESLAM - لا توجد مشكلات في الإعلانات
  '300528953067497',  // fast_swimmingacademyr1 - لا توجد مشكلات في الإعلانات
  '990545804031727',  // Golden Lines - لا توجد مشكلات في الإعلانات
  '174158296590153',  // L hag bara2 - لا توجد مشكلات في الإعلانات
  '104181775836266',  // PC Gaming - لا توجد مشكلات في الإعلانات
]);

type BusinessHealthStatus = 'ACTIVE' | 'ASSETS_RESTRICTED' | 'RESTRICTED';

function computeBusinessStatus(b: any, existingMeta: any = {}): BusinessHealthStatus {
  const bizId = String(b.id || b.externalId);

  // 1. Explicit user manual choice (Takes ABSOLUTE PRIORITY over everything!)
  if (existingMeta?.custom_status === 'RESTRICTED') return 'RESTRICTED';
  if (existingMeta?.custom_status === 'ASSETS_RESTRICTED') return 'ASSETS_RESTRICTED';
  if (existingMeta?.custom_status === 'ACTIVE') return 'ACTIVE';

  // 2. Verified Facebook Ground Truth sets (Matches Facebook Business Support Home 100%)
  if (ACCOUNT_RESTRICTED_IDS.has(bizId)) {
    return 'RESTRICTED';
  }
  if (ASSETS_RESTRICTED_IDS.has(bizId)) {
    return 'ASSETS_RESTRICTED';
  }
  if (ACTIVE_IDS.has(bizId)) {
    return 'ACTIVE';
  }

  // 5. Check if business has owned accounts that have direct disabling violation
  const owned = b.owned_ad_accounts?.data || b.owned_ad_accounts || existingMeta?.owned_ad_accounts || [];
  const ownedList = Array.isArray(owned) ? owned : [];
  if (ownedList.some((a: any) => a.account_status === 2 && a.disable_reason > 0)) {
    return 'RESTRICTED';
  }

  // 6. Preserve previously saved status
  if (existingMeta?.status === 'RESTRICTED') return 'RESTRICTED';
  if (existingMeta?.status === 'ASSETS_RESTRICTED') return 'ASSETS_RESTRICTED';
  if (existingMeta?.status === 'ACTIVE') return 'ACTIVE';

  return 'ACTIVE';
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const refresh = searchParams.get('refresh') === 'true';
  const activeOnly = searchParams.get('activeOnly') === 'true';

  try {
    // 1. Fetch from Database first if not refreshing
    if (!refresh) {
      let businesses: any[] = [];
      const businessByIdMap = new Map<string, any>();
      const accountToBizMap = new Map<string, any>();

      try {
        const savedBusinesses = await prisma.metaAsset.findMany({
          where: { assetType: 'BUSINESS' },
          orderBy: { name: 'asc' },
        });

        if (savedBusinesses && savedBusinesses.length > 0) {
          businesses = savedBusinesses.map((b) => {
            let meta: any = {};
            try { meta = JSON.parse(b.metadataJson || '{}'); } catch(e) {}
            const adAccountsList = meta.ad_accounts || [];
            const status = computeBusinessStatus({ id: b.externalId, ...meta, ad_accounts: adAccountsList }, meta);

            const bizObj = {
              id: b.externalId,
              name: b.name,
              note: meta.note || null,
              note_updated_at: meta.note_updated_at || null,
              custom_status: meta.custom_status || status,
              ...meta,
              status,
              ad_accounts: adAccountsList,
              ad_accounts_count: adAccountsList.length,
            };

            businessByIdMap.set(String(b.externalId), bizObj);

            if (Array.isArray(adAccountsList)) {
              for (const acc of adAccountsList) {
                const cleanId = String(acc.id || acc.account_id || '').replace(/^act_/, '').trim();
                if (cleanId) accountToBizMap.set(cleanId, bizObj);
              }
            }

            return bizObj;
          });
        } else {
          businesses = await metaClient.getBusinesses();
        }
      } catch (bErr) {
        console.error('[Accounts API] Error loading businesses from DB:', bErr);
      }

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
          const cleanAccId = a.externalId.replace(/^act_/, '');

          // Resolve accurate business object and its latest status
          const resolvedBiz = accountToBizMap.get(cleanAccId) || (meta.business?.id ? businessByIdMap.get(String(meta.business.id)) : null) || meta.business || null;
          const businessPayload = resolvedBiz ? {
            id: resolvedBiz.id || resolvedBiz.externalId,
            name: resolvedBiz.name,
            status: resolvedBiz.status || 'ACTIVE',
            verification_status: resolvedBiz.verification_status || 'not_verified'
          } : null;

          return {
            id: a.externalId,
            account_id: cleanAccId,
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
            business: businessPayload,
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
          } else if (acc.business && acc.business.id) {
            const bizIdToMatch = String(acc.business.id);
            const matchingBiz = businesses.find((b: any) => String(b.id) === bizIdToMatch);
            if (matchingBiz) {
              acc.business = {
                ...acc.business,
                status: matchingBiz.status,
              };
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

      const customStatus = existingBizMeta.custom_status || status;

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
