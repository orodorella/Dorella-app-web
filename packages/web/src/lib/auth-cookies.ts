import type { NextResponse } from 'next/server';

const REFRESH_PATH = '/api/auth/refresh';
const EXPIRED = new Date(0);
function cookieOptions() {
  return { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' as const };
}

function expiredRefreshCookie(path: string, sameSite: 'Strict' | 'Lax') {
  return `refreshToken=; Path=${path}; Max-Age=0; Expires=${EXPIRED.toUTCString()}; HttpOnly;${cookieOptions().secure ? ' Secure;' : ''} SameSite=${sameSite}`;
}

// ResponseCookies indexes by name. Append the second path explicitly so both
// historical cookie variants are expired in the same response. Domain is unset
// on creation and deletion; the legacy root cookie used SameSite=Lax.
export function clearAuthCookies(res: NextResponse) {
  const options = { ...cookieOptions(), maxAge: 0, expires: EXPIRED, path: '/' };
  res.cookies.set('accessToken', '', options);
  res.cookies.set('refreshToken', '', { ...options, sameSite: 'lax' });
  res.headers.append('Set-Cookie', expiredRefreshCookie(REFRESH_PATH, 'Strict'));
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

export function setAuthCookies(res: NextResponse, tokens: { accessToken: string; refreshToken: string }) {
  const options = cookieOptions();
  res.cookies.set('accessToken', tokens.accessToken, { ...options, maxAge: 60 * 15, path: '/' });
  res.cookies.set('refreshToken', tokens.refreshToken, {
    ...options, maxAge: 60 * 60 * 24 * 7, path: REFRESH_PATH,
  });
  res.headers.append('Set-Cookie', expiredRefreshCookie('/', 'Lax'));
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
