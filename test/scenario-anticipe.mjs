// Jeu FICTIF « personnel » complété du scénario du 01/11 (1.1.2) : trois virements permanents du courant vers le
// commun, prévus le 1er du mois. En novembre, le 1er tombe un dimanche férié : la banque les exécute le vendredi 30/10.
// La banque les renvoie d'abord datés du 30/10, sans référence (identifiant fabriqué à partir de la date), puis le
// lendemain datés du 31/10 avec une référence au libellé (même débit, relu). Ils arrivent sur le commun le lundi 02/11 ;
// le virement de l'autre personne arrive le 03/11. Contre-épreuve : virements exécutés le 01/11.
// Historique (reprise) arrêté au 28/10, la suite arrive par la synchronisation (lectures successives).
// Aucune donnée réelle : noms, libellés et montants inventés.
import { reprisePersonnelle } from '../tools/mesures/donnees.mjs';
import { etatDepuisReprise } from './jeux.mjs';

export const VIRS = [['CREDIT', 50000, 'credit'], ['COPRO', 20000, 'copro'], ['CHARGES', 10000, 'fixes']];
const REFS = { CREDIT: '7300100000000001', COPRO: '7300100000000002', CHARGES: '7300100000000003' };
const BASE = '2026-10-28';

// Reprise : le virement permanent unique (800 €, le 2) devient trois virements prévus le 1er (même total).
function reprise() {
  const r = reprisePersonnelle(BASE);
  const tx = [];
  for (const t of r.transactions) {
    const m = t.date.slice(0, 7);
    if (t.account === 'r0' && t.label === 'VIR PERMANENT VERS COMMUN') for (const [k, v] of VIRS) tx.push(Object.assign({}, t, { date: m + '-01', amount: -v, label: 'VIR PERMANENT VERS COMMUN ' + k }));
    else if (t.account === 'r2' && t.label === 'VIR PERMANENT AURORE OMBELIN') for (const [k, v] of VIRS) tx.push(Object.assign({}, t, { date: m + '-01', amount: v, label: 'VIR PERMANENT AURORE OMBELIN ' + k }));
    else tx.push(t);
  }
  r.transactions = tx.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  r.carnet.virements = VIRS.map(([k, v, u], i) => ({ id: 'v' + (i + 1), who: 'g', from: 'Courant', amt: v / 100, day: 1, use: u, label: 'Virement ' + k.toLowerCase() }))
    .concat([{ id: 'v4', who: 's', from: 'Autre compte', amt: 600, day: 3, use: 'tout', label: 'Virement personne B' }]);
  return r;
}

// Opération Enable Banking fictive.
const eb = (date, montant, label, id) => ({ booking_date: date, value_date: date, transaction_amount: { amount: String(Math.abs(montant) / 100), currency: 'EUR' },
  credit_debit_indicator: montant < 0 ? 'DBIT' : 'CRDT', remittance_information: [label], status: 'BOOK', transaction_id: id });

// Lectures de la banque jusqu'au jour « fin » : [{ le, compte (r0 | r2), ops }]. Chaque lecture renvoie toutes les
// opérations depuis le 25/10 (comme la synchronisation : dernière date comptabilisée − 5 jours).
function lectures(fin, avance) {
  const L = [], r0 = [], r2 = [];
  const lire = (le, cpt, liste) => { if (le <= fin) L.push({ le, compte: cpt, ops: liste.filter(x => x.booking_date <= le) }); };
  if (avance) {
    // le 30/10 au soir : datés du 30/10, sans référence ; à partir du 31/10 : datés du 31/10, avec référence
    lire('2026-10-30', 'r0', VIRS.map(([k, v], i) => eb('2026-10-30', -v, 'VIR PERMANENT VERS COMMUN ' + k, '2026-10-30T00:00:00-' + (i + 1))));
    r0.push(...VIRS.map(([k, v], i) => eb('2026-10-31', -v, 'VIR PERMANENT VERS COMMUN ' + k + ' ' + REFS[k], '2026-10-31T00:00:00-' + (i + 1))));
  } else r0.push(...VIRS.map(([k, v], i) => eb('2026-11-01', -v, 'VIR PERMANENT VERS COMMUN ' + k + ' ' + REFS[k], '2026-11-01T00:00:00-' + (i + 1))));
  r2.push(...VIRS.map(([k, v], i) => eb('2026-11-02', v, 'VIR PERMANENT AURORE OMBELIN ' + k + ' ' + REFS[k], 'C-' + (i + 1))), eb('2026-11-03', 60000, 'VIR M BASILE QUENARD', 'C-4'));
  for (const le of ['2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03']) { lire(le, 'r0', r0); lire(le, 'r2', r2); }
  return L;
}

