// Version de test de Klad à publier comme page web (artefact) : copie de www/ (sans pdf.js), jeu de données FICTIF
// « personnel » (tools/mesures/donnees.mjs) chargé tout seul au démarrage, code 123456 saisi automatiquement.
// Sert à essayer l'interface plus vite qu'avec l'APK ; aucune donnée réelle, aucun accès bancaire.
// Usage : node tools/artefact/construire.mjs [dossier de sortie]
import fs from 'node:fs';
import path from 'node:path';

const ICI = path.dirname(new URL(import.meta.url).pathname);
const RACINE = path.resolve(ICI, '../..');
const OUT = path.resolve(process.argv[2] || path.join(RACINE, 'dist/artefact'));
fs.rmSync(OUT, { recursive: true, force: true });

function copier(src, dst) {
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (e.name === 'pdfjs') continue;
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) { fs.mkdirSync(d, { recursive: true }); copier(s, d); } else { fs.mkdirSync(dst, { recursive: true }); fs.copyFileSync(s, d); }
  }
}
copier(path.join(RACINE, 'www'), OUT);
fs.mkdirSync(path.join(OUT, 'demo'), { recursive: true });
fs.copyFileSync(path.join(RACINE, 'test/fictif.mjs'), path.join(OUT, 'demo/fictif.mjs'));
fs.writeFileSync(path.join(OUT, 'demo/donnees.mjs'), fs.readFileSync(path.join(RACINE, 'tools/mesures/donnees.mjs'), 'utf8').replace("'../../test/fictif.mjs'", "'./fictif.mjs'"));
fs.copyFileSync(path.join(ICI, 'demarrage.mjs'), path.join(OUT, 'demo/demarrage.mjs'));
fs.copyFileSync(path.join(ICI, 'horloge.js'), path.join(OUT, 'demo/horloge.js'));
// le complément du jeu (banque connectée, crypto, livret, plan d'épargne…) : même fonction que le test du mode démo
const outils = fs.readFileSync(path.join(RACINE, 'test/demo-outils.mjs'), 'utf8');
const corps = outils.slice(outils.indexOf('  await page.evaluate(P => {') + '  await page.evaluate('.length, outils.indexOf('  }, PERSONNEL);') + 3);
fs.writeFileSync(path.join(OUT, 'demo/completer.mjs'), '// Généré depuis test/demo-outils.mjs (completer) : données fictives.\nexport const completer = ' + corps + ';\n');
// page : bandeau « version de test » et démarrage automatique
let ix = fs.readFileSync(path.join(OUT, 'index.html'), 'utf8');
ix = ix.replace(/\s*<script src="vendor\/capacitor\.js"><\/script>/, '');      // pas de Capacitor dans une page web
ix = ix.replace(/<head>/, '<head>\n  <script src="demo/horloge.js"></script>');       // avant tout autre script
ix = ix.replace('</body>', '  <script type="module" src="demo/demarrage.mjs"></script>\n</body>').replace(/<title>[^<]*<\/title>/, '<title>Klad — version de test</title>');
fs.writeFileSync(path.join(OUT, 'index.html'), ix);
const n = (function compte(d) { return fs.readdirSync(d, { withFileTypes: true }).reduce((t, e) => t + (e.isDirectory() ? compte(path.join(d, e.name)) : 1), 0); })(OUT);
console.log(OUT, n, 'fichiers');
