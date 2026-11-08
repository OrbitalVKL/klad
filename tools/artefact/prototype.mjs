// Prototype de l'interface 2.0 en une seule page (artefact claude.ai) : les blocs de l'Aperçu sont produits par le code
// de l'appli (www/vapercu.js et les fonctions de calcul) sur le jeu FICTIF « personnel » au 28/10/2026 ; la page autour
// (navigation, tri en cartes, fil des opérations) est écrite ici. Aucune donnée réelle.
// Usage : node tools/artefact/prototype.mjs [fichier de sortie]
import fs from 'node:fs';
import path from 'node:path';
import { outils, etatDepuisReprise } from '../../test/jeux.mjs';
import vm from 'node:vm';
import { reprisePersonnelle, PERSONNEL } from '../mesures/donnees.mjs';

const OUT = path.resolve(process.argv[2] || 'dist/prototype/index.html');
const X = outils(['icones-donnees.js', 'icones.js', 'ui.js', 'vues.js', 'vbudget.js', 'vcommun.js', 'vaccueil.js', 'vapercu.js']);
const { KladClasse: K, KladBudget: KB, KladCommun: KC, KladFisc: KF, KladObservations: KO, KladUI: U, KladVues: Vu, KladVuesApercu: AP, KladFormat: F, KladModele: M } = X;
const FIN = '2026-10-28', NOW = new Date(2026, 9, 28, 10, 0, 0).getTime();
const S = await etatDepuisReprise(X, reprisePersonnelle(FIN), NOW);
// complément du jeu (banque connectée, patrimoine, virement « en route », prélèvement réglé d'avance…) : même fonction que
// le test du mode démo, exécutée avec l'horloge du jeu
{
  const src = fs.readFileSync(new URL('../../test/demo-outils.mjs', import.meta.url), 'utf8');
  const corps = src.slice(src.indexOf('  await page.evaluate(P => {') + '  await page.evaluate('.length, src.indexOf('  }, PERSONNEL);') + 3);
  const D = Date, FD = function (...a) { return a.length ? new D(...a) : new D(NOW); };
  FD.now = () => NOW; FD.UTC = D.UTC; FD.parse = D.parse; FD.prototype = D.prototype;
  X.window = X; X.KladApp = { etat: () => S, changed: () => {} }; X.Date = FD;
  vm.runInContext('(' + corps + ')', X)(PERSONNEL);
  X.Date = D;
}

function donnees() {
  const cx = K.contexte(S, NOW), B = KB.contexte(S, NOW, cx);
  const res = KB.suivi(B, 'perso', null), fdm = KC.finDeMois(B), plan = KC.plan(B), R = KC.reglages(B), ech = KB.echeances(B, 31);
  const dettes = {}; for (const c of S.modele.comptes) if (c.role === 'carte_differee') dettes[c.id] = K.dette(S, c, NOW);
  let livrets = {}; try { livrets = KF.livretCarte(B) || {}; } catch (e) { livrets = {}; }
  const ext = { attention: K.attention(cx, NOW), ctx: cx, sauvegarde: { jours: 12 }, observations: KO.observations(B, 'perso').faire.length };
  return { S, B, now: NOW, ext, res, dettes, livrets, fdm, plan, R, ech, cx };
}
const reglages = () => { S.budget.reglages = Object.assign({}, S.budget.reglages); return S.budget.reglages; };
reglages().rav = 'salaire';
let d = donnees();
const moiSalaire = AP.moi(d), nous = AP.nous(d);
reglages().rav = 'comptes';
d = donnees();
const moiComptes = AP.moi(d);
reglages().rav = 'salaire';
d = donnees();

// opérations des 3 derniers mois (fil) et file « à vérifier » (tri en cartes)
const cx = d.cx, C = cx.C, lim = K.limiteNC(cx, NOW), depuis = M.plusJours(FIN, -92);
const comptes = M.comptesTries(S).filter(c => !c.masque);
const ops = [];
for (const c of comptes) for (const o of S.ops[c.id] || []) {
  if (o.date < depuis) continue;
  const r = K.classer(cx, o);
  ops.push({ id: o.id, d: o.date, l: Vu.libelleCourt(o.libelle), m: o.montant, c: c.libelle, nous: c.role === 'commun', cat: r.cat, sub: r.sub && r.sub !== r.cat ? r.sub : '', nc: !!r.nc,
    vu: K.vue(S, o), av: K.aVerifierOp(cx, o, lim), ec: o.statut === 'en_cours', int: r.type === 'interne', ic: U.icoOp(C, { cat: r.cat, sub: r.sub, label: o.libelle }) });
}
ops.sort((a, b) => a.d < b.d ? 1 : a.d > b.d ? -1 : 0);
// catégories proposées au tri : les plus fréquentes des 3 derniers mois
const freq = {};
for (const o of ops) if (!o.nc && !o.int && o.m < 0) freq[o.cat] = (freq[o.cat] || 0) + 1;
const cats = Object.keys(freq).sort((a, b) => freq[b] - freq[a]).slice(0, 8).map(n => ({ n, ic: U.icoOp(C, { cat: n, sub: n, label: '' }) }));
const jours = ops.length;

const esc = s => String(s).replace(/</g, '\\u003c');
const cyc = d.res && d.res.per && d.res.per.cyc;
const DATA = { moiSalaire, moiComptes, nous, ops, cats, fin: FIN, cycle: cyc ? 'Cycle du ' + U.jjmm(cyc.start) + ' au ' + U.jjmm(cyc.end) : '' };
// styles de l'Aperçu : ceux de l'appli (section « 2.0 » de www/style.css), sans la barre du bas de l'appli
const css = fs.readFileSync(new URL('../../www/style.css', import.meta.url), 'utf8');
const ap = css.slice(css.indexOf('/* ============================================================ 2.0 (version de test)')).split('\n')
  .filter(l => !/app-tb/.test(l)).join('\n').replace(/#view-accueil /g, '');
const html = fs.readFileSync(new URL('./prototype.html', import.meta.url), 'utf8')
  .replace('/*STYLE_AP*/', () => ap)
  .replace('/*DONNEES*/', () => 'const DATA = ' + esc(JSON.stringify(DATA)) + ';');
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html);
console.log(OUT, Math.round(html.length / 1024) + ' Ko', jours, 'opérations');
