// Tests : classement repris du carnet de l'ancienne version — catégories et natures, règles de base (renommages,
// partage bars / restaurants, comptes, transferts), règles de l'utilisateur, corrections et opérations vues retrouvées
// par l'identifiant stable de la reprise ou par la clé de l'ancienne version, motifs de règlement des cartes et
// portefeuilles. Carnet entièrement fictif.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { charge, json } from './charge.mjs';

const { KladModele: M, KladReprise: R, KladClasse: K, KladCarnet: CN } = charge(['anon.js', 'eb.js', 'modele.js', 'reprise.js', 'classement.js', 'carnet.js']);
const NOW = Date.parse('2026-10-28T10:00:00Z');

// Identifiant stable de la reprise : 'k' + sha256(clé)[0..20] + '.' + rang.
const cle = t => t.date + '|' + (t.amount / 100) + '|' + t.account.slice(1) + '|' + t.label.slice(0, 30);
function ids(txs) {
  const rang = {};
  return txs.map(t => { const k = cle(t); rang[k] = rang[k] || 0; return Object.assign({ id: 'k' + crypto.createHash('sha256').update(k).digest('hex').slice(0, 20) + '.' + (rang[k]++) }, t); });
}

const TXS = [
  { account: 'r0', date: '2026-09-01', amount: -1250, label: 'CB BRASSERIE FICTIVE' },
  { account: 'r0', date: '2026-09-02', amount: -2500, label: 'CB RESTAURANT FICTIF' },
  { account: 'r0', date: '2026-09-02', amount: -2500, label: 'CB RESTAURANT FICTIF' },
  { account: 'r0', date: '2026-09-03', amount: 250000, label: 'VIR EMPLOYEUR FICTIF' },
  { account: 'r0', date: '2026-09-04', amount: -4000, label: 'STATION CARBURANT FICTIVE' },
  { account: 'r0', date: '2026-09-05', amount: 3000, label: 'VIR AMI FICTIF' },
  { account: 'r0', date: '2026-09-25', amount: -8000, label: 'PRLV CARTE FICTIVE EXPRESS' },
  { account: 'r0', date: '2026-09-26', amount: -1299, label: 'PRLV PORTEFEUILLE FICTIF' },
  { account: 'r1', date: '2026-09-06', amount: -30000, label: 'PRLV PARKING FICTIF' },
  { account: 'r1', date: '2026-08-25', amount: -100, label: 'PRLV CARTE FICTIVE EXPRESS' },
  { account: 'r2', date: '2026-09-10', amount: -8000, label: 'CB LIBRAIRIE FICTIVE' },
  { account: 'r2', date: '2026-09-20', amount: -700, label: 'PORTEFEUILLE FICTIF *MARCHAND' },
  { account: 'r3', date: '2026-09-24', amount: -1299, label: 'MARCHAND EN LIGNE FICTIF' }
];

const CARNET = {
  cats: { custom: { 'Loisirs créatifs': { nat: 'optionnelle' }, 'Courses': { nat: 'courante' } }, removed: ['Divers'], renamed: { 'Bricolage': 'Maison' },
    icons: { 'Loisirs créatifs': 'svg:star' } },
  P: { rules: [
    ['^VIR AMI', 'transfert', 'Virements à des proches', 'Virements', null],
    ['EMPLOYEUR FICTIF', 'revenu', 'Revenus', 'Salaire', ['Courant perso fictif']],
    ['RESTAURANT|BRASSERIE', 'depense', 'Restaurants & bars', 'Restaurants & bars', null],
    ['CARBURANT', 'depense', 'Transport', 'Carburant', null],
    ['CARTE FICTIVE EXPRESS', 'depense', 'À détailler (carte)', 'Relevé carte', null],
    ['PORTEFEUILLE FICTIF', 'depense', 'À détailler (carte)', 'Portefeuille', null],
    ['LIBRAIRIE', 'depense', 'Bricolage', 'Bricolage', ['Compte commun fictif']],
    ['INUTILE', 'depense', 'Divers', 'Divers', null],
    ['([', 'depense', 'Cassée', 'Cassée', null]] },
  rules: [{ kw: 'station carburant', cat: 'Revenus', sub: 'Ventes (sites fictifs)' }, { kw: 'MARCHAND EN LIGNE', cat: 'Loisirs créatifs', sub: 'Jeux' }],
  singles: {}, seen: { cut: '2026-09-05', k: {} },
  klad: { comptes: ['Courant perso fictif', 'Autre courant', 'Compte commun fictif', 'Carte fictive', 'Portefeuille fictif'] }
};

