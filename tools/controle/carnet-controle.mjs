#!/usr/bin/env node
// Relevé de contrôle (klad-controle v1) calculé par l'ancienne version (Carnet) : la page d'origine est exécutée dans
// Chromium (Playwright) à une date figée, sur l'état et les imports fournis, puis ses propres fonctions de calcul sont
// interrogées. Aucun chiffre n'est recalculé ici, sauf la prochaine échéance des contrats (même règle que Klad) et les
// identifiants d'opérations (formule de la reprise). Ce dépôt ne contient aucune donnée : tout vient des fichiers passés
// en arguments.
//
// Usage : node tools/controle/carnet-controle.mjs --html carnet.html --etat state/main.json \
//           --imports imports/0-2026.json imports/1-2026.json … --date AAAA-MM-JJ [--sortie relevé.json]
import fs from 'node:fs';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

// ------------------------------------------------------------ arguments
export function lireArguments(argv) {
  const o = { imports: [] };
  let cle = null;
  for (const a of argv) {
    if (a.startsWith('--')) { cle = a.slice(2); if (cle !== 'imports') o[cle] = true; continue; }
    if (cle === 'imports') o.imports.push(a); else if (cle) { o[cle] = a; cle = null; }
  }
  if (typeof o.html !== 'string' || typeof o.etat !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(String(o.date))) {
    throw new Error('Usage : node carnet-controle.mjs --html <page.html> --etat <state/main.json> --imports <fichiers…> --date AAAA-MM-JJ [--sortie <fichier>]');
  }
  return o;
}

// ------------------------------------------------------------ crochets de lecture (texte d'origine → remplacement)
// Chaque texte doit exister une seule fois dans la page. Ils ne portent que sur le code, jamais sur des données.
export function crochets(TODAY) {
  return [
    ["const TODAY = new Date().toISOString().slice(0,10);", "const TODAY = '" + TODAY + "';"],
    ["function drawTrack(){\n  homeRuleBox(); setCols(true);", "function drawTrack(){\n  window.__G=[]; window.__RAV=null; homeRuleBox(); setCols(true);"],
    ["    grp.forEach(a=>{ if (a.debit===undefined && a.cur-a.pm>5) OVER.push([a, nk]);",
     "    grp.forEach(a=>window.__G.push({key:a.key, nat:nk, pm:a.pm, cur:a.cur}));\n    grp.forEach(a=>{ if (a.debit===undefined && a.cur-a.pm>5) OVER.push([a, nk]);"],
    ["  const P=T.fixe.p+T.courante.p+T.optionnelle.p, C=T.fixe.c+T.courante.c+T.optionnelle.c, OUT=T.fixe.out+T.courante.out+T.optionnelle.out, IN=C-OUT;",
     "  const P=T.fixe.p+T.courante.p+T.optionnelle.p, C=T.fixe.c+T.courante.c+T.optionnelle.c, OUT=T.fixe.out+T.courante.out+T.optionnelle.out, IN=C-OUT;\n  window.__TRK={T:JSON.parse(JSON.stringify(T)), RT:{p:RT.p,c:RT.c}, HB:HB.map(([a])=>a.key), cyc:cyc?{start:cyc.start,end:cyc.end}:null, pm0, P, C, OUT};"],
    ["      const mA=B.v-fixLeft, mA2=mA-varLeft, mB=sal-fixSp, mB2=mB-varSp;",
     "      const mA=B.v-fixLeft, mA2=mA-varLeft, mB=sal-fixSp, mB2=mB-varSp; window.__RAV={sal, salDate, B:B.v, fixSp, fixLeft, varSp, varLeft, mA, mA2, mB, mB2};"],
    ["function communCash(){",
     "window.__go=(sc,nav)=>{ scope=sc; NAV_M=nav; BMODE='suivi'; render(); return {trk:window.__TRK, G:window.__G, rav:window.__RAV}; };\n" +
     "window.__x=f=>eval(f);\n" +
     "function communCash(){"]
  ];
}
export function preparerPage(html, TODAY) {
  for (const [a, b] of crochets(TODAY)) {
    const n = html.split(a).length - 1;
    if (n !== 1) throw new Error('Page non reconnue (version de l\'ancienne appli ?) : repère trouvé ' + n + ' fois : « ' + a.slice(0, 50) + ' »');
    html = html.replace(a, () => b);
  }
  return html;
}

