import { FieldValue } from 'firebase-admin/firestore';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  buildSevenoTermsAcceptanceMigrationPlan,
  getLegacySevenoTermsAcceptanceFieldPath,
  readSevenoTermsAcceptanceMigrationState,
} from '@/lib/seveno-terms-acceptance';

function loadDotEnvFile(filePath: string) {
  if (!existsSync(filePath)) {
    return;
  }

  const content = readFileSync(filePath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const equalsIndex = trimmed.indexOf('=');
    if (equalsIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, equalsIndex).trim();
    let value = trimmed.slice(equalsIndex + 1).trim();

    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }

    if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

async function main() {
  loadDotEnvFile(resolve(process.cwd(), '.env.local'));

  const applyChanges = process.argv.includes('--apply');
  const { adminDb } = await import('@/lib/firebase-admin');
  if (!adminDb) {
    throw new Error('Firebase Admin Firestore is not configured.');
  }

  const snapshot = await adminDb.collection('users').get();
  const affected = snapshot.docs
    .map((doc) => {
      const data = doc.data() as Record<string, unknown>;
      const state = readSevenoTermsAcceptanceMigrationState(data);
      const plan = buildSevenoTermsAcceptanceMigrationPlan(data);
      return {
        ref: doc.ref,
        contexts: plan.contexts,
        nestedWrite: plan.nestedWrite,
        state,
      };
    })
    .filter((entry) => entry.contexts.length > 0);

  const detectedContexts = Array.from(
    new Set(affected.flatMap((entry) => entry.contexts)),
  );

  if (!applyChanges) {
    console.log('SevenO terms acceptance migration dry-run:', {
      documents: affected.length,
      contexts: detectedContexts,
    });
    return;
  }

  for (const entry of affected) {
    if (Object.keys(entry.nestedWrite).length > 0) {
      await entry.ref.set({
        termsAcceptance: entry.nestedWrite,
      }, { merge: true });
    }

    for (const state of entry.state) {
      if (!state.legacyAcceptance) {
        continue;
      }

      await entry.ref.update(
        getLegacySevenoTermsAcceptanceFieldPath(state.context),
        FieldValue.delete(),
      );
    }
  }

  console.log('SevenO terms acceptance migration applied:', {
    documents: affected.length,
    contexts: detectedContexts,
  });
}

await main();
