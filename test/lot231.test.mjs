// Tests du lot 2.3.1 : style du widget au choix (Plus › Apparence), formats 1 × 1 et 2 × 1, plus de 2 × 2.
// Données fictives uniquement. La partie Chromium est sautée si Playwright n'est pas installé.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { read } from './charge.mjs';
import { playwright, ouvrir } from '../tools/mesures/banc.mjs';

const SAUT = !playwright() && !process.env.KLAD_PARCOURS && 'Playwright absent';
const RES = 'android/app/src/main/res/';

test('widget natif : deux formats (1 × 1, 2 × 1), trois styles, pastille de 12 dp', () => {
  const m = read('android/app/src/main/AndroidManifest.xml');
  assert.match(m, /app\.klad\.widget\.WidgetKlad"/);
  assert.match(m, /app\.klad\.widget\.WidgetKladPetit"/);
  const grand = read(RES + 'xml/widget_klad_info.xml'), petit = read(RES + 'xml/widget_klad_petit_info.xml');
  assert.match(grand, /targetCellWidth="2"[\s\S]*targetCellHeight="1"|targetCellHeight="1"[\s\S]*targetCellWidth="2"/);
  assert.match(petit, /targetCellWidth="1"/);
  assert.match(petit, /targetCellHeight="1"/);
  for (const k of ['bleu', 'verre', 'orbital']) {
    for (const f of ['w_fond_' + k, 'w_fond_' + k + '_alerte', 'w_pastille_' + k]) assert.match(read(RES + 'drawable/' + f + '.xml'), /<shape/, f);
  }
  const st = read(RES + 'values/widget.xml');
  assert.match(st, /<style name="WidgetPastille">[\s\S]*?layout_width">12dp[\s\S]*?layout_height">12dp[\s\S]*?textSize">8sp/);
  assert.match(read(RES + 'drawable/w_fond_verre.xml'), /#80/, 'verre : fond translucide');
  assert.match(read('www/fond.js'), /KladWidget: \['ecrire', 'style', 'effacer'\]/);
});

test('Apparence : style du widget, Orbital par défaut, envoyé au widget et gardé', { skip: SAUT, timeout: 120000 }, async () => {
  const B = await ouvrir({ largeur: 390 });
  try {
    const { page } = B;
    await page.evaluate(() => window.KladApp.ouvrirVolet('secAffichage'));
    await page.waitForTimeout(300);
    const etat = () => page.evaluate(() => ({
      boutons: [...document.querySelectorAll('[data-widget-style]')].map(b => b.dataset.widgetStyle + ':' + b.getAttribute('aria-pressed')),
      style: window.KladWidget.style(), envoye: window.KladWidget.styleEnvoye()
    }));
    let e = await etat();
    assert.deepEqual(e.boutons, ['orbital:true', 'bleu:false', 'verre:false']);
    assert.equal(e.style, 'orbital');
    await page.click('[data-widget-style="verre"]');
    await page.waitForTimeout(150);
    e = await etat();
    assert.deepEqual(e.boutons, ['orbital:false', 'bleu:false', 'verre:true']);
    assert.equal(e.envoye, 'verre');
    assert.equal(await page.evaluate(() => localStorage.getItem('klad.widget.style')), 'verre');
    await page.click('[data-widget-style="orbital"]');
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(() => localStorage.getItem('klad.widget.style')), null, 'défaut : rien de gardé');
    assert.equal((await etat()).envoye, 'orbital');
    assert.deepEqual(B.erreurs, []);
  } finally {
    await B.fin();
  }
});
