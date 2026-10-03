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

    if (status !== 'ACTIVE' && status !== 'ASSETS_RESTRICTED' && status !== 'RESTRICTED') {
      return NextResponse.json(
        { success: false, error: 'الحالة يجب أن تكون ACTIVE أو ASSETS_RESTRICTED أو RESTRICTED' },
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
    meta.status = status;
    meta.status_updated_at = new Date().toISOString();

    await prisma.metaAsset.update({
      where: { id: existing.id },
      data: {
        metadataJson: JSON.stringify(meta),
      },
    });

    // Also update all linked AD_ACCOUNT records in DB
    try {
      const allAccounts = await prisma.metaAsset.findMany({
        where: { assetType: 'AD_ACCOUNT' },
      });
      const bizAccounts = Array.isArray(meta.ad_accounts) ? meta.ad_accounts : [];
      for (const acc of allAccounts) {
        if (!acc.metadataJson) continue;
        try {
          const accMeta = JSON.parse(acc.metadataJson);
          const cleanAccId = acc.externalId.replace(/^act_/, '');
          const isLinked = accMeta.business?.id === cleanId ||
            bizAccounts.some((x: any) => String(x.id || x.account_id).replace(/^act_/, '') === cleanAccId);
          if (isLinked) {
            accMeta.business = {
              ...(accMeta.business || {}),
              id: cleanId,
              name: existing.name,
              status,
              verification_status: meta.verification_status || 'not_verified',
            };
            await prisma.metaAsset.update({
              where: { id: acc.id },
              data: { metadataJson: JSON.stringify(accMeta) },
            });
          }
        } catch (e) {}
      }
    } catch (accErr) {
      console.error('[Toggle Business Status] Error updating linked accounts:', accErr);
    }

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
