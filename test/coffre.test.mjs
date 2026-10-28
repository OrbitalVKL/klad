// Tests sans réseau : blocs chiffrés, phrase de récupération, sauvegarde exportée, migration du prototype.
// Données fictives uniquement.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const ctx = { atob, btoa, TextEncoder, TextDecoder, crypto: globalThis.crypto, Date, Math, JSON };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(new URL('../www/coffre.js', import.meta.url), 'utf8'), ctx);
const C = ctx.KladCoffre;

const ITER = 1000;   // rapide pour les tests ; l'appli utilise C.SAUV_ITER
const dekBytes = () => crypto.getRandomValues(new Uint8Array(32));
const json = o => JSON.parse(JSON.stringify(o));   // objets du contexte vm → objets ordinaires

const FICTIF = {
  appId: '00000000-1111-2222-3333-444444444444',
  pem: '-----BEGIN PRIVATE KEY-----\nTUlJRklDVElG\n-----END PRIVATE KEY-----',
  redirectUrl: 'https://compte.github.io/klad/retour.html',
  sessions: { s1: { bank: 'Banque Fictive', country: 'FR', valid_until: '2030-01-01', accounts: [{ uid: 'u1', name: 'Compte courant', iban: 'FR7600000000000000000000000' }] } },
  pending: {},
  data: { u1: { txs: [{ date: '2026-01-02', label: 'Boulangerie', amount: -3.2, currency: 'EUR' }] } },
  banks: {}, alias: { 'Banque Fictive': 'Banque A' },
  log: ['10:00:00 · Démarrage'], logV: 2
};

// ------------------------------------------------------------ blocs

test('bloc : aller-retour et format v1', async () => {
  const k = await C.importDek(dekBytes());
  const b = await C.seal(k, 'comptes', { a: 1, txt: 'é€' });
  assert.deepEqual([...b.subarray(0, 4)], [0x4b, 0x4c, 0x44, 1]);   // « KLD » + version
  assert.equal(b.length, 4 + 12 + JSON.stringify({ a: 1, txt: 'é€' }).length + 3 + 16); // é et € : 2 + 3 octets
  assert.deepEqual(json(await C.open(k, 'comptes', b)), { a: 1, txt: 'é€' });
});

test('bloc : clé non extractible, octets de la DEK effacés', async () => {
  const raw = dekBytes();
  const k = await C.importDek(raw);
  assert.equal(k.extractable, false);
  assert.ok(raw.every(x => x === 0));
  await assert.rejects(crypto.subtle.exportKey('raw', k));
});

test('bloc : IV différent à chaque chiffrement', async () => {
  const k = await C.importDek(dekBytes());
  const ivs = new Set();
  for (let i = 0; i < 50; i++) ivs.add(Buffer.from((await C.seal(k, 'cle', {})).subarray(4, 16)).toString('hex'));
  assert.equal(ivs.size, 50);
});

test('bloc : altération, mauvais nom, mauvaise clé, version inconnue refusés', async () => {
  const k = await C.importDek(dekBytes());
  const b = await C.seal(k, 'cle', { pem: 'x' });
  for (const i of [5, 20, b.length - 1]) {
    const bad = b.slice(); bad[i] ^= 1;
    await assert.rejects(C.open(k, 'cle', bad), e => e.code === 'integrite');
  }
  await assert.rejects(C.open(k, 'comptes', b), e => e.code === 'integrite');
  await assert.rejects(C.open(await C.importDek(dekBytes()), 'cle', b), e => e.code === 'integrite');
  const v2 = b.slice(); v2[3] = 2;
  await assert.rejects(C.open(k, 'cle', v2), e => e.code === 'version');
  await assert.rejects(C.open(k, 'cle', new Uint8Array(40)), e => e.code === 'format');
  await assert.rejects(C.seal(k, 'inconnu', {}), e => e.code === 'nom');
  await assert.rejects(C.importDek(new Uint8Array(16)), e => e.code === 'cle');
});

// ------------------------------------------------------------ phrase

