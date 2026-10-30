// Tests : budget par cycle (Lot 6) — import du carnet, cycle de salaire (en avance, en retard, absent), date de dépense
// des cartes, sections et totaux, hors budget et épargne exclus, reste à vivre en deux colonnes, échéances, tendance,
// édition annulable, résumé Grafit (month, upcoming, BUDGET_OVER) sans motif interdit. Données fictives uniquement.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { charge, json, montantSigne } from './charge.mjs';
import { repriseFictive } from './fictif.mjs';

const X = charge(['anon.js', 'eb.js', 'format.js', 'modele.js', 'reprise.js', 'classement.js', 'carnet.js', 'budget.js', 'resume.js', 'ui.js', 'vues.js', 'vbudget.js']);
const { KladModele: M, KladClasse: K, KladBudget: KB, KladResume: R, KladReprise: RP, KladCarnet: CN, KladVuesBudget: VB } = X;
const NOW = Date.parse('2026-10-28T10:00:00Z');
let n = 0;
const op = (c, date, montant, libelle) => ({ id: c.id + ':t:' + (n++), compte: c.id, date, montant, libelle, statut: 'comptabilisee', source: 'eb', categorie: null, vue: true });

// Petit état fictif : courant (salaire le 27, en avance le 26 en septembre), carte, commun, épargne.
function etat(opts = {}) {
  const S = M.vide();
  S.modele.connexions.s1 = { banque: 'Banque Fictive du Nord', pays: 'FR', valid_until: '2027-01-01T00:00:00Z' };
  const a = M.nouveauCompte(S, { libelle: 'COURANT', role: 'courant', solde: { centimes: 150000, date: '2026-10-28' } });
  const c = M.nouveauCompte(S, { libelle: 'COMMUN', role: 'commun', solde: { centimes: 300000, date: '2026-10-28' } });
  const k = M.nouveauCompte(S, { libelle: 'CARTE', role: 'carte_differee', prelevement: { compte: a.id, jour: 5, motif: 'PRLV CARTE' } });
  const e = M.nouveauCompte(S, { libelle: 'LIVRET', role: 'epargne', solde: { centimes: 500000, date: '2026-10-28' } });
  S.classement = K.nouveau();
  S.classement.categories['Projet'] = { nature: 'hors_budget', icone: '🔑' };
  S.classement.categories['Apports compte commun'] = { nature: 'revenu', icone: '📥' };
  S.classement.regles = [
    { mot: 'SALAIRE FICTIF', cat: 'Salaire', sub: 'Salaire', sens: 'credit' }, { mot: 'MARCHE', cat: 'Alimentation', sub: 'Courses' },
    { mot: 'BAR ', cat: 'Bars', sub: 'Bars' }, { mot: 'ASSUR', cat: 'Assurances', sub: 'Assurance auto' }, { mot: 'NOTAIRE', cat: 'Projet' },
    { mot: 'LIVRET', cat: 'Épargne' }, { mot: 'EMPRUNT', cat: 'Crédits', sub: 'Prêt' }, { mot: 'APPORT A', cat: 'Apports compte commun', sub: 'Personne A' },
    { mot: 'APPORT B', cat: 'Apports compte commun', sub: 'Personne B' }];
  const sal = opts.salaires || ['2026-08-27', '2026-09-26', '2026-10-27'];
  S.ops[a.id] = [
    ...sal.map(d => op(a, d, 200000, 'VIR SALAIRE FICTIF PAIE')),
    op(a, '2026-08-10', -5000, 'PRLV ASSUR AUTO FICTIVE'), op(a, '2026-09-10', -5000, 'PRLV ASSUR AUTO FICTIVE'), op(a, '2026-10-10', -5000, 'PRLV ASSUR AUTO FICTIVE'),
    op(a, '2026-10-28', -1200, 'CARTE 25/10 MARCHE FICTIF'),        // payé le 25/10 : cycle précédent
    op(a, '2026-10-27', -3000, 'CB MARCHE FICTIF'), op(a, '2026-10-27', -2000, 'CB BAR DU PORT'), op(a, '2026-10-28', -7000, 'CB BAR DU PORT'),
    op(a, '2026-10-27', -100000, 'VIR NOTAIRE FICTIF'), op(a, '2026-10-27', -10000, 'VIR LIVRET FICTIF'),
    op(a, '2026-10-05', -1500, 'PRLV CARTE FICTIVE')];
  S.ops[k.id] = [op(k, '2026-10-01', -1500, 'ACHAT FICTIF UN'), op(k, '2026-10-15', -4000, 'ACHAT FICTIF DEUX')];
  S.ops[c.id] = [op(c, '2026-10-02', 90000, 'VIR APPORT A'), op(c, '2026-10-03', 60000, 'VIR APPORT B'), op(c, '2026-10-05', -120000, 'ECH EMPRUNT FICTIF'),
    op(c, '2026-09-02', 90000, 'VIR APPORT A'), op(c, '2026-09-03', 60000, 'VIR APPORT B'), op(c, '2026-09-05', -120000, 'ECH EMPRUNT FICTIF')];
  S.ops[e.id] = [];
  for (const id of Object.keys(S.ops)) S.ops[id].sort((x, y) => x.date < y.date ? 1 : -1);
  S.budget = KB.nouveau();
  S.budget.plan.perso = { 'c|Alimentation': { on: true, amt: 20000 }, 'c|Bars': { on: true, amt: 5000 }, 'f|Assurance auto': { on: true, amt: 5000 }, 'r|Salaire': { on: true, mode: 'dernier' } };
  S.budget.plan.commun = { 'f|Prêt': { on: true, amt: 120000, pg: 60 } };
  S.budget.ref = '2026-05';
  S.budget.contrats = [{ id: 'p1', sc: 'perso', label: 'Assurance auto fictive', montant: 5000, per: 1, motif: 'ASSUR AUTO', poste: 'f|Assurance auto', src: '', note: '' }];
  S.budget.reglages = { salaire: { motif: 'SALAIRE FICTIF', paie: 'PAIE', min: 1000, minCycle: 500 }, commun: { moi: 'Personne A', autre: 'Personne B' } };
  return { S, a, c, k, e };
}
const ctx = (S, now = NOW) => KB.contexte(S, now);

