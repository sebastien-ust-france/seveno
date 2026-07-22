import assert from 'node:assert/strict';
import net from 'node:net';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type {
  Firestore,
  Timestamp,
} from 'firebase-admin/firestore';
import type {
  CandidateRecommendationInvitationInput,
  CandidateRecommendationRequest,
  CandidateRecommendationSubmissionInput,
} from '@/types/seveno';

let RecommendationErrorClass: typeof Error | null = null;

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
  process.env.NODE_ENV = 'test';
  process.env.GCLOUD_PROJECT = projectId;
  process.env.PROJECT_ID = projectId;
  process.env.FIREBASE_ADMIN_PROJECT_ID = projectId;
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = projectId;
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
}

async function assertEmulatorAvailable() {
  const host = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
  const [hostname, portValue] = host.split(':');
  const port = Number(portValue);
  if (!hostname || !Number.isFinite(port)) {
    throw new Error(`Firestore emulator host invalide: ${host}`);
  }

  await new Promise<void>((resolvePromise, rejectPromise) => {
    const socket = net.createConnection({ host: hostname, port });
    const timeout = setTimeout(() => {
      socket.destroy();
      rejectPromise(new Error(`Firestore emulator inaccessible sur ${host}. Lancez l emulator local avant ce smoke test.`));
    }, 1_000);

    socket.once('connect', () => {
      clearTimeout(timeout);
      socket.end();
      resolvePromise();
    });

    socket.once('error', () => {
      clearTimeout(timeout);
      rejectPromise(new Error(`Firestore emulator inaccessible sur ${host}. Lancez l emulator local avant ce smoke test.`));
    });
  });
}

function assertRecommendationError(code: string) {
  return (error: unknown) => Boolean(RecommendationErrorClass) && error instanceof RecommendationErrorClass && (error as { code?: unknown }).code === code;
}

function buildInvitationInput(overrides: Partial<CandidateRecommendationInvitationInput> = {}): CandidateRecommendationInvitationInput {
  return {
    respondentFirstName: 'Nora',
    respondentLastName: 'Martin',
    respondentTitle: 'Directrice RH',
    respondentCompanyName: 'Entreprise de test',
    respondentEmail: 'nora@entreprise-de-test.fr',
    relationType: 'former_employer',
    candidateJobTitle: 'Macon coffreur',
    collaborationPeriodLabel: 'Janvier 2021 - Mars 2024',
    collaborationStartLabel: 'Janvier 2021',
    collaborationEndLabel: 'Mars 2024',
    respondentWebsite: 'https://entreprise-de-test.fr',
    respondentSiret: '12345678901234',
    ...overrides,
  };
}

function buildSubmissionInput(overrides: Partial<CandidateRecommendationSubmissionInput> = {}): CandidateRecommendationSubmissionInput {
  return {
    qualities: ['Fiable', 'Autonome', 'Rigoureux'],
    ratings: {
      reliability: 'excellent',
      autonomy: 'very_satisfactory',
      teamwork: 'satisfactory',
      communication: 'very_satisfactory',
      adaptability: 'excellent',
    },
    comment: 'Avis professionnel de test pour la mise en production.',
    wouldRehire: 'yes',
    consentToRevealIdentity: true,
    certificationAccepted: true,
    ...overrides,
  };
}

function parseToken(publicLink: string | null) {
  assert.ok(publicLink, 'Le lien public doit etre genere.');
  const token = publicLink.slice(publicLink.lastIndexOf('/') + 1).trim();
  assert.ok(token, 'Le lien public doit contenir un token.');
  return token;
}

