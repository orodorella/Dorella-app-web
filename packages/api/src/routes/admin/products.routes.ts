import { Router, type IRouter, type Request } from 'express';
import { requireAuth } from '../../middleware/requireRole.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { hasPermission } from 'shared/src/constants/permissions.js';
import { recordAudit } from '../../services/audit.service.js';
import {
  CreateProductSchema,
  UpdateProductSchema,
  StockAdjustSchema,
  ProductVisibilitySchema,
} from '../../validators/product.schema.js';
import * as inventoryService from '../../services/inventory.service.js';
import { uploadProductImage, deleteProductImage } from '../../services/storage.service.js';
import { success, error } from '../../utils/response.js';
import { prisma } from '../../config/db.js';
import Busboy from 'busboy';
import { parseWorkbookBuffer, buildImportPreview, applyImport, type ImportRowResult } from '../../services/product-import.service.js';
import { exportProductsWorkbook, generateProductTemplateWorkbook } from '../../services/product-export.service.js';

const router: IRouter = Router();

router.use(requireAuth);
router.use(requirePermission('products:manage', 'inventory:manage'));

// Bodega gestiona stock y datos del producto, pero no ve ni cambia precios:
// precioBase/precio solo se devuelven a quien tiene acceso financiero. Crear y
// borrar productos, importar y exportar el catálogo también quedan para admin.
const canSeePrices = (req: Request) => hasPermission(req.user!.role, 'finance:read');

router.get('/providers', async (_req, res, next) => {
  try {
    success(res, await inventoryService.getProductProviders());
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const result = await inventoryService.getAdminProducts(req.query as Record<string, unknown>);
    const data = canSeePrices(req)
      ? result.data
      : result.data.map((p) => ({ ...p, precioBase: null, precio: null }));
    success(res, data, 200, result.meta);
  } catch (err) {
    next(err);
  }
});

router.post('/', requirePermission('finance:read'), async (req, res, next) => {
  try {
    const input = CreateProductSchema.parse(req.body);
    const product = await inventoryService.createProduct(input);
    success(res, {
      id: product.id,
      sku: product.sku,
      nombre: product.nombre,
      precioBase: Number(product.precioBase),
      stock: product.stock,
      stockMinimo: product.stockMinimo,
      categoria: product.category,
    }, 201);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const parsed = UpdateProductSchema.parse(req.body);
    // Sin acceso financiero el precio base no se puede modificar.
    const { precioBase: _ignored, ...withoutPrice } = parsed;
    const withPriceRule = canSeePrices(req) ? parsed : withoutPrice;
    // El stock NO se cambia por aquí: va por el ajuste con bloqueo, validación contra lo reservado y trazabilidad.
    const { stock: nuevoStock, ...input } = withPriceRule;
    const id = String(req.params.id);
    if (nuevoStock !== undefined) {
      const ajustado = await inventoryService.adjustStock(id, nuevoStock, req.user!.id);
      if (!ajustado) {
        error(res, 404, 'NOT_FOUND', 'Producto no encontrado');
        return;
      }
    }
    const product = await inventoryService.updateProduct(id, input);

    if (!product) {
      error(res, 404, 'NOT_FOUND', 'Producto no encontrado');
      return;
    }

    success(res, {
      id: product.id,
      sku: product.sku,
      nombre: product.nombre,
      precioBase: canSeePrices(req) ? Number(product.precioBase) : null,
      stock: product.stock,
      stockMinimo: product.stockMinimo,
      isActive: product.isActive,
      categoria: product.category,
    });
  } catch (err) {
    if (err instanceof inventoryService.StockAdjustError) {
      error(res, 409, err.code, err.message);
      return;
    }
    next(err);
  }
});

router.patch('/:id/stock', async (req, res, next) => {
  try {
    const { stock } = StockAdjustSchema.parse(req.body);
    const product = await inventoryService.adjustStock(String(req.params.id), stock, req.user!.id);

    if (!product) {
      error(res, 404, 'NOT_FOUND', 'Producto no encontrado');
      return;
    }

    success(res, { id: product.id, stock: product.stock });
  } catch (err) {
    if (err instanceof inventoryService.StockAdjustError) {
      error(res, 409, err.code, err.message);
      return;
    }
    next(err);
  }
});

