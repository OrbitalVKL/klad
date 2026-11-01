// Tests 1.1.2 : virements permanents réglés d'avance et doublons, sur le jeu fictif « personnel » complété du scénario
// du 01/11 (test/scenario-anticipe.mjs) : trois virements prévus le 1er, exécutés le 30/10, relus le 31/10 avec une
// référence, arrivés sur le commun le 02/11. Au 31/10, au 01/11 et au 03/11, chaque charge est comptée une seule fois
// (reste à vivre, budget au cycle et au mois civil, observations, échéances, commun, résumé Grafit) ; contre-épreuve :
// virements exécutés le 01/11 → mêmes chiffres au 03/11 ; relevés des jeux sans virement anticipé inchangés (1.1.1).
// Données fictives uniquement.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { json, montantSigne } from './charge.mjs';
import { outils, etatDepuisReprise, releve } from './jeux.mjs';
import { etatAnticipe, chiffres, VIRS } from './scenario-anticipe.mjs';
import { repriseMesures, reprisePersonnelle } from '../tools/mesures/donnees.mjs';

const X = outils(['ui.js', 'vues.js', 'vbudget.js', 'vcommun.js', 'vaccueil.js']);
const { KladModele: M, KladClasse: K, KladBudget: KB, KladCommun: KC, KladResume: R, KladObservations: O, KladVues: V, KladVuesBudget: VB, KladVuesCommun: VC } = X;
const TOTAL = VIRS.reduce((t, [, v]) => t + v, 0);        // 800 € de contribution par mois
const LIEN = 'f|Contribution compte commun';
const now = fin => Date.parse(fin + 'T10:00:00Z');
const ctx = (S, fin) => KB.contexte(S, now(fin), K.contexte(S, now(fin)));
const lien = s => s.sections.fixe.lignes.find(l => l.key === LIEN);
const auMois = S => { const S2 = JSON.parse(JSON.stringify(S)); S2.budget.reglages = Object.assign({}, S2.budget.reglages, { cycle: 'mois' }); return S2; };
const virementsCourant = S => S.ops[S.modele.reprise.map.r0].filter(o => /VERS COMMUN/.test(o.libelle) && o.date >= '2026-10-25');

