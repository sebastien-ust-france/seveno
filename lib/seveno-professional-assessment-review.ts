import type { AssessmentQuestion, AssessmentVersionDescriptor, AssessmentValidationIssue } from '@/types/seveno-assessment';
import type {
  SevenoAssessmentAutomatedCheckStatus,
  SevenoAssessmentHumanReviewStatus,
  SevenoAssessmentReviewChangeLogEntry,
  SevenoAssessmentReviewManifest,
  SevenoAssessmentReviewSeries,
  SevenoAssessmentReviewQuestionRecord,
} from '@/types/seveno-assessment-review';
import { validateAssessmentQuestion } from '@/lib/seveno-professional-assessment';

function getAutomatedStatus(issues: AssessmentValidationIssue[]): SevenoAssessmentAutomatedCheckStatus {
  if (issues.some((issue) => issue.severity === 'error')) {
    return 'failed';
  }

  if (issues.some((issue) => issue.severity === 'warning')) {
    return 'warning';
  }

  return 'passed';
}

function buildQuestionReviewRecord(
  version: AssessmentVersionDescriptor,
  question: AssessmentQuestion,
  changeLog: SevenoAssessmentReviewChangeLogEntry[],
): SevenoAssessmentReviewQuestionRecord {
  const issues = validateAssessmentQuestion(question, version).issues;
  const automatedCheckStatus = getAutomatedStatus(issues);
  const humanReviewStatus = question.humanReviewStatus ?? 'pending';
  const secondaryDimensionCode = question.secondaryDimensionCodes?.[0] ?? null;
  const sortedIssues = issues
    .map((issue) => `${issue.severity.toUpperCase()}: ${issue.message}`)
    .sort((left, right) => left.localeCompare(right, 'fr-FR', { sensitivity: 'base' }));

  const questionChangeLog = changeLog.filter((entry) => entry.questionCode === question.code);

  return {
    questionId: question.id,
    code: question.code,
    path: question.path,
    situation: question.situation,
    instruction: question.instruction,
    primaryDimensionCodes: [...question.primaryDimensionCodes],
    ...(secondaryDimensionCode ? { secondaryDimensionCode } : {}),
    options: question.options.map((option) => ({
      id: option.id,
      label: option.label,
      order: option.position,
      dimensionScores: { ...option.dimensionScores },
      adminExplanation: option.adminExplanation,
    })),
    scoringScale: '0-4',
    justificationAdministrateur: question.adminRationale,
    automatedCheckStatus,
    humanReviewStatus,
    reviewComments: [
      'Relecture humaine requise avant toute acceptation pour pilote.',
      ...(sortedIssues.length > 0 ? sortedIssues : ['Contrôle automatique sans alerte.']),
    ],
    proposedCorrections: questionChangeLog.length > 0
      ? questionChangeLog.map((entry) => `${entry.reason} (${entry.impactOnDimensions})`)
      : [],
    decisionFinal: humanReviewStatus,
  };
}

function buildHumanReviewSummary(questions: SevenoAssessmentReviewQuestionRecord[]) {
  const summary = {
    totalQuestions: questions.length,
    pending: 0,
    reviewedWithChanges: 0,
    approvedForPilot: 0,
    rejected: 0,
    pendingHumanReviewCount: 0,
    reviewedWithChangesCount: 0,
    approvedForPilotCount: 0,
    rejectedCount: 0,
  };

  for (const question of questions) {
    switch (question.humanReviewStatus) {
      case 'pending':
        summary.pending += 1;
        summary.pendingHumanReviewCount += 1;
        break;
      case 'reviewed_with_changes':
        summary.reviewedWithChanges += 1;
        summary.reviewedWithChangesCount += 1;
        break;
      case 'approved_for_pilot':
        summary.approvedForPilot += 1;
        summary.approvedForPilotCount += 1;
        break;
      case 'rejected':
        summary.rejected += 1;
        summary.rejectedCount += 1;
        break;
      default:
        break;
    }
  }

  return summary;
}

function buildReviewSeries(questions: SevenoAssessmentReviewQuestionRecord[]) {
  const series: SevenoAssessmentReviewSeries[] = [];

  for (let index = 0; index < questions.length; index += 5) {
    const group = questions.slice(index, index + 5);
    if (group.length === 0) {
      continue;
    }

    const firstQuestion = group[0]!;
    const lastQuestion = group[group.length - 1]!;
    series.push({
      seriesNumber: series.length + 1,
      title: `Série ${series.length + 1} (${firstQuestion.path === lastQuestion.path ? firstQuestion.path : `${firstQuestion.path} → ${lastQuestion.path}`})`,
      questionCodes: group.map((question) => question.code),
      questions: group,
    });
  }

  return series;
}

