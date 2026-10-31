// Klad — impôt sur le revenu du foyer, taxe foncière, épargne salariale (PEE), livret (Lot 8). Calculs identiques à
// l'ancienne version (barème, décote, abattement de 10 %, prélèvement à la source, partage entre les deux personnes,
// régularisations, taxe foncière estimée, PEE, solde du livret). Fonctions pures, testées dans node (test/fisc.test.mjs).
// Montants du module fiscal en euros (arrondis comme l'administration) ; les opérations restent en centimes.
//
// Le barème légal (public) est dans ce fichier ; tout ce qui est propre au foyer (avis d'impôt, bulletins de paie déjà
// lus, hypothèses, logement, plan d'épargne, livret) est une donnée : carnet de l'ancienne version, complément privé,
// réglages de Klad.
(function (g) {
  'use strict';

  const M = () => g.KladModele;
  const KB = () => g.KladBudget;
  const isObj = o => o != null && typeof o === 'object' && !Array.isArray(o);
  const clone = o => o == null ? o : JSON.parse(JSON.stringify(o));

  // Barèmes (revenus de l'année) : tranches par part, décote (seuil personne seule / couple, taux), abattement de 10 %.
  const PARAMS = {
    2025: { st: 'voté', lab: 'Loi de finances pour 2026', src: 'Barème des revenus 2025 (avis de 2026), seuils relevés de 0,9 %',
      tr: [[11600, 0], [29579, 0.11], [84577, 0.30], [181917, 0.41], [Infinity, 0.45]], dec: { s: 897, c: 1483, t: 0.4525 }, abt: { min: 509, max: 14555 } },
    2026: { st: 'projet', lab: 'Projet de loi de finances pour 2027', src: 'Seuils relevés de 2,1 %, à confirmer par le vote de décembre (décote et abattement estimés au même taux)',
      tr: [[11844, 0], [30200, 0.11], [86353, 0.30], [185737, 0.41], [Infinity, 0.45]], dec: { s: 916, c: 1514, t: 0.4525 }, abt: { min: 520, max: 14861 } }
  };
  const PS_FONC = { csg: 0.097, psol: 0.075 };   // revenus fonciers : 17,2 %
  const PASS = 48060;                             // plafond annuel de la Sécurité sociale 2026
  const HYP0 = { salS: null, fraisGm: 'avis', fraisG: null, fraisS: null, fonc: null, rcm: null, tauxOld: null, tauxNew: null, tauxSOld: null, tauxSNew: null, bareme: 'plf', foncA: 'b', communG: 50, partage: 'seul' };
  const IMPOTS_RX = /PRELEVEMENT A LA SOURCE|DGFIP|DIRECTION GENERALE|FINANCES PUBLIQUES|IMPOT/i;
  const PART_RULES = {
    seul: ['Au prorata de l\'impôt de chacun s\'il était seul', 'chacun supporte sa propre progressivité ; le gain de la déclaration commune est partagé dans la même proportion'],
    indiv: ['Comme les taux individualisés', 'le plus petit revenu paie l\'impôt d\'une personne seule (sans dépasser le taux du foyer), l\'autre le reste et garde tout le gain de la déclaration commune'],
    revenus: ['Au prorata des revenus imposables', 'chacun paie le même taux moyen, celui du foyer']
  };

  // ------------------------------------------------------------ données (bloc « budget », sous-objets fisc, tf, pee)
  function racineCarnet(S) { return S.carnet ? KB().racine(S.carnet) : null; }
  function complement(S) { return KB().complement(S); }

  // Import du carnet (fisc, tf, pee, livret) : copie, le carnet reste intact. → rapport.
  function importer(S, carnet) {
    const st = KB().racine(carnet);
    if (!st) return null;
    const D = KB().donnees(S);
    if (isObj(st.fisc)) D.fisc = { avis: clone(st.fisc.avis) || {}, bs: clone(st.fisc.bs) || {}, hyp: Object.assign({}, HYP0, st.fisc.hyp || {}), soldeBy: clone(st.fisc.soldeBy) || {}, year: st.fisc.year || null };
    if (isObj(st.tf)) D.tf = clone(st.tf);
    if (isObj(st.pee)) D.pee = clone(st.pee);
    if (isObj(st.livret)) D.livret = clone(st.livret);
    if (isObj(st.dismiss)) D.dismiss = clone(st.dismiss);
    D.v = Math.max(D.v || 1, 3);
    return { avis: Object.keys((D.fisc && D.fisc.avis) || {}).length, bulletins: Object.keys((D.fisc && D.fisc.bs) || {}).length, tf: !!D.tf, pee: !!D.pee, livret: !!D.livret };
  }

  // Données fiscales effectives : celles de Klad, complétées par le complément (avis : champs manquants).
  function fiscDe(S) {
    const D = (S.budget && S.budget.fisc) || {};
    const X = isObj(complement(S).fisc) ? complement(S).fisc : {};
    const avis = clone(D.avis) || {};
    for (const y of Object.keys(isObj(X.avis) ? X.avis : {})) avis[y] = Object.assign({}, X.avis[y], avis[y] || {}, avis[y] && avis[y].extra ? {} : { extra: X.avis[y].extra });
    return { avis, bs: D.bs || {}, hyp: Object.assign({}, HYP0, D.hyp || {}), soldeBy: Object.assign({}, D.soldeBy || {}), year: D.year || null };
  }

  const pct1 = v => (Math.round(v * 10) / 10).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' %';
  const fmt = n => Math.round(Math.abs(n)).toLocaleString('fr-FR').replace(/[  ]/g, ' ') + ' €';
  const fmt2 = n => Math.abs(n).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/[  ]/g, ' ') + ' €';
  const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const mLabel = m => MOIS[+m.slice(5, 7) - 1] + ' ' + m.slice(2, 4);
  const dfr = d => d.split('-').reverse().join('/');

  // ------------------------------------------------------------ moteur (CGI art. 197 et 83)
  function irBareme(q, P) { let t = 0, lo = 0; for (const [hi, r] of P.tr) { if (q > lo) t += (Math.min(q, hi) - lo) * r; lo = hi; } return t; }
  function tmiOf(q, P) { let lo = 0, r0 = 0; for (const [hi, r] of P.tr) { if (q > lo) r0 = r; lo = hi; } return Math.round(r0 * 100); }
  function irCalc(rni, parts, couple, P) {
    const q = rni / parts, brut = Math.round(irBareme(q, P) * parts), dm = couple ? P.dec.c : P.dec.s;
    let dec = Math.max(0, Math.round(dm - P.dec.t * brut));
    if (dec > brut) dec = brut;
    const tr = [];
    let lo = 0;
    for (const [hi, r] of P.tr) { if (q > lo && r > 0) tr.push([r, Math.min(q, hi) - lo, (Math.min(q, hi) - lo) * r * parts]); lo = hi; }
    return { rni, q, brut, dec, apres: brut - dec, tmi: tmiOf(q, P), tr };
  }
  function netSal(x, frais, P) {
    x = +x || 0;
    if (x <= 0) return { abat: 0, net: 0, fr: false };
    if (frais !== null && frais !== undefined && frais !== '' && +frais >= 0) { const a = Math.min(x, Math.round(+frais)); return { abat: a, net: Math.round(x - a), fr: true }; }
    const a = Math.min(x, Math.min(P.abt.max, Math.max(P.abt.min, Math.round(x * 0.1))));
    return { abat: a, net: Math.round(x - a), fr: false };
  }
  function foyerCalc(inp, P) {
    const gg = netSal(inp.sal.g, inp.frais.g, P), s = netSal(inp.sal.s, inp.frais.s, P), fonc = Math.round(+inp.fonc || 0);
    const B = irCalc(gg.net + s.net + fonc, 2, true, P);
    const prop = Math.round((+inp.rcm || 0) * 0.128), cred = prop;
    const ps = Math.round(fonc * PS_FONC.csg) + Math.round(fonc * PS_FONC.psol);
    const revPAS = (+inp.sal.g || 0) + (+inp.sal.s || 0) + fonc;
    return { g: gg, s, fonc, B, prop, cred, irNet: B.apres + prop - cred, ps, total: B.apres + ps, revPAS, taux: revPAS > 0 ? Math.round(B.apres / revPAS * 1000) / 10 : 0 };
  }
  function tauxIndiv(inp, F, P) {
    const rev = { g: (+inp.sal.g || 0) + F.fonc / 2, s: (+inp.sal.s || 0) + F.fonc / 2 }, low = rev.g <= rev.s ? 'g' : 's', high = low === 'g' ? 's' : 'g';
    const ir = irCalc(netSal(inp.sal[low], inp.frais[low], P).net + Math.round(F.fonc / 2), 1, false, P).apres;
    const tf = F.B.apres / Math.max(1, rev.g + rev.s);
    let tl = rev[low] > 0 ? ir / rev[low] : 0;
    if (tl > tf) tl = tf;
    const th = rev[high] > 0 ? Math.max(0, (F.B.apres - tl * rev[low]) / rev[high]) : 0;
    return { [low]: Math.round(tl * 1000) / 10, [high]: Math.round(th * 1000) / 10, low };
  }

  // ------------------------------------------------------------ contexte fiscal (une fois par affichage)
  function contexte(B) {
    if (B.memo.fisc) return B.memo.fisc;
    const S = B.S, FI = fiscDe(S);
    const noms = { g: B.R.commun.moi || 'Moi', s: B.R.commun.autre || 'L\'autre personne' };
    const dgfip = B.rows.filter(r => !r.ecart && r.role === 'commun' && r.m < 0 && IMPOTS_RX.test(r.label));
    return (B.memo.fisc = { B, FI, noms, dgfip, Y: +B.auj.slice(0, 4), auj: B.auj, memo: {} });
  }
  function bsList(X, p, year) {
    const map = {};
    for (const [id, b] of Object.entries(X.FI.bs || {})) {
      if (!b || b.p !== p || (year && String(b.pay).slice(0, 4) !== String(year))) continue;
      const k = b.emp + '|' + b.m;
      if (!map[k] || (b.mt || '') > (map[k].mt || '')) map[k] = Object.assign({ id }, b);
    }
    return Object.values(map).sort((a, b) => a.pay < b.pay ? -1 : a.pay > b.pay ? 1 : 0);
  }

  // Modèle d'une année : avis (année close) ou estimation (année en cours).
  function annee(X, Y) {
    const k = 'an|' + Y;
    if (X.memo[k]) return X.memo[k];
    const FI = X.FI, H = FI.hyp, av = FI.avis[Y], prevAv = FI.avis[Y - 1];
    const sumOf = (l, kk) => l.reduce((t, b) => t + (+b[kk] || 0), 0);
    let R;
    if (av) {
      const P = PARAMS[Y] || PARAMS[2025];
      const inp = { sal: { g: av.sal.g, s: av.sal.s }, frais: { g: av.fr && av.fr.g ? av.ded.g : null, s: av.fr && av.fr.s ? av.ded.s : null }, fonc: av.fonc || 0, rcm: av.rcm || 0 };
      const F = foyerCalc(inp, P), ex = av.extra || {}, eg = ex.g || { ni: 0, pas: 0 }, es = ex.s || { ni: 0, pas: 0 };
      const bg = bsList(X, 'g', Y), bs = bsList(X, 's', Y);
      const okG = Math.abs(sumOf(bg, 'ni') + eg.ni - av.sal.g) <= 50, okS = Math.abs(sumOf(bs, 'ni') + es.ni - av.sal.s) <= 50;
      let pas, how;
      if (okG) { const gg = sumOf(bg, 'pas') + eg.pas; pas = { g: gg, s: av.pas - gg, est: false }; how = X.noms.g + ' : bulletins' + (eg.pas ? ' + ' + (eg.src || 'complément') : '') + ' ; ' + X.noms.s + ' : total de l\'avis moins la part de ' + X.noms.g; }
      else if (okS) { const sv = sumOf(bs, 'pas') + es.pas; pas = { g: av.pas - sv, s: sv, est: false }; how = X.noms.s + ' : bulletins ; ' + X.noms.g + ' : total de l\'avis moins la part de ' + X.noms.s; }
      else { const gg = av.pas * (av.sal.g / Math.max(1, av.sal.g + av.sal.s)); pas = { g: gg, s: av.pas - gg, est: true }; how = 'réparti au prorata des salaires (bulletins incomplets)'; }
      R = { Y, kind: 'avis', P, av, inp, F, pas, pasHow: how, acompte: 0, accProj: 0, projG: 0, projPasG: 0, solde: av.solde, paid: av.pas, total: av.irNet + av.ps, rest: 0, bg, bs };
    } else {
      const P = H.bareme === 'gel' ? PARAMS[Y - 1] || PARAMS[2025] : PARAMS[Y] || PARAMS[2026];
      const bg = bsList(X, 'g', Y), last = bg[bg.length - 1];
      const sumNi = sumOf(bg, 'ni'), sumPas = sumOf(bg, 'pas');
      const lastM = last ? +last.pay.slice(5, 7) : +X.auj.slice(5, 7) - 1, nRest = Math.max(0, 12 - lastM);
      const persoOld = bg.filter(b => b.type === 'perso' && +b.pay.slice(5, 7) < 9).map(b => b.taux);
      const tauxOld = H.tauxOld != null ? +H.tauxOld : (persoOld.length ? persoOld[persoOld.length - 1] : 0);
      const Fprev = prevAv ? annee(X, Y - 1).F : null;
      const tauxNewAuto = Fprev ? Fprev.taux : tauxOld, tauxNew = H.tauxNew != null ? +H.tauxNew : tauxNewAuto;
      const tSOld = H.tauxSOld != null ? +H.tauxSOld : tauxOld, tSNew = H.tauxSNew != null ? +H.tauxSNew : tauxNew;
      const projG = last ? last.ni * nRest : 0, projPasG = projG * tauxNew / 100;
      const bs = bsList(X, 's', Y), el = +X.auj.slice(5, 7) - 1;
      let salS, pasS, pasSPaid, sSrc;
      if (bs.length && H.salS == null) {
        const sN = sumOf(bs, 'ni'), sP = sumOf(bs, 'pas'), nm = new Set(bs.map(b => b.pay.slice(0, 7))).size, avg = sN / nm, rest = Math.max(0, 12 - nm);
        salS = Math.round(sN + avg * rest); pasSPaid = sP; pasS = sP + avg * rest * tSNew / 100; sSrc = 'bulletins (' + nm + ' mois)' + (rest ? ' + ' + rest + ' mois estimés' : '');
      } else {
        salS = H.salS != null ? +H.salS : (prevAv ? prevAv.sal.s : 0); sSrc = H.salS != null ? 'hypothèse' : 'avis ' + (Y - 1);
        pasS = salS * ((8 * tSOld + 4 * tSNew) / 12) / 100; pasSPaid = salS / 12 * (Math.min(el, 8) * tSOld + Math.max(0, el - 8) * tSNew) / 100;
      }
      const fm = H.fraisGm || 'avis', fraisG = fm === 'dix' ? null : fm === 'reel' ? (H.fraisG != null ? +H.fraisG : null) : (prevAv && prevAv.fr && prevAv.fr.g ? prevAv.ded.g : null);
      const inp = { sal: { g: Math.round(sumNi + projG), s: salS }, frais: { g: fraisG, s: H.fraisS }, fonc: H.fonc != null ? +H.fonc : (prevAv ? prevAv.fonc : 0), rcm: H.rcm != null ? +H.rcm : (prevAv ? prevAv.rcm : 0) };
      const F = foyerCalc(inp, P);
      const dg = X.dgfip.filter(r => r.date.slice(0, 4) === String(Y) && /SOURCE/i.test(r.label));
      const acompte = -dg.reduce((t, r) => t + r.m / 100, 0), lastAc = dg.length ? -dg[dg.length - 1].m / 100 : 0;
      const accProj = lastAc ? lastAc * Math.max(0, 12 - (+dg[dg.length - 1].date.slice(5, 7))) : 0;
      const paid = sumPas + pasSPaid + acompte, toCome = projPasG + (pasS - pasSPaid) + accProj;
      const total = F.total, solde = Math.round(total - paid - toCome);
      R = { Y, kind: 'est', P, inp, F, bg, bs, sSrc, sumNi, sumPas, projG, projPasG, nRest, tauxOld, tauxNew, tauxNewAuto, tSOld, tSNew, pas: { g: sumPas + projPasG, s: pasS, est: !bs.length },
        pasSPaid, acompte, accProj, paid, toCome, total, solde, fraisG, nbAcomptes: dg.length };
    }
    return (X.memo[k] = R);
  }

  function irSeul(R, p, fp) { return irCalc(netSal(R.inp.sal[p], R.inp.frais[p], R.P).net + Math.round(R.F.fonc * fp[p]), 1, false, R.P).apres; }
  function partage(X, R, rule) {
    const H = X.FI.hyp;
    rule = rule || H.partage || 'seul';
    const fa = H.foncA || 'b', fg = fa === 'g' ? 1 : fa === 's' ? 0 : 0.5, fp = { g: fg, s: 1 - fg };
    const base = { g: R.F.g.net + R.F.fonc * fg, s: R.F.s.net + R.F.fonc * (1 - fg) }, tb = Math.max(1, base.g + base.s);
    const PS = R.kind === 'avis' ? (R.av.ps || 0) : R.F.ps, IR = R.total - PS;
    const alone = { g: irSeul(R, 'g', fp), s: irSeul(R, 's', fp) };
    let shIR = { g: base.g / tb, s: base.s / tb };
    if (rule === 'seul' && alone.g + alone.s > 0) shIR = { g: alone.g / (alone.g + alone.s), s: alone.s / (alone.g + alone.s) };
    else if (rule === 'indiv' && IR > 0) {
      const low = base.g <= base.s ? 'g' : 's', high = low === 'g' ? 's' : 'g', revLow = (+R.inp.sal[low] || 0) + R.F.fonc * fp[low];
      const dl = Math.min(alone[low], IR / Math.max(1, R.F.revPAS) * revLow);
      shIR = { [low]: dl / IR, [high]: 1 - dl / IR };
    }
    const due = { g: IR * shIR.g + PS * fp.g, s: IR * shIR.s + PS * fp.s }, tot = Math.max(1, R.total), sh = { g: due.g / tot, s: due.s / tot };
    const cg = (+H.communG || 50) / 100;
    const paid = { g: R.pas.g + (R.acompte + (R.accProj || 0)) * cg, s: R.pas.s + (R.acompte + (R.accProj || 0)) * (1 - cg) };
    if (R.kind === 'avis') {
      const by = X.FI.soldeBy[R.Y] || 'g', so = R.solde;
      if (by === 'g') paid.g += so; else if (by === 's') paid.s += so; else { paid.g += so * cg; paid.s += so * (1 - cg); }
    }
    return { rule, base, alone, IR, PS, sh, due, paid, rest: { g: due.g - paid.g, s: due.s - paid.s } };
  }

  // Phrases de partage : jamais de montant négatif ; qui paie, qui verse combien à qui.
  function texte(X, R, SH) {
    const W = X.noms, a = Math.round(SH.rest.g), b = Math.round(SH.rest.s), so = Math.round(R.solde);
    if (R.kind === 'avis') return Math.abs(a) <= 5 ? 'Chacun a payé sa part de l\'impôt ' + R.Y + '.' : (a < 0 ? W.s + ' verse ' + fmt(-a) + ' à ' + W.g : W.g + ' verse ' + fmt(a) + ' à ' + W.s) + ' pour solder l\'impôt ' + R.Y + '.';
    if (so >= 0) {
      if (a >= 0 && b >= 0) return 'Sur le solde de ' + fmt(so) + ' attendu en septembre ' + (R.Y + 1) + ', ' + W.g + ' paie ' + fmt(a) + ' et ' + W.s + ' ' + fmt(b) + '.';
      const p = a > b ? 'g' : 's', o = p === 'g' ? 's' : 'g', x = Math.abs(Math.min(a, b));
      return W[p] + ' paie tout le solde de ' + fmt(so) + ' (septembre ' + (R.Y + 1) + ') et verse en plus ' + fmt(x) + ' à ' + W[o] + ', qui a déjà trop payé.';
    }
    const rf = -so;
    if (a <= 0 && b <= 0) return 'Le remboursement de ' + fmt(rf) + ' attendu à l\'été ' + (R.Y + 1) + ' revient pour ' + fmt(-a) + ' à ' + W.g + ' et ' + fmt(-b) + ' à ' + W.s + '.';
    const r_ = a < b ? 'g' : 's', o = r_ === 'g' ? 's' : 'g', x = Math.max(a, b);
    return 'Le remboursement de ' + fmt(rf) + ' attendu à l\'été ' + (R.Y + 1) + ' revient à ' + W[r_] + ', et ' + W[o] + ' lui verse en plus ' + fmt(x) + '.';
  }
  function regularisations(X) {
    const out = [], Y = X.Y;
    for (const y of Object.keys(X.FI.avis).map(Number).sort((a, b) => a - b)) {
      const R = annee(X, y), SH = partage(X, R), d = Math.round(SH.rest.g);
      out.push({ y, kind: 'avis', per: 'Impôt sur les revenus ' + y + ' (avis de ' + (y + 1) + ', solde réglé en ' + (y + 1) + ')', amt: Math.abs(d), from: d < 0 ? 's' : 'g', to: d < 0 ? 'g' : 's', done: Math.abs(d) <= 5, txt: texte(X, R, SH) });
    }
    if (!X.FI.avis[Y]) {
      const R = annee(X, Y), SH = partage(X, R);
      out.push({ y: Y, kind: 'est', per: 'Impôt sur les revenus ' + Y + ' (estimation, solde de septembre ' + (Y + 1) + ')',
        txt: texte(X, R, SH) + (R.pas.est ? ' Prélèvement de ' + X.noms.s + ' estimé à ' + pct1(R.tSOld) + ' puis ' + pct1(R.tSNew) + ' : à confirmer avec son taux réel ou ses bulletins.' : ''), solde: R.solde });
    }
    return out;
  }
  const resteTexte = v => v >= 0.5 ? 'doit encore ' + fmt(v) : v <= -0.5 ? 'a trop payé ' + fmt(-v) : 'à jour';

  // ------------------------------------------------------------ observations fiscales
  function placePer(R) { let lo = 0; for (const [hi] of R.P.tr) { if (R.F.B.q <= hi) return Math.max(0, (R.F.B.q - lo) * 2); lo = hi; } return 0; }
  function alertes(X, R) {
    const A = [], add = (lvl, t, p) => A.push({ lvl, t, p });
    R = R || annee(X, X.Y);
    const W = X.noms;
    if (R.kind === 'est') {
      for (const b of R.bg.filter(b => b.type === 'neutre')) {
        const over = b.pas - b.ni * R.tauxNew / 100;
        if (over > 5) add('warn', 'Taux non personnalisé chez ' + b.emp + ' (' + mLabel(b.m) + ')', b.emp + ' a appliqué le taux par défaut de ' + pct1(b.taux) + ' : ' + fmt2(b.pas) + ' prélevés au lieu d\'environ ' + fmt(b.ni * R.tauxNew / 100) + ', soit ' + fmt(over) + ' de trop, déduits du solde de ' + (R.Y + 1) + '. Rien à faire : l\'administration transmet votre taux à l\'employeur après sa première déclaration. Si le prochain bulletin indique encore « non personnalisé », écrivez par la messagerie d\'impots.gouv.');
      }
      const need = R.F.B.apres / Math.max(1, R.F.revPAS) * 100;
      if (R.solde > 300) {
        add('warn', 'Solde estimé : ' + fmt(R.solde) + ' à payer en septembre ' + (R.Y + 1), 'Au-delà de 300 €, il est prélevé en quatre fois, de septembre à décembre ' + (R.Y + 1) + '. Le taux actuel (' + pct1(R.tauxNew) + ') ne couvre pas l\'impôt ' + R.Y + ' : il faudrait environ ' + pct1(need) + '.');
        add('warn', 'Relever le taux du foyer (démarche facultative, conseillée)', 'Sans rien faire, le même manque se reproduira sur les salaires de janvier à août ' + (R.Y + 1) + ', car le taux ne sera recalculé qu\'en septembre ' + (R.Y + 1) + '. La démarche : impots.gouv › Gérer mon prélèvement à la source › Actualiser suite à une hausse de vos revenus, en indiquant vos revenus ' + R.Y + ' estimés (' + W.g + ' environ ' + fmt(R.inp.sal.g) + ', ' + W.s + ' environ ' + fmt(R.inp.sal.s) + '). Une seule démarche pour le foyer ; le nouveau taux (environ ' + pct1(need) + ') vaut pour vous deux. À défaut, mettez de côté environ ' + fmt(R.solde / 12) + ' par mois.');
      } else if (R.solde > 0) add('info', 'Petit solde estimé : ' + fmt(R.solde) + ' en septembre ' + (R.Y + 1), 'Prélevé en une fois, rien à faire.');
      else if (R.solde < -50) add('good', 'Remboursement estimé : ' + fmt(-R.solde) + ' à l\'été ' + (R.Y + 1), 'Vos prélèvements dépassent l\'impôt estimé.');
      const prev = X.FI.avis[R.Y - 1];
      if (prev && !R.bs.length && X.FI.hyp.tauxSNew == null) {
        const Rp = annee(X, R.Y - 1);
        if (!Rp.pas.est) {
          const eg = Rp.pas.g / Math.max(1, prev.sal.g) * 100, es = Rp.pas.s / Math.max(1, prev.sal.s) * 100;
          if (es < eg - 1.5) add('info', W.s + ' prélevée moins que le taux du foyer', 'En ' + (R.Y - 1) + ', ' + W.s + ' a été prélevée de ' + fmt(Rp.pas.s) + ' (' + pct1(es) + ' de ses salaires) et ' + W.g + ' de ' + fmt(Rp.pas.g) + ' (' + pct1(eg) + '). Cela ressemble à des taux individualisés. L\'estimation suppose le taux du foyer : vérifiez vos deux taux sur impots.gouv et indiquez le sien dans les hypothèses.');
        }
      }
      if (prev && prev.decote > 0 && R.F.B.dec === 0) add('info', 'Plus de décote', 'L\'impôt ' + (R.Y - 1) + ' bénéficiait de ' + fmt(prev.decote) + ' de décote ; avec la hausse des revenus, elle disparaît en ' + R.Y + '.');
      if (R.fraisG != null && R.fraisG !== '') { const ab = netSal(R.inp.sal.g, null, R.P).abat; if (ab > +R.fraisG + 50) add('info', 'Déclaration ' + (R.Y + 1) + ' : les 10 % seraient plus avantageux', 'Vos frais réels ' + (R.Y - 1) + ' étaient de ' + fmt(+R.fraisG) + ' ; l\'abattement de 10 % sur vos salaires ' + R.Y + ' atteindrait ' + fmt(ab) + '. Gardez les frais réels seulement s\'ils augmentent.'); }
      if (R.acompte > 0) add('info', 'Acomptes sur le compte commun', fmt2(R.acompte) + ' prélevés par l\'administration fiscale sur le compte commun en ' + R.Y + ' : acomptes du prélèvement à la source sur les revenus fonciers, environ ' + fmt(R.acompte / Math.max(1, R.nbAcomptes)) + ' par mois.');
      if (R.P.st === 'projet') add('info', 'Barème en projet', R.P.lab + ' : ' + R.P.src + '. Si le budget n\'était pas voté, le barème resterait gelé (option « barème gelé » dans les hypothèses).');
      const months = new Set(R.bg.map(b => b.pay.slice(0, 7))), cur = X.auj.slice(0, 7), miss = [];
      for (let k = 1; k <= 12; k++) { const mm = R.Y + '-' + String(k).padStart(2, '0'); if (mm >= cur) break; if (!months.has(mm)) miss.push(mLabel(mm)); }
      if (!R.bg.length) add('warn', 'Aucun bulletin lu pour ' + R.Y, 'Les bulletins de paie lus par l\'ancienne version alimentent l\'estimation ; la lecture des nouveaux bulletins viendra avec le Lot 9.');
      else if (miss.length) add('info', 'Mois sans bulletin payé', miss.join(', ') + ' : aucun salaire versé ce mois-là d\'après les bulletins lus.');
    }
    try { for (const a of alertesTF(X)) A.push(a); } catch (e) { /* taxe foncière absente */ }
    const av = X.FI.avis[X.Y - 1], Re = R.kind === 'est' ? R : annee(X, X.Y), tm = Re.F.B.tmi;
    if (av && av.per) add('info', tm >= 30 ? 'Épargne retraite (PER) : tranche à ' + tm + ' % en ' + Re.Y : 'Épargne retraite (PER) peu utile à ' + tm + ' %', tm >= 30
      ? 'Votre tranche marginale estimée passe à ' + tm + ' % (elle était de ' + av.tmi + ' %) : 100 € versés sur un PER avant le 31/12 réduisent l\'impôt ' + Re.Y + ' d\'environ ' + tm + ' €, sur les ' + Math.round(placePer(Re)).toLocaleString('fr-FR') + ' premiers euros versés, dans la limite du plafond de ' + fmt(av.per.g) + ' chacun ; l\'argent est bloqué jusqu\'à la retraite. À comparer avec le PEE et son abondement.'
      : 'Plafond de déduction disponible : ' + fmt(av.per.g) + ' chacun, mais à un taux marginal de ' + tm + ' %, 100 € versés n\'économisent que ' + tm + ' € d\'impôt. Le PEE avec abondement est plus intéressant.');
    return A;
  }

  // ------------------------------------------------------------ taxe foncière
  function tfDe(X) {
    const S = X.B.S, D = (S.budget && S.budget.tf) || {}, C = isObj(complement(S).tf) ? complement(S).tf : {};
    const T = Object.assign({}, C, D);
    T.avis = Object.assign({}, C.avis || {}, D.avis || {});
    return T.ach ? T : null;
  }
  const tfEch = y => y + '-10-15';
  function tfAnnee(X, y) {
    const TF = tfDe(X);
    if (!TF) return null;
    const ay = +TF.ach.slice(0, 4);
    if (y <= ay && !TF.avis[y]) return { y, kind: 'none', total: 0, base: 0, exo: 0, why: 'logement non achevé au 1er janvier ' + y };
    const k = Math.pow(1 + (+TF.reval || 0) / 100, Math.max(0, y - 2026));
    const base = Math.round(((+TF.surf || 0) * (+TF.baseM2 || 0) + (+TF.basePk || 0)) * k);
    const exo = (y > ay && y <= ay + 2) ? (+TF.exoCom || 0) / 100 : 0;
    const tf = base * (1 - exo) * ((+TF.tCom || 0) + (+TF.tSpe || 0)) / 100 * 1.03, teom = base * (+TF.tTeom || 0) / 100 * 1.08;
    const R = { y, kind: 'est', base, exo, tf, teom, total: Math.round(tf + teom), full: Math.round(base * ((+TF.tCom || 0) + (+TF.tSpe || 0)) / 100 * 1.03 + teom) };
    const av = TF.avis[y];
    if (av) Object.assign(R, { kind: 'avis', total: +av.total, base: +av.base || base });
    return R;
  }
  function tfPayee(X, y) {
    const TF = tfDe(X), av = TF && TF.avis[y];
    return X.B.rows.filter(r => !r.ecart && r.role === 'commun' && r.m < 0 && r.date.slice(0, 4) === String(y) && (/FONCI/i.test(r.label) || (av && /DGFIP|FINANCES PUBLIQUES|DIRECTION GENERALE|IMPOT/i.test(r.label) && Math.abs(-r.m / 100 - av.total) <= 2)));
  }
  const tfPart = (X, v) => { const pg = +(tfDe(X).pg || 0); return { g: v * pg / 100, s: v * (100 - pg) / 100 }; };
  function tfProchaine(X) {
    for (let y = X.Y; y <= X.Y + 3; y++) { const R = tfAnnee(X, y); if (R && R.total > 0 && !tfPayee(X, y).length && tfEch(y) >= M().plusJours(X.auj, -30)) return R; }
    return null;
  }
  function alertesTF(X) {
    const TF = tfDe(X);
    if (!TF) return [];
    const A = [], add = (lvl, t, p) => A.push({ lvl, t, p }), ay = +TF.ach.slice(0, 4);
    if (TF.h2ok !== 'oui') {
      const gain = [ay + 1, ay + 2].reduce((t, y) => { const R = tfAnnee(X, y); return t + (R.full || 0) - (R.total || 0); }, 0);
      add('warn', 'Taxe foncière : déclaration H2 à confirmer', 'La déclaration d\'achèvement (H2) doit être déposée dans les 90 jours après la livraison du ' + dfr(TF.ach) + '. Vérifiez sur impots.gouv › Biens immobiliers que le logement apparaît avec l\'exonération de construction neuve, puis indiquez « confirmée » dans la taxe foncière. Sans elle : environ ' + fmt(gain) + ' de plus sur ' + (ay + 1) + ' et ' + (ay + 2) + '.');
    }
    const N = tfProchaine(X);
    if (N) {
      const p = tfPart(X, N.total), d = Math.round((Date.parse(tfEch(N.y)) - Date.parse(X.auj)) / 864e5);
      add(d <= 45 ? 'warn' : 'info', 'Taxe foncière ' + N.y + ' : ' + (N.kind === 'avis' ? '' : 'environ ') + fmt(N.total) + ' le ' + dfr(tfEch(N.y)), 'Payée en une fois depuis le compte commun' + (N.kind === 'avis' ? ' (montant de l\'avis)' : ' (estimation' + (N.exo ? ', exonération de ' + Math.round(N.exo * 100) + ' % de la base' : '') + ')') + '. ' + X.noms.g + ' verse ' + fmt(p.g) + ' et ' + X.noms.s + ' ' + fmt(p.s) + ' sur le commun avant l\'échéance.');
    }
    if (X.Y <= ay && !TF.avis[X.Y] && X.auj <= tfEch(X.Y)) add('info', 'Taxe foncière ' + X.Y + ' : rien d\'attendu', 'Le logement n\'était pas achevé au 1er janvier ' + X.Y + '.');
    return A;
  }
  function taxeFonciere(X) {
    const TF = tfDe(X);
    if (!TF) return null;
    const ay = +TF.ach.slice(0, 4), lignes = [];
    for (let y = Math.max(ay, X.Y); y <= Math.max(ay, X.Y) + 4; y++) {
      const R = tfAnnee(X, y), paid = tfPayee(X, y), p = tfPart(X, R.total);
      lignes.push(Object.assign({}, R, { payee: paid.length ? paid[paid.length - 1].date : null, moi: p.g, autre: p.s, echeance: tfEch(y) }));
    }
    return { TF, lignes, prochaine: tfProchaine(X) };
  }

  // ------------------------------------------------------------ épargne salariale (PEE)
  function peeDe(X) {
    const S = X.B.S, D = (S.budget && S.budget.pee) || {}, C = isObj(complement(S).pee) ? complement(S).pee : {};
    if (!D.plan && !C.plan && !(D.vers || []).length) return null;
    return { plan: Object.assign({ emp: '', entree: '', anc: 3, teneur: '', abTaux: null, abPlaf: null, dispo: 5 }, C.plan || {}, D.plan || {}), fonds: D.fonds || [], vers: D.vers || [], closed: D.closed || C.closed || [] };
  }
  function xirr(flows) {
    if (flows.length < 2) return null;
    const t0 = Date.parse(flows[0][0]);
    const f = r => flows.reduce((s, [d, v]) => s + v / Math.pow(1 + r, (Date.parse(d) - t0) / 31557600000), 0);
    let lo = -0.99, hi = 5, flo = f(lo), fhi = f(hi);
    if (flo * fhi > 0) return null;
    for (let i = 0; i < 100; i++) { const m = (lo + hi) / 2, fm = f(m); if (Math.abs(fm) < 1e-7) return m; if (flo * fm < 0) { hi = m; fhi = fm; } else { lo = m; flo = fm; } }
    return (lo + hi) / 2;
  }
  function pee(X) {
    const PEE = peeDe(X);
    if (!PEE) return null;
    const byF = {};
    for (const f of PEE.fonds) byF[f.id] = { f, mt: 0, parts: 0, val: 0, known: true };
    let mt = 0, ab = 0, perso = 0;
    const flows = [];
    for (const v of PEE.vers) {
      const b = byF[v.fid];
      mt += v.mt; if (v.orig === 'abond') ab += v.mt; else perso += v.mt;
      flows.push([v.d, -v.mt]);
      if (b) { b.mt += v.mt; if (v.parts > 0) b.parts += v.parts; else b.known = false; }
    }
    let val = 0;
    for (const b of Object.values(byF)) { b.val = b.known && b.parts > 0 && b.f.vl > 0 ? b.parts * b.f.vl : b.mt; val += b.val; }
    flows.sort((a, b) => a[0] < b[0] ? -1 : 1);
    const tri = PEE.vers.length && val > 0 ? xirr(flows.concat([[X.auj, val]])) : null;
    const Y = X.Y;
    const volY = PEE.vers.filter(v => v.d.slice(0, 4) === String(Y) && v.orig !== 'abond' && v.orig !== 'transf').reduce((t, v) => t + v.mt, 0);
    const abY = PEE.vers.filter(v => v.d.slice(0, 4) === String(Y) && v.orig === 'abond').reduce((t, v) => t + v.mt, 0);
    const C = { PEE, byF, mt, ab, perso, val, pv: val - mt, tri, volY, abY };
    C.conseils = conseilsPee(X, C);
    return C;
  }
  const plusAns = (d, n) => (+d.slice(0, 4) + n) + d.slice(4);
  function conseilsPee(X, C) {
    const A = [], add = (lvl, t, p) => A.push({ lvl, t, p }), pl = C.PEE.plan;
    if (pl.entree) {
      const elig = KB().shift(pl.entree.slice(0, 7), +pl.anc || 0) + '-' + pl.entree.slice(8, 10);
      if (X.auj < elig) add('info', 'Adhésion possible à partir du ' + dfr(elig), (pl.anc || 0) + ' mois d\'ancienneté' + (pl.emp ? ' chez ' + pl.emp : '') + ' (entrée le ' + dfr(pl.entree) + '). Vérifiez la durée exacte dans le règlement du plan.');
    }
    const plafLeg = Math.round(PASS * 0.08 * 100) / 100;
    if (!(pl.abTaux > 0) || !(pl.abPlaf > 0)) add('warn', 'Règle d\'abondement à renseigner', 'Taux et plafond figurent dans le règlement du PEE ou l\'accord d\'entreprise. Le plafond légal de l\'abondement est de 8 % du plafond de la Sécurité sociale, soit ' + fmt2(plafLeg) + ' par an.');
    else {
      const need = Math.min(pl.abPlaf, plafLeg) / (pl.abTaux / 100), rest = Math.max(0, need - C.volY);
      add(rest > 0 ? 'warn' : 'good', rest > 0 ? 'Abondement non capté : versez encore ' + fmt(rest) + ' cette année' : 'Abondement maximal capté cette année', 'Avec ' + pl.abTaux + ' % d\'abondement plafonné à ' + fmt(Math.min(pl.abPlaf, plafLeg)) + ', il faut verser ' + fmt(need) + ' par an. Déjà versé en ' + X.Y + ' : ' + fmt(C.volY) + '. C\'est un rendement immédiat de ' + pl.abTaux + ' %, avant toute performance.');
    }
    if (C.val > 0) {
      const shares = Object.values(C.byF).map(b => [b.f, b.val / C.val]).sort((a, b) => b[1] - a[1]);
      const emp = shares.filter(([f]) => f.cat === 'emp').reduce((t, [, s]) => t + s, 0);
      if (emp > 0.3) add('warn', 'Trop concentré sur l\'action de votre employeur (' + Math.round(emp * 100) + ' %)', 'Votre salaire dépend déjà de votre employeur : au-delà d\'environ 30 % de l\'encours, une mauvaise passe toucherait à la fois votre emploi et votre épargne.');
      if (shares[0] && shares[0][1] > 0.6 && shares[0][0].cat !== 'mon') add('info', 'Un seul fonds porte ' + Math.round(shares[0][1] * 100) + ' % de l\'encours', shares[0][0].nom + ' : diversifiez entre au moins deux fonds de risques différents.');
      const risky = shares.filter(([f]) => (+f.sri || 0) >= 5).reduce((t, [, s]) => t + s, 0);
      if (risky > 0.8) add('info', 'Profil très dynamique', Math.round(risky * 100) + ' % en fonds de risque 5 ou plus : cohérent pour une épargne bloquée 5 ans, moins pour une somme dont vous auriez besoin à la sortie.');
    }
    add('info', 'Intéressement et participation', 'Placés sur le PEE, ils sont exonérés d\'impôt sur le revenu (seuls les prélèvements sociaux s\'appliquent) ; perçus directement, ils s\'ajoutent à vos salaires imposables.');
    add('info', 'Plafond des versements volontaires', '25 % de votre rémunération brute annuelle. Les sommes sont bloquées ' + (pl.dispo || 5) + ' ans, sauf cas de déblocage anticipé (mariage ou PACS, naissance, achat de la résidence principale…).');
    const next = C.PEE.vers.map(v => v.dispo || plusAns(v.d, pl.dispo || 5)).filter(d => d > X.auj).sort()[0];
    if (next) add('info', 'Prochaine somme disponible le ' + dfr(next), '');
    return A;
  }

  // ------------------------------------------------------------ livret (compte d'épargne non transmis par la banque)
  // Solde saisi à une date, puis les virements vers le livret repérés sur le compte principal (motif) depuis cette date.
  function livret(B) {
    const S = B.S, D = (S.budget && S.budget.livret) || null, C = isObj(complement(S).livret) ? complement(S).livret : {};
    if (!D || D.base == null || !D.date) return null;
    const map = (S.modele.reprise && S.modele.reprise.map) || {};
    const cpt = C.compte ? (map[C.compte] || C.compte) : null;
    let rx = null;
    try { rx = new RegExp(C.motif || 'LIVRE|LIVRET', 'i'); } catch (e) { rx = /LIVRE|LIVRET/i; }
    let v = Math.round(+D.base * 100), n = 0, d = D.date;
    for (const r of B.rows) {
      if (r.ecart || (cpt ? r.cid !== cpt : r.role !== 'courant') || r.date <= D.date || !rx.test(r.label)) continue;
      v -= r.m; n++;
      if (r.date > d) d = r.date;
    }
    const compte = C.epargne ? M().compte(S, map[C.epargne] || C.epargne) : null;
    return { centimes: v, depuis: d, base: Math.round(+D.base * 100), date: D.date, n, compte: compte ? compte.id : null };
  }


  // Intérêts estimés du livret pour l'année en cours, par quinzaine (règle des livrets réglementés : un versement compte
  // à partir de la quinzaine suivante, un retrait dès la quinzaine en cours ; approché par le plus petit solde de la
  // quinzaine), au taux saisi (bloc livret, sinon complément). → { centimes, taux, annee } ou null.
  function livretInterets(B) {
    const L = livret(B);
    const S = B.S, D = (S.budget && S.budget.livret) || {}, C = isObj(complement(S).livret) ? complement(S).livret : {};
    const taux = isFinite(+D.taux) && +D.taux > 0 ? +D.taux : isFinite(+C.taux) && +C.taux > 0 ? +C.taux : null;
    if (!L || !taux) return null;
    const map = (S.modele.reprise && S.modele.reprise.map) || {};
    const cpt = C.compte ? (map[C.compte] || C.compte) : null;
    let rx = null;
    try { rx = new RegExp(C.motif || 'LIVRE|LIVRET', 'i'); } catch (e) { rx = /LIVRE|LIVRET/i; }
    const mv = B.rows.filter(r => !r.ecart && (cpt ? r.cid === cpt : r.role === 'courant') && rx.test(r.label)).map(r => [r.date, -r.m]);
    // solde du livret à une date : solde saisi, plus les mouvements entre les deux dates
    const solde = d => d >= L.date ? L.base + mv.filter(x => x[0] > L.date && x[0] <= d).reduce((t, x) => t + x[1], 0)
      : L.base - mv.filter(x => x[0] > d && x[0] <= L.date).reduce((t, x) => t + x[1], 0);
    const an = +B.auj.slice(0, 4);
    let tot = 0;
    for (let m = 1; m <= 12; m++) {
      const mm = an + '-' + String(m).padStart(2, '0');
      for (const [a, b] of [['01', '15'], ['16', null]]) {
        const debut = mm + '-' + a, fin = b ? mm + '-' + b : KB().finMois(mm);
        const v = Math.max(0, Math.min(solde(KB().plusJours(debut, -1)), solde(fin > B.auj ? B.auj : fin)));
        tot += v * taux / 100 / 24;
      }
    }
    return { centimes: Math.round(tot), taux, annee: an };
  }
  // Texte affiché sur la carte du compte livret (estimation du solde et des intérêts). → { idCompte: { centimes, texte } }.
  function livretCarte(B) {
    const L = livret(B);
    if (!L || !L.compte) return {};
    const I = livretInterets(B);
    return { [L.compte]: { centimes: L.centimes, texte: I ? '≈ ' + KB().eur(I.centimes) + ' en ' + I.annee : 'taux à saisir (Épargne)' } };
  }

  // ------------------------------------------------------------ crypto (1.1) : positions saisies à la main
  // S.budget.crypto = { positions: [{ id, nom, investi, valeur, le }] } (centimes, date de la valeur) ; aucune
  // connexion extérieure. Rappel quand une valeur a plus de CRYPTO_JOURS jours.
  const CRYPTO_JOURS = 30;
  function crypto(B) {
    const L = ((B.S.budget && B.S.budget.crypto && B.S.budget.crypto.positions) || []).filter(p => isObj(p));
    const positions = L.map(p => {
      const age = p.le ? KB().dDiff(p.le, B.auj) : null;
      return Object.assign({}, p, { ecart: (p.valeur || 0) - (p.investi || 0), age, aJour: age != null && age <= CRYPTO_JOURS });
    });
    const investi = positions.reduce((t, p) => t + (p.investi || 0), 0), valeur = positions.reduce((t, p) => t + (p.valeur || 0), 0);
    return { positions, investi, valeur, ecart: valeur - investi, aMettreAJour: positions.filter(p => !p.aJour) };
  }
  const etatCrypto = S => JSON.stringify((S.budget && S.budget.crypto) || null);
  // pos : { id (absent : nouvelle), nom, investi, valeur, le } → état d'avant (annulation).
  function cryptoEnregistrer(S, pos) {
    const D = KB().donnees(S), avant = etatCrypto(S);
    if (!isObj(D.crypto) || !Array.isArray(D.crypto.positions)) D.crypto = { positions: [] };
    const p = { id: pos.id || 'k' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), nom: String(pos.nom || 'Position').trim().slice(0, 40) || 'Position',
      investi: Math.max(0, Math.round(+pos.investi || 0)), valeur: Math.max(0, Math.round(+pos.valeur || 0)), le: M().dateValide(pos.le) ? pos.le : M().jourLocal(Date.now()) };
    const i = D.crypto.positions.findIndex(x => x.id === p.id);
    if (i >= 0) D.crypto.positions[i] = p; else D.crypto.positions.push(p);
    return avant;
  }
  function cryptoRetirer(S, id) {
    const D = KB().donnees(S), avant = etatCrypto(S);
    if (isObj(D.crypto) && Array.isArray(D.crypto.positions)) D.crypto.positions = D.crypto.positions.filter(x => x.id !== id);
    return avant;
  }
  function annulerCrypto(S, avant) { const D = KB().donnees(S), o = JSON.parse(avant); if (o == null) delete D.crypto; else D.crypto = o; }

  g.KladFisc = { PARAMS, PS_FONC, PASS, HYP0, PART_RULES, importer, fiscDe, irCalc, netSal, foyerCalc, tauxIndiv, contexte, annee, partage, texte,
    regularisations, resteTexte, alertes, tfAnnee, tfPayee, alertesTF, taxeFonciere, pee, xirr, livret, livretInterets, livretCarte, pct1,
    CRYPTO_JOURS, crypto, cryptoEnregistrer, cryptoRetirer, annulerCrypto };
})(typeof window !== 'undefined' ? window : globalThis);
