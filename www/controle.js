// Klad — relevé de contrôle (format « klad-controle » v1) : les chiffres que Klad affiche, au centime, pour comparer
// automatiquement Klad et l'ancienne version (outil tools/controle, comparaison point par point).
// Fichier personnel (en clair) : comptes et chiffres du propriétaire, mais ni IBAN, ni clé, ni journal, ni identifiant
// bancaire. Montants en centimes (entiers), dates « AAAA-MM-JJ ». Format documenté dans tools/controle/README.md.
(function (g) {
  'use strict';

  const M = () => g.KladModele, K = () => g.KladClasse, KB = () => g.KladBudget, KC = () => g.KladCommun;
  const KF = () => g.KladFisc, KO = () => g.KladObservations, R = () => g.KladResume;
  const FORMAT = 'klad-controle', V = 1;
  const ent = v => (v == null || !isFinite(+v) ? null : Math.round(+v));
  const eur = v => (v == null || !isFinite(+v) ? null : Math.round(+v * 100));       // euros (module fiscal) → centimes
  const essai = f => { try { return f(); } catch (e) { return null; } };

  // Référence stable d'un compte : celle de la reprise de l'ancienne version (r0, r1…), sinon l'id Klad.
  function refs(S) {
    const map = (S.modele.reprise && S.modele.reprise.map) || {}, out = {};
    for (const r of Object.keys(map)) out[map[r]] = r;
    return id => out[id] || id;
  }
  // Id d'une opération comparable entre les deux versions : celui de la reprise (après « :x: »), sinon l'id Klad.
  const idOp = o => { const i = String(o.id).indexOf(':x:'); return i >= 0 ? String(o.id).slice(i + 3) : String(o.id); };

  // ------------------------------------------------------------ 1. comptes
  // Le livret suivi (solde estimé affiché sur sa carte) a la référence « livret », comme dans l'ancienne version.
  function comptes(S, B, now, ref) {
    const L = essai(() => KF() && KF().livret(B));
    return M().comptesTries(S).filter(c => !c.masque).map(c => {
      const s = M().soldeAffiche(S, c), d = c.role === 'carte_differee' ? K().dette(S, c, now) : null;
      if (L && L.compte === c.id) return { ref: 'livret', libelle: c.libelle, role: c.role, solde: L.centimes, date: L.depuis, dette: null, prelevement: null };
      return { ref: ref(c.id), libelle: c.libelle, role: c.role, solde: c.role === 'carte_differee' ? null : s ? s.centimes : null,
        date: s && c.role !== 'carte_differee' ? String(s.dateRef || s.lu || '').slice(0, 10) || null : null,
        dette: d ? d.centimes : null, prelevement: d && d.le ? d.le : null };
    });
  }

  // ------------------------------------------------------------ 2. reste à vivre
  const colonne = c => c && { base: ent(c.base), fixes: ent(c.fixes), marge: ent(c.marge), variable: ent(c.variable), reste: ent(c.reste) };
  function resteAVivre(B) {
    const r = KB().suivi(B, 'perso', null).rav;
    if (!r) return null;
    return { fin: r.fin, salaire: Object.assign(colonne(r.budget), { date: r.budget.date || null }), comptes: colonne(r.comptes) };
  }

  // ------------------------------------------------------------ 3. budget perso (cycle en cours et précédent)
  function cycle(B, nav) {
    const s = KB().suivi(B, 'perso', nav), p = s.per;
    const sec = k => ({ budget: ent(s.T[k].p), utilise: ent(s.T[k].c), reste: ent(s.T[k].p - s.T[k].c) });
    const postes = [];
    for (const k of ['fixe', 'courante', 'optionnelle']) for (const a of s.sections[k].lignes) postes.push({ cle: a.key, section: k, budget: ent(a.pm), utilise: ent(a.cur), reste: ent(a.pm - a.cur) });
    for (const a of s.horsBudget.lignes) postes.push({ cle: a.key, section: 'hors_budget', budget: 0, utilise: ent(a.cur), reste: ent(-a.cur) });
    return { debut: p.start, fin: p.end, salaire: p.cyc && p.cyc.src ? { date: p.cyc.src.date, montant: ent(p.cyc.src.m) } : null,
      revenus: { prevu: ent(s.revenus.p), recu: ent(s.revenus.c) },
      sections: { fixe: sec('fixe'), courante: sec('courante'), optionnelle: sec('optionnelle') }, horsBudget: ent(s.horsBudget.c),
      total: { budget: ent(s.total.P), utilise: ent(s.total.C), depassement: ent(s.total.OUT) }, postes: postes.sort((x, y) => (x.cle < y.cle ? -1 : 1)) };
  }
  function budget(B) {
    const p = KB().periode(B, 'perso', null);
    return { courant: cycle(B, null), precedent: p.prev ? cycle(B, p.prev) : null };
  }

  // ------------------------------------------------------------ 4. compte commun (mois en cours)
  function commun(B) {
    if (!KC()) return null;
    const MR = KC().margeReelle(B), F = KC().finDeMois(B), D = KC().plan(B), C = KC().tresorerie(B), W = KC().origine(B);
    if (!F) return null;
    return {
      mois: B.auj.slice(0, 7),
      marge: MR && { solde: ent(MR.solde), fixes: ent(MR.fixes), variable: ent(MR.variable), marge: ent(MR.marge) },
      finDeMois: { solde: ent(F.solde), aVenir: ent(F.due), attendus: ent(F.inc), reserve: ent(F.reserve), fin: ent(F.end) },
      virements: (D.recus || []).map(x => ({ qui: x.v.qui, attendu: ent(x.v.montant), recu: x.vu ? ent(x.vu.m) : null, date: x.vu ? x.vu.date : null })),
      aMettreEnPlace: (D.changes || []).map(x => ({ qui: x.qui, actuel: ent(x.have), demande: ent(x.want) })),
      ponctuel: { total: ent(D.pon), moi: ent(D.ponMoi), autre: ent(D.ponAutre) },
      tresorerie: C && { pointBas: ent(C.min), date: C.minAt, decouvert: C.negAt || null },
      origine: W && { debut: W.S, mois: W.n, soldeInitial: ent(W.B0), apports: ent(W.credits), attendu: ent(W.attendu), budget: ent(W.bud),
        postes: (W.items || []).map(x => ({ libelle: x.lab, montant: ent(x.e), sorte: x.sorte })) }
    };
  }

  // ------------------------------------------------------------ 5. équilibre des apports
  function equilibre(B) {
    const E = KC() && KC().equilibre(B);
    if (!E) return null;
    return { investi: { moi: ent(E.invMoi), autre: ent(E.invAutre) }, versements: { moi: ent(E.versMoi), autre: ent(E.versAutre) },
      equipements: { moi: ent(E.equipMoi), autre: ent(E.equipAutre) }, ecart: ent(Math.abs(E.ecart)),
      debiteur: Math.abs(E.ecart) < 50 ? null : E.ecart > 0 ? 'moi' : 'autre',                // qui doit encore investir plus que l'autre
      mensuel: { moi: ent(E.mensMoi), autre: ent(E.mensAutre) }, date: E.dateEquilibre || null };
  }

  // ------------------------------------------------------------ 6. contrats et échéances à 31 jours
  function contrats(B) {
    const liste = [];
    for (const sc of ['perso', 'commun']) for (const c of KB().contrats(B, sc)) liste.push({ perimetre: sc, libelle: c.label, poste: c.poste || null, montant: ent(c.montant), periodicite: +c.per || 1, prochaine: c.prochaine || null });
    return { liste, echeances31: KB().echeances(B, 31).map(e => ({ date: e.date, libelle: e.label, montant: ent(e.montant), sorte: e.sorte })) };
  }

  // ------------------------------------------------------------ 7. impôts, taxe foncière, livret, épargne salariale
  function impots(B) {
    if (!KF()) return null;
    const X = KF().contexte(B), Y = X.Y, annees = {};
    for (const y of [Y - 1, Y]) {
      const r = essai(() => KF().annee(X, y));
      if (!r) continue;
      const SH = essai(() => KF().partage(X, r));
      annees[y] = { sorte: r.kind, total: eur(r.total), paye: eur(r.paid), aVenir: eur(r.toCome || 0), solde: eur(r.solde),
        revenuImposable: eur(r.F && r.F.B ? r.F.B.rni : null), impotNet: eur(r.F ? r.F.irNet : null), prelevementsSociaux: eur(r.F ? r.F.ps : null),
        pas: { moi: eur(r.pas && r.pas.g), autre: eur(r.pas && r.pas.s) }, reste: SH ? { moi: eur(SH.rest.g), autre: eur(SH.rest.s) } : null };
    }
    const regul = (essai(() => KF().regularisations(X)) || []).map(r => ({ annee: r.y, sorte: r.kind, montant: r.kind === 'avis' ? eur(r.amt) : null,
      payeur: r.kind === 'avis' ? (r.done ? null : r.from === 'g' ? 'moi' : 'autre') : null, solde: r.kind === 'avis' ? null : eur(r.solde) }));
    const tf = {};
    for (const y of [Y, Y + 1]) { const t = essai(() => KF().tfAnnee(X, y)); if (t) tf[y] = { total: eur(t.total), base: eur(t.base) }; }
    const L = KF().livret(B), I = essai(() => KF().livretInterets(B)), P = essai(() => KF().pee(X));
    return { annee: Y, annees, regularisations: regul, taxeFonciere: tf,
      livret: L ? { solde: ent(L.centimes), date: L.depuis, interets: I ? ent(I.centimes) : null } : null,
      pee: P ? { encours: eur(P.val), verse: eur(P.perso), abondement: eur(P.ab), plusValue: eur(P.pv) } : null };
  }

  // ------------------------------------------------------------ 8. observations : code (titre sans chiffres) et montants
  const plier = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const code = t => plier(t).replace(/\d[\d\s.,  ]*/g, ' ').replace(/[^a-z]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  function montants(t) {
    const out = [], rx = /(\d[\d\s.  ]*(?:,\d{1,2})?)\s?€/g;
    let x;
    while ((x = rx.exec(String(t)))) { const v = +x[1].replace(/[\s.  ]/g, '').replace(',', '.'); if (isFinite(v)) out.push(Math.round(v * 100)); }
    return out;
  }
  function observations(B) {
    if (!KO()) return [];
    return KO().audit(B).map(a => ({ code: code(a.titre), niveau: a.niveau, perimetre: a.scope, titre: a.titre, chiffres: montants(a.titre + ' ' + (a.texte || '')) }))
      .sort((x, y) => (x.code < y.code ? -1 : x.code > y.code ? 1 : 0));
  }

  // ------------------------------------------------------------ 9. « À vérifier »
  function aVerifier(S, cx, now) {
    const a = K().attention(cx, now);
    const out = { nonVues: a.unseen, nonClassees: a.unclassified, aRapprocher: a.toMatch, comptesAVerifier: a.accountsToCheck };
    if (a.gaps) out.ecartsAVerifier = a.gaps;           // 1.1.1 : seulement s'il y en a (relevé inchangé sinon)
    return out;
  }
  // 1.1.1 : écarts de rapprochement à la main (montant prélevé ≠ montant de l'achat), comptés dans la catégorie de
  // l'achat. Absent du relevé quand il n'y en a pas.
  function ecarts(S, cx, ref) {
    const vis = new Set(M().comptesTries(S).filter(c => !c.masque).map(c => c.id));
    return K().ecarts(cx).filter(e => vis.has(e.banque.compte)).map(e => {
      const r = K().classer(cx, e.achat);
      return { date: e.banque.date, compte: ref(e.banque.compte), prelevement: idOp(e.banque), achat: idOp(e.achat), montantPreleve: -e.banque.montant,
        montantAchat: -e.achat.montant, ecart: e.ecart, categorie: r.cat, poste: r.sub, aVerifier: K().ecartAVerifier(e) };
    }).sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : x.prelevement < y.prelevement ? -1 : 1));
  }

  // ------------------------------------------------------------ 11. empreinte des données d'entrée
  function paquet(ops) {
    let deb = 0, cre = 0;
    for (const o of ops) { if (o.montant < 0) deb -= o.montant; else cre += o.montant; }
    return { nb: ops.length, debits: deb, credits: cre, ops: ops.map(o => [idOp(o), o.date, o.montant, o.libelle]).sort((x, y) => (x[1] < y[1] ? -1 : x[1] > y[1] ? 1 : x[0] < y[0] ? -1 : 1)) };
  }
  function empreinte(S, B, ref) {
    const vis = M().comptesTries(S).filter(c => !c.masque);
    const ops = c => S.ops[c.id] || [];          // en cours comprises, comme dans le budget
    const parCycle = cy => cy && { debut: cy.debut, fin: cy.fin,
      comptes: vis.map(c => Object.assign({ ref: ref(c.id) }, paquet(ops(c).filter(o => o.date >= cy.debut && o.date <= cy.fin)))) };
    const bu = budget(B), communs = vis.filter(c => c.role === 'commun'), mois = [];
    for (let k = 11; k >= 0; k--) {
      const m = KB().shift(B.auj.slice(0, 7), -k);
      const L = [];
      for (const c of communs) for (const o of ops(c)) if (o.date.slice(0, 7) === m) L.push(o);
      mois.push(Object.assign({ mois: m }, paquet(L)));
    }
    return { cycles: { courant: parCycle(bu.courant), precedent: parCycle(bu.precedent) }, commun: mois };
  }

  // ------------------------------------------------------------ relevé complet
  // ext : { version, resume (résumé Grafit tel qu'enregistré, ou null), grafitActif, extResume (contexte du résumé) }.
  function construire(S, B, cx, now, ext) {
    const x = ext || {}, ref = refs(S);
    const point = f => essai(f);
    const meta = { version: x.version || 'dev', genere: new Date(now).toISOString(), aujourdhui: B.auj,
      synchro: M().comptesTries(S).filter(c => !c.masque).map(c => ({ ref: ref(c.id), libelle: c.libelle, lu: c.source.type === 'eb' ? (c.sync && c.sync.lu) || null : null, source: c.source.type })),
      complement: !!(S.carnet && KB().racine(S.carnet) && KB().racine(S.carnet).klad), derniereSynchro: S.modele.sync.derniere || null,
      import: g.KladMigrations ? essai(() => g.KladMigrations.etatImport(S)) : null };
    const ec = point(() => ecarts(S, cx, ref));
    const out = {
      format: FORMAT, v: V, source: 'klad', meta,
      comptes: point(() => comptes(S, B, now, ref)),
      resteAVivre: point(() => resteAVivre(B)),
      budget: point(() => budget(B)),
      commun: point(() => commun(B)),
      equilibre: point(() => equilibre(B)),
      contrats: point(() => contrats(B)),
      impots: point(() => impots(B)),
      observations: point(() => observations(B)),
      aVerifier: point(() => aVerifier(S, cx, now)),
      // résumé Grafit : tel qu'enregistré pour Grafit (null si le lien est désactivé) et tel que calculé maintenant
      grafit: { actif: !!x.grafitActif, enregistre: x.resume == null ? null : x.resume, calcule: point(() => R().construire(S, now, x.extResume || { budget: B })) },
      empreinte: point(() => empreinte(S, B, ref))
    };
    if (ec && ec.length) out.ecartsRapprochement = ec;
    return out;
  }
  // Nom du fichier : klad-controle-AAAAMMJJ-HHMM.json (heure locale).
  function nomFichier(now) {
    const d = new Date(now), p = n => String(n).padStart(2, '0');
    return 'klad-controle-' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + '.json';
  }

  g.KladControle = { FORMAT, V, construire, nomFichier, code, montants, idOp };
})(typeof window !== 'undefined' ? window : globalThis);
