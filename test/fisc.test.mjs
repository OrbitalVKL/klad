// Tests : impôts du foyer (barème, décote, abattement, prélèvements sociaux, années avis et estimation, partage,
// régularisations), taxe foncière, PEE, livret ; observations, résultats d'une période, répartition (Lot 8).
// Données fictives uniquement.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { charge, json } from './charge.mjs';
import { montantSigne } from './charge.mjs';

const X = charge(['anon.js', 'eb.js', 'format.js', 'modele.js', 'classement.js', 'carnet.js', 'budget.js', 'commun.js', 'fisc.js', 'observations.js', 'ui.js', 'vues.js', 'vbudget.js', 'vcommun.js', 'vfisc.js', 'claude.js', 'mail.js', 'extras.js']);
const { KladModele: M, KladClasse: K, KladBudget: KB, KladFisc: KF, KladObservations: KO, KladVuesFisc: VF, KladExtras: EX } = X;
const NOW = Date.parse('2026-10-28T10:00:00Z');
let n = 0;
const op = (c, date, montant, libelle) => ({ id: c.id + ':t:' + (n++), compte: c.id, date, montant, libelle, statut: 'comptabilisee', source: 'eb', categorie: null, vue: true });
const SANS_SIGNE = h => !montantSigne(String(h).replace(/\d{4}-\d{2}-\d{2}/g, ''));

function etat() {
  const S = M.vide();
  const a = M.nouveauCompte(S, { libelle: 'COURANT', role: 'courant', solde: { centimes: 150000, date: '2026-10-28' } });
  const b = M.nouveauCompte(S, { libelle: 'SECOND', role: 'courant', solde: { centimes: 20000, date: '2026-10-28' } });
  const c = M.nouveauCompte(S, { libelle: 'COMMUN', role: 'commun', solde: { centimes: 300000, date: '2026-10-28' } });
  S.classement = K.nouveau();
  S.classement.regles = [{ mot: 'SALAIRE FICTIF', cat: 'Salaire', sub: 'Salaire', sens: 'credit' }, { mot: 'MARCHE', cat: 'Alimentation', sub: 'Courses' },
    { mot: 'ASSUR', cat: 'Assurances', sub: 'Assurance auto' }, { mot: 'LIVRET', cat: 'Épargne' }, { mot: 'ANCIEN CONTRAT', cat: 'Assurances', sub: 'Ancien contrat' }];
  S.ops[a.id] = [op(a, '2026-08-27', 200000, 'VIR SALAIRE FICTIF'), op(a, '2026-09-27', 200000, 'VIR SALAIRE FICTIF'), op(a, '2026-10-27', 200000, 'VIR SALAIRE FICTIF'),
    op(a, '2026-10-05', -3000, 'CB MARCHE'), op(a, '2026-09-30', -4000, 'CB MARCHE'), op(a, '2026-10-10', -5000, 'PRLV ASSUR'), op(a, '2026-09-10', -5000, 'PRLV ASSUR'),
    op(a, '2026-10-15', -10000, 'VIR LIVRET FICTIF'), op(a, '2026-10-12', -2000, 'PRLV ANCIEN CONTRAT')].sort((x, y) => x.date < y.date ? 1 : -1);
  S.ops[b.id] = [op(b, '2026-08-03', -1500, 'PRLV ABONNEMENT X'), op(b, '2026-09-03', -1500, 'PRLV ABONNEMENT X'), op(b, '2026-10-03', -1500, 'PRLV ABONNEMENT X')];
  S.ops[c.id] = [op(c, '2026-10-15', -76300, 'TAXE FONCIERE FICTIVE')];
  S.budget = KB.nouveau();
  S.budget.plan.perso = { 'c|Alimentation': { on: true, amt: 5000 }, 'f|Assurance auto': { on: true, amt: 5000 }, 'r|Salaire': { mode: 'dernier' } };
  S.budget.contrats = [{ id: 'p1', sc: 'perso', label: 'Ancien contrat fictif', montant: 0, per: 1, motif: 'ANCIEN CONTRAT', poste: 'f|Ancien contrat' }];
  S.budget.fisc = { avis: { 2025: { rev: 2025, parts: 2, sal: { g: 30000, s: 20000 }, ded: { g: 3000, s: 2000 }, fr: { g: false, s: false }, fonc: 820, rcm: 0, rni: 45820, irBar: 2580, decote: 316, prop: 0, cred: 0,
    irNet: 2264, pas: 2400, ps: 142, solde: 6, rfr: 45820, tmi: 11, tmoy: 4.9, per: { g: 3000, s: 2000 } } },
    bs: { b1: { p: 'g', emp: 'Société fictive', m: '2026-01', pay: '2026-01-27', ni: 2600, pas: 140, taux: 5.4, type: 'perso' }, b2: { p: 'g', emp: 'Société fictive', m: '2026-09', pay: '2026-09-27', ni: 2600, pas: 104, taux: 4, type: 'perso' } },
    hyp: Object.assign({}, KF.HYP0), soldeBy: {} };
  S.budget.tf = { surf: 50, ach: '2024-03-01', baseM2: 30, basePk: 0, tCom: 40, tSpe: 1, tTeom: 8, exoCom: 0, reval: 1.5, pg: 50, h2ok: 'oui', avis: { 2026: { total: 763 } } };
  S.budget.livret = { base: 1500, date: '2026-10-01' };
  S.carnet = { klad: { commun: { moi: 'Personne A', autre: 'Personne B' }, livret: { compte: null, motif: 'VIR LIVRET' }, observations: { secondaire: 'r1', principal: 'r0', motifPret: 'ECH PRET' } } };
  S.modele.reprise = { map: { r0: a.id, r1: b.id, r2: c.id } };
  return { S, a, b, c };
}
const ctx = S => KB.contexte(S, NOW);

