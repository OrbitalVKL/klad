// Klad — compte commun (Lot 7) : virements permanents attendus et reçus, virements à mettre en place, virement
// ponctuel, échéances non mensuelles et réserve, impôts prélevés, appels de fonds, trésorerie sur 12 mois, « d'où vient
// le solde », marge réelle, fin de mois estimée, équilibre des apports. Calculs identiques à l'ancienne version.
// Fonctions pures, testées dans node (test/commun.test.mjs). Montants en centimes.
//
// Aucun nom de personne, de syndic, de prêteur ou de banque dans ce fichier : motifs de libellé, noms des deux personnes,
// apports initiaux, historique de l'équilibre et équipements sont des données (complément privé, carnet, réglages).
(function (g) {
  'use strict';

  const M = () => g.KladModele;
  const K = () => g.KladClasse;
  const KB = () => g.KladBudget;
  const isObj = o => o != null && typeof o === 'object' && !Array.isArray(o);
  const DEMI = 50;
  const shift = (m, k) => KB().shift(m, k);
  const plusJours = (d, n) => M().plusJours(d, n);
  const fold = s => K().fold(s);
  const rx = (m, f) => { try { return m ? new RegExp(m, f == null ? 'i' : f) : null; } catch (e) { return null; } };

  // Impôts : prélèvements de l'administration fiscale (motifs génériques, remplaçables par des données).
  const IMPOTS = { motif: 'DIRECTION GENERALE|DGFIP|DRFIP|FINANCES PUBLIQUES', source: 'A LA SOURCE', solde: 'SOLDE IMPOT' };
  const USAGES = { credit: 'Crédit (prêts + assurance)', copro: 'Copropriété + parking', fixes: 'Charges fixes et autres', tout: 'Toutes les charges' };
  const usageDe = key => /Prêt|Assurance emprunteur/.test(key) ? 'credit' : /copropriété|parking/i.test(key) ? 'copro' : 'fixes';
  // Équilibre : sortes de mouvements du compte commun (libellés génériques par défaut).
  const SORTES = { vg: 'Mes versements', vs: 'Versements de l\'autre personne', rs: 'Rendu à l\'autre personne', dp: 'Déblocage du prêt', rf: 'Remboursements reçus',
    pc: 'Échéance du prêt principal', pa: 'Échéance du second prêt', pi: 'Assurance emprunteur', ve: 'Appels de fonds et travaux', ch: 'Charges de copropriété – habitation',
    cp: 'Charges de copropriété – parking', en: 'Énergie, eau, internet, assurance habitation', fb: 'Frais bancaires', im: 'Impôt prélevé', ot: 'Autres dépenses communes' };
  const NON_ELIG = ['en', 'fb', 'im', 'ot'];

  // ------------------------------------------------------------ réglages (complément / carnet, surchargés par Klad)
  function reglages(B) {
    const S = B.S;
    const st = S.carnet ? KB().racine(S.carnet) : null;
    const X = KB().complement(S);
    const D = S.budget || {};
    const c = Object.assign({}, isObj(X.commun) ? X.commun : {}, isObj(D.reglages) && isObj(D.reglages.commun) ? D.reglages.commun : {});
    const ap = isObj(X.appels) ? X.appels : {};
    const eq = Object.assign({}, isObj(X.equilibre) ? X.equilibre : {});
    const P = st && g.KladCarnet ? g.KladCarnet.payload(st) : {};
    if (!Array.isArray(eq.ops) && Array.isArray(P.eqops)) eq.ops = P.eqops;
    if (!Array.isArray(eq.equip) && Array.isArray(P.equip)) eq.equip = P.equip;
    return {
      moi: B.R.commun.moi || 'Moi', autre: B.R.commun.autre || 'L\'autre personne', nomsConnus: !!(B.R.commun.moi && B.R.commun.autre),
      motifAutre: rx(c.motifAutre), appels: ap, equilibre: eq,
      impots: { motif: rx(IMPOTS.motif), source: rx(IMPOTS.source), solde: rx(IMPOTS.solde) }
    };
  }
  const R7 = B => B.memo.R7 || (B.memo.R7 = reglages(B));
  const lignesCommun = B => KB().postes(B, 'commun').lignes;
  const opsCommun = B => B.memo.opsC || (B.memo.opsC = B.rows.filter(r => r.role === 'commun' && !r.ecart));
  const virements = B => (B.D.virements || []).filter(v => +v.montant > 0 || v.montant === 0);

  // ------------------------------------------------------------ virements permanents
  // Virement v reçu au mois m sur le compte commun ? → opération ou null.
  function virementVu(B, v, m) {
    const R = R7(B);
    const deLautre = r => (R.motifAutre && R.motifAutre.test(r.label)) || (R.nomsConnus && r.sub === R.autre);
    const qui = r => v.qui === 'moi' ? !deLautre(r) : deLautre(r);
    // 1.1.2 : mois de l'échéance réglée (arrivée en avance ou en retard de quelques jours rattachée au bon mois)
    const cand = opsCommun(B).filter(r => r.m > 0 && KB().dateCompte(r).slice(0, 7) === m && qui(r));
    const ex = cand.find(r => Math.abs(r.m - v.montant) < 1);
    if (ex) return ex;
    const autres = (B.D.virements || []).filter(x => x !== v && x.qui === v.qui).map(x => +x.montant || 0);
    const mot = v.label ? fold(v.label).split(' ')[0] : '';
    return cand.find(r => Math.abs(r.m - v.montant) <= 0.15 * v.montant && !autres.some(o => Math.abs(r.m - o) < 1) && (!v.label || fold(r.label).indexOf(mot) >= 0 || v.qui === 'autre')) || null;
  }
  // ------------------------------------------------------------ jours ouvrés (1.1.3)
  // Jours fériés nationaux français (pas ceux d'Alsace-Moselle) : 1er janvier, lundi de Pâques, 1er et 8 mai, Ascension,
  // lundi de Pentecôte, 14 juillet, 15 août, 1er et 11 novembre, 25 décembre.
  const FERIES = {};
  function paques(y) {
    const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    const h = (19 * a + b - d - Math.floor((b - f + 1) / 3) + 15) % 30, i = Math.floor(c / 4), k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mois = Math.floor((h + l - 7 * m + 114) / 31), jour = ((h + l - 7 * m + 114) % 31) + 1;
    return y + '-' + String(mois).padStart(2, '0') + '-' + String(jour).padStart(2, '0');
  }
  function feries(y) {
    if (FERIES[y]) return FERIES[y];
    const p = paques(y);
    const L = ['01-01', '05-01', '05-08', '07-14', '08-15', '11-01', '11-11', '12-25'].map(x => y + '-' + x)
      .concat([plusJours(p, 1), plusJours(p, 39), plusJours(p, 50)]);
    return (FERIES[y] = new Set(L));
  }
  const ferie = d => feries(+d.slice(0, 4)).has(d);
  const ouvre = d => { const j = new Date(d + 'T12:00:00Z').getUTCDay(); return j !== 0 && j !== 6 && !ferie(d); };
  // Nombre de jours ouvrés après le jour a, jusqu'au jour b compris (0 si b ≤ a).
  function joursOuvres(a, b) {
    let n = 0;
    for (let d = plusJours(a, 1); d <= b && n < 400; d = plusJours(d, 1)) if (ouvre(d)) n++;
    return n;
  }

  // ------------------------------------------------------------ virements « en route » (1.1.2, jours ouvrés en 1.1.3)
  // Virement parti d'un compte perso vers le commun (montant d'un de mes virements permanents, ou poste « contribution »)
  // et pas encore arrivé : pas de crédit de même montant sur le commun dans les 5 jours ouvrés qui suivent le départ
  // (ou jusqu'à 5 jours avant, si la banque date le départ après l'arrivée). Il reste « en route » 5 jours ouvrés après
  // son départ (week-ends et jours fériés exclus) ; au-delà, il redevient « non reçu ». À l'arrivée, il est rapproché du
  // départ (departDe). → [{ depart (ligne), montant, pour (mois de l'échéance), v (virement permanent ou null) }].
  const ROUTE_JOURS = 5;
  function routes(B) {
    if (B.memo.routes) return B.memo.routes;
    const R = B.memo.routes = { out: [], paires: new Map() };
    if (!B.comptes.some(c => c.role === 'commun')) return R;
    const V = (B.D.virements || []).filter(v => v.qui === 'moi' && +v.montant > 0), LINK = B.R.commun.contribution;
    const departs = B.rows.filter(r => PERSO.indexOf(r.role) >= 0 && r.m < 0 && !r.ecart && r.type === 'depense' &&
      (r.sub === LINK || (/^VIR/.test(K().fold(r.label)) && V.some(v => Math.abs(-r.m - v.montant) < 1))));
    const arrivees = opsCommun(B).filter(r => r.m > 0 && !KB().deLautre(B, r));
    const delai = (d, a) => a.date < d.date ? KB().dDiff(a.date, d.date) : joursOuvres(d.date, a.date);
    const out = R.out;
    for (const d of departs) {
      let best = null, bd = Infinity;
      for (const a of arrivees) {
        if (R.paires.has(a) || Math.abs(a.m + d.m) >= 1 || delai(d, a) > ROUTE_JOURS) continue;
        const e = Math.abs(KB().dDiff(d.date, a.date));
        if (e < bd) { best = a; bd = e; }
      }
      if (best) { R.paires.set(best, d); continue; }
      if (d.date > B.auj || joursOuvres(d.date, B.auj) > ROUTE_JOURS) continue;
      out.push({ depart: d, montant: -d.m, pour: KB().dateCompte(d).slice(0, 7), v: null });
    }
    // chaque départ est relié à un de mes virements (montant identique, sinon à 15 % près), une fois
    const libres = V.slice();
    for (const pass of [x => Math.abs(x.r.montant - x.v.montant) < 1, x => Math.abs(x.r.montant - x.v.montant) <= 0.15 * x.v.montant]) {
      for (const r of out) {
        if (r.v) continue;
        const i = libres.findIndex(v => pass({ r, v }));
        if (i >= 0) { r.v = libres[i]; libres.splice(i, 1); }
      }
    }
    return R;
  }
  const enRoute = B => routes(B).out;
  // Départ (ligne du compte perso) d'un virement arrivé sur le commun, ou null (1.1.3).
  const departDe = (B, a) => routes(B).paires.get(a) || null;
  const PERSO = ['courant', 'carte_differee', 'paiement_en_ligne'];
  // Virements en route pour le mois m (échéance de m ou d'avant), reliés à un virement permanent pas encore reçu.
  function enRouteMois(B, m) {
    return enRoute(B).filter(r => r.v && r.pour <= m && !virementVu(B, r.v, m));
  }
  const routeDe = (B, v, m) => enRouteMois(B, m).find(r => r.v === v) || null;

  const somme = (B, qui, usage) => (B.D.virements || []).filter(v => v.qui === qui && (!usage || v.usage === usage)).reduce((t, v) => t + (+v.montant || 0), 0);

  // ------------------------------------------------------------ impôts prélevés sur le commun
  function impots(B) {
    if (B.memo.tax) return B.memo.tax;
    const R = R7(B).impots, cur = B.auj.slice(0, 7), out = [];
    const tx = opsCommun(B).filter(r => r.m < 0 && r.date.slice(0, 7) >= shift(cur, -2) && R.motif && R.motif.test(r.label));
    for (const [re, lab, sol] of [[R.source, 'Impôt · prélèvement à la source', false], [R.solde, 'Impôt · solde étalé', true]]) {
      if (!re) continue;
      const L = tx.filter(r => re.test(r.label)).sort((a, b) => a.date < b.date ? -1 : 1);
      if (!L.length) continue;
      const l = L[L.length - 1], lm = l.date.slice(0, 7), day = Math.min(28, +l.date.slice(8, 10));
      const last = sol ? l.date.slice(0, 4) + '-12' : shift(cur, 11);
      for (let k = 0; k < 12; k++) { const m = shift(cur, k); if (m > last) break; if (m <= lm) continue; out.push({ m, d: day, v: l.m, lab }); }
    }
    return (B.memo.tax = out);
  }

  // ------------------------------------------------------------ trésorerie sur 12 mois
  function tresorerie(B) {
    if ('cash' in B.memo) return B.memo.cash;
    const bal = KB().soldes(B, ['commun']);
    if (!bal) return (B.memo.cash = null);
    const cur = B.auj.slice(0, 7), dNow = +B.auj.slice(8, 10), end = shift(cur, 12), ev = [], due = [];
    const ctrMontant = key => { const cs = (B.D.contrats || []).filter(c => c.sc === 'commun' && c.poste === key && (+c.per || 1) === 1); return cs.length ? cs.reduce((t, c) => t + c.montant, 0) : null; };
    const TXE = impots(B);
    for (const a of lignesCommun(B)) {
      if (!a.on || !(a.amt > 0)) continue;
      if (a.key === 'f|Impôts' && TXE.length) continue;
      const l = KB().dernierDebitPoste(B, a.key), lm = l ? l.pd.slice(0, 7) : null, day = l ? Math.min(28, +l.pd.slice(8, 10)) : 5;
      if (a.per === 1) {
        const amt = ctrMontant(a.key); const v = amt != null ? amt : a.amt;
        for (let k = 0; k < 12; k++) { const m = shift(cur, k); if (k === 0 && lm === cur) continue; ev.push({ m, d: k === 0 ? Math.max(day, dNow) : day, v: -v, lab: a.label, key: a.key }); }
      } else {
        const per = a.per, ech = a.ech || a.amt * per;
        const next = KB().moisProchaineEcheance(B, a.key, per, ech);
        for (let m = next; m < end; m = shift(m, per)) { const late = m < cur; ev.push({ m: late ? cur : m, d: late ? dNow : 5, v: -ech, lab: a.label, per: true, key: a.key }); due.push({ m, lab: a.label, v: ech, late }); }
      }
    }
    for (const e of TXE) ev.push(Object.assign({}, e, { d: e.m === cur ? Math.max(e.d, dNow) : e.d, key: 'f|Impôts' }));
    for (const v of B.D.virements || []) {
      const amt = +v.montant || 0;
      if (!amt) continue;
      const day = Math.min(28, +v.jour || 1);
      for (let k = 0; k < 12; k++) { const m = shift(cur, k); if (k === 0 && virementVu(B, v, cur)) continue; ev.push({ m, d: k === 0 ? Math.max(day, dNow) : day, v: amt, lab: v.label, inc: true, qui: v.qui }); }
    }
    ev.sort((x, y) => x.m < y.m ? -1 : x.m > y.m ? 1 : (x.d - y.d) || ((y.inc ? 1 : 0) - (x.inc ? 1 : 0)));
    let b = bal.v, min = bal.v, minAt = B.auj, negAt = '', negV = 0;
    const months = {};
    for (const e of ev) {
      b += e.v;
      const mo = months[e.m] || (months[e.m] = { m: e.m, in: 0, out: 0, low: Infinity });
      if (e.v > 0) mo.in += e.v; else mo.out -= e.v;
      mo.end = b; mo.low = Math.min(mo.low, b);
      if (b < min - 0.5) { min = b; minAt = e.m + '-' + String(e.d).padStart(2, '0'); }
      if (!negAt && b < -0.5) { negAt = e.m + '-' + String(e.d).padStart(2, '0'); negV = b; }
    }
    const ML = [];
    let last = bal.v;
    for (let m = cur; m < end; m = shift(m, 1)) { const mo = months[m] || { m, in: 0, out: 0, end: last, low: last }; if (mo.low === Infinity) mo.low = mo.end; last = mo.end; ML.push(mo); }
    due.sort((x, y) => x.m < y.m ? -1 : 1);
    return (B.memo.cash = { start: bal.v, min, minAt, negAt, negV, months: ML, due, ev });
  }

  // ------------------------------------------------------------ d'où vient le solde
  function origine(B) {
    if ('why' in B.memo) return B.memo.why;
    const bal = KB().soldes(B, ['commun']);
    if (!bal) return (B.memo.why = null);
    const cur = B.auj.slice(0, 7), V = B.D.virements || [];
    let S0 = cur;
    for (let m = shift(cur, -1); m >= '2000-01'; m = shift(m, -1)) {
      if (!V.length || !V.every(v => virementVu(B, v, m))) break;
      if (!opsCommun(B).some(r => r.date.slice(0, 7) === m)) break;
      S0 = m;
    }
    const from = S0 + '-01', rows = opsCommun(B).filter(r => r.date >= from && r.date <= B.auj);
    const tot = rows.reduce((t, r) => t + r.m, 0), B0 = bal.v - tot;
    let n = 0;
    for (let m = S0; m <= cur; m = shift(m, 1)) n++;
    const credits = rows.filter(r => r.m > 0).reduce((t, r) => t + r.m, 0), attendu = V.reduce((t, v) => t + (+v.montant || 0), 0) * n;
    const lignes = lignesCommun(B).filter(a => a.on && a.amt > 0), parK = {};
    let bud = 0;
    for (const a of lignes) { parK[a.key] = { a, real: 0, bud: a.amt * n, ops: [] }; bud += a.amt * n; }
    const hb = {};
    let autres = 0;
    for (const r of rows) {
      if (r.m >= 0) continue;
      if (r.type === 'depense') {
        const k = KB().cleDe(B, r);
        if (parK[k]) { parK[k].real -= r.m; parK[k].ops.push(r); }
        else { (hb[k] = hb[k] || { lab: k.slice(2), real: 0, ops: [] }).real -= r.m; hb[k].ops.push(r); }
      } else autres -= r.m;
    }
    const items = [];
    for (const x of Object.values(parK)) {
      const e = x.real - x.bud;
      if (Math.abs(e) < 100) continue;
      const a = x.a;
      let why, sorte;
      if (a.per > 1) {
        const gros = x.ops.filter(o => -o.m > a.ech * 1.5);
        why = gros.length ? { gros: gros.map(o => ({ montant: -o.m, date: o.date, n: Math.round(-o.m / a.ech) })), plusQue: e > 0 ? x.bud : null, n } : { texte: e < 0 ? 'échéance pas encore tombée : la réserve se constitue' : 'échéance plus élevée que la provision' };
        sorte = e > 0 ? 'passager' : 'réserve';
      } else {
        const cm = KB().contratsDe(B, a.key, 'commun').filter(c => (+c.per || 1) === 1).reduce((t, c) => t + c.montant, 0);
        if (e > 0 && cm > a.amt + DEMI) { why = { contrat: cm, budget: a.amt }; sorte = 'récurrent'; }
        else if (e > 0) { why = { preleve: x.real, n, budget: x.bud }; sorte = 'écart'; }
        else { why = { texte: x.real < DEMI ? 'pas encore prélevé sur la période' : 'moins que prévu' }; sorte = 'marge'; }
      }
      items.push({ lab: a.label, e, why, sorte });
    }
    for (const h of Object.values(hb)) items.push({ lab: h.lab, e: h.real, why: { horsBudget: h.ops.slice(0, 3).map(o => ({ montant: -o.m, date: o.date })) }, sorte: 'hors budget' });
    if (Math.abs(autres) >= 100) items.push({ lab: 'Autres sorties', e: autres, why: { texte: 'virements sortants, remboursements…' }, sorte: 'écart' });
    items.sort((x, y) => y.e - x.e);
    return (B.memo.why = { S: S0, n, B0, now: bal.v, credits, attendu, bud, items });
  }

  // ------------------------------------------------------------ plan : virements à mettre en place, virement ponctuel
  function plan(B) {
    if (B.memo.plan) return B.memo.plan;
    const lignes = lignesCommun(B).filter(a => a.on);
    const need = { credit: { moi: 0, autre: 0 }, copro: { moi: 0, autre: 0 }, fixes: { moi: 0, autre: 0 } };
    let pW = 0, pG = 0;
    for (const a of lignes) {
      const { pg } = KB().partDe(B, a.key), amt = Math.max(0, a.amt), m = amt * pg / 100;
      const bk = need[usageDe(a.key)];
      bk.moi += m; bk.autre += amt - m;
      if (a.per > 1) { pW += amt; pG += m; }
    }
    const T = KB().parts(B), wG0 = pW > 0 ? pG / pW : (T.moi + T.autre > 0 ? T.moi / (T.moi + T.autre) : 0.5);
    const C = tresorerie(B);
    // 1.3.0 : renflouement (virement ponctuel) dès que la trésorerie prévue passe sous la réserve fixe (0 par défaut :
    // sous zéro, comme avant), partagé selon les parts des postes en cause (prélèvements prévus jusqu'au point bas)
    const seuil = B.R.commun.reserveFixe || 0;
    const pon = C && C.min < seuil - 0.5 ? Math.ceil((seuil - C.min) / 1000) * 1000 : 0;
    const cause = pon ? partsEnCause(B, C) : null;
    const wG = cause ? cause.wMoi : wG0;
    const ponMoi = Math.ceil(pon * wG / 1000) * 1000, ponAutre = pon > 0 ? Math.max(0, pon - ponMoi) : 0;
    const V = B.D.virements || [];
    const changes = [];
    for (const u of ['credit', 'copro', 'fixes']) {
      const have = somme(B, 'moi', u), want = need[u].moi;
      if ((have || want >= DEMI) && have - want < -100) changes.push({ qui: 'moi', label: V.filter(v => v.qui === 'moi' && v.usage === u).map(v => v.label).join(', ') || USAGES[u], have, want: Math.ceil(want / 100) * 100, usage: u });
    }
    { const have = somme(B, 'autre'), want = T.autre; if (have - want < -100) changes.push({ qui: 'autre', label: V.filter(v => v.qui === 'autre').map(v => v.label).join(', ') || 'Virement mensuel', have, want: Math.ceil(want / 100) * 100, usage: 'tout' }); }
    const W = origine(B);
    const pas = W ? W.items.filter(x => x.sorte === 'passager' && x.e > 0).reduce((t, x) => t + x.e, 0) : 0;
    const rec = W ? W.items.filter(x => x.sorte === 'récurrent') : [];
    const recM = rec.length ? lignes.filter(a => a.per === 1).reduce((t, a) => {
      const cm = KB().contratsDe(B, a.key, 'commun').filter(c => (+c.per || 1) === 1).reduce((x, c) => x + c.montant, 0); return t + Math.max(0, cm - a.amt); }, 0) : 0;
    let retourPositif = null, prochainBas = null;
    if (C) {
      const ms = C.months, i0 = ms.findIndex(m => m.end >= 0);
      if (C.start < 0 && i0 >= 0) retourPositif = ms[i0].m;
      for (const m of ms.slice(1)) if (m.low < -DEMI && (!prochainBas || m.low < prochainBas.v)) prochainBas = { m: m.m, v: m.low };
    }
    const mC = B.auj.slice(0, 7);
    const recus = V.map(v => {
      const vu = virementVu(B, v, mC), route = vu ? null : routeDe(B, v, mC);
      return { v, vu, route, retard: !vu && !route && +B.auj.slice(8, 10) > Math.min(28, +v.jour || 1) + 3 };
    });
    return (B.memo.plan = { need, T, wG, pW, pG, C, seuil, cause, pon, ponMoi, ponAutre, changes, W, pas, rec, recM, retourPositif, prochainBas, recus });
  }

  // ------------------------------------------------------------ fin de mois estimée, marge réelle
  // Fin de mois : solde − prélèvements mensuels des contrats pas encore passés ce mois − impôts du mois
  //               + virements attendus pas encore reçus − provisions en cours (charges non mensuelles).
  function finDeMois(B) {
    if ('fdm' in B.memo) return B.memo.fdm;
    const bal = KB().soldes(B, ['commun']);
    if (!bal) return (B.memo.fdm = null);
    const m = B.auj.slice(0, 7);
    let due = 0, inc = 0;
    const aVenir = [];
    for (const c of (B.D.contrats || []).filter(c => c.sc === 'commun' && (+c.per || 1) === 1 && c.montant > 0)) {
      const d = KB().dernierDebit(B, c);
      if (!d || KB().dateCompte(d).slice(0, 7) !== m) { due += c.montant; aVenir.push(c.label); }
    }
    for (const e of impots(B)) if (e.m === m) { due += -e.v; aVenir.push(e.lab); }
    // 1.1.2 : un virement en route (parti, pas encore arrivé) compte une fois, à part des virements attendus
    let route = 0;
    for (const v of B.D.virements || []) { if (virementVu(B, v, m)) continue; const r = routeDe(B, v, m); if (r) route += r.montant; else inc += +v.montant || 0; }
    const RS = KB().reserveCommun(B);
    const end = bal.v - due + inc + route - RS.v;
    // découvert dans le mois : même calcul que la trésorerie (jour par jour, virements compris) quand elle existe
    const C = tresorerie(B), mo = C && C.months.find(x => x.m === m);
    const decouvert = mo ? mo.low < -0.5 : bal.v + route - due < 0;
    const out = { solde: bal.v, due, inc, reserve: RS.v, reserveDet: RS.det, end, aVenir, decouvert };
    if (route) out.route = route;
    return (B.memo.fdm = out);
  }
  // Marge réelle du commun (mois en cours) : solde − charges fixes à venir − reste du budget variable (+ virements attendus).
  function margeReelle(B) {
    const bal = KB().soldes(B, ['commun']);
    if (!bal) return null;
    const s = KB().suivi(B, 'commun', null);
    const fixes = s.T.fixe.left, variable = s.T.courante.left + s.T.optionnelle.left, m = B.auj.slice(0, 7);
    let inc = 0, route = 0;
    for (const v of B.D.virements || []) { if (virementVu(B, v, m)) continue; const r = routeDe(B, v, m); if (r) route += r.montant; else inc += +v.montant || 0; }
    const marge = bal.v - fixes - variable;
    // 1.1.2 : tant que des virements du mois manquent (en route ou attendus), la marge affichée est la marge prévue
    const enAttente = route + inc;
    return { solde: bal.v, fixes, variable, marge, attendus: inc, enRoute: route, avecAttendus: marge + enAttente, prevue: marge + enAttente, enAttente,
      affichee: enAttente > 0 ? marge + enAttente : marge, base: enAttente > 0 ? 'prevue' : 'reelle' };
  }

  // ------------------------------------------------------------ appels de fonds (données du carnet, sans lecture de mail)
  function appels(B) {
    if (B.memo.appels) return B.memo.appels;
    const A0 = B.D.appels || {}, R = R7(B).appels, out = {};
    const general = rx(R.motif, ''), ordre = Array.isArray(R.ordre) ? R.ordre : Object.keys(A0).filter(k => isObj(A0[k]) && Array.isArray(A0[k].items));
    const paieDe = r => {
      if (r.role !== 'commun' || r.m >= 0) return null;
      const L = String(r.label).toUpperCase();
      if (!general || !general.test(L)) return null;
      for (const cp of ordre) { const re = rx(R[cp], ''); if (re && re.test(L)) return cp; }
      return null;
    };
    const mails = Object.values(isObj(A0.mails) ? A0.mails : {}), pdfs = Array.isArray(A0.pdfs) ? A0.pdfs : [];
    const pdfDe = (cp, d, k, fn) => pdfs.find(p => p.d === d && p.kind === k && (!cp || p.cp === cp) && (!fn || String(p.name).indexOf(String(fn).replace(/\.pdf$/i, '')) >= 0)) || pdfs.find(p => p.d === d && p.kind === k && (!cp || p.cp === cp));
    for (const m of mails) if (!m.cp) { const p = pdfDe(null, m.d, m.kind, m.fn); if (p) m.cp = p.cp; }
    for (const cp of Object.keys(A0)) {
      const A = A0[cp];
      if (!isObj(A) || !Array.isArray(A.items)) continue;
      const stmt = A.items.map(([d, k, a]) => ({ d, k, a: Math.round(+a * 100) }));
      const used = new Set(), list = [];
      for (const m of mails.filter(x => x.cp === cp)) {
        const p = pdfDe(cp, m.d, m.kind, m.fn), si = stmt.findIndex((x, ix) => !used.has(ix) && x.d === m.d && x.k === m.kind);
        if (si >= 0) used.add(si);
        const prev = stmt.filter(x => x.k === m.kind).slice(-1)[0];
        const a = p && p.a ? Math.round(p.a * 100) : si >= 0 ? stmt[si].a : prev ? prev.a : 0;
        list.push({ d: m.d, k: m.kind, a, src: 'mail', mail: m.mail, pdf: !!p, est: !(p && p.a) && si < 0 });
      }
      stmt.forEach((x, ix) => { if (!used.has(ix)) list.push({ d: x.d, k: x.k, a: x.a, src: 'releve', pdf: !!pdfDe(cp, x.d, x.k) }); });
      const items = list.sort((x, y) => x.d < y.d ? -1 : x.d > y.d ? 1 : 0).map(x => Object.assign(x, { paid: 0, pay: [] }));
      const from = items.length ? plusJours(items[0].d, -75) : '2000-01-01';
      const pays = B.rows.filter(r => !r.ecart && paieDe(r) === cp && r.date >= from).sort((x, y) => x.date < y.date ? -1 : 1).map(r => ({ d: r.date, a: -r.m }));
      const pq = pays.map(p => Object.assign({}, p, { r: p.a }));
      for (const it of items) {
        for (const p of pq) {
          if (p.r < 1) continue;
          const x = Math.min(p.r, it.a - it.paid);
          if (x <= 0.5) break;
          it.paid += x; p.r -= x; it.pay.push(p.d);
          if (it.paid >= it.a - 0.5) break;
        }
      }
      const emis = items.filter(it => it.d <= plusJours(B.auj, 45) || it.src === 'mail');
      const totA = emis.reduce((t, x) => t + x.a, 0), totP = pays.reduce((t, x) => t + x.a, 0), reste = totA - totP;
      const st = isObj(A.stmt) ? { at: A.stmt.at, solde: Math.round((+A.stmt.solde || 0) * 100) } : null;
      const apres = st ? pays.filter(p => p.d > st.at).reduce((t, x) => t + x.a, 0) : 0, resteSt = st ? st.solde - apres : null;
      const impayes = emis.filter(it => it.paid < it.a - DEMI);
      out[cp] = { cp, lab: A.lab || cp, a: A.to || '', iban: A.iban || '', items: emis, pays, totA, totP, reste, st, resteSt, impayes, retard: impayes.filter(it => it.d < B.auj) };
    }
    return (B.memo.appels = out);
  }

  // ------------------------------------------------------------ équilibre des apports
  function sorteDe(B, r) {
    const E = R7(B).equilibre;
    const L = String(r.label).toUpperCase();
    for (const x of Array.isArray(E.regles) ? E.regles : []) {
      if (!Array.isArray(x) || (x[2] === 'credit') !== (r.m > 0)) continue;
      const re = rx(x[0], '');
      if (re && re.test(L)) return x[1];
    }
    return r.m > 0 ? 'rf' : 'ot';
  }
  function mouvements(B) {
    if (B.memo.eqops) return B.memo.eqops;
    const E = R7(B).equilibre;
    const hist = (Array.isArray(E.ops) ? E.ops : []).filter(o => Array.isArray(o) && o.length >= 4).map(([d, l, a, k]) => [d, l, Math.round(+a * 100), k]);
    const last = hist.length ? hist[hist.length - 1][0] : '';
    const neuf = opsCommun(B).filter(r => r.date > last).map(r => [r.date, r.label, r.m, sorteDe(B, r)]);
    return (B.memo.eqops = hist.concat(neuf));
  }
  const etatEq = S => { const D = S.budget || (S.budget = KB().nouveau()); return D.equilibre || (D.equilibre = { equip: {}, items: [] }); };
  function equipements(B) {
    const E = R7(B).equilibre, st = (B.D.equilibre) || { equip: {}, items: [] };
    const L = [];
    (Array.isArray(E.equip) ? E.equip : []).forEach((e, i) => {
      if (!Array.isArray(e)) return;
      const on = st.equip && st.equip[i] !== undefined ? !!st.equip[i] : !!e[5];
      L.push({ id: 'p' + i, i, date: e[0] || '', label: e[1] || '', detail: e[2] || '', moi: Math.round((+e[3] || 0) * 100), autre: Math.round((+e[4] || 0) * 100), on, fixe: true });
    });
    for (const x of st.items || []) L.push({ id: x.id, date: x.date || '', label: x.label || '', detail: x.src === 'op' ? 'opération' : 'ajout manuel', moi: x.moi || 0, autre: x.autre || 0, on: x.on !== false, op: x.op || null });
    return L;
  }
  // 1.3.0 : mouvements de l'équilibre reliés à leur opération du commun (même date, même montant), pour les affectations :
  // → Map(indice dans OPS → { r, aff, env }).
  function liensEquilibre(B, OPS) {
    const parCle = new Map();
    for (const r of opsCommun(B)) { const k = r.date + '|' + Math.round(r.m); (parCle.get(k) || parCle.set(k, []).get(k)).push(r); }
    const EN = enveloppes(B), out = new Map();
    OPS.forEach(([d, , a], i) => {
      const L = parCle.get(d + '|' + Math.round(a));
      if (!L || !L.length) return;
      const r = L.shift(), aff = r.m > 0 ? affEff(B, r) : null, cle = r.m < 0 ? EN.parOp.get(r.id) : null;
      const env = cle ? EN.liste.find(e => e.cle === cle) : null;
      if (aff || env) out.set(i, { r, aff, env });
    });
    return out;
  }
  // opts.brut (1.3.0) : sans les affectations (avances, enveloppes Impôts), pour comparer avant / après.
  function equilibre(B, opts) {
    const brut = !!(opts && opts.brut), mk = brut ? 'eqBrut' : 'eq';
    if (mk in B.memo) return B.memo[mk];
    const E = R7(B).equilibre;
    const OPS = mouvements(B);
    if (!OPS.length || !isObj(E.apport)) return (B.memo[mk] = null);
    const Sk = {};
    // 1.3.0 : enveloppe Impôts (versement et paiements) hors équilibre ; avance au commun : la part de l'autre personne
    // comptée en faveur de celle qui avance (et non plus tout le versement)
    const LI = brut ? new Map() : liensEquilibre(B, OPS), AV = avances(B);
    const hors = [], avs = [], auts = [], skip = new Set(), mentions = new Map();
    let avMoi = 0, avAutre = 0, autMoi = 0, autAutre = 0;
    OPS.forEach(([d, l, a, k], i) => {
      const x = LI.get(i);
      if (x && ((x.aff && x.aff.k === 'impots') || (x.env && x.env.k === 'impots'))) { hors.push({ date: d, label: l, montant: a, mention: x.aff ? texteAff(B, x.aff) : 'payé par l\'enveloppe ' + x.env.nom }); skip.add(i); mentions.set(i, 'hors équilibre · ' + hors[hors.length - 1].mention); return; }
      // 1.3.3 : « Autre » avec un effet choisi : hors équilibre, ou compté en faveur de l'un (en entier ou pour moitié)
      if (x && x.aff && x.aff.k === 'autre' && x.aff.eq) {
        const t = texteAff(B, x.aff);
        if (x.aff.eq === 'hors') { hors.push({ date: d, label: l, montant: a, mention: t }); skip.add(i); mentions.set(i, 'hors équilibre · ' + t); return; }
        const [q, p] = x.aff.eq.split('-'), v = p === 'tout' ? a : Math.round(a / 2);
        if (q === 'moi') autMoi += v; else autAutre += v;
        auts.push({ date: d, label: l, montant: a, qui: q, faveur: v, mention: t }); skip.add(i); mentions.set(i, t + ' · ' + eur0(v) + ' comptés'); return;
      }
      if (x && x.aff && x.aff.k === 'avance') {
        const y = AV.lignes.find(z => z.r === x.r);
        if (y) { if (y.qui === 'moi') avMoi += y.faveur; else avAutre += y.faveur; avs.push({ date: d, label: l, montant: a, qui: y.qui, faveur: y.faveur, mention: 'avance au commun' }); skip.add(i); mentions.set(i, 'avance au commun · ' + eur0(y.faveur) + ' comptés'); return; }
      }
      Sk[k] = (Sk[k] || 0) + a;
    });
    const gk = k => Sk[k] || 0, T = KB().parts(B), r = T.rNE;
    const nonElig = -NON_ELIG.reduce((t, k) => t + gk(k), 0) - gk('rf');
    const EQ = equipements(B);
    let eMoi = 0, eAutre = 0;
    for (const x of EQ) if (x.on) { eMoi += x.moi; eAutre += x.autre; }
    const ap = { moi: Math.round((+E.apport.moi || 0) * 100), autre: Math.round((+E.apport.autre || 0) * 100) };
    const R = { apport: ap, versMoi: gk('vg'), versAutre: gk('vs') + gk('rs'), nonElig, rNE: r, equipMoi: eMoi, equipAutre: eAutre,
      pret: -(gk('pc') + gk('pa') + gk('pi')), travaux: -gk('ve'), debloc: gk('dp'), S: Sk, OPS, EQ, avMoi, avAutre, avances: avs, autMoi, autAutre, autres: auts, hors, skip, mentions };
    R.invMoi = ap.moi + R.versMoi - nonElig * r + eMoi + avMoi + autMoi;
    R.invAutre = ap.autre + R.versAutre - nonElig * (1 - r) + eAutre + avAutre + autAutre;
    R.mensMoi = T.eqMoi; R.mensAutre = T.eqAutre;
    R.ecart = R.invAutre - R.invMoi;                 // > 0 : je dois encore investir plus que l'autre personne
    R.rythme = R.mensMoi - R.mensAutre;
    const lastM = OPS[OPS.length - 1][0].slice(0, 7);
    R.mois = (R.ecart > 0 && R.rythme > 0) || (R.ecart < 0 && R.rythme < 0) ? Math.ceil(R.ecart / R.rythme) : null;
    R.dateEquilibre = R.mois !== null ? shift(lastM, R.mois) : null;
    R.dernierMois = lastM;
    R.libelles = Object.assign({}, SORTES, isObj(E.libelles) ? E.libelles : {});
    return (B.memo[mk] = R);
  }
  // Simulation : ajout mensuel x et versement ponctuel y (centimes) → { immediat, jamais, mois, date }.
  function simuler(R, x, y) {
    const g2 = Math.abs(R.ecart) - (y || 0), r2 = Math.abs(R.rythme) + (x || 0);
    if (g2 <= 0) return { immediat: true, surplus: -g2 };
    if (r2 <= 0) return { jamais: true };
    const n = Math.ceil(g2 / r2);
    return { mois: n, date: shift(R.dernierMois, n), gain: R.mois !== null ? R.mois - n : null };
  }
  function basculerEquipement(S, id, on) {
    const st = etatEq(S);
    const avant = JSON.stringify(st);
    if (/^p\d+$/.test(id)) st.equip[+id.slice(1)] = !!on;
    else { const x = (st.items || []).find(y => y.id === id); if (x) x.on = !!on; }
    return avant;
  }
  function ajouterEquipement(S, item) {
    const st = etatEq(S);
    const avant = JSON.stringify(st);
    st.items = st.items || [];
    st.items.push(Object.assign({ id: 'o' + Date.now().toString(36) + st.items.length, on: true }, item));
    return avant;
  }
  // Dépense de l'équilibre ajoutée depuis une opération (0.10.8 : pastille sur la ligne, pas de second ajout).
  function equipementDeOp(S, opId) {
    const st = S && S.budget && S.budget.equilibre;
    return st && Array.isArray(st.items) ? st.items.find(x => x && x.src === 'op' && x.op === opId) || null : null;
  }
  function retirerEquipement(S, id) { const st = etatEq(S); const avant = JSON.stringify(st); st.items = (st.items || []).filter(x => x.id !== id); return avant; }
  function annulerEquilibre(S, avant) { S.budget.equilibre = JSON.parse(avant); }

  // Investissement cumulé de chacun (graphique de l'équilibre) : série mensuelle depuis les apports initiaux, puis
  // projection jusqu'à l'équilibre au rythme actuel. → { serie: [[mois, moi, autre]], projection: [[mois, moi, autre]] }.
  function serieEquilibre(B) {
    const R = equilibre(B);
    if (!R) return null;
    const byM = {}, r = R.rNE;
    const add = (m, a, b) => { const e = byM[m] || (byM[m] = { g: 0, s: 0 }); e.g += a; e.s += b; };
    R.OPS.forEach(([d, , a, k], i) => {
      const m = d.slice(0, 7);
      if (R.skip && R.skip.has(i)) return;            // 1.3.0 : hors équilibre ou avance (comptée ci-dessous)
      if (k === 'vg') add(m, a, 0); else if (k === 'vs' || k === 'rs') add(m, 0, a);
      else if (NON_ELIG.indexOf(k) >= 0 || k === 'rf') add(m, a * r, a * (1 - r));
    });
    for (const x of R.avances || []) add(x.date.slice(0, 7), x.qui === 'moi' ? x.faveur : 0, x.qui === 'moi' ? 0 : x.faveur);
    for (const x of R.EQ) if (x.on && x.date && x.date.slice(0, 7) <= R.dernierMois) add(x.date.slice(0, 7), x.moi, x.autre);
    const ms = Object.keys(byM).sort();
    if (!ms.length) return null;
    let cg = R.apport.moi, cs = R.apport.autre;
    const serie = [[shift(ms[0], -1), cg, cs]];
    for (let m = ms[0]; m <= R.dernierMois; m = shift(m, 1)) { const e = byM[m] || { g: 0, s: 0 }; cg += e.g; cs += e.s; serie.push([m, cg, cs]); }
    const projection = [];
    if (R.dateEquilibre) { let pg = cg, ps = cs; for (let k = 1; k <= R.mois && k <= 600; k++) { pg += R.mensMoi; ps += R.mensAutre; if (k % 3 === 0 || k === R.mois) projection.push([shift(R.dernierMois, k), pg, ps]); } }
    return { serie, projection };
  }

  // Versements mensuels moyens de chacun sur la base de calcul (mode Budget du commun). → { moi, autre } (centimes).
  function versementsMoyens(B, W) {
    let vm = 0, va = 0;
    for (const [d, , x, k] of mouvements(B)) { const m = d.slice(0, 7); if (m < W.start || m > W.end) continue; if (k === 'vg') vm += x; if (k === 'vs' || k === 'rs') va += x; }
    const n = Math.max(1, W.months.length);
    return { moi: vm / n, autre: va / n };
  }

  // Découvert prévu du compte commun : premier jour sous zéro (trésorerie sur 12 mois, ou fin du mois en cours si les
  // prélèvements à venir dépassent le solde). Niveau gradué : « crit » sous 31 jours, « caut » au-delà (12 mois au plus).
  // → { date, jours, niveau } ou null.
  function risqueDecouvert(B) {
    const f = finDeMois(B);
    if (!f) return null;
    const C = tresorerie(B);
    let d = C && C.negAt ? C.negAt : '';
    // 1.1.2 : avec la trésorerie (jour par jour, virements attendus et en route compris), elle seule fait foi ; avant,
    // « solde − prélèvements à venir » ignorait les virements pas encore arrivés et annonçait un découvert à la fin du mois.
    if (f.decouvert && !C) {
      const y = +B.auj.slice(0, 4), m = +B.auj.slice(5, 7);
      const fin = B.auj.slice(0, 8) + String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0');
      if (!d || d > fin) d = fin;
    }
    if (!d) return null;
    const jours = Math.max(0, Math.round((Date.parse(d + 'T00:00:00Z') - Date.parse(B.auj + 'T00:00:00Z')) / 864e5));
    if (jours > 366) return null;
    return { date: d, jours, niveau: jours <= 31 ? 'crit' : 'caut' };
  }

  // ============================================================ 1.3.0 : prévu / imprévu, enveloppes, avances, réserve
  // Chaque mouvement du compte commun est « prévu » (élément du plan : virement permanent, contrat ou poste du budget
  // commun, appel de fonds, impôt prévu ou payé par son enveloppe), « prévu, écart » (élément du plan, mais montant hors
  // tolérance, date hors fenêtre, plusieurs échéances en un paiement) ou « imprévu ». Les virements ponctuels reçus
  // reçoivent une affectation (o.commun.aff, confirmée par le propriétaire) : impots (enveloppe « Impôts <année> »),
  // reserve, avance (pour : 'renflouement' ou clé d'un poste du commun, alors enveloppe), remb, autre (txt).
  // Corrections à la main sur l'opération (o.commun) : statut ('prevu' | 'imprevu'), lien (clé d'enveloppe | 'aucun').
  const AFFECTATIONS = { impots: 'Impôts', reserve: 'Réserve', avance: 'Avance au commun', remb: 'Remboursement', autre: 'Autre' };
  const STATUTS = { prevu: 'prévu', ecart: 'prévu, écart', imprevu: 'imprévu' };
  const etatOp = o => (o && isObj(o.commun)) ? o.commun : null;
  const affDe = o => { const c = etatOp(o); return c && isObj(c.aff) && AFFECTATIONS[c.aff.k] ? c.aff : null; };
  const eur0 = c => KB().eur(c);
  const jj = d => d.slice(8, 10) + '/' + d.slice(5, 7);
  const tolC = (B, pm) => KB().toleranceDe(B.R.tolerance, pm);
  const dejaRecu = (B, r) => deLautreR(B, r) ? 'autre' : 'moi';
  function deLautreR(B, r) { const R = R7(B); return !!((R.motifAutre && R.motifAutre.test(r.label)) || (R.nomsConnus && r.sub === R.autre)); }
  // Début de la reprise des affectations proposées : 12 mois glissants (les affectations confirmées restent toujours).
  const debutAff = B => shift(B.auj.slice(0, 7), -11) + '-01';
  // 1.3.2 : avant le début du suivi des avances (réglage commun.debutAvances), un virement ponctuel garde son classement
  // d'origine dans l'équilibre : son affectation (gardée sur l'opération) ne compte pas, sauf l'enveloppe Impôts.
  const debutAv = B => (B.R.commun && B.R.commun.debutAvances) || '0000-00-00';
  const avantSuivi = (B, r) => r.date < debutAv(B);
  function affEff(B, r) {
    const a = affDe(r.o);
    return a && (a.k === 'impots' || !avantSuivi(B, r)) ? a : null;
  }
  // Crédits de l'équilibre classés « déblocage de prêt » (même date, même montant) : jamais des virements ponctuels.
  function deblocages(B) {
    if (B.memo.dpK) return B.memo.dpK;
    const out = new Set();
    try { for (const [d, , a, k] of mouvements(B)) if (k === 'dp') out.add(d + '|' + Math.round(a)); } catch (e) { /* sans équilibre */ }
    return (B.memo.dpK = out);
  }

  // Virements permanents reconnus, mois par mois : Map(id d'opération → { v, m }).
  function virementsVus(B) {
    if (B.memo.virVus) return B.memo.virVus;
    const out = new Map(), mois = [...new Set(opsCommun(B).filter(r => r.m > 0).map(r => KB().dateCompte(r).slice(0, 7)))];
    for (const m of mois) for (const v of virements(B)) { if (!(+v.montant > 0)) continue; const r = virementVu(B, v, m); if (r && !out.has(r.id)) out.set(r.id, { v, m }); }
    return (B.memo.virVus = out);
  }
  // Affectation proposée pour un virement ponctuel reçu (libellé, émetteur).
  function proposition(B, r) {
    const L = fold(r.label), an = /\bIMPOTS?\b/.test(L) ? (L.match(/\b(20\d\d)\b/) || [])[1] : null;
    if (an) return { k: 'impots', an };
    const I = R7(B).impots;
    if (I.motif && I.motif.test(r.label)) return { k: 'remb', txt: 'remboursement d\'impôt' };
    if (/REMB|REMBOURS|RETRO|AVOIR/.test(L)) return { k: 'remb' };
    // versement aussitôt reversé (même montant débité dans les 5 jours) : avance pour le poste de ce paiement
    const suite = opsCommun(B).find(x => x.m < 0 && Math.abs(x.m + r.m) < 1 && x.date >= r.date && KB().dDiff(r.date, x.date) <= 5);
    const cle = suite ? KB().cleDe(B, suite) : null;
    if (cle && lignesCommun(B).some(a => a.key === cle)) return { k: 'avance', pour: cle, qui: dejaRecu(B, r) };
    return { k: 'avance', pour: 'renflouement', qui: dejaRecu(B, r) };
  }
  const nomEnveloppe = (B, a) => a.k === 'impots' ? 'Impôts ' + (a.an || '') : a.k === 'avance' && a.pour && a.pour !== 'renflouement' ? 'Avance pour ' + (posteLabel(B, a.pour) || a.pour) : null;
  const cleEnveloppe = a => a.k === 'impots' ? 'impots|' + (a.an || '') : a.k === 'avance' && a.pour && a.pour !== 'renflouement' ? 'avance|' + a.pour : null;
  function posteLabel(B, key) { const a = lignesCommun(B).find(x => x.key === key); return a ? a.label : (/^[fcm]\|/.test(key) ? key.slice(2) : null); }
  // 1.3.3 : « Autre » avec son effet dans l'équilibre (a.eq) : 'hors', 'moi-tout', 'moi-moitie', 'autre-tout',
  // 'autre-moitie' ; absent : classement d'origine du mouvement.
  const EQ_AUTRE = ['hors', 'moi-tout', 'moi-moitie', 'autre-tout', 'autre-moitie'];
  function texteEqAutre(B, eq) {
    if (eq === 'hors') return 'hors équilibre';
    const [q, p] = String(eq || '').split('-'), R = B.R.commun || {};
    if (!p) return '';
    return 'en faveur de ' + (q === 'autre' ? (R.autre || 'l\'autre personne') : (R.moi || 'vous')) + (p === 'tout' ? ', en entier' : ', pour moitié');
  }
  // Classement d'origine d'un crédit du commun dans l'équilibre (mouvement de même date et même montant), en clair.
  function origineEq(B, r) {
    let k = null;
    try { const m = mouvements(B).find(([d, , a]) => d === r.date && Math.round(a) === Math.round(r.m)); k = m ? m[3] : null; } catch (e) { k = null; }
    const R = B.R.commun || {};
    if (k === 'vg') return 'versement de ' + (R.moi || 'vous') + ', compté en entier';
    if (k === 'vs' || k === 'rs') return 'versement de ' + (R.autre || 'l\'autre personne') + ', compté en entier';
    if (k === 'rf') return 'remboursement de charges, qui réduit les charges partagées';
    if (k === 'dp') return 'déblocage de prêt, non compté';
    return 'non compté';
  }
  function texteAff(B, a) {
    if (!a) return '';
    if (a.k === 'impots') return 'Impôts ' + (a.an || '');
    if (a.k === 'avance') return 'Avance au commun' + (a.pour && a.pour !== 'renflouement' ? ' pour ' + (posteLabel(B, a.pour) || a.pour) : ' (renflouement)');
    if (a.k === 'autre') return 'Autre' + (a.txt ? ' : ' + a.txt : '') + (a.eq ? ' · ' + texteEqAutre(B, a.eq) : '');
    return AFFECTATIONS[a.k] + (a.txt ? ' (' + a.txt + ')' : '');
  }

  // Virements ponctuels reçus (crédits du commun hors virements permanents) depuis debutAff, ou déjà affectés.
  // → [{ r, aff (confirmée) | null, prop }].
  function ponctuels(B) {
    if (B.memo.ponct) return B.memo.ponct;
    const V = virementsVus(B), d12 = debutAff(B), deb = d12 > debutAv(B) ? d12 : debutAv(B), DP = deblocages(B), out = [];
    for (const r of opsCommun(B)) {
      if (r.m <= 0 || V.has(r.id)) continue;
      const c = etatOp(r.o), aff = affEff(B, r);
      // virement interne ou déblocage de prêt : pas proposé ; 1.3.3 : sauf s'il a été affecté à la main (le choix compte)
      if (!aff && (r.type === 'interne' || DP.has(r.date + '|' + Math.round(r.m)))) continue;
      if (c && c.statut === 'prevu' && !aff) continue;          // reconnu à la main comme virement prévu
      if (!aff && r.date < deb) continue;
      out.push({ r, aff, prop: proposition(B, r) });
    }
    return (B.memo.ponct = out);
  }
  // 1.3.3 : proposition pour un crédit du commun, même s'il n'est pas dans la liste (virement interne, déblocage).
  function propositionOp(B, id) { const r = opsCommun(B).find(x => x.id === id); return r && r.m > 0 ? proposition(B, r) : null; }
  // Affectation d'un virement ponctuel (null : à affecter de nouveau). → valeur d'avant (annulation).
  function affecter(o, aff) {
    const avant = o.commun ? JSON.stringify(o.commun) : null;
    const c = isObj(o.commun) ? o.commun : (o.commun = {});
    if (aff && AFFECTATIONS[aff.k]) {
      const a = { k: aff.k };
      if (aff.k === 'impots') a.an = /^20\d\d$/.test(String(aff.an)) ? String(aff.an) : String(new Date().getFullYear() - 1);
      if (aff.k === 'avance') { a.pour = aff.pour || 'renflouement'; if (aff.qui === 'moi' || aff.qui === 'autre') a.qui = aff.qui; if (aff.pg != null && isFinite(+aff.pg)) a.pg = Math.min(100, Math.max(0, +aff.pg)); }
      if (aff.txt) a.txt = String(aff.txt).slice(0, 60);
      if (aff.k === 'autre' && EQ_AUTRE.indexOf(aff.eq) >= 0) a.eq = aff.eq;
      c.aff = a;
    } else delete c.aff;
    if (!Object.keys(c).length) delete o.commun;
    return avant;
  }
  // Correction à la main : champ 'statut' ('prevu' | 'imprevu' | null) ou 'lien' (clé d'enveloppe | 'aucun' | null).
  function corriger(o, champ, val) {
    const avant = o.commun ? JSON.stringify(o.commun) : null;
    const c = isObj(o.commun) ? o.commun : (o.commun = {});
    if (val == null || val === '') delete c[champ]; else c[champ] = val;
    if (!Object.keys(c).length) delete o.commun;
    return avant;
  }
  function restaurer(o, avant) { if (avant == null) delete o.commun; else o.commun = JSON.parse(avant); }

  // ------------------------------------------------------------ enveloppes (argent affecté)
  // Impôts <année> et « Avance pour <poste> » : versements affectés, puis paiements reliés (à la main, ou automatiquement :
  // impôt prélevé hors prélèvement à la source, ou débit du poste, après le premier versement, la plus ancienne
  // enveloppe d'abord). Une enveloppe ne paie que ce à quoi elle est affectée ; le reste d'un paiement plus gros qu'elle
  // est payé par le disponible. → { liste: [{ cle, nom, k, date, montant, credits, paiements: [{ r, part }], utilise, reste }],
  //   parOp: Map(id d'un paiement → cle) }.
  function enveloppes(B) {
    if (B.memo.env) return B.memo.env;
    const E = new Map(), I = R7(B).impots;
    for (const x of ponctuels(B)) {
      if (!x.aff) continue;
      const cle = cleEnveloppe(x.aff);
      if (!cle) continue;
      const e = E.get(cle) || { cle, nom: nomEnveloppe(B, x.aff), k: x.aff.k, an: x.aff.an || null, pour: x.aff.pour || null, date: x.r.date, montant: 0, credits: [], paiements: [], utilise: 0 };
      e.montant += x.r.m; e.credits.push(x.r); if (x.r.date < e.date) e.date = x.r.date;
      E.set(cle, e);
    }
    const liste = [...E.values()].sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
    const parOp = new Map();
    const deb = opsCommun(B).filter(r => r.m < 0).sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
    const payer = (e, r) => { const part = Math.min(-r.m, e.montant - e.utilise); if (part <= 0.5) return false; e.utilise += part; e.paiements.push({ r, part }); parOp.set(r.id, e.cle); return true; };
    for (const r of deb) {
      const c = etatOp(r.o), lien = c && c.lien;
      if (lien === 'aucun') continue;
      if (lien) { const e = E.get(lien); if (e) payer(e, r); continue; }
      const imp = I.motif && I.motif.test(r.label) && !(I.source && I.source.test(r.label));
      const an = (fold(r.label).match(/\b(20\d\d)\b/) || [])[1];
      const k = KB().cleDe(B, r);
      const e = liste.find(x => r.date >= x.date && x.utilise < x.montant - 0.5 &&
        ((x.k === 'impots' && imp && (!an || an === x.an)) || (x.k === 'avance' && x.pour === k)));
      if (e) payer(e, r);
    }
    for (const e of liste) e.reste = Math.max(0, e.montant - e.utilise);
    return (B.memo.env = { liste, parOp });
  }

  // ------------------------------------------------------------ statut de chaque mouvement
  function jourHabituel(L) {
    const n = {};
    for (const r of L) { const d = +r.od.slice(8, 10); n[d] = (n[d] || 0) + 1; }
    let J = 0, nJ = 0;
    for (const d of Object.keys(n)) if (n[d] > nJ) { J = +d; nJ = n[d]; }
    return nJ >= 2 ? J : null;
  }
  // Écart en jours entre une date et le jour J du même mois ou d'un mois voisin (le plus proche).
  function ecartJours(d, J) {
    let best = null;
    for (const k of [-1, 0, 1]) {
      const m = shift(d.slice(0, 7), k), fin = +KB().finMois(m).slice(8, 10);
      const x = m + '-' + String(Math.min(J, fin)).padStart(2, '0');
      const e = KB().dDiff(x, d);
      if (best === null || Math.abs(e) < Math.abs(best)) best = e;
    }
    return best;
  }
  // → Map(id → { statut: 'prevu' | 'ecart' | 'imprevu', quoi, ecart (phrase) | null, main, sorte }).
  function statuts(B) {
    if (B.memo.statuts) return B.memo.statuts;
    const out = new Map(), F = B.R.echeance, V = virementsVus(B), EN = enveloppes(B), A = appels(B), R = R7(B);
    const lignes = lignesCommun(B), contrats = (B.D.contrats || []).filter(c => isObj(c) && c.sc === 'commun').map(c => ({ c, mots: K().motifs(c.motif) })).filter(x => x.mots.length);
    const parContrat = new Map();
    for (const r of opsCommun(B)) { if (r.m >= 0) continue; const F0 = fold(r.label), x = contrats.find(y => y.mots.some(m => F0.indexOf(m) >= 0)); if (x) (parContrat.get(x.c) || parContrat.set(x.c, []).get(x.c)).push(r); }
    const montant = (r, attendu, quoi) => Math.abs(Math.abs(r.m) - attendu) > tolC(B, attendu) ? quoi + ' : ' + eur0(Math.abs(r.m)) + ' au lieu de ' + eur0(attendu) : null;
    const nom = q => q === 'moi' ? R.moi : R.autre;
    for (const r of opsCommun(B)) {
      let s = null;
      const c = etatOp(r.o);
      if (r.m > 0) {
        const x = V.get(r.id);
        if (x) {
          const v = x.v, J = Math.min(28, +v.jour || 1), du = x.m + '-' + String(J).padStart(2, '0');
          const dep = departDe(B, r), d = dep ? dep.date : r.od;
          const tard = d > du && joursOuvres(du, d) > ROUTE_JOURS, tot = KB().dDiff(d, du) > F.avant;
          const e = [montant(r, v.montant, 'montant'), tard ? (dep ? 'parti' : 'arrivé') + ' le ' + jj(d) + ', prévu le ' + J : null, tot ? 'arrivé le ' + jj(d) + ', bien avant le ' + J : null].filter(Boolean);
          s = { statut: e.length ? 'ecart' : 'prevu', quoi: 'virement permanent · ' + nom(v.qui) + (v.label ? ' (' + v.label + ')' : ''), ecart: e.length ? e.join(' ; ') : null, sorte: 'virement' };
        } else {
          const a = affEff(B, r);
          if (!a && avantSuivi(B, r)) {
            // 1.3.2 : avant le suivi des avances : classement d'origine dans l'équilibre, rien à affecter
            const brut = affDe(r.o);
            s = { statut: 'imprevu', quoi: (brut ? texteAff(B, brut) + ' · ' : '') + 'avant le suivi des avances (classement d\'origine)', ecart: null, sorte: 'ponctuel', aff: null, avant: true };
          } else s = { statut: 'imprevu', quoi: a ? texteAff(B, a) : 'virement ponctuel à affecter', ecart: null, sorte: 'ponctuel', aff: a };
        }
      } else {
        const cle = EN.parOp.get(r.id), env = cle && EN.liste.find(e => e.cle === cle);
        // paiement d'appel de fonds : seulement s'il couvre au moins un appel enregistré (sinon : contrat ou poste)
        const pay = Object.values(A).map(x => ({ x, p: x.pays.find(p => p.d === r.date && Math.abs(p.a + r.m) < 1) }))
          .map(y => Object.assign(y, { it: y.p ? y.x.items.filter(i => i.pay.indexOf(r.date) >= 0) : [] })).find(y => y.it.length);
        const F0 = fold(r.label), ct = contrats.find(y => y.mots.some(m => F0.indexOf(m) >= 0));
        if (env) {
          const part = env.paiements.find(p => p.r === r).part;
          s = { statut: 'prevu', quoi: 'payé par l\'enveloppe ' + env.nom, ecart: part < -r.m - 0.5 ? eur0(-r.m - part) + ' payés hors enveloppe (enveloppe épuisée)' : null, sorte: 'enveloppe' };
          if (s.ecart) s.statut = 'ecart';
        } else if (pay) {
          const it = pay.it;
          const e = [];
          if (it.length > 1) e.push(it.length + ' appels de fonds (' + it.map(i => jj(i.d)).join(', ') + ') payés en une fois');
          for (const i of it) { const n = KB().dDiff(i.d, r.date); if (n > F.apres) e.push('appel du ' + jj(i.d) + ' payé ' + n + ' jours après son échéance'); }
          if (it.length === 1 && Math.abs(pay.p.a - it[0].a) > tolC(B, it[0].a)) e.push('montant : ' + eur0(pay.p.a) + ' au lieu de ' + eur0(it[0].a));
          s = { statut: e.length ? 'ecart' : 'prevu', quoi: 'appel de fonds · ' + pay.x.lab + (it.length === 1 ? ' du ' + jj(it[0].d) : ''), ecart: e.length ? e.join(' ; ') : null, sorte: 'appel' };
        } else if (R.impots.motif && R.impots.motif.test(r.label)) {
          s = R.impots.source && R.impots.source.test(r.label) ? { statut: 'prevu', quoi: 'impôt · prélèvement à la source', ecart: null, sorte: 'impot' }
            : { statut: 'imprevu', quoi: 'impôt (solde ou régularisation) sans enveloppe', ecart: null, sorte: 'impot' };
        } else if (ct) {
          const J = jourHabituel(parContrat.get(ct.c) || []), att = Math.round(ct.c.montant), n = J ? ecartJours(r.od, J) : 0;
          const e = [montant(r, att, 'montant'), J && !r.ech && (n > F.apres || -n > F.avant) ? 'prélevé le ' + jj(r.od) + ', d\'habitude le ' + J : null].filter(Boolean);
          s = { statut: e.length ? 'ecart' : 'prevu', quoi: 'contrat · ' + ct.c.label, ecart: e.length ? e.join(' ; ') : null, sorte: 'contrat' };
        } else {
          const a = lignes.find(x => x.key === KB().cleDe(B, r) && x.on && x.amt > DEMI);
          if (a) {
            const fixe = a.nat === 'fixe' || a.per > 1, att = a.per > 1 ? a.ech : a.amt;
            const e = fixe ? montant(r, att, 'montant') : null;
            s = { statut: e ? 'ecart' : 'prevu', quoi: 'poste · ' + a.label, ecart: e, sorte: 'poste' };
          } else s = { statut: 'imprevu', quoi: 'hors du plan', ecart: null, sorte: 'autre' };
        }
      }
      if (c && (c.statut === 'prevu' || c.statut === 'imprevu') && c.statut !== s.statut) s = Object.assign({}, s, { statut: c.statut, ecart: null, main: true, quoi: s.quoi + ' · choisi à la main' });
      out.set(r.id, s);
    }
    return (B.memo.statuts = out);
  }

  // ------------------------------------------------------------ avances au commun
  // Avance : versement ponctuel affecté « avance ». La part de l'autre personne (parts des postes en cause : poste choisi,
  // sinon part par défaut du commun) est comptée en faveur de celle qui avance dans l'équilibre.
  // → { lignes: [{ r, qui, pg (ma part %), faveur }], moi: { avance, faveur }, autre: { avance, faveur } }.
  function avances(B) {
    if (B.memo.av) return B.memo.av;
    const out = { lignes: [], moi: { avance: 0, faveur: 0 }, autre: { avance: 0, faveur: 0 } };
    for (const x of ponctuels(B)) {
      if (!x.aff || x.aff.k !== 'avance') continue;
      const qui = x.aff.qui || dejaRecu(B, x.r);
      const pg = x.aff.pg != null ? +x.aff.pg : x.aff.pour && x.aff.pour !== 'renflouement' ? KB().partDe(B, x.aff.pour).pg : B.R.commun.part;
      const faveur = Math.round(x.r.m * (qui === 'moi' ? (100 - pg) : pg) / 100);
      out.lignes.push({ r: x.r, qui, pg, faveur });
      out[qui].avance += x.r.m; out[qui].faveur += faveur;
    }
    return (B.memo.av = out);
  }

  // ------------------------------------------------------------ décomposition du solde, enveloppe détournée
  // Solde = disponible + réserve fixe + provisions des charges non mensuelles en cours (copropriété…) + enveloppes.
  function decomposition(B) {
    if ('decomp' in B.memo) return B.memo.decomp;
    const bal = KB().soldes(B, ['commun']);
    if (!bal) return (B.memo.decomp = null);
    const EN = enveloppes(B).liste.filter(e => e.reste > DEMI), RS = KB().reserveCommun(B);
    const env = EN.reduce((t, e) => t + e.reste, 0), reserve = B.R.commun.reserveFixe || 0;
    return (B.memo.decomp = { solde: bal.v, reserve, provisions: RS.v, provisionsDet: RS.det, enveloppes: env, enveloppesDet: EN.map(e => ({ nom: e.nom, reste: e.reste })),
      disponible: bal.v - reserve - RS.v - env });
  }
  // Enveloppes qui financent autre chose : disponible sous zéro alors qu'une enveloppe n'est pas vide. Dépense en cause :
  // premier débit hors enveloppe, depuis le premier versement, après lequel le solde passe sous le total des enveloppes.
  // → [{ nom, montant, mois, depense: { date, label, montant } | null }].
  function enveloppesDetournees(B) {
    const D = decomposition(B);
    if (!D || D.disponible >= -0.5 || D.enveloppes <= DEMI) return [];
    const EN = enveloppes(B), L = EN.liste.filter(e => e.reste > DEMI);
    const rows = opsCommun(B).slice().sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
    const debut = L.reduce((d, e) => e.date < d ? e.date : d, B.auj);
    let solde = D.solde - rows.filter(r => r.date > B.auj).reduce((t, r) => t + r.m, 0);
    const soldeApres = new Map();
    for (const r of rows.slice().reverse()) { if (r.date > B.auj) continue; soldeApres.set(r, solde); solde -= r.m; }
    const resteA = d => EN.liste.reduce((t, e) => e.date > d ? t : t + e.montant - e.paiements.filter(p => p.r.date <= d).reduce((x, p) => x + p.part, 0), 0);
    let cause = null;
    for (const r of rows) { if (r.date < debut || r.m >= 0 || EN.parOp.has(r.id) || !soldeApres.has(r)) continue; if (soldeApres.get(r) < resteA(r.date) - 0.5) { cause = r; break; } }
    if (!cause) cause = rows.filter(r => r.m < 0 && !EN.parOp.has(r.id) && r.date >= debut).sort((a, b) => a.m - b.m)[0] || null;
    let manque = -D.disponible;
    return L.map(e => { const x = Math.min(e.reste, manque); manque -= x; return { nom: e.nom, montant: x, mois: cause ? cause.date.slice(0, 7) : B.auj.slice(0, 7), depense: cause ? { date: cause.date, label: cause.label, montant: -cause.m } : null }; }).filter(x => x.montant > DEMI);
  }

  // ------------------------------------------------------------ réserve fixe et renflouement
  // Parts des postes en cause : prélèvements prévus de la trésorerie jusqu'au point bas, chacun selon la part de son poste.
  function partsEnCause(B, C) {
    let t = 0, m = 0;
    const det = {};
    // point bas aujourd'hui (le solde est déjà sous la réserve) : prélèvements des 31 prochains jours
    const fin = C.minAt > B.auj ? C.minAt : plusJours(B.auj, 31);
    for (const e of C.ev || []) {
      const d = e.m + '-' + String(e.d).padStart(2, '0');
      if (e.v >= 0 || d > fin || !e.key) continue;
      const pg = KB().partDe(B, e.key).pg;
      t += -e.v; m += -e.v * pg / 100;
      const x = det[e.key] || (det[e.key] = { label: e.lab, montant: 0, pg });
      x.montant += -e.v;
    }
    return t > 0 ? { wMoi: m / t, postes: Object.values(det) } : null;
  }
  // → null (rien à proposer) ou { seuil, min, minAt, montant, moi, autre, wMoi, postes, avant (date), fait (date) | null, avances }.
  function renflouement(B) {
    const P = plan(B);
    if (!P.pon || !P.C) return null;
    const f = isObj(B.D.renflouement) ? B.D.renflouement : null;
    const fait = f && f.le && KB().dDiff(f.le, B.auj) <= 7 ? f.le : null;
    const A = avances(B);
    return { seuil: P.seuil, min: P.C.min, minAt: P.C.minAt, montant: P.pon, moi: P.ponMoi, autre: P.ponAutre, wMoi: P.wG, postes: P.cause ? P.cause.postes : [],
      fait, avances: { moi: A.moi.avance, autre: A.autre.avance } };
  }
  // « Fait » : le renflouement proposé est parti (la proposition reste marquée « fait » 7 jours, le temps qu'il arrive).
  function renflouementFait(S, le, montant) {
    const D = KB().donnees(S), avant = D.renflouement ? JSON.stringify(D.renflouement) : null;
    D.renflouement = { le, montant: Math.round(+montant || 0) };
    return avant;
  }
  function annulerRenflouement(S, avant) { const D = KB().donnees(S); if (avant == null) delete D.renflouement; else D.renflouement = JSON.parse(avant); }

  // ------------------------------------------------------------ fiche du mois
  // « Mois conforme » ou liste des écarts (dont virements permanents non reçus) et des imprévus du mois m (date de
  // comptage). → { m, conforme, prevus, ecarts: [{ date, label, montant, texte }], imprevus: [...], aAffecter }.
  function fiche(B, m) {
    const ST = statuts(B), out = { m, prevus: 0, ecarts: [], imprevus: [], aAffecter: 0 };
    const R = R7(B), nom = q => q === 'moi' ? R.moi : R.autre;
    for (const r of opsCommun(B)) {
      if (KB().dateCompte(r).slice(0, 7) !== m) continue;
      const s = ST.get(r.id);
      if (!s) continue;
      const l = { date: r.date, label: r.label, montant: r.m, id: r.id, cid: r.cid, texte: s.ecart || s.quoi, statut: s.statut };
      if (s.statut === 'prevu') out.prevus++;
      else if (s.statut === 'ecart') out.ecarts.push(l);
      else { out.imprevus.push(l); if (s.sorte === 'ponctuel' && !s.aff && !s.avant) out.aAffecter++; }
    }
    const cur = B.auj.slice(0, 7);
    if (m <= cur) for (const v of virements(B)) {
      if (!(+v.montant > 0) || virementVu(B, v, m)) continue;
      const J = Math.min(28, +v.jour || 1), du = m + '-' + String(J).padStart(2, '0');
      if (m === cur && (B.auj <= du || joursOuvres(du, B.auj) <= ROUTE_JOURS || routeDe(B, v, m))) continue;
      out.ecarts.push({ date: du, label: v.label || 'Virement permanent', montant: +v.montant, texte: 'virement de ' + nom(v.qui) + ' non reçu' + (m === cur ? '' : ' ce mois-là'), statut: 'ecart', manquant: true });
    }
    out.conforme = !out.ecarts.length && !out.imprevus.length;
    return out;
  }

  // ------------------------------------------------------------ 1.3.2 : débits imprévus du mois (résumé Grafit)
  // Débits du compte commun au statut « imprévu » (corrections à la main comprises) dans le mois de comptage en cours
  // (celui de la fiche du mois). Crédits (virements ponctuels) et écarts exclus. Pas de mémo : « vue » change sans
  // nouveau contexte. → { n, amount (euros, positif), unseen (omis si 0), last (AAAA-MM-JJ) } ou null s'il n'y en a pas.
  function imprevusMois(B) {
    const m = B.auj.slice(0, 7), ST = statuts(B);
    let n = 0, c = 0, nv = 0, last = '';
    for (const r of opsCommun(B)) {
      if (r.m >= 0 || KB().dateCompte(r).slice(0, 7) !== m) continue;
      const s = ST.get(r.id);
      if (!s || s.statut !== 'imprevu') continue;
      n++; c -= r.m;
      if (r.o && !K().vue(B.S, r.o)) nv++;
      if (r.date > last) last = r.date;
    }
    if (!n) return null;
    const out = { n, amount: Math.round(c) / 100 };
    if (nv) out.unseen = nv;
    out.last = last;
    return out;
  }

  // ------------------------------------------------------------ plan poste par poste
  // 1.3.1 : sert au détail par poste de « Virements à mettre en place » (montants exacts, en centimes).
  // Part de chacun pour chaque poste du budget commun (montant mensuel, provision pour les charges non mensuelles),
  // comparée aux virements permanents en place ; propositions quand les contrats d'un poste ne suivent plus le budget.
  function planPostes(B) {
    const L = lignesCommun(B).filter(a => a.on && a.amt > DEMI).map(a => {
      const { pg } = KB().partDe(B, a.key), moi = a.amt * pg / 100;
      return { key: a.key, label: a.label, mensuel: a.amt, per: a.per, pg, moi, autre: a.amt - moi };
    });
    const tot = { moi: L.reduce((t, x) => t + x.moi, 0), autre: L.reduce((t, x) => t + x.autre, 0) };
    const vir = { moi: somme(B, 'moi'), autre: somme(B, 'autre') };
    const props = KB().contratsParPoste(B, 'commun').filter(x => x.budget != null && Math.abs(x.budget - x.contrats) >= DEMI).map(x => {
      const { pg } = KB().partDe(B, x.poste), d = x.contrats - x.budget;
      return { poste: x.poste, label: x.label, budget: x.budget, contrats: x.contrats, moi: Math.round(d * pg / 100), autre: d - Math.round(d * pg / 100) };
    });
    return { lignes: L, tot, vir, ecart: { moi: vir.moi - tot.moi, autre: vir.autre - tot.autre }, props };
  }

  // ------------------------------------------------------------ résumé Grafit « commun »
  function resume(B) {
    const f = finDeMois(B);
    if (!f) return null;
    const C = tresorerie(B);
    const e = c => Math.round(c) / 100;
    const out = { balance: e(f.solde), debits_due: e(f.due), transfers_expected: e(f.inc), reserve: e(f.reserve), end_of_month: e(f.end),
      overdraft_risk: !!risqueDecouvert(B) };
    // 1.1.2 : virements partis d'un compte perso, pas encore arrivés (seulement s'il y en a)
    if (f.route) out.transfers_in_transit = e(f.route);
    if (C && C.min < 0) out.low = { date: C.minAt, amount: e(C.min) };
    if (C) out.due = C.due.filter(d => d.m <= shift(B.auj.slice(0, 7), 3)).slice(0, 4).map(d => ({ month: d.m, amount: -e(d.v), late: !!d.late }));
    return out;
  }

  // ------------------------------------------------------------ import du carnet (appels, équilibre)
  function importer(S, carnet) {
    const st = KB().racine(carnet);
    if (!st) return null;
    const D = KB().donnees(S);
    if (isObj(st.appels)) D.appels = JSON.parse(JSON.stringify(st.appels));
    const eq = D.equilibre || (D.equilibre = { equip: {}, items: [] });
    if (isObj(st.eq) && isObj(st.eq.equip)) for (const k of Object.keys(st.eq.equip)) if (/^\d+$/.test(k)) eq.equip[k] = !!st.eq.equip[k];
    if (Array.isArray(st.eqItems)) {
      eq.items = st.eqItems.filter(isObj).map((x, i) => ({ id: String(x.id || 'o' + i).slice(0, 24), date: x.date || '', label: String(x.label || '').slice(0, 80),
        moi: Math.round((+x.g || 0) * 100), autre: Math.round((+x.s || 0) * 100), on: x.on !== false, src: x.src === 'op' ? 'op' : 'manuel' }));
    }
    D.v = Math.max(D.v || 1, 2);
    return { appels: Object.keys(D.appels || {}).filter(k => isObj(D.appels[k]) && Array.isArray(D.appels[k].items)).length, equipements: (eq.items || []).length };
  }

  g.KladCommun = { EQ_AUTRE, texteEqAutre, origineEq, propositionOp, imprevusMois, ROUTE_JOURS, joursOuvres, ferie, paques, departDe, enRoute, enRouteMois, USAGES, SORTES, usageDe, reglages, virementVu, somme, impots, tresorerie, origine, plan, finDeMois, margeReelle, appels,
    sorteDe, mouvements, versementsMoyens, serieEquilibre, equipements, equilibre, simuler, basculerEquipement, ajouterEquipement, equipementDeOp, retirerEquipement, annulerEquilibre, risqueDecouvert, resume, importer,
    AFFECTATIONS, STATUTS, virementsVus, proposition, ponctuels, affecter, corriger, restaurer, texteAff, enveloppes, statuts, avances, decomposition,
    enveloppesDetournees, partsEnCause, renflouement, renflouementFait, annulerRenflouement, fiche, planPostes };
})(typeof window !== 'undefined' ? window : globalThis);
