// Tests du correctif 1.3.3 : Tendance repliable dans Commun › Trésorerie (seulement forcée ouverte quand elle est seule,
// Budget › Tendance) ; sous-sections repliables des contrats (liste, prévu du poste, échéances ; état gardé sur ce
// téléphone) ; « Confirmer ? » du journal en rouge. La partie Chromium est sautée si Playwright n'est pas installé, sauf
// avec KLAD_PARCOURS=obligatoire. Données fictives uniquement.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { outils, etatDepuisReprise } from './jeux.mjs';
import { repriseFictive } from './fictif.mjs';
import { ouvrir, playwright } from '../tools/mesures/banc.mjs';

const PW = playwright();
const SAUT = !PW && !process.env.KLAD_PARCOURS && 'Playwright absent';
const lire = f => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const FIN = '2026-10-28', NOW = Date.parse(FIN + 'T10:00:00Z');

test('contrats : trois sous-sections repliables, ouvertes par défaut, état d\'après les plis ; liste ouverte en modification', async () => {
  const X = outils(['ui.js', 'vues.js', 'vbudget.js']);
  const { KladClasse: K, KladBudget: KB, KladVuesBudget: VB, KladUI: U } = X;
  const S = await etatDepuisReprise(X, repriseFictive(FIN), NOW);
  const B = KB.contexte(S, NOW, K.contexte(S, NOW));
  for (const sc of ['commun', 'perso']) {
    const h = VB.contrats(B, sc, null);
    const ids = [...h.matchAll(/<details class="ctr-sub" data-pli="([^"]+)"( open)?>/g)].map(m => [m[1], !!m[2]]);
    assert.deepEqual(ids, [['p-contrats-' + sc + '-liste', true], ['p-contrats-' + sc + '-postes', true], ['p-contrats-' + sc + '-echeances', true]].filter(x => x[0].endsWith('postes') ? /Prévu du poste/.test(h) : true), sc);
    assert.match(h, /<summary><h3 class="obs-h3">Contrats<\/h3><span class="subs">\d+ contrats?/);
    assert.match(h, /<summary><h3 class="obs-h3">Échéances des 31 prochains jours<\/h3>/);
  }
  // repliée sur ce téléphone : rendue fermée ; en modification, la liste reste ouverte
  U.plier('p-contrats-commun-liste', true);
  U.plier('p-contrats-commun-echeances', true);
  try {
    const h = VB.contrats(B, 'commun', null);
    assert.match(h, /data-pli="p-contrats-commun-liste">/);
    assert.match(h, /data-pli="p-contrats-commun-echeances">/);
    assert.match(VB.contrats(B, 'commun', 'liste'), /data-pli="p-contrats-commun-liste" open>/);
  } finally { U.plier('p-contrats-commun-liste', false); U.plier('p-contrats-commun-echeances', false); }
});

