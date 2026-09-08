import metaClient, { MetaGraphClient, PagePostRecord } from './meta';
import prisma from './db';
import vertexAI from './vertex';
import { inspectMetaToken } from './token-inspector';

export type CapabilityState =
  | 'supported'
  | 'requires_authorization'
  | 'requires_app_review'
  | 'requires_business_verification'
  | 'not_available_through_current_api'
  | 'partial'
  | 'failed';

export type PlatformType = 'facebook' | 'instagram';
export type SourceType =
  | 'authorized_page'
  | 'public_page_access'
  | 'public_ad_library'
  | 'public_hashtag_discovery'
  | 'manual_import';

export interface PageIdentityResolution {
  originalInput: string;
  normalizedUrl: string;
  extractedSlug: string;
  resolvedPageId: string | null;
  pageName: string | null;
  resolutionMethod: 'DIRECT_ID' | 'GRAPH_API_LOOKUP' | 'MANAGED_ASSET' | 'UNRESOLVED';
  isOwned: boolean;
  resolvedAt: string;
  accessToken?: string;
}

export interface StandardPageContentRecord {
  id: string;
  platform: PlatformType;
  sourceType: SourceType;
  pageIdOrAccountId: string;
  pageName?: string;
  originalUrl: string;
  sourceEndpoint: string;
  observedAt: string;
  publishedAt: string | null;
  text: string;
  mediaType: 'IMAGE' | 'VIDEO' | 'CAROUSEL' | 'TEXT' | 'UNKNOWN';
  mediaUrlOrStorageReference: string | null;
  thumbnailUrl: string | null;
  availableInteractionMetrics: {
    reactionsCount: number | null;
    commentsCount: number | null;
    sharesCount: number | null;
    viewsCount: number | null;
  };
  attachments?: any;
  analysis?: any;
  capabilityState: CapabilityState;
  limitationReason?: string | null;
}

export interface StandardApiResponse<T = any> {
  success: boolean;
  status: CapabilityState;
  platform: PlatformType;
  source: string;
  records: T[];
  partial: boolean;
  message: string;
  meta: {
    error_code: number | null;
    error_subcode: number | null;
    request_id: string | null;
    required_permission?: string | null;
  };
  limitations: string[];
  data?: any;
}

export interface IPageAnalysisProvider {
  resolveFacebookPageInput(input: string): Promise<PageIdentityResolution>;
  detectCapability(identity: PageIdentityResolution): Promise<{ state: CapabilityState; reason: string; limitations: string[] }>;
  getAuthorizedFacebookPageMetadata(pageId: string, pageToken?: string): Promise<any>;
  getAuthorizedFacebookPagePosts(pageId: string, pageToken?: string, options?: { forceRefresh?: boolean; limit?: number }): Promise<StandardApiResponse<StandardPageContentRecord>>;
  getPublicFacebookPageContent(pageId: string, options?: any): Promise<StandardApiResponse<StandardPageContentRecord>>;
  resolveInstagramProfessionalAccount(pageId: string): Promise<any>;
  getAuthorizedInstagramMedia(accountId: string, pageToken?: string, options?: any): Promise<StandardApiResponse<StandardPageContentRecord>>;
  getPublicInstagramDiscovery(options: { hashtag?: string; country?: string }): Promise<StandardApiResponse<StandardPageContentRecord>>;
  analyzeCollectedPageContent(records: StandardPageContentRecord[], options?: { pageName?: string }): Promise<any>;
}

export class MetaPageAnalysisProvider implements IPageAnalysisProvider {
  private client: MetaGraphClient;

  constructor() {
    this.client = metaClient;
  }

