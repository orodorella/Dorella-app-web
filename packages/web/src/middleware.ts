import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const PROTECTED_PATHS = ['/checkout', '/confirmacion', '/mis-pedidos', '/mi-perfil', '/mis-catalogos'];
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || '');
const isDev = process.env.NODE_ENV !== 'production';

function buildCsp(nonce: string) {
  const connectSources = ["'self'"];
  if (process.env.NEXT_PUBLIC_API_URL) connectSources.push(process.env.NEXT_PUBLIC_API_URL);
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) connectSources.push(process.env.NEXT_PUBLIC_SUPABASE_URL);

  return [
    "default-src 'self'",
    "img-src 'self' https://*.supabase.co data:",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'` + (isDev ? " 'unsafe-eval'" : ''),
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    `connect-src ${connectSources.join(' ')}`,
    "frame-ancestors 'none'",
  ].join('; ');
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = buildCsp(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const respond = (res: NextResponse) => {
    res.headers.set('Content-Security-Policy', csp);
    return res;
  };

  if (pathname.startsWith('/admin')) {
    const accessToken = request.cookies.get('accessToken')?.value;
    if (!accessToken) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('from', pathname);
      return respond(NextResponse.redirect(loginUrl));
    }

    try {
      const { payload } = await jwtVerify(accessToken, JWT_SECRET, { algorithms: ['HS256'] });
      if (payload.role !== 'admin') {
        return respond(NextResponse.redirect(new URL('/catalogo', request.url)));
      }
    } catch {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('from', pathname);
      return respond(NextResponse.redirect(loginUrl));
    }

    return respond(NextResponse.next({ request: { headers: requestHeaders } }));
  }

  const isProtected = PROTECTED_PATHS.some((p) => pathname.startsWith(p));

  if (isProtected) {
    const accessToken = request.cookies.get('accessToken')?.value;
    if (!accessToken) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('from', pathname);
      return respond(NextResponse.redirect(loginUrl));
    }

    try {
      await jwtVerify(accessToken, JWT_SECRET, { algorithms: ['HS256'] });
    } catch {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('from', pathname);
      return respond(NextResponse.redirect(loginUrl));
    }
  }

  return respond(NextResponse.next({ request: { headers: requestHeaders } }));
}

export const config = {
  matcher: [
    {
      source: '/((?!_next/static|_next/image|favicon.ico).*)',
    },
  ],
};
