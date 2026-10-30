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

// Faux serveur Anthropic injecté dans la page (aucun réseau) : comptage de jetons et lecture d'un bulletin fictif.
function fauxClaude() {
  const vrai = window.fetch.bind(window);
  window.KladFauxClaude = [];
  window.fetch = async (url, o) => {
    if (!String(url).startsWith('https://api.anthropic.com/')) return vrai(url, o);
    window.KladFauxClaude.push({ url: String(url), headers: o.headers, body: o.body });
    const rep = String(url).endsWith('/count_tokens') ? { input_tokens: 3000 }
      : { model: 'claude-opus-5-5', stop_reason: 'end_turn', usage: { input_tokens: 3100, output_tokens: 400 }, content: [{ type: 'text', text: JSON.stringify({
        employeur: 'Société fictive', mois_salaire: '2026-09', date_paiement: '2026-09-30', brut: 3200, net_imposable: 2500, prelevement_source: 120, taux_pas: 4.8, type_taux: 'personnalise' }) }] };
    return new Response(JSON.stringify(rep), { status: 200, headers: { 'content-type': 'application/json' } });
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
    const plusVers = async sec => { await page.locator('#app-tb [data-tab="plus"]').click(); await page.locator('#plusCorps [data-volet="' + sec + '"]').click(); };
    const synchroFinie = () => page.waitForFunction(() => { const S = window.KladApp && window.KladApp.etat(); return S && S.modele.sync.derniere && !document.getElementById('ah-sync').classList.contains('busy'); });

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
    assert.match(await page.locator('#view-accueil').innerText(), /Connectez une banque/);

    // connexion d'une banque (faux client) : le retour bancaire recharge la page, déverrouillage, synchro automatique
    await plusVers('secBanques');
    await page.getByText('Adresse de retour bancaire').click();
    await page.fill('#redirectUrl', base + 'retour.html');
    await page.locator('#redirectUrl').dispatchEvent('change');
    await page.locator('#btnLoadBanks').click();
    await page.locator('#banks [data-bank]').click();
    await page.waitForURL(/code=CODE-FICTIF/);
    await page.waitForSelector('.pad');
    await code();
    await synchroFinie();
    assert.equal(await page.locator('#view-accueil [data-compte]').count(), 2);
    assert.match(await page.locator('#view-accueil [data-mesure="soldes"]').innerText(), /42,50\s€\s*débiteur/);
    assert.match(await page.locator('#view-accueil').innerText(), /2\s+comptes à vérifier ou à réassocier/);

    // import de la reprise : association proposée par la fin d'IBAN, livret manuel créé, frontière
    const ouvrirReprise = async () => {
      await plusVers('secReprise');
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
    await page.waitForSelector('#repriseEtat', { state: 'visible' });
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
    await page.locator('#ah-sync').click();
    await page.waitForTimeout(100);
    await synchroFinie();
    await page.waitForTimeout(300);
    assert.equal(await nbOps(), n1);
    await ouvrirReprise();
    await page.locator('#repriseApercu [data-a="importer"]').click();
    await page.waitForTimeout(200);
    await page.locator('#volet [data-fermer]').last().click();
    assert.equal(await nbOps(), n1);

    // fiche d'un compte : la carte (ancien livret fictif) devient une carte à débit différé prélevée sur COURANT le 5
    await plusVers('secComptes');
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
    await plusVers('secBanques');
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
    await synchroFinie();
    assert.equal(await nbOps(), n1);

    // accueil : grande carte, cartes de comptes ; aucun montant signé
    await page.locator('#app-tb [data-tab="accueil"]').click();
    assert.equal(await page.locator('#view-accueil [data-compte]').count(), 4);
    const accueil = await page.locator('#view-accueil').innerText();
    assert.match(accueil, /LIVRET A[\s\S]*5\s000,00\s€/);
    assert.doesNotMatch(accueil, SANS_SIGNE);
    await capture(page, '1-accueil');

    // opérations : liste par jour (période d'analyse), en cours marquée, recherche, filtre par compte
    await page.locator('#app-tb [data-tab="operations"]').click();
    assert.ok(await page.locator('#tx tr.tx-day').count() >= 4);
    assert.equal(await page.locator('#tx tr.txr.encours').count(), 1);
    assert.equal(await page.locator('#tx tr.txr .amt.pos', { hasText: /1\s800,00/ }).count(), 1);
    const liste = await page.locator('#tx').innerText();
    assert.doesNotMatch(liste, SANS_SIGNE);
    assert.doesNotMatch(liste, /AVANT FRONTIERE/);
    await capture(page, '2-operations');
    await page.locator('#ah-search').click();
    await page.fill('#q', 'epicer');
    await page.waitForTimeout(400);
    assert.equal(await page.locator('#tx tr.txr').count(), 1);
    await page.fill('#q', '');
    await page.waitForTimeout(400);
    await page.locator('#opsCompte').selectOption({ label: 'CARTE' });
    assert.match(await page.locator('#tx').innerText(), /Aucune opération ne correspond/);
    assert.doesNotMatch(await page.locator('body').innerText(), /\u2212\s?\d/);

    // classement repris du carnet fictif : règle de base (restaurants), règle de l'utilisateur (épicerie)
    await page.locator('#opsCompte').selectOption('');
    await page.waitForTimeout(100);
    const ligneOp = t => page.locator('#tx tr.txr', { hasText: t });
    assert.match(await ligneOp('CB RESTAURANT').innerText(), /COURANT\s+Restaurant/);
    assert.match(await ligneOp('CB EPICERIE FICTIVE').innerText(), /Alimentation · Courses/);
    assert.match(await page.locator('#tb-badge').innerText(), /^3$/);
    // détail par un appui ; « Marquer vue » (bouton, alternative au geste)
    await ligneOp('CB CAFE').locator('.tl').click();
    await page.waitForSelector('#opDetail [data-a="classer"]');
    assert.match(await page.locator('#opDetail').innerText(), /Autres › Non classé/);
    await page.locator('#opDetail [data-a="vue"]').click();
    await page.waitForFunction(() => document.getElementById('tb-badge').textContent === '2');
    // Classer : règle « CAFE » → Bars, puis Annuler
    await page.locator('#opDetail [data-a="classer"]').click();
    await page.waitForSelector('#clsCorps [data-a="go"]');
    await page.locator('#clsCorps [data-toutes]').click();
    await page.locator('#clsCorps [data-cat="Bars"]').click();
    assert.equal(await page.locator('#clsAutres').getAttribute('aria-checked'), 'true');
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
    await glisser('SALAIRE FICTIF', 120);
    await page.waitForFunction(() => document.getElementById('tb-badge').textContent === '1');
    await glisser('CB EPICERIE FICTIVE', -120);
    await page.waitForFunction(() => !document.getElementById('volet').hidden && /CB EPICERIE FICTIVE/.test(document.getElementById('clsCorps').textContent));
    await page.locator('#volet [data-fermer]').last().click();
    // filtre « Non vues », « Tout marquer vu » puis Annuler
    await page.locator('#app-chips [data-f="nonVues"]').click();
    assert.equal(await page.locator('#tx tr.txr').count(), 1);
    await page.locator('#app-chips [data-f="toutVu"]').click();
    await page.waitForFunction(() => document.getElementById('tb-badge').hidden);
    assert.match(await page.locator('#tx').innerText(), /Toutes les opérations de la période ont été vues/);
    await page.locator('#toast button').click();
    await page.waitForFunction(() => document.getElementById('tb-badge').textContent === '1');
    await page.locator('#app-chips [data-f="nonVues"]').click();
    await page.locator('#app-chips [data-f="nc"]').click();
    assert.ok(await page.locator('#tx tr.txr').count() >= 1);
    await page.locator('#app-chips [data-f="nc"]').click();
    await capture(page, '10-operations-lot5');

    await page.locator('#app-tb [data-tab="plus"]').click();
    await capture(page, '4-plus');
    await page.locator('#plusCorps [data-volet="secClassement"]').click();
    assert.match(await page.locator('#classementCorps').innerText(), /Repris de l'ancienne version[\s\S]*Vos règles[\s\S]*EPICERIE/);
    await capture(page, '11-classement');
    await page.locator('#volet [data-fermer]').last().click();
    await plusVers('secComptes');
    await capture(page, '5-comptes');
    await page.locator('#listeComptes [data-edit]').nth(1).click();
    await capture(page, '6-fiche-compte');
    if (CAPT) { await page.emulateMedia({ colorScheme: 'dark' }); await capture(page, '7-fiche-sombre'); await page.emulateMedia({ colorScheme: 'light' }); }
    await page.locator('#volet [data-fermer]').last().click();

    // Lien Grafit (faux plugin) : désactivé par défaut ; activé → résumé écrit tout de suite ; renommage suivi
    const grafit = () => page.evaluate(() => { const j = window.KladLienGrafit.demo(); return j == null ? null : JSON.parse(j); });
    await page.locator('#app-tb [data-tab="plus"]').click();
    assert.match(await page.locator('#plusCorps [data-volet="secModules"]').innerText(), /Lien Grafit désactivé/);
    await page.locator('#plusCorps [data-volet="secModules"]').click();
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
    await plusVers('secComptes');
    await page.locator('#listeComptes [data-edit]').first().click();
    await page.fill('#fLibelle', 'Principal');
    await page.locator('#formCompte [data-a="ok"]').click();
    await page.waitForFunction(() => /PRINCIPAL/.test(window.KladLienGrafit.demo()));
    await page.locator('#volet [data-fermer]').last().click();

    // verrouiller puis rouvrir : données relues depuis le coffre chiffré ; le résumé reste lisible appli verrouillée
    await page.locator('#app-tb [data-tab="plus"]').click();
    await page.locator('#btnLock').click();
    await page.waitForSelector('.pad');
    assert.equal((await grafit()).accounts[0].label, 'PRINCIPAL');
    await code();
    await page.waitForSelector('#appli:not([hidden])');
    assert.equal(await nbOps(), n1);
    assert.equal(await page.locator('#view-accueil [data-compte]').count(), 4);

    // désactivé → résumé effacé
    await page.locator('#app-tb [data-tab="plus"]').click();
    assert.match(await page.locator('#plusCorps [data-volet="secModules"]').innerText(), /Lien Grafit activé/);
    await page.locator('#plusCorps [data-volet="secModules"]').click();
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
    await page.addInitScript(fauxClaude);
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
    const plusVers = async sec => { await page.locator('#app-tb [data-tab="plus"]').click(); await page.locator('#plusCorps [data-volet="' + sec + '"]').click(); };
    const deplier = async id => { if (await page.locator('#' + id).evaluate(e => e.classList.contains('collapsed'))) await page.locator('#' + id + ' .panel-h h2.fold').click(); };
    const auj = await page.evaluate(() => window.KladModele.jourLocal(Date.now()));
    await plusVers('secReprise');
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.locator('#btnChoisirReprise').click()]);
    await fc.setFiles({ name: 'reprise.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(repriseFictive(auj))) });
    await page.waitForSelector('#repriseApercu [data-a="importer"]');
    await page.locator('#repriseApercu [data-a="importer"]').click();
    await page.waitForFunction(() => window.KladApp.etat().budget && window.KladApp.etat().classement && window.KladApp.etat().classement.import);
    await page.locator('#volet [data-fermer]').last().click();
    assert.equal(await page.evaluate(() => window.KladApp.etat().budget.contrats.length), 4);

    // 0.10.1 : Accueil en tête (reste à vivre, À vérifier, soldes, ce cycle-ci, commun, échéances, actions rapides) ;
    // le reste à vivre ouvre son détail ; le haut de l'onglet Budget (grande carte, cartes) n'y est plus
    assert.equal(await page.locator('#app-tb [data-tab="accueil"]').getAttribute('aria-current'), 'page');
    const acc = await page.locator('#view-accueil').innerText();
    assert.match(acc, /Reste à vivre jusqu'au[\s\S]*par jour[\s\S]*Soldes[\s\S]*Ce cycle-ci[\s\S]*Commun[\s\S]*Prochaines échéances[\s\S]*Synchroniser[\s\S]*Verrouiller/i);
    assert.doesNotMatch(acc, SANS_SIGNE);
    await page.locator('#view-accueil [data-aller="rav"]').click();
    assert.match(await page.locator('#ravCorps').innerText(), /Base[\s\S]*Charges fixes[\s\S]*Marge[\s\S]*Variable[\s\S]*Reste à vivre/);
    await page.locator('#volet [data-fermer]').last().click();
    await capture(page, '12-accueil');
    await page.locator('#view-accueil [data-aller="budget"]').first().click();
    assert.equal(await page.locator('#app-tb [data-tab="budget"]').getAttribute('aria-current'), 'page');
    assert.equal(await page.locator('#app-hero').isVisible(), false);
    // Budget : « Reste à vivre » (deux colonnes), détail en dépliant
    await page.locator('#app-tb [data-tab="budget"]').click();
    const rav = await page.locator('#rav-m').innerText();
    assert.match(rav, /Reste à vivre jusqu'au[\s\S]*sur le dernier salaire[\s\S]*sur les comptes courants/);
    await page.locator('#rav-m summary').click();
    assert.match(await page.locator('#rav-m').innerText(), /Base[\s\S]*Charges fixes[\s\S]*Marge[\s\S]*Variable[\s\S]*Reste à vivre/);
    await capture(page, '12-reste-a-vivre');

    // budget mensuel : sections, cycle de salaire, aucun montant signé
    let b = await page.locator('#view-budget').innerText();
    assert.match(b, /Cycle en cours · du \d\d\/\d\d au/);
    assert.match(b, /Revenus[\s\S]*Charges fixes[\s\S]*Dépenses courantes[\s\S]*Dépenses optionnelles[\s\S]*Solde prévu par le budget/i);
    assert.doesNotMatch(b, SANS_SIGNE);
    assert.doesNotMatch(b, /[−-]\s?\d[\d\s  ]* €/);
    await capture(page, '13-budget');
    // section dépliée ; montant d'un poste modifié en mode Budget, annulation
    await page.locator('#budget-main [data-sec="courante"]').first().click();
    assert.ok(await page.locator('#budget-main tr', { hasText: 'Alimentation' }).count() >= 1);
    await page.locator('#budget-main [data-bmode="plan"]').click();
    await page.locator('#budget-main [data-pamt="c|Alimentation"]').fill('250');
    await page.locator('#budget-main [data-pamt="c|Alimentation"]').press('Tab');
    await page.waitForSelector('#toast.show.action');
    assert.equal(await page.evaluate(() => window.KladApp.etat().budget.plan.perso['c|Alimentation'].amt), 25000);
    await page.locator('#toast button').click();
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => window.KladApp.etat().budget.plan.perso['c|Alimentation'].amt), 16000);
    await page.locator('#budget-main [data-bmode="suivi"]').click();
    // cycle précédent (période clôturée), retour au cycle en cours
    await page.locator('#budget-main [data-nav="prev"]').click();
    b = await page.locator('#view-budget').innerText();
    assert.match(b, /Période clôturée/);
    assert.match(b, /Cycle du \d\d\/\d\d au \d\d\/\d\d\/\d\d/);
    await page.locator('#cyc-nav [data-nav="now"]').click();
    assert.match(await page.locator('#view-budget').innerText(), /Cycle en cours/);
    // Commun : mois civil, apports attendus selon la répartition ; virements, trésorerie, appels de fonds ; marge réelle
    await page.locator('#app-tb [data-tab="commun"]').click();
    b = await page.locator('#view-budget').innerText();
    assert.match(b, /Mois en cours/);
    assert.match(b, /Personne A[\s\S]*Personne B/);
    assert.match(b, /Solde du compte commun/);
    assert.match(b, /Marge réelle du commun[\s\S]*Virements à mettre en place[\s\S]*Trésorerie · 12 mois[\s\S]*Budget mensuel/);
    assert.match(await page.locator('#bal-panel').innerText(), /Fin de mois estimée/i);
    assert.doesNotMatch(b, /[−-]\s?\d[\d\s  ]*(,\d\d)? €/);
    await capture(page, '14-budget-commun');
    // ordres permanents (annulable)
    await page.locator('#cm-plan [data-ouvrir="secVirements"]').click();
    await page.waitForSelector('#virementsCorps [data-vok]');
    await page.locator('#virementsCorps [data-vf="montant"]').first().fill('900');
    await page.locator('#virementsCorps [data-vok]').click();
    await page.waitForSelector('#toast.show.action');
    assert.equal(await page.evaluate(() => window.KladApp.etat().budget.virements[0].montant), 90000);
    await page.locator('#toast button').click();
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => window.KladApp.etat().budget.virements[0].montant), 80000);
    // Équilibre (Plus) : reste à combler, simulation
    await page.locator('#app-tb [data-tab="plus"]').click();
    await page.locator('#plusCorps [data-vue="appartement"]').click();
    assert.match(await page.locator('#view-appart').innerText(), /Reste à combler[\s\S]*Personne A doit encore investir/i);
    await page.fill('#eqSimY', '100000');
    await page.waitForFunction(() => /Équilibre atteint tout de suite/.test(document.getElementById('eqSimOut').textContent));
    await capture(page, '16-equilibre');

    // contrats et échéances (commun), tendance (perso)
    await page.locator('#app-tb [data-tab="commun"]').click();
    await deplier('p-contrats');
    assert.match(await page.locator('#p-contrats').innerText(), /Prêt immobilier fictif[\s\S]*Échéances des 31 prochains jours/i);
    await page.locator('#app-tb [data-tab="budget"]').click();
    await deplier('tend-panel');
    assert.ok(await page.locator('#tend-panel svg rect').count() >= 3);
    await page.selectOption('#tend-mode', 'cat:Alimentation');
    await page.waitForTimeout(150);
    assert.match(await page.locator('#tend-panel').innerText(), /Alimentation/);
    await capture(page, '15-tendance');

    // contrat ajouté (annulable) ; base de calcul ; thème ; mode démo
    await deplier('p-contrats');
    await page.locator('#p-contrats [data-ctedit="liste"]').click();
    await page.locator('#p-contrats [data-ctedit="nouveau"]').click();
    await page.fill('#ctLabel', 'Abonnement fictif');
    await page.fill('#ctMontant', '12,50');
    await page.fill('#ctMotif', 'ABONNEMENT FICTIF');
    await page.locator('#p-contrats [data-ct="ok"]').click();
    await page.waitForSelector('#toast.show.action');
    assert.equal(await page.evaluate(() => window.KladApp.etat().budget.contrats.length), 5);
    assert.match(await page.locator('#p-contrats').innerText(), /Abonnement fictif[\s\S]*12,50\s€/);
    await capture(page, '19-contrats');
    await page.locator('#toast button').click();
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => window.KladApp.etat().budget.contrats.length), 4);
    await page.locator('#budget-main [data-bmode="plan"]').click();
    const refAvant = await page.evaluate(() => window.KladApp.etat().budget.ref);
    const opts = await page.locator('#bref option').evaluateAll(o => o.map(x => x.value));
    await page.selectOption('#bref', opts[1]);
    await page.waitForSelector('#toast.show.action');
    assert.equal(await page.evaluate(() => window.KladApp.etat().budget.ref), opts[1]);
    await page.locator('#toast button').click();
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => window.KladApp.etat().budget.ref), refAvant);
    await page.locator('#budget-main [data-bmode="suivi"]').click();
    // thème : bouton de l'en-tête (Auto → Clair → Sombre) et volet Affichage ; couleur réellement affichée, téléphone
    // en thème sombre puis clair ; barres Android (faux plugin) accordées au thème affiché
    const fond = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const CLAIR = 'rgb(243, 245, 242)', SOMBRE = 'rgb(12, 15, 14)';
    await page.evaluate(() => { window.KladFauxBarres = []; window.Capacitor = window.Capacitor || {};
      window.Capacitor.Plugins = Object.assign(window.Capacitor.Plugins || {}, { KladAffichage: { async appliquer(o) { window.KladFauxBarres.push(o); return { ok: true }; } } }); });
    for (const tel of ['dark', 'light']) {
      await page.emulateMedia({ colorScheme: tel });
      await plusVers('secAffichage');
      for (const [choix, attendu] of [['clair', CLAIR], ['sombre', SOMBRE], ['auto', tel === 'dark' ? SOMBRE : CLAIR]]) {
        await page.locator('#affichageCorps [data-theme-choix="' + choix + '"]').click();
        assert.equal(await fond(), attendu, 'téléphone ' + tel + ', thème ' + choix);
        assert.equal(await page.evaluate(() => document.querySelector('meta[name="color-scheme"]').content), choix === 'auto' ? 'light dark' : choix === 'clair' ? 'light' : 'dark');
        const b = await page.evaluate(() => window.KladFauxBarres[window.KladFauxBarres.length - 1]);
        assert.deepEqual([b.sombre, b.fond], [attendu === SOMBRE, attendu === SOMBRE ? '#0c0f0e' : '#f3f5f2']);
      }
      await page.locator('#volet [data-fermer]').last().click();
    }
    await page.locator('#ah-theme').click();
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'light');
    await page.locator('#ah-theme').click();
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'dark');
    await capture(page, '20-theme-sombre');
    // choix gardé et appliqué dès le démarrage, avant la feuille de style (pas de flash) : téléphone clair, thème sombre
    assert.equal(await page.evaluate(() => localStorage.getItem('klad.theme')), 'sombre');
    const tete = fs.readFileSync(new URL('../www/index.html', import.meta.url), 'utf8').split('</head>')[0];
    assert.ok(/<script src="theme\.js"><\/script>\s*<link rel="stylesheet" href="style\.css">/.test(tete), 'theme.js synchrone, avant la feuille de style');
    const p2 = await browser.newPage({ colorScheme: 'light' });
    await p2.addInitScript(() => { try { localStorage.setItem('klad.theme', 'sombre'); } catch (e) { /* page vide */ } });
    await p2.goto(base + 'index.html', { waitUntil: 'domcontentloaded' });
    assert.equal(await p2.evaluate(() => document.documentElement.dataset.theme), 'dark');
    assert.equal(await p2.evaluate(() => getComputedStyle(document.body).backgroundColor), SOMBRE);
    await p2.close();
    await plusVers('secAffichage');
    await page.locator('#affichageCorps [data-theme-choix="auto"]').click();
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme || 'auto'), 'auto');
    await page.emulateMedia({ colorScheme: 'light' });
    const tot0 = await page.locator('#budget-main tr.g-fixe .gsum').first().textContent();
    await page.locator('#affichageCorps [data-demo="on"]').click();
    await page.locator('#app-tb [data-tab="budget"]').click();
    await page.waitForTimeout(150);
    assert.ok(await page.locator('#demoBar').isVisible());
    assert.notEqual(await page.locator('#budget-main tr.g-fixe .gsum').first().textContent(), tot0);
    await capture(page, '21-mode-demo');
    await page.locator('#demoBar button').click();
    assert.ok(!(await page.locator('#demoBar').isVisible()));
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains('demo')), false);

    // Lot 8 : impôts, épargne (écrans de Plus), observations (volet) ; observations à faire en tête du Budget
    for (const [v, id, motif] of [['impots', 'view-impots', /À régulariser entre vous[\s\S]*Taxe foncière/i], ['epargne', 'view-epargne', /Plan d'épargne entreprise[\s\S]*Livret[\s\S]*Solde estimé/i]]) {
      await page.locator('#app-tb [data-tab="plus"]').click();
      await page.locator('#plusCorps [data-vue="' + v + '"]').click();
      const t = await page.locator('#' + id).innerText();
      assert.match(t, motif);
      assert.doesNotMatch(t, /[−-]\s?\d[\d\s  ]*(,\d\d)? €/);
      await capture(page, '18-' + v);
    }
    await plusVers('secObs');
    assert.match(await page.locator('#obsCorps').innerText(), /À faire/i);
    await page.locator('#volet [data-fermer]').last().click();
    await page.locator('#app-tb [data-tab="plus"]').click();
    await page.locator('#plusCorps [data-vue="impots"]').click();
    await deplier('tx-hyp-panel');
    await page.locator('#view-impots [data-hyp="communG"]').fill('60');
    await page.locator('#view-impots [data-hyp="communG"]').press('Tab');
    await page.waitForSelector('#toast.show.action');
    assert.equal(await page.evaluate(() => window.KladApp.etat().budget.fisc.hyp.communG), 60);
    await page.locator('#toast button').click();
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => window.KladApp.etat().budget.fisc.hyp.communG), 50);
    await page.locator('#app-tb [data-tab="budget"]').click();
    assert.match(await page.locator('#actions').innerText(), /à faire/i);

    // 0.9.1 : relevé de contrôle (Plus › Contrôle) : confirmation, fichier JSON klad-controle v1
    await plusVers('secControle');
    assert.match(await page.locator('#controleCorps').innerText(), /Fichier personnel en clair/);
    assert.match(await page.locator('#ctlImport').innerText(), /Import de l'ancienne version : \d+ règles de base, \d+ postes de budget, \d+ mouvements? d'équilibre/);
    assert.doesNotMatch(await page.locator('#ctlImport').innerText(), /incomplet/);
    await page.locator('#controleCorps [data-ctl="exporter"]').click();
    const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#controleCorps [data-ctl="exporter"]').click()]);
    assert.match(dl.suggestedFilename(), /^klad-controle-\d{8}-\d{4}\.json$/);
    const rel = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
    assert.deepEqual([rel.format, rel.v, rel.source], ['klad-controle', 1, 'klad']);
    assert.ok(rel.meta.import.reglesBase > 0 && rel.meta.import.postes > 0);
    assert.ok(rel.budget.courant.postes.length > 0 && rel.empreinte.cycles.courant.comptes.length > 0);
    assert.ok(!/FR76|sk-ant/.test(JSON.stringify(rel)));
    await page.locator('#volet [data-fermer]').last().click();
    // Lot 9b : extras désactivés par défaut ; Claude activé → « Lire un bulletin » ; envoi confirmé (aperçu, coût), enregistrement
    await page.locator('#app-tb [data-tab="plus"]').click();
    assert.match(await page.locator('#plusCorps [data-volet="secExtras"]').innerText(), /Mail désactivé · Claude désactivé/);
    await page.locator('#plusCorps [data-vue="impots"]').click();
    assert.equal(await page.locator('#view-impots [data-lirebs]').count(), 0);
    await plusVers('secExtras');
    await page.locator('#extrasCorps [data-extra="claude"]').click();
    await page.fill('#exCle', 'sk-ant-api03-' + 'f'.repeat(40));
    await page.locator('#extrasCorps [data-exa="claudeok"]').click();
    assert.equal(await page.evaluate(() => window.KladApp.etat().cle.claude.slice(0, 7)), 'sk-ant-');
    await capture(page, '22-extras');
    await page.locator('#volet [data-fermer]').last().click();
    await page.locator('#app-tb [data-tab="plus"]').click();
    await page.locator('#plusCorps [data-vue="impots"]').click();
    const nbBs = await page.evaluate(() => Object.keys(window.KladApp.etat().budget.fisc.bs).length);
    const [fb] = await Promise.all([page.waitForEvent('filechooser'), page.locator('#view-impots [data-lirebs]').first().click()]);
    await fb.setFiles({ name: 'bulletin.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 bulletin fictif') });
    await page.waitForFunction(() => /environ|moins de/.test(document.getElementById('claudeCorps').textContent));
    assert.match(await page.locator('#claudeCorps').innerText(), /Envoyé à Claude : le document « bulletin\.pdf »[\s\S]*Rien d'autre/);
    await page.locator('#claudeCorps [data-cl="envoyer"]').click();
    await page.waitForSelector('#claudeCorps [data-cl="enregistrer"]');
    assert.match(await page.locator('#claudeCorps').innerText(), /Coût réel[\s\S]*Net imposable \(€\)[\s\S]*2\s500/);
    await capture(page, '23-claude');
    await page.locator('#claudeCorps [data-cl="enregistrer"]').click();
    await page.waitForSelector('#toast.show.action');
    assert.equal(await page.evaluate(() => Object.keys(window.KladApp.etat().budget.fisc.bs).length), nbBs + 1);
    const envois = await page.evaluate(() => window.KladFauxClaude);
    assert.equal(envois.length, 2);
    for (const e of envois) { assert.ok(!e.body.includes('sk-ant-')); assert.ok(!/FICTI[FV]E? PAIE|SUPERMARCHE|FR76/.test(e.body)); }
    assert.ok(!(await page.evaluate(() => window.KladApp.etat().journal.log.join('\n'))).includes('sk-ant-'));
    // désactivé : le bouton disparaît
    await plusVers('secExtras');
    await page.locator('#extrasCorps [data-extra="claude"]').click();
    await page.locator('#volet [data-fermer]').last().click();
    await page.locator('#app-tb [data-tab="plus"]').click();
    await page.locator('#plusCorps [data-vue="impots"]').click();
    assert.equal(await page.locator('#view-impots [data-lirebs]').count(), 0);
    // Lot 9b : « Lire les mails » avec un faux plugin KladMail (aucun réseau) ; PDF fictif fabriqué par Chromium
    const p0 = await browser.newPage();
    await p0.setContent('<p>Appel exigible le 01/10/2026</p><p>Total appel copropriétaire 1 234,56</p>');
    const pdfAppel = (await p0.pdf()).toString('base64');
    await p0.close();
    await page.evaluate(b64 => {
      const S = window.KladApp.etat();
      S.modele.extras.mail = { on: true, hote: 'imap.exemple.test', port: 993, adresse: 'moi@exemple.test', expediteurs: 'syndic.exemple.test', motsCles: 'appel' };
      S.cle.mailMdp = 'abcdabcdabcdabcd';
      window.KladFauxMail = [];
      window.Capacitor = window.Capacitor || {};
      window.Capacitor.Plugins = Object.assign(window.Capacitor.Plugins || {}, { KladMail: {
        async tester(p) { window.KladFauxMail.push(p); return { ok: true, nb: 3 }; },
        async chercher(p) {
          window.KladFauxMail.push(p);
          return { messages: [{ id: '<m1@exemple.test>', date: '2026-09-15T08:00:00Z', expediteur: 'gestion@syndic.exemple.test', sujet: 'Appel de fonds',
            texte: 'Veuillez trouver ci-joint votre appel.', pieces: [{ nom: 'appel.pdf', type: 'application/pdf', taille: 900, base64: b64 }] }] };
        } } });
    }, pdfAppel);
    const apAvant = await page.evaluate(() => JSON.stringify(window.KladApp.etat().budget.appels || null));
    await page.evaluate(() => window.KladExtras.lireMails(document.createElement('button')));
    await page.waitForSelector('#toast.show.action');
    const ap = await page.evaluate(() => window.KladApp.etat().budget.appels);
    assert.deepEqual(ap.mails['<m1@exemple.test>'], { mail: '2026-09-15', d: '2026-10-01', cp: 'H', kind: 'charges', fn: 'appel.pdf' });
    assert.deepEqual(ap.pdfs.filter(x => x.name === 'appel.pdf').map(x => [x.cp, x.d, x.a]), [['H', '2026-10-01', 1234.56]]);
    const fm = await page.evaluate(() => window.KladFauxMail);
    assert.deepEqual([fm[0].adresse, fm[0].motDePasse, fm[0].expediteurs, fm[0].motsCles], ['moi@exemple.test', 'abcdabcdabcdabcd', ['syndic.exemple.test'], ['appel']]);
    const jm = await page.evaluate(() => window.KladApp.etat().journal.log.join('\n'));
    assert.match(jm, /Mails lus : 1 message\(s\) retenu\(s\), 1 appel\(s\) nouveau\(x\), 1 montant\(s\) lu\(s\)/);
    for (const x of ['moi@exemple.test', 'abcdabcd', 'syndic.exemple', 'Appel de fonds']) assert.ok(!jm.includes(x), x);
    await page.locator('#toast button').click();
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => JSON.stringify(window.KladApp.etat().budget.appels || null)), apAvant);

    // 0.9.4 : prélèvement de portefeuille « à rapprocher » marqué interne → reste visible (filtre « Internes »),
    // mention dans le détail, « Annuler : compter en dépense » (annulable) → de nouveau à rapprocher
    const jourAvant = n => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
    await page.evaluate(([d1, d2]) => {
      const S = window.KladApp.etat(), M = window.KladModele;
      const w = M.nouveauCompte(S, { libelle: 'PORTEFEUILLE', role: 'paiement_en_ligne' });
      w.prelevement = { motif: 'PORTEFEUILLE FICTIF' };
      M.opsDe(S, w.id).push(M.nouvelleOp(w.id, { id: w.id + ':m:1', date: d1, montant: -1299, libelle: 'MARCHAND EN LIGNE FICTIF', statut: 'comptabilisee' }, 'manuel', d1));
      const c = S.modele.comptes.find(x => x.role === 'courant');
      M.opsDe(S, c.id).push(M.nouvelleOp(c.id, { id: c.id + ':m:rap', date: d2, montant: -4500, libelle: 'PRLV PORTEFEUILLE FICTIF', statut: 'comptabilisee' }, 'manuel', d2));
      S.ops[c.id].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
      window.KladApp.changed('classement');
    }, [jourAvant(10), jourAvant(8)]);
    const ligneRap = page.locator('#tx tr.txr[data-op$=":m:rap"]');
    await page.evaluate(() => window.KladApp.versOps({ cat: '__rap' }));
    await ligneRap.locator('.tl').click();
    await page.locator('#opDetail [data-a="interne"]').click();
    await page.waitForSelector('#toast.show.action');
    assert.match(await page.locator('#toast').innerText(), /reste dans la liste, filtre « Internes »/);
    assert.equal(await page.locator('#app-chips [data-f="int"]').getAttribute('aria-pressed'), 'true');
    assert.match(await ligneRap.innerText(), /Virements internes[\s\S]*interne \(à la main\)/);
    await ligneRap.locator('.tl').click();
    assert.match(await page.locator('#opDetail').innerText(), /Interne\s*marquée interne à la main : pas comptée dans le budget/);
    await page.waitForFunction(() => !document.getElementById('toast').classList.contains('show'), null, { timeout: 15000 });
    await page.locator('#opDetail [data-a="depense"]').click();
    await page.waitForSelector('#toast.show.action');
    assert.match(await page.locator('#toast').innerText(), /revient dans « À vérifier »/);
    const etatRap = () => page.evaluate(() => { const S = window.KladApp.etat(), c = S.modele.comptes.find(x => x.role === 'courant');
      const o = S.ops[c.id].find(x => x.id === c.id + ':m:rap'), cx = window.KladApp.ctx(); return [window.KladClasse.classer(cx, o).type, !!window.KladClasse.aRapprocher(cx, o)]; });
    assert.deepEqual(await etatRap(), ['depense', true]);
    await page.locator('#toast button').click();                     // annuler l'annulation : de nouveau interne
    await page.waitForTimeout(100);
    assert.deepEqual(await etatRap(), ['interne', false]);
    // les règlements comptés internes automatiquement sont aussi dans le filtre « Internes »
    await page.locator('#app-tb [data-tab="budget"]').click();
    await page.locator('#app-tb [data-tab="operations"]').click();
    await page.locator('#app-chips [data-f="toutes"]').click();
    await page.locator('#app-chips [data-f="int"]').click();
    assert.match(await page.locator('#tx').innerText(), /CARTE FICTIVE[\s\S]*interne/);
    assert.equal(await ligneRap.count(), 1);
    await page.locator('#app-chips [data-f="int"]').click();

    // 0.9.4 : période des opérations (raccourcis, personnalisée), combinée avec la recherche ; pastille effaçable ;
    // totaux débit / crédit de la sélection ; gardée en changeant d'onglet
    const dates = () => page.$$eval('#tx tr.txr', trs => trs.map(t => t.dataset.op));
    const totalAttendu = () => page.evaluate(() => {
      const S = window.KladApp.etat(), ids = new Set([...document.querySelectorAll('#tx tr.txr')].map(t => t.dataset.op));
      let d = 0, c = 0; for (const cid of Object.keys(S.ops)) for (const o of S.ops[cid]) if (ids.has(o.id)) { if (o.montant < 0) d -= o.montant; else c += o.montant; }
      return [ids.size, window.KladFormat.montant(d), window.KladFormat.montant(c)]; });
    const toutAffiche = async () => { while (await page.locator('#tx-suite [data-suite]').count()) await page.locator('#tx-suite [data-suite]').click(); };
    await page.selectOption('#opsPer', '30j');
    assert.equal(await page.locator('#ops-pastille').isVisible(), true);
    assert.match(await page.locator('#ops-pastille').innerText(), /30 derniers jours/);
    assert.match(await page.locator('#ah-e').innerText(), /30 derniers jours/);
    await toutAffiche();
    const ops30 = await page.evaluate(() => { const S = window.KladApp.etat(), ids = new Set([...document.querySelectorAll('#tx tr.txr')].map(t => t.dataset.op)), out = [];
      for (const cid of Object.keys(S.ops)) for (const o of S.ops[cid]) if (ids.has(o.id)) out.push(o.date); return out; });
    assert.ok(ops30.length > 0 && ops30.every(d => d >= jourAvant(29)), 'dates dans les 30 jours');
    let [n, deb, cre] = await totalAttendu();
    let tot = await page.locator('#ops-tot').innerText();
    assert.ok(tot.includes(n + ' opération') && tot.includes(deb) && tot.includes(cre), tot);
    assert.doesNotMatch(tot, /[−-]\s?\d/);
    // combinée avec la recherche
    await page.locator('#ah-search').click();
    await page.fill('#q', 'SUPERMARCHE');
    await page.locator('#q').dispatchEvent('input');
    await page.waitForTimeout(400);
    const txt = await page.locator('#tx').innerText();
    assert.ok(/SUPERMARCHE/.test(txt) && !/SALAIRE|LIBRAIRIE/.test(txt), txt);
    [n, deb, cre] = await totalAttendu();
    tot = await page.locator('#ops-tot').innerText();
    assert.ok(tot.includes(n + ' opération') && tot.includes(deb), tot);
    await page.locator('#ah-search').click();
    // gardée en changeant d'onglet
    await page.locator('#app-tb [data-tab="budget"]').click();
    await page.locator('#app-tb [data-tab="operations"]').click();
    assert.equal(await page.locator('#opsPer').inputValue(), '30j');
    // cycle précédent, puis personnalisé (sélecteur de dates), puis croix : toute période
    await page.selectOption('#opsPer', 'cycleP');
    assert.match(await page.locator('#ops-pastille').innerText(), /Cycle précédent : \d\d\/\d\d → \d\d\/\d\d/);
    await page.selectOption('#opsPer', 'perso');
    assert.equal(await page.locator('#ops-perso').isVisible(), true);
    await page.fill('#opsDu', jourAvant(20));
    await page.locator('#opsDu').dispatchEvent('change');
    await page.fill('#opsAu', jourAvant(5));
    await page.locator('#opsAu').dispatchEvent('change');
    assert.match(await page.locator('#ops-pastille').innerText(), /Du \d\d\/\d\d(\/\d\d)? au \d\d\/\d\d\/\d\d/);
    await toutAffiche();
    const opsP = await page.evaluate(() => { const S = window.KladApp.etat(), ids = new Set([...document.querySelectorAll('#tx tr.txr')].map(t => t.dataset.op)), out = [];
      for (const cid of Object.keys(S.ops)) for (const o of S.ops[cid]) if (ids.has(o.id)) out.push(o.date); return out; });
    assert.ok(opsP.length > 0 && opsP.every(d => d >= jourAvant(20) && d <= jourAvant(5)));
    await page.locator('#ops-pastille [data-per-effacer]').click();
    assert.equal(await page.locator('#ops-pastille').isVisible(), false);
    assert.equal(await page.locator('#opsPer').inputValue(), 'tout');
    assert.ok((await dates()).length >= opsP.length);
    assert.ok(!(await page.evaluate(() => JSON.stringify(localStorage))).includes('30j'), 'période non gardée au redémarrage');

    // Grafit : month et upcoming
    await plusVers('secModules');
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

