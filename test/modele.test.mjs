// Tests : modèle, identifiants, dédoublonnage (en cours → comptabilisée), frontière, blocs, migration 0.2, renouvellement.
// Données fictives uniquement.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { charge, json } from './charge.mjs';

const { KladModele: M } = charge(['anon.js', 'eb.js', 'modele.js']);
const NOW = Date.parse('2026-10-28T10:00:00Z');
const J = n => NOW + n * 864e5;

// Opération Enable Banking fictive.
function eb(date, montant, label, o = {}) {
  return Object.assign({
    booking_date: date, transaction_amount: { amount: String(Math.abs(montant) / 100), currency: 'EUR' },
    credit_debit_indicator: montant < 0 ? 'DBIT' : 'CRDT', remittance_information: [label], status: 'BOOK'
  }, o);
}
const enCours = (date, montant, label, o = {}) => eb(date, montant, label, Object.assign({ status: 'PDNG' }, o));

function etat() {
  const S = M.vide();
  const c = M.nouveauCompte(S, { libelle: 'COURANT', source: { type: 'eb', connexion: 's1', uid: 'u1', empreinte: 'e1', fin4: '0001' } });
  S.modele.connexions.s1 = { banque: 'Banque Fictive', pays: 'FR', valid_until: new Date(J(100)).toISOString(), psu: null };
  return { S, c };
}
const ops = (S, c) => json(S.ops[c.id] || []);
const resume = (S, c) => ops(S, c).map(o => [o.date, o.montant, o.statut, o.libelle]);

test('identifiants : référence bancaire, sinon empreinte + rang parmi les identiques du même jour', () => {
  const { S, c } = etat();
  M.integrer(S, c.id, [
    eb('2026-10-01', -1250, 'CB BOULANGERIE', { entry_reference: 'REF-1' }),
    eb('2026-10-01', -300, 'CB CAFE'),
    eb('2026-10-01', -300, 'CB  café'),                // même libellé normalisé : rang 1
    eb('2026-10-02', -300, 'CB CAFE')
  ], NOW);
  const ids = ops(S, c).map(o => o.id);
  assert.ok(ids.includes(c.id + ':r:REF-1'));
  const cafe = ops(S, c).filter(o => /CAF/i.test(o.libelle) && o.date === '2026-10-01').map(o => o.id.split(':'));
  assert.equal(cafe.length, 2);
  assert.equal(cafe[0][2], cafe[1][2]);
  assert.deepEqual(cafe.map(x => x[3]).sort(), ['0', '1']);
  // relu à l'identique : aucun doublon, aucune mise à jour
  const st = M.integrer(S, c.id, [
    eb('2026-10-01', -1250, 'CB BOULANGERIE', { entry_reference: 'REF-1' }), eb('2026-10-01', -300, 'CB CAFE'),
    eb('2026-10-01', -300, 'CB  café'), eb('2026-10-02', -300, 'CB CAFE')], J(1));
  assert.equal(st.nouvelles, 0); assert.equal(st.maj, 0);
  assert.equal(ops(S, c).length, 4);
  assert.ok(ops(S, c).every(o => Number.isInteger(o.montant)));
  assert.ok(ops(S, c).every(o => o.apparue === '2026-10-28' && o.categorie === null && o.vue === false));
});

test('opérations annulées ou rejetées ignorées ; date de valeur et contrepartie gardées', () => {
  const { S, c } = etat();
  const st = M.integrer(S, c.id, [
    eb('2026-10-01', -500, 'X', { status: 'CNCL' }), eb('2026-10-01', -500, 'Y', { status: 'RJCT' }),
    eb('2026-10-03', 20000, 'VIREMENT', { value_date: '2026-10-02', debtor: { name: 'Employeur Fictif' } })], NOW);
  assert.equal(st.ignorees, 2);
  const o = ops(S, c)[0];
  assert.equal(o.dateValeur, '2026-10-02');
  assert.equal(o.contrepartie, 'Employeur Fictif');
  assert.equal(o.libelle, 'Employeur Fictif · VIREMENT');
  assert.equal(o.montant, 20000);
});

