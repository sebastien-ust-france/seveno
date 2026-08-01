import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { connect } from 'node:net';
import type {
  AdminPrerequisiteSuggestionDetailPayload,
  AdminPrerequisiteSuggestionListPayload,
} from '@/types/seveno-admin';

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

function configureEmulatorEnvironment() {
  const projectId = process.env.SEVENO_EMULATOR_PROJECT_ID ?? 'seveno-emulator';
  if (projectId === 'seveno-a8eb1') {
    throw new Error('Le test refuse explicitement le projectId de production seveno-a8eb1.');
  }
  process.env.GCLOUD_PROJECT = projectId;
  process.env.PROJECT_ID = projectId;
  process.env.FIREBASE_ADMIN_PROJECT_ID = projectId;
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = projectId;
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
}

async function assertFirestoreEmulatorAvailable() {
  const target = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
  const separator = target.lastIndexOf(':');
  const host = target.slice(0, separator);
  const port = Number(target.slice(separator + 1));
  if (!host || !Number.isInteger(port)) throw new Error(`FIRESTORE_EMULATOR_HOST invalide : ${target}`);
  await new Promise<void>((resolveConnection, rejectConnection) => {
    const socket = connect({ host, port });
    const timeout = setTimeout(() => {
      socket.destroy();
      rejectConnection(new Error(`Firestore Emulator indisponible sur ${target} après 2 secondes.`));
    }, 2_000);
    socket.once('connect', () => {
      clearTimeout(timeout);
      socket.end();
      resolveConnection();
    });
    socket.once('error', (error) => {
      clearTimeout(timeout);
      rejectConnection(new Error(`Firestore Emulator indisponible sur ${target} : ${error.message}`));
    });
  });
}

