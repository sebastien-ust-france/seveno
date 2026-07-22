import 'server-only';

import { createHash, randomBytes } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb, isFirebaseAdminConfigured } from '@/lib/firebase-admin';
import {
  buildRecommendationInvitationEmailPreview,
  queueRecommendationInvitationEmail,
} from '@/lib/seveno-recommendation-email';
import { SEVENO_TERMS_VERSION } from '@/lib/seveno-users';
import {
  MAX_ACTIVE_RECOMMENDATION_INVITATIONS,
  PUBLIC_EMAIL_PROVIDER_DOMAINS,
  RECOMMENDATION_INVITATION_EXPIRY_DAYS,
  RECOMMENDATION_RESEND_DELAY_HOURS,
  RECOMMENDATION_TOKEN_BYTES,
} from '@/lib/seveno-recommendation-constants';
import type {
  CandidatePrivateRecommendationData,
  CandidateProfile,
  CandidateRecommendation,
  CandidateRecommendationDashboard,
  CandidateRecommendationInvitationInput,
  CandidateRecommendationPublicBundle,
  CandidateRecommendationRequest,
  CandidateRecommendationRatingSet,
  CandidateRecommendationSubmissionInput,
  PublicCandidateRecommendationSummary,
  PublicCandidateRecommendationInvitation,
  RecommendationEmailDomainClassification,
  RecommendationRelationType,
  RecommendationVerificationStatus,
  RecommendationVisibilityStatus,
  RecommendationWouldRehire,
  TermsAcceptanceContext,
  VisibleCandidateProfile,
} from '@/types/seveno';

const CANDIDATE_PROFILES_COLLECTION = 'candidate_profiles';
const USERS_COLLECTION = 'users';
const RECOMMENDATION_REQUESTS_COLLECTION = 'candidate_recommendation_requests';
const RECOMMENDATIONS_COLLECTION = 'candidate_recommendations';
const CANDIDATE_PRIVATE_DATA_COLLECTION = 'candidate_private_data';

const RECOMMENDATION_RELATION_LABELS: Record<RecommendationRelationType, string> = {
  former_employer: 'Ancien employeur',
  former_manager: 'Ancien manager',
  hr_manager: 'Responsable RH',
  executive: 'Direction',
  professional_client: 'Client professionnel',
  other_professional_manager: 'Référent professionnel',
};

const RECOMMENDATION_WOULD_REHIRE_LABELS: Record<RecommendationWouldRehire, string> = {
  yes: 'Oui',
  depends_on_position: 'Selon le poste',
  no: 'Non',
  prefer_not_to_answer: 'Je préfère ne pas répondre',
};

const RECOMMENDATION_VISIBILITY_LABELS: Record<RecommendationVisibilityStatus, string> = {
  hidden: 'Identité masquée',
  visible: 'Identité visible',
};

const RECOMMENDATION_RATING_VALUES: CandidateRecommendationRatingSet[keyof CandidateRecommendationRatingSet][] = [
  'not_evaluated',
  'needs_improvement',
  'satisfactory',
  'very_satisfactory',
  'excellent',
];

const RECOMMENDATION_ACTIVE_STATUSES: CandidateRecommendationRequest['status'][] = ['sent', 'viewed'];
const RECOMMENDATION_PENDING_VERIFICATION_STATUS: RecommendationVerificationStatus = 'verification_pending';

type FirestoreRecord = Record<string, unknown>;

export class SevenoRecommendationError extends Error {
  code: string;

  status: number;

  constructor(code: string, status: number, message: string) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function requireAdminDatabase() {
  if (!isFirebaseAdminConfigured || !adminDb) {
    throw new SevenoRecommendationError(
      'firebase_admin_missing',
      500,
      'Firebase Admin n est pas configure pour gerer les recommandations SevenO.',
    );
  }

  return adminDb;
}

function isPlainObject(value: unknown): value is FirestoreRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cleanText(value: unknown, maxLength = 0) {
  if (typeof value !== 'string') {
    return '';
  }

  const cleaned = value.trim();
  if (!cleaned) {
    return '';
  }

  if (maxLength > 0 && cleaned.length > maxLength) {
    throw new SevenoRecommendationError('invalid_payload', 400, 'Un champ texte contient trop de caracteres.');
  }

  return cleaned;
}

function normalizeOptionalText(value: unknown, maxLength: number) {
  const cleaned = cleanText(value, maxLength);
  return cleaned || undefined;
}

function normalizeOptionalWebsite(value: unknown) {
  const website = normalizeOptionalText(value, 200);
  if (!website) {
    return undefined;
  }

  const candidateUrl = website.startsWith('http://') || website.startsWith('https://')
    ? website
    : `https://${website}`;
  try {
    const parsed = new URL(candidateUrl);
    if (!parsed.hostname) {
      throw new Error('invalid_website');
    }
  } catch {
    throw new SevenoRecommendationError('invalid_website', 400, 'Le site web du referent est invalide.');
  }

  return website;
}

function normalizeOptionalBusinessIdentifier(value: unknown) {
  const siret = normalizeOptionalText(value, 14);
  if (!siret) {
    return undefined;
  }

  if (!/^[0-9]{14}$/.test(siret)) {
    throw new SevenoRecommendationError('invalid_business_identifier', 400, 'Le SIRET du referent est invalide.');
  }

  return siret;
}

function normalizeRequiredText(value: unknown, field: string, maxLength: number) {
  const cleaned = cleanText(value, maxLength);
  if (!cleaned) {
    throw new SevenoRecommendationError('invalid_payload', 400, `Le champ ${field} est obligatoire.`);
  }

  return cleaned;
}

function normalizeEmail(value: unknown) {
  const email = cleanText(value, 254);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new SevenoRecommendationError('invalid_email', 400, 'Adresse email invalide.');
  }

  return email;
}

function classifyEmailDomain(email: string): RecommendationEmailDomainClassification {
  const domain = email.split('@')[1]?.trim().toLowerCase() ?? '';
  return PUBLIC_EMAIL_PROVIDER_DOMAINS.has(domain) ? 'public_email_provider' : 'professional_domain';
}

function isRecommendationRelationType(value: unknown): value is RecommendationRelationType {
  return typeof value === 'string' && value in RECOMMENDATION_RELATION_LABELS;
}

function isWouldRehire(value: unknown): value is RecommendationWouldRehire {
  return typeof value === 'string' && value in RECOMMENDATION_WOULD_REHIRE_LABELS;
}

function isVisibilityStatus(value: unknown): value is RecommendationVisibilityStatus {
  return typeof value === 'string' && value in RECOMMENDATION_VISIBILITY_LABELS;
}

function isTermsAcceptanceContext(value: unknown): value is TermsAcceptanceContext {
  return value === 'candidate_account'
    || value === 'company_first_access'
    || value === 'professional_recommendation';
}

