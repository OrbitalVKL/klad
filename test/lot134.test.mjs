// Tests du correctif 1.3.4 : numéro de contrat (reconnaissance d'un prélèvement par son numéro, avant le mot du libellé ;
// plusieurs contrats chez le même organisme), numéros proposés d'après les prélèvements, date de fin (résiliation) :
// prélèvement après la fin « non prévu » (compté à part du poste, pastille, observation, alerte Grafit CAUT tant qu'il
// n'est pas vu), plus d'échéance après la fin. Organisme, numéros et montants FICTIFS.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { json } from './charge.mjs';
import { outils, etatDepuisReprise } from './jeux.mjs';
import { repriseFictive } from './fictif.mjs';

const X = outils(['ui.js', 'vues.js', 'vbudget.js', 'vcommun.js']);
const { KladClasse: K, KladBudget: KB, KladCommun: KC, KladObservations: KO, KladResume: R, KladVues: Vu, KladVuesBudget: VB } = X;
const FIN = '2026-10-28', NOW = Date.parse(FIN + 'T10:00:00Z');
const ctx = S => KB.contexte(S, NOW, K.contexte(S, NOW));

// Trois contrats chez « ASSUREUR FICTIF » sur le compte courant : habitation (AB1111111), auto (CD2222222), accidents
// (EF3333333) ; même début de libellé.
function reprise() {
  const r = repriseFictive(FIN);
  const add = (date, amount, label) => r.transactions.push({ account: 'r0', date, amount, label, status: 'comptabilisee' });
  for (const m of ['2026-08', '2026-09', '2026-10']) {
    add(m + '-04', -2500, 'PRLV ASSUREUR FICTIF HABITATION AB1111111 77' + m.slice(5) + '0000123 RMS2600' + m.slice(5) + 'UI');
    add(m + '-05', -1200, 'PRLV ASSUREUR FICTIF ACCIDENTS EF3333333 77' + m.slice(5) + '0000456 RMS2601' + m.slice(5) + 'UI');
    add(m + '-16', -6000, 'PRLV ASSUREUR FICTIF AUTOMOBILE CD2222222 77' + m.slice(5) + '0000789');
  }
  add('2026-10-28', -2600, 'PRLV ASSUREUR FICTIF HABITATION AB1111111 7710000999 RMS260999UI');
  r.transactions.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  return r;
}
async function etat(contrats) {
  const S = await etatDepuisReprise(X, reprise(), NOW);
  S.budget.contrats = (S.budget.contrats || []).concat(contrats.map((c, i) => Object.assign({ id: 'tf' + i, sc: 'perso', per: 1, poste: 'f|Assurances', src: '', note: '' }, c)));
  return S;
}
const trois = (habit) => [Object.assign({ label: 'Habitation fictive (ancienne)', montant: 2500, motif: 'ASSUREUR FICTIF' }, habit || {}),
  { label: 'Auto fictive', montant: 6000, motif: 'ASSUREUR FICTIF', num: 'CD2222222' },
  { label: 'Accidents fictifs', montant: 1200, motif: 'ASSUREUR FICTIF', num: 'EF3333333' }];

test('numéro de contrat : chaque prélèvement va à son contrat ; sans numéro, le mot seul ne prend plus ceux des autres', async () => {
  const S = await etat(trois({ num: 'AB 1111111' }));
  const B = ctx(S), L = KB.contrats(B, 'perso').filter(c => /^tf/.test(c.id));
  const d = Object.fromEntries(L.map(c => [c.label, c.dernier && c.dernier.montant]));
  assert.deepEqual(d, { 'Habitation fictive (ancienne)': 2600, 'Auto fictive': 6000, 'Accidents fictifs': 1200 }, 'numéro (espaces ignorés)');
  // l'habitation sans numéro : reconnue par le mot, sauf les prélèvements pris par les numéros des deux autres
  const S2 = await etat(trois());
  const L2 = KB.contrats(ctx(S2), 'perso').filter(c => /^tf/.test(c.id));
  assert.equal(L2.find(c => /Habitation/.test(c.label)).dernier.montant, 2600);
  const r = ctx(S2).rows.find(x => /AUTOMOBILE CD2222222/.test(x.label));
  assert.equal(KB.contratDe(ctx(S2), 'perso', r.label).label, 'Auto fictive');
});

test('numéros proposés d\'après les prélèvements reconnus par le mot ; pas les références de prélèvement', async () => {
  const S = await etat(trois());
  const B = ctx(S), c = S.budget.contrats.find(x => x.label === 'Habitation fictive (ancienne)');
  const P = KB.numerosProposes(B, c);
  assert.deepEqual(json(P.map(x => x.num).sort()), ['AB1111111', 'CD2222222', 'EF3333333']);
  assert.equal(P.find(x => x.num === 'AB1111111').n, 4);
  assert.equal(P.find(x => x.num === 'AB1111111').montant, 2600);
  assert.equal(P.find(x => x.num === 'CD2222222').autre, 'Auto fictive', 'déjà pris par un autre contrat');
  assert.ok(!P.some(x => /^RMS/.test(x.num)));
  // formulaire : champ, numéros proposés en puces, fin du contrat
  const h = VB.formContrat(B, 'perso', c.id);
  assert.match(h, /id="ctNum"/);
  assert.match(h, /data-ctnum="AB1111111"/);
  assert.match(h, /id="ctFin" type="date"/);
});

