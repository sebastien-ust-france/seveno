import { getFamiliesBySector, getRolesByFamily, JOB_SECTORS } from '@/lib/job-taxonomy';
import type {
  RespondentType,
  StudyAnswers,
  StudyQuestion,
  StudyQuestionContext,
  StudyQuestionOption,
  StudyQuestionOptions,
  StudyQuestionOptionsResolver,
} from '@/types/study';

export const respondentOptions: Array<{
  value: RespondentType;
  label: string;
  description: string;
}> = [
  {
    value: 'professional_available',
    label: 'Professionnel disponible',
    description: 'Vous cherchez une mission ou un poste rapidement.',
  },
  {
    value: 'professional_employed',
    label: 'Professionnel déjà en poste',
    description: 'Vous êtes en activité mais ouvert à une opportunité.',
  },
  {
    value: 'company',
    label: 'Entreprise',
    description: 'Vous recrutez ou anticipez des besoins de compétences.',
  },
  {
    value: 'agency',
    label: "Agence d'intérim / cabinet RH",
    description: 'Vous accompagnez des recrutements ou des mises en relation.',
  },
];

const HIDDEN_COMPOSITE_QUESTION_IDS = new Set([
  'family_code',
  'current_role_code',
  'target_role_codes',
  'current_recruitment_role_codes',
  'hardest_recruitment_role_codes',
  'agency_frequent_role_codes',
  'agency_hardest_role_codes',
]);

export const respondentLabelByType: Record<RespondentType, string> = respondentOptions.reduce(
  (accumulator, option) => {
    accumulator[option.value] = option.label;
    return accumulator;
  },
  {} as Record<RespondentType, string>,
);

export const yesNoOptions: StudyQuestionOption[] = [
  { value: 'yes', label: 'Oui' },
  { value: 'no', label: 'Non' },
];

const contractTypeOptions: StudyQuestionOption[] = [
  { value: 'cdi', label: 'CDI' },
  { value: 'cdd', label: 'CDD' },
  { value: 'interim', label: 'Intérim' },
  { value: 'freelance', label: 'Freelance' },
  { value: 'mission', label: 'Mission ponctuelle' },
  { value: 'indifferent', label: 'Indifférent' },
];

const experienceLevelOptions: StudyQuestionOption[] = [
  { value: 'junior', label: 'Junior' },
  { value: 'confirme', label: 'Confirmé' },
  { value: 'senior', label: 'Senior' },
  { value: 'expert_independant', label: 'Expert / indépendant' },
];

const timelineOptions: StudyQuestionOption[] = [
  { value: 'immediately', label: 'Immédiatement' },
  { value: 'less_than_30_days', label: 'Moins de 30 jours' },
  { value: '1_to_3_months', label: '1 à 3 mois' },
  { value: 'later', label: 'Plus tard' },
];

const hiringVolumeOptions: StudyQuestionOption[] = [
  { value: '1_to_3', label: '1 à 3' },
  { value: '4_to_10', label: '4 à 10' },
  { value: '11_to_20', label: '11 à 20' },
  { value: 'more_than_20', label: 'Plus de 20' },
];

const needOpenSinceOptions: StudyQuestionOption[] = [
  { value: 'less_than_2_weeks', label: 'Moins de 2 semaines' },
  { value: '2_to_4_weeks', label: '2 à 4 semaines' },
  { value: '1_to_3_months', label: '1 à 3 mois' },
  { value: 'more_than_3_months', label: 'Plus de 3 mois' },
];

const monthlyVolumeOptions: StudyQuestionOption[] = [
  { value: 'less_than_5', label: 'Moins de 5' },
  { value: '5_to_20', label: '5 à 20' },
  { value: '20_to_50', label: '20 à 50' },
  { value: 'more_than_50', label: 'Plus de 50' },
];

const candidatePoolSizeOptions: StudyQuestionOption[] = [
  { value: 'less_than_100', label: 'Moins de 100' },
  { value: '100_to_500', label: '100 à 500' },
  { value: '500_to_2000', label: '500 à 2 000' },
  { value: 'more_than_2000', label: 'Plus de 2 000' },
];

const searchDurationOptions: StudyQuestionOption[] = [
  { value: 'less_than_15_days', label: 'Moins de 15 jours' },
  { value: '15_days_to_1_month', label: '15 jours à 1 mois' },
  { value: '1_to_3_months', label: '1 à 3 mois' },
  { value: '3_to_6_months', label: '3 à 6 mois' },
  { value: 'more_than_6_months', label: 'Plus de 6 mois' },
];

const compensationRangeOptions: StudyQuestionOption[] = [
  { value: 'less_than_2000', label: 'Moins de 2 000 €' },
  { value: '2000_to_3000', label: '2 000 € à 3 000 €' },
  { value: '3000_to_4000', label: '3 000 € à 4 000 €' },
  { value: '4000_to_5000', label: '4 000 € à 5 000 €' },
  { value: 'more_than_5000', label: 'Plus de 5 000 €' },
];

const workModeOptions: StudyQuestionOption[] = [
  { value: 'onsite', label: 'Présentiel' },
  { value: 'hybrid', label: 'Hybride' },
  { value: 'remote', label: 'Télétravail' },
  { value: 'mobile', label: 'Déplacements fréquents' },
];

const languageOptions: StudyQuestionOption[] = [
  { value: 'french', label: 'Français' },
  { value: 'english', label: 'Anglais' },
  { value: 'spanish', label: 'Espagnol' },
  { value: 'german', label: 'Allemand' },
  { value: 'italian', label: 'Italien' },
  { value: 'portuguese', label: 'Portugais' },
  { value: 'dutch', label: 'Néerlandais' },
  { value: 'luxembourgish', label: 'Luxembourgeois' },
  { value: 'other', label: 'Autre' },
];