function isRatingLevel(value: unknown): value is CandidateRecommendationRatingSet[keyof CandidateRecommendationRatingSet] {
  return typeof value === 'string' && RECOMMENDATION_RATING_VALUES.includes(value as CandidateRecommendationRatingSet[keyof CandidateRecommendationRatingSet]);
}

function toTimestamp(value: unknown): Timestamp | null {
  if (value instanceof Timestamp) {
    return value;
  }

  if (value && typeof value === 'object' && typeof (value as { toMillis?: unknown }).toMillis === 'function') {
    return Timestamp.fromMillis((value as { toMillis: () => number }).toMillis());
  }

  return null;
}

function tokenHash(rawToken: string) {
  return createHash('sha256').update(rawToken).digest('hex');
}

function generateRecommendationToken() {
  return randomBytes(RECOMMENDATION_TOKEN_BYTES).toString('base64url');
}

function recommendationInvitationRef(id: string) {
  return requireAdminDatabase().collection(RECOMMENDATION_REQUESTS_COLLECTION).doc(id);
}

function recommendationRef(id: string) {
  return requireAdminDatabase().collection(RECOMMENDATIONS_COLLECTION).doc(id);
}

function candidateProfileRef(uid: string) {
  return requireAdminDatabase().collection(CANDIDATE_PROFILES_COLLECTION).doc(uid);
}

function privateDataRef(uid: string) {
  return requireAdminDatabase().collection(CANDIDATE_PRIVATE_DATA_COLLECTION).doc(uid);
}

function userRef(uid: string) {
  return requireAdminDatabase().collection(USERS_COLLECTION).doc(uid);
}

function isExpiredInvitation(data: CandidateRecommendationRequest) {
  const expiresAt = toTimestamp(data.tokenExpiresAt);
  return Boolean(expiresAt && expiresAt.toMillis() <= Timestamp.now().toMillis() && !['submitted', 'revoked'].includes(data.status));
}

function isActiveInvitation(data: CandidateRecommendationRequest) {
  return RECOMMENDATION_ACTIVE_STATUSES.includes(data.status)
    && !isExpiredInvitation(data)
    && !data.revokedAt
    && !data.submittedAt;
}

function shouldAutoVerifyRecommendation(emailDomainClassification: RecommendationEmailDomainClassification) {
  return emailDomainClassification === 'professional_domain';
}

function normalizeRequest(data: unknown, id: string): CandidateRecommendationRequest | null {
  if (!isPlainObject(data)) {
    return null;
  }

  const candidateUid = cleanText(data.candidateUid);
  const publicCandidateId = cleanText(data.publicCandidateId);
  const respondentFirstName = cleanText(data.respondentFirstName);
  const respondentLastName = cleanText(data.respondentLastName);
  const respondentTitle = cleanText(data.respondentTitle);
  const respondentCompanyName = cleanText(data.respondentCompanyName);
  const respondentWebsite = normalizeOptionalWebsite(data.respondentWebsite);
  const respondentSiret = normalizeOptionalBusinessIdentifier(data.respondentSiret);
  const respondentEmail = cleanText(data.respondentEmail);
  const relationType = isRecommendationRelationType(data.relationType) ? data.relationType : null;
  const candidateJobTitle = cleanText(data.candidateJobTitle);
  const collaborationPeriodLabel = cleanText(data.collaborationPeriodLabel);
  const collaborationStartLabel = cleanText(data.collaborationStartLabel);
  const collaborationEndLabel = cleanText(data.collaborationEndLabel);
  const tokenHashValue = cleanText(data.tokenHash);
  const status = typeof data.status === 'string' ? data.status : null;
  const verificationStatus = typeof data.verificationStatus === 'string' ? data.verificationStatus : null;
  const tokenCreatedAt = toTimestamp(data.tokenCreatedAt);
  const tokenExpiresAt = toTimestamp(data.tokenExpiresAt);
  const verifiedAt = data.verifiedAt == null ? null : toTimestamp(data.verifiedAt);
  const viewedAt = data.viewedAt == null ? null : toTimestamp(data.viewedAt);
  const submittedAt = data.submittedAt == null ? null : toTimestamp(data.submittedAt);
  const revokedAt = data.revokedAt == null ? null : toTimestamp(data.revokedAt);
  const lastSentAt = data.lastSentAt == null ? null : toTimestamp(data.lastSentAt);
  const createdAt = toTimestamp(data.createdAt);
  const updatedAt = toTimestamp(data.updatedAt);

  if (
    !candidateUid
    || !publicCandidateId
    || !respondentFirstName
    || !respondentLastName
    || !respondentTitle
    || !respondentCompanyName
    || !respondentEmail
    || !relationType
    || !candidateJobTitle
    || !collaborationPeriodLabel
    || !tokenHashValue
    || !status
    || !verificationStatus
    || !tokenCreatedAt
    || !tokenExpiresAt
    || !createdAt
    || !updatedAt
  ) {
    return null;
  }

  return {
    id,
    candidateUid,
    publicCandidateId,
    respondentFirstName,
    respondentLastName,
    respondentTitle,
    respondentCompanyName,
    ...(respondentWebsite ? { respondentWebsite } : {}),
    ...(respondentSiret ? { respondentSiret } : {}),
    respondentEmail,
    respondentEmailDomainClassification: classifyEmailDomain(respondentEmail),
    relationType,
    candidateJobTitle,
    collaborationPeriodLabel,
    ...(collaborationStartLabel ? { collaborationStartLabel } : {}),
    ...(collaborationEndLabel ? { collaborationEndLabel } : {}),
    tokenHash: tokenHashValue,
    tokenCreatedAt,
    tokenExpiresAt,
    status: status as CandidateRecommendationRequest['status'],
    verificationStatus: verificationStatus as RecommendationVerificationStatus,
    emailOwnershipVerified: data.emailOwnershipVerified === true,
    ...(cleanText(data.verificationReason) ? { verificationReason: cleanText(data.verificationReason) } : {}),
    ...(cleanText(data.verifiedByAdminUid) ? { verifiedByAdminUid: cleanText(data.verifiedByAdminUid) } : {}),
    ...(verifiedAt ? { verifiedAt } : {}),
    ...(viewedAt ? { viewedAt } : {}),
    ...(submittedAt ? { submittedAt } : {}),
    ...(revokedAt ? { revokedAt } : {}),
    ...(lastSentAt ? { lastSentAt } : {}),
    createdAt,
    updatedAt,
  };
}

