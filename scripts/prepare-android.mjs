#!/usr/bin/env node
// Prépare la fabrication Android de Klad.
//   node scripts/prepare-android.mjs web     → identifiant d'appli, www/config.js, www/vendor/capacitor.js
//   node scripts/prepare-android.mjs native  → vérifie le manifeste (klad://eb, pas de sauvegarde Android),
//                                              écrit android/klad.properties (identifiant d'appli, version)
//
// Le compte GitHub n'est écrit nulle part dans le dépôt : il vient de GITHUB_REPOSITORY_OWNER (GitHub Actions)
// ou de la variable KLAD_OWNER en local. Le nom du dépôt vient de GITHUB_REPOSITORY (ou KLAD_REPO), « klad » par défaut.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const step = process.argv[2];
const owner = (process.env.KLAD_OWNER || process.env.GITHUB_REPOSITORY_OWNER || '').trim();
const repo = repoName(process.env);
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const buildNo = parseInt(process.env.GITHUB_RUN_NUMBER || '1', 10);
const sha = (process.env.GITHUB_SHA || 'local').slice(0, 7);

// Même règle que site/retour.html : <compte>.github.io → io.github.<compte>.klad
export function appIdFor(o) {
  let seg = String(o).toLowerCase().replace(/[^a-z0-9_]/g, '_');
  if (/^[0-9_]/.test(seg)) seg = 'u' + seg;
  return 'io.github.' + seg + '.klad';
}

// Contenu de android/klad.properties.
export function kladProperties(o, version, build) {
  return '# Généré par scripts/prepare-android.mjs — ne pas versionner.\n' +
    'applicationId=' + appIdFor(o) + '\nversionCode=' + build + '\nversionName=' + version + '\n';
}

// Réglages de sécurité attendus dans le manifeste versionné. Renvoie le problème trouvé, ou null.
export function checkManifest(x) {
  if (!/android:scheme="klad"\s+android:host="eb"/.test(x)) return 'lien profond klad://eb absent';
  if (!/android:launchMode="singleTask"/.test(x)) return 'launchMode singleTask absent';
  if (!/android:allowBackup="false"/.test(x)) return 'android:allowBackup doit valoir false';
  if (!/android:dataExtractionRules=/.test(x)) return 'dataExtractionRules absent';
  return null;
}

// Nom du dépôt : KLAD_REPO, sinon la partie après « / » de GITHUB_REPOSITORY (compte/nom), sinon « klad ».
export function repoName(env) {
  const r = String(env.KLAD_REPO || env.GITHUB_REPOSITORY || '').trim();
  return r.split('/').pop() || 'klad';
}

function die(msg) { console.error('✗ ' + msg); process.exit(1); }
function write(rel, txt) { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), txt); console.log('✓ ' + rel); }

if (step === 'web') {
  if (!owner) die('Compte GitHub inconnu : définir KLAD_OWNER (ou lancer dans GitHub Actions).');
  const capPath = path.join(root, 'capacitor.config.json');
  const cap = JSON.parse(fs.readFileSync(capPath, 'utf8'));
  cap.appId = appIdFor(owner);
  fs.writeFileSync(capPath, JSON.stringify(cap, null, 2) + '\n');
  console.log('✓ appId = ' + cap.appId + ', dépôt = ' + repo);

  write('www/config.js',
    '// Généré par scripts/prepare-android.mjs — ne pas modifier.\n' +
    'window.KLAD_CONFIG = ' + JSON.stringify({ owner, repo, version: pkg.version, build: buildNo + ' · ' + sha }) + ';\n');

  // Exécution Capacitor sans outil d'assemblage : copie du fichier autonome de @capacitor/core.
  const candidates = ['dist/capacitor.js', 'dist/capacitor.min.js'].map(f => path.join(root, 'node_modules/@capacitor/core', f));
  const src = candidates.find(f => fs.existsSync(f));
  if (!src) die('@capacitor/core/dist/capacitor.js introuvable (npm install ?)');
  fs.mkdirSync(path.join(root, 'www/vendor'), { recursive: true });
  fs.copyFileSync(src, path.join(root, 'www/vendor/capacitor.js'));
  console.log('✓ www/vendor/capacitor.js ← ' + path.relative(root, src));
}

else if (step === 'native') {
  // android/ est versionné : on n'y modifie aucun fichier suivi. L'identifiant et la version vont dans
  // android/klad.properties (non versionné), lu par android/app/build.gradle.
  if (!owner) die('Compte GitHub inconnu : définir KLAD_OWNER (ou lancer dans GitHub Actions).');
  const man = path.join(root, 'android/app/src/main/AndroidManifest.xml');
  if (!fs.existsSync(man)) die('android/ absent du dépôt.');
  const problem = checkManifest(fs.readFileSync(man, 'utf8'));
  if (problem) die('AndroidManifest.xml : ' + problem);
  console.log('✓ AndroidManifest.xml : lien profond klad://eb, aucune sauvegarde Android');

  write('android/klad.properties', kladProperties(owner, pkg.version, buildNo));
  console.log('✓ applicationId ' + appIdFor(owner) + ', version ' + pkg.version + ' (' + buildNo + ')');
}

else if (step !== undefined) die('Étape inconnue : ' + step + ' (web | native)');