for (const fin of ['2026-10-31', '2026-11-01', '2026-11-03']) {
  test('scénario au ' + fin + ' : contribution comptée une seule fois partout', async () => {
    const S = await etatAnticipe(X, fin);
    // doublons : les trois virements n'apparaissent qu'une fois (version relue avec référence, datée du 31/10)
    assert.deepEqual(json(virementsCourant(S).map(o => o.date)), ['2026-10-31', '2026-10-31', '2026-10-31']);
    const B = ctx(S, fin), s = KB.suivi(B, 'perso', null);
    // cycle de salaire (27/10 → 26/11) : reste à vivre (deux bases) et budget
    assert.equal(lien(s).cur, TOTAL, 'cycle : utilisé = une fois les virements');
    assert.notEqual(lien(s).cls, 'over');
    assert.equal(s.rav.budget.fixes, s.T.fixe.c);
    assert.equal(s.T.fixe.c, TOTAL, 'RAV salaire : charges fixes prélevées = la contribution une fois');
    assert.equal(s.T.fixe.left, s.T.fixe.p - TOTAL, 'RAV comptes : la contribution n\'est plus « à venir »');
    // mois civil : octobre garde ses virements du 01/10, novembre reçoit ceux réglés d'avance
    const Bm = ctx(auMois(S), fin), sm = KB.suivi(Bm, 'perso', null);
    assert.equal(lien(sm).cur, TOTAL);
    assert.doesNotMatch(lien(sm).etat.texte, /à venir|attendu|de plus/);
    if (fin === '2026-10-31') {
      assert.equal(KB.postes(Bm, 'perso').lignes.find(a => a.key === LIEN).cur, TOTAL, 'octobre (mois civil) : une fois');
    }
    // observation « Budget du mois dépassé » : jamais pour la contribution
    assert.ok(!O.audit(B).some(a => a.titre === 'Budget du mois dépassé' && /Contribution/.test(a.texte)));
    // échéances à 31 jours : aucune contribution annoncée à nouveau
    assert.ok(!KB.echeances(B, 31).some(e => /VERS COMMUN|Contribution/.test(e.label)));
    // résumé Grafit : pas de BUDGET_OVER sur la contribution, mois et prochaines échéances cohérents
    const g = json(R.construire(S, now(fin), { budget: B }));
    assert.ok(!g.alerts.some(a => a.code === 'BUDGET_OVER' && /CONTRIBUTION/.test(a.text)));
    assert.ok(!g.upcoming.some(e => /CONTRIBUTION|VERS COMMUN/.test(e.label)));
    // commun
    const P = KC.plan(B), MR = KC.margeReelle(B), F = KC.finDeMois(B), C = KC.tresorerie(B);
    const etats = json(P.recus.map(x => x.vu ? 'reçu' : x.route ? 'en route' : 'attendu'));
    if (fin === '2026-10-31') {
      assert.deepEqual(etats, ['reçu', 'reçu', 'reçu', 'reçu'], 'octobre : tout reçu');
      assert.equal(KC.enRoute(B).length, 3, 'partis pour novembre, en route');
      assert.ok(KC.enRoute(B).every(r => r.pour === '2026-11'));
      assert.equal(F.route, undefined, 'pas comptés dans la fin d\'octobre');
      // trésorerie : comptés une fois, en novembre
      const nv = C.months.find(m => m.m === '2026-11');
      assert.equal(nv.in, TOTAL + 60000);
    } else if (fin === '2026-11-01') {
      assert.deepEqual(etats, ['en route', 'en route', 'en route', 'attendu']);
      assert.equal(F.route, TOTAL);
      assert.equal(F.inc, 60000, 'seul le virement de l\'autre personne est attendu');
      assert.equal(F.end, F.solde - F.due + F.inc + F.route - F.reserve);
      assert.equal(MR.base, 'prevue');
      assert.equal(MR.enAttente, TOTAL + 60000);
      assert.equal(MR.affichee, MR.solde + TOTAL + 60000 - MR.fixes - MR.variable);
      assert.equal(C.months[0].in, TOTAL + 60000, 'trésorerie : une seule fois');
      assert.equal(g.commun.transfers_in_transit, TOTAL / 100);
      assert.equal(g.commun.transfers_expected, 600);
    } else {
      assert.deepEqual(etats, ['reçu', 'reçu', 'reçu', 'reçu']);
      assert.equal(KC.enRoute(B).length, 0, 'arrivés : rapprochés du départ, plus en route');
      assert.equal(MR.base, 'reelle');
      assert.equal(F.inc, 0);
      assert.equal(F.route, undefined);
    }
  });
}

test('contre-épreuve : virements exécutés le 01/11 → mêmes chiffres au 03/11', async () => {
  const A = chiffres(X, await etatAnticipe(X, '2026-11-03'), '2026-11-03');
  const Bc = chiffres(X, await etatAnticipe(X, '2026-11-03', { avance: false }), '2026-11-03');
  assert.deepEqual(A, Bc);
  // et au 01/11, la marge prévue du commun est celle du 03/11 (virements arrivés)
  const U = chiffres(X, await etatAnticipe(X, '2026-11-01'), '2026-11-01');
  assert.equal(U.margeCommun, A.margeCommun);
  assert.equal(U.finDeMois, A.finDeMois);
  assert.equal(U.ravSalaire, A.ravSalaire);
});

test('relevés de contrôle des jeux « mesures » et « personnel » identiques à la 1.1.1', async () => {
  const T = now('2026-10-28');
  for (const [nom, f] of [['mesures', repriseMesures], ['personnel', reprisePersonnelle]]) {
    const ref = JSON.parse(fs.readFileSync(new URL('./references/releve-' + nom + '-1.1.1.json', import.meta.url)));
    const r = releve(X, await etatDepuisReprise(X, f('2026-10-28'), T), T);
    r.meta.version = ref.meta.version;
    assert.deepEqual(r, ref, nom);
  }
});

