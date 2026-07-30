import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildCandidateSearchParams } from '@/lib/seveno-company-candidates';
import { isLegacyAssessmentResult, readLegacyAssessmentSummary } from '@/lib/seveno-legacy-assessment';
import { calculateProfessionalAssessmentOutcome } from '@/lib/seveno-professional-assessment';
import {
  SEVENO_PROFESSIONAL_ASSESSMENT_TEST_ONLY_INCOMPLETE_REQUEST,
} from '@/lib/seveno-professional-assessment-fixtures';

function readSource(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

function main() {
  const params = buildCandidateSearchParams({
    sectorId: 'construction-btp',
    jobFamilyId: 'gros-oeuvre',
    jobRoleId: 'macon-coffreur',
    locationArea: 'Gironde',
    availability: 'immediate',
    experienceLevel: 'intermediate',
  });
  assert.equal(params.has('minScore'), false);
  assert.equal(params.has('assessment'), false);

  const legacySummary = readLegacyAssessmentSummary({
    candidateUid: 'candidate-1',
    assessmentType: 'seveno_general',
    status: 'completed',
    overallScore: 78,
    scoresByDimension: {
      collaboration: 80,
      adaptability: 75,
      autonomy: 70,
      problem_solving: 88,
    },
    questionnaireVersion: 'legacy-1',
    sessionId: 'session-1',
    resultId: 'result-1',
    completedAt: new Date('2026-07-18T10:00:00.000Z'),
    updatedAt: new Date('2026-07-18T10:30:00.000Z'),
  });
  assert.ok(legacySummary);
  assert.equal(isLegacyAssessmentResult(legacySummary), true);
  assert.equal(legacySummary?.overallScore, 78);

  const incompleteProfessionalOutcome = calculateProfessionalAssessmentOutcome(
    SEVENO_PROFESSIONAL_ASSESSMENT_TEST_ONLY_INCOMPLETE_REQUEST,
  );
  assert.equal(incompleteProfessionalOutcome.report.precisionLevel, 'caution');
  assert.equal(
    incompleteProfessionalOutcome.alerts.some((alert) => alert.code === 'assessment_responses_incomplete'),
    true,
  );

  const companyServerSource = readSource('lib/seveno-company-candidates-server.ts');
  assert.doesNotMatch(companyServerSource, /minSevenoAssessmentScore/);
  assert.doesNotMatch(companyServerSource, /assessment === 'completed'/);
  assert.doesNotMatch(companyServerSource, /sevenoAssessmentOverallScore/);
  assert.doesNotMatch(companyServerSource, /orderBy\('sevenoAssessmentOverallScore'/);

  const companyPageSource = readSource('app/entreprise/page.tsx');
  assert.doesNotMatch(companyPageSource, /Indice Seven'O minimal/);
  assert.doesNotMatch(companyPageSource, /Evaluation Seven'O/);

  const enterpriseCandidatePageSource = readSource('app/entreprise/candidats/[publicCandidateId]/page.tsx');
  assert.doesNotMatch(enterpriseCandidatePageSource, /VÃ©rifiÃ© Seven O/);
  assert.doesNotMatch(enterpriseCandidatePageSource, /Indice Seven'O/);

  const testRouteSource = readSource('app/api/seveno/tests/start/route.ts');
  assert.match(testRouteSource, /startSevenoTestSession/);
  assert.match(testRouteSource, /getSevenoAssessmentStartState/);

  const testPageSource = readSource('app/candidat/test/page.tsx');
  assert.match(testPageSource, /CandidateSevenoTestRunner/);
  assert.doesNotMatch(testPageSource, /CandidateFeatureComingSoon/);

  const testRunnerSource = readSource('components/candidate/CandidateSevenoTestRunner.tsx');
  assert.match(testRunnerSource, /useSevenoCandidateSession/);
  assert.match(testRunnerSource, /startCandidateSevenoTestSessionClient/);
  assert.match(testRunnerSource, /submitCandidateSevenoTestSessionClient/);
  assert.match(testRunnerSource, /currentQuestionIndex/);
  assert.match(testRunnerSource, /questionExpiresAt/);
  assert.match(testRunnerSource, /questionTimeSeconds/);
  assert.match(testRunnerSource, /Question suivante/);
  assert.doesNotMatch(testRunnerSource, /questionnaire\.map\(\(question, index\)/);

  const testClientSource = readSource('lib/seveno-tests-client.ts');
  assert.equal(testClientSource.includes('/api/seveno/tests/start'), true);
  assert.equal(testClientSource.includes('/api/seveno/tests/submit'), true);

  const testServerSource = readSource('lib/seveno-tests.ts');
  assert.match(testServerSource, /getSevenoProfessionalAssessmentRepository/);
  assert.match(testServerSource, /buildPreviewBankDocumentFromVersion/);
  assert.match(testServerSource, /buildSevenoProfessionalAssessmentBankDraw/);
  assert.match(testServerSource, /calculateProfessionalAssessmentOutcome/);

  console.log('Assessment decoupling smoke test: OK');
}

main();
