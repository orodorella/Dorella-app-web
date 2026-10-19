import { setAuthCookies } from '@/lib/auth-cookies';
import { NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

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

  return setAuthCookies(NextResponse.json({ success: true, data: { user: data.data.user } }), data.data);
}
