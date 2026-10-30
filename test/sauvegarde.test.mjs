// Sauvegarde vérifiée (1.0) : comparaison bloc par bloc (node) ; dans Chromium, sur le jeu fictif des mesures :
// sauvegarde exportée → vérifiée (rien n'est remplacé) → tout effacé → restaurée sur une installation neuve → mêmes
// écrans, même relevé de contrôle, même résumé Grafit ; rappel « À vérifier » / BACKUP_DUE tant qu'aucune sauvegarde
// n'est vérifiée. Données fictives uniquement.
// La partie Chromium est sautée si Playwright n'est pas installé, sauf avec KLAD_PARCOURS=obligatoire.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { charge, json } from './charge.mjs';
import { ouvrir, playwright, AUJ } from '../tools/mesures/banc.mjs';

const PW = playwright();
const SAUT = !PW && !process.env.KLAD_PARCOURS && 'Playwright absent';

test('sauvegarde : comparaison bloc par bloc, clés comprises, journal exclu', () => {
  const { KladModele: M, KladCoffre: C } = charge(['anon.js', 'modele.js', 'coffre.js']);
  const S = M.vide();
  S.cle = { appId: 'app-fictive', pem: '-----BEGIN PRIVATE KEY-----x', redirectUrl: '', claude: 'sk-ant-fictive', mailMdp: 'mdp-fictif' };
  const c = M.nouveauCompte(S, { libelle: 'Courant', role: 'courant' });
  S.ops[c.id] = [{ id: c.id + ':t:1', compte: c.id, date: '2026-10-01', montant: -1234, libelle: 'ACHAT FICTIF', statut: 'comptabilisee', source: 'eb' }];
  S.budget = { v: 3, reglages: { cycle: 'mois' } };
  S.carnet = { klad: { appels: { titre: 'Résidence fictive' } } };
  S.journal.log = ['ligne'];
  const P = json(C.contenuSauvegarde(S, { theme: 'sombre', palette: 'klad' }));
  assert.equal(P.blocs.journal, undefined, 'journal exclu');
  assert.deepEqual(P.prefs, { theme: 'sombre', palette: 'klad' });
  let r = C.comparerSauvegarde(P, S, { theme: 'sombre', palette: 'klad' });
  assert.deepEqual(json([r.lisible, r.complete, r.differents, r.manquants, r.enTrop]), [true, true, [], [], []]);
  assert.deepEqual(json(r.cles), { eb: true, claude: true, mail: true });
  // données changées depuis : complète, avec la liste de ce qui diffère
  S.ops[c.id].push({ id: c.id + ':t:2', compte: c.id, date: '2025-12-01', montant: -500, libelle: 'AUTRE', statut: 'comptabilisee', source: 'eb' });
  S.budget.reglages.cycle = 'salaire';
  r = C.comparerSauvegarde(P, S, { theme: 'clair', palette: 'klad' });
  assert.equal(r.complete, true);
  assert.deepEqual(json(r.differents).sort(), ['budget', 'modele', 'prefs']);
  assert.deepEqual(json(r.manquants), ['ops-' + c.id + '-2025']);
  // clé absente du fichier, bloc retiré : incomplète
  const P2 = json(P); delete P2.blocs.cle.claude; delete P2.blocs.budget;
  r = C.comparerSauvegarde(P2, S);
  assert.equal(r.complete, false);
  assert.equal(C.comparerSauvegarde({ app: 'autre' }, S).lisible, false);
});

