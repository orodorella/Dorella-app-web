import type { Metadata } from 'next';
import { Providers } from '@/context/Providers';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: "D'orella — Joyería en Oro Laminado 18k",
    template: "%s | D'orella",
  },
  description: 'Joyería en oro laminado 18k. Venta al detal y por mayor en Colombia.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CO">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Inter:wght@300;400;500;600;700&family=Pinyon+Script&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-ivory text-stone-900 antialiased">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
