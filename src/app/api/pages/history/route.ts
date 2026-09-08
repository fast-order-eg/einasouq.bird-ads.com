import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET() {
  try {
    // 1. Fetch all pages that have AI Audit reports
    const auditedPages = await prisma.metaAsset.findMany({
      where: {
        auditReport: {
          not: null,
        },
      },
      orderBy: {
        auditReportDate: 'desc',
      },
    });

    // 2. Fetch all posts that have AI analyses
    const analyzedPosts = await prisma.pagePost.findMany({
      where: {
        analysisJson: {
          not: null,
        },
      },
      include: {
        asset: {
          select: {
            externalId: true,
            name: true,
            category: true,
            metadataJson: true,
          },
        },
      },
      orderBy: {
        createdTime: 'desc',
      },
      take: 100,
    });

    const formattedPages = auditedPages.map((p) => {
      let meta: any = {};
      try {
        if (p.metadataJson) meta = JSON.parse(p.metadataJson);
      } catch (e) {}

      return {
        id: p.externalId,
        name: p.name,
        category: p.category || 'عام',
        fanCount: p.fanCount,
        auditReport: p.auditReport,
        auditReportDate: p.auditReportDate || p.updatedAt,
        pictureUrl: meta.pictureUrl,
        coverUrl: meta.coverUrl,
        phone: meta.phone,
        website: meta.website,
      };
    });

    const formattedPosts = analyzedPosts.map((post) => {
      let parsedAnalysis: any = null;
      try {
        if (post.analysisJson) parsedAnalysis = JSON.parse(post.analysisJson);
      } catch (e) {}

      let pageMeta: any = {};
      try {
        if (post.asset?.metadataJson) pageMeta = JSON.parse(post.asset.metadataJson);
      } catch (e) {}

      return {
        id: post.id,
        externalPostId: post.externalPostId,
        message: post.message || '',
        createdTime: post.createdTime,
        postType: post.postType || 'POST',
        permalinkUrl: post.permalinkUrl,
        reactionsCount: post.reactionsCount,
        commentsCount: post.commentsCount,
        sharesCount: post.sharesCount,
        viewsCount: post.viewsCount,
        pageId: post.asset?.externalId,
        pageName: post.asset?.name || 'صفحة غير معروفة',
        pagePictureUrl: pageMeta.pictureUrl,
        analysis: parsedAnalysis,
      };
    });

    return NextResponse.json({
      success: true,
      auditedPagesCount: formattedPages.length,
      analyzedPostsCount: formattedPosts.length,
      pages: formattedPages,
      posts: formattedPosts,
    });
  } catch (error: any) {
    console.error('[API /api/pages/history Error]:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'حدث خطأ أثناء جلب سجلات الصفحات' },
      { status: 500 }
    );
  }
}
