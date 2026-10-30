// Relevé des textes qui débordent (0.10.10), exécuté dans la page : chaque texte visible de la portée reste dans sa
// carte et dans l'écran ; un montant (« 1 234 € ») n'est jamais coupé sur deux lignes ni tronqué (points de suspension).
// Zones qui défilent horizontalement par conception (tableaux larges, rangées de filtres) exclues.
export function releveTextes([portee, W]) {
  const desc = e => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
  const CARTE = '.panel, .subpanel, .kpi, .ac-card, .cmp-card, .card, .sh-rule, .ordre-e, .eq-hero, .rav-card, section';
  const out = [];
  const racine = document.querySelector(portee);
  if (!racine) return out;
  const w = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT);
  let n;
  const MONTANT = /\d[\d   ]*(,\d+)?\s?(€|k€|%)/;
  while ((n = w.nextNode())) {
    const t = n.nodeValue;
    if (!t || !t.trim()) continue;
    const p = n.parentElement;
    if (!p || p.closest('script, style, svg, .sr, [hidden], .tablewrap, .app-chips, .tip, option, select')) continue;
    const cs = getComputedStyle(p);
    if (cs.visibility === 'hidden' || cs.display === 'none' || !p.getClientRects().length) continue;
    const rg = document.createRange(); rg.selectNodeContents(n);
    const rs = [...rg.getClientRects()].filter(r => r.width > 0.5);
    if (!rs.length) continue;
    let L = Math.min(...rs.map(r => r.left)), R = Math.max(...rs.map(r => r.right));
    const extrait = '« ' + t.trim().slice(0, 40) + ' » (' + desc(p) + ' < ' + desc(p.parentElement) + ')';
    const m = t.match(MONTANT);
    // ancêtres qui coupent le texte : défilement horizontal voulu (exclu), points de suspension (libellé seulement), coupure
    let defile = false, coupe = null;
    for (let a = p; a && a !== document.body; a = a.parentElement) {
      const ca = getComputedStyle(a);
      if (ca.overflowX === 'visible') continue;
      if (/auto|scroll/.test(ca.overflowX) && a.scrollWidth > a.clientWidth + 1) { defile = true; break; }
      const ar = a.getBoundingClientRect();
      if (L < ar.left - 0.5 || R > ar.right + 0.5) {
        if (ca.textOverflow === 'ellipsis' && !m) { L = Math.max(L, ar.left); R = Math.min(R, ar.right); continue; }
        coupe = a; break;
      }
    }
    if (defile) continue;
    if (coupe) { out.push(extrait + (m ? ' : montant tronqué' : ' : texte coupé') + ' par ' + desc(coupe)); continue; }
    const carte = p.closest(CARTE);
    if (carte) {
      const c = carte.getBoundingClientRect();
      if (L < c.left - 0.5 || R > c.right + 0.5) out.push(extrait + ' sort de ' + desc(carte) + ' (' + Math.round(L) + '–' + Math.round(R) + ' pour ' + Math.round(c.left) + '–' + Math.round(c.right) + ')');
    }
    if (L < -0.5 || R > W + 0.5) out.push(extrait + ' sort de l\'écran (' + Math.round(L) + '–' + Math.round(R) + ' pour ' + W + ')');
    // montant coupé sur deux lignes ou tronqué
    if (m) {
      const tops = new Set(rs.map(r => Math.round(r.top)));
      const seul = t.trim().length <= m[0].length + 2;
      if (seul && tops.size > 1) out.push(extrait + ' : montant coupé sur deux lignes');
      for (let a = p; a && a !== racine; a = a.parentElement) {
        const ca = getComputedStyle(a);
        if (ca.textOverflow === 'ellipsis' && a.scrollWidth > a.clientWidth + 1) { out.push(extrait + ' : montant tronqué dans ' + desc(a)); break; }
        if (ca.display !== 'inline') break;
      }
    }
  }
  return out;
}

// Relevé des éléments qui sortent de l'écran (0.10.11), exécuté dans la page : tout élément visible (écrans, volets,
// bandeaux, messages) tient entre 0 et la largeur de l'écran, une fois rogné par ses ancêtres qui masquent leur
// contenu ; zones qui défilent horizontalement par conception exclues. Seul l'élément le plus haut en défaut est cité.
export function releveDebord([W]) {
  const desc = e => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
  const out = [];
  const enDefaut = new Set();
  for (const e of document.body.querySelectorAll('*')) {
    if (e.closest('script, style, template, [hidden], .sr, #rangement, #banc-texte')) continue;
    const cs = getComputedStyle(e);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0 || !e.getClientRects().length) continue;
    const r = e.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    let L = r.left, R = r.right, defile = false, cache = false;
    for (let a = e.parentElement; a && a !== document.documentElement; a = a.parentElement) {
      const ca = getComputedStyle(a);
      if (+ca.opacity === 0 || ca.visibility === 'hidden') { cache = true; break; }
      if (ca.overflowX === 'visible') continue;
      if (/auto|scroll/.test(ca.overflowX) && a.scrollWidth > a.clientWidth + 1) { defile = true; break; }
      const ar = a.getBoundingClientRect();
      L = Math.max(L, ar.left); R = Math.min(R, ar.right);
    }
    if (defile || cache || R - L < 1) continue;
    // hors de l'écran par conception (volet fermé glissé en bas, indicateur de rafraîchissement) : vertical, ignoré
    if (L < -0.5 || R > W + 0.5) {
      enDefaut.add(e);
      if (e.parentElement && enDefaut.has(e.parentElement)) continue;
      const t = (e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);
      out.push(desc(e) + (t ? ' « ' + t + ' »' : '') + ' sort de l\'écran (' + Math.round(L) + '–' + Math.round(R) + ' pour ' + W + ')');
    }
  }
  if (document.documentElement.scrollWidth > W + 0.5) out.push('page plus large que l\'écran (' + document.documentElement.scrollWidth + ' pour ' + W + ')');
  return out;
}
