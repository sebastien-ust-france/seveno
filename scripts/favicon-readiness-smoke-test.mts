import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const faviconPath = resolve(root, 'app/favicon.ico');
const iconPath = resolve(root, 'app/icon.png');
const appleIconPath = resolve(root, 'app/apple-icon.png');

function readPngSize(path: string) {
  const image = readFileSync(path);
  assert.deepEqual([...image.subarray(1, 4)], [0x50, 0x4e, 0x47], `${path} doit être un PNG.`);
  return {
    width: image.readUInt32BE(16),
    height: image.readUInt32BE(20),
  };
}

for (const path of [faviconPath, iconPath, appleIconPath]) {
  assert.ok(statSync(path).size > 0, `${path} doit être présent et non vide.`);
}

assert.deepEqual(readPngSize(iconPath), { width: 512, height: 512 });
assert.deepEqual(readPngSize(appleIconPath), { width: 180, height: 180 });

const favicon = readFileSync(faviconPath);
assert.equal(favicon.readUInt16LE(2), 1, 'Le favicon doit utiliser le format ICO.');
assert.equal(favicon.readUInt16LE(4), 3, 'Le favicon doit contenir trois résolutions.');
const faviconSizes = Array.from({ length: 3 }, (_, index) => favicon.readUInt8(6 + index * 16));
assert.deepEqual(faviconSizes, [16, 32, 48]);

const layoutSource = readFileSync(resolve(root, 'app/layout.tsx'), 'utf8');
const manifestSource = readFileSync(resolve(root, 'app/manifest.ts'), 'utf8');
assert.ok(layoutSource.includes("manifest: '/manifest.webmanifest'"));
assert.ok(!layoutSource.includes('favicon-seveno.png'), 'Le layout ne doit plus déclarer l’ancien favicon.');
assert.ok(!layoutSource.includes('localhost'), 'Les métadonnées globales ne doivent pas contenir localhost.');
assert.ok(manifestSource.includes("src: '/icon.png'"));
assert.ok(manifestSource.includes("sizes: '512x512'"));
assert.ok(!manifestSource.includes('maskable'), 'L’icône ne doit pas être déclarée maskable sans validation dédiée.');
assert.ok(!manifestSource.includes('localhost'));

console.log('Seven’O favicon readiness smoke test: OK');
