// Tests du lot 2.3.2 : sections du budget en blocs (maquette B validée le 10/11/2026). Le widget (forme d'icône,
// Orbital verre par défaut) est vérifié dans lot231. Données fictives uniquement.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { read } from './charge.mjs';
import { playwright, ouvrir } from '../tools/mesures/banc.mjs';

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

// 2.3.2 : en mode démo, un libellé d'accessibilité ou une infobulle mis à jour sans nouveau nœud est masqué aussi
// (fuite intermittente vue par demo.test : « patrimoine›impots›prelevements › aria-label »), une seule fois.
const SAUT = !playwright() && !process.env.KLAD_PARCOURS && 'Playwright absent';
test('mode démo : attribut changé seul masqué, une seule fois, rendu à la sortie', { skip: SAUT, timeout: 120000 }, async () => {
  const B = await ouvrir({ largeur: 390 });
  try {
    const { page } = B;
    await page.evaluate(() => window.KladAffichage.demarrerDemo(window.KladApp.etat()));
    await page.waitForTimeout(300);
    const r = await page.evaluate(async () => {
      const e = document.createElement('button'); e.id = 'essaiDemo'; e.textContent = 'x';
      document.getElementById('appli').appendChild(e);
      await new Promise(f => setTimeout(f, 150));
      e.setAttribute('aria-label', 'Bars, débit 1 987,65 €, 19/10');
      e.setAttribute('title', 'débit 1 987,65 €');
      await new Promise(f => setTimeout(f, 200));
      const a1 = e.getAttribute('aria-label'), t1 = e.getAttribute('title');
      await new Promise(f => setTimeout(f, 300));
      return { a1, t1, a2: e.getAttribute('aria-label') };
    });
    assert.doesNotMatch(r.a1, /1 987,65/, 'libellé masqué');
    assert.doesNotMatch(r.t1, /1 987,65/, 'infobulle masquée');
    assert.equal(r.a2, r.a1, 'masqué une seule fois (pas de boucle)');
    await page.evaluate(() => window.KladAffichage.arreterDemo());
    await page.waitForTimeout(200);
    assert.equal(await page.evaluate(() => document.getElementById('essaiDemo').getAttribute('aria-label')), 'Bars, débit 1 987,65 €, 19/10', 'rendu à la sortie');
    assert.deepEqual(B.erreurs, []);
  } finally {
    await B.fin();
  }
});