function normalizeRecommendation(data: unknown, id: string): CandidateRecommendation | null {
  if (!isPlainObject(data)) {
    return null;
  }

  const requestId = cleanText(data.requestId);
  const candidateUid = cleanText(data.candidateUid);
  const publicCandidateId = cleanText(data.publicCandidateId);
  const respondentFirstName = cleanText(data.respondentFirstName);
  const respondentLastName = cleanText(data.respondentLastName);
  const respondentTitle = cleanText(data.respondentTitle);
  const respondentCompanyName = cleanText(data.respondentCompanyName);
  const respondentWebsite = normalizeOptionalWebsite(data.respondentWebsite);
  const respondentSiret = normalizeOptionalBusinessIdentifier(data.respondentSiret);
  const respondentEmail = cleanText(data.respondentEmail);
  const relationType = isRecommendationRelationType(data.relationType) ? data.relationType : null;
  const candidateJobTitle = cleanText(data.candidateJobTitle);
  const collaborationPeriodLabel = cleanText(data.collaborationPeriodLabel);
  const collaborationStartLabel = cleanText(data.collaborationStartLabel);
  const collaborationEndLabel = cleanText(data.collaborationEndLabel);
  const qualities = Array.isArray(data.qualities)
    ? data.qualities.map((item) => cleanText(item)).filter(Boolean)
    : [];
  const ratings = isPlainObject(data.ratings)
    ? {
        reliability: isRatingLevel(data.ratings.reliability) ? data.ratings.reliability : 'not_evaluated',
        autonomy: isRatingLevel(data.ratings.autonomy) ? data.ratings.autonomy : 'not_evaluated',
        teamwork: isRatingLevel(data.ratings.teamwork) ? data.ratings.teamwork : 'not_evaluated',
        communication: isRatingLevel(data.ratings.communication) ? data.ratings.communication : 'not_evaluated',
        adaptability: isRatingLevel(data.ratings.adaptability) ? data.ratings.adaptability : 'not_evaluated',
      }
    : null;
  const comment = cleanText(data.comment);
  const wouldRehire = isWouldRehire(data.wouldRehire) ? data.wouldRehire : null;
  const candidateVisibility = isVisibilityStatus(data.candidateVisibility) ? data.candidateVisibility : null;
  const consentToRevealIdentity = data.consentToRevealIdentity === true;
  const consentToRevealIdentityAt = data.consentToRevealIdentityAt == null ? null : toTimestamp(data.consentToRevealIdentityAt);
  const certificationAccepted = data.certificationAccepted === true;
  const certificationAcceptedAt = data.certificationAcceptedAt == null ? null : toTimestamp(data.certificationAcceptedAt);
  const emailOwnershipVerified = data.emailOwnershipVerified === true;
  const verificationStatus = typeof data.verificationStatus === 'string' ? data.verificationStatus : null;
  const verifiedByAdminUid = cleanText(data.verifiedByAdminUid);
  const verifiedAt = data.verifiedAt == null ? null : toTimestamp(data.verifiedAt);
  const verificationReason = cleanText(data.verificationReason);
  const publishedAt = data.publishedAt == null ? null : toTimestamp(data.publishedAt);
  const termsAcceptanceVersion = cleanText(data.termsAcceptanceVersion) || null;
  const termsAcceptanceAcceptedAt = data.termsAcceptanceAcceptedAt == null ? null : toTimestamp(data.termsAcceptanceAcceptedAt);
  const termsAcceptanceContext = isTermsAcceptanceContext(data.termsAcceptanceContext) ? data.termsAcceptanceContext : null;
  const termsAcceptanceGoodFaith = typeof data.termsAcceptanceGoodFaith === 'boolean'
    ? data.termsAcceptanceGoodFaith
    : null;
  const createdAt = toTimestamp(data.createdAt);
  const updatedAt = toTimestamp(data.updatedAt);

  if (
    !requestId
    || !candidateUid
    || !publicCandidateId
    || !respondentFirstName
    || !respondentLastName
    || !respondentTitle
    || !respondentCompanyName
    || !respondentEmail
    || !relationType
    || !candidateJobTitle
    || !collaborationPeriodLabel
    || qualities.length === 0
    || !ratings
    || !wouldRehire
    || !candidateVisibility
    || !verificationStatus
    || !createdAt
    || !updatedAt
  ) {
    return null;
  }

  return {
    id,
    requestId,
    candidateUid,
    publicCandidateId,
    respondentFirstName,
    respondentLastName,
    respondentTitle,
    respondentCompanyName,
    ...(respondentWebsite ? { respondentWebsite } : {}),
    ...(respondentSiret ? { respondentSiret } : {}),
    respondentEmail,
    respondentEmailDomainClassification: classifyEmailDomain(respondentEmail),
    relationType,
    candidateJobTitle,
    collaborationPeriodLabel,
    ...(collaborationStartLabel ? { collaborationStartLabel } : {}),
    ...(collaborationEndLabel ? { collaborationEndLabel } : {}),
    qualities,
    ratings,
    ...(comment ? { comment } : {}),
    wouldRehire,
    candidateVisibility,
    consentToRevealIdentity,
    ...(consentToRevealIdentityAt ? { consentToRevealIdentityAt } : {}),
    certificationAccepted,
    ...(certificationAcceptedAt ? { certificationAcceptedAt } : {}),
    emailOwnershipVerified,
    verificationStatus: verificationStatus as RecommendationVerificationStatus,
    ...(verifiedByAdminUid ? { verifiedByAdminUid } : {}),
    ...(verifiedAt ? { verifiedAt } : {}),
    ...(verificationReason ? { verificationReason } : {}),
    ...(publishedAt ? { publishedAt } : {}),
    ...(termsAcceptanceVersion ? { termsAcceptanceVersion } : {}),
    ...(termsAcceptanceAcceptedAt ? { termsAcceptanceAcceptedAt } : {}),
    ...(termsAcceptanceContext ? { termsAcceptanceContext } : {}),
    ...(termsAcceptanceGoodFaith !== null ? { termsAcceptanceGoodFaith } : {}),
    createdAt,
    updatedAt,
  };
}

