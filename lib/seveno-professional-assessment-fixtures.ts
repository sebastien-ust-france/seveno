import { Timestamp } from 'firebase/firestore';
import type {
  AssessmentDimensionCode,
  AssessmentDimensionDefinition,
  AssessmentEngineRequest,
  AssessmentInterpretationBlock,
  AssessmentQuestion,
  AssessmentQuestionOption,
  AssessmentResponse,
  AssessmentVersionDescriptor,
} from '@/types/seveno-assessment';

export const SEVENO_PROFESSIONAL_ASSESSMENT_FIXTURE_TAG = 'TEST_ONLY_FIXTURE_DO_NOT_PUBLISH' as const;
export const SEVENO_PROFESSIONAL_ASSESSMENT_FIXTURE_VERSION_ID = 'seveno-professional-assessment-test-only-1';
export const SEVENO_PROFESSIONAL_ASSESSMENT_FIXTURE_VERSION_CODE = 'seveno_professional_test_only';
export const SEVENO_PROFESSIONAL_ASSESSMENT_FIXTURE_VERSION_NUMBER = '1.0.0';
export const SEVENO_PROFESSIONAL_ASSESSMENT_FIXTURE_SESSION_ID = 'seveno-professional-assessment-test-session';

type DimensionConfig = {
  code: AssessmentDimensionCode;
  label: string;
  description: string;
  weight: number;
  displayOrder: number;
};

const DIMENSION_CONFIGS: DimensionConfig[] = [
  {
    code: 'information_understanding',
    label: 'Compréhension et intégration de l’information',
    description: 'Capacité à lire une consigne, extraire les éléments utiles et les relier correctement.',
    weight: 15,
    displayOrder: 1,
  },
  {
    code: 'organization_prioritization',
    label: 'Organisation et priorisation',
    description: 'Capacité à structurer son action, prioriser les tâches et garder un cap clair.',
    weight: 20,
    displayOrder: 2,
  },
  {
    code: 'problem_solving',
    label: 'Résolution de problèmes',
    description: 'Capacité à analyser une difficulté, tester des pistes et choisir une solution pertinente.',
    weight: 20,
    displayOrder: 3,
  },
  {
    code: 'autonomy_initiative',
    label: 'Autonomie et initiative',
    description: 'Capacité à agir sans assistance permanente et à proposer des actions utiles.',
    weight: 15,
    displayOrder: 4,
  },
  {
    code: 'adaptability',
    label: 'Adaptabilité',
    description: 'Capacité à ajuster sa méthode et son comportement selon le contexte.',
    weight: 10,
    displayOrder: 5,
  },
  {
    code: 'collaboration',
    label: 'Collaboration',
    description: 'Capacité à coopérer, partager l’information et contribuer à un objectif commun.',
    weight: 10,
    displayOrder: 6,
  },
  {
    code: 'rigor_reliability',
    label: 'Rigueur et fiabilité',
    description: 'Capacité à tenir un cadre, vérifier son travail et sécuriser les engagements.',
    weight: 10,
    displayOrder: 7,
  },
];

function timestamp(value: string) {
  return Timestamp.fromDate(new Date(value));
}

