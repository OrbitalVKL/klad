// Charge les scripts de www/ dans un contexte vm (comme dans l'appli, sans navigateur). Données fictives uniquement.
import fs from 'node:fs';
import vm from 'node:vm';

export const read = rel => fs.readFileSync(new URL('../' + rel, import.meta.url), 'utf8');

export function charge(files, extra) {
  const ctx = Object.assign({ atob, btoa, TextEncoder, TextDecoder, crypto: globalThis.crypto, Intl, Date, Math, JSON, setTimeout, clearTimeout, console }, extra || {});
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const f of files) vm.runInContext(read('www/' + f), ctx, { filename: f });
  return ctx;
}

export const json = o => JSON.parse(JSON.stringify(o));   // objets du contexte vm → objets ordinaires

// Texte visible d'un rendu HTML, pour vérifier qu'aucun montant signé n'est affiché : scripts (données des infobulles)
// et balises retirés, dates retirées ; une soustraction écrite entre deux termes (« 795 € A − 555 € B ») n'est pas un signe.
export function texteVisible(h) {
  return String(h).replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\d{2}\/\d{2}\/\d{2,4}/g, '')
    .replace(/([€A-Za-zÀ-ÿ»)]) − (?=\d)/g, '$1 moins ');
}
export const montantSigne = h => /[−-]\s?\d/.test(texteVisible(h));
