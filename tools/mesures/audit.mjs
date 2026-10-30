// Relevé d'accessibilité d'un écran, exécuté dans la page (fonction autonome, passée à page.evaluate) :
// - contrôles visibles (boutons, liens, champs, lignes et titres cliquables) et ceux dont la zone d'appui fait moins de
//   48 × 48 dp ; la zone d'appui compte la marge invisible d'un ::before / ::after posé en position absolue ;
// - textes sous le seuil de contraste WCAG 2.1 AA (4,5:1, ou 3:1 pour un grand texte), couleur du texte composée avec
//   l'opacité des parents, fond = superposition des fonds des parents ; icônes (aria-hidden), émojis seuls et
//   contrôles désactivés exclus (exemptés par WCAG) ;
// - plus petite police d'un texte visible.
// o : { portee: sélecteur du conteneur mesuré, detail: true pour la liste des défauts }.
export function auditer(o) {
  const racine = document.querySelector(o.portee) || document.body;
  const CIBLE = 48;
  const vis = el => {
    if (!el.isConnected) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      const s = getComputedStyle(e);
      if (s.display === 'none' || s.visibility === 'hidden' || s.visibility === 'collapse') return false;
      if (e.hidden) return false;
    }
    return true;
  };
  // ---------------------------------------------------------- couleurs
  const parse = c => {
    if (!c || c === 'transparent') return [0, 0, 0, 0];
    let m = c.match(/^rgba?\(([^)]+)\)/);
    if (m) { const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; }
    m = c.match(/^color\(srgb ([^)]+)\)/);
    if (m) { const p = m[1].split(/[\s/]+/).filter(Boolean).map(Number); return [p[0] * 255, p[1] * 255, p[2] * 255, p.length > 3 ? p[3] : 1]; }
    const cv = document.createElement('canvas').getContext('2d'); cv.fillStyle = c; return parse(cv.fillStyle.startsWith('#') ? 'rgb(' + [1, 3, 5].map(i => parseInt(cv.fillStyle.slice(i, i + 2), 16)).join(',') + ')' : cv.fillStyle);
  };
  const sur = (h, b) => { const a = h[3]; return [h[0] * a + b[0] * (1 - a), h[1] * a + b[1] * (1 - a), h[2] * a + b[2] * (1 - a), 1]; };
  const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  function fond(el) {
    const couches = [];
    for (let e = el; e; e = e.parentElement) {
      const c = parse(getComputedStyle(e).backgroundColor);
      if (c[3] > 0) { couches.push(c); if (c[3] >= 1) break; }
    }
    let b = couches.length && couches[couches.length - 1][3] >= 1 ? couches.pop() : [255, 255, 255, 1];
    while (couches.length) b = sur(couches.pop(), b);
    return b;
  }
  const opacite = el => { let a = 1; for (let e = el; e; e = e.parentElement) a *= +getComputedStyle(e).opacity; return a; };
  // ---------------------------------------------------------- contrôles et zone d'appui
  const SEL = 'button, a[href], input:not([type=hidden]), select, textarea, summary, [role=button], [role=tab], [role=switch], [role=link], [tabindex="0"]';
  const zone = el => {
    const r = el.getBoundingClientRect();
    let L = r.left, T = r.top, R = r.right, B = r.bottom;
    // case à cocher ou champ : son étiquette (<label>) fait partie de la zone d'appui
    if (el.labels && el.labels.length) for (const lb of el.labels) {
      const q = lb.getBoundingClientRect();
      if (q.width && q.height && lb.contains(el)) { L = Math.min(L, q.left); T = Math.min(T, q.top); R = Math.max(R, q.right); B = Math.max(B, q.bottom); }
    }
    for (const p of ['::before', '::after']) {
      const s = getComputedStyle(el, p);
      if (s.content === 'none' || s.content === 'normal' || s.position !== 'absolute') continue;
      const v = k => { const x = parseFloat(s[k]); return isFinite(x) ? x : null; };
      const t = v('top'), l = v('left'), rr = v('right'), bb = v('bottom');
      if (t !== null && t < 0) T = Math.min(T, r.top + t);
      if (l !== null && l < 0) L = Math.min(L, r.left + l);
      if (rr !== null && rr < 0) R = Math.max(R, r.right - rr);
      if (bb !== null && bb < 0) B = Math.max(B, r.bottom - bb);
    }
    return [R - L, B - T];
  };
  const controles = [...racine.querySelectorAll(SEL)].filter(vis).filter(el => !el.closest('[aria-hidden="true"]'));
  // un contrôle contenu dans un autre contrôle compté (ex. bouton dans une ligne) est compté à part
  const petits = controles.filter(el => { const [w, h] = zone(el); return Math.round(w) < CIBLE || Math.round(h) < CIBLE; });
  // ---------------------------------------------------------- textes
  const EMOJI = /^[\p{Extended_Pictographic}\p{Emoji_Component}‍️\s‹›✕✓↻!•·▾▸◀▶↑↓×✎☀☾…-]+$/u;
  const vus = new Set(), defauts = [];
  let police = 99;
  const w = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = w.nextNode())) {
    const t = n.nodeValue.trim();
    if (!t) continue;
    const el = n.parentElement;
    if (!el || vus.has(el) || /^(SCRIPT|STYLE|OPTION|TITLE)$/.test(el.nodeName)) continue;
    vus.add(el);
    if (!vis(el) || el.closest('[aria-hidden="true"]')) continue;
    const s = getComputedStyle(el);
    const taille = parseFloat(s.fontSize);
    if (EMOJI.test(t)) continue;
    police = Math.min(police, taille);
    if (el.closest(':disabled, [aria-disabled="true"]')) continue;
    if (el.closest('svg')) continue;
    const c = parse(s.color); c[3] *= opacite(el);
    const b = fond(el);
    const r = ratio(sur(c, b), b);
    const grand = taille >= 24 || (taille >= 18.66 && +s.fontWeight >= 700);
    if (r < (grand ? 3 : 4.5) - 0.005) defauts.push({ texte: t.slice(0, 40), ratio: Math.round(r * 100) / 100, taille, classe: el.className && String(el.className).slice(0, 40) });
  }
  const res = { controles: controles.length, petits: petits.length, contrastes: defauts.length, police, hauteur: Math.round(document.documentElement.scrollHeight) };
  if (o.detail) {
    res.listePetits = petits.map(el => { const [x, y] = zone(el); return (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 30) + ' ' + Math.round(x) + '×' + Math.round(y) + ' ' + el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ')[0] : ''); });
    res.listeContrastes = defauts;
  }
  return res;
}
