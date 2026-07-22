import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  buildProfessionalAssessmentReport,
  projectAssessmentReportForCandidate,
  projectAssessmentReportForCompany,
  SEVENO_PROFESSIONAL_ASSESSMENT_DIMENSION_CODES,
  validateAssessmentVersion,
} from '@/lib/seveno-professional-assessment';
import {
  buildSevenoAssessmentReviewManifest,
  renderSevenoAssessmentReviewManifestMarkdown,
} from '@/lib/seveno-professional-assessment-review';
import {
  type AssessmentDimensionCode,
  type AssessmentDimensionDefinition,
  type AssessmentQuestion,
  type AssessmentQuestionOption,
  type AssessmentScoreValue,
  type AssessmentVersionDescriptor,
  type SevenoProfessionalAssessmentReport,
} from '@/types/seveno-assessment';
import type {
  SevenoAssessmentAutomatedCheckStatus,
  SevenoAssessmentHumanReviewStatus,
  SevenoAssessmentReviewChangeLogEntry,
  SevenoAssessmentReviewManifestSummary,
} from '@/types/seveno-assessment-review';

/**
 * TEST_ONLY_FIXTURE
 * DO_NOT_PUBLISH
 * NOT_PRODUCTION_CONTENT
 * NOT_AI_GENERATED_BANK
 */
type QuestionPath = 'essential' | 'extended';
type QuestionTone = 'clarify' | 'prioritize' | 'problem' | 'autonomy' | 'adaptability' | 'collaboration' | 'rigor';
type OptionRole = 'best' | 'balanced' | 'support' | 'offTrack';

const DIMENSION = {
  info: 'information_understanding',
  organization: 'organization_prioritization',
  problem: 'problem_solving',
  autonomy: 'autonomy_initiative',
  adaptability: 'adaptability',
  collaboration: 'collaboration',
  rigor: 'rigor_reliability',
} as const satisfies Record<string, AssessmentDimensionCode>;

interface QuestionContext {
  setting: string;
  issue: string;
  contact: string;
  action: string;
}

interface QuestionSpec {
  code: string;
  path: QuestionPath;
  position: number;
  tone: QuestionTone;
  primaryDimensionCodes: AssessmentDimensionCode[];
  secondaryDimensionCodes?: AssessmentDimensionCode[];
  context: QuestionContext;
}

interface QualityReport {
  versionName: string;
  versionNumber: string;
  draftStatus: string;
  automatedCheckStatus: SevenoAssessmentAutomatedCheckStatus;
  humanReviewStatusSummary: SevenoAssessmentReviewManifestSummary;
  pendingHumanReviewCount: number;
  reviewedWithChangesCount: number;
  approvedForPilotCount: number;
  rejectedCount: number;
  totalQuestions: number;
  essentialQuestionCount: number;
  extendedQuestionCount: number;
  mainDimensionDistribution: Record<AssessmentDimensionCode, number>;
  coverageByDimension: Record<AssessmentDimensionCode, number>;
  questionsWithOneOrTwoPrimaryDimensions: number;
  questionsWithSecondaryDimension: number;
  questionsWithThreeDimensions: number;
  contributionsByScore: Record<0 | 1 | 2 | 3 | 4, number>;
  highContributionPositionDistribution: Record<1 | 2 | 3 | 4, number>;
  averageSituationLength: number;
  averageOptionLength: number;
  shortQuestions: string[];
  longQuestions: string[];
  optionLengthImbalances: string[];
  exactDuplicates: string[];
  lexicalSimilarityFlags: string[];
  forbiddenTerms: string[];
  questionsWithoutCompromise: string[];
  questionsWithDominatingOption: string[];
  questionsWithAutomatedWarnings: string[];
  uniqueOptionFormulations: number;
  duplicateOptionSetCount: number;
  duplicateOptionSetQuestionCodes: string[];
  incoherentQuestionOptionScorePairs: string[];
  nearIdenticalQuestionPairs: string[];
  responsibleCodeSections: string[];
  interpretationBlocksCreated: number;
  interviewQuestionsCreated: number;
  documentBytes: number;
  documentKiB: number;
  documentUnder600KiB: boolean;
  notes: string[];
}

const DRAFT_CREATED_AT = '2026-07-19T09:30:00.000Z';
const DRAFT_UPDATED_AT = '2026-07-19T09:30:00.000Z';
const DRAFT_VERSION_ID = 'seveno-professional-assessment-v1-draft';
const DRAFT_VERSION_CODE = 'seveno_professional_assessment_v1_draft';
const DRAFT_VERSION_NUMBER = '1.0.0';
const DRAFT_STATUS = 'draft' as const;
const DRAFT_NAME = "Analyse professionnelle Seven'O — Première version de travail";
const DRAFT_DESCRIPTION = "Première banque complète de situations professionnelles comprenant un parcours essentiel et un parcours approfondi. Version destinée à la revue humaine et aux tests locaux. Ne pas publier.";
const DRAFT_REVISION_NOTES = [
  'DRAFT_ONLY',
  'DO_NOT_PUBLISH',
  'HUMAN_REVIEW_REQUIRED',
  'TEST_ONLY_FIXTURE',
  'NOT_PRODUCTION_CONTENT',
  'NOT_AI_GENERATED_BANK',
  'Banque initiale créée pour validation éditoriale, juridique, fonctionnelle et méthodologique. Aucun caractère scientifique ou psychométrique validé à ce stade.',
];

const DRAFT_REVIEW_CHANGE_LOG: SevenoAssessmentReviewChangeLogEntry[] = [
  {
    questionCode: 'essential_information_01',
    oldContent: 'Une dimension secondaire était conservée sur la version précédente.',
    newContent: 'La dimension secondaire a été retirée pour alléger la lecture du signal principal.',
    reason: "Réduire une corrélation artificielle entre la compréhension de l'information et la rigueur.",
    impactOnDimensions: 'La couverture reste assurée par les autres questions de la banque.',
    impactOnBarreme: 'Aucun changement de score, seulement une lecture plus claire.',
  },
  {
    questionCode: 'essential_problem_solving_01',
    oldContent: 'Une dimension secondaire était conservée sur la version précédente.',
    newContent: 'La dimension secondaire a été retirée pour garder la résolution de problèmes au premier plan.',
    reason: 'Alléger la question pour rendre la lecture plus nette.',
    impactOnDimensions: 'La couverture reste assurée sur le reste de la banque.',
    impactOnBarreme: 'Aucun changement de score, seulement une lecture plus lisible.',
  },
  {
    questionCode: 'essential_autonomy_01',
    oldContent: 'Une dimension secondaire était conservée sur la version précédente.',
    newContent: 'La dimension secondaire a été retirée pour garder l’initiative au centre.',
    reason: 'Limiter le mélange des signaux et conserver une question centrée sur l’autonomie.',
    impactOnDimensions: 'La couverture reste suffisante dans le reste de la banque.',
    impactOnBarreme: 'Aucun changement de score, seulement une réduction du bruit de corrélation.',
  },
  {
    questionCode: 'extended_organization_01',
    oldContent: 'Une dimension secondaire était conservée sur la version précédente.',
    newContent: 'La dimension secondaire a été retirée pour isoler davantage la priorisation.',
    reason: 'Mieux isoler la priorisation et la résolution de problèmes dans le parcours approfondi.',
    impactOnDimensions: 'La couverture reste au niveau attendu sur les autres questions.',
    impactOnBarreme: 'Aucun changement de score, seule la complexité secondaire diminue.',
  },
  {
    questionCode: 'extended_autonomy_01',
    oldContent: 'Une dimension secondaire était conservée sur la version précédente.',
    newContent: 'La dimension secondaire a été retirée pour conserver une lecture plus directe.',
    reason: "Conserver une question plus lisible sur l'autonomie et l'initiative sans surcharger le barème.",
    impactOnDimensions: 'La couverture reste suffisante.',
    impactOnBarreme: 'Aucun changement de score, uniquement une simplification de lecture.',
  },
  {
    questionCode: 'extended_autonomy_02',
    oldContent: 'Une dimension secondaire était conservée sur la version précédente.',
    newContent: 'La dimension secondaire a été retirée pour éviter un signal trop proche du contrôle.',
    reason: 'Privilégier la lecture autonomie / problème et éviter un signal de contrôle trop proche des questions de fiabilité.',
    impactOnDimensions: 'La couverture reste suffisante par ailleurs.',
    impactOnBarreme: 'Aucun changement de score, barème allégé.',
  },
  {
    questionCode: 'extended_organization_04',
    oldContent: 'Une dimension secondaire était conservée sur la version précédente.',
    newContent: 'La dimension secondaire a été retirée pour limiter la redondance.',
    reason: 'Limiter la redondance entre organisation et problème sur une question déjà très riche.',
    impactOnDimensions: 'La couverture reste au-dessus du minimum requis.',
    impactOnBarreme: 'Aucun changement de score, mais un meilleur isolement des signaux principaux.',
  },
];