test('phrase : 6 groupes de 4, alphabet sans I L O U, 120 bits', () => {
  const seen = new Set();
  for (let i = 0; i < 200; i++) {
    const p = C.newPhrase();
    assert.match(p, /^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){5}$/);
    seen.add(p);
  }
  assert.equal(seen.size, 200);
  assert.equal(24 * 5, 120);
});

test('phrase : saisie tolérante, erreurs claires', () => {
  assert.equal(C.normPhrase('abcd efgh jkmn pqrs tvwx yz01'), 'ABCD-EFGH-JKMN-PQRS-TVWX-YZ01');
  assert.equal(C.normPhrase('O0Il-0000-0000-0000-0000-0000'), '0011-0000-0000-0000-0000-0000');
  assert.throws(() => C.normPhrase('ABCD-EFGH'), e => e.code === 'phrase');
  assert.throws(() => C.normPhrase('UBCD-EFGH-JKMN-PQRS-TVWX-YZ01'), e => e.code === 'phrase');
});

test('phrase : vérification par ressaisie de 2 groupes', () => {
  const p = 'ABCD-EFGH-JKMN-PQRS-TVWX-YZ01';
  for (let i = 0; i < 100; i++) {
    const [a, b] = C.pickGroups();
    assert.ok(a >= 0 && b <= 5 && a < b);
  }
  assert.equal(C.checkGroups(p, { 1: 'efgh', 5: 'yz0l' }), true);
  assert.equal(C.checkGroups(p, { 1: 'EFGH', 5: 'YZ02' }), false);
  assert.equal(C.checkGroups(p, {}), false);
  assert.equal(C.checkGroups(p, { 7: 'ABCD' }), false);
});

// ------------------------------------------------------------ sauvegarde

test('sauvegarde : aller-retour export / import avec la phrase', async () => {
  const phrase = C.newPhrase();
  const bk = await C.newBackupKey(phrase, ITER);
  const parts = C.split(C.join({ cle: { appId: FICTIF.appId, pem: FICTIF.pem }, comptes: { sessions: FICTIF.sessions, data: FICTIF.data } }));
  const payload = { cle: parts.cle, comptes: parts.comptes };
  const text = await C.exportBackup(bk, payload, new Date('2026-03-04T10:00:00Z'));
  const o = JSON.parse(text);
  assert.equal(o.format, 'klad-sauvegarde');
  assert.equal(o.v, 1);
  assert.deepEqual(Object.keys(o), ['format', 'v', 'kdf', 'iv', 'date', 'ct']);
  assert.deepEqual(o.kdf, { nom: 'PBKDF2-SHA256', iter: ITER, sel: bk.sel });
  assert.equal(o.date, '2026-03-04');
  assert.doesNotMatch(text, /PRIVATE KEY|Banque Fictive|Boulangerie|FR76/);   // rien en clair

  // ressaisie en minuscules et sans tirets
  const r = await C.importBackup(text, phrase.toLowerCase().replace(/-/g, ' '));
  assert.deepEqual(json(r.payload), json(payload));
  assert.equal(r.bk.cle, bk.cle);
  assert.equal(r.bk.sel, bk.sel);
});

test('sauvegarde : mauvaise phrase, fichier altéré ou étranger refusés', async () => {
  const phrase = C.newPhrase();
  const bk = await C.newBackupKey(phrase, ITER);
  const text = await C.exportBackup(bk, { cle: { pem: 'x' } });
  await assert.rejects(C.importBackup(text, C.newPhrase()), e => e.code === 'phrase');
  const o = JSON.parse(text);
  await assert.rejects(C.importBackup(JSON.stringify(Object.assign({}, o, { date: '2000-01-01' })), phrase), e => e.code === 'phrase');
  await assert.rejects(C.importBackup(JSON.stringify(Object.assign({}, o, { kdf: Object.assign({}, o.kdf, { iter: ITER + 1 }) })), phrase), e => e.code === 'phrase');
  await assert.rejects(C.importBackup(JSON.stringify(Object.assign({}, o, { v: 2 })), phrase), e => e.code === 'version');
  await assert.rejects(C.importBackup('{"a":1}', phrase), e => e.code === 'format');
  await assert.rejects(C.importBackup('pas du JSON', phrase), e => e.code === 'format');
  assert.equal(C.SAUV_ITER, 600000);
});

