import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function POST(req: Request) {
  try {
    const { accountId, isExcluded } = await req.json();

    if (!accountId) {
      return NextResponse.json({ success: false, error: 'معرف الحساب الإعلاني مطلوب' }, { status: 400 });
    }

    const formattedExternalId = accountId.startsWith('act_') ? accountId : `act_${accountId}`;
    const cleanId = accountId.replace(/^act_/, '');

    const asset = await prisma.metaAsset.findFirst({
      where: {
        OR: [
          { externalId: formattedExternalId },
          { externalId: cleanId },
        ],
      },
    });

    if (!asset) {
      return NextResponse.json({ success: false, error: 'الحساب غير مسجل في قاعدة البيانات' }, { status: 404 });
    }

    let meta: any = {};
    if (asset.metadataJson) {
      try {
        meta = JSON.parse(asset.metadataJson);
      } catch (e) {}
    }

    meta.is_excluded = Boolean(isExcluded);

    await prisma.metaAsset.update({
      where: { id: asset.id },
      data: {
        metadataJson: JSON.stringify(meta),
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      accountId: cleanId,
      is_excluded: meta.is_excluded,
    });
  } catch (err: any) {
    console.error('[Toggle Exclusion API] Error:', err);
    return NextResponse.json({ success: false, error: err.message || 'خطأ في الخادم' }, { status: 500 });
  }
}
