import { Router, type IRouter } from 'express';
import * as inventoryService from '../services/inventory.service.js';
import { success } from '../utils/response.js';

const router: IRouter = Router();

router.get('/', async (_req, res, next) => {
  try {
    const categories = await inventoryService.getCategories();
    success(res, categories);
  } catch (err) {
    next(err);
  }
});

export default router;
