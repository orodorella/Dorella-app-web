'use client';

import { type ReactNode } from 'react';
import { LazyMotion, domAnimation } from 'framer-motion';
import { AuthProvider } from './AuthProvider';
import { CartProvider } from './CartProvider';
import { ToastProvider } from './ToastProvider';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation}>
      <AuthProvider>
        <CartProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </CartProvider>
      </AuthProvider>
    </LazyMotion>
  );
}
