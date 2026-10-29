// Tests : écarts comblés en 0.8.1 — contrats modifiables (ajout, poste deviné, nouveau poste, « → prévu », suppression,
// annulation), base de calcul et « Tout aligner sur le réel habituel », import manuel d'un relevé (CSV bancaire, carte,
// paiement en ligne, JSON ; doublons ; annulation), mode démo (montants et noms masqués). Données fictives uniquement.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { charge, json, montantSigne } from './charge.mjs';

const X = charge(['anon.js', 'eb.js', 'format.js', 'modele.js', 'classement.js', 'carnet.js', 'budget.js', 'releve.js', 'affichage.js', 'ui.js', 'vues.js', 'vbudget.js']);
const { KladModele: M, KladClasse: K, KladBudget: KB, KladReleve: RL, KladAffichage: AF, KladVuesBudget: VB } = X;
const NOW = Date.parse('2026-10-28T10:00:00Z');
let n = 0;
const op = (c, date, montant, libelle) => ({ id: c.id + ':t:' + (n++), compte: c.id, date, montant, libelle, statut: 'comptabilisee', source: 'eb', categorie: null, vue: true });

function etat() {
  const S = M.vide();
  const a = M.nouveauCompte(S, { libelle: 'COURANT', role: 'courant', solde: { centimes: 150000, date: '2026-10-28' } });
  S.classement = K.nouveau();
  S.classement.regles = [{ mot: 'ASSUR', cat: 'Assurances', sub: 'Assurance auto' }, { mot: 'BAR ', cat: 'Bars', sub: 'Bars' }];
  S.ops[a.id] = [];
  for (const m of ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']) {
    S.ops[a.id].push(op(a, m + '-10', -5000, 'PRLV ASSUR AUTO FICTIVE'), op(a, m + '-12', m < '2026-07' ? -2000 : -4000, 'CB BAR DU PORT'));
  }
  S.ops[a.id].sort((x, y) => x.date < y.date ? 1 : -1);
  S.budget = KB.nouveau();
  S.budget.plan.perso = { 'f|Assurance auto': { on: true, amt: 4500 }, 'c|Bars': { on: true, amt: 1000 } };
  return { S, a };
}
const ctx = S => KB.contexte(S, NOW);

test('contrats : ajout (poste deviné), nouveau poste, « → prévu », prévu face aux contrats, suppression, annulation', () => {
  const { S } = etat();
  const s1 = KB.enregistrerContrat(S, ctx(S), { sc: 'perso', label: 'Assurance auto fictive', montant: 5000, per: 1, motif: 'ASSUR AUTO', poste: '' });
  assert.equal(S.budget.contrats.length, 1);
  assert.equal(S.budget.contrats[0].poste, 'f|Assurance auto');
  const PP = json(KB.contratsParPoste(ctx(S), 'perso'));
  assert.deepEqual(PP.map(x => [x.poste, x.budget, x.contrats, x.etat.texte.replace(/\s/g, ' ')]), [['f|Assurance auto', 4500, 5000, 'prévu 5,00 € de moins']]);
  assert.equal(KB.contrats(ctx(S), 'perso')[0].etat.texte, 'conforme');
  // → prévu : le budget du poste prend le montant du contrat ; annulable
  const r = KB.versPrevu(S, 'perso', 'f|Assurance auto');
  assert.equal(r.amt, 5000);
  assert.equal(KB.contratsParPoste(ctx(S), 'perso')[0].etat.texte, 'aligné');
  KB.annuler(S, r.snap);
  assert.equal(S.budget.plan.perso['f|Assurance auto'].amt, 4500);
  // contrat trimestriel seul sur un nouveau poste fixe créé à son nom → prévu par échéance
  const s2 = KB.enregistrerContrat(S, ctx(S), { sc: 'perso', label: 'Ramonage', montant: 9000, per: 3, motif: 'RAMONAGE', poste: '__nouveau' });
  assert.equal(S.budget.contrats[1].poste, 'f|Ramonage');
  assert.equal(S.budget.plan.perso['f|Ramonage'].on, true);
  const r2 = KB.versPrevu(S, 'perso', 'f|Ramonage');
  assert.deepEqual(json(S.budget.plan.perso['f|Ramonage']), { on: true, per: 3, ech: 9000, amt: 3000 });
  assert.equal(r2.amt, 3000);
  // modification puis suppression, chacune annulable
  const id = S.budget.contrats[1].id;
  const s3 = KB.enregistrerContrat(S, ctx(S), { id, sc: 'perso', label: 'Ramonage', montant: 9600, per: 3, motif: 'RAMONAGE', poste: 'f|Ramonage' });
  assert.equal(S.budget.contrats[1].montant, 9600);
  KB.annulerContrat(S, s3);
  assert.equal(S.budget.contrats[1].montant, 9000);
  const s4 = KB.retirerContrat(S, id);
  assert.equal(S.budget.contrats.length, 1);
  KB.annulerContrat(S, s4);
  assert.equal(S.budget.contrats.length, 2);
  KB.annulerContrat(S, s2);
  assert.ok(!S.budget.plan.perso['f|Ramonage']);
  KB.annulerContrat(S, s1);
  assert.equal(S.budget.contrats.length, 0);
  // rendu : formulaire, bouton « → prévu », aucun montant signé
  KB.enregistrerContrat(S, ctx(S), { sc: 'perso', label: 'Assurance auto fictive', montant: 5000, motif: 'ASSUR AUTO' });
  const h = VB.contrats(ctx(S), 'perso', null);
  assert.match(h, /data-ctedit="liste"/);
  assert.match(VB.contrats(ctx(S), 'perso', 'liste'), /data-ctedit="nouveau"/);
  assert.match(h, /data-versprevu="f\|Assurance auto"/);
  assert.match(VB.contrats(ctx(S), 'perso', 'nouveau'), /id="ctLabel"[\s\S]*id="ctPoste"[\s\S]*Nouveau poste fixe/);
  assert.ok(!montantSigne(h));
});