test('découvert du commun : l\'alerte Grafit dit la même chose que la trésorerie', async () => {
  for (const solde of [30000, -50000]) {
    const S = await etatAnticipe(X, '2026-11-01');
    M.compte(S, S.modele.reprise.map.r2).solde.centimes = solde;
    const B = ctx(S, '2026-11-01'), C = KC.tresorerie(B), rq = KC.risqueDecouvert(B);
    const g = json(R.construire(S, now('2026-11-01'), { budget: B }));
    const al = g.alerts.find(a => a.code === 'OVERDRAFT_RISK');
    if (!C.negAt) { assert.equal(rq, null, solde + ' : pas de découvert dans la trésorerie, pas d\'alerte'); assert.equal(al, undefined); assert.equal(g.commun.overdraft_risk, false); }
    else { assert.equal(rq.date, C.negAt); assert.equal(al.text, 'COMPTE COMMUN · ' + C.negAt.slice(8, 10) + '/' + C.negAt.slice(5, 7)); }
    // 300 € avant l'échéance du prêt (950 €) : « solde − prélèvements à venir » est sous zéro (la 1.1.1 annonçait un
    // découvert au 30/11, « crit »), mais les virements (en route, puis attendu) arrivent avant : rien en novembre
    if (solde === 30000) {
      const F = KC.finDeMois(B);
      assert.ok(F.solde - F.due < 0);
      assert.equal(F.decouvert, false);
      assert.ok(C.negAt > '2026-11-30', 'premier découvert de la trésorerie après novembre');
      assert.equal(al.level, 'caut');
    } else { assert.ok(C.negAt <= '2026-11-30'); assert.equal(al.level, 'crit'); }
  }
});

test('correction à la main : « compte pour : octobre / novembre », annulable ; fenêtre réglable', async () => {
  const S = await etatAnticipe(X, '2026-11-01');
  const Sm = auMois(S);
  const o = virementsCourant(Sm)[0];
  let Bm = ctx(Sm, '2026-11-01');
  assert.equal(KB.rattachement(Bm, o.id).texte, 'réglé d\'avance pour novembre');
  assert.deepEqual(json(KB.choixRattachement(Bm, o.id)).map(x => [x.label, x.actif]), [['octobre', false], ['novembre', true]]);
  assert.ok(KB.rattachements(Bm).get(o.id));
  // compte pour octobre (sa date réelle)
  const avant = KB.rattacherA(o, 'reel');
  Bm = ctx(Sm, '2026-11-01');
  assert.equal(lien(KB.suivi(Bm, 'perso', null)).cur, TOTAL - VIRS[0][1]);
  assert.equal(KB.rattachement(Bm, o.id).texte, null);
  assert.equal(KB.rattachement(Bm, o.id).main, true);
  KB.rattacherA(o, avant);
  Bm = ctx(Sm, '2026-11-01');
  assert.equal(lien(KB.suivi(Bm, 'perso', null)).cur, TOTAL, 'annulé : retour à l\'automatique');
  // fenêtre réglée à 0 jour avant : le virement du 31/10 compte pour octobre
  Sm.budget.reglages.echeance = { avant: 0, apres: 5 };
  Bm = ctx(Sm, '2026-11-01');
  assert.equal(lien(KB.suivi(Bm, 'perso', null)).cur, 0);
  assert.deepEqual(json(KB.echeanceReglee({ echeance: { avant: '', apres: 99 } })), { avant: 7, apres: 15 });
});

test('écrans : mention sur l\'opération, « en route », marge prévue, sans montant signé', async () => {
  const S = await etatAnticipe(X, '2026-11-01');
  const B = ctx(S, '2026-11-01'), cx = K.contexte(S, now('2026-11-01'));
  const o = virementsCourant(S)[0];
  const d = V.detail(S, o, cx, B);
  assert.match(d, /réglé d&#39;avance pour novembre|réglé d'avance pour novembre/);
  assert.match(d, /data-a="comptepour"/);
  assert.match(d, /31\/10\/2026|31 octobre/);
  const l = V.tranche(S, [o], 0, 1, { ctx: cx, ratt: KB.rattachements(B) }).html;
  assert.match(l, /réglé d.+avance pour novembre/);
  const p = VC.plan(B, { cartes: new Set() }, 'mois');
  assert.match(p, /en route · parti le 31\/10/);
  assert.match(p, /en route<\/span> <b class="num">800,00/);
  const m = VB.ravM(B, 'commun', {});
  assert.match(m, /Marge prévue du commun/);
  assert.match(m, /prévue · en attente de 1\s400,00/);
  assert.match(m, /Virements en route/);
  assert.match(m, /Marge réelle/, 'les deux bases sont visibles dans le détail');
  const m3 = VB.ravM(ctx(await etatAnticipe(X, '2026-11-03'), '2026-11-03'), 'commun', {});
  assert.match(m3, /Marge réelle du commun/);
  assert.doesNotMatch(m3, /prévue/);
  for (const h of [d, l, p, m, m3]) assert.ok(!montantSigne(h), 'aucun montant signé');
});
