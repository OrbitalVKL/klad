// Tests 1.1.2 : une même opération enregistrée deux fois. La banque renvoie le J une opération comptabilisée sans
// référence (identifiant fabriqué à partir de la date), puis le J+1 la même, datée du lendemain, avec une référence
// ajoutée au libellé et un autre identifiant. À la relecture, l'ancienne version (plus renvoyée) est fusionnée dans la
// nouvelle (classement, « vu » et rapprochements suivent) ; une opération plus renvoyée sans remplaçante est retirée ;
// deux vraies opérations identiques ne sont jamais fusionnées. Migration : doublons déjà enregistrés retirés une fois,
// remis en un appui pendant 7 jours. Données fictives uniquement.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { charge, json } from './charge.mjs';

const X = charge(['anon.js', 'eb.js', 'modele.js', 'classement.js', 'carnet.js', 'budget.js', 'migrations.js']);
const { KladModele: M, KladMigrations: MG } = X;
const J0 = Date.parse('2026-10-30T18:00:00Z'), J1 = Date.parse('2026-10-31T18:00:00Z');

// Opération Enable Banking fictive (identifiant de la banque fabriqué à partir de la date, comme constaté).
const eb = (date, montant, label, rang, o) => Object.assign({ booking_date: date, value_date: date, transaction_amount: { amount: String(Math.abs(montant) / 100), currency: 'EUR' },
  credit_debit_indicator: montant < 0 ? 'DBIT' : 'CRDT', remittance_information: [label], status: 'BOOK', transaction_id: date + 'T00:00:00-' + rang }, o || {});
const VIRS = [[-60000, 'VIR CREDIT FICTIF VERS COMMUN', '4400100000000001'], [-15000, 'VIR COPRO FICTIVE VERS COMMUN', '4400100000000002'], [-9000, 'VIR CHARGES FICTIVES COMMUN', '4400100000000003']];

function etat() {
  const S = M.vide();
  const c = M.nouveauCompte(S, { libelle: 'COURANT', source: { type: 'eb', connexion: 's1', uid: 'u1', empreinte: 'e1', fin4: '0001' } });
  S.modele.connexions.s1 = { banque: 'Banque Fictive', pays: 'FR', valid_until: '2027-06-01T00:00:00Z', psu: null };
  return { S, c };
}
const autres = [eb('2026-10-27', -2500, 'CB LIBRAIRIE FICTIVE', 1, { transaction_id: 'REF-STABLE-1' }), eb('2026-10-28', 280000, 'VIR SALAIRE FICTIF', 1, { transaction_id: 'REF-STABLE-2' })];
// lecture du J : virements sans référence, datés du 30/10 ; lecture du J+1 : datés du 31/10, référence au libellé
const lectureJ = () => autres.concat(VIRS.map(([m, l], i) => eb('2026-10-30', m, l, i + 1)));
const lectureJ1 = () => autres.concat(VIRS.map(([m, l, ref], i) => eb('2026-10-31', m, l + ' ' + ref, i + 1)));
const somme = (S, c) => S.ops[c.id].reduce((t, o) => t + o.montant, 0);

test('scénario constaté : comptabilisée sans référence le J, relue avec référence le J+1 → une seule opération', () => {
  const { S, c } = etat();
  const s1 = M.integrer(S, c.id, lectureJ(), J0, { depuis: '2026-10-25' });
  assert.equal(s1.nouvelles, 5);
  // classement et « vu » faits à la main sur la première version
  const v = S.ops[c.id].find(o => o.libelle === 'VIR CREDIT FICTIF VERS COMMUN');
  v.categorie = { cat: 'Logement', sub: 'Contribution compte commun' }; v.vue = true;
  const id0 = v.id;
  assert.match(id0, /:r:2026-10-30T00:00:00-1$/);
  S.budget = { exc: { [id0]: true } };
  const s2 = M.integrer(S, c.id, lectureJ1(), J1, { depuis: '2026-10-25' });
  assert.deepEqual([s2.nouvelles, s2.fusionnees, s2.retirees], [3, 3, 0]);
  const L = json(S.ops[c.id]);
  assert.equal(L.length, 5, 'les 3 virements n\'apparaissent qu\'une fois');
  assert.deepEqual(L.filter(o => o.montant === -60000).map(o => [o.date, o.libelle]), [['2026-10-31', 'VIR CREDIT FICTIF VERS COMMUN 4400100000000001']]);
  const n = L.find(o => o.montant === -60000);
  assert.deepEqual(n.categorie, { cat: 'Logement', sub: 'Contribution compte commun' }, 'le classement suit');
  assert.equal(n.vue, true, 'le « vu » suit');
  assert.deepEqual(json(S.budget.exc), { [n.id]: true }, 'l\'exclusion du budget suit');
  // solde cohérent : un seul débit par virement (somme des opérations = mouvements réels)
  assert.equal(somme(S, c), 280000 - 2500 - 60000 - 15000 - 9000);
  // une relecture identique ne change plus rien
  const s3 = M.integrer(S, c.id, lectureJ1(), J1 + 3600e3, { depuis: '2026-10-25' });
  assert.deepEqual([s3.nouvelles, s3.fusionnees, s3.retirees], [0, 0, 0]);
});

