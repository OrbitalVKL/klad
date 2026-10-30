// Tests : rendu de l'onglet Accueil (0.10.1) sur la reprise fictive — ordre des blocs, chiffres repris des fonctions de
// calcul (reste à vivre, soldes, postes du cycle, commun, échéances), aucun montant signé, lignes nommées.
// Données fictives uniquement.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { charge, montantSigne, texteVisible } from './charge.mjs';
import { repriseFictive } from './fictif.mjs';

const X = charge(['anon.js', 'eb.js', 'format.js', 'modele.js', 'reprise.js', 'classement.js', 'carnet.js', 'budget.js', 'commun.js', 'fisc.js', 'ui.js', 'vues.js', 'vbudget.js', 'vaccueil.js']);
const { KladModele: M, KladClasse: K, KladBudget: KB, KladCommun: KC, KladReprise: RP, KladCarnet: CN, KladVuesAccueil: VA, KladFormat: F } = X;
const NOW = Date.parse('2026-10-28T10:00:00Z');

async function etat() {
  const rep = RP.valider(repriseFictive('2026-10-28'));
  const S = M.vide();
  const choix = {}; for (const r of rep.comptes) choix[r.ref] = 'creer';
  RP.appliquer(S, rep, choix, { now: NOW });
  await CN.convertir(S, S.carnet, { now: NOW });
  KB.importer(S, S.carnet, { now: NOW, renommer: CN.renommeur(S.carnet) });
  KC.importer(S, S.carnet);
  return S;
}

test('accueil : blocs dans l\'ordre, chiffres des fonctions de calcul, aucun montant signé', async () => {
  const S = await etat();
  const cx = K.contexte(S, NOW), B = KB.contexte(S, NOW, cx);
  const res = KB.suivi(B, 'perso', null), fdm = KC.finDeMois(B), ech = KB.echeances(B, 31);
  const dettes = {};
  for (const c of S.modele.comptes) if (c.role === 'carte_differee') dettes[c.id] = K.dette(S, c, NOW);
  const h = VA.ecran({ S, B, now: NOW, ext: { attention: K.attention(cx, NOW), sauvegarde: { jours: null } }, res, dettes, livrets: {}, fdm,
    plan: KC.plan(B), R: KC.reglages(B), ech });
  const t = texteVisible(h).replace(/\s+/g, ' ');
  assert.match(t, /Reste à vivre jusqu'au[\s\S]*À vérifier[\s\S]*Soldes[\s\S]*Ce cycle-ci[\s\S]*Commun[\s\S]*Prochaines échéances[\s\S]*Synchroniser[\s\S]*Verrouiller/);
  assert.ok(t.includes(F.montant(Math.abs(res.rav.budget.reste)).replace(/\s/g, ' ')) || t.replace(/\s/g, '').includes(F.montant(Math.abs(res.rav.budget.reste)).replace(/\s/g, '')));
  assert.ok(t.replace(/\s/g, '').includes(F.montant(Math.abs(fdm.end)).replace(/\s/g, '')), 'fin de mois du commun');
  assert.ok(ech.slice(0, 1).every(e => t.includes(e.label)), 'première échéance');
  assert.ok(!montantSigne(h), 'aucun montant signé');
  assert.match(h, /data-mesure="rav"/);
  assert.match(h, /data-mesure="soldes"/);
  assert.match(h, /aria-label="COURANT, [^"]+"/);
  assert.match(h, /Aucune sauvegarde vérifiée/);
});

test('accueil : « Bilan du cycle précédent » les 5 premiers jours d\'un cycle seulement', () => {
  const per = { cyc: { start: '2026-10-27', end: '2026-11-26' }, past: false, prev: '2026-09-27' };
  assert.equal(VA.bilan({ per, jour: 2 }).cle, 'bilan');
  assert.equal(VA.bilan({ per, jour: 6 }), null);
  assert.equal(VA.bilan({ per: Object.assign({}, per, { past: true }), jour: 2 }), null);
  assert.equal(VA.surTitre({ per, jour: 2, nbJours: 31 }), 'Cycle du 27/10 au 26/11 · jour 2 sur 31');
});
