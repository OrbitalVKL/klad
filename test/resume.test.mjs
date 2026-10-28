// Tests : résumé lu par Grafit (Lien Grafit) — contenu, omissions, alertes, aucune donnée sensible, taille,
// écritures limitées aux vrais changements. Données fictives uniquement.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { charge, json } from './charge.mjs';

const { KladModele: M, KladResume: R } = charge(['anon.js', 'eb.js', 'modele.js', 'resume.js']);
const NOW = Date.parse('2026-10-28T10:00:00Z');
const H = n => new Date(NOW - n * 3600e3).toISOString();
const IBAN1 = 'FR7600000000000000000012345';
const IBAN2 = 'FR7600000000000000000067890';

// Opération Enable Banking fictive.
const eb = (date, montant, label, o = {}) => Object.assign({
  booking_date: date, transaction_amount: { amount: String(Math.abs(montant) / 100), currency: 'EUR' },
  credit_debit_indicator: montant < 0 ? 'DBIT' : 'CRDT', remittance_information: [label], status: 'BOOK'
}, o);

function etat() {
  const S = M.vide();
  S.modele.connexions.s1 = { banque: 'Banque Fictive du Nord', pays: 'FR', valid_until: new Date(NOW + 80 * 864e5).toISOString(), psu: null };
  const a = M.nouveauCompte(S, { libelle: 'Courant', source: { type: 'eb', connexion: 's1', uid: 'uid-fictif-1', empreinte: 'e1', fin4: '2345', intitule: 'COMPTE CHEQUES M DUPONT' }, sync: { lu: H(2) } });
  M.soldesLus(S, a.id, [{ balance_type: 'CLBD', balance_amount: { amount: '1234.56' }, reference_date: '2026-10-27' },
    { balance_type: 'ITAV', balance_amount: { amount: '1200.00' } }], NOW - 2 * 3600e3);
  M.integrer(S, a.id, [eb('2026-10-20', -4200, 'CB BOULANGERIE FICTIVE', { entry_reference: 'REF-FICTIVE-0001' }),
    eb('2026-10-21', 250000, 'VIREMENT SALAIRE FICTIF')], NOW);
  const l = M.nouveauCompte(S, { libelle: 'Livret épargne', role: 'epargne', solde: { centimes: 500000, date: '2026-10-20' } });
  return { S, a, l };
}
const resume = (S, now = NOW) => json(R.construire(S, now));

test('construction : comptes visibles dans l\'ordre, soldes en euros, date de référence, relevé, totaux', () => {
  const { S, a, l } = etat();
  const m = M.nouveauCompte(S, { libelle: 'Masqué', role: 'courant', masque: true, solde: { centimes: 99, date: '2026-10-01' } });
  const r = resume(S);
  assert.equal(r.v, 1); assert.equal(r.state, 'ok'); assert.equal(r.generated, NOW);
  assert.equal(r.statement_at, NOW - 2 * 3600e3);
  assert.deepEqual(r.accounts, [
    { id: a.id, label: 'COURANT', kind: 'current', balance: 1234.56, available: 1200, as_of: '2026-10-27', stale: false },
    { id: l.id, label: 'LIVRET EPARGNE', kind: 'savings', balance: 5000, as_of: '2026-10-20', manual: true }]);
  assert.ok(r.accounts.every(x => /^[a-z0-9]{8}$/.test(x.id)));
  assert.ok(!r.accounts.some(x => x.id === m.id));
  assert.deepEqual(r.total, { all: 6234.56, savings: 5000 });
  assert.deepEqual(r.alerts, []);
  for (const k of ['month', 'commun', 'upcoming', 'main_after_card', 'due']) assert.ok(!(k in r), k);
  // ordre de Klad
  a.ordre = 5;
  assert.deepEqual(resume(S).accounts.map(x => x.id), [l.id, a.id]);
});

