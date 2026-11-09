// Klad — page de fond (2.3.0) : chargé en tête de index.html SEULEMENT par la synchro planifiée (Android, Klad fermé),
// jamais par l'appli. Remplace le pont Capacitor par le pont de fond (KladFondPont, app.klad.fond.Pont) :
//   - plateforme « android » et liste des plugins connus, chaque appel passant par KladFondPont.appel (le pont ne
//     répond vraiment qu'au coffre, au résumé Grafit, au widget et au réseau ; le reste : { ok: false, reason: 'fond' }) ;
//   - réseau : fetch vers l'API Enable Banking relayé par Android (KladFondPont.http, seule adresse permise) ;
//   - requestAnimationFrame par minuterie (page jamais affichée).
// verrou.js voit KLAD_FOND : ouverture par l'enveloppe « arrière-plan », synchro, enregistrement, widget, puis fin.
(function (g) {
  'use strict';

  const P = g.KladFondPont;
  if (!P) return;                           // page ordinaire : rien
  g.KLAD_FOND = true;
  g.androidBridge = { postMessage() { /* jamais utilisé : appels par nativePromise */ } };

  // Méthodes « promesse » de chaque plugin (test/fond.test.mjs vérifie qu'aucune méthode Java ne manque).
  const PLUGINS = {
    KladVault: ['status', 'create', 'unlockPin', 'changePin', 'wipe', 'activerFond', 'desactiverFond', 'session', 'attendreFond', 'unlockFond',
      'unlockBio', 'enableBio', 'disableBio', 'writeBlob', 'readBlob', 'deleteBlob', 'tmpOuvrir', 'tmpAjouter', 'tmpLire', 'tmpAbandon',
      'enregistrerFichier', 'resultatEnregistrement', 'oublierEnregistrement', 'choisirFichier'],
    KladGrafit: ['ecrire', 'effacer', 'lire', 'infos'],
    KladWidget: ['ecrire', 'effacer'],
    KladArret: ['action', 'lire', 'effacer'],
    KladReseau: ['adresse'],
    KladUpdate: ['info', 'openInstallSettings', 'download', 'install'],
    KladMail: ['tester', 'chercher'],
    KladAffichage: ['captures', 'diagnostic', 'appliquer'],
    App: ['getState', 'getLaunchUrl', 'getInfo', 'exitApp', 'minimizeApp', 'toggleBackButtonHandler', 'getAppLanguage', 'removeAllListeners'],
    Browser: ['open', 'close']
  };
  const C = g.Capacitor = g.Capacitor || {};
  C.PluginHeaders = Object.keys(PLUGINS).map(name => ({
    name,
    methods: PLUGINS[name].map(m => ({ name: m, rtype: 'promise' }))
      .concat([{ name: 'addListener', rtype: 'callback' }, { name: 'removeListener', rtype: 'promise' }])
  }));
  C.nativePromise = (plugin, methode, options) => new Promise((resolve, reject) => {
    let r;
    try { r = JSON.parse(P.appel(String(plugin), String(methode), JSON.stringify(options || {}))); }
    catch (e) { reject(e); return; }
    if (r && r.erreur) reject(new Error(r.erreur)); else resolve(r ? r.data : undefined);
  });
  let n = 0;
  C.nativeCallback = () => 'fond-' + (++n);           // écouteurs (état de l'appli, liens) : jamais appelés

  // Réseau : même origine par la page, le reste par Android (Enable Banking seulement).
  const fetch0 = g.fetch ? g.fetch.bind(g) : null;
  g.fetch = async function (input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || String(input);
    const abs = new URL(url, g.location.href);
    if (abs.origin === g.location.origin && fetch0) return fetch0(input, init);
    const o = init || {};
    const h = {};
    new Headers(o.headers || {}).forEach((v, k) => { h[k] = v; });
    const r = JSON.parse(P.http(String(o.method || 'GET'), abs.href, JSON.stringify(h), typeof o.body === 'string' ? o.body : ''));
    if (r.erreur) throw new TypeError(r.erreur);
    const vide = r.status === 204 || r.status === 205 || r.status === 304;
    return new Response(vide ? null : r.body, { status: r.status, headers: r.headers || {} });
  };

  g.requestAnimationFrame = cb => setTimeout(() => cb(Date.now()), 16);
  g.cancelAnimationFrame = id => clearTimeout(id);

  g.KladFond = { fin: r => P.fin(JSON.stringify(r || {})) };
})(window);