function reprise(carnet) {
  const txs = ids(TXS);
  return R.valider({ format: 'klad-reprise', v: 1, created: '2026-10-01T10:00:00Z', source: 'carnet',
    accounts: [{ ref: 'r0', label: 'COURANT A', role: 'courant' }, { ref: 'r1', label: 'COURANT B', role: 'courant' }, { ref: 'r2', label: 'COMMUN', role: 'commun' },
      { ref: 'r3', label: 'PORTEFEUILLE', role: 'paiement_en_ligne' }, { ref: 'r4', label: 'CARTE', role: 'carte_differee', settle: { account: 'r0', day: 25 } }],
    transactions: txs.concat([{ account: 'r4', date: '2026-09-15', amount: -6000, label: 'CB VOYAGE FICTIF', id: 'autre.0' },
      { account: 'r4', date: '2026-09-28', amount: -2200, label: 'CB MUSEE FICTIF', id: 'autre.1' }]),
    carnet });
}

async function etat(extra) {
  const carnet = JSON.parse(JSON.stringify(CARNET));
  Object.assign(carnet, extra || {});
  const rep = reprise(carnet);
  const S = M.vide();
  const choix = {}; for (const c of rep.comptes) choix[c.ref] = 'creer';
  R.appliquer(S, rep, choix, { now: NOW });
  const map = S.modele.reprise.map;
  const opsDe = ref => S.ops[map[ref]];
  return { S, map, opsDe, carnet };
}
const cl = (S, o) => { const r = K.classer(K.contexte(S, NOW), o); return [r.type, r.cat, r.sub]; };
const trouve = (ops, lib) => ops.find(o => o.libelle === lib);

test('catégories : natures du carnet, nature déduite des règles, icônes, renommées et supprimées retirées', async () => {
  const { S } = await etat();
  assert.equal(CN.utilisable(S.carnet), true);
  assert.equal(CN.utilisable({ reglages: 'opaques' }), false);
  const r = json(await CN.convertir(S, S.carnet, { now: NOW }));
  const C = S.classement;
  assert.equal(C.categories['Loisirs créatifs'].nature, 'optionnelle');
  assert.equal(C.categories['Loisirs créatifs'].icone, '⭐');
  assert.equal(C.categories['Courses'].nature, 'courante');
  assert.equal(C.categories['Salaire'].nature, 'revenu');
  assert.equal(C.categories['Maison'].nature, 'optionnelle');
  assert.equal(C.categories['Bricolage'], undefined);
  assert.equal(C.categories['Divers'], undefined);
  assert.equal(C.categories['Revenus'], undefined);
  assert.equal(r.invalides, 1);
  assert.equal(r.base, 10);                    // 1 intégrée (parking) + 8 valides dont une partagée en deux
  assert.equal(r.regles, 2);
  assert.equal(r.depuis, '2026-09-05');
  assert.ok(C.import && C.import.le);
});

