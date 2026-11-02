// Tests 1.1.4 : observation « virements après l'échéance » jugée virement par virement (les apports ponctuels du mois ne
// comptent pas ; référence : premier prêt du mois, jamais le jour prévu du virement ; départ connu après l'arrivée) ;
// « Virements du mois » avec les montants reçus et encore attendus.
// Jeu fictif « personnel » complété du scénario du 01/11 (test/scenario-anticipe.mjs). Données fictives uniquement.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { json } from './charge.mjs';
import { outils } from './jeux.mjs';
import { etatAnticipe } from './scenario-anticipe.mjs';

const X = outils(['sync.js']);
const { KladModele: M, KladClasse: K, KladBudget: KB, KladCommun: KC, KladObservations: O } = X;
const now = fin => Date.parse(fin + 'T10:00:00Z');
const ctx = (S, fin) => KB.contexte(S, now(fin), K.contexte(S, now(fin)));
const eb = (date, montant, label, id) => ({ booking_date: date, value_date: date, transaction_amount: { amount: String(Math.abs(montant) / 100), currency: 'EUR' },
  credit_debit_indicator: montant < 0 ? 'DBIT' : 'CRDT', remittance_information: [label], status: 'BOOK', transaction_id: id });
const ARRIVEES = [['CREDIT', 50000], ['COPRO', 20000], ['CHARGES', 10000]].map(([k, v], i) =>
  eb('2026-11-02', v, 'VIR PERMANENT AURORE OMBELIN ' + k + ' 730010000000000' + (i + 1), 'C-' + (i + 1)));
// Octobre : deux virements ponctuels (rattrapage) après le prêt du 05/10 ; un second prêt le 06/10.
const OCTOBRE = [eb('2026-10-06', -15000, 'ECH PRET IMMO FICTIF BIS', 'O-1'), eb('2026-10-11', 8500, 'VIR INST AURORE OMBELIN RATTRAPAGE', 'O-2'),
  eb('2026-10-13', 8500, 'VIR AURORE OMBELIN', 'O-3')];
const NOVEMBRE = [eb('2026-11-05', -95000, 'ECH PRET IMMO FICTIF', 'N-1'), eb('2026-11-06', -15000, 'ECH PRET IMMO FICTIF BIS', 'N-2')];

// Scénario constaté : mes virements partis le samedi 31/10 (relus après fusion), arrivés le lundi 02/11 ; prêts les 05
// et 06 ; le virement de l'autre personne (prévu le 3 dans le jeu) n'arrive pas.
async function scenario(fin) {
  const S = await etatAnticipe(X, '2026-10-31');
  const cid = S.modele.reprise.map.r2;
  const ops = OCTOBRE.concat(ARRIVEES).concat(NOVEMBRE).filter(o => o.booking_date <= fin);
  M.integrer(S, cid, ops, now(fin), { depuis: '2026-10-25' });
  // octobre : ajoutés comme une lecture plus ancienne (la synchronisation ne relit que depuis le 25/10)
  for (const o of OCTOBRE) S.ops[cid].push({ id: 'oct-' + o.transaction_id, date: o.booking_date, montant: (o.credit_debit_indicator === 'DBIT' ? -1 : 1) * Math.round(+o.transaction_amount.amount * 100),
    libelle: o.remittance_information[0], source: 'eb' });
  return ctx(S, fin);
}
const retards = B => O.audit(B).filter(x => /^Compte commun : virement/.test(x.titre));

