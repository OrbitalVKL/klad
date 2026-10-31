// Tests : classement des opérations (priorités, règles de base, règles de l'utilisateur, corrections, défauts),
// opérations vues, non classées, carte à débit différé (dette, date de dépense, règlement détaillé), portefeuille
// (anti-double-comptage), volet « Classer » (règle, correction, annulation). Données fictives uniquement.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { charge, json } from './charge.mjs';

const { KladModele: M, KladClasse: K } = charge(['anon.js', 'eb.js', 'modele.js', 'classement.js']);
const NOW = Date.parse('2026-10-28T10:00:00Z');
let n = 0;
const op = (c, date, montant, libelle, o = {}) => Object.assign({ id: c.id + ':t:' + (n++), compte: c.id, date, montant, libelle, statut: 'comptabilisee', source: 'eb', categorie: null, vue: false }, o);

function etat() {
  const S = M.vide();
  const a = M.nouveauCompte(S, { libelle: 'COURANT', role: 'courant' });
  const b = M.nouveauCompte(S, { libelle: 'COMMUN', role: 'commun' });
  const k = M.nouveauCompte(S, { libelle: 'CARTE', role: 'carte_differee', prelevement: { compte: a.id, jour: 5 } });
  const w = M.nouveauCompte(S, { libelle: 'PORTEFEUILLE', role: 'paiement_en_ligne' });
  S.ops[a.id] = []; S.ops[b.id] = []; S.ops[k.id] = []; S.ops[w.id] = [];
  S.classement = K.nouveau();
  return { S, a, b, k, w };
}
const cl = (S, o) => { const r = json(K.classer(K.contexte(S, NOW), o)); return [r.type, r.cat, r.sub, r.src]; };

test('priorités : correction > règle de l\'utilisateur (mot le plus long) > règles de base (ordre) > défaut', () => {
  const { S, a } = etat();
  const C = S.classement;
  C.base = [{ motif: 'BOULANG', type: 'depense', cat: 'Alimentation', sub: 'Boulangerie' }, { motif: 'BOUL', type: 'depense', cat: 'Divers', sub: 'Divers' }];
  C.regles = [{ mot: 'boulangerie', cat: 'Courses', sub: 'Pain' }, { mot: 'Boulangerie du coin', cat: 'Restaurant', sub: 'Brunch' }];
  const o1 = op(a, '2026-10-20', -350, 'CB BOULANGERIE DU COIN FICTIVE');
  const o2 = op(a, '2026-10-20', -350, 'CB BOULANGERIE   FICTIVE');
  const o3 = op(a, '2026-10-20', -350, 'CB BOULANGE FICTIVE');
  const o4 = op(a, '2026-10-20', -350, 'CB INCONNU');
  const o5 = op(a, '2026-10-20', 1000, 'VIR RECU INCONNU');
  assert.deepEqual(cl(S, o1), ['depense', 'Restaurant', 'Brunch', 'regle']);
  assert.deepEqual(cl(S, o2), ['depense', 'Courses', 'Pain', 'regle']);
  assert.deepEqual(cl(S, o3), ['depense', 'Alimentation', 'Boulangerie', 'base']);
  assert.deepEqual(cl(S, o4), ['depense', 'Autres', 'Non classé', 'defaut']);
  assert.deepEqual(cl(S, o5), ['revenu', 'Autres revenus', 'Autres revenus', 'defaut']);
  o1.categorie = { cat: 'Cadeaux', sub: 'Anniversaire' };
  assert.deepEqual(cl(S, o1), ['depense', 'Cadeaux', 'Anniversaire', 'correction']);
  // non classées : défauts seulement
  const cx = K.contexte(S, NOW);
  assert.deepEqual([o1, o2, o3, o4, o5].map(o => K.classer(cx, o).nc), [false, false, false, true, true]);
});

