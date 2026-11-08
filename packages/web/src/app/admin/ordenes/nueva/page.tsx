'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, CheckCircle2, FileDown, Loader2, Minus, Plus, Search, ShoppingBag, Trash2, UserRound, X } from 'lucide-react';
import { request } from '@/hooks/useApi';
import { formatCOP } from '@/lib/api-client';
import { useToast } from '@/context/ToastProvider';
import CityAutocomplete from '@/components/ui/CityAutocomplete';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { PAISES, PAIS_POR_DEFECTO, resolverMunicipioHistorico, separarNombre, type Municipio } from '@/lib/colombia';

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

interface CartLine extends ProductResult { cantidad: number; descuentoAdicional: number; }

interface ClienteResult {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  telefono: string | null;
  direccion: string | null;
  ciudad: string | null;
  empresa: string | null;
  departamento?: string | null;
  tier: 'detal' | 'por_mayor' | 'gran_mayor';
  isActive: boolean;
}

// Espejo de TIER_CONFIG (packages/shared/src/constants/tiers.ts). Acá solo sirve
// para la vista previa: el precio que queda guardado lo recalcula el backend con
// el nivel real del cliente.
const TIER_LABELS: Record<ClienteResult['tier'], string> = {
  detal: 'Detal',
  por_mayor: 'Por mayor',
  gran_mayor: 'Gran mayor',
};

const TIER_DESCUENTOS: Record<ClienteResult['tier'], number> = {
  detal: 0,
  por_mayor: 37.5,
  gran_mayor: 50,
};

/** El descuento extra de la línea se aplica sobre el precio del nivel, igual que en la API. */
function precioConDescuentos(precioBase: number, tier: ClienteResult['tier'], descuentoAdicional: number): number {
  const precioNivel = Math.round(precioBase * (1 - TIER_DESCUENTOS[tier] / 100));
  return Math.round(precioNivel * (1 - descuentoAdicional / 100));
}

const emptyBuyer = {
  nombre: '', apellido: '', telefono: '', ciudad: '', direccion: '', informacionEntrega: '', correo: '',
  pais: PAIS_POR_DEFECTO as string, departamento: '',
};
type Buyer = typeof emptyBuyer;
/** Datos del cliente listos para volcar al formulario (solo lo que realmente existe). */
interface DatosCliente { nombre: string; apellido: string; telefono: string; correo: string; direccion: string; ciudad: string; departamento: string }