const DIMENSIONS: AssessmentDimensionDefinition[] = [
  {
    code: DIMENSION.info,
    label: 'Compréhension et intégration de l’information',
    description: 'Capacité à lire une consigne, repérer les éléments utiles et vérifier ce qui manque avant d’agir.',
    weight: 15,
    displayOrder: 1,
    minimumEssentialObservations: 6,
    minimumExtendedObservations: 12,
    interpretationThresholds: [],
    interviewQuestionIds: [],
    isActive: true,
  },
  {
    code: DIMENSION.organization,
    label: 'Organisation et priorisation',
    description: 'Capacité à classer les tâches, gérer une urgence et garder un ordre d’action clair.',
    weight: 20,
    displayOrder: 2,
    minimumEssentialObservations: 6,
    minimumExtendedObservations: 12,
    interpretationThresholds: [],
    interviewQuestionIds: [],
    isActive: true,
  },
  {
    code: DIMENSION.problem,
    label: 'Résolution de problèmes',
    description: 'Capacité à repérer une difficulté, tester une piste et choisir une réponse réaliste.',
    weight: 20,
    displayOrder: 3,
    minimumEssentialObservations: 6,
    minimumExtendedObservations: 12,
    interpretationThresholds: [],
    interviewQuestionIds: [],
    isActive: true,
  },
  {
    code: DIMENSION.autonomy,
    label: 'Autonomie et initiative',
    description: 'Capacité à avancer dans un cadre défini, prendre des initiatives utiles et savoir alerter au bon moment.',
    weight: 15,
    displayOrder: 4,
    minimumEssentialObservations: 6,
    minimumExtendedObservations: 12,
    interpretationThresholds: [],
    interviewQuestionIds: [],
    isActive: true,
  },
  {
    code: DIMENSION.adaptability,
    label: 'Adaptabilité',
    description: 'Capacité à ajuster sa méthode, son rythme ou son organisation lorsque le contexte change.',
    weight: 10,
    displayOrder: 5,
    minimumEssentialObservations: 6,
    minimumExtendedObservations: 12,
    interpretationThresholds: [],
    interviewQuestionIds: [],
    isActive: true,
  },
  {
    code: DIMENSION.collaboration,
    label: 'Collaboration',
    description: 'Capacité à coopérer, partager l’information et coordonner son action avec les autres.',
    weight: 10,
    displayOrder: 6,
    minimumEssentialObservations: 6,
    minimumExtendedObservations: 12,
    interpretationThresholds: [],
    interviewQuestionIds: [],
    isActive: true,
  },
  {
    code: DIMENSION.rigor,
    label: 'Rigueur et fiabilité',
    description: 'Capacité à contrôler son travail, suivre une procédure et sécuriser les engagements.',
    weight: 10,
    displayOrder: 7,
    minimumEssentialObservations: 6,
    minimumExtendedObservations: 12,
    interpretationThresholds: [],
    interviewQuestionIds: [],
    isActive: true,
  },
];

const INTERVIEW_QUESTION_LIBRARY: Record<AssessmentDimensionCode, string[]> = {
  information_understanding: [
    'Pouvez-vous décrire une situation dans laquelle vous avez dû reprendre une consigne incomplète ?',
    'Comment vérifiez-vous que vous avez bien compris un message avant de commencer ?',
    'Racontez un cas où une information contradictoire vous a obligé à clarifier avant d’agir.',
  ],
  organization_prioritization: [
    'Comment vous organisez-vous lorsque plusieurs tâches urgentes arrivent en même temps ?',
    'Pouvez-vous décrire une période où vous avez dû revoir vos priorités dans la journée ?',
    'Comment décidez-vous de l’ordre d’action quand tout semble pressé ?',
  ],
  problem_solving: [
    'Parlez-nous d’un problème que vous avez résolu avec peu d’informations au départ.',
    'Comment procédez-vous quand une solution simple ne suffit pas ?',
    'Racontez une situation où vous avez identifié la cause probable d’un blocage.',
  ],
  autonomy_initiative: [
    'Pouvez-vous décrire une situation où vous avez pris une initiative utile dans un cadre défini ?',
    'Comment décidez-vous d’avancer seul ou de demander un arbitrage ?',
    'Racontez un cas où vous avez agi sans attendre tout en gardant votre responsable informé.',
  ],
  adaptability: [
    'Comment réagissez-vous quand l’organisation prévue change au dernier moment ?',
    'Pouvez-vous donner un exemple où vous avez dû adapter votre méthode de travail ?',
    'Comment gardez-vous votre efficacité lorsqu’un imprévu modifie votre plan ?',
  ],
  collaboration: [
    'Comment travaillez-vous quand une tâche doit être partagée avec un collègue ?',
    'Pouvez-vous décrire une situation où vous avez dû coordonner votre action avec une autre personne ?',
    'Comment faites-vous pour éviter qu’un manque d’information pénalise l’équipe ?',
  ],
  rigor_reliability: [
    'Comment vous assurez-vous qu’un contrôle important a bien été fait ?',
    'Pouvez-vous décrire une situation où vous avez repéré un point à sécuriser avant validation ?',
    'Comment gardez-vous une trace claire de ce que vous avez vérifié ?',
  ],
};

function createQuestionSpec(spec: QuestionSpec) {
  return spec;
}

