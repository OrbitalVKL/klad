// Réglages du complément dans Klad (1.0) : complément < réglages de Klad ; champ vidé → retour au complément ; cycle
// « mois civil » ; part par défaut du commun ; éditeur avancé (vérification, annulation) ; aperçu d'import ; pastille
// « récurrent sur le compte secondaire ». Dans Chromium, sur le jeu fictif des mesures : chaque modification se voit
// tout de suite dans les écrans et dans le résumé Grafit, et s'annule. Données fictives uniquement.
// La partie Chromium est sautée si Playwright n'est pas installé, sauf avec KLAD_PARCOURS=obligatoire.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { charge, json } from './charge.mjs';
import { ouvrir, playwright } from '../tools/mesures/banc.mjs';

const PW = playwright();
const SAUT = !PW && !process.env.KLAD_PARCOURS && 'Playwright absent';
const FICHIERS = ['anon.js', 'format.js', 'modele.js', 'classement.js', 'carnet.js', 'budget.js', 'commun.js', 'fisc.js', 'observations.js', 'reglages.js'];

function etat(X) {
  const { KladModele: M, KladClasse: K, KladBudget: KB } = X;
  const S = M.vide();
  const a = M.nouveauCompte(S, { libelle: 'Courant', role: 'courant' });
  const b = M.nouveauCompte(S, { libelle: 'Second', role: 'courant' });
  S.modele.reprise = { map: { r0: a.id, r1: b.id } };
  S.classement = K.nouveau();
  S.budget = KB.nouveau();
  S.carnet = { klad: { salaire: { compte: 'r0', motif: 'EMPLOYEUR FICTIF', min: 1000 }, commun: { moi: 'Personne A', autre: 'Personne B' },
    appels: { titre: 'Résidence fictive', syndic: 'Syndic fictif' }, mail: { expediteurs: 'a@example.org, b@example.org' }, observations: { secondaire: 'r1' } } };
  return { S, a, b };
}

test('complément effectif : complément < réglages de Klad ; clé remplacée ou retirée ; sans réglage, inchangé', () => {
  const X = charge(FICHIERS);
  const { KladBudget: KB } = X;
  const { S } = etat(X);
  assert.equal(KB.complement(S), S.carnet.klad, 'sans réglage saisi : le complément tel quel');
  S.modele.reglages = { complement: { appels: { titre: 'Autre' }, mail: null } };
  const C = json(KB.complement(S));
  assert.deepEqual(C.appels, { titre: 'Autre' });
  assert.equal('mail' in C, false);
  assert.deepEqual(C.salaire, S.carnet.klad.salaire);
});

test('champs : valeur et source, écriture, retour au complément, compte de la reprise, erreurs de saisie', () => {
  const X = charge(FICHIERS);
  const { KladReglages: R, KladBudget: KB } = X;
  const { S, a, b } = etat(X);
  const ch = k => R.champ(k);
  assert.deepEqual(json(R.valeur(S, ch('appels.titre'))), { v: 'Résidence fictive', src: 'complement' });
  assert.deepEqual(json(R.valeur(S, ch('salaire.ecart'))), { v: 15, src: 'defaut' });
  // même compte (référence de la reprise) ou même liste écrite autrement : rien n'est écrit
  assert.equal(R.ecrire(S, ch('salaire.compte'), a.id), false);
  assert.equal(R.ecrire(S, ch('mail.expediteurs'), R.convertir(ch('mail.expediteurs'), 'a@example.org\nb@example.org').v), false);
  assert.equal(R.ecrire(S, ch('salaire.motif'), 'EMPLOYEUR FICTIF'), false);
  assert.equal(S.budget.reglages, undefined);
  // réglage de Klad (budget) : prioritaire ; vidé : retour au complément
  const avant = R.instantane(S);
  assert.equal(R.ecrire(S, ch('salaire.motif'), R.convertir(ch('salaire.motif'), 'EMPLOYEUR FICTIF\nAUTRE PAIE').v), true);
  assert.deepEqual(json(KB.reglages(S).salaire.motifs), ['EMPLOYEUR FICTIF', 'AUTRE PAIE']);
  assert.equal(R.valeur(S, ch('salaire.motif')).src, 'klad');
  R.ecrire(S, ch('salaire.motif'), undefined);
  assert.deepEqual(json(KB.reglages(S).salaire.motifs), ['EMPLOYEUR FICTIF']);
  // clé du complément : la rubrique entière est copiée, le reste gardé ; vidée : retirée des réglages
  R.ecrire(S, ch('appels.syndic'), 'Syndic B');
  assert.deepEqual(json(KB.complement(S).appels), { titre: 'Résidence fictive', syndic: 'Syndic B' });
  R.ecrire(S, ch('appels.syndic'), undefined);
  assert.deepEqual(json(S.modele.reglages.complement), {});
  // compte secondaire changé
  R.ecrire(S, ch('observations.secondaire'), a.id);
  assert.equal(KB.complement(S).observations.secondaire, a.id);
  // carburant : les autres réglages du calculateur sont gardés
  R.ecrire(S, ch('carburant.prix'), 1.9);
  assert.deepEqual(json(KB.carburant(S)), { ar: 0, jours: 20, autres: 0, conso: 5.5, prix: 1.9 });
  // annulation : tout revient
  R.restaurer(S, avant);
  assert.equal(KB.complement(S).observations.secondaire, 'r1');
  assert.equal(S.budget.carburant, undefined);
  assert.equal(S.budget.reglages, undefined);
  void b;
  // erreurs de saisie
  assert.equal(R.convertir(ch('commun.motifAutre'), 'VIR (').ok, false);
  assert.equal(R.convertir(ch('salaire.min'), 'mille').ok, false);
  assert.equal(R.convertir(ch('salaire.min'), '1 234,5').v, 1234.5);
  assert.equal(R.convertir(ch('mail.cp'), '{ "A": ').ok, false);
  assert.equal(R.convertir(ch('tf.ach'), '2024-13').ok, false);
});

