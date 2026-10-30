// Tests (0.10.7) : Budget › Suivi, détail d'un poste. Pour chaque poste et chaque revenu, déplier le poste liste
// exactement les opérations comptées dans « utilisé » (ou « reçu »), et rien d'autre ; un poste sans opération affiche
// « Aucune opération sur cette période ». Noms avec accents, espaces, « & » et « / », postes c|… et f|…, cycle en cours
// vide (le salaire vient d'arriver), postes reçus de la reprise et du complément. Données fictives uniquement.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { charge } from './charge.mjs';
import { repriseFictive } from './fictif.mjs';

const X = charge(['anon.js', 'eb.js', 'format.js', 'modele.js', 'reprise.js', 'classement.js', 'carnet.js', 'budget.js', 'resume.js', 'ui.js', 'vues.js', 'vbudget.js']);
const { KladModele: M, KladClasse: K, KladBudget: KB, KladReprise: RP, KladCarnet: CN, KladVuesBudget: VB } = X;
let n = 0;
const op = (c, date, montant, libelle) => ({ id: c.id + ':t:' + (n++), compte: c.id, date, montant, libelle, statut: 'comptabilisee', source: 'eb', categorie: null, vue: true });
const DEMI = 50;

// Catégories aux noms « difficiles » : accents, espaces, « & », « / ».
function etatAccents() {
  const S = M.vide();
  S.modele.connexions.s1 = { banque: 'Banque Fictive', pays: 'FR', valid_until: '2027-01-01T00:00:00Z' };
  const a = M.nouveauCompte(S, { libelle: 'COURANT', role: 'courant', solde: { centimes: 150000, date: '2026-10-27' } });
  const c = M.nouveauCompte(S, { libelle: 'COMMUN', role: 'commun', solde: { centimes: 300000, date: '2026-10-27' } });
  S.classement = K.nouveau();
  S.classement.categories['Bien être'] = { nature: 'optionnelle' };
  S.classement.categories['Électricité & gaz'] = { nature: 'fixe' };
  S.classement.categories['Apports compte commun'] = { nature: 'revenu', icone: '📥' };
  S.classement.regles = [
    { mot: 'SALAIRE FICTIF', cat: 'Salaire', sub: 'Salaire', sens: 'credit' },
    { mot: 'SPA FICTIF', cat: 'Bien être', sub: 'Bien être' },
    { mot: 'BOX FICTIVE', cat: 'Abonnements & télécom', sub: 'Internet / mobile' },
    { mot: 'ENERGIE FICTIVE', cat: 'Électricité & gaz', sub: 'Électricité & gaz' },
    { mot: 'MARCHE', cat: 'Alimentation', sub: 'Courses' },
    { mot: 'APPORT A', cat: 'Apports compte commun', sub: 'Personne A' }, { mot: 'APPORT B', cat: 'Apports compte commun', sub: 'Personne B' }];
  S.ops[a.id] = [];
  S.ops[c.id] = [];
  for (const m of ['2026-07', '2026-08', '2026-09', '2026-10']) {
    S.ops[a.id].push(op(a, m + '-27', 200000, 'VIR SALAIRE FICTIF PAIE'), op(a, m + '-05', -2999, 'PRLV BOX FICTIVE'),
      op(a, m + '-12', -4500, 'CB SPA FICTIF'), op(a, m + '-14', -3000, 'CB MARCHE FICTIF'), op(a, m + '-20', -1500, 'CB MARCHE FICTIF'));
    S.ops[c.id].push(op(c, m + '-02', 90000, 'VIR APPORT A'), op(c, m + '-03', 60000, 'VIR APPORT B'), op(c, m + '-09', -7000, 'PRLV ENERGIE FICTIVE'));
  }
  for (const id of Object.keys(S.ops)) S.ops[id].sort((x, y) => x.date < y.date ? 1 : -1);
  S.budget = KB.nouveau();
  S.budget.plan.perso = { 'c|Bien être': { on: true, amt: 5000 }, 'c|Alimentation': { on: true, amt: 20000 }, 'f|Internet / mobile': { on: true, amt: 2999 }, 'r|Salaire': { on: true, mode: 'dernier' } };
  S.budget.plan.commun = { 'f|Électricité & gaz': { on: true, amt: 7000, pg: 50 } };
  S.budget.ref = '2026-07';
  S.budget.reglages = { salaire: { motif: 'SALAIRE FICTIF', paie: 'PAIE', min: 1000, minCycle: 500 }, commun: { moi: 'Personne A', autre: 'Personne B' } };
  return S;
}

// Reprise fictive (postes, contrats et réglages du carnet et de son complément).
async function etatReprise(fin) {
  const now = Date.parse(fin + 'T10:00:00Z');
  const rep = RP.valider(repriseFictive(fin));
  const S = M.vide();
  const choix = {}; for (const r of rep.comptes) choix[r.ref] = 'creer';
  RP.appliquer(S, rep, choix, { now });
  await CN.convertir(S, S.carnet, { now });
  KB.importer(S, S.carnet, { now, renommer: CN.renommeur(S.carnet) });
  return S;
}

