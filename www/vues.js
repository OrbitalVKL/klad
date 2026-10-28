// Klad — rendu de l'accueil, de la liste des opérations, du détail d'une opération et du volet « Classer »
// (chaînes HTML, sans accès au DOM : testées dans node).
// Aucun montant n'est affiché avec un signe : colonnes Débit / Crédit, « débiteur » pour un solde négatif,
// « à prélever » pour la dette d'une carte.
(function (g) {
  'use strict';

  const F = () => g.KladFormat;
  const M = () => g.KladModele;
  const K = () => g.KladClasse;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const ROLES = {
    courant: 'Compte courant', carte_differee: 'Carte à débit différé', paiement_en_ligne: 'Paiement en ligne',
    epargne: 'Épargne', commun: 'Compte commun'
  };
  const SOURCES = { correction: 'classée à la main', regle: 'par une de vos règles', base: 'par une règle de base', defaut: 'non classée',
    reglement: 'règlement détaillé ailleurs, compté une seule fois' };
  const pluriel = (n, s, p) => n + ' ' + (n > 1 ? (p || s + 's') : s);

  function solde(c, cur) {
    return '<span class="m' + (c < 0 ? ' debiteur' : '') + '">' + esc(F().solde(c, cur)) + '</span>';
  }
  const jjmm = iso => iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) : '';

  // ------------------------------------------------------------ « À vérifier »
  // ext : { attention: { unseen, unclassified, accountsToCheck }, sauvegarde: { jours | null } | null, maj: version | null }.
  // → [{ cle, texte, niveau }] ; chaque ligne mène à l'écran concerné (cle).
  function lignesAVerifier(S, now, ext) {
    const e = ext || {};
    const a = e.attention || {};
    const L = [];
    if (a.unseen) L.push({ cle: 'nonvues', texte: pluriel(a.unseen, 'opération') + ' à voir', niveau: 'info' });
    if (a.unclassified) L.push({ cle: 'nonclassees', texte: pluriel(a.unclassified, 'opération non classée', 'opérations non classées') + ' (3 derniers mois)', niveau: 'info' });
    if (a.toMatch) L.push({ cle: 'rapprocher', texte: pluriel(a.toMatch, 'prélèvement') + ' de portefeuille à rapprocher', niveau: 'info' });
    if (a.accountsToCheck) L.push({ cle: 'comptes', texte: pluriel(a.accountsToCheck, 'compte') + ' à vérifier ou à réassocier', niveau: 'caut' });
    for (const sid of Object.keys(S.modele.connexions)) {
      const cx = S.modele.connexions[sid];
      const etat = M().etatAcces(cx, now);
      if (!etat) continue;
      L.push({ cle: 'banques', texte: (etat === 'expire' ? 'Accès bancaire expiré' : 'Accès bancaire à renouveler avant le ' + F().date(cx.valid_until.slice(0, 10))) + ' : ' + cx.banque, niveau: 'caut' });
    }
    const err = S.modele.comptes.filter(c => c.source.type === 'eb' && c.sync && c.sync.erreur).length;
    if (err) L.push({ cle: 'sync', texte: 'Synchronisation en échec (' + pluriel(err, 'compte') + ')', niveau: 'caut' });
    const sv = e.sauvegarde;
    if (sv && (sv.jours == null || sv.jours >= 30)) L.push({ cle: 'sauvegarde', texte: sv.jours == null ? 'Aucune sauvegarde exportée' : 'Dernière sauvegarde il y a ' + sv.jours + ' jours', niveau: 'info' });
    if (e.maj) L.push({ cle: 'maj', texte: 'Mise à jour : Klad ' + e.maj + ' est disponible', niveau: 'info' });
    return L;
  }

  function aVerifier(S, now, ext) {
    const L = lignesAVerifier(S, now, ext);
    if (!L.length) return '';
    return '<div class="averif"><h3>À vérifier</h3>' + L.map(l => '<button class="av ' + l.niveau + '" data-av="' + esc(l.cle) + '"><span>' +
      esc(l.texte) + '</span><span class="chev" aria-hidden="true">›</span></button>').join('') + '</div>';
  }

  // ------------------------------------------------------------ accueil
  function carte(S, c, now) {
    const a = M().alerteCompte(S, c, now);
    const quand = c.source.type === 'eb'
      ? 'à jour ' + F().ilYa(c.sync && c.sync.lu, now)
      : c.solde ? 'saisi le ' + F().date(c.solde.date) : 'compte manuel';
    let corps;
    if (c.role === 'carte_differee') {
      const d = K().dette(S, c, now);
      corps = d ? '<small class="du">à prélever' + (d.le ? ' le ' + jjmm(d.le) : '') + '</small><span class="m">' + esc(F().montant(d.centimes, c.devise)) + '</span>'
        : '<small class="du">à prélever</small><span class="m muted">—</span><small class="bad">Libellé du prélèvement à choisir</small>';
    } else {
      const s = M().soldeAffiche(S, c);
      corps = s ? solde(s.centimes, c.devise) : '<span class="m muted">—</span>';
    }
    return '<button class="ccompte' + (a ? ' alerte' : '') + '" data-compte="' + esc(c.id) + '">' +
      '<b>' + esc(c.libelle) + '</b><small>' + esc(ROLES[c.role] || '') + '</small>' + corps +
      '<small>' + esc(quand) + '</small>' + (a ? '<em>' + esc(a) + '</em>' : '') + '</button>';
  }

  // Total des comptes courants, dette des cartes déduite.
  function total(S, now) {
    const t = M().totalCourants(S);
    const d = K().dettes(S, now);
    return { centimes: t.centimes - d.centimes, n: t.n, carte: d.centimes, cartes: d.connues };
  }

  function accueil(S, now, ext) {
    const comptes = M().comptesTries(S).filter(c => !c.masque);
    if (!comptes.length) {
      return '<div class="carte grande vide"><b>Bienvenue dans Klad</b><p>Connectez une banque ou importez la reprise de l\'ancienne version.</p>' +
        '<div class="row center"><button class="btn small" data-volet="secBanques">Banques et accès</button>' +
        '<button class="btn ghost small" data-volet="secReprise">Import de reprise</button></div></div>';
    }
    const t = total(S, now);
    const d = S.modele.sync.derniere;
    let h = aVerifier(S, now, ext);
    if (ext && ext.rav && g.KladVuesBudget) h += g.KladVuesBudget.carteRav(ext.rav);
    h += '<div class="carte grande"><small>Comptes courants' + (t.cartes ? ', carte déduite' : '') + '</small><div class="total">' +
      (t.n ? solde(t.centimes) : '<span class="m muted">—</span>') + '</div><small>' +
      pluriel(t.n, 'compte') + (t.cartes ? ' · à prélever ' + esc(F().montant(t.carte)) : '') + (d ? ' · synchronisé ' + esc(F().ilYa(d, now)) : '') + '</small></div>';
    h += '<div class="defile">' + comptes.map(c => carte(S, c, now)).join('') + '</div>';
    const cx = ext && ext.ctx;
    const recentes = filtrer(S, {}, cx).slice(0, 8);
    if (recentes.length) {
      h += '<h3 class="sous">Dernières opérations <button class="lien" data-onglet="vOps">Tout voir</button></h3>' +
        '<div class="ops">' + recentes.map(o => ligne(S, o, { date: true, compte: comptes.length > 1, ctx: cx })).join('') + '</div>';
    }
    return h;
  }

  // ------------------------------------------------------------ opérations
  // f : { compte, q, cat ('' | '__nc' | nom), nonVues }. Comptes masqués exclus, sauf s'ils sont choisis dans le filtre.
  // « Non classées » : celles des 3 derniers mois (comme « À vérifier »). Tri : date décroissante.
  function filtrer(S, f, ctx) {
    const ids = f.compte ? [f.compte] : M().comptesTries(S).filter(c => !c.masque).map(c => c.id);
    const k = f.q ? M().cleLibelle(f.q) : '';
    const limNc = f.cat === '__nc' && ctx ? M().plusJours(M().jourLocal(ctx.now), -K().NC_JOURS) : '';
    const rap = f.cat === '__rap' && ctx;
    const out = [];
    for (const id of ids) {
      for (const o of S.ops[id] || []) {
        if (limNc && o.date < limNc) continue;
        if (k && M().cleLibelle(o.libelle + ' ' + (o.contrepartie || '')).indexOf(k) < 0) continue;
        if (f.nonVues && K().vue(S, o)) continue;
        if (rap) { if (!K().aRapprocher(ctx, o)) continue; }
        else if (f.cat && ctx) {
          const r = K().classer(ctx, o);
          if (f.cat === '__nc' ? !r.nc : r.cat !== f.cat) continue;
        }
        out.push(o);
      }
    }
    return out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }

  function ligne(S, o, opt) {
    const c = M().compte(S, o.compte);
    const cur = (c && c.devise) || 'EUR';
    const ctx = opt && opt.ctx;
    const r = ctx ? K().classer(ctx, o) : null;
    const nonVue = !K().vue(S, o);
    const cat = r ? r.cat + (r.sub && r.sub !== r.cat && !r.nc ? ' · ' + r.sub : '') : '';
    const info = [cat, opt && opt.date ? F().date(o.date) : '', opt && opt.compte && c ? c.libelle : '', o.statut === 'en_cours' ? 'en cours' : '']
      .filter(Boolean).join(' · ');
    return '<div class="op' + (o.statut === 'en_cours' ? ' encours' : '') + (nonVue ? ' nonvue' : '') + (r && r.nc ? ' nc' : '') +
      '" data-op="' + esc(o.id) + '" data-c="' + esc(o.compte) + '">' +
      '<span class="ico" aria-hidden="true">' + (r ? esc(K().iconeDe(ctx.C, r.cat)) : '') + '</span>' +
      '<div class="lib">' + (nonVue ? '<i class="point" title="Non vue"></i><span class="sr">Non vue. </span>' : '') + esc(o.libelle) +
      (info ? '<small>' + esc(info) + '</small>' : '') + '</div>' +
      '<div class="deb">' + (o.montant < 0 ? esc(F().montant(o.montant, cur)) : '') + '</div>' +
      '<div class="cre">' + (o.montant >= 0 ? esc(F().montant(o.montant, cur)) : '') + '</div></div>';
  }

  function entete() {
    return '<div class="entete"><span></span><span>Libellé</span><span>Débit</span><span>Crédit</span></div>';
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
        ops.slice(i, j).map(o => ligne(S, o, { compte: opt && opt.compte, ctx: opt && opt.ctx })).join('') + '</section>';
      i = j; jours++;
    }
    return { html: h, fin: i };
  }

  // Filtres de la liste : non vues, non classées, catégorie ; « Tout marquer vu ».
  function filtres(S, f, ctx, nb) {
    const cats = K().listeCategories(ctx.C);
    return '<button class="puce' + (f.nonVues ? ' on' : '') + '" data-f="nonVues" aria-pressed="' + !!f.nonVues + '">Non vues <b>' + nb.unseen + '</b></button>' +
      '<button class="puce' + (f.cat === '__nc' ? ' on' : '') + '" data-f="nc" aria-pressed="' + (f.cat === '__nc') + '">Non classées <small>3 mois</small></button>' +
      (f.cat === '__rap' ? '<button class="puce on" data-f="rap" aria-pressed="true">À rapprocher</button>' : '') +
      '<select id="opsCat" aria-label="Catégorie" class="' + (f.cat && f.cat !== '__nc' ? 'on' : '') + '"><option value="">Catégorie</option>' +
      cats.map(c => '<option value="' + esc(c) + '"' + (c === f.cat ? ' selected' : '') + '>' + esc(K().iconeDe(ctx.C, c) + ' ' + c) + '</option>').join('') + '</select>' +
      (nb.visiblesNonVues ? '<button class="lien" data-f="toutVu">Tout marquer vu</button>' : '');
  }

  // ------------------------------------------------------------ détail d'une opération
  function detail(S, o, ctx) {
    const c = M().compte(S, o.compte);
    const cur = (c && c.devise) || 'EUR';
    const r = K().classer(ctx, o);
    const vu = K().vue(S, o);
    const dd = K().dateDepense(o);
    const w = K().aRapprocher(ctx, o);
    const lignes = [
      ['Date', F().jour(o.date) + (o.statut === 'en_cours' ? ' (en cours)' : '')],
      dd && dd !== o.date ? ['Payée le', F().jour(dd)] : null,
      o.dateValeur ? ['Date de valeur', F().date(o.dateValeur)] : null,
      ['Compte', c ? c.libelle : '—'],
      [o.montant < 0 ? 'Débit' : 'Crédit', F().montant(o.montant, cur)],
      o.contrepartie ? ['Contrepartie', o.contrepartie] : null
    ].filter(Boolean);
    return '<div class="dtete"><span class="ico grand" aria-hidden="true">' + esc(K().iconeDe(ctx.C, r.cat)) + '</span><b>' + esc(o.libelle) + '</b></div>' +
      '<dl class="details">' + lignes.map(x => '<dt>' + esc(x[0]) + '</dt><dd>' + esc(x[1]) + '</dd>').join('') +
      '<dt>Catégorie</dt><dd>' + esc(r.cat + (r.sub && r.sub !== r.cat ? ' › ' + r.sub : '')) + '<small>' + esc(SOURCES[r.src] || '') + '</small></dd>' +
      '<dt>Vue</dt><dd>' + (vu ? 'oui' : 'non') + '</dd></dl>' +
      (w ? '<p class="note">Prélèvement de ' + esc(w.libelle) + ' sans opération de même montant dans son détail : il est compté comme une dépense. ' +
        'S\'il est déjà détaillé dans ' + esc(w.libelle) + ', marquez-le interne.</p>' : '') +
      '<div class="row"><button class="btn" data-a="classer">Classer</button>' +
      '<button class="btn ghost" data-a="vue">' + (vu ? 'Marquer non vue' : 'Marquer vue') + '</button>' +
      (w ? '<button class="btn ghost" data-a="interne">Marquer interne</button>' : '') + '</div>' +
      '<p class="muted small">Sur la liste : glisser une opération vers la droite la marque vue (ou non vue), vers la gauche ouvre « Classer ».</p>';
  }

  // ------------------------------------------------------------ volet « Classer »
  // st : { cat, sub, autres (bool), mot, compte (bool), sens ('' | 'debit' | 'credit'), toutes (bool) } ; n : opérations concernées.
  function classer(S, o, ctx, st, n) {
    const c = M().compte(S, o.compte);
    const cur = (c && c.devise) || 'EUR';
    const top = K().frequentes(ctx, st.cat, 7);
    const liste = st.toutes ? [st.cat].concat(K().listeCategories(ctx.C).filter(x => x !== st.cat)) : (top.indexOf(st.cat) >= 0 ? top : [st.cat].concat(top.slice(0, 6)));
    const btn = x => '<button type="button" class="tuile" role="radio" aria-checked="' + (x === st.cat) + '" data-cat="' + esc(x) + '">' +
      '<span class="ico" aria-hidden="true">' + esc(K().iconeDe(ctx.C, x)) + '</span><span>' + esc(x) + '</span></button>';
    return '<div class="dtete"><span class="ico grand" aria-hidden="true">' + esc(K().iconeDe(ctx.C, st.cat)) + '</span><div><b>' + esc(o.libelle) + '</b>' +
      '<small>' + esc(F().date(o.date) + (c ? ' · ' + c.libelle : '') + ' · ' + (o.montant < 0 ? 'débit ' : 'crédit ') + F().montant(o.montant, cur)) + '</small></div></div>' +
      '<p class="muted" id="clsL">Catégorie</p><div class="grille" role="radiogroup" aria-labelledby="clsL">' + liste.map(btn).join('') +
      (st.toutes ? '' : '<button type="button" class="tuile plus" data-toutes="1"><span class="ico" aria-hidden="true">⋯</span><span>Toutes</span></button>') + '</div>' +
      '<label>Sous-catégorie<input id="clsSub" autocomplete="off" value="' + esc(st.sub) + '"></label>' +
      '<div class="regle"><label class="inline"><input type="checkbox" id="clsAutres"' + (st.autres ? ' checked' : '') + '> <b>Classer aussi les autres</b></label>' +
      '<label>Toutes les opérations dont le libellé contient<input id="clsMot" autocomplete="off" spellcheck="false" value="' + esc(st.mot) + '"' + (st.autres ? '' : ' disabled') + '></label>' +
      '<div class="grp"><label class="inline"><input type="checkbox" id="clsCompte"' + (st.compte ? ' checked' : '') + (st.autres ? '' : ' disabled') + '> Seulement ' + esc(c ? c.libelle : 'ce compte') + '</label>' +
      '<label>Sens<select id="clsSens"' + (st.autres ? '' : ' disabled') + '><option value="">Débits et crédits</option><option value="debit"' + (st.sens === 'debit' ? ' selected' : '') +
      '>Débits seulement</option><option value="credit"' + (st.sens === 'credit' ? ' selected' : '') + '>Crédits seulement</option></select></label></div>' +
      '<p class="muted" id="clsN">' + esc(st.autres ? (st.mot.trim() ? pluriel(n, 'opération') + ' ' + (n > 1 ? 'contiennent' : 'contient') + ' « ' + st.mot.trim() + ' »' : 'Saisissez un mot du libellé.') : 'Seule cette opération sera classée.') + '</p></div>' +
      '<div class="row"><button class="btn large" data-a="go">Classer en ' + esc(st.cat) + (st.autres && n > 1 ? ' (' + n + ')' : '') + '</button></div>';
  }

  g.KladVues = { ROLES, esc, solde, carte, total, accueil, lignesAVerifier, aVerifier, filtrer, ligne, entete, tranche, filtres, detail, classer };
})(typeof window !== 'undefined' ? window : globalThis);
