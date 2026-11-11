// Tests du lot 2.3.4 : la synchro planifiée ne s'arrête plus à un Klad déverrouillé mais quitté ; trace des passages.
// Données fictives uniquement.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { read } from './charge.mjs';

const JAVA = 'android/app/src/main/java/app/klad/';

test('passage : Klad quitté verrouillé à la demande, Klad affiché reporté de 30 min, jamais sauté jusqu\'au créneau suivant', () => {
  const job = read(JAVA + 'fond/FondJob.java');
  assert.match(job, /case VERROUILLER:[\s\S]*?KladVaultPlugin\.demanderVerrou\(\)[\s\S]*?FondEtat\.attendreVerrou\(ATTENTE_VERROU_MS\)/);
  assert.match(job, /case REPORTER:\s*reporter\("reporte"\)/);
  assert.match(job, /Planificateur\.dans\(this, Planificateur\.REPORT_MS\)/);
  assert.match(read(JAVA + 'fond/Planificateur.java'), /REPORT_MS = 30 \* 60_000L/);
  const plug = read(JAVA + 'vault/KladVaultPlugin.java');
  assert.match(plug, /protected void handleOnResume\(\) \{\s*FondEtat\.premierPlan\(true\);/);
  assert.match(plug, /protected void handleOnPause\(\) \{\s*FondEtat\.premierPlan\(false\);/);
  assert.match(plug, /notifyListeners\("verrouiller"/);
  // l'appli se verrouille à la demande (écritures finies, puis session fermée)
  assert.match(read('www/verrou.js'), /V\.addListener\('verrouiller', \(\) => \{ if \(key\) lock\(\); else session\(false\); \}\)/);
});

test('coffre : une erreur passagère du Keystore ne désactive plus la synchro automatique', () => {
  const v = read(JAVA + 'vault/Vault.java');
  const corps = v.slice(v.indexOf('synchronized byte[] dekFond()'), v.indexOf('// ------------------------------------------------------------ blocs chiffrés'));
  assert.equal((corps.match(/desactiverFond\(\)/g) || []).length, 1, 'retirée seulement si la clé a disparu');
  assert.match(corps, /if \(k == null\) \{\s*try \{ desactiverFond\(\);/);
});

test('trace : dernier et prochain passages dans Plus › Verrou, essai dans 1 min, sans donnée personnelle', () => {
  const p = read(JAVA + 'fond/Passages.java');
  for (const k of ['dernier', 'resultat', 'etape', 'prochain']) assert.match(p, new RegExp('"' + k + '"'));
  const cles = [...p.matchAll(/\.put(?:String|Long)\("(\w+)"/g)].map(m => m[1]).sort();
  assert.deepEqual(cles, ['dernier', 'etape', 'prochain', 'resultat'], 'seulement heures et codes');
  const ix = read('www/index.html');
  assert.match(ix, /id="fondTrace"[^>]*aria-live="polite"/, 'trace toujours visible (pas repliée derrière un ⓘ)');
  assert.match(ix, /id="btnFondEssai"/);
  const v = read('www/verrou.js');
  for (const k of ['ok', 'erreurs', 'reporte', 'verrou', 'cle', 'delai', 'arret']) assert.match(v, new RegExp('\\b' + k + ": '"), k);
  assert.match(read(JAVA + 'vault/KladVaultPlugin.java'), /public void essaiFond\(PluginCall call\)[\s\S]*?Planificateur\.dans\(getContext\(\), 60_000\)/);
});
