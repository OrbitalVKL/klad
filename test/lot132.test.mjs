// Tests du correctif 1.3.2 : (1) débits imprévus du commun dans le résumé Grafit (commun.unplanned, alerte
// COMMUN_UNPLANNED) ; (2) début du suivi des avances au commun : avant cette date, un virement ponctuel garde son
// classement d'origine dans l'équilibre, même affecté (sauf l'enveloppe Impôts) ; déblocage de prêt jamais proposé ;
// (3) migrations : réglage posé pour un coffre passé par la 1.3.0, relecture unique de l'historique bancaire.
// La règle « plus jamais retirée » de la synchro est testée dans doublons.test.mjs et lot113.test.mjs.
// Scénario et jeux FICTIFS uniquement : libellés, noms et montants inventés.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { json } from './charge.mjs';
import { outils, etatDepuisReprise } from './jeux.mjs';
import { repriseFictive } from './fictif.mjs';
import { repriseMesures } from '../tools/mesures/donnees.mjs';

const X = outils(['ui.js', 'vues.js', 'vbudget.js', 'vcommun.js']);
const { KladModele: M, KladClasse: K, KladBudget: KB, KladCommun: KC, KladResume: R, KladMigrations: MG, KladVues: Vu } = X;
const FIN = '2026-10-28', NOW = Date.parse(FIN + 'T10:00:00Z');
const ctx = S => KB.contexte(S, NOW, K.contexte(S, NOW));
const commun = S => S.modele.comptes.find(x => x.role === 'commun');
const opCommun = (S, date, montant) => S.ops[commun(S).id].find(o => o.date === date && o.montant === montant);
const resume = S => json(R.construire(S, NOW, { budget: ctx(S) }));
const alerte = g => g.alerts.find(a => a.code === 'COMMUN_UNPLANNED');

// ------------------------------------------------------------ 1. résumé Grafit
// Reprise fictive : deux débits « hors du plan » sur le commun en octobre (mois en cours), un en septembre, un virement
// ponctuel reçu en octobre (crédit, à affecter).
function repriseImprevus() {
  const r = repriseFictive(FIN);
  const add = (date, amount, label) => r.transactions.push({ account: 'r2', date, amount, label, status: 'comptabilisee' });
  add('2026-09-15', -3000, 'CARTE 15/09 QUINCAILLERIE FICTIVE');
  add('2026-10-20', -12345, 'CARTE 20/10 PLOMBIER FICTIF');
  add('2026-10-24', -6085, 'CARTE 24/10 VITRIER FICTIF');
  add('2026-10-21', 5000, 'VIR PERSONNE A DIVERS');
  r.transactions.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  return r;
}

test('Grafit : commun.unplanned = débits imprévus du mois en cours ; vu / non vu ; alerte « crit » sans montant', async () => {
  const S = await etatDepuisReprise(X, repriseImprevus(), NOW);
  const B = ctx(S), ST = KC.statuts(B);
  const a = opCommun(S, '2026-10-20', -12345), b = opCommun(S, '2026-10-24', -6085);
  assert.equal(ST.get(a.id).statut, 'imprevu');
  assert.equal(ST.get(b.id).statut, 'imprevu');
  assert.equal(ST.get(opCommun(S, '2026-09-15', -3000).id).statut, 'imprevu', 'imprévu, mais au mois précédent');
  assert.equal(ST.get(opCommun(S, '2026-10-21', 5000).id).statut, 'imprevu', 'crédit imprévu (virement ponctuel)');
  // autres débits imprévus du jeu en octobre (s'il y en a) : comptés aussi
  const autres = [...ST].filter(([id, s]) => s.statut === 'imprevu').map(([id]) => S.ops[commun(S).id].find(o => o.id === id))
    .filter(o => o && o.montant < 0 && o.date.slice(0, 7) === '2026-10' && o !== a && o !== b);
  const base = { n: autres.length, c: -autres.reduce((t, o) => t + o.montant, 0) };
  // toutes non vues
  for (const o of S.ops[commun(S).id]) o.vue = 0;
  let g = resume(S);
  assert.deepEqual(g.commun.unplanned, { n: base.n + 2, amount: Math.round(base.c + 18430) / 100, unseen: base.n + 2, last: '2026-10-24' });
  assert.equal(g.v, 1, 'format v1 inchangé');
  assert.deepEqual(alerte(g), { level: 'crit', code: 'COMMUN_UNPLANNED', text: (base.n + 2) + ' DÉBITS IMPRÉVUS · COMMUN' });
  // une seule non vue : texte au singulier
  for (const o of S.ops[commun(S).id]) o.vue = true;
  b.vue = 0;
  g = resume(S);
  assert.equal(g.commun.unplanned.unseen, 1);
  assert.equal(alerte(g).text, '1 DÉBIT IMPRÉVU · COMMUN');
  // toutes vues : plus d'alerte, le champ reste, « unseen » omis
  b.vue = true;
  g = resume(S);
  assert.equal(alerte(g), undefined);
  assert.deepEqual(g.commun.unplanned, { n: base.n + 2, amount: Math.round(base.c + 18430) / 100, last: '2026-10-24' });
  assert.ok(!('unseen' in g.commun.unplanned));
  // aucune opération, aucun libellé ni identifiant dans le résumé
  const t = JSON.stringify(g);
  for (const interdit of ['PLOMBIER', 'VITRIER', 'QUINCAILLERIE', 'DIVERS', a.id, b.id]) assert.ok(!t.includes(interdit), interdit);
});

