/**
 * Definición única de las columnas del Excel de productos.
 * Export, plantilla e importación leen de acá para no desincronizarse nunca.
 */
export type ProductExcelKey =
  | 'sku'
  | 'nombre'
  | 'categoria'
  | 'precioBase'
  | 'stock'
  | 'stockMinimo'
  | 'descripcion'
  | 'material'
  | 'proveedor'
  | 'referenciaProveedor'
  | 'isActive'
  | 'isFeatured';

export interface ProductExcelColumn {
  key: ProductExcelKey;
  header: string;
  width: number;
  /** Obligatorio únicamente cuando la fila es un producto NUEVO (SKU no existe todavía). */
  requiredForNew: boolean;
  example: string | number;
}

export const PRODUCT_EXCEL_COLUMNS: ProductExcelColumn[] = [
  { key: 'sku', header: 'SKU', width: 16, requiredForNew: true, example: 'BD3' },
  { key: 'nombre', header: 'Nombre', width: 32, requiredForNew: true, example: 'Balín Diamantado #3' },
  { key: 'categoria', header: 'Categoría', width: 20, requiredForNew: true, example: 'Balinería' },
  { key: 'precioBase', header: 'Precio Base', width: 14, requiredForNew: true, example: 2800 },
  { key: 'stock', header: 'Stock', width: 10, requiredForNew: false, example: 50 },
  { key: 'stockMinimo', header: 'Stock Mínimo', width: 14, requiredForNew: false, example: 10 },
  { key: 'descripcion', header: 'Descripción', width: 40, requiredForNew: false, example: '' },
  { key: 'material', header: 'Material', width: 20, requiredForNew: false, example: 'Oro laminado 18k' },
  { key: 'proveedor', header: 'Proveedor', width: 20, requiredForNew: false, example: '' },
  { key: 'referenciaProveedor', header: 'Referencia Proveedor', width: 20, requiredForNew: false, example: '' },
  { key: 'isActive', header: 'Activo', width: 10, requiredForNew: false, example: 'Sí' },
  { key: 'isFeatured', header: 'Destacado', width: 12, requiredForNew: false, example: 'No' },
];

export const PRODUCT_EXCEL_SHEET_NAME = 'Productos';
