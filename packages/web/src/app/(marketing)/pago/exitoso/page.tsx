import { Suspense } from 'react';
import { PaymentReturnStatus } from '@/components/pago/PaymentReturnStatus';

export default function PagoExitosoPage() {
  return (
    <Suspense fallback={null}>
      <PaymentReturnStatus view="success" />
    </Suspense>
  );
}
