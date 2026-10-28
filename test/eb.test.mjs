// Tests sans réseau : clé PEM (PKCS#8 et PKCS#1), JWT RS256 vérifié par node:crypto, mise en forme des opérations.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';
import { appIdFor } from '../scripts/prepare-android.mjs';

const ctx = { atob, btoa, TextEncoder, crypto: globalThis.crypto, fetch: () => { throw new Error('pas de réseau'); }, Date, Math, JSON };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(new URL('../www/eb.js', import.meta.url), 'utf8'), ctx);
const EB = ctx.KladEB;

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const pk8 = privateKey.export({ type: 'pkcs8', format: 'pem' });
const pk1 = privateKey.export({ type: 'pkcs1', format: 'pem' });

function verify(jwt) {
  const [h, b, s] = jwt.split('.');
  const ok = crypto.verify('RSA-SHA256', Buffer.from(h + '.' + b), publicKey, Buffer.from(s, 'base64url'));
  return { ok, head: JSON.parse(Buffer.from(h, 'base64url')), body: JSON.parse(Buffer.from(b, 'base64url')) };
}

for (const [name, pem] of [['PKCS#8', pk8], ['PKCS#1', pk1], ['PKCS#8 sans retours à la ligne', pk8.replace(/\n/g, ' ')]]) {
  test('JWT RS256 valide avec clé ' + name, async () => {
    const key = await EB.importKey(pem);
    const jwt = await EB.makeJwt(key, 'app-123', 3600);
    const v = verify(jwt);
    assert.equal(v.ok, true);
    assert.deepEqual({ ...v.head }, { typ: 'JWT', alg: 'RS256', kid: 'app-123' });
    assert.equal(v.body.iss, 'enablebanking.com');
    assert.equal(v.body.aud, 'api.enablebanking.com');
    assert.equal(v.body.exp - v.body.iat, 3600);
  });
}

test('messages d\'erreur clairs', async () => {
  const pub = publicKey.export({ type: 'spki', format: 'pem' });
  await assert.rejects(() => EB.importKey(pub), /clé publique/);
  await assert.rejects(() => EB.importKey(''), /vide/);
  await assert.rejects(() => EB.importKey('-----BEGIN PRIVATE KEY-----\nAAAA\n-----END PRIVATE KEY-----'), /Clé refusée/);
});

test('mise en forme des opérations', () => {
  const d = EB.normalize({ transaction_amount: { amount: '12.5', currency: 'EUR' }, credit_debit_indicator: 'DBIT',
    booking_date: '2026-10-01', remittance_information: ['CB  BOULANGERIE'], creditor: { name: 'Boulangerie' }, status: 'BOOK', entry_reference: 'R1' });
  assert.equal(d.amount, -12.5); assert.equal(d.label, 'CB BOULANGERIE'); assert.equal(d.pending, false); assert.equal(d.id, 'R1');
  const c = EB.normalize({ transaction_amount: { amount: '100' }, credit_debit_indicator: 'CRDT', value_date: '2026-10-02', debtor: { name: 'Employeur' }, remittance_information: ['SALAIRE'], status: 'PDNG' });
  assert.equal(c.amount, 100); assert.equal(c.label, 'Employeur · SALAIRE'); assert.equal(c.pending, true);
});

test('identifiant d\'appli dérivé du compte GitHub', () => {
  assert.equal(appIdFor('Jean-Dupont'), 'io.github.jean_dupont.klad');
  assert.equal(appIdFor('42abc'), 'io.github.u42abc.klad');
});
