import { Router, type IRouter } from 'express';
import {
  RegisterSchema,
  LoginSchema,
  UpdateProfileSchema,
  ChangePasswordSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
} from '../validators/auth.schema.js';
import * as authService from '../services/auth.service.js';
import { requireAuth } from '../middleware/requireRole.js';
import { loginLimiter } from '../middleware/rateLimiter.js';
import { success, error } from '../utils/response.js';

const router: IRouter = Router();

router.post('/register', loginLimiter, async (req, res, next) => {
  try {
    const input = RegisterSchema.parse(req.body);
    const result = await authService.register(input);

    if ('error' in result) {
      error(res, 409, 'EMAIL_EXISTS', 'Ya existe una cuenta con este email');
      return;
    }

    success(res, { user: result.user, accessToken: result.accessToken, refreshToken: result.refreshToken }, 201);
  } catch (err) {
    next(err);
  }
});

router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const input = LoginSchema.parse(req.body);
    const result = await authService.login(input.email, input.password);

    if ('error' in result) {
      console.warn(`[SECURITY] Failed login attempt for ${input.email} from ${req.ip}: ${result.error}`);
      if (result.error === 'OAUTH_USER') {
        error(res, 400, 'OAUTH_USER', 'Esta cuenta usa Google. Iniciá sesión con Google.');
        return;
      }
      error(res, 401, 'INVALID_CREDENTIALS', 'Email o contraseña incorrectos');
      return;
    }

    success(res, { user: result.user, accessToken: result.accessToken, refreshToken: result.refreshToken });
  } catch (err) {
    next(err);
  }
});

router.post('/refresh', async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken as string | undefined;
    if (!token) {
      error(res, 401, 'NO_REFRESH_TOKEN', 'No se encontró refresh token');
      return;
    }

    const result = await authService.refreshAccessToken(token);

    if ('error' in result) {
      console.warn(`[SECURITY] Refresh token rejected for user ${req.user?.id || 'unknown'} from ${req.ip}`);
      error(res, 401, 'INVALID_TOKEN', 'Refresh token inválido o expirado');
      return;
    }

    success(res, { accessToken: result.accessToken, refreshToken: result.refreshToken });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken as string | undefined;
    if (token) {
      await authService.logout(token);
    }
    success(res, { message: 'Sesión cerrada' });
  } catch (err) {
    next(err);
  }
});

router.post('/forgot-password', loginLimiter, async (req, res, next) => {
  try {
    const input = ForgotPasswordSchema.parse(req.body);
    await authService.forgotPassword(input);

    success(res, {
      message: 'Si el correo existe, enviaremos instrucciones para recuperar la contraseña.',
    });
  } catch (err) {
    next(err);
  }
});

router.post('/reset-password', loginLimiter, async (req, res, next) => {
  try {
    const input = ResetPasswordSchema.parse(req.body);
    const result = await authService.resetPassword(input);

    if ('error' in result) {
      error(res, 400, 'INVALID_OR_EXPIRED_TOKEN', 'El enlace de recuperación no es válido o ya expiró');
      return;
    }

    success(res, { message: 'Contraseña actualizada correctamente' });
  } catch (err) {
    next(err);
  }
});

router.post('/oauth/google', async (req, res, next) => {
  try {
    const { access_token, email, nombre } = req.body as { access_token: string; email: string; nombre: string };
    if (!access_token || !email) {
      error(res, 400, 'MISSING_FIELDS', 'access_token y email son requeridos');
      return;
    }

    const result = await authService.googleOAuth(access_token, email, nombre || email.split('@')[0]);

    if ('error' in result && result.error) {
      const code = result.error as string;
      const messages: Record<string, string> = {
        INVALID_OAUTH_TOKEN: 'Token de Google inválido',
        EMAIL_MISMATCH: 'El email no coincide con el token',
        ACCOUNT_DISABLED: 'Esta cuenta está desactivada',
      };
      error(res, 401, code, messages[code] || 'Error de autenticación');
      return;
    }

    const ok = result as { user: typeof result extends { user: infer U } ? U : never; accessToken: string; refreshToken: string };
    success(res, { user: ok.user, accessToken: ok.accessToken, refreshToken: ok.refreshToken });
  } catch (err) {
    next(err);
  }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const result = await authService.getMe(req.user!.id);

    if ('error' in result) {
      error(res, 404, 'NOT_FOUND', 'Usuario no encontrado');
      return;
    }

    success(res, result.user);
  } catch (err) {
    next(err);
  }
});

router.patch('/profile', requireAuth, async (req, res, next) => {
  try {
    const input = UpdateProfileSchema.parse(req.body);
    const result = await authService.updateProfile(req.user!.id, input);

    if ('error' in result) {
      error(res, 409, 'EMAIL_IN_USE', 'Este email ya está en uso por otra cuenta');
      return;
    }

    success(res, result.user);
  } catch (err) {
    next(err);
  }
});

router.patch('/password', requireAuth, async (req, res, next) => {
  try {
    const input = ChangePasswordSchema.parse(req.body);
    const result = await authService.changePassword(req.user!.id, input);

    if ('error' in result && result.error) {
      const messages: Record<string, string> = {
        NOT_FOUND: 'Usuario no encontrado',
        OAUTH_USER: 'Los usuarios de Google no pueden cambiar contraseña',
        WRONG_PASSWORD: 'La contraseña actual es incorrecta',
      };
      const code = result.error;
      error(res, 400, code, messages[code] || 'Error al cambiar contraseña');
      return;
    }

    success(res, { message: 'Contraseña actualizada' });
  } catch (err) {
    next(err);
  }
});

export default router;
