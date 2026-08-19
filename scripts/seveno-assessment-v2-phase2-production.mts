import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { initializeApp, deleteApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, Timestamp, type DocumentReference, type DocumentSnapshot } from 'firebase-admin/firestore';
import { validateAssessmentVersion } from '@/lib/seveno-professional-assessment';
import type { AssessmentVersionDescriptor } from '@/types/seveno-assessment';
import type { SevenoAssessmentStoredVersion } from '@/types/seveno-assessment-admin';
import { PHASE2_OUTPUT_PATH } from './seveno-assessment-v2-phase2-content.mts';

const PROJECT_ID = 'seveno-a8eb1';
const OLD_VERSION_ID = 'seveno-professional-assessment-bank-2a4319d5ee49';
const CONFIRMATION = 'PUBLISH_SEVENO_GENERAL_1_2_0';
const DATE_FIELDS = ['createdAt', 'updatedAt', 'publishedAt', 'archivedAt', 'activatedAt'] as const;

function stableValue(value: unknown): unknown {
  if (value instanceof Timestamp) return { __timestampMillis: value.toMillis() };
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, stableValue(child)]));
  }
  return value;
}

function fingerprint(value: unknown) {
  return createHash('sha256').update(JSON.stringify(stableValue(value))).digest('hex');
}

function contentFingerprint(version: Record<string, unknown>) {
  const lifecycleFields = new Set(['status', 'updatedAt', 'publishedAt', 'archivedAt', 'activatedAt', 'revisionNumber', 'hasStartedSessions']);
  return fingerprint(Object.fromEntries(Object.entries(version).filter(([key]) => !lifecycleFields.has(key))));
}

function toIso(value: unknown) {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return null;
}

function fromSnapshot(snapshot: DocumentSnapshot): SevenoAssessmentStoredVersion {
  const data = snapshot.data() as Record<string, unknown>;
  const normalized = { ...data, id: snapshot.id } as Record<string, unknown>;
  for (const field of DATE_FIELDS) normalized[field] = toIso(data[field]);
  return normalized as unknown as SevenoAssessmentStoredVersion;
}

function toFirestore(version: SevenoAssessmentStoredVersion) {
  const data = { ...structuredClone(version) } as Record<string, unknown>;
  for (const field of DATE_FIELDS) {
    const value = version[field];
    data[field] = value ? Timestamp.fromDate(new Date(value)) : null;
  }
  return data;
}

function prepareCliApplicationDefault() {
  const configPath = resolve(homedir(), '.config/configstore/firebase-tools.json');
  const config = JSON.parse(readFileSync(configPath, 'utf8')) as { tokens?: { refresh_token?: string } };
  const refreshToken = config.tokens?.refresh_token?.trim();
  assert.ok(refreshToken, 'Jeton Firebase CLI absent.');
  const require = createRequire(import.meta.url);
  const firebaseApi = require('firebase-tools/lib/api') as {
    clientId: () => string;
    clientSecret: () => string;
  };
  const adcPath = join(tmpdir(), `seveno-phase2-adc-${process.pid}-${Date.now()}.json`);
  writeFileSync(adcPath, JSON.stringify({
    type: 'authorized_user',
    client_id: firebaseApi.clientId(),
    client_secret: firebaseApi.clientSecret(),
    refresh_token: refreshToken,
  }), { encoding: 'utf8', mode: 0o600 });
  process.env.GOOGLE_APPLICATION_CREDENTIALS = adcPath;
  return { adcPath, credential: applicationDefault() };
}

type HistoricalSnapshot = {
  ref: DocumentReference;
  fingerprint: string;
  updateTime: number | null;
};

async function snapshotRefs(refs: DocumentReference[]): Promise<HistoricalSnapshot[]> {
  const snapshots = await Promise.all(refs.map((ref) => ref.get()));
  return snapshots.map((snapshot) => ({
    ref: snapshot.ref,
    fingerprint: fingerprint(snapshot.data()),
    updateTime: snapshot.updateTime?.toMillis() ?? null,
  }));
}

