// Tests du lot 2.4.5 : autorisation réseau pour les travaux JobScheduler ; Klad quitté depuis plus de 5 min : session
// fermée par la synchro planifiée sans attendre la page, écritures de la page refusées jusqu'au déverrouillage.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { read } from './charge.mjs';

const JAVA = 'android/app/src/main/java/app/klad/';

test('ACCESS_NETWORK_STATE déclarée (travail avec contrainte réseau)', () => {
  assert.match(read('android/app/src/main/AndroidManifest.xml'), /<uses-permission android:name="android\.permission\.ACCESS_NETWORK_STATE" \/>/);
});

test('Klad quitté depuis plus de 5 min : session fermée sans la page, écritures de la page refusées', () => {
  const fe = read(JAVA + 'fond/FondEtat.java');
  assert.match(fe, /quitteLe = oui \? 0 : System\.currentTimeMillis\(\);/);
  assert.match(fe, /if \(!appliOuverte \|\| premierPlan \|\| quitteLe <= 0 \|\| now - quitteLe < delaiMs\) return false;\s*appliOuverte = false;\s*fermeeParFond = true;/);
  assert.match(fe, /appliOuverte = ouverte;\s*if \(ouverte\) fermeeParFond = false;/);
  const pa = read(JAVA + 'fond/Passage.java');
  assert.match(pa, /PAGE_VERROUILLEE_MS = 5 \* 60_000L \+ 15_000L/);
  assert.match(pa, /case VERROUILLER:[\s\S]*?if \(FondEtat\.fermerSansPage\(PAGE_VERROUILLEE_MS, System\.currentTimeMillis\(\)\)\) return lancer\(\);[\s\S]*?demanderVerrou\(\)/);
  assert.match(read('www/verrou.js'), /const LOCK_MS = 5 \* 60e3;/, 'même délai que la page');
  assert.match(read(JAVA + 'vault/KladVaultPlugin.java'), /public void writeBlob\(PluginCall call\) \{\s*\/\/[^\n]*\n\s*if \(FondEtat\.fermeeParFond\(\)\) \{\s*call\.reject/);
});