const europeCountryOptions: StudyQuestionOption[] = [
  { value: 'france', label: 'France' },
  { value: 'belgium', label: 'Belgique' },
  { value: 'luxembourg', label: 'Luxembourg' },
  { value: 'switzerland', label: 'Suisse' },
  { value: 'spain', label: 'Espagne' },
  { value: 'germany', label: 'Allemagne' },
  { value: 'netherlands', label: 'Pays-Bas' },
  { value: 'italy', label: 'Italie' },
  { value: 'portugal', label: 'Portugal' },
  { value: 'ireland', label: 'Irlande' },
];

const relocationOptions: StudyQuestionOption[] = [
  { value: 'yes', label: 'Oui' },
  { value: 'yes_with_help', label: 'Oui avec aide à la mobilité' },
  { value: 'depends_on_offer', label: "Cela dépend de l'offre" },
  { value: 'no', label: 'Non' },
];

const jobPlatformOptions: StudyQuestionOption[] = [
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'indeed', label: 'Indeed' },
  { value: 'france_travail', label: 'France Travail' },
  { value: 'apec', label: 'Apec' },
  { value: 'welcome_to_the_jungle', label: 'Welcome to the Jungle' },
  { value: 'hellowork', label: 'Hellowork' },
  { value: 'personal_network', label: 'Réseau personnel' },
  { value: 'recruitment_agency', label: 'Cabinet de recrutement' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'spontaneous_applications', label: 'Candidatures spontanées' },
  { value: 'other', label: 'Autre' },
];

const searchBlockerOptions: StudyQuestionOption[] = [
  { value: 'few_jobs', label: "Peu d'offres" },
  { value: 'irrelevant_jobs', label: 'Offres peu pertinentes' },
  { value: 'salary', label: 'Salaire' },
  { value: 'location', label: 'Localisation' },
  { value: 'no_answers', label: 'Manque de réponses' },
  { value: 'too_slow', label: 'Processus trop longs' },
  { value: 'visibility', label: 'Manque de visibilité' },
  { value: 'other', label: 'Autre' },
];

const candidateValueExpectationOptions: StudyQuestionOption[] = [
  { value: 'relevant_offers', label: 'Recevoir uniquement des offres pertinentes' },
  { value: 'direct_contact', label: 'Être contacté directement' },
  { value: 'save_time', label: 'Gagner du temps' },
  { value: 'more_visibility', label: 'Plus de visibilité' },
  { value: 'hidden_opportunities', label: 'Découvrir des opportunités cachées' },
  { value: 'better_matching', label: 'Avoir un meilleur matching' },
  { value: 'ai_support', label: "IA d'accompagnement" },
  { value: 'other', label: 'Autre' },
];

const marketMissingOptions: StudyQuestionOption[] = [
  { value: 'better_matching', label: 'Un meilleur matching entre candidats et recruteurs' },
  { value: 'relevant_offers', label: 'Des offres plus pertinentes' },
  { value: 'better_qualified_profiles', label: 'Des profils mieux qualifiés' },
  { value: 'more_transparency', label: 'Plus de transparence' },
  { value: 'faster_answers', label: 'Des réponses plus rapides' },
  { value: 'more_human_support', label: 'Un accompagnement plus humain' },
  { value: 'better_understanding', label: 'Une meilleure compréhension des besoins' },
  { value: 'less_irrelevant_applications', label: 'Moins de candidatures non pertinentes' },
  { value: 'less_bulk_cv', label: 'Moins de CV envoyés en masse' },
  { value: 'better_communication', label: 'Une meilleure communication tout au long du processus' },
  { value: 'more_simplicity', label: 'Plus de simplicité dans les démarches' },
  { value: 'european_dimension', label: 'Une dimension européenne' },
  { value: 'better_ai_usage', label: "Une meilleure utilisation de l'intelligence artificielle" },
  { value: 'other', label: 'Autre' },
];

const professionalValueExpectationOptions: StudyQuestionOption[] = [
  { value: 'more_relevant_opportunities', label: 'Des opportunités plus pertinentes' },
  { value: 'save_time', label: 'Gagner du temps' },
  { value: 'more_visible_to_recruiters', label: 'Être plus visible auprès des recruteurs' },
  { value: 'contacted_for_right_jobs', label: 'Être contacté pour les bons postes' },
  { value: 'better_market_understanding', label: 'Mieux comprendre le marché' },
];

const companyValueExpectationOptions: StudyQuestionOption[] = [
  { value: 'more_qualified_profiles', label: 'Accéder à des profils plus qualifiés' },
  { value: 'rare_profiles', label: 'Identifier des profils rares' },
  { value: 'faster_sourcing', label: 'Réduire le temps de sourcing' },
  { value: 'fewer_irrelevant_applications', label: 'Recevoir moins de candidatures non pertinentes' },
  { value: 'better_market_understanding', label: 'Mieux comprendre les tensions du marché' },
];

const agencyValueExpectationOptions: StudyQuestionOption[] = [
  { value: 'complementary_candidate_source', label: 'Accéder à une source complémentaire de candidats' },
  { value: 'source_faster', label: 'Sourcer plus rapidement' },
  { value: 'hard_to_find_profiles', label: 'Identifier des profils difficiles à trouver' },
  { value: 'better_candidate_screening', label: 'Mieux qualifier les candidats' },
  { value: 'less_sourcing_time', label: 'Réduire le temps passé sur le sourcing' },
];

export const valueExpectationOptionsByCode: StudyQuestionOption[] = [
  ...professionalValueExpectationOptions,
  ...companyValueExpectationOptions,
  ...agencyValueExpectationOptions,
];

