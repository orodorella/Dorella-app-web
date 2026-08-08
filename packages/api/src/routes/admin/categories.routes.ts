import { Router, type IRouter } from 'express';
import { requireAuth, requireRole } from '../../middleware/requireRole.js';
import {
  CreateCategorySchema,
  UpdateCategorySchema,
  CategoryVisibilitySchema,
} from '../../validators/category.schema.js';
import * as inventoryService from '../../services/inventory.service.js';
import { success, error } from '../../utils/response.js';

const router: IRouter = Router();

router.use(requireAuth);
router.use(requireRole('admin'));

router.get('/', async (_req, res, next) => {
  try {
    const categories = await inventoryService.getAdminCategories();
    success(res, categories);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const input = CreateCategorySchema.parse(req.body);
    const category = await inventoryService.createCategory(input);
    success(res, category, 201);
  } catch (err) {
    if (err instanceof inventoryService.CategoryError) {
      error(res, 409, err.code, err.message);
      return;
    }
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const input = UpdateCategorySchema.parse(req.body);
    const category = await inventoryService.updateCategory(req.params.id, input);

    if (!category) {
      error(res, 404, 'NOT_FOUND', 'Categoría no encontrada');
      return;
    }

    success(res, category);
  } catch (err) {
    if (err instanceof inventoryService.CategoryError) {
      error(res, 409, err.code, err.message);
      return;
    }
    next(err);
  }
});

router.patch('/:id/visibility', async (req, res, next) => {
  try {
    const { isActive } = CategoryVisibilitySchema.parse(req.body);
    const category = await inventoryService.setCategoryVisibility(req.params.id, isActive, req.user!.id);

    if (!category) {
      error(res, 404, 'NOT_FOUND', 'Categoría no encontrada');
      return;
    }

    success(res, category);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const result = await inventoryService.deleteCategory(req.params.id, req.user!.id);

    if (!result) {
      error(res, 404, 'NOT_FOUND', 'Categoría no encontrada');
      return;
    }

    success(res, result);
  } catch (err) {
    next(err);
  }
});

export default router;