test('règles de base : ordre, comptes par la liste du carnet, renommages, bars / restaurants, transferts', async () => {
  const { S, opsDe } = await etat({ klad: Object.assign({}, CARNET.klad, { bars: '\\bBRASSERIE\\b' }) });
  await CN.convertir(S, S.carnet, { now: NOW });
  const a = opsDe('r0'), b = opsDe('r1'), c = opsDe('r2');
  assert.deepEqual(cl(S, trouve(a, 'CB BRASSERIE FICTIVE')), ['depense', 'Bars', 'Bars']);
  assert.deepEqual(cl(S, trouve(a, 'CB RESTAURANT FICTIF')), ['depense', 'Restaurant', 'Restaurant']);
  assert.deepEqual(cl(S, trouve(a, 'VIR EMPLOYEUR FICTIF')), ['revenu', 'Salaire', 'Salaire']);
  assert.deepEqual(cl(S, trouve(a, 'VIR AMI FICTIF')), ['revenu', 'Remboursements entre amis', 'Remboursements entre amis']);
  // règle de l'utilisateur vers « Revenus › Ventes » sur un débit : achat (revente)
  assert.deepEqual(cl(S, trouve(a, 'STATION CARBURANT FICTIVE')), ['depense', 'Shopping', 'Achats en ligne & magasins']);
  // règle intégrée de l'ancienne version : « PARKING » sur le compte commun seulement
  assert.equal(cl(S, trouve(b, 'PRLV PARKING FICTIF'))[1], 'Autres');
  // règle restreinte au compte commun (nom du carnet) ; catégorie renommée
  assert.deepEqual(cl(S, trouve(c, 'CB LIBRAIRIE FICTIVE')), ['depense', 'Maison', 'Maison']);
  const base = S.classement.base;
  assert.deepEqual(json(base.find(x => x.motif === 'EMPLOYEUR FICTIF').comptes), [S.modele.reprise.map.r0]);
  assert.ok(base.find(x => x.motif === 'CARTE FICTIVE EXPRESS').horsCartes);
});

test('comptes sans liste dans le carnet : par libellé de la reprise, sinon par rôle', async () => {
  const k = JSON.parse(JSON.stringify(CARNET.klad)); delete k.comptes;
  const { S, map } = await etat({ klad: k });
  S.modele.reprise.libelles.r0 = 'Courant perso fictif';
  await CN.convertir(S, S.carnet, { now: NOW });
  const base = S.classement.base;
  assert.deepEqual(json(base.find(x => x.motif === 'EMPLOYEUR FICTIF').comptes), [map.r0]);
  assert.deepEqual(json(base.find(x => x.motif === 'LIBRAIRIE').comptes), ['@commun']);
  assert.deepEqual(json(base.find(x => x.motif === 'PARKING').comptes), ['@commun']);
});

