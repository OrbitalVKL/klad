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
  // Fichier choisi par le sélecteur Android → octets (relevé, éventuellement Excel), ou null si annulé.
  async function choisirOctets(type) {
    const r = await V.importFile(type ? { type } : {});
    if (!r.ok) { if (r.reason !== 'annule') throw new Error('Lecture impossible : ' + explain(r)); return null; }
    return C.fromB64(r.data);
  }
  // Fichier choisi par le sélecteur Android (reprise) → texte, ou null si annulé.
  async function choisirFichier() {
    const b = await choisirOctets();
    if (b == null) return null;
    try { return new TextDecoder('utf-8', { fatal: true }).decode(b); }
    catch (e) { return new TextDecoder('windows-1252').decode(b); }      // relevé CSV exporté en Windows-1252
  }
  const hooks = { save: () => mark(['*']), saveLog: () => mark(['journal']), flush, choisirFichier, choisirOctets };

  // ------------------------------------------------------------ affichage
  const vPanel = $('vPanel');
  const mPanel = $('mPanel');
  function toast(msg, err) { if (A()) A().toast(msg, err); }

  // Logo de Klad (même dessin que l'icône de l'appli).
  const LOGO = '<svg viewBox="18 18 72 72" aria-hidden="true"><defs><linearGradient id="kg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F3CB6B"/><stop offset="1" stop-color="#C98A1E"/></linearGradient></defs><rect x="18" y="18" width="72" height="72" fill="#1E3A5C"/><path fill="url(#kg)" d="M37 31h9.5v19.2h3.2L61.6 31h10.6L58.6 52.4 73.4 77H62.5L50.6 56.6h-4.1V77H37z"/></svg>';
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
  function phraseForm(root, text, onOk, onBack, backLabel) {
    const h = C.readBackupHeader(text);
    root.insertAdjacentHTML('beforeend',
      '<h2>Phrase de récupération</h2><p class="muted">Sauvegarde du ' + esc(fmtDate(h.date || '')) +
      '. Saisissez la phrase : 24 caractères, en 6 groupes de 4.</p>' +
      '<textarea class="phrase-in" rows="2" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"></textarea>' +
      '<p class="msg"></p><div class="row center"><button class="btn" data-a="go">Ouvrir la sauvegarde</button>' +
      '<button class="btn" data-a="back">' + esc(backLabel || 'Retour') + '</button></div>');
    const msg = root.querySelector('.msg');
    on(root, 'back', onBack);
    on(root, 'go', async ev => {
      ev.target.disabled = true;
      msg.className = 'msg muted'; msg.textContent = 'Déchiffrement…';
      try { onOk(await C.importBackup(text, root.querySelector('.phrase-in').value)); }
      catch (e) { msg.className = 'msg bad'; msg.textContent = e.message; ev.target.disabled = false; }
    });
  }

  async function pickBackup() {
    const r = await V.importFile();
    if (!r.ok) { if (r.reason !== 'annule') toast('Lecture impossible : ' + explain(r), true); return null; }
    const text = new TextDecoder().decode(C.fromB64(r.data));
    try { C.readBackupHeader(text); } catch (e) { toast(e.message, true); return null; }
    return text;
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
        B = restored.bk;
        await store.put('sauvegarde', B);
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
    const text = await pickBackup();
    if (!text) return;
    screen('');
    phraseForm(vPanel, text, res => choosePin('Nouveau code', pin => createVault(pin, res)), welcome);
  }

  async function restoreInApp() {
    const text = await pickBackup();
    if (!text) return;
    const res = await new Promise(resolve => {
      showModal('');
      phraseForm(mPanel, text, r => { closeModal(); resolve(r); }, () => { closeModal(); resolve(null); }, 'Annuler');
    });
    if (!res) return;
    if (!await askConfirm('Remplacer les données ?',
      'La clé Enable Banking, les banques et les opérations de ce téléphone seront remplacées par celles de la sauvegarde. ' +
      'Les prochaines sauvegardes utiliseront la phrase de ce fichier.', 'Remplacer')) return;
    await flush();
    const N = await C.depuisSauvegarde(res.payload);
    N.journal = S.journal;
    S = N;
    B = Object.assign({}, res.bk, { dernier: (B && B.dernier) || res.bk.dernier });
    A().close();
    A().open(S, hooks);
    mark(['*', 'sauvegarde']);
    await flush();
    A().log('ok', 'Sauvegarde restaurée.');
    renderSecu();
    toast('Sauvegarde restaurée.');
  }

  // ------------------------------------------------------------ section « Sécurité »
  async function exportNow() {
    await flush();
    const text = await C.exportBackup(B, C.contenuSauvegarde(S));
    const name = 'klad-sauvegarde-' + new Date().toISOString().slice(0, 10) + '.klad';
    const r = await V.exportFile({ name, data: C.toB64(new TextEncoder().encode(text)) });
    if (r.ok) {
      B.dernier = new Date().toISOString();
      mark(['sauvegarde']);
      A().log('ok', 'Sauvegarde exportée.');
      toast('Sauvegarde exportée.');
      renderSecu();
    } else if (r.reason !== 'annule') toast('Export impossible : ' + explain(r), true);
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
    const d = B && B.dernier;
    const days = d ? Math.floor((Date.now() - Date.parse(d)) / 864e5) : null;
    $('sauvState').textContent = d ? 'Dernier export le ' + fmtDate(d) + '.' : 'Aucune sauvegarde exportée pour l\'instant.';
    ($('mSauv') || {}).textContent = d ? 'Dernier export le ' + fmtDate(d) : 'Aucune sauvegarde exportée';
    // « À vérifier » (accueil) et résumé Grafit : jours depuis le dernier export (null : jamais).
    A().infoSauvegarde({ jours: days, rappel: days == null || days >= RAPPEL_JOURS });
  }

  function guard(fn) {
    return async ev => {
      const b = ev && ev.currentTarget;
      if (b) b.disabled = true;
      try { await fn(); } catch (e) { toast(e.message || String(e), true); }
      finally { if (b) b.disabled = false; if (key) renderSecu(); }
    };
  }
  document.addEventListener('click', ev => { if (ev.target.closest('#btnLock')) lock(); });
  $('btnBio').addEventListener('click', guard(toggleBio));
  $('btnPin').addEventListener('click', guard(changePin));
  $('btnExport').addEventListener('click', guard(exportNow));
  $('btnRestore').addEventListener('click', guard(restoreInApp));
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
  function demoVault() {
    const K = 'klad.demo';
    const load = () => { try { return JSON.parse(sessionStorage.getItem(K)) || { blobs: {} }; } catch (e) { return { blobs: {} }; } };
    const save = d => sessionStorage.setItem(K, JSON.stringify(d));
    const b64 = a => btoa(String.fromCharCode.apply(null, a));
    const ok = o => Object.assign({ ok: true }, o || {});
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
      async wipe({ pin }) { const d = load(); const f = check(d, pin); if (f) return f; sessionStorage.removeItem(K); return ok(); },
      async unlockBio() { return { ok: false, reason: 'absente' }; },
      async enableBio() { return { ok: false, reason: 'erreur', message: 'Pas d\'empreinte dans le navigateur.' }; },
      async disableBio() { return ok(); },
      async writeBlob({ name, data }) { const d = load(); d.blobs[name] = data; save(d); return ok(); },
      async readBlob({ name }) { return ok({ data: load().blobs[name] || null }); },
      async deleteBlob({ name }) { const d = load(); delete d.blobs[name]; save(d); return ok(); },
      async exportFile({ name, data }) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([C.fromB64(data)], { type: 'application/octet-stream' }));
        a.download = name; document.body.appendChild(a); a.click(); a.remove();
        return ok();
      },
      importFile(o) {
        return new Promise(resolve => {
          const i = document.createElement('input');
          i.type = 'file';
          if (o && o.type) i.accept = o.type;
          i.onchange = async () => {
            const f = i.files && i.files[0];
            resolve(f ? ok({ data: C.toB64(new Uint8Array(await f.arrayBuffer())) }) : { ok: false, reason: 'annule' });
          };
          i.click();
        });
      }
    };
  }

  window.KladMaj.init({ log: (k, m) => { if (key && A()) A().log(k, m); }, toast });
  start();
})();