test('base de calcul : fenêtre choisie, mois proposés ; « Tout aligner sur le réel habituel » annulable', () => {
  const { S } = etat();
  let B = ctx(S);
  assert.deepEqual(json(KB.fenetre(B)), { start: '2026-04', end: '2026-09', months: ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'] });
  assert.deepEqual(json(KB.moisReference(B)), ['2026-09', '2026-08', '2026-07', '2026-06', '2026-05', '2026-04']);
  const avant = KB.choisirReference(S, '2026-07');
  B = ctx(S);
  assert.equal(KB.fenetre(B).start, '2026-07');
  assert.match(VB.teteBudget(B, 'perso', { mode: 'plan' }), /Base de calcul depuis <select id="bref">[\s\S]*<option value="2026-07" selected>juil\. 26/);
  // bars : médiane 40 € depuis juillet ; assurance : moyenne 50 €
  const r = KB.alignerTout(S, B, 'perso');
  assert.equal(r.n, 2);
  assert.deepEqual([S.budget.plan.perso['c|Bars'].amt, S.budget.plan.perso['f|Assurance auto'].amt], [4000, 5000]);
  KB.annulerAlignement(S, 'perso', r.snap);
  assert.deepEqual([S.budget.plan.perso['c|Bars'].amt, S.budget.plan.perso['f|Assurance auto'].amt], [1000, 4500]);
  KB.annulerReference(S, avant);
  assert.equal(KB.fenetre(ctx(S)).start, '2026-04');
});

test('import d\'un relevé : CSV bancaire (débit / crédit), dates jj/mm, doublons, réimport, annulation', () => {
  const { S, a } = etat();
  const c = M.nouveauCompte(S, { libelle: 'MANUEL', role: 'courant', source: { type: 'manuel' } });
  const csv = 'Relevé fictif\r\nDate;Date de valeur;Libellé;Débit;Crédit\r\n02/10/2026;02/10/2026;CB MARCHE FICTIF;12,50;\r\n15/10/2026;15/10/2026;"VIR ""FICTIF""";;1 200,00\r\n15/10/2026;15/10/2026;VIR FICTIF;;1 200,00\r\nxx;;Ligne sans date;1;\r\n';
  const lu = RL.lire(csv, 'courant', '2026-10-28');
  assert.deepEqual(json(lu.lignes), [{ date: '2026-10-02', libelle: 'CB MARCHE FICTIF', montant: -1250 }, { date: '2026-10-15', libelle: 'VIR "FICTIF"', montant: 120000 }, { date: '2026-10-15', libelle: 'VIR FICTIF', montant: 120000 }]);
  assert.equal(lu.stats.dateIllisible, 1);
  const r = RL.integrer(S, c.id, lu.lignes, NOW);
  assert.equal(r.ajoutees.length, 3);
  assert.deepEqual([r.du, r.au], ['2026-10-02', '2026-10-15']);
  assert.ok(S.ops[c.id].every(o => o.source === 'fichier' && o.vue === false));
  // réimport : rien de nouveau
  assert.equal(RL.integrer(S, c.id, lu.lignes, NOW).ajoutees.length, 0);
  // une opération déjà là sous un libellé prolongé est reconnue
  const r2 = RL.integrer(S, c.id, [{ date: '2026-10-02', libelle: 'CB MARCHE FICTIF 01/10', montant: -1250 }], NOW);
  assert.deepEqual([r2.ajoutees.length, r2.doublons], [0, 1]);
  RL.retirer(S, c.id, r.ajoutees);
  assert.equal(S.ops[c.id].length, 0);
  // ordre mois/jour deviné ; montants « 1,234.56 »
  assert.equal(RL.ordreDates(['10/25/2026', '10/02/2026'], '2026-10-28'), 'mdy');
  assert.equal(RL.nombre('1,234.56'), 1234.56);
  assert.equal(RL.nombre('-1 234,56 €'), -1234.56);
  void a;
});

test('import d\'un relevé : carte (dépenses en positif, règlements écartés), paiement en ligne, JSON', () => {
  const carte = 'Date,Description,Montant\n03/10/2026,ACHAT FICTIF,45.90\n05/10/2026,PRELEVEMENT AUTOMATIQUE ENREGISTRE-MERCI,-300.00\n07/10/2026,REMBOURSEMENT FICTIF,-10.00\n';
  const lc = RL.lire(carte, 'carte_differee', '2026-10-28');
  assert.deepEqual(json(lc.lignes.map(x => [x.date, x.montant])), [['2026-10-03', -4590], ['2026-10-07', 1000]]);
  assert.equal(lc.stats.ecartees, 1);
  const pf = 'Date;Heure;Nom;Type;État;Devise;Brut;Net;Titre de l\'objet\n04/10/2026;10:00;Boutique fictive;Paiement;Terminé;EUR;-20,00;-20,00;Objet\n04/10/2026;10:00;;Virement bancaire;Terminé;EUR;20,00;20,00;\n05/10/2026;11:00;Autre fictive;Paiement;Terminé;USD;-5,00;-5,00;\n';
  const lp = RL.lire(pf, 'paiement_en_ligne', '2026-10-28');
  assert.deepEqual(json(lp.lignes), [{ date: '2026-10-04', libelle: 'Boutique fictive · Objet', montant: -2000 }]);
  assert.equal(lp.stats.ecartees, 2);
  const lj = RL.lire(JSON.stringify([{ date: '2026-10-01', label: 'FICTIF', amount: -9.99 }, { date: 'x', label: 'Y', amount: 1 }]), 'courant', '2026-10-28');
  assert.deepEqual(json(lj.lignes), [{ date: '2026-10-01', libelle: 'FICTIF', montant: -999 }]);
  const le = RL.lire(JSON.stringify({ transactions: [{ booking_date: '2026-10-02', transaction_amount: { amount: '7.50', currency: 'EUR' }, credit_debit_indicator: 'DBIT', remittance_information: ['ACHAT FICTIF'] }] }), 'courant', '2026-10-28');
  assert.deepEqual(json(le.lignes.map(x => [x.date, x.montant])), [['2026-10-02', -750]]);
  assert.equal(RL.lire('Libellé;Montant\nA;1\n', 'courant', '2026-10-28').entete, false);
  assert.throws(() => RL.lire('{oups', 'courant', '2026-10-28'), /JSON illisible/);
});

test('mode démo : montants multipliés, noms remplacés ; thème par défaut automatique', () => {
  assert.equal(AF.masquer('Solde 1 234,56 € et 80 €', 2, []), 'Solde 2 469,12 € et 160 €');
  assert.equal(AF.masquer('12 % · 3 jours', 2, []), '12 % · 3 jours');
  const S = M.vide();
  S.modele.connexions.s1 = { banque: 'Banque Fictive du Nord' };
  M.nouveauCompte(S, { libelle: 'Commun', role: 'commun', source: { type: 'eb', intitule: 'COMPTE JOINT FICTIF' } });
  S.budget = KB.nouveau();
  S.budget.reglages = { commun: { moi: 'Personne Réelle', autre: 'Autre Réelle' } };
  const al = AF.aliasDe(S);
  assert.equal(AF.masquer('Personne Réelle doit 100 € · compte joint fictif · Banque Fictive du Nord · Commun', 1, al), 'Personne A doit 100 € · Compte 1 · Banque A · Commun');
  assert.equal(AF.masquer('Personne Réellement', 1, al), 'Personne Réellement');
  assert.equal(AF.theme(), 'auto');
});
