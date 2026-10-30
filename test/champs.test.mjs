// Champs de saisie (0.10.9) dans Chromium, sur le jeu fictif des mesures (tools/mesures) : à 320, 360 et 412 px de large,
// texte à 100, 150 et 200 % (taille de police d'Android, appliquée au texte seulement), chaque champ (input, select,
// textarea) des écrans, volets et formulaires reste dans son conteneur et dans l'écran, et son contour de mise en
// évidence (champ touché) n'est coupé par aucune zone qui défile ou masque son contenu.
// Sauté si Playwright et Chromium ne sont pas installés, sauf avec KLAD_PARCOURS=obligatoire (fabrication GitHub Actions).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ouvrir, playwright } from '../tools/mesures/banc.mjs';

const PW = playwright();
const SAUT = !PW && !process.env.KLAD_PARCOURS && 'Playwright absent';
const LARGEURS = [320, 360, 412];
const TEXTES = [100, 150, 200];
const VOLETS = ['secReglBudget', 'secImporter', 'secBanques', 'secComptes', 'secReprise', 'secAffichage', 'secModules', 'secVerrou', 'secLog',
  'secMaj', 'secSync', 'secRav', 'secClassement', 'secAjout', 'secVirements', 'secObs', 'secControle', 'secExtras', 'secDiagAff'];

// Relevé dans la page : champs visibles de la portée qui débordent → [« champ : raison »].
function releve([portee, W]) {
  const desc = e => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).join('.') : '') +
    (e.name ? '[name=' + e.name + ']' : '');
  const px = v => parseFloat(v) || 0;
  const out = [];
  const champs = [...document.querySelectorAll(portee + ' input, ' + portee + ' select, ' + portee + ' textarea')]
    .filter(e => e.type !== 'hidden' && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden');
  for (const e of champs) {
    const r = e.getBoundingClientRect();
    if (r.width < 1) continue;
    // zone qui défile horizontalement par conception (tableau large, rangée de filtres) : le champ peut en sortir
    const scroller = e.closest('.tablewrap, .app-chips');
    const p = e.parentElement.getBoundingClientRect();
    if (!scroller && (r.left < p.left - 0.5 || r.right > p.right + 0.5)) out.push(desc(e) + ' sort de son conteneur ' + desc(e.parentElement) + ' (' + Math.round(r.left) + '–' + Math.round(r.right) + ' pour ' + Math.round(p.left) + '–' + Math.round(p.right) + ')');
    if (!scroller && (r.left < -0.5 || r.right > W + 0.5)) out.push(desc(e) + ' sort de l\'écran (' + Math.round(r.left) + '–' + Math.round(r.right) + ' pour ' + W + ')');
    if (scroller) continue;
    // contour de mise en évidence : champ touché
    e.focus({ preventScroll: true });
    const cs = getComputedStyle(e);
    const ext = cs.outlineStyle !== 'none' ? px(cs.outlineWidth) + px(cs.outlineOffset) : 0;
    const L = r.left - Math.max(0, ext), R = r.right + Math.max(0, ext);
    for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) {
      const ca = getComputedStyle(a);
      if (ca.overflowX === 'visible') continue;
      const ar = a.getBoundingClientRect();
      if (L < ar.left + px(ca.borderLeftWidth) - 0.5 || R > ar.right - px(ca.borderRightWidth) + 0.5) { out.push(desc(e) + ' : contour coupé par ' + desc(a)); break; }
    }
    e.blur();
  }
  // page plus large que l'écran (le téléphone réduirait tout l'affichage)
  if (document.documentElement.scrollWidth > W + 0.5) out.push('page plus large que l\'écran (' + document.documentElement.scrollWidth + ' pour ' + W + ')');
  return out;
}

test('champs : dans leur conteneur et dans l\'écran, contour entier (320 à 412 px, texte de 100 à 200 %)', { skip: SAUT, timeout: 900000 }, async () => {
  const B = await ouvrir({ mobile: true });
  const defauts = new Map();
  const vus = new Set();
  try {
    const { page } = B;
    let cfg = '', W = 0;
    const f = async (nom, portee) => {
      vus.add(nom);
      for (const d of await page.evaluate(releve, [portee, W])) { const k = nom + ' › ' + d; if (!defauts.has(k)) defauts.set(k, cfg); }
    };
    for (const largeur of LARGEURS) {
      await page.setViewportSize({ width: largeur, height: 800 });
      W = largeur;
      for (const pc of TEXTES) {
        cfg = largeur + ' px, texte ' + pc + ' %';
        await B.texte(pc);
        await B.ecransPrincipaux(f);
        // Plus › Classement : renommer une catégorie (formulaire ouvert au toucher)
        await page.evaluate(() => window.KladApp.ouvrirVolet('secClassement'));
        await B.pause(150);
        if (!(await page.locator('#classementCorps .edcat').count())) await page.locator('#classementCorps [data-cat]').first().click();
        const ren = page.locator('#classementCorps [data-catren]');
        if (await ren.count()) { await ren.first().click(); await B.pause(100); await f('classement›renommer', '#volet'); }
        await B.fermer();
        for (const id of VOLETS) {
          const ok = await page.evaluate(id => { if (!document.getElementById(id)) return false; window.KladApp.ouvrirVolet(id); return true; }, id);
          if (!ok) continue;
          await B.pause(120);
          await f(id, '#volet');
          await B.fermer();
        }
        await B.ecransPlus(f);
      }
    }
    await B.texte(100);
    assert.deepEqual(B.erreurs, [], 'aucune erreur dans la page');
  } finally { await B.fin(); }
  assert.ok(vus.size >= 30, vus.size + ' écrans et volets parcourus');
  assert.deepEqual([...defauts].map(([k, c]) => k + ' (' + c + ')'), [], 'champs qui débordent');
});
