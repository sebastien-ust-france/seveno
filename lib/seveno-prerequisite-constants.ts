import type {
  PrerequisiteAnswerType,
  PrerequisiteCategory,
  PrerequisiteComparisonOperator,
  PrerequisiteCriterionMode,
  PrerequisiteEvidencePolicy,
  PrerequisiteResponseScope,
  PrerequisiteStatus,
} from '@/types/seveno-prerequisites';

export const PREREQUISITE_CATEGORIES: ReadonlyArray<{ value: PrerequisiteCategory; label: string }> = [
  { value: 'license', label: 'Permis et habilitations' },
  { value: 'certification', label: 'Certifications' },
  { value: 'language', label: 'Langues' },
  { value: 'software', label: 'Logiciels' },
  { value: 'technical_skill', label: 'Competences techniques' },
  { value: 'experience', label: 'Experience professionnelle' },
  { value: 'education', label: 'Formation et diplome' },
  { value: 'availability', label: 'Disponibilite' },
  { value: 'mobility', label: 'Mobilite professionnelle' },
  { value: 'schedule', label: 'Horaires de travail' },
  { value: 'work_environment', label: 'Environnement de travail' },
  { value: 'physical_requirement', label: 'Aptitude professionnelle necessaire' },
  { value: 'other_professional', label: 'Autre prerequis professionnel' },
];

export const PREREQUISITE_ANSWER_TYPES: ReadonlyArray<{ value: PrerequisiteAnswerType; label: string }> = [
  { value: 'boolean', label: 'Oui / non' },
  { value: 'single_choice', label: 'Choix unique' },
  { value: 'multiple_choice', label: 'Choix multiples' },
  { value: 'level', label: 'Niveau ordonne' },
  { value: 'number', label: 'Nombre' },
  { value: 'date', label: 'Date' },
];

export const PREREQUISITE_OPERATORS: ReadonlyArray<{ value: PrerequisiteComparisonOperator; label: string }> = [
  { value: 'equals', label: 'Egal a' },
  { value: 'minimum', label: 'Minimum' },
  { value: 'maximum', label: 'Maximum' },
  { value: 'contains_any', label: 'Contient au moins une valeur' },
  { value: 'contains_all', label: 'Contient toutes les valeurs' },
  { value: 'before', label: 'Avant' },
  { value: 'after', label: 'Apres' },
];

export const PREREQUISITE_CRITERION_MODES: ReadonlyArray<{ value: PrerequisiteCriterionMode; label: string }> = [
  { value: 'fixed', label: 'Critere fixe Seven’O' },
  { value: 'configurable', label: 'Critere configurable' },
];

export const PREREQUISITE_RESPONSE_SCOPES: ReadonlyArray<{ value: PrerequisiteResponseScope; label: string }> = [
  { value: 'profile_reusable', label: 'Reutilisable sur le profil' },
  { value: 'application_specific', label: 'Propre a une candidature' },
];

export const PREREQUISITE_EVIDENCE_POLICIES: ReadonlyArray<{ value: PrerequisiteEvidencePolicy; label: string }> = [
  { value: 'none', label: 'Aucun justificatif' },
  { value: 'optional', label: 'Justificatif optionnel' },
  { value: 'required_after_match', label: 'Requis apres mise en relation' },
];

export const PREREQUISITE_STATUSES: ReadonlyArray<{ value: PrerequisiteStatus; label: string }> = [
  { value: 'draft', label: 'Brouillon' },
  { value: 'active', label: 'Actif' },
  { value: 'archived', label: 'Archive' },
];

export const PREREQUISITE_OPERATOR_COMPATIBILITY: Record<
  PrerequisiteAnswerType,
  readonly PrerequisiteComparisonOperator[]
> = {
  boolean: ['equals'],
  single_choice: ['equals'],
  multiple_choice: ['contains_any', 'contains_all'],
  level: ['equals', 'minimum', 'maximum'],
  number: ['equals', 'minimum', 'maximum'],
  date: ['equals', 'before', 'after'],
};

export const SEVENO_OFFER_PREREQUISITE_LIMITS = {
  required: 5,
  preferred: 3,
  total: 8,
} as const;
