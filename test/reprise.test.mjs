// Tests : import de la reprise (format klad-reprise v1) — validation, aperçu, association, frontière, import rejouable.
// Données fictives uniquement.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { charge, json } from './charge.mjs';

const { KladModele: M, KladReprise: R } = charge(['anon.js', 'eb.js', 'modele.js', 'reprise.js']);
const NOW = Date.parse('2026-11-01T10:00:00Z');

function fichier(extra) {
  return Object.assign({
    format: 'klad-reprise', v: 1, created: '2026-11-01T10:00:00Z', source: 'carnet',
    accounts: [
      { ref: 'r0', label: 'COURANT', role: 'courant', iban_last4: '0001' },
      { ref: 'r1', label: 'JOINT', role: 'commun' },
      { ref: 'r3', label: 'CARTE', role: 'carte_differee', settle: { account: 'r0', day: 5 } },
      { ref: 'r5', label: 'LIVRET', role: 'epargne', manual: true, balance: { amount: 500000, date: '2026-10-20' } }
    ],
    transactions: [
      { account: 'r0', date: '2023-01-03', amount: -1250, label: 'CB BOULANGERIE', status: 'comptabilisee' },
      { account: 'r0', date: '2023-01-03', amount: -1250, label: 'CB BOULANGERIE', status: 'comptabilisee' },
      { account: 'r0', date: '2026-10-25', amount: 250000, label: 'SALAIRE FICTIF', status: 'comptabilisee' },
      { account: 'r3', date: '2026-10-02', amount: -4500, label: 'CB RESTAURANT', status: 'comptabilisee' },
      { account: 'r1', date: '2025-06-01', amount: -9900, label: 'ASSURANCE', id: 'ancien-42', value_date: '2025-06-02', counterparty: 'Assureur fictif' }
    ],
    carnet: { budget: { reglage: 'opaque' } }
  }, extra || {});
}

function etat() {
  const S = M.vide();
  const c = M.nouveauCompte(S, { libelle: 'Compte courant', aVerifier: true,
    source: { type: 'eb', connexion: 's1', uid: 'u1', empreinte: 'e1', fin4: '0001' } });
  S.modele.connexions.s1 = { banque: 'Banque Fictive', pays: 'FR', valid_until: '2027-01-01T00:00:00Z' };
  return { S, c };
}

test('validation : fichier conforme lu et mis en forme', () => {
  const rep = R.lire(JSON.stringify(fichier()));
  assert.equal(rep.nb, 5);
  assert.equal(rep.comptes.length, 4);
  assert.deepEqual(json(rep.ops.r1[0]), { date: '2025-06-01', montant: -9900, libelle: 'ASSURANCE', statut: 'comptabilisee',
    idExterne: 'ancien-42', dateValeur: '2025-06-02', contrepartie: 'Assureur fictif' });
  assert.deepEqual(json(rep.carnet), { budget: { reglage: 'opaque' } });
  assert.deepEqual(json(R.apercu(rep)).map(a => [a.ref, a.n, a.debut, a.fin]),
    [['r0', 3, '2023-01-03', '2026-10-25'], ['r1', 1, '2025-06-01', '2025-06-01'], ['r3', 1, '2026-10-02', '2026-10-02'], ['r5', 0, '', '']]);
});

