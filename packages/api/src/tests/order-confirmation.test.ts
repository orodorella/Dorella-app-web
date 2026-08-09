import { describe, it, expect } from 'vitest';
import { evaluateOrderConfirmation, evaluateManualPayment } from '../services/order.service.js';

describe('evaluateOrderConfirmation — confirmación manual administrativa', () => {
  it('pedido pendiente con pago aprobado → confirm', () => {
    const decision = evaluateOrderConfirmation({ status: 'pending', paymentStatus: 'approved' });
    expect(decision).toBe('confirm');
  });

  it('pedido pendiente SIN pago aprobado (null) → payment_not_approved (rechazado)', () => {
    const decision = evaluateOrderConfirmation({ status: 'pending', paymentStatus: null });
    expect(decision).toBe('payment_not_approved');
  });

  it('pedido pendiente con pago pending/rejected/in_process → payment_not_approved', () => {
    expect(evaluateOrderConfirmation({ status: 'pending', paymentStatus: 'pending' })).toBe('payment_not_approved');
    expect(evaluateOrderConfirmation({ status: 'pending', paymentStatus: 'rejected' })).toBe('payment_not_approved');
    expect(evaluateOrderConfirmation({ status: 'pending', paymentStatus: 'in_process' })).toBe('payment_not_approved');
  });

  it('pedido ya confirmado → already_confirmed (idempotente, no es un error)', () => {
    const decision = evaluateOrderConfirmation({ status: 'confirmed', paymentStatus: 'approved' });
    expect(decision).toBe('already_confirmed');
  });

  it('pedido ya confirmado con pago approved repetido dos veces seguidas → siempre already_confirmed, sin efectos duplicados', () => {
    const order = { status: 'confirmed', paymentStatus: 'approved' };
    expect(evaluateOrderConfirmation(order)).toBe('already_confirmed');
    expect(evaluateOrderConfirmation(order)).toBe('already_confirmed');
  });

  it('pedido cancelado no puede confirmarse → invalid_status', () => {
    const decision = evaluateOrderConfirmation({ status: 'cancelled', paymentStatus: 'approved' });
    expect(decision).toBe('invalid_status');
  });

  it('pedido ya despachado (shipped/delivered/invoiced) no puede "confirmarse" de nuevo → invalid_status', () => {
    expect(evaluateOrderConfirmation({ status: 'shipped', paymentStatus: 'approved' })).toBe('invalid_status');
    expect(evaluateOrderConfirmation({ status: 'delivered', paymentStatus: 'approved' })).toBe('invalid_status');
    expect(evaluateOrderConfirmation({ status: 'invoiced', paymentStatus: 'approved' })).toBe('invalid_status');
  });
});

describe('evaluateManualPayment — "Marcar como pagado" para pedidos con método de pago WhatsApp', () => {
  it('pedido con método WhatsApp (sin preferencia de Mercado Pago) sin pago aprobado → mark_paid', () => {
    expect(evaluateManualPayment({ paymentProvider: null, paymentStatus: null })).toBe('mark_paid');
    expect(evaluateManualPayment({ paymentProvider: null, paymentStatus: 'pending' })).toBe('mark_paid');
  });

  it('sin importar el origen (tienda o whatsapp), lo único que decide es si hay preferencia de Mercado Pago', () => {
    // Un pedido de la tienda donde el cliente eligió pagar por WhatsApp también
    // se puede marcar pagado manualmente: nunca se creó preferencia de Mercado Pago.
    expect(evaluateManualPayment({ paymentProvider: null, paymentStatus: null })).toBe('mark_paid');
  });

  it('pedido ya marcado como pagado → already_paid (idempotente)', () => {
    expect(evaluateManualPayment({ paymentProvider: null, paymentStatus: 'approved' })).toBe('already_paid');
  });

  it('pedido con método de pago en línea (Mercado Pago) NUNCA puede marcarse pagado manualmente, sin importar su paymentStatus', () => {
    expect(evaluateManualPayment({ paymentProvider: 'mercadopago', paymentStatus: null })).toBe('not_manual_order');
    expect(evaluateManualPayment({ paymentProvider: 'mercadopago', paymentStatus: 'pending' })).toBe('not_manual_order');
    expect(evaluateManualPayment({ paymentProvider: 'mercadopago', paymentStatus: 'approved' })).toBe('not_manual_order');
  });
});
