import { cookies } from 'next/headers';

// Reads the accessToken httpOnly cookie inside a Server Component so SSR
// product fetches can forward it and get tier-aware pricing, instead of
// always falling back to anonymous/detal pricing.
export async function getAccessToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get('accessToken')?.value;
}
