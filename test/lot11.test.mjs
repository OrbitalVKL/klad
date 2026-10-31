// Lot 1.1 dans Chromium, sur le jeu fictif des mesures : saisie d'un montant du Budget quand le clavier s'ouvre,
// encart du reste à vivre, onglet Patrimoine (Impôts, Foncier, Épargne, Crypto), calculateur carburant en fenêtre,
// historique des observations faites, rapprochement à la main d'un portefeuille, suivi du commun sur le cycle de
// salaire. Données fictives uniquement.
// Sauté si Playwright n'est pas installé, sauf avec KLAD_PARCOURS=obligatoire (fabrication GitHub Actions).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ouvrir, playwright } from '../tools/mesures/banc.mjs';

const PW = playwright();
const SAUT = !PW && !process.env.KLAD_PARCOURS && 'Playwright absent';

test('lot 1.1 : clavier du Budget, reste à vivre, Patrimoine et crypto, carburant, historique, rapprochement, commun', { skip: SAUT, timeout: 600000 }, async () => {
  const B = await ouvrir({ mobile: true });
  try {
    const { page } = B;
    const toast = async re => { await page.waitForFunction(r => new RegExp(r).test(document.getElementById('toast').textContent), re.source); return page.locator('#toast').innerText(); };
    const annuler = async () => { await page.locator('#toast button').click(); await B.pause(250); };

    // 1. Budget : le clavier qui s'ouvre (hauteur réduite) ne redessine plus l'écran ni ne retire le champ
    await B.onglet('budget');
    await page.locator('[data-bmode="plan"]').first().click();
    await B.pause(300);
    const champ = page.locator('#budget-main input[data-pamt]:not([disabled])').first();
    await champ.focus();
    await page.evaluate(() => { document.activeElement.dataset.marque = '1'; });
    await page.setViewportSize({ width: 412, height: 480 });
    await B.pause(600);
    assert.equal(await page.evaluate(() => !!(document.activeElement && document.activeElement.dataset.marque === '1' && document.activeElement.isConnected)), true, 'champ gardé et toujours actif');
    await page.keyboard.type('1');
    assert.match(await page.evaluate(() => document.activeElement.value), /1/);
    await page.evaluate(() => document.activeElement.blur());
    await B.pause(200);
    await page.setViewportSize({ width: 400, height: 915 });
    await B.pause(600);
    assert.equal(await page.locator('[data-marque]').count(), 0, 'largeur changée : écran redessiné');
    await page.setViewportSize({ width: 412, height: 915 });
    await B.pause(400);

    // 2. Accueil : encart du reste à vivre réduit à l'essentiel ; « par jour » aussi dans le détail
    await B.onglet('accueil');
    const hero = await page.locator('#view-accueil [data-aller="rav"]').innerText();
    assert.match(hero.replace(/\s+/g, ' '), /^RESTE À VIVRE [\d\s  ]+,\d\d € (dépassé )?jusqu'au \d\d\/\d\d · ([\d\s  ]+ € par jour|budget du cycle dépassé)$/i);
    assert.doesNotMatch(hero, /cycle écoulé|budget utilisé|sur le dernier salaire/);
    await page.locator('#view-accueil [data-aller="rav"]').click();
    assert.match(await page.locator('#ravCorps').innerText(), /Par jour[\s\S]*restants?/);
    await B.fermer();

    // 3. Onglet Patrimoine : quatre parties ; plus d'Impôts ni d'Épargne dans Plus ; crypto saisie à la main
    await B.onglet('plus');
    assert.equal(await page.locator('#plusCorps [data-vue="impots"], #plusCorps [data-vue="epargne"]').count(), 0);
    await page.locator('#app-tb [data-tab="patrimoine"]').click();
    await B.pause(300);
    assert.equal(await page.locator('#app-tb [data-tab="patrimoine"]').getAttribute('aria-current'), 'page');
    assert.deepEqual(await page.$$eval('#view-impots [data-patri]', bs => bs.map(b => b.textContent)), ['Impôts', 'Foncier', 'Épargne', 'Crypto']);
    assert.match(await page.locator('#view-impots').innerText(), /Impôt sur le revenu/);
    await page.locator('#view-impots [data-patri="foncier"]').click();
    assert.match(await page.locator('#view-impots').innerText(), /Taxe foncière/);
    assert.equal(await page.locator('#view-impots [data-sousvue]').count(), 0, 'foncier : sans les sous-vues des impôts');
    await page.locator('#view-impots [data-patri="epargne"]').click();
    assert.match(await page.locator('#view-epargne').innerText(), /Livret/);
    await page.locator('#view-epargne [data-patri="crypto"]').click();
    assert.match(await page.locator('#view-crypto').innerText(), /Aucune position/);
    await page.locator('#view-crypto [data-cr="ajout"]').click();
    await page.fill('#crNom', 'Jeton fictif');
    await page.fill('#crInv', '1000');
    await page.fill('#crVal', '1250,50');
    await page.locator('#view-crypto [data-cr="ok"]').click();
    await toast(/Position « Jeton fictif » enregistrée/);
    let t = await page.locator('#view-crypto').innerText();
    assert.match(t, /Jeton fictif[\s\S]*plus-value 250,50/);
    assert.doesNotMatch(t, /[−-]\s?\d/);
    // valeur ancienne : rappel et observation
    await page.locator('#view-crypto [data-cr="edit"]').click();
    await page.fill('#crVal', '900');
    await page.fill('#crLe', '2026-08-01');
    await page.locator('#view-crypto [data-cr="ok"]').click();
    await toast(/enregistrée/);
    t = await page.locator('#view-crypto').innerText();
    assert.match(t, /moins-value 100,00[\s\S]*à mettre à jour/i);
    assert.ok(await page.evaluate(() => window.KladObservations.audit(window.KladApp.budget()).some(a => a.titre === 'Crypto : valeur à mettre à jour')));
    await page.locator('#view-crypto [data-cr="suppr"]').click();
    await page.locator('#view-crypto [data-cr="suppr"]').click();
    await toast(/Position retirée/);
    assert.match(await page.locator('#view-crypto').innerText(), /Aucune position/);
    await annuler();
    assert.match(await page.locator('#view-crypto').innerText(), /Jeton fictif/);
    // retour à l'onglet : dernière partie ouverte
    await B.onglet('accueil');
    await page.locator('#app-tb [data-tab="patrimoine"]').click();
    await B.pause(300);
    assert.equal(await page.locator('#view-crypto').isVisible(), true);

    // 4. Calculateur carburant : fenêtre ouverte depuis le poste du Budget ; plus dans les Réglages
    await B.onglet('budget');
    await page.locator('[data-bmode="suivi"]').first().click();
    await B.pause(300);
    for (let i = 0; i < 6 && !(await page.locator('[data-poste="c|Carburant"]').count()); i++) {
      const sec = page.locator('#budget-main [data-sec][aria-expanded="false"]');
      if (!(await sec.count())) break;
      await sec.first().click(); await B.pause(200);
    }
    await page.locator('[data-poste="c|Carburant"]').first().click();
    await B.pause(200);
    await page.locator('#budget-main [data-fuel]').first().click();
    await page.waitForSelector('#volet #carburantCorps [data-fu="prix"]');
    await page.fill('#carburantCorps [data-fu="prix"]', '1,95');
    await page.locator('#carburantCorps [data-fu="prix"]').press('Tab');
    await toast(/Calculateur carburant mis à jour/);
    assert.equal(await page.evaluate(() => window.KladApp.etat().budget.carburant.prix), 1.95);
    const prevu = +(await page.locator('#carburantCorps [data-fuelok]').getAttribute('data-fuelok'));
    await page.locator('#carburantCorps [data-fuelok]').click();
    await toast(/Prévu Carburant/);
    assert.equal(await page.evaluate(() => window.KladApp.etat().budget.plan.perso['c|Carburant'].amt), prevu);
    await B.fermer();
    await page.evaluate(() => window.KladApp.ouvrirVolet('secReglages'));
    assert.equal(await page.locator('#reglagesCorps [data-reglt="carburant"]').count(), 0);
    await B.fermer();

    // 5. Observations : « c'est fait » gardé dans l'historique
    await page.evaluate(() => window.KladApp.ouvrirVolet('secObs'));
    await B.pause(200);
    const titre = await page.locator('#obsCorps [data-fait]').first().getAttribute('data-fait');
    await page.locator('#obsCorps [data-fait]').first().click();
    await B.pause(300);
    await page.evaluate(() => window.KladApp.ouvrirVolet('secObs'));
    await B.pause(200);
    assert.match(await page.locator('#obsCorps .obs-hist summary').innerText(), /Historique des points faits \(1\)/);
    await page.locator('#obsCorps .obs-hist summary').click();
    assert.ok((await page.locator('#obsCorps .obs-hist').innerText()).includes(titre));
    await B.fermer();

    // 6. Portefeuille : prélèvement sans achat de même montant → rapprocher à la main, garder en dépense ; achat payé autrement
    const ids = await page.evaluate(() => {
      const M = window.KladModele, S = window.KladApp.etat();
      const cour = S.modele.comptes.find(c => c.role === 'courant');
      const w = M.nouveauCompte(S, { libelle: 'PORTEFEUILLE FICTIF', role: 'paiement_en_ligne', prelevement: { motif: 'PORTEFEUILLE FICTIF' } });
      const o = (c, id, date, montant, libelle) => ({ id: c.id + ':m:' + id, compte: c.id, date, montant, libelle, statut: 'comptabilisee', source: 'manuel', categorie: null, vue: true });
      S.ops[w.id] = [o(w, 1, '2026-10-09', -5490, 'MARCHAND DE VETEMENTS FICTIF'), o(w, 2, '2026-10-12', -1500, 'AUTRE MARCHAND FICTIF')];
      S.ops[cour.id].push(o(cour, 3, '2026-10-18', -5990, 'PRLV PORTEFEUILLE FICTIF 111'), o(cour, 4, '2026-10-16', -800, 'PRLV PORTEFEUILLE FICTIF 222'));
      window.KladApp.changed('test');
      return { w: w.id, cour: cour.id };
    });
    await B.pause(400);
    await page.evaluate(i => window.KladApp.ouvrirOp(i.cour, i.cour + ':m:3'), ids);
    await B.pause(300);
    assert.match(await page.locator('#opDetail').innerText(), /sans opération de même montant/);
    await page.locator('#opDetail [data-a="rapprocher"]').click();
    await page.waitForSelector('#rapCorps [data-rapid]');
    assert.match(await page.locator('#rapCorps').innerText(), /MARCHAND DE VETEMENTS/);
    await page.locator('#rapCorps [data-rapid="' + ids.w + '|' + ids.w + ':m:1"]').click();
    // 1.1.1 : montants différents (59,90 € prélevés pour un achat de 54,90 €) → confirmation avec l'écart
    await page.waitForSelector('#rapCorps [data-rapok]');
    assert.match(await page.locator('#rapCorps').innerText(), /Écart de rapprochement\s*5,00\s€[\s\S]*reste compté en dépense[\s\S]*signalé dans « À vérifier »/);
    await page.locator('#rapCorps [data-rapnon]').click();
    await page.waitForSelector('#rapCorps [data-rapid]');
    await page.locator('#rapCorps [data-rapid="' + ids.w + '|' + ids.w + ':m:1"]').click();
    await page.locator('#rapCorps [data-rapok]').click();
    await toast(/Rapproché : l'achat compte comme dépense, l'écart de 5,00\s€ aussi/);
    assert.match(await page.locator('#opDetail').innerText(), /Interne[\s\S]*marquée interne à la main/);
    assert.match(await page.locator('#opDetail').innerText(), /Écart de rapprochement\s*5,00\s€ · prélèvement de 59,90\s€, achat de 54,90\s€ : écart compté en dépense[\s\S]*à vérifier/);
    await page.locator('#opDetail [data-a="ecartvu"]').click();
    await toast(/Écart vérifié/);
    assert.match(await page.locator('#opDetail').innerText(), /· vérifié/);
    await page.evaluate(i => window.KladApp.ouvrirOp(i.w, i.w + ':m:1'), ids);
    await B.pause(200);
    assert.match(await page.locator('#opDetail').innerText(), /Réglé par\s*prélèvement du 18\/10\/2026[\s\S]*rapproché à la main/);
    assert.match(await page.locator('#opDetail').innerText(), /Écart de rapprochement\s*5,00\s€/, 'écart affiché aussi sur l\'achat');
    await page.evaluate(i => window.KladApp.ouvrirOp(i.cour, i.cour + ':m:4'), ids);
    await B.pause(200);
    await page.locator('#opDetail [data-a="garder"]').click();
    await toast(/gardé en dépense/);
    assert.equal(await page.locator('#opDetail [data-a="rapprocher"]').count(), 0);
    assert.equal(await page.evaluate(() => window.KladClasse.attention(window.KladApp.ctx(), Date.now()).toMatch), 0);
    await page.evaluate(i => window.KladApp.ouvrirOp(i.w, i.w + ':m:2'), ids);
    await B.pause(200);
    assert.match(await page.locator('#opDetail').innerText(), /aucun prélèvement retrouvé/);
    await page.locator('#opDetail [data-a="autrement"]').click();
    await toast(/payé autrement/);
    assert.match(await page.locator('#opDetail').innerText(), /payé autrement/);
    await annuler();
    assert.match(await page.locator('#opDetail').innerText(), /aucun prélèvement retrouvé/);

    // 7. Commun : suivi sur le cycle de salaire (réglage)
    await page.evaluate(() => window.KladApp.ouvrirVolet('secReglBudget'));
    await page.selectOption('#rg-commun-cycle', 'salaire');
    await page.locator('#reglBudgetCorps [data-theme="commun"] [data-rg="enregistrer"]').click();
    await toast(/Réglages enregistrés/);
    await B.fermer();
    await B.onglet('commun');
    const p = await page.evaluate(() => window.KladBudget.periode(window.KladApp.budget(), 'commun', null));
    assert.equal(p.salaire, true);
    assert.equal(p.start, await page.evaluate(() => window.KladBudget.periode(window.KladApp.budget(), 'perso', null).start));
    assert.deepEqual(B.erreurs, []);
  } finally { await B.fin(); }
});
