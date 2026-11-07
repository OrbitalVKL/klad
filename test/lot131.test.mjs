// Tests du correctif 1.3.1 : carte « Provisions en cours » du commun (plus de « [object Object] »), sous-vue « Plan »
// retirée (détail par poste sous « Virements à mettre en place »), garde-fou général : aucun « [object Object] »,
// « undefined », « NaN » ou « null » à l'écran (textes, infobulles, libellés d'accessibilité, valeurs des champs),
// sur tous les écrans et volets, jeux « mesures » et « personnel », mode démo compris.
// La partie Chromium est sautée si Playwright n'est pas installé, sauf avec KLAD_PARCOURS=obligatoire.
// Données fictives uniquement.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { charge } from './charge.mjs';
import { ouvrir, playwright } from '../tools/mesures/banc.mjs';
import { reprisePersonnelle } from '../tools/mesures/donnees.mjs';
import { completer, parcoursComplet } from './demo-outils.mjs';

const PW = playwright();
const SAUT = !PW && !process.env.KLAD_PARCOURS && 'Playwright absent';
const lire = f => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const NOW = Date.parse('2026-11-06T10:00:00Z');
const texte = h => h.replace(/<[a-z\/][^>]*>/g, ' ').replace(/&#39;/g, '\'').replace(/&amp;/g, '&').replace(/[\u00a0\u202f]/g, ' ').replace(/\s+/g, ' ');

test('commun : carte « Provisions en cours » avec les postes et leurs montants (plus de « [object Object] »)', () => {
  const { KladModele: M, KladVues: Vu } = charge(['anon.js', 'eb.js', 'format.js', 'modele.js', 'icones-donnees.js', 'icones.js', 'classement.js', 'ui.js', 'vues.js']);
  const S = M.vide();
  M.nouveauCompte(S, { libelle: 'Commun', role: 'commun', solde: { centimes: 120000, date: '2026-11-05' } });
  const fdm = { solde: 120000, due: 40000, inc: 30000, end: 90000, reserve: 29000,
    reserveDet: [{ label: 'Charges de copropriété', montant: 25000 }, { label: 'Charges parking', montant: 4000 }], aVenir: [] };
  const h = Vu.rangee(S, 'commun', NOW, { fdm }), t = texte(h);
  assert.doesNotMatch(h, /object Object|undefined|NaN/);
  assert.match(t, /Provisions en cours 290,00 € mis de côté : Copropriété 250,00 €, Parking 40,00 €/);
  assert.match(t, /− provisions en cours 290,00 €/);
  assert.doesNotMatch(t, /Réserve pour échéances/i, 'plus de confusion avec la réserve fixe');
  // liste vide ou incomplète : rien d'illisible
  const h2 = Vu.rangee(S, 'commun', NOW, { fdm: Object.assign({}, fdm, { reserveDet: [null, { montant: 1000 }] }) });
  assert.doesNotMatch(h2, /object Object|undefined|NaN|null/);
});

test('commun : plus de sous-vue « Plan », détail par poste dans « Virements à mettre en place »', () => {
  const eb = lire('www/ecranbudget.js'), ix = lire('www/index.html'), vc = lire('www/vcommun.js');
  assert.doesNotMatch(eb, /\['plan', 'Plan'\]/, 'sous-vue Plan retirée');
  assert.doesNotMatch(ix, /id="cm-planp"/, 'section du plan retirée');
  assert.doesNotMatch(vc, /function planPostes/, 'vue du plan retirée');
  assert.match(vc, /Détail par poste/);
  // une sous-vue mémorisée qui n'existe plus retombe sur « Ce mois »
  assert.match(eb, /!SOUSVUES\[scope\]\.some\(\(\[k\]\) => k === ui\.sv\[scope\]\)/);
});

// Relevé des textes illisibles dans tout le DOM : textes (y compris cachés), infobulles, aria-label, placeholder,
// valeurs des champs → [{ ou, extrait }].
async function illisibles(page) {
  return page.evaluate(() => {
    const MAUVAIS = /\[object Object\]|\bundefined\b|\bNaN\b|\bnull\b/;
    const out = [];
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      const p = n.parentNode;
      if (p && (p.nodeName === 'STYLE' || p.nodeName === 'SCRIPT' || p.nodeName === 'TEMPLATE')) continue;
      if (MAUVAIS.test(n.nodeValue)) out.push({ ou: 'texte <' + (p ? p.nodeName.toLowerCase() + (p.id ? '#' + p.id : '') + (p.className && typeof p.className === 'string' ? '.' + p.className.split(' ')[0] : '') : '?') + '>', extrait: n.nodeValue.trim().slice(0, 120) });
    }
    for (const e of document.querySelectorAll('[aria-label],[title],[placeholder]')) for (const a of ['aria-label', 'title', 'placeholder']) {
      const v = e.getAttribute(a);
      if (v && MAUVAIS.test(v)) out.push({ ou: a + ' <' + e.nodeName.toLowerCase() + (e.id ? '#' + e.id : '') + '>', extrait: v.slice(0, 120) });
    }
    for (const i of document.querySelectorAll('input, textarea')) if (i.value && MAUVAIS.test(i.value)) out.push({ ou: 'champ #' + (i.id || i.name || i.className), extrait: i.value.slice(0, 120) });
    return out;
  });
}

async function parcourir(B, nomJeu, demo) {
  const defauts = [];
  let n = 0;
  const f = async nom => {
    n++;
    await B.pause(100);
    for (const x of await illisibles(B.page)) defauts.push(nomJeu + (demo ? ' (démo)' : '') + ' › ' + nom + ' › ' + x.ou + ' : « ' + x.extrait + ' »');
  };
  await parcoursComplet(B, f);
  return { defauts, n };
}

test('garde-fou : aucun « [object Object] », « undefined », « NaN » ni « null » à l\'écran (jeu « mesures »)', { skip: SAUT, timeout: 900000 }, async () => {
  const B = await ouvrir();
  try {
    const { defauts, n } = await parcourir(B, 'mesures', false);
    assert.ok(n > 30, n + ' écrans relevés');
    assert.deepEqual([...new Set(defauts)], []);
    assert.deepEqual(B.erreurs, [], 'aucune erreur JavaScript');
  } finally { await B.fin(); }
});

test('garde-fou : aucun texte illisible, jeu « personnel », hors et en mode démo', { skip: SAUT, timeout: 1500000 }, async () => {
  const B = await ouvrir({ reprise: reprisePersonnelle });
  try {
    const { page } = B;
    await completer(page);
    await B.pause(600);
    const a = await parcourir(B, 'personnel', false);
    assert.ok(a.n > 30, a.n + ' écrans relevés');
    for (let i = 0; i < 3; i++) await page.locator('#ver').click();
    await B.pause(300);
    assert.equal(await page.evaluate(() => window.KladAffichage.demoActif()), true, 'mode démo activé');
    const b = await parcourir(B, 'personnel', true);
    assert.deepEqual([...new Set(a.defauts.concat(b.defauts))], []);
    assert.deepEqual(B.erreurs, [], 'aucune erreur JavaScript');
  } finally { await B.fin(); }
});
