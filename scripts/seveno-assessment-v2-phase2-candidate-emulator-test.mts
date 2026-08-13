import assert from 'node:assert/strict';
import net from 'node:net';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  buildSevenoProfessionalAssessmentDraftFromBankDocument,
  parseSevenoProfessionalAssessmentBankDocument,
} from '@/lib/seveno-professional-assessment-bank';
import { PHASE2_OUTPUT_PATH } from './seveno-assessment-v2-phase2-content.mts';
import type { TestSessionStartResult } from '@/types/seveno';

const projectId = process.env.SEVENO_EMULATOR_PROJECT_ID ?? 'seveno-phase2-emulator';
process.env.NODE_ENV = 'test';
process.env.GCLOUD_PROJECT = projectId;
process.env.PROJECT_ID = projectId;
process.env.FIREBASE_ADMIN_PROJECT_ID = projectId;
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = projectId;
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8081';
process.env.SEVENO_PROFESSIONAL_ASSESSMENT_ADMIN_STORE = 'memory';

async function assertEmulatorAvailable() {
  const [host, portText] = process.env.FIRESTORE_EMULATOR_HOST!.split(':');
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const socket = net.createConnection({ host, port: Number(portText) });
    const timeout = setTimeout(() => {
      socket.destroy();
      rejectPromise(new Error(`Firestore Emulator inaccessible sur ${process.env.FIRESTORE_EMULATOR_HOST}.`));
    }, 1500);
    socket.once('connect', () => {
      clearTimeout(timeout);
      socket.end();
      resolvePromise();
    });
    socket.once('error', rejectPromise);
  });
}

