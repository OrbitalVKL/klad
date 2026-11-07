// Tests du lot 1.3.0 : compte commun remis à plat — statut de chaque mouvement (prévu, écart, imprévu), virements
// ponctuels affectés (enveloppe Impôts, avances au commun), enveloppes et paiements reliés, décomposition du solde,
// enveloppe qui finance autre chose, réserve fixe et renflouement partagé, fiche du mois, détail par poste (1.3.1, sous « Virements à mettre en place »),
// équilibre avant / après les affectations, relevé de contrôle. Scénario FICTIF inspiré d'un cas réel : virement
// « impôts » mis de côté, deux appels de fonds payés ensemble et en retard, renflouements faits par une seule personne.
// Aucune donnée réelle : libellés, noms et montants inventés.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { json, texteVisible, montantSigne } from './charge.mjs';
import { outils, etatDepuisReprise } from './jeux.mjs';
import { repriseFictive } from './fictif.mjs';

const X = outils(['ui.js', 'vues.js', 'vbudget.js', 'vcommun.js']);
const { KladModele: M, KladClasse: K, KladBudget: KB, KladCommun: KC, KladControle: CT, KladObservations: KO, KladVuesCommun: VC, KladVues: Vu } = X;
const FIN = '2026-10-28', NOW = Date.parse(FIN + 'T10:00:00Z');

// Reprise fictive : appel de fonds de juillet pas payé à l'échéance, puis payé avec celui d'octobre en une fois le 22/09 ;
// 343 € « impôts 2025 » versés en mai ; solde d'impôt prélevé en septembre et octobre ; trois renflouements de la personne A.
function reprise() {
  const r = repriseFictive(FIN);
  r.transactions = r.transactions.filter(t => !(t.account === 'r2' && /SYNDIC/.test(t.label) && (t.date === '2026-07-06' || t.date === '2026-10-06')));
  const add = (date, amount, label) => r.transactions.push({ account: 'r2', date, amount, label, status: 'comptabilisee' });
  add('2026-05-11', 34300, 'VIR PERSONNE A IMPOTS 2025');
  add('2026-09-22', -90000, 'PRLV SYNDIC FICTIF APPELS');
  add('2026-09-25', -8500, 'PRLV DIRECTION GENERALE DES FINANCES PUBLIQUES SOLDE IR');
  add('2026-10-11', 8500, 'VIR PERSONNE A RATTRAPAGE');
  add('2026-10-13', 8500, 'VIR PERSONNE A RENFLOUEMENT');
  add('2026-10-26', -8500, 'PRLV DIRECTION GENERALE DES FINANCES PUBLIQUES SOLDE IR');
  add('2026-10-27', 10000, 'VIR PERSONNE A RENFLOUEMENT');
  r.transactions.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  return r;
}
const etat = () => etatDepuisReprise(X, reprise(), NOW);
const ctx = S => KB.contexte(S, NOW, K.contexte(S, NOW));
const opCommun = (S, date, montant) => { const c = S.modele.comptes.find(x => x.role === 'commun'); return S.ops[c.id].find(o => o.date === date && o.montant === montant); };
// Affectations confirmées comme le ferait le propriétaire (propositions gardées).
async function etatAffecte() {
  const S = await etat();
  const B = ctx(S);
  for (const x of KC.ponctuels(B)) KC.affecter(x.r.o, x.prop);
  return S;
}

