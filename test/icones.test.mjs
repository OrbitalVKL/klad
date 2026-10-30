// Tests (0.10.7) : banque d'icônes des catégories (Lucide, embarquée), recherche en français, suggestions d'après le
// nom, migration (chaque catégorie reçoit une icône ; celles de l'ancienne version sont gardées). Données fictives.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { charge, json } from './charge.mjs';

const X = charge(['anon.js', 'format.js', 'modele.js', 'icones-donnees.js', 'icones.js', 'classement.js', 'carnet.js', 'budget.js', 'migrations.js', 'ui.js']);
const { KladIcones: I, KladClasse: K, KladModele: M, KladMigrations: MG, KladUI: U } = X;
const lire = f => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');

test('banque : 300 à 500 icônes vectorielles, mots-clés français, licence jointe, aucun chargement réseau', () => {
  const D = X.KladIconesDonnees;
  assert.ok(D.length >= 300 && D.length <= 500, D.length + ' icônes');
  assert.equal(new Set(D.map(d => d[0])).size, D.length, 'noms uniques');
  for (const [nom, mots, corps] of D) {
    assert.match(nom, /^[a-z0-9-]+$/);
    assert.ok(mots.split(' ').length >= 1 && /[a-zà-ÿ]/.test(mots), nom);
    assert.match(corps, /^(<(path|circle|rect|line|polyline|polygon|ellipse) [^<>]*\/>)+$/, nom);
  }
  const svg = I.svg('shopping-cart', 24);
  assert.match(svg, /^<svg class="lu" viewBox="0 0 24 24" width="24" height="24" [^>]*aria-hidden="true"/);
  assert.match(lire('www/licences/lucide.txt'), /ISC License/);
  for (const f of ['www/icones.js', 'www/icones-donnees.js', 'www/selicone.js']) assert.ok(!/https?:\/\//.test(lire(f)), f + ' : aucune adresse');
  assert.match(lire('www/index.html'), /<script src="icones-donnees.js"><\/script>\s*<script src="icones.js"><\/script>\s*<script src="classement.js">/);
});

test('recherche par mots français (accents et pluriels indifférents)', () => {
  const premier = q => I.chercher(q)[0];
  assert.equal(premier('courses'), 'shopping-cart');
  assert.equal(premier('bar'), 'beer');
  assert.equal(premier('essence'), 'fuel');
  assert.equal(premier('loyer'), 'house');
  assert.equal(premier('sport'), 'dumbbell');
  assert.equal(premier('impots'), 'landmark');
  assert.equal(premier('Impôts'), 'landmark');
  assert.ok(I.chercher('cinéma').includes('clapperboard'));
  assert.ok(I.chercher('animaux').includes('paw-print'));
  assert.deepEqual([...I.chercher('zzzz')], []);
  assert.equal(I.chercher('').length, X.KladIconesDonnees.length);
});

test('suggestions d\'après le nom de la catégorie', () => {
  const s = n => I.suggerer(n, 3)[0];
  assert.equal(s('Bien être'), 'bath');
  assert.equal(s('Abonnements & télécom'), 'wifi');
  assert.equal(s('Internet / mobile'), 'wifi');
  assert.equal(s('Carburant'), 'fuel');
  assert.equal(s('Apports compte commun'), 'banknote-arrow-down');
  assert.equal(s('Taxe foncière'), 'landmark');
  assert.equal(I.proposer('Xyzw'), 'lu:tag');
  assert.equal(I.proposer('Animaux'), 'lu:paw-print');
});

test('icône d\'une catégorie : jamais une lettre de repli ; couleur choisie', () => {
  const C = K.nouveau();
  C.categories['Bien être'] = { nature: 'optionnelle' };
  C.categories['Projet X'] = { nature: 'hors_budget', icone: 'P' };
  assert.equal(K.iconeDe(C, 'Courses'), '🛒');                      // catégorie d'office : son émoji
  assert.equal(K.iconeDe(C, 'Bien être'), 'lu:bath');
  assert.equal(K.iconeDe(C, 'Projet X'), 'lu:rocket');
  assert.equal(U.iconeDe(C, 'Inconnue'), 'lu:tag');
  assert.match(U.cico(C, 'Bien être'), /class="cico svg"[^>]*><svg class="lu"/);
  C.categories['Bien être'].couleur = '#db2777';
  assert.match(U.cico(C, 'Bien être'), /--cc:#db2777/);
  C.categories['Bien être'].couleur = 'red;x';                        // valeur invalide ignorée
  assert.doesNotMatch(U.cico(C, 'Bien être'), /red;x/);
});

test('migration : icône proposée pour les catégories sans icône, icônes reprises gardées ; idempotente et réversible', () => {
  const S = M.vide();
  S.classement = K.nouveau();
  const C = S.classement;
  C.categories['Bien être'] = { nature: 'optionnelle', icone: 'B' };               // lettre de repli d'une version antérieure
  C.categories['Animaux'] = { nature: 'optionnelle' };                           // rien
  C.categories['Bars'] = { nature: 'optionnelle', icone: '🍻' };                  // reprise de l'ancienne version : gardée
  C.categories['Parking perso'] = { nature: 'courante', icone: 'svg:parking' };  // icône reprise (dessin) : gardée
  const avant = json(C.categories);
  const r = MG.icones(S, Date.parse('2026-10-30T10:00:00Z'));
  assert.deepEqual(json(r), { n: 2, noms: ['Bien être', 'Animaux'] });
  assert.equal(C.categories['Bien être'].icone, 'lu:bath');
  assert.equal(C.categories['Animaux'].icone, 'lu:paw-print');
  assert.equal(C.categories['Bars'].icone, '🍻');
  assert.equal(C.categories['Parking perso'].icone, 'svg:parking');
  assert.equal(C.categories['Courses'].icone, '🛒');
  assert.equal(MG.icones(S, Date.now()), null, 'déjà faite');
  // toutes les catégories ont une icône
  for (const n of K.listeCategories(C)) assert.ok(!I.absente(K.iconeDe(C, n)), n);
  assert.ok(MG.annulerIcones(S));
  assert.deepEqual(json(C.categories), avant);
  assert.ok(MG.icones(S, Date.now()), 'refaite après annulation');
});