test('en cours → comptabilisée : libellé allongé (dans les deux sens), on garde la comptabilisée', () => {
  for (const [court, long] of [['CB SUPERMARCHE', 'CB SUPERMARCHE 12/10 VILLE FICTIVE'], ['PAIEMENT CB SUPERMARCHE FICTIF 1210', 'PAIEMENT CB SUPERMARCHE']]) {
    const { S, c } = etat();
    M.integrer(S, c.id, [enCours('2026-10-12', -4599, court)], J(-14));
    assert.equal(ops(S, c)[0].statut, 'en_cours');
    const st = M.integrer(S, c.id, [eb('2026-10-14', -4599, long, { entry_reference: 'B1' })], J(-12));
    assert.equal(st.fusionnees, 1);
    assert.deepEqual(resume(S, c), [['2026-10-14', -4599, 'comptabilisee', long]]);
    assert.equal(ops(S, c)[0].apparue, '2026-10-14');        // date de première apparition de l'opération en cours
  }
});

test('en cours → comptabilisée : référence partagée (≥ 10 caractères avec un chiffre)', () => {
  const { S, c } = etat();
  M.integrer(S, c.id, [enCours('2026-10-10', -2000, 'PRLV ABC123456789')], J(-18));
  M.integrer(S, c.id, [eb('2026-10-13', -2000, 'PRELEVEMENT SEPA ABC123456789 ECHEANCE')], J(-15));
  assert.equal(ops(S, c).length, 1);
  assert.equal(ops(S, c)[0].statut, 'comptabilisee');
});

test('en cours → comptabilisée : rien si plus de 4 jours, autre montant ou libellés sans rapport', () => {
  const { S, c } = etat();
  M.integrer(S, c.id, [enCours('2026-10-01', -1000, 'CB LIBRAIRIE'), enCours('2026-10-01', -700, 'CB KIOSQUE'), enCours('2026-10-01', -900, 'CB GARAGE')], J(-25));
  const st = M.integrer(S, c.id, [
    enCours('2026-10-01', -1000, 'CB LIBRAIRIE'), enCours('2026-10-01', -700, 'CB KIOSQUE'), enCours('2026-10-01', -900, 'CB GARAGE'),
    eb('2026-10-06', -1000, 'CB LIBRAIRIE CENTRE'),      // 5 jours
    eb('2026-10-02', -701, 'CB KIOSQUE GARE'),           // autre montant
    eb('2026-10-02', -900, 'CB PRESSING')                // libellé sans rapport
  ], J(-24));
  assert.equal(st.fusionnees, 0);
  assert.equal(ops(S, c).length, 6);
});

test('prélèvements récurrents identiques à références différentes : jamais fusionnés', () => {
  const { S, c } = etat();
  M.integrer(S, c.id, [
    enCours('2026-10-05', -999, 'PORTEFEUILLE EN LIGNE'), enCours('2026-10-05', -999, 'PORTEFEUILLE EN LIGNE')], J(-23));
  M.integrer(S, c.id, [
    eb('2026-10-07', -999, 'PORTEFEUILLE EN LIGNE REF1111111111'), eb('2026-10-07', -999, 'PORTEFEUILLE EN LIGNE REF2222222222')], J(-21));
  assert.deepEqual(ops(S, c).map(o => o.statut), ['comptabilisee', 'comptabilisee']);   // deux en cours → deux comptabilisées
  // deux comptabilisées à références différentes ne se fusionnent pas, même relues
  M.integrer(S, c.id, [
    eb('2026-10-07', -999, 'PORTEFEUILLE EN LIGNE REF1111111111'), eb('2026-10-07', -999, 'PORTEFEUILLE EN LIGNE REF2222222222'),
    enCours('2026-10-08', -999, 'PORTEFEUILLE EN LIGNE REF3333333333')], J(-20));
  assert.equal(ops(S, c).length, 3);
  assert.equal(ops(S, c).filter(o => o.statut === 'en_cours').length, 1);   // référence propre : non absorbée
});

