'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Calculator,
  ChevronLeft,
  ChevronRight,
  Copy,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { formatCOP } from '@/lib/api-client';
import {
  calculatePricing,
  type AdditionalCosts,
  type CalculatorSelection,
} from '@/lib/pricing-calculator';
import { pricingItems } from '@/mocks/pricing-items';

const INITIAL_ADDITIONAL_COSTS: AdditionalCosts = {
  costoTejida: 0,
  costoHerrajes: 0,
  costoAccesorios: 0,
  costoEmpaque: 0,
};

const PRODUCT_TYPES = [
  'Aretes',
  'Pulsera',
  'Collar',
  'Tobillera',
  'Anillo',
  'Dije',
  'Personalizado',
  'Artículo tejido',
] as const;

const STEP_LABELS = [
  'Elige el tipo de pieza',
  'Agrega los insumos',
  'Suma costos adicionales',
  'Resultado sugerido',
] as const;

const CATEGORY_OPTIONS = [
  'Balineria Lisa',
  'Balineria Diamantada',
  'Balineria Frances',
  'Neoprenos y Otros',
] as const;

type ProductType = typeof PRODUCT_TYPES[number];

function clampStep(step: number) {
  return Math.max(0, Math.min(3, step));
}

function buildSummaryText(params: {
  productType: ProductType;
  pieceName: string;
  result: ReturnType<typeof calculatePricing>;
}) {
  const title = params.pieceName.trim() || params.productType;

  return [
    `Cotización: ${title}`,
    `Tipo de pieza: ${params.productType}`,
    `Costo de insumos: ${formatCOP(params.result.costoBalines)}`,
    `Precio si compras Por Mayor: ${formatCOP(params.result.costoPorMayor)}`,
    `Precio si compras Gran Mayor: ${formatCOP(params.result.precioGranMayor)}`,
    `Precio sugerido para vender al público: ${formatCOP(params.result.precioVentaDetal)}`,
    `Ganancia estimada al vender al público: ${formatCOP(params.result.gananciaEstimadaDetal)}`,
  ].join('\n');
}

