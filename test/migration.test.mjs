// Tests : chargement des blocs chiffrés, migration 0.2.x → 0.3.0 (vérification, repli sans perte), sauvegarde v2.
// Données fictives uniquement.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { charge, json } from './charge.mjs';

const ctx = charge(['anon.js', 'eb.js', 'modele.js', 'coffre.js']);
const { KladCoffre: C, KladModele: M } = ctx;
const NOW = Date.parse('2026-10-28T10:00:00Z');

// Faux coffre natif : blocs vraiment chiffrés (seal/open), panne simulée à l'écriture ou à la relecture.
async function coffre(opts = {}) {
  const key = await C.importDek(crypto.getRandomValues(new Uint8Array(32)));
  const blobs = new Map();
  return {
    blobs,
    async get(n) {
      if (!blobs.has(n)) return null;
      const o = await C.open(key, n, blobs.get(n));
      if (opts.relu === n) o.altere = true;
      return o;
    },
    async put(n, o) { if (opts.panne === n) throw new Error('disque plein'); blobs.set(n, await C.seal(key, n, o)); },
    async del(n) { blobs.delete(n); }
  };
}

const ANCIEN = {
  sessions: { s1: { bank: 'Banque Fictive', country: 'FR', valid_until: '2027-01-01T00:00:00Z', created: '2026-10-01T08:00:00Z',
    accounts: [{ uid: 'u1', name: 'Compte', product: 'Compte courant', type: 'CACC', currency: 'EUR', iban: 'FR7600000000000000000000001' }] } },
  pending: {}, banks: {}, alias: { 'Banque Fictive': 'Banque A' },
  data: { u1: { fetched: Date.parse('2026-10-20T09:00:00Z'), balances: [{ balance_type: 'CLBD', balance_amount: { amount: '10.00' } }],
    txs: [{ id: 'R1', date: '2025-12-30', label: 'CB A', amount: -1.5, pending: false }, { id: null, date: '2026-01-02', label: 'CB B', amount: -2.25, pending: false }] } }
};

test('noms de blocs : liste fixe et ops-<compte>-<année>', async () => {
  for (const n of ['cle', 'modele', 'soldes', 'carnet', 'journal', 'sauvegarde', 'comptes', 'ops-abcd1234-2023']) assert.equal(C.nomValide(n), true, n);
  for (const n of ['ops-abcd123-2023', 'ops-ABCD1234-2023', 'ops-abcd1234-23', '../cle', 'autre']) assert.equal(C.nomValide(n), false, n);
  const k = await C.importDek(crypto.getRandomValues(new Uint8Array(32)));
  const b = await C.seal(k, 'ops-abcd1234-2024', { ops: [] });
  await assert.rejects(C.open(k, 'ops-abcd1234-2025', b), e => e.code === 'integrite');   // un bloc ne peut pas être pris pour un autre
});

test('coffre neuf : rien à migrer', async () => {
  const st = await coffre();
  const r = await C.charger(st, NOW);
  assert.equal(r.migration, null);
  assert.equal(r.S.modele.v, 3);
  assert.equal(st.blobs.size, 0);
});

test('migration 0.2 : blocs écrits, relus, puis ancien format supprimé ; rechargement identique', async () => {
  const st = await coffre();
  await st.put('cle', { appId: 'app-fictive', pem: 'PEM', redirectUrl: '' });
  await st.put('comptes', ANCIEN);
  await st.put('journal', { log: ['10:00:00 · Démarrage'] });
  const r = await C.charger(st, NOW);
  assert.deepEqual(json(r.migration), { sessions: 1, comptes: 1, operations: 2, soldes: 1 });
  assert.equal(st.blobs.has('comptes'), false);
  const c = r.S.modele.comptes[0];
  assert.deepEqual([...st.blobs.keys()].sort(), ['cle', 'journal', 'modele', 'ops-' + c.id + '-2025', 'ops-' + c.id + '-2026', 'soldes']);
  assert.equal(r.S.cle.appId, 'app-fictive');
  assert.deepEqual(json(r.S.ops[c.id]).map(o => o.montant), [-225, -150]);
  for (const b of st.blobs.values()) assert.doesNotMatch(Buffer.from(b).toString('latin1'), /Fictive|FR76|CB A/);
  const r2 = await C.charger(st, NOW);
  assert.equal(r2.migration, null);
  assert.deepEqual(json(r2.S.ops), json(r.S.ops));
  assert.deepEqual(json(r2.S.modele), json(r.S.modele));
  assert.deepEqual(Object.keys(r2.ecrits).sort(), [...st.blobs.keys()].sort());
});

