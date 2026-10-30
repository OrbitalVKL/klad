// 0.10.9 : captures d'écran autorisées seulement en mode démo (FLAG_SECURE retiré en entrant, rétabli en sortant et au
// verrouillage) ; diagnostic d'affichage (Plus › Aide et à propos), texte sans donnée personnelle. Données fictives.
// La partie Chromium est sautée si Playwright n'est pas installé, sauf avec KLAD_PARCOURS=obligatoire.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { charge } from './charge.mjs';
import { ouvrir, playwright } from '../tools/mesures/banc.mjs';

const PW = playwright();
const SAUT = !PW && !process.env.KLAD_PARCOURS && 'Playwright absent';
const lire = f => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');

const MESURES = {
  version: '0.10.9',
  natif: { fabricant: 'Fabricant', modele: 'Modèle X', android: '15', sdk: 35, webview: 'com.example.webview 130.0.1', textZoom: 175, echellePolice: 1.75,
    largeurDp: 384, hauteurDp: 832, densite: 2.8125, dpi: 450, dpiStandard: 420, webviewPx: '1080 × 2340', margesPx: '0 120 0 63' },
  ecran: { largeur: 384, hauteur: 780, dpr: 2.8125, vvLargeur: 384, vvHauteur: 780, vvEchelle: 1, pageLargeur: 384 },
  police: { calculee: '15px', rapport: 1.75 },
  marges: { haut: 42.67, droite: 0, bas: 22.4, gauche: 0 },
  contour: { style: 'solid', largeur: 2, decalage: 2, actif: true },
  rects: { champ: { left: 18, right: 366, width: 348, height: 48 }, etiquette: { left: 18, right: 366, width: 348, height: 90 }, formulaire: { left: 18, right: 366, width: 348, height: 200 },
    defilante: { left: 12, right: 372, width: 360, height: 600 }, volet: { left: 0, right: 384, width: 384, height: 680 } },
  defile: { volet: 0, page: 0 }
};

