import { z } from 'zod';

export const CreateOrderSchema = z.object({
  items: z.array(z.object({
    productId: z.string().uuid('ID de producto inválido'),
    cantidad: z.number().int().min(1, 'La cantidad mínima es 1'),
  })).min(1, 'Debe incluir al menos un producto'),
  notas: z.string().max(1000).optional(),
  envio: z.object({
    telefonoIndicativo: z.string().trim().min(1, 'El indicativo es requerido').max(10).regex(/^\d+$/, 'El indicativo es inválido'),
    telefonoNumero: z.string().trim().min(6, 'El número es inválido').max(25).regex(/^[0-9 ()-]+$/, 'El número es inválido'),
    telefonoCompleto: z.string().trim().min(7, 'El teléfono completo es inválido').max(40),
    pais: z.string().trim().min(1, 'El país es requerido').max(120),
    paisCodigo: z.string().trim().length(2, 'El código de país debe tener 2 caracteres'),
    region: z.string().trim().min(1, 'La región es requerida').max(120),
    regionCodigo: z.string().trim().max(20).nullable().optional().default(null),
    ciudad: z.string().trim().min(1, 'La ciudad es requerida').max(120),
    direccion: z.string().trim().min(1, 'La dirección es requerida').max(500),
    referencias: z.string().trim().max(255).optional().default(''),
  }).strict(),
});

const ManualOrderItemSchema = z.object({
  productId: z.string().uuid('ID de producto inválido'),
  cantidad: z.number().int().min(1, 'La cantidad mínima es 1').max(10_000),
}).strict();

export const CreateManualOrderSchema = z.object({
  comprador: z.object({
    nombre: z.string().trim().min(1, 'El nombre es requerido').max(255),
    apellido: z.string().trim().min(1, 'El apellido es requerido').max(255),
    telefono: z.string().trim().min(7, 'El teléfono es inválido').max(20).regex(/^\+?[0-9 ()-]+$/, 'El teléfono es inválido'),
    ciudad: z.string().trim().min(1, 'La ciudad es requerida').max(100),
    direccion: z.string().trim().min(1, 'La dirección es requerida').max(500),
    informacionEntrega: z.string().trim().max(500).optional().default(''),
    correo: z.preprocess(
      (value) => typeof value === 'string' && value.trim() === '' ? null : value,
      z.string().trim().email('El correo es inválido').max(255).nullable().optional().default(null),
    ),
  }).strict(),
  items: z.array(ManualOrderItemSchema).min(1, 'Debe incluir al menos un producto').max(200),
  notas: z.string().trim().max(1000).optional().default('Pedido recibido por WhatsApp'),
}).strict();

export const OrderQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['pending', 'confirmed', 'invoiced', 'shipped', 'delivered', 'cancelled']).optional(),
});

export const UpdateOrderStatusSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'invoiced', 'shipped', 'delivered', 'cancelled']),
});

export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;
export type CreateManualOrderInput = z.infer<typeof CreateManualOrderSchema>;
