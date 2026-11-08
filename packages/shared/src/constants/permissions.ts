import type { Role } from '../types/user.js';

/**
 * Permisos del panel administrativo. El backend autoriza por permiso
 * (`requirePermission`); la UI usa el mismo mapa solo para ocultar opciones.
 * Un rol desconocido no tiene ningún permiso (fallo seguro).
 */
export const PERMISSIONS = [
  'orders:create',
  'orders:read_own',
  'orders:read_all',
  'orders:update_status',
  'orders:mark_paid',
  'products:manage',
  'inventory:manage',
  'dashboard:operational',
  'dashboard:financial',
  'dashboard:commercial',
  'users:manage',
  'customers:change_tier',
  'categories:manage',
  'academy:manage',
  'finance:read',
  'commissions:manage',
  'expenses:manage',
] as const;

export type Permission = typeof PERMISSIONS[number];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  cliente: [],
  admin: PERMISSIONS,
  comercial: ['orders:create', 'orders:read_own', 'orders:update_status', 'orders:mark_paid', 'customers:change_tier', 'dashboard:commercial'],
  bodega: [
    'orders:read_all',
    'orders:update_status',
    'products:manage',
    'inventory:manage',
    'dashboard:operational',
  ],
};

export function hasPermission(role: string | null | undefined, permission: Permission): boolean {
  if (!role || !(role in ROLE_PERMISSIONS)) return false;
  return ROLE_PERMISSIONS[role as Role].includes(permission);
}

export function hasAnyPermission(role: string | null | undefined, permissions: readonly Permission[]): boolean {
  return permissions.some((permission) => hasPermission(role, permission));
}

/** Roles que pueden entrar al panel /admin (cada uno solo a sus módulos). */
export const STAFF_ROLES: readonly Role[] = ['admin', 'comercial', 'bodega'];
