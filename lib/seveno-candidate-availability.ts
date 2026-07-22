import type { CandidateProfile, FirestoreDateValue } from '@/types/seveno';

export const DAILY_AVAILABILITY_VALIDITY_HOURS = 24;
export const DEFAULT_AVAILABILITY_TIMEZONE = 'Europe/Paris';
export const DEFAULT_AVAILABILITY_REMINDER_HOUR = 8;
export const AVAILABILITY_CONFIRMATION_SCHEMA_VERSION = 1;

export type CandidateAvailabilityDisplayState =
  | 'available_now'
  | 'confirmation_required'
  | 'available_from_date'
  | 'not_available';

export interface CandidateAvailabilityView {
  state: CandidateAvailabilityDisplayState;
  label: string;
  detail: string;
  isProfileVisibleToCompanies: boolean;
  isImmediateAvailabilityConfirmed: boolean;
  isDeclaredImmediate: boolean;
  isConfirmedNow: boolean;
  isConfirmationExpired: boolean;
  confirmedAt: Date | null;
  validUntil: Date | null;
  availableFromAt: Date | null;
  timezone: string;
  nextReminderAt: Date | null;
}

type DateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function isTimestampLike(value: unknown): value is { toDate: () => Date } {
  return value !== null
    && typeof value === 'object'
    && 'toDate' in value
    && typeof (value as { toDate?: unknown }).toDate === 'function';
}

export function toAvailabilityDate(value: FirestoreDateValue | Date | string | number | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : new Date(parsed);
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? new Date(value) : null;
  }

  if (isTimestampLike(value)) {
    const date = value.toDate();
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

function formatDateInTimeZone(date: Date, timeZone: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone,
    ...options,
  }).format(date);
}

function getZonedDateParts(date: Date, timeZone: string): DateParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const partsByType = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  ) as Partial<Record<keyof DateParts, number>>;

  return {
    year: partsByType.year ?? date.getUTCFullYear(),
    month: partsByType.month ?? (date.getUTCMonth() + 1),
    day: partsByType.day ?? date.getUTCDate(),
    hour: partsByType.hour ?? date.getUTCHours(),
    minute: partsByType.minute ?? date.getUTCMinutes(),
    second: partsByType.second ?? date.getUTCSeconds(),
  };
}

function getTimeZoneOffsetMinutes(date: Date, timeZone: string) {
  const parts = getZonedDateParts(date, timeZone);
  const zonedAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return Math.round((zonedAsUtc - date.getTime()) / 60000);
}

function toUtcDateFromZonedParts(parts: Pick<DateParts, 'year' | 'month' | 'day'> & Partial<Pick<DateParts, 'hour' | 'minute' | 'second'>>, timeZone: string) {
  const base = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour ?? 0,
    parts.minute ?? 0,
    parts.second ?? 0,
  );
  let utcMillis = base;

  for (let index = 0; index < 3; index += 1) {
    const offsetMinutes = getTimeZoneOffsetMinutes(new Date(utcMillis), timeZone);
    const adjusted = base - offsetMinutes * 60_000;
    if (adjusted === utcMillis) {
      break;
    }
    utcMillis = adjusted;
  }

  return new Date(utcMillis);
}