test('règles de l\'utilisateur : compte et sens facultatifs ; type d\'après la nature de la catégorie', () => {
  const { S, a, b } = etat();
  S.classement.regles = [{ mot: 'VIREMENT FICTIF', cat: 'Salaire', sub: 'Salaire', sens: 'credit' }, { mot: 'LOYER', cat: 'Logement', sub: 'Loyer', compte: b.id }];
  assert.deepEqual(cl(S, op(a, '2026-10-01', 200000, 'VIREMENT FICTIF EMPLOYEUR')), ['revenu', 'Salaire', 'Salaire', 'regle']);
  assert.deepEqual(cl(S, op(a, '2026-10-01', -200, 'VIREMENT FICTIF EMPLOYEUR')).slice(3), ['defaut']);
  assert.deepEqual(cl(S, op(b, '2026-10-01', -90000, 'PRLV LOYER')), ['depense', 'Logement', 'Loyer', 'regle']);
  assert.deepEqual(cl(S, op(a, '2026-10-01', -90000, 'PRLV LOYER')).slice(3), ['defaut']);
  S.classement.categories['Projet'] = { nature: 'hors_budget', icone: '🔑' };
  S.classement.regles.push({ mot: 'NOTAIRE', cat: 'Projet' });
  assert.deepEqual(cl(S, op(a, '2026-10-01', -500000, 'VIR NOTAIRE FICTIF')), ['horsbudget', 'Projet', 'Projet', 'regle']);
});

test('règles de base : comptes (carte vue par son compte de prélèvement), sens, transfert, crédit d\'une dépense, revente, hors cartes', () => {
  const { S, a, b, k, w } = etat();
  S.classement.base = [
    { motif: '^VIR FICTIF', type: 'transfert', cat: 'Virements à des proches', sub: 'Virements', siCredit: { type: 'revenu', cat: 'Remboursements entre amis', sub: 'Remboursements entre amis' } },
    { motif: 'PARKING', type: 'depense', cat: 'Logement', sub: 'Charges parking', comptes: ['@commun'] },
    { motif: 'MAGASIN', type: 'depense', cat: 'Shopping', sub: 'Magasins', creditDepense: true },
    { motif: 'ENCHERES', type: 'revenu', cat: 'Ventes', sub: 'Ventes' },
    { motif: 'PORTEFEUILLE FICTIF', type: 'depense', cat: 'À détailler', sub: 'Portefeuille', horsCartes: true },
    { motif: 'PHARMA', type: 'depense', cat: 'Santé', sub: 'Pharmacie', comptes: [a.id] }];
  S.classement.revente = { 'Ventes': { cat: 'Shopping', sub: 'Achats en ligne' } };
  assert.deepEqual(cl(S, op(a, '2026-10-01', 2000, 'VIR FICTIF AMI')), ['revenu', 'Remboursements entre amis', 'Remboursements entre amis', 'base']);
  assert.deepEqual(cl(S, op(a, '2026-10-01', -2000, 'VIR FICTIF AMI')), ['depense', 'Virements à des proches', 'Virements', 'base']);
  assert.deepEqual(cl(S, op(b, '2026-10-01', -3000, 'PARKING FICTIF')), ['depense', 'Logement', 'Charges parking', 'base']);
  assert.equal(cl(S, op(a, '2026-10-01', -3000, 'PARKING FICTIF'))[3], 'defaut');
  assert.deepEqual(cl(S, op(a, '2026-10-01', 1500, 'REMB MAGASIN')), ['depense', 'Shopping', 'Magasins', 'base']);
  assert.deepEqual(cl(S, op(a, '2026-10-01', 1500, 'ENCHERES FICTIVES')), ['revenu', 'Ventes', 'Ventes', 'base']);
  assert.deepEqual(cl(S, op(a, '2026-10-01', -1500, 'ENCHERES FICTIVES')), ['depense', 'Shopping', 'Achats en ligne', 'base']);
  assert.deepEqual(cl(S, op(a, '2026-10-01', -1500, 'PRLV PORTEFEUILLE FICTIF')).slice(1, 2), ['À détailler']);
  // sur une carte ou un portefeuille, la règle « hors cartes » est sautée ; défaut : achats de la carte
  assert.deepEqual(cl(S, op(k, '2026-10-01', -1500, 'PORTEFEUILLE FICTIF *MARCHAND')), ['depense', 'Shopping', 'Achats CARTE', 'defaut']);
  assert.deepEqual(cl(S, op(w, '2026-10-01', 500, 'MARCHAND FICTIF')), ['depense', 'Shopping', 'Remboursements PORTEFEUILLE', 'defaut']);
  // carte prélevée sur COURANT : une règle restreinte à COURANT s'y applique ; un portefeuille sans rattachement = compte courant
  assert.deepEqual(cl(S, op(k, '2026-10-01', -800, 'PHARMA FICTIVE')).slice(1, 2), ['Santé']);
  S.classement.base[5].comptes = ['@courant'];
  assert.deepEqual(cl(S, op(w, '2026-10-01', -800, 'PHARMA FICTIVE')).slice(1, 2), ['Santé']);
  // motif invalide : ignoré sans bloquer les autres
  S.classement.base.unshift({ motif: '([', type: 'depense', cat: 'Divers' });
  const cx = K.contexte(S, NOW);
  assert.equal(cx.invalides, 1);
  assert.equal(K.classer(cx, op(b, '2026-10-01', -3000, 'PARKING FICTIF')).cat, 'Logement');
});

