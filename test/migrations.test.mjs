// Tests : données figées de l'ancienne version sous « _payload » (format du fichier de reprise), migration 0.9.3 des
// données déjà présentes (idempotente, réversible, versions sautées), crédits de règlement de carte écartés.
// Jeu entièrement fictif (test/fictif.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { charge, json } from './charge.mjs';
import { repriseFictive } from './fictif.mjs';

const X = charge(['anon.js', 'eb.js', 'format.js', 'modele.js', 'reprise.js', 'classement.js', 'carnet.js', 'budget.js', 'commun.js', 'fisc.js', 'migrations.js']);
const { KladModele: M, KladReprise: RP, KladClasse: K, KladCarnet: CN, KladBudget: KB, KladCommun: KC, KladFisc: KF, KladMigrations: MG } = X;
const AUJ = '2026-10-28', NOW = Date.parse(AUJ + 'T12:00:00Z');
const REMB = 'PRELEVEMENT AUTOMATIQUE|MERCI';
const CREDIT = { date: '2026-10-26', montant: 11400, libelle: 'PRELEVEMENT AUTOMATIQUE ENREGISTRE MERCI', statut: 'comptabilisee' };

// Fichier de reprise au format de l'architecte : payload sous carnet._payload (avec budgets, revenu prévu, équilibre).
function repriseUnderscore(opts = {}) {
  const rep = repriseFictive(AUJ);
  const C = rep.carnet;
  const eq = C.klad.equilibre;
  C._payload = { rules: C.P.rules, budgets: { perso: { Alimentation: 160 } }, revenuPrevu: { perso: 2500, commun: 1400 }, eqops: eq.ops, equip: eq.equip };
  delete C.P;
  delete eq.ops; delete eq.equip;                       // seulement dans le payload, comme dans l'ancienne version
  C.klad.cartes.r3.remboursements = REMB;
  if (opts.sansBplan) { delete C.bplan; delete C.revprev; }
  return JSON.parse(JSON.stringify(rep));               // fichier lu comme sur le téléphone
}

// Premier déverrouillage après la reprise (mêmes étapes que l'appli), avec ou sans lecture du payload.
async function ouvrir(rep, opts = {}) {
  const S = M.vide();
  const v = RP.valider(rep);
  const choix = {}; for (const c of v.comptes) choix[c.ref] = 'creer';
  RP.appliquer(S, v, choix, { now: NOW });
  const cache = opts.commeLa092 ? S.carnet._payload : null;     // la 0.9.2 ne lisait pas « _payload »
  if (cache) delete S.carnet._payload;
  await CN.convertir(S, S.carnet, { now: NOW });
  KB.importer(S, S.carnet, { now: NOW, renommer: CN.renommeur(S.carnet) });
  KC.importer(S, S.carnet);
  KF.importer(S, S.carnet);
  if (cache) S.carnet._payload = cache;
  return S;
}
const carte = S => S.modele.comptes.find(c => c.role === 'carte_differee');
const chiffres = S => {
  const B = KB.contexte(S, NOW);
  const s = KB.suivi(B, 'perso', null), c = KB.suivi(B, 'commun', null), e = KC.equilibre(B);
  return json({ fixe: s.T.fixe, courante: s.T.courante, total: s.total, commun: c.total, eq: e && [e.invMoi, e.invAutre, e.ecart] });
};

test('fichier de reprise : payload lu sous « _payload » (règles de base, équilibre), comme sous « P »', async () => {
  const S = await ouvrir(repriseUnderscore());
  assert.equal(CN.utilisable(S.carnet), true);
  assert.ok(S.classement.base.length >= 17, 'règles de base reprises');
  assert.equal(S.classement.import.payload, true);
  const B = KB.contexte(S, NOW);
  const o = (S.ops[S.modele.reprise.map.r0] || []).find(x => /ASSURANCE AUTO/.test(x.libelle));
  assert.deepEqual(json(K.classer(B.cx, o)).cat, 'Assurances');
  assert.ok(KC.reglages(B).equilibre.ops.length === 3 && KC.reglages(B).equilibre.equip.length === 2);
  // même résultat qu'avec « P »
  const repP = repriseUnderscore(); repP.carnet.P = repP.carnet._payload; delete repP.carnet._payload;
  assert.deepEqual(chiffres(await ouvrir(repP)), chiffres(S));
});

test('payload : budgets par défaut et revenu prévu quand le carnet n\'en a pas', async () => {
  const S = await ouvrir(repriseUnderscore({ sansBplan: true }));
  assert.equal(S.budget.plan.perso['c|Alimentation'].amt, 16000);
  assert.deepEqual(json(S.budget.revprev), { perso: 250000, commun: 140000 });
});