test('import du carnet : postes en centimes, périodicités, renommages, contrats et virements', async () => {
  const rep = RP.valider(repriseFictive('2026-10-28'));
  const S = M.vide();
  const choix = {}; for (const r of rep.comptes) choix[r.ref] = 'creer';
  RP.appliquer(S, rep, choix, { now: NOW });
  await CN.convertir(S, S.carnet, { now: NOW });
  const r = KB.importer(S, S.carnet, { now: NOW, renommer: CN.renommeur(S.carnet) });
  assert.deepEqual([r.contrats, r.virements], [4, 2]);
  assert.deepEqual(json(S.budget.plan.perso['f|Services en ligne']), { on: true, amt: 1299 });
  assert.deepEqual(json(S.budget.plan.commun['f|Charges de copropriété']), { on: true, amt: 15000, per: 3, ech: 45000, pg: 50, elig: true });
  assert.deepEqual(json(S.budget.plan.perso['r|Salaire']), { on: true, mode: 'dernier' });
  assert.equal(S.budget.ref, '2026-04');
  assert.deepEqual(json(S.budget.virements.map(v => [v.qui, v.montant, v.jour])), [['moi', 80000, 2], ['autre', 60000, 3]]);
  assert.equal(S.budget.contrats[1].per, 3);
  // les réglages du salaire viennent du complément (carnet.klad) : compte r0 → compte Klad
  const B = ctx(S);
  assert.equal(B.R.salaire.compte, S.modele.reprise.map.r0);
  assert.equal(B.R.commun.moi, 'Personne A');
  // renommages de l'ancienne version (catégories du budget)
  assert.equal(CN.renommeur({ cats: { renamed: { 'Ancien': 'Nouveau' } } })('Ancien'), 'Nouveau');
  assert.equal(CN.renommeur({})('Soins & divers'), 'Santé');
  // le bloc « budget » fait l'aller-retour
  const b = M.versBlocs(S);
  assert.deepEqual(json(M.depuisBlocs(JSON.parse(JSON.stringify(b))).budget), json(S.budget));
});

