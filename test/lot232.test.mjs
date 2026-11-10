// Tests du lot 2.3.2 : sections du budget en blocs (maquette B validée le 10/11/2026). Le widget (forme d'icône,
// Orbital verre par défaut) est vérifié dans lot231. Données fictives uniquement.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { read } from './charge.mjs';

test('budget : chaque section est un bloc de sa couleur, distinct des postes', () => {
  const css = read('www/style.css');
  const regle = sel => (css.match(new RegExp('(^|\\n)' + sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\{([^}]*)\\}')) || [])[2] || '';
  const sec = regle('.bg-sec');
  assert.match(sec, /border-top:4px solid var\(--sc\)/, 'liseré de la couleur de la section');
  assert.match(sec, /border-radius:16px/);
  assert.match(sec, /background:color-mix\(in srgb,var\(--sc\) 5%,var\(--surface-2\)\)/, 'fond teinté');
  for (const [k, v] of [['rev', 'good'], ['fixe', 'nfix'], ['courante', 'cour'], ['optionnelle', 'nopt'], ['hb', 'hb']]) {
    assert.match(css, new RegExp('\\.bg-sec\\.' + k + '\\{--sc:var\\(--' + v + '\\)\\}'), k);
  }
  assert.match(regle('.bg-sh .t'), /color:color-mix\(in srgb,var\(--sc\) 65%,var\(--ink\)\)/, 'titre de la couleur de la section');
  assert.match(regle('.bg-sh .dot'), /display:none/, 'plus de point : la couleur est portée par le bloc');
  assert.match(regle('.bg-sh'), /grid-template-columns:minmax\(0,1fr\) auto auto/);
  assert.match(regle('div.bg-sh'), /grid-template-columns:minmax\(0,1fr\) auto/);
  // les postes restent des lignes (pas de bloc)
  assert.doesNotMatch(regle('.bg-po'), /border-radius|background/);
});
