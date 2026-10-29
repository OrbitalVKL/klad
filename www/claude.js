// Klad — extra « Claude » : appels à l'API Anthropic avec la clé saisie dans l'appli (chiffrée dans le coffre).
// Trois usages : lire un bulletin de paie ou un avis d'impôt (format fiscal existant), lire le montant d'un appel de
// fonds, « Analyse de Claude » du budget, du compte commun ou des impôts. On envoie le strict minimum : le document
// choisi, ou des agrégats (totaux, postes, soldes) — jamais l'historique des opérations, un IBAN, un nom de banque ni
// un libellé bancaire brut ; les deux personnes du foyer sont désignées « personne A » et « personne B ».
// Ce fichier construit les requêtes et lit les réponses ; l'envoi passe par fetch (natif dans l'appli).
(function (g) {
  'use strict';

  const API = 'https://api.anthropic.com/v1';
  const VERSION = '2026-10-21';
  // Prix publics en dollars par million de jetons (entrée, sortie), facturés sur les crédits API du compte.
  const MODELES = {
    'claude-opus-5-5': { nom: 'Claude Opus 5.5 (recommandé)', entree: 4, sortie: 20, repli: true },
    'claude-sonnet-5-5': { nom: 'Claude Sonnet 5.5', entree: 2, sortie: 10, repli: true },
    'claude-haiku-5-5': { nom: 'Claude Haiku 5.5 (le moins cher)', entree: 0.10, sortie: 0.50, repli: false }
  };
  const DEFAUT = 'claude-opus-5-5';
  const modele = m => (MODELES[m] ? m : DEFAUT);

  const SYSTEME = 'Tu aides le propriétaire d\'un carnet de comptes personnel (France). Réponds en français. ' +
    'Les montants sont en euros. N\'invente aucun chiffre : si une valeur n\'apparaît pas dans le document, mets 0 (ou une chaîne vide).';

  // ------------------------------------------------------------ tâches
  const nombre = { type: 'number' };
  const texte = { type: 'string' };
  const objet = (props) => ({ type: 'object', properties: props, required: Object.keys(props), additionalProperties: false });
  const TACHES = {
    bulletin: {
      titre: 'Lire un bulletin de paie', document: true, effort: 'medium', sortieEstimee: 1500,
      consigne: 'Voici un bulletin de paie français. Relève : l\'employeur, le mois du salaire (AAAA-MM), la date de paiement ' +
        '(AAAA-MM-JJ, à défaut le dernier jour du mois), le salaire brut, le net imposable du mois (« net imposable » ou ' +
        '« net fiscal », pas le cumul annuel), le montant du prélèvement à la source du mois (positif), le taux appliqué (en %) ' +
        'et le type de taux : « personnalise » (taux du foyer transmis par l\'administration), « neutre » (taux par défaut, non ' +
        'personnalisé) ou « individualise ».',
      schema: objet({ employeur: texte, mois_salaire: texte, date_paiement: texte, brut: nombre, net_imposable: nombre,
        prelevement_source: nombre, taux_pas: nombre, type_taux: { type: 'string', enum: ['personnalise', 'neutre', 'individualise'] } })
    },
    avis: {
      titre: 'Lire un avis d\'impôt sur le revenu', document: true, effort: 'medium', sortieEstimee: 2500,
      consigne: 'Voici un avis d\'impôt sur le revenu français (déclaration commune, déclarant 1 et déclarant 2). Relève, pour ' +
        'l\'année des revenus : le nombre de parts, les salaires déclarés de chaque déclarant, la déduction pour frais de chacun ' +
        '(10 % ou frais réels) et s\'il s\'agit de frais réels, les revenus fonciers nets, les revenus de capitaux mobiliers, le ' +
        'revenu net imposable, l\'impôt au barème (avant décote), la décote, l\'impôt sur le revenu net, les prélèvements sociaux, ' +
        'le total déjà prélevé à la source (et acomptes), le reste à payer ou le remboursement (montants positifs, l\'autre à 0), ' +
        'le revenu fiscal de référence, le taux marginal (tranche, en %) et le plafond épargne retraite de chaque déclarant.',
      schema: objet({ annee_revenus: nombre, parts: nombre, salaires_1: nombre, salaires_2: nombre, deduction_1: nombre,
        deduction_2: nombre, frais_reels_1: { type: 'boolean' }, frais_reels_2: { type: 'boolean' }, revenus_fonciers: nombre,
        capitaux_mobiliers: nombre, revenu_net_imposable: nombre, impot_bareme: nombre, decote: nombre, impot_net: nombre,
        prelevements_sociaux: nombre, preleve_source: nombre, reste_a_payer: nombre, remboursement: nombre,
        revenu_fiscal_reference: nombre, taux_marginal: nombre, plafond_per_1: nombre, plafond_per_2: nombre })
    },
    appel: {
      titre: 'Lire un appel de fonds', document: true, effort: 'low', sortieEstimee: 800,
      consigne: 'Voici un appel de fonds de copropriété (syndic). Relève la date d\'exigibilité (AAAA-MM-JJ), le montant total ' +
        'appelé pour le copropriétaire (positif) et la nature : « charges » (provisions sur charges courantes), « avance » ' +
        '(avance de trésorerie, fonds de roulement) ou « travaux ».',
      schema: objet({ date_exigibilite: texte, montant_total: nombre, nature: { type: 'string', enum: ['charges', 'avance', 'travaux'] } })
    },
    analyse: {
      titre: 'Analyse de Claude', document: false, effort: 'high', sortieEstimee: 4000,
      consigne: 'Voici un résumé chiffré de la situation (agrégats calculés par l\'appli, sans opérations détaillées). ' +
        'Fais une analyse courte et concrète : trois à six constats, puis trois actions possibles, avec les montants en jeu. ' +
        'Pas de tableau, pas de titre, paragraphes courts. Ne répète pas les chiffres sans les interpréter.'
    }
  };

  // Libellés des champs lus, pour la vérification avant enregistrement.
  const LIBELLES = { employeur: 'Employeur', mois_salaire: 'Mois du salaire', date_paiement: 'Payé le', brut: 'Salaire brut (€)', net_imposable: 'Net imposable (€)',
    prelevement_source: 'Prélèvement à la source (€)', taux_pas: 'Taux (%)', type_taux: 'Type de taux', annee_revenus: 'Revenus de', parts: 'Parts',
    salaires_1: 'Salaires déclarant 1 (€)', salaires_2: 'Salaires déclarant 2 (€)', deduction_1: 'Déduction frais déclarant 1 (€)', deduction_2: 'Déduction frais déclarant 2 (€)',
    frais_reels_1: 'Frais réels déclarant 1', frais_reels_2: 'Frais réels déclarant 2', revenus_fonciers: 'Revenus fonciers nets (€)', capitaux_mobiliers: 'Revenus de capitaux (€)',
    revenu_net_imposable: 'Revenu net imposable (€)', impot_bareme: 'Impôt au barème (€)', decote: 'Décote (€)', impot_net: 'Impôt net (€)', prelevements_sociaux: 'Prélèvements sociaux (€)',
    preleve_source: 'Déjà prélevé (€)', reste_a_payer: 'Reste à payer (€)', remboursement: 'Remboursement (€)', revenu_fiscal_reference: 'Revenu fiscal de référence (€)',
    taux_marginal: 'Taux marginal (%)', plafond_per_1: 'Plafond épargne retraite déclarant 1 (€)', plafond_per_2: 'Plafond épargne retraite déclarant 2 (€)',
    date_exigibilite: 'Exigible le', montant_total: 'Montant appelé (€)', nature: 'Nature' };
  const VALEURS = { personnalise: 'personnalisé', neutre: 'non personnalisé', individualise: 'individualisé', charges: 'charges courantes', avance: 'avance de trésorerie', travaux: 'travaux', true: 'oui', false: 'non' };
  const libelle = k => LIBELLES[k] || k.replace(/_/g, ' ');
  const valeur = v => (typeof v === 'number' ? v.toLocaleString('fr-FR') : /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? String(v).split('-').reverse().join('/') : VALEURS[String(v)] || String(v));

  // ------------------------------------------------------------ requêtes
  function entetes(cle, m, comptage) {
    const h = { 'content-type': 'application/json', 'x-api-key': cle, 'anthropic-version': VERSION,
      'anthropic-dangerous-direct-browser-access': 'true' };          // mode navigateur (dans l'appli, l'envoi est natif)
    if (MODELES[modele(m)].repli && !comptage) h['anthropic-beta'] = 'server-side-fallback-2026-07-01';
    return h;
  }
  // entree : { pdf: base64 } pour un document, { texte } pour une analyse.
  function messages(tache, entree) {
    const T = TACHES[tache];
    if (!T) throw new Error('Tâche inconnue.');
    const contenu = [];
    if (T.document) {
      if (!entree || !entree.pdf) throw new Error('Aucun document à lire.');
      contenu.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: entree.pdf } });
      contenu.push({ type: 'text', text: T.consigne });
    } else contenu.push({ type: 'text', text: T.consigne + '\n\n' + String((entree && entree.texte) || '') });
    return [{ role: 'user', content: contenu }];
  }
  function corps(tache, entree, m) {
    const T = TACHES[tache], mo = modele(m);
    const b = { model: mo, max_tokens: 16000, system: SYSTEME, messages: messages(tache, entree), output_config: { effort: T.effort } };
    if (T.schema) b.output_config.format = { type: 'json_schema', schema: T.schema };
    if (MODELES[mo].repli) b.fallbacks = 'default';          // en cas de refus, l'API relance sur un autre modèle
    return b;
  }
  // Coût en dollars d'un nombre de jetons d'entrée et de sortie.
  const cout = (m, ein, eout) => { const P = MODELES[modele(m)]; return (ein * P.entree + eout * P.sortie) / 1e6; };
  const dollars = v => (v < 0.01 ? 'moins de 0,01 $' : 'environ ' + v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' $');

  // Ce qui sera envoyé, lisible par le propriétaire avant confirmation.
  function apercu(tache, entree) {
    const T = TACHES[tache];
    if (T.document) {
      const ko = Math.round(((entree.pdf || '').length * 3 / 4) / 1024);
      return 'Envoyé à Claude : le document « ' + (entree.nom || 'document.pdf') + ' » (' + ko + ' Ko, PDF) et cette consigne :\n« ' + T.consigne + ' »\nRien d\'autre.';
    }
    return 'Envoyé à Claude, en entier (rien d\'autre) :\n\n' + T.consigne + '\n\n' + entree.texte;
  }

  async function appel(fetch, chemin, cle, m, b) {
    let res;
    try { res = await fetch(API + chemin, { method: 'POST', headers: entetes(cle, m, chemin !== '/messages'), body: JSON.stringify(b) }); }
    catch (e) { throw new Error('Claude injoignable (réseau).'); }
    let j = null;
    try { j = await res.json(); } catch (e) { j = null; }
    if (!res.ok) {
      const s = res.status;
      throw new Error(s === 401 ? 'Clé Claude refusée : vérifiez-la dans Plus › Extras.' : s === 402 || (j && j.error && /credit/i.test(j.error.message || ''))
        ? 'Crédits API épuisés : rechargez-les sur la console Anthropic.' : s === 429 ? 'Trop de demandes : réessayez dans une minute.'
          : s === 413 ? 'Document trop lourd pour Claude.' : 'Erreur de Claude (' + s + ').');
    }
    return j || {};
  }
  // Estimation avant envoi : jetons d'entrée comptés par l'API (gratuit), sortie estimée selon la tâche.
  async function estimer(fetch, cle, tache, entree, m) {
    const b = corps(tache, entree, m);
    const j = await appel(fetch, '/messages/count_tokens', cle, m, { model: b.model, system: b.system, messages: b.messages });
    const ein = +j.input_tokens || 0, eout = TACHES[tache].sortieEstimee;
    return { entree: ein, sortie: eout, dollars: cout(m, ein, eout), texte: dollars(cout(m, ein, eout)) + ' (crédits API)' };
  }
  // Lecture de la réponse : refus, texte, JSON de la tâche. → { resultat, texte, jetons: { entree, sortie }, dollars }.
  function lire(tache, j, m) {
    if (j.stop_reason === 'refusal') throw new Error('Claude a refusé de traiter ce document.');
    if (j.stop_reason === 'max_tokens') throw new Error('Réponse de Claude incomplète.');
    const t = (j.content || []).filter(x => x.type === 'text').map(x => x.text).join('').trim();
    const u = j.usage || {};
    const r = { texte: t, jetons: { entree: +u.input_tokens || 0, sortie: +u.output_tokens || 0 }, modele: j.model || modele(m) };
    r.dollars = cout(r.modele, r.jetons.entree + (+u.cache_read_input_tokens || 0) + (+u.cache_creation_input_tokens || 0), r.jetons.sortie);
    if (TACHES[tache].schema) {
      try { r.resultat = JSON.parse(t); } catch (e) { throw new Error('Réponse de Claude illisible.'); }
    }
    return r;
  }
  async function demander(fetch, cle, tache, entree, m) {
    return lire(tache, await appel(fetch, '/messages', cle, m, corps(tache, entree, m)), m);
  }
  // Vérification de la clé sans frais (comptage de jetons).
  async function tester(fetch, cle, m) {
    await appel(fetch, '/messages/count_tokens', cle, m, { model: modele(m), messages: [{ role: 'user', content: 'test' }] });
    return true;
  }

  // ------------------------------------------------------------ conversions vers les formats de Klad
  const date = s => (/^\d{4}-\d{2}-\d{2}$/.test(String(s)) ? String(s) : '');
  const mois = s => (/^\d{4}-\d{2}$/.test(String(s)) ? String(s) : '');
  const n2 = v => Math.round((+v || 0) * 100) / 100;
  // Bulletin → entrée de S.budget.fisc.bs ({ p, emp, m, pay, ni, pas, taux, type, brut }), p : 'g' (personne A) ou 's'.
  function versBulletin(R, p, now) {
    const m = mois(R.mois_salaire) || (date(R.date_paiement) || '').slice(0, 7);
    if (!m) throw new Error('Mois du salaire introuvable sur le bulletin.');
    return { p: p === 's' ? 's' : 'g', emp: String(R.employeur || '').trim().slice(0, 60) || 'Employeur', m,
      pay: date(R.date_paiement) || m + '-28', ni: n2(R.net_imposable), pas: n2(Math.abs(R.prelevement_source)), taux: n2(R.taux_pas),
      type: R.type_taux === 'neutre' ? 'neutre' : R.type_taux === 'individualise' ? 'indiv' : 'perso', brut: n2(R.brut),
      src: 'claude', mt: new Date(now).toISOString() };
  }
  // Avis → entrée de S.budget.fisc.avis[année] (format de l'ancienne version) ; inverser : déclarant 1 = personne B.
  function versAvis(R, inverser) {
    const a = inverser ? '2' : '1', b = inverser ? '1' : '2';
    const rni = Math.round(+R.revenu_net_imposable || 0), irNet = Math.round(+R.impot_net || 0);
    return { rev: Math.round(+R.annee_revenus || 0), parts: n2(R.parts), sal: { g: Math.round(+R['salaires_' + a] || 0), s: Math.round(+R['salaires_' + b] || 0) },
      ded: { g: Math.round(+R['deduction_' + a] || 0), s: Math.round(+R['deduction_' + b] || 0) }, fr: { g: !!R['frais_reels_' + a], s: !!R['frais_reels_' + b] },
      fonc: Math.round(+R.revenus_fonciers || 0), rcm: Math.round(+R.capitaux_mobiliers || 0), rni, irBar: Math.round(+R.impot_bareme || 0),
      decote: Math.round(+R.decote || 0), prop: 0, cred: 0, irNet, pas: Math.round(+R.preleve_source || 0), ps: Math.round(+R.prelevements_sociaux || 0),
      solde: Math.round((+R.reste_a_payer || 0) - (+R.remboursement || 0)), rfr: Math.round(+R.revenu_fiscal_reference || 0),
      tmi: Math.round(+R.taux_marginal || 0), tmoy: rni > 0 ? Math.round(irNet / rni * 1000) / 10 : 0,
      per: { g: Math.round(+R['plafond_per_' + a] || 0), s: Math.round(+R['plafond_per_' + b] || 0) }, src: 'claude' };
  }
  // Appel de fonds → entrée de S.budget.appels.pdfs ({ cp, kind, d, a, name }).
  function versAppel(R, cp, nom) {
    const d = date(R.date_exigibilite);
    if (!d) throw new Error('Date d\'exigibilité introuvable sur l\'appel de fonds.');
    return { cp: cp || null, kind: R.nature === 'avance' ? 'avance' : 'charges', d, a: n2(Math.abs(R.montant_total)), name: String(nom || '').slice(0, 80), src: 'claude' };
  }

  g.KladClaude = { API, VERSION, MODELES, DEFAUT, TACHES, libelle, valeur, entetes, messages, corps, cout, dollars, apercu, estimer, lire, demander, tester,
    versBulletin, versAvis, versAppel };
})(typeof window !== 'undefined' ? window : globalThis);