function formatReminderDate(date: Date, timeZone: string) {
  return formatDateInTimeZone(date, timeZone, {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function normalizeAvailabilityTimezone(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : DEFAULT_AVAILABILITY_TIMEZONE;
}

/**
 * Base visibility signal for a candidate profile.
 * Combine this with profile completeness before presenting a company-facing "visible" state.
 */
export function isProfileVisibleToCompanies(profile: Pick<CandidateProfile, 'profileStatus'>) {
  return profile.profileStatus === 'active';
}

export function isImmediateAvailabilityConfirmed(
  profile: {
    availability: CandidateProfile['availability'];
    availabilityValidUntil?: Parameters<typeof toAvailabilityDate>[0];
  },
  reference: Date = new Date(),
) {
  const validUntil = toAvailabilityDate(profile.availabilityValidUntil);
  return profile.availability === 'immediate'
    && Boolean(validUntil)
    && validUntil!.getTime() > reference.getTime();
}

export function buildAvailabilityReminderPeriodKey(reference: Date, timeZone: string) {
  const parts = getZonedDateParts(reference, timeZone);
  const year = String(parts.year).padStart(4, '0');
  const month = String(parts.month).padStart(2, '0');
  const day = String(parts.day).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function buildNextAvailabilityReminderAt(reference: Date, timeZone: string) {
  const parts = getZonedDateParts(reference, timeZone);
  const reminderToday = toUtcDateFromZonedParts({
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: DEFAULT_AVAILABILITY_REMINDER_HOUR,
    minute: 0,
    second: 0,
  }, timeZone);

  if (reminderToday.getTime() > reference.getTime()) {
    return reminderToday;
  }

  return toUtcDateFromZonedParts({
    year: parts.year,
    month: parts.month,
    day: parts.day + 1,
    hour: DEFAULT_AVAILABILITY_REMINDER_HOUR,
    minute: 0,
    second: 0,
  }, timeZone);
}

export function getCandidateAvailabilityView(
  profile: Pick<
    CandidateProfile,
    | 'availability'
    | 'availabilityConfirmedAt'
    | 'availabilityValidUntil'
    | 'availabilityAvailableFromAt'
    | 'availabilityTimezone'
    | 'profileStatus'
    | 'dailyAvailabilityConfirmationEnabled'
    | 'hasActiveAvailabilityPushSubscription'
    | 'nextAvailabilityReminderAt'
  >,
  reference: Date = new Date(),
): CandidateAvailabilityView {
  const timezone = normalizeAvailabilityTimezone(profile.availabilityTimezone);
  const confirmedAt = toAvailabilityDate(profile.availabilityConfirmedAt);
  const validUntil = toAvailabilityDate(profile.availabilityValidUntil);
  const availableFromAt = toAvailabilityDate(profile.availabilityAvailableFromAt);
  const nextReminderAt = toAvailabilityDate(profile.nextAvailabilityReminderAt);
  const isDeclaredImmediate = profile.availability === 'immediate';
  const isConfirmedNow = isImmediateAvailabilityConfirmed(profile, reference);
  const isConfirmationExpired = isDeclaredImmediate && !isConfirmedNow;
  const isProfileVisible = isProfileVisibleToCompanies({ profileStatus: profile.profileStatus });

  if (isDeclaredImmediate && isConfirmedNow) {
    return {
      state: 'available_now',
      label: 'Disponible immédiatement · confirmé aujourd’hui',
      detail: `Confirmation valable jusqu’au ${formatReminderDate(validUntil!, timezone)}.`,
      isProfileVisibleToCompanies: isProfileVisible,
      isImmediateAvailabilityConfirmed: isConfirmedNow,
      isDeclaredImmediate,
      isConfirmedNow,
      isConfirmationExpired,
      confirmedAt,
      validUntil,
      availableFromAt: null,
      timezone,
      nextReminderAt,
    };
  }

  if (isDeclaredImmediate && isConfirmationExpired) {
    return {
      state: 'confirmation_required',
      label: 'Disponibilité à confirmer',
      detail: 'La mention "Disponible immédiatement" n’est plus confirmée. Vous pouvez la réactiver à tout moment.',
      isProfileVisibleToCompanies: isProfileVisible,
      isImmediateAvailabilityConfirmed: isConfirmedNow,
      isDeclaredImmediate,
      isConfirmedNow,
      isConfirmationExpired,
      confirmedAt,
      validUntil,
      availableFromAt: null,
      timezone,
      nextReminderAt,
    };
  }

  if (availableFromAt) {
    return {
      state: 'available_from_date',
      label: `Disponible à partir du ${formatDateInTimeZone(availableFromAt, timezone, {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })}`,
      detail: 'Le profil reste visible avec cette disponibilité future.',
      isProfileVisibleToCompanies: isProfileVisible,
      isImmediateAvailabilityConfirmed: isConfirmedNow,
      isDeclaredImmediate,
      isConfirmedNow,
      isConfirmationExpired,
      confirmedAt,
      validUntil,
      availableFromAt,
      timezone,
      nextReminderAt,
    };
  }

  return {
    state: 'not_available',
    label: profile.availability === 'not_available'
      ? 'Non disponible'
      : 'Disponibilité à confirmer',
    detail: profile.availability === 'not_available'
      ? 'Votre disponibilité immédiate est désactivée.'
      : 'Votre disponibilité immédiate doit être confirmée.',
    isProfileVisibleToCompanies: isProfileVisible,
    isImmediateAvailabilityConfirmed: isConfirmedNow,
    isDeclaredImmediate,
    isConfirmedNow,
    isConfirmationExpired,
    confirmedAt,
    validUntil,
    availableFromAt: null,
    timezone,
    nextReminderAt,
  };
}

export function isCandidateCurrentlyImmediatelyAvailable(
  profile: {
    profileStatus: CandidateProfile['profileStatus'];
    availability: CandidateProfile['availability'];
    availabilityValidUntil?: Parameters<typeof toAvailabilityDate>[0];
  },
  reference: Date = new Date(),
) {
  return isProfileVisibleToCompanies(profile) && isImmediateAvailabilityConfirmed(profile, reference);
}

export function isCandidateAvailabilityReminderDue(
  profile: Pick<
    CandidateProfile,
    'profileStatus' | 'availability' | 'dailyAvailabilityConfirmationEnabled' | 'nextAvailabilityReminderAt'
  >,
  reference: Date = new Date(),
) {
  const reminderAt = toAvailabilityDate(profile.nextAvailabilityReminderAt);
  return profile.profileStatus === 'active'
    && profile.availability === 'immediate'
    && profile.dailyAvailabilityConfirmationEnabled === true
    && Boolean(reminderAt)
    && reminderAt!.getTime() <= reference.getTime();
}
