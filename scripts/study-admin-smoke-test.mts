import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { calculateStudyStats } from '@/lib/study-analytics';
import type { StudyResponseRecord } from '@/types/study';

function readSource(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

function main() {
  const pageSource = readSource('app/admin/etude/page.tsx');

  const expectedSections = [
    'Vue d’ensemble des réponses',
    'Origine des répondants',
    'Répartition par profil',
    'Lecture du marché',
    'Ce qui bloque le plus',
    'Valeur perçue et attente produit',
    'Acceptation de la confirmation quotidienne',
    'Détection des réponses suspectes',
    'Métiers non listés',
    'Réponses individuelles',
    'Filtres',
    'Précédent',
    'Suivant',
  ];

  for (const section of expectedSections) {
    assert.match(pageSource, new RegExp(section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  assert.match(pageSource, /selectedViewSummary/);
  assert.match(pageSource, /availabilityNowBreakdown/);
  assert.match(pageSource, /studyAcquisitionChannelOptions/);
  assert.match(pageSource, /handleFilters/);
  assert.match(pageSource, /handlePageChange/);

  const sampleResponses: StudyResponseRecord[] = [
    {
      id: 'response-1',
      respondentType: 'professional_available',
      answers: {
        sectorCode: 'construction-btp',
        activeZoneCode: 'france',
        contractTypeCodes: ['cdi', 'cdd'],
        workModePreferenceCodes: ['onsite'],
        searchBlockerCodes: ['few_jobs', 'other'],
        marketMissingCodes: ['better_matching', 'other'],
        valueExpectationCodes: ['save_time', 'more_visibility'],
        dailyAvailabilityConfirmation: 'yes_without_problem',
        preferredContactChannel: 'email',
        currentRoleOther: 'Maçon coffreur',
        availabilityNow: 'yes',
      },
      wantsLaunchNotification: true,
      wantsBetaAccess: false,
      email: 'candidate@example.com',
      phone: '0600000000',
      acquisitionChannel: 'linkedin',
      visitorFingerprint: 'fingerprint-1',
      createdAt: null,
    },
    {
      id: 'response-2',
      respondentType: 'company',
      answers: {
        sectorCode: 'construction-btp',
        activeZoneCode: 'france',
        contractTypeCodes: ['cdi'],
        workModePreferenceCodes: ['hybrid'],
        searchBlockerCodes: ['salary'],
        marketMissingCodes: ['more_human_support'],
        valueExpectationCodes: ['more_qualified_profiles'],
        dailyAvailabilityConfirmation: 'no',
        preferredContactChannel: 'phone',
        currentRoleOther: 'Conducteur de travaux',
        availabilityNow: 'no',
      },
      wantsLaunchNotification: false,
      wantsBetaAccess: true,
      email: 'company@example.com',
      phone: '0611111111',
      acquisitionChannel: 'message_prive',
      visitorFingerprint: 'fingerprint-2',
      createdAt: null,
    },
    {
      id: 'response-3',
      respondentType: 'agency',
      answers: {
        sectorCode: 'construction-btp',
        activeZoneCode: 'belgium',
        contractTypeCodes: ['interim'],
        workModePreferenceCodes: ['remote'],
        searchBlockerCodes: ['too_slow'],
        marketMissingCodes: ['better_ai_usage'],
        valueExpectationCodes: ['complementary_candidate_source'],
        dailyAvailabilityConfirmation: 'yes_if_under_10_seconds',
        preferredContactChannel: 'both',
        currentRoleOther: 'Chef de projet',
        availabilityNow: 'yes',
      },
      wantsLaunchNotification: true,
      wantsBetaAccess: true,
      acquisitionChannel: 'ust_workflow',
      visitorFingerprint: 'fingerprint-3',
      createdAt: null,
    },
  ];

  const stats = calculateStudyStats(sampleResponses);

  assert.equal(stats.totalResponses, 3);
  assert.equal(stats.byProfile.professional_available, 1);
  assert.equal(stats.byProfile.company, 1);
  assert.equal(stats.byProfile.agency, 1);
  assert.equal(stats.byAcquisitionChannel.find((item) => item.value === 'linkedin')?.count, 1);
  assert.equal(stats.byAcquisitionChannel.find((item) => item.value === 'message_prive')?.count, 1);
  assert.equal(stats.byAcquisitionChannel.find((item) => item.value === 'ust_workflow')?.count, 1);
  assert.equal(stats.wantsLaunchNotification.true, 2);
  assert.equal(stats.wantsBetaAccess.true, 2);
  assert.equal(stats.dailyAvailabilityAcceptanceCount, 2);
  assert.equal(stats.currentRoleOtherDistinctCount, 3);
  assert.equal(stats.currentRoleOtherResponseCount, 3);
  assert.ok(stats.topSearchBlockerCodes.some((item) => item.value === 'other'));
  assert.ok(stats.topMarketMissingCodes.some((item) => item.value === 'better_matching'));
  assert.ok(stats.topValueExpectationCodes.some((item) => item.value === 'save_time'));
  assert.ok(stats.preferredContactChannel.some((item) => item.value === 'email'));

  console.log('Study admin smoke test: OK');
}

main();
