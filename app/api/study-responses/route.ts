import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb, isFirebaseAdminConfigured } from '@/lib/firebase-admin';
import { normalizeAcquisitionSourceCode } from '@/lib/study-acquisition';
import type { RespondentType, StudyResponseInput } from '@/types/study';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type StudySubmissionBody = StudyResponseInput & {
  visitorFingerprint?: string;
  website?: string;
};

const TEXT_LIMITS: Record<string, number> = {
  activeZoneOther: 100,
  languagesOther: 100,
  marketMissingOther: 200,
  openReason: 300,
  improvementNote: 500,
  feedbackNote: 500,
};

const ACQUISITION_TEXT_LIMITS: Record<string, number> = {
  source: 80,
  utmSource: 80,
  utmMedium: 80,
  utmCampaign: 160,
};

const allowedRespondentTypes: RespondentType[] = [
  'professional_available',
  'professional_employed',
  'company',
  'agency',
];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isRespondentType(value: unknown): value is RespondentType {
  return typeof value === 'string' && allowedRespondentTypes.includes(value as RespondentType);
}

function toBoolean(value: unknown): boolean {
  return value === true;
}

function toStringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isTextWithinLimit(value: unknown, maxLength: number) {
  return typeof value !== 'string' || value.length <= maxLength;
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function normalizePhone(value: string) {
  return value.replace(/\D+/g, '');
}

function normalizeFingerprint(value: string) {
  return value.trim().toLowerCase();
}

function getDocumentValue(data: Record<string, unknown>, key: string): unknown {
  return data[key];
}

async function getExistingStudyResponses() {
  if (!isFirebaseAdminConfigured || !adminDb) {
    return null;
  }

  const snapshot = await adminDb.collection('study_responses').get();
  return snapshot.docs.map((doc) => doc.data() as Record<string, unknown>);
}

export async function POST(request: NextRequest) {
  // Future hardening: require Firebase App Check tokens from the public client
  // once App Check with reCAPTCHA v3 is enabled in the frontend configuration.
  if (!isFirebaseAdminConfigured || !adminDb) {
    return NextResponse.json(
      {
        error: 'firebase_admin_missing',
        message:
          'Firebase Admin n est pas configure. Ajoutez FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL et FIREBASE_ADMIN_PRIVATE_KEY.',
      },
      { status: 500 },
    );
  }

  let body: StudySubmissionBody;
  try {
    body = (await request.json()) as StudySubmissionBody;
  } catch {
    return NextResponse.json(
      {
        error: 'invalid_payload',
        message: "La réponse n'a pas pu être enregistrée. Merci de réessayer.",
      },
      { status: 400 },
    );
  }

  if (!isRespondentType(body.respondentType)) {
    return NextResponse.json(
      {
        error: 'invalid_respondent_type',
        message: "La réponse n'a pas pu être enregistrée. Merci de réessayer.",
      },
      { status: 400 },
    );
  }

  if (!isPlainObject(body.answers)) {
    return NextResponse.json(
      {
        error: 'invalid_answers',
        message: "La réponse n'a pas pu être enregistrée. Merci de réessayer.",
      },
      { status: 400 },
    );
  }

  const websiteTrap = toStringValue(body.website ?? '');
  if (websiteTrap.length > 0) {
    return NextResponse.json(
      {
        error: 'honeypot_triggered',
        message: "La réponse n'a pas pu être enregistrée. Merci de réessayer.",
      },
      { status: 400 },
    );
  }

  const email = toStringValue(body.email);
  const phone = toStringValue(body.phone);
  const visitorFingerprint = toStringValue(body.visitorFingerprint);
  const utmSource = normalizeAcquisitionSourceCode(body.utmSource);
  const discoverySource = !utmSource ? normalizeAcquisitionSourceCode(body.discoverySource) : undefined;
  const source = utmSource ?? discoverySource ?? normalizeAcquisitionSourceCode(body.source);
  const utmMedium = toStringValue(body.utmMedium);
  const utmCampaign = toStringValue(body.utmCampaign);
  const wantsLaunchNotification = toBoolean(body.wantsLaunchNotification);
  const wantsBetaAccess = toBoolean(body.wantsBetaAccess);
  const wantsProjectUpdates =
    body.respondentType === 'company' || body.respondentType === 'agency' ? toBoolean(body.wantsProjectUpdates) : undefined;
  const logoFeedback = body.logoFeedback === 'yes' || body.logoFeedback === 'no' ? body.logoFeedback : undefined;
  const answers = body.answers as Record<string, unknown>;

  for (const [key, maxLength] of Object.entries(TEXT_LIMITS)) {
    if (!isTextWithinLimit(answers[key], maxLength)) {
      return NextResponse.json(
        {
          error: 'invalid_text_length',
          message: "La réponse n'a pas pu être enregistrée. Merci de réessayer.",
        },
        { status: 400 },
      );
    }
  }

  if (!isTextWithinLimit(body.email, 254) || !isTextWithinLimit(body.phone, 32)) {
    return NextResponse.json(
      {
        error: 'invalid_contact_length',
        message: "La réponse n'a pas pu être enregistrée. Merci de réessayer.",
      },
      { status: 400 },
    );
  }

  for (const [key, maxLength] of Object.entries(ACQUISITION_TEXT_LIMITS)) {
    if (!isTextWithinLimit(body[key as keyof StudySubmissionBody], maxLength)) {
      return NextResponse.json(
        {
          error: 'invalid_acquisition_length',
          message: "La réponse n'a pas pu être enregistrée. Merci de réessayer.",
        },
        { status: 400 },
      );
    }
  }

  const existingResponses = await getExistingStudyResponses();
  if (existingResponses === null) {
    return NextResponse.json(
      {
        error: 'firebase_admin_missing',
        message:
          'Firebase Admin n est pas configure. Ajoutez FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL et FIREBASE_ADMIN_PRIVATE_KEY.',
      },
      { status: 500 },
    );
  }

  const normalizedEmail = normalizeEmail(email);
  if (normalizedEmail) {
    const duplicateEmail = existingResponses.find((data) => normalizeEmail(toStringValue(getDocumentValue(data, 'email'))) === normalizedEmail);
    if (duplicateEmail) {
      return NextResponse.json(
        {
          error: 'duplicate_email',
          message: 'Une réponse a déjà été enregistrée avec cette adresse email.',
        },
        { status: 409 },
      );
    }
  }

  const normalizedPhone = normalizePhone(phone);
  if (normalizedPhone) {
    const duplicatePhone = existingResponses.find((data) => normalizePhone(toStringValue(getDocumentValue(data, 'phone'))) === normalizedPhone);
    if (duplicatePhone) {
      return NextResponse.json(
        {
          error: 'duplicate_phone',
          message: 'Une réponse a déjà été enregistrée avec ce numéro.',
        },
        { status: 409 },
      );
    }
  }

  const normalizedFingerprint = normalizeFingerprint(visitorFingerprint);
  if (normalizedFingerprint) {
    const duplicateFingerprint = existingResponses.find(
      (data) => normalizeFingerprint(toStringValue(getDocumentValue(data, 'visitorFingerprint'))) === normalizedFingerprint,
    );
    if (duplicateFingerprint) {
      return NextResponse.json(
        {
          error: 'duplicate_fingerprint',
          message: 'Une réponse a déjà été enregistrée depuis ce navigateur.',
        },
        { status: 409 },
      );
    }
  }

  const recentWindow = existingResponses
    .map((data) => {
      const createdAt = getDocumentValue(data, 'createdAt');
      const createdAtMs =
        createdAt instanceof Date
          ? createdAt.getTime()
          : typeof createdAt === 'object' && createdAt && 'toMillis' in createdAt && typeof (createdAt as { toMillis?: () => number }).toMillis === 'function'
            ? (createdAt as { toMillis: () => number }).toMillis()
            : typeof createdAt === 'object' && createdAt && 'seconds' in createdAt && typeof (createdAt as { seconds?: number }).seconds === 'number'
              ? ((createdAt as { seconds: number; nanoseconds?: number }).seconds * 1000) +
                Math.floor((((createdAt as { nanoseconds?: number }).nanoseconds ?? 0) / 1_000_000))
              : null;

      return createdAtMs;
    })
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
    .sort((left, right) => left - right);

  let burstWindowDetected = false;
  for (let index = 0; index < recentWindow.length; index += 1) {
    const windowStart = recentWindow[index];
    let windowCount = 1;
    for (let cursor = index + 1; cursor < recentWindow.length; cursor += 1) {
      if (recentWindow[cursor] - windowStart <= 10 * 60 * 1000) {
        windowCount += 1;
      } else {
        break;
      }
    }

    if (windowCount > 3) {
      burstWindowDetected = true;
      break;
    }
  }

  const firestorePayload: Record<string, unknown> = {
    respondentType: body.respondentType,
    answers: body.answers,
    wantsLaunchNotification,
    wantsBetaAccess,
    email,
    phone,
    ...(source ? { source } : {}),
    ...(utmSource ? { utmSource } : {}),
    ...(utmMedium ? { utmMedium } : {}),
    ...(utmCampaign ? { utmCampaign } : {}),
    ...(discoverySource ? { discoverySource } : {}),
    ...(body.respondentType === 'company' || body.respondentType === 'agency'
      ? { wantsProjectUpdates: wantsProjectUpdates ?? false }
      : {}),
    ...(logoFeedback ? { logoFeedback } : {}),
    ...(normalizedFingerprint ? { visitorFingerprint: normalizedFingerprint } : {}),
    createdAt: Timestamp.now(),
  };

  await adminDb.collection('study_responses').add(firestorePayload);

  return NextResponse.json({
    ok: true,
    burstWindowDetected,
  });
}
