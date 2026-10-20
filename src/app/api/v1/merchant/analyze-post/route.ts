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
  // Determine media & dynamic visual label (الفيديو أو التصميم)
  const isVideo =
    post.mediaType === 'VIDEO' ||
    analysis.creative_analysis?.format_detected?.includes('فيديو') ||
    Boolean(post.media?.videoUrl);
  const visualTypeLabel = analysis.visual_score_label || (isVideo ? 'الفيديو' : 'التصميم');

  let formatLabel = isVideo ? 'فيديو / ريلز' : 'صورة / تصميم';
  if (post.mediaType === 'CAROUSEL') formatLabel = 'كاروسيل';
  else if (post.mediaType === 'TEXT') formatLabel = 'نص فقط';

  // Decision label
  let decision = analysis.verdict?.decision_label || analysis.verdict?.status_label;
  if (!decision) {
    decision = analysis.verdict?.is_suitable ? '🟢 جاهز للتمويل فوراً' : '🟡 جاهز بعد تعديل بسيط';
  }
  decision = decision.replace(/^\[|\]$/g, '').trim();

  // ── الجزء الأول: فحص الكريتيف والمحتوى ──
  let part1 = `🎯 *تقرير التحليل الإعلاني للبوست* 📊\n`;
  part1 += `📌 *الصفحة:* ${post.pageName || 'صفحة تابعة للعميل'}\n`;
  part1 += `🎬 *نوع المحتوى:* ${formatLabel}\n`;
  part1 += `📊 *التفاعلات المرصودة:* 👍 ${post.metrics?.reactions || 0} | 💬 ${post.metrics?.comments || 0} | 🔄 ${post.metrics?.shares || 0}\n`;
  part1 += `══════════════════════════\n`;
  part1 += `🏆 *التقييم الرقمي السريع:*\n`;
  part1 += `⭐ *التقييم العام:* [${analysis.observed_score} / 10] | ✍️ *المحتوى:* [${analysis.copy_score} / 10] | 🎨 *${visualTypeLabel}:* [${analysis.visual_score} / 10]\n`;
  part1 += `⚖️ *القرار:* [${decision}]\n\n`;

  part1 += `👁️ *فحص الكريتيف (${visualTypeLabel}):*\n`;
  part1 += `• *الهوك في أول 3 ثواني:* ${analysis.creative_analysis?.visual_hooks || 'جيد ومناسب'}.\n`;
  part1 += `• *نقطة القوة الأساسية:* ${analysis.creative_analysis?.primary_strength || analysis.creative_analysis?.strengths?.[0] || 'وضوح الفكرة وطريقة العرض'}.\n`;

  const recs = analysis.creative_analysis?.actionable_recommendations || [];
  if (recs.length > 0) {
    part1 += `• *التعديل المطلوب فوراً:*\n`;
    recs.forEach((rec: string, idx: number) => {
      const cleanRec = rec.replace(/^(\d+[\.\-\)]|\d+️⃣|\•|\-)\s*/, '').trim();
      part1 += `  ${idx + 1}️⃣ ${cleanRec}\n`;
    });
    part1 += `\n`;
  } else {
    part1 += `• *التعديل المطلوب فوراً:* لا يوجد تعديل إلزامي، البوست جاهز للإطلاق فوراً.\n\n`;
  }

  part1 += `✍️ *تقييم المحتوى الإعلاني:*\n`;
  const hookAndOffer =
    analysis.copy_analysis?.hook_and_offer_evaluation ||
    `${analysis.copy_analysis?.hook_evaluation || ''} ${analysis.copy_analysis?.offer_evaluation || ''}`.trim() ||
    'الهوك والعرض مباشر ومفهوم للجمهور المستهدف.';
  part1 += `• *قوة الهوك والعرض:* ${hookAndOffer}\n`;
  part1 += `• *التوجيه (Call To Action):* ${analysis.copy_analysis?.cta_evaluation || 'واضح ومباشر للتواصل.'}`;

  // ── الجزء الثاني: خطة الميديا باينج والاستهداف ──
  let part2 = `🎯 *خطة الاستهداف واستراتيجية الميديا باير* 🚀\n`;
  part2 += `══════════════════════════\n`;
  part2 += `👥 *الجمهور والاستهداف الدقيق (الأهم):*\n`;
  part2 += `• *السن المقترح:* [${analysis.targeting_suggestions?.age_range || '24 - 45 سنة'}]\n`;
  part2 += `• *النوع:* [${analysis.targeting_suggestions?.gender || 'الجميع'}]\n`;
  part2 += `• *الاهتمامات الدقيقة المباشرة (Meta Ads Interests):*\n`;

  const interests = analysis.targeting_suggestions?.detailed_interests || [];
  if (Array.isArray(interests) && interests.length > 0) {
    interests.forEach((item: any) => {
      if (typeof item === 'object' && item !== null && item.interest) {
        part2 += `  🎯 [${item.interest}] - ${item.reason || ''}\n`;
      } else {
        part2 += `  🎯 [${String(item)}]\n`;
      }
    });
  } else {
    part2 += `  🎯 [Online shopping] - استهداف مباشر للجمهور الأكثر شراءً وتفاعلاً\n`;
  }

  const behaviors = analysis.targeting_suggestions?.behaviors || 'Engaged Shoppers';
  const placements =
    analysis.targeting_suggestions?.placements ||
    (isVideo ? 'Instagram Reels, Facebook Reels, Feeds' : 'Feeds, Facebook Reels, Instagram Stories');
  part2 += `• *السلوكيات (Behaviors):* [${behaviors}]\n`;
  part2 += `• *مواضع الظهور الفعالة (Placements):* [${placements}]\n`;
  part2 += `══════════════════════════\n`;

  const objective = analysis.campaign_strategy?.recommended_objective || 'رسائل واتساب / Leads';
  const goldenTip =
    analysis.campaign_strategy?.media_buyer_golden_tip ||
    'ركز على سرعة الرد اللحظي على الرسائل لرفع معدل التحويل وخفض تكلفة الطلب.';

  part2 += `💼 *إعدادات الحملة المقترحة:*\n`;
  part2 += `• *الهدف الإعلاني (Objective):* [${objective}]\n\n`;

  part2 += `🌟 *الزتونة ونصيحة الميديا باير:*\n`;
  part2 += `"${goldenTip}"\n\n`;
  part2 += `══════════════════════════\n`;
  part2 += `💡 *تريد تجربة زاوية أخرى؟* اكتب "استهداف بديل" لعرض جمهور بديل للاختبار (A/B Test).`;

  // ── الجزء الثالث: زاوية الاستهداف البديلة (A/B Test) ──
  let part3 = '';
  if (analysis.alternative_targeting) {
    const alt = analysis.alternative_targeting;
    part3 += `🎯 *زاوية استهداف بديلة (A/B Testing)* 🔄\n`;
    part3 += `💡 *الزاوية:* ${alt.angle_name || 'زاوية تسويقية بديلة'}\n`;
    if (alt.angle_rationale) {
      part3 += `📌 *الفكرة والسبب:* ${alt.angle_rationale}\n`;
    }
    part3 += `══════════════════════════\n`;
    part3 += `👥 *الجمهور المقترح:*\n`;
    part3 += `• *السن المقترح:* [${alt.age_range || '24 - 45 سنة'}]\n`;
    part3 += `• *النوع:* [${alt.gender || 'الجميع'}]\n`;
    part3 += `• *الاهتمامات البديلة (Meta Ads Interests):*\n`;

    const altInterests = alt.detailed_interests || [];
    if (Array.isArray(altInterests) && altInterests.length > 0) {
      altInterests.forEach((item: any) => {
        if (typeof item === 'object' && item !== null && item.interest) {
          part3 += `  🎯 [${item.interest}] - ${item.reason || ''}\n`;
        } else {
          part3 += `  🎯 [${String(item)}]\n`;
        }
      });
    } else {
      part3 += `  🎯 [Online shopping] - استهداف بديل للشراء والتفاعل\n`;
    }

    if (alt.behaviors) {
      part3 += `• *السلوكيات المقترحة:* [${alt.behaviors}]\n`;
    }
    if (alt.placements) {
      part3 += `• *المواضع الفعالة:* [${alt.placements}]\n`;
    }
    part3 += `══════════════════════════\n`;
    part3 += `🌟 *نصيحة الاختبار:* قم بتشغيل هذا الاستهداف في مجموعة إعلانية (Ad Set) مستقلة لمقارنة تكلفة الرسالة ومعدل التحويل مع الاستهداف الأساسي.`;
    part3 = part3.trim();
  }

  const parts = [part1.trim(), part2.trim()];
  if (part3) {
    parts.push(part3);
  }

  const fullMessage = parts.join('\n\n══════════════════════════════\n\n');
  return { fullMessage, parts };
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
    const requestedAngle = String(body.angle || body.view || '').toLowerCase().trim();
    const isAltAngle = requestedAngle === 'alternative' || requestedAngle === 'alt' || requestedAngle.includes('بديل');
    const activeFormattedMessage = isAltAngle && parts[2] ? parts[2] : fullMessage;

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
      formatted_message: activeFormattedMessage,
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
    const angle = url.searchParams.get('angle') || url.searchParams.get('view') || '';

    if (!postUrl) {
      return NextResponse.json(
        { success: false, error: 'برجاء تمرير رابط المنشور في query parameter باسم post_url' },
        { status: 400 }
      );
    }

    const forwardReq = new Request(req.url, {
      method: 'POST',
      headers: req.headers,
      body: JSON.stringify({ post_url: postUrl, force_refresh: forceRefresh, angle }),
    });

    return await POST(forwardReq);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
