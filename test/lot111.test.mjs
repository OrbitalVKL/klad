// Tests 1.1.1 : écart de rapprochement à la main (prélèvement de portefeuille ≠ achat). L'écart est compté une seule
// fois, dans la catégorie de l'achat ; les soldes ne bougent pas ; « Annuler » rend l'état d'avant ; signalé dans
// « À vérifier » au-delà de 2 € jusqu'à « Écart vérifié » ; relevé de contrôle identique quand les montants sont égaux.
// Tolérance plafonnée : 15 € d'écart sur une charge fixe → dépassement ; 1 € → reste vert. Données fictives uniquement.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { charge, json } from './charge.mjs';

const X = charge(['anon.js', 'eb.js', 'format.js', 'modele.js', 'classement.js', 'carnet.js', 'budget.js', 'commun.js', 'fisc.js', 'observations.js', 'resume.js', 'controle.js', 'ui.js', 'vues.js']);
const { KladModele: M, KladClasse: K, KladBudget: KB, KladControle: KT, KladVues: V } = X;
const NOW = Date.parse('2026-10-28T10:00:00Z');
let n = 0;
const op = (c, date, montant, libelle, o) => Object.assign({ id: c.id + ':x:k' + String(n++).padStart(4, '0') + '.0', compte: c.id, date, montant, libelle, statut: 'comptabilisee', source: 'reprise', categorie: null, vue: true }, o || {});

function etat() {
  const S = M.vide();
  const a = M.nouveauCompte(S, { libelle: 'COURANT', role: 'courant', solde: { centimes: 150000, date: '2026-10-28' } });
  const w = M.nouveauCompte(S, { libelle: 'PORTEFEUILLE', role: 'paiement_en_ligne', prelevement: { motif: 'PORTEFEUILLE FICTIF' } });
  S.modele.reprise = { map: { r0: a.id, r4: w.id }, importee: '2026-01-01T00:00:00Z', nb: 0 };
  S.classement = K.nouveau();
  S.classement.regles = [{ mot: 'SALAIRE FICTIF', cat: 'Salaire', sub: 'Salaire', sens: 'credit' }, { mot: 'MARCHAND FICTIF', cat: 'Shopping', sub: 'Vêtements' },
    { mot: 'ASSURANCE FICTIVE', cat: 'Assurances', sub: 'Assurance habitation' }, { mot: 'LIBRAIRIE FICTIVE', cat: 'Loisirs', sub: 'Livres' }];
  const achat = op(w, '2026-10-10', -5000, 'MARCHAND FICTIF VETEMENTS');
  const prel = op(a, '2026-10-25', -5000, 'PRLV PORTEFEUILLE FICTIF 111');   // 15 jours après : pas de rapprochement automatique
  S.ops[a.id] = [op(a, '2026-09-26', 200000, 'VIR SALAIRE FICTIF PAIE'), op(a, '2026-10-27', 200000, 'VIR SALAIRE FICTIF PAIE'), prel,
    op(a, '2026-09-30', -5000, 'PRLV ASSURANCE FICTIVE'), op(a, '2026-10-28', -5000, 'PRLV ASSURANCE FICTIVE')].sort((x, y) => (x.date < y.date ? 1 : -1));
  S.ops[w.id] = [op(w, '2026-10-26', -1234, 'LIBRAIRIE FICTIVE'), achat];
  S.budget = KB.nouveau();
  S.budget.plan.perso = { 'c|Shopping': { on: true, amt: 20000 }, 'f|Assurance habitation': { on: true, amt: 5000 }, 'r|Salaire': { on: true, mode: 'dernier' } };
  S.budget.reglages = { cycle: 'mois', salaire: { motif: 'SALAIRE FICTIF', paie: 'PAIE', min: 1000, minCycle: 500 }, commun: { moi: 'Personne A', autre: 'Personne B' } };
  return { S, a, w, achat, prel };
}
const ctx = S => KB.contexte(S, NOW, K.contexte(S, NOW));
const ligne = (S, key) => { const r = KB.suivi(ctx(S), 'perso', null); for (const nk of Object.keys(r.sections)) { const x = r.sections[nk].lignes.find(l => l.key === key); if (x) return x; } return null; };
const releve = S => { const cx = K.contexte(S, NOW); return json(KT.construire(S, KB.contexte(S, NOW, cx), cx, NOW, { version: '9.9.9' })); };
// relevé sans la date de fabrication
const sansDate = r => { const x = JSON.parse(JSON.stringify(r)); delete x.meta.genere; return x; };
const rapprocher = (S, prel, w, achat) => K.rapprocherAvec(K.contexte(S, NOW), prel, w, achat);

