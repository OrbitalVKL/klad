#!/usr/bin/env node
// Mesures de l'étude UX (même protocole à chaque version) : accessibilité (contrôles de moins de 48 dp, textes sous le
// seuil de contraste WCAG AA, plus petite police) écran par écran, en clair et en sombre, et rapidité (déverrouillage →
// soldes et reste à vivre affichés, changement d'onglet, défilement de 3 ans d'opérations), processeur ralenti 4 fois.
// Coffre de démonstration du navigateur, jeu fictif (donnees.mjs), date figée. Aucune donnée réelle.
//
// Usage : node tools/mesures/mesurer.mjs [--www <dossier>] [--sortie mesures.json] [--palette klad|grafit]
//         [--sans-perf] [--sans-a11y] [--captures <dossier>] [--detail]
import fs from 'node:fs';
import path from 'node:path';
import { ouvrir, AUJ } from './banc.mjs';
import { auditer } from './audit.mjs';

const args = {};
for (let i = 2, k = null; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith('--')) { k = a.slice(2); args[k] = true; } else if (k) { args[k] = a; k = null; }
}
const B = await ouvrir({ www: typeof args.www === 'string' ? args.www : null, palette: args.palette });
const { page, pause } = B;
const resultat = {
  version: await page.evaluate(() => (window.KLAD_CONFIG || {}).version || 'dev'), date: AUJ, palette: args.palette || 'klad',
  operations: await page.evaluate(() => Object.values(window.KladApp.etat().ops).flat().length)
};

// ------------------------------------------------------------ accessibilité
if (!args['sans-a11y']) {
  resultat.a11y = {};
  for (const theme of ['clair', 'sombre']) {
    await B.theme(theme);
    const ecrans = {};
    const mesurer = async (nom, sel) => {
      ecrans[nom] = await page.evaluate(auditer, { portee: sel, detail: !!args.detail });
      if (typeof args.captures === 'string') { fs.mkdirSync(args.captures, { recursive: true }); await page.screenshot({ path: path.join(args.captures, theme + '-' + nom.replace(/[›\s/]/g, '_') + '.png') }); }
    };
    await B.ecransPrincipaux(mesurer);
    const principaux = Object.keys(ecrans);
    await B.ecransPlus(mesurer);
    const somme = noms => noms.reduce((t, n) => ({ controles: t.controles + ecrans[n].controles, petits: t.petits + ecrans[n].petits,
      contrastes: t.contrastes + ecrans[n].contrastes, police: Math.min(t.police, ecrans[n].police) }), { controles: 0, petits: 0, contrastes: 0, police: 99 });
    resultat.a11y[theme] = { principaux: somme(principaux), tous: somme(Object.keys(ecrans)), ecrans };
  }
  await B.theme('clair');
}

// ------------------------------------------------------------ rapidité (processeur ralenti 4 fois)
if (!args['sans-perf']) {
  const cdp = await B.ctx.newCDPSession(page);
  const ralentir = r => cdp.send('Emulation.setCPUThrottlingRate', { rate: r });
  const perf = { deverrouillage: [], onglets: {} };
  for (let essai = 0; essai < 3; essai++) {
    await B.onglet(B.onglets[0]);
    await B.verrouiller();
    await page.waitForSelector('.pad');
    await pause(300);
    await B.code(5);
    await ralentir(4);
    await page.evaluate(() => {
      window.__m = {};
      const t0 = performance.now();
      const voir = () => {
        const sold = document.querySelector('[data-mesure="soldes"], #bal-panel .bal-t');
        const rav = document.querySelector('[data-mesure="rav"], #rav-m:not([hidden])');
        if (sold && !window.__m.soldes && sold.offsetParent !== null) window.__m.soldes = performance.now() - t0;
        if (rav && !window.__m.rav && rav.offsetParent !== null && rav.textContent.trim()) window.__m.rav = performance.now() - t0;
        if (!(window.__m.soldes && window.__m.rav) && performance.now() - t0 < 20000) requestAnimationFrame(voir);
      };
      document.addEventListener('keydown', () => requestAnimationFrame(voir), { once: true, capture: true });
    });
    await page.keyboard.press('6');
    await page.waitForFunction(() => window.__m.soldes && window.__m.rav, null, { timeout: 30000 });
    perf.deverrouillage.push(await page.evaluate(() => ({ soldes: Math.round(window.__m.soldes), rav: Math.round(window.__m.rav) })));
    await ralentir(1);
    await pause(1500);
  }
  await ralentir(4);
  for (const t of B.onglets.slice(1).concat(B.onglets[0])) {
    await B.fermer();
    perf.onglets[t] = await page.evaluate(t => new Promise(r => { const t0 = performance.now(); document.querySelector('#app-tb [data-tab="' + t + '"]').click(); requestAnimationFrame(() => requestAnimationFrame(() => r(Math.round(performance.now() - t0)))); }), t);
    await pause(400);
  }
  await ralentir(1);
  // défilement de toute la liste des opérations (période « tout », 40 défilements rapides)
  await B.operationsPerso();
  await page.evaluate(() => {
    window.__lt = [];
    new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lt.push(e.duration); }).observe({ type: 'longtask' });
  });
  await ralentir(4);
  await page.mouse.move(200, 500);
  for (let i = 0; i < 40; i++) { await page.mouse.wheel(0, 3000); await pause(150); }
  await pause(500);
  await ralentir(1);
  perf.defilement = await page.evaluate(() => ({ taches: window.__lt.length, max: Math.round(Math.max(0, ...window.__lt)), total: Math.round(window.__lt.reduce((a, b) => a + b, 0)),
    lignes: document.querySelectorAll('[data-op]').length, elements: document.getElementsByTagName('*').length }));
  resultat.perf = perf;
}

resultat.erreurs = B.erreurs;
if (typeof args.sortie === 'string') fs.writeFileSync(args.sortie, JSON.stringify(resultat, null, 1));
const a = resultat.a11y;
if (a) for (const t of Object.keys(a)) console.log(t + ' · principaux : ' + JSON.stringify(a[t].principaux) + ' · tous : ' + JSON.stringify(a[t].tous));
if (resultat.perf) console.log('perf : ' + JSON.stringify({ dev: resultat.perf.deverrouillage, onglets: resultat.perf.onglets, defilement: resultat.perf.defilement }));
if (B.erreurs.length) console.log('erreurs de page : ' + B.erreurs.join(' | '));
await B.fin();
