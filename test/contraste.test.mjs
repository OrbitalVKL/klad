// Contrastes des jetons de couleur (UX-1) : les deux palettes (Klad, Grafit), en clair et en sombre, respectent WCAG AA
// (4,5:1) pour chaque couple texte / fond utilisé par l'interface, y compris les fonds teintés des sections du budget.
// Lit le bloc « jetons » de www/style.css ; les deux écritures du thème sombre (réglage du téléphone, choix « Sombre »)
// doivent être identiques.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const CSS = fs.readFileSync(new URL('../www/style.css', import.meta.url), 'utf8');

// → { nom: [déclarations de chaque bloc { … } jusqu'au marqueur suivant] }
function jetons() {
  const out = {};
  const parts = CSS.split(/\/\* jetons:([a-z-]+) \*\//);
  for (let i = 1; i < parts.length; i += 2) {
    if (parts[i] === 'fin') continue;
    const blocs = [...parts[i + 1].matchAll(/\{([^{}]*--[^{}]*)\}/g)].map(m => {
      const o = {};
      for (const d of m[1].matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/g)) o[d[1]] = d[2].trim();
      return o;
    });
    out[parts[i]] = blocs;
  }
  return out;
}
const hex = h => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const melange = (a, p, b) => a.map((v, i) => Math.round(v * p + b[i] * (1 - p)));

// Couples texte / fond de l'interface.
const COUPLES = {
  ink: ['bg', 'surface', 'surface-2', 'accent-soft'], 'ink-2': ['bg', 'surface', 'surface-2'], muted: ['bg', 'surface', 'surface-2'],
  accent: ['bg', 'surface', 'surface-2', 'accent-soft'], 'accent-ink': ['accent'],
  good: ['bg', 'surface', 'surface-2', 'good-soft'], bad: ['bg', 'surface', 'surface-2', 'bad-soft'], warn: ['surface', 'surface-2', 'warn-soft'],
  hb: ['surface', 'hb-soft'], 'hero-ink': ['hero-bg'], 'badge-ink': ['badge-bg'], 'tab-on': ['surface'], 'good-ink': ['good'], bg: ['ink']
};

test('jetons : quatre combinaisons complètes, sombre écrit deux fois à l\'identique', () => {
  const J = jetons();
  assert.deepEqual(Object.keys(J).sort(), ['grafit-clair', 'grafit-sombre', 'klad-clair', 'klad-sombre']);
  for (const n of ['klad-sombre', 'grafit-sombre']) { assert.equal(J[n].length, 2, n); assert.deepEqual(J[n][0], J[n][1], n); }
  const cles = Object.keys(J['klad-clair'][0]).filter(k => k !== 'pline').sort();
  for (const n of Object.keys(J)) assert.deepEqual(Object.keys(J[n][0]).filter(k => k !== 'pline').sort(), cles, n);
});

for (const nom of ['klad-clair', 'klad-sombre', 'grafit-clair', 'grafit-sombre']) {
  test('contrastes AA : palette ' + nom, () => {
    const P = jetons()[nom][0];
    const defauts = [];
    for (const [t, fonds] of Object.entries(COUPLES)) for (const f of fonds) {
      const r = ratio(hex(P[t]), hex(P[f]));
      if (r < 4.5) defauts.push(t + ' sur ' + f + ' : ' + r.toFixed(2));
    }
    // fonds teintés des sections du budget (charges fixes, courantes, optionnelles)
    const tint = parseFloat(P.tint) / 100;
    for (const s of ['nfix', 'cour', 'nopt']) {
      const fond = melange(hex(P[s]), tint, hex(P.surface));
      for (const t of ['ink', 'ink-2', 'muted', 'good', 'bad', 'warn']) { const r = ratio(hex(P[t]), fond); if (r < 4.5) defauts.push(t + ' sur teinte ' + s + ' : ' + r.toFixed(2)); }
    }
    assert.deepEqual(defauts, []);
  });
}

test('palette et thème appliqués avant la feuille de style (pas de flash)', () => {
  const tete = fs.readFileSync(new URL('../www/index.html', import.meta.url), 'utf8').split('</head>')[0];
  assert.match(tete, /<script src="theme\.js"><\/script>\s*<link rel="stylesheet" href="style\.css">/);
  const js = fs.readFileSync(new URL('../www/theme.js', import.meta.url), 'utf8');
  assert.match(js, /klad\.palette[\s\S]*data-palette/);
});