test('en cours sans référence le J, comptabilisée avec référence le J+1 → une seule opération', () => {
  const { S, c } = etat();
  M.integrer(S, c.id, autres.concat(VIRS.map(([m, l], i) => eb('2026-10-30', m, l, i + 1, { status: 'PDNG', transaction_id: undefined }))), J0, { depuis: '2026-10-25' });
  S.ops[c.id].forEach(o => { if (o.statut === 'en_cours') o.vue = true; });
  const st = M.integrer(S, c.id, lectureJ1(), J1, { depuis: '2026-10-25' });
  assert.equal(st.fusionnees, 3);
  assert.equal(S.ops[c.id].length, 5);
  assert.ok(S.ops[c.id].filter(o => o.montant < -5000).every(o => o.statut === 'comptabilisee' && o.vue === true));
  assert.equal(somme(S, c), 280000 - 2500 - 84000);
});

test('contre-épreuve : deux vraies opérations identiques (même jour, même montant) ne sont jamais fusionnées', () => {
  const { S, c } = etat();
  const deux = d => autres.concat([eb(d, -9000, 'VIR CHARGES FICTIVES COMMUN', 1), eb(d, -9000, 'VIR CHARGES FICTIVES COMMUN', 2)]);
  M.integrer(S, c.id, deux('2026-10-30'), J0, { depuis: '2026-10-25' });
  const st = M.integrer(S, c.id, deux('2026-10-30'), J1, { depuis: '2026-10-25' });
  assert.deepEqual([st.fusionnees, st.retirees], [0, 0]);
  assert.equal(S.ops[c.id].filter(o => o.montant === -9000).length, 2);
  // deux références distinctes : deux opérations, lues ensemble
  const { S: S2, c: c2 } = etat();
  const refs = autres.concat([eb('2026-10-31', -9000, 'VIR CHARGES FICTIVES COMMUN 4400100000000003', 1), eb('2026-10-31', -9000, 'VIR CHARGES FICTIVES COMMUN 4400100000000004', 2)]);
  M.integrer(S2, c2.id, refs, J0, { depuis: '2026-10-25' });
  M.integrer(S2, c2.id, refs, J1, { depuis: '2026-10-25' });
  assert.equal(S2.ops[c2.id].filter(o => o.montant === -9000).length, 2);
  assert.equal(somme(S2, c2), 280000 - 2500 - 18000);
  // et la migration ne les touche pas non plus
  assert.deepEqual(json(MG.doublons(S, J1)), { n: 0 });
  assert.deepEqual(json(MG.doublons(S2, J1)), { n: 0 });
});