test('montants égaux : relevé de contrôle identique à celui de la 1.1.0, aucun écart', () => {
  // 1.1.0 : un prélèvement rapproché d'un achat de même montant devient interne, exactement comme « Marquer interne »
  // (chemin inchangé depuis la 1.0) ; la 1.1.1 ne doit rien ajouter au relevé dans ce cas.
  const e1 = etat(), S2 = JSON.parse(JSON.stringify(e1.S));
  const e2 = { S: S2, w: M.compte(S2, e1.w.id), prel: S2.ops[e1.a.id].find(o => o.id === e1.prel.id) };
  assert.equal(K.aRapprocher(K.contexte(e1.S, NOW), e1.prel).id, e1.w.id);
  rapprocher(e1.S, e1.prel, e1.w, e1.achat);
  K.marquerInterne(K.contexte(e2.S, NOW), e2.prel, e2.w);
  const r1 = sansDate(releve(e1.S)), r2 = sansDate(releve(e2.S));
  assert.equal(K.ecartDe(K.contexte(e1.S, NOW), e1.prel), null);
  assert.equal(r1.ecartsRapprochement, undefined);
  assert.equal(r1.aVerifier.ecartsAVerifier, undefined);
  assert.deepEqual(Object.keys(r1), Object.keys(r2));
  assert.deepEqual(r1, r2);
  assert.equal(ctx(e1.S).rows.filter(r => r.ecart).length, 0);
});

test('écart compté une seule fois dans la catégorie de l\'achat, soldes inchangés, annulation', () => {
  const { S, a, w, achat, prel } = etat();
  prel.montant = -5600;                         // 6 € de frais : prélèvement plus grand que l'achat
  const total = () => { const r = KB.suivi(ctx(S), 'perso', null); return Object.values(r.sections).reduce((t, s) => t + s.lignes.reduce((u, l) => u + (l.cur || 0), 0), 0) + r.horsBudget.c; };
  const avant = { shop: ligne(S, 'c|Shopping').cur, total: total(), solde: M.soldeAffiche(S, M.compte(S, a.id)), rel: sansDate(releve(S)) };
  assert.equal(avant.shop, 5000, 'avant : achat (50 €) dans Shopping, prélèvement (56 €) compté à part, « à rapprocher »');
  const snap = rapprocher(S, prel, w, achat);
  const cx = K.contexte(S, NOW);
  const e = K.ecartDe(cx, prel);
  assert.deepEqual([e.ecart, e.achat.id, e.banque.id], [600, achat.id, prel.id]);
  assert.equal(K.ecartDe(cx, achat).ecart, 600, 'vu aussi depuis l\'achat');
  // compté une seule fois : 50 € d'achat + 6 € d'écart = le montant prélevé ; le prélèvement lui-même n'est plus compté
  assert.equal(ligne(S, 'c|Shopping').cur, 5600);
  assert.equal(total(), avant.total - 5000);
  assert.equal(ctx(S).rows.filter(r => r.ecart).length, 1);
  assert.deepEqual(json(M.soldeAffiche(S, M.compte(S, a.id))), json(avant.solde), 'solde du compte inchangé');
  // « À vérifier » (plus de 2 €) et relevé
  assert.equal(json(K.attention(cx, NOW)).gaps, 1);
  assert.ok(V.lignesAVerifier(S, NOW, { attention: K.attention(cx, NOW) }).some(l => l.cle === 'ecarts' && /1 écart de rapprochement à vérifier/.test(l.texte)));
  const r = releve(S);
  assert.equal(r.aVerifier.ecartsAVerifier, 1);
  assert.deepEqual(r.ecartsRapprochement, [{ date: '2026-10-25', compte: 'r0', prelevement: idOf(prel), achat: idOf(achat), montantPreleve: 5600, montantAchat: 5000, ecart: 600,
    categorie: 'Shopping', poste: 'Vêtements', aVerifier: true }]);
  // filtre « Écarts à vérifier » de la liste des opérations
  assert.deepEqual(json(V.filtrer(S, { cat: '__ecart' }, cx).map(o => o.id)), [prel.id]);
  // détail : mention sur les deux opérations, sans montant négatif
  for (const o of [prel, achat]) {
    const h = V.detail(S, o, cx);
    assert.match(h, /Écart de rapprochement<\/dt><dd>6,00\s€ · prélèvement de 56,00\s€, achat de 50,00\s€ : écart compté en dépense \(Shopping › Vêtements\) · à vérifier/);
    assert.doesNotMatch(h, /-\s?6,00|−\s?6,00/);
  }
  assert.match(V.detail(S, prel, cx), /data-a="ecartvu"/);
  // écart vérifié : plus signalé, toujours compté
  const sv = K.marquerEcartVu(prel, true);
  assert.equal(json(K.attention(K.contexte(S, NOW), NOW)).gaps, 0);
  assert.equal(ligne(S, 'c|Shopping').cur, 5600);
  assert.match(V.detail(S, prel, K.contexte(S, NOW)), /data-a="ecartnonvu"/);
  K.annulerEcartVu(sv);
  assert.equal(json(K.attention(K.contexte(S, NOW), NOW)).gaps, 1);
  // annulation : état d'avant (budget, relevé)
  K.annulerRapprochement(snap);
  assert.equal(ligne(S, 'c|Shopping').cur, avant.shop);
  assert.deepEqual(sansDate(releve(S)), avant.rel);
  assert.equal(achat.rapprochement, undefined);
});
const idOf = o => String(o.id).slice(String(o.id).indexOf(':x:') + 3);

