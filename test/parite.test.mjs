// Tests (0.10.8) : fonctions de l'ancienne version rétablies ou ajoutées (docs/parite-fonctions.md) — renommer et
// supprimer une catégorie, règle ajoutée à la main avec aperçu des opérations concernées, tri des opérations, total de
// tous les comptes dont épargne, une opération ajoutée une seule fois à l'équilibre. Jeu fictif des mesures (Chromium),
// plus des vérifications dans node. Données fictives uniquement.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { charge } from './charge.mjs';
import { ouvrir, playwright } from '../tools/mesures/banc.mjs';

const PW = playwright();
const SAUT = !PW && !process.env.KLAD_PARCOURS && 'Playwright absent';

test('ordre des opérations et aperçu d\'une règle (node)', () => {
  const X = charge(['anon.js', 'format.js', 'modele.js', 'classement.js', 'budget.js', 'commun.js', 'ui.js', 'vues.js']);
  const { KladVues: V, KladModele: M, KladClasse: K, KladCommun: KC } = X;
  const S = M.vide();
  const a = M.nouveauCompte(S, { libelle: 'COURANT', role: 'courant' });
  S.classement = K.nouveau();
  S.classement.regles = [{ mot: 'MARCHE', cat: 'Courses', sub: 'Courses' }, { mot: 'BAR', cat: 'Bars', sub: 'Bars' }];
  const op = (id, date, montant, libelle) => ({ id, compte: a.id, date, montant, libelle, statut: 'comptabilisee', source: 'eb' });
  S.ops[a.id] = [op('o4', '2026-10-04', -500, 'CB BAR FICTIF'), op('o3', '2026-10-03', -9000, 'CB MARCHE FICTIF'), op('o2', '2026-10-02', 20000, 'VIR RECU FICTIF'), op('o1', '2026-10-01', -1200, 'CB MARCHE FICTIF')];
  const cx = K.contexte(S, Date.parse('2026-10-05T10:00:00Z'));
  const L = S.ops[a.id];
  const ids = l => [...l].map(o => o.id).join(' ');
  assert.equal(ids(V.ordonner(L, 'date', cx)), 'o4 o3 o2 o1');
  assert.equal(ids(V.ordonner(L, 'old', cx)), 'o1 o2 o3 o4');
  assert.equal(ids(V.ordonner(L, 'amt', cx)), 'o3 o1 o4 o2');               // plus grosses dépenses d'abord
  assert.equal(ids(V.ordonner(L, 'cat', cx)), 'o2 o4 o3 o1');                // Autres revenus, Bars, Courses (récentes d'abord)
  assert.ok(V.ordreParJour('date') && V.ordreParJour('old') && !V.ordreParJour('amt'));
  const t = V.trancheSansJours(S, V.ordonner(L, 'amt', cx), 0, 2, { ctx: cx });
  assert.equal(t.fin, 2);
  assert.match(t.html, /tx-plat/);
  // aperçu d'une règle : les plus récentes d'abord, montants sans signe moins
  const ap = V.apercuRegle(S, K.concernees(S, 'MARCHE', {}));
  assert.match(ap, /03\/10[\s\S]*01\/10/);
  assert.doesNotMatch(ap.replace(/<[^>]+>/g, ' '), /[−-]\s?\d/);
  // équilibre : opération retrouvée
  S.budget = { equilibre: { equip: {}, items: [{ id: 'e1', src: 'op', op: 'o3', label: 'Meuble', moi: 9000, autre: 0 }] } };
  assert.equal(KC.equipementDeOp(S, 'o3').id, 'e1');
  assert.equal(KC.equipementDeOp(S, 'o1'), null);
});

