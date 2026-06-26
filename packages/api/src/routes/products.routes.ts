import { Router, type IRouter } from 'express';
import { ProductQuerySchema } from '../validators/product.schema.js';
import * as inventoryService from '../services/inventory.service.js';
import { publicLimiter } from '../middleware/rateLimiter.js';
import { success, error } from '../utils/response.js';

const router: IRouter = Router();

router.get('/', publicLimiter, async (req, res, next) => {
  try {
    const parsed = ProductQuerySchema.safeParse(req.query);
    const filters = parsed.success
      ? { categoria: parsed.data.categoria, search: parsed.data.search, soloDisponibles: parsed.data.soloDisponibles }
      : {};

    const tier = req.user?.tier ?? null;
    const result = await inventoryService.getProducts(tier, filters, req.query as Record<string, unknown>);

    success(res, result.data, 200, result.meta);
  } catch (err) {
    next(err);
  }
});

router.get('/featured', async (req, res, next) => {
  try {
    const tier = req.user?.tier ?? null;
    const products = await inventoryService.getFeaturedProducts(tier);
    success(res, products);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const tier = req.user?.tier ?? null;
    const product = await inventoryService.getProductById(req.params.id, tier);

    if (!product) {
      error(res, 404, 'NOT_FOUND', 'Producto no encontrado');
      return;
    }

    success(res, product);
  } catch (err) {
    next(err);
  }
});

export default router;
