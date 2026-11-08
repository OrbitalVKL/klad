// 2.0.1 : une opération marquée vue d'un glissement (ou remise en non vue) met à jour tout de suite les compteurs de
// l'écran Opérations (pastilles Perso · Commun · Tout, filtre « Non vues », bouton Trier de la barre du bas), sans
// reconstruire la liste (la ligne reste à sa place). Chromium (Playwright), jeu fictif des mesures.
// Sauté si Playwright et Chromium ne sont pas installés, sauf avec KLAD_PARCOURS=obligatoire (fabrication GitHub Actions).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ouvrir, playwright } from '../tools/mesures/banc.mjs';

const SAUT = !playwright() && !process.env.KLAD_PARCOURS && 'Playwright absent';

test('2.0.1 : glisser une opération « vue » met à jour les compteurs tout de suite, la liste reste en place', { skip: SAUT }, async () => {
  const B = await ouvrir({ mobile: true });
  try {
    const { page } = B;
    await B.operationsPerso();
    const lire = () => page.evaluate(() => {
      const n = s => { const e = document.querySelector(s); return e ? +(e.getAttribute('data-av-n') || e.textContent.replace(/\D/g, '') || 0) : 0; };
      const t = document.getElementById('tb-badge');
      return { perso: n('#ops-scope [data-perimetre="perso"]'), tout: n('#ops-scope [data-perimetre="tout"]'), nonVues: n('#app-chips [data-f="nonVues"] b'),
        badge: t.hidden ? 0 : +(t.getAttribute('aria-label') || '0').replace(/\D/g, ''), lignes: document.querySelectorAll('#tx div.txr[data-op]').length };
    });
    // glissement à droite sur une ligne (mêmes événements tactiles que le téléphone)
    const glisser = id => page.evaluate(id => {
      const tr = document.querySelector('#tx div.txr[data-op="' + CSS.escape(id) + '"]');
      const r = tr.getBoundingClientRect(), y = r.top + r.height / 2;
      const t = x => new Touch({ identifier: 1, target: tr, clientX: x, clientY: y });
      tr.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [t(40)], changedTouches: [t(40)] }));
      for (const x of [70, 110, 160, 200]) tr.dispatchEvent(new TouchEvent('touchmove', { bubbles: true, touches: [t(x)], changedTouches: [t(x)] }));
      tr.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [], changedTouches: [t(200)] }));
    }, id);
    const avant = await lire();
    assert.ok(avant.nonVues > 0 && avant.perso > 0, 'jeu avec des opérations non vues : ' + JSON.stringify(avant));
    const id = await page.evaluate(() => document.querySelector('#tx div.txr.unseen[data-op]').dataset.op);
    await glisser(id);
    await B.pause(350);
    const apres = await lire();
    assert.equal(apres.nonVues, avant.nonVues - 1, 'filtre « Non vues »');
    assert.equal(apres.perso, avant.perso - 1, 'pastille Perso');
    assert.equal(apres.tout, avant.tout - 1, 'pastille Tout');
    assert.equal(apres.badge, avant.badge - 1, 'bouton Trier');
    assert.equal(apres.lignes, avant.lignes, 'liste non reconstruite');
    assert.equal(await page.evaluate(id => document.querySelector('#tx div.txr[data-op="' + CSS.escape(id) + '"]').classList.contains('unseen'), id), false, 'ligne marquée vue');
    // glissement inverse : remise en non vue, compteurs revenus
    await glisser(id);
    await B.pause(350);
    const retour = await lire();
    assert.deepEqual([retour.nonVues, retour.perso, retour.tout, retour.badge], [avant.nonVues, avant.perso, avant.tout, avant.badge], 'remise en non vue');
    assert.deepEqual(B.erreurs, []);
  } finally { await B.fin(); }
});
