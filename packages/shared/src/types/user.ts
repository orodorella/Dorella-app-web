export type Role = 'cliente' | 'admin';

export type Tier = 'detal' | 'por_mayor' | 'gran_mayor';

export interface User {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  telefono: string | null;
  empresa: string | null;
  nit: string | null;
  direccion: string | null;
  ciudad: string | null;
  departamento: string | null;
  role: Role;
  tier: Tier;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
  tier: Tier;
  iat: number;
  exp: number;
}
