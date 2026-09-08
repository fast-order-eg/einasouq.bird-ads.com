import { NextResponse } from 'next/server';
import vertexAI from '@/lib/vertex';
import prisma from '@/lib/db';
import metaClient from '@/lib/meta';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { pageId, competitorName, ads = [], pageMetrics, forceRefresh = false } = body;

    if (!competitorName && !pageId) {
      return NextResponse.json({ success: false, error: 'اسم الصفحة أو المعرف مطلوب' }, { status: 400 });
    }

    const targetName = competitorName || pageId;

    // 1. Check if an audit report already exists in DB for this page (if not force-refreshing)
    if (pageId && !forceRefresh) {
      try {
        const asset = await prisma.metaAsset.findFirst({
          where: {
            OR: [
              { externalId: pageId },
              { name: targetName }
            ]
          }
        });

        if (asset?.auditReport) {
          return NextResponse.json({
            success: true,
            modelUsed: 'gemini-2.5-pro (محفوظ من قاعدة البيانات)',
            report: asset.auditReport,
            generatedAt: asset.auditReportDate ? asset.auditReportDate.toISOString() : new Date().toISOString(),
            fromDb: true,
          });
        }
      } catch (dbErr) {
        console.warn('DB read audit error:', dbErr);
      }
    }

    // 2. Fetch full snapshot (Cover, Logo, Website, WhatsApp, Address, Reviews) if pageId is present
    let enrichedMetrics = { ...pageMetrics };
    if (pageId) {
      try {
        const snapshot = await metaClient.getPageFullAuditSnapshot(pageId);
        if (snapshot) {
          enrichedMetrics = {
            ...snapshot,
            ...enrichedMetrics,
            coverUrl: snapshot.coverUrl || enrichedMetrics.coverUrl,
            pictureUrl: snapshot.pictureUrl || enrichedMetrics.pictureUrl || enrichedMetrics.logoUrl,
            hasLogo: Boolean(snapshot.pictureUrl || enrichedMetrics.logoUrl || enrichedMetrics.pictureUrl),
            hasCover: Boolean(snapshot.coverUrl || enrichedMetrics.coverUrl),
            website: snapshot.website || enrichedMetrics.website,
            phone: snapshot.phone || enrichedMetrics.phone,
            whatsapp: snapshot.whatsappNumber || enrichedMetrics.whatsapp || snapshot.phone,
            address: snapshot.address || enrichedMetrics.address,
            ratings: snapshot.ratings || enrichedMetrics.ratings,
          };
        }
      } catch (e) {
        console.warn('[Report Generate] Snapshot enrich error:', e);
      }
    }

    // 3. Generate with Gemini 2.5 Pro Multimodal
    const reportMarkdown = await vertexAI.generateCompetitorReport(targetName, ads, enrichedMetrics);

    // 3. Save the generated audit report in MySQL DB
    if (pageId || targetName) {
      try {
        await prisma.metaAsset.updateMany({
          where: {
            OR: [
              ...(pageId ? [{ externalId: pageId }] : []),
              { name: targetName }
            ]
          },
          data: {
            auditReport: reportMarkdown,
            auditReportDate: new Date(),
          }
        });
      } catch (saveErr) {
        console.warn('DB save audit error:', saveErr);
      }
    }

    return NextResponse.json({
      success: true,
      modelUsed: 'gemini-2.5-pro',
      report: reportMarkdown,
      generatedAt: new Date().toISOString(),
      fromDb: false,
    });
  } catch (error: any) {
    console.error('Report Generation Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
