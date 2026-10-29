// Klad — rendu des écrans du Lot 8 : impôts du foyer (et taxe foncière), épargne (PEE, livret), observations, résultats
// d'une période et répartition des dépenses. Chaînes HTML sans DOM (testées dans node). Jamais de montant négatif
// affiché : « moins », « de plus / de moins », « qui verse combien à qui », « remboursement ».
(function (g) {
  'use strict';

  const KF = () => g.KladFisc;
  const KB = () => g.KladBudget;
  const KO = () => g.KladObservations;
  const K = () => g.KladClasse;
  const F = () => g.KladFormat;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const eu = n => Math.round(Math.abs(+n || 0)).toLocaleString('fr-FR').replace(/[ \u00a0]/g, '\u202f') + '\u00a0€';       // euros (module fiscal)
  const eu2 = n => Math.abs(+n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/[ \u00a0]/g, '\u202f') + '\u00a0€';
  const e0 = c => KB().eur(c);                                    // centimes, à l'euro
  const e2 = c => F().montant(c);                                 // centimes, au centime
  const dfr = d => d ? d.split('-').reverse().join('/') : '';
  const jjmm = d => d ? d.slice(8, 10) + '/' + d.slice(5, 7) : '';
  const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const mLabel = m => MOIS[+m.slice(5, 7) - 1] + ' ' + m.slice(2, 4);
  const chip = (n, t) => '<span class="chip ' + n + '">' + esc(t) + '</span>';
  const LV = { warn: 'À faire', info: 'Info', good: 'OK', bad: 'Action' };
  const kpi = (t, v, s, cls) => '<div class="kpi"><small>' + esc(t) + '</small><b class="' + (cls || '') + '">' + v + '</b><small>' + s + '</small></div>';
  const alerte = a => '<li class="obs ' + a.lvl + '">' + chip(a.lvl, LV[a.lvl] || a.lvl) + '<div><b>' + esc(a.t) + '</b>' + (a.p ? '<p>' + esc(a.p) + '</p>' : '') + '</div></li>';
  const pct1 = v => KF().pct1(v);

  // ------------------------------------------------------------ impôts (écran Impôts, comme l'ancienne version)
  // opt : { annee, lecture: bool (extra Claude : lecture des bulletins et avis), analyse: bool, texteAnalyse }.
  const kp = (t, v, s, cls) => '<div class="kpi"><span class="eyebrow">' + esc(t) + '</span><span class="v' + (cls ? ' ' + cls : '') + '">' + v + '</span><span class="s">' + s + '</span></div>';
  const tete = (titre, apres) => g.KladUI.tete(titre, apres);
  const comment = t => g.KladUI.comment(t);
  const li = a => '<li><span class="chip ' + esc(a.lvl) + '">' + (LV[a.lvl] || a.lvl) + '</span><div><b>' + esc(a.t) + '</b>' + (a.p ? '<div class="subs">' + esc(a.p) + '</div>' : '') + '</div></li>';
  function impots(B, ui) {
    const o = ui || {};
    const X = KF().contexte(B), FI = X.FI, W = X.noms;
    const years = [X.Y, ...Object.keys(FI.avis).map(Number).filter(y => y < X.Y).sort((a, b) => b - a)];
    const Y = years.indexOf(o.annee) >= 0 ? o.annee : years.indexOf(FI.year) >= 0 ? FI.year : years[0];
    const boutonLire = o.lecture ? '<button class="btn" type="button" data-lirebs="1">Lire un bulletin</button>' : '';
    if (!Object.keys(FI.avis).length && !Object.keys(FI.bs).length) {
      return '<section class="panel eq-hero" id="tx-hero"><div class="panel-h"><h2>Impôt sur le revenu du foyer</h2></div><p class="muted">Aucune donnée fiscale : l\'avis d\'impôt et les bulletins de paie lus par l\'ancienne version arrivent avec la reprise (carnet).' +
        (o.lecture ? ' Vous pouvez aussi lire un bulletin ou un avis avec Claude.' : '') + '</p>' + (o.lecture ? '<div class="row">' + boutonLire + '<button class="btn" type="button" data-lireavis="1">Lire un avis</button></div>' : '') + '</section>' + taxeFonciere(B, X);
    }
    const R = KF().annee(X, Y), Fo = R.F, P = R.P, SH = KF().partage(X, R);
    const seg = '<div class="seg" role="group" aria-label="Année des revenus">' + years.map(y => '<button type="button" data-txy="' + y + '" aria-pressed="' + (y === Y) + '">Revenus ' + y + (y === X.Y && !FI.avis[y] ? ' (estimation)' : ' (avis)') + '</button>').join('') + '</div>';
    let k;
    if (R.kind === 'est') {
      k = kp('Impôt ' + Y + ' estimé', eu(R.total), 'impôt ' + eu(Fo.B.apres) + ' + prél. sociaux ' + eu(Fo.ps)) +
        kp('Déjà prélevé', eu(R.paid), 'dont ' + esc(W.s) + ' ' + eu(R.pasSPaid) + (R.bs.length ? '' : ' (estimation)')) +
        kp('Encore prélevé d\'ici déc.', eu(R.toCome), R.nRest + ' salaire(s) ' + esc(W.g) + ', ' + esc(W.s) + ', acomptes') +
        kp(R.solde >= 0 ? 'Solde à payer' : 'Remboursement', eu(R.solde), R.solde >= 0 ? 'septembre ' + (Y + 1) + (R.solde > 300 ? ', en 4 fois' : '') : 'été ' + (Y + 1), R.solde > 300 ? 'bad-t' : R.solde < 0 ? 'pos-t' : '') +
        kp('Taux du foyer', pct1(R.tauxNew), 'il faudrait ' + pct1(Fo.B.apres / Math.max(1, Fo.revPAS) * 100));
    } else {
      k = kp('Impôt ' + Y, eu(R.total), 'impôt ' + eu(R.av.irNet) + ' + prél. sociaux ' + eu(R.av.ps)) +
        kp('Prélevé à la source', eu(R.av.pas), 'retenue des employeurs en ' + Y) +
        kp(R.av.solde >= 0 ? 'Solde' : 'Remboursement', eu(R.av.solde), R.av.solde >= 0 ? 'à payer à partir de septembre ' + (Y + 1) : 'versé en ' + (Y + 1)) +
        kp('Taux moyen', pct1(R.av.tmoy || 0), 'taux marginal ' + (R.av.tmi || 0) + ' %') +
        kp('Revenu fiscal de réf.', eu(R.av.rfr || 0), (R.av.parts || 2) + ' parts');
    }
    let h = '<section class="panel eq-hero" id="tx-hero" aria-label="Synthèse des impôts"><div class="panel-h"><h2>Impôt sur le revenu du foyer</h2>' + seg + '</div><div class="kpis">' + k + '</div>' +
      '<div class="tx-meta">' + (P.st === 'projet' ? chip('warn', 'barème en projet') : chip('good', 'barème voté')) + '<span>' + esc(P.lab) + '</span><span>· déclaration commune (PACS), 2 parts</span><span>· tranche marginale ' + Fo.B.tmi + ' %</span>' + (Fo.B.dec ? '<span>· décote ' + eu(Fo.B.dec) + '</span>' : '') + '</div></section>';
    // observations et régularisations
    const RG = KF().regularisations(X), AL = KF().alertes(X, R), nW = AL.filter(a => a.lvl === 'warn').length;
    h += '<section class="panel obs-panel" id="tx-obs">' + tete('Observations', '<span class="muted" id="tx-obs-n">' + (nW ? nW + ' point(s) à suivre' : 'rien d\'urgent') + '</span>') +
      '<div id="tx-regul" class="tx-regul"><h3 class="obs-h3">À régulariser entre vous</h3>' + RG.map(r => '<div class="cr-r"><span class="cr-l">' + esc(r.per) + '<span class="subs">' + esc(r.kind === 'avis' ? (r.done ? 'Rien à régulariser.' : 'Partage : ' + KF().PART_RULES[FI.hyp.partage || 'seul'][0].toLowerCase() + '.') : r.txt) + '</span></span><b>' +
        (r.kind === 'avis' ? (r.done ? 'à jour' : esc(W[r.from]) + ' verse ' + eu(r.amt) + ' à ' + esc(W[r.to])) : (r.solde >= 0 ? 'solde ≈ ' + eu(r.solde) : 'remboursement ≈ ' + eu(r.solde))) + '</b></div>').join('') + '</div>' +
      '<h3 class="obs-h3">Observations</h3><ul class="alerts" id="tx-alerts">' + AL.map(li).join('') + '</ul>' +
      (o.analyse ? '<div class="row obs-act"><button class="btn" type="button" data-analyseimpots="1">Analyse de Claude</button></div>' : '') +
      (o.texteAnalyse ? '<div class="ai-out" aria-live="polite">' + esc(o.texteAnalyse) + '</div>' : '') + '</section>';
    // prélèvement à la source
    const tchip = t => t === 'neutre' ? chip('warn', 'non personnalisé') : t === 'indiv' ? chip('info', 'individualisé') : chip('good', 'personnalisé');
    let rows = '';
    if (R.kind === 'est') {
      let cum = 0;
      for (const b of R.bg) { cum += b.pas; rows += '<tr><td>' + dfr(b.pay) + '<div class="subs">salaire ' + mLabel(b.m) + '</div></td><td>' + esc(b.emp) + '</td><td class="r num">' + eu2(b.ni) + '</td><td>' + pct1(b.taux) + ' ' + tchip(b.type) + '</td><td class="r num">' + eu2(b.pas) + '</td><td class="r num">' + eu(cum) + '</td></tr>'; }
      if (R.nRest && R.bg.length) rows += '<tr class="tx-proj"><td>' + MOIS[+R.bg[R.bg.length - 1].m.slice(5, 7) % 12] + ' → déc.</td><td>' + esc(R.bg[R.bg.length - 1].emp) + ' (prévu)</td><td class="r num">' + eu(R.projG) + '</td><td>' + pct1(R.tauxNew) + '</td><td class="r num">' + eu(R.projPasG) + '</td><td class="r num">' + eu(cum + R.projPasG) + '</td></tr>';
      let cs = 0;
      for (const b of R.bs) { cs += b.pas; rows += '<tr><td>' + dfr(b.pay) + '<div class="subs">salaire ' + mLabel(b.m) + '</div></td><td>' + esc(W.s) + ' · ' + esc(b.emp) + '</td><td class="r num">' + eu2(b.ni) + '</td><td>' + pct1(b.taux) + ' ' + tchip(b.type) + '</td><td class="r num">' + eu2(b.pas) + '</td><td class="r num">' + eu(cs) + '</td></tr>'; }
      rows += '<tr class="tx-proj"><td>' + Y + '</td><td>' + esc(W.s) + ' (' + esc(R.sSrc) + ')</td><td class="r num">' + eu(R.inp.sal.s) + '</td><td>' + (R.bs.length ? pct1(R.tSNew) : pct1(R.tSOld) + ' puis ' + pct1(R.tSNew)) + '</td><td class="r num">' + eu(R.pas.s) + '</td><td></td></tr>';
      if (R.acompte || R.accProj) rows += '<tr><td>' + Y + '</td><td>Acomptes (compte commun)</td><td class="r num">—</td><td>revenus fonciers</td><td class="r num">' + eu2(R.acompte) + (R.accProj ? '<div class="subs">+ ' + eu(R.accProj) + ' prévus</div>' : '') + '</td><td></td></tr>';
    } else {
      rows = '<tr><td>' + Y + '</td><td>Foyer (avis)</td><td class="r num">' + eu(R.av.sal.g + R.av.sal.s) + '</td><td>—</td><td class="r num">' + eu(R.av.pas) + '</td><td></td></tr>' +
        '<tr class="tx-proj"><td>' + Y + '</td><td>dont ' + esc(W.g) + (R.pas.est ? ' (estimé au prorata)' : '') + '</td><td class="r num">' + eu(R.av.sal.g) + '</td><td></td><td class="r num">' + eu(R.pas.g) + '</td><td></td></tr>' +
        '<tr class="tx-proj"><td>' + Y + '</td><td>dont ' + esc(W.s) + (R.pas.est ? ' (estimé au prorata)' : '') + '</td><td class="r num">' + eu(R.av.sal.s) + '</td><td></td><td class="r num">' + eu(R.pas.s) + '</td><td></td></tr>';
    }
    const nb = Object.keys(FI.bs).length;
    h += '<section class="panel" id="tx-pas-panel">' + tete('Prélèvement à la source', '<div class="row"><span class="muted" id="tx-bs-st">' + (nb ? nb + ' bulletin(s) lu(s)' : 'aucun bulletin lu') + '</span>' + boutonLire + '</div>') +
      '<div class="tablewrap"><table class="cats" id="tx-pas"><thead><tr><th>Paiement</th><th>Employeur</th><th class="r">Net imposable</th><th>Taux</th><th class="r">Prélevé</th><th class="r">Cumul</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      comment('Net imposable, taux, type de taux et montant prélevé de chaque bulletin de paie' + (o.lecture ? ' (lus par l\'ancienne version, ou par Claude avec « Lire un bulletin » : aperçu et confirmation avant enregistrement)' : ' (lus par l\'ancienne version)') + '. Chaque salaire est rattaché à l\'année de son paiement. Les mois restants sont projetés avec le dernier bulletin.') + '</section>';
    // calcul détaillé
    const av = R.kind === 'avis' ? R.av : null;
    const ck = (v, a) => av && a != null ? (Math.abs(v - a) <= 1 ? ' <span class="tx-ok" title="identique à l\'avis">✓</span>' : ' <span class="tx-ko" title="avis : ' + eu(a) + '">≠ ' + eu(a) + '</span>') : '';
    const L = (t, a, b, f, cls) => '<tr' + (cls ? ' class="' + cls + '"' : '') + '><td>' + t + '</td><td class="r num">' + (a == null ? '' : a) + '</td><td class="r num">' + (b == null ? '' : b) + '</td><td class="r num">' + (f == null ? '' : f) + '</td></tr>';
    let c = L('Salaires nets imposables', eu(R.inp.sal.g), eu(R.inp.sal.s), eu(R.inp.sal.g + R.inp.sal.s)) +
      L(Fo.g.fr || Fo.s.fr ? 'Frais réels ou abattement de 10 %' : 'Abattement de 10 %', 'moins ' + eu(Fo.g.abat) + (Fo.g.fr ? ' <span class="subs">réels</span>' : ''), 'moins ' + eu(Fo.s.abat) + (Fo.s.fr ? ' <span class="subs">réels</span>' : ''), '') +
      L('Salaires nets', eu(Fo.g.net), eu(Fo.s.net), eu(Fo.g.net + Fo.s.net)) + L('Revenus fonciers nets', '', '', eu(Fo.fonc)) +
      L('<b>Revenu imposable</b>', '', '', '<b>' + eu(Fo.B.rni) + '</b>' + ck(Fo.B.rni, av && av.rni)) + L('Quotient familial (2 parts)', '', '', eu(Fo.B.q));
    for (const [r, b, t] of Fo.B.tr) c += L('<span class="subs">tranche à ' + Math.round(r * 100) + ' % sur ' + eu(b) + ' par part</span>', '', '', eu(t));
    c += L('Impôt au barème', '', '', eu(Fo.B.brut) + ck(Fo.B.brut, av && av.irBar)) + L('Décote', '', '', (Fo.B.dec ? 'moins ' : '') + eu(Fo.B.dec) + ck(Fo.B.dec, av && av.decote)) +
      (Fo.prop ? L('Revenus de capitaux (' + eu(R.inp.rcm) + ' à 12,8 %, déjà prélevé par la banque)', '', '', eu(Fo.prop) + ' compensés') : '') +
      L('<b>Impôt sur le revenu net</b>', '', '', '<b>' + eu(Fo.irNet) + '</b>' + ck(Fo.irNet, av && av.irNet)) + L('Prélèvements sociaux sur revenus fonciers (17,2 %)', '', '', eu(Fo.ps) + ck(Fo.ps, av && av.ps)) +
      L('<b>Total</b>', '', '', '<b>' + eu(Fo.irNet + Fo.ps) + '</b>', 'total');
    h += '<section class="panel" id="tx-calc-panel">' + tete('Calcul détaillé', '<span class="muted" id="tx-calc-sub">' + (av ? 'revenus ' + Y + ' recalculés et comparés à l\'avis' : 'revenus ' + Y + ' : bulletins lus + projection + hypothèses') + '</span>') +
      '<div class="tablewrap"><table class="cats" id="tx-calc"><thead><tr><th></th><th class="r">' + esc(W.g) + '</th><th class="r">' + esc(W.s) + '</th><th class="r">Foyer</th></tr></thead><tbody>' + c + '</tbody></table></div>' +
      comment('Calcul officiel : salaires moins l\'abattement de 10 % (plancher et plafond par personne) ou les frais réels, plus les revenus fonciers nets, divisés par 2 parts ; barème progressif par part, multiplié par 2 ; décote des couples. Les ✓ indiquent les montants identiques à l\'avis.') + '</section>';
    // taux et partage
    const TI = KF().tauxIndiv(R.inp, Fo, P);
    h += '<section class="panel" id="tx-part-panel">' + tete('Taux et partage', '<label class="ctl" for="txPartage">Partage <select id="txPartage" aria-label="Règle de partage de l\'impôt">' + Object.entries(KF().PART_RULES).map(([kk, [l]]) => '<option value="' + kk + '"' + ((FI.hyp.partage || 'seul') === kk ? ' selected' : '') + '>' + esc(l) + '</option>').join('') + '</select></label>') +
      '<p class="note" id="tx-part-desc" style="margin:-4px 0 10px">' + esc(KF().PART_RULES[FI.hyp.partage || 'seul'][1]) + '.</p>' +
      '<div id="tx-taux"><div class="cr-r"><span class="cr-l">Taux du foyer ' + (R.kind === 'est' ? 'appliqué depuis septembre' : 'calculé') + '<span class="subs">' + (R.kind === 'est' ? 'janvier à août : ' + pct1(R.tauxOld) : 'impôt ÷ revenus soumis au prélèvement') + '</span></span><b>' + pct1(R.kind === 'est' ? R.tauxNew : Fo.taux) + '</b></div>' +
      (R.kind === 'est' ? '<div class="cr-r"><span class="cr-l">Taux qui couvrirait l\'impôt ' + Y + '</span><b>' + pct1(Fo.B.apres / Math.max(1, Fo.revPAS) * 100) + '</b></div>' : '') +
      '<div class="cr-r"><span class="cr-l">Taux individualisés (simulation)<span class="subs">même impôt total, réparti selon les revenus de chacun</span></span><b>' + esc(W.g.slice(0, 1)) + ' ' + pct1(TI.g) + ' · ' + esc(W.s.slice(0, 1)) + ' ' + pct1(TI.s) + '</b></div></div>' +
      '<div class="tablewrap"><table class="cats" id="tx-part"><thead><tr><th></th><th class="r">' + esc(W.g) + '</th><th class="r">' + esc(W.s) + '</th></tr></thead><tbody>' +
      '<tr><td>Revenus retenus</td><td class="r num">' + eu(SH.base.g) + '</td><td class="r num">' + eu(SH.base.s) + '</td></tr>' +
      '<tr><td>Impôt s\'il était imposé seul<div class="subs">pour comparer : ' + eu(SH.alone.g + SH.alone.s) + ' à deux, contre ' + eu(SH.IR) + ' en déclaration commune</div></td><td class="r num">' + eu(SH.alone.g) + '</td><td class="r num">' + eu(SH.alone.s) + '</td></tr>' +
      '<tr><td>Part de l\'impôt</td><td class="r num">' + pct1(SH.sh.g * 100) + '</td><td class="r num">' + pct1(SH.sh.s * 100) + '</td></tr>' +
      '<tr><td>Impôt dû (' + eu(R.total) + ')</td><td class="r num">' + eu(SH.due.g) + '</td><td class="r num">' + eu(SH.due.s) + '</td></tr>' +
      '<tr><td>Déjà payé' + (R.kind === 'est' ? ' ou prévu d\'ici décembre' : '') + '</td><td class="r num">' + eu(SH.paid.g) + '</td><td class="r num">' + eu(SH.paid.s) + '</td></tr>' +
      '<tr class="total"><td>' + (R.kind === 'est' ? 'Reste à payer' : 'Bilan') + '</td><td class="r">' + esc(KF().resteTexte(SH.rest.g)) + '</td><td class="r">' + esc(KF().resteTexte(SH.rest.s)) + '</td></tr></tbody></table></div>' +
      '<div class="tx-conc" id="tx-part-c"><b>' + esc(KF().texte(X, R, SH)) + '</b>' + (R.kind === 'avis' ? '<div class="subs">Prélèvement à la source : ' + esc(R.pasHow) + '.</div>' : '') + '</div></section>';
    h += taxeFonciere(B, X);
    // hypothèses
    if (R.kind === 'est') {
      const H = FI.hyp, prevAv = FI.avis[Y - 1];
      const inN = (kk, lab, ph) => '<label>' + esc(lab) + '<input type="text" data-hyp="' + kk + '" inputmode="decimal" value="' + (H[kk] != null ? esc(String(H[kk]).replace('.', ',')) : '') + '" placeholder="' + esc(ph) + '"></label>';
      const sel = (kk, lab, opts) => '<label>' + esc(lab) + '<select data-hyp="' + kk + '">' + opts.map(([v, t]) => '<option value="' + v + '"' + (String(H[kk]) === String(v) ? ' selected' : '') + '>' + esc(t) + '</option>').join('') + '</select></label>';
      h += '<section class="panel" id="tx-hyp-panel">' + tete('Hypothèses', '<span class="muted">estimation de l\'année en cours</span>') + '<div class="tx-hyp" id="tx-hyp">' +
        inN('salS', 'Salaires ' + Y + ' de ' + W.s + ' (net imposable)', String(R.inp.sal.s) + ' (' + R.sSrc + ')') +
        sel('fraisGm', 'Frais de ' + W.g, [['avis', 'Comme l\'avis ' + (Y - 1) + (prevAv && prevAv.fr && prevAv.fr.g ? ' (frais réels ' + prevAv.ded.g + ' €)' : ' (10 %)')], ['dix', 'Abattement de 10 %'], ['reel', 'Frais réels saisis ci-dessous']]) +
        inN('fraisG', 'Frais réels de ' + W.g + ' (€)', 'si « frais réels saisis »') + inN('fraisS', 'Frais réels de ' + W.s + ' (vide = 10 %)', '10 %') +
        inN('fonc', 'Revenus fonciers nets', String(R.inp.fonc)) + sel('foncA', 'Revenus fonciers de', [['b', 'moitié chacun'], ['g', W.g], ['s', W.s]]) +
        inN('rcm', 'Revenus de capitaux (intérêts, dividendes)', String(R.inp.rcm)) +
        inN('tauxOld', 'Taux de ' + W.g + ', janvier à août (%)', pct1(R.tauxOld).replace(' %', '') + ' (bulletins)') +
        inN('tauxNew', 'Taux de ' + W.g + ' depuis septembre (%)', pct1(R.tauxNewAuto).replace(' %', '') + ' (calculé)') +
        inN('tauxSOld', 'Taux de ' + W.s + ', janvier à août (%)', 'comme ' + W.g) + inN('tauxSNew', 'Taux de ' + W.s + ' depuis septembre (%)', 'comme ' + W.g) +
        sel('bareme', 'Barème', [['plf', 'Projet de loi de finances (indexé)'], ['gel', 'Barème gelé (sans indexation)']]) +
        inN('communG', 'Commun alimenté par ' + W.g + ' (%) pour les impôts', '50') + '</div></section>';
    }
    // avis et barèmes
    h += '<section class="panel" id="tx-src-panel">' + tete('Avis et barèmes', o.lecture ? '<button class="btn" type="button" data-lireavis="1">Lire un avis</button>' : '') +
      '<div id="tx-avis"><div class="tablewrap"><table class="cats"><thead><tr><th>Revenus</th><th class="r">Revenu imposable</th><th class="r">Impôt net</th><th class="r">Prélevé</th><th class="r">Solde</th><th>Solde payé par</th></tr></thead><tbody>' +
      Object.values(FI.avis).sort((a, b) => b.rev - a.rev).map(a => '<tr><td><b>' + a.rev + '</b><div class="subs">' + esc(a.src || '') + '</div></td><td class="r num">' + eu(a.rni) + '</td><td class="r num">' + eu(a.irNet) + '</td><td class="r num">' + eu(a.pas) + '</td><td class="r num">' + (a.solde < 0 ? 'remb. ' : '') + eu(a.solde) + '</td>' +
        '<td><select data-soldeby="' + a.rev + '" aria-label="Solde payé par">' + [['g', W.g], ['s', W.s], ['c', 'le commun']].map(([v, t]) => '<option value="' + v + '"' + ((FI.soldeBy[a.rev] || 'g') === v ? ' selected' : '') + '>' + esc(t) + '</option>').join('') + '</select></td></tr>').join('') + '</tbody></table></div></div>' +
      '<div class="tablewrap" style="margin-top:12px"><table class="cats" id="tx-bar"><thead><tr><th>Revenus</th><th>Texte</th><th>Tranches par part</th><th>Décote couple</th></tr></thead><tbody>' +
      Object.entries(KF().PARAMS).map(([y, p]) => '<tr><td><b>' + y + '</b> ' + (p.st === 'projet' ? chip('warn', 'projet') : chip('good', 'voté')) + '</td><td>' + esc(p.lab) + '<div class="subs">' + esc(p.src) + '</div></td><td class="subs">' + p.tr.map(([hi, r]) => Math.round(r * 100) + ' % ' + (hi === Infinity ? 'au-delà' : 'jusqu\'à ' + eu(hi))).join(' · ') + '</td><td class="num">' + (p.dec ? eu(p.dec.c) + ' − 45,25 %' : '') + '</td></tr>').join('') + '</tbody></table></div>' +
      comment((o.lecture ? '« Lire un avis » envoie le PDF choisi à Claude, qui en extrait les montants ; vous les vérifiez avant enregistrement. ' : '') + 'Le barème des revenus de l\'année en cours est celui du projet de loi de finances tant qu\'il n\'est pas voté.') + '</section>';
    return h;
  }

  function taxeFonciere(B, X) {
    const T = KF().taxeFonciere(X);
    if (!T) return '';
    const W = X.noms, TF = T.TF;
    const rows = T.lignes.map(R => '<tr><td><b>' + R.y + '</b></td><td>' + (R.kind === 'none' ? 'non imposé (' + esc(R.why) + ')' : R.exo ? 'exonération partielle (' + Math.round(R.exo * 100) + ' % de la base)' : 'taxe pleine') + '</td>' +
      '<td class="r num">' + (R.base ? eu(R.base) : '—') + '</td><td class="r num">' + (R.total ? (R.kind === 'avis' ? '' : '≈ ') + eu(R.total) : '—') + '</td><td>' + (R.total ? dfr(R.echeance) : '—') + '</td>' +
      '<td class="r num">' + (R.total ? eu(R.moi) : '—') + '</td><td class="r num">' + (R.total ? eu(R.autre) : '—') + '</td><td>' +
      (R.kind === 'none' ? chip('good', 'rien à payer') : R.payee ? chip('good', 'payée le ' + jjmm(R.payee)) : R.kind === 'avis' ? chip('info', 'avis reçu') : chip('warn', 'estimation')) + '</td></tr>').join('');
    const f = (kk, l) => '<label>' + esc(l) + '<input type="text" data-tf="' + kk + '" inputmode="decimal" value="' + (TF[kk] == null ? '' : esc(String(TF[kk]).replace('.', ','))) + '"></label>';
    return '<section class="panel" id="tf-panel">' + tete('Taxe foncière de l\'appartement', '<span class="muted">logement et stationnement · payée en une fois depuis le commun</span>') +
      '<div id="tf-body"><div class="tablewrap"><table class="cats"><thead><tr><th>Année</th><th>Situation</th><th class="r">Base nette</th><th class="r">Montant</th><th>Échéance</th><th class="r">' + esc(W.g) + '</th><th class="r">' + esc(W.s) + '</th><th>État</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<div class="cr-r"><span class="cr-l">Déclaration d\'achèvement (H2)<span class="subs">' + (TF.h2ok === 'oui' ? 'Logement enregistré sur impots.gouv : l\'exonération des deux premières années doit figurer sur le premier avis.' : 'À vérifier sur impots.gouv › Biens immobiliers : le logement doit apparaître avec l\'exonération de construction neuve.') + '</span></span><b>' + (TF.h2ok === 'oui' ? chip('good', 'confirmée') : chip('warn', 'à confirmer')) + '</b></div></div>' +
      '<h3 class="obs-h3" style="margin-top:14px">Paramètres</h3><div class="tx-hyp" id="tf-hyp">' + f('pg', 'Part de ' + W.g + ' (%)') +
      '<label>Déclaration H2<select data-tf="h2ok"><option value="non"' + (TF.h2ok !== 'oui' ? ' selected' : '') + '>à confirmer</option><option value="oui"' + (TF.h2ok === 'oui' ? ' selected' : '') + '>confirmée sur impots.gouv</option></select></label>' +
      f('surf', 'Surface (m²)') + f('baseM2', 'Base nette estimée (€/m²)') + f('basePk', 'Base nette du parking (€)') + f('tCom', 'Taux communal (%)') + f('tSpe', 'Taxes spéciales (%)') +
      f('tTeom', 'Ordures ménagères (%)') + f('exoCom', 'Exonération communale (% de la base)') + f('reval', 'Revalorisation des bases (% par an)') + '</div>' +
      '<h3 class="obs-h3" style="margin-top:14px">Saisir un avis de taxe foncière</h3><div class="pee-add"><label for="tfY">Année<input type="number" id="tfY" value="' + X.Y + '"></label><label for="tfT">Montant total à payer (€)<input type="text" inputmode="decimal" id="tfT"></label>' +
      '<label for="tfB">Base nette (facultatif)<input type="text" inputmode="decimal" id="tfB"></label><button class="btn primary" type="button" data-tfavis="1">Enregistrer l\'avis</button></div>' +
      '<div id="tf-avis-list">' + (Object.keys(TF.avis || {}).length ? '<p class="note">Avis saisis : ' + Object.entries(TF.avis).sort().map(([y, a]) => y + ' : ' + eu2(a.total) + (a.base ? ' (base ' + eu(a.base) + ')' : '')).join(' · ') + '</p>' : '') + '</div>' +
      comment('Taxe = base nette (moitié de la valeur locative cadastrale) × taux, plus frais de gestion (3 %), et taxe d\'ordures ménagères sur la même base (frais de 8 %). Logement neuf : exonération partielle de la part communale les deux premières années si la déclaration d\'achèvement a été faite à temps.') + '</section>';
  }

  // ------------------------------------------------------------ épargne : livret et PEE (écran Épargne)
  function epargne(B) {
    const X = KF().contexte(B);
    const Lv = KF().livret(B), I = KF().livretInterets(B);
    const D = (B.S.budget && B.S.budget.livret) || {};
    // Livret : en fin d'écran, après le PEE (ordre de l'ancienne version).
    const lv = '<section class="panel" id="lv-panel">' + tete('Livret', '<span class="muted">solde non transmis par la banque</span>') +
      (Lv ? '<div class="kpis">' + kp('Solde estimé', eu2(Lv.centimes / 100), 'saisi ' + eu2(Lv.base / 100) + ' le ' + dfr(Lv.date) + (Lv.n ? ' + ' + Lv.n + ' virement(s)' : '')) +
        kp('Intérêts ' + (I ? I.annee : X.Y), I ? '≈ ' + eu2(I.centimes / 100) : '—', I ? 'au taux de ' + pct1(I.taux) + ', par quinzaine' : 'saisissez le taux du livret') + '</div>'
        : '<p class="muted">Saisissez le solde affiché par la banque pour le suivre.</p>') +
      '<div class="pee-add"><label for="lvBase">Solde affiché par la banque (€)<input type="text" inputmode="decimal" id="lvBase" placeholder="montant"></label><label for="lvDate">À la date du<input type="date" id="lvDate" value="' + B.auj + '"></label>' +
      '<button class="btn primary" type="button" data-lv="1">Enregistrer le solde</button></div>' +
      '<div class="pee-add"><label for="lvTaux">Taux annuel du livret (%)<input type="text" inputmode="decimal" id="lvTaux" value="' + (D.taux != null ? esc(String(D.taux).replace('.', ',')) : '') + '" placeholder="ex. 1,5"></label><button class="btn" type="button" data-lvtaux="1">Enregistrer le taux</button></div>' +
      comment('Solde estimé = solde saisi + virements vers le livret repérés sur le compte principal depuis. Intérêts : un versement rapporte à partir de la quinzaine suivante, un retrait cesse de rapporter dès la quinzaine en cours ; estimation au taux saisi, versée en fin d\'année.') + '</section>';
    const C = KF().pee(X);
    const pl = C ? C.PEE.plan : {};
    let h = '<section class="panel eq-hero" id="pee-hero" aria-label="Synthèse du PEE"><div class="panel-h"><h2>Plan d\'épargne entreprise</h2><span class="muted">' + esc(pl.emp || '') + (pl.teneur ? ' · ' + esc(pl.teneur) : '') + '</span></div>';
    if (C && C.PEE.vers.length) h += '<div class="kpis">' + kp('Encours', eu(C.val), C.PEE.fonds.length + ' fonds') + kp('Vos versements', eu(C.perso), 'dont ' + eu(C.volY) + ' en ' + X.Y) + kp('Abondement reçu', eu(C.ab), eu(C.abY) + ' en ' + X.Y) +
      kp(C.pv >= 0 ? 'Plus-value' : 'Moins-value', eu(C.pv), C.mt > 0 ? pct1(Math.abs(C.pv) / C.mt * 100) + ' du versé' : '', C.pv >= 0 ? 'pos-t' : 'bad-t') + kp('Performance annuelle', C.tri != null ? (C.tri < 0 ? 'baisse de ' : '') + pct1(Math.abs(C.tri) * 100) : '—', 'taux de rendement interne') + '</div>';
    else h += '<p class="note" style="margin-top:0">Le PEE n\'est pas encore ouvert. Pour démarrer : récupérez le règlement du plan et la liste des fonds (documents d\'information clés), renseignez la règle d\'abondement ci-dessous, puis ajoutez les fonds et vos versements.</p>' +
      '<ol class="pee-steps"><li>Règlement du PEE et accord d\'intéressement ou de participation.</li><li>Taux et plafond de l\'abondement, délai d\'ancienneté.</li><li>Liste des fonds avec leur niveau de risque (1 à 7) et leur valeur de part.</li><li>Premier versement, de préférence au niveau qui capte tout l\'abondement.</li></ol>';
    for (const c of (C && C.PEE.closed) || []) {
      const d = c.out - c.inv;
      h += '<div class="cr-r"><span class="cr-l">Ancien PEE' + (c.emp ? ' ' + esc(c.emp) : '') + ' · soldé le ' + dfr(c.dOut) + '<span class="subs">' + esc(c.note || '') + ' : ' + eu2(c.inv) + ' placés, ' + eu2(c.out) + ' reçus, soit ' + eu2(Math.abs(d)) + (d < 0 ? ' de moins' : ' de plus') + ' que le montant placé. Aucun impôt : le rachat d\'un PEE est exonéré d\'impôt sur le revenu' + (d <= 0 ? ' et, sans plus-value, de prélèvements sociaux' : '') + '.</span></span><b>' + eu2(c.out) + '</b></div>';
    }
    h += '</section>';
    if (C) h += '<section class="panel obs-panel" id="pee-obs">' + tete('Recommandations', '<span class="muted">règles générales, à confirmer avec le règlement du plan</span>') + '<ul class="alerts" id="pee-alerts">' + C.conseils.map(li).join('') + '</ul></section>';
    const f = (kk, l, t, ph) => '<label>' + esc(l) + '<input data-pl="' + kk + '"' + (t === 'date' ? ' type="date"' : ' type="text" inputmode="' + (t === 'n' ? 'decimal' : 'text') + '"') + ' value="' + esc(pl[kk] == null ? '' : pl[kk]) + '" placeholder="' + esc(ph || '') + '"></label>';
    h += '<section class="panel" id="pee-plan-panel">' + tete('Règles du plan', '<span class="muted">d\'après le règlement du PEE</span>') + '<div class="tx-hyp" id="pee-plan">' +
      f('emp', 'Employeur', 't') + f('teneur', 'Teneur de compte', 't', 'ex. gestionnaire du plan') + f('entree', 'Date d\'entrée', 'date') + f('anc', 'Ancienneté requise (mois)', 'n', '3') +
      f('abTaux', 'Abondement (% des versements)', 'n', 'ex. 100') + f('abPlaf', 'Abondement maximal par an (€)', 'n', 'ex. 1 500') + f('dispo', 'Durée de blocage (ans)', 'n', '5') + '</div></section>';
    const CAT = { mon: 'Monétaire', obl: 'Obligataire', div: 'Diversifié', act: 'Actions', emp: 'Actionnariat salarié', sol: 'Solidaire' };
    const ORIG = { vol: 'Versement volontaire', int: 'Intéressement', part: 'Participation', abond: 'Abondement', transf: 'Transfert' };
    const fonds = (C && C.PEE.fonds) || [], vers = (C && C.PEE.vers) || [];
    h += '<section class="panel" id="pee-fonds-panel">' + tete('Fonds', '<span class="muted">valeur de part à mettre à jour depuis le relevé</span>') +
      '<div class="tablewrap"><table class="cats" id="pee-fonds"><thead><tr><th>Fonds</th><th>Catégorie</th><th class="r">Risque</th><th class="r">Valeur de part</th><th class="r">Encours</th></tr></thead><tbody>' +
      (fonds.length ? fonds.map(fd => { const b = C.byF[fd.id]; return '<tr><td><b>' + esc(fd.nom) + '</b></td><td>' + esc(CAT[fd.cat] || '') + '</td><td class="r num">' + (fd.sri || '—') + '/7</td><td class="r"><input type="text" inputmode="decimal" data-vl="' + esc(fd.id) + '" value="' + (fd.vl ? String(fd.vl).replace('.', ',') : '') + '" aria-label="Valeur de part"><div class="subs">' + (fd.vlDate ? dfr(fd.vlDate) : '') + '</div></td><td class="r num">' + eu(b ? b.val : 0) + '</td></tr>'; }).join('') : '<tr><td colspan="5" class="muted">Aucun fonds.</td></tr>') + '</tbody></table></div>' +
      '<div class="pee-add"><label for="pfNom">Nom du fonds<input type="text" id="pfNom" placeholder="ex. Fonds diversifié"></label><label for="pfCat">Catégorie<select id="pfCat">' + Object.keys(CAT).map(kk => '<option value="' + kk + '"' + (kk === 'div' ? ' selected' : '') + '>' + CAT[kk] + '</option>').join('') + '</select></label>' +
      '<label for="pfSri">Risque (1 à 7)<input type="number" id="pfSri" min="1" max="7" step="1"></label><label for="pfVl">Valeur de part (€)<input type="text" inputmode="decimal" id="pfVl"></label><button class="btn primary" type="button" data-pf="1">Ajouter le fonds</button></div></section>';
    h += '<section class="panel" id="pee-vers-panel">' + tete('Versements', '<span class="muted">volontaires, intéressement, participation, abondement</span>') +
      '<div class="tablewrap"><table class="cats" id="pee-vers"><thead><tr><th>Date</th><th>Origine</th><th>Fonds</th><th class="r">Montant</th><th class="r">Parts</th><th>Disponible</th><th></th></tr></thead><tbody>' +
      (vers.length ? vers.slice().sort((a, b) => a.d < b.d ? 1 : -1).map(v => { const fd = fonds.find(x => x.id === v.fid); return '<tr><td>' + dfr(v.d) + '</td><td>' + esc(ORIG[v.orig] || v.orig) + '</td><td>' + esc(fd ? fd.nom : '?') + '</td><td class="r num">' + eu2(v.mt) + '</td><td class="r num">' + (v.parts > 0 ? v.parts.toLocaleString('fr-FR', { maximumFractionDigits: 4 }) : '—') + '</td><td>' + dfr(v.dispo || ((+v.d.slice(0, 4) + (pl.dispo || 5)) + v.d.slice(4))) + '</td><td><button class="btn sm" type="button" data-rmv="' + esc(v.id) + '">Retirer</button></td></tr>'; }).join('')
        : '<tr><td colspan="7" class="muted">Aucun versement.</td></tr>') + '</tbody></table></div>' +
      ('<div class="pee-add"><label for="pvDate">Date<input type="date" id="pvDate"></label><label for="pvOrig">Origine<select id="pvOrig">' + Object.keys(ORIG).map(kk => '<option value="' + kk + '">' + ORIG[kk] + '</option>').join('') + '</select></label>' +
        '<label for="pvFonds">Fonds<select id="pvFonds">' + (fonds.length ? fonds.map(fd => '<option value="' + esc(fd.id) + '">' + esc(fd.nom) + '</option>').join('') : '<option value="">— ajoutez un fonds —</option>') + '</select></label><label for="pvMt">Montant (€)<input type="text" inputmode="decimal" id="pvMt"></label>' +
        '<label for="pvParts">Parts (facultatif)<input type="text" inputmode="decimal" id="pvParts"></label><button class="btn primary" type="button" data-pv="1">Ajouter le versement</button></div>') +
      comment('Encours : nombre de parts × dernière valeur de part saisie (à défaut, montant versé). Performance annuelle : taux de rendement interne de tous les versements (abondement compris) jusqu\'à aujourd\'hui. Disponibilité : date du versement + durée de blocage du plan, sauf date propre au règlement.') + '</section>';
    return h + lv;
  }

  // ------------------------------------------------------------ observations
  function observations(B, scope) {
    const O = KO().observations(B, scope);
    const SC = { perso: 'Perso', commun: 'Commun', all: 'Général' };
    const it = (a, faire) => '<li class="obs ' + a.niveau + '">' + chip(a.niveau, LV[a.niveau]) + '<div><b>' + esc(a.titre) + '</b> <small class="chip">' + SC[a.scope] + '</small><p>' + esc(a.texte) + '</p>' +
      (faire ? '<button class="lien" data-fait="' + esc(a.titre) + '">c\'est fait</button>' : '') + '</div></li>';
    let h = '<h4>À faire</h4>' + (O.faire.length ? '<ul class="obsl">' + O.faire.map(a => it(a, true)).join('') + '</ul>' : '<p class="muted">Aucune action en attente, sur vos comptes comme sur le compte commun.</p>');
    if (O.masques.length) h += '<p class="muted small">' + O.masques.length + ' point(s) marqué(s) « fait » : ' + O.masques.map(a => esc(a.titre)).join(' · ') + ' <button class="lien" data-reafficher="1">réafficher</button></p>';
    h += '<h4>Observations</h4><ul class="obsl">' + (O.infos.length ? O.infos.map(a => it(a, false)).join('') : '<li class="muted">Aucune observation.</li>') + '</ul>';
    return h + '<p class="muted small">Audit du ' + dfr(B.auj) + ' · vos comptes et le compte commun. « C\'est fait » masque un point jusqu\'à ce que la situation se reproduise.</p>';
  }

  // ------------------------------------------------------------ résultats d'une période et répartition
  function resultats(B, scope, nav) {
    const P = KO().periodePrecedente(B, scope, nav), R = KO().resultats(B, scope, P), C = B.cx.C;
    const ec = (p, r, rev) => { let d = rev ? r - p : p - r; if (Math.abs(d) < 50) d = 0; return d < 0 ? '<span class="bad">' + e0(-d) + (rev ? ' de moins' : ' de plus') + '</span>' : d > 0 ? '<span class="ok">' + e0(d) + (rev ? ' de plus' : ' de moins') + '</span>' : 'conforme'; };
    const ligne = (nat, lab, p, r, rev) => '<li><span class="nat ' + nat + '"></span><div class="grow">' + esc(lab) + '<small>budget ' + (p > 50 ? e0(p) : '—') + ' · ' + (rev ? 'reçu ' : 'consommé ') + e0(r) + '</small></div><span class="small">' + ec(p, r, rev) + '</span></li>';
    let h = '<p><b>' + esc(P.titre) + '</b> · du ' + dfr(P.start) + ' au ' + dfr(P.end) + '</p><ul class="list resl">' +
      ligne('rev', scope === 'commun' ? 'Apports' : 'Revenus', R.expRev, R.rev, true) +
      ligne('fixe', 'Charges fixes', R.G.fixe.p, R.G.fixe.r) + ligne('courante', 'Dépenses courantes', R.G.courante.p, R.G.courante.r) + ligne('optionnelle', 'Dépenses optionnelles', R.G.optionnelle.p, R.G.optionnelle.r) +
      (R.HBR > 50 ? ligne('hb', 'Hors budget', 0, R.HBR) : '') + '</ul>';
    const solde = v => v < -50 ? '<span class="bad">' + e0(-v) + ' de dépenses au-delà des revenus</span>' : '<span class="ok">' + e0(Math.max(0, v)) + ' restant</span>';
    h += '<div class="carte bsolde"><b>Solde de la période</b><div class="grand">' + solde(R.net) + '</div><div class="rangee"><span>Prévu par le budget</span><span>' + solde(R.netP) + '</span></div>' +
      (scope === 'commun' ? '' : '<div class="rangee"><span>Épargne réalisée</span><span>' + e0(R.sav) + '</span></div>') +
      '<div class="rangee"><span>Total des dépenses</span><span>' + e0(R.depR) + ' pour ' + e0(R.depP) + ' de budget</span></div>' + (R.OUT > 50 ? '<div class="rangee"><span class="hb">dont hors budget et dépassements</span><span>' + e0(R.OUT) + '</span></div>' : '') + '</div>';
    h += '<h4>Plus gros écarts</h4>' + (R.over.length ? '<ol class="ecarts">' + R.over.slice(0, 3).map(o => '<li>' + esc(K().iconeDe(C, o.cat)) + ' <b>' + esc(o.label) + '</b> ' + (o.budget > 50 ? '<span class="bad">' + e0(o.ecart) + ' de plus</span> <small class="muted">(' + e0(o.reel) + ' consommés pour ' + e0(o.budget) + ' de budget)</small>' : '<span class="hb">' + e0(o.ecart) + ' hors budget</span>') + '</li>').join('') + '</ol>' : '<p class="muted">Aucun dépassement : budget tenu.</p>');
    h += repartition(B, scope, P.start, P.end, 'Répartition des dépenses de la période');
    const per = KB().periode(B, scope, null);
    if (!(nav && per.past)) h += repartition(B, scope, per.start, per.upto, 'Répartition des dépenses en cours');
    return h;
  }
  function repartition(B, scope, start, end, titre) {
    const R = KO().repartition(B, scope, start, end);
    if (R.total < 50) return '<h4>' + esc(titre) + '</h4><p class="muted">Aucune dépense.</p>';
    const NC = { fixe: 'var(--nfix)', courante: 'var(--ncour)', optionnelle: 'var(--nopt)' }, NOMS = { fixe: 'Charges fixes', courante: 'Dépenses courantes', optionnelle: 'Dépenses optionnelles' };
    const CC = ['#5b6ee1', '#0e9aa7', '#c2a600', '#d97706', '#a61e4d', '#868e96', '#1864ab', '#9ca3af'];
    const barre = parts => '<div class="split">' + parts.map(p => '<span style="flex:' + p.v + ';background:' + p.c + '"></span>').join('') + '</div><p class="legende small">' + parts.map(p => '<span><i style="background:' + p.c + '"></i>' + esc(p.k) + ' ' + Math.round(100 * p.v / R.total) + ' %</span>').join('') + '</p>';
    return '<h4>' + esc(titre) + ' · ' + e0(R.total) + '</h4>' + barre(R.natures.map(n => ({ k: NOMS[n.k], v: n.v, c: NC[n.k] }))) + barre(R.categories.map((c, i) => ({ k: c.k, v: c.v, c: CC[i] || CC[7] })));
  }

  g.KladVuesFisc = { impots, taxeFonciere, epargne, observations, resultats, repartition };
})(typeof window !== 'undefined' ? window : globalThis);