async function seedCandidate(firestore: Firestore, params: {
  uid: string;
  publicCandidateId: string;
  displayName: string;
  email: string;
  sectorId: string;
  jobFamilyId: string;
  jobRoleId: string;
  targetLabel: string;
  now: Timestamp;
}) {
  const {
    uid,
    publicCandidateId,
    displayName,
    email,
    sectorId,
    jobFamilyId,
    jobRoleId,
    targetLabel,
    now,
  } = params;

  await Promise.all([
    firestore.collection('users').doc(uid).set({
      uid,
      role: 'candidate',
      authProvider: 'password',
      email,
      emailVerified: true,
      displayName,
      onboardingCompleted: true,
      createdAt: now,
      updatedAt: now,
    }),
    firestore.collection('candidate_profiles').doc(uid).set({
      uid,
      publicCandidateId,
      role: 'candidate',
      targetJobRoleIds: [jobRoleId],
      targetJobs: [
        {
          sectorId,
          jobFamilyId,
          jobRoleId,
          label: targetLabel,
        },
      ],
      professionalSelfDescription: `${displayName} met en avant son parcours.`,
      professionalReputationDescription: null,
      sectorId,
      jobFamilyId,
      jobRoleId,
      availability: 'immediate',
      availabilityAvailableFromAt: null,
      availabilityConfirmedAt: null,
      availabilityValidUntil: null,
      locationArea: 'Gironde',
      experienceLevel: 'confirmed',
      verifiedScore: null,
      testPassed: false,
      lastTestAt: null,
      verifiedTestResultId: null,
      verifiedTestSessionId: null,
      verifiedJobRoleId: null,
      verifiedQuestionBankCode: null,
      verifiedQuestionBankVersion: null,
      sevenoAssessmentStatus: 'completed',
      sevenoAssessmentOverallScore: 0,
      sevenoAssessmentDimensions: {},
      sevenoAssessmentVersion: null,
      sevenoAssessmentCompletedAt: null,
      sevenoAssessmentSessionId: null,
      sevenoAssessmentResultId: null,
      profileStatus: 'active',
      recommendationInvitationCount: 0,
      recommendationVerificationPendingCount: 0,
      recommendationVerifiedCount: 0,
      recommendationVisibleCount: 0,
      dailyAvailabilityConfirmationEnabled: true,
      nextAvailabilityReminderAt: null,
      lastAvailabilityNotificationAt: null,
      availabilityTimezone: 'Europe/Paris',
      availabilityPushPermission: 'default',
      hasActiveAvailabilityPushSubscription: false,
      createdAt: now,
      updatedAt: now,
    }),
  ]);
}

