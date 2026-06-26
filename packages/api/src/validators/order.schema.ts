import { z } from 'zod';

export const CreateOrderSchema = z.object({
  items: z.array(z.object({
    productId: z.string().uuid('ID de producto inválido'),
    cantidad: z.number().int().min(1, 'La cantidad mínima es 1'),
  })).min(1, 'Debe incluir al menos un producto'),
  notas: z.string().max(1000).optional(),
});

export const OrderQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['pending', 'confirmed', 'invoiced', 'shipped', 'delivered', 'cancelled']).optional(),
});

export const UpdateOrderStatusSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'invoiced', 'shipped', 'delivered', 'cancelled']),
});

export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;
