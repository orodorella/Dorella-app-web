import { describe, expect, it } from 'vitest';
import { ADMIN_NAV_GROUPS, isNavItemActive, navGroupsForRole } from '../src/lib/admin-nav';

const shape = (role: string) => navGroupsForRole(role).map((g) => [g.title, g.items.map((i) => i.label)]);

describe('menú agrupado del panel', () => {
  it('admin ve los cinco grupos en orden', () => {
    expect(navGroupsForRole('admin').map((g) => g.title)).toEqual(['Operación', 'Catálogo e inventario', 'Comercial', 'Finanzas', 'Contenido']);
    expect(navGroupsForRole('admin').flatMap((g) => g.items)).toHaveLength(ADMIN_NAV_GROUPS.flatMap((g) => g.items).length);
  });

  it('bodega conserva exactamente lo que veía: Dashboard, Órdenes y Productos', () => {
    expect(shape('bodega')).toEqual([
      ['Operación', ['Dashboard', 'Órdenes']],
      ['Catálogo e inventario', ['Productos']],
    ]);
  });

  it('comercial solo ve Órdenes; los grupos vacíos se ocultan', () => {
    expect(shape('comercial')).toEqual([['Operación', ['Órdenes']]]);
  });

  it('un cliente no ve nada', () => {
    expect(navGroupsForRole('cliente')).toEqual([]);
  });

  it('estado activo en subrutas, sin que el Dashboard quede siempre activo', () => {
    expect(isNavItemActive('/admin/ordenes/nueva', '/admin/ordenes')).toBe(true);
    expect(isNavItemActive('/admin/ordenes', '/admin')).toBe(false);
    expect(isNavItemActive('/admin', '/admin')).toBe(true);
    expect(isNavItemActive('/admin/costosx', '/admin/costos')).toBe(false);
  });
});