test('une opération en cours encore listée après sa fusion ne revient pas', () => {
  const { S, c } = etat();
  M.integrer(S, c.id, [enCours('2026-10-20', -1500, 'CB PHARMACIE')], J(-8));
  M.integrer(S, c.id, [enCours('2026-10-20', -1500, 'CB PHARMACIE'), eb('2026-10-21', -1500, 'CB PHARMACIE 20/10')], J(-7));
  M.integrer(S, c.id, [enCours('2026-10-20', -1500, 'CB PHARMACIE'), eb('2026-10-21', -1500, 'CB PHARMACIE 20/10')], J(-6));
  assert.deepEqual(resume(S, c), [['2026-10-21', -1500, 'comptabilisee', 'CB PHARMACIE 20/10']]);
});

test('opération en cours disparue sans comptabilisée : retirée 10 jours après sa date', () => {
  const { S, c } = etat();
  M.integrer(S, c.id, [enCours('2026-10-01', -3000, 'CB HOTEL CAUTION')], Date.parse('2026-10-01T12:00:00Z'));
  M.integrer(S, c.id, [], Date.parse('2026-10-03T12:00:00Z'));
  assert.equal(ops(S, c).length, 1);
  assert.equal(ops(S, c)[0].absente, '2026-10-03');
  M.integrer(S, c.id, [], Date.parse('2026-10-11T12:00:00Z'));
  assert.equal(ops(S, c).length, 1);
  const st = M.integrer(S, c.id, [], Date.parse('2026-10-12T12:00:00Z'));
  assert.equal(st.retirees, 1);
  assert.equal(ops(S, c).length, 0);
  // réapparue avant le délai : gardée
  M.integrer(S, c.id, [enCours('2026-10-20', -100, 'CB X')], Date.parse('2026-10-20T12:00:00Z'));
  M.integrer(S, c.id, [], Date.parse('2026-10-22T12:00:00Z'));
  M.integrer(S, c.id, [enCours('2026-10-20', -100, 'CB X')], Date.parse('2026-10-23T12:00:00Z'));
  assert.equal(ops(S, c)[0].absente, undefined);
  M.integrer(S, c.id, [enCours('2026-10-20', -100, 'CB X')], Date.parse('2026-11-05T12:00:00Z'));
  assert.equal(ops(S, c).length, 1);
});

test('frontière : opérations Enable Banking à la frontière ou avant ignorées ; début de récupération', () => {
  const { S, c } = etat();
  assert.equal(M.debutRecuperation(S, c), null);                 // nouveau compte : la plus longue période
  c.frontiere = '2026-10-10';
  assert.equal(M.debutRecuperation(S, c), '2026-10-11');
  const st = M.integrer(S, c.id, [eb('2026-10-09', -100, 'A'), eb('2026-10-10', -200, 'B'), eb('2026-10-11', -300, 'C'), enCours('2026-10-10', -50, 'D')], NOW);
  assert.equal(st.ignorees, 3);
  assert.deepEqual(resume(S, c), [['2026-10-11', -300, 'comptabilisee', 'C']]);
  M.integrer(S, c.id, [eb('2026-10-25', -300, 'E')], NOW);
  assert.equal(M.debutRecuperation(S, c), '2026-10-20');         // dernière comptabilisée − 5 jours
  c.frontiere = '2026-10-22';
  assert.equal(M.debutRecuperation(S, c), '2026-10-23');
  assert.equal(M.appliquerFrontiere(S, c.id), 1);
  assert.deepEqual(resume(S, c), [['2026-10-25', -300, 'comptabilisee', 'E']]);
});

