import type { CandidatePrivateIdentityInput, SevenoUser } from '@/types/seveno';

export type CandidateIdentityFormValues = {
  firstName: string;
  lastName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  postalCode: string;
  city: string;
  country: string;
};

export type CandidateIdentityFieldErrors = Partial<Record<keyof CandidateIdentityFormValues, string>>;

export const CANDIDATE_IDENTITY_LIMITS = {
  firstName: 80,
  lastName: 80,
  phone: 16,
  addressLine1: 160,
  addressLine2: 160,
  postalCode: 12,
  city: 100,
  country: 80,
} as const;

const BELGIUM_COUNTRY_VALUES = new Set(['belgique', 'belgium', 'be', 'bel']);

function normalizeSpaces(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function normalizeCountry(value: string) {
  const normalized = normalizeSpaces(value) || 'France';
  return BELGIUM_COUNTRY_VALUES.has(normalized.toLocaleLowerCase('fr-FR')) ? 'Belgique' : normalized;
}

function isBelgiumCountry(value: string) {
  return BELGIUM_COUNTRY_VALUES.has(normalizeCountry(value).toLocaleLowerCase('fr-FR'));
}

function normalizePhone(value: string, country: string) {
  let compact = value.trim().replace(/[\s().-]+/g, '');
  if (compact.startsWith('00')) compact = `+${compact.slice(2)}`;
  if (country.toLocaleLowerCase('fr-FR') === 'france' && /^0[1-9]\d{8}$/.test(compact)) {
    compact = `+33${compact.slice(1)}`;
  } else if (isBelgiumCountry(country) && /^0[1-9]\d{7,8}$/.test(compact)) {
    compact = `+32${compact.slice(1)}`;
  }
  return compact;
}

export function splitGoogleDisplayName(displayName: string | null | undefined) {
  const parts = normalizeSpaces(displayName ?? '').split(' ').filter(Boolean);
  return {
    firstName: parts[0] ?? '',
    lastName: parts.slice(1).join(' '),
  };
}

export function isCandidateIdentityComplete(user: Pick<SevenoUser, 'firstName' | 'lastName' | 'email' | 'phone'>) {
  return Boolean(user.firstName?.trim() && user.lastName?.trim() && user.email.trim() && user.phone?.trim());
}

export function validateCandidateIdentity(values: CandidateIdentityFormValues): {
  data: CandidatePrivateIdentityInput | null;
  errors: CandidateIdentityFieldErrors;
} {
  const firstName = normalizeSpaces(values.firstName);
  const lastName = normalizeSpaces(values.lastName);
  const country = normalizeCountry(values.country);
  const phone = normalizePhone(values.phone, country);
  const addressLine1 = normalizeSpaces(values.addressLine1);
  const addressLine2 = normalizeSpaces(values.addressLine2);
  const postalCode = values.postalCode.trim().replace(/\s+/g, '').toUpperCase();
  const city = normalizeSpaces(values.city);
  const errors: CandidateIdentityFieldErrors = {};

  if (!firstName) errors.firstName = 'Indiquez votre prénom.';
  else if (firstName.length > CANDIDATE_IDENTITY_LIMITS.firstName) errors.firstName = 'Le prénom est trop long.';

  if (!lastName) errors.lastName = 'Indiquez votre nom.';
  else if (lastName.length > CANDIDATE_IDENTITY_LIMITS.lastName) errors.lastName = 'Le nom est trop long.';

  if (!phone) errors.phone = 'Indiquez votre numéro de téléphone.';
  else if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
    errors.phone = 'Le numéro de téléphone n’est pas valide pour le pays sélectionné.';
  }

  if (addressLine1.length > CANDIDATE_IDENTITY_LIMITS.addressLine1) errors.addressLine1 = 'L’adresse est trop longue.';
  if (addressLine2.length > CANDIDATE_IDENTITY_LIMITS.addressLine2) errors.addressLine2 = 'Le complément est trop long.';
  if (city.length > CANDIDATE_IDENTITY_LIMITS.city) errors.city = 'La ville est trop longue.';
  if (country.length > CANDIDATE_IDENTITY_LIMITS.country) errors.country = 'Le pays est trop long.';
  if (postalCode.length > CANDIDATE_IDENTITY_LIMITS.postalCode) errors.postalCode = 'Le code postal est trop long.';
  if (postalCode && country.toLocaleLowerCase('fr-FR') === 'france' && !/^\d{5}$/.test(postalCode)) {
    errors.postalCode = 'Le code postal français doit contenir 5 chiffres.';
  }

  if (Object.keys(errors).length > 0) return { data: null, errors };

  return {
    data: {
      firstName,
      lastName,
      phone,
      ...(addressLine1 ? { addressLine1 } : {}),
      ...(addressLine2 ? { addressLine2 } : {}),
      ...(postalCode ? { postalCode } : {}),
      ...(city ? { city } : {}),
      country,
    },
    errors,
  };
}