test('types de comptes ; disponible omis s\'il est égal au solde affiché ; date de lecture à défaut de date de référence', () => {
  const S = M.vide();
  S.modele.connexions.s1 = { banque: 'Banque Fictive', pays: 'FR', valid_until: new Date(NOW + 80 * 864e5).toISOString() };
  const roles = ['courant', 'commun', 'carte_differee', 'paiement_en_ligne', 'epargne'];
  for (const role of roles) M.nouveauCompte(S, { libelle: role, role, source: { type: 'eb', connexion: 's1', uid: 'u-' + role }, sync: { lu: H(1) } });
  const c = S.modele.comptes[0];
  M.soldesLus(S, c.id, [{ balance_type: 'ITAV', balance_amount: { amount: '10.00' } }], Date.parse('2026-10-26T12:00:00Z'));
  const r = resume(S);
  assert.deepEqual(r.accounts.map(x => x.kind), ['current', 'current', 'card', 'wallet', 'savings']);
  assert.deepEqual(r.accounts[0], { id: c.id, label: 'COURANT', kind: 'current', balance: 10, as_of: '2026-10-26', stale: false });
});

test('aucun IBAN, aucune fin d\'IBAN, aucun identifiant ni libellé d\'opération, aucun nom de banque', () => {
  const { S, a } = etat();
  const c = M.nouveauCompte(S, { libelle: 'Compte joint', role: 'commun', source: { type: 'eb', connexion: 's1', uid: 'uid-fictif-2', empreinte: 'e2', fin4: '7890' }, sync: { lu: H(1) } });
  M.soldesLus(S, c.id, [{ balance_type: 'CLBD', balance_amount: { amount: '-15.00' } }], NOW);
  // libellés saisis avec un IBAN, une fin d'IBAN, un numéro, un e-mail : retirés
  a.libelle = 'CC ' + IBAN1;
  c.libelle = 'JOINT 7890 n°1234567 x@exemple.fr';
  const j = JSON.stringify(R.construire(S, NOW));
  const r = JSON.parse(j);
  // textes du résumé (clés et valeurs), sans les id internes de Klad (8 caractères tirés au hasard) ni les dates
  const textes = [];
  (function parcourir(o) {
    for (const k of Object.keys(o)) {
      textes.push(k);
      if (o[k] && typeof o[k] === 'object') parcourir(o[k]);
      else if (typeof o[k] === 'string' && k !== 'id' && k !== 'as_of') textes.push(o[k]);
    }
  })(r);
  const t = textes.join(' ');
  const interdits = [IBAN1, IBAN2, '2345', '7890', '1234567', 'EXEMPLE', 'exemple', 'uid', 'e1', 'REF', 'BOULANGERIE', 'SALAIRE',
    'DUPONT', 'CHEQUES', 'Banque', 'BANQUE', 's1', 'FR76'];
  for (const x of interdits) assert.ok(!t.includes(x), x);
  assert.doesNotMatch(j, /[A-Z]{2}\d{2}(?:\s?[A-Z0-9]){10,30}/);              // motif d'IBAN, partout
  assert.doesNotMatch(t, /\d{4,}/);                                            // ni fin d'IBAN, ni numéro dans les textes
  for (const o of Object.values(S.ops).flat()) { assert.ok(!j.includes(o.id), 'id d\'opération'); assert.ok(!j.includes(o.libelle)); }
  assert.deepEqual(r.accounts.map(x => x.label), ['CC', 'LIVRET EPARGNE', 'JOINT N°']);
  for (const x of r.accounts) for (const k of Object.keys(x)) assert.ok(['id', 'label', 'kind', 'balance', 'available', 'as_of', 'stale', 'manual'].includes(k), k);
});

test('libellés en majuscules, sans accents ; libellé générique pour un compte encore à vérifier', () => {
  const S = M.vide();
  const lib = l => R.libelle(M.nouveauCompte(S, { libelle: l }));
  assert.equal(lib('Épargne Noël'), 'EPARGNE NOEL');
  assert.equal(lib('  carte   bleue '), 'CARTE BLEUE');
  assert.equal(lib('Commun « maison »'), 'COMMUN « MAISON »');
  assert.equal(lib('Пётр'), 'ПЕТР');
  // libellé venu de la banque, jamais confirmé : peut contenir le nom du titulaire
  assert.equal(R.libelle(M.nouveauCompte(S, { libelle: 'M JEAN FICTIF', aVerifier: true })), 'COMPTE COURANT');
  assert.equal(R.libelle(M.nouveauCompte(S, { libelle: 'LIVRET M FICTIF', role: 'epargne', aVerifier: true })), 'EPARGNE');
  assert.equal(lib('12345678'), 'COMPTE COURANT');
  const { S: S2 } = etat();
  for (const x of R.construire(S2, NOW).accounts) assert.equal(x.label, x.label.toUpperCase());
});

