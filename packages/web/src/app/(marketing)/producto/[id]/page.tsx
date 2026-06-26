import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { serverFetch, formatCOP } from '@/lib/api-client';
import ProductClient from '@/components/catalogo/ProductClient';

export const revalidate = 60;

interface Product {
  id: string;
  sku: string;
  nombre: string;
  descripcion: string | null;
  precio: number;
  imagenes: string[];
  material: string | null;
  stock: number;
  categoria: { id: string; nombre: string; slug: string };
}

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const res = await serverFetch<Product>(`/api/products/${id}`);
  if (!res.success) return { title: 'Producto no encontrado' };
  return {
    title: res.data.nombre,
    description: res.data.descripcion || `${res.data.nombre} — Joyería en oro laminado 18k`,
  };
}

export default async function ProductoPage({ params }: Props) {
  const { id } = await params;
  const res = await serverFetch<Product>(`/api/products/${id}`);
  if (!res.success) notFound();

  const p = res.data;
  const product = {
    id: p.id,
    ref: p.sku,
    nombre: p.nombre,
    descripcion: p.descripcion,
    precio: p.precio,
    precioPublico: p.precio,
    imagen: p.imagenes?.[0] || null,
    imagenes: p.imagenes || [],
    material: p.material,
    stock: p.stock,
    categoria: p.categoria?.nombre || '',
    categoriaSlug: p.categoria?.slug || '',
  };

  let relacionados: typeof product[] = [];
  try {
    const relRes = await serverFetch<Product[]>(`/api/products?categoria=${product.categoriaSlug}&pageSize=5`);
    if (relRes.success) {
      relacionados = relRes.data
        .filter((r) => r.id !== product.id && r.imagenes?.[0])
        .slice(0, 4)
        .map((r) => ({
          id: r.id, ref: r.sku, nombre: r.nombre, descripcion: r.descripcion,
          precio: r.precio, precioPublico: r.precio, imagen: r.imagenes?.[0] || null,
          imagenes: r.imagenes || [], material: r.material, stock: r.stock,
          categoria: r.categoria?.nombre || '', categoriaSlug: r.categoria?.slug || '',
        }));
    }
  } catch { /* ignore */ }

  return <ProductClient product={product} relacionados={relacionados} />;
}