const activeZoneOptions: StudyQuestionOption[] = [
  { value: 'france', label: 'France' },
  { value: 'belgium', label: 'Belgique' },
  { value: 'luxembourg', label: 'Luxembourg' },
  { value: 'switzerland', label: 'Suisse' },
  { value: 'spain', label: 'Espagne' },
  { value: 'europe', label: 'Europe' },
  { value: 'other', label: 'Autre' },
];

const professionalEmployedBlockerOptions: StudyQuestionOption[] = [
  { value: 'discretion', label: 'Discrétion' },
  { value: 'relevance', label: "Offres pas assez pertinentes" },
  { value: 'timing', label: 'Timing' },
  { value: 'salary', label: 'Rémunération' },
  { value: 'mobility', label: 'Mobilité' },
  { value: 'other', label: 'Autre' },
];

const employedChangeReasonOptions: StudyQuestionOption[] = [
  { value: 'better_salary', label: 'Une meilleure rémunération' },
  { value: 'better_balance', label: 'Un meilleur équilibre de vie' },
  { value: 'better_progression', label: 'Une évolution de carrière plus rapide' },
  { value: 'better_management', label: 'Un meilleur management' },
  { value: 'more_flexibility', label: 'Plus de flexibilité' },
  { value: 'more_remote', label: 'Davantage de télétravail' },
  { value: 'more_meaningful_work', label: 'Un poste plus motivant' },
  { value: 'less_commute', label: 'Moins de temps de trajet' },
];

const companyBlockerOptions: StudyQuestionOption[] = [
  { value: 'finding_candidates', label: 'Trouver les bons profils' },
  { value: 'speed', label: 'Aller assez vite' },
  { value: 'attraction', label: 'Attirer les candidats' },
  { value: 'qualification', label: 'Qualifier les profils' },
  { value: 'salary', label: 'Aligner la rémunération' },
  { value: 'other', label: 'Autre' },
];

const companyHiringChannelOptions: StudyQuestionOption[] = [
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'indeed', label: 'Indeed' },
  { value: 'welcome_to_the_jungle', label: 'Welcome to the Jungle' },
  { value: 'hellowork', label: 'Hellowork' },
  { value: 'france_travail', label: 'France Travail' },
  { value: 'company_website', label: "Site carrière / site de l'entreprise" },
  { value: 'referral', label: 'Cooptation' },
  { value: 'social_networks', label: 'Réseaux sociaux' },
  { value: 'agency', label: 'Cabinet / agence' },
  { value: 'spontaneous', label: 'Candidatures spontanées' },
  { value: 'other', label: 'Autre' },
];

const salaryRangeOptions: StudyQuestionOption[] = [
  { value: 'less_than_30000', label: 'Moins de 30 000 €' },
  { value: '30000_to_40000', label: '30 000 € à 40 000 €' },
  { value: '40000_to_50000', label: '40 000 € à 50 000 €' },
  { value: '50000_to_70000', label: '50 000 € à 70 000 €' },
  { value: 'more_than_70000', label: 'Plus de 70 000 €' },
];

const agencyBlockerOptions: StudyQuestionOption[] = [
  { value: 'finding_candidates', label: 'Trouver des candidats' },
  { value: 'speed', label: 'Répondre plus vite' },
  { value: 'qualification', label: 'Qualifier les profils' },
  { value: 'market_tension', label: 'Marchés trop tendus' },
  { value: 'tools', label: 'Outils actuels limitants' },
  { value: 'other', label: 'Autre' },
];

const agencySourcingChannelOptions: StudyQuestionOption[] = [
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'job_boards', label: "Sites d'emploi" },
  { value: 'direct_sourcing', label: 'Sourcing direct' },
  { value: 'database', label: 'Base de candidats / CRM' },
  { value: 'referral', label: 'Cooptation' },
  { value: 'client_network', label: 'Réseau client' },
  { value: 'social_networks', label: 'Réseaux sociaux' },
  { value: 'ats', label: 'ATS / CRM' },
  { value: 'other', label: 'Autre' },
];

function visibleWhen(predicate: (answers: StudyAnswers) => boolean) {
  return ({ answers }: StudyQuestionContext) => predicate(answers);
}

function toOptions(items: Array<{ code: string; label: string; aliases?: string[] }>): StudyQuestionOption[] {
  return items.map((item) => ({
    value: item.code,
    label: item.label,
    ...(item.aliases && item.aliases.length > 0 ? { searchTerms: item.aliases } : {}),
  }));
}

function sectorOptions(): StudyQuestionOption[] {
  return toOptions(JOB_SECTORS);
}

function familyOptions(context: StudyQuestionContext): StudyQuestionOption[] {
  const sectorCode = typeof context.answers.sectorCode === 'string' ? context.answers.sectorCode : '';
  return toOptions(getFamiliesBySector(sectorCode));
}

function roleOptions(context: StudyQuestionContext): StudyQuestionOption[] {
  const familyCode = typeof context.answers.familyCode === 'string' ? context.answers.familyCode : '';
  return toOptions(getRolesByFamily(familyCode));
}

function isOptionsResolver(options: StudyQuestionOptions): options is StudyQuestionOptionsResolver {
  return typeof options === 'function';
}

export function resolveQuestionOptions(
  question: StudyQuestion,
  context: StudyQuestionContext,
): StudyQuestionOption[] {
  if (!question.options) {
    return [];
  }

  if (isOptionsResolver(question.options)) {
    return question.options(context);
  }

  return question.options;
}

const sectorQuestion: StudyQuestion = {
  id: 'sector_code',
  firestoreKey: 'sectorCode',
  label: "Quel est votre secteur d'activité ?",
  type: 'single',
  required: true,
  category: 'segmentation',
  options: sectorOptions,
};

