'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { m } from 'framer-motion';
import { Loader2, ArrowLeft, CheckCircle2, ChevronRight, User, MapPin, FileText, CreditCard, Package } from 'lucide-react';
import { useAuth } from '@/context/AuthProvider';
import { useCart } from '@/context/CartProvider';
import { useToast } from '@/context/ToastProvider';
import { ColombiaLocationFields } from '@/components/shared/ColombiaLocationFields';
import { isValidCityForDepartment, normalizeDepartment } from '@/data/colombia-locations';
import { formatCOP, TIER_MAP } from '@/lib/api-client';
import { request } from '@/hooks/useApi';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

type CheckoutStep = 1 | 2 | 3 | 4;

type CustomerData = {
  fullName: string;
  phone: string;
  email: string;
};

type ShippingData = {
  city: string;
  department: string;
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
  { id: 2, title: 'Envio', short: 'Envio', icon: MapPin },
  { id: 3, title: 'Confirmacion', short: 'Confirmar', icon: FileText },
  { id: 4, title: 'Pago', short: 'Pago', icon: CreditCard },
];

function validateCustomer(data: CustomerData) {
  const errors: Partial<Record<keyof CustomerData, string>> = {};

  if (!data.fullName.trim()) errors.fullName = 'Ingresa el nombre completo.';
  if (!data.phone.trim()) errors.phone = 'Ingresa un celular o WhatsApp.';
  if (!data.email.trim()) {
    errors.email = 'Ingresa un correo electronico.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) {
    errors.email = 'Ingresa un correo valido.';
  }

  return errors;
}

function validateShipping(data: ShippingData) {
  const errors: Partial<Record<keyof ShippingData, string>> = {};

  if (!data.department.trim()) errors.department = 'Ingresa el departamento.';
  if (!data.city.trim()) {
    errors.city = 'Ingresa la ciudad.';
  } else if (data.department.trim() && !isValidCityForDepartment(data.department, data.city)) {
    errors.city = 'Selecciona una ciudad valida para el departamento elegido.';
  }
  if (!data.address.trim()) errors.address = 'Ingresa la direccion.';

  return errors;
}

