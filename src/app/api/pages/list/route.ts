import { NextResponse } from 'next/server';
import metaClient from '@/lib/meta';
import prisma from '@/lib/db';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const forceRefresh = searchParams.get('refresh') === 'true';

    // 1. Return from MySQL Cache if available and not force-refreshing
    if (!forceRefresh) {
      const cachedPages = await prisma.metaAsset.findMany({
        where: { isAuthorized: true },
        orderBy: { name: 'asc' },
      });

      if (cachedPages && cachedPages.length > 0) {
        return NextResponse.json({
          success: true,
          fromDb: true,
          count: cachedPages.length,
          pages: cachedPages.map((p) => {
            let meta: any = {};
            try {
              if (p.metadataJson) meta = JSON.parse(p.metadataJson);
            } catch (e) {}

            return {
              id: p.externalId,
              name: p.name,
              category: p.category,
              fan_count: p.fanCount,
              access_token: p.accessToken,
              auditReport: p.auditReport,
              auditReportDate: p.auditReportDate,
              coverUrl: meta.coverUrl,
              pictureUrl: meta.pictureUrl,
              website: meta.website,
              phone: meta.phone,
              singleLineAddress: meta.singleLineAddress,
              whatsappNumber: meta.whatsappNumber,
              bio: meta.bio,
            };
          }),
        });
      }
    }

    // 2. Fetch fresh pages from Meta Graph API
    console.log('[Pages List] Fetching fresh managed pages from Meta Graph API...');
    
    // Ensure active MetaConnection exists for current user account
    let connection = await prisma.metaConnection.findFirst({
      where: { status: 'ACTIVE' },
    });

    if (!connection) {
      let ws = await prisma.workspace.findFirst();
      if (!ws) {
        ws = await prisma.workspace.create({
          data: { name: 'المساحة الرئيسية', slug: 'default-workspace' },
        });
      }
      connection = await prisma.metaConnection.create({
        data: {
          workspaceId: ws.id,
          accessToken: process.env.META_USER_TOKEN || '',
          authorizedUser: 'عبد المنعم محمد',
          businessId: '100084534720914',
          status: 'ACTIVE',
        },
      });
    }

    const metaPages = await metaClient.getManagedPages();

    // 3. Upsert pages into MySQL database
    if (metaPages && metaPages.length > 0) {
      for (const p of metaPages) {
        const metadata = {
          coverUrl: p.cover?.source,
          pictureUrl: p.picture?.data?.url,
          website: p.website,
          phone: p.phone,
          singleLineAddress: p.single_line_address,
          whatsappNumber: p.whatsapp_number,
          bio: p.bio || p.about || p.description,
          followersCount: p.followers_count,
        };

        await prisma.metaAsset.upsert({
          where: { externalId: p.id },
          update: {
            name: p.name,
            category: p.category || null,
            fanCount: p.fan_count || p.followers_count || 0,
            accessToken: p.access_token || null,
            metadataJson: JSON.stringify(metadata),
            isAuthorized: true,
            connectionId: connection?.id,
          },
          create: {
            externalId: p.id,
            name: p.name,
            category: p.category || null,
            fanCount: p.fan_count || p.followers_count || 0,
            accessToken: p.access_token || null,
            metadataJson: JSON.stringify(metadata),
            isAuthorized: true,
            assetType: 'PAGE',
            connectionId: connection?.id,
          },
        });
      }
    }

    // 4. Return the stored pages
    const finalPages = await prisma.metaAsset.findMany({
      where: { isAuthorized: true },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({
      success: true,
      fromDb: false,
      count: finalPages.length,
      pages: finalPages.map((p) => {
        let meta: any = {};
        try {
          if (p.metadataJson) meta = JSON.parse(p.metadataJson);
        } catch (e) {}

        return {
          id: p.externalId,
          name: p.name,
          category: p.category,
          fan_count: p.fanCount,
          access_token: p.accessToken,
          auditReport: p.auditReport,
          auditReportDate: p.auditReportDate,
          coverUrl: meta.coverUrl,
          pictureUrl: meta.pictureUrl,
          website: meta.website,
          phone: meta.phone,
          singleLineAddress: meta.singleLineAddress,
          whatsappNumber: meta.whatsappNumber,
          bio: meta.bio,
        };
      }),
    });
  } catch (error: any) {
    console.error('[Pages List Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
