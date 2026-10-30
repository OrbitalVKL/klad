// Klad — sélecteur d'icône d'une catégorie (0.10.7), en volet du bas : recherche par mots français, icônes suggérées
// d'après le nom, couleur de la pastille au choix. Ouvert depuis Plus › Classement (catégorie touchée, ou juste après
// « Nouvelle catégorie »). Le choix est enregistré tout de suite (classement : icone « lu:<nom> », couleur « #rrggbb »).
(function () {
  'use strict';

  const A = window.KladApp;
  const KC = window.KladClasse;
  const I = window.KladIcones;
  const U = window.KladUI;
  const $ = id => document.getElementById(id);
  const esc = A.esc;
  const S = () => A.etat();

  // Couleurs des pastilles (celles des catégories d'office) : [valeur, nom lu par le lecteur d'écran].
  const COULEURS = [['#5b6ee1', 'bleu'], ['#0284c7', 'bleu ciel'], ['#0891b2', 'turquoise'], ['#0d9488', 'vert d\'eau'], ['#16a34a', 'vert'],
    ['#65a30d', 'vert olive'], ['#ca8a04', 'jaune'], ['#ea580c', 'orange'], ['#dc2626', 'rouge'], ['#e11d48', 'framboise'], ['#db2777', 'rose'],
    ['#c026d3', 'magenta'], ['#9333ea', 'violet'], ['#6d28d9', 'indigo'], ['#a16207', 'brun'], ['#64748b', 'gris']];
  const MAX = 160;                     // icônes dessinées à la fois (la recherche affine)

  let cat = null, q = '';
  const titre = nom => { const d = (window.KladIconesDonnees || []).find(x => x[0] === nom); return d ? d[1].split(' ')[0] : nom; };

  function bouton(nom, actuelle, col) {
    const on = actuelle === 'lu:' + nom;
    return '<button type="button" class="ic-b' + (on ? ' on' : '') + '" data-ic="' + esc(nom) + '" aria-pressed="' + on + '" aria-label="Icône ' + esc(titre(nom)) + '" style="--cc:' + esc(col) + '">' + I.svg(nom, 24) + '</button>';
  }
  function grille() {
    const C = KC.donnees(S());
    const ic = U.iconeDe(C, cat), col = U.couleurDe(cat, C);
    const res = I.chercher(q);
    const z = $('icGrille');
    if (!z) return;
    z.innerHTML = res.length ? res.slice(0, MAX).map(n => bouton(n, ic, col)).join('') + (res.length > MAX ? '<p class="muted small ic-plus">' + (res.length - MAX) + ' autres : précisez la recherche.</p>' : '')
      : '<p class="muted">Aucune icône pour « ' + esc(q) + ' ». Essayez un autre mot : courses, bar, essence, loyer, sport, impôts…</p>';
    $('icNb').textContent = q ? res.length + ' icône' + (res.length > 1 ? 's' : '') : '';
  }
  function rendre() {
    const C = KC.donnees(S());
    const ic = U.iconeDe(C, cat), col = U.couleurDe(cat, C);
    const sug = I.suggerer(cat, 8);
    const emoji = ic && !/^(lu|svg):/.test(String(ic)) && !I.absente(ic) ? ic : null;
    $('iconeCorps').innerHTML =
      '<div class="ic-tete">' + U.cico(C, cat).replace('class="cico', 'class="cico ic-apercu') + '<div class="t"><b>' + esc(cat) + '</b><span>' + esc(KC.NOMS_NATURES[KC.natureDe(C, cat)] || '') + '</span></div></div>' +
      '<h3 id="icCoulT">Couleur de la pastille</h3><div class="ic-coul" role="group" aria-labelledby="icCoulT">' +
      COULEURS.map(([v, n]) => '<button type="button" data-coul="' + v + '" aria-pressed="' + (v === col) + '" aria-label="Couleur ' + esc(n) + '" style="--sw:' + v + '"></button>').join('') + '</div>' +
      (sug.length || emoji ? '<h3>Suggérées pour « ' + esc(cat) + ' »</h3><div class="ic-grille">' + (emoji ? '<button type="button" class="ic-b on ic-emoji" data-garder="1" aria-pressed="true" aria-label="Garder l\'icône actuelle" style="--cc:' + esc(col) + '">' + esc(emoji) + '</button>' : '') +
        sug.map(n => bouton(n, ic, col)).join('') + '</div>' : '') +
      '<h3>Toutes les icônes <span class="muted small" id="icNb"></span></h3>' +
      '<label class="sh-l"><span class="sh-lab">Rechercher</span><input class="sh-in" id="icQ" type="search" autocomplete="off" spellcheck="false" placeholder="courses, bar, essence, loyer, sport…" value="' + esc(q) + '"></label>' +
      '<div class="ic-grille" id="icGrille"></div>' +
      '<button type="button" class="sh-go" data-icfin="1">Terminé</button>' +
      '<p class="muted small">Icônes Lucide (licence ISC), embarquées dans l\'appli.</p>';
    grille();
  }

  A.preparer.secIcone = o => {
    if (o && o.cat) { cat = o.cat; q = ''; }
    if (!cat) return;
    rendre();
  };

  $('iconeCorps').addEventListener('input', ev => {
    if (ev.target.id !== 'icQ') return;
    q = ev.target.value;
    grille();
  });
  $('iconeCorps').addEventListener('click', ev => {
    const s = S();
    if (!s || !cat) return;
    const C = KC.donnees(s);
    const b = ev.target.closest('[data-ic]'), c = ev.target.closest('[data-coul]');
    if (b) {
      C.categories[cat] = Object.assign({ nature: KC.natureDe(C, cat) }, C.categories[cat], { icone: 'lu:' + b.dataset.ic });
      A.log('info', 'Icône d\'une catégorie changée.');
      A.changed('classement');
      rendre();
      return;
    }
    if (c) {
      C.categories[cat] = Object.assign({ nature: KC.natureDe(C, cat), icone: KC.iconeDe(C, cat) }, C.categories[cat], { couleur: c.dataset.coul });
      A.log('info', 'Couleur d\'une catégorie changée.');
      A.changed('classement');
      rendre();
      return;
    }
    if (ev.target.closest('[data-icfin]')) A.retourVolet();
  });

  window.KladSelIcone = { COULEURS, ouvrir: nom => A.ouvrirVolet('secIcone', { empiler: true, cat: nom }) };
})();