test('fin du contrat passée : prélèvement après la fin « non prévu », compté à part du poste ; contrat, observation, détail, Grafit', async () => {
  const S = await etat(trois({ num: 'AB1111111', fin: '2026-10-15' }));
  let B = ctx(S);
  const apres = B.rows.find(r => r.date === '2026-10-28' && /AB1111111/.test(r.label)), avant = B.rows.find(r => r.date === '2026-10-04' && /AB1111111/.test(r.label));
  assert.ok(B.np.has(apres.id) && !B.np.has(avant.id));
  assert.equal(KB.cleDe(B, apres), 'c|' + KB.APRES_FIN);
  assert.notEqual(KB.cleDe(B, avant), 'c|' + KB.APRES_FIN, 'avant la fin : dans son poste habituel');
  // budget du cycle : la ligne « Après la fin d'un contrat » (hors budget) porte le prélèvement
  const s = KB.suivi(B, 'perso', null);
  const hb = s.horsBudget.lignes.find(a => a.key === 'c|' + KB.APRES_FIN);
  assert.ok(hb && hb.cur === 2600, 'hors budget : 26 €');
  // contrat : état, pas d'échéance après la fin
  const c = KB.contrats(B, 'perso').find(x => x.label === 'Habitation fictive (ancienne)');
  assert.deepEqual(json(c.etat), { niveau: 'bad', texte: 'prélevé après la fin' });
  assert.equal(c.prochaine, null);
  assert.ok(!KB.echeances(B, 31).some(e => e.label === 'Habitation fictive (ancienne)'));
  // observation
  const O = KO.observations(B, 'perso');
  const o = [...(O.faire || []), ...(O.liste || [])].concat(O.toutes || []).find(x => /Habitation fictive \(ancienne\) prélevé après la fin du contrat/.test(x.titre || x.t || ''));
  assert.ok(o || JSON.stringify(O).includes('prélevé après la fin du contrat'), 'observation');
  // détail de l'opération
  const h = Vu.detail(S, apres.o, K.contexte(S, NOW), B);
  assert.match(h, /Non prévu[\s\S]*prélevé après la fin du contrat « Habitation fictive \(ancienne\) »/);
  // Grafit : CAUT tant que non vu, puis plus rien
  apres.o.vue = 0;
  let g = json(R.construire(S, NOW, { budget: ctx(S) }));
  assert.deepEqual(g.alerts.find(a => a.code === 'CANCELLED_CONTRACT_DEBIT'), { level: 'caut', code: 'CANCELLED_CONTRACT_DEBIT', text: 'CONTRAT RÉSILIÉ PRÉLEVÉ' });
  assert.ok(!JSON.stringify(g).includes('AB1111111'), 'jamais de numéro dans le résumé');
  apres.o.vue = true;
  g = json(R.construire(S, NOW, { budget: ctx(S) }));
  assert.equal(g.alerts.find(a => a.code === 'CANCELLED_CONTRACT_DEBIT'), undefined);
});

test('fin du contrat à venir : rien de « non prévu », état « fin le … », plus d\'échéance au-delà', async () => {
  const S = await etat(trois({ num: 'AB1111111', fin: '2026-11-20' }));
  const B = ctx(S);
  assert.equal(B.np.size, 0);
  const c = KB.contrats(B, 'perso').find(x => x.label === 'Habitation fictive (ancienne)');
  assert.deepEqual(json(c.etat), { niveau: 'info', texte: 'fin le 20/11' });
  assert.equal(c.prochaine, null, 'prochaine échéance (28/11) après la fin : aucune');
});

test('enregistrement : numéro sans espaces, fin valide seulement ; champs absents si vides', async () => {
  const S = await etat([]);
  KB.enregistrerContrat(S, ctx(S), { sc: 'perso', label: 'Contrat fictif', montant: 1000, per: 1, motif: 'FICTIF', poste: 'f|Assurances', num: ' ZZ 99 88 77 ', fin: '2026-12-01' });
  KB.enregistrerContrat(S, ctx(S), { sc: 'perso', label: 'Autre fictif', montant: 1000, per: 1, motif: 'FICTIF2', poste: 'f|Assurances', num: '', fin: '01/12/2026' });
  const a = S.budget.contrats.find(c => c.label === 'Contrat fictif'), b = S.budget.contrats.find(c => c.label === 'Autre fictif');
  assert.equal(a.num, 'ZZ998877');
  assert.equal(a.fin, '2026-12-01');
  assert.ok(!('num' in b) && !('fin' in b));
});
