// Klad — mode démo (0.10.10) : rien de réel à l'écran. Au démarrage du mode, un dictionnaire est tiré des données :
// libellés des opérations → leur sous-catégorie (ou catégorie) ; catégories créées par le propriétaire → « Catégorie N » ;
// postes (sous-catégories) qui ne sont pas des mots courants → « Poste N » ; personnes, employeurs, banques, intitulés,
// comptes, contrats, copropriétés, équipements, motifs et réglages → noms génériques ; numéros (IBAN, références, fins de
// carte), adresses e-mail et adresses web masqués par motif. Le texte affiché (texte, infobulles, valeurs des champs)
// passe par masquer() ; les montants sont multipliés ensuite par le facteur du mode (KladAffichage).
// Fonctions pures, testées dans node (test/demo.test.mjs) ; aucun enregistrement.
(function (g) {
  'use strict';

  const fold = s => String(s == null ? '' : s).toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
  const esc = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const isObj = o => !!o && typeof o === 'object' && !Array.isArray(o);

  // Mots courants des postes et catégories : un poste fait seulement de ces mots garde son nom ; un mot inconnu (nom
  // propre, enseigne, banque, personne) le fait remplacer par « Poste N ».
  const MOTS = new Set(fold(
    'a à au aux d de des du en et l la le les ou par pour sur sans avec chez un une mon ma mes ses son sa nos notre vos votre entre hors ' +
    'abonnement abonnements achat achats activite activites aide aides alimentation allocation allocations amende amendes animaux animal ' +
    'apport apports appartement appel appels argent assurance assurances auto autoroute autre autres avance avances avis bail ' +
    'banque bancaire bancaires bar bars beaute bien etre bricolage budget bureau cadeau cadeaux caf caisse cantine carburant carte cartes ' +
    'charge charges cheque cheques cinema cloture coiffeur commun commune communs compte comptes concert conso consommation contribution ' +
    'copropriete cotisation cotisations courant courante courantes courses credit credits creche culture debit deblocage dentiste depense ' +
    'depenses deplacement deplacements detail detailler differe divers don dons eau ecole education electricite electromenager emprunteur ' +
    'energie enfant enfants entretien epargne equipement equipements especes essence etudes events evenements exceptionnel exceptionnelle ' +
    'facture factures famille fixe fixes fonciere foncieres formation frais gaz garage habillement habitation hebergement hopital immobilier ' +
    'impot impots internes internet interets jardin jeux journal livre livres livret livrets location logement loisir loisirs loyer ' +
    'maison materiel medecin medical mensualite mobile mobilier musique mutuelle non classe classes optique ordinateur parking participation ' +
    'peage permanent personnel personnelle pharmacie placement placements plein pret prets prevoyance prime primes prelevement prelevements ' +
    'presse principal professionnel quotidien rachat recu recus regularisation reglement reglements remboursement remboursements rente ' +
    'reparation reparations repas restaurant restaurants restauration retrait retraits revenu revenus salaire salaires sante second ' +
    'secondaire service services shopping sorties sortie sport sports stationnement streaming supermarche taxe taxes telecom telephone ' +
    'telephonie ticket tickets train transport transports travaux vacances vehicule velo vente ventes verse versement versements vetements ' +
    'virement virements voiture voyage voyages ligne lignes enligne & / - + →'
  ).split(' '));
  const motsDe = s => fold(s).split(/[^A-Z0-9&/+→-]+/).filter(Boolean);
  const courant = s => { const m = motsDe(s); return m.length > 0 && m.every(w => MOTS.has(w) || /^\d+$/.test(w)); };

  // ------------------------------------------------------------ motifs (numéros, adresses)
  // Adresses (e-mail, web) et identifiants avant le dictionnaire (un nom de personne peut y figurer) ; IBAN, références
  // longues et fins de carte ou d'IBAN « …1234 » après (un libellé peut contenir une référence).
  const AVANT = [
    [/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '•••@•••'],
    [/\bhttps?:\/\/[^\s<>"']+/gi, 'adresse masquée'],
    [/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '••••••']
  ];
  const APRES = [
    [/\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){3,7}(?:[ ]?[A-Z0-9]{1,3})?\b/g, 'FR76 •••• •••• ••••'],
    [/(?<![\p{L}\d])(?=[\p{L}\d-]*\d)(?:[\p{L}]{0,6}[-/]?)?\d{6,}[\p{L}\d-]*/gu, '••••••'],
    [/(?<![\p{L}\d])[A-Z]{1,4}-?\d{4,}(?:-\d+)*(?![\p{L}\d])/g, '••••••'],
    [/(…|\.\.\.|·{2,}|\*{2,}|•{2,}) ?\d{4}\b/g, '$1••••']
  ];
  const remplacer = (t, L) => { let o = t; for (const [rx, r] of L) o = o.replace(rx, r); return o; };
  const MOTIFS = AVANT.concat(APRES);
  const motifs = t => remplacer(remplacer(t, AVANT), APRES);

  // ------------------------------------------------------------ dictionnaire
  // → D = { rx, rep: Map(clé pliée → remplacement), premiers: Set(premier mot plié), banques: [noms] }.
  function construire(S, outils) {
    outils = outils || {};
    S = S || {};
    const KC = g.KladClasse, KB = g.KladBudget, KCo = g.KladCommun, KV = g.KladVues;
    const rep = new Map(), formes = new Map();     // clé pliée → remplacement ; clé → formes écrites (minuscules)
    // f : remplacement d'abord (premier venu gagne), sauf « fort » (noms de personnes, banques…) qui l'emportent
    const ajouter = (txt, r, fort) => {
      const t = String(txt == null ? '' : txt).replace(/\s+/g, ' ').trim();
      if (t.length < 3 || r == null) return;
      const k = fold(t);
      if (!k || k === fold(r)) return;
      (formes.get(k) || formes.set(k, new Set()).get(k)).add(t.toLowerCase());
      if (!fort && rep.has(k)) return;
      rep.set(k, String(r));
    };
    const C = S.classement || {};
    const cats = Object.keys(C.categories || {});
    const OFFICE = (KC && KC.CATEGORIES) || {};
    // Catégories créées par le propriétaire (pas d'office) → « Catégorie N », dans l'ordre alphabétique (nom stable).
    const nomsCat = {};
    cats.filter(c => !OFFICE[c]).sort((a, b) => a.localeCompare(b, 'fr')).forEach((c, i) => { nomsCat[c] = 'Catégorie ' + (i + 1); });
    // personnes, employeurs, banques, intitulés et titulaires (« forts » : l'emportent sur un libellé identique)
    const personnes = [];
    try {
      const R = KB && S.budget !== undefined && S.modele ? KB.reglages(S) : null;
      if (R && R.commun) { personnes.push([R.commun.moi, 'Personne A'], [R.commun.autre, 'Personne B']); }
    } catch (e) { /* réglages absents */ }
    const cx = (S.modele && S.modele.connexions) || {};
    const banques = [...new Set(Object.keys(cx).map(k => cx[k] && cx[k].banque).filter(Boolean))];
    const aliasPers = {};
    for (const [n, r] of personnes) {
      if (!n) continue;
      ajouter(n, r, true); aliasPers[fold(n)] = r;
      for (const w of String(n).split(/[\s-]+/)) if (w.length >= 3 && !MOTS.has(fold(w))) { ajouter(w, r, true); aliasPers[fold(w)] = r; }
    }
    // Postes : sous-catégories des règles, des corrections et des opérations classées, postes du budget.
    const subs = new Set();
    const ctx = outils.ctx || (KC && S.modele ? (() => { try { return KC.contexte(S, Date.now()); } catch (e) { return null; } })() : null);
    const classes = [];
    if (ctx && S.ops) {
      for (const cid of Object.keys(S.ops)) for (const o of S.ops[cid] || []) {
        let r = null;
        try { r = KC.classer(ctx, o); } catch (e) { r = null; }
        classes.push([o, r]);
        if (r && r.sub) subs.add(r.sub);
      }
    }
    for (const b of C.base || []) if (b && b.sub) subs.add(b.sub);
    for (const u of C.regles || []) if (u && u.sub) subs.add(u.sub);
    const plan = (S.budget && S.budget.plan) || {};
    for (const sc of Object.keys(plan)) for (const k of Object.keys(plan[sc] || {})) { const n = String(k).replace(/^[a-z]\|/, ''); if (n) subs.add(n); }
    const nomsPoste = {};
    [...subs].filter(s => !OFFICE[s] && !nomsCat[s] && !courant(s) && !aliasPers[fold(s)]).sort((a, b) => a.localeCompare(b, 'fr')).forEach((s, i) => { nomsPoste[s] = 'Poste ' + (i + 1); });
    const generique = n => nomsCat[n] || nomsPoste[n] || aliasPers[fold(n)] || n;
    const NC = (KC && KC.DEFAUTS && KC.DEFAUTS.debit.sub) || 'Non classé';
    const nomOp = r => !r ? 'Opération' : generique(r.sub && r.sub !== NC ? r.sub : r.cat || 'Opération');

    banques.forEach((b, i) => ajouter(b, 'Banque ' + String.fromCharCode(65 + i), true));
    const comptes = (S.modele && S.modele.comptes) || [];
    const ROLES = { courant: 'Compte courant', commun: 'Compte commun', carte_differee: 'Carte', paiement_en_ligne: 'Paiement en ligne', epargne: 'Épargne' };
    const parRole = {};
    comptes.forEach((c, i) => {
      if (c.source) { ajouter(c.source.intitule, 'Compte ' + (i + 1), true); ajouter(c.source.titulaire, 'Titulaire', true); }
      // libellé choisi : gardé s'il n'est fait que de mots courants (« Commun », « Courant »…), sinon nom générique
      if (c.libelle && !courant(c.libelle)) {
        const base = ROLES[c.role] || 'Compte';
        parRole[base] = (parRole[base] || 0) + 1;
        ajouter(c.libelle, base + ' ' + parRole[base], true);
      }
    });
    const rac = S.carnet && KB ? KB.racine(S.carnet) : null;
    const X = KB && KB.complement ? KB.complement(S) : rac && isObj(rac.klad) ? rac.klad : {};
    const fisc = (S.budget && S.budget.fisc) || (rac && rac.fisc) || {};
    const emps = new Set();
    for (const b of Object.values(isObj(fisc.bs) ? fisc.bs : {})) if (b && b.emp) emps.add(String(b.emp));
    const pee = Object.assign({}, rac && isObj(rac.pee) ? rac.pee : {}, isObj(X.pee) ? X.pee : {}, S.budget && isObj(S.budget.pee) ? S.budget.pee : {});
    const plans = [pee.plan].concat(Array.isArray(pee.anciens) ? pee.anciens : [], Array.isArray(pee.clos) ? pee.clos : [], Array.isArray(pee.closed) ? pee.closed : []).filter(isObj);
    for (const p of plans) { if (p.emp) emps.add(String(p.emp)); if (p.teneur) ajouter(p.teneur, 'Teneur du plan', true); if (p.note) ajouter(p.note, 'note', true); }
    // 1.1.1 : fonds du plan d'épargne → « Fonds N »
    (Array.isArray(pee.fonds) ? pee.fonds : []).forEach((f, i) => { if (isObj(f)) ajouter(f.nom, 'Fonds ' + (i + 1), true); });
    [...emps].forEach((e, i) => ajouter(e, emps.size > 1 ? 'Employeur ' + (i + 1) : 'Employeur', true));
    // copropriétés et syndics (appels de fonds)
    const ap = Object.assign({}, rac && isObj(rac.appels) ? rac.appels : {}, S.budget && isObj(S.budget.appels) ? S.budget.appels : {});
    Object.keys(ap).forEach((cp, i) => {
      const A = ap[cp];
      if (!isObj(A)) return;
      ajouter(A.lab, 'Copropriété ' + (i + 1), true); ajouter(A.to, 'Syndic ' + (i + 1), true);
    });
    if (isObj(X.appels)) { ajouter(X.appels.titre, 'Résidence', true); ajouter(X.appels.syndic, 'Syndic', true); }
    // messagerie (Plus › Extras)
    const mail = (S.modele && S.modele.extras && S.modele.extras.mail) || {};
    ajouter(mail.hote, 'serveur masqué', true);
    for (const e of String(mail.expediteurs || '').split(/[,;]/)) ajouter(e, 'expéditeur', true);
    for (const e of String(mail.motsCles || '').split(/[,;]/)) ajouter(e, 'mot-clé', true);

    // catégories et postes
    for (const c of Object.keys(nomsCat)) ajouter(c, nomsCat[c], true);
    for (const s of Object.keys(nomsPoste)) ajouter(s, nomsPoste[s], true);

    // libellés des opérations (complet, court, comme dans les observations), contreparties
    const court = KV && KV.libelleCourt ? KV.libelleCourt : (l => l);
    for (const [o, r] of classes) {
      const n = nomOp(r);
      ajouter(o.libelle, n); ajouter(court(o.libelle), n); ajouter(o.contrepartie, n);
      ajouter(String(o.libelle || '').replace(/^PAIEMENT (CB|PSC|MOB) \d{4} /, '').slice(0, 28), n);
      ajouter(String(o.libelle || '').split(/\s+/).slice(0, 3).join(' '), n);
    }
    // règles : mots du propriétaire et motifs de base (morceaux de libellés)
    for (const u of C.regles || []) if (u) ajouter(u.mot, generique(u.sub || u.cat || 'Règle'));
    for (const b of C.base || []) {
      if (!b || !b.motif) continue;
      for (const p of String(b.motif).split('|')) ajouter(p.replace(/\\[bBsSdDwW]|[\^$()?*+[\]{}\\]/g, ' '), generique(b.sub || b.cat || 'Règle'));
    }
    // budget : contrats (nom → poste ; justificatif et note masqués), virements permanents
    const D = S.budget || {};
    (D.contrats || []).forEach(c => {
      if (!isObj(c)) return;
      const poste = String(c.poste || '').replace(/^[a-z]\|/, '');
      ajouter(c.label, poste ? generique(poste) : 'Contrat');
      ajouter(c.motif, poste ? generique(poste) : 'Contrat');
      ajouter(c.src, 'justificatif'); ajouter(c.note, 'note');
    });
    (D.virements || []).forEach((v, i) => { if (isObj(v)) { ajouter(v.label, 'Virement ' + (i + 1)); ajouter(v.depuis, 'Compte ' + (i + 1)); } });
    // crypto (1.1) : nom de chaque position
    ((isObj(D.crypto) && Array.isArray(D.crypto.positions)) ? D.crypto.positions : []).forEach((p, i) => { if (isObj(p)) ajouter(p.nom, 'Position ' + (i + 1)); });
    // motifs des réglages (salaire, commun, livret, observations, cartes) : morceaux de libellés
    const mot = (txt, r) => { for (const p of String(txt || '').split('|')) ajouter(p, r); };
    const RG = Object.assign({}, X, isObj(D.reglages) ? D.reglages : {});
    if (isObj(RG.salaire)) { mot(RG.salaire.motif, 'Salaire'); mot(RG.salaire.paie, 'Salaire'); }
    if (isObj(X.salaire)) { mot(X.salaire.motif, 'Salaire'); mot(X.salaire.paie, 'Salaire'); }
    if (isObj(X.commun)) mot(X.commun.motifAutre, 'Personne B');
    if (isObj(X.livret)) mot(X.livret.motif, 'Livret');
    if (isObj(X.observations)) mot(X.observations.motifPret, 'Prêt');
    if (isObj(X.appels)) mot(X.appels.motif, 'Syndic');
    for (const c of comptes) if (c.prelevement) mot(c.prelevement.motif, 'Règlement');
    // équilibre : mouvements (→ leur nature), équipements (→ « Équipement N »)
    if (outils.B && KCo) {
      try {
        const E = KCo.equilibre(outils.B);
        const L = Object.assign({}, KCo.SORTES, (KCo.reglages(outils.B).equilibre || {}).libelles || {});
        if (E) {
          for (const [, l, , k] of E.OPS || []) ajouter(l, L[k] || 'Mouvement');
          (E.EQ || []).forEach((x, i) => { ajouter(x.label, 'Équipement ' + (i + 1)); if (x.detail !== 'opération' && x.detail !== 'ajout manuel') ajouter(x.detail, 'justificatif'); });
        }
      } catch (e) { /* équilibre absent */ }
    }

    // expression unique (formes écrites, sans casse), plus longues d'abord ; mots entiers seulement
    const ecrites = [...new Set([].concat(...[...formes.values()].map(x => [...x])))].sort((a, b) => b.length - a.length);
    const premiers = new Set([...rep.keys()].map(k => (k.match(/[A-Z0-9]+/) || [''])[0]).filter(Boolean));
    const alt = ecrites.map(f => f.split(' ').map(esc).join('\\s+')).join('|');
    const rx = alt ? new RegExp('(?<![\\p{L}\\d])(?:' + alt + ')(?![\\p{L}\\d])', 'giu') : null;
    return { rx, rep, premiers, banques, n: rep.size };
  }
  // Texte → texte masqué (dictionnaire puis motifs).
  function masquer(txt, D) {
    let o = String(txt == null ? '' : txt);
    if (!o.trim()) return o;
    o = remplacer(o, AVANT);
    if (D && D.rx) {
      const mots = fold(o).match(/[A-Z0-9]+/g) || [];
      if (mots.some(w => D.premiers.has(w))) o = o.replace(D.rx, m => { const r = D.rep.get(fold(m)); return r == null ? m : r; });
    }
    return remplacer(o, APRES);
  }
  // Initiales de la pastille d'une banque : lettre de son alias (« A » pour Banque A).
  function initialesBanque(D, nom) {
    const i = D && D.banques ? D.banques.indexOf(nom) : -1;
    return i >= 0 ? String.fromCharCode(65 + i) : '';
  }

  g.KladDemo = { fold, courant, MOTS, MOTIFS, motifs, construire, masquer, initialesBanque };
})(typeof window !== 'undefined' ? window : globalThis);