async function main() {
  loadDotEnvFile(resolve(process.cwd(), '.env.local'));
  configureEmulatorEnvironment();
  await assertEmulatorAvailable();

  const { Timestamp } = await import('firebase-admin/firestore');
  const { adminDb } = await import('@/lib/firebase-admin');
  const {
    SevenoRecommendationError,
    createCandidateRecommendationInvitation,
    loadCompanyCandidateRecommendationBundleByPublicId,
    loadPublicRecommendationInvitation,
    listCandidateRecommendationDashboard,
    submitRecommendationByToken,
    verifyCandidateRecommendationByAdmin,
  } = await import('@/lib/seveno-recommendations-server');
  const { buildRecommendationInvitationEmailPreview, queueRecommendationInvitationEmail } = await import('@/lib/seveno-recommendation-email');
  RecommendationErrorClass = SevenoRecommendationError;

  if (!adminDb) {
    throw new Error('Firebase Admin Firestore is not configured.');
  }

  const firestore = adminDb;
  const now = Timestamp.now();
  const suffix = randomUUID().slice(0, 8);
  const sectorId = 'construction-btp';
  const jobFamilyId = 'gros-oeuvre';
  const jobRoleId = 'macon-coffreur';

  const adminUid = `admin-reco-${suffix}`;
  const candidateAUid = `candidate-reco-a-${suffix}`;
  const candidateBUid = `candidate-reco-b-${suffix}`;
  const candidateCUid = `candidate-reco-c-${suffix}`;

  await Promise.all([
    firestore.collection('users').doc(adminUid).set({
      uid: adminUid,
      role: 'admin',
      authProvider: 'password',
      email: `admin-${suffix}@seveno.test`,
      emailVerified: true,
      displayName: 'Admin recommandations',
      onboardingCompleted: true,
      createdAt: now,
      updatedAt: now,
    }),
    seedCandidate(firestore, {
      uid: candidateAUid,
      publicCandidateId: `SEV-CAND-A-${suffix.toUpperCase()}`,
      displayName: 'Candidat recommandations A',
      email: `candidate-a-${suffix}@seveno.test`,
      sectorId,
      jobFamilyId,
      jobRoleId,
      targetLabel: 'Macon coffreur',
      now,
    }),
    seedCandidate(firestore, {
      uid: candidateBUid,
      publicCandidateId: `SEV-CAND-B-${suffix.toUpperCase()}`,
      displayName: 'Candidat recommandations B',
      email: `candidate-b-${suffix}@seveno.test`,
      sectorId,
      jobFamilyId,
      jobRoleId,
      targetLabel: 'Macon coffreur',
      now,
    }),
    seedCandidate(firestore, {
      uid: candidateCUid,
      publicCandidateId: `SEV-CAND-C-${suffix.toUpperCase()}`,
      displayName: 'Candidat recommandations C',
      email: `candidate-c-${suffix}@seveno.test`,
      sectorId,
      jobFamilyId,
      jobRoleId,
      targetLabel: 'Macon coffreur',
      now,
    }),
  ]);

  const zeroDashboard = await listCandidateRecommendationDashboard(candidateAUid);
  assert.equal(zeroDashboard.invitationCount, 0);
  assert.equal(zeroDashboard.verificationPendingCount, 0);
  assert.equal(zeroDashboard.verifiedCount, 0);
  assert.equal(zeroDashboard.visibleCount, 0);
  assert.equal(zeroDashboard.requests.length, 0);
  assert.equal(zeroDashboard.recommendations.length, 0);

  const zeroCompanyBundle = await loadCompanyCandidateRecommendationBundleByPublicId(`SEV-CAND-A-${suffix.toUpperCase()}`);
  assert.ok(zeroCompanyBundle.candidate);
  assert.equal(Object.prototype.hasOwnProperty.call(zeroCompanyBundle.candidate, 'uid'), false);
  assert.equal(zeroCompanyBundle.recommendations.length, 0);

  const invitationPlans = [
    buildInvitationInput({
      respondentFirstName: 'Paula',
      respondentLastName: 'Dubois',
      respondentTitle: 'Directrice RH',
      respondentCompanyName: 'Constructeurs Gironde',
      respondentEmail: `paula-${suffix}@constructeurs-gironde.fr`,
      relationType: 'former_employer',
      candidateJobTitle: 'Macon coffreur',
      collaborationPeriodLabel: 'Janvier 2021 - Decembre 2022',
      collaborationStartLabel: 'Janvier 2021',
      collaborationEndLabel: 'Decembre 2022',
    }),
    buildInvitationInput({
      respondentFirstName: 'Marc',
      respondentLastName: 'Leroy',
      respondentTitle: 'Responsable de chantier',
      respondentCompanyName: 'Constructeurs Gironde',
      respondentEmail: `marc-${suffix}@constructeurs-gironde.fr`,
      relationType: 'former_manager',
      candidateJobTitle: 'Chef de chantier',
      collaborationPeriodLabel: 'Mars 2022 - Mai 2024',
      collaborationStartLabel: 'Mars 2022',
      collaborationEndLabel: 'Mai 2024',
    }),
    buildInvitationInput({
      respondentFirstName: 'Julie',
      respondentLastName: 'Moreau',
      respondentTitle: 'Manager de projet',
      respondentCompanyName: 'Groupe Batiment Sud',
      respondentEmail: `julie-${suffix}@gmail.com`,
      relationType: 'hr_manager',
      candidateJobTitle: 'Macon coffreur',
      collaborationPeriodLabel: 'Septembre 2020 - Juin 2023',
      collaborationStartLabel: 'Septembre 2020',
      collaborationEndLabel: 'Juin 2023',
    }),
  ];

  const createdInvitations: Array<{
    request: CandidateRecommendationRequest;
    publicLink: string;
    token: string;
  }> = [];
  for (const invitationInput of invitationPlans) {
    const result = await createCandidateRecommendationInvitation(candidateAUid, invitationInput);
    assert.ok(result.request.id);
    assert.equal(result.request.candidateUid, candidateAUid);
    assert.equal(result.request.status, 'sent');
    assert.equal(result.request.verificationStatus, 'not_started');
    assert.ok(result.publicLink);
    createdInvitations.push({
      request: result.request,
      publicLink: result.publicLink,
      token: parseToken(result.publicLink),
    });
  }

  assert.equal(new Set(createdInvitations.map((item) => item.request.id)).size, 3);
  assert.equal(new Set(createdInvitations.map((item) => item.token)).size, 3);

  const publicInvitation = await loadPublicRecommendationInvitation(createdInvitations[0]?.token ?? '');
  assert.ok(publicInvitation);
  assert.ok(publicInvitation.invitation);
  assert.ok(publicInvitation.candidate);
  assert.equal(Object.prototype.hasOwnProperty.call(publicInvitation.invitation, 'tokenHash'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(publicInvitation.invitation, 'respondentEmail'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(publicInvitation.candidate, 'uid'), false);

  const unknownInvitation = await loadPublicRecommendationInvitation(`unknown-${suffix}`);
  assert.equal(unknownInvitation, null);

  const firstProfessionalSubmission = await submitRecommendationByToken(
    createdInvitations[0]?.token ?? '',
    buildSubmissionInput({
      comment: 'Avis professionnel 1.',
      wouldRehire: 'yes',
    }),
  );
  assert.equal(firstProfessionalSubmission.recommendation.verificationStatus, 'verified');
  assert.ok(firstProfessionalSubmission.recommendation.verifiedAt);

  await assert.rejects(
    () => submitRecommendationByToken(createdInvitations[0]?.token ?? '', buildSubmissionInput()),
    assertRecommendationError('invitation_submitted'),
  );

  const secondProfessionalSubmission = await submitRecommendationByToken(
    createdInvitations[1]?.token ?? '',
    buildSubmissionInput({
      comment: 'Avis professionnel 2.',
      wouldRehire: 'depends_on_position',
    }),
  );
  assert.equal(secondProfessionalSubmission.recommendation.verificationStatus, 'verified');
  assert.ok(secondProfessionalSubmission.recommendation.verifiedAt);

  const publicSubmission = await submitRecommendationByToken(
    createdInvitations[2]?.token ?? '',
    buildSubmissionInput({
      comment: 'Avis public en attente de controle manuel.',
      wouldRehire: 'yes',
      consentToRevealIdentity: true,
    }),
  );
  assert.equal(publicSubmission.recommendation.verificationStatus, 'verification_pending');
  assert.equal(publicSubmission.recommendation.verifiedAt, null);

  const manuallyVerified = await verifyCandidateRecommendationByAdmin(adminUid, publicSubmission.recommendation.id, {
    action: 'verify',
  });
  assert.equal(manuallyVerified.recommendation?.verificationStatus, 'verified');
  assert.ok(manuallyVerified.recommendation?.verifiedAt);

  const dashboardAfterCandidateA = await listCandidateRecommendationDashboard(candidateAUid);
  assert.equal(dashboardAfterCandidateA.requests.length, 3);
  assert.equal(dashboardAfterCandidateA.recommendations.length, 3);
  assert.equal(dashboardAfterCandidateA.invitationCount, 0);
  assert.equal(dashboardAfterCandidateA.verificationPendingCount, 0);
  assert.equal(dashboardAfterCandidateA.verifiedCount, 3);
  assert.equal(dashboardAfterCandidateA.visibleCount, 3);
  assert.equal(new Set(dashboardAfterCandidateA.requests.map((request) => request.id)).size, 3);
  assert.equal(new Set(dashboardAfterCandidateA.recommendations.map((recommendation) => recommendation.id)).size, 3);

  const candidateProfileSnapshot = await firestore.collection('candidate_profiles').doc(candidateAUid).get();
  assert.equal(candidateProfileSnapshot.get('recommendationInvitationCount'), 0);
  assert.equal(candidateProfileSnapshot.get('recommendationVerificationPendingCount'), 0);
  assert.equal(candidateProfileSnapshot.get('recommendationVerifiedCount'), 3);
  assert.equal(candidateProfileSnapshot.get('recommendationVisibleCount'), 3);

  const privateCounterSnapshot = await firestore.collection('candidate_private_data').doc(candidateAUid).get();
  assert.ok(privateCounterSnapshot.exists);
  assert.equal(privateCounterSnapshot.get('invitationCount'), 0);
  assert.equal(privateCounterSnapshot.get('verificationPendingCount'), 0);
  assert.equal(privateCounterSnapshot.get('verifiedCount'), 3);
  assert.equal(privateCounterSnapshot.get('visibleCount'), 3);

  const companyBundle = await loadCompanyCandidateRecommendationBundleByPublicId(`SEV-CAND-A-${suffix.toUpperCase()}`);
  assert.ok(companyBundle.candidate);
  assert.equal(Object.prototype.hasOwnProperty.call(companyBundle.candidate, 'uid'), false);
  assert.equal(companyBundle.recommendations.length, 3);
  assert.equal(companyBundle.recommendations.some((item) => Object.prototype.hasOwnProperty.call(item, 'respondentEmail')), false);

  const preview = buildRecommendationInvitationEmailPreview(createdInvitations[0]!.request, createdInvitations[0]!.publicLink);
  assert.match(preview.subject, /Seven/);
  assert.match(preview.text, /SEV-CAND-A-/);
  assert.deepEqual(await queueRecommendationInvitationEmail(preview), { queued: false });

  const candidateBInvitationInputs = Array.from({ length: 10 }, (_, index) => buildInvitationInput({
    respondentFirstName: `Prenom${index + 1}`,
    respondentLastName: `Nom${index + 1}`,
    respondentTitle: `Responsable ${index + 1}`,
    respondentCompanyName: `Societe ${index + 1}`,
    respondentEmail: `person-${index + 1}-${suffix}@societe-${index + 1}.fr`,
    relationType: index % 2 === 0 ? 'former_employer' : 'other_professional_manager',
    candidateJobTitle: 'Macon coffreur',
    collaborationPeriodLabel: `202${index % 3} - 202${(index % 3) + 1}`,
    collaborationStartLabel: `202${index % 3}`,
    collaborationEndLabel: `202${(index % 3) + 1}`,
  }));

  for (const invitationInput of candidateBInvitationInputs) {
    const result = await createCandidateRecommendationInvitation(candidateBUid, invitationInput);
    assert.ok(result.publicLink);
    assert.equal(result.request.candidateUid, candidateBUid);
    assert.equal(result.request.status, 'sent');
  }

  const candidateBDashboard = await listCandidateRecommendationDashboard(candidateBUid);
  assert.equal(candidateBDashboard.invitationCount, 10);
  await assert.rejects(
    () => createCandidateRecommendationInvitation(candidateBUid, buildInvitationInput({
      respondentFirstName: 'Overflow',
      respondentLastName: 'User',
      respondentTitle: 'Manager',
      respondentCompanyName: 'Societe overflow',
      respondentEmail: `overflow-${suffix}@overflow.fr`,
    })),
    assertRecommendationError('too_many_active_invitations'),
  );

  const revokedInvitation = await createCandidateRecommendationInvitation(candidateCUid, buildInvitationInput({
    respondentFirstName: 'Revoque',
    respondentLastName: 'Refus',
    respondentTitle: 'Directrice',
    respondentCompanyName: 'Societe revoquee',
    respondentEmail: `revoque-${suffix}@societe-revoquee.fr`,
    relationType: 'executive',
  }));
  const revokedToken = parseToken(revokedInvitation.publicLink);
  await firestore.collection('candidate_recommendation_requests').doc(revokedInvitation.request.id).update({
    status: 'revoked',
    revokedAt: now,
    updatedAt: now,
  });

  await assert.rejects(
    () => loadPublicRecommendationInvitation(revokedToken),
    assertRecommendationError('invitation_revoked'),
  );
  await assert.rejects(
    () => submitRecommendationByToken(revokedToken, buildSubmissionInput()),
    assertRecommendationError('invitation_revoked'),
  );

  const expiredInvitation = await createCandidateRecommendationInvitation(candidateCUid, buildInvitationInput({
    respondentFirstName: 'Expiree',
    respondentLastName: 'Temps',
    respondentTitle: 'Manager',
    respondentCompanyName: 'Societe expiree',
    respondentEmail: `expiree-${suffix}@societe-expiree.fr`,
    relationType: 'professional_client',
  }));
  const expiredToken = parseToken(expiredInvitation.publicLink);
  await firestore.collection('candidate_recommendation_requests').doc(expiredInvitation.request.id).update({
    tokenExpiresAt: Timestamp.fromMillis(now.toMillis() - 1_000),
    updatedAt: now,
  });

  await assert.rejects(
    () => loadPublicRecommendationInvitation(expiredToken),
    assertRecommendationError('invitation_expired'),
  );
  await assert.rejects(
    () => submitRecommendationByToken(expiredToken, buildSubmissionInput()),
    assertRecommendationError('invitation_expired'),
  );

  const rejectedInvitation = await createCandidateRecommendationInvitation(candidateCUid, buildInvitationInput({
    respondentFirstName: 'Refus',
    respondentLastName: 'Final',
    respondentTitle: 'Responsable RH',
    respondentCompanyName: 'Societe rejetee',
    respondentEmail: `refus-${suffix}@gmail.com`,
    relationType: 'hr_manager',
  }));
  const rejectedToken = parseToken(rejectedInvitation.publicLink);
  const rejectedSubmission = await submitRecommendationByToken(
    rejectedToken,
    buildSubmissionInput({
      comment: 'Avis qui sera refuse.',
      wouldRehire: 'no',
    }),
  );
  assert.equal(rejectedSubmission.recommendation.verificationStatus, 'verification_pending');

  const rejectedResult = await verifyCandidateRecommendationByAdmin(adminUid, rejectedSubmission.recommendation.id, {
    action: 'reject',
    reason: 'Incoherence de test.',
  });
  assert.equal(rejectedResult.recommendation?.verificationStatus, 'verification_rejected');

  const candidateCDashboard = await listCandidateRecommendationDashboard(candidateCUid);
  assert.equal(candidateCDashboard.recommendations.length, 1);
  assert.equal(candidateCDashboard.recommendations[0]?.verificationStatus, 'verification_rejected');
  assert.equal(candidateCDashboard.verifiedCount, 0);
  assert.equal(candidateCDashboard.verificationPendingCount, 0);
  assert.equal(candidateCDashboard.invitationCount, 0);

  console.log('Recommendation smoke tests: OK', {
    candidateARecommendations: dashboardAfterCandidateA.recommendations.length,
    candidateBActiveInvitations: candidateBDashboard.invitationCount,
    candidateCRejectedRecommendations: candidateCDashboard.recommendations.length,
  });
}

await main();