const familyQuestion: StudyQuestion = {
  id: 'family_code',
  firestoreKey: 'familyCode',
  label: 'Quelle famille de métier vous concerne le plus ?',
  type: 'single',
  required: true,
  visibleIf: visibleWhen((answers) => typeof answers.sectorCode === 'string' && answers.sectorCode.length > 0),
  category: 'segmentation',
  options: familyOptions,
};

const activeZoneQuestion: StudyQuestion = {
  id: 'active_zone_code',
  firestoreKey: 'activeZoneCode',
  label: 'Dans quelle zone êtes-vous principalement actif ?',
  type: 'single',
  required: true,
  category: 'segmentation',
  options: activeZoneOptions,
};

const activeZoneOtherQuestion: StudyQuestion = {
  id: 'active_zone_other',
  firestoreKey: 'activeZoneOther',
  label: 'Veuillez préciser votre pays :',
  type: 'text',
  required: true,
  visibleIf: visibleWhen((answers) => answers.activeZoneCode === 'other'),
  category: 'segmentation',
  placeholder: 'Ex : Portugal',
};

const currentRoleQuestion: StudyQuestion = {
  id: 'current_role_code',
  firestoreKey: 'currentRoleCode',
  label: 'Quel est votre poste actuel ou votre dernier poste occupé ?',
  type: 'single',
  required: true,
  visibleIf: visibleWhen((answers) => typeof answers.familyCode === 'string' && answers.familyCode.length > 0),
  category: 'qualification',
  options: roleOptions,
};

const experienceLevelQuestion: StudyQuestion = {
  id: 'experience_level_code',
  firestoreKey: 'experienceLevelCode',
  label: "Quel est votre niveau d'expérience ?",
  type: 'single',
  required: true,
  visibleIf: visibleWhen((answers) => typeof answers.familyCode === 'string' && answers.familyCode.length > 0),
  category: 'qualification',
  options: experienceLevelOptions,
};

const valueExpectationQuestion: StudyQuestion = {
  id: 'value_expectation_code',
  firestoreKey: 'valueExpectationCode',
  label: 'Quelle valeur attendez-vous de Seveno ?',
  type: 'single',
  required: true,
  visibleIf: visibleWhen((answers) => typeof answers.familyCode === 'string' && answers.familyCode.length > 0),
  category: 'intent',
  options: ({ respondentType }) => {
    if (respondentType === 'company') {
      return companyValueExpectationOptions;
    }

    if (respondentType === 'agency') {
      return agencyValueExpectationOptions;
    }

    return professionalValueExpectationOptions;
  },
};

const targetRoleCodesQuestion: StudyQuestion = {
  id: 'target_role_codes',
  firestoreKey: 'targetRoleCodes',
  label: 'Quels postes recherchez-vous actuellement ?',
  description: 'Plusieurs réponses sont possibles.',
  type: 'multi',
  required: true,
  maxSelections: 5,
  visibleIf: visibleWhen((answers) => typeof answers.familyCode === 'string' && answers.familyCode.length > 0),
  category: 'market',
  options: roleOptions,
};

const secondaryRoleCodesQuestion: StudyQuestion = {
  id: 'secondary_role_codes',
  firestoreKey: 'secondaryRoleCodes',
  label: 'Quels autres postes pourriez-vous aussi occuper ?',
  description: 'Cela nous aide à mesurer vos passerelles de carrière.',
  type: 'multi',
  required: false,
  maxSelections: 5,
  visibleIf: visibleWhen(
    (answers) => Array.isArray(answers.targetRoleCodes) && answers.targetRoleCodes.some((entry) => typeof entry === 'string'),
  ),
  category: 'qualification',
  options: roleOptions,
};

const contractTypeCodesQuestion: StudyQuestion = {
  id: 'contract_type_codes',
  firestoreKey: 'contractTypeCodes',
  label: 'Quels types de contrats recherchez-vous ?',
  description: 'Plusieurs réponses sont possibles.',
  type: 'multi',
  required: true,
  maxSelections: 5,
  visibleIf: visibleWhen((answers) => typeof answers.familyCode === 'string' && answers.familyCode.length > 0),
  category: 'market',
  options: contractTypeOptions,
};

const workModePreferenceCodesQuestion: StudyQuestion = {
  id: 'work_mode_preference_codes',
  firestoreKey: 'workModePreferenceCodes',
  label: 'Quels modes de travail acceptez-vous ?',
  description: 'Plusieurs réponses sont possibles.',
  type: 'multi',
  required: true,
  maxSelections: 5,
  visibleIf: visibleWhen((answers) => typeof answers.familyCode === 'string' && answers.familyCode.length > 0),
  category: 'market',
  options: workModeOptions,
};

const searchDurationQuestion: StudyQuestion = {
  id: 'search_duration_code',
  firestoreKey: 'searchDurationCode',
  label: 'Depuis combien de temps recherchez-vous un emploi ou une mission ?',
  type: 'single',
  required: true,
  visibleIf: visibleWhen((answers) => typeof answers.familyCode === 'string' && answers.familyCode.length > 0),
  category: 'market',
  options: searchDurationOptions,
};

const desiredCompensationRangeQuestion: StudyQuestion = {
  id: 'desired_compensation_range_code',
  firestoreKey: 'desiredCompensationRangeCode',
  label: 'Quelle rémunération mensuelle brute recherchez-vous ?',
  type: 'single',
  required: true,
  visibleIf: visibleWhen((answers) => typeof answers.familyCode === 'string' && answers.familyCode.length > 0),
  category: 'market',
  options: compensationRangeOptions,
};

const availabilityNowQuestion: StudyQuestion = {
  id: 'availability_now',
  firestoreKey: 'availabilityNow',
  label: 'Êtes-vous disponible immédiatement ?',
  type: 'yesno',
  required: true,
  visibleIf: visibleWhen((answers) => typeof answers.familyCode === 'string' && answers.familyCode.length > 0),
  category: 'market',
};

