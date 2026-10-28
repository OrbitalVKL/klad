// Tests sans réseau : projet Android versionné (réglages de sécurité, package Java fixe, identifiant hors du dépôt).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { checkManifest, kladProperties } from '../scripts/prepare-android.mjs';

const read = rel => fs.readFileSync(new URL('../' + rel, import.meta.url), 'utf8');
const MAN = 'android/app/src/main/AndroidManifest.xml';
const JAVA = 'android/app/src/main/java/app/klad/';

test('manifeste : lien profond, singleTask, aucune sauvegarde Android', () => {
  const m = read(MAN);
  assert.equal(checkManifest(m), null);
  assert.match(m, /android:fullBackupContent="@xml\/backup_rules"/);
  assert.equal(checkManifest(m.replace('android:allowBackup="false"', 'android:allowBackup="true"')), 'android:allowBackup doit valoir false');
  assert.equal(checkManifest(m.replace('android:scheme="klad"', 'android:scheme="autre"')), 'lien profond klad://eb absent');
  for (const f of ['data_extraction_rules', 'backup_rules']) {
    const x = read('android/app/src/main/res/xml/' + f + '.xml');
    for (const d of ['root', 'file', 'database', 'sharedpref', 'external']) assert.match(x, new RegExp('exclude domain="' + d + '" path="\\."'));
  }
});

test('identifiant d\'appli et version hors des fichiers versionnés', () => {
  assert.equal(kladProperties('Compte-Test', '0.2.0', 42),
    '# Généré par scripts/prepare-android.mjs — ne pas versionner.\napplicationId=io.github.compte_test.klad\nversionCode=42\nversionName=0.2.0\n');
  const g = read('android/app/build.gradle');
  assert.match(g, /namespace "app\.klad"/);
  assert.match(g, /klad\.getProperty\('applicationId'/);
  assert.match(read('.gitignore'), /^android\/klad\.properties$/m);
  assert.match(read('android/variables.gradle'), /minSdkVersion = 28\b/);
});

test('code Java dans le package fixe app.klad, sans compte GitHub', () => {
  const files = ['MainActivity.java', 'vault/KladVaultPlugin.java', 'vault/Vault.java', 'vault/Coffre.java',
    'update/KladUpdatePlugin.java', 'update/Maj.java', 'reseau/KladReseauPlugin.java', 'reseau/Adresse.java'];
  for (const f of files) {
    const x = read(JAVA + f);
    assert.match(x, /^package app\.klad(\.vault|\.update|\.reseau)?;/m, f);
    assert.doesNotMatch(x, /io\.github\./, f);
  }
  const main = read(JAVA + 'MainActivity.java');
  assert.match(main, /FLAG_SECURE/);
  assert.match(main, /registerPlugin\(KladVaultPlugin\.class\)/);
  assert.match(main, /registerPlugin\(KladUpdatePlugin\.class\)/);
  assert.match(main, /registerPlugin\(KladReseauPlugin\.class\)/);
  // adresse IP pour l'en-tête Psu-Ip-Address : aucune requête vers un service tiers
  const r = read(JAVA + 'reseau/KladReseauPlugin.java') + read(JAVA + 'reseau/Adresse.java');
  assert.match(r, /NetworkInterface\.getNetworkInterfaces\(\)/);
  assert.doesNotMatch(r, /https?:\/\/|URL\(|HttpURLConnection/);
});

test('empreinte : aucune opération sur la clé avant BiometricPrompt', () => {
  // updateAAD avant l'authentification fait échouer doFinal (« Erreur inattendue » de la 0.2.0).
  const v = read(JAVA + 'vault/Vault.java');
  const body = name => v.slice(v.indexOf('Cipher ' + name + '()'), v.indexOf('\n    }\n', v.indexOf('Cipher ' + name + '()')));
  for (const n of ['bioEncrypter', 'bioDecrypter']) assert.doesNotMatch(body(n), /updateAAD|doFinal/, n);
  const p = read(JAVA + 'vault/KladVaultPlugin.java');
  assert.match(p, /onAuthenticationSucceeded[\s\S]*c\.updateAAD\(Coffre\.AAD_BIO\)/);
  assert.match(p, /answered\.getAndSet\(true\)/);
});

test('mise à jour : permission d\'installation, contrôles du plugin', () => {
  assert.match(read(MAN), /android\.permission\.REQUEST_INSTALL_PACKAGES/);
  const u = read(JAVA + 'update/KladUpdatePlugin.java');
  for (const re of [/Maj\.allowedUrl\(url\)/, /Maj\.sameDigest\(/, /getPackageArchiveInfo/, /versionCode\(apk\) <= versionCode\(me\)/,
    /mine\.equals\(theirs\)/, /PackageInstaller\.SessionParams/, /RECEIVER_NOT_EXPORTED/]) assert.match(u, re);
});

test('coffre natif : réglages des clés Keystore', () => {
  const v = read(JAVA + 'vault/Vault.java');
  assert.match(v, /getNoBackupFilesDir\(\)/);
  assert.match(v, /setUserAuthenticationRequired\(true\)\.setInvalidatedByBiometricEnrollment\(true\)/);
  assert.match(v, /AUTH_BIOMETRIC_STRONG/);
  assert.match(v, /setIsStrongBoxBacked/);
  assert.match(v, /KEY_RESUME = "klad\.resume"/);
  assert.match(read(JAVA + 'vault/KladVaultPlugin.java'), /BIOMETRIC_STRONG/);
});

test('aucune donnée en clair dans localStorage', () => {
  for (const f of ['www/app.js', 'www/verrou.js', 'www/plus.js', 'www/modele.js', 'www/sync.js', 'www/reprise.js', 'www/vues.js'])
    assert.doesNotMatch(read(f), /localStorage\.setItem/, f);
});

test('workflow : cache Gradle, vérification légère des demandes de fusion, un seul appel Gradle sur main', () => {
  const w = read('.github/workflows/android.yml');
  assert.match(w, /uses: gradle\/actions\/setup-gradle@v4/);
  assert.match(w, /if: env\.IS_PR == 'true'[\s\S]*?run: \.\/gradlew --no-daemon testDebugUnitTest\n/);
  assert.match(w, /if: env\.IS_PR != 'true' && env\.HAS_KEY == 'true'[\s\S]*?run: \.\/gradlew --no-daemon testDebugUnitTest assembleRelease\n/);
  assert.doesNotMatch(w, /lint\s*\{|checkReleaseBuilds/);       // lint gardé (lintVitalRelease)
  assert.match(w, /KLAD_PARCOURS: obligatoire[\s\S]*?node --test test\/parcours\.test\.mjs/);   // parcours Chromium jamais sauté
  assert.doesNotMatch(read('android/app/build.gradle'), /checkReleaseBuilds\s+false/);
});
