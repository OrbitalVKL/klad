// Tests du lot 2.4.0 : volet « Classer ». La catégorie choisie s'applique toujours à l'opération (avant : une règle plus
// longue ou une correction gardait l'ancienne catégorie malgré la confirmation) ; « Classer aussi les autres » n'est plus
// activé d'office mais le nombre d'opérations semblables est affiché ; nouvelle catégorie créée depuis le volet.
// Données fictives uniquement.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { charge, json, read } from './charge.mjs';
import { playwright, ouvrir } from '../tools/mesures/banc.mjs';

const { KladModele: M, KladClasse: K } = charge(['anon.js', 'eb.js', 'modele.js', 'classement.js']);
const NOW = Date.parse('2026-10-28T10:00:00Z');
let n = 0;
const op = (c, date, montant, libelle, o = {}) => Object.assign({ id: c.id + ':t:' + (n++), compte: c.id, date, montant, libelle, statut: 'comptabilisee', source: 'eb', categorie: null, vue: false }, o);
function etat() {
  const S = M.vide();
  const a = M.nouveauCompte(S, { libelle: 'COURANT', role: 'courant' });
  S.ops[a.id] = [];
  S.classement = K.nouveau();
  S.modele.vues = { depuis: '2026-01-01' };
  return { S, a };
}
const cat = (S, o) => K.classer(K.contexte(S, NOW), o).cat;

test('bug : une règle existante plus précise ne garde plus l\'opération dans l\'ancienne catégorie', () => {
  const { S, a } = etat();
  S.classement.regles.push({ mot: 'CAFE DU PORT FICTIF', cat: 'Divers' });
  const o = op(a, '2026-10-20', -450, 'CB CAFE DU PORT FICTIF'), p = op(a, '2026-10-21', -450, 'CB CAFE DU PORT FICTIF');
  S.ops[a.id].push(o, p);
  assert.equal(cat(S, o), 'Divers');
  // sans règle : seule l'opération change
  const s1 = K.appliquer(S, o, { cat: 'Bars', sub: 'Bars' });
  assert.equal(cat(S, o), 'Bars');
  assert.equal(cat(S, p), 'Divers');
  K.annuler(S, s1);
  assert.equal(cat(S, o), 'Divers');
  // avec un mot plus court que la règle existante : l'opération change ; les autres restent, et c'est dit
  const s2 = K.appliquer(S, o, { cat: 'Bars', sub: 'Bars', mot: 'CAFE' });
  assert.equal(cat(S, o), 'Bars');
  const R = K.restees(K.contexte(S, NOW), [o, p], 'Bars');
  assert.deepEqual(json(R.map(x => [x.o === p, x.cat, x.src])), [[true, 'Divers', 'regle']]);
  K.annuler(S, s2);
  assert.equal(cat(S, o), 'Divers');
  assert.deepEqual(json(S.classement.regles), [{ mot: 'CAFE DU PORT FICTIF', cat: 'Divers' }]);
});

test('bug : avec une règle, les corrections à la main des opérations concernées suivent ; annulation complète', () => {
  const { S, a } = etat();
  const o = op(a, '2026-10-20', -300, 'PRLV SEPA SALLE FICTIVE');
  const p = op(a, '2026-10-21', -300, 'PRLV SEPA SALLE FICTIVE', { categorie: { cat: 'Divers', sub: 'Divers' } });
  S.ops[a.id].push(o, p);
  const snap = K.appliquer(S, o, { cat: 'Sport', sub: 'Salle', mot: 'SALLE FICTIVE' });
  assert.equal(cat(S, o), 'Sport');
  assert.equal(cat(S, p), 'Sport', 'correction contraire retirée');
  assert.equal(K.restees(K.contexte(S, NOW), [o, p], 'Sport').length, 0);
  K.annuler(S, snap);
  assert.deepEqual(json(p.categorie), { cat: 'Divers', sub: 'Divers' });
  assert.equal(o.categorie, null);
});

test('bug : une catégorie retirée choisie à nouveau est rétablie', () => {
  const { S, a } = etat();
  const o = op(a, '2026-10-20', -300, 'CB LIBRAIRIE FICTIVE');
  S.ops[a.id].push(o);
  K.creerCategorie(S, 'Lecture fictive', 'optionnelle');
  K.supprimerCategorie(S, 'Lecture fictive');
  const snap = K.appliquer(S, o, { cat: 'Lecture fictive', sub: '' });
  assert.equal(cat(S, o), 'Lecture fictive');
  K.annuler(S, snap);
  assert.notEqual(cat(S, o), 'Lecture fictive');
});