const languagesCodesQuestion: StudyQuestion = {
  id: 'languages_codes',
  firestoreKey: 'languagesCodes',
  label: 'Quelles langues maîtrisez-vous ?',
  description: 'Plusieurs réponses sont possibles.',
  type: 'multi',
  required: true,
  maxSelections: 5,
  visibleIf: visibleWhen((answers) => typeof answers.familyCode === 'string' && answers.familyCode.length > 0),
  category: 'qualification',
  options: languageOptions,
};

const languagesOtherQuestion: StudyQuestion = {
  id: 'languages_other',
  firestoreKey: 'languagesOther',
  label: 'Précisez la langue :',
  type: 'text',
  required: true,
  visibleIf: visibleWhen((answers) => Array.isArray(answers.languagesCodes) && answers.languagesCodes.includes('other')),
  category: 'qualification',
  placeholder: 'Ex : polonais',
};

const europeMobilityQuestion: StudyQuestion = {
  id: 'europe_mobility_code',
  firestoreKey: 'europeMobilityCode',
  label: "Seriez-vous prêt à travailler dans un autre pays de l'Union européenne ?",
  type: 'single',
  required: true,
  visibleIf: visibleWhen((answers) => typeof answers.familyCode === 'string' && answers.familyCode.length > 0),
  category: 'market',
  options: [
    { value: 'yes_anywhere', label: 'Oui partout' },
    { value: 'yes_specific', label: 'Oui selon le pays' },
    { value: 'frontier_only', label: 'Oui uniquement dans les pays frontaliers' },
    { value: 'no', label: 'Non' },
  ],
};

const europeTargetCountryCodesQuestion: StudyQuestion = {
  id: 'europe_target_country_codes',
  firestoreKey: 'europeTargetCountryCodes',
  label: 'Quels pays vous intéressent ?',
  description: 'Plusieurs réponses sont possibles.',
  type: 'multi',
  required: true,
  maxSelections: 5,
  visibleIf: visibleWhen((answers) => answers.europeMobilityCode === 'yes_specific'),
  category: 'market',
  options: europeCountryOptions,
};

const relocationQuestion: StudyQuestion = {
  id: 'relocation_code',
  firestoreKey: 'relocationCode',
  label: 'Seriez-vous prêt à déménager ?',
  type: 'single',
  required: true,
  visibleIf: visibleWhen((answers) => typeof answers.familyCode === 'string' && answers.familyCode.length > 0),
  category: 'market',
  options: relocationOptions,
};

const jobPlatformCodesQuestion: StudyQuestion = {
  id: 'job_platform_codes',
  firestoreKey: 'jobPlatformCodes',
  label: 'Quelles plateformes utilisez-vous actuellement pour rechercher un emploi ?',
  description: 'Plusieurs réponses sont possibles.',
  type: 'multi',
  required: true,
  maxSelections: 5,
  visibleIf: visibleWhen((answers) => typeof answers.familyCode === 'string' && answers.familyCode.length > 0),
  category: 'market',
  options: jobPlatformOptions,
};

const searchBlockerCodesQuestion: StudyQuestion = {
  id: 'search_blocker_codes',
  firestoreKey: 'searchBlockerCodes',
  label: "Qu'est-ce qui vous freine aujourd'hui ?",
  description: 'Plusieurs réponses sont possibles.',
  type: 'multi',
  required: true,
  maxSelections: 5,
  visibleIf: visibleWhen((answers) => typeof answers.familyCode === 'string' && answers.familyCode.length > 0),
  category: 'barrier',
  options: searchBlockerOptions,
};

const candidateApplicationsBeforeInterviewQuestion: StudyQuestion = {
  id: 'applications_before_interview_code',
  firestoreKey: 'applicationsBeforeInterviewCode',
  label: "Combien de candidatures envoyez-vous en moyenne avant d'obtenir un entretien ?",
  type: 'single',
  required: true,
  visibleIf: visibleWhen((answers) => typeof answers.familyCode === 'string' && answers.familyCode.length > 0),
  category: 'market',
  options: [
    { value: '1_to_5', label: '1 à 5' },
    { value: '6_to_10', label: '6 à 10' },
    { value: '11_to_20', label: '11 à 20' },
    { value: 'more_than_20', label: 'Plus de 20' },
  ],
};

const dailyAvailabilityConfirmationQuestion: StudyQuestion = {
  id: 'daily_availability_confirmation',
  firestoreKey: 'dailyAvailabilityConfirmation',
  label:
    'Pour garantir que votre profil reste actif et visible auprès des recruteurs, seriez-vous prêt à confirmer votre disponibilité une fois par jour en un clic ?',
  type: 'single',
  required: true,
  visibleIf: ({ respondentType }) =>
    respondentType === 'professional_available' || respondentType === 'professional_employed',
  category: 'intent',
  options: [
    { value: 'yes_without_problem', label: 'Oui, sans problème' },
    { value: 'yes_if_under_10_seconds', label: 'Oui, si cela prend moins de 10 secondes' },
    { value: 'yes_when_actively_searching', label: 'Oui, mais seulement lorsque je recherche activement' },
    { value: 'weekly_maximum', label: 'Non, une fois par semaine maximum' },
    { value: 'no', label: 'Non, je ne le ferais pas' },
  ],
};

const marketMissingCodesQuestion: StudyQuestion = {
  id: 'market_missing_codes',
  firestoreKey: 'marketMissingCodes',
  label: "Selon vous, qu'est-ce qui manque aujourd'hui aux plateformes et aux cabinets de recrutement ?",
  description: 'Limité à 5 réponses.',
  type: 'multi',
  required: true,
  maxSelections: 5,
  visibleIf: visibleWhen((answers) => typeof answers.familyCode === 'string' && answers.familyCode.length > 0),
  category: 'intent',
  options: marketMissingOptions,
};

