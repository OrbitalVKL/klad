#!/usr/bin/env node
// Compare deux relevés de contrôle (klad-controle v1), en général celui de Klad et celui de l'ancienne version, et
// écrit un rapport en français, point par point (1 à 10) : identique ou écart, avec les deux valeurs. Chaque écart est
// diagnostiqué grâce à l'empreinte des données d'entrée (point 11) : « données d'entrée différentes » (opérations
// présentes d'un seul côté, listées) ou « même entrée, calcul différent » (défaut à corriger).
//
// Usage : node tools/controle/comparer.mjs <relevé Klad.json> <relevé ancienne version.json> [--sortie rapport.txt]
// Code de sortie : 0 si tout est identique, 1 s'il y a des écarts, 2 en cas d'erreur.
import fs from 'node:fs';

export const POINTS = [
  [1, 'comptes', 'Comptes (soldes, dette de carte)'],
  [2, 'resteAVivre', 'Reste à vivre (cycle en cours)'],
  [3, 'budget', 'Budget perso (cycle en cours et précédent)'],
  [4, 'commun', 'Compte commun (mois en cours)'],
  [5, 'equilibre', 'Équilibre des apports'],
  [6, 'contrats', 'Contrats et échéances à 31 jours'],
  [7, 'impots', 'Impôts, taxe foncière, livret, épargne salariale'],
  [8, 'observations', 'Observations'],
  [9, 'aVerifier', '« À vérifier »'],
  [10, 'grafit', 'Résumé Grafit']
];
// Données que l'ancienne version ne calcule pas (null de son côté) : non comparables, pas des écarts.
const NON_DISPO = [/^comptes\.[^.]+\.(role|libelle|prelevement)$/, /^equilibre\.date$/, /^contrats\.echeances31$/, /^impots\.livret\.interets$/,
  /^aVerifier\.(aRapprocher|comptesAVerifier)$/, /^grafit$/, /^observations\.[^.]+\.titre$/];
// Champs purement descriptifs : affichés, jamais comptés comme écarts.
const DESCRIPTIFS = [/^comptes\.[^.]+\.(libelle|role)$/, /^observations\.[^.]+\.(titre|perimetre)$/, /^contrats\.liste\.[^.]+\.perimetre$/];
// Clés des listes (appariement des éléments) ; à défaut, l'ordre.
const CLES = { comptes: 'ref', postes: 'cle', liste: x => x.perimetre + '|' + x.libelle, observations: x => x.code + '|' + x.niveau,
  regularisations: x => x.annee + '|' + x.sorte, echeances31: x => x.date + '|' + x.libelle + '|' + x.montant };
// Tolérance (centimes) : budgets arrondis à l'euro dans l'ancienne version, sinon un centime (arrondi des sommes).
const tolerance = ch => (/(^|\.)(budget|prevu|demande)$/.test(ch) ? 50 : 1);
const ENTIERS = /(^|\.)(nb|mois|periodicite|annee|nonVues|nonClassees|aRapprocher|comptesAVerifier|v|parts|tmi)$/;

const fr = n => (Math.abs(n) / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/[  ]/g, ' ');
const affiche = (ch, v) => (v == null ? '—' : typeof v === 'number' && !ENTIERS.test(ch) && Number.isInteger(v) ? (v < 0 ? 'moins ' : '') + fr(v) + ' €'
  : typeof v === 'object' && v.ref ? 'compte ' + v.ref + (v.solde != null ? ', solde ' + fr(v.solde) + ' €' + (v.solde < 0 ? ' débiteur' : '') : '') + (v.dette != null ? ', dette ' + fr(v.dette) + ' €' : '') + (v.date ? ' au ' + v.date : '')
  : typeof v === 'object' ? (v.titre ? '« ' + v.titre + ' »' + (v.chiffres && v.chiffres.length ? ' (' + v.chiffres.map(x => fr(x) + ' €').join(', ') + ')' : '') : JSON.stringify(v)) : String(v));
