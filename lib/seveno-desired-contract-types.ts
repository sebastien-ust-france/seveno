import type { DesiredContractTypeCode } from '@/types/seveno';

export type DesiredContractTypeOption = {
  code: DesiredContractTypeCode;
  label: string;
};

export const DESIRED_CONTRACT_TYPE_OPTIONS: DesiredContractTypeOption[] = [
  { code: 'CDI', label: 'CDI' },
  { code: 'CDD', label: 'CDD' },
  { code: 'INTERIM', label: 'Intérim' },
  { code: 'FREELANCE', label: 'Freelance' },
  { code: 'ALTERNANCE', label: 'Alternance' },
  { code: 'STAGE', label: 'Stage' },
  { code: 'SAISONNIER', label: 'Saisonnier' },
  { code: 'AUTRE', label: 'Autre' },
];

const DESIRED_CONTRACT_TYPE_LABELS = new Map<DesiredContractTypeCode, string>(
  DESIRED_CONTRACT_TYPE_OPTIONS.map((option) => [option.code, option.label] as const),
);

export function isDesiredContractTypeCode(value: unknown): value is DesiredContractTypeCode {
  return typeof value === 'string' && DESIRED_CONTRACT_TYPE_LABELS.has(value.toUpperCase() as DesiredContractTypeCode);
}

export function normalizeDesiredContractTypeCodes(value: unknown): DesiredContractTypeCode[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized: DesiredContractTypeCode[] = [];
  const seen = new Set<DesiredContractTypeCode>();

  for (const item of value) {
    if (typeof item !== 'string') {
      continue;
    }

    const code = item.trim().toUpperCase() as DesiredContractTypeCode;
    if (!DESIRED_CONTRACT_TYPE_LABELS.has(code) || seen.has(code)) {
      continue;
    }

    seen.add(code);
    normalized.push(code);
  }

  return normalized;
}

export function formatDesiredContractTypeLabel(code: DesiredContractTypeCode) {
  return DESIRED_CONTRACT_TYPE_LABELS.get(code) ?? code;
}

export function formatDesiredContractTypeLabels(
  codes: readonly DesiredContractTypeCode[] | null | undefined,
  emptyLabel = 'Non renseignés',
) {
  const normalized = normalizeDesiredContractTypeCodes(codes);
  return normalized.length > 0
    ? normalized.map((code) => formatDesiredContractTypeLabel(code)).join(', ')
    : emptyLabel;
}
