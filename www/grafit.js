// Klad — Lien Grafit (Plus › Modules) : réglage, et écriture du résumé lu par Grafit (plugin natif KladGrafit).
// Désactivé par défaut. Écrit sur KladModele.surChangement (regroupé sur 300 ms), au déverrouillage et à chaque retour
// au premier plan ; seulement si le résumé a changé (à « generated » près). Ne déclenche jamais de synchro.
// Dans un navigateur ordinaire, un faux plugin garde le résumé en mémoire (données fictives).
(function () {
  'use strict';

  const A = window.KladApp;
  const M = window.KladModele;
  const R = window.KladResume;
  const $ = id => document.getElementById(id);
  const esc = A.esc;

  const capX = window.capacitorExports;
  const plugin = name => (capX && capX.registerPlugin) ? capX.registerPlugin(name)
    : (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins[name]) || null;
  const P = A.isNative ? plugin('KladGrafit') : demo();
  const lien = R.creerLien(P);
  let infos = null;          // { package, empreinte } attendus (plugin natif)

  function maj() {
    const S = A.etat();
    if (!S) return Promise.resolve(null);
    const now = Date.now();
    return lien.maj(S, now, () => { if (!A.etat()) return null; const e = A.extras(now); return { attention: e.attention, sauvegarde: e.sauvegarde, maj: e.maj, budget: e.budget }; }).catch(e => { if (A.etat()) A.log('err', 'Lien Grafit : ' + (e.message || e)); return null; });
  }

  M.surChangement(() => maj());
  A.ouvertures.push(() => maj());          // déverrouillage, retour au premier plan

  // ------------------------------------------------------------ réglage
  const tronquee = e => e ? e.slice(0, 8) + '…' + e.slice(-8) : '';

  async function renderModules() {
    const S = A.etat();
    if (!S) return;
    if (!infos) { try { infos = await P.infos(); } catch (e) { infos = {}; } }
    const on = R.actif(S);
    $('grafitActif').checked = on;
    $('grafitEtat').textContent = on ? 'Activé : Grafit lit le résumé, même Klad verrouillé.' : 'Désactivé : Grafit ne reçoit rien.';
    $('grafitEmpreinte').innerHTML = infos.empreinte
      ? 'Seule l\'appli <b>' + esc(infos.package) + '</b> signée par le certificat d\'empreinte SHA-256 <code>' + esc(tronquee(infos.empreinte)) + '</code> peut le lire.'
      : 'Seule l\'appli Grafit signée par le certificat attendu peut le lire (empreinte affichée dans l\'appli Android).';
  }
  A.preparer.secModules = () => { renderModules(); };
  A.rendus.push(() => { const S = A.etat(); $('mModules').textContent = 'Lien Grafit ' + (R.actif(S) ? 'activé' : 'désactivé'); });

  $('grafitActif').addEventListener('change', ev => {
    const S = A.etat();
    if (!S) return;
    const on = ev.target.checked;
    S.modele.grafit = { actif: on };
    // tout de suite : écrit le résumé (activé) ou l'efface (désactivé)
    maj().then(r => {
      if (r === 'ecrit' || r === 'inchange') A.log('ok', 'Lien Grafit activé : résumé partagé.');
      else if (!on) A.log('info', 'Lien Grafit désactivé : résumé effacé.');
    });
    A.changed('reglage');
  });

  // ------------------------------------------------------------ faux plugin (navigateur seulement)
  function demo() {
    let json = null;
    return {
      async lire() { return { ok: true, json }; },
      async ecrire(o) { json = o.json; return { ok: true }; },
      async effacer() { const existait = json != null; json = null; return { ok: true, existait }; },
      async infos() { return { ok: true, package: 'fr.orbitalvkl.grafit', empreinte: null }; },
      contenu: () => json
    };
  }

  // Effacement du résumé : « Tout effacer », création d'un coffre (verrou.js).
  window.KladLienGrafit = {
    effacer: () => lien.effacer(),
    demo: () => (P && P.contenu ? P.contenu() : undefined)
  };
})();
