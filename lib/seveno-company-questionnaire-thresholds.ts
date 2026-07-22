import type { SerializedCandidateJobApplication } from '@/types/seveno-job-applications';
import type { CompanyQuestionnaireScoreClassification } from '@/types/seveno-company-questionnaires';
import {
  COMPANY_QUESTIONNAIRE_MINIMUM_PASSING_SCORE_PERCENT_DEFAULT,
  COMPANY_QUESTIONNAIRE_NEAR_THRESHOLD_MARGIN_POINTS,
  COMPANY_QUESTIONNAIRE_MINIMUM_PASSING_SCORE_PERCENT_VALUES,
} from '@/lib/seveno-company-questionnaire-constants';

export type QuestionnaireScoreAudience = 'company' | 'candidate';

export interface QuestionnaireScoreSummary {
  classification: CompanyQuestionnaireScoreClassification;
  label: string;
  scoreLabel: string;
  thresholdLabel: string;
  note: string;
}

export interface CompanyQuestionnairePrioritySelectionItem {
  application: SerializedCandidateJobApplication;
  scorePercent: number;
  classification: CompanyQuestionnaireScoreClassification;
}

export interface CompanyQuestionnairePrioritySelection {
  applications: CompanyQuestionnairePrioritySelectionItem[];
  qualifiedCount: number;
  nearThresholdCount: number;
  eligibleCount: number;
}

function roundPercent(value: number) {
  return Math.round(value);
}

export function normalizeQuestionnaireMinimumPassingScorePercent(
  raw: unknown,
  fallback: number | null | undefined = undefined,
) {
  if (raw === null || raw === undefined || raw === '') {
    if (
      typeof fallback === 'number'
      && Number.isFinite(fallback)
      && COMPANY_QUESTIONNAIRE_MINIMUM_PASSING_SCORE_PERCENT_VALUES.includes(
        fallback as typeof COMPANY_QUESTIONNAIRE_MINIMUM_PASSING_SCORE_PERCENT_VALUES[number],
      )
    ) {
      return fallback;
    }
    return COMPANY_QUESTIONNAIRE_MINIMUM_PASSING_SCORE_PERCENT_DEFAULT;
  }

  if (
    typeof raw === 'number'
    && Number.isFinite(raw)
    && COMPANY_QUESTIONNAIRE_MINIMUM_PASSING_SCORE_PERCENT_VALUES.includes(
      raw as typeof COMPANY_QUESTIONNAIRE_MINIMUM_PASSING_SCORE_PERCENT_VALUES[number],
    )
  ) {
    return raw;
  }

  throw new Error('Le seuil minimum doit etre compris entre 50 et 100 par paliers de 5.');
}

function getScorePercent(application: SerializedCandidateJobApplication) {
  const assessment = application.companyAssessment;
  const score = assessment?.finalScore ?? assessment?.automaticScorePercent ?? null;
  return typeof score === 'number' && Number.isFinite(score) ? score : null;
}

function getMinimumPassingScorePercent(application: SerializedCandidateJobApplication) {
  const threshold = application.companyAssessment?.minimumPassingScorePercent;
  return typeof threshold === 'number' && Number.isFinite(threshold)
    ? threshold
    : COMPANY_QUESTIONNAIRE_MINIMUM_PASSING_SCORE_PERCENT_DEFAULT;
}

export function classifyQuestionnaireScore(
  scorePercent: number | null,
  minimumPassingScorePercent: number | null,
): CompanyQuestionnaireScoreClassification | null {
  if (typeof scorePercent !== 'number' || !Number.isFinite(scorePercent)) {
    return null;
  }
  if (typeof minimumPassingScorePercent !== 'number' || !Number.isFinite(minimumPassingScorePercent)) {
    return null;
  }

  if (scorePercent >= minimumPassingScorePercent) {
    return 'qualified';
  }
  if (scorePercent >= minimumPassingScorePercent - COMPANY_QUESTIONNAIRE_NEAR_THRESHOLD_MARGIN_POINTS) {
    return 'near_threshold';
  }
  return 'below_threshold';
}

