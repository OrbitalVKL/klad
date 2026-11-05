// Tests du lot 1.2.0 : « Total perso » (Accueil et résumé Grafit), barre du cycle du reste à vivre (« jour N/T », sans
// montant par jour), pastilles « à vérifier » par périmètre (Perso, Commun, Tout ; une opération comptée une fois),
// tendance sur une période au jour près (par jour sous 62 jours, sinon par mois). Données fictives uniquement.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { charge, json, texteVisible } from './charge.mjs';
import { repriseFictive } from './fictif.mjs';

const X = charge(['anon.js', 'eb.js', 'format.js', 'modele.js', 'reprise.js', 'classement.js', 'carnet.js', 'budget.js', 'commun.js', 'fisc.js',
  'resume.js', 'ui.js', 'vues.js', 'vbudget.js', 'vaccueil.js']);
const { KladModele: M, KladClasse: K, KladBudget: KB, KladCommun: KC, KladReprise: RP, KladCarnet: CN, KladVuesAccueil: VA, KladVues: Vu,
  KladVuesBudget: VB, KladResume: R, KladFormat: F } = X;
const NOW = Date.parse('2026-10-28T10:00:00Z');

async function etat() {
  const rep = RP.valider(repriseFictive('2026-10-28'));
  const S = M.vide();
  const choix = {}; for (const r of rep.comptes) choix[r.ref] = 'creer';
  RP.appliquer(S, rep, choix, { now: NOW });
  await CN.convertir(S, S.carnet, { now: NOW });
  KB.importer(S, S.carnet, { now: NOW, renommer: CN.renommeur(S.carnet) });
  KC.importer(S, S.carnet);
  return S;
}
const dettesDe = S => { const d = {}; for (const c of S.modele.comptes) if (c.role === 'carte_differee') d[c.id] = K.dette(S, c, NOW); return d; };

// ------------------------------------------------------------ 4. Total perso
test('total perso : courants + paiement en ligne + épargne − cartes, sans le commun ni les comptes masqués', () => {
  const S = M.vide();
  const a = M.nouveauCompte(S, { libelle: 'Courant A', role: 'courant', solde: { centimes: 10813, date: '2026-11-02' } });
  M.nouveauCompte(S, { libelle: 'Courant B', role: 'courant', solde: { centimes: 349961, date: '2026-11-02' } });
  M.nouveauCompte(S, { libelle: 'Commun', role: 'commun', solde: { centimes: 129707, date: '2026-11-02' } });
  const pl = M.nouveauCompte(S, { libelle: 'Portefeuille', role: 'paiement_en_ligne', solde: { centimes: 1500, date: '2026-11-02' } });
  M.nouveauCompte(S, { libelle: 'Livret', role: 'epargne', solde: { centimes: 701000, date: '2026-11-02' } });
  M.nouveauCompte(S, { libelle: 'Caché', role: 'courant', masque: true, solde: { centimes: 99999, date: '2026-11-02' } });
  const carte = M.nouveauCompte(S, { libelle: 'Carte', role: 'carte_differee', prelevement: { compte: a.id, jour: 25 } });
  // carte sans dette connue (motif du prélèvement pas choisi) : total incomplet
  let t = M.totalPerso(S, { [carte.id]: null });
  assert.deepEqual(json(t.manque), ['Carte']);
  assert.equal(t.centimes, 10813 + 349961 + 1500 + 701000);
  t = M.totalPerso(S, { [carte.id]: { centimes: 2500 } });
  assert.deepEqual(json(t.manque), []);
  assert.equal(t.centimes, 10813 + 349961 + 1500 + 701000 - 2500, 'commun et compte masqué exclus, carte déduite');
  // estimation du livret prioritaire sur le solde saisi ; portefeuille sans solde : compté pour 0, pas « incomplet »
  const lv = S.modele.comptes.find(c => c.role === 'epargne');
  delete pl.solde;
  t = M.totalPerso(S, { [carte.id]: { centimes: 0 } }, { [lv.id]: { centimes: 702000 } });
  assert.equal(t.centimes, 10813 + 349961 + 702000);
  assert.deepEqual(json(t.manque), []);
});