test('sauvegarde : exportée, vérifiée, tout effacé, restaurée sur une installation neuve → mêmes écrans, relevé et résumé Grafit', { skip: SAUT, timeout: 600000 }, async () => {
  const B = await ouvrir({});
  try {
    const { page } = B;
    const NOW = Date.parse(AUJ + 'T10:00:00');
    // état comparé : écrans principaux (texte), relevé de contrôle et résumé Grafit calculés à date fixe
    const etat = async () => {
      const ecrans = {};
      for (const t of ['accueil', 'budget', 'commun']) { await B.onglet(t); await B.pause(250); ecrans[t] = await page.locator('#appli').innerText(); }
      const calc = await page.evaluate(now => {
        const A = window.KladApp, S = A.etat(), Bu = A.budget(), cx = A.ctx(), e = A.extras(now);
        const ext = { attention: e.attention, sauvegarde: { jours: 3, rappel: false }, maj: null, budget: Bu };
        const rel = window.KladControle.construire(S, Bu, cx, now, { version: 'test', resume: null, grafitActif: false, extResume: ext });
        return { rel, resume: window.KladResume.construire(S, now, ext) };
      }, NOW);
      return { ecrans, rel: calc.rel, resume: calc.resume };
    };
    const alertes = () => page.evaluate(() => { const e = window.KladApp.extras(Date.now()); return window.KladResume.construire(window.KladApp.etat(), Date.now(), e).alerts.filter(a => a.code === 'BACKUP_DUE').map(a => a.text); });

    // réglages de Klad, clés et apparence : doivent revenir à la restauration
    await page.evaluate(() => {
      const S = window.KladApp.etat();
      S.cle.claude = 'sk-ant-cle-fictive-pour-le-test-000000'; S.cle.mailMdp = 'mot-de-passe-fictif';
      S.modele.reglages = { complement: { appels: { titre: 'Résidence fictive B' } } };
      window.KladAffichage.choisirPalette('grafit');
      window.KladApp.changed('test');
    });
    await B.pause(600);
    assert.deepEqual(await alertes(), ['SAUVEGARDE · JAMAIS']);
    await B.onglet('accueil');
    assert.match(await page.locator('#appli').innerText(), /Aucune sauvegarde vérifiée/);

    // export
    await B.onglet('plus');
    await page.locator('#plusCorps [data-vue="sauvegarde"]').click();
    const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#btnExport').click()]);
    assert.match(dl.suggestedFilename(), /^klad-sauvegarde-\d{4}-\d{2}-\d{2}\.klad$/);
    const fichier = fs.readFileSync(await dl.path());
    assert.doesNotMatch(fichier.toString('utf8'), /sk-ant|mot-de-passe-fictif|Résidence fictive/, 'fichier chiffré');
    await B.pause(300);
    assert.deepEqual(await alertes(), ['SAUVEGARDE · À VÉRIFIER'], 'exportée mais pas vérifiée : rappel maintenu');
    assert.match(await page.locator('#sauvState').innerText(), /Aucune sauvegarde vérifiée/);

    // vérification : mauvaise phrase refusée, bonne phrase → complète et lisible, rien de remplacé
    const verifier = async phrase => {
      const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.locator('#btnVerifier').click()]);
      await fc.setFiles({ name: 'sauvegarde.klad', mimeType: 'application/octet-stream', buffer: fichier });
      await page.locator('#modal .phrase-in').fill(phrase);
      await page.locator('#modal [data-a="go"]').click();
    };
    await verifier('AAAA-BBBB-CCCC-DDDD-EEEE-FFFF');
    await page.waitForFunction(() => /Phrase incorrecte/.test(document.querySelector('#modal .msg').textContent));
    await page.locator('#modal [data-a="back"]').click();
    const blocsAvant = await page.evaluate(() => JSON.stringify(Object.assign(window.KladModele.versBlocs(window.KladApp.etat()), { journal: null })));
    await verifier(B.phrase);
    await page.waitForFunction(() => !document.getElementById('sauvVerif').hidden);
    const v = await page.locator('#sauvVerif').innerText();
    assert.match(v, /Sauvegarde complète et lisible/);
    assert.match(v, /Enable Banking (oui|non), Claude oui, messagerie oui/);
    assert.match(v, /Rien n'a été modifié/);
    assert.equal(await page.evaluate(() => JSON.stringify(Object.assign(window.KladModele.versBlocs(window.KladApp.etat()), { journal: null }))), blocsAvant, 'rien n\'est remplacé');
    assert.deepEqual(await alertes(), [], 'sauvegarde vérifiée : plus de rappel');
    assert.match(await page.locator('#sauvState').innerText(), /Dernière sauvegarde vérifiée : fichier du/);
    const avant = await etat();

    // tout effacer, puis restaurer sur une installation neuve
    await page.evaluate(() => window.KladApp.ouvrirVolet('secVerrou'));
    await page.locator('#btnWipe').click();
    await page.waitForSelector('#modal .pad');
    await Promise.all([page.waitForNavigation(), B.code()]);
    await page.waitForSelector('[data-a="restore"]');
    assert.equal(await page.evaluate(() => sessionStorage.getItem('klad.demo')), null, 'données effacées');
    await page.evaluate(() => { localStorage.removeItem('klad.palette'); });
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.locator('[data-a="restore"]').click()]);
    await fc.setFiles({ name: 'sauvegarde.klad', mimeType: 'application/octet-stream', buffer: fichier });
    await page.locator('.phrase-in').fill(B.phrase);
    await page.locator('[data-a="go"]').click();
    await page.waitForSelector('.pad');
    await B.code(); await B.pause(100); await B.code();
    await page.waitForSelector('#appli:not([hidden])');
    await B.pause(1500);
    const apres = await etat();
    assert.deepEqual(apres.ecrans, avant.ecrans, 'mêmes écrans');
    assert.deepEqual(apres.rel, avant.rel, 'même relevé de contrôle');
    assert.deepEqual(apres.resume, avant.resume, 'même résumé Grafit');
    const S2 = await page.evaluate(() => { const S = window.KladApp.etat(); return { claude: S.cle.claude, mail: S.cle.mailMdp, reg: S.modele.reglages, palette: window.KladAffichage.palette() }; });
    assert.deepEqual(S2, { claude: 'sk-ant-cle-fictive-pour-le-test-000000', mail: 'mot-de-passe-fictif', reg: { complement: { appels: { titre: 'Résidence fictive B' } } }, palette: 'grafit' });
    assert.deepEqual(await alertes(), [], 'sauvegarde restaurée : vérifiée');
    assert.deepEqual(B.erreurs, []);
  } finally { await B.fin(); }
});