export function buildSevenoAssessmentReviewManifest(
  version: AssessmentVersionDescriptor,
  options: {
    changeLog?: SevenoAssessmentReviewChangeLogEntry[];
    generatedAt?: string;
  } = {},
): SevenoAssessmentReviewManifest {
  const changeLog = options.changeLog ?? [];
  const questions = version.questions.map((question) => buildQuestionReviewRecord(version, question, changeLog));
  const automatedCheckStatus = questions.some((question) => question.automatedCheckStatus === 'failed')
    ? 'failed'
    : questions.some((question) => question.automatedCheckStatus === 'warning')
      ? 'warning'
      : 'passed';

  return {
    versionId: version.id,
    versionCode: version.code,
    versionNumber: version.version,
    versionStatus: version.status,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    automatedCheckStatus,
    humanReviewSummary: buildHumanReviewSummary(questions),
    questionCount: questions.length,
    questions,
    reviewSeries: buildReviewSeries(questions),
    changeLog,
  };
}

export function renderSevenoAssessmentReviewManifestMarkdown(manifest: SevenoAssessmentReviewManifest) {
  const lines = [
    '# Revue humaine Seven’O v1',
    '',
    '## Statut global',
    '',
    `- Statut automatique: ${manifest.automatedCheckStatus}`,
    `- Revue humaine: ${manifest.humanReviewSummary.approvedForPilot}/${manifest.questionCount} questions acceptées pour pilote`,
    `- Questions en attente: ${manifest.humanReviewSummary.pendingHumanReviewCount}`,
    `- Questions modifiées après relecture: ${manifest.humanReviewSummary.reviewedWithChangesCount}`,
    `- Questions rejetées: ${manifest.humanReviewSummary.rejectedCount}`,
    `- Questions à relire: ${manifest.humanReviewSummary.pendingHumanReviewCount}`,
    `- Séries de 5 questions: ${manifest.reviewSeries.length}`,
    '',
    '## Journal des modifications',
    '',
    manifest.changeLog.length > 0
      ? manifest.changeLog.map((entry) => [
        `### ${entry.questionCode}`,
        `- Ancien contenu: ${entry.oldContent}`,
        `- Nouveau contenu: ${entry.newContent}`,
        `- Motif: ${entry.reason}`,
        `- Impact sur les dimensions: ${entry.impactOnDimensions}`,
        `- Impact sur le barème: ${entry.impactOnBarreme}`,
      ].join('\n')).join('\n\n')
      : '- Aucun changement éditorial supplémentaire n’a été journalisé.',
    '',
    '## Séries de revue',
    '',
    ...manifest.reviewSeries.flatMap((series) => [
      `### ${series.title}`,
      `- Questions: ${series.questionCodes.join(', ')}`,
      ...series.questions.flatMap((question) => [
        `#### ${question.code}`,
        `- Situation: ${question.situation}`,
        `- Consigne: ${question.instruction}`,
        `- Dimensions: ${question.primaryDimensionCodes.join(', ')}${question.secondaryDimensionCode ? ` / ${question.secondaryDimensionCode}` : ''}`,
        `- Options:`,
        ...question.options.map((option) => `  - ${option.order}. ${option.label} | scores: ${Object.entries(option.dimensionScores).map(([code, score]) => `${code}=${score}`).join(', ')} | explication: ${option.adminExplanation}`),
        `- Statut humain: ${question.humanReviewStatus}`,
        `- Décision finale: ${question.decisionFinal}`,
        `- Commentaires: ${question.reviewComments.join(' ')}`,
      ]),
      '',
    ]),
    '## Questions',
    '',
    ...manifest.questions.flatMap((question) => [
      `### ${question.code}`,
      `- Parcours: ${question.path}`,
      `- Statut automatique: ${question.automatedCheckStatus}`,
      `- Statut humain: ${question.humanReviewStatus}`,
      `- Décision finale: ${question.decisionFinal}`,
      `- Justification administrateur: ${question.justificationAdministrateur}`,
      `- Options: ${question.options.map((option) => `${option.order}. ${option.label}`).join(' | ')}`,
      `- Commentaires: ${question.reviewComments.join(' ')}`,
      `- Corrections proposées: ${question.proposedCorrections.length > 0 ? question.proposedCorrections.join(' ; ') : 'Aucune'}`,
    ]),
  ];

  return lines.join('\n');
}

export function getReviewStatusLabel(status: SevenoAssessmentHumanReviewStatus) {
  switch (status) {
    case 'pending':
      return 'À relire';
    case 'reviewed_with_changes':
      return 'Modifiée après relecture';
    case 'approved_for_pilot':
      return 'Acceptée pour pilote';
    case 'rejected':
      return 'Rejetée';
    default:
      return status;
  }
}

export function getAutomatedCheckStatusLabel(status: SevenoAssessmentAutomatedCheckStatus) {
  switch (status) {
    case 'passed':
      return 'passed';
    case 'warning':
      return 'warning';
    case 'failed':
      return 'failed';
    default:
      return status;
  }
}