test('corrections et opérations vues : par identifiant de reprise (tous les rangs) et par clé pour les opérations bancaires', async () => {
  const resto = TXS[1];
  const singles = { [cle(resto)]: { cat: 'Restaurants & bars', sub: 'Restaurants & bars' }, 'cle|inconnue|0|x': { cat: 'Divers' } };
  const seen = { cut: '2026-09-05', k: { [cle(TXS[10])]: 'Y2026-10-01T10:00:00Z', [cle(TXS[0])]: 'N2026-10-01T10:00:00Z' } };
  const { S, opsDe, map } = await etat({ singles, seen });
  // opération venue de la banque après la reprise : retrouvée par la clé de l'ancienne version
  const eb = { id: map.r0 + ':r:REF1', compte: map.r0, date: '2026-10-02', montant: -900, libelle: 'CB MARCHE FICTIF', statut: 'comptabilisee', source: 'eb', categorie: null, vue: false };
  S.ops[map.r0].unshift(eb);
  S.carnet.singles[eb.date + '|-9|0|CB MARCHE FICTIF'] = { cat: 'Courses', sub: 'Marché' };
  const r = json(await CN.convertir(S, S.carnet, { now: NOW }));
  assert.equal(r.corrections, 3);
  assert.equal(r.correctionsRetrouvees, 2);
  assert.equal(r.vues, 2);
  assert.equal(r.vuesRetrouvees, 2);
  const a = opsDe('r0');
  const restos = a.filter(o => o.libelle === 'CB RESTAURANT FICTIF');
  assert.equal(restos.length, 2);
  for (const o of restos) assert.deepEqual(json(o.categorie), { cat: 'Restaurant', sub: 'Restaurant', src: 'carnet' });
  assert.deepEqual(json(eb.categorie), { cat: 'Courses', sub: 'Marché', src: 'carnet' });
  assert.deepEqual(json(S.modele.vues), { depuis: '2026-09-05' });
  assert.equal(K.vue(S, trouve(opsDe('r2'), 'CB LIBRAIRIE FICTIVE')), true);
  assert.equal(K.vue(S, trouve(a, 'CB BRASSERIE FICTIVE')), false);
  assert.equal(K.vue(S, trouve(a, 'VIR AMI FICTIF')), true);       // avant la date de départ
  assert.equal(K.vue(S, trouve(a, 'PRLV CARTE FICTIVE EXPRESS')), false);
  // rejouable : mêmes résultats, une correction faite dans Klad est gardée, les règles créées dans Klad aussi
  eb.categorie = { cat: 'Cadeaux', sub: 'Cadeaux' };
  S.classement.regles.push({ mot: 'LIBRAIRIE', cat: 'Formation & éducation' });
  S.classement.regles.push({ mot: 'MARCHAND EN LIGNE', cat: 'Shopping' });
  await CN.convertir(S, S.carnet, { now: NOW });
  assert.deepEqual(json(S.classement.regles.map(u => u.mot)), ['station carburant', 'LIBRAIRIE', 'MARCHAND EN LIGNE']);
  assert.equal(S.classement.regles.find(u => u.mot === 'MARCHAND EN LIGNE').cat, 'Shopping');
  assert.equal(eb.categorie.cat, 'Courses');            // la correction du carnet est réappliquée sur la même opération
});

test('cartes et portefeuilles : motifs déduits des règles « à détailler », ou donnés par le carnet ; dette et anti-double-comptage', async () => {
  const { S, map, opsDe } = await etat();
  await CN.convertir(S, S.carnet, { now: NOW });
  const carte = M.compte(S, map.r4), pf = M.compte(S, map.r3);
  assert.equal(pf.prelevement.motif, 'PORTEFEUILLE FICTIF');
  assert.equal(carte.prelevement.motif, 'CARTE FICTIVE EXPRESS');
  assert.equal(carte.prelevement.compte, map.r0);
  assert.deepEqual(json(K.dette(S, carte, NOW)), { centimes: 2200, depuis: '2026-09-25', n: 1, le: '2026-10-25' });
  const a = opsDe('r0');
  assert.deepEqual(cl(S, trouve(a, 'PRLV CARTE FICTIVE EXPRESS')), ['interne', 'Virements internes', 'Règlement CARTE (détaillé)']);
  assert.deepEqual(cl(S, trouve(a, 'PRLV PORTEFEUILLE FICTIF')), ['interne', 'Virements internes', 'Règlement PORTEFEUILLE (détaillé)']);
  assert.deepEqual(cl(S, trouve(opsDe('r3'), 'MARCHAND EN LIGNE FICTIF')), ['depense', 'Loisirs créatifs', 'Jeux']);
  // réglages donnés par le carnet : prioritaires
  const k2 = Object.assign({}, CARNET.klad, { cartes: { r4: { motif: 'CARTE FICTIVE', remboursements: 'MERCI' } } });
  const e2 = await etat({ klad: k2 });
  const rp = json(await CN.convertir(e2.S, e2.S.carnet, { now: NOW }));
  assert.deepEqual(json(M.compte(e2.S, e2.map.r4).prelevement), { compte: e2.map.r0, jour: 25, motif: 'CARTE FICTIVE', remboursements: 'MERCI' });
  assert.equal(rp.cartes, 1);
  assert.equal(rp.portefeuilles, 1);
});

