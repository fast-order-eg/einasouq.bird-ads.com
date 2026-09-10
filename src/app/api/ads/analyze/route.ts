import { NextResponse } from 'next/server';
import vertexAI from '@/lib/vertex';
import prisma from '@/lib/db';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      adText,
      pageName,
      platform,
      snapshotUrl,
      imageBase64,
      imageUrl,
      postId,
      mode,
      mediaType,
      metrics,
      permalinkUrl,
    } = body;

    if (!adText && !imageBase64 && !imageUrl) {
      return NextResponse.json({ success: false, error: 'نص المنشور أو الصورة مطلوب للتحليل' }, { status: 400 });
    }

    let analysis: any;

    if (mode === 'paid_campaign' || mode === 'paid_post') {
      analysis = await vertexAI.analyzePostForPaidCampaign({
        postText: adText || '',
        pageName,
        mediaType,
        imageUrl,
        imageBase64,
        metrics,
        permalinkUrl,
      });
    } else {
      analysis = await vertexAI.analyzeAdCreative(adText || 'تحليل الصورة المرفقة', {
        pageName,
        platform,
        snapshotUrl,
        imageBase64,
        imageUrl,
      });
    }

    // Persist analysis into MySQL database (PagePost table)!
    try {
      const effectivePostId = postId || permalinkUrl || `post_${Date.now()}`;
      let asset: any = null;

      if (body.pageId) {
        asset = await prisma.metaAsset.findFirst({
          where: { OR: [{ externalId: String(body.pageId) }, { name: pageName || '' }] },
        });
      } else if (pageName) {
        asset = await prisma.metaAsset.findFirst({
          where: { name: pageName },
        });
      }

      if (!asset) {
        asset = await prisma.metaAsset.findFirst();
        if (!asset) {
          asset = await prisma.metaAsset.create({
            data: {
              externalId: body.pageId ? String(body.pageId) : `page_${Date.now()}`,
              name: pageName || 'صفحة تابعة للعميل',
              assetType: 'PAGE',
              isAuthorized: true,
            },
          });
        }
      }

      if (effectivePostId && asset) {
        const postRecord = await prisma.pagePost.findFirst({
          where: {
            OR: [
              { externalPostId: String(effectivePostId) },
              ...(permalinkUrl ? [{ permalinkUrl }] : []),
            ],
          },
        });

        if (postRecord) {
          await prisma.pagePost.update({
            where: { id: postRecord.id },
            data: {
              analysisJson: JSON.stringify(analysis),
              message: adText || postRecord.message,
              permalinkUrl: permalinkUrl || postRecord.permalinkUrl,
              postType: mediaType || postRecord.postType,
              reactionsCount: metrics?.reactions ?? postRecord.reactionsCount,
              commentsCount: metrics?.comments ?? postRecord.commentsCount,
              sharesCount: metrics?.shares ?? postRecord.sharesCount,
              viewsCount: metrics?.views ?? postRecord.viewsCount,
              updatedAt: new Date(),
            },
          });
        } else {
          await prisma.pagePost.create({
            data: {
              assetId: asset.id,
              externalPostId: String(effectivePostId),
              message: adText || '',
              createdTime: new Date(),
              postType: mediaType || 'POST',
              permalinkUrl: permalinkUrl || '',
              attachmentsJson: JSON.stringify({
                data: [
                  {
                    media_type: mediaType?.toLowerCase() || 'post',
                    imageUrl: imageUrl || snapshotUrl || null,
                  },
                ],
              }),
              reactionsCount: metrics?.reactions || 0,
              commentsCount: metrics?.comments || 0,
              sharesCount: metrics?.shares || 0,
              viewsCount: metrics?.views || 0,
              analysisJson: JSON.stringify(analysis),
            },
          });
        }
      }
    } catch (dbErr) {
      console.error('Failed to save analysis to DB:', dbErr);
    }

    return NextResponse.json({
      success: true,
      modelUsed: 'gemini-2.5',
      analysis,
    });
  } catch (error: any) {
    console.error('Ad Analysis API Error:', error);
    let userFriendlyMessage = error.message || 'حدث خطأ غير متوقع أثناء تحليل الإعلان';
    if (error.message?.includes('429') || error.message?.includes('RESOURCE_EXHAUSTED') || error.message?.includes('Resource exhausted')) {
      userFriendlyMessage = 'سيرفرات الذكاء الاصطناعي عليها ضغط لحظي، برجاء الضغط مرة أخرى لإعادة المحاولة فوراً.';
    }
    return NextResponse.json({ success: false, error: userFriendlyMessage }, { status: 500 });
  }
}
