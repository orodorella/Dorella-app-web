'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Clock3, Loader2, MessageCircle, ShoppingBag, XCircle } from 'lucide-react';
import { request } from '@/hooks/useApi';
import { formatCOP } from '@/lib/api-client';
import { isFinalPaymentStatus, isPaymentApproved } from '@/lib/payment-status';
import { PaymentStageBar } from '@/components/pedidos/PaymentStageBar';

type PaymentView = 'success' | 'pending' | 'failure';

type PaymentStatusResponse = {
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  paymentStatus: string | null;
  total: number;
};

// Fallback copy shown only while the first fetch is in flight or if it fails
// outright — as soon as we have a real paymentStatus from the backend, the
// presentation below (keyed off paymentStatus, not the static route) takes
// over. The URL the browser landed on is never treated as proof of payment.
const routeFallback = {
  success: {
    title: 'Confirmando tu pago',
    description: 'Estamos validando tu pago con Mercado Pago.',
    icon: Loader2,
    tone: 'pending' as const,
  },
  pending: {
    title: 'Confirmando tu pago',
    description: 'Estamos validando tu pago con Mercado Pago.',
    icon: Loader2,
    tone: 'pending' as const,
  },
  failure: {
    title: 'Confirmando tu pago',
    description: 'Estamos validando tu pago con Mercado Pago.',
    icon: Loader2,
    tone: 'pending' as const,
  },
} satisfies Record<PaymentView, { title: string; description: string; icon: typeof Loader2; tone: 'pending' }>;

type Presentation = {
  title: string;
  description: string;
  icon: typeof CheckCircle2;
  tone: 'pending' | 'approved' | 'rejected';
};

function resolvePresentation(paymentStatus: string | null | undefined): Presentation | null {
  switch (paymentStatus) {
    case 'approved':
      return {
        title: '¡Tu pago fue aprobado!',
        description:
          'Recibimos correctamente tu pago. Ahora revisaremos tu pedido y, una vez confirmado, continuaremos la atención contigo por WhatsApp.',
        icon: CheckCircle2,
        tone: 'approved',
      };
    case 'in_process':
      return {
        title: 'Estamos verificando tu pago',
        description: 'Mercado Pago está confirmando tu pago. Esto puede tardar unos minutos — no necesitas volver a pagar.',
        icon: Clock3,
        tone: 'pending',
      };
    case 'pending':
      return {
        title: 'Estamos esperando la confirmación del pago',
        description: 'Tu pago aún no se ha acreditado. Te avisaremos apenas Mercado Pago lo confirme.',
        icon: Clock3,
        tone: 'pending',
      };
    case 'rejected':
      return {
        title: 'Tu pago no fue aprobado',
        description: 'Mercado Pago rechazó el pago. Puedes intentarlo nuevamente desde tus pedidos.',
        icon: XCircle,
        tone: 'rejected',
      };
    case 'cancelled':
      return {
        title: 'El pago fue cancelado',
        description: 'Este pago se canceló antes de completarse. Si deseas continuar con tu pedido, intenta el pago nuevamente.',
        icon: XCircle,
        tone: 'rejected',
      };
    case 'refunded':
      return {
        title: 'El pago fue reembolsado',
        description: 'Este pago fue reembolsado por Mercado Pago.',
        icon: XCircle,
        tone: 'rejected',
      };
    case 'charged_back':
      return {
        title: 'El pago tiene un contracargo',
        description: 'Mercado Pago registró un contracargo sobre este pago. Escríbenos si tienes dudas.',
        icon: XCircle,
        tone: 'rejected',
      };
    default:
      return null;
  }
}

