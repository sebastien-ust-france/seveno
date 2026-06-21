import type { StudyQuestionOption, StudyAcquisitionSourceCode } from '@/types/study';

export const studyAcquisitionSourceOptions: StudyQuestionOption[] = [
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'google', label: 'Google' },
  { value: 'ust_workflow', label: 'UST-Workflow' },
  { value: 'recommendation', label: 'Recommandation' },
  { value: 'direct', label: 'Direct' },
  { value: 'other', label: 'Autre' },
];

const SOURCE_LABEL_BY_CODE: Record<StudyAcquisitionSourceCode, string> = {
  linkedin: 'LinkedIn',
  facebook: 'Facebook',
  google: 'Google',
  ust_workflow: 'UST-Workflow',
  recommendation: 'Recommandation',
  direct: 'Direct',
  other: 'Autre',
};

const SOURCE_ALIASES: Record<string, StudyAcquisitionSourceCode> = {
  linkedin: 'linkedin',
  linkdin: 'linkedin',
  facebook: 'facebook',
  fb: 'facebook',
  google: 'google',
  direct: 'direct',
  recommendation: 'recommendation',
  reco: 'recommendation',
  ustworkflow: 'ust_workflow',
  ust_workflow: 'ust_workflow',
  ustworkflowplatform: 'ust_workflow',
  ustworkflowfr: 'ust_workflow',
  other: 'other',
};

function normalizeSourceToken(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export function normalizeAcquisitionSourceCode(value: unknown): StudyAcquisitionSourceCode | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = normalizeSourceToken(value);
  if (!normalized) {
    return undefined;
  }

  return SOURCE_ALIASES[normalized] ?? 'other';
}

export function getAcquisitionSourceLabel(value?: string | null): string {
  if (typeof value !== 'string') {
    return '';
  }

  const normalized = normalizeAcquisitionSourceCode(value);
  if (!normalized) {
    return value;
  }

  return SOURCE_LABEL_BY_CODE[normalized] ?? value;
}

function normalizeTrackedText(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function detectAcquisitionTracking(search: string | URLSearchParams): {
  source?: StudyAcquisitionSourceCode;
  utmSource?: StudyAcquisitionSourceCode;
  utmMedium?: string;
  utmCampaign?: string;
  hasUtmSource: boolean;
} {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search;
  const rawUtmSource = params.get('utm_source') ?? '';
  const rawUtmMedium = params.get('utm_medium') ?? '';
  const rawUtmCampaign = params.get('utm_campaign') ?? '';

  const utmSource = normalizeAcquisitionSourceCode(rawUtmSource);
  const utmMedium = normalizeTrackedText(rawUtmMedium);
  const utmCampaign = normalizeTrackedText(rawUtmCampaign);

  return {
    source: utmSource,
    utmSource,
    utmMedium: utmMedium || undefined,
    utmCampaign: utmCampaign || undefined,
    hasUtmSource: rawUtmSource.trim().length > 0,
  };
}