async function main() {
  await assertEmulatorAvailable();
  const { Timestamp } = await import('firebase-admin/firestore');
  const { adminDb } = await import('@/lib/firebase-admin');
  const { resetSevenoProfessionalAssessmentRepository } = await import('@/lib/seveno-professional-assessment-admin-repository');
  const { startSevenoTestSession, submitSevenoTestSession } = await import('@/lib/seveno-tests');
  assert.ok(adminDb);

  const bank = parseSevenoProfessionalAssessmentBankDocument(readFileSync(resolve(process.cwd(), PHASE2_OUTPUT_PATH), 'utf8'));
  const draft = buildSevenoProfessionalAssessmentDraftFromBankDocument(bank, {
    createdBy: 'phase2-candidate-emulator',
    now: new Date('2026-08-13T11:00:00.000Z'),
  });
  const activeVersion = {
    ...draft,
    status: 'active' as const,
    publishedAt: '2026-08-13T11:00:00.000Z',
  };
  resetSevenoProfessionalAssessmentRepository([activeVersion]);

  const questionById = new Map(activeVersion.questions.map((question) => [question.id, question]));
  const suffix = randomUUID().slice(0, 8);
  const historicalResultRef = adminDb.collection('test_results').doc(`phase2-historical-${suffix}`);
  const historicalSummaryRef = adminDb.collection('candidate_assessment_summaries').doc(`phase2-historical-${suffix}`);
  const historicalSessionRef = adminDb.collection('test_sessions').doc(`phase2-historical-${suffix}`);
  const historical = { marker: `unchanged-${suffix}`, version: '1.1.0', updatedAt: Timestamp.fromMillis(1000) };
  await Promise.all([
    historicalResultRef.set(historical),
    historicalSummaryRef.set(historical),
    historicalSessionRef.set({ ...historical, status: 'submitted' }),
  ]);
  const historicalBefore = await Promise.all([historicalResultRef.get(), historicalSummaryRef.get(), historicalSessionRef.get()]);

  async function seedCandidate(uid: string) {
    const now = Timestamp.now();
    await adminDb!.collection('users').doc(uid).set({
      uid,
      role: 'candidate',
      authProvider: 'google',
      email: `${uid}@seveno.test`,
      emailVerified: true,
      onboardingCompleted: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  async function completeCandidate(timeoutAnswerCounts: Set<number>) {
    const uid = `phase2-candidate-${timeoutAnswerCounts.size}-${randomUUID().slice(0, 8)}`;
    await seedCandidate(uid);
    let state: TestSessionStartResult = await startSevenoTestSession(uid);
    assert.equal(state.professionalAssessmentVersionId, activeVersion.id);
    assert.equal(state.questions.length, 40);
    const initialQuestionIds = state.questions.map((question) => question.id);
    const timeoutQuestionIds: string[] = [];
    const consumedTimeoutAnswerCounts = new Set<number>();
    let answerCount = 0;
    let terminalResponse: Awaited<ReturnType<typeof submitSevenoTestSession>> | null = null;
    let lastSubmission: { questionId: string; answer: string } | null = null;

    for (let safety = 0; safety < 100; safety += 1) {
      const currentQuestion = state.questions[state.currentQuestionIndex];
      assert.ok(currentQuestion, `Question introuvable à l’index ${state.currentQuestionIndex}/${state.questions.length}.`);
      assert.equal(Date.parse(state.questionExpiresAt ?? '') - Date.parse(state.questionStartedAt), 30000);
      const shouldTimeout = timeoutAnswerCounts.has(answerCount) && !consumedTimeoutAnswerCounts.has(answerCount);
      if (shouldTimeout) {
        consumedTimeoutAnswerCounts.add(answerCount);
        timeoutQuestionIds.push(currentQuestion.id);
        await adminDb!.collection('test_sessions').doc(state.sessionId).update({
          questionExpiresAt: Timestamp.fromMillis(Date.now() - 1000),
        });
        const response = await submitSevenoTestSession(uid, state.sessionId, {
          sessionId: state.sessionId,
          questionId: currentQuestion.id,
          answer: null,
          timeout: true,
        });
        assert.ok('session' in response && response.session);
        state = response.session;
        assert.ok(state.questions[state.currentQuestionIndex], 'La question suivant le timeout doit être résoluble dans le payload candidat.');
        continue;
      }

      const runtimeQuestion = questionById.get(currentQuestion.id);
      assert.ok(runtimeQuestion);
      const dimension = runtimeQuestion.primaryDimensionCodes[0];
      const selected = [...runtimeQuestion.options]
        .sort((left, right) => (right.dimensionScores[dimension] ?? 0) - (left.dimensionScores[dimension] ?? 0))[0];
      lastSubmission = { questionId: currentQuestion.id, answer: selected.id };
      const response = await submitSevenoTestSession(uid, state.sessionId, {
        sessionId: state.sessionId,
        questionId: currentQuestion.id,
        answer: selected.id,
        timeout: false,
      });
      answerCount += 1;
      if ('session' in response) {
        if (response.session) {
          state = response.session;
          continue;
        }
        assert.ok(response.assessment);
        terminalResponse = response;
      } else {
        terminalResponse = response;
      }
      break;
    }

    assert.ok(terminalResponse, 'Le questionnaire doit produire un résultat terminal.');
    assert.equal(answerCount, 40);

    const sessionRef = adminDb!.collection('test_sessions').doc(state.sessionId);
    const resultRef = adminDb!.collection('test_results').doc(state.sessionId);
    const summaryRef = adminDb!.collection('candidate_assessment_summaries').doc(uid);
    const [session, result, summary] = await Promise.all([sessionRef.get(), resultRef.get(), summaryRef.get()]);
    const questionIds = (session.get('questionIds') as string[] | undefined) ?? [];
    const timedOutQuestionIds = (session.get('timedOutQuestionIds') as string[] | undefined) ?? [];
    const answers = (session.get('answers') as Record<string, string> | undefined) ?? {};
    assert.equal(session.get('status'), 'submitted');
    assert.equal(session.get('answersCount'), 40);
    assert.equal(Object.keys(answers).length, 40);
    assert.equal(questionIds.length, 40 + timeoutQuestionIds.length);
    assert.equal(session.get('questionsPresentedCount'), questionIds.length);
    assert.deepEqual(timedOutQuestionIds, timeoutQuestionIds);
    assert.equal(new Set(questionIds).size, questionIds.length);
    assert.equal(result.exists, true);
    assert.equal(Object.keys((result.get('answers') as Record<string, string> | undefined) ?? {}).length, 40);
    assert.equal(Object.keys((result.get('scoresByDimension') as Record<string, number> | undefined) ?? {}).length, 7);
    assert.ok((result.get('overallScore') as number | undefined ?? 0) > 0);
    assert.ok(result.get('behavioralProfile'));
    assert.ok(summary.exists);

    const replacements = questionIds.slice(initialQuestionIds.length);
    assert.equal(replacements.length, timeoutQuestionIds.length);
    for (const [index, replacementId] of replacements.entries()) {
      assert.equal(questionById.get(replacementId)?.path, questionById.get(timeoutQuestionIds[index])?.path);
    }

    assert.ok(lastSubmission);
    const beforeRetry = await Promise.all([sessionRef.get(), resultRef.get(), summaryRef.get()]);
    const retry = await submitSevenoTestSession(uid, state.sessionId, {
      sessionId: state.sessionId,
      questionId: lastSubmission.questionId,
      answer: lastSubmission.answer,
      timeout: false,
    });
    assert.equal(retry.sessionId, state.sessionId);
    const afterRetry = await Promise.all([sessionRef.get(), resultRef.get(), summaryRef.get()]);
    assert.deepEqual(afterRetry.map((snapshot) => snapshot.data()), beforeRetry.map((snapshot) => snapshot.data()));
    assert.deepEqual(afterRetry.map((snapshot) => snapshot.updateTime?.toMillis()), beforeRetry.map((snapshot) => snapshot.updateTime?.toMillis()));

    return {
      sessionId: state.sessionId,
      timeoutCount: timeoutQuestionIds.length,
      questionsPresentedCount: questionIds.length,
      overallScore: result.get('overallScore'),
    };
  }

  const normal = await completeCandidate(new Set());
  const oneTimeout = await completeCandidate(new Set([7]));
  const multipleTimeouts = await completeCandidate(new Set([3, 17, 29]));
  assert.equal(normal.questionsPresentedCount, 40);
  assert.equal(oneTimeout.questionsPresentedCount, 41);
  assert.equal(multipleTimeouts.questionsPresentedCount, 43);

  const historicalAfter = await Promise.all([historicalResultRef.get(), historicalSummaryRef.get(), historicalSessionRef.get()]);
  assert.deepEqual(historicalAfter.map((snapshot) => snapshot.data()), historicalBefore.map((snapshot) => snapshot.data()));
  assert.deepEqual(historicalAfter.map((snapshot) => snapshot.updateTime?.toMillis()), historicalBefore.map((snapshot) => snapshot.updateTime?.toMillis()));

  console.log(JSON.stringify({ normal, oneTimeout, multipleTimeouts, historicalDocumentsUnchanged: true }, null, 2));
}

await main();