function buildThresholds(
  label: string,
  questionIds: readonly string[],
): AssessmentInterpretationBlock[] {
  return [
    {
      interpretationCode: `${label}-0-39`,
      minScore: 0,
      maxScore: 39,
      candidateSummary: `Les réponses indiquent une base encore irrégulière sur ${label.toLowerCase()}.`,
      companySummary: `Les réponses suggèrent un approfondissement utile sur ${label.toLowerCase()}.`,
      strengthLabel: 'À consolider',
      interviewFocus: `Approfondir ${label.toLowerCase()} lors de l’entretien.`,
      limitations: ['Lecture prudente recommandée sur cette dimension.'],
      interviewQuestionIds: [...questionIds],
    },
    {
      interpretationCode: `${label}-40-59`,
      minScore: 40,
      maxScore: 59,
      candidateSummary: `Les réponses montrent une base partielle à consolider sur ${label.toLowerCase()}.`,
      companySummary: `Les réponses suggèrent une base d’entretien prudente sur ${label.toLowerCase()}.`,
      strengthLabel: 'Base partielle',
      interviewFocus: `Clarifier les repères liés à ${label.toLowerCase()}.`,
      limitations: ['Les données disponibles restent partielles.'],
      interviewQuestionIds: [...questionIds],
    },
    {
      interpretationCode: `${label}-60-74`,
      minScore: 60,
      maxScore: 74,
      candidateSummary: `Les réponses indiquent une base fiable sur ${label.toLowerCase()}.`,
      companySummary: `Les réponses suggèrent une base exploitable en entretien sur ${label.toLowerCase()}.`,
      strengthLabel: 'Base fiable',
      interviewFocus: `Vérifier la solidité de ${label.toLowerCase()} dans des cas concrets.`,
      limitations: ['Cette lecture doit encore être confirmée par des exemples concrets.'],
      interviewQuestionIds: [...questionIds],
    },
    {
      interpretationCode: `${label}-75-89`,
      minScore: 75,
      maxScore: 89,
      candidateSummary: `Les réponses indiquent une maîtrise solide sur ${label.toLowerCase()}.`,
      companySummary: `Les réponses suggèrent un point d’appui solide sur ${label.toLowerCase()}.`,
      strengthLabel: 'Point d’appui solide',
      interviewFocus: `Appuyer l’entretien sur des situations exigeantes liées à ${label.toLowerCase()}.`,
      limitations: ['La cohérence doit encore être vérifiée en contexte.'],
      interviewQuestionIds: [...questionIds],
    },
    {
      interpretationCode: `${label}-90-100`,
      minScore: 90,
      maxScore: 100,
      candidateSummary: `Les réponses indiquent une très forte cohérence sur ${label.toLowerCase()}.`,
      companySummary: `Les réponses suggèrent un point d’appui marqué sur ${label.toLowerCase()}.`,
      strengthLabel: 'Point d’appui marqué',
      interviewFocus: `Confirmer la constance de ${label.toLowerCase()} sur des situations variées.`,
      limitations: ['Cette lecture reste une aide à l’entretien.'],
      interviewQuestionIds: [...questionIds],
    },
  ];
}

function buildQuestionOptions(
  questionCode: string,
  primaryDimensionCode: AssessmentDimensionCode,
  secondaryDimensionCode: AssessmentDimensionCode,
): AssessmentQuestionOption[] {
  return [
    {
      id: `${questionCode}-option-1`,
      label: 'Réponse A',
      position: 1,
      dimensionScores: {
        [primaryDimensionCode]: 0,
        [secondaryDimensionCode]: 1,
      },
      adminExplanation: 'Option de départ pour la lecture la plus prudente.',
    },
    {
      id: `${questionCode}-option-2`,
      label: 'Réponse B',
      position: 2,
      dimensionScores: {
        [primaryDimensionCode]: 2,
      },
      adminExplanation: 'Option montrant une contribution intermédiaire.',
    },
    {
      id: `${questionCode}-option-3`,
      label: 'Réponse C',
      position: 3,
      dimensionScores: {
        [primaryDimensionCode]: 3,
        [secondaryDimensionCode]: 2,
      },
      adminExplanation: 'Option montrant une contribution solide.',
    },
    {
      id: `${questionCode}-option-4`,
      label: 'Réponse D',
      position: 4,
      dimensionScores: {
        [primaryDimensionCode]: 4,
        [secondaryDimensionCode]: 3,
      },
      adminExplanation: 'Option montrant une contribution forte.',
    },
  ];
}

