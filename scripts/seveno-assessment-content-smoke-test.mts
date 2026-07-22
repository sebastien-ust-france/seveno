import assert from 'node:assert/strict';
import net from 'node:net';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertFails, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import {
  buildSevenoAssessmentV1Draft,
  renderQualityReportMarkdown,
  writeSevenoAssessmentV1DraftFiles,
} from './seveno-assessment-v1-content-builder.mts';
import { buildSevenoAssessmentBankTestJson } from './seveno-assessment-bank-test-utils.mts';
import { renderSevenoAssessmentReviewManifestMarkdown } from '@/lib/seveno-professional-assessment-review';
import {
  SEVENO_PROFESSIONAL_ASSESSMENT_DIMENSION_CODES,
  validateAssessmentVersion,
} from '@/lib/seveno-professional-assessment';

function readJsonFile(relativePath: string) {
  const absolutePath = resolve(process.cwd(), relativePath);
  assert.ok(existsSync(absolutePath), `Fichier manquant: ${relativePath}`);
  return JSON.parse(readFileSync(absolutePath, 'utf8')) as unknown;
}

function readTextFile(relativePath: string) {
  const absolutePath = resolve(process.cwd(), relativePath);
  assert.ok(existsSync(absolutePath), `Fichier manquant: ${relativePath}`);
  return readFileSync(absolutePath, 'utf8');
}

async function assertFirestoreEmulatorAvailable() {
  const host = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
  const [hostname, portText] = host.split(':');
  const port = Number(portText);
  if (!hostname || !Number.isFinite(port)) {
    throw new Error(`Firestore emulator host invalide: ${host}`);
  }

  await new Promise<void>((resolvePromise, rejectPromise) => {
    const socket = net.createConnection({ host: hostname, port });
    const timeout = setTimeout(() => {
      socket.destroy();
      rejectPromise(new Error(`Firestore emulator inaccessible sur ${host}.`));
    }, 1000);

    socket.once('connect', () => {
      clearTimeout(timeout);
      socket.end();
      resolvePromise();
    });

    socket.once('error', () => {
      clearTimeout(timeout);
      rejectPromise(new Error(`Firestore emulator inaccessible sur ${host}.`));
    });
  });
}

function configureLocalEmulatorEnvironment() {
  const projectId = 'demo-seveno-local';
  process.env.NODE_ENV = 'test';
  process.env.SEVENO_PROFESSIONAL_ASSESSMENT_ADMIN_STORE = 'firestore';
  process.env.GCLOUD_PROJECT = projectId;
  process.env.PROJECT_ID = projectId;
  process.env.FIREBASE_ADMIN_PROJECT_ID = projectId;
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = projectId;
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
}

function compareJsonDraft() {
  const expected = JSON.parse(JSON.stringify(buildSevenoAssessmentV1Draft()));
  const actual = readJsonFile('scripts/data/seveno-professional-assessment-v1-draft.json');
  assert.deepEqual(actual, expected);
  return actual;
}

