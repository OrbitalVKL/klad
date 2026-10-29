// Tests : relevé de contrôle (klad-controle v1) — construction dans Klad (12 points, centimes, sans IBAN ni clé),
// comparaison de deux relevés (identiques, écart d'entrée, écart de calcul), outil de l'ancienne version (repères,
// identifiants de la reprise, conversion). Données fictives uniquement.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { charge, json } from './charge.mjs';
import { comparer, differences } from '../tools/controle/comparer.mjs';
import { preparerPage, idsReprise, convertir, lireArguments, code, montants, fonctionDette } from '../tools/controle/carnet-controle.mjs';

const X = charge(['anon.js', 'eb.js', 'format.js', 'modele.js', 'classement.js', 'carnet.js', 'budget.js', 'commun.js', 'fisc.js', 'observations.js', 'resume.js', 'controle.js']);
const { KladModele: M, KladClasse: K, KladBudget: KB, KladControle: KT } = X;
const NOW = Date.parse('2026-10-28T10:00:00Z');
let n = 0;
const op = (c, date, montant, libelle, o) => Object.assign({ id: c.id + ':x:k' + String(n++).padStart(4, '0') + '.0', compte: c.id, date, montant, libelle, statut: 'comptabilisee', source: 'reprise', categorie: null, vue: true }, o || {});

function etat() {
  const S = M.vide();
  const a = M.nouveauCompte(S, { libelle: 'COURANT', role: 'courant', solde: { centimes: 150000, date: '2026-10-28' } });
  const c = M.nouveauCompte(S, { libelle: 'COMMUN', role: 'commun', solde: { centimes: 300000, date: '2026-10-28' } });
  S.modele.reprise = { map: { r0: a.id, r2: c.id }, importee: '2026-01-01T00:00:00Z', nb: 0 };
  S.classement = K.nouveau();
  S.classement.regles = [{ mot: 'SALAIRE FICTIF', cat: 'Salaire', sub: 'Salaire', sens: 'credit' }, { mot: 'MARCHE', cat: 'Alimentation', sub: 'Courses' }];
  S.ops[a.id] = [op(a, '2026-09-26', 200000, 'VIR SALAIRE FICTIF PAIE'), op(a, '2026-10-27', 200000, 'VIR SALAIRE FICTIF PAIE'),
    op(a, '2026-10-05', -3000, 'CB MARCHE FICTIF'), op(a, '2026-10-28', -2000, 'CB MARCHE FICTIF'), op(a, '2026-10-28', -999, 'CB EN COURS', { statut: 'en_cours' })]
    .sort((x, y) => (x.date < y.date ? 1 : -1));
  S.ops[c.id] = [op(c, '2026-10-02', 90000, 'VIR APPORT A')];
  S.budget = KB.nouveau();
  S.budget.plan.perso = { 'c|Alimentation': { on: true, amt: 20000 }, 'r|Salaire': { on: true, mode: 'dernier' } };
  S.budget.reglages = { salaire: { motif: 'SALAIRE FICTIF', paie: 'PAIE', min: 1000, minCycle: 500 }, commun: { moi: 'Personne A', autre: 'Personne B' } };
  return S;
}
function releve(S) {
  const cx = K.contexte(S, NOW), B = KB.contexte(S, NOW, cx);
  return json(KT.construire(S, B, cx, NOW, { version: '9.9.9' }));
}