test('soldes : dernier de chaque type, historique quotidien, solde affiché, total des comptes courants', () => {
  const { S, c } = etat();
  M.soldesLus(S, c.id, [
    { balance_type: 'ITAV', balance_amount: { amount: '-12.34', currency: 'EUR' } },
    { balance_type: 'CLBD', balance_amount: { amount: '100.00', currency: 'EUR' }, reference_date: '2026-10-27' }], NOW);
  M.soldesLus(S, c.id, [{ balance_type: 'CLBD', balance_amount: { amount: '90.10' } }], J(1));
  assert.equal(S.soldes[c.id].types.CLBD.centimes, 9010);
  assert.equal(S.soldes[c.id].types.ITAV.centimes, -1234);
  assert.deepEqual(json(S.soldes[c.id].jours), { '2026-10-28': 10000, '2026-10-29': 9010 });
  assert.equal(M.soldeAffiche(S, c).centimes, 9010);
  c.soldeType = 'ITAV';
  assert.equal(M.soldeAffiche(S, c).centimes, -1234);
  const l = M.nouveauCompte(S, { libelle: 'LIVRET', role: 'epargne', solde: { centimes: 500000, date: '2026-10-20' } });
  const m = M.nouveauCompte(S, { libelle: 'AUTRE', role: 'courant', solde: { centimes: 1000, date: '2026-10-20' } });
  M.nouveauCompte(S, { libelle: 'CACHE', role: 'courant', masque: true, solde: { centimes: 999999, date: '2026-10-20' } });
  assert.equal(M.soldeAffiche(S, l).centimes, 500000);
  assert.deepEqual(json(M.totalCourants(S)), { centimes: -234, n: 2 });
  assert.equal(m.ordre, 2);
});

test('alertes : relevé de plus de 30 h, accès bientôt expiré ou expiré', () => {
  const { S, c } = etat();
  assert.equal(M.alerteCompte(S, c, NOW), 'Relevé de plus de 30 h');
  c.sync = { lu: new Date(NOW - 3600e3).toISOString() };
  assert.equal(M.alerteCompte(S, c, NOW), null);
  S.modele.connexions.s1.valid_until = new Date(J(10)).toISOString();
  assert.equal(M.alerteCompte(S, c, NOW), 'Accès à renouveler');
  assert.equal(M.etatAcces(S.modele.connexions.s1, NOW), 'bientot');
  S.modele.connexions.s1.valid_until = new Date(J(-1)).toISOString();
  assert.equal(M.alerteCompte(S, c, NOW), 'Accès bancaire expiré');
});

test('blocs : par compte et par année ; une synchro ne change que l\'année en cours', () => {
  const { S, c } = etat();
  const vieux = [];
  for (let y = 2023; y <= 2026; y++) for (let i = 1; i <= 28; i++) vieux.push(eb(y + '-03-' + String(i).padStart(2, '0'), -100 * i, 'OP ' + i));
  M.integrer(S, c.id, vieux, NOW);
  const avant = json(M.versBlocs(S));
  assert.deepEqual(Object.keys(avant).filter(n => n.startsWith('ops-')).sort(),
    ['2023', '2024', '2025', '2026'].map(y => 'ops-' + c.id + '-' + y));
  assert.deepEqual(avant.modele.blocs[c.id], ['2023', '2024', '2025', '2026']);
  for (const n of Object.keys(avant)) if (n.startsWith('ops-')) assert.match(n, M.BLOC_OPS);
  M.integrer(S, c.id, [eb('2026-10-27', -4200, 'NOUVELLE')], J(1));
  const apres = json(M.versBlocs(S));
  const changes = Object.keys(apres).filter(n => JSON.stringify(apres[n]) !== JSON.stringify(avant[n]));
  assert.deepEqual(changes.filter(n => n.startsWith('ops-')), ['ops-' + c.id + '-2026']);
  // aller-retour sans perte
  const S2 = M.depuisBlocs(apres);
  assert.deepEqual(json(S2.ops), json(S.ops));
  assert.deepEqual(json(S2.modele), json(S.modele));
  assert.deepEqual(json(M.nomsOps(S2.modele)).sort(), Object.keys(apres).filter(n => n.startsWith('ops-')).sort());
});

