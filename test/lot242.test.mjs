// Tests du lot 2.4.2 : synchro automatique réveillée à l'heure (alarme + travail immédiat, secours), banque lente (408)
// passagère avec un nouvel essai, enregistrement compte par compte en arrière-plan, trace et coupure signalée.
// Données fictives uniquement.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { charge, read } from './charge.mjs';

const JAVA = 'android/app/src/main/java/app/klad/';
const { KladModele: M, KladSync: Y } = charge(['anon.js', 'eb.js', 'modele.js', 'sync.js']);
const NOW = Date.parse('2026-11-16T07:00:00Z');

function etat() {
  const S = M.vide();
  S.modele.alias = {};
  S.modele.connexions.s1 = { banque: 'Banque Fictive', pays: 'FR', valid_until: '2027-01-01T00:00:00Z', psu: null };
  const a = M.nouveauCompte(S, { libelle: 'A', source: { type: 'eb', connexion: 's1', uid: 'u1' } });
  const b = M.nouveauCompte(S, { libelle: 'B', source: { type: 'eb', connexion: 's1', uid: 'u2' } });
  return { S, a, b };
}
const lent = () => Object.assign(new Error('Enable Banking 408 : Timeout interacting with ASPSP'), { status: 408, code: '' });
const solde = [{ balance_type: 'CLBD', balance_amount: { amount: '10.00' } }];

test('banque lente (408) : un nouvel essai aussitôt, réussi sans erreur', async () => {
  const { S, a } = etat();
  S.modele.comptes = S.modele.comptes.filter(c => c.id === a.id);
  let n = 0;
  const cl = { async balances() { if (n++ === 0) throw lent(); return solde; }, async transactions() { return []; } };
  const log = [], pauses = [];
  const r = await Y.synchroniser(S, { client: () => cl, dispo: async () => ({}), log: (k, m) => log.push(k + ' ' + m), now: () => NOW,
    attendre: async ms => { pauses.push(ms); } });
  assert.deepEqual([r.erreurs, r.passagers], [0, 0]);
  assert.equal(a.sync.erreur, null);
  assert.deepEqual(pauses, [3000]);
  assert.match(log.join('\n'), /info Banque A · compte 1 : banque lente à répondre, nouvel essai\./);
});

test('banque lente (408) deux fois : passagère (pas d\'erreur), puis erreur au bout de 3 fois comme les pannes ASPSP', async () => {
  const { S, a } = etat();
  S.modele.comptes = S.modele.comptes.filter(c => c.id === a.id);
  const cl = { async balances() { throw lent(); }, async transactions() { return []; } };
  const deps = t => ({ client: () => cl, dispo: async () => ({}), log: () => {}, now: () => t, attendre: async () => {} });
  let r = await Y.synchroniser(S, deps(NOW));
  assert.deepEqual([r.erreurs, r.passagers, a.sync.erreur], [0, 1, null]);
  await Y.synchroniser(S, deps(NOW + 6 * 3600e3));
  r = await Y.synchroniser(S, deps(NOW + 12 * 3600e3));
  assert.equal(r.erreurs, 1);
  assert.equal(Y.passager(Object.assign(new Error('x'), { status: 504 })), true);
  assert.equal(Y.passager(Object.assign(new Error('Enable Banking 500 : erreur'), { status: 500 })), false);
});

test('arrière-plan : enregistrement après chaque compte, même en erreur', async () => {
  const { S } = etat();
  const cl = {
    async balances(uid) { if (uid === 'u2') throw Object.assign(new Error('Enable Banking 500 : erreur fictive'), { status: 500 }); return solde; },
    async transactions() { return []; }
  };
  const vus = [];
  await Y.synchroniser(S, { client: () => cl, dispo: async () => ({}), log: () => {}, now: () => NOW, apresCompte: async c => { vus.push(c.libelle); } });
  assert.deepEqual(vus.sort(), ['A', 'B']);
  const app = read('www/app.js');
  assert.match(app, /const apresCompte = window\.KLAD_FOND \? async \(\) => \{[\s\S]*?hooks\.flush[\s\S]*?KladWidget\.maj\(\)/);
});

test('réveil à l\'heure : alarme exacte (sinon autorisée en veille), travail immédiat prioritaire, secours, démarrage et mise à jour', () => {
  const pl = read(JAVA + 'fond/Planificateur.java');
  assert.match(pl, /setExactAndAllowWhileIdle\(AlarmManager\.RTC_WAKEUP/);
  assert.match(pl, /canScheduleExactAlarms\(\)/);
  assert.match(pl, /setAndAllowWhileIdle\(AlarmManager\.RTC_WAKEUP/);
  assert.match(pl, /setExpedited\(true\)/);
  assert.match(pl, /SECOURS_MS = 30 \* 60_000L/);
  assert.match(pl, /public static void verifier\(Context ctx\) \{\s*if \(FondJob\.tourne\(\)\) return;/);
  assert.match(pl, /Planning\.reprendre\(Passages\.prochain\(ctx\)/);
  assert.match(pl, /am\.cancel\(pi\)/);
  const rv = read(JAVA + 'fond/ReveilFond.java');
  assert.match(rv, /if \(!Passage\.tourne\(\) && !FondService\.lancer\(ctx\)\) Planificateur\.maintenant\(ctx\)/);   // 2.4.3
  assert.match(rv, /ACTION_BOOT_COMPLETED[\s\S]*ACTION_MY_PACKAGE_REPLACED[\s\S]*Planificateur\.verifier\(ctx\)/);
  const mf = read('android/app/src/main/AndroidManifest.xml');
  assert.match(mf, /<receiver\s+android:name="app\.klad\.fond\.ReveilFond"\s+android:exported="false">[\s\S]*?BOOT_COMPLETED[\s\S]*?MY_PACKAGE_REPLACED[\s\S]*?<\/receiver>/);
  assert.match(mf, /SCHEDULE_EXACT_ALARM" android:maxSdkVersion="32"/);
  assert.match(mf, /USE_EXACT_ALARM"/);
  const pa = read(JAVA + 'fond/Passage.java');
  assert.match(pa, /boolean demarrer\(\) \{\s*Passages\.debut\(ctx\);/);
  assert.equal((pa.match(/fin\.fini\(\)/g) || []).length, 1, 'fin unique par finir()');
});

test('trace : démarrage sans résultat, réveil sans passage ; coupure par le téléphone signalée une fois par lancement', () => {
  const plug = read(JAVA + 'vault/KladVaultPlugin.java');
  for (const k of ['fondDebut', 'fondReveil', 'fondPerdu']) assert.match(plug, new RegExp('"' + k + '"'));
  assert.match(plug, /vault\.desactiverFondMain\(\)/);
  const v = read(JAVA + 'vault/Vault.java');
  assert.match(v, /if \(k == null\) \{[\s\S]*?"fond\.perdu"[\s\S]*?desactiverFond\(\);/);
  assert.match(v, /activerFond\(byte\[\] dek\)[\s\S]*?p\.remove\("fond\.perdu"\)/);
  const js = read('www/verrou.js');
  assert.match(js, /Dernier démarrage : /);
  assert.match(js, /Réveil reçu : /);
  assert.match(js, /Coupée par le téléphone le /);
  assert.match(js, /function signalerFondPerdu\(\)[\s\S]*?perteDite = st\.fondPerdu/);
});
