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
    const X = S && KB() ? KB().complement(S) : {};
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
  // valeurs (2.1, facultatif) : { salaire, comptes } en centimes, montrées sous chaque base (sans signe : « dépassé » si négatif)
  function interrupteurRav(base, avecComptes, valeurs) {
    const v = k => !valeurs || valeurs[k] == null ? '' : '<b class="num rb-v">' + esc(e0(Math.abs(valeurs[k]))) + (valeurs[k] < -50 ? ' dépassé' : '') + '</b>';
    const b = (k, t) => '<button type="button" data-ravbase="' + k + '" aria-pressed="' + (base === k) + '"' + (k === 'comptes' && !avecComptes ? ' disabled' : '') + '>' + (valeurs ? '<span>' + t + v(k) + '</span>' : t) + '</button>';
    return '<div class="seg rav-base" role="group" aria-label="Base du reste à vivre">' + b('salaire', 'Dernier salaire') + b('comptes', 'Comptes courants') + '</div>';
  }

  // ------------------------------------------------------------ pastille de banque (initiales sur la couleur de la banque)
  const TEINTES = ['#0b3f8c', '#0a9a8a', '#1f6fc0', '#1a3d8f', '#7a5af8', '#b45309', '#be185d', '#15803d'];
  function bico(S, c, petit) {
    const cx = c && c.source && c.source.connexion && S && S.modele.connexions[c.source.connexion];
    const nom = (cx && cx.banque) || '';
    const F2 = fold(nom + ' ' + (c ? c.libelle : ''));
    // mode démo (0.10.10) : initiales et couleur tirées du nom masqué (« Banque A »), jamais du complément
    const AF = g.KladAffichage, demo = !!(AF && AF.demoActif && AF.demoActif());
    const p = !demo && EXT.pastilles.find(x => x[0] && F2.indexOf(x[0]) >= 0);
    let t, col;
    if (p) { t = String(p[1][0]).slice(0, 3); col = String(p[1][1]); }
    else {
      let base = nom || (c ? c.libelle : '?');
      if (demo) base = AF.texteDemo(base);
      const mots = base.replace(/[^A-Za-zÀ-ÿ0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
      t = mots.length === 1 && mots[0].length <= 3 ? mots[0].toUpperCase() : mots.slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
      let h = 0; for (const ch of base) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
      col = TEINTES[h % TEINTES.length];
    }
    return '<span class="bico' + (petit ? ' sm' : '') + '" style="--bc:' + esc(col) + '" aria-hidden="true">' + esc(t) + '</span>';
  }

  // ------------------------------------------------------------ textes qui ne tiennent pas (0.10.10)
  // Écran étroit et texte agrandi : un titre dont un mot seul dépasse, ou un montant (jamais coupé) plus large que sa
  // carte, est réduit peu à peu (zoom de 8 % en 8 %, jusqu'à 50 %) ; les barres de l'équilibre cachent un libellé qui
  // ne tient toujours pas. Rien ne bouge quand tout tient (cas ordinaire).
  const AJUSTER = 'header.app-h h1, .panel-h h2, .ac-card h2, .seg button, .ac-act, .hv, .ac-hero .v, .mini .v, .ac-li .v, .kpi .v, .kpi .eyebrow, .num, .cr-r b, .mg-r b, .cm-min b, .wr-v b, .wr-v .chip, .eqh-bar i span, .chip';
  const CADRE = '.panel, .subpanel, .dep-l, .kpi, .ac-hero, .mini, .ac-quick, .ac-card, .cmp-card, .app-hero, .sh-rule, .eqh-bar i, .seg, header.app-h, .wrap, .sh-body';
  function deborde(e) {
    const r = e.getBoundingClientRect();
    if (r.width < 1) return false;
    const W = g.innerWidth || 0;
    if (W && (r.left < -0.5 || r.right > W + 0.5)) return true;
    // texte plus large que sa propre boîte (bouton d'une barre, montant en bloc)
    if (g.getComputedStyle(e).display !== 'inline' && e.scrollWidth > e.clientWidth + 1) return true;
    for (let a = e.parentElement; a && a !== g.document.body; a = a.parentElement) {
      const ca = g.getComputedStyle(a);
      const cadre = a.matches(CADRE);
      if (!cadre && ca.overflowX === 'visible') continue;
      if (/auto|scroll/.test(ca.overflowX)) return false;          // défilement horizontal voulu
      const ar = a.getBoundingClientRect();
      const g0 = ar.left + (parseFloat(ca.borderLeftWidth) || 0), d0 = ar.right - (parseFloat(ca.borderRightWidth) || 0);
      if (r.left < g0 - 0.5 || r.right > d0 + 0.5) return true;
      if (cadre) return false;
    }
    return false;
  }
  let ajustes = false;
  function ajuster(racine) {
    const d = g.document;
    if (!d || !g.getComputedStyle || !d.body) return;
    // cas ordinaire (écran d'au moins 360 px, texte à moins de 110 % : le corps est écrit en 14 px) : rien à faire
    const zt = (parseFloat(g.getComputedStyle(d.body).fontSize) || 14) / 14;
    if (!ajustes && (g.innerWidth || 0) >= 360 && zt < 1.1) return;
    ajustes = true;
    // 0.10.11 : largeur de l'écran rapportée à la taille du texte ; sous 230, chiffres clés sur une colonne (CSS)
    d.documentElement.classList.toggle('etroit', (g.innerWidth || 0) / zt < 230);
    const L = [...(racine || d).querySelectorAll(AJUSTER)].filter(e => e.style.zoom || e.classList.contains('fit-cache') || e.getClientRects().length);
    for (const e of L) { if (e.style.zoom) e.style.zoom = ''; e.classList.remove('fit-cache'); }
    for (const e of L.filter(deborde)) {
      let k = 1;
      while (k > 0.54 && deborde(e)) { k = Math.round((k - 0.08) * 100) / 100; e.style.zoom = String(k); }
      if (deborde(e) && e.matches('.eqh-bar i span')) e.classList.add('fit-cache');
    }
  }
  let ajustP = false;
  function ajusterBientot() { if (ajustP) return; ajustP = true; (g.requestAnimationFrame || setTimeout)(() => { ajustP = false; ajuster(); }); }
  if (g.document && g.MutationObserver) {
    const go = () => {
      new g.MutationObserver(ajusterBientot).observe(g.document.body, { childList: true, subtree: true, characterData: true });
      g.addEventListener('resize', ajusterBientot);
      ajusterBientot();
    };
    if (g.document.body) go(); else g.addEventListener('DOMContentLoaded', go);
  }

  // ------------------------------------------------------------ sections dépliantes (mémoire de l'état sur ce téléphone)
  // 0.10.4 (sous-vues de Budget et Commun) : l'état est gardé sous « klad.replis.v2 », créé une seule fois à partir de
  // « klad.replis » par la table MIGRATION_PLIS (marque « klad.replis.v » = 2). L'ancienne clé n'est pas effacée : une
  // version antérieure réinstallée la retrouve telle quelle.
  const CLE_ANCIENNE = 'klad.replis', CLE_PLIS = 'klad.replis.v2', CLE_MARQUE = 'klad.replis.v';
  // ancien identifiant → nouveau (null : section disparue, ou toujours ouverte dans sa sous-vue)
  const MIGRATION_PLIS = { 'tend-panel': null, 'p-contrats': null, 'cats-panel': null, 'rules-panel': null };
  // Repliées au départ, comme l'ancienne version (Tendance et Contrats ont leur sous-vue, toujours ouvertes).
  // 2.1 : « À faire » (#actions) ouvert par défaut, en bas de l'Aperçu
  const REPLIES = { 'eq-uses-panel': 1, 'eq-ops-panel': 1 };
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

  // ------------------------------------------------------------ 2.2 : infos masquées (ⓘ)
  // Reste visible le nom, le montant, l'état et le mot qui dit ce qu'est le montant ; dates, formules, explications et
  // sous-titres sont dans une info (.inf), masquée tant que sa ligne ou sa carte (.inf-l) n'est pas ouverte par le bouton
  // ⓘ (.inf-b) ou par un toucher sur un libellé non cliquable (.inf-t). Bouton relié à des infos ailleurs : data-inf-k ↔
  // data-inf-of. L'aide des formulaires (.muted.small, .rg-aide) passe d'elle-même derrière un ⓘ (infos()).
  const ib = (nom, k) => '<button type="button" class="inf-b" aria-expanded="false" aria-label="' + esc('Infos' + (nom ? ' : ' + nom : '')) + '"' + (k ? ' data-inf-k="' + esc(k) + '"' : '') + '>' +
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg></button>';
  // info : enc = encart (explication sous une ligne), sinon simple sous-texte révélé ; inl = révélée dans la ligne
  const inf = (html, cls) => html ? '<span class="inf' + (cls ? ' ' + cls : '') + '">' + html + '</span>' : '';
  function basculerInfo(el) {
    const k = el.dataset.infK;
    if (k) {
      const L = g.document.querySelectorAll('[data-inf-of="' + k + '"]'), on = !(L[0] && L[0].classList.contains('inf-vu'));
      L.forEach(x => x.classList.toggle('inf-vu', on));
      g.document.querySelectorAll('[data-inf-k="' + k + '"]').forEach(x => { if (x.classList.contains('inf-b')) x.setAttribute('aria-expanded', String(on)); });
      return;
    }
    const l = el.closest('.inf-l');
    if (!l) return;
    const on = l.classList.toggle('inf-on');
    l.querySelectorAll('.inf-b:not([data-inf-k])').forEach(x => { if (x.closest('.inf-l') === l) x.setAttribute('aria-expanded', String(on)); });
  }
  // Pose automatique (écrans secondaires, volets) : infos() parcourt une racine.
  // 1. aide d'un champ (.muted.small, .rg-aide) : ⓘ sur le libellé ou le titre qui la précède ;
  // 2. dans une zone .inf-auto : sous-textes (.subs, small, .muted, p.note) sans montant, sans alerte ni état : un seul ⓘ
  //    par bloc (section, carte, sous-partie dépliante), posé sur son titre, qui les montre tous.
  let nInf = 0;
  const ANCRE = 'label, h2, h3, h4, legend, .panel-h, .sh-lab, .obs-h3, .rg-t, .rg-l';
  const BLOC = 'details, .ap-card, .ac-card, .cmp-card, .panel, section, .pl-sec, .rg-sec, fieldset, .card';
  const TITRE = ':scope > summary .cms-t, :scope > summary, :scope > .panel-h h2, :scope > .panel-h h3, :scope > h2, :scope > h3, :scope > legend, :scope > .cmp-h > b:first-child, :scope > .rg-t';
  const EXCLU = '.vis, [aria-live], [role="status"], [role="alert"], .inf, .inf-b, summary, h2, h3, h4, legend, label, button.btn, .chip, .err, .toast';
  const VIDE = /^(aucun|aucune|rien|pas encore|pas de|non disponible|chargement)/i;
  const bouton = (nom, k) => { const t = g.document.createElement('template'); t.innerHTML = ib(nom, k); return t.content.firstChild; };
  function cacher(p, h, k) {
    p.classList.add('inf'); p.dataset.infOf = k;
    const prec = h && (h.querySelector(':scope > .inf-b[data-inf-k]') || (h.nextElementSibling && h.nextElementSibling.matches('.inf-b[data-inf-k]') ? h.nextElementSibling : null));
    if (prec) { p.dataset.infOf = prec.dataset.infK; return; }
    const b = bouton(h ? h.textContent.trim().slice(0, 60) : '', k);
    // titre qui replie sa section : ⓘ à côté (et non dedans), pour qu'un toucher sur le titre replie toujours
    if (h && h.matches('h2.fold, h3.fold')) h.after(b); else if (h) h.appendChild(b); else p.before(b);
  }
  function infos(root) {
    if (!root || !root.querySelectorAll) return;
    for (const p of root.querySelectorAll('.muted.small:not([data-infx]), .rg-aide:not([data-infx])')) {
      p.dataset.infx = '1';
      if (p.closest(EXCLU.replace(', label', '')) || p.closest('details:not(.cm-sub)') || p.hasAttribute('aria-live') || p.id === 'repIgnores' || !p.textContent.trim()) continue;
      let a = null, x = p.previousElementSibling;
      for (let i = 0; x && i < 4 && !a; i++, x = x.previousElementSibling) if (x.matches(ANCRE)) a = x; else if (x.querySelector && x.querySelector(ANCRE)) a = x.querySelector(ANCRE);
      if (!a && p.parentElement && p.parentElement.firstElementChild !== p && p.parentElement.firstElementChild.matches(ANCRE)) a = p.parentElement.firstElementChild;
      cacher(p, a && a.matches('.panel-h') ? a.querySelector('h2, h3') || a : a, 'ai' + (++nInf));
    }
    for (const z of root.querySelectorAll('.inf-auto')) {
      for (const p of z.querySelectorAll('.subs:not([data-infx]), small:not([data-infx]), .muted:not([data-infx]), p.note:not([data-infx])')) {
        p.dataset.infx = '1';
        const t = p.textContent.trim();
        if (!t || t.length < 4 || VIDE.test(t) || p.closest(EXCLU) || p.closest('.num, .v, .amt, .ap-mleg, .ap-tile') || p.querySelector('.num, .bad-t, .warn-t, .pos-t, .chip, input, select, button, a') || p.matches('.bad-t, .warn-t, .pos-t')) continue;
        if (p.querySelector('.inf, [data-infx]')) continue;
        // déjà dans un dépliant (« Comment c'est calculé », détail par poste…) : rien à ajouter ; sections dépliantes : oui
        const dt = p.closest('details');
        if (dt && !dt.matches('.cm-sub, .ctr-sub')) continue;
        // bloc qui a un titre (le plus proche)
        let bl = p.closest(BLOC), h = null;
        while (bl && z.contains(bl)) { h = bl.querySelector(TITRE); if (h && !h.contains(p)) break; h = null; bl = bl.parentElement && bl.parentElement.closest(BLOC); }
        if (!h) continue;
        cacher(p, h, 'ab' + (++nInf));
      }
    }
  }
  if (g.document && g.document.addEventListener) {
    g.document.addEventListener('click', ev => {
      const el = ev.target && ev.target.closest && ev.target.closest('.inf-b, .inf-t');
      if (!el) return;
      ev.preventDefault(); ev.stopPropagation();
      basculerInfo(el);
    }, true);
    let attente = 0;
    const planifier = () => { if (attente) return; attente = 1; (g.requestAnimationFrame || setTimeout)(() => { attente = 0; infos(g.document.body); }); };
    if (g.MutationObserver && g.document.body) new g.MutationObserver(planifier).observe(g.document.body, { childList: true, subtree: true });
    else g.document.addEventListener('DOMContentLoaded', () => { if (g.MutationObserver) new g.MutationObserver(planifier).observe(g.document.body, { childList: true, subtree: true }); planifier(); });
  }

  g.KladUI = { ajuster, ajusterBientot, ib, inf, infos, basculerInfo,
    esc, e0, e2, plus0, plus2, MOIS, MOIS_L, mLabel, mLong, dfr, jjmm, jjmmaa, dLong, pluriel, chip,
    interrupteurRav, COULEURS, SVG, reglerApparence, couleurDe, iconeDe, iconHtml, cico, icoOp, icoPoste, bico,
    replie, plier, migrerPlis, MIGRATION_PLIS, pref, PREFS, tete, appliquerPli, comment, graduation, couleurGraduation, calcul, estCalcul
  };
})(typeof window !== 'undefined' ? window : globalThis);
