import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { Providers } from '@/context/Providers';
import './globals.css';

const inter = localFont({
  src: '../../public/fonts/Inter-Variable.woff2',
  weight: '300 700',
  style: 'normal',
  display: 'swap',
  variable: '--font-inter',
});

const playfairDisplay = localFont({
  src: [
    { path: '../../public/fonts/PlayfairDisplay-Variable.woff2', weight: '400 700', style: 'normal' },
    { path: '../../public/fonts/PlayfairDisplay-Italic-Variable.woff2', weight: '400 500', style: 'italic' },
  ],
  display: 'swap',
  variable: '--font-playfair',
});

const pinyonScript = localFont({
  src: '../../public/fonts/PinyonScript-Regular.woff2',
  weight: '400',
  style: 'normal',
  display: 'swap',
  variable: '--font-pinyon',
});

export const metadata: Metadata = {
  title: {
    default: "D'orella — Joyería en Oro Laminado 18k",
    template: "%s | D'orella",
  },
  description: 'Joyería en oro laminado 18k. Venta al detal y por mayor en Colombia.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CO" className={`${inter.variable} ${playfairDisplay.variable} ${pinyonScript.variable}`}>
      <body className="bg-ivory text-stone-900 antialiased">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
