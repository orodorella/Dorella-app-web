import type { Metadata } from 'next';
import { serverFetch } from '@/lib/api-client';
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

export default async function CatalogoPage() {
  let products: Product[] = [];
  let categories: Category[] = [];

  try {
    const [pRes, cRes] = await Promise.all([
      serverFetch<Product[]>('/api/products?pageSize=200'),
      serverFetch<Category[]>('/api/categories'),
    ]);
    if (pRes.success) products = pRes.data;
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
    precioPublico: p.precio,
    imagen: p.imagenes?.[0] || null,
    material: p.material ?? '',
    stock: p.stock,
    categoria: p.categoria?.nombre || '',
    categoriaSlug: p.categoria?.slug || '',
  }));

  return <CatalogoClient initialProducts={mapped} categories={categories.map((c) => c.nombre)} />;
}
