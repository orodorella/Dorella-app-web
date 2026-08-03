'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Clock3, Loader2, ShoppingBag, XCircle } from 'lucide-react';
import { request } from '@/hooks/useApi';
import { formatCOP } from '@/lib/api-client';

type PaymentView = 'success' | 'pending' | 'failure';

type PaymentStatusResponse = {
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  paymentStatus: string | null;
  total: number;
};

const viewConfig = {
  success: {
    title: 'Pago recibido',
    description: 'Estamos validando tu pago y actualizando el estado de la orden.',
    icon: CheckCircle2,
    iconClassName: 'text-emerald-600',
    badgeClassName: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  pending: {
    title: 'Pago pendiente',
    description: 'Tu pago quedó en revisión o espera de confirmación.',
    icon: Clock3,
    iconClassName: 'text-amber-600',
    badgeClassName: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  failure: {
    title: 'Pago no completado',
    description: 'No pudimos confirmar el pago. Puedes intentarlo otra vez desde tus pedidos.',
    icon: XCircle,
    iconClassName: 'text-rose-600',
    badgeClassName: 'bg-rose-50 text-rose-700 border-rose-200',
  },
} satisfies Record<PaymentView, {
  title: string;
  description: string;
  icon: typeof CheckCircle2;
  iconClassName: string;
  badgeClassName: string;
}>;

const paymentLabels: Record<string, string> = {
  pending: 'Pendiente',
  in_process: 'En proceso',
  approved: 'Aprobado',
  rejected: 'Rechazado',
  cancelled: 'Cancelado',
  refunded: 'Reintegrado',
  charged_back: 'Desconocido por contracargo',
};

const orderLabels: Record<string, string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmada',
  invoiced: 'Facturada',
  shipped: 'Enviada',
  delivered: 'Entregada',
  cancelled: 'Cancelada',
};

export function PaymentReturnStatus({ view }: { view: PaymentView }) {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<PaymentStatusResponse | null>(null);

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

    request('GET', `/api/payments/mercadopago/status/${orderId}`)
      .then((res) => {
        if (!cancelled && res.success) {
          setStatus(res.data);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const config = viewConfig[view];
  const Icon = config.icon;

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
                <Icon className={config.iconClassName} size={24} />
              </div>
              <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${config.badgeClassName}`}>
                Mercado Pago
              </span>
            </div>
            <h1 className="text-3xl text-stone-900 sm:text-4xl" style={{ fontFamily: 'var(--font-display)' }}>
              {config.title}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600 sm:text-base">
              {config.description}
            </p>
          </div>

          <div className="grid gap-6 px-6 py-8 sm:px-10 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-5">
              <div className="rounded-3xl border border-stone-200 bg-stone-50/70 p-5">
                <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
                  Estado de la cotización
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
                    <div className="grid gap-3 sm:grid-cols-2">
                      <StatusCard
                        label="Pago"
                        value={paymentLabels[status.paymentStatus || 'pending'] || 'Pendiente'}
                      />
                      <StatusCard
                        label="Orden"
                        value={orderLabels[status.orderStatus] || status.orderStatus}
                      />
                    </div>
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

function StatusCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.18em] text-stone-400">{label}</p>
      <p className="mt-1 text-base text-stone-800">{value}</p>
    </div>
  );
}
