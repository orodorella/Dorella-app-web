import ExcelJS from 'exceljs';
import { prisma } from '../config/db.js';
import { PRODUCT_EXCEL_COLUMNS, PRODUCT_EXCEL_SHEET_NAME } from './product-excel-columns.js';

function buildWorksheet(workbook: ExcelJS.Workbook) {
  const sheet = workbook.addWorksheet(PRODUCT_EXCEL_SHEET_NAME);
  sheet.columns = PRODUCT_EXCEL_COLUMNS.map((c) => ({ header: c.header, key: c.key, width: c.width }));
  sheet.getRow(1).font = { bold: true };
  return sheet;
}

/**
 * Excel con los productos actuales (para editar y volver a importar).
 * Si se pasa `categorySlug`, exporta solo los productos de esa categoría.
 */
export async function exportProductsWorkbook(categorySlug?: string): Promise<ExcelJS.Buffer> {
  const products = await prisma.product.findMany({
    where: categorySlug ? { category: { slug: categorySlug } } : undefined,
    select: {
      sku: true, nombre: true, descripcion: true, precioBase: true, stock: true,
      stockMinimo: true, material: true, proveedor: true, referenciaProveedor: true,
      isActive: true, isFeatured: true,
      category: { select: { nombre: true } },
    },
    orderBy: { sku: 'asc' },
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = buildWorksheet(workbook);

  for (const p of products) {
    sheet.addRow({
      sku: p.sku,
      nombre: p.nombre,
      categoria: p.category.nombre,
      precioBase: Number(p.precioBase),
      stock: p.stock,
      stockMinimo: p.stockMinimo,
      descripcion: p.descripcion ?? '',
      material: p.material ?? '',
      proveedor: p.proveedor ?? '',
      referenciaProveedor: p.referenciaProveedor ?? '',
      isActive: p.isActive ? 'Sí' : 'No',
      isFeatured: p.isFeatured ? 'Sí' : 'No',
    });
  }

  return workbook.xlsx.writeBuffer();
}

/** Plantilla vacía con encabezados + una fila de ejemplo, misma definición que el export. */
export async function generateProductTemplateWorkbook(): Promise<ExcelJS.Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = buildWorksheet(workbook);

  const exampleRow: Record<string, string | number> = {};
  for (const c of PRODUCT_EXCEL_COLUMNS) exampleRow[c.key] = c.example;
  sheet.addRow(exampleRow);
  sheet.getRow(2).font = { italic: true, color: { argb: 'FF9CA3AF' } };

  return workbook.xlsx.writeBuffer();
}
