import { NextResponse } from 'next/server';
import { metaAdLibraryEngine, generateQueryVariants } from '@/lib/meta-ad-library';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rawQuery = body.searchTerms || body.query || '';
    const {
      country = 'EG',
      adActiveStatus = body.activeStatus || 'ACTIVE',
      mediaType = 'ALL',
      limit = 45,
    } = body;

    const cleanQuery = rawQuery.trim();
    if (!cleanQuery) {
      return NextResponse.json({
        success: false,
        error: 'برجاء إدخال كلمة مفتاحية أو اسم/رابط صفحة المنافس للبحث',
      }, { status: 400 });
    }

    const queryVariants = generateQueryVariants(cleanQuery);

    console.log(`[API /api/ads/search] Searching for "${cleanQuery}" (Country: ${country}, Status: ${adActiveStatus}, Limit: ${limit})`);

    const searchResult = await metaAdLibraryEngine.searchAds({
      query: cleanQuery,
      country,
      activeStatus: adActiveStatus === 'ALL' ? 'ALL' : 'ACTIVE',
      mediaType,
      limit: Number(limit) || 50,
    });

    const adsList = searchResult.ads || [];

    return NextResponse.json({
      success: true,
      query: {
        searchTerms: cleanQuery,
        country,
        adActiveStatus,
        mediaType,
        variants: queryVariants,
      },
      count: adsList.length,
      metaEstimatedTotal: searchResult.metaEstimatedTotal || null,
      isLiveApi: true,
      ads: adsList.map((ad) => ({
        id: ad.id,
        adLibraryId: ad.adLibraryId,
        pageId: ad.pageId || '',
        pageName: ad.pageName,
        pageProfileUrl: ad.pageProfileUrl || `https://www.facebook.com/search/pages/?q=${encodeURIComponent(ad.pageName)}`,
        startDate: ad.startDate || 'نشط حالياً',
        formattedStartDate: ad.formattedStartDate || ad.startDate || 'نشط حالياً',
        daysActive: ad.daysActive || 1,
        daysActiveLabel: ad.daysActiveLabel || 'شغال حالياً',
        firstSeen: ad.startDate || new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        status: ad.status,
        ctaType: ad.ctaType || 'NO_BUTTON',
        ctaLabel: ad.ctaLabel || 'بدون زر تفاعلي',
        publisherPlatforms: ad.publisherPlatforms,
        country: ad.country,
        primaryText: ad.primaryText,
        linkTitle: ad.linkTitle || '',
        linkCaption: ad.linkCaption || '',
        ctaText: ad.ctaLabel || ad.ctaText || 'عرض التفاصيل',
        snapshotUrl: ad.snapshotUrl,
        mediaType: ad.mediaType,
        imageUrl: ad.imageUrl,
        images: ad.images || (ad.imageUrl ? [ad.imageUrl] : []),
        videoUrl: ad.videoUrl,
        impressionsRange: 'نشط وموثق في مكتبة إعلانات فيسبوك',
        spendRange: 'تم رصده في البث العام',
        creativeStrengthScore: 8.5,
      })),
    });
  } catch (error: any) {
    console.error('[API /api/ads/search Error]:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'حدث خطأ أثناء استكشاف مكتبة الإعلانات',
    }, { status: 500 });
  }
}
