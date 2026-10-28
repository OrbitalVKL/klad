#!/usr/bin/env node
// Prépare la fabrication Android de Klad.
//   node scripts/prepare-android.mjs web     → identifiant d'appli, www/config.js, www/vendor/capacitor.js
//   node scripts/prepare-android.mjs native  → lien profond klad://eb, numéro de version (après « cap add android »)
//
// Le compte GitHub n'est écrit nulle part dans le dépôt : il vient de GITHUB_REPOSITORY_OWNER (GitHub Actions)
// ou de la variable KLAD_OWNER en local.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const step = process.argv[2];
const owner = (process.env.KLAD_OWNER || process.env.GITHUB_REPOSITORY_OWNER || '').trim();
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const buildNo = parseInt(process.env.GITHUB_RUN_NUMBER || '1', 10);
const sha = (process.env.GITHUB_SHA || 'local').slice(0, 7);

// Même règle que site/retour.html : <compte>.github.io → io.github.<compte>.klad
export function appIdFor(o) {
  let seg = String(o).toLowerCase().replace(/[^a-z0-9_]/g, '_');
  if (/^[0-9_]/.test(seg)) seg = 'u' + seg;
  return 'io.github.' + seg + '.klad';
}

function die(msg) { console.error('✗ ' + msg); process.exit(1); }
function write(rel, txt) { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), txt); console.log('✓ ' + rel); }

if (step === 'web') {
  if (!owner) die('Compte GitHub inconnu : définir KLAD_OWNER (ou lancer dans GitHub Actions).');
  const capPath = path.join(root, 'capacitor.config.json');
  const cap = JSON.parse(fs.readFileSync(capPath, 'utf8'));
  cap.appId = appIdFor(owner);
  fs.writeFileSync(capPath, JSON.stringify(cap, null, 2) + '\n');
  console.log('✓ appId = ' + cap.appId);

  write('www/config.js',
    '// Généré par scripts/prepare-android.mjs — ne pas modifier.\n' +
    'window.KLAD_CONFIG = ' + JSON.stringify({ owner, version: pkg.version, build: buildNo + ' · ' + sha }) + ';\n');

  // Exécution Capacitor sans outil d'assemblage : copie du fichier autonome de @capacitor/core.
  const candidates = ['dist/capacitor.js', 'dist/capacitor.min.js'].map(f => path.join(root, 'node_modules/@capacitor/core', f));
  const src = candidates.find(f => fs.existsSync(f));
  if (!src) die('@capacitor/core/dist/capacitor.js introuvable (npm install ?)');
  fs.mkdirSync(path.join(root, 'www/vendor'), { recursive: true });
  fs.copyFileSync(src, path.join(root, 'www/vendor/capacitor.js'));
  console.log('✓ www/vendor/capacitor.js ← ' + path.relative(root, src));
}

else if (step === 'native') {
  const man = path.join(root, 'android/app/src/main/AndroidManifest.xml');
  if (!fs.existsSync(man)) die('android/ absent : lancer « npx cap add android » avant.');
  let x = fs.readFileSync(man, 'utf8');
  if (x.indexOf('android:scheme="klad"') < 0) {
    const filter =
      '\n            <intent-filter>\n' +
      '                <action android:name="android.intent.action.VIEW" />\n' +
      '                <category android:name="android.intent.category.DEFAULT" />\n' +
      '                <category android:name="android.intent.category.BROWSABLE" />\n' +
      '                <data android:scheme="klad" android:host="eb" />\n' +
      '            </intent-filter>\n        ';
    const i = x.indexOf('</activity>');
    if (i < 0) die('</activity> introuvable dans AndroidManifest.xml');
    x = x.slice(0, i) + filter + x.slice(i);
  }
  if (!/android:launchMode=/.test(x)) x = x.replace(/(<activity\b)/, '$1\n            android:launchMode="singleTask"');
  fs.writeFileSync(man, x);
  console.log('✓ AndroidManifest.xml : lien profond klad://eb');

  const gradle = path.join(root, 'android/app/build.gradle');
  let gtxt = fs.readFileSync(gradle, 'utf8');
  gtxt = gtxt.replace(/versionCode\s+\d+/, 'versionCode ' + buildNo)
             .replace(/versionName\s+"[^"]*"/, 'versionName "' + pkg.version + '"');
  fs.writeFileSync(gradle, gtxt);
  console.log('✓ build.gradle : version ' + pkg.version + ' (' + buildNo + ')');
}

else if (step !== undefined) die('Étape inconnue : ' + step + ' (web | native)');
