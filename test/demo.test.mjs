// 0.10.9 : captures d'écran autorisées seulement en mode démo (FLAG_SECURE retiré en entrant, rétabli en sortant et au
// verrouillage) ; diagnostic d'affichage (Plus › Aide et à propos), texte sans donnée personnelle. Données fictives.
// 0.10.10 : rien de réel à l'écran en mode démo (dictionnaire tiré des données, KladDemo) ; parcours de tous les écrans et
// volets sur le jeu fictif « personnel » ; champs en lecture seule ; rien n'est enregistré ni synchronisé.
// La partie Chromium est sautée si Playwright n'est pas installé, sauf avec KLAD_PARCOURS=obligatoire.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { charge } from './charge.mjs';
import { ouvrir, playwright } from '../tools/mesures/banc.mjs';
import { reprisePersonnelle } from '../tools/mesures/donnees.mjs';
import { completer, interdits, fuites, parcoursComplet } from './demo-outils.mjs';

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

test('mode démo : dictionnaire tiré des données (libellés, catégories, postes, personnes, numéros)', () => {
  const X = charge(['anon.js', 'format.js', 'modele.js', 'classement.js', 'carnet.js', 'budget.js', 'ui.js', 'vues.js', 'demo.js']);
  const { KladModele: M, KladClasse: K, KladBudget: KB, KladDemo: D } = X;
  const S = M.vide();
  S.modele.connexions.s1 = { banque: 'Banque Fictive du Nord' };
  const a = M.nouveauCompte(S, { libelle: 'Compte Fictivia perso', role: 'courant', source: { type: 'eb', connexion: 's1', intitule: 'M CAMILLE EXEMPLE CHEQUES', titulaire: 'CAMILLE EXEMPLE' } });
  const b = M.nouveauCompte(S, { libelle: 'Commun', role: 'commun' });
  S.classement = K.nouveau();
  S.classement.categories['Voyages Fictifs'] = { nature: 'optionnelle' };
  S.classement.regles = [{ mot: 'SUPERMARCHE', cat: 'Alimentation', sub: 'Courses' }, { mot: 'ATLANTIDE', cat: 'Voyages Fictifs', sub: 'Billets Atlantide' },
    { mot: 'DOMINIQUE', cat: 'Apports compte commun', sub: 'Dominique' }];
  const op = (c, i, m, l) => ({ id: c.id + ':t:' + i, compte: c.id, date: '2026-10-' + String(10 + i).padStart(2, '0'), montant: m, libelle: l, statut: 'comptabilisee', source: 'eb', vue: true });
  S.ops[a.id] = [op(a, 1, -4200, 'CARTE 11/10 SUPERMARCHE DES LILAS'), op(a, 2, -32000, 'CARTE 12/10 ATLANTIDE AIRWAYS'), op(a, 3, -999, 'PRLV INCONNU REF 99887766')];
  S.ops[b.id] = [op(b, 4, 60000, 'VIR M DOMINIQUE EXEMPLE')];
  S.budget = KB.nouveau();
  S.budget.reglages = { commun: { moi: 'Camille Exemple', autre: 'Dominique Exemple' } };
  S.budget.contrats = [{ id: 'c1', sc: 'perso', label: 'Contrat Assurance Phénix n° 123456', montant: 4500, per: 1, motif: 'PHENIX', poste: 'f|Assurance auto', src: 'Avis Phénix', note: '' }];
  const DD = D.construire(S, {});
  const m = t => D.masquer(t, DD);
  assert.equal(m('SUPERMARCHE DES LILAS'), 'Courses');
  assert.equal(m('CARTE 11/10 SUPERMARCHE DES LILAS'), 'Courses');
  assert.equal(m('ATLANTIDE AIRWAYS · 320,00 €'), 'Poste 1 · 320,00 €');           // poste au nom propre → « Poste N »
  assert.equal(m('Voyages Fictifs › Billets Atlantide'), 'Catégorie 1 › Poste 1');     // catégorie créée → « Catégorie N »
  assert.equal(m('Alimentation › Courses'), 'Alimentation › Courses');                 // catégorie d'office et poste courant gardés
  assert.equal(m('Dominique Exemple doit 100 € à Camille'), 'Personne B doit 100 € à Personne A');
  assert.equal(m('VIR M DOMINIQUE EXEMPLE'), 'Personne B');
  assert.equal(m('Contrat Assurance Phénix n° 123456'), 'Assurance auto');
  assert.equal(m('Banque Fictive du Nord · M CAMILLE EXEMPLE CHEQUES'), 'Banque A · Compte 1');
  assert.equal(m('Compte Fictivia perso'), 'Compte courant 1');
  assert.equal(m('Commun'), 'Commun');                                                  // libellé fait de mots courants : gardé
  assert.equal(m('IBAN FR76 3000 4000 0312 3456 7890 143.'), 'IBAN FR76 •••• •••• ••••.');
  assert.equal(m('Réf. 99887766, CTR-990077, carte …4242'), 'Réf. ••••••, ••••••, carte …••••');
  assert.equal(m('Écrire à camille.exemple@example.org ou https://exemple.github.io/klad/'), 'Écrire à •••@••• ou adresse masquée');
  assert.equal(m('Cycle du 27/10 au 26/11 · 12 % · 2 302,73 €'), 'Cycle du 27/10 au 26/11 · 12 % · 2 302,73 €');
  assert.equal(D.initialesBanque(DD, 'Banque Fictive du Nord'), 'A');
});

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
    assert.match(await page.locator('#demoBar').innerText(), /MODE DÉMO · chiffres et libellés fictifs · captures d'écran autorisées/i);
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

test('mode démo : rien de réel à l\'écran (jeu « personnel »), champs en lecture seule, rien d\'enregistré ni synchronisé', { skip: SAUT, timeout: 900000 }, async () => {
  const B = await ouvrir({ reprise: reprisePersonnelle });
  try {
    const { page } = B;
    await completer(page);
    await B.pause(600);
    const L = await interdits(page);
    assert.ok(L.length > 60, L.length + ' textes interdits');
    // hors mode démo, le relevé voit bien les données du jeu (le contrôle n'est pas vide)
    await B.onglet('accueil');
    assert.ok((await fuites(page, L)).length > 0, 'données visibles hors mode démo');
    const blocs = () => page.evaluate(() => { const d = JSON.parse(sessionStorage.getItem('klad.demo') || '{}'); const b = Object.assign({}, d.blobs); delete b.journal; return JSON.stringify(b); });
    await B.pause(800);
    const avant = await blocs();
    const libelle = await page.evaluate(() => window.KladApp.etat().modele.comptes[0].libelle);
    // trois appuis sur le numéro de version
    for (let i = 0; i < 3; i++) await page.locator('#ver').click();
    await B.pause(300);
    assert.equal(await page.evaluate(() => window.KladAffichage.demoActif()), true, 'mode démo activé par trois appuis');
    assert.match(await page.locator('#demoBar').innerText(), /chiffres et libellés fictifs · captures d'écran autorisées/i);
    const defauts = [], ecrits = [];
    let n = 0;
    const f = async nom => {
      n++;
      await B.pause(120);
      for (const x of await fuites(page, L)) defauts.push(nom + ' › ' + x.ou + ' : ' + x.mot + ' (« ' + x.extrait + ' »)');
      // champs de saisie visibles : en lecture seule (sauf les recherches)
      for (const c of await page.evaluate(() => [...document.querySelectorAll('input, textarea')].filter(i => i.getClientRects().length && !i.readOnly &&
        !/^(checkbox|radio|hidden|button|submit|reset|file|range|color|search)$/.test(i.type) && !i.matches('#q, #icQ, #bankSearch')).map(i => '#' + (i.id || i.className)))) ecrits.push(nom + ' › ' + c);
    };
    await parcoursComplet(B, f);
    assert.ok(n >= 60, n + ' écrans et volets parcourus');
    assert.deepEqual([...new Set(defauts)], [], 'données réelles affichées en mode démo');
    assert.deepEqual([...new Set(ecrits)], [], 'champs modifiables en mode démo');
    // rien n'est enregistré ni synchronisé ; l'état d'avant revient en sortant
    await page.evaluate(() => { const S = window.KladApp.etat(); S.modele.comptes[0].libelle = 'Changé pendant la démo'; window.KladApp.changed('test'); });
    assert.equal(await page.evaluate(() => window.KladApp.synchro('manuel')), null);
    assert.match(await page.locator('#toast').innerText(), /Synchronisation suspendue pendant le mode démo/);
    await B.pause(1200);
    assert.equal(await blocs(), avant, 'aucun bloc écrit pendant le mode démo');
    await page.locator('#demoBar button').click();
    await B.pause(300);
    assert.equal(await page.evaluate(() => window.KladAffichage.demoActif()), false);
    assert.equal(await page.evaluate(() => window.KladApp.etat().modele.comptes[0].libelle), libelle, 'état d\'avant rendu en sortant');
    // hors mode démo : textes et champs d'origine
    await B.onglet('accueil');
    assert.ok((await fuites(page, L)).length > 0, 'textes d\'origine rendus');
    assert.equal(await page.evaluate(() => [...document.querySelectorAll('input')].filter(i => /•••/.test(i.value)).length), 0, 'aucun champ masqué restant');
    assert.deepEqual(B.erreurs, []);
  } finally { await B.fin(); }
});