// Publicar/ocultar en la tienda es solo del administrador (bodega gestiona productos e inventario, no la publicación).
router.patch('/:id/visibility', requirePermission('finance:read'), async (req, res, next) => {
  try {
    const { isActive } = ProductVisibilitySchema.parse(req.body);
    const product = await inventoryService.setProductVisibility(
      String(req.params.id),
      isActive,
      req.user!.id,
    );

    if (!product) {
      error(res, 404, 'NOT_FOUND', 'Producto no encontrado');
      return;
    }

    success(res, product);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requirePermission('finance:read'), async (req, res, next) => {
  try {
    const product = await inventoryService.softDeleteProduct(String(req.params.id), req.user!.id);

    if (!product) {
      error(res, 404, 'NOT_FOUND', 'Producto no encontrado');
      return;
    }

    success(res, { id: product.id, isActive: product.isActive });
  } catch (err) {
    next(err);
  }
});

const MAX_IMAGES = 5;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

router.post('/:id/images', async (req, res, next) => {
  try {
    const { id } = req.params;
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      error(res, 404, 'NOT_FOUND', 'Producto no encontrado');
      return;
    }

    const currentImages = product.imagenes as string[];
    if (currentImages.length >= MAX_IMAGES) {
      error(res, 400, 'LIMIT_EXCEEDED', `Máximo ${MAX_IMAGES} imágenes por producto`);
      return;
    }

    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('multipart/form-data')) {
      error(res, 400, 'INVALID_CONTENT_TYPE', 'Se esperaba multipart/form-data');
      return;
    }

    const busboy = Busboy({ headers: req.headers, limits: { files: MAX_IMAGES, fileSize: MAX_FILE_SIZE } });
    const files: Array<{ buffer: Buffer; filename: string; mimetype: string }> = [];

    busboy.on('file', (_fieldname, stream, info) => {
      const { filename, mimeType } = info;

      if (!ALLOWED_TYPES.includes(mimeType)) {
        stream.destroy();
        return;
      }

      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => {
        files.push({
          buffer: Buffer.concat(chunks),
          filename,
          mimetype: mimeType,
        });
      });
    });

    busboy.on('finish', async () => {
      try {
        if (files.length === 0) {
          error(res, 400, 'NO_VALID_FILES', 'No se encontraron archivos válidos (jpg, png, webp)');
          return;
        }

        if (currentImages.length + files.length > MAX_IMAGES) {
          error(res, 400, 'LIMIT_EXCEEDED', `Solo puedes agregar ${MAX_IMAGES - currentImages.length} imagen(es) más`);
          return;
        }

        const uploadedUrls: string[] = [];
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const rawExt = file.filename.split('.').pop() || 'jpg';
          const ext = rawExt.replace(/[^a-zA-Z0-9]/g, '').slice(0, 5) || 'jpg';
          const uniqueName = `${Date.now()}-${i}.${ext}`;
          const url = await uploadProductImage(id, {
            buffer: file.buffer,
            filename: uniqueName,
            mimetype: file.mimetype,
          });
          uploadedUrls.push(url);
        }

        const allImages = [...currentImages, ...uploadedUrls];
        await prisma.product.update({ where: { id }, data: { imagenes: allImages } });
        success(res, allImages);
      } catch (err) {
        next(err);
      }
    });

    req.pipe(busboy);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id/images/:index', async (req, res, next) => {
  try {
    const { id, index } = req.params;
    const idx = parseInt(index, 10);

    if (isNaN(idx) || idx < 0) {
      error(res, 400, 'INVALID_INDEX', 'Índice de imagen inválido');
      return;
    }

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      error(res, 404, 'NOT_FOUND', 'Producto no encontrado');
      return;
    }

    const images = product.imagenes as string[];
    if (idx >= images.length) {
      error(res, 400, 'INVALID_INDEX', 'Índice fuera de rango');
      return;
    }

    const imageUrl = images[idx];
    await deleteProductImage(imageUrl);

    const updated = images.filter((_, i) => i !== idx);
    await prisma.product.update({ where: { id }, data: { imagenes: updated } });
    success(res, updated);
  } catch (err) {
    next(err);
  }
});