test('cycle de salaire : début au dernier salaire, salaire en avance, en retard (cycle prolongé), absent (mois civil)', () => {
  const { S } = etat();
  let B = ctx(S);
  const cur = KB.cycleCourant(B);
  assert.deepEqual([cur.start, cur.end], ['2026-10-27', '2026-11-26']);
  assert.deepEqual(json(KB.debuts(B).map(r => r.date)), ['2026-08-27', '2026-09-26', '2026-10-27']);
  const p = KB.periode(B, 'perso', '2026-09-26');
  assert.deepEqual([p.start, p.end, p.past, p.prev, p.next], ['2026-09-26', '2026-10-26', true, '2026-08-27', 'courant']);
  assert.equal(KB.periode(B, 'perso', null).prev, '2026-09-26');
  // en retard : pas de nouveau salaire au 29/11 → le cycle en cours va jusqu'à aujourd'hui
  B = ctx(S, Date.parse('2026-11-29T10:00:00Z'));
  assert.deepEqual([KB.cycleCourant(B).start, KB.cycleCourant(B).end], ['2026-10-27', '2026-11-29']);
  // sans critère d'employeur : la catégorie Salaire suffit
  delete S.budget.reglages;
  assert.equal(KB.cycleCourant(ctx(S)).start, '2026-10-27');
  // sans salaire : mois civil
  const s2 = etat({ salaires: [] }).S;
  const p2 = KB.periode(ctx(s2), 'perso', null);
  assert.deepEqual([p2.cyc, p2.start, p2.end, p2.salaire], [null, '2026-10-01', '2026-10-31', false]);
  // commun : toujours le mois civil
  const p3 = KB.periode(ctx(S), 'commun', null);
  assert.deepEqual([p3.start, p3.end, p3.prev], ['2026-10-01', '2026-10-31', '2026-09']);
});

test('suivi du cycle : sections, date de dépense des cartes, hors budget et épargne exclus, revenus, états', () => {
  const { S } = etat();
  const s = KB.suivi(ctx(S), 'perso', null);
  assert.deepEqual([s.T.fixe.p, s.T.fixe.c, s.T.courante.p, s.T.courante.c, s.T.optionnelle.p, s.T.optionnelle.c], [5000, 0, 20000, 3000, 5000, 9000]);
  assert.deepEqual(json(s.total), { P: 30000, C: 12000, IN: 8000, OUT: 4000 });
  assert.deepEqual([s.revenus.p, s.revenus.c], [200000, 200000]);
  const bars = s.sections.optionnelle.lignes.find(a => a.key === 'c|Bars');
  assert.equal(bars.etat.texte, 'dépassé');
  assert.equal(s.sections.fixe.lignes[0].etat.texte, 'à venir · le 10/11');
  assert.deepEqual(json(s.depasses.map(a => a.key)), ['c|Bars']);
  // cycle précédent : l'achat carte payé le 25/10 (enregistré le 28/10) y est compté ; la carte (sans budget) est hors budget
  const p = KB.suivi(ctx(S), 'perso', '2026-09-26');
  assert.equal(p.sections.courante.lignes.find(a => a.key === 'c|Alimentation').cur, 1200);
  assert.equal(p.sections.fixe.lignes[0].etat.texte, 'prélevé');
  assert.deepEqual(json(p.horsBudget.lignes.map(a => [a.key, a.cur])), [['c|Shopping', 5500]]);
  assert.equal(p.total.C, 1200 + 5000 + 5500);
  // commun : apports attendus selon la répartition (60 % / 40 %)
  const c = KB.suivi(ctx(S), 'commun', null);
  assert.deepEqual(json(c.revenus.lignes.map(x => [x.key, x.got, x.pm])), [['Personne A', 90000, 72000], ['Personne B', 60000, 48000]]);
  assert.equal(c.sections.fixe.lignes[0].etat.texte, 'prélevé');
  // rendu : aucun montant signé
  const h = VB.suivi(ctx(S), 'perso', { ouverts: new Set(['c|Bars']) }).html;
  assert.ok(!montantSigne(h), 'aucun montant négatif affiché');
  assert.match(h.replace(/<[^>]+>/g, ' '), /Dépassé de\s+40\s€/);
});

