import { Suspense } from 'react';
import { PaymentReturnStatus } from '@/components/pago/PaymentReturnStatus';

export default function PagoPendientePage() {
  return (
    <Suspense fallback={null}>
      <PaymentReturnStatus view="pending" />
    </Suspense>
  );
}