test('carte à débit différé : dette depuis le dernier règlement, hors remboursements, date du prochain prélèvement', () => {
  const { S, a, b, k } = etat();
  k.prelevement.motif = 'REGLEMENT CARTE FICTIVE';
  k.prelevement.remboursements = 'PAIEMENT RECU|MERCI';
  S.ops[a.id].push(op(a, '2026-09-05', -12000, 'PRLV REGLEMENT CARTE FICTIVE'), op(a, '2026-10-05', -4500, 'PRLV REGLEMENT CARTE FICTIVE'));
  S.ops[b.id].push(op(b, '2026-10-20', -100, 'REGLEMENT CARTE FICTIVE AUTRE COMPTE'));
  S.ops[k.id].push(op(k, '2026-10-04', -4500, 'CB AVANT'), op(k, '2026-10-05', -1000, 'CB LE JOUR DU REGLEMENT'),
    op(k, '2026-10-06', -2000, 'CB LIBRAIRIE'), op(k, '2026-10-09', 500, 'REMBOURSEMENT MARCHAND'), op(k, '2026-10-12', 4500, 'PAIEMENT RECU MERCI'),
    op(k, '2026-10-20', -3000, 'CB RESTAURANT', { statut: 'en_cours' }));
  assert.deepEqual(json(K.dette(S, k, NOW)), { centimes: 4500, depuis: '2026-10-05', n: 3, le: '2026-11-05' });
  // sans compte de prélèvement : tous les comptes courants et commun
  delete k.prelevement.compte;
  assert.equal(K.dette(S, k, NOW).depuis, '2026-10-20');
  k.prelevement.compte = a.id;
  // jamais négative (plus de remboursements que d'achats)
  S.ops[k.id].push(op(k, '2026-10-21', 90000, 'AVOIR FICTIF'));
  assert.equal(K.dette(S, k, NOW).centimes, 0);
  // sans motif : inconnue
  delete k.prelevement.motif;
  assert.equal(K.dette(S, k, NOW), null);
  assert.deepEqual(json(K.dettes(S, NOW)), { centimes: 0, connues: 0, inconnues: 1 });
  // prochaine date : jour 31 en février, règlement du mois pas encore vu
  assert.equal(K.prochaine(31, '2026-01-31', Date.parse('2026-02-10T10:00:00Z')), '2026-02-28');
  assert.equal(K.prochaine(25, '2026-09-25', Date.parse('2026-10-28T10:00:00Z')), '2026-10-25');
  assert.equal(K.prochaine(null, '2026-09-25', NOW), null);
});

test('carte : règlement détaillé → interne sur la période couverte (+45 j) ; date de dépense lue dans le libellé', () => {
  const { S, a, b, k } = etat();
  k.prelevement.motif = 'reglement carte fictive';
  S.ops[k.id].push(op(k, '2026-03-02', -1000, 'CB DEBUT'), op(k, '2026-08-30', -1000, 'CB FIN'));
  const avant = op(a, '2026-02-20', -5000, 'PRLV REGLEMENT CARTE FICTIVE');
  const dedans = op(b, '2026-10-10', -5000, 'PRLV Règlement Carte Fictive');
  const apres = op(a, '2026-10-20', -5000, 'PRLV REGLEMENT CARTE FICTIVE');
  assert.equal(cl(S, avant)[0], 'depense');
  assert.deepEqual(cl(S, dedans), ['interne', 'Virements internes', 'Règlement CARTE (détaillé)', 'reglement']);
  assert.equal(cl(S, apres)[0], 'depense');
  dedans.categorie = { cat: 'Divers' };                  // le règlement détaillé l'emporte, comme dans l'ancienne version
  assert.equal(cl(S, dedans)[0], 'interne');
  assert.equal(K.dateDepense(op(a, '2026-10-02', -100, 'CARTE 29/09 CAFE FICTIF')), '2026-09-29');
  assert.equal(K.dateDepense(op(a, '2026-01-02', -100, 'PAIEMENT CB 3112 CAFE')), '2025-12-31');
  assert.equal(K.dateDepense(op(a, '2026-10-02', -100, 'CARTE 31/02 CAFE')), '');
  assert.equal(K.dateDepense(op(a, '2026-10-02', -100, 'VIR CARTE 29/09')), '');
});

