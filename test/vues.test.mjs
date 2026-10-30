// Tests : rendu de l'accueil et des opérations — débit / crédit en colonnes, « débiteur », aucun signe moins devant
// un montant, échappement HTML. Données fictives uniquement.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { charge, json } from './charge.mjs';

const { KladModele: M, KladVues: Vu, KladClasse: K } = charge(['anon.js', 'eb.js', 'format.js', 'modele.js', 'classement.js', 'ui.js', 'vues.js']);
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
  const h = Vu.hero(S, 'perso', NOW) + Vu.rangee(S, 'perso', NOW, {});
  const t = texte(h);
  assert.match(t, /Total des comptes courants\s+1 234,56 €\s+débiteur\s+COURANT · relevé de/);
  assert.match(t, /LIVRET <b>\s+5 000,00 €\s+saisi le 20\/10/);
  assert.match(t, /COURANT\s+1 234,56 €\s+débiteur · au/);
  assert.match(h, /LIVRET &lt;b&gt;/);
  assert.doesNotMatch(t, SIGNE);
  assert.doesNotMatch(h, /\u2212/);
});

test('opérations : par jour, total du jour, débit sans signe, crédit « + », en cours marquée', () => {
  const { S } = etat();
  const ops = Vu.filtrer(S, {});
  assert.deepEqual(json(ops.map(o => o.id)), ['o1', 'o2', 'o3', 'o4']);
  const r = Vu.tranche(S, ops, 0, 10, { annee: 2026 });
  assert.equal(r.fin, 4);
  assert.equal((r.html.match(/<div class="tx-day">/g) || []).length, 3);
  assert.match(texte(r.html), /mar\. 27\/10\s+9,99 €/);
  assert.match(texte(r.html), /mer\. 31\/12\/25/);
  assert.match(r.html, /<div class="txr unseen encours" data-op="o1"/);
  assert.match(r.html, /<div class="amt"><span class="amt-v">9,99\s€<\/span>/);
  assert.match(r.html, /<div class="amt pos"><span class="amt-v">\+1\s800,00\s€<\/span>/);
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

test('accueil : « À vérifier » (lignes et écrans), carte à débit différé « à régler », compte moins la carte', () => {
  const { S, a } = etat();
  const k = M.nouveauCompte(S, { libelle: 'CARTE', role: 'carte_differee', prelevement: { compte: a.id, jour: 5, motif: 'REGLEMENT CARTE' } });
  S.ops[a.id].push({ id: 'p1', compte: a.id, date: '2026-10-05', montant: -5000, libelle: 'PRLV REGLEMENT CARTE FICTIVE', statut: 'comptabilisee', source: 'eb' });
  S.ops[k.id] = [{ id: 'c1', compte: k.id, date: '2026-10-10', montant: -2000, libelle: 'CB LIBRAIRIE', statut: 'comptabilisee', source: 'eb' },
    { id: 'c2', compte: k.id, date: '2026-10-01', montant: -9000, libelle: 'CB AVANT', statut: 'comptabilisee', source: 'eb' }];
  const cx = K.contexte(S, NOW);
  const ext = { attention: K.attention(cx, NOW), sauvegarde: { jours: 45 }, maj: '9.9.9', ctx: cx };
  const L = json(Vu.lignesAVerifier(S, NOW, ext)).map(x => x.cle);
  assert.ok(L.includes('nonvues'));
  const v = Vu.aVerifier(S, NOW, ext), tv = texte(v);
  assert.doesNotMatch(v, /data-av="nonvues"/);          // les opérations à voir ont leur propre ligne
  assert.match(v, /data-av="sauvegarde"/);
  assert.match(tv, /Dernière sauvegarde il y a 45 jours/);
  assert.match(tv, /Klad 9\.9\.9 est disponible/);
  assert.match(texte(Vu.aVoir(S, 'perso', cx)), /\d+ opérations à voir/);
  const dettes = { [k.id]: K.dette(S, k, NOW) };
  const t = texte(Vu.rangee(S, 'perso', NOW, { dettes }));
  assert.match(t, /CARTE\s+20,00 €\s+à régler · depuis le 05\/10/);
  assert.match(t, /COURANT − CARTE\s+1 254,56 €\s+débiteur · après CARTE estimée/);
  assert.doesNotMatch(t, SIGNE);
  // sans motif de prélèvement : rien d'inventé
  delete k.prelevement.motif;
  assert.match(texte(Vu.rangee(S, 'perso', NOW, { dettes: { [k.id]: K.dette(S, k, NOW) } })), /Libellé du prélèvement à choisir/i);
  // tout vu, rien à vérifier : pas d'encart
  K.initialiserVues(S, NOW);
  const L2 = Vu.lignesAVerifier(S, NOW, { attention: K.attention(K.contexte(S, NOW), NOW), sauvegarde: { jours: 2 } });
  assert.deepEqual(json(L2).map(x => x.cle), ['nonclassees']);
});

test('opérations : catégorie affichée, point bleu des non vues, filtres non vues / non classées / catégorie', () => {
  const { S, a } = etat();
  S.classement = K.nouveau();
  S.classement.regles.push({ mot: 'LOYER', cat: 'Logement', sub: 'Loyer' });
  S.modele.vues = { depuis: '2026-10-25' };
  const cx = K.contexte(S, NOW);
  const l = Vu.ligne(S, S.ops[a.id][2], { ctx: cx });
  assert.match(l, /🏠/);
  assert.match(texte(l), /Logement · Loyer\s+règle/);
  assert.match(l, /role="button" tabindex="0" aria-label="[^"]*, débit [^"]*"/);
  assert.doesNotMatch(l, /unseen/);
  assert.match(Vu.ligne(S, S.ops[a.id][0], { ctx: cx }), /class="txr unseen encours"/);
  assert.deepEqual(json(Vu.filtrer(S, { nonVues: true }, cx).map(o => o.id)), ['o1']);
  assert.deepEqual(json(Vu.filtrer(S, { cat: '__nc' }, cx).map(o => o.id)), ['o1', 'o2']);       // 3 derniers mois
  assert.deepEqual(json(Vu.filtrer(S, { cat: 'Logement' }, cx).map(o => o.id)), ['o3']);
  const d = texte(Vu.detail(S, S.ops[a.id][2], cx));
  assert.match(d, /Logement › Loyer \(par une de vos règles\)/);
  assert.match(d, /Marquer non vue/);
  const c = Vu.classer(S, S.ops[a.id][2], cx, { cat: 'Logement', sub: 'Loyer', autres: true, mot: 'LOYER', compte: false, sens: '', toutes: false }, 3);
  assert.match(texte(c), /3 opérations contiennent « LOYER »/);
  assert.match(texte(c), /Classer en Logement \(3\)/);
});

test('préférences d\'affichage gardées sur le téléphone : liste fermée, sections repliées par défaut comme l\'ancienne version', () => {
  const mem = {};
  const localStorage = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
  const { KladUI: U } = charge(['anon.js', 'eb.js', 'format.js', 'modele.js', 'classement.js', 'ui.js'], { localStorage });
  U.pref('periode', { from: '2026-01', to: '2026-09', n: null });
  assert.deepEqual(json(U.pref('periode')), { from: '2026-01', to: '2026-09', n: null });
  assert.throws(() => U.pref('cle', 'x'), /préférence inconnue/);       // jamais de donnée hors du coffre
  U.pref('periode', null);
  assert.equal(U.pref('periode'), null);
  assert.equal(U.replie('actions'), true);
  assert.equal(U.replie('budget-main'), false);
  U.plier('actions', false);
  assert.equal(U.replie('actions'), false);
  assert.deepEqual(Object.keys(mem).sort(), ['klad.replis.v', 'klad.replis.v2']);
  // calcul dans un champ de montant (comme l'ancienne version), sans eval
  assert.deepEqual(['29,99+64', '=566,19/3', '(10+5)*2', '1 200,50', '12-', 'alert(1)', '2*(3'].map(U.calcul), [93.99, 188.73, 30, 1200.5, null, null, null]);
  assert.deepEqual(['29,99+64', '=12', '12', '1 200,50'].map(U.estCalcul), [true, true, false, false]);
  // graduation d'axe : jamais de signe moins
  assert.equal(U.graduation(-50000).replace(/\s/g, ' '), '500 €');
  assert.equal(U.couleurGraduation(-1), 'var(--bad)');
});

// Série UX : préférences de la 0.9.4 retrouvées par la dernière version, sans passer par les versions intermédiaires.
test('migration des préférences d\'affichage 0.9.4 → 0.10.x : sections repliées une seule fois, période, tendance, thème gardés', () => {
  const mem = {
    'klad.replis': JSON.stringify({ actions: 0, 'tend-panel': 1, 'p-contrats': 0, 'cats-panel': 0, 'rules-panel': 1, 'eq-ops-panel': 0, 'budget-main': 1 }),
    'klad.periode': JSON.stringify({ from: '2025-11', to: '2026-10', n: 12 }), 'klad.tendance': JSON.stringify({ comptes: 'auto', mode: 'cum' }), 'klad.theme': 'sombre'
  };
  const avant = JSON.stringify(mem);
  const localStorage = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
  const { KladUI: U } = charge(['anon.js', 'eb.js', 'format.js', 'modele.js', 'classement.js', 'ui.js'], { localStorage });
  // sections gardées sous leur identifiant ; Tendance et Contrats (sous-vues) et Catégories / Règles (Plus) retirées
  assert.equal(U.replie('actions'), false);
  assert.equal(U.replie('budget-main'), true);
  assert.equal(U.replie('eq-ops-panel'), false);
  assert.equal(U.replie('tend-panel'), false);
  assert.equal(U.replie('p-contrats'), false);
  assert.deepEqual(JSON.parse(mem['klad.replis.v2']), { actions: 0, 'eq-ops-panel': 0, 'budget-main': 1 });
  assert.equal(mem['klad.replis.v'], '2');
  // ancienne clé intacte (retour arrière possible), autres préférences inchangées
  for (const k of ['klad.replis', 'klad.periode', 'klad.tendance', 'klad.theme']) assert.equal(mem[k], JSON.parse(avant)[k], k);
  assert.deepEqual(json(U.pref('periode')), { from: '2025-11', to: '2026-10', n: 12 });
  assert.deepEqual(json(U.pref('tendance')), { comptes: 'auto', mode: 'cum' });
  // une seule fois : une nouvelle lecture (appli relancée) ne refait pas la migration
  U.plier('actions', true);
  mem['klad.replis'] = JSON.stringify({ actions: 0 });
  const { KladUI: U2 } = charge(['anon.js', 'eb.js', 'format.js', 'modele.js', 'classement.js', 'ui.js'], { localStorage });
  assert.equal(U2.replie('actions'), true);
  // table de correspondance : identifiants inconnus gardés tels quels
  assert.deepEqual(json(U.migrerPlis({ 'cats-panel': 1, 'x-panel': 1 })), { 'x-panel': 1 });
});