test('Tendance et Contrats forcés ouverts seulement quand ils sont seuls (Budget › Tendance, Budget › Contrats) ; journal en rouge', () => {
  const eb = lire('www/ecranbudget.js'), app = lire('www/app.js');
  assert.match(eb, /const seule = scope === 'perso' \? \{ tendance: 'tend-panel', contrats: 'p-contrats' \}\[sv\] : null;/);
  assert.match(eb, /p\.classList\.toggle\('force-open', id === seule\)/);
  assert.match(eb, /addEventListener\('toggle'[\s\S]{0,120}details\[data-pli\][\s\S]{0,80}U\.plier\(d\.dataset\.pli, !d\.open\)/);
  const i = app.indexOf("$('btnClearLog').addEventListener"), bloc = app.slice(i, i + 700);
  assert.match(bloc, /confirmInline\(b, 'Confirmer \?'\)\) \{ b\.classList\.add\('danger'\)/);
});

test('Chromium : Tendance repliable dans Commun › Trésorerie, sous-sections des contrats gardées, Budget › Tendance ouverte', { skip: SAUT, timeout: 600000 }, async () => {
  const B = await ouvrir();
  const { page } = B;
  try {
    await B.onglet('commun');
    await page.locator('[data-sousvue="tresorerie"]:visible').first().click(); await B.pause(400);
    await page.locator('#tend-panel h2.fold').first().click(); await B.pause(300);
    assert.equal(await page.evaluate(() => document.getElementById('tend-panel').classList.contains('collapsed')), true, 'Tendance repliée');
    const n = await page.locator('#p-contrats details.ctr-sub').count();
    assert.ok(n >= 2, n + ' sous-sections');
    await page.locator('#p-contrats details.ctr-sub > summary').first().click(); await B.pause(200);
    await page.locator('[data-sousvue="mois"]:visible').first().click(); await B.pause(300);
    await page.locator('[data-sousvue="tresorerie"]:visible').first().click(); await B.pause(300);
    assert.deepEqual(await page.$$eval('#p-contrats details.ctr-sub', ds => ds.map(d => d.open)).then(o => o[0]), false, 'liste toujours repliée au retour');
    assert.equal(await page.evaluate(() => document.getElementById('tend-panel').classList.contains('collapsed')), true, 'Tendance toujours repliée');
    // Budget › Tendance : seule, jamais repliée
    await B.onglet('budget');
    await page.locator('[data-sousvue="tendance"]:visible').first().click(); await B.pause(300);
    assert.equal(await page.evaluate(() => document.getElementById('tend-panel').classList.contains('collapsed')), false);
    // résumé des sous-sections : cible d'au moins 48 px
    await B.onglet('commun');
    await page.locator('[data-sousvue="tresorerie"]:visible').first().click(); await B.pause(300);
    const hs = await page.$$eval('#p-contrats details.ctr-sub > summary', ss => ss.map(s => s.getBoundingClientRect().height));
    assert.ok(hs.every(h => h >= 47.5), JSON.stringify(hs));
    assert.deepEqual(B.erreurs, [], 'aucune erreur JavaScript');
  } finally { await B.fin(); }
});

// Virement reçu sur le commun écarté des propositions (ici classé « déblocage » dans l'équilibre ; même chose pour un
// virement interne) puis affecté à la main : le choix compte, et le détail le dit (plus de « Confirmer » qui ne fait rien).
test('affectation à la main d\'un virement écarté des propositions : comptée ; détail clair (état, effet, proposition)', async () => {
  const X = outils(['ui.js', 'vues.js', 'vbudget.js', 'vcommun.js']);
  const { KladClasse: K, KladBudget: KB, KladCommun: KC, KladVues: Vu } = X;
  const r = repriseFictive(FIN);
  r.carnet.klad.equilibre.regles.unshift(['DEBLOCAGE', 'dp', 'credit']);
  r.transactions.push({ account: 'r2', date: '2026-10-20', amount: 10000, label: 'VIR COMPTE PERSO DEBLOCAGE FICTIF', status: 'comptabilisee' });
  r.transactions.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  const S = await etatDepuisReprise(X, r, NOW);
  const ctx = () => KB.contexte(S, NOW, K.contexte(S, NOW));
  const c = S.modele.comptes.find(x => x.role === 'commun'), o = S.ops[c.id].find(x => x.montant === 10000 && x.date === '2026-10-20');
  let B = ctx();
  assert.ok(!KC.ponctuels(B).some(x => x.r.id === o.id), 'pas proposé');
  let h = Vu.detail(S, o, K.contexte(S, NOW), B);
  assert.match(h, /Affectation de ce virement[\s\S]*Pas encore affecté\.[\s\S]*Proposition : Avance au commun \(renflouement\)/);
  assert.match(h, /data-k="proposee"[^>]*>Accepter la proposition</);
  assert.equal(KC.propositionOp(B, o.id).k, 'avance', 'la proposition existe même hors liste');
  // affecté « Avance au commun » à la main : compté dans les avances et l'équilibre
  KC.affecter(o, KC.propositionOp(B, o.id));
  B = ctx();
  const A = KC.avances(B);
  assert.ok(A.lignes.some(l => l.r.id === o.id && l.faveur === 5000), 'moitié en faveur de celui qui avance');
  h = Vu.detail(S, o, K.contexte(S, NOW), B);
  assert.match(h, /Affecté : Avance au commun \(renflouement\)/);
  assert.match(h, /50,00\s€ comptés en faveur de Personne A dans l(?:'|&#39;)équilibre/);
  assert.doesNotMatch(h, /data-k="proposee"/, 'plus de bouton de proposition une fois affecté');
  assert.match(h, /Changer l'affectation :/);
  // une carte par choix : bouton (choix actuel coché), effet, champ du choix dans la même carte ; pastille « affecté »
  assert.match(h, /<div class="cm-ch on"><button type="button" class="cm-ch-b" data-a="affecter" data-k="avance" aria-pressed="true">[\s\S]*?<\/button><div class="cm-ch-f"><label class="ctl" for="cmPour">/);
  assert.match(h, /data-k="impots" aria-pressed="false">[\s\S]*?<\/button><div class="cm-ch-f"><label class="ctl" for="cmAn">/);
  assert.match(h, /data-k="autre" aria-pressed="false">[\s\S]*?<\/button><div class="cm-ch-f"><label class="ctl" for="cmTxt">/);
  assert.match(h, /tx-tag st-ok[^>]*><span class="st-dot" aria-hidden="true"><\/span>imprévu · affecté/);
  // Réserve : pas d'effet propre, l'équilibre garde le classement d'origine (dit en clair)
  KC.affecter(o, { k: 'reserve' });
  h = Vu.detail(S, o, K.contexte(S, NOW), ctx());
  assert.match(h, /Affecté : Réserve[\s\S]*comme son classement d(?:'|&#39;)origine \(déblocage de prêt, non compté\)/);
});

test('« Autre » : effet choisi dans l\'équilibre (classement d\'origine, hors équilibre, en faveur de l\'un, en entier ou pour moitié)', async () => {
  const X = outils(['ui.js', 'vues.js', 'vbudget.js', 'vcommun.js']);
  const { KladClasse: K, KladBudget: KB, KladCommun: KC, KladVues: Vu } = X;
  const r = repriseFictive(FIN);
  r.transactions.push({ account: 'r2', date: '2026-10-21', amount: 12000, label: 'VIR PERSONNE A DIVERS FICTIF', status: 'comptabilisee' });
  r.transactions.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  const S = await etatDepuisReprise(X, r, NOW);
  const ctx = () => KB.contexte(S, NOW, K.contexte(S, NOW));
  const c = S.modele.comptes.find(x => x.role === 'commun'), o = S.ops[c.id].find(x => x.montant === 12000 && x.date === '2026-10-21');
  const E0 = KC.equilibre(ctx());
  // classement d'origine : versement de Personne A, compté en entier (même résultat sans affectation)
  KC.affecter(o, { k: 'autre', txt: 'divers' });
  let B = ctx(), E = KC.equilibre(B);
  assert.equal(E.invMoi, E0.invMoi);
  assert.equal(KC.origineEq(B, { date: o.date, m: o.montant }), 'versement de Personne A, compté en entier');
  let h = Vu.detail(S, o, K.contexte(S, NOW), B);
  assert.match(h, /data-k="autre" aria-pressed="true">[\s\S]*?<label class="ctl cm-eq" for="cmEq">dans l(?:'|&#39;)équilibre <select id="cmEq"><option value="" selected>comme son classement d(?:'|&#39;)origine \(versement de Personne A, compté en entier\)/);
  // hors équilibre : le versement ne compte plus
  KC.affecter(o, { k: 'autre', txt: 'divers', eq: 'hors' });
  E = KC.equilibre(ctx());
  assert.equal(E.invMoi, E0.invMoi - 12000);
  assert.ok(E.hors.some(x => x.montant === 12000 && /Autre : divers · hors équilibre/.test(x.mention)));
  // en faveur de Personne B, pour moitié
  KC.affecter(o, { k: 'autre', txt: 'divers', eq: 'autre-moitie' });
  B = ctx(); E = KC.equilibre(B);
  assert.equal(E.invMoi, E0.invMoi - 12000);
  assert.equal(E.invAutre, E0.invAutre + 6000);
  assert.equal(E.autAutre, 6000);
  h = Vu.detail(S, o, K.contexte(S, NOW), B);
  assert.match(h, /Affecté : Autre : divers · en faveur de Personne B, pour moitié/);
  assert.match(h, /<option value="autre-moitie" selected>/);
  // en faveur de Personne A, en entier : comme le versement d'origine
  KC.affecter(o, { k: 'autre', eq: 'moi-tout' });
  E = KC.equilibre(ctx());
  assert.equal(E.invMoi, E0.invMoi);
  assert.equal(E.autMoi, 12000);
  // valeur inconnue ignorée
  KC.affecter(o, { k: 'autre', eq: 'nimporte' });
  assert.equal(o.commun.aff.eq, undefined);
});
