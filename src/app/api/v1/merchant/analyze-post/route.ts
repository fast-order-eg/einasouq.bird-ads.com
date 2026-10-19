import { NextResponse } from 'next/server';
import { inspectFacebookPost } from '@/lib/post-inspector';
import vertexAI, { PaidCampaignPostAnalysis } from '@/lib/vertex';
import prisma from '@/lib/db';

function validateApiKey(req: Request): boolean {
  const expectedKey = process.env.MERCHANT_API_KEY || 'fastorder_merchant_secure_api_key_2026';
  const headerKey = req.headers.get('x-api-key') || req.headers.get('X-API-KEY');
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  const bearerKey = authHeader?.startsWith('Bearer ') ? authHeader.replace(/^Bearer\s+/, '').trim() : null;

  let queryKey: string | null = null;
  try {
    const url = new URL(req.url);
    queryKey = url.searchParams.get('api_key') || url.searchParams.get('key');
  } catch {}

  const providedKey = (headerKey || bearerKey || queryKey || '').trim();
  return Boolean(providedKey && providedKey === expectedKey.trim());
}

function formatPostAnalysisForWhatsApp(
  post: any,
  analysis: PaidCampaignPostAnalysis
): { fullMessage: string; parts: string[] } {
  const verdictEmoji = analysis.verdict.is_suitable ? '🚀' : '⚠️';
  const postSnippet = (post.message || '').replace(/\s+/g, ' ').slice(0, 120);

  // ── Part 1: التقييم العام وفحص المحتوى والكريتيف ──
  let part1 = `🎯 *تقرير التحليل الإعلاني للبوست* 📊\n`;
  part1 += `📌 *الصفحة:* ${post.pageName || 'صفحة تابعة للعميل'}\n`;
  part1 += `🎬 *نوع المحتوى:* ${post.mediaType === 'VIDEO' ? 'فيديو / ريلز 🎥' : post.mediaType === 'CAROUSEL' ? 'ألبوم صور (كاروسيل) 🎠' : 'تصميم / صورة 🖼️'}\n`;
  part1 += `📊 *التفاعلات المرصودة:* 👍 ${post.metrics?.reactions || 0} | 💬 ${post.metrics?.comments || 0} | 🔄 ${post.metrics?.shares || 0}\n`;
  part1 += `🔗 *رابط المنشور:* ${post.permalinkUrl || 'غير متوفر'}\n`;
  if (postSnippet) {
    part1 += `📝 *مقتطف الكوبي:* "${postSnippet}..."\n`;
  }
  part1 += `══════════════════════════\n`;
  part1 += `🏆 *التقييمات الرقمية (من 10):*\n`;
  part1 += `⭐ *التقييم الكلي العام:* *${analysis.observed_score} / 10*\n`;
  part1 += `✍️ *قوة المحتوى والكوبي:* *${analysis.copy_score} / 10*\n`;
  part1 += `🎨 *التصميم والعنصر البصري:* *${analysis.visual_score} / 10*\n\n`;

  part1 += `⚖️ *حكم الجاهزية للحملة الممولة:*\n`;
  part1 += `${verdictEmoji} *الحالة:* ${analysis.verdict.status_label} (تصنيف: ${analysis.verdict.rating})\n`;
  part1 += `💬 *رأي الخبير:* ${analysis.verdict.summary}\n`;
  part1 += `══════════════════════════\n`;

  part1 += `🎬 *تحليل الكريتيف البصري:*\n`;
  part1 += `• *الهوك البصري:* ${analysis.creative_analysis?.visual_hooks || 'غير محدد'}\n`;
  if (analysis.creative_analysis?.strengths?.length) {
    part1 += `• *نقاط القوة البصرية:*\n`;
    analysis.creative_analysis.strengths.forEach((s) => {
      part1 += `  ✅ ${s}\n`;
    });
  }
  if (analysis.creative_analysis?.weaknesses?.length) {
    part1 += `• *نقاط الضعف الملاحظة:*\n`;
    analysis.creative_analysis.weaknesses.forEach((w) => {
      part1 += `  ⚠️ ${w}\n`;
    });
  }
  if (analysis.creative_analysis?.actionable_recommendations?.length) {
    part1 += `• *التعديلات المطلوبة فوراً:*\n`;
    analysis.creative_analysis.actionable_recommendations.forEach((r) => {
      part1 += `  🛠️ ${r}\n`;
    });
  }
  part1 += `══════════════════════════\n`;

  part1 += `✍️ *تحليل النص الإعلاني (الكوبي):*\n`;
  part1 += `• *تقييم الهوك الأول:* ${analysis.copy_analysis?.hook_evaluation || 'غير محدد'}\n`;
  part1 += `• *تقييم العرض:* ${analysis.copy_analysis?.offer_evaluation || 'غير محدد'}\n`;
  part1 += `• *تقييم الـ CTA:* ${analysis.copy_analysis?.cta_evaluation || 'غير محدد'}\n\n`;

  if (analysis.copy_analysis?.ready_to_use_variations?.length) {
    part1 += `💡 *صيغ إعلانية بديلة جاهزة للنسخ والاستخدام:*\n`;
    analysis.copy_analysis.ready_to_use_variations.forEach((v, idx) => {
      part1 += `\n${idx + 1}️⃣ "${v.trim()}"\n`;
    });
  }

  // ── Part 2: الاستهداف المقترح واستراتيجية الحملة ──
  let part2 = `🎯 *خطة الاستهداف واستراتيجية الميديا باينج* 🚀\n`;
  part2 += `══════════════════════════\n`;
  part2 += `👥 *الجمهور والاستهداف المقترح:*\n`;
  part2 += `• *السن المقترح:* ${analysis.targeting_suggestions?.age_range || 'الجمهور النشط'}\n`;
  part2 += `• *النوع:* ${analysis.targeting_suggestions?.gender || 'الجميع'}\n`;

  if (analysis.targeting_suggestions?.detailed_interests?.length) {
    part2 += `• *الاهتمامات الدقيقة (Detailed Interests):*\n`;
    analysis.targeting_suggestions.detailed_interests.forEach((interest) => {
      part2 += `  🎯 ${interest}\n`;
    });
  }

  if (analysis.targeting_suggestions?.behaviors_and_placements?.length) {
    part2 += `• *المواضع والسلوكيات المقترحة:*\n`;
    analysis.targeting_suggestions.behaviors_and_placements.forEach((b) => {
      part2 += `  📱 ${b}\n`;
    });
  }
  part2 += `══════════════════════════\n`;

  part2 += `💼 *استراتيجية الحملة والميزانية:*\n`;
  part2 += `• *الهدف الموصى به:* ${analysis.campaign_strategy?.recommended_objective || 'رسائل واتساب / مبيعات'}\n`;
  part2 += `• *هيكل المجموعات الإعلانية:* ${analysis.campaign_strategy?.ad_set_structure || 'مجموعة إعلانية واحدة للاختبار'}\n`;

  if (analysis.campaign_strategy?.pair_another_post_recommendation) {
    const pair = analysis.campaign_strategy.pair_another_post_recommendation;
    part2 += `• *إضافة بوست آخر (A/B Test):* ${pair.should_pair ? 'نعم موصى به ✅' : 'لا، يفضل منفرداً'}\n`;
    if (pair.recommendation_reason) {
      part2 += `  📝 ${pair.recommendation_reason}\n`;
    }
    if (pair.paired_concept_idea) {
      part2 += `  💡 *فكرة البوست البديل:* ${pair.paired_concept_idea}\n`;
    }
  }

  if (analysis.campaign_strategy?.scaling_and_testing_plan) {
    part2 += `\n📈 *خطة التكبير والتطوير (Scaling):*\n`;
    part2 += `${analysis.campaign_strategy.scaling_and_testing_plan}\n`;
  }

  if (analysis.campaign_strategy?.media_buyer_golden_tip) {
    part2 += `\n🌟 *نصيحة الميديا باير الذهبية:*\n`;
    part2 += `"${analysis.campaign_strategy.media_buyer_golden_tip}"\n`;
  }

  const fullMessage = `${part1}\n${part2}`;
  return { fullMessage, parts: [part1.trim(), part2.trim()] };
}

