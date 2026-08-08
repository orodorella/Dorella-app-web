import { createHmac, timingSafeEqual } from 'node:crypto';
import { prisma } from '../config/db.js';
import { env } from '../config/env.js';

const MERCADOPAGO_API_BASE = 'https://api.mercadopago.com';
const PAYMENT_PROVIDER = 'mercadopago' as const;

type MercadoPagoPreferenceResponse = {
  id: string;
  init_point?: string;
  sandbox_init_point?: string;
};

type MercadoPagoPaymentResponse = {
  id: number | string;
  status?: string;
  transaction_amount?: number;
  currency_id?: string;
  external_reference?: string | null;
};

type MercadoPagoSearchResponse = {
  results?: MercadoPagoPaymentResponse[];
};

const EXPECTED_CURRENCY = 'COP';
const FINAL_PAYMENT_STATUSES = new Set<PaymentStatusName>([
  'approved',
  'rejected',
  'cancelled',
  'refunded',
  'charged_back',
]);

export type PaymentStatusName =
  | 'pending'
  | 'in_process'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'refunded'
  | 'charged_back';

type OrderPaymentMeta = {
  paymentProvider: string | null;
  paymentStatus: string | null;
  paymentPreferenceId: string | null;
  paymentId: string | null;
  paymentExternalReference: string | null;
  paymentInitPoint: string | null;
  paymentSandboxInitPoint: string | null;
};

type PreferenceOrder = {
  id: string;
  userId: string;
  orderNumber: string;
  status: string;
  total: { toNumber(): number } | number;
  paidAt: Date | null;
  updatedAt: Date;
  items: Array<{
    cantidad: number;
    precioUnitario: { toNumber(): number } | number;
    nombreProducto: string;
    sku: string;
  }>;
} & OrderPaymentMeta;

type WebhookOrder = {
  id: string;
  orderNumber: string;
  total: { toNumber(): number } | number;
  status: string;
  paymentId: string | null;
  paymentStatus: string | null;
  paidAt: Date | null;
};

export class MercadoPagoError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function createPreferenceForOrder(orderId: string, userId: string) {
  assertUuid(orderId, 'ORDER_ID_INVALID', 'ID de orden inválido.');

