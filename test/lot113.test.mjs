// Tests 1.1.3 : virement « en route » compté en jours ouvrés (week-ends et jours fériés français exclus) ; observation
// « virements après l'échéance » (un virement parti avant l'échéance n'est jamais en retard ; le titre nomme qui l'est) ;
// journal anonyme de la forme des champs de la banque à chaque fusion ou retrait ; journal des modifications du budget
// (périmètre et variation) ; « Budget du mois dépassé » sur la période du Budget.
// Jeu fictif « personnel » complété du scénario du 01/11 (test/scenario-anticipe.mjs). Données fictives uniquement.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { json } from './charge.mjs';
import { outils, etatDepuisReprise } from './jeux.mjs';
import { etatAnticipe, VIRS } from './scenario-anticipe.mjs';
import { reprisePersonnelle } from '../tools/mesures/donnees.mjs';

const X = outils(['sync.js']);
const { KladModele: M, KladClasse: K, KladBudget: KB, KladCommun: KC, KladObservations: O } = X;
const TOTAL = VIRS.reduce((t, [, v]) => t + v, 0);
const now = fin => Date.parse(fin + 'T10:00:00Z');
const ctx = (S, fin) => KB.contexte(S, now(fin), K.contexte(S, now(fin)));
const eb = (date, montant, label, id, plus) => Object.assign({ booking_date: date, value_date: date, transaction_amount: { amount: String(Math.abs(montant) / 100), currency: 'EUR' },
  credit_debit_indicator: montant < 0 ? 'DBIT' : 'CRDT', remittance_information: [label], status: 'BOOK', transaction_id: id }, plus || {});
const lire = (S, ref, ops, le) => M.integrer(S, S.modele.reprise.map[ref], ops, now(le), { depuis: '2026-10-25' });
const arrivees = (date, avecAutre) => VIRS.map(([k, v], i) => eb(date, v, 'VIR PERMANENT AURORE OMBELIN ' + k, 'C-' + (i + 1)))
  .concat(avecAutre ? [eb(avecAutre, 60000, 'VIR M BASILE QUENARD', 'C-4')] : []);

test('jours ouvrés : week-ends et jours fériés nationaux exclus (Pâques, Ascension, Pentecôte, 1er et 11 novembre)', () => {
  assert.deepEqual([2025, 2026, 2027].map(KC.paques), ['2025-04-20', '2026-04-05', '2027-03-28']);
  for (const d of ['2026-01-01', '2026-04-06', '2026-05-01', '2026-05-08', '2026-05-14', '2026-05-25', '2026-07-14', '2026-08-15', '2026-11-01', '2026-11-11', '2026-12-25'])
    assert.equal(KC.ferie(d), true, d);
  for (const d of ['2026-04-05', '2026-11-02', '2026-12-26', '2026-04-03']) assert.equal(KC.ferie(d), false, d + ' (pas Alsace-Moselle)');
  // départ le vendredi 30/10 : lundi 02/11 = 1er jour ouvré (1er novembre férié, un dimanche), mardi 03/11 = 2e
  assert.equal(KC.joursOuvres('2026-10-30', '2026-11-03'), 2);
  assert.equal(KC.joursOuvres('2026-10-30', '2026-11-06'), 5);
  assert.equal(KC.joursOuvres('2026-10-30', '2026-11-09'), 6);
  // le 11/11 (mercredi) ne compte pas
  assert.equal(KC.joursOuvres('2026-11-10', '2026-11-17'), 4);
  assert.equal(KC.joursOuvres('2026-11-03', '2026-11-03'), 0);
});

test('virement « en route » 5 jours ouvrés après son départ, puis « non reçu »', async () => {
  // virements partis le 31/10 (samedi, relus avec une référence), pas encore arrivés
  const S = await etatAnticipe(X, '2026-10-31');
  const etat = fin => { const B = ctx(S, fin); return { route: KC.enRoute(B).length, recus: json(KC.plan(B).recus.slice(0, 3).map(x => x.vu ? 'reçu' : x.route ? 'en route' : x.retard ? 'non reçu' : 'attendu')) }; };
  // 1.1.2 : 5 jours de calendrier → « non reçu » dès le jeudi 05/11 ; 1.1.3 : en route jusqu'au vendredi 06/11 compris
  for (const fin of ['2026-11-03', '2026-11-05', '2026-11-06']) {
    const e = etat(fin);
    assert.equal(e.route, 3, fin + ' : en route');
    assert.deepEqual(e.recus, ['en route', 'en route', 'en route'], fin);
  }
  const e = etat('2026-11-09');
  assert.equal(e.route, 0, 'lundi 09/11 : 6e jour ouvré, plus en route');
  assert.notDeepEqual(e.recus, ['en route', 'en route', 'en route']);
});

