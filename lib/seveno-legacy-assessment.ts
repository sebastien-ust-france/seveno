import 'server-only';

import { Timestamp } from 'firebase-admin/firestore';
import { adminDb, isFirebaseAdminConfigured } from '@/lib/firebase-admin';
import type { SevenoAssessmentScores } from '@/types/seveno';

export interface LegacySevenoAssessmentSummary {
  candidateUid: string;
  assessmentType: 'seveno_general';
  status: 'completed';
  overallScore: number;
  scoresByDimension: SevenoAssessmentScores;
  questionnaireVersion: string;
  sessionId: string;
  resultId: string;
  completedAt: Timestamp;
  updatedAt: Timestamp;
}

type FirestoreRecord = Record<string, unknown>;

function requireAdminDatabase() {
  if (!isFirebaseAdminConfigured || !adminDb) {
    throw new Error('Firebase Admin n est pas configure pour lire l historique SevenO.');
  }

  return adminDb;
}

function isPlainObject(value: unknown): value is FirestoreRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toTimestamp(value: unknown) {
  if (value instanceof Timestamp) {
    return value;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return Timestamp.fromDate(value);
  }

  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    const date = (value as { toDate: () => Date }).toDate();
    return date instanceof Date && !Number.isNaN(date.getTime()) ? Timestamp.fromDate(date) : null;
  }

  return null;
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export function isLegacyAssessmentResult(value: unknown): value is LegacySevenoAssessmentSummary {
  return readLegacyAssessmentSummary(value) !== null;
}

export function readLegacyAssessmentSummary(value: unknown): LegacySevenoAssessmentSummary | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const candidateUid = cleanText(value.candidateUid);
  const overallScore = value.overallScore;
  const scoresByDimension = value.scoresByDimension;
  const questionnaireVersion = cleanText(value.questionnaireVersion);
  const sessionId = cleanText(value.sessionId);
  const resultId = cleanText(value.resultId);
  const completedAt = toTimestamp(value.completedAt);
  const updatedAt = toTimestamp(value.updatedAt) ?? completedAt;

  if (
    value.assessmentType !== 'seveno_general'
    || value.status !== 'completed'
    || !candidateUid
    || typeof overallScore !== 'number'
    || !Number.isFinite(overallScore)
    || !scoresByDimension
    || typeof scoresByDimension !== 'object'
    || Array.isArray(scoresByDimension)
    || !questionnaireVersion
    || !sessionId
    || !resultId
    || !completedAt
  ) {
    return null;
  }

  return {
    candidateUid,
    assessmentType: 'seveno_general',
    status: 'completed',
    overallScore,
    scoresByDimension: scoresByDimension as SevenoAssessmentScores,
    questionnaireVersion,
    sessionId,
    resultId,
    completedAt,
    updatedAt: updatedAt ?? completedAt,
  };
}

export async function loadLegacyAssessmentSummary(uid: string): Promise<LegacySevenoAssessmentSummary | null> {
  const snapshot = await requireAdminDatabase().collection('candidate_assessment_summaries').doc(uid).get();
  return snapshot.exists ? readLegacyAssessmentSummary(snapshot.data()) : null;
}
