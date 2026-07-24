import { FieldPath } from 'firebase-admin/firestore';
import type { TermsAcceptance, TermsAcceptanceContext } from '@/types/seveno';

export const SEVENO_TERMS_ACCEPTANCE_CONTEXTS = [
  'candidate_account',
  'company_first_access',
] as const satisfies readonly TermsAcceptanceContext[];

export type SevenoTermsAcceptanceDocumentData = {
  termsAcceptance?: Partial<Record<TermsAcceptanceContext, TermsAcceptance>>;
  [legacyField: string]: unknown;
};

export interface SevenoTermsAcceptanceMigrationState {
  context: TermsAcceptanceContext;
  legacyAcceptance: TermsAcceptance | null;
  nestedAcceptance: TermsAcceptance | null;
}

export interface SevenoTermsAcceptanceMigrationPlan {
  contexts: TermsAcceptanceContext[];
  nestedWrite: Partial<Record<TermsAcceptanceContext, TermsAcceptance>>;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isTermsAcceptance(value: unknown): value is TermsAcceptance {
  return Boolean(value)
    && typeof value === 'object'
    && !Array.isArray(value)
    && typeof (value as { cguVersion?: unknown }).cguVersion === 'string'
    && typeof (value as { context?: unknown }).context === 'string'
    && 'acceptedAt' in (value as object);
}

export function buildSevenoTermsAcceptancePatch(
  context: TermsAcceptanceContext,
  acceptance: TermsAcceptance,
) {
  return {
    termsAcceptance: {
      [context]: acceptance,
    },
    updatedAt: acceptance.acceptedAt,
  };
}

export function getLegacySevenoTermsAcceptanceFieldPath(context: TermsAcceptanceContext) {
  return new FieldPath(`termsAcceptance.${context}`);
}

export function readSevenoTermsAcceptanceMigrationState(
  data: SevenoTermsAcceptanceDocumentData | null | undefined,
): SevenoTermsAcceptanceMigrationState[] {
  const termsAcceptance = isPlainObject(data?.termsAcceptance) ? data.termsAcceptance : null;

  return SEVENO_TERMS_ACCEPTANCE_CONTEXTS.map((context) => {
    const legacyValue = data?.[`termsAcceptance.${context}`];
    const nestedValue = termsAcceptance?.[context];
    const legacyAcceptance = isTermsAcceptance(legacyValue) ? legacyValue : null;
    const nestedAcceptance = isTermsAcceptance(nestedValue) ? nestedValue : null;

    return {
      context,
      legacyAcceptance,
      nestedAcceptance,
    };
  });
}

export function buildSevenoTermsAcceptanceMigrationPlan(
  data: SevenoTermsAcceptanceDocumentData | null | undefined,
): SevenoTermsAcceptanceMigrationPlan {
  const state = readSevenoTermsAcceptanceMigrationState(data);
  const contexts: TermsAcceptanceContext[] = [];
  const nestedWrite: Partial<Record<TermsAcceptanceContext, TermsAcceptance>> = {};

  for (const entry of state) {
    if (!entry.legacyAcceptance) {
      continue;
    }

    contexts.push(entry.context);
    if (!entry.nestedAcceptance) {
      nestedWrite[entry.context] = entry.legacyAcceptance;
    }
  }

  return {
    contexts,
    nestedWrite,
  };
}