  /**
   * 1. Safe Page Identity Resolution (without guessing or brittle assumptions)
   */
  async resolveFacebookPageInput(input: string): Promise<PageIdentityResolution> {
    const originalInput = (input || '').trim();
    if (!originalInput) {
      return {
        originalInput,
        normalizedUrl: '',
        extractedSlug: '',
        resolvedPageId: null,
        pageName: null,
        resolutionMethod: 'UNRESOLVED',
        isOwned: false,
        resolvedAt: new Date().toISOString(),
      };
    }

    // Step A: Extract clean slug or ID
    let extractedSlug = originalInput;
    let normalizedUrl = originalInput;

    if (originalInput.includes('facebook.com') || originalInput.includes('fb.com') || originalInput.startsWith('http')) {
      try {
        const urlObj = new URL(originalInput.startsWith('http') ? originalInput : `https://${originalInput}`);
        const idParam = urlObj.searchParams.get('id');
        if (idParam && /^\d+$/.test(idParam)) {
          extractedSlug = idParam;
          normalizedUrl = `https://www.facebook.com/profile.php?id=${idParam}`;
        } else {
          const pathParts = urlObj.pathname.split('/').filter(Boolean);
          if (pathParts.length > 0) {
            extractedSlug = pathParts[pathParts.length - 1];
          }
          normalizedUrl = `https://www.facebook.com/${extractedSlug}`;
        }
      } catch (e) {
        // fallback
      }
    } else {
      normalizedUrl = `https://www.facebook.com/${originalInput}`;
    }

    extractedSlug = extractedSlug.replace(/[/\\?#&@=]/g, '').trim();

    // Step B: Check DB Managed Pages First (Zero-Latency)
    try {
      const dbMatch = await prisma.metaAsset.findFirst({
        where: {
          OR: [
            { externalId: extractedSlug },
            { name: extractedSlug },
          ],
        },
      });

      if (dbMatch) {
        return {
          originalInput,
          normalizedUrl: `https://www.facebook.com/${dbMatch.externalId}`,
          extractedSlug,
          resolvedPageId: dbMatch.externalId,
          pageName: dbMatch.name,
          resolutionMethod: 'MANAGED_ASSET',
          isOwned: true,
          accessToken: dbMatch.accessToken || undefined,
          resolvedAt: new Date().toISOString(),
        };
      }
    } catch (e) {}

    // Step C: Fallback to Graph API Managed Pages (Owned)
    try {
      const managed = await this.client.getManagedPages();
      const match = managed.find(
        (p) =>
          p.id === extractedSlug ||
          p.name.toLowerCase() === extractedSlug.toLowerCase() ||
          p.name.toLowerCase().includes(extractedSlug.toLowerCase()) ||
          extractedSlug.toLowerCase().includes(p.name.toLowerCase())
      );

      if (match) {
        return {
          originalInput,
          normalizedUrl: `https://www.facebook.com/${match.id}`,
          extractedSlug,
          resolvedPageId: match.id,
          pageName: match.name,
          resolutionMethod: 'MANAGED_ASSET',
          isOwned: true,
          resolvedAt: new Date().toISOString(),
          accessToken: match.access_token,
        };
      }
    } catch (err) {
      console.warn('[PageAnalysisProvider] Managed pages lookup failed:', err);
    }

    // Step C: Check if direct numeric ID
    const isNumeric = /^\d+$/.test(extractedSlug);
    if (isNumeric) {
      return {
        originalInput,
        normalizedUrl,
        extractedSlug,
        resolvedPageId: extractedSlug,
        pageName: null,
        resolutionMethod: 'DIRECT_ID',
        isOwned: false,
        resolvedAt: new Date().toISOString(),
      };
    }

    return {
      originalInput,
      normalizedUrl,
      extractedSlug,
      resolvedPageId: null,
      pageName: extractedSlug,
      resolutionMethod: 'UNRESOLVED',
      isOwned: false,
      resolvedAt: new Date().toISOString(),
    };
  }

  /**
   * 2. Capability Detection before making requests
   */
  async detectCapability(identity: PageIdentityResolution): Promise<{ state: CapabilityState; reason: string; limitations: string[] }> {
    if (identity.isOwned && identity.resolvedPageId) {
      return {
        state: 'supported',
        reason: 'صفحة مملوكة ومصرح بها - متاحة للقراءة الكاملة وتحليل التفاعل والمنشورات.',
        limitations: [],
      };
    }

    // Inspect user token scopes
    const tokenInfo = await inspectMetaToken();
    if (!tokenInfo.isValid) {
      return {
        state: 'requires_authorization',
        reason: 'توكن الوصول الخاص بـ Meta غير صالح أو منتهي الصلاحية.',
        limitations: ['يتطلب إعادة ربط الحساب وتجديد التوكن.'],
      };
    }

    // Competitor / Public page requires PPCA
    if (tokenInfo.domainBStatus.hasPagePublicContentAccess) {
      return {
        state: 'supported',
        reason: 'ميزة Page Public Content Access معتمدة من ميتا.',
        limitations: [],
      };
    }

    return {
      state: 'requires_app_review',
      reason: 'تحليل المنشورات العامة لصفحات المنافسين غير المملوكة يتطلب ميزة Page Public Content Access عبر مراجعة التطبيق App Review وتوثيق النشاط التجاري.',
      limitations: [
        'واجهة Meta Graph API تمنع استرجاع منشورات صفحات المنافسين دون موافقة App Review الرسمية (OAuthException Code 10).',
        'يمكنك استكشاف إعلانات المنافسين النشطة عبر قسم "مكتبة الإعلانات" أو استخدام "الماسح الذكي للإعلانات" برفع سكرين شوت الإعلان مباشرة.',
      ],
    };
  }

  /**
   * 3. Fetch Authorized Facebook Page Metadata
   */
  async getAuthorizedFacebookPageMetadata(pageId: string, pageToken?: string) {
    const activeToken = pageToken || process.env.META_USER_TOKEN;
    const url = `${process.env.META_GRAPH_BASE_URL || 'https://graph.facebook.com'}/${process.env.META_API_VERSION || 'v21.0'}/${pageId}?fields=id,name,category,fan_count,about,link,picture{url}&access_token=${activeToken}`;
    const res = await fetch(url);
    return await res.json();
  }

  /**
   * 4. Fetch Authorized Facebook Page Posts (Domain A)
   */
  async getAuthorizedFacebookPagePosts(
    pageId: string,
    pageToken?: string,
    options: { forceRefresh?: boolean; limit?: number } = {}
  ): Promise<StandardApiResponse<StandardPageContentRecord>> {
    const rawResult = await this.client.getPagePosts(pageId, pageToken);

    if (rawResult.error) {
      return {
        success: false,
        status: 'failed',
        platform: 'facebook',
        source: 'Graph API: published_posts',
        records: [],
        partial: false,
        message: rawResult.error,
        meta: {
          error_code: 10,
          error_subcode: null,
          request_id: null,
        },
        limitations: ['تعذر استرجاع منشورات الصفحة المصرح بها.'],
      };
    }

    const records: StandardPageContentRecord[] = rawResult.posts.map((p) => {
      let mediaType: StandardPageContentRecord['mediaType'] = 'TEXT';
      const att = p.attachments?.data?.[0];
      const url = p.permalink_url || '';

      if (url.includes('/reel/') || url.includes('/videos/') || att?.type === 'video_inline' || att?.media_type === 'video') {
        mediaType = 'VIDEO';
      } else if ((att?.subattachments?.data?.length || 0) > 1 || att?.type === 'album') {
        mediaType = 'CAROUSEL';
      } else if (att?.media_type === 'photo' || att?.type === 'photo' || att?.imageUrl) {
        mediaType = 'IMAGE';
      }

      return {
        id: p.id,
        platform: 'facebook',
        sourceType: 'authorized_page',
        pageIdOrAccountId: pageId,
        pageName: rawResult.name,
        originalUrl: p.permalink_url || `https://www.facebook.com/${p.id}`,
        sourceEndpoint: `/${pageId}/published_posts`,
        observedAt: new Date().toISOString(),
        publishedAt: p.created_time || null,
        text: p.message || '',
        mediaType,
        mediaUrlOrStorageReference: att?.imageUrl || att?.url || null,
        thumbnailUrl: att?.imageUrl || null,
        availableInteractionMetrics: {
          reactionsCount: p.reactions?.summary?.total_count !== undefined ? p.reactions.summary.total_count : null,
          commentsCount: p.comments?.summary?.total_count !== undefined ? p.comments.summary.total_count : null,
          sharesCount: p.shares?.count !== undefined ? p.shares.count : null,
          viewsCount: p.views !== undefined ? p.views : null,
        },
        attachments: p.attachments,
        analysis: (p as any).analysis,
        capabilityState: 'supported',
        limitationReason: null,
      };
    });

    return {
      success: true,
      status: 'supported',
      platform: 'facebook',
      source: 'Graph API: published_posts (Official Authorized)',
      records,
      partial: false,
      message: `تم جلب ${records.length} منشور بنجاح من الصفحة المصرح بها.`,
      meta: {
        error_code: null,
        error_subcode: null,
        request_id: null,
      },
      limitations: [],
      data: {
        pageId,
        name: rawResult.name,
        fanCount: rawResult.fanCount,
        posts: rawResult.posts,
      },
    };
  }

  /**
   * 5. Public Facebook Competitor Page Content (Domain B)
   */
  async getPublicFacebookPageContent(pageId: string, options?: any): Promise<StandardApiResponse<StandardPageContentRecord>> {
    const tokenInfo = await inspectMetaToken();

    // If PPCA is NOT approved, return clean enterprise structured response
    if (!tokenInfo.domainBStatus.hasPagePublicContentAccess) {
      return {
        success: false,
        status: 'requires_app_review',
        platform: 'facebook',
        source: 'Page Public Content Access',
        records: [],
        partial: true,
        message: 'تحليل محتوى صفحات المنافسين العامة غير متاح حالياً عبر مستوى صلاحيات Meta الحالي، ويتطلب موافقة ميزة Page Public Content Access في App Review.',
        meta: {
          error_code: 10,
          error_subcode: null,
          request_id: null,
          required_permission: 'Page Public Content Access',
        },
        limitations: [
          'يتطلب مراجعة التطبيق App Review وتوثيق النشاط التجاري Business Verification في Meta Developer Portal.',
          'استكشف إعلانات المنافس النشطة عبر أداة "مكتبة الإعلانات" أو استخدم "الماسح الذكي للإعلانات" لتحليل الإعلانات فورياً بواسطة الذكاء الاصطناعي.',
        ],
      };
    }

    // PPCA approved flow
    return {
      success: false,
      status: 'failed',
      platform: 'facebook',
      source: 'Page Public Content Access',
      records: [],
      partial: true,
      message: 'تعذر جلب محتوى الصفحة العامة.',
      meta: {
        error_code: null,
        error_subcode: null,
        request_id: null,
      },
      limitations: [],
    };
  }

  /**
   * 6. Resolve Instagram Professional Account
   */
  async resolveInstagramProfessionalAccount(pageId: string) {
    const userToken = process.env.META_USER_TOKEN;
    const url = `${process.env.META_GRAPH_BASE_URL || 'https://graph.facebook.com'}/${process.env.META_API_VERSION || 'v21.0'}/${pageId}?fields=instagram_business_account{id,username,name,profile_picture_url,followers_count}&access_token=${userToken}`;
    const res = await fetch(url);
    return await res.json();
  }

  /**
   * 7. Get Authorized Instagram Media
   */
  async getAuthorizedInstagramMedia(accountId: string, pageToken?: string, options?: any): Promise<StandardApiResponse<StandardPageContentRecord>> {
    const token = pageToken || process.env.META_USER_TOKEN;
    const url = `${process.env.META_GRAPH_BASE_URL || 'https://graph.facebook.com'}/${process.env.META_API_VERSION || 'v21.0'}/${accountId}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count&limit=25&access_token=${token}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.error) {
      return {
        success: false,
        status: 'failed',
        platform: 'instagram',
        source: 'Instagram Graph API: /media',
        records: [],
        partial: false,
        message: data.error.message,
        meta: {
          error_code: data.error.code || null,
          error_subcode: data.error.error_subcode || null,
          request_id: null,
        },
        limitations: ['تعذر جلب منشورات حساب انستجرام المصرح به.'],
      };
    }

    const records: StandardPageContentRecord[] = (data.data || []).map((m: any) => ({
      id: m.id,
      platform: 'instagram',
      sourceType: 'authorized_page',
      pageIdOrAccountId: accountId,
      originalUrl: m.permalink,
      sourceEndpoint: `/${accountId}/media`,
      observedAt: new Date().toISOString(),
      publishedAt: m.timestamp || null,
      text: m.caption || '',
      mediaType: m.media_type === 'VIDEO' ? 'VIDEO' : m.media_type === 'CAROUSEL_ALBUM' ? 'CAROUSEL' : 'IMAGE',
      mediaUrlOrStorageReference: m.media_url || null,
      thumbnailUrl: m.thumbnail_url || m.media_url || null,
      availableInteractionMetrics: {
        reactionsCount: m.like_count !== undefined ? m.like_count : null,
        commentsCount: m.comments_count !== undefined ? m.comments_count : null,
        sharesCount: null,
        viewsCount: null,
      },
      capabilityState: 'supported',
      limitationReason: null,
    }));

    return {
      success: true,
      status: 'supported',
      platform: 'instagram',
      source: 'Instagram Graph API (Official Authorized)',
      records,
      partial: false,
      message: `تم جلب ${records.length} منشور انستجرام بنجاح.`,
      meta: {
        error_code: null,
        error_subcode: null,
        request_id: null,
      },
      limitations: [],
    };
  }

  /**
   * 8. Public Instagram Discovery (Hashtag-based official discovery)
   */
  async getPublicInstagramDiscovery(options: { hashtag?: string; country?: string }): Promise<StandardApiResponse<StandardPageContentRecord>> {
    return {
      success: true,
      status: 'partial',
      platform: 'instagram',
      source: 'Instagram Public Hashtag Discovery',
      records: [],
      partial: true,
      message: 'الاستكشاف العام لانستجرام متاح عبر الهاشتاج فقط وليس الملفات الشخصية المجهولة بدون تصريح.',
      meta: {
        error_code: null,
        error_subcode: null,
        request_id: null,
      },
      limitations: [
        'واجهة Instagram Graph API لا تسمح بسحب منشورات حسابات المنافسين دون ربط مباشر.',
        'الاستكشاف متاح فقط عبر البحث في الهاشتاجات العامة المصرح بها (Hashtag Search API).',
      ],
    };
  }

  /**
   * 9. Evidence-Based Page Analysis via Vertex AI Gemini 2.5 Pro
   */
  async analyzeCollectedPageContent(records: StandardPageContentRecord[], options: { pageName?: string } = {}) {
    return await vertexAI.generateCompetitorReport(
      options.pageName || 'الصفحة المستهدفة',
      records.map((r) => ({
        text: r.text,
        date: r.publishedAt || undefined,
        format: r.mediaType,
      }))
    );
  }
}

export const pageAnalysisProvider = new MetaPageAnalysisProvider();
