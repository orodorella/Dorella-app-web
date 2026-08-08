import { z } from 'zod';

export const CreateCategorySchema = z.object({
  nombre: z.string().min(1, 'Nombre requerido').max(255),
  slug: z.string().min(1, 'Slug requerido').max(255)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'El slug solo puede tener minúsculas, números y guiones'),
  descripcion: z.string().max(2000).optional(),
  imagenUrl: z.string().url().max(500).optional(),
  orden: z.number().int().min(0).default(0),
});

export const UpdateCategorySchema = CreateCategorySchema.partial();

export const CategoryVisibilitySchema = z.object({
  isActive: z.boolean(),
});

export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof UpdateCategorySchema>;