export default function FloatingPricingCalculator() {
  const [open, setOpen] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [additionalCosts, setAdditionalCosts] = useState<AdditionalCosts>(INITIAL_ADDITIONAL_COSTS);
  const [productType, setProductType] = useState<ProductType>('Pulsera');
  const [pieceName, setPieceName] = useState('');
  const [step, setStep] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string>(CATEGORY_OPTIONS[0]);
  const [selectedIngredientId, setSelectedIngredientId] = useState<string>(pricingItems[0]?.id || '');
  const [ingredientQuantity, setIngredientQuantity] = useState('1');
  const [copied, setCopied] = useState(false);
  const [recentlyAddedId, setRecentlyAddedId] = useState<string | null>(null);
  const [showAddedFeedback, setShowAddedFeedback] = useState(false);
  const [addButtonState, setAddButtonState] = useState<'idle' | 'added'>('idle');
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const addedItemsRef = useRef<HTMLDivElement | null>(null);

  const selectedItems = useMemo<CalculatorSelection[]>(
    () => pricingItems.map((item) => ({ ...item, cantidad: quantities[item.id] || 0 })),
    [quantities],
  );

  const result = useMemo(
    () => calculatePricing(selectedItems, additionalCosts),
    [selectedItems, additionalCosts],
  );

  const selectedRows = useMemo(
    () => result.rows.filter((row) => row.cantidad > 0),
    [result.rows],
  );

  const categoryItems = useMemo(
    () => pricingItems.filter((item) => item.category === selectedCategory),
    [selectedCategory],
  );

  const selectedIngredient = useMemo(
    () => pricingItems.find((item) => item.id === selectedIngredientId) ?? categoryItems[0] ?? null,
    [categoryItems, selectedIngredientId],
  );

  useEffect(() => {
    if (!recentlyAddedId) return;

    const highlightTimer = window.setTimeout(() => setRecentlyAddedId(null), 2400);
    return () => window.clearTimeout(highlightTimer);
  }, [recentlyAddedId]);

  useEffect(() => {
    if (!showAddedFeedback) return;

    const feedbackTimer = window.setTimeout(() => setShowAddedFeedback(false), 2200);
    return () => window.clearTimeout(feedbackTimer);
  }, [showAddedFeedback]);

  useEffect(() => {
    if (addButtonState !== 'added') return;

    const buttonTimer = window.setTimeout(() => setAddButtonState('idle'), 1200);
    return () => window.clearTimeout(buttonTimer);
  }, [addButtonState]);

  function updateQuantity(id: string, value: string) {
    const cantidad = Math.max(0, Number(value) || 0);
    setQuantities((prev) => ({ ...prev, [id]: cantidad }));
  }

  function updateAdditionalCost(key: keyof AdditionalCosts, value: string) {
    const amount = Math.max(0, Number(value) || 0);
    setAdditionalCosts((prev) => ({ ...prev, [key]: amount }));
  }

  function handleReset() {
    setQuantities({});
    setAdditionalCosts(INITIAL_ADDITIONAL_COSTS);
    setProductType('Pulsera');
    setPieceName('');
    setStep(0);
    setSelectedCategory(CATEGORY_OPTIONS[0]);
    setSelectedIngredientId(pricingItems[0]?.id || '');
    setIngredientQuantity('1');
    setCopied(false);
    setRecentlyAddedId(null);
    setShowAddedFeedback(false);
    setAddButtonState('idle');
  }

  function handleCategoryChange(category: string) {
    setSelectedCategory(category);
    const firstItem = pricingItems.find((item) => item.category === category);
    if (firstItem) setSelectedIngredientId(firstItem.id);
  }

  function handleAddIngredient() {
    if (!selectedIngredient) return;
    const cantidad = Math.max(0, Number(ingredientQuantity) || 0);
    if (cantidad <= 0) return;

    setQuantities((prev) => ({
      ...prev,
      [selectedIngredient.id]: (prev[selectedIngredient.id] || 0) + cantidad,
    }));
    setIngredientQuantity('1');
    setRecentlyAddedId(selectedIngredient.id);
    setShowAddedFeedback(true);
    setAddButtonState('added');

    window.requestAnimationFrame(() => {
      const container = scrollContainerRef.current;
      const target = addedItemsRef.current;

      if (!container || !target) return;

      const top = target.offsetTop - 24;
      container.scrollTo({ top, behavior: 'smooth' });
    });
  }

  function removeIngredient(id: string) {
    setQuantities((prev) => ({ ...prev, [id]: 0 }));
  }

  async function copySummary() {
    const text = buildSummaryText({ productType, pieceName, result });

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  const activeCount = selectedRows.length;
  const summaryTitle = pieceName.trim() || productType;
  const hasCustomSummaryTitle = pieceName.trim().length > 0;
  const canAdvanceFromIngredients = selectedRows.length > 0;
  const canGoNext = (step === 0) || (step === 1 && canAdvanceFromIngredients) || step === 2;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 inline-flex cursor-pointer items-center gap-2.5 rounded-full border border-gold/25 bg-white/92 px-3.5 py-2.5 text-sm font-bold text-wine shadow-[0_14px_34px_rgba(61,10,15,0.14)] backdrop-blur-md transition-all hover:-translate-y-0.5 hover:border-gold/45 hover:bg-white sm:px-4"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-wine text-white shadow-sm">
          <Calculator size={17} />
        </span>
        <span className="leading-none">Calcula tus precios</span>
      </button>

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
            <motion.button
              type="button"
              aria-label="Cerrar calculadora"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-[2px] cursor-pointer"
            />

            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.98 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="relative z-10 flex h-[92vh] w-full max-w-[980px] flex-col overflow-hidden rounded-t-[28px] bg-[linear-gradient(180deg,#fffdf8_0%,#fffaf2_100%)] shadow-2xl sm:h-[88vh] sm:rounded-[28px] sm:border sm:border-stone-200"
            >
              <div className="shrink-0 border-b border-stone-200/80 bg-white/75 px-5 py-5 backdrop-blur-md sm:px-8">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-gold">
                      Cotizador Dorella
                    </p>
                    <h2 className="text-3xl text-stone-800" style={{ fontFamily: 'var(--font-display)' }}>
                      Calcula tus precios
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm font-light leading-relaxed text-stone-500">
                      Cotiza una pieza a partir de sus insumos y obten precios sugeridos para detal, mayor y gran mayor.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-full border border-stone-200 bg-white p-2 text-stone-500 transition-colors hover:text-stone-700 cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {STEP_LABELS.map((label, index) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setStep(index)}
                      className={`rounded-2xl border px-3 py-3 text-left transition-all cursor-pointer ${
                        step === index
                          ? 'border-wine bg-wine text-white shadow-sm'
                          : index < step
                            ? 'border-gold/30 bg-gold/10 text-stone-700'
                            : 'border-stone-200 bg-white/80 text-stone-400 hover:border-stone-300'
                      }`}
                    >
                      <p className={`text-[10px] uppercase tracking-[0.18em] ${step === index ? 'text-white/70' : 'text-inherit'}`}>
                        Paso {index + 1}
                      </p>
                      <p className="mt-1 text-sm font-semibold leading-snug">{label}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-1 overflow-hidden">
                <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-5 py-5 sm:px-8 sm:py-6">
                  {step === 0 && (
                    <section className="space-y-5">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gold">Paso 1</p>
                        <h3 className="mt-2 text-3xl text-stone-800" style={{ fontFamily: 'var(--font-display)' }}>
                          ¿Qué pieza quieres cotizar?
                        </h3>
                        <p className="mt-2 max-w-2xl text-sm font-light leading-relaxed text-stone-500">
                          Empieza eligiendo el tipo de pieza para personalizar mejor tu cotización.
                        </p>
                      </div>

                      <div className="rounded-[22px] border border-stone-200/80 bg-white/88 p-4 shadow-sm">
                        <label className="block">
                          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                            Nombre de la cotización
                          </span>
                          <input
                            type="text"
                            value={pieceName}
                            onChange={(event) => setPieceName(event.target.value)}
                            placeholder="Ej. Pulsera balines #4"
                            className="w-full rounded-2xl border border-stone-200 bg-stone-50/60 px-4 py-3 text-sm text-stone-700 outline-none transition-colors focus:border-gold/60"
                          />
                        </label>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                        {PRODUCT_TYPES.map((type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => setProductType(type)}
                            className={`rounded-[18px] border px-3.5 py-2.5 text-left transition-all cursor-pointer ${
                              productType === type
                                ? 'border-wine bg-wine text-white shadow-[0_10px_24px_rgba(91,14,22,0.14)]'
                                : 'border-stone-200 bg-white/92 hover:border-gold/35 hover:shadow-sm'
                            }`}
                          >
                            <p className="text-sm font-semibold leading-snug">{type}</p>
                          </button>
                        ))}
                      </div>
                    </section>
                  )}
                
                  {step === 1 && (
                    <section className="space-y-6">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gold">Paso 2</p>
                        <h3 className="mt-2 text-3xl text-stone-800" style={{ fontFamily: 'var(--font-display)' }}>
                          Agrega los insumos
                        </h3>
                        <p className="mt-2 max-w-2xl text-sm font-light leading-relaxed text-stone-500">
                          Selecciona la categoria, agrega el insumo y define la cantidad que usaras en tu pieza.
                        </p>
                      </div>

                      <div className="rounded-[24px] border border-stone-200/80 bg-white/90 p-5 shadow-sm">
                        <div className="grid gap-3 lg:grid-cols-[180px_1fr_140px_auto]">
                          <label className="block">
                            <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">Categoria</span>
                            <select
                              value={selectedCategory}
                              onChange={(event) => handleCategoryChange(event.target.value)}
                              className="w-full rounded-2xl border border-stone-200 bg-stone-50/60 px-4 py-3 text-sm text-stone-700 outline-none transition-colors focus:border-gold/60"
                            >
                              {CATEGORY_OPTIONS.map((category) => (
                                <option key={category} value={category}>{category}</option>
                              ))}
                            </select>
                          </label>

                          <label className="block">
                            <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">Insumo</span>
                            <select
                              value={selectedIngredient?.id || ''}
                              onChange={(event) => setSelectedIngredientId(event.target.value)}
                              className="w-full rounded-2xl border border-stone-200 bg-stone-50/60 px-4 py-3 text-sm text-stone-700 outline-none transition-colors focus:border-gold/60"
                            >
                              {categoryItems.map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.name} - {formatCOP(item.unitCost)}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="block">
                            <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">Cantidad</span>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={ingredientQuantity}
                              onChange={(event) => setIngredientQuantity(event.target.value)}
                              className="w-full rounded-2xl border border-stone-200 bg-stone-50/60 px-4 py-3 text-sm text-stone-700 outline-none transition-colors focus:border-gold/60"
                            />
                          </label>

                          <div className="flex items-end">
                            <button
                              type="button"
                              onClick={handleAddIngredient}
                              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-wine px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-wine-light cursor-pointer lg:w-auto"
                            >
                              <Plus size={16} />
                              {addButtonState === 'added' ? 'Agregado' : 'Agregar'}
                            </button>
                          </div>
                        </div>

                        <AnimatePresence>
                          {showAddedFeedback && (
                            <motion.div
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -4 }}
                              className="mt-3 inline-flex items-center rounded-full border border-gold/30 bg-gold/10 px-3 py-1.5 text-xs font-medium text-gold-dark"
                            >
                              Insumo agregado a la cotizacion
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      <div
                        ref={addedItemsRef}
                        className="rounded-[24px] border border-stone-200/80 bg-white/90 shadow-sm"
                      >
                        <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
                          <div>
                            <h4 className="text-lg text-stone-800" style={{ fontFamily: 'var(--font-display)' }}>
                              Insumos agregados
                            </h4>
                          </div>
                          <span className="rounded-full bg-gold/10 px-3 py-1 text-xs font-medium text-gold-dark">
                            {activeCount} activo(s)
                          </span>
                        </div>

                        {selectedRows.length === 0 ? (
                          <div className="px-5 py-12 text-center">
                            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-stone-100 text-stone-300">
                              <Sparkles size={20} />
                            </div>
                            <p className="mt-4 text-lg text-stone-700" style={{ fontFamily: 'var(--font-display)' }}>
                              Aun no has agregado insumos
                            </p>
                            <p className="mt-2 text-sm font-light text-stone-400">
                              Selecciona un componente para empezar tu cotizacion.
                            </p>
                          </div>
                        ) : (
                          <div className="overflow-x-auto px-2 py-2">
                            <table className="w-full min-w-[560px] border-separate border-spacing-y-1.5 text-sm">
                              <thead>
                                <tr className="text-left text-[10px] uppercase tracking-[0.16em] text-stone-400">
                                  <th className="px-3 py-1.5 font-semibold">Insumo</th>
                                  <th className="px-3 py-1.5 font-semibold">Cantidad</th>
                                  <th className="px-3 py-1.5 font-semibold">Costo unitario</th>
                                  <th className="px-3 py-1.5 font-semibold">Subtotal</th>
                                  <th className="px-3 py-1.5 font-semibold"></th>
                                </tr>
                              </thead>
                              <tbody>
                                {selectedRows.map((row) => (
                                  <tr
                                    key={row.id}
                                    className={`rounded-2xl text-stone-700 shadow-[inset_0_0_0_1px_rgba(231,229,228,0.9)] transition-all duration-500 ${
                                      recentlyAddedId === row.id
                                        ? 'bg-[rgba(232,213,163,0.38)] shadow-[inset_0_0_0_1px_rgba(201,168,76,0.55)]'
                                        : 'bg-stone-50/80'
                                    }`}
                                  >
                                    <td className="rounded-l-2xl px-3 py-2.5">
                                      <p className="font-semibold">{row.name}</p>
                                      <div className="mt-1 flex items-center gap-2">
                                        <p className="text-xs text-stone-400">{row.category}</p>
                                        {recentlyAddedId === row.id && (
                                          <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-medium text-gold-dark">
                                            Nuevo
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-3 py-2.5">
                                      <input
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={row.cantidad}
                                        onChange={(event) => updateQuantity(row.id, event.target.value)}
                                        className="w-18 rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-sm outline-none transition-colors focus:border-gold/60"
                                      />
                                    </td>
                                    <td className="px-3 py-2.5 font-medium">{formatCOP(row.unitCost)}</td>
                                    <td className="px-3 py-2.5 font-semibold text-wine">{formatCOP(row.subtotal)}</td>
                                    <td className="rounded-r-2xl px-3 py-2.5 text-right">
                                      <button
                                        type="button"
                                        onClick={() => removeIngredient(row.id)}
                                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-400 transition-colors hover:text-red-500 cursor-pointer"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </section>
                  )}

                  {step === 2 && (
                    <section className="space-y-6">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gold">Paso 3</p>
                        <h3 className="mt-2 text-[2rem] leading-tight text-stone-800" style={{ fontFamily: 'var(--font-display)' }}>
                          Suma costos adicionales
                        </h3>
                        <p className="mt-2 max-w-xl text-sm font-light leading-relaxed text-stone-500">
                          Agrega los costos que completan la pieza.
                        </p>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        {[
                          { key: 'costoTejida', label: 'Mano de obra / tejida', placeholder: '$0 COP' },
                          { key: 'costoHerrajes', label: 'Herrajes', placeholder: '$0 COP' },
                          { key: 'costoAccesorios', label: 'Accesorios', placeholder: '$0 COP' },
                          { key: 'costoEmpaque', label: 'Empaque', placeholder: '$0 COP' },
                        ].map((field) => (
                          <label key={field.key} className="block rounded-[20px] border border-stone-200/80 bg-white/92 p-4 shadow-sm">
                            <span className="mb-1.5 block text-[11px] font-semibold tracking-[0.08em] text-stone-500">
                              {field.label}
                            </span>
                            <input
                              type="number"
                              min="0"
                              step="100"
                              value={additionalCosts[field.key as keyof AdditionalCosts] || ''}
                              onChange={(event) => updateAdditionalCost(field.key as keyof AdditionalCosts, event.target.value)}
                              placeholder={field.placeholder}
                              className="w-full rounded-xl border border-stone-200 bg-stone-50/55 px-3.5 py-2.5 text-sm text-stone-700 outline-none transition-colors focus:border-gold/60"
                            />
                            <p className="mt-2 text-[11px] font-light text-stone-400">
                              Valor actual: {formatCOP(additionalCosts[field.key as keyof AdditionalCosts] || 0)}
                            </p>
                          </label>
                        ))}
                      </div>
                    </section>
                  )}

                  {step === 3 && (
                    <section className="space-y-6">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gold">Paso 4</p>
                        <h3 className="mt-2 text-[2rem] leading-tight text-stone-800" style={{ fontFamily: 'var(--font-display)' }}>
                          Resultado sugerido
                        </h3>
                        <p className="mt-2 max-w-xl text-sm font-light leading-relaxed text-stone-500">
                          Una referencia clara para entender compra y reventa.
                        </p>
                      </div>

                      <div className="rounded-[24px] bg-[linear-gradient(135deg,#5B0E16_0%,#7A1A24_100%)] p-5 text-white shadow-[0_16px_34px_rgba(91,14,22,0.18)] sm:p-6">
                        <p className="text-[10px] tracking-[0.18em] text-white/65">Precio sugerido para vender al público</p>
                        <h4 className="mt-2.5 text-3xl sm:text-[2.75rem]" style={{ fontFamily: 'var(--font-display)' }}>
                          {formatCOP(result.precioVentaDetal)}
                        </h4>
                        <p className="mt-2 text-sm text-white/72">Referencia estimada para venta al cliente final.</p>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {[
                          {
                            label: 'Costo de insumos',
                            value: result.costoBalines,
                            tone: 'text-stone-800',
                            help: 'Componentes seleccionados para la pieza.',
                          },
                          {
                            label: 'Precio si compras Por Mayor',
                            value: result.costoPorMayor,
                            tone: 'text-stone-800',
                            help: 'Insumos + costos adicionales.',
                          },
                          {
                            label: 'Precio si compras Gran Mayor',
                            value: result.precioGranMayor,
                            tone: 'text-stone-800',
                            help: 'Estimado para compras de mayor volumen.',
                          },
                          {
                            label: 'Ganancia estimada al vender al público',
                            value: result.gananciaEstimadaDetal,
                            tone: 'text-emerald-700',
                            help: 'Diferencia aproximada entre el precio Por Mayor y el precio sugerido de venta.',
                          },
                        ].map((entry) => (
                          <div key={entry.label} className="rounded-[20px] border border-stone-200/80 bg-white/92 p-4 shadow-sm">
                            <p className="text-[11px] tracking-[0.08em] text-stone-400">{entry.label}</p>
                            <p className={`mt-2 text-[1.65rem] font-semibold leading-tight ${entry.tone}`} style={{ fontFamily: 'var(--font-display)' }}>
                              {formatCOP(entry.value)}
                            </p>
                            <p className="mt-1.5 text-xs font-light leading-relaxed text-stone-400">{entry.help}</p>
                          </div>
                        ))}
                      </div>

                      <div className="rounded-[20px] border border-gold/15 bg-gold/8 p-4 text-sm font-light leading-relaxed text-stone-600">
                        Estos valores son estimados con la fórmula actual de Dorella. El precio Por Mayor parte de los insumos y costos adicionales de la pieza. Gran Mayor aplica una condición preferencial y el precio al público es una sugerencia para revender.
                      </div>

                      <div className="flex flex-wrap gap-2.5">
                        <button
                          type="button"
                          onClick={() => setStep(1)}
                          className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3.5 py-2 text-sm font-medium text-stone-700 transition-colors hover:border-stone-300 cursor-pointer"
                        >
                          Volver a editar
                        </button>
                        <button
                          type="button"
                          onClick={handleReset}
                          className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3.5 py-2 text-sm font-medium text-stone-700 transition-colors hover:border-stone-300 cursor-pointer"
                        >
                          Limpiar calculo
                        </button>
                        <button
                          type="button"
                          onClick={copySummary}
                          className="inline-flex items-center gap-2 rounded-full bg-wine px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-wine-light cursor-pointer"
                        >
                          <Copy size={15} />
                          {copied ? 'Resumen copiado' : 'Copiar resumen'}
                        </button>
                      </div>
                    </section>
                  )}
                </div>

                <aside className="hidden w-[272px] shrink-0 border-l border-stone-200/80 bg-white/65 px-4 py-4 xl:block">
                  <div className="sticky top-0 space-y-3">
                    <div className="rounded-[18px] border border-stone-200 bg-white/92 p-3.5 shadow-sm">
                      <p className="text-[10px] uppercase tracking-[0.16em] text-gold">Resumen rapido</p>
                      <h4
                        className="mt-1.5 text-lg leading-tight text-stone-800 break-words"
                        style={{ fontFamily: 'var(--font-display)' }}
                      >
                        {summaryTitle}
                      </h4>
                      <p className="mt-1 text-xs font-light text-stone-400">
                        {hasCustomSummaryTitle ? productType : 'Tipo de pieza'}
                      </p>
                    </div>

                    <div className="rounded-[18px] border border-stone-200 bg-white/92 p-3.5 shadow-sm">
                      <p className="text-[10px] uppercase tracking-[0.16em] text-stone-400">Insumos totales</p>
                      <p
                        className="mt-1.5 text-xl leading-none text-stone-800"
                        style={{ fontFamily: 'var(--font-display)' }}
                      >
                        {activeCount}
                      </p>
                      <p className="mt-2.5 text-xs font-light leading-relaxed text-stone-400">
                        Costo de insumos: {formatCOP(result.costoBalines)}
                      </p>
                    </div>
                  </div>
                </aside>
              </div>

              <div className="shrink-0 border-t border-stone-200/80 bg-white/78 px-5 py-3.5 backdrop-blur-md sm:px-8">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setStep((current) => clampStep(current - 1))}
                      disabled={step === 0}
                      className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3.5 py-2 text-sm font-medium text-stone-700 transition-colors hover:border-stone-300 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                    >
                      <ChevronLeft size={16} />
                      Atras
                    </button>
                    <button
                      type="button"
                      onClick={handleReset}
                      className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3.5 py-2 text-sm font-medium text-stone-700 transition-colors hover:border-stone-300 cursor-pointer"
                    >
                      <RotateCcw size={15} />
                      Reiniciar
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    <p className="hidden text-sm font-light text-stone-400 sm:block">Paso {step + 1} de 4</p>
                    <button
                      type="button"
                      onClick={() => setStep((current) => clampStep(current + 1))}
                      disabled={step === 3 || !canGoNext}
                      className="inline-flex items-center gap-2 rounded-full bg-wine px-4.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-wine-light disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                    >
                      {step === 2 ? 'Ver resultado' : 'Siguiente'}
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
