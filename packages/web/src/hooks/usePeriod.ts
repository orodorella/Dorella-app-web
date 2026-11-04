'use client';

import { useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { periodFromParams, periodToParams, STANDARD_PRESETS, type PeriodPreset, type ResolvedPeriod } from '@/lib/admin-period';

/** Periodo de la pantalla, persistido en la URL (?periodo=…&desde=…&hasta=…). */
export function usePeriod(allowed: PeriodPreset[] = STANDARD_PRESETS): {
  period: ResolvedPeriod;
  setPeriod: (preset: PeriodPreset, custom?: { from: string; to: string }) => void;
  /** Enlace a otra pantalla del panel conservando el periodo elegido. */
  withPeriod: (href: string) => string;
} {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const allowedKey = allowed.join(',');
  const search = params.toString();

  const period = useMemo(
    () => periodFromParams(new URLSearchParams(search), allowedKey.split(',') as PeriodPreset[]),
    [search, allowedKey],
  );

  const setPeriod = useCallback((preset: PeriodPreset, custom?: { from: string; to: string }) => {
    const qs = periodToParams(new URLSearchParams(search), preset, custom).toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [search, pathname, router]);

  const withPeriod = useCallback((href: string) => {
    const custom = period.preset === 'custom' ? { from: period.from, to: period.to } : undefined;
    const qs = periodToParams(new URLSearchParams(), period.preset, custom).toString();
    return qs ? `${href}${href.includes('?') ? '&' : '?'}${qs}` : href;
  }, [period.preset, period.from, period.to]);

  return { period, setPeriod, withPeriod };
}
