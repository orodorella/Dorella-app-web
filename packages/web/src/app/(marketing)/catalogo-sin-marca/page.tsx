import type { Metadata } from 'next';
import Link from 'next/link';
import CatalogoSinMarcaClient from './CatalogoSinMarcaClient';

export const metadata: Metadata = {
  title: 'Catálogo Sin Marca',
  description: 'Genera catálogos profesionales sin marca D\'orella para compartir con tus clientes.',
};

export default function CatalogoSinMarcaPage() {
  return <CatalogoSinMarcaClient />;
}
