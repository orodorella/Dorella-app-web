import ExcelJS from 'exceljs';
import { Readable } from 'node:stream';
import { prisma } from '../config/db.js';
import { PRODUCT_EXCEL_COLUMNS, PRODUCT_EXCEL_SHEET_NAME, type ProductExcelKey } from './product-excel-columns.js';

export type ImportRowStatus = 'nuevo' | 'actualizar' | 'sin_cambios' | 'error';

export interface ImportRowChange {
  field: string;
  label: string;
  from: string;
  to: string;
}

export interface ImportRowError {
  field: string;
  value: string;
  message: string;
}

export interface ParsedProductRow {
  sku: string | null;
  nombre?: string | null;
  categoria?: string | null;
  precioBase?: string | null;
  stock?: string | null;
  stockMinimo?: string | null;
  descripcion?: string | null;
  material?: string | null;
  proveedor?: string | null;
  referenciaProveedor?: string | null;
  isActive?: string | null;
  isFeatured?: string | null;
}

export interface ImportRowResult {
  row: number;
  sku: string;
  nombre: string;
  status: ImportRowStatus;
  changes: ImportRowChange[];
  errors: ImportRowError[];
  /** Payload listo para aplicar (create o update). Ausente si status === 'error'. */
  applyData?: {
    kind: 'create';
    data: {
      sku: string;
      nombre: string;
      categoryId: string;
      precioBase: number;
      stock: number;
      stockMinimo: number;
      descripcion?: string;
      material?: string;
      proveedor?: string;
      referenciaProveedor?: string;
      isActive?: boolean;
      isFeatured?: boolean;
    };
  } | {
    kind: 'update';
    id: string;
    data: Record<string, string | number | boolean>;
  };
}

export interface ImportPreviewResult {
  totalRows: number;
  nuevos: number;
  actualizados: number;
  sinCambios: number;
  conErrores: number;
  rows: ImportRowResult[];
}

const FIELD_LABELS: Record<string, string> = {
  nombre: 'Nombre', categoria: 'Categoría', precioBase: 'Precio Base', stock: 'Stock',
  stockMinimo: 'Stock Mínimo', descripcion: 'Descripción', material: 'Material',
  proveedor: 'Proveedor', referenciaProveedor: 'Referencia Proveedor',
  isActive: 'Activo', isFeatured: 'Destacado',
};

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase();
}

function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    if ('text' in value && typeof value.text === 'string') return value.text.trim();
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((r) => r.text).join('').trim();
    }
    if (value instanceof Date) return value.toISOString();
    if ('result' in value) return cellToString((value as { result: ExcelJS.CellValue }).result);
  }
  return String(value).trim();
}

/** Lee un .xlsx o .csv (por buffer) y devuelve filas crudas (todo como texto, sin validar). */
export async function parseWorkbookBuffer(buffer: Buffer, filename: string): Promise<ParsedProductRow[]> {
  const workbook = new ExcelJS.Workbook();
  const isCsv = filename.toLowerCase().endsWith('.csv');

  let worksheet: ExcelJS.Worksheet | undefined;
  if (isCsv) {
    worksheet = await workbook.csv.read(Readable.from(buffer));
  } else {
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    worksheet = workbook.worksheets[0];
  }

  if (!worksheet) {
    throw new Error('No se encontró ninguna hoja en el archivo');
  }

  const headerRow = worksheet.getRow(1);
  const columnIndexToKey = new Map<number, ProductExcelKey>();
  const headerToKey = new Map(PRODUCT_EXCEL_COLUMNS.map((c) => [normalizeHeader(c.header), c.key]));

  headerRow.eachCell((cell, colNumber) => {
    const header = normalizeHeader(cellToString(cell.value));
    const key = headerToKey.get(header);
    if (key) columnIndexToKey.set(colNumber, key);
  });

  if (!columnIndexToKey.size || ![...columnIndexToKey.values()].includes('sku')) {
    throw new Error('El archivo no tiene una columna "SKU" reconocible. Usá la plantilla oficial.');
  }

  const rows: ParsedProductRow[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // header

    const parsed: ParsedProductRow = { sku: null };
    let hasAnyValue = false;

    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const key = columnIndexToKey.get(colNumber);
      if (!key) return;
      const raw = cellToString(cell.value);
      if (raw !== '') hasAnyValue = true;
      (parsed as unknown as Record<string, string | null>)[key] = raw === '' ? null : raw;
    });

    if (hasAnyValue) rows.push(parsed);
  });

  return rows;
}

