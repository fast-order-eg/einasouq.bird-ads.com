import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { parseAdStartDateAndDuration, detectCtaType } from '@/lib/meta-ad-library';

function isRealVideoUrl(url?: string): boolean {
  if (!url) return false;
  const clean = url.toLowerCase();
  if (clean.includes('.mp4') || clean.includes('.webm') || clean.includes('video.xx.fbcdn') || clean.includes('video_url')) {
    return true;
  }
  if (clean.includes('.jpg') || clean.includes('.jpeg') || clean.includes('.png') || clean.includes('.webp')) {
    return false;
  }
  return false;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const runId = searchParams.get('runId');
    const search = searchParams.get('search');

    // If specific run is requested, return its ads
    if (runId) {
      const searchRun = await prisma.adSearchRun.findUnique({
        where: { id: runId },
        include: {
          snapshots: {
            include: {
              ad: {
                include: {
                  analysisResults: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                  },
                },
              },
            },
          },
        },
      });

      if (!searchRun) {
        return NextResponse.json({ success: false, error: 'سجل البحث غير موجود' }, { status: 404 });
      }

      const formattedAds = searchRun.snapshots.map((snap, idx) => {
        const ad = snap.ad;
        const analysis = ad.analysisResults[0]?.rawJson ? JSON.parse(ad.analysisResults[0].rawJson) : null;

        if (snap.rawJson) {
          try {
            const parsed = JSON.parse(snap.rawJson);
            return {
              ...parsed,
              id: `db_${snap.id}_${idx}`,
              analysis: analysis || parsed.analysis,
            };
          } catch (e) {}
        }

        const { formattedDate, daysCount, label: daysActiveLabel } = parseAdStartDateAndDuration(snap.observedAt.toISOString());
        const { type: ctaType, label: ctaLabel } = detectCtaType(snap.primaryText || '', [], []);

        const mediaUrls = snap.mediaUrls ? snap.mediaUrls.split(',') : [];
        const realVideoUrl = mediaUrls.find((u) => isRealVideoUrl(u));
        const imageUrls = mediaUrls.filter((u) => !isRealVideoUrl(u));
        const mainImage = imageUrls[0] || (realVideoUrl ? undefined : mediaUrls[0]);

        return {
          id: `db_${snap.id}_${idx}`,
          adLibraryId: ad.adLibraryId,
          pageId: ad.pageId,
          pageName: ad.pageName,
          pageProfileUrl: `https://www.facebook.com/${encodeURIComponent(ad.pageName)}`,
          primaryText: snap.primaryText || '',
          startDate: snap.observedAt.toISOString().split('T')[0],
          formattedStartDate: formattedDate,
          daysActive: daysCount,
          daysActiveLabel,
          status: ad.status,
          ctaType,
          ctaLabel,
          mediaType: snap.mediaType || (realVideoUrl ? 'VIDEO' : (imageUrls.length > 1 ? 'CAROUSEL' : 'IMAGE')),
          imageUrl: mainImage,
          images: imageUrls.length > 0 ? imageUrls : (mainImage ? [mainImage] : []),
          videoUrl: realVideoUrl,
          snapshotUrl: snap.snapshotUrl || `https://www.facebook.com/ads/library/?id=${ad.adLibraryId}`,
          publisherPlatforms: ad.publisherPlatforms ? JSON.parse(ad.publisherPlatforms) : ['Facebook', 'Instagram'],
          country: ad.country,
          query: searchRun.searchTerms,
          analysis,
        };
      });

      return NextResponse.json({
        success: true,
        searchRun,
        ads: formattedAds,
      });
    }

    // List all search runs
    const where: any = {};
    if (search && search.trim()) {
      where.searchTerms = { contains: search.trim() };
    }

    const runs = await prisma.adSearchRun.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        snapshots: {
          select: {
            ad: {
              select: {
                pageName: true,
                analysisResults: { select: { id: true } },
              },
            },
          },
          take: 8,
        },
      },
    });

    // Also get all analyzed ads count & distinct analyzed ads
    const analyzedAds = await prisma.ad.findMany({
      where: {
        analysisResults: {
          some: {},
        },
      },
      include: {
        snapshots: { take: 1 },
        analysisResults: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 40,
    });

    const formattedAnalyzedAds = analyzedAds.map((ad, idx) => {
      const snap = ad.snapshots[0];
      const analysis = ad.analysisResults[0]?.rawJson ? JSON.parse(ad.analysisResults[0].rawJson) : null;

      if (snap?.rawJson) {
        try {
          const parsed = JSON.parse(snap.rawJson);
          return {
            ...parsed,
            id: `analyzed_${ad.id}_${idx}`,
            analysis: analysis || parsed.analysis,
          };
        } catch (e) {}
      }

      const { formattedDate, daysCount, label: daysActiveLabel } = parseAdStartDateAndDuration(ad.firstSeen.toISOString());
      const { type: ctaType, label: ctaLabel } = detectCtaType(snap?.primaryText || '', [], []);
      const mediaUrls = snap?.mediaUrls ? snap.mediaUrls.split(',') : [];
      const realVideoUrl = mediaUrls.find((u) => isRealVideoUrl(u));
      const imageUrls = mediaUrls.filter((u) => !isRealVideoUrl(u));
      const mainImage = imageUrls[0] || (realVideoUrl ? undefined : mediaUrls[0]);

      return {
        id: `analyzed_${ad.id}_${idx}`,
        adLibraryId: ad.adLibraryId,
        pageId: ad.pageId,
        pageName: ad.pageName,
        pageProfileUrl: `https://www.facebook.com/${encodeURIComponent(ad.pageName)}`,
        primaryText: snap?.primaryText || '',
        startDate: ad.firstSeen.toISOString().split('T')[0],
        formattedStartDate: formattedDate,
        daysActive: daysCount,
        daysActiveLabel,
        status: ad.status,
        ctaType,
        ctaLabel,
        mediaType: snap?.mediaType || (realVideoUrl ? 'VIDEO' : (imageUrls.length > 1 ? 'CAROUSEL' : 'IMAGE')),
        imageUrl: mainImage,
        images: imageUrls.length > 0 ? imageUrls : (mainImage ? [mainImage] : []),
        videoUrl: realVideoUrl,
        snapshotUrl: snap?.snapshotUrl || `https://www.facebook.com/ads/library/?id=${ad.adLibraryId}`,
        publisherPlatforms: ad.publisherPlatforms ? JSON.parse(ad.publisherPlatforms) : ['Facebook', 'Instagram'],
        country: ad.country,
        query: 'تحليل محفوظ',
        analysis,
      };
    });

    return NextResponse.json({
      success: true,
      runs: runs.map((r) => {
        const pages = Array.from(new Set(r.snapshots.map((s) => s.ad.pageName))).filter(Boolean);
        const totalAnalyzed = r.snapshots.filter((s) => s.ad.analysisResults.length > 0).length;
        return {
          id: r.id,
          searchTerms: r.searchTerms,
          countries: r.countries,
          resultCount: r.resultCount,
          executionMs: r.executionMs,
          status: r.status,
          createdAt: r.createdAt,
          samplePages: pages.slice(0, 5),
          analyzedCount: totalAnalyzed,
        };
      }),
      analyzedAds: formattedAnalyzedAds,
    });
  } catch (error: any) {
    console.error('[API /api/history GET Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'معرف السجل مطلوب' }, { status: 400 });
    }

    await prisma.adSearchRun.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: 'تم حذف سجل البحث بنجاح',
    });
  } catch (error: any) {
    console.error('[API /api/history DELETE Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
