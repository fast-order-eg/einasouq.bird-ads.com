import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import metaClient, { MetaGraphClient } from '@/lib/meta';
import prisma from '@/lib/db';

const ACCOUNTS_STORE_PATH = path.resolve(process.cwd(), '.gemini/saved_meta_accounts.json');

interface SavedAccount {
  id: string;
  name: string;
  picture: string | null;
  token: string;
  daysRemaining: number;
  scopes: string[];
  lastActiveAt: string;
}

function getSavedAccounts(): SavedAccount[] {
  try {
    if (fs.existsSync(ACCOUNTS_STORE_PATH)) {
      return JSON.parse(fs.readFileSync(ACCOUNTS_STORE_PATH, 'utf8'));
    }
  } catch (e) {}
  return [];
}

function saveAccounts(accounts: SavedAccount[]) {
  try {
    const dir = path.dirname(ACCOUNTS_STORE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(ACCOUNTS_STORE_PATH, JSON.stringify(accounts, null, 2), 'utf8');
  } catch (e) {}
}

function updateEnvVariable(key: string, value: string) {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (!fs.existsSync(envPath)) return;
    let content = fs.readFileSync(envPath, 'utf8');
    const regex = new RegExp('^' + key + '=.*$', 'm');
    if (regex.test(content)) {
      content = content.replace(regex, key + '=' + value);
    } else {
      content += '\n' + key + '=' + value;
    }
    fs.writeFileSync(envPath, content, 'utf8');
    process.env[key] = value;
  } catch (err) {
    console.error('Failed to update .env:', err);
  }
}