test('cycle « mois civil » et part par défaut du commun ; par défaut, rien ne change', () => {
  const X = charge(FICHIERS);
  const { KladBudget: KB, KladModele: M } = X;
  const { S, a } = etat(X);
  const op = (i, d, m, l) => ({ id: a.id + ':t:' + i, compte: a.id, date: d, montant: m, libelle: l, statut: 'comptabilisee', source: 'eb', vue: true });
  S.ops[a.id] = [op(1, '2026-09-27', 250000, 'VIR EMPLOYEUR FICTIF PAIE'), op(2, '2026-10-27', 250000, 'VIR EMPLOYEUR FICTIF PAIE'), op(3, '2026-10-28', -2000, 'CARTE BOULANGERIE')];
  S.classement.regles = [{ mot: 'EMPLOYEUR FICTIF', cat: 'Salaire', sub: 'Salaire' }];
  const now = Date.parse('2026-11-05T10:00:00');
  const per = () => { const B = KB.contexte(S, now); return [KB.periode(B, 'perso', null).start, KB.periode(B, 'perso', null).end, KB.partDe(B, 'x').pg]; };
  assert.deepEqual(json(per()), ['2026-10-27', '2026-11-26', 50]);
  S.budget.reglages = { cycle: 'mois', commun: { part: 60 } };
  assert.deepEqual(json(per()), ['2026-11-01', '2026-11-30', 60]);
  const B = KB.contexte(S, now);
  assert.equal(KB.periode(B, 'perso', null).prev, '2026-10', 'navigation par mois');
  void M;
});

