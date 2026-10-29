// Tests : compte commun (Lot 7) — virements reçus, fin de mois estimée et réserve, trésorerie sur 12 mois, virements à
// mettre en place, appels de fonds, équilibre des apports et simulation, résumé Grafit « commun », rendu sans montant
// signé. Données fictives uniquement.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { charge, json, montantSigne } from './charge.mjs';

const X = charge(['anon.js', 'eb.js', 'format.js', 'modele.js', 'classement.js', 'carnet.js', 'budget.js', 'commun.js', 'resume.js', 'ui.js', 'vues.js', 'vbudget.js', 'vcommun.js']);
const { KladModele: M, KladClasse: K, KladBudget: KB, KladCommun: KC, KladResume: R, KladVuesCommun: VC, KladVuesBudget: VB } = X;
const NOW = Date.parse('2026-10-28T10:00:00Z');
let n = 0;
const op = (c, date, montant, libelle) => ({ id: c.id + ':t:' + (n++), compte: c.id, date, montant, libelle, statut: 'comptabilisee', source: 'eb', categorie: null, vue: true });

function etat() {
  const S = M.vide();
  const c = M.nouveauCompte(S, { libelle: 'COMMUN', role: 'commun', solde: { centimes: 100000, date: '2026-10-28' } });
  S.classement = K.nouveau();
  S.classement.categories['Apports compte commun'] = { nature: 'revenu', icone: '📥' };
  S.classement.regles = [{ mot: 'APPORT A', cat: 'Apports compte commun', sub: 'Personne A' }, { mot: 'APPORT B', cat: 'Apports compte commun', sub: 'Personne B' },
    { mot: 'EMPRUNT', cat: 'Crédits', sub: 'Prêt' }, { mot: 'SYNDIC', cat: 'Logement', sub: 'Charges de copropriété' }];
  S.ops[c.id] = [op(c, '2026-07-06', -45000, 'PRLV SYNDIC FICTIF'), op(c, '2026-10-02', 80000, 'VIR APPORT A'), op(c, '2026-10-03', 60000, 'VIR APPORT B'), op(c, '2026-10-05', -120000, 'ECH EMPRUNT FICTIF')]
    .sort((x, y) => x.date < y.date ? 1 : -1);
  S.budget = KB.nouveau();
  S.budget.plan.commun = { 'f|Prêt': { on: true, amt: 120000, pg: 60, elig: true }, 'f|Charges de copropriété': { on: true, amt: 15000, per: 3, ech: 45000, pg: 50, elig: true } };
  S.budget.virements = [{ id: 'v1', qui: 'moi', montant: 80000, jour: 2, usage: 'credit', label: 'Apport A' }, { id: 'v2', qui: 'autre', montant: 60000, jour: 3, usage: 'tout', label: 'Apport B' }];
  S.budget.appels = { H: { lab: 'Copropriété fictive', to: 'SYNDIC FICTIF', items: [['2026-07-01', 'charges', 450], ['2026-10-01', 'charges', 450]] } };
  S.carnet = { klad: { commun: { moi: 'Personne A', autre: 'Personne B' }, appels: { motif: 'SYNDIC', ordre: ['H'], H: 'SYNDIC' },
    equilibre: { apport: { moi: 1000, autre: 3000 }, regles: [['APPORT B', 'vs', 'credit'], ['APPORT A', 'vg', 'credit'], ['EMPRUNT', 'pc', 'debit'], ['SYNDIC', 'ch', 'debit'], ['.', 'ot', 'debit']],
      ops: [['2026-01-02', 'VIR APPORT A', 800, 'vg']], equip: [['2026-02-01', 'Meuble fictif', '', 100, 0, true], ['2026-03-01', 'Lampe fictive', '', 0, 50, false]] } } };
  return { S, c };
}
const ctx = S => KB.contexte(S, NOW);

