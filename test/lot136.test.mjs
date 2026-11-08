// Tests du lot 1.3.6 (désencombrement, analyse de l'architecte du 08/11) : fin de cycle au prochain jour de paie
// habituel (jour ouvré) ; observation « Salaire attendu … pas encore arrivé » ; « prélèvement absent » pour tous les
// contrats ; Accueil (un seul raccourci, cycle une fois, bilan dans « Ce cycle-ci », « À mettre en place » par
// personne) ; Commun (solde une seule fois) ; projection à partir du 7e jour ; Impôts (titres) ; contrats à 390 px ;
// graphiques sans hauteur figée ; « Trier une à une » depuis « À vérifier ». Données FICTIVES.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { read, texteVisible } from './charge.mjs';
import { outils, etatDepuisReprise } from './jeux.mjs';
import { repriseFictive } from './fictif.mjs';

const X = outils(['ui.js', 'vues.js', 'vbudget.js', 'vcommun.js', 'vaccueil.js', 'vfisc.js']);
const { KladClasse: K, KladBudget: KB, KladCommun: KC, KladObservations: KO, KladVuesBudget: VB, KladVuesCommun: VC, KladVuesAccueil: VA } = X;
const ctxDe = (S, now) => KB.contexte(S, now, K.contexte(S, now));
const charger = async fin => { const now = Date.parse(fin + 'T10:00:00Z'); return { S: await etatDepuisReprise(X, repriseFictive(fin), now), now }; };
const t = h => texteVisible(h).replace(/\s+/g, ' ');
const salaires = S => S.modele.comptes.flatMap(c => (S.ops[c.id] || []).filter(o => /SALAIRE/.test(o.libelle)));

test('cycle : fin la veille du prochain jour de paie habituel ; un salaire versé en avance ne raccourcit pas le cycle', async () => {
  const { S, now } = await charger('2026-12-28');
  let c = KB.cycleCourant(ctxDe(S, now));
  assert.deepEqual([c.start, c.attendu, c.end], ['2026-12-26', '2027-01-27', '2027-01-26']);
  // salaire de décembre versé le 22 (avant les fêtes) : attendu le 27/01 (jour habituel), pas le 22/01
  const s = salaires(S).find(o => o.date === '2026-12-26');
  s.date = '2026-12-22';
  c = KB.cycleCourant(ctxDe(S, now));
  assert.deepEqual([c.start, c.attendu, c.end], ['2026-12-22', '2027-01-27', '2027-01-26']);
  const r = KB.suivi(ctxDe(S, now), 'perso', null);
  assert.equal(r.nbJours, 36);
  assert.equal(r.rav.fin, '2027-01-26');
  // jour habituel un samedi : attendu le vendredi d'avant (27/03/2027 est un samedi)
  const { S: S2, now: n2 } = await charger('2027-02-28');
  assert.equal(KB.cycleCourant(ctxDe(S2, n2)).attendu, '2027-03-26');
});

test('observation : salaire attendu et pas encore arrivé 3 jours après ; cycle prolongé jusqu\'à aujourd\'hui', async () => {
  const { S, now } = await charger('2026-10-31');
  const s = salaires(S).find(o => o.date === '2026-10-27');
  S.ops[s.compte] = S.ops[s.compte].filter(o => o !== s);
  const B = ctxDe(S, now), c = KB.cycleCourant(B);
  assert.deepEqual([c.start, c.attendu, c.end], ['2026-09-27', '2026-10-27', '2026-10-31']);
  const o = KO.audit(B).find(x => x.titre === 'Salaire');
  assert.ok(o);
  assert.equal(o.texte, 'Salaire attendu le 27/10/2026, pas encore arrivé (dernier le 27/09/2026).');
});