test('Grafit : correction à la main prévu ↔ imprévu ; aucun débit imprévu : champ absent', async () => {
  const S = await etatDepuisReprise(X, repriseImprevus(), NOW);
  for (const o of S.ops[commun(S).id]) o.vue = true;
  const a = opCommun(S, '2026-10-20', -12345), b = opCommun(S, '2026-10-24', -6085);
  a.vue = 0;
  const n0 = resume(S).commun.unplanned.n;
  // a compté comme prévu à la main : sorti, plus d'alerte
  KC.corriger(a, 'statut', 'prevu');
  let g = resume(S);
  assert.equal(g.commun.unplanned.n, n0 - 1);
  assert.equal(alerte(g), undefined);
  // annulé : de retour
  KC.corriger(a, 'statut', null);
  assert.equal(resume(S).commun.unplanned.n, n0);
  // un débit prévu compté imprévu à la main : ajouté (prêt du jeu, octobre)
  const B = ctx(S), ST = KC.statuts(B);
  const p = S.ops[commun(S).id].find(o => o.montant < 0 && o.date.slice(0, 7) === '2026-10' && ST.get(o.id) && ST.get(o.id).statut === 'prevu');
  assert.ok(p, 'un débit prévu en octobre');
  KC.corriger(p, 'statut', 'imprevu');
  p.vue = 0;
  g = resume(S);
  assert.equal(g.commun.unplanned.n, n0 + 1);
  assert.equal(g.commun.unplanned.unseen, 2);
  // plus aucun débit imprévu ce mois : champ absent (pas de champ vide)
  for (const o of S.ops[commun(S).id]) if (o.montant < 0 && o.date.slice(0, 7) === '2026-10') KC.corriger(o, 'statut', 'prevu');
  g = resume(S);
  assert.ok(!('unplanned' in g.commun));
  assert.equal(alerte(g), undefined);
});

test('Grafit : jeu « mesures » (coffre de démonstration) : au moins un débit imprévu non vu sur le commun', async () => {
  const S = await etatDepuisReprise(X, repriseMesures(FIN), NOW);
  const g = resume(S);
  assert.ok(g.commun.unplanned && g.commun.unplanned.unseen >= 1);
  assert.equal(alerte(g).level, 'crit');
});

// ------------------------------------------------------------ 2. début du suivi des avances
// Reprise fictive : avance ancienne (mai), 343 € impôts (mai), avances d'octobre, déblocage de prêt (octobre).
function repriseAvances() {
  const r = repriseFictive(FIN);
  r.carnet.klad.equilibre.regles.unshift(['DEBLOCAGE', 'dp', 'credit']);
  const add = (date, amount, label) => r.transactions.push({ account: 'r2', date, amount, label, status: 'comptabilisee' });
  add('2026-05-04', 45000, 'VIR PERSONNE A RENFLOUEMENT ANCIEN');
  add('2026-05-11', 41200, 'VIR PERSONNE A IMPOTS 2025');
  add('2026-10-11', 7300, 'VIR PERSONNE A RATTRAPAGE');
  add('2026-10-13', 7300, 'VIR PERSONNE A RENFLOUEMENT');
  add('2026-10-20', 900000, 'VIR BANQUE FICTIVE DEBLOCAGE PRET');
  r.transactions.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  return r;
}
async function etatAffecte() {
  const S = await etatDepuisReprise(X, repriseAvances(), NOW);
  for (const x of KC.ponctuels(ctx(S))) KC.affecter(x.r.o, x.prop);
  return S;
}
const poserDebut = (S, d) => { S.budget.reglages = Object.assign({}, S.budget.reglages); S.budget.reglages.commun = Object.assign({}, S.budget.reglages.commun, { debutAvances: d }); };

test('déblocage de prêt (classé ainsi dans l\'équilibre) : jamais un virement ponctuel à affecter', async () => {
  const S = await etatDepuisReprise(X, repriseAvances(), NOW);
  const P = KC.ponctuels(ctx(S));
  assert.ok(!P.some(x => x.r.m === 900000), 'déblocage absent des virements ponctuels');
  assert.ok(P.some(x => x.r.date === '2026-05-04'), 'sans réglage : l\'avance ancienne est proposée');
});

