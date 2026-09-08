import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const mediaType = searchParams.get('mediaType');
    const search = searchParams.get('search');

    const where: any = {};

    if (category && category !== 'ALL') {
      where.category = category;
    }

    if (mediaType && mediaType !== 'ALL') {
      where.mediaType = mediaType;
    }

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { customTitle: { contains: q } },
        { pageName: { contains: q } },
        { primaryText: { contains: q } },
        { notes: { contains: q } },
        { category: { contains: q } },
      ];
    }

    const favorites = await prisma.favoriteAd.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    const categories = await prisma.favoriteAd.findMany({
      select: { category: true },
      distinct: ['category'],
    });

    return NextResponse.json({
      success: true,
      count: favorites.length,
      categories: categories.map((c) => c.category).filter(Boolean),
      favorites: favorites.map((fav) => ({
        ...fav,
        images: fav.imagesJson ? JSON.parse(fav.imagesJson) : (fav.imageUrl ? [fav.imageUrl] : []),
        publisherPlatforms: fav.publisherPlatforms ? JSON.parse(fav.publisherPlatforms) : ['Facebook', 'Instagram'],
        analysis: fav.analysisJson ? JSON.parse(fav.analysisJson) : null,
      })),
    });
  } catch (error: any) {
    console.error('[API /api/favorites GET Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      adLibraryId,
      customTitle,
      category = 'عام',
      pageName,
      pageProfileUrl,
      primaryText,
      startDate,
      formattedStartDate,
      daysActiveLabel,
      status = 'ACTIVE',
      mediaType = 'IMAGE',
      imageUrl,
      images = [],
      videoUrl,
      ctaType,
      ctaLabel,
      snapshotUrl,
      publisherPlatforms = ['Facebook', 'Instagram'],
      country = 'EG',
      analysis,
      notes,
    } = body;

    if (!adLibraryId || !pageName) {
      return NextResponse.json({ success: false, error: 'بيانات الإعلان غير مكتملة' }, { status: 400 });
    }

    const imagesJson = Array.isArray(images) && images.length > 0 ? JSON.stringify(images) : (imageUrl ? JSON.stringify([imageUrl]) : null);
    const platformsJson = Array.isArray(publisherPlatforms) ? JSON.stringify(publisherPlatforms) : null;
    const analysisJson = analysis ? JSON.stringify(analysis) : null;

    const existing = await prisma.favoriteAd.findFirst({ where: { adLibraryId } });

    let favorite;
    if (existing) {
      favorite = await prisma.favoriteAd.update({
        where: { id: existing.id },
        data: {
          customTitle: customTitle || existing.customTitle,
          category: category || existing.category,
          notes: notes !== undefined ? notes : existing.notes,
          analysisJson: analysisJson || existing.analysisJson,
          updatedAt: new Date(),
        },
      });
    } else {
      favorite = await prisma.favoriteAd.create({
        data: {
          adLibraryId,
          customTitle: customTitle || `${pageName} - ${category}`,
          category: category || 'عام',
          pageName,
          pageProfileUrl: pageProfileUrl || null,
          primaryText: primaryText || '',
          startDate: startDate || null,
          formattedStartDate: formattedStartDate || null,
          daysActiveLabel: daysActiveLabel || null,
          status,
          mediaType,
          imageUrl: imageUrl || null,
          imagesJson,
          videoUrl: videoUrl || null,
          ctaType: ctaType || null,
          ctaLabel: ctaLabel || null,
          snapshotUrl: snapshotUrl || `https://www.facebook.com/ads/library/?id=${adLibraryId}`,
          publisherPlatforms: platformsJson,
          country,
          analysisJson,
          notes: notes || null,
        },
      });
    }

    return NextResponse.json({
      success: true,
      favorite,
      message: 'تم حفظ الإعلان في المفضلة بنجاح ⭐',
    });
  } catch (error: any) {
    console.error('[API /api/favorites POST Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const adLibraryId = searchParams.get('adLibraryId');

    if (!id && !adLibraryId) {
      return NextResponse.json({ success: false, error: 'معرف الإعلان مطلوب للحذف' }, { status: 400 });
    }

    if (id) {
      await prisma.favoriteAd.delete({ where: { id } });
    } else if (adLibraryId) {
      const existing = await prisma.favoriteAd.findFirst({ where: { adLibraryId } });
      if (existing) {
        await prisma.favoriteAd.delete({ where: { id: existing.id } });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'تم حذف الإعلان من المفضلة بنجاح',
    });
  } catch (error: any) {
    console.error('[API /api/favorites DELETE Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