test('éditeur avancé : vérification, rubriques changées seulement, retirées, annulation ; aperçu d\'import', () => {
  const X = charge(FICHIERS);
  const { KladReglages: R, KladBudget: KB } = X;
  const { S } = etat(X);
  assert.equal(R.validerBrut('{ "a": ').ok, false);
  assert.equal(R.validerBrut('[1]').ok, false);
  assert.equal(R.validerBrut('{ "mauvaise clé": 1 }').ok, false);
  const o = JSON.parse(R.brutEffectif(S));
  assert.deepEqual(o, json(S.carnet.klad));
  o.appels.titre = 'Résidence B'; delete o.mail; o.bars = '\\bBAR\\b';
  const avant = R.instantane(S);
  assert.deepEqual(json(R.enregistrerBrut(S, o)), ['appels', 'bars', 'mail']);
  assert.deepEqual(json(S.modele.reglages.complement), { appels: { titre: 'Résidence B', syndic: 'Syndic fictif' }, mail: null, bars: '\\bBAR\\b' });
  assert.equal(KB.complement(S).appels.titre, 'Résidence B');
  assert.equal(KB.complement(S).mail, undefined);
  R.restaurer(S, avant);
  assert.equal(S.modele.reglages, undefined);
  assert.equal(KB.complement(S).appels.titre, 'Résidence fictive');
  // aperçu d'un complément : ajouté, remplacé, identique, réglé dans Klad
  S.modele.reglages = { complement: { appels: { titre: 'Klad' } } };
  const ap = json(R.apercuComplement(S, { appels: { titre: 'Nouveau' }, commun: S.carnet.klad.commun, couleurs: { Courses: '#112233' } }));
  assert.deepEqual(ap, { ajoutes: ['couleurs'], remplaces: ['appels'], identiques: ['commun'], prioritaires: ['appels'] });
  assert.throws(() => R.lireComplement('{"format":"autre"}'), /pas un complément/);
  R.importerComplement(S, { couleurs: { Courses: '#112233' } });
  assert.deepEqual(json(KB.complement(S).couleurs), { Courses: '#112233' });
  assert.equal(KB.complement(S).appels.titre, 'Klad', 'réglage de Klad prioritaire');
});

