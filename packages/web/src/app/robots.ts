import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/carrito', '/checkout', '/mi-perfil', '/mis-pedidos', '/mis-catalogos', '/confirmacion'],
      },
    ],
    sitemap: 'https://dorella.co/sitemap.xml',
  };
}
