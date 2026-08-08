'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { m } from 'framer-motion';
import {
  Loader2,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  User,
  MapPin,
  FileText,
  CreditCard,
  MessageCircle,
  Package,
  Truck,
  X,
} from 'lucide-react';
import { useAuth } from '@/context/AuthProvider';
import { useCart } from '@/context/CartProvider';
import { useToast } from '@/context/ToastProvider';
import { InternationalLocationFields } from '@/components/shared/InternationalLocationFields';
import {
  buildFullPhone,
  DEFAULT_COUNTRY,
  extractPhoneParts,
  getCityLabel,
  getRegionLabel,
} from '@/data/international-locations';
import { formatCOP, TIER_MAP } from '@/lib/api-client';
import { request } from '@/hooks/useApi';

type CheckoutStep = 1 | 2 | 3 | 4;
type PaymentMethod = 'mercadopago' | 'whatsapp';

const WHATSAPP_NUMBER = '573156343383';

type CustomerData = {
  fullName: string;
  phoneCode: string;
  phoneNumber: string;
  email: string;
};

type ShippingData = {
  countryCode: string;
  countryName: string;
  region: string;
  regionCode: string;
  city: string;
  address: string;
  neighborhood: string;
  notes: string;
};

const STEP_CONFIG: Array<{
  id: CheckoutStep;
  title: string;
  short: string;
  icon: typeof User;
}> = [
  { id: 1, title: 'Datos personales', short: 'Personales', icon: User },
  { id: 2, title: 'Envío', short: 'Envío', icon: MapPin },
  { id: 3, title: 'Confirmación', short: 'Confirmar', icon: FileText },
  { id: 4, title: 'Pago', short: 'Pago', icon: CreditCard },
];

function validateCustomer(data: CustomerData) {
  const errors: Partial<Record<keyof CustomerData, string>> = {};

  if (!data.fullName.trim()) errors.fullName = 'Ingresa el nombre completo.';
  if (!data.phoneCode.trim()) errors.phoneCode = 'Selecciona un indicativo.';
  if (!data.phoneNumber.trim()) {
    errors.phoneNumber = 'Ingresa un celular o WhatsApp.';
  } else if (data.phoneNumber.replace(/\D/g, '').length < 6) {
    errors.phoneNumber = 'Ingresa un número válido.';
  }
  if (!data.email.trim()) {
    errors.email = 'Ingresa un correo electronico.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) {
    errors.email = 'Ingresa un correo valido.';
  }

  return errors;
}

function validateShipping(data: ShippingData) {
  const errors: Partial<Record<keyof ShippingData, string>> = {};

  if (!data.countryCode.trim() || !data.countryName.trim()) errors.countryCode = 'Selecciona el país.';
  if (!data.region.trim()) errors.region = 'Ingresa la región o estado.';
  if (!data.city.trim()) errors.city = 'Ingresa la ciudad.';
  if (!data.address.trim()) errors.address = 'Ingresa la direccion.';

  return errors;
}

function buildOrderNotes(shippingData: ShippingData) {
  return shippingData.notes.trim() || undefined;
}

