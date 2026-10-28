#!/usr/bin/env node
// Étiquette de publication de Klad, déduite du numéro de version de package.json.
//   node scripts/version.mjs   → affiche l'étiquette (ex. v0.2.0)
//
// La fabrication sur main publie une version dans Releases dès que cette étiquette n'existe pas encore :
// pour publier, il suffit de changer « version » dans package.json.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function tagFor(version) {
  const v = String(version);
  if (!/^\d+\.\d+\.\d+$/.test(v)) throw new Error('Version invalide dans package.json : « ' + v + ' » (attendu : 1.2.3)');
  return 'v' + v;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  try { console.log(tagFor(pkg.version)); } catch (e) { console.error('✗ ' + e.message); process.exit(1); }
}
