import crypto from 'node:crypto';
import { type Role, type Tier } from '@prisma/client';
import { prisma } from '../config/db.js';
import { env } from '../config/env.js';
import { sendSensitiveUserChangeCodeEmail } from './email.service.js';

const VERIFICATION_EXPIRY_MINUTES = 10;
const VERIFICATION_EXPIRY_MS = VERIFICATION_EXPIRY_MINUTES * 60 * 1000;

const ROLE_VALUES = ['cliente', 'admin'] as const;
const TIER_VALUES = ['detal', 'por_mayor', 'gran_mayor'] as const;

const ROLE_LABELS: Record<Role, string> = {
  cliente: 'Cliente',
  admin: 'Administrador',
};

const TIER_LABELS: Record<Tier, string> = {
  detal: 'Detal',
  por_mayor: 'Por Mayor',
  gran_mayor: 'Gran Mayor',
};

type AdminActor = {
  id: string;
  email: string;
  nombre?: string | null;
  role: Role;
};

type SensitiveUserChangeType = 'tier' | 'role';

type RequestSensitiveUserChangeInput = {
  adminUser: AdminActor;
  targetUserId: string;
  changeType: SensitiveUserChangeType;
  requestedValue: string;
};

type ConfirmSensitiveUserChangeInput = {
  adminUser: AdminActor;
  targetUserId: string;
  verificationId: string;
  code: string;
};

type VerificationLookupRow = {
  id: string;
  targetUserId: string;
  requestedByUserId: string;
  changeType: SensitiveUserChangeType;
  previousValue: string;
  requestedValue: string;
  codeHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  userEmail: string;
  userRole: Role;
  userTier: Tier;
  userIsActive: boolean;
};

class AdminUserChangeVerificationError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function normalizeEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? '';
}

function isProtectedApproverEmail(email: string) {
  if (!env.ROLE_CHANGE_APPROVER_EMAIL) return false;
  return normalizeEmail(email) === normalizeEmail(env.ROLE_CHANGE_APPROVER_EMAIL);
}

function normalizeRequestedValue(changeType: SensitiveUserChangeType, requestedValue: string) {
  if (changeType === 'tier') {
    if (!TIER_VALUES.includes(requestedValue as Tier)) {
      throw new AdminUserChangeVerificationError(400, 'INVALID_TIER', 'Tier inválido');
    }

    return requestedValue as Tier;
  }

  if (!ROLE_VALUES.includes(requestedValue as Role)) {
    throw new AdminUserChangeVerificationError(400, 'INVALID_ROLE', 'Rol inválido');
  }

  return requestedValue as Role;
}

function getChangeLabel(changeType: SensitiveUserChangeType) {
  return changeType === 'tier' ? 'Cambio de tier' : 'Cambio de rol';
}

function getValueLabel(changeType: SensitiveUserChangeType, value: string) {
  if (changeType === 'tier') {
    return TIER_LABELS[value as Tier] ?? value;
  }

  return ROLE_LABELS[value as Role] ?? value;
}

function buildCodeHash(code: string) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

function generateVerificationCode() {
  return crypto.randomInt(100000, 1000000).toString();
}

function getRequesterDisplayName(adminUser: AdminActor) {
  return adminUser.nombre?.trim() || adminUser.email;
}

export function isAdminUserChangeVerificationError(error: unknown): error is AdminUserChangeVerificationError {
  return error instanceof AdminUserChangeVerificationError;
}

