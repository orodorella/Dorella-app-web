import { Router, type IRouter } from 'express';
import { requireAuth } from '../middleware/requireRole.js';
import { CreateCatalogoSchema, UpdateCatalogoSchema, AddProductosSchema, ReorderSchema } from '../validators/catalog.schema.js';
import * as catalogService from '../services/catalog.service.js';
import { success, error } from '../utils/response.js';

const router: IRouter = Router();

// Public route — must be before auth middleware
router.get('/p/:slug', async (req, res, next) => {
  try {
    const catalogo = await catalogService.getCatalogoPublico(req.params.slug);
    if (!catalogo) {
      error(res, 404, 'NOT_FOUND', 'Catálogo no encontrado');
      return;
    }
    success(res, catalogo);
  } catch (err) {
    next(err);
  }
});

// All routes below require auth
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const catalogos = await catalogService.getCatalogos(req.user!.id);
    success(res, catalogos);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const input = CreateCatalogoSchema.parse(req.body);
    const catalogo = await catalogService.createCatalogo(req.user!.id, input);
    success(res, catalogo, 201);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const catalogo = await catalogService.getCatalogoById(req.params.id, req.user!.id);
    if (!catalogo) {
      error(res, 404, 'NOT_FOUND', 'Catálogo no encontrado');
      return;
    }
    success(res, catalogo);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const input = UpdateCatalogoSchema.parse(req.body);
    const catalogo = await catalogService.updateCatalogo(req.params.id, req.user!.id, input);
    if (!catalogo) {
      error(res, 404, 'NOT_FOUND', 'Catálogo no encontrado');
      return;
    }
    success(res, catalogo);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const result = await catalogService.deleteCatalogo(req.params.id, req.user!.id);
    if (!result) {
      error(res, 404, 'NOT_FOUND', 'Catálogo no encontrado');
      return;
    }
    success(res, { id: result.id, activo: result.activo });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/toggle', async (req, res, next) => {
  try {
    const result = await catalogService.toggleCatalogo(req.params.id, req.user!.id);
    if (!result) {
      error(res, 404, 'NOT_FOUND', 'Catálogo no encontrado');
      return;
    }
    success(res, { id: result.id, activo: result.activo });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/productos', async (req, res, next) => {
  try {
    const { productos } = AddProductosSchema.parse(req.body);
    const result = await catalogService.addProductos(req.params.id, req.user!.id, productos);
    if (!result) {
      error(res, 404, 'NOT_FOUND', 'Catálogo no encontrado');
      return;
    }
    success(res, result, 201);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id/productos/:productId', async (req, res, next) => {
  try {
    const result = await catalogService.removeProducto(req.params.id, req.user!.id, req.params.productId);
    if (!result) {
      error(res, 404, 'NOT_FOUND', 'Catálogo no encontrado');
      return;
    }
    success(res, { removed: true });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/productos/orden', async (req, res, next) => {
  try {
    const { orden } = ReorderSchema.parse(req.body);
    const result = await catalogService.reorderProductos(req.params.id, req.user!.id, orden);
    if (!result) {
      error(res, 404, 'NOT_FOUND', 'Catálogo no encontrado');
      return;
    }
    success(res, { reordered: true });
  } catch (err) {
    next(err);
  }
});

export default router;
