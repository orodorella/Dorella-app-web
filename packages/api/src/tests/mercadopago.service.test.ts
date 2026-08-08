import { describe, it, expect, beforeAll } from 'vitest';

// mercadopago.service.ts imports the zod-validated `env` singleton, which
// exits the process if required vars (DATABASE_URL, SUPABASE_*, JWT_*) are
// missing — normally supplied via `.env` in dev/prod, but not present in the
// test runner. These are throwaway values scoped to this test process only;
// no real credentials, no shared config, nothing written to disk.
beforeAll(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test';
  process.env.SUPABASE_URL ??= 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_KEY ??= 'test-service-key';
  process.env.JWT_SECRET ??= 'test-jwt-secret-at-least-32-characters-long';
  process.env.JWT_REFRESH_SECRET ??= 'test-jwt-refresh-secret-at-least-32-chars';
});

let decidePaymentUpdate: typeof import('../services/mercadopago.service.js')['decidePaymentUpdate'];
let mapMercadoPagoStatus: typeof import('../services/mercadopago.service.js')['mapMercadoPagoStatus'];
let shouldApplyAttemptToOrder: typeof import('../services/mercadopago.service.js')['shouldApplyAttemptToOrder'];

beforeAll(async () => {
  const mod = await import('../services/mercadopago.service.js');
  decidePaymentUpdate = mod.decidePaymentUpdate;
  mapMercadoPagoStatus = mod.mapMercadoPagoStatus;
  shouldApplyAttemptToOrder = mod.shouldApplyAttemptToOrder;
});

describe('múltiples intentos y webhooks atrasados', () => {
  it('un rechazo atrasado de un intento anterior no pisa el intento actual', () => {
    expect(shouldApplyAttemptToOrder({ attemptId: 'attempt-1', latestAttemptId: 'attempt-2', mappedStatus: 'rejected', orderAlreadyPaid: false })).toBe(false);
  });

  it('una aprobación válida de un intento anterior todavía puede cerrar el pedido', () => {
    expect(shouldApplyAttemptToOrder({ attemptId: 'attempt-1', latestAttemptId: 'attempt-2', mappedStatus: 'approved', orderAlreadyPaid: false })).toBe(true);
  });

  it('ningún intento vuelve a aplicarse sobre un pedido ya pagado', () => {
    expect(shouldApplyAttemptToOrder({ attemptId: 'attempt-2', latestAttemptId: 'attempt-2', mappedStatus: 'approved', orderAlreadyPaid: true })).toBe(false);
  });
});

function makeOrder(overrides: Partial<{
  paymentId: string | null;
  paymentStatus: string | null;
  paidAt: Date | null;
  status: string;
  total: number;
}> = {}) {
  return {
    paymentId: null,
    paymentStatus: null,
    paidAt: null,
    status: 'pending',
    total: 100_000,
    ...overrides,
  };
}

function makePayment(overrides: Partial<{
  id: number | string;
  status: string;
  transaction_amount: number;
  currency_id: string;
  external_reference: string | null;
}> = {}) {
  return {
    id: 'pay-1',
    status: 'approved',
    transaction_amount: 100_000,
    currency_id: 'COP',
    external_reference: 'order-1',
    ...overrides,
  };
}

describe('mapMercadoPagoStatus', () => {
  it('mapea los estados conocidos de Mercado Pago', () => {
    expect(mapMercadoPagoStatus('approved')).toBe('approved');
    expect(mapMercadoPagoStatus('rejected')).toBe('rejected');
    expect(mapMercadoPagoStatus('cancelled')).toBe('cancelled');
    expect(mapMercadoPagoStatus('refunded')).toBe('refunded');
    expect(mapMercadoPagoStatus('charged_back')).toBe('charged_back');
    expect(mapMercadoPagoStatus('in_process')).toBe('in_process');
  });

  it('cualquier estado desconocido o ausente cae a pending, nunca a approved', () => {
    expect(mapMercadoPagoStatus('pending')).toBe('pending');
    expect(mapMercadoPagoStatus(undefined)).toBe('pending');
    expect(mapMercadoPagoStatus('algo-inesperado')).toBe('pending');
  });
});

describe('decidePaymentUpdate — pago aprobado NO confirma el pedido automáticamente', () => {
  it('un pago approved nunca produce una instrucción para cambiar `status` a confirmed', () => {
    const order = makeOrder({ status: 'pending', paymentStatus: null, paidAt: null });
    const decision = decidePaymentUpdate(order, makePayment({ status: 'approved' }));

    expect(decision.apply).toBe(true);
    if (decision.apply) {
      expect(decision.mappedStatus).toBe('approved');
      expect(decision.shouldMarkPaid).toBe(true);
      // The decision type has no field capable of setting order status to
      // 'confirmed' — confirming is exclusively evaluateOrderConfirmation's job.
      expect(decision).not.toHaveProperty('shouldConfirm');
      expect(decision.shouldCancel).toBe(false);
    }
  });
});

