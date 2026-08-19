import type { SerializedJobOffer } from '@/types/seveno-job-offers';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon', published: 'Active', active: 'Active', paused: 'En pause', closed: 'Cl\u00f4tur\u00e9e',
  archived: 'Archiv\u00e9e', expired: 'Expir\u00e9e', candidate_limit_reached: 'Limite atteinte',
};
const WORK_MODE_LABELS: Record<string, string> = { onsite: 'Sur site', hybrid: 'Hybride', remote: 'T\u00e9l\u00e9travail' };
const CONTRACT_LABELS: Record<string, string> = {
  permanent: 'CDI', fixed_term: 'CDD', temporary: 'Int\u00e9rim', freelance: 'Freelance',
  apprenticeship: 'Alternance', internship: 'Stage', other: 'Autre contrat',
};

export function campaignTitle(offer?: Pick<SerializedJobOffer, 'title' | 'jobRoleLabel'> | null) {
  return offer?.title.trim() || offer?.jobRoleLabel.trim() || 'Campagne de recrutement';
}

export function campaignStatusLabel(status: string) {
  return STATUS_LABELS[status] ?? 'Statut indisponible';
}

export function campaignDateLabel(status: string, endsAt: string) {
  const date = new Date(endsAt);
  const formatted = Number.isNaN(date.getTime()) ? 'date indisponible' : new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
  if (status === 'paused') return `Campagne en pause \u00b7 fin pr\u00e9vue le ${formatted}`;
  if (status === 'closed') return `Campagne cl\u00f4tur\u00e9e le ${formatted}`;
  if (status === 'archived') return `Campagne archiv\u00e9e \u00b7 fin pr\u00e9vue le ${formatted}`;
  if (status === 'active' || status === 'published' || status === 'candidate_limit_reached') return `Campagne active jusqu\u2019au ${formatted}`;
  return `${campaignStatusLabel(status)} \u00b7 fin pr\u00e9vue le ${formatted}`;
}

export function campaignContext(offer?: Pick<SerializedJobOffer, 'location' | 'workMode' | 'contractType'> | null) {
  if (!offer) return '';
  return [offer.location.trim(), WORK_MODE_LABELS[offer.workMode], CONTRACT_LABELS[offer.contractType]].filter(Boolean).join(' \u00b7 ');
}
