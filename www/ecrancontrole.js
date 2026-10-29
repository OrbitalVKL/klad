// Klad — Plus › Contrôle : export du relevé de contrôle (klad-controle v1) pour la comparaison automatique avec
// l'ancienne version. Fichier personnel en clair, enregistré par le sélecteur Android (Drive compris).
(function () {
  'use strict';

  const A = window.KladApp;
  const $ = id => document.getElementById(id);

  function render() {
    $('controleCorps').innerHTML =
      '<p>Le relevé de contrôle reprend les chiffres affichés par Klad (comptes, reste à vivre, budget, commun, équilibre, contrats, ' +
      'impôts, observations, « À vérifier », résumé Grafit) et la liste des opérations des derniers cycles, pour une comparaison ' +
      'automatique avec l\'ancienne version.</p>' +
      '<p class="note"><b>Fichier personnel en clair</b> (montants, libellés des opérations) : à supprimer après le contrôle. ' +
      'Il ne contient ni IBAN, ni clé, ni journal.</p>' +
      '<p class="muted small">Synchronisez d\'abord, pour comparer les chiffres du jour.</p>' +
      '<button type="button" class="sh-go" data-ctl="exporter">Exporter le relevé de contrôle</button>';
  }
  A.preparer.secControle = () => render();

  $('controleCorps').addEventListener('click', ev => {
    const b = ev.target.closest('[data-ctl="exporter"]');
    if (!b) return;
    if (!A.confirmInline(b, 'Confirmer : fichier en clair')) return;
    A.busy(b, async () => {
      const S = A.etat(), B = A.budget(), cx = A.ctx(), now = Date.now();
      if (!S || !B) throw new Error('Données pas encore prêtes.');
      const G = window.KladLienGrafit;
      const resume = G && G.lire ? await G.lire().catch(() => null) : null;
      const e = A.extras(now);
      const rel = window.KladControle.construire(S, B, cx, now, { version: (window.KLAD_CONFIG || {}).version || 'dev', resume, grafitActif: !!(G && G.actif && G.actif()),
        extResume: { attention: e.attention, sauvegarde: e.sauvegarde, maj: e.maj, budget: e.budget } });
      const ok = await A.hooks().exporterTexte(window.KladControle.nomFichier(now), JSON.stringify(rel, null, 1), 'application/json');
      if (!ok) return;
      A.log('ok', 'Relevé de contrôle exporté.');
      A.toast('Relevé de contrôle enregistré. Pensez à le supprimer après le contrôle.');
    });
  });
})();
