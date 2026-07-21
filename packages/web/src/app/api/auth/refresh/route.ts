import { NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function POST(request: Request) {
  const refreshToken = request.headers.get('cookie')?.match(/refreshToken=([^;]+)/)?.[1];

  if (!refreshToken) {
    return NextResponse.json(
      { success: false, error: { code: 'NO_REFRESH_TOKEN', message: 'No se encontró refresh token' } },
      { status: 401 },
    );
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
    res.cookies.delete('accessToken');
    res.cookies.delete('refreshToken');
    return res;
  }

  const res = NextResponse.json(data);
  res.cookies.set('accessToken', data.data.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 15,
    path: '/',
  });
  res.cookies.set('refreshToken', data.data.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  });
  return res;
}