// Nom de la fonction de la page qui calcule la dette de la carte à débit différé : la dernière fonction déclarée avant
// son résultat caractéristique « since:dP » (pas de nom écrit ici). → nom ou null.
export function fonctionDette(html) {
  const i = html.indexOf('since:dP');
  if (i < 0) return null;
  const avant = html.slice(Math.max(0, i - 2000), i), rx = /function ([A-Za-z_$][\w$]*)\s*\(/g;
  let m, nom = null;
  while ((m = rx.exec(avant))) nom = m[1];
  return nom;
}

// ------------------------------------------------------------ lecture dans la page (chiffres de l'ancienne version, en euros)
const LECTURE = `(()=>{
  const out = {};
  // 1. comptes : relevés dédoublonnés (soldes), carte (dette), livret saisi
  out.bal = Object.values(balDedup()).filter(b=>b.acc>=0 && !/LIVRET/i.test(b.name||'')).map(b=>{ const m=balMain(b).m; return {acc:b.acc, at:b.at||null, a:m?m.a:null, d:m&&m.d?m.d:null}; });
  // dette de la carte à débit différé : fonction de la page repérée par son code (nom trouvé dans la page, __DETTE__)
  out.carte = (()=>{ try { if (!__DETTE__) return null; const x=eval(__DETTE__ + '()'); return {v:x.v, since:x.since||null}; } catch(e){ return null; } })();
  out.livret = (()=>{ const L=livretBal(); return L?{v:L.v, d:L.d}:null; })();
  // 3. cycles de salaire
  out.starts = salStarts().map(r=>({date:r.date, amount:r.amount}));
  // 4. compte commun
  { const C=communCash(), W=communWhy(), D=communPlanData(), m=TODAY.slice(0,7);
    const cb=balOf([2]).v; let due=0, inc=0;
    for (const c of CONTR.filter(c=>c.sc==='commun'&&(+c.per||1)===1&&c.amt>0)){ const d=lastDebit(c); if(!d||d.date.slice(0,7)!==m) due+=+c.amt; }
    for (const x of communTaxEv()) if (x.m===m) due+=-x.v;
    for (const v of VIRS) if(!virSeen(v,m)) inc+=+v.amt||0;
    const RS=communReserve();
    out.commun = { C:C&&{min:C.min,minAt:C.minAt,negAt:C.negAt||null}, W:W&&{S:W.S,n:W.n,B0:W.B0,credits:W.credits,attendu:W.attendu,bud:W.bud,items:W.items.map(x=>({lab:x.lab,e:x.e,kind:x.kind}))},
      D:{pon:D.pon,ponG:D.ponG,ponS:D.ponS,changes:D.changes.map(x=>({w:x.w,have:x.have,want:x.want}))},
      F:{cb,due,inc,rs:RS.v,end:cb-due+inc-RS.v},
      V:VIRS.map(v=>{ const s=virSeen(v,m); return {who:v.who, amt:+v.amt||0, seen:s?{date:s.date, amount:s.amount}:null}; }) }; }
  // 5. équilibre
  out.eq = (()=>{ try { const R=eqCompute(), ST=shareTotals(); return {invG:R.invG,invS:R.invS,versG:R.versG,versS:R.versS,equipG:R.equipG,equipS:R.equipS,mG:ST.eg,mS:ST.es}; } catch(e){ return null; } })();
  // 6. contrats
  out.contrats = CONTR.map(c=>{ const d=lastDebit(c); return {sc:c.sc, label:c.label, key:c.key||null, amt:+c.amt||0, per:+c.per||1, last:d?d.date:null}; });
  // 7. impôts, taxe foncière, épargne salariale
  out.fisc = (()=>{ try { const Y=TAXY(), years={};
    for (const y of [Y-1, Y]) { try { const R=fiscYear(y), SH=fiscShare(R); years[y]={kind:R.kind,total:R.total,paid:R.paid,toCome:R.toCome||0,solde:R.solde,rni:R.F.B.rni,irNet:R.F.irNet,ps:R.F.ps,pasG:R.pas.g,pasS:R.pas.s,restG:SH.rest.g,restS:SH.rest.s}; } catch(e){} }
    const tf={}; for (const y of [Y, Y+1]) { try { const R=tfYear(y); if (R) tf[y]={total:R.total, base:R.base}; } catch(e){} }
    let pee=null; try { const P=peeCalc(); if (P) pee={val:P.val, perso:P.perso, ab:P.ab, pv:P.pv}; } catch(e){}
    return {Y, years, tf, pee, regul:regulList().map(r=>({y:r.y,kind:r.kind,amt:r.amt,from:r.from,done:r.done,solde:r.solde}))}; } catch(e){ return null; } })();
  // 8. observations
  out.audit = audit().map(a=>({lvl:a[0], sc:a[1], t:a[2], p:a[3]||''}));
  // 9. « À vérifier » (comme Klad : sur tous les comptes)
  { const lim=addDays(TODAY,-90), nc=r=>r.sub==='Non classé'||r.sub==='Autres revenus'||r.cat==='Autres';
    out.av = {nonVues: ROWS.filter(r=>!isSeen(r)).length, nonClassees: ROWS.filter(r=>r.date>=lim && nc(r)).length}; }
  // 11. opérations (empreinte)
  out.rows = ROWS.map(r=>({date:r.date, acc:r.acc, amount:r.amount, label:r.label}));
  return out; })()`;

// ------------------------------------------------------------ conversion vers klad-controle v1
const c = v => (v == null || !isFinite(+v) ? null : Math.round(+v * 100));
const qui = w => (w === 'g' ? 'moi' : w === 's' ? 'autre' : null);
const plier = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const code = t => plier(t).replace(/\d[\d\s.,  ]*/g, ' ').replace(/[^a-z]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
export function montants(t) {
  const out = [], rx = /(\d[\d\s.  ]*(?:,\d{1,2})?)\s?€/g;
  let x;
  while ((x = rx.exec(String(t)))) { const v = +x[1].replace(/[\s.  ]/g, '').replace(',', '.'); if (isFinite(v)) out.push(Math.round(v * 100)); }
  return out;
}
const shift = (m, k) => { const d = new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7) - 1 + k, 1)); return d.toISOString().slice(0, 7); };
const joursMois = m => new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7), 0)).getUTCDate();
const avance = (d, per) => { const m = shift(d.slice(0, 7), per); return m + '-' + String(Math.min(+d.slice(8, 10), joursMois(m))).padStart(2, '0'); };