const marketMissingOtherQuestion: StudyQuestion = {
  id: 'market_missing_other',
  firestoreKey: 'marketMissingOther',
  label: 'Précisez votre réponse :',
  type: 'text',
  required: true,
  visibleIf: visibleWhen((answers) => Array.isArray(answers.marketMissingCodes) && answers.marketMissingCodes.includes('other')),
  category: 'intent',
  placeholder: 'Votre réponse',
};

const improvementNoteQuestion: StudyQuestion = {
  id: 'improvement_note',
  firestoreKey: 'improvementNote',
  label: "Si vous pouviez changer une seule chose dans le recrutement actuel, laquelle choisiriez-vous ?",
  type: 'text',
  required: false,
  visibleIf: visibleWhen((answers) => typeof answers.familyCode === 'string' && answers.familyCode.length > 0),
  category: 'intent',
  placeholder: 'Votre réponse courte',
};

const candidateValueExpectationCodesQuestion: StudyQuestion = {
  id: 'value_expectation_codes',
  firestoreKey: 'valueExpectationCodes',
  label: 'Quelle valeur attendez-vous de Seveno ?',
  description: 'Plusieurs réponses sont possibles.',
  type: 'multi',
  required: true,
  maxSelections: 5,
  visibleIf: visibleWhen((answers) => typeof answers.familyCode === 'string' && answers.familyCode.length > 0),
  category: 'intent',
  options: candidateValueExpectationOptions,
};

const professionalAvailableQuestions: StudyQuestion[] = [
  sectorQuestion,
  activeZoneQuestion,
  activeZoneOtherQuestion,
  familyQuestion,
  currentRoleQuestion,
  targetRoleCodesQuestion,
  secondaryRoleCodesQuestion,
  contractTypeCodesQuestion,
  workModePreferenceCodesQuestion,
  searchDurationQuestion,
  desiredCompensationRangeQuestion,
  availabilityNowQuestion,
  experienceLevelQuestion,
  languagesCodesQuestion,
  languagesOtherQuestion,
  europeMobilityQuestion,
  europeTargetCountryCodesQuestion,
  relocationQuestion,
  jobPlatformCodesQuestion,
  searchBlockerCodesQuestion,
  candidateApplicationsBeforeInterviewQuestion,
  dailyAvailabilityConfirmationQuestion,
  marketMissingCodesQuestion,
  marketMissingOtherQuestion,
  improvementNoteQuestion,
  candidateValueExpectationCodesQuestion,
];

const professionalEmployedQuestions: StudyQuestion[] = [
  sectorQuestion,
  activeZoneQuestion,
  activeZoneOtherQuestion,
  familyQuestion,
  currentRoleQuestion,
  targetRoleCodesQuestion,
  secondaryRoleCodesQuestion,
  contractTypeCodesQuestion,
  experienceLevelQuestion,
  {
    id: 'open_to_opportunity',
    firestoreKey: 'openToOpportunity',
    label: 'Êtes-vous ouvert à une opportunité ?',
    description: 'On mesure la profondeur du signal marché.',
    type: 'yesno',
    required: true,
    visibleIf: visibleWhen((answers) => typeof answers.familyCode === 'string' && answers.familyCode.length > 0),
    category: 'intent',
  },
  {
    id: 'open_reason',
    firestoreKey: 'openReason',
    label: 'Pourquoi ?',
    description: "Qu'est-ce qui bloque aujourd'hui ?",
    type: 'text',
    required: true,
    visibleIf: visibleWhen((answers) => answers.openToOpportunity === 'no'),
    category: 'barrier',
    placeholder: 'Pourquoi ?',
  },
  {
    id: 'change_horizon_code',
    firestoreKey: 'changeHorizonCode',
    label: 'À quel horizon envisageriez-vous un changement ?',
    type: 'single',
    required: true,
    visibleIf: visibleWhen((answers) => answers.openToOpportunity === 'yes'),
    category: 'market',
    options: timelineOptions,
  },
  {
    id: 'change_reason_codes',
    firestoreKey: 'changeReasonCodes',
    label: "Quelles raisons pourraient vous faire changer d'emploi ?",
    description: 'Plusieurs réponses sont possibles.',
    type: 'multi',
    required: false,
    maxSelections: 5,
    visibleIf: visibleWhen((answers) => typeof answers.familyCode === 'string' && answers.familyCode.length > 0),
    category: 'market',
    options: employedChangeReasonOptions,
  },
  {
    id: 'career_blocker_code',
    firestoreKey: 'careerBlockerCode',
    label: "Quelle est aujourd'hui votre principale frustration ?",
    type: 'single',
    required: true,
    visibleIf: visibleWhen((answers) => typeof answers.familyCode === 'string' && answers.familyCode.length > 0),
    category: 'barrier',
    options: professionalEmployedBlockerOptions,
  },
  jobPlatformCodesQuestion,
  languagesCodesQuestion,
  languagesOtherQuestion,
  europeMobilityQuestion,
  europeTargetCountryCodesQuestion,
  relocationQuestion,
  searchBlockerCodesQuestion,
  marketMissingCodesQuestion,
  marketMissingOtherQuestion,
  improvementNoteQuestion,
  candidateValueExpectationCodesQuestion,
];

