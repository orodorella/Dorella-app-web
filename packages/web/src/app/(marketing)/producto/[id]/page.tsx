import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { serverFetch } from '@/lib/api-client';
import ProductClient from '@/components/catalogo/ProductClient';
import { mockProducts } from '@/mocks/products';

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
  let product: Product | null = null;
  try {
    const res = await serverFetch<Product>(`/api/products/${id}`);
    if (res.success) product = res.data;
  } catch {
    product = null;
  }
  if (!product) product = mockProducts.find((item) => item.id === id) ?? null;
  if (!product) return { title: 'Producto no encontrado' };
  const description = product.descripcion || `${product.nombre} - Joyeria en oro laminado 18k`;
  const res = { data: { descripcion: description, nombre: product.nombre } };
  return {
    title: product.nombre,
    description: res.data.descripcion || `${res.data.nombre} — Joyería en oro laminado 18k`,
  };
}

export default async function ProductoPage({ params }: Props) {
  const { id } = await params;
  let productData: Product | null = null;
  try {
    const res = await serverFetch<Product>(`/api/products/${id}`);
    if (res.success) productData = res.data;
  } catch {
    productData = null;
  }
  if (!productData) productData = mockProducts.find((item) => item.id === id) ?? null;
  if (!productData) notFound();

  const p = productData;
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
        .filter((r) => r.id !== product.id)
        .slice(0, 4)
        .map((r) => ({
          id: r.id, ref: r.sku, nombre: r.nombre, descripcion: r.descripcion,
          precio: r.precio, precioPublico: r.precio, imagen: r.imagenes?.[0] || null,
          imagenes: r.imagenes || [], material: r.material, stock: r.stock,
          categoria: r.categoria?.nombre || '', categoriaSlug: r.categoria?.slug || '',
        }));
    }
  } catch { /* ignore */ }

  if (relacionados.length === 0) {
    relacionados = mockProducts
      .filter((item) => item.id !== product.id && item.categoria.slug === product.categoriaSlug)
      .slice(0, 4)
      .map((item) => ({
        id: item.id,
        ref: item.sku,
        nombre: item.nombre,
        descripcion: item.descripcion,
        precio: item.precio,
        precioPublico: item.precio,
        imagen: item.imagenes?.[0] || null,
        imagenes: item.imagenes || [],
        material: item.material,
        stock: item.stock,
        categoria: item.categoria?.nombre || '',
        categoriaSlug: item.categoria?.slug || '',
      }));
  }

  return <ProductClient product={product} relacionados={relacionados} />;
}