const toneStyles: Record<'pending' | 'approved' | 'rejected', { icon: string; badge: string }> = {
  pending: { icon: 'text-amber-600', badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  approved: { icon: 'text-emerald-600', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  rejected: { icon: 'text-rose-600', badge: 'bg-rose-50 text-rose-700 border-rose-200' },
};

const MAX_POLL_ATTEMPTS = 8;
const POLL_INTERVAL_MS = 3000;

export function PaymentReturnStatus({ view }: { view: PaymentView }) {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState<PaymentStatusResponse | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Only used to know which order to ask the backend about — never trusted
  // for the payment/pedido result itself. The result always comes from
  // GET /api/payments/mercadopago/status/:orderId.
  const orderId = useMemo(
    () => searchParams.get('orderId') || searchParams.get('external_reference') || '',
    [searchParams],
  );

  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    let attempts = 0;

    async function poll() {
      attempts += 1;
      try {
        const res = await request('GET', `/api/payments/mercadopago/status/${orderId}`);
        if (cancelled) return;

        if (res.success) {
          setStatus(res.data);
          if (!isFinalPaymentStatus(res.data.paymentStatus) && attempts < MAX_POLL_ATTEMPTS) {
            setLoading(false);
            setChecking(true);
            timeoutRef.current = setTimeout(poll, POLL_INTERVAL_MS);
            return;
          }
        }
      } catch {
        // Best-effort polling — a transient failure just stops retrying;
        // the last known state (if any) stays on screen.
      }

      if (!cancelled) {
        setLoading(false);
        setChecking(false);
      }
    }

    setLoading(true);
    poll();

    return () => {
      cancelled = true;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [orderId]);

  const presentation = resolvePresentation(status?.paymentStatus) ?? routeFallback[view];
  const Icon = presentation.icon;
  const tone = toneStyles[presentation.tone];
  const paymentApproved = isPaymentApproved(status?.paymentStatus);
  const orderConfirmed = status?.orderStatus === 'confirmed';

  return (
    <div className="min-h-[calc(100vh-10rem)] bg-ivory">
      <div className="mx-auto flex max-w-4xl flex-col px-4 py-14 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-[28px] border border-stone-200 bg-white shadow-[0_24px_60px_rgba(41,24,24,0.08)]"
        >
          <div className="border-b border-stone-100 bg-[linear-gradient(135deg,rgba(91,14,22,0.06),rgba(201,168,76,0.08))] px-6 py-8 sm:px-10">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/80 shadow-sm">
                <Icon className={`${tone.icon} ${Icon === Loader2 ? 'animate-spin' : ''}`} size={24} />
              </div>
              <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${tone.badge}`}>
                Mercado Pago
              </span>
            </div>
            <h1 className="text-3xl text-stone-900 sm:text-4xl" style={{ fontFamily: 'var(--font-display)' }}>
              {presentation.title}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600 sm:text-base">
              {presentation.description}
            </p>
          </div>

          <div className="grid gap-6 px-6 py-8 sm:px-10 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-5">
              <div className="rounded-3xl border border-stone-200 bg-stone-50/70 p-5">
                <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
                  Estado de tu pedido
                </h2>
                {loading ? (
                  <div className="flex items-center gap-3 py-5 text-sm text-stone-500">
                    <Loader2 size={18} className="animate-spin text-wine" />
                    Consultando el estado más reciente de tu orden...
                  </div>
                ) : status ? (
                  <div className="mt-4 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-stone-400">Orden</p>
                        <p className="mt-1 text-lg text-stone-800">{status.orderNumber}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs uppercase tracking-[0.2em] text-stone-400">Total</p>
                        <p className="mt-1 text-2xl text-wine" style={{ fontFamily: 'var(--font-display)' }}>
                          {formatCOP(status.total)}
                        </p>
                      </div>
                    </div>

                    <PaymentStageBar paymentApproved={paymentApproved} orderConfirmed={orderConfirmed} />

                    {checking && (
                      <div className="flex items-center gap-2 text-xs text-stone-400">
                        <Loader2 size={13} className="animate-spin" />
                        Verificando con Mercado Pago...
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-5 text-sm leading-6 text-stone-500">
                    No pudimos consultar el estado automáticamente. Si ya completaste el pago, revisa tus pedidos en unos minutos.
                  </div>
                )}
              </div>

              <div className="rounded-3xl border border-stone-200 bg-white p-5">
                <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
                  Qué sigue
                </h2>
                <p className="mt-3 text-sm leading-6 text-stone-600">
                  El estado final del pago siempre se confirma desde Dorella. Si Mercado Pago tarda unos minutos en reportarlo, verás la actualización dentro de tus pedidos.
                </p>
              </div>

              {orderConfirmed && (
                <div className="rounded-3xl border border-emerald-200 bg-emerald-50/60 p-5">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">
                    Pedido confirmado
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-stone-700">
                    Te contactaremos por WhatsApp con la guía de tu envío y el valor del flete (varía según tu ciudad y si el envío es nacional o internacional — no está incluido en el pago que acabas de hacer).
                  </p>
                  <a
                    href={`https://wa.me/573156343383?text=${encodeURIComponent(`Hola, mi pedido ${status?.orderNumber ?? ''} ya fue confirmado y quiero coordinar el envío.`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
                  >
                    <MessageCircle size={16} />
                    Continuar por WhatsApp
                  </a>
                </div>
              )}
            </div>

            <div className="flex flex-col justify-between rounded-3xl border border-stone-200 bg-[#fffaf3] p-5">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-stone-400">Acciones rápidas</p>
                <h2 className="mt-2 text-2xl text-stone-900" style={{ fontFamily: 'var(--font-display)' }}>
                  Sigue comprando o revisa tu orden
                </h2>
              </div>
              <div className="mt-6 flex flex-col gap-3">
                <Link
                  href="/mis-pedidos"
                  className="inline-flex items-center justify-center rounded-full bg-wine px-5 py-3 text-sm font-semibold text-white transition hover:bg-wine-light"
                >
                  Ver mis pedidos
                </Link>
                <Link
                  href="/catalogo"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-wine hover:text-wine"
                >
                  <ShoppingBag size={16} />
                  Volver al catálogo
                </Link>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
