// Série UX (0.10) dans Chromium, sur le jeu fictif de 3 ans des mesures (tools/mesures) :
// - les chiffres de l'accueil (reste à vivre, soldes, échéances, commun) sont ceux des fonctions de calcul et des écrans
//   d'origine (aucun calcul ne change ; garde-fou de chaque lot) ;
// - accessibilité des écrans principaux, palettes Klad et Grafit, clair et sombre : contrôles de moins de 48 dp et
//   textes sous le seuil AA au plus égaux aux seuils du lot (jamais plus qu'au lot précédent), polices de 12 px au moins.
// Sauté si Playwright et Chromium ne sont pas installés, sauf avec KLAD_PARCOURS=obligatoire (fabrication GitHub Actions).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ouvrir, playwright } from '../tools/mesures/banc.mjs';
import { auditer } from '../tools/mesures/audit.mjs';

const PW = playwright();
const SAUT = !PW && !process.env.KLAD_PARCOURS && 'Playwright absent';

// Seuils des écrans principaux (somme sur les écrans), abaissés à chaque lot ; 0.9.4 : 187 contrôles de moins de 48 dp,
// 406 textes sous le seuil en clair, 35 en sombre, police de 10 px.
const SEUILS = { petits: 0, contrastes: 0, police: 12 };

test('accueil : chiffres identiques aux calculs et aux écrans d\'origine', { skip: SAUT }, async () => {
  const B = await ouvrir({});
  try {
    const { page } = B;
    const norm = t => t.replace(/[\s\u00a0\u202f]+/g, ' ');
    const texte = async sel => norm(await page.locator(sel).first().innerText());
    const attendu = await page.evaluate(() => {
      const A = window.KladApp, KB = window.KladBudget, KC = window.KladCommun, F = window.KladFormat, M = window.KladModele, S = A.etat(), Bc = A.budget();
      const res = KB.suivi(Bc, 'perso', null), rav = res.rav;
      const soldes = M.comptesTries(S).filter(c => !c.masque && c.role !== 'carte_differee').map(c => { const s = M.soldeAffiche(S, c); return s ? [c.libelle, F.montant(Math.abs(s.centimes))] : null; }).filter(Boolean);
      const ech = KB.echeances(Bc, 31).map(e => [e.label, e.scope, F.montant(e.montant)]);
      const fdm = KC.finDeMois(Bc);
      const postes = [];
      for (const nk of ['courante', 'optionnelle']) for (const a of res.sections[nk].lignes) if (a.on && a.pm > 50) postes.push([a.label, KB.eur(a.cur), KB.eur(a.pm)]);
      // 2.0 : l'Aperçu arrondit à l'euro (cadran, postes, commun) ; le détail du reste à vivre garde les centimes
      const e0 = c => KB.eur(Math.abs(Math.round(c)));
      return { rav: [F.montant(Math.abs(rav.budget.reste)), F.montant(Math.abs(rav.comptes.reste))], rav0: e0(rav.budget.reste), ravB: [e0(rav.budget.reste), e0(rav.comptes.reste)], soldes, ech,
        fdm: [e0(fdm.solde), e0(fdm.end)], fdmC: [F.montant(Math.abs(fdm.solde)), F.montant(Math.abs(fdm.end))], postes };
    });
    // Aperçu, page Moi
    await B.onglet('accueil');
    // 1.1 : l'encart montre la base choisie (dernier salaire par défaut) ; les deux colonnes sont dans le détail
    // 2.0 : cadran de l'Aperçu ; détail par le « ? » de « Où va l'argent »
    const rav = await texte('.ap-hero');
    assert.ok(rav.includes(norm(attendu.rav0)), 'reste à vivre ' + attendu.rav0 + ' dans « ' + rav + ' »');
    await page.locator('[data-mesure="argent"] [data-aller="rav"]').first().click();
    await B.pause(200);
    const det = await texte('#ravCorps');
    for (const v of attendu.rav) assert.ok(det.includes(norm(v)), 'reste à vivre ' + v + ' dans le détail « ' + det + ' »');
    await B.fermer();
    const sold = await texte('[data-mesure="soldes"]');
    for (const [lib, v] of attendu.soldes) { assert.ok(sold.includes(lib), lib); assert.ok(sold.includes(norm(v)), 'solde ' + lib + ' ' + v); }
    // 2.0 : budget du cycle complet (tous les postes, montant / budget) ; 2.1 : le budget lui-même, dans l'Aperçu
    const cyc = await texte('#budget-main');
    const vus = attendu.postes.filter(([lib]) => cyc.includes(lib));
    assert.equal(vus.length, attendu.postes.length, 'postes du cycle sur l\'Aperçu');
    for (const [lib, cur, pm] of vus) assert.ok(cyc.includes(norm(cur) + ' / ' + norm(pm)), 'poste ' + lib);
    // prochains jours : liste dépliée, échéances perso (et cartes) sur Moi, celles du commun sur Nous
    const ech = async (mesure, sc) => {
      await page.locator('[data-mesure="' + mesure + '"] details.ap-plis > summary').click();
      const ec = await texte('[data-mesure="' + mesure + '"]');
      for (const [lib, , v] of attendu.ech.filter(e => e[1] === sc)) assert.ok(ec.includes(lib) && ec.includes(norm(v)), 'échéance ' + sc + ' ' + lib);
    };
    if (attendu.ech.some(e => e[1] === 'perso')) await ech('jours', 'perso');
    // Aperçu, page Nous : fin de mois estimée et solde du commun
    await B.onglet('nous');
    const cm = await texte('.ap-hero');
    for (const v of attendu.fdm) assert.ok(cm.includes(norm(v)), 'commun ' + v);
    if (attendu.ech.some(e => e[1] === 'commun')) await ech('jours-commun', 'commun');
    // 2.1 : reste à vivre sur les deux bases (interrupteur), postes du budget, fin de mois et solde du commun, contrats
    await B.onglet('budget');
    const rb = await texte('#ap-haut .rav-base');
    for (const v of attendu.ravB) assert.ok(rb.includes(norm(v)), 'Aperçu › reste à vivre ' + v + ' dans « ' + rb + ' »');
    for (let i = 0; i < 6; i++) { const b = page.locator('#budget-main .sec-tog[aria-expanded="false"]').first(); if (!(await b.count())) break; await b.click(); }
    const bm = await texte('#budget-main');
    for (const [lib] of vus) assert.ok(bm.includes(lib), 'Budget › poste ' + lib);
    for (const sc of ['perso', 'commun']) {
      await B.onglet(sc === 'perso' ? 'budget' : 'commun');
      const sv = page.locator('#budget-main [data-aller="' + (sc === 'perso' ? 'contrats-perso' : 'tresorerie') + '"]');
      if (await sv.count()) { await sv.click(); await B.pause(200); }
      await page.evaluate(() => { const p = document.getElementById('p-contrats'); if (p && p.classList.contains('collapsed')) p.querySelector('.panel-h h2.fold').click(); });
      const ctr = await texte('#p-contrats');
      for (const [lib] of attendu.ech.filter(e => e[1] === sc)) assert.ok(ctr.includes(lib), 'échéance ' + sc + ' ' + lib);
    }
    await page.locator('#ah-back').click(); await B.pause(200);
    const bc = await texte('#ap-haut');
    assert.ok(bc.includes(norm(attendu.fdmC[0])), 'Nous › solde du commun ' + attendu.fdmC[0]);
    assert.ok(bc.includes(norm(attendu.fdm[1])), 'Nous › fin de mois ' + attendu.fdm[1]);
    assert.deepEqual(B.erreurs, []);
  } finally { await B.fin(); }
});