const QUESTION_SPECS: QuestionSpec[] = [
  createQuestionSpec({
    code: 'essential_information_01',
    path: 'essential',
    position: 1,
    tone: 'clarify',
    primaryDimensionCodes: [DIMENSION.info],
    secondaryDimensionCodes: [DIMENSION.rigor],
    context: {
      setting: 'un poste de réception',
      issue: 'une consigne imprimée contredit le message oral de la veille',
      contact: 'un collègue vous presse de démarrer',
      action: 'la tournée de départ',
    },
  }),
  createQuestionSpec({
    code: 'essential_organization_01',
    path: 'essential',
    position: 2,
    tone: 'prioritize',
    primaryDimensionCodes: [DIMENSION.organization],
    secondaryDimensionCodes: [DIMENSION.collaboration],
    context: {
      setting: 'un atelier',
      issue: 'deux demandes urgentes arrivent en même temps',
      contact: 'votre responsable est occupé',
      action: "l'envoi avant midi",
    },
  }),
  createQuestionSpec({
    code: 'essential_problem_solving_01',
    path: 'essential',
    position: 3,
    tone: 'problem',
    primaryDimensionCodes: [DIMENSION.problem],
    secondaryDimensionCodes: [DIMENSION.adaptability],
    context: {
      setting: 'une ligne de production',
      issue: 'une fiche ne concorde pas avec les éléments visibles',
      contact: 'le poste de contrôle',
      action: 'la suite de la production',
    },
  }),
  createQuestionSpec({
    code: 'essential_autonomy_01',
    path: 'essential',
    position: 4,
    tone: 'autonomy',
    primaryDimensionCodes: [DIMENSION.autonomy],
    secondaryDimensionCodes: [DIMENSION.info],
    context: {
      setting: 'une tournée de service',
      issue: "une petite action utile n'est pas précisée dans le planning",
      contact: 'votre équipe',
      action: 'le relais de fin de tournée',
    },
  }),
  createQuestionSpec({
    code: 'essential_adaptability_01',
    path: 'essential',
    position: 5,
    tone: 'adaptability',
    primaryDimensionCodes: [DIMENSION.adaptability],
    secondaryDimensionCodes: [DIMENSION.organization],
    context: {
      setting: 'une prise de poste',
      issue: "le planning change parce qu'un collègue est absent",
      contact: 'les demandes déjà annoncées',
      action: 'la réorganisation du matin',
    },
  }),
  createQuestionSpec({
    code: 'essential_collaboration_01',
    path: 'essential',
    position: 6,
    tone: 'collaboration',
    primaryDimensionCodes: [DIMENSION.collaboration],
    secondaryDimensionCodes: [DIMENSION.autonomy],
    context: {
      setting: 'un dossier partagé',
      issue: 'un collègue a laissé des informations partielles',
      contact: 'le collègue sortant',
      action: 'la reprise du relais',
    },
  }),
  createQuestionSpec({
    code: 'essential_rigor_01',
    path: 'essential',
    position: 7,
    tone: 'rigor',
    primaryDimensionCodes: [DIMENSION.rigor, DIMENSION.collaboration],
    secondaryDimensionCodes: [DIMENSION.info],
    context: {
      setting: 'une validation de fin de journée',
      issue: 'un contrôle de base a été fait rapidement mais un point sensible reste à confirmer',
      contact: 'le collègue concerné',
      action: 'la trace de contrôle',
    },
  }),
  createQuestionSpec({
    code: 'essential_organization_02',
    path: 'essential',
    position: 8,
    tone: 'prioritize',
    primaryDimensionCodes: [DIMENSION.organization],
    secondaryDimensionCodes: [DIMENSION.problem],
    context: {
      setting: 'une zone de préparation',
      issue: 'trois tâches courtes et un client attendent déjà un retour',
      contact: 'une information supplémentaire arrive par téléphone',
      action: "l'ordre d'enchaînement",
    },
  }),
  createQuestionSpec({
    code: 'essential_information_02',
    path: 'essential',
    position: 9,
    tone: 'clarify',
    primaryDimensionCodes: [DIMENSION.info],
    secondaryDimensionCodes: [DIMENSION.adaptability],
    context: {
      setting: 'un mail opérationnel',
      issue: 'deux consignes semblent compatibles mais un détail change l’ordre des actions',
      contact: "l'expéditeur",
      action: 'la priorité du dossier',
    },
  }),
  createQuestionSpec({
    code: 'essential_problem_solving_02',
    path: 'essential',
    position: 10,
    tone: 'problem',
    primaryDimensionCodes: [DIMENSION.problem],
    secondaryDimensionCodes: [DIMENSION.rigor],
    context: {
      setting: 'un poste de contrôle',
      issue: "un point sensible peut revenir si le contrôle final n'est pas revu",
      contact: 'le référent qualité',
      action: 'la cause probable',
    },
  }),
  createQuestionSpec({
    code: 'essential_autonomy_02',
    path: 'essential',
    position: 11,
    tone: 'autonomy',
    primaryDimensionCodes: [DIMENSION.autonomy],
    secondaryDimensionCodes: [DIMENSION.collaboration],
    context: {
      setting: 'une ronde de surveillance',
      issue: "une action utile n'est pas encore attribuée",
      contact: 'votre responsable',
      action: 'le petit point de vigilance',
    },
  }),
  createQuestionSpec({
    code: 'essential_problem_solving_05',
    path: 'essential',
    position: 12,
    tone: 'problem',
    primaryDimensionCodes: [DIMENSION.problem],
    secondaryDimensionCodes: [DIMENSION.info],
    context: {
      setting: "un outil de saisie",
      issue: "un chiffre affiché ne correspond pas au terrain",
      contact: 'le document source',
      action: 'la correction',
    },
  }),
  createQuestionSpec({
    code: 'essential_collaboration_02',
    path: 'essential',
    position: 13,
    tone: 'collaboration',
    primaryDimensionCodes: [DIMENSION.collaboration, DIMENSION.autonomy],
    secondaryDimensionCodes: [DIMENSION.problem],
    context: {
      setting: 'une équipe en fin de poste',
      issue: "un collègue part avant d'avoir complété son passage",
      contact: 'le collègue suivant',
      action: 'la transmission des consignes',
    },
  }),
  createQuestionSpec({
    code: 'essential_organization_03',
    path: 'essential',
    position: 14,
    tone: 'prioritize',
    primaryDimensionCodes: [DIMENSION.organization],
    secondaryDimensionCodes: [DIMENSION.adaptability],
    context: {
      setting: "un service client",
      issue: 'un client modifie sa demande au moment où la journée est déjà structurée',
      contact: "l'équipe",
      action: 'la liste des priorités',
    },
  }),
  createQuestionSpec({
    code: 'essential_problem_solving_03',
    path: 'essential',
    position: 15,
    tone: 'problem',
    primaryDimensionCodes: [DIMENSION.problem],
    secondaryDimensionCodes: [DIMENSION.collaboration],
    context: {
      setting: 'une intervention',
      issue: 'une première correction ne suffit pas et le même écart peut revenir',
      contact: 'le support technique',
      action: 'la cause racine',
    },
  }),
  createQuestionSpec({
    code: 'essential_information_03',
    path: 'essential',
    position: 16,
    tone: 'clarify',
    primaryDimensionCodes: [DIMENSION.info],
    secondaryDimensionCodes: [DIMENSION.problem],
    context: {
      setting: 'un écran de production',
      issue: 'une instruction contient deux priorités en apparence compatibles',
      contact: 'la personne qui a rédigé la consigne',
      action: 'l’ordre exact des actions',
    },
  }),
  createQuestionSpec({
    code: 'essential_problem_solving_04',
    path: 'essential',
    position: 17,
    tone: 'problem',
    primaryDimensionCodes: [DIMENSION.problem],
    secondaryDimensionCodes: [DIMENSION.rigor],
    context: {
      setting: 'une fin de contrôle',
      issue: 'un point sensible peut réapparaître si l’on corrige trop vite',
      contact: 'le responsable qualité',
      action: 'la vérification finale',
    },
  }),
  createQuestionSpec({
    code: 'essential_organization_04',
    path: 'essential',
    position: 18,
    tone: 'prioritize',
    primaryDimensionCodes: [DIMENSION.organization, DIMENSION.problem],
    secondaryDimensionCodes: [DIMENSION.collaboration],
    context: {
      setting: 'une fin de journée',
      issue: 'une livraison, un contrôle et un échange restent à sécuriser',
      contact: "un collègue dispose d'informations différentes",
      action: 'l’ordre de clôture',
    },
  }),
  createQuestionSpec({
    code: 'essential_autonomy_03',
    path: 'essential',
    position: 19,
    tone: 'autonomy',
    primaryDimensionCodes: [DIMENSION.autonomy],
    secondaryDimensionCodes: [DIMENSION.problem],
    context: {
      setting: 'une tâche simple mais utile',
      issue: "vous êtes le seul disponible alors qu'un collègue compte sur un retour rapide",
      contact: 'le collègue concerné',
      action: 'le sujet simple',
    },
  }),
  createQuestionSpec({
    code: 'essential_rigor_02',
    path: 'essential',
    position: 20,
    tone: 'rigor',
    primaryDimensionCodes: [DIMENSION.rigor],
    secondaryDimensionCodes: [DIMENSION.info],
    context: {
      setting: 'un contrôle important',
      issue: 'un point sensible a été fait trop rapidement',
      contact: 'le collègue qui a validé la première passe',
      action: 'la preuve de conformité',
    },
  }),
  createQuestionSpec({
    code: 'extended_information_01',
    path: 'extended',
    position: 21,
    tone: 'clarify',
    primaryDimensionCodes: [DIMENSION.info],
    secondaryDimensionCodes: [DIMENSION.problem],
    context: {
      setting: 'une réunion de briefing',
      issue: 'un détail de procédure contredit la note reçue la veille',
      contact: 'le chef d’équipe',
      action: 'le départ de tournée',
    },
  }),
  createQuestionSpec({
    code: 'extended_organization_01',
    path: 'extended',
    position: 22,
    tone: 'prioritize',
    primaryDimensionCodes: [DIMENSION.organization],
    secondaryDimensionCodes: [DIMENSION.adaptability],
    context: {
      setting: "un planning d'atelier",
      issue: 'une urgence client et une tâche interne tombent ensemble',
      contact: "le chef d'atelier",
      action: "la préparation d'expédition",
    },
  }),
  createQuestionSpec({
    code: 'extended_problem_solving_01',
    path: 'extended',
    position: 23,
    tone: 'problem',
    primaryDimensionCodes: [DIMENSION.problem],
    secondaryDimensionCodes: [DIMENSION.rigor],
    context: {
      setting: "un poste d'assemblage",
      issue: "un écart apparaît entre l'affichage et la réalité du poste",
      contact: 'le référent',
      action: 'la correction immédiate',
    },
  }),
  createQuestionSpec({
    code: 'extended_autonomy_01',
    path: 'extended',
    position: 24,
    tone: 'autonomy',
    primaryDimensionCodes: [DIMENSION.autonomy],
    secondaryDimensionCodes: [DIMENSION.collaboration],
    context: {
      setting: 'une ronde de service',
      issue: "une action utile n'a pas été demandée explicitement",
      contact: "l'équipe en poste",
      action: 'le suivi de sécurité',
    },
  }),
  createQuestionSpec({
    code: 'extended_adaptability_01',
    path: 'extended',
    position: 25,
    tone: 'adaptability',
    primaryDimensionCodes: [DIMENSION.adaptability],
    secondaryDimensionCodes: [DIMENSION.organization],
    context: {
      setting: 'un démarrage de journée',
      issue: "un collègue absent oblige à réorganiser le planning",
      contact: 'les demandes du matin',
      action: 'la répartition des tâches',
    },
  }),
  createQuestionSpec({
    code: 'extended_collaboration_01',
    path: 'extended',
    position: 26,
    tone: 'collaboration',
    primaryDimensionCodes: [DIMENSION.collaboration],
    secondaryDimensionCodes: [DIMENSION.info],
    context: {
      setting: 'un dossier commun',
      issue: 'les informations reçues sont incomplètes au moment du relais',
      contact: 'le collègue sortant',
      action: 'la continuité du dossier',
    },
  }),
  createQuestionSpec({
    code: 'extended_rigor_01',
    path: 'extended',
    position: 27,
    tone: 'rigor',
    primaryDimensionCodes: [DIMENSION.rigor],
    secondaryDimensionCodes: [DIMENSION.autonomy],
    context: {
      setting: 'une clôture de service',
      issue: 'un contrôle rapide laisse un doute sur un point sensible',
      contact: 'le collègue qui part',
      action: 'la validation finale',
    },
  }),
  createQuestionSpec({
    code: 'extended_information_02',
    path: 'extended',
    position: 28,
    tone: 'clarify',
    primaryDimensionCodes: [DIMENSION.info],
    secondaryDimensionCodes: [DIMENSION.collaboration],
    context: {
      setting: 'un appel client',
      issue: 'le message reçu mélange deux priorités et un détail change l’ordre des actions',
      contact: "l'équipe précédente",
      action: 'la consigne à suivre',
    },
  }),
  createQuestionSpec({
    code: 'extended_organization_02',
    path: 'extended',
    position: 29,
    tone: 'prioritize',
    primaryDimensionCodes: [DIMENSION.organization],
    secondaryDimensionCodes: [DIMENSION.problem],
    context: {
      setting: 'une réception de marchandise',
      issue: 'plusieurs tâches arrivent en même temps et le transporteur attend',
      contact: "l'équipe logistique",
      action: 'le déchargement',
    },
  }),
  createQuestionSpec({
    code: 'extended_problem_solving_02',
    path: 'extended',
    position: 30,
    tone: 'problem',
    primaryDimensionCodes: [DIMENSION.problem],
    secondaryDimensionCodes: [DIMENSION.adaptability],
    context: {
      setting: 'une panne mineure',
      issue: 'un symptôme peut masquer la vraie cause',
      contact: 'la maintenance',
      action: 'la remise en route',
    },
  }),
  createQuestionSpec({
    code: 'extended_autonomy_02',
    path: 'extended',
    position: 31,
    tone: 'autonomy',
    primaryDimensionCodes: [DIMENSION.autonomy],
    secondaryDimensionCodes: [DIMENSION.rigor],
    context: {
      setting: 'un remplacement ponctuel',
      issue: 'vous pouvez avancer seul mais un point doit rester visible pour le manager',
      contact: 'votre responsable',
      action: 'la tâche de remplacement',
    },
  }),
  createQuestionSpec({
    code: 'extended_adaptability_02',
    path: 'extended',
    position: 32,
    tone: 'adaptability',
    primaryDimensionCodes: [DIMENSION.adaptability],
    secondaryDimensionCodes: [DIMENSION.collaboration],
    context: {
      setting: 'une journée de service',
      issue: 'le rythme prévu tombe à cause d’un imprévu',
      contact: "le reste de l'équipe",
      action: 'la réorganisation du flux',
    },
  }),
  createQuestionSpec({
    code: 'extended_collaboration_02',
    path: 'extended',
    position: 33,
    tone: 'collaboration',
    primaryDimensionCodes: [DIMENSION.collaboration, DIMENSION.problem],
    secondaryDimensionCodes: [DIMENSION.autonomy],
    context: {
      setting: 'une activité partagée',
      issue: 'un collègue vous demande de l’aide au moment où une autre tâche devient plus urgente',
      contact: 'le groupe',
      action: 'la répartition de l’effort',
    },
  }),
  createQuestionSpec({
    code: 'extended_rigor_02',
    path: 'extended',
    position: 34,
    tone: 'rigor',
    primaryDimensionCodes: [DIMENSION.rigor],
    secondaryDimensionCodes: [DIMENSION.info],
    context: {
      setting: 'une validation documentaire',
      issue: 'une fiche semble correcte mais reste à tracer avant diffusion',
      contact: 'le document de référence',
      action: 'la traçabilité finale',
    },
  }),
  createQuestionSpec({
    code: 'extended_information_03',
    path: 'extended',
    position: 35,
    tone: 'clarify',
    primaryDimensionCodes: [DIMENSION.info],
    secondaryDimensionCodes: [DIMENSION.rigor],
    context: {
      setting: 'un tableau de suivi',
      issue: 'une consigne écrite ne correspond pas à ce qui a été annoncé oralement',
      contact: 'la personne qui coordonne',
      action: 'la mise à jour du tableau',
    },
  }),
  createQuestionSpec({
    code: 'extended_organization_03',
    path: 'extended',
    position: 36,
    tone: 'prioritize',
    primaryDimensionCodes: [DIMENSION.organization],
    secondaryDimensionCodes: [DIMENSION.collaboration],
    context: {
      setting: 'un service de production',
      issue: 'un client change de besoin après que l’organisation du jour a été fixée',
      contact: "le chef d'équipe",
      action: 'la priorisation des tâches',
    },
  }),
  createQuestionSpec({
    code: 'extended_problem_solving_03',
    path: 'extended',
    position: 37,
    tone: 'problem',
    primaryDimensionCodes: [DIMENSION.problem],
    secondaryDimensionCodes: [DIMENSION.info],
    context: {
      setting: 'un dossier à reprendre',
      issue: 'une erreur corrigée une fois risque de revenir sans recherche de cause',
      contact: 'le supérieur direct',
      action: 'la reprise du contrôle',
    },
  }),
  createQuestionSpec({
    code: 'extended_autonomy_03',
    path: 'extended',
    position: 38,
    tone: 'autonomy',
    primaryDimensionCodes: [DIMENSION.autonomy],
    secondaryDimensionCodes: [DIMENSION.adaptability],
    context: {
      setting: 'un sujet simple mais utile',
      issue: 'vous êtes seul disponible mais un collègue attend un retour rapide',
      contact: 'le collègue demandeur',
      action: 'la décision locale',
    },
  }),
  createQuestionSpec({
    code: 'extended_adaptability_03',
    path: 'extended',
    position: 39,
    tone: 'adaptability',
    primaryDimensionCodes: [DIMENSION.adaptability],
    secondaryDimensionCodes: [DIMENSION.collaboration],
    context: {
      setting: 'un service sous tension',
      issue: 'une partie de l’équipe manque soudainement et le rythme prévu ne tient plus',
      contact: 'les collègues présents',
      action: 'la nouvelle organisation',
    },
  }),
  createQuestionSpec({
    code: 'extended_organization_04',
    path: 'extended',
    position: 40,
    tone: 'prioritize',
    primaryDimensionCodes: [DIMENSION.organization, DIMENSION.rigor],
    secondaryDimensionCodes: [DIMENSION.problem],
    context: {
      setting: 'une fin de journée de production',
      issue: 'il reste une livraison à sécuriser, un contrôle à tracer et un échange à finir',
      contact: "un collègue qui n'a pas les mêmes informations",
      action: 'l’ordre de clôture',
    },
  }),
];

