'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, CheckCircle2, Loader2, Minus, Plus, Search, ShoppingBag, Trash2 } from 'lucide-react';
import { request } from '@/hooks/useApi';
import { formatCOP } from '@/lib/api-client';
import { useToast } from '@/context/ToastProvider';

interface ProductResult {
  id: string;
  sku: string;
  nombre: string;
  precio: number;
  stock: number;
  stockReservado: number;
  isActive: boolean;
  imagenes: string[];
}

interface CartLine extends ProductResult { cantidad: number; }

const emptyBuyer = { nombre: '', apellido: '', telefono: '', ciudad: '', direccion: '', informacionEntrega: '', correo: '' };

export default function NuevaOrdenManualPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [buyer, setBuyer] = useState(emptyBuyer);
  const [notas, setNotas] = useState('Pedido recibido por WhatsApp');
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState<ProductResult[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<{ id: string; orderNumber: string } | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const qs = new URLSearchParams({ page: '1', pageSize: '20', search: search.trim(), stock: 'in_stock' });
        const res = await request('GET', `/api/admin/products?${qs}`);
        if (!res.success) throw new Error(res.error?.message || 'No se pudieron cargar los productos');
        setProducts((res.data as ProductResult[]).filter((product) => product.isActive && product.stock - product.stockReservado > 0));
      } catch (error) {
        showToast((error as Error).message, 'error');
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search, showToast]);

  const total = useMemo(() => cart.reduce((sum, line) => sum + line.precio * line.cantidad, 0), [cart]);

  function addProduct(product: ProductResult) {
    setCart((current) => {
      const existing = current.find((line) => line.id === product.id);
      if (existing) return current;
      return [...current, { ...product, cantidad: 1 }];
    });
  }

  function setQuantity(productId: string, cantidad: number) {
    setCart((current) => current.map((line) => {
      if (line.id !== productId) return line;
      const disponible = line.stock - line.stockReservado;
      return { ...line, cantidad: Math.max(1, Math.min(disponible, cantidad || 1)) };
    }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (cart.length === 0) {
      showToast('Agrega al menos un producto', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await request('POST', '/api/admin/orders/manual', {
        comprador: buyer,
        items: cart.map((line) => ({ productId: line.id, cantidad: line.cantidad })),
        notas,
      });
      if (!res.success) throw new Error(res.error?.message || 'No se pudo crear el pedido');
      setCreated({ id: res.data.id, orderNumber: res.data.orderNumber });
      showToast('Pedido de WhatsApp creado correctamente');
    } catch (error) {
      showToast((error as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  }

  if (created) {
    return (
      <div className="mx-auto max-w-xl rounded-xl border border-emerald-200 bg-white p-8 text-center shadow-sm">
        <CheckCircle2 size={48} className="mx-auto mb-4 text-emerald-600" />
        <h1 className="mb-2 text-2xl text-stone-800" style={{ fontFamily: 'var(--font-display)' }}>Pedido creado</h1>
        <p className="mb-1 text-stone-600">{created.orderNumber}</p>
        <p className="mb-6 text-sm text-stone-400">Pago pendiente · Pedido pendiente de confirmación</p>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <button onClick={() => router.push(`/admin/ordenes?open=${created.id}`)} className="rounded-lg bg-wine px-5 py-3 text-sm font-semibold text-white hover:bg-wine-light cursor-pointer">Ver detalle</button>
          <Link href="/admin/ordenes" className="rounded-lg border border-stone-200 px-5 py-3 text-sm text-stone-600 hover:bg-stone-50">Volver a órdenes</Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-6xl">
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <Link href="/admin/ordenes" className="mb-3 inline-flex items-center gap-1 text-xs text-stone-400 hover:text-wine"><ArrowLeft size={13} /> Órdenes</Link>
          <h1 className="text-3xl text-stone-800" style={{ fontFamily: 'var(--font-display)' }}>Crear pedido</h1>
          <p className="mt-1 text-sm text-stone-400">Venta recibida por WhatsApp para un comprador invitado</p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">Pago pendiente · Pedido pendiente de confirmación</div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 font-semibold text-stone-700">Datos del comprador</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {([
                ['nombre', 'Nombre', true], ['apellido', 'Apellido', true], ['telefono', 'Teléfono', true], ['correo', 'Correo (opcional)', false],
                ['ciudad', 'Ciudad', true], ['direccion', 'Dirección', true],
              ] as const).map(([key, label, required]) => (
                <label key={key} className={key === 'direccion' ? 'sm:col-span-2' : ''}>
                  <span className="mb-1 block text-[10px] uppercase tracking-wider text-stone-500">{label}</span>
                  <input type={key === 'correo' ? 'email' : key === 'telefono' ? 'tel' : 'text'} required={required} value={buyer[key]} onChange={(e) => setBuyer({ ...buyer, [key]: e.target.value })} className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-sm focus:border-wine/40 focus:outline-none" />
                </label>
              ))}
              <label className="sm:col-span-2">
                <span className="mb-1 block text-[10px] uppercase tracking-wider text-stone-500">Información adicional de entrega</span>
                <input value={buyer.informacionEntrega} onChange={(e) => setBuyer({ ...buyer, informacionEntrega: e.target.value })} placeholder="Apartamento, barrio, indicaciones…" className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-sm focus:border-wine/40 focus:outline-none" />
              </label>
            </div>
          </section>

          <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 font-semibold text-stone-700">Agregar productos</h2>
            <div className="relative mb-4"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre, SKU o referencia" className="w-full rounded-lg border border-stone-200 py-2.5 pl-9 pr-3 text-sm focus:border-wine/40 focus:outline-none" /></div>
            <div className="max-h-80 divide-y divide-stone-100 overflow-y-auto rounded-lg border border-stone-100">
              {searching ? <div className="py-10 text-center"><Loader2 size={22} className="mx-auto animate-spin text-wine" /></div> : products.length === 0 ? <p className="py-10 text-center text-sm text-stone-400">No hay productos disponibles</p> : products.map((product) => {
                const disponible = product.stock - product.stockReservado;
                const added = cart.some((line) => line.id === product.id);
                return <div key={product.id} className="flex items-center gap-3 p-3">
                  {product.imagenes?.[0] ? <Image src={product.imagenes[0]} alt="" width={44} height={44} className="h-11 w-11 rounded object-cover" /> : <div className="h-11 w-11 rounded bg-stone-100" />}
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-stone-700">{product.nombre}</p><p className="text-[11px] text-stone-400">{product.sku} · {disponible} disponibles · {formatCOP(product.precio)}</p></div>
                  <button type="button" disabled={added} onClick={() => addProduct(product)} className="rounded-lg border border-stone-200 p-2 text-wine hover:bg-wine/5 disabled:opacity-30 cursor-pointer"><Plus size={15} /></button>
                </div>;
              })}
            </div>
          </section>
        </div>

        <aside className="h-fit rounded-xl border border-stone-200 bg-white p-5 shadow-sm lg:sticky lg:top-6">
          <div className="mb-4 flex items-center gap-2"><ShoppingBag size={17} className="text-wine" /><h2 className="font-semibold text-stone-700">Resumen del pedido</h2></div>
          {cart.length === 0 ? <p className="py-8 text-center text-sm text-stone-400">Aún no agregaste productos</p> : <div className="mb-4 space-y-3">{cart.map((line) => <div key={line.id} className="border-b border-stone-100 pb-3">
            <div className="mb-2 flex items-start justify-between gap-2"><div><p className="text-sm text-stone-700">{line.nombre}</p><p className="text-[10px] text-stone-400">{line.sku} · {formatCOP(line.precio)} c/u</p></div><button type="button" onClick={() => setCart((current) => current.filter((item) => item.id !== line.id))} className="p-1 text-stone-400 hover:text-red-500 cursor-pointer"><Trash2 size={14} /></button></div>
            <div className="flex items-center justify-between"><div className="flex items-center rounded border border-stone-200"><button type="button" onClick={() => setQuantity(line.id, line.cantidad - 1)} className="p-1.5 text-stone-500 cursor-pointer"><Minus size={12} /></button><input type="number" min="1" max={line.stock - line.stockReservado} value={line.cantidad} onChange={(e) => setQuantity(line.id, Number(e.target.value))} className="w-11 border-x border-stone-200 py-1 text-center text-xs focus:outline-none" /><button type="button" onClick={() => setQuantity(line.id, line.cantidad + 1)} className="p-1.5 text-stone-500 cursor-pointer"><Plus size={12} /></button></div><span className="text-sm font-medium text-stone-700">{formatCOP(line.precio * line.cantidad)}</span></div>
          </div>)}</div>}
          <div className="mb-5 flex items-baseline justify-between border-t border-stone-200 pt-4"><span className="font-semibold text-stone-600">Total estimado</span><span className="text-xl font-bold text-wine">{formatCOP(total)}</span></div>
          <p className="mb-4 text-[11px] leading-relaxed text-stone-400">El backend recalculará precios, disponibilidad y total al guardar.</p>
          <label className="mb-5 block"><span className="mb-1 block text-[10px] uppercase tracking-wider text-stone-500">Nota administrativa</span><textarea value={notas} maxLength={1000} onChange={(e) => setNotas(e.target.value)} rows={3} className="w-full resize-none rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-wine/40 focus:outline-none" /></label>
          <button type="submit" disabled={saving || cart.length === 0} className="flex w-full items-center justify-center gap-2 rounded-lg bg-wine py-3 text-sm font-semibold text-white hover:bg-wine-light disabled:opacity-40 cursor-pointer">{saving && <Loader2 size={15} className="animate-spin" />} Crear pedido</button>
        </aside>
      </div>
    </form>
  );
}
