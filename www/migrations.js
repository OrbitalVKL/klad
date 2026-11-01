// Klad — migrations des données déjà présentes dans le coffre, au déverrouillage.
//
// 0.9.3 « payload » : jusqu'à la 0.9.2, les données figées de l'ancienne version rangées sous « _payload » dans le
// fichier de reprise (règles de base, budgets par défaut, revenu prévu, mouvements et équipements de l'équilibre)
// n'étaient pas lues. On complète ce qui manque, sans rien demander au propriétaire et sans écraser ce qui a été
// modifié dans Klad :
//   - règles de base reprises du payload, catégories absentes ajoutées (catégories existantes inchangées) ;
//   - postes de budget absents ajoutés (un poste présent n'est pas touché), mois de revenu prévu absents ajoutés ;
//   - mouvements et équipements de l'équilibre : lus directement dans le carnet gardé chiffré (rien à copier) ;
//   - crédits de règlement des cartes et portefeuilles (motif « remboursements » de la fiche) retirés, comme
//     l'ancienne version les écartait à l'import.
// Idempotente (marque dans S.modele.migrations) et réversible : l'état d'avant est gardé (annulerPayload).
// Testé dans node (test/migrations.test.mjs), données fictives uniquement.
(function (g) {
  'use strict';

  const M = () => g.KladModele, CN = () => g.KladCarnet, KB = () => g.KladBudget;
  const isObj = o => o != null && typeof o === 'object' && !Array.isArray(o);
  const copie = o => (o === undefined ? undefined : JSON.parse(JSON.stringify(o)));
  const NOM = 'payload';

  // Données figées présentes dans le carnet → { rules, budgets, revenuPrevu, eqops, equip } (longueurs).
  function contenu(S) {
    const st = S && S.carnet != null ? CN().racine(S.carnet) : null;
    const P = st ? CN().payload(st) : {};
    const n = v => (Array.isArray(v) ? v.length : isObj(v) ? Object.keys(v).length : 0);
    return { rules: n(P.rules), budgets: n(P.budgets), revenuPrevu: n(P.revenuPrevu), eqops: n(P.eqops), equip: n(P.equip) };
  }

  const faite = S => !!(S && S.modele && isObj(S.modele.migrations) && S.modele.migrations[NOM]);

  // → rapport { base, categories, postes, revprev, eqops, equip, ecartees, change } ou null (rien à faire / déjà faite).
  async function payload(S, now) {
    if (!S || S.carnet == null || faite(S)) return null;
    const st = CN().racine(S.carnet);
    if (!st) return null;
    const P = CN().payload(st);
    const cx = contenu(S);
    const r = { base: 0, categories: 0, postes: 0, revprev: 0, eqops: cx.eqops, equip: cx.equip, ecartees: 0, change: false };
    const avant = {
      classement: S.classement ? { base: copie(S.classement.base), categories: copie(S.classement.categories), import: copie(S.classement.import) } : null,
      prelevements: {}, plan: S.budget ? copie(S.budget.plan) : undefined, revprev: S.budget ? copie(S.budget.revprev) : undefined, ecartees: []
    };
    for (const c of S.modele.comptes) avant.prelevements[c.id] = copie(c.prelevement);

    // règles de base et catégories manquantes (le classement complet a déjà été repris : on ne touche qu'à la base)
    if (S.classement && Array.isArray(P.rules) && P.rules.length) {
      const nb = (S.classement.base || []).length;
      const x = await CN().convertir(S, S.carnet, { now, seulementBase: true });
      r.base = x.base; r.categories = x.categories;
      if (x.base !== nb || x.categories) r.change = true;
    }

    // postes de budget et revenu prévu absents
    if (S.budget) {
      const pc = KB().planCarnet(st, CN().renommeur(S.carnet));
      const D = S.budget;
      D.plan = isObj(D.plan) ? D.plan : {};
      for (const sc of Object.keys(pc.plan)) {
        const o = D.plan[sc] = isObj(D.plan[sc]) ? D.plan[sc] : {};
        for (const k of Object.keys(pc.plan[sc])) if (!(k in o)) { o[k] = pc.plan[sc][k]; r.postes++; }
      }
      D.revprev = isObj(D.revprev) ? D.revprev : {};
      for (const k of Object.keys(pc.revprev)) if (!(k in D.revprev)) { D.revprev[k] = pc.revprev[k]; r.revprev++; }
      if (r.postes || r.revprev) r.change = true;
    }

    // crédits de règlement des cartes et portefeuilles
    for (const c of S.modele.comptes) {
      const list = S.ops[c.id];
      if (!list) continue;
      for (let i = list.length - 1; i >= 0; i--) {
        if (!M().creditDeReglement(c, list[i])) continue;
        avant.ecartees.push({ compte: c.id, i, op: list[i] });
        list.splice(i, 1);
        r.ecartees++;
      }
    }
    if (r.ecartees) r.change = true;

    S.modele.migrations = isObj(S.modele.migrations) ? S.modele.migrations : {};
    S.modele.migrations[NOM] = { le: new Date(now == null ? Date.now() : now).toISOString(), rapport: Object.assign({}, r), avant: r.change ? avant : null };
    return r;
  }

  // Retour à l'état d'avant la migration (la marque est retirée : la migration se refera au prochain déverrouillage).
  function annulerPayload(S) {
    const m = faite(S) ? S.modele.migrations[NOM] : null;
    if (!m) return false;
    const a = m.avant;
    if (a) {
      if (a.classement && S.classement) {
        S.classement.base = a.classement.base;
        S.classement.categories = a.classement.categories;
        if (a.classement.import === undefined) delete S.classement.import; else S.classement.import = a.classement.import;
      }
      for (const c of S.modele.comptes) if (c.id in a.prelevements) {
        if (a.prelevements[c.id] === undefined) delete c.prelevement; else c.prelevement = a.prelevements[c.id];
      }
      if (S.budget) { if (a.plan !== undefined) S.budget.plan = a.plan; if (a.revprev !== undefined) S.budget.revprev = a.revprev; }
      for (const e of a.ecartees.slice().reverse()) {          // remises à leur place (retirées de la fin vers le début)
        const list = M().opsDe(S, e.compte);
        if (!list.some(o => o.id === e.op.id)) list.splice(Math.min(e.i, list.length), 0, e.op);
      }
    }
    delete S.modele.migrations[NOM];
    return true;
  }

  // 0.10.7 « icones » : chaque catégorie reçoit une icône. Celles qui n'en ont pas (rien d'enregistré, ou la lettre de
  // repli) reçoivent celle que la banque propose d'après leur nom ; les icônes déjà présentes (reprises de l'ancienne
  // version ou choisies) ne changent pas. Idempotente, réversible (annulerIcones). → { n, noms } ou null.
  const ICONES = 'icones';
  function icones(S, now) {
    const I = g.KladIcones;
    if (!S || !S.classement || !isObj(S.classement.categories) || !I || !I.liste().length) return null;
    if (isObj(S.modele.migrations) && S.modele.migrations[ICONES]) return null;
    const C = S.classement, avant = {}, noms = [];
    for (const n of Object.keys(C.categories)) {
      const c = C.categories[n];
      if (!isObj(c) || !I.absente(c.icone) || (g.KladClasse && g.KladClasse.CATEGORIES[n] && c.icone == null)) continue;
      avant[n] = c.icone === undefined ? null : c.icone;
      c.icone = I.proposer(n);
      noms.push(n);
    }
    S.modele.migrations = isObj(S.modele.migrations) ? S.modele.migrations : {};
    S.modele.migrations[ICONES] = { le: new Date(now == null ? Date.now() : now).toISOString(), n: noms.length, avant };
    return { n: noms.length, noms };
  }
  function annulerIcones(S) {
    const m = S && isObj(S.modele.migrations) ? S.modele.migrations[ICONES] : null;
    if (!m) return false;
    const C = S.classement;
    if (C && isObj(C.categories)) for (const n of Object.keys(m.avant || {})) {
      if (!isObj(C.categories[n])) continue;
      if (m.avant[n] == null) delete C.categories[n].icone; else C.categories[n].icone = m.avant[n];
    }
    delete S.modele.migrations[ICONES];
    return true;
  }

  // 0.10.9 « dessins » : tout en icônes dessinées. Chaque catégorie dont l'icône n'est pas une icône de la banque (émoji
  // d'office ou repris, icône reprise « svg:<nom> », rien, lettre de repli) reçoit l'icône Lucide la plus proche
  // (KladIcones.versDessin) ; la couleur de la pastille ne change pas (réglage à part). En une seule fois, idempotente,
  // réversible (annulerDessins). → { n, noms } ou null.
  const DESSINS = 'dessins';
  function dessins(S, now) {
    const I = g.KladIcones;
    if (!S || !S.classement || !isObj(S.classement.categories) || !I || !I.liste().length) return null;
    if (isObj(S.modele.migrations) && S.modele.migrations[DESSINS]) return null;
    const C = S.classement, avant = {}, noms = [];
    for (const n of Object.keys(C.categories)) {
      const c = C.categories[n];
      if (!isObj(c) || I.dessinee(c.icone)) continue;
      avant[n] = c.icone === undefined ? null : c.icone;
      c.icone = I.versDessin(c.icone, n);
      noms.push(n);
    }
    S.modele.migrations = isObj(S.modele.migrations) ? S.modele.migrations : {};
    S.modele.migrations[DESSINS] = { le: new Date(now == null ? Date.now() : now).toISOString(), n: noms.length, avant };
    return { n: noms.length, noms };
  }
  function annulerDessins(S) {
    const m = S && isObj(S.modele.migrations) ? S.modele.migrations[DESSINS] : null;
    if (!m) return false;
    const C = S.classement;
    if (C && isObj(C.categories)) for (const n of Object.keys(m.avant || {})) {
      if (!isObj(C.categories[n])) continue;
      if (m.avant[n] == null) delete C.categories[n].icone; else C.categories[n].icone = m.avant[n];
    }
    delete S.modele.migrations[DESSINS];
    return true;
  }

  // 1.1.2 « doublons » : une même opération bancaire enregistrée deux fois (lue un jour sans référence, relue le
  // lendemain avec une référence ajoutée au libellé, ou en cours puis comptabilisée sans fusion). Même compte, même
  // montant, dates à 5 jours au plus, même libellé une fois retirés les numéros de fin ; l'une sans référence (ou en
  // cours), l'autre avec (et comptabilisée) : la première est retirée, ce qui a été fait à la main passe à la seconde.
  // Deux opérations identiques de même forme (deux références distinctes, ou aucune) ne sont jamais fusionnées.
  // Une fois, réversible pendant 7 jours depuis Plus › Journal (annulerDoublons). → { n } ou null (déjà faite).
  const DOUBLONS = 'doublons', DOUBLONS_JOURS_ANNUL = 7;
  const formeAncienne = o => o.statut === 'en_cours' || !M().avecReference(o.libelle);
  const formeNouvelle = o => o.statut === 'comptabilisee' && M().avecReference(o.libelle);
  function paires(list) {
    const eb = list.filter(o => o.source === 'eb');
    const anciennes = eb.filter(formeAncienne), nouvelles = eb.filter(formeNouvelle), prises = new Set(), out = [];
    for (const a of anciennes.sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0))) {
      if (a.statut === 'comptabilisee' && M().avecReference(a.libelle)) continue;
      let best = null, bd = Infinity;
      for (const b of nouvelles) {
        if (b === a || prises.has(b.id) || !M().memeOperation(a, b)) continue;
        const d = Math.abs(Date.parse(a.date) - Date.parse(b.date));
        if (d < bd) { best = b; bd = d; }
      }
      if (best) { prises.add(best.id); out.push([a, best]); }
    }
    return out;
  }
  function doublons(S, now) {
    if (!S || !S.modele) return null;
    if (isObj(S.modele.migrations) && S.modele.migrations[DOUBLONS]) return null;
    const avant = [];
    for (const c of S.modele.comptes) {
      const list = S.ops[c.id];
      if (!Array.isArray(list)) continue;
      for (const [a, b] of paires(list)) {
        const copieB = copie(b), i = list.indexOf(a);
        const renvois = M().reprendreEtat(S, a, b);
        list.splice(i, 1);
        avant.push({ compte: c.id, i, op: copie(a), garde: b.id, avantGarde: copieB, renvois });
      }
    }
    S.modele.migrations = isObj(S.modele.migrations) ? S.modele.migrations : {};
    S.modele.migrations[DOUBLONS] = { le: new Date(now == null ? Date.now() : now).toISOString(), n: avant.length, avant };
    return { n: avant.length };
  }
  // Annulation possible : doublons retirés il y a moins de 7 jours, pas encore remis. → { n, le } ou null.
  function doublonsAnnulables(S, now) {
    const m = S && isObj(S.modele.migrations) ? S.modele.migrations[DOUBLONS] : null;
    if (!m || !m.n || m.annulee || !m.le) return null;
    if ((now == null ? Date.now() : now) - Date.parse(m.le) > DOUBLONS_JOURS_ANNUL * 864e5) return null;
    return { n: m.n, le: m.le };
  }
  // Remet les opérations retirées et l'état d'avant de celles gardées ; la migration ne se refait pas.
  function annulerDoublons(S, now) {
    if (!doublonsAnnulables(S, now)) return false;
    const m = S.modele.migrations[DOUBLONS];
    for (const e of m.avant.slice().reverse()) {
      const list = M().opsDe(S, e.compte);
      const j = list.findIndex(o => o.id === e.garde);
      if (j >= 0) list[j] = e.avantGarde;
      M().annulerRenvois(S, e.op.id, e.garde, e.renvois);
      if (!list.some(o => o.id === e.op.id)) list.splice(Math.min(e.i, list.length), 0, e.op);
    }
    m.annulee = new Date(now == null ? Date.now() : now).toISOString();
    m.avant = [];
    return true;
  }

  // État de l'import de l'ancienne version (Plus › Contrôle, relevé de contrôle).
  function etatImport(S) {
    const cx = contenu(S);
    const C = (S && S.classement) || {};
    const D = (S && S.budget) || {};
    const postes = ['perso', 'commun', 'foyer'].reduce((t, sc) => t + (isObj(D.plan) && isObj(D.plan[sc]) ? Object.keys(D.plan[sc]).length : 0), 0);
    const eq = isObj(D.equilibre) ? D.equilibre : {};
    return {
      carnet: !!(S && S.carnet != null), reglesBase: (C.base || []).length, reglesBaseCarnet: cx.rules, postes,
      revenuPrevu: isObj(D.revprev) ? Object.keys(D.revprev).length : 0, mouvementsEquilibre: cx.eqops,
      equipements: cx.equip + (Array.isArray(eq.items) ? eq.items.length : 0), migration: faite(S) ? S.modele.migrations[NOM].le : null
    };
  }

  g.KladMigrations = { payload, annulerPayload, icones, annulerIcones, dessins, annulerDessins, doublons, doublonsAnnulables, annulerDoublons, DOUBLONS_JOURS_ANNUL, etatImport, contenu, faite };
})(typeof window !== 'undefined' ? window : globalThis);