  const accessToken = env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) {
    throw new MercadoPagoError(500, 'MERCADOPAGO_NOT_CONFIGURED', 'Mercado Pago no está configurado.');
  }

  warnIfProductionCredentialsInLocalhost(accessToken);

  const siteUrl = resolveSiteUrl();
  const isLocalSiteUrl = isLocalhostUrl(siteUrl);
  const backUrls = {
    success: `${siteUrl}/pago/exitoso`,
    pending: `${siteUrl}/pago/pendiente`,
    failure: `${siteUrl}/pago/fallido`,
  };

  const order = await getOrderForPreference(orderId, userId);
  if (!order) {
    throw new MercadoPagoError(404, 'ORDER_NOT_FOUND', 'Orden no encontrada.');
  }

  if (order.paymentStatus === 'approved' || order.paidAt || order.status === 'confirmed') {
    throw new MercadoPagoError(400, 'ORDER_ALREADY_PAID', 'Esta orden ya tiene un pago confirmado.');
  }

  if (
    order.paymentProvider === PAYMENT_PROVIDER &&
    order.paymentStatus &&
    ['pending', 'in_process'].includes(order.paymentStatus) &&
    (order.paymentSandboxInitPoint || order.paymentInitPoint)
  ) {
    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      preferenceId: order.paymentPreferenceId,
      initPoint: order.paymentInitPoint,
      sandboxInitPoint: order.paymentSandboxInitPoint,
      alreadyCreated: true,
    };
  }

  const externalReference = order.paymentExternalReference || order.id;
  const orderTotal = toNumber(order.total);
  const notificationUrl = resolveNotificationUrl();
  const preferencePayload: {
    items: Array<{
      title: string;
      description: string;
      quantity: number;
      currency_id: 'COP';
      unit_price: number;
    }>;
    back_urls: {
      success: string;
      pending: string;
      failure: string;
    };
    external_reference: string;
    metadata: {
      order_id: string;
      order_number: string;
      user_id: string;
      total: number;
    };
    auto_return?: 'approved';
    notification_url?: string;
  } = {
    items: order.items.map((item) => ({
      title: item.nombreProducto,
      description: item.sku,
      quantity: item.cantidad,
      currency_id: 'COP',
      unit_price: toNumber(item.precioUnitario),
    })),
    back_urls: {
      success: withOrderQuery(backUrls.success, externalReference),
      pending: withOrderQuery(backUrls.pending, externalReference),
      failure: withOrderQuery(backUrls.failure, externalReference),
    },
    external_reference: externalReference,
    metadata: {
      order_id: order.id,
      order_number: order.orderNumber,
      user_id: userId,
      total: orderTotal,
    },
  };

  validateBackUrlsOrThrow(preferencePayload.back_urls);

  if (isLocalSiteUrl) {
    console.warn('[mercadopago] auto_return desactivado en localhost con credenciales productivas');
  } else {
    preferencePayload.auto_return = 'approved';
  }

  if (notificationUrl) {
    preferencePayload.notification_url = notificationUrl;
  }

  logPreferencePayload({
    siteUrl,
    backUrls: preferencePayload.back_urls,
    autoReturn: preferencePayload.auto_return ?? null,
    externalReference,
    itemCount: preferencePayload.items.length,
    total: orderTotal,
    notificationUrl: preferencePayload.notification_url ?? null,
  });

  const preference = await mercadoPagoFetch<MercadoPagoPreferenceResponse>('/checkout/preferences', {
    method: 'POST',
    accessToken,
    idempotencyKey: `pref-${order.id}-${order.updatedAt.getTime()}`,
    body: preferencePayload,
  });

  await prisma.$executeRaw`
      UPDATE orders
      SET
        payment_provider = ${PAYMENT_PROVIDER}::"PaymentProvider",
        payment_status = ${'pending'}::"PaymentStatus",
        payment_preference_id = ${preference.id},
        payment_external_reference = ${externalReference},
        payment_init_point = ${preference.init_point ?? null},
        payment_sandbox_init_point = ${preference.sandbox_init_point ?? null}
      WHERE id = ${order.id}::uuid
    `;

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    preferenceId: preference.id,
    initPoint: preference.init_point ?? null,
    sandboxInitPoint: preference.sandbox_init_point ?? null,
    alreadyCreated: false,
  };
}

const WEBHOOK_SIGNATURE_MAX_AGE_MS = 5 * 60 * 1000;

// Mercado Pago signs webhooks per https://www.mercadopago.com/developers/en/docs/checkout-pro/additional-content/notifications/webhooks#editor_11
// header: x-signature: ts=<unix_seconds>,v1=<hex hmac-sha256>
// manifest: `id:{data.id (lowercased)};request-id:{x-request-id};ts:{ts};`
export function verifyMercadoPagoWebhookSignature(input: {
  signatureHeader?: string | null;
  requestId?: string | null;
  dataId?: string | null;
}): boolean {
  const secret = env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret || !input.signatureHeader || !input.requestId || !input.dataId) {
    return false;
  }

  const parts: Record<string, string> = {};
  for (const segment of input.signatureHeader.split(',')) {
    const [key, ...rest] = segment.split('=');
    if (!key || rest.length === 0) continue;
    parts[key.trim()] = rest.join('=').trim();
  }

  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  const tsMs = Number(ts) * 1000;
  if (!Number.isFinite(tsMs) || Math.abs(Date.now() - tsMs) > WEBHOOK_SIGNATURE_MAX_AGE_MS) {
    return false;
  }

  const manifest = `id:${input.dataId.toLowerCase()};request-id:${input.requestId};ts:${ts};`;
  const expected = createHmac('sha256', secret).update(manifest).digest('hex');

  const expectedBuffer = Buffer.from(expected, 'hex');
  const actualBuffer = Buffer.from(v1, 'hex');
  if (expectedBuffer.length === 0 || expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, actualBuffer);
}

const PAYMENT_ID_PATTERN = /^[0-9]{1,32}$/;

