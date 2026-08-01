import type {
  OfferPrerequisiteSnapshot,
  OfferRequirementCategory,
  PrerequisiteFamily,
} from '@/types/seveno-prerequisites';

const REQUIREMENT_CATEGORIES: readonly OfferRequirementCategory[] = [
  'experience', 'diploma', 'permit', 'vehicle', 'caces', 'certification', 'habilitation',
  'authorization', 'professional_card', 'availability', 'mobility', 'administrative', 'other',
];

function normalized(value: unknown) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function inferOfferRequirementCategory(value: unknown): OfferRequirementCategory | null {
  const text = normalized(value);
  if (/\b(caces|r482|r489|r486)\b/.test(text)) return 'caces';
  if (/\b(permis b|permis c|permis ce|permis d|permis de conduire)\b/.test(text)) return 'permit';
  if (/\b(vehicule|vehicule personnel|moyen de transport)\b/.test(text)) return 'vehicle';
  if (/\b(cap|bep|bac professionnel|bts|diplome|titre professionnel)\b/.test(text)) return 'diploma';
  if (/\b(autorisation de conduite|autorisation)\b/.test(text)) return 'authorization';
  if (/\b(habilitation|habilite)\b/.test(text)) return 'habilitation';
  if (/\b(certification|attestation reglementaire)\b/.test(text)) return 'certification';
  if (/\b(carte professionnelle|agrement)\b/.test(text)) return 'professional_card';
  if (/\b(disponibilite|disponible le samedi|travail de nuit|horaires decales)\b/.test(text)) return 'availability';
  if (/\b(mobilite)\b/.test(text)) return 'mobility';
  if (/\b(experience minimale|annees? d experience|ans? d experience)\b/.test(text)) return 'experience';
  return null;
}

type FamilySource = Partial<Pick<OfferPrerequisiteSnapshot, 'prerequisiteFamily' | 'offerRequirementCategory' | 'category' | 'companyLabel' | 'prerequisiteCode' | 'candidateQuestion'>>;

export function resolvePrerequisiteFamily(snapshot: FamilySource, definition?: FamilySource | null): {
  prerequisiteFamily: PrerequisiteFamily;
  offerRequirementCategory?: OfferRequirementCategory;
} {
  const explicitFamily = snapshot.prerequisiteFamily ?? definition?.prerequisiteFamily;
  const explicitCategory = snapshot.offerRequirementCategory ?? definition?.offerRequirementCategory;
  if (explicitFamily === 'offer_requirement') {
    return { prerequisiteFamily: explicitFamily, offerRequirementCategory: explicitCategory ?? inferOfferRequirementCategory([snapshot.companyLabel, snapshot.prerequisiteCode, snapshot.candidateQuestion].join(' ')) ?? 'other' };
  }
  if (explicitFamily === 'job_skill') return {
    prerequisiteFamily: explicitFamily,
    ...(explicitCategory ? { offerRequirementCategory: explicitCategory } : {}),
  };
  const inferred = inferOfferRequirementCategory([
    snapshot.companyLabel, snapshot.prerequisiteCode, snapshot.candidateQuestion,
    definition?.companyLabel, definition?.prerequisiteCode, definition?.candidateQuestion,
  ].join(' '));
  return inferred ? { prerequisiteFamily: 'offer_requirement', offerRequirementCategory: inferred } : { prerequisiteFamily: 'job_skill' };
}

export function validatePrerequisiteFamily(value: {
  prerequisiteFamily: unknown;
  offerRequirementCategory?: unknown;
}) {
  if (value.prerequisiteFamily !== 'job_skill' && value.prerequisiteFamily !== 'offer_requirement') {
    throw new Error(`prerequisiteFamily=${String(value.prerequisiteFamily)} est invalide. Valeurs autorisées : job_skill, offer_requirement.`);
  }
  if (value.prerequisiteFamily === 'job_skill' && value.offerRequirementCategory != null) {
    throw new Error(`offerRequirementCategory=${String(value.offerRequirementCategory)} doit être absent pour prerequisiteFamily=job_skill.`);
  }
  if (value.prerequisiteFamily === 'offer_requirement' && !REQUIREMENT_CATEGORIES.includes(value.offerRequirementCategory as OfferRequirementCategory)) {
    throw new Error(`offerRequirementCategory=${String(value.offerRequirementCategory)} est invalide pour prerequisiteFamily=offer_requirement. Valeurs autorisées : ${REQUIREMENT_CATEGORIES.join(', ')}.`);
  }
}

export function classifyOfferPrerequisites(items: OfferPrerequisiteSnapshot[]) {
  const resolved = items.map((item) => ({ ...item, ...resolvePrerequisiteFamily(item) }));
  return {
    requiredJobSkills: resolved.filter((item) => item.prerequisiteFamily === 'job_skill' && item.importance === 'required'),
    preferredJobSkills: resolved.filter((item) => item.prerequisiteFamily === 'job_skill' && item.importance === 'preferred'),
    requiredOfferRequirements: resolved.filter((item) => item.prerequisiteFamily === 'offer_requirement' && item.importance === 'required'),
    preferredOfferRequirements: resolved.filter((item) => item.prerequisiteFamily === 'offer_requirement' && item.importance === 'preferred'),
  };
}
