import dotenv from 'dotenv';
dotenv.config();

/**
 * Meta Token & Capability Inspector
 * Inspects access tokens, expiration, permissions, and app status safely without exposing secrets.
 */

export interface TokenInspectionResult {
  isValid: boolean;
  appId: string;
  application: string;
  userId: string;
  type: string;
  issuedAt: string | null;
  expiresAt: string | null;
  isLongLived: boolean;
  dataAccessExpiresAt: string | null;
  grantedScopes: string[];
  missingScopesForPublicPages: string[];
  appMode: 'DEVELOPMENT' | 'LIVE' | 'UNKNOWN';
  apiVersion: string;
  managedPagesCount: number;
  domainAStatus: {
    status: 'READY' | 'DEGRADED' | 'UNAVAILABLE';
    description: string;
    hasPagesReadEngagement: boolean;
    hasPagesReadUserContent: boolean;
    hasInstagramBasic: boolean;
  };
  domainBStatus: {
    status: 'REQUIRES_APP_REVIEW' | 'ACTIVE' | 'NOT_AVAILABLE';
    description: string;
    hasPagePublicContentAccess: boolean;
    hasInstagramPublicContentAccess: boolean;
  };
}

export async function inspectMetaToken(tokenOverride?: string): Promise<TokenInspectionResult> {
  const appId = process.env.META_APP_ID || '';
  const appSecret = process.env.META_APP_SECRET || '';
  const userToken = tokenOverride || process.env.META_USER_TOKEN || '';
  const apiVersion = process.env.META_API_VERSION || 'v21.0';
  const baseUrl = process.env.META_GRAPH_BASE_URL || 'https://graph.facebook.com';

  if (!userToken) {
    return {
      isValid: false,
      appId: appId || 'NOT_CONFIGURED',
      application: 'Unknown',
      userId: '',
      type: 'NONE',
      issuedAt: null,
      expiresAt: null,
      isLongLived: false,
      dataAccessExpiresAt: null,
      grantedScopes: [],
      missingScopesForPublicPages: ['Page Public Content Access', 'pages_read_engagement'],
      appMode: 'UNKNOWN',
      apiVersion,
      managedPagesCount: 0,
      domainAStatus: {
        status: 'UNAVAILABLE',
        description: 'لا يوجد توكن وصول في بيئة العمل (.env)',
        hasPagesReadEngagement: false,
        hasPagesReadUserContent: false,
        hasInstagramBasic: false,
      },
      domainBStatus: {
        status: 'NOT_AVAILABLE',
        description: 'يتطلب توكن معتمد وموافقة App Review',
        hasPagePublicContentAccess: false,
        hasInstagramPublicContentAccess: false,
      },
    };
  }

  try {
    const debugUrl = `${baseUrl}/debug_token?input_token=${encodeURIComponent(userToken)}&access_token=${encodeURIComponent(appId)}|${encodeURIComponent(appSecret)}`;
    const res = await fetch(debugUrl);
    const data = await res.json();

    if (data.error || !data.data) {
      return {
        isValid: false,
        appId,
        application: 'Invalid Token',
        userId: '',
        type: 'ERROR',
        issuedAt: null,
        expiresAt: null,
        isLongLived: false,
        dataAccessExpiresAt: null,
        grantedScopes: [],
        missingScopesForPublicPages: ['Page Public Content Access'],
        appMode: 'UNKNOWN',
        apiVersion,
        managedPagesCount: 0,
        domainAStatus: {
          status: 'UNAVAILABLE',
          description: data.error?.message || 'فشل التحقق من التوكن',
          hasPagesReadEngagement: false,
          hasPagesReadUserContent: false,
          hasInstagramBasic: false,
        },
        domainBStatus: {
          status: 'NOT_AVAILABLE',
          description: 'التوكن غير صالح',
          hasPagePublicContentAccess: false,
          hasInstagramPublicContentAccess: false,
        },
      };
    }

    const tokenInfo = data.data;
    const scopes: string[] = tokenInfo.scopes || [];
    const hasPPCA = scopes.includes('page_public_content_access') || scopes.includes('Page Public Content Access');
    const hasIPCA = scopes.includes('instagram_public_content_access');
    const hasPRE = scopes.includes('pages_read_engagement');
    const hasPRUC = scopes.includes('pages_read_user_content');
    const hasIB = scopes.includes('instagram_basic');

    // Check managed pages count
    let managedCount = 0;
    try {
      const accountsRes = await fetch(`${baseUrl}/${apiVersion}/me/accounts?fields=id&limit=100&access_token=${encodeURIComponent(userToken)}`);
      const accountsData = await accountsRes.json();
      if (accountsData.data && Array.isArray(accountsData.data)) {
        managedCount = accountsData.data.length;
      }
    } catch (e) {}

    const expiresAt = tokenInfo.expires_at === 0 ? 'صلاحية ممتدة (Long-Lived 60+ Days / Permanent Page Token)' : tokenInfo.expires_at ? new Date(tokenInfo.expires_at * 1000).toISOString() : 'غير محدد';
    const issuedAt = tokenInfo.issued_at ? new Date(tokenInfo.issued_at * 1000).toISOString() : null;
    const dataAccessExpiresAt = tokenInfo.data_access_expires_at ? new Date(tokenInfo.data_access_expires_at * 1000).toISOString() : null;

    return {
      isValid: tokenInfo.is_valid === true,
      appId: tokenInfo.app_id || appId,
      application: tokenInfo.application || 'AdScope App',
      userId: tokenInfo.user_id ? `${tokenInfo.user_id.slice(0, 4)}...${tokenInfo.user_id.slice(-4)}` : '',
      type: tokenInfo.type || 'USER',
      issuedAt,
      expiresAt,
      isLongLived: tokenInfo.expires_at === 0 || (tokenInfo.expires_at - (tokenInfo.issued_at || 0) > 86400 * 30),
      dataAccessExpiresAt,
      grantedScopes: scopes,
      missingScopesForPublicPages: hasPPCA ? [] : ['Page Public Content Access (يتطلب مراجعة التطبيق App Review)'],
      appMode: tokenInfo.is_valid ? 'LIVE' : 'DEVELOPMENT',
      apiVersion,
      managedPagesCount: managedCount,
      domainAStatus: {
        status: hasPRE && hasPRUC ? 'READY' : 'DEGRADED',
        description: `جاهز للعمل بالكامل (${managedCount} صفحة مُدارة مربوطة)`,
        hasPagesReadEngagement: hasPRE,
        hasPagesReadUserContent: hasPRUC,
        hasInstagramBasic: hasIB,
      },
      domainBStatus: {
        status: hasPPCA ? 'ACTIVE' : 'REQUIRES_APP_REVIEW',
        description: hasPPCA ? 'ميزة تحليل المنافسين العامة نشطة' : 'يتطلب موافقة ميزة Page Public Content Access في App Review',
        hasPagePublicContentAccess: hasPPCA,
        hasInstagramPublicContentAccess: hasIPCA,
      },
    };
  } catch (err: any) {
    return {
      isValid: false,
      appId,
      application: 'Network Error',
      userId: '',
      type: 'ERROR',
      issuedAt: null,
      expiresAt: null,
      isLongLived: false,
      dataAccessExpiresAt: null,
      grantedScopes: [],
      missingScopesForPublicPages: ['Page Public Content Access'],
      appMode: 'UNKNOWN',
      apiVersion,
      managedPagesCount: 0,
      domainAStatus: {
        status: 'UNAVAILABLE',
        description: err.message,
        hasPagesReadEngagement: false,
        hasPagesReadUserContent: false,
        hasInstagramBasic: false,
      },
      domainBStatus: {
        status: 'NOT_AVAILABLE',
        description: 'خطأ في الاتصال بخوادم ميتا',
        hasPagePublicContentAccess: false,
        hasInstagramPublicContentAccess: false,
      },
    };
  }
}