test('relevé de Klad : format, points 1 à 12, centimes, empreinte des opérations, rien de sensible', () => {
  const S = etat();
  S.modele.connexions.s1 = { banque: 'Banque Fictive', pays: 'FR', valid_until: '2027-01-01T00:00:00Z' };
  const r = releve(S);
  assert.deepEqual([r.format, r.v, r.source, r.meta.version, r.meta.aujourdhui], ['klad-controle', 1, 'klad', '9.9.9', '2026-10-28']);
  for (const k of ['comptes', 'resteAVivre', 'budget', 'commun', 'equilibre', 'contrats', 'impots', 'observations', 'aVerifier', 'grafit', 'empreinte']) assert.ok(k in r, k);
  assert.deepEqual(r.comptes.map(c => [c.ref, c.solde, c.date]), [['r0', 150000, '2026-10-28'], ['r2', 300000, '2026-10-28']]);
  const C = r.budget.courant;
  assert.deepEqual([C.debut, C.fin, C.salaire], ['2026-10-27', '2026-11-26', { date: '2026-10-27', montant: 200000 }]);
  assert.deepEqual(C.postes.find(p => p.cle === 'c|Alimentation'), { cle: 'c|Alimentation', section: 'courante', budget: 20000, utilise: 2000, reste: 18000 });
  assert.equal(r.budget.precedent.debut, '2026-09-26');
  // empreinte : ids de la reprise (après « :x: »), opérations en cours comprises (comme le budget), débits et crédits séparés
  const e = r.empreinte.cycles.courant.comptes.find(x => x.ref === 'r0');
  assert.deepEqual([e.nb, e.debits, e.credits], [3, 2999, 200000]);
  assert.deepEqual(e.ops[0], ['k0001.0', '2026-10-27', 200000, 'VIR SALAIRE FICTIF PAIE']);
  assert.equal(r.empreinte.commun.length, 12);
  assert.deepEqual(r.empreinte.commun[11], { mois: '2026-10', nb: 1, debits: 0, credits: 90000, ops: [['k0005.0', '2026-10-02', 90000, 'VIR APPORT A']] });
  const t = JSON.stringify(r);
  for (const x of ['FR76', 'Banque Fictive', 'sk-ant', '"log"']) assert.ok(!t.includes(x), x);
  assert.match(KT.nomFichier(Date.parse('2026-10-28T08:05:00Z')), /^klad-controle-20261028-\d{4}\.json$/);
  assert.deepEqual(json([KT.code('Impôt 2026 : solde ≈ 822 €'), KT.montants('822 € puis 1 234,56 €')]), ['impot-solde', [82200, 123456]]);
});