function buildScorePattern(dimensions: AssessmentDimensionCode[], role: OptionRole) {
  if (dimensions.length === 3) {
    switch (role) {
      case 'best':
        return [4, 4, 3] as const;
      case 'balanced':
        return [3, 2, 4] as const;
      case 'support':
        return [2, 4, 3] as const;
      default:
        return [1, 1, 1] as const;
    }
  }

  if (dimensions.length === 2) {
    switch (role) {
      case 'best':
        return [4, 3] as const;
      case 'balanced':
        return [3, 2] as const;
      case 'support':
        return [2, 4] as const;
      default:
        return [1, 1] as const;
    }
  }

  switch (role) {
    case 'best':
      return [4] as const;
    case 'balanced':
      return [3] as const;
    case 'support':
      return [2] as const;
    default:
      return [1] as const;
  }
}

function buildDimensionScores(
  dimensions: AssessmentDimensionCode[],
  scores: readonly number[],
): Partial<Record<AssessmentDimensionCode, AssessmentScoreValue>> {
  return Object.fromEntries(
    dimensions.map((dimension, index) => [dimension, (scores[index] ?? 0) as AssessmentScoreValue]),
  ) as Partial<Record<AssessmentDimensionCode, AssessmentScoreValue>>;
}

function buildToneOptionFrames(
  tone: QuestionTone,
  context: QuestionContext,
): Array<{ role: OptionRole; label: string; adminExplanation: string }> {
  switch (tone) {
    case 'clarify':
      return [
        {
          role: 'best',
          label: `Je reformule ${context.issue} et je vérifie ${context.action} avant de commencer.`,
          adminExplanation: 'Sécurise l’information avant de démarrer et limite le risque de confusion.',
        },
        {
          role: 'balanced',
          label: 'Je commence par ce qui est certain puis je fais confirmer le point douteux.',
          adminExplanation: 'Avance prudemment mais garde une vérification partielle.',
        },
        {
          role: 'support',
          label: `Je demande un complément à ${context.contact} puis je complète la consigne.`,
          adminExplanation: 'Cherche un complément utile mais dépend d’un échange supplémentaire.',
        },
        {
          role: 'offTrack',
          label: `Je lance ${context.action} sans lever le doute, puis j’ajuste si le problème revient.`,
          adminExplanation: 'Expose un risque de départ sur une base incomplète.',
        },
      ];
    case 'prioritize':
      return [
        {
          role: 'best',
          label: `Je classe ${context.issue} et je traite d’abord ce qui bloque le flux.`,
          adminExplanation: 'Pose un ordre clair face à plusieurs urgences.',
        },
        {
          role: 'balanced',
          label: `Je vérifie les délais puis j’ajuste l’ordre de travail si nécessaire.`,
          adminExplanation: 'Reste organisé mais retarde un peu la décision immédiate.',
        },
        {
          role: 'support',
          label: `Je répartis l’effort avec ${context.contact} avant de lancer l’action.`,
          adminExplanation: 'Partage la charge mais peut ralentir l’arbitrage.',
        },
        {
          role: 'offTrack',
          label: 'Je garde le plan initial sans arbitrer tout de suite.',
          adminExplanation: 'Laisse l’urgence sans arbitrage clair.',
        },
      ];
    case 'problem':
      return [
        {
          role: 'best',
          label: 'Je compare les informations disponibles avant d’engager une correction.',
          adminExplanation: 'Identifie la cause avant de corriger.',
        },
        {
          role: 'balanced',
          label: `Je teste une première piste sur ${context.issue}.`,
          adminExplanation: 'Cherche une piste réaliste mais sans diagnostic complet.',
        },
        {
          role: 'support',
          label: 'Je sécurise la situation puis je propose une correction réaliste.',
          adminExplanation: 'Sécurise l’activité mais reste plus prudent que directif.',
        },
        {
          role: 'offTrack',
          label: `Je demande un avis si le blocage dépasse mon périmètre immédiat.`,
          adminExplanation: 'Évite l’action directe mais reporte complètement le diagnostic.',
        },
      ];
    case 'autonomy':
      return [
        {
          role: 'best',
          label: `Je prends l’initiative dans le cadre prévu et j’informe ${context.contact} ensuite.`,
          adminExplanation: 'Agit de façon autonome tout en gardant l’alerte juste.',
        },
        {
          role: 'balanced',
          label: 'Je fais ce que je peux tout de suite puis je signale le besoin d’arbitrage.',
          adminExplanation: 'Avance sans bloquer mais conserve une prudence utile.',
        },
        {
          role: 'support',
          label: `Je cherche une solution simple pour ${context.issue} sans attendre d’ordre.`,
          adminExplanation: 'Montre une initiative réelle mais encore peu structurée.',
        },
        {
          role: 'offTrack',
          label: `Je vérifie les limites de mon rôle avant d’avancer sur ${context.action}.`,
          adminExplanation: 'Peut devenir trop dépendant d’un ordre explicite.',
        },
      ];
    case 'adaptability':
      return [
        {
          role: 'best',
          label: `J’adapte ma méthode au changement et je garde le rythme de ${context.action}.`,
          adminExplanation: 'Réorganise l’effort sans perdre le fil du service.',
        },
        {
          role: 'balanced',
          label: 'Je réorganise mes priorités pour rester utile malgré l’imprévu.',
          adminExplanation: 'Reste souple mais de manière encore assez générale.',
        },
        {
          role: 'support',
          label: `Je propose un ajustement concret à ${context.contact}.`,
          adminExplanation: 'Ajuste concrètement mais dépend de la validation de l’équipe.',
        },
        {
          role: 'offTrack',
          label: 'Je prends le temps de comprendre l’impact du changement avant d’agir.',
          adminExplanation: 'Reste figé trop longtemps et retarde l’adaptation.',
        },
      ];
    case 'collaboration':
      return [
        {
          role: 'best',
          label: `Je partage l’information utile et je me coordonne avec ${context.contact}.`,
          adminExplanation: 'Garde le relais fluide et clarifie le partage d’information.',
        },
        {
          role: 'balanced',
          label: 'Je demande de l’aide si cela évite une erreur collective.',
          adminExplanation: 'Cherche la coopération mais reste centré sur la prévention du risque.',
        },
        {
          role: 'support',
          label: `Je répartis le relais pour garder la fluidité de ${context.action}.`,
          adminExplanation: 'Partage la charge mais reporte une partie de l’initiative.',
        },
        {
          role: 'offTrack',
          label: 'Je préviens les autres du blocage avant d’aller plus loin.',
          adminExplanation: 'Alerte utile mais trop passive pour faire avancer la situation.',
        },
      ];
    case 'rigor':
      return [
        {
          role: 'best',
          label: 'Je contrôle les éléments sensibles et je trace ce qui a été fait.',
          adminExplanation: 'Confirme le point sensible avant validation.',
        },
        {
          role: 'balanced',
          label: `Je vérifie le résultat avant validation, même si ${context.action} est serré.`,
          adminExplanation: 'Garde un contrôle utile mais avec une vigilance un peu moins structurée.',
        },
        {
          role: 'support',
          label: `Je m’assure que ${context.issue} est respectée à chaque étape.`,
          adminExplanation: 'Montre de la rigueur mais reste plus descriptif que vérificateur.',
        },
        {
          role: 'offTrack',
          label: 'Je reprends le point douteux pour éviter une erreur de sortie.',
          adminExplanation: 'Réagit au risque mais valide encore trop tôt le reste du contrôle.',
        },
      ];
    default:
      return [];
  }
}

