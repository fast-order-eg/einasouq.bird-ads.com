import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';

const execPromise = promisify(exec);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const mediaUrl = searchParams.get('url');
    const audioUrl = searchParams.get('audioUrl');
    const customFilename = searchParams.get('filename') || 'media_asset';

    if (!mediaUrl) {
      return NextResponse.json({ error: 'رابط الوسائط مطلوب' }, { status: 400 });
    }

    // Validate URL protocol
    if (!mediaUrl.startsWith('http://') && !mediaUrl.startsWith('https://')) {
      return NextResponse.json({ error: 'رابط غير صالح' }, { status: 400 });
    }

    // CASE 1: If audioUrl is provided, mux video + audio using FFmpeg
    if (audioUrl && (audioUrl.startsWith('http://') || audioUrl.startsWith('https://'))) {
      const tmpId = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const tmpOut = path.join(os.tmpdir(), `merged_${tmpId}.mp4`);

      try {
        // Fast copy mux: takes 1-2 seconds with zero re-encoding loss
        await execPromise(
          `ffmpeg -y -i "${mediaUrl}" -i "${audioUrl}" -c:v copy -c:a aac -movflags +faststart "${tmpOut}"`,
          { timeout: 35000 }
        );

        if (fs.existsSync(tmpOut)) {
          const mergedBuffer = fs.readFileSync(tmpOut);
          try {
            fs.unlinkSync(tmpOut);
          } catch (e) {}

          const safeFilename = encodeURIComponent(
            customFilename.endsWith('.mp4') ? customFilename : `${customFilename}.mp4`
          );

          return new NextResponse(mergedBuffer, {
            status: 200,
            headers: {
              'Content-Type': 'video/mp4',
              'Content-Disposition': `attachment; filename="${safeFilename}"; filename*=UTF-8''${safeFilename}`,
              'Cache-Control': 'public, max-age=86400',
            },
          });
        }
      } catch (ffmpegErr) {
        console.warn('[Download API] FFmpeg muxing failed or timed out, falling back to direct video download:', ffmpegErr);
        if (fs.existsSync(tmpOut)) {
          try {
            fs.unlinkSync(tmpOut);
          } catch (e) {}
        }
      }
    }

    // CASE 2: Standard fetch & download (images or video fallback)
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