test('empreinte d\'IBAN salée : stable, dépend du sel, IBAN non retrouvable', async () => {
  const a = M.compteEB({ uid: 'u9', account_id: { iban: 'FR76 0000 0000 0000 0000 0000 001' }, currency: 'EUR', product: 'Compte fictif' });
  assert.equal(a.fin4, '0001');
  const S = M.vide();
  const e1 = await M.empreinte(S.modele.sel, a);
  assert.equal(e1, await M.empreinte(S.modele.sel, M.compteEB({ uid: 'autre', account_id: { iban: 'FR7600000000000000000000001' } })));
  assert.notEqual(e1, await M.empreinte(M.vide().modele.sel, a));
  assert.match(e1, /^[0-9a-f]{32}$/);
  assert.doesNotMatch(e1, /FR76|0000000/);
  assert.equal(await M.empreinte(S.modele.sel, M.compteEB({ uid: 'x' })), null);
  assert.ok(await M.empreinte(S.modele.sel, M.compteEB({ uid: 'x', identification_hash: 'h-fictif' })));
});

test('renouvellement : comptes réassociés par empreinte, nouveaux créés, non retrouvés signalés', () => {
  const S = M.vide();
  const now = NOW;
  const r1 = M.associerSession(S, 's1', { banque: 'Banque Fictive', pays: 'FR', valid_until: '2026-11-01T00:00:00Z' },
    [{ uid: 'u1', produit: 'Compte courant', type: 'CACC', devise: 'EUR', fin4: '0001' },
      { uid: 'u2', produit: 'Livret', type: 'SVGS', devise: 'EUR', fin4: '0002' },
      { uid: 'u3', produit: 'Carte', type: 'CARD', devise: 'EUR', fin4: '9999' }], { u1: 'e1', u2: 'e2', u3: 'e3' }, now);
  assert.deepEqual(json(r1), { associes: 0, nouveaux: 3, perdus: 0, orphelines: [] });
  const [c1, c2, c3] = S.modele.comptes;
  assert.deepEqual([c1.role, c2.role, c3.role], ['courant', 'epargne', 'carte_differee']);
  c1.libelle = 'MON COURANT';
  S.ops[c1.id] = [{ id: c1.id + ':r:1', date: '2026-10-01', montant: -100 }];
  const r2 = M.associerSession(S, 's2', { banque: 'Banque Fictive', pays: 'FR', valid_until: '2027-04-01T00:00:00Z', renouvelle: 's1' },
    [{ uid: 'v1', produit: 'Compte courant', fin4: '0001' }, { uid: 'v2', produit: 'Livret', fin4: '0002' }, { uid: 'v4', produit: 'Nouveau', fin4: '0004' }],
    { v1: 'e1', v2: 'e2', v4: 'e4' }, now);
  assert.deepEqual(json(r2), { associes: 2, nouveaux: 1, perdus: 1, orphelines: [] });
  assert.equal(c1.libelle, 'MON COURANT');
  assert.deepEqual([c1.source.connexion, c1.source.uid], ['s2', 'v1']);
  assert.equal(S.ops[c1.id].length, 1);                          // historique conservé
  assert.equal(c3.aReassocier, true);
  assert.ok(S.modele.connexions.s1);                             // gardée tant qu'un compte y est rattaché
  assert.equal(S.modele.comptes.length, 4);
  // la carte revient à la session suivante : réassociée, ancienne session libérée
  const r3 = M.associerSession(S, 's3', { banque: 'Banque Fictive', pays: 'FR', renouvelle: 's1' },
    [{ uid: 'w3', produit: 'Carte', fin4: '9999' }], { w3: 'e3' }, now);
  assert.deepEqual(json(r3.orphelines), ['s1']);
  assert.equal(c3.aReassocier, undefined);
  assert.equal(S.modele.connexions.s1, undefined);
  // reconnexion de la même banque sans « Renouveler » : comptes repris, ancienne session libérée
  const r4 = M.associerSession(S, 's4', { banque: 'Banque Fictive', pays: 'FR' },
    [{ uid: 'z1', fin4: '0001' }, { uid: 'z2', fin4: '0002' }, { uid: 'z4', fin4: '0004' }], { z1: 'e1', z2: 'e2', z4: 'e4' }, now);
  assert.deepEqual(json(r4), { associes: 3, nouveaux: 0, perdus: 0, orphelines: ['s2'] });
  assert.deepEqual(Object.keys(S.modele.connexions).sort(), ['s3', 's4']);
});

