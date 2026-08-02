import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const globals = readFileSync('app/globals.css', 'utf8');
const tailwind = readFileSync('tailwind.config.ts', 'utf8');

const fundamentalTokens: Record<string, string> = {
  '--seveno-brand-cyan': '0 216 248',
  '--seveno-brand-blue': '0 120 240',
  '--seveno-brand-blue-strong': '0 72 184',
  '--seveno-brand-warm': '247 104 0',
  '--seveno-surface-page': '2 8 23',
  '--seveno-text-primary': '248 250 252',
  '--seveno-border-focus': '103 232 249',
  '--seveno-state-success': '52 211 153',
  '--seveno-state-warning': '251 191 36',
  '--seveno-state-error': '251 113 133',
};

for (const [token, value] of Object.entries(fundamentalTokens)) {
  assert.match(globals, new RegExp(`${token}: ${value.replaceAll(' ', '\\s+')};`));
  assert.match(tailwind, new RegExp(`var\\(${token}\\)`));
}

const aliases: Record<string, string> = {
  '--seveno-border-active': '--seveno-brand-cyan',
  '--seveno-action-primary': '--seveno-brand-cyan',
  '--seveno-assessment-general': '--seveno-brand-cyan',
  '--seveno-assessment-job': '--seveno-brand-blue',
  '--seveno-skill': '--seveno-brand-blue',
  '--seveno-prerequisite': '--seveno-text-muted',
  '--seveno-reciprocal-agreement': '--seveno-brand-warm',
  '--seveno-identity-reveal': '--seveno-brand-warm',
};

for (const [token, target] of Object.entries(aliases)) {
  assert.match(globals, new RegExp(`${token}: var\\(${target}\\);`));
  assert.match(tailwind, new RegExp(`var\\(${token}\\)`));
}

assert.doesNotMatch(globals, /--seveno-brand-violet/);
assert.doesNotMatch(tailwind, /brand-violet/);
assert.doesNotMatch(globals, /--seveno-product-violet/);
assert.doesNotMatch(tailwind, /product-violet/);
assert.match(tailwind, /skill: 'rgb\(var\(--seveno-skill\) \/ <alpha-value>\)'/);
assert.match(tailwind, /prerequisite: 'rgb\(var\(--seveno-prerequisite\) \/ <alpha-value>\)'/);

console.log('Seven’O color system smoke test: OK');
