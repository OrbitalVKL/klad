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
