// Klad — affichage : thème (automatique, clair, sombre) et mode démo. Le thème est une préférence d'affichage gardée
// sur ce téléphone (stockage local, hors coffre, sans donnée personnelle). Le mode démo ne vit qu'en mémoire : montants
// multipliés par un facteur tiré au hasard, noms des personnes, des banques et intitulés bancaires remplacés par des alias,
// champs de saisie floutés ; rien n'est modifié dans les données. Quitter (ou relancer l'appli) rend l'affichage réel.
(function (g) {
  'use strict';

  const CLE = 'klad.theme';
  const THEMES = ['auto', 'clair', 'sombre'];

  function theme() { try { const t = g.localStorage && g.localStorage.getItem(CLE); return THEMES.indexOf(t) >= 0 ? t : 'auto'; } catch (e) { return 'auto'; } }
  function appliquerTheme(t) {
    t = THEMES.indexOf(t) >= 0 ? t : 'auto';
    const r = g.document && g.document.documentElement;
    if (r) { if (t === 'auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', t); }
    return t;
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
  const facteur = () => Math.round((Math.random() < 0.5 ? 0.62 + Math.random() * 0.2 : 1.18 + Math.random() * 0.27) * 1000) / 1000;

  // ------------------------------------------------------------ mode démo (DOM)
  const demo = { on: false, k: 1, alias: [], obs: null, file: false, faits: new WeakMap() };
  function balayer() {
    demo.file = false;
    if (!demo.on) return;
    const d = g.document;
    const w = d.createTreeWalker(d.body, g.NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      const v = n.nodeValue;
      if (!v || v.length < 2 || demo.faits.get(n) === v) continue;
      if (n.parentNode && /^(SCRIPT|STYLE|TEXTAREA)$/.test(n.parentNode.nodeName)) continue;
      const o = masquer(v, demo.k, demo.alias);
      demo.faits.set(n, o);
      if (o !== v) n.nodeValue = o;
    }
    for (const e of d.querySelectorAll('[aria-label],[title]')) {
      for (const a of ['aria-label', 'title']) { const v = e.getAttribute(a); if (v) { const o = masquer(v, demo.k, demo.alias); if (o !== v) e.setAttribute(a, o); } }
    }
  }
  function planifier() { if (!demo.file) { demo.file = true; (g.requestAnimationFrame || setTimeout)(balayer); } }
  function demarrerDemo(S) {
    const d = g.document;
    demo.on = true; demo.k = facteur(); demo.alias = aliasDe(S || {});
    d.documentElement.classList.add('demo');
    let b = d.getElementById('demoBar');
    if (!b) {
      b = d.createElement('div'); b.id = 'demoBar'; b.className = 'demobar';
      b.innerHTML = '<span>MODE DÉMO · chiffres fictifs</span><button type="button">Quitter</button>';
      d.body.appendChild(b);
      b.querySelector('button').addEventListener('click', () => arreterDemo());
    }
    b.hidden = false;
    if (!demo.obs) { demo.obs = new g.MutationObserver(planifier); demo.obs.observe(d.body, { subtree: true, childList: true, characterData: true }); }
    balayer();
  }
  function arreterDemo() {
    const d = g.document;
    demo.on = false; demo.k = 1; demo.alias = [];
    if (demo.obs) { demo.obs.disconnect(); demo.obs = null; }
    demo.faits = new WeakMap();
    d.documentElement.classList.remove('demo');
    const b = d.getElementById('demoBar'); if (b) b.hidden = true;
    if (g.KladApp && g.KladApp.rendre) g.KladApp.rendre();
    if (g.KladAffichage.surArret) g.KladAffichage.surArret();
  }

  if (g.document) appliquerTheme(theme());

  g.KladAffichage = { THEMES, theme, choisirTheme, appliquerTheme, masquer, aliasDe, demarrerDemo, arreterDemo, demoActif: () => demo.on, facteurDemo: () => demo.k, surArret: null };
})(typeof window !== 'undefined' ? window : globalThis);
