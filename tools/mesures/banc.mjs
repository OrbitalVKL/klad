// Banc de mesure commun à l'outil de mesures (mesurer.mjs) et au test d'accessibilité (test/accessibilite.test.mjs) :
// page servie depuis www/, coffre de démonstration du navigateur, premier lancement, reprise fictive de 3 ans
// (donnees.mjs), date figée, puis parcours générique des écrans (onglets, sous-vues, détail d'une opération, Classer,
// entrées de Plus). Aucune donnée réelle.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { repriseMesures } from './donnees.mjs';

const ICI = path.dirname(new URL(import.meta.url).pathname);
export const AUJ = '2026-10-28';
export function playwright() {
  try { return createRequire(path.join(ICI, '../../package.json'))('playwright'); } catch (e) { return null; }
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2', '.mjs': 'text/javascript' };
function serveur(WWW) {
  return new Promise(resolve => {
    const s = http.createServer((req, res) => {
      const f = path.join(WWW, decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/\/$/, '/index.html'));
      if (!f.startsWith(WWW) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
      res.end(fs.readFileSync(f));
    });
    s.listen(0, '127.0.0.1', () => resolve(s));
  });
}

// o : { www, palette ('klad' | 'grafit'), theme ('clair' | 'sombre' | absent), reprise (fin → reprise, jeu des mesures par défaut) } → banc { page, code, verrouiller, fermer, onglets, … }
export async function ouvrir(o) {
  o = o || {};
  const WWW = path.resolve(o.www || path.join(ICI, '../../www'));
  const { chromium } = playwright();
  const srv = await serveur(WWW);
  // o.mobile : écran de téléphone (isMobile), nécessaire pour simuler la taille du texte d'Android (texte(), 0.10.9).
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: o.largeur || 412, height: 915 }, hasTouch: true, isMobile: !!o.mobile, reducedMotion: 'reduce', locale: 'fr-FR' });
  const page = await ctx.newPage();
  page.setDefaultTimeout(30000);
  const erreurs = [];
  page.on('pageerror', e => erreurs.push(e.message));
  await page.clock.install({ time: new Date(AUJ + 'T10:00:00') });
  await page.addInitScript(p => { try { if (p) localStorage.setItem('klad.palette', p); } catch (e) { /* page vide */ } }, o.palette && o.palette !== 'klad' ? o.palette : null);
  await page.goto('http://127.0.0.1:' + srv.address().port + '/');
  const pause = ms => page.waitForTimeout(ms);
  const code = async n => { for (const k of '123456'.slice(0, n || 6)) await page.keyboard.press(k); };
  await page.getByRole('button', { name: 'Créer mon code' }).click();
  await code(); await pause(100); await code();
  const groupes = await page.locator('ol.phrase li').allInnerTexts();
  await page.getByRole('button', { name: 'Je l\'ai recopiée' }).click();
  for (const id of ['g1', 'g2']) {
    const lab = await page.locator('label:has(#' + id + ')').innerText();
    await page.fill('#' + id, groupes[+lab.match(/n° (\d)/)[1] - 1]);
  }
  await page.getByRole('button', { name: 'Vérifier' }).click();
  await page.waitForSelector('#appli:not([hidden])');
  await page.evaluate(() => window.KladApp.ouvrirVolet('secReprise'));
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.locator('#btnChoisirReprise').click()]);
  await fc.setFiles({ name: 'reprise.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(o.reprise ? o.reprise(AUJ) : repriseMesures(AUJ))) });
  await page.waitForSelector('#repriseApercu [data-a="importer"]');
  await page.locator('#repriseApercu [data-a="importer"]').click();
  await page.waitForFunction(() => { const S = window.KladApp.etat(); return S && S.budget && S.classement && S.classement.import; });
  await pause(800);
  const verrouiller = () => page.evaluate(() => { let b = document.getElementById('btnLock'); if (!b) { b = document.createElement('button'); b.id = 'btnLock'; b.hidden = true; document.body.appendChild(b); } b.click(); });
  await verrouiller();
  await page.waitForSelector('.pad');
  await code();
  await page.waitForSelector('#appli:not([hidden])');
  await pause(1200);

  const onglets = await page.$$eval('#app-tb [data-tab]', bs => bs.map(b => b.dataset.tab));
  async function fermer() {
    await page.evaluate(() => { if (window.KladApp.fermerVolet) window.KladApp.fermerVolet(true); });
    await pause(50);
  }
  async function onglet(t) {
    await fermer();
    await page.locator('#app-tb [data-tab="' + t + '"]').click();
    await pause(350);
    await page.evaluate(() => window.scrollTo(0, 0));
  }
  // Opérations du périmètre perso (même liste qu'en 0.9.4, où l'onglet suivait le dernier périmètre de Budget / Commun).
  async function operationsPerso() {
    if (onglets.indexOf('budget') >= 0) await onglet('budget');
    await onglet('operations');
    const p = page.locator('[data-perimetre="perso"]');
    if (await p.count()) { await p.first().click(); await pause(250); }
  }
  const portee = () => page.evaluate(() => document.getElementById('volet') && !document.getElementById('volet').hidden ? '#volet' : '#appli');
  const sousVues = () => page.$$eval('[data-sousvue]', bs => [...new Set(bs.filter(b => b.offsetParent !== null).map(b => b.dataset.sousvue))]);
  async function avecSousVues(nom, f) {
    await f(nom, await portee());
    for (const s of await sousVues()) {
      await page.locator('[data-sousvue="' + s + '"]:visible').first().click();
      await pause(250);
      await page.evaluate(() => window.scrollTo(0, 0));
      await f(nom + '›' + s, await portee());
    }
  }
  // Écrans principaux : onglets (et leurs sous-vues), détail d'une opération, volet « Classer ».
  async function ecransPrincipaux(f) {
    for (const t of onglets) { if (t === 'operations') await operationsPerso(); else await onglet(t); await avecSousVues(t, f); }
    await operationsPerso();
    if (await page.$('[data-op]')) {
      await page.evaluate(() => { const r = document.querySelector('[data-op][data-c]'); window.KladApp.ouvrirOp(r.dataset.c, r.dataset.op); });
      await pause(250);
      await f('operation', await portee());
      const cl = await page.$('[data-a="classer"]');
      if (cl) { await cl.click(); await pause(250); await f('classer', await portee()); }
    }
    await fermer();
    // 0.10.7 : catégories (nouvelle catégorie ouverte, une catégorie dépliée) et sélecteur d'icône
    if (await page.evaluate(() => !!window.KladSelIcone)) {
      await page.evaluate(() => window.KladApp.ouvrirVolet('secClassement'));
      await pause(250);
      if (await page.locator('#classementCorps [data-a="nc-ouvrir"]').count()) await page.locator('#classementCorps [data-a="nc-ouvrir"]').click();
      if (await page.locator('#classementCorps [data-a="nr-ouvrir"]').count()) await page.locator('#classementCorps [data-a="nr-ouvrir"]').click();   // 0.10.8
      if (!(await page.locator('#classementCorps .edcat').count())) await page.locator('#classementCorps [data-cat]').first().click();
      await pause(150);
      await f('classement', await portee());
      await page.evaluate(() => window.KladSelIcone.ouvrir(document.querySelector('#classementCorps [data-cat]').dataset.cat));
      await pause(250);
      await f('icone', await portee());
      await page.fill('#icQ', 'courses');
      await pause(150);
      await f('icone›recherche', await portee());
      await fermer();
    }
  }
  // Entrées de Plus (volets et écrans ouverts depuis Plus).
  async function ecransPlus(f) {
    await onglet('plus');
    const cont = await page.evaluate(() => document.getElementById('plusCorps') && document.getElementById('plusCorps').offsetParent !== null ? '#plusCorps' : '#appli');
    const entrees = await page.$$eval(cont + ' [data-volet], ' + cont + ' [data-vue], ' + cont + ' [data-plus]',
      bs => bs.map(b => b.dataset.volet ? '[data-volet="' + b.dataset.volet + '"]' : b.dataset.vue ? '[data-vue="' + b.dataset.vue + '"]' : '[data-plus="' + b.dataset.plus + '"]'));
    for (const sel of [...new Set(entrees)]) {
      await onglet('plus');
      const b = page.locator(cont + ' ' + sel).first();
      if (!(await b.count()) || !(await b.isVisible())) continue;
      await b.click();
      await pause(300);
      await page.evaluate(() => window.scrollTo(0, 0));
      await avecSousVues('plus›' + sel.replace(/^\[data-[a-z]+="|"\]$/g, ''), f);
    }
    await fermer();
  }
  async function theme(t) {
    await page.emulateMedia({ colorScheme: t === 'sombre' ? 'dark' : 'light', reducedMotion: 'reduce' });
    await pause(100);
  }
  // Taille du texte en % (comme « taille de police » d'Android, que la WebView applique au texte seulement) ; o.mobile requis.
  async function texte(pc) {
    await page.evaluate(pc => {
      let st = document.getElementById('banc-texte');
      if (!st) { st = document.createElement('style'); st.id = 'banc-texte'; document.head.appendChild(st); }
      st.textContent = pc && pc !== 100 ? 'html{-webkit-text-size-adjust:' + pc + '%;text-size-adjust:' + pc + '%}' : '';
    }, pc);
    await pause(60);
  }
  async function fin() { await browser.close(); srv.close(); }
  return { page, ctx, erreurs, code, pause, verrouiller, fermer, onglet, operationsPerso, onglets, ecransPrincipaux, ecransPlus, theme, texte, fin };
}
