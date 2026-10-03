import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { businessId, status } = body;

    if (!businessId || !status) {
      return NextResponse.json(
        { success: false, error: 'معرف مدير الأعمال والحالة مطلوبان' },
        { status: 400 }
      );
    }

    if (status !== 'ACTIVE' && status !== 'RESTRICTED') {
      return NextResponse.json(
        { success: false, error: 'الحالة يجب أن تكون إما ACTIVE أو RESTRICTED' },
        { status: 400 }
      );
    }

    const cleanId = String(businessId).trim();

    const existing = await prisma.metaAsset.findFirst({
      where: {
        assetType: 'BUSINESS',
        externalId: cleanId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'مدير الأعمال غير موجود في قاعدة البيانات' },
        { status: 404 }
      );
    }

    let meta: any = {};
    try {
      if (existing.metadataJson) meta = JSON.parse(existing.metadataJson);
    } catch (e) {}

    meta.custom_status = status;
    meta.status_updated_at = new Date().toISOString();

    await prisma.metaAsset.update({
      where: { id: existing.id },
      data: {
        metadataJson: JSON.stringify(meta),
      },
    });

    return NextResponse.json({
      success: true,
      businessId: cleanId,
      status,
      updatedAt: meta.status_updated_at,
    });
  } catch (err: any) {
    console.error('[Toggle Business Status Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'خطأ في الخادم' },
      { status: 500 }
    );
  }
}