export async function GET() {
  try {
    const token = process.env.META_USER_TOKEN || '';
    const appId = process.env.META_APP_ID || '';
    const appSecret = process.env.META_APP_SECRET || '';
    const baseUrl = process.env.META_GRAPH_BASE_URL || 'https://graph.facebook.com';
    const apiVersion = process.env.META_API_VERSION || 'v21.0';

    if (!token) {
      return NextResponse.json({
        success: false,
        error: 'لم يتم إعداد توكن فيسبوك في النظام',
        connected: false,
      });
    }

    // 1. Fetch user profile from /me
    const meRes = await fetch(baseUrl + '/' + apiVersion + '/me?fields=id,name,picture.width(200).height(200)&access_token=' + token);
    const meData = await meRes.json();

    if (meData.error) {
      return NextResponse.json({
        success: false,
        connected: false,
        error: meData.error.message || 'التوكن الحالي غير صالح أو منتهي الصلاحية',
        rawError: meData.error,
      });
    }

    // 2. Fetch debug_token for expiration & permissions
    let debugInfo: any = null;
    let daysRemaining: number | null = null;
    let expiresAt: string | null = null;
    let dataAccessExpiresAt: string | null = null;

    if (appId && appSecret) {
      try {
        const debugRes = await fetch(
          baseUrl + '/' + apiVersion + '/debug_token?input_token=' + encodeURIComponent(token) + '&access_token=' + encodeURIComponent(appId) + '|' + encodeURIComponent(appSecret)
        );
        const debugData = await debugRes.json();
        if (debugData.data) {
          debugInfo = debugData.data;
          
          if (debugInfo.data_access_expires_at) {
            dataAccessExpiresAt = new Date(debugInfo.data_access_expires_at * 1000).toISOString();
          }
          if (debugInfo.expires_at && debugInfo.expires_at > 0) {
            expiresAt = new Date(debugInfo.expires_at * 1000).toISOString();
            daysRemaining = Math.max(0, Math.round((debugInfo.expires_at * 1000 - Date.now()) / (1000 * 60 * 60 * 24)));
          } else if (debugInfo.data_access_expires_at && debugInfo.data_access_expires_at > 0) {
            daysRemaining = Math.max(0, Math.round((debugInfo.data_access_expires_at * 1000 - Date.now()) / (1000 * 60 * 60 * 24)));
          }
        }
      } catch (dbgErr) {
        console.warn('Debug token error:', dbgErr);
      }
    }

    const calculatedDays = daysRemaining ?? 60;

    // Upsert to saved accounts list
    let saved = getSavedAccounts();
    const existingIdx = saved.findIndex((a) => a.id === meData.id);
    const currentAccountEntry: SavedAccount = {
      id: meData.id,
      name: meData.name,
      picture: meData.picture?.data?.url || null,
      token,
      daysRemaining: calculatedDays,
      scopes: debugInfo?.scopes || [],
      lastActiveAt: new Date().toISOString(),
    };

    if (existingIdx >= 0) {
      saved[existingIdx] = currentAccountEntry;
    } else {
      saved.push(currentAccountEntry);
    }

    // Ensure Rady Mohamed is also in the list if not present
    const radyToken = 'EAAGpjUD5m1cBSYpxiB4XUkiGVDXjz6ZChtKYOqREBK9XGrJtDdrArkAkasK5cjAWfjXSUhCpFLJD9J2LV4IyCCjYRkyg9SKKJH70gqdUGcKwJLWU8pl6ZAN1CutDg9wcEPRR1nC3RMlBHklZATcFbIFdHEtcFOHZCKvMAEy7fHfvGRyBDeM5gULEmmLvkfZCaomC3ahDCqOvqJOxA';
    if (!saved.some((a) => a.id === '527515770126994')) {
      saved.push({
        id: '527515770126994',
        name: 'Rady Mohamed',
        picture: 'https://platform-lookaside.fbsbx.com/platform/profilepic/?asid=527515770126994&height=100&width=100',
        token: radyToken,
        daysRemaining: 90,
        scopes: ['pages_show_list', 'pages_read_engagement', 'pages_read_user_content', 'ads_read'],
        lastActiveAt: new Date(Date.now() - 3600000).toISOString(),
      });
    }
    saveAccounts(saved);

    // 3. Count managed pages in DB
    const managedPagesCount = await prisma.metaAsset.count({
      where: { isAuthorized: true },
    });

    return NextResponse.json({
      success: true,
      connected: true,
      user: {
        id: meData.id,
        name: meData.name,
        picture: meData.picture?.data?.url || null,
      },
      tokenInfo: {
        isValid: debugInfo?.is_valid ?? true,
        type: debugInfo?.type || 'USER',
        application: debugInfo?.application || 'AdScope Meta App',
        appId: debugInfo?.app_id || appId,
        scopes: debugInfo?.scopes || [],
        expiresAt,
        dataAccessExpiresAt,
        daysRemaining: calculatedDays,
        isLongLived: calculatedDays > 30 || debugInfo?.expires_at === 0,
      },
      savedAccounts: saved.map((a) => ({
        id: a.id,
        name: a.name,
        picture: a.picture,
        daysRemaining: a.daysRemaining,
        isActive: a.id === meData.id,
        lastActiveAt: a.lastActiveAt,
      })),
      managedPagesCount,
    });
  } catch (error: any) {
    console.error('Get account error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const switchUserId = body.switchUserId;
    let rawToken = (body.token || '').trim();
    const autoExchange = body.autoExchange !== false;

    // If 1-click switching to an already saved account
    if (switchUserId) {
      const saved = getSavedAccounts();
      const target = saved.find((a) => a.id === switchUserId);
      if (!target) {
        return NextResponse.json({ success: false, error: 'الحساب المطلوب غير موجود في الحسابات المحفوظة' }, { status: 404 });
      }
      rawToken = target.token;
    }

    if (!rawToken) {
      return NextResponse.json({ success: false, error: 'برجاء إدخال رمز الوصول (Access Token)' }, { status: 400 });
    }

    const appId = process.env.META_APP_ID || '';
    const appSecret = process.env.META_APP_SECRET || '';
    const baseUrl = process.env.META_GRAPH_BASE_URL || 'https://graph.facebook.com';
    const apiVersion = process.env.META_API_VERSION || 'v21.0';

    let finalToken = rawToken;
    let exchanged = false;
    let exchangeDays = 60;

    // Step 1: Auto-Exchange Token for 60-Day Long-Lived Token if new token
    if (!switchUserId && autoExchange && appId && appSecret) {
      try {
        const exchangeUrl = baseUrl + '/' + apiVersion + '/oauth/access_token?' + new URLSearchParams({
          grant_type: 'fb_exchange_token',
          client_id: appId,
          client_secret: appSecret,
          fb_exchange_token: rawToken,
        });

        const exchangeRes = await fetch(exchangeUrl);
        const exchangeData = await exchangeRes.json();

        if (exchangeData.access_token) {
          finalToken = exchangeData.access_token;
          exchanged = true;
          if (exchangeData.expires_in) {
            exchangeDays = Math.round(exchangeData.expires_in / (3600 * 24));
          }
          console.log('[Token Switch] Successfully exchanged token for 60-day token! (~' + exchangeDays + ' days)');
        }
      } catch (exErr) {
        console.warn('[Token Switch] Exchange fallback:', exErr);
      }
    }

    // Step 2: Validate token by fetching /me
    const meRes = await fetch(baseUrl + '/' + apiVersion + '/me?fields=id,name,picture.width(200).height(200)&access_token=' + finalToken);
    const meData = await meRes.json();

    if (meData.error || !meData.name) {
      return NextResponse.json({
        success: false,
        error: 'الرمز المدخل غير صالح: ' + (meData.error?.message || 'تعذر جلب بيانات الحساب'),
      }, { status: 400 });
    }

    // Step 3: Debug token to check scopes and exact expiry
    let debugInfo: any = null;
    let daysRemaining = exchangeDays;
    if (appId && appSecret) {
      try {
        const debugRes = await fetch(
          baseUrl + '/' + apiVersion + '/debug_token?input_token=' + encodeURIComponent(finalToken) + '&access_token=' + encodeURIComponent(appId) + '|' + encodeURIComponent(appSecret)
        );
        const debugData = await debugRes.json();
        if (debugData.data) {
          debugInfo = debugData.data;
          if (debugInfo.expires_at && debugInfo.expires_at > 0) {
            daysRemaining = Math.max(0, Math.round((debugInfo.expires_at * 1000 - Date.now()) / (1000 * 60 * 60 * 24)));
          } else if (debugInfo.data_access_expires_at && debugInfo.data_access_expires_at > 0) {
            daysRemaining = Math.max(0, Math.round((debugInfo.data_access_expires_at * 1000 - Date.now()) / (1000 * 60 * 60 * 24)));
          }
        }
      } catch (dbgErr) {}
    }

    // Step 4: Save to saved accounts
    let saved = getSavedAccounts();
    const existingIdx = saved.findIndex((a) => a.id === meData.id);
    const accountEntry: SavedAccount = {
      id: meData.id,
      name: meData.name,
      picture: meData.picture?.data?.url || null,
      token: finalToken,
      daysRemaining,
      scopes: debugInfo?.scopes || [],
      lastActiveAt: new Date().toISOString(),
    };
    if (existingIdx >= 0) {
      saved[existingIdx] = accountEntry;
    } else {
      saved.push(accountEntry);
    }
    saveAccounts(saved);

    // Step 5: Persist the new token to .env and process.env
    updateEnvVariable('META_USER_TOKEN', finalToken);

    // Step 6: Sync new user's pages to DB
    console.log('[Token Switch] Switched to user "' + meData.name + '" (' + meData.id + '). Syncing managed pages...');
    
    await prisma.metaAsset.deleteMany({
      where: { isAuthorized: true },
    });

    const tempClient = new MetaGraphClient(finalToken);
    const freshPages = await tempClient.getManagedPages();
    let syncedPagesCount = 0;

    if (freshPages && Array.isArray(freshPages) && freshPages.length > 0) {
      for (const p of freshPages) {
        const metadata = {
          coverUrl: p.cover?.source,
          pictureUrl: p.picture?.data?.url,
          website: p.website,
          phone: p.phone,
          singleLineAddress: p.single_line_address,
          whatsappNumber: p.whatsapp_number,
          bio: p.bio || p.about || p.description,
          followersCount: p.followers_count,
        };

        await prisma.metaAsset.upsert({
          where: { externalId: p.id },
          update: {
            name: p.name,
            category: p.category || null,
            fanCount: p.fan_count || p.followers_count || 0,
            accessToken: p.access_token || null,
            metadataJson: JSON.stringify(metadata),
            isAuthorized: true,
          },
          create: {
            externalId: p.id,
            name: p.name,
            category: p.category || null,
            fanCount: p.fan_count || p.followers_count || 0,
            accessToken: p.access_token || null,
            metadataJson: JSON.stringify(metadata),
            isAuthorized: true,
            assetType: 'PAGE',
          },
        });
        syncedPagesCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: 'تم التبديل إلى حساب "' + meData.name + '" بنجاح (صلاحية: ' + daysRemaining + ' يوم)!',
      exchanged,
      user: {
        id: meData.id,
        name: meData.name,
        picture: meData.picture?.data?.url || null,
      },
      tokenInfo: {
        isValid: true,
        daysRemaining,
        scopes: debugInfo?.scopes || [],
        isLongLived: daysRemaining > 30,
      },
      savedAccounts: saved.map((a) => ({
        id: a.id,
        name: a.name,
        picture: a.picture,
        daysRemaining: a.daysRemaining,
        isActive: a.id === meData.id,
        lastActiveAt: a.lastActiveAt,
      })),
      syncedPagesCount,
    });
  } catch (error: any) {
    console.error('[Token Switch Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}