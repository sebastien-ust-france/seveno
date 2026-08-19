import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const files = await Promise.all([
  readFile(new URL('../lib/seveno-member-invitations-server.ts', import.meta.url), 'utf8'),
  readFile(new URL('../components/invitation/MemberInvitationAccess.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../app/api/seveno/company-member-invitations/accept/route.ts', import.meta.url), 'utf8'),
  readFile(new URL('../lib/seveno-member-invitation-email.ts', import.meta.url), 'utf8'),
]);
const [server, client, acceptRoute, email] = files;
const combined = files.join('\n');
assert.match(server, /runTransaction/, 'L’acceptation doit rester transactionnelle.');
assert.match(server, /emailVerified/, 'L’e-mail vérifié doit être exigé côté serveur.');
assert.match(server, /invitation\.emailNormalized !== email/, 'L’adresse Firebase doit correspondre à l’invitation.');
assert.match(server, /permissions: invitation\.permissions/, 'Les permissions doivent venir de l’invitation.');
assert.doesNotMatch(acceptRoute, /request\.json/, 'L’acceptation ne doit recevoir ni token ni adresse dans son body.');
assert.match(client, /readOnly value=\{invitation\.email\}/, 'L’adresse invitée doit être en lecture seule.');
assert.match(client, /password\.length < 12/);
assert.doesNotMatch(combined, /localStorage.*invitation|console\.(?:log|info|warn|error)\([^\n]*(?:token|password)/i);
assert.doesNotMatch(email, /sendMail\(\{[^}]*password/s, 'L’e-mail d’invitation ne doit contenir aucun mot de passe.');
const auth = await readFile(new URL('../lib/auth.ts', import.meta.url), 'utf8');
const connexion = await readFile(new URL('../app/connexion/page.tsx', import.meta.url), 'utf8');
assert.doesNotMatch(`${auth}\n${connexion}`, /deleteUser\s*\(/);
assert.doesNotMatch(`${auth}\n${connexion}`, /fetchSignInMethodsForEmail/);
console.log('Member invitation security smoke tests: OK');