test('total perso : le résumé Grafit (total.all) donne la même valeur que l\'Accueil', async () => {
  const S = await etat();
  const dettes = dettesDe(S);
  const B = KB.contexte(S, NOW);
  const livrets = X.KladFisc.livretCarte(B);
  const tp = M.totalPerso(S, dettes, livrets);
  assert.ok(tp.n > 0 && !tp.manque.length);
  const g = json(R.construire(S, NOW, { budget: B }));
  assert.equal(g.total.all, tp.centimes / 100);
  // le commun n'y est plus : l'ancien calcul (courants + commun + épargne − cartes) donnait davantage
  const commun = S.modele.comptes.filter(c => c.role === 'commun').reduce((s, c) => s + M.soldeAffiche(S, c).centimes, 0);
  assert.ok(commun > 0);
  const h = VA.soldes(S, NOW, { dettes, livrets });
  const t = texteVisible(h).replace(/\s+/g, ' ');
  assert.match(t, /Total perso : /);
  assert.ok(t.replace(/\s/g, '').includes(F.solde(tp.centimes).replace(/\s/g, '')), 'valeur affichée = total perso');
  assert.match(t, /sans le commun/);
  assert.doesNotMatch(t, /Total disponible|Tous les comptes/);
});

// ------------------------------------------------------------ 2. reste à vivre : barre du cycle
test('reste à vivre : « jour N/T », plus de montant par jour ; barre : un trait par jour, lundis marqués, repère du jour', () => {
  // cycle du 28/10 au 27/11 (31 jours), le 05/11 : jour 9
  const res = { rav: { fin: '2026-11-27', budget: { base: 0, fixes: 0, marge: 0, variable: 0, reste: 123456 }, comptes: null }, jour: 9, nbJours: 31,
    per: { cyc: { start: '2026-10-28', end: '2026-11-27' } } };
  const h = VA.reste(res, 'salaire');
  const t = texteVisible(h).replace(/\s+/g, ' ');
  assert.match(t, /jusqu'au 27\/11 · jour 9\/31/);
  assert.doesNotMatch(t, /par jour/);
  assert.match(h, /aria-label="[^"]*jour 9 sur 31 du cycle/);
  const svg = VA.barreCycle('2026-10-28', 9, 31);
  assert.equal((svg.match(/class="jr"/g) || []).length + (svg.match(/class="sem"/g) || []).length, 30, 'un trait entre chaque jour');
  // lundis du cycle après le premier jour : 02, 09, 16 et 23/11
  assert.equal((svg.match(/class="sem"/g) || []).length, 4);
  assert.match(svg, /class="fait"[^>]*width="29.03%"/);
  assert.match(svg, /<line class="ici" x1="27.42%"/);
  assert.match(svg, /aria-hidden="true"/);
  // détail : plus de ligne « Par jour »
  assert.doesNotMatch(VB.detailRav(res.rav, 'salaire'), /Par jour/);
});

// ------------------------------------------------------------ 1. pastilles « à vérifier »
test('pastilles : non vues + non classées + à rapprocher, une fois chacune, par périmètre ; filtre « À vérifier »', async () => {
  const S = await etat();
  const cx = K.contexte(S, NOW);
  const n = Vu.compteursAVerifier(S, cx);
  const lim = K.limiteNC(cx);
  // calcul direct, opération par opération
  const attendu = { perso: 0, commun: 0, tout: 0 };
  for (const c of Vu.comptesDe(S, 'tout')) for (const o of S.ops[c.id] || []) {
    const av = !K.vue(S, o) || (o.date >= lim && K.classer(cx, o).nc) || !!K.aRapprocher(cx, o);
    if (!av) continue;
    attendu.tout++;
    if (c.role !== 'commun' && c.role !== 'epargne') attendu.perso++;
    if (c.role === 'commun') attendu.commun++;
  }
  assert.deepEqual(json(n), attendu);
  assert.ok(n.tout > 0 && n.perso > 0);
  // sans double compte : une opération non vue ET non classée ne compte qu'une fois
  const a = K.attention(cx, NOW);
  assert.ok(n.tout <= a.unseen + a.unclassified + a.toMatch);
  for (const k of ['perso', 'commun', 'tout']) {
    assert.equal(Vu.nAVerifier(S, k, cx), n[k], k);
    assert.equal(Vu.filtrer(S, { scope: k, cat: '__av' }, cx).length, n[k], 'filtre « À vérifier » ' + k);
  }
  // marquer tout vu : il ne reste que les non classées et les prélèvements à rapprocher
  const avant = K.marquer(S, K.opsVisibles(S), true);
  const n2 = Vu.compteursAVerifier(S, cx);
  assert.ok(n2.tout < n.tout);
  K.annulerVues(avant);
  // rendu : une pastille par choix qui en a, nommée pour le lecteur d'écran
  const h = Vu.perimetre('perso', { perso: 3, commun: 0, tout: 120 });
  assert.match(h, /data-perimetre="perso" aria-pressed="true" data-av-n="3" aria-label="Perso, 3 à vérifier"><span class="ps-l">Perso<\/span><span class="pst" aria-hidden="true">3<\/span>/);
  assert.match(h, /data-perimetre="commun" aria-pressed="false"><span class="ps-l">Commun<\/span><\/button>/);
  assert.match(h, /<span class="pst" aria-hidden="true">99\+<\/span>/);
  assert.match(Vu.filtres(S, { scope: 'perso', cat: '__av' }, cx, { unseen: 0, nc: 0, int: 0 }), /data-f="rap" aria-pressed="true">À vérifier</);
});