test('migration 0.9.3 : complète les données de la 0.9.2 sans écraser ce qui a été modifié dans Klad', async () => {
  const neuf = await ouvrir(repriseUnderscore());
  const S = await ouvrir(repriseUnderscore(), { commeLa092: true });
  assert.ok(S.classement.base.length < neuf.classement.base.length, 'la 0.9.2 n\'avait pas les règles de base');
  // modifications faites dans Klad depuis : un poste retiré du plan, un autre modifié, une nature changée
  delete S.budget.plan.perso['f|Téléphone'];
  S.budget.plan.perso['c|Alimentation'].amt = 17500;
  S.classement.categories['Bien-être'].nature = 'courante';
  delete S.budget.revprev.commun;
  // crédit de règlement reçu de la banque sur la carte
  M.opsDe(S, carte(S).id).push(Object.assign({ id: carte(S).id + ':h:credit', source: 'eb' }, CREDIT));
  const avant = JSON.stringify(json(S));

  const r = await MG.payload(S, NOW);
  assert.equal(r.change, true);
  assert.equal(r.base, neuf.classement.base.length);
  assert.equal(r.postes, 1);
  assert.equal(r.revprev, 1);
  assert.equal(r.ecartees, 1);
  assert.equal(r.eqops, 3);
  assert.deepEqual(json(S.classement.base), json(neuf.classement.base));
  assert.equal(S.budget.plan.perso['f|Téléphone'].amt, 1999);
  assert.equal(S.budget.plan.perso['c|Alimentation'].amt, 17500, 'poste modifié gardé');
  assert.equal(S.classement.categories['Bien-être'].nature, 'courante', 'nature modifiée gardée');
  assert.equal(S.budget.revprev.commun, 140000);
  assert.equal((S.ops[carte(S).id] || []).filter(o => o.montant > 0).length, 0);
  // mêmes chiffres qu'un import neuf (aux modifications près : on les annule sur la copie neuve)
  neuf.budget.plan.perso['c|Alimentation'].amt = 17500;
  neuf.classement.categories['Bien-être'].nature = 'courante';
  assert.deepEqual(chiffres(S), chiffres(neuf));

  // idempotente : marquée faite, puis sans effet si on la rejoue
  assert.equal(MG.faite(S), true);
  assert.equal(await MG.payload(S, NOW), null);
  const sansMarque = s => { const o = json(s); delete o.modele.migrations; return o; };
  const apres = sansMarque(S);
  delete S.modele.migrations.payload;
  const r2 = await MG.payload(S, NOW);
  assert.equal(r2.change, false);
  assert.deepEqual(sansMarque(S), apres);

  // réversible : retour exact à l'état d'avant (on refait la migration depuis l'état 0.9.2)
  const S2 = JSON.parse(avant);
  await MG.payload(S2, NOW);
  assert.equal(MG.annulerPayload(S2), true);
  delete S2.modele.migrations;
  const ref = JSON.parse(avant); delete ref.modele.migrations;
  assert.deepEqual(S2, ref);
});

test('migration 0.9.3 : versions sautées (données d\'avant la 0.5, sans classement ni budget) → import complet, puis rien à faire', async () => {
  const rep = repriseUnderscore();
  const S = M.vide();
  const v = RP.valider(rep);
  const choix = {}; for (const c of v.comptes) choix[c.ref] = 'creer';
  RP.appliquer(S, v, choix, { now: NOW });
  assert.equal(S.classement, null);
  // premier déverrouillage de la 0.9.3 : import complet (payload lu), puis migration sans effet
  await CN.convertir(S, S.carnet, { now: NOW });
  KB.importer(S, S.carnet, { now: NOW, renommer: CN.renommeur(S.carnet) });
  KC.importer(S, S.carnet); KF.importer(S, S.carnet);
  const r = await MG.payload(S, NOW);
  assert.equal(r.change, false);
  assert.equal(r.postes + r.revprev + r.ecartees, 0);
  assert.deepEqual(chiffres(S), chiffres(await ouvrir(repriseUnderscore())));
  // carnet absent : rien à faire, rien de marqué
  const V = M.vide();
  assert.equal(await MG.payload(V, NOW), null);
  assert.equal(MG.faite(V), false);
});

test('crédits de règlement d\'une carte écartés à l\'import, selon le motif de sa fiche (rien sans motif)', async () => {
  const S = await ouvrir(repriseUnderscore());
  const k = carte(S);
  const raw = [
    { transaction_amount: { amount: '114.00', currency: 'EUR' }, credit_debit_indicator: 'CRDT', status: 'BOOK', booking_date: '2026-10-26', remittance_information: ['PRELEVEMENT AUTOMATIQUE ENREGISTRE MERCI'] },
    { transaction_amount: { amount: '12.50', currency: 'EUR' }, credit_debit_indicator: 'DBIT', status: 'BOOK', booking_date: '2026-10-26', remittance_information: ['CB LIBRAIRIE FICTIVE'] },
    { transaction_amount: { amount: '20.00', currency: 'EUR' }, credit_debit_indicator: 'CRDT', status: 'BOOK', booking_date: '2026-10-27', remittance_information: ['AVOIR BOUTIQUE FICTIVE'] }];
  const st = M.integrer(S, k.id, raw, NOW);
  assert.equal(st.ecartees, 1);
  assert.equal(st.nouvelles, 2);
  assert.ok(!S.ops[k.id].some(o => /MERCI/.test(o.libelle)));
  assert.ok(S.ops[k.id].some(o => /AVOIR/.test(o.libelle)), 'un remboursement ordinaire reste');
  // compte courant : jamais écarté ; carte sans motif : rien d'écarté
  assert.equal(M.creditDeReglement(S.modele.comptes.find(c => c.role === 'courant'), Object.assign({}, CREDIT)), false);
  delete k.prelevement.remboursements;
  assert.equal(M.creditDeReglement(k, Object.assign({}, CREDIT)), false);
});

test('état de l\'import (Plus › Contrôle) : compteurs, import incomplet repérable', async () => {
  const e = MG.etatImport(await ouvrir(repriseUnderscore()));
  assert.equal(e.carnet, true);
  assert.ok(e.reglesBase >= 17 && e.reglesBaseCarnet === 17 && e.postes >= 13);
  assert.equal(e.mouvementsEquilibre, 3);
  assert.equal(e.equipements, 2);
  const f = MG.etatImport(await ouvrir(repriseUnderscore(), { commeLa092: true }));
  assert.ok(f.reglesBase < e.reglesBase);
});
