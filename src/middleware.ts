import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('adscope_auth_token')?.value;

  const isAuthPage = pathname.startsWith('/login');
  const isApiAuthRoute = pathname.startsWith('/api/auth/login') || pathname.startsWith('/api/auth/logout');
  const isPublicAsset =
    pathname.startsWith('/_next') ||
    pathname.startsWith('/brand-logo.png') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.match(/\.(png|jpg|jpeg|svg|gif|webp|ico|css|js)$/);

  // Allow static assets and public auth API routes
  if (isPublicAsset || isApiAuthRoute) {
    return NextResponse.next();
  }

  // If user is not authenticated and trying to access protected routes
  if (!token && !isAuthPage) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { success: false, error: 'انتهت صلاحية الجلسة، برجاء تسجيل الدخول مجدداً' },
        { status: 401 }
      );
    }
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // If user is already authenticated and visits /login, redirect to dashboard
  if (token && isAuthPage) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
