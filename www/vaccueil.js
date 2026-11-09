// Klad — rendu de l'onglet Accueil (série UX, 0.10.1) : l'essentiel du jour, sans geste. Dans l'ordre : reste à vivre,
// « À vérifier », soldes, ce cycle-ci, commun, prochaines échéances, actions rapides. Aucun calcul propre : chaque
// chiffre vient des fonctions déjà utilisées par les écrans d'origine (KladBudget.suivi, KladCommun.finDeMois et plan,
// KladBudget.echeances, KladClasse.dette, KladFisc.livretCarte). Chaînes HTML, sans accès au DOM : testées dans node.
// Aucun montant n'est affiché avec un signe moins : « dépassé de », « débiteur », « à prélever ».
(function (g) {
  'use strict';

  const F = () => g.KladFormat;
  const M = () => g.KladModele;
  const K = () => g.KladClasse;
  const KB = () => g.KladBudget;
  const U = () => g.KladUI;
  const Vu = () => g.KladVues;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pluriel = (n, s, p) => n + ' ' + (n > 1 ? (p || s + 's') : s);
  const DEMI = 50;
  const hhmm = iso => { if (!iso) return ''; const d = new Date(iso); return isNaN(d) ? '' : String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };

  // Ligne cliquable (56 dp) : gauche (pastille, compteur), titre, sous-titre, valeur à droite.
  // etat (2.2) : le sous-texte est un état (« solde à saisir »…) et reste visible ; sinon c'est une info (ⓘ du titre)
  function li(gauche, titre, sous, attr, droite, nom, etat) {
    return '<button type="button" class="ac-li" ' + (attr || '') + (nom ? ' aria-label="' + esc(nom) + '"' : '') + '>' + gauche + '<span class="tx"><b>' + esc(titre) + '</b>' +
      (sous ? '<small' + (etat ? '' : ' class="inf"') + '>' + esc(sous) + '</small>' : '') + '</span>' + (droite ? '<span class="v">' + droite + '</span>' : '') + '<span class="chev" aria-hidden="true">›</span></button>';
  }
  // 2.2 : les sous-textes des lignes (dates, détails) sont des infos, montrées par le ⓘ du titre de la carte
  const carte = (id, titre, droite, corps, attr) => { const i = /class="inf[ "]/.test(corps); return '<section class="ac-card' + (i ? ' inf-l' : '') + '" aria-labelledby="' + id + '"' + (attr || '') + '><h2 id="' + id + '">' + esc(titre) +
    (i ? U().ib(titre) : '') + (droite ? '<span class="r">' + esc(droite) + '</span>' : '') + '</h2>' + corps + '</section>'; };

  // ------------------------------------------------------------ 1. reste à vivre
  // res : KladBudget.suivi(B, 'perso', null) ; base : « salaire » ou « comptes » (KladBudget.baseRav, 0.10.7). Grand
  // chiffre : la colonne choisie ; dessous, l'autre. Interrupteur à deux positions sous la carte (hors du bouton).
  function reste(res, base) {
    const rav = res && res.rav;
    if (!rav) return '<section class="ac-hero" data-mesure="rav" aria-label="Reste à vivre"><span class="lbl">Reste à vivre</span><span class="v">—</span>' +
      '<span class="s">Il se calcule sur le cycle de salaire en cours, dès que le budget est repris ou réglé.</span></section>';
    // 1.1 : texte réduit à l'essentiel (grand chiffre, échéance, barre du cycle) ; le détail et l'autre base sont à un
    // appui. 1.2.0 : plus de montant « par jour » ; la barre du cycle dit « jour N/T » (un trait par jour, un trait
    // marqué au début de chaque semaine, repère sur aujourd'hui).
    const x = KB().ravChoisi(rav, base), b = x.col;
    const surQuoi = x.choix === 'comptes' ? 'sur les comptes courants' : 'sur le dernier salaire';
    const grand = b.reste >= 0 ? F().montant(b.reste) : F().montant(-b.reste);
    const T = res.nbJours, N = Math.min(T, Math.max(1, res.jour));
    return '<div class="ac-hero-w" data-mesure="rav"><button type="button" class="ac-hero" data-aller="rav" aria-label="' + esc('Reste à vivre jusqu\'au ' + U().jjmm(rav.fin) + ' : ' + grand +
      (b.reste < 0 ? ' en dépassement' : '') + ' ' + surQuoi + ', jour ' + N + ' sur ' + T + ' du cycle. Détail du calcul') + '">' +
      '<span class="lbl">Reste à vivre</span>' +
      '<span class="v num">' + esc(grand) + (b.reste < 0 ? '<small> dépassé</small>' : '') + '</span>' +
      '<span class="s">jusqu\'au ' + esc(U().jjmm(rav.fin)) + ' · <span class="num">jour ' + N + '/' + T + '</span></span>' +
      barreCycle(debutPeriode(res), N, T) + '</button>' +
      U().interrupteurRav(x.choix, !!rav.comptes) + '</div>';
  }
  const debutPeriode = res => res.per ? (res.per.cyc ? res.per.cyc.start : res.per.pm0 + '-01') : null;
  // Barre du cycle (1.2.0) : T jours ; écoulé jusqu'à la fin du jour N ; un trait entre deux jours, plus haut et plus
  // épais avant chaque lundi (début de semaine) ; repère sur le milieu du jour N. Dessin seul (aria-hidden), le texte
  // « jour N/T » est à côté. debut : AAAA-MM-JJ du premier jour (null : pas de semaine marquée).
  function barreCycle(debut, N, T) {
    const pct = v => (Math.round(v * 1e4) / 100) + '%';
    let traits = '';
    for (let i = 1; i < T; i++) {
      const lundi = !!debut && new Date(M().plusJours(debut, i) + 'T12:00:00Z').getUTCDay() === 1;
      traits += '<line class="' + (lundi ? 'sem' : 'jr') + '" x1="' + pct(i / T) + '" x2="' + pct(i / T) + '" y1="' + (lundi ? 16 : 18) + '" y2="' + (lundi ? 26 : 22) + '"/>';
    }
    const ici = pct((N - 0.5) / T);
    return '<svg class="cyc-bar" width="100%" height="26" aria-hidden="true" focusable="false">' +
      '<rect class="fond" x="0" y="7" width="100%" height="6" rx="3"/><rect class="fait" x="0" y="7" width="' + pct(N / T) + '" height="6" rx="3"/>' + traits +
      '<line class="ici" x1="' + ici + '" x2="' + ici + '" y1="1" y2="19"/><circle class="ici" cx="' + ici + '" cy="10" r="5"/></svg>';
  }

  // ------------------------------------------------------------ 2. « À vérifier » (un seul bloc, masqué s'il n'y a rien)
  // lignes : KladVues.lignesAVerifier(...) (+ bilan du cycle précédent) ; compteur à gauche quand la ligne en a un.
  function aVerifier(lignes) {
    if (!lignes.length) return '';
    const corps = lignes.map(l => {
      const n = /^(\d+) /.exec(l.texte);
      const g0 = n ? '<span class="cnt' + (l.niveau === 'caut' ? ' warn' : '') + '" aria-hidden="true">' + n[1] + '</span>' : '<span class="dot ' + (l.niveau === 'caut' ? 'warn' : '') + '" aria-hidden="true"></span>';
      return li(g0, n ? l.texte.slice(n[0].length) : l.texte, l.sous || '', 'data-av="' + esc(l.cle) + '"', '', l.texte);
    }).join('');
    return carte('ac-av', 'À vérifier', pluriel(lignes.length, 'point'), corps);
  }

  // ------------------------------------------------------------ 3. soldes (liste verticale)
  // o : { dettes: { id: dette }, livrets: { id: { centimes, texte } } }.
  function soldes(S, now, o) {
    const L = Vu().comptesDe(S, 'perso');
    if (!L.length) return carte('ac-so', 'Soldes', '', '<p class="note">Connectez une banque (Plus › Banques et accès) ou importez la reprise de l\'ancienne version.</p>', ' data-mesure="soldes"');
    let total = 0, n = 0, cartes = 0, lu = '', ep = 0, nep = 0;
    const lignes = L.map(c => {
      const eb = c.source.type === 'eb', t = eb && c.sync && c.sync.lu;
      if (t && t > lu) lu = t;
      if (c.role === 'carte_differee') {
        const d = (o.dettes || {})[c.id];
        if (d) cartes += d.centimes;
        const sous = d ? 'à prélever' + (c.prelevement && c.prelevement.jour ? ' le ' + c.prelevement.jour : '') + (d.depuis ? ' · depuis le ' + U().jjmm(d.depuis) : '') : 'libellé du prélèvement à choisir';
        return li(U().bico(S, c), c.libelle, sous, 'data-compte="' + esc(c.id) + '"', d ? '<span class="num">' + esc(F().montant(d.centimes)) + '</span>' : '—',
          c.libelle + ', carte à débit différé, ' + (d ? F().montant(d.centimes) + ' ' + sous : sous), !d);
      }
      const lv = (o.livrets || {})[c.id];
      const s0 = M().soldeAffiche(S, c);
      const s = lv ? { centimes: lv.centimes, dateRef: s0 && s0.dateRef } : s0;
      if (!s) return li(U().bico(S, c), c.libelle, c.source.type === 'manuel' ? 'solde à saisir' : 'solde pas encore lu', 'data-compte="' + esc(c.id) + '"', '—', '', true);
      if (c.role === 'courant' || c.role === 'commun') { total += s.centimes; n++; }
      else if (c.role === 'epargne') { ep += s.centimes; nep++; }
      const ancien = eb && (!t || now - Date.parse(t) > 30 * 3600e3);
      const sous = lv ? 'estimé · intérêts ' + lv.texte : (c.source.type === 'manuel' ? 'saisi le ' + U().jjmm(s.dateRef || s.lu) : (t ? 'relevé de ' + hhmm(t) + (ancien ? ' · ancien' : '') : 'au ' + U().jjmm(s.dateRef)));
      const v = s.centimes;
      return li(U().bico(S, c), c.libelle, sous, 'data-compte="' + esc(c.id) + '"',
        '<span class="num' + (v < 0 ? ' bad-t' : '') + '">' + esc(F().montant(Math.abs(v))) + '</span>' + (v < 0 ? '<small class="bad-t">débiteur</small>' : ''),
        c.libelle + ', ' + F().montant(Math.abs(v)) + (v < 0 ? ' débiteur' : '') + ', ' + sous, ancien);      // relevé ancien : reste visible
    }).join('');
    // 1.2.0 : un seul total, « Total perso » (KladModele.totalPerso, même valeur que le total du résumé Grafit) : comptes
    // courants, paiement en ligne et épargne, moins la dette des cartes à débit différé ; sans le compte commun (il a son
    // propre solde dans la liste et dans l'onglet Commun). Remplace « Total disponible (courants et commun) » et « Tous
    // les comptes ».
    const tp = M().totalPerso(S, o.dettes || {}, o.livrets || {});
    const tot = tp.n ? '<p class="ac-tot">Total perso : <b class="num' + (tp.centimes < 0 ? ' bad-t' : '') + '">' + esc(F().solde(tp.centimes)) + '</b>' +
      '<small class="ac-tot-s inf">' + esc((nep ? 'comptes courants, paiement en ligne et épargne' : 'comptes courants et paiement en ligne') + (cartes ? ', cartes déduites' : '') + ' ; sans le commun') + '</small>' +
      (tp.manque.length ? '<small class="ac-tot-s bad-t">incomplet : ' + esc(tp.manque.join(', ')) + '</small>' : '') + '</p>' : '';
    // 2.2 : l'heure du relevé bancaire en info (ⓘ du titre)
    return carte('ac-so', 'Soldes', '', (lu ? '<p class="ac-lu inf">relevés de ' + esc(hhmm(lu)) + '</p>' : '') + lignes + tot, ' data-mesure="soldes"');
  }

  // ------------------------------------------------------------ 4. ce cycle-ci (4 postes : dépassés et à surveiller d'abord)
  // 1.3.6 : plus de « N jours restants » (déjà dans la carte du reste à vivre) ; « Bilan du cycle précédent » en lien ici
  // (et non plus dans « À vérifier ») les 5 premiers jours d'un cycle.
  function cycle(B, res) {
    if (!res) return '';
    const lignes = [];
    for (const nk of ['courante', 'optionnelle']) for (const a of (res.sections[nk] || { lignes: [] }).lignes) if (a.on && a.pm > DEMI) lignes.push(a);
    if (!lignes.length) return '';
    const rang = a => a.cls === 'over' ? 0 : a.cls === 'warn' ? 1 : 2;
    lignes.sort((x, y) => (rang(x) - rang(y)) || (y.cur / y.pm - x.cur / x.pm));
    const C = B && B.cx ? B.cx.C : null;
    const corps = lignes.slice(0, 4).map(a => {
      const r = a.cur / a.pm, cls = a.cls === 'over' ? 'bad' : a.cls === 'warn' ? 'warn' : '';
      const etat = a.cls === 'over' ? 'dépassé de ' + KB().eur(a.cur - a.pm) : 'reste ' + KB().eur(Math.max(0, a.pm - a.cur)) + (cls ? ' · à surveiller' : '');
      return '<button type="button" class="ac-poste" data-aller="budget" aria-label="' + esc(a.label + ' : ' + KB().eur(a.cur) + ' sur ' + KB().eur(a.pm) + ', ' + etat) + '">' +
        '<span class="l1">' + U().icoPoste(C, a) + '<b>' + esc(a.label) + '</b><span class="num">' + esc(KB().eur(a.cur)) + ' <span class="muted">/ ' + esc(KB().eur(a.pm)) + '</span></span></span>' +
        '<span class="bar" aria-hidden="true"><i class="' + cls + '" style="width:' + Math.min(100, Math.round(r * 100)) + '%"></i></span>' +
        '<span class="l3 ' + cls + '">' + esc(etat) + '</span></button>';
    }).join('');
    const bl = bilan(res);
    return carte('ac-cy', 'Ce cycle-ci', 'dépenses courantes et optionnelles', corps +
      (bl ? '<button type="button" class="ac-lien" data-av="bilan">' + esc(bl.texte) + ' ›</button>' : '') +
      '<button type="button" class="ac-lien" data-aller="budget">Tout le budget ›</button>');
  }

  // ------------------------------------------------------------ 5. commun en un coup d'œil
  // fdm : KladCommun.finDeMois(B) ; pl : KladCommun.plan(B) ; R : KladCommun.reglages(B) (noms des personnes).
  function commun(fdm, pl, R, auj) {
    if (!fdm) return '';
    const nom = q => (q === 'moi' ? R.moi : R.autre) || (q === 'moi' ? 'Moi' : 'L\'autre personne');
    const mini = (t, v, rouge) => '<div class="mini"><span class="lbl">' + esc(t) + '</span><span class="v num' + (rouge ? ' bad-t' : '') + '">' + esc(v) + '</span></div>';
    let corps = '<div class="ac-split">' + mini('Solde', F().solde(fdm.solde), fdm.solde < 0) +
      mini('Fin de mois estimée', F().solde(fdm.end), fdm.end < 0 || fdm.decouvert) + '</div>';
    for (const x of (pl && pl.recus) || []) {
      const ok = !!x.vu;
      const sous = ok ? 'reçu le ' + U().jjmm(x.vu.date) : x.route ? 'en route · parti le ' + U().jjmm(x.route.depart.date) : (x.retard ? 'en retard' : 'attendu vers le ' + (x.v.jour || 1));
      corps += li('<span class="dot ' + (ok ? 'good' : x.retard ? 'warn' : '') + '" aria-hidden="true"></span>', 'Virement de ' + nom(x.v.qui), sous, 'data-aller="commun"',
        '<span class="num' + (ok ? ' pos-t' : '') + '">' + esc((ok ? '+' : '') + F().montant(ok ? x.vu.m : x.v.montant)) + '</span>');
    }
    // 1.3.6 : une ligne par personne (total de ses ordres à modifier), et non plus une par ordre
    const parQui = {};
    for (const x of (pl && pl.changes) || []) { const q = parQui[x.qui] || (parQui[x.qui] = { n: 0, have: 0, want: 0 }); q.n++; q.have += +x.have || 0; q.want += +x.want || 0; }
    for (const q of Object.keys(parQui)) {
      const x = parQui[q];
      corps += li('<span class="dot warn" aria-hidden="true"></span>', 'À mettre en place', nom(q) + ' : ' + (x.n > 1 ? x.n + ' virements à modifier, ' : '') + 'passer de ' + KB().eur(x.have) + ' à ' + KB().eur(x.want) + ' par mois' + (x.n > 1 ? ' au total' : ''), 'data-aller="commun"');
    }
    return carte('ac-cm', 'Commun', 'mois ' + (/^[aeiou]/.test(U().MOIS_L[+auj.slice(5, 7) - 1]) ? 'd\'' : 'de ') + U().MOIS_L[+auj.slice(5, 7) - 1], corps +
      '<button type="button" class="ac-lien" data-aller="commun">Tout le commun ›</button>');
  }

  // ------------------------------------------------------------ 6. prochaines échéances (31 jours)
  function echeances(L) {
    if (!L || !L.length) return carte('ac-ec', 'Prochaines échéances', '31 jours', '<p class="note">Aucune échéance connue dans les 31 prochains jours.</p>');
    const corps = L.slice().sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0).slice(0, 4).map(e =>
      li('<span class="ac-date num" aria-hidden="true">' + esc(U().jjmm(e.date)) + '</span>', e.label, e.scope === 'commun' ? 'commun' : 'perso', 'data-aller="contrats-' + (e.scope === 'commun' ? 'commun' : 'perso') + '"',
        '<span class="num">' + esc(F().montant(e.montant)) + '</span>', e.label + ', ' + U().dLong(e.date) + ', ' + (e.scope === 'commun' ? 'commun' : 'perso') + ', débit ' + F().montant(e.montant))).join('');
    return carte('ac-ec', 'Prochaines échéances', '31 jours', corps + (L.length > 4 ? '<button type="button" class="ac-lien" data-aller="contrats-perso">Toutes les échéances (' + L.length + ') ›</button>' : ''));
  }

  // ------------------------------------------------------------ 7. actions rapides
  function actions() {
    const b = (act, ic, t) => '<button type="button" class="ac-act" data-act="' + act + '"><span aria-hidden="true">' + ic + '</span>' + t + '</button>';
    // 1.3.6 : « Verrouiller » seul ; « Synchroniser » est dans l'en-tête de chaque écran, « Trier » est la ligne « à vérifier »,
    // « Sauvegarder » la ligne de la sauvegarde (quand elle est due) et Plus › Sauvegarde
    return '<section class="ac-quick ac-seul" aria-label="Actions rapides">' + b('verrou', '🔒', 'Verrouiller') + '</section>';
  }

  // Ligne « Bilan du cycle précédent » : les 5 premiers jours d'un cycle de salaire.
  function bilan(res) {
    if (!res || !res.per || !res.per.cyc || res.per.past || res.jour > 5 || !res.per.prev) return null;
    return { cle: 'bilan', texte: 'Bilan du cycle précédent', sous: 'nouveau cycle depuis le ' + U().jjmm(res.per.cyc.start), niveau: 'info' };
  }

  // Écran complet. d : { S, B, now, ext (KladApp.extras), res, dettes, livrets, fdm, plan, R, ech }.
  function ecran(d) {
    const L = Vu().lignesAVerifier(d.S, d.now, d.ext);
    return reste(d.res, KB().baseRav(d.S)) + aVerifier(L) + soldes(d.S, d.now, { dettes: d.dettes, livrets: d.livrets }) + cycle(d.B, d.res) +
      commun(d.fdm, d.plan, d.R || {}, M().jourLocal(d.now)) + echeances(d.ech) + actions();
  }
  // Sur-titre de l'en-tête : « Cycle du 27/10 au 26/11 · jour 4 sur 31 ».
  function surTitre(res) {
    if (!res || !res.per) return '';
    const p = res.per;
    return p.cyc ? 'Cycle du ' + U().jjmm(p.cyc.start) + ' au ' + U().jjmm(p.cyc.end) : U().mLong(p.pm0);      // 1.3.6 : sans « jour N sur T »
  }

  g.KladVuesAccueil = { ecran, reste, barreCycle, aVerifier, soldes, cycle, commun, echeances, actions, bilan, surTitre };
})(typeof window !== 'undefined' ? window : globalThis);
