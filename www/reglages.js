// Klad — réglages du complément dans Klad (1.0). Plus aucun réglage figé dans le complément importé : chaque réglage se
// change dans Klad (Plus › Réglages › Budget, écrans par thème, éditeur avancé du complément) ; ordre de priorité
// inchangé : complément < réglages de Klad. Un champ laissé vide revient à la valeur du complément.
// Où vont les réglages saisis (« ou » d'un champ) :
//   r : S.budget.reglages (salaire, commun, cycle ; déjà prioritaires sur le complément, KladBudget.reglages)
//   b : S.budget (tf, livret, pee, carburant : saisies de Klad, prioritaires sur le complément)
//   x : S.modele.extras (mail : réglages de l'extra, prioritaires sur le complément)
//   c : S.modele.reglages.complement (une clé du complément remplacée en entier, KladBudget.surcharger)
// Partie pure (KladReglages) testée dans node ; écrans dans le navigateur (KladReglagesEcran).
(function (g) {
  'use strict';

  const KB = () => g.KladBudget;
  const M = () => g.KladModele;
  const isObj = o => o != null && typeof o === 'object' && !Array.isArray(o);
  const clone = o => o === undefined ? undefined : JSON.parse(JSON.stringify(o));
  const egal = (a, b) => JSON.stringify(a === undefined ? null : a) === JSON.stringify(b === undefined ? null : b);

  // ------------------------------------------------------------ thèmes et champs
  // Un compte mis sur « Aucun » est un choix (null), prioritaire sur le complément.
  // t : texte, nombre, motifs (mots séparés par « | », un par ligne à l'écran), liste (tableau, un par ligne), motif
  // (expression régulière), compte, choix, date, json. euros : saisi en euros (le complément l'écrit en euros aussi).
  const CYCLES = [['salaire', 'Cycle de salaire'], ['mois', 'Mois civil']];
  const THEMES = [
    { id: 'salaire', titre: 'Cycle et salaire', sous: 'Cycle, reconnaissance du salaire', champs: [
      { k: 'cycle', ou: 'r', t: 'choix', l: 'Cycle du budget perso', options: CYCLES, defaut: 'salaire', aide: 'Cycle de salaire : du dernier salaire reçu à la veille du suivant. Mois civil : du 1er au dernier jour du mois.' },
      { k: 'salaire.compte', ou: 'r', t: 'compte', l: 'Compte qui reçoit le salaire', vide: 'Tous les comptes perso' },
      { k: 'salaire.motif', ou: 'r', t: 'motifs', l: 'Mots du libellé du salaire', aide: 'Un par ligne. Le salaire est reconnu si son libellé contient l\'un d\'eux.' },
      { k: 'salaire.paie', ou: 'r', t: 'motifs', l: 'Mots qui confirment la paie (facultatif)', aide: 'Un par ligne. Sans mot ni montant minimum, le premier critère suffit.' },
      { k: 'salaire.min', ou: 'r', t: 'nombre', l: 'Montant minimum du salaire (€)', aide: 'Facultatif : un crédit plus petit n\'ouvre pas de cycle.' },
      { k: 'salaire.minCycle', ou: 'r', t: 'nombre', l: 'Montant minimum pour ouvrir un cycle passé (€)' },
      { k: 'salaire.ecart', ou: 'r', t: 'nombre', l: 'Écart minimum entre deux cycles (jours)', defaut: 15 }
    ] },
    { id: 'commun', titre: 'Personnes du commun', sous: 'Noms, part par défaut, virements de l\'autre personne', champs: [
      { k: 'commun.moi', ou: 'r', t: 'texte', l: 'Votre nom (personne A)' },
      { k: 'commun.autre', ou: 'r', t: 'texte', l: 'Nom de l\'autre personne (personne B)' },
      { k: 'commun.part', ou: 'r', t: 'nombre', l: 'Votre part par défaut d\'un poste du commun (%)', defaut: 50, aide: 'Un poste dont la part a été réglée dans Commun › Budget mensuel garde sa part.' },
      { k: 'commun.contribution', ou: 'r', t: 'texte', l: 'Poste perso de votre contribution au commun', defaut: 'Contribution compte commun' },
      { k: 'commun.motifAutre', ou: 'r', t: 'motif', l: 'Motif des virements de l\'autre personne', aide: 'Expression reconnue dans le libellé des virements reçus sur le compte commun.' }
    ] },
    { id: 'secondaire', titre: 'Compte secondaire', sous: 'Charges récurrentes à basculer sur le compte principal', champs: [
      { k: 'observations.secondaire', ou: 'c', t: 'compte', l: 'Compte secondaire', vide: 'Aucun', aide: 'Les charges récurrentes prélevées sur ce compte sont signalées (observations et pastille « récurrent » dans le détail des postes).' },
      { k: 'observations.principal', ou: 'c', t: 'compte', l: 'Compte courant principal', vide: 'Non précisé' },
      { k: 'observations.motifPret', ou: 'c', t: 'motif', l: 'Motif de l\'échéance du prêt', defaut: 'ECH PRET' },
      { k: 'observations.salaireMin', ou: 'c', t: 'nombre', l: 'Salaire minimum attendu (€)', defaut: 1000 }
    ] },
    { id: 'cartes', titre: 'Cartes et remboursements', sous: 'Libellés de règlement des cartes et portefeuilles', special: 'cartes' },
    { id: 'appels', titre: 'Appels de fonds', sous: 'Résidence, syndic', champs: [
      { k: 'appels.titre', ou: 'c', t: 'texte', l: 'Nom de la résidence' },
      { k: 'appels.syndic', ou: 'c', t: 'texte', l: 'Nom du syndic' },
      { k: 'appels.motif', ou: 'c', t: 'motif', l: 'Motif des paiements au syndic' }
    ] },
    { id: 'mail', titre: 'Mail (appels de fonds)', sous: 'Expéditeurs, mots-clés, pièces jointes', champs: [
      { k: 'mail.expediteurs', ou: 'x', t: 'liste', l: 'Expéditeurs', aide: 'Un par ligne.' },
      { k: 'mail.motsCles', ou: 'x', t: 'liste', l: 'Mots-clés de l\'objet', aide: 'Un par ligne.' },
      { k: 'mail.piece', ou: 'x', t: 'motif', l: 'Nom des pièces jointes (groupes nature, année, mois, jour)' },
      { k: 'mail.codeAvance', ou: 'x', t: 'texte', l: 'Code d\'une avance de trésorerie dans le nom de la pièce' },
      { k: 'mail.exigible', ou: 'x', t: 'motif', l: 'Date d\'exigibilité dans le texte' },
      { k: 'mail.total', ou: 'x', t: 'motif', l: 'Total dans le texte' },
      { k: 'mail.avance', ou: 'x', t: 'motif', l: 'Avance de trésorerie dans le texte' },
      { k: 'mail.cp', ou: 'c', t: 'json', l: 'Copropriétés (nom → motif)', aide: 'Objet JSON, par exemple { "Résidence A": "RESIDENCE A" }.' }
    ] },
    { id: 'motscles', titre: 'Listes de mots-clés', sous: 'Bars, livret, règles du complément', champs: [
      { k: 'bars', ou: 'c', t: 'motif', l: 'Bars (partage de « Restaurants & bars »)', aide: 'Pris en compte à la reprise du classement, proposée après l\'enregistrement (« Reprendre le classement »).' },
      { k: 'livret.motif', ou: 'c', t: 'motif', l: 'Virements vers le livret', defaut: 'LIVRE|LIVRET' },
      { k: 'regles', ou: 'c', t: 'json', l: 'Règles du complément', aide: 'Liste JSON. Prises en compte à la reprise du classement, proposée après l\'enregistrement.' }
    ] },
    { id: 'tf', titre: 'Taxe foncière', sous: 'Logement, bases, taux', champs: [
      { k: 'tf.ach', ou: 'b', t: 'date', l: 'Achèvement du logement' },
      { k: 'tf.surf', ou: 'b', t: 'nombre', l: 'Surface pondérée (m²)' },
      { k: 'tf.baseM2', ou: 'b', t: 'nombre', l: 'Valeur locative au m² (€)' },
      { k: 'tf.basePk', ou: 'b', t: 'nombre', l: 'Valeur locative du stationnement (€)' },
      { k: 'tf.reval', ou: 'b', t: 'nombre', l: 'Revalorisation annuelle (%)' },
      { k: 'tf.exoCom', ou: 'b', t: 'nombre', l: 'Exonération des 2 premières années (%)' },
      { k: 'tf.tCom', ou: 'b', t: 'nombre', l: 'Taux communal (%)' },
      { k: 'tf.tSpe', ou: 'b', t: 'nombre', l: 'Taux spécial (%)' },
      { k: 'tf.tTeom', ou: 'b', t: 'nombre', l: 'Taux des ordures ménagères (%)' }
    ] },
    { id: 'livret', titre: 'Livret', sous: 'Comptes, taux', champs: [
      { k: 'livret.compte', ou: 'c', t: 'compte', l: 'Compte d\'où partent les virements', vide: 'Comptes courants' },
      { k: 'livret.epargne', ou: 'c', t: 'compte', l: 'Compte d\'épargne du livret', vide: 'Aucun' },
      { k: 'livret.taux', ou: 'b', t: 'nombre', l: 'Taux (%)' }
    ] },
    { id: 'pee', titre: 'Épargne salariale (PEE)', sous: 'Plan', champs: [
      { k: 'pee.plan.emp', ou: 'b', t: 'texte', l: 'Employeur' },
      { k: 'pee.plan.entree', ou: 'b', t: 'date', l: 'Entrée dans le plan' },
      { k: 'pee.plan.teneur', ou: 'b', t: 'texte', l: 'Teneur de compte' },
      { k: 'pee.plan.abTaux', ou: 'b', t: 'nombre', l: 'Abondement (%)' },
      { k: 'pee.plan.abPlaf', ou: 'b', t: 'nombre', l: 'Plafond de l\'abondement (€)' },
      { k: 'pee.plan.dispo', ou: 'b', t: 'nombre', l: 'Blocage (années)', defaut: 5 }
    ] },
    { id: 'masquees', titre: 'Observations masquées', sous: 'Points marqués « c\'est fait »', special: 'masquees' },
    { id: 'exclusions', titre: 'Exclusions du budget', sous: 'Opérations écartées des calculs', special: 'exclusions' },
    { id: 'carburant', titre: 'Carburant', sous: 'Calculateur du poste Carburant', champs: [
      { k: 'carburant.ar', ou: 'b', t: 'nombre', l: 'Aller-retour quotidien (km)', init: 'carburant' },
      { k: 'carburant.jours', ou: 'b', t: 'nombre', l: 'Jours de trajet par mois', init: 'carburant' },
      { k: 'carburant.autres', ou: 'b', t: 'nombre', l: 'Autres kilomètres par mois', init: 'carburant' },
      { k: 'carburant.conso', ou: 'b', t: 'nombre', l: 'Consommation (l / 100 km)', init: 'carburant' },
      { k: 'carburant.prix', ou: 'b', t: 'nombre', l: 'Prix du litre (€)', init: 'carburant' }
    ] },
    { id: 'apparence', titre: 'Couleurs et pastilles', sous: 'Catégories, banques', champs: [
      { k: 'couleurs', ou: 'c', t: 'json', l: 'Couleurs des catégories', aide: 'Objet JSON { "catégorie": "#rrggbb" }. Une couleur choisie dans Classement passe avant.' },
      { k: 'pastilles', ou: 'c', t: 'json', l: 'Pastilles des banques', aide: 'Objet JSON { "motif": ["initiales", "#rrggbb"] }.' }
    ] }
  ];
  const theme = id => THEMES.find(t => t.id === id) || null;
  const champ = k => { for (const t of THEMES) for (const c of t.champs || []) if (c.k === k) return c; return null; };

  // ------------------------------------------------------------ lecture
  const chemin = k => k.split('.');
  function lireChemin(o, k) { let v = o; for (const p of chemin(k)) { if (!isObj(v)) return undefined; v = v[p]; } return v; }
  function racineKlad(S) { const st = S && S.carnet && KB() ? KB().racine(S.carnet) : null; return st && isObj(st.klad) ? st.klad : {}; }
  const surcouche = S => (S.modele.reglages && isObj(S.modele.reglages.complement)) ? S.modele.reglages.complement : {};
  // Magasin de Klad d'un champ (null s'il n'existe pas encore).
  function magasin(S, ou, creer) {
    if (ou === 'r') { if (!S.budget && !creer) return null; const D = KB().donnees(S); if (!isObj(D.reglages)) { if (!creer) return null; D.reglages = {}; } return D.reglages; }
    if (ou === 'b') { if (!S.budget && !creer) return null; return KB().donnees(S); }
    if (ou === 'x') { if (!isObj(S.modele.extras)) { if (!creer) return null; S.modele.extras = {}; } return S.modele.extras; }
    return null;
  }
  const vide = v => v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length);
  // Valeur affichée d'un champ → { v, src : 'klad' | 'complement' | 'defaut' | null }.
  function valeur(S, c) {
    const comp = KB().complement(S);
    if (c.ou === 'c') {
      const top = chemin(c.k)[0], O = surcouche(S);
      const v = lireChemin(comp, c.k);
      if (!vide(v) || (v === null && top in O)) return { v, src: top in O ? 'klad' : 'complement' };
    } else {
      const st = magasin(S, c.ou, false), v = st ? lireChemin(st, c.k) : undefined;
      if (!vide(v) || v === null) return { v, src: 'klad' };
      if (c.init === 'carburant') { const r = KB().carburant(S); const k = chemin(c.k)[1]; return { v: r[k], src: S.carnet && isObj(KB().racine(S.carnet).fuel) ? 'complement' : 'defaut' }; }
      const vc = lireChemin(comp, c.k);
      if (!vide(vc)) return { v: vc, src: 'complement' };
    }
    return c.defaut !== undefined ? { v: c.defaut, src: 'defaut' } : { v: undefined, src: null };
  }

  // ------------------------------------------------------------ écriture (une saisie → la valeur rangée)
  const nombreFr = s => { const t = String(s).replace(/[\s  ]/g, '').replace(',', '.'); return t !== '' && isFinite(+t) ? +t : NaN; };
  // Texte saisi → { ok, v (undefined : vide), erreur }.
  function convertir(c, texte) {
    const s = String(texte == null ? '' : texte).trim();
    if (!s) return { ok: true, v: c.t === 'compte' ? null : undefined };       // compte : « Aucun » choisi, prioritaire
    switch (c.t) {
      case 'nombre': { const n = nombreFr(s); return isFinite(n) ? { ok: true, v: n } : { ok: false, erreur: 'Nombre attendu.' }; }
      case 'motifs': return { ok: true, v: s.split(/\n+/).map(x => x.trim()).filter(Boolean).join('|') };
      case 'liste': return { ok: true, v: s.split(/\n+/).map(x => x.trim()).filter(Boolean) };
      case 'motif': try { new RegExp(s, 'i'); return { ok: true, v: s }; } catch (e) { return { ok: false, erreur: 'Expression non reconnue : ' + e.message }; }
      case 'date': return /^\d{4}-\d{2}-\d{2}$/.test(s) ? { ok: true, v: s } : { ok: false, erreur: 'Date attendue (AAAA-MM-JJ).' };
      case 'json': try { const o = JSON.parse(s); return { ok: true, v: o }; } catch (e) { return { ok: false, erreur: 'JSON non valide : ' + e.message }; }
      default: return { ok: true, v: s };
    }
  }
  // Valeur → texte du champ (affichage).
  function versTexte(c, v) {
    if (v === undefined || v === null) return '';
    if (c.t === 'motifs') return String(v).split('|').map(x => x.trim()).filter(Boolean).join('\n');
    if (c.t === 'liste') return (Array.isArray(v) ? v : String(v).split(/[,;\n]/)).map(x => String(x).trim()).filter(Boolean).join('\n');
    if (c.t === 'json') return JSON.stringify(v, null, 2);
    return String(v);
  }
  function poser(o, k, v) {
    const ps = chemin(k);
    let x = o;
    for (const p of ps.slice(0, -1)) { if (!isObj(x[p])) x[p] = {}; x = x[p]; }
    if (v === undefined) delete x[ps[ps.length - 1]]; else x[ps[ps.length - 1]] = v;
  }
  // Instantané des magasins touchables (annulation).
  function instantane(S) {
    const D = S.budget || {};
    return JSON.stringify({ r: D.reglages, b: { tf: D.tf, livret: D.livret, pee: D.pee, carburant: D.carburant, dismiss: D.dismiss, exc: D.exc },
      x: S.modele.extras, c: S.modele.reglages, comptes: S.modele.comptes.map(c => [c.id, c.prelevement]) });
  }
  function restaurer(S, avant) {
    const o = JSON.parse(avant);
    const set = (obj, k, v) => { if (v === undefined) delete obj[k]; else obj[k] = v; };
    if (S.budget || o.r !== undefined) { const D = KB().donnees(S); set(D, 'reglages', o.r); for (const k of Object.keys(o.b)) set(D, k, o.b[k]); for (const k of ['tf', 'livret', 'pee', 'carburant', 'dismiss', 'exc']) if (!(k in o.b)) delete D[k]; }
    set(S.modele, 'extras', o.x); set(S.modele, 'reglages', o.c);
    for (const [id, p] of o.comptes || []) { const c = M().compte(S, id); if (c) set(c, 'prelevement', p); }
  }
  // Enregistre une valeur convertie. Vide : revient au complément. → true si quelque chose a changé.
  // Compte : identifiant Klad ou référence de la reprise (« r0 ») → identifiant Klad.
  const resoudre = (S, v) => { const map = (S.modele.reprise && S.modele.reprise.map) || {}; return v && map[v] ? map[v] : v; };
  function ecrire(S, c, v) {
    const avant = valeur(S, c);
    const av = c.t === 'compte' ? resoudre(S, avant.v) : avant.v;
    const pareil = c.t === 'json' ? egal(av, v) : versTexte(c, av) === versTexte(c, v);   // « A,B » et [A, B] : même liste
    if (pareil && (v !== undefined || avant.src !== 'klad')) return false;
    if (c.ou === 'c') {
      const top = chemin(c.k)[0], brut = racineKlad(S);
      if (!isObj(S.modele.reglages)) S.modele.reglages = {};
      if (!isObj(S.modele.reglages.complement)) S.modele.reglages.complement = {};
      const O = S.modele.reglages.complement;
      if (chemin(c.k).length === 1) {
        if (v === undefined) delete O[top]; else O[top] = clone(v);
      } else {
        const base = clone(top in O ? (O[top] === null ? {} : O[top]) : brut[top]);
        const obj = isObj(base) ? base : {};
        const sous = c.k.slice(top.length + 1);
        poser(obj, sous, v === undefined ? clone(lireChemin(brut[top] || {}, sous)) : v === null ? null : clone(v));
        O[top] = obj;
      }
      if (top in O && egal(O[top], brut[top])) delete O[top];
      S.modele.reglages.maj = new Date().toISOString();
      return true;
    }
    const st = magasin(S, c.ou, true);
    if (c.init === 'carburant' && !isObj(st.carburant)) st.carburant = Object.assign({}, KB().carburant(S));
    poser(st, c.k, v === null ? null : clone(v));
    // objet vidé : retiré (retour au complément)
    const top = chemin(c.k)[0];
    if (isObj(st[top]) && !Object.keys(st[top]).length) delete st[top];
    return true;
  }

  // ------------------------------------------------------------ compte secondaire : charges récurrentes (pastille)
  // Opérations du compte secondaire dont le montant revient (comme l'ancienne version : même montant sur au moins 2 mois
  // ou poste fixe, récent) → Set des montants (centimes, débit), ou null sans compte secondaire.
  function recurrentsSecondaire(B) {
    if (B.memo.recSec !== undefined) return B.memo.recSec;
    const O = g.KladObservations;
    const R = O && O.reglages ? O.reglages(B) : null;
    if (!R || !R.secondaire) return (B.memo.recSec = null);
    const set = new Set(O.recurrentsSecondaire(B, R.secondaire).map(x => -x.rows[0].m));
    return (B.memo.recSec = { compte: R.secondaire, principal: R.principal, montants: set });
  }

  // ------------------------------------------------------------ complément : aperçu d'import, éditeur avancé
  // Aperçu de l'import d'un complément → { ajoutes, remplaces, identiques, prioritaires (réglé dans Klad, garde la main) }.
  function apercuComplement(S, klad) {
    const brut = racineKlad(S), O = surcouche(S);
    const r = { ajoutes: [], remplaces: [], identiques: [], prioritaires: [] };
    for (const k of Object.keys(klad || {}).sort()) {
      if (!(k in brut)) r.ajoutes.push(k); else if (egal(brut[k], klad[k])) r.identiques.push(k); else r.remplaces.push(k);
      if (k in O) r.prioritaires.push(k);
    }
    return r;
  }
  function lireComplement(texte) {
    let o;
    try { o = JSON.parse(texte); } catch (e) { throw new Error('Fichier illisible (JSON attendu).'); }
    if (!o || o.format !== 'klad-complement' || o.v !== 1 || !isObj(o.klad)) throw new Error('Ce fichier n\'est pas un complément de classement Klad.');
    return o.klad;
  }
  function importerComplement(S, klad) {
    if (S.carnet == null || typeof S.carnet !== 'object') throw new Error('Importez d\'abord la reprise de l\'ancienne version.');
    S.carnet.klad = Object.assign({}, S.carnet.klad, klad);
  }
  // Texte de l'éditeur avancé : le complément effectif (complément importé et réglages du complément saisis dans Klad).
  const brutEffectif = S => JSON.stringify(KB().complement(S), null, 2);
  // Validation du texte de l'éditeur → { ok, o, erreur }.
  function validerBrut(texte) {
    let o;
    try { o = JSON.parse(texte); } catch (e) { return { ok: false, erreur: 'JSON non valide : ' + e.message }; }
    if (!isObj(o)) return { ok: false, erreur: 'Un objet JSON est attendu ({ … }).' };
    for (const k of Object.keys(o)) if (!/^[A-Za-z][A-Za-z0-9_]{0,40}$/.test(k)) return { ok: false, erreur: 'Clé inattendue : « ' + k.slice(0, 40) + ' ».' };
    return { ok: true, o };
  }
  // Enregistre le texte de l'éditeur : chaque clé différente du complément importé devient un réglage de Klad (clé
  // retirée : null). → liste des clés changées.
  function enregistrerBrut(S, o) {
    const brut = racineKlad(S), avant = KB().complement(S);
    const N = {};
    for (const k of new Set([...Object.keys(brut), ...Object.keys(o)])) {
      if (!(k in o)) N[k] = null;
      else if (!egal(o[k], brut[k])) N[k] = clone(o[k]);
    }
    const changes = [...new Set([...Object.keys(avant), ...Object.keys(o)])].filter(k => !egal(avant[k], o[k])).sort();
    if (!isObj(S.modele.reglages)) S.modele.reglages = {};
    S.modele.reglages.complement = N;
    S.modele.reglages.maj = new Date().toISOString();
    return changes;
  }

  g.KladReglages = { THEMES, CYCLES, theme, champ, valeur, convertir, versTexte, ecrire, instantane, restaurer, recurrentsSecondaire,
    apercuComplement, lireComplement, importerComplement, brutEffectif, validerBrut, enregistrerBrut, racineKlad };
})(typeof window !== 'undefined' ? window : globalThis);