// --- Import / Export de productos (Excel/CSV) ---

const MAX_EXCEL_SIZE = 10 * 1024 * 1024; // 10MB

function readSingleFile(req: Request): Promise<{ buffer: Buffer; filename: string }> {
  return new Promise((resolve, reject) => {
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('multipart/form-data')) {
      reject(new Error('Se esperaba multipart/form-data'));
      return;
    }

    const busboy = Busboy({ headers: req.headers, limits: { files: 1, fileSize: MAX_EXCEL_SIZE } });
    let found: { buffer: Buffer; filename: string } | null = null;
    let tooLarge = false;

    busboy.on('file', (_fieldname, stream, info) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('limit', () => { tooLarge = true; });
      stream.on('end', () => {
        if (!tooLarge) found = { buffer: Buffer.concat(chunks), filename: info.filename };
      });
    });

    busboy.on('finish', () => {
      if (tooLarge) { reject(new Error('El archivo supera el tamaño máximo de 10MB')); return; }
      if (!found) { reject(new Error('No se recibió ningún archivo')); return; }
      resolve(found);
    });
    busboy.on('error', reject);

    req.pipe(busboy);
  });
}

router.post('/import/preview', requirePermission('finance:read'), async (req, res, next) => {
  try {
    const { buffer, filename } = await readSingleFile(req);
    const rawRows = await parseWorkbookBuffer(buffer, filename);

    if (rawRows.length === 0) {
      error(res, 400, 'EMPTY_FILE', 'El archivo no tiene filas de datos');
      return;
    }

    const preview = await buildImportPreview(rawRows);
    success(res, preview);
  } catch (err) {
    if (err instanceof Error) {
      error(res, 400, 'IMPORT_PARSE_ERROR', err.message);
      return;
    }
    next(err);
  }
});

router.post('/import/confirm', requirePermission('finance:read'), async (req, res, next) => {
  try {
    const { buffer, filename } = await readSingleFile(req);
    const rawRows = await parseWorkbookBuffer(buffer, filename);

    // Se re-valida todo desde cero contra el estado actual de la BD — nunca
    // confiamos en el resultado de un preview anterior, pudo haber cambiado.
    const preview = await buildImportPreview(rawRows);

    if (preview.conErrores > 0) {
      error(res, 400, 'IMPORT_HAS_ERRORS', 'El archivo tiene filas con errores. Corregilas antes de confirmar.');
      return;
    }

    const applicable: ImportRowResult[] = preview.rows.filter(
      (r) => r.status === 'nuevo' || r.status === 'actualizar',
    );

    if (applicable.length === 0) {
      success(res, { creados: 0, actualizados: 0, sinCambios: preview.sinCambios });
      return;
    }

    const result = await applyImport(applicable);
    // La importación fija stock absoluto: queda constancia de quién y cuántos productos (detalle por producto en el archivo).
    await recordAudit({ actorId: req.user!.id, action: 'products.import_applied', entityType: 'product', after: { creados: result.creados, actualizados: result.actualizados, archivo: filename } });
    success(res, { ...result, sinCambios: preview.sinCambios });
  } catch (err) {
    if (err instanceof Error) {
      error(res, 400, 'IMPORT_ERROR', err.message);
      return;
    }
    next(err);
  }
});

router.get('/export', requirePermission('finance:read'), async (req, res, next) => {
  try {
    const categoria = typeof req.query.categoria === 'string' ? req.query.categoria.trim() : '';
    const buffer = await exportProductsWorkbook(categoria || undefined);
    const safeCategoria = categoria.replace(/[^a-z0-9-]/gi, '');
    const filename = safeCategoria
      ? `productos-dorella-${safeCategoria}.xlsx`
      : 'productos-dorella.xlsx';
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.from(buffer));
  } catch (err) {
    next(err);
  }
});

router.get('/import/template', requirePermission('finance:read'), async (_req, res, next) => {
  try {
    const buffer = await generateProductTemplateWorkbook();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="plantilla-productos-dorella.xlsx"');
    res.send(Buffer.from(buffer));
  } catch (err) {
    next(err);
  }
});

export default router;
