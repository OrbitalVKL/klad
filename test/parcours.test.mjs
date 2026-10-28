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
    carnet: { reglages: 'opaques' }
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
    const page = await browser.newPage({ viewport: { width: 400, height: 820 } });
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
    assert.match(await page.locator('#alertes').innerText(), /2 comptes à vérifier/);

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
    assert.equal(await page.locator('[data-ref="r5"]').inputValue(), 'creer');
    await page.locator('#repriseApercu [data-a="importer"]').click();
    await page.waitForSelector('#volet', { state: 'visible' });
    assert.match(await page.locator('#repriseEtat').innerText(), /3 opération/);
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

    await page.locator('.onglets [data-onglet="vPlus"]').click();
    await capture(page, '4-plus');
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
    assert.deepEqual(r.total, { savings: 3999.5 });      // total général omis : carte à débit différé visible
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
