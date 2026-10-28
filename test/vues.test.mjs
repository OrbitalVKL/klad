// Tests : rendu de l'accueil et des opérations — débit / crédit en colonnes, « débiteur », aucun signe moins devant
// un montant, échappement HTML. Données fictives uniquement.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { charge, json } from './charge.mjs';

const { KladModele: M, KladVues: Vu, KladClasse: K } = charge(['anon.js', 'eb.js', 'format.js', 'modele.js', 'classement.js', 'vues.js']);
const NOW = Date.parse('2026-10-28T10:00:00Z');
const texte = h => h.replace(/<[a-z\/][^>]*>/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/[\u00a0\u202f]/g, ' ');
const SIGNE = /[\u2212\u2012\u2013-]\s?\d[\d\s]*,\d\d/;

function etat() {
  const S = M.vide();
  const a = M.nouveauCompte(S, { libelle: 'COURANT', source: { type: 'eb', connexion: 's1', uid: 'u1' }, sync: { lu: new Date(NOW - 3600e3).toISOString() } });
  S.modele.connexions.s1 = { banque: 'Banque Fictive', pays: 'FR', valid_until: '2027-01-01T00:00:00Z' };
  M.soldesLus(S, a.id, [{ balance_type: 'CLBD', balance_amount: { amount: '-1234.56' } }], NOW);
  const l = M.nouveauCompte(S, { libelle: 'LIVRET <b>', role: 'epargne', solde: { centimes: 500000, date: '2026-10-20' } });
  S.ops[a.id] = [
    { id: 'o1', compte: a.id, date: '2026-10-27', montant: -999, libelle: 'CB CAFE', statut: 'en_cours', source: 'eb' },
    { id: 'o2', compte: a.id, date: '2026-10-25', montant: 180000, libelle: 'VIREMENT', statut: 'comptabilisee', source: 'eb' },
    { id: 'o3', compte: a.id, date: '2026-10-25', montant: -123456, libelle: 'LOYER & CHARGES', statut: 'comptabilisee', source: 'eb' },
    { id: 'o4', compte: a.id, date: '2025-12-31', montant: -1, libelle: 'FRAIS', statut: 'comptabilisee', source: 'reprise' }];
  return { S, a, l };
}

test('accueil : total des comptes courants « débiteur », cartes, aucun montant signé', () => {
  const { S } = etat();
  const h = Vu.accueil(S, NOW);
  const t = texte(h);
  assert.match(t, /Comptes courants\s+1 234,56 € débiteur/);
  assert.match(t, /LIVRET <b>\s+Épargne\s+5 000,00 €\s+saisi le 20\/10\/2026/);
  assert.match(t, /à jour il y a 1 h/);
  assert.match(h, /LIVRET &lt;b&gt;/);
  assert.doesNotMatch(t, SIGNE);
  assert.doesNotMatch(h, /\u2212/);
});

test('opérations : par jour, débit et crédit en colonnes, en cours marquée, aucun signe', () => {
  const { S } = etat();
  const ops = Vu.filtrer(S, {});
  assert.deepEqual(json(ops.map(o => o.id)), ['o1', 'o2', 'o3', 'o4']);
  const r = Vu.tranche(S, ops, 0, 10, { compte: false, annee: 2026 });
  assert.equal(r.fin, 4);
  assert.equal((r.html.match(/<section class="jour">/g) || []).length, 3);
  assert.match(r.html, /<h3>mardi 27 octobre<\/h3>/);
  assert.match(r.html, /<h3>mercredi 31 décembre 2025<\/h3>/);
  assert.match(r.html, /<div class="op encours nonvue"/);
  assert.match(r.html, /<div class="deb">9,99\s€<\/div><div class="cre"><\/div>/);
  assert.match(r.html, /<div class="deb"><\/div><div class="cre">1\s800,00\s€<\/div>/);
  assert.match(r.html, /LOYER &amp; CHARGES/);
  assert.doesNotMatch(texte(r.html), SIGNE);
  // tranches : au moins n jours complets
  const p = Vu.tranche(S, ops, 0, 1, {});
  assert.equal(p.fin, 1);
  assert.equal(Vu.tranche(S, ops, p.fin, 1, {}).fin, 3);
});