function validateLocalReport() {
  const { draft: expectedDraft, report, reviewManifest } = writeSevenoAssessmentV1DraftFiles();
  const markdown = renderQualityReportMarkdown(report);
  const persistedMarkdown = readTextFile('docs/seveno-assessment-v1-content-review.md');
  type ReviewManifestShape = {
    questionCount: number;
    reviewSeries: Array<{
      seriesNumber: number;
      questionCodes: string[];
      questions: Array<{ code: string; humanReviewStatus: string }>;
    }>;
    humanReviewSummary: {
      totalQuestions: number;
      pending: number;
      reviewedWithChanges: number;
      approvedForPilot: number;
      rejected: number;
      pendingHumanReviewCount: number;
      reviewedWithChangesCount: number;
      approvedForPilotCount: number;
      rejectedCount: number;
    };
    questions: Array<{ humanReviewStatus: string }>;
  };
  const reviewManifestFile = readJsonFile('scripts/data/seveno-professional-assessment-v1-review.json') as ReviewManifestShape;
  const reviewMarkdown = renderSevenoAssessmentReviewManifestMarkdown(reviewManifest as Parameters<typeof renderSevenoAssessmentReviewManifestMarkdown>[0]);
  const persistedReviewMarkdown = readTextFile('docs/seveno-assessment-v1-human-review.md');

  assert.equal(persistedMarkdown.trim(), markdown.trim());
  assert.equal(persistedReviewMarkdown.trim(), reviewMarkdown.trim());
  assert.equal(report.totalQuestions, 40);
  assert.equal(report.essentialQuestionCount, 20);
  assert.equal(report.extendedQuestionCount, 20);
  assert.equal(report.questionsWithSecondaryDimension > 0, true);
  assert.equal(report.questionsWithThreeDimensions, 5);
  assert.equal(report.documentUnder600KiB, true);
  assert.equal(report.questionsWithAutomatedWarnings.length, 0);
  assert.equal(report.pendingHumanReviewCount, 40);
  assert.equal(report.reviewedWithChangesCount, 0);
  assert.equal(report.approvedForPilotCount, 0);
  assert.equal(report.rejectedCount, 0);
  assert.equal(report.humanReviewStatusSummary.totalQuestions, 40);
  assert.equal(report.humanReviewStatusSummary.approvedForPilot, 0);
  assert.equal(report.humanReviewStatusSummary.pending, 40);
  assert.equal(reviewManifestFile.questionCount, 40);
  assert.equal(reviewManifest.reviewSeries.length, 8);
  assert.equal(reviewManifestFile.reviewSeries.length, 8);
  assert.equal(reviewManifestFile.humanReviewSummary.totalQuestions, 40);
  assert.equal(reviewManifestFile.humanReviewSummary.pendingHumanReviewCount, 40);
  assert.equal(reviewManifestFile.humanReviewSummary.reviewedWithChangesCount, 0);
  assert.equal(reviewManifestFile.humanReviewSummary.approvedForPilot, 0);
  assert.equal(reviewManifestFile.humanReviewSummary.rejectedCount, 0);
  assert.equal(reviewManifestFile.humanReviewSummary.pending, 40);
  assert.equal(reviewManifestFile.questions.every((question) => question.humanReviewStatus === 'pending'), true);
  assert.deepEqual(reviewManifest.reviewSeries[0]?.questionCodes, [
    'essential_information_01',
    'essential_organization_01',
    'essential_problem_solving_01',
    'essential_autonomy_01',
    'essential_adaptability_01',
  ]);
  assert.equal(reviewManifest.reviewSeries[0]?.questions.every((question) => question.humanReviewStatus === 'pending'), true);
  assert.equal(validateAssessmentVersion(expectedDraft).valid, true);

  for (const code of SEVENO_PROFESSIONAL_ASSESSMENT_DIMENSION_CODES) {
    assert.equal(report.mainDimensionDistribution[code] > 0, true);
    assert.equal(report.coverageByDimension[code] >= 10, true);
  }

  assert.equal(report.exactDuplicates.length, 0);
  assert.equal(report.forbiddenTerms.length, 0);
  assert.equal(report.questionsWithDominatingOption.length, 0);
  return expectedDraft;
}

