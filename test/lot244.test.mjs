// Tests du lot 2.4.4 : synchro planifiée sans réseau → nouvel essai 30 min plus tard (jusqu'au créneau suivant).
// Données fictives uniquement.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { charge, read } from './charge.mjs';

const JAVA = 'android/app/src/main/java/app/klad/';
const { KladModele: M, KladSync: Y } = charge(['anon.js', 'eb.js', 'modele.js', 'sync.js']);
const NOW = Date.parse('2026-11-17T07:00:00Z');

test('synchro : comptes en échec faute de réseau comptés à part', async () => {
  const S = M.vide();
  S.modele.alias = {};
  S.modele.connexions.s1 = { banque: 'Banque Fictive', pays: 'FR', valid_until: '2027-01-01T00:00:00Z', psu: null };
  M.nouveauCompte(S, { libelle: 'A', source: { type: 'eb', connexion: 's1', uid: 'u1' } });
  M.nouveauCompte(S, { libelle: 'B', source: { type: 'eb', connexion: 's1', uid: 'u2' } });
  const sansReseau = () => Object.assign(new Error('Réseau injoignable (Réseau indisponible (UnknownHostException)).'), { reseau: true });
  const cl = { async balances() { throw sansReseau(); }, async transactions() { return []; } };
  const r = await Y.synchroniser(S, { client: () => cl, dispo: async () => ({}), log: () => {}, now: () => NOW });
  assert.deepEqual([r.comptes, r.erreurs, r.reseau], [2, 2, 2]);
  assert.match(read('www/eb.js'), /throw Object\.assign\(new Error\('Réseau injoignable \(' \+ \(e\.message \|\| e\) \+ '\)\.'\), \{ reseau: true \}\)/);
});

test('passage sans réseau : résultat « reseau », nouvel essai 30 min plus tard, libellé dans Plus › Verrou', () => {
  const v = read('www/verrou.js');
  assert.match(v, /if \(res && res\.comptes > 0 && res\.reseau === res\.comptes\) return fin\(\{ raison: 'reseau'/);
  assert.match(v, /reseau: 'pas de réseau, nouvel essai 30 min plus tard'/);
  const pa = read(JAVA + 'fond/Passage.java');
  assert.match(pa, /"reseau"\.equals\(code\(resultat\)\)[\s\S]*?Planificateur\.apresReseau\(ctx\); else Planificateur\.planifier\(ctx\)/);
  assert.match(read(JAVA + 'fond/Planificateur.java'), /armer\(ctx, Planning\.apresReseau\(System\.currentTimeMillis\(\), ZoneId\.systemDefault\(\)\)\)/);
  assert.match(read(JAVA + 'fond/Planning.java'), /return essai \+ MARGE_MS < creneau \? essai : creneau;/);
});