// ------------------------------------------------------------ migration

function fakeStorage(init) {
  const m = new Map(Object.entries(init || {}));
  return { getItem: k => (m.has(k) ? m.get(k) : null), removeItem: k => m.delete(k), has: k => m.has(k) };
}
async function fakeStore(failOn) {
  const key = await C.importDek(dekBytes());
  const blobs = new Map();
  return {
    blobs,
    async get(n) { return blobs.has(n) ? C.open(key, n, blobs.get(n)) : null; },
    async put(n, o) { if (n === failOn) throw new Error('disque plein'); blobs.set(n, await C.seal(key, n, o)); }
  };
}

test('migration : données reprises chiffrées, puis localStorage effacé', async () => {
  const ls = fakeStorage({ [C.PROTO_KEY]: JSON.stringify(FICTIF) });
  const st = await fakeStore();
  const r = await C.migrate(ls, st);
  assert.deepEqual(json(r), { sessions: 1, cle: true });
  assert.equal(ls.has(C.PROTO_KEY), false);
  for (const b of st.blobs.values()) assert.doesNotMatch(Buffer.from(b).toString('latin1'), /PRIVATE|Fictive|Boulangerie/);
  const S = C.join({ cle: await st.get('cle'), comptes: await st.get('comptes'), journal: await st.get('journal') });
  assert.equal(S.pem, FICTIF.pem);
  assert.equal(S.appId, FICTIF.appId);
  assert.deepEqual(json(S.sessions), FICTIF.sessions);
  assert.deepEqual(json(S.data), FICTIF.data);
  assert.deepEqual(json(S.log), FICTIF.log);
});

test('migration : journal ancien (avant anonymisation) abandonné', async () => {
  const ls = fakeStorage({ [C.PROTO_KEY]: JSON.stringify(Object.assign({}, FICTIF, { logV: undefined })) });
  const st = await fakeStore();
  await C.migrate(ls, st);
  assert.deepEqual(json(await st.get('journal')), { log: [] });
});

test('migration : rien à reprendre', async () => {
  const st = await fakeStore();
  assert.equal(await C.migrate(fakeStorage(), st), null);
  assert.equal(st.blobs.size, 0);
});

test('migration : localStorage conservé si l\'écriture échoue', async () => {
  const ls = fakeStorage({ [C.PROTO_KEY]: JSON.stringify(FICTIF) });
  await assert.rejects(C.migrate(ls, await fakeStore('comptes')));
  assert.equal(ls.has(C.PROTO_KEY), true);
});

test('migration : déjà écrite (interrompue avant l\'effacement) → seulement effacer', async () => {
  const st = await fakeStore();
  await st.put('cle', { appId: 'déjà', pem: '', redirectUrl: '' });
  const ls = fakeStorage({ [C.PROTO_KEY]: JSON.stringify(FICTIF) });
  assert.deepEqual(json(await C.migrate(ls, st)), { deja: true });
  assert.equal(ls.has(C.PROTO_KEY), false);
  assert.equal((await st.get('cle')).appId, 'déjà');
});

test('migration : contenu illisible effacé sans rien écrire', async () => {
  const ls = fakeStorage({ [C.PROTO_KEY]: '{pas du json' });
  const st = await fakeStore();
  assert.deepEqual(json(await C.migrate(ls, st)), { illisible: true });
  assert.equal(ls.has(C.PROTO_KEY), false);
  assert.equal(st.blobs.size, 0);
});

test('état ↔ blocs : répartition sans perte', () => {
  const S = C.join({ cle: { appId: 'a', pem: 'p', redirectUrl: 'r' }, comptes: { sessions: { x: 1 } }, journal: { log: ['l'] } });
  const parts = json(C.split(S));
  assert.deepEqual(Object.keys(parts), ['cle', 'comptes', 'journal']);
  assert.deepEqual(parts.cle, { appId: 'a', pem: 'p', redirectUrl: 'r' });
  assert.deepEqual(parts.comptes, { sessions: { x: 1 }, pending: {}, data: {}, banks: {}, alias: {} });
  assert.deepEqual(json(C.join(parts)), json(S));
});
