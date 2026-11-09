// Klad — widget d'écran d'accueil (2.3.0) : données lues par le widget Android (plugin natif KladWidget).
// Le widget n'a ni logo ni légende (maquette validée le 09/11/2026) : reste à vivre de la base choisie (centimes, sans
// signe ; « epuise » s'il est dépassé), nombre « à vérifier » (pastille « Tout »), heure de la dernière synchro, banque à
// reconnecter. Mode démo : rien que « demo ». Écrit au déverrouillage, à chaque changement (regroupé) et à la fin d'une
// synchro planifiée ; seulement si les données ont changé. Lisible appli verrouillée (chiffré par une clé Keystore sans
// authentification, comme le résumé Grafit).
// Dans un navigateur ordinaire, un faux plugin garde les données en mémoire (données fictives).
(function (g) {
  'use strict';

  const V = 1;

  // ext : { demo } ou { rav: KladBudget.suivi(…).rav, av: nombre à vérifier }.
  function construire(S, now, ext) {
    if (ext && ext.demo) return { v: V, etat: 'demo' };
    const KB = g.KladBudget, M = g.KladModele;
    let rav = null, epuise = false;
    try {
      const x = ext && ext.rav && KB ? KB.ravChoisi(ext.rav, KB.baseRav(S)) : null;
      if (x && x.col && Number.isFinite(x.col.reste)) { rav = Math.round(Math.abs(x.col.reste)); epuise = x.col.reste < 0; }
    } catch (e) { rav = null; epuise = false; }
    const cx = S.modele.connexions || {};
    const eb = (S.modele.comptes || []).filter(c => c.source && c.source.type === 'eb' && !c.masque);
    const reconnecter = eb.some(c => c.aReassocier || !cx[c.source.connexion] || (M && M.etatAcces(cx[c.source.connexion], now) === 'expire'));
    const av = Math.max(0, Math.floor(Number(ext && ext.av) || 0));
    return { v: V, etat: 'ok', rav, epuise, av, sync: (S.modele.sync && S.modele.sync.derniere) || 0, reconnecter };
  }

  // Écritures une à une ; rien n'est écrit si les données n'ont pas changé. P : { ecrire({ json }) → { ok, reason } }.
  function creer(P) {
    let connu = null;
    let file = Promise.resolve();
    return {
      maj(S, now, ext) {
        if (!S) return Promise.resolve('rien');
        const json = JSON.stringify(construire(S, now, ext));      // calculé tout de suite (l'état peut se fermer)
        file = file.catch(() => {}).then(async () => {
          if (json === connu) return 'inchange';
          const r = await P.ecrire({ json });
          if (r && r.ok === false) throw new Error('données refusées (' + (r.reason || 'erreur') + ')');
          connu = json;
          return 'ecrit';
        });
        return file;
      },
      oublier() { connu = null; }
    };
  }

  g.KladWidgetDonnees = { V, construire, creer };

  // ------------------------------------------------------------ branchement dans l'appli
  const A = g.KladApp;
  if (!A || !g.document) return;
  const M = g.KladModele;
  const capX = g.capacitorExports;
  const plugin = name => (capX && capX.registerPlugin) ? capX.registerPlugin(name)
    : (g.Capacitor && g.Capacitor.Plugins && g.Capacitor.Plugins[name]) || null;
  const P = A.isNative ? plugin('KladWidget') : faux();
  const lien = creer(P);

  function maj() {
    const S = A.etat();
    if (!S) return Promise.resolve(null);
    const now = Date.now();
    let ext;
    if (g.KladAffichage && g.KladAffichage.demoActif()) ext = { demo: true };
    else {
      let rav = null, av = 0;
      try { rav = A.extras(now).rav; } catch (e) { rav = null; }
      try { av = A.aVerifier ? A.aVerifier() : 0; } catch (e) { av = 0; }
      ext = { rav, av };
    }
    return lien.maj(S, now, ext).catch(e => { if (A.etat()) A.log('err', 'Widget : ' + (e.message || e)); return null; });
  }

  M.surChangement(() => maj());
  A.ouvertures.push(() => maj());          // déverrouillage, retour au premier plan
  // mode démo : « ••• » pendant le mode, données réelles dès la sortie (y compris au verrouillage)
  const debut = A.demoDebut, finDemo = A.demoFin;
  A.demoDebut = function () { const r = debut.apply(this, arguments); setTimeout(maj, 0); return r; };
  A.demoFin = function () { const r = finDemo.apply(this, arguments); maj(); return r; };

  function faux() {
    let json = null;
    return { async ecrire(o) { json = o.json; return { ok: true }; }, async effacer() { json = null; return { ok: true }; }, contenu: () => json };
  }

  g.KladWidget = { maj, contenu: () => (P && P.contenu ? P.contenu() : undefined) };
})(typeof window !== 'undefined' ? window : globalThis);