test('opération plus renvoyée sur la même période, sans remplaçante : gardée (1.3.2), à vérifier si elle est loin du bord ; jamais retirée', () => {
  const { S, c } = etat();
  M.integrer(S, c.id, autres.concat([eb('2026-10-29', -4200, 'PRLV ANNULE FICTIF', 1, { transaction_id: 'REF-X' }), eb('2026-10-10', -1000, 'CB ANCIENNE FICTIVE', 1, { transaction_id: 'REF-Y' })]), J0, { depuis: '2026-10-01' });
  S.ops[c.id].push({ id: c.id + ':m:1', compte: c.id, date: '2026-10-29', montant: -700, libelle: 'SAISIE A LA MAIN', source: 'manuel', statut: 'comptabilisee' });
  assert.equal(M.integrer(S, c.id, [], J1, { depuis: '2026-10-25' }).retirees, 0, 'aucune opération renvoyée : rien n\'est retiré');
  const st = M.integrer(S, c.id, autres, J1, { depuis: '2026-10-25' });
  assert.equal(st.retirees, 0, '1.3.2 : plus jamais retirée');
  assert.equal(st.gardees, 0, 'au bord de la période relue (moins de 5 jours après son début) : gardée sans signalement');
  const libs = S.ops[c.id].map(o => o.libelle);
  const pa = S.ops[c.id].find(o => o.libelle === 'PRLV ANNULE FICTIF');
  assert.ok(pa && !pa.nonRenvoyee, 'gardée');
  // relue depuis plus tôt : à plus de 5 jours du début, gardée, remise non vue et signalée ; une seule fois
  const st2 = M.integrer(S, c.id, autres, J1, { depuis: '2026-10-20' });
  assert.deepEqual([st2.retirees, st2.gardees], [0, 1]);
  assert.equal(pa.nonRenvoyee, M.jourLocal(J1));
  assert.equal(pa.vue, 0);
  assert.equal(M.integrer(S, c.id, autres, J1, { depuis: '2026-10-20' }).gardees, 0, 'signalée une fois');
  // renvoyée de nouveau par la banque : plus signalée
  M.integrer(S, c.id, autres.concat([eb('2026-10-29', -4200, 'PRLV ANNULE FICTIF', 1, { transaction_id: 'REF-X' })]), J1, { depuis: '2026-10-20' });
  assert.equal(S.ops[c.id].find(o => o.libelle === 'PRLV ANNULE FICTIF').nonRenvoyee, undefined);
  assert.ok(libs.includes('CB ANCIENNE FICTIVE'), 'avant la période relue : gardée');
  assert.ok(libs.includes('SAISIE A LA MAIN'), 'saisie à la main : gardée');
});

test('migration « doublons » : déjà enregistrés retirés une fois, état repris, annulable 7 jours', () => {
  const { S, c } = etat();
  // état de la 1.1.1 : les deux versions gardées
  M.integrer(S, c.id, lectureJ(), J0, { depuis: '2026-10-25' });
  const anciennes = json(S.ops[c.id].filter(o => o.date === '2026-10-30'));
  const L = S.ops[c.id];
  for (const x of lectureJ1().slice(2)) { const o = M.depuisEB(x); M.doterIds(c.id, [o], 'h'); L.push(M.nouvelleOp(c.id, o, 'eb', '2026-10-31')); }
  L.find(o => o.libelle === 'VIR COPRO FICTIVE VERS COMMUN').categorie = { cat: 'Logement', sub: 'Contribution compte commun' };
  assert.equal(L.length, 8);
  const avant = json(S.ops[c.id]);
  const r = MG.doublons(S, J1);
  assert.deepEqual(json(r), { n: 3 });
  assert.equal(S.ops[c.id].length, 5);
  assert.ok(S.ops[c.id].every(o => o.date !== '2026-10-30'), 'la version sans référence est retirée');
  assert.deepEqual(json(S.ops[c.id].find(o => o.montant === -15000).categorie), { cat: 'Logement', sub: 'Contribution compte commun' });
  assert.equal(somme(S, c), 280000 - 2500 - 84000);
  assert.equal(MG.doublons(S, J1), null, 'une seule fois');
  // annulable pendant 7 jours depuis le journal, plus après
  assert.deepEqual(json(MG.doublonsAnnulables(S, J1 + 6 * 864e5)), { n: 3, le: new Date(J1).toISOString() });
  assert.equal(MG.doublonsAnnulables(S, J1 + 8 * 864e5), null);
  assert.equal(MG.annulerDoublons(S, J1 + 864e5), true);
  const trier = l => json(l).sort((a, b) => (a.id < b.id ? -1 : 1));
  assert.deepEqual(trier(S.ops[c.id]), trier(avant), 'état d\'avant rendu');
  assert.equal(anciennes.length, 3);
  assert.equal(MG.doublonsAnnulables(S, J1 + 864e5), null, 'remis : plus rien à annuler');
  assert.equal(MG.doublons(S, J1 + 864e5), null, 'la migration ne se refait pas');
});