function buildQuestionSituation(spec: QuestionSpec) {
  switch (spec.tone) {
    case 'clarify':
      return `En arrivant sur ${spec.context.setting}, ${spec.context.issue}. ${spec.context.contact} vous demande d’avancer pour sécuriser ${spec.context.action}.`;
    case 'prioritize':
      return `Dans ${spec.context.setting}, ${spec.context.issue}. ${spec.context.contact} est occupé et ${spec.context.action} doit partir avant la fin du créneau.`;
    case 'problem':
      return `Sur ${spec.context.setting}, ${spec.context.issue}. Si vous continuez sans vérifier, ${spec.context.action} risque de se répéter.`;
    case 'autonomy':
      return `Lors de ${spec.context.setting}, ${spec.context.issue}. Vous pouvez agir dans le cadre prévu si vous gardez ${spec.context.action} sous contrôle et informez ${spec.context.contact}.`;
    case 'adaptability':
      return `Au début de ${spec.context.setting}, ${spec.context.issue} change et il faut réorganiser ${spec.context.action} sans perdre le fil.`;
    case 'collaboration':
      return `Sur ${spec.context.setting}, ${spec.context.issue}. ${spec.context.contact} a laissé des informations partielles et ${spec.context.action} doit reprendre sans erreur.`;
    case 'rigor':
      return `Avant ${spec.context.setting}, ${spec.context.issue}. ${spec.context.contact} pense que ce n’est pas grave, mais ${spec.context.action} doit encore être sécurisé.`;
    default:
      return spec.context.issue;
  }
}

function buildQuestionInstruction(tone: QuestionTone) {
  switch (tone) {
    case 'clarify':
      return 'Quelle réaction privilégiez-vous ?';
    case 'prioritize':
      return 'Que faites-vous en premier ?';
    case 'problem':
      return 'Comment réagissez-vous ?';
    case 'autonomy':
      return 'Quelle option décrit le mieux votre réaction ?';
    case 'adaptability':
      return 'Comment vous adaptez-vous ?';
    case 'collaboration':
      return 'Que choisissez-vous de faire ?';
    case 'rigor':
      return 'Quelle réaction adoptez-vous ?';
    default:
      return 'Quelle réaction privilégiez-vous ?';
  }
}