const cleDe = (nom, x, i) => { const k = CLES[nom]; return k == null ? String(i) : typeof k === 'function' ? k(x) : String(x[k]); };
const non = (re, ch) => re.some(r => r.test(ch));

// Différences entre a (relevé 1) et b (relevé 2) : [{ chemin, a, b, sorte: 'ecart' | 'nondispo' }].
export function differences(a, b, ch, out) {
  out = out || [];
  if (a === undefined) a = null;
  if (b === undefined) b = null;
  if (a === null || b === null) {
    if (a === null && b === null) return out;
    if (non(DESCRIPTIFS, ch)) return out;
    out.push({ chemin: ch, a, b, sorte: (b === null && non(NON_DISPO, ch)) || (a === null && non(NON_DISPO, ch)) ? 'nondispo' : 'ecart' });
    return out;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    const nom = ch.split('.').pop(), A = new Map(), Bm = new Map();
    a.forEach((x, i) => A.set(cleDe(nom, x, i), x));
    b.forEach((x, i) => Bm.set(cleDe(nom, x, i), x));
    for (const [k, x] of A) differences(x, Bm.has(k) ? Bm.get(k) : null, ch + '.' + k, out);
    for (const [k, x] of Bm) if (!A.has(k)) differences(null, x, ch + '.' + k, out);
    return out;
  }
  if (typeof a === 'object' && typeof b === 'object') {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) differences(a[k], b[k], ch ? ch + '.' + k : k, out);
    return out;
  }
  if (non(DESCRIPTIFS, ch)) return out;
  if (typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) > (ENTIERS.test(ch) ? 0 : tolerance(ch)) : a !== b) out.push({ chemin: ch, a, b, sorte: 'ecart' });
  return out;
}

// Observations présentes d'un seul côté mais de même niveau, mêmes montants et titres proches (mots communs) :
// la même observation, formulée autrement. Retirées des écarts ; → [{ a, b }] (titres).
const mots = c => new Set(String(c).split('-').filter(w => w.length > 2));
function apparier(D) {
  const A = D.filter(d => d.sorte === 'ecart' && d.a && !d.b && d.a.code), B = D.filter(d => d.sorte === 'ecart' && d.b && !d.a && d.b.code), out = [];
  for (const x of A) {
    const ma = mots(x.a.code);
    const y = B.find(z => !z.pris && z.b.niveau === x.a.niveau && JSON.stringify(z.b.chiffres) === JSON.stringify(x.a.chiffres) &&
      [...mots(z.b.code)].filter(w => ma.has(w)).length >= Math.max(1, Math.ceil(Math.min(ma.size, mots(z.b.code).size) / 2)));
    if (y) { y.pris = true; x.sorte = y.sorte = 'meme'; out.push({ a: x.a.titre, b: y.b.titre }); }
  }
  return out;
}

