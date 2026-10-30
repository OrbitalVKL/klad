// Tests sans réseau : étiquette de publication déduite de package.json, garde-fous du workflow Android.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { tagFor } from '../scripts/version.mjs';

const read = rel => fs.readFileSync(new URL('../' + rel, import.meta.url), 'utf8');

test('étiquette v<version>', () => {
  assert.equal(tagFor('0.2.0'), 'v0.2.0');
  assert.equal(tagFor('1.10.3'), 'v1.10.3');
  for (const bad of ['0.2', 'v0.2.0', '0.2.0-beta', '', undefined]) assert.throws(() => tagFor(bad), /Version invalide/);
});

test('version de package.json publiable', () => {
  assert.match(tagFor(JSON.parse(read('package.json')).version), /^v\d+\.\d+\.\d+$/);
});

test('workflow Android : publication par changement de version', () => {
  const yml = read('.github/workflows/android.yml');
  assert.match(yml, /node scripts\/version\.mjs/);
  assert.match(yml, /gh release create "\$TAG"/);
  assert.doesNotMatch(yml, /--prerelease/, 'une pré-version casserait le lien releases/latest du site');
  assert.doesNotMatch(yml, /^\s+tags:/m, 'plus de déclenchement par étiquette');
  assert.doesNotMatch(yml, /^\s+release:/m, 'plus de déclenchement par publication manuelle');
});

test('workflow Android : chaque test Chromium (sauté sans Playwright) est lancé dans le parcours Chromium', () => {
  const yml = read('.github/workflows/android.yml');
  const ligne = (yml.match(/^\s+node --test (test\/\S+\.test\.mjs ?)+$/m) || [''])[0];
  for (const f of fs.readdirSync(new URL('../test/', import.meta.url)).filter(f => f.endsWith('.test.mjs'))) {
    if (/skip: SAUT/.test(read('test/' + f))) assert.ok(ligne.includes('test/' + f), f + ' absent du parcours Chromium');
  }
});
