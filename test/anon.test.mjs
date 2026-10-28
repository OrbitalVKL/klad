// Tests sans réseau : journal anonyme (alias de banques, filtre de sécurité), avec des données fictives.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = rel => fs.readFileSync(new URL('../' + rel, import.meta.url), 'utf8');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(read('www/anon.js'), ctx);
const A = ctx.KladAnon;

test('alias de banque stables, sans le nom', () => {
  const map = {};
  assert.equal(A.bankAlias(map, 'Banque Exemple'), 'Banque A');
  assert.equal(A.bankAlias(map, 'Autre Établissement'), 'Banque B');
  assert.equal(A.bankAlias(map, 'Banque Exemple'), 'Banque A');
  assert.equal(A.accountLabel(map, 'Autre Établissement', 1), 'Banque B · compte 2');
});

test('filtre : e-mail, IBAN, identifiant, long numéro masqués', () => {
  const s = A.scrub('GET /accounts/12345678-abcd-4ef0-9abc-1234567890ab/balances · jean.dupont@exemple.fr · FR00 1234 5678 9012 3456 7890 123 · carte 0000 1111 2222 3333');
  assert.doesNotMatch(s, /12345678-abcd|dupont|exemple\.fr|FR00|1111 2222/);
  assert.match(s, /\/accounts\/…\/balances/);
  assert.match(s, /\[e-mail\]/);
  assert.match(s, /\[IBAN\]/);
  assert.match(s, /\[n°\]/);
});

test('filtre : messages utiles conservés', () => {
  for (const m of ['GET /aspsps → 403 (404 ms) "Application is not active"',
                   'Banque A · compte 1 : 225 opération(s) depuis le 30/07/2026 (0 en attente)',
                   'Application PRODUCTION active, 1 adresse(s) de retour, retour Klad déclaré']) {
    assert.equal(A.scrub(m), m);
  }
});

test('journal : chaque ligne filtrée, aucun nom de banque, de compte ou de titulaire', () => {
  const app = read('www/app.js');
  assert.match(app, /S\.log\.push\([^\n]*KladAnon\.scrub\(msg\)/);
  const calls = app.split('\n').filter(l => /\blog\('/.test(l) && !/function log/.test(l));
  assert.ok(calls.length > 5);
  for (const line of calls) {
    const l = line.replace(/bankLabel\([^)]*\)|KladAnon\.accountLabel\([^)]*\)/g, 'ALIAS');
    assert.doesNotMatch(l, /bank\.name|pend\.name|s\.bank\b|a\.name|\.iban|f\.s\.bank|f\.a\./, line.trim());
  }
  assert.match(read('www/index.html'), /<script src="anon\.js"><\/script>\s*<script src="eb\.js">/);
});
