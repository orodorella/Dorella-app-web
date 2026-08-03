import { z } from 'zod';

export const CreateMercadoPagoPreferenceSchema = z.object({
  orderId: z.string().uuid('ID de orden inválido'),
});

export type CreateMercadoPagoPreferenceInput = z.infer<typeof CreateMercadoPagoPreferenceSchema>;
