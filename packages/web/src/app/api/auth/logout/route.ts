import { NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function POST(request: Request) {
  const refreshToken = request.headers.get('cookie')?.match(/refreshToken=([^;]+)/)?.[1];

  if (refreshToken) {
    await fetch(`${API_URL}/api/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `refreshToken=${refreshToken}`,
      },
    }).catch(() => {});
  }

  const res = NextResponse.json({ success: true });
  res.cookies.delete('accessToken');
  res.cookies.delete('refreshToken');
  return res;
}