export function formatQuestionnaireScoreLabel(
  classification: CompanyQuestionnaireScoreClassification | null,
  audience: QuestionnaireScoreAudience,
) {
  if (classification === 'qualified') {
    return audience === 'candidate'
      ? 'Score minimum atteint'
      : 'Seuil atteint';
  }
  if (classification === 'near_threshold') {
    return audience === 'candidate'
      ? 'Vous êtes proche du score minimum demandé'
      : 'Proche du résultat attendu';
  }
  if (classification === 'below_threshold') {
    return audience === 'candidate'
      ? 'Score inférieur au minimum demandé'
      : 'Sous le seuil attendu';
  }
  return audience === 'candidate'
    ? 'Score en attente'
    : 'Résultat en attente';
}

export function buildQuestionnaireScoreSummary(
  scorePercent: number | null,
  minimumPassingScorePercent: number | null,
  audience: QuestionnaireScoreAudience,
): QuestionnaireScoreSummary | null {
  const classification = classifyQuestionnaireScore(scorePercent, minimumPassingScorePercent);
  if (!classification || typeof scorePercent !== 'number' || !Number.isFinite(scorePercent)) {
    return null;
  }

  const threshold = typeof minimumPassingScorePercent === 'number' && Number.isFinite(minimumPassingScorePercent)
    ? minimumPassingScorePercent
    : COMPANY_QUESTIONNAIRE_MINIMUM_PASSING_SCORE_PERCENT_DEFAULT;

  return {
    classification,
    label: formatQuestionnaireScoreLabel(classification, audience),
    scoreLabel: `Score : ${roundPercent(scorePercent)} %`,
    thresholdLabel: `Seuil minimum : ${threshold} %`,
    note: audience === 'candidate'
      ? "L'entreprise reste décisionnaire de la suite donnée à la candidature."
      : classification === 'qualified'
        ? 'Le profil atteint le seuil configuré.'
        : classification === 'near_threshold'
          ? 'Le profil est proche du seuil configuré.'
          : 'Le profil reste sous le seuil configuré.',
  };
}

function getComparisonDate(application: SerializedCandidateJobApplication) {
  return application.companyAssessment?.completedAt
    ?? application.companyAssessment?.submittedAt
    ?? application.submittedAt
    ?? application.updatedAt
    ?? '';
}

export function selectCompanyQuestionnairePriorityApplications(
  applications: SerializedCandidateJobApplication[],
  maximum = 5,
): CompanyQuestionnairePrioritySelection {
  const decorated = applications.map((application) => {
    const scorePercent = getScorePercent(application);
    const minimumPassingScorePercent = getMinimumPassingScorePercent(application);
    const classification = classifyQuestionnaireScore(scorePercent, minimumPassingScorePercent);
    return {
      application,
      scorePercent,
      minimumPassingScorePercent,
      classification,
      comparisonDate: getComparisonDate(application),
    };
  }).filter((item) => item.classification === 'qualified' || item.classification === 'near_threshold');

  decorated.sort((left, right) => {
    const classificationRank = (classification: CompanyQuestionnaireScoreClassification) => (
      classification === 'qualified' ? 0 : 1
    );
    const leftRank = classificationRank(left.classification as CompanyQuestionnaireScoreClassification);
    const rightRank = classificationRank(right.classification as CompanyQuestionnaireScoreClassification);
    if (leftRank !== rightRank) return leftRank - rightRank;

    const leftScore = left.scorePercent ?? Number.NEGATIVE_INFINITY;
    const rightScore = right.scorePercent ?? Number.NEGATIVE_INFINITY;
    if (rightScore !== leftScore) {
      return rightScore - leftScore;
    }

    const leftDate = left.comparisonDate ? Date.parse(left.comparisonDate) : Number.POSITIVE_INFINITY;
    const rightDate = right.comparisonDate ? Date.parse(right.comparisonDate) : Number.POSITIVE_INFINITY;
    if (leftDate !== rightDate) {
      return leftDate - rightDate;
    }

    return left.application.id.localeCompare(right.application.id);
  });

  const qualifiedCount = decorated.filter((item) => item.classification === 'qualified').length;
  const nearThresholdCount = decorated.filter((item) => item.classification === 'near_threshold').length;

  return {
    applications: decorated.slice(0, maximum).map((item) => ({
      application: item.application,
      scorePercent: item.scorePercent ?? 0,
      classification: item.classification as CompanyQuestionnaireScoreClassification,
    })),
    qualifiedCount,
    nearThresholdCount,
    eligibleCount: decorated.length,
  };
}
