/**
 * Acceso al panel /admin por rol. Espejo de ROLE_PERMISSIONS (packages/shared);
 * en la UI solo sirve para ocultar opciones y redirigir: la autorización real
 * la hace el API en cada endpoint (requirePermission).
 */
export const STAFF_ROLES = ['admin', 'comercial', 'bodega'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export function isStaffRole(role: string | null | undefined): role is StaffRole {
  return !!role && (STAFF_ROLES as readonly string[]).includes(role);
}

export function canAccessAdminPath(role: string | null | undefined, pathname: string): boolean {
  if (role === 'admin') return true;
  if (role === 'comercial') return pathname === '/admin/ordenes' || pathname.startsWith('/admin/ordenes/');
  if (role === 'bodega') {
    return (
      pathname === '/admin' ||
      pathname === '/admin/productos' || pathname.startsWith('/admin/productos/') ||
      pathname === '/admin/ordenes' || pathname.startsWith('/admin/ordenes/')
    );
  }
  return false;
}

/** Página de inicio del panel para cada rol. */
export function adminHome(role: string | null | undefined): string {
  if (role === 'comercial') return '/admin/ordenes';
  if (isStaffRole(role)) return '/admin';
  return '/catalogo';
}

export const canMarkOrdersPaid = (role?: string | null) => role === 'admin' || role === 'comercial';
export const canUpdateOrderStatus = (role?: string | null) => role === 'admin' || role === 'bodega' || role === 'comercial';
export const canCreateOrders = (role?: string | null) => role === 'admin' || role === 'comercial';
