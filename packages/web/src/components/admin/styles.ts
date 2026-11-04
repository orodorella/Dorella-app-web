/**
 * Clases compartidas del panel. Jerarquía de botones: primario (vino sólido),
 * secundario (contorno), terciario (texto). Deshabilitado = gris neutro, opacidad
 * y cursor not-allowed, nunca un vino desvaído que parezca activo.
 */
const base = 'inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wine/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed';

export const btnPrimary = `${base} cursor-pointer bg-wine px-4 py-2 text-white hover:bg-wine-light disabled:bg-stone-200 disabled:text-stone-500 disabled:opacity-70`;
export const btnSecondary = `${base} cursor-pointer border border-wine/40 bg-white px-4 py-2 text-wine hover:border-wine hover:bg-wine-50 disabled:border-stone-200 disabled:bg-white disabled:text-stone-400 disabled:opacity-70`;
export const btnTertiary = `${base} cursor-pointer px-2 py-1 text-wine underline-offset-4 hover:underline disabled:text-stone-400 disabled:no-underline disabled:opacity-70`;
export const btnDanger = `${base} cursor-pointer px-2 py-1 text-red-700 underline-offset-4 hover:underline disabled:text-stone-400 disabled:no-underline disabled:opacity-70`;
/** Variante compacta para filas de tablas. */
export const btnSm = '!px-3 !py-1.5 !text-xs';

export const field = 'rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800 placeholder:text-stone-500 focus:border-wine/50 focus:outline-none focus:ring-2 focus:ring-wine/15 disabled:cursor-not-allowed disabled:bg-stone-100';
export const fieldLabel = 'text-xs font-medium text-stone-600';

export const card = 'rounded-2xl border border-stone-200 bg-white shadow-sm';
export const sectionTitle = 'text-base font-semibold text-stone-800';
/** Encabezado de tabla: 12 px, contraste AA sobre fondo claro. */
export const th = 'px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-600';
export const tableHead = 'sticky top-0 z-10 bg-stone-50';

/** Gráficas: texto de ejes legible (12 px, gris con contraste AA). */
export const CHART_AXIS_TICK = { fontSize: 12, fill: '#57534e' } as const;
export const CHART_GRID = '#e7e5e4';