test('statuts : virements permanents et postes prévus ; deux appels payés ensemble et en retard = écart expliqué ; ponctuels imprévus', async () => {
  const S = await etat();
  const B = ctx(S), ST = KC.statuts(B);
  const st = (d, m) => ST.get(opCommun(S, d, m).id);
  // virement permanent et prêt (contrat) : prévus
  assert.equal(st('2026-10-02', 80000).statut, 'prevu');
  assert.match(st('2026-10-02', 80000).quoi, /virement permanent/);
  assert.equal(st('2026-10-05', -95000).statut, 'prevu');
  // deux appels de fonds (01/07 et 01/10) payés le 22/09 : écart, en une phrase
  const ap = st('2026-09-22', -90000);
  assert.equal(ap.statut, 'ecart');
  assert.match(ap.ecart, /2 appels de fonds \(01\/07, 01\/10\) payés en une fois/);
  assert.match(ap.ecart, /appel du 01\/07 payé 83 jours après son échéance/);
  // virement ponctuel : imprévu, à affecter, proposition d'après le libellé
  const imp = st('2026-05-11', 34300);
  assert.equal(imp.statut, 'imprevu');
  assert.equal(imp.sorte, 'ponctuel');
  const P = KC.ponctuels(B);
  assert.deepEqual(json(P.map(x => [x.r.date, x.prop.k, x.prop.an || x.prop.pour || ''])),
    [['2026-05-11', 'impots', '2025'], ['2026-10-11', 'avance', 'renflouement'], ['2026-10-13', 'avance', 'renflouement'], ['2026-10-27', 'avance', 'renflouement']]);
  // impôt prélevé sans enveloppe : imprévu
  assert.equal(st('2026-09-25', -8500).statut, 'imprevu');
  // montant hors tolérance sur un virement permanent : écart « montant »
  const v = S.budget.virements.find(x => x.qui === 'autre');
  v.montant = 61500;
  const s2 = KC.statuts(ctx(S)).get(opCommun(S, '2026-10-03', 60000).id);
  assert.equal(s2.statut, 'ecart');
  assert.match(s2.ecart, /montant : 600\s€ au lieu de 615\s€/);
});

test('enveloppe Impôts 2025 : paiements d\'impôt reliés, reste ; hors équilibre ; avances : moitié en faveur de celui qui avance', async () => {
  const S0 = await etat();
  const E0 = KC.equilibre(ctx(S0));
  const S = await etatAffecte();
  const B = ctx(S);
  const EN = KC.enveloppes(B).liste;
  assert.equal(EN.length, 1);
  assert.deepEqual(json({ nom: EN[0].nom, montant: EN[0].montant, utilise: EN[0].utilise, reste: EN[0].reste, n: EN[0].paiements.length }),
    { nom: 'Impôts 2025', montant: 34300, utilise: 17000, reste: 17300, n: 2 });
  const ST = KC.statuts(B);
  assert.equal(ST.get(opCommun(S, '2026-09-25', -8500).id).statut, 'prevu');
  assert.match(ST.get(opCommun(S, '2026-09-25', -8500).id).quoi, /enveloppe Impôts 2025/);
  // avances : 85 + 85 + 100 = 270 €, dont 135 € comptés en faveur de la personne A (part 50 / 50)
  const A = KC.avances(B);
  assert.deepEqual(json(A.moi), { avance: 27000, faveur: 13500 });
  assert.deepEqual(json(A.autre), { avance: 0, faveur: 0 });
  // équilibre : 343 € et paiements de l'enveloppe hors équilibre ; avances comptées pour moitié
  const E = KC.equilibre(B), Eb = KC.equilibre(B, { brut: true });
  assert.equal(Eb.invMoi, E0.invMoi, 'sans affectation : comme avant');
  assert.equal(Eb.invAutre, E0.invAutre);
  const r = E.rNE;
  assert.ok(Math.abs((E.invMoi - Eb.invMoi) - (-34300 - 27000 + 13500 + 17000 * r)) < 1);
  assert.ok(Math.abs((E.invAutre - Eb.invAutre) - 17000 * (1 - r)) < 1);
  assert.equal(E.avMoi, 13500);
  assert.equal(E.hors.length, 3);
  assert.equal(E.avances.length, 3);
  assert.ok(E.avances.every(x => x.mention === 'avance au commun'));
  // écran Équilibre : ligne des avances, mention sur les mouvements, hors équilibre
  const h = texteVisible(VC.equilibre(B, {})).replace(/\s+/g, ' ');
  assert.match(h, /\+ Avances au commun[^=]*?135\s€ 0\s€/);
  assert.match(h, /Hors équilibre : Impôts 2025/);
  assert.match(h, /avance au commun · 43\s€ comptés/);
  assert.ok(!montantSigne(h));
});

