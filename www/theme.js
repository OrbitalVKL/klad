// Klad — thème choisi appliqué avant le premier affichage (pas de flash) : chargé dans <head>, avant la feuille de
// style. « clair » / « sombre » (préférence gardée sur ce téléphone) → data-theme="light" / "dark" ; « auto » : rien,
// la feuille de style suit le réglage du téléphone. La suite (changement, barres Android) est dans affichage.js.
(function () {
  'use strict';
  try {
    var t = localStorage.getItem('klad.theme');
    var a = t === 'clair' ? 'light' : t === 'sombre' ? 'dark' : null;
    if (!a) return;
    document.documentElement.setAttribute('data-theme', a);
    var m = document.querySelector('meta[name="color-scheme"]');
    if (m) m.setAttribute('content', a);
  } catch (e) { /* stockage indisponible : thème automatique */ }
})();
