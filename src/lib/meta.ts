import dotenv from 'dotenv';
dotenv.config();

export interface MetaAdRecord {
  id: string;
  ad_creation_time?: string;
  ad_delivery_start_time?: string;
  ad_delivery_stop_time?: string;
  ad_creative_bodies?: string[];
  ad_creative_link_captions?: string[];
  ad_creative_link_descriptions?: string[];
  ad_creative_link_titles?: string[];
  page_id?: string;
  page_name?: string;
  snapshot_url?: string;
  publisher_platforms?: string[];
  languages?: string[];
  impressions?: {
    lower_bound?: string;
    upper_bound?: string;
  };
  spend?: {
    lower_bound?: string;
    upper_bound?: string;
  };
}

export interface ManagedPageRecord {
  id: string;
  name: string;
  category?: string;
  access_token: string;
  fan_count?: number;
  followers_count?: number;
  cover?: { source?: string; id?: string };
  picture?: { data?: { url?: string } };
  website?: string;
  phone?: string;
  single_line_address?: string;
  whatsapp_number?: string;
  about?: string;
  bio?: string;
  description?: string;
  instagram_business_account?: any;
  rating_count?: number;
  overall_star_rating?: number;
  metadataJson?: any;
}

export interface PagePostRecord {
  id: string;
  message?: string;
  created_time: string;
  permalink_url?: string;
  views?: number;
  shares?: {
    count: number;
  };
  comments?: {
    summary?: {
      total_count: number;
    };
  };
  reactions?: {
    summary?: {
      total_count: number;
    };
  };
  attachments?: any;
}

export class MetaGraphClient {
  private userToken: string;
  private apiVersion: string = 'v21.0';
  private baseUrl: string = 'https://graph.facebook.com';

  constructor(userToken?: string) {
    this.userToken = userToken || process.env.META_USER_TOKEN || '';
  }