test('opérations : recherche (sans accents ni casse), filtre par compte, comptes masqués exclus', () => {
  const { S, a, l } = etat();
  assert.deepEqual(json(Vu.filtrer(S, { q: 'loyer' }).map(o => o.id)), ['o3']);
  assert.deepEqual(json(Vu.filtrer(S, { q: 'café' }).map(o => o.id)), ['o1']);
  assert.equal(Vu.filtrer(S, { compte: l.id }).length, 0);
  a.masque = true;
  assert.equal(Vu.filtrer(S, {}).length, 0);
  assert.equal(Vu.filtrer(S, { compte: a.id }).length, 4);
});

test('accueil : « À vérifier » (lignes et écrans), carte à débit différé « à prélever », total carte déduite', () => {
  const { S, a } = etat();
  const k = M.nouveauCompte(S, { libelle: 'CARTE', role: 'carte_differee', prelevement: { compte: a.id, jour: 5, motif: 'REGLEMENT CARTE' } });
  S.ops[a.id].push({ id: 'p1', compte: a.id, date: '2026-10-05', montant: -5000, libelle: 'PRLV REGLEMENT CARTE FICTIVE', statut: 'comptabilisee', source: 'eb' });
  S.ops[k.id] = [{ id: 'c1', compte: k.id, date: '2026-10-10', montant: -2000, libelle: 'CB LIBRAIRIE', statut: 'comptabilisee', source: 'eb' },
    { id: 'c2', compte: k.id, date: '2026-10-01', montant: -9000, libelle: 'CB AVANT', statut: 'comptabilisee', source: 'eb' }];
  const cx = K.contexte(S, NOW);
  const ext = { attention: K.attention(cx, NOW), sauvegarde: { jours: 45 }, maj: '9.9.9', ctx: cx };
  const h = Vu.accueil(S, NOW, ext);
  const t = texte(h);
  assert.match(t, /À vérifier/);
  assert.match(h, /data-av="nonvues"/);
  assert.match(t, /Dernière sauvegarde il y a 45 jours/);
  assert.match(t, /Klad 9\.9\.9 est disponible/);
  assert.match(t, /à prélever le 05\/11\s+20,00 €/);
  assert.match(t, /Comptes courants, carte déduite\s+1 254,56 € débiteur/);
  assert.doesNotMatch(t, SIGNE);
  // sans motif de prélèvement : rien d'inventé
  delete k.prelevement.motif;
  assert.match(texte(Vu.accueil(S, NOW, { ctx: K.contexte(S, NOW) })), /Libellé du prélèvement à choisir/);
  // tout vu, rien à vérifier : pas d'encart
  K.initialiserVues(S, NOW);
  const L = Vu.lignesAVerifier(S, NOW, { attention: K.attention(K.contexte(S, NOW), NOW), sauvegarde: { jours: 2 } });
  assert.deepEqual(json(L).map(x => x.cle), ['nonclassees']);
});

test('opérations : catégorie affichée, point bleu des non vues, filtres non vues / non classées / catégorie', () => {
  const { S, a } = etat();
  S.classement = K.nouveau();
  S.classement.regles.push({ mot: 'LOYER', cat: 'Logement', sub: 'Loyer' });
  S.modele.vues = { depuis: '2026-10-25' };
  const cx = K.contexte(S, NOW);
  const l = Vu.ligne(S, S.ops[a.id][2], { ctx: cx });
  assert.match(l, /🏠/);
  assert.match(texte(l), /Logement · Loyer/);
  assert.doesNotMatch(l, /nonvue/);
  assert.match(Vu.ligne(S, S.ops[a.id][0], { ctx: cx }), /class="op encours nonvue nc"/);
  assert.deepEqual(json(Vu.filtrer(S, { nonVues: true }, cx).map(o => o.id)), ['o1']);
  assert.deepEqual(json(Vu.filtrer(S, { cat: '__nc' }, cx).map(o => o.id)), ['o1', 'o2']);       // 3 derniers mois
  assert.deepEqual(json(Vu.filtrer(S, { cat: 'Logement' }, cx).map(o => o.id)), ['o3']);
  const d = texte(Vu.detail(S, S.ops[a.id][2], cx));
  assert.match(d, /Logement › Loyer\s*par une de vos règles/);
  assert.match(d, /Marquer non vue/);
  const c = Vu.classer(S, S.ops[a.id][2], cx, { cat: 'Logement', sub: 'Loyer', autres: true, mot: 'LOYER', compte: false, sens: '', toutes: false }, 3);
  assert.match(texte(c), /3 opérations contiennent « LOYER »/);
  assert.match(texte(c), /Classer en Logement \(3\)/);
});