export async function POST(req: Request) {
  if (!validateApiKey(req)) {
    return NextResponse.json(
      { success: false, error: 'غير مصرّح: برجاء إرسال مفتاح الـ API الصحيح في x-api-key' },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const rawUrl = body.post_url || body.postUrl || body.url || body.postId || body.post_id || '';
    const forceRefresh = Boolean(body.force_refresh || body.forceRefresh);

    if (!rawUrl || !String(rawUrl).trim()) {
      return NextResponse.json(
        { success: false, error: 'برجاء إرسال رابط المنشور أو معرّفه في حقل post_url' },
        { status: 400 }
      );
    }

    // Step 1: Inspect post from Graph API / DB
    const inspectResult = await inspectFacebookPost(String(rawUrl).trim());
    if (!inspectResult.success || !inspectResult.post) {
      return NextResponse.json(
        {
          success: false,
          error: inspectResult.error || 'تعذر العثور على المنشور أو لا توجد صلاحية أدمن على صفحته',
          details: inspectResult.details,
        },
        { status: 404 }
      );
    }

    const post = inspectResult.post;

    // Step 2: Check cached analysis in DB if not force-refreshing
    let analysis: PaidCampaignPostAnalysis | null = null;
    let fromCache = false;

    if (!forceRefresh) {
      try {
        const dbPost = await prisma.pagePost.findFirst({
          where: {
            OR: [
              { externalPostId: post.id },
              { externalPostId: post.postId },
              ...(post.permalinkUrl ? [{ permalinkUrl: post.permalinkUrl }] : []),
            ],
          },
          select: { analysisJson: true },
        });

        if (dbPost?.analysisJson) {
          analysis = JSON.parse(dbPost.analysisJson);
          fromCache = true;
        }
      } catch (dbErr) {
        console.warn('[Analyze Post API] DB cache read error:', dbErr);
      }
    }

    // Step 3: Run Vertex AI Strategic Analysis with Gemini 3.8 Flash
    if (!analysis) {
      analysis = await vertexAI.analyzePostForPaidCampaign({
        postText: post.message || '',
        pageName: post.pageName,
        mediaType: post.mediaType,
        imageUrl: post.media?.primaryImageUrl || (post.media?.images?.[0] || ''),
        metrics: post.metrics,
        permalinkUrl: post.permalinkUrl,
      });

      // Save/update in DB
      try {
        const effectivePostId = post.id || post.postId;
        let asset = await prisma.metaAsset.findFirst({
          where: {
            OR: [
              ...(post.pageId ? [{ externalId: String(post.pageId) }] : []),
              { name: post.pageName || '' },
            ],
          },
        });

        if (!asset) {
          asset = await prisma.metaAsset.create({
            data: {
              externalId: post.pageId ? String(post.pageId) : `page_${Date.now()}`,
              name: post.pageName || 'صفحة تابعة للعميل',
              assetType: 'PAGE',
              isAuthorized: true,
            },
          });
        }

        const existingPost = await prisma.pagePost.findFirst({
          where: {
            OR: [
              { externalPostId: String(effectivePostId) },
              ...(post.permalinkUrl ? [{ permalinkUrl: post.permalinkUrl }] : []),
            ],
          },
        });

        if (existingPost) {
          await prisma.pagePost.update({
            where: { id: existingPost.id },
            data: {
              analysisJson: JSON.stringify(analysis),
              message: post.message || existingPost.message,
              permalinkUrl: post.permalinkUrl || existingPost.permalinkUrl,
              postType: post.mediaType || existingPost.postType,
              reactionsCount: post.metrics?.reactions ?? existingPost.reactionsCount,
              commentsCount: post.metrics?.comments ?? existingPost.commentsCount,
              sharesCount: post.metrics?.shares ?? existingPost.sharesCount,
              viewsCount: post.metrics?.views ?? existingPost.viewsCount,
              updatedAt: new Date(),
            },
          });
        } else {
          await prisma.pagePost.create({
            data: {
              assetId: asset.id,
              externalPostId: String(effectivePostId),
              message: post.message || '',
              createdTime: new Date(post.createdTime || Date.now()),
              postType: post.mediaType || 'POST',
              permalinkUrl: post.permalinkUrl || '',
              attachmentsJson: JSON.stringify({
                data: [
                  {
                    media_type: post.mediaType?.toLowerCase() || 'post',
                    imageUrl: post.media?.primaryImageUrl || null,
                  },
                ],
              }),
              reactionsCount: post.metrics?.reactions || 0,
              commentsCount: post.metrics?.comments || 0,
              sharesCount: post.metrics?.shares || 0,
              viewsCount: post.metrics?.views || 0,
              analysisJson: JSON.stringify(analysis),
            },
          });
        }
      } catch (saveErr) {
        console.warn('[Analyze Post API] DB save error:', saveErr);
      }
    }

    // Step 4: Build WhatsApp message formats
    const { fullMessage, parts } = formatPostAnalysisForWhatsApp(post, analysis);

    return NextResponse.json({
      success: true,
      model_used: 'gemini-3.8-flash',
      from_cache: fromCache,
      post: {
        id: post.id,
        page_id: post.pageId,
        page_name: post.pageName,
        message: post.message,
        permalink_url: post.permalinkUrl,
        media_type: post.mediaType,
        primary_image_url: post.media?.primaryImageUrl || null,
        video_url: post.media?.videoUrl || null,
        metrics: post.metrics,
      },
      analysis,
      formatted_message: fullMessage,
      formatted_message_parts: parts,
      created_at: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Analyze Post API Error]:', error);
    let userFriendlyMessage = error.message || 'حدث خطأ أثناء تحليل البوست';
    if (error.message?.includes('429') || error.message?.includes('RESOURCE_EXHAUSTED')) {
      userFriendlyMessage = 'سيرفرات الذكاء الاصطناعي عليها ضغط لحظي، برجاء إعادة المحاولة بعد ثوانٍ قليلة.';
    }
    return NextResponse.json({ success: false, error: userFriendlyMessage }, { status: 500 });
  }
}

export async function GET(req: Request) {
  if (!validateApiKey(req)) {
    return NextResponse.json(
      { success: false, error: 'غير مصرّح: برجاء إرسال مفتاح الـ API الصحيح في x-api-key' },
      { status: 401 }
    );
  }

  try {
    const url = new URL(req.url);
    const postUrl = url.searchParams.get('post_url') || url.searchParams.get('url') || url.searchParams.get('postId') || '';
    const forceRefresh = url.searchParams.get('force_refresh') === 'true' || url.searchParams.get('refresh') === 'true';

    if (!postUrl) {
      return NextResponse.json(
        { success: false, error: 'برجاء تمرير رابط المنشور في query parameter باسم post_url' },
        { status: 400 }
      );
    }

    const forwardReq = new Request(req.url, {
      method: 'POST',
      headers: req.headers,
      body: JSON.stringify({ post_url: postUrl, force_refresh: forceRefresh }),
    });

    return await POST(forwardReq);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