// Lot 9b : texte d'un PDF lu par pdf.js embarqué (aucun réseau) ; PDF fictif fabriqué par Chromium.
test('parcours : lecture du texte d\'un PDF avec pdf.js embarqué', { skip: !chromium && !process.env.KLAD_PARCOURS && 'Playwright absent' }, async () => {
  const srv = await serveur();
  const base = 'http://127.0.0.1:' + srv.address().port + '/';
  const browser = await chromium.launch();
  try {
    const p0 = await browser.newPage();
    await p0.setContent('<p>Résidence fictive</p><p>Appel exigible le 01/10/2026</p><p>Total appel copropriétaire 1 234,56</p>');
    const pdf = await p0.pdf();
    const page = await browser.newPage();
    const erreurs = [];
    page.on('pageerror', e => erreurs.push(e.message));
    const autres = [];
    page.on('request', r => { if (!r.url().startsWith(base)) autres.push(r.url()); });
    await page.goto(base + 'index.html');
    const t = await page.evaluate(async b64 => window.KladPdf.texte(Uint8Array.from(atob(b64), c => c.charCodeAt(0))), pdf.toString('base64'));
    assert.match(t, /Résidence fictive[\s\S]*exigible le 01\/10\/2026[\s\S]*Total appel copropriétaire 1 234,56/);
    assert.deepEqual(autres.filter(u => !u.startsWith('data:')), []);
    assert.deepEqual(erreurs, []);
  } finally {
    await browser.close();
    srv.close();
  }
});