test('portefeuille : prélèvement retrouvé dans le détail (même montant, de 2 j avant à 7 j après) → interne', () => {
  const { S, a, w } = etat();
  w.prelevement = { motif: 'PORTEFEUILLE FICTIF' };
  S.ops[w.id].push(op(w, '2026-10-01', -1299, 'MARCHAND FICTIF'), op(w, '2026-10-10', -2500, 'AUTRE MARCHAND'));
  const p1 = op(a, '2026-10-03', -1299, 'PRLV PORTEFEUILLE FICTIF 123');
  const p2 = op(a, '2026-10-12', -2600, 'PRLV PORTEFEUILLE FICTIF 456');
  const p3 = op(a, '2026-10-20', -2500, 'PRLV PORTEFEUILLE FICTIF 789');
  const p4 = op(a, '2026-10-08', -2500, 'PRLV PORTEFEUILLE FICTIF 790');
  assert.deepEqual(cl(S, p1), ['interne', 'Virements internes', 'Règlement PORTEFEUILLE (détaillé)', 'reglement']);
  assert.equal(cl(S, p2)[0], 'depense');                 // montant différent
  assert.equal(cl(S, p3)[0], 'depense');                 // 10 jours après
  assert.equal(cl(S, p4)[0], 'interne');                 // 2 jours avant
  // l'opération du portefeuille reste une dépense, avec son marchand
  assert.deepEqual(cl(S, S.ops[w.id][0]).slice(0, 1), ['depense']);
});

test('opérations vues : date de départ, cochées, décochées ; marquer et annuler ; « à vérifier »', () => {
  const { S, a, b } = etat();
  const o1 = op(a, '2026-10-10', -100, 'A'), o2 = op(a, '2026-10-20', -100, 'B'), o3 = op(b, '2026-10-25', -100, 'C', { vue: true });
  S.ops[a.id].push(o1, o2); S.ops[b.id].push(o3);
  assert.equal(K.initialiserVues(S, Date.parse('2026-10-15T10:00:00Z')), true);
  assert.equal(K.initialiserVues(S, NOW), false);
  assert.deepEqual([o1, o2, o3].map(o => K.vue(S, o)), [true, false, true]);
  const av = K.marquer(S, [o1, o2, o3], false);
  assert.equal(av.length, 2);
  assert.deepEqual([o1, o2, o3].map(o => K.vue(S, o)), [false, false, false]);
  assert.equal(o1.vue, 0);
  K.annulerVues(av);
  assert.deepEqual([o1, o2, o3].map(o => K.vue(S, o)), [true, false, true]);
  assert.equal(o1.vue, false);
  a.aVerifier = true;
  const at = json(K.attention(K.contexte(S, NOW), NOW));
  assert.deepEqual(at, { unseen: 1, unclassified: 3, accountsToCheck: 1, toMatch: 0, gaps: 0 });
  b.masque = true;
  assert.deepEqual(json(K.attention(K.contexte(S, NOW), NOW)), { unseen: 1, unclassified: 2, accountsToCheck: 1, toMatch: 0, gaps: 0 });
  // non classées : 90 derniers jours seulement
  S.ops[a.id].push(op(a, '2026-06-01', -100, 'VIEUX'));
  assert.equal(K.attention(K.contexte(S, NOW), NOW).unclassified, 2);
});