test('centimes → euros sans erreur d\'arrondi', () => {
  const { S, a, l } = etat();
  const ca = [1, 10, 29, 57, 99, 101, 110, 1999, 100000001, 123456789, -1, -29, -100099, 7, 3333];
  for (const c of ca) {
    l.solde = { centimes: c, date: '2026-10-20' };
    const v = R.construire(S, NOW).accounts.find(x => x.id === l.id).balance;
    const attendu = (c < 0 ? '-' : '') + Math.floor(Math.abs(c) / 100) + '.' + String(Math.abs(c) % 100).padStart(2, '0');
    assert.equal(v, +attendu, String(c));
    assert.equal(JSON.stringify(v), attendu.replace(/\.?0+$/, '') || '0', String(c));
  }
  // total : somme en centimes, puis conversion (0,10 + 0,20 = 0,30 exactement)
  S.soldes[a.id].types.CLBD.centimes = 10;
  l.solde = { centimes: 20, date: '2026-10-20' };
  assert.equal(R.construire(S, NOW).total.all, 0.3);
});

test('omissions : carte à débit différé sans solde ; total général omis tant qu\'une carte est visible ; solde inconnu', () => {
  const { S, a } = etat();
  const c = M.nouveauCompte(S, { libelle: 'Carte', role: 'carte_differee', prelevement: { compte: a.id, jour: 5 },
    source: { type: 'eb', connexion: 's1', uid: 'uid-fictif-3' }, sync: { lu: H(1) } });
  M.soldesLus(S, c.id, [{ balance_type: 'CLBD', balance_amount: { amount: '-321.00' } }, { balance_type: 'ITAV', balance_amount: { amount: '2000.00' } }], NOW);
  let r = resume(S);
  const carte = r.accounts.find(x => x.id === c.id);
  assert.deepEqual(carte, { id: c.id, label: 'CARTE', kind: 'card', stale: false });
  assert.ok(!('due' in carte) && !('due_since' in carte));
  assert.deepEqual(r.total, { savings: 5000 });
  assert.ok(!r.alerts.some(x => x.code === 'NEGATIVE_BALANCE'));
  // carte masquée : total général de nouveau calculé
  c.masque = true;
  assert.deepEqual(resume(S).total, { all: 6234.56, savings: 5000 });
  // un compte compté sans solde connu : total omis, jamais 0
  const e = M.nouveauCompte(S, { libelle: 'PEL', role: 'epargne' });
  r = resume(S);
  assert.deepEqual(r.accounts.find(x => x.id === e.id), { id: e.id, label: 'PEL', kind: 'savings', manual: true });
  assert.equal(r.total, undefined);
  // compte jamais lu : ni solde, ni date, relevé périmé ; pas de « statement_at » sans lecture réussie
  const S2 = M.vide();
  S2.modele.connexions.s1 = { banque: 'Banque Fictive', pays: 'FR', valid_until: new Date(NOW + 80 * 864e5).toISOString() };
  const n = M.nouveauCompte(S2, { libelle: 'Neuf', source: { type: 'eb', connexion: 's1', uid: 'u' } });
  r = resume(S2);
  assert.deepEqual(r.accounts, [{ id: n.id, label: 'NEUF', kind: 'current', stale: true }]);
  assert.ok(!('statement_at' in r) && !('total' in r));
  assert.deepEqual(r.alerts, [{ level: 'info', code: 'STALE', text: 'NEUF' }]);
});

