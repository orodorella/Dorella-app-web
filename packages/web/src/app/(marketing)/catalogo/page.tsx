import type { Metadata } from 'next';
import { serverFetch } from '@/lib/api-client';
import { getAccessToken } from '@/lib/server-auth';
import CatalogoClient from '@/components/catalogo/CatalogoClient';
import { mockCategories } from '@/mocks/categories';

export const metadata: Metadata = {
  title: 'Catálogo',
  description: 'Explora nuestro catálogo completo de joyería en oro laminado 18k. Aretes, cadenas, anillos, pulseras y más.',
};

export const revalidate = 60;

interface Product {
  id: string;
  sku: string;
  nombre: string;
  precio: number;
  precioOriginal?: number;
  imagenes: string[];
  material: string;
  stock: number;
  isFeatured: boolean;
  tags: string[];
  categoria: { id: string; nombre: string; slug: string };
}

interface Category {
  id: string;
  nombre: string;
  slug: string;
}

interface CatalogoPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
}

export default async function CatalogoPage({ searchParams }: CatalogoPageProps) {
  let products: Product[] = [];
  let categories: Category[] = [];
  let meta: PaginationMeta = { page: 1, pageSize: 16, total: 0 };
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const pageParam = typeof resolvedSearchParams.page === 'string' ? Number.parseInt(resolvedSearchParams.page, 10) : 1;
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
  const categoriaParam = resolvedSearchParams?.categoria;
  const initialCategorySlug = typeof categoriaParam === 'string' ? categoriaParam : '';
  const searchParam = resolvedSearchParams?.search;
  const initialSearch = typeof searchParam === 'string' ? searchParam : '';
  const soloDisponibles = resolvedSearchParams?.soloDisponibles === 'true';

  const productParams = new URLSearchParams({
    page: String(page),
    pageSize: '16',
  });
  if (initialCategorySlug) productParams.set('categoria', initialCategorySlug);
  if (initialSearch) productParams.set('search', initialSearch);
  if (soloDisponibles) productParams.set('soloDisponibles', 'true');

  try {
    const accessToken = await getAccessToken();
    const [pRes, cRes] = await Promise.all([
      serverFetch<Product[]>(`/api/products?${productParams.toString()}`, { accessToken }),
      serverFetch<Category[]>('/api/categories'),
    ]);
    if (pRes.success) {
      products = pRes.data;
      meta = pRes.meta ?? { page, pageSize: 16, total: pRes.data.length };
    }
    if (cRes.success) categories = cRes.data;
  } catch { /* API not available */ }

  if (categories.length === 0) {
    categories = mockCategories;
  }

  const mapped = products.map((p) => ({
    id: p.id,
    ref: p.sku,
    nombre: p.nombre,
    precio: p.precio,
    precioPublico: p.precioOriginal ?? p.precio,
    imagen: p.imagenes?.[0] || null,
    material: p.material ?? '',
    stock: p.stock,
    categoria: p.categoria?.nombre || '',
    categoriaSlug: p.categoria?.slug || '',
  }));

  return (
    <CatalogoClient
      initialProducts={mapped}
      categories={categories}
      initialCategorySlug={initialCategorySlug}
      initialSearch={initialSearch}
      meta={meta}
    />
  );
}