test('parcours 0.10.8 : catégories, règles, tri, total, équilibre', { skip: SAUT }, async () => {
  const B = await ouvrir({});
  const { page } = B;
  try {
    const etat = (f, a) => page.evaluate(f, a);
    // Plus › Classement : renommer puis supprimer une catégorie (annulable)
    await page.evaluate(() => window.KladApp.ouvrirVolet('secClassement'));
    await B.pause(200);
    await page.locator('#classementCorps [data-cat="Cadeaux"]').click();
    await page.locator('#classementCorps [data-catren="Cadeaux"]').click();
    await page.fill('#catRenNom', 'Cadeaux & fêtes');
    await page.locator('#classementCorps [data-a="ren-ok"]').click();
    await B.pause(150);
    assert.ok(await etat(() => !!window.KladApp.etat().classement.categories['Cadeaux & fêtes'] && !window.KladApp.etat().classement.categories['Cadeaux']));
    await page.locator('#classementCorps [data-catsup="Cadeaux & fêtes"]').click();
    await page.locator('#classementCorps [data-catsup="Cadeaux & fêtes"]').click();            // second appui : confirmation
    await B.pause(150);
    assert.ok(await etat(() => !window.KladApp.etat().classement.categories['Cadeaux & fêtes']));
    await page.locator('#toast button').click();                                               // Annuler
    await B.pause(150);
    assert.ok(await etat(() => !!window.KladApp.etat().classement.categories['Cadeaux & fêtes']));
    // règle à la main : compteur et aperçu des opérations concernées, puis ajout
    await page.evaluate(() => window.KladApp.ouvrirVolet('secClassement'));
    await page.locator('#classementCorps [data-a="nr-ouvrir"]').click();
    await page.fill('#nrMot', 'SUPERMARCHE');
    await B.pause(100);
    const ap = await page.locator('#nrApercu').innerText();
    const n = await etat(() => window.KladClasse.concernees(window.KladApp.etat(), 'SUPERMARCHE', {}).length);
    assert.ok(n > 0 && ap.includes(n + ' opération'), ap.slice(0, 80));
    assert.equal(await page.locator('#nrApercu .rl-apercu li:not(.muted)').count(), Math.min(8, n));
    await page.selectOption('#nrCat', 'Courses');
    await page.locator('#classementCorps [data-a="nr-ok"]').click();
    await B.pause(150);
    assert.ok(await etat(() => window.KladApp.etat().classement.regles.some(r => r.mot === 'SUPERMARCHE' && r.cat === 'Courses')));
    await B.fermer();
    // Opérations : tri « plus grosses dépenses » (sans en-têtes de jour), puis retour aux plus récentes
    await B.operationsPerso();
    await page.selectOption('#opsOrdre', 'amt');
    await B.pause(200);
    const m = await page.$$eval('#tx .txr[data-op]', rs => rs.slice(0, 5).map(r => [r.dataset.c, r.dataset.op]));
    const montants = await etat(L => L.map(([c, id]) => window.KladApp.etat().ops[c].find(o => o.id === id).montant), m);
    assert.deepEqual(montants, montants.slice().sort((x, y) => x - y));
    assert.equal(await page.locator('#tx .tx-day').count(), 0);
    await page.selectOption('#opsOrdre', 'date');
    await B.pause(200);
    assert.ok(await page.locator('#tx .tx-day').count() > 0);
    // Accueil : total de tous les comptes, dont épargne
    await B.onglet('accueil');
    const so = await page.locator('[data-mesure="soldes"]').innerText();
    assert.match(so, /Tous les comptes : [\d\s  ,]+€ · dont épargne/);
    // Équilibre : une opération n'est ajoutée qu'une fois
    await B.operationsPerso();
    const r = await etat(() => { const S = window.KladApp.etat(); const c = S.modele.comptes.find(x => x.role === 'courant'); const o = S.ops[c.id].find(x => x.montant < 0); return [c.id, o.id]; });
    const classer = async () => { await page.evaluate(([c, id]) => window.KladApp.ouvrirOp(c, id), r); await B.pause(200); await page.locator('[data-a="classer"]').first().click(); await B.pause(200); };
    await classer();
    assert.equal(await page.locator('#clsCorps [data-a="equilibre"]').count(), 1);
    {
      await page.locator('#clsCorps [data-a="equilibre"]').click();
      await page.locator('#clsCorps [data-a="lkok"]').click();
      await B.pause(150);
      await classer();
      assert.match(await page.locator('#clsCorps [data-a="equilibre"]').innerText(), /Déjà dans l'équilibre/);
      await page.locator('#clsCorps [data-a="equilibre"]').click();
      assert.equal(await page.locator('#clsCorps [data-a="lkok"]').count(), 0, 'pas de second ajout');
      assert.equal(await page.locator('#clsCorps [data-a="lkretirer"]').count(), 1);
      const nb = await etat(([, id]) => window.KladApp.etat().budget.equilibre.items.filter(x => x.op === id).length, r);
      assert.equal(nb, 1);
    }
    assert.deepEqual(B.erreurs, []);
  } finally { await B.fin(); }
});