test('Réglages : modifications visibles tout de suite (écrans, résumé Grafit), compte secondaire, import, éditeur avancé, annulation', { skip: SAUT, timeout: 600000 }, async () => {
  const B = await ouvrir({});
  try {
    const { page } = B;
    const resume = () => page.evaluate(() => { const A = window.KladApp; return window.KladResume.construire(A.etat(), Date.now(), A.extras(Date.now())); });
    const toast = async () => { await page.waitForSelector('#toast.show'); const t = await page.locator('#toast').innerText(); return t; };
    const sansToast = () => page.evaluate(() => { const t = document.getElementById('toast'); t.className = ''; t.textContent = ''; });
    const annuler = async () => { await page.locator('#toast button').click(); await B.pause(300); };

    // Réglages › Budget : cycle « mois civil » → Budget et résumé Grafit suivent ; annulable
    const r0 = await resume();
    await B.onglet('plus');
    await page.locator('#plusCorps [data-volet="secReglBudget"]').click();
    assert.match(await page.locator('#reglBudgetCorps').innerText(), /Cycle de salaire[\s\S]*Cycle en cours[\s\S]*du complément[\s\S]*Base de calcul[\s\S]*Compte commun[\s\S]*Compte secondaire/);
    await page.selectOption('#rg-cycle', 'mois');
    await page.locator('#reglBudgetCorps [data-theme="salaire"] [data-rg="enregistrer"]').click();
    assert.match(await toast(), /Réglages enregistrés \(1\)/);
    assert.match(await page.locator('#reglBudgetCorps').innerText(), /mois civil \(réglage\)/);
    const r1 = await resume();
    assert.notDeepEqual(r1.month, r0.month, 'résumé Grafit : période du mois civil');
    await annuler();
    assert.deepEqual((await resume()).month, r0.month, 'annulé');
    // noms du commun : écran Commun
    await page.fill('#rg-commun-moi', 'Personne Alpha');
    await page.locator('#reglBudgetCorps [data-theme="commun"] [data-rg="enregistrer"]').click();
    await toast();
    await B.onglet('commun');
    assert.match(await page.locator('#appli').innerText(), /Personne Alpha/);
    await annuler();
    assert.doesNotMatch(await page.locator('#appli').innerText(), /Personne Alpha/);
    // saisie invalide : rien n'est écrit
    await B.onglet('plus');
    await page.locator('#plusCorps [data-volet="secReglBudget"]').click();
    await page.fill('#rg-commun-motifAutre', 'VIR (');
    await page.locator('#reglBudgetCorps [data-theme="commun"] [data-rg="enregistrer"]').click();
    assert.match(await page.locator('#reglBudgetCorps [data-theme="commun"] .rg-msg').innerText(), /Expression non reconnue/);

    // compte secondaire (du complément) → pastille « récurrent sur SECOND COURANT » dans le détail des postes ; « Aucun » la retire
    // cycle précédent (les charges du jeu fictif tombent le 6 et le 16), sections et postes dépliés
    const deplier = async () => {
      await B.onglet('budget');
      if (!(await page.locator('#appli [data-nav="now"]:visible').count())) { await page.locator('#appli [data-nav="prev"]:visible').first().click(); await B.pause(250); }
      for (let i = 0; i < 6; i++) {
        const k = await page.evaluate(() => { const b = [...document.querySelectorAll('#appli [data-sec][aria-expanded="false"]')].filter(x => x.offsetParent !== null)[0]; if (b) b.click(); return !!b; });
        if (!k) break;
        await B.pause(60);
      }
      for (let i = 0; i < 40; i++) {
        const k = await page.evaluate(() => { const b = [...document.querySelectorAll('#appli .poste-nom[data-poste][aria-expanded="false"]')].filter(x => x.offsetParent !== null)[0]; if (b) b.click(); return !!b; });
        if (!k) break;
        await B.pause(40);
      }
      return page.locator('#appli').innerText();
    };
    assert.match(await deplier(), /récurrent sur SECOND COURANT/i);
    const obs = () => page.evaluate(() => window.KladObservations.audit(window.KladApp.budget()).map(a => a.titre));
    assert.ok((await obs()).includes('Charges récurrentes sur le SECOND COURANT'), 'observation');
    await B.onglet('plus');
    await page.locator('#plusCorps [data-volet="secReglBudget"]').click();
    await page.selectOption('#rg-observations-secondaire', '');
    await page.locator('#reglBudgetCorps [data-theme="secondaire"] [data-rg="enregistrer"]').click();
    await toast();
    await B.fermer();
    assert.doesNotMatch(await deplier(), /récurrent sur/i);
    assert.ok(!(await obs()).includes('Charges récurrentes sur le SECOND COURANT'));
    await annuler();
    assert.match(await deplier(), /récurrent sur SECOND COURANT/i);

    // Importer : complément avec aperçu (ajouté, remplacé), puis effet
    await B.onglet('plus');
    await page.locator('#plusCorps [data-volet="secImporter"]').click();
    const comp = { format: 'klad-complement', v: 1, klad: { appels: { titre: 'Résidence importée' }, couleurs: { Courses: '#123456' } } };
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.locator('#importerCorps [data-rg="choisir"]').click()]);
    await fc.setFiles({ name: 'complement.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(comp)) });
    await page.waitForSelector('#complementApercu');
    const ap = await page.locator('#complementApercu').innerText();
    assert.match(ap, /Ajouté[\s\S]*couleurs/);
    assert.match(ap, /Remplacé[\s\S]*appels/);
    await page.locator('#complementApercu [data-rg="importer"]').click();
    await page.waitForFunction(() => !document.getElementById('complementApercu'));
    assert.equal(await page.evaluate(() => window.KladBudget.complement(window.KladApp.etat()).appels.titre), 'Résidence importée');

    // éditeur avancé : erreur signalée, enregistrement, annulation
    await page.evaluate(() => window.KladApp.ouvrirVolet('secReglAvance'));
    await page.fill('#rgBrut', '{ "appels": ');
    await page.locator('#reglAvanceCorps [data-rg="brut"]').click();
    assert.match(await page.locator('#rgBrutMsg').innerText(), /JSON non valide/);
    const brut = await page.evaluate(() => { const o = JSON.parse(JSON.stringify(window.KladBudget.complement(window.KladApp.etat()))); o.appels = { titre: 'Résidence éditée' }; return JSON.stringify(o, null, 2); });
    await page.fill('#rgBrut', brut);
    await page.locator('#reglAvanceCorps [data-rg="verifier"]').click();
    assert.match(await page.locator('#rgBrutMsg').innerText(), /Complément valide/);
    await sansToast();
    await page.locator('#reglAvanceCorps [data-rg="brut"]').click();
    assert.match(await toast(), /Complément enregistré \(1 rubrique\(s\) : appels\)/);
    assert.equal(await page.evaluate(() => window.KladBudget.complement(window.KladApp.etat()).appels.titre), 'Résidence éditée');
    await annuler();
    assert.equal(await page.evaluate(() => window.KladBudget.complement(window.KladApp.etat()).appels.titre), 'Résidence importée');

    // écrans par thème : chacun s'ouvre
    for (const id of ['cartes', 'appels', 'mail', 'motscles', 'tf', 'livret', 'pee', 'masquees', 'exclusions', 'carburant', 'apparence']) {
      await page.evaluate(() => window.KladApp.ouvrirVolet('secReglages'));
      await page.locator('#reglagesCorps [data-reglt="' + id + '"]').click();
      await B.pause(100);
      assert.ok((await page.locator('#reglThemeCorps').innerText()).length > 20, id);
    }
    assert.deepEqual(B.erreurs, []);
  } finally { await B.fin(); }
});

