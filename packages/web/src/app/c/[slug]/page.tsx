import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { serverFetch } from '@/lib/api-client';
import CatalogoPublicoClient from './CatalogoPublicoClient';

interface CatalogoData {
  id: string;
  nombre: string;
  configuracion: { negocio?: string; logo_url?: string | null; color_principal?: string; mostrar_precios?: boolean };
  productos: Array<{ id: string; nombre: string; descripcion: string | null; imagen: string | null; material: string | null; precio: number | null }>;
}

interface Props { params: Promise<{ slug: string }>; }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const res = await serverFetch<CatalogoData>(`/api/catalogos/p/${slug}`);
  if (!res.success) return { title: 'Catálogo no disponible' };
  return {
    title: res.data.configuracion?.negocio || res.data.nombre,
    description: `Catálogo de ${res.data.configuracion?.negocio || res.data.nombre}`,
    robots: 'noindex',
  };
}

export default async function CatalogoPublicoPage({ params }: Props) {
  const { slug } = await params;
  const res = await serverFetch<CatalogoData>(`/api/catalogos/p/${slug}`);
  if (!res.success) notFound();
  return <CatalogoPublicoClient catalogo={res.data} />;
}