// ------------------------------------------------------------ point 11 : données d'entrée
// Opérations d'un paquet → présentes d'un seul côté (appariées par id, puis par date et montant).
function seulesDUnCote(pa, pb) {
  const A = (pa && pa.ops) || [], B = ((pb && pb.ops) || []).slice();
  const ids = new Map(B.map((o, i) => [o[0], i])), pris = new Set(), seulA = [];
  const restantsA = [];
  for (const o of A) { const i = ids.get(o[0]); if (i != null && !pris.has(i)) pris.add(i); else restantsA.push(o); }
  for (const o of restantsA) {
    const i = B.findIndex((x, j) => !pris.has(j) && x[1] === o[1] && x[2] === o[2]);
    if (i >= 0) pris.add(i); else seulA.push(o);
  }
  return { seulA, seulB: B.filter((x, j) => !pris.has(j)) };
}
// → { cycles: { courant, precedent }, commun : [{ mois, seulA, seulB }], bornes : [texte] }
export function entrees(RA, RB) {
  const EA = (RA && RA.empreinte) || {}, EB = (RB && RB.empreinte) || {}, out = { cycles: {}, commun: [], bornes: [] };
  for (const k of ['courant', 'precedent']) {
    const ca = EA.cycles && EA.cycles[k], cb = EB.cycles && EB.cycles[k];
    if (!ca || !cb) { if (ca || cb) out.bornes.push('cycle ' + (k === 'courant' ? 'en cours' : 'précédent') + ' présent d\'un seul côté'); continue; }
    if (ca.debut !== cb.debut || ca.fin !== cb.fin) out.bornes.push('cycle ' + (k === 'courant' ? 'en cours' : 'précédent') + ' : ' + ca.debut + ' → ' + ca.fin + ' / ' + cb.debut + ' → ' + cb.fin);
    const refs = new Set([...(ca.comptes || []).map(x => x.ref), ...(cb.comptes || []).map(x => x.ref)]);
    const L = [];
    for (const r of refs) {
      const d = seulesDUnCote((ca.comptes || []).find(x => x.ref === r), (cb.comptes || []).find(x => x.ref === r));
      if (d.seulA.length || d.seulB.length) L.push(Object.assign({ ref: r }, d));
    }
    out.cycles[k] = L;
  }
  const mb = new Map(((EB.commun) || []).map(x => [x.mois, x]));
  for (const ma of EA.commun || []) {
    const d = seulesDUnCote(ma, mb.get(ma.mois));
    if (d.seulA.length || d.seulB.length) out.commun.push(Object.assign({ mois: ma.mois }, d));
  }
  return out;
}
const ENTREES_DU_POINT = { 2: ['courant'], 3: ['courant', 'precedent'], 4: ['commun'], 5: ['commun'] };

// ------------------------------------------------------------ rapport
const ligneOp = o => '      ' + o[1] + '  ' + affiche('', o[2]).padStart(14) + '  ' + String(o[3] || '').slice(0, 50) + '  (' + o[0] + ')';
function listeEntrees(groupes, nomA, nomB, max) {
  const L = [];
  for (const g of groupes) {
    const quoi = g.ref ? 'compte ' + g.ref : 'commun ' + g.mois;
    if (g.seulA.length) { L.push('    ' + quoi + ' : ' + g.seulA.length + ' opération(s) seulement dans ' + nomA); g.seulA.slice(0, max).forEach(o => L.push(ligneOp(o))); }
    if (g.seulB.length) { L.push('    ' + quoi + ' : ' + g.seulB.length + ' opération(s) seulement dans ' + nomB); g.seulB.slice(0, max).forEach(o => L.push(ligneOp(o))); }
  }
  return L;
}
const nomSource = R => (R && R.source === 'carnet' ? 'l\'ancienne version' : R && R.source === 'klad' ? 'Klad' : 'le relevé');