export type PaymentUpdateDecision =
  | { apply: false; reason: 'missing_external_reference' }
  | { apply: false; reason: 'already_processed'; mappedStatus: PaymentStatusName }
  | { apply: false; reason: 'currency_mismatch' }
  | { apply: false; reason: 'amount_mismatch' }
  | {
      apply: true;
      paymentId: string;
      externalReference: string;
      mappedStatus: PaymentStatusName;
      shouldCancel: boolean;
      shouldMarkPaid: boolean;
    };

// Pure decision function — given the order's current payment state and the
// payment Mercado Pago reports, decides whether/how to update the order.
// Never touches `orders.status` toward 'confirmed': approving a payment only
// ever changes payment fields. Confirming the order is a separate, manual,
// admin-only action (see order.service.ts#confirmOrder). Kept side-effect
// free so it can be unit tested without a database.
export function decidePaymentUpdate(
  order: Pick<WebhookOrder, 'paymentId' | 'paymentStatus' | 'paidAt' | 'status' | 'total'>,
  payment: MercadoPagoPaymentResponse,
): PaymentUpdateDecision {
  const externalReference = payment.external_reference?.trim();
  if (!externalReference) {
    return { apply: false, reason: 'missing_external_reference' };
  }

  const paymentId = String(payment.id);
  const mappedStatus = mapMercadoPagoStatus(payment.status);

  if (
    order.paymentId === paymentId &&
    order.paymentStatus === mappedStatus &&
    !(mappedStatus === 'approved' && !order.paidAt)
  ) {
    return { apply: false, reason: 'already_processed', mappedStatus };
  }

  const currencyId = typeof payment.currency_id === 'string' ? payment.currency_id : null;
  if (currencyId && currencyId !== EXPECTED_CURRENCY) {
    return { apply: false, reason: 'currency_mismatch' };
  }

  const transactionAmount = typeof payment.transaction_amount === 'number' ? payment.transaction_amount : null;
  if (transactionAmount !== null && Math.abs(transactionAmount - toNumber(order.total)) > 0.01) {
    return { apply: false, reason: 'amount_mismatch' };
  }

  // A payment turning approved never confirms the order by itself — only
  // `orderService.confirmOrder` (manual, admin-only) may set status='confirmed'.
  // We only auto-cancel a still-pending order when the payment definitively
  // failed, so the customer isn't left with a pedido that can never be paid.
  const shouldCancel = ['cancelled', 'refunded', 'charged_back'].includes(mappedStatus) && order.status === 'pending';
  const shouldMarkPaid = mappedStatus === 'approved';

  return { apply: true, paymentId, externalReference, mappedStatus, shouldCancel, shouldMarkPaid };
}

// Applies an already-fetched Mercado Pago payment to its matching order.
// Shared by the webhook handler and the on-demand reconciliation path so both
// go through the exact same amount/currency/idempotency checks (via
// decidePaymentUpdate) and never touch `orders.status` toward 'confirmed'.
async function applyPaymentResultToOrder(payment: MercadoPagoPaymentResponse) {
  const externalReference = payment.external_reference?.trim();
  if (!externalReference) {
    return { ignored: true, reason: 'missing_external_reference' as const, paymentId: String(payment.id) };
  }

  const order = await getOrderByExternalReference(externalReference);
  if (!order) {
    return { ignored: true, reason: 'order_not_found' as const, externalReference };
  }

  const decision = decidePaymentUpdate(order, payment);

  if (!decision.apply) {
    if (decision.reason === 'missing_external_reference') {
      return { ignored: true, reason: decision.reason, paymentId: String(payment.id) };
    }
    return {
      ignored: true,
      reason: decision.reason,
      orderId: order.id,
      paymentId: String(payment.id),
      ...(decision.reason === 'already_processed' ? { paymentStatus: decision.mappedStatus } : {}),
    };
  }

  const { paymentId, mappedStatus, shouldCancel, shouldMarkPaid } = decision;

  await prisma.$executeRaw`
      UPDATE orders
      SET
        payment_provider = ${PAYMENT_PROVIDER}::"PaymentProvider",
        payment_status = ${mappedStatus}::"PaymentStatus",
        payment_id = ${paymentId},
        payment_external_reference = ${externalReference},
        status = CASE
          WHEN ${shouldCancel} THEN CAST('cancelled' AS "OrderStatus")
          ELSE status
        END,
        paid_at = CASE
          WHEN ${shouldMarkPaid} AND paid_at IS NULL THEN NOW()
          ELSE paid_at
        END
      WHERE id = ${order.id}::uuid
    `;

  const updatedOrder = await getOrderPaymentStatusRow(order.id);
  if (!updatedOrder) {
    throw new MercadoPagoError(500, 'ORDER_STATUS_READ_FAILED', 'No fue posible leer el estado actualizado de la orden.');
  }

  return {
    ignored: false as const,
    orderId: updatedOrder.id,
    orderNumber: updatedOrder.orderNumber,
    orderStatus: updatedOrder.orderStatus,
    paymentStatus: updatedOrder.paymentStatus,
    paymentId: updatedOrder.paymentId,
  };
}

