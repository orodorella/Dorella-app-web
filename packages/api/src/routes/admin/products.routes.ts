import { Router, type IRouter } from 'express';
import { requireAuth, requireRole } from '../../middleware/requireRole.js';
import { CreateProductSchema, UpdateProductSchema, StockAdjustSchema } from '../../validators/product.schema.js';
import * as inventoryService from '../../services/inventory.service.js';
import { uploadProductImage, deleteProductImage } from '../../services/storage.service.js';
import { success, error } from '../../utils/response.js';
import { prisma } from '../../config/db.js';
import Busboy from 'busboy';

const router: IRouter = Router();

router.use(requireAuth);
router.use(requireRole('admin'));

router.get('/', async (req, res, next) => {
  try {
    const result = await inventoryService.getAdminProducts(req.query as Record<string, unknown>);
    success(res, result.data, 200, result.meta);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const input = CreateProductSchema.parse(req.body);
    const product = await inventoryService.createProduct(input);
    success(res, {
      id: product.id,
      sku: product.sku,
      nombre: product.nombre,
      precioBase: Number(product.precioBase),
      stock: product.stock,
      categoria: product.category,
    }, 201);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const input = UpdateProductSchema.parse(req.body);
    const product = await inventoryService.updateProduct(req.params.id, input);

    if (!product) {
      error(res, 404, 'NOT_FOUND', 'Producto no encontrado');
      return;
    }

    success(res, {
      id: product.id,
      sku: product.sku,
      nombre: product.nombre,
      precioBase: Number(product.precioBase),
      stock: product.stock,
      isActive: product.isActive,
      categoria: product.category,
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/stock', async (req, res, next) => {
  try {
    const { stock } = StockAdjustSchema.parse(req.body);
    const product = await inventoryService.adjustStock(req.params.id, stock);

    if (!product) {
      error(res, 404, 'NOT_FOUND', 'Producto no encontrado');
      return;
    }

    success(res, { id: product.id, stock: product.stock });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const product = await inventoryService.softDeleteProduct(req.params.id, req.user!.id);

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
          const ext = file.filename.split('.').pop() || 'jpg';
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

export default router;
