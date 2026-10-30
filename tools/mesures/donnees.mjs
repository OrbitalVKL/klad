// Jeu de données FICTIF des mesures de l'étude UX : reprise « klad-reprise » sur 36 mois (environ 3 000 opérations),
// dérivée du jeu des tests (test/fictif.mjs) : même carnet (règles, budget, contrats, commun, impôts), plus des achats
// quotidiens tirés par un générateur pseudo-aléatoire à graine fixe (même jeu à chaque mesure) et des opérations
// récentes non classées et non vues. Aucune donnée réelle.
import { repriseFictive } from '../../test/fictif.mjs';

const pad = n => String(n).padStart(2, '0');
const jour = (base, n) => new Date(Date.parse(base + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);

function graine(s) { return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

// fin : « AAAA-MM-JJ » (aujourd'hui dans le jeu).
export function repriseMesures(fin) {
  const r = repriseFictive(fin);
  const hasard = graine(20261028);
  const tx = [];
  const add = (account, date, amount, label) => { if (date <= fin) tx.push({ account, date, amount, label, status: 'comptabilisee' }); };
  const debut = jour(fin, -36 * 30.4 | 0);
  // opérations mensuelles du jeu des tests, répétées sur 36 mois
  const mens = r.transactions.filter(t => t.date.slice(0, 7) === fin.slice(0, 7) || t.date.slice(0, 7) === jour(fin, -31).slice(0, 7));
  const modele = {};
  for (const t of mens) modele[t.account + '|' + t.date.slice(8) + '|' + t.label.replace(/\d\d\/\d\d/, '##/##')] = t;
  for (let k = 0; k < 37; k++) {
    const m = new Date(Date.UTC(+fin.slice(0, 4), +fin.slice(5, 7) - 1 - k, 1)).toISOString().slice(0, 7);
    for (const key of Object.keys(modele)) {
      const t = modele[key], d = m + '-' + key.split('|')[1];
      if (d < debut) continue;
      add(t.account, d, t.amount, t.label.replace(/\d\d\/\d\d/, d.slice(8) + '/' + m.slice(5)));
    }
  }
  // achats quotidiens (classés par les règles du carnet fictif)
  const ENSEIGNES = [['SUPERMARCHE FICTIF', 1500, 9000], ['STATION CARBURANT FICTIVE', 3000, 7000], ['RESTAURANT FICTIF', 1500, 6000],
    ['BAR DU PORT FICTIF', 400, 2500], ['LIBRAIRIE FICTIVE', 800, 3500], ['BOUTIQUE EN LIGNE FICTIVE', 1000, 12000], ['PHARMACIE FICTIVE', 500, 3000]];
  for (let d = debut; d <= fin; d = jour(d, 1)) {
    const n = hasard() < 0.66 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const [lab, a, b] = ENSEIGNES[Math.floor(hasard() * ENSEIGNES.length)];
      const cpt = hasard() < 0.82 ? 'r0' : hasard() < 0.5 ? 'r1' : 'r3';
      add(cpt, d, -Math.round(a + hasard() * (b - a)), 'CARTE ' + d.slice(8) + '/' + d.slice(5, 7) + ' ' + lab);
    }
    if (hasard() < 0.25) add('r2', d, -Math.round(1000 + hasard() * 6000), 'CARTE ' + d.slice(8) + '/' + d.slice(5, 7) + ' SUPERMARCHE FICTIF');
  }
  // opérations récentes sans règle (« non classées »)
  for (let i = 0; i < 92; i++) {
    const d = jour(fin, -Math.floor(hasard() * 88));
    add(hasard() < 0.85 ? 'r0' : 'r2', d, -Math.round(300 + hasard() * 4000), 'CARTE ' + d.slice(8) + '/' + d.slice(5, 7) + ' MARCHAND INCONNU ' + String.fromCharCode(65 + (i % 26)) + pad(i));
  }
  tx.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  r.transactions = tx;
  r.carnet.seen = { cut: jour(fin, -28), k: {} };
  r.created = fin + 'T10:00:00Z';
  r.accounts.push({ ref: 'r5', label: 'LIVRET', role: 'epargne', manual: true, balance: { amount: 640000, date: jour(fin, -3) } });
  return r;
}
