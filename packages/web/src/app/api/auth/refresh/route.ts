import { clearAuthCookies, setAuthCookies } from '@/lib/auth-cookies';
import { NextResponse } from 'next/server';
import { POST as logout } from '../logout/route';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function POST(request: Request) {
  const refreshToken = request.headers.get('cookie')?.match(/refreshToken=([^;]+)/)?.[1];

  if (!refreshToken) {
    return clearAuthCookies(NextResponse.json(
      { success: false, error: { code: 'NO_REFRESH_TOKEN', message: 'No se encontró refresh token' } },
      { status: 401 },
    ));
  }

  const apiRes = await fetch(`${API_URL}/api/auth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `refreshToken=${refreshToken}`,
    },
  });

  const data = await apiRes.json();

  if (!apiRes.ok || !data.success) {
    const res = NextResponse.json(data, { status: apiRes.status });
    return apiRes.status === 401 ? clearAuthCookies(res) : res;
  }

  return setAuthCookies(NextResponse.json({ success: true, data: {} }), data.data);
}

// Receive the path-restricted cookie for server-side logout revocation.
export async function DELETE(request: Request) {
  const origin = request.headers.get('origin');
  if ((origin && origin !== new URL(request.url).origin) ||
      request.headers.get('sec-fetch-site') === 'cross-site') {
    return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Origen no permitido' } }, { status: 403 });
  }
  // No access JWT is required: expired sessions must still be able to logout.
  // Only the refresh token supplied in the cookie can be revoked.
  return logout(request);
}
