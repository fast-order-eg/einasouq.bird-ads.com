import { NextRequest, NextResponse } from 'next/server';
import { inspectFacebookPost } from '@/lib/post-inspector';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawUrl = body.postUrl || body.url || body.postId || '';

    if (!rawUrl || !rawUrl.trim()) {
      return NextResponse.json(
        { success: false, error: 'برجاء إدخال رابط المنشور أو معرّفه للبدء' },
        { status: 400 }
      );
    }

    const result = await inspectFacebookPost(rawUrl);
    if (!result.success) {
      return NextResponse.json(result, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Post Inspect API Error]:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'حدث خطأ غير متوقع أثناء فحص المنشور',
      },
      { status: 500 }
    );
  }
}
