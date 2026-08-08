import { z } from 'zod';

export const CreateCatalogoSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido').max(255),
  configuracion: z.object({
    negocio: z.string().min(1).max(255),
    logo_url: z.string().url().nullable().optional().default(null),
    color_principal: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color hex inválido').default('#1A1A1A'),
    mostrar_precios: z.boolean().default(false),
    modo_precios: z.enum(['detal', 'personalizado']).default('detal'),
  }),
  includeAllProducts: z.boolean().optional().default(false),
  productIds: z.array(z.string().uuid()).optional().default([]),
}).superRefine((data, ctx) => {
  if (!data.includeAllProducts && data.productIds.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['productIds'],
      message: 'Debes seleccionar al menos un producto o activar "Seleccionar todos los productos".',
    });
  }
});

export const UpdateCatalogoSchema = z.object({
  nombre: z.string().min(1).max(255).optional(),
  configuracion: z.object({
    negocio: z.string().min(1).max(255).optional(),
    logo_url: z.string().url().nullable().optional(),
    color_principal: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    mostrar_precios: z.boolean().optional(),
    modo_precios: z.enum(['detal', 'personalizado']).optional(),
  }).optional(),
});

export const AddProductosSchema = z.object({
  productos: z.array(z.object({
    productId: z.string().uuid(),
    precioPersonalizado: z.number().positive().multipleOf(0.01).nullable().optional().default(null),
  })).min(1, 'Debe incluir al menos un producto'),
});

export const ReorderSchema = z.object({
  orden: z.array(z.object({
    productId: z.string().uuid(),
    orden: z.number().int().min(0),
  })),
});

export const CatalogProductQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  search: z.string().trim().optional(),
  categoryId: z.string().uuid().optional(),
  isActive: z.coerce.boolean().default(true),
});