function buildOrderNotes(shippingData: ShippingData) {
  const parts = [
    shippingData.department.trim() ? `Departamento: ${shippingData.department.trim()}` : null,
    shippingData.neighborhood.trim() ? `Barrio / complemento: ${shippingData.neighborhood.trim()}` : null,
    shippingData.notes.trim() ? `Notas de entrega: ${shippingData.notes.trim()}` : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(' | ') : undefined;
}

export default function CheckoutPage() {
  const { user, tierInfo, setTier, updateProfile } = useAuth();
  const { carrito, clearCart, subtotalPublico, subtotalTier, ahorro, totalItems, hydrated } = useCart();
  const { showToast } = useToast();
  const router = useRouter();

  const [currentStep, setCurrentStep] = useState<CheckoutStep>(1);
  const [loading, setLoading] = useState(false);
  const [showShippingNotice, setShowShippingNotice] = useState(false);
  const [customerErrors, setCustomerErrors] = useState<Partial<Record<keyof CustomerData, string>>>({});
  const [shippingErrors, setShippingErrors] = useState<Partial<Record<keyof ShippingData, string>>>({});
  const [customerData, setCustomerData] = useState<CustomerData>({
    fullName: '',
    phone: '',
    email: '',
  });
  const [shippingData, setShippingData] = useState<ShippingData>({
    city: '',
    department: '',
    address: '',
    neighborhood: '',
    notes: '',
  });

  const total = subtotalTier;

  useEffect(() => {
    if (hydrated && carrito.length === 0 && currentStep !== 4) {
      router.push('/carrito');
    }
  }, [carrito.length, currentStep, hydrated, router]);

  useEffect(() => {
    if (!user) return;

    setCustomerData((current) => ({
      fullName: current.fullName || user.nombre || '',
      phone: current.phone || user.telefono || '',
      email: current.email || user.email || '',
    }));

    setShippingData((current) => ({
      city: current.city || user.ciudad || '',
      department: current.department || user.departamento || '',
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
      telefono: customerData.phone.trim(),
      departamento: normalizeDepartment(shippingData.department.trim()) || shippingData.department.trim(),
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
      showToast('Completa los datos de envio para continuar.', 'error');
      return;
    }

    try {
      await syncProfileIfNeeded();
      setCurrentStep(3);
    } catch (error) {
      showToast((error as Error).message, 'error');
    }
  }

  async function handleProceedToPayment() {
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
      showToast('Revisa los datos de envio antes de continuar.', 'error');
      return;
    }

    setLoading(true);
    setCurrentStep(4);

    try {
      await syncProfileIfNeeded();

      const orderRes = await request('POST', '/api/orders', {
        items: carrito.map((i) => ({ productId: i.product.id, cantidad: i.cantidad })),
        notas: buildOrderNotes(shippingData),
      });

      if (!orderRes.success) throw new Error(orderRes.error?.message || 'Error creando orden');
      const result = orderRes.data;

      const paymentRes = await request('POST', '/api/payments/mercadopago/preference', {
        orderId: result.order.id,
      });

      if (!paymentRes.success) {
        throw new Error(paymentRes.error?.message || 'No fue posible iniciar el pago con Mercado Pago');
      }

      const checkoutUrl = paymentRes.data.initPoint || paymentRes.data.sandboxInitPoint;
      if (!checkoutUrl) {
        throw new Error('Mercado Pago no devolvio una URL de pago valida');
      }

      if (result.tierUpgraded && result.newTier) {
        const frontendTier = TIER_MAP[result.newTier];
        if (frontendTier) setTier(frontendTier);
      }

      clearCart();
      window.location.assign(checkoutUrl);
    } catch (e) {
      setCurrentStep(3);
      setLoading(false);
      showToast((e as Error).message, 'error');
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
              Te guiaremos paso a paso para confirmar tus datos, revisar el envio y proceder al pago de forma segura.
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
                      Usaremos esta informacion para identificar tu pedido y mantenerte al tanto del proceso.
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
                      onChange={(e) => setCustomerData((current) => ({ ...current, fullName: e.target.value }))}
                      className={`w-full rounded-2xl border bg-white px-4 py-3.5 text-sm text-stone-700 outline-none transition focus:ring-2 focus:ring-wine/20 ${
                        customerErrors.fullName ? 'border-red-300' : 'border-stone-200'
                      }`}
                    />
                    {customerErrors.fullName && <p className="mt-2 text-xs text-red-500">{customerErrors.fullName}</p>}
                  </div>

                  <div>
                    <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.16em] text-stone-500">
                      Celular / WhatsApp
                    </label>
                    <input
                      value={customerData.phone}
                      onChange={(e) => setCustomerData((current) => ({ ...current, phone: e.target.value }))}
                      className={`w-full rounded-2xl border bg-white px-4 py-3.5 text-sm text-stone-700 outline-none transition focus:ring-2 focus:ring-wine/20 ${
                        customerErrors.phone ? 'border-red-300' : 'border-stone-200'
                      }`}
                    />
                    {customerErrors.phone && <p className="mt-2 text-xs text-red-500">{customerErrors.phone}</p>}
                  </div>

                  <div>
                    <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.16em] text-stone-500">
                      Correo electronico
                    </label>
                    <input
                      type="email"
                      value={customerData.email}
                      onChange={(e) => setCustomerData((current) => ({ ...current, email: e.target.value }))}
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
                    Continuar a envio
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
                      Datos de envio
                    </h2>
                    <p className="mt-1 text-sm font-light text-stone-500">
                      Completa el destino de tu pedido para que podamos despacharlo correctamente.
                    </p>
                  </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <ColombiaLocationFields
                    department={shippingData.department}
                    city={shippingData.city}
                    departmentError={shippingErrors.department}
                    cityError={shippingErrors.city}
                    onDepartmentChange={(value) =>
                      setShippingData((current) => ({
                        ...current,
                        department: value,
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
                      Direccion
                    </label>
                    <input
                      value={shippingData.address}
                      onChange={(e) => setShippingData((current) => ({ ...current, address: e.target.value }))}
                      className={`w-full rounded-2xl border bg-white px-4 py-3.5 text-sm text-stone-700 outline-none transition focus:ring-2 focus:ring-wine/20 ${
                        shippingErrors.address ? 'border-red-300' : 'border-stone-200'
                      }`}
                    />
                    {shippingErrors.address && <p className="mt-2 text-xs text-red-500">{shippingErrors.address}</p>}
                  </div>

                  <div>
                    <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.16em] text-stone-500">
                      Barrio / complemento
                    </label>
                    <input
                      value={shippingData.neighborhood}
                      onChange={(e) => setShippingData((current) => ({ ...current, neighborhood: e.target.value }))}
                      className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3.5 text-sm text-stone-700 outline-none transition focus:ring-2 focus:ring-wine/20"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.16em] text-stone-500">
                      Notas de entrega
                    </label>
                    <input
                      value={shippingData.notes}
                      onChange={(e) => setShippingData((current) => ({ ...current, notes: e.target.value }))}
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
                    Continuar a confirmacion
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
                      Revisa que toda la informacion este correcta antes de continuar al pago.
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
                        <span className="block text-[10px] uppercase tracking-[0.18em] text-stone-400">Celular</span>
                        <p className="mt-1 text-stone-700">{customerData.phone}</p>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase tracking-[0.18em] text-stone-400">Correo</span>
                        <p className="mt-1 text-stone-700">{customerData.email}</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-stone-200 bg-ivory/60 p-5">
                    <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.22em] text-stone-500">Datos de envio</p>
                    <div className="space-y-3 text-sm text-stone-600">
                      <div>
                        <span className="block text-[10px] uppercase tracking-[0.18em] text-stone-400">Ciudad</span>
                        <p className="mt-1 text-stone-700">{shippingData.city}</p>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase tracking-[0.18em] text-stone-400">Departamento</span>
                        <p className="mt-1 text-stone-700">{shippingData.department}</p>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase tracking-[0.18em] text-stone-400">Direccion</span>
                        <p className="mt-1 text-stone-700">{shippingData.address}</p>
                      </div>
                      {shippingData.neighborhood && (
                        <div>
                          <span className="block text-[10px] uppercase tracking-[0.18em] text-stone-400">Barrio / complemento</span>
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
                  <button
                    onClick={() => setShowShippingNotice(true)}
                    disabled={loading}
                    className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-wine px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-white transition-colors hover:bg-wine-light disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {loading && <Loader2 size={15} className="animate-spin" />}
                    Proceder al pago
                  </button>
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
                  Estamos preparando tu pago seguro...
                </p>
                <p className="mx-auto mt-4 max-w-lg text-sm font-light leading-relaxed text-stone-500">
                  Estamos creando tu orden y generando la preferencia de Mercado Pago para redirigirte de forma segura.
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

      <ConfirmDialog
        open={showShippingNotice}
        title="El envío se paga aparte"
        message="Este pago no incluye el costo de envío. El valor depende de tu ciudad y de si el envío es nacional o internacional — te lo confirmamos por WhatsApp junto con la guía de tu pedido."
        confirmLabel="Entendido, continuar al pago"
        cancelLabel="Volver"
        onConfirm={() => {
          setShowShippingNotice(false);
          handleProceedToPayment();
        }}
        onCancel={() => setShowShippingNotice(false)}
      />
    </div>
  );
}