test('02/11 : mes virements arrivés, celui de l\'autre personne pas encore : aucune observation de retard', async () => {
  const B = await scenario('2026-11-02');
  const arr = B.rows.filter(r => r.role === 'commun' && r.date === '2026-11-02' && /OMBELIN/.test(r.label));
  assert.equal(arr.length, 3);
  for (const r of arr) assert.equal(KC.departDe(B, r).date, '2026-10-31', 'arrivée rapprochée de son départ du 31/10');
  const L = retards(B);
  assert.ok(!L.some(x => /après l'échéance/.test(x.titre)), json(L.map(x => x.titre)));
  // les virements ponctuels d'octobre ne sont pas des retards
  assert.ok(!O.audit(B).some(x => /après l'échéance|en retard/.test(x.titre + ' ' + x.texte)));
});

test('02/11 : « Virements du mois » donne les montants reçus et encore attendus', async () => {
  const B = await scenario('2026-11-02');
  const v = O.audit(B).find(x => x.titre === 'Virements du mois');
  assert.ok(v, 'observation présente');
  assert.match(v.texte, /^3 sur 4 reçus \(800\s€\) ; 600\s€ encore attendus \(Basile Quenard, prévu le 3\)\.$/);
});

test('07/11 sans le virement de l\'autre personne : observation au seul nom de l\'autre personne', async () => {
  const B = await scenario('2026-11-07');
  const L = retards(B);
  assert.deepEqual(json(L.map(x => x.titre)), ['Compte commun : virement de Basile Quenard après l\'échéance']);
  assert.match(L[0].texte, /En novembre 2026, 1 virement\(s\) après l'échéance du prêt du 05\/11\/2026 : Basile Quenard · Virement personne B \(600\s€\) pas encore arrivé\./);
  assert.ok(!/Aurore/.test(L[0].texte));
});

test('sans départ connu, une arrivée avant l\'échéance n\'est jamais en retard ; après, elle l\'est', async () => {
  const S = await etatAnticipe(X, '2026-10-31');
  const r0 = S.modele.reprise.map.r0, cid = S.modele.reprise.map.r2;
  S.ops[r0] = S.ops[r0].filter(o => !(/VERS COMMUN/.test(o.libelle) && o.date >= '2026-10-25'));
  M.integrer(S, cid, ARRIVEES.concat([eb('2026-11-04', 60000, 'VIR M BASILE QUENARD', 'C-4')]).concat(NOVEMBRE), now('2026-11-07'), { depuis: '2026-10-25' });
  let B = ctx(S, '2026-11-07');
  assert.equal(KC.departDe(B, B.rows.find(r => r.role === 'commun' && r.date === '2026-11-02' && r.m > 0)), null, 'départ inconnu');
  assert.deepEqual(json(retards(B).map(x => x.titre)), ['Compte commun : virements à l\'heure']);
  // arrivée le 06/11 (après le premier prêt du 05/11) : en retard, même avant le second prêt
  const S2 = await etatAnticipe(X, '2026-10-31');
  const r0b = S2.modele.reprise.map.r0;
  S2.ops[r0b] = S2.ops[r0b].filter(o => !(/VERS COMMUN/.test(o.libelle) && o.date >= '2026-10-25'));
  M.integrer(S2, S2.modele.reprise.map.r2, ARRIVEES.concat([eb('2026-11-06', 60000, 'VIR M BASILE QUENARD', 'C-4')]).concat(NOVEMBRE), now('2026-11-07'), { depuis: '2026-10-25' });
  B = ctx(S2, '2026-11-07');
  assert.deepEqual(json(retards(B).map(x => x.titre)), ['Compte commun : virement de Basile Quenard après l\'échéance']);
});

test('avant le prêt du mois, tous les virements arrivés : « Tous reçus », le jour prévu du virement ne compte pas', async () => {
  const S = await etatAnticipe(X, '2026-10-31');
  M.integrer(S, S.modele.reprise.map.r2, ARRIVEES.concat([eb('2026-11-04', 60000, 'VIR M BASILE QUENARD', 'C-4')]), now('2026-11-04'), { depuis: '2026-10-25' });
  const L = retards(ctx(S, '2026-11-04'));
  assert.deepEqual(json(L.map(x => x.niveau + ' ' + x.titre)), ['good Compte commun : virements de novembre']);
  assert.match(L[0].texte, /Tous reçus \(dernier le 04\/11\), avant l'échéance du prêt attendue vers le 5\./);
});
