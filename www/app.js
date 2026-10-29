// Klad — coquille de l'appli : onglets (Accueil, Opérations, Plus), volets qui montent du bas, pastille de synchro,
// tirer pour synchroniser ; banques et accès (clé Enable Banking, connexion, renouvellement, retour klad://eb).
// L'état S est fourni déverrouillé par verrou.js (KladApp.open) ; chaque modification est rechiffrée par verrou.js.
(function () {
  'use strict';

  const CFG = window.KLAD_CONFIG || {};
  const M = window.KladModele;
  const F = window.KladFormat;
  const Vu = window.KladVues;
  const KC = window.KladClasse;
  const $ = id => document.getElementById(id);
  const esc = Vu.esc;

  // ------------------------------------------------------------ Capacitor (absent dans un navigateur)
  const capX = window.capacitorExports;
  const isNative = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  const plugin = name => (capX && capX.registerPlugin) ? capX.registerPlugin(name)
    : (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins[name]) || null;
  const BrowserP = isNative ? plugin('Browser') : null;
  const ReseauP = isNative ? plugin('KladReseau') : null;

  // ------------------------------------------------------------ état (déchiffré par verrou.js, en mémoire seulement)
  let S = null;
  let hooks = {};
  const save = () => { if (hooks.save) hooks.save(); };
  const saveLog = () => { if (hooks.saveLog) hooks.saveLog(); };

  function defaultRedirect() {
    if (!CFG.owner) return '';
    return KladEB.redirectUrlFor(CFG.owner, CFG.repo || 'klad');
  }

  // ------------------------------------------------------------ journal anonyme (ni noms, ni montants, ni identifiants)
  const bankLabel = name => KladAnon.bankAlias(S.modele.alias, name);
  function log(kind, msg) {
    if (!S) return;
    const L = S.journal.log;
    L.push(new Date().toTimeString().slice(0, 8) + (kind === 'err' ? ' ✗ ' : kind === 'ok' ? ' ✓ ' : ' · ') + KladAnon.scrub(msg));
    if (L.length > 300) L.splice(0, L.length - 300);
    saveLog(); renderLog();
  }
  function renderLog() { const el = $('log'); if (!S) return; el.textContent = S.journal.log.join('\n'); el.scrollTop = el.scrollHeight; }

  let toastT, toastAction = null;
  function toast(msg, err) {
    const el = $('toast');
    if (toastAction && !err) return;          // un « Annuler » en cours n'est pas remplacé par un simple message
    toastAction = null;
    el.textContent = msg; el.className = 'show' + (err ? ' err' : '');
    clearTimeout(toastT); toastT = setTimeout(() => { el.className = ''; }, err ? 6000 : 3000);
  }
  // Message avec « Annuler » (10 s).
  function toastAnnuler(msg, fn) {
    const el = $('toast');
    el.innerHTML = '<span></span><button type="button" class="lien">Annuler</button>';
    el.firstChild.textContent = msg;
    el.className = 'show action';
    toastAction = fn;
    clearTimeout(toastT); toastT = setTimeout(() => { el.className = ''; toastAction = null; }, 10000);
  }
  $('toast').addEventListener('click', ev => {
    if (!ev.target.closest('button') || !toastAction) return;
    const fn = toastAction; toastAction = null;
    $('toast').className = '';
    fn();
  });

  // ------------------------------------------------------------ client Enable Banking
  // Dans un navigateur ordinaire, un faux client (données fictives) peut être fourni pour essayer l'interface.
  const client = () => (!isNative && window.KladFauxEB) ? window.KladFauxEB
    : new KladEB.Client({ appId: S.cle.appId, pem: S.cle.pem, log });

  async function busy(btn, fn) {
    if (btn) btn.disabled = true;
    try { return await fn(); }
    catch (e) { toast(e.message || String(e), true); log('err', e.message || String(e)); }
    finally { if (btn) btn.disabled = false; }
  }

  // Confirmation sans boîte de dialogue : second appui sur le même bouton dans les 4 s.
  function confirmInline(btn, label) {
    if (btn.dataset.armed === '1') return true;
    const old = btn.textContent; btn.dataset.armed = '1'; btn.textContent = label;
    setTimeout(() => { btn.dataset.armed = ''; btn.textContent = old; }, 4000);
    return false;
  }

  async function copy(text, msg) {
    try { await navigator.clipboard.writeText(text); toast(msg || 'Copié.'); }
    catch (e) {
      const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select();
      try { document.execCommand('copy'); toast(msg || 'Copié.'); } catch (e2) { toast('Copie impossible.', true); }
      t.remove();
    }
  }

  // ------------------------------------------------------------ données changées : enregistrement, affichage, événement
  // Point unique après une synchro, un import, un réglage ou une connexion (le résumé Grafit s'abonne à KladModele.surChangement).
  function changed(cause) {
    if (!S) return;
    CTX = null; BCTX = null;
    save();
    rendre();
    M.signaler(cause);
  }

  // ------------------------------------------------------------ classement : contexte (règles compilées, résultats)
  let CTX = null, BCTX = null;
  function ctx() { if (!CTX && S) CTX = KC.contexte(S, Date.now()); return CTX; }
  // Budget : contexte construit sur celui du classement (une fois par affichage).
  function budget() { if (!BCTX && S && window.KladBudget) BCTX = window.KladBudget.contexte(S, Date.now(), ctx()); return BCTX; }

  // Informations venues du verrou (sauvegarde) et de la mise à jour, pour « À vérifier » et le résumé Grafit.
  const externe = { sauvegarde: null, maj: null };
  function infoSauvegarde(v) { externe.sauvegarde = v; if (S) { renderAccueil(); M.signaler('sauvegarde'); } }
  function infoMaj(version) { if (externe.maj === version) return; externe.maj = version; if (S) { renderAccueil(); M.signaler('maj'); } }
  // → { attention, sauvegarde, maj, ctx } (lu par le rendu et par le résumé Grafit).
  function extras(now) {
    const cx = ctx();
    let rav = null, observations = 0;
    try { const B = budget(); rav = B ? window.KladBudget.suivi(B, 'perso', null).rav || null : null; } catch (e) { rav = null; }
    try { const B = budget(); observations = B && window.KladObservations ? window.KladObservations.observations(B, 'perso').faire.length : 0; } catch (e) { observations = 0; }
    return { attention: KC.attention(cx, now), sauvegarde: externe.sauvegarde, maj: externe.maj, ctx: cx, rav, budget: BCTX, observations };
  }

  // ------------------------------------------------------------ onglets
  const TITRES = { vAccueil: 'Accueil', vOps: 'Opérations', vBudget: 'Budget', vPlus: 'Plus' };
  let onglet = 'vAccueil';
  function montrer(id) {
    onglet = id;
    for (const k of Object.keys(TITRES)) $(k).hidden = k !== id;
    document.querySelectorAll('.onglets [data-onglet]').forEach(b => b.classList.toggle('on', b.dataset.onglet === id));
    $('titre').textContent = TITRES[id];
    $('defil').scrollTop = 0;
  }
  document.querySelector('.onglets').addEventListener('click', ev => {
    const b = ev.target.closest('[data-onglet]');
    if (b) montrer(b.dataset.onglet);
  });

  // ------------------------------------------------------------ volets (sections rangées, posées dans la feuille)
  const pile = [];
  const preparer = {};          // id de section → fonction appelée avant affichage (et à chaque rendu)
  function ouvrirVolet(id, opts) {
    const sec = $(id);
    if (!sec) return;
    if (!(opts && opts.empiler)) while (pile.length) $('rangement').appendChild($(pile.pop()));
    else if (pile.length) $('rangement').appendChild($(pile[pile.length - 1]));
    pile.push(id);
    if (preparer[id]) preparer[id](opts || {});
    $('voletCorps').appendChild(sec);
    $('voletTitre').textContent = (opts && opts.titre) || sec.dataset.titre || '';
    document.querySelector('#volet [data-retour]').hidden = pile.length < 2;
    $('volet').hidden = false;
    document.querySelector('#volet .feuille').scrollTop = 0;
  }
  function fermerVolet() {
    while (pile.length) $('rangement').appendChild($(pile.pop()));
    $('volet').hidden = true;
  }
  function retourVolet() {
    $('rangement').appendChild($(pile.pop()));
    if (!pile.length) { $('volet').hidden = true; return; }
    const id = pile[pile.length - 1];
    if (preparer[id]) preparer[id]({});
    $('voletCorps').appendChild($(id));
    $('voletTitre').textContent = $(id).dataset.titre || '';
    document.querySelector('#volet [data-retour]').hidden = pile.length < 2;
  }
  $('volet').addEventListener('click', ev => {
    if (ev.target.closest('[data-fermer]')) fermerVolet();
    else if (ev.target.closest('[data-retour]')) retourVolet();
  });
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && !$('volet').hidden && $('modal').hidden) fermerVolet(); });
  document.addEventListener('click', ev => {
    const v = ev.target.closest('[data-volet]');
    if (v && S) { ouvrirVolet(v.dataset.volet); return; }
    const o = ev.target.closest('#vAccueil [data-onglet]');
    if (o) montrer(o.dataset.onglet);
  });

  // ------------------------------------------------------------ rendu
  const rendus = [];            // fonctions de rendu ajoutées par plus.js
  function renderAccueil() {
    if (!S) return;
    const now = Date.now();
    const ex = extras(now);
    $('vAccueil').innerHTML = Vu.accueil(S, now, ex);
    const n = ex.attention.unseen;
    const b = $('badgeOps');
    b.hidden = !n; b.textContent = n > 99 ? '99+' : String(n);
    b.setAttribute('aria-label', n + ' à voir');
  }
  function rendre() {
    if (!S) return;
    CTX = null; BCTX = null;
    renderAccueil();
    renderFiltre();
    renderOps(true);
    renderPastille();
    renderMenu();
    rendus.forEach(fn => fn());
    if (pile.length && preparer[pile[pile.length - 1]]) preparer[pile[pile.length - 1]]({ rendu: true });
  }

  function renderMenu() {
    const n = Object.keys(S.modele.connexions).length;
    $('mBanques').textContent = n ? n + ' banque' + (n > 1 ? 's' : '') + ' connectée' + (n > 1 ? 's' : '') : 'Aucune banque connectée';
    const c = S.modele.comptes.length;
    $('mComptes').textContent = c ? c + ' compte' + (c > 1 ? 's' : '') : 'Aucun compte';
    const r = S.modele.reprise;
    $('mReprise').textContent = r ? 'Importée le ' + F.date(r.importee.slice(0, 10)) + ', ' + r.nb + ' opération(s)' : 'Aucun import';
  }

  // Accueil : un appui sur une carte de compte ouvre ses opérations ; sur une opération, son détail ;
  // sur une ligne de « À vérifier », l'écran concerné.
  const AV = { comptes: 'secComptes', banques: 'secBanques', sync: 'secSync', sauvegarde: 'secSauv', maj: 'secMaj', observations: 'secObs' };
  $('vAccueil').addEventListener('click', ev => {
    if (ev.target.closest('[data-rav]')) { ouvrirVolet('secRav'); return; }
    const av = ev.target.closest('[data-av]');
    if (av) {
      const k = av.dataset.av;
      if (k === 'nonvues' || k === 'nonclassees' || k === 'rapprocher') {
        filtre.nonVues = k === 'nonvues';
        filtre.cat = k === 'nonclassees' ? '__nc' : k === 'rapprocher' ? '__rap' : '';
        $('opsCompte').value = ''; $('opsQ').value = '';
        opsFin = 0; renderOps(true); montrer('vOps');
      } else if (AV[k]) ouvrirVolet(AV[k]);
      return;
    }
    const op = ev.target.closest('[data-op]');
    if (op) { ouvrirOp(op.dataset.c, op.dataset.op); return; }
    const b = ev.target.closest('[data-compte]');
    if (!b) return;
    $('opsCompte').value = b.dataset.compte;
    renderOps(true);
    montrer('vOps');
  });

  // ------------------------------------------------------------ opérations (liste par jour, recherche, filtre)
  const filtre = { compte: '', q: '', cat: '', nonVues: false };
  let opsListe = [], opsFin = 0;
  function renderFiltre() {
    const sel = $('opsCompte');
    const v = sel.value;
    sel.innerHTML = '<option value="">Tous les comptes</option>' +
      M.comptesTries(S).map(c => '<option value="' + esc(c.id) + '">' + esc(c.libelle) + (c.masque ? ' (masqué)' : '') + '</option>').join('');
    sel.value = M.compte(S, v) ? v : '';
  }
  function renderOps(reset) {
    const box = $('opsListe');
    if (reset) {
      const garde = Math.max(opsFin, 1);
      filtre.compte = $('opsCompte').value; filtre.q = $('opsQ').value.trim();
      const cx = ctx();
      if (filtre.cat && filtre.cat !== '__nc' && filtre.cat !== '__rap' && !cx.C.categories[filtre.cat]) filtre.cat = '';
      opsListe = Vu.filtrer(S, filtre, cx);
      opsFin = 0;
      const unseen = Vu.filtrer(S, { compte: filtre.compte, nonVues: true }, cx).length;
      $('opsFiltres').innerHTML = Vu.filtres(S, filtre, cx, { unseen, visiblesNonVues: opsListe.some(o => !KC.vue(S, o)) });
      if (!opsListe.length) {
        box.innerHTML = '<p class="muted center vide">' + (filtre.nonVues ? 'Toutes les opérations ont été vues.' : filtre.q || filtre.cat ? 'Aucune opération ne correspond.' : 'Aucune opération pour l\'instant.') + '</p>';
        return;
      }
      box.innerHTML = Vu.entete() + '<div id="opsJours"></div><div id="opsSuite"></div>';
      $('vOps').style.setProperty('--outils', document.querySelector('#vOps .outils').offsetHeight + 'px');
      plus(30, garde);
      return;
    }
    plus(30, 0);
  }
  function plus(nbJours, auMoins) {
    const jours = $('opsJours');
    if (!jours) return;
    const opt = { compte: !filtre.compte, annee: new Date().getFullYear(), ctx: ctx() };
    let r;
    do {
      r = Vu.tranche(S, opsListe, opsFin, nbJours, opt);
      jours.insertAdjacentHTML('beforeend', r.html);
      opsFin = r.fin;
    } while (opsFin < auMoins && opsFin < opsListe.length);
    $('opsSuite').innerHTML = opsFin < opsListe.length ? '<button class="btn ghost small" data-suite>Afficher plus</button>' : '';
  }
  $('opsListe').addEventListener('click', ev => {
    if (ev.target.closest('[data-suite]')) { renderOps(false); return; }
    const op = ev.target.closest('[data-op]');
    if (op && Date.now() - finGeste > 400) ouvrirOp(op.dataset.c, op.dataset.op);
  });
  $('opsFiltres').addEventListener('click', ev => {
    const b = ev.target.closest('[data-f]');
    if (!b) return;
    const f = b.dataset.f;
    if (f === 'nonVues') filtre.nonVues = !filtre.nonVues;
    else if (f === 'nc') filtre.cat = filtre.cat === '__nc' ? '' : '__nc';
    else if (f === 'rap') filtre.cat = '';
    else if (f === 'toutVu') {
      const l = opsListe.filter(o => !KC.vue(S, o));
      const avant = KC.marquer(S, l, true);
      if (!avant.length) return;
      log('info', 'Opérations vues : ' + avant.length + '.');
      changed('vu');
      toastAnnuler(avant.length + ' opération(s) marquée(s) vue(s).', () => { KC.annulerVues(avant); changed('vu'); });
      return;
    }
    opsFin = 0; renderOps(true);
  });
  $('opsFiltres').addEventListener('change', ev => {
    if (ev.target.id !== 'opsCat') return;
    filtre.cat = ev.target.value;
    opsFin = 0; renderOps(true);
  });

  // ------------------------------------------------------------ gestes sur une opération
  // Glisser vers la droite : vue / non vue ; vers la gauche : volet « Classer ». Le détail de l'opération offre les
  // mêmes actions par boutons. Avec « réduire les animations », la ligne suit le doigt sans animation de retour.
  let finGeste = 0;
  (function () {
    const box = $('opsListe');
    let G = null;
    const SEUIL = 90;
    box.addEventListener('touchstart', ev => {
      const row = ev.target.closest('.op[data-op]');
      if (!row || ev.touches.length > 1) { G = null; return; }
      G = { row, x: ev.touches[0].clientX, y: ev.touches[0].clientY, dx: 0, lock: false };
    }, { passive: true });
    box.addEventListener('touchmove', ev => {
      if (!G) return;
      const dx = ev.touches[0].clientX - G.x, dy = ev.touches[0].clientY - G.y;
      if (!G.lock) {
        if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.4) G.lock = true;
        else { if (Math.abs(dy) > 12) G = null; return; }
      }
      G.dx = dx;
      const c = Math.max(-150, Math.min(150, dx));
      G.row.classList.add('glisse');
      G.row.classList.toggle('vers-d', c > 0); G.row.classList.toggle('vers-g', c < 0);
      G.row.classList.toggle('pret', Math.abs(c) >= SEUIL);
      G.row.style.transform = 'translateX(' + c + 'px)';
    }, { passive: true });
    const fin = () => {
      if (!G) return;
      const { row, dx, lock } = G;
      G = null;
      if (!lock) return;
      finGeste = Date.now();
      row.classList.remove('glisse', 'vers-d', 'vers-g', 'pret');
      row.style.transform = '';
      if (dx >= SEUIL) basculerVue(row.dataset.c, row.dataset.op);
      else if (dx <= -SEUIL) ouvrirClasser(row.dataset.c, row.dataset.op);
    };
    box.addEventListener('touchend', fin, { passive: true });
    box.addEventListener('touchcancel', fin, { passive: true });
  })();

  const trouverOp = (cid, id) => (S && S.ops[cid] || []).find(o => o.id === id) || null;
  function basculerVue(cid, id) {
    const o = trouverOp(cid, id);
    if (!o) return;
    const on = !KC.vue(S, o);
    const avant = KC.marquer(S, [o], on);
    changed('vu');
    toastAnnuler(on ? 'Opération marquée vue.' : 'Opération remise en non vue.', () => { KC.annulerVues(avant); changed('vu'); });
  }

  // ------------------------------------------------------------ détail d'une opération
  let opCourante = null;            // [compte, id]
  function ouvrirOp(cid, id) {
    if (!trouverOp(cid, id)) return;
    opCourante = [cid, id];
    ouvrirVolet('secOp');
  }
  preparer.secOp = () => {
    const o = opCourante && trouverOp(opCourante[0], opCourante[1]);
    if (!o) { $('opDetail').innerHTML = '<p class="muted">Opération introuvable.</p>'; return; }
    $('opDetail').innerHTML = Vu.detail(S, o, ctx());
  };
  $('opDetail').addEventListener('click', ev => {
    const b = ev.target.closest('[data-a]');
    if (!b || !opCourante) return;
    if (b.dataset.a === 'vue') basculerVue(opCourante[0], opCourante[1]);
    else if (b.dataset.a === 'classer') ouvrirClasser(opCourante[0], opCourante[1], true);
    else if (b.dataset.a === 'interne') {
      const o = trouverOp(opCourante[0], opCourante[1]);
      const w = o && KC.aRapprocher(ctx(), o);
      if (!w) return;
      const snap = KC.marquerInterne(ctx(), o, w);
      log('info', 'Prélèvement de portefeuille rapproché à la main.');
      fermerVolet();
      changed('classement');
      toastAnnuler('Prélèvement marqué interne (réglé par ' + w.libelle + ').', () => { KC.annulerInterne(snap); changed('classement'); });
    }
  });

  // ------------------------------------------------------------ volet « Classer »
  let cls = null;                   // { cid, id, st }
  function ouvrirClasser(cid, id, empiler) {
    const o = trouverOp(cid, id);
    if (!o) return;
    const r = KC.classer(ctx(), o);
    const cat = r.cat;
    const mot = KC.suggestKw(o.libelle);
    cls = { cid, id, st: { cat, sub: r.nc ? cat : r.sub, autres: !!mot, mot, compte: false, sens: '', toutes: false }, sub0: r.nc ? cat : r.sub };
    ouvrirVolet('secClasser', { empiler: !!empiler });
  }
  function nbConcernees() {
    const st = cls.st;
    if (!st.autres || !st.mot.trim()) return 0;
    return KC.concernees(S, st.mot, { compte: st.compte ? cls.cid : null, sens: st.sens }).length;
  }
  function renderClasser() {
    const o = cls && trouverOp(cls.cid, cls.id);
    if (!o) { $('clsCorps').innerHTML = '<p class="muted">Opération introuvable.</p>'; return; }
    $('clsCorps').innerHTML = Vu.classer(S, o, ctx(), cls.st, nbConcernees());
  }
  function majCompte() {
    const n = nbConcernees(), st = cls.st;
    $('clsN').textContent = st.autres ? (st.mot.trim() ? n + ' opération' + (n > 1 ? 's contiennent' : ' contient') + ' « ' + st.mot.trim() + ' »' : 'Saisissez un mot du libellé.') : 'Seule cette opération sera classée.';
    document.querySelector('#clsCorps [data-a="go"]').textContent = 'Classer en ' + st.cat + (st.autres && n > 1 ? ' (' + n + ')' : '');
  }
  preparer.secClasser = o => { if (!o.rendu) renderClasser(); };
  $('clsCorps').addEventListener('click', ev => {
    if (!cls) return;
    const t = ev.target.closest('[data-cat]');
    if (t) {
      const old = cls.st.cat;
      cls.st.cat = t.dataset.cat;
      const sub = $('clsSub').value.trim();
      cls.st.sub = !sub || sub === old || sub === cls.sub0 ? cls.st.cat : sub;
      cls.st.mot = $('clsMot').value;
      renderClasser();
      return;
    }
    if (ev.target.closest('[data-toutes]')) { cls.st.toutes = true; cls.st.sub = $('clsSub').value; cls.st.mot = $('clsMot').value; renderClasser(); return; }
    if (ev.target.closest('[data-a="go"]')) appliquerClasser();
  });
  $('clsCorps').addEventListener('input', ev => {
    if (!cls) return;
    if (ev.target.id === 'clsMot') { cls.st.mot = ev.target.value; majCompte(); }
    if (ev.target.id === 'clsSub') cls.st.sub = ev.target.value;
  });
  $('clsCorps').addEventListener('change', ev => {
    if (!cls) return;
    const id = ev.target.id;
    if (id === 'clsAutres' || id === 'clsCompte' || id === 'clsSens') {
      cls.st.autres = $('clsAutres').checked; cls.st.compte = $('clsCompte').checked; cls.st.sens = $('clsSens').value;
      cls.st.sub = $('clsSub').value; cls.st.mot = $('clsMot').value;
      renderClasser();
    }
  });
  function appliquerClasser() {
    const o = trouverOp(cls.cid, cls.id);
    if (!o) return;
    const st = cls.st;
    if (st.autres && !st.mot.trim()) { toast('Saisissez un mot du libellé.', true); return; }
    const n = st.autres ? nbConcernees() : 1;
    const snap = KC.appliquer(S, o, { cat: st.cat, sub: st.sub, mot: st.autres ? st.mot : null, compte: st.autres && st.compte ? cls.cid : null, sens: st.autres ? st.sens : '' });
    log('info', st.autres ? 'Règle de classement créée (' + n + ' opération(s) concernée(s)).' : 'Opération classée à la main.');
    fermerVolet();
    changed('classement');
    toastAnnuler(st.autres ? n + ' opération(s) classée(s) en « ' + st.cat + ' ».' : 'Opération classée en « ' + st.cat + ' ».', () => {
      KC.annuler(S, snap); log('info', 'Classement annulé.'); changed('classement');
    });
  }
  $('defil').addEventListener('scroll', () => {
    const d = $('defil');
    if (onglet === 'vOps' && opsFin < opsListe.length && d.scrollTop + d.clientHeight > d.scrollHeight - 600) renderOps(false);
  }, { passive: true });
  $('opsCompte').addEventListener('change', () => { opsFin = 0; renderOps(true); });
  let qT;
  $('opsQ').addEventListener('input', () => { clearTimeout(qT); qT = setTimeout(() => { opsFin = 0; renderOps(true); }, 200); });

  // ------------------------------------------------------------ synchronisation : pastille, automatique, tirer
  let syncP = null;
  function erreursSync() { return S.modele.comptes.filter(c => c.source.type === 'eb' && c.sync && c.sync.erreur); }
  function renderPastille() {
    const p = $('pastille');
    if (!S) return;
    const d = S.modele.sync.derniere;
    if (syncP) { p.textContent = '↻'; p.className = 'pastille encours'; return; }
    const err = erreursSync().length;
    p.textContent = (err ? '! ' : d ? '✓ ' : '') + (d ? F.heure(d) : '—');
    p.className = 'pastille' + (err ? ' err' : d ? ' ok' : '');
  }
  async function dispoPSU() {
    let ip = '';
    if (ReseauP) { try { ip = (await ReseauP.adresse()).ip || ''; } catch (e) { ip = ''; } }
    return { 'Psu-Ip-Address': ip, 'Psu-User-Agent': navigator.userAgent + ' Klad/' + (CFG.version || 'dev'), 'Psu-Accept-Language': navigator.language || 'fr-FR' };
  }
  function synchro(raison) {
    if (!S) return Promise.resolve(null);
    if (syncP) return syncP;
    const comptes = S.modele.comptes.filter(c => c.source.type === 'eb' && !c.aReassocier && S.modele.connexions[c.source.connexion]);
    if (!comptes.length) {
      if (raison !== 'auto') toast('Aucun compte bancaire connecté.');
      return Promise.resolve(null);
    }
    const s0 = S;
    log('info', 'Synchronisation (' + raison + '), ' + comptes.length + ' compte(s)');
    syncP = KladSync.synchroniser(S, { client, dispo: dispoPSU, log, now: () => Date.now() }, () => S === s0)
      .then(r => {
        if (!r || S !== s0) return r;
        if (raison !== 'auto' || r.erreurs) toast(r.erreurs ? r.erreurs + ' compte(s) en erreur : appuyez sur la pastille.' : 'Synchronisation terminée.', !!r.erreurs);
        return r;
      })
      .catch(e => { toast(e.message || String(e), true); log('err', e.message || String(e)); return null; })
      .finally(() => { syncP = null; if (S === s0) changed('synchro'); });
    renderPastille();
    return syncP;
  }
  $('pastille').addEventListener('click', () => {
    if (!S || syncP) return;
    if (erreursSync().length) ouvrirVolet('secSync'); else synchro('manuel');
  });
  preparer.secSync = () => {
    const now = Date.now();
    const rows = S.modele.comptes.filter(c => c.source.type === 'eb').map(c =>
      '<li><div class="grow">' + esc(c.libelle) + '<small>' + (c.sync && c.sync.erreur ? '<span class="bad">' + esc(c.sync.erreur) + '</span>'
        : 'Lu ' + esc(F.ilYa(c.sync && c.sync.lu, now))) + '</small></div></li>').join('');
    $('syncDetail').innerHTML = '<p class="muted">Dernière synchronisation : ' + (S.modele.sync.derniere ? esc(F.ilYa(S.modele.sync.derniere, now)) : 'jamais') + '.</p>' +
      '<ul class="list">' + (rows || '<li class="muted">Aucun compte bancaire.</li>') + '</ul>' +
      '<div class="row"><button class="btn" data-a="sync">Synchroniser maintenant</button></div>';
  };
  $('syncDetail').addEventListener('click', ev => { if (ev.target.closest('[data-a="sync"]')) { fermerVolet(); synchro('manuel'); } });

  // Tirer vers le bas, en haut de l'accueil ou des opérations.
  (function () {
    const d = $('defil'), t = $('tirer');
    let y0 = null, dy = 0;
    d.addEventListener('touchstart', e => { y0 = (onglet !== 'vPlus' && d.scrollTop <= 0) ? e.touches[0].clientY : null; dy = 0; }, { passive: true });
    d.addEventListener('touchmove', e => {
      if (y0 == null) return;
      dy = e.touches[0].clientY - y0;
      t.style.height = Math.max(0, Math.min(dy / 2, 64)) + 'px';
      t.classList.toggle('pret', dy > 120);
    }, { passive: true });
    d.addEventListener('touchend', () => {
      if (y0 != null && dy > 120) synchro('tirer');
      y0 = null; dy = 0; t.style.height = ''; t.classList.remove('pret');
    });
  })();

  // ------------------------------------------------------------ banques et accès : clé
  function renderKey() {
    $('appId').value = S.cle.appId || '';
    $('redirectUrl').value = S.cle.redirectUrl || '';
    const k = $('keyState');
    if (S.cle.pem) {
      const kind = (S.cle.pem.match(/BEGIN ([A-Z ]+)-----/) || [])[1] || 'clé';
      k.innerHTML = '<span class="ok">✓</span> Clé enregistrée (' + esc(kind) + ', ' + S.cle.pem.length + ' caractères).';
    } else k.textContent = 'Aucune clé enregistrée.';
  }

  $('pemFile').addEventListener('change', async ev => {
    const f = ev.target.files && ev.target.files[0];
    if (!f) return;
    $('pemText').value = await f.text();
    toast('Fichier lu. Appuyez sur « Enregistrer ».');
  });

  $('btnSaveKey').addEventListener('click', ev => busy(ev.target, async () => {
    const appId = $('appId').value.trim();
    const pem = $('pemText').value.trim() || S.cle.pem;
    if (!appId) throw new Error('Saisissez l\'identifiant d\'application.');
    if (!pem) throw new Error('Choisissez le fichier .pem ou collez la clé.');
    await KladEB.importKey(pem);                       // vérifie le format avant d'enregistrer
    S.cle.appId = appId; S.cle.pem = pem; save();
    $('pemText').value = ''; $('pemFile').value = '';
    renderKey(); log('info', 'Clé enregistrée et lisible.');
    toast('Clé enregistrée.');
  }));

  $('btnTestKey').addEventListener('click', ev => busy(ev.target, async () => {
    const a = await client().application();
    const urls = a.redirect_urls || [];
    const okRedirect = S.cle.redirectUrl && urls.indexOf(S.cle.redirectUrl) >= 0;
    // /application ne dit pas toujours si l'application est active : un appel réel le vérifie.
    let inactive = a.active === false;
    if (!inactive) {
      try { await client().aspsps($('country').value); }
      catch (e) { if (e.status === 403 && /not active/i.test(e.message)) inactive = true; else throw e; }
    }
    $('appInfo').innerHTML =
      '<p><span class="ok">✓</span> Clé acceptée : <b>' + esc(a.name || '?') + '</b> ' +
      '<span class="chip">' + esc(a.environment || '') + '</span></p>' +
      (inactive ? '<p class="bad">Application inactive : dans le Control Panel Enable Banking, l\'activer avec « Activate by linking accounts » (relier ses comptes).</p>'
        : '<p class="ok">✓ Application active.</p>') +
      '<p class="muted">Adresses de retour déclarées : ' + (urls.length ? urls.map(esc).join('<br>') : 'aucune') + '</p>' +
      (okRedirect ? '<p class="ok">✓ L\'adresse de retour de Klad est bien déclarée.</p>'
        : '<p class="bad">L\'adresse de retour de Klad (' + esc(S.cle.redirectUrl || 'non réglée') + ') n\'est pas dans la liste : ajoutez-la dans le Control Panel Enable Banking.</p>');
    log(inactive ? 'err' : 'info', 'Application ' + (a.environment || '?') + (inactive ? ' INACTIVE' : ' active') + ', ' + urls.length + ' adresse(s) de retour, retour Klad ' + (okRedirect ? 'déclaré' : 'ABSENT'));
  }));

  $('redirectUrl').addEventListener('change', ev => { S.cle.redirectUrl = ev.target.value.trim(); save(); });
  $('btnCopyRedirect').addEventListener('click', () => copy($('redirectUrl').value, 'Adresse copiée.'));

  // ------------------------------------------------------------ banques et accès : liste des banques, connexion
  let bankList = [];
  function renderBanks() {
    const q = $('bankSearch').value.trim().toLowerCase();
    const items = bankList.filter(b => !q || b.name.toLowerCase().indexOf(q) >= 0);
    $('banks').innerHTML = items.length ? items.slice(0, 200).map(b =>
      '<li><div class="grow">' + esc(b.name) + '<small>' + esc(b.country) +
      (b.maximum_consent_validity ? ' · accès max ' + Math.round(b.maximum_consent_validity / 86400) + ' j' : '') +
      (b.psu_types ? ' · ' + esc(b.psu_types.join(', ')) : '') + '</small></div>' +
      '<button class="btn small" data-bank="' + bankList.indexOf(b) + '">Connecter</button></li>').join('')
      : '<li class="muted">' + (bankList.length ? 'Aucune banque ne correspond.' : 'Appuyez sur « Charger ».') + '</li>';
  }
  $('btnLoadBanks').addEventListener('click', ev => busy(ev.target, async () => {
    const c = $('country').value;
    bankList = await client().aspsps(c);
    S.modele.banks[c] = { at: Date.now(), n: bankList.length }; save();
    log('info', bankList.length + ' banque(s) pour ' + c);
    renderBanks();
  }));
  $('bankSearch').addEventListener('input', renderBanks);
  $('banks').addEventListener('click', ev => {
    const b = ev.target.closest('[data-bank]');
    if (!b) return;
    const bank = bankList[+b.dataset.bank];
    autoriser({ banque: bank.name, pays: bank.country, psu: bank.required_psu_headers || null, maxSecondes: bank.maximum_consent_validity || null }, b);
  });

  function newState() {
    const a = new Uint8Array(16); crypto.getRandomValues(a);
    return Array.from(a, x => x.toString(16).padStart(2, '0')).join('');
  }

  // Autorisation auprès de la banque (nouvelle connexion ou renouvellement : p.renouvelle = session remplacée).
  async function autoriser(p, btn) {
    await busy(btn, async () => {
      if (!S.cle.redirectUrl) throw new Error('Adresse de retour non réglée (Banques et accès › Adresse de retour bancaire).');
      const state = newState();
      S.modele.pending[state] = Object.assign({ ts: Date.now() }, p);
      save();
      if (hooks.flush) await hooks.flush();            // l'appli peut être arrêtée pendant l'autorisation
      const r = await client().startAuth({ name: p.banque, country: p.pays, maxSeconds: p.maxSecondes, redirectUrl: S.cle.redirectUrl, state });
      if (!r.url) throw new Error('Pas d\'adresse d\'autorisation renvoyée.');
      log('info', (p.renouvelle ? 'Renouvellement lancé : ' : 'Autorisation lancée : ') + bankLabel(p.banque) + ' (' + p.pays + ')');
      if (BrowserP) await BrowserP.open({ url: r.url });
      else window.location.href = r.url;
    });
  }

  // Renouvellement en un appui : même banque ; au retour, les comptes sont réassociés par leur empreinte d'IBAN.
  async function renouveler(sid, btn) {
    const cx = S.modele.connexions[sid];
    if (!cx) return;
    let psu = cx.psu;
    if (!Array.isArray(psu)) {          // connexion venue de la 0.2 : en-têtes exigés relus dans la liste des banques
      try { const b = (await client().aspsps(cx.pays)).find(x => x.name === cx.banque); if (b) psu = b.required_psu_headers || []; }
      catch (e) { psu = null; }
    }
    autoriser({ banque: cx.banque, pays: cx.pays, psu, maxSecondes: cx.maxSecondes, renouvelle: sid }, btn);
  }

  // ------------------------------------------------------------ retour bancaire (klad://eb?code=…&state=…)
  let handled = {};
  async function handleReturn(url) {
    if (!S || !url || handled[url]) return;
    handled[url] = true;
    let u;
    try { u = new URL(url); } catch (e) { log('err', 'Lien de retour illisible'); return; }
    const p = u.searchParams;
    if (!p.get('code') && !p.get('error')) return;
    if (BrowserP) { try { await BrowserP.close(); } catch (e) { /* Android : sans effet */ } }
    const state = p.get('state') || '';
    const pend = S.modele.pending[state];
    if (!isNative && location.search) history.replaceState(null, '', location.pathname);   // nettoie l'adresse en mode navigateur
    if (p.get('error')) {
      delete S.modele.pending[state]; save();
      log('err', 'Autorisation refusée ou annulée : ' + (p.get('error_description') || p.get('error')));
      toast('Autorisation annulée : ' + (p.get('error_description') || p.get('error')), true);
      return;
    }
    if (!pend) {
      log('err', 'Retour bancaire avec un « state » inconnu : ignoré.');
      toast('Retour bancaire inattendu (state inconnu). Relancez la connexion.', true);
      return;
    }
    await busy(null, async () => {
      log('info', 'Retour reçu de ' + bankLabel(pend.banque) + ', création de la session…');
      const s = await client().createSession(p.get('code'));
      delete S.modele.pending[state];
      const ce = (s.accounts || []).map(M.compteEB);
      const emp = {};
      for (const a of ce) emp[a.uid] = await M.empreinte(S.modele.sel, a);
      ce.forEach(a => { delete a.iban; });                // l'IBAN complet n'est pas gardé
      const valid = (s.access && s.access.valid_until) || '';
      const r = M.associerSession(S, s.session_id, { banque: pend.banque, pays: pend.pays, valid_until: valid, psu: pend.psu,
        maxSecondes: pend.maxSecondes, renouvelle: pend.renouvelle }, ce, emp, Date.now());
      for (const o of r.orphelines) { try { await client().deleteSession(o); } catch (e) { /* déjà expirée */ } }
      log('ok', bankLabel(pend.banque) + (pend.renouvelle ? ' : accès renouvelé, ' : ' : session créée, ') + ce.length + ' compte(s), ' +
        r.associes + ' réassocié(s), ' + r.nouveaux + ' nouveau(x)' + (r.perdus ? ', ' + r.perdus + ' non retrouvé(s)' : '') +
        ', accès jusqu\'au ' + F.date(valid.slice(0, 10)));
      toast((pend.renouvelle ? 'Accès renouvelé : ' : 'Banque connectée : ') + ce.length + ' compte(s).');
      changed('connexion');
      synchro('connexion');
    });
  }

  // ------------------------------------------------------------ banques connectées
  function renderConnexions() {
    const ids = Object.keys(S.modele.connexions);
    const now = Date.now();
    if (!ids.length) { $('connexions').innerHTML = '<p class="muted">Aucune banque connectée.</p>'; return; }
    $('connexions').innerHTML = ids.map(id => {
      const cx = S.modele.connexions[id];
      const a = M.etatAcces(cx, now);
      const comptes = M.comptesDe(S, id);
      return '<div class="sess"><div class="row"><b class="grow">' + esc(cx.banque) + ' <span class="chip">' + esc(cx.pays) + '</span></b></div>' +
        '<p class="muted">' + (a === 'expire' ? '<span class="bad">Accès expiré le ' + esc(F.date(cx.valid_until.slice(0, 10))) + '</span>'
          : 'Accès jusqu\'au ' + esc(F.date((cx.valid_until || '').slice(0, 10))) + (a ? ' <span class="bad">(bientôt expiré)</span>' : '')) + '</p>' +
        (comptes.length ? '<ul class="list">' + comptes.map(c => '<li><div class="grow">' + esc(c.libelle) + '<small>' +
          esc([c.source.intitule, c.source.fin4 ? '…' + c.source.fin4 : '', c.aReassocier ? 'non retrouvé au renouvellement' : ''].filter(Boolean).join(' · ')) +
          '</small></div></li>').join('') + '</ul>' : '<p class="muted">Aucun compte.</p>') +
        '<div class="row"><button class="btn small" data-renouveler="' + esc(id) + '">Renouveler l\'accès</button>' +
        '<button class="btn danger small" data-del="' + esc(id) + '">Déconnecter</button></div></div>';
    }).join('');
  }
  $('connexions').addEventListener('click', ev => {
    const rb = ev.target.closest('[data-renouveler]');
    if (rb) return renouveler(rb.dataset.renouveler, rb);
    const del = ev.target.closest('[data-del]');
    if (del) return busy(del, async () => {
      if (!confirmInline(del, 'Confirmer ?')) return;
      const id = del.dataset.del, cx = S.modele.connexions[id];
      try { await client().deleteSession(id); } catch (e) { if (e.status !== 404) throw e; }
      delete S.modele.connexions[id];
      log('info', bankLabel(cx.banque) + ' : session supprimée (comptes et historique gardés)');
      changed('connexion');
    });
  });
  preparer.secBanques = o => { renderConnexions(); if (!o.rendu) { renderKey(); renderBanks(); } };

  // ------------------------------------------------------------ journal
  $('btnCopyLog').addEventListener('click', () => copy('Klad ' + (CFG.version || '') + ' (' + (CFG.build || 'dev') + ')\n' + S.journal.log.join('\n'), 'Journal copié.'));
  $('btnClearLog').addEventListener('click', () => { S.journal.log = []; saveLog(); renderLog(); });
  preparer.secLog = () => renderLog();

  // ------------------------------------------------------------ ouverture (après déverrouillage) et premier plan
  // ouvertures : fonctions appelées au déverrouillage et à chaque retour au premier plan, appli déverrouillée
  // (résumé Grafit : l'ancienneté des relevés et les jours restants évoluent avec le temps).
  const ouvertures = [];
  function premierPlan() {
    if (!S) return;
    ouvertures.forEach(fn => { try { fn(); } catch (e) { /* un abonné défaillant ne bloque pas les autres */ } });
  }

  $('ver').textContent = 'Version ' + (CFG.version || 'dev') + (isNative ? '' : ' · navigateur');

  function open(state, h) {
    S = state; hooks = h || {}; CTX = null; BCTX = null;
    if (!S.cle.redirectUrl) S.cle.redirectUrl = defaultRedirect();
    // nettoie les autorisations restées en suspens plus d'une heure
    Object.keys(S.modele.pending).forEach(k => { if (Date.now() - (S.modele.pending[k].ts || 0) > 3600e3) delete S.modele.pending[k]; });
    save();
    montrer('vAccueil');
    rendre();
    premierPlan();
    preparerClassement(S);
    if (KladSync.aFaire(S, Date.now())) synchro('auto');
  }

  // Première ouverture de la 0.5 : classement repris du carnet (déjà importé), date de départ des opérations vues.
  async function preparerClassement(s0) {
    try {
      if (!s0.classement && s0.carnet != null && window.KladCarnet.utilisable(s0.carnet)) {
        const r = await window.KladCarnet.convertir(s0, s0.carnet, { now: Date.now() });
        if (S !== s0) return;
        log('ok', 'Classement repris de l\'ancienne version : ' + r.categories + ' catégorie(s), ' + r.base + ' règle(s) de base, ' + r.regles +
          ' règle(s), ' + r.correctionsRetrouvees + '/' + r.corrections + ' correction(s), ' + r.vuesRetrouvees + '/' + r.vues + ' opération(s) cochée(s).');
        toast('Classement repris de l\'ancienne version.');
      }
      if (S !== s0) return;
      const init = KC.initialiserVues(s0, Date.now());
      if (!s0.classement) KC.donnees(s0);
      // Première ouverture de la 0.6 : budget, contrats et virements repris du carnet (le carnet reste intact).
      let bud = false;
      if (!s0.budget && s0.carnet != null && window.KladBudget) {
        try {
          const r = window.KladBudget.importer(s0, s0.carnet, { now: Date.now(), renommer: window.KladCarnet.renommeur(s0.carnet) });
          log('ok', 'Budget repris de l\'ancienne version : ' + r.postes + ' poste(s), ' + r.contrats + ' contrat(s), ' + r.virements + ' virement(s).');
          bud = true;
        } catch (e) { log('err', 'Budget : ' + (e.message || e)); }
      }
      // 0.7 : appels de fonds et équilibre du compte commun repris du carnet (une fois, y compris depuis la 0.6).
      if (s0.budget && (s0.budget.v || 1) < 2 && s0.carnet != null && window.KladCommun) {
        try {
          const r = window.KladCommun.importer(s0, s0.carnet);
          if (r) log('ok', 'Compte commun repris de l\'ancienne version : ' + r.appels + ' copropriété(s) avec appels de fonds, ' + r.equipements + ' dépense(s) d\'équipement ajoutée(s).');
          bud = true;
        } catch (e) { log('err', 'Compte commun : ' + (e.message || e)); }
      }
      // 0.8 : impôts, taxe foncière, épargne, livret et points « fait » repris du carnet (une fois).
      if (s0.budget && (s0.budget.v || 1) < 3 && s0.carnet != null && window.KladFisc) {
        try {
          const r = window.KladFisc.importer(s0, s0.carnet);
          if (r) log('ok', 'Impôts et épargne repris de l\'ancienne version : ' + r.avis + ' avis, ' + r.bulletins + ' bulletin(s).');
          bud = true;
        } catch (e) { log('err', 'Impôts : ' + (e.message || e)); }
      }
      if (init || s0.classement || bud) changed('classement');
    } catch (e) { log('err', 'Classement : ' + (e.message || e)); }
  }

  // Verrouillage : l'état et tout ce qui était affiché sont effacés.
  function close() {
    S = null; hooks = {}; bankList = []; handled = {}; opsListe = []; opsFin = 0; CTX = null; BCTX = null; cls = null; opCourante = null;
    filtre.cat = ''; filtre.nonVues = false;
    fermerVolet();
    toastAction = null; $('toast').className = '';
    ['vAccueil', 'opsListe', 'opsFiltres', 'connexions', 'banks', 'appInfo', 'keyState', 'log', 'listeComptes', 'formCompte',
      'repriseApercu', 'repriseEtat', 'syncDetail', 'opDetail', 'clsCorps', 'classementCorps', 'vBudget', 'posteCorps', 'contratsCorps', 'tendanceCorps', 'ravCorps', 'ajoutCorps', 'virementsCorps', 'equilibreCorps', 'impotsCorps', 'epargneCorps', 'obsCorps', 'resultatsCorps'].forEach(id => { $(id).textContent = ''; });
    $('badgeOps').hidden = true;
    ['appId', 'pemText', 'redirectUrl', 'pemFile', 'bankSearch', 'opsQ'].forEach(id => { $(id).value = ''; });
    $('opsCompte').innerHTML = '';
    $('pastille').textContent = '—'; $('pastille').className = 'pastille';
  }

  window.KladApp = {
    open, close, handleReturn, log, toast, toastAnnuler, copy, confirmInline, busy, changed, synchro, montrer, ouvertures, premierPlan,
    ouvrirVolet, fermerVolet, retourVolet, preparer, rendus, rendre, etat: () => S, hooks: () => hooks, esc, isNative,
    ctx, budget, extras, infoSauvegarde, infoMaj, renouveler, ouvrirOp, trouverOp
  };
})();