function parseBoolean(value: string | null | undefined): { ok: true; value: boolean } | { ok: false } {
  if (value === null || value === undefined) return { ok: false };
  const v = value.trim().toLowerCase();
  if (['si', 'sí', 'true', '1', 'x', 'activo', 'yes'].includes(v)) return { ok: true, value: true };
  if (['no', 'false', '0', ''].includes(v)) return { ok: true, value: false };
  return { ok: false };
}

function parseNumber(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value.trim() === '') return null;
  const normalized = value.trim().replace(/\./g, '').replace(',', '.');
  const asIs = Number(value.trim());
  if (Number.isFinite(asIs)) return asIs;
  const normalizedNum = Number(normalized);
  return Number.isFinite(normalizedNum) ? normalizedNum : NaN;
}

interface ExistingProduct {
  id: string;
  sku: string;
  nombre: string;
  descripcion: string | null;
  precioBase: number;
  stock: number;
  stockMinimo: number;
  material: string | null;
  proveedor: string | null;
  referenciaProveedor: string | null;
  isActive: boolean;
  isFeatured: boolean;
  categoryId: string;
  categoriaNombre: string;
}

interface CategoryRef { id: string; nombre: string; slug: string; }

/**
 * Valida y compara cada fila contra el estado ACTUAL de la base de datos.
 * No escribe nada — es puro cálculo. Se usa tanto en preview como, otra vez
 * desde cero, justo antes de confirmar (nunca confiamos en un preview viejo).
 */
