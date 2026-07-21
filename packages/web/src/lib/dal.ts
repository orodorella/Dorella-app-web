import 'server-only';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'http://localhost:3001');

export interface Session {
  userId: string;
  email: string;
  role: string;
  tier: string;
}

export async function verifySession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('accessToken')?.value;
  if (!accessToken) return null;

  try {
    const { payload } = await jwtVerify(accessToken, JWT_SECRET, {
      algorithms: ['HS256'],
    });

    if (!payload.sub || !payload.email || !payload.role || !payload.tier) return null;

    return {
      userId: payload.sub,
      email: payload.email as string,
      role: payload.role as string,
      tier: payload.tier as string,
    };
  } catch {
    return null;
  }
}