for (const palette of ['klad', 'grafit']) {
  test('accessibilité des écrans principaux : palette ' + palette + ', clair et sombre', { skip: SAUT }, async () => {
    const B = await ouvrir({ palette });
    try {
      for (const theme of ['clair', 'sombre']) {
        await B.theme(theme);
        const t = { petits: 0, contrastes: 0, police: 99, detail: [] };
        await B.ecransPrincipaux(async (nom, sel) => {
          const r = await B.page.evaluate(auditer, { portee: sel, detail: true });
          t.petits += r.petits; t.contrastes += r.contrastes; t.police = Math.min(t.police, r.police);
          if (r.contrastes) t.detail.push(nom + ' : ' + r.listeContrastes.map(d => d.texte + ' ' + d.ratio).join(', '));
          if (r.petits) t.detail.push(nom + ' : ' + r.listePetits.join(', '));
        });
        const msg = palette + ' ' + theme + ' : ' + t.detail.join(' | ');
        assert.ok(t.petits <= SEUILS.petits, 'contrôles de moins de 48 dp : ' + t.petits + ' — ' + msg);
        assert.ok(t.contrastes <= SEUILS.contrastes, 'textes sous le seuil AA : ' + t.contrastes + ' — ' + msg);
        assert.ok(t.police >= SEUILS.police, 'police de ' + t.police + ' px');
      }
      if (palette === 'grafit') assert.equal(await B.page.evaluate(() => document.documentElement.dataset.palette), 'grafit');
      assert.deepEqual(B.erreurs, []);
    } finally { await B.fin(); }
  });
}
