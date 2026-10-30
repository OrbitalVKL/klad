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

  g.KladMigrations = { payload, annulerPayload, icones, annulerIcones, dessins, annulerDessins, etatImport, contenu, faite };
})(typeof window !== 'undefined' ? window : globalThis);
