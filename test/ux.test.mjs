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
    await B.onglet(B.onglets[0]);
    const attendu = await page.evaluate(() => {
      const A = window.KladApp, KB = window.KladBudget, F = window.KladFormat, M = window.KladModele, S = A.etat(), Bc = A.budget();
      const rav = KB.suivi(Bc, 'perso', null).rav;
      const soldes = M.comptesTries(S).filter(c => !c.masque).map(c => { const s = M.soldeAffiche(S, c); return s ? [c.libelle, F.montant(Math.abs(s.centimes))] : null; }).filter(Boolean);
      const ech = KB.echeances(Bc, 31).map(e => [e.label, e.scope]);
      return { rav: [F.montant(Math.abs(rav.budget.reste)), rav.comptes ? F.montant(Math.abs(rav.comptes.reste)) : null], soldes, ech };
    });
    const norm = t => t.replace(/[\s  ]+/g, ' ');
    const rav = norm(await page.locator('[data-mesure="rav"], #rav-m').first().innerText());
    for (const v of attendu.rav.filter(Boolean)) assert.ok(rav.includes(norm(v).replace(/,00 €$/, ' €')) || rav.includes(norm(v)), 'reste à vivre ' + v + ' dans « ' + rav + ' »');
    const sold = norm(await page.locator('[data-mesure="soldes"], #bal-panel').first().innerText());
    for (const [lib, v] of attendu.soldes) { assert.ok(sold.includes(lib), lib); assert.ok(sold.includes(norm(v)), 'solde ' + lib + ' ' + v); }
    // échéances des 31 jours : celles de Budget › Contrats (perso) et Commun › Contrats
    assert.ok(attendu.ech.length > 0, 'échéances attendues dans le jeu fictif');
    for (const sc of ['perso', 'commun']) {
      await B.onglet(sc === 'perso' ? 'budget' : 'commun');
      await page.evaluate(() => { const p = document.getElementById('p-contrats'); if (p && p.classList.contains('collapsed')) p.querySelector('.panel-h h2.fold').click(); });
      const ctr = norm(await page.locator('#p-contrats').innerText());
      for (const [lib] of attendu.ech.filter(e => e[1] === sc)) assert.ok(ctr.includes(lib), 'échéance ' + sc + ' ' + lib);
    }
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