function buildQuestionRationale(tone: QuestionTone, path: QuestionPath) {
  const prefix = {
    clarify: 'Lecture de consigne',
    prioritize: 'Priorisation professionnelle',
    problem: 'Résolution de difficulté',
    autonomy: 'Initiative encadrée',
    adaptability: 'Adaptation au changement',
    collaboration: 'Coordination collective',
    rigor: 'Contrôle de fiabilité',
  }[tone];

  return `${prefix}. ${path === 'essential' ? 'Parcours essentiel.' : 'Parcours approfondi.'}`;
}

function buildQuestionOptions(spec: QuestionSpec): AssessmentQuestionOption[] {
  const dimensions = [...spec.primaryDimensionCodes, ...(spec.secondaryDimensionCodes ?? [])];
  const frames = buildToneOptionFrames(spec.tone, spec.context);
  return frames.map((frame, index) => ({
    id: `${spec.code}-option-${index + 1}`,
    label: frame.label,
    position: index + 1,
    dimensionScores: buildDimensionScores(dimensions, buildScorePattern(dimensions, frame.role)),
    adminExplanation: frame.adminExplanation,
  }));
}

function buildQuestionFromSpec(spec: QuestionSpec): AssessmentQuestion {
  return {
    id: spec.code,
    code: spec.code,
    assessmentVersionId: DRAFT_VERSION_ID,
    path: spec.path,
    position: spec.position,
    situation: buildQuestionSituation(spec),
    instruction: buildQuestionInstruction(spec.tone),
    options: buildQuestionOptions(spec),
    primaryDimensionCodes: [...spec.primaryDimensionCodes],
    ...(spec.secondaryDimensionCodes?.length ? { secondaryDimensionCodes: [spec.secondaryDimensionCodes[0]!].filter(Boolean) } : {}),
    difficulty: spec.path === 'essential'
      ? (spec.tone === 'problem' || spec.tone === 'rigor' ? 'standard' : 'introductory')
      : (spec.tone === 'problem' || spec.tone === 'rigor' ? 'advanced' : 'standard'),
    estimatedReadingSeconds: spec.path === 'essential' ? 45 : 70,
    adminRationale: buildQuestionRationale(spec.tone, spec.path),
    isActive: true,
  };
}

function createDimensionThresholds(dimension: AssessmentDimensionDefinition) {
  const ranges = [
    { minScore: 0, maxScore: 24, strengthLabel: 'Point de vigilance' },
    { minScore: 25, maxScore: 49, strengthLabel: 'Base à consolider' },
    { minScore: 50, maxScore: 74, strengthLabel: 'Base fiable' },
    { minScore: 75, maxScore: 89, strengthLabel: 'Point d’appui solide' },
    { minScore: 90, maxScore: 100, strengthLabel: 'Point d’appui marqué' },
  ] as const;

  return ranges.map((range) => ({
    interpretationCode: `${dimension.code}_${String(range.minScore).padStart(2, '0')}_${String(range.maxScore).padStart(2, '0')}`,
    minScore: range.minScore,
    maxScore: range.maxScore,
    candidateSummary: `Vos réponses indiquent une lecture ${range.strengthLabel.toLowerCase()} sur ${dimension.label.toLowerCase()}.`,
    companySummary: `Les réponses suggèrent ${range.strengthLabel.toLowerCase()} sur ${dimension.label.toLowerCase()}.`,
    strengthLabel: range.strengthLabel,
    interviewFocus: `Explorer ${dimension.label.toLowerCase()} à travers des exemples concrets.`,
    limitations: ['Cette lecture doit encore être confirmée par des exemples concrets.'],
    interviewQuestionIds: [],
  }));
}

function buildVersionDimensions(questions: AssessmentQuestion[]) {
  const dimensionLookup = new Map(DIMENSIONS.map((dimension) => [dimension.code, dimension] as const));
  const questionIdsByDimension = new Map<AssessmentDimensionCode, string[]>();

  for (const dimension of DIMENSIONS) {
    questionIdsByDimension.set(dimension.code, []);
  }

  for (const question of questions) {
    const dimensionCodes = [...question.primaryDimensionCodes, ...(question.secondaryDimensionCodes ?? [])];
    for (const code of dimensionCodes) {
      const current = questionIdsByDimension.get(code);
      if (!current) {
        continue;
      }

      if (!current.includes(question.id)) {
        current.push(question.id);
      }
    }
  }

  return DIMENSIONS.map((dimension) => {
    const questionIds = questionIdsByDimension.get(dimension.code) ?? [];
    return {
      ...dimensionLookup.get(dimension.code)!,
      interpretationThresholds: createDimensionThresholds(dimension).map((threshold) => ({
        ...threshold,
        interviewQuestionIds: questionIds.slice(0, 3).length > 0
          ? questionIds.slice(0, 3)
          : threshold.interviewQuestionIds,
      })),
      interviewQuestionIds: questionIds.slice(0, 3),
    };
  });
}

function buildInterviewQuestionCatalog(questions: AssessmentQuestion[]) {
  const catalog: Record<string, string> = {};
  for (const dimension of DIMENSIONS) {
    const items = INTERVIEW_QUESTION_LIBRARY[dimension.code];
    for (let index = 0; index < items.length; index += 1) {
      catalog[`${dimension.code}_interview_${String(index + 1).padStart(2, '0')}`] = items[index]!;
    }
  }

  for (const question of questions) {
    catalog[question.id] = `Comment observer ${question.code} en entretien ?`;
  }

  return catalog;
}

export function buildSevenoAssessmentV1Draft() {
  const questions = QUESTION_SPECS.map((spec) => buildQuestionFromSpec(spec));
  const dimensions = buildVersionDimensions(questions);
  const version: AssessmentVersionDescriptor = {
    id: DRAFT_VERSION_ID,
    code: DRAFT_VERSION_CODE,
    version: DRAFT_VERSION_NUMBER,
    status: DRAFT_STATUS,
    name: DRAFT_NAME,
    description: DRAFT_DESCRIPTION,
    createdAt: new Date(DRAFT_CREATED_AT),
    updatedAt: new Date(DRAFT_UPDATED_AT),
    publishedAt: null,
    archivedAt: null,
    createdBy: 'phase-4c-content-builder',
    dimensions,
    questions,
    essentialQuestionCount: questions.filter((question) => question.path === 'essential').length,
    extendedQuestionCount: questions.filter((question) => question.path === 'extended').length,
    estimatedEssentialDurationMinutes: 16,
    estimatedExtendedDurationMinutes: 19,
    scoringEngineVersion: '1.0.0',
    interpretationEngineVersion: '1.0.0',
    legalNoticeVersion: 'seveno_professional_assessment_legal_notice_v1',
    revisionNotes: [...DRAFT_REVISION_NOTES],
    interviewQuestionCatalog: buildInterviewQuestionCatalog(questions),
  };

  assert.equal(version.questions.length, 40);
  assert.equal(version.essentialQuestionCount, 20);
  assert.equal(version.extendedQuestionCount, 20);

  return version;
}

function countMainDimensions(questions: AssessmentQuestion[]) {
  const counts = Object.fromEntries(SEVENO_PROFESSIONAL_ASSESSMENT_DIMENSION_CODES.map((code) => [code, 0])) as Record<AssessmentDimensionCode, number>;
  for (const question of questions) {
    const code = question.primaryDimensionCodes[0];
    if (code) {
      counts[code] += 1;
    }
  }
  return counts;
}

function countCoverage(questions: AssessmentQuestion[]) {
  const counts = Object.fromEntries(SEVENO_PROFESSIONAL_ASSESSMENT_DIMENSION_CODES.map((code) => [code, 0])) as Record<AssessmentDimensionCode, number>;
  for (const question of questions) {
    for (const code of [...question.primaryDimensionCodes, ...(question.secondaryDimensionCodes ?? [])]) {
      counts[code] += 1;
    }
  }
  return counts;
}

function countContributions(questions: AssessmentQuestion[]) {
  const counts = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 } as Record<0 | 1 | 2 | 3 | 4, number>;
  for (const question of questions) {
    for (const option of question.options) {
      for (const value of Object.values(option.dimensionScores)) {
        counts[value as 0 | 1 | 2 | 3 | 4] += 1;
      }
    }
  }
  return counts;
}

function average(value: number, divisor: number) {
  return divisor > 0 ? Number((value / divisor).toFixed(1)) : 0;
}

function questionWordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function optionWordCount(option: AssessmentQuestionOption) {
  return questionWordCount(option.label);
}

function countHighContributionPositionDistribution(questions: AssessmentQuestion[]) {
  const counts = { 1: 0, 2: 0, 3: 0, 4: 0 } as Record<1 | 2 | 3 | 4, number>;
  for (const question of questions) {
    const averages = question.options.map((option) => {
      const values = Object.values(option.dimensionScores) as number[];
      return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
    });
    const maxAverage = Math.max(...averages);
    const position = (averages.findIndex((value) => value === maxAverage) + 1) as 1 | 2 | 3 | 4;
    counts[position] += 1;
  }
  return counts;
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9]+/gi, ' ')
    .trim()
    .toLowerCase();
}

function normalizeOptionSet(question: AssessmentQuestion) {
  return question.options
    .map((option) => normalizeText(option.label))
    .sort((left, right) => left.localeCompare(right, 'fr-FR', { sensitivity: 'base' }))
    .join(' | ');
}

function scoreTotal(option: AssessmentQuestionOption) {
  return Object.values(option.dimensionScores).reduce((sum, value) => sum + Number(value || 0), 0);
}

function hasForbiddenTerm(text: string) {
  return /indice seven['’]o|score seven['’]o|verifi[eé] seven ?o/i.test(text);
}

function countTextSimilarity(left: string, right: string) {
  const leftWords = new Set(normalizeText(left).split(/\s+/).filter(Boolean));
  const rightWords = new Set(normalizeText(right).split(/\s+/).filter(Boolean));
  const intersection = [...leftWords].filter((word) => rightWords.has(word)).length;
  const union = new Set([...leftWords, ...rightWords]).size;
  return union > 0 ? intersection / union : 0;
}

function getQuestionDimensionCount(question: AssessmentQuestion) {
  return question.primaryDimensionCodes.length + (question.secondaryDimensionCodes?.length ?? 0);
}

export function analyzeSevenoAssessmentV1Draft(version: AssessmentVersionDescriptor): QualityReport {
  const questions = [...version.questions];
  const totalOptionCount = questions.reduce((sum, question) => sum + question.options.length, 0);
  const totalSituationWords = questions.reduce((sum, question) => sum + questionWordCount(question.situation), 0);
  const totalOptionWords = questions.reduce((sum, question) => sum + question.options.reduce((inner, option) => inner + optionWordCount(option), 0), 0);

  const exactDuplicates: string[] = [];
  const lexicalSimilarityFlags: string[] = [];
  for (let leftIndex = 0; leftIndex < questions.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < questions.length; rightIndex += 1) {
      const left = questions[leftIndex]!;
      const right = questions[rightIndex]!;
      if (left.situation.trim() === right.situation.trim()) {
        exactDuplicates.push(`${left.code} ↔ ${right.code}`);
      }

      const similarity = countTextSimilarity(left.situation, right.situation);
      if (similarity >= 0.72) {
        lexicalSimilarityFlags.push(`${left.code} ↔ ${right.code} (${Math.round(similarity * 100)}%)`);
      }
    }
  }

  const shortQuestions = questions.filter((question) => questionWordCount(question.situation) < 24).map((question) => question.code);
  const longQuestions = questions.filter((question) => questionWordCount(question.situation) > 85).map((question) => question.code);
  const optionLengthImbalances = questions
    .filter((question) => {
      const lengths = question.options.map((option) => optionWordCount(option));
      const max = Math.max(...lengths);
      const min = Math.min(...lengths);
      return max - min > 16;
    })
    .map((question) => question.code);

  const questionsWithoutCompromise = questions
    .filter((question) => {
      if (getQuestionDimensionCount(question) < 2) {
        return false;
      }

      const dimensions = [...question.primaryDimensionCodes, ...(question.secondaryDimensionCodes ?? [])];
      const hasTradeoff = question.options.some((leftOption, leftIndex) => question.options.some((rightOption, rightIndex) => {
        if (leftIndex >= rightIndex) {
          return false;
        }

        let leftBetter = false;
        let rightBetter = false;
        for (const dimension of dimensions) {
          const leftScore = leftOption.dimensionScores[dimension] ?? 0;
          const rightScore = rightOption.dimensionScores[dimension] ?? 0;
          if (leftScore > rightScore) {
            leftBetter = true;
          }
          if (leftScore < rightScore) {
            rightBetter = true;
          }
        }

        return leftBetter && rightBetter;
      }));
      return !hasTradeoff;
    })
    .map((question) => question.code);

  const questionsWithDominatingOption = questions
    .filter((question) => {
      if (getQuestionDimensionCount(question) < 2) {
        return false;
      }

      return question.options.some((option) => question.options.every((otherOption, otherIndex) => {
        if (otherOption === option) {
          return true;
        }

        let strictlyBetter = false;
        for (const dimension of [...question.primaryDimensionCodes, ...(question.secondaryDimensionCodes ?? [])]) {
          const left = option.dimensionScores[dimension] ?? 0;
          const right = otherOption.dimensionScores[dimension] ?? 0;
          if (left < right) {
            return false;
          }
          if (left > right) {
            strictlyBetter = true;
          }
        }

        return strictlyBetter;
      }));
    })
    .map((question) => question.code);

  const forbiddenTerms = questions.flatMap((question) => {
    const terms: string[] = [];
    const allText = `${question.situation} ${question.instruction} ${question.options.map((option) => option.label).join(' ')}`;
    if (hasForbiddenTerm(allText)) {
      terms.push(question.code);
    }
    return terms;
  });

  const uniqueOptionFormulations = new Set<string>();
  const duplicateOptionSetGroups = new Map<string, string[]>();
  const incoherentQuestionOptionScorePairs: string[] = [];

  for (const question of questions) {
    for (const option of question.options) {
      uniqueOptionFormulations.add(normalizeText(option.label));
    }

    const key = normalizeOptionSet(question);
    const group = duplicateOptionSetGroups.get(key) ?? [];
    group.push(question.code);
    duplicateOptionSetGroups.set(key, group);

    if (scoreTotal(question.options[0]!) < Math.max(...question.options.slice(1).map((option) => scoreTotal(option)))) {
      incoherentQuestionOptionScorePairs.push(question.code);
    }
  }

  const duplicateOptionSetQuestionCodes = [...duplicateOptionSetGroups.values()]
    .filter((group) => group.length > 1)
    .map((group) => group.join(' ↔ '));

  const questionsWithAutomatedWarnings = [...new Set([
    ...shortQuestions,
    ...longQuestions,
    ...optionLengthImbalances,
    ...exactDuplicates,
    ...lexicalSimilarityFlags,
    ...questionsWithoutCompromise,
    ...questionsWithDominatingOption,
    ...duplicateOptionSetQuestionCodes,
    ...incoherentQuestionOptionScorePairs,
  ])];
  const reviewManifest = buildSevenoAssessmentReviewManifest(version, {
    changeLog: DRAFT_REVIEW_CHANGE_LOG,
    generatedAt: DRAFT_UPDATED_AT,
  });

  const mainDimensionDistribution = countMainDimensions(questions);
  const coverageByDimension = countCoverage(questions);
  const contributionsByScore = countContributions(questions);
  const highContributionPositionDistribution = countHighContributionPositionDistribution(questions);
  const oneOrTwoPrimary = questions.filter((question) => question.primaryDimensionCodes.length >= 1 && question.primaryDimensionCodes.length <= 2).length;
  const withSecondary = questions.filter((question) => (question.secondaryDimensionCodes ?? []).length > 0).length;
  const withThreeDimensions = questions.filter((question) => getQuestionDimensionCount(question) === 3).length;
  const validation = validateAssessmentVersion(version, { mode: 'definition' });
  assert.equal(validation.valid, true, JSON.stringify(validation.issues, null, 2));

  const report: QualityReport = {
    versionName: version.name,
    versionNumber: version.version,
    draftStatus: version.status,
    totalQuestions: questions.length,
    essentialQuestionCount: questions.filter((question) => question.path === 'essential').length,
    extendedQuestionCount: questions.filter((question) => question.path === 'extended').length,
    mainDimensionDistribution,
    coverageByDimension,
    questionsWithOneOrTwoPrimaryDimensions: oneOrTwoPrimary,
    questionsWithSecondaryDimension: withSecondary,
    questionsWithThreeDimensions: withThreeDimensions,
    contributionsByScore,
    highContributionPositionDistribution,
    averageSituationLength: average(totalSituationWords, questions.length),
    averageOptionLength: average(totalOptionWords, totalOptionCount),
    shortQuestions,
    longQuestions,
    optionLengthImbalances,
    exactDuplicates,
    lexicalSimilarityFlags,
    forbiddenTerms,
    questionsWithoutCompromise,
    questionsWithDominatingOption,
    questionsWithAutomatedWarnings: [...new Set(questionsWithAutomatedWarnings)].sort(),
    uniqueOptionFormulations: uniqueOptionFormulations.size,
    duplicateOptionSetCount: duplicateOptionSetQuestionCodes.length,
    duplicateOptionSetQuestionCodes,
    incoherentQuestionOptionScorePairs,
    nearIdenticalQuestionPairs: lexicalSimilarityFlags.filter((item) => item.includes('essential') && item.includes('extended')),
    responsibleCodeSections: [
      'QUESTION_SPECS',
      'buildToneOptionFrames',
      'buildQuestionFromSpec',
      'analyzeSevenoAssessmentV1Draft',
      'buildSevenoAssessmentReviewManifest',
    ],
    automatedCheckStatus: reviewManifest.automatedCheckStatus,
    humanReviewStatusSummary: reviewManifest.humanReviewSummary,
    pendingHumanReviewCount: reviewManifest.humanReviewSummary.pendingHumanReviewCount,
    reviewedWithChangesCount: reviewManifest.humanReviewSummary.reviewedWithChangesCount,
    approvedForPilotCount: reviewManifest.humanReviewSummary.approvedForPilotCount,
    rejectedCount: reviewManifest.humanReviewSummary.rejectedCount,
    interpretationBlocksCreated: version.dimensions.reduce((sum, dimension) => sum + dimension.interpretationThresholds.length, 0),
    interviewQuestionsCreated: Object.keys(version.interviewQuestionCatalog ?? {}).length,
    documentBytes: Buffer.byteLength(JSON.stringify(version), 'utf8'),
    documentKiB: Number((Buffer.byteLength(JSON.stringify(version), 'utf8') / 1024).toFixed(1)),
    documentUnder600KiB: Buffer.byteLength(JSON.stringify(version), 'utf8') < 600 * 1024,
    notes: [
      'Le versioning technique reste en semver pour respecter le validateur Phase 2.',
      'Le contenu reste un brouillon local destiné à la revue humaine.',
    ],
  };

  return report;
}

