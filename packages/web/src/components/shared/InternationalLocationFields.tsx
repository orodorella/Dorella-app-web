'use client';

import { useMemo } from 'react';
import {
  COUNTRY_OPTIONS,
  getCityLabel,
  getCountryByCode,
  getRegionLabel,
  getRegionOptions,
} from '@/data/international-locations';

type Props = {
  countryCode: string;
  region: string;
  regionCode: string;
  city: string;
  countryError?: string;
  regionError?: string;
  cityError?: string;
  onCountryChange: (country: {
    countryCode: string;
    countryName: string;
    phoneCode: string;
  }) => void;
  onRegionChange: (region: { region: string; regionCode: string }) => void;
  onCityChange: (city: string) => void;
};

export function InternationalLocationFields({
  countryCode,
  region,
  regionCode,
  city,
  countryError,
  regionError,
  cityError,
  onCountryChange,
  onRegionChange,
  onCityChange,
}: Props) {
  const selectedCountry = useMemo(() => getCountryByCode(countryCode), [countryCode]);
  const regionOptions = useMemo(() => getRegionOptions(countryCode), [countryCode]);

  const regionLabel = getRegionLabel(countryCode);
  const cityLabel = getCityLabel(countryCode);
  const hasRegionOptions = regionOptions.length > 0;

  return (
    <>
      <div className="sm:col-span-2">
        <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.16em] text-stone-500">
          País
        </label>
        <select
          value={selectedCountry.isoCode}
          onChange={(event) => {
            const nextCountry = getCountryByCode(event.target.value);
            onCountryChange({
              countryCode: nextCountry.isoCode,
              countryName: nextCountry.name,
              phoneCode: nextCountry.phonecode,
            });
          }}
          className={`w-full rounded-2xl border bg-white px-4 py-3.5 text-sm text-stone-700 outline-none transition focus:ring-2 focus:ring-wine/20 ${
            countryError ? 'border-red-300' : 'border-stone-200'
          }`}
        >
          {COUNTRY_OPTIONS.map((country) => (
            <option key={country.isoCode} value={country.isoCode}>
              {country.name}
            </option>
          ))}
        </select>
        {countryError && <p className="mt-2 text-xs text-red-500">{countryError}</p>}
      </div>

      <div>
        <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.16em] text-stone-500">
          {regionLabel}
        </label>
        {hasRegionOptions ? (
          <select
            value={regionCode}
            onChange={(event) => {
              const nextRegion = regionOptions.find((item) => item.code === event.target.value);
              onRegionChange({
                region: nextRegion?.name ?? '',
                regionCode: nextRegion?.code ?? '',
              });
            }}
            className={`w-full rounded-2xl border bg-white px-4 py-3.5 text-sm text-stone-700 outline-none transition focus:ring-2 focus:ring-wine/20 ${
              regionError ? 'border-red-300' : 'border-stone-200'
            }`}
          >
            <option value="">Selecciona una opción</option>
            {regionOptions.map((item) => (
              <option key={item.code} value={item.code}>
                {item.name}
              </option>
            ))}
          </select>
        ) : (
          <input
            value={region}
            onChange={(event) =>
              onRegionChange({
                region: event.target.value,
                regionCode: '',
              })
            }
            placeholder={regionLabel}
            className={`w-full rounded-2xl border bg-white px-4 py-3.5 text-sm text-stone-700 outline-none transition focus:ring-2 focus:ring-wine/20 ${
              regionError ? 'border-red-300' : 'border-stone-200'
            }`}
          />
        )}
        {regionError ? (
          <p className="mt-2 text-xs text-red-500">{regionError}</p>
        ) : !hasRegionOptions ? (
          <p className="mt-2 text-xs text-stone-400">
            Puedes escribir esta información manualmente.
          </p>
        ) : null}
      </div>

      <div>
        <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.16em] text-stone-500">
          {cityLabel}
        </label>
        <input
          value={city}
          onChange={(event) => onCityChange(event.target.value)}
          placeholder={cityLabel}
          className={`w-full rounded-2xl border bg-white px-4 py-3.5 text-sm text-stone-700 outline-none transition focus:ring-2 focus:ring-wine/20 ${
            cityError ? 'border-red-300' : 'border-stone-200'
          }`}
        />
        {cityError ? (
          <p className="mt-2 text-xs text-red-500">{cityError}</p>
        ) : (
          <p className="mt-2 text-xs text-stone-400">
            Escribe la ciudad o municipio tal como debe aparecer en la guía.
          </p>
        )}
      </div>
    </>
  );
}