test('moteur fiscal : barème, décote, abattement de 10 % ou frais réels, prélèvements sociaux, taux individualisés', () => {
  const P = KF.PARAMS[2025];
  const r = json(KF.irCalc(45000, 2, true, P));
  assert.deepEqual([r.q, r.brut, r.dec, r.apres, r.tmi], [22500, 2398, 398, 2000, 11]);
  assert.deepEqual(json(KF.netSal(30000, null, P)), { abat: 3000, net: 27000, fr: false });
  assert.deepEqual(json(KF.netSal(30000, 4000, P)), { abat: 4000, net: 26000, fr: true });
  assert.equal(KF.netSal(3000, null, P).abat, 509);
  const F = KF.foyerCalc({ sal: { g: 30000, s: 20000 }, frais: { g: null, s: null }, fonc: 820, rcm: 0 }, P);
  assert.deepEqual([F.B.rni, F.ps, F.total], [45820, 142, F.B.apres + 142]);
  const T = json(KF.tauxIndiv({ sal: { g: 30000, s: 20000 }, frais: { g: null, s: null } }, F, P));
  assert.equal(T.low, 's');
  assert.ok(T.s <= T.g);
});

test('années : avis (prélèvement réparti), estimation (bulletins, projection, acomptes) ; partage et régularisations sans montant négatif', () => {
  const { S } = etat();
  const Xc = KF.contexte(ctx(S));
  const Ra = KF.annee(Xc, 2025);
  assert.equal(Ra.kind, 'avis');
  assert.equal(Ra.pas.est, true);                       // bulletins incomplets : réparti au prorata des salaires
  assert.equal(Math.round(Ra.pas.g), 1440);
  const Re = KF.annee(Xc, 2026);
  assert.equal(Re.kind, 'est');
  assert.deepEqual([Re.inp.sal.g, Re.nRest, Re.projG], [2600 + 2600 + 2600 * 3, 3, 7800]);
  const SH = KF.partage(Xc, Ra);
  assert.ok(Math.abs(SH.due.g + SH.due.s - Ra.total) < 1);
  const RG = KF.regularisations(Xc);
  assert.deepEqual(json(RG.map(r => r.kind)), ['avis', 'est']);
  for (const r of RG) assert.ok(!/[−-]\s?\d/.test(r.txt || ''), r.txt);
  const h = VF.impots(ctx(S), {});
  assert.match(h, /À régulariser entre vous[\s\S]*Prélèvement à la source[\s\S]*Taxe foncière/);
  assert.ok(SANS_SIGNE(h), 'aucun montant signé');
});

test('taxe foncière : estimation, exonération, avis, paiement retrouvé ; livret ; PEE', () => {
  const { S } = etat();
  const Xc = KF.contexte(ctx(S));
  const R26 = KF.tfAnnee(Xc, 2026);
  assert.deepEqual([R26.kind, R26.total], ['avis', 763]);
  assert.equal(KF.tfPayee(Xc, 2026).length, 1);
  const R27 = KF.tfAnnee(Xc, 2027);
  assert.equal(R27.base, Math.round(1500 * 1.015));
  assert.equal(R27.total, Math.round(R27.base * 41 / 100 * 1.03 + R27.base * 8 / 100 * 1.08));
  S.budget.tf.ach = '2026-03-01';
  assert.equal(KF.tfAnnee(KF.contexte(ctx(S)), 2027).exo, 0);
  S.budget.tf.exoCom = 40;
  assert.equal(KF.tfAnnee(KF.contexte(ctx(S)), 2027).exo, 0.4);
  const L = json(KF.livret(ctx(S)));
  assert.deepEqual([L.centimes, L.n, L.depuis], [160000, 1, '2026-10-15']);
  assert.ok(Math.abs(KF.xirr([['2025-01-01', -1000], ['2026-01-01', 1100]]) - 0.1) < 0.002);
  S.budget.pee = { plan: { emp: 'Société fictive', entree: '2025-01-01', anc: 3, abTaux: 100, abPlaf: 500, dispo: 5 }, fonds: [{ id: 'f1', nom: 'Fonds fictif', cat: 'div', sri: 4, vl: 12 }],
    vers: [{ id: 'v1', d: '2026-02-01', orig: 'vol', fid: 'f1', mt: 300, parts: 30 }, { id: 'v2', d: '2026-02-01', orig: 'abond', fid: 'f1', mt: 300, parts: 30 }] };
  const C = KF.pee(KF.contexte(ctx(S)));
  assert.deepEqual([C.val, C.perso, C.ab, C.volY, C.pv], [720, 300, 300, 300, 120]);
  assert.match(C.conseils[0].t, /Abondement non capté : versez encore 200 €/);
  assert.ok(SANS_SIGNE(VF.epargne(ctx(S))));
});

