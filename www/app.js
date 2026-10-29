// Klad — coquille de l'appli (apparence de l'ancienne version) : onglets Budget, Opérations, Commun, Plus, écrans
// Équilibre, Impôts, Épargne, Relevés, volets qui montent du bas, pastille de synchro,
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

  // ------------------------------------------------------------ écrans et onglets (comme l'ancienne version)
  // Onglets : Budget (périmètre perso), Opérations, Commun (budget du compte commun), Plus (volet) ; depuis Plus :
  // Équilibre, Impôts, Épargne, Relevés et sauvegarde.
  const VUES = { budget: 'view-budget', commun: 'view-budget', operations: 'view-budget', appartement: 'view-appart', impots: 'view-impots', epargne: 'view-epargne', donnees: 'view-data' };
  const TITRES = { budget: 'Budget', commun: 'Commun', operations: 'Opérations', appartement: 'Équilibre', impots: 'Impôts', epargne: 'Épargne', donnees: 'Relevés' };
  const pos = {};                    // position de défilement de chaque écran
  let vue = 'budget', scope = 'perso';
  function montrer(v, opts) {
    if (!VUES[v]) v = 'budget';
    const avant = vue;
    pos[avant] = window.scrollY;
    vue = v;
    if (v === 'budget') scope = 'perso';
    else if (v === 'commun') scope = 'commun';
    const html = document.documentElement;
    html.classList.toggle('ops-mode', v === 'operations');
    if (v !== 'operations') html.classList.remove('q-open');
    for (const id of new Set(Object.values(VUES))) $(id).hidden = id !== VUES[v];
    document.querySelectorAll('[data-scope]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.scope === scope)));
    const el = $(VUES[v]);
    if (avant !== v) { el.classList.remove('v-in'); void el.offsetWidth; el.classList.add('v-in'); }
    if (opts && opts.rendre !== false) { if (avant !== v || (opts && opts.force)) rendre(); }
    chrome();
    if (avant !== v) requestAnimationFrame(() => window.scrollTo(0, (opts && opts.haut) ? 0 : pos[v] || 0));
  }
  // En-tête : titre, ligne du dessus (période), pastille de synchro, recherche (opérations), thème.
  function chrome() {
    const tb = vue === 'appartement' || vue === 'impots' || vue === 'epargne' || vue === 'donnees' ? 'plus' : vue;
    document.querySelectorAll('#app-tb [data-tab]').forEach(b => { if (b.dataset.tab === tb) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    $('ah-title').textContent = TITRES[vue] || 'Budget';
    let e = '';
    if (S && (vue === 'budget' || vue === 'commun')) {
      try { const B = budget(); const per = B && window.KladBudget.periode(B, scope, window.KladEcranBudget ? window.KladEcranBudget.ui.nav : null);
        if (per) e = per.cyc ? 'Cycle du ' + U.jjmm(per.cyc.start) + ' au ' + U.jjmm(per.cyc.end) : U.mLabel(per.pm0);
        if (per && per.past) e += ' · terminé'; } catch (x) { e = ''; }
    } else if (S && vue === 'operations') {
      e = (periode().from ? 'Depuis ' + U.mLabel(periode().from) : 'Toutes') + ' · ' + (scope === 'commun' ? 'Commun' : 'Perso');
    }
    $('ah-e').textContent = e;
    $('ah-search').hidden = vue !== 'operations';
    const t = AF.theme();
    const sombre = t === 'sombre' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
    $('ah-theme').textContent = sombre ? '☾' : '☀';
    $('ah-theme').title = 'Thème : ' + (t === 'sombre' ? 'sombre' : t === 'clair' ? 'clair' : 'automatique (réglage du téléphone)') + ' — toucher pour changer';
    renderPastille();
  }
  const AF = window.KladAffichage;
  const U = window.KladUI;
  function changerTheme() {
    const t = AF.theme(), n = t === 'auto' ? 'clair' : t === 'clair' ? 'sombre' : 'auto';
    AF.choisirTheme(n);
    chrome();
    rendus.forEach(fn => { try { fn({ theme: true }); } catch (e) { /* rendu suivant */ } });
    return n;
  }
  $('ah-theme').addEventListener('click', () => { const n = changerTheme(); toast('Thème : ' + (n === 'auto' ? 'automatique' : n) + '.'); });
  $('app-tb').addEventListener('click', ev => {
    const b = ev.target.closest('[data-tab]');
    if (!b || !S) return;
    const k = b.dataset.tab;
    if (k === 'plus') { ouvrirVolet('secPlus'); return; }
    if (k === vue) { window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); return; }
    if (k === 'operations') { opsFin = 0; montrer('operations', { rendre: false }); renderOps(true); return; }
    montrer(k, { force: true });
  });
  $('ah-search').addEventListener('click', () => {
    const o = !document.documentElement.classList.contains('q-open');
    document.documentElement.classList.toggle('q-open', o);
    if (o) $('q').focus(); else if ($('q').value) { $('q').value = ''; opsFin = 0; renderOps(true); }
  });

  // ------------------------------------------------------------ période d'analyse (tendance et opérations)
  // Comme l'ancienne version : du mois de début au mois de fin (12 derniers mois complets au départ), gardée sur ce téléphone.
  let perMemo = null;
  function dernierMoisComplet() {
    let d = '';
    for (const c of S.modele.comptes) {
      if (c.masque || (c.role !== 'courant' && c.role !== 'commun')) continue;
      let max = ''; for (const o of S.ops[c.id] || []) if (o.date > max) max = o.date;
      if (max && (!d || max < d)) d = max;
    }
    const auj = M.jourLocal(Date.now());
    d = d || auj;
    const [y, m, dd] = d.split('-').map(Number), fin = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return dd >= fin - 1 ? d.slice(0, 7) : window.KladBudget.shift(d.slice(0, 7), -1);
  }
  function periode() {
    if (perMemo) return perMemo;
    let p = null;
    p = U.pref('periode');
    const to = dernierMoisComplet();
    if (!p || !/^\d{4}-\d{2}$/.test(p.from || '') || !/^\d{4}-\d{2}$/.test(p.to || '')) p = { from: window.KladBudget.shift(to, -11), to, n: 12 };
    if (p.n && p.n !== 'tout') { p.to = to; p.from = window.KladBudget.shift(to, -(p.n - 1)); }
    return (perMemo = p);
  }
  function choisirPeriode(p) {
    perMemo = null;
    U.pref('periode', p);
  }

  // ------------------------------------------------------------ volets (sections rangées, posées dans la feuille du bas)
  const pile = [];
  const preparer = {};          // id de section → fonction appelée avant affichage (et à chaque rendu)
  let voletT = null;
  function ouvrirVolet(id, opts) {
    const sec = $(id);
    if (!sec) return;
    clearTimeout(voletT);
    if (!(opts && opts.empiler)) while (pile.length) $('rangement').appendChild($(pile.pop()));
    else if (pile.length) $('rangement').appendChild($(pile[pile.length - 1]));
    pile.push(id);
    if (preparer[id]) preparer[id](opts || {});
    $('voletCorps').appendChild(sec);
    $('voletTitre').textContent = (opts && opts.titre) || sec.dataset.titre || '';
    document.querySelector('#volet [data-retour]').hidden = pile.length < 2;
    const v = $('volet');
    const deja = !v.hidden;
    v.hidden = false;
    document.querySelector('#volet .sh-body').scrollTop = 0;
    if (!deja) requestAnimationFrame(() => requestAnimationFrame(() => { v.querySelector('.sheet-scrim').classList.add('on'); v.querySelector('.sheet').classList.add('on'); }));
  }
  function fermerVolet(vite) {
    const v = $('volet');
    v.querySelector('.sheet-scrim').classList.remove('on'); v.querySelector('.sheet').classList.remove('on');
    const fin = () => { while (pile.length) $('rangement').appendChild($(pile.pop())); v.hidden = true; };
    clearTimeout(voletT);
    if (vite || v.hidden || matchMedia('(prefers-reduced-motion: reduce)').matches) fin(); else voletT = setTimeout(fin, 240);
  }
  function retourVolet() {
    $('rangement').appendChild($(pile.pop()));
    if (!pile.length) { fermerVolet(true); return; }
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
  // glisser la poignée ou l'en-tête vers le bas pour fermer
  (function () {
    const sh = document.querySelector('#volet .sheet');
    let y0 = null, dy = 0;
    sh.addEventListener('touchstart', e => { if (!e.target.closest('.sh-grip') && !e.target.closest('.sh-head')) return; y0 = e.touches[0].clientY; dy = 0; sh.classList.add('drag'); }, { passive: true });
    sh.addEventListener('touchmove', e => { if (y0 === null) return; dy = Math.max(0, e.touches[0].clientY - y0); sh.style.transform = 'translateY(' + dy + 'px)'; }, { passive: true });
    sh.addEventListener('touchend', () => { if (y0 === null) return; y0 = null; sh.classList.remove('drag'); sh.style.transform = ''; if (dy > 90) fermerVolet(); });
  })();
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && !$('volet').hidden && $('modal').hidden) fermerVolet(); });
  // Champs de montant : un calcul (« 29,99+64 », « =566,19/3 ») est remplacé par son résultat avant tout autre traitement ;
  // la formule revient à la prise du champ, comme dans l'ancienne version.
  const champMontant = el => el && el.matches && el.matches('input[inputmode="decimal"]');
  document.addEventListener('change', ev => {
    const i = ev.target;
    if (!champMontant(i)) return;
    const brut = i.value.trim();
    if (!brut || !U.estCalcul(brut)) { delete i.dataset.formule; return; }
    const v = U.calcul(brut);
    if (v === null) { toast('Calcul non reconnu : « ' + brut + ' »', true); i.value = ''; delete i.dataset.formule; return; }
    i.dataset.formule = brut.startsWith('=') ? brut : '=' + brut;
    i.value = String(v).replace('.', ',');
  }, true);
  document.addEventListener('focusin', ev => {
    const i = ev.target;
    if (!champMontant(i)) return;
    if (i.dataset.formule) i.value = i.dataset.formule;
    if (!i.title) i.title = 'Calcul possible : 29,99+64 ou 566,19/3';
  });
  document.addEventListener('focusout', ev => {
    const i = ev.target;
    if (champMontant(i) && i.dataset.formule && i.value === i.dataset.formule) i.value = String(U.calcul(i.value)).replace('.', ',');
  });
  document.addEventListener('click', ev => {
    const v = ev.target.closest('[data-volet]');
    if (v && S) { ouvrirVolet(v.dataset.volet, { empiler: !!v.closest('#volet') && v.dataset.empiler === '1' }); return; }
    const vv = ev.target.closest('[data-vue]');
    if (vv && S) { fermerVolet(true); montrer(vv.dataset.vue, { force: true, haut: true }); }
  });
  // Bouton retour d'Android : ferme le volet, sinon revient au Budget, sinon met l'appli en arrière-plan.
  const AppP = isNative ? plugin('App') : null;
  if (AppP && AppP.addListener) {
    AppP.addListener('backButton', () => {
      if (!$('modal').hidden) return;
      if (!$('volet').hidden) { if (pile.length > 1) retourVolet(); else fermerVolet(); return; }
      if (S && vue !== 'budget') { montrer(vue === 'commun' || vue === 'operations' ? 'budget' : 'budget', { force: true }); return; }
      if (AppP.minimizeApp) AppP.minimizeApp();
    });
  }

  // ------------------------------------------------------------ volet « Plus » (comme l'ancienne version, puis réglages de Klad)
  function renderPlus() {
    const it = (ic, t, s2, attr) => '<button type="button" class="sh-li" ' + attr + '><span class="ic" aria-hidden="true">' + ic + '</span><span>' + esc(t) + (s2 ? '<small>' + esc(s2) + '</small>' : '') + '</span><span class="r" aria-hidden="true">›</span></button>';
    const t = AF.theme();
    const sombre = t === 'sombre' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
    const d = S.modele.sync.derniere;
    const n = Object.keys(S.modele.connexions).length, c = S.modele.comptes.length, r = S.modele.reprise;
    const nObs = (() => { try { const B = budget(); return B && window.KladObservations ? window.KladObservations.observations(B, 'perso').faire.length : 0; } catch (e) { return 0; } })();
    $('plusCorps').innerHTML = '<div class="sh-list">' +
      it('🏠', 'Équilibre de l\'appartement', 'Qui doit combien à qui', 'data-vue="appartement"') +
      it('🏛️', 'Impôts', 'Avis, prélèvements, partage', 'data-vue="impots"') +
      it('🐷', 'Épargne', 'Livrets et PEE', 'data-vue="epargne"') +
      it('🧾', 'Relevés et sauvegarde', 'État de chaque compte, imports, sauvegarde', 'data-vue="donnees"') +
      it('↻', 'Synchroniser maintenant', syncP ? 'synchronisation en cours…' : d ? 'relevés lus à ' + F.heure(d) : '', 'data-act="sync"') +
      it(sombre ? '☾' : '☀', 'Thème', t === 'auto' ? 'automatique (' + (sombre ? 'sombre' : 'clair') + ', comme le téléphone)' : sombre ? 'thème sombre' : 'thème clair', 'data-act="theme"') +
      '</div><div class="sh-lab">Réglages de Klad</div><div class="sh-list">' +
      it('🏦', 'Banques et accès', n ? n + ' banque' + (n > 1 ? 's' : '') + ' connectée' + (n > 1 ? 's' : '') : 'Aucune banque connectée', 'data-volet="secBanques" data-empiler="1"') +
      it('💳', 'Comptes', c ? c + ' compte' + (c > 1 ? 's' : '') : 'Aucun compte', 'data-volet="secComptes" data-empiler="1"') +
      it('🗂️', 'Classement', 'Catégories, règles, complément', 'data-volet="secClassement" data-empiler="1"') +
      it('🔎', 'Observations', nObs ? nObs + ' point(s) à faire' : 'Rien à faire', 'data-volet="secObs" data-empiler="1"') +
      it('📥', 'Import de reprise', r ? 'Importée le ' + F.date(r.importee.slice(0, 10)) + ', ' + r.nb + ' opération(s)' : 'Aucun import', 'data-volet="secReprise" data-empiler="1"') +
      it('🎨', 'Affichage', 'Thème, mode démo', 'data-volet="secAffichage" data-empiler="1"') +
      it('🧩', 'Modules', window.KladLienGrafit && window.KladLienGrafit.etiquette ? window.KladLienGrafit.etiquette() : 'Lien Grafit', 'data-volet="secModules" data-empiler="1"') +
      it('🔒', 'Verrou', 'Code, empreinte, effacement', 'data-volet="secVerrou" data-empiler="1"') +
      it('📜', 'Journal', 'Anonyme, à copier pour un diagnostic', 'data-volet="secLog" data-empiler="1"') +
      it('ℹ️', 'À propos et mise à jour', 'Version ' + (CFG.version || 'dev'), 'data-volet="secMaj" data-empiler="1"') +
      '</div><div class="row center"><button type="button" id="btnLock" class="btn">Verrouiller</button></div>';
  }
  preparer.secPlus = () => renderPlus();
  $('plusCorps').addEventListener('click', ev => {
    const b = ev.target.closest('[data-act]');
    if (!b) return;
    if (b.dataset.act === 'sync') { fermerVolet(); synchro('manuel'); }
    else if (b.dataset.act === 'theme') { changerTheme(); renderPlus(); }
  });

  // Tableaux trop larges sur téléphone : chaque ligne devient une carte, l'intitulé de colonne est recopié dans chaque
  // case (comme l'ancienne version).
  function cartesTableaux() {
    const etroit = matchMedia('(max-width:620px)').matches;
    document.querySelectorAll('#appli .tablewrap > table').forEach(t => {
      if (t.classList.contains('budget') || t.classList.contains('marges') || t.classList.contains('txv2')) return;
      if (!etroit) { t.classList.remove('mcards'); return; }
      if (t.offsetParent === null) return;
      const w = t.parentElement;
      if (!t.classList.contains('mcards') && w.scrollWidth <= w.clientWidth + 2) return;
      t.classList.add('mcards');
      const hs = [], hr = t.querySelector('thead tr');
      if (hr) for (const th of hr.children) for (let k = 0; k < (th.colSpan || 1); k++) hs.push(th.textContent.trim());
      t.querySelectorAll('tbody tr, tfoot tr').forEach(tr => { let i = 0; for (const td of tr.children) { if (td.dataset.l === undefined && hs[i] !== undefined) td.dataset.l = hs[i]; i += td.colSpan || 1; } });
    });
  }
  let ctT;
  const cartesBientot = () => { clearTimeout(ctT); ctT = setTimeout(cartesTableaux, 60); };
  new MutationObserver(cartesBientot).observe($('appli'), { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden'] });
  addEventListener('resize', cartesBientot);

  // ------------------------------------------------------------ rendu
  const rendus = [];            // fonctions de rendu ajoutées par les autres fichiers (écrans)
  function nonVuesScope() {
    let n = 0;
    for (const c of Vu.comptesDe(S, scope)) {
      if (scope === 'commun' ? c.role !== 'commun' : (c.role === 'commun' || c.role === 'epargne')) continue;
      for (const o of S.ops[c.id] || []) if (!KC.vue(S, o)) n++;
    }
    return n;
  }
  function renderBadge() {
    const n = nonVuesScope(), b = $('tb-badge'), t = n > 99 ? '99+' : String(n);
    if (b.textContent !== t && b.textContent !== '') { b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); }
    b.hidden = !n; b.textContent = t;
    b.setAttribute('aria-label', n + ' à voir');
  }
  // Haut de l'onglet Budget : grande carte, cartes des comptes, « à voir », « À vérifier ».
  function renderHaut() {
    if (!S) return;
    const now = Date.now();
    const ex = extras(now);
    U.reglerApparence(S);
    $('app-hero').innerHTML = Vu.hero(S, scope, now);
    const dettes = {}, livrets = {};
    for (const c of S.modele.comptes) if (c.role === 'carte_differee') dettes[c.id] = KC.dette(S, c, now);
    try { const B = budget(); if (B && window.KladFisc && window.KladFisc.livretCarte) Object.assign(livrets, window.KladFisc.livretCarte(B)); } catch (e) { /* estimation indisponible */ }
    let fdm = null;
    if (scope === 'commun') { try { const B = budget(); fdm = B && window.KladCommun ? window.KladCommun.finDeMois(B) : null; } catch (e) { fdm = null; } }
    $('bal-panel').innerHTML = Vu.rangee(S, scope, now, { dettes, livrets, fdm });
    const av = Vu.aVoir(S, scope, ctx());
    $('app-seen').hidden = !av; $('app-seen').innerHTML = av;
    const ve = scope === 'perso' ? Vu.aVerifier(S, now, ex) : '';
    $('av-zone').hidden = !ve; $('av-zone').innerHTML = ve;
    renderBadge();
  }
  function rendre() {
    if (!S) return;
    CTX = null; BCTX = null;
    renderHaut();
    if (vue === 'operations') renderOps(true);
    rendus.forEach(fn => { try { fn({}); } catch (e) { log('err', 'Affichage : ' + (e.message || e)); } });
    chrome();
    if (pile.length && preparer[pile[pile.length - 1]]) preparer[pile[pile.length - 1]]({ rendu: true });
  }
  const renderAccueil = renderHaut;

  // Haut du Budget : un appui sur une carte de compte ouvre ses opérations ; « à voir » les opérations non vues ;
  // une ligne de « À vérifier » l'écran concerné.
  const AV = { comptes: 'secComptes', banques: 'secBanques', sync: 'secSync', maj: 'secMaj', observations: 'secObs' };
  function versOps(f) {
    Object.assign(filtre, { compte: '', cat: '', nonVues: false }, f || {});
    $('q').value = '';
    opsFin = 0;
    montrer('operations', { rendre: false, haut: true });
    renderOps(true);
  }
  $('view-budget').addEventListener('click', ev => {
    if (ev.target.closest('#app-seen')) { ev.preventDefault(); versOps({ nonVues: true }); return; }
    const av = ev.target.closest('[data-av]');
    if (av) {
      const k = av.dataset.av;
      if (k === 'nonclassees' || k === 'rapprocher') versOps({ cat: k === 'nonclassees' ? '__nc' : '__rap' });
      else if (k === 'sauvegarde') montrer('donnees', { force: true, haut: true });
      else if (AV[k]) ouvrirVolet(AV[k]);
      return;
    }
    const b = ev.target.closest('#bal-panel [data-compte]');
    if (!b) return;
    // livret saisi à la main : son solde et son taux se règlent dans Épargne (comme le ✎ de l'ancienne version)
    const c = M.compte(S, b.dataset.compte);
    if (c && c.role === 'epargne' && c.source.type === 'manuel') montrer('epargne', { force: true, haut: true });
    else versOps({ compte: b.dataset.compte });
  });

  // ------------------------------------------------------------ opérations (liste par jour, recherche, filtres)
  const filtre = { compte: '', q: '', cat: '', nonVues: false };
  let opsListe = [], opsFin = 0;
  function renderOps(reset) {
    if (!S) return;
    if (reset) {
      const cx = ctx();
      filtre.q = $('q').value.trim(); filtre.scope = scope;
      if (filtre.compte && !M.compte(S, filtre.compte)) filtre.compte = '';
      if (filtre.cat && filtre.cat[0] !== '_' && !cx.C.categories[filtre.cat]) filtre.cat = '';
      filtre.depuis = periode().from ? periode().from + '-01' : '';
      opsListe = Vu.filtrer(S, filtre, cx);
      opsFin = 0;
      const base = Object.assign({}, filtre, { cat: '', nonVues: false });
      const unseen = Vu.filtrer(S, Object.assign({}, base, { nonVues: true }), cx).length;
      const nc = Vu.filtrer(S, Object.assign({}, base, { cat: '__nc' }), cx).length;
      $('app-chips').innerHTML = Vu.filtres(S, filtre, cx, { unseen, nc, visiblesNonVues: opsListe.some(o => !KC.vue(S, o)) });
      $('tx').innerHTML = opsListe.length ? '' : '<tr><td colspan="3" class="muted" style="padding:14px 16px">' +
        (filtre.nonVues ? '✓ Toutes les opérations de la période ont été vues.' : filtre.q || filtre.cat || filtre.compte ? 'Aucune opération ne correspond.' : 'Aucune opération pour l\'instant.') + '</td></tr>';
      $('tx-suite').innerHTML = '';
      if (opsListe.length) plus(30);
      chrome();
      return;
    }
    plus(30);
  }
  function plus(nbJours) {
    if (opsFin >= opsListe.length) return;
    const r = Vu.tranche(S, opsListe, opsFin, nbJours, { annee: new Date().getFullYear(), ctx: ctx() });
    $('tx').insertAdjacentHTML('beforeend', r.html);
    opsFin = r.fin;
    $('tx-suite').innerHTML = opsFin < opsListe.length ? '<div class="row center"><button type="button" class="btn" data-suite>Afficher plus</button></div>' : '';
  }
  $('tx-suite').addEventListener('click', ev => { if (ev.target.closest('[data-suite]')) renderOps(false); });
  $('tx').addEventListener('click', ev => {
    if (Date.now() - finGeste < 400) return;
    const tr = ev.target.closest('tr.txr[data-op]');
    if (!tr) return;
    if (ev.target.closest('[data-classer]')) ouvrirClasser(tr.dataset.c, tr.dataset.op);
    else ouvrirOp(tr.dataset.c, tr.dataset.op);
  });
  $('app-chips').addEventListener('click', ev => {
    const b = ev.target.closest('[data-f]');
    if (!b) return;
    const f = b.dataset.f;
    if (f === 'toutes') { filtre.nonVues = false; filtre.cat = ''; filtre.compte = ''; }
    else if (f === 'nonVues') filtre.nonVues = !filtre.nonVues;
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
  $('app-chips').addEventListener('change', ev => {
    if (ev.target.id === 'opsCat') filtre.cat = ev.target.value;
    else if (ev.target.id === 'opsCompte') filtre.compte = ev.target.value;
    else return;
    opsFin = 0; renderOps(true);
  });
  window.addEventListener('scroll', () => {
    if (vue === 'operations' && opsFin < opsListe.length && window.scrollY + window.innerHeight > document.documentElement.scrollHeight - 800) renderOps(false);
  }, { passive: true });
  let qT;
  $('q').addEventListener('input', () => { clearTimeout(qT); qT = setTimeout(() => { opsFin = 0; renderOps(true); }, 200); });

  // ------------------------------------------------------------ gestes sur une opération (comme l'ancienne version)
  // Glisser vers la droite : vue / non vue ; vers la gauche : volet « Classer ». Le détail de l'opération offre les
  // mêmes actions par boutons.
  let finGeste = 0;
  (function () {
    const box = $('tx');
    let G = null;
    const SEUIL = 90;
    box.addEventListener('touchstart', ev => {
      const tr = ev.target.closest('tr.txr[data-op]');
      if (!tr || ev.touches.length > 1) { G = null; return; }
      G = { tr, x: ev.touches[0].clientX, y: ev.touches[0].clientY, dx: 0, lock: false };
    }, { passive: true });
    box.addEventListener('touchmove', ev => {
      if (!G) return;
      const dx = ev.touches[0].clientX - G.x, dy = ev.touches[0].clientY - G.y;
      if (!G.lock) {
        if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.4) { G.lock = true; G.tr.classList.toggle('was-seen', !G.tr.classList.contains('unseen')); }
        else { if (Math.abs(dy) > 12) G = null; return; }
      }
      G.dx = dx;
      const c = Math.max(-150, Math.min(150, dx)), tr = G.tr;
      tr.classList.add('swiping'); tr.classList.toggle('sw-r', c > 0); tr.classList.toggle('sw-l', c < 0); tr.classList.toggle('sw-go', Math.abs(c) >= SEUIL);
      tr.style.setProperty('--sx', c + 'px');
    }, { passive: true });
    const fin = () => {
      if (!G) return;
      const { tr, dx, lock } = G;
      G = null;
      if (!lock) return;
      finGeste = Date.now();
      tr.classList.add('sw-back'); tr.style.setProperty('--sx', '0px');
      setTimeout(() => { tr.classList.remove('swiping', 'sw-r', 'sw-l', 'sw-go', 'sw-back', 'was-seen'); tr.style.removeProperty('--sx'); }, 220);
      if (dx >= SEUIL) basculerVue(tr.dataset.c, tr.dataset.op);
      else if (dx <= -SEUIL) setTimeout(() => ouvrirClasser(tr.dataset.c, tr.dataset.op), 120);
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
    const tr = document.querySelector('#tx tr.txr[data-op="' + CSS.escape(id) + '"]');
    if (tr) tr.classList.toggle('unseen', !on);
    save(); M.signaler('vu'); renderHaut();
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
    if (b.dataset.a === 'vue') { basculerVue(opCourante[0], opCourante[1]); preparer.secOp(); }
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
  function equilibrePossible(o) {
    const c = M.compte(S, o.compte);
    return !!(window.KladCommun && c && c.role !== 'commun' && o.montant < 0);
  }
  function renderClasser() {
    const o = cls && trouverOp(cls.cid, cls.id);
    if (!o) { $('clsCorps').innerHTML = '<p class="muted">Opération introuvable.</p>'; return; }
    $('clsCorps').innerHTML = Vu.classer(S, o, ctx(), cls.st, nbConcernees(), { equilibre: equilibrePossible(o) });
  }
  function majCompte() {
    const n = nbConcernees(), st = cls.st;
    $('clsN').textContent = st.autres ? (st.mot.trim() ? n + ' opération' + (n > 1 ? 's contiennent' : ' contient') + ' « ' + st.mot.trim() + ' »' : 'Saisissez un mot du libellé') : 'Seule cette opération sera classée';
    document.querySelector('#clsCorps [data-a="go"]').textContent = 'Classer en ' + st.cat + (st.autres && n > 1 ? ' (' + n + ')' : '');
  }
  const lireCls = () => { cls.st.sub = $('clsSub').value; cls.st.mot = $('clsMot').value; };
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
    if (ev.target.closest('[data-toutes]')) { cls.st.toutes = true; lireCls(); renderClasser(); return; }
    if (ev.target.closest('#clsAutres')) { lireCls(); cls.st.autres = !cls.st.autres; renderClasser(); return; }
    if (ev.target.closest('[data-a="go"]')) appliquerClasser();
    if (ev.target.closest('[data-a="equilibre"]')) { lireCls(); ouvrirEquilibreOp(); }
  });
  $('clsCorps').addEventListener('input', ev => {
    if (!cls) return;
    if (ev.target.id === 'clsMot') { cls.st.mot = ev.target.value; majCompte(); }
    if (ev.target.id === 'clsSub') cls.st.sub = ev.target.value;
  });
  $('clsCorps').addEventListener('change', ev => {
    if (!cls) return;
    const id = ev.target.id;
    if (id === 'clsCompte' || id === 'clsSens') {
      cls.st.compte = $('clsCompte').checked; cls.st.sens = $('clsSens').value;
      lireCls();
      renderClasser();
    }
  });
  function appliquerClasser() {
    const o = trouverOp(cls.cid, cls.id);
    if (!o) return;
    const st = cls.st;
    if (st.autres && !st.mot.trim()) { toast('Saisissez un mot du libellé.', true); return; }
    const n = st.autres ? nbConcernees() : 1;
    const snap = KC.appliquer(S, o, { cat: st.cat, sub: st.sub || st.cat, mot: st.autres ? st.mot : null, compte: st.autres && st.compte ? cls.cid : null, sens: st.autres ? st.sens : '' });
    const vuAvant = KC.vue(S, o) ? null : KC.marquer(S, [o], true);       // comme l'ancienne version : classée = vue
    log('info', st.autres ? 'Règle de classement créée (' + n + ' opération(s) concernée(s)).' : 'Opération classée à la main.');
    fermerVolet();
    changed('classement');
    toastAnnuler(st.autres ? n + ' opération(s) classée(s) en « ' + st.cat + ' ».' : 'Opération classée en « ' + st.cat + ' ».', () => {
      KC.annuler(S, snap); if (vuAvant) KC.annulerVues(vuAvant); log('info', 'Classement annulé.'); changed('classement');
    });
  }
  // « Ajouter à l'équilibre » : une dépense perso payée pour le logement commun (formulaire dans le même volet).
  function ouvrirEquilibreOp() {
    const o = trouverOp(cls.cid, cls.id);
    if (!o) return;
    const R = window.KladCommun.reglages(budget());
    $('clsCorps').innerHTML = '<div class="sh-lab">Ajouter à l\'équilibre des apports</div>' +
      '<label class="sh-l"><span class="sh-lab">Libellé</span><input type="text" class="sh-in" id="lkLab" maxlength="80" value="' + esc(Vu.libelleCourt(o.libelle)) + '"></label>' +
      '<label class="sh-l"><span class="sh-lab">Montant</span><input type="text" class="sh-in" id="lkMt" inputmode="decimal" value="' + esc(F.versSaisie(Math.abs(o.montant))) + '"></label>' +
      '<label class="sh-l"><span class="sh-lab">Payé par</span><select class="sh-in" id="lkQui"><option value="moi">' + esc(R.moi || 'Moi') + '</option><option value="autre">' + esc(R.autre || 'L\'autre personne') + '</option><option value="moitie">Moitié-moitié</option></select></label>' +
      '<button type="button" class="sh-go" data-a="lkok">Ajouter à l\'équilibre</button>';
  }
  $('clsCorps').addEventListener('click', ev => {
    if (!ev.target.closest('[data-a="lkok"]') || !cls) return;
    const o = trouverOp(cls.cid, cls.id);
    const m = F.saisie($('lkMt').value), lab = $('lkLab').value.trim().slice(0, 80), qui = $('lkQui').value;
    if (!lab || m == null || !m) { toast('Indiquez un libellé et un montant.', true); return; }
    const part = qui === 'moitie' ? [Math.round(m / 2), m - Math.round(m / 2)] : qui === 'moi' ? [m, 0] : [0, m];
    const avant = window.KladCommun.ajouterEquipement(S, { label: lab, date: o.date, moi: part[0], autre: part[1], src: 'op', op: o.id });
    log('info', 'Dépense ajoutée à l\'équilibre depuis une opération.');
    fermerVolet();
    changed('budget');
    toastAnnuler('Dépense ajoutée à l\'équilibre.', () => { window.KladCommun.annulerEquilibre(S, avant); changed('budget'); });
  });

  // ------------------------------------------------------------ synchronisation : pastille, automatique, tirer
  let syncP = null;
  function erreursSync() { return S.modele.comptes.filter(c => c.source.type === 'eb' && c.sync && c.sync.erreur); }
  function renderPastille() {
    const p = $('ah-sync');
    if (!S) { p.className = 'ah-pill'; p.innerHTML = '<span class="ic" aria-hidden="true">✓</span><span class="lb">—</span>'; return; }
    const d = S.modele.sync.derniere;
    const now = Date.now();
    const err = erreursSync().length;
    const late = S.modele.comptes.filter(c => c.source.type === 'eb' && !c.masque && !(c.sync && c.sync.erreur) && M.alerteCompte(S, c, now) === 'Relevé de plus de 30 h').length;
    document.documentElement.classList.toggle('syncing', !!syncP);
    p.className = 'ah-pill' + (syncP ? ' busy' : err ? ' bad' : late ? ' warn' : '');
    p.innerHTML = '<span class="ic" aria-hidden="true">' + (syncP ? '↻' : err || late ? '!' : '✓') + '</span><span class="lb">' +
      (syncP ? 'Synchro…' : err ? 'Erreur' : late ? late + ' en retard' : d ? F.heure(d) : 'Synchroniser') + '</span>';
    p.title = syncP ? 'Synchronisation en cours' : err ? err + ' compte(s) en erreur — toucher pour le détail' : late ? late + ' compte(s) en retard — toucher pour synchroniser' : 'Relevés lus à ' + (d ? F.heure(d) : '—') + ' — toucher pour synchroniser';
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
      .finally(() => { syncP = null; if (S === s0) changed('synchro'); else renderPastille(); });
    renderPastille();
    return syncP;
  }
  $('ah-sync').addEventListener('click', () => {
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
      '<div class="row"><button type="button" class="btn primary" data-a="sync">Synchroniser maintenant</button></div>';
  };
  $('syncDetail').addEventListener('click', ev => { if (ev.target.closest('[data-a="sync"]')) { fermerVolet(); synchro('manuel'); } });

  // Tirer vers le bas en haut de l'écran pour synchroniser (comme l'ancienne version).
  (function () {
    const ptr = $('app-ptr');
    let y0 = null, d = 0;
    addEventListener('touchstart', e => {
      if (!S || !$('volet').hidden || window.scrollY > 0 || e.touches.length > 1 || e.target.closest('.bal-row,.app-chips,#tx tr.txr,.screen')) { y0 = null; return; }
      y0 = e.touches[0].clientY; d = 0;
    }, { passive: true });
    addEventListener('touchmove', e => {
      if (y0 === null) return;
      d = e.touches[0].clientY - y0;
      if (window.scrollY > 0 || d <= 0) { ptr.style.opacity = 0; ptr.style.transform = ''; return; }
      const p = Math.min(1, d / 110);
      ptr.style.opacity = p; ptr.style.transform = 'translateY(' + (Math.min(d * 0.6, 80) - 40) + 'px) rotate(' + (d * 2) + 'deg)'; ptr.classList.toggle('go', d >= 110);
    }, { passive: true });
    addEventListener('touchend', () => {
      if (y0 === null) return;
      const ok = d >= 110 && window.scrollY <= 0;
      y0 = null;
      if (ok && !syncP) {
        ptr.classList.add('spin'); ptr.style.transform = 'translateY(28px)';
        const fin = () => { ptr.classList.remove('spin', 'go'); ptr.style.opacity = 0; ptr.style.transform = ''; };
        Promise.resolve(synchro('tirer')).finally(fin);
      } else { ptr.classList.remove('go'); ptr.style.opacity = 0; ptr.style.transform = ''; }
    }, { passive: true });
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
      '<button class="btn primary small" data-bank="' + bankList.indexOf(b) + '">Connecter</button></li>').join('')
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
        '<div class="row"><button class="btn primary small" data-renouveler="' + esc(id) + '">Renouveler l\'accès</button>' +
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

  $('ver').textContent = 'v' + (CFG.version || 'dev') + (isNative ? '' : ' · navigateur');

  function open(state, h) {
    S = state; hooks = h || {}; CTX = null; BCTX = null;
    if (!S.cle.redirectUrl) S.cle.redirectUrl = defaultRedirect();
    // nettoie les autorisations restées en suspens plus d'une heure
    Object.keys(S.modele.pending).forEach(k => { if (Date.now() - (S.modele.pending[k].ts || 0) > 3600e3) delete S.modele.pending[k]; });
    save();
    vue = 'budget'; scope = 'perso';
    montrer('budget', { rendre: false, haut: true });
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
    filtre.cat = ''; filtre.nonVues = false; filtre.compte = '';
    fermerVolet(true);
    toastAction = null; $('toast').className = '';
    ['app-hero', 'bal-panel', 'app-seen', 'av-zone', 'tx', 'tx-suite', 'app-chips', 'cyc-nav', 'actions', 'rav-m', 'cm-plan', 'budget-main', 'tend-panel', 'ctr-zone', 'cats-panel', 'rules-panel',
      'view-appart', 'view-impots', 'view-epargne', 'imp-panel', 'sauvState', 'plusCorps', 'connexions', 'banks', 'appInfo', 'keyState', 'log', 'listeComptes', 'formCompte',
      'repriseApercu', 'repriseEtat', 'syncDetail', 'opDetail', 'clsCorps', 'classementCorps', 'posteCorps', 'ajoutCorps', 'virementsCorps', 'obsCorps']
      .forEach(id => { const e = $(id); if (e) e.textContent = ''; });
    $('tb-badge').hidden = true;
    ['appId', 'pemText', 'redirectUrl', 'pemFile', 'bankSearch', 'q'].forEach(id => { $(id).value = ''; });
    renderPastille(); $('ah-e').textContent = '';
  }

  window.KladApp = {
    open, close, handleReturn, log, toast, toastAnnuler, copy, confirmInline, busy, changed, synchro, montrer, ouvertures, premierPlan,
    ouvrirVolet, fermerVolet, retourVolet, preparer, rendus, rendre, renderHaut, chrome, vue: () => vue, scope: () => scope, periode, choisirPeriode, versOps, etat: () => S, hooks: () => hooks, esc, isNative,
    ctx, budget, extras, infoSauvegarde, infoMaj, renouveler, ouvrirOp, trouverOp
  };
})();
