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
    const cand = opsCommun(B).filter(r => r.m > 0 && r.date.slice(0, 7) === m && qui(r));
    const ex = cand.find(r => Math.abs(r.m - v.montant) < 1);
    if (ex) return ex;
    const autres = (B.D.virements || []).filter(x => x !== v && x.qui === v.qui).map(x => +x.montant || 0);
    const mot = v.label ? fold(v.label).split(' ')[0] : '';
    return cand.find(r => Math.abs(r.m - v.montant) <= 0.15 * v.montant && !autres.some(o => Math.abs(r.m - o) < 1) && (!v.label || fold(r.label).indexOf(mot) >= 0 || v.qui === 'autre')) || null;
  }
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
      const l = KB().dernierDebitPoste(B, a.key), lm = l ? l.od.slice(0, 7) : null, day = l ? Math.min(28, +l.od.slice(8, 10)) : 5;
      if (a.per === 1) {
        const amt = ctrMontant(a.key); const v = amt != null ? amt : a.amt;
        for (let k = 0; k < 12; k++) { const m = shift(cur, k); if (k === 0 && lm === cur) continue; ev.push({ m, d: k === 0 ? Math.max(day, dNow) : day, v: -v, lab: a.label }); }
      } else {
        const per = a.per, ech = a.ech || a.amt * per;
        const next = KB().moisProchaineEcheance(B, a.key, per, ech);
        for (let m = next; m < end; m = shift(m, per)) { const late = m < cur; ev.push({ m: late ? cur : m, d: late ? dNow : 5, v: -ech, lab: a.label, per: true }); due.push({ m, lab: a.label, v: ech, late }); }
      }
    }
    for (const e of TXE) ev.push(Object.assign({}, e, { d: e.m === cur ? Math.max(e.d, dNow) : e.d }));
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
    return (B.memo.cash = { start: bal.v, min, minAt, negAt, negV, months: ML, due });
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
    const T = KB().parts(B), wG = pW > 0 ? pG / pW : (T.moi + T.autre > 0 ? T.moi / (T.moi + T.autre) : 0.5);
    const C = tresorerie(B);
    const pon = C && C.min < 0 ? Math.ceil(-C.min / 1000) * 1000 : 0;
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
    const recus = V.map(v => ({ v, vu: virementVu(B, v, B.auj.slice(0, 7)), retard: +B.auj.slice(8, 10) > Math.min(28, +v.jour || 1) + 3 }));
    return (B.memo.plan = { need, T, wG, pW, pG, C, pon, ponMoi, ponAutre, changes, W, pas, rec, recM, retourPositif, prochainBas, recus });
  }

  // ------------------------------------------------------------ fin de mois estimée, marge réelle
  // Fin de mois : solde − prélèvements mensuels des contrats pas encore passés ce mois − impôts du mois
  //               + virements attendus pas encore reçus − réserve pour échéances.
  function finDeMois(B) {
    if ('fdm' in B.memo) return B.memo.fdm;
    const bal = KB().soldes(B, ['commun']);
    if (!bal) return (B.memo.fdm = null);
    const m = B.auj.slice(0, 7);
    let due = 0, inc = 0;
    const aVenir = [];
    for (const c of (B.D.contrats || []).filter(c => c.sc === 'commun' && (+c.per || 1) === 1 && c.montant > 0)) {
      const d = KB().dernierDebit(B, c);
      if (!d || d.date.slice(0, 7) !== m) { due += c.montant; aVenir.push(c.label); }
    }
    for (const e of impots(B)) if (e.m === m) { due += -e.v; aVenir.push(e.lab); }
    for (const v of B.D.virements || []) if (!virementVu(B, v, m)) inc += +v.montant || 0;
    const RS = KB().reserveCommun(B);
    const end = bal.v - due + inc - RS.v;
    return (B.memo.fdm = { solde: bal.v, due, inc, reserve: RS.v, reserveDet: RS.det, end, aVenir, decouvert: bal.v - due < 0 });
  }
  // Marge réelle du commun (mois en cours) : solde − charges fixes à venir − reste du budget variable (+ virements attendus).
  function margeReelle(B) {
    const bal = KB().soldes(B, ['commun']);
    if (!bal) return null;
    const s = KB().suivi(B, 'commun', null);
    const fixes = s.T.fixe.left, variable = s.T.courante.left + s.T.optionnelle.left;
    const inc = (B.D.virements || []).filter(v => !virementVu(B, v, B.auj.slice(0, 7))).reduce((t, v) => t + (+v.montant || 0), 0);
    const marge = bal.v - fixes - variable;
    return { solde: bal.v, fixes, variable, marge, attendus: inc, avecAttendus: marge + inc };
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
  function equilibre(B) {
    if ('eq' in B.memo) return B.memo.eq;
    const E = R7(B).equilibre;
    const OPS = mouvements(B);
    if (!OPS.length || !isObj(E.apport)) return (B.memo.eq = null);
    const Sk = {};
    for (const [, , a, k] of OPS) Sk[k] = (Sk[k] || 0) + a;
    const gk = k => Sk[k] || 0, T = KB().parts(B), r = T.rNE;
    const nonElig = -NON_ELIG.reduce((t, k) => t + gk(k), 0) - gk('rf');
    const EQ = equipements(B);
    let eMoi = 0, eAutre = 0;
    for (const x of EQ) if (x.on) { eMoi += x.moi; eAutre += x.autre; }
    const ap = { moi: Math.round((+E.apport.moi || 0) * 100), autre: Math.round((+E.apport.autre || 0) * 100) };
    const R = { apport: ap, versMoi: gk('vg'), versAutre: gk('vs') + gk('rs'), nonElig, rNE: r, equipMoi: eMoi, equipAutre: eAutre,
      pret: -(gk('pc') + gk('pa') + gk('pi')), travaux: -gk('ve'), debloc: gk('dp'), S: Sk, OPS, EQ };
    R.invMoi = ap.moi + R.versMoi - nonElig * r + eMoi;
    R.invAutre = ap.autre + R.versAutre - nonElig * (1 - r) + eAutre;
    R.mensMoi = T.eqMoi; R.mensAutre = T.eqAutre;
    R.ecart = R.invAutre - R.invMoi;                 // > 0 : je dois encore investir plus que l'autre personne
    R.rythme = R.mensMoi - R.mensAutre;
    const lastM = OPS[OPS.length - 1][0].slice(0, 7);
    R.mois = (R.ecart > 0 && R.rythme > 0) || (R.ecart < 0 && R.rythme < 0) ? Math.ceil(R.ecart / R.rythme) : null;
    R.dateEquilibre = R.mois !== null ? shift(lastM, R.mois) : null;
    R.dernierMois = lastM;
    R.libelles = Object.assign({}, SORTES, isObj(E.libelles) ? E.libelles : {});
    return (B.memo.eq = R);
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
    for (const [d, , a, k] of R.OPS) {
      const m = d.slice(0, 7);
      if (k === 'vg') add(m, a, 0); else if (k === 'vs' || k === 'rs') add(m, 0, a);
      else if (NON_ELIG.indexOf(k) >= 0 || k === 'rf') add(m, a * r, a * (1 - r));
    }
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
    if (f.decouvert) {
      const y = +B.auj.slice(0, 4), m = +B.auj.slice(5, 7);
      const fin = B.auj.slice(0, 8) + String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0');
      if (!d || d > fin) d = fin;
    }
    if (!d) return null;
    const jours = Math.max(0, Math.round((Date.parse(d + 'T00:00:00Z') - Date.parse(B.auj + 'T00:00:00Z')) / 864e5));
    if (jours > 366) return null;
    return { date: d, jours, niveau: jours <= 31 ? 'crit' : 'caut' };
  }

  // ------------------------------------------------------------ résumé Grafit « commun »
  function resume(B) {
    const f = finDeMois(B);
    if (!f) return null;
    const C = tresorerie(B);
    const e = c => Math.round(c) / 100;
    const out = { balance: e(f.solde), debits_due: e(f.due), transfers_expected: e(f.inc), reserve: e(f.reserve), end_of_month: e(f.end),
      overdraft_risk: !!risqueDecouvert(B) };
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

  g.KladCommun = { USAGES, SORTES, usageDe, reglages, virementVu, somme, impots, tresorerie, origine, plan, finDeMois, margeReelle, appels,
    sorteDe, mouvements, versementsMoyens, serieEquilibre, equipements, equilibre, simuler, basculerEquipement, ajouterEquipement, equipementDeOp, retirerEquipement, annulerEquilibre, risqueDecouvert, resume, importer };
})(typeof window !== 'undefined' ? window : globalThis);
