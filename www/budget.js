// Klad — budget par cycle, reste à vivre, contrats et échéances, tendance (Lot 6). Calculs identiques à l'ancienne
// version (suivi du budget, cycle de salaire, reste à vivre), sur les opérations classées par KladClasse.
// Fonctions pures, testées dans node (test/budget.test.mjs). Montants en centimes entiers (débit < 0 dans les opérations ;
// les postes, budgets et consommations sont des valeurs positives).
//
// Aucun nom d'employeur, de personne ou de banque dans ce fichier : critères du salaire, noms des apports au compte
// commun, contrats et budgets sont des données (carnet de l'ancienne version, complément privé, ou réglages de Klad),
// gardées dans les blocs chiffrés « budget » et « carnet ».
//
// Périmètres : « perso » = comptes courants, cartes à débit différé et paiements en ligne ; « commun » = compte commun.
// Postes : « f|<sous-catégorie> » pour une charge fixe, « c|<catégorie> » pour une dépense courante ou optionnelle,
// « r|<catégorie> » pour un revenu attendu, « m|<libellé> » pour un poste saisi à la main.
(function (g) {
  'use strict';

  const M = () => g.KladModele;
  const K = () => g.KladClasse;
  const V = 1;
  const PER = [1, 3, 4, 12];
  const NATS = ['fixe', 'courante', 'optionnelle'];
  const NOMS = { fixe: 'Charges fixes', courante: 'Dépenses courantes', optionnelle: 'Dépenses optionnelles', revenu: 'Revenus' };
  const APPORTS = 'Apports compte commun';             // catégorie des apports au compte commun (format de l'ancienne version)
  const CONTRIBUTION = 'Contribution compte commun';   // poste perso lié à ma part du budget commun (par défaut)
  const PERSO = ['courant', 'carte_differee', 'paiement_en_ligne'];
  const EURO = 100, DEMI = 50;

  const isObj = o => o != null && typeof o === 'object' && !Array.isArray(o);
  const plusJours = (d, n) => M().plusJours(d, n);
  const dDiff = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 864e5);
  function shift(m, k) {
    const y = +m.slice(0, 4), mm = +m.slice(5, 7) - 1 + k;
    const yy = y + Math.floor(mm / 12), m2 = ((mm % 12) + 12) % 12;
    return yy + '-' + String(m2 + 1).padStart(2, '0');
  }
  const finMois = m => m + '-' + String(new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7), 0)).getUTCDate()).padStart(2, '0');
  const joursMois = m => +finMois(m).slice(8, 10);
  const median = a => { const v = a.slice().sort((x, y) => x - y), k = v.length >> 1; return v.length ? (v.length % 2 ? v[k] : (v[k - 1] + v[k]) / 2) : 0; };
  const arrEuro = c => Math.round(c / EURO) * EURO;               // arrondi à l'euro (comme l'ancienne version)
  const fold = s => K().fold(s);

  // ------------------------------------------------------------ données (bloc chiffré « budget »)
  // { v, plan: { perso, commun, foyer }, ref, revprev, contrats, virements, exc: { id: true }, reglages, import }
  function nouveau() { return { v: V, plan: { perso: {}, commun: {} }, ref: null, revprev: {}, contrats: [], virements: [], exc: {} }; }
  const donnees = S => S.budget || (S.budget = nouveau());

  // Racine des réglages du carnet (le carnet lui-même ou son objet « state »).
  const racine = c => !isObj(c) ? null : isObj(c.state) ? Object.assign({}, c.state, c) : c;

  // Poste du carnet (montants en euros) → poste Klad (centimes).
  function posteDepuisCarnet(p) {
    if (!isObj(p)) return null;
    const o = {};
    if (p.on === false) o.on = false; else if (p.on === true) o.on = true;
    if (p.hidden) o.hidden = true;
    const n = v => v != null && v !== '' && isFinite(+v) ? Math.round(+v * 100) : null;
    if (n(p.amt) != null) o.amt = Math.max(0, n(p.amt));
    if ([3, 4, 12].indexOf(+p.per) >= 0) { o.per = +p.per; if (n(p.ech) != null) o.ech = Math.max(0, n(p.ech)); }
    if (p.mode === 'moy3' || p.mode === 'dernier' || p.mode === 'libre') o.mode = p.mode;
    if (p.pg != null && isFinite(+p.pg)) o.pg = Math.min(100, Math.max(0, +p.pg));
    if (p.elig != null) o.elig = !!p.elig;
    if (typeof p.f === 'string' && p.f.length < 80) o.f = p.f;
    return o;
  }

  // Données figées de l'ancienne version (P, payload ou _payload ; voir KladCarnet.payload).
  const payload = st => (g.KladCarnet && g.KladCarnet.payload ? g.KladCarnet.payload(st) : {});

  // Ancien format (« budgets » et « fixedPrefs » sans « bplan ») : même conversion que l'ancienne version, budgets par
  // défaut du payload quand le carnet n'en a pas.
  function migrerAncien(st) {
    const P = payload(st);
    const out = {}, fp = isObj(st.fixedPrefs) ? st.fixedPrefs : {}, bu = isObj(st.budgets) ? st.budgets : isObj(P.budgets) ? P.budgets : {};
    for (const sc of ['perso', 'commun', 'foyer']) {
      const o = out[sc] = {};
      for (const [s, x] of Object.entries(isObj(fp[sc]) ? fp[sc] : {})) o['f|' + s] = x && x.amt ? { on: x.on !== false, amt: x.amt } : { on: !x || x.on !== false };
      for (const [c, v] of Object.entries(isObj(bu[sc]) ? bu[sc] : {})) if (+v > 0) o['c|' + c] = { on: true, amt: +v };
    }
    return out;
  }

  // Postes et revenu prévu du carnet, convertis (centimes, catégories renommées). → { plan, postes, revprev }.
  function planCarnet(st, renommer) {
    const bplan = isObj(st.bplan) ? st.bplan : migrerAncien(st);
    const plan = {};
    let postes = 0;
    for (const sc of ['perso', 'commun', 'foyer']) {
      if (!isObj(bplan[sc])) continue;
      const o = plan[sc] = {};
      for (const k of Object.keys(bplan[sc])) {
        if (k[1] !== '|' || 'fcrm'.indexOf(k[0]) < 0) continue;
        const p = posteDepuisCarnet(bplan[sc][k]);
        if (!p) continue;
        const nk = k[0] === 'c' || k[0] === 'r' ? k[0] + '|' + renommer(k.slice(2)) : k;
        o[nk] = Object.assign(o[nk] || {}, p);
        postes++;
      }
    }
    const revprev = {}, rp = isObj(st.revprev) ? st.revprev : payload(st).revenuPrevu;
    if (isObj(rp)) for (const k of Object.keys(rp)) if (isFinite(+rp[k])) revprev[k] = Math.round(+rp[k] * 100);
    return { plan, postes, revprev };
  }

  // Import du budget, des contrats et des virements du carnet. Les catégories renommées suivent les renommages du
  // classement. renommer(cat) → nom actuel. → rapport { postes, contrats, virements }.
  function importer(S, carnet, opts) {
    const st = racine(carnet);
    if (!st) throw new Error('Carnet absent.');
    const B = donnees(S);
    const pc = planCarnet(st, (opts && opts.renommer) || (c => c));
    const postes = pc.postes;
    B.plan = Object.assign({ perso: {}, commun: {} }, pc.plan);
    B.ref = typeof st.budgetRef === 'string' && /^\d{4}-\d{2}$/.test(st.budgetRef) ? st.budgetRef : null;
    B.revprev = pc.revprev;
    const map = (S.modele.reprise && S.modele.reprise.map) || {};
    B.contrats = (Array.isArray(st.contrats) ? st.contrats : []).filter(isObj).map((c, i) => ({
      id: String(c.id || 'c' + i).slice(0, 20), sc: c.sc === 'commun' ? 'commun' : 'perso', label: String(c.label || 'Contrat').slice(0, 80),
      montant: Math.max(0, Math.round((+c.amt || 0) * 100)), per: PER.indexOf(+c.per) >= 0 ? +c.per : 1, motif: String(c.kw || '').slice(0, 200),
      poste: typeof c.key === 'string' ? c.key : '', src: String(c.src || '').slice(0, 120), note: String(c.note || '').slice(0, 200)
    }));
    B.virements = (Array.isArray(st.virements) ? st.virements : []).filter(isObj).map((v, i) => ({
      id: String(v.id || 'v' + i).slice(0, 20), qui: v.who === 's' ? 'autre' : 'moi', montant: Math.max(0, Math.round((+v.amt || 0) * 100)),
      jour: Math.min(31, Math.max(1, +v.day || 1)), usage: String(v.use || 'fixes').slice(0, 20), label: String(v.label || '').slice(0, 80),
      depuis: String(v.from || '').slice(0, 60)
    }));
    void map;
    B.import = { le: new Date(opts && opts.now != null ? opts.now : Date.now()).toISOString(), postes, contrats: B.contrats.length, virements: B.virements.length };
    return B.import;
  }

  // Complément effectif (1.0) : complément importé (extension « klad » du carnet) < réglages du complément saisis dans
  // Klad (S.modele.reglages.complement : une clé présente remplace celle du complément ; null la retire). Sans réglage
  // saisi, le complément tel quel (aucun calcul ne change).
  function surcharger(S, klad) {
    const C = isObj(klad) ? klad : {};
    const O = S && S.modele && isObj(S.modele.reglages) && isObj(S.modele.reglages.complement) ? S.modele.reglages.complement : null;
    if (!O || !Object.keys(O).length) return C;
    const R = Object.assign({}, C);
    for (const k of Object.keys(O)) { if (O[k] === null) delete R[k]; else R[k] = O[k]; }
    return R;
  }
  function complement(S) {
    const st = S && S.carnet ? racine(S.carnet) : null;
    return surcharger(S, st && isObj(st.klad) ? st.klad : null);
  }

  // Réglages : ceux de Klad, sinon ceux du complément / carnet (extension « klad »).
  // 1.0 : cycle « salaire » (défaut) ou « mois » civil ; part de « moi » par défaut des postes du commun (50 %).
  function reglages(S) {
    const B = S.budget || {};
    const X = complement(S);
    const r = Object.assign({}, isObj(X.salaire) ? X.salaire : {}, isObj(B.reglages) && isObj(B.reglages.salaire) ? B.reglages.salaire : {});
    const c = Object.assign({}, isObj(X.commun) ? X.commun : {}, isObj(B.reglages) && isObj(B.reglages.commun) ? B.reglages.commun : {});
    const map = (S.modele.reprise && S.modele.reprise.map) || {};
    const cpt = typeof r.compte === 'string' ? (map[r.compte] || r.compte) : null;
    return {
      salaire: {
        compte: cpt && M().compte(S, cpt) ? cpt : null,
        motifs: K().motifs(r.motif), paie: K().motifs(r.paie),
        min: isFinite(+r.min) && +r.min > 0 ? Math.round(+r.min * 100) : 0,
        minCycle: isFinite(+r.minCycle) && +r.minCycle > 0 ? Math.round(+r.minCycle * 100) : 0,
        ecart: isFinite(+r.ecart) && +r.ecart > 0 ? Math.round(+r.ecart) : 15
      },
      commun: {
        moi: typeof c.moi === 'string' && c.moi.trim() ? c.moi.trim() : null,
        autre: typeof c.autre === 'string' && c.autre.trim() ? c.autre.trim() : null,
        contribution: typeof c.contribution === 'string' && c.contribution.trim() ? c.contribution.trim() : CONTRIBUTION,
        part: c.part != null && c.part !== '' && isFinite(+c.part) ? Math.min(100, Math.max(0, +c.part)) : 50
      },
      cycle: isObj(B.reglages) && B.reglages.cycle === 'mois' ? 'mois' : 'salaire'
    };
  }

  // ------------------------------------------------------------ contexte (une fois par affichage)
  // Lignes : opérations des comptes visibles, classées, par date croissante.
  function contexte(S, now, cx) {
    cx = cx || K().contexte(S, now);
    const auj = M().jourLocal(now == null ? Date.now() : now);
    const comptes = M().comptesTries(S).filter(c => !c.masque);
    const role = {};
    for (const c of comptes) role[c.id] = c.role;
    const rows = [];
    const cover = {};
    for (const c of comptes) {
      for (const o of S.ops[c.id] || []) {
        const r = K().classer(cx, o);
        const dd = K().dateDepense(o);
        rows.push({ o, id: o.id, cid: c.id, role: c.role, date: o.date, od: dd || o.date, m: o.montant, label: o.libelle || '', type: r.type, cat: r.cat, sub: r.sub });
        const cv = cover[c.id] || (cover[c.id] = { min: o.date, max: o.date });
        if (o.date < cv.min) cv.min = o.date;
        if (o.date > cv.max) cv.max = o.date;
      }
    }
    rows.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
    const D = S.budget || nouveau();
    const B = { S, cx, now: now == null ? Date.now() : now, auj, comptes, role, rows, cover, D, R: reglages(S), memo: {} };
    B.exc = isObj(D.exc) ? D.exc : {};
    return B;
  }

  const estPerso = (B, r) => PERSO.indexOf(r.role) >= 0;
  const estCommun = (B, r) => r.role === 'commun';
  const dansScope = (B, sc, r) => sc === 'commun' ? estCommun(B, r) : estPerso(B, r);
  const natureDe = (B, cat) => K().natureDe(B.cx.C, cat);
  const cleDe = (B, r) => natureDe(B, r.cat) === 'fixe' ? 'f|' + r.sub : 'c|' + r.cat;
  const exclue = (B, r) => !!B.exc[r.id];
  const planDe = (B, sc) => (B.D.plan && isObj(B.D.plan[sc])) ? B.D.plan[sc] : {};

  // ------------------------------------------------------------ cycle de salaire
  function estSalaireRef(B, r) {
    const R = B.R.salaire;
    if (!R.motifs.length || r.m <= 0) return false;
    if (R.compte ? r.cid !== R.compte : !estPerso(B, r)) return false;
    const F = fold(r.label);
    if (!R.motifs.some(m => F.indexOf(m) >= 0)) return false;
    if (!R.paie.length && !R.min) return true;
    return (R.paie.length && R.paie.some(m => F.indexOf(m) >= 0)) || (R.min > 0 && r.m >= R.min);
  }
  const estSalaire = (B, r) => r.type === 'revenu' && r.cat === 'Salaire' && estPerso(B, r);

  // Cycle en cours : du dernier salaire reçu à la veille du même jour le mois suivant (prolongé jusqu'à aujourd'hui).
  function cycleCourant(B) {
    if ('cyc' in B.memo) return B.memo.cyc;
    if (B.R.cycle === 'mois') return (B.memo.cyc = null);
    let last = null;
    for (let i = B.rows.length - 1; i >= 0; i--) { const r = B.rows[i]; if (estSalaireRef(B, r)) { last = r; break; } }
    if (!last) for (let i = B.rows.length - 1; i >= 0; i--) { const r = B.rows[i]; if (estSalaire(B, r)) { last = r; break; } }
    let c = null;
    if (last) {
      const [y, m, d] = last.date.split('-').map(Number);
      const e = new Date(Date.UTC(y, m, d)); e.setUTCDate(e.getUTCDate() - 1);
      let end = e.toISOString().slice(0, 10);
      if (end < B.auj) end = B.auj;
      c = { start: last.date, end, src: last };
    }
    return (B.memo.cyc = c);
  }

  // Débuts de cycle : un salaire ouvre un cycle s'il arrive au moins « ecart » jours après le précédent.
  function debuts(B) {
    if (B.memo.debuts) return B.memo.debuts;
    if (B.R.cycle === 'mois') return (B.memo.debuts = []);
    const cur = cycleCourant(B), R = B.R.salaire;
    const sal = B.rows.filter(r => estSalaire(B, r) && r.m >= R.minCycle);
    const st = [];
    for (const r of sal) { if (cur && r.date >= cur.start) break; if (!st.length || r.date >= plusJours(st[st.length - 1].date, R.ecart)) st.push(r); }
    if (cur) { if (st.length && cur.start < plusJours(st[st.length - 1].date, R.ecart)) st.pop(); st.push(cur.src); }
    return (B.memo.debuts = st);
  }

  function cyclePasse(B, k) {
    if (!k) return null;
    const st = debuts(B);
    let i;
    if (k.length > 7) i = st.findIndex(r => r.date === k);
    else { i = -1; st.forEach((r, j) => { if (r.date.slice(0, 7) === k) i = j; }); if (i === st.length - 1) i = st.findIndex(r => r.date.slice(0, 7) === k); }
    if (i < 0 || i >= st.length - 1) return null;
    const end = plusJours(st[i + 1].date, -1);
    if (end >= B.auj) return null;
    return { start: st[i].date, end, src: st[i], past: true, prev: i > 0 ? st[i - 1].date : null, next: i + 2 < st.length ? st[i + 1].date : null };
  }

  const cycJours = c => dDiff(c.start, c.end) + 1;
  const moisMilieu = c => plusJours(c.start, Math.floor(cycJours(c) / 2)).slice(0, 7);
  const premierMois = B => B.rows.length ? B.rows[0].date.slice(0, 7) : B.auj.slice(0, 7);

  // Période affichée. nav : null (en cours), « AAAA-MM-JJ » (cycle commençant ce jour), « AAAA-MM » (mois).
  // → { scope, past, cyc, pm0, start, end, upto, prev, next, salaire (cycle de salaire ?) }
  function periode(B, scope, nav) {
    const k = 'per|' + scope + '|' + nav;
    if (B.memo[k]) return B.memo[k];
    const curM = B.auj.slice(0, 7);
    const isD = !!nav && nav.length > 7, past = !!nav && (isD || nav < curM);
    const cyc = scope === 'perso' ? (past ? cyclePasse(B, nav) : cycleCourant(B)) : null;
    const pm0 = !past ? curM : isD ? (cyc ? moisMilieu(cyc) : nav.slice(0, 7)) : nav;
    const start = cyc ? cyc.start : pm0 + '-01', end = cyc ? cyc.end : finMois(pm0), upto = past ? end : B.auj;
    const parCycle = scope === 'perso' && B.R.cycle !== 'mois' && (cyc || !past);
    let prev, next;
    if (parCycle) {
      const st = debuts(B);
      prev = past ? (cyc ? cyc.prev : null) : (st.length >= 2 ? st[st.length - 2].date : null);
      next = past && cyc ? cyc.next : null;
    } else {
      const curStart = scope === 'perso' && cycleCourant(B) ? cycleCourant(B).start.slice(0, 7) : curM;
      prev = past ? shift(pm0, -1) : shift(curStart, -1);
      next = past ? shift(pm0, 1) : null;
      if (next && next >= curStart) next = 'courant';
    }
    if (prev && prev.slice(0, 7) < premierMois(B)) prev = null;
    if (past && !next) next = 'courant';
    return (B.memo[k] = { scope, past, cyc, pm0, start, end, upto, prev, next, salaire: !!cyc });
  }

  // ------------------------------------------------------------ fenêtre de référence et postes
  function dernierMoisComplet(B) {
    const ds = B.comptes.filter(c => c.role === 'courant' || c.role === 'commun').map(c => B.cover[c.id] && B.cover[c.id].max).filter(Boolean).sort();
    const d = ds[0] || B.auj;
    const m = d.slice(0, 7);
    return +d.slice(8, 10) >= joursMois(m) - 1 ? m : shift(m, -1);
  }
  function fenetre(B) {
    if (B.memo.W) return B.memo.W;
    const end = dernierMoisComplet(B);
    let start = B.D.ref || shift(end, -5);
    if (start > end) start = end;
    const months = [];
    for (let m = start; m <= end; m = shift(m, 1)) months.push(m);
    return (B.memo.W = { start, end, months });
  }

  // Postes d'un périmètre : réel habituel (fenêtre de référence), budget, périodicité, consommation du mois civil.
  function postes(B, sc) {
    const k = 'postes|' + sc;
    if (B.memo[k]) return B.memo[k];
    const W = fenetre(B), n = Math.max(1, W.months.length), cur = B.auj.slice(0, 7), y12 = shift(W.end, -11);
    const plan = planDe(B, sc), agg = {};
    const LINK = 'f|' + B.R.commun.contribution;
    for (const r of B.rows) {
      if (r.type !== 'depense' || !dansScope(B, sc, r) || exclue(B, r)) continue;
      const m = r.od.slice(0, 7), inRef = m >= W.start && m <= W.end, inCur = m === cur, in12 = m >= y12 && m <= W.end;
      if (!inRef && !inCur && !in12) continue;
      const nat = natureDe(B, r.cat), key = nat === 'fixe' ? 'f|' + r.sub : 'c|' + r.cat, v = -r.m;
      const a = agg[key] || (agg[key] = { key, nat, label: nat === 'fixe' ? r.sub : r.cat, cat: r.cat, ref: 0, cur: 0, y12: 0, mon: {}, m12: {} });
      if (in12) { a.y12 += v; a.m12[m] = (a.m12[m] || 0) + v; }
      if (inRef) { a.ref += v; a.mon[m] = (a.mon[m] || 0) + v; }
      if (inCur) a.cur += v;
    }
    for (const key of Object.keys(plan)) {
      if (key[1] !== '|' || agg[key] || key[0] === 'r') continue;
      const t = key[0], l = key.slice(2);
      agg[key] = { key, nat: t === 'f' ? 'fixe' : t === 'm' ? 'courante' : natureDe(B, l), label: l, cat: t === 'c' ? l : '', ref: 0, cur: 0, y12: 0, mon: {}, m12: {}, manuel: t === 'm' };
    }
    const lignes = Object.values(agg).map(a => {
      const p = plan[a.key];
      a.hidden = !!(p && p.hidden);
      a.per = p && [3, 4, 12].indexOf(+p.per) >= 0 ? +p.per : 1;
      a.mean = a.ref / n;
      if (a.per > 1) { a.avg = a.y12 / 12; a.calcul = 'douze'; }
      else if (a.nat === 'fixe' || a.manuel) { a.avg = a.mean; a.calcul = 'moyenne'; }
      else { a.avg = median(W.months.map(m => a.mon[m] || 0)); a.calcul = 'mediane'; }
      a.on = p ? p.on !== false : (a.nat === 'fixe' ? a.avg > DEMI : true);
      a.set = !!(p && p.amt != null);
      a.amt = Math.max(0, a.set ? +p.amt : arrEuro(a.avg));
      a.ech = a.per > 1 ? (p && p.ech != null ? +p.ech : Math.round(a.amt * a.per / EURO) * EURO) : a.amt;
      if (sc === 'perso' && a.key === LINK) { a.lie = true; a.per = 1; a.set = true; a.amt = a.ech = Math.round(parts(B).moi); }
      return a;
    }).filter(a => a.avg > DEMI || a.cur > DEMI || plan[a.key]);
    return (B.memo[k] = { W, n, cur, plan, lignes });
  }

  // Répartition du compte commun : ma part (pourcentage « pg » de chaque poste) et celle de l'autre personne.
  function partDe(B, key) { const p = planDe(B, 'commun')[key] || {}; return { pg: p.pg != null ? +p.pg : B.R.commun.part, elig: !!p.elig }; }
  function parts(B) {
    if (B.memo.parts) return B.memo.parts;
    const t = { moi: 0, autre: 0, eqMoi: 0, eqAutre: 0, neMontant: 0, neMoi: 0 };
    for (const a of postes(B, 'commun').lignes) {
      if (!a.on) continue;
      const { pg, elig } = partDe(B, a.key), amt = Math.max(0, a.amt), m = amt * pg / 100, s = amt - m;
      t.moi += m; t.autre += s;
      if (elig) { t.eqMoi += m; t.eqAutre += s; } else { t.neMontant += amt; t.neMoi += m; }
    }
    t.rNE = t.neMontant ? t.neMoi / t.neMontant : 0.5;
    return (B.memo.parts = t);
  }

  // ------------------------------------------------------------ revenus attendus (perso)
  function stats(B) {
    if (B.memo.stats) return B.memo.stats;
    const parM = {};
    let last = null;
    for (const r of B.rows) { if (!estSalaire(B, r)) continue; parM[r.date.slice(0, 7)] = (parM[r.date.slice(0, 7)] || 0) + r.m; if (!last || r.date >= last.date) last = r; }
    const ms = Object.keys(parM).sort().slice(-3);
    return (B.memo.stats = { last, avg3: ms.length ? ms.reduce((t, m) => t + parM[m], 0) / ms.length : 0, n3: ms.length });
  }
  const MODES_SALAIRE = { moy3: 'moyenne des 3 derniers', dernier: 'dernier salaire', libre: 'montant libre' };
  function revenusAttendus(B) {
    if (B.memo.rev) return B.memo.rev;
    const W = fenetre(B), cur = B.auj.slice(0, 7), pl = planDe(B, 'perso'), mon = {}, curS = {};
    for (const r of B.rows) {
      if (r.type !== 'revenu' || !estPerso(B, r) || r.cat === APPORTS) continue;
      const m = r.date.slice(0, 7);
      if (m >= W.start && m <= W.end) (mon[r.cat] = mon[r.cat] || {})[m] = ((mon[r.cat] || {})[m] || 0) + r.m;
      if (m === cur) curS[r.cat] = (curS[r.cat] || 0) + r.m;
    }
    const cats = new Set(['Salaire', 'Autres revenus']);
    Object.keys(pl).filter(k => k.startsWith('r|') && pl[k] && (pl[k].amt != null || pl[k].on)).forEach(k => cats.add(k.slice(2)));
    const St = stats(B);
    const out = [...cats].filter(c => natureDe(B, c) === 'revenu').map(c => {
      const p = pl['r|' + c];
      const avg = median(W.months.map(m => (mon[c] || {})[m] || 0));
      if (c === 'Salaire') {
        const mode = (p && p.mode) || 'moy3';
        const amt = mode === 'libre' ? (p && p.amt != null ? +p.amt : arrEuro(St.avg3)) : mode === 'dernier' ? arrEuro(St.last ? St.last.m : 0) : arrEuro(St.avg3);
        return { cat: c, avg, cur: curS[c] || 0, set: mode === 'libre' && !!(p && p.amt != null), amt, on: p ? p.on !== false : true, mode, sal: St };
      }
      const set = !!(p && p.amt != null);
      return { cat: c, avg, cur: curS[c] || 0, set, amt: set ? +p.amt : 0, on: p ? p.on !== false : true, libre: true };
    }).sort((a, b) => (a.cat === 'Salaire' ? -1 : b.cat === 'Salaire' ? 1 : 0) || a.cat.localeCompare(b.cat, 'fr'));
    return (B.memo.rev = out);
  }

  // ------------------------------------------------------------ contrats
  function dernierDebit(B, c) {
    const mots = K().motifs(c.motif);
    if (!mots.length) return null;
    for (let i = B.rows.length - 1; i >= 0; i--) {
      const r = B.rows[i];
      if (r.m < 0 && dansScope(B, c.sc, r) && mots.some(m => fold(r.label).indexOf(m) >= 0)) return r;
    }
    return null;
  }
  const contratsDe = (B, key, sc) => (B.D.contrats || []).filter(c => c.sc === sc && c.poste === key);

  // Jour du mois attendu pour un poste fixe (plus grosse opération des 100 derniers jours, sinon la dernière, sinon le
  // dernier prélèvement d'un contrat du poste). Contribution au commun : jour de mes virements permanents.
  function jourAttendu(B, sc, key, cur) {
    if (sc === 'perso' && key === 'f|' + B.R.commun.contribution) {
      const d = (B.D.virements || []).filter(v => v.qui === 'moi').map(v => +v.jour || 1);
      if (d.length) return Math.min(...d);
    }
    const lim = plusJours(B.auj, -100);
    let best = null;
    for (let i = B.rows.length - 1; i >= 0; i--) {
      const r = B.rows[i];
      if (r.date < lim) break;
      if (r.type !== 'depense' || !dansScope(B, sc, r) || r.date.slice(0, 7) >= cur) continue;
      if (cleDe(B, r) === key && (!best || -r.m > -best.m)) best = r;
    }
    if (best) return +best.date.slice(8, 10);
    for (let i = B.rows.length - 1; i >= 0; i--) {
      const r = B.rows[i];
      if (r.type !== 'depense' || !dansScope(B, sc, r) || r.date.slice(0, 7) >= cur) continue;
      if (cleDe(B, r) === key) return +r.date.slice(8, 10);
    }
    const c = contratsDe(B, key, sc)[0];
    if (c) { const d = dernierDebit(B, c); if (d) return +d.date.slice(8, 10); }
    return null;
  }

  // Commun : dernière échéance d'un poste non mensuel, mois de la prochaine (trimestres civils pour per = 3).
  function dernierDebitPoste(B, key) {
    for (let i = B.rows.length - 1; i >= 0; i--) { const r = B.rows[i]; if (estCommun(B, r) && r.type === 'depense' && cleDe(B, r) === key && r.date <= B.auj) return r; }
    return null;
  }
  function moisProchaineEcheance(B, key, per, ech) {
    const cur = B.auj.slice(0, 7), l = dernierDebitPoste(B, key), lm = l ? l.od.slice(0, 7) : null;
    const due = m => per === 3 ? (+m.slice(5) - 1) % 3 === 0 : lm ? ((+m.slice(0, 4) * 12 + +m.slice(5)) - (+lm.slice(0, 4) * 12 + +lm.slice(5))) % per === 0 : m === cur;
    if (!l) { let m = cur; for (let i = 0; i < 24 && !due(m); i++) m = shift(m, 1); return m; }
    const k = ech > 0 ? Math.max(1, Math.round(-l.m / ech)) : 1;
    let ld = lm;
    for (let i = 0; i < 24 && !due(ld); i++) ld = shift(ld, -1);
    return shift(ld, per * k);
  }
  function reserveCommun(B) {
    let v = 0;
    const det = [];
    for (const a of postes(B, 'commun').lignes) {
      if (!a.on || !(a.per > 1)) continue;
      const l = dernierDebitPoste(B, a.key), m0 = l ? l.od.slice(0, 7) : null;
      let n = m0 ? 0 : 1;
      if (m0) { let m = m0; while (m < B.auj.slice(0, 7)) { m = shift(m, 1); n++; } n = Math.max(0, n - 1); }
      n = Math.min(n, a.per);
      const r = a.amt * n;
      if (r > DEMI) { v += r; det.push({ label: a.label, montant: r }); }
    }
    return { v, det };
  }

  // ------------------------------------------------------------ suivi du cycle (sections, états, totaux, solde)
  // → { per, revenus: { lignes, p, c }, sections: { fixe, courante, optionnelle } (lignes, p, c, left, out, proj),
  //     horsBudget: { lignes, c, proj }, total: { P, C, IN, OUT }, solde, causes, depasses, rav, jour, nbJours }
  function suivi(B, scope, nav) {
    const k = 'suivi|' + scope + '|' + nav;
    if (B.memo[k]) return B.memo[k];
    const P0 = postes(B, scope);
    const per = periode(B, scope, nav), { past, cyc, pm0 } = per;
    const cur = P0.cur;
    const y = +pm0.slice(0, 4), mo = +pm0.slice(5, 7);
    const dim = cyc ? dDiff(cyc.start, cyc.end) + 1 : joursMois(pm0);
    const day = past ? dim : cyc ? Math.max(1, dDiff(cyc.start, B.auj) + 1) : Math.max(1, +B.auj.slice(8, 10));
    const frac = Math.min(1, day / dim);
    const inPer = d => cyc ? (d >= cyc.start && d <= (past ? cyc.end : B.auj)) : d.slice(0, 7) === pm0;
    const lignes = P0.lignes.map(a => Object.assign({}, a));
    const ops = {};
    for (const r of B.rows) {
      if (r.type !== 'depense' || !dansScope(B, scope, r) || exclue(B, r) || !inPer(r.od)) continue;
      const key = cleDe(B, r);
      (ops[key] || (ops[key] = [])).push(r);
    }
    if (cyc || past) {
      const cm = {};
      for (const key of Object.keys(ops)) cm[key] = ops[key].reduce((t, r) => t - r.m, 0);
      const vus = new Set(lignes.map(a => a.key));
      lignes.forEach(a => { a.cur = cm[a.key] || 0; });
      Object.keys(cm).forEach(key => {
        if (!vus.has(key) && cm[key] > DEMI) {
          const l = key.slice(2);
          lignes.push({ key, nat: key[0] === 'f' ? 'fixe' : natureDe(B, l), label: l, cat: key[0] === 'c' ? l : '', cur: cm[key], amt: 0, ech: 0, per: 1, on: false, avg: 0 });
        }
      });
    }
    const dueDate = ed => {
      if (!cyc) { const dd = Math.min(ed, dim); return { dd, mm: mo, iso: pm0 + '-' + String(dd).padStart(2, '0') }; }
      let sy = +cyc.start.slice(0, 4), sm = +cyc.start.slice(5, 7);
      if (ed < +cyc.start.slice(8, 10)) { sm++; if (sm > 12) { sm = 1; sy++; } }
      const last = new Date(Date.UTC(sy, sm, 0)).getUTCDate(), dd = Math.min(ed, last);
      return { dd, mm: sm, iso: sy + '-' + String(sm).padStart(2, '0') + '-' + String(dd).padStart(2, '0') };
    };
    // rythme habituel : dépenses des 90 jours précédant la période ÷ 90
    const pStart = cyc ? cyc.start : pm0 + '-01', hFrom = plusJours(pStart, -90), hTo = plusJours(pStart, -1), HR = {};
    for (const r of B.rows) { if (r.type !== 'depense' || !dansScope(B, scope, r) || exclue(B, r) || r.od < hFrom || r.od > hTo) continue; const key = cleDe(B, r); HR[key] = (HR[key] || 0) - r.m / 90; }
    const rest = Math.max(0, dim - day);

    // revenus
    const rv = {};
    for (const x of B.rows) {
      if (x.type !== 'revenu' || !inPer(x.date) || !dansScope(B, scope, x)) continue;
      const key = scope === 'commun' ? (x.sub || x.cat) : x.cat;
      (rv[key] = rv[key] || { got: 0, ops: [] }).got += x.m;
      rv[key].ops.push(x);
    }
    const exp = {};
    if (scope === 'commun') { const Pa = parts(B); if (B.R.commun.moi) exp[B.R.commun.moi] = Pa.moi; if (B.R.commun.autre) exp[B.R.commun.autre] = Pa.autre; }
    else revenusAttendus(B).forEach(x => { if (x.on && x.amt > 0) exp[x.cat] = x.amt; });
    Object.keys(exp).forEach(key => { if (!rv[key]) rv[key] = { got: 0, ops: [] }; });
    const revList = Object.entries(rv).map(([key, o]) => ({ key, got: o.got, ops: o.ops, pm: exp[key] || 0 }))
      .sort((a, b) => (b.pm - a.pm) || a.key.localeCompare(b.key, 'fr'));
    for (const x of revList) {
      if (x.pm > 0 && x.got >= x.pm - EURO) x.etat = null;
      else if (x.got > DEMI && x.pm > 0) x.etat = { niveau: 'warn', texte: 'en partie' };
      else if (x.pm > 0 && past) x.etat = { niveau: 'warn', texte: 'non reçu' };
      else if (x.pm > 0) {
        let dd = null;
        for (let i = B.rows.length - 1; i >= 0; i--) {
          const o = B.rows[i];
          if (o.type === 'revenu' && (scope === 'commun' ? (o.sub || o.cat) : o.cat) === x.key && (cyc ? o.date < cyc.start : o.date.slice(0, 7) < pm0) && dansScope(B, scope, o)) { dd = +o.date.slice(8, 10); break; }
        }
        x.etat = { niveau: 'info', texte: dd ? 'attendu vers le ' + jjmm(dueDate(dd)) : 'attendu' };
      }
    }
    const RT = { p: revList.reduce((t, x) => t + x.pm, 0), c: revList.reduce((t, x) => t + x.got, 0) };

    // état d'un poste ; exc : à signaler même section repliée
    const etatDe = (a, nk) => {
      let st, cls = '', exc = false;
      if (!a.on || (nk !== 'fixe' && a.pm <= DEMI)) { st = { niveau: 'info', texte: 'hors budget' }; cls = 'hb'; exc = true; }
      else if (a.debit !== undefined) {
        const nx = moisProchaineEcheance(B, a.key, a.per, a.ech), nxl = nx ? nomMois(nx < B.auj.slice(0, 7) ? B.auj.slice(0, 7) : nx) : '';
        st = a.debit > DEMI ? { niveau: a.debit > a.ech + EURO ? 'warn' : 'good', texte: 'payée ' + eur(a.debit) + (a.debit > a.ech + EURO ? ' · ' + Math.round(a.debit / a.ech) + ' échéances' : '') }
          : { niveau: 'info', texte: 'provision' + (nxl ? ' · ' + nxl : '') };
        cls = 'prov';
      } else if (nk === 'fixe') {
        if (a.per > 1 && a.pm === 0) st = { niveau: 'muted', texte: 'pas d\'échéance ce mois' };
        else if (a.cur > 0 && a.cur >= a.pm - Math.max(DEMI, Math.min(500, a.pm * 0.02))) {
          const lt = a.pm - a.cur;
          st = a.cur > a.pm + EURO ? { niveau: 'bad', texte: 'prélevé · ' + eur(a.cur - a.pm) + ' de plus' } : { niveau: 'good', texte: 'prélevé' + (lt > DEMI ? ' · ' + eur(lt) + ' de moins' : '') };
          cls = a.cur > a.pm + EURO ? 'over' : 'ok';
        } else if (a.cur > DEMI) { st = { niveau: 'warn', texte: 'en partie' }; cls = 'warn'; }
        else if (past) st = { niveau: 'warn', texte: 'non prélevé' };
        else {
          const ed = jourAttendu(B, scope, a.key, cyc ? '9999-99' : cur);
          if (ed) { const D = dueDate(ed), late = dDiff(D.iso, B.auj) > 2; st = { niveau: late ? 'warn' : 'info', texte: (late ? 'attendu le ' : 'à venir · le ') + jjmm(D), date: D.iso }; }
          else st = { niveau: 'info', texte: 'à venir' };
        }
      } else if (a.cur > a.pm + DEMI) { st = { niveau: 'bad', texte: 'dépassé' }; cls = 'over'; }
      else if (a.pm > DEMI && a.cur >= a.pm - DEMI) { st = { niveau: 'good', texte: 'conforme' }; cls = 'ok'; }
      else if (a.proj > a.pm * 1.05 + 500) { st = { niveau: 'warn', texte: 'à surveiller' }; cls = 'warn'; }
      else { st = { niveau: 'good', texte: 'conforme' }; cls = 'ok'; }
      if (nk === 'fixe' && (st.niveau === 'bad' || st.niveau === 'warn')) exc = true;
      return { etat: st, cls, exc };
    };
    // cause d'un dépassement (charges fixes, compte commun)
    const causeDe = (a, nk) => {
      if (nk !== 'fixe' && scope !== 'commun') return null;
      if (a.debit !== undefined) return null;
      const o = ops[a.key] || [], cs = contratsDe(B, a.key, scope).filter(c => (+c.per || 1) === 1), cm = cs.reduce((t, c) => t + c.montant, 0);
      const opsT = o.slice().reverse().slice(0, 3).map(x => eur(-x.m) + ' le ' + jjmm2(x.od)).join(', ');
      if (!a.on || a.pm <= DEMI) { if (a.cur <= DEMI) return null; return { texte: 'poste sans budget : ' + opsT, sorte: 'hb' }; }
      const over = a.cur - a.pm;
      if (over <= DEMI) return null;
      if (o.length > 1 && a.per === 1 && !(cm && Math.abs(a.cur - cm) < DEMI)) return { texte: o.length + ' prélèvements sur la période : ' + opsT + (cm ? ' (contrat ' + eur(cm) + ')' : ''), sorte: 'dbl' };
      if (cm && cm > a.pm + DEMI) return { texte: 'le contrat (' + eur(cm) + ') dépasse le budget (' + eur(a.pm) + ')', sorte: 'ctr', aligner: cm };
      if (cm && o.length === 1 && Math.abs(-o[0].m - cm) > DEMI) return { texte: 'prélevé ' + eur(-o[0].m) + ' au lieu de ' + eur(cm) + ' (contrat) : montant changé ?', sorte: 'chg', aligner: -o[0].m };
      return { texte: 'prélevé ' + eur(a.cur) + ' pour un budget de ' + eur(a.pm) + (cm ? '' : ' (aucun contrat enregistré)'), sorte: 'amt', aligner: Math.round(a.cur) };
    };

    const T = { fixe: { p: 0, c: 0, left: 0, proj: 0, out: 0 }, courante: { p: 0, c: 0, left: 0, proj: 0, out: 0 }, optionnelle: { p: 0, c: 0, left: 0, proj: 0, out: 0 } };
    const HB = [], OVER = [], CAUSES = [], sections = {};
    for (const nk of NATS) {
      const grp = lignes.filter(a => a.nat === nk && (a.on || a.cur > DEMI)).map(a => {
        const prov = scope === 'commun' && a.on && a.per > 1;
        const pm = !a.on ? 0 : prov ? a.amt : a.per > 1 ? (a.cur > DEMI ? a.ech : 0) : a.amt;
        const x = Object.assign({}, a);
        if (prov) { x.debit = a.cur; x.cur = a.amt; }
        const hr = Math.max(0, HR[a.key] || 0);
        x.pm = pm;
        x.proj = nk === 'fixe' ? Math.max(x.cur, pm) : past ? x.cur : x.cur + Math.max(0, Math.min(hr * rest, hr * dim - x.cur));
        x.left = pm - x.cur;
        x.ops = (ops[a.key] || []).slice().reverse();
        x.contrats = contratsDe(B, a.key, scope);
        return x;
      }).sort((a, b) => ((b.on ? 1 : 0) - (a.on ? 1 : 0)) || a.label.localeCompare(b.label, 'fr'));
      grp.forEach(a => {
        if (a.debit === undefined && a.cur - a.pm > 500) OVER.push(a);
        const hors = a.cur - Math.max(0, a.on ? a.pm : 0);
        if (a.debit === undefined && hors > DEMI) CAUSES.push({ a, v: hors, hb: !a.on || a.pm <= DEMI });
      });
      const t = T[nk];
      grp.forEach(a => { t.p += a.pm; t.c += a.cur; t.left += Math.max(0, a.left); t.out += Math.max(0, a.cur - Math.max(0, a.pm)); if (nk !== 'fixe') t.proj += Math.max(a.proj, a.cur); });
      const montre = [];
      for (const a of grp) {
        Object.assign(a, etatDe(a, nk));
        a.cause = causeDe(a, nk);
        if (nk !== 'fixe' && (!a.on || a.pm <= DEMI)) HB.push(a); else montre.push(a);
      }
      sections[nk] = { lignes: montre, p: montre.reduce((x, a) => x + a.pm, 0), c: montre.reduce((x, a) => x + a.cur, 0),
        proj: montre.reduce((x, a) => x + Math.max(a.proj, a.cur), 0), left: montre.reduce((x, a) => x + Math.max(0, a.left), 0),
        T: t, nbDepasses: montre.filter(a => a.cls === 'over').length, nbAVoir: montre.filter(a => a.cls !== 'over' && (a.exc || a.cls === 'warn')).length };
    }
    HB.sort((x, y) => y.cur - x.cur);
    const P = T.fixe.p + T.courante.p + T.optionnelle.p, C = T.fixe.c + T.courante.c + T.optionnelle.c;
    const OUT = T.fixe.out + T.courante.out + T.optionnelle.out, IN = C - OUT;
    const bal = RT.c - C, balP = RT.p - P;
    const Rp = Math.max(RT.c, RT.p), Dp = T.fixe.p + T.courante.proj + T.optionnelle.proj;
    const solde = { bal, balP, pj: Rp - Dp, ecart: bal - balP, revenus: RT.c, depenses: C };
    if (scope === 'commun' && !past) {
      const bc = soldes(B, ['commun']);
      if (bc) {
        solde.compte = bc.v;
        solde.variation = B.rows.filter(r => estCommun(B, r) && inPer(r.date)).reduce((t, r) => t + r.m, 0);
        solde.provisions = sections.fixe.lignes.concat(HB).filter(a => a.debit !== undefined).reduce((t, a) => t + (+a.amt || 0), 0);
      }
    }
    const res = { per, scope, revenus: { lignes: revList, p: RT.p, c: RT.c }, sections, horsBudget: { lignes: HB, c: HB.reduce((x, a) => x + a.cur, 0), proj: HB.reduce((x, a) => x + Math.max(a.proj, a.cur), 0) },
      total: { P, C, IN, OUT }, T, solde, causes: CAUSES.sort((x, y) => y.v - x.v), depasses: OVER.sort((x, y) => (y.cur - y.pm) - (x.cur - x.pm)),
      jour: day, nbJours: dim, frac };
    if (scope === 'perso' && !past) res.rav = resteAVivre(B, res, inPer);
    return (B.memo[k] = res);
  }

  // Soldes des comptes d'un rôle (comptes visibles avec un solde connu). → { v, n } ou null.
  function soldes(B, roles) {
    let v = 0, n = 0;
    for (const c of B.comptes) {
      if (roles.indexOf(c.role) < 0 || (c.devise || 'EUR') !== 'EUR') continue;
      const s = M().soldeAffiche(B.S, c);
      if (s) { v += s.centimes; n++; }
    }
    return n ? { v, n } : null;
  }

  // Reste à vivre (perso, cycle en cours) : deux colonnes.
  //   budget   : Base = salaire du cycle (sinon dernier salaire) − charges fixes prélevées = marge − variable dépensé ;
  //   comptes  : Base = soldes des comptes courants − charges fixes encore à venir = marge − reste du budget variable.
  function resteAVivre(B, res, inPer) {
    const T = res.T;
    const salRows = B.rows.filter(r => estSalaire(B, r) && inPer(r.date)), salGot = salRows.reduce((t, r) => t + r.m, 0);
    const St = stats(B);
    const sal = salGot > 0 ? salGot : (St.last ? St.last.m : 0), salDate = salGot > 0 ? salRows[salRows.length - 1].date : (St.last ? St.last.date : '');
    const fixSp = T.fixe.c, varSp = res.total.C - T.fixe.c;
    const fixLeft = T.fixe.left, varLeft = T.courante.left + T.optionnelle.left;
    const budget = { base: sal, fixes: fixSp, marge: sal - fixSp, variable: varSp, reste: sal - fixSp - varSp, date: salDate };
    const Bs = soldes(B, ['courant']);
    const comptes = Bs ? { base: Bs.v, fixes: fixLeft, marge: Bs.v - fixLeft, variable: varLeft, reste: Bs.v - fixLeft - varLeft } : null;
    return { budget, comptes, fin: res.per.end, base: comptes ? 'accounts' : 'budget', valeur: comptes ? comptes.reste : budget.reste };
  }

  // Base affichée du reste à vivre (0.10.7) : réglage du budget `reglages.rav`, « salaire » (par défaut, colonne
  // « dernier salaire ») ou « comptes » (colonne « comptes courants »). Aucun calcul : choix d'une des deux colonnes.
  const BASES_RAV = { salaire: 'Dernier salaire', comptes: 'Comptes courants' };
  function baseRav(S) { const r = S && S.budget && S.budget.reglages; return r && r.rav === 'comptes' ? 'comptes' : 'salaire'; }
  function choisirBaseRav(S, base) {
    const B = donnees(S);
    B.reglages = Object.assign({}, isObj(B.reglages) ? B.reglages : {}, { rav: base === 'comptes' ? 'comptes' : 'salaire' });
    return B.reglages.rav;
  }
  // → { choix ('salaire' | 'comptes'), col (colonne), autre (l'autre colonne ou null), base ('budget' | 'accounts') } ;
  // sans solde connu, la colonne « comptes courants » n'existe pas : « dernier salaire ».
  function ravChoisi(rav, base) {
    if (!rav) return null;
    if (base === 'comptes' && rav.comptes) return { choix: 'comptes', col: rav.comptes, autre: rav.budget, base: 'accounts' };
    return { choix: 'salaire', col: rav.budget, autre: rav.comptes, base: 'budget' };
  }

  // ------------------------------------------------------------ échéances à venir (31 jours)
  // Contrats (prochaine échéance après le dernier prélèvement), prélèvements récurrents détectés (hors contrats),
  // dette des cartes à débit différé au jour du prélèvement. → [{ date, montant (centimes > 0), label, sorte, scope }].
  function echeances(B, jours) {
    jours = jours || 31;
    const fin = plusJours(B.auj, jours), out = [];
    const ajoute = (date, montant, label, sorte, scope, poste) => { if (date >= B.auj && date <= fin && montant > DEMI) out.push({ date, montant: Math.round(montant), label, sorte, scope, poste: poste || null }); };
    const avance = (d, per) => { const m = shift(d.slice(0, 7), per); return m + '-' + String(Math.min(+d.slice(8, 10), joursMois(m))).padStart(2, '0'); };
    const motifsContrats = [];
    for (const c of B.D.contrats || []) {
      const mots = K().motifs(c.motif);
      motifsContrats.push(...mots.map(m => [c.sc, m]));
      if (!c.montant) continue;
      const d = dernierDebit(B, c);
      if (!d) continue;
      let n = avance(d.date, c.per || 1);
      for (let i = 0; i < 40 && n < B.auj; i++) n = avance(n, c.per || 1);
      ajoute(n, c.montant, c.label, 'contrat', c.sc, c.poste ? c.poste.slice(2) : null);
    }
    // récurrents : même compte, mêmes premiers mots, au moins 2 des 3 derniers mois, montants proches
    const debut = shift(B.auj.slice(0, 7), -3) + '-01', grp = {};
    for (const r of B.rows) {
      if (r.date < debut || r.m >= 0 || r.type !== 'depense' || !(r.role === 'courant' || r.role === 'commun')) continue;
      const kw = K().suggestKw(r.label);
      if (!kw) continue;
      const k = r.cid + '|' + kw;
      (grp[k] || (grp[k] = [])).push(r);
    }
    for (const k of Object.keys(grp)) {
      const L = grp[k], mois = new Set(L.map(r => r.date.slice(0, 7)));
      if (mois.size < 2 || L.length > mois.size + 1) continue;
      const mts = L.map(r => -r.m), md = median(mts);
      if (mts.some(v => Math.abs(v - md) > Math.max(500, md * 0.15))) continue;
      const last = L[L.length - 1], sc = last.role === 'commun' ? 'commun' : 'perso';
      if (motifsContrats.some(([s, m]) => s === sc && fold(last.label).indexOf(m) >= 0)) continue;
      const n = avance(last.date, 1);
      if (n < plusJours(B.auj, -3)) continue;
      ajoute(n < B.auj ? B.auj : n, md, natureDe(B, last.cat) === 'fixe' ? last.sub : last.cat, 'recurrent', sc);
    }
    for (const c of B.comptes) {
      if (c.role !== 'carte_differee' || (c.devise || 'EUR') !== 'EUR') continue;
      const d = K().dette(B.S, c, B.now);
      if (d && d.le) ajoute(d.le, d.centimes, c.libelle, 'carte', 'perso');
    }
    return out.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : b.montant - a.montant);
  }

  // Contrats d'un périmètre, avec le dernier prélèvement, l'écart au document et la prochaine échéance.
  function contrats(B, scope) {
    const lignes = postes(B, scope).lignes, parCle = {};
    lignes.forEach(a => { parCle[a.key] = a; });
    const avance = (d, per) => { const m = shift(d.slice(0, 7), per); return m + '-' + String(Math.min(+d.slice(8, 10), joursMois(m))).padStart(2, '0'); };
    return (B.D.contrats || []).filter(c => c.sc === scope).map(c => {
      const d = dernierDebit(B, c), a = parCle[c.poste];
      let etat;
      if (!d) etat = c.montant ? { niveau: 'warn', texte: 'non trouvé' } : { niveau: 'good', texte: 'aucun prélèvement' };
      else {
        const ecart = -d.m - c.montant, k = c.montant ? -d.m / c.montant : 0;
        if (Math.abs(ecart) < 1) etat = { niveau: 'good', texte: 'conforme' };
        else if (c.montant > 0 && Math.abs(k - Math.round(k)) < 0.0005 && Math.round(k) > 1) etat = { niveau: 'good', texte: Math.round(k) + ' échéances réglées ensemble' };
        else etat = { niveau: 'warn', texte: eur(Math.abs(ecart), true) + (ecart > 0 ? ' de plus' : ' de moins') };
      }
      let prochaine = null;
      if (d) { prochaine = avance(d.date, c.per || 1); for (let i = 0; i < 40 && prochaine < B.auj; i++) prochaine = avance(prochaine, c.per || 1); }
      return Object.assign({}, c, { mensuel: c.montant / (c.per || 1), dernier: d ? { date: d.date, montant: -d.m } : null, etat, prochaine,
        poste: c.poste, posteLabel: c.poste ? c.poste.slice(2) : '', budget: a ? (a.on ? a.amt : 0) : null });
    });
  }
  // Prévu du poste face au total mensuel de ses contrats (« Prévu vs document » de l'ancienne version).
  function contratsParPoste(B, scope) {
    const L = contrats(B, scope), out = [], vus = {};
    for (const c of L) {
      if (!c.poste) continue;
      let x = vus[c.poste];
      if (!x) { x = vus[c.poste] = { poste: c.poste, label: c.posteLabel, budget: c.budget, contrats: 0, n: 0 }; out.push(x); }
      x.contrats += c.mensuel; x.n++;
    }
    for (const x of out) {
      if (x.budget == null) x.etat = { niveau: 'warn', texte: 'poste absent' };
      else { const e = x.budget - x.contrats; x.etat = Math.abs(e) < DEMI ? { niveau: 'good', texte: 'aligné' } : { niveau: 'warn', texte: 'prévu ' + eur(Math.abs(e), true) + (e > 0 ? ' de plus' : ' de moins') }; }
    }
    return out;
  }

  // ------------------------------------------------------------ tendance (12 cycles)
  // Dépenses par cycle (ou par mois pour le commun), par nature, et pour une catégorie choisie (avec son budget).
  function tendance(B, scope, n, cat) {
    n = n || 12;
    const pers = [];
    if (scope === 'perso' && cycleCourant(B)) {
      const st = debuts(B);
      const cur = cycleCourant(B);
      for (let i = Math.max(0, st.length - n); i < st.length; i++) {
        const start = st[i].date, end = i + 1 < st.length ? plusJours(st[i + 1].date, -1) : cur.end;
        pers.push({ start, end, encours: i === st.length - 1 });
      }
    } else {
      const m0 = B.auj.slice(0, 7);
      for (let i = n - 1; i >= 0; i--) { const m = shift(m0, -i); pers.push({ start: m + '-01', end: finMois(m), encours: i === 0 }); }
    }
    const out = pers.map(p => ({ start: p.start, end: p.end, encours: p.encours, fixe: 0, courante: 0, optionnelle: 0, total: 0, cat: 0 }));
    for (const r of B.rows) {
      if (r.type !== 'depense' || !dansScope(B, scope, r) || exclue(B, r)) continue;
      const p = out.find(x => r.od >= x.start && r.od <= x.end);
      if (!p) continue;
      const v = -r.m, nat = natureDe(B, r.cat);
      p[nat] = (p[nat] || 0) + v; p.total += v;
      if (cat && r.cat === cat) p.cat += v;
    }
    let ref = null;
    if (cat) { const pl = planDe(B, scope)['c|' + cat]; ref = pl && pl.on !== false && +pl.amt > 0 ? +pl.amt : null; }
    const cats = [...new Set(B.rows.filter(r => r.type === 'depense' && dansScope(B, scope, r)).map(r => r.cat))].sort((a, b) => a.localeCompare(b, 'fr'));
    return { periodes: out, cat: cat || null, budget: ref, categories: cats, parCycle: scope === 'perso' && !!cycleCourant(B) };
  }

  // ------------------------------------------------------------ édition (annulable)
  // champs : { amt (centimes par échéance), per, on, mode (salaire) }. → instantané pour annuler.
  function modifier(S, scope, key, champs) {
    const D = donnees(S);
    const pl = D.plan[scope] || (D.plan[scope] = {});
    const snap = { scope, key, avant: pl[key] === undefined ? undefined : JSON.parse(JSON.stringify(pl[key])) };
    const p = Object.assign({ on: true }, pl[key]);
    delete p.f;
    if ('on' in champs) p.on = !!champs.on;
    if ('per' in champs || 'amt' in champs) {
      const per = 'per' in champs ? ([3, 4, 12].indexOf(+champs.per) >= 0 ? +champs.per : 1) : ([3, 4, 12].indexOf(+p.per) >= 0 ? +p.per : 1);
      const ech = 'amt' in champs ? champs.amt : (per > 1 ? (p.ech != null ? p.ech : (p.amt || 0) * per) : p.amt);
      if (ech == null) { delete p.amt; delete p.ech; }
      else { const e = Math.max(0, Math.round(ech)); p.amt = per > 1 ? Math.round(e / per) : e; if (per > 1) p.ech = e; else delete p.ech; }
      if (per > 1) p.per = per; else delete p.per;
    }
    if ('mode' in champs && MODES_SALAIRE[champs.mode]) p.mode = champs.mode;
    if ('pg' in champs) p.pg = Math.min(100, Math.max(0, +champs.pg || 0));
    if ('elig' in champs) p.elig = !!champs.elig;
    if (p.on) delete p.hidden;
    pl[key] = p;
    return snap;
  }
  // Ajout d'un poste (catégorie ou sous-catégorie existante, ou poste fixe nouveau).
  function ajouter(S, scope, key) { return modifier(S, scope, key, { on: true }); }
  // Retrait : le poste sort du budget (la catégorie est conservée) ; un poste saisi à la main est supprimé.
  function retirer(S, scope, key) {
    const D = donnees(S);
    const pl = D.plan[scope] || (D.plan[scope] = {});
    const snap = { scope, key, avant: pl[key] === undefined ? undefined : JSON.parse(JSON.stringify(pl[key])) };
    if (key[0] === 'm') delete pl[key]; else pl[key] = { on: false, hidden: true };
    return snap;
  }
  function annuler(S, snap) {
    const pl = donnees(S).plan[snap.scope] || (donnees(S).plan[snap.scope] = {});
    if (snap.avant === undefined) delete pl[snap.key]; else pl[snap.key] = snap.avant;
  }
  // ------------------------------------------------------------ contrats : saisie, retrait, report dans le budget
  // Instantané de la liste pour annuler.
  const snapContrats = S => JSON.stringify(donnees(S).contrats || []);
  // Poste deviné d'après le libellé du contrat (mots de 4 lettres ou plus communs avec le nom du poste), comme l'ancienne version.
  function devinerPoste(B, scope, label) {
    const w = fold(label).split(/[^A-Z0-9]+/).filter(x => x.length >= 4);
    let best = '', sc = 0;
    const keys = new Set(Object.keys(planDe(B, scope)).filter(k => k[1] === '|' && k[0] !== 'r').concat(postes(B, scope).lignes.map(a => a.key)));
    for (const k of keys) { const L = fold(k.slice(2)); const n = w.filter(x => L.indexOf(x) >= 0).length; if (n > sc) { sc = n; best = k; } }
    return best;
  }
  // c : { id?, sc, label, montant (centimes par échéance), per, motif, poste, src, note } ; poste '__nouveau' → poste fixe
  // créé au nom du contrat. → instantané (liste des contrats et plan du périmètre) pour annuler.
  function enregistrerContrat(S, B, c) {
    const D = donnees(S);
    const snap = { contrats: snapContrats(S), plan: JSON.stringify(D.plan || {}) };
    const sc = c.sc === 'commun' ? 'commun' : 'perso';
    const x = {
      id: c.id || 'u' + Date.now().toString(36), sc, label: String(c.label || 'Contrat').trim().slice(0, 80) || 'Contrat',
      montant: Math.max(0, Math.round(+c.montant || 0)), per: PER.indexOf(+c.per) >= 0 ? +c.per : 1, motif: String(c.motif || '').trim().slice(0, 200),
      poste: typeof c.poste === 'string' ? c.poste : '', src: String(c.src || '').trim().slice(0, 120), note: String(c.note || '').trim().slice(0, 200)
    };
    if (x.poste === '__nouveau') {
      x.poste = 'f|' + x.label.slice(0, 40);
      const pl = D.plan[sc] || (D.plan[sc] = {});
      pl[x.poste] = Object.assign({ on: true }, pl[x.poste]);
      delete pl[x.poste].hidden;
    } else if (!x.poste && B) x.poste = devinerPoste(B, sc, x.label);
    D.contrats = D.contrats || [];
    const i = D.contrats.findIndex(y => y.id === x.id);
    if (i >= 0) D.contrats[i] = Object.assign({}, D.contrats[i], x); else D.contrats.push(x);
    return snap;
  }
  function retirerContrat(S, id) {
    const D = donnees(S);
    const snap = { contrats: snapContrats(S), plan: JSON.stringify(D.plan || {}) };
    D.contrats = (D.contrats || []).filter(c => c.id !== id);
    return snap;
  }
  function annulerContrat(S, snap) { const D = donnees(S); D.contrats = JSON.parse(snap.contrats); D.plan = JSON.parse(snap.plan); }
  // « → prévu » : le budget du poste prend le total mensuel de ses contrats (un seul contrat non mensuel : son échéance
  // et sa périodicité). → instantané (annuler) et montant mensuel retenu.
  function versPrevu(S, scope, key) {
    const D = donnees(S);
    const cs = (D.contrats || []).filter(c => c.sc === scope && c.poste === key);
    const pl = D.plan[scope] || (D.plan[scope] = {});
    const snap = { scope, key, avant: pl[key] === undefined ? undefined : JSON.parse(JSON.stringify(pl[key])) };
    const p = Object.assign({ on: true }, pl[key]);
    if (cs.length === 1 && (+cs[0].per || 1) > 1) { p.per = +cs[0].per; p.ech = cs[0].montant; p.amt = Math.round(p.ech / p.per); }
    else { delete p.per; delete p.ech; p.amt = Math.round(cs.reduce((t, c) => t + c.montant / (+c.per || 1), 0)); }
    p.on = true; delete p.f; delete p.hidden;
    pl[key] = p;
    return { snap, amt: p.amt };
  }

  // ------------------------------------------------------------ base de calcul et alignement de tous les postes
  // Mois proposés comme début de la référence : du premier mois des données au dernier mois complet (récent d'abord).
  function moisReference(B) {
    const W = fenetre(B), out = [];
    for (let m = W.end, i = 0; m >= premierMois(B) && i < 120; m = shift(m, -1), i++) out.push(m);
    return out;
  }
  // m : 'AAAA-MM' ou null (6 derniers mois complets). → instantané (valeur précédente).
  function choisirReference(S, m) {
    const D = donnees(S), avant = D.ref || null;
    D.ref = typeof m === 'string' && /^\d{4}-\d{2}$/.test(m) ? m : null;
    return avant;
  }
  function annulerReference(S, avant) { donnees(S).ref = avant || null; }
  // « Tout aligner sur le réel habituel » : chaque poste retenu (hors poste lié au commun) prend son réel habituel,
  // arrondi à l'euro (échéance arrondie pour un poste non mensuel). → instantané du plan du périmètre.
  function alignerTout(S, B, scope) {
    const D = donnees(S);
    const pl = D.plan[scope] || (D.plan[scope] = {});
    const snap = JSON.stringify(pl);
    let n = 0;
    for (const a of postes(B, scope).lignes) {
      if (!a.on || a.lie || a.key[0] === 'r') continue;
      const p = pl[a.key] || { on: true };
      if (a.per > 1) { p.ech = arrEuro(a.avg * a.per); p.amt = Math.round(p.ech / a.per); }
      else p.amt = arrEuro(a.avg);
      pl[a.key] = p;
      n++;
    }
    return { snap, n };
  }
  function annulerAlignement(S, scope, snap) { donnees(S).plan[scope] = JSON.parse(snap); }

  // Postes qu'on peut ajouter à une section.
  function ajoutables(B, scope, nk) {
    const vus = new Set(postes(B, scope).lignes.filter(a => !a.hidden).map(a => a.key));
    if (nk === 'fixe') {
      return [...new Set(B.rows.filter(r => r.type === 'depense' && natureDe(B, r.cat) === 'fixe' && dansScope(B, scope, r)).map(r => r.sub))]
        .filter(x => x && !vus.has('f|' + x)).sort((a, b) => a.localeCompare(b, 'fr')).map(x => ({ key: 'f|' + x, label: x }));
    }
    return K().listeCategories(B.cx.C).filter(c => natureDe(B, c) === nk && K().typeDe(B.cx.C, c) === 'depense' && !vus.has('c|' + c)).map(c => ({ key: 'c|' + c, label: c }));
  }

  // ------------------------------------------------------------ textes (sans signe)
  const eur = (c, cents) => {
    const a = Math.abs(c) / 100;
    return (cents ? a.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : Math.round(a).toLocaleString('fr-FR')).replace(/[ \u00a0]/g, '\u202f') + '\u00a0€';
  };
  const jjmm = D => String(D.dd).padStart(2, '0') + '/' + String(D.mm).padStart(2, '0');
  const jjmm2 = iso => iso.slice(8, 10) + '/' + iso.slice(5, 7);
  const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const nomMois = m => MOIS[+m.slice(5, 7) - 1] + ' ' + m.slice(2, 4);


  // ------------------------------------------------------------ tendance par mois (comme l'ancienne version)
  // o : { comptes: 'auto' | 'perso' | 'commun' | 'foyer' | <id de compte>, scope (pour « auto »), from, to ('AAAA-MM'),
  //       mode: 'rd' | 'bal' | 'cum' | 'solde' | 'cat:<catégorie>' }.
  // Revenus et dépenses par mois (date d'enregistrement), virements internes, épargne et hors budget exclus ; « foyer » :
  // tous les comptes, ma contribution au commun et mes apports comptés une seule fois.
  // → { mois, rev, dep, bal, barres?, ligne?, ref?, categories, perimetre, compte? } (centimes).
  function tendanceMois(B, o) {
    const sel = o.comptes && o.comptes !== 'auto' ? o.comptes : (o.scope === 'commun' ? 'commun' : 'perso');
    const cpt = ['perso', 'commun', 'foyer'].indexOf(sel) < 0 ? B.comptes.find(c => c.id === sel) : null;
    const R = B.R.commun;
    const dans = r => {
      if (cpt) return r.cid === cpt.id;
      if (sel === 'commun') return estCommun(B, r);
      if (sel === 'perso') return estPerso(B, r);
      if (!estPerso(B, r) && !estCommun(B, r)) return false;
      if (r.sub === R.contribution) return false;
      if (r.cat === APPORTS && R.moi && r.sub === R.moi) return false;
      return true;
    };
    const mois = [];
    for (let m = o.from; m <= o.to && mois.length < 240; m = shift(m, 1)) mois.push(m);
    const idx = {}; mois.forEach((m, i) => { idx[m] = i; });
    const rev = mois.map(() => 0), dep = mois.map(() => 0);
    const cats = new Set();
    for (const r of B.rows) {
      if ((r.type !== 'revenu' && r.type !== 'depense') || !dans(r)) continue;
      if (r.type === 'depense') cats.add(r.cat);
      const i = idx[r.date.slice(0, 7)];
      if (i === undefined) continue;
      if (r.type === 'revenu') rev[i] += r.m; else dep[i] -= r.m;
    }
    const bal = mois.map((m, i) => rev[i] - dep[i]);
    const out = { mois, rev, dep, bal, categories: [...cats].filter(Boolean).sort((a, b) => a.localeCompare(b, 'fr')), perimetre: sel, compte: cpt ? cpt.libelle : null };
    const mode = o.mode || 'rd';
    if (mode === 'bal') out.barres = bal;
    else if (mode === 'cum') { let c = 0; out.ligne = bal.map(v => (c += v)); }
    else if (mode === 'solde') {
      // comptes du solde : le compte choisi, le commun, tous les comptes courants (foyer) ou le compte du salaire (perso)
      const L = cpt ? [cpt] : sel === 'commun' ? B.comptes.filter(c => c.role === 'commun')
        : sel === 'foyer' ? B.comptes.filter(c => c.role === 'courant' || c.role === 'commun' || c.role === 'paiement_en_ligne')
          : [B.comptes.find(c => c.id === B.R.salaire.compte) || B.comptes.find(c => c.role === 'courant')].filter(Boolean);
      let v = 0, n = 0;
      for (const c of L) { const s0 = M().soldeAffiche(B.S, c); if (s0) { v += s0.centimes; n++; } }
      out.soldeComptes = L.map(c => c.libelle);
      if (!n) out.ligne = null;
      else {
        const ids = new Set(L.map(c => c.id));
        const debut = L.map(c => (B.cover[c.id] || {}).min).filter(Boolean).sort().pop() || '0000';
        const apres = B.rows.filter(r => ids.has(r.cid));
        out.solde = v;
        out.ligne = mois.map(m => { const fin = finMois(m); if (fin < debut) return null; return v - apres.filter(r => r.date > fin).reduce((t, r) => t + r.m, 0); });
      }
    } else if (mode.startsWith('cat:')) {
      const cat = mode.slice(4);
      out.barres = mois.map(() => 0);
      for (const r of B.rows) { if (r.type !== 'depense' || r.cat !== cat || !dans(r)) continue; const i = idx[r.date.slice(0, 7)]; if (i !== undefined) out.barres[i] -= r.m; }
      const p = planDe(B, o.scope === 'commun' || sel === 'commun' ? 'commun' : 'perso')['c|' + cat];
      out.ref = p && p.on !== false && +p.amt > 0 ? Math.round(+p.amt) : null;       // budget du poste (centimes par mois)
      out.cat = cat;
    }
    return out;
  }

  // ------------------------------------------------------------ calculateur carburant (comme l'ancienne version)
  // Réglages : bloc budget (carburant), sinon réglage « fuel » du carnet, sinon valeurs génériques.
  const CARBURANT = { ar: 0, jours: 20, autres: 0, conso: 5.5, prix: 2 };
  function carburant(S) {
    const D = S.budget || {};
    const Rc = S.carnet ? racine(S.carnet) : null, X = Rc ? Rc.fuel : null;
    const src = isObj(D.carburant) ? D.carburant : isObj(X) ? X : {};
    const r = {};
    for (const k of Object.keys(CARBURANT)) r[k] = isFinite(+src[k]) && +src[k] >= 0 ? +src[k] : CARBURANT[k];
    return r;
  }
  // → { km (par mois), prevu (centimes par mois), reel: { mediane, moyenne, pleins } sur la base de calcul }.
  function calculCarburant(B, reglage) {
    const R = reglage || carburant(B.S), W = fenetre(B);
    const km = R.ar * R.jours + R.autres;
    const prevu = Math.round(km * R.conso / 100 * R.prix * 100);
    const mon = {};
    let pleins = 0;
    for (const r of B.rows) {
      if (r.type !== 'depense' || r.cat !== 'Carburant' || !estPerso(B, r) || exclue(B, r)) continue;
      const m = r.date.slice(0, 7);
      if (m < W.start || m > W.end) continue;
      mon[m] = (mon[m] || 0) - r.m;
      if (r.sub === 'Carburant') pleins++;
    }
    const vals = W.months.map(m => mon[m] || 0);
    return { km, prevu, reel: { mediane: median(vals), moyenne: vals.reduce((x, y) => x + y, 0) / Math.max(1, vals.length), pleins } };
  }
  function reglerCarburant(S, ch) {
    const D = donnees(S);
    const avant = isObj(D.carburant) ? JSON.stringify(D.carburant) : null;
    const r = carburant(S);
    for (const k of Object.keys(CARBURANT)) if (k in ch && isFinite(+ch[k]) && +ch[k] >= 0) r[k] = +ch[k];
    D.carburant = r;
    return avant;
  }
  function annulerCarburant(S, avant) { const D = donnees(S); if (avant == null) delete D.carburant; else D.carburant = JSON.parse(avant); }

  // Détail d'un poste sur la base de calcul (mode Budget) : charges fixes regroupées par montant, autres postes par
  // sous-catégorie. → [{ cle, ref, cur, n, noms }] (centimes).
  function detailPoste(B, sc, key) {
    const W = fenetre(B), cur = B.auj.slice(0, 7), out = {};
    for (const r of B.rows) {
      if (r.type !== 'depense' || !dansScope(B, sc, r) || exclue(B, r) || cleDe(B, r) !== key) continue;
      const m = r.od.slice(0, 7), inRef = m >= W.start && m <= W.end, inCur = m === cur;
      if (!inRef && !inCur) continue;
      const v = -r.m, fixe = key[0] === 'f';
      const k = fixe ? String(Math.round(v / 100)) : r.sub;
      const d = out[k] || (out[k] = { cle: k, ref: 0, cur: 0, n: 0, noms: {}, ex: r.label });
      if (inRef) { d.ref += v; d.n++; }
      if (inCur) d.cur += v;
      if (fixe) { const nm = K().suggestKw(r.label) || r.label.slice(0, 24); d.noms[nm] = (d.noms[nm] || 0) + 1; }
    }
    return Object.values(out).sort((x, y) => (y.ref - x.ref) || (y.cur - x.cur));
  }

  g.KladBudget = {
    V, PER, NATS, NOMS, APPORTS, CONTRIBUTION, MODES_SALAIRE, BASES_RAV, baseRav, choisirBaseRav, ravChoisi, nouveau, donnees, importer, reglages, contexte,
    complement, surcharger, cycleCourant, debuts, cyclePasse, periode, fenetre, postes, parts, partDe, revenusAttendus, stats, suivi, soldes,
    echeances, contrats, contratsParPoste, tendance, reserveCommun, moisProchaineEcheance, jourAttendu, modifier, ajouter, retirer, annuler, ajoutables,
    devinerPoste, enregistrerContrat, retirerContrat, annulerContrat, versPrevu, moisReference, choisirReference, annulerReference, alignerTout, annulerAlignement,
    shift, finMois, nomMois, eur, dernierDebit, tendanceMois, carburant, calculCarburant, reglerCarburant, annulerCarburant, detailPoste, CARBURANT, dernierDebitPoste, contratsDe, cleDe, natureDe, racine, plusJours, dDiff, median, planCarnet
  };
})(typeof window !== 'undefined' ? window : globalThis);
