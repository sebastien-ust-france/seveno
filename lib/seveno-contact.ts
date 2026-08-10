export const CONTACT_MIN_RENDER_DELAY_MS = 5_000;
export const CONTACT_MAX_SUBJECT_LENGTH = 160;
export const CONTACT_MAX_MESSAGE_LENGTH = 3_000;
export const CONTACT_MAX_NAME_LENGTH = 100;
export const CONTACT_MAX_EMAIL_LENGTH = 254;
export const CONTACT_MAX_ORGANIZATION_LENGTH = 150;

export const CONTACT_REASON_OPTIONS = [
  {
    value: 'assistance-candidat',
    label: 'Assistance candidat',
    subject: 'Seven’O — Assistance candidat',
  },
  {
    value: 'acces-entreprise',
    label: 'Demande d’accès entreprise',
    subject: 'Seven’O — Demande d’accès entreprise',
  },
  {
    value: 'recommandation',
    label: 'Recommandation professionnelle',
    subject: 'Seven’O — Recommandation professionnelle',
  },
  {
    value: 'etude',
    label: 'Étude ou Observatoire',
    subject: 'Seven’O — Étude ou Observatoire',
  },
  {
    value: 'donnees-personnelles',
    label: 'Données personnelles et suppression',
    subject: 'Seven’O — Données personnelles et suppression',
  },
  {
    value: 'signalement',
    label: 'Signaler un problème ou un comportement',
    subject: 'Seven’O — Signalement',
  },
  {
    value: 'autre',
    label: 'Autre demande',
    subject: 'Seven’O — Autre demande',
  },
] as const;

export type ContactReasonCode = (typeof CONTACT_REASON_OPTIONS)[number]['value'];

export type ContactDraft = {
  name: string;
  email: string;
  organization: string;
  reason: string;
  subject: string;
  message: string;
  website: string;
  renderedAtMs: number | null;
};

export type ContactFieldName = 'name' | 'email' | 'organization' | 'reason' | 'subject' | 'message' | 'general';

export type ContactFieldErrors = Partial<Record<ContactFieldName, string>>;

export type ContactSubmission = {
  name: string;
  email: string;
  organization: string;
  reason: ContactReasonCode;
  subject: string;
  message: string;
  renderedAtMs: number;
};

export const CONTACT_GENERAL_VALIDATION_MESSAGE = 'Certains champs doivent être corrigés avant l’envoi.';
export const CONTACT_RATE_LIMIT_MESSAGE = 'Trop de demandes ont été envoyées récemment. Patientez avant de réessayer.';
export const CONTACT_SERVICE_UNAVAILABLE_MESSAGE =
  'Votre demande n’a pas pu être envoyée. Vous pouvez écrire directement à sebastien@seveno.eu.';

export function getContactReasonOption(reason: ContactReasonCode) {
  return CONTACT_REASON_OPTIONS.find((item) => item.value === reason) ?? null;
}

export function getContactReasonLabel(reason: ContactReasonCode) {
  return getContactReasonOption(reason)?.label ?? '';
}

export function getContactReasonSubject(reason: ContactReasonCode) {
  return getContactReasonOption(reason)?.subject ?? `Seven’O — ${getContactReasonLabel(reason)}`;
}

export function resolveContactReasonCode(value: unknown): ContactReasonCode | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return CONTACT_REASON_OPTIONS.some((item) => item.value === normalized) ? (normalized as ContactReasonCode) : null;
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function containsLineBreak(value: string) {
  return /[\r\n]/.test(value);
}

function parseRenderedAt(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) {
      return Math.trunc(parsed);
    }
  }

  return null;
}

export function parseContactDraft(input: unknown): ContactDraft {
  const record = Boolean(input) && typeof input === 'object' && !Array.isArray(input) ? (input as Record<string, unknown>) : {};

  return {
    name: normalizeText(record.name),
    email: normalizeText(record.email),
    organization: normalizeText(record.organization),
    reason: normalizeText(record.reason),
    subject: normalizeText(record.subject),
    message: normalizeText(record.message),
    website: normalizeText(record.website),
    renderedAtMs: parseRenderedAt(record.renderedAtMs ?? record.renderedAt),
  };
}

