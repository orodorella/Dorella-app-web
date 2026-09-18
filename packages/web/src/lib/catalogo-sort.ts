export const CATALOGO_SORT_OPTIONS = [
  { value: 'destacados', label: 'Destacados' },
  { value: 'precio_desc', label: 'Mayor precio' },
  { value: 'precio_asc', label: 'Menor precio' },
  { value: 'nombre_asc', label: 'Nombre A - Z' },
  { value: 'nombre_desc', label: 'Nombre Z - A' },
  { value: 'recientes', label: 'Más recientes' },
] as const;

export type CatalogoSort = (typeof CATALOGO_SORT_OPTIONS)[number]['value'];

export function isCatalogoSort(value: unknown): value is CatalogoSort {
  return CATALOGO_SORT_OPTIONS.some((option) => option.value === value);
}