export async function buildImportPreview(rows: ParsedProductRow[]): Promise<ImportPreviewResult> {
  const [existingProducts, categories] = await Promise.all([
    prisma.product.findMany({
      select: {
        id: true, sku: true, nombre: true, descripcion: true, precioBase: true, stock: true,
        stockMinimo: true, material: true, proveedor: true, referenciaProveedor: true,
        isActive: true, isFeatured: true, categoryId: true,
        category: { select: { nombre: true } },
      },
    }),
    prisma.category.findMany({ where: { isActive: true }, select: { id: true, nombre: true, slug: true } }),
  ]);

  const productsBySku = new Map<string, ExistingProduct>(
    existingProducts.map((p) => [
      p.sku.trim().toLowerCase(),
      {
        id: p.id, sku: p.sku, nombre: p.nombre, descripcion: p.descripcion,
        precioBase: Number(p.precioBase), stock: p.stock, stockMinimo: p.stockMinimo,
        material: p.material, proveedor: p.proveedor, referenciaProveedor: p.referenciaProveedor,
        isActive: p.isActive, isFeatured: p.isFeatured, categoryId: p.categoryId,
        categoriaNombre: p.category.nombre,
      },
    ]),
  );

  const categoryByRef = new Map<string, CategoryRef>();
  for (const c of categories) {
    categoryByRef.set(c.slug.trim().toLowerCase(), c);
    categoryByRef.set(c.nombre.trim().toLowerCase(), c);
  }

  const skuCounts = new Map<string, number>();
  for (const r of rows) {
    const key = (r.sku ?? '').trim().toLowerCase();
    if (key) skuCounts.set(key, (skuCounts.get(key) ?? 0) + 1);
  }

  const results: ImportRowResult[] = rows.map((raw, index) => {
    const rowNumber = index + 2; // fila 1 = encabezados
    const errors: ImportRowError[] = [];
    const skuTrimmed = (raw.sku ?? '').trim();

    if (!skuTrimmed) {
      errors.push({ field: 'sku', value: '', message: 'SKU obligatorio.' });
      return { row: rowNumber, sku: '', nombre: raw.nombre ?? '', status: 'error', changes: [], errors };
    }

    const skuKey = skuTrimmed.toLowerCase();
    if ((skuCounts.get(skuKey) ?? 0) > 1) {
      errors.push({ field: 'sku', value: skuTrimmed, message: 'SKU duplicado dentro del archivo.' });
    }

    const existing = productsBySku.get(skuKey);
    const isNew = !existing;

    // --- Categoría ---
    let categoryRef: CategoryRef | undefined;
    if (raw.categoria !== null && raw.categoria !== undefined && raw.categoria.trim() !== '') {
      categoryRef = categoryByRef.get(raw.categoria.trim().toLowerCase());
      if (!categoryRef) {
        errors.push({ field: 'categoria', value: raw.categoria, message: `Categoría no encontrada: "${raw.categoria}".` });
      }
    } else if (isNew) {
      errors.push({ field: 'categoria', value: '', message: 'Categoría obligatoria para productos nuevos.' });
    }

    // --- Nombre ---
    const nombreTrimmed = raw.nombre?.trim() || '';
    if (isNew && !nombreTrimmed) {
      errors.push({ field: 'nombre', value: '', message: 'Nombre obligatorio para productos nuevos.' });
    } else if (raw.nombre !== null && raw.nombre !== undefined && nombreTrimmed.length > 255) {
      errors.push({ field: 'nombre', value: raw.nombre, message: 'Máximo 255 caracteres.' });
    }

    // --- Precio Base ---
    let precioBase: number | null = null;
    if (raw.precioBase !== null && raw.precioBase !== undefined && raw.precioBase.trim() !== '') {
      const n = parseNumber(raw.precioBase);
      if (n === null || Number.isNaN(n) || n <= 0) {
        errors.push({ field: 'precioBase', value: raw.precioBase, message: 'El precio debe ser un número mayor a 0.' });
      } else {
        precioBase = n;
      }
    } else if (isNew) {
      errors.push({ field: 'precioBase', value: '', message: 'Precio Base obligatorio para productos nuevos.' });
    }

    // --- Stock ---
    let stock: number | null = null;
    if (raw.stock !== null && raw.stock !== undefined && raw.stock.trim() !== '') {
      const n = parseNumber(raw.stock);
      if (n === null || Number.isNaN(n) || !Number.isInteger(n) || n < 0) {
        errors.push({ field: 'stock', value: raw.stock, message: 'El stock debe ser un número entero mayor o igual a 0.' });
      } else {
        stock = n;
      }
    }

    // --- Stock Mínimo ---
    let stockMinimo: number | null = null;
    if (raw.stockMinimo !== null && raw.stockMinimo !== undefined && raw.stockMinimo.trim() !== '') {
      const n = parseNumber(raw.stockMinimo);
      if (n === null || Number.isNaN(n) || !Number.isInteger(n) || n < 0) {
        errors.push({ field: 'stockMinimo', value: raw.stockMinimo, message: 'El stock mínimo debe ser un número entero mayor o igual a 0.' });
      } else {
        stockMinimo = n;
      }
    }

    // --- Booleanos ---
    let isActive: boolean | null = null;
    if (raw.isActive !== null && raw.isActive !== undefined && raw.isActive.trim() !== '') {
      const parsedBool = parseBoolean(raw.isActive);
      if (!parsedBool.ok) {
        errors.push({ field: 'isActive', value: raw.isActive, message: 'Valor booleano inválido. Usá "Sí" o "No".' });
      } else {
        isActive = parsedBool.value;
      }
    }

    let isFeatured: boolean | null = null;
    if (raw.isFeatured !== null && raw.isFeatured !== undefined && raw.isFeatured.trim() !== '') {
      const parsedBool = parseBoolean(raw.isFeatured);
      if (!parsedBool.ok) {
        errors.push({ field: 'isFeatured', value: raw.isFeatured, message: 'Valor booleano inválido. Usá "Sí" o "No".' });
      } else {
        isFeatured = parsedBool.value;
      }
    }

    // --- Texto libre (solo límites de longitud) ---
    const descripcion = raw.descripcion?.trim() || null;
    if (descripcion && descripcion.length > 5000) errors.push({ field: 'descripcion', value: descripcion, message: 'Máximo 5000 caracteres.' });
    const material = raw.material?.trim() || null;
    if (material && material.length > 100) errors.push({ field: 'material', value: material, message: 'Máximo 100 caracteres.' });
    const proveedor = raw.proveedor?.trim() || null;
    if (proveedor && proveedor.length > 100) errors.push({ field: 'proveedor', value: proveedor, message: 'Máximo 100 caracteres.' });
    const referenciaProveedor = raw.referenciaProveedor?.trim() || null;
    if (referenciaProveedor && referenciaProveedor.length > 100) errors.push({ field: 'referenciaProveedor', value: referenciaProveedor, message: 'Máximo 100 caracteres.' });

    if (errors.length > 0) {
      return { row: rowNumber, sku: skuTrimmed, nombre: nombreTrimmed || existing?.nombre || '', status: 'error', changes: [], errors };
    }

    if (isNew) {
      return {
        row: rowNumber,
        sku: skuTrimmed,
        nombre: nombreTrimmed,
        status: 'nuevo',
        changes: [],
        errors: [],
        applyData: {
          kind: 'create',
          data: {
            sku: skuTrimmed,
            nombre: nombreTrimmed,
            categoryId: categoryRef!.id,
            precioBase: precioBase!,
            stock: stock ?? 0,
            stockMinimo: stockMinimo ?? 0,
            descripcion: descripcion ?? undefined,
            material: material ?? undefined,
            proveedor: proveedor ?? undefined,
            referenciaProveedor: referenciaProveedor ?? undefined,
            isActive: isActive ?? undefined,
            isFeatured: isFeatured ?? undefined,
          },
        },
      };
    }

    // --- Actualización: comparar solo los campos presentes en el Excel ---
    const changes: ImportRowChange[] = [];
    const updateData: Record<string, string | number | boolean> = {};

    function diff(field: string, newValue: string | number | boolean | null, currentValue: string | number | boolean) {
      if (newValue === null) return; // celda vacía: no tocar
      if (newValue !== currentValue) {
        changes.push({ field, label: FIELD_LABELS[field] ?? field, from: String(currentValue), to: String(newValue) });
        updateData[field] = newValue;
      }
    }

    diff('nombre', raw.nombre !== null && raw.nombre !== undefined && nombreTrimmed !== '' ? nombreTrimmed : null, existing!.nombre);
    if (categoryRef) diff('categoria', categoryRef.nombre, existing!.categoriaNombre);
    if (categoryRef && categoryRef.id !== existing!.categoryId) updateData.categoryId = categoryRef.id;
    diff('precioBase', precioBase, existing!.precioBase);
    diff('stock', stock, existing!.stock);
    diff('stockMinimo', stockMinimo, existing!.stockMinimo);
    diff('descripcion', descripcion, existing!.descripcion ?? '');
    diff('material', material, existing!.material ?? '');
    diff('proveedor', proveedor, existing!.proveedor ?? '');
    diff('referenciaProveedor', referenciaProveedor, existing!.referenciaProveedor ?? '');
    diff('isActive', isActive, existing!.isActive);
    diff('isFeatured', isFeatured, existing!.isFeatured);

    if (changes.length === 0) {
      return { row: rowNumber, sku: skuTrimmed, nombre: existing!.nombre, status: 'sin_cambios', changes: [], errors: [] };
    }

    return {
      row: rowNumber,
      sku: skuTrimmed,
      nombre: nombreTrimmed || existing!.nombre,
      status: 'actualizar',
      changes,
      errors: [],
      applyData: { kind: 'update', id: existing!.id, data: updateData },
    };
  });

  return {
    totalRows: results.length,
    nuevos: results.filter((r) => r.status === 'nuevo').length,
    actualizados: results.filter((r) => r.status === 'actualizar').length,
    sinCambios: results.filter((r) => r.status === 'sin_cambios').length,
    conErrores: results.filter((r) => r.status === 'error').length,
    rows: results,
  };
}

/**
 * Aplica la importación dentro de una única transacción: todo o nada.
 * Nunca se llama con filas en estado 'error' (se filtran antes).
 */
export async function applyImport(rows: ImportRowResult[]): Promise<{ creados: number; actualizados: number }> {
  const toApply = rows.filter((r) => r.status === 'nuevo' || r.status === 'actualizar');
  let creados = 0;
  let actualizados = 0;

  await prisma.$transaction(async (tx) => {
    for (const row of toApply) {
      if (!row.applyData) continue;

      if (row.applyData.kind === 'create') {
        await tx.product.create({ data: row.applyData.data });
        creados += 1;
      } else {
        await tx.product.update({ where: { id: row.applyData.id }, data: row.applyData.data });
        actualizados += 1;
      }
    }
  });

  return { creados, actualizados };
}
