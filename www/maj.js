// Klad — mise à jour depuis l'appli : recherche d'une publication plus récente sur GitHub (Releases),
// puis téléchargement, vérification et installation par le plugin natif KladUpdate.
// Aucune donnée personnelle n'est envoyée : simple lecture anonyme de l'API publique des publications.
(function (g) {
  'use strict';

  // ------------------------------------------------------------ fonctions pures (testées dans node)

  // « v1.2.3 » ou « 1.2.3 » → [1, 2, 3] ; null sinon.
  function parseVersion(v) {
    const m = String(v == null ? '' : v).trim().match(/^v?(\d+)\.(\d+)\.(\d+)$/);
    return m ? [+m[1], +m[2], +m[3]] : null;
  }

  // < 0 si a est plus ancienne que b, 0 si égales, > 0 si plus récente. null si l'une est illisible.
  function cmpVersion(a, b) {
    const x = parseVersion(a), y = parseVersion(b);
    if (!x || !y) return null;
    for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
    return 0;
  }

  function apiUrl(owner, repo) {
    return 'https://api.github.com/repos/' + encodeURIComponent(owner) + '/' + encodeURIComponent(repo || 'klad') + '/releases/latest';
  }

  // Réponse de /releases/latest → { version, url, sha256, size, notes } si plus récente que current ; sinon null.
  // Lève une erreur claire si la publication est plus récente mais inutilisable.
  function pickRelease(rel, current) {
    if (!rel || rel.draft || rel.prerelease) return null;
    const c = cmpVersion(rel.tag_name, current);
    if (c == null || c <= 0) return null;
    const version = parseVersion(rel.tag_name).join('.');
    const apks = (rel.assets || []).filter(a => /\.apk$/i.test(a.name || '') && !/debug/i.test(a.name || ''));
    if (!apks.length) throw new Error('La version ' + version + ' n\'a pas d\'APK publié.');
    const a = apks[0];
    const m = String(a.digest || '').match(/^sha256:([0-9a-f]{64})$/i);
    if (!m) throw new Error('La version ' + version + ' n\'a pas d\'empreinte SHA-256 publiée : mise à jour refusée.');
    return { version, url: a.browser_download_url, sha256: 'sha256:' + m[1].toLowerCase(), size: a.size || 0, notes: rel.body || '' };
  }

  const pure = { parseVersion, cmpVersion, apiUrl, pickRelease };

  // ------------------------------------------------------------ interface (appli)
  // init({ log, toast }) est appelé par verrou.js ; check(silent) après chaque déverrouillage.
  let ctx = null;

  function init(opts) {
    const doc = g.document;
    const $ = id => doc.getElementById(id);
    const CFG = g.KLAD_CONFIG || {};
    const capX = g.capacitorExports;
    const isNative = !!(g.Capacitor && g.Capacitor.isNativePlatform && g.Capacitor.isNativePlatform());
    const U = isNative ? (capX && capX.registerPlugin ? capX.registerPlugin('KladUpdate') : g.Capacitor.Plugins.KladUpdate) : null;
    let found = null;      // publication plus récente trouvée
    let running = false;

    const say = (t, err) => { const el = $('majState'); el.textContent = t || ''; el.className = 'muted' + (err ? ' bad' : ''); };
    const showFound = () => {
      $('majBanner').hidden = !found;
      $('btnMajGo').hidden = !found;
      if (found) $('majBannerTxt').textContent = 'Klad ' + found.version + ' est disponible.';
    };
    const fmtSize = n => n ? ' (' + (n / 1048576).toFixed(1).replace('.', ',') + ' Mo)' : '';

    $('majVer').textContent = 'Version installée : ' + (CFG.version || 'dev') + (CFG.build ? ' (' + CFG.build + ')' : '');

    async function check(silent) {
      if (!CFG.owner || !parseVersion(CFG.version)) {
        if (!silent) say('Recherche impossible : version de développement.', true);
        return null;
      }
      if (!silent) say('Recherche…');
      try {
        const res = await fetch(apiUrl(CFG.owner, CFG.repo), { headers: { Accept: 'application/vnd.github+json' } });
        if (res.status === 404) { found = null; showFound(); if (!silent) say('Aucune publication trouvée.'); return null; }
        if (!res.ok) throw new Error('GitHub a répondu ' + res.status + '.');
        found = pickRelease(await res.json(), CFG.version);
        showFound();
        if (found) { say('Version ' + found.version + ' disponible' + fmtSize(found.size) + '.'); opts.log('info', 'Mise à jour ' + found.version + ' disponible.'); }
        else say('Klad est à jour.');
        return found;
      } catch (e) {
        if (!silent) say('Recherche impossible : ' + (e.message || e), true);
        return null;
      }
    }

    async function update() {
      if (!found || running) return;
      if (!U) { say('Mise à jour possible seulement dans l\'appli Android.', true); return; }
      running = true;
      $('btnMajGo').disabled = true; $('btnMajBanner').disabled = true;
      try {
        const info = await U.info();
        if (!info.canInstall) {
          say('Autorisez Klad à installer des applis (réglage Android qui s\'ouvre), puis revenez et appuyez de nouveau sur « Mettre à jour ».', true);
          await U.openInstallSettings();
          return;
        }
        say('Téléchargement…');
        const sub = await U.addListener('progress', p => {
          if (p.total > 0) say('Téléchargement… ' + Math.floor(p.received * 100 / p.total) + ' %');
        });
        let r;
        try { r = await U.download({ url: found.url, sha256: found.sha256 }); }
        finally { sub.remove(); }
        if (!r.ok) { say('Mise à jour refusée : ' + r.message, true); opts.log('err', 'Mise à jour refusée (' + r.reason + ').'); return; }
        say('Vérifiée (empreinte' + (r.signatureChecked ? ', signature' : '') + '). Confirmez l\'installation dans la fenêtre d\'Android.');
        opts.log('ok', 'Mise à jour ' + found.version + ' téléchargée et vérifiée, installation lancée.');
        const i = await U.install();
        if (!i.ok) {
          say(i.reason === 'autorisation' ? 'Autorisez Klad à installer des applis, puis réessayez.' : 'Installation impossible : ' + i.message, true);
          if (i.reason === 'autorisation') await U.openInstallSettings();
        }
      } catch (e) {
        say('Mise à jour impossible : ' + (e.message || e), true);
      } finally {
        running = false;
        $('btnMajGo').disabled = false; $('btnMajBanner').disabled = false;
      }
    }

    if (U) U.addListener('installStatus', s => {
      if (!s.ok) { say('Installation non terminée' + (s.message ? ' : ' + s.message : '.'), true); opts.log('err', 'Installation de la mise à jour non terminée.'); }
    });

    $('btnMajCheck').addEventListener('click', async ev => { ev.target.disabled = true; try { await check(false); } finally { ev.target.disabled = false; } });
    $('btnMajGo').addEventListener('click', update);
    $('btnMajBanner').addEventListener('click', update);

    ctx = { check };
    return ctx;
  }

  g.KladMaj = Object.assign({ init, check: silent => (ctx ? ctx.check(silent) : Promise.resolve(null)) }, pure);
})(typeof window !== 'undefined' ? window : globalThis);