test('décomposition du solde ; enveloppe qui finance autre chose (observation avec le mois et la dépense) ; réserve fixe et renflouement', async () => {
  const S = await etatAffecte();
  const c = S.modele.comptes.find(x => x.role === 'commun');
  let B = ctx(S), D = KC.decomposition(B);
  assert.equal(D.solde, c.solde.centimes);
  assert.equal(D.enveloppes, 17300);
  assert.equal(D.disponible, D.solde - D.reserve - D.provisions - D.enveloppes);
  // solde bas : l'enveloppe Impôts paie autre chose
  c.solde.centimes = 10000;
  B = ctx(S); D = KC.decomposition(B);
  assert.ok(D.disponible < 0);
  const dt = KC.enveloppesDetournees(B);
  assert.equal(dt.length, 1);
  assert.equal(dt[0].nom, 'Impôts 2025');
  assert.ok(dt[0].montant > 0 && dt[0].montant <= 17300);
  assert.ok(dt[0].depense && dt[0].depense.date >= '2026-05-11');
  const O = KO.audit(B).find(a => /^L'enveloppe Impôts 2025 finance autre chose/.test(a.titre));
  assert.ok(O, 'observation');
  assert.equal(O.niveau, 'warn');
  assert.match(O.texte, /depuis \w+ et le paiement du \d\d\/\d\d/);
  // réserve fixe : la trésorerie prévue ne descend pas dessous, sinon renflouement partagé (parts des postes en cause)
  c.solde.centimes = 230000;
  S.budget.reglages = Object.assign({}, S.budget.reglages, { commun: Object.assign({}, (S.budget.reglages || {}).commun, { reserveFixe: 50 }) });
  B = ctx(S);
  assert.equal(B.R.commun.reserveFixe, 5000);
  const C = KC.tresorerie(B);
  const seuil = C.min + 20000;                                  // réserve 200 € au-dessus du point bas
  S.budget.reglages.commun.reserveFixe = seuil / 100;
  B = ctx(S);
  const Rf = KC.renflouement(B);
  assert.ok(Rf, 'renflouement proposé');
  assert.equal(Rf.montant, 20000);
  assert.equal(Rf.moi + Rf.autre, Rf.montant);
  assert.ok(Rf.postes.length > 0);
  assert.equal(Rf.fait, null);
  assert.deepEqual(json(Rf.avances), { moi: 27000, autre: 0 });
  const av = KC.renflouementFait(S, B.auj, Rf.montant);
  assert.equal(KC.renflouement(ctx(S)).fait, B.auj);
  KC.annulerRenflouement(S, av);
  assert.equal(KC.renflouement(ctx(S)).fait, null);
  // réserve sous le point bas : rien à proposer
  S.budget.reglages.commun.reserveFixe = 0;
  assert.equal(KC.renflouement(ctx(S)), null);
});

test('corrections à la main : affectation, paiement sorti de l\'enveloppe, statut forcé ; annulables', async () => {
  const S = await etatAffecte();
  const o = opCommun(S, '2026-09-25', -8500), p = opCommun(S, '2026-05-11', 34300);
  const a1 = KC.corriger(o, 'lien', 'aucun');
  let B = ctx(S);
  assert.equal(KC.enveloppes(B).liste[0].utilise, 8500);
  assert.equal(KC.statuts(B).get(o.id).statut, 'imprevu');
  KC.restaurer(o, a1);
  assert.equal(o.commun, undefined);
  const a2 = KC.corriger(o, 'statut', 'imprevu');
  B = ctx(S);
  assert.equal(KC.statuts(B).get(o.id).statut, 'imprevu');
  assert.equal(KC.statuts(B).get(o.id).main, true);
  KC.restaurer(o, a2);
  // affectation changée : « Autre » → plus d'enveloppe, le 343 € revient dans l'équilibre comme avant
  const a3 = KC.affecter(p, { k: 'autre', txt: 'mise de côté' });
  B = ctx(S);
  assert.equal(KC.enveloppes(B).liste.length, 0);
  assert.equal(KC.texteAff(B, p.commun.aff), 'Autre : mise de côté');
  KC.restaurer(p, a3);
  assert.equal(KC.enveloppes(ctx(S)).liste.length, 1);
  // versement aussitôt reversé (même montant débité dans les 5 jours) : proposé « avance pour » le poste de ce paiement
  const c = S.modele.comptes.find(x => x.role === 'commun');
  const S3 = Object.assign({}, S, { ops: Object.assign({}, S.ops, { [c.id]: S.ops[c.id].concat([
    Object.assign({}, S.ops[c.id][0], { id: c.id + ':t:in', date: '2026-06-20', montant: 7000, libelle: 'VIR PERSONNE A SYNDIC', commun: undefined, echeance: undefined }),
    Object.assign({}, S.ops[c.id][0], { id: c.id + ':t:out', date: '2026-06-21', montant: -7000, libelle: 'PRLV SYNDIC FICTIF COMPLEMENT', commun: undefined, echeance: undefined })]) }) });
  const pp = KC.ponctuels(ctx(S3)).find(x => x.r.id === c.id + ':t:in');
  assert.deepEqual(json([pp.prop.k, pp.prop.pour]), ['avance', 'f|Charges de copropriété']);
  // avance pour un poste : enveloppe qui paie les débits de ce poste
  const q = opCommun(S, '2026-10-27', 10000);
  KC.affecter(q, { k: 'avance', pour: 'f|Électricité' });
  B = ctx(S);
  const e = KC.enveloppes(B).liste.find(x => x.k === 'avance');
  assert.equal(e.nom, 'Avance pour Électricité');
  assert.equal(KC.avances(B).moi.avance, 27000, 'reste une avance');
});

test('fiche du mois, détail par poste (1.3.1, sous « Virements à mettre en place »), filtres « Imprévus » / « Écarts », détail d\'un mouvement, Ce mois', async () => {
  const S = await etatAffecte();
  const B = ctx(S);
  const F9 = KC.fiche(B, '2026-09');
  assert.equal(F9.conforme, false);
  assert.ok(F9.ecarts.some(x => /payés en une fois/.test(x.texte)));
  const F8 = KC.fiche(B, '2026-08');
  assert.equal(F8.conforme, true, 'août : tout prévu');
  assert.equal(F8.ecarts.length + F8.imprevus.length, 0);
  // virement permanent manquant d'un mois passé : écart
  const c = S.modele.comptes.find(x => x.role === 'commun');
  const vir = S.ops[c.id].find(o => o.date === '2026-08-03');
  const sauf = S.ops[c.id].filter(o => o !== vir);
  const S2 = Object.assign({}, S, { ops: Object.assign({}, S.ops, { [c.id]: sauf }) });
  const F8b = KC.fiche(ctx(S2), '2026-08');
  assert.ok(F8b.ecarts.some(x => x.manquant && /non reçu/.test(x.texte)));
  // plan poste par poste
  const P = KC.planPostes(B);
  assert.ok(P.lignes.find(x => x.key === 'f|Prêt immobilier' && x.pg === 60 && x.moi === 57000 && x.autre === 38000));
  assert.equal(P.vir.moi, 80000);
  assert.equal(P.ecart.moi, P.vir.moi - P.tot.moi);
  // 1.3.1 : plus d'écran « Plan » ; détail par poste sous « Virements à mettre en place », total = demandé
  assert.equal(VC.planPostes, undefined, 'écran Plan retiré');
  const hp = VC.plan(B, { cartes: new Set(['cm|dp-moi', 'cm|dp-autre']) }, 'mois'), tp = texteVisible(hp);
  assert.match(tp, /Virements à mettre en place[\s\S]*Détail par poste[\s\S]*Prêt immobilier[\s\S]*60 \/ 40[\s\S]*Total demandé/);
  assert.doesNotMatch(hp, /object Object|undefined|NaN/);
  const D = KC.plan(B), sm = q => P.lignes.reduce((t, x) => t + x[q], 0);
  assert.ok(Math.abs(sm('moi') - D.T.moi) < 1 && Math.abs(sm('autre') - D.T.autre) < 1, 'détail par poste = demandé');
  // filtres de la liste
  const cx = K.contexte(S, NOW), ST = KC.statuts(B);
  const imp = Vu.filtrer(S, { scope: 'commun', cat: '__imp', statuts: ST }, cx), eca = Vu.filtrer(S, { scope: 'commun', cat: '__eca', statuts: ST }, cx);
  assert.ok(imp.length >= 4 && imp.every(o => ST.get(o.id).statut === 'imprevu'));
  assert.ok(eca.some(o => o.date === '2026-09-22'));
  assert.match(Vu.filtres(S, { scope: 'commun', cat: '__imp' }, cx, { unseen: 0, nc: 0, int: 0, imp: imp.length, eca: eca.length }), /data-f="imp" class="ch-st" aria-pressed="true">Imprévus <b>\d+<\/b>/);
  assert.doesNotMatch(Vu.filtres(S, { scope: 'perso' }, cx, { unseen: 0, nc: 0, int: 0, imp: 1, eca: 1 }), /Imprévus/);
  // pastille de la ligne
  const o = opCommun(S, '2026-09-22', -90000);
  assert.match(Vu.ligne(S, o, { ctx: cx, statuts: ST }), /class="tx-tag st-ecart"[^>]*><span class="st-dot" aria-hidden="true"><\/span>écart<\/span>/);
  // détail : statut, écart expliqué, correction à la main ; ponctuel : affectation
  const d = Vu.detail(S, o, cx, B);
  assert.match(d, /Prévu, écart[\s\S]*Écart : 2 appels de fonds/);
  assert.match(d, /data-a="statutcm" data-val="prevu"/);
  const dp = Vu.detail(S, opCommun(S, '2026-10-13', 8500), cx, B);
  assert.match(dp, /Affecté : Avance au commun \(renflouement\)/);
  assert.match(dp, /data-a="affecter" data-k="impots"/);
  const di = Vu.detail(S, opCommun(S, '2026-10-26', -8500), cx, B);
  assert.match(di, /id="cmLien"/);
  // Ce mois : décomposition, fiche, enveloppes et avances
  const h = texteVisible(VC.mois(B, { ficheM: '2026-09' })).replace(/\s+/g, ' ');
  assert.match(h, /Solde [\d\s ]+,\d\d € Disponible/);
  assert.match(h, /Enveloppes 173,00 €/);
  assert.match(h, /Fiche de septembre 2026/);
  assert.match(h, /Écarts/);
  assert.match(h, /Impôts 2025 versé 343,00 € le 11\/05 · payé 170,00 € \(2 paiements\) reste 173,00 €/);
  assert.match(h, /Personne A : avancé 270\s€ ?, dont 135\s€ en sa faveur/);
  assert.ok(!montantSigne(VC.mois(B, {})));
  // à affecter (avant confirmation)
  const S0 = await etat();
  const h0 = texteVisible(VC.mois(ctx(S0), {}));
  assert.match(h0, /Virements ponctuels à affecter/);
  assert.match(h0, /proposé : Impôts 2025/);
});

test('relevé de contrôle : bloc communPlan (statuts du mois, ponctuels, enveloppes, avances, réserve, équilibre avant / après)', async () => {
  const S = await etatAffecte();
  const B = ctx(S), cx = K.contexte(S, NOW);
  const r = json(CT.construire(S, B, cx, NOW, { version: 'test' }));
  const P = r.communPlan;
  assert.equal(P.reserveFixe, 0);
  assert.equal(P.mois.length, 7);
  assert.equal(P.mois[P.mois.length - 1].mois, '2026-10');
  assert.ok(P.mois.find(x => x.mois === '2026-09').ecarts.some(x => /payés en une fois/.test(x.texte)));
  assert.deepEqual(P.enveloppes.map(e => [e.nom, e.verse, e.paye, e.reste]), [['Impôts 2025', 34300, 17000, 17300]]);
  assert.deepEqual(P.avances.moi, { avance: 27000, faveur: 13500 });
  assert.equal(P.ponctuels.length, 4);
  assert.ok(P.ponctuels.every(x => x.affectation));
  assert.equal(P.equilibre.horsEquilibre.length, 3);
  assert.equal(P.equilibre.difference, P.equilibre.ecartApres - P.equilibre.ecartAvant);
  assert.ok(P.equilibre.difference > 0, 'la personne A doit davantage une fois ses versements « impôts » et avances requalifiés');
  assert.equal(P.renflouement, null);
});