test('« Classer » : mot-clé proposé, opérations concernées, règle (remplace la même), correction, annulation', () => {
  const { S, a, b } = etat();
  assert.equal(K.suggestKw('CARTE 24/09 CAFE DU PORT 33000 FICTIF'), 'CAFE PORT');
  assert.equal(K.suggestKw('PRLV SEPA OPERATEUR FICTIF REF123'), 'OPERATEUR FICTIF');
  // 0.10 : mot proposé présent tel quel dans le libellé
  assert.equal(K.motPropose('CARTE 24/09 CAFE DU PORT 33000 FICTIF'), 'CAFE');
  assert.equal(K.motPropose('PRLV SEPA OPERATEUR FICTIF REF123'), 'OPERATEUR FICTIF');
  assert.equal(K.motPropose('CB CAFE 12 GARE'), 'CAFE');
  assert.equal(K.motPropose('12/10'), '');
  const o = op(a, '2026-10-20', -450, 'CB CAFE DU PORT');
  S.ops[a.id].push(o, op(a, '2026-10-21', -450, 'CB CAFE DU PORT'), op(a, '2026-10-22', 100, 'REMB CAFE DU PORT'));
  S.ops[b.id].push(op(b, '2026-10-23', -450, 'CB CAFE DU PORT'));
  assert.equal(K.concernees(S, 'cafe du port').length, 4);
  assert.equal(K.concernees(S, 'cafe du port', { compte: a.id, sens: 'debit' }).length, 2);
  S.modele.vues = { depuis: '2026-01-01' };
  S.classement.regles.push({ mot: 'CAFE DU PORT', cat: 'Divers' });
  const snap = K.appliquer(S, o, { cat: 'Bars', sub: '', mot: 'Cafe du port', compte: a.id, sens: 'debit' });
  assert.deepEqual(json(S.classement.regles), [{ mot: 'Cafe du port', cat: 'Bars', sub: 'Bars', compte: a.id, sens: 'debit' }]);
  assert.equal(o.vue, true);
  assert.deepEqual(cl(S, S.ops[a.id][1]).slice(1, 4), ['Bars', 'Bars', 'regle']);
  assert.equal(cl(S, S.ops[b.id][0])[3], 'defaut');
  K.annuler(S, snap);
  assert.deepEqual(json(S.classement.regles), [{ mot: 'CAFE DU PORT', cat: 'Divers' }]);
  assert.equal(K.vue(S, o), false);
  const s2 = K.appliquer(S, o, { cat: 'Nouvelle catégorie fictive', sub: 'Détail' });
  assert.deepEqual(json(o.categorie), { cat: 'Nouvelle catégorie fictive', sub: 'Détail' });
  assert.equal(S.classement.categories['Nouvelle catégorie fictive'].nature, 'optionnelle');
  K.annuler(S, s2);
  assert.equal(o.categorie, null);
  assert.equal(S.classement.categories['Nouvelle catégorie fictive'], undefined);
  // catégories les plus utilisées : celle de l'opération en tête
  const f = json(K.frequentes(K.contexte(S, NOW), 'Bars', 3));
  assert.equal(f[0], 'Bars');
  assert.equal(f[1], 'Divers');
});

test('motifs proposés pour un prélèvement : débits récurrents (2 mois au moins) du compte de prélèvement', () => {
  const { S, a, k } = etat();
  S.ops[a.id].push(op(a, '2026-08-05', -100, 'PRLV SEPA ORGANISME FICTIF 1'), op(a, '2026-09-05', -200, 'PRLV SEPA ORGANISME FICTIF 2'),
    op(a, '2026-10-05', -300, 'PRLV SEPA ORGANISME FICTIF 3'), op(a, '2026-10-06', -300, 'CB UNE FOIS'), op(a, '2026-10-07', 300, 'VIR RECU ORGANISME FICTIF'));
  assert.deepEqual(json(K.propositions(S, k)), [{ motif: 'ORGANISME FICTIF', n: 3 }]);
});

