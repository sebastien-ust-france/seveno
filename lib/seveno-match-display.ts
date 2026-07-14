import type { MatchRequestContractType, MatchRequestStatus } from '@/types/seveno';

export const MATCH_REQUEST_STATUS_LABELS: Record<MatchRequestStatus, string> = {
  pending_candidate: 'En attente du candidat',
  accepted: 'Acceptee',
  refused: 'Refusee',
  cancelled: 'Annulee',
  expired: 'Expiree',
};

export const MATCH_REQUEST_CONTRACT_TYPE_LABELS: Record<MatchRequestContractType, string> = {
  permanent: 'CDI',
  fixed_term: 'CDD',
  temporary: 'Interim',
  freelance: 'Freelance',
  apprenticeship: 'Alternance',
  internship: 'Stage',
  other: 'Autre',
};

export function formatMatchRequestDate(value: string | null | undefined) {
  if (!value) {
    return 'Non disponible';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Non disponible';
  }

  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatMatchRequestStatus(value: MatchRequestStatus | null | undefined) {
  if (!value) {
    return 'Non renseignee';
  }

  return MATCH_REQUEST_STATUS_LABELS[value] ?? value;
}

export function formatMatchRequestContractType(value: MatchRequestContractType | null | undefined) {
  if (!value) {
    return 'Non renseigne';
  }

  return MATCH_REQUEST_CONTRACT_TYPE_LABELS[value] ?? value;
}
