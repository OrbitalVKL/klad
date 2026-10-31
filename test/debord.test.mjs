// Débordements (0.10.11) dans Chromium, sur le jeu fictif des mesures (tools/mesures) : à 320, 360 et 412 px de large,
// texte à 100, 150 et 200 %, rien ne sort de l'écran ni de sa carte sur tous les écrans (onglets, sous-vues, Plus),
// volets, écran de verrouillage, bandeaux (mode démo, « À vérifier ») et messages (simple, erreur, avec « Annuler »).
// Contre-épreuve : KLAD_WWW=<dossier www d'une autre version> rejoue le test sur cette version (0.10.10 : bandeau du
// mode démo signalé).
// 1.0.1 : éléments flottants (messages simple, erreur, avec « Annuler », message dans un volet, bandeau du mode démo
// déplié et replié) : au-dessus de la barre d'onglets, sans couvrir un bouton ; boutons dessous et à côté utilisables
// (aucun voile invisible) ; fermeture par un appui, puis disparition seule ; un seul à la fois ; compteurs des
// onglets sans chevaucher icône ni libellé. Contre-épreuve : la 1.0.0 (KLAD_WWW) est signalée (message non fermé par
// un appui, toujours là après 5 s).
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
  'secMaj', 'secSync', 'secRav', 'secClassement', 'secAjout', 'secVirements', 'secObs', 'secControle', 'secExtras', 'secDiagAff', 'secReglages', 'secReglAvance'];
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
    // Élément flottant visible (sel) : rien sous la barre d'onglets, aucun bouton du volet couvert, points à côté
    // libres, onglet dessous utilisable.
    const libre = async (nom, sel) => {
      const d = await page.evaluate(sel => {
        const e = document.querySelector(sel), r = e.getBoundingClientRect(), out = [];
        const vis = x => { const q = x.getBoundingClientRect(); return q.width > 0 && q.height > 0 && getComputedStyle(x).visibility !== 'hidden'; };
        const inter = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
        const tb = document.getElementById('app-tb');
        if (tb && vis(tb) && r.bottom > tb.getBoundingClientRect().top + 1) out.push('flottant sur la barre d\'onglets');
        const v = document.getElementById('volet');
        if (v && !v.hidden) for (const b of v.querySelectorAll('.sheet button, .sheet [data-volet]')) if (vis(b) && inter(r, b.getBoundingClientRect())) { out.push('bouton du volet couvert : ' + (b.textContent || '').trim().slice(0, 30)); break; }
        const y = (r.top + r.bottom) / 2;
        for (const x of [r.left - 8, r.right + 8]) {
          if (x < 2 || x > innerWidth - 2) continue;
          const t = document.elementFromPoint(x, y);
          if (!t || t.closest(sel)) out.push('voile invisible à côté');
        }
        return out;
      }, sel);
      for (const x of d) { const k = nom + ' › ' + x; if (!defauts.has(k)) defauts.set(k, cfg); }
      if (await page.evaluate(() => document.getElementById('volet').hidden)) {
        const autre = B.onglets.find(t => t !== 'accueil');
        try { await page.locator('#app-tb [data-tab="' + autre + '"]').click({ timeout: 2000 }); }
        catch (e) { defauts.set(nom + ' › onglet dessous inutilisable', cfg); }
        const ok = await page.evaluate(t => document.querySelector('#app-tb [data-tab="' + t + '"]').getAttribute('aria-current') === 'page', autre);
        if (!ok && !defauts.has(nom + ' › onglet dessous inutilisable')) defauts.set(nom + ' › onglet dessous inutilisable', cfg);
        await page.locator('#app-tb [data-tab="accueil"]').click({ timeout: 2000 }).catch(() => {});
        await B.pause(200);
      }
    };
    const signaler = (nom, ok, quoi) => { if (!ok && !defauts.has(nom + ' › ' + quoi)) defauts.set(nom + ' › ' + quoi, cfg); };
    // Message : fermé par un appui (sur « Annuler » : action faite), puis disparition seule.
    const flottant = async (nom, js, ms) => {
      await page.evaluate(js); await B.pause(250);
      await libre(nom, '#toast');
      await page.evaluate(js); await B.pause(200);
      const ann = await page.locator('#toast button').count();
      await page.evaluate(() => { window.__annule = 0; });
      await page.locator(ann ? '#toast button' : '#toast').click({ timeout: 2000 }).catch(() => {});
      await B.pause(200);
      signaler(nom, !(await page.evaluate(() => document.getElementById('toast').classList.contains('show'))), 'pas fermé par un appui');
      if (ann) signaler(nom, await page.evaluate(() => window.__annule === 1), '« Annuler » sans effet');
      await page.evaluate(js); await B.pause(100);
      await page.clock.runFor(ms + 300); await B.pause(100);
      signaler(nom, !(await page.evaluate(() => document.getElementById('toast').classList.contains('show'))), 'toujours là après ' + ms / 1000 + ' s');
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
        // Réglages du complément : chaque écran par thème (1.0)
        for (const t of await page.evaluate(() => window.KladReglages.THEMES.map(x => x.id))) {
          await page.evaluate(() => window.KladApp.ouvrirVolet('secReglages'));
          const b = page.locator('#reglagesCorps [data-reglt="' + t + '"]');
          if (!(await b.count())) continue;
          await b.click();
          await B.pause(120);
          await f('réglages›' + t);
          await B.fermer();
        }
        await B.ecransPlus(f);
        // messages : simple, erreur, avec « Annuler »
        await B.onglet('accueil');
        await message('message', m => window.KladApp.toast(m), MESSAGE);
        await message('message›erreur', m => window.KladApp.toast(m, true), MESSAGE);
        await message('message›annuler', m => window.KladApp.toastAnnuler(m, () => {}), MESSAGE);
        // éléments flottants (1.0.1)
        await flottant('flottant›message', () => window.KladApp.toast('Synchronisation terminée.'), 5000);
        await flottant('flottant›erreur', () => window.KladApp.toast('Enregistrement impossible : erreur fictive.', true), 6000);
        await flottant('flottant›annuler', () => window.KladApp.toastAnnuler('Opération marquée vue.', () => { window.__annule = (window.__annule || 0) + 1; }), 8000);
        await page.evaluate(() => window.KladApp.toast('Glisser pour écarter.')); await B.pause(250);
        const bt = await page.locator('#toast').boundingBox();
        await page.mouse.move(bt.x + bt.width / 2, bt.y + bt.height / 2); await page.mouse.down();
        await page.mouse.move(bt.x + bt.width / 2 + 90, bt.y + bt.height / 2, { steps: 6 }); await page.mouse.up();
        await B.pause(150);
        signaler('flottant›glisser', !(await page.evaluate(() => document.getElementById('toast').classList.contains('show'))), 'pas écarté en glissant');
        await page.evaluate(() => window.KladApp.toastAnnuler('Premier', () => {}));
        await page.evaluate(() => window.KladApp.toast('Second'));
        signaler('flottant›remplacement', await page.evaluate(() => document.querySelectorAll('#toast.show').length === 1 && document.getElementById('toast').textContent === 'Second'), 'pas remplacé');
        await page.evaluate(() => window.KladApp.ouvrirVolet('secReglages')); await B.pause(200);
        await flottant('flottant›volet', () => window.KladApp.toast('Réglages enregistrés (1).'), 5000);
        await page.evaluate(() => window.KladApp.toast('Réglages enregistrés (1).')); await B.pause(150);
        await page.locator('#reglagesCorps [data-reglt]').first().click({ timeout: 2000 }).catch(() => defauts.set('flottant›volet › bouton du volet inutilisable', cfg));
        await B.pause(150);
        signaler('flottant›volet', await page.evaluate(() => !!document.getElementById('reglThemeCorps').closest('#volet')), 'bouton du volet inutilisable');
        await B.fermer();
        await page.evaluate(() => document.getElementById('toast').click());
        // compteur de l'onglet Opérations : ni sur l'icône, ni sur le libellé
        signaler('compteur', await page.evaluate(() => {
          const b = document.getElementById('tb-badge');
          if (!b || b.hidden) return true;
          const r = b.getBoundingClientRect();
          const inter = (a, c) => a.left < c.right - 0.5 && c.left < a.right - 0.5 && a.top < c.bottom - 0.5 && c.top < a.bottom - 0.5;
          return [...document.querySelectorAll('#app-tb [data-tab] svg, #app-tb [data-tab] .tb-l')].every(e => !inter(r, e.getBoundingClientRect())) && r.right <= innerWidth;
        }), 'chevauche l\'icône ou le libellé');
        // bandeau du mode démo, sur chaque onglet
        await page.evaluate(() => window.KladAffichage.demarrerDemo(window.KladApp.etat()));
        await B.pause(250);
        for (const t of B.onglets) { await B.onglet(t); await page.evaluate(() => window.KladAffichage.replierDemo && window.KladAffichage.replierDemo(false)); await f('démo›' + t); }
        // bandeau : flottant comme les messages ; replié d'un appui, rouvert d'un appui, replié seul après 6 s ; masqué
        // pendant un message ; replié : dans l'écran aussi
        await B.onglet('accueil');
        await page.evaluate(() => window.KladAffichage.replierDemo && window.KladAffichage.replierDemo(false)); await B.pause(150);
        await libre('flottant›démo', '#demoBar');
        await page.evaluate(() => window.KladAffichage.replierDemo && window.KladAffichage.replierDemo(false));
        await page.locator('#demoBar .db-t').click({ timeout: 2000 }).catch(() => {});
        signaler('flottant›démo', await page.evaluate(() => document.getElementById('demoBar').classList.contains('reduit')), 'pas replié par un appui');
        await f('démo›replié');
        await libre('flottant›démo replié', '#demoBar');
        await page.locator('#demoBar').click({ timeout: 2000 }).catch(() => {});
        signaler('flottant›démo', await page.evaluate(() => !document.getElementById('demoBar').classList.contains('reduit')), 'pas rouvert par un appui');
        await page.clock.runFor(6300); await B.pause(100);
        signaler('flottant›démo', await page.evaluate(() => document.getElementById('demoBar').classList.contains('reduit')), 'pas replié seul après 6 s');
        await page.evaluate(() => window.KladApp.toast('Synchronisation terminée.')); await B.pause(150);
        signaler('flottant›démo', await page.evaluate(() => getComputedStyle(document.getElementById('demoBar')).visibility === 'hidden'), 'deux éléments flottants à la fois');
        await page.evaluate(() => document.getElementById('toast').click());
        await page.evaluate(() => window.KladAffichage.replierDemo && window.KladAffichage.replierDemo(false));
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
