import prisma from '@/lib/db';

const BASE_GRAPH_URL = 'https://graph.facebook.com/v21.0';

export interface ParsedFacebookUrl {
  type: 'POST' | 'VIDEO' | 'REEL' | 'PHOTO' | 'UNKNOWN';
  pageIdOrSlug?: string;
  postId?: string;
  videoId?: string;
  photoId?: string;
  rawInput: string;
}

export interface InspectedPostResult {
  id: string;
  postId: string;
  pageId: string;
  pageName: string;
  pagePicture: string | null;
  message: string;
  createdTime: string;
  permalinkUrl: string;
  mediaType: 'VIDEO' | 'IMAGE' | 'CAROUSEL' | 'TEXT';
  media: {
    videoUrl: string | null;
    audioUrl?: string | null;
    fbEmbedUrl?: string | null;
    thumbnailUrl: string | null;
    images: string[];
    primaryImageUrl: string | null;
  };
  metrics: {
    reactions: number;
    comments: number;
    shares: number;
    views: number;
  };
  isOwned: boolean;
}

export interface InspectPostResponse {
  success: boolean;
  post?: InspectedPostResult;
  error?: string;
  details?: any;
}

// Helper to decode HTML entities in scraped social media metadata
export function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/[\u200E\u200F\u202A-\u202E]/g, '')
    .trim();
}

// Helper to extract audio stream for Facebook Reels/Videos using DASH representations in the embed plugin
async function extractReelAudioUrl(fullFbUrl: string): Promise<string | null> {
  try {
    const pluginUrl = `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(fullFbUrl)}&width=480`;
    const res = await fetch(pluginUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const html = await res.text();

    const normalized = html
      .replace(/\\u003C/gi, '<')
      .replace(/\\u003E/gi, '>')
      .replace(/\\u0022/gi, '"')
      .replace(/\\u0026/gi, '&')
      .replace(/\\\//g, '/')
      .replace(/\\"/g, '"')
      .replace(/&amp;/g, '&');

    const repRegex = /<Representation([^>]+)>([\s\S]*?)<\/Representation>/gi;
    let match;
    const audios: { bandwidth: number; url: string }[] = [];

    while ((match = repRegex.exec(normalized)) !== null) {
      const attrs = match[1];
      const body = match[2];
      const baseMatch = body.match(/<BaseURL>([^<]+)<\/BaseURL>/i);
      if (!baseMatch) continue;

      const url = baseMatch[1].trim();
      const mimeMatch = attrs.match(/mimeType="([^"]+)"/i);
      const tagMatch = attrs.match(/FBEncodingTag="([^"]+)"/i);
      const bandwidthMatch = attrs.match(/bandwidth="([^"]+)"/i);

      const mimeType = mimeMatch ? mimeMatch[1] : '';
      const encodingTag = tagMatch ? tagMatch[1] : '';
      const bandwidth = bandwidthMatch ? parseInt(bandwidthMatch[1], 10) : 0;

      if (mimeType.includes('audio') || encodingTag.includes('audio')) {
        audios.push({ bandwidth, url });
      }
    }

    if (audios.length > 0) {
      audios.sort((a, b) => b.bandwidth - a.bandwidth);
      return audios[0].url;
    }
  } catch (e) {
    console.warn('[Post Inspect] Could not extract audio track:', e);
  }
  return null;
}

