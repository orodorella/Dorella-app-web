import { z } from 'zod';

export const requestSensitiveUserChangeSchema = z.object({
  changeType: z.enum(['tier', 'role']),
  requestedValue: z.string().trim().min(1).max(50),
});

export const confirmSensitiveUserChangeSchema = z.object({
  verificationId: z.string().uuid(),
  code: z.string().trim().regex(/^\d{6}$/, 'El código debe tener 6 dígitos'),
});

export type RequestSensitiveUserChangeInput = z.infer<typeof requestSensitiveUserChangeSchema>;
export type ConfirmSensitiveUserChangeInput = z.infer<typeof confirmSensitiveUserChangeSchema>;
