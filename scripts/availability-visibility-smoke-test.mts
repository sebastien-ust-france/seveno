import assert from 'node:assert/strict';
import {
  getCandidateAvailabilityView,
  isCandidateCurrentlyImmediatelyAvailable,
  isImmediateAvailabilityConfirmed,
  isProfileVisibleToCompanies,
} from '@/lib/seveno-candidate-availability';

function buildAvailabilityProfile(overrides: Partial<{
  profileStatus: 'draft' | 'active' | 'paused';
  availability: 'immediate' | 'less_than_1_month' | 'one_to_three_months' | 'listening' | 'not_available';
  availabilityConfirmedAt: Date | null;
  availabilityValidUntil: Date | null;
  availabilityAvailableFromAt: Date | null;
  availabilityTimezone: string;
  dailyAvailabilityConfirmationEnabled: boolean;
  hasActiveAvailabilityPushSubscription: boolean;
  nextAvailabilityReminderAt: Date | null;
}>) {
  return {
    profileStatus: 'active' as const,
    availability: 'immediate' as const,
    availabilityConfirmedAt: new Date('2026-07-18T08:00:00.000Z'),
    availabilityValidUntil: new Date('2026-07-18T18:00:00.000Z'),
    availabilityAvailableFromAt: null,
    availabilityTimezone: 'Europe/Paris',
    dailyAvailabilityConfirmationEnabled: true,
    hasActiveAvailabilityPushSubscription: true,
    nextAvailabilityReminderAt: new Date('2026-07-19T08:00:00.000Z'),
    ...overrides,
  };
}

function main() {
  const reference = new Date('2026-07-18T12:00:00.000Z');
  const activeProfile = buildAvailabilityProfile({});
  const expiredProfile = buildAvailabilityProfile({
    availabilityValidUntil: new Date('2026-07-18T10:00:00.000Z'),
  });

  assert.equal(isProfileVisibleToCompanies({ profileStatus: 'active' }), true);
  assert.equal(isProfileVisibleToCompanies({ profileStatus: 'draft' }), false);

  assert.equal(isImmediateAvailabilityConfirmed(activeProfile, reference), true);
  assert.equal(isCandidateCurrentlyImmediatelyAvailable(activeProfile, reference), true);

  assert.equal(isImmediateAvailabilityConfirmed(expiredProfile, reference), false);
  assert.equal(isCandidateCurrentlyImmediatelyAvailable(expiredProfile, reference), false);

  const activeView = getCandidateAvailabilityView(activeProfile, reference);
  assert.equal(activeView.isProfileVisibleToCompanies, true);
  assert.equal(activeView.isImmediateAvailabilityConfirmed, true);
  assert.equal(activeView.state, 'available_now');

  const expiredView = getCandidateAvailabilityView(expiredProfile, reference);
  assert.equal(expiredView.isProfileVisibleToCompanies, true);
  assert.equal(expiredView.isImmediateAvailabilityConfirmed, false);
  assert.equal(expiredView.state, 'confirmation_required');
  assert.match(expiredView.detail, /Disponible immédiatement/);
  assert.doesNotMatch(expiredView.detail, /redevenir visible/);

  console.log('Availability visibility smoke test: OK');
}

main();