function normalizeCandidateProfile(data: unknown): CandidateProfile | null {
  if (!isPlainObject(data)) {
    return null;
  }

  const uid = cleanText(data.uid);
  const publicCandidateId = cleanText(data.publicCandidateId);
  const targetJobs = Array.isArray(data.targetJobs)
    ? data.targetJobs
        .map((item) => {
          if (!isPlainObject(item)) {
            return null;
          }
          const sectorId = cleanText(item.sectorId);
          const jobFamilyId = cleanText(item.jobFamilyId);
          const jobRoleId = cleanText(item.jobRoleId);
          const label = cleanText(item.label);
          return sectorId && jobFamilyId && jobRoleId && label
            ? { sectorId, jobFamilyId, jobRoleId, label }
            : null;
        })
        .filter((item): item is CandidateProfile['targetJobs'][number] => Boolean(item))
    : [];
  const sectorId = cleanText(data.sectorId);
  const jobFamilyId = cleanText(data.jobFamilyId);
  const jobRoleId = cleanText(data.jobRoleId);
  const availability = cleanText(data.availability) as CandidateProfile['availability'];
  const locationArea = cleanText(data.locationArea);
  const experienceLevel = cleanText(data.experienceLevel) as CandidateProfile['experienceLevel'];
  const professionalSelfDescription = cleanText(data.professionalSelfDescription) || null;
  const professionalReputationDescription = cleanText(data.professionalReputationDescription) || null;
  const verifiedScore = typeof data.verifiedScore === 'number' && Number.isFinite(data.verifiedScore) ? data.verifiedScore : null;
  const testPassed = data.testPassed === true;
  const lastTestAt = data.lastTestAt == null ? null : toTimestamp(data.lastTestAt);
  const profileStatus = cleanText(data.profileStatus) as CandidateProfile['profileStatus'];
  const recommendationInvitationCount = typeof data.recommendationInvitationCount === 'number'
    ? data.recommendationInvitationCount
    : 0;
  const recommendationVerificationPendingCount = typeof data.recommendationVerificationPendingCount === 'number'
    ? data.recommendationVerificationPendingCount
    : 0;
  const recommendationVerifiedCount = typeof data.recommendationVerifiedCount === 'number'
    ? data.recommendationVerifiedCount
    : 0;
  const recommendationVisibleCount = typeof data.recommendationVisibleCount === 'number'
    ? data.recommendationVisibleCount
    : 0;
  const sevenoAssessmentStatus = cleanText(data.sevenoAssessmentStatus) as CandidateProfile['sevenoAssessmentStatus'];
  const sevenoAssessmentOverallScore = typeof data.sevenoAssessmentOverallScore === 'number'
    ? data.sevenoAssessmentOverallScore
    : null;
  const sevenoAssessmentDimensions = isPlainObject(data.sevenoAssessmentDimensions) ? data.sevenoAssessmentDimensions as CandidateProfile['sevenoAssessmentDimensions'] : {};
  const sevenoAssessmentVersion = cleanText(data.sevenoAssessmentVersion) || null;
  const sevenoAssessmentCompletedAt = data.sevenoAssessmentCompletedAt == null ? null : toTimestamp(data.sevenoAssessmentCompletedAt);
  const createdAt = toTimestamp(data.createdAt);
  const updatedAt = toTimestamp(data.updatedAt);

  if (
    !uid
    || !publicCandidateId
    || !sectorId
    || !jobFamilyId
    || !jobRoleId
    || !availability
    || !locationArea
    || !experienceLevel
    || !profileStatus
    || !createdAt
    || !updatedAt
  ) {
    return null;
  }

  return {
    uid,
    publicCandidateId,
    role: 'candidate',
    targetJobRoleIds: Array.isArray(data.targetJobRoleIds) ? data.targetJobRoleIds.map((value) => cleanText(value)).filter(Boolean) : [jobRoleId],
    targetJobs,
    professionalSelfDescription,
    professionalReputationDescription,
    sectorId,
    jobFamilyId,
    jobRoleId,
    availability,
    locationArea,
    experienceLevel,
    verifiedScore,
    testPassed,
    lastTestAt,
    verifiedTestResultId: cleanText(data.verifiedTestResultId) || null,
    verifiedTestSessionId: cleanText(data.verifiedTestSessionId) || null,
    verifiedJobRoleId: cleanText(data.verifiedJobRoleId) || null,
    verifiedQuestionBankCode: cleanText(data.verifiedQuestionBankCode) || null,
    verifiedQuestionBankVersion: cleanText(data.verifiedQuestionBankVersion) || null,
    sevenoAssessmentStatus,
    sevenoAssessmentOverallScore,
    sevenoAssessmentDimensions,
    sevenoAssessmentVersion,
    sevenoAssessmentCompletedAt,
    sevenoAssessmentSessionId: cleanText(data.sevenoAssessmentSessionId) || null,
    sevenoAssessmentResultId: cleanText(data.sevenoAssessmentResultId) || null,
    profileStatus,
    recommendationInvitationCount,
    recommendationVerificationPendingCount,
    recommendationVerifiedCount,
    recommendationVisibleCount,
    createdAt,
    updatedAt,
  };
}

function cleanPublicCandidateProfile(profile: CandidateProfile | null): VisibleCandidateProfile | null {
  if (!profile || profile.profileStatus !== 'active') {
    return null;
  }

  return {
    publicCandidateId: profile.publicCandidateId,
    targetJobs: profile.targetJobs,
    professionalSelfDescription: profile.professionalSelfDescription ?? null,
    professionalReputationDescription: profile.professionalReputationDescription ?? null,
    sectorId: profile.sectorId,
    jobFamilyId: profile.jobFamilyId,
    jobRoleId: profile.jobRoleId,
    availability: profile.availability,
    availabilityAvailableFromAt: profile.availabilityAvailableFromAt ?? null,
    availabilityConfirmedAt: profile.availabilityConfirmedAt ?? null,
    availabilityValidUntil: profile.availabilityValidUntil ?? null,
    locationArea: profile.locationArea,
    experienceLevel: profile.experienceLevel,
    recommendationVisibleCount: profile.recommendationVisibleCount ?? 0,
    profileStatus: 'active',
  };
}

function buildPublicRecommendationSummary(recommendation: CandidateRecommendation): PublicCandidateRecommendationSummary {
  return {
    id: recommendation.id,
    relationLabel: RECOMMENDATION_RELATION_LABELS[recommendation.relationType],
    collaborationPeriodLabel: recommendation.collaborationPeriodLabel,
    candidateJobTitle: recommendation.candidateJobTitle,
    qualities: [...recommendation.qualities],
    ratings: { ...recommendation.ratings },
    ...(recommendation.comment ? { comment: recommendation.comment } : {}),
    wouldRehire: recommendation.wouldRehire,
    badgeLabel: recommendation.candidateVisibility === 'visible'
      ? recommendation.verificationStatus === 'verified'
        ? 'Visible et vérifiée'
        : 'Visible'
      : recommendation.verificationStatus === 'verified'
        ? 'Vérifiée'
        : 'En attente',
  };
}

function toPublicRecommendationInvitation(
  invitation: CandidateRecommendationRequest,
): PublicCandidateRecommendationInvitation {
  return {
    id: invitation.id,
    publicCandidateId: invitation.publicCandidateId,
    respondentFirstName: invitation.respondentFirstName,
    respondentLastName: invitation.respondentLastName,
    respondentTitle: invitation.respondentTitle,
    respondentCompanyName: invitation.respondentCompanyName,
    ...(invitation.respondentWebsite ? { respondentWebsite: invitation.respondentWebsite } : {}),
    ...(invitation.respondentSiret ? { respondentSiret: invitation.respondentSiret } : {}),
    respondentEmailDomainClassification: invitation.respondentEmailDomainClassification,
    relationType: invitation.relationType,
    candidateJobTitle: invitation.candidateJobTitle,
    collaborationPeriodLabel: invitation.collaborationPeriodLabel,
    ...(invitation.collaborationStartLabel ? { collaborationStartLabel: invitation.collaborationStartLabel } : {}),
    ...(invitation.collaborationEndLabel ? { collaborationEndLabel: invitation.collaborationEndLabel } : {}),
    status: invitation.status,
    verificationStatus: invitation.verificationStatus,
    emailOwnershipVerified: invitation.emailOwnershipVerified,
    ...(invitation.viewedAt ? { viewedAt: invitation.viewedAt } : {}),
    ...(invitation.submittedAt ? { submittedAt: invitation.submittedAt } : {}),
    ...(invitation.revokedAt ? { revokedAt: invitation.revokedAt } : {}),
    ...(invitation.lastSentAt ? { lastSentAt: invitation.lastSentAt } : {}),
    tokenCreatedAt: invitation.tokenCreatedAt,
    tokenExpiresAt: invitation.tokenExpiresAt,
    createdAt: invitation.createdAt,
    updatedAt: invitation.updatedAt,
  };
}

