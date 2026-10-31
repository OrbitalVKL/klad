// Klad — verrou : coffre natif KladVault, premier lancement (code, phrase de récupération, empreinte),
// écran de verrou, verrouillage automatique, retour bancaire en attente, sauvegarde exportée, section « Sécurité ».
// Tant que l'appli est verrouillée, aucune donnée n'est déchiffrée : la clé (DEK) et l'état n'existent qu'après
// déverrouillage, et le verrouillage les efface de la mémoire avec tout ce qui était affiché.
(function () {
  'use strict';

  const C = window.KladCoffre;
  const A = () => window.KladApp;
  const CFG = window.KLAD_CONFIG || {};
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const capX = window.capacitorExports;
  const isNative = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  const plugin = name => (capX && capX.registerPlugin) ? capX.registerPlugin(name)
    : (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins[name]) || null;
  const V = isNative ? plugin('KladVault') : demoVault();
  const AppP = isNative ? plugin('App') : null;
  const ArretP = isNative ? plugin('KladArret') : null;
  // Action en cours, reprise dans la ligne du journal si Klad s'arrête pendant ce temps (1.0.1).
  function action(nom) { if (ArretP) ArretP.action({ nom: nom || '' }).catch(() => {}); }
  window.KladArret = { action };

  const LOCK_MS = 5 * 60e3;          // verrouillage après 5 min en arrière-plan
  const RAPPEL_JOURS = 30;           // rappel d'export mensuel
  const LAUNCH_SEEN = 'klad.lancement';   // sessionStorage : lien de lancement déjà lu (pas de donnée)

  let key = null;          // DEK importée, non extractible
  let S = null;            // état déchiffré
  let ecrits = {};         // nom de bloc → JSON lu ou écrit : seuls les blocs modifiés sont rechiffrés
  let B = null;            // bloc « sauvegarde » : { sel, iter, cle, dernier }
  let st = {};             // état du coffre natif
  let pendingUrl = null;   // retour bancaire reçu verrouillé : en mémoire seulement
  let active = true;       // appli au premier plan
  let hiddenAt = 0;
  let lockTimer = null;
  let lockPad = null;      // clavier de l'écran de verrou
  let bioAsked = false;
  let bioBusy = false;

  // ------------------------------------------------------------ blocs chiffrés
  const store = {
    async get(n) {
      const r = await V.readBlob({ name: n });
      return r && r.data ? C.open(key, n, C.fromB64(r.data)) : null;
    },
    async put(n, o) { await V.writeBlob({ name: n, data: C.toB64(await C.seal(key, n, o)) }); },
    async del(n) { await V.deleteBlob({ name: n }); }
  };

  // Écritures regroupées (≤ 0,4 s après la modification) et passées une par une. Chaque bloc est comparé à ce qui
  // a été écrit : une synchro ne rechiffre que les blocs changés (en pratique l'année en cours de chaque compte).
  // « * » : tout l'état ; « journal », « sauvegarde » : ce bloc seulement.
  const dirty = new Set();
  let saveTimer = null;
  let chain = Promise.resolve();
  function mark(names) {
    names.forEach(n => dirty.add(n));
    if (!saveTimer) saveTimer = setTimeout(flush, 400);
  }
  function flush() {
    clearTimeout(saveTimer); saveTimer = null;
    const names = [...dirty]; dirty.clear();
    if (!names.length || !key || !S) return chain;
    const k = key;
    const tout = names.indexOf('*') >= 0;
    const blocs = tout ? KladModele.versBlocs(S) : {};
    if (names.indexOf('journal') >= 0) blocs.journal = S.journal;
    if (names.indexOf('sauvegarde') >= 0 && B) blocs.sauvegarde = B;
    const ecrire = [], effacer = [];
    for (const n of Object.keys(blocs)) {
      const j = JSON.stringify(blocs[n]);
      if (ecrits[n] !== j) { ecrire.push([n, j]); ecrits[n] = j; }
    }
    if (tout) for (const n of Object.keys(ecrits)) {
      if (!(n in blocs) && (/^ops-/.test(n) || n === 'carnet' || n === 'classement' || n === 'budget')) { effacer.push(n); delete ecrits[n]; }
    }
    if (!ecrire.length && !effacer.length) return chain;
    chain = chain.then(async () => {
      for (const [n, j] of ecrire) {
        try { await V.writeBlob({ name: n, data: C.toB64(await C.seal(k, n, JSON.parse(j))) }); }
        catch (e) { if (ecrits[n] === j) delete ecrits[n]; throw e; }        // réécrit au prochain enregistrement
      }
      for (const n of effacer) await V.deleteBlob({ name: n });
    }).catch(e => toast('Enregistrement impossible : ' + (e.message || e), true));
    return chain;
  }
  // ------------------------------------------------------------ fichiers par morceaux (1.0.1)
  // Rien de gros ne passe en un seul message entre l'appli et Android : le sélecteur ne reçoit qu'un jeton, les
  // octets passent par morceaux (≤ C.MORCEAU) dans un fichier temporaire privé (voir Transfert.java).
  // Fichier choisi par le sélecteur Android → source { taille, lire(debut, longueur), fermer() }, ou null si annulé.
  async function choisirSource(type) {
    const r = await V.choisirFichier(type ? { type } : {});
    if (!r.ok) { if (r.reason !== 'annule') throw new Error('Lecture impossible : ' + explain(r)); return null; }
    const jeton = r.jeton;
    return {
      taille: r.taille,
      async lire(debut, longueur) {
        const m = await V.tmpLire({ jeton, debut, longueur: Math.min(longueur, C.MORCEAU) });
        if (!m.ok) throw new Error('Lecture impossible : ' + explain(m));
        return C.fromB64(m.data);
      },
      fermer() { return V.tmpAbandon({ jeton }).catch(() => {}); }
    };
  }
  async function lireTout(src) {
    const out = new Uint8Array(src.taille);
    for (let p = 0; p < src.taille;) { const b = await src.lire(p, C.MORCEAU); if (!b.length) break; out.set(b, p); p += b.length; }
    return out;
  }
  // Fichier choisi par le sélecteur Android → octets (relevé, éventuellement Excel), ou null si annulé.
  async function choisirOctets(type) {
    const src = await choisirSource(type);
    if (!src) return null;
    try { return await lireTout(src); } finally { await src.fermer(); }
  }
  // Fichier écrit par morceaux (produire(ajouter)) puis enregistré là où l'utilisateur le choisit (Drive compris).
  // → { ok, reason, message, taille, jeton } ; le résultat est aussi gardé par Android (resultatsEnAttente).
  async function enregistrer(name, type, nature, produire) {
    const o = await V.tmpOuvrir();
    if (!o.ok) throw new Error('Enregistrement impossible : ' + explain(o));
    const jeton = o.jeton;
    try {
      await produire(async octets => {
        for (let i = 0; i < octets.length; i += C.MORCEAU) {
          const r = await V.tmpAjouter({ jeton, data: C.toB64(octets.subarray(i, i + C.MORCEAU)) });
          if (!r.ok) throw new Error(explain(r));
        }
      });
    } catch (e) {
      await V.tmpAbandon({ jeton }).catch(() => {});
      throw e;
    }
    return Object.assign({ jeton }, await V.enregistrerFichier({ jeton, name, type: type || '', nature }));
  }
  // Résultat d'un enregistrement gardé par Android : reçu directement, ou après un verrouillage, une recréation de
  // l'activité ou un arrêt de l'appli pendant le sélecteur. Pris en compte une seule fois, appli déverrouillée.
  const NATURES = { sauvegarde: 'Sauvegarde', controle: 'Relevé de contrôle', texte: 'Fichier' };
  async function resultatsEnAttente() {
    if (!V.resultatEnregistrement || !key || !S) return null;
    let r;
    try { r = (await V.resultatEnregistrement()).resultat; } catch (e) { return null; }
    if (!r || !key || !S || !B) return null;
    const quoi = NATURES[r.nature] || 'Fichier';
    if (r.ok) {
      const mo = r.taille >= 1e6 ? (r.taille / 1e6).toFixed(1).replace('.', ',') + ' Mo' : Math.max(1, Math.round(r.taille / 1e3)) + ' Ko';
      if (r.nature === 'sauvegarde') { B.dernier = new Date(r.le || Date.now()).toISOString(); mark(['sauvegarde']); }
      A().log('ok', quoi + ' enregistré' + (r.nature === 'sauvegarde' ? 'e' : '') + ' (' + mo + ', fichier relu et identique).');
      toast(quoi + ' enregistré' + (r.nature === 'sauvegarde' ? 'e' : '') + '.');
    } else if (r.reason !== 'annule') {
      A().log('err', quoi + ' : enregistrement impossible (' + (r.message || 'erreur') + '). Rien n\'est resté dans le fichier choisi.');
      toast(quoi + ' non enregistré' + (r.nature === 'sauvegarde' ? 'e' : '') + ' : ' + (r.message || 'erreur') + '. Rien n\'a été écrit, réessayez.', true);
    }
    await V.oublierEnregistrement({ jeton: r.jeton }).catch(() => {});
    if (key) renderSecu();
    return r;
  }
  // Fichier choisi par le sélecteur Android (reprise) → texte, ou null si annulé.
  async function choisirFichier() {
    const b = await choisirOctets();
    if (b == null) return null;
    try { return new TextDecoder('utf-8', { fatal: true }).decode(b); }
    catch (e) { return new TextDecoder('windows-1252').decode(b); }      // relevé CSV exporté en Windows-1252
  }
  // Fichier texte enregistré par le sélecteur Android (Drive compris), par morceaux → true, false si annulé ou en échec
  // (message déjà affiché).
  async function exporterTexte(name, text, type) {
    action('export du relevé de contrôle');
    try {
      const r = await enregistrer(name, type, /json/.test(type || '') ? 'controle' : 'texte', async ajouter => { await ajouter(new TextEncoder().encode(text)); });
      // reçu directement : l'écran appelant affiche le résultat ; verrouillé entre-temps : affiché au déverrouillage
      if (key) await V.oublierEnregistrement({ jeton: r.jeton }).catch(() => {});
      if (!r.ok && r.reason !== 'annule') throw new Error('Enregistrement impossible : ' + explain(r) + '. Rien n\'est resté dans le fichier choisi.');
      return !!r.ok;
    } finally { action(''); }
  }
  const hooks = { save: () => mark(['*']), saveLog: () => mark(['journal']), flush, choisirFichier, choisirOctets, exporterTexte };

  // ------------------------------------------------------------ affichage
  const vPanel = $('vPanel');
  const mPanel = $('mPanel');
  function toast(msg, err) { if (A()) A().toast(msg, err); }

  // Logo de Klad (même dessin que l'icône de l'appli).
  const LOGO = '<svg viewBox="18 18 72 72" aria-hidden="true"><rect x="18" y="18" width="72" height="72" fill="#0A0C0E"/><path fill="#9E4A4A" d="M39.92,33.76H47.84V74.24H39.92ZM35.52,32H52.24V35.17H35.52ZM35.52,72.83H52.24V76H35.52ZM47.84,50.66C54.44,48.37 59.28,43.62 62.1,36.93L65.97,38.34C63.15,45.73 57.17,51.71 47.84,56.11ZM64.74,33.41A3.87,3.87 0 1 1 64.73,33.41ZM49.78,54.18L55.41,50.3L74.24,74.24H65.79ZM61.92,72.83H76.88V76H61.92Z"/></svg>';
  function head() {
    return '<div class="vhead"><span class="logo big">' + LOGO + '</span><div><b>Klad</b><small>' + esc(CFG.version || 'dev') +
      (isNative ? '' : ' · navigateur') + '</small></div></div>' +
      (isNative ? '' : '<p class="note">Mode navigateur : coffre de démonstration, sans empreinte. Données fictives uniquement.</p>');
  }
  function screen(html) {
    $('appli').hidden = true;
    $('verrou').hidden = false;
    vPanel.innerHTML = head() + html;
    lockPad = null;
    window.scrollTo(0, 0);
  }
  function busyScreen(text) { screen('<p class="center muted wait">' + esc(text) + '</p>'); }
  function on(root, a, fn) { const b = root.querySelector('[data-a="' + a + '"]'); if (b) b.onclick = fn; }
  function fatal(msg) {
    key = null; S = null;
    screen('<h2>Ouverture impossible</h2><p class="bad">' + esc(msg) + '</p><p class="muted">Rien n\'a été modifié. ' +
      'Si le problème persiste : désinstaller l\'appli, la réinstaller, puis restaurer une sauvegarde avec la phrase de récupération.</p>' +
      '<div class="col"><button class="btn" data-a="r">Réessayer</button></div>');
    on(vPanel, 'r', () => location.reload());
  }

  function fmtWait(ms) {
    const s = Math.ceil(ms / 1000);
    if (s < 60) return s + ' s';
    const m = Math.floor(s / 60), r = s % 60;
    return m + ' min' + (r ? ' ' + String(r).padStart(2, '0') + ' s' : '');
  }
  function fmtDate(iso) { return iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : ''; }

  function explain(r) {
    if (r.reason === 'code') return 'Code incorrect.' + (r.waitMs > 0 ? ' Réessayez dans ' + fmtWait(r.waitMs) + '.' : '');
    if (r.reason === 'attente') return 'Trop de codes faux. Réessayez dans ' + fmtWait(r.waitMs) + '.';
    if (r.reason === 'casse') return 'Coffre illisible sur ce téléphone.';
    if (r.reason === 'annule') return 'Annulé.';
    return r.message || 'Erreur inattendue.';
  }

  // ------------------------------------------------------------ clavier à 6 chiffres
  // Clavier propre à l'appli : le clavier du téléphone n'apprend pas le code.
  const pads = [];
  function makePad(host, onPin) {
    host.innerHTML = '<div class="dots" aria-hidden="true">' + '<i></i>'.repeat(6) + '</div>' +
      '<p class="padmsg" role="status"></p><div class="pad">' +
      ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map(k => k
        ? '<button type="button" class="key" data-k="' + k + '"' + (k === '⌫' ? ' aria-label="Effacer"' : '') + '>' + k + '</button>'
        : '<span></span>').join('') + '</div>';
    let val = '', busy = false, waitT = null;
    const dots = host.querySelectorAll('.dots i');
    const msg = host.querySelector('.padmsg');
    const draw = () => dots.forEach((d, i) => d.classList.toggle('on', i < val.length));
    const api = {
      host,
      async press(k) {
        if (busy) return;
        if (k === '⌫') val = val.slice(0, -1);
        else if (/^\d$/.test(k) && val.length < 6) val += k;
        draw();
        if (val.length < 6) return;
        busy = true;
        const v = val;
        try { await onPin(v); }
        catch (e) { api.say(e.message || String(e), true); }
        finally { val = ''; draw(); if (!waitT) busy = false; }
      },
      say(t, err) { msg.textContent = t || ''; msg.className = 'padmsg' + (err ? ' bad' : ''); },
      wait(ms, prefix) {
        clearInterval(waitT);
        busy = true;
        host.classList.add('locked');
        const end = Date.now() + ms;
        const tick = () => {
          const left = end - Date.now();
          if (left <= 0) { clearInterval(waitT); waitT = null; busy = false; host.classList.remove('locked'); api.say(''); return; }
          api.say((prefix ? prefix + ' ' : '') + 'Réessayez dans ' + fmtWait(left) + '.', true);
        };
        tick();
        waitT = setInterval(tick, 1000);
      },
      close() { clearInterval(waitT); const i = pads.indexOf(api); if (i >= 0) pads.splice(i, 1); }
    };
    host.querySelector('.pad').addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (b) api.press(b.dataset.k); });
    for (let i = pads.length - 1; i >= 0; i--) if (!pads[i].host.isConnected) pads.splice(i, 1);
    pads.push(api);
    return api;
  }
  // Saisie au clavier physique (navigateur, tests) : dernier clavier affiché et visible.
  document.addEventListener('keydown', e => {
    const p = [...pads].reverse().find(x => x.host.isConnected && x.host.offsetParent !== null);
    if (!p || e.target.closest('input, textarea')) return;
    if (/^\d$/.test(e.key)) p.press(e.key);
    else if (e.key === 'Backspace') p.press('⌫');
  });

  function showAttempt(pad, r) {
    if ((r.reason === 'code' || r.reason === 'attente') && r.waitMs > 0) {
      pad.wait(r.waitMs, r.reason === 'code' ? 'Code incorrect.' : 'Trop de codes faux.');
    } else if (r.reason === 'code') {
      const left = 5 - (r.failures || 0);
      pad.say('Code incorrect.' + (left > 0 && left <= 2 ? ' Encore ' + left + ' essai' + (left > 1 ? 's' : '') + ' avant un délai d\'attente.' : ''), true);
    } else pad.say(explain(r), true);
  }

  // ------------------------------------------------------------ fenêtres (modal)
  function showModal(html) { $('modal').hidden = false; mPanel.innerHTML = html; }
  function closeModal() { pads.slice().forEach(p => { if (mPanel.contains(p.host)) p.close(); }); $('modal').hidden = true; mPanel.innerHTML = ''; }

  function askPin(title, sub) {
    return new Promise(resolve => {
      showModal('<h2>' + esc(title) + '</h2>' + (sub ? '<p class="muted">' + esc(sub) + '</p>' : '') +
        '<div class="padhost"></div><div class="row center"><button class="btn" data-a="x">Annuler</button></div>');
      makePad(mPanel.querySelector('.padhost'), async pin => { closeModal(); resolve(pin); });
      on(mPanel, 'x', () => { closeModal(); resolve(null); });
    });
  }

  function askConfirm(title, text, yes) {
    return new Promise(resolve => {
      showModal('<h2>' + esc(title) + '</h2><p>' + esc(text) + '</p><div class="row center">' +
        '<button class="btn danger" data-a="y">' + esc(yes) + '</button><button class="btn" data-a="x">Annuler</button></div>');
      on(mPanel, 'y', () => { closeModal(); resolve(true); });
      on(mPanel, 'x', () => { closeModal(); resolve(false); });
    });
  }

  // Formulaire « phrase de récupération » pour ouvrir le fichier text. onOk({ payload, bk }).
  // Préférences d'affichage gardées dans la sauvegarde (1.0) : thème et palette de ce téléphone.
  const prefsAffichage = () => { const AF = window.KladAffichage; return AF ? { theme: AF.theme(), palette: AF.palette() } : null; };
  function appliquerPrefs(p) {
    const AF = window.KladAffichage;
    if (!AF || !p || typeof p !== 'object') return;
    try { if (AF.THEMES.indexOf(p.theme) >= 0) AF.choisirTheme(p.theme); if (AF.PALETTES.indexOf(p.palette) >= 0) AF.choisirPalette(p.palette); } catch (e) { /* préférence illisible : ignorée */ }
  }

  // src : fichier choisi (pickBackup), avec son en-tête (src.entete).
  function phraseForm(root, src, onOk, onBack, backLabel, goLabel) {
    const h = src.entete;
    root.insertAdjacentHTML('beforeend',
      '<h2>Phrase de récupération</h2><p class="muted">Sauvegarde du ' + esc(fmtDate(h.date || '')) +
      '. Saisissez la phrase : 24 caractères, en 6 groupes de 4.</p>' +
      '<textarea class="phrase-in" rows="2" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"></textarea>' +
      '<p class="msg"></p><div class="row center"><button class="btn" data-a="go">' + esc(goLabel || 'Ouvrir la sauvegarde') + '</button>' +
      '<button class="btn" data-a="back">' + esc(backLabel || 'Retour') + '</button></div>');
    const msg = root.querySelector('.msg');
    on(root, 'back', onBack);
    on(root, 'go', async ev => {
      ev.target.disabled = true;
      msg.className = 'msg muted'; msg.textContent = 'Déchiffrement…';
      try { onOk(await C.ouvrirSauvegarde(src, root.querySelector('.phrase-in').value, h)); }
      catch (e) { msg.className = 'msg bad'; msg.textContent = e.message; ev.target.disabled = false; }
    });
  }

  // Sauvegarde choisie → source lue par morceaux, avec son en-tête ; null si annulé ou illisible (message affiché).
  // L'appelant ferme la source (fichier temporaire supprimé).
  async function pickBackup() {
    let src;
    try { src = await choisirSource(); } catch (e) { toast(e.message, true); return null; }
    if (!src) return null;
    try { src.entete = await C.enteteSauvegarde(src); } catch (e) { await src.fermer(); toast(e.message, true); return null; }
    return src;
  }

  // ------------------------------------------------------------ démarrage
  async function start() {
    busyScreen('Ouverture du coffre…');
    try { st = await V.status(); }
    catch (e) { return fatal('Coffre indisponible : ' + (e.message || e)); }
    if (!st.exists) welcome(); else lockScreen();
  }

  function welcome() {
    screen('<h2>Bienvenue</h2><p>Vos données sont chiffrées sur ce téléphone et s\'ouvrent avec un code à 6 chiffres' +
      (st.bioAvailable ? ' ou votre empreinte' : '') + '.</p>' +
      (hasProto() ? '<p class="note">Les données du prototype seront reprises et chiffrées dès la création du code.</p>' : '') +
      '<div class="col"><button class="btn primary" data-a="new">Créer mon code</button>' +
      '<button class="btn" data-a="restore">Restaurer une sauvegarde</button></div>');
    on(vPanel, 'new', () => choosePin('Créer votre code', pin => createVault(pin, null)));
    on(vPanel, 'restore', restoreFirst);
  }

  function hasProto() { try { return isNative && localStorage.getItem(C.PROTO_KEY) != null; } catch (e) { return false; } }

  // Code saisi deux fois.
  function choosePin(title, done) {
    let first = null;
    const step = (t, sub, err) => {
      screen('<h2>' + esc(t) + '</h2><p class="muted">' + esc(sub) + '</p><div class="padhost"></div>');
      const pad = makePad(vPanel.querySelector('.padhost'), async pin => {
        pad.close();
        if (first === null) { first = pin; step('Confirmez le code', 'Saisissez-le une seconde fois.'); return; }
        if (pin !== first) { first = null; step(title, 'Code à 6 chiffres.', 'Les deux saisies diffèrent. Recommencez.'); return; }
        await done(pin);
      });
      if (err) pad.say(err, true);
    };
    step(title, 'Code à 6 chiffres. Il n\'est écrit nulle part : retenez-le.');
  }

  async function createVault(pin, restored) {
    busyScreen('Création du coffre…');
    try {
      try { await window.KladLienGrafit.effacer(); } catch (e) { /* aucun résumé */ }   // nouveau coffre : lien remis à zéro
      const r = await V.create({ pin });
      if (!r.ok) return fatal('Création impossible : ' + explain(r));
      key = await C.importDek(C.fromB64(r.dek));
      st = await V.status();
      if (restored) {
        const R = await C.depuisSauvegarde(restored.payload);
        const blocs = KladModele.versBlocs(R);
        for (const n of Object.keys(blocs)) await store.put(n, blocs[n]);
        B = Object.assign({}, restored.bk, { verifiee: { le: new Date().toISOString(), date: restored.bk.dernier || null } });   // restaurée : lue en entier
        await store.put('sauvegarde', B);
        appliquerPrefs(restored.payload.prefs);
      }
      await afterKey(pin, true);
    } catch (e) { fatal(e.message || String(e)); }
  }

  // Après obtention de la clé : phrase si besoin, reprise du prototype, empreinte, ouverture.
  async function afterKey(pin, offerBio) {
    B = await store.get('sauvegarde');
    if (!B) await phraseSetup();           // première fois (ou création interrompue avant la phrase)
    let mig = null;
    if (isNative) {
      try { mig = await C.migrate(localStorage, store); }
      catch (e) { toast(e.message, true); }
    }
    if (pin && st.bioAvailable && (offerBio ? st.bio !== 'oui' : st.bio === 'invalidee')) await bioOffer(pin, st.bio === 'invalidee');
    await openApp();
    if (mig && mig.sessions != null) A().log('ok', 'Données du prototype reprises et chiffrées (' + mig.sessions + ' session(s)).');
  }

  function phraseSetup() {
    return new Promise((resolve, reject) => {
      const phrase = C.newPhrase();
      const show = () => {
        screen('<h2>Phrase de récupération</h2>' +
          '<p>Elle seule permet de <b>restaurer une sauvegarde</b> : nouveau téléphone, appli réinstallée ou code oublié.</p>' +
          '<p>Recopiez-la <b>sur papier</b> et gardez-la en lieu sûr. Elle ne sera plus affichée, et les captures d\'écran sont bloquées.</p>' +
          '<ol class="phrase">' + phrase.split('-').map(g => '<li>' + g + '</li>').join('') + '</ol>' +
          '<div class="col"><button class="btn primary" data-a="ok">Je l\'ai recopiée</button></div>');
        on(vPanel, 'ok', check);
      };
      const check = () => {
        const [a, b] = C.pickGroups();
        const field = (i, id) => '<label>Groupe n° ' + (i + 1) + '<input id="' + id + '" maxlength="4" autocomplete="off" autocapitalize="characters" spellcheck="false"></label>';
        screen('<h2>Vérification</h2><p class="muted">Recopiez deux groupes de votre phrase, depuis votre papier.</p>' +
          field(a, 'g1') + field(b, 'g2') + '<p class="msg bad"></p>' +
          '<div class="row center"><button class="btn primary" data-a="v">Vérifier</button><button class="btn" data-a="back">Revoir la phrase</button></div>');
        on(vPanel, 'back', show);
        on(vPanel, 'v', async () => {
          if (!C.checkGroups(phrase, { [a]: $('g1').value, [b]: $('g2').value })) {
            vPanel.querySelector('.msg').textContent = 'Ce n\'est pas la bonne phrase. Vérifiez votre copie.';
            return;
          }
          busyScreen('Préparation de la clé de sauvegarde…');
          try {
            B = await C.newBackupKey(phrase);
            await store.put('sauvegarde', B);
            resolve();
          } catch (e) { reject(e); }
        });
      };
      show();
    });
  }

  function bioOffer(pin, again) {
    return new Promise(resolve => {
      screen('<h2>' + (again ? 'Réactiver l\'empreinte ?' : 'Déverrouiller par empreinte ?') + '</h2>' +
        '<p>' + (again ? 'Une nouvelle empreinte a été enregistrée sur ce téléphone : par sécurité, l\'empreinte avait été désactivée.'
          : 'Klad pourra s\'ouvrir avec votre empreinte. Le code reste toujours possible.') + '</p><p class="msg"></p>' +
        '<div class="col"><button class="btn primary" data-a="y">Activer l\'empreinte</button><button class="btn" data-a="n">Plus tard</button></div>');
      const msg = vPanel.querySelector('.msg');
      on(vPanel, 'y', async ev => {
        ev.target.disabled = true;
        const r = await V.enableBio({ pin });
        ev.target.disabled = false;
        if (r.ok) { st = await V.status(); resolve(); return; }
        msg.className = 'msg bad';
        msg.textContent = r.reason === 'annule' ? 'Empreinte non activée.' : explain(r);
      });
      on(vPanel, 'n', async () => {
        if (again) await V.disableBio();     // n'affiche plus l'avertissement
        st = await V.status();
        resolve();
      });
    });
  }

  async function openApp() {
    busyScreen('Ouverture…');
    let r;
    try { r = await C.charger(store, Date.now()); }
    catch (e) {
      if (e.code !== 'migration') throw e;
      key = null; S = null;
      screen('<h2>Mise à jour des données</h2><p class="bad">' + esc(e.message) + '</p>' +
        '<p class="muted">Vos données de la version précédente sont intactes.</p>' +
        '<div class="col"><button class="btn" data-a="r">Réessayer</button></div>');
      on(vPanel, 'r', () => location.reload());
      return;
    }
    S = r.S; ecrits = r.ecrits;
    closeModal();
    $('verrou').hidden = true;
    $('appli').hidden = false;
    lockPad = null;
    A().open(S, hooks);
    renderSecu();
    if (r.migration) A().log('ok', 'Données de la version 0.2 converties : ' + r.migration.sessions + ' session(s), ' + r.migration.comptes +
      ' compte(s), ' + r.migration.operations + ' opération(s), ' + r.migration.soldes + ' solde(s) ; ancien format supprimé.');
    if (pendingUrl) { const u = pendingUrl; pendingUrl = null; A().handleReturn(u); }
    window.KladMaj.check(true);              // publication plus récente ? (bandeau)
    await arretPrecedent();
    await resultatsEnAttente();              // enregistrement terminé pendant que Klad était verrouillé
  }

  // 1.0.1 : arrêt de Klad lors de l'utilisation précédente (plantage Java ou moteur d'affichage perdu) : ligne anonyme
  // laissée par Android, recopiée dans le journal.
  async function arretPrecedent() {
    if (!ArretP) return;
    try {
      const r = await ArretP.lire();
      if (r && r.ligne) { A().log('err', r.ligne); await ArretP.effacer(); }
    } catch (e) { /* rien à recopier */ }
  }

  // ------------------------------------------------------------ écran de verrou
  function lockScreen() {
    bioAsked = false;
    const bioOn = st.bio === 'oui';
    screen('<h2 class="center">Klad est verrouillé</h2>' +
      '<p class="note" id="pendNote"' + (pendingUrl ? '' : ' hidden') + '>Retour de la banque reçu : déverrouillez pour terminer la connexion.</p>' +
      (st.bio === 'invalidee' ? '<p class="note">Une nouvelle empreinte a été enregistrée sur ce téléphone : par sécurité, l\'empreinte est désactivée. Déverrouillez avec votre code.</p>' : '') +
      '<div class="padhost"></div>' +
      (bioOn ? '<div class="row center"><button class="btn" data-a="bio">Utiliser l\'empreinte</button></div>' : '') +
      '<p class="muted center small">Code oublié : désinstaller l\'appli, puis restaurer une sauvegarde avec la phrase de récupération.</p>');
    const pad = lockPad = makePad(vPanel.querySelector('.padhost'), async pin => {
      const r = await V.unlockPin({ pin });
      if (r.ok) return unlocked(r.dek, pin, 'code');
      showAttempt(pad, r);
    });
    if (st.waitMs > 0) pad.wait(st.waitMs, 'Trop de codes faux.');
    if (bioOn) {
      on(vPanel, 'bio', () => bioUnlock());
      if (active) bioUnlock();
    }
  }

  async function bioUnlock() {
    if (bioBusy || !lockPad) return;
    bioBusy = true; bioAsked = true;
    const pad = lockPad;
    try {
      const r = await V.unlockBio();
      if (r.ok) return await unlocked(r.dek, null, 'empreinte');
      if (r.reason === 'invalidee') { st = await V.status(); lockScreen(); return; }
      if (r.reason !== 'annule') pad.say(explain(r), true);
    } finally { bioBusy = false; }
  }

  async function unlocked(dek, pin, how) {
    busyScreen('Ouverture…');
    try {
      key = await C.importDek(C.fromB64(dek));
      st = await V.status();
      await afterKey(pin, false);
      A().log('info', 'Déverrouillé (' + how + ')');
    } catch (e) { fatal(e.message || String(e)); }
  }

  // Verrouillage : écritures terminées, puis clé, état et affichage effacés de la mémoire.
  // (Pas de rechargement de la page : un retour bancaire en attente serait perdu.)
  let lockP = null;
  function lock() {
    if (lockP) return lockP;
    if (!key) return Promise.resolve();
    clearTimeout(lockTimer);
    lockP = (async () => {
      try { await flush(); } catch (e) { /* déjà signalé */ }
      key = null; S = null; B = null; ecrits = {};
      A().close();
      closeModal();
      try { st = await V.status(); } catch (e) { /* état précédent */ }
      lockScreen();
    })().finally(() => { lockP = null; });
    return lockP;
  }
  const lockDue = () => !!hiddenAt && Date.now() - hiddenAt >= LOCK_MS;

  // ------------------------------------------------------------ restauration
  async function restoreFirst() {
    const src = await pickBackup();
    if (!src) return;
    screen('');
    phraseForm(vPanel, src, res => { src.fermer(); choosePin('Nouveau code', pin => createVault(pin, res)); }, () => { src.fermer(); welcome(); });
  }

  async function restoreInApp() {
    const src = await pickBackup();
    if (!src) return;
    let res;
    action('restauration');
    try {
      res = await new Promise(resolve => {
        showModal('');
        phraseForm(mPanel, src, r => { closeModal(); resolve(r); }, () => { closeModal(); resolve(null); }, 'Annuler');
      });
    } finally { await src.fermer(); action(''); }
    if (!res) return;
    if (!await askConfirm('Remplacer les données ?',
      'La clé Enable Banking, les banques et les opérations de ce téléphone seront remplacées par celles de la sauvegarde. ' +
      'Les prochaines sauvegardes utiliseront la phrase de ce fichier.', 'Remplacer')) return;
    await flush();
    const N = await C.depuisSauvegarde(res.payload);
    N.journal = S.journal;
    S = N;
    B = Object.assign({}, res.bk, { dernier: (B && B.dernier) || res.bk.dernier, verifiee: { le: new Date().toISOString(), date: res.bk.dernier || null } });
    appliquerPrefs(res.payload.prefs);
    A().close();
    A().open(S, hooks);
    mark(['*', 'sauvegarde']);
    await flush();
    A().log('ok', 'Sauvegarde restaurée.');
    renderSecu();
    toast('Sauvegarde restaurée.');
  }

  // ------------------------------------------------------------ section « Sécurité »
  // 1.0.1 : sauvegarde chiffrée morceau par morceau dans un fichier temporaire (déjà chiffré) AVANT le sélecteur ;
  // pendant le sélecteur, Klad peut passer en arrière-plan, se verrouiller ou être recréé : la copie se fait quand même
  // et le résultat est affiché au retour, ou au déverrouillage suivant.
  async function exportNow() {
    await flush();
    const s = S, bk = B;
    const name = 'klad-sauvegarde-' + new Date().toISOString().slice(0, 10) + '.klad';
    action('export de la sauvegarde');
    toast('Préparation de la sauvegarde…');
    let r;
    try {
      r = await enregistrer(name, '', 'sauvegarde', ajouter => C.ecrireSauvegarde(bk, C.contenuSauvegarde(s, prefsAffichage()), ajouter));
    } catch (e) {
      A().log('err', 'Sauvegarde : préparation impossible (' + (e.message || e) + ').');
      throw new Error('Sauvegarde non enregistrée : ' + (e.message || e));
    } finally { action(''); }
    const vu = await resultatsEnAttente();
    if (!vu && key && !r.ok && r.reason !== 'annule') toast('Sauvegarde non enregistrée : ' + explain(r), true);
  }

  // Vérifier une sauvegarde (1.0) : le fichier est ouvert avec la phrase et comparé bloc par bloc aux données
  // actuelles ; rien n'est écrasé. Lisible et complète : elle devient la sauvegarde vérifiée (rappel à 30 jours).
  const NOMS_BLOCS = { cle: 'Clés (Enable Banking, Claude, messagerie)', modele: 'Comptes, banques et réglages', soldes: 'Soldes', carnet: 'Reprise et complément',
    classement: 'Classement', budget: 'Budget et réglages du budget', prefs: 'Apparence (thème, palette)' };
  function nomBloc(n) {
    if (NOMS_BLOCS[n]) return NOMS_BLOCS[n];
    const m = /^ops-(.+)-(\d{4})$/.exec(n);
    if (!m) return n;
    const c = S && S.modele.comptes.find(x => x.id === m[1]);
    return 'Opérations ' + m[2] + ' · ' + (c ? c.libelle : 'compte retiré');
  }
  async function verifierSauvegarde() {
    await flush();
    const src = await pickBackup();
    if (!src) return;
    const h = src.entete;
    let res;
    action('vérification d\'une sauvegarde');
    try {
      res = await new Promise(resolve => {
        showModal('');
        phraseForm(mPanel, src, r => { closeModal(); resolve(r); }, () => { closeModal(); resolve(null); }, 'Annuler', 'Vérifier');
      });
    } finally { await src.fermer(); action(''); }
    if (!res) return;
    const r = C.comparerSauvegarde(res.payload, S, prefsAffichage());
    const ok = r.lisible && r.complete;
    if (ok) {
      B.verifiee = { le: new Date().toISOString(), date: h.date || null };
      mark(['sauvegarde']);
      await flush();
    }
    A().log(ok ? 'ok' : 'warn', 'Sauvegarde vérifiée : ' + (ok ? 'complète et lisible' : 'incomplète') + (r.differents.length + r.manquants.length ? ', ' + (r.differents.length + r.manquants.length) + ' bloc(s) différent(s) des données actuelles' : '') + '.');
    const li = L => L.map(n => '<li>' + esc(nomBloc(n)) + '</li>').join('');
    const cles = 'Clés présentes dans le fichier : Enable Banking ' + (r.cles.eb ? 'oui' : 'non') + ', Claude ' + (r.cles.claude ? 'oui' : 'non') + ', messagerie ' + (r.cles.mail ? 'oui' : 'non') + '.';
    $('sauvVerif').hidden = false;
    $('sauvVerif').innerHTML = (ok && !r.differents.length && !r.manquants.length && !r.enTrop.length
      ? '<p><b>✓ Sauvegarde complète et lisible.</b> Fichier du ' + esc(fmtDate(h.date || '')) + ' : identique aux données actuelles.</p>'
      : (ok ? '<p><b>✓ Sauvegarde complète et lisible</b> (fichier du ' + esc(fmtDate(h.date || '')) + ').</p>' : '<p><b>⚠ Sauvegarde incomplète.</b> Exportez une nouvelle sauvegarde, puis vérifiez-la.</p>') +
        '<p>Ce qui diffère des données actuelles (normal si des opérations sont arrivées depuis) :</p><ul>' +
        li(r.differents) + li(r.manquants.map(n => n)).replace(/<\/li>/g, ' (absent du fichier)</li>') + li(r.enTrop).replace(/<\/li>/g, ' (plus présent aujourd\'hui)</li>') + '</ul>') +
      '<p class="muted small">' + esc(cles) + ' Rien n\'a été modifié sur ce téléphone.</p>';
    renderSecu();
    toast(ok ? 'Sauvegarde complète et lisible.' : 'Sauvegarde incomplète.', !ok);
  }

  async function changePin() {
    const old = await askPin('Changer le code', 'Saisissez le code actuel.');
    if (!old) return;
    let pin;
    for (;;) {
      pin = await askPin('Nouveau code', 'Choisissez un nouveau code à 6 chiffres.');
      if (!pin) return;
      const again = await askPin('Nouveau code', 'Confirmez le nouveau code.');
      if (!again) return;
      if (again === pin) break;
      toast('Les deux saisies diffèrent. Recommencez.', true);
    }
    toast('Changement du code…');
    const r = await V.changePin({ old, pin });
    if (r.ok) { A().log('ok', 'Code changé.'); toast('Code changé.'); }
    else toast(r.reason === 'code' ? 'Code actuel incorrect.' + (r.waitMs > 0 ? ' Réessayez dans ' + fmtWait(r.waitMs) + '.' : '') : explain(r), true);
  }

  async function toggleBio() {
    if (st.bio === 'oui') {
      await V.disableBio();
      A().log('info', 'Empreinte désactivée.');
    } else {
      const pin = await askPin('Activer l\'empreinte', 'Saisissez votre code.');
      if (!pin) return;
      const r = await V.enableBio({ pin });
      if (r.ok) A().log('ok', 'Empreinte activée.');
      else if (r.reason !== 'annule') toast(explain(r), true);
    }
    st = await V.status();
    renderSecu();
  }

  async function wipeAll() {
    const pin = await askPin('Tout effacer', 'Clé, banques, opérations, journal et sauvegarde interne seront effacés de ce téléphone. ' +
      'Pensez d\'abord à déconnecter les banques. Saisissez votre code pour confirmer.');
    if (!pin) return;
    const r = await V.wipe({ pin });
    if (!r.ok) return toast(explain(r), true);
    try { await window.KladLienGrafit.effacer(); } catch (e) { /* clé du résumé déjà supprimée : illisible */ }
    key = null; S = null; B = null; ecrits = {};
    try { localStorage.removeItem(C.PROTO_KEY); } catch (e) { /* rien */ }
    location.reload();
  }

  function renderSecu() {
    const bioOn = st.bio === 'oui';
    $('bioState').textContent = bioOn ? 'Activée.' : st.bioAvailable ? 'Désactivée.' : 'Aucune empreinte forte disponible sur ce téléphone.';
    $('btnBio').textContent = bioOn ? 'Désactiver' : 'Activer';
    $('btnBio').disabled = !bioOn && !st.bioAvailable;
    $('vaultInfo').textContent = isNative
      ? 'Clés gardées par ' + (st.strongBox ? 'la puce sécurisée du téléphone (StrongBox).' : 'le Keystore Android.')
      : 'Mode navigateur : coffre de démonstration.';
    const d = B && B.dernier, v = B && B.verifiee;
    // 1.0 : le rappel compte depuis la dernière sauvegarde vérifiée (date du fichier), pas depuis le dernier export.
    const ref = v ? (v.date || v.le) : null;
    const days = ref ? Math.max(0, Math.floor((Date.now() - Date.parse(ref)) / 864e5)) : null;
    $('sauvState').textContent = (d ? 'Dernier export le ' + fmtDate(d) + '. ' : 'Aucune sauvegarde exportée pour l\'instant. ') +
      (v ? 'Dernière sauvegarde vérifiée : fichier du ' + fmtDate(ref) + ' (vérifiée le ' + fmtDate(v.le) + ').' : 'Aucune sauvegarde vérifiée : exportez-la, puis « Vérifier une sauvegarde ».');
    ($('mSauv') || {}).textContent = v ? 'Vérifiée : fichier du ' + fmtDate(ref) : d ? 'Exportée le ' + fmtDate(d) + ', à vérifier' : 'Aucune sauvegarde exportée';
    // « À vérifier » (accueil) et résumé Grafit : jours depuis la dernière sauvegarde vérifiée (null : aucune).
    A().infoSauvegarde({ jours: days, rappel: days == null || days >= RAPPEL_JOURS, exportee: !!d, verifiee: !!v });
  }

  function guard(fn) {
    return async ev => {
      const b = ev && ev.currentTarget;
      if (b) b.disabled = true;
      try { await fn(); } catch (e) { toast(e.message || String(e), true); }
      finally { if (b) b.disabled = false; if (key) renderSecu(); }
    };
  }
  document.addEventListener('click', ev => { if (ev.target.closest('#btnLock, [data-act="verrou"]')) lock(); });
  $('btnBio').addEventListener('click', guard(toggleBio));
  $('btnPin').addEventListener('click', guard(changePin));
  $('btnExport').addEventListener('click', guard(exportNow));
  $('btnRestore').addEventListener('click', guard(restoreInApp));
  $('btnVerifier').addEventListener('click', guard(verifierSauvegarde));
  $('btnWipe').addEventListener('click', guard(wipeAll));

  // ------------------------------------------------------------ retour bancaire klad://eb
  function onUrl(url) {
    if (!url || !/^klad:\/\/eb\b/i.test(url) && url.indexOf('code=') < 0 && url.indexOf('error=') < 0) return;
    if (key && S && !lockDue() && !lockP) { A().handleReturn(url); return; }
    pendingUrl = url;                        // traité après déverrouillage (state vérifié par app.js)
    if (key) { lock(); return; }             // retour après plus de 5 min : verrouiller d'abord
    const n = $('pendNote');
    if (n) n.hidden = false;
  }

  // ------------------------------------------------------------ arrière-plan : masque, verrouillage après 5 min
  function setActive(isActive) {
    if (!isActive) {
      active = false;
      $('masque').hidden = false;
      hiddenAt = Date.now();
      clearTimeout(lockTimer);
      if (key) lockTimer = setTimeout(lock, LOCK_MS);
      return;
    }
    active = true;
    clearTimeout(lockTimer);
    const due = lockDue();
    hiddenAt = 0;
    const reveal = () => {
      $('masque').hidden = true;             // le masque reste tant que l'écran de verrou n'est pas affiché
      if (!key && lockPad && st.bio === 'oui' && !bioAsked) bioUnlock();
    };
    if ((key && due) || lockP) { lock().then(reveal); return; }
    reveal();
    if (key && S) A().premierPlan();         // déverrouillé : résumé Grafit remis à jour (relevés, jours restants)
  }

  if (AppP) {
    AppP.addListener('appStateChange', s => setActive(!!(s && s.isActive)));
    AppP.addListener('appUrlOpen', ev => onUrl(ev && ev.url));
    let seen = false;
    try { seen = sessionStorage.getItem(LAUNCH_SEEN) === '1'; sessionStorage.setItem(LAUNCH_SEEN, '1'); } catch (e) { /* rien */ }
    if (!seen) AppP.getLaunchUrl().then(r => r && r.url && onUrl(r.url)).catch(() => {});
    AppP.getState().then(s => { active = !!(s && s.isActive); }).catch(() => {});
  } else {
    document.addEventListener('visibilitychange', () => setActive(document.visibilityState === 'visible'));
    if (location.search.indexOf('code=') >= 0 || location.search.indexOf('error=') >= 0) onUrl(location.href);
  }

  // ------------------------------------------------------------ coffre de démonstration (navigateur seulement)
  // Hors Android il n'y a ni Keystore ni empreinte : ce coffre imite KladVault pour essayer l'interface.
  // Il garde son contenu dans sessionStorage (onglet courant) : à n'utiliser qu'avec des données fictives.
  // Données trop grosses pour sessionStorage (jeu fictif de taille réelle, 1.0.1) : gardées en mémoire seulement.
  function demoVault() {
    const K = 'klad.demo';
    let memo = null;
    const load = () => { if (memo) return memo; try { return JSON.parse(sessionStorage.getItem(K)) || { blobs: {} }; } catch (e) { return { blobs: {} }; } };
    const save = d => { try { sessionStorage.setItem(K, JSON.stringify(d)); memo = null; } catch (e) { memo = d; sessionStorage.removeItem(K); } };
    const b64 = a => btoa(String.fromCharCode.apply(null, a));
    const ok = o => Object.assign({ ok: true }, o || {});
    const tmp = new Map();
    window.KladDemoCoffre = { messages: { n: 0, max: 0 }, avantSelecteur: null };
    const compter = t => { const m = window.KladDemoCoffre.messages; m.n++; m.max = Math.max(m.max, String(t || '').length); };
    const check = (d, pin) => {
      if (pin === d.pin) { d.fails = 0; save(d); return null; }
      d.fails = (d.fails || 0) + 1; save(d);
      return { ok: false, reason: 'code', waitMs: d.fails >= 5 ? 30000 : 0, failures: d.fails };
    };
    return {
      async status() { const d = load(); return { exists: !!d.pin, bio: 'non', bioAvailable: false, waitMs: 0, failures: d.fails || 0, strongBox: false }; },
      async create({ pin }) { const dek = crypto.getRandomValues(new Uint8Array(32)); save({ pin, dek: b64(dek), fails: 0, blobs: {} }); return ok({ dek: b64(dek) }); },
      async unlockPin({ pin }) { const d = load(); return check(d, pin) || ok({ dek: d.dek }); },
      async changePin({ old, pin }) { const d = load(); const f = check(d, old); if (f) return f; d.pin = pin; save(d); return ok(); },
      async wipe({ pin }) { const d = load(); const f = check(d, pin); if (f) return f; memo = null; sessionStorage.removeItem(K); return ok(); },
      async unlockBio() { return { ok: false, reason: 'absente' }; },
      async enableBio() { return { ok: false, reason: 'erreur', message: 'Pas d\'empreinte dans le navigateur.' }; },
      async disableBio() { return ok(); },
      async writeBlob({ name, data }) { const d = load(); d.blobs[name] = data; save(d); return ok(); },
      async readBlob({ name }) { return ok({ data: load().blobs[name] || null }); },
      async deleteBlob({ name }) { const d = load(); delete d.blobs[name]; save(d); return ok(); },
      // 1.0.1 : fichiers par morceaux, comme KladVault (fichiers temporaires en mémoire). Pour les tests :
      // KladDemoCoffre.messages (taille du plus gros message reçu), KladDemoCoffre.avantSelecteur (attendu pendant le
      // « sélecteur » : arrière-plan, verrouillage simulés).
      async tmpOuvrir() { const j = Array.from(crypto.getRandomValues(new Uint8Array(8)), x => x.toString(16).padStart(2, '0')).join(''); tmp.set(j, []); return ok({ jeton: j }); },
      async tmpAjouter({ jeton, data }) {
        compter(data);
        const t = tmp.get(jeton);
        if (!t) return { ok: false, reason: 'erreur', message: 'Fichier temporaire absent' };
        const b = C.fromB64(data);
        if (b.length > 512 * 1024) { tmp.delete(jeton); return { ok: false, reason: 'erreur', message: 'Morceau trop gros' }; }
        t.push(b);
        return ok({ taille: t.reduce((n, x) => n + x.length, 0) });
      },
      async tmpLire({ jeton, debut, longueur }) {
        const t = tmp.get(jeton);
        if (!t) return { ok: false, reason: 'erreur', message: 'Fichier temporaire absent' };
        const b = t[0].subarray(debut, debut + Math.min(longueur, 512 * 1024));
        const r = ok({ data: C.toB64(b), fin: debut + b.length >= t[0].length });
        compter(r.data);
        return r;
      },
      async tmpAbandon({ jeton }) { tmp.delete(jeton); return ok(); },
      async enregistrerFichier(o) {
        compter(JSON.stringify(o));
        const t = tmp.get(o.jeton);
        if (!t) return { ok: false, reason: 'erreur', message: 'Fichier préparé introuvable' };
        const sim = window.KladDemoCoffre.avantSelecteur ? await window.KladDemoCoffre.avantSelecteur(o) : null;
        const noter = r => { sessionStorage.setItem(K + '.resultat', JSON.stringify(Object.assign({ jeton: o.jeton, nature: o.nature || '', reason: '', message: '', taille: 0, le: Date.now() }, r))); };
        if (sim && (sim.annule || sim.erreur)) {        // sélecteur fermé sans choisir, ou copie en échec (rien d'écrit)
          tmp.delete(o.jeton);
          noter({ ok: false, reason: sim.annule ? 'annule' : 'erreur', message: sim.erreur || '' });
          return { ok: false, reason: sim.annule ? 'annule' : 'erreur', message: sim.erreur || '' };
        }
        const taille = t.reduce((n, x) => n + x.length, 0);
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob(t, { type: 'application/octet-stream' }));
        a.download = o.name; document.body.appendChild(a); a.click(); a.remove();
        tmp.delete(o.jeton);
        noter({ ok: true, taille });
        return ok({ taille });
      },
      async resultatEnregistrement() { let r = null; try { r = JSON.parse(sessionStorage.getItem(K + '.resultat')); } catch (e) { r = null; } return ok({ resultat: r }); },
      async oublierEnregistrement({ jeton }) { const r = (await this.resultatEnregistrement()).resultat; if (r && (!jeton || r.jeton === jeton)) sessionStorage.removeItem(K + '.resultat'); return ok(); },
      choisirFichier(o) {
        return new Promise(resolve => {
          const i = document.createElement('input');
          i.type = 'file';
          if (o && o.type) i.accept = o.type;
          i.onchange = async () => {
            const f = i.files && i.files[0];
            if (!f) return resolve({ ok: false, reason: 'annule' });
            const j = (await this.tmpOuvrir()).jeton;
            const b = new Uint8Array(await f.arrayBuffer());
            tmp.set(j, [b]);
            resolve(ok({ jeton: j, taille: b.length }));
          };
          i.click();
        });
      }
    };
  }

  window.KladMaj.init({ log: (k, m) => { if (key && A()) A().log(k, m); }, toast });
  start();
})();
