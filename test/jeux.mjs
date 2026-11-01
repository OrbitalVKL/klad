// Jeux fictifs « mesures » et « personnel » (tools/mesures/donnees.mjs) chargés dans node comme au premier
// déverrouillage (reprise, classement, budget, commun, impôts), et leur relevé de contrôle. Sert à vérifier qu'un
// correctif ne change aucun chiffre sur des données sans le cas corrigé (références figées dans test/references/,
// produites par la version indiquée). Données fictives uniquement.
import { charge, json } from './charge.mjs';

export const FICHIERS = ['anon.js', 'eb.js', 'format.js', 'modele.js', 'reprise.js', 'classement.js', 'carnet.js', 'budget.js', 'commun.js', 'fisc.js',
  'observations.js', 'resume.js', 'controle.js', 'migrations.js'];

export function outils(extra) { return charge(FICHIERS.concat(extra || [])); }

// reprise : objet « klad-reprise » ; now : ms. → état Klad.
export async function etatDepuisReprise(X, reprise, now) {
  const { KladModele: M, KladReprise: RP, KladCarnet: CN, KladBudget: KB, KladCommun: KC, KladFisc: KF, KladMigrations: MG } = X;
  const rep = RP.valider(reprise);
  const S = M.vide();
  const choix = {}; for (const r of rep.comptes) choix[r.ref] = 'creer';
  RP.appliquer(S, rep, choix, { now });
  await CN.convertir(S, S.carnet, { now });
  KB.importer(S, S.carnet, { now, renommer: CN.renommeur(S.carnet) });
  KC.importer(S, S.carnet);
  KF.importer(S, S.carnet);
  await MG.payload(S, now);
  return S;
}

// Relevé de contrôle sans la date de fabrication ni la version.
export function releve(X, S, now) {
  const { KladClasse: K, KladBudget: KB, KladControle: KT } = X;
  const cx = K.contexte(S, now);
  const r = json(KT.construire(S, KB.contexte(S, now, cx), cx, now, { version: 'test' }));
  delete r.meta.genere;
  // identifiants de compte tirés au hasard à chaque chargement : remplacés par la référence de la reprise
  let t = JSON.stringify(r);
  const map = (S.modele.reprise && S.modele.reprise.map) || {};
  for (const ref of Object.keys(map)) t = t.split(map[ref]).join('@' + ref);
  return JSON.parse(t);
}
