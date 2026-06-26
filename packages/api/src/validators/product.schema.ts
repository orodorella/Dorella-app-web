import { z } from 'zod';

export const CreateProductSchema = z.object({
  sku: z.string().min(1, 'SKU requerido').max(50),
  nombre: z.string().min(1, 'Nombre requerido').max(255),
  descripcion: z.string().max(5000).optional(),
  precioBase: z.number().positive('El precio debe ser positivo'),
  categoryId: z.string().uuid('ID de categoría inválido'),
  imagenes: z.array(z.string().url()).default([]),
  material: z.string().max(100).optional(),
  pesoGramos: z.number().positive().optional(),
  stock: z.number().int().min(0).default(0),
  isFeatured: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
});

export const UpdateProductSchema = CreateProductSchema.partial();

export const StockAdjustSchema = z.object({
  stock: z.number().int().min(0, 'El stock no puede ser negativo'),
});

export const ProductQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  categoria: z.string().optional(),
  search: z.string().optional(),
  soloDisponibles: z.coerce.boolean().default(false),
});

export type CreateProductInput = z.infer<typeof CreateProductSchema>;
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;