function buildWhatsappPaymentUrl(order: {
  orderNumber: string;
  total: number;
  items: Array<{ nombreProducto: string; cantidad: number; subtotal: number }>;
}) {
  const lines = order.items
    .map((item) => `- ${item.nombreProducto} x${item.cantidad} — ${formatCOP(item.subtotal)}`)
    .join('\n');

  const message = [
    `Hola! Quiero pagar mi pedido *${order.orderNumber}* de Dorella.`,
    '',
    'Productos:',
    lines,
    '',
    `Total: ${formatCOP(order.total)}`,
  ].join('\n');

  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

export default function CheckoutPage() {
  const { user, tierInfo, setTier, updateProfile } = useAuth();
  const { carrito, clearCart, subtotalPublico, subtotalTier, ahorro, totalItems, hydrated } = useCart();
  const { showToast } = useToast();
  const router = useRouter();

  const [currentStep, setCurrentStep] = useState<CheckoutStep>(1);
  const [loading, setLoading] = useState(false);
  const [showShippingNotice, setShowShippingNotice] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('mercadopago');
  const [customerErrors, setCustomerErrors] = useState<Partial<Record<keyof CustomerData, string>>>({});
  const [shippingErrors, setShippingErrors] = useState<Partial<Record<keyof ShippingData, string>>>({});
  const [customerData, setCustomerData] = useState<CustomerData>({
    fullName: '',
    phoneCode: DEFAULT_COUNTRY.phonecode,
    phoneNumber: '',
    email: '',
  });
  const [shippingData, setShippingData] = useState<ShippingData>({
    countryCode: DEFAULT_COUNTRY.isoCode,
    countryName: DEFAULT_COUNTRY.name,
    region: '',
    regionCode: '',
    city: '',
    address: '',
    neighborhood: '',
    notes: '',
  });

  const total = subtotalTier;
  const fullPhone = useMemo(
    () => buildFullPhone(customerData.phoneCode, customerData.phoneNumber),
    [customerData.phoneCode, customerData.phoneNumber],
  );

  useEffect(() => {
    if (hydrated && carrito.length === 0 && currentStep !== 4) {
      router.push('/carrito');
    }
  }, [carrito.length, currentStep, hydrated, router]);

  useEffect(() => {
    if (!user) return;

    const parsedPhone = extractPhoneParts(user.telefono, DEFAULT_COUNTRY.phonecode);

    setCustomerData((current) => ({
      fullName: current.fullName || user.nombre || '',
      phoneCode: current.phoneCode || parsedPhone.phoneCode,
      phoneNumber: current.phoneNumber || parsedPhone.phoneNumber,
      email: current.email || user.email || '',
    }));

    setShippingData((current) => ({
      countryCode: current.countryCode || DEFAULT_COUNTRY.isoCode,
      countryName: current.countryName || DEFAULT_COUNTRY.name,
      region: current.region || user.departamento || '',
      regionCode: current.regionCode || '',
      city: current.city || user.ciudad || '',
      address: current.address || user.direccion || '',
      neighborhood: current.neighborhood || '',
      notes: current.notes || '',
    }));
  }, [user]);

  const orderLines = useMemo(
    () =>
      carrito.map((item) => ({
        id: item.product.id,
        name: item.product.nombre,
        ref: item.product.ref,
        quantity: item.cantidad,
        subtotal: item.product.precio * item.cantidad,
      })),
    [carrito],
  );

  async function syncProfileIfNeeded() {
    if (!user) return;

    const nextProfile = {
      nombre: customerData.fullName.trim(),
      email: customerData.email.trim(),
      telefono: fullPhone,
      departamento: shippingData.region.trim(),
      ciudad: shippingData.city.trim(),
      direccion: shippingData.address.trim(),
    };

    const profileChanged =
      nextProfile.nombre !== (user.nombre || '') ||
      nextProfile.email !== (user.email || '') ||
      nextProfile.telefono !== (user.telefono || '') ||
      nextProfile.departamento !== (user.departamento || '') ||
      nextProfile.ciudad !== (user.ciudad || '') ||
      nextProfile.direccion !== (user.direccion || '');

    if (!profileChanged) return;

    await updateProfile(nextProfile);
  }

  function goToStep(targetStep: CheckoutStep) {
    if (loading) return;
    setCurrentStep(targetStep);
  }

  function handleCustomerContinue() {
    const nextErrors = validateCustomer(customerData);
    setCustomerErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      showToast('Completa tus datos personales para continuar.', 'error');
      return;
    }
    setCurrentStep(2);
  }

  async function handleShippingContinue() {
    const nextErrors = validateShipping(shippingData);
    setShippingErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      showToast('Completa los datos de envío para continuar.', 'error');
      return;
    }

    try {
      await syncProfileIfNeeded();
      setCurrentStep(3);
    } catch (error) {
      showToast((error as Error).message, 'error');
    }
  }

  async function handleProceedToPayment(method: PaymentMethod = 'mercadopago') {
    const nextCustomerErrors = validateCustomer(customerData);
    const nextShippingErrors = validateShipping(shippingData);
    setCustomerErrors(nextCustomerErrors);
    setShippingErrors(nextShippingErrors);

    if (Object.keys(nextCustomerErrors).length > 0) {
      setCurrentStep(1);
      showToast('Revisa tus datos personales antes de continuar.', 'error');
      return;
    }

    if (Object.keys(nextShippingErrors).length > 0) {
      setCurrentStep(2);
      showToast('Revisa los datos de envío antes de continuar.', 'error');
      return;
    }

    setPaymentMethod(method);
    setLoading(true);
    setCurrentStep(4);

    try {
      await syncProfileIfNeeded();

      const orderRes = await request('POST', '/api/orders', {
        items: carrito.map((item) => ({ productId: item.product.id, cantidad: item.cantidad })),
        notas: buildOrderNotes(shippingData),
        envio: {
          telefonoIndicativo: customerData.phoneCode.replace(/\D/g, ''),
          telefonoNumero: customerData.phoneNumber.trim(),
          telefonoCompleto: fullPhone,
          pais: shippingData.countryName.trim(),
          paisCodigo: shippingData.countryCode.trim(),
          region: shippingData.region.trim(),
          regionCodigo: shippingData.regionCode.trim() || null,
          ciudad: shippingData.city.trim(),
          direccion: shippingData.address.trim(),
          referencias: shippingData.neighborhood.trim() || '',
        },
      });

      if (!orderRes.success) throw new Error(orderRes.error?.message || 'Error creando orden');
      const result = orderRes.data;

      if (result.tierUpgrade?.upgraded && result.tierUpgrade.newTier) {
        const frontendTier = TIER_MAP[result.tierUpgrade.newTier];
        if (frontendTier) setTier(frontendTier);
      }

      if (method === 'whatsapp') {
        const whatsappUrl = buildWhatsappPaymentUrl(result.order);
        clearCart();
        window.location.assign(whatsappUrl);
        return;
      }

      const paymentRes = await request('POST', '/api/payments/mercadopago/preference', {
        orderId: result.order.id,
      });

      if (!paymentRes.success) {
        throw new Error(paymentRes.error?.message || 'No fue posible iniciar el pago con Mercado Pago');
      }

      const checkoutUrl = paymentRes.data.initPoint || paymentRes.data.sandboxInitPoint;
      if (!checkoutUrl) {
        throw new Error('Mercado Pago no devolvió una URL de pago válida');
      }

      clearCart();
      window.location.assign(checkoutUrl);
    } catch (error) {
      setCurrentStep(3);
      setLoading(false);
      showToast((error as Error).message, 'error');
    }
  }

  if (!hydrated) return null;
  if (carrito.length === 0 && currentStep !== 4) return null;

  return (
    <div className="min-h-screen flex-1 bg-ivory">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <button
          onClick={() => router.push('/carrito')}
          className="mb-8 flex cursor-pointer items-center gap-2 text-sm text-stone-400 transition-colors hover:text-stone-600"
        >
          <ArrowLeft size={16} /> Volver al carrito
        </button>

        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.28em] text-gold">Checkout Dorella</p>
            <h1 className="text-4xl font-semibold text-stone-800" style={{ fontFamily: 'var(--font-display)' }}>
              Finaliza tu pedido con claridad
            </h1>
            <p className="mt-3 max-w-2xl text-sm font-light leading-relaxed text-stone-500">
              Te guiaremos paso a paso para confirmar tus datos, revisar el envío y proceder al pago de forma segura.
            </p>
          </div>
          <div className="rounded-full border border-gold/20 bg-white/80 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.14em] text-stone-600 shadow-sm">
            {tierInfo.label} · {totalItems} piezas
          </div>
        </div>

        <div className="mb-8 overflow-x-auto rounded-[24px] border border-stone-200/80 bg-white/70 p-4 shadow-sm backdrop-blur">
          <div className="flex min-w-max items-center gap-2 sm:gap-3">
            {STEP_CONFIG.map((item, index) => {
              const Icon = item.icon;
              const isCurrent = currentStep === item.id;
              const isCompleted = currentStep > item.id;
              const isPending = currentStep < item.id;

              return (
                <div key={item.id} className="flex items-center gap-2 sm:gap-3">
                  <div
                    className={`flex items-center gap-3 rounded-full px-3 py-2.5 sm:px-4 ${
                      isCurrent
                        ? 'bg-wine text-white shadow-sm'
                        : isCompleted
                          ? 'bg-gold/15 text-gold'
                          : 'bg-stone-100 text-stone-400'
                    }`}
                    aria-current={isCurrent ? 'step' : undefined}
                  >
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold ${
                        isCurrent
                          ? 'border-white/20 bg-white/10'
                          : isCompleted
                            ? 'border-gold/30 bg-gold/10'
                            : 'border-stone-200 bg-white'
                      }`}
                    >
                      {isCompleted ? <CheckCircle2 size={15} /> : <Icon size={15} />}
                    </div>
                    <div className="pr-1">
                      <p className="text-[9px] uppercase tracking-[0.2em] opacity-80">Paso {item.id}</p>
                      <p className={`text-sm ${isPending ? 'text-stone-500' : ''}`}>{item.title}</p>
                    </div>
                  </div>
                  {index < STEP_CONFIG.length - 1 && (
                    <div className={`h-px w-6 sm:w-10 ${currentStep > item.id ? 'bg-gold/50' : 'bg-stone-200'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            {currentStep === 1 && (
              <m.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="rounded-[26px] border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
                <div className="mb-6 flex items-start gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-wine/10 text-wine">
                    <User size={18} />
                  </div>
                  <div>
                    <h2 className="text-2xl text-stone-800" style={{ fontFamily: 'var(--font-display)' }}>
                      Datos personales
                    </h2>
                    <p className="mt-1 text-sm font-light text-stone-500">
                      Usaremos esta información para identificar tu pedido y mantenerte al tanto del proceso.
                    </p>
                  </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.16em] text-stone-500">
                      Nombre completo
                    </label>
                    <input
                      value={customerData.fullName}
                      onChange={(event) => setCustomerData((current) => ({ ...current, fullName: event.target.value }))}
                      className={`w-full rounded-2xl border bg-white px-4 py-3.5 text-sm text-stone-700 outline-none transition focus:ring-2 focus:ring-wine/20 ${
                        customerErrors.fullName ? 'border-red-300' : 'border-stone-200'
                      }`}
                    />
                    {customerErrors.fullName && <p className="mt-2 text-xs text-red-500">{customerErrors.fullName}</p>}
                  </div>

                  <div>
                    <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.16em] text-stone-500">
                      Número de WhatsApp
                    </label>
                    <div
                      className={`flex overflow-hidden rounded-2xl border bg-white transition focus-within:ring-2 focus-within:ring-wine/20 ${
                        customerErrors.phoneCode || customerErrors.phoneNumber ? 'border-red-300' : 'border-stone-200'
                      }`}
                    >
                      <div className="flex min-w-[88px] items-center justify-center border-r border-stone-200 bg-stone-50 px-3 text-sm font-medium text-stone-600">
                        +{customerData.phoneCode}
                      </div>
                      <input
                        value={customerData.phoneNumber}
                        onChange={(event) => setCustomerData((current) => ({ ...current, phoneNumber: event.target.value }))}
                        placeholder="Número de WhatsApp"
                        className="w-full px-4 py-3.5 text-sm text-stone-700 outline-none"
                      />
                    </div>
                    {customerErrors.phoneCode && <p className="mt-2 text-xs text-red-500">{customerErrors.phoneCode}</p>}
                    {customerErrors.phoneNumber ? (
                      <p className="mt-2 text-xs text-red-500">{customerErrors.phoneNumber}</p>
                    ) : (
                      <p className="mt-2 text-xs text-stone-400">El indicativo se ajusta automáticamente según el país de envío.</p>
                    )}
                  </div>

                  <div>
                    <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.16em] text-stone-500">
                      Correo electrónico
                    </label>
                    <input
                      type="email"
                      value={customerData.email}
                      onChange={(event) => setCustomerData((current) => ({ ...current, email: event.target.value }))}
                      className={`w-full rounded-2xl border bg-white px-4 py-3.5 text-sm text-stone-700 outline-none transition focus:ring-2 focus:ring-wine/20 ${
                        customerErrors.email ? 'border-red-300' : 'border-stone-200'
                      }`}
                    />
                    {customerErrors.email && <p className="mt-2 text-xs text-red-500">{customerErrors.email}</p>}
                  </div>
                </div>

                <div className="mt-8 flex justify-end">
                  <button
                    onClick={handleCustomerContinue}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-wine px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-white transition-colors hover:bg-wine-light"
                  >
                    Continuar a envío
                    <ChevronRight size={15} />
                  </button>
                </div>
              </m.section>
            )}

            {currentStep === 2 && (
              <m.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="rounded-[26px] border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
                <div className="mb-6 flex items-start gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-wine/10 text-wine">
                    <MapPin size={18} />
                  </div>
                  <div>
                    <h2 className="text-2xl text-stone-800" style={{ fontFamily: 'var(--font-display)' }}>
                      Datos de envío
                    </h2>
                    <p className="mt-1 text-sm font-light text-stone-500">
                      Completa el destino de tu pedido para que podamos despacharlo correctamente.
                    </p>
                    <p className="mt-2 text-xs font-light text-stone-400">
                      Realizamos envíos nacionales e internacionales. Verificaremos los detalles de entrega antes del despacho.
                    </p>
                  </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <InternationalLocationFields
                    countryCode={shippingData.countryCode}
                    region={shippingData.region}
                    regionCode={shippingData.regionCode}
                    city={shippingData.city}
                    countryError={shippingErrors.countryCode}
                    regionError={shippingErrors.region}
                    cityError={shippingErrors.city}
                    onCountryChange={(country) => {
                      setShippingData((current) => ({
                        ...current,
                        countryCode: country.countryCode,
                        countryName: country.countryName,
                        region: '',
                        regionCode: '',
                        city: '',
                      }));
                      setCustomerData((current) => ({
                        ...current,
                        phoneCode: country.phoneCode || current.phoneCode,
                      }));
                    }}
                    onRegionChange={(value) =>
                      setShippingData((current) => ({
                        ...current,
                        region: value.region,
                        regionCode: value.regionCode,
                        city: '',
                      }))
                    }
                    onCityChange={(value) =>
                      setShippingData((current) => ({
                        ...current,
                        city: value,
                      }))
                    }
                  />

                  <div className="sm:col-span-2">
                    <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.16em] text-stone-500">
                      Dirección de entrega
                    </label>
                    <input
                      value={shippingData.address}
                      onChange={(event) => setShippingData((current) => ({ ...current, address: event.target.value }))}
                      placeholder="Dirección de entrega"
                      className={`w-full rounded-2xl border bg-white px-4 py-3.5 text-sm text-stone-700 outline-none transition focus:ring-2 focus:ring-wine/20 ${
                        shippingErrors.address ? 'border-red-300' : 'border-stone-200'
                      }`}
                    />
                    {shippingErrors.address && <p className="mt-2 text-xs text-red-500">{shippingErrors.address}</p>}
                  </div>

                  <div>
                    <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.16em] text-stone-500">
                      Referencias / complemento
                    </label>
                    <input
                      value={shippingData.neighborhood}
                      onChange={(event) => setShippingData((current) => ({ ...current, neighborhood: event.target.value }))}
                      placeholder="Apartamento, torre, barrio, referencia"
                      className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3.5 text-sm text-stone-700 outline-none transition focus:ring-2 focus:ring-wine/20"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.16em] text-stone-500">
                      Notas de entrega
                    </label>
                    <input
                      value={shippingData.notes}
                      onChange={(event) => setShippingData((current) => ({ ...current, notes: event.target.value }))}
                      placeholder="Indicaciones adicionales"
                      className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3.5 text-sm text-stone-700 outline-none transition focus:ring-2 focus:ring-wine/20"
                    />
                  </div>
                </div>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-between">
                  <button
                    onClick={() => goToStep(1)}
                    className="inline-flex cursor-pointer items-center justify-center rounded-full border border-stone-300 px-6 py-3 text-[11px] font-medium uppercase tracking-[0.16em] text-stone-600 transition-colors hover:border-stone-400 hover:text-stone-800"
                  >
                    Volver
                  </button>
                  <button
                    onClick={handleShippingContinue}
                    className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-wine px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-white transition-colors hover:bg-wine-light"
                  >
                    Continuar a confirmación
                    <ChevronRight size={15} />
                  </button>
                </div>
              </m.section>
            )}

            {currentStep === 3 && (
              <m.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="rounded-[26px] border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
                <div className="mb-6 flex items-start gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-wine/10 text-wine">
                    <FileText size={18} />
                  </div>
                  <div>
                    <h2 className="text-2xl text-stone-800" style={{ fontFamily: 'var(--font-display)' }}>
                      Confirmar pedido
                    </h2>
                    <p className="mt-1 text-sm font-light text-stone-500">
                      Revisa que toda la información esté correcta antes de continuar al pago.
                    </p>
                  </div>
                </div>

                <div className="grid gap-5 lg:grid-cols-2">
                  <div className="rounded-3xl border border-stone-200 bg-ivory/60 p-5">
                    <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.22em] text-stone-500">Datos personales</p>
                    <div className="space-y-3 text-sm text-stone-600">
                      <div>
                        <span className="block text-[10px] uppercase tracking-[0.18em] text-stone-400">Nombre</span>
                        <p className="mt-1 text-stone-700">{customerData.fullName}</p>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase tracking-[0.18em] text-stone-400">WhatsApp</span>
                        <p className="mt-1 text-stone-700">{fullPhone}</p>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase tracking-[0.18em] text-stone-400">Correo</span>
                        <p className="mt-1 text-stone-700">{customerData.email}</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-stone-200 bg-ivory/60 p-5">
                    <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.22em] text-stone-500">Datos de envío</p>
                    <div className="space-y-3 text-sm text-stone-600">
                      <div>
                        <span className="block text-[10px] uppercase tracking-[0.18em] text-stone-400">País</span>
                        <p className="mt-1 text-stone-700">{shippingData.countryName}</p>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase tracking-[0.18em] text-stone-400">{getRegionLabel(shippingData.countryCode)}</span>
                        <p className="mt-1 text-stone-700">{shippingData.region}</p>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase tracking-[0.18em] text-stone-400">{getCityLabel(shippingData.countryCode)}</span>
                        <p className="mt-1 text-stone-700">{shippingData.city}</p>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase tracking-[0.18em] text-stone-400">Dirección</span>
                        <p className="mt-1 text-stone-700">{shippingData.address}</p>
                      </div>
                      {shippingData.neighborhood && (
                        <div>
                          <span className="block text-[10px] uppercase tracking-[0.18em] text-stone-400">Referencias</span>
                          <p className="mt-1 text-stone-700">{shippingData.neighborhood}</p>
                        </div>
                      )}
                      {shippingData.notes && (
                        <div>
                          <span className="block text-[10px] uppercase tracking-[0.18em] text-stone-400">Notas</span>
                          <p className="mt-1 text-stone-700">{shippingData.notes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-5 rounded-3xl border border-stone-200 p-5">
                  <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.22em] text-stone-500">Productos del carrito</p>
                  <div className="space-y-3">
                    {orderLines.map((line) => (
                      <div key={line.id} className="flex items-start justify-between gap-4 border-b border-stone-100 pb-3 last:border-b-0 last:pb-0">
                        <div className="min-w-0">
                          <p className="text-sm text-stone-700">{line.name}</p>
                          <p className="mt-1 text-[11px] font-light text-stone-400">
                            {line.ref ? `${line.ref} · ` : ''}
                            {line.quantity} unidades
                          </p>
                        </div>
                        <p className="text-sm font-medium text-stone-700">{formatCOP(line.subtotal)}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-between">
                  <button
                    onClick={() => goToStep(2)}
                    className="inline-flex cursor-pointer items-center justify-center rounded-full border border-stone-300 px-6 py-3 text-[11px] font-medium uppercase tracking-[0.16em] text-stone-600 transition-colors hover:border-stone-400 hover:text-stone-800"
                  >
                    Volver a editar
                  </button>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button
                      onClick={() => {
                        setPaymentMethod('whatsapp');
                        setShowShippingNotice(true);
                      }}
                      disabled={loading}
                      className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-emerald-600 px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700 transition-colors hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <MessageCircle size={15} />
                      Pagar por WhatsApp
                    </button>
                    <button
                      onClick={() => {
                        setPaymentMethod('mercadopago');
                        setShowShippingNotice(true);
                      }}
                      disabled={loading}
                      className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-wine px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-white transition-colors hover:bg-wine-light disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {loading && <Loader2 size={15} className="animate-spin" />}
                      Proceder al pago
                    </button>
                  </div>
                </div>
              </m.section>
            )}

            {currentStep === 4 && (
              <m.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-[26px] border border-stone-200 bg-white px-6 py-16 text-center shadow-sm sm:px-10">
                <div className="relative mx-auto mb-8 h-20 w-20">
                  <div className="absolute inset-0 rounded-full bg-wine/20 animate-ping" />
                  <div className="relative flex h-20 w-20 items-center justify-center rounded-full border border-stone-200 bg-white shadow-sm">
                    <Loader2 size={32} className="animate-spin text-wine" />
                  </div>
                </div>
                <p className="text-3xl text-stone-800" style={{ fontFamily: 'var(--font-display)' }}>
                  {paymentMethod === 'whatsapp' ? 'Estamos preparando tu pedido...' : 'Estamos preparando tu pago seguro...'}
                </p>
                <p className="mx-auto mt-4 max-w-lg text-sm font-light leading-relaxed text-stone-500">
                  {paymentMethod === 'whatsapp'
                    ? 'Estamos creando tu orden y te redirigiremos a WhatsApp con el número de pedido, los productos y el valor para coordinar el pago.'
                    : 'Estamos creando tu orden y generando la preferencia de Mercado Pago para redirigirte de forma segura.'}
                </p>
              </m.section>
            )}
          </div>

          <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-[26px] border border-stone-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-wine/10 text-wine">
                  <Package size={17} />
                </div>
                <div>
                  <h3 className="text-lg text-stone-800" style={{ fontFamily: 'var(--font-display)' }}>
                    Resumen del pedido
                  </h3>
                  <p className="text-xs font-light text-stone-400">{totalItems} piezas en tu carrito</p>
                </div>
              </div>

              <div className="max-h-64 space-y-3 overflow-y-auto pr-1">
                {orderLines.map((line) => (
                  <div key={line.id} className="flex items-start justify-between gap-3 border-b border-stone-100 pb-3 last:border-b-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-stone-700">{line.name}</p>
                      <p className="mt-1 text-[11px] font-light text-stone-400">
                        {line.quantity} x {line.ref || 'Referencia'}
                      </p>
                    </div>
                    <span className="text-sm font-medium text-stone-700">{formatCOP(line.subtotal)}</span>
                  </div>
                ))}
              </div>

              <div className="mt-5 space-y-2.5 border-t border-stone-200 pt-5 text-sm" style={{ fontVariantNumeric: 'tabular-nums' }}>
                <div className="flex justify-between text-stone-500">
                  <span>Subtotal</span>
                  <span>{formatCOP(subtotalPublico)}</span>
                </div>
                {ahorro > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Descuento {tierInfo.label}</span>
                    <span>-{formatCOP(ahorro)}</span>
                  </div>
                )}
                <div className="flex justify-between items-baseline border-t border-stone-200 pt-3">
                  <span className="font-semibold text-stone-700">Total</span>
                  <span className="text-3xl font-bold text-wine" style={{ fontFamily: 'var(--font-display)' }}>
                    {formatCOP(total)}
                  </span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {showShippingNotice && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowShippingNotice(false)}
        >
          <div
            className="relative w-full max-w-md rounded-xl bg-white p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              onClick={() => setShowShippingNotice(false)}
              className="absolute right-4 top-4 cursor-pointer text-stone-400 hover:text-stone-600"
              aria-label="Cerrar"
            >
              <X size={18} />
            </button>

            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-gold/20 bg-gold/10">
                <Truck size={18} className="text-gold-dark" />
              </div>
              <div>
                <h3 className="text-[15px] text-stone-800" style={{ fontFamily: 'var(--font-serif)' }}>
                  El envío se cobra por separado
                </h3>
                <p className="mt-1 text-sm font-light leading-relaxed text-stone-600">
                  Este pago cubre tu pedido, no el envío. El costo varía según tu ciudad y si es nacional o internacional. Te lo confirmamos por WhatsApp junto con la guía.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowShippingNotice(false)}
                className="cursor-pointer rounded-lg border border-stone-200 px-4 py-2 text-sm text-stone-600 transition-colors hover:bg-stone-50"
              >
                Volver
              </button>
              <button
                onClick={() => {
                  setShowShippingNotice(false);
                  handleProceedToPayment(paymentMethod);
                }}
                className="cursor-pointer rounded-lg bg-wine px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-wine-light"
              >
                {paymentMethod === 'whatsapp' ? 'Continuar por WhatsApp' : 'Continuar al pago'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
