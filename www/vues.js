// Klad — rendu de l'accueil et de la liste des opérations (chaînes HTML, sans accès au DOM : testées dans node).
// Aucun montant n'est affiché avec un signe : colonnes Débit / Crédit, « débiteur » pour un solde négatif.
(function (g) {
  'use strict';

  const F = () => g.KladFormat;
  const M = () => g.KladModele;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const ROLES = {
    courant: 'Compte courant', carte_differee: 'Carte à débit différé', paiement_en_ligne: 'Paiement en ligne',
    epargne: 'Épargne', commun: 'Compte commun'
  };

  function solde(c, cur) {
    return '<span class="m' + (c < 0 ? ' debiteur' : '') + '">' + esc(F().solde(c, cur)) + '</span>';
  }

  // ------------------------------------------------------------ accueil
  function carte(S, c, now) {
    const s = M().soldeAffiche(S, c);
    const a = M().alerteCompte(S, c, now);
    const quand = c.source.type === 'eb'
      ? 'à jour ' + F().ilYa(c.sync && c.sync.lu, now)
      : c.solde ? 'saisi le ' + F().date(c.solde.date) : 'compte manuel';
    return '<button class="ccompte' + (a ? ' alerte' : '') + '" data-compte="' + esc(c.id) + '">' +
      '<b>' + esc(c.libelle) + '</b><small>' + esc(ROLES[c.role] || '') + '</small>' +
      (s ? solde(s.centimes, c.devise) : '<span class="m muted">—</span>') +
      '<small>' + esc(quand) + '</small>' + (a ? '<em>' + esc(a) + '</em>' : '') + '</button>';
  }

  function accueil(S, now) {
    const comptes = M().comptesTries(S).filter(c => !c.masque);
    if (!comptes.length) {
      return '<div class="carte grande vide"><b>Bienvenue dans Klad</b><p>Connectez une banque ou importez la reprise de l\'ancienne version.</p>' +
        '<div class="row center"><button class="btn small" data-volet="secBanques">Banques et accès</button>' +
        '<button class="btn ghost small" data-volet="secReprise">Import de reprise</button></div></div>';
    }
    const t = M().totalCourants(S);
    const d = S.modele.sync.derniere;
    let h = '<div class="carte grande"><small>Comptes courants</small><div class="total">' +
      (t.n ? solde(t.centimes) : '<span class="m muted">—</span>') + '</div><small>' +
      t.n + ' compte' + (t.n > 1 ? 's' : '') + (d ? ' · synchronisé ' + esc(F().ilYa(d, now)) : '') + '</small></div>';
    h += '<div class="defile">' + comptes.map(c => carte(S, c, now)).join('') + '</div>';
    const recentes = filtrer(S, {}).slice(0, 8);
    if (recentes.length) {
      h += '<h3 class="sous">Dernières opérations <button class="lien" data-onglet="vOps">Tout voir</button></h3>' +
        '<div class="ops">' + recentes.map(o => ligne(S, o, { date: true, compte: comptes.length > 1 })).join('') + '</div>';
    }
    return h;
  }

  // ------------------------------------------------------------ opérations
  // f : { compte, q }. Comptes masqués exclus, sauf s'ils sont choisis dans le filtre. Tri : date décroissante.
  function filtrer(S, f) {
    const ids = f.compte ? [f.compte] : M().comptesTries(S).filter(c => !c.masque).map(c => c.id);
    const k = f.q ? M().cleLibelle(f.q) : '';
    const out = [];
    for (const id of ids) {
      for (const o of S.ops[id] || []) {
        if (k && M().cleLibelle(o.libelle + ' ' + (o.contrepartie || '')).indexOf(k) < 0) continue;
        out.push(o);
      }
    }
    return out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }

  function ligne(S, o, opt) {
    const c = M().compte(S, o.compte);
    const cur = (c && c.devise) || 'EUR';
    const info = [opt && opt.date ? F().date(o.date) : '', opt && opt.compte && c ? c.libelle : '', o.statut === 'en_cours' ? 'en cours' : '']
      .filter(Boolean).join(' · ');
    return '<div class="op' + (o.statut === 'en_cours' ? ' encours' : '') + '"><div class="lib">' + esc(o.libelle) +
      (info ? '<small>' + esc(info) + '</small>' : '') + '</div>' +
      '<div class="deb">' + (o.montant < 0 ? esc(F().montant(o.montant, cur)) : '') + '</div>' +
      '<div class="cre">' + (o.montant >= 0 ? esc(F().montant(o.montant, cur)) : '') + '</div></div>';
  }

  function entete() {
    return '<div class="entete"><span>Libellé</span><span>Débit</span><span>Crédit</span></div>';
  }

  // Tranche de la liste : à partir de l'indice debut, au moins nbJours jours complets.
  // → { html, fin } ; un jour par section, son en-tête reste figé en haut pendant le défilement.
  function tranche(S, ops, debut, nbJours, opt) {
    let i = debut, jours = 0, h = '';
    const annee = opt && opt.annee;
    while (i < ops.length && jours < nbJours) {
      const d = ops[i].date;
      let j = i;
      while (j < ops.length && ops[j].date === d) j++;
      h += '<section class="jour"><h3>' + esc(F().jour(d, annee)) + '</h3>' +
        ops.slice(i, j).map(o => ligne(S, o, { compte: opt && opt.compte })).join('') + '</section>';
      i = j; jours++;
    }
    return { html: h, fin: i };
  }

  g.KladVues = { ROLES, esc, solde, carte, accueil, filtrer, ligne, entete, tranche };
})(typeof window !== 'undefined' ? window : globalThis);
