// Tests : une seule icône (К rouge sur noir, couleurs de Grafit) partout — ressources Android, logo de l'appli et du
// site —, dessin dans la zone sûre de l'icône adaptative, aucun changement d'identifiant d'appli.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { read } from './charge.mjs';
import { K, NOIR, ROUGE } from '../scripts/icone.mjs';

const RES = 'android/app/src/main/res/';

test('icône : même tracé du К dans les ressources Android, le logo de l\'appli et le site', () => {
  assert.ok(read(RES + 'drawable-v24/ic_launcher_foreground.xml').includes('android:pathData="' + K + '"'));
  assert.ok(read(RES + 'drawable-v24/ic_launcher_foreground.xml').includes('android:fillColor="' + ROUGE + '"'));
  assert.ok(read(RES + 'drawable/ic_launcher_monochrome.xml').includes('android:pathData="' + K + '"'));
  assert.ok(read(RES + 'drawable/ic_launcher_background.xml').includes('android:fillColor="' + NOIR + '"'));
  assert.ok(read(RES + 'values/ic_launcher_background.xml').includes(NOIR));
  for (const f of ['mipmap-anydpi-v26/ic_launcher.xml', 'mipmap-anydpi-v26/ic_launcher_round.xml']) {
    const x = read(RES + f);
    for (const p of ['@drawable/ic_launcher_background', '@drawable/ic_launcher_foreground', '@drawable/ic_launcher_monochrome']) assert.ok(x.includes(p), f + ' ' + p);
  }
  for (const f of ['www/verrou.js', 'www/index.html', 'site/index.html', 'site/retour.html']) {
    const s = read(f);
    assert.ok(s.includes('d="' + K + '"'), f);
    assert.ok(!/F3CB6B|1E3A5C/i.test(s.replace(/--hero-bg:#1e3a5c/g, '')), f + ' : ancienne icône');
  }
  for (const f of ['site/index.html', 'site/retour.html']) assert.ok(read(f).includes('<link rel="icon" href="data:image/svg+xml,'), f);
});

test('icône : dessin dans la zone sûre (cercle de rayon 33 dp au centre du cadre de 108 dp)', () => {
  const pts = [];
  let x = 0, y = 0;                                    // point courant (les commandes H et V n'en donnent qu'une coordonnée)
  for (const [, c, a] of K.matchAll(/([MHVLCA])([^MHVLCAZ]*)/g)) {
    const n = a.split(/[ ,]+/).filter(Boolean).map(Number);
    if (c === 'H') x = n[0];
    else if (c === 'V') y = n[0];
    else if (c === 'A') { pts.push([n[5], n[6] - n[0]], [n[5], n[6] + n[0]], [n[5] - n[0], n[6]], [n[5] + n[0], n[6]]); [x, y] = [n[5], n[6]]; continue; }
    else for (let i = 0; i < n.length; i += 2) { [x, y] = [n[i], n[i + 1]]; if (i + 2 < n.length) pts.push([x, y]); }
    pts.push([x, y]);
  }
  assert.ok(pts.length > 25);
  for (const [x, y] of pts) assert.ok(Math.hypot(x - 54, y - 54) <= 33, x + ',' + y);
});
