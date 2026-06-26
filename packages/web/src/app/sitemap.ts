import type { MetadataRoute } from 'next';
import { serverFetch } from '@/lib/api-client';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://dorela.co';

interface Product { id: string; }
interface Category { slug: string; }

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${BASE_URL}/catalogo`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE_URL}/login`, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${BASE_URL}/registro`, changeFrequency: 'monthly', priority: 0.3 },
  ];

  try {
    const [pRes, cRes] = await Promise.all([
      serverFetch<Product[]>('/api/products?pageSize=1000'),
      serverFetch<Category[]>('/api/categories'),
    ]);

    if (cRes.success) {
      for (const cat of cRes.data) {
        entries.push({ url: `${BASE_URL}/catalogo?categoria=${cat.slug}`, changeFrequency: 'weekly', priority: 0.8 });
      }
    }

    if (pRes.success) {
      for (const p of pRes.data) {
        entries.push({ url: `${BASE_URL}/producto/${p.id}`, changeFrequency: 'weekly', priority: 0.7 });
      }
    }
  } catch { /* API not available during build */ }

  return entries;
}
