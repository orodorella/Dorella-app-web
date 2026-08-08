type RegionOption = {
  code: string;
  name: string;
};

type CountryOption = {
  isoCode: string;
  name: string;
  phonecode: string;
  regionLabel?: string;
  cityLabel?: string;
  regionOptions?: RegionOption[];
};

const COLOMBIA_REGIONS: RegionOption[] = [
  { code: 'AMA', name: 'Amazonas' },
  { code: 'ANT', name: 'Antioquia' },
  { code: 'ARA', name: 'Arauca' },
  { code: 'ATL', name: 'Atlántico' },
  { code: 'BOL', name: 'Bolívar' },
  { code: 'BOY', name: 'Boyacá' },
  { code: 'CAL', name: 'Caldas' },
  { code: 'CAQ', name: 'Caquetá' },
  { code: 'CAS', name: 'Casanare' },
  { code: 'CAU', name: 'Cauca' },
  { code: 'CES', name: 'Cesar' },
  { code: 'CHO', name: 'Chocó' },
  { code: 'COR', name: 'Córdoba' },
  { code: 'CUN', name: 'Cundinamarca' },
  { code: 'DC', name: 'Bogotá D.C.' },
  { code: 'GUA', name: 'Guainía' },
  { code: 'GUV', name: 'Guaviare' },
  { code: 'HUI', name: 'Huila' },
  { code: 'LAG', name: 'La Guajira' },
  { code: 'MAG', name: 'Magdalena' },
  { code: 'MET', name: 'Meta' },
  { code: 'NAR', name: 'Nariño' },
  { code: 'NSA', name: 'Norte de Santander' },
  { code: 'PUT', name: 'Putumayo' },
  { code: 'QUI', name: 'Quindío' },
  { code: 'RIS', name: 'Risaralda' },
  { code: 'SAP', name: 'San Andrés y Providencia' },
  { code: 'SAN', name: 'Santander' },
  { code: 'SUC', name: 'Sucre' },
  { code: 'TOL', name: 'Tolima' },
  { code: 'VAC', name: 'Valle del Cauca' },
  { code: 'VAU', name: 'Vaupés' },
  { code: 'VID', name: 'Vichada' },
];

export const COUNTRY_OPTIONS: CountryOption[] = [
  {
    isoCode: 'CO',
    name: 'Colombia',
    phonecode: '57',
    regionLabel: 'Departamento',
    cityLabel: 'Municipio / Ciudad',
    regionOptions: COLOMBIA_REGIONS,
  },
  { isoCode: 'US', name: 'Estados Unidos', phonecode: '1', regionLabel: 'Estado', cityLabel: 'Ciudad' },
  { isoCode: 'MX', name: 'México', phonecode: '52' },
  { isoCode: 'PA', name: 'Panamá', phonecode: '507' },
  { isoCode: 'EC', name: 'Ecuador', phonecode: '593' },
  { isoCode: 'PE', name: 'Perú', phonecode: '51' },
  { isoCode: 'CL', name: 'Chile', phonecode: '56' },
  { isoCode: 'AR', name: 'Argentina', phonecode: '54' },
  { isoCode: 'BR', name: 'Brasil', phonecode: '55' },
  { isoCode: 'ES', name: 'España', phonecode: '34' },
  { isoCode: 'IT', name: 'Italia', phonecode: '39' },
  { isoCode: 'FR', name: 'Francia', phonecode: '33' },
  { isoCode: 'DE', name: 'Alemania', phonecode: '49' },
  { isoCode: 'GB', name: 'Reino Unido', phonecode: '44' },
  { isoCode: 'CA', name: 'Canadá', phonecode: '1' },
  { isoCode: 'DO', name: 'República Dominicana', phonecode: '1' },
  { isoCode: 'CR', name: 'Costa Rica', phonecode: '506' },
  { isoCode: 'SV', name: 'El Salvador', phonecode: '503' },
  { isoCode: 'GT', name: 'Guatemala', phonecode: '502' },
  { isoCode: 'HN', name: 'Honduras', phonecode: '504' },
];

export const DEFAULT_COUNTRY =
  COUNTRY_OPTIONS.find((country) => country.isoCode === 'CO') ??
  COUNTRY_OPTIONS[0] ?? {
    isoCode: 'CO',
    name: 'Colombia',
    phonecode: '57',
  };

const PHONE_CODES_DESC = [...new Set(COUNTRY_OPTIONS.map((country) => country.phonecode))]
  .filter(Boolean)
  .sort((a, b) => b.length - a.length);

export function getCountryByCode(countryCode: string) {
  return COUNTRY_OPTIONS.find((country) => country.isoCode === countryCode) ?? DEFAULT_COUNTRY;
}

export function getRegionOptions(countryCode: string): RegionOption[] {
  return getCountryByCode(countryCode).regionOptions ?? [];
}

export function getRegionLabel(countryCode: string) {
  return getCountryByCode(countryCode).regionLabel ?? 'Región / Estado / Provincia';
}

export function getCityLabel(countryCode: string) {
  return getCountryByCode(countryCode).cityLabel ?? 'Ciudad';
}

export function buildFullPhone(phoneCode: string, phoneNumber: string) {
  const normalizedCode = phoneCode.replace(/\D/g, '');
  const normalizedNumber = phoneNumber.trim().replace(/\s+/g, ' ');

  if (!normalizedCode && !normalizedNumber) return '';
  if (!normalizedCode) return normalizedNumber;
  if (!normalizedNumber) return `+${normalizedCode}`;

  return `+${normalizedCode} ${normalizedNumber}`;
}

export function extractPhoneParts(
  rawPhone: string | null | undefined,
  fallbackPhoneCode = DEFAULT_COUNTRY.phonecode,
) {
  const source = (rawPhone ?? '').trim();
  if (!source) {
    return {
      phoneCode: fallbackPhoneCode,
      phoneNumber: '',
    };
  }

  const digitsOnly = source.replace(/\D/g, '');

  for (const phoneCode of PHONE_CODES_DESC) {
    if (digitsOnly.startsWith(phoneCode)) {
      const localDigits = digitsOnly.slice(phoneCode.length).trim();
      return {
        phoneCode,
        phoneNumber:
          localDigits || source.replace(new RegExp(`^\\+?${phoneCode}\\s*`), '').trim(),
      };
    }
  }

  return {
    phoneCode: fallbackPhoneCode,
    phoneNumber: source.replace(/^\+\d+\s*/, '').trim() || source,
  };
}