// Ids d'opérations de la reprise : 'k' + sha256(clé).hex[0..20] + '.' + rang parmi les lignes de même clé.
export function idsReprise(rows) {
  const rang = {};
  return rows.map(r => {
    const k = r.date + '|' + r.amount + '|' + r.acc + '|' + String(r.label).slice(0, 30);
    rang[k] = rang[k] || 0;
    return 'k' + crypto.createHash('sha256').update(k).digest('hex').slice(0, 20) + '.' + (rang[k]++);
  });
}
function paquet(L) {
  let deb = 0, cre = 0;
  for (const o of L) { if (o[2] < 0) deb -= o[2]; else cre += o[2]; }
  return { nb: L.length, debits: deb, credits: cre, ops: L.sort((x, y) => (x[1] < y[1] ? -1 : x[1] > y[1] ? 1 : x[0] < y[0] ? -1 : 1)) };
}

function cycle(o, starts) {
  if (!o || !o.trk) return null;
  const t = o.trk, cyc = t.cyc, sal = cyc && starts.find(s => s.date === cyc.start);
  const sec = k => ({ budget: c(t.T[k].p), utilise: c(t.T[k].c), reste: c(t.T[k].p - t.T[k].c) });
  const hb = new Set(t.HB || []);
  const postes = (o.G || []).map(g => ({ cle: g.key, section: hb.has(g.key) ? 'hors_budget' : g.nat, budget: hb.has(g.key) ? 0 : c(g.pm), utilise: c(g.cur), reste: hb.has(g.key) ? c(-g.cur) : c(g.pm - g.cur) }));
  const debut = cyc ? cyc.start : t.pm0 + '-01', fin = cyc ? cyc.end : t.pm0 + '-' + joursMois(t.pm0);
  return { debut, fin, salaire: sal ? { date: sal.date, montant: c(sal.amount) } : null, revenus: { prevu: c(t.RT.p), recu: c(t.RT.c) },
    sections: { fixe: sec('fixe'), courante: sec('courante'), optionnelle: sec('optionnelle') },
    horsBudget: c(postes.filter(p => p.section === 'hors_budget').reduce((s, p) => s + p.utilise / 100, 0)),
    total: { budget: c(t.P), utilise: c(t.C), depassement: c(t.OUT) }, postes: postes.sort((x, y) => (x.cle < y.cle ? -1 : 1)) };
}