export async function requestSensitiveUserChangeVerification({
  adminUser,
  targetUserId,
  changeType,
  requestedValue,
}: RequestSensitiveUserChangeInput) {
  if (!env.ROLE_CHANGE_APPROVER_EMAIL) {
    throw new AdminUserChangeVerificationError(
      500,
      'ROLE_CHANGE_APPROVER_EMAIL_MISSING',
      'ROLE_CHANGE_APPROVER_EMAIL no está configurado.',
    );
  }

  const normalizedRequestedValue = normalizeRequestedValue(changeType, requestedValue);

  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: {
      id: true,
      email: true,
      nombre: true,
      apellido: true,
      role: true,
      tier: true,
      isActive: true,
    },
  });

  if (!targetUser) {
    throw new AdminUserChangeVerificationError(404, 'NOT_FOUND', 'Usuario no encontrado');
  }

  if (!targetUser.isActive) {
    throw new AdminUserChangeVerificationError(400, 'USER_INACTIVE', 'No se puede cambiar un usuario inactivo.');
  }

  if (changeType === 'role') {
    if (targetUserId === adminUser.id) {
      throw new AdminUserChangeVerificationError(400, 'CANNOT_CHANGE_OWN_ROLE', 'No puedes cambiar tu propio rol.');
    }

    if (isProtectedApproverEmail(targetUser.email)) {
      throw new AdminUserChangeVerificationError(
        400,
        'CANNOT_CHANGE_APPROVER_ROLE',
        'No se puede cambiar el rol del usuario aprobador.',
      );
    }
  }

  const previousValue = changeType === 'tier' ? targetUser.tier : targetUser.role;
  if (previousValue === normalizedRequestedValue) {
    throw new AdminUserChangeVerificationError(
      400,
      changeType === 'tier' ? 'SAME_TIER' : 'SAME_ROLE',
      changeType === 'tier' ? 'El usuario ya tiene este tier' : 'El usuario ya tiene este rol',
    );
  }

  const code = generateVerificationCode();
  const codeHash = buildCodeHash(code);
  const expiresAt = new Date(Date.now() + VERIFICATION_EXPIRY_MS);
  const targetUserName = `${targetUser.nombre} ${targetUser.apellido}`.trim();
  const requestedByName = getRequesterDisplayName(adminUser);

  const verification = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE sensitive_user_change_verifications
      SET used_at = NOW()
      WHERE target_user_id = ${targetUserId}::uuid
        AND requested_by_user_id = ${adminUser.id}::uuid
        AND change_type = ${changeType}::"SensitiveUserChangeType"
        AND used_at IS NULL
    `;

    const rows = await tx.$queryRaw<Array<{ id: string; expiresAt: Date }>>`
      INSERT INTO sensitive_user_change_verifications (
        target_user_id,
        requested_by_user_id,
        change_type,
        previous_value,
        requested_value,
        code_hash,
        expires_at
      )
      VALUES (
        ${targetUserId}::uuid,
        ${adminUser.id}::uuid,
        ${changeType}::"SensitiveUserChangeType",
        ${previousValue},
        ${normalizedRequestedValue},
        ${codeHash},
        ${expiresAt}
      )
      RETURNING id, expires_at AS "expiresAt"
    `;

    return rows[0];
  });

  try {
    await sendSensitiveUserChangeCodeEmail({
      to: env.ROLE_CHANGE_APPROVER_EMAIL,
      code,
      targetUserName,
      targetUserEmail: targetUser.email,
      changeTypeLabel: getChangeLabel(changeType),
      previousValueLabel: getValueLabel(changeType, previousValue),
      requestedValueLabel: getValueLabel(changeType, normalizedRequestedValue),
      requestedByName,
      expiresInMinutes: VERIFICATION_EXPIRY_MINUTES,
    });
  } catch (error) {
    await prisma.$executeRaw`
      UPDATE sensitive_user_change_verifications
      SET used_at = NOW()
      WHERE id = ${verification.id}::uuid
    `;

    throw error;
  }

  return {
    verificationId: verification.id,
    expiresAt: verification.expiresAt.toISOString(),
    targetUser: {
      id: targetUser.id,
      nombre: targetUserName,
      email: targetUser.email,
    },
    changeType,
    requestedValue: normalizedRequestedValue,
  };
}

export async function confirmSensitiveUserChangeVerification({
  adminUser,
  targetUserId,
  verificationId,
  code,
}: ConfirmSensitiveUserChangeInput) {
  const rows = await prisma.$queryRaw<VerificationLookupRow[]>`
    SELECT
      v.id,
      v.target_user_id AS "targetUserId",
      v.requested_by_user_id AS "requestedByUserId",
      v.change_type::text AS "changeType",
      v.previous_value AS "previousValue",
      v.requested_value AS "requestedValue",
      v.code_hash AS "codeHash",
      v.expires_at AS "expiresAt",
      v.used_at AS "usedAt",
      u.email AS "userEmail",
      u.role AS "userRole",
      u.tier AS "userTier",
      u.is_active AS "userIsActive"
    FROM sensitive_user_change_verifications v
    INNER JOIN users u ON u.id = v.target_user_id
    WHERE v.id = ${verificationId}::uuid
    LIMIT 1
  `;

  const verification = rows[0];

  if (!verification) {
    throw new AdminUserChangeVerificationError(
      404,
      'VERIFICATION_NOT_FOUND',
      'No encontramos esta solicitud de verificación.',
    );
  }

  if (verification.targetUserId !== targetUserId || verification.requestedByUserId !== adminUser.id) {
    throw new AdminUserChangeVerificationError(
      403,
      'VERIFICATION_CONTEXT_MISMATCH',
      'La verificación no corresponde a esta solicitud.',
    );
  }

  if (verification.usedAt) {
    throw new AdminUserChangeVerificationError(400, 'VERIFICATION_ALREADY_USED', 'Este código ya fue utilizado.');
  }

  if (verification.expiresAt <= new Date()) {
    throw new AdminUserChangeVerificationError(400, 'VERIFICATION_EXPIRED', 'El código ya expiró. Solicita uno nuevo.');
  }

  if (!verification.userIsActive) {
    throw new AdminUserChangeVerificationError(400, 'USER_INACTIVE', 'No se puede cambiar un usuario inactivo.');
  }

  if (buildCodeHash(code) !== verification.codeHash) {
    throw new AdminUserChangeVerificationError(400, 'INVALID_CODE', 'El código ingresado no es válido.');
  }

  if (verification.changeType === 'role') {
    if (verification.targetUserId === adminUser.id) {
      throw new AdminUserChangeVerificationError(400, 'CANNOT_CHANGE_OWN_ROLE', 'No puedes cambiar tu propio rol.');
    }

    if (isProtectedApproverEmail(verification.userEmail)) {
      throw new AdminUserChangeVerificationError(
        400,
        'CANNOT_CHANGE_APPROVER_ROLE',
        'No se puede cambiar el rol del usuario aprobador.',
      );
    }
  }

  if (verification.changeType === 'tier' && verification.userTier === verification.requestedValue) {
    throw new AdminUserChangeVerificationError(400, 'SAME_TIER', 'El usuario ya tiene este tier.');
  }

  if (verification.changeType === 'role' && verification.userRole === verification.requestedValue) {
    throw new AdminUserChangeVerificationError(400, 'SAME_ROLE', 'El usuario ya tiene este rol.');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const now = new Date();

    if (verification.changeType === 'tier') {
      const updatedUser = await tx.user.update({
        where: { id: verification.targetUserId },
        data: {
          tier: verification.requestedValue as Tier,
          tierChangedAt: now,
          tierChangedBy: adminUser.id,
        },
        select: {
          id: true,
          email: true,
          nombre: true,
          tier: true,
        },
      });

      await tx.tierChangeLog.create({
        data: {
          userId: verification.targetUserId,
          oldTier: verification.previousValue as Tier,
          newTier: verification.requestedValue as Tier,
          reason: 'admin_verified_code',
          changedBy: adminUser.id,
        },
      });

      await tx.$executeRaw`
        UPDATE sensitive_user_change_verifications
        SET used_at = ${now}
        WHERE id = ${verification.id}::uuid
      `;

      return {
        ...updatedUser,
        changeType: verification.changeType,
      };
    }

    const updatedUser = await tx.user.update({
      where: { id: verification.targetUserId },
      data: {
        role: verification.requestedValue as Role,
      },
      select: {
        id: true,
        email: true,
        nombre: true,
        role: true,
      },
    });

    await tx.$executeRaw`
      UPDATE sensitive_user_change_verifications
      SET used_at = ${now}
      WHERE id = ${verification.id}::uuid
    `;

    return {
      ...updatedUser,
      changeType: verification.changeType,
    };
  });

  return updated;
}