test('diagnostic d\'affichage : texte complet, constat, aucune donnée personnelle', () => {
  const { KladDiagAff: D } = charge(['diagaff.js']);
  const t = D.texte(MESURES);
  for (const re of [/^Klad — diagnostic d'affichage$/m, /^Version : 0\.10\.9$/m, /Appareil : Fabricant Modèle X · Android 15 \(SDK 35\)/, /WebView : com\.example\.webview 130\.0\.1/,
    /textZoom 175 % · police du système × 1,75/, /densité 2,81 \(450 dpi, standard 420 dpi, soit 107 %\)/, /Écran \(CSS px\) : 384 × 780 · devicePixelRatio 2,81/,
    /Marges de sécurité \(CSS px\) : haut 42,67, droite 0, bas 22,4, gauche 0/, /^Champ : 18 → 366 \(largeur 348, hauteur 48\)$/m, /^Volet : 0 → 384/m,
    /Constat : le champ et son contour tiennent dans le volet/]) assert.match(t, re);
  assert.doesNotMatch(t, /€|IBAN|@/);
  // contour coupé (cas de la 0.10.8 : zone défilante au ras du champ) ; champ hors de l'écran
  const m2 = JSON.parse(JSON.stringify(MESURES));
  m2.rects.defilante = { left: 18, right: 366, width: 348, height: 600 };
  assert.match(D.texte(m2), /Constat : le contour du champ est coupé par le volet/);
  m2.rects.champ = { left: -10, right: 400, width: 410, height: 48 };
  assert.match(D.texte(m2), /le champ sort de son étiquette ; le champ sort de l'écran/);
  m2.natif = null;
  assert.match(D.texte(m2), /Appareil : navigateur/);
  // code : rien de l'état de l'appli (comptes, opérations, réglages) n'est lu
  assert.doesNotMatch(lire('www/diagaff.js'), /etat\(\)\.|S\.modele|S\.ops|S\.budget|libelle|iban/i);
});

test('Android : captures seulement en mode démo, diagnostic sans identifiant de l\'appareil', () => {
  const af = lire('android/app/src/main/java/app/klad/affichage/KladAffichagePlugin.java');
  assert.match(af, /public void captures\(PluginCall call\)/);
  assert.match(af, /addFlags\(WindowManager\.LayoutParams\.FLAG_SECURE\)/);
  assert.match(af, /clearFlags\(WindowManager\.LayoutParams\.FLAG_SECURE\)/);
  assert.match(af, /handleOnPause\(\) \{\s*super\.handleOnPause\(\);\s*proteger\(getActivity\(\)\.getWindow\(\), true\);/);
  assert.match(af, /public void diagnostic\(PluginCall call\)/);
  assert.doesNotMatch(af, /ANDROID_ID|getSerial|Build\.SERIAL|getImei|getDeviceId|Settings\.Secure/);
  // l'écran reste protégé au démarrage
  assert.match(lire('android/app/src/main/java/app/klad/MainActivity.java'), /setFlags\(WindowManager\.LayoutParams\.FLAG_SECURE, WindowManager\.LayoutParams\.FLAG_SECURE\)/);
});

test('mode démo : captures autorisées en entrant, interdites en sortant et au verrouillage ; diagnostic depuis Plus', { skip: SAUT, timeout: 300000 }, async () => {
  const B = await ouvrir({});
  try {
    const { page } = B;
    // appli native simulée : appels au plugin KladAffichage enregistrés
    await page.evaluate(() => {
      window.__appels = [];
      window.Capacitor = { Plugins: { KladAffichage: {
        appliquer: () => Promise.resolve({ ok: true }),
        captures: o => { window.__appels.push(o.autoriser); return Promise.resolve({ captures: o.autoriser }); },
        diagnostic: () => Promise.resolve({ fabricant: 'Fabricant', modele: 'Modèle X', android: '15', sdk: 35, webview: 'webview 130', textZoom: 150, echellePolice: 1.5,
          largeurDp: 412, hauteurDp: 915, densite: 2.625, dpi: 420, dpiStandard: 420, webviewPx: '1080 × 2400', margesPx: '0 0 0 0' })
      } } };
    });
    const appels = () => page.evaluate(() => window.__appels.slice());
    await B.onglet('plus');
    await page.locator('#plusCorps [data-volet="secAffichage"]').click();
    await page.waitForSelector('#affichageCorps [data-demo="on"]');
    assert.match(await page.locator('#affichageCorps').innerText(), /Captures d'écran autorisées pendant le mode démo seulement/);
    await page.locator('#affichageCorps [data-demo="on"]').click();
    await B.pause(150);
    assert.match(await page.locator('#demoBar').innerText(), /MODE DÉMO · chiffres fictifs · captures d'écran autorisées/i);
    assert.deepEqual(await appels(), [true]);
    await page.locator('#demoBar button').click();
    assert.deepEqual(await appels(), [true, false]);
    // verrouillage en mode démo : le mode s'arrête, les captures sont de nouveau interdites
    await page.evaluate(() => window.KladAffichage.demarrerDemo(window.KladApp.etat()));
    assert.deepEqual(await appels(), [true, false, true]);
    await B.verrouiller();
    await page.waitForSelector('.pad');
    assert.deepEqual(await appels(), [true, false, true, false]);
    assert.equal(await page.evaluate(() => window.KladAffichage.demoActif()), false);
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains('demo')), false);
    await B.code();
    await page.waitForSelector('#appli:not([hidden])');
    await B.pause(600);
    // Plus › Aide et à propos › Diagnostic d'affichage : volet « Nouvelle catégorie » de test, texte mesuré et copié
    await B.onglet('plus');
    await page.locator('#plusCorps [data-plus="diagaff"]').click();
    await page.waitForFunction(() => /Constat/.test((document.getElementById('diagAffTexte') || {}).textContent || ''));
    assert.equal(await page.locator('#voletTitre').innerText(), 'Nouvelle catégorie (test)');
    const t = await page.locator('#diagAffTexte').innerText();
    for (const re of [/Appareil : Fabricant Modèle X · Android 15/, /textZoom 150 %/, /Écran \(CSS px\) : 412 × /, /^Champ : 18 → 394/m, /Zone défilante du volet : 12 → 400/m,
      /Constat : le champ et son contour tiennent dans le volet/]) assert.match(t, re);
    // aucune donnée du jeu fictif (comptes, montants)
    const comptes = await page.evaluate(() => window.KladApp.etat().modele.comptes.map(c => c.libelle));
    for (const l of comptes) assert.ok(!t.includes(l), l);
    assert.doesNotMatch(t, /€/);
    assert.equal(await page.evaluate(() => window.KladApp.etat().classement.categories['ex. Bien être']), undefined, 'rien n\'est enregistré');
    assert.deepEqual(B.erreurs, []);
  } finally { await B.fin(); }
});