// Identifiants d'opérations du rendu (boutons « classer » des lignes de détail).
const idsDe = h => [...h.matchAll(/data-op="([^"]+)"/g)].map(x => x[1].replace(/&amp;/g, '&').replace(/&#39;/g, '\'').replace(/&quot;/g, '"'));

// Vérifie chaque poste et chaque revenu d'un suivi (périmètre, période).
function verifier(S, now, scope, nav, nom) {
  const B = KB.contexte(S, now);
  const s = KB.suivi(B, scope, nav);
  const base = new Set(idsDe(VB.suivi(B, scope, { nav, ouverts: new Set() }).html));
  const postes = [];
  for (const nk of KB.NATS) postes.push(...s.sections[nk].lignes);
  postes.push(...s.horsBudget.lignes);
  // sections ouvertes pour que les postes soient dessinés
  const secs = ['m|rev', ...KB.NATS.map(k => 'm|' + k), 'm|hb'];
  let vus = 0;
  for (const a of postes) {
    const h = VB.suivi(B, scope, { nav, ouverts: new Set([...secs, a.key]) }).html;
    assert.ok(h.includes('data-poste="' + a.key.replace(/&/g, '&amp;') + '"'), nom + ' : poste ' + a.key + ' touchable');
    const ids = idsDe(h).filter(id => !base.has(id));
    const attendu = [...(a.ops || [])].map(r => r.id);
    assert.deepEqual(ids.slice().sort(), attendu.slice().sort(), nom + ' : opérations de ' + a.key);
    const somme = (a.ops || []).reduce((t, r) => t - r.m, 0);
    const utilise = a.debit !== undefined ? a.debit : a.cur;
    assert.ok(Math.abs(somme - utilise) < DEMI, nom + ' : ' + a.key + ' utilisé ' + utilise + ' = somme du détail ' + somme);
    if (!attendu.length && !(a.contrats || []).length) assert.match(h, /Aucune opération sur cette période/, nom + ' : ' + a.key + ' vide');
    vus++;
  }
  for (const x of s.revenus.lignes) {
    const k = 'rev|' + x.key;
    const h = VB.suivi(B, scope, { nav, ouverts: new Set([...secs, k]) }).html;
    const ids = idsDe(h).filter(id => !base.has(id));
    assert.deepEqual(ids.slice().sort(), [...x.ops].map(r => r.id).sort(), nom + ' : revenus ' + x.key);
    assert.ok(Math.abs(x.ops.reduce((t, r) => t + r.m, 0) - x.got) < DEMI, nom + ' : reçu ' + x.key);
    if (!x.ops.length) assert.match(h, /Aucune opération sur cette période/);
  }
  return vus;
}

test('détail d\'un poste : noms avec accents, « & » et « / », cycle en cours vide (salaire du jour), cycles passés', () => {
  const S = etatAccents();
  const now = Date.parse('2026-10-27T18:00:00Z');                    // le salaire vient d'arriver : cycle vide
  const B = KB.contexte(S, now);
  const s = KB.suivi(B, 'perso', null);
  assert.equal(s.per.start || (s.per.cyc && s.per.cyc.start), s.per.start || '2026-10-27');
  assert.equal(s.total.C, 0, 'cycle en cours vide');
  let n = verifier(S, now, 'perso', null, 'perso en cours');
  const per = KB.periode(B, 'perso', null);
  let nav = per.prev;
  for (let i = 0; i < 3 && nav; i++) { n += verifier(S, now, 'perso', nav, 'perso ' + nav); nav = KB.periode(B, 'perso', nav).prev; }
  n += verifier(S, now, 'commun', null, 'commun en cours');
  const pc = KB.periode(B, 'commun', null).prev;
  if (pc) n += verifier(S, now, 'commun', pc, 'commun ' + pc);
  assert.ok(n >= 10, n + ' postes vérifiés');
  // les postes aux noms difficiles sont bien là, avec leurs opérations au cycle précédent
  const p = KB.suivi(B, 'perso', per.prev);
  const tous = KB.NATS.flatMap(k => p.sections[k].lignes);
  assert.equal(tous.find(a => a.key === 'c|Bien être').ops.length, 1);
  assert.equal(tous.find(a => a.key === 'f|Internet / mobile').ops.length, 1);
});

test('détail d\'un poste : postes de la reprise et du complément, en début, milieu et fin de cycle', async () => {
  for (const fin of ['2026-10-27', '2026-11-05', '2026-10-20']) {
    const S = await etatReprise(fin);
    const now = Date.parse(fin + 'T18:00:00Z');
    const B = KB.contexte(S, now);
    let n = verifier(S, now, 'perso', null, fin + ' perso');
    let nav = KB.periode(B, 'perso', null).prev;
    for (let i = 0; i < 2 && nav; i++) { n += verifier(S, now, 'perso', nav, fin + ' perso ' + nav); nav = KB.periode(B, 'perso', nav).prev; }
    n += verifier(S, now, 'commun', null, fin + ' commun');
    assert.ok(n >= 8, fin + ' : ' + n + ' postes vérifiés');
  }
});
