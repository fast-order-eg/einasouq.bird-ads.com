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

    // If postId is provided, persist analysis into MySQL database!
    if (postId) {
      try {
        await prisma.pagePost.updateMany({
          where: { externalPostId: postId },
          data: {
            analysisJson: JSON.stringify(analysis),
          },
        });
      } catch (dbErr) {
        console.error('Failed to save analysis to DB:', dbErr);
      }
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
