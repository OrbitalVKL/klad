// Klad — éléments d'interface communs aux écrans (apparence de l'ancienne version) : montants, dates, pastilles d'état,
// icônes de catégories, pastilles de banque, sections dépliantes avec mémoire de l'état.
// Chaînes HTML, sans accès au DOM sauf pour la mémoire des sections (stockage local du téléphone, hors coffre,
// sans donnée personnelle : seulement des identifiants de section). Testé dans node.
// Aucun montant n'est affiché avec un signe moins : « +1 234 € » pour un crédit, « 1 234 € » pour un débit (couleur et mots
// disent le sens : « dépassé de », « débiteur », « de moins »).
(function (g) {
  'use strict';

  const F = () => g.KladFormat;
  const KB = () => g.KladBudget;
  const K = () => g.KladClasse;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ------------------------------------------------------------ montants (centimes) et dates
  const e0 = c => KB().eur(c);                       // « 1 234 € »
  const e2 = c => F().montant(c);                    // « 1 234,56 € »
  // Signé sans signe moins : crédit « +1 234 € », débit « 1 234 € ».
  const plus0 = c => (c > 49 ? '+' : '') + e0(Math.abs(c));
  const plus2 = c => (c > 0 ? '+' : '') + e2(Math.abs(c));
  const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const MOIS_L = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const mLabel = m => MOIS[+m.slice(5, 7) - 1] + ' ' + m.slice(2, 4);          // « oct. 26 »
  const mLong = (m, auj) => { const t = MOIS_L[+m.slice(5, 7) - 1]; return t[0].toUpperCase() + t.slice(1) + (auj && m.slice(0, 4) === auj.slice(0, 4) ? '' : ' ' + m.slice(0, 4)); };
  const dfr = d => d ? d.split('-').reverse().join('/') : '';                     // « 28/10/2026 »
  const jjmm = d => d ? d.slice(8, 10) + '/' + d.slice(5, 7) : '';                // « 28/10 »
  const jjmmaa = d => d ? d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(2, 4) : '';
  const dLong = d => { const j = +d.slice(8, 10); return (j === 1 ? '1er' : j) + ' ' + MOIS_L[+d.slice(5, 7) - 1]; };
  const pluriel = (n, s, p) => n + ' ' + (n > 1 ? (p || s + 's') : s);

  // Pastille d'état : { niveau: good | warn | bad | info | muted, texte }.
  function chip(st, txt) {
    if (st == null) return '';
    if (typeof st === 'string') return '<span class="chip ' + esc(st) + '">' + esc(txt) + '</span>';
    if (st.niveau === 'muted') return '<span class="muted">' + esc(st.texte) + '</span>';
    return '<span class="chip ' + esc(st.niveau || 'info') + '">' + esc(st.texte) + '</span>';
  }

  // ------------------------------------------------------------ icônes de catégories
  // Couleur de chaque catégorie générique (celles de l'ancienne version) ; les autres : réglage `couleurs` du complément,
  // sinon couleur devinée d'après le nom, sinon gris.
  const COULEURS = {
    'Logement': '#5b6ee1', 'Assurances': '#7a5af8', 'Abonnements & télécom': '#0ea5e9', 'Crédits': '#64748b', 'Impôts': '#6b7280', 'Banque': '#475569',
    'Alimentation': '#16a34a', 'Carburant': '#ea580c', 'Voiture': '#b45309', 'Transport': '#0891b2', 'Santé': '#dc2626', 'Formation & éducation': '#4f46e5',
    'Espèces': '#65a30d', 'Appartement': '#a16207', 'Bars': '#d97706', 'Events': '#db2777', 'Restaurant': '#e11d48', 'Shopping': '#9333ea', 'Vacances': '#0d9488',
    'Cadeaux': '#c026d3', 'Virements à des proches': '#0f766e', 'Courses': '#16a34a', 'Parking': '#0891b2', 'Sport': '#0284c7', 'IA': '#6d28d9',
    'Autres': '#9ca3af', 'Divers': '#9ca3af', 'Revenus': '#15803d', 'Salaire': '#15803d', 'Remboursements santé': '#0f766e',
    'Remboursements entre amis': '#0d9488', 'Famille': '#65a30d', 'Ventes': '#ca8a04', 'Autres revenus': '#15803d', 'Apports compte commun': '#15803d',
    'Épargne': '#be185d', 'Virements internes': '#94a3b8'
  };
  const DEVINE = [[/\bIA\b|\bAI\b|INTELLIGENCE ARTIF/, 'lu:bot', '#6d28d9'], [/SPORT|GYM|FITNESS|ESCALADE|SALLE/, 'lu:dumbbell', '#0284c7'], [/ANIMA|CHAT|CHIEN|VETO/, 'lu:paw-print', '#a16207'],
    [/ENFANT|BEBE|CRECHE|NOUNOU/, 'lu:toy-brick', '#db2777'], [/MAISON|DECO|BRICO|JARDIN|MEUBLE/, 'lu:sofa', '#a16207'], [/COURSE|SUPERMARCHE|MARCHE/, 'lu:shopping-cart', '#16a34a'],
    [/CADEAU/, 'lu:gift', '#c026d3'], [/VOYAGE|VACANCE|HOTEL|AVION/, 'lu:plane', '#0d9488'], [/LIVRE|CULTURE|MUSIQUE|JEU|LOISIR/, 'lu:gamepad-2', '#7c3aed'],
    [/BEAUTE|COIFF|SOIN|VETEMENT|MODE/, 'lu:shirt', '#9333ea'], [/ABONNEMENT|STREAMING|LOGICIEL|SERVICE/, 'lu:smartphone', '#0ea5e9'], [/DON|ASSO|CHARIT/, 'lu:heart-handshake', '#e11d48'],
    [/PRO|TRAVAIL|BUREAU|ENTREPRISE/, 'lu:briefcase', '#475569'], [/EPARGNE|INVEST|BOURSE/, 'lu:trending-up', '#be185d'], [/SANTE|PHARMA|MEDEC/, 'lu:pill', '#dc2626'],
    [/IMPOT|TAXE/, 'lu:landmark', '#6b7280'], [/VOITURE|AUTO|MOTO|VELO/, 'lu:bike', '#0891b2']];
  const SVG = {
    lamp: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3h8l3 8H5z"/><path d="M12 11v7"/><path d="M8 21h8"/></svg>',
    star: '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="#dc2626" d="M12 2l2.9 6.9 7.1.6-5.4 4.7 1.6 7L12 17.3 5.8 21.2l1.6-7L2 9.5l7.1-.6z"/></svg>',
    dumbbell: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M7 12h10"/><rect x="3.5" y="7.5" width="3.5" height="9" rx="1" fill="currentColor"/><rect x="17" y="7.5" width="3.5" height="9" rx="1" fill="currentColor"/><path d="M2 10.5v3M22 10.5v3"/></svg>',
    parking: '<svg viewBox="0 0 24 24" width="17" height="17"><rect x="2" y="2" width="20" height="20" rx="5" fill="#1d4ed8"/><path d="M9.5 17.5V6.5h3.6a3.3 3.3 0 010 6.6H9.5" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };
  const fold = s => String(s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  let EXT = { couleurs: {}, pastilles: [] };           // réglages d'apparence du complément (données, jamais dans le code)
  function reglerApparence(S) {
    const Rc = S && S.carnet && KB() ? KB().racine(S.carnet) : null, X = (Rc && Rc.klad) || {};
    const c = X.couleurs && typeof X.couleurs === 'object' ? X.couleurs : {};
    const p = X.pastilles && typeof X.pastilles === 'object' ? Object.keys(X.pastilles).map(k => [fold(k), X.pastilles[k]]) : [];
    EXT = { couleurs: c, pastilles: p.filter(x => Array.isArray(x[1]) && x[1].length >= 2) };
  }
  // C (facultatif) : classement ; une couleur choisie dans Klad (sélecteur d'icône, 0.10.7) passe avant le reste.
  function couleurDe(cat, C) {
    const c = C && C.categories && C.categories[cat];
    if (c && typeof c.couleur === 'string' && /^#[0-9a-f]{6}$/i.test(c.couleur)) return c.couleur;
    if (EXT.couleurs[cat]) return String(EXT.couleurs[cat]);
    if (COULEURS[cat]) return COULEURS[cat];
    const f = fold(cat);
    for (const [rx, , c] of DEVINE) if (rx.test(f)) return c;
    return '#8b95a1';
  }
  // Icône d'une catégorie : celle enregistrée (« lu:<nom> » ; 0.10.9 : émojis et icônes reprises affichés en icône
  // dessinée), sinon celle d'office, sinon une icône de la banque proposée d'après le nom (0.10.7 : plus de lettre de repli).
  function iconeDe(C, cat) {
    const i = K().iconeDe(C, cat);
    const I = g.KladIcones;
    if (!I || !I.absente(i)) return i;
    return I.proposer(cat);
  }
  const iconHtml = spec => {
    const s = String(spec);
    if (s.startsWith('svg:')) return SVG[s.slice(4)] || '';
    if (s.startsWith('lu:') && g.KladIcones) return g.KladIcones.svg(s.slice(3));
    return esc(spec);
  };
  // Pastille ronde colorée d'une catégorie (spec : icône imposée, ex. « svg:parking »).
  function cico(C, cat, spec) {
    const sp = spec || iconeDe(C, cat), col = couleurDe(cat, C);
    return '<span class="cico' + (/^(svg|lu):/.test(String(sp)) ? ' svg' : '') + '" style="--cc:' + esc(col) + ';color:' + esc(col) + '" title="' + esc(cat) + '" aria-hidden="true">' + iconHtml(sp) + '</span>';
  }
  // Icône d'une opération : stationnement et courses ont la leur (comme l'ancienne version).
  function icoOp(C, r) {
    if (r.sub === 'Charges parking' || /PARKING|INDIGO|EFFIA|ONEPARK/i.test(r.label || '')) return cico(C, r.cat, 'lu:square-letter-p');
    if (r.sub === 'Courses') return cico(C, r.cat, 'lu:shopping-cart');
    return cico(C, r.cat);
  }
  // Icône d'un poste du budget.
  function icoPoste(C, a) {
    if (a.label === 'Charges parking') return cico(C, 'Logement', 'lu:square-letter-p');
    return cico(C, a.nat === 'fixe' ? (a.cat || 'Logement') : a.label);
  }

  // ------------------------------------------------------------ reste à vivre : interrupteur de la base affichée (0.10.7)
  // base : « salaire » ou « comptes » ; sans solde connu, « Comptes courants » est désactivé.
  function interrupteurRav(base, avecComptes) {
    const b = (k, t) => '<button type="button" data-ravbase="' + k + '" aria-pressed="' + (base === k) + '"' + (k === 'comptes' && !avecComptes ? ' disabled' : '') + '>' + t + '</button>';
    return '<div class="seg rav-base" role="group" aria-label="Base du reste à vivre">' + b('salaire', 'Dernier salaire') + b('comptes', 'Comptes courants') + '</div>';
  }

  // ------------------------------------------------------------ pastille de banque (initiales sur la couleur de la banque)
  const TEINTES = ['#0b3f8c', '#0a9a8a', '#1f6fc0', '#1a3d8f', '#7a5af8', '#b45309', '#be185d', '#15803d'];
  function bico(S, c, petit) {
    const cx = c && c.source && c.source.connexion && S && S.modele.connexions[c.source.connexion];
    const nom = (cx && cx.banque) || '';
    const F2 = fold(nom + ' ' + (c ? c.libelle : ''));
    const p = EXT.pastilles.find(x => x[0] && F2.indexOf(x[0]) >= 0);
    let t, col;
    if (p) { t = String(p[1][0]).slice(0, 3); col = String(p[1][1]); }
    else {
      const base = nom || (c ? c.libelle : '?');
      const mots = base.replace(/[^A-Za-zÀ-ÿ0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
      t = mots.length === 1 && mots[0].length <= 3 ? mots[0].toUpperCase() : mots.slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
      let h = 0; for (const ch of base) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
      col = TEINTES[h % TEINTES.length];
    }
    return '<span class="bico' + (petit ? ' sm' : '') + '" style="--bc:' + esc(col) + '" aria-hidden="true">' + esc(t) + '</span>';
  }

  // ------------------------------------------------------------ sections dépliantes (mémoire de l'état sur ce téléphone)
  // 0.10.4 (sous-vues de Budget et Commun) : l'état est gardé sous « klad.replis.v2 », créé une seule fois à partir de
  // « klad.replis » par la table MIGRATION_PLIS (marque « klad.replis.v » = 2). L'ancienne clé n'est pas effacée : une
  // version antérieure réinstallée la retrouve telle quelle.
  const CLE_ANCIENNE = 'klad.replis', CLE_PLIS = 'klad.replis.v2', CLE_MARQUE = 'klad.replis.v';
  // ancien identifiant → nouveau (null : section disparue, ou toujours ouverte dans sa sous-vue)
  const MIGRATION_PLIS = { 'tend-panel': null, 'p-contrats': null, 'cats-panel': null, 'rules-panel': null };
  // Repliées au départ, comme l'ancienne version (Tendance et Contrats ont leur sous-vue, toujours ouvertes).
  const REPLIES = { actions: 1, 'eq-uses-panel': 1, 'eq-ops-panel': 1 };
  let plis = null;
  function migrerPlis(ancien) {
    const out = {};
    for (const k of Object.keys(ancien || {})) {
      const n = k in MIGRATION_PLIS ? MIGRATION_PLIS[k] : k;
      if (n) out[n] = ancien[k] ? 1 : 0;
    }
    return out;
  }
  function lirePlis() {
    if (plis) return plis;
    plis = {};
    try {
      const L = g.localStorage;
      if (L && L.getItem(CLE_MARQUE) !== '2') {
        let a = {};
        try { a = JSON.parse(L.getItem(CLE_ANCIENNE) || '{}') || {}; } catch (e) { a = {}; }
        L.setItem(CLE_PLIS, JSON.stringify(migrerPlis(a)));
        L.setItem(CLE_MARQUE, '2');
      }
      const t = L && L.getItem(CLE_PLIS);
      if (t) plis = JSON.parse(t) || {};
    } catch (e) { plis = {}; }
    return plis;
  }
  const replie = id => { const p = lirePlis(); return id in p ? !!p[id] : !!REPLIES[id]; };
  function plier(id, oui) {
    const p = lirePlis(); p[id] = oui ? 1 : 0;
    try { g.localStorage.setItem(CLE_PLIS, JSON.stringify(p)); } catch (e) { /* stockage indisponible : état gardé pour la session */ }
  }
  // Préférences d'affichage gardées sur ce téléphone (hors coffre) : seulement des réglages d'interface, jamais de donnée.
  const PREFS = ['periode', 'tendance', 'opsPerimetre'];
  function pref(nom, val) {
    if (PREFS.indexOf(nom) < 0) throw new Error('préférence inconnue');
    const k = 'klad.' + nom;
    try {
      if (val === undefined) { const t = g.localStorage.getItem(k); return t ? JSON.parse(t) : null; }
      if (val === null) g.localStorage.removeItem(k); else g.localStorage.setItem(k, JSON.stringify(val));
    } catch (e) { /* stockage indisponible : préférence pour la session */ }
    return val;
  }
  // En-tête de section dépliante : <div class="panel-h"><h2 class="fold">…</h2>…</div>.
  const tete = (titre, apres) => '<div class="panel-h"><h2 class="fold" role="button" tabindex="0" title="Replier / déplier">' + esc(titre) + '</h2>' + (apres || '') + '</div>';
  // Pose l'état replié et aria-expanded sur une section (élément .panel avec un id).
  function appliquerPli(el) {
    if (!el || !el.id) return;
    const c = replie(el.id) && !el.classList.contains('force-open');
    el.classList.toggle('collapsed', c);
    const h = el.querySelector(':scope>.panel-h h2');
    if (!h) return;
    // section nommée par son titre (lecteur d'écran)
    if (!h.id) h.id = el.id + '-t';
    if (!el.hasAttribute('aria-label')) el.setAttribute('aria-labelledby', h.id);
    // Comme l'ancienne version : tout titre de section devient dépliant.
    if (!h.classList.contains('fold')) { h.classList.add('fold'); h.setAttribute('role', 'button'); h.tabIndex = 0; h.title = 'Replier / déplier'; }
    h.setAttribute('aria-expanded', String(!c));
  }
  // Calcul dans un champ de montant, comme l'ancienne version : « 29,99+64 », « =566,19/3 », parenthèses.
  // Analyse sans eval ; → nombre arrondi au centime, ou null si l'écriture n'est pas un calcul simple.
  function calcul(txt) {
    const t = String(txt == null ? '' : txt).trim().replace(/^=/, '').replace(/[\s\u00a0\u202f€]/g, '').replace(/,/g, '.');
    if (!t || !/^[0-9.+\-*/()]+$/.test(t)) return null;
    let i = 0;
    const nombre = () => { const m = /^\d+(\.\d+)?|^\.\d+/.exec(t.slice(i)); if (!m) throw 0; i += m[0].length; return +m[0]; };
    const facteur = () => {
      if (t[i] === '-') { i++; return -facteur(); }
      if (t[i] === '+') { i++; return facteur(); }
      if (t[i] === '(') { i++; const v = somme(); if (t[i] !== ')') throw 0; i++; return v; }
      return nombre();
    };
    const produit = () => { let v = facteur(); while (t[i] === '*' || t[i] === '/') { const o = t[i++], w = facteur(); v = o === '*' ? v * w : v / w; } return v; };
    const somme = () => { let v = produit(); while (t[i] === '+' || t[i] === '-') { const o = t[i++], w = produit(); v = o === '+' ? v + w : v - w; } return v; };
    try { const v = somme(); return i === t.length && isFinite(v) ? Math.round(v * 100) / 100 : null; } catch (e) { return null; }
  }
  const estCalcul = txt => { const r = String(txt || '').trim(); return r.startsWith('=') || /[+*/()]|\d\s*-/.test(r.replace(/^[=-]/, '')); };

  // Graduation d'un axe de graphique (centimes) : valeur absolue ; sous zéro, l'appelant la colore en rouge (aucun signe moins).
  const graduation = c => { const eu = Math.abs(c) / 100; return eu >= 1000 ? (Math.round(eu / 100) / 10).toLocaleString('fr-FR') + ' k€' : Math.round(eu) + ' €'; };
  const couleurGraduation = c => c < 0 ? 'var(--bad)' : 'var(--muted)';
  // Note « Comment c'est calculé » repliable.
  const comment = t => '<details class="bnote"><summary>Comment c\'est calculé</summary><p class="note">' + t + '</p></details>';

  g.KladUI = {
    esc, e0, e2, plus0, plus2, MOIS, MOIS_L, mLabel, mLong, dfr, jjmm, jjmmaa, dLong, pluriel, chip,
    interrupteurRav, COULEURS, SVG, reglerApparence, couleurDe, iconeDe, iconHtml, cico, icoOp, icoPoste, bico,
    replie, plier, migrerPlis, MIGRATION_PLIS, pref, PREFS, tete, appliquerPli, comment, graduation, couleurGraduation, calcul, estCalcul
  };
})(typeof window !== 'undefined' ? window : globalThis);