for (const [nom, opts] of [['écriture', { panne: 'modele' }], ['écriture d\'un bloc d\'opérations', null], ['relecture', { relu: 'soldes' }]]) {
  test('migration 0.2 : échec à la ' + nom + ' → rien n\'est effacé, nouveaux blocs retirés', async () => {
    let st = await coffre(opts || {});
    if (!opts) {   // panne sur le premier bloc d'opérations, dont le nom n'est connu qu'à la conversion
      const put = st.put;
      st.put = async (n, o) => { if (n.startsWith('ops-')) throw new Error('disque plein'); return put(n, o); };
    }
    await st.put('cle', { appId: 'app-fictive', pem: 'PEM', redirectUrl: '' });
    await st.put('comptes', ANCIEN);
    await assert.rejects(C.charger(st, NOW), e => e.code === 'migration' && /Rien n'a été effacé/.test(e.message));
    assert.deepEqual([...st.blobs.keys()].sort(), ['cle', 'comptes']);
    assert.deepEqual(json(await st.get('comptes')), ANCIEN);
  });
}

test('migration 0.2 interrompue après l\'écriture de « modele » : ancien format supprimé au chargement suivant', async () => {
  const st = await coffre();
  await st.put('comptes', ANCIEN);
  const { S } = await C.charger(await coffre(), NOW);   // conversion ailleurs, pour obtenir un modèle
  await st.put('modele', S.modele);
  await st.put('comptes', ANCIEN);
  const r = await C.charger(st, NOW);
  assert.equal(r.migration, null);
  assert.equal(st.blobs.has('comptes'), false);
});

test('sauvegarde v2 : aller-retour sans le journal ; sauvegarde 0.2 (v1) convertie', async () => {
  const st = await coffre();
  await st.put('cle', { appId: 'app-fictive', pem: 'PEM', redirectUrl: 'https://compte.github.io/klad/retour.html' });
  await st.put('comptes', ANCIEN);
  const { S } = await C.charger(st, NOW);
  S.carnet = { reglage: 'opaque' };
  const bk = await C.newBackupKey('ABCD-EFGH-JKMN-PQRS-TVWX-YZ01', 1000);
  const txt = await C.exportBackup(bk, C.contenuSauvegarde(S));
  const { payload } = await C.importBackup(txt, 'ABCD-EFGH-JKMN-PQRS-TVWX-YZ01');
  assert.equal(payload.v, 2);
  assert.equal(payload.blocs.journal, undefined);
  const S2 = await C.depuisSauvegarde(payload, NOW);
  assert.deepEqual(json(S2.ops), json(S.ops));
  assert.deepEqual(json(S2.carnet), { reglage: 'opaque' });
  assert.equal(S2.cle.appId, 'app-fictive');
  const S1 = await C.depuisSauvegarde({ app: 'klad', cle: { appId: 'v1', pem: 'P' }, comptes: ANCIEN }, NOW);
  assert.equal(S1.cle.appId, 'v1');
  assert.equal(Object.values(json(S1.ops)).flat().length, 2);
  await assert.rejects(C.depuisSauvegarde({ app: 'klad', v: 2, blocs: { modele: S.modele, '../x': {} } }), /bloc inattendu/);
  await assert.rejects(C.depuisSauvegarde({ app: 'autre' }), /inattendu/);
});