async function loadCandidateProfile(uid: string) {
  const snapshot = await candidateProfileRef(uid).get();
  return snapshot.exists ? normalizeCandidateProfile(snapshot.data()) : null;
}

async function loadUser(uid: string) {
  const snapshot = await userRef(uid).get();
  return snapshot.exists ? (snapshot.data() as FirestoreRecord) : null;
}

async function loadRequestById(id: string) {
  const snapshot = await recommendationInvitationRef(id).get();
  return snapshot.exists ? normalizeRequest(snapshot.data(), snapshot.id) : null;
}

async function loadRecommendationById(id: string) {
  const snapshot = await recommendationRef(id).get();
  return snapshot.exists ? normalizeRecommendation(snapshot.data(), snapshot.id) : null;
}

async function loadRequestsByCandidateUid(candidateUid: string) {
  const snapshot = await requireAdminDatabase()
    .collection(RECOMMENDATION_REQUESTS_COLLECTION)
    .where('candidateUid', '==', candidateUid)
    .get();

  return snapshot.docs
    .map((doc) => normalizeRequest(doc.data(), doc.id))
    .filter((item): item is CandidateRecommendationRequest => Boolean(item));
}

async function loadRecommendationsByCandidateUid(candidateUid: string) {
  const snapshot = await requireAdminDatabase()
    .collection(RECOMMENDATIONS_COLLECTION)
    .where('candidateUid', '==', candidateUid)
    .get();

  return snapshot.docs
    .map((doc) => normalizeRecommendation(doc.data(), doc.id))
    .filter((item): item is CandidateRecommendation => Boolean(item));
}

async function loadVisibleRecommendationsByPublicCandidateId(publicCandidateId: string) {
  const snapshot = await requireAdminDatabase()
    .collection(RECOMMENDATIONS_COLLECTION)
    .where('publicCandidateId', '==', publicCandidateId)
    .where('verificationStatus', '==', 'verified')
    .where('candidateVisibility', '==', 'visible')
    .get();

  return snapshot.docs
    .map((doc) => normalizeRecommendation(doc.data(), doc.id))
    .filter((item): item is CandidateRecommendation => Boolean(item));
}

async function refreshCandidateRecommendationCounters(candidateUid: string) {
  const [requests, recommendations] = await Promise.all([
    loadRequestsByCandidateUid(candidateUid),
    loadRecommendationsByCandidateUid(candidateUid),
  ]);

  const invitationCount = requests.filter((request) => RECOMMENDATION_ACTIVE_STATUSES.includes(request.status) && !isExpiredInvitation(request)).length;
  const verificationPendingCount = recommendations.filter((recommendation) => recommendation.verificationStatus === 'verification_pending').length;
  const verifiedCount = recommendations.filter((recommendation) => recommendation.verificationStatus === 'verified').length;
  const visibleCount = recommendations.filter(
    (recommendation) => recommendation.verificationStatus === 'verified' && recommendation.candidateVisibility === 'visible',
  ).length;
  const now = Timestamp.now();

  await Promise.all([
    candidateProfileRef(candidateUid).update({
      recommendationInvitationCount: invitationCount,
      recommendationVerificationPendingCount: verificationPendingCount,
      recommendationVerifiedCount: verifiedCount,
      recommendationVisibleCount: visibleCount,
      updatedAt: now,
    }).catch(() => null),
    privateDataRef(candidateUid).set({
      uid: candidateUid,
      invitationCount,
      verificationPendingCount,
      verifiedCount,
      visibleCount,
      updatedAt: now,
    } satisfies CandidatePrivateRecommendationData),
  ]);
}

async function assertCandidateEligibility(candidateUid: string) {
  const [user, profile] = await Promise.all([loadUser(candidateUid), loadCandidateProfile(candidateUid)]);
  if (!user || user.role !== 'candidate') {
    throw new SevenoRecommendationError('candidate_user_missing', 404, 'Compte candidat introuvable.');
  }

  if (!profile || profile.profileStatus !== 'active') {
    throw new SevenoRecommendationError('candidate_profile_inactive', 409, 'Le profil candidat doit etre actif.');
  }

  return { user, profile };
}

async function assertInvitationOwnership(candidateUid: string, requestId: string) {
  const request = await loadRequestById(requestId);
  if (!request) {
    throw new SevenoRecommendationError('invitation_not_found', 404, 'Invitation introuvable.');
  }

  if (request.candidateUid !== candidateUid) {
    throw new SevenoRecommendationError('forbidden_invitation', 403, 'Cette invitation ne vous appartient pas.');
  }

  return request;
}

function ensureResendDelay(lastSentAt: Timestamp | null | undefined) {
  if (!lastSentAt) {
    return;
  }

  const minimumDelay = RECOMMENDATION_RESEND_DELAY_HOURS * 60 * 60 * 1000;
  if (Timestamp.now().toMillis() - lastSentAt.toMillis() < minimumDelay) {
    throw new SevenoRecommendationError(
      'resend_too_early',
      409,
      `Vous pourrez renvoyer cette invitation dans ${RECOMMENDATION_RESEND_DELAY_HOURS} heures.`,
    );
  }
}

function buildRecommendationPublicLink(token: string) {
  return `/recommandation/${token}`;
}