test('alertes : relevé ancien, lecture en erreur, accès bientôt expiré ou expiré, compte débiteur', () => {
  const { S, a } = etat();
  const cx = S.modele.connexions.s1;
  const alertes = now => json(R.construire(S, now).alerts);
  assert.deepEqual(alertes(NOW), []);
  // relevé de plus de 30 h
  a.sync.lu = H(31);
  assert.deepEqual(alertes(NOW), [{ level: 'info', code: 'STALE', text: 'COURANT · 1 J' }]);
  a.sync.lu = H(55);
  assert.deepEqual(alertes(NOW), [{ level: 'info', code: 'STALE', text: 'COURANT · 2 J' }]);
  assert.equal(R.construire(S, NOW).accounts[0].stale, true);
  a.sync.lu = H(2);
  // dernière lecture en erreur
  a.sync.erreur = 'Erreur fictive';
  assert.deepEqual(alertes(NOW), [{ level: 'caut', code: 'SYNC_FAILED', text: 'COURANT' }]);
  delete a.sync.erreur;
  // accès bancaire : 10 jours → caut ; 3 jours → crit ; expiré → crit, 0 J
  cx.valid_until = new Date(NOW + 10.5 * 864e5).toISOString();
  assert.deepEqual(alertes(NOW), [{ level: 'caut', code: 'BANK_CONSENT_EXPIRING', text: 'COURANT · 10 J' }]);
  cx.valid_until = new Date(NOW + 3.5 * 864e5).toISOString();
  assert.deepEqual(alertes(NOW), [{ level: 'crit', code: 'BANK_CONSENT_EXPIRING', text: 'COURANT · 3 J' }]);
  cx.valid_until = new Date(NOW - 864e5).toISOString();
  assert.deepEqual(alertes(NOW), [{ level: 'crit', code: 'BANK_CONSENT_EXPIRING', text: 'COURANT · 0 J' }]);
  cx.valid_until = new Date(NOW + 80 * 864e5).toISOString();
  // compte courant débiteur (le montant n'apparaît pas) ; un livret débiteur n'est pas signalé
  S.soldes[a.id].types.CLBD.centimes = -4250;
  assert.deepEqual(alertes(NOW), [{ level: 'crit', code: 'NEGATIVE_BALANCE', text: 'COURANT' }]);
  // tri : crit, caut, info
  a.sync.lu = H(80); a.sync.erreur = 'x';
  assert.deepEqual(alertes(NOW).map(x => x.code), ['NEGATIVE_BALANCE', 'SYNC_FAILED', 'STALE']);
  for (const x of alertes(NOW)) { assert.equal(x.text, x.text.toUpperCase()); assert.doesNotMatch(x.text, /\d+[.,]\d\d|€/); }
});

test('« empty » sans compte visible', () => {
  const S = M.vide();
  assert.deepEqual(resume(S), { v: 1, state: 'empty', generated: NOW });
  M.nouveauCompte(S, { libelle: 'Caché', masque: true, solde: { centimes: 100, date: '2026-10-01' } });
  assert.equal(resume(S).state, 'empty');
});

test('taille : moins de 32 Ko avec 30 comptes', () => {
  const S = M.vide();
  S.modele.connexions.s1 = { banque: 'Banque Fictive', pays: 'FR', valid_until: new Date(NOW + 2 * 864e5).toISOString() };
  for (let i = 0; i < 30; i++) {
    const c = M.nouveauCompte(S, { libelle: 'COMPTE FICTIF ' + 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[i % 26] + ' LONG LIBELLE', role: M.ROLES[i % 5] === 'carte_differee' ? 'courant' : M.ROLES[i % 5],
      source: { type: 'eb', connexion: 's1', uid: 'u' + i }, sync: { lu: H(40), erreur: 'x' } });
    M.soldesLus(S, c.id, [{ balance_type: 'CLBD', balance_amount: { amount: '-123456789.99' } }, { balance_type: 'ITAV', balance_amount: { amount: '-123456789.01' } }], NOW);
  }
  const r = R.construire(S, NOW);
  assert.equal(r.accounts.length, 30);
  assert.ok(r.alerts.length >= 90);
  const n = new TextEncoder().encode(JSON.stringify(r)).length;
  assert.ok(n < 32 * 1024, n + ' octets');
  assert.ok(n <= R.MAX_OCTETS);
});