// 1.0.1 : après un changement des bars (ou des règles), encart « Reprendre le classement » avec le nombre
// d'opérations touchées (aperçu sans rien changer), « Plus tard », reprise annulable.
test('bars modifiés : encart « Reprendre le classement », aperçu, reprise et annulation', { skip: SAUT, timeout: 600000 }, async () => {
  const B = await ouvrir({});
  try {
    const { page } = B;
    const classes = () => page.evaluate(() => {
      const A = window.KladApp, S = A.etat(), cx = window.KladClasse.contexte(S, Date.now()), r = {};
      for (const o of window.KladClasse.opsVisibles(S)) if (/RESTAURANT FICTIF/.test(o.libelle)) { const c = window.KladClasse.classer(cx, o); r[c.sub] = (r[c.sub] || 0) + 1; }
      return r;
    });
    const avant = await classes();
    const encart = () => page.locator('#reglThemeCorps [data-encart-reprise]');
    await page.evaluate(() => window.KladApp.ouvrirVolet('secReglages'));
    await page.locator('#reglagesCorps [data-reglt="motscles"]').click();
    assert.equal(await encart().isHidden(), true, 'rien à reprendre au départ');
    await page.fill('#rg-bars', 'RESTAURANT');
    await page.locator('#reglThemeCorps [data-rg="enregistrer"]').click();
    await page.waitForFunction(() => /changeront de catégorie|changera de catégorie/.test((document.querySelector('#reglThemeCorps [data-encart-reprise]') || {}).textContent || ''));
    const t = await encart().innerText();
    const n = +t.match(/(\d+) opérations? change/)[1];
    assert.ok(n > 0, t);
    assert.deepEqual(await classes(), avant, 'aperçu : rien n\'a changé');
    // Plus tard : masqué pour la session
    await encart().locator('[data-reprise="tard"]').click();
    assert.equal(await encart().isHidden(), true);
    // autre changement : de nouveau proposé ; retour au changement écarté : masqué (aussi dans Plus › Classement)
    const enregistrerBars = async v => { await page.fill('#rg-bars', v); await page.locator('#reglThemeCorps [data-rg="enregistrer"]').click(); await B.pause(200); };
    await enregistrerBars('RESTAURANT|PUB');
    await page.waitForFunction(() => /Reprendre le classement/.test((document.querySelector('#reglThemeCorps [data-encart-reprise]') || {}).textContent || ''));
    await enregistrerBars('RESTAURANT');
    assert.equal(await encart().isHidden(), true, 'changement déjà écarté');
    await page.evaluate(() => window.KladApp.ouvrirVolet('secClassement'));
    await B.pause(300);
    assert.equal(await page.locator('#classementCorps [data-encart-reprise]').isHidden(), true);
    await page.evaluate(() => window.KladApp.ouvrirVolet('secReglages'));
    await page.locator('#reglagesCorps [data-reglt="motscles"]').click();
    await enregistrerBars('RESTAURANT|PUB');
    await page.waitForFunction(() => /changeront de catégorie|changera de catégorie/.test((document.querySelector('#reglThemeCorps [data-encart-reprise]') || {}).textContent || ''));
    const n2 = +(await encart().innerText()).match(/(\d+) opérations? change/)[1];
    assert.ok(n2 >= n, n2 + ' / ' + n);
    await encart().locator('[data-reprise="go"]').click();
    await page.waitForFunction(() => /Classement repris : \d+ opération\(s\) ont changé de catégorie/.test(document.getElementById('toast').textContent));
    assert.match(await page.locator('#toast').innerText(), new RegExp('Classement repris : ' + n2 + ' opération'));
    const apres = await classes();
    assert.notDeepEqual(apres, avant, 'reprise faite');
    await page.waitForFunction(() => document.querySelector('#reglThemeCorps [data-encart-reprise]').hidden);
    // Annuler : classement d'avant
    await page.locator('#toast button').click();
    await B.pause(300);
    assert.deepEqual(await classes(), avant, 'annulé');
    assert.deepEqual(B.erreurs, []);
  } finally { await B.fin(); }
});