export async function handleWebhookNotification(input: { eventType?: string | null; paymentId?: string | null }) {
  if (!input.paymentId) {
    return { ignored: true, reason: 'missing_payment_id' as const };
  }

  if (!PAYMENT_ID_PATTERN.test(input.paymentId)) {
    return { ignored: true, reason: 'invalid_payment_id' as const };
  }

  const eventType = input.eventType?.toLowerCase();
  if (eventType && eventType !== 'payment') {
    return { ignored: true, reason: 'unsupported_event_type' as const };
  }

  const accessToken = env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) {
    throw new MercadoPagoError(500, 'MERCADOPAGO_NOT_CONFIGURED', 'Mercado Pago no está configurado.');
  }

  const payment = await mercadoPagoFetch<MercadoPagoPaymentResponse>(`/v1/payments/${input.paymentId}`, {
    method: 'GET',
    accessToken,
  });

  return applyPaymentResultToOrder(payment);
}

// Best-effort, request-scoped reconciliation: when the caller asks for an
// order's payment status and our last known status isn't final yet (the
// webhook may be delayed, retried, or — if MERCADOPAGO_WEBHOOK_SECRET is
// misconfigured — never arrive at all), we ask Mercado Pago directly instead
// of only trusting the local DB. This is intentionally a single bounded call,
// never a background poller, and any failure is swallowed so the status
// endpoint always still returns the last known state.
async function reconcilePendingPayment(paymentMeta: OrderPaymentMeta): Promise<OrderPaymentMeta | null> {
  const accessToken = env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) return null;

  try {
    let payment: MercadoPagoPaymentResponse | null = null;

    if (paymentMeta.paymentId) {
      payment = await mercadoPagoFetch<MercadoPagoPaymentResponse>(`/v1/payments/${paymentMeta.paymentId}`, {
        method: 'GET',
        accessToken,
      });
    } else if (paymentMeta.paymentExternalReference) {
      const search = await mercadoPagoFetch<MercadoPagoSearchResponse>(
        `/v1/payments/search?external_reference=${encodeURIComponent(paymentMeta.paymentExternalReference)}`,
        { method: 'GET', accessToken },
      );
      payment = search.results?.[0] ?? null;
    }

    if (!payment) return null;

    const result = await applyPaymentResultToOrder(payment);
    if (result.ignored && result.reason !== 'already_processed') return null;

    const orderId = 'orderId' in result ? result.orderId : null;
    if (!orderId) return null;

    return await getOrderPaymentMeta(orderId);
  } catch {
    return null;
  }
}