function normalizeSubmissionInput(value: unknown): CandidateRecommendationSubmissionInput {
  if (!isPlainObject(value)) {
    throw new SevenoRecommendationError('invalid_payload', 400, 'Le contenu envoye est invalide.');
  }

  const qualities = Array.isArray(value.qualities)
    ? value.qualities.map((item) => cleanText(item, 80)).filter(Boolean)
    : [];
  if (qualities.length === 0 || qualities.length > 5 || new Set(qualities).size !== qualities.length) {
    throw new SevenoRecommendationError('invalid_payload', 400, 'Selectionnez entre une et cinq qualites distinctes.');
  }

  const ratings = isPlainObject(value.ratings)
    ? {
        reliability: isRatingLevel(value.ratings.reliability) ? value.ratings.reliability : null,
        autonomy: isRatingLevel(value.ratings.autonomy) ? value.ratings.autonomy : null,
        teamwork: isRatingLevel(value.ratings.teamwork) ? value.ratings.teamwork : null,
        communication: isRatingLevel(value.ratings.communication) ? value.ratings.communication : null,
        adaptability: isRatingLevel(value.ratings.adaptability) ? value.ratings.adaptability : null,
      }
    : null;

  if (!ratings || Object.values(ratings).some((item) => item == null || item === 'not_evaluated')) {
    throw new SevenoRecommendationError('invalid_payload', 400, 'Renseignez toutes les evaluations.');
  }

  const normalizedRatings = ratings as CandidateRecommendationRatingSet;

  const wouldRehire = isWouldRehire(value.wouldRehire) ? value.wouldRehire : null;
  const comment = normalizeOptionalText(value.comment, 1000);
  const consentToRevealIdentity = value.consentToRevealIdentity === true;
  const certificationAccepted = value.certificationAccepted === true;

  if (!wouldRehire) {
    throw new SevenoRecommendationError('invalid_payload', 400, 'Le formulaire de recommandation est incomplet.');
  }

  if (!certificationAccepted) {
    throw new SevenoRecommendationError('missing_confirmation', 400, 'Confirmez la declaration et la certification avant envoi.');
  }

  return {
    qualities,
    ratings: normalizedRatings,
    ...(comment ? { comment } : {}),
    wouldRehire,
    consentToRevealIdentity,
    certificationAccepted,
  };
}

function normalizeInvitationInput(value: unknown): CandidateRecommendationInvitationInput {
  if (!isPlainObject(value)) {
    throw new SevenoRecommendationError('invalid_payload', 400, 'Le contenu envoye est invalide.');
  }

  return {
    respondentFirstName: normalizeRequiredText(value.respondentFirstName, 'prenom du referent', 80),
    respondentLastName: normalizeRequiredText(value.respondentLastName, 'nom du referent', 80),
    respondentTitle: normalizeRequiredText(value.respondentTitle, 'fonction du referent', 120),
    respondentCompanyName: normalizeRequiredText(value.respondentCompanyName, 'societe du referent', 160),
    respondentEmail: normalizeEmail(value.respondentEmail),
    relationType: isRecommendationRelationType(value.relationType) ? value.relationType : (() => {
      throw new SevenoRecommendationError('invalid_relation_type', 400, 'Le type de relation est invalide.');
    })(),
    candidateJobTitle: normalizeRequiredText(value.candidateJobTitle, 'poste occupe', 120),
    collaborationPeriodLabel: normalizeRequiredText(value.collaborationPeriodLabel, 'periode de collaboration', 120),
    collaborationStartLabel: normalizeOptionalText(value.collaborationStartLabel, 120) ?? null,
    collaborationEndLabel: normalizeOptionalText(value.collaborationEndLabel, 120) ?? null,
    respondentWebsite: normalizeOptionalWebsite(value.respondentWebsite) ?? null,
    respondentSiret: normalizeOptionalBusinessIdentifier(value.respondentSiret) ?? null,
  };
}

