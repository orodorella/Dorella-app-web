import { z } from 'zod';

export const CreateCatalogoSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido').max(255),
  configuracion: z.object({
    negocio: z.string().min(1).max(255),
    logo_url: z.string().url().nullable().optional().default(null),
    color_principal: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color hex inválido').default('#1A1A1A'),
    mostrar_precios: z.boolean().default(false),
  }),
});

export const UpdateCatalogoSchema = z.object({
  nombre: z.string().min(1).max(255).optional(),
  configuracion: z.object({
    negocio: z.string().min(1).max(255).optional(),
    logo_url: z.string().url().nullable().optional(),
    color_principal: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    mostrar_precios: z.boolean().optional(),
  }).optional(),
});

export const AddProductosSchema = z.object({
  productos: z.array(z.object({
    productId: z.string().uuid(),
    precioPersonalizado: z.number().int().positive().nullable().optional().default(null),
  })).min(1, 'Debe incluir al menos un producto'),
});

export const ReorderSchema = z.object({
  orden: z.array(z.object({
    productId: z.string().uuid(),
    orden: z.number().int().min(0),
  })),
});
