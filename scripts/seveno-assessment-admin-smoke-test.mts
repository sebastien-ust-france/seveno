import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  SevenoAssessmentAdminError,
  analyzeSevenoAssessmentImportJson,
  createSevenoAssessmentBlankDraft,
  deleteSevenoAssessmentUnusedDraft,
  duplicateSevenoAssessmentVersion,
  generateSevenoAssessmentPrompt,
  importSevenoAssessmentVersion,
  loadSevenoAssessmentEditorState,
  markSevenoAssessmentAsPilot,
  previewSevenoAssessmentCandidateVersion,
  previewSevenoAssessmentVersion,
  publishSevenoAssessmentVersion,
  updateSevenoAssessmentDraft,
  validateSevenoAssessmentDraft,
} from '@/lib/seveno-professional-assessment-admin-server';
import { resolveAdminSevenoAssessmentSummary } from '@/lib/seveno-admin-service';
import { SevenoAdminApiError, fetchSevenoAdminApi } from '@/lib/seveno-admin-api';
import {
  SEVENO_PROFESSIONAL_ASSESSMENT_BANK_PROMPT_VERSION,
  buildSevenoProfessionalAssessmentBankPrompt,
  validateSevenoProfessionalAssessmentBankDocument,
} from '@/lib/seveno-professional-assessment-bank';
import {
  AssessmentModelError,
  SEVENO_PROFESSIONAL_ASSESSMENT_BEHAVIOR_AXIS_CODES,
  SEVENO_PROFESSIONAL_ASSESSMENT_DIMENSION_CODES,
  validateAssessmentScoringStructure,
} from '@/lib/seveno-professional-assessment';
import { buildSevenoAssessmentReviewManifest } from '@/lib/seveno-professional-assessment-review';
import {
  FirestoreProfessionalAssessmentRepository,
  SevenoProfessionalAssessmentRepository,
  SevenoProfessionalAssessmentRepositoryError,
  createSevenoProfessionalAssessmentSeedVersion,
  getSevenoProfessionalAssessmentRepository,
} from '@/lib/seveno-professional-assessment-admin-repository';
import type { SevenoAssessmentCandidatePreviewResponse } from '@/types/seveno-assessment-admin';
import type { SevenoAssessmentStoredVersion } from '@/types/seveno-assessment-admin';
import type { ProfessionalAssessmentBehavioralProfile, SevenoAssessmentScores, TestResult } from '@/types/seveno';
import { SEVENO_PROFESSIONAL_ASSESSMENT_TEST_ONLY_VERSION } from '@/lib/seveno-professional-assessment-fixtures';
import { isSevenoProfessionalAssessmentFirestoreRepositoryEnabledFlag } from '@/lib/seveno-professional-assessment-admin-repository';
import { assertFails, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import type { SevenoAdminSession } from '@/lib/seveno-admin-auth';
import { buildSevenoAssessmentBankTestDocument, buildSevenoAssessmentBankTestJson } from './seveno-assessment-bank-test-utils.mts';

function readSource(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

function loadDotEnvFile(filePath: string) {
  if (!existsSync(filePath)) {
    return;
  }

  const content = readFileSync(filePath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const equalsIndex = trimmed.indexOf('=');
    if (equalsIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, equalsIndex).trim();
    let value = trimmed.slice(equalsIndex + 1).trim();

    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }

    if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function summarizeRepositoryTarget() {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? 'unset';
  const repositoryMode = getSevenoProfessionalAssessmentRepository() instanceof FirestoreProfessionalAssessmentRepository ? 'firestore' : 'memory';
  const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST ?? null;

  return {
    repositoryMode,
    projectId,
    emulatorHostPresent: Boolean(emulatorHost),
    collection: 'professional_assessment_versions',
    safetyGate: emulatorHost ? 'local_emulator' : 'production_guard_only',
  };
}

function cloneValue<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

const V2_INTERPRETATION_RANGES = [
  [0, 39],
  [40, 59],
  [60, 74],
  [75, 89],
  [90, 100],
] as const;

function buildRepresentativeVersion() {
  const base = cloneValue(SEVENO_PROFESSIONAL_ASSESSMENT_TEST_ONLY_VERSION);
  const questions = base.questions.map((question) => cloneValue(question));
  const sourceQuestions = [...questions];

  while (questions.length < 40) {
    const template = sourceQuestions[questions.length % sourceQuestions.length];
    const nextIndex = questions.length + 1;
    const clone = cloneValue(template);
    clone.id = `${template.id}-replica-${nextIndex}`;
    clone.code = `${template.code}-replica-${nextIndex}`;
    clone.assessmentVersionId = `${base.id}-representative`;
    clone.position = nextIndex;
    clone.path = nextIndex <= 20 ? 'essential' : 'extended';
    clone.situation = `${template.situation} Cette variante representant la taille reelle ajoute un contexte plus complet et reste structurellement proche de la version finale.`;
    clone.instruction = `${template.instruction} Cette reformulation conserve un niveau de detail realiste pour evaluer la taille du document Firestore.`;
    clone.adminRationale = `${template.adminRationale} Variante representant la charge documentaire attendue pour une version complete.`;
    clone.options = template.options.map((option, optionIndex) => ({
      ...cloneValue(option),
      id: `${clone.code}-option-${optionIndex + 1}`,
      position: optionIndex + 1,
      adminExplanation: `${option.adminExplanation} Cette note interne participe a une estimation de taille realiste.`,
    }));
    questions.push(clone);
  }

  const dimensions = base.dimensions.map((dimension) => {
    const matchingQuestions = questions.filter((question) => question.primaryDimensionCodes.includes(dimension.code));
    const questionIds = matchingQuestions.map((question) => question.id);

    return {
      ...cloneValue(dimension),
      interviewQuestionIds: questionIds,
      interpretationThresholds: dimension.interpretationThresholds.map((threshold) => ({
        ...cloneValue(threshold),
        interviewQuestionIds: questionIds.slice(0, Math.min(questionIds.length, 6)),
      })),
    };
  });

  const interviewQuestionCatalog = Object.fromEntries(
    questions.map((question) => [question.id, `Comment observer ${question.code} en entretien ?`] as const),
  );

  return {
    ...base,
    id: `${base.id}-representative`,
    code: `${base.code}-representative`,
    version: '0.0.1-test',
    name: 'TEST PERSISTENCE - A SUPPRIMER',
    description: 'Version representant une banque complete de 40 questions pour mesurer la taille de stockage.',
    questions,
    dimensions,
    essentialQuestionCount: 20,
    extendedQuestionCount: 20,
    interviewQuestionCatalog,
    revisionNotes: [...base.revisionNotes, 'Document representatif pour validation de taille et de persistance.'],
  };
}

function measureUtf8Bytes(value: unknown) {
  return Buffer.byteLength(JSON.stringify(value), 'utf8');
}

function formatKilobytes(bytes: number) {
  return (bytes / 1024).toFixed(1);
}

function createRepository() {
  return new SevenoProfessionalAssessmentRepository([createSevenoProfessionalAssessmentSeedVersion()]);
}

function createAdminSession(role: 'admin' | 'company' = 'admin') {
  return {
    token: `${role}-token`,
    decodedToken: { uid: `${role}-uid` } as SevenoAdminSession['decodedToken'],
    user: {
      uid: `${role}-uid`,
      role,
      authProvider: 'google',
      email: `${role}@seveno.local`,
      displayName: role === 'admin' ? 'SevenO Admin' : 'SevenO Company',
      onboardingCompleted: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  } as SevenoAdminSession;
}

function buildAuthorizationHeader(session: SevenoAdminSession) {
  return `Bearer ${session.token}`;
}

async function callSevenoAssessmentAdminApiAction(
  session: SevenoAdminSession,
  action: 'analyze_import_json' | 'import_json',
  jsonText: string,
  repository: SevenoProfessionalAssessmentRepository,
) {
  const originalFetch = globalThis.fetch;
  const authorizationHeader = buildAuthorizationHeader(session);

  try {
    globalThis.fetch = (async (input, init) => {
      const requestedPath = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
      assert.equal(requestedPath, '/api/admin/evaluation-seveno');
      const headers = new Headers(init?.headers);
      assert.equal(headers.get('Authorization'), authorizationHeader);

      const rawBody = typeof init?.body === 'string' ? init.body : '';
      const body = rawBody ? JSON.parse(rawBody) as { action?: string; jsonText?: string } : {};
      assert.equal(body.action, action);

      const responsePayload = body.action === 'analyze_import_json'
        ? await analyzeSevenoAssessmentImportJson(session, body.jsonText ?? '', repository)
        : await importSevenoAssessmentVersion(session, body.jsonText ?? '', repository);

      return new Response(JSON.stringify(responsePayload), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }) as typeof fetch;

    return await fetchSevenoAdminApi<SevenoAssessmentActionResponse>('/api/admin/evaluation-seveno', {
      method: 'POST',
      headers: {
        Authorization: authorizationHeader,
      },
      body: JSON.stringify({
        action,
        jsonText,
      }),
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function callSevenoAssessmentAdminPreviewCandidateAction(
  session: SevenoAdminSession,
  version: SevenoAssessmentStoredVersion,
  seed: string,
) {
  const originalFetch = globalThis.fetch;
  const authorizationHeader = buildAuthorizationHeader(session);

  try {
    globalThis.fetch = (async (input, init) => {
      const requestedPath = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
      assert.equal(requestedPath, '/api/admin/evaluation-seveno');
      const headers = new Headers(init?.headers);
      assert.equal(headers.get('Authorization'), authorizationHeader);

      const rawBody = typeof init?.body === 'string' ? init.body : '';
      const body = rawBody ? JSON.parse(rawBody) as { action?: string; version?: typeof version; seed?: string } : {};
      assert.equal(body.action, 'preview_candidate_version');

      const responsePayload = await previewSevenoAssessmentCandidateVersion(
        session,
        body.version ?? version,
        body.seed ?? seed,
      );

      return new Response(JSON.stringify(responsePayload), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }) as typeof fetch;

    return await fetchSevenoAdminApi<SevenoAssessmentCandidatePreviewResponse>('/api/admin/evaluation-seveno', {
      method: 'POST',
      headers: {
        Authorization: authorizationHeader,
      },
      body: JSON.stringify({
        action: 'preview_candidate_version',
        version,
        seed,
      }),
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function expectRejects<TError extends Error>(
  action: () => unknown | Promise<unknown>,
  guard: (error: unknown) => error is TError,
  code: string,
) {
  await assert.rejects(action, (error: unknown) => guard(error) && (error as TError & { code: string }).code === code);
}

async function main() {
  loadDotEnvFile(resolve(process.cwd(), '.env.local'));
  const repositoryTarget = summarizeRepositoryTarget();
  console.log('SevenO assessment admin repository target:', repositoryTarget);
  if (repositoryTarget.projectId === 'seveno-a8eb1' && !repositoryTarget.emulatorHostPresent) {
    console.warn('Production Firebase project detected without a local Firestore emulator. Firestore persistence checks will use the configured project.');
  }

  const representativeVersion = buildRepresentativeVersion();
  const representativeBytes = measureUtf8Bytes(representativeVersion);
  const representativeKilobytes = representativeBytes / 1024;
  const firestoreRatio = representativeBytes / (1024 * 1024);
  const firestoreMarginBytes = (1024 * 1024) - representativeBytes;

  assert.ok(representativeBytes < 800 * 1024, 'The representative assessment version exceeds the internal 800 KB safety limit.');
  if (representativeBytes >= 600 * 1024) {
    console.warn('Representative assessment version exceeds the 600 KB warning threshold. A sub-collection should be considered.');
  }

  console.log('Representative assessment size:', {
    bytes: representativeBytes,
    kilobytes: Number(formatKilobytes(representativeBytes)),
    firestoreLimitRatio: Number((firestoreRatio * 100).toFixed(1)),
    firestoreMarginBytes,
  });

  const adminSession = createAdminSession('admin');
  const nonAdminSession = createAdminSession('company');

  const repository = createRepository();
  const firestoreRepositoryEnabled = isSevenoProfessionalAssessmentFirestoreRepositoryEnabledFlag();
  if (getSevenoProfessionalAssessmentRepository() instanceof FirestoreProfessionalAssessmentRepository) {
    assert.equal(firestoreRepositoryEnabled, true);
    assert.ok(getSevenoProfessionalAssessmentRepository() instanceof FirestoreProfessionalAssessmentRepository);
  } else {
    assert.equal(firestoreRepositoryEnabled, false);
    assert.ok(getSevenoProfessionalAssessmentRepository() instanceof SevenoProfessionalAssessmentRepository);
  }

  const defaultVersionId = await repository.getDefaultVersionId();
  assert.ok(defaultVersionId, 'A default version should be available in the local repository.');
  const seedVersion = await repository.readVersion(defaultVersionId!);
  assert.ok(seedVersion, 'The seeded version must exist.');
  assert.equal(seedVersion!.revisionNumber, 1);

  await expectRejects(
    () => loadSevenoAssessmentEditorState(null, undefined, repository),
    (error): error is SevenoAssessmentAdminError => error instanceof SevenoAssessmentAdminError,
    'auth_required',
  );
  await expectRejects(
    () => loadSevenoAssessmentEditorState(nonAdminSession, undefined, repository),
    (error): error is SevenoAssessmentAdminError => error instanceof SevenoAssessmentAdminError,
    'forbidden_role',
  );

  const loadedState = await loadSevenoAssessmentEditorState(adminSession, seedVersion!.id, repository);
  assert.equal(loadedState.selectedVersion?.id, seedVersion!.id);
  assert.equal(loadedState.selectedVersion?.revisionNumber, seedVersion!.revisionNumber);
  assert.ok(loadedState.validation);
  assert.ok(loadedState.prompt);

  const summaryPriorityResult = resolveAdminSevenoAssessmentSummary({
    profile: {
      sevenoAssessmentStatus: 'in_progress',
      sevenoAssessmentOverallScore: 41,
      sevenoAssessmentDimensions: { collaboration: 41 } as SevenoAssessmentScores,
      sevenoAssessmentVersion: 'profile-version',
      sevenoAssessmentCompletedAt: new Date('2026-07-30T08:00:00.000Z'),
      sevenoAssessmentSessionId: 'profile-session',
      sevenoAssessmentResultId: 'profile-result',
    },
    summary: {
      status: 'completed',
      overallScore: 87,
      scoresByDimension: { collaboration: 87 } as SevenoAssessmentScores,
      completedAt: '2026-07-30T08:15:00.000Z',
      sessionId: 'summary-session',
      resultId: 'summary-result',
      questionnaireVersion: 'summary-version',
      professionalAssessmentVersionId: 'summary-bank',
      professionalAssessmentSchemaVersion: 2,
      candidateSummaryItems: ['Résumé synthétique', 'Point fort'],
      candidateSummary: 'Résumé final',
      behavioralProfile: {
        axisResults: { collaboration: 87 },
        candidateSummaryItems: ['Résumé synthétique', 'Point fort'],
        companySummaryItems: [],
        candidateSummary: 'Résumé final',
        companySummary: null,
        disclaimer: 'Disclaimer',
      } as unknown as ProfessionalAssessmentBehavioralProfile,
    },
    result: {
      uid: 'candidate-uid',
      sessionId: 'result-session',
      questionBankCode: 'seveno_professional_assessment_bank_1_1_0',
      score: 12,
      correctAnswers: 12,
      totalQuestions: 20,
      passed: false,
      threshold: 15,
      durationSeconds: 300,
      overallScore: 12,
      scoresByDimension: { collaboration: 12 } as SevenoAssessmentScores,
      questionnaireVersion: 'result-version',
      professionalAssessmentVersionId: 'result-bank',
      professionalAssessmentSchemaVersion: 2,
      verifiedAt: new Date('2026-07-30T09:00:00.000Z'),
      submittedAt: new Date('2026-07-30T08:59:00.000Z'),
      behavioralProfile: {
        axisResults: { collaboration: 12 },
        candidateSummaryItems: ['Résultat brut'],
        companySummaryItems: [],
        candidateSummary: 'Résultat brut',
        companySummary: null,
        disclaimer: 'Disclaimer',
      } as unknown as ProfessionalAssessmentBehavioralProfile,
    } as Partial<TestResult>,
  });

  assert.equal(summaryPriorityResult.status, 'completed');
  assert.equal(summaryPriorityResult.overallScore, 87);
  assert.deepEqual(summaryPriorityResult.scoresByDimension, { collaboration: 87 });
  assert.equal(summaryPriorityResult.completedAt, '2026-07-30T08:15:00.000Z');
  assert.equal(summaryPriorityResult.sessionId, 'summary-session');
  assert.equal(summaryPriorityResult.resultId, 'summary-result');
  assert.equal(summaryPriorityResult.questionnaireVersion, 'summary-version');
  assert.equal(summaryPriorityResult.professionalAssessmentVersionId, 'summary-bank');
  assert.equal(summaryPriorityResult.professionalAssessmentSchemaVersion, 2);
  assert.deepEqual(summaryPriorityResult.candidateSummaryItems, ['Résumé synthétique', 'Point fort']);
  assert.equal(summaryPriorityResult.candidateSummary, 'Résumé final');

  const profilePriorityResult = resolveAdminSevenoAssessmentSummary({
    profile: {
      sevenoAssessmentStatus: 'completed',
      sevenoAssessmentOverallScore: 63,
      sevenoAssessmentDimensions: { collaboration: 63 } as SevenoAssessmentScores,
      sevenoAssessmentVersion: 'profile-version',
      sevenoAssessmentCompletedAt: new Date('2026-07-30T10:00:00.000Z'),
      sevenoAssessmentSessionId: 'profile-session',
      sevenoAssessmentResultId: 'profile-result',
    },
  });
  assert.equal(profilePriorityResult.status, 'completed');
  assert.equal(profilePriorityResult.overallScore, 63);
  assert.equal(profilePriorityResult.questionnaireVersion, 'profile-version');
  assert.equal(profilePriorityResult.professionalAssessmentVersionId, null);
  assert.equal(profilePriorityResult.resultId, 'profile-result');

  const resultPriorityResult = resolveAdminSevenoAssessmentSummary({
    result: {
      uid: 'candidate-uid',
      sessionId: 'result-only-session',
      questionBankCode: 'seveno_professional_assessment_bank_1_1_0',
      score: 72,
      correctAnswers: 18,
      totalQuestions: 20,
      passed: true,
      threshold: 15,
      durationSeconds: 300,
      overallScore: 72,
      scoresByDimension: { collaboration: 72 } as SevenoAssessmentScores,
      questionnaireVersion: 'result-only-version',
      professionalAssessmentVersionId: 'result-only-bank',
      professionalAssessmentSchemaVersion: 2,
      verifiedAt: new Date('2026-07-30T11:00:00.000Z'),
      submittedAt: new Date('2026-07-30T10:59:00.000Z'),
      behavioralProfile: {
        axisResults: { collaboration: 72 },
        candidateSummaryItems: ['Résultat brut'],
        companySummaryItems: [],
        candidateSummary: 'Résultat brut',
        companySummary: null,
        disclaimer: 'Disclaimer',
      } as unknown as ProfessionalAssessmentBehavioralProfile,
    } as Partial<TestResult>,
  });
  assert.equal(resultPriorityResult.status, 'completed');
  assert.equal(resultPriorityResult.overallScore, 72);
  assert.equal(resultPriorityResult.questionnaireVersion, 'result-only-version');
  assert.equal(resultPriorityResult.professionalAssessmentVersionId, 'result-only-bank');
  assert.equal(resultPriorityResult.candidateSummary, 'Résultat brut');

  const blankRepository = createRepository();
  const blankDraft = await createSevenoAssessmentBlankDraft(adminSession, blankRepository);
  assert.equal(blankDraft.selectedVersion?.status, 'draft');
  assert.equal(blankDraft.selectedVersion?.questions.length, 0);
  assert.equal(blankDraft.selectedVersion?.revisionNumber, 1);

  const duplicateRepository = createRepository();
  const duplicated = await duplicateSevenoAssessmentVersion(adminSession, seedVersion!.id, duplicateRepository);
  assert.equal(duplicated.selectedVersion?.status, 'draft');
  assert.equal(duplicated.selectedVersion?.sourceVersionId, seedVersion!.id);
  assert.notEqual(duplicated.selectedVersion?.id, seedVersion!.id);
  assert.equal(duplicated.selectedVersion?.revisionNumber, 1);

  const editableRepository = createRepository();
  const editableDuplicate = await duplicateSevenoAssessmentVersion(adminSession, seedVersion!.id, editableRepository);
  const editableVersion = editableDuplicate.selectedVersion;
  assert.ok(editableVersion);
  editableVersion.name = 'Version admin de test';
  editableVersion.description = 'Version locale de verification.';
  editableVersion.revisionNotes = ['Mise a jour locale.'];
  const savedDraft = await updateSevenoAssessmentDraft(adminSession, editableVersion.id, editableVersion, editableRepository);
  assert.equal(savedDraft.selectedVersion?.name, 'Version admin de test');
  assert.equal(savedDraft.selectedVersion?.status, 'draft');
  assert.equal(savedDraft.selectedVersion?.revisionNumber, 2);
  await expectRejects(
    () => updateSevenoAssessmentDraft(adminSession, editableVersion.id, editableVersion, editableRepository),
    (error): error is SevenoProfessionalAssessmentRepositoryError => error instanceof SevenoProfessionalAssessmentRepositoryError,
    'revision_conflict',
  );

  const draftToDeleteRepository = createRepository();
  const draftToDelete = await createSevenoAssessmentBlankDraft(adminSession, draftToDeleteRepository);
  if (draftToDelete.selectedVersion) {
    await deleteSevenoAssessmentUnusedDraft(
      adminSession,
      draftToDelete.selectedVersion.id,
      draftToDelete.selectedVersion.revisionNumber,
      draftToDeleteRepository,
    );
    assert.equal(await draftToDeleteRepository.readVersion(draftToDelete.selectedVersion.id), null);
  }

  const validationResponse = await validateSevenoAssessmentDraft(adminSession, seedVersion!, repository);
  assert.equal(validationResponse.message, 'Brouillon vérifié.');
  assert.equal(validationResponse.payload.selectedVersion?.id, seedVersion!.id);
  assert.ok(validationResponse.payload.validation);

  await assert.rejects(
    () => fetchSevenoAdminApi('/api/admin/evaluation-seveno'),
    (error: unknown) => error instanceof SevenoAdminApiError
      && error.status === 401
      && error.message === 'Jeton Firebase manquant.',
  );

  const promptResponse = await generateSevenoAssessmentPrompt(adminSession, seedVersion!);
  const prompt = promptResponse.payload.prompt ?? '';
  assert.match(prompt, /seveno_professional_assessment_bank_v1/);
  assert.doesNotMatch(prompt, /\{\s*question\s*\}|\{\s*dimension\s*\}|\{\s*block\s*\}/);
  assert.match(prompt, /"versionMetadata"/);
  assert.match(prompt, /"essentialQuestionPool"/);
  assert.match(prompt, /"extendedQuestionPool"/);
  assert.match(prompt, /"dimensionConfigurations"/);
  assert.match(prompt, /"interpretationBlocks"/);
  assert.match(prompt, /"interviewQuestions"/);
  assert.match(prompt, /"questionId"/);
  assert.match(prompt, /"secondaryDimensionCode"/);
  assert.match(prompt, /"adminExplanation"/);
  assert.match(prompt, /"path": "essential"/);
  assert.match(prompt, /"path": "extended"/);
  assert.match(prompt, /"difficulty": "introductory"/);
  assert.match(prompt, /"difficulty": "standard"/);
  assert.match(prompt, /"essentialPoolSize": 30/);
  assert.match(prompt, /"extendedPoolSize": 30/);
  assert.match(prompt, /"essentialDrawSize": 20/);
  assert.match(prompt, /"extendedDrawSize": 20/);
  assert.match(prompt, /Le questionnaire est général et indépendant de tout métier\./);
  assert.match(prompt, /Chaque question doit pouvoir être comprise et traitée équitablement par une personne travaillant dans la logistique, la vente, la restauration, l’entretien, l’industrie, le bâtiment, la santé, l’administration, l’informatique ou les services\./);
  assert.match(prompt, /Aucune question ne doit nécessiter de connaissance professionnelle ou sectorielle\./);
  assert.match(prompt, /Le candidat dispose de 15 secondes pour lire la question, lire les quatre réponses, réfléchir et choisir\./);
  assert.match(prompt, /La partie visible de la question est composée de `situation` et `instruction`\./);
  assert.match(prompt, /La somme des mots de `situation` et `instruction` ne doit pas dépasser 18 mots\./);
  assert.match(prompt, /Chaque label de réponse ne doit pas dépasser 12 mots\./);
  assert.match(prompt, /La somme des mots de `situation`, `instruction` et des quatre labels de réponse ne doit pas dépasser 60 mots\./);
  assert.match(prompt, /Les champs `adminExplanation` et `adminRationale` ne sont pas inclus dans ce budget de lecture, car ils ne sont pas affichés au candidat pendant le test\./);
  assert.match(prompt, /Générique ne signifie pas évident ou infantile\./);
  assert.match(prompt, /Les quatre réponses doivent être crédibles et proches les unes des autres\./);
  assert.match(prompt, /Exemple illustratif:/);
  assert.match(prompt, /Situation :/);
  assert.match(prompt, /« Une consigne importante manque de précision\. »/);
  assert.match(prompt, /Instruction :/);
  assert.match(prompt, /« Que faites-vous d’abord \? »/);
  assert.match(prompt, /Options possibles :/);
  assert.match(prompt, /1\. « Je commence par ce qui est certain\. »/);
  assert.match(prompt, /2\. « Je demande une reformulation complète\. »/);
  assert.match(prompt, /3\. « Je vérifie l’essentiel, puis je confirme le point ambigu\. »/);
  assert.match(prompt, /4\. « Je retiens l’interprétation qui paraît la plus probable\. »/);
  assert.match(prompt, /Cet exemple illustre uniquement la généricité, la concision et la nuance attendues\. Il ne doit pas être recopié ou décliné mécaniquement dans plusieurs questions\./);
  assert.match(prompt, /L’extrait JSON contient volontairement des formulations de démonstration comme :/);
  assert.match(prompt, /- « Situation professionnelle 1 »/);
  assert.match(prompt, /- « Réponse A »/);
  assert.match(prompt, /- « Réponse B »/);
  assert.match(prompt, /- « Réponse C »/);
  assert.match(prompt, /- « Réponse D »/);
  assert.match(prompt, /- « Question de test »/);
  assert.match(prompt, /- « Exemple approfondi »/);
  assert.match(prompt, /- « Texte à compléter »/);
  assert.match(prompt, /- « Placeholder »\./);
  assert.match(prompt, /Ces formulations sont uniquement des exemples de remplissage et ne doivent pas être réutilisées dans la sortie finale\./);
  assert.match(prompt, /Chaque `situation`, `instruction`, `label`, `adminExplanation`, `adminRationale`, résumé, interprétation et question d’entretien doit être entièrement rédigé, cohérent et directement exploitable\./);
  assert.match(prompt, /Les réponses doivent être directement liées à la situation tout en restant universelles, sans objet, outil, rôle, procédure ou connaissance propre à un métier\./);
  assert.match(prompt, /Retourne uniquement le JSON valide, sans introduction, sans commentaire et sans bloc Markdown\./);
  assert.match(prompt, /Pour une même question, les quatre objets dimensionScores doivent avoir exactement les mêmes clés\./);
  assert.match(prompt, /Chaque valeur de interviewQuestionIds doit correspondre exactement au questionId d une interviewQuestion existante\./);
  assert.match(prompt, /La question d entretien référencée doit avoir le même dimensionCode que le groupe d interprétation\./);
  assert.match(prompt, /Aucun questionId de question essential ou extended ne doit être réutilisé comme questionId d interviewQuestion\./);
  assert.match(prompt, /Les identifiants d interviewQuestion doivent utiliser une convention distincte comme interview-information-understanding-1\./);
  assert.match(prompt, /Extrait structurel volontairement incomplet, fourni uniquement pour illustrer la forme des objets\./);
  assert.match(prompt, /La description de la version est obligatoire et ne peut pas être vide\./);
  assert.match(prompt, /La banque doit contenir exactement 7 dimensionConfigurations, une par dimension autorisée\./);
  assert.match(prompt, /La somme des poids des dimensions doit être égale à 100\./);
  assert.match(prompt, /Chaque dimension doit disposer d un seul groupe interpretationBlocks\./);
  assert.match(prompt, /Chaque dimension doit référencer au moins une interviewQuestion\./);
  assert.match(prompt, /Le champ isActive ne doit pas être fourni pour les questions de la banque: elles sont activées automatiquement à l import\./);
  assert.match(prompt, /Chaque question doit avoir un questionId unique sur l ensemble de la banque\./);
  assert.match(prompt, /Chaque option doit avoir un identifiant unique dans sa question\./);
  assert.match(prompt, /Chaque option doit contenir un label et une adminExplanation non vides\./);
  assert.match(prompt, /Les clés de dimensionScores doivent appartenir uniquement aux dimensions autorisées\./);
  assert.match(prompt, /Chaque dimensionConfiguration doit avoir un libellé non vide, une description non vide, un poids entier positif, un displayOrder entier positif et des minima d observations positifs\./);
  assert.match(prompt, /Chaque bloc d interprétation doit remplir candidateSummary, companySummary, interviewFocus et interviewQuestionIds\./);
  assert.match(prompt, /Chaque interviewQuestion doit avoir un questionId unique, un dimensionCode autorisé, un prompt non vide et une rationale non vide\./);
  assert.match(prompt, /Conserver le contenu centré sur des situations de travail universelles, compréhensibles dans tous les métiers et ne nécessitant aucune connaissance professionnelle ou sectorielle\./);
  assert.doesNotMatch(prompt, /Conserver le contenu centré sur des situations professionnelles concrètes\./);
  assert.ok(prompt.includes('3. La somme des mots de `situation` et `instruction` est-elle inférieure ou égale à 18 ?'));
  assert.doesNotMatch(prompt, /Question : 18 mots maximum\./);
  for (const code of SEVENO_PROFESSIONAL_ASSESSMENT_DIMENSION_CODES) {
    assert.match(prompt, new RegExp(code.replaceAll('_', '\\_')));
  }
  for (const dimension of seedVersion!.dimensions) {
    assert.ok(prompt.includes(dimension.code), `Prompt should mention dimension ${dimension.code}.`);
  }
  const version101Prompt = buildSevenoProfessionalAssessmentBankPrompt({
    ...cloneValue(seedVersion!),
    version: '1.0.1',
  });
  assert.match(version101Prompt, /"version": "1.0.1"/);
  assert.doesNotMatch(version101Prompt, /"version": "1.0.0"/);
  assert.match(version101Prompt, new RegExp(`"generatedPromptVersion": "${SEVENO_PROFESSIONAL_ASSESSMENT_BANK_PROMPT_VERSION}"`));
  const livePrompt = await generateSevenoAssessmentPrompt(adminSession, {
    ...cloneValue(seedVersion!),
    name: 'Brouillon réellement ouvert',
    version: '2.4.6',
    description: 'Description du brouillon réellement ouvert.',
  });
  assert.match(livePrompt.payload.prompt, /Nom du brouillon: Brouillon réellement ouvert/);
  assert.match(livePrompt.payload.prompt, /Version technique du brouillon: 2\.4\.6/);
  assert.match(livePrompt.payload.prompt, /Description du brouillon: Description du brouillon réellement ouvert\./);
  assert.doesNotMatch(livePrompt.payload.prompt, /Socle technique Seven.?O professionnel/);
  assert.doesNotMatch(livePrompt.payload.prompt, /Fixture de test seulement/);
  const blankDescriptionPrompt = buildSevenoProfessionalAssessmentBankPrompt({
    ...cloneValue(seedVersion!),
    description: '',
  });
  assert.match(blankDescriptionPrompt, /Description du brouillon: Description à compléter avant import\./);
  assert.match(blankDescriptionPrompt, /"description": "Description à compléter avant import\./);
  assert.doesNotMatch(blankDescriptionPrompt, /"description": ""/);

  const approvedReviewVersion = cloneValue(seedVersion!);
  approvedReviewVersion.questions[0]!.humanReviewStatus = 'approved_for_pilot';
  const approvedReviewManifest = buildSevenoAssessmentReviewManifest(approvedReviewVersion);
  assert.equal(approvedReviewManifest.humanReviewSummary.approvedForPilot, 1);
  assert.equal(approvedReviewManifest.questions[0]?.humanReviewStatus, 'approved_for_pilot');
  assert.equal(approvedReviewManifest.questions[0]?.decisionFinal, 'approved_for_pilot');

  const previewResponse = await previewSevenoAssessmentVersion(adminSession, seedVersion!, 'essential');
  assert.equal(previewResponse.payload.preview?.mode, 'essential');
  assert.equal(previewResponse.payload.preview?.report.completedPath, 'essential');
  assert.equal(previewResponse.payload.preview?.report.dimensionResults.length, seedVersion!.dimensions.filter((dimension) => dimension.isActive).length);
  assert.doesNotMatch(JSON.stringify(previewResponse.payload.preview?.report ?? {}), /overallScore|globalScore/);

  const publicationRepository = createRepository();
  const firstDraftState = await duplicateSevenoAssessmentVersion(adminSession, seedVersion!.id, publicationRepository);
  assert.ok(firstDraftState.selectedVersion);
  const firstPilotState = await markSevenoAssessmentAsPilot(
    adminSession,
    firstDraftState.selectedVersion!.id,
    firstDraftState.selectedVersion!.revisionNumber,
    publicationRepository,
  );
  assert.equal(firstPilotState.selectedVersion?.status, 'pilot');
  const firstActiveState = await publishSevenoAssessmentVersion(
    adminSession,
    firstDraftState.selectedVersion!.id,
    firstPilotState.selectedVersion?.revisionNumber,
    publicationRepository,
  );
  assert.equal(firstActiveState.selectedVersion?.status, 'active');
  assert.ok(firstActiveState.selectedVersion?.publishedAt);

  const secondDraftState = await duplicateSevenoAssessmentVersion(adminSession, seedVersion!.id, publicationRepository);
  assert.ok(secondDraftState.selectedVersion);
  const secondPilotState = await markSevenoAssessmentAsPilot(
    adminSession,
    secondDraftState.selectedVersion!.id,
    secondDraftState.selectedVersion!.revisionNumber,
    publicationRepository,
  );
  const secondActiveState = await publishSevenoAssessmentVersion(
    adminSession,
    secondDraftState.selectedVersion!.id,
    secondPilotState.selectedVersion?.revisionNumber,
    publicationRepository,
  );
  assert.equal(secondActiveState.selectedVersion?.status, 'active');
  const publicationVersions = await publicationRepository.listVersions();
  assert.equal(publicationVersions.filter((version) => version.status === 'active').length, 1);
  assert.ok(publicationVersions.filter((version) => version.status === 'archived').length >= 1);
  const archivedFirstVersion = publicationVersions.find((version) => version.id === firstActiveState.selectedVersion!.id);
  assert.ok(archivedFirstVersion);
  assert.equal(archivedFirstVersion?.status, 'archived');
  await expectRejects(
    () => updateSevenoAssessmentDraft(adminSession, archivedFirstVersion!.id, archivedFirstVersion!, publicationRepository),
    (error): error is SevenoProfessionalAssessmentRepositoryError => error instanceof SevenoProfessionalAssessmentRepositoryError,
    'version_locked',
  );

  const importedRepository = createRepository();
  const imported = await importSevenoAssessmentVersion(adminSession, buildSevenoAssessmentBankTestJson(seedVersion), importedRepository);
  assert.equal(imported.selectedVersion?.status, 'draft');
  assert.notEqual(imported.selectedVersion?.id, seedVersion!.id);
  assert.equal(imported.selectedVersion?.sourceVersionId, null);
  assert.equal(imported.selectedVersion?.revisionNumber, 1);
  assert.equal(imported.selectedVersion?.generatedPromptVersion, 'seveno_professional_assessment_bank_v1');
  assert.equal(imported.selectedVersion?.essentialPoolSize, 30);
  assert.equal(imported.selectedVersion?.extendedPoolSize, 30);
  assert.equal(imported.selectedVersion?.essentialDrawSize, 20);
  assert.equal(imported.selectedVersion?.extendedDrawSize, 20);
  assert.equal(imported.selectedVersion?.questions.length, 60);
  assert.equal(imported.selectedVersion?.essentialQuestionCount, 30);
  assert.equal(imported.selectedVersion?.extendedQuestionCount, 30);
  assert.ok(imported.selectedVersion?.questions.every((question) => question.isActive));
  assert.ok(imported.validation);

  const v2BankDocument = buildSevenoAssessmentBankTestDocument(seedVersion!, 2);
  const importedV2 = await importSevenoAssessmentVersion(adminSession, JSON.stringify(v2BankDocument), createRepository());
  assert.equal(importedV2.selectedVersion?.schemaVersion, 2);
  assert.ok(importedV2.selectedVersion?.questions[0]?.questionType);
  assert.ok(importedV2.selectedVersion?.questions[0]?.signalReliability);
  assert.deepEqual(importedV2.selectedVersion?.questions[0]?.behaviorModel, v2BankDocument.essentialQuestionPool[0]?.behaviorModel);
  assert.deepEqual(importedV2.selectedVersion?.questions[0]?.options[0]?.behaviorSignals, v2BankDocument.essentialQuestionPool[0]?.options[0]?.behaviorSignals);

  const firstV2Question = v2BankDocument.essentialQuestionPool[0];
  assert.ok(firstV2Question);
  assert.equal(firstV2Question.signalReliability, firstV2Question.behaviorModel?.signalReliability);
  const firstV2BehaviorSignalKeys = [firstV2Question.behaviorModel!.primaryAxisCode, ...firstV2Question.behaviorModel!.secondaryAxisCodes].sort();
  for (const option of firstV2Question.options) {
    assert.deepEqual(Object.keys(option.behaviorSignals ?? {}).sort(), firstV2BehaviorSignalKeys);
  }
  assert.deepEqual(Object.keys(v2BankDocument).sort(), [
    'dimensionConfigurations',
    'essentialQuestionPool',
    'extendedQuestionPool',
    'interpretationBlocks',
    'interviewQuestions',
    'versionMetadata',
  ]);
  assert.equal(v2BankDocument.interpretationBlocks.length, 7);
  for (const group of v2BankDocument.interpretationBlocks) {
    assert.equal(group.blocks.length, 5);
    assert.deepEqual(
      group.blocks.map((block) => [block.minScore, block.maxScore]),
      V2_INTERPRETATION_RANGES,
    );
  }

  const mismatchedSignalReliabilityDocument = JSON.parse(JSON.stringify(v2BankDocument)) as typeof v2BankDocument;
  mismatchedSignalReliabilityDocument.essentialQuestionPool[0]!.signalReliability = 'low';
  mismatchedSignalReliabilityDocument.essentialQuestionPool[0]!.behaviorModel!.signalReliability = 'high';
  await assert.rejects(
    () => importSevenoAssessmentVersion(adminSession, JSON.stringify(mismatchedSignalReliabilityDocument), createRepository()),
    (error: unknown) => error instanceof AssessmentModelError
      && (error as AssessmentModelError & { issues: Array<{ code: string }> }).issues.some((issue) => issue.code === 'bank_question_signal_reliability_mismatch'),
  );

  const extraRootKeyDocument = JSON.parse(JSON.stringify(v2BankDocument)) as typeof v2BankDocument & { unexpectedRoot?: boolean };
  extraRootKeyDocument.unexpectedRoot = true;
  await assert.rejects(
    () => importSevenoAssessmentVersion(adminSession, JSON.stringify(extraRootKeyDocument), createRepository()),
    (error: unknown) => error instanceof AssessmentModelError
      && (error as AssessmentModelError & { issues: Array<{ code: string }> }).issues.some((issue) => issue.code === 'bank_v2_root_keys_mismatch'),
  );

  const missingBehaviorAxisDocument = JSON.parse(JSON.stringify(v2BankDocument)) as typeof v2BankDocument;
  const missingBehaviorAxisCode = firstV2Question.behaviorModel!.secondaryAxisCodes[0] ?? firstV2Question.behaviorModel!.primaryAxisCode;
  delete missingBehaviorAxisDocument.essentialQuestionPool[0]!.options[0]!.behaviorSignals![missingBehaviorAxisCode];
  await assert.rejects(
    () => importSevenoAssessmentVersion(adminSession, JSON.stringify(missingBehaviorAxisDocument), createRepository()),
    (error: unknown) => error instanceof AssessmentModelError
      && (error as AssessmentModelError & { issues: Array<{ code: string }> }).issues.some((issue) => issue.code === 'bank_option_missing_behavior_axis'),
  );

  const extraBehaviorAxisDocument = JSON.parse(JSON.stringify(v2BankDocument)) as typeof v2BankDocument;
  const extraBehaviorAxis = SEVENO_PROFESSIONAL_ASSESSMENT_BEHAVIOR_AXIS_CODES.find(
    (axisCode) => !firstV2BehaviorSignalKeys.includes(axisCode),
  );
  assert.ok(extraBehaviorAxis);
  extraBehaviorAxisDocument.essentialQuestionPool[0]!.options[0]!.behaviorSignals![extraBehaviorAxis!] = 1 as never;
  await assert.rejects(
    () => importSevenoAssessmentVersion(adminSession, JSON.stringify(extraBehaviorAxisDocument), createRepository()),
    (error: unknown) => error instanceof AssessmentModelError
      && (error as AssessmentModelError & { issues: Array<{ code: string }> }).issues.some((issue) => issue.code === 'bank_option_disallowed_behavior_axis'),
  );

  const invalidBlockCountDocument = JSON.parse(JSON.stringify(v2BankDocument)) as typeof v2BankDocument;
  invalidBlockCountDocument.interpretationBlocks[0]!.blocks = invalidBlockCountDocument.interpretationBlocks[0]!.blocks.slice(0, 4);
  await assert.rejects(
    () => importSevenoAssessmentVersion(adminSession, JSON.stringify(invalidBlockCountDocument), createRepository()),
    (error: unknown) => error instanceof AssessmentModelError
      && (error as AssessmentModelError & { issues: Array<{ code: string }> }).issues.some((issue) => issue.code === 'bank_interpretation_invalid_block_count'),
  );

  const invalidRangeDocument = JSON.parse(JSON.stringify(v2BankDocument)) as typeof v2BankDocument;
  invalidRangeDocument.interpretationBlocks[0]!.blocks[0]!.minScore = 1;
  await assert.rejects(
    () => importSevenoAssessmentVersion(adminSession, JSON.stringify(invalidRangeDocument), createRepository()),
    (error: unknown) => error instanceof AssessmentModelError
      && (error as AssessmentModelError & { issues: Array<{ code: string }> }).issues.some((issue) => issue.code === 'bank_interpretation_invalid_range'),
  );

  const strictV2ValidationDocument = buildSevenoAssessmentBankTestDocument(seedVersion!, 2);
  const validStrictV2Validation = validateSevenoProfessionalAssessmentBankDocument(strictV2ValidationDocument);
  assert.equal(validStrictV2Validation.valid, true);

  const invalidSecondaryInfluenceDocument = JSON.parse(JSON.stringify(strictV2ValidationDocument)) as typeof strictV2ValidationDocument;
  invalidSecondaryInfluenceDocument.essentialQuestionPool[0]!.secondaryDimensionCode = 'influence' as never;
  const invalidSecondaryInfluenceValidation = validateSevenoProfessionalAssessmentBankDocument(invalidSecondaryInfluenceDocument);
  assert.equal(invalidSecondaryInfluenceValidation.valid, false);
  assert.ok(invalidSecondaryInfluenceValidation.issues.some((issue) => issue.code === 'bank_question_invalid_secondary_dimension_code'));

  const invalidSecondaryFollowershipDocument = JSON.parse(JSON.stringify(strictV2ValidationDocument)) as typeof strictV2ValidationDocument;
  invalidSecondaryFollowershipDocument.essentialQuestionPool[0]!.secondaryDimensionCode = 'followership' as never;
  const invalidSecondaryFollowershipValidation = validateSevenoProfessionalAssessmentBankDocument(invalidSecondaryFollowershipDocument);
  assert.equal(invalidSecondaryFollowershipValidation.valid, false);
  assert.ok(invalidSecondaryFollowershipValidation.issues.some((issue) => issue.code === 'bank_question_invalid_secondary_dimension_code'));

  const invalidDimensionScoresValueCreationDocument = JSON.parse(JSON.stringify(strictV2ValidationDocument)) as typeof strictV2ValidationDocument;
  invalidDimensionScoresValueCreationDocument.essentialQuestionPool[0]!.options[0]!.dimensionScores.value_creation = 2 as never;
  const invalidDimensionScoresValueCreationValidation = validateSevenoProfessionalAssessmentBankDocument(invalidDimensionScoresValueCreationDocument);
  assert.equal(invalidDimensionScoresValueCreationValidation.valid, false);
  assert.ok(invalidDimensionScoresValueCreationValidation.issues.some((issue) => issue.code === 'bank_option_unknown_dimension'));

  const invalidDimensionScoresRiskOrientationDocument = JSON.parse(JSON.stringify(strictV2ValidationDocument)) as typeof strictV2ValidationDocument;
  invalidDimensionScoresRiskOrientationDocument.essentialQuestionPool[0]!.options[0]!.dimensionScores.risk_orientation = 1 as never;
  const invalidDimensionScoresRiskOrientationValidation = validateSevenoProfessionalAssessmentBankDocument(invalidDimensionScoresRiskOrientationDocument);
  assert.equal(invalidDimensionScoresRiskOrientationValidation.valid, false);
  assert.ok(invalidDimensionScoresRiskOrientationValidation.issues.some((issue) => issue.code === 'bank_option_unknown_dimension'));

  const nonDiscriminantV2Document = JSON.parse(JSON.stringify(strictV2ValidationDocument)) as typeof strictV2ValidationDocument;
  const nonDiscriminantQuestion = nonDiscriminantV2Document.essentialQuestionPool[0];
  assert.ok(nonDiscriminantQuestion);
  const sharedDimensionScores = { ...nonDiscriminantQuestion.options[0]!.dimensionScores };
  nonDiscriminantQuestion.options = nonDiscriminantQuestion.options.map((option) => ({
    ...option,
    dimensionScores: { ...sharedDimensionScores },
  }));
  const nonDiscriminantValidation = validateSevenoProfessionalAssessmentBankDocument(nonDiscriminantV2Document);
  assert.equal(nonDiscriminantValidation.valid, false);
  assert.ok(
    nonDiscriminantValidation.issues.some((issue) => issue.code === 'assessment_question_non_discriminant_dimension_scores'),
  );

  const zeroSpanRuntimeVersion = cloneValue(SEVENO_PROFESSIONAL_ASSESSMENT_TEST_ONLY_VERSION);
  const zeroSpanDimensionCode = zeroSpanRuntimeVersion.dimensions[0]?.code;
  assert.ok(zeroSpanDimensionCode);
  for (const question of zeroSpanRuntimeVersion.questions) {
    if (!question.primaryDimensionCodes.includes(zeroSpanDimensionCode) && !question.secondaryDimensionCodes?.includes(zeroSpanDimensionCode)) {
      continue;
    }

    question.options = question.options.map((option) => ({
      ...option,
      dimensionScores: {
        ...option.dimensionScores,
        [zeroSpanDimensionCode]: 2,
      },
    }));
  }
  const zeroSpanValidation = validateAssessmentScoringStructure(zeroSpanRuntimeVersion);
  assert.equal(zeroSpanValidation.valid, false);
  assert.ok(
    zeroSpanValidation.issues.some((issue) => issue.code === 'assessment_dimension_zero_span'),
  );

  const v1ValidationDocument = buildSevenoAssessmentBankTestDocument(seedVersion!);
  const v1Validation = validateSevenoProfessionalAssessmentBankDocument(v1ValidationDocument);
  assert.equal(v1Validation.valid, true);

  if (repositoryTarget.emulatorHostPresent) {
    const firestoreRepository = getSevenoProfessionalAssessmentRepository();
    assert.ok(firestoreRepository instanceof FirestoreProfessionalAssessmentRepository);
    const importedV2Firestore = await importSevenoAssessmentVersion(adminSession, JSON.stringify(v2BankDocument), firestoreRepository);
    const reloadedV2Firestore = await firestoreRepository.readVersion(importedV2Firestore.selectedVersion!.id);
    assert.ok(reloadedV2Firestore);
    assert.equal(reloadedV2Firestore?.schemaVersion, 2);
    assert.deepEqual(reloadedV2Firestore?.questions[0]?.behaviorModel, v2BankDocument.essentialQuestionPool[0]?.behaviorModel);
    assert.deepEqual(reloadedV2Firestore?.questions[0]?.options[0]?.behaviorSignals, v2BankDocument.essentialQuestionPool[0]?.options[0]?.behaviorSignals);
    await firestoreRepository.deleteVersion(importedV2Firestore.selectedVersion!.id, importedV2Firestore.selectedVersion!.revisionNumber);
  }

  const unknownBehaviorAxisDocument = JSON.parse(JSON.stringify(v2BankDocument)) as typeof v2BankDocument;
  unknownBehaviorAxisDocument.essentialQuestionPool[0]!.options[0]!.behaviorSignals = {
    ...(unknownBehaviorAxisDocument.essentialQuestionPool[0]!.options[0]!.behaviorSignals ?? {}),
    made_up_axis: 1 as never,
  };
  await assert.rejects(
    () => importSevenoAssessmentVersion(adminSession, JSON.stringify(unknownBehaviorAxisDocument), createRepository()),
    (error: unknown) => error instanceof AssessmentModelError
      && (error as AssessmentModelError & { issues: Array<{ code: string }> }).issues.some((issue) => issue.code === 'bank_option_unknown_behavior_axis' || issue.code === 'bank_option_disallowed_behavior_axis'),
  );

  const invalidBehaviorSignalDocument = JSON.parse(JSON.stringify(v2BankDocument)) as typeof v2BankDocument;
  invalidBehaviorSignalDocument.essentialQuestionPool[0]!.options[0]!.behaviorSignals = {
    ...(invalidBehaviorSignalDocument.essentialQuestionPool[0]!.options[0]!.behaviorSignals ?? {}),
    [invalidBehaviorSignalDocument.essentialQuestionPool[0]!.behaviorModel!.primaryAxisCode]: 3 as never,
  };
  await assert.rejects(
    () => importSevenoAssessmentVersion(adminSession, JSON.stringify(invalidBehaviorSignalDocument), createRepository()),
    (error: unknown) => error instanceof AssessmentModelError
      && (error as AssessmentModelError & { issues: Array<{ code: string }> }).issues.some((issue) => issue.code === 'bank_option_invalid_behavior_signal'),
  );

  const importedPreviewVersion = imported.selectedVersion;
  assert.ok(importedPreviewVersion);
  const candidatePreviewSeed = 'smoke-test-candidate-preview-seed';
  const candidatePreviewResponse = await callSevenoAssessmentAdminPreviewCandidateAction(adminSession, importedPreviewVersion, candidatePreviewSeed);
  assert.equal(candidatePreviewResponse.preview.versionId, importedPreviewVersion.id);
  assert.equal(candidatePreviewResponse.preview.questionCount, 40);
  assert.equal(candidatePreviewResponse.preview.essentialQuestionCount, 20);
  assert.equal(candidatePreviewResponse.preview.extendedQuestionCount, 20);
  assert.equal(candidatePreviewResponse.preview.drawSeed, candidatePreviewSeed);

  const directCandidatePreviewResponse = await previewSevenoAssessmentCandidateVersion(adminSession, importedPreviewVersion, candidatePreviewSeed);
  assert.deepEqual(candidatePreviewResponse.preview.essentialQuestionIds, directCandidatePreviewResponse.preview.essentialQuestionIds);
  assert.deepEqual(candidatePreviewResponse.preview.extendedQuestionIds, directCandidatePreviewResponse.preview.extendedQuestionIds);

  const generatedBankDocument = buildSevenoAssessmentBankTestDocument(seedVersion!);
  assert.equal(generatedBankDocument.versionMetadata.description.trim().length > 0, true);
  assert.equal(generatedBankDocument.essentialQuestionPool.length, 30);
  assert.equal(generatedBankDocument.extendedQuestionPool.length, 30);
  assert.equal(generatedBankDocument.interpretationBlocks.length, 7);
  assert.equal(generatedBankDocument.interviewQuestions.length, 7);
  const generatedInformationUnderstandingGroup = generatedBankDocument.interpretationBlocks.find((group) => group.dimensionCode === 'information_understanding');
  assert.ok(generatedInformationUnderstandingGroup);
  assert.deepEqual(generatedInformationUnderstandingGroup?.blocks[0]?.interviewQuestionIds, ['interview-information-understanding-1']);
  assert.deepEqual(generatedInformationUnderstandingGroup?.blocks[1]?.interviewQuestionIds, ['interview-information-understanding-1']);

  for (const question of [...generatedBankDocument.essentialQuestionPool, ...generatedBankDocument.extendedQuestionPool]) {
    const referenceKeys = Object.keys(question.options[0]?.dimensionScores ?? {}).sort();
    assert.ok(referenceKeys.length > 0);
    assert.ok(
      question.options.every((option) => JSON.stringify(Object.keys(option.dimensionScores).sort()) === JSON.stringify(referenceKeys)),
      `Each option in ${question.questionId} must score the same dimensions.`,
    );
  }

  const generatedInterviewQuestionsById = new Map(
    generatedBankDocument.interviewQuestions.map((question) => [question.questionId, question] as const),
  );
  assert.equal(generatedInterviewQuestionsById.size, 7);
  assert.equal(generatedBankDocument.interpretationBlocks.reduce((count, group) => count + group.blocks.length, 0), 35);
  for (const group of generatedBankDocument.interpretationBlocks) {
    for (const block of group.blocks) {
      assert.ok(block.interviewQuestionIds.length > 0);
      for (const interviewQuestionId of block.interviewQuestionIds) {
        const interviewQuestion = generatedInterviewQuestionsById.get(interviewQuestionId);
        assert.ok(interviewQuestion, `Missing interview question reference: ${interviewQuestionId}`);
        assert.equal(interviewQuestion.dimensionCode, group.dimensionCode);
      }
    }
  }

  const analyzedRouteResponse = await callSevenoAssessmentAdminApiAction(
    adminSession,
    'analyze_import_json',
    buildSevenoAssessmentBankTestJson(seedVersion),
    createRepository(),
  );
  const analyzedVersion = analyzedRouteResponse.payload.selectedVersion;
  assert.ok(analyzedVersion);
  assert.equal(analyzedVersion?.description.trim().length > 0, true);
  assert.equal(analyzedVersion?.questions.length, 60);
  assert.equal(analyzedVersion?.essentialQuestionCount, 30);
  assert.equal(analyzedVersion?.extendedQuestionCount, 30);
  assert.equal(analyzedVersion?.dimensions.length, 7);
  assert.ok(analyzedVersion?.questions.every((question) => question.isActive));
  assert.ok(analyzedVersion?.dimensions.every((dimension) => dimension.interviewQuestionIds.length > 0));
  assert.ok(analyzedVersion?.dimensions.every((dimension) => dimension.interpretationThresholds.length === 5));
  const analyzedInformationUnderstandingDimension = analyzedVersion?.dimensions.find((dimension) => dimension.code === 'information_understanding');
  assert.ok(analyzedInformationUnderstandingDimension);
  assert.deepEqual(analyzedInformationUnderstandingDimension?.interpretationThresholds[0]?.interviewQuestionIds, ['interview-information-understanding-1']);
  assert.deepEqual(analyzedInformationUnderstandingDimension?.interpretationThresholds[1]?.interviewQuestionIds, ['interview-information-understanding-1']);
  assert.equal(
    analyzedVersion?.dimensions.reduce(
      (count, dimension) => count + dimension.interpretationThresholds.reduce(
        (thresholdCount, threshold) => thresholdCount + threshold.interviewQuestionIds.length,
        0,
      ),
      0,
    ),
    35,
  );

  const inconsistentScoresDocument = JSON.parse(buildSevenoAssessmentBankTestJson(seedVersion)) as {
    essentialQuestionPool: Array<{ options: Array<{ dimensionScores: Record<string, number> }> }>;
  };
  const inconsistentScoresQuestion = inconsistentScoresDocument.essentialQuestionPool[0];
  assert.ok(inconsistentScoresQuestion);
  const inconsistentScoresKeys = Object.keys(inconsistentScoresQuestion.options[0]?.dimensionScores ?? {});
  assert.ok(inconsistentScoresKeys.length > 0);
  delete inconsistentScoresQuestion.options[1]!.dimensionScores[inconsistentScoresKeys[0]!];
  await assert.rejects(
    () => importSevenoAssessmentVersion(adminSession, JSON.stringify(inconsistentScoresDocument), createRepository()),
    (error: unknown) => error instanceof AssessmentModelError
      && (error as AssessmentModelError & { issues: Array<{ code: string }> }).issues.some((issue) => issue.code === 'bank_question_dimension_key_mismatch' || issue.code === 'bank_question_option_dimension_mismatch'),
  );

  const missingInterviewReferenceDocument = JSON.parse(buildSevenoAssessmentBankTestJson(seedVersion)) as {
    interpretationBlocks: Array<{ blocks: Array<{ interviewQuestionIds: string[] }> }>;
  };
  missingInterviewReferenceDocument.interpretationBlocks[0]!.blocks[0]!.interviewQuestionIds = ['interview-missing-1'];
  await assert.rejects(
    () => importSevenoAssessmentVersion(adminSession, JSON.stringify(missingInterviewReferenceDocument), createRepository()),
    (error: unknown) => error instanceof AssessmentModelError
      && (error as AssessmentModelError & { issues: Array<{ code: string }> }).issues.some((issue) => issue.code === 'bank_interpretation_missing_interview_question_reference'),
  );

  const promptDraft = cloneValue(createSevenoProfessionalAssessmentSeedVersion());
  promptDraft.questions[0].adminRationale = '';
  const generatedPrompt = await generateSevenoAssessmentPrompt(adminSession, promptDraft);
  assert.match(generatedPrompt.payload.prompt, /Tu es un générateur de banque d analyse professionnelle SevenO\./);

  await assert.rejects(
    () => importSevenoAssessmentVersion(adminSession, '{', importedRepository),
    (error: unknown) => error instanceof AssessmentModelError,
  );

  const routeSource = readSource('app/api/admin/evaluation-seveno/route.ts');
  assert.match(routeSource, /Cache-Control/);
  assert.match(routeSource, /revisionNumber/);
  assert.match(routeSource, /requireSevenoAdminSessionFromRequest/);
  assert.match(routeSource, /SevenoAdminAuthError/);
  assert.match(routeSource, /preview_candidate_version/);

  const editorSource = readSource('components/admin/SevenoProfessionalAssessmentEditor.tsx');
  assert.match(editorSource, /Générer le prompt IA/);
  assert.match(editorSource, /canPreviewVersion/);
  assert.match(editorSource, /La prévisualisation nécessite une banque valide importée\./);
  assert.match(editorSource, /Le prompt IA peut être généré sans prévisualisation\./);
  assert.match(editorSource, /Prompt à transmettre à votre IA/);
  assert.match(editorSource, /Prompt complet à copier/);
  assert.match(editorSource, /Copiez ce prompt dans l’IA de votre choix\./);
  assert.match(editorSource, /handleCopyPrompt/);
  assert.match(editorSource, /Prompt copié/);
  assert.match(editorSource, /Le prompt reste affiché tant qu’un nouveau prompt n’est pas généré\./);
  assert.match(editorSource, /Réponse JSON générée par l’IA/);
  assert.match(editorSource, /Collez ici uniquement le JSON renvoyé par l’IA, pas le prompt\./);
  assert.match(editorSource, /Prévisualiser la banque/);
  assert.match(editorSource, /Prévisualiser le questionnaire candidat/);
  assert.match(editorSource, /Banque et rapport/);
  assert.match(editorSource, /Projection candidat/);
  assert.match(editorSource, /Projection entreprise/);
  assert.match(editorSource, /ProfessionalAssessmentCandidatePreview/);
  assert.doesNotMatch(editorSource, /interviewQuestionIds:\s*questionIds/);
  assert.doesNotMatch(editorSource, /questionIds\.length > 0 \? questionIds : \[\]/);
  assert.doesNotMatch(editorSource, /company_application/);
  assert.doesNotMatch(editorSource, /Parcours candidat et rapport/);
  assert.doesNotMatch(editorSource, /Rapport candidat/);

  const candidatePreviewSource = readSource('components/admin/seveno-assessment-preview/ProfessionalAssessmentCandidatePreview.tsx');
  assert.match(candidatePreviewSource, /Questionnaire candidat Seven/);
  assert.match(candidatePreviewSource, /Examiner les 60 questions/);
  assert.match(candidatePreviewSource, /Simuler un tirage candidat/);
  assert.match(candidatePreviewSource, /Générer un autre tirage/);
  assert.match(candidatePreviewSource, /Voir les informations internes/);
  assert.match(candidatePreviewSource, /Ordinateur/);
  assert.match(candidatePreviewSource, /Mobile/);

  const originalFetch = globalThis.fetch;
  const apiIssues = [
    {
      code: 'bank_invalid_json',
      path: 'root',
      message: 'Le JSON importé est invalide.',
      severity: 'error',
    },
  ];
  try {
    globalThis.fetch = (async () => new Response(JSON.stringify({
      error: 'invalid_json',
      message: 'La version SevenO professionnelle est invalide.',
      issues: apiIssues,
    }), {
      status: 422,
      headers: {
        'Content-Type': 'application/json',
      },
    })) as typeof fetch;

    await assert.rejects(
      () => fetchSevenoAdminApi('/api/admin/evaluation-seveno', {
        headers: {
          Authorization: buildAuthorizationHeader(adminSession),
        },
      }),
      (error: unknown) => error instanceof SevenoAdminApiError
        && error.status === 422
        && error.message === 'La version SevenO professionnelle est invalide.'
        && JSON.stringify(error.issues) === JSON.stringify(apiIssues),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  const navSource = readSource('lib/seveno-navigation.ts');
  assert.match(navSource, /\/admin\/evaluation-seveno/);
  assert.match(navSource, /Analyse professionnelle/);

  const adminSectionNavSource = readSource('components/admin/AdminSectionNav.tsx');
  assert.match(adminSectionNavSource, /\/admin\/evaluation-seveno/);
  assert.match(adminSectionNavSource, /Analyse professionnelle/);

  const adminOverviewSource = readSource('app/admin/page.tsx');
  assert.match(adminOverviewSource, /Actualiser les donnees/);
  assert.match(adminOverviewSource, /candidate\.sevenoAssessment/);
  assert.doesNotMatch(adminOverviewSource, /candidate\.testPassed\s*\?/);
  assert.doesNotMatch(adminOverviewSource, /candidate\.verifiedScore/);
  assert.doesNotMatch(adminOverviewSource, /overallScore\s*\?\?\s*0/);
  assert.match(adminOverviewSource, /Non calcul/);

  const adminCandidatesSource = readSource('app/admin/candidats/page.tsx');
  assert.match(adminCandidatesSource, /Actualiser les donnees/);
  assert.match(adminCandidatesSource, /candidate\.sevenoAssessment/);
  assert.match(adminCandidatesSource, /Questionnaire Seven/);
  assert.doesNotMatch(adminCandidatesSource, /candidate\.testPassed\s*\?/);
  assert.doesNotMatch(adminCandidatesSource, /candidate\.verifiedScore/);
  assert.doesNotMatch(adminCandidatesSource, /overallScore\s*\?\?\s*0/);
  assert.match(adminCandidatesSource, /Non calcul/);

  const adminCandidateDetailSource = readSource('app/admin/candidats/[uid]/page.tsx');
  assert.match(adminCandidateDetailSource, /Actualiser les donnees/);
  assert.match(adminCandidateDetailSource, /Questionnaire Seven/);
  assert.match(adminCandidateDetailSource, /candidate\.sevenoAssessment/);
  assert.match(adminCandidateDetailSource, /candidateSummaryItems/);
  assert.match(adminCandidateDetailSource, /behavioralProfile/);
  assert.match(adminCandidateDetailSource, /professionalAssessmentVersionId/);
  assert.match(adminCandidateDetailSource, /professionalAssessmentSchemaVersion/);
  assert.match(adminCandidateDetailSource, /completedAt/);
  assert.match(adminCandidateDetailSource, /overallScore/);
  assert.match(adminCandidateDetailSource, /scoresByDimension/);
  assert.doesNotMatch(adminCandidateDetailSource, /candidate\.testPassed\s*\?/);
  assert.doesNotMatch(adminCandidateDetailSource, /candidate\.verifiedScore/);
  assert.doesNotMatch(adminCandidateDetailSource, /overallScore\s*\?\?\s*0/);
  assert.match(adminCandidateDetailSource, /Non calcul/);

  const mergedSummary = resolveAdminSevenoAssessmentSummary({
    profile: {
      sevenoAssessmentStatus: 'completed',
      sevenoAssessmentOverallScore: null,
      sevenoAssessmentDimensions: {},
      sevenoAssessmentVersion: null,
      sevenoAssessmentCompletedAt: null,
      sevenoAssessmentSessionId: null,
      sevenoAssessmentResultId: null,
    },
    summary: {
      status: 'completed',
      overallScore: null,
      scoresByDimension: {},
      completedAt: null,
      sessionId: null,
      resultId: null,
      questionnaireVersion: null,
      professionalAssessmentVersionId: null,
      professionalAssessmentSchemaVersion: null,
      candidateSummaryItems: [],
      candidateSummary: null,
      behavioralProfile: null,
    },
    result: {
      uid: 'test-user',
      publicCandidateId: 'SEV-CAND-TEST',
      sessionId: 'session-test',
      candidateProfileId: 'test-user',
      sectorId: 'sector-test',
      jobFamilyId: 'family-test',
      jobRoleId: 'role-test',
      questionBankCode: 'seveno_professional_assessment_bank_1_1_0_test',
      questionBankVersion: '1.1.0',
      assessmentType: 'seveno_general',
      score: 71,
      overallScore: 71,
      scoresByDimension: {
        collaboration: 75,
        problem_solving: 67,
      },
      questionnaireVersion: '1.1.0',
      professionalAssessmentVersionId: 'seveno-professional-assessment-bank-2a4319d5ee49',
      professionalAssessmentSchemaVersion: 2,
      candidateSummaryItems: ['Résumé depuis le résultat'],
      candidateSummary: 'Résumé depuis le résultat',
      behavioralProfile: {
        axisResults: [],
        candidateSummaryItems: ['Résumé depuis le résultat'],
        companySummaryItems: [],
        candidateSummary: 'Résumé depuis le résultat',
        companySummary: null,
        disclaimer: null,
      } as ProfessionalAssessmentBehavioralProfile,
      correctAnswers: 0,
      totalQuestions: 40,
      passed: true,
      threshold: 0,
      durationSeconds: 1200,
      answersCount: 40,
      submittedAt: new Date('2026-07-30T08:00:00.000Z'),
      createdAt: new Date('2026-07-30T08:00:00.000Z'),
      verifiedAt: new Date('2026-07-30T08:00:00.000Z'),
    } as TestResult,
  });
  assert.equal(mergedSummary.overallScore, 71);
  assert.deepEqual(mergedSummary.scoresByDimension, {
    collaboration: 75,
    problem_solving: 67,
  });
  assert.deepEqual(mergedSummary.candidateSummaryItems, ['Résumé depuis le résultat']);
  assert.equal(mergedSummary.candidateSummary, 'Résumé depuis le résultat');

  const repoSource = readSource('lib/seveno-professional-assessment-admin-repository.ts');
  assert.match(repoSource, /revision_conflict/);
  assert.match(repoSource, /professional_assessment_versions/);

  if (getSevenoProfessionalAssessmentRepository() instanceof FirestoreProfessionalAssessmentRepository) {
    assert.equal(isSevenoProfessionalAssessmentFirestoreRepositoryEnabledFlag(), true);
    assert.ok(getSevenoProfessionalAssessmentRepository() instanceof FirestoreProfessionalAssessmentRepository);

    const firestoreRepository = new FirestoreProfessionalAssessmentRepository();
    const persistedDraft = await firestoreRepository.createDraft({ blank: true });
    assert.equal(persistedDraft.revisionNumber, 1);
    const persistedDraftReloaded = await firestoreRepository.readVersion(persistedDraft.id);
    assert.ok(persistedDraftReloaded);
    const persistedDraftVersion = persistedDraftReloaded as NonNullable<typeof persistedDraftReloaded>;
    assert.equal(persistedDraftVersion.name, persistedDraft.name);

    const updatedDraftInput = {
      ...cloneValue(persistedDraftVersion),
      name: 'TEST PERSISTANCE EMULATEUR - A SUPPRIMER',
      description: 'Brouillon local créé sur l émulateur Firestore.',
      revisionNumber: persistedDraftVersion.revisionNumber,
    };
    const savedDraft = await firestoreRepository.updateDraft(persistedDraft.id, updatedDraftInput);
    assert.equal(savedDraft.revisionNumber, 2);

    const reopenedRepository = new FirestoreProfessionalAssessmentRepository();
    const afterRestart = await reopenedRepository.readVersion(persistedDraft.id);
    assert.ok(afterRestart);
    const afterRestartVersion = afterRestart as NonNullable<typeof afterRestart>;
    assert.equal(afterRestartVersion.name, 'TEST PERSISTANCE EMULATEUR - A SUPPRIMER');
    assert.equal(afterRestartVersion.description, 'Brouillon local créé sur l émulateur Firestore.');
    assert.equal(afterRestartVersion.revisionNumber, 2);

    const staleUpdate = {
      ...cloneValue(persistedDraftVersion),
      name: 'Version obsolète',
      revisionNumber: persistedDraftVersion.revisionNumber,
    };
    await assert.rejects(
      reopenedRepository.updateDraft(persistedDraft.id, staleUpdate),
      (error: unknown) => error instanceof SevenoProfessionalAssessmentRepositoryError && error.code === 'revision_conflict',
    );
    const afterConflict = await reopenedRepository.readVersion(persistedDraft.id);
    const afterConflictVersion = afterConflict as NonNullable<typeof afterConflict>;
    assert.equal(afterConflictVersion.name, 'TEST PERSISTANCE EMULATEUR - A SUPPRIMER');
    assert.equal(afterConflictVersion.revisionNumber, 2);

    if (process.env.FIRESTORE_EMULATOR_HOST) {
      const rulesTestEnv = await initializeTestEnvironment({
        projectId: 'demo-seveno-local',
        firestore: {
          host: '127.0.0.1',
          port: 8080,
          rules: readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8'),
        },
      });

      try {
        const rulesCollection = 'professional_assessment_versions';
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

        await assertFails(unauthenticated.firestore().collection(rulesCollection).doc(persistedDraft.id).get());
        await assertFails(candidate.firestore().collection(rulesCollection).doc(persistedDraft.id).get());
        await assertFails(company.firestore().collection(rulesCollection).doc(persistedDraft.id).get());
        await assertFails(admin.firestore().collection(rulesCollection).doc(persistedDraft.id).get());
        await assertFails(unauthenticated.firestore().collection(rulesCollection).doc(`${persistedDraft.id}-write`).set({ foo: 'bar' }));
        await assertFails(candidate.firestore().collection(rulesCollection).doc(`${persistedDraft.id}-write`).set({ foo: 'bar' }));
        await assertFails(company.firestore().collection(rulesCollection).doc(`${persistedDraft.id}-write`).set({ foo: 'bar' }));
        await assertFails(admin.firestore().collection(rulesCollection).doc(`${persistedDraft.id}-write`).set({ foo: 'bar' }));
      } finally {
        await rulesTestEnv.cleanup();
      }
    } else {
      console.log('Firestore rules validation skipped: no local emulator configured.');
    }

    await reopenedRepository.deleteVersion(persistedDraft.id, afterConflict?.revisionNumber);
    assert.equal(await reopenedRepository.readVersion(persistedDraft.id), null);
  } else {
    console.log('Firestore persistence validation skipped: repository mode is memory.');
  }

  console.log('SevenO assessment admin smoke test: OK');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
