import { NextResponse } from 'next/server';
import { pageAnalysisProvider } from '@/lib/page-analysis-provider';
import metaClient from '@/lib/meta';
import vertexAI from '@/lib/vertex';
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

function formatPageAuditForWhatsApp(
  pageName: string,
  pageMetrics: any,
  reportMarkdown: string
): { executiveSummary: string; parts: string[] } {
  const followersCount = pageMetrics?.followersCount || pageMetrics?.fanCount;
  const followersFormatted = followersCount !== undefined ? `${followersCount.toLocaleString()} متابع` : 'غير محدد';
  const ratingsCount = pageMetrics?.ratings?.ratingCount || 0;
  const ratingPercent = pageMetrics?.ratings?.recommendationPercent || (ratingsCount ? 100 : 0);

  // ── Part 1: فحص الهوية والبنية التحتية ──
  let part1 = `🏢 *تقرير الفحص والجاهزية الإعلانية الشامل للصفحة* 🦅\n`;
  part1 += `📌 *اسم الصفحة:* ${pageName}\n`;
  part1 += `👥 *الجمهور والمتابعين:* ${followersFormatted}\n`;
  part1 += `🏷️ *التصنيف:* ${pageMetrics?.category || 'عام'}\n`;
  part1 += `══════════════════════════\n`;
  part1 += `🔍 *فحص عناصر الهوية والبنية التحتية:*\n`;
  part1 += `• صورة الحساب (Logo): ${pageMetrics?.hasLogo ? 'متوفرة ✅' : 'غير متوفرة ❌'}\n`;
  part1 += `• صورة الغلاف (Cover): ${pageMetrics?.hasCover ? 'متوفرة ومربوطة ✅' : 'غير متوفرة ❌'}\n`;
  part1 += `• البايو والوصف (About): ${pageMetrics?.bio || pageMetrics?.about ? 'مكتوب ومكتمل ✅' : 'غير مسجل ⚠️'}\n`;
  part1 += `• زر ورقم الواتساب: ${pageMetrics?.phone || pageMetrics?.whatsapp ? `مفعل (${pageMetrics.phone || pageMetrics.whatsapp}) ✅` : 'غير مفعل ❌'}\n`;
  part1 += `• الموقع الإلكتروني: ${pageMetrics?.website ? `موجود (${pageMetrics.website}) ✅` : 'غير متوفر ⚠️'}\n`;
  part1 += `• المقر / العنوان: ${pageMetrics?.address || pageMetrics?.singleLineAddress ? `مسجل (${pageMetrics.address || pageMetrics.singleLineAddress}) ✅` : 'غير محدد ⚠️'}\n`;
  part1 += `• ربط انستجرام: ${pageMetrics?.instagramConnected ? `${pageMetrics.instagramConnected} ✅` : 'غير متصل ⚠️'}\n`;

  // ── Part 2: الدليل الاجتماعي وملخص تقييم الذكاء الاصطناعي ──
  let part2 = `⭐ *الدليل الاجتماعي والتحليل الاستراتيجي* 📊\n`;
  part2 += `══════════════════════════\n`;
  part2 += `• *عدد التقييمات المرصودة:* ${ratingsCount} تقييم\n`;
  if (ratingsCount > 0) {
    part2 += `• *نسبة التوصية الإيجابية:* ${ratingPercent}% ⭐⭐⭐⭐⭐\n`;
  }

  // Extract key summary points from the generated markdown if available
  part2 += `\n💡 *ملاحظات الخبير الإعلاني والجاهزية:*\n`;
  // Take first 1000 characters of report for quick read
  const cleanSnippet = reportMarkdown
    .replace(/^#+\s+/gm, '')
    .replace(/\*\*/g, '*')
    .replace(/```[\s\S]*?```/g, '')
    .slice(0, 1200)
    .trim();

  part2 += `${cleanSnippet}...\n`;

  // ── Part 3: التوصيات وخطة العمل للميديا باير ──
  let part3 = `🚀 *خطة العمل الفورية لزيادة المبيعات* 💼\n`;
  part3 += `══════════════════════════\n`;
  part3 += `1️⃣ *قبل تشغيل الإعلانات الممولة:* تأكد من ضبط الواتساب بيزنس والردود السريعة وتثبيت منشور العرض الأقوى (Pinned Post).\n`;
  part3 += `2️⃣ *تحسين معدل التحويل (CRO):* أضف تجارب وآراء حقيقية لعملائك السابقين في بوستات ومقاطع ريلز.\n`;
  part3 += `3️⃣ *فحص كل بوست منفرد:* استخدم ميزة فحص البوست الفردي لتحديد المنشور الأنسب والأقل تكلفة للتمويل.\n\n`;
  part3 += `📄 *التقرير التحليلي المفصل الكامل محفوظ ومتاح كـ Markdown بالكامل عبر الـ API.*`;

  const executiveSummary = `${part1}\n${part2}\n${part3}`;
  return { executiveSummary, parts: [part1.trim(), part2.trim(), part3.trim()] };
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
    const rawTarget = body.page_id || body.pageId || body.page_name || body.pageName || body.url || '';
    const forceRefresh = Boolean(body.force_refresh || body.forceRefresh);

    if (!rawTarget || !String(rawTarget).trim()) {
      return NextResponse.json(
        { success: false, error: 'برجاء إرسال معرف الصفحة أو اسمها أو رابطها في حقل page_id' },
        { status: 400 }
      );
    }

    // Step 1: Safe Page Identity Resolution
    const identity = await pageAnalysisProvider.resolveFacebookPageInput(String(rawTarget).trim());
    const targetId = identity.resolvedPageId || identity.extractedSlug;
    const targetName = identity.pageName || targetId;

    // Step 2: Check cached audit report in DB if not force-refreshing
    if (!forceRefresh && (identity.resolvedPageId || identity.pageName)) {
      try {
        const cachedAsset = await prisma.metaAsset.findFirst({
          where: {
            OR: [
              ...(identity.resolvedPageId ? [{ externalId: identity.resolvedPageId }] : []),
              ...(identity.pageName ? [{ name: identity.pageName }] : []),
            ],
          },
        });

        if (cachedAsset?.auditReport) {
          let cachedMeta: any = {};
          try {
            if (cachedAsset.metadataJson) cachedMeta = JSON.parse(cachedAsset.metadataJson);
          } catch {}

          const { executiveSummary, parts } = formatPageAuditForWhatsApp(
            cachedAsset.name,
            { ...cachedMeta, fanCount: cachedAsset.fanCount },
            cachedAsset.auditReport
          );

          return NextResponse.json({
            success: true,
            model_used: 'gemini-3.8-flash',
            from_cache: true,
            page_info: {
              id: cachedAsset.externalId,
              name: cachedAsset.name,
              category: cachedAsset.category,
              fan_count: cachedAsset.fanCount,
              has_logo: Boolean(cachedMeta.pictureUrl),
              has_cover: Boolean(cachedMeta.coverUrl),
              phone: cachedMeta.phone || null,
              whatsapp: cachedMeta.whatsappNumber || null,
              website: cachedMeta.website || null,
            },
            report_markdown: cachedAsset.auditReport,
            formatted_message: executiveSummary,
            formatted_message_parts: parts,
            generated_at: cachedAsset.auditReportDate ? cachedAsset.auditReportDate.toISOString() : new Date().toISOString(),
          });
        }
      } catch (cacheErr) {
        console.warn('[Analyze Page API] DB cache read error:', cacheErr);
      }
    }

    // Step 3: Fetch Full Audit Snapshot (Cover, Logo, Bio, Phone, WhatsApp, Website, Address, Ratings)
    let enrichedMetrics: any = {
      category: 'عام',
      hasLogo: false,
      hasCover: false,
    };

    if (identity.resolvedPageId) {
      try {
        const snapshot = await metaClient.getPageFullAuditSnapshot(identity.resolvedPageId);
        if (snapshot) {
          enrichedMetrics = {
            ...snapshot,
            hasLogo: Boolean(snapshot.pictureUrl || (snapshot as any).logoUrl),
            hasCover: Boolean(snapshot.coverUrl),
            phone: snapshot.phone || snapshot.whatsappNumber,
            whatsapp: snapshot.whatsappNumber || snapshot.phone,
          };
        }
      } catch (snapErr) {
        console.warn('[Analyze Page API] Snapshot fetch error:', snapErr);
      }
    }

    // Step 4: Fetch recent posts for content evaluation
    let samplePosts: Array<{ text: string; date?: string; format?: string; engagement?: string }> = [];

    if (identity.resolvedPageId) {
      try {
        const dbPosts = await prisma.pagePost.findMany({
          where: { asset: { externalId: identity.resolvedPageId } },
          orderBy: { createdTime: 'desc' },
          take: 15,
        });

        if (dbPosts.length > 0) {
          samplePosts = dbPosts.map((p) => ({
            text: p.message || '',
            date: p.createdTime ? p.createdTime.toISOString().split('T')[0] : undefined,
            format: p.postType || 'POST',
            engagement: `👍 ${p.reactionsCount || 0} | 💬 ${p.commentsCount || 0}`,
          }));
        } else {
          const livePostsRes = await pageAnalysisProvider.getAuthorizedFacebookPagePosts(
            identity.resolvedPageId,
            identity.accessToken,
            { limit: 15 }
          );
          if (livePostsRes.success && livePostsRes.records.length > 0) {
            samplePosts = livePostsRes.records.map((r) => ({
              text: r.text || '',
              date: r.publishedAt ? r.publishedAt.split('T')[0] : undefined,
              format: r.mediaType,
              engagement: `👍 ${r.availableInteractionMetrics?.reactionsCount || 0} | 💬 ${r.availableInteractionMetrics?.commentsCount || 0}`,
            }));
          }
        }
      } catch (postsErr) {
        console.warn('[Analyze Page API] Posts collection error:', postsErr);
      }
    }

    // Step 5: Generate Comprehensive Page Readiness Audit via Gemini 3.8 Flash
    const reportMarkdown = await vertexAI.generateCompetitorReport(
      targetName,
      samplePosts,
      enrichedMetrics
    );

    // Save report in MySQL DB
    try {
      await prisma.metaAsset.updateMany({
        where: {
          OR: [
            ...(identity.resolvedPageId ? [{ externalId: identity.resolvedPageId }] : []),
            { name: targetName },
          ],
        },
        data: {
          auditReport: reportMarkdown,
          auditReportDate: new Date(),
        },
      });
    } catch (saveErr) {
      console.warn('[Analyze Page API] DB save error:', saveErr);
    }

    // Step 6: Build WhatsApp message formats
    const { executiveSummary, parts } = formatPageAuditForWhatsApp(
      targetName,
      enrichedMetrics,
      reportMarkdown
    );

    return NextResponse.json({
      success: true,
      model_used: 'gemini-3.8-flash',
      from_cache: false,
      page_info: {
        id: identity.resolvedPageId || null,
        name: targetName,
        category: enrichedMetrics.category,
        fan_count: enrichedMetrics.fanCount || enrichedMetrics.followersCount || 0,
        followers_count: enrichedMetrics.followersCount || enrichedMetrics.fanCount || 0,
        has_logo: Boolean(enrichedMetrics.hasLogo),
        has_cover: Boolean(enrichedMetrics.hasCover),
        phone: enrichedMetrics.phone || null,
        whatsapp: enrichedMetrics.whatsapp || null,
        website: enrichedMetrics.website || null,
        address: enrichedMetrics.address || null,
        ratings: enrichedMetrics.ratings || null,
      },
      report_markdown: reportMarkdown,
      formatted_message: executiveSummary,
      formatted_message_parts: parts,
      generated_at: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Analyze Page API Error]:', error);
    let userFriendlyMessage = error.message || 'حدث خطأ أثناء تحليل الصفحة';
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
    const pageId = url.searchParams.get('page_id') || url.searchParams.get('id') || url.searchParams.get('page_name') || '';
    const forceRefresh = url.searchParams.get('force_refresh') === 'true' || url.searchParams.get('refresh') === 'true';

    if (!pageId) {
      return NextResponse.json(
        { success: false, error: 'برجاء تمرير معرف أو اسم الصفحة في query parameter باسم page_id' },
        { status: 400 }
      );
    }

    const forwardReq = new Request(req.url, {
      method: 'POST',
      headers: req.headers,
      body: JSON.stringify({ page_id: pageId, force_refresh: forceRefresh }),
    });

    return await POST(forwardReq);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