test('suivi des avances au 01/10 : avant, classement d\'origine (même affecté) ; Impôts gardé ; affectations conservées', async () => {
  const S = await etatAffecte();
  const B0 = ctx(S), A0 = KC.avances(B0), E0 = KC.equilibre(B0), Eb = KC.equilibre(B0, { brut: true });
  assert.deepEqual(json(A0.moi), { avance: 59600, faveur: 29800 }, 'sans réglage : toutes les avances comptent (1.3.0)');
  poserDebut(S, '2026-10-01');
  const B = ctx(S), A = KC.avances(B), E = KC.equilibre(B);
  assert.equal(B.R.commun.debutAvances, '2026-10-01');
  assert.deepEqual(json(A.moi), { avance: 14600, faveur: 7300 }, 'seules les avances d\'octobre');
  assert.equal(E.avances.length, 2);
  assert.ok(E.hors.some(h => h.montant === 41200), 'Impôts 2025 : toujours hors équilibre');
  // l'avance de mai retrouve son classement d'origine : écart avec le brut = seulement Impôts et avances d'octobre
  const r = E.rNE, imp = KC.enveloppes(B).liste.find(e => e.nom === 'Impôts 2025');
  const attendu = -41200 - 14600 + 7300 + imp.utilise * r;
  assert.ok(Math.abs((E.invMoi - Eb.invMoi) - attendu) < 1, 'écart d\'équilibre limité aux lignes voulues');
  assert.ok(E0.invMoi !== E.invMoi);
  // l'affectation reste enregistrée sur l'opération (rien n'est effacé) ; statut et détail l'expliquent
  const old = opCommun(S, '2026-05-04', 45000);
  assert.equal(old.commun.aff.k, 'avance');
  const s = KC.statuts(B).get(old.id);
  assert.equal(s.avant, true);
  assert.match(s.quoi, /avant le suivi des avances/);
  assert.equal(KC.fiche(B, '2026-05').aAffecter, 0, 'rien à affecter avant le suivi');
  assert.ok(!KC.ponctuels(B).some(x => x.r.date === '2026-05-04'), 'plus dans les virements ponctuels');
  const h = Vu.detail(S, old, K.contexte(S, NOW), B);
  assert.match(h, /antérieur au suivi des avances \(01\/10\/2026\)/);
  assert.doesNotMatch(h, /data-a="affecter"/, 'pas d\'affectation proposée');
  // réglage vidé : les affectations comptent de nouveau
  poserDebut(S, undefined);
  assert.deepEqual(json(KC.avances(ctx(S)).moi), json(A0.moi));
});

// ------------------------------------------------------------ 3. migrations
test('migration « suivi des avances » : posée au 01/10/2026 pour un coffre passé par la 1.3.0, une fois ; sinon rien', async () => {
  const S = await etatAffecte();
  assert.deepEqual(json(MG.debutAvances(S, NOW)), { pose: true });
  assert.equal(S.budget.reglages.commun.debutAvances, '2026-10-01');
  assert.equal(MG.debutAvances(S, NOW), null, 'une fois');
  const S2 = await etatDepuisReprise(X, repriseAvances(), NOW);
  assert.deepEqual(json(MG.debutAvances(S2, NOW)), { pose: false }, 'aucune affectation : réglage non posé');
  assert.ok(!(S2.budget.reglages && S2.budget.reglages.commun && S2.budget.reglages.commun.debutAvances));
  // réglage déjà choisi : gardé
  const S3 = await etatAffecte();
  poserDebut(S3, '2026-06-01');
  assert.deepEqual(json(MG.debutAvances(S3, NOW)), { pose: false });
  assert.equal(S3.budget.reglages.commun.debutAvances, '2026-06-01');
});

test('migration « relecture » : historique bancaire relu une fois pour chaque compte Enable Banking', async () => {
  const S = await etatDepuisReprise(X, repriseFictive(FIN), NOW);
  const c = S.modele.comptes[0];
  c.source = Object.assign({}, c.source, { type: 'eb' });
  const n = S.modele.comptes.filter(x => x.source && x.source.type === 'eb').length;
  assert.deepEqual(json(MG.relecture(S, NOW)), { n });
  assert.equal(c.sync.relire, true);
  assert.equal(M.bornesRecuperation(S, c, NOW).from, c.frontiere || null, 'depuis la frontière de reprise');
  assert.equal(MG.relecture(S, NOW), null, 'une fois');
});

test('opération que la banque ne renvoie plus : détail avec la note et « Retirer (opération en double) »', async () => {
  const S = await etatDepuisReprise(X, repriseFictive(FIN), NOW);
  const c = S.modele.comptes.find(x => x.role === 'courant'), o = S.ops[c.id][S.ops[c.id].length - 1];
  const cx = K.contexte(S, NOW);
  assert.doesNotMatch(Vu.detail(S, o, cx, ctx(S)), /retirerop/);
  o.nonRenvoyee = '2026-10-27';
  const h = Vu.detail(S, o, cx, ctx(S));
  assert.match(h, /La banque ne renvoie plus cette opération depuis le 27\/10\/2026\. Elle reste comptée\./);
  assert.match(h, /data-a="retirerop"/);
});
