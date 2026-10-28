// Tests sans réseau : mise à jour depuis l'appli (versions, lecture de la publication GitHub). Données fictives.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = rel => fs.readFileSync(new URL('../' + rel, import.meta.url), 'utf8');
const ctx = {};
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(read('www/maj.js'), ctx);
const M = ctx.KladMaj;
const json = o => JSON.parse(JSON.stringify(o));

const H = 'ab'.repeat(32);
const rel = (tag, assets, extra) => Object.assign({ tag_name: tag, draft: false, prerelease: false, body: 'Notes', assets }, extra);
const apk = (name, digest) => ({ name, size: 8053375, digest, browser_download_url: 'https://github.com/compte/klad/releases/download/v0.3.0/' + name });

test('versions : lecture et comparaison', () => {
  assert.deepEqual(json(M.parseVersion('v0.2.1')), [0, 2, 1]);
  assert.deepEqual(json(M.parseVersion('1.10.0')), [1, 10, 0]);
  assert.equal(M.parseVersion('dev'), null);
  assert.equal(M.parseVersion('v1.2'), null);
  assert.ok(M.cmpVersion('v0.10.0', '0.9.1') > 0);
  assert.ok(M.cmpVersion('0.2.0', '0.2.1') < 0);
  assert.equal(M.cmpVersion('v0.2.1', '0.2.1'), 0);
  assert.equal(M.cmpVersion('v0.2.1', 'dev'), null);
});

test('adresse de l\'API déduite du compte et du dépôt', () => {
  assert.equal(M.apiUrl('Compte-Test', 'klad'), 'https://api.github.com/repos/Compte-Test/klad/releases/latest');
  assert.equal(M.apiUrl('compte', ''), 'https://api.github.com/repos/compte/klad/releases/latest');
});

test('publication plus récente : APK et empreinte retenus', () => {
  const r = M.pickRelease(rel('v0.3.0', [apk('notes.txt'), apk('klad-0.3.0-12.apk', 'sha256:' + H.toUpperCase())]), '0.2.1');
  assert.deepEqual(json(r), {
    version: '0.3.0', url: 'https://github.com/compte/klad/releases/download/v0.3.0/klad-0.3.0-12.apk',
    sha256: 'sha256:' + H, size: 8053375, notes: 'Notes'
  });
});

test('publication ignorée : même version, plus ancienne, brouillon, pré-version, étiquette illisible', () => {
  const a = [apk('klad.apk', 'sha256:' + H)];
  assert.equal(M.pickRelease(rel('v0.2.1', a), '0.2.1'), null);
  assert.equal(M.pickRelease(rel('v0.2.0', a), '0.2.1'), null);
  assert.equal(M.pickRelease(rel('v0.3.0', a, { draft: true }), '0.2.1'), null);
  assert.equal(M.pickRelease(rel('v0.3.0', a, { prerelease: true }), '0.2.1'), null);
  assert.equal(M.pickRelease(rel('nightly', a), '0.2.1'), null);
  assert.equal(M.pickRelease(null, '0.2.1'), null);
});

test('publication plus récente mais inutilisable : erreur claire', () => {
  assert.throws(() => M.pickRelease(rel('v0.3.0', [apk('klad-debug-3.apk', 'sha256:' + H)]), '0.2.1'), /pas d'APK/);
  assert.throws(() => M.pickRelease(rel('v0.3.0', []), '0.2.1'), /pas d'APK/);
  assert.throws(() => M.pickRelease(rel('v0.3.0', [apk('klad.apk')]), '0.2.1'), /empreinte SHA-256/);
  assert.throws(() => M.pickRelease(rel('v0.3.0', [apk('klad.apk', 'sha256:1234')]), '0.2.1'), /empreinte SHA-256/);
});

test('dépôt non écrit en dur dans la mise à jour', () => {
  assert.doesNotMatch(read('www/maj.js'), /repos\/[A-Za-z]/);
});