test('catégories : création, renommage (règles suivies), suppression, nature ; règles ajoutées à la main ; annulation', () => {
  const S = M.vide();
  const a = M.nouveauCompte(S, { libelle: 'COURANT', role: 'courant' });
  S.ops[a.id] = [op(a, '2026-10-20', -1500, 'CB BOUQUINISTE FICTIF')];
  S.classement = K.nouveau();
  const s0 = K.creerCategorie(S, 'Lecture', 'optionnelle');
  assert.throws(() => K.creerCategorie(S, 'lecture'), /existe déjà/);
  K.ajouterRegle(S, 'BOUQUINISTE', 'Lecture', 'Livres');
  let r = K.classer(K.contexte(S, NOW), S.ops[a.id][0]);
  assert.deepEqual([r.cat, r.sub], ['Lecture', 'Livres']);
  K.renommerCategorie(S, 'Lecture', 'Livres & BD');
  r = K.classer(K.contexte(S, NOW), S.ops[a.id][0]);
  assert.equal(r.cat, 'Livres & BD');
  assert.equal(S.classement.regles[0].cat, 'Livres & BD');
  K.changerNature(S, 'Livres & BD', 'courante');
  assert.equal(K.natureDe(S.classement, 'Livres & BD'), 'courante');
  const s1 = K.supprimerCategorie(S, 'Livres & BD');
  assert.ok(!K.listeCategories(S.classement).includes('Livres & BD'));
  K.restaurer(S, s1);
  assert.ok(K.listeCategories(S.classement).includes('Livres & BD'));
  K.retirerRegle(S, 'bouquiniste');
  assert.equal(S.classement.regles.length, 0);
  K.restaurer(S, s0);
  assert.ok(!K.listeCategories(S.classement).includes('Lecture'));
});

// 1.1 : rapprochement à la main. Côté banque : rapprocher un prélèvement d'un achat choisi (± 30 jours, montant
// différent possible), ou le garder en dépense ; côté portefeuille : achat « payé autrement ». Tout est annulable.
test('portefeuille : rapprocher à la main, garder en dépense, payé autrement, annulation', () => {
  const { S, a, w } = etat();
  w.prelevement = { motif: 'PORTEFEUILLE FICTIF' };
  const achat = op(w, '2026-06-09', -5490, 'MARCHAND DE VETEMENTS FICTIF'), autre = op(w, '2026-06-20', -1000, 'AUTRE MARCHAND'), loin = op(w, '2026-03-01', -5490, 'ANCIEN ACHAT');
  S.ops[w.id].push(achat, autre, loin);
  const p = op(a, '2026-06-24', -5990, 'PRLV PORTEFEUILLE FICTIF 111');      // montant différent, 15 jours après
  const q = op(a, '2026-06-25', -800, 'PRLV PORTEFEUILLE FICTIF 222');
  S.ops[a.id].push(p, q);
  let cx = K.contexte(S, NOW);
  assert.equal(K.aRapprocher(cx, p).id, w.id);
  assert.equal(K.prelevementDe(cx, achat), null, 'aucun prélèvement de même montant');
  assert.equal(K.portefeuilleDe(cx, achat).id, w.id);
  assert.deepEqual(json(K.candidatsPortefeuille(cx, p, w).map(x => x.id)), [achat.id, autre.id], '± 30 jours, le plus proche en montant d\'abord');
  assert.deepEqual(json(K.candidatsBanque(cx, achat).map(x => x.id)), [p.id, q.id]);
  // rapprocher : prélèvement interne, achat réglé par lui
  const snap = K.rapprocherAvec(cx, p, w, achat);
  cx = K.contexte(S, NOW);
  assert.deepEqual(cl(S, p).slice(0, 2), ['interne', 'Virements internes']);
  assert.equal(K.aRapprocher(cx, p), null);
  assert.equal(K.prelevementDe(cx, achat).id, p.id);
  assert.equal(K.interneManuel(p), true);
  assert.deepEqual(json(K.candidatsBanque(cx, autre).map(x => x.id)), [q.id], 'déjà rapproché : plus proposé');
  K.annulerRapprochement(snap);
  cx = K.contexte(S, NOW);
  assert.equal(K.aRapprocher(cx, p).id, w.id, 'annulé');
  assert.equal(achat.rapprochement, undefined);
  // garder en dépense : plus « à rapprocher », compté en dépense
  const s2 = K.garderDepense(q);
  cx = K.contexte(S, NOW);
  assert.equal(K.aRapprocher(cx, q), null);
  assert.equal(cl(S, q)[0], 'depense');
  assert.equal(json(K.attention(cx, NOW)).toMatch, 1, 'seul le premier reste à rapprocher');
  K.annulerRapprochement(s2);
  assert.equal(K.aRapprocher(K.contexte(S, NOW), q).id, w.id);
  // payé autrement : l'achat n'est plus proposé
  const s3 = K.payeAutrement(autre);
  assert.equal(autre.rapprochement, 'autrement');
  assert.deepEqual(K.candidatsPortefeuille(K.contexte(S, NOW), q, w).map(x => x.id), [achat.id]);
  K.annulerRapprochement(s3);
  assert.equal(autre.rapprochement, undefined);
});