test('comparaison : relevés identiques, puis écart de calcul (même entrée), puis écart d\'entrée (opération d\'un seul côté)', () => {
  const A = releve(etat());
  const B = json(A); B.source = 'carnet';
  let r = comparer(A, B);
  assert.equal(r.ecarts, 0);
  assert.match(r.texte, /3\. Budget perso \(cycle en cours et précédent\) : identique\./);
  assert.match(r.texte, /11\. Données d'entrée : identiques/);
  // calcul différent : même entrée, total faux d'un côté
  const C = json(B); C.budget.courant.total.utilise += 500;
  r = comparer(A, C);
  assert.equal(r.ecarts, 1);
  assert.match(r.texte, /budget\.courant\.total\.utilise : Klad 29,99 € \/ l'ancienne version 34,99 €/);
  assert.match(r.texte, /même entrée, calcul différent — défaut à corriger/);
  // entrée différente : une opération en plus dans l'autre relevé (d'id différent, même contenu ailleurs apparié)
  const D = json(B), P = D.empreinte.cycles.courant.comptes.find(x => x.ref === 'r0');
  P.ops.push(['k9999.0', '2026-10-28', -1500, 'CB MARCHE FICTIF']); P.nb++; P.debits += 1500;
  D.budget.courant.postes.find(p => p.cle === 'c|Alimentation').utilise += 1500;
  P.ops[0][0] = 'id-banque-fictif';            // même opération, autre identifiant : appariée par date et montant
  r = comparer(A, D);
  assert.match(r.texte, /3\. Budget perso.*: 1 écart\(s\)/);
  assert.match(r.texte, /données d'entrée différentes\.\n    compte r0 : 1 opération\(s\) seulement dans l'ancienne version\n      2026-10-28 +moins 15,00 € +CB MARCHE FICTIF +\(k9999\.0\)/);
  assert.ok(!/id-banque-fictif/.test(r.texte));
  // tolérances : budget arrondi à l'euro de l'ancienne version (50 centimes), montants au centime
  assert.equal(differences({ budget: 20030 }, { budget: 20000 }, 'x').length, 0);
  assert.equal(differences({ utilise: 2002 }, { utilise: 2000 }, 'x').length, 1);
  // valeurs que l'ancienne version ne calcule pas : non comparables, pas des écarts
  const E = json(B); E.grafit = null; E.contrats.echeances31 = null;
  r = comparer(A, E);
  assert.equal(r.ecarts, 0);
  assert.match(r.texte, /10\. Résumé Grafit : non comparable \(absent de l'ancienne version\)/);
  assert.throws(() => comparer(A, { format: 'autre' }), /klad-controle v1 attendu/);
});

test('outil de l\'ancienne version : repères dans la page, identifiants de la reprise, conversion vers klad-controle v1', () => {
  const page = 'const TODAY = new Date().toISOString().slice(0,10);\nfunction drawTrack(){\n  homeRuleBox(); setCols(true);\n' +
    '    grp.forEach(a=>{ if (a.debit===undefined && a.cur-a.pm>5) OVER.push([a, nk]);\n' +
    '  const P=T.fixe.p+T.courante.p+T.optionnelle.p, C=T.fixe.c+T.courante.c+T.optionnelle.c, OUT=T.fixe.out+T.courante.out+T.optionnelle.out, IN=C-OUT;\n' +
    '      const mA=B.v-fixLeft, mA2=mA-varLeft, mB=sal-fixSp, mB2=mB-varSp;\nfunction communCash(){';
  const h = preparerPage(page, '2026-10-28');
  assert.match(h, /const TODAY = '2026-10-28';/);
  assert.match(h, /window\.__go=/);
  assert.throws(() => preparerPage('autre page', '2026-10-28'), /Page non reconnue/);
  // fonction de dette de carte : repérée par son code, son nom n'est écrit nulle part
  assert.equal(fonctionDette('function a(){}\nfunction detteFictive(){ let dP=\'\'; return {v:Math.max(0,1), since:dP, n}; }'), 'detteFictive');
  assert.equal(fonctionDette('rien'), null);
  // ids : 'k' + sha256(date|montant|compte|libellé[0..30]) (20 caractères) + '.' + rang
  const ids = idsReprise([{ date: '2026-10-01', amount: -12.5, acc: 0, label: 'CB FICTIVE' }, { date: '2026-10-01', amount: -12.5, acc: 0, label: 'CB FICTIVE' }]);
  assert.match(ids[0], /^k[0-9a-f]{20}\.0$/);
  assert.equal(ids[1], ids[0].replace(/\.0$/, '.1'));
  assert.deepEqual([code('Eau : prélèvement absent'), montants('soit 1 234,56 €')], ['eau-prelevement-absent', [123456]]);
  // conversion d'une lecture fictive de la page (euros) en relevé (centimes)
  const T = k => ({ p: 200, c: 30.5, left: 169.5 });
  const trk = { T: { fixe: T(), courante: T(), optionnelle: T() }, RT: { p: 2000, c: 2000 }, HB: ['c|Shopping'], cyc: { start: '2026-10-27', end: '2026-11-26' }, pm0: '2026-11', P: 600, C: 91.5, OUT: 0 };
  const L = { starts: [{ date: '2026-09-26', amount: 2000 }, { date: '2026-10-27', amount: 2000 }], bal: [{ acc: 0, at: '2026-10-28T08:00:00Z', a: 1500, d: '2026-10-28' }],
    carte: { v: 40, since: '2026-10-05' }, livret: null, commun: null, eq: null, contrats: [{ sc: 'perso', label: 'Contrat fictif', key: 'f|Assurance', amt: 50, per: 1, last: '2026-10-10' }],
    fisc: null, audit: [{ lvl: 'warn', sc: 'perso', t: 'Eau : prélèvement absent', p: '' }], av: { nonVues: 2, nonClassees: 1 },
    rows: [{ date: '2026-10-27', acc: 0, amount: 2000, label: 'VIR SALAIRE FICTIF' }] };
  const r = convertir(L, { trk, G: [{ key: 'c|Alimentation', nat: 'courante', pm: 200, cur: 30.5 }, { key: 'c|Shopping', nat: 'hb', pm: 0, cur: 12 }], rav: null }, null, null, '2026-10-28', 'x');
  assert.equal(r.source, 'carnet');
  assert.deepEqual(r.budget.courant.salaire, { date: '2026-10-27', montant: 200000 });
  assert.deepEqual(r.budget.courant.postes, [{ cle: 'c|Alimentation', section: 'courante', budget: 20000, utilise: 3050, reste: 16950 }, { cle: 'c|Shopping', section: 'hors_budget', budget: 0, utilise: 1200, reste: -1200 }]);
  assert.equal(r.budget.courant.horsBudget, 1200);
  assert.deepEqual(r.comptes, [{ ref: 'r0', libelle: null, role: null, solde: 150000, date: '2026-10-28', dette: null, prelevement: null },
    { ref: 'r3', libelle: null, role: null, solde: null, date: null, dette: 4000, prelevement: null }]);
  assert.equal(r.contrats.liste[0].prochaine, '2026-11-10');
  assert.equal(r.empreinte.cycles.courant.comptes[0].ops[0][0], idsReprise(L.rows)[0]);
  assert.deepEqual(lireArguments(['--html', 'p.html', '--etat', 'e.json', '--imports', 'a.json', 'b.json', '--date', '2026-10-28']), { imports: ['a.json', 'b.json'], html: 'p.html', etat: 'e.json', date: '2026-10-28' });
  assert.throws(() => lireArguments(['--html', 'p.html']), /Usage/);
});
