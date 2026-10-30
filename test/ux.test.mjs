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
      return { rav: [F.montant(Math.abs(rav.budget.reste)), F.montant(Math.abs(rav.comptes.reste))], soldes, ech, fdm: [F.montant(Math.abs(fdm.solde)), F.montant(Math.abs(fdm.end))], postes };
    });
    // Accueil
    await B.onglet('accueil');
    const rav = await texte('[data-mesure="rav"]');
    for (const v of attendu.rav) assert.ok(rav.includes(norm(v)), 'reste à vivre ' + v + ' dans « ' + rav + ' »');
    const sold = await texte('[data-mesure="soldes"]');
    for (const [lib, v] of attendu.soldes) { assert.ok(sold.includes(lib), lib); assert.ok(sold.includes(norm(v)), 'solde ' + lib + ' ' + v); }
    const cyc = await texte('#ac-cy + *, section[aria-labelledby="ac-cy"]');
    const vus = attendu.postes.filter(([lib]) => cyc.includes(lib));
    assert.ok(vus.length >= 1, 'postes du cycle sur l\'accueil');
    for (const [lib, cur, pm] of vus) assert.ok(cyc.includes(lib + ' ' + norm(cur) + ' / ' + norm(pm)), 'poste ' + lib);
    const cm = await texte('section[aria-labelledby="ac-cm"]');
    for (const v of attendu.fdm) assert.ok(cm.includes(norm(v)), 'commun ' + v);
    const ec = await texte('section[aria-labelledby="ac-ec"]');
    const premieres = attendu.ech.filter(([lib]) => ec.includes(lib));
    assert.ok(premieres.length >= Math.min(4, attendu.ech.length), 'échéances sur l\'accueil');
    for (const [lib, , v] of premieres) assert.ok(ec.includes(lib) && ec.includes(norm(v)), 'échéance ' + lib);
    // Écrans d'origine : reste à vivre de Budget, postes du budget, fin de mois et solde de Commun, contrats
    await B.onglet('budget');
    const rb = await texte('#rav-m');
    for (const v of attendu.rav) assert.ok(rb.includes(norm(v)), 'Budget › reste à vivre ' + v);
    for (let i = 0; i < 6; i++) { const b = page.locator('#budget-main .sec-tog[aria-expanded="false"]').first(); if (!(await b.count())) break; await b.click(); }
    const bm = await texte('#budget-main');
    for (const [lib] of vus) assert.ok(bm.includes(lib), 'Budget › poste ' + lib);
    for (const sc of ['perso', 'commun']) {
      await B.onglet(sc === 'perso' ? 'budget' : 'commun');
      await page.evaluate(() => { const p = document.getElementById('p-contrats'); if (p && p.classList.contains('collapsed')) p.querySelector('.panel-h h2.fold').click(); });
      const ctr = await texte('#p-contrats');
      for (const [lib] of attendu.ech.filter(e => e[1] === sc)) assert.ok(ctr.includes(lib), 'échéance ' + sc + ' ' + lib);
    }
    const bc = await texte('#bal-panel');
    for (const v of attendu.fdm) assert.ok(bc.includes(norm(v)), 'Commun › fin de mois ' + v);
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
