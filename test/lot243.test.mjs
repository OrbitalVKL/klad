// Tests du lot 2.4.3 : le réveil lance un service de premier plan (plus de dépendance à JobScheduler, refusé sur le
// téléphone du propriétaire) ; tout refus d'Android est noté, jamais d'arrêt de Klad. Données fictives uniquement.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { read } from './charge.mjs';

const JAVA = 'android/app/src/main/java/app/klad/';

test('réveil → service de premier plan « synchronisation de données », secours par travail', () => {
  const mf = read('android/app/src/main/AndroidManifest.xml');
  assert.match(mf, /<service\s+android:name="app\.klad\.fond\.FondService"\s+android:foregroundServiceType="dataSync"\s+android:exported="false" \/>/);
  for (const p of ['FOREGROUND_SERVICE', 'FOREGROUND_SERVICE_DATA_SYNC', 'WAKE_LOCK'])
    assert.match(mf, new RegExp('uses-permission android:name="android\\.permission\\.' + p + '"'));
  const sv = read(JAVA + 'fond/FondService.java');
  assert.match(sv, /onStartCommand[\s\S]*?premierPlan\(\);[\s\S]*?new Passage\(this, this::fin\)/);
  assert.match(sv, /startForeground\(NOTIF, n, ServiceInfo\.FOREGROUND_SERVICE_TYPE_DATA_SYNC\)/);
  assert.match(sv, /IMPORTANCE_MIN/);
  assert.match(sv, /PARTIAL_WAKE_LOCK[\s\S]*?acquire\(VERROU_ECRAN_MS\)/);
  assert.match(sv, /public void onTimeout\(int startId, int fgsType\)/);
  assert.match(sv, /catch \(RuntimeException e\) \{\s*Passages\.refus\(ctx, "service", e\);/);
  assert.doesNotMatch(sv, /setContentText/, 'aucun montant ni nom dans la notification');
  const job = read(JAVA + 'fond/FondJob.java');
  assert.match(job, /new Passage\(this, \(\) -> jobFinished\(params, false\)\)/);
});

test('programmation : un refus d\'Android est noté, jamais d\'exception', () => {
  const pl = read(JAVA + 'fond/Planificateur.java');
  const travail = pl.slice(pl.indexOf('private static void travail'), pl.indexOf('private static PendingIntent'));
  assert.equal((travail.match(/js\.schedule\(/g) || []).length, 2);
  assert.equal((travail.match(/catch \(RuntimeException e\)/g) || []).length, 2);
  assert.match(travail, /Passages\.refus\(ctx, "travail", e\)/);
  const ps = read(JAVA + 'fond/Passages.java');
  assert.match(ps, /public static void refus\(Context ctx, String ou, Throwable e\)/);
  assert.match(read(JAVA + 'vault/KladVaultPlugin.java'), /"fondRefus"[\s\S]*?"fondRefusLe"/);
  assert.match(read('www/verrou.js'), /Refus d\\'Android \(/);
});