test('observation « prélèvement absent » : contrat perso aussi, toutes périodicités ; jamais après la fin du contrat', async () => {
  const { S, now } = await charger('2026-10-28');
  const c = S.modele.comptes.find(x => x.role === 'courant');
  S.ops[c.id].push({ id: c.id + ':m:ab', compte: c.id, date: '2026-07-10', montant: -999, libelle: 'PRLV ABONNEMENT ANCIEN FICTIF', statut: 'comptabilisee', source: 'manuel', vue: true });
  S.budget.contrats = (S.budget.contrats || []).concat([{ id: 'tab', label: 'Abonnement ancien fictif', montant: 999, motif: 'ABONNEMENT ANCIEN', sc: 'perso', per: 1, poste: 'f|Services en ligne', src: '', note: '' },
    { id: 'tan', label: 'Assurance annuelle fictive', montant: 999, motif: 'ABONNEMENT ANCIEN', sc: 'perso', per: 12, poste: 'f|Services en ligne', src: '', note: '' }]);
  let A = KO.audit(ctxDe(S, now));
  const o = A.find(x => x.titre === 'Abonnement ancien fictif : prélèvement absent');
  assert.ok(o && o.scope === 'perso' && o.niveau === 'warn');
  assert.match(o.texte, /^Dernier prélèvement le 10\/07\/2026\. Si l'organisme a changé de libellé ou de numéro de contrat/);
  assert.ok(!A.some(x => /^Assurance annuelle fictive/.test(x.titre)), 'annuel : pas encore en retard');
  S.budget.contrats[S.budget.contrats.length - 2].fin = '2026-08-31';
  A = KO.audit(ctxDe(S, now));
  assert.ok(!A.some(x => x.titre === 'Abonnement ancien fictif : prélèvement absent'), 'contrat terminé');
});

test('Accueil : un seul raccourci, cycle une fois, bilan dans « Ce cycle-ci », « À mettre en place » par personne', async () => {
  const { S, now } = await charger('2026-10-28');
  const cx = K.contexte(S, now), B = KB.contexte(S, now, cx), res = KB.suivi(B, 'perso', null);
  const h = VA.ecran({ S, B, now, ext: { attention: K.attention(cx, now), ctx: cx, sauvegarde: { jours: 3 } }, res, dettes: {}, livrets: {}, fdm: KC.finDeMois(B), plan: KC.plan(B), R: KC.reglages(B), ech: KB.echeances(B, 31) });
  const tx = t(h);
  assert.equal((h.match(/class="ac-act"/g) || []).length, 1);
  assert.match(h, /data-act="verrou"/);
  assert.doesNotMatch(tx, /jours? restants?/);
  assert.match(tx, /Ce cycle-ci dépenses courantes et optionnelles/);
  assert.match(h, /id="ac-cy"[\s\S]*data-av="bilan"[^>]*>Bilan du cycle précédent ›/, 'jour 2 : lien vers le bilan dans « Ce cycle-ci »');
  assert.doesNotMatch(h.slice(h.indexOf('À vérifier'), h.indexOf('id="ac-so"') > 0 ? h.indexOf('id="ac-so"') : undefined), /Bilan du cycle précédent/);
  assert.equal(VA.surTitre(res), 'Cycle du 27/10 au 26/11');
  // ordres à modifier : une ligne par personne, avec le total
  const pl = { changes: [{ qui: 'moi', have: 0, want: 57000 }, { qui: 'moi', have: 0, want: 7500 }, { qui: 'autre', have: 60000, want: 63900 }] };
  const c = t(VA.commun(KC.finDeMois(B), pl, { moi: 'Personne A', autre: 'Personne B' }, '2026-10-28'));
  assert.match(c, /À mettre en place Personne A : 2 virements à modifier, passer de 0 € à 645 € par mois au total/);
  assert.match(c, /À mettre en place Personne B : passer de 600 € à 639 € par mois/);
  assert.equal((c.match(/À mettre en place/g) || []).length, 2);
});

test('Commun : le solde n\'est plus répété (répartition sans « Solde », budget du mois : variation réelle)', async () => {
  const { S, now } = await charger('2026-10-28');
  const B = ctxDe(S, now), D = KC.decomposition(B);
  const m = t(VC.mois(B, {}));
  assert.match(m, /Le compte commun ce mois-ci répartition du solde Disponible/);
  assert.doesNotMatch(m, /Solde [\d\s ]+,\d\d €/);
  const sb = t(VB.soldeBar ? VB.soldeBar(B, KB.suivi(B, 'commun', null)) : VB.suivi(B, 'commun', {}).html);
  assert.doesNotMatch(sb, /Solde du compte commun/);
  assert.ok(D.solde > 0);
});

test('projection : affichée à partir du 7e jour de la période', async () => {
  const { S, now } = await charger('2026-10-28');
  const s2 = KB.suivi(ctxDe(S, now), 'perso', null);
  assert.equal(s2.jour, 2);
  const h2 = t(VB.suivi(ctxDe(S, now), 'perso', {}).html);
  assert.match(h2, /Projeté fin de mois à partir du 7e jour/);
  const n8 = Date.parse('2026-11-02T10:00:00Z');
  const s8 = KB.suivi(ctxDe(S, n8), 'perso', null);
  assert.equal(s8.jour, 7);
  assert.match(t(VB.suivi(ctxDe(S, n8), 'perso', {}).html), /Projeté fin de mois (déficit )?[+\d]/);
});

test('affichage : contrats (pastille sous le texte), Impôts (titres), graphiques sans hauteur figée, « Classer » sans coupure, tri depuis « À vérifier »', () => {
  const css = read('www/style.css'), vb = read('www/vbudget.js'), vf = read('www/vfisc.js'), app = read('www/app.js');
  assert.match(vb, /<div class="ctr-pp">' \+ chip\(x\.etat\)/);
  assert.match(css, /\.ctr-pp\{display:flex/);
  assert.match(vf, /tete\('À régler et à suivre'/);
  assert.match(vf, /<h3 class="obs-h3">Points à suivre<\/h3>/);
  assert.match(css, /\.chartbox\{height:auto;min-height:240px\}\s*$/m);
  assert.match(css, /\.cat-t\{[^}]*hyphens:auto/);
  assert.match(app, /filtre\.cat === '__av' \? opsListe\.filter\(aTrier\)\.length/);
});
