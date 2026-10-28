// Jeu de données FICTIF pour le budget (Lot 6) : reprise « klad-reprise » avec un carnet de l'ancienne version
// (budget, contrats, virements, réglages du salaire). Aucune donnée réelle : enseignes, noms et montants inventés.
// Dates relatives à aujourd'hui (fin) : 9 mois d'historique.

const pad = n => String(n).padStart(2, '0');
function jour(base, n) { const d = new Date(Date.parse(base + 'T12:00:00Z') + n * 864e5); return d.toISOString().slice(0, 10); }
function moisDe(iso, k) { const d = new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1 + k, 1)); return d.toISOString().slice(0, 7); }

// fin : « AAAA-MM-JJ » (aujourd'hui dans le jeu). Salaire le 27 de chaque mois (en avance d'un jour en décembre).
export function repriseFictive(fin) {
  const tx = [];
  const add = (account, date, amount, label) => { if (date <= fin) tx.push({ account, date, amount, label }); };
  for (let k = -9; k <= 0; k++) {
    const m = moisDe(fin, k);
    const d = j => m + '-' + pad(j);
    add('r0', d(m.endsWith('-12') ? 26 : 27), 250000, 'VIR SALAIRE SOCIETE FICTIVE PAIE');
    add('r0', d(2), -80000, 'VIR PERMANENT VERS COMMUN');
    add('r0', d(5), -1999, 'PRLV TELEPHONE FICTIF');
    add('r0', d(8), -4500, 'PRLV ASSURANCE AUTO FICTIVE');
    add('r0', d(10), -1299, 'PRLV STREAMING FICTIF');
    add('r0', d(3), -6230, 'CARTE ' + pad(1) + '/' + m.slice(5, 7) + ' SUPERMARCHE FICTIF');
    add('r0', d(12), -3815, 'CARTE ' + pad(11) + '/' + m.slice(5, 7) + ' SUPERMARCHE FICTIF');
    add('r0', d(19), -5410, 'CARTE ' + pad(18) + '/' + m.slice(5, 7) + ' SUPERMARCHE FICTIF');
    add('r0', d(14), -6000, 'CARTE ' + pad(13) + '/' + m.slice(5, 7) + ' STATION CARBURANT FICTIVE');
    add('r0', d(21), -2800 - (k % 3) * 1500, 'CARTE ' + pad(20) + '/' + m.slice(5, 7) + ' BAR DU PORT FICTIF');
    add('r0', d(24), -4200, 'CARTE ' + pad(23) + '/' + m.slice(5, 7) + ' RESTAURANT FICTIF');
    add('r2', d(2), 80000, 'VIR PERMANENT PERSONNE A');
    add('r2', d(3), 60000, 'VIR PERSONNE B');
    add('r2', d(5), -95000, 'ECH PRET IMMO FICTIF');
    add('r2', d(9), -6000, 'PRLV ENERGIE FICTIVE');
    add('r2', d(15), -2999, 'PRLV BOX FICTIVE');
    if ((+m.slice(5, 7) - 1) % 3 === 0) add('r2', d(6), -45000, 'PRLV SYNDIC FICTIF');
    add('r1', d(6), -2500, 'LIBRAIRIE FICTIVE');
    add('r1', d(16), -8900, 'BOUTIQUE EN LIGNE FICTIVE');
    add('r0', d(28), -10000, 'VIR LIVRET FICTIF');
  }
  // règlement de la carte sur le courant, le 25
  for (let k = -9; k <= 0; k++) { const m = moisDe(fin, k); add('r0', m + '-25', -11400, 'PRLV CARTE FICTIVE'); }
  tx.sort((a, b) => a.date < b.date ? -1 : 1);
  const carnet = {
    cats: { custom: { 'Bien-être': { nat: 'optionnelle' } } },
    P: { rules: [
      ['SOCIETE FICTIVE', 'revenu', 'Revenus', 'Salaire', null],
      ['SUPERMARCHE', 'depense', 'Alimentation', 'Courses', null],
      ['CARBURANT', 'depense', 'Carburant', 'Carburant', null],
      ['RESTAURANT', 'depense', 'Restaurants & bars', 'Restaurants & bars', null],
      ['TELEPHONE', 'depense', 'Abonnements & télécom', 'Téléphone', null],
      ['STREAMING', 'depense', 'Abonnements & télécom', 'Services en ligne', null],
      ['ASSURANCE AUTO', 'depense', 'Assurances', 'Assurance auto', null],
      ['VERS COMMUN', 'depense', 'Logement', 'Contribution compte commun', null],
      ['ECH PRET', 'depense', 'Crédits', 'Prêt immobilier', null],
      ['ENERGIE', 'depense', 'Logement', 'Électricité', null],
      ['BOX', 'depense', 'Abonnements & télécom', 'Internet', null],
      ['SYNDIC', 'depense', 'Logement', 'Charges de copropriété', null],
      ['PERSONNE A', 'revenu', 'Apports compte commun', 'Personne A', null],
      ['PERSONNE B', 'revenu', 'Apports compte commun', 'Personne B', null],
      ['PRLV CARTE', 'interne', 'Virements internes', 'Règlement carte', null],
      ['LIBRAIRIE|BOUTIQUE', 'depense', 'Shopping', 'Achats', null],
      ['VIR LIVRET', 'epargne', 'Épargne', 'Livret', null]
    ] },
    rules: [],
    seen: { cut: jour(fin, -30), k: {} },
    bplan: {
      perso: { 'c|Alimentation': { on: true, amt: 160 }, 'c|Bars': { on: true, amt: 40 }, 'c|Restaurant': { on: true, amt: 30 },
        'c|Carburant': { on: true, amt: 60 }, 'c|Shopping': { on: false }, 'r|Salaire': { mode: 'dernier', on: true },
        'f|Assurance auto': { on: true, amt: 45 }, 'f|Services en ligne': { on: true, amt: 12.99 }, 'f|Téléphone': { on: true, amt: 19.99 } },
      commun: { 'f|Prêt immobilier': { on: true, amt: 950, pg: 60, elig: true }, 'f|Électricité': { on: true, amt: 60, pg: 50 },
        'f|Internet': { on: true, amt: 29.99, pg: 50 }, 'f|Charges de copropriété': { on: true, amt: 150, per: 3, ech: 450, pg: 50, elig: true } }
    },
    budgetRef: moisDe(fin, -6),
    revprev: { perso: 2500, commun: 1400 },
    contrats: [
      { id: 'c1', sc: 'commun', label: 'Prêt immobilier fictif', amt: 950, per: 1, kw: 'ECH PRET', key: 'f|Prêt immobilier', src: 'Tableau fictif' },
      { id: 'c2', sc: 'commun', label: 'Syndic fictif', amt: 450, per: 3, kw: 'SYNDIC', key: 'f|Charges de copropriété', src: 'Appel fictif' },
      { id: 'p1', sc: 'perso', label: 'Assurance auto fictive', amt: 45, per: 1, kw: 'ASSURANCE AUTO', key: 'f|Assurance auto', src: 'Avis fictif' },
      { id: 'p2', sc: 'perso', label: 'Téléphone fictif', amt: 21.99, per: 1, kw: 'TELEPHONE', key: 'f|Téléphone', src: 'Facture fictive' }
    ],
    virements: [
      { id: 'v1', who: 'g', from: 'Courant', amt: 800, day: 2, use: 'fixes', label: 'Virement permanent' },
      { id: 'v2', who: 's', from: 'Autre compte', amt: 600, day: 3, use: 'tout', label: 'Virement personne B' }
    ],
    fisc: {
      avis: { [String(+fin.slice(0, 4) - 1)]: { rev: +fin.slice(0, 4) - 1, parts: 2, sal: { g: 30000, s: 20000 }, ded: { g: 3000, s: 2000 }, fr: { g: false, s: false }, fonc: 0, rcm: 0,
        rni: 45000, irBar: 2600, decote: 0, prop: 0, cred: 0, irNet: 2600, pas: 2400, ps: 0, solde: 200, rfr: 45000, tmi: 11, tmoy: 5.2, per: { g: 3000, s: 2000 } } },
      bs: Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9].filter(k => k < +fin.slice(5, 7)).map(k => ['b' + k, { p: 'g', emp: 'Société fictive', m: fin.slice(0, 4) + '-' + pad(k), pay: fin.slice(0, 4) + '-' + pad(k) + '-27', ni: 2600, pas: 140, taux: 5.4, type: 'perso' }])),
      hyp: {}, soldeBy: {} },
    tf: { surf: 50, ach: '2024-03-01', baseM2: 30, basePk: 0, tCom: 40, tSpe: 1, tTeom: 8, exoCom: 0, reval: 1.5, pg: 50, h2ok: 'oui', avis: {} },
    livret: { base: 1500, date: moisDe(fin, -3) + '-01' },
    appels: { H: { lab: 'Copropriété fictive', to: 'SYNDIC FICTIF', iban: '', items: [[moisDe(fin, -6) + '-01', 'charges', 450], [moisDe(fin, -3) + '-01', 'charges', 450], [moisDe(fin, 0) + '-01', 'charges', 450]],
      stmt: { at: moisDe(fin, -1) + '-20', solde: 0 } } },
    klad: { salaire: { compte: 'r0', motif: 'SOCIETE FICTIVE', paie: 'PAIE', min: 1000, minCycle: 500 },
      commun: { moi: 'Personne A', autre: 'Personne B', motifAutre: 'PERSONNE B' }, cartes: { r3: { motif: 'PRLV CARTE' } },
      appels: { motif: 'SYNDIC', ordre: ['H'], H: 'SYNDIC' },
      livret: { compte: 'r0', motif: 'VIR LIVRET' },
      observations: { secondaire: 'r1', principal: 'r0', motifPret: 'ECH PRET', salaireMin: 1000 },
      pee: { plan: { emp: 'Société fictive', entree: '2025-01-01', anc: 3, abTaux: 100, abPlaf: 500, dispo: 5 } },
      equilibre: { apport: { moi: 5000, autre: 15000 },
        regles: [['PERSONNE B', 'vs', 'credit'], ['PERSONNE A', 'vg', 'credit'], ['.', 'rf', 'credit'], ['ECH PRET', 'pc', 'debit'], ['SYNDIC', 'ch', 'debit'], ['ENERGIE|BOX', 'en', 'debit'], ['.', 'ot', 'debit']],
        ops: [[moisDe(fin, -12) + '-02', 'VIR PERSONNE A', 800, 'vg'], [moisDe(fin, -12) + '-03', 'VIR PERSONNE B', 600, 'vs'], [moisDe(fin, -12) + '-05', 'ECH PRET', -950, 'pc']],
        equip: [['2025-01-15', 'Cuisine fictive', 'facture fictive', 1200, 0, true], ['2025-02-10', 'Peinture fictive', 'facture fictive', 0, 300, false]] } }
  };
  // carte à débit différé : quelques achats
  for (let k = -9; k <= 0; k++) {
    const m = moisDe(fin, k);
    if (m + '-07' <= fin) tx.push({ account: 'r3', date: m + '-07', amount: -6400, label: 'LIBRAIRIE FICTIVE CARTE' });
    if (m + '-18' <= fin) tx.push({ account: 'r3', date: m + '-18', amount: -5000, label: 'RESTAURANT FICTIF CARTE' });
  }
  return {
    format: 'klad-reprise', v: 1, created: fin + 'T10:00:00Z', source: 'carnet',
    accounts: [
      { ref: 'r0', label: 'COURANT', role: 'courant', manual: true, balance: { amount: 185000, date: fin } },
      { ref: 'r1', label: 'SECOND COURANT', role: 'courant', manual: true, balance: { amount: 42000, date: fin } },
      { ref: 'r2', label: 'COMMUN', role: 'commun', manual: true, balance: { amount: 230000, date: fin } },
      { ref: 'r3', label: 'CARTE', role: 'carte_differee', manual: true, settle: { account: 'r0', day: 25 } }
    ],
    transactions: tx.map(t => Object.assign({ status: 'comptabilisee' }, t)),
    carnet
  };
}