  cleanPageInput(input: string): string {
    if (!input) return '';
    let cleaned = input.trim();
    if (cleaned.includes('facebook.com') || cleaned.includes('fb.com') || cleaned.startsWith('http')) {
      try {
        const parsed = new URL(cleaned.startsWith('http') ? cleaned : `https://${cleaned}`);
        const parts = parsed.pathname.split('/').filter(Boolean);
        if (parts.length > 0) {
          cleaned = parts[parts.length - 1];
        }
      } catch (e) {
        // fallback
      }
    }
    return cleaned.replace(/[/?#].*$/, '');
  }

  async searchAdLibrary(params: {
    searchTerms?: string;
    pageIds?: string[];
    country?: string;
    limit?: number;
    adActiveStatus?: 'ACTIVE' | 'INACTIVE' | 'ALL';
    mediaType?: 'IMAGE' | 'VIDEO' | 'MEME' | 'ALL';
    after?: string;
  }): Promise<{ data: MetaAdRecord[]; paging?: any; isFallback?: boolean; error?: string }> {
    const country = params.country || 'EG';
    const fields = [
      'id',
      'ad_creation_time',
      'ad_delivery_start_time',
      'ad_delivery_stop_time',
      'ad_creative_bodies',
      'ad_creative_link_captions',
      'ad_creative_link_descriptions',
      'ad_creative_link_titles',
      'page_id',
      'page_name',
      'snapshot_url',
      'publisher_platforms',
      'languages',
      'impressions',
      'spend',
    ].join(',');

    const query = new URLSearchParams();
    query.set('ad_reached_countries', JSON.stringify([country]));
    query.set('fields', fields);
    query.set('limit', String(params.limit || 20));
    query.set('access_token', this.userToken);

    if (params.searchTerms) query.set('search_terms', params.searchTerms);
    if (params.pageIds && params.pageIds.length > 0) {
      query.set('search_page_ids', JSON.stringify(params.pageIds.slice(0, 10)));
    }
    if (params.adActiveStatus && params.adActiveStatus !== 'ALL') {
      query.set('ad_active_status', params.adActiveStatus);
    }
    if (params.mediaType && params.mediaType !== 'ALL') {
      query.set('media_type', params.mediaType);
    }
    if (params.after) query.set('after', params.after);

    const url = `${this.baseUrl}/${this.apiVersion}/ads_archive?${query.toString()}`;

    try {
      const res = await fetch(url);
      const data = await res.json();

      if (data.error) {
        return {
          data: [],
          error: data.error.message || 'Meta Ad Library API permission required',
        };
      }

      return {
        data: data.data || [],
        paging: data.paging,
      };
    } catch (err: any) {
      return {
        data: [],
        error: err.message || 'Network connection failed',
      };
    }
  }

  async getManagedPages(): Promise<ManagedPageRecord[]> {
    if (!this.userToken) return [];
    const fields = 'id,name,category,access_token,fan_count,followers_count,cover,picture.width(500),website,phone,single_line_address,whatsapp_number,about,bio,description,instagram_business_account';
    let url: string | null = `${this.baseUrl}/${this.apiVersion}/me/accounts?fields=${fields}&limit=100&access_token=${this.userToken}`;
    const allPages: ManagedPageRecord[] = [];
    const seenIds = new Set<string>();

    try {
      let pageCount = 0;
      while (url && pageCount < 20) {
        pageCount++;
        const targetUrl: string = url;
        const res: any = await fetch(targetUrl);
        const data: any = await res.json();
        if (data.error) {
          console.error('[MetaGraphClient] Failed to fetch accounts chunk:', data.error);
          break;
        }
        if (Array.isArray(data.data)) {
          for (const page of data.data) {
            if (!seenIds.has(page.id)) {
              seenIds.add(page.id);
              allPages.push(page);
            }
          }
        }
        url = data.paging?.next || null;
      }
      console.log(`[MetaGraphClient] Successfully fetched ${allPages.length} total managed pages across ${pageCount} cursor pages`);
      return allPages;
    } catch (err) {
      console.error('[MetaGraphClient] Error in getManagedPages:', err);
      return allPages;
    }
  }

  /**
   * Fetch customer ratings and reviews from Graph API
   */
  async getPageRatingsAndReviews(pageId: string, pageToken?: string): Promise<{
    ratingCount: number;
    overallStarRating: number;
    recommendationPercent: number;
    reviews: Array<{ reviewerName?: string; rating?: number; text: string; recommendationType?: string; createdTime: string }>;
  }> {
    let token = pageToken;
    if (!token) {
      const managed = await this.getManagedPages();
      const match = managed.find((p) => p.id === pageId);
      token = match?.access_token || this.userToken;
    }
    if (!token) return { ratingCount: 0, overallStarRating: 0, recommendationPercent: 0, reviews: [] };

    try {
      const res = await fetch(
        `${this.baseUrl}/${this.apiVersion}/${pageId}/ratings?fields=reviewer,rating,review_text,recommendation_type,created_time&limit=50&access_token=${token}`
      );
      const data = await res.json();
      if (data.data && Array.isArray(data.data)) {
        const total = data.data.length;
        const positiveCount = data.data.filter((r: any) => r.recommendation_type === 'positive' || (r.rating && r.rating >= 4)).length;
        const percent = total > 0 ? Math.round((positiveCount / total) * 100) : 100;
        return {
          ratingCount: total,
          overallStarRating: 5.0,
          recommendationPercent: percent,
          reviews: data.data.map((r: any) => ({
            reviewerName: r.reviewer?.name,
            rating: r.rating,
            text: r.review_text || '',
            recommendationType: r.recommendation_type,
            createdTime: r.created_time,
          })),
        };
      }
    } catch (e) {
      console.warn('[MetaClient] Failed to fetch ratings:', e);
    }
    return { ratingCount: 0, overallStarRating: 0, recommendationPercent: 0, reviews: [] };
  }

  /**
   * Get full audit snapshot with Cover, Logo, Contact info, Website, and Customer Reviews
   */
  async getPageFullAuditSnapshot(pageId: string, pageToken?: string) {
    let token = pageToken;
    if (!token) {
      const managed = await this.getManagedPages();
      const match = managed.find((p) => p.id === pageId);
      token = match?.access_token || this.userToken;
    }

    const fields = 'id,name,about,bio,description,category,fan_count,followers_count,cover,picture.width(500),website,phone,single_line_address,whatsapp_number,instagram_business_account';
    let details: any = {};
    try {
      const res = await fetch(`${this.baseUrl}/${this.apiVersion}/${pageId}?fields=${fields}&access_token=${token}`);
      details = await res.json();
      if (details.error && this.userToken && token !== this.userToken) {
        const res2 = await fetch(`${this.baseUrl}/${this.apiVersion}/${pageId}?fields=${fields}&access_token=${this.userToken}`);
        details = await res2.json();
      }
    } catch (e) {}

    const ratingsData = await this.getPageRatingsAndReviews(pageId, token);

    return {
      id: details.id || pageId,
      name: details.name,
      category: details.category,
      fanCount: details.fan_count || details.followers_count || 0,
      followersCount: details.followers_count || details.fan_count || 0,
      coverUrl: details.cover?.source,
      pictureUrl: details.picture?.data?.url,
      hasLogo: Boolean(details.picture?.data?.url),
      hasCover: Boolean(details.cover?.source),
      website: details.website,
      phone: details.phone,
      whatsappNumber: details.whatsapp_number || details.phone,
      address: details.single_line_address,
      bio: details.bio || details.about || details.description,
      instagramConnected: details.instagram_business_account?.id ? 'مربوط' : undefined,
      ratings: ratingsData,
    };
  }

  /**
   * Helper to enrich single post or reel or photo with live engagement and high-res image
   */
  async enrichPostEngagement(post: PagePostRecord, pageToken?: string): Promise<PagePostRecord> {
    const permalink = post.permalink_url || '';
    const att = post.attachments?.data?.[0];
    const attUrl = att?.url || '';
    const targetId = att?.target?.id;
    const combinedUrl = `${permalink} ${attUrl}`;

    // 1. Check Reel or Video
    const reelMatch = combinedUrl.match(/\/reel\/(\d+)/) || combinedUrl.match(/\/videos\/(\d+)/);
    const videoId = reelMatch ? reelMatch[1] : (att?.media_type === 'video' ? targetId : null);

    if (videoId && this.userToken) {
      try {
        const videoRes = await fetch(
          `${this.baseUrl}/${this.apiVersion}/${videoId}?fields=id,views,likes.summary(true),comments.summary(true).filter(stream),picture,thumbnails{uri}&access_token=${this.userToken}`
        );
        const videoData = await videoRes.json();
        if (!videoData.error) {
          const likesCount = videoData.likes?.summary?.total_count || 0;
          const commentsCount = videoData.comments?.summary?.total_count || 0;
          const viewsCount = videoData.views || 0;
          const videoThumb = videoData.thumbnails?.data?.[0]?.uri || videoData.picture;

          const updatedAttachments = post.attachments ? { ...post.attachments } : { data: [{}] };
          if (videoThumb) {
            if (!updatedAttachments.data) updatedAttachments.data = [{}];
            updatedAttachments.data[0].imageUrl = videoThumb;
          }

          return {
            ...post,
            attachments: updatedAttachments,
            views: viewsCount,
            reactions: { summary: { total_count: Math.max(likesCount, post.reactions?.summary?.total_count || 0) } },
            comments: { summary: { total_count: Math.max(commentsCount, post.comments?.summary?.total_count || 0) } },
          };
        }
      } catch (e) {}
    }

    // 2. Check Photo Post
    const photoMatch = combinedUrl.match(/fbid=(\d+)/);
    const photoId = photoMatch ? photoMatch[1] : (att?.media_type === 'photo' ? targetId : null);
    const photoToken = pageToken || this.userToken;

    if (photoId && photoToken) {
      try {
        const photoRes = await fetch(
          `${this.baseUrl}/${this.apiVersion}/${photoId}?fields=id,likes.summary(true),comments.summary(true).filter(stream),images&access_token=${photoToken}`
        );
        const photoData = await photoRes.json();
        if (!photoData.error) {
          const likesCount = photoData.likes?.summary?.total_count || 0;
          const commentsCount = photoData.comments?.summary?.total_count || 0;
          const imageUrl = photoData.images?.[0]?.source;

          const updatedAttachments = post.attachments ? { ...post.attachments } : { data: [{}] };
          if (imageUrl) {
            if (!updatedAttachments.data) updatedAttachments.data = [{}];
            updatedAttachments.data[0].imageUrl = imageUrl;
          }

          return {
            ...post,
            attachments: updatedAttachments,
            reactions: { summary: { total_count: Math.max(likesCount, post.reactions?.summary?.total_count || 0) } },
            comments: { summary: { total_count: Math.max(commentsCount, post.comments?.summary?.total_count || 0) } },
          };
        }
      } catch (e) {}
    }

    return post;
  }

  /**
   * Fetch page details and recent posts.
   */
  async getPagePosts(rawPageInput: string, pageToken?: string): Promise<{ posts: PagePostRecord[]; fanCount?: number; name?: string; pageId?: string; error?: string }> {
    const cleanedInput = this.cleanPageInput(rawPageInput);
    let token = pageToken;

    if (!token && this.userToken) {
      const managed = await this.getManagedPages();
      const match = managed.find(
        (p) => p.id === cleanedInput || p.name.toLowerCase() === cleanedInput.toLowerCase()
      );
      if (match) {
        token = match.access_token;
      } else {
        token = this.userToken;
      }
    }

    const activeToken = token || this.userToken;

    try {
      // 1. Fetch Page Info
      let pageName = cleanedInput;
      let fanCount = 0;
      try {
        const infoRes = await fetch(`${this.baseUrl}/${this.apiVersion}/${cleanedInput}?fields=id,name,category,fan_count&access_token=${activeToken}`);
        const infoData = await infoRes.json();
        if (infoData.name) {
          pageName = infoData.name;
          fanCount = infoData.fan_count || 0;
        }
      } catch (e) {
        // ignore info error
      }

      // 2. Fetch Posts via published_posts
      const fields = 'id,message,created_time,permalink_url,shares,reactions.summary(true),comments.summary(true).filter(stream),attachments{media_type,type,title,description,url,unshimmed_url,target,subattachments}';
      const postsUrl = `${this.baseUrl}/${this.apiVersion}/${cleanedInput}/published_posts?fields=${fields}&limit=25&access_token=${activeToken}`;
      const postsRes = await fetch(postsUrl);
      const postsData = await postsRes.json();

      let rawPosts: PagePostRecord[] = [];
      if (postsData.data && Array.isArray(postsData.data)) {
        rawPosts = postsData.data;
      } else {
        const feedUrl = `${this.baseUrl}/${this.apiVersion}/${cleanedInput}/feed?fields=${fields}&limit=25&access_token=${activeToken}`;
        const feedRes = await fetch(feedUrl);
        const feedData = await feedRes.json();
        if (feedData.data && Array.isArray(feedData.data)) {
          rawPosts = feedData.data;
        }
      }

      // 3. Parallel Enrich posts with live views, reactions, and creative images
      const enrichedPosts = await Promise.all(
        rawPosts.map((p) => this.enrichPostEngagement(p, activeToken))
      );

      return {
        pageId: cleanedInput,
        name: pageName,
        fanCount,
        posts: enrichedPosts,
      };
    } catch (err: any) {
      return { posts: [], error: err.message };
    }
  }

  /**
   * Fetch and refresh a single post's details and engagement
   */
  async getSinglePost(postId: string, pageToken?: string): Promise<PagePostRecord | null> {
    const fields = 'id,message,created_time,permalink_url,shares,reactions.summary(true),comments.summary(true).filter(stream),attachments{media_type,type,title,description,url,unshimmed_url,target,subattachments}';
    const activeToken = pageToken || this.userToken;

    try {
      const res = await fetch(`${this.baseUrl}/${this.apiVersion}/${postId}?fields=${fields}&access_token=${activeToken}`);
      const data = await res.json();
      if (data.id) {
        return await this.enrichPostEngagement(data, activeToken);
      }
      return null;
    } catch (err) {
      return null;
    }
  }

  /**
   * Fetch all Ad Accounts with full cursor pagination
   */
  async getAdAccounts(token?: string): Promise<any[]> {
    const activeToken = token || this.userToken;
    if (!activeToken) return [];

    let allAccounts: any[] = [];
    const fields = 'id,name,account_id,account_status,disable_reason,currency,spend_cap,amount_spent,balance,is_prepay_account,funding_source_details{display_string},created_time,timezone_name,business{id,name,verification_status},campaigns.effective_status([\'ACTIVE\']){id,name,stop_time,ads{id,effective_status}}';
    let nextUrl: string | null = `${this.baseUrl}/${this.apiVersion}/me/adaccounts?fields=${encodeURIComponent(fields)}&limit=50&access_token=${activeToken}`;

    try {
      while (nextUrl) {
        const res: Response = await fetch(nextUrl);
        const data: any = await res.json();
        if (data.data && Array.isArray(data.data)) {
          allAccounts.push(...data.data);
        }
        nextUrl = data.paging?.next || null;
      }
    } catch (err) {
      console.error('[MetaGraphClient] Error fetching ad accounts:', err);
    }

    return allAccounts;
  }

  /**
   * Fetch all Business Portfolios with full cursor pagination
   */
  async getBusinesses(token?: string): Promise<any[]> {
    const activeToken = token || this.userToken;
    if (!activeToken) return [];

    let allBusinesses: any[] = [];
    const fields = 'id,name,verification_status,primary_page{id,name,picture{url}},created_time';
    let nextUrl: string | null = `${this.baseUrl}/${this.apiVersion}/me/businesses?fields=${fields}&limit=50&access_token=${activeToken}`;

    try {
      while (nextUrl) {
        const res: Response = await fetch(nextUrl);
        const data: any = await res.json();
        if (data.data && Array.isArray(data.data)) {
          allBusinesses.push(...data.data);
        }
        nextUrl = data.paging?.next || null;
      }
    } catch (err) {
      console.error('[MetaGraphClient] Error fetching businesses:', err);
    }

    return allBusinesses;
  }

  /**
   * Fetch campaigns and ads for a specific Ad Account with custom date range or preset
   */
  async getAccountCampaignsAndAds(
    adAccountId: string,
    options?: { token?: string; datePreset?: string; timeRange?: { since: string; until: string } }
  ): Promise<{ campaigns: any[]; ads: any[]; error?: string }> {
    const activeToken = options?.token || this.userToken;
    if (!activeToken) return { campaigns: [], ads: [], error: 'لا يوجد توكن وصول نشط' };

    const formattedId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;

    // Construct insights subquery with date preset or custom range
    let insightsField = 'insights{spend,impressions,reach,clicks,cpc,cpm,ctr,frequency,inline_link_click_ctr,cost_per_inline_link_click,cost_per_action_type,actions,action_values,purchase_roas,video_p25_watched_actions,video_p50_watched_actions,video_p100_watched_actions,video_avg_time_watched_actions}';
    if (options?.timeRange && options.timeRange.since && options.timeRange.until) {
      const tr = JSON.stringify({ since: options.timeRange.since, until: options.timeRange.until });
      insightsField = `insights.time_range(${tr}){spend,impressions,reach,clicks,cpc,cpm,ctr,frequency,inline_link_click_ctr,cost_per_inline_link_click,cost_per_action_type,actions,action_values,purchase_roas}`;
    } else if (options?.datePreset && options.datePreset !== 'maximum') {
      insightsField = `insights.date_preset(${options.datePreset}){spend,impressions,reach,clicks,cpc,cpm,ctr,frequency,inline_link_click_ctr,cost_per_inline_link_click,cost_per_action_type,actions,action_values,purchase_roas}`;
    }

    try {
      // 1. Fetch campaigns with nested adsets (including targeting) and ads (including creatives)
      const campFields = `id,name,status,effective_status,objective,daily_budget,lifetime_budget,start_time,stop_time,adsets{id,name,status,effective_status,start_time,end_time,optimization_goal,billing_event,daily_budget,targeting},ads{id,name,status,effective_status,issues_info,creative{id,name,title,body,image_url,thumbnail_url,video_id,object_story_spec,effective_object_story_id,object_story_id,link_url,instagram_permalink_url,call_to_action_type},${insightsField}},${insightsField}`;
      const campRes = await fetch(`${this.baseUrl}/${this.apiVersion}/${formattedId}/campaigns?fields=${encodeURIComponent(campFields)}&limit=100&access_token=${activeToken}`);
      const campData = await campRes.json();

      // 2. Fetch ads with creative details & rich insights
      const adFields = `id,name,status,effective_status,issues_info,creative{id,name,title,body,image_url,thumbnail_url,effective_object_story_id,object_story_id,link_url,instagram_permalink_url,call_to_action_type},${insightsField}`;
      const adsRes = await fetch(`${this.baseUrl}/${this.apiVersion}/${formattedId}/ads?fields=${encodeURIComponent(adFields)}&limit=100&access_token=${activeToken}`);
      const adsData = await adsRes.json();

      return {
        campaigns: campData.data || [],
        ads: adsData.data || [],
      };
    } catch (err: any) {
      console.error(`[MetaGraphClient] Error fetching ads for ${formattedId}:`, err);
      return { campaigns: [], ads: [], error: err.message };
    }
  }

  /**
   * Fetch single ad account fresh balance and available funds (ultra-fast 200ms)
   */
  async getSingleAccountBalance(adAccountId: string, token?: string): Promise<{ success: boolean; account?: any; error?: string }> {
    const activeToken = token || this.userToken;
    if (!activeToken) return { success: false, error: 'لا يوجد توكن وصول نشط' };

    const formattedId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;

    try {
      const fields = 'id,name,account_status,currency,amount_spent,balance,spend_cap,insights.date_preset(maximum){spend}';
      const res = await fetch(`${this.baseUrl}/${this.apiVersion}/${formattedId}?fields=${encodeURIComponent(fields)}&access_token=${activeToken}`);
      const data = await res.json();

      if (data.error) {
        return { success: false, error: data.error.message };
      }

      // Calculate available funds
      let availableFunds = '0.00';
      const balance = parseFloat(data.balance || '0') / 100;
      const spendCap = parseFloat(data.spend_cap || '0') / 100;
      const amountSpent = parseFloat(data.amount_spent || '0') / 100;

      if (spendCap > 0 && amountSpent > 0 && spendCap > amountSpent) {
        availableFunds = (spendCap - amountSpent).toFixed(2);
      } else if (balance > 0) {
        availableFunds = balance.toFixed(2);
      }

      return {
        success: true,
        account: {
          ...data,
          available_funds: availableFunds,
          amount_spent_formatted: amountSpent.toFixed(2),
        },
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}

export const metaClient = new MetaGraphClient();
export default metaClient;