describe('decidePaymentUpdate — idempotencia ante notificaciones repetidas', () => {
  it('mismo paymentId + mismo paymentStatus + ya pagada → already_processed', () => {
    const order = makeOrder({ paymentId: 'pay-1', paymentStatus: 'approved', paidAt: new Date() });
    const decision = decidePaymentUpdate(order, makePayment({ id: 'pay-1', status: 'approved' }));

    expect(decision.apply).toBe(false);
    if (!decision.apply) expect(decision.reason).toBe('already_processed');
  });

  it('mismo paymentId/estado approved pero paidAt aún null → SÍ se re-aplica (backfill de paidAt)', () => {
    const order = makeOrder({ paymentId: 'pay-1', paymentStatus: 'approved', paidAt: null });
    const decision = decidePaymentUpdate(order, makePayment({ id: 'pay-1', status: 'approved' }));

    expect(decision.apply).toBe(true);
  });

  it('webhook duplicado con paymentId distinto (reintento con datos nuevos) se re-evalúa', () => {
    const order = makeOrder({ paymentId: 'pay-1', paymentStatus: 'approved', paidAt: new Date() });
    const decision = decidePaymentUpdate(order, makePayment({ id: 'pay-2', status: 'approved' }));

    expect(decision.apply).toBe(true);
  });
});

describe('decidePaymentUpdate — validación de monto y moneda', () => {
  it('monto distinto al total de la orden → amount_mismatch, no se aplica', () => {
    const order = makeOrder({ total: 100_000 });
    const decision = decidePaymentUpdate(order, makePayment({ transaction_amount: 50_000 }));

    expect(decision.apply).toBe(false);
    if (!decision.apply) expect(decision.reason).toBe('amount_mismatch');
  });

  it('diferencia de centavos por redondeo (<= 0.01) se tolera', () => {
    const order = makeOrder({ total: 100_000 });
    const decision = decidePaymentUpdate(order, makePayment({ transaction_amount: 100_000.005 }));

    expect(decision.apply).toBe(true);
  });

  it('moneda distinta a COP → currency_mismatch, no se aplica', () => {
    const order = makeOrder({ total: 100_000 });
    const decision = decidePaymentUpdate(order, makePayment({ currency_id: 'USD' }));

    expect(decision.apply).toBe(false);
    if (!decision.apply) expect(decision.reason).toBe('currency_mismatch');
  });

  it('sin external_reference → missing_external_reference, no se aplica', () => {
    const order = makeOrder();
    const decision = decidePaymentUpdate(order, makePayment({ external_reference: null }));

    expect(decision.apply).toBe(false);
    if (!decision.apply) expect(decision.reason).toBe('missing_external_reference');
  });
});

describe('decidePaymentUpdate — pagos pendientes y fallidos nunca marcan la orden como pagada', () => {
  it('pending → shouldMarkPaid=false', () => {
    const decision = decidePaymentUpdate(makeOrder(), makePayment({ status: 'pending' }));
    expect(decision.apply).toBe(true);
    if (decision.apply) expect(decision.shouldMarkPaid).toBe(false);
  });

  it('in_process → shouldMarkPaid=false', () => {
    const decision = decidePaymentUpdate(makeOrder(), makePayment({ status: 'in_process' }));
    expect(decision.apply).toBe(true);
    if (decision.apply) expect(decision.shouldMarkPaid).toBe(false);
  });

  it('rejected → shouldMarkPaid=false y NO cancela automáticamente (permite reintentar)', () => {
    const decision = decidePaymentUpdate(makeOrder({ status: 'pending' }), makePayment({ status: 'rejected' }));
    expect(decision.apply).toBe(true);
    if (decision.apply) {
      expect(decision.shouldMarkPaid).toBe(false);
      expect(decision.shouldCancel).toBe(false);
    }
  });

  it('cancelled sobre una orden aún pending → cancela la orden (evita pedidos huérfanos)', () => {
    const decision = decidePaymentUpdate(makeOrder({ status: 'pending' }), makePayment({ status: 'cancelled' }));
    expect(decision.apply).toBe(true);
    if (decision.apply) expect(decision.shouldCancel).toBe(true);
  });

  it('cancelled/refunded sobre una orden YA confirmada nunca la revierte a cancelled', () => {
    const decision = decidePaymentUpdate(makeOrder({ status: 'confirmed' }), makePayment({ status: 'refunded' }));
    expect(decision.apply).toBe(true);
    if (decision.apply) expect(decision.shouldCancel).toBe(false);
  });
});