test('écart de 2 € au plus : compté, pas signalé ; prélèvement plus petit : compté en moins', () => {
  const { S, w, achat, prel } = etat();
  prel.montant = -5150;
  rapprocher(S, prel, w, achat);
  assert.equal(ligne(S, 'c|Shopping').cur, 5150);
  assert.equal(json(K.attention(K.contexte(S, NOW), NOW)).gaps, 0, '1,50 € : pas signalé');
  const { S: S2, w: w2, achat: a2, prel: p2 } = etat();
  p2.montant = -4500;                           // le reste payé avec le solde du portefeuille
  rapprocher(S2, p2, w2, a2);
  assert.equal(ligne(S2, 'c|Shopping').cur, 4500, 'dépense comptée = montant prélevé');
  const h = V.detail(S2, p2, K.contexte(S2, NOW));
  assert.match(h, /5,00\s€ · prélèvement de 45,00\s€, achat de 50,00\s€ : écart compté en moins/);
  // confirmation avant de rapprocher : prélèvement, achat, écart, catégorie
  const c = V.confirmationEcart(S2, K.contexte(S2, NOW), p2, a2);
  assert.match(c, /Écart de rapprochement<\/dt><dd>5,00\s€/);
  assert.match(c, /est compté en moins dans « Shopping › Vêtements »/);
  assert.match(c, /data-rapok="1"/);
});

test('exclusion de l\'écart du budget (même id que le prélèvement) et tendance', () => {
  const { S, w, achat, prel } = etat();
  prel.montant = -5600;
  rapprocher(S, prel, w, achat);
  S.budget.exc = { [prel.id]: true };
  assert.equal(ligne(S, 'c|Shopping').cur, 5000);
});

test('tolérance plafonnée sur une charge fixe : 15 € → dépassement, 1 € → vert', () => {
  const { S, a } = etat();
  const ass = S.ops[a.id].find(o => o.date === '2026-10-28');
  ass.montant = -5100;
  let x = ligne(S, 'f|Assurance habitation');
  assert.deepEqual([x.cls, x.etat.niveau], ['ok', 'good'], '1 € de plus : reste vert');
  ass.montant = -6500;
  x = ligne(S, 'f|Assurance habitation');
  assert.deepEqual([x.cls, x.etat.niveau], ['over', 'bad'], '15 € de plus : dépassement');
  // charge de 1 000 € : 15 € de plus → dépassement malgré 2 % (20 €) ; 10 € → toléré
  S.budget.plan.perso['f|Assurance habitation'].amt = 100000;
  ass.montant = -101500;
  assert.equal(ligne(S, 'f|Assurance habitation').cls, 'over');
  ass.montant = -101000;
  assert.equal(ligne(S, 'f|Assurance habitation').cls, 'ok');
});