async function main() {
  loadDotEnvFile(resolve(process.cwd(), '.env.local'));
  configureEmulatorEnvironment();
  console.log('Prerequisite suggestion emulator test: vérification de Firestore Emulator...');
  await assertFirestoreEmulatorAvailable();

  const { Timestamp } = await import('firebase-admin/firestore');
  const { adminDb } = await import('@/lib/firebase-admin');
  const { createJobOffer, updateJobOffer, jobOfferToInput } = await import('@/lib/seveno-job-offers-server');
  const {
    getAdminPrerequisiteSuggestionDetail,
    loadAdminPrerequisiteSuggestions,
  } = await import('@/lib/seveno-prerequisite-suggestions-admin');
  const {
    buildPrerequisiteSuggestionGroupingKey,
    buildPrerequisiteSuggestionId,
    buildPrerequisiteSuggestionUsageId,
  } = await import('@/lib/seveno-prerequisite-suggestions-server');
  const {
    createCompanyPrerequisite,
    createPrerequisite,
  } = await import('@/lib/seveno-prerequisites-server');

  const firestore = adminDb;
  if (!firestore) {
    throw new Error('Firebase Admin Firestore is not configured.');
  }

  const now = Timestamp.now();
  const adminUid = 'admin-suggestions';
  const companyAUid = 'company-a-suggestions';
  const companyBUid = 'company-b-suggestions';
  const candidateUid = 'candidate-suggestions';
  const sectorId = 'informatique-et-numerique';
  const jobFamilyId = 'informatique-et-numerique-developpement-logiciel';
  const jobRoleId = 'informatique-et-numerique-developpement-logiciel-developpeur-full-stack';
  const controlLabel = 'Controle interne';
  const visaLabel = 'Visa chantier';
  const controlSuggestionId = buildPrerequisiteSuggestionId(buildPrerequisiteSuggestionGroupingKey(controlLabel));
  const visaSuggestionId = buildPrerequisiteSuggestionId(buildPrerequisiteSuggestionGroupingKey(visaLabel));

  await Promise.all([
    firestore.collection('users').doc(adminUid).set({
      uid: adminUid,
      role: 'admin',
      authProvider: 'password',
      email: 'admin.suggestions@seveno.test',
      emailVerified: true,
      displayName: 'Admin suggestions',
      onboardingCompleted: true,
      createdAt: now,
      updatedAt: now,
    }),
    firestore.collection('users').doc(companyAUid).set({
      uid: companyAUid,
      role: 'company',
      authProvider: 'password',
      email: 'company.a@seveno.test',
      emailVerified: true,
      displayName: 'Entreprise A',
      onboardingCompleted: true,
      createdAt: now,
      updatedAt: now,
    }),
    firestore.collection('users').doc(companyBUid).set({
      uid: companyBUid,
      role: 'company',
      authProvider: 'password',
      email: 'company.b@seveno.test',
      emailVerified: true,
      displayName: 'Entreprise B',
      onboardingCompleted: true,
      createdAt: now,
      updatedAt: now,
    }),
    firestore.collection('users').doc(candidateUid).set({
      uid: candidateUid,
      role: 'candidate',
      authProvider: 'password',
      email: 'candidate.suggestions@seveno.test',
      emailVerified: true,
      displayName: 'Candidat test',
      onboardingCompleted: true,
      createdAt: now,
      updatedAt: now,
    }),
    firestore.collection('company_profiles').doc(companyAUid).set({
      uid: companyAUid,
      companyName: 'Entreprise A',
      companyType: 'SAS',
      businessSector: 'BTP',
      companySize: '10_49',
      headquartersArea: 'Gironde',
      recruitmentAreas: ['Gironde'],
      contactRole: 'Direction',
      profileStatus: 'active',
      verificationStatus: 'verified',
      createdAt: now,
      updatedAt: now,
    }),
    firestore.collection('company_profiles').doc(companyBUid).set({
      uid: companyBUid,
      companyName: 'Entreprise B',
      companyType: 'SARL',
      businessSector: 'BTP',
      companySize: '10_49',
      headquartersArea: 'Gironde',
      recruitmentAreas: ['Gironde'],
      contactRole: 'RH',
      profileStatus: 'active',
      verificationStatus: 'verified',
      createdAt: now,
      updatedAt: now,
    }),
  ]);

  const baseOfferInput = {
    sectorId,
    jobFamilyId,
    jobRoleId,
    location: 'Gironde',
    workMode: 'onsite' as const,
    contractType: 'permanent' as const,
    workingTime: 'full_time' as const,
    questionnaireRequired: false,
    questionnaireId: '',
    requiredPrerequisites: [],
    preferredPrerequisites: [],
  };

  let offerA = await createJobOffer(companyAUid, {
    ...baseOfferInput,
    title: 'Chef de chantier controle',
    description: 'Organisation des equipes et suivi des chantiers.',
    missions: 'Coordonner les equipes, verifier la securite et le suivi.',
    profileSummary: 'Experience terrain en coordination.',
  });
  const controlPrerequisiteA = await createCompanyPrerequisite(companyAUid, offerA, {
    offerId: offerA.id,
    label: controlLabel,
    saveToLibrary: false,
  });

  offerA = await updateJobOffer(companyAUid, offerA.id, {
    ...jobOfferToInput(offerA),
    requiredPrerequisites: [
      {
        prerequisiteId: controlPrerequisiteA.prerequisiteId,
        expectedCriterion: true,
      },
    ],
    preferredPrerequisites: [],
  });

  let offerB = await createJobOffer(companyBUid, {
    ...baseOfferInput,
    title: 'Chef de chantier controle B',
    description: 'Organisation des equipes et suivi des chantiers.',
    missions: 'Coordonner les equipes, verifier la securite et le suivi.',
    profileSummary: 'Experience terrain en coordination.',
  });
  const controlPrerequisiteB = await createCompanyPrerequisite(companyBUid, offerB, {
    offerId: offerB.id,
    label: controlLabel,
    saveToLibrary: false,
  });

  offerB = await updateJobOffer(companyBUid, offerB.id, {
    ...jobOfferToInput(offerB),
    requiredPrerequisites: [
      {
        prerequisiteId: controlPrerequisiteB.prerequisiteId,
        expectedCriterion: true,
      },
    ],
    preferredPrerequisites: [],
  });

  let offerC = await createJobOffer(companyAUid, {
    ...baseOfferInput,
    title: 'Chef de chantier visa',
    description: 'Suivi des autorisations et verification terrain.',
    missions: 'Verifier les autorisations et la conformite des dossiers.',
    profileSummary: 'Gestion documentaire du chantier.',
  });
  const visaPrerequisite = await createCompanyPrerequisite(companyAUid, offerC, {
    offerId: offerC.id,
    label: visaLabel,
    saveToLibrary: false,
  });

  offerC = await updateJobOffer(companyAUid, offerC.id, {
    ...jobOfferToInput(offerC),
    requiredPrerequisites: [
      {
        prerequisiteId: visaPrerequisite.prerequisiteId,
        expectedCriterion: true,
      },
    ],
    preferredPrerequisites: [],
  });

  const controlBeforeIdempotence = await firestore.collection('prerequisite_suggestions').doc(controlSuggestionId).get();
  assert.ok(controlBeforeIdempotence.exists, 'Control suggestion should exist before idempotence check.');
  assert.equal(controlBeforeIdempotence.get('usageCount'), 2);
  assert.equal(controlBeforeIdempotence.get('companyCount'), 2);
  assert.equal(controlBeforeIdempotence.get('requiredCount'), 2);
  assert.equal(controlBeforeIdempotence.get('preferredCount'), 0);
  assert.equal(controlBeforeIdempotence.get('status'), 'pending');

  const controlUsageAPath = firestore
    .collection('prerequisite_suggestions')
    .doc(controlSuggestionId)
    .collection('usages')
    .doc(buildPrerequisiteSuggestionUsageId(companyAUid, offerA.id, controlPrerequisiteA.prerequisiteId));
  const controlUsageA = await controlUsageAPath.get();
  assert.ok(controlUsageA.exists, 'Control usage A should exist.');
  assert.equal(controlUsageA.get('active'), true);
  assert.equal(controlUsageA.get('importance'), 'required');

  const controlCompanyA = await firestore
    .collection('prerequisite_suggestions')
    .doc(controlSuggestionId)
    .collection('companies')
    .doc(companyAUid)
    .get();
  assert.ok(controlCompanyA.exists, 'Control company A aggregate should exist.');
  assert.equal(controlCompanyA.get('activeUsageCount'), 1);

  const controlIdempotenceInput = {
    ...jobOfferToInput(offerA),
    missions: `${offerA.missions} et suivi documentaire.`,
  };
  await updateJobOffer(companyAUid, offerA.id, controlIdempotenceInput);

  const controlAfterIdempotence = await firestore.collection('prerequisite_suggestions').doc(controlSuggestionId).get();
  assert.equal(controlAfterIdempotence.get('usageCount'), 2);
  assert.equal(controlAfterIdempotence.get('companyCount'), 2);
  assert.equal(controlAfterIdempotence.get('requiredCount'), 2);
  assert.equal(controlAfterIdempotence.get('preferredCount'), 0);

  const controlPreferredInput = {
    ...jobOfferToInput(offerA),
    requiredPrerequisites: [],
    preferredPrerequisites: [
      {
        prerequisiteId: controlPrerequisiteA.prerequisiteId,
        expectedCriterion: true,
      },
    ],
    missions: `${offerA.missions} et coordination documentaire.`,
  };
  offerA = await updateJobOffer(companyAUid, offerA.id, controlPreferredInput);

  const controlAfterPreferenceShift = await firestore.collection('prerequisite_suggestions').doc(controlSuggestionId).get();
  assert.equal(controlAfterPreferenceShift.get('usageCount'), 2);
  assert.equal(controlAfterPreferenceShift.get('companyCount'), 2);
  assert.equal(controlAfterPreferenceShift.get('requiredCount'), 1);
  assert.equal(controlAfterPreferenceShift.get('preferredCount'), 1);
  const controlUsageAAfterPreferenceShift = await controlUsageAPath.get();
  assert.equal(controlUsageAAfterPreferenceShift.get('importance'), 'preferred');

  const canonicalControl = await createPrerequisite(adminUid, {
    code: 'controle-interne-seveno',
    category: 'other_professional',
    companyLabel: controlLabel,
    candidateQuestion: 'Le candidat respecte-t-il le controle interne ?',
    answerType: 'boolean',
    options: [],
    criterionMode: 'fixed',
    defaultCriterion: true,
    allowedCriterionValues: [],
    comparisonOperator: 'equals',
    responseScope: 'profile_reusable',
    evidencePolicy: 'none',
    applicability: {
      global: false,
      sectorIds: [sectorId],
      jobFamilyIds: [jobFamilyId],
      jobRoleIds: [jobRoleId],
      excludedSectorIds: [],
      excludedJobFamilyIds: [],
      excludedJobRoleIds: [],
    },
    status: 'active',
  }, {
    source: 'seveno',
  });
  assert.equal(canonicalControl.code, 'controle-interne-seveno');

  offerB = await updateJobOffer(companyBUid, offerB.id, {
    ...jobOfferToInput(offerB),
    missions: `${offerB.missions} et coordination documentaire.`,
  });

  const controlAfterMerge = await firestore.collection('prerequisite_suggestions').doc(controlSuggestionId).get();
  assert.equal(controlAfterMerge.get('status'), 'merged');
  assert.equal(controlAfterMerge.get('canonicalPrerequisiteCode'), 'controle-interne-seveno');
  assert.equal(controlAfterMerge.get('usageCount'), 2);
  assert.equal(controlAfterMerge.get('companyCount'), 2);
  assert.equal(controlAfterMerge.get('searchKeys').includes('controle interne'), true);

  const visaBeforeList = await firestore.collection('prerequisite_suggestions').doc(visaSuggestionId).get();
  assert.ok(visaBeforeList.exists, 'Visa suggestion should exist before list validation.');
  assert.equal(visaBeforeList.get('status'), 'pending');
  assert.equal(visaBeforeList.get('usageCount'), 1);

  const mergedListPayload = await loadAdminPrerequisiteSuggestions({
    status: 'merged',
    query: 'controle',
    sort: 'recent',
    limit: 5,
  });
  assert.equal(mergedListPayload.items.length, 1);
  assert.equal(mergedListPayload.items[0]?.suggestionId, controlSuggestionId);
  assert.equal('companyUid' in mergedListPayload.items[0]!, false);

  const pendingListPayload = await loadAdminPrerequisiteSuggestions({
    status: 'pending',
    limit: 5,
  });
  assert.equal(pendingListPayload.items.some((item) => item.suggestionId === visaSuggestionId), true);

  const sortedPageOne = await loadAdminPrerequisiteSuggestions({
    sort: 'usageCount',
    limit: 1,
  });
  assert.equal(sortedPageOne.items.length, 1);
  assert.equal(sortedPageOne.items[0]?.suggestionId, controlSuggestionId);
  assert.ok(sortedPageOne.nextCursor);
  assert.equal('companyUid' in sortedPageOne.items[0]!, false);

  const sortedPageTwo = await loadAdminPrerequisiteSuggestions({
    sort: 'usageCount',
    limit: 1,
    cursor: sortedPageOne.nextCursor ?? undefined,
  });
  assert.equal(sortedPageTwo.items.length, 1);
  assert.equal(sortedPageTwo.items[0]?.suggestionId, visaSuggestionId);

  const detailPayload = await getAdminPrerequisiteSuggestionDetail(controlSuggestionId);
  assert.equal(detailPayload.suggestion?.suggestionId, controlSuggestionId);
  assert.equal(detailPayload.usages.length, 2);
  assert.equal('companyUid' in detailPayload.usages[0]!, false);
  assert.equal('offerId' in detailPayload.usages[0]!, false);

  const removeControlInput = {
    ...jobOfferToInput(offerA),
    requiredPrerequisites: [],
    preferredPrerequisites: [],
    missions: `${offerA.missions} - controle retire.`,
  };
  offerA = await updateJobOffer(companyAUid, offerA.id, removeControlInput);

  const controlAfterRemoval = await firestore.collection('prerequisite_suggestions').doc(controlSuggestionId).get();
  assert.equal(controlAfterRemoval.get('status'), 'merged');
  assert.equal(controlAfterRemoval.get('usageCount'), 1);
  assert.equal(controlAfterRemoval.get('companyCount'), 1);
  assert.equal(controlAfterRemoval.get('requiredCount'), 1);
  assert.equal(controlAfterRemoval.get('preferredCount'), 0);

  console.log('Prerequisite suggestion emulator test: OK', {
    controlSuggestionId,
    visaSuggestionId,
    controlUsageCountAfterRemoval: controlAfterRemoval.get('usageCount'),
    mergedListCount: mergedListPayload.items.length,
    pendingListCount: pendingListPayload.items.length,
    pageOneLabel: sortedPageOne.items[0]?.label,
    pageTwoLabel: sortedPageTwo.items[0]?.label,
  });
}

await main();
