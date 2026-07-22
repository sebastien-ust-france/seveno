import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function readSource(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function assertContains(relativePath: string, fragments: readonly string[]) {
  const source = readSource(relativePath);
  for (const fragment of fragments) {
    assert.match(source, new RegExp(escapeRegExp(fragment)));
  }
}

function assertDoesNotContain(relativePath: string, fragments: readonly string[]) {
  const source = readSource(relativePath);
  for (const fragment of fragments) {
    assert.doesNotMatch(source, new RegExp(escapeRegExp(fragment)));
  }
}

async function main() {
  assertContains('app/connexion/page.tsx', [
    "stage = 'user_document';",
    'La connexion Google a réussi, mais la synchronisation du compte Seven’O a échoué.',
    'ensureSevenoUser(authUser)',
  ]);

  assertContains('lib/seveno-users.ts', [
    'fetchSevenoMatchApi(authUser, \'/api/seveno/users/sync\'',
    'Synchronisation du document utilisateur',
  ]);
  assertDoesNotContain('lib/seveno-users.ts', [
    'setDoc(',
    'createSevenoUserFromGoogle(',
    'createSevenoUser(authUser, null)',
  ]);

  assertContains('app/api/seveno/users/sync/route.ts', [
    'requireSevenoApiToken',
    'SevenoUserSyncError',
    'synced: true',
    'merge: true',
    'company_invite_only',
  ]);
  assertDoesNotContain('app/api/seveno/users/sync/route.ts', [
    'firebase/firestore',
    'setDoc(',
    'updateDoc(',
  ]);

  console.log('SevenO user sync smoke test: OK');
}

void main();
