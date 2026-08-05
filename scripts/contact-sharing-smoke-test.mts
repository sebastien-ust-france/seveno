import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  isJobApplicationContactSharingAvailable,
  serializeJobApplicationContactSharing,
} from '@/lib/seveno-job-applications-server';

assert.deepEqual(serializeJobApplicationContactSharing(null), {
  shared: false,
  sharedAt: null,
  sharedByUid: null,
});
assert.deepEqual(serializeJobApplicationContactSharing({
  shared: true,
  sharedAt: null,
  sharedByUid: 'candidate-uid',
  email: 'must-not-be-serialized@example.test',
}), {
  shared: true,
  sharedAt: null,
  sharedByUid: 'candidate-uid',
});
assert.equal(isJobApplicationContactSharingAvailable({ status: 'contact_requested', conversationStatus: 'closed' }), false);
assert.equal(isJobApplicationContactSharingAvailable({ status: 'conversation_open', conversationStatus: 'open' }), true);
assert.equal(isJobApplicationContactSharingAvailable({ status: 'conversation_open', conversationStatus: null }), false);
assert.equal(isJobApplicationContactSharingAvailable({ status: 'contact_requested', conversationStatus: 'open' }), false);

const candidateScreen = readFileSync('components/candidate/CandidateApplicationDetail.tsx', 'utf8');
const companyScreen = readFileSync('app/entreprise/demandes/[applicationId]/page.tsx', 'utf8');
const component = readFileSync('components/application/JobApplicationContactSharing.tsx', 'utf8');
const route = readFileSync('app/api/seveno/applications/[applicationId]/contact-sharing/route.ts', 'utf8');
const server = readFileSync('lib/seveno-job-applications-server.ts', 'utf8');

for (const screen of [candidateScreen, companyScreen]) {
  assert.match(screen, /status === 'conversation_open' && application\.conversationStatus === 'open'/);
  assert.match(screen, /<JobApplicationContactSharing[\s\S]*<JobApplicationConversationThread/);
}
assert.match(component, /onClick=\{\(\) => setConfirming\(true\)\}/);
assert.match(component, /disabled=\{submitting\}/);
assert.match(component, /setConfirming\(false\)/);
assert.match(component, /\.filter\(\(\[, value\]\) => Boolean\(value\)\)/);
assert.match(route, /body\.action !== 'share'/);
assert.doesNotMatch(route, /body\.(role|uid|actorType|target)/);
assert.doesNotMatch(server, /console\.(log|error)\([^\n]*(candidateEmail|candidatePhone|companyData|candidatePrivate)/);

console.log('Contact sharing smoke tests: OK');
