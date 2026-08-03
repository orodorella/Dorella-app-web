import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url().optional(),

  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_KEY: z.string().min(1),
  SUPABASE_ANON_KEY: z.string().min(1).optional(),

  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),

  ALEGRA_USER: z.string().email().optional(),
  ALEGRA_TOKEN: z.string().min(1).optional(),

  REDIS_URL: z.string().optional(),

  RESEND_API_KEY: z.string().optional(),
  MERCADOPAGO_ACCESS_TOKEN: z.string().optional(),
  MERCADOPAGO_WEBHOOK_SECRET: z.string().optional(),
  API_PUBLIC_URL: z.string().url().optional(),
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
  FRONTEND_URL: z.string().url().optional(),
  SITE_URL: z.string().url().optional(),

  CORS_ORIGIN: z.string().refine(
    (val) => process.env.NODE_ENV !== 'production' || val !== 'http://localhost:3000',
    { message: 'CORS_ORIGIN must be explicitly set in production' },
  ).default('http://localhost:3000'),
  PORT: z.coerce.number().default(3001),

  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Invalid environment variables:');
    for (const issue of result.error.issues) {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
  }
  return result.data;
}

export const env = loadEnv();
