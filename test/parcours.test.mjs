// Parcours dans Chromium (coffre de démonstration, faux client Enable Banking, données fictives) :
// premier lancement, connexion d'une banque, synchro simulée, import d'une reprise puis réimport, réglage des comptes,
// renouvellement d'accès, accueil, opérations, verrouillage.
// Sauté si Playwright et Chromium ne sont pas installés, sauf avec KLAD_PARCOURS=obligatoire (fabrication GitHub Actions).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { repriseFictive } from './fictif.mjs';

let chromium = null;
try { ({ chromium } = createRequire(import.meta.url)('playwright')); } catch (e) { chromium = null; }

const WWW = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../www');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };

function serveur() {
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

// Faux client Enable Banking injecté dans la page (window.KladFauxEB), données fictives datées par rapport à aujourd'hui.
function fauxEB() {
  const jour = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  const tx = (n, montant, label, o) => Object.assign({ booking_date: jour(n), transaction_amount: { amount: (Math.abs(montant) / 100).toFixed(2), currency: 'EUR' },
    credit_debit_indicator: montant < 0 ? 'DBIT' : 'CRDT', remittance_information: [label], status: 'BOOK' }, o || {});
  window.KladFauxEB = {
    async application() { return { name: 'Appli fictive', environment: 'SANDBOX', redirect_urls: [] }; },
    async aspsps() { return [{ name: 'Banque Démo', country: 'FR', maximum_consent_validity: 7776000, required_psu_headers: ['Psu-Ip-Address'] }]; },
    async startAuth(o) { return { url: location.origin + location.pathname + '?code=CODE-FICTIF&state=' + o.state }; },
    async createSession() {
      const n = +(sessionStorage.getItem('faux.sessions') || 0) + 1;
      sessionStorage.setItem('faux.sessions', String(n));
      return { session_id: n > 1 ? 'sess-fictive-' + n : 'sess-fictive', access: { valid_until: new Date(Date.now() + 80 * 864e5).toISOString() }, accounts: [
        { uid: 'uid-1', account_id: { iban: 'FR7600000000000000000000001' }, product: 'Compte courant', cash_account_type: 'CACC', currency: 'EUR' },
        { uid: 'uid-2', account_id: { iban: 'FR7600000000000000000000002' }, product: 'Livret', cash_account_type: 'SVGS', currency: 'EUR' }] };
    },
    async deleteSession() { return {}; },
    async balances(uid) { return [{ balance_type: 'CLBD', balance_amount: { amount: uid === 'uid-1' ? '-42.50' : '1500.00', currency: 'EUR' } }]; },
    async transactions(uid) {
      if (uid !== 'uid-1') return [];
      return [tx(-25, -1111, 'AVANT FRONTIERE'), tx(-10, -2350, 'CB EPICERIE FICTIVE', { entry_reference: 'E1' }),
        tx(-3, 180000, 'VIREMENT SALAIRE FICTIF', { entry_reference: 'E2' }), tx(-1, -999, 'CB CAFE', { status: 'PDNG' })];
    }
  };
}

function reprise() {
  const jour = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  return {
    format: 'klad-reprise', v: 1, created: new Date().toISOString(), source: 'carnet',
    accounts: [
      { ref: 'r0', label: 'COURANT', role: 'courant', iban_last4: '0001' },
      { ref: 'r5', label: 'LIVRET A', role: 'epargne', manual: true, balance: { amount: 500000, date: jour(-8) } }],
    transactions: [
      { account: 'r0', date: '2023-01-03', amount: -1250, label: 'CB BOULANGERIE', status: 'comptabilisee' },
      { account: 'r0', date: '2023-01-03', amount: -1250, label: 'CB BOULANGERIE', status: 'comptabilisee' },
      { account: 'r0', date: jour(-20), amount: -4500, label: 'CB RESTAURANT', status: 'comptabilisee' }],
    // carnet fictif de l'ancienne version : catégories, une règle de base, une règle de l'utilisateur, opérations vues
    carnet: { cats: { custom: { 'Loisirs': { nat: 'optionnelle' } } }, P: { rules: [['RESTAURANT', 'depense', 'Restaurants & bars', 'Restaurants & bars', null]] },
      rules: [{ kw: 'EPICERIE', cat: 'Alimentation', sub: 'Courses' }], seen: { cut: jour(-15), k: {} } }
  };
}

// KLAD_CAPTURES=<dossier> : captures d'écran du parcours (vérification visuelle, hors dépôt).
const CAPT = process.env.KLAD_CAPTURES;
const capture = async (page, nom) => { if (CAPT) { await page.waitForTimeout(350); await page.screenshot({ path: path.join(CAPT, nom + '.png') }); } };

const SANS_SIGNE = /[\u2212\u2012\u2013-]\s?\d[\d\s\u00a0\u202f]*,\d\d/;

test('parcours : premier lancement, banque, synchro, reprise, accueil, opérations', { skip: !chromium && !process.env.KLAD_PARCOURS && 'Playwright absent' }, async () => {
  const srv = await serveur();
  const base = 'http://127.0.0.1:' + srv.address().port + '/';
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 400, height: 820 }, hasTouch: true });
    page.setDefaultTimeout(8000);
    const erreurs = [];
    page.on('pageerror', e => erreurs.push(e.message));
    await page.addInitScript(fauxEB);
    await page.goto(base);
    const code = async () => { for (const k of '123456') await page.keyboard.press(k); };

    // premier lancement : code (deux fois), phrase de récupération vérifiée
    await page.getByRole('button', { name: 'Créer mon code' }).click();
    await code(); await page.waitForTimeout(100); await code();
    const groupes = await page.locator('ol.phrase li').allInnerTexts();
    assert.equal(groupes.length, 6);
    await page.getByRole('button', { name: 'Je l\'ai recopiée' }).click();
    for (const id of ['g1', 'g2']) {
      const lab = await page.locator('label:has(#' + id + ')').innerText();
      await page.fill('#' + id, groupes[+lab.match(/n° (\d)/)[1] - 1]);
    }
    await page.getByRole('button', { name: 'Vérifier' }).click();
    await page.waitForSelector('#appli:not([hidden])');
    assert.match(await page.locator('#vAccueil').innerText(), /Bienvenue dans Klad/);

    // connexion d'une banque (faux client) : le retour bancaire recharge la page, déverrouillage, synchro automatique
    await page.locator('.onglets [data-onglet="vPlus"]').click();
    await page.locator('#vPlus [data-volet="secBanques"]').click();
    await page.getByText('Adresse de retour bancaire').click();
    await page.fill('#redirectUrl', base + 'retour.html');
    await page.locator('#redirectUrl').dispatchEvent('change');
    await page.locator('#btnLoadBanks').click();
    await page.locator('#banks [data-bank]').click();
    await page.waitForURL(/code=CODE-FICTIF/);
    await page.waitForSelector('.pad');
    await code();
    await page.waitForFunction(() => /✓/.test(document.getElementById('pastille').textContent));
    assert.equal(await page.locator('.ccompte').count(), 2);
    assert.match(await page.locator('.carte.grande').innerText(), /42,50\s€ débiteur/);
    assert.match(await page.locator('#vAccueil .averif').innerText(), /2 comptes à vérifier ou à réassocier/);

    // import de la reprise : association proposée par la fin d'IBAN, livret manuel créé, frontière
    const ouvrirReprise = async () => {
      await page.locator('.onglets [data-onglet="vPlus"]').click();
      await page.locator('#vPlus [data-volet="secReprise"]').click();
      const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.locator('#btnChoisirReprise').click()]);
      await fc.setFiles({ name: 'reprise.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(reprise())) });
      await page.waitForSelector('#repriseApercu [data-a="importer"]');
    };
    await ouvrirReprise();
    assert.match(await page.locator('#repriseApercu').innerText(), /COURANT[\s\S]*3 opération\(s\) du 03\/01\/2023/);
    assert.equal(await page.locator('[data-ref="r5"]').inputValue(), 'creer');      // compte manuel : « Créer » présélectionné
    assert.equal(await page.locator('[data-ref="r5"] option[value="creer"]').innerText(), 'Créer un compte manuel');
    assert.equal(await page.locator('#repIgnores').isVisible(), false);
    await page.selectOption('[data-ref="r5"]', 'ignorer');
    assert.match(await page.locator('#repIgnores').innerText(), /^1 compte\(s\) ignoré\(s\)/);
    await page.selectOption('[data-ref="r5"]', 'creer');
    assert.equal(await page.locator('#repIgnores').isVisible(), false);
    await page.locator('#repriseApercu [data-a="importer"]').click();
    await page.waitForSelector('#volet', { state: 'visible' });
    assert.match(await page.locator('#repriseEtat').innerText(), /3 opération/);
    const livret = await page.evaluate(() => window.KladApp.etat().modele.comptes.find(c => c.libelle === 'LIVRET A'));
    assert.equal(livret.source.type, 'manuel');
    assert.equal(livret.solde.centimes, 500000);
    assert.match(livret.solde.date, /^\d{4}-\d{2}-\d{2}$/);
    await page.locator('#volet [data-fermer]').last().click();

    // nouvelle synchro (pastille), puis réimport : aucun doublon
    const nbOps = () => page.evaluate(() => { const S = window.KladApp.etat(); return Object.values(S.ops).flat().length; });
    const n1 = await nbOps();
    assert.equal(n1, 3 + 3);                    // reprise 3 ; banque : épicerie, salaire, café en cours (avant frontière ignorée)
    await page.locator('#pastille').click();
    await page.waitForFunction(() => !document.getElementById('pastille').classList.contains('encours'));
    await page.waitForTimeout(300);
    assert.equal(await nbOps(), n1);
    await ouvrirReprise();
    await page.locator('#repriseApercu [data-a="importer"]').click();
    await page.waitForTimeout(200);
    await page.locator('#volet [data-fermer]').last().click();
    assert.equal(await nbOps(), n1);

    // fiche d'un compte : la carte (ancien livret fictif) devient une carte à débit différé prélevée sur COURANT le 5
    await page.locator('.onglets [data-onglet="vPlus"]').click();
    await page.locator('#vPlus [data-volet="secComptes"]').click();
    await page.locator('#listeComptes [data-edit]').nth(1).click();
    await page.fill('#fLibelle', 'CARTE');
    await page.selectOption('#fRole', 'carte_differee');
    await page.locator('#formCompte [data-a="ok"]').click();
    assert.match(await page.locator('#fMsg').innerText(), /Choisissez le compte/);
    await page.selectOption('#fPrelCompte', { label: 'COURANT' });
    await page.fill('#fJour', '5');
    await page.locator('#formCompte [data-a="ok"]').click();
    await page.waitForSelector('#listeComptes');
    const carte = await page.evaluate(() => window.KladApp.etat().modele.comptes.find(c => c.libelle === 'CARTE'));
    assert.equal(carte.role, 'carte_differee');
    assert.equal(carte.prelevement.jour, 5);
    // compte manuel : solde débiteur saisi sans signe
    await page.locator('#btnNouveauManuel').click();
    await page.fill('#fLibelle', 'PRET');
    await page.selectOption('#fRole', 'epargne');
    await page.fill('#fSolde', '1 000,50');
    await page.selectOption('#fSens', 'deb');
    await page.locator('#formCompte [data-a="ok"]').click();
    await page.waitForTimeout(200);
    assert.match(await page.locator('#listeComptes').innerText(), /PRET[\s\S]*1\s000,50\s€ débiteur/);
    await page.locator('#volet [data-fermer]').last().click();

    // renouvellement de l'accès en un appui : nouvelle session, comptes réassociés par empreinte d'IBAN
    await page.locator('#vPlus [data-volet="secBanques"]').click();
    await page.locator('#connexions [data-renouveler]').click();
    await page.waitForURL(/code=CODE-FICTIF/);
    await page.waitForSelector('.pad');
    await code();
    await page.waitForFunction(() => window.KladApp.etat() && window.KladApp.etat().modele.connexions['sess-fictive-2']);
    const apres = await page.evaluate(() => window.KladApp.etat().modele);
    assert.deepEqual(Object.keys(apres.connexions), ['sess-fictive-2']);
    assert.equal(apres.comptes.length, 4);
    assert.ok(apres.comptes.filter(c => c.source.type === 'eb').every(c => c.source.connexion === 'sess-fictive-2' && !c.aReassocier));
    assert.equal(apres.comptes.find(c => c.libelle === 'CARTE').role, 'carte_differee');   // réglages gardés
    await page.waitForFunction(() => !document.getElementById('pastille').classList.contains('encours'));
    assert.equal(await nbOps(), n1);

    // accueil : grande carte, cartes de comptes ; aucun montant signé
    await page.locator('.onglets [data-onglet="vAccueil"]').click();
    assert.equal(await page.locator('.ccompte').count(), 4);
    const accueil = await page.locator('#vAccueil').innerText();
    assert.match(accueil, /LIVRET A[\s\S]*5\s000,00\s€/);
    assert.doesNotMatch(accueil, SANS_SIGNE);
    await capture(page, '1-accueil');

    // opérations : liste par jour, en cours en italique, recherche, filtre par compte
    await page.locator('.onglets [data-onglet="vOps"]').click();
    assert.ok(await page.locator('#opsListe section.jour h3').count() >= 4);
    assert.equal(await page.locator('#opsListe .op.encours').count(), 1);
    assert.equal(await page.locator('#opsListe .op .cre', { hasText: '1 800,00' }).count(), 1);
    const liste = await page.locator('#opsListe').innerText();
    assert.doesNotMatch(liste, SANS_SIGNE);
    assert.doesNotMatch(liste, /AVANT FRONTIERE/);
    await capture(page, '2-operations');
    await page.locator('#defil').evaluate(d => { d.scrollTop = 140; });
    await capture(page, '3-operations-defilees');
    await page.fill('#opsQ', 'boulang');
    await page.waitForTimeout(300);
    assert.equal(await page.locator('#opsListe .op').count(), 2);
    await page.fill('#opsQ', '');
    await page.locator('#opsCompte').selectOption({ label: 'LIVRET A' });
    assert.match(await page.locator('#opsListe').innerText(), /Aucune opération/);
    assert.doesNotMatch(await page.locator('body').innerText(), /\u2212/);

    // classement repris du carnet fictif : règle de base (restaurants), règle de l'utilisateur (épicerie)
    await page.locator('#opsCompte').selectOption('');
    await page.waitForTimeout(100);
    const ligneOp = t => page.locator('#opsListe .op', { hasText: t });
    assert.match(await ligneOp('CB RESTAURANT').innerText(), /Restaurant · COURANT/);
    assert.match(await ligneOp('CB EPICERIE FICTIVE').innerText(), /Alimentation · Courses/);
    assert.match(await page.locator('#badgeOps').innerText(), /^3$/);
    // détail par un appui ; « Marquer vue » (bouton, alternative au geste)
    await ligneOp('CB CAFE').click();
    await page.waitForSelector('#opDetail [data-a="classer"]');
    assert.match(await page.locator('#opDetail').innerText(), /Autres › Non classé/);
    await page.locator('#opDetail [data-a="vue"]').click();
    await page.waitForFunction(() => document.getElementById('badgeOps').textContent === '2');
    // Classer : règle « CAFE » → Bars, puis Annuler
    await page.locator('#opDetail [data-a="classer"]').click();
    await page.waitForSelector('#clsCorps [data-a="go"]');
    await page.locator('#clsCorps [data-toutes]').click();
    await page.locator('#clsCorps [data-cat="Bars"]').click();
    assert.equal(await page.locator('#clsAutres').isChecked(), true);
    await page.fill('#clsMot', 'CAFE');
    assert.match(await page.locator('#clsN').innerText(), /1 opération contient « CAFE »/);
    await capture(page, '9-classer');
    await page.locator('#clsCorps [data-a="go"]').click();
    await page.waitForSelector('#toast.show.action');
    assert.match(await ligneOp('CB CAFE').innerText(), /Bars/);
    assert.deepEqual(await page.evaluate(() => window.KladApp.etat().classement.regles.map(u => u.mot)), ['EPICERIE', 'CAFE']);
    await page.locator('#toast button').click();
    await page.waitForTimeout(100);
    assert.match(await ligneOp('CB CAFE').innerText(), /Autres/);
    assert.deepEqual(await page.evaluate(() => window.KladApp.etat().classement.regles.map(u => u.mot)), ['EPICERIE']);
    // gestes : glisser à droite → vue ; à gauche → volet « Classer »
    const glisser = (t, dx) => ligneOp(t).evaluate((el, dx) => {
      const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
      const tc = (cx) => new Touch({ identifier: 1, target: el, clientX: cx, clientY: y });
      el.dispatchEvent(new TouchEvent('touchstart', { touches: [tc(x)], changedTouches: [tc(x)], bubbles: true }));
      for (let i = 1; i <= 5; i++) el.dispatchEvent(new TouchEvent('touchmove', { touches: [tc(x + dx * i / 5)], changedTouches: [tc(x + dx * i / 5)], bubbles: true }));
      el.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [tc(x + dx)], bubbles: true }));
    }, dx);
    await glisser('VIREMENT SALAIRE', 120);
    await page.waitForFunction(() => document.getElementById('badgeOps').textContent === '1');
    await glisser('CB EPICERIE FICTIVE', -120);
    await page.waitForSelector('#clsCorps [data-a="go"]');
    assert.match(await page.locator('#clsCorps').innerText(), /CB EPICERIE FICTIVE/);
    await page.locator('#volet [data-fermer]').last().click();
    // filtre « Non vues », « Tout marquer vu » puis Annuler
    await page.locator('#opsFiltres [data-f="nonVues"]').click();
    assert.equal(await page.locator('#opsListe .op').count(), 1);
    await page.locator('#opsFiltres [data-f="toutVu"]').click();
    await page.waitForFunction(() => document.getElementById('badgeOps').hidden);
    assert.match(await page.locator('#opsListe').innerText(), /Toutes les opérations ont été vues/);
    await page.locator('#toast button').click();
    await page.waitForFunction(() => document.getElementById('badgeOps').textContent === '1');
    await page.locator('#opsFiltres [data-f="nonVues"]').click();
    await page.locator('#opsFiltres [data-f="nc"]').click();
    assert.ok(await page.locator('#opsListe .op').count() >= 1);
    await page.locator('#opsFiltres [data-f="nc"]').click();
    await capture(page, '10-operations-lot5');

    await page.locator('.onglets [data-onglet="vPlus"]').click();
    await capture(page, '4-plus');
    await page.locator('#vPlus [data-volet="secClassement"]').click();
    assert.match(await page.locator('#classementCorps').innerText(), /Repris de l'ancienne version[\s\S]*Vos règles[\s\S]*EPICERIE/);
    await capture(page, '11-classement');
    await page.locator('#volet [data-fermer]').last().click();
    await page.locator('#vPlus [data-volet="secComptes"]').click();
    await capture(page, '5-comptes');
    await page.locator('#listeComptes [data-edit]').nth(1).click();
    await capture(page, '6-fiche-compte');
    if (CAPT) { await page.emulateMedia({ colorScheme: 'dark' }); await capture(page, '7-fiche-sombre'); await page.emulateMedia({ colorScheme: 'light' }); }
    await page.locator('#volet [data-fermer]').last().click();

    // Lien Grafit (faux plugin) : désactivé par défaut ; activé → résumé écrit tout de suite ; renommage suivi
    const grafit = () => page.evaluate(() => { const j = window.KladLienGrafit.demo(); return j == null ? null : JSON.parse(j); });
    await page.locator('.onglets [data-onglet="vPlus"]').click();
    assert.match(await page.locator('#mModules').innerText(), /Lien Grafit désactivé/);
    await page.locator('#vPlus [data-volet="secModules"]').click();
    assert.equal(await page.locator('#grafitActif').isChecked(), false);
    assert.equal(await grafit(), null);
    await page.locator('#grafitActif').check();
    await page.waitForFunction(() => window.KladLienGrafit.demo() != null);
    let r = await grafit();
    assert.equal(r.state, 'ok');
    assert.deepEqual(r.accounts.map(x => x.label), ['COURANT', 'CARTE', 'LIVRET A', 'PRET']);
    assert.deepEqual(r.accounts.map(x => x.kind), ['current', 'card', 'savings', 'savings']);
    assert.equal(r.accounts[0].balance, -42.5);
    assert.ok(!('balance' in r.accounts[1]));
    assert.deepEqual(r.total, { savings: 3999.5 });      // total général omis : dette de la carte inconnue (libellé à choisir)
    assert.ok(r.alerts.some(a => a.code === 'NEGATIVE_BALANCE' && a.level === 'crit' && a.text === 'COURANT'));
    const brut = JSON.stringify(r);
    for (const x of ['FR76', '0001', '0002', 'Banque Démo', 'EPICERIE', 'SALAIRE', 'sess-fictive', 'uid-']) assert.ok(!brut.includes(x), x);
    assert.match(await page.locator('#grafitEtat').innerText(), /Activé/);
    await capture(page, '8-modules');
    await page.locator('#volet [data-fermer]').last().click();
    await page.locator('#vPlus [data-volet="secComptes"]').click();
    await page.locator('#listeComptes [data-edit]').first().click();
    await page.fill('#fLibelle', 'Principal');
    await page.locator('#formCompte [data-a="ok"]').click();
    await page.waitForFunction(() => /PRINCIPAL/.test(window.KladLienGrafit.demo()));
    await page.locator('#volet [data-fermer]').last().click();

    // verrouiller puis rouvrir : données relues depuis le coffre chiffré ; le résumé reste lisible appli verrouillée
    await page.locator('.onglets [data-onglet="vPlus"]').click();
    await page.locator('#btnLock').click();
    await page.waitForSelector('.pad');
    assert.equal((await grafit()).accounts[0].label, 'PRINCIPAL');
    await code();
    await page.waitForSelector('#appli:not([hidden])');
    assert.equal(await nbOps(), n1);
    assert.equal(await page.locator('.ccompte').count(), 4);

    // désactivé → résumé effacé
    await page.locator('.onglets [data-onglet="vPlus"]').click();
    assert.match(await page.locator('#mModules').innerText(), /Lien Grafit activé/);
    await page.locator('#vPlus [data-volet="secModules"]').click();
    assert.equal(await page.locator('#grafitActif').isChecked(), true);
    await page.locator('#grafitActif').uncheck();
    await page.waitForFunction(() => window.KladLienGrafit.demo() == null);
    assert.match(await page.locator('#log').evaluate(() => window.KladApp.etat().journal.log.join('\n')), /Lien Grafit désactivé/);
    assert.deepEqual(erreurs, []);
  } finally {
    await browser.close();
    srv.close();
  }
});

