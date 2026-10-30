// Débordements (0.10.11) dans Chromium, sur le jeu fictif des mesures (tools/mesures) : à 320, 360 et 412 px de large,
// texte à 100, 150 et 200 %, rien ne sort de l'écran ni de sa carte sur tous les écrans (onglets, sous-vues, Plus),
// volets, écran de verrouillage, bandeaux (mode démo, « À vérifier ») et messages (simple, erreur, avec « Annuler »).
// Contre-épreuve : KLAD_WWW=<dossier www d'une autre version> rejoue le test sur cette version (0.10.10 : bandeau du
// mode démo signalé).
// Sauté si Playwright et Chromium ne sont pas installés, sauf avec KLAD_PARCOURS=obligatoire (fabrication GitHub Actions).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ouvrir, playwright } from '../tools/mesures/banc.mjs';
import { releveTextes, releveDebord } from './textes-outils.mjs';

const PW = playwright();
const SAUT = !PW && !process.env.KLAD_PARCOURS && 'Playwright absent';
const LARGEURS = (process.env.KLAD_LARGEURS || '320,360,412').split(',').map(Number);
const TEXTES = (process.env.KLAD_TEXTES || '100,150,200').split(',').map(Number);
const VOLETS = ['secReglBudget', 'secImporter', 'secBanques', 'secComptes', 'secReprise', 'secAffichage', 'secModules', 'secVerrou', 'secLog',
  'secMaj', 'secSync', 'secRav', 'secClassement', 'secAjout', 'secVirements', 'secObs', 'secControle', 'secExtras', 'secDiagAff'];
const MESSAGE = 'Message assez long pour tenir sur plusieurs lignes : synchronisation terminée, trois comptes à jour, rien à vérifier.';

test('débordements : écrans, volets, verrouillage, bandeaux et messages dans l\'écran (320 à 412 px, texte de 100 à 200 %)', { skip: SAUT, timeout: 1800000 }, async () => {
  const B = await ouvrir({ mobile: true, www: process.env.KLAD_WWW });
  const defauts = new Map();
  const vus = new Set();
  try {
    const { page } = B;
    let cfg = '', W = 0;
    const f = async nom => {
      vus.add(nom);
      const d = [...await page.evaluate(releveDebord, [W]), ...await page.evaluate(releveTextes, ['body', W])];
      for (const x of d) { const k = nom + ' › ' + x; if (!defauts.has(k)) defauts.set(k, cfg); }
    };
    const message = async (nom, js) => { await page.evaluate(js); await B.pause(250); await f(nom); await page.evaluate(() => { const t = document.getElementById('toast'); t.className = ''; t.textContent = ''; }); };
    for (const largeur of LARGEURS) {
      await page.setViewportSize({ width: largeur, height: 800 });
      W = largeur;
      for (const pc of TEXTES) {
        cfg = largeur + ' px, texte ' + pc + ' %';
        await B.texte(pc);
        await B.ecransPrincipaux(f);
        for (const id of VOLETS) {
          const ok = await page.evaluate(id => { if (!document.getElementById(id)) return false; window.KladApp.ouvrirVolet(id); return true; }, id);
          if (!ok) continue;
          await B.pause(120);
          await f(id);
          await B.fermer();
        }
        await B.ecransPlus(f);
        // messages : simple, erreur, avec « Annuler »
        await B.onglet('accueil');
        await message('message', m => window.KladApp.toast(m), MESSAGE);
        await message('message›erreur', m => window.KladApp.toast(m, true), MESSAGE);
        await message('message›annuler', m => window.KladApp.toastAnnuler(m, () => {}), MESSAGE);
        // bandeau du mode démo, sur chaque onglet
        await page.evaluate(() => window.KladAffichage.demarrerDemo(window.KladApp.etat()));
        await B.pause(250);
        for (const t of B.onglets) { await B.onglet(t); await f('démo›' + t); }
        await message('démo›message', m => window.KladApp.toast(m), MESSAGE);
        await page.evaluate(() => window.KladAffichage.arreterDemo());
        await B.pause(250);
        // écran de verrouillage
        await B.verrouiller();
        await page.waitForSelector('.pad');
        await f('verrouillage');
        await B.code();
        await page.waitForSelector('#appli:not([hidden])');
        await B.pause(400);
      }
    }
    await B.texte(100);
    assert.deepEqual(B.erreurs, [], 'aucune erreur dans la page');
  } finally { await B.fin(); }
  assert.ok(vus.size >= 40, vus.size + ' écrans, volets, bandeaux et messages parcourus');
  assert.deepEqual([...defauts].map(([k, c]) => k + ' (' + c + ')'), [], 'éléments qui sortent de l\'écran');
});
