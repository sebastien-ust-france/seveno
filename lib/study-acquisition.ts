import type { StudyAcquisitionChannelCode, StudyQuestionOption } from '@/types/study';

export const studyAcquisitionChannelOptions: StudyQuestionOption[] = [
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'message_prive', label: 'Message privé' },
  { value: 'bouche_a_oreille', label: 'Bouche-à-oreille' },
  { value: 'google', label: 'Recherche Google' },
  { value: 'ust_workflow', label: 'Site UST-Workflow' },
  { value: 'autre', label: 'Autre' },
];

export const studyAcquisitionSourceOptions = studyAcquisitionChannelOptions;

const ACQUISITION_CHANNEL_LABEL_BY_CODE: Record<StudyAcquisitionChannelCode, string> = {
  linkedin: 'LinkedIn',
  facebook: 'Facebook',
  instagram: 'Instagram',
  message_prive: 'Message privé',
  bouche_a_oreille: 'Bouche-à-oreille',
  google: 'Recherche Google',
  ust_workflow: 'Site UST-Workflow',
  autre: 'Autre',
  recommendation: 'Bouche-à-oreille',
  direct: 'Autre',
};

const ACQUISITION_CHANNEL_ALIASES: Record<string, StudyAcquisitionChannelCode> = {
  linkedin: 'linkedin',
  linkdin: 'linkedin',
  facebook: 'facebook',
  fb: 'facebook',
  instagram: 'instagram',
  insta: 'instagram',
  ig: 'instagram',
  messageprive: 'message_prive',
  messageprivate: 'message_prive',
  dm: 'message_prive',
  boucheaoreille: 'bouche_a_oreille',
  boucheaoreil: 'bouche_a_oreille',
  bouchealoreille: 'bouche_a_oreille',
  recommandation: 'bouche_a_oreille',
  recommendation: 'bouche_a_oreille',
  google: 'google',
  recherchegoogle: 'google',
  ustworkflow: 'ust_workflow',
  siteustworkflow: 'ust_workflow',
  ustworkflowfr: 'ust_workflow',
  ustworkflowplatform: 'ust_workflow',
  autre: 'autre',
  other: 'autre',
  direct: 'autre',
};

function normalizeSourceToken(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

export function normalizeAcquisitionChannelCode(value: unknown): StudyAcquisitionChannelCode | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = normalizeSourceToken(value);
  if (!normalized) {
    return undefined;
  }

  return ACQUISITION_CHANNEL_ALIASES[normalized] ?? undefined;
}

export function normalizeAcquisitionSourceCode(value: unknown): StudyAcquisitionChannelCode | undefined {
  return normalizeAcquisitionChannelCode(value);
}

export function getAcquisitionChannelLabel(value?: string | null): string {
  if (typeof value !== 'string') {
    return '';
  }

  const normalized = normalizeAcquisitionChannelCode(value);
  if (!normalized) {
    return value;
  }

  return ACQUISITION_CHANNEL_LABEL_BY_CODE[normalized] ?? value;
}

export function getAcquisitionSourceLabel(value?: string | null): string {
  return getAcquisitionChannelLabel(value);
}

function normalizeTrackedText(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function detectAcquisitionTracking(search: string | URLSearchParams): {
  acquisitionChannel?: StudyAcquisitionChannelCode;
  acquisitionChannelLabel?: string;
  source?: StudyAcquisitionChannelCode;
  utmSource?: StudyAcquisitionChannelCode;
  utmMedium?: string;
  utmCampaign?: string;
  hasUtmSource: boolean;
} {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search;
  const rawUtmSource = params.get('utm_source') ?? '';
  const rawUtmMedium = params.get('utm_medium') ?? '';
  const rawUtmCampaign = params.get('utm_campaign') ?? '';

  const acquisitionChannel = normalizeAcquisitionChannelCode(rawUtmSource);
  const utmSource = acquisitionChannel;
  const utmMedium = normalizeTrackedText(rawUtmMedium);
  const utmCampaign = normalizeTrackedText(rawUtmCampaign);

  return {
    acquisitionChannel,
    acquisitionChannelLabel: acquisitionChannel ? getAcquisitionChannelLabel(acquisitionChannel) : undefined,
    source: acquisitionChannel,
    utmSource,
    utmMedium: utmMedium || undefined,
    utmCampaign: utmCampaign || undefined,
    hasUtmSource: rawUtmSource.trim().length > 0,
  };
}
