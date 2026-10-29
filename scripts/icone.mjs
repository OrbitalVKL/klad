// Klad — icône : К cyrillique à empattements, rouge sur noir (couleurs de Grafit). Source unique du dessin.
// node scripts/icone.mjs : régénère les ressources Android (avant-plan, fond, monochrome, PNG par densité, écran de
// démarrage). Les PNG sont rendus par Chromium (Playwright, outil de développement, hors fabrication de l'APK).
// Le même tracé est repris tel quel par le logo de l'appli (verrou, masque) et du site ; test/icone.test.mjs le vérifie.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

export const NOIR = '#0A0C0E', ROUGE = '#9E4A4A';     // fond et rouge de l'icône de Grafit

// Dessin dans le cadre 108 × 108 de l'icône adaptative, centré en 54,54.
const BRUT = [
  'M38,31H47V77H38Z',                                                          // fût
  'M33,29H52V32.6H33Z',                                                        // empattement haut
  'M33,75.4H52V79H33Z',                                                        // empattement bas
  'M47,50.2C54.5,47.6 60,42.2 63.2,34.6L67.6,36.2C64.4,44.6 57.6,51.4 47,56.4Z', // bras courbe (délié)
  'M66.2,30.6A4.4,4.4 0 1 1 66.19,30.6Z',                                      // goutte au bout du bras
  'M49.2,54.2L55.6,49.8L77,77H67.4Z',                                          // jambe (plein)
  'M63,75.4H80V79H63Z'                                                         // empattement de la jambe
];
const ECHELLE = 0.88;   // le dessin tient dans la zone sûre de 66 dp (cercle de rayon 33)

// Réduction autour du centre ; commandes M, H, V, L, C, A (rayons réduits, drapeaux gardés), Z.
function reduire(d, k) {
  const x = v => +(54 + (v - 54) * k).toFixed(2), y = x, r = v => +(v * k).toFixed(2);
  return d.replace(/([MHVLCAZ])([^MHVLCAZ]*)/g, (_, c, args) => {
    const n = args.split(/[ ,]+/).filter(Boolean).map(Number);
    if (c === 'Z') return 'Z';
    if (c === 'H') return 'H' + x(n[0]);
    if (c === 'V') return 'V' + y(n[0]);
    if (c === 'A') return 'A' + r(n[0]) + ',' + r(n[1]) + ' ' + n[2] + ' ' + n[3] + ' ' + n[4] + ' ' + x(n[5]) + ',' + y(n[6]);
    const out = [];
    for (let i = 0; i < n.length; i += 2) out.push(x(n[i]) + ',' + y(n[i + 1]));
    return c + out.join(' ');
  });
}
export const K = BRUT.map(p => reduire(p, ECHELLE)).join('');

// SVG du logo (cadre visible de l'icône : 18 → 90), pour l'appli et le site.
export const logoSvg = attrs => `<svg viewBox="18 18 72 72"${attrs || ''}><rect x="18" y="18" width="72" height="72" fill="${NOIR}"/><path fill="${ROUGE}" d="${K}"/></svg>`;

const vecteur = (commentaire, couleur, d) => `<?xml version="1.0" encoding="utf-8"?>
<!-- ${commentaire} Généré par scripts/icone.mjs. -->
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <path
        android:fillColor="${couleur}"
        android:pathData="${d}" />
</vector>
`;

async function generer() {
  const RES = fileURLToPath(new URL('../android/app/src/main/res/', import.meta.url));
  const ecrire = (f, t) => fs.writeFileSync(RES + f, t);
  ecrire('drawable-v24/ic_launcher_foreground.xml', vecteur('Avant-plan de l\'icône adaptative : К cyrillique rouge, dans la zone sûre de 66 dp.', ROUGE, K));
  ecrire('drawable/ic_launcher_background.xml', vecteur('Fond de l\'icône adaptative : noir de Grafit.', NOIR, 'M0,0h108v108h-108z'));
  ecrire('drawable/ic_launcher_monochrome.xml', vecteur('Icône monochrome (icônes à thème d\'Android 13 et plus) : le К seul, teinté par le système.', '#FFFFFFFF', K));
  ecrire('values/ic_launcher_background.xml', `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${NOIR}</color>\n</resources>\n`);

  let pw;
  try { pw = createRequire(import.meta.url)('playwright'); } catch (e) { pw = createRequire('/usr/local/lib/node_modules_global/')('playwright'); }
  const nav = await pw.chromium.launch();
  const page = await nav.newPage();
  const rendre = async (fichier, w, h, html) => {
    await page.setViewportSize({ width: w, height: h });
    await page.setContent('<html><body style="margin:0;background:transparent">' + html + '</body></html>');
    await page.screenshot({ path: RES + fichier, omitBackground: true, clip: { x: 0, y: 0, width: w, height: h } });
  };
  const plein = (t, d, forme) => `<svg width="${t}" height="${t}" viewBox="18 18 72 72" style="display:block"><defs><clipPath id="c">${forme}</clipPath></defs>` +
    `<g clip-path="url(#c)"><rect x="0" y="0" width="108" height="108" fill="${NOIR}"/><path fill="${ROUGE}" d="${d}"/></g></svg>`;
  const DENS = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
  for (const [n, f] of Object.entries(DENS)) {
    const t = Math.round(48 * f), a = Math.round(108 * f);
    await rendre('mipmap-' + n + '/ic_launcher.png', t, t, plein(t, K, '<rect x="18" y="18" width="72" height="72" rx="13"/>'));
    await rendre('mipmap-' + n + '/ic_launcher_round.png', t, t, plein(t, K, '<circle cx="54" cy="54" r="36"/>'));
    await rendre('mipmap-' + n + '/ic_launcher_foreground.png', a, a, `<svg width="${a}" height="${a}" viewBox="0 0 108 108" style="display:block"><path fill="${ROUGE}" d="${K}"/></svg>`);
  }
  // écran de démarrage : К centré sur le noir, haut d'un quart du petit côté (le К fait 44 unités sur 108)
  const ecran = (w, h) => { const s = Math.min(w, h) * 0.25 * 108 / 44; return `<div style="width:${w}px;height:${h}px;background:${NOIR};display:grid;place-items:center">` +
    `<svg width="${s}" height="${s}" viewBox="0 0 108 108"><path fill="${ROUGE}" d="${K}"/></svg></div>`; };
  for (const dir of fs.readdirSync(RES).filter(d => /^drawable/.test(d) && fs.existsSync(RES + d + '/splash.png'))) {
    const { w, h } = taillePng(RES + dir + '/splash.png');
    await rendre(dir + '/splash.png', w, h, ecran(w, h));
  }
  await nav.close();
}

function taillePng(f) { const b = fs.readFileSync(f); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }; }

if (process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) {
  await generer();
  console.log('Icône régénérée (ressources Android).');
}
