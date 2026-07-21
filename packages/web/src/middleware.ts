import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const PROTECTED_PATHS = ['/carrito', '/checkout', '/confirmacion', '/mis-pedidos', '/mi-perfil', '/mis-catalogos'];
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || '');

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/admin')) {
    const accessToken = request.cookies.get('accessToken')?.value;
    if (!accessToken) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('from', pathname);
      return NextResponse.redirect(loginUrl);
    }

    try {
      const { payload } = await jwtVerify(accessToken, JWT_SECRET, { algorithms: ['HS256'] });
      if (payload.role !== 'admin') {
        return NextResponse.redirect(new URL('/catalogo', request.url));
      }
    } catch {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('from', pathname);
      return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
  }

  const refreshToken = request.cookies.get('refreshToken')?.value;
  const isProtected = PROTECTED_PATHS.some((p) => pathname.startsWith(p));

  if (isProtected && !refreshToken) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/carrito/:path*',
    '/checkout/:path*',
    '/confirmacion/:path*',
    '/mis-pedidos/:path*',
    '/mi-perfil/:path*',
    '/mis-catalogos/:path*',
  ],
};