test('virements reçus ; fin de mois estimée (réserve pour échéances) ; marge réelle', () => {
  const { S } = etat();
  const B = ctx(S);
  assert.equal(KC.virementVu(B, S.budget.virements[0], '2026-10').date, '2026-10-02');
  assert.equal(KC.virementVu(B, S.budget.virements[1], '2026-10').date, '2026-10-03');
  assert.equal(KC.virementVu(B, S.budget.virements[0], '2026-09'), null);
  assert.deepEqual(json(KC.finDeMois(B)), { solde: 100000, due: 0, inc: 0, reserve: 30000, reserveDet: [{ label: 'Charges de copropriété', montant: 30000 }], end: 70000, aVenir: [], decouvert: false });
  const m = KC.margeReelle(B);
  assert.equal(m.solde, 100000);
  assert.equal(m.marge, 100000 - m.fixes - m.variable);
});

test('trésorerie sur 12 mois : point bas, échéances trimestrielles ; virements à mettre en place', () => {
  const { S } = etat();
  const C = json(KC.tresorerie(ctx(S)));
  assert.equal(C.months.length, 12);
  assert.deepEqual([C.start, C.min, C.minAt, C.negAt], [100000, 55000, '2026-10-05', '']);
  assert.deepEqual(C.months.slice(0, 4).map(m => m.end), [55000, 75000, 95000, 70000]);
  assert.deepEqual(C.due.map(d => d.m), ['2026-10', '2027-01', '2027-04', '2027-07']);
  const P = json(KC.plan(ctx(S)));
  assert.equal(P.pon, 0);
  assert.deepEqual(P.changes.map(x => [x.qui, x.usage, x.have, x.want]), [['moi', 'copro', 0, 7500]]);
  // un découvert prévu → virement ponctuel réparti au prorata des charges non mensuelles
  S.modele.comptes[0].solde.centimes = 10000;
  const P2 = json(KC.plan(ctx(S)));
  assert.equal(P2.C.min, -35000);
  assert.deepEqual([P2.pon, P2.ponMoi, P2.ponAutre], [35000, 18000, 17000]);
});

test('appels de fonds : chaque virement règle l\'appel le plus ancien ; reste à payer', () => {
  const { S } = etat();
  const A = json(KC.appels(ctx(S))).H;
  assert.deepEqual([A.totA, A.totP, A.reste, A.impayes.length, A.retard.length], [90000, 45000, 45000, 1, 1]);
  assert.deepEqual(A.items.map(it => [it.d, it.paid]), [['2026-07-01', 45000], ['2026-10-01', 0]]);
});

test('équilibre des apports : investi, écart, rattrapage, date, simulation, équipements', () => {
  const { S } = etat();
  let R0 = KC.equilibre(ctx(S));
  assert.deepEqual([R0.invMoi, R0.invAutre, R0.ecart, R0.mensMoi, R0.mensAutre, R0.rythme, R0.mois, R0.dateEquilibre], [270000, 360000, 90000, 79500, 55500, 24000, 4, '2027-02']);
  assert.deepEqual(json(KC.simuler(R0, 6000, 0)), { mois: 3, date: '2027-01', gain: 1 });
  assert.equal(KC.simuler(R0, 0, 100000).immediat, true);
  const avant = KC.basculerEquipement(S, 'p1', true);
  assert.equal(KC.equilibre(ctx(S)).invAutre, 365000);
  KC.annulerEquilibre(S, avant);
  KC.ajouterEquipement(S, { label: 'Store fictif', date: '2026-10-01', moi: 0, autre: 20000 });
  assert.equal(KC.equilibre(ctx(S)).invAutre, 380000);
  const h = VC.equilibre(ctx(S), {});
  assert.match(h.replace(/<[^>]+>/g, ' '), /Reste à combler\s+1\s100\s€\s+Personne A doit encore investir de plus que Personne B/);
  assert.ok(!montantSigne(h));
});

