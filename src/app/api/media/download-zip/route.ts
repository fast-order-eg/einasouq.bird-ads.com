import { NextResponse } from 'next/server';
import JSZip from 'jszip';

export async function POST(req: Request) {
  try {
    const { urls, filename } = await req.json();

    if (!Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json({ error: 'urls array is required' }, { status: 400 });
    }

    const zip = new JSZip();
    const zipName = (filename || 'creative_photos') + '.zip';

    // Download images in parallel with concurrency
    await Promise.all(
      urls.map(async (imgUrl: string, idx: number) => {
        try {
          const res = await fetch(imgUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
          });
          if (res.ok) {
            const buffer = await res.arrayBuffer();
            const ext = imgUrl.includes('.png') ? 'png' : 'jpg';
            const imgName = `photo_${String(idx + 1).padStart(2, '0')}.${ext}`;
            zip.file(imgName, buffer);
          }
        } catch (e) {
          console.error(`Failed to fetch image ${idx + 1}:`, e);
        }
      })
    );

    const zipBuffer = await zip.generateAsync({
      type: 'uint8array',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    const safeZipName = encodeURIComponent(zipName).replace(/['()]/g, escape);

    return new NextResponse(zipBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${safeZipName}"; filename*=UTF-8''${safeZipName}`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (err: any) {
    console.error('[Download Zip API error]:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