test('observations : contrat résilié encore prélevé, charges sur un compte secondaire, « c\'est fait » ; résultats ; répartition', () => {
  const { S } = etat();
  const B = ctx(S);
  const A = KO.audit(B);
  const t = A.map(a => a.niveau + ' ' + a.titre);
  assert.ok(t.includes('bad Ancien contrat fictif encore prélevé'), t.join(' | '));
  assert.ok(t.includes('warn Charges récurrentes sur le SECOND'), t.join(' | '));
  const O = KO.observations(B, 'perso');
  const nb = O.faire.length;
  const avant = KO.fait(S, 'Ancien contrat fictif encore prélevé', NOW);
  assert.equal(KO.observations(ctx(S), 'perso').faire.length, nb - 1);
  KO.annulerFait(S, avant);
  assert.equal(KO.observations(ctx(S), 'perso').faire.length, nb);
  // résultats du cycle précédent (27/09 → 26/10) : salaire, courses (dont l'achat du 30/09), assurance, ancien contrat
  const P = KO.periodePrecedente(B, 'perso', null);
  assert.deepEqual([P.start, P.end], ['2026-09-27', '2026-10-26']);
  const R = KO.resultats(B, 'perso', P);
  assert.deepEqual([R.rev, R.G.courante.r, R.G.fixe.r, R.sav], [200000, 7000, 5000 + 2000, 10000]);
  const Rp = KO.repartition(B, 'perso', P.start, P.end);
  assert.equal(Rp.total, 7000 + 7000 + 1500);
  assert.ok(SANS_SIGNE(VF.resultats(B, 'perso', null)));
  assert.ok(SANS_SIGNE(VF.observations(B, 'perso')));
});

test('livret : solde estimé et intérêts par quinzaine (un versement rapporte à partir de la quinzaine suivante)', () => {
  const S = M.vide();
  const a = M.nouveauCompte(S, { libelle: 'COURANT', role: 'courant', solde: { centimes: 100000, date: '2026-10-28' } });
  const l = M.nouveauCompte(S, { libelle: 'LIVRET', role: 'epargne', source: { type: 'manuel' } });
  S.ops[a.id] = [op(a, '2026-10-27', -10000, 'VIR LIVRET FICTIF')];
  S.budget = KB.nouveau();
  S.budget.livret = { base: 1000, date: '2026-01-01' };
  assert.equal(KF.livretInterets(ctx(S)), null);                 // taux inconnu : pas d'estimation
  assert.deepEqual(json(KF.livretCarte(ctx(S))), {});            // compte d'épargne non désigné : rien sur les cartes
  S.budget.livret.taux = 3;
  const L = json(KF.livret(ctx(S)));
  assert.deepEqual([L.centimes, L.n], [110000, 1]);
  // 20 quinzaines à 1 000 €, 4 (novembre, décembre) à 1 100 € : 24 400 × 3 % / 24
  assert.deepEqual(json(KF.livretInterets(ctx(S))), { centimes: 3050, taux: 3, annee: 2026 });
  // carte du compte livret (complément : compte d'épargne désigné)
  S.carnet = { klad: { livret: { epargne: l.id } } };
  const t = json(KF.livretCarte(ctx(S)))[l.id];
  assert.equal(t.centimes, 110000);
  assert.match(t.texte, /≈ 31\s€ en 2026/);
});

test('analyse de Claude des impôts : chiffres du foyer, sans employeur ni nom', () => {
  const { S } = etat();
  const t = EX.agregats(ctx(S), 'impots');
  assert.match(t, /Impôt sur le revenu du foyer, revenus 2026 \(estimation\) : total [\d\s]+ €, déjà prélevé/);
  assert.match(t, /Régularisation/);
  for (const x of ['Société fictive', 'Personne A', 'Personne B']) assert.ok(!t.includes(x), x);
});