const companyQuestions: StudyQuestion[] = [
  sectorQuestion,
  activeZoneQuestion,
  activeZoneOtherQuestion,
  familyQuestion,
  {
    id: 'current_recruitment_role_codes',
    firestoreKey: 'currentRecruitmentRoleCodes',
    label: 'Quels postes recrutez-vous actuellement ?',
    description: 'Plusieurs réponses sont possibles.',
    type: 'multi',
    required: true,
    maxSelections: 5,
    visibleIf: visibleWhen((answers) => typeof answers.familyCode === 'string' && answers.familyCode.length > 0),
    category: 'qualification',
    options: roleOptions,
  },
  {
    id: 'hardest_recruitment_role_codes',
    firestoreKey: 'hardestRecruitmentRoleCodes',
    label: "Quels postes sont les plus difficiles à recruter aujourd'hui ?",
    description: 'Plusieurs réponses sont possibles.',
    type: 'multi',
    required: true,
    maxSelections: 5,
    visibleIf: visibleWhen(
      (answers) => Array.isArray(answers.currentRecruitmentRoleCodes) && answers.currentRecruitmentRoleCodes.length > 0,
    ),
    category: 'barrier',
    options: roleOptions,
  },
  {
    id: 'most_frequent_recruitment_role_codes',
    firestoreKey: 'mostFrequentRecruitmentRoleCodes',
    label: 'Quels postes recrutez-vous le plus fréquemment ?',
    description: 'Plusieurs réponses sont possibles.',
    type: 'multi',
    required: false,
    maxSelections: 5,
    visibleIf: visibleWhen((answers) => typeof answers.familyCode === 'string' && answers.familyCode.length > 0),
    category: 'qualification',
    options: roleOptions,
  },
  contractTypeCodesQuestion,
  {
    id: 'hiring_volume_code',
    firestoreKey: 'hiringVolumeCode',
    label: 'Combien de recrutements prévoyez-vous dans les 12 prochains mois ?',
    type: 'single',
    required: true,
    visibleIf: visibleWhen((answers) => typeof answers.familyCode === 'string' && answers.familyCode.length > 0),
    category: 'market',
    options: hiringVolumeOptions,
  },
  {
    id: 'need_open_since_code',
    firestoreKey: 'needOpenSinceCode',
    label: 'Depuis combien de temps ce besoin est-il ouvert ?',
    type: 'single',
    required: true,
    visibleIf: visibleWhen((answers) => typeof answers.familyCode === 'string' && answers.familyCode.length > 0),
    category: 'market',
    options: needOpenSinceOptions,
  },
  {
    id: 'salary_range_code',
    firestoreKey: 'salaryRangeCode',
    label: 'Quelle fourchette de rémunération envisagez-vous ?',
    type: 'single',
    required: false,
    visibleIf: visibleWhen((answers) => typeof answers.familyCode === 'string' && answers.familyCode.length > 0),
    category: 'market',
    options: salaryRangeOptions,
  },
  {
    id: 'hiring_channel_codes',
    firestoreKey: 'hiringChannelCodes',
    label: 'Quels canaux utilisez-vous actuellement pour recruter ?',
    description: 'Plusieurs réponses sont possibles.',
    type: 'multi',
    required: false,
    maxSelections: 5,
    visibleIf: visibleWhen((answers) => typeof answers.familyCode === 'string' && answers.familyCode.length > 0),
    category: 'market',
    options: companyHiringChannelOptions,
  },
  {
    id: 'ats_used',
    firestoreKey: 'atsUsed',
    label: 'Utilisez-vous déjà un ATS ?',
    type: 'yesno',
    required: false,
    visibleIf: visibleWhen((answers) => typeof answers.familyCode === 'string' && answers.familyCode.length > 0),
    category: 'qualification',
  },
  {
    id: 'hiring_blocker_codes',
    firestoreKey: 'hiringBlockerCodes',
    label: "Quels sont aujourd'hui vos principaux freins ?",
    description: 'Plusieurs réponses sont possibles.',
    type: 'multi',
    required: true,
    maxSelections: 5,
    visibleIf: visibleWhen((answers) => typeof answers.familyCode === 'string' && answers.familyCode.length > 0),
    category: 'barrier',
    options: companyBlockerOptions,
  },
  valueExpectationQuestion,
  marketMissingCodesQuestion,
  marketMissingOtherQuestion,
  improvementNoteQuestion,
];

const agencyQuestions: StudyQuestion[] = [
  sectorQuestion,
  activeZoneQuestion,
  activeZoneOtherQuestion,
  familyQuestion,
  {
    id: 'agency_frequent_role_codes',
    firestoreKey: 'agencyFrequentRoleCodes',
    label: 'Quels métiers recrutez-vous le plus souvent ?',
    description: 'Plusieurs réponses sont possibles.',
    type: 'multi',
    required: true,
    maxSelections: 5,
    visibleIf: visibleWhen((answers) => typeof answers.familyCode === 'string' && answers.familyCode.length > 0),
    category: 'qualification',
    options: roleOptions,
  },
  {
    id: 'agency_hardest_role_codes',
    firestoreKey: 'agencyHardestRoleCodes',
    label: 'Quels métiers sont les plus difficiles à sourcer ?',
    description: 'Plusieurs réponses sont possibles.',
    type: 'multi',
    required: false,
    maxSelections: 5,
    visibleIf: visibleWhen(
      (answers) => Array.isArray(answers.agencyFrequentRoleCodes) && answers.agencyFrequentRoleCodes.length > 0,
    ),
    category: 'barrier',
    options: roleOptions,
  },
  {
    id: 'monthly_volume_code',
    firestoreKey: 'monthlyVolumeCode',
    label: 'Quel volume de recrutements gérez-vous chaque mois ?',
    type: 'single',
    required: true,
    visibleIf: visibleWhen((answers) => typeof answers.familyCode === 'string' && answers.familyCode.length > 0),
    category: 'market',
    options: monthlyVolumeOptions,
  },
  {
    id: 'candidate_pool_size_code',
    firestoreKey: 'candidatePoolSizeCode',
    label: 'Quelle taille fait votre vivier de candidats ?',
    type: 'single',
    required: true,
    visibleIf: visibleWhen((answers) => typeof answers.familyCode === 'string' && answers.familyCode.length > 0),
    category: 'market',
    options: candidatePoolSizeOptions,
  },
  {
    id: 'agency_sourcing_channel_codes',
    firestoreKey: 'agencySourcingChannelCodes',
    label: 'Quels canaux utilisez-vous pour sourcer ?',
    description: 'Plusieurs réponses sont possibles.',
    type: 'multi',
    required: false,
    maxSelections: 5,
    visibleIf: visibleWhen((answers) => typeof answers.familyCode === 'string' && answers.familyCode.length > 0),
    category: 'market',
    options: agencySourcingChannelOptions,
  },
  {
    id: 'ats_used',
    firestoreKey: 'atsUsed',
    label: 'Utilisez-vous déjà un ATS ?',
    type: 'yesno',
    required: false,
    visibleIf: visibleWhen((answers) => typeof answers.familyCode === 'string' && answers.familyCode.length > 0),
    category: 'qualification',
  },
  {
    id: 'sourcing_blocker_codes',
    firestoreKey: 'sourcingBlockerCodes',
    label: "Quels sont aujourd'hui vos principaux freins ?",
    description: 'Plusieurs réponses sont possibles.',
    type: 'multi',
    required: true,
    maxSelections: 5,
    visibleIf: visibleWhen((answers) => typeof answers.familyCode === 'string' && answers.familyCode.length > 0),
    category: 'barrier',
    options: agencyBlockerOptions,
  },
  valueExpectationQuestion,
  marketMissingCodesQuestion,
  marketMissingOtherQuestion,
  improvementNoteQuestion,
];

