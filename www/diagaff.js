// Klad — diagnostic d'affichage (0.10.9), Plus › Aide et à propos. Ouvre un volet « Nouvelle catégorie » de test (mêmes
// champs que Plus › Classement, rien n'est enregistré), touche le champ du nom, mesure l'écran et copie un texte à
// coller à l'architecte : appareil, versions d'Android et de la WebView, taille du texte, densité, marges de sécurité,
// rectangles du champ, de ses conteneurs et du volet. Aucune donnée personnelle (ni compte, ni montant, ni libellé, ni
// identifiant de l'appareil). La mise en forme (texte) est une fonction pure, testée dans node.
(function (g) {
  'use strict';

  const r1 = v => (v == null || !isFinite(v) ? '?' : String(Math.round(v * 100) / 100).replace('.', ','));
  const rect = b => b ? r1(b.left) + ' → ' + r1(b.right) + ' (largeur ' + r1(b.width) + ', hauteur ' + r1(b.height) + ')' : 'absent';

  // m : { version, natif: {…} | null, ecran: {…}, police: {…}, marges: {…}, contour: {…}, rects: {…}, defile: {…} } → texte.
  function texte(m) {
    const n = m.natif || {};
    const L = ['Klad — diagnostic d\'affichage', 'Version : ' + (m.version || '?')];
    if (m.natif) {
      L.push('Appareil : ' + [n.fabricant, n.modele].filter(Boolean).join(' ') + ' · Android ' + (n.android || '?') + ' (SDK ' + (n.sdk || '?') + ')');
      L.push('WebView : ' + (n.webview || '?'));
      L.push('Taille du texte : textZoom ' + (n.textZoom == null ? '?' : n.textZoom + ' %') + ' · police du système × ' + r1(n.echellePolice));
      L.push('Taille d\'affichage : densité ' + r1(n.densite) + ' (' + (n.dpi || '?') + ' dpi, standard ' + (n.dpiStandard || '?') + ' dpi' +
        (n.dpi && n.dpiStandard ? ', soit ' + Math.round(100 * n.dpi / n.dpiStandard) + ' %' : '') + ') · écran ' + (n.largeurDp || '?') + ' × ' + (n.hauteurDp || '?') + ' dp');
      L.push('WebView (px) : ' + (n.webviewPx || '?') + (n.margesPx ? ' · barres et encoche (px, gauche haut droite bas) : ' + n.margesPx : ''));
    } else L.push('Appareil : navigateur (pas d\'appli Android)');
    const e = m.ecran || {};
    L.push('Écran (CSS px) : ' + r1(e.largeur) + ' × ' + r1(e.hauteur) + ' · devicePixelRatio ' + r1(e.dpr) + ' · zone visible ' + r1(e.vvLargeur) + ' × ' + r1(e.vvHauteur) + ' (échelle ' + r1(e.vvEchelle) + ')' +
      ' · largeur de la page ' + r1(e.pageLargeur));
    const p = m.police || {};
    L.push('Police du champ : ' + (p.calculee || '?') + ' (calculée) · texte mesuré × ' + r1(p.rapport) + ' par rapport au texte non agrandi');
    const s = m.marges || {};
    L.push('Marges de sécurité (CSS px) : haut ' + r1(s.haut) + ', droite ' + r1(s.droite) + ', bas ' + r1(s.bas) + ', gauche ' + r1(s.gauche));
    const c = m.contour || {};
    L.push('Contour du champ touché : ' + (c.style || '?') + ' ' + r1(c.largeur) + ' px, décalage ' + r1(c.decalage) + ' px · champ actif : ' + (c.actif ? 'oui' : 'non'));
    const R = m.rects || {};
    L.push('Champ : ' + rect(R.champ));
    L.push('Étiquette du champ : ' + rect(R.etiquette));
    L.push('Formulaire : ' + rect(R.formulaire));
    L.push('Zone défilante du volet : ' + rect(R.defilante));
    L.push('Volet : ' + rect(R.volet));
    const d = m.defile || {};
    L.push('Débordement horizontal : volet ' + (d.volet > 0 ? r1(d.volet) + ' px' : 'aucun') + ' · page ' + (d.page > 0 ? r1(d.page) + ' px' : 'aucun'));
    const verdict = [];
    if (R.champ && R.etiquette && (R.champ.left < R.etiquette.left - 0.5 || R.champ.right > R.etiquette.right + 0.5)) verdict.push('le champ sort de son étiquette');
    if (R.champ && e.largeur && (R.champ.left < -0.5 || R.champ.right > e.largeur + 0.5)) verdict.push('le champ sort de l\'écran');
    if (R.champ && R.defilante && c.style && c.style !== 'none') {
      const x = (c.largeur || 0) + (c.decalage || 0);
      if (R.champ.left - x < R.defilante.left - 0.5 || R.champ.right + x > R.defilante.right + 0.5) verdict.push('le contour du champ est coupé par le volet');
    }
    L.push('Constat : ' + (verdict.length ? verdict.join(' ; ') : 'le champ et son contour tiennent dans le volet'));
    return L.join('\n');
  }

  // ------------------------------------------------------------ DOM (appli)
  const d = g.document;
  if (!d || !g.KladApp) { g.KladDiagAff = { texte }; return; }
  const A = g.KladApp;
  const $ = id => d.getElementById(id);
  let dernier = '';

  // Mesures dans la page (le champ du nom est touché).
  function mesurer() {
    const i = $('daNom');
    const b = el => { if (!el) return null; const x = el.getBoundingClientRect(); return { left: x.left, right: x.right, width: x.width, height: x.height }; };
    const cs = getComputedStyle(i);
    // marges de sécurité : sonde en position fixe dont le remplissage vaut env(safe-area-inset-*)
    const sonde = d.createElement('div');
    sonde.style.cssText = 'position:fixed;visibility:hidden;left:0;top:0;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
    // texte agrandi : même texte, avec et sans ajustement de la taille du texte
    const t1 = d.createElement('span'), t2 = d.createElement('span');
    t1.textContent = t2.textContent = 'Nouvelle catégorie de test';
    t1.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;font:500 15px sans-serif';
    t2.style.cssText = t1.style.cssText + ';-webkit-text-size-adjust:none;text-size-adjust:none';
    d.body.append(sonde, t1, t2);
    const sc = getComputedStyle(sonde);
    const px = v => parseFloat(v) || 0;
    const sh = d.querySelector('#volet .sh-body');
    const out = {
      ecran: { largeur: innerWidth, hauteur: innerHeight, dpr: g.devicePixelRatio, vvLargeur: g.visualViewport ? g.visualViewport.width : null,
        vvHauteur: g.visualViewport ? g.visualViewport.height : null, vvEchelle: g.visualViewport ? g.visualViewport.scale : null, pageLargeur: d.documentElement.scrollWidth },
      police: { calculee: cs.fontSize, rapport: t2.getBoundingClientRect().width ? t1.getBoundingClientRect().width / t2.getBoundingClientRect().width : null },
      marges: { haut: px(sc.paddingTop), droite: px(sc.paddingRight), bas: px(sc.paddingBottom), gauche: px(sc.paddingLeft) },
      contour: { style: cs.outlineStyle, largeur: px(cs.outlineWidth), decalage: px(cs.outlineOffset), actif: d.activeElement === i },
      rects: { champ: b(i), etiquette: b(i.parentElement), formulaire: b(i.closest('.nc-form')), defilante: b(sh), volet: b(d.querySelector('#volet .sheet')) },
      defile: { volet: sh ? sh.scrollWidth - sh.clientWidth : 0, page: d.documentElement.scrollWidth - innerWidth }
    };
    sonde.remove(); t1.remove(); t2.remove();
    return out;
  }

  A.preparer.secDiagAff = () => {
    $('diagAffCorps').innerHTML = '<p class="muted small">Volet de test : mêmes champs que « Nouvelle catégorie », rien n\'est enregistré.</p>' +
      '<div class="nc-form"><label class="sh-l"><span class="sh-lab">Nom de la nouvelle catégorie</span><input class="sh-in" id="daNom" maxlength="40" autocomplete="off" placeholder="ex. Bien être"></label>' +
      '<label class="sh-l"><span class="sh-lab">Nature</span><select class="sh-in" id="daNature"><option>Dépense optionnelle</option><option>Dépense courante</option><option>Charge fixe</option></select></label></div>' +
      '<h3>Texte copié</h3><p class="muted small">Aucune donnée personnelle : appareil, versions, tailles et positions seulement. Collez-le à votre assistant.</p>' +
      '<pre id="diagAffTexte" class="diag-t">Mesure en cours…</pre>' +
      '<div class="row"><button type="button" class="btn small" data-a="da-copier">Copier à nouveau</button><button type="button" class="btn small" data-a="da-mesurer">Mesurer à nouveau</button></div>';
  };

  async function lancer(copier) {
    const i = $('daNom');
    if (!i) return;
    i.focus({ preventScroll: true });
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const m = mesurer();
    const P = g.Capacitor && g.Capacitor.Plugins && g.Capacitor.Plugins.KladAffichage;
    let natif = null;
    if (P && P.diagnostic) { try { natif = await P.diagnostic(); } catch (e) { natif = null; } }
    m.natif = natif;
    m.version = (g.KLAD_CONFIG && g.KLAD_CONFIG.version) || 'dev';
    dernier = texte(m);
    const z = $('diagAffTexte');
    if (z) z.textContent = dernier;
    if (copier) await A.copy(dernier, 'Diagnostic d\'affichage copié.');
    A.log('info', 'Diagnostic d\'affichage mesuré' + (copier ? ' et copié.' : '.'));
  }

  // Ouvert depuis Plus : volet de test, mesure, copie.
  function ouvrir() {
    A.ouvrirVolet('secDiagAff', { titre: 'Nouvelle catégorie (test)' });
    setTimeout(() => lancer(true), 320);           // après l'ouverture du volet (animation)
  }

  d.addEventListener('click', ev => { if (ev.target.closest('[data-plus="diagaff"]') && A.etat()) ouvrir(); });
  $('diagAffCorps').addEventListener('click', ev => {
    const b = ev.target.closest('[data-a]');
    if (!b) return;
    if (b.dataset.a === 'da-copier' && dernier) A.copy(dernier, 'Diagnostic d\'affichage copié.');
    else if (b.dataset.a === 'da-mesurer') lancer(false);
  });

  g.KladDiagAff = { texte, mesurer, lancer, ouvrir };
})(typeof window !== 'undefined' ? window : globalThis);
