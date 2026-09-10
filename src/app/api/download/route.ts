import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const mediaUrl = searchParams.get('url');
    const customFilename = searchParams.get('filename') || 'media_asset';

    if (!mediaUrl) {
      return NextResponse.json({ error: 'رابط الوسائط مطلوب' }, { status: 400 });
    }

    // Validate URL protocol
    if (!mediaUrl.startsWith('http://') && !mediaUrl.startsWith('https://')) {
      return NextResponse.json({ error: 'رابط غير صالح' }, { status: 400 });
    }

    const response = await fetch(mediaUrl);
    if (!response.ok) {
      return NextResponse.json(
        { error: `فشل جلب الملف من المصدر (${response.status})` },
        { status: response.status }
      );
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const blob = await response.arrayBuffer();

    // Determine clean extension
    let ext = '';
    if (contentType.includes('video/mp4') || mediaUrl.includes('.mp4')) ext = '.mp4';
    else if (contentType.includes('image/jpeg') || mediaUrl.includes('.jpg') || mediaUrl.includes('.jpeg')) ext = '.jpg';
    else if (contentType.includes('image/png') || mediaUrl.includes('.png')) ext = '.png';
    else if (contentType.includes('image/webp') || mediaUrl.includes('.webp')) ext = '.webp';
    else if (contentType.includes('video')) ext = '.mp4';
    else if (contentType.includes('image')) ext = '.jpg';

    const safeFilename = encodeURIComponent(
      customFilename.endsWith(ext) ? customFilename : `${customFilename}${ext}`
    );

    return new NextResponse(blob, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${safeFilename}"; filename*=UTF-8''${safeFilename}`,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error: any) {
    console.error('Download Proxy Error:', error);
    return NextResponse.json(
      { error: error.message || 'حدث خطأ أثناء تنزيل الملف' },
      { status: 500 }
    );
  }
}
