// Tests du lot 2.4.1 : opération liée (achat d'un portefeuille ↔ prélèvement de la banque qui le règle), visible depuis
// chacune des deux, et depuis « Classer » quand le prélèvement reste interne. Données fictives uniquement.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { charge } from './charge.mjs';
import { playwright, ouvrir } from '../tools/mesures/banc.mjs';

const { KladModele: M, KladClasse: K } = charge(['anon.js', 'eb.js', 'modele.js', 'classement.js']);
const NOW = Date.parse('2026-10-28T10:00:00Z');
let n = 0;
const op = (c, date, montant, libelle, o = {}) => Object.assign({ id: c.id + ':t:' + (n++), compte: c.id, date, montant, libelle, statut: 'comptabilisee', source: 'eb', categorie: null, vue: false }, o);
function etat() {
  const S = M.vide();
  const a = M.nouveauCompte(S, { libelle: 'COURANT', role: 'courant' });
  const w = M.nouveauCompte(S, { libelle: 'PORTEFEUILLE', role: 'paiement_en_ligne', prelevement: { motif: 'PORTEFEUILLE FICTIF' } });
  S.ops[a.id] = []; S.ops[w.id] = [];
  S.classement = K.nouveau();
  return { S, a, w };
}
const lie = (S, o) => { const r = K.operationLiee(K.contexte(S, NOW), o); return r ? [r.op.id, r.sorte] : null; };

test('opération liée : achat ↔ prélèvement automatique, dans les deux sens', () => {
  const { S, a, w } = etat();
  const achat = op(w, '2026-10-08', -399, 'MARCHAND FICTIF'), autre = op(w, '2026-10-01', -399, 'AUTRE MARCHAND');
  S.ops[w.id].push(autre, achat);
  const prel = op(a, '2026-10-10', -399, 'PRLV PORTEFEUILLE FICTIF 123');
  S.ops[a.id].push(prel);
  assert.equal(K.classer(K.contexte(S, NOW), prel).src, 'reglement');
  assert.deepEqual(lie(S, prel), [achat.id, 'achat'], 'achat le plus proche dans la fenêtre');
  assert.deepEqual(lie(S, achat), [prel.id, 'prelevement']);
  assert.equal(lie(S, autre), null, 'hors fenêtre (9 jours avant le prélèvement)');
  // opération sans lien
  const seule = op(a, '2026-10-11', -1500, 'CB BOULANGERIE FICTIVE');
  S.ops[a.id].push(seule);
  assert.equal(lie(S, seule), null);
});

test('opération liée : rapprochement à la main (montants différents)', () => {
  const { S, a, w } = etat();
  const achat = op(w, '2026-10-05', -1000, 'MARCHAND FICTIF');
  const prel = op(a, '2026-10-20', -1050, 'PRLV PORTEFEUILLE FICTIF 456');
  S.ops[w.id].push(achat); S.ops[a.id].push(prel);
  assert.equal(lie(S, prel), null);
  K.rapprocherAvec(K.contexte(S, NOW), prel, w, achat);
  assert.deepEqual(lie(S, prel), [achat.id, 'achat']);
  assert.deepEqual(lie(S, achat), [prel.id, 'prelevement']);
});

const SAUT = !playwright() && !process.env.KLAD_PARCOURS && 'Playwright absent';
test('parcours : détail du prélèvement → achat lié → retour ; « Classer » du prélèvement mène à l\'achat', { skip: SAUT, timeout: 120000 }, async () => {
  const B = await ouvrir({ largeur: 360 });
  try {
    const { page } = B;
    const ids = await page.evaluate(() => {
      const A = window.KladApp, S = A.etat(), M = window.KladModele;
      const cour = S.modele.comptes.find(c => c.role === 'courant');
      const w = M.nouveauCompte(S, { libelle: 'PORTEFEUILLE FICTIF', role: 'paiement_en_ligne', prelevement: { motif: 'PFICTIF' } });
      const j = n => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
      const o = (c, id, date, montant, libelle) => ({ id: c.id + ':m:t241' + id, compte: c.id, date, montant, libelle, statut: 'comptabilisee', source: 'manuel', categorie: null, vue: true });
      S.ops[w.id] = [o(w, 1, j(3), -399, 'LOCATION FILM FICTIVE')];
      S.ops[cour.id].push(o(cour, 2, j(1), -399, 'PRLV PFICTIF REF 241'));
      A.changed('test');
      return { w: w.id, achat: w.id + ':m:t2411', cour: cour.id, prel: cour.id + ':m:t2412' };
    });
    await page.evaluate(i => window.KladApp.ouvrirOp(i.cour, i.prel), ids);
    await page.waitForSelector('#opDetail [data-a="liee"]');
    assert.match(await page.textContent('#opDetail .op-liee'), /LOCATION FILM FICTIVE[\s\S]*Achat détaillé sur PORTEFEUILLE FICTIF/);
    assert.match(await page.textContent('#opDetail'), /classez l'achat/);
    await page.click('#opDetail [data-a="liee"]');
    await page.waitForFunction(() => /Prélèvement sur/.test((document.querySelector('#opDetail .op-liee') || {}).textContent || ''));
    assert.match(await page.textContent('#opDetail .sh-head'), /LOCATION FILM FICTIVE/);
    // Retour : revient au prélèvement, puis à l'écran d'avant
    await page.click('#ah-back');
    await page.waitForFunction(() => /PFICTIF REF 241/.test(document.querySelector('#opDetail .sh-head').textContent));
    // « Classer » du prélèvement : note et bouton vers l'achat
    await page.click('#opDetail [data-a="classer"]');
    await page.waitForSelector('#clsCorps [data-a="liee"]');
    assert.match(await page.textContent('#clsCorps'), /Classez plutôt l'achat lié/);
    await page.click('#clsCorps [data-a="liee"]');
    await page.waitForFunction(() => /LOCATION FILM FICTIVE/.test(document.querySelector('#opDetail .sh-head').textContent));
    assert.equal(await page.isVisible('#clsCorps'), false, 'volet fermé');
    await page.click('#ah-back');
    await page.waitForFunction(() => /PFICTIF REF 241/.test(document.querySelector('#opDetail .sh-head').textContent));
    assert.deepEqual(B.erreurs, []);
  } finally {
    await B.fin();
  }
});
