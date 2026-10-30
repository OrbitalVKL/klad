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
  function li(gauche, titre, sous, attr, droite, nom) {
    return '<button type="button" class="ac-li" ' + (attr || '') + (nom ? ' aria-label="' + esc(nom) + '"' : '') + '>' + gauche + '<span class="tx"><b>' + esc(titre) + '</b>' +
      (sous ? '<small>' + esc(sous) + '</small>' : '') + '</span>' + (droite ? '<span class="v">' + droite + '</span>' : '') + '<span class="chev" aria-hidden="true">›</span></button>';
  }
  const carte = (id, titre, droite, corps, attr) => '<section class="ac-card" aria-labelledby="' + id + '"' + (attr || '') + '><h2 id="' + id + '">' + esc(titre) +
    (droite ? '<span class="r">' + esc(droite) + '</span>' : '') + '</h2>' + corps + '</section>';

  // ------------------------------------------------------------ 1. reste à vivre
  // res : KladBudget.suivi(B, 'perso', null). Grand chiffre : colonne « dernier salaire » ; dessous, « comptes courants ».
  function reste(res) {
    const rav = res && res.rav;
    if (!rav) return '<section class="ac-hero" data-mesure="rav" aria-label="Reste à vivre"><span class="lbl">Reste à vivre</span><span class="v">—</span>' +
      '<span class="s">Il se calcule sur le cycle de salaire en cours, dès que le budget est repris ou réglé.</span></section>';
    const b = rav.budget, c = rav.comptes;
    const restants = Math.max(1, res.nbJours - res.jour + 1);
    const ecoule = Math.round(Math.min(1, res.jour / res.nbJours) * 100);
    const utilise = res.total && res.total.P > DEMI ? Math.round(res.total.C / res.total.P * 100) : null;
    const grand = b.reste >= 0 ? F().montant(b.reste) : F().montant(-b.reste);
    const parJour = b.reste > 0 ? 'soit ' + KB().eur(Math.floor(b.reste / restants)) + ' par jour pendant ' + pluriel(restants, 'jour') : 'budget du cycle dépassé';
    const comptes = c ? 'sur les comptes courants : ' + (c.reste >= 0 ? F().montant(c.reste) : F().montant(-c.reste) + ' en dépassement') : '';
    return '<button type="button" class="ac-hero" data-mesure="rav" data-aller="rav" aria-label="' + esc('Reste à vivre jusqu\'au ' + U().jjmm(rav.fin) + ' : ' + grand +
      (b.reste < 0 ? ' en dépassement' : '') + ' sur le dernier salaire' + (comptes ? ', ' + comptes : '') + '. Détail du calcul') + '">' +
      '<span class="lbl">Reste à vivre jusqu\'au ' + esc(U().jjmm(rav.fin)) + '</span>' +
      '<span class="v num">' + esc(grand) + (b.reste < 0 ? '<small> dépassé</small>' : '') + '</span>' +
      '<span class="s">' + esc(parJour) + (comptes ? ' · ' + esc(comptes) : '') + '</span>' +
      '<span class="prog" aria-hidden="true"><i style="width:' + ecoule + '%"></i></span>' +
      '<span class="row2"><span>cycle écoulé ' + ecoule + ' %</span>' + (utilise != null ? '<span>budget utilisé ' + utilise + ' %</span>' : '') + '</span></button>';
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
    let total = 0, n = 0, cartes = 0, lu = '';
    const lignes = L.map(c => {
      const eb = c.source.type === 'eb', t = eb && c.sync && c.sync.lu;
      if (t && t > lu) lu = t;
      if (c.role === 'carte_differee') {
        const d = (o.dettes || {})[c.id];
        if (d) cartes += d.centimes;
        const sous = d ? 'à prélever' + (c.prelevement && c.prelevement.jour ? ' le ' + c.prelevement.jour : '') + (d.depuis ? ' · depuis le ' + U().jjmm(d.depuis) : '') : 'libellé du prélèvement à choisir';
        return li(U().bico(S, c), c.libelle, sous, 'data-compte="' + esc(c.id) + '"', d ? '<span class="num">' + esc(F().montant(d.centimes)) + '</span>' : '—',
          c.libelle + ', carte à débit différé, ' + (d ? F().montant(d.centimes) + ' ' + sous : sous));
      }
      const lv = (o.livrets || {})[c.id];
      const s0 = M().soldeAffiche(S, c);
      const s = lv ? { centimes: lv.centimes, dateRef: s0 && s0.dateRef } : s0;
      if (!s) return li(U().bico(S, c), c.libelle, c.source.type === 'manuel' ? 'solde à saisir' : 'solde pas encore lu', 'data-compte="' + esc(c.id) + '"', '—');
      if (c.role === 'courant' || c.role === 'commun') { total += s.centimes; n++; }
      const ancien = eb && (!t || now - Date.parse(t) > 30 * 3600e3);
      const sous = lv ? 'estimé · intérêts ' + lv.texte : (c.source.type === 'manuel' ? 'saisi le ' + U().jjmm(s.dateRef || s.lu) : (t ? 'relevé de ' + hhmm(t) + (ancien ? ' · ancien' : '') : 'au ' + U().jjmm(s.dateRef)));
      const v = s.centimes;
      return li(U().bico(S, c), c.libelle, sous, 'data-compte="' + esc(c.id) + '"',
        '<span class="num' + (v < 0 ? ' bad-t' : '') + '">' + esc(F().montant(Math.abs(v))) + '</span>' + (v < 0 ? '<small class="bad-t">débiteur</small>' : ''),
        c.libelle + ', ' + F().montant(Math.abs(v)) + (v < 0 ? ' débiteur' : '') + ', ' + sous);
    }).join('');
    const tot = n ? '<p class="ac-tot">Total disponible (courants et commun) : <b class="num' + (total < 0 ? ' bad-t' : '') + '">' + esc(F().solde(total)) + '</b>' +
      (cartes ? ' · après les cartes : <b class="num' + (total - cartes < 0 ? ' bad-t' : '') + '">' + esc(F().solde(total - cartes)) + '</b>' : '') + '</p>' : '';
    return carte('ac-so', 'Soldes', lu ? 'relevés de ' + hhmm(lu) : '', lignes + tot, ' data-mesure="soldes"');
  }

  // ------------------------------------------------------------ 4. ce cycle-ci (4 postes : dépassés et à surveiller d'abord)
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
    const restants = Math.max(0, res.nbJours - res.jour);
    return carte('ac-cy', 'Ce cycle-ci', pluriel(restants, 'jour') + ' restant' + (restants > 1 ? 's' : ''), corps +
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
      const sous = ok ? 'reçu le ' + U().jjmm(x.vu.date) : (x.retard ? 'en retard' : 'attendu vers le ' + (x.v.jour || 1));
      corps += li('<span class="dot ' + (ok ? 'good' : x.retard ? 'warn' : '') + '" aria-hidden="true"></span>', 'Virement de ' + nom(x.v.qui), sous, 'data-aller="commun"',
        '<span class="num' + (ok ? ' pos-t' : '') + '">' + esc((ok ? '+' : '') + F().montant(ok ? x.vu.m : x.v.montant)) + '</span>');
    }
    for (const x of (pl && pl.changes) || []) {
      corps += li('<span class="dot warn" aria-hidden="true"></span>', 'À mettre en place', nom(x.qui) + ' : passer de ' + KB().eur(x.have) + ' à ' + KB().eur(x.want) + ' par mois', 'data-aller="commun"');
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
    return '<section class="ac-quick" aria-label="Actions rapides">' + b('sync', '↻', 'Synchroniser') + b('trier', '✓', 'Trier les opérations') +
      b('sauvegarde', '⤓', 'Sauvegarder') + b('verrou', '🔒', 'Verrouiller') + '</section>';
  }

  // Ligne « Bilan du cycle précédent » : les 5 premiers jours d'un cycle de salaire.
  function bilan(res) {
    if (!res || !res.per || !res.per.cyc || res.per.past || res.jour > 5 || !res.per.prev) return null;
    return { cle: 'bilan', texte: 'Bilan du cycle précédent', sous: 'nouveau cycle depuis le ' + U().jjmm(res.per.cyc.start), niveau: 'info' };
  }

  // Écran complet. d : { S, B, now, ext (KladApp.extras), res, dettes, livrets, fdm, plan, R, ech }.
  function ecran(d) {
    const L = Vu().lignesAVerifier(d.S, d.now, d.ext);
    const bl = bilan(d.res);
    if (bl) L.push(bl);
    return reste(d.res) + aVerifier(L) + soldes(d.S, d.now, { dettes: d.dettes, livrets: d.livrets }) + cycle(d.B, d.res) +
      commun(d.fdm, d.plan, d.R || {}, M().jourLocal(d.now)) + echeances(d.ech) + actions();
  }
  // Sur-titre de l'en-tête : « Cycle du 27/10 au 26/11 · jour 4 sur 31 ».
  function surTitre(res) {
    if (!res || !res.per) return '';
    const p = res.per;
    return (p.cyc ? 'Cycle du ' + U().jjmm(p.cyc.start) + ' au ' + U().jjmm(p.cyc.end) : U().mLong(p.pm0)) + ' · jour ' + res.jour + ' sur ' + res.nbJours;
  }

  g.KladVuesAccueil = { ecran, reste, aVerifier, soldes, cycle, commun, echeances, actions, bilan, surTitre };
})(typeof window !== 'undefined' ? window : globalThis);
