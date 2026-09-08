import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { accountId, note } = body;

    if (!accountId) {
      return NextResponse.json({ success: false, error: 'معرف الحساب الإعلاني مطلوب' }, { status: 400 });
    }

    const formattedExternalId = accountId.startsWith('act_') ? accountId : `act_${accountId}`;

    const existing = await prisma.metaAsset.findFirst({
      where: {
        OR: [
          { externalId: formattedExternalId },
          { externalId: accountId },
        ],
      },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: 'الحساب الإعلاني غير موجود في قاعدة البيانات' }, { status: 404 });
    }

    let meta: any = {};
    try {
      if (existing.metadataJson) meta = JSON.parse(existing.metadataJson);
    } catch (e) {}

    meta.note = (note || '').trim();
    meta.note_updated_at = new Date().toISOString();

    await prisma.metaAsset.update({
      where: { id: existing.id },
      data: {
        metadataJson: JSON.stringify(meta),
      },
    });

    return NextResponse.json({
      success: true,
      accountId,
      note: meta.note,
      updatedAt: meta.note_updated_at,
    });
  } catch (err: any) {
    console.error('[Account Note API Error]:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