test('rendu du périmètre Commun et résumé Grafit « commun » ; import du carnet', () => {
  const { S } = etat();
  const B = ctx(S);
  const h = VB.ravM(B, 'commun', {}) + VC.plan(B, { cartes: new Set(['cm|cash', 'cm|why']) }) + VB.suivi(B, 'commun', {}).html;
  assert.match(h, /Marge réelle du commun[\s\S]*Virements à mettre en place[\s\S]*Appels de fonds[\s\S]*Trésorerie · 12 mois[\s\S]*D'où vient le solde/);
  assert.ok(!montantSigne(h), 'aucun montant signé');
  // nom de la résidence et du syndic : données du complément seulement
  S.carnet.klad.appels.titre = 'Résidence fictive'; S.carnet.klad.appels.syndic = 'Syndic fictif';
  const h2 = VC.plan(ctx(S), { cartes: new Set(['cm|ap']) });
  assert.match(h2, /Appels de fonds Résidence fictive/);
  assert.match(h2, /Syndic fictif/);
  delete S.carnet.klad.appels.titre; delete S.carnet.klad.appels.syndic;
  const r = json(R.construire(S, NOW, {}));
  assert.deepEqual(r.commun, { balance: 1000, debits_due: 0, transfers_expected: 0, reserve: 300, end_of_month: 700, overdraft_risk: false,
    due: [{ month: '2026-10', amount: -450, late: false }, { month: '2027-01', amount: -450, late: false }] });
  assert.ok(!r.alerts.some(a => a.code === 'OVERDRAFT_RISK'));
  // découvert prévu sous 31 jours : « crit »
  S.modele.comptes[0].solde.centimes = 10000;
  const r2 = json(R.construire(S, NOW, {}));
  assert.equal(r2.commun.overdraft_risk, true);
  assert.deepEqual(r2.alerts.find(a => a.code === 'OVERDRAFT_RISK'), { level: 'crit', code: 'OVERDRAFT_RISK', text: 'COMPTE COMMUN · 05/10' });
});

test('découvert du commun gradué : « crit » sous 31 jours, « caut » plus tard dans les 12 mois, rien sinon', () => {
  const { S, c } = etat();
  // échéance annuelle fictive prélevée en décembre : le compte passe sous zéro le 05/12
  S.budget.plan.commun['f|Taxe fictive'] = { on: true, amt: 20000, per: 12, ech: 240000, pg: 50, elig: true };
  S.classement.regles.push({ mot: 'TAXE FICTIVE', cat: 'Logement', sub: 'Taxe fictive' });
  S.ops[c.id].push(op(c, '2025-12-10', -240000, 'PRLV TAXE FICTIVE'));
  assert.deepEqual(json(KC.risqueDecouvert(ctx(S))), { date: '2026-12-05', jours: 38, niveau: 'caut' });
  let r = json(R.construire(S, NOW, {}));
  assert.equal(r.commun.overdraft_risk, true);
  assert.deepEqual(r.alerts.find(a => a.code === 'OVERDRAFT_RISK'), { level: 'caut', code: 'OVERDRAFT_RISK', text: 'COMPTE COMMUN · 05/12' });
  // le même découvert vu le 10/11 : 25 jours → « crit »
  const N2 = Date.parse('2026-11-10T10:00:00Z');
  assert.equal(KC.risqueDecouvert(KB.contexte(S, N2)).niveau, 'crit');
  r = json(R.construire(S, N2, {}));
  assert.equal(r.alerts.find(a => a.code === 'OVERDRAFT_RISK').level, 'crit');
  // sans l'échéance : aucun découvert, aucune alerte
  delete S.budget.plan.commun['f|Taxe fictive'];
  assert.equal(KC.risqueDecouvert(ctx(S)), null);
  assert.ok(!json(R.construire(S, NOW, {})).alerts.some(a => a.code === 'OVERDRAFT_RISK'));
});

test('import du carnet : appels et équilibre, une fois', () => {
  // import : appels et équilibre du carnet, une fois (version du bloc budget → 2)
  const S2 = M.vide();
  S2.budget = KB.nouveau();
  const rep = KC.importer(S2, { appels: { H: { items: [['2026-01-01', 'charges', 10]] } }, eq: { equip: { 1: true } }, eqItems: [{ id: 'o1', label: 'Fictif', g: 12.5, s: 0 }] });
  assert.deepEqual(json(rep), { appels: 1, equipements: 1 });
  assert.equal(S2.budget.v, 2);
  assert.deepEqual(json(S2.budget.equilibre), { equip: { 1: true }, items: [{ id: 'o1', date: '', label: 'Fictif', moi: 1250, autre: 0, on: true, src: 'manuel' }] });
});
