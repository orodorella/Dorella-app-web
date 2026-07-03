import { Router, type IRouter } from 'express';
import { requireAuth, requireRole } from '../../middleware/requireRole.js';
import { CreateProductSchema, UpdateProductSchema, StockAdjustSchema } from '../../validators/product.schema.js';
import * as inventoryService from '../../services/inventory.service.js';
import { success, error } from '../../utils/response.js';

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

export default router;
