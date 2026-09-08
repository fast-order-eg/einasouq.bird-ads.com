import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      pageName = '',
      pageProfileUrl = '',
      primaryText = '',
      adLibraryId = '',
      snapshotUrl = '',
    } = body;

    const cleanPage = (pageName || '').trim();
    const cleanText = (primaryText || '').trim();
    const firstLine = cleanText.split('\n')[0]?.slice(0, 50) || '';

    // Smart link construction
    let baseUrl = pageProfileUrl;
    if (!baseUrl || baseUrl.includes('search/pages')) {
      baseUrl = `https://www.facebook.com/${encodeURIComponent(cleanPage)}`;
    }

    const cleanBaseUrl = baseUrl.replace(/\/$/, '');
    const photosUrl = `${cleanBaseUrl}/photos`;
    const postsUrl = `${cleanBaseUrl}/posts`;
    const searchFbUrl = `https://www.facebook.com/search/posts/?q=${encodeURIComponent(cleanPage + ' ' + firstLine)}`;
    const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent('site:facebook.com "' + cleanPage + '" ' + firstLine)}`;

    return NextResponse.json({
      success: true,
      found: false,
      isDarkPost: false,
      adLibraryId,
      pageName: cleanPage,
      pageProfileUrl: cleanBaseUrl,
      photosUrl,
      postsUrl,
      searchFbUrl,
      googleSearchUrl,
      firstLine,
      snapshotUrl: snapshotUrl || `https://www.facebook.com/ads/library/?id=${adLibraryId}`,
      title: 'البحث عن المنشور الأصلي لصفحة المنافس',
      message: 'يمكنك الوصول للمنشور الأصلي والتفاعلات والتعليقات الحية عبر الخيارات المباشرة أدناه:',
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'حدث خطأ أثناء إعداد روابط المنشور',
    }, { status: 500 });
  }
}