test('reste à vivre : deux colonnes (dernier salaire, comptes courants)', () => {
  const { S } = etat();
  const r = KB.suivi(ctx(S), 'perso', null).rav;
  assert.deepEqual(json(r.budget), { base: 200000, fixes: 0, marge: 200000, variable: 12000, reste: 188000, date: '2026-10-27' });
  assert.deepEqual(json(r.comptes), { base: 150000, fixes: 5000, marge: 145000, variable: 17000, reste: 128000 });
  assert.deepEqual([r.base, r.valeur, r.fin], ['accounts', 128000, '2026-11-26']);
  // sans solde connu : colonne « dernier salaire » seulement
  for (const c of S.modele.comptes) delete c.solde;
  const r2 = KB.suivi(ctx(S), 'perso', null).rav;
  assert.deepEqual([r2.comptes, r2.base, r2.valeur], [null, 'budget', 188000]);
  assert.ok(!montantSigne(VB.detailRav(r)));
  // 0.10.7 : choix d'une colonne, aucun calcul ; le détail montre toujours les deux colonnes
  assert.deepEqual(json(KB.ravChoisi(r, 'salaire')), { choix: 'salaire', col: json(r.budget), autre: json(r.comptes), base: 'budget' });
  assert.deepEqual(json(KB.ravChoisi(r, 'comptes')), { choix: 'comptes', col: json(r.comptes), autre: json(r.budget), base: 'accounts' });
  assert.equal(KB.ravChoisi(r2, 'comptes').choix, 'salaire');
  for (const b of ['salaire', 'comptes']) {
    const h = VB.detailRav(r, b);
    assert.match(h, /Dernier salaire[\s\S]*Comptes courants/);
    assert.match(h, new RegExp('data-ravbase="' + b + '" aria-pressed="true"'));
  }
  assert.match(VB.carteRav(r), /Reste à vivre jusqu'au 26\/11/);
});

test('échéances sur 31 jours : contrat, prélèvement récurrent détecté, carte à débit différé au jour du prélèvement ; contrats comparés au relevé', () => {
  const { S } = etat();
  const E = json(KB.echeances(ctx(S), 31));
  assert.deepEqual(E.map(e => [e.date, e.montant, e.sorte]), [['2026-11-05', 120000, 'recurrent'], ['2026-11-05', 4000, 'carte'], ['2026-11-10', 5000, 'contrat']]);
  const C = json(KB.contrats(ctx(S), 'perso'));
  assert.deepEqual([C[0].etat.texte, C[0].prochaine, C[0].dernier.date], ['conforme', '2026-11-10', '2026-10-10']);
});

test('tendance : dépenses par cycle, par nature et par catégorie', () => {
  const { S } = etat();
  const T = json(KB.tendance(ctx(S), 'perso', 12));
  assert.equal(T.parCycle, true);
  assert.deepEqual(T.periodes.map(p => [p.start, p.total]), [['2026-08-27', 5000], ['2026-09-26', 11700], ['2026-10-27', 12000]]);
  const T2 = json(KB.tendance(ctx(S), 'perso', 12, 'Bars'));
  assert.deepEqual([T2.periodes[2].cat, T2.budget], [9000, 5000]);
  assert.equal(json(KB.tendance(ctx(S), 'commun', 12)).periodes.length, 12);
});

test('édition d\'un poste : montant, périodicité, retrait et ajout, annulation', () => {
  const { S } = etat();
  let snap = KB.modifier(S, 'perso', 'c|Bars', { amt: 12000 });
  assert.equal(KB.suivi(ctx(S), 'perso', null).sections.optionnelle.lignes.find(a => a.key === 'c|Bars').pm, 12000);
  KB.annuler(S, snap);
  assert.deepEqual(json(S.budget.plan.perso['c|Bars']), { on: true, amt: 5000 });
  snap = KB.modifier(S, 'perso', 'f|Assurance auto', { amt: 60000, per: 12 });
  assert.deepEqual(json(S.budget.plan.perso['f|Assurance auto']), { on: true, amt: 5000, ech: 60000, per: 12 });
  KB.annuler(S, snap);
  snap = KB.retirer(S, 'perso', 'c|Bars');
  const s = KB.suivi(ctx(S), 'perso', null);
  assert.ok(s.horsBudget.lignes.some(a => a.key === 'c|Bars'));
  KB.annuler(S, snap);
  assert.ok(KB.ajoutables(ctx(S), 'perso', 'courante').some(x => x.key === 'c|Carburant'));
});

test('résumé Grafit : month, left_to_live, upcoming, BUDGET_OVER ; aucun motif interdit', () => {
  const { S } = etat();
  S.budget.contrats[0].label = 'Assurance NORD 1234567';
  const r = json(R.construire(S, NOW, {}));
  assert.deepEqual(r.month, { cycle: 'salary', from: '2026-10-27', to: '2026-11-26', spent: 120, budget: 300, left: 180, income: 2000,
    top: [{ label: 'BARS', spent: 90, budget: 50 }, { label: 'ALIMENTATION', spent: 30, budget: 200 }, { label: 'ASSURANCE AUTO', spent: 0, budget: 50 }],
    left_to_live: 1880, left_to_live_basis: 'budget' });
  // 0.10.7 : base choisie par le propriétaire (Réglages › Budget) ; « dernier salaire » par défaut
  assert.equal(KB.baseRav(S), 'salaire');
  KB.choisirBaseRav(S, 'comptes');
  assert.deepEqual(json(S.budget.reglages).rav, 'comptes');
  const r2 = json(R.construire(S, NOW, {}));
  assert.deepEqual([r2.month.left_to_live, r2.month.left_to_live_basis], [1280, 'accounts']);
  // sans solde connu, la colonne « comptes courants » n'existe pas : dernier salaire
  const soldes = S.modele.comptes.map(c => c.solde);
  for (const c of S.modele.comptes) delete c.solde;
  const r3 = json(R.construire(S, NOW, {}));
  assert.deepEqual([r3.month.left_to_live, r3.month.left_to_live_basis], [1880, 'budget']);
  S.modele.comptes.forEach((c, i) => { c.solde = soldes[i]; });
  KB.choisirBaseRav(S, 'salaire');
  assert.deepEqual(r.upcoming, [{ date: '2026-11-05', label: 'PRET', amount: -1200, kind: 'recurring' }, { date: '2026-11-05', label: 'CARTE', amount: -40, kind: 'card' }, { date: '2026-11-10', label: 'ASSURANCE AUTO', amount: -50, kind: 'contract' }]);
  assert.deepEqual(r.alerts.filter(a => a.code === 'BUDGET_OVER'), [{ level: 'caut', code: 'BUDGET_OVER', text: 'BARS +80 %' }]);
  // identifiants de comptes : tirés au hasard (8 caractères), ils peuvent contenir 5 chiffres de suite
  const txt = JSON.stringify(Object.assign({}, r, { generated: 0, accounts: r.accounts.map(a => Object.assign({}, a, { id: '' })) }));
  for (const motif of [/FR\d{2}/, /\d{5,}/, /NORD/, /FICTI/, /PRLV/, /@/]) assert.ok(!motif.test(txt), String(motif));
});

// ------------------------------------------------------------ Lot 9 : fonctions de l'ancienne version reprises
test('tendance : revenus, dépenses et balance par mois ; une catégorie face à son budget', () => {
  const { S } = etat();
  const T = json(KB.tendanceMois(ctx(S), { scope: 'perso', from: '2026-08', to: '2026-10', mode: 'rd' }));
  assert.deepEqual(T.mois, ['2026-08', '2026-09', '2026-10']);
  assert.deepEqual(T.rev, [200000, 200000, 200000]);
  assert.deepEqual(T.dep.slice(0, 2), [5000, 5000]);
  assert.deepEqual(T.bal, T.rev.map((r, i) => r - T.dep[i]));
  assert.ok(T.categories.includes('Bars'));
  const C = json(KB.tendanceMois(ctx(S), { scope: 'perso', from: '2026-08', to: '2026-10', mode: 'cat:Bars' }));
  assert.deepEqual([C.barres, C.ref, C.cat], [[0, 0, 9000], 5000, 'Bars']);
  // balance cumulée
  const Q = json(KB.tendanceMois(ctx(S), { scope: 'perso', from: '2026-08', to: '2026-10', mode: 'cum' }));
  assert.equal(Q.ligne[2], T.bal[0] + T.bal[1] + T.bal[2]);
});

test('calculateur carburant : réglages du carnet, puis réglage annulable dans Klad', () => {
  const { S } = etat();
  assert.deepEqual(json(KB.carburant(S)), { ar: 0, jours: 20, autres: 0, conso: 5.5, prix: 2 });
  S.carnet = { fuel: { ar: 40, jours: 20, autres: 100, conso: 6, prix: 1.8 } };
  const c = json(KB.calculCarburant(ctx(S)));
  assert.deepEqual([c.km, c.prevu], [900, 9720]);       // (40 × 20 + 100) km × 6 l / 100 km × 1,80 €
  const avant = KB.reglerCarburant(S, { prix: 2, jours: -3 });
  assert.deepEqual(json(S.budget.carburant), { ar: 40, jours: 20, autres: 100, conso: 6, prix: 2 });     // valeur négative ignorée
  assert.equal(KB.calculCarburant(ctx(S)).prevu, 10800);
  KB.annulerCarburant(S, avant);
  assert.ok(!('carburant' in S.budget));
  assert.equal(KB.calculCarburant(ctx(S)).prevu, 9720);
});

test('opérations (0.9.4) : bornes des périodes, filtre combiné (période, recherche, internes), totaux, interne à la main annulable', () => {
  const Vu = X.KladVues;
  const { S } = etat();
  const B = KB.contexte(S, NOW);
  const b = (k, sc, du, au) => { const r = Vu.bornesPeriode(k, '2026-10-28', B, sc || 'perso', du, au); return [r.du, r.au]; };
  assert.deepEqual(b('cycle'), ['2026-10-27', '2026-11-26']);
  assert.deepEqual(b('cycleP'), ['2026-09-26', '2026-10-26']);
  assert.deepEqual(b('cycle', 'commun'), ['2026-10-01', '2026-10-31']);
  assert.deepEqual(b('mois'), ['2026-10-01', '2026-10-31']);
  assert.deepEqual(b('moisP'), ['2026-09-01', '2026-09-30']);
  assert.deepEqual(b('30j'), ['2026-09-29', '2026-10-28']);
  assert.deepEqual(b('12m'), ['2025-11-01', '2026-10-28']);
  assert.deepEqual(b('perso', 'perso', '2026-10-20', '2026-10-05'), ['2026-10-05', '2026-10-20']);
  assert.deepEqual(b('perso', 'perso', 'n\'importe quoi', ''), ['', '']);
  assert.deepEqual(b('tout'), ['', '']);
  assert.match(Vu.bornesPeriode('cycleP', '2026-10-28', B, 'perso').libelle, /^Cycle précédent : 26\/09 → 26\/10$/);
  // filtre combiné : période + recherche ; internes (règlement de carte détaillé, compté automatiquement)
  const cx = B.cx;
  const f = (o) => json(Vu.filtrer(S, Object.assign({ scope: 'perso', q: '', cat: '', nonVues: false }, o), cx).map(x => x.date + ' ' + x.libelle));
  assert.deepEqual(f({ du: '2026-10-27', au: '2026-10-27', q: 'BAR' }), ['2026-10-27 CB BAR DU PORT']);
  assert.deepEqual(f({ cat: '__int' }), ['2026-10-05 PRLV CARTE FICTIVE']);
  assert.deepEqual(f({ cat: '__int', du: '2026-10-06' }), []);
  const sel = Vu.filtrer(S, { scope: 'perso', du: '2026-10-27', au: '2026-10-28' }, cx);
  const t = Vu.totaux(sel);
  assert.equal(t.n, sel.length);
  assert.equal(t.debit, sel.filter(o => o.montant < 0).reduce((s, o) => s - o.montant, 0));
  assert.equal(t.credit, sel.filter(o => o.montant > 0).reduce((s, o) => s + o.montant, 0));
  assert.ok(t.debit > 0 && t.credit > 0);
  // interne à la main (ancienne forme comprise) : visible avec la mention, « compter en dépense » puis annuler
  const o = S.ops[S.modele.comptes.find(c => c.libelle === 'COURANT').id].find(x => /ASSUR/.test(x.libelle));
  o.categorie = { cat: 'Virements internes', sub: 'Règlement PORTEFEUILLE (rapproché à la main)' };
  assert.equal(K.interneManuel(o), true);
  const h = Vu.ligne(S, o, { ctx: K.contexte(S, NOW) }) + Vu.detail(S, o, K.contexte(S, NOW));
  assert.match(h, /interne \(à la main\)/);
  assert.match(h, /marquée interne à la main : pas comptée dans le budget/);
  assert.match(h, /data-a="depense">Annuler : compter en dépense/);
  const snap = K.compterEnDepense(o);
  assert.equal(o.categorie, null);
  assert.equal(K.compterEnDepense(o), null);
  K.annulerInterne(snap);
  assert.equal(K.interneManuel(o), true);
});
