import assert from 'node:assert/strict';
import net from 'node:net';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  SevenoAssessmentAdminError,
  createSevenoAssessmentBlankDraft,
  deleteSevenoAssessmentUnusedDraft,
  duplicateSevenoAssessmentVersion,
  generateSevenoAssessmentPrompt,
  importSevenoAssessmentVersion,
  loadSevenoAssessmentEditorState,
  markSevenoAssessmentAsPilot,
  previewSevenoAssessmentVersion,
  publishSevenoAssessmentVersion,
  updateSevenoAssessmentDraft,
  validateSevenoAssessmentDraft,
} from '@/lib/seveno-professional-assessment-admin-server';
import { SevenoAdminApiError, fetchSevenoAdminApi } from '@/lib/seveno-admin-api';
import {
  SEVENO_PROFESSIONAL_ASSESSMENT_BANK_PROMPT_VERSION,
  buildSevenoProfessionalAssessmentBankPrompt,
} from '@/lib/seveno-professional-assessment-bank';
import { AssessmentModelError, SEVENO_PROFESSIONAL_ASSESSMENT_DIMENSION_CODES } from '@/lib/seveno-professional-assessment';
import {
  FirestoreProfessionalAssessmentRepository,
  SevenoProfessionalAssessmentRepository,
  SevenoProfessionalAssessmentRepositoryError,
  createSevenoProfessionalAssessmentSeedVersion,
  getSevenoProfessionalAssessmentRepository,
} from '@/lib/seveno-professional-assessment-admin-repository';
import { SEVENO_PROFESSIONAL_ASSESSMENT_TEST_ONLY_VERSION } from '@/lib/seveno-professional-assessment-fixtures';
import { isSevenoProfessionalAssessmentFirestoreRepositoryEnabledFlag } from '@/lib/seveno-professional-assessment-admin-repository';
import { assertFails, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import type { SevenoAdminSession } from '@/lib/seveno-admin-auth';
import { buildSevenoAssessmentBankTestJson } from './seveno-assessment-bank-test-utils.mts';

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
  const repositoryMode = process.env.SEVENO_PROFESSIONAL_ASSESSMENT_ADMIN_STORE ?? 'memory';
  const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST ?? null;

  return {
    repositoryMode,
    projectId,
    emulatorHostPresent: Boolean(emulatorHost),
    collection: 'professional_assessment_versions',
    safetyGate: emulatorHost ? 'local_emulator' : 'production_guard_only',
  };
}

function configureFirestoreEmulatorEnvironment() {
  const projectId = process.env.SEVENO_EMULATOR_PROJECT_ID ?? 'demo-seveno-local';
  process.env.GCLOUD_PROJECT = projectId;
  process.env.PROJECT_ID = projectId;
  process.env.FIREBASE_ADMIN_PROJECT_ID = projectId;
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = projectId;
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
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

function cloneValue<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

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
    console.warn('Production Firebase project detected without a local Firestore emulator. Firestore write validation remains blocked.');
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
  if (process.env.SEVENO_PROFESSIONAL_ASSESSMENT_ADMIN_STORE === 'firestore') {
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
  assert.ok(imported.validation);

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

  const editorSource = readSource('components/admin/SevenoProfessionalAssessmentEditor.tsx');
  assert.match(editorSource, /Générer le prompt IA/);
  assert.match(editorSource, /canPreviewVersion/);
  assert.match(editorSource, /La prévisualisation nécessite une banque valide importée\./);
  assert.match(editorSource, /Le prompt IA peut être généré sans prévisualisation\./);
  assert.match(editorSource, /handleCopyPrompt/);
  assert.match(editorSource, /placeholder="Cliquez sur « Générer le prompt IA » pour afficher le texte ici\."/);
  assert.match(editorSource, /Prévisualiser la banque/);
  assert.match(editorSource, /Banque et rapport/);
  assert.match(editorSource, /Projection candidat/);
  assert.match(editorSource, /Projection entreprise/);
  assert.doesNotMatch(editorSource, /Parcours candidat et rapport/);
  assert.doesNotMatch(editorSource, /Rapport candidat/);

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
      () => fetchSevenoAdminApi('/api/admin/evaluation-seveno'),
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

  const repoSource = readSource('lib/seveno-professional-assessment-admin-repository.ts');
  assert.match(repoSource, /revision_conflict/);
  assert.match(repoSource, /professional_assessment_versions/);

  if (process.env.SEVENO_PROFESSIONAL_ASSESSMENT_ADMIN_STORE === 'firestore') {
    configureFirestoreEmulatorEnvironment();
    try {
      await assertFirestoreEmulatorAvailable();
    } catch (error) {
      console.warn('Firestore persistence validation skipped:', error instanceof Error ? error.message : String(error));
      console.warn('The repository would otherwise point to the local emulator, but the emulator is not running.');
      return;
    }

    assert.equal(repositoryTarget.projectId, 'demo-seveno-local');
    assert.equal(repositoryTarget.emulatorHostPresent, true);
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

    await reopenedRepository.deleteUnusedDraft(persistedDraft.id, afterConflict?.revisionNumber);
    assert.equal(await reopenedRepository.readVersion(persistedDraft.id), null);
  } else {
    console.log('Firestore persistence validation skipped: repository mode is memory. Set SEVENO_PROFESSIONAL_ASSESSMENT_ADMIN_STORE=firestore with a local emulator to run the Firestore round-trip checks.');
  }

  console.log('SevenO assessment admin smoke test: OK');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