// ------------------------------------------------------------ migration 0.2.x
const ANCIEN = {
  sessions: {
    s1: { bank: 'Banque Fictive', country: 'FR', valid_until: '2027-01-01T00:00:00Z', created: '2026-10-01T08:00:00.000Z',
      accounts: [
        { uid: 'u1', name: 'M. Titulaire Fictif', product: 'Compte courant', type: 'CACC', currency: 'EUR', iban: 'FR7600000000000000000000001' },
        { uid: 'u2', name: 'Livret', product: 'Livret', type: 'SVGS', currency: 'EUR', iban: '' }] }
  },
  pending: {},
  data: {
    u1: { from: '2026-07-01', fetched: Date.parse('2026-10-20T09:00:00Z'), error: '',
      balances: [{ balance_type: 'CLBD', balance_amount: { amount: '-45.67', currency: 'EUR' }, reference_date: '2026-10-19' }],
      txs: [
        { id: 'R1', date: '2026-10-18', label: 'CB BOULANGERIE', amount: -3.2, currency: 'EUR', pending: false },
        { id: null, date: '2026-10-18', label: 'CB BOULANGERIE', amount: -3.2, currency: 'EUR', pending: false },
        { id: null, date: '2026-10-19', label: 'VIREMENT', amount: 1234.56, currency: 'EUR', pending: false },
        { id: null, date: '2026-10-19', label: 'CB EPICERIE', amount: -19.99, currency: 'EUR', pending: true },
        { id: null, date: '2026-10-19', label: 'CB EPICERIE 19/10', amount: -19.99, currency: 'EUR', pending: false }] },
    u2: { fetched: Date.parse('2026-10-20T09:00:00Z'), balances: [], txs: [], error: 'Opérations : Enable Banking 500' }
  },
  banks: { FR: { at: 1, n: 3 } }, alias: { 'Banque Fictive': 'Banque A' }
};

test('migration 0.2 : conversion sans perte, montants en centimes, IBAN complet non repris', async () => {
  const { S, r } = await M.depuis02(json(ANCIEN), NOW);
  assert.deepEqual(json(r), { sessions: 1, comptes: 2, operations: 4, soldes: 1 });
  const [c1, c2] = S.modele.comptes;
  assert.equal(c1.libelle, 'Compte courant');
  assert.equal(c1.aVerifier, true);
  assert.deepEqual([c1.source.type, c1.source.connexion, c1.source.uid, c1.source.fin4], ['eb', 's1', 'u1', '0001']);
  assert.match(c1.source.empreinte, /^[0-9a-f]{32}$/);
  assert.equal(c2.role, 'epargne');
  assert.equal(c2.sync.erreur, 'Opérations : Enable Banking 500');
  assert.deepEqual(resume(S, c1), [
    ['2026-10-19', 123456, 'comptabilisee', 'VIREMENT'],
    ['2026-10-19', -1999, 'comptabilisee', 'CB EPICERIE 19/10'],          // en cours fusionnée dans la comptabilisée
    ['2026-10-18', -320, 'comptabilisee', 'CB BOULANGERIE'],
    ['2026-10-18', -320, 'comptabilisee', 'CB BOULANGERIE']]);
  assert.ok(S.ops[c1.id].some(o => o.id === c1.id + ':r:R1'));
  assert.equal(M.soldeAffiche(S, c1).centimes, -4567);
  assert.equal(S.modele.connexions.s1.cree, '2026-10-01T08:00:00.000Z');
  assert.equal(S.modele.alias['Banque Fictive'], 'Banque A');
  assert.doesNotMatch(JSON.stringify(json(M.versBlocs(S))), /FR760000|Titulaire/);
});

test('événement « données changées » : regroupé, un seul appel par rafale', async () => {
  const recus = [];
  const off = M.surChangement(c => recus.push(c.slice().sort()));
  M.signaler('synchro', 10); M.signaler('reglage', 10); M.signaler('synchro', 10);
  await new Promise(r => setTimeout(r, 40));
  assert.deepEqual(json(recus), [['reglage', 'synchro']]);
  off();
  M.signaler('import', 5);
  await new Promise(r => setTimeout(r, 20));
  assert.equal(recus.length, 1);
});