async function assertSnapshotsUnchanged(snapshots: HistoricalSnapshot[]) {
  const current = await Promise.all(snapshots.map((snapshot) => snapshot.ref.get()));
  for (const [index, snapshot] of current.entries()) {
    assert.equal(fingerprint(snapshot.data()), snapshots[index].fingerprint, `${snapshot.ref.path} a changé.`);
    assert.equal(snapshot.updateTime?.toMillis() ?? null, snapshots[index].updateTime, `${snapshot.ref.path} a été réécrit.`);
  }
}

async function main() {
  const publish = process.argv.includes('--publish');
  if (publish) assert.equal(process.env.SEVENO_PHASE2_CONFIRM_PUBLISH, CONFIRMATION, `Définissez SEVENO_PHASE2_CONFIRM_PUBLISH=${CONFIRMATION}.`);

  const previousGoogleCredentials = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const { adcPath, credential } = prepareCliApplicationDefault();
  const app = initializeApp({ projectId: PROJECT_ID, credential }, `seveno-phase2-${Date.now()}`);
  const db = getFirestore(app);
  db.settings({ ignoreUndefinedProperties: true });
  try {
    const {
      SevenoProfessionalAssessmentRepository,
      buildSevenoAssessmentDraftFromJson,
    } = await import('@/lib/seveno-professional-assessment-admin-repository');
    const versionsSnapshot = await db.collection('professional_assessment_versions').get();
    const versionSnapshotsById = new Map(versionsSnapshot.docs.map((snapshot) => [snapshot.id, snapshot]));
    const oldSnapshot = versionSnapshotsById.get(OLD_VERSION_ID);
    assert.ok(oldSnapshot?.exists, `Version ${OLD_VERSION_ID} introuvable.`);
    const oldVersion = fromSnapshot(oldSnapshot);
    assert.equal(oldVersion.version, '1.1.0');
    assert.equal(oldVersion.status, 'active', 'La 1.1.0 n’est plus la version active attendue.');
    const oldContentBefore = contentFingerprint(oldSnapshot.data() as Record<string, unknown>);

    const sourceJson = readFileSync(resolve(process.cwd(), PHASE2_OUTPUT_PATH), 'utf8');
    const draftPreview = buildSevenoAssessmentDraftFromJson(sourceJson);
    const strictValidation = validateAssessmentVersion({
      ...draftPreview,
      createdAt: new Date(draftPreview.createdAt),
      updatedAt: new Date(draftPreview.updatedAt),
    } as AssessmentVersionDescriptor, { mode: 'definition' });
    assert.equal(strictValidation.valid, true, JSON.stringify(strictValidation.issues, null, 2));
    assert.equal(strictValidation.issues.filter((issue) => issue.severity === 'error').length, 0);
    assert.equal(versionSnapshotsById.has(draftPreview.id), false, `La version ${draftPreview.id} existe déjà.`);

    const oldResultDocs = (await db.collection('test_results').where('professionalAssessmentVersionId', '==', OLD_VERSION_ID).get()).docs
      .sort((left, right) => left.id.localeCompare(right.id))
      .slice(0, 5);
    assert.equal(oldResultDocs.length, 5, 'Cinq résultats historiques 1.1.0 sont requis pour le contrôle.');
    const candidateUids = [...new Set(oldResultDocs.map((snapshot) => snapshot.get('uid')).filter((uid): uid is string => typeof uid === 'string'))];
    const summaryRefs = candidateUids.map((uid) => db.collection('candidate_assessment_summaries').doc(uid));
    const submittedSessionDocs = (await db.collection('test_sessions').where('professionalAssessmentVersionId', '==', OLD_VERSION_ID).get()).docs
      .filter((snapshot) => snapshot.get('status') === 'submitted')
      .sort((left, right) => left.id.localeCompare(right.id))
      .slice(0, 5);
    assert.equal(submittedSessionDocs.length, 5, 'Cinq sessions submitted 1.1.0 sont requises pour le contrôle.');
    const historical = await snapshotRefs([
      ...oldResultDocs.map((snapshot) => snapshot.ref),
      ...summaryRefs,
      ...submittedSessionDocs.map((snapshot) => snapshot.ref),
    ]);

    if (!publish) {
      console.log(JSON.stringify({
        mode: 'read-only',
        projectId: PROJECT_ID,
        oldVersionId: OLD_VERSION_ID,
        oldVersionStatus: oldVersion.status,
        oldContentFingerprint: oldContentBefore,
        newVersionId: draftPreview.id,
        newVersion: draftPreview.version,
        blockingErrors: 0,
        historicalResultsChecked: oldResultDocs.length,
        summariesChecked: summaryRefs.length,
        submittedSessionsChecked: submittedSessionDocs.length,
      }, null, 2));
      return;
    }

    const repository = new SevenoProfessionalAssessmentRepository(versionsSnapshot.docs.map(fromSnapshot));
    const imported = repository.importDraftFromJson(sourceJson);
    assert.equal(imported.id, draftPreview.id);
    const pilot = repository.markAsPilot(imported.id, imported.revisionNumber);
    const active = repository.publishVersion(pilot.id, pilot.revisionNumber);
    const archivedOld = repository.readVersion(OLD_VERSION_ID);
    assert.ok(archivedOld);
    assert.equal(active.status, 'active');
    assert.equal(archivedOld.status, 'archived');
    assert.equal(contentFingerprint(toFirestore(archivedOld)), oldContentBefore, 'Le contenu 1.1.0 a changé dans le pipeline.');

    await db.runTransaction(async (transaction) => {
      const oldCurrent = await transaction.get(oldSnapshot.ref);
      const newRef = db.collection('professional_assessment_versions').doc(active.id);
      const newCurrent = await transaction.get(newRef);
      assert.equal(newCurrent.exists, false, 'La nouvelle version a été créée concurremment.');
      assert.equal(oldCurrent.updateTime?.toMillis(), oldSnapshot.updateTime?.toMillis(), 'La 1.1.0 a changé depuis l’audit.');
      transaction.set(oldSnapshot.ref, toFirestore(archivedOld));
      transaction.create(newRef, toFirestore(active));
    });

    const [oldAfter, newAfter] = await Promise.all([
      oldSnapshot.ref.get(),
      db.collection('professional_assessment_versions').doc(active.id).get(),
    ]);
    assert.equal(oldAfter.get('status'), 'archived');
    assert.equal(newAfter.get('status'), 'active');
    assert.equal(contentFingerprint(oldAfter.data() as Record<string, unknown>), oldContentBefore, 'Le contenu 1.1.0 a changé après publication.');
    const publishedValidation = validateAssessmentVersion({
      ...fromSnapshot(newAfter),
      createdAt: newAfter.get('createdAt').toDate(),
      updatedAt: newAfter.get('updatedAt').toDate(),
      publishedAt: newAfter.get('publishedAt').toDate(),
    } as AssessmentVersionDescriptor, { mode: 'definition' });
    assert.equal(publishedValidation.valid, true, JSON.stringify(publishedValidation.issues, null, 2));
    await assertSnapshotsUnchanged(historical);

    console.log(JSON.stringify({
      mode: 'published',
      projectId: PROJECT_ID,
      oldVersionId: OLD_VERSION_ID,
      oldContentUnchanged: true,
      oldLifecycleStatus: oldAfter.get('status'),
      newVersionId: active.id,
      newVersion: active.version,
      newStatus: newAfter.get('status'),
      blockingErrors: 0,
      historicalResultsUnchanged: oldResultDocs.length,
      summariesUnchanged: summaryRefs.length,
      submittedSessionsUnchanged: submittedSessionDocs.length,
    }, null, 2));
  } finally {
    await deleteApp(app);
    if (existsSync(adcPath)) unlinkSync(adcPath);
    if (previousGoogleCredentials) process.env.GOOGLE_APPLICATION_CREDENTIALS = previousGoogleCredentials;
    else delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
  }
}

await main();
