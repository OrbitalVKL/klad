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
  // Journal affiché seulement quand son volet est ouvert (pas de mise en page à chaque ligne écrite).
  function renderLog() { const el = $('log'); if (!S || !el.closest('#voletCorps')) return; el.textContent = S.journal.log.join('\n'); el.scrollTop = el.scrollHeight; }

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
  const VUES = { accueil: 'view-accueil', budget: 'view-budget', commun: 'view-budget', operations: 'view-budget', operation: 'view-op', plus: 'view-plus',
    appartement: 'view-appart', impots: 'view-impots', epargne: 'view-epargne', donnees: 'view-data', sauvegarde: 'view-save' };
  const TITRES = { accueil: 'Accueil', budget: 'Budget', commun: 'Commun', operations: 'Opérations', operation: 'Opération', plus: 'Plus', appartement: 'Commun',
    impots: 'Impôts', epargne: 'Épargne', donnees: 'Relevés des comptes', sauvegarde: 'Sauvegarde' };
  // Écrans « page » ouverts depuis un autre (bouton Retour de l'en-tête et retour d'Android) : écran d'où l'on vient
  // (par défaut : la liste des opérations, Plus).
  const RETOUR = { operation: 'operations', impots: 'plus', epargne: 'plus', donnees: 'plus', sauvegarde: 'plus' };
  let retourDe = {};
  const pos = {};                    // position de défilement de chaque écran
  let vue = 'accueil', scope = 'perso';
  function montrer(v, opts) {
    if (!VUES[v]) v = 'accueil';
    const avant = vue;
    pos[avant] = window.scrollY;
    if (RETOUR[v] && avant !== v) retourDe[v] = avant;
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
    const tb = RETOUR[vue] === 'plus' ? 'plus' : vue === 'operation' ? 'operations' : vue === 'appartement' ? 'commun' : vue;
    $('ah-back').hidden = !RETOUR[vue];
    document.querySelectorAll('#app-tb [data-tab]').forEach(b => { if (b.dataset.tab === tb) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    $('ah-title').textContent = TITRES[vue] || 'Accueil';
    let e = '';
    if (S && vue === 'accueil') {
      try { const B = budget(); e = B ? window.KladVuesAccueil.surTitre(window.KladBudget.suivi(B, 'perso', null)) : ''; } catch (x) { e = ''; }
    } else if (S && (vue === 'budget' || vue === 'commun')) {
      try { const B = budget(); const per = B && window.KladBudget.periode(B, scope, window.KladEcranBudget ? window.KladEcranBudget.ui.nav : null);
        if (per) e = per.cyc ? 'Cycle du ' + U.jjmm(per.cyc.start) + ' au ' + U.jjmm(per.cyc.end) : U.mLabel(per.pm0);
        if (per && per.past) e += ' · terminé'; } catch (x) { e = ''; }
    } else if (S && vue === 'operations') {
      e = (perOps.k === 'tout' ? 'Toutes' : bornesOps().libelle) + ' · ' + ({ perso: 'Perso', commun: 'Commun', tout: 'Perso et commun' }[perimOps]);
    } else if (S && vue === 'appartement') {
      e = 'Équilibre des apports';
    } else if (S && vue === 'operation') {
      const o = opCourante && trouverOp(opCourante[0], opCourante[1]);
      e = o ? F.jour(o.date) : '';
    }
    $('ah-e').textContent = e;
    renderPastille();
  }
  const AF = window.KladAffichage;
  const U = window.KladUI;
  // automatique : le téléphone a changé de thème, appli ouverte ; ou palette changée (graphiques et icône du thème redessinés)
  function redessiner() { if (!S) return; chrome(); rendus.forEach(fn => { try { fn({ theme: true }); } catch (e) { /* rendu suivant */ } }); }
  AF.surTheme = redessiner;
  $('app-tb').addEventListener('click', ev => {
    const b = ev.target.closest('[data-tab]');
    if (!b || !S) return;
    const k = b.dataset.tab;
    if (k === 'plus') { montrer('plus', { force: true, haut: true }); return; }
    if (k === vue) { window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); return; }
    if (k === 'operations') { opsFin = 0; montrer('operations', { rendre: false }); renderOps(true); return; }
    montrer(k, { force: true });
  });
  // Retour (écran ouvert depuis un autre) : vers l'écran d'où l'on vient.
  function retourEcran() { montrer(retourDe[vue] || RETOUR[vue] || 'accueil', { force: vue === 'operation' }); }
  $('ah-back').addEventListener('click', retourEcran);

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
    tri = null;                     // fermer le volet arrête « Trier une à une »
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
      if (S && RETOUR[vue]) { retourEcran(); return; }
      if (S && vue !== 'accueil') { montrer('accueil', { force: true }); return; }
      if (AppP.minimizeApp) AppP.minimizeApp();
    });
  }

  // ------------------------------------------------------------ Plus (page, 0.10.3) : Verrouiller en tête, puis 6 groupes
  // Comptes et banques · Données · Modules · Extras · Réglages · Aide et à propos. Synchroniser (pastille, Accueil),
  // le thème (Réglages › Apparence) et les observations (Accueil, Budget) n'y sont plus.
  function renderPlus() {
    const it = (ic, t, s2, attr) => '<button type="button" class="sh-li" ' + attr + '><span class="ic" aria-hidden="true">' + ic + '</span><span>' + esc(t) + (s2 ? '<small>' + esc(s2) + '</small>' : '') + '</span><span class="r" aria-hidden="true">›</span></button>';
    const grp = (t, corps) => '<section class="pl-grp" aria-label="' + esc(t) + '"><h2 class="sh-lab">' + esc(t) + '</h2><div class="sh-list">' + corps + '</div></section>';
    const n = Object.keys(S.modele.connexions).length, c = S.modele.comptes.length;
    const t = AF.theme(), p = AF.palette ? AF.palette() : 'klad';
    $('plusCorps').innerHTML =
      '<button type="button" id="btnLock" class="btn pl-lock"><span aria-hidden="true">🔒</span> Verrouiller maintenant</button>' +
      grp('Comptes et banques',
        it('🏦', 'Banques et accès', n ? n + ' banque' + (n > 1 ? 's' : '') + ' connectée' + (n > 1 ? 's' : '') : 'Aucune banque connectée', 'data-volet="secBanques"') +
        it('💳', 'Comptes', c ? c + ' compte' + (c > 1 ? 's' : '') : 'Aucun compte', 'data-volet="secComptes"') +
        it('🧾', 'Relevés des comptes', 'État de chaque compte, relevé manuel', 'data-vue="donnees"')) +
      grp('Données',
        it('💾', 'Sauvegarde', 'Export chiffré, restauration', 'data-vue="sauvegarde"') +
        it('📥', 'Importer', 'Relevé d\'un compte, reprise de l\'ancienne version, complément', 'data-volet="secImporter"') +
        it('🧮', 'Contrôle', 'Relevé pour comparer avec l\'ancienne version', 'data-volet="secControle"')) +
      grp('Modules',
        it('🏛️', 'Impôts', 'Avis, prélèvements, partage, taxe foncière', 'data-vue="impots"') +
        it('🐷', 'Épargne', 'Livret, plan d\'épargne', 'data-vue="epargne"') +
        it('🧩', 'Lien Grafit', window.KladLienGrafit && window.KladLienGrafit.etiquette ? window.KladLienGrafit.etiquette() : 'Résumé pour Grafit', 'data-volet="secModules"')) +
      grp('Extras',
        it('✨', 'Mail et Claude', window.KladExtras && window.KladExtras.resume ? window.KladExtras.resume(S) : 'Mail, Claude', 'data-volet="secExtras"')) +
      grp('Réglages',
        it('🎨', 'Apparence', 'Thème ' + ({ auto: 'automatique', clair: 'clair', sombre: 'sombre' }[t]) + ' · palette ' + (p === 'grafit' ? 'Grafit' : 'Klad') + ' · mode démo', 'data-volet="secAffichage"') +
        it('🔒', 'Verrou', 'Code, empreinte, effacement', 'data-volet="secVerrou"') +
        it('🗂️', 'Classement', 'Catégories, règles, complément', 'data-volet="secClassement"') +
        it('📐', 'Budget', 'Cycle de salaire, reste à vivre affiché, base de calcul, personnes du commun', 'data-volet="secReglBudget"')) +
      grp('Aide et à propos',
        it('ℹ️', 'Version et mise à jour', 'Version ' + (CFG.version || 'dev'), 'data-volet="secMaj"') +
        it('📜', 'Journal', 'Anonyme, à copier pour un diagnostic', 'data-volet="secLog"'));
  }
  // Réglages › Budget (0.10.5) : réglages du budget rassemblés (lecture ; la base de calcul se change dans Budget, mode
  // « Budget » ; le cycle de salaire et les personnes viennent du complément, modifiables ici au Lot 9c). 0.10.7 : base
  // du reste à vivre affichée (interrupteur, réglage du budget).
  preparer.secReglBudget = () => {
    const KB = window.KladBudget;
    let R = null, per = null, ref = null;
    try { R = KB.reglages(S); const B = budget(); per = B ? KB.periode(B, 'perso', null) : null; ref = S.budget && S.budget.ref; } catch (e) { R = null; }
    const sal = R && R.salaire, cm = R && R.commun;
    const c = sal && sal.compte ? M.compte(S, sal.compte) : null;
    const l = (t, v) => '<li><div class="grow">' + esc(t) + '<small>' + esc(v) + '</small></div></li>';
    $('reglBudgetCorps').innerHTML = '<h3>Cycle de salaire</h3><ul class="list">' +
      l('Cycle en cours', per && per.cyc ? 'du ' + U.jjmm(per.cyc.start) + ' au ' + U.jjmm(per.cyc.end) : 'mois civil (salaire non reconnu)') +
      l('Compte du salaire', c ? c.libelle : 'tous les comptes perso') +
      l('Libellé reconnu', sal && sal.motifs.length ? sal.motifs.join(', ') : 'non réglé') +
      l('Montant minimum', sal && sal.min ? KB.eur(sal.min) : 'aucun') + '</ul>' +
      '<h3>Reste à vivre affiché</h3><p class="muted small">Sur l\'Accueil et dans le résumé lu par Grafit. Le détail montre toujours les deux colonnes.</p>' +
      U.interrupteurRav(KB.baseRav(S), !!(per && budget() && (KB.suivi(budget(), 'perso', null).rav || {}).comptes)) +
      '<h3>Base de calcul du réel habituel</h3><ul class="list">' + l('Depuis', ref ? U.mLong(ref) : 'automatique') + '</ul>' +
      '<div class="row"><button type="button" class="btn" data-a="base">Modifier dans Budget</button></div>' +
      '<h3>Compte commun</h3><ul class="list">' + l('Personnes', cm && (cm.moi || cm.autre) ? [cm.moi, cm.autre].filter(Boolean).join(' et ') : 'non réglées') + '</ul>' +
      '<p class="note">Le cycle de salaire et les personnes viennent des réglages de l\'ancienne version ; ils deviendront modifiables ici avec la version 1.0.</p>';
  };
  $('reglBudgetCorps').addEventListener('click', ev => {
    if (!ev.target.closest('[data-a="base"]')) return;
    const EB = window.KladEcranBudget;
    if (EB) { EB.ui.sv.perso = 'suivi'; EB.ui.mode = 'plan'; }
    fermerVolet(true);
    montrer('budget', { force: true, haut: true });
    const b = $('bref');
    if (b) requestAnimationFrame(() => { b.scrollIntoView(); window.scrollBy(0, -90); });
  });

  // Données › Importer : les trois imports au même endroit.
  preparer.secImporter = () => {
    const r = S.modele.reprise;
    const it = (ic, t, s2, attr) => '<button type="button" class="sh-li" ' + attr + '><span class="ic" aria-hidden="true">' + ic + '</span><span>' + esc(t) + (s2 ? '<small>' + esc(s2) + '</small>' : '') + '</span><span class="r" aria-hidden="true">›</span></button>';
    $('importerCorps').innerHTML = '<div class="sh-list">' +
      it('🧾', 'Relevé d\'un compte', 'CSV, JSON ou Excel, depuis Relevés des comptes', 'data-vue="donnees"') +
      it('📦', 'Reprise de l\'ancienne version', r ? 'Importée le ' + F.date(r.importee.slice(0, 10)) + ', ' + r.nb + ' opération(s)' : 'Aucun import', 'data-volet="secReprise" data-empiler="1"') +
      it('🗂️', 'Complément de classement', 'Dans Classement : « Importer un complément »', 'data-volet="secClassement" data-empiler="1"') + '</div>';
  };

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
  // Badge de l'onglet Opérations : toutes les opérations à voir (perso et commun), comme l'Accueil.
  function nonVuesScope() {
    let n = 0;
    for (const c of Vu.comptesDe(S, 'perso')) for (const o of S.ops[c.id] || []) if (!KC.vue(S, o)) n++;
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
    // 0.10.1 : le haut de l'onglet Budget (grande carte, cartes des comptes, à voir, à vérifier) est passé à l'Accueil
    const perso = scope === 'perso';
    $('app-hero').hidden = perso; $('bal-panel').hidden = perso;
    if (perso) $('app-seen').hidden = true;
    $('av-zone').hidden = true; $('av-zone').innerHTML = '';
    renderBadge();
    renderAccueilEcran(now, ex, dettes, livrets);
  }
  // Onglet Accueil : mêmes fonctions de calcul que les écrans d'origine (aucun calcul propre).
  function renderAccueilEcran(now, ex, dettes, livrets) {
    const el = $('view-accueil');
    if (!el || !window.KladVuesAccueil) return;
    let B = null, res = null, fdm = null, pl = null, R = {}, ech = [];
    try { B = budget(); } catch (e) { B = null; }
    if (B) {
      try { res = window.KladBudget.suivi(B, 'perso', null); } catch (e) { res = null; }
      try { fdm = window.KladCommun ? window.KladCommun.finDeMois(B) : null; } catch (e) { fdm = null; }
      try { pl = window.KladCommun ? window.KladCommun.plan(B) : null; } catch (e) { pl = null; }
      try { R = window.KladCommun ? window.KladCommun.reglages(B) : {}; } catch (e) { R = {}; }
      try { ech = window.KladBudget.echeances(B, 31); } catch (e) { ech = []; }
    }
    try { el.innerHTML = window.KladVuesAccueil.ecran({ S, B, now, ext: ex, res, dettes, livrets, fdm, plan: pl, R, ech }); }
    catch (e) { el.innerHTML = '<p class="muted">Affichage impossible.</p>'; log('err', 'Accueil : ' + (e.message || e)); }
  }
  function rendre() {
    if (!S) return;
    CTX = null; BCTX = null;
    renderHaut();
    if (vue === 'operations') renderOps(true);
    if (vue === 'operation') renderDetail();
    if (vue === 'plus') renderPlus();
    rendus.forEach(fn => { try { fn({}); } catch (e) { log('err', 'Affichage : ' + (e.message || e)); } });
    chrome();
    if (pile.length && preparer[pile[pile.length - 1]]) preparer[pile[pile.length - 1]]({ rendu: true });
  }
  const renderAccueil = renderHaut;

  // Haut du Budget : un appui sur une carte de compte ouvre ses opérations ; « à voir » les opérations non vues ;
  // une ligne de « À vérifier » l'écran concerné.
  const AV = { comptes: 'secComptes', banques: 'secBanques', sync: 'secSync', maj: 'secMaj', observations: 'secObs' };
  // Accueil : lignes « À vérifier », comptes, raccourcis vers les onglets, actions rapides.
  $('view-accueil').addEventListener('click', ev => {
    if (!S) return;
    const av = ev.target.closest('[data-av]');
    if (av) {
      const k = av.dataset.av;
      if (k === 'nonvues') versOps({ nonVues: true });
      else if (k === 'nonclassees' || k === 'rapprocher') versOps({ cat: k === 'nonclassees' ? '__nc' : '__rap' });
      else if (k === 'sauvegarde') montrer('sauvegarde', { force: true, haut: true });
      else if (k === 'bilan') { if (window.KladEcranBudget) window.KladEcranBudget.ui.sv.perso = 'suivi'; montrer('budget', { force: true, haut: true }); if (window.KladEcranBudget && window.KladEcranBudget.cyclePrecedent) window.KladEcranBudget.cyclePrecedent(); }
      else if (AV[k]) ouvrirVolet(AV[k]);
      return;
    }
    const c = ev.target.closest('[data-compte]');
    if (c) {
      const k = M.compte(S, c.dataset.compte);
      if (k && k.role === 'epargne' && k.source.type === 'manuel') montrer('epargne', { force: true, haut: true });
      else versOps({ compte: c.dataset.compte });
      return;
    }
    const a = ev.target.closest('[data-aller]');
    if (a) {
      const k = a.dataset.aller;
      if (k === 'rav') ouvrirVolet('secRav');
      else if (k === 'budget' || k === 'commun' || k === 'contrats-perso' || k === 'contrats-commun') {
        // sous-vue : Budget › Suivi, Commun › Ce mois, Budget › Contrats, Commun › Trésorerie (contrats du commun)
        const EB = window.KladEcranBudget, perso = k === 'budget' || k === 'contrats-perso';
        if (EB) EB.ui.sv[perso ? 'perso' : 'commun'] = k === 'budget' ? 'suivi' : k === 'commun' ? 'mois' : perso ? 'contrats' : 'tresorerie';
        montrer(perso ? 'budget' : 'commun', { force: true, haut: true });
      }
      return;
    }
    const act = ev.target.closest('[data-act]');
    if (!act) return;
    if (act.dataset.act === 'sync') synchro('manuel');
    else if (act.dataset.act === 'trier') trier('nv', 'tout');
    else if (act.dataset.act === 'sauvegarde') montrer('sauvegarde', { force: true, haut: true });
  });
  preparer.secRav = () => {
    let rav = null;
    try { const B = budget(); rav = B ? window.KladBudget.suivi(B, 'perso', null).rav : null; } catch (e) { rav = null; }
    $('ravCorps').innerHTML = window.KladVuesBudget ? window.KladVuesBudget.detailRav(rav, window.KladBudget.baseRav(S)) : '';
  };
  // Base du reste à vivre (0.10.7) : interrupteur de l'Accueil, du détail et du Budget ; réglage du budget (Réglages ›
  // Budget), suivi par le résumé Grafit.
  document.addEventListener('click', ev => {
    const b = ev.target.closest && ev.target.closest('[data-ravbase]');
    if (!b || !S || b.disabled || !window.KladBudget) return;
    ev.stopPropagation();
    if (window.KladBudget.baseRav(S) === b.dataset.ravbase) return;
    window.KladBudget.choisirBaseRav(S, b.dataset.ravbase);
    log('info', 'Reste à vivre : base « ' + window.KladBudget.BASES_RAV[window.KladBudget.baseRav(S)] + ' ».');
    changed('budget');
    if ($('secRav').closest('#volet')) preparer.secRav();
    if ($('reglBudgetCorps').closest('#volet')) preparer.secReglBudget();
  }, true);
  function versOps(f) {
    f = Object.assign({}, f || {});
    perimOps = f.perimetre || 'tout';            // depuis l'Accueil : les compteurs portent sur perso et commun
    delete f.perimetre;
    Object.assign(filtre, { compte: '', cat: '', nonVues: false }, f);
    perOps.k = 'tout';                // depuis l'accueil : toutes les opérations (les compteurs portent sur tout)
    $('q').value = f.q || '';
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
      else if (k === 'sauvegarde') montrer('sauvegarde', { force: true, haut: true });
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
  const filtre = { compte: '', q: '', cat: '', nonVues: false, ordre: 'date' };   // ordre (0.10.8) : gardé pour la session
  // Périmètre de la liste (Perso · Commun · Tout), toujours visible ; le dernier choix est gardé sur ce téléphone.
  let perimOps = ['perso', 'commun', 'tout'].indexOf(U.pref('opsPerimetre')) >= 0 ? U.pref('opsPerimetre') : 'perso';
  let opsListe = [], opsFin = 0;
  // Période des opérations : gardée tant que l'appli reste ouverte (« Toute période » au démarrage).
  const perOps = { k: 'tout', du: '', au: '' };
  const bornesOps = () => Vu.bornesPeriode(perOps.k, M.jourLocal(Date.now()), budget(), perimOps === 'commun' ? 'commun' : 'perso', perOps.du, perOps.au);
  function renderOps(reset) {
    if (!S) return;
    if (reset) {
      const cx = ctx();
      filtre.q = $('q').value.trim(); filtre.scope = perimOps;
      $('ops-scope').innerHTML = Vu.perimetre(perimOps);
      if (filtre.compte && !M.compte(S, filtre.compte)) filtre.compte = '';
      if (filtre.cat && filtre.cat[0] !== '_' && !cx.C.categories[filtre.cat]) filtre.cat = '';
      const bp = bornesOps();
      filtre.du = bp.du; filtre.au = bp.au; filtre.per = perOps.k;
      opsListe = Vu.ordonner(Vu.filtrer(S, filtre, cx), filtre.ordre, cx);
      opsFin = 0;
      const base = Object.assign({}, filtre, { cat: '', nonVues: false });
      const unseen = Vu.filtrer(S, Object.assign({}, base, { nonVues: true }), cx).length;
      const nc = Vu.filtrer(S, Object.assign({}, base, { cat: '__nc' }), cx).length;
      const int = Vu.filtrer(S, Object.assign({}, base, { cat: '__int' }), cx).length;
      $('app-chips').innerHTML = Vu.filtres(S, filtre, cx, { unseen, nc, int, visiblesNonVues: opsListe.some(o => !KC.vue(S, o)) });
      // « Trier une à une » : avec le filtre Non vues ou Non classées
      const nTri = filtre.nonVues || filtre.cat === '__nc' ? opsListe.filter(o => filtre.nonVues ? !KC.vue(S, o) : true).length : 0;
      $('ops-tri').hidden = !nTri;
      $('ops-tri').innerHTML = nTri ? '<button type="button" class="btn primary" data-tri="1">' + (filtre.cat === '__nc' ? 'Classer une à une' : 'Trier une à une') + ' (' + nTri + ')</button>' : '';
      $('ops-perso').hidden = perOps.k !== 'perso';
      if (perOps.k === 'perso') { $('opsDu').value = perOps.du; $('opsAu').value = perOps.au; }
      $('ops-pastille').hidden = perOps.k === 'tout';
      $('ops-pastille').innerHTML = perOps.k === 'tout' ? '' : '<span class="per-pill"><span>' + Vu.esc(bp.libelle) + '</span><button type="button" data-per-effacer aria-label="Effacer la période">×</button></span>';
      const T = Vu.totaux(opsListe);
      $('ops-tot').hidden = !opsListe.length;
      $('ops-tot').innerHTML = opsListe.length ? '<span>' + T.n + ' opération' + (T.n > 1 ? 's' : '') + '</span><span>Débit <b class="num">' + Vu.esc(F.montant(T.debit)) +
        '</b></span><span>Crédit <b class="num">' + Vu.esc(F.montant(T.credit)) + '</b></span>' : '';
      $('tx').innerHTML = opsListe.length ? '' : '<div class="muted tx-vide">' +
        (filtre.nonVues ? '✓ Toutes les opérations de la période ont été vues.' : filtre.q || filtre.cat || filtre.compte || perOps.k !== 'tout' ? 'Aucune opération ne correspond.' : 'Aucune opération pour l\'instant.') + '</div>';
      $('tx-suite').innerHTML = '';
      if (opsListe.length) plus(30);
      chrome();
      return;
    }
    plus(30);
  }
  function plus(nbJours) {
    if (opsFin >= opsListe.length) return;
    const r = Vu.ordreParJour(filtre.ordre) ? Vu.tranche(S, opsListe, opsFin, nbJours, { annee: new Date().getFullYear(), ctx: ctx() })
      : Vu.trancheSansJours(S, opsListe, opsFin, nbJours * 2, { ctx: ctx() });
    $('tx').insertAdjacentHTML('beforeend', r.html);
    opsFin = r.fin;
    $('tx-suite').innerHTML = opsFin < opsListe.length ? '<div class="row center"><button type="button" class="btn" data-suite>Afficher plus</button></div>' : '';
  }
  $('tx-suite').addEventListener('click', ev => { if (ev.target.closest('[data-suite]')) renderOps(false); });
  $('tx').addEventListener('click', ev => {
    if (Date.now() - finGeste < 400) return;
    const tr = ev.target.closest('div.txr[data-op]');
    if (!tr) return;
    if (ev.target.closest('[data-classer]')) ouvrirClasser(tr.dataset.c, tr.dataset.op);
    else ouvrirOp(tr.dataset.c, tr.dataset.op);
  });
  // clavier (ou contacteur) : Entrée ou Espace sur une ligne ouvre son détail
  $('tx').addEventListener('keydown', ev => {
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    const tr = ev.target.closest('div.txr[data-op]');
    if (!tr || ev.target !== tr) return;
    ev.preventDefault();
    ouvrirOp(tr.dataset.c, tr.dataset.op);
  });
  $('ops-scope').addEventListener('click', ev => {
    const b = ev.target.closest('[data-perimetre]');
    if (!b || b.dataset.perimetre === perimOps) return;
    perimOps = b.dataset.perimetre;
    U.pref('opsPerimetre', perimOps);
    if (filtre.compte) filtre.compte = '';
    opsFin = 0; renderOps(true);
  });
  $('ops-tri').addEventListener('click', ev => { if (ev.target.closest('[data-tri]')) trier(filtre.cat === '__nc' ? 'nc' : 'nv'); });
  $('app-chips').addEventListener('click', ev => {
    const b = ev.target.closest('[data-f]');
    if (!b) return;
    const f = b.dataset.f;
    if (f === 'toutes') { filtre.nonVues = false; filtre.cat = ''; filtre.compte = ''; }
    else if (f === 'nonVues') filtre.nonVues = !filtre.nonVues;
    else if (f === 'nc') filtre.cat = filtre.cat === '__nc' ? '' : '__nc';
    else if (f === 'rap') filtre.cat = '';
    else if (f === 'int') filtre.cat = filtre.cat === '__int' ? '' : '__int';
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
    else if (ev.target.id === 'opsPer') perOps.k = ev.target.value;
    else if (ev.target.id === 'opsOrdre') filtre.ordre = ev.target.value;
    else return;
    opsFin = 0; renderOps(true);
  });
  // Période personnalisée (sélecteur de dates du téléphone) et pastille de la période (croix : toute période).
  $('ops-perso').addEventListener('change', () => { perOps.du = $('opsDu').value; perOps.au = $('opsAu').value; opsFin = 0; renderOps(true); });
  $('ops-pastille').addEventListener('click', ev => {
    if (!ev.target.closest('[data-per-effacer]')) return;
    perOps.k = 'tout'; perOps.du = ''; perOps.au = '';
    opsFin = 0; renderOps(true);
  });
  // En défilant : la suite de la liste est ajoutée par petites tranches, une par image, tant qu'il reste moins de
  // 2 500 px d'avance (tâches courtes, 0.10.6) ; les jours hors écran ne sont pas dessinés (content-visibility).
  let remplissage = false;
  const reste = () => document.documentElement.scrollHeight - (window.scrollY + window.innerHeight);
  function remplir() {
    remplissage = false;
    if (vue !== 'operations' || opsFin >= opsListe.length || reste() > 2500) return;
    plus(8);
    remplissage = true;
    requestAnimationFrame(remplir);
  }
  window.addEventListener('scroll', () => {
    if (!remplissage && vue === 'operations' && opsFin < opsListe.length && reste() < 2500) { remplissage = true; requestAnimationFrame(remplir); }
  }, { passive: true });
  let qT;
  $('q').addEventListener('input', () => { clearTimeout(qT); qT = setTimeout(() => { opsFin = 0; renderOps(true); }, 200); });

  // ------------------------------------------------------------ gestes sur une opération (comme l'ancienne version)
  // Glisser vers la droite : vue / non vue ; vers la gauche : volet « Classer ». Le détail de l'opération offre les
  // mêmes actions par boutons. 0.10.7 : pendant le glissement, l'action qui va se produire apparaît sous la ligne
  // (icône et mot : « Vue » ou « Non vue » à droite, « Classer » à gauche), fond plus soutenu une fois le seuil atteint,
  // retour haptique léger au seuil (si le téléphone le permet). « Réduire les animations » : la ligne ne bouge pas,
  // l'action s'affiche par-dessus, sans transition.
  let finGeste = 0;
  const ICO_GESTE = {
    vue: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5"/></svg>',
    nonvue: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2.2" fill="currentColor"/></svg>',
    classer: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4z"/><circle cx="7.5" cy="7.5" r="1.3" fill="currentColor"/></svg>'
  };
  // Action affichée sous la ligne : sens 'r' (vue / non vue) ou 'l' (classer).
  function actionGeste(tr, sens) {
    let el = tr.querySelector(':scope > .sw-act');
    const k = sens === 'r' ? (tr.classList.contains('unseen') ? 'vue' : 'nonvue') : 'classer';
    if (el && el.dataset.k === k) return el;
    if (!el) { el = document.createElement('div'); el.className = 'sw-act'; el.setAttribute('aria-hidden', 'true'); tr.insertBefore(el, tr.firstChild); }
    el.dataset.k = k;
    el.className = 'sw-act sw-' + k;
    el.innerHTML = '<span class="sw-in">' + ICO_GESTE[k] + '<b>' + ({ vue: 'Vue', nonvue: 'Non vue', classer: 'Classer' }[k]) + '</b></span>';
    return el;
  }
  const vibrer = () => { try { if (navigator.vibrate) navigator.vibrate(12); } catch (e) { /* sans vibreur */ } };
  const animationsReduites = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  (function () {
    const box = $('tx');
    let G = null;
    const SEUIL = 90;
    box.addEventListener('touchstart', ev => {
      const tr = ev.target.closest('div.txr[data-op]');
      if (!tr || ev.touches.length > 1) { G = null; return; }
      G = { tr, x: ev.touches[0].clientX, y: ev.touches[0].clientY, dx: 0, lock: false, go: false };
    }, { passive: true });
    box.addEventListener('touchmove', ev => {
      if (!G) return;
      const dx = ev.touches[0].clientX - G.x, dy = ev.touches[0].clientY - G.y;
      if (!G.lock) {
        if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.4) { G.lock = true; G.tr.classList.toggle('was-seen', !G.tr.classList.contains('unseen')); }
        else { if (Math.abs(dy) > 12) G = null; return; }
      }
      G.dx = dx;
      const c = Math.max(-150, Math.min(150, dx)), tr = G.tr, go = Math.abs(c) >= SEUIL;
      actionGeste(tr, c >= 0 ? 'r' : 'l');
      tr.classList.add('swiping'); tr.classList.toggle('sw-r', c > 0); tr.classList.toggle('sw-l', c < 0); tr.classList.toggle('sw-go', go);
      tr.classList.toggle('sw-fixe', animationsReduites());
      if (go && !G.go) vibrer();
      G.go = go;
      tr.style.setProperty('--sx', (animationsReduites() ? 0 : c) + 'px');
    }, { passive: true });
    const fin = () => {
      if (!G) return;
      const { tr, dx, lock } = G;
      G = null;
      if (!lock) return;
      finGeste = Date.now();
      const nettoyer = () => { tr.classList.remove('swiping', 'sw-r', 'sw-l', 'sw-go', 'sw-back', 'sw-fixe', 'was-seen'); tr.style.removeProperty('--sx'); const a = tr.querySelector(':scope > .sw-act'); if (a) a.remove(); };
      if (animationsReduites()) nettoyer();
      else { tr.classList.add('sw-back'); tr.style.setProperty('--sx', '0px'); setTimeout(nettoyer, 220); }
      if (dx >= SEUIL) basculerVue(tr.dataset.c, tr.dataset.op);
      else if (dx <= -SEUIL) setTimeout(() => ouvrirClasser(tr.dataset.c, tr.dataset.op), animationsReduites() ? 0 : 120);
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
    const tr = document.querySelector('#tx div.txr[data-op="' + CSS.escape(id) + '"]');
    if (tr) tr.classList.toggle('unseen', !on);
    save(); M.signaler('vu'); renderHaut();
    toastAnnuler(on ? 'Opération marquée vue.' : 'Opération remise en non vue.', () => { KC.annulerVues(avant); changed('vu'); });
  }

  // ------------------------------------------------------------ détail d'une opération (page avec Retour, 0.10.2)
  let opCourante = null;            // [compte, id]
  function ouvrirOp(cid, id) {
    if (!trouverOp(cid, id)) return;
    opCourante = [cid, id];
    fermerVolet(true);
    renderDetail();
    montrer('operation', { rendre: false, haut: true });
  }
  function renderDetail() {
    const o = opCourante && trouverOp(opCourante[0], opCourante[1]);
    if (!o) { $('opDetail').innerHTML = '<p class="muted">Opération introuvable.</p>'; return; }
    $('opDetail').innerHTML = Vu.detail(S, o, ctx());
  }
  // depuis le détail, une action qui remet l'opération dans la liste ramène à la liste
  const versListe = () => { if (vue === 'operation') montrer(retourDe.operation || 'operations', { force: true }); };
  $('opDetail').addEventListener('click', ev => {
    const b = ev.target.closest('[data-a]');
    if (!b || !opCourante) return;
    if (b.dataset.a === 'vue') { basculerVue(opCourante[0], opCourante[1]); renderDetail(); }
    else if (b.dataset.a === 'classer') ouvrirClasser(opCourante[0], opCourante[1]);
    else if (b.dataset.a === 'semblables') {
      const o = trouverOp(opCourante[0], opCourante[1]);
      if (o) versOps({ q: KC.motPropose(o.libelle) || Vu.libelleCourt(o.libelle) });
    }
    else if (b.dataset.a === 'interne') {
      const o = trouverOp(opCourante[0], opCourante[1]);
      const w = o && KC.aRapprocher(ctx(), o);
      if (!w) return;
      const snap = KC.marquerInterne(ctx(), o, w);
      log('info', 'Prélèvement de portefeuille rapproché à la main.');
      fermerVolet();
      versListe();
      const venu = filtre.cat === '__rap';
      if (venu) filtre.cat = '__int';          // elle reste sous les yeux : filtre « Internes »
      changed('classement');
      toastAnnuler('Prélèvement marqué interne (réglé par ' + w.libelle + ')' + (venu ? ' : il reste dans la liste, filtre « Internes ».' : '.'),
        () => { KC.annulerInterne(snap); if (venu && filtre.cat === '__int') filtre.cat = '__rap'; changed('classement'); });
    } else if (b.dataset.a === 'depense') {
      const o = trouverOp(opCourante[0], opCourante[1]);
      const snap = o && KC.compterEnDepense(o);
      if (!snap) return;
      log('info', 'Opération remise en dépense (marquée interne à la main auparavant).');
      fermerVolet();
      versListe();
      changed('classement');
      toastAnnuler('Opération comptée en dépense : elle revient dans « À vérifier ».', () => { KC.annulerInterne(snap); changed('classement'); });
    }
  });

  // ------------------------------------------------------------ volet « Classer »
  let cls = null;                   // { cid, id, st }
  function ouvrirClasser(cid, id, empiler, opts) {
    const o = trouverOp(cid, id);
    if (!o) return;
    const r = KC.classer(ctx(), o);
    const cat = r.cat;
    // mot présent dans le libellé ; interrupteur coupé s'il ne retrouve aucune opération
    const mot = KC.motPropose(o.libelle);
    const trouve = !!mot && KC.concernees(S, mot, {}).length > 0;
    cls = { cid, id, st: { cat, sub: r.nc ? cat : r.sub, autres: trouve, mot, compte: false, sens: '', toutes: false }, sub0: r.nc ? cat : r.sub, tri: !!(opts && opts.tri) };
    ouvrirVolet('secClasser', { empiler: !!empiler, titre: opts && opts.titre });
  }
  function concerneesCls() {
    const st = cls.st;
    if (!st.autres || !st.mot.trim()) return [];
    return KC.concernees(S, st.mot, { compte: st.compte ? cls.cid : null, sens: st.sens });
  }
  const nbConcernees = () => concerneesCls().length;
  function equilibrePossible(o) {
    const c = M.compte(S, o.compte);
    return !!(window.KladCommun && c && c.role !== 'commun' && o.montant < 0);
  }
  function renderClasser() {
    const o = cls && trouverOp(cls.cid, cls.id);
    if (!o) { $('clsCorps').innerHTML = '<p class="muted">Opération introuvable.</p>'; return; }
    const L = concerneesCls();
    $('clsCorps').innerHTML = Vu.classer(S, o, ctx(), cls.st, L.length, { equilibre: equilibrePossible(o), tri: cls.tri && !!tri, apercu: L });
  }
  function majCompte() {
    const L = concerneesCls(), n = L.length, st = cls.st;
    const ap = $('clsApercu');
    if (ap) ap.innerHTML = st.autres ? Vu.apercuRegle(S, L) : '';
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
    if (ev.target.closest('[data-a="passer"]') && tri) { tri.i++; triSuivant(); return; }
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
    const enTri = cls.tri && tri;
    if (!enTri) fermerVolet();
    changed('classement');
    if (enTri) { tri.i++; setTimeout(triSuivant, 0); }
    toastAnnuler(st.autres ? n + ' opération(s) classée(s) en « ' + st.cat + ' ».' : 'Opération classée en « ' + st.cat + ' ».', () => {
      KC.annuler(S, snap); if (vuAvant) KC.annulerVues(vuAvant); log('info', 'Classement annulé.'); changed('classement');
    });
  }
  // ------------------------------------------------------------ « Trier une à une » (0.10.2)
  // File : opérations à voir du périmètre, puis non classées (3 derniers mois). Non classée : volet « Classer » (catégorie
  // puis « Classer en … » : 2 appuis) ; à voir déjà classée : « C'est bon, vue ». « Passer » laisse l'opération telle quelle ;
  // chaque action reste annulable. Fermer le volet arrête le tri.
  let tri = null, triOp = null;             // { file: [[compte, id]], i }
  const aTrier = o => !!o && (!KC.vue(S, o) || KC.classer(ctx(), o).nc);
  function trier(mode, perim) {
    if (!S) return;
    const cx = ctx(), base = { scope: perim || perimOps };
    const nv = mode === 'nc' ? [] : Vu.filtrer(S, Object.assign({}, base, { nonVues: true }), cx);
    const nc = Vu.filtrer(S, Object.assign({}, base, { cat: '__nc' }), cx);
    const vus = new Set(), file = [];
    for (const o of nv.concat(nc)) if (!vus.has(o.id)) { vus.add(o.id); file.push([o.compte, o.id]); }
    if (!file.length) { toast('Rien à trier.'); return; }
    tri = { file, i: 0 };
    log('info', 'Tri une à une : ' + file.length + ' opération(s).');
    triSuivant();
  }
  function triSuivant() {
    while (tri && tri.i < tri.file.length && !aTrier(trouverOp(tri.file[tri.i][0], tri.file[tri.i][1]))) tri.i++;
    if (!tri) return;
    if (tri.i >= tri.file.length) { tri = null; fermerVolet(); toast('✓ Tri terminé.'); return; }
    const [cid, id] = tri.file[tri.i], o = trouverOp(cid, id);
    const n = ' (' + (tri.i + 1) + ' sur ' + tri.file.length + ')';
    if (KC.classer(ctx(), o).nc) ouvrirClasser(cid, id, false, { tri: true, titre: 'Classer' + n });
    else { triOp = [cid, id]; ouvrirVolet('secTri', { titre: 'À voir' + n }); }
  }
  preparer.secTri = () => {
    const o = triOp && trouverOp(triOp[0], triOp[1]);
    $('triCorps').innerHTML = o ? Vu.triVue(S, o, ctx()) : '';
  };
  $('triCorps').addEventListener('click', ev => {
    const b = ev.target.closest('[data-a]');
    if (!b || !tri || !triOp) return;
    const [cid, id] = triOp;
    if (b.dataset.a === 'trivue') {
      const o = trouverOp(cid, id);
      const avant = o ? KC.marquer(S, [o], true) : [];
      save(); M.signaler('vu'); renderHaut();
      if (vue === 'operations') renderOps(true);
      toastAnnuler('Opération marquée vue.', () => { KC.annulerVues(avant); changed('vu'); });
      tri.i++; triSuivant();
    } else if (b.dataset.a === 'triclasser') ouvrirClasser(cid, id, false, { tri: true, titre: 'Classer (' + (tri.i + 1) + ' sur ' + tri.file.length + ')' });
    else if (b.dataset.a === 'passer') { tri.i++; triSuivant(); }
  });

  // « Ajouter à l'équilibre » : une dépense perso payée pour le logement commun (formulaire dans le même volet).
  function ouvrirEquilibreOp() {
    const o = trouverOp(cls.cid, cls.id);
    if (!o) return;
    const R = window.KladCommun.reglages(budget());
    // 0.10.8 : une opération n'est ajoutée qu'une fois (sinon double compte dans l'équilibre)
    const deja = window.KladCommun.equipementDeOp(S, o.id);
    if (deja) {
      $('clsCorps').innerHTML = '<div class="sh-lab">Déjà dans l\'équilibre des apports</div><p>« ' + esc(deja.label) + ' », ' + esc(F.montant((deja.moi || 0) + (deja.autre || 0))) +
        ' (' + esc((deja.moi ? (R.moi || 'Moi') : '') + (deja.moi && deja.autre ? ' et ' : '') + (deja.autre ? (R.autre || 'l\'autre personne') : '')) + ').</p>' +
        '<p class="muted small">Pour la modifier, retirez-la puis ajoutez-la de nouveau.</p><button type="button" class="btn danger" data-a="lkretirer">Retirer de l\'équilibre</button>';
      return;
    }
    $('clsCorps').innerHTML = '<div class="sh-lab">Ajouter à l\'équilibre des apports</div>' +
      '<label class="sh-l"><span class="sh-lab">Libellé</span><input type="text" class="sh-in" id="lkLab" maxlength="80" value="' + esc(Vu.libelleCourt(o.libelle)) + '"></label>' +
      '<label class="sh-l"><span class="sh-lab">Montant</span><input type="text" class="sh-in" id="lkMt" inputmode="decimal" value="' + esc(F.versSaisie(Math.abs(o.montant))) + '"></label>' +
      '<label class="sh-l"><span class="sh-lab">Payé par</span><select class="sh-in" id="lkQui"><option value="moi">' + esc(R.moi || 'Moi') + '</option><option value="autre">' + esc(R.autre || 'L\'autre personne') + '</option><option value="moitie">Moitié-moitié</option></select></label>' +
      '<button type="button" class="sh-go" data-a="lkok">Ajouter à l\'équilibre</button>';
  }
  $('clsCorps').addEventListener('click', ev => {
    const rt = ev.target.closest('[data-a="lkretirer"]');
    if (rt && cls) {
      const it = window.KladCommun.equipementDeOp(S, cls.id);
      if (!it) return;
      const avant = window.KladCommun.retirerEquipement(S, it.id);
      log('info', 'Dépense retirée de l\'équilibre.');
      fermerVolet();
      changed('budget');
      toastAnnuler('Dépense retirée de l\'équilibre.', () => { window.KladCommun.annulerEquilibre(S, avant); changed('budget'); });
      return;
    }
    if (!ev.target.closest('[data-a="lkok"]') || !cls) return;
    const o = trouverOp(cls.cid, cls.id);
    if (window.KladCommun.equipementDeOp(S, o.id)) return;
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
      if (!S || !$('volet').hidden || window.scrollY > 0 || e.touches.length > 1 || e.target.closest('.bal-row,.app-chips,#tx div.txr,.screen')) { y0 = null; return; }
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
    vue = 'accueil'; scope = 'perso';
    montrer('accueil', { rendre: false, haut: true });
    // 0.10.6 : l'Accueil est dessiné d'abord ; le reste (autres écrans, résumé Grafit, reprise, synchro) après le premier affichage
    renderHaut();
    chrome();
    const s0 = S;
    const ensuite = () => {
      if (S !== s0) return;
      rendus.forEach(fn => { try { fn({}); } catch (e) { log('err', 'Affichage : ' + (e.message || e)); } });
      premierPlan();
      preparerClassement(S);
      if (KladSync.aFaire(S, Date.now())) synchro('auto');
    };
    if (window.requestAnimationFrame) requestAnimationFrame(() => setTimeout(ensuite, 0)); else setTimeout(ensuite, 0);
  }

  // Première ouverture de la 0.5 : classement repris du carnet (déjà importé), date de départ des opérations vues.
  async function preparerClassement(s0) {
    try {
      let modifie = false;          // 0.10.6 : nouvel affichage seulement si quelque chose a changé
      if (!s0.classement && s0.carnet != null && window.KladCarnet.utilisable(s0.carnet)) {
        modifie = true;
        const r = await window.KladCarnet.convertir(s0, s0.carnet, { now: Date.now() });
        if (S !== s0) return;
        log('ok', 'Classement repris de l\'ancienne version : ' + r.categories + ' catégorie(s), ' + r.base + ' règle(s) de base, ' + r.regles +
          ' règle(s), ' + r.correctionsRetrouvees + '/' + r.corrections + ' correction(s), ' + r.vuesRetrouvees + '/' + r.vues + ' opération(s) cochée(s).');
        toast('Classement repris de l\'ancienne version.');
      }
      if (S !== s0) return;
      const init = KC.initialiserVues(s0, Date.now());
      if (!s0.classement) { KC.donnees(s0); modifie = true; }
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
      // 0.9.3 : données figées de l'ancienne version (« _payload » du fichier de reprise) qui n'avaient pas été lues.
      if (window.KladMigrations && !window.KladMigrations.faite(s0) && s0.carnet != null) {
        try {
          const r = await window.KladMigrations.payload(s0, Date.now());
          if (S !== s0) return;
          if (r) {
            log('ok', 'Réglages de l\'ancienne version complétés : ' + r.base + ' règle(s) de base, ' + r.categories + ' catégorie(s) ajoutée(s), ' + r.postes +
              ' poste(s) de budget ajouté(s), ' + r.revprev + ' mois de revenu prévu, ' + r.eqops + ' mouvement(s) d\'équilibre, ' + r.ecartees + ' crédit(s) de règlement de carte retiré(s).');
            if (r.change) toast('Mise à jour des réglages : classement, budget et équilibre complétés depuis l\'ancienne version.');
            bud = true;
          }
        } catch (e) { log('err', 'Mise à jour des réglages : ' + (e.message || e)); }
      }
      // 0.10.7 : une icône pour chaque catégorie (proposée d'après le nom ; les icônes déjà présentes sont gardées).
      if (window.KladMigrations && window.KladMigrations.icones && s0.classement) {
        try {
          const r = window.KladMigrations.icones(s0, Date.now());
          if (r && r.n) { log('ok', 'Icônes : ' + r.n + ' catégorie(s) sans icône en ont reçu une (modifiable dans Plus › Classement).'); modifie = true; }
        } catch (e) { log('err', 'Icônes : ' + (e.message || e)); }
      }
      if (init || modifie || bud) changed('classement');
    } catch (e) { log('err', 'Classement : ' + (e.message || e)); }
  }

  // Verrouillage : l'état et tout ce qui était affiché sont effacés.
  function close() {
    S = null; hooks = {}; bankList = []; handled = {}; opsListe = []; opsFin = 0; CTX = null; BCTX = null; cls = null; opCourante = null;
    filtre.cat = ''; filtre.nonVues = false; filtre.compte = ''; tri = null; triOp = null; retourDe = {};
    fermerVolet(true);
    toastAction = null; $('toast').className = '';
    ['view-accueil', 'ravCorps', 'app-hero', 'bal-panel', 'app-seen', 'av-zone', 'tx', 'tx-suite', 'app-chips', 'cyc-nav', 'sv-bar', 'sv-eq', 'appart-corps', 'cm-tres', 'actions', 'rav-m', 'cm-plan', 'budget-main', 'tend-panel', 'ctr-zone', 'cats-panel', 'rules-panel',
      'view-impots', 'view-epargne', 'imp-panel', 'sauvState', 'plusCorps', 'connexions', 'banks', 'appInfo', 'keyState', 'log', 'listeComptes', 'formCompte',
      'repriseApercu', 'repriseEtat', 'reglBudgetCorps', 'importerCorps', 'syncDetail', 'opDetail', 'clsCorps', 'classementCorps', 'iconeCorps', 'posteCorps', 'ajoutCorps', 'virementsCorps', 'obsCorps', 'controleCorps', 'extrasCorps', 'claudeCorps']
      .forEach(id => { const e = $(id); if (e) e.textContent = ''; });
    $('tb-badge').hidden = true;
    ['appId', 'pemText', 'redirectUrl', 'pemFile', 'bankSearch', 'q'].forEach(id => { $(id).value = ''; });
    renderPastille(); $('ah-e').textContent = '';
  }

  window.KladApp = {
    open, close, handleReturn, log, toast, toastAnnuler, copy, confirmInline, busy, changed, synchro, montrer, ouvertures, premierPlan,
    ouvrirVolet, fermerVolet, retourVolet, preparer, rendus, rendre, redessiner, renderHaut, chrome, vue: () => vue, scope: () => scope, periode, choisirPeriode, versOps, etat: () => S, hooks: () => hooks, esc, isNative,
    ctx, budget, extras, infoSauvegarde, infoMaj, renouveler, ouvrirOp, trouverOp, trier
  };
})();