// ------------------------------------------------------------ écrans (navigateur)
// Plus › Réglages › Budget (cycle et salaire, reste à vivre, base de calcul, personnes du commun, compte secondaire),
// Plus › Réglages › Complément (écrans par thème, éditeur avancé), Plus › Données › Importer (complément avec aperçu).
(function () {
  'use strict';
  if (typeof document === 'undefined' || !window.KladApp) return;
  const A = window.KladApp, R = window.KladReglages, KB = () => window.KladBudget, M = window.KladModele, U = window.KladUI, F = window.KladFormat;
  const $ = id => document.getElementById(id);
  const esc = A.esc;
  const S = () => A.etat();
  const SRC = { klad: 'réglé dans Klad', complement: 'du complément', defaut: 'valeur par défaut' };   // compte « Aucun » : choix de Klad
  let themeCourant = null, sale = false, avantAvance = null, apercu = null, etatVu = null;
  // Autre ouverture du coffre (verrouillage, restauration) : rien n'est gardé de la précédente.
  const neuf = () => { if (etatVu !== S()) { etatVu = S(); sale = false; avantAvance = null; apercu = null; } };

  // Valeur d'un compte (identifiant Klad ou référence « r0 » de la reprise) → identifiant Klad.
  const idCompte = v => { if (!v) return ''; const map = (S().modele.reprise && S().modele.reprise.map) || {}; const id = map[v] || v; return M.compte(S(), id) ? id : ''; };
  function champHtml(c) {
    const s = S(), x = R.valeur(s, c), id = 'rg-' + c.k.replace(/\./g, '-');
    const tag = x.src ? ' <small class="rg-src">' + SRC[x.src] + '</small>' : '';
    const lab = '<span class="rg-l">' + esc(c.l) + tag + '</span>';
    const aide = c.aide ? '<small class="muted rg-aide">' + esc(c.aide) + '</small>' : '';
    let ctl;
    if (c.t === 'compte') {
      const cur = idCompte(x.v);
      ctl = '<select id="' + id + '" data-k="' + esc(c.k) + '"><option value="">' + esc(c.vide || 'Aucun') + '</option>' +
        M.comptesTries(s).map(k => '<option value="' + esc(k.id) + '"' + (k.id === cur ? ' selected' : '') + '>' + esc(k.libelle) + '</option>').join('') + '</select>';
    } else if (c.t === 'choix') {
      ctl = '<select id="' + id + '" data-k="' + esc(c.k) + '">' + c.options.map(([v, l]) => '<option value="' + esc(v) + '"' + (v === x.v ? ' selected' : '') + '>' + esc(l) + '</option>').join('') + '</select>';
    } else if (c.t === 'motifs' || c.t === 'liste' || c.t === 'json') {
      ctl = '<textarea id="' + id + '" data-k="' + esc(c.k) + '" rows="' + (c.t === 'json' ? 5 : 3) + '" spellcheck="false" autocomplete="off">' + esc(R.versTexte(c, x.v)) + '</textarea>';
    } else {
      const ty = c.t === 'date' ? ' type="date"' : c.t === 'nombre' ? ' inputmode="decimal"' : '';
      ctl = '<input id="' + id + '" data-k="' + esc(c.k) + '"' + ty + ' autocomplete="off" spellcheck="false" maxlength="300" value="' + esc(R.versTexte(c, x.v)) + '">';
    }
    return '<label class="rg-champ" for="' + id + '">' + lab + ctl + aide + '</label>';
  }
  const formHtml = t => '<div class="rg-form" data-theme="' + esc(t.id) + '">' + t.champs.map(champHtml).join('') +
    '<p class="rg-msg" aria-live="polite"></p><div class="row"><button type="button" class="btn" data-rg="enregistrer">Enregistrer</button></div></div>';

  // Enregistrement d'un formulaire : tous les champs valides, sinon rien n'est écrit.
  function enregistrer(form) {
    const t = R.theme(form.dataset.theme), s = S();
    const vals = [], erreurs = [];
    for (const el of form.querySelectorAll('[data-k]')) {
      const c = R.champ(el.dataset.k);
      const r = R.convertir(c, el.value);
      if (!r.ok) erreurs.push(c.l + ' : ' + r.erreur); else vals.push([c, r.v]);
    }
    const msg = form.querySelector('.rg-msg');
    if (erreurs.length) { msg.textContent = erreurs.join(' · '); return; }
    const avant = R.instantane(s);
    let n = 0;
    for (const [c, v] of vals) if (R.ecrire(s, c, v)) n++;
    sale = false;
    if (!n) { msg.textContent = 'Rien n\'a changé.'; return; }
    A.log('info', 'Réglages « ' + t.titre + ' » : ' + n + ' champ(s) modifié(s).');
    A.changed('reglages');
    U.reglerApparence(s);
    A.toastAnnuler('Réglages enregistrés (' + n + ').', () => { R.restaurer(S(), avant); A.changed('reglages'); U.reglerApparence(S()); rafraichir(); });
    rafraichir();
  }
  function rafraichir() {
    for (const id of ['secReglBudget', 'secReglages', 'secReglTheme', 'secReglAvance']) if ($(id) && $(id).closest('#volet') && A.preparer[id]) A.preparer[id]({ force: true });
  }

  // ------------------------------------------------------------ Plus › Réglages › Budget
  A.preparer.secReglBudget = o => {
    neuf();
    if (o && o.rendu && sale) return;
    const s = S(), KBu = KB();
    let per = null, ref = null, B = null;
    try { B = A.budget(); per = B ? KBu.periode(B, 'perso', null) : null; ref = s.budget && s.budget.ref; } catch (e) { per = null; }
    const resume = '<ul class="list"><li><div class="grow">Cycle en cours<small>' + esc(per && per.cyc ? 'du ' + U.jjmm(per.cyc.start) + ' au ' + U.jjmm(per.cyc.end)
      : KBu.reglages(s).cycle === 'mois' ? 'mois civil (réglage)' : 'mois civil (salaire non reconnu)') + '</small></div></li></ul>';
    $('reglBudgetCorps').innerHTML = '<p class="muted small">Ces réglages passent avant ceux du complément. Un champ vidé revient à la valeur du complément.</p>' +
      '<h3>Cycle de salaire</h3>' + resume + formHtml(R.theme('salaire')) +
      '<h3>Reste à vivre affiché</h3><p class="muted small">Sur l\'Accueil et dans le résumé lu par Grafit. Le détail montre toujours les deux colonnes.</p>' +
      U.interrupteurRav(KBu.baseRav(s), !!(per && B && (KBu.suivi(B, 'perso', null).rav || {}).comptes)) +
      '<h3>Base de calcul du réel habituel</h3><ul class="list"><li><div class="grow">Depuis<small>' + esc(ref ? U.mLong(ref) : 'automatique') + '</small></div></li></ul>' +
      '<div class="row"><button type="button" class="btn" data-a="base">Modifier dans Budget</button></div>' +
      '<h3>Compte commun</h3>' + formHtml(R.theme('commun')) +
      '<h3>Compte secondaire</h3>' + formHtml(R.theme('secondaire'));
  };
  $('reglBudgetCorps').addEventListener('click', ev => {
    if (ev.target.closest('[data-a="base"]')) {
      const EB = window.KladEcranBudget;
      if (EB) { EB.ui.sv.perso = 'suivi'; EB.ui.mode = 'plan'; }
      A.fermerVolet(true);
      A.montrer('budget', { force: true, haut: true });
      const b = $('bref');
      if (b) requestAnimationFrame(() => { b.scrollIntoView(); window.scrollBy(0, -90); });
    }
  });

  // ------------------------------------------------------------ Plus › Réglages › Complément (écrans par thème)
  const AUTRES = ['cartes', 'appels', 'mail', 'motscles', 'tf', 'livret', 'pee', 'masquees', 'exclusions', 'carburant', 'apparence'];
  A.preparer.secReglages = () => {
    neuf();
    const it = (t, attr) => '<button type="button" class="sh-li" ' + attr + '><span>' + esc(t.titre) + '<small>' + esc(t.sous) + '</small></span><span class="r" aria-hidden="true">›</span></button>';
    const O = (S().modele.reglages && S().modele.reglages.complement) || {};
    const n = Object.keys(O).length;
    $('reglagesCorps').innerHTML = '<p class="muted small">Tous les réglages du complément se changent ici ; ils passent avant le complément importé. ' +
      (n ? n + ' rubrique(s) du complément réglée(s) dans Klad.' : 'Aucune rubrique du complément réglée dans Klad pour l\'instant.') + '</p>' +
      '<div class="sh-list">' + it({ titre: 'Budget', sous: 'Cycle, salaire, personnes du commun, compte secondaire' }, 'data-volet="secReglBudget" data-empiler="1"') +
      AUTRES.map(id => it(R.theme(id), 'data-reglt="' + id + '"')).join('') +
      it({ titre: 'Éditeur avancé', sous: 'Complément complet en JSON, vérifié avant enregistrement' }, 'data-volet="secReglAvance" data-empiler="1"') + '</div>';
  };
  $('reglagesCorps').addEventListener('click', ev => {
    const b = ev.target.closest('[data-reglt]');
    if (!b) return;
    themeCourant = b.dataset.reglt;
    A.ouvrirVolet('secReglTheme', { empiler: true, titre: R.theme(themeCourant).titre });
  });

  function special(t) {
    const s = S();
    if (t.special === 'cartes') {
      const L = s.modele.comptes.filter(c => c.role === 'carte_differee' || c.role === 'paiement_en_ligne');
      if (!L.length) return '<p class="muted">Aucune carte à débit différé ni portefeuille de paiement en ligne.</p>';
      return '<p class="muted small">Plusieurs libellés : un par ligne. Sans majuscules ni accents obligatoires.</p><div class="rg-form" data-special="cartes">' + L.map(c => {
        const p = c.prelevement || {};
        return '<h3>' + esc(c.libelle) + '</h3><label class="rg-champ" for="rgm-' + esc(c.id) + '"><span class="rg-l">Libellé du prélèvement</span><textarea id="rgm-' + esc(c.id) + '" rows="2" data-cmotif="' + esc(c.id) + '" spellcheck="false">' +
          esc(String(p.motif || '').split('|').map(x => x.trim()).filter(Boolean).join('\n')) + '</textarea></label>' +
          (c.role === 'carte_differee' ? '<label class="rg-champ" for="rgr-' + esc(c.id) + '"><span class="rg-l">Libellés des remboursements de la carte</span><textarea id="rgr-' + esc(c.id) + '" rows="2" data-cremb="' + esc(c.id) + '" spellcheck="false">' +
            esc(String(p.remboursements || '').split('|').map(x => x.trim()).filter(Boolean).join('\n')) + '</textarea></label>' : '');
      }).join('') + '<p class="rg-msg" aria-live="polite"></p><div class="row"><button type="button" class="btn" data-rg="cartes">Enregistrer</button></div></div>';
    }
    if (t.special === 'masquees') {
      const D = (s.budget && s.budget.dismiss) || {};
      const L = Object.keys(D).filter(k => k !== '_reset').sort();
      return '<p class="muted small">Un point marqué « c\'est fait » reste masqué jusqu\'à ce que la situation se reproduise, ou 40 jours.</p>' +
        (L.length ? '<ul class="list">' + L.map(k => '<li><div class="grow">' + esc(k) + '<small>masqué le ' + esc(F.date(String(D[k]).slice(0, 10))) + '</small></div><button type="button" class="btn small" data-rgdis="' + esc(k) + '">Réafficher</button></li>').join('') + '</ul>' +
          '<div class="row"><button type="button" class="btn" data-rg="toutreafficher">Tout réafficher</button></div>' : '<p class="muted">Aucune observation masquée.</p>');
    }
    if (t.special === 'exclusions') {
      const E = (s.budget && s.budget.exc) || {};
      const L = Object.keys(E).filter(k => E[k]);
      const op = id => { for (const cid of Object.keys(s.ops)) { const o = s.ops[cid].find(x => x.id === id); if (o) return o; } return null; };
      return '<p class="muted small">Opérations écartées des calculs du budget (reprises de l\'ancienne version).</p>' +
        (L.length ? '<ul class="list">' + L.map(id => { const o = op(id); return '<li><div class="grow">' + esc(o ? F.date(o.date) + ' · ' + (o.libelle || '') : 'Opération absente') +
          (o ? '<small>' + esc((o.montant < 0 ? 'débit ' : 'crédit ') + F.montant(Math.abs(o.montant))) + '</small>' : '') + '</div><button type="button" class="btn small" data-rgexc="' + esc(id) + '">Remettre dans le budget</button></li>'; }).join('') + '</ul>'
          : '<p class="muted">Aucune opération exclue.</p>');
    }
    return '';
  }
  A.preparer.secReglTheme = o => {
    neuf();
    if (o && o.rendu && sale) return;
    const t = R.theme(themeCourant);
    if (!t) { $('reglThemeCorps').innerHTML = ''; return; }
    $('reglThemeCorps').innerHTML = (t.id === 'motscles' ? '<div class="encart-reprise" data-encart-reprise hidden></div>' : '') +
      '<p class="muted small">' + esc(t.sous) + '. Un champ vidé revient à la valeur du complément.</p>' + (t.special ? special(t) : formHtml(t));
    if (t.id === 'motscles' && A.encartsReprise) A.encartsReprise();
  };
  function actionTheme(ev) {
    const b = ev.target.closest('button');
    if (!b) return;
    const s = S();
    if (b.dataset.rg === 'enregistrer') { enregistrer(b.closest('.rg-form')); return; }
    if (b.dataset.rg === 'cartes') {
      const avant = R.instantane(s);
      let n = 0;
      const joindre = v => String(v || '').split(/\n+/).map(x => x.trim()).filter(Boolean).join('|').slice(0, 200);
      for (const el of b.closest('.rg-form').querySelectorAll('[data-cmotif], [data-cremb]')) {
        const c = M.compte(s, el.dataset.cmotif || el.dataset.cremb), k = el.dataset.cmotif ? 'motif' : 'remboursements';
        if (!c) continue;
        const v = joindre(el.value), p = c.prelevement || {};
        if ((p[k] || '') === v) continue;
        c.prelevement = Object.assign({}, p);
        if (v) c.prelevement[k] = v; else delete c.prelevement[k];
        n++;
      }
      sale = false;
      if (!n) { b.closest('.rg-form').querySelector('.rg-msg').textContent = 'Rien n\'a changé.'; return; }
      A.log('info', 'Réglages « Cartes et remboursements » : ' + n + ' champ(s) modifié(s).');
      A.changed('comptes');
      A.toastAnnuler('Réglages enregistrés (' + n + ').', () => { R.restaurer(S(), avant); A.changed('comptes'); rafraichir(); });
      rafraichir();
      return;
    }
    const D = s.budget;
    if (b.dataset.rgdis && D && D.dismiss) {
      const avant = R.instantane(s);
      delete D.dismiss[b.dataset.rgdis];
      A.changed('budget');
      A.toastAnnuler('Observation réaffichée.', () => { R.restaurer(S(), avant); A.changed('budget'); rafraichir(); });
      rafraichir();
    } else if (b.dataset.rg === 'toutreafficher') {
      const avant = R.instantane(s);
      window.KladObservations.reafficher(s, Date.now());
      A.changed('budget');
      A.toastAnnuler('Observations réaffichées.', () => { R.restaurer(S(), avant); A.changed('budget'); rafraichir(); });
      rafraichir();
    } else if (b.dataset.rgexc && D && D.exc) {
      const avant = R.instantane(s);
      delete D.exc[b.dataset.rgexc];
      A.changed('budget');
      A.toastAnnuler('Opération remise dans le budget.', () => { R.restaurer(S(), avant); A.changed('budget'); rafraichir(); });
      rafraichir();
    }
  }
  for (const id of ['reglBudgetCorps', 'reglThemeCorps']) {
    $(id).addEventListener('click', actionTheme);
    $(id).addEventListener('input', () => { sale = true; });
  }

  // ------------------------------------------------------------ éditeur avancé
  A.preparer.secReglAvance = o => {
    neuf();
    if (o && o.rendu && sale) return;
    const s = S();
    $('reglAvanceCorps').innerHTML = '<div class="encart-reprise" data-encart-reprise hidden></div><p class="muted small">Complément complet tel que Klad l\'utilise (complément importé et réglages faits dans Klad). ' +
      'Vérifié avant l\'enregistrement ; chaque rubrique modifiée devient un réglage de Klad. Annulable.</p>' +
      '<label class="rg-champ" for="rgBrut"><span class="rg-l">Complément (JSON)</span><textarea id="rgBrut" rows="14" spellcheck="false" autocomplete="off">' + esc(R.brutEffectif(s)) + '</textarea></label>' +
      '<p class="rg-msg" id="rgBrutMsg" aria-live="polite"></p>' +
      '<div class="row"><button type="button" class="btn" data-rg="verifier">Vérifier</button><button type="button" class="btn" data-rg="brut">Enregistrer</button></div>' +
      '<div class="row">' + (avantAvance ? '<button type="button" class="btn" data-rg="annulerbrut">Annuler la dernière modification</button>' : '') +
      ((s.modele.reglages && s.modele.reglages.complement && Object.keys(s.modele.reglages.complement).length) ? '<button type="button" class="btn" data-rg="revenir">Revenir au complément importé</button>' : '') + '</div>';
    if (A.encartsReprise) A.encartsReprise();
  };
  $('reglAvanceCorps').addEventListener('input', () => { sale = true; });
  $('reglAvanceCorps').addEventListener('click', ev => {
    const b = ev.target.closest('button');
    if (!b) return;
    const s = S(), msg = $('rgBrutMsg');
    if (b.dataset.rg === 'verifier' || b.dataset.rg === 'brut') {
      const r = R.validerBrut($('rgBrut').value);
      if (!r.ok) { msg.textContent = r.erreur; return; }
      if (b.dataset.rg === 'verifier') { msg.textContent = 'Complément valide : ' + Object.keys(r.o).length + ' rubrique(s).'; return; }
      const avant = R.instantane(s);
      const ch = R.enregistrerBrut(s, r.o);
      sale = false;
      if (!ch.length) { msg.textContent = 'Rien n\'a changé.'; return; }
      avantAvance = avant;
      A.log('info', 'Éditeur avancé : ' + ch.length + ' rubrique(s) du complément modifiée(s).');
      A.changed('reglages');
      U.reglerApparence(s);
      A.toastAnnuler('Complément enregistré (' + ch.length + ' rubrique(s) : ' + ch.slice(0, 4).join(', ') + (ch.length > 4 ? '…' : '') + ').', annulerAvance);
      rafraichir();
    } else if (b.dataset.rg === 'annulerbrut') annulerAvance();
    else if (b.dataset.rg === 'revenir') {
      if (!A.confirmInline(b, 'Confirmer : réglages du complément retirés')) return;
      const avant = R.instantane(s);
      s.modele.reglages.complement = {};
      avantAvance = avant;
      sale = false;
      A.log('info', 'Réglages du complément retirés : complément importé seul.');
      A.changed('reglages');
      U.reglerApparence(s);
      A.toastAnnuler('Complément importé rétabli.', annulerAvance);
      rafraichir();
    }
  });
  function annulerAvance() {
    if (!avantAvance) return;
    R.restaurer(S(), avantAvance);
    avantAvance = null;
    A.changed('reglages');
    U.reglerApparence(S());
    A.toast('Modification annulée.');
    rafraichir();
  }

  // ------------------------------------------------------------ Plus › Données › Importer (reprise et complément)
  A.preparer.secImporter = () => {
    neuf();
    const s = S(), r = s.modele.reprise;
    const it = (ic, t, s2, attr) => '<button type="button" class="sh-li" ' + attr + '><span class="ic" aria-hidden="true">' + ic + '</span><span>' + esc(t) + (s2 ? '<small>' + esc(s2) + '</small>' : '') + '</span><span class="r" aria-hidden="true">›</span></button>';
    const nb = Object.keys(R.racineKlad(s)).length;
    let h = '<div class="sh-list">' +
      it('🧾', 'Relevé d\'un compte', 'CSV, JSON ou Excel, depuis Relevés des comptes', 'data-vue="donnees"') +
      it('📦', 'Reprise de l\'ancienne version', r ? 'Importée le ' + F.date(r.importee.slice(0, 10)) + ', ' + r.nb + ' opération(s) ; aperçu avant de confirmer' : 'Aucun import ; aperçu avant de confirmer', 'data-volet="secReprise" data-empiler="1"') + '</div>' +
      '<h3>Complément</h3><p class="muted small">' + (nb ? 'Complément importé : ' + nb + ' rubrique(s).' : 'Aucun complément importé.') +
      ' Un aperçu montre ce qui sera ajouté ou remplacé avant de confirmer. Les réglages faits dans Klad restent prioritaires.</p>';
    if (apercu) {
      const a = apercu.a, l = (t, L) => L.length ? '<li><div class="grow">' + t + '<small>' + esc(L.join(', ')) + '</small></div></li>' : '';
      h += '<div class="rg-apercu" id="complementApercu"><h4>Aperçu du complément</h4><ul class="list">' + l('Ajouté', a.ajoutes) + l('Remplacé', a.remplaces) + l('Identique', a.identiques) +
        l('Réglé dans Klad (reste prioritaire)', a.prioritaires) + '</ul>' +
        (a.ajoutes.length + a.remplaces.length ? '' : '<p class="muted">Rien de nouveau dans ce complément.</p>') +
        '<div class="row"><button type="button" class="btn" data-rg="importer"' + (a.ajoutes.length + a.remplaces.length ? '' : ' disabled') + '>Importer</button><button type="button" class="btn" data-rg="abandon">Annuler</button></div></div>';
    } else h += '<div class="row"><button type="button" class="btn" data-rg="choisir">Choisir un complément</button></div>';
    $('importerCorps').innerHTML = h;
  };
  $('importerCorps').addEventListener('click', ev => {
    const b = ev.target.closest('button[data-rg]');
    if (!b) return;
    const s = S();
    if (b.dataset.rg === 'choisir') {
      A.busy(b, async () => {
        const h = A.hooks();
        const texte = h.choisirFichier ? await h.choisirFichier() : null;
        if (texte == null) return;
        const klad = R.lireComplement(texte);
        if (s.carnet == null || typeof s.carnet !== 'object') throw new Error('Importez d\'abord la reprise de l\'ancienne version.');
        apercu = { klad, a: R.apercuComplement(s, klad) };
        A.preparer.secImporter();
      });
    } else if (b.dataset.rg === 'abandon') { apercu = null; A.preparer.secImporter(); }
    else if (b.dataset.rg === 'importer' && apercu) {
      A.busy(b, async () => {
        R.importerComplement(s, apercu.klad);
        const n = apercu.a.ajoutes.length + apercu.a.remplaces.length;
        apercu = null;
        A.log('info', 'Complément de classement importé.');
        const r = window.KladPlus ? await window.KladPlus.reprendreClassement(s) : null;
        if (!r) A.changed('reglages');
        U.reglerApparence(s);
        A.toast('Complément importé : ' + n + ' rubrique(s) ajoutée(s) ou remplacée(s)' + (r ? ', ' + r.base + ' règles de base' : '') + '.');
        A.preparer.secImporter();
      });
    }
  });
})();
