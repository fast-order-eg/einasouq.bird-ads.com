import { NextResponse } from 'next/server';
import { POST as handleAnalyzePost, GET as handleAnalyzePostGet } from '../analyze-post/route';
import { POST as handleAnalyzePage, GET as handleAnalyzePageGet } from '../analyze-page/route';

export async function POST(req: Request) {
  try {
    const clonedReq = req.clone();
    const body = await clonedReq.json();

    const isPost = Boolean(body.post_url || body.postUrl || body.postId || body.post_id || body.type === 'post');
    const isPage = Boolean(body.page_id || body.pageId || body.page_name || body.pageName || body.type === 'page');

    if (isPost) {
      return await handleAnalyzePost(req);
    }

    if (isPage) {
      return await handleAnalyzePage(req);
    }

    return NextResponse.json(
      {
        success: false,
        error: 'برجاء إرسال إما post_url لتحليل بوست، أو page_id لتحليل صفحة كاملة',
      },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const hasPost = url.searchParams.has('post_url') || url.searchParams.has('postId') || url.searchParams.get('type') === 'post';
    const hasPage = url.searchParams.has('page_id') || url.searchParams.has('page_name') || url.searchParams.get('type') === 'page';

    if (hasPost) {
      return await handleAnalyzePostGet(req);
    }

    if (hasPage) {
      return await handleAnalyzePageGet(req);
    }

    return NextResponse.json(
      {
        success: false,
        error: 'برجاء تمرير post_url لتحليل بوست أو page_id لتحليل صفحة في الـ query parameters',
      },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