export async function getOrderPaymentStatus(orderId: string, userId: string) {
  assertUuid(orderId, 'ORDER_ID_INVALID', 'ID de orden inválido.');

  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      total: true,
      paidAt: true,
      updatedAt: true,
    },
  });

  if (!order) {
    throw new MercadoPagoError(404, 'ORDER_NOT_FOUND', 'Orden no encontrada.');
  }

  let paymentMeta = await getOrderPaymentMeta(order.id);
  let orderStatus = order.status;
  let paidAt = order.paidAt;

  const isFinal = paymentMeta.paymentStatus !== null && FINAL_PAYMENT_STATUSES.has(paymentMeta.paymentStatus as PaymentStatusName);
  if (!isFinal) {
    const reconciled = await reconcilePendingPayment(paymentMeta);
    if (reconciled) {
      paymentMeta = reconciled;
      const refreshed = await prisma.order.findUnique({
        where: { id: order.id },
        select: { status: true, paidAt: true },
      });
      if (refreshed) {
        orderStatus = refreshed.status;
        paidAt = refreshed.paidAt;
      }
    }
  }

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    orderStatus,
    paymentStatus: paymentMeta.paymentStatus,
    paymentProvider: paymentMeta.paymentProvider,
    paymentId: paymentMeta.paymentId,
    preferenceId: paymentMeta.paymentPreferenceId,
    externalReference: paymentMeta.paymentExternalReference,
    total: toNumber(order.total),
    paidAt: paidAt?.toISOString() ?? null,
    updatedAt: order.updatedAt.toISOString(),
  };
}

async function getOrderForPreference(orderId: string, userId: string): Promise<PreferenceOrder | null> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
    select: {
      id: true,
      userId: true,
      orderNumber: true,
      status: true,
      total: true,
      paidAt: true,
      updatedAt: true,
      items: {
        select: {
          cantidad: true,
          precioUnitario: true,
          nombreProducto: true,
          sku: true,
        },
      },
    },
  });

  if (!order) return null;

  const paymentMeta = await getOrderPaymentMeta(order.id);
  return { ...order, userId: order.userId!, ...paymentMeta };
}

async function getOrderPaymentMeta(orderId: string): Promise<OrderPaymentMeta> {
  const rows = await prisma.$queryRaw<OrderPaymentMeta[]>`
      SELECT
        payment_provider AS "paymentProvider",
        payment_status AS "paymentStatus",
        payment_preference_id AS "paymentPreferenceId",
        payment_id AS "paymentId",
        payment_external_reference AS "paymentExternalReference",
        payment_init_point AS "paymentInitPoint",
        payment_sandbox_init_point AS "paymentSandboxInitPoint"
      FROM orders
      WHERE id = ${orderId}::uuid
      LIMIT 1
    `;

  return rows[0] ?? {
    paymentProvider: null,
    paymentStatus: null,
    paymentPreferenceId: null,
    paymentId: null,
    paymentExternalReference: null,
    paymentInitPoint: null,
    paymentSandboxInitPoint: null,
  };
}

async function getOrderByExternalReference(externalReference: string): Promise<WebhookOrder | null> {
  const rows = await prisma.$queryRaw<WebhookOrder[]>`
      SELECT
        id,
        order_number AS "orderNumber",
        total,
        status,
        payment_id AS "paymentId",
        payment_status AS "paymentStatus",
        paid_at AS "paidAt"
      FROM orders
      WHERE payment_external_reference = ${externalReference}
      LIMIT 1
    `;

  return rows[0] ?? null;
}

async function getOrderPaymentStatusRow(orderId: string) {
  const rows = await prisma.$queryRaw<Array<{
    id: string;
    orderNumber: string;
    orderStatus: string;
    paymentStatus: string | null;
    paymentId: string | null;
  }>>`
      SELECT
        id,
        order_number AS "orderNumber",
        status AS "orderStatus",
        payment_status AS "paymentStatus",
        payment_id AS "paymentId"
      FROM orders
      WHERE id = ${orderId}::uuid
      LIMIT 1
    `;

  return rows[0] ?? null;
}