// ------------------------------------------------------------ 3. tendance au jour près
test('tendance : période personnalisée, par jour sous 62 jours, par mois au-delà ; opérations hors période exclues', async () => {
  const S = await etat();
  const B = KB.contexte(S, NOW);
  const mois = KB.tendanceMois(B, { scope: 'perso', from: '2026-08', to: '2026-10', mode: 'rd' });
  assert.equal(mois.pas, 'mois');
  // même période en jours (92 jours) : par mois, mêmes chiffres
  const m2 = KB.tendanceMois(B, { scope: 'perso', du: '2026-08-01', au: '2026-10-31', mode: 'rd' });
  assert.equal(m2.pas, 'mois');
  assert.deepEqual(json([m2.mois, m2.rev, m2.dep]), json([mois.mois, mois.rev, mois.dep]));
  // septembre seul (30 jours) : un point par jour, total identique au mois
  const j = KB.tendanceMois(B, { scope: 'perso', du: '2026-09-01', au: '2026-09-30', mode: 'rd' });
  assert.equal(j.pas, 'jour');
  assert.equal(j.mois.length, 30);
  assert.equal(j.mois[0], '2026-09-01');
  const iS = mois.mois.indexOf('2026-09');
  assert.equal(j.rev.reduce((a, b) => a + b, 0), mois.rev[iS]);
  assert.equal(j.dep.reduce((a, b) => a + b, 0), mois.dep[iS]);
  // seuil : 61 jours → par jour ; 62 jours → par mois ; bornes inversées remises dans l'ordre
  assert.equal(KB.tendanceMois(B, { scope: 'perso', du: '2026-08-01', au: '2026-09-30', mode: 'rd' }).pas, 'jour');
  assert.equal(KB.tendanceMois(B, { scope: 'perso', du: '2026-08-01', au: '2026-10-01', mode: 'rd' }).pas, 'mois');
  assert.equal(KB.TENDANCE_JOURS, 62);
  const inv = KB.tendanceMois(B, { scope: 'perso', du: '2026-09-30', au: '2026-09-01', mode: 'rd' });
  assert.deepEqual(json(inv.mois), json(j.mois));
  // période coupée au jour près, regroupée par mois : seuls les jours de la période comptent
  const c = KB.tendanceMois(B, { scope: 'perso', du: '2026-08-16', au: '2026-10-15', mode: 'rd' });
  assert.equal(c.pas, 'jour', '61 jours');
  const c2 = KB.tendanceMois(B, { scope: 'perso', du: '2026-07-16', au: '2026-10-15', mode: 'rd' });
  assert.equal(c2.pas, 'mois');
  const jd = KB.tendanceMois(B, { scope: 'perso', du: '2026-07-16', au: '2026-07-31', mode: 'rd' });
  assert.equal(c2.rev[0], jd.rev.reduce((a, b) => a + b, 0), 'juillet : seulement à partir du 16');
  // solde en fin de journée, catégorie sans repère de budget par jour
  const so = KB.tendanceMois(B, { scope: 'perso', du: '2026-10-01', au: '2026-10-27', mode: 'solde' });
  assert.equal(so.ligne.length, 27);
  const cat = KB.tendanceMois(B, { scope: 'perso', du: '2026-10-01', au: '2026-10-27', mode: 'cat:' + (j.categories[0] || 'Courses') });
  assert.equal(cat.ref, null);
  // rendu : libellés au jour, titre « par jour », champs de date de la période personnalisée
  const h = VB.tendance(B, 'perso', { comptes: 'auto', mode: 'rd' }, { from: '2026-09', to: '2026-09', du: '2026-09-01', au: '2026-09-30', n: 'perso', choix: true, mois: ['2026-09'], min: '2026-01-01', max: '2026-10-28' });
  assert.match(h, /Revenus, dépenses et balance par jour/);
  assert.match(h, />01\/09</);
  assert.match(h, /<input type="date" id="tend-du" value="2026-09-01" min="2026-01-01" max="2026-10-28">/);
  assert.match(h, /<input type="date" id="tend-au" value="2026-09-30"/);
  assert.match(h, /01\/09\/26 → 30\/09\/26/);
  assert.doesNotMatch(h, /id="from"|id="to"/);
});