export function validateContactDraft(draft: ContactDraft) {
  const errors: ContactFieldErrors = {};

  if (draft.name.length < 2) {
    errors.name = 'Le nom doit contenir au moins 2 caractères.';
  } else if (draft.name.length > CONTACT_MAX_NAME_LENGTH) {
    errors.name = 'Le nom ne peut pas dépasser 100 caractères.';
  } else if (containsLineBreak(draft.name)) {
    errors.name = 'Les retours à la ligne ne sont pas autorisés dans ce champ.';
  }

  if (!draft.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email)) {
    errors.email = 'Adresse email invalide.';
  } else if (draft.email.length > CONTACT_MAX_EMAIL_LENGTH) {
    errors.email = 'L’adresse email ne peut pas dépasser 254 caractères.';
  } else if (containsLineBreak(draft.email)) {
    errors.email = 'Les retours à la ligne ne sont pas autorisés dans ce champ.';
  }

  const reason = resolveContactReasonCode(draft.reason);
  if (!reason) {
    errors.reason = 'Sélectionnez un motif.';
  }

  if (draft.organization.length > CONTACT_MAX_ORGANIZATION_LENGTH) {
    errors.organization = 'Le champ entreprise ou organisation ne peut pas dépasser 150 caractères.';
  } else if (containsLineBreak(draft.organization)) {
    errors.organization = 'Les retours à la ligne ne sont pas autorisés dans ce champ.';
  }

  if (reason === 'acces-entreprise' && !draft.organization) {
    errors.organization = 'Ce champ est obligatoire pour une demande d’accès entreprise.';
  }

  if (!draft.subject || draft.subject.length < 5) {
    errors.subject = 'L’objet doit contenir au moins 5 caractères.';
  } else if (draft.subject.length > CONTACT_MAX_SUBJECT_LENGTH) {
    errors.subject = 'L’objet ne peut pas dépasser 160 caractères.';
  } else if (containsLineBreak(draft.subject)) {
    errors.subject = 'Les retours à la ligne ne sont pas autorisés dans ce champ.';
  }

  if (!draft.message || draft.message.length < 20) {
    errors.message = 'Le message doit contenir au moins 20 caractères.';
  } else if (draft.message.length > CONTACT_MAX_MESSAGE_LENGTH) {
    errors.message = 'Le message ne peut pas dépasser 3 000 caractères.';
  }

  return errors;
}

export function normalizeContactSubmission(input: unknown): ContactSubmission {
  const draft = parseContactDraft(input);
  const fieldErrors = validateContactDraft(draft);

  if (Object.keys(fieldErrors).length > 0) {
    const error = new Error(CONTACT_GENERAL_VALIDATION_MESSAGE) as Error & {
      code: string;
      status: number;
      fieldErrors: ContactFieldErrors;
    };
    error.code = 'validation_failed';
    error.status = 400;
    error.fieldErrors = fieldErrors;
    throw error;
  }

  const reason = resolveContactReasonCode(draft.reason);
  if (!reason) {
    const error = new Error(CONTACT_GENERAL_VALIDATION_MESSAGE) as Error & {
      code: string;
      status: number;
      fieldErrors: ContactFieldErrors;
    };
    error.code = 'validation_failed';
    error.status = 400;
    error.fieldErrors = { reason: 'Sélectionnez un motif.' };
    throw error;
  }

  if (!Number.isFinite(draft.renderedAtMs ?? NaN)) {
    const error = new Error(CONTACT_GENERAL_VALIDATION_MESSAGE) as Error & {
      code: string;
      status: number;
      fieldErrors: ContactFieldErrors;
    };
    error.code = 'validation_failed';
    error.status = 400;
    error.fieldErrors = {
      general: 'La date de préparation du formulaire est manquante.',
    };
    throw error;
  }

  return {
    name: draft.name,
    email: draft.email,
    organization: draft.organization,
    reason,
    subject: draft.subject,
    message: draft.message,
    renderedAtMs: draft.renderedAtMs ?? 0,
  };
}

function lineBreakText(value: string) {
  return value.replace(/\r?\n/g, '\r\n');
}

function buildSubjectLine(submission: ContactSubmission) {
  const reasonLabel = getContactReasonLabel(submission.reason);
  const reasonSubject = getContactReasonSubject(submission.reason);
  const baseSubject = submission.subject.trim() || reasonSubject;

  return baseSubject.startsWith('Seven’O') ? baseSubject : `Seven’O — ${reasonLabel || baseSubject}`;
}

export function buildContactMailtoHref(submission: ContactSubmission) {
  const bodyLines = [
    `Nom et prénom : ${submission.name}`,
    `Adresse email : ${submission.email}`,
    submission.organization ? `Entreprise ou organisation : ${submission.organization}` : null,
    `Motif : ${getContactReasonLabel(submission.reason)}`,
    `Objet : ${submission.subject}`,
    '',
    lineBreakText(submission.message),
  ].filter((item): item is string => typeof item === 'string');

  const searchParams = new URLSearchParams();
  searchParams.set('subject', buildSubjectLine(submission));
  searchParams.set('body', bodyLines.join('\n'));
  return `mailto:sebastien@seveno.eu?${searchParams.toString()}`;
}