async function mercadoPagoFetch<T>(
  path: string,
  input: {
    method: 'GET' | 'POST';
    accessToken: string;
    body?: unknown;
    idempotencyKey?: string;
  },
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${input.accessToken}`,
    'Content-Type': 'application/json',
  };

  if (input.idempotencyKey) {
    headers['X-Idempotency-Key'] = input.idempotencyKey;
  }

  const response = await fetch(`${MERCADOPAGO_API_BASE}${path}`, {
    method: input.method,
    headers,
    body: input.body ? JSON.stringify(input.body) : undefined,
  });

  if (!response.ok) {
    const detail = await safeJson(response);
    const message = readErrorMessage(detail) || 'Mercado Pago respondió con un error al procesar la solicitud.';
    throw new MercadoPagoError(502, 'MERCADOPAGO_API_ERROR', message);
  }

  return response.json() as Promise<T>;
}

export function mapMercadoPagoStatus(status?: string): PaymentStatusName {
  switch (status) {
    case 'approved':
      return 'approved';
    case 'in_process':
      return 'in_process';
    case 'rejected':
      return 'rejected';
    case 'cancelled':
      return 'cancelled';
    case 'refunded':
      return 'refunded';
    case 'charged_back':
      return 'charged_back';
    case 'pending':
    default:
      return 'pending';
  }
}

function withOrderQuery(baseUrl: string, orderId: string) {
  const url = new URL(baseUrl);
  url.searchParams.set('orderId', orderId);
  return url.toString();
}

function toNumber(value: { toNumber(): number } | number) {
  return typeof value === 'number' ? value : value.toNumber();
}

async function safeJson(response: Response): Promise<Record<string, unknown> | null> {
  try {
    return await response.json() as Record<string, unknown>;
  } catch {
    return null;
  }
}

function readErrorMessage(detail: Record<string, unknown> | null) {
  if (!detail) return null;
  if (typeof detail.message === 'string') return detail.message;
  if (typeof detail.error === 'string') return detail.error;
  return null;
}

function resolveSiteUrl() {
  const candidate =
    env.NEXT_PUBLIC_SITE_URL ||
    env.FRONTEND_URL ||
    env.SITE_URL ||
    'http://localhost:3002';

  try {
    return new URL(candidate).toString().replace(/\/$/, '');
  } catch {
    throw new MercadoPagoError(
      500,
      'SITE_URL_MISSING',
      'SITE_URL / NEXT_PUBLIC_SITE_URL is required to create Mercado Pago back_urls',
    );
  }
}

function resolveNotificationUrl() {
  if (!env.API_PUBLIC_URL) return null;

  try {
    const normalized = new URL(env.API_PUBLIC_URL).toString().replace(/\/$/, '');
    if (isLocalhostUrl(normalized)) return null;
    return `${normalized}/api/payments/mercadopago/webhook`;
  } catch {
    return null;
  }
}

function validateBackUrlsOrThrow(backUrls: { success: string; pending: string; failure: string }) {
  const entries = Object.entries(backUrls);

  for (const [key, value] of entries) {
    if (!value) {
      throw new MercadoPagoError(
        500,
        'SITE_URL_MISSING',
        'SITE_URL / NEXT_PUBLIC_SITE_URL is required to create Mercado Pago back_urls',
      );
    }

    try {
      new URL(value);
    } catch {
      throw new MercadoPagoError(500, 'INVALID_BACK_URL', `La URL de retorno ${key} no es válida.`);
    }
  }
}

function warnIfProductionCredentialsInLocalhost(accessToken: string) {
  const siteUrl = env.NEXT_PUBLIC_SITE_URL || env.FRONTEND_URL || env.SITE_URL || '';
  const isLocal = /localhost|127\.0\.0\.1/i.test(siteUrl);
  const isProductionCredential = accessToken.startsWith('APP_USR');

  if (isLocal && isProductionCredential) {
    console.warn('[mercadopago] Estás usando credenciales de producción en entorno local. Se recomienda TEST para pruebas.');
  }
}

function logPreferencePayload(input: {
  siteUrl: string;
  backUrls: { success: string; pending: string; failure: string };
  autoReturn: 'approved' | null;
  externalReference: string;
  itemCount: number;
  total: number;
  notificationUrl: string | null;
}) {
  console.info('[mercadopago] preference payload', {
    siteUrl: input.siteUrl,
    back_urls: input.backUrls,
    auto_return: input.autoReturn,
    external_reference: input.externalReference,
    itemCount: input.itemCount,
    total: input.total,
    notification_url: input.notificationUrl,
  });
}

function assertUuid(value: string, code: string, message: string) {
  if (!isUuid(value)) {
    throw new MercadoPagoError(400, code, message);
  }
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isLocalhostUrl(value: string) {
  return /localhost|127\.0\.0\.1/i.test(value);
}