// Faux plugin KladGrafit : compte les écritures et les effacements.
function faux(json0 = null) {
  const P = { json: json0, ecritures: 0, effacements: 0, lectures: 0 };
  Object.assign(P, {
    async lire() { P.lectures++; return { ok: true, json: P.json }; },
    async ecrire(o) { P.json = o.json; P.ecritures++; return { ok: true }; },
    async effacer() { P.json = null; P.effacements++; return { ok: true }; }
  });
  return P;
}

test('écritures : désactivé par défaut, rien d\'écrit si rien ne change (à « generated » près), effacement', async () => {
  const { S, a } = etat();
  const P = faux();
  const L = R.creerLien(P);
  assert.equal(await L.maj(S, NOW), 'rien');                       // désactivé par défaut
  assert.equal(P.ecritures + P.effacements, 0);
  S.modele.grafit = { actif: true };
  assert.equal(await L.maj(S, NOW), 'ecrit');
  assert.equal(JSON.parse(P.json).generated, NOW);
  assert.equal(await L.maj(S, NOW + 60e3), 'inchange');            // seul « generated » diffère
  assert.equal(await L.maj(S, NOW + 120e3), 'inchange');
  assert.equal(P.ecritures, 1);
  assert.equal(P.lectures, 1);                                       // le fichier n'est relu qu'une fois
  a.libelle = 'Principal';                                           // renommage
  assert.equal(await L.maj(S, NOW + 180e3), 'ecrit');
  assert.equal(JSON.parse(P.json).accounts[0].label, 'PRINCIPAL');
  // le temps passe : relevé périmé → nouveau résumé
  assert.equal(await L.maj(S, NOW + 31 * 3600e3), 'ecrit');
  assert.equal(JSON.parse(P.json).accounts[0].stale, true);
  assert.equal(P.ecritures, 3);
  // écritures simultanées : une seule
  const [x, y] = await Promise.all([L.maj(S, NOW + 32 * 3600e3), L.maj(S, NOW + 32 * 3600e3)]);
  assert.deepEqual([x, y], ['inchange', 'inchange']);
  // désactivé : effacé une fois
  S.modele.grafit.actif = false;
  assert.equal(await L.maj(S, NOW), 'efface');
  assert.equal(await L.maj(S, NOW), 'rien');
  assert.equal(P.json, null); assert.equal(P.effacements, 1);
});

test('écritures : résumé déjà enregistré relu (après redémarrage), illisible remplacé, refus signalé', async () => {
  const { S } = etat();
  S.modele.grafit = { actif: true };
  const existant = JSON.stringify(Object.assign(R.construire(S, NOW - 3600e3), { generated: NOW - 3600e3 }));
  const P = faux(existant);
  assert.equal(await R.creerLien(P).maj(S, NOW), 'inchange');
  assert.equal(P.ecritures, 0);
  const Q = faux('{illisible');
  assert.equal(await R.creerLien(Q).maj(S, NOW), 'ecrit');
  // désactivé avec un résumé resté enregistré : effacé
  S.modele.grafit.actif = false;
  const E = faux(existant);
  assert.equal(await R.creerLien(E).maj(S, NOW), 'efface');
  // refus du plugin : erreur, rien de mémorisé, nouvel essai à la mise à jour suivante
  S.modele.grafit.actif = true;
  const F = faux();
  let refus = true;
  F.ecrire = async o => { if (refus) return { ok: false, reason: 'format' }; F.json = o.json; F.ecritures++; return { ok: true }; };
  const L = R.creerLien(F);
  await assert.rejects(L.maj(S, NOW), /refusé \(format\)/);
  refus = false;
  assert.equal(await L.maj(S, NOW), 'ecrit');
  assert.equal(await L.effacer(), 'efface');
  assert.equal(F.json, null);
});

test('le résumé ne dépend pas d\'un réglage du modèle hors Grafit et ne modifie pas l\'état', () => {
  const { S } = etat();
  const avant = JSON.stringify(S);
  R.construire(S, NOW);
  assert.equal(JSON.stringify(S), avant);
  assert.equal(R.signature({ v: 1, generated: 1, a: 2 }), R.signature('{"v":1,"generated":5,"a":2}'));
});