function buildQuestion(
  versionId: string,
  dimension: DimensionConfig,
  path: 'essential' | 'extended',
  position: number,
  questionIndex: number,
): AssessmentQuestion {
  const questionCode = `${dimension.code}-${path}-${questionIndex}`;
  const questionId = `${questionCode}-id`;
  const currentDimensionIndex = DIMENSION_CONFIGS.findIndex((item) => item.code === dimension.code);
  const secondaryDimensionCode = DIMENSION_CONFIGS[(currentDimensionIndex + 1) % DIMENSION_CONFIGS.length].code;

  return {
    id: questionId,
    code: questionCode,
    assessmentVersionId: versionId,
    path,
    position,
    situation: `Situation professionnelle ${position} pour ${dimension.label.toLowerCase()}.`,
    instruction: `Choisissez la réponse la plus pertinente pour illustrer ${dimension.label.toLowerCase()}.`,
    options: buildQuestionOptions(questionCode, dimension.code, secondaryDimensionCode),
    primaryDimensionCodes: [dimension.code],
    secondaryDimensionCodes: [secondaryDimensionCode],
    difficulty: path === 'essential' ? 'introductory' : 'standard',
    estimatedReadingSeconds: path === 'essential' ? 35 : 45,
    adminRationale: `Question de test pour la dimension ${dimension.label}.`,
    isActive: true,
  };
}

function buildDimensions(questions: AssessmentQuestion[]): AssessmentDimensionDefinition[] {
  return DIMENSION_CONFIGS.map((config) => {
    const dimensionQuestions = questions.filter((question) => question.primaryDimensionCodes.includes(config.code));
    const questionIds = dimensionQuestions.map((question) => question.id);
    return {
      code: config.code,
      label: config.label,
      description: config.description,
      weight: config.weight,
      displayOrder: config.displayOrder,
      minimumEssentialObservations: 2,
      minimumExtendedObservations: 3,
      interpretationThresholds: buildThresholds(config.label, questionIds),
      interviewQuestionIds: [...questionIds],
      isActive: true,
    };
  });
}

function buildQuestions(versionId: string) {
  const questions: AssessmentQuestion[] = [];
  let position = 1;

  for (const dimension of DIMENSION_CONFIGS) {
    questions.push(buildQuestion(versionId, dimension, 'essential', position, 1));
    position += 1;
    questions.push(buildQuestion(versionId, dimension, 'essential', position, 2));
    position += 1;
    questions.push(buildQuestion(versionId, dimension, 'extended', position, 1));
    position += 1;
  }

  return questions;
}

function buildResponses(
  questionIds: string[],
  sessionId: string,
  optionIndexesByQuestionId: Record<string, number>,
): AssessmentResponse[] {
  return questionIds.map((questionId, index) => {
    const optionIndex = optionIndexesByQuestionId[questionId] ?? 0;
    const questionCode = questionId.replace(/-id$/, '');
    return {
      questionId,
      optionId: `${questionCode}-option-${optionIndex + 1}`,
      answeredAt: timestamp(`2026-07-18T10:${String(index).padStart(2, '0')}:00.000Z`),
      responseOrder: index + 1,
      sessionId,
    };
  });
}

const VERSION_ID = SEVENO_PROFESSIONAL_ASSESSMENT_FIXTURE_VERSION_ID;
const QUESTIONS = buildQuestions(VERSION_ID);
const DIMENSIONS = buildDimensions(QUESTIONS);
const ESSENTIAL_QUESTION_IDS = QUESTIONS.filter((question) => question.path === 'essential').map((question) => question.id);
const EXTENDED_QUESTION_IDS = QUESTIONS.map((question) => question.id);
const INTERVIEW_QUESTION_CATALOG = Object.fromEntries(
  QUESTIONS.map((question) => [question.id, `Comment observer ${question.code} en entretien ?`] as const),
);

const ESSENTIAL_OPTION_PLAN: Partial<Record<AssessmentDimensionCode, [number, number]>> = {
  information_understanding: [3, 3],
  organization_prioritization: [3, 2],
  problem_solving: [3, 1],
  autonomy_initiative: [2, 1],
  adaptability: [2, 0],
  collaboration: [1, 1],
  rigor_reliability: [0, 0],
};

const EXTENDED_OPTION_PLAN: Partial<Record<AssessmentDimensionCode, [number, number, number]>> = {
  information_understanding: [3, 3, 2],
  organization_prioritization: [3, 2, 2],
  problem_solving: [3, 1, 1],
  autonomy_initiative: [2, 1, 1],
  adaptability: [2, 0, 1],
  collaboration: [1, 1, 2],
  rigor_reliability: [0, 0, 1],
};

