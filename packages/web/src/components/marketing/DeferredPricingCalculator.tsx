'use client';

import dynamic from 'next/dynamic';

const FloatingPricingCalculator = dynamic(
  () => import('@/components/marketing/FloatingPricingCalculator'),
  { ssr: false },
);

export default function DeferredPricingCalculator() {
  return <FloatingPricingCalculator />;
}
