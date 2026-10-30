// Klad — banque d'icônes des catégories (0.10.7) : icônes Lucide embarquées (www/icones-donnees.js, licence ISC dans
// www/licences/lucide.txt), jamais chargées d'Internet. Une icône de catégorie s'écrit « lu:<nom> » (les émojis et les
// icônes reprises de l'ancienne version restent valables). Recherche par mots français, suggestions d'après le nom
// d'une catégorie. Sans accès au DOM ; testé dans node.
(function (g) {
  'use strict';

  const PREFIXE = 'lu:';
  const DEFAUT = 'tag';                      // icône générique quand le nom ne suggère rien
  const fold = s => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  // mots vides et pluriels simples (« courses » → « course », « travaux » → « travau »)
  const VIDES = new Set(['de', 'des', 'du', 'la', 'le', 'les', 'et', 'a', 'au', 'aux', 'en', 'd', 'l', 'pour', 'sur', 'par', 'un', 'une',
    'mes', 'ma', 'mon', 'ses', 'sa', 'son', 'avec', 'sans', 'chez', 'ou']);
  const sing = w => w.length > 3 && /[sx]$/.test(w) ? w.slice(0, -1) : w;
  const mots = t => fold(t).split(/[^a-z0-9]+/).filter(w => w && !VIDES.has(w)).map(sing);

  let INDEX = null;                          // [{ nom, rang, mots: [..], premier, corps }]
  let PAR_NOM = null;
  function index() {
    if (INDEX) return INDEX;
    const D = g.KladIconesDonnees;
    if (!D) { PAR_NOM = new Map(); return []; }          // données pas encore chargées : rien en mémoire
    INDEX = D.map(([nom, m, corps], rang) => { const w = mots(m); return { nom, rang, mots: w, premier: w[0] || '', corps, nomMots: mots(nom.replace(/-/g, ' ')) }; });
    PAR_NOM = new Map(INDEX.map(x => [x.nom, x]));
    return INDEX;
  }
  const existe = nom => (index(), PAR_NOM.has(nom));
  const liste = () => index().map(x => x.nom);

  // Icône en SVG (trait de la couleur du texte). taille en px (défaut 18).
  function svg(nom, taille) {
    index();
    const x = PAR_NOM.get(nom) || PAR_NOM.get(DEFAUT);
    if (!x) return '';
    const t = taille || 18;
    return '<svg class="lu" viewBox="0 0 24 24" width="' + t + '" height="' + t + '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + x.corps + '</svg>';
  }
  // « lu:<nom> » → nom, sinon null.
  const nomDe = spec => typeof spec === 'string' && spec.indexOf(PREFIXE) === 0 && existe(spec.slice(PREFIXE.length)) ? spec.slice(PREFIXE.length) : null;

  // Correspondance d'un mot cherché avec les mots-clés d'une icône : 3 identique, 2 début de mot-clé, 0 sinon.
  function score1(w, x) {
    let s = 0;
    for (const k of x.mots) {
      if (k === w) { s = Math.max(s, k === x.premier ? 4 : 3); break; }
      if (w.length >= 3 && k.indexOf(w) === 0) s = Math.max(s, 2);
      else if (k.length >= 4 && w.indexOf(k) === 0) s = Math.max(s, 1);
    }
    if (!s) for (const k of x.nomMots) if (k === w || (w.length >= 3 && k.indexOf(w) === 0)) { s = 1; break; }
    return s;
  }

  // Recherche (sélecteur) : tous les mots doivent correspondre. Sans texte : toutes les icônes, dans l'ordre des thèmes.
  function chercher(q) {
    const W = mots(q);
    if (!W.length) return liste();
    const r = [];
    for (const x of index()) {
      let t = 0, ok = true;
      for (const w of W) { const s = score1(w, x); if (!s) { ok = false; break; } t += s; }
      if (ok) r.push([x, t]);
    }
    return r.sort((a, b) => (b[1] - a[1]) || (a[0].rang - b[0].rang)).map(a => a[0].nom);
  }

  // Suggestions d'après un nom de catégorie : au moins un mot doit correspondre ; les meilleures d'abord.
  function suggerer(nomCat, n) {
    const W = mots(nomCat);
    const r = [];
    if (W.length) for (const x of index()) {
      let t = 0;
      for (const w of W) t += score1(w, x);
      if (t >= 2) r.push([x, t]);
    }
    return r.sort((a, b) => (b[1] - a[1]) || (a[0].rang - b[0].rang)).slice(0, n || 12).map(a => a[0].nom);
  }
  // Icône proposée pour une catégorie (« lu:<nom> »).
  const proposer = nomCat => PREFIXE + (suggerer(nomCat, 1)[0] || DEFAUT);

  // Une icône est « absente » si rien n'est enregistré ou si c'est la lettre de repli (initiale du nom).
  const absente = ic => ic == null || String(ic).trim() === '' || /^[A-Za-z0-9?]$/.test(String(ic).trim());

  g.KladIcones = { PREFIXE, DEFAUT, svg, nomDe, existe, liste, chercher, suggerer, proposer, absente, mots };
})(typeof window !== 'undefined' ? window : globalThis);
