import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const [connexion, onboarding, syncRoute, users, rules] = await Promise.all([
  read('app/connexion/page.tsx'),
  read('app/onboarding/page.tsx'),
  read('app/api/seveno/users/sync/route.ts'),
  read('lib/seveno-users.ts'),
  read('firestore.rules'),
]);

assert.match(onboarding, /Comment souhaitez-vous utiliser Seven’O \?/);
assert.match(onboarding, /Je suis candidat/);
assert.match(onboarding, /Je représente une entreprise/);
assert.match(onboarding, /updateSevenoUserRole\(authUser, 'candidate'\)/);
assert.match(onboarding, /updateSevenoUserRole\(authUser, 'company'\)/);

assert.match(connexion, /signupAccountType/);
assert.match(connexion, /Je suis candidat/);
assert.match(connexion, /Je représente une entreprise/);
assert.match(connexion, /ensureSevenoUser\(createdAuthUser, hasActiveCompanyInvitation\(\) \? null : signupAccountType\)/);
assert.doesNotMatch(connexion, /ensureSevenoUser\(createdAuthUser,\s*'candidate'\)/);
assert.match(connexion, /ensureSevenoUser\(authUser\)/);

assert.match(syncRoute, /role: existingRole \?\? initialRole/);
assert.match(syncRoute, /initialRole !== existingRole/);
assert.match(syncRoute, /role_already_assigned/);
assert.doesNotMatch(syncRoute, /company_invite_only/);

assert.match(users, /return ensureSevenoUser\(authUser, role\)/);
assert.match(users, /user\.role === 'candidate'/);
assert.match(users, /user\.role === 'company'/);

assert.match(rules, /request\.resource\.data\.role == resource\.data\.role/);
assert.doesNotMatch(rules, /resource\.data\.role == null && request\.resource\.data\.role in \['candidate', 'company'\]/);

console.log('Public account type smoke tests: OK');
