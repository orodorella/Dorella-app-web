import type { Metadata } from 'next';
import localFont from 'next/font/local';
import Script from 'next/script';
import { headers } from 'next/headers';
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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID;

  return (
    <html lang="es-CO" className={`${inter.variable} ${playfairDisplay.variable} ${pinyonScript.variable}`}>
      {gtmId && (
        <Script id="gtm-loader" strategy="afterInteractive" nonce={nonce}>
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;j.nonce='${nonce ?? ''}';f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');`}
        </Script>
      )}
      <body className="bg-ivory text-stone-900 antialiased">
        {gtmId && (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
              height="0"
              width="0"
              style={{ display: 'none', visibility: 'hidden' }}
            />
          </noscript>
        )}
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
