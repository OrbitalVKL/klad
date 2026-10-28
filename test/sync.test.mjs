// Tests : récupération automatique avec un faux client Enable Banking — incrémentale, erreurs par compte,
// en-têtes « utilisateur présent », journal anonyme, aucun doublon après deux synchros. Données fictives.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { charge, json } from './charge.mjs';

const { KladModele: M, KladSync: Y } = charge(['anon.js', 'eb.js', 'modele.js', 'sync.js']);
const NOW = Date.parse('2026-10-28T10:00:00Z');

const tx = (date, montant, label, o = {}) => Object.assign({ booking_date: date, transaction_amount: { amount: String(Math.abs(montant) / 100) },
  credit_debit_indicator: montant < 0 ? 'DBIT' : 'CRDT', remittance_information: [label], status: 'BOOK' }, o);

function faux(donnees, opts = {}) {
  const appels = [];
  return {
    appels,
    async balances(uid, h) {
      appels.push({ f: 'balances', uid, h: json(h || {}) });
      if (opts.panne === uid) throw Object.assign(new Error('Enable Banking 500 : erreur fictive'), { status: 500 });
      if (opts.refusPSU && h && Object.keys(h).length) throw Object.assign(new Error('Enable Banking 422 : PSU_HEADER_INVALID'), { status: 422, code: 'PSU_HEADER_INVALID' });
      return [{ balance_type: 'CLBD', balance_amount: { amount: '1000.00' } }];
    },
    async transactions(uid, o) {
      appels.push({ f: 'transactions', uid, from: o.dateFrom || null, h: json(o.headers || {}) });
      return (donnees[uid] || []).filter(t => !o.dateFrom || t.booking_date >= o.dateFrom);
    }
  };
}

function etat() {
  const S = M.vide();
  S.modele.alias = {};
  S.modele.connexions.s1 = { banque: 'Banque Fictive', pays: 'FR', valid_until: '2027-01-01T00:00:00Z', psu: ['Psu-Ip-Address'] };
  S.modele.connexions.s2 = { banque: 'Autre Banque Fictive', pays: 'FR', valid_until: '2026-10-01T00:00:00Z', psu: null };
  const a = M.nouveauCompte(S, { libelle: 'A', source: { type: 'eb', connexion: 's1', uid: 'u1' } });
  const b = M.nouveauCompte(S, { libelle: 'B', source: { type: 'eb', connexion: 's1', uid: 'u2' } });
  const x = M.nouveauCompte(S, { libelle: 'X', source: { type: 'eb', connexion: 's2', uid: 'u3' } });
  M.nouveauCompte(S, { libelle: 'LIVRET', role: 'epargne', solde: { centimes: 100, date: '2026-10-01' } });
  return { S, a, b, x };
}

const DISPO = async () => ({ 'Psu-Ip-Address': '2001:db8::1', 'Psu-User-Agent': 'Klad/0.3.0', 'Psu-Accept-Language': 'fr-FR' });

test('en-têtes PSU : tous ceux dont on dispose, ou aucun si la banque en exige un qu\'on ne sait pas fournir', () => {
  const d = { 'Psu-Ip-Address': '192.0.2.1', 'Psu-User-Agent': 'Klad' };
  assert.deepEqual(json(Y.entetesPSU(['Psu-Ip-Address'], d)), d);
  assert.deepEqual(json(Y.entetesPSU(['psu-ip-address', 'Psu-User-Agent'], d)), d);
  assert.deepEqual(json(Y.entetesPSU(null, d)), d);
  assert.deepEqual(json(Y.entetesPSU([], d)), d);
  assert.deepEqual(json(Y.entetesPSU(['Psu-Ip-Address', 'Psu-Referer'], d)), {});
  assert.deepEqual(json(Y.entetesPSU(['Psu-Ip-Address'], { 'Psu-Ip-Address': '', 'Psu-User-Agent': 'Klad' })), {});
});

test('synchro : incrémentale, erreur par compte sans bloquer les autres, journal anonyme', async () => {
  const { S, a, b, x } = etat();
  const cl = faux({ u1: [tx('2026-10-20', -1250, 'CB BOULANGERIE'), tx('2026-10-25', 250000, 'SALAIRE FICTIF')], u2: [] }, { panne: 'u2' });
  const log = [];
  const r = await Y.synchroniser(S, { client: () => cl, dispo: DISPO, log: (k, m) => log.push(k + ' ' + m), now: () => NOW });
  assert.deepEqual(json(r), { comptes: 3, erreurs: 2, nouvelles: 2, fusionnees: 0, retirees: 0 });
  assert.equal(S.ops[a.id].length, 2);
  assert.equal(a.sync.erreur, null);
  assert.match(b.sync.erreur, /500/);
  assert.match(x.sync.erreur, /expiré/);
  assert.equal(cl.appels.filter(c => c.uid === 'u3').length, 0);  // accès expiré : aucun appel
  assert.equal(S.modele.sync.derniere, NOW);
  assert.equal(S.soldes[a.id].types.CLBD.centimes, 100000);
  // première récupération : la plus longue période ; en-têtes envoyés
  assert.deepEqual(cl.appels[1], { f: 'transactions', uid: 'u1', from: null, h: json(await DISPO()) });
  const texte = log.join('\n');
  assert.match(texte, /Banque A · compte 1 : 2 lue\(s\)/);
  assert.match(texte, /Banque A · compte 2 : Enable Banking 500/);
  assert.doesNotMatch(texte, /Fictive|BOULANGERIE|SALAIRE|1250|2500|u1|u2/);
  // seconde synchro : depuis la dernière comptabilisée − 5 jours, aucun doublon
  cl.appels.length = 0;
  const r2 = await Y.synchroniser(S, { client: () => cl, dispo: DISPO, log: () => {}, now: () => NOW + 3600e3 });
  assert.equal(r2.nouvelles, 0);
  assert.equal(cl.appels[1].from, '2026-10-20');
  assert.equal(S.ops[a.id].length, 2);
});

