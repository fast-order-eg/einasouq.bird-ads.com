import { NextResponse } from 'next/server';
import metaClient from '@/lib/meta';
import prisma from '@/lib/db';

export async function POST(req: Request) {
  try {
    const { accountId } = await req.json();

    if (!accountId) {
      return NextResponse.json({ success: false, error: 'معرف الحساب الإعلاني مطلوب' }, { status: 400 });
    }

    const formattedExternalId = accountId.startsWith('act_') ? accountId : `act_${accountId}`;
    const cleanId = accountId.replace(/^act_/, '');

    // 1. Fetch fresh balance from Meta
    const result = await metaClient.getSingleAccountBalance(cleanId);
    if (!result.success || !result.account) {
      return NextResponse.json({ success: false, error: result.error || 'تعذر جلب رصيد الحساب من فيسبوك' }, { status: 500 });
    }

    const acc = result.account;
    const availableFunds = acc.available_funds || '0.00';
    const amountSpent = acc.amount_spent || '0';
    const accountStatus = acc.account_status || 1;

    // 2. Update Database (MetaAsset)
    try {
      const asset = await prisma.metaAsset.findFirst({
        where: {
          OR: [
            { externalId: formattedExternalId },
            { externalId: cleanId },
          ],
        },
      });

      if (asset) {
        let meta: any = {};
        if (asset.metadataJson) {
          try {
            meta = JSON.parse(asset.metadataJson);
          } catch (e) {}
        }

        meta.available_funds = availableFunds;
        meta.amount_spent = amountSpent;
        meta.account_status = accountStatus;
        meta.balance_updated_at = new Date().toISOString();

        await prisma.metaAsset.update({
          where: { id: asset.id },
          data: {
            metadataJson: JSON.stringify(meta),
            updatedAt: new Date(),
          },
        });
      }
    } catch (dbErr) {
      console.error('[Refresh Balance API] Error updating DB:', dbErr);
    }

    return NextResponse.json({
      success: true,
      accountId: cleanId,
      available_funds: availableFunds,
      amount_spent: amountSpent,
      account_status: accountStatus,
      updatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[Refresh Balance API] Error:', err);
    return NextResponse.json({ success: false, error: err.message || 'خطأ في الخادم' }, { status: 500 });
  }
}
