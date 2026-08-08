import { Check } from 'lucide-react';

// Two-stage bar shared by the post-payment screen, "Mis pedidos" and the
// admin panel: payment approval (automatic, Mercado Pago) and pedido
// confirmation (manual, D'orella admin) are always shown as separate steps —
// approving a payment never implies the pedido is confirmed.
export function PaymentStageBar({
  paymentApproved,
  orderConfirmed,
  className = '',
}: {
  paymentApproved: boolean;
  orderConfirmed: boolean;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <StagePill done={paymentApproved} label="Pago aprobado" />
      <div className={`h-px w-6 flex-shrink-0 sm:w-10 ${paymentApproved ? 'bg-emerald-400' : 'bg-stone-200'}`} />
      <StagePill done={orderConfirmed} label="Pedido confirmado" />
    </div>
  );
}

function StagePill({ done, label }: { done: boolean; label: string }) {
  return (
    <div
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 ${
        done ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-stone-200 bg-stone-50 text-stone-400'
      }`}
    >
      {done ? <Check size={12} strokeWidth={3} /> : <span className="h-2.5 w-2.5 rounded-full border border-current" />}
      <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.1em]">{label}</span>
    </div>
  );
}
