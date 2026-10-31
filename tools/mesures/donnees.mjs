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

// Variante « personnel » (0.10.10, test du mode démo) : même jeu, avec ce qu'un vrai carnet contient de personnel —
// noms de personnes, employeur, catégories et postes créés, contrats avec références, copropriété et syndic, IBAN,
// fin de carte, justificatifs. Tout est inventé ; PERSONNEL liste ce qui ne doit jamais s'afficher en mode démo.
export const PERSONNEL = {
  personnes: ['Aurore Ombelin', 'Basile Quenard'],
  employeur: 'Zéphyrine Industries',
  categories: ['Voyages Atlantide', 'Club Ornithologie Zéphyr', 'Bien-être'],
  postes: ['Billets Atlantide', 'Anniversaire Aurore', 'Cotisation Ornithologie'],
  banque: 'Banque Mirabelle',
  intitule: 'M AURORE OMBELIN COMPTE CHEQUES',
  iban: 'FR76 3000 4000 0312 3456 7890 143',
  finCarte: '4242',
  references: ['7788123', '2024-55871', 'CTR-990077', '2025-118'],
  adresses: ['aurore.ombelin@example.org', 'imap.mirabelle-mail.example', 'ombelin-aurore.github.io'],
  appId: '8f14e45f-ceea-467a-9b2c-1f0e2d3c4b5a',
  textes: ['Résidence Les Mimosas', 'SYNDIC MIMOSAS GESTION', 'Cuisine Ombelin', 'Offre de prêt', 'Prêt Banque Mirabelle', 'Contrat Assurance Phénix', 'Forfait Galaxie Mobile', 'MIMOSAS', 'PHENIX', 'GALAXIE'],
  // 1.1.1 : Patrimoine saisi à la main (crypto, livret, plan d'épargne) et portefeuille rapproché à la main.
  // Montants en centimes (crypto) ou en euros (livret, plan) ; « montants » : leur forme affichée, jamais visible en démo.
  patrimoine: {
    // noms sans mot déjà masqué par ailleurs (personnes, banque…) : chacun doit l'être pour lui-même
    crypto: [['Vortexia Réserve', 777777, 1234567], ['Jeton Calypsium', 250050, 198765]],
    livret: 8642.19, teneur: 'Gestion Calliope Épargne', fonds: 'Fonds Hespéride Horizon', valeurPart: 13.57, versement: 4321.98, ancienPlan: 'Plan Asphodèle Avenir',
    portefeuille: 'Portemonnaie Nébuleuse', motifPortefeuille: 'NEBULAPAY', achat: 'LIBRAIRIE DES ASPHODELES',
    // montants distinctifs seulement (en démo, les montants sont multipliés au hasard : un petit montant peut retomber
    // sur une valeur courante par coïncidence)
    montants: ['7 777,77', '12 345,67', '2 500,50', '1 987,65', '8 642,19', '4 321,98']
  }
};
const REMPLACER = [
  ['SOCIETE FICTIVE', 'ZEPHYRINE INDUSTRIES'], ['Société fictive', 'Zéphyrine Industries'],
  ['VIR PERMANENT PERSONNE A', 'VIR PERMANENT AURORE OMBELIN'], ['VIR PERSONNE B', 'VIR M BASILE QUENARD'],
  ['PERSONNE A', 'OMBELIN'], ['PERSONNE B', 'QUENARD'], ['Personne A', 'Aurore Ombelin'], ['Personne B', 'Basile Quenard'],
  ['Copropriété fictive', 'Résidence Les Mimosas'], ['SYNDIC FICTIF', 'SYNDIC MIMOSAS GESTION'], ['PRLV SYNDIC', 'PRLV SYNDIC MIMOSAS'],
  ['Prêt immobilier fictif', 'Prêt Banque Mirabelle n° 7788123'], ['Tableau fictif', 'Offre de prêt 2024-55871'],
  ['Assurance auto fictive', 'Contrat Assurance Phénix CTR-990077'], ['Téléphone fictif', 'Forfait Galaxie Mobile'],
  ['Cuisine fictive', 'Cuisine Ombelin'], ['facture fictive', 'Facture 2025-118']
];
export function reprisePersonnelle(fin) {
  let t = JSON.stringify(repriseMesures(fin));
  for (const [a, b] of REMPLACER) t = t.split(a).join(b);
  const r = JSON.parse(t);
  const C = r.carnet;
  C.cats.custom['Voyages Atlantide'] = { nat: 'optionnelle' };
  C.cats.custom['Club Ornithologie Zéphyr'] = { nat: 'optionnelle' };
  C.P.rules.push(['ATLANTIDE', 'depense', 'Voyages Atlantide', 'Billets Atlantide', null],
    ['ORNITHOLOGIE', 'depense', 'Club Ornithologie Zéphyr', 'Cotisation Ornithologie', null],
    ['FLEURISTE', 'depense', 'Cadeaux', 'Anniversaire Aurore', null]);
  const pad = n => String(n).padStart(2, '0');
  for (let k = 0; k < 6; k++) {
    const d = new Date(Date.UTC(+fin.slice(0, 4), +fin.slice(5, 7) - 1 - k, 11)).toISOString().slice(0, 10);
    r.transactions.push({ account: 'r0', date: d, amount: -32000, label: 'CARTE ' + d.slice(8) + '/' + d.slice(5, 7) + ' ATLANTIDE AIRWAYS', status: 'comptabilisee' },
      { account: 'r0', date: d, amount: -2500, label: 'PRLV CLUB ORNITHOLOGIE ZEPHYR CTR-' + pad(k) + '4471', status: 'comptabilisee' },
      { account: 'r1', date: d, amount: -4500, label: 'CARTE ' + d.slice(8) + '/' + d.slice(5, 7) + ' FLEURISTE DES MIMOSAS', status: 'comptabilisee' });
  }
  r.transactions.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  C.appels.H.iban = PERSONNEL.iban;
  r.accounts[0].iban_last4 = PERSONNEL.finCarte;
  return r;
}

// Variante « grande » (1.0.1, test de la sauvegarde) : plus grosse que les données réelles du propriétaire —
// au moins 5 000 opérations sur 3 ans, et des pièces jointes fictives (« PDF » de 1 Mo) gardées dans le carnet.
export function repriseGrande(fin) {
  const r = repriseMesures(fin);
  const hasard = graine(20261030);
  const debut = jour(fin, -36 * 30.4 | 0);
  const jours = Math.round((Date.parse(fin) - Date.parse(debut)) / 864e5);
  for (let i = 0; r.transactions.length < 5200; i++) {
    const d = jour(debut, Math.floor(hasard() * jours));
    r.transactions.push({ account: hasard() < 0.8 ? 'r0' : 'r1', date: d, amount: -Math.round(200 + hasard() * 5000),
      label: 'CARTE ' + d.slice(8) + '/' + d.slice(5, 7) + ' SUPERMARCHE FICTIF', status: 'comptabilisee' });
  }
  r.transactions.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  const pdf = 'JVBERi0xLjQK' + 'UERGIGZpY3RpZiBkZSB0ZXN0IA'.repeat(40000);
  r.carnet.pieces = [0, 1, 2].map(i => ({ nom: 'appel-fictif-' + i + '.pdf', data: pdf }));
  return r;
}
