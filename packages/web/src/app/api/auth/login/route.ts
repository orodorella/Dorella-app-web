import { NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function setAuthCookies(res: NextResponse, data: Record<string, unknown>) {
  const d = data.data as Record<string, unknown>;
  res.cookies.set('accessToken', d.accessToken as string, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 15,
    path: '/',
  });
  res.cookies.set('refreshToken', d.refreshToken as string, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  });
  return res;
}

export async function POST(request: Request) {
  const body = await request.json();

  const apiRes = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await apiRes.json();

  if (!apiRes.ok || !data.success) {
    return NextResponse.json(data, { status: apiRes.status });
  }

  return setAuthCookies(NextResponse.json(data), data);
}
