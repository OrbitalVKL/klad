// Tests sans réseau : nom du dépôt déduit à la fabrication, adresse de retour (appli et site).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { repoName } from '../scripts/prepare-android.mjs';

const read = rel => fs.readFileSync(new URL('../' + rel, import.meta.url), 'utf8');

const ctx = { atob, btoa, TextEncoder, crypto: globalThis.crypto, Date, Math, JSON };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(read('www/eb.js'), ctx);
const EB = ctx.KladEB;

// Exécute le script de site/index.html avec une adresse de page fictive.
function site(href) {
  const html = read('site/index.html');
  const js = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
  const u = new URL(href);
  const els = { apk: {}, ret: {} };
  vm.runInNewContext(js, {
    location: { hostname: u.hostname, pathname: u.pathname, origin: u.origin },
    document: { getElementById: id => els[id] }
  });
  return { apk: els.apk.href, ret: els.ret.textContent };
}

test('nom du dépôt déduit de GITHUB_REPOSITORY', () => {
  assert.equal(repoName({ GITHUB_REPOSITORY: 'Compte-Test/klad' }), 'klad');
  assert.equal(repoName({ GITHUB_REPOSITORY: 'Compte-Test/Mon-Carnet' }), 'Mon-Carnet');
  assert.equal(repoName({ GITHUB_REPOSITORY: 'compte/autre', KLAD_REPO: 'essai' }), 'essai');
  assert.equal(repoName({}), 'klad');
  assert.equal(repoName({ GITHUB_REPOSITORY: '  ' }), 'klad');
});

test('adresse de retour de l\'appli', () => {
  assert.equal(EB.redirectUrlFor('Compte-Test', 'klad'), 'https://compte-test.github.io/klad/retour.html');
  assert.equal(EB.redirectUrlFor('compte', 'Mon-Carnet'), 'https://compte.github.io/Mon-Carnet/retour.html');
  assert.equal(EB.redirectUrlFor('compte', ''), 'https://compte.github.io/klad/retour.html');
  assert.equal(EB.redirectUrlFor('Compte', 'compte.github.io'), 'https://compte.github.io/retour.html');
});

test('site : lien Releases et adresse de retour lus dans l\'adresse de la page', () => {
  assert.deepEqual(site('https://compte.github.io/klad/'),
    { apk: 'https://github.com/compte/klad/releases/latest', ret: 'https://compte.github.io/klad/retour.html' });
  assert.deepEqual(site('https://compte.github.io/mon-carnet/index.html'),
    { apk: 'https://github.com/compte/mon-carnet/releases/latest', ret: 'https://compte.github.io/mon-carnet/retour.html' });
  assert.deepEqual(site('https://compte.github.io/'),
    { apk: 'https://github.com/compte/compte.github.io/releases/latest', ret: 'https://compte.github.io/retour.html' });
  assert.deepEqual(site('https://compte.github.io/index.html'),
    { apk: 'https://github.com/compte/compte.github.io/releases/latest', ret: 'https://compte.github.io/retour.html' });
});

test('appli et site s\'accordent sur l\'adresse de retour', () => {
  for (const repo of ['klad', 'Mon-Carnet']) {
    assert.equal(site('https://compte.github.io/' + repo + '/').ret, EB.redirectUrlFor('compte', repo));
  }
  assert.equal(site('https://compte.github.io/').ret, EB.redirectUrlFor('compte', 'compte.github.io'));
});

test('nom du dépôt non écrit en dur', () => {
  assert.doesNotMatch(read('www/app.js'), /\/klad\//);
  assert.doesNotMatch(read('site/index.html'), /\/klad\//);
});