export default function NuevaOrdenManualPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [buyer, setBuyer] = useState<Buyer>(emptyBuyer);
  // Tope de descuento extra por línea que puede dar quien está usando esta pantalla (lo define el administrador).
  const [maxDescuento, setMaxDescuento] = useState(100);
  const [municipio, setMunicipio] = useState<Municipio | null>(null);
  const [avisoNombre, setAvisoNombre] = useState(false);
  const [pendiente, setPendiente] = useState<DatosCliente | null>(null);
  // Lo último que se volcó automáticamente: sirve para saber si el administrador ya escribió algo propio.
  const autoRellenado = useRef<(Partial<Buyer> & { municipioCodigo?: string | null }) | null>(null);
  // Última selección de cliente: descarta respuestas tardías o de un cliente ya quitado/reemplazado.
  const seleccionRef = useRef(0);
  const buyerRef = useRef(buyer);
  const municipioRef = useRef(municipio);
  buyerRef.current = buyer;
  municipioRef.current = municipio;
  const [notas, setNotas] = useState('Pedido recibido por WhatsApp');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [products, setProducts] = useState<ProductResult[]>([]);
  const [searchRefresh, setSearchRefresh] = useState(0);
  const [cambiandoNivel, setCambiandoNivel] = useState(false);
  const cartRef = useRef<CartLine[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  useEffect(() => { cartRef.current = cart; }, [cart]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<{ id: string; orderNumber: string } | null>(null);
  const [downloadingInvoice, setDownloadingInvoice] = useState(false);
  const [cliente, setCliente] = useState<ClienteResult | null>(null);
  const [clienteInput, setClienteInput] = useState('');
  const [debouncedCliente, setDebouncedCliente] = useState('');
  const [clientes, setClientes] = useState<ClienteResult[]>([]);
  const [buscandoClientes, setBuscandoClientes] = useState(false);
  const latestSearchRequestRef = useRef(0);
  const latestClienteRequestRef = useRef(0);
  const tierActual: ClienteResult['tier'] = cliente?.tier ?? 'detal';

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') setSearchRefresh((current) => current + 1);
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  async function downloadInvoice(orderId: string, orderNumber: string) {
    setDownloadingInvoice(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/pdf`, { credentials: 'include' });
      if (!res.ok) throw new Error('Error generando el comprobante');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pedido-${orderNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      showToast((error as Error).message, 'error');
    } finally {
      setDownloadingInvoice(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 300);

    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const requestId = latestSearchRequestRef.current + 1;
    latestSearchRequestRef.current = requestId;

    const runSearch = async () => {
      setSearching(true);
      try {
        const qs = new URLSearchParams({ page: '1', pageSize: '20', search: debouncedSearch, stock: 'in_stock' });
        const res = await request('GET', `/api/admin/orders/lookup/products?${qs}`);
        if (!res.success) throw new Error(res.error?.message || 'No se pudieron cargar los productos');
        if (requestId !== latestSearchRequestRef.current) return;
        const freshProducts = res.data as ProductResult[];
        setProducts(freshProducts.filter((product) => product.isActive && product.stock - product.stockReservado > 0));
        const byId = new Map(freshProducts.map((product) => [product.id, product]));
        // Las líneas del carrito que no salieron en esta búsqueda también se actualizan
        // (por SKU): si no, conservan el stock viejo y limitan la cantidad aunque ya se haya repuesto.
        const missing = cartRef.current.filter((line) => !byId.has(line.id));
        await Promise.all(missing.map(async (line) => {
          try {
            const q = new URLSearchParams({ page: '1', pageSize: '5', search: line.sku });
            const r = await request('GET', `/api/admin/orders/lookup/products?${q}`);
            const match = r.success ? (r.data as ProductResult[]).find((p) => p.id === line.id) : undefined;
            if (match) byId.set(match.id, match);
          } catch {
            // Si falla el refresco de una línea, se conserva; el backend valida el stock al guardar.
          }
        }));
        if (requestId !== latestSearchRequestRef.current) return;
        setCart((current) => current.map((line) => {
          const fresh = byId.get(line.id);
          return fresh ? { ...line, stock: fresh.stock, stockReservado: fresh.stockReservado } : line;
        }));
      } catch (error) {
        if (requestId === latestSearchRequestRef.current) {
          showToast((error as Error).message, 'error');
        }
      } finally {
        if (requestId === latestSearchRequestRef.current) {
          setSearching(false);
        }
      }
    };

    void runSearch();
  }, [debouncedSearch, searchRefresh, showToast]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedCliente(clienteInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [clienteInput]);

  useEffect(() => {
    // Con menos de dos letras no vale la pena consultar: "a" traería media base.
    if (cliente || debouncedCliente.length < 3) {
      setClientes([]);
      return;
    }

    const requestId = latestClienteRequestRef.current + 1;
    latestClienteRequestRef.current = requestId;

    const buscarClientes = async () => {
      setBuscandoClientes(true);
      try {
        const qs = new URLSearchParams({ page: '1', pageSize: '8', search: debouncedCliente });
        const res = await request('GET', `/api/admin/orders/lookup/customers?${qs}`);
        if (!res.success) throw new Error(res.error?.message || 'No se pudieron buscar los clientes');
        if (requestId !== latestClienteRequestRef.current) return;
        setClientes((res.data as ClienteResult[]).filter((item) => item.isActive));
      } catch (error) {
        if (requestId === latestClienteRequestRef.current) showToast((error as Error).message, 'error');
      } finally {
        if (requestId === latestClienteRequestRef.current) setBuscandoClientes(false);
      }
    };

    void buscarClientes();
  }, [cliente, debouncedCliente, showToast]);

  const total = useMemo(
    () => cart.reduce(
      (sum, line) => sum + precioConDescuentos(line.precio, tierActual, line.descuentoAdicional) * line.cantidad,
      0,
    ),
    [cart, tierActual],
  );

  function addProduct(product: ProductResult) {
    setCart((current) => {
      const existing = current.find((line) => line.id === product.id);
      if (existing) return current;
      return [...current, { ...product, cantidad: 1, descuentoAdicional: 0 }];
    });
  }

  /** Vuelca los datos del cliente sin borrar lo que ya hay si el cliente no lo tiene. */
  function aplicarDatosCliente(datos: DatosCliente) {
    const nombres = separarNombre(datos.nombre, datos.apellido);
    const resuelto = resolverMunicipioHistorico(datos.ciudad, datos.departamento);
    setAvisoNombre(nombres.ambiguo);
    setMunicipio(resuelto);
    // Al reemplazar se vuelcan TODOS los datos del cliente (vacío donde no tenga dato) para no heredar
    // los de otro cliente. La información de entrega es de este pedido y no se toca.
    // Ciudad/departamento históricos sin municipio único se conservan como texto, sin inventar un código.
    const siguiente: Partial<Buyer> = {
      nombre: nombres.nombre, apellido: nombres.apellido, telefono: datos.telefono, correo: datos.correo, direccion: datos.direccion,
      ciudad: resuelto ? '' : datos.ciudad,
      departamento: resuelto ? '' : datos.departamento,
      ...(resuelto ? { pais: 'Colombia' } : {}),
    };
    setBuyer((current) => ({ ...current, ...siguiente }));
    autoRellenado.current = { ...siguiente, municipioCodigo: resuelto?.codigo ?? null, pais: resuelto ? 'Colombia' : buyerRef.current.pais };
  }

  /** ¿El administrador escribió o eligió algo que no vino del autocompletado? (usa el estado más reciente, no el del clic). */
  function hayDatosPropios(): boolean {
    const actual = buyerRef.current;
    const previo = autoRellenado.current ?? {};
    const campos: Array<keyof Buyer> = ['nombre', 'apellido', 'telefono', 'correo', 'direccion', 'informacionEntrega', 'ciudad'];
    if (campos.some((campo) => actual[campo].trim() !== '' && actual[campo] !== (previo[campo] ?? ''))) return true;
    const elegido = municipioRef.current;
    if (elegido && elegido.codigo !== (previo.municipioCodigo ?? null)) return true;
    if (actual.pais !== (previo.pais ?? PAIS_POR_DEFECTO)) return true;
    return actual.departamento.trim() !== '' && actual.departamento !== (previo.departamento ?? '');
  }

  async function seleccionarCliente(seleccionado: ClienteResult) {
    const token = ++seleccionRef.current;
    setCliente(seleccionado);
    setClienteInput('');
    setClientes([]);
    // Datos reales y vigentes desde el backend (la búsqueda solo trae un resumen).
    let fuente: ClienteResult = seleccionado;
    try {
      const res = await request('GET', `/api/admin/orders/lookup/customers/${seleccionado.id}`);
      if (res.success) fuente = res.data as ClienteResult;
      else throw new Error(res.error?.message || 'No se pudieron cargar los datos del cliente');
    } catch (error) {
      showToast(`${(error as Error).message}. Se usan los datos de la búsqueda.`, 'error');
    }
    // Si mientras tanto se eligió otro cliente o se quitó este, se descarta esta respuesta.
    if (token !== seleccionRef.current) return;
    const datos: DatosCliente = {
      nombre: fuente.nombre ?? '', apellido: fuente.apellido ?? '', telefono: fuente.telefono ?? '',
      correo: fuente.email ?? '', direccion: fuente.direccion ?? '', ciudad: fuente.ciudad ?? '', departamento: fuente.departamento ?? '',
    };
    // El cliente queda vinculado (descuentos de su nivel) pero no se pisan datos que el administrador ya escribió sin preguntar.
    if (hayDatosPropios()) setPendiente(datos);
    else aplicarDatosCliente(datos);
  }

  async function cambiarNivel(nuevo: ClienteResult['tier']) {
    if (!cliente || nuevo === cliente.tier) return;
    setCambiandoNivel(true);
    try {
      const res = await request('PATCH', `/api/admin/orders/lookup/customers/${cliente.id}/tier`, { tier: nuevo });
      if (!res.success) throw new Error(res.error?.message || 'No se pudo cambiar el nivel');
      setCliente((actual) => (actual ? { ...actual, tier: res.data.tier } : actual));
      showToast(`Nivel actualizado a ${TIER_LABELS[res.data.tier as ClienteResult['tier']]}`);
    } catch (error) {
      showToast((error as Error).message, 'error');
    } finally {
      setCambiandoNivel(false);
    }
  }

  /** Solo desliga el pedido del cliente: los datos ya escritos se conservan para esta entrega. */
  function quitarCliente() {
    seleccionRef.current += 1;
    setCliente(null);
    setPendiente(null);
    setAvisoNombre(false);
    autoRellenado.current = null;
  }

  useEffect(() => {
    request('GET', '/api/admin/orders/lookup/discount-limit')
      .then((res) => { if (res.success) setMaxDescuento(Number(res.data.maxDescuentoAdicional)); })
      .catch(() => undefined);
  }, []);

  function setDescuento(productId: string, descuento: number) {
    setCart((current) => current.map((line) => (
      line.id === productId
        ? { ...line, descuentoAdicional: Math.max(0, Math.min(maxDescuento, Number.isFinite(descuento) ? descuento : 0)) }
        : line
    )));
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
    if (buyer.pais === 'Colombia' && !municipio && !buyer.ciudad.trim()) {
      showToast('Elige el municipio de entrega', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await request('POST', '/api/admin/orders/manual', {
        userId: cliente?.id ?? null,
        comprador: {
          nombre: buyer.nombre, apellido: buyer.apellido, telefono: buyer.telefono, correo: buyer.correo,
          direccion: buyer.direccion, informacionEntrega: buyer.informacionEntrega,
          ciudad: municipio?.nombre ?? buyer.ciudad,
          pais: buyer.pais,
          departamento: municipio?.departamento ?? (buyer.departamento.trim() || undefined),
          municipioCodigo: municipio?.codigo ?? null,
        },
        items: cart.map((line) => ({
          productId: line.id,
          cantidad: line.cantidad,
          descuentoAdicional: line.descuentoAdicional,
        })),
        notas,
      });
      if (!res.success) {
        if (res.error?.code === 'INSUFFICIENT_STOCK') setSearchRefresh((current) => current + 1);
        throw new Error(res.error?.message || 'No se pudo crear el pedido');
      }
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
        <p className="mb-6 text-sm text-stone-500">Pago pendiente · Pedido pendiente de confirmación</p>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <button onClick={() => router.push(`/admin/ordenes?open=${created.id}`)} className="rounded-lg bg-wine px-5 py-3 text-sm font-semibold text-white hover:bg-wine-light cursor-pointer">Ver detalle</button>
          <button
            onClick={() => downloadInvoice(created.id, created.orderNumber)}
            disabled={downloadingInvoice}
            className="flex items-center justify-center gap-2 rounded-lg border border-stone-200 px-5 py-3 text-sm text-stone-600 hover:bg-stone-50 cursor-pointer disabled:cursor-not-allowed disabled:cursor-not-allowed disabled:opacity-40"
          >
            {downloadingInvoice ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
            Descargar factura
          </button>
          <Link href="/admin/ordenes" className="rounded-lg border border-stone-200 px-5 py-3 text-sm text-stone-600 hover:bg-stone-50">Volver a órdenes</Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-6xl">
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <Link href="/admin/ordenes" className="mb-3 inline-flex items-center gap-1 text-xs text-stone-500 hover:text-wine"><ArrowLeft size={13} /> Órdenes</Link>
          <h1 className="text-3xl text-stone-800" style={{ fontFamily: 'var(--font-display)' }}>Crear pedido</h1>
          <p className="mt-1 text-sm text-stone-500">Venta recibida por WhatsApp. Si el cliente está registrado, búscalo y el pedido toma su nivel.</p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">Pago pendiente · Pedido pendiente de confirmación</div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
            <h2 className="mb-1 font-semibold text-stone-700">Cliente</h2>
            <p className="mb-4 text-xs text-stone-500">Búscalo por nombre, correo o empresa. Al elegirlo, el pedido usa el descuento de su nivel.</p>
            {cliente ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-wine/20 bg-wine/5 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-stone-700">{cliente.nombre} {cliente.apellido}</p>
                  <p className="truncate text-xs text-stone-500">{cliente.email}{cliente.empresa ? ` · ${cliente.empresa}` : ''}</p>
                </div>
                <div className="flex items-center gap-3">
                  <select
                    value={cliente.tier}
                    disabled={cambiandoNivel}
                    onChange={(e) => void cambiarNivel(e.target.value as ClienteResult['tier'])}
                    aria-label="Nivel del cliente"
                    className="cursor-pointer rounded-full bg-wine/10 px-3 py-1 text-xs font-semibold text-wine outline-none disabled:opacity-60"
                  >
                    {(Object.keys(TIER_LABELS) as Array<ClienteResult['tier']>).map((t) => (
                      <option key={t} value={t}>{TIER_LABELS[t]}{TIER_DESCUENTOS[t] > 0 ? ` · -${TIER_DESCUENTOS[t]}%` : ''}</option>
                    ))}
                  </select>
                  <button type="button" onClick={quitarCliente} aria-label="Quitar cliente" className="p-1 text-stone-500 hover:text-red-500 cursor-pointer">
                    <X size={15} />
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="relative">
                  <UserRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
                  <input
                    value={clienteInput}
                    onChange={(e) => setClienteInput(e.target.value)}
                    placeholder="Buscar cliente registrado (ej: Andrés)"
                    className="w-full rounded-lg border border-stone-200 py-2.5 pl-9 pr-3 text-sm focus:border-wine/40 focus:outline-none"
                  />
                </div>
                {buscandoClientes ? (
                  <div className="py-4 text-center"><Loader2 size={18} className="mx-auto animate-spin text-wine" /></div>
                ) : clientes.length > 0 ? (
                  <div className="mt-2 max-h-56 divide-y divide-stone-100 overflow-y-auto rounded-lg border border-stone-100">
                    {clientes.map((item) => (
                      <button key={item.id} type="button" onClick={() => seleccionarCliente(item)} className="flex w-full items-center justify-between gap-3 p-3 text-left hover:bg-stone-50 cursor-pointer">
                        <span className="min-w-0">
                          <span className="block truncate text-sm text-stone-700">{item.nombre} {item.apellido}</span>
                          <span className="block truncate text-xs text-stone-500">{item.email}{item.ciudad ? ` · ${item.ciudad}` : ''}</span>
                        </span>
                        <span className="shrink-0 text-xs font-semibold text-wine">{TIER_LABELS[item.tier]}</span>
                      </button>
                    ))}
                  </div>
                ) : debouncedCliente.length >= 2 ? (
                  <p className="mt-3 text-xs text-stone-500">Ningún cliente registrado coincide. Puedes seguir sin cliente: el pedido se cobra a precio detal.</p>
                ) : null}
              </>
            )}
          </section>

          <ConfirmDialog
            open={pendiente !== null}
            title="¿Reemplazar los datos escritos?"
            message="Ya escribiste datos del comprador. Puedes reemplazarlos por los del cliente elegido o conservarlos (el pedido igual queda vinculado al cliente y con el descuento de su nivel)."
            confirmLabel="Reemplazar con los del cliente"
            cancelLabel="Conservar los míos"
            onConfirm={() => { if (pendiente) aplicarDatosCliente(pendiente); setPendiente(null); }}
            onCancel={() => setPendiente(null)}
          />

          <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 font-semibold text-stone-700">Datos del comprador</h2>
            <p className="mb-3 -mt-2 text-xs text-stone-500">Estos datos de entrega se guardan en el pedido; editarlos aquí no modifica el perfil del cliente.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {([
                ['nombre', 'Nombre', true], ['apellido', 'Apellido', true], ['telefono', 'Teléfono', true], ['correo', 'Correo (opcional)', false],
              ] as const).map(([key, label, required]) => (
                <label key={key}>
                  <span className="mb-1 block text-xs uppercase tracking-wider text-stone-500">{label}</span>
                  <input type={key === 'correo' ? 'email' : key === 'telefono' ? 'tel' : 'text'} required={required} value={buyer[key]} onChange={(e) => setBuyer({ ...buyer, [key]: e.target.value })} className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-sm focus:border-wine/40 focus:outline-none" />
                </label>
              ))}
              {avisoNombre ? (
                <p className="sm:col-span-2 -mt-2 text-xs text-amber-700">
                  El nombre del cliente está guardado en un solo campo y tiene más de dos palabras: revisa cuál es el nombre y cuál el apellido.
                </p>
              ) : null}
              <label>
                <span className="mb-1 block text-xs uppercase tracking-wider text-stone-500">País</span>
                <select
                  value={buyer.pais}
                  onChange={(e) => { setBuyer({ ...buyer, pais: e.target.value, ciudad: '', departamento: '' }); setMunicipio(null); }}
                  className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm focus:border-wine/40 focus:outline-none"
                >
                  {PAISES.map((pais) => <option key={pais} value={pais}>{pais}</option>)}
                </select>
              </label>
              {buyer.pais === 'Colombia' ? (
                <CityAutocomplete
                  label="Ciudad o municipio" required value={municipio} legacyText={buyer.ciudad}
                  onSelect={(m) => { setMunicipio(m); if (m) setBuyer((current) => ({ ...current, ciudad: '', departamento: '' })); }}
                />
              ) : (
                <>
                  <label>
                    <span className="mb-1 block text-xs uppercase tracking-wider text-stone-500">Ciudad</span>
                    <input required value={buyer.ciudad} onChange={(e) => setBuyer({ ...buyer, ciudad: e.target.value })} className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-sm focus:border-wine/40 focus:outline-none" />
                  </label>
                  <label>
                    <span className="mb-1 block text-xs uppercase tracking-wider text-stone-500">Estado o región (opcional)</span>
                    <input value={buyer.departamento} onChange={(e) => setBuyer({ ...buyer, departamento: e.target.value })} className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-sm focus:border-wine/40 focus:outline-none" />
                  </label>
                </>
              )}
              <label className="sm:col-span-2">
                <span className="mb-1 block text-xs uppercase tracking-wider text-stone-500">Dirección</span>
                <input required value={buyer.direccion} onChange={(e) => setBuyer({ ...buyer, direccion: e.target.value })} className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-sm focus:border-wine/40 focus:outline-none" />
              </label>
              <label className="sm:col-span-2">
                <span className="mb-1 block text-xs uppercase tracking-wider text-stone-500">Información adicional de entrega</span>
                <input value={buyer.informacionEntrega} onChange={(e) => setBuyer({ ...buyer, informacionEntrega: e.target.value })} placeholder="Apartamento, barrio, indicaciones…" className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-sm focus:border-wine/40 focus:outline-none" />
              </label>
            </div>
          </section>

          <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 font-semibold text-stone-700">Agregar productos</h2>
            <div className="relative mb-4"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" /><input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Buscar por nombre, SKU o referencia" className="w-full rounded-lg border border-stone-200 py-2.5 pl-9 pr-3 text-sm focus:border-wine/40 focus:outline-none" /></div>
            <div className="max-h-80 divide-y divide-stone-100 overflow-y-auto rounded-lg border border-stone-100">
              {searching ? <div className="py-10 text-center"><Loader2 size={22} className="mx-auto animate-spin text-wine" /></div> : products.length === 0 ? <p className="py-10 text-center text-sm text-stone-500">No hay productos disponibles</p> : products.map((product) => {
                const disponible = product.stock - product.stockReservado;
                const added = cart.some((line) => line.id === product.id);
                return <div key={product.id} className="flex items-center gap-3 p-3">
                  {product.imagenes?.[0] ? <Image src={product.imagenes[0]} alt="" width={44} height={44} className="h-11 w-11 rounded object-cover" /> : <div className="h-11 w-11 rounded bg-stone-100" />}
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-stone-700">{product.nombre}</p><p className="text-xs text-stone-500">{product.sku} · {disponible} disponibles (stock {product.stock} − reservadas {product.stockReservado}) · {formatCOP(product.precio)}</p></div>
                  <button type="button" disabled={added} onClick={() => addProduct(product)} className="rounded-lg border border-stone-200 p-2 text-wine hover:bg-wine/5 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-500 disabled:opacity-70 cursor-pointer"><Plus size={15} /></button>
                </div>;
              })}
            </div>
          </section>
        </div>

        <aside className="h-fit rounded-xl border border-stone-200 bg-white p-5 shadow-sm lg:sticky lg:top-6">
          <div className="mb-4 flex items-center gap-2"><ShoppingBag size={17} className="text-wine" /><h2 className="font-semibold text-stone-700">Resumen del pedido</h2></div>
          {cart.length === 0 ? <p className="py-8 text-center text-sm text-stone-500">Aún no agregaste productos</p> : <div className="mb-4 space-y-3">{cart.map((line) => <div key={line.id} className="border-b border-stone-100 pb-3">
            <div className="mb-2 flex items-start justify-between gap-2"><div><p className="text-sm text-stone-700">{line.nombre}</p><p className="text-xs text-stone-500">{line.sku} · base {formatCOP(line.precio)}</p></div><button type="button" onClick={() => setCart((current) => current.filter((item) => item.id !== line.id))} className="p-1 text-stone-500 hover:text-red-500 cursor-pointer"><Trash2 size={14} /></button></div>
            <div className="flex items-center justify-between"><div className="flex items-center rounded border border-stone-200"><button type="button" onClick={() => setQuantity(line.id, line.cantidad - 1)} className="p-1.5 text-stone-500 cursor-pointer"><Minus size={12} /></button><input type="number" min="1" max={line.stock - line.stockReservado} value={line.cantidad} onChange={(e) => setQuantity(line.id, Number(e.target.value))} className="w-11 border-x border-stone-200 py-1 text-center text-xs focus:outline-none" /><button type="button" onClick={() => setQuantity(line.id, line.cantidad + 1)} className="p-1.5 text-stone-500 cursor-pointer"><Plus size={12} /></button></div><span className="text-sm font-medium text-stone-700">{formatCOP(precioConDescuentos(line.precio, tierActual, line.descuentoAdicional) * line.cantidad)}</span></div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <label className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-stone-500">
                Desc. extra
                <span className="flex items-center rounded border border-stone-200">
                  <input
                    type="number"
                    min="0"
                    max={maxDescuento}
                    step="0.5"
                    title={`Máximo permitido: ${maxDescuento}%`}
                    value={line.descuentoAdicional}
                    onChange={(e) => setDescuento(line.id, Number(e.target.value))}
                    className="w-14 py-1 text-center text-xs focus:outline-none"
                  />
                  <span className="pr-1.5 text-xs text-stone-500">%</span>
                </span>
              </label>
              <span className="text-xs text-stone-500">{formatCOP(precioConDescuentos(line.precio, tierActual, line.descuentoAdicional))} c/u</span>
            </div>
          </div>)}</div>}
          <div className="mb-5 flex items-baseline justify-between border-t border-stone-200 pt-4"><span className="font-semibold text-stone-600">Total estimado</span><span className="text-xl font-bold text-wine">{formatCOP(total)}</span></div>
          <p className="mb-4 text-xs leading-relaxed text-stone-500">
            {cliente
              ? `Precios con el nivel ${TIER_LABELS[cliente.tier].toLowerCase()} del cliente. El backend recalcula precios, disponibilidad y total al guardar.`
              : 'Sin cliente registrado el pedido va a precio detal. El backend recalcula precios, disponibilidad y total al guardar.'}
          </p>
          <label className="mb-5 block"><span className="mb-1 block text-xs uppercase tracking-wider text-stone-500">Nota administrativa</span><textarea value={notas} maxLength={1000} onChange={(e) => setNotas(e.target.value)} rows={3} className="w-full resize-none rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-wine/40 focus:outline-none" /></label>
          <button type="submit" disabled={saving || cart.length === 0} className="flex w-full items-center justify-center gap-2 rounded-lg bg-wine py-3 text-sm font-semibold text-white hover:bg-wine-light disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-500 disabled:opacity-70 cursor-pointer">{saving && <Loader2 size={15} className="animate-spin" />} Crear pedido</button>
        </aside>
      </div>
    </form>
  );
}
