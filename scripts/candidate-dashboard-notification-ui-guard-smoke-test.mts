import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const currentDir = dirname(fileURLToPath(import.meta.url));
const candidatePagePath = resolve(currentDir, '..', 'app', 'candidat', 'page.tsx');
const source = readFileSync(candidatePagePath, 'utf8');

const forbiddenPatterns: Array<{ pattern: string; reason: string }> = [
  {
    pattern: 'Tester une notification',
    reason: 'aucun bouton de test de notification ne doit être visible dans le tableau de bord candidat normal',
  },
  {
    pattern: 'handleSendAvailabilityTestNotification',
    reason: 'la page candidate ne doit plus déclencher elle-même une notification de test',
  },
  {
    pattern: 'send_test_notification',
    reason: "l'action de test de notification ne doit plus exister dans l'état de la page candidate",
  },
  {
    pattern: 'Service worker',
    reason: 'le panneau candidat ne doit pas exposer de jargon technique (service worker)',
  },
  {
    pattern: 'Token FCM',
    reason: 'le panneau candidat ne doit pas exposer de jargon technique (token FCM)',
  },
];

function main() {
  for (const { pattern, reason } of forbiddenPatterns) {
    assert.equal(
      source.includes(pattern),
      false,
      `app/candidat/page.tsx ne doit pas contenir "${pattern}" : ${reason}`,
    );
  }

  // Les seules actions candidates attendues doivent rester présentes.
  const requiredPatterns = [
    'Confirmer ma disponibilité 24 h',
    'Me déclarer disponible immédiatement',
    'Je ne suis plus disponible',
    'Toujours disponible',
    'Plus disponible',
  ];

  for (const pattern of requiredPatterns) {
    assert.equal(
      source.includes(pattern),
      true,
      `app/candidat/page.tsx doit toujours contenir "${pattern}"`,
    );
  }

  console.log('Candidate dashboard notification UI guard smoke test: OK');
}

main();