// État au jour « fin » (AAAA-MM-JJ), après les lectures de la banque. X : contexte chargé (test/jeux.mjs:outils).
export async function etatAnticipe(X, fin, opts) {
  const avance = !opts || opts.avance !== false;
  const { KladModele: M } = X;
  const S = await etatDepuisReprise(X, reprise(), Date.parse(BASE + 'T10:00:00Z'));
  const map = S.modele.reprise.map;
  for (const lu of lectures(fin, avance)) {
    const cid = map[lu.compte], c = M.compte(S, cid);
    const now = Date.parse(lu.le + 'T19:00:00Z');
    M.integrer(S, cid, lu.ops, now, { depuis: '2026-10-25' });
    // solde du compte manuel : celui de la banque (somme des opérations, chaque débit une seule fois)
    void c;
  }
  for (const ref of ['r0', 'r2']) {
    const c = M.compte(S, map[ref]);
    const base = { r0: 185000, r2: 230000 }[ref];
    const apres = (S.ops[c.id] || []).filter(o => o.date > BASE && o.source === 'eb');
    // la banque n'a débité qu'une fois : solde = solde du 28/10 + mouvements réels
    const reels = avance && ref === 'r0' ? VIRS.reduce((t, [, v]) => t - v, 0) : apres.reduce((t, o) => t + o.montant, 0);
    c.solde = { centimes: base + (ref === 'r0' && !avance ? apres.reduce((t, o) => t + o.montant, 0) : reels), date: fin };
  }
  return S;
}

// Chiffres du tableau avant / après (centimes) et alertes du résumé Grafit.
export function chiffres(X, S, fin) {
  const { KladClasse: K, KladBudget: KB, KladCommun: KC, KladResume: R } = X;
  const now = Date.parse(fin + 'T10:00:00Z');
  const B = KB.contexte(S, now, K.contexte(S, now));
  const s = KB.suivi(B, 'perso', null);
  const lien = s.sections.fixe.lignes.find(l => l.key === 'f|Contribution compte commun') || {};
  const MR = KC.margeReelle(B), F = KC.finDeMois(B), C = KC.tresorerie(B), P = KC.plan(B);
  const g = R.construire(S, now, { budget: B });
  const SM = JSON.parse(JSON.stringify(S)); SM.budget.reglages = Object.assign({}, SM.budget.reglages, { cycle: 'mois' });
  const Bm = KB.contexte(SM, now, K.contexte(SM, now)), sm = KB.suivi(Bm, 'perso', null);
  const lm = sm.sections.fixe.lignes.find(l => l.key === 'f|Contribution compte commun') || {};
  return {
    cycle: s.per.start + ' → ' + s.per.end,
    contribution: { utilise: lien.cur, budget: lien.pm, etat: lien.etat && lien.etat.texte },
    contributionMois: { utilise: lm.cur, budget: lm.pm, etat: lm.etat && lm.etat.texte },
    fixes: { budget: s.T.fixe.p, utilise: s.T.fixe.c, aVenir: s.T.fixe.left },
    fixesMois: { utilise: sm.T.fixe.c, aVenir: sm.T.fixe.left },
    ravSalaire: s.rav.budget.reste, ravSalaireFixes: s.rav.budget.fixes, ravComptes: s.rav.comptes && s.rav.comptes.reste, ravComptesFixes: s.rav.comptes && s.rav.comptes.fixes,
    margeCommun: MR && (MR.affichee != null ? MR.affichee : MR.marge), margeReelle: MR && MR.marge, enAttente: MR && (MR.enAttente != null ? MR.enAttente : MR.attendus),
    finDeMois: F && F.end, attendus: F && F.inc, enRoute: F && (F.route || 0),
    virements: P.recus.map(x => x.vu ? 'reçu ' + x.vu.date : x.route ? 'en route' : x.retard ? 'non reçu' : 'attendu'),
    tresorerie: C && { pointBas: C.min, le: C.minAt, decouvert: C.negAt || null },
    alertes: (g.alerts || []).filter(a => ['BUDGET_OVER', 'OVERDRAFT_RISK'].indexOf(a.code) >= 0).map(a => a.level + ' ' + a.code + ' ' + a.text),
    grafitMonth: g.month && { spent: g.month.spent, budget: g.month.budget, left_to_live: g.month.left_to_live },
    grafitUpcoming: (g.upcoming || []).map(e => e.date + ' ' + e.label + ' ' + e.amount),
    grafitCommun: g.commun && { end_of_month: g.commun.end_of_month, transfers_expected: g.commun.transfers_expected, overdraft_risk: g.commun.overdraft_risk },
    echeances: KB.echeances(B, 31).map(e => e.date + ' ' + e.label + ' ' + e.montant),
    observations: X.KladObservations.audit(B).filter(a => /dépassé|Virements|virements/.test(a.titre)).map(a => a.titre + ' : ' + a.texte),
    operationsVirements: (S.ops[S.modele.reprise.map.r0] || []).filter(o => /VERS COMMUN/.test(o.libelle) && o.date >= '2026-10-25').length
  };
}