export function convertir(L, enCours, precedent, communSuivi, TODAY, genere) {
  const starts = L.starts || [];
  const bu = { courant: cycle(enCours, starts), precedent: cycle(precedent, starts) };
  // comptes
  const comptes = (L.bal || []).sort((a, b) => a.acc - b.acc).map(b => b.acc === 3
    ? { ref: 'r' + b.acc, libelle: null, role: null, solde: null, date: null, dette: L.carte ? c(L.carte.v) : null, prelevement: null }
    : { ref: 'r' + b.acc, libelle: null, role: null, solde: c(b.a), date: (b.d || b.at || '').slice(0, 10) || null, dette: null, prelevement: null });
  if (!comptes.some(x => x.ref === 'r3') && L.carte) comptes.push({ ref: 'r3', libelle: null, role: null, solde: null, date: null, dette: c(L.carte.v), prelevement: null });
  if (L.livret) comptes.push({ ref: 'livret', libelle: null, role: 'epargne', solde: c(L.livret.v), date: L.livret.d, dette: null, prelevement: null });
  // reste à vivre
  const rv = enCours && enCours.rav;
  const resteAVivre = rv ? { fin: bu.courant ? bu.courant.fin : null,
    salaire: { base: c(rv.sal), fixes: c(rv.fixSp), marge: c(rv.mB), variable: c(rv.varSp), reste: c(rv.mB2), date: rv.salDate || null },
    comptes: rv.B == null ? null : { base: c(rv.B), fixes: c(rv.fixLeft), marge: c(rv.mA), variable: c(rv.varLeft), reste: c(rv.mA2) } } : null;
  // commun
  const K = L.commun, Tc = communSuivi && communSuivi.trk;
  const commun = K ? {
    mois: TODAY.slice(0, 7),
    marge: Tc ? { solde: c(K.F.cb), fixes: c(Tc.T.fixe.left), variable: c(Tc.T.courante.left + Tc.T.optionnelle.left), marge: c(K.F.cb - Tc.T.fixe.left - Tc.T.courante.left - Tc.T.optionnelle.left) } : null,
    finDeMois: { solde: c(K.F.cb), aVenir: c(K.F.due), attendus: c(K.F.inc), reserve: c(K.F.rs), fin: c(K.F.end) },
    virements: K.V.map(v => ({ qui: qui(v.who), attendu: c(v.amt), recu: v.seen ? c(v.seen.amount) : null, date: v.seen ? v.seen.date : null })),
    aMettreEnPlace: K.D.changes.map(x => ({ qui: qui(x.w), actuel: c(x.have), demande: c(x.want) })),
    ponctuel: { total: c(K.D.pon), moi: c(K.D.ponG), autre: c(K.D.ponS) },
    tresorerie: K.C && { pointBas: c(K.C.min), date: K.C.minAt, decouvert: K.C.negAt || null },
    origine: K.W && { debut: K.W.S, mois: K.W.n, soldeInitial: c(K.W.B0), apports: c(K.W.credits), attendu: c(K.W.attendu), budget: c(K.W.bud),
      postes: K.W.items.map(x => ({ libelle: x.lab, montant: c(x.e), sorte: x.kind })) }
  } : null;
  // équilibre
  const E = L.eq;
  const equilibre = E ? { investi: { moi: c(E.invG), autre: c(E.invS) }, versements: { moi: c(E.versG), autre: c(E.versS) }, equipements: { moi: c(E.equipG), autre: c(E.equipS) },
    ecart: c(Math.abs(E.invS - E.invG)), debiteur: Math.abs(E.invS - E.invG) < 0.5 ? null : E.invS > E.invG ? 'moi' : 'autre', mensuel: { moi: c(E.mG), autre: c(E.mS) }, date: null } : null;
  // contrats
  const contrats = { liste: (L.contrats || []).map(k => {
    let p = null;
    if (k.last) { p = avance(k.last, k.per); for (let i = 0; i < 40 && p < TODAY; i++) p = avance(p, k.per); }
    return { perimetre: k.sc, libelle: k.label, poste: k.key, montant: c(k.amt), periodicite: k.per, prochaine: p };
  }), echeances31: null };
  // impôts
  const F = L.fisc;
  const impots = F ? { annee: F.Y,
    annees: Object.fromEntries(Object.entries(F.years).map(([y, r]) => [y, { sorte: r.kind, total: c(r.total), paye: c(r.paid), aVenir: c(r.toCome), solde: c(r.solde),
      revenuImposable: c(r.rni), impotNet: c(r.irNet), prelevementsSociaux: c(r.ps), pas: { moi: c(r.pasG), autre: c(r.pasS) }, reste: { moi: c(r.restG), autre: c(r.restS) } }])),
    regularisations: F.regul.map(r => ({ annee: r.y, sorte: r.kind, montant: r.kind === 'avis' ? c(r.amt) : null, payeur: r.kind === 'avis' ? (r.done ? null : qui(r.from)) : null, solde: r.kind === 'avis' ? null : c(r.solde) })),
    taxeFonciere: Object.fromEntries(Object.entries(F.tf).map(([y, t]) => [y, { total: c(t.total), base: c(t.base) }])),
    livret: L.livret ? { solde: c(L.livret.v), date: L.livret.d, interets: null } : null,
    pee: F.pee ? { encours: c(F.pee.val), verse: c(F.pee.perso), abondement: c(F.pee.ab), plusValue: c(F.pee.pv) } : null } : null;
  // observations
  const observations = (L.audit || []).map(a => ({ code: code(a.t), niveau: a.lvl, perimetre: a.sc, titre: a.t, chiffres: montants(a.t + ' ' + a.p) }))
    .sort((x, y) => (x.code < y.code ? -1 : x.code > y.code ? 1 : 0));
  // empreinte
  const rows = L.rows || [], ids = idsReprise(rows);
  const ops = rows.map((r, i) => [ids[i], r.date, Math.round(r.amount * 100), r.label, r.acc]);
  const accs = [...new Set(rows.map(r => r.acc))].sort((a, b) => a - b);
  const parCycle = cy => cy && { debut: cy.debut, fin: cy.fin, comptes: accs.map(a => Object.assign({ ref: 'r' + a },
    paquet(ops.filter(o => o[4] === a && o[1] >= cy.debut && o[1] <= cy.fin).map(o => o.slice(0, 4))))) };
  const mois = [];
  for (let k = 11; k >= 0; k--) { const m = shift(TODAY.slice(0, 7), -k); mois.push(Object.assign({ mois: m }, paquet(ops.filter(o => o[4] === 2 && o[1].slice(0, 7) === m).map(o => o.slice(0, 4))))); }
  return {
    format: 'klad-controle', v: 1, source: 'carnet',
    meta: { version: 'ancienne version', genere, aujourdhui: TODAY, synchro: [], complement: null, derniereSynchro: null },
    comptes, resteAVivre, budget: bu, commun, equilibre, contrats, impots, observations,
    aVerifier: L.av ? { nonVues: L.av.nonVues, nonClassees: L.av.nonClassees, aRapprocher: null, comptesAVerifier: null } : null,
    grafit: null,
    empreinte: { cycles: { courant: parCycle(bu.courant), precedent: parCycle(bu.precedent) }, commun: mois }
  };
}

