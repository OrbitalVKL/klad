// Klad — classement des opérations : catégories (nature, icône), règles de base et règles de l'utilisateur, corrections
// ponctuelles, opérations vues, carte à débit différé (dette, règlement détaillé), paiements en ligne (anti-double-comptage).
// Fonctions pures, testées dans node (test/classement.test.mjs).
//
// Aucune règle ni aucun mot-clé propre à l'utilisateur dans ce fichier : règles, enseignes et motifs de libellé sont des
// données (importées du carnet de l'ancienne version, ou créées dans Klad), gardées dans le bloc chiffré « classement ».
//
// Ordre de priorité (celui de l'ancienne version) :
//   1. correction ponctuelle de l'opération ;
//   2. règle de l'utilisateur : le mot-clé le plus long contenu dans le libellé (compte et sens facultatifs) ;
//   3. règles de base, dans l'ordre (motif, compte et sens facultatifs) ;
//   4. classement par défaut (« Autres › Non classé », « Autres revenus », achats d'une carte ou d'un portefeuille) ;
//   puis, sur un compte courant ou commun : règlement d'une carte dont le détail couvre la date, ou prélèvement d'un
//   portefeuille retrouvé dans son détail (même montant, dates proches) → « interne », pour ne pas compter deux fois.
(function (g) {
  'use strict';

  const M = () => g.KladModele;
  const V = 1;
  const NATURES = ['fixe', 'courante', 'optionnelle', 'revenu', 'interne', 'epargne', 'hors_budget'];
  const NOMS_NATURES = {
    fixe: 'Charge fixe', courante: 'Dépense courante', optionnelle: 'Dépense optionnelle', revenu: 'Revenu',
    interne: 'Mouvement interne', epargne: 'Épargne', hors_budget: 'Hors budget'
  };
  // Catégories proposées d'office (génériques) : [nature, icône].
  // Icônes dessinées (banque Lucide, « lu:<nom> », 0.10.9) ; les émojis des versions précédentes sont convertis par la
  // migration « dessins ».
  const CATEGORIES = {
    'Logement': ['fixe', 'lu:house'], 'Assurances': ['fixe', 'lu:shield'], 'Abonnements & télécom': ['fixe', 'lu:smartphone'], 'Crédits': ['fixe', 'lu:credit-card'],
    'Impôts': ['fixe', 'lu:landmark'], 'Banque': ['fixe', 'lu:university'],
    'Alimentation': ['courante', 'lu:croissant'], 'Courses': ['courante', 'lu:shopping-cart'], 'Carburant': ['courante', 'lu:fuel'], 'Voiture': ['courante', 'lu:wrench'],
    'Transport': ['courante', 'lu:car'], 'Parking': ['courante', 'lu:square-letter-p'], 'Santé': ['courante', 'lu:pill'], 'Formation & éducation': ['courante', 'lu:graduation-cap'],
    'Espèces': ['courante', 'lu:banknote'],
    'Appartement': ['optionnelle', 'lu:sofa'], 'Bars': ['optionnelle', 'lu:beer'], 'Restaurant': ['optionnelle', 'lu:hamburger'], 'Events': ['optionnelle', 'lu:ticket'],
    'Shopping': ['optionnelle', 'lu:shopping-bag'], 'Vacances': ['optionnelle', 'lu:tree-palm'], 'Cadeaux': ['optionnelle', 'lu:gift'], 'Sport': ['optionnelle', 'lu:dumbbell'],
    'Virements à des proches': ['optionnelle', 'lu:handshake'], 'Divers': ['optionnelle', 'lu:package'], 'Autres': ['optionnelle', 'lu:circle-question-mark'],
    'Salaire': ['revenu', 'lu:briefcase'], 'Remboursements santé': ['revenu', 'lu:stethoscope'], 'Remboursements entre amis': ['revenu', 'lu:handshake'],
    'Famille': ['revenu', 'lu:users'], 'Ventes': ['revenu', 'lu:tag'], 'Autres revenus': ['revenu', 'lu:coins'],
    'Apports compte commun': ['revenu', 'lu:banknote-arrow-down'], 'Virements internes': ['interne', 'lu:repeat'], 'Épargne': ['epargne', 'lu:piggy-bank']
  };
  const DEFAUTS = {
    debit: { cat: 'Autres', sub: 'Non classé' }, credit: { cat: 'Autres revenus', sub: 'Autres revenus' },
    carte: { cat: 'Shopping' }, interne: { cat: 'Virements internes' }
  };
  const NC_JOURS = 90;               // « à vérifier » : opérations non classées des 90 derniers jours
  const COUVERTURE_CARTE = 45;       // règlement de carte : jusqu'à 45 jours après la dernière opération détaillée
  const PORTEFEUILLE_AVANT = 2, PORTEFEUILLE_APRES = 7;    // prélèvement du portefeuille : de 2 j avant à 7 j après
  const FREQ_JOURS = 150;            // catégories les plus utilisées : sur les 150 derniers jours

  // Majuscules sans accents, espaces réduits.
  const fold = s => String(s == null ? '' : s).toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
  // Motif de libellé : mots ou expressions séparés par « | », cherchés sans casse ni accents.
  const motifs = txt => String(txt == null ? '' : txt).split('|').map(fold).filter(Boolean);
  const contient = (F, mots) => mots.some(m => F.indexOf(m) >= 0);

  const estCarte = c => !!c && (c.role === 'carte_differee' || c.role === 'paiement_en_ligne');
  const estCourant = c => !!c && (c.role === 'courant' || c.role === 'commun');

  // ------------------------------------------------------------ état
  function nouveau() {
    const categories = {};
    for (const k of Object.keys(CATEGORIES)) categories[k] = { nature: CATEGORIES[k][0], icone: CATEGORIES[k][1] };
    return { v: V, categories, base: [], regles: [] };
  }
  const donnees = S => S.classement || (S.classement = nouveau());

  function natureDe(C, cat) {
    const c = C && C.categories && C.categories[cat];
    return (c && c.nature) || (CATEGORIES[cat] && CATEGORIES[cat][0]) || 'optionnelle';
  }
  // Icône enregistrée (en icône dessinée, 0.10.9), sinon celle d'office, sinon une icône de la banque proposée d'après le
  // nom (0.10.7, KladIcones), sinon l'initiale (sans la banque, dans les anciens tests).
  function iconeDe(C, cat) {
    const c = C && C.categories && C.categories[cat];
    const I = g.KladIcones;
    if (c && c.icone && !(I && I.absente(c.icone))) return I && I.liste().length ? I.versDessin(c.icone, cat) : c.icone;
    if (CATEGORIES[cat]) return CATEGORIES[cat][1];
    if (I) return I.proposer(cat);
    return (c && c.icone) || (String(cat || '?').trim().charAt(0).toUpperCase() || '?');
  }
  const typeDeNature = n => n === 'revenu' ? 'revenu' : n === 'interne' ? 'interne' : n === 'epargne' ? 'epargne' : n === 'hors_budget' ? 'horsbudget' : 'depense';
  const typeDe = (C, cat) => typeDeNature(natureDe(C, cat));

  // Catégories connues, triées (français).
  function listeCategories(C) {
    return Object.keys((C && C.categories) || {}).sort((a, b) => a.localeCompare(b, 'fr'));
  }

  // ------------------------------------------------------------ contexte de classement
  // Construit une fois par affichage (règles compilées, couverture des cartes, détail des portefeuilles) ; les résultats
  // y sont gardés en mémoire.
  function contexte(S, now) {
    const C = S.classement || nouveau();
    const D = Object.assign({}, DEFAUTS, C.defauts || {});
    const comptes = new Map(S.modele.comptes.map(c => [c.id, c]));
    const base = [];
    let invalides = 0;
    for (const b of C.base || []) {
      try {
        base.push(Object.assign({}, b, { rx: new RegExp(b.motif, 'i'), etRx: b.et ? new RegExp(b.et, 'i') : null }));
      } catch (e) { invalides++; }
    }
    const regles = (C.regles || []).map(u => ({ k: fold(u.mot), u })).filter(x => x.k);
    const cartes = [], portefeuilles = [];
    for (const c of S.modele.comptes) {
      const p = c.prelevement || {};
      const mots = motifs(p.motif);
      if (!mots.length) continue;
      const ops = S.ops[c.id] || [];
      if (c.role === 'carte_differee') {
        let min = '', max = '';
        for (const o of ops) { if (!min || o.date < min) min = o.date; if (o.date > max) max = o.date; }
        if (min) cartes.push({ c, mots, min, fin: M().plusJours(max, COUVERTURE_CARTE) });
      } else if (c.role === 'paiement_en_ligne') {
        const montants = new Map();
        let min = '', max = '';
        for (const o of ops) {
          const k = Math.abs(o.montant);
          (montants.get(k) || montants.set(k, []).get(k)).push(o.date);
          if (!min || o.date < min) min = o.date;
          if (o.date > max) max = o.date;
        }
        if (montants.size) portefeuilles.push({ c, mots, montants, min, max });
      }
    }
    return { S, C, D, comptes, base, regles, cartes, portefeuilles, invalides, now: now == null ? Date.now() : now,
      cache: new Map(), cacheBase: new Map() };
  }

  // Une règle de base restreinte à des comptes : liste d'ids de comptes, ou « @courant » / « @commun » (rôle).
  // Une carte ou un portefeuille est vu à travers son compte de prélèvement ; sans rattachement, comme un compte courant.
  function compteOk(ctx, liste, c) {
    let cibles = [c];
    if (estCarte(c)) {
      const p = c.prelevement && ctx.comptes.get(c.prelevement.compte);
      cibles = p ? [p] : [{ id: null, role: 'courant' }];
    }
    return liste.some(x => {
      if (x === '@courant' || x === '@commun') return cibles.some(t => t.role === x.slice(1));
      return cibles.some(t => t.id ? t.id === x : (ctx.comptes.get(x) || {}).role === 'courant');
    });
  }

  function parBase(ctx, o, c) {
    const U = String(o.libelle || '').toUpperCase();
    const credit = o.montant > 0;
    for (const b of ctx.base) {
      if (b.comptes && b.comptes.length && !compteOk(ctx, b.comptes, c)) continue;
      if (b.sens && (b.sens === 'credit') !== credit) continue;
      if (b.horsCartes && estCarte(c)) continue;
      if (!b.rx.test(U)) continue;
      if (b.etRx && !b.etRx.test(o.libelle || '')) continue;
      if (b.type === 'transfert') {
        return credit && b.siCredit ? { type: b.siCredit.type || 'revenu', cat: b.siCredit.cat, sub: b.siCredit.sub || b.siCredit.cat, src: 'base' }
          : { type: 'depense', cat: b.cat, sub: b.sub || b.cat, src: 'base' };
      }
      if ((b.type === 'depense' || b.type === 'revenu') && b.creditDepense && credit) return { type: 'depense', cat: b.cat, sub: b.sub || b.cat, src: 'base' };
      return { type: b.type || typeDe(ctx.C, b.cat), cat: b.cat, sub: b.sub || b.cat, src: 'base' };
    }
    const D = ctx.D;
    if (estCarte(c)) return { type: 'depense', cat: D.carte.cat, sub: (o.montant < 0 ? 'Achats ' : 'Remboursements ') + (c.libelle || ''), src: 'defaut' };
    return o.montant < 0 ? { type: 'depense', cat: D.debit.cat, sub: D.debit.sub, src: 'defaut' }
      : { type: 'revenu', cat: D.credit.cat, sub: D.credit.sub, src: 'defaut' };
  }

  function brut(ctx, o, c) {
    const k = o.categorie;
    if (k && k.cat) return { type: typeDe(ctx.C, k.cat), cat: k.cat, sub: k.sub || k.cat, src: 'correction' };
    const F = fold(o.libelle);
    const credit = o.montant > 0;
    let best = null, bl = 0;
    for (const { k: kw, u } of ctx.regles) {
      if (kw.length <= bl || F.indexOf(kw) < 0) continue;
      if (u.compte && u.compte !== o.compte) continue;
      if (u.sens && (u.sens === 'credit') !== credit) continue;
      best = u; bl = kw.length;
    }
    if (best) return { type: typeDe(ctx.C, best.cat), cat: best.cat, sub: best.sub || best.cat, src: 'regle' };
    // Le classement de base ne dépend que du libellé, du compte et du sens : gardé en mémoire.
    const cle = o.libelle + '\n' + o.compte + '\n' + (credit ? 1 : 0);
    let b = ctx.cacheBase.get(cle);
    if (!b) { b = parBase(ctx, o, c); ctx.cacheBase.set(cle, b); }
    return Object.assign({}, b);
  }

  // Règlement détaillé ailleurs (carte ou portefeuille) : opération d'un compte courant ou commun → interne.
  function reglement(ctx, o, c) {
    if (!estCourant(c) || (!ctx.cartes.length && !ctx.portefeuilles.length)) return null;
    const F = fold(o.libelle);
    const interne = (k, quoi) => ({ type: 'interne', cat: ctx.D.interne.cat, sub: 'Règlement ' + (k.c.libelle || quoi) + ' (détaillé)', src: 'reglement', detail: k.c.id });
    for (const k of ctx.cartes) if (o.date >= k.min && o.date <= k.fin && contient(F, k.mots)) return interne(k, 'carte');
    for (const w of ctx.portefeuilles) {
      if (!contient(F, w.mots)) continue;
      const dates = w.montants.get(Math.abs(o.montant));
      if (dates && dates.some(d => { const e = ecart(o.date, d); return e >= -PORTEFEUILLE_AVANT && e <= PORTEFEUILLE_APRES; })) return interne(w, 'portefeuille');
    }
    return null;
  }
  const ecart = (a, b) => (Date.parse(a + 'T00:00:00Z') - Date.parse(b + 'T00:00:00Z')) / 864e5;

  // → { type, cat, sub, src, nc } ; src : correction, regle, base, defaut, reglement.
  function classer(ctx, o) {
    let r = ctx.cache.get(o);
    if (r) return r;
    const c = ctx.comptes.get(o.compte) || { id: o.compte, role: 'courant', libelle: '' };
    r = brut(ctx, o, c);
    // catégories renommées ou supprimées dans Klad (comme l'ancienne version) : le classement suit
    const ren = ctx.C.renommees;
    if (ren && ren[r.cat]) { r = Object.assign({}, r); for (let i = 0; ren[r.cat] && i < 5; i++) { if (r.sub === r.cat) r.sub = ren[r.cat]; r.cat = ren[r.cat]; } }
    if (ctx.C.retirees && ctx.C.retirees.indexOf(r.cat) >= 0) r = Object.assign({}, r, { cat: r.type === 'revenu' ? ctx.D.credit.cat : 'Autres', sub: r.sub === r.cat ? r.cat : r.sub });
    // Une vente classée en revenu mais qui est un débit : c'est un achat (règle de l'ancienne version, en données).
    const rv = ctx.C.revente && ctx.C.revente[r.cat];
    if (rv && r.type === 'revenu' && o.montant < 0) r = { type: 'depense', cat: rv.cat, sub: rv.sub || rv.cat, src: r.src };
    const reg = reglement(ctx, o, c);
    if (reg) r = reg;
    const D = ctx.D;
    r.nc = r.sub === D.debit.sub || r.sub === D.credit.sub || r.cat === D.debit.cat;
    ctx.cache.set(o, r);
    return r;
  }

  // Prélèvement d'un portefeuille sans opération de même montant dans son détail (pendant la période couverte par le
  // détail) : il reste une dépense, mais il est signalé « à rapprocher » et peut être marqué interne à la main.
  // → le compte portefeuille concerné, ou null.
  function aRapprocher(ctx, o) {
    if (o.montant >= 0 || (o.categorie && o.categorie.cat) || o.rapprochement === 'depense' || !ctx.portefeuilles.length) return null;
    const c = ctx.comptes.get(o.compte);
    if (!estCourant(c)) return null;
    const F = fold(o.libelle);
    for (const w of ctx.portefeuilles) {
      if (!contient(F, w.mots)) continue;
      if (o.date < M().plusJours(w.min, -PORTEFEUILLE_AVANT) || o.date > M().plusJours(w.max, PORTEFEUILLE_APRES)) continue;
      return classer(ctx, o).type === 'interne' ? null : w.c;
    }
    return null;
  }
  // Marque un prélèvement de portefeuille comme réglé par ce portefeuille (interne). → instantané pour annuler.
  // L'opération reste dans la liste, catégorie interne, non comptée ; « main » : marquée interne à la main.
  function marquerInterne(ctx, o, w) {
    const snap = { op: o, categorie: o.categorie, vue: o.vue };
    o.categorie = { cat: ctx.D.interne.cat, sub: 'Règlement ' + ((w && w.libelle) || 'portefeuille') + ' (rapproché à la main)', main: true };
    if (!vue(ctx.S, o)) o.vue = true;
    return snap;
  }
  function annulerInterne(snap) {
    snap.op.categorie = snap.categorie;
    if (snap.vue === undefined) delete snap.op.vue; else snap.op.vue = snap.vue;
  }
  // Marquée interne à la main (depuis la 0.9.4 : « main » ; avant : sous-catégorie « … (rapproché à la main) »).
  const interneManuel = o => !!(o.categorie && (o.categorie.main || / \(rapproché à la main\)$/.test(o.categorie.sub || '')));
  // « Annuler : compter en dépense » : l'opération retrouve son classement (et « À vérifier » si elle est à
  // rapprocher). → instantané pour annuler (annulerInterne).
  function compterEnDepense(o) {
    if (!interneManuel(o)) return null;
    const snap = { op: o, categorie: o.categorie, vue: o.vue };
    o.categorie = null;
    return snap;
  }

  // ------------------------------------------------------------ rapprochement à la main (1.1)
  // Côté banque, un prélèvement de portefeuille « à rapprocher » peut être rapproché d'un achat choisi dans le détail
  // du portefeuille (le prélèvement devient interne, l'achat est la dépense), ou gardé en dépense. Côté portefeuille,
  // un achat sans prélèvement à la banque peut être marqué « payé autrement » (solde du portefeuille, autre moyen).
  // o.rapprochement : 'depense' (prélèvement gardé en dépense), 'autrement' (achat payé autrement) ou { avec: id }.
  const FENETRE_MANUELLE = 30;
  const proche = (o, x) => Math.abs(ecart(o.date, x.date)) <= FENETRE_MANUELLE;
  const triProches = (o, L) => L.sort((a, b) => (Math.abs(Math.abs(a.montant) - Math.abs(o.montant)) - Math.abs(Math.abs(b.montant) - Math.abs(o.montant))) ||
    (Math.abs(ecart(o.date, a.date)) - Math.abs(ecart(o.date, b.date))));
  const portefeuilleDe = (ctx, o) => { const c = ctx.comptes.get(o.compte); return c && c.role === 'paiement_en_ligne' ? c : null; };
  // Prélèvement de la banque qui règle un achat du portefeuille : rapproché à la main, sinon même montant et dates
  // proches (règle automatique). → opération, ou null.
  function prelevementDe(ctx, wop) {
    const w = ctx.portefeuilles.find(x => x.c.id === wop.compte);
    if (!w) return null;
    for (const c of ctx.comptes.values()) {
      if (!estCourant(c)) continue;
      for (const o of ctx.S.ops[c.id] || []) {
        if (o.montant >= 0 || !contient(fold(o.libelle), w.mots)) continue;
        if (o.categorie && o.categorie.lie === wop.id) return o;
        const e = ecart(o.date, wop.date);
        if (Math.abs(o.montant) === Math.abs(wop.montant) && e >= -PORTEFEUILLE_AVANT && e <= PORTEFEUILLE_APRES) return o;
      }
    }
    return null;
  }
  // Achats du portefeuille w à proposer pour le prélèvement o (± 30 jours, sans prélèvement déjà), du plus proche.
  function candidatsPortefeuille(ctx, o, w) {
    const L = (ctx.S.ops[w.id] || []).filter(x => x.montant < 0 && proche(o, x) && x.rapprochement !== 'autrement' && !prelevementDe(ctx, x));
    return triProches(o, L).slice(0, 12);
  }
  // Prélèvements « à rapprocher » à proposer pour l'achat wop (± 30 jours), du plus proche.
  function candidatsBanque(ctx, wop) {
    const L = [];
    for (const c of ctx.comptes.values()) if (estCourant(c)) for (const o of ctx.S.ops[c.id] || []) { const w = aRapprocher(ctx, o); if (w && w.id === wop.compte && proche(wop, o)) L.push(o); }
    return triProches(wop, L).slice(0, 12);
  }
  const snapOps = L => L.map(o => ({ op: o, categorie: o.categorie, vue: o.vue, rapprochement: o.rapprochement, ecartVu: o.ecartVu }));
  function annulerRapprochement(snap) {
    for (const x of snap) {
      x.op.categorie = x.categorie;
      if (x.vue === undefined) delete x.op.vue; else x.op.vue = x.vue;
      if (x.rapprochement === undefined) delete x.op.rapprochement; else x.op.rapprochement = x.rapprochement;
      if (x.ecartVu === undefined) delete x.op.ecartVu; else x.op.ecartVu = x.ecartVu;
    }
  }
  // Prélèvement o (banque) rapproché de l'achat wop du portefeuille w → instantané pour annuler.
  function rapprocherAvec(ctx, o, w, wop) {
    const snap = snapOps([o, wop]);
    o.categorie = { cat: ctx.D.interne.cat, sub: 'Règlement ' + (w.libelle || 'portefeuille') + ' (rapproché à la main)', main: true, lie: wop.id };
    if (!vue(ctx.S, o)) o.vue = true;
    delete o.ecartVu;
    wop.rapprochement = { avec: o.id };
    ctx.liens = null;
    return snap;
  }
  // 1.1.1 : écart de rapprochement. Un prélèvement rapproché à la main d'un achat de montant différent : l'écart
  // (montant prélevé − montant de l'achat, centimes ; positif : prélèvement plus grand) reste compté, une seule fois,
  // dans la catégorie de l'achat (ligne « écart » du budget, KladBudget.contexte) ; négatif : compté en moins (la
  // dépense comptée vaut le montant prélevé). Signalé dans « À vérifier » au-delà de ECART_SIGNAL, jusqu'à « Écart
  // vérifié » (o.ecartVu sur le prélèvement).
  const ECART_SIGNAL = 200;
  // → Map(id de l'achat → prélèvement), une fois par contexte.
  function liens(ctx) {
    if (ctx.liens) return ctx.liens;
    const L = new Map();
    for (const c of ctx.comptes.values()) {
      if (!estCourant(c)) continue;
      for (const o of ctx.S.ops[c.id] || []) if (o.categorie && o.categorie.main && o.categorie.lie) L.set(o.categorie.lie, o);
    }
    ctx.liens = L;
    return L;
  }
  // Achat (portefeuille) d'id donné, ou null.
  function achatDe(ctx, id) {
    for (const w of ctx.portefeuilles) for (const x of ctx.S.ops[w.c.id] || []) if (x.id === id) return x;
    return null;
  }
  // Écart d'une opération (prélèvement rapproché à la main, ou achat qu'il règle) → { banque, achat, ecart }, ou null
  // (pas de rapprochement à la main, ou montants égaux).
  function ecartDe(ctx, o) {
    let banque = null, achat = null;
    if (o.categorie && o.categorie.main && o.categorie.lie) { banque = o; achat = achatDe(ctx, o.categorie.lie); }
    else if (o.rapprochement && o.rapprochement.avec) { banque = liens(ctx).get(o.id) || null; achat = banque ? o : null; }
    if (!banque || !achat) return null;
    const ecart = Math.abs(banque.montant) - Math.abs(achat.montant);
    return ecart ? { banque, achat, ecart } : null;
  }
  // Tous les écarts (comptes visibles ou non : le budget filtre).
  function ecarts(ctx) {
    const out = [];
    for (const banque of liens(ctx).values()) { const e = ecartDe(ctx, banque); if (e) out.push(e); }
    return out;
  }
  // Écart à vérifier : au-delà de 2 €, tant que « Écart vérifié » n'a pas été appuyé.
  const ecartAVerifier = e => !!e && Math.abs(e.ecart) > ECART_SIGNAL && !e.banque.ecartVu;
  // « Écart vérifié » (ou l'inverse) → instantané pour annuler (annulerEcartVu).
  function marquerEcartVu(o, on) {
    const snap = { op: o, ecartVu: o.ecartVu };
    if (on) o.ecartVu = true; else delete o.ecartVu;
    return snap;
  }
  function annulerEcartVu(snap) { if (snap.ecartVu === undefined) delete snap.op.ecartVu; else snap.op.ecartVu = snap.ecartVu; }
  // Écart qu'un rapprochement créerait (avant de confirmer) : centimes, 0 si montants égaux.
  const ecartPrevu = (banque, achat) => Math.abs(banque.montant) - Math.abs(achat.montant);

  // Prélèvement gardé en dépense (plus « à rapprocher ») → instantané.
  function garderDepense(o) { const snap = snapOps([o]); o.rapprochement = 'depense'; return snap; }
  // Achat du portefeuille payé autrement (aucun prélèvement à attendre) → instantané.
  function payeAutrement(wop) { const snap = snapOps([wop]); wop.rapprochement = 'autrement'; return snap; }

  // ------------------------------------------------------------ opérations vues
  // Une opération est vue si elle a été cochée, ou si elle est datée du jour de départ ou avant (et pas décochée).
  // o.vue : true (vue), 0 (remise en non vue) ; toute autre valeur : d'après la date de départ.
  function vue(S, o) {
    if (o.vue === true) return true;
    if (o.vue === 0) return false;
    const d = S.modele.vues && S.modele.vues.depuis;
    return !!d && o.date <= d;
  }
  // Première ouverture : tout ce qui est déjà là compte comme vu.
  function initialiserVues(S, now) {
    if (S.modele.vues && S.modele.vues.depuis) return false;
    S.modele.vues = { depuis: M().jourLocal(now == null ? Date.now() : now) };
    return true;
  }
  // → annulation : [[opération, ancienne valeur]].
  function marquer(S, ops, on) {
    const avant = [];
    for (const o of ops) {
      if (vue(S, o) === !!on) continue;
      avant.push([o, o.vue]);
      o.vue = on ? true : 0;
    }
    return avant;
  }
  function annulerVues(avant) { for (const [o, v] of avant) { if (v === undefined) delete o.vue; else o.vue = v; } }

  const visibles = S => M().comptesTries(S).filter(c => !c.masque);
  function opsVisibles(S) {
    const out = [];
    for (const c of visibles(S)) for (const o of S.ops[c.id] || []) out.push(o);
    return out;
  }

  // ------------------------------------------------------------ « à vérifier »
  // → { unseen, unclassified, accountsToCheck, toMatch } (nombres ; toMatch : prélèvements de portefeuille à rapprocher).
  function attention(ctx, now) {
    const S = ctx.S;
    const limite = M().plusJours(M().jourLocal(now == null ? ctx.now : now), -NC_JOURS);
    let unseen = 0, unclassified = 0, toMatch = 0;
    for (const o of opsVisibles(S)) {
      if (!vue(S, o)) unseen++;
      if (o.date >= limite && classer(ctx, o).nc) unclassified++;
      if (aRapprocher(ctx, o)) toMatch++;
    }
    const accountsToCheck = S.modele.comptes.filter(c => c.aVerifier || c.aReassocier).length;
    // 1.1.1 : écarts de rapprochement de plus de 2 € pas encore vérifiés (prélèvement sur un compte visible)
    const vis = new Set(visibles(S).map(c => c.id));
    const gaps = ecarts(ctx).filter(e => ecartAVerifier(e) && vis.has(e.banque.compte)).length;
    return { unseen, unclassified, accountsToCheck, toMatch, gaps };
  }

  // ------------------------------------------------------------ volet « Classer »
  // Mot-clé proposé : deux premiers mots utiles du libellé (sans préfixes bancaires, dates ni références).
  function suggestKw(label) {
    const w = fold(label).replace(/\b(PAIEMENT|CARTE|CB|PSC|MOB|PRLV|SEPA|VIR|INST|DE|DU|LA|LE|LES)\b/g, ' ').replace(/\d{2}\/\d{2}/g, ' ')
      .replace(/\b\w*\d\w*\b/g, ' ').replace(/[^A-Z0-9&*' ]/g, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(x => x.length > 1);
    return w.slice(0, 2).join(' ');
  }

  // Mot proposé par « Classer aussi les autres » : celui de suggestKw s'il figure tel quel dans le libellé (une règle
  // le retrouvera au moins dans cette opération), sinon son premier mot (« CAFE DU PORT » → « CAFE PORT » absent → « CAFE »).
  function motPropose(label) {
    const k = suggestKw(label), f = fold(label);
    if (!k || f.indexOf(k) >= 0) return k;
    return k.split(' ').find(w => f.indexOf(w) >= 0) || '';
  }

  // Opérations dont le libellé contient le mot-clé (compte et sens facultatifs).
  function concernees(S, mot, opts) {
    const k = fold(mot);
    if (!k) return [];
    const out = [];
    for (const cid of Object.keys(S.ops)) {
      if (opts && opts.compte && cid !== opts.compte) continue;
      for (const o of S.ops[cid]) {
        if (opts && opts.sens && (opts.sens === 'credit') !== (o.montant > 0)) continue;
        if (fold(o.libelle).indexOf(k) >= 0) out.push(o);
      }
    }
    return out;
  }

  // Catégories les plus utilisées (dépenses des 150 derniers jours), la catégorie actuelle en tête.
  function frequentes(ctx, actuelle, n) {
    const lim = M().plusJours(M().jourLocal(ctx.now), -FREQ_JOURS);
    const f = {};
    for (const o of opsVisibles(ctx.S)) {
      if (o.date < lim) continue;
      const r = classer(ctx, o);
      if (r.type === 'depense') f[r.cat] = (f[r.cat] || 0) + 1;
    }
    const toutes = listeCategories(ctx.C).filter(c => c !== actuelle);
    toutes.sort((a, b) => (f[b] || 0) - (f[a] || 0) || a.localeCompare(b, 'fr'));
    return (actuelle ? [actuelle] : []).concat(toutes).slice(0, n || 7);
  }

  // Classe une opération (correction ponctuelle) ou crée une règle (« Classer aussi les autres »).
  // choix : { cat, sub, mot?, compte?, sens? }. L'opération est aussi marquée vue. → instantané pour annuler.
  function appliquer(S, o, choix) {
    const C = donnees(S);
    const snap = { regles: JSON.stringify(C.regles), categories: JSON.stringify(C.categories), op: o, categorie: o.categorie, vue: o.vue };
    if (!C.categories[choix.cat]) C.categories[choix.cat] = { nature: natureDe(C, choix.cat), icone: iconeDe(C, choix.cat) };
    const sub = String(choix.sub || '').trim() || choix.cat;
    if (choix.mot && fold(choix.mot)) {
      const k = fold(choix.mot);
      C.regles = C.regles.filter(u => fold(u.mot) !== k);
      const u = { mot: String(choix.mot).trim(), cat: choix.cat, sub };
      if (choix.compte) u.compte = choix.compte;
      if (choix.sens === 'debit' || choix.sens === 'credit') u.sens = choix.sens;
      C.regles.push(u);
      o.categorie = null;            // la règle s'applique aussi à cette opération
    } else o.categorie = { cat: choix.cat, sub };
    if (!vue(S, o)) o.vue = true;
    return snap;
  }
  function annuler(S, snap) {
    const C = donnees(S);
    C.regles = JSON.parse(snap.regles);
    C.categories = JSON.parse(snap.categories);
    snap.op.categorie = snap.categorie;
    if (snap.vue === undefined) delete snap.op.vue; else snap.op.vue = snap.vue;
  }

  // ------------------------------------------------------------ carte à débit différé
  // Date réelle d'un paiement carte, lue dans le libellé (« CARTE 24/09 … », « PAIEMENT CB 2409 … ») ; '' sinon.
  function dateDepense(o) {
    const l = String(o.libelle || '');
    const m = /^CARTE (\d{2})\/(\d{2})\b/.exec(l) || /^PAIEMENT (?:CB|PSC|MOB) (\d{2})(\d{2})\b/.exec(l);
    if (!m) return '';
    const dd = +m[1], mm = +m[2];
    if (!(dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12)) return '';
    let y = +o.date.slice(0, 4), c = y + '-' + m[2] + '-' + m[1];
    if (c > o.date) { y--; c = y + '-' + m[2] + '-' + m[1]; }
    if (!M().dateValide(c)) return '';
    const e = ecart(o.date, c);
    return e >= 0 && e <= 31 ? c : '';
  }

  // Prochaine date de prélèvement (jour du mois) après le dernier règlement, au plus tôt 10 jours avant aujourd'hui.
  function prochaine(jour, depuis, now) {
    if (!(jour >= 1 && jour <= 31)) return null;
    const auj = M().jourLocal(now);
    let d = M().plusJours(auj, -10);
    if (depuis && M().plusJours(depuis, 1) > d) d = M().plusJours(depuis, 1);
    for (let i = 0; i < 3; i++) {
      const y = +d.slice(0, 4), m = +d.slice(5, 7) + i;
      const yy = y + Math.floor((m - 1) / 12), mm = ((m - 1) % 12) + 1;
      const fin = new Date(Date.UTC(yy, mm, 0)).getUTCDate();
      const c = yy + '-' + String(mm).padStart(2, '0') + '-' + String(Math.min(jour, fin)).padStart(2, '0');
      if (c >= d) return c;
    }
    return null;
  }

  // Dette d'une carte : ses opérations depuis le dernier règlement débité sur son compte de prélèvement (sans
  // rattachement : sur un compte courant ou commun), hors remboursements et paiements reçus (motif réglable).
  // → { centimes (≥ 0), depuis, n, le } ; null si le motif du règlement n'est pas réglé.
  function dette(S, k, now) {
    const p = k.prelevement || {};
    const mots = motifs(p.motif);
    if (!mots.length) return null;
    const remb = motifs(p.remboursements);
    const prel = p.compte && M().compte(S, p.compte);
    const sources = prel ? [prel] : S.modele.comptes.filter(estCourant);
    let depuis = '';
    for (const c of sources) for (const o of S.ops[c.id] || []) {
      if (o.montant < 0 && o.date > depuis && contient(fold(o.libelle), mots)) depuis = o.date;
    }
    let v = 0, n = 0;
    for (const o of S.ops[k.id] || []) {
      if (depuis && o.date <= depuis) continue;
      if (remb.length && contient(fold(o.libelle), remb)) continue;
      v -= o.montant; n++;
    }
    return { centimes: Math.max(0, v), depuis: depuis || null, n, le: prochaine(p.jour, depuis, now == null ? Date.now() : now) };
  }

  // Dettes des cartes visibles (en euros) : { centimes, connues, inconnues }.
  function dettes(S, now) {
    let t = 0, connues = 0, inconnues = 0;
    for (const c of visibles(S)) {
      if (c.role !== 'carte_differee' || (c.devise || 'EUR') !== 'EUR') continue;
      const d = dette(S, c, now);
      if (d) { t += d.centimes; connues++; } else inconnues++;
    }
    return { centimes: t, connues, inconnues };
  }

  // Motifs proposés pour le règlement d'une carte ou d'un portefeuille : débits récurrents du compte de prélèvement
  // (ou des comptes courants), regroupés par leurs premiers mots utiles. → [{ motif, n }], les plus fréquents d'abord.
  function propositions(S, k) {
    const p = k.prelevement || {};
    const prel = p.compte && M().compte(S, p.compte);
    const sources = prel ? [prel] : S.modele.comptes.filter(estCourant);
    const n = {}, mois = {};
    for (const c of sources) for (const o of S.ops[c.id] || []) {
      if (o.montant >= 0) continue;
      const kw = suggestKw(o.libelle);
      if (!kw) continue;
      n[kw] = (n[kw] || 0) + 1;
      (mois[kw] || (mois[kw] = new Set())).add(o.date.slice(0, 7));
    }
    return Object.keys(n).filter(kw => mois[kw].size >= 2)
      .sort((a, b) => mois[b].size - mois[a].size || n[b] - n[a]).slice(0, 6).map(kw => ({ motif: kw, n: n[kw] }));
  }


  // ------------------------------------------------------------ catégories : créer, renommer, supprimer (comme l'ancienne version)
  // → instantané pour annuler (classement et plan du budget).
  const instantane = S => ({ classement: JSON.stringify(donnees(S)), plan: S.budget ? JSON.stringify(S.budget.plan || {}) : null, contrats: S.budget ? JSON.stringify(S.budget.contrats || []) : null });
  function restaurer(S, snap) {
    S.classement = JSON.parse(snap.classement);
    if (S.budget && snap.plan != null) { S.budget.plan = JSON.parse(snap.plan); S.budget.contrats = JSON.parse(snap.contrats); }
  }
  function creerCategorie(S, nom, nature) {
    const C = donnees(S), n = String(nom || '').trim().slice(0, 40);
    if (!n) throw new Error('Indiquez un nom de catégorie.');
    const dup = listeCategories(C).find(c => fold(c) === fold(n));
    if (dup) throw new Error('La catégorie « ' + dup + ' » existe déjà.');
    const snap = instantane(S);
    C.categories[n] = { nature: NATURES.indexOf(nature) >= 0 ? nature : 'optionnelle', icone: iconeDe(C, n) };
    if (C.retirees) C.retirees = C.retirees.filter(x => x !== n);
    if (C.renommees) delete C.renommees[n];
    return snap;
  }
  // Renommer : opérations, règles, corrections et postes du budget suivent.
  function renommerCategorie(S, ancien, nouveau) {
    const C = donnees(S), n = String(nouveau || '').trim().slice(0, 40);
    if (!n || n === ancien) return null;
    if (listeCategories(C).some(c => c !== ancien && fold(c) === fold(n))) throw new Error('La catégorie « ' + n + ' » existe déjà.');
    const snap = instantane(S);
    C.renommees = Object.assign({}, C.renommees, { [ancien]: n });
    for (const k of Object.keys(C.renommees)) if (C.renommees[k] === ancien) C.renommees[k] = n;
    delete C.renommees[n];
    C.categories[n] = Object.assign({ nature: natureDe(C, ancien), icone: iconeDe(C, ancien) }, C.categories[ancien]);
    delete C.categories[ancien];
    (C.regles || []).forEach(u => { if (u.cat === ancien) { if (u.sub === ancien) u.sub = n; u.cat = n; } });
    if (S.budget) {
      for (const sc of Object.keys(S.budget.plan || {})) {
        const pl = S.budget.plan[sc];
        if (pl && pl['c|' + ancien] !== undefined) { pl['c|' + n] = pl['c|' + ancien]; delete pl['c|' + ancien]; }
      }
      (S.budget.contrats || []).forEach(c => { if (c.poste === 'c|' + ancien) c.poste = 'c|' + n; });
    }
    return snap;
  }
  function supprimerCategorie(S, nom) {
    const C = donnees(S);
    const snap = instantane(S);
    C.retirees = (C.retirees || []).filter(x => x !== nom).concat([nom]);
    delete C.categories[nom];
    return snap;
  }
  function changerNature(S, nom, nature) {
    const C = donnees(S), snap = instantane(S);
    C.categories[nom] = Object.assign({ icone: iconeDe(C, nom) }, C.categories[nom], { nature: NATURES.indexOf(nature) >= 0 ? nature : natureDe(C, nom) });
    return snap;
  }
  // Règle ajoutée depuis le panneau « Règles de classement » (sans opération de départ).
  function ajouterRegle(S, mot, cat, sub) {
    const C = donnees(S), k = fold(mot);
    if (!k) throw new Error('Saisissez un mot du libellé.');
    const snap = instantane(S);
    C.regles = (C.regles || []).filter(u => fold(u.mot) !== k);
    C.regles.push({ mot: String(mot).trim(), cat, sub: sub || cat });
    if (!C.categories[cat]) C.categories[cat] = { nature: natureDe(C, cat), icone: iconeDe(C, cat) };
    return snap;
  }
  function retirerRegle(S, mot) {
    const C = donnees(S), snap = instantane(S), k = fold(mot);
    C.regles = (C.regles || []).filter(u => fold(u.mot) !== k);
    return snap;
  }

  g.KladClasse = {
    V, NATURES, NOMS_NATURES, CATEGORIES, DEFAUTS, NC_JOURS, fold, motifs, estCarte, estCourant,
    nouveau, donnees, natureDe, iconeDe, typeDe, typeDeNature, listeCategories, contexte, classer,
    aRapprocher, marquerInterne, ECART_SIGNAL, ecartDe, ecarts, ecartAVerifier, marquerEcartVu, annulerEcartVu, ecartPrevu, annulerInterne, portefeuilleDe, prelevementDe, candidatsPortefeuille, candidatsBanque, rapprocherAvec, garderDepense, payeAutrement, annulerRapprochement, interneManuel, compterEnDepense, vue, initialiserVues, marquer, annulerVues, opsVisibles, attention, suggestKw, motPropose, concernees, frequentes, appliquer, annuler,
    dateDepense, prochaine, dette, dettes, propositions,
    creerCategorie, renommerCategorie, supprimerCategorie, changerNature, ajouterRegle, retirerRegle, restaurer
  };
})(typeof window !== 'undefined' ? window : globalThis);
