import { NextResponse } from 'next/server';
import metaClient from '@/lib/meta';
import prisma from '@/lib/db';
import { pageAnalysisProvider } from '@/lib/page-analysis-provider';
import { adScraper } from '@/lib/scraper';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { pageId, pageToken, forceRefresh = false, singlePostId } = body;

    // 1. Single Post Refresh Mode
    if (singlePostId) {
      const updatedPost = await metaClient.getSinglePost(singlePostId, pageToken);
      if (updatedPost) {
        try {
          const dbPost = await prisma.pagePost.findUnique({
            where: { externalPostId: singlePostId },
            select: { analysisJson: true, assetId: true },
          });

          await prisma.pagePost.updateMany({
            where: { externalPostId: singlePostId },
            data: {
              message: updatedPost.message || '',
              likesCount: updatedPost.reactions?.summary?.total_count || 0,
              reactionsCount: updatedPost.reactions?.summary?.total_count || 0,
              commentsCount: updatedPost.comments?.summary?.total_count || 0,
              sharesCount: updatedPost.shares?.count || 0,
              viewsCount: updatedPost.views || 0,
              permalinkUrl: updatedPost.permalink_url || null,
              attachmentsJson: updatedPost.attachments ? JSON.stringify(updatedPost.attachments) : null,
            },
          });

          if (dbPost?.analysisJson) {
            (updatedPost as any).analysis = JSON.parse(dbPost.analysisJson);
          }
        } catch (dbErr) {
          console.error('DB update error for single post:', dbErr);
        }

        return NextResponse.json({
          success: true,
          post: updatedPost,
        });
      }
      return NextResponse.json({ success: false, error: 'تعذر تحديث المنشور' }, { status: 404 });
    }

    if (!pageId) {
      return NextResponse.json({ success: false, error: 'معرف الصفحة أو الرابط مطلوب' }, { status: 400 });
    }

    // 2. Safe Page Identity Resolution
    const identity = await pageAnalysisProvider.resolveFacebookPageInput(pageId);
    const targetId = identity.resolvedPageId || identity.extractedSlug;

    // 3. Handle Owned / Authorized Pages (Domain A)
    if (identity.isOwned && identity.resolvedPageId) {
      const activeToken = identity.accessToken || pageToken;

      // Check DB cache first
      if (!forceRefresh) {
        try {
          const cachedAsset = await prisma.metaAsset.findFirst({
            where: { externalId: identity.resolvedPageId },
            include: {
              posts: {
                orderBy: { createdTime: 'desc' },
              },
            },
          });

          if (cachedAsset && cachedAsset.posts.length > 0) {
            const formattedPosts = cachedAsset.posts.map((p) => ({
              id: p.externalPostId,
              message: p.message,
              created_time: p.createdTime.toISOString(),
              permalink_url: p.permalinkUrl,
              views: p.viewsCount,
              reactions: { summary: { total_count: p.reactionsCount } },
              comments: { summary: { total_count: p.commentsCount } },
              shares: { count: p.sharesCount },
              attachments: p.attachmentsJson ? JSON.parse(p.attachmentsJson) : undefined,
              analysis: p.analysisJson ? JSON.parse(p.analysisJson) : undefined,
            }));

            return NextResponse.json({
              success: true,
              status: 'supported',
              isOwned: true,
              data: {
                pageId: cachedAsset.externalId,
                name: cachedAsset.name,
                fanCount: cachedAsset.fanCount,
                posts: formattedPosts,
                fromDb: true,
              },
            });
          }
        } catch (dbReadErr) {
          console.error('DB Cache Read Error:', dbReadErr);
        }
      }

      // Fetch fresh from Meta Graph API
      const result = await pageAnalysisProvider.getAuthorizedFacebookPagePosts(identity.resolvedPageId, activeToken);

      if (!result.success || !result.data) {
        return NextResponse.json({
          success: false,
          status: result.status,
          error: result.message,
          limitations: result.limitations,
        }, { status: 400 });
      }

      // Save to MySQL DB
      try {
        const dbAsset = await prisma.metaAsset.upsert({
          where: { externalId: identity.resolvedPageId },
          update: {
            name: result.data.name || identity.resolvedPageId,
            fanCount: result.data.fanCount || 0,
            accessToken: activeToken || undefined,
          },
          create: {
            externalId: identity.resolvedPageId,
            name: result.data.name || identity.resolvedPageId,
            fanCount: result.data.fanCount || 0,
            assetType: 'PAGE',
            accessToken: activeToken || undefined,
          },
        });

        for (const p of result.data.posts) {
          const existing = await prisma.pagePost.findUnique({
            where: { externalPostId: p.id },
            select: { analysisJson: true },
          });

          if (existing?.analysisJson) {
            (p as any).analysis = JSON.parse(existing.analysisJson);
          }

          await prisma.pagePost.upsert({
            where: { externalPostId: p.id },
            update: {
              message: p.message || '',
              createdTime: new Date(p.created_time),
              likesCount: p.reactions?.summary?.total_count || 0,
              reactionsCount: p.reactions?.summary?.total_count || 0,
              commentsCount: p.comments?.summary?.total_count || 0,
              sharesCount: p.shares?.count || 0,
              viewsCount: p.views || 0,
              permalinkUrl: p.permalink_url || null,
              attachmentsJson: p.attachments ? JSON.stringify(p.attachments) : null,
            },
            create: {
              assetId: dbAsset.id,
              externalPostId: p.id,
              message: p.message || '',
              createdTime: new Date(p.created_time),
              likesCount: p.reactions?.summary?.total_count || 0,
              reactionsCount: p.reactions?.summary?.total_count || 0,
              commentsCount: p.comments?.summary?.total_count || 0,
              sharesCount: p.shares?.count || 0,
              viewsCount: p.views || 0,
              permalinkUrl: p.permalink_url || null,
              attachmentsJson: p.attachments ? JSON.stringify(p.attachments) : null,
              analysisJson: existing?.analysisJson || null,
            },
          });
        }
      } catch (dbSaveErr) {
        console.error('DB Upsert Error:', dbSaveErr);
      }

      // Include saved audit report from DB
      let auditReport = null;
      let auditReportDate = null;
      try {
        const dbAsset = await prisma.metaAsset.findUnique({
          where: { externalId: targetId },
          select: { auditReport: true, auditReportDate: true },
        });
        auditReport = dbAsset?.auditReport || null;
        auditReportDate = dbAsset?.auditReportDate || null;
      } catch (e) {}

      return NextResponse.json({
        success: true,
        status: 'supported',
        isOwned: true,
        data: {
          ...result.data,
          auditReport,
          auditReportDate,
        },
      });
    }

    // 4. Handle Competitor / Unowned Pages (Domain B) -> Automatic Headless Extraction!
    console.log(`[Competitor Route] Fetching competitor ads/posts for: ${pageId}`);

    // Check DB cache first if not forceRefresh
    if (!forceRefresh) {
      try {
        const cachedAsset = await prisma.metaAsset.findFirst({
          where: { externalId: targetId },
          include: {
            posts: {
              orderBy: { createdTime: 'desc' },
            },
          },
        });

        if (cachedAsset && cachedAsset.posts.length > 0) {
          const formattedPosts = cachedAsset.posts.map((p) => ({
            id: p.externalPostId,
            message: p.message,
            created_time: p.createdTime.toISOString(),
            permalink_url: p.permalinkUrl,
            views: p.viewsCount,
            reactions: { summary: { total_count: p.reactionsCount } },
            comments: { summary: { total_count: p.commentsCount } },
            shares: { count: p.sharesCount },
            attachments: p.attachmentsJson ? JSON.parse(p.attachmentsJson) : undefined,
            analysis: p.analysisJson ? JSON.parse(p.analysisJson) : undefined,
          }));

          return NextResponse.json({
            success: true,
            status: 'supported',
            isOwned: false,
            data: {
              pageId: cachedAsset.externalId,
              name: cachedAsset.name,
              fanCount: cachedAsset.fanCount,
              posts: formattedPosts,
              fromDb: true,
            },
          });
        }
      } catch (dbErr) {}
    }

    // Run scraper across Ad Library (EG + ALL)
    const scrapedPosts = await adScraper.scrapeCompetitorPagePosts(pageId);

    if (scrapedPosts && scrapedPosts.length > 0) {
      const pageTitle = scrapedPosts[0]?.pageTitle || identity.extractedSlug || 'منافس';

      const formattedPosts = scrapedPosts.map((sp, idx) => ({
        id: `scraped_${identity.extractedSlug}_${idx}`,
        message: sp.message,
        created_time: sp.created_time || new Date().toISOString(),
        reactions: { summary: { total_count: 0 } },
        comments: { summary: { total_count: 0 } },
        shares: { count: 0 },
        views: 0,
        permalink_url: sp.permalink_url || `https://www.facebook.com/${identity.extractedSlug}`,
        attachments: {
          data: [
            {
              type: sp.mediaType === 'VIDEO' ? 'video_inline' : 'photo',
              media_type: sp.mediaType === 'VIDEO' ? 'video' : 'photo',
              title: pageTitle,
            },
          ],
        },
      }));

      // Save to MySQL DB
      try {
        const dbAsset = await prisma.metaAsset.upsert({
          where: { externalId: targetId },
          update: {
            name: pageTitle,
            fanCount: 0,
          },
          create: {
            externalId: targetId,
            name: pageTitle,
            fanCount: 0,
            assetType: 'PAGE',
            isAuthorized: false,
          },
        });

        for (const p of formattedPosts) {
          const existing = await prisma.pagePost.findUnique({
            where: { externalPostId: p.id },
            select: { analysisJson: true },
          });

          if (existing?.analysisJson) {
            (p as any).analysis = JSON.parse(existing.analysisJson);
          }

          await prisma.pagePost.upsert({
            where: { externalPostId: p.id },
            update: {
              message: p.message || '',
              createdTime: new Date(p.created_time),
              permalinkUrl: p.permalink_url || null,
              attachmentsJson: p.attachments ? JSON.stringify(p.attachments) : null,
            },
            create: {
              assetId: dbAsset.id,
              externalPostId: p.id,
              message: p.message || '',
              createdTime: new Date(p.created_time),
              permalinkUrl: p.permalink_url || null,
              attachmentsJson: p.attachments ? JSON.stringify(p.attachments) : null,
              analysisJson: existing?.analysisJson || null,
            },
          });
        }
      } catch (dbSaveErr) {
        console.error('DB Upsert Error for competitor:', dbSaveErr);
      }

      return NextResponse.json({
        success: true,
        status: 'supported',
        isOwned: false,
        data: {
          pageId: targetId,
          name: pageTitle,
          fanCount: 0,
          posts: formattedPosts,
        },
      });
    }

    return NextResponse.json({
      success: false,
      status: 'not_found',
      error: `لم يتم العثور على إعلانات نشطة في مكتبة الإعلانات أو منشورات عامة لـ "${identity.extractedSlug}" حالياً.`,
    }, { status: 404 });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      status: 'failed',
      error: error.message,
    }, { status: 500 });
  }
}
