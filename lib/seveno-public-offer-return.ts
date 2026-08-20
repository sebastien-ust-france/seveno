const PUBLIC_OFFER_RETURN_PREFIX = '/candidat/offres/public/';
const PUBLIC_OFFER_RETURN_STORAGE_KEY = 'seveno.publicOfferReturnTo';
const PUBLIC_OFFER_SLUG_PATTERN = /^[a-z0-9-]{8,120}$/;

export function normalizePublicOfferSlug(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return PUBLIC_OFFER_SLUG_PATTERN.test(normalized) ? normalized : null;
}

export function buildPublicOfferCandidateReturnTo(slug: string): string {
  const normalizedSlug = normalizePublicOfferSlug(slug);
  if (!normalizedSlug) throw new Error('Le slug public de l’offre est invalide.');
  return `${PUBLIC_OFFER_RETURN_PREFIX}${normalizedSlug}`;
}

export function normalizePublicOfferReturnTo(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = /^\/candidat\/offres\/public\/([a-z0-9-]{8,120})$/.exec(value);
  if (!match) return null;
  return buildPublicOfferCandidateReturnTo(match[1]);
}

export function buildPublicOfferLoginHref(slug: string): string {
  const returnTo = buildPublicOfferCandidateReturnTo(slug);
  return `/connexion?returnTo=${encodeURIComponent(returnTo)}`;
}

export function persistPublicOfferReturnTo(value: unknown): string | null {
  const normalized = normalizePublicOfferReturnTo(value);
  if (typeof window === 'undefined') return normalized;
  try {
    if (normalized) window.sessionStorage.setItem(PUBLIC_OFFER_RETURN_STORAGE_KEY, normalized);
    else if (typeof value === 'string') window.sessionStorage.removeItem(PUBLIC_OFFER_RETURN_STORAGE_KEY);
  } catch {
    return normalized;
  }
  return normalized;
}

export function readPublicOfferReturnTo(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return normalizePublicOfferReturnTo(window.sessionStorage.getItem(PUBLIC_OFFER_RETURN_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function consumePublicOfferReturnTo(): string | null {
  const value = readPublicOfferReturnTo();
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.removeItem(PUBLIC_OFFER_RETURN_STORAGE_KEY);
    } catch {
      return value;
    }
  }
  return value;
}