export function renderQualityReportMarkdown(report: QualityReport) {
  const lines = [
    "# Revue de contenu Seven'O v1",
    '',
    `- Nom du brouillon: ${report.versionName}`,
    `- Version technique: ${report.versionNumber}`,
    `- Statut: ${report.draftStatus}`,
    `- Questions: ${report.totalQuestions} (${report.essentialQuestionCount} essentielles, ${report.extendedQuestionCount} approfondies)`,
    `- Couverture totale par dimension: ${Object.entries(report.coverageByDimension).map(([code, count]) => `${code}=${count}`).join(', ')}`,
    `- Répartition principale: ${Object.entries(report.mainDimensionDistribution).map(([code, count]) => `${code}=${count}`).join(', ')}`,
    `- Questions avec une ou deux dimensions principales: ${report.questionsWithOneOrTwoPrimaryDimensions}`,
    `- Questions avec dimension secondaire: ${report.questionsWithSecondaryDimension}`,
    `- Questions avec trois dimensions: ${report.questionsWithThreeDimensions}`,
    `- Contributions 0 à 4: ${Object.entries(report.contributionsByScore).map(([score, count]) => `${score}=${count}`).join(', ')}`,
    `- Répartition des meilleures contributions par position: ${Object.entries(report.highContributionPositionDistribution).map(([position, count]) => `${position}=${count}`).join(', ')}`,
    `- Longueur moyenne des situations: ${report.averageSituationLength}`,
    `- Longueur moyenne des options: ${report.averageOptionLength}`,
    `- Formulations d’options uniques: ${report.uniqueOptionFormulations}`,
    `- Groupes d’options dupliqués: ${report.duplicateOptionSetCount}`,
    `- Paquets score/texte incohérents: ${report.incoherentQuestionOptionScorePairs.length}`,
    `- Similarité lexicale forte: ${report.lexicalSimilarityFlags.length}`,
    `- Questions trop courtes: ${report.shortQuestions.length}`,
    `- Questions trop longues: ${report.longQuestions.length}`,
    `- Déséquilibres de longueur des options: ${report.optionLengthImbalances.length}`,
    `- Doublons exacts: ${report.exactDuplicates.length}`,
    `- Mots interdits: ${report.forbiddenTerms.length}`,
    `- Questions sans compromis réel: ${report.questionsWithoutCompromise.length}`,
    `- Questions dominées par une option unique: ${report.questionsWithDominatingOption.length}`,
    `- Contrôle automatique global: ${report.automatedCheckStatus}`,
    `- Revue humaine: ${report.pendingHumanReviewCount}/${report.totalQuestions} questions en attente de relecture`,
    `- Questions avec avertissements automatiques: ${report.questionsWithAutomatedWarnings.length}`,
    `- Questions d’entretien créées: ${report.interviewQuestionsCreated}`,
    `- Taille du document: ${report.documentKiB} KiB`,
    `- Sous 600 KiB: ${report.documentUnder600KiB ? 'oui' : 'non'}`,
    '',
    '## Sections responsables',
    ...report.responsibleCodeSections.map((section) => `- ${section}`),
    '',
    '## Notes',
    ...report.notes.map((note) => `- ${note}`),
  ];

  return lines.join('\n');
}

export function writeSevenoAssessmentV1DraftFiles() {
  const draft = buildSevenoAssessmentV1Draft();
  const report = analyzeSevenoAssessmentV1Draft(draft);
  const reviewManifest = buildSevenoAssessmentReviewManifest(draft, {
    changeLog: DRAFT_REVIEW_CHANGE_LOG,
    generatedAt: DRAFT_UPDATED_AT,
  });
  const root = process.cwd();
  const draftPath = resolve(root, 'scripts/data/seveno-professional-assessment-v1-draft.json');
  const reportPath = resolve(root, 'docs/seveno-assessment-v1-content-review.md');
  const reviewManifestPath = resolve(root, 'scripts/data/seveno-professional-assessment-v1-review.json');
  const reviewReportPath = resolve(root, 'docs/seveno-assessment-v1-human-review.md');

  mkdirSync(resolve(root, 'scripts/data'), { recursive: true });
  mkdirSync(resolve(root, 'docs'), { recursive: true });
  writeFileSync(draftPath, `${JSON.stringify(draft, null, 2)}\n`, 'utf8');
  writeFileSync(reportPath, `${renderQualityReportMarkdown(report)}\n`, 'utf8');
  writeFileSync(reviewManifestPath, `${JSON.stringify(reviewManifest, null, 2)}\n`, 'utf8');
  writeFileSync(reviewReportPath, `${renderSevenoAssessmentReviewManifestMarkdown(reviewManifest)}\n`, 'utf8');

  return {
    draft,
    report,
    reviewManifest,
    draftPath,
    reportPath,
    reviewManifestPath,
    reviewReportPath,
    candidateProjection: projectAssessmentReportForCandidate(buildProfessionalAssessmentReportFromDraft(draft)),
    companyProjection: projectAssessmentReportForCompany(buildProfessionalAssessmentReportFromDraft(draft)),
  };
}

function buildProfessionalAssessmentReportFromDraft(version: AssessmentVersionDescriptor): SevenoProfessionalAssessmentReport {
  const responses = version.questions.map((question, index) => {
    const optionIndex = index % question.options.length;
    return {
      questionId: question.id,
      optionId: question.options[optionIndex]!.id,
      answeredAt: new Date(new Date(DRAFT_CREATED_AT).getTime() + (index + 1) * 60000),
      responseOrder: index + 1,
      sessionId: `${version.id}-preview-session`,
    };
  });

  return buildProfessionalAssessmentReport({
    version,
    completedPath: 'extended',
    questions: version.questions,
    responses,
    completedAt: new Date(DRAFT_UPDATED_AT),
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { draft, report } = writeSevenoAssessmentV1DraftFiles();
  console.log(JSON.stringify({
    draftId: draft.id,
    version: draft.version,
    questions: draft.questions.length,
    report: {
      documentKiB: report.documentKiB,
      automatedCheckStatus: report.automatedCheckStatus,
      humanReviewAccepted: report.humanReviewStatusSummary.approvedForPilot,
      questionsWithAutomatedWarnings: report.questionsWithAutomatedWarnings.length,
    },
  }, null, 2));
}