function buildOptionPlanResponses(
  questionIds: string[],
  plan: Partial<Record<AssessmentDimensionCode, number[]>>,
  sessionId: string,
) {
  const optionIndexesByQuestionId: Record<string, number> = {};
  for (const dimension of DIMENSION_CONFIGS) {
    const dimensionQuestionIds = questionIds.filter((questionId) => questionId.startsWith(`${dimension.code}-`));
    const plannedOptionIndexes = plan[dimension.code] ?? [];
    dimensionQuestionIds.forEach((questionId, index) => {
      optionIndexesByQuestionId[questionId] = plannedOptionIndexes[index] ?? 0;
    });
  }

  return buildResponses(questionIds, sessionId, optionIndexesByQuestionId);
}

export const SEVENO_PROFESSIONAL_ASSESSMENT_TEST_ONLY_VERSION: AssessmentVersionDescriptor = {
  id: VERSION_ID,
  code: SEVENO_PROFESSIONAL_ASSESSMENT_FIXTURE_VERSION_CODE,
  version: SEVENO_PROFESSIONAL_ASSESSMENT_FIXTURE_VERSION_NUMBER,
  status: 'active',
  name: 'Socle technique Seven’O professionnel',
  description: 'Fixture de test seulement pour valider le modèle versionné Seven’O professionnel.',
  createdAt: timestamp('2026-07-18T09:00:00.000Z'),
  updatedAt: timestamp('2026-07-18T09:30:00.000Z'),
  publishedAt: timestamp('2026-07-18T09:30:00.000Z'),
  archivedAt: null,
  createdBy: 'test-only',
  dimensions: DIMENSIONS,
  questions: QUESTIONS,
  essentialQuestionCount: ESSENTIAL_QUESTION_IDS.length,
  extendedQuestionCount: QUESTIONS.filter((question) => question.path === 'extended').length,
  estimatedEssentialDurationMinutes: 12,
  estimatedExtendedDurationMinutes: 7,
  scoringEngineVersion: '1.0.0',
  interpretationEngineVersion: '1.0.0',
  legalNoticeVersion: 'test-only-legal-notice-v1',
  revisionNotes: [SEVENO_PROFESSIONAL_ASSESSMENT_FIXTURE_TAG],
  interviewQuestionCatalog: INTERVIEW_QUESTION_CATALOG,
};

export const SEVENO_PROFESSIONAL_ASSESSMENT_TEST_ONLY_REQUEST: AssessmentEngineRequest = {
  version: SEVENO_PROFESSIONAL_ASSESSMENT_TEST_ONLY_VERSION,
  completedPath: 'extended',
  questions: QUESTIONS,
  responses: buildOptionPlanResponses(EXTENDED_QUESTION_IDS, EXTENDED_OPTION_PLAN, SEVENO_PROFESSIONAL_ASSESSMENT_FIXTURE_SESSION_ID),
  completedAt: timestamp('2026-07-18T10:30:00.000Z'),
};

export const SEVENO_PROFESSIONAL_ASSESSMENT_TEST_ONLY_ESSENTIAL_REQUEST: AssessmentEngineRequest = {
  version: SEVENO_PROFESSIONAL_ASSESSMENT_TEST_ONLY_VERSION,
  completedPath: 'essential',
  questions: QUESTIONS,
  responses: buildOptionPlanResponses(ESSENTIAL_QUESTION_IDS, ESSENTIAL_OPTION_PLAN, `${SEVENO_PROFESSIONAL_ASSESSMENT_FIXTURE_SESSION_ID}-essential`),
  completedAt: timestamp('2026-07-18T10:15:00.000Z'),
};

export const SEVENO_PROFESSIONAL_ASSESSMENT_TEST_ONLY_INCOMPLETE_REQUEST: AssessmentEngineRequest = {
  ...SEVENO_PROFESSIONAL_ASSESSMENT_TEST_ONLY_REQUEST,
  responses: SEVENO_PROFESSIONAL_ASSESSMENT_TEST_ONLY_REQUEST.responses.slice(0, -1),
};
