export interface GeographicLocation {
  countryCode: string;
  countryName: string;
  administrativeAreaCode: string;
  administrativeAreaName: string;
  city: string;
  cityName: string;
}
export interface GeographicOption {
  code: string;
  name: string;
}

export const EMPTY_GEOGRAPHIC_LOCATION: GeographicLocation = {
  countryCode: '',
  countryName: '',
  administrativeAreaCode: '',
  administrativeAreaName: '',
  city: '',
  cityName: '',
};

// Seven'O supports sovereign European countries represented by the bundled
// Country State City database. Dependent territories are intentionally excluded.
export const SUPPORTED_EUROPEAN_COUNTRY_CODES = [
  'AL', 'AD', 'AT', 'BY', 'BE', 'BA', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE',
  'FI', 'FR', 'DE', 'GR', 'HU', 'IS', 'IE', 'IT', 'XK', 'LV', 'LI', 'LT',
  'LU', 'MT', 'MD', 'MC', 'ME', 'NL', 'MK', 'NO', 'PL', 'PT', 'RO', 'RU',
  'SM', 'RS', 'SK', 'SI', 'ES', 'SE', 'CH', 'UA', 'GB', 'VA',
] as const;

const SUPPORTED_COUNTRY_CODE_SET = new Set<string>(SUPPORTED_EUROPEAN_COUNTRY_CODES);

export function isSupportedEuropeanCountryCode(value: string) {
  return SUPPORTED_COUNTRY_CODE_SET.has(value.trim().toUpperCase());
}

export function formatGeographicLocation(
  value: Partial<GeographicLocation> | null | undefined,
  legacyLabel = '',
) {
  const labels = [value?.countryName, value?.administrativeAreaName, value?.cityName]
    .map((label) => label?.trim() ?? '')
    .filter(Boolean);

  return labels.length > 0 ? labels.join(' > ') : legacyLabel.trim();
}

export function hasStructuredGeographicLocation(value: Partial<GeographicLocation> | null | undefined) {
  return Boolean(value?.countryCode?.trim());
}

export function selectGeographicCountry(countryCode: string, countryName: string): GeographicLocation {
  return {
    countryCode,
    countryName,
    administrativeAreaCode: '',
    administrativeAreaName: '',
    city: '',
    cityName: '',
  };
}

export function selectGeographicAdministrativeArea(
  value: GeographicLocation,
  administrativeAreaCode: string,
  administrativeAreaName: string,
): GeographicLocation {
  return {
    ...value,
    administrativeAreaCode,
    administrativeAreaName,
    city: '',
    cityName: '',
  };
}

export function matchesGeographicHierarchy(
  value: Partial<GeographicLocation>,
  filters: Pick<Partial<GeographicLocation>, 'countryCode' | 'administrativeAreaCode' | 'city'>,
) {
  if (filters.countryCode && value.countryCode !== filters.countryCode) return false;
  if (filters.administrativeAreaCode && value.administrativeAreaCode !== filters.administrativeAreaCode) return false;
  if (filters.city && value.city !== filters.city) return false;
  return true;
}