test('validation : fichiers refusés proprement, messages sans donnée', () => {
  const f = () => fichier();
  const casse = (mod, re) => {
    const o = f(); mod(o);
    assert.throws(() => R.valider(json(o)), e => e.code === 'reprise' && re.test(e.message), re.toString());
  };
  assert.throws(() => R.lire('{pas du json'), /JSON illisible/);
  casse(o => { o.format = 'autre'; }, /pas un fichier de reprise/);
  casse(o => { o.v = 2; }, /version 2 non prise en charge/);
  casse(o => { o.accounts = []; }, /sans compte/);
  casse(o => { o.accounts[1].ref = 'r0'; }, /Compte n° 2 : référence en double/);
  casse(o => { o.accounts[0].role = 'inconnu'; }, /Compte n° 1 : rôle inconnu/);
  casse(o => { o.accounts[2].settle.account = 'r9'; }, /Compte n° 3 : compte de prélèvement inconnu/);
  casse(o => { o.accounts[2].settle.day = 40; }, /jour de prélèvement invalide/);
  casse(o => { o.accounts[3].balance.amount = 12.5; }, /Compte n° 4 : solde invalide/);
  casse(o => { o.accounts[0].iban_last4 = 'FR76 0000'; }, /fin d'IBAN illisible/);
  casse(o => { o.transactions[2].amount = 12.5; }, /Opération n° 3 : montant non entier/);
  casse(o => { o.transactions[2].amount = '1250'; }, /Opération n° 3 : montant non entier/);
  casse(o => { o.transactions[0].account = 'r9'; }, /Opération n° 1 : compte inconnu/);
  casse(o => { o.transactions[0].date = '2023-02-30'; }, /Opération n° 1 : date invalide/);
  casse(o => { o.transactions[0].status = 'BOOK'; }, /Opération n° 1 : statut inconnu/);
  casse(o => { o.transactions[0].label = ''; }, /Opération n° 1 : libellé absent/);
  casse(o => { o.transactions.push(Object.assign({}, o.transactions[4])); }, /Opération n° 6 : identifiant en double/);
  casse(o => { o.transactions = {}; }, /illisible/);
  // les messages ne citent jamais un libellé, un montant ni une référence du fichier
  try { const o = f(); o.transactions[2].amount = 'SALAIRE 2500'; R.valider(o); }
  catch (e) { assert.doesNotMatch(e.message, /SALAIRE|2500|COURANT/); }
});

test('association proposée : fin d\'IBAN, puis compte à créer ; mémorisée au réimport', () => {
  const { S, c } = etat();
  const rep = R.valider(fichier());
  assert.deepEqual(json(R.proposer(rep, S)), { r0: c.id, r1: 'creer', r3: 'creer', r5: 'creer' });
  R.appliquer(S, rep, R.proposer(rep, S), { now: NOW });
  const again = json(R.proposer(rep, S));
  assert.equal(again.r0, c.id);
  assert.ok(Object.values(again).every(v => v !== 'creer'));
  assert.deepEqual(again, json(S.modele.reprise.map));
});

test('import : comptes créés, réglages repris, frontière, ids par empreinte + rang, carnet gardé', () => {
  const { S, c } = etat();
  // opérations Enable Banking déjà présentes, de part et d'autre de la future frontière (2026-10-25)
  S.ops[c.id] = [
    { id: c.id + ':r:A', compte: c.id, date: '2026-10-26', montant: -100, libelle: 'APRES', statut: 'comptabilisee', source: 'eb' },
    { id: c.id + ':r:B', compte: c.id, date: '2026-10-25', montant: -200, libelle: 'LE JOUR', statut: 'comptabilisee', source: 'eb' },
    { id: c.id + ':r:C', compte: c.id, date: '2026-10-20', montant: -300, libelle: 'AVANT', statut: 'comptabilisee', source: 'eb' }];
  const rep = R.valider(fichier());
  const st = R.appliquer(S, rep, { r0: c.id, r1: 'creer', r3: 'creer', r5: 'creer' }, { now: NOW });
  assert.deepEqual(json(st), { comptes: 4, crees: 3, operations: 5, ebRetirees: 2, ignores: 0 });
  assert.equal(c.frontiere, '2026-10-25');
  assert.equal(c.libelle, 'COURANT');
  assert.equal(c.aVerifier, undefined);
  assert.deepEqual(json(S.ops[c.id]).map(o => [o.date, o.montant, o.source]),
    [['2026-10-26', -100, 'eb'], ['2026-10-25', 250000, 'reprise'], ['2023-01-03', -1250, 'reprise'], ['2023-01-03', -1250, 'reprise']]);
  const boul = json(S.ops[c.id]).filter(o => o.date === '2023-01-03').map(o => o.id);
  assert.equal(new Set(boul).size, 2);
  assert.ok(boul.every(id => id.startsWith(c.id + ':k:')));
  const [, joint, carte, livret] = S.modele.comptes;
  assert.deepEqual([joint.role, carte.role, livret.role], ['commun', 'carte_differee', 'epargne']);
  assert.deepEqual(json(carte.prelevement), { compte: c.id, jour: 5 });
  assert.deepEqual(json(livret.solde), { centimes: 500000, date: '2026-10-20' });
  assert.equal(livret.source.type, 'manuel');
  assert.equal(S.ops[joint.id][0].id, joint.id + ':x:ancien-42');
  assert.deepEqual(json(S.carnet), { budget: { reglage: 'opaque' } });
  // une récupération Enable Banking ultérieure ignore ce qui précède la frontière
  assert.equal(M.debutRecuperation(S, c), '2026-10-26');
  assert.equal(M.integrer(S, c.id, [{ booking_date: '2026-10-24', transaction_amount: { amount: '9.99' }, credit_debit_indicator: 'DBIT', remittance_information: ['VIEUX'], status: 'BOOK' }], NOW).ignorees, 1);
});

test('import rejouable : les opérations de reprise sont remplacées, pas doublées ; ignorer un compte', () => {
  const { S, c } = etat();
  const rep = R.valider(fichier());
  R.appliquer(S, rep, R.proposer(rep, S), { now: NOW });
  const n1 = Object.values(json(S.ops)).flat().length;
  R.appliquer(S, rep, R.proposer(rep, S), { now: NOW });
  assert.equal(Object.values(json(S.ops)).flat().length, n1);
  assert.equal(S.modele.comptes.length, 4);                      // pas de nouveaux comptes créés au réimport
  // reprise définitive : une opération de plus, un compte ignoré
  const f2 = fichier();
  f2.transactions.push({ account: 'r0', date: '2026-10-31', amount: -700, label: 'CB DERNIERE', status: 'comptabilisee' });
  const rep2 = R.valider(f2);
  const ch = json(R.proposer(rep2, S));
  const joint = ch.r1;
  ch.r1 = 'ignorer';
  const st = R.appliquer(S, rep2, ch, { now: NOW, reglages: false });
  assert.equal(st.ignores, 1);
  assert.equal(c.frontiere, '2026-10-31');
  assert.equal((S.ops[joint] || []).filter(o => o.source === 'reprise').length, 0);
  assert.equal(M.compte(S, joint).frontiere, undefined);
  assert.equal(S.ops[c.id].filter(o => o.source === 'reprise').length, 4);
});

test('import : deux comptes de la reprise vers le même compte Klad refusé', () => {
  const { S, c } = etat();
  const rep = R.valider(fichier());
  assert.throws(() => R.appliquer(S, rep, { r0: c.id, r1: c.id, r3: 'ignorer', r5: 'ignorer' }, { now: NOW }), /même compte Klad/);
  assert.equal(Object.keys(S.ops).length, 0);
});