// ------------------------------------------------------------ exécution
export async function releveCarnet(o) {
  const { chromium } = createRequire(import.meta.url)('playwright');
  const html = preparerPage(fs.readFileSync(o.html, 'utf8'), o.date);
  const ST = JSON.parse(fs.readFileSync(o.etat, 'utf8'));
  let imported = [];
  for (const f of o.imports) { const j = JSON.parse(fs.readFileSync(f, 'utf8')); imported = imported.concat(Array.isArray(j) ? j : j.rows || []); }
  const ls = {};
  for (const k of Object.keys(ST)) if (k !== 'ts') ls['carnet.' + k] = JSON.stringify(ST[k]);
  ls['carnet.imported'] = JSON.stringify(imported);
  ls['carnet.ts'] = JSON.stringify(ST.ts || {});
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    const erreurs = [];
    page.on('pageerror', e => erreurs.push(String(e)));
    await page.addInitScript(l => { try { localStorage.clear(); for (const k of Object.keys(l)) localStorage.setItem(k, l[k]); } catch (e) { /* stockage indisponible */ } window.claude = undefined; }, ls);
    // aucune requête vers l'extérieur : seule la page locale est servie
    await page.route('**/*', r => (r.request().url().startsWith('http://carnet.local/') ? r.fulfill({ contentType: 'text/html; charset=utf-8', body: html }) : r.abort()));
    await page.goto('http://carnet.local/');
    await page.waitForFunction(() => typeof window.__go === 'function', null, { timeout: 30000 });
    const L = await page.evaluate(src => window.__x(src), LECTURE.replace(/__DETTE__/g, JSON.stringify(fonctionDette(html))));
    const enCours = await page.evaluate(() => window.__go('perso', null));
    const st = L.starts.map(s => s.date), cur = enCours.trk && enCours.trk.cyc ? enCours.trk.cyc.start : null;
    const i = cur ? st.indexOf(cur) : -1;
    const precedent = i > 0 ? await page.evaluate(d => window.__go('perso', d), st[i - 1]) : null;
    const communSuivi = await page.evaluate(() => window.__go('commun', null));
    return { releve: convertir(L, enCours, precedent, communSuivi, o.date, new Date().toISOString()), erreurs };
  } finally { await browser.close(); }
}

if (import.meta.url === 'file://' + process.argv[1]) {
  try {
    const o = lireArguments(process.argv.slice(2));
    const { releve, erreurs } = await releveCarnet(o);
    const txt = JSON.stringify(releve, null, 1);
    if (typeof o.sortie === 'string') { fs.writeFileSync(o.sortie, txt); console.log('Relevé de l\'ancienne version écrit : ' + o.sortie); } else process.stdout.write(txt + '\n');
    if (erreurs.length) console.error('Attention : ' + erreurs.length + ' erreur(s) dans la page de l\'ancienne version.');
  } catch (e) { console.error(e.message || e); process.exit(1); }
}
