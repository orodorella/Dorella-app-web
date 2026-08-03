import type { Metadata } from 'next';
import { serverFetch } from '@/lib/api-client';
import { getAccessToken } from '@/lib/server-auth';
import CatalogoClient from '@/components/catalogo/CatalogoClient';
import { mockCategories } from '@/mocks/categories';
import { mockProducts } from '@/mocks/products';

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

async function fetchAllProducts(accessToken?: string): Promise<Product[]> {
  const firstPage = await serverFetch<Product[]>('/api/products?page=1&pageSize=100', { accessToken });
  if (!firstPage.success) return [];

  const total = firstPage.meta?.total ?? firstPage.data.length;
  const pageCount = Math.ceil(total / 100);
  if (pageCount <= 1) return firstPage.data;

  const remainingPages = await Promise.all(
    Array.from({ length: pageCount - 1 }, (_, index) =>
      serverFetch<Product[]>(`/api/products?page=${index + 2}&pageSize=100`, { accessToken })),
  );

  return [
    ...firstPage.data,
    ...remainingPages.flatMap((result) => result.success ? result.data : []),
  ];
}

export default async function CatalogoPage({ searchParams }: CatalogoPageProps) {
  let products: Product[] = [];
  let categories: Category[] = [];
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const categoriaParam = resolvedSearchParams?.categoria;
  const initialCategorySlug = typeof categoriaParam === 'string' ? categoriaParam : '';

  try {
    const accessToken = await getAccessToken();
    const [pRes, cRes] = await Promise.all([
      fetchAllProducts(accessToken),
      serverFetch<Category[]>('/api/categories'),
    ]);
    products = pRes;
    if (cRes.success) categories = cRes.data;
  } catch { /* API not available */ }

  if (products.length === 0) {
    products = mockProducts;
  }

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

  return <CatalogoClient initialProducts={mapped} categories={categories} initialCategorySlug={initialCategorySlug} />;
}