// Lot 6 : onglet Budget (perso / commun, cycles, poste déplié, édition annulable, ajout), carte « Reste à vivre »,
// contrats et échéances, tendance, résumé Grafit (month, upcoming). Jeu fictif daté d'aujourd'hui.
test('parcours : budget, reste à vivre, contrats, tendance', { skip: !chromium && !process.env.KLAD_PARCOURS && 'Playwright absent' }, async () => {
  const srv = await serveur();
  const base = 'http://127.0.0.1:' + srv.address().port + '/';
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 400, height: 820 }, hasTouch: true });
    page.setDefaultTimeout(8000);
    const erreurs = [];
    page.on('pageerror', e => erreurs.push(e.message));
    await page.goto(base);
    const code = async () => { for (const k of '123456') await page.keyboard.press(k); };
    await page.getByRole('button', { name: 'Créer mon code' }).click();
    await code(); await page.waitForTimeout(100); await code();
    const groupes = await page.locator('ol.phrase li').allInnerTexts();
    await page.getByRole('button', { name: 'Je l\'ai recopiée' }).click();
    for (const id of ['g1', 'g2']) {
      const lab = await page.locator('label:has(#' + id + ')').innerText();
      await page.fill('#' + id, groupes[+lab.match(/n° (\d)/)[1] - 1]);
    }
    await page.getByRole('button', { name: 'Vérifier' }).click();
    await page.waitForSelector('#appli:not([hidden])');
    // reprise fictive avec un carnet (budget, contrats, virements, réglages du salaire)
    const auj = await page.evaluate(() => window.KladModele.jourLocal(Date.now()));
    await page.locator('.onglets [data-onglet="vPlus"]').click();
    await page.locator('#vPlus [data-volet="secReprise"]').click();
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.locator('#btnChoisirReprise').click()]);
    await fc.setFiles({ name: 'reprise.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(repriseFictive(auj))) });
    await page.waitForSelector('#repriseApercu [data-a="importer"]');
    await page.locator('#repriseApercu [data-a="importer"]').click();
    await page.waitForFunction(() => window.KladApp.etat().budget && window.KladApp.etat().classement && window.KladApp.etat().classement.import);
    await page.locator('#volet [data-fermer]').last().click();
    assert.equal(await page.evaluate(() => window.KladApp.etat().budget.contrats.length), 4);

    // accueil : carte « Reste à vivre » (deux colonnes), détail au toucher
    await page.locator('.onglets [data-onglet="vAccueil"]').click();
    const rav = await page.locator('#vAccueil .carte.rav').innerText();
    assert.match(rav, /Reste à vivre jusqu'au[\s\S]*sur le dernier salaire[\s\S]*sur les comptes courants/);
    await page.locator('#vAccueil .carte.rav').click();
    assert.match(await page.locator('#ravCorps').innerText(), /Base[\s\S]*Charges fixes[\s\S]*Marge[\s\S]*Variable[\s\S]*Reste à vivre/);
    await capture(page, '12-reste-a-vivre');
    await page.locator('#volet [data-fermer]').last().click();

    // onglet Budget : sections, cycle de salaire, aucun montant signé
    await page.locator('.onglets [data-onglet="vBudget"]').click();
    let b = await page.locator('#vBudget').innerText();
    assert.match(b, /Cycle en cours · du \d\d\/\d\d au/);
    assert.match(b, /Revenus[\s\S]*Charges fixes[\s\S]*Dépenses courantes[\s\S]*Dépenses optionnelles[\s\S]*Solde prévu par le budget/);
    assert.match(b, /Contribution compte commun/);
    assert.doesNotMatch(b, SANS_SIGNE);
    assert.doesNotMatch(b, /[\u2212-]\s?\d[\d\s\u00a0\u202f]* €/);
    await capture(page, '13-budget');
    // poste déplié (opérations), édition dans le volet, annulation
    await page.locator('#vBudget [data-poste="c|Alimentation"]').click();
    assert.equal(await page.locator('#vBudget .bdet').count(), 1);
    await page.locator('#vBudget [data-editer="c|Alimentation"]').click();
    await page.waitForSelector('#posteCorps #peAmt');
    await page.fill('#peAmt', '250');
    await page.locator('#posteCorps [data-pe="ok"]').click();
    await page.waitForSelector('#toast.show.action');
    assert.equal(await page.evaluate(() => window.KladApp.etat().budget.plan.perso['c|Alimentation'].amt), 25000);
    await page.locator('#toast button').click();
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => window.KladApp.etat().budget.plan.perso['c|Alimentation'].amt), 16000);
    // cycle précédent (lecture), retour au cycle en cours
    await page.locator('#vBudget [data-nav="prev"]').click();
    b = await page.locator('#vBudget').innerText();
    assert.match(b, /Cycle du \d\d\/\d\d au \d\d\/\d\d\/\d\d.*terminé/);
    assert.match(b, /Solde de la période/);
    await page.locator('#vBudget [data-nav="now"]').click();
    // commun : mois civil, apports attendus selon la répartition
    await page.locator('#vBudget [data-scope="commun"]').click();
    b = await page.locator('#vBudget').innerText();
    assert.match(b, /Mois en cours/);
    assert.match(b, /Personne A[\s\S]*Personne B/);
    assert.match(b, /Solde du compte commun/);
    // Lot 7 : marge réelle, fin de mois, virements, trésorerie ; équilibre ; ordres permanents (annulable)
    assert.match(b, /Marge réelle du commun[\s\S]*Fin de mois estimée[\s\S]*Virements[\s\S]*Trésorerie · 12 mois[\s\S]*Appels de fonds/);
    assert.doesNotMatch(b, /[\u2212-]\s?\d[\d\s\u00a0\u202f]*(,\d\d)? €/);
    await capture(page, '14-budget-commun');
    await page.locator('#vBudget [data-ouvrir="secEquilibre"]').click();
    assert.match(await page.locator('#equilibreCorps').innerText(), /Reste à combler[\s\S]*Personne A doit encore investir/);
    await page.fill('#eqSimY', '100000');
    await page.waitForFunction(() => /Équilibre atteint tout de suite/.test(document.getElementById('eqSimOut').textContent));
    await capture(page, '16-equilibre');
    await page.locator('#volet [data-fermer]').last().click();
    await page.locator('#vBudget details[data-cc="vir"] [data-ouvrir="secVirements"]').click();
    await page.waitForSelector('#virementsCorps [data-vok]');
    await page.locator('#virementsCorps [data-vf="montant"]').first().fill('900');
    await page.locator('#virementsCorps [data-vok]').click();
    await page.waitForSelector('#toast.show.action');
    assert.equal(await page.evaluate(() => window.KladApp.etat().budget.virements[0].montant), 90000);
    await page.locator('#toast button').click();
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => window.KladApp.etat().budget.virements[0].montant), 80000);
    // contrats et échéances, tendance
    await page.locator('#vBudget [data-ouvrir="secContrats"]').click();
    assert.match(await page.locator('#contratsCorps').innerText(), /Prêt immobilier fictif[\s\S]*Échéances des 31 prochains jours/);
    await page.locator('#volet [data-fermer]').last().click();
    await page.locator('#vBudget [data-scope="perso"]').click();
    await page.locator('#vBudget [data-ouvrir="secTendance"]').click();
    assert.ok(await page.locator('#tendanceCorps svg.graph rect').count() >= 3);
    await page.selectOption('#tdCat', 'Alimentation');
    assert.match(await page.locator('#tendanceCorps').innerText(), /budget 160 €/);
    await capture(page, '15-tendance');
    await page.locator('#volet [data-fermer]').last().click();

    // Lot 8 : résultats, impôts, épargne, observations ; « À vérifier » signale les observations à faire
    await page.locator('.onglets [data-onglet="vBudget"]').click();
    await page.locator('#vBudget [data-ouvrir="secResultats"]').click();
    assert.match(await page.locator('#resultatsCorps').innerText(), /Cycle précédent[\s\S]*Solde de la période[\s\S]*Répartition des dépenses/);
    await capture(page, '17-resultats');
    await page.locator('#volet [data-fermer]').last().click();
    for (const [sec, motif] of [['secImpots', /À régulariser entre vous[\s\S]*Taxe foncière/], ['secEpargne', /Livret[\s\S]*Solde estimé[\s\S]*Plan d'épargne entreprise/], ['secObs', /À faire/]]) {
      await page.locator('.onglets [data-onglet="vPlus"]').click();
      await page.locator('#vPlus [data-volet="' + sec + '"]').click();
      const t = await page.locator('#' + sec).innerText();
      assert.match(t, motif);
      assert.doesNotMatch(t, /[\u2212-]\s?\d[\d\s\u00a0\u202f]*(,\d\d)? €/);
      await capture(page, '18-' + sec);
      await page.locator('#volet [data-fermer]').last().click();
    }
    await page.locator('.onglets [data-onglet="vPlus"]').click();
    await page.locator('#vPlus [data-volet="secImpots"]').click();
    await page.locator('#impotsCorps summary', { hasText: /^Hypothèses \d{4}/ }).click();
    await page.locator('#impotsCorps [data-hyp="communG"]').fill('60');
    await page.locator('#impotsCorps [data-hyp="communG"]').press('Tab');
    await page.waitForSelector('#toast.show.action');
    assert.equal(await page.evaluate(() => window.KladApp.etat().budget.fisc.hyp.communG), 60);
    await page.locator('#toast button').click();
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => window.KladApp.etat().budget.fisc.hyp.communG), 50);
    await page.locator('#volet [data-fermer]').last().click();
    await page.locator('.onglets [data-onglet="vAccueil"]').click();
    assert.match(await page.locator('#vAccueil .averif').innerText(), /observations? à faire/);

    // Grafit : month et upcoming
    await page.locator('.onglets [data-onglet="vPlus"]').click();
    await page.locator('#vPlus [data-volet="secModules"]').click();
    await page.locator('#grafitActif').check();
    await page.waitForFunction(() => window.KladLienGrafit.demo() != null);
    const r = JSON.parse(await page.evaluate(() => window.KladLienGrafit.demo()));
    assert.equal(r.month.cycle, 'salary');
    assert.equal(typeof r.commun.balance, 'number');
    assert.equal(typeof r.commun.overdraft_risk, 'boolean');
    assert.ok(r.month.budget > 0 && Array.isArray(r.month.top) && r.month.left_to_live_basis === 'accounts');
    assert.ok(Array.isArray(r.upcoming));
    const brut = JSON.stringify(r);
    for (const x of ['FICTI', 'PRLV', 'SUPERMARCHE']) assert.ok(!brut.includes(x), x);
    assert.deepEqual(erreurs, []);
  } finally {
    await browser.close();
    srv.close();
  }
});
