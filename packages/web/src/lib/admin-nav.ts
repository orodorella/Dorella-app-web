import { BarChart3, Boxes, Coins, GraduationCap, Landmark, LineChart, Package, Percent, Receipt, ShoppingBag, Tag, TrendingUp, Users, type LucideIcon } from 'lucide-react';
import { canAccessAdminPath } from '@/lib/admin-access';

export interface AdminNavItem { href: string; icon: LucideIcon; label: string }
export interface AdminNavGroup { title: string; items: AdminNavItem[] }

/** Menú del panel agrupado por área. La visibilidad por rol sale de canAccessAdminPath (sin reglas nuevas). */
export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    title: 'Operación',
    items: [
      { href: '/admin', icon: BarChart3, label: 'Dashboard' },
      { href: '/admin/ordenes', icon: ShoppingBag, label: 'Órdenes' },
      { href: '/admin/usuarios', icon: Users, label: 'Usuarios' },
    ],
  },
  {
    title: 'Catálogo e inventario',
    items: [
      { href: '/admin/productos', icon: Package, label: 'Productos' },
      { href: '/admin/categorias', icon: Tag, label: 'Categorías' },
      { href: '/admin/costos', icon: Coins, label: 'Costos' },
      { href: '/admin/inventario-costos', icon: Boxes, label: 'Compras e inventario' },
    ],
  },
  {
    title: 'Comercial',
    items: [
      { href: '/admin/rendimiento', icon: LineChart, label: 'Rendimiento comercial' },
      { href: '/admin/comisiones', icon: Percent, label: 'Comisiones' },
    ],
  },
  {
    title: 'Finanzas',
    items: [
      { href: '/admin/finanzas', icon: Landmark, label: 'Resumen financiero' },
      { href: '/admin/rentabilidad', icon: TrendingUp, label: 'Rentabilidad' },
      { href: '/admin/gastos', icon: Receipt, label: 'Gastos' },
    ],
  },
  {
    title: 'Contenido',
    items: [{ href: '/admin/academia', icon: GraduationCap, label: 'Academia' }],
  },
];

/** Grupos visibles para el rol; un grupo sin ítems visibles no se muestra. */
export function navGroupsForRole(role: string | null | undefined): AdminNavGroup[] {
  return ADMIN_NAV_GROUPS
    .map((group) => ({ ...group, items: group.items.filter((item) => canAccessAdminPath(role, item.href)) }))
    .filter((group) => group.items.length > 0);
}

/** Activo en la página y en sus subrutas (p. ej. /admin/ordenes/nueva); el Dashboard solo en /admin. */
export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === '/admin') return pathname === '/admin';
  return pathname === href || pathname.startsWith(`${href}/`);
}