async function updateInvitationToken(request: CandidateRecommendationRequest, token: string) {
  const now = Timestamp.now();
  const tokenCreatedAt = now;
  const tokenExpiresAt = Timestamp.fromMillis(now.toMillis() + RECOMMENDATION_INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  await recommendationInvitationRef(request.id).update({
    tokenHash: tokenHash(token),
    tokenCreatedAt,
    tokenExpiresAt,
    lastSentAt: now,
    status: 'sent',
    updatedAt: now,
  });
  return process.env.NODE_ENV === 'production' ? null : buildRecommendationPublicLink(token);
}

export async function createCandidateRecommendationInvitation(
  candidateUid: string,
  input: unknown,
) {
  const firestore = requireAdminDatabase();
  const { profile, user } = await assertCandidateEligibility(candidateUid);
  const candidateEmail = cleanText(user.email).toLowerCase();
  const invitationInput = normalizeInvitationInput(input);
  if (candidateEmail && invitationInput.respondentEmail.toLowerCase() === candidateEmail) {
    throw new SevenoRecommendationError(
      'self_recommendation_forbidden',
      409,
      'Vous ne pouvez pas envoyer une invitation à votre propre adresse email.',
    );
  }
  const activeInvitations = (await loadRequestsByCandidateUid(candidateUid)).filter(isActiveInvitation);
  if (activeInvitations.length >= MAX_ACTIVE_RECOMMENDATION_INVITATIONS) {
    throw new SevenoRecommendationError(
      'too_many_active_invitations',
      409,
      `Vous ne pouvez pas maintenir plus de ${MAX_ACTIVE_RECOMMENDATION_INVITATIONS} invitations actives.`,
    );
  }

  const id = firestore.collection(RECOMMENDATION_REQUESTS_COLLECTION).doc().id;
  const token = generateRecommendationToken();
  const now = Timestamp.now();
  const tokenExpiresAt = Timestamp.fromMillis(now.toMillis() + RECOMMENDATION_INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  const request: CandidateRecommendationRequest = {
    id,
    candidateUid,
    publicCandidateId: profile.publicCandidateId,
    respondentFirstName: invitationInput.respondentFirstName,
    respondentLastName: invitationInput.respondentLastName,
    respondentTitle: invitationInput.respondentTitle,
    respondentCompanyName: invitationInput.respondentCompanyName,
    ...(invitationInput.respondentWebsite ? { respondentWebsite: invitationInput.respondentWebsite } : {}),
    ...(invitationInput.respondentSiret ? { respondentSiret: invitationInput.respondentSiret } : {}),
    respondentEmail: invitationInput.respondentEmail,
    respondentEmailDomainClassification: classifyEmailDomain(invitationInput.respondentEmail),
    relationType: invitationInput.relationType,
    candidateJobTitle: invitationInput.candidateJobTitle,
    collaborationPeriodLabel: invitationInput.collaborationPeriodLabel,
    ...(invitationInput.collaborationStartLabel ? { collaborationStartLabel: invitationInput.collaborationStartLabel } : {}),
    ...(invitationInput.collaborationEndLabel ? { collaborationEndLabel: invitationInput.collaborationEndLabel } : {}),
    tokenHash: tokenHash(token),
    tokenCreatedAt: now,
    tokenExpiresAt,
    status: 'sent',
    verificationStatus: 'not_started',
    emailOwnershipVerified: false,
    lastSentAt: now,
    createdAt: now,
    updatedAt: now,
  };
  const publicLink = process.env.NODE_ENV === 'production' ? null : buildRecommendationPublicLink(token);

  await firestore.runTransaction(async (transaction) => {
    transaction.create(recommendationInvitationRef(id), request);
    transaction.update(candidateProfileRef(candidateUid), {
      recommendationInvitationCount: (profile.recommendationInvitationCount ?? 0) + 1,
      updatedAt: now,
    });
  });

  await refreshCandidateRecommendationCounters(candidateUid);
  await queueRecommendationInvitationEmail(buildRecommendationInvitationEmailPreview(request, publicLink));

  return {
    request,
    publicLink,
  };
}

export async function resendCandidateRecommendationInvitation(candidateUid: string, requestId: string) {
  const request = await assertInvitationOwnership(candidateUid, requestId);
  if (request.status === 'revoked' || request.status === 'expired' || request.status === 'submitted') {
    throw new SevenoRecommendationError('invitation_closed', 409, 'Cette invitation ne peut plus etre renvoyee.');
  }

  ensureResendDelay(request.lastSentAt ? toTimestamp(request.lastSentAt) : null);
  const token = generateRecommendationToken();
  const publicLink = await updateInvitationToken(request, token);
  const updatedRequest = await loadRequestById(requestId);
  if (!updatedRequest) {
    throw new SevenoRecommendationError('invitation_not_found', 404, 'Invitation introuvable.');
  }
  await queueRecommendationInvitationEmail(buildRecommendationInvitationEmailPreview(updatedRequest, publicLink));
  await refreshCandidateRecommendationCounters(candidateUid);
  return {
    request: updatedRequest,
    publicLink,
  };
}

export async function revokeCandidateRecommendationInvitation(candidateUid: string, requestId: string) {
  const request = await assertInvitationOwnership(candidateUid, requestId);
  if (request.status === 'submitted') {
    throw new SevenoRecommendationError('invitation_submitted', 409, 'Une invitation deja repondue ne peut pas etre revolue.');
  }

  const now = Timestamp.now();
  await recommendationInvitationRef(requestId).update({
    status: 'revoked',
    revokedAt: now,
    updatedAt: now,
  });
  const updatedRequest = await loadRequestById(requestId);
  if (!updatedRequest) {
    throw new SevenoRecommendationError('invitation_not_found', 404, 'Invitation introuvable.');
  }
  await refreshCandidateRecommendationCounters(candidateUid);
  return updatedRequest;
}

async function findInvitationByToken(rawToken: string) {
  const hashed = tokenHash(rawToken);
  const snapshot = await requireAdminDatabase()
    .collection(RECOMMENDATION_REQUESTS_COLLECTION)
    .where('tokenHash', '==', hashed)
    .limit(2)
    .get();

  const invitations = snapshot.docs
    .map((doc) => normalizeRequest(doc.data(), doc.id))
    .filter((item): item is CandidateRecommendationRequest => Boolean(item));

  if (invitations.length > 1) {
    throw new SevenoRecommendationError('duplicate_token', 409, 'Plusieurs invitations partagent le meme token.');
  }

  return invitations[0] ?? null;
}

export async function loadPublicRecommendationInvitation(token: string) {
  const invitation = await findInvitationByToken(token);
  if (!invitation) {
    return null;
  }

  const now = Timestamp.now();
  const tokenExpiresAt = toTimestamp(invitation.tokenExpiresAt);
  if (!tokenExpiresAt) {
    throw new SevenoRecommendationError('invalid_invitation', 500, 'Invitation invalide.');
  }

  if (invitation.status === 'revoked' || invitation.status === 'expired') {
    throw new SevenoRecommendationError('invitation_revoked', 410, 'Cette invitation a ete revolue.');
  }

  if (invitation.status !== 'submitted' && tokenExpiresAt.toMillis() <= now.toMillis()) {
    await recommendationInvitationRef(invitation.id).update({
      status: 'expired',
      updatedAt: now,
    });
    throw new SevenoRecommendationError('invitation_expired', 410, 'Cette invitation a expire.');
  } else if (invitation.status === 'sent') {
    await recommendationInvitationRef(invitation.id).update({
      status: 'viewed',
      viewedAt: invitation.viewedAt ?? now,
      updatedAt: now,
    });
    invitation.status = 'viewed';
    if (!invitation.viewedAt) {
      invitation.viewedAt = now;
    }
  }

  const candidate = await loadCandidateProfile(invitation.candidateUid);
  return {
    invitation: toPublicRecommendationInvitation(invitation),
    candidate: cleanPublicCandidateProfile(candidate),
  };
}

export async function submitRecommendationByToken(token: string, input: unknown) {
  const firestore = requireAdminDatabase();
  const invitation = await findInvitationByToken(token);
  if (!invitation) {
    throw new SevenoRecommendationError('invitation_not_found', 404, 'Invitation introuvable.');
  }

  const now = Timestamp.now();
  const tokenExpiresAt = toTimestamp(invitation.tokenExpiresAt);
  if (!tokenExpiresAt) {
    throw new SevenoRecommendationError('invalid_invitation', 500, 'Invitation invalide.');
  }

  if (invitation.status === 'revoked') {
    throw new SevenoRecommendationError('invitation_revoked', 410, 'Cette invitation a ete revolue.');
  }

  if (invitation.status === 'submitted') {
    throw new SevenoRecommendationError('invitation_submitted', 409, 'Cette invitation a deja ete remplie.');
  }

  if (tokenExpiresAt.toMillis() <= now.toMillis()) {
    await recommendationInvitationRef(invitation.id).update({
      status: 'expired',
      updatedAt: now,
    });
    throw new SevenoRecommendationError('invitation_expired', 410, 'Cette invitation a expire.');
  }

  const submission = normalizeSubmissionInput(input);
  const candidate = await loadCandidateProfile(invitation.candidateUid);
  if (!candidate || candidate.profileStatus !== 'active') {
    throw new SevenoRecommendationError('candidate_profile_inactive', 409, 'Le profil candidat doit etre actif.');
  }

  const autoVerified = shouldAutoVerifyRecommendation(invitation.respondentEmailDomainClassification);
  const recommendationId = firestore.collection(RECOMMENDATIONS_COLLECTION).doc().id;
  const recommendation: CandidateRecommendation = {
    id: recommendationId,
    requestId: invitation.id,
    candidateUid: invitation.candidateUid,
    publicCandidateId: invitation.publicCandidateId,
    respondentFirstName: invitation.respondentFirstName,
    respondentLastName: invitation.respondentLastName,
    respondentTitle: invitation.respondentTitle,
    respondentCompanyName: invitation.respondentCompanyName,
    ...(invitation.respondentWebsite ? { respondentWebsite: invitation.respondentWebsite } : {}),
    ...(invitation.respondentSiret ? { respondentSiret: invitation.respondentSiret } : {}),
    respondentEmail: invitation.respondentEmail,
    respondentEmailDomainClassification: invitation.respondentEmailDomainClassification,
    relationType: invitation.relationType,
    candidateJobTitle: invitation.candidateJobTitle,
    collaborationPeriodLabel: invitation.collaborationPeriodLabel,
    ...(invitation.collaborationStartLabel ? { collaborationStartLabel: invitation.collaborationStartLabel } : {}),
    ...(invitation.collaborationEndLabel ? { collaborationEndLabel: invitation.collaborationEndLabel } : {}),
    qualities: submission.qualities,
    ratings: submission.ratings,
    ...(submission.comment ? { comment: submission.comment } : {}),
    wouldRehire: submission.wouldRehire,
    candidateVisibility: submission.consentToRevealIdentity ? 'visible' : 'hidden',
    consentToRevealIdentity: submission.consentToRevealIdentity,
    consentToRevealIdentityAt: submission.consentToRevealIdentity ? now : null,
    certificationAccepted: submission.certificationAccepted,
    certificationAcceptedAt: now,
    termsAcceptanceVersion: SEVENO_TERMS_VERSION,
    termsAcceptanceAcceptedAt: now,
    termsAcceptanceContext: 'professional_recommendation',
    termsAcceptanceGoodFaith: submission.certificationAccepted,
    emailOwnershipVerified: true,
    verificationStatus: autoVerified ? 'verified' : RECOMMENDATION_PENDING_VERIFICATION_STATUS,
    verifiedByAdminUid: null,
    verifiedAt: autoVerified ? now : null,
    verificationReason: null,
    publishedAt: autoVerified && submission.consentToRevealIdentity ? now : null,
    createdAt: now,
    updatedAt: now,
  };

  await firestore.runTransaction(async (transaction) => {
    const currentInvitationSnapshot = await transaction.get(recommendationInvitationRef(invitation.id));
    if (!currentInvitationSnapshot.exists) {
      throw new SevenoRecommendationError('invitation_not_found', 404, 'Invitation introuvable.');
    }

    const currentInvitation = normalizeRequest(currentInvitationSnapshot.data(), currentInvitationSnapshot.id);
    if (!currentInvitation) {
      throw new SevenoRecommendationError('invitation_invalid', 409, 'L invitation est invalide.');
    }

    if (currentInvitation.status !== invitation.status || currentInvitation.tokenHash !== invitation.tokenHash) {
      throw new SevenoRecommendationError('invitation_changed', 409, 'L invitation a ete modifiee. Rechargez la page.');
    }

    transaction.create(recommendationRef(recommendationId), recommendation);
    transaction.update(recommendationInvitationRef(invitation.id), {
      status: 'submitted',
      emailOwnershipVerified: true,
      submittedAt: now,
      verificationStatus: autoVerified ? 'verified' : RECOMMENDATION_PENDING_VERIFICATION_STATUS,
      verifiedAt: autoVerified ? now : null,
      verificationReason: null,
      updatedAt: now,
    });
  });

  await refreshCandidateRecommendationCounters(invitation.candidateUid);

  return {
    recommendation,
  };
}

export async function listCandidateRecommendationDashboard(candidateUid: string): Promise<CandidateRecommendationDashboard> {
  const [requests, recommendations] = await Promise.all([
    loadRequestsByCandidateUid(candidateUid),
    loadRecommendationsByCandidateUid(candidateUid),
  ]);

  return {
    invitationCount: requests.filter(isActiveInvitation).length,
    verificationPendingCount: recommendations.filter((item) => item.verificationStatus === 'verification_pending').length,
    verifiedCount: recommendations.filter((item) => item.verificationStatus === 'verified').length,
    visibleCount: recommendations.filter((item) => item.verificationStatus === 'verified' && item.candidateVisibility === 'visible').length,
    requests: requests.sort((left, right) => (toTimestamp(right.createdAt)?.toMillis() ?? 0) - (toTimestamp(left.createdAt)?.toMillis() ?? 0)),
    recommendations: recommendations.sort((left, right) => (toTimestamp(right.createdAt)?.toMillis() ?? 0) - (toTimestamp(left.createdAt)?.toMillis() ?? 0)),
  };
}

export async function loadCompanyCandidateRecommendationBundleByPublicId(publicCandidateId: string): Promise<CandidateRecommendationPublicBundle> {
  const candidateSnapshot = await requireAdminDatabase()
    .collection(CANDIDATE_PROFILES_COLLECTION)
    .where('publicCandidateId', '==', publicCandidateId)
    .where('profileStatus', '==', 'active')
    .limit(2)
    .get();

  const candidates = candidateSnapshot.docs
    .map((doc) => normalizeCandidateProfile(doc.data()))
    .filter((item): item is CandidateProfile => Boolean(item));

  if (candidates.length > 1) {
    throw new SevenoRecommendationError('duplicate_public_candidate_id', 409, 'Plusieurs profils utilisent le meme identifiant public.');
  }

  const candidate = cleanPublicCandidateProfile(candidates[0] ?? null);
  const recommendations = (await loadVisibleRecommendationsByPublicCandidateId(publicCandidateId))
    .map(buildPublicRecommendationSummary);

  return {
    candidate,
    recommendations,
  };
}

export async function verifyCandidateRecommendationByAdmin(
  adminUid: string,
  recommendationId: string,
  input: {
    action: 'verify' | 'reject';
    reason?: string;
  },
) {
  const snapshot = await recommendationRef(recommendationId).get();
  const recommendation = snapshot.exists ? normalizeRecommendation(snapshot.data(), snapshot.id) : null;
  if (!recommendation) {
    throw new SevenoRecommendationError('recommendation_not_found', 404, 'Recommandation introuvable.');
  }

  const now = Timestamp.now();
  if (input.action === 'reject') {
    await recommendationRef(recommendationId).update({
      verificationStatus: 'verification_rejected',
      verificationReason: normalizeOptionalText(input.reason, 300) ?? 'Rejetée par un administrateur.',
      verifiedByAdminUid: adminUid,
      verifiedAt: now,
      updatedAt: now,
    });
  } else {
    await recommendationRef(recommendationId).update({
      verificationStatus: 'verified',
      verificationReason: null,
      verifiedByAdminUid: adminUid,
      verifiedAt: now,
      publishedAt: recommendation.candidateVisibility === 'visible' ? now : null,
      updatedAt: now,
    });
  }

  await recommendationInvitationRef(recommendation.requestId).update({
    verificationStatus: input.action === 'verify' ? 'verified' : 'verification_rejected',
    verificationReason: normalizeOptionalText(input.reason, 300) ?? (input.action === 'reject' ? 'Rejetée par un administrateur.' : null),
    verifiedByAdminUid: adminUid,
    verifiedAt: now,
    updatedAt: now,
  });

  await refreshCandidateRecommendationCounters(recommendation.candidateUid);
  return {
    recommendation: await loadRecommendationById(recommendationId),
  };
}

export async function listAdminRecommendations() {
  const [requests, recommendations] = await Promise.all([
    requireAdminDatabase().collection(RECOMMENDATION_REQUESTS_COLLECTION).get(),
    requireAdminDatabase().collection(RECOMMENDATIONS_COLLECTION).get(),
  ]);

  return {
    requests: requests.docs.map((doc) => normalizeRequest(doc.data(), doc.id)).filter((item): item is CandidateRecommendationRequest => Boolean(item)),
    recommendations: recommendations.docs.map((doc) => normalizeRecommendation(doc.data(), doc.id)).filter((item): item is CandidateRecommendation => Boolean(item)),
  };
}