test('synchro : en-têtes refusés par la banque → un nouvel essai sans aucun en-tête', async () => {
  const { S, a } = etat();
  S.modele.comptes = S.modele.comptes.filter(c => c.id === a.id);
  const cl = faux({ u1: [tx('2026-10-20', -100, 'X')] }, { refusPSU: true });
  const log = [];
  const r = await Y.synchroniser(S, { client: () => cl, dispo: DISPO, log: (k, m) => log.push(m), now: () => NOW });
  assert.equal(r.erreurs, 0);
  assert.deepEqual(cl.appels.map(c => Object.keys(c.h).length), [3, 0, 0]);
  assert.match(log.join('\n'), /en-têtes utilisateur refusés, nouvel essai sans/);
  assert.match(log.join('\n'), /sans en-têtes utilisateur/);
});

test('synchro : arrêtée proprement si l\'appli se verrouille', async () => {
  const { S } = etat();
  let ouvert = true;
  const cl = faux({ u1: [tx('2026-10-20', -100, 'X')] });
  const orig = cl.transactions.bind(cl);
  cl.transactions = async (...a) => { ouvert = false; return orig(...a); };
  const r = await Y.synchroniser(S, { client: () => cl, dispo: DISPO, log: () => {}, now: () => NOW }, () => ouvert);
  assert.equal(r, null);
  assert.equal(S.modele.sync.derniere, null);
});

test('récupération automatique au déverrouillage : si la dernière date de plus de 2 h', () => {
  const { S } = etat();
  assert.equal(Y.aFaire(S, NOW), true);
  S.modele.sync.derniere = NOW - 3600e3;
  assert.equal(Y.aFaire(S, NOW), false);
  S.modele.sync.derniere = NOW - 2.1 * 3600e3;
  assert.equal(Y.aFaire(S, NOW), true);
});

test('client Enable Banking : en-têtes transmis, stratégie « longest » sans date de début', async () => {
  const calls = [];
  const ctx = charge(['eb.js'], {
    fetch: async (url, o) => { calls.push({ url, h: o.headers }); return { ok: true, status: 200, text: async () => '{"transactions":[]}' }; }
  });
  const c = new ctx.KladEB.Client({ appId: 'app', pem: 'x' });
  c.token = async () => 'jwt';
  await c.transactions('u1', { headers: { 'Psu-Ip-Address': '192.0.2.1' } });
  await c.transactions('u1', '2026-10-01');
  await c.balances('u1', { 'Psu-User-Agent': 'Klad' });
  assert.match(calls[0].url, /\/accounts\/u1\/transactions\?strategy=longest$/);
  assert.equal(calls[0].h['Psu-Ip-Address'], '192.0.2.1');
  assert.equal(calls[0].h.Authorization, 'Bearer jwt');
  assert.match(calls[1].url, /\?date_from=2026-10-01$/);
  assert.equal(calls[1].h['Psu-Ip-Address'], undefined);
  assert.equal(calls[2].h['Psu-User-Agent'], 'Klad');
});

test('synchro : frontière = aujourd\'hui → date de début aujourd\'hui (aucune 422), jour de la frontière dédoublonné', async () => {
  const { S, a } = etat();
  S.modele.comptes = S.modele.comptes.filter(c => c.id === a.id);
  a.frontiere = '2026-10-28';
  S.ops[a.id] = [{ id: a.id + ':k:1', compte: a.id, date: '2026-10-28', montant: -1250, libelle: 'CB BOULANGERIE', statut: 'comptabilisee', source: 'reprise' }];
  const cl = faux({ u1: [tx('2026-10-28', -1250, 'CB BOULANGERIE'), tx('2026-10-28', -4200, 'CB LIBRAIRIE')] });
  const futur = cl.transactions.bind(cl);
  cl.transactions = async (uid, o) => {          // Enable Banking refuse une date de début dans le futur
    if (o.dateFrom && o.dateFrom > '2026-10-28') throw Object.assign(new Error('Enable Banking 422 : date_from can not be in the future'), { status: 422 });
    return futur(uid, o);
  };
  const log = [];
  const r = await Y.synchroniser(S, { client: () => cl, dispo: DISPO, log: (k, m) => log.push(m), now: () => NOW });
  assert.equal(r.erreurs, 0);
  assert.equal(cl.appels[1].from, '2026-10-28');
  assert.deepEqual(json(S.ops[a.id]).map(o => [o.montant, o.source]).sort(), [[-1250, 'reprise'], [-4200, 'eb']]);
  assert.match(log.join('\n'), /1 déjà dans la reprise/);
  // frontière en avance sur l'horloge du téléphone : ramenée à aujourd'hui, cause au journal anonyme
  a.frontiere = '2026-10-29';
  log.length = 0;
  const r2 = await Y.synchroniser(S, { client: () => cl, dispo: DISPO, log: (k, m) => log.push(m), now: () => NOW });
  assert.equal(r2.erreurs, 0);
  assert.match(log.join('\n'), /Banque A · compte 1 : date de début ramenée à aujourd'hui/);
});