export function comparer(RA, RB) {
  for (const R of [RA, RB]) if (!R || R.format !== 'klad-controle' || R.v !== 1) throw new Error('Fichier non reconnu : relevé de contrôle klad-controle v1 attendu.');
  const nA = nomSource(RA), nB = nomSource(RB) === nA ? nA + ' (2)' : nomSource(RB);
  const E = entrees(RA, RB);
  const toutes = [...Object.values(E.cycles).flat(), ...E.commun];
  const lignes = [], bilan = [];
  lignes.push('Contrôle Klad / ancienne version — relevés du ' + (RA.meta && RA.meta.aujourdhui) + ' (' + nA + ', ' + (RA.meta && RA.meta.version) + ') et du ' + (RB.meta && RB.meta.aujourdhui) + ' (' + nB + ')');
  if (RA.meta && RB.meta && RA.meta.aujourdhui !== RB.meta.aujourdhui) lignes.push('Attention : les deux relevés ne sont pas du même jour.');
  lignes.push('');
  let nbEcarts = 0;
  for (const [n, cle, titre] of POINTS) {
    const D = differences(RA[cle], RB[cle], cle);
    const memes = cle === 'observations' ? apparier(D) : [];
    const ec = D.filter(d => d.sorte === 'ecart'), nd = D.filter(d => d.sorte === 'nondispo');
    const ndB = nd.filter(d => d.b === null).length, ndA = nd.length - ndB;
    const nonDispo = [ndB ? ndB + ' valeur(s) non disponible(s) dans ' + nB : '', ndA ? ndA + ' valeur(s) non disponible(s) dans ' + nA : ''].filter(Boolean).join(', ');
    const memeTitre = memes.length ? '    ' + memes.length + ' observation(s) identique(s) au titre près : ' + memes.map(m => '« ' + m.a + ' » / « ' + m.b + ' »').join(' ; ') + '.' : '';
    if (!ec.length && (RA[cle] == null) !== (RB[cle] == null)) {
      lignes.push(n + '. ' + titre + ' : non comparable (absent de ' + (RB[cle] == null ? nB : nA) + ').');
      bilan.push(n + ' non comparable');
      continue;
    }
    if (!ec.length) {
      lignes.push(n + '. ' + titre + ' : identique' + (nonDispo ? ' (' + nonDispo + ')' : '') + '.');
      if (memeTitre) lignes.push(memeTitre);
      bilan.push(n + ' identique');
      continue;
    }
    nbEcarts += ec.length;
    bilan.push(n + ' écart');
    lignes.push(n + '. ' + titre + ' : ' + ec.length + ' écart(s)' + (nonDispo ? ' (' + nonDispo + ')' : '') + '.');
    if (memeTitre) lignes.push(memeTitre);
    for (const d of ec.slice(0, 60)) lignes.push('    ' + d.chemin + ' : ' + nA + ' ' + affiche(d.chemin, d.a) + ' / ' + nB + ' ' + affiche(d.chemin, d.b));
    if (ec.length > 60) lignes.push('    … et ' + (ec.length - 60) + ' autre(s).');
    // diagnostic
    const concerne = ENTREES_DU_POINT[n] ? ENTREES_DU_POINT[n].flatMap(k => (k === 'commun' ? E.commun : E.cycles[k] || [])) : toutes;
    const bornes = (n === 2 || n === 3) ? E.bornes : [];
    if (bornes.length) lignes.push('  Diagnostic : bornes de cycle différentes (' + bornes.join(' ; ') + ') — même entrée possible, calcul du cycle différent.');
    if (n === 1) lignes.push('  Diagnostic : les soldes et la dette de carte viennent des relevés bancaires, pas des opérations : vérifier d\'abord que les deux côtés ont lu leurs soldes le même jour (dates ci-dessus), puis la liste des opérations de la carte (point 11).');
    else if (concerne.length) {
      lignes.push('  Diagnostic : données d\'entrée différentes.');
      lignes.push(...listeEntrees(concerne, nA, nB, 15));
    } else if (!bornes.length) lignes.push('  Diagnostic : même entrée, calcul différent — défaut à corriger.');
  }
  lignes.push('');
  if (toutes.length) {
    lignes.push('11. Données d\'entrée : opérations présentes d\'un seul côté.');
    lignes.push(...listeEntrees(toutes, nA, nB, 30));
  } else lignes.push('11. Données d\'entrée : identiques sur les cycles et les 12 mois du commun.');
  lignes.push('');
  lignes.push('Bilan : ' + (nbEcarts ? nbEcarts + ' écart(s) — ' : 'aucun écart — ') + bilan.join(', ') + '.');
  return { texte: lignes.join('\n') + '\n', ecarts: nbEcarts, entrees: E };
}

if (import.meta.url === 'file://' + process.argv[1]) {
  try {
    const args = process.argv.slice(2), i = args.indexOf('--sortie');
    const sortie = i >= 0 ? args.splice(i, 2)[1] : null;
    if (args.length !== 2) throw new Error('Usage : node comparer.mjs <relevé Klad.json> <relevé ancienne version.json> [--sortie rapport.txt]');
    const [A, B] = args.map(f => JSON.parse(fs.readFileSync(f, 'utf8')));
    const r = comparer(A, B);
    if (sortie) { fs.writeFileSync(sortie, r.texte); console.log('Rapport écrit : ' + sortie + ' (' + r.ecarts + ' écart(s)).'); } else process.stdout.write(r.texte);
    process.exit(r.ecarts ? 1 : 0);
  } catch (e) { console.error(e.message || e); process.exit(2); }
}