test('volet : interrupteur coupé d\'office, nombre d\'opérations semblables affiché, confirmation d\'après le résultat réel', () => {
  const app = read('www/app.js');
  assert.match(app, /st: \{ cat, sub: r\.nc \? cat : r\.sub, autres: false, mot,/);
  assert.match(app, /KC\.restees\(ctx\(\), L, st\.cat\)/);
  assert.match(app, /La catégorie n\\'a pas changé/);
  const V = charge(['anon.js', 'eb.js', 'format.js', 'modele.js', 'icones-donnees.js', 'icones.js', 'classement.js', 'ui.js', 'vues.js']).KladVues;
  assert.equal(V.texteSemblables({ autres: false, mot: 'CAFE' }, 0, 3), 'Seule cette opération sera classée · 3 autres opérations contiennent « CAFE »');
  assert.equal(V.texteSemblables({ autres: false, mot: 'CAFE' }, 0, 1), 'Seule cette opération sera classée · 1 autre opération contient « CAFE »');
  assert.equal(V.texteSemblables({ autres: false, mot: 'CAFE' }, 0, 0), 'Seule cette opération sera classée');
  assert.equal(V.texteSemblables({ autres: true, mot: 'CAFE' }, 4, 3), '4 opérations contiennent « CAFE »');
});

const SAUT = !playwright() && !process.env.KLAD_PARCOURS && 'Playwright absent';
test('parcours : classer sans règle, créer une catégorie depuis le volet, puis classer dedans', { skip: SAUT, timeout: 120000 }, async () => {
  const B = await ouvrir({ largeur: 360 });
  try {
    const { page } = B;
    // opération dont le mot proposé se retrouve dans d'autres opérations
    const cible = await page.evaluate(() => {
      const S = window.KladApp.etat(), K = window.KladClasse;
      for (const cid of Object.keys(S.ops)) for (const o of S.ops[cid]) {
        const mot = K.motPropose(o.libelle);
        if (mot && K.concernees(S, mot, {}).length > 1) return [cid, o.id, K.concernees(S, mot, {}).length - 1];
      }
      return null;
    });
    assert.ok(cible, 'jeu de mesure : une opération a des semblables');
    await page.evaluate(c => window.KladApp.ouvrirClasser(c[0], c[1]), cible);
    await page.waitForSelector('#clsCorps #clsAutres');
    assert.equal(await page.getAttribute('#clsAutres', 'aria-checked'), 'false', 'pas coché d\'office');
    assert.match(await page.textContent('#clsN'), new RegExp('^Seule cette opération sera classée · ' + cible[2] + ' autres? opérations? conti'));
    // nouvelle catégorie
    await page.click('#clsCorps [data-nouvellecat]');
    await page.fill('#clsNcNom', 'Catégorie fictive 240');
    await page.selectOption('#clsNcNature', 'courante');
    await page.click('#clsCorps [data-a="nc-oui"]');
    await page.waitForSelector('#clsCorps .cat-t[aria-checked="true"][data-cat="Catégorie fictive 240"]');
    assert.equal(await page.inputValue('#clsSub'), 'Catégorie fictive 240');
    // même nom une seconde fois : la catégorie existante est choisie, rien n'est créé
    const nb = await page.evaluate(() => Object.keys(window.KladApp.etat().classement.categories).length);
    await page.click('#clsCorps [data-nouvellecat]');
    await page.fill('#clsNcNom', 'catégorie fictive 240');
    await page.click('#clsCorps [data-a="nc-oui"]');
    await page.waitForSelector('#clsCorps .cat-t[aria-checked="true"][data-cat="Catégorie fictive 240"]');
    assert.equal(await page.evaluate(() => Object.keys(window.KladApp.etat().classement.categories).length), nb);
    assert.equal(await page.locator('#clsNcNom').count(), 0, 'formulaire refermé');
    await page.click('#clsCorps [data-a="go"]');
    await page.waitForTimeout(200);
    const r = await page.evaluate(c => {
      const A = window.KladApp, o = A.trouverOp(c[0], c[1]), S = A.etat();
      return { cat: window.KladClasse.classer(A.ctx(), o).cat, nature: S.classement.categories['Catégorie fictive 240'].nature, regles: S.classement.regles.length, toast: document.getElementById('toast').textContent };
    }, cible);
    assert.equal(r.cat, 'Catégorie fictive 240');
    assert.equal(r.nature, 'courante');
    assert.equal(r.regles, 0, 'aucune règle créée sans le demander');
    assert.match(r.toast, /Opération classée en « Catégorie fictive 240 »/);
    assert.deepEqual(B.erreurs, []);
  } finally {
    await B.fin();
  }
});
