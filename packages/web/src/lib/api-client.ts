const API_PUBLIC_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const API_INTERNAL_URL = process.env.API_INTERNAL_URL || API_PUBLIC_URL;

export async function serverFetch<T = unknown>(
  path: string,
  options?: RequestInit & { accessToken?: string },
): Promise<{ success: true; data: T; meta?: { page: number; pageSize: number; total: number } } | { success: false; error: { code: string; message: string } }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options?.accessToken) {
    headers['Authorization'] = `Bearer ${options.accessToken}`;
  }

  const res = await fetch(`${API_INTERNAL_URL}${path}`, {
    ...options,
    headers: { ...headers, ...(options?.headers as Record<string, string>) },
  });

  return res.json();
}

export const TIER_MAP: Record<string, string> = {
  detal: 'detal',
  por_mayor: 'mayorista',
  gran_mayor: 'granmayorista',
};

export const TIER_MAP_REVERSE: Record<string, string> = {
  detal: 'detal',
  mayorista: 'por_mayor',
  granmayorista: 'gran_mayor',
};

export interface MappedUser {
  id: string;
  nombre: string;
  email: string;
  tier: string;
  label: string;
  descuento: number;
  minimo: number;
  direccion: string;
  telefono: string;
  ciudad: string;
  empresa: string;
  role: string;
  provider: string;
}

interface ApiUser {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  tier: string;
  role: string;
  provider?: string;
  direccion?: string | null;
  telefono?: string | null;
  ciudad?: string | null;
  empresa?: string | null;
}

export function mapUserFromApi(apiUser: ApiUser): MappedUser {
  const frontendTier = TIER_MAP[apiUser.tier] || 'detal';
  const labels: Record<string, string> = { detal: 'Detal / Visitante', mayorista: 'Por Mayor', granmayorista: 'Gran Mayor' };
  const descuentos: Record<string, number> = { detal: 0, mayorista: 0.375, granmayorista: 0.5 };
  const minimos: Record<string, number> = { detal: 0, mayorista: 500000, granmayorista: 5000000 };

  return {
    id: apiUser.id,
    nombre: `${apiUser.nombre} ${apiUser.apellido}`.trim(),
    email: apiUser.email,
    tier: frontendTier,
    label: labels[frontendTier] || 'Detal / Visitante',
    descuento: descuentos[frontendTier] || 0,
    minimo: minimos[frontendTier] || 0,
    direccion: apiUser.direccion || '',
    telefono: apiUser.telefono || '',
    ciudad: apiUser.ciudad || '',
    empresa: apiUser.empresa || '',
    role: apiUser.role,
    provider: apiUser.provider || 'email',
  };
}

export function formatCOP(n: number): string {
  return '$' + Math.round(n).toLocaleString('es-CO');
}
