// Klad — affichage : thème (automatique, clair, sombre) et mode démo. Le thème est une préférence d'affichage gardée
// sur ce téléphone (stockage local, hors coffre, sans donnée personnelle). Le mode démo ne vit qu'en mémoire : montants
// multipliés par un facteur tiré au hasard, noms des personnes, des banques et intitulés bancaires remplacés par des alias,
// champs de saisie floutés ; rien n'est modifié dans les données. Quitter (ou relancer l'appli) rend l'affichage réel.
// 0.10.9 : captures d'écran autorisées seulement pendant le mode démo (plugin natif KladAffichage.captures : FLAG_SECURE
// retiré en entrant, rétabli en sortant, au verrouillage et quand l'appli passe en arrière-plan).
(function (g) {
  'use strict';

  const CLE = 'klad.theme';
  const THEMES = ['auto', 'clair', 'sombre'];
  // Palette : « klad » (couleurs de l'ancienne version) ou « grafit » (noir et rouge, comme l'icône) ; clé klad.palette.
  const CLE_PAL = 'klad.palette';
  const PALETTES = ['klad', 'grafit'];

  // Attribut lu par la feuille de style : data-theme="light" / "dark" (absent en automatique).
  const ATTR = { clair: 'light', sombre: 'dark' };

  function theme() { try { const t = g.localStorage && g.localStorage.getItem(CLE); return THEMES.indexOf(t) >= 0 ? t : 'auto'; } catch (e) { return 'auto'; } }
  const telephoneSombre = () => !!(g.matchMedia && g.matchMedia('(prefers-color-scheme: dark)').matches);
  // Affichage sombre effectif : choix de l'utilisateur, sinon réglage du téléphone.
  function sombre(t) { t = t || theme(); return t === 'sombre' || (t === 'auto' && telephoneSombre()); }

  // Barres d'état et de navigation Android accordées au thème affiché (plugin natif KladAffichage ; rien ailleurs).
  function barres(t) {
    const P = g.Capacitor && g.Capacitor.Plugins && g.Capacitor.Plugins.KladAffichage;
    if (!P || !g.document || !g.document.body) return;
    const c = (g.getComputedStyle(g.document.body).backgroundColor.match(/\d+/g) || []).slice(0, 3).map(Number);
    const fond = c.length === 3 ? '#' + c.map(x => x.toString(16).padStart(2, '0')).join('') : null;
    Promise.resolve(P.appliquer({ sombre: sombre(t), fond })).catch(() => { /* ancienne version de l'appli native */ });
  }

  function appliquerTheme(t) {
    t = THEMES.indexOf(t) >= 0 ? t : 'auto';
    const r = g.document && g.document.documentElement;
    if (r) { if (t === 'auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', ATTR[t]); }
    const m = g.document && g.document.querySelector('meta[name="color-scheme"]');
    if (m) m.setAttribute('content', t === 'auto' ? 'light dark' : ATTR[t]);
    barres(t);
    return t;
  }
  function palette() { try { const p = g.localStorage && g.localStorage.getItem(CLE_PAL); return PALETTES.indexOf(p) >= 0 ? p : 'klad'; } catch (e) { return 'klad'; } }
  function appliquerPalette(p) {
    p = PALETTES.indexOf(p) >= 0 ? p : 'klad';
    const r = g.document && g.document.documentElement;
    if (r) { if (p === 'klad') r.removeAttribute('data-palette'); else r.setAttribute('data-palette', p); }
    barres();
    return p;
  }
  function choisirPalette(p) {
    p = appliquerPalette(p);
    try { if (p === 'klad') g.localStorage.removeItem(CLE_PAL); else g.localStorage.setItem(CLE_PAL, p); } catch (e) { /* stockage indisponible : palette pour cette session */ }
    return p;
  }
  function choisirTheme(t) {
    t = appliquerTheme(t);
    try { if (t === 'auto') g.localStorage.removeItem(CLE); else g.localStorage.setItem(CLE, t); } catch (e) { /* stockage indisponible : thème pour cette session */ }
    return t;
  }

  // ------------------------------------------------------------ mode démo (fonctions pures, testées dans node)
  const esc = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Montants affichés : « 1 234 € », « 1 234,56 € », « 12,5 % » non concerné. Espaces fines et insécables acceptées.
  const RX_MONTANT = /(\d{1,3}(?:[   ]\d{3})*|\d+)(,\d{1,2})?(\s?€)/g;
  function formater(v, dec) {
    const t = v.toLocaleString('fr-FR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
    return t.replace(/[  ]/g, ' ');
  }
  // Remplace montants et noms dans un texte. alias : [[motif, remplacement], …] (motifs littéraux, insensibles à la casse).
  function masquer(txt, k, alias) {
    let o = String(txt);
    if (k && k !== 1) {
      o = o.replace(RX_MONTANT, (m, ent, dec, eur) => {
        const v = parseFloat(ent.replace(/[   ]/g, '') + (dec ? '.' + dec.slice(1) : ''));
        if (!isFinite(v)) return m;
        const d = dec ? dec.length - 1 : 0;
        return formater(Math.round(v * k * Math.pow(10, d)) / Math.pow(10, d), d) + eur;
      });
    }
    for (const [rx, r] of alias || []) o = o.replace(rx, r);
    return o;
  }
  // Alias tirés des données : personnes du compte commun, banques, intitulés bancaires des comptes, titulaires.
  function aliasDe(S) {
    const out = [], vus = new Set();
    const ajouter = (nom, r) => {
      const n = String(nom || '').trim();
      if (n.length < 3 || vus.has(n.toLowerCase())) return;
      vus.add(n.toLowerCase());
      out.push([n, r]);
    };
    try {
      const R = g.KladBudget && S.budget !== undefined ? g.KladBudget.reglages(S) : null;
      if (R && R.commun) { ajouter(R.commun.moi, 'Personne A'); ajouter(R.commun.autre, 'Personne B'); }
    } catch (e) { /* réglages absents */ }
    const cx = (S.modele && S.modele.connexions) || {};
    const banques = [...new Set(Object.keys(cx).map(k => cx[k] && cx[k].banque).filter(Boolean))];
    banques.forEach((b, i) => ajouter(b, 'Banque ' + String.fromCharCode(65 + i)));
    // intitulés donnés par la banque (souvent avec le nom du titulaire) ; les libellés courts choisis dans Klad
    // (« Commun », « Courant »…) restent : ce sont aussi des mots de l'interface.
    (S.modele && S.modele.comptes || []).forEach((c, i) => {
      if (c.source) { ajouter(c.source.intitule, 'Compte ' + (i + 1)); ajouter(c.source.titulaire, 'Titulaire'); }
    });
    // plus longs d'abord (un intitulé peut contenir un nom) ; mots entiers seulement
    return out.sort((a, b) => b[0].length - a[0].length).map(([n, r]) => [new RegExp('(?<![\\p{L}\\d])' + esc(n) + '(?![\\p{L}\\d])', 'giu'), r]);
  }
  // Captures d'écran (Android) : autorisées seulement pendant le mode démo.
  function captures(autoriser) {
    const P = g.Capacitor && g.Capacitor.Plugins && g.Capacitor.Plugins.KladAffichage;
    if (!P || !P.captures) return;
    Promise.resolve(P.captures({ autoriser: !!autoriser })).catch(() => { /* ancienne version de l'appli native : écran toujours protégé */ });
  }
  const facteur = () => Math.round((Math.random() < 0.5 ? 0.62 + Math.random() * 0.2 : 1.18 + Math.random() * 0.27) * 1000) / 1000;

  // ------------------------------------------------------------ mode démo (DOM)
  // 0.10.10 : dictionnaire tiré des données (KladDemo) ; texte, infobulles et valeurs des champs masqués ; champs de
  // saisie en lecture seule (sauf les recherches) ; tout est rendu tel quel en sortant (textes et champs d'origine).
  const demo = { on: false, k: 1, alias: [], D: null, obs: null, file: false, faits: new WeakMap(), origines: new Map() };
  const LIBRES = 'input[type="search"], #q, #icQ, #bankSearch';
  const NUMERIQUE = /^\s*\d[\d\s  ]*([.,]\d+)?\s*$/;
  function texteDemo(v) {
    let o = g.KladDemo && demo.D ? g.KladDemo.masquer(v, demo.D) : v;
    return masquer(o, demo.k, demo.alias);
  }
  // origines (rendues en sortant si la valeur n'a pas changé depuis) : par nœud, { texte, champ, attrs }
  const origine = n => demo.origines.get(n) || demo.origines.set(n, {}).get(n);
  function champ(i) {
    if (i.matches(LIBRES)) return;
    const t = (i.type || '').toLowerCase();
    if (/^(checkbox|radio|hidden|button|submit|reset|file|range|color|image)$/.test(t)) return;
    const v = String(i.value || '');
    const f = demo.faits.get(i);
    if (f && f.v === v && i.readOnly) return;
    let o = v;
    if (v.trim() && !/^(date|month|week|time|datetime-local)$/.test(t)) {
      const num = parseFloat(v.replace(/[\s  ]/g, '').replace(',', '.'));
      o = NUMERIQUE.test(v) && isFinite(num) ? String(Math.round(num * demo.k * 100) / 100).replace('.', t === 'number' ? '.' : ',') : texteDemo(v);
      // toute autre valeur saisie (réglages, motifs, adresses…) : masquée
      if (o === v && !NUMERIQUE.test(v)) o = '•••';
    }
    const r = origine(i);
    if (!r.champ) r.champ = { v, ro: i.readOnly };
    r.champ.masque = o;
    i.readOnly = true;
    if (o !== v) i.value = o;
    demo.faits.set(i, { v: i.value });
  }
  function balayer() {
    demo.file = false;
    if (!demo.on) return;
    const d = g.document;
    const w = d.createTreeWalker(d.body, g.NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      const v = n.nodeValue;
      if (!v || v.length < 2 || demo.faits.get(n) === v) continue;
      // données des infobulles des graphiques (JSON) masquées aussi ; autres scripts et styles laissés
      if (n.parentNode && (n.parentNode.nodeName === 'STYLE' || (n.parentNode.nodeName === 'SCRIPT' && !n.parentNode.classList.contains('tips')))) continue;
      const o = texteDemo(v);
      demo.faits.set(n, o);
      if (o !== v) { const r = origine(n); if (!r.texte) r.texte = { v }; r.texte.masque = o; n.nodeValue = o; }
    }
    for (const e of d.querySelectorAll('[aria-label],[title],[placeholder]')) {
      for (const a of ['aria-label', 'title', 'placeholder']) {
        const v = e.getAttribute(a);
        if (!v) continue;
        const o = texteDemo(v);
        if (o === v) continue;
        const r = origine(e); r.attrs = r.attrs || {};
        if (!(a in r.attrs)) r.attrs[a] = v;
        e.setAttribute(a, o);
      }
    }
    for (const i of d.querySelectorAll('input, textarea')) champ(i);
  }
  function planifier() { if (!demo.file) { demo.file = true; (g.requestAnimationFrame || setTimeout)(balayer); } }
  function dictionnaire(S) {
    if (!g.KladDemo) return null;
    const A = g.KladApp;
    let ctx = null, B = null;
    try { ctx = A && A.ctx ? A.ctx() : null; } catch (e) { ctx = null; }
    try { B = A && A.budget ? A.budget() : null; } catch (e) { B = null; }
    try { return g.KladDemo.construire(S || {}, { ctx, B }); } catch (e) { return null; }
  }
  function demarrerDemo(S) {
    const d = g.document;
    if (demo.on) return;
    if (g.KladApp && g.KladApp.demoDebut) g.KladApp.demoDebut();
    demo.on = true; demo.k = facteur(); demo.alias = aliasDe(S || {}); demo.D = dictionnaire(S);
    d.documentElement.classList.add('demo');
    let b = d.getElementById('demoBar');
    if (!b) {
      b = d.createElement('div'); b.id = 'demoBar'; b.className = 'demobar';
      b.innerHTML = '<span>MODE DÉMO · chiffres et libellés fictifs · captures d\'écran autorisées</span><button type="button">Quitter</button>';
      d.body.appendChild(b);
      b.querySelector('button').addEventListener('click', () => arreterDemo());
    }
    b.hidden = false;
    if (!demo.obs) { demo.obs = new g.MutationObserver(planifier); demo.obs.observe(d.body, { subtree: true, childList: true, characterData: true }); }
    // pastilles de banque (initiales) : redessinées avec la lettre de l'alias
    if (g.KladApp && g.KladApp.rendre) { try { g.KladApp.rendre(); } catch (e) { /* écran fermé */ } }
    balayer();
    captures(true);
  }
  // Textes, infobulles et champs d'origine rendus (ceux que le nouveau rendu ne remplace pas : volets fermés…).
  function rendreOrigines() {
    for (const [cible, r] of demo.origines) {
      try {
        if (r.texte && cible.nodeValue === r.texte.masque) cible.nodeValue = r.texte.v;
        if (r.champ) { if (cible.value === r.champ.masque) cible.value = r.champ.v; cible.readOnly = r.champ.ro; }
        if (r.attrs) for (const a of Object.keys(r.attrs)) cible.setAttribute(a, r.attrs[a]);
      } catch (e) { /* élément retiré */ }
    }
    demo.origines = new Map();
  }
  // o.sansRendu : au verrouillage (rien à réafficher).
  function arreterDemo(o) {
    const d = g.document;
    if (!demo.on) return;
    captures(false);
    demo.on = false; demo.k = 1; demo.alias = []; demo.D = null;
    if (demo.obs) { demo.obs.disconnect(); demo.obs = null; }
    rendreOrigines();
    demo.faits = new WeakMap();
    d.documentElement.classList.remove('demo');
    const b = d.getElementById('demoBar'); if (b) b.hidden = true;
    if (g.KladApp && g.KladApp.demoFin) g.KladApp.demoFin();
    if (o && o.sansRendu) return;
    if (g.KladApp && g.KladApp.rendre) g.KladApp.rendre();
    if (g.KladAffichage.surArret) g.KladAffichage.surArret();
  }
  // Trois appuis rapprochés sur le numéro de version : mode démo (comme l'ancienne version).
  function surVersion(el, S) {
    let t = [];
    el.addEventListener('click', () => {
      const n = Date.now(); t = t.filter(x => n - x < 1500); t.push(n);
      if (t.length < 3) return;
      t = [];
      const s = S();
      if (!s) return;
      if (demo.on) arreterDemo(); else demarrerDemo(s);
    });
  }

  if (g.document) {
    appliquerTheme(theme());
    appliquerPalette(palette());
    // automatique : suit le téléphone quand il change de thème, appli ouverte
    try { g.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (theme() === 'auto') { barres(); if (g.KladAffichage.surTheme) g.KladAffichage.surTheme(); } }); } catch (e) { /* navigateur ancien */ }
    if (g.addEventListener) g.addEventListener('load', () => barres());
  }

  g.KladAffichage = { THEMES, theme, sombre, choisirTheme, appliquerTheme, PALETTES, palette, choisirPalette, appliquerPalette, surTheme: null, masquer, aliasDe, demarrerDemo, arreterDemo, demoActif: () => demo.on, facteurDemo: () => demo.k, texteDemo, surVersion, surArret: null };
})(typeof window !== 'undefined' ? window : globalThis);
