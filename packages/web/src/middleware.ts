import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PROTECTED_PATHS = ['/carrito', '/checkout', '/confirmacion', '/mis-pedidos', '/mi-perfil', '/mis-catalogos'];
const ADMIN_PATHS = ['/admin'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const refreshToken = request.cookies.get('refreshToken')?.value;

  const isProtected = PROTECTED_PATHS.some((p) => pathname.startsWith(p));
  const isAdmin = ADMIN_PATHS.some((p) => pathname.startsWith(p));

  if ((isProtected || isAdmin) && !refreshToken) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/carrito/:path*',
    '/checkout/:path*',
    '/confirmacion/:path*',
    '/mis-pedidos/:path*',
    '/mi-perfil/:path*',
    '/mis-catalogos/:path*',
    '/admin/:path*',
  ],
};