test('départ le vendredi 30/10, arrivée le mardi 03/11 : reçu, sans fausse alerte ; arrivée au 5e jour ouvré rapprochée', async () => {
  for (const [arrivee, fin] of [['2026-11-03', '2026-11-03'], ['2026-11-06', '2026-11-06']]) {
    const S = await etatAnticipe(X, '2026-10-30');
    lire(S, 'r2', arrivees(arrivee, '2026-11-03'), fin);
    const B = ctx(S, fin);
    assert.equal(KC.enRoute(B).length, 0, arrivee + ' : arrivés, plus en route');
    assert.deepEqual(json(KC.plan(B).recus.map(x => x.vu ? 'reçu' : 'non')), ['reçu', 'reçu', 'reçu', 'reçu']);
    const a = B.rows.filter(r => r.role === 'commun' && r.date === arrivee && r.m > 0 && /OMBELIN/.test(r.label));
    assert.equal(a.length, 3);
    for (const r of a) assert.equal(KC.departDe(B, r).date, '2026-10-30', 'arrivée rapprochée de son départ');
    assert.equal(KC.margeReelle(B).base, 'reelle', 'marge réelle quand tout est arrivé');
    assert.ok(!O.audit(B).some(x => /non reçu|en retard|après l'échéance/.test(x.titre + ' ' + x.texte)), 'aucune alerte');
  }
});

// Échéance du prêt le jeudi 05/11 ; mes virements partis le 31/10, arrivés le vendredi 06/11 ; celui de l'autre personne
// arrivé le 06/11 (après l'échéance) ou le 04/11 (avant).
async function echeance(autre, sansDepart) {
  const S = await etatAnticipe(X, '2026-10-31');
  lire(S, 'r2', arrivees('2026-11-06', autre).concat([eb('2026-11-05', -95000, 'ECH PRET IMMO FICTIF', 'C-9')]), '2026-11-06');
  if (sansDepart) S.ops[S.modele.reprise.map.r0] = S.ops[S.modele.reprise.map.r0].filter(o => !(/VERS COMMUN/.test(o.libelle) && o.date >= '2026-10-25'));
  return O.audit(ctx(S, '2026-11-06')).filter(x => /Compte commun : virement/.test(x.titre));
}

test('« virements après l\'échéance » : seul le virement vraiment en retard compte ; le titre nomme qui', async () => {
  // mes virements partis avant l'échéance (arrivés après) : pas en retard ; celui de l'autre personne : en retard
  let L = await echeance('2026-11-06');
  assert.deepEqual(json(L.map(x => x.titre)), ['Compte commun : virement de Basile Quenard après l\'échéance']);
  assert.match(L[0].texte, /1 virement\(s\) sont arrivés après l'échéance du prêt du 05\/11/);
  // l'autre personne à l'heure : rien en retard
  L = await echeance('2026-11-04');
  assert.deepEqual(json(L.map(x => x.titre)), ['Compte commun : virements à l\'heure']);
  // départ inconnu (compte perso non suivi) : l'arrivée fait foi, les deux personnes sont nommées
  L = await echeance('2026-11-06', true);
  assert.deepEqual(json(L.map(x => x.titre)), ['Compte commun : virements de Aurore Ombelin et de Basile Quenard après l\'échéance']);
});

test('« virements après l\'échéance » : un virement encore en route, parti avant l\'échéance, ne compte pas', async () => {
  const S = await etatAnticipe(X, '2026-10-31');
  // échéance le 05/11, rien d'arrivé le 06/11 : mes virements sont en route (partis le 31/10)
  lire(S, 'r2', [eb('2026-11-05', -95000, 'ECH PRET IMMO FICTIF', 'C-9')], '2026-11-06');
  let B = ctx(S, '2026-11-06');
  assert.equal(KC.enRoute(B).length, 3);
  assert.deepEqual(json(O.audit(B).filter(x => /Compte commun : virement/.test(x.titre)).map(x => x.titre)), [], 'ni retard ni « aucun apport »');
  // seul celui de l'autre personne arrive, après l'échéance
  lire(S, 'r2', [eb('2026-11-05', -95000, 'ECH PRET IMMO FICTIF', 'C-9'), eb('2026-11-06', 60000, 'VIR M BASILE QUENARD', 'C-4')], '2026-11-06');
  B = ctx(S, '2026-11-06');
  assert.deepEqual(json(O.audit(B).filter(x => /Compte commun : virement/.test(x.titre)).map(x => x.titre)), ['Compte commun : virement de Basile Quenard après l\'échéance']);
});

test('journal : forme des champs de la banque à chaque fusion ou retrait, jamais leurs valeurs', async () => {
  const S = await etatDepuisReprise(X, reprisePersonnelle('2026-10-28'), now('2026-10-28'));
  const cid = S.modele.reprise.map.r0;
  // lu le 30/10 sans référence (identifiant fabriqué à partir de la date), relu le 31/10 avec référence et autre date
  M.integrer(S, cid, [eb('2026-10-30', -50000, 'VIR PERMANENT VERS COMMUN CREDIT', '2026-10-30T00:00:00-1', { value_date: undefined })], now('2026-10-30'), { depuis: '2026-10-25' });
  const st = M.integrer(S, cid, [eb('2026-10-31', -50000, 'VIR PERMANENT VERS COMMUN CREDIT 7300100000000001', '2026-10-31T00:00:00-1', { entry_reference: 'REF-FICTIVE-1' })],
    now('2026-10-31'), { depuis: '2026-10-25' });
  assert.equal(st.fusionnees, 1);
  assert.deepEqual(json(st.details), [{ action: 'fusion', motif: 'relue',
    renvoyee: { status: true, entry_reference: true, transaction_id: true, booking_date: true, value_date: true, idDate: true },
    ancienne: { id: 'reference-date', statut: 'comptabilisee', dateValeur: false } }]);
  // la référence du 31/10 étant entry_reference, l'opération est gardée sous cette référence
  const t = M.texteForme(st.details[0]);
  assert.equal(t, 'opération fusionnée (relue par la banque) · champs renvoyés : status oui, entry_reference oui, transaction_id oui (forme date), ' +
    'booking_date oui, value_date oui · remplacée : identifiant référence en forme de date, comptabilisée, date de valeur non');
  for (const interdit of ['500', 'VIR', 'COMMUN', '7300', 'REF-FICTIVE', '2026', '30/10', '31/10']) assert.ok(!t.includes(interdit), interdit);
  // plus renvoyée sur la période relue, sans équivalent : retirée
  const st2 = M.integrer(S, cid, [eb('2026-10-29', -1234, 'CARTE 29/10 AUTRE ACHAT', '2026-10-29T00:00:00-1')], now('2026-11-01'), { depuis: '2026-10-25' });
  assert.equal(st2.retirees, 1);
  assert.equal(M.texteForme(st2.details[0]), 'opération retirée (plus renvoyée par la banque) · pas de champs renvoyés · retirée : identifiant référence, comptabilisée, date de valeur non');
  // en cours devenue comptabilisée
  const st3 = M.integrer(S, cid, [eb('2026-11-02', -2000, 'CARTE BOULANGERIE FICTIVE', 'P-1', { status: 'PDNG', transaction_id: undefined })], now('2026-11-02'), { depuis: '2026-11-02' });
  assert.equal(st3.details.length, 0);
  const st4 = M.integrer(S, cid, [eb('2026-11-03', -2000, 'CARTE BOULANGERIE FICTIVE', 'B-1')], now('2026-11-03'), { depuis: '2026-11-02' });
  assert.deepEqual(json(st4.details.map(d => [d.action, d.motif, d.ancienne.id, d.renvoyee && d.renvoyee.entry_reference])), [['fusion', 'en-cours', 'en-cours', false]]);
});

test('synchronisation : une ligne de journal par fusion ou retrait, nom du compte anonyme', async () => {
  const S = await etatDepuisReprise(X, reprisePersonnelle('2026-10-28'), now('2026-10-28'));
  const c = M.compte(S, S.modele.reprise.map.r0);
  S.modele.connexions.s1 = { banque: 'Banque Fictive', psu: null, valide: '2027-01-01T00:00:00Z' };
  c.source = { type: 'eb', connexion: 's1', uid: 'u1' };
  let lecture = [eb('2026-10-30', -50000, 'VIR PERMANENT VERS COMMUN CREDIT', '2026-10-30T00:00:00-1')];
  const logs = [];
  const deps = { now: () => now('2026-10-31'), log: (k, m) => logs.push(m), dispo: async () => ({}),
    client: () => ({ balances: async () => [], transactions: async () => lecture }) };
  await X.KladSync.synchroniser(S, deps);
  lecture = [eb('2026-10-31', -50000, 'VIR PERMANENT VERS COMMUN CREDIT 7300100000000001', '2026-10-31T00:00:00-1')];
  logs.length = 0;
  await X.KladSync.synchroniser(S, deps);
  const f = logs.filter(m => /opération fusionnée/.test(m));
  assert.equal(f.length, 1, logs.join('\n'));
  assert.match(f[0], /^Banque A · compte 1 : opération fusionnée \(relue par la banque\) · champs renvoyés : status oui, entry_reference non, transaction_id oui \(forme date\)/);
  assert.ok(!/Fictive|VIR|500/.test(f[0]));
});

test('journal du budget : périmètre et variation du budget mensuel, sans nom de poste', async () => {
  const S = await etatDepuisReprise(X, reprisePersonnelle('2026-10-28'), now('2026-10-28'));
  const D = S.budget;
  D.plan.commun['f|Assurance habitation'] = { on: true, amt: 4200 };
  D.contrats.push({ id: 'cx', sc: 'commun', label: 'Assurance fictive', montant: 4134, per: 1, poste: 'f|Assurance habitation' });
  const r = KB.versPrevu(S, 'commun', 'f|Assurance habitation');
  assert.equal(KB.journalPoste(S, r.snap, 'un poste aligné sur ses contrats'), 'Budget du commun : un poste aligné sur ses contrats (budget baissé de 0,66 € par mois).');
  const s2 = KB.modifier(S, 'perso', 'f|Assurance auto', { amt: 5000 });
  assert.match(KB.journalPoste(S, s2, 'un poste modifié'), /^Budget perso : un poste modifié \(budget monté de 5,00 € par mois\)\.$/);
  const s3 = KB.modifier(S, 'perso', 'f|Assurance auto', { amt: 5000 });
  assert.equal(KB.journalPoste(S, s3, 'un poste modifié'), 'Budget perso : un poste modifié (budget inchangé).');
  const s4 = KB.retirer(S, 'perso', 'f|Assurance auto');
  assert.match(KB.journalPoste(S, s4, 'un poste retiré'), /baissé de 50,00/);
});

test('« Budget du mois dépassé » suit la période du Budget (cycle de salaire ou mois civil)', async () => {
  // 300 € d'alimentation le 29/10 : dans le cycle de salaire en cours (27/10 → 26/11), mais en octobre au mois civil
  const r = reprisePersonnelle('2026-10-28');
  r.transactions.push({ account: 'r0', date: '2026-10-29', amount: -30000, label: 'CARTE 29/10 SUPERMARCHE FICTIF', status: 'comptabilisee' });
  const S = await etatDepuisReprise(X, r, now('2026-10-28'));
  const obs = (S2, fin) => O.audit(ctx(S2, fin)).filter(a => a.titre === 'Budget du mois dépassé' && a.scope === 'perso').map(a => a.texte).join(' ');
  // ligne du poste dans l'écran Budget (période en cours)
  const depasse = (S2, fin) => KB.suivi(ctx(S2, fin), 'perso', null).sections.courante.lignes.find(a => a.key === 'c|Alimentation');
  // cycle de salaire au 03/11 : la dépense compte, le poste est dépassé dans le Budget et l'observation le dit
  const a = depasse(S, '2026-11-03');
  assert.ok(a.cur >= 30000, 'Budget : compté dans le cycle');
  assert.match(obs(S, '2026-11-03'), /Alimentation/);
  // mois civil au 03/11 : novembre ne la contient pas, ni dans le Budget ni dans l'observation
  const Sm = JSON.parse(JSON.stringify(S)); Sm.budget.reglages = Object.assign({}, Sm.budget.reglages, { cycle: 'mois' });
  assert.ok(depasse(Sm, '2026-11-03').cur < 30000, 'Budget au mois : novembre');
  assert.doesNotMatch(obs(Sm, '2026-11-03'), /Alimentation/);
  // échéance réglée d'avance (1.1.2) : la contribution du 31/10 compte pour novembre au mois civil, sans dépassement
  const Sa = await etatAnticipe(X, '2026-11-01');
  const Sam = JSON.parse(JSON.stringify(Sa)); Sam.budget.reglages = Object.assign({}, Sam.budget.reglages, { cycle: 'mois' });
  const Ba = ctx(Sam, '2026-11-01'), lien = KB.postes(Ba, 'perso').lignes.find(x => x.key === 'f|Contribution compte commun');
  assert.equal(lien.cur, TOTAL);
  assert.ok(!O.audit(Ba).some(x => x.titre === 'Budget du mois dépassé' && /Contribution/.test(x.texte)));
});
