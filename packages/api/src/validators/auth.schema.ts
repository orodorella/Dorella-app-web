import { z } from 'zod';

export const RegisterSchema = z.object({
  email: z.string().email('Email inválido').max(255),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').max(128),
  nombre: z.string().min(1, 'El nombre es requerido').max(255),
  apellido: z.string().max(255).optional().default(''),
  telefono: z.string().max(20).optional(),
  empresa: z.string().max(255).optional(),
  nit: z.string().max(20).optional(),
});

export const LoginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'La contraseña es requerida'),
});

export const UpdateProfileSchema = z.object({
  nombre: z.string().min(1).max(255).optional(),
  email: z.string().email('Email inválido').max(255).optional(),
  telefono: z.string().max(20).optional(),
  ciudad: z.string().max(100).optional(),
  direccion: z.string().max(500).optional(),
}).refine((data) => Object.values(data).some((v) => v !== undefined), {
  message: 'Al menos un campo debe ser enviado',
});

export const ChangePasswordSchema = z.object({
  passwordActual: z.string().min(1, 'La contraseña actual es requerida'),
  passwordNueva: z.string().min(8, 'La nueva contraseña debe tener al menos 8 caracteres').max(128),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;
