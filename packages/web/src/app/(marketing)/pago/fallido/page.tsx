import { Suspense } from 'react';
import { PaymentReturnStatus } from '@/components/pago/PaymentReturnStatus';

export default function PagoFallidoPage() {
  return (
    <Suspense fallback={null}>
      <PaymentReturnStatus view="failure" />
    </Suspense>
  );
}