export function parseFacebookPostUrl(input: string): ParsedFacebookUrl {
  const clean = (input || '').trim();
  if (!clean) return { type: 'UNKNOWN', rawInput: clean };

  // Direct numeric ID format e.g. "123456789_987654321" or "987654321"
  if (/^\d+_\d+$/.test(clean)) {
    const [pageId, postId] = clean.split('_');
    return { type: 'POST', pageIdOrSlug: pageId, postId: clean, rawInput: clean };
  }

  try {
    const urlObj = new URL(clean.startsWith('http') ? clean : `https://${clean}`);
    const pathname = urlObj.pathname;
    const searchParams = urlObj.searchParams;

    // 0. Instagram Support (Posts, Reels, TV)
    if (urlObj.hostname.includes('instagram.com') || urlObj.hostname.includes('instagr.am')) {
      const isReel = /\/(?:reel|reels)\//i.test(pathname);
      const postMatch =
        pathname.match(/\/(?:p|tv|reel|reels|share\/p)\/([a-zA-Z0-9_-]+)/i) ||
        pathname.match(/\/([^/]+)\/(?:p|reel|reels)\/([a-zA-Z0-9_-]+)/i);
      const shortcode = postMatch ? (postMatch[2] || postMatch[1]) : undefined;
      const user = postMatch && postMatch[2] ? postMatch[1] : undefined;

      return {
        type: isReel ? 'REEL' : 'POST',
        pageIdOrSlug: user,
        postId: shortcode,
        videoId: isReel ? shortcode : undefined,
        rawInput: clean,
      };
    }

    // 1. Reel with page: /{page_slug}/reel/{reel_id}
    const pageReelMatch = pathname.match(/\/([^/]+)\/reel\/([a-zA-Z0-9_-]+)/i);
    if (pageReelMatch && !['reel', 'reels', 'share'].includes(pageReelMatch[1].toLowerCase())) {
      return { type: 'REEL', pageIdOrSlug: pageReelMatch[1], videoId: pageReelMatch[2], rawInput: clean };
    }

    // 2. Reel direct: /reel/{reel_id} or /reels/{reel_id} or /share/r/{reel_id}
    const reelMatch = pathname.match(/\/(?:reels?|share\/r)\/([a-zA-Z0-9_-]+)/i);
    if (reelMatch) {
      return { type: 'REEL', videoId: reelMatch[1], rawInput: clean };
    }

    // 3. Video with page: /{page_slug}/videos/{video_id}
    const pageVideoMatch = pathname.match(/\/([^/]+)\/videos\/([a-zA-Z0-9_-]+)/i);
    if (pageVideoMatch && !['watch', 'share', 'videos'].includes(pageVideoMatch[1].toLowerCase())) {
      return { type: 'VIDEO', pageIdOrSlug: pageVideoMatch[1], videoId: pageVideoMatch[2], rawInput: clean };
    }

    // 4. Video: /watch/?v={video_id} or /videos/{video_id} or /share/v/{id}
    const watchV = searchParams.get('v');
    if (watchV && /^\d+$/.test(watchV)) {
      return { type: 'VIDEO', videoId: watchV, rawInput: clean };
    }
    const videoMatch = pathname.match(/\/(?:videos|share\/v)\/([a-zA-Z0-9_-]+)/i);
    if (videoMatch) {
      return { type: 'VIDEO', videoId: videoMatch[1], rawInput: clean };
    }

    // 5. Photo: /photos/{id} or /photo/?fbid={photo_id}
    const fbid = searchParams.get('fbid');
    if (fbid && /^\d+$/.test(fbid)) {
      return { type: 'PHOTO', photoId: fbid, rawInput: clean };
    }
    const photoMatch = pathname.match(/\/photos\/(?:[a-zA-Z0-9._-]+\/)?(\d+)/i);
    if (photoMatch) {
      return { type: 'PHOTO', photoId: photoMatch[1], rawInput: clean };
    }

    // 4. Permalink story_fbid: permalink.php?story_fbid={post_id}&id={page_id}
    const storyFbid = searchParams.get('story_fbid');
    const idParam = searchParams.get('id');
    if (storyFbid) {
      return {
        type: 'POST',
        pageIdOrSlug: idParam || undefined,
        postId: idParam ? `${idParam}_${storyFbid}` : storyFbid,
        rawInput: clean,
      };
    }

    // 5. Standard Post: /{page_slug}/posts/{post_id} or /share/p/{id}
    const postMatch = pathname.match(/\/([^/]+)\/posts\/([^/?#]+)/);
    if (postMatch) {
      return {
        type: 'POST',
        pageIdOrSlug: postMatch[1],
        postId: postMatch[2],
        rawInput: clean,
      };
    }

    const sharePMatch = pathname.match(/\/share\/p\/([^/?#]+)/);
    if (sharePMatch) {
      return {
        type: 'POST',
        postId: sharePMatch[1],
        rawInput: clean,
      };
    }

    // Fallback: extract last segment if numeric
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length > 0) {
      const last = segments[segments.length - 1];
      if (/^\d+$/.test(last)) {
        return { type: 'POST', postId: last, rawInput: clean };
      }
    }
  } catch (e) {
    if (/^\d+$/.test(clean)) {
      return { type: 'POST', postId: clean, rawInput: clean };
    }
  }

  return { type: 'UNKNOWN', rawInput: clean };
}

// Helper to resolve Facebook share shortlinks (e.g. /share/v/..., /share/r/..., /share/p/..., fb.watch/...)
export async function resolveFacebookShareUrl(url: string): Promise<{
  resolvedUrl?: string;
  pageId?: string;
  videoId?: string;
  postId?: string;
} | null> {
  const clean = (url || '').trim();
  if (!clean) return null;

  const isShareLink =
    clean.includes('/share/') ||
    clean.includes('fb.watch') ||
    clean.includes('/share.php') ||
    clean.includes('m.facebook.com/share');

  if (!isShareLink) return null;

  try {
    const targetUrl = clean.startsWith('http') ? clean : `https://${clean}`;
    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent':
          'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
        'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return null;

    let resolvedUrl: string | undefined = undefined;
    if (res.url && !res.url.includes('/share/') && !res.url.includes('fb.watch')) {
      resolvedUrl = res.url;
    }

    const html = await res.text();

    // 1. Look for canonical link or alternate link or og:url
    if (!resolvedUrl) {
      const canonicalMatch =
        html.match(/<link[^>]+rel=["'](?:alternate|canonical)["'][^>]+href=["']([^"']+)["']/i) ||
        html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:alternate|canonical)["']/i) ||
        html.match(/<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i);

      if (canonicalMatch && canonicalMatch[1]) {
        resolvedUrl = canonicalMatch[1].replace(/&amp;/g, '&');
      }
    }

    // 2. Extract pageID and video_id/story_token/post_id from embedded JSON / props
    const pageIdMatch =
      html.match(/"pageID":"(\d+)"/i) ||
      html.match(/"page_id":"(\d+)"/i) ||
      html.match(/"owner_id":"(\d+)"/i);

    const videoIdMatch =
      html.match(/"video_id":"(\d+)"/i) ||
      html.match(/"story_token":"(\d+)"/i) ||
      html.match(/"v":"(\d+)"/i) ||
      html.match(/"fbid":"(\d+)"/i);

    const postIdMatch =
      html.match(/"post_id":"(\d+)"/i) ||
      html.match(/"story_fbid":"(\d+)"/i) ||
      html.match(/"mf_story_key":"(\d+)"/i);

    const pageId = pageIdMatch ? pageIdMatch[1] : undefined;
    const videoId = videoIdMatch ? videoIdMatch[1] : undefined;
    const postId = postIdMatch ? postIdMatch[1] : undefined;

    return {
      resolvedUrl,
      pageId,
      videoId,
      postId,
    };
  } catch (err) {
    console.warn('[Post Inspect] Error resolving share URL:', err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// INSTAGRAM POST INSPECTOR (Posts, Reels, Carousel, Videos)
// ─────────────────────────────────────────────────────────────────────────────
export async function inspectInstagramPost(rawUrl: string): Promise<InspectPostResponse> {
  const clean = (rawUrl || '').trim();
  if (!clean) {
    return { success: false, error: 'برجاء إدخال رابط منشور إنستجرام صالح للبدء' };
  }

  try {
    const urlObj = new URL(clean.startsWith('http') ? clean : `https://${clean}`);
    const pathname = urlObj.pathname;

    const isReel = /\/(?:reel|reels)\//i.test(pathname);
    const postMatch =
      pathname.match(/\/(?:p|tv|reel|reels|share\/p)\/([a-zA-Z0-9_-]+)/i) ||
      pathname.match(/\/([^/]+)\/(?:p|reel|reels)\/([a-zA-Z0-9_-]+)/i);

    const shortcode = postMatch ? (postMatch[2] || postMatch[1]) : '';
    const urlUsername = postMatch && postMatch[2] ? postMatch[1] : '';

    if (!shortcode) {
      return {
        success: false,
        error: 'تعذر استخراج معرّف المنشور من رابط إنستجرام. تأكد من صحة الرابط.',
      };
    }

    const canonicalUrl = isReel
      ? `https://www.instagram.com/reel/${shortcode}/`
      : `https://www.instagram.com/p/${shortcode}/`;

    // Fetch OpenGraph meta directly from Instagram using Facebook External Hit User-Agent
    let html = '';
    try {
      const res = await fetch(canonicalUrl, {
        headers: {
          'User-Agent':
            'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
          'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(9000),
      });

      if (res.ok) {
        html = await res.text();
      }
    } catch (fetchErr) {
      console.warn('[Instagram Inspector] Fetch error:', fetchErr);
    }

    // If scraping succeeded and has OpenGraph content
    if (html && (html.includes('og:image') || html.includes('og:title') || html.includes('og:description'))) {
      const getOg = (prop: string): string => {
        const m =
          html.match(new RegExp(`<meta[^>]+property=["']og:${prop}["'][^>]+content=["']([^"']*)["']`, 'i')) ||
          html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:${prop}["']`, 'i'));
        return m ? m[1] : '';
      };

      const rawTitle = getOg('title');
      const rawDesc = getOg('description');
      const rawImage = getOg('image');
      const rawVideo = getOg('video');
      const rawOgUrl = getOg('url');

      const decodedTitle = decodeHtmlEntities(rawTitle);
      const decodedDesc = decodeHtmlEntities(rawDesc);
      const imageUrl = rawImage ? rawImage.replace(/&amp;/g, '&') : null;
      const videoUrl = rawVideo ? rawVideo.replace(/&amp;/g, '&') : null;

      // Extract Page/Account Name
      let pageName = '';
      const nameMatch = decodedTitle.match(/^[\s\u200e\u200f]*(.+?)(?:\s+على\s+Instagram|\s+on\s+Instagram|\s*[-:]\s*Instagram)/i);
      if (nameMatch && nameMatch[1].trim()) {
        pageName = nameMatch[1].trim();
      }

      // Extract Username
      let username = urlUsername;
      if (!username) {
        const userMatch =
          decodedDesc.match(/-\s*([a-zA-Z0-9._]+)\s*(?:on|في|بتاريخ)/i) ||
          rawOgUrl.match(/instagram\.com\/([a-zA-Z0-9._]+)\/(?:p|reel)/i);
        if (userMatch && userMatch[1]) {
          username = userMatch[1].trim();
        }
      }

      if (!pageName) {
        pageName = username ? `@${username}` : 'حساب إنستجرام';
      }

      // Extract Caption / Copy Message
      let message = '';
      const titleQuote = decodedTitle.match(/["“]([\s\S]+?)["”]?$/);
      if (titleQuote && titleQuote[1] && titleQuote[1].trim().length > 3) {
        message = titleQuote[1].replace(/["”]$/, '').trim();
      } else {
        const colonIdx = decodedTitle.indexOf(':');
        if (colonIdx !== -1) {
          message = decodedTitle.slice(colonIdx + 1).replace(/^[\s"“]+|[\s"”]+$/g, '').trim();
        }
      }

      if (!message || message.length < 5) {
        const descQuote = decodedDesc.match(/["“]([\s\S]+?)["”]?$/);
        if (descQuote && descQuote[1]) {
          message = descQuote[1].replace(/["”]$/, '').trim();
        }
      }

      // Extract Reactions & Comments
      let reactions = 0;
      let comments = 0;
      const likesMatch = decodedDesc.match(/([\d,]+)\s*(?:likes|إعجاب|like)/i);
      if (likesMatch) {
        reactions = parseInt(likesMatch[1].replace(/,/g, ''), 10) || 0;
      }
      const commentsMatch = decodedDesc.match(/([\d,]+)\s*(?:comments|تعليق|comment)/i);
      if (commentsMatch) {
        comments = parseInt(commentsMatch[1].replace(/,/g, ''), 10) || 0;
      }

      const isVideoContent = isReel || Boolean(videoUrl);
      const isCarousel = imageUrl ? /CAROUSEL_ITEM/i.test(imageUrl) : false;
      const mediaType: 'VIDEO' | 'IMAGE' | 'CAROUSEL' = isVideoContent
        ? 'VIDEO'
        : isCarousel
        ? 'CAROUSEL'
        : 'IMAGE';

      return {
        success: true,
        post: {
          id: `ig_${shortcode}`,
          postId: shortcode,
          pageId: username || shortcode,
          pageName,
          pagePicture: null,
          message: message || `${pageName} على إنستجرام`,
          createdTime: new Date().toISOString(),
          permalinkUrl: canonicalUrl,
          mediaType,
          media: {
            videoUrl,
            audioUrl: null,
            fbEmbedUrl: null,
            thumbnailUrl: imageUrl,
            images: imageUrl ? [imageUrl] : [],
            primaryImageUrl: imageUrl,
          },
          metrics: {
            reactions,
            comments,
            shares: 0,
            views: 0,
          },
          isOwned: true,
        },
      };
    }

    // Fallback: Check Database for previously cached post
    const dbPost = await prisma.pagePost.findFirst({
      where: {
        OR: [
          { externalPostId: shortcode },
          { externalPostId: `ig_${shortcode}` },
          { permalinkUrl: { contains: shortcode } },
        ],
      },
      include: { asset: true },
    });

    if (dbPost) {
      return {
        success: true,
        post: {
          id: dbPost.externalPostId,
          postId: dbPost.externalPostId,
          pageId: dbPost.asset?.externalId || urlUsername || 'instagram',
          pageName: dbPost.asset?.name || urlUsername || 'حساب إنستجرام',
          pagePicture: null,
          message: dbPost.message || '',
          createdTime: dbPost.createdTime.toISOString(),
          permalinkUrl: dbPost.permalinkUrl || canonicalUrl,
          mediaType: isReel ? 'VIDEO' : 'IMAGE',
          media: {
            videoUrl: null,
            audioUrl: null,
            fbEmbedUrl: null,
            thumbnailUrl: null,
            images: [],
            primaryImageUrl: null,
          },
          metrics: {
            reactions: dbPost.reactionsCount || 0,
            comments: dbPost.commentsCount || 0,
            shares: 0,
            views: dbPost.viewsCount || 0,
          },
          isOwned: true,
        },
      };
    }

    return {
      success: false,
      error:
        'تعذر جلب بيانات منشور إنستجرام. تأكد أن المنشور عام (Public) وليس في حساب خاص (Private) وأن الرابط صحيح.',
      details: { shortcode, canonicalUrl },
    };
  } catch (err: any) {
    console.error('[Instagram Inspector Error]:', err);
    return {
      success: false,
      error: `حدث خطأ أثناء فحص منشور إنستجرام: ${err?.message || err}`,
    };
  }
}

export async function inspectFacebookPost(rawUrl: string): Promise<InspectPostResponse> {
  if (!rawUrl || !rawUrl.trim()) {
    return { success: false, error: 'برجاء إدخال رابط المنشور أو معرّفه للبدء' };
  }

  let effectiveInput = rawUrl.trim();

  // 0. Route Instagram URLs directly to Instagram inspector
  if (
    effectiveInput.includes('instagram.com') ||
    effectiveInput.includes('instagr.am')
  ) {
    return await inspectInstagramPost(effectiveInput);
  }
  let resolvedShare: { resolvedUrl?: string; pageId?: string; videoId?: string; postId?: string } | null = null;

  if (
    effectiveInput.includes('/share/') ||
    effectiveInput.includes('fb.watch') ||
    effectiveInput.includes('/share.php') ||
    effectiveInput.includes('m.facebook.com/share')
  ) {
    resolvedShare = await resolveFacebookShareUrl(effectiveInput);
    if (resolvedShare?.pageId && resolvedShare?.videoId) {
      effectiveInput = `https://www.facebook.com/${resolvedShare.pageId}/videos/${resolvedShare.videoId}/`;
    } else if (resolvedShare?.pageId && resolvedShare?.postId) {
      effectiveInput = `https://www.facebook.com/${resolvedShare.pageId}/posts/${resolvedShare.postId}/`;
    } else if (resolvedShare?.resolvedUrl) {
      effectiveInput = resolvedShare.resolvedUrl;
    }
  }

  const parsed = parseFacebookPostUrl(effectiveInput);

  if (resolvedShare) {
    if (resolvedShare.pageId && !parsed.pageIdOrSlug) {
      parsed.pageIdOrSlug = resolvedShare.pageId;
    }
    if (resolvedShare.videoId && (!parsed.videoId || !/^\d+$/.test(parsed.videoId))) {
      parsed.videoId = resolvedShare.videoId;
      if (parsed.type === 'UNKNOWN') parsed.type = 'VIDEO';
    }
    if (resolvedShare.postId && (!parsed.postId || !/^\d+$/.test(parsed.postId))) {
      parsed.postId = resolvedShare.postId;
      if (parsed.type === 'UNKNOWN') parsed.type = 'POST';
    }
  } else if (
    (parsed.videoId && !/^\d+$/.test(parsed.videoId)) ||
    (parsed.postId && !/^\d+$/.test(parsed.postId) && !parsed.postId.includes('_'))
  ) {
    resolvedShare = await resolveFacebookShareUrl(rawUrl);
    if (resolvedShare) {
      if (resolvedShare.pageId && !parsed.pageIdOrSlug) parsed.pageIdOrSlug = resolvedShare.pageId;
      if (resolvedShare.videoId) {
        parsed.videoId = resolvedShare.videoId;
        if (parsed.type === 'UNKNOWN') parsed.type = 'VIDEO';
      }
      if (resolvedShare.postId) {
        parsed.postId = resolvedShare.postId;
        if (parsed.type === 'UNKNOWN') parsed.type = 'POST';
      }
    }
  }

  const userToken = process.env.META_USER_TOKEN || '';

  // Step 1: Resolve Page Asset & Token from Database
  let pageAsset: any = null;
  let effectiveToken = userToken;

  if (parsed.pageIdOrSlug) {
    pageAsset = await prisma.metaAsset.findFirst({
      where: {
        OR: [{ externalId: parsed.pageIdOrSlug }, { name: parsed.pageIdOrSlug }],
      },
    });

    if (!pageAsset && userToken) {
      try {
        const slugRes = await fetch(
          `${BASE_GRAPH_URL}/${encodeURIComponent(parsed.pageIdOrSlug)}?fields=id,name,username&access_token=${userToken}`
        );
        const slugData = await slugRes.json();
        if (slugData.id) {
          pageAsset = await prisma.metaAsset.findFirst({
            where: {
              OR: [{ externalId: slugData.id }, { name: slugData.name }],
            },
          });
          if (!pageAsset) {
            pageAsset = {
              externalId: slugData.id,
              name: slugData.name || parsed.pageIdOrSlug,
              accessToken: null,
            };
          }
        }
      } catch (slugErr) {
        console.warn('[Post Inspect] Slug resolution error:', slugErr);
      }
    }

    if (pageAsset?.accessToken) {
      effectiveToken = pageAsset.accessToken;
    }
  }

  // Helper to fetch from Graph API with fallback to user token
  const fetchGraph = async (endpoint: string, fields: string, token: string = effectiveToken) => {
    const url = `${BASE_GRAPH_URL}/${endpoint}?fields=${encodeURIComponent(fields)}&access_token=${token}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.error && token !== userToken && userToken) {
      const retryUrl = `${BASE_GRAPH_URL}/${endpoint}?fields=${encodeURIComponent(fields)}&access_token=${userToken}`;
      const retryRes = await fetch(retryUrl);
      return await retryRes.json();
    }
    return data;
  };

  let postResult: InspectedPostResult | null = null;

  // ── CASE A: VIDEO OR REEL ──
  if (parsed.videoId || parsed.type === 'VIDEO' || parsed.type === 'REEL') {
    const videoId = parsed.videoId || parsed.postId;
    if (videoId) {
      const vFields =
        'id,title,description,source,picture,views,length,likes.summary(true),comments.summary(true).filter(stream),from{id,name,picture{url}},created_time,permalink_url';
      let vData = await fetchGraph(videoId, vFields, effectiveToken);

      if (vData.error || !vData.id) {
        try {
          const dbMatch = await prisma.pagePost.findFirst({
            where: {
              OR: [{ externalPostId: { contains: videoId } }, { permalinkUrl: { contains: videoId } }],
            },
            include: { asset: true },
          });
          if (dbMatch?.asset?.accessToken) {
            const dbRes = await fetchGraph(videoId, vFields, dbMatch.asset.accessToken);
            if (dbRes && dbRes.id && !dbRes.error) {
              vData = dbRes;
              pageAsset = dbMatch.asset;
              effectiveToken = dbMatch.asset.accessToken;
            }
          }
        } catch (e) {}
      }

      if (vData.error || !vData.id) {
        try {
          const managedWithTokens = await prisma.metaAsset.findMany({
            where: { accessToken: { not: null } },
            take: 50,
          });
          for (const mg of managedWithTokens) {
            if (!mg.accessToken) continue;
            const testRes = await fetchGraph(videoId, vFields, mg.accessToken);
            if (testRes && testRes.id && !testRes.error) {
              vData = testRes;
              pageAsset = mg;
              effectiveToken = mg.accessToken;
              break;
            }
          }
        } catch (mgErr) {
          console.warn('[Post Inspect] Error testing managed tokens for video:', mgErr);
        }
      }

      if (vData && vData.id) {
        const pageInfo = vData.from || {};
        const detectedPageId = pageInfo.id || pageAsset?.externalId;

        if (detectedPageId && pageAsset?.externalId !== detectedPageId) {
          try {
            const ownerAsset = await prisma.metaAsset.findFirst({
              where: {
                OR: [{ externalId: detectedPageId }, { name: pageInfo.name || '' }],
              },
            });
            if (ownerAsset) {
              pageAsset = ownerAsset;
              if (ownerAsset.accessToken) {
                effectiveToken = ownerAsset.accessToken;
              }
            }
          } catch (e) {}
        }

        if (pageAsset?.accessToken && !vData.source) {
          try {
            const enriched = await fetchGraph(videoId, vFields, pageAsset.accessToken);
            if (enriched && enriched.source) {
              vData.source = enriched.source;
            }
          } catch (e) {}
        }

        let fullFbUrl = vData.permalink_url
          ? vData.permalink_url.startsWith('http')
            ? vData.permalink_url
            : `https://www.facebook.com${vData.permalink_url}`
          : rawUrl;
        if (!fullFbUrl.startsWith('http')) {
          fullFbUrl = `https://www.facebook.com/reel/${videoId}/`;
        }

        let audioUrl: string | null = null;
        try {
          audioUrl = await extractReelAudioUrl(fullFbUrl);
        } catch (e) {}

        postResult = {
          id: vData.id,
          postId: vData.id,
          pageId: pageInfo.id || pageAsset?.externalId || '',
          pageName: pageInfo.name || pageAsset?.name || 'صفحة فيسبوك',
          pagePicture:
            pageInfo.picture?.data?.url ||
            (pageAsset?.metadataJson ? JSON.parse(pageAsset?.metadataJson || '{}').pictureUrl : null),
          message: vData.description || vData.title || '',
          createdTime: vData.created_time,
          permalinkUrl: fullFbUrl,
          mediaType: 'VIDEO',
          media: {
            videoUrl: vData.source || null,
            audioUrl: audioUrl || null,
            fbEmbedUrl: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(fullFbUrl)}&show_text=false&width=480`,
            thumbnailUrl: vData.picture || null,
            images: [],
            primaryImageUrl: vData.picture || null,
          },
          metrics: {
            reactions: vData.likes?.summary?.total_count || vData.reactions?.summary?.total_count || 0,
            comments: vData.comments?.summary?.total_count || 0,
            shares: 0,
            views: vData.views || 0,
          },
          isOwned: Boolean(pageAsset),
        };
      }
    }
  }

  // ── CASE B: PHOTO DIRECT NODE ──
  if (!postResult && (parsed.photoId || parsed.type === 'PHOTO')) {
    const photoId = parsed.photoId || parsed.postId;
    if (photoId) {
      const pFields =
        'id,name,images,likes.summary(true),comments.summary(true).filter(stream),shares,from{id,name,picture{url}},created_time,link';
      let pData = await fetchGraph(photoId, pFields, effectiveToken);

      if (pData.error || !pData.id) {
        try {
          const managedWithTokens = await prisma.metaAsset.findMany({
            where: { accessToken: { not: null } },
            take: 50,
          });
          for (const mg of managedWithTokens) {
            if (!mg.accessToken) continue;
            const testRes = await fetchGraph(photoId, pFields, mg.accessToken);
            if (testRes && testRes.id && !testRes.error) {
              pData = testRes;
              pageAsset = mg;
              effectiveToken = mg.accessToken;
              break;
            }
          }
        } catch (e) {}
      }

      if (pData && pData.id && !pData.error) {
        const pageInfo = pData.from || {};
        const detectedPageId = pageInfo.id || pageAsset?.externalId;
        if (detectedPageId && pageAsset?.externalId !== detectedPageId) {
          try {
            const ownerAsset = await prisma.metaAsset.findFirst({
              where: {
                OR: [{ externalId: detectedPageId }, { name: pageInfo.name || '' }],
              },
            });
            if (ownerAsset) {
              pageAsset = ownerAsset;
            }
          } catch (e) {}
        }
        const highResImage = pData.images?.[0]?.source || null;
        postResult = {
          id: pData.id,
          postId: pData.id,
          pageId: pageInfo.id || pageAsset?.externalId || '',
          pageName: pageInfo.name || pageAsset?.name || 'صفحة فيسبوك',
          pagePicture:
            pageInfo.picture?.data?.url ||
            (pageAsset?.metadataJson ? JSON.parse(pageAsset?.metadataJson || '{}').pictureUrl : null),
          message: pData.name || '',
          createdTime: pData.created_time,
          permalinkUrl: pData.link || rawUrl,
          mediaType: 'IMAGE',
          media: {
            videoUrl: null,
            thumbnailUrl: highResImage,
            images: highResImage ? [highResImage] : [],
            primaryImageUrl: highResImage,
          },
          metrics: {
            reactions: pData.likes?.summary?.total_count || 0,
            comments: pData.comments?.summary?.total_count || 0,
            shares: pData.shares?.count || 0,
            views: 0,
          },
          isOwned: Boolean(pageAsset),
        };
      }
    }
  }

  // ── CASE C: STANDARD POST (FEED / PUBLISHED POST) ──
  if (!postResult && parsed.postId) {
    let candidateId = parsed.postId;
    if (pageAsset && !candidateId.includes('_')) {
      candidateId = `${pageAsset.externalId}_${candidateId}`;
    }

    const postFields =
      'id,message,created_time,permalink_url,shares,reactions.summary(true),comments.summary(true).filter(stream),attachments{media_type,type,title,description,url,unshimmed_url,target,media,subattachments},from{id,name,picture{url}}';
    let postData = await fetchGraph(candidateId, postFields, effectiveToken);

    if (postData.error && candidateId.includes('_')) {
      const rawOnly = candidateId.split('_')[1];
      postData = await fetchGraph(rawOnly, postFields, effectiveToken);
    }

    if (postData.error || !postData.id) {
      try {
        const managedWithTokens = await prisma.metaAsset.findMany({
          where: { accessToken: { not: null } },
          select: { externalId: true, name: true, accessToken: true },
          take: 50,
        });
        for (const mg of managedWithTokens) {
          if (!mg.accessToken) continue;
          const idsToTry = parsed.postId.includes('_')
            ? [parsed.postId]
            : [`${mg.externalId}_${parsed.postId}`, parsed.postId];

          for (const testId of idsToTry) {
            const testRes = await fetchGraph(testId, postFields, mg.accessToken);
            if (testRes && testRes.id && !testRes.error) {
              postData = testRes;
              pageAsset = mg;
              effectiveToken = mg.accessToken;
              break;
            }
          }
          if (postData && postData.id && !postData.error) break;
        }
      } catch (postErr) {
        console.warn('[Post Inspect] Error testing managed tokens for post:', postErr);
      }
    }

    if (postData && postData.id && !postData.error) {
      const pageInfo = postData.from || {};
      const detectedPageId = pageInfo.id || pageAsset?.externalId;
      if (detectedPageId && pageAsset?.externalId !== detectedPageId) {
        try {
          const ownerAsset = await prisma.metaAsset.findFirst({
            where: {
              OR: [{ externalId: detectedPageId }, { name: pageInfo.name || '' }],
            },
          });
          if (ownerAsset) {
            pageAsset = ownerAsset;
          }
        } catch (e) {}
      }

      const attachments = postData.attachments?.data || [];
      const att = attachments[0] || {};
      const sub = att.subattachments?.data || [];

      let isVideo = att.media_type === 'video' || att.type === 'video_inline';
      let videoUrl: string | null = null;
      let audioUrl: string | null = null;
      const images: string[] = [];

      if (isVideo && att.target?.id) {
        try {
          const vData = await fetchGraph(
            att.target.id,
            'source,picture,views',
            pageAsset?.accessToken || effectiveToken
          );
          if (vData && vData.source) {
            videoUrl = vData.source;
          }
        } catch (e) {}
      }

      if (sub.length > 0) {
        for (const item of sub) {
          const imgUrl = item.media?.image?.src;
          if (imgUrl) images.push(imgUrl);
        }
      } else if (att.media?.image?.src) {
        images.push(att.media.image.src);
      }

      let permalink = postData.permalink_url || rawUrl;
      if (!permalink.startsWith('http')) {
        permalink = `https://www.facebook.com${permalink}`;
      }

      if (isVideo) {
        try {
          audioUrl = await extractReelAudioUrl(permalink);
        } catch (e) {}
      }

      const mediaType: 'VIDEO' | 'IMAGE' | 'CAROUSEL' | 'TEXT' = isVideo
        ? 'VIDEO'
        : images.length > 1
        ? 'CAROUSEL'
        : images.length === 1
        ? 'IMAGE'
        : 'TEXT';

      postResult = {
        id: postData.id,
        postId: postData.id,
        pageId: pageInfo.id || pageAsset?.externalId || '',
        pageName: pageInfo.name || pageAsset?.name || 'صفحة فيسبوك',
        pagePicture:
          pageInfo.picture?.data?.url ||
          (pageAsset?.metadataJson ? JSON.parse(pageAsset?.metadataJson || '{}').pictureUrl : null),
        message: postData.message || att.description || att.title || '',
        createdTime: postData.created_time,
        permalinkUrl: permalink,
        mediaType,
        media: {
          videoUrl,
          audioUrl,
          fbEmbedUrl: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(permalink)}&show_text=false&width=480`,
          thumbnailUrl: images[0] || null,
          images: isVideo ? [] : images,
          primaryImageUrl: images[0] || null,
        },
        metrics: {
          reactions: postData.reactions?.summary?.total_count || 0,
          comments: postData.comments?.summary?.total_count || 0,
          shares: postData.shares?.count || 0,
          views: 0,
        },
        isOwned: Boolean(pageAsset),
      };
    }
  }

  // ── CASE D: FALLBACK TO MYSQL DATABASE RECORD ──
  if (!postResult) {
    try {
      const cleanTarget = parsed.postId || parsed.videoId || parsed.photoId || rawUrl;
      const dbPost = await prisma.pagePost.findFirst({
        where: {
          OR: [
            { externalPostId: cleanTarget },
            { externalPostId: { contains: cleanTarget } },
            ...(parsed.postId && parsed.postId.includes('_')
              ? [{ externalPostId: parsed.postId.split('_')[1] }]
              : []),
            { permalinkUrl: { contains: cleanTarget } },
          ],
        },
        include: { asset: true },
      });

      if (dbPost) {
        const att = dbPost.attachmentsJson ? JSON.parse(dbPost.attachmentsJson) : {};
        const images: string[] = [];
        if (att?.data) {
          for (const item of att.data) {
            if (item.imageUrl) images.push(item.imageUrl);
          }
        }

        let pageMeta: any = {};
        try {
          if (dbPost.asset?.metadataJson) pageMeta = JSON.parse(dbPost.asset.metadataJson);
        } catch (e) {}

        const isVideo =
          att?.media_type === 'video' ||
          dbPost.permalinkUrl?.includes('/reel/') ||
          dbPost.permalinkUrl?.includes('/videos/');
        const mediaType: 'VIDEO' | 'IMAGE' | 'CAROUSEL' | 'TEXT' = isVideo
          ? 'VIDEO'
          : images.length > 1
          ? 'CAROUSEL'
          : images.length === 1
          ? 'IMAGE'
          : 'TEXT';

        postResult = {
          id: dbPost.externalPostId,
          postId: dbPost.externalPostId,
          pageId: dbPost.asset?.externalId || '',
          pageName: dbPost.asset?.name || 'صفحة معتمدة',
          pagePicture: pageMeta.pictureUrl || null,
          message: dbPost.message || '',
          createdTime: dbPost.createdTime.toISOString(),
          permalinkUrl: dbPost.permalinkUrl || rawUrl,
          mediaType,
          media: {
            videoUrl:
              isVideo && att?.target?.id ? `https://www.facebook.com/video.php?v=${att.target.id}` : null,
            thumbnailUrl: images[0] || null,
            images,
            primaryImageUrl: images[0] || null,
          },
          metrics: {
            reactions: dbPost.reactionsCount || dbPost.likesCount || 0,
            comments: dbPost.commentsCount || 0,
            shares: dbPost.sharesCount || 0,
            views: dbPost.viewsCount || 0,
          },
          isOwned: true,
        };
      }
    } catch (dbFallbackErr) {
      console.warn('[Post Inspect] DB fallback error:', dbFallbackErr);
    }
  }

  if (!postResult) {
    return {
      success: false,
      error:
        'تعذر العثور على بيانات المنشور. تأكد أن رابط البوست منشور ونشط حالياً في إحدى صفحاتك المُدارة أو المصرّح بها في النظام.',
      details: parsed,
    };
  }

  return {
    success: true,
    post: postResult,
  };
}
