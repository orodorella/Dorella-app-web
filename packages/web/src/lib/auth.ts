import { cookies } from 'next/headers';
import { serverFetch, mapUserFromApi, type MappedUser } from './api-client';

export async function getServerSession(): Promise<MappedUser | null> {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get('refreshToken')?.value;
  if (!refreshToken) return null;

  try {
    const refreshRes = await serverFetch<{ accessToken: string }>('/api/auth/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `refreshToken=${refreshToken}`,
      },
    });

    if (!refreshRes.success) return null;

    const meRes = await serverFetch<Record<string, unknown>>('/api/auth/me', {
      accessToken: refreshRes.data.accessToken,
    });

    if (!meRes.success) return null;

    return mapUserFromApi(meRes.data as unknown as Parameters<typeof mapUserFromApi>[0]);
  } catch {
    return null;
  }
}