async function validateEmulatorPersistence(expectedDraft: ReturnType<typeof buildSevenoAssessmentV1Draft>) {
  configureLocalEmulatorEnvironment();
  await assertFirestoreEmulatorAvailable();

  const {
    FirestoreProfessionalAssessmentRepository,
    SevenoProfessionalAssessmentRepositoryError,
    isSevenoProfessionalAssessmentFirestoreRepositoryEnabledFlag,
  } = await import('@/lib/seveno-professional-assessment-admin-repository');

  assert.equal(isSevenoProfessionalAssessmentFirestoreRepositoryEnabledFlag(), true);

  const repository = new FirestoreProfessionalAssessmentRepository();
  const imported = await repository.importDraftFromJson(buildSevenoAssessmentBankTestJson(expectedDraft));
  assert.equal(imported.status, 'draft');
  assert.equal(imported.name, expectedDraft.name);
  assert.equal(imported.questions.length, 60);
  assert.equal(imported.essentialQuestionCount, 30);
  assert.equal(imported.extendedQuestionCount, 30);
  assert.equal(imported.generatedPromptVersion, 'seveno_professional_assessment_bank_v1');
  assert.equal(imported.essentialPoolSize, 30);
  assert.equal(imported.extendedPoolSize, 30);
  assert.equal(imported.essentialDrawSize, 20);
  assert.equal(imported.extendedDrawSize, 20);
  assert.equal(imported.publishedAt, null);
  assert.equal(imported.archivedAt, null);

  const afterImport = await repository.readVersion(imported.id);
  assert.ok(afterImport);
  assert.equal(afterImport?.name, expectedDraft.name);
  assert.equal(afterImport?.questions.length, 60);

  const updated = await repository.updateDraft(imported.id, {
    ...afterImport,
    description: `${afterImport?.description ?? ''} (revue locale)`,
    revisionNumber: afterImport?.revisionNumber,
  });
  assert.equal(updated.revisionNumber, 2);
  assert.match(updated.description, /revue locale/);

  const reopenedRepository = new FirestoreProfessionalAssessmentRepository();
  const afterRestart = await reopenedRepository.readVersion(imported.id);
  assert.ok(afterRestart);
  assert.equal(afterRestart?.description, updated.description);
  assert.equal(afterRestart?.revisionNumber, 2);

  await assert.rejects(
    () => reopenedRepository.updateDraft(imported.id, {
      ...afterImport,
      description: 'Version obsolète',
      revisionNumber: afterImport?.revisionNumber,
    }),
    (error: unknown) => error instanceof SevenoProfessionalAssessmentRepositoryError && error.code === 'revision_conflict',
  );

  const bankEssentialPreview = await reopenedRepository.buildPreview(imported.id, 'essential');
  const bankFullPreview = await reopenedRepository.buildPreview(imported.id, 'extended');
  assert.equal(bankEssentialPreview.questionCount, 30);
  assert.equal(bankFullPreview.questionCount, 60);
  assert.equal(bankEssentialPreview.report.dimensionResults.length, 7);
  assert.equal(bankFullPreview.report.dimensionResults.length, 7);
  assert.equal('companySummary' in bankEssentialPreview.candidateProjection, false);
  assert.equal('candidateSummary' in bankEssentialPreview.companyProjection, false);

  const rulesTestEnv = await initializeTestEnvironment({
    projectId: 'demo-seveno-local',
    firestore: {
      host: '127.0.0.1',
      port: 8080,
      rules: readTextFile('firestore.rules'),
    },
  });

  try {
    const collection = 'professional_assessment_versions';
    const unauthenticated = rulesTestEnv.unauthenticatedContext();
    const candidate = rulesTestEnv.authenticatedContext('candidate-test-user', {
      email: 'candidate-test@seveno.local',
      email_verified: true,
      name: 'Candidate Test',
    });
    const company = rulesTestEnv.authenticatedContext('company-test-user', {
      email: 'company-test@seveno.local',
      email_verified: true,
      name: 'Company Test',
    });
    const admin = rulesTestEnv.authenticatedContext('admin-test-user', {
      email: 'admin-test@seveno.local',
      email_verified: true,
      name: 'Admin Test',
    });

    await assertFails(unauthenticated.firestore().collection(collection).doc(imported.id).get());
    await assertFails(candidate.firestore().collection(collection).doc(imported.id).get());
    await assertFails(company.firestore().collection(collection).doc(imported.id).get());
    await assertFails(admin.firestore().collection(collection).doc(imported.id).get());
    await assertFails(unauthenticated.firestore().collection(collection).doc(`${imported.id}-write`).set({ foo: 'bar' }));
    await assertFails(candidate.firestore().collection(collection).doc(`${imported.id}-write`).set({ foo: 'bar' }));
    await assertFails(company.firestore().collection(collection).doc(`${imported.id}-write`).set({ foo: 'bar' }));
    await assertFails(admin.firestore().collection(collection).doc(`${imported.id}-write`).set({ foo: 'bar' }));
  } finally {
    await rulesTestEnv.cleanup();
  }

  await reopenedRepository.deleteUnusedDraft(imported.id, updated.revisionNumber);
  assert.equal(await reopenedRepository.readVersion(imported.id), null);
}

async function main() {
  const expectedDraft = validateLocalReport();
  const fileDraft = compareJsonDraft();
  assert.equal(fileDraft.version, expectedDraft.version);

  await validateEmulatorPersistence(expectedDraft);

  console.log('SevenO assessment content smoke test: OK');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
