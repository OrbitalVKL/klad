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
  const files = ['MainActivity.java', 'vault/KladVaultPlugin.java', 'vault/Vault.java', 'vault/Coffre.java'];
  for (const f of files) {
    const x = read(JAVA + f);
    assert.match(x, /^package app\.klad(\.vault)?;/m, f);
    assert.doesNotMatch(x, /io\.github\./, f);
  }
  const main = read(JAVA + 'MainActivity.java');
  assert.match(main, /FLAG_SECURE/);
  assert.match(main, /registerPlugin\(KladVaultPlugin\.class\)/);
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
  for (const f of ['www/app.js', 'www/verrou.js']) assert.doesNotMatch(read(f), /localStorage\.setItem/, f);
});
