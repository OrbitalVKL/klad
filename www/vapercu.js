// Klad — Aperçu (2.0) : l'Accueil devient un tableau de bord en deux pages qu'on fait glisser,
// « Moi » (perso) et « Nous » (compte commun). En haut un cadran (un chiffre, le temps qui passe, ce qui est consommé),
// puis des blocs denses : rien n'est retiré par rapport aux écrans d'avant, chaque bloc renvoie à l'écran détaillé.
// Aucun calcul propre : KladBudget.suivi, ravChoisi, echeances ; KladCommun.finDeMois, plan, decomposition, equilibre,
// tresorerie ; KladObservations.observations. Chaînes HTML, sans accès au DOM. Jamais de montant affiché avec un signe moins.
(function (g) {
  'use strict';

  const F = () => g.KladFormat;
  const KB = () => g.KladBudget;
  const KC = () => g.KladCommun;
  const KO = () => g.KladObservations;
  const U = () => g.KladUI;
  const VA = () => g.KladVuesAccueil;
  const Vu = () => g.KladVues;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const e0 = c => KB().eur(Math.abs(Math.round(+c || 0)));
  const DEMI = 50;
  const JOURS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
  const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const jm = iso => +iso.slice(8, 10) + ' ' + MOIS[+iso.slice(5, 7) - 1];
  const plusJours = (iso, n) => g.KladModele.plusJours(iso, n);

  // état d'une consommation par rapport au temps écoulé : good (au rythme ou en dessous), warn, bad (dépassé)
  function etat(conso, temps) {
    if (conso > 1.0001) return 'bad';
    const d = conso - temps;
    return d <= 0.05 ? 'good' : d <= 0.15 ? 'warn' : 'bad';
  }
  const COUL = { good: 'var(--good)', warn: 'var(--warn)', bad: 'var(--bad)', hb: 'var(--hb)' };

  // ------------------------------------------------------------ cadran
  // temps 0..1 (anneau fin et repère), conso 0..1 (anneau épais, couleur de l'état), centre : HTML
  // apres (2.2) : bouton posé dans le cadran (ⓘ)
  function cadran(temps, conso, et, centre, nom, apres) {
    const S = 200, c = S / 2, rO = 94, rI = 77, wI = 17, CO = 2 * Math.PI * rO, CI = 2 * Math.PI * rI;
    const t = Math.max(0, Math.min(1, temps)), k = Math.max(0, Math.min(1, conso));
    const a = t * 2 * Math.PI - Math.PI / 2, tx = c + Math.cos(a) * rO, ty = c + Math.sin(a) * rO;
    return '<div class="ap-dial"><svg viewBox="0 0 ' + S + ' ' + S + '" role="img" aria-label="' + esc(nom) + '" focusable="false">' +
      '<g transform="rotate(-90 ' + c + ' ' + c + ')"><circle cx="' + c + '" cy="' + c + '" r="' + rO + '" class="ap-t0"/>' +
      '<circle cx="' + c + '" cy="' + c + '" r="' + rO + '" class="ap-t1" stroke-dasharray="' + (CO * t).toFixed(1) + ' ' + CO.toFixed(1) + '"/>' +
      '<circle cx="' + c + '" cy="' + c + '" r="' + rI + '" class="ap-c0" stroke-width="' + wI + '"/>' +
      (k > 0 ? '<circle cx="' + c + '" cy="' + c + '" r="' + rI + '" fill="none" stroke="' + COUL[et] + '" stroke-width="' + wI + '" stroke-linecap="round" stroke-dasharray="' + (CI * k).toFixed(1) + ' ' + CI.toFixed(1) + '"/>' : '') +
      '</g><circle cx="' + tx.toFixed(1) + '" cy="' + ty.toFixed(1) + '" r="7" class="ap-ici"/></svg><div class="ap-dc" aria-hidden="true">' + centre + '</div>' + (apres || '') + '</div>';
  }
  // petit anneau autour d'une icône (postes)
  function anneau(frac, et, icone, sz) {
    const S = sz || 44, w = 5, r = (S - w) / 2, C = 2 * Math.PI * r, f = Math.max(0, Math.min(1, frac));
    return '<span class="ap-ring" style="width:' + S + 'px;height:' + S + 'px"><svg viewBox="0 0 ' + S + ' ' + S + '" aria-hidden="true" focusable="false"><g transform="rotate(-90 ' + S / 2 + ' ' + S / 2 + ')">' +
      '<circle cx="' + S / 2 + '" cy="' + S / 2 + '" r="' + r + '" class="ap-c0" stroke-width="' + w + '"/>' +
      (f > 0 ? '<circle cx="' + S / 2 + '" cy="' + S / 2 + '" r="' + r + '" fill="none" stroke="' + COUL[et] + '" stroke-width="' + w + '" stroke-linecap="round" stroke-dasharray="' + (C * f).toFixed(1) + ' ' + C.toFixed(1) + '"/>' : '') +
      '</g></svg>' + icone + (et === 'bad' ? '<b class="ap-alerte" aria-hidden="true">!</b>' : '') + '</span>';
  }
  const carte = (titre, droite, corps, attr, aide) => '<section class="ap-card"' + (attr || '') + '><h2>' + esc(titre) + (droite ? '<span class="r">' + droite + '</span>' : '') +
    (aide ? '<button type="button" class="ap-aide" ' + aide + ' aria-label="Comment c\'est calculé">?</button>' : '') + '</h2>' + corps + '</section>';
  // 2.2 : carte dont les lignes ont des infos : ⓘ dans le titre
  const carteInf = (titre, corps, attr) => '<section class="ap-card inf-l"' + (attr || '') + '><h2>' + esc(titre) + U().ib(titre) + '</h2>' + corps + '</section>';
  const lien = (attr, t) => '<button type="button" class="ap-lien" ' + attr + '>' + esc(t) + ' ›</button>';

  // ------------------------------------------------------------ barre de l'argent (calcul du reste à vivre, en couleurs)
  // x : KladBudget.ravChoisi(rav, base). Base comptes : soldes = charges fixes à venir + carte + budget variable restant
  // + reste à vivre ; base salaire : salaire = charges fixes prélevées + variable dépensé + reste à vivre.
  function barreArgent(x) {
    const c = x.col, comptes = x.choix === 'comptes';
    const P = comptes ? [['fix', 'charges fixes à venir', c.fixes], ['carte', 'carte à prélever', c.cartes || 0], ['var', 'budget variable restant', c.variable], ['libre', 'reste à vivre', c.reste]]
      : [['fix', 'charges fixes prélevées', c.fixes], ['var', 'variable dépensé', c.variable], ['libre', 'reste à vivre', c.reste]];
    const vis = P.filter(p => Math.abs(p[2]) > DEMI);
    const pos = vis.filter(p => p[2] > 0), tot = pos.reduce((t, p) => t + p[2], 0) || 1;
    const depasse = c.reste < -DEMI;
    const bar = '<div class="ap-mbar" role="img" aria-label="' + esc(vis.map(p => p[1] + ' ' + e0(p[2])).join(', ')) + '">' +
      pos.map(p => '<i class="m-' + p[0] + '" style="flex:' + Math.round(p[2]) + '"></i>').join('') + (depasse ? '<i class="m-dep" style="flex:' + Math.round(-c.reste) + '"></i>' : '') + '</div>';
    const leg = '<div class="ap-mleg">' + vis.map(p => '<span><i class="m-' + (p[0] === 'libre' && p[2] < 0 ? 'dep' : p[0]) + '"></i><b class="num">' + e0(p[2]) + '</b><small>' + esc(p[0] === 'libre' && p[2] < 0 ? 'dépassement' : p[1]) + '</small></span>').join('') + '</div>';
    // 2.2 : la date du salaire en info (ⓘ)
    return '<div class="ap-mtete inf-l"><span>' + (comptes ? 'Comptes courants' : 'Salaire' + (c.date ? U().ib('Salaire') + U().inf('reçu le ' + esc(U().jjmm(c.date)), 'enc') : '')) + '</span><b class="num">' + e0(c.base) + '</b></div>' + bar + leg;
  }

  // montant court d'une case du fil des jours : « 950 € », « 1,3 k€ » (le montant exact est dans la liste dépliée)
  const court = c => { const v = Math.abs(Math.round(+c || 0)) / 100; return v < 999.5 ? e0(c) : (Math.round(v / 100) / 10).toLocaleString('fr-FR') + '\u202fk€'; };
  // ------------------------------------------------------------ fil des jours : 7 jours, échéances en pastilles, puis la liste
  function filJours(ech, auj, scope, suite) {
    const L = (ech || []).filter(e => scope === 'tout' || e.scope === scope || (scope === 'perso' && e.sorte === 'carte'));
    const parJour = {};
    for (const e of L) (parJour[e.date] || (parJour[e.date] = [])).push(e);
    let cases = '';
    for (let i = 0; i < 7; i++) {
      const d = plusJours(auj, i), wd = new Date(d + 'T12:00:00Z').getUTCDay(), E = parJour[d] || [];
      const tot = E.reduce((t, e) => t + e.montant, 0);
      cases += '<span class="ap-day' + (i === 0 ? ' auj' : '') + '"><span class="w">' + JOURS[wd] + '</span><span class="n num">' + +d.slice(8, 10) + '</span>' +
        (E.length ? '<span class="ev ' + (E[0].scope === 'commun' ? 'nous' : 'moi') + '">' + E.length + '</span><span class="a num" aria-label="' + esc(e0(tot)) + '">' + esc(court(tot)) + '</span>' : '<span class="vide"></span><span class="a"></span>') + '</span>';
    }
    const apres = L.filter(e => e.date >= plusJours(auj, 7));
    if (suite) cases += '<span class="ap-suite">' + suite + '</span>';
    const liste = L.slice().sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0).map(e =>
      '<li><span class="d num">' + esc(U().jjmm(e.date)) + '</span><span class="l">' + esc(e.label) + '<small class="inf">' + esc({ contrat: 'contrat', recurrent: 'prélèvement récurrent', carte: 'carte à débit différé' }[e.sorte] || '') + (scope === 'tout' ? ' · ' + (e.scope === 'commun' ? 'commun' : 'perso') : '') + '</small></span><b class="num">' + esc(F().montant(e.montant)) + '</b></li>').join('');
    return '<div class="ap-days">' + cases + '</div>' + (L.length ? '<details class="ap-plis"><summary>' + L.length + ' échéance' + (L.length > 1 ? 's' : '') + ' sur 31 jours' + (apres.length ? ' · ' + apres.length + ' après le ' + esc(jm(plusJours(auj, 6))) : '') + '</summary><ul class="ap-ech">' + liste + '</ul></details>'
      : '<p class="ap-note">Aucune échéance connue dans les 31 prochains jours.</p>');
  }

  // ------------------------------------------------------------ budget compact : par nature, chaque poste en anneau
  const NATS = [['fixe', 'Charges fixes'], ['courante', 'Dépenses courantes'], ['optionnelle', 'Dépenses optionnelles']];
  function budget(res, B, scope) {
    if (!res) return '';
    const C = B && B.cx ? B.cx.C : null, temps = Math.min(1, res.jour / (res.nbJours || 1));
    const ligne = (a, nk) => {
      const over = a.cur - a.pm > DEMI && a.pm > DEMI, fr = a.pm > DEMI ? a.cur / a.pm : a.cur > DEMI ? 1 : 0;
      const et = nk === 'hb' ? 'hb' : over ? 'bad' : nk === 'fixe' ? 'good' : a.cls === 'warn' ? 'warn' : etat(fr, temps) === 'bad' ? 'warn' : 'good';
      const reste = nk === 'hb' ? 'sans budget' : over ? 'dépassé de ' + e0(a.cur - a.pm) : nk === 'fixe' ? (a.cur >= a.pm - DEMI ? 'prélevé' : 'à venir ' + e0(a.pm - a.cur)) : 'reste ' + e0(Math.max(0, a.pm - a.cur));
      return '<li><button type="button" class="ap-po" data-aller="' + (scope === 'commun' ? 'commun' : 'budget') + '" aria-label="' + esc(a.label + ' : ' + e0(a.cur) + ' sur ' + e0(a.pm) + ', ' + reste) + '">' +
        anneau(fr, et, '<span class="ic">' + U().icoPoste(C, a) + '</span>') + '<span class="t">' + esc(a.label) + '<small class="' + (over ? 'bad-t' : et === 'warn' ? 'warn-t' : '') + '">' + esc(reste) + '</small></span>' +
        '<span class="v num">' + esc(e0(a.cur)) + (nk === 'hb' ? '' : ' <small>/\u00a0' + esc(e0(a.pm)) + '</small>') + '</span></button></li>';
    };
    let h = '';
    // revenus
    const RV = (res.revenus && res.revenus.lignes) || [];
    if (RV.length) {
      const att = Math.max(0, res.revenus.p - res.revenus.c);
      h += '<div class="ap-nat"><div class="ap-nh"><span>Revenus</span><b class="num">' + e0(res.revenus.c) + ' <small>/\u00a0' + e0(res.revenus.p) + '</small></b></div>' +
        (att > DEMI ? '<p class="ap-note">attendu encore ' + e0(att) + '</p>' : '') + '</div>';
    }
    for (const [nk, nom] of NATS) {
      const S = res.sections[nk];
      if (!S || !S.lignes.length) continue;
      const over = S.c - S.p > DEMI;
      h += '<div class="ap-nat"><div class="ap-nh"><span>' + nom + (S.nbDepasses ? ' <b class="ap-chip bad">' + S.nbDepasses + ' dépassé' + (S.nbDepasses > 1 ? 's' : '') + '</b>' : '') + '</span><b class="num' + (over ? ' bad-t' : '') + '">' + e0(S.c) + ' <small>/\u00a0' + e0(S.p) + '</small></b></div>' +
        '<div class="ap-nb"><i style="width:' + Math.min(100, S.p > DEMI ? S.c / S.p * 100 : 0).toFixed(1) + '%" class="' + (over ? 'bad' : '') + '"></i></div>' +
        '<ul class="ap-pl">' + S.lignes.map(a => ligne(a, nk)).join('') + '</ul></div>';
    }
    const HB = res.horsBudget && res.horsBudget.lignes || [];
    if (HB.length) h += '<div class="ap-nat"><div class="ap-nh"><span>Hors budget</span><b class="num">' + e0(res.horsBudget.c) + '</b></div><ul class="ap-pl">' + HB.map(a => ligne(Object.assign({}, a, { pm: 0 }), 'hb')).join('') + '</ul></div>';
    // bilan du budget : mêmes lignes que les natures (montant aligné à droite), sur fond teinté = la conclusion de la carte.
    // Total dépensé (barre), réel à ce jour, projection (à partir du 7e jour).
    const o = res.solde || {};
    const tot = res.total || {}, overT = tot.C - tot.P > DEMI;
    const fin = scope === 'commun' ? 'fin de mois' : res.per && res.per.cyc && res.per.cyc.end ? 'au ' + U().jjmm(res.per.cyc.end) : 'fin de période';
    h += '<div class="ap-bilan" role="group" aria-label="Bilan">' +
      '<div class="ap-br"><span>Total dépensé</span><b class="num' + (overT ? ' bad-t' : '') + '">' + e0(tot.C) + ' <small>/\u00a0' + e0(tot.P) + '</small></b></div>' +
      '<div class="ap-nb"><i style="width:' + Math.min(100, tot.P > DEMI ? tot.C / tot.P * 100 : 0).toFixed(1) + '%" class="' + (overT ? 'bad' : '') + '"></i></div>' +
      '<div class="ap-br"><span>' + (scope === 'commun' ? 'Variation réelle' : 'Réel à ce jour') + '</span>' + sgB(scope === 'commun' ? o.variation : o.bal) + '</div>' +
      '<div class="ap-br"><span>Projeté ' + esc(fin) + '</span>' + (res.jour < 7 ? '<span class="ap-mu">dès le 7e jour</span>' : sgB(o.pj)) + '</div></div>';
    return h;
  }
  // solde du bilan : pastille (excédent / déficit / à l'équilibre) puis le montant, toujours sans signe moins
  const sgB = v => v == null ? '<b>—</b>' : '<span class="ap-sv">' +
    (v < -DEMI ? '<em class="ap-pill bad">déficit</em><b class="num bad-t">' + esc(e0(-v)) + '</b>'
      : v > DEMI ? '<em class="ap-pill good">excédent</em><b class="num pos-t">' + esc(e0(v)) + '</b>'
        : '<em class="ap-pill">à l\'équilibre</em><b class="num">' + esc(e0(v)) + '</b>') + '</span>';
  // accès aux écrans détaillés : boutons encadrés (icône + nom), 2 par ligne ; seul sur sa ligne (pleine largeur) quand son nom ne tient pas
  const actions = L => '<nav class="ap-act" aria-label="Écrans détaillés">' + L.filter(Boolean).map(([attr, t, ic]) =>
    '<button type="button" class="ap-ab" ' + attr + '>' + (g.KladIcones ? g.KladIcones.svg(ic, 18) : '') + '<span>' + esc(t) + '</span></button>').join('') + '</nav>';

  // ------------------------------------------------------------ observations (les « à faire » en clair, le reste en un appui)
  function observations(B, scope) {
    if (!KO() || !B) return '';
    let O;
    try { O = KO().observations(B, scope); } catch (e) { return ''; }
    const L = O.faire.filter(a => a.scope === scope || a.scope === 'all');
    const nInfo = O.infos.length;
    const it = a => '<li class="' + esc(a.niveau) + '"><i aria-hidden="true"></i><span><b>' + esc(a.titre) + '</b><small>' + esc(a.texte || '') + '</small></span></li>';
    return carte('À faire', L.length ? '<b class="ap-chip warn">' + L.length + '</b>' : 'rien d\'urgent', (L.length ? '<ul class="ap-obs">' + L.slice(0, 4).map(it).join('') + '</ul>' : '') +
      lien('data-av="observations"', 'Toutes les observations' + (L.length > 4 || nInfo ? ' (' + (O.faire.length + nInfo) + ')' : '')), ' data-mesure="obs-' + scope + '"');
  }

  // ------------------------------------------------------------ page « Moi »
  function moi(d) {
    const res = d.res, rav = res && res.rav, B = d.B;
    let h = '';
    if (rav) {
      const x = KB().ravChoisi(rav, KB().baseRav(d.S)), c = x.col;
      const V = res.T.courante, O = res.T.optionnelle, bud = V.p + O.p, conso = bud > DEMI ? (V.c + O.c) / bud : 0;
      const temps = Math.min(1, res.jour / (res.nbJours || 1)), et = c.reste < -DEMI ? 'bad' : etat(conso, temps);
      const nom = 'Reste à vivre ' + e0(c.reste) + (c.reste < -DEMI ? ' en dépassement' : '') + ' jusqu\'au ' + U().jjmm(rav.fin) + ', jour ' + res.jour + ' sur ' + res.nbJours + ', budget variable consommé à ' + Math.round(conso * 100) + ' %';
      h += '<div class="ap-hero">' + cadran(temps, conso, et, '<span class="lbl">Reste à vivre</span><span class="v num' + (c.reste < -DEMI ? ' bad-t' : '') + '">' + esc(e0(c.reste)) + (c.reste < -DEMI ? '<small> dépassé</small>' : '') + '</span>' +
        '<span class="s">jusqu\'au ' + esc(jm(rav.fin)) + '</span><span class="j num">jour ' + res.jour + '/' + res.nbJours + '</span>', nom) +
        '<div class="ap-cote"><span><i class="ap-k t"></i>temps</span><span><i class="ap-k" style="background:' + COUL[et] + '"></i>variable dépensé ' + Math.round(conso * 100) + ' %</span></div>' +
        U().interrupteurRav(x.choix, !!rav.comptes) + '</div>';
      h += carte('Où va l\'argent', '', barreArgent(x), ' data-mesure="argent"', 'data-aller="rav"');
    } else h += VA().reste(res, KB().baseRav(d.S));
    // la ligne « N observations à faire » n'est pas répétée : la carte « À faire » (en bas) les montre déjà
    const L = Vu().lignesAVerifier(d.S, d.now, d.ext).filter(l => l.cle !== 'observations');
    h += VA().aVerifier(L);
    h += VA().soldes(d.S, d.now, { dettes: d.dettes, livrets: d.livrets });
    if (res) h += carte('Budget du cycle', esc(res.per && res.per.cyc ? U().jjmm(res.per.cyc.start) + ' → ' + U().jjmm(res.per.cyc.end) : ''), budget(res, B, 'perso') +
      actions([['data-aller="budget"', 'Tout le budget', 'list'], ['data-aller="tendance"', 'Tendance', 'trending-up'], ['data-aller="contrats-perso"', 'Contrats', 'file-text'],
        VA().bilan(res) ? ['data-av="bilan"', 'Dernier bilan', 'calendar-check'] : null]), ' data-mesure="budget-perso"');
    if (B) h += carte('Prochains jours', '', filJours(d.ech, B.auj, 'perso', paie(res)), ' data-mesure="jours"');
    h += observations(B, 'perso');
    return h;
  }
  // prochaine paie (fin du cycle + 1) : repère au bout du fil des jours
  function paie(res) {
    const c = res && res.per && res.per.cyc;
    if (!c || (!c.attendu && !c.end)) return '';
    const p = c.attendu || plusJours(c.end, 1);
    return '<span class="ap-paie"><span class="ev">€</span><small>paie</small><b>' + esc(jm(p)) + '</b></span>';
  }

  // ------------------------------------------------------------ page « Nous »
  function nous(d) {
    const B = d.B, fdm = d.fdm, pl = d.plan, R = d.R || {};
    if (!B || !fdm) return '<section class="ap-card"><p class="ap-note">Le compte commun apparaît ici dès qu\'un compte a le rôle « commun » (Plus › Comptes).</p></section>';
    let res = null;
    try { res = KB().suivi(B, 'commun', null); } catch (e) { res = null; }
    const nom = q => (q === 'moi' ? R.moi : R.autre) || (q === 'moi' ? 'Moi' : 'L\'autre personne');
    // initiale de chaque personne ; en mode démo « A » / « B » (le masquage du mode démo ne touche pas une lettre seule)
    const AF = g.KladAffichage, demo = !!(AF && AF.demoActif && AF.demoActif());
    const ini = q => esc(demo ? (q === 'moi' ? 'A' : 'B') : String(nom(q)).trim().charAt(0).toUpperCase() || '?');
    let h = '';
    const temps = res ? Math.min(1, res.jour / (res.nbJours || 1)) : 0;
    const P = res ? NATS.reduce((t, [k]) => t + res.sections[k].p, 0) : 0, Cn = res ? NATS.reduce((t, [k]) => t + res.sections[k].c, 0) : 0;
    const conso = P > DEMI ? Cn / P : 0, et = fdm.end < -DEMI || fdm.decouvert ? 'bad' : etat(conso, temps);
    h += '<div class="ap-hero nous">' + cadran(temps, conso, et, '<span class="lbl">Fin de mois estimée</span><span class="v num' + (fdm.end < -DEMI ? ' bad-t' : '') + '">' + esc(e0(fdm.end)) + (fdm.end < -DEMI ? '<small> débiteur</small>' : '') + '</span>' +
      '<span class="s">solde ' + esc(e0(fdm.solde)) + (fdm.solde < 0 ? ' débiteur' : '') + '</span>' + (res ? '<span class="j num">jour ' + res.jour + '/' + res.nbJours + '</span>' : ''),
      'Fin de mois estimée du compte commun ' + e0(fdm.end) + ', solde ' + F().solde(fdm.solde)) +
      '<div class="ap-cote"><span><i class="ap-k t"></i>temps</span><span><i class="ap-k" style="background:' + COUL[et] + '"></i>budget du commun ' + Math.round(conso * 100) + ' %</span></div>' +
      (fdm.decouvert ? '<p class="ap-warn">découvert si les prélèvements passent avant les virements</p>' : '') + '</div>';
    // virements de chacun
    let v = '';
    for (const x of (pl && pl.recus) || []) {
      const ok = !!x.vu, st = ok ? 'good' : x.route ? 'route' : x.retard ? 'bad' : 'attente';
      const sous = ok ? 'reçu le ' + U().jjmm(x.vu.date) : x.route ? 'en route · parti le ' + U().jjmm(x.route.depart.date) : x.retard ? 'en retard' : 'attendu vers le ' + (x.v.jour || 1);
      // état du virement en pastille sur l'avatar (✓ reçu, ⇢ en route, ! en retard, … attendu) ; en clair dans le sous-titre
      v += '<li><span class="ap-av ' + (x.v.qui === 'moi' ? 'moi' : 'nous') + '" aria-hidden="true">' + ini(x.v.qui) + '<span class="ap-st ' + st + '">' + (ok ? '✓' : x.route ? '⇢' : x.retard ? '!' : '…') + '</span></span>' +
        '<span class="t">' + esc(x.v.label || 'Virement') + '<small>' + esc(nom(x.v.qui) + ' · ' + sous) + '</small></span>' +
        '<b class="num' + (ok ? ' pos-t' : '') + '">' + esc((ok ? '+' : '') + F().montant(ok ? x.vu.m : x.v.montant)) + '</b></li>';
    }
    const parQui = {};
    for (const x of (pl && pl.changes) || []) { const q = parQui[x.qui] || (parQui[x.qui] = { n: 0, have: 0, want: 0 }); q.n++; q.have += +x.have || 0; q.want += +x.want || 0; }
    for (const q of Object.keys(parQui)) {
      const x = parQui[q];
      v += '<li class="chg"><span class="ap-av ' + (q === 'moi' ? 'moi' : 'nous') + '" aria-hidden="true">' + ini(q) + '<span class="ap-st warn">✎</span></span><span class="t">À mettre en place<small>' + esc(nom(q) + ' : ' + (x.n > 1 ? x.n + ' virements, ' : '') + 'de ' + e0(x.have) + ' à ' + e0(x.want) + ' par mois') + '</small></span></li>';
    }
    if (v) h += carte('Virements du mois', '', '<ul class="ap-vir">' + v + '</ul>' + lien('data-aller="commun"', 'Virements à mettre en place, fiche du mois'), ' data-mesure="virements"');
    // équilibre et trésorerie
    let E = null, T = null;
    try { E = KC().equilibre(B); } catch (e) { E = null; }
    try { T = KC().tresorerie(B); } catch (e) { T = null; }
    let tu = '';
    if (E) {
      const gap = E.ecart, aqui = gap > 0 ? 'moi' : 'autre', tilt = Math.max(-14, Math.min(14, (E.invAutre - E.invMoi) / Math.max(1, E.invAutre + E.invMoi) * 60));
      tu += '<button type="button" class="ap-tile" data-aller="equilibre" aria-label="' + esc('Équilibre de l\'indivision : ' + (Math.abs(gap) < 100 ? 'atteint' : nom(aqui) + ' doit encore investir ' + e0(Math.abs(gap))) + (E.dateEquilibre ? ', équilibre vers ' + U().mLabel(E.dateEquilibre) : '')) + '">' +
        '<span class="h">Équilibre</span><svg viewBox="0 0 150 70" aria-hidden="true" focusable="false"><polygon points="75,66 65,50 85,50" class="ap-piv"/><g transform="rotate(' + tilt.toFixed(1) + ' 75 48)"><rect x="10" y="44" width="130" height="6" rx="3" class="ap-plank"/>' +
        '<circle cx="26" cy="32" r="12" class="ap-pm"/><text x="26" y="37" text-anchor="middle">' + ini('moi') + '</text><circle cx="124" cy="32" r="12" class="ap-pa"/><text x="124" y="37" text-anchor="middle">' + ini('autre') + '</text></g></svg>' +
        '<b class="num">' + (Math.abs(gap) < 100 ? 'atteint' : e0(Math.abs(gap))) + '</b><small>' + esc(Math.abs(gap) < 100 ? '50 / 50' : 'à combler par ' + nom(aqui)) + '</small></button>';
    }
    if (T && T.months && T.months.length) {
      const vals = T.months.map(m => m.low), mx = Math.max(...vals, 1), mn = Math.min(...vals, 0), W = 140, H = 54;
      const x = i => 2 + i * (W - 4) / (vals.length - 1 || 1), y = a => 4 + (1 - (a - mn) / ((mx - mn) || 1)) * (H - 8);
      const d0 = vals.map((a, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(a).toFixed(1)).join(' ');
      const seuil = (B.R && B.R.commun && B.R.commun.reserveFixe) || 0, iMin = vals.indexOf(Math.min(...vals));
      tu += '<button type="button" class="ap-tile" data-aller="tresorerie" aria-label="' + esc('Trésorerie du commun sur 12 mois : point bas ' + F().solde(T.min) + ' le ' + U().jjmm(T.minAt)) + '">' +
        '<span class="h">12 prochains mois</span><svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="' + d0 + ' L' + x(vals.length - 1).toFixed(1) + ' ' + H + ' L2 ' + H + ' Z" class="ap-area"/>' +
        '<path d="' + d0 + '" class="ap-line"/>' + (seuil > 0 || mn < 0 ? '<line x1="2" x2="' + (W - 2) + '" y1="' + y(Math.max(seuil, 0)).toFixed(1) + '" y2="' + y(Math.max(seuil, 0)).toFixed(1) + '" class="ap-floor"/>' : '') +
        '<circle cx="' + x(iMin).toFixed(1) + '" cy="' + y(vals[iMin]).toFixed(1) + '" r="4" class="ap-low"/></svg>' +
        '<b class="num' + (T.min < 0 ? ' bad-t' : '') + '">' + esc(F().solde(T.min)) + '</b><small>point bas</small>' + (T.negAt ? '<small class="bad-t">découvert le ' + esc(U().jjmm(T.negAt)) + '</small>' : '') + '</button>';
    }
    if (tu) h += '<div class="ap-tiles">' + tu + '</div>';
    // répartition du solde
    let D = null;
    try { D = KC().decomposition(B); } catch (e) { D = null; }
    if (D) {
      const P2 = [['dispo', 'disponible', D.disponible], ['res', 'réserve fixe', D.reserve], ['prov', 'provisions', D.provisions], ['env', 'enveloppes', D.enveloppes]].filter(p => Math.abs(p[2]) > DEMI || p[0] === 'dispo');
      const pos = P2.filter(p => p[2] > 0);
      h += carte('Le solde se répartit en', '', '<div class="ap-mbar">' + pos.map(p => '<i class="m-' + p[0] + '" style="flex:' + Math.round(p[2]) + '"></i>').join('') + '</div>' +
        '<div class="ap-mleg">' + P2.map(p => '<span><i class="m-' + (p[2] < 0 ? 'dep' : p[0]) + '"></i><b class="num' + (p[2] < 0 ? ' bad-t' : '') + '">' + e0(p[2]) + '</b><small>' + esc(p[2] < 0 ? p[1] + ' (manque)' : p[1]) + '</small></span>').join('') + '</div>' +
        lien('data-aller="commun"', 'Fiche du mois, enveloppes, renflouement'), ' data-mesure="repartition"', 'data-aller="commun"');
    }
    if (res) h += carte('Budget du commun', esc(res.per ? U().mLong(res.per.pm0) : ''), budget(res, B, 'commun') +
      actions([['data-aller="commun"', 'Tout le commun', 'list'], ['data-aller="tresorerie"', 'Trésorerie', 'chart-line'], ['data-aller="equilibre"', 'Équilibre', 'scale'], ['data-aller="contrats-commun"', 'Contrats', 'file-text']]), ' data-mesure="budget-commun"');
    h += carte('Prochains jours', '', filJours(d.ech, B.auj, 'commun', ''), ' data-mesure="jours-commun"');
    h += observations(B, 'commun');
    return h;
  }

  // ------------------------------------------------------------ 2.1 : l'Aperçu dans l'écran du budget
  // Le budget (Moi : budget perso, Nous : budget du commun) n'est plus résumé ici : il est en entier dans l'écran, entre
  // le haut (cadran, où va l'argent, à vérifier, soldes) et le bas (prochains jours, verrouiller).
  const seg = c => '<div class="ap-seg" role="tablist" aria-label="Aperçu"><button type="button" role="tab" data-apcote="moi" aria-selected="' + (c === 'moi') + '"><i class="moi"></i>Moi</button>' +
    '<button type="button" role="tab" data-apcote="nous" aria-selected="' + (c === 'nous') + '"><i class="nous"></i>Nous</button></div>';
  function haut(d, scope) {
    const nous = scope === 'commun';
    let h = seg(nous ? 'nous' : 'moi');
    if (!nous) {
      const res = d.res, rav = res && res.rav;
      if (rav) {
        const x = KB().ravChoisi(rav, KB().baseRav(d.S)), c = x.col;
        const V = res.T.courante, O = res.T.optionnelle, bud = V.p + O.p, conso = bud > DEMI ? (V.c + O.c) / bud : 0;
        const temps = Math.min(1, res.jour / (res.nbJours || 1)), et = c.reste < -DEMI ? 'bad' : etat(conso, temps);
        const nom = 'Reste à vivre ' + e0(c.reste) + (c.reste < -DEMI ? ' en dépassement' : '') + ' jusqu\'au ' + U().jjmm(rav.fin) + ', jour ' + res.jour + ' sur ' + res.nbJours + ', budget variable consommé à ' + Math.round(conso * 100) + ' %';
        // 2.2 : montant à la couleur du côté (Moi bleu) ; échéance, jour et légende du cadran en info (ⓘ)
        h += '<div class="ap-hero moi inf-l">' + cadran(temps, conso, et, '<span class="lbl">Reste à vivre</span><span class="v num">' + esc(e0(c.reste)) + (c.reste < -DEMI ? '<small class="bad-t"> dépassé</small>' : '') + '</span>', nom, U().ib('Reste à vivre')) +
          '<div class="inf enc ap-enc"><p>jusqu\'au ' + esc(jm(rav.fin)) + ' · jour ' + res.jour + ' sur ' + res.nbJours + '</p>' +
          '<div class="ap-cote"><span><i class="ap-k t"></i>temps</span><span><i class="ap-k" style="background:' + COUL[et] + '"></i>variable dépensé ' + Math.round(conso * 100) + ' %</span></div></div>' +
          U().interrupteurRav(x.choix, !!rav.comptes, { salaire: rav.budget.reste, comptes: rav.comptes ? rav.comptes.reste : null }) + '</div>';
        h += carte('Où va l\'argent', '', barreArgent(x), ' data-mesure="argent"', 'data-aller="rav"');
      } else h += VA().reste(res, KB().baseRav(d.S));
      // la ligne « N observations à faire » n'est pas répétée : la carte « À faire » (plus bas) les montre déjà
      h += VA().aVerifier(Vu().lignesAVerifier(d.S, d.now, d.ext).filter(l => l.cle !== 'observations'));
      h += VA().soldes(d.S, d.now, { dettes: d.dettes, livrets: d.livrets });
      return h;
    }
    const B = d.B, fdm = d.fdm;
    if (!B || !fdm) return h + '<section class="ap-card"><p class="ap-note">Le compte commun apparaît ici dès qu\'un compte a le rôle « commun » (Plus › Comptes).</p></section>';
    let res = null;
    try { res = KB().suivi(B, 'commun', null); } catch (e) { res = null; }
    const temps = res ? Math.min(1, res.jour / (res.nbJours || 1)) : 0;
    const P = res ? NATS.reduce((t, [k]) => t + res.sections[k].p, 0) : 0, Cn = res ? NATS.reduce((t, [k]) => t + res.sections[k].c, 0) : 0;
    const conso = P > DEMI ? Cn / P : 0, et = fdm.end < -DEMI || fdm.decouvert ? 'bad' : etat(conso, temps);
    // 2.2 : montant à la couleur du côté (Nous orange) ; jour, légende et calcul de la fin de mois en info (ⓘ)
    h += '<div class="ap-hero nous inf-l">' + cadran(temps, conso, et, '<span class="lbl">Fin de mois estimée</span><span class="v num">' + esc(e0(fdm.end)) + (fdm.end < -DEMI ? '<small class="bad-t"> débiteur</small>' : '') + '</span>',
      'Fin de mois estimée du compte commun ' + e0(fdm.end) + ', solde ' + F().solde(fdm.solde), U().ib('Fin de mois estimée')) +
      '<div class="inf enc ap-enc">' + (res ? '<p>jour ' + res.jour + ' sur ' + res.nbJours + '</p>' : '') +
      '<div class="ap-cote"><span><i class="ap-k t"></i>temps</span><span><i class="ap-k" style="background:' + COUL[et] + '"></i>budget du commun ' + Math.round(conso * 100) + ' %</span></div>' +
      // calcul de la fin de mois (avant 2.1 : carte « Fin de mois estimée » de l'écran Commun), provisions, prélèvements à venir
      '<p class="ap-calc">solde ' + esc(F().solde(fdm.solde)) + ' − prélèvements à venir ' + esc(F().montant(fdm.due || 0)) + (fdm.route ? ' + en route ' + esc(F().montant(fdm.route)) : '') +
        (fdm.inc ? ' + virements attendus ' + esc(F().montant(fdm.inc)) : '') + (fdm.reserve > DEMI ? ' − provisions en cours ' + esc(F().montant(fdm.reserve)) : '') + '</p>' +
      (fdm.aVenir && fdm.aVenir.length ? '<p class="ap-calc">à venir : ' + esc(fdm.aVenir.join(', ')) + '</p>' : '') +
      (fdm.reserve > DEMI ? '<p class="ap-calc">provisions en cours ' + esc(F().montant(fdm.reserve)) + ' · mis de côté : ' + esc(Vu().provisionsTexte(fdm.reserveDet)) + '</p>' : '') + '</div>' +
      (fdm.decouvert ? '<p class="ap-warn">découvert si les prélèvements passent avant les virements</p>' : '') + '</div>';
    // à vérifier : les opérations du commun (la liste s'ouvre sur le périmètre Commun)
    const n = +d.avCommun || 0;
    if (n) {
      const nv = Vu().nomsAVoir ? Vu().nomsAVoir(d.S, 'commun') : { n: 0, noms: [] };
      h += VA().aVerifier([{ cle: 'averifier-commun', texte: n + ' opération' + (n > 1 ? 's' : '') + ' du commun à vérifier', sous: nv.n ? nv.n + ' à voir : ' + nv.noms.join(', ') : 'non classées ou à rapprocher', niveau: 'info' }]);
    }
    h += tuiles(d, B);
    return h;
  }
  // tuiles Équilibre et 12 prochains mois (Nous)
  function tuiles(d, B) {
    const R = d.R || {};
    const nom = q => (q === 'moi' ? R.moi : R.autre) || (q === 'moi' ? 'Moi' : 'L\'autre personne');
    const AF = g.KladAffichage, demo = !!(AF && AF.demoActif && AF.demoActif());
    const ini = q => esc(demo ? (q === 'moi' ? 'A' : 'B') : String(nom(q)).trim().charAt(0).toUpperCase() || '?');
    let E = null, T = null;
    try { E = KC().equilibre(B); } catch (e) { E = null; }
    try { T = KC().tresorerie(B); } catch (e) { T = null; }
    let tu = '';
    if (E) {
      const gap = E.ecart, aqui = gap > 0 ? 'moi' : 'autre', tilt = Math.max(-14, Math.min(14, (E.invAutre - E.invMoi) / Math.max(1, E.invAutre + E.invMoi) * 60));
      tu += '<button type="button" class="ap-tile" data-aller="equilibre" aria-label="' + esc('Équilibre de l\'indivision : ' + (Math.abs(gap) < 100 ? 'atteint' : nom(aqui) + ' doit encore investir ' + e0(Math.abs(gap))) + (E.dateEquilibre ? ', équilibre vers ' + U().mLabel(E.dateEquilibre) : '')) + '">' +
        '<span class="h">Équilibre</span><svg viewBox="0 0 150 70" aria-hidden="true" focusable="false"><polygon points="75,66 65,50 85,50" class="ap-piv"/><g transform="rotate(' + tilt.toFixed(1) + ' 75 48)"><rect x="10" y="44" width="130" height="6" rx="3" class="ap-plank"/>' +
        '<circle cx="26" cy="32" r="12" class="ap-pm"/><text x="26" y="37" text-anchor="middle">' + ini('moi') + '</text><circle cx="124" cy="32" r="12" class="ap-pa"/><text x="124" y="37" text-anchor="middle">' + ini('autre') + '</text></g></svg>' +
        '<b class="num">' + (Math.abs(gap) < 100 ? 'atteint' : e0(Math.abs(gap))) + '</b><small>' + esc(Math.abs(gap) < 100 ? '50 / 50' : 'à combler par ' + nom(aqui)) + '</small></button>';
    }
    if (T && T.months && T.months.length) {
      const vals = T.months.map(m => m.low), mx = Math.max(...vals, 1), mn = Math.min(...vals, 0), W = 140, H = 54;
      const x = i => 2 + i * (W - 4) / (vals.length - 1 || 1), y = a => 4 + (1 - (a - mn) / ((mx - mn) || 1)) * (H - 8);
      const d0 = vals.map((a, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(a).toFixed(1)).join(' ');
      const seuil = (B.R && B.R.commun && B.R.commun.reserveFixe) || 0, iMin = vals.indexOf(Math.min(...vals));
      tu += '<button type="button" class="ap-tile" data-aller="tresorerie" aria-label="' + esc('Trésorerie du commun sur 12 mois : point bas ' + F().solde(T.min) + ' le ' + U().jjmm(T.minAt)) + '">' +
        '<span class="h">12 prochains mois</span><svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="' + d0 + ' L' + x(vals.length - 1).toFixed(1) + ' ' + H + ' L2 ' + H + ' Z" class="ap-area"/>' +
        '<path d="' + d0 + '" class="ap-line"/>' + (seuil > 0 || mn < 0 ? '<line x1="2" x2="' + (W - 2) + '" y1="' + y(Math.max(seuil, 0)).toFixed(1) + '" y2="' + y(Math.max(seuil, 0)).toFixed(1) + '" class="ap-floor"/>' : '') +
        '<circle cx="' + x(iMin).toFixed(1) + '" cy="' + y(vals[iMin]).toFixed(1) + '" r="4" class="ap-low"/></svg>' +
        '<b class="num' + (T.min < 0 ? ' bad-t' : '') + '">' + esc(F().solde(T.min)) + '</b><small>point bas</small>' + (T.negAt ? '<small class="bad-t">découvert le ' + esc(U().jjmm(T.negAt)) + '</small>' : '') + '</button>';
    }
    return tu ? '<div class="ap-tiles">' + tu + '</div>' : '';
  }
  // bas de l'Aperçu : prochains jours (échéances perso ou du commun)
  function bas(d, scope) {
    if (!d.B) return '';
    const nous = scope === 'commun';
    return carteInf('Prochains jours', filJours(d.ech, d.B.auj, nous ? 'commun' : 'perso', nous ? '' : paie(d.res)), ' data-mesure="' + (nous ? 'jours-commun' : 'jours') + '"');
  }

  // Écran complet. d : mêmes données que KladVuesAccueil.ecran ; cote : « moi » ou « nous ».
  function ecran(d, cote) {
    const c = cote === 'nous' ? 'nous' : 'moi';
    return '<div class="ap-seg" role="tablist" aria-label="Aperçu"><button type="button" role="tab" data-apcote="moi" aria-selected="' + (c === 'moi') + '"><i class="moi"></i>Moi</button>' +
      '<button type="button" role="tab" data-apcote="nous" aria-selected="' + (c === 'nous') + '"><i class="nous"></i>Nous</button></div>' +
      '<div class="ap-page" data-cote="' + c + '">' + (c === 'nous' ? nous(d) : moi(d)) + VA().actions() + '</div>' +
      '<div class="ap-dots" aria-hidden="true"><i class="' + (c === 'moi' ? 'on' : '') + '"></i><i class="' + (c === 'nous' ? 'on' : '') + '"></i></div>';
  }

  g.KladVuesApercu = { ecran, moi, nous, haut, bas, tuiles, cadran, anneau, barreArgent, filJours, budget, etat, sgB };
})(typeof window !== 'undefined' ? window : globalThis);