export const studyQuestionnaires: Record<RespondentType, StudyQuestion[]> = {
  professional_available: professionalAvailableQuestions,
  professional_employed: professionalEmployedQuestions,
  company: companyQuestions,
  agency: agencyQuestions,
};

export const studyFinalQuestions: StudyQuestion[] = [
  {
    id: 'preferred_contact_channel',
    firestoreKey: 'preferredContactChannel',
    label: 'Quel canal de contact préférez-vous ?',
    type: 'single',
    required: true,
    category: 'contact',
    options: [
      { value: 'email', label: 'Email' },
      { value: 'phone', label: 'Téléphone' },
      { value: 'both', label: 'Les deux' },
      { value: 'no_preference', label: 'Pas de préférence' },
    ],
  },
  {
    id: 'feedback_note',
    firestoreKey: 'feedbackNote',
    label: 'Avez-vous une remarque, une attente ou une suggestion à nous partager ?',
    type: 'textarea',
    required: false,
    category: 'conversion',
    placeholder: 'Votre message',
  },
];

export function getVisibleQuestions(
  respondentType: RespondentType,
  answers: StudyAnswers,
): StudyQuestion[] {
  const context: StudyQuestionContext = { respondentType, answers };
  const branchQuestions = studyQuestionnaires[respondentType].filter((question) =>
    question.visibleIf ? question.visibleIf(context) : true,
  );

  return [...branchQuestions, ...studyFinalQuestions].filter((question) => !HIDDEN_COMPOSITE_QUESTION_IDS.has(question.id));
}

export function getQuestionAnswer(answers: StudyAnswers, question: StudyQuestion): StudyAnswers[string] {
  return answers[question.firestoreKey];
}

export function setQuestionAnswer(
  answers: StudyAnswers,
  question: StudyQuestion,
  value: StudyAnswers[string],
): StudyAnswers {
  return { ...answers, [question.firestoreKey]: value };
}

export function buildStudyAnswersPayload(
  respondentType: RespondentType,
  answers: StudyAnswers,
): StudyAnswers {
  const visibleQuestions = getVisibleQuestions(respondentType, answers);
  const payload: StudyAnswers = {};

  for (const question of visibleQuestions) {
    const value = answers[question.firestoreKey];
    const hasValue =
      (question.type === 'multi' && Array.isArray(value) && value.length > 0) ||
      (question.type === 'text' && typeof value === 'string' && value.trim().length > 0) ||
      (question.type === 'textarea' && typeof value === 'string' && value.trim().length > 0) ||
      (question.type === 'yesno' && typeof value === 'string' && value.trim().length > 0) ||
      (question.type === 'single' && typeof value === 'string' && value.trim().length > 0);

    if (hasValue) {
      payload[question.firestoreKey] = value;
    }
  }

  for (const firestoreKey of [
    'sectorCode',
    'activeZoneCode',
    'activeZoneOther',
    'familyCode',
    'currentRoleCode',
    'currentRoleOther',
    'targetRoleCode',
    'targetRoleCodes',
    'secondaryRoleCodes',
    'currentRecruitmentRoleCode',
    'currentRecruitmentRoleCodes',
    'hardestRecruitmentRoleCode',
    'hardestRecruitmentRoleCodes',
    'agencyFrequentRoleCode',
    'agencyFrequentRoleCodes',
    'agencyHardestRoleCodes',
  ]) {
    const value = answers[firestoreKey];
    const hasValue =
      (Array.isArray(value) && value.length > 0) ||
      (typeof value === 'string' && value.trim().length > 0);

    if (hasValue) {
      payload[firestoreKey] = value;
    }
  }

  return payload;
}

export function isQuestionAnswered(question: StudyQuestion, value: StudyAnswers[string]): boolean {
  if (question.type === 'multi') {
    return Array.isArray(value) && value.some((entry) => typeof entry === 'string' && entry.trim().length > 0);
  }

  if (question.type === 'text' || question.type === 'textarea') {
    return typeof value === 'string' && value.trim().length > 0;
  }

  return typeof value === 'string' && value.trim().length > 0;
}

