import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import metaClient from '@/lib/meta';

const BASE_GRAPH_URL = 'https://graph.facebook.com/v21.0';

interface ParsedFacebookUrl {
  type: 'POST' | 'VIDEO' | 'REEL' | 'PHOTO' | 'UNKNOWN';
  pageIdOrSlug?: string;
  postId?: string;
  videoId?: string;
  photoId?: string;
  rawInput: string;
}

function parseFacebookPostUrl(input: string): ParsedFacebookUrl {
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

    // 1. Reel: /reel/{reel_id} or /share/r/{reel_id}
    const reelMatch = pathname.match(/\/(?:reel|share\/r)\/([a-zA-Z0-9_-]+)/);
    if (reelMatch) {
      return { type: 'REEL', videoId: reelMatch[1], rawInput: clean };
    }

    // 2. Video: /watch/?v={video_id} or /videos/{video_id} or /share/v/{id}
    const watchV = searchParams.get('v');
    if (watchV && /^\d+$/.test(watchV)) {
      return { type: 'VIDEO', videoId: watchV, rawInput: clean };
    }
    const videoMatch = pathname.match(/\/(?:videos|share\/v)\/([a-zA-Z0-9_-]+)/);
    if (videoMatch) {
      return { type: 'VIDEO', videoId: videoMatch[1], rawInput: clean };
    }

    // 3. Photo: /photos/{id} or /photo/?fbid={photo_id}
    const fbid = searchParams.get('fbid');
    if (fbid && /^\d+$/.test(fbid)) {
      return { type: 'PHOTO', photoId: fbid, rawInput: clean };
    }
    const photoMatch = pathname.match(/\/photos\/(?:[a-zA-Z0-9._-]+\/)?(\d+)/);
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
    // If not valid URL, treat as raw id
    if (/^\d+$/.test(clean)) {
      return { type: 'POST', postId: clean, rawInput: clean };
    }
  }

  return { type: 'UNKNOWN', rawInput: clean };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawUrl = body.postUrl || body.url || body.postId || '';

    if (!rawUrl || !rawUrl.trim()) {
      return NextResponse.json(
        { success: false, error: 'برجاء إدخال رابط المنشور أو معرّفه للبدء' },
        { status: 400 }
      );
    }

    const parsed = parseFacebookPostUrl(rawUrl);
    console.log('[Post Inspect] Parsed Facebook URL:', parsed);

    const userToken = process.env.META_USER_TOKEN || '';

    // Step 1: Resolve Page Asset & Token from Database
    let pageAsset: any = null;
    let effectiveToken = userToken;

    if (parsed.pageIdOrSlug) {
      pageAsset = await prisma.metaAsset.findFirst({
        where: {
          OR: [
            { externalId: parsed.pageIdOrSlug },
            { name: parsed.pageIdOrSlug },
          ],
        },
      });

      // If not directly found in DB by name/externalId, resolve vanity username/slug via Graph API (e.g. "birdads1" -> ID: 234951263043347)
      if (!pageAsset && userToken) {
        try {
          const slugRes = await fetch(`${BASE_GRAPH_URL}/${encodeURIComponent(parsed.pageIdOrSlug)}?fields=id,name,username&access_token=${userToken}`);
          const slugData = await slugRes.json();
          if (slugData.id) {
            pageAsset = await prisma.metaAsset.findFirst({
              where: {
                OR: [
                  { externalId: slugData.id },
                  { name: slugData.name },
                ],
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
        // Retry with user token
        const retryUrl = `${BASE_GRAPH_URL}/${endpoint}?fields=${encodeURIComponent(fields)}&access_token=${userToken}`;
        const retryRes = await fetch(retryUrl);
        return await retryRes.json();
      }
      return data;
    };

    let postResult: any = null;

    // ── CASE A: VIDEO OR REEL ──
    if (parsed.videoId || parsed.type === 'VIDEO' || parsed.type === 'REEL') {
      const videoId = parsed.videoId || parsed.postId;
      if (videoId) {
        // Note: Graph API does NOT have 'shares' on Video nodes!
        const vFields = 'id,title,description,source,picture,views,length,likes.summary(true),comments.summary(true),from{id,name,picture{url}},created_time,permalink_url';
        let vData = await fetchGraph(videoId, vFields, effectiveToken);

        // If video returned error with current token, check if we can find its page in DB or try user token
        if (vData.error) {
          // Check DB PagePost to see which page owns it
          try {
            const dbMatch = await prisma.pagePost.findFirst({
              where: {
                OR: [
                  { externalPostId: { contains: videoId } },
                  { permalinkUrl: { contains: videoId } },
                ],
              },
              include: { asset: true },
            });
            if (dbMatch?.asset?.accessToken) {
              vData = await fetchGraph(videoId, vFields, dbMatch.asset.accessToken);
              if (vData.id) {
                pageAsset = dbMatch.asset;
              }
            }
          } catch (e) {}
        }

        if (vData.id) {
          const pageInfo = vData.from || {};
          const detectedPageId = pageInfo.id || pageAsset?.externalId;

          // If we didn't have pageAsset, look up by detectedPageId
          if (detectedPageId && !pageAsset) {
            try {
              pageAsset = await prisma.metaAsset.findFirst({
                where: { externalId: detectedPageId },
              });
            } catch (e) {}
          }

          // If we found the page and it has a page accessToken, and source (MP4) is missing, fetch with page token to get MP4 download link!
          if (pageAsset?.accessToken && !vData.source) {
            try {
              const enriched = await fetchGraph(videoId, vFields, pageAsset.accessToken);
              if (enriched.source) {
                vData.source = enriched.source;
              }
            } catch (e) {}
          }

          postResult = {
            id: vData.id,
            postId: vData.id,
            pageId: pageInfo.id || pageAsset?.externalId || '',
            pageName: pageInfo.name || pageAsset?.name || 'صفحة فيسبوك',
            pagePicture: pageInfo.picture?.data?.url || (pageAsset?.metadataJson ? JSON.parse(pageAsset?.metadataJson || '{}').pictureUrl : null),
            message: vData.description || vData.title || '',
            createdTime: vData.created_time,
            permalinkUrl: vData.permalink_url ? (vData.permalink_url.startsWith('http') ? vData.permalink_url : `https://www.facebook.com${vData.permalink_url}`) : rawUrl,
            mediaType: 'VIDEO',
            media: {
              videoUrl: vData.source || null,
              thumbnailUrl: vData.picture || null,
              images: vData.picture ? [vData.picture] : [],
              primaryImageUrl: vData.picture || null,
            },
            metrics: {
              reactions: vData.likes?.summary?.total_count || 0,
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
        const pFields = 'id,name,images,likes.summary(true),comments.summary(true).filter(stream),shares,from{id,name,picture{url}},created_time,link';
        const pData = await fetchGraph(photoId, pFields);

        if (pData.id) {
          const pageInfo = pData.from || {};
          const highResImage = pData.images?.[0]?.source || null;
          postResult = {
            id: pData.id,
            postId: pData.id,
            pageId: pageInfo.id || pageAsset?.externalId || '',
            pageName: pageInfo.name || pageAsset?.name || 'صفحة فيسبوك',
            pagePicture: pageInfo.picture?.data?.url || null,
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
      // 1. Try direct post node query
      let candidateId = parsed.postId;
      if (pageAsset && !candidateId.includes('_')) {
        candidateId = `${pageAsset.externalId}_${candidateId}`;
      }

      const postFields = 'id,message,created_time,permalink_url,shares,reactions.summary(true),comments.summary(true),attachments{media_type,type,title,description,url,unshimmed_url,target,media,subattachments},from{id,name,picture{url}}';
      let postData = await fetchGraph(candidateId, postFields, effectiveToken);

      // If failed with combined ID, try candidate without prefix
      if (postData.error && candidateId.includes('_')) {
        const rawOnly = candidateId.split('_')[1];
        postData = await fetchGraph(rawOnly, postFields, effectiveToken);
      }

      // If still error, and postId starts with 'pfbid', search our managed pages that have accessTokens
      if (postData.error && parsed.postId.startsWith('pfbid')) {
        try {
          const managedWithTokens = await prisma.metaAsset.findMany({
            where: { accessToken: { not: null } },
            select: { externalId: true, name: true, accessToken: true },
            take: 30,
          });
          for (const mg of managedWithTokens) {
            if (!mg.accessToken) continue;
            const testId = `${mg.externalId}_${parsed.postId}`;
            const testRes = await fetchGraph(testId, postFields, mg.accessToken);
            if (testRes && testRes.id && !testRes.error) {
              postData = testRes;
              pageAsset = mg;
              effectiveToken = mg.accessToken;
              break;
            }
          }
        } catch (pfbidErr) {
          console.warn('[Post Inspect] Error testing managed tokens for pfbid:', pfbidErr);
        }
      }

      // If still error, and we have pageAsset, search published_posts for permalink/id
      if (postData.error && pageAsset) {
        try {
          const pageToken = pageAsset.accessToken || userToken;
          const pageFeed = await metaClient.getPagePosts(pageAsset.externalId, pageToken);
          if (pageFeed.posts && pageFeed.posts.length > 0) {
            const found = pageFeed.posts.find((p) => {
              return (
                p.id === parsed.postId ||
                p.id.endsWith(`_${parsed.postId}`) ||
                (p.permalink_url && rawUrl.includes(p.permalink_url)) ||
                (parsed.rawInput && p.permalink_url && parsed.rawInput.includes(p.permalink_url))
              );
            });
            if (found) {
              postData = found;
            }
          }
        } catch (feedErr) {
          console.warn('[Post Inspect] Page feed lookup error:', feedErr);
        }
      }

      if (postData && postData.id && !postData.error) {
        const pageInfo = postData.from || {};
        const att = postData.attachments?.data?.[0];
        const subAtts = att?.subattachments?.data || [];

        // Extract Images
        let images: string[] = [];
        if (subAtts.length > 0) {
          images = subAtts
            .map((s: any) => s.media?.image?.src || s.url)
            .filter(Boolean);
        } else if (att?.media?.image?.src) {
          images = [att.media.image.src];
        } else if (att?.imageUrl) {
          images = [att.imageUrl];
        }

        // Check if Video
        let videoUrl: string | null = null;
        let isVideo = att?.media_type === 'video' || att?.type?.includes('video');
        const targetId = att?.target?.id;

        if (targetId && (isVideo || !images.length)) {
          try {
            const vData = await fetchGraph(targetId, 'id,source,picture,views');
            if (vData.source) {
              videoUrl = vData.source;
              isVideo = true;
            }
            if (vData.picture && !images.includes(vData.picture)) {
              images.push(vData.picture);
            }
          } catch (e) {}
        }

        const mediaType = isVideo ? 'VIDEO' : (images.length > 1 ? 'CAROUSEL' : (images.length === 1 ? 'IMAGE' : 'TEXT'));

        postResult = {
          id: postData.id,
          postId: postData.id,
          pageId: pageInfo.id || pageAsset?.externalId || '',
          pageName: pageInfo.name || pageAsset?.name || 'صفحة فيسبوك',
          pagePicture: pageInfo.picture?.data?.url || null,
          message: postData.message || att?.title || '',
          createdTime: postData.created_time,
          permalinkUrl: postData.permalink_url || rawUrl,
          mediaType,
          media: {
            videoUrl,
            thumbnailUrl: images[0] || null,
            images,
            primaryImageUrl: images[0] || null,
          },
          metrics: {
            reactions: postData.reactions?.summary?.total_count || 0,
            comments: postData.comments?.summary?.total_count || 0,
            shares: postData.shares?.count || 0,
            views: postData.views || 0,
          },
          isOwned: Boolean(pageAsset),
        };
      }
    }

    // ── CASE D: FALLBACK CHECK IN LOCAL DATABASE (PagePost & MetaAsset) ──
    if (!postResult) {
      try {
        const queryTerms = [parsed.postId, parsed.videoId, parsed.photoId, rawUrl].filter(Boolean) as string[];
        const orConditions: any[] = [];
        for (const term of queryTerms) {
          orConditions.push({ externalPostId: term });
          orConditions.push({ externalPostId: { contains: term } });
          orConditions.push({ permalinkUrl: { contains: term } });
        }

        const dbPost = await prisma.pagePost.findFirst({
          where: { OR: orConditions },
          include: { asset: true },
        });

        if (dbPost) {
          let attachments: any = {};
          try {
            if (dbPost.attachmentsJson) attachments = JSON.parse(dbPost.attachmentsJson);
          } catch (e) {}

          const att = attachments.data?.[0];
          const subAtts = att?.subattachments?.data || [];
          let images: string[] = [];
          if (subAtts.length > 0) {
            images = subAtts.map((s: any) => s.media?.image?.src || s.url).filter(Boolean);
          } else if (att?.media?.image?.src) {
            images = [att.media.image.src];
          } else if (att?.imageUrl) {
            images = [att.imageUrl];
          }

          let pageMeta: any = {};
          try {
            if (dbPost.asset?.metadataJson) pageMeta = JSON.parse(dbPost.asset.metadataJson);
          } catch (e) {}

          const isVideo = att?.media_type === 'video' || dbPost.permalinkUrl?.includes('/reel/') || dbPost.permalinkUrl?.includes('/videos/');
          const mediaType = isVideo ? 'VIDEO' : (images.length > 1 ? 'CAROUSEL' : (images.length === 1 ? 'IMAGE' : 'TEXT'));

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
              videoUrl: isVideo && att?.target?.id ? `https://www.facebook.com/video.php?v=${att.target.id}` : null,
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

    // If still not found, check if it's because of missing permissions or page matching
    if (!postResult) {
      return NextResponse.json({
        success: false,
        error: 'تعذر العثور على بيانات المنشور. تأكد أن رابط البوست منشور ونشط حالياً في إحدى صفحاتك المُدارة أو المصرّح بها في النظام.',
        details: parsed,
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      post: postResult,
    });
  } catch (error: any) {
    console.error('[Post Inspect API Error]:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'حدث خطأ غير متوقع أثناء فحص المنشور',
    }, { status: 500 });
  }
}
