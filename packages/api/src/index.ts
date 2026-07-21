import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { env } from './config/env.js';
import { authMiddleware } from './middleware/auth.js';
import { generalLimiter } from './middleware/rateLimiter.js';
import { errorHandler } from './middleware/errorHandler.js';
import { success } from './utils/response.js';
import authRoutes from './routes/auth.routes.js';
import productsRoutes from './routes/products.routes.js';
import categoriesRoutes from './routes/categories.routes.js';
import adminProductsRoutes from './routes/admin/products.routes.js';
import ordersRoutes from './routes/orders.routes.js';
import adminOrdersRoutes from './routes/admin/orders.routes.js';
import adminUsersRoutes from './routes/admin/users.routes.js';
import adminDashboardRoutes from './routes/admin/dashboard.routes.js';
import catalogRoutes from './routes/catalog.routes.js';

const app: ReturnType<typeof express> = express();

app.use(helmet());
app.use(cors({
  origin: env.CORS_ORIGIN,
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(generalLimiter);
app.use(authMiddleware);

app.get('/api/health', (_req, res) => {
  success(res, { status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/admin/products', adminProductsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/admin/orders', adminOrdersRoutes);
app.use('/api/admin/users', adminUsersRoutes);
app.use('/api/admin/dashboard', adminDashboardRoutes);
app.use('/api/catalogos', catalogRoutes);

app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`API running on http://localhost:${env.PORT}`);
});

export default app;
