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
  const eu = n => Math.round(Math.abs(+n || 0)).toLocaleString('fr-FR').replace(/[  ]/g, ' ') + ' €';       // euros (module fiscal)
  const eu2 = n => Math.abs(+n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/[  ]/g, ' ') + ' €';
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

  // ------------------------------------------------------------ impôts
  function impots(B, ui) {
    const X = KF().contexte(B), FI = X.FI;
    const years = [X.Y, ...Object.keys(FI.avis).map(Number).filter(y => y < X.Y).sort((a, b) => b - a)];
    const Y = years.indexOf(ui && ui.annee) >= 0 ? ui.annee : years.indexOf(FI.year) >= 0 ? FI.year : years[0];
    if (!Object.keys(FI.avis).length && !Object.keys(FI.bs).length) return '<p class="muted">Aucune donnée fiscale : l\'avis d\'impôt et les bulletins de paie lus par l\'ancienne version arrivent avec la reprise (carnet). La lecture de nouveaux avis et bulletins viendra au Lot 9.</p>' + taxeFonciere(B, X);
    const R = KF().annee(X, Y), Fo = R.F, P = R.P, SH = KF().partage(X, R), W = X.noms;
    let h = '<div class="seg defile-seg" role="group" aria-label="Année des revenus">' + years.map(y => '<button data-txy="' + y + '" aria-pressed="' + (y === Y) + '">' + y + (y === X.Y && !FI.avis[y] ? ' (estimation)' : ' (avis)') + '</button>').join('') + '</div>';
    h += '<div class="kpis">';
    if (R.kind === 'est') {
      h += kpi('Impôt ' + Y + ' estimé', eu(R.total), 'impôt ' + eu(Fo.B.apres) + ' + prél. sociaux ' + eu(Fo.ps)) +
        kpi('Déjà prélevé', eu(R.paid), 'dont ' + esc(W.s) + ' ' + eu(R.pasSPaid) + (R.bs.length ? '' : ' (estimation)')) +
        kpi('Encore prélevé d\'ici décembre', eu(R.toCome), R.nRest + ' salaire(s) de ' + esc(W.g) + ', ' + esc(W.s) + ', acomptes') +
        kpi(R.solde >= 0 ? 'Solde à payer' : 'Remboursement', eu(R.solde), R.solde >= 0 ? 'septembre ' + (Y + 1) + (R.solde > 300 ? ', en 4 fois' : '') : 'été ' + (Y + 1), R.solde > 300 ? 'bad' : R.solde < 0 ? 'ok' : '') +
        kpi('Taux du foyer', pct1(R.tauxNew), 'il faudrait ' + pct1(Fo.B.apres / Math.max(1, Fo.revPAS) * 100));
    } else {
      h += kpi('Impôt ' + Y, eu(R.total), 'impôt ' + eu(R.av.irNet) + ' + prél. sociaux ' + eu(R.av.ps)) +
        kpi('Prélevé à la source', eu(R.av.pas), 'retenue des employeurs en ' + Y) +
        kpi(R.av.solde >= 0 ? 'Solde' : 'Remboursement', eu(R.av.solde), R.av.solde >= 0 ? 'à payer à partir de septembre ' + (Y + 1) : 'versé en ' + (Y + 1)) +
        kpi('Taux moyen', pct1(R.av.tmoy || 0), 'taux marginal ' + (R.av.tmi || 0) + ' %') +
        kpi('Revenu fiscal de référence', eu(R.av.rfr || 0), (R.av.parts || 2) + ' parts');
    }
    h += '</div><p class="muted small">' + (P.st === 'projet' ? chip('warn', 'barème en projet') : chip('good', 'barème voté')) + ' ' + esc(P.lab) + ' · déclaration commune, 2 parts · tranche marginale ' + Fo.B.tmi + ' %' + (Fo.B.dec ? ' · décote ' + eu(Fo.B.dec) : '') + '</p>';
    // régularisations
    const RG = KF().regularisations(X);
    h += '<h4>À régulariser entre vous</h4><ul class="list">' + RG.map(r => '<li><div class="grow">' + esc(r.per) + '<small>' + esc(r.kind === 'avis' ? (r.done ? 'Rien à régulariser.' : 'Partage : ' + KF().PART_RULES[FI.hyp.partage || 'seul'][0].toLowerCase() + '.') : r.txt) + '</small></div><b class="small">' +
      (r.kind === 'avis' ? (r.done ? 'à jour' : esc(W[r.from]) + ' verse ' + eu(r.amt) + ' à ' + esc(W[r.to])) : (r.solde >= 0 ? 'solde d\'environ ' + eu(r.solde) : 'remboursement d\'environ ' + eu(r.solde))) + '</b></li>').join('') + '</ul>';
    // observations
    const AL = KF().alertes(X, R);
    h += '<h4>Observations</h4><ul class="obsl">' + AL.map(alerte).join('') + '</ul>';
    // prélèvement à la source
    let rows = '';
    const tchip = t => t === 'neutre' ? chip('warn', 'non personnalisé') : t === 'indiv' ? chip('info', 'individualisé') : chip('good', 'personnalisé');
    if (R.kind === 'est') {
      let cum = 0;
      for (const b of R.bg) { cum += b.pas; rows += '<li><div class="grow">' + dfr(b.pay) + ' · ' + esc(b.emp) + '<small>salaire ' + mLabel(b.m) + ' · net imposable ' + eu2(b.ni) + ' · ' + pct1(b.taux) + ' ' + tchip(b.type) + '</small></div><span class="m">' + eu2(b.pas) + '<small class="muted block">cumul ' + eu(cum) + '</small></span></li>'; }
      if (R.nRest && R.bg.length) rows += '<li class="proj"><div class="grow">Jusqu\'à décembre · ' + esc(R.bg[R.bg.length - 1].emp) + ' (prévu)<small>' + eu(R.projG) + ' à ' + pct1(R.tauxNew) + '</small></div><span class="m">' + eu(R.projPasG) + '</span></li>';
      let cs = 0;
      for (const b of R.bs) { cs += b.pas; rows += '<li><div class="grow">' + dfr(b.pay) + ' · ' + esc(W.s) + ' · ' + esc(b.emp) + '<small>salaire ' + mLabel(b.m) + ' · net imposable ' + eu2(b.ni) + ' · ' + pct1(b.taux) + ' ' + tchip(b.type) + '</small></div><span class="m">' + eu2(b.pas) + '</span></li>'; }
      rows += '<li class="proj"><div class="grow">' + Y + ' · ' + esc(W.s) + ' (' + esc(R.sSrc) + ')<small>' + eu(R.inp.sal.s) + ' · ' + (R.bs.length ? pct1(R.tSNew) : pct1(R.tSOld) + ' puis ' + pct1(R.tSNew)) + '</small></div><span class="m">' + eu(R.pas.s) + '</span></li>';
      if (R.acompte || R.accProj) rows += '<li><div class="grow">' + Y + ' · acomptes (compte commun)<small>revenus fonciers' + (R.accProj ? ' · ' + eu(R.accProj) + ' prévus' : '') + '</small></div><span class="m">' + eu2(R.acompte) + '</span></li>';
    } else {
      rows = '<li><div class="grow">' + Y + ' · foyer (avis)<small>salaires ' + eu(R.av.sal.g + R.av.sal.s) + '</small></div><span class="m">' + eu(R.av.pas) + '</span></li>' +
        '<li class="proj"><div class="grow">dont ' + esc(W.g) + (R.pas.est ? ' (estimé au prorata)' : '') + '</div><span class="m">' + eu(R.pas.g) + '</span></li>' +
        '<li class="proj"><div class="grow">dont ' + esc(W.s) + (R.pas.est ? ' (estimé au prorata)' : '') + '</div><span class="m">' + eu(R.pas.s) + '</span></li>';
    }
    h += '<h4>Prélèvement à la source</h4><ul class="list">' + rows + '</ul><p class="muted small">' + Object.keys(FI.bs).length + ' bulletin(s) lu(s) par l\'ancienne version. La lecture des nouveaux bulletins viendra au Lot 9.</p>';
    // calcul détaillé
    const av = R.kind === 'avis' ? R.av : null;
    const ck = (v, a) => av && a != null ? (Math.abs(v - a) <= 1 ? ' <span class="ok" title="identique à l\'avis">✓</span>' : ' <span class="bad">avis : ' + eu(a) + '</span>') : '';
    const L = (t, a, b, f, cls) => '<tr' + (cls ? ' class="' + cls + '"' : '') + '><th>' + t + '</th><td>' + (a == null ? '' : a) + '</td><td>' + (b == null ? '' : b) + '</td><td>' + (f == null ? '' : f) + '</td></tr>';
    let c = L('Salaires nets imposables', eu(R.inp.sal.g), eu(R.inp.sal.s), eu(R.inp.sal.g + R.inp.sal.s)) +
      L('moins ' + (Fo.g.fr || Fo.s.fr ? 'frais réels ou abattement de 10 %' : 'abattement de 10 %'), eu(Fo.g.abat) + (Fo.g.fr ? ' <small>réels</small>' : ''), eu(Fo.s.abat) + (Fo.s.fr ? ' <small>réels</small>' : ''), '') +
      L('Salaires nets', eu(Fo.g.net), eu(Fo.s.net), eu(Fo.g.net + Fo.s.net)) +
      L('plus revenus fonciers nets', '', '', eu(Fo.fonc)) +
      L('<b>Revenu imposable</b>', '', '', '<b>' + eu(Fo.B.rni) + '</b>' + ck(Fo.B.rni, av && av.rni)) +
      L('Quotient familial (2 parts)', '', '', eu(Fo.B.q));
    for (const [r, b, t] of Fo.B.tr) c += L('<small>tranche à ' + Math.round(r * 100) + ' % sur ' + eu(b) + ' par part</small>', '', '', eu(t));
    c += L('Impôt au barème', '', '', eu(Fo.B.brut) + ck(Fo.B.brut, av && av.irBar)) +
      L('moins décote', '', '', eu(Fo.B.dec) + ck(Fo.B.dec, av && av.decote)) +
      (Fo.prop ? L('Revenus de capitaux (' + eu(R.inp.rcm) + ' à 12,8 %, déjà prélevé par la banque)', '', '', eu(Fo.prop) + ' compensés') : '') +
      L('<b>Impôt sur le revenu net</b>', '', '', '<b>' + eu(Fo.irNet) + '</b>' + ck(Fo.irNet, av && av.irNet)) +
      L('plus prélèvements sociaux sur revenus fonciers (17,2 %)', '', '', eu(Fo.ps) + ck(Fo.ps, av && av.ps)) +
      L('<b>Total</b>', '', '', '<b>' + eu(Fo.irNet + Fo.ps) + '</b>', 'rvt');
    h += '<details class="ccard"><summary><b>Calcul détaillé</b><span>' + (av ? 'comparé à l\'avis' : 'bulletins + projection') + '</span></summary><div class="ccb"><table class="ravt fisct"><thead><tr><th></th><th>' + esc(W.g) + '</th><th>' + esc(W.s) + '</th><th>Foyer</th></tr></thead><tbody>' + c + '</tbody></table></div></details>';
    // taux et partage
    const TI = KF().tauxIndiv(R.inp, Fo, P);
    h += '<details class="ccard" open><summary><b>Taux et partage entre vous</b><span></span></summary><div class="ccb">' +
      '<div class="rangee"><span>Taux du foyer ' + (R.kind === 'est' ? 'appliqué depuis septembre' : 'calculé') + '<small class="muted block">' + (R.kind === 'est' ? 'janvier à août : ' + pct1(R.tauxOld) : 'impôt ÷ revenus soumis au prélèvement') + '</small></span><b>' + pct1(R.kind === 'est' ? R.tauxNew : Fo.taux) + '</b></div>' +
      (R.kind === 'est' ? '<div class="rangee"><span>Taux qui couvrirait l\'impôt ' + Y + '</span><b>' + pct1(Fo.B.apres / Math.max(1, Fo.revPAS) * 100) + '</b></div>' : '') +
      '<div class="rangee"><span>Taux individualisés (simulation)<small class="muted block">même impôt total, réparti selon les revenus de chacun</small></span><b>' + esc(W.g) + ' ' + pct1(TI.g) + ' · ' + esc(W.s) + ' ' + pct1(TI.s) + '</b></div>' +
      '<label>Règle de partage<select id="txPartage">' + Object.entries(KF().PART_RULES).map(([k, [l]]) => '<option value="' + k + '"' + ((FI.hyp.partage || 'seul') === k ? ' selected' : '') + '>' + esc(l) + '</option>').join('') + '</select></label><p class="muted small">' + esc(KF().PART_RULES[FI.hyp.partage || 'seul'][1]) + '.</p>' +
      '<table class="ravt"><thead><tr><th></th><th>' + esc(W.g) + '</th><th>' + esc(W.s) + '</th></tr></thead><tbody>' +
      '<tr><th>Revenus retenus</th><td>' + eu(SH.base.g) + '</td><td>' + eu(SH.base.s) + '</td></tr>' +
      '<tr><th>Impôt s\'il était imposé seul<small>' + eu(SH.alone.g + SH.alone.s) + ' à deux, contre ' + eu(SH.IR) + ' en déclaration commune</small></th><td>' + eu(SH.alone.g) + '</td><td>' + eu(SH.alone.s) + '</td></tr>' +
      '<tr><th>Part de l\'impôt</th><td>' + pct1(SH.sh.g * 100) + '</td><td>' + pct1(SH.sh.s * 100) + '</td></tr>' +
      '<tr><th>Impôt dû (' + eu(R.total) + ')</th><td>' + eu(SH.due.g) + '</td><td>' + eu(SH.due.s) + '</td></tr>' +
      '<tr><th>Déjà payé' + (R.kind === 'est' ? ' ou prévu d\'ici décembre' : '') + '</th><td>' + eu(SH.paid.g) + '</td><td>' + eu(SH.paid.s) + '</td></tr>' +
      '<tr class="rvt"><th>' + (R.kind === 'est' ? 'Reste à payer' : 'Bilan') + '</th><td>' + KF().resteTexte(SH.rest.g) + '</td><td>' + KF().resteTexte(SH.rest.s) + '</td></tr></tbody></table>' +
      '<p><b>' + esc(KF().texte(X, R, SH)) + '</b></p>' + (R.kind === 'avis' ? '<p class="muted small">Prélèvement à la source : ' + esc(R.pasHow) + '.</p>' : '') + '</div></details>';
    // hypothèses
    if (R.kind === 'est') {
      const H = FI.hyp, prevAv = FI.avis[Y - 1];
      const inN = (k, lab, ph) => '<label>' + lab + '<input data-hyp="' + k + '" inputmode="decimal" value="' + (H[k] != null ? esc(String(H[k]).replace('.', ',')) : '') + '" placeholder="' + esc(ph) + '"></label>';
      const sel = (k, lab, opts) => '<label>' + lab + '<select data-hyp="' + k + '">' + opts.map(([v, t]) => '<option value="' + v + '"' + (String(H[k]) === String(v) ? ' selected' : '') + '>' + esc(t) + '</option>').join('') + '</select></label>';
      h += '<details class="ccard"><summary><b>Hypothèses ' + Y + '</b><span>modifiables</span></summary><div class="ccb grp">' +
        inN('salS', 'Salaires ' + Y + ' de ' + W.s + ' (net imposable)', String(R.inp.sal.s) + ' (' + R.sSrc + ')') +
        sel('fraisGm', 'Frais de ' + W.g, [['avis', 'Comme l\'avis ' + (Y - 1) + (prevAv && prevAv.fr && prevAv.fr.g ? ' (frais réels ' + prevAv.ded.g + ' €)' : ' (10 %)')], ['dix', 'Abattement de 10 %'], ['reel', 'Frais réels saisis ci-dessous']]) +
        inN('fraisG', 'Frais réels de ' + W.g + ' (€)', 'si « frais réels saisis »') + inN('fraisS', 'Frais réels de ' + W.s + ' (vide = 10 %)', '10 %') +
        inN('fonc', 'Revenus fonciers nets', String(R.inp.fonc)) + sel('foncA', 'Revenus fonciers de', [['b', 'moitié chacun'], ['g', W.g], ['s', W.s]]) +
        inN('rcm', 'Revenus de capitaux (intérêts, dividendes)', String(R.inp.rcm)) +
        inN('tauxOld', 'Taux de ' + W.g + ', janvier à août (%)', pct1(R.tauxOld).replace(' %', '') + ' (bulletins)') +
        inN('tauxNew', 'Taux de ' + W.g + ' depuis septembre (%)', pct1(R.tauxNewAuto).replace(' %', '') + ' (calculé)') +
        inN('tauxSOld', 'Taux de ' + W.s + ', janvier à août (%)', 'comme ' + W.g) + inN('tauxSNew', 'Taux de ' + W.s + ' depuis septembre (%)', 'comme ' + W.g) +
        sel('bareme', 'Barème', [['plf', 'Projet de loi de finances (indexé)'], ['gel', 'Barème gelé (sans indexation)']]) +
        inN('communG', 'Commun alimenté par ' + W.g + ' (%) pour les impôts', '50') + '</div></details>';
    }
    // avis et barèmes
    h += '<details class="ccard"><summary><b>Avis et barèmes</b><span>' + Object.keys(FI.avis).length + ' avis</span></summary><div class="ccb"><ul class="list">' +
      Object.values(FI.avis).sort((a, b) => b.rev - a.rev).map(a => '<li><div class="grow"><b>' + a.rev + '</b><small>revenu imposable ' + eu(a.rni) + ' · impôt net ' + eu(a.irNet) + ' · prélevé ' + eu(a.pas) + ' · ' + (a.solde >= 0 ? 'solde ' : 'remboursement ') + eu(a.solde) + '</small></div>' +
        '<label class="small">Solde payé par<select data-soldeby="' + a.rev + '">' + [['g', W.g], ['s', W.s], ['c', 'le commun']].map(([v, t]) => '<option value="' + v + '"' + ((FI.soldeBy[a.rev] || 'g') === v ? ' selected' : '') + '>' + esc(t) + '</option>').join('') + '</select></label></li>').join('') + '</ul>' +
      '<ul class="list">' + Object.entries(KF().PARAMS).map(([y, p]) => '<li><div class="grow"><b>' + y + '</b> ' + (p.st === 'projet' ? chip('warn', 'projet') : chip('good', 'voté')) + '<small>' + esc(p.lab) + ' · ' + esc(p.src) + '</small><small>' + p.tr.map(([hi, r]) => Math.round(r * 100) + ' % ' + (hi === Infinity ? 'au-delà' : 'jusqu\'à ' + eu(hi))).join(' · ') + '</small></div></li>').join('') + '</ul></div></details>';
    return h + taxeFonciere(B, X);
  }

  function taxeFonciere(B, X) {
    const T = KF().taxeFonciere(X);
    if (!T) return '';
    const W = X.noms, TF = T.TF;
    let h = '<h4>Taxe foncière</h4><ul class="list">' + T.lignes.map(R => '<li><div class="grow"><b>' + R.y + '</b><small>' +
      (R.kind === 'none' ? 'non imposé (' + esc(R.why) + ')' : R.exo ? 'exonération partielle (' + Math.round(R.exo * 100) + ' % de la base)' : 'taxe pleine') + (R.base ? ' · base ' + eu(R.base) : '') + '</small>' +
      (R.total ? '<small>le ' + dfr(R.echeance) + ' · ' + esc(W.g) + ' ' + eu(R.moi) + ' · ' + esc(W.s) + ' ' + eu(R.autre) + '</small>' : '') + '</div>' +
      '<span class="m">' + (R.total ? (R.kind === 'avis' ? '' : 'environ ') + eu(R.total) : '—') + '</span>' +
      (R.kind === 'none' ? chip('good', 'rien à payer') : R.payee ? chip('good', 'payée le ' + jjmm(R.payee)) : R.kind === 'avis' ? chip('info', 'avis reçu') : chip('warn', 'estimation')) + '</li>').join('') + '</ul>';
    h += '<div class="rangee"><span>Déclaration d\'achèvement (H2)</span>' + (TF.h2ok === 'oui' ? chip('good', 'confirmée') : chip('warn', 'à confirmer')) + '</div>';
    const f = (k, l) => '<label>' + l + '<input data-tf="' + k + '" inputmode="decimal" value="' + (TF[k] == null ? '' : esc(String(TF[k]).replace('.', ','))) + '"></label>';
    h += '<details class="ccard"><summary><b>Hypothèses de la taxe foncière</b><span></span></summary><div class="ccb"><div class="grp">' + f('pg', 'Part de ' + W.g + ' (%)') +
      '<label>Déclaration H2<select data-tf="h2ok"><option value="non"' + (TF.h2ok !== 'oui' ? ' selected' : '') + '>à confirmer</option><option value="oui"' + (TF.h2ok === 'oui' ? ' selected' : '') + '>confirmée sur impots.gouv</option></select></label>' +
      f('surf', 'Surface (m²)') + f('baseM2', 'Base nette estimée (€/m²)') + f('basePk', 'Base nette du parking (€)') + f('tCom', 'Taux communal (%)') + f('tSpe', 'Taxes spéciales (%)') +
      f('tTeom', 'Ordures ménagères (%)') + f('exoCom', 'Exonération communale (% de la base)') + f('reval', 'Revalorisation des bases (% par an)') + '</div>' +
      '<h4>Saisir un avis</h4><div class="grp"><label>Année<input id="tfY" inputmode="numeric" value="' + X.Y + '"></label><label>Montant de l\'avis (€)<input id="tfT" inputmode="decimal"></label><label>Base (facultatif)<input id="tfB" inputmode="decimal"></label></div>' +
      '<div class="row"><button class="btn small" data-tfavis="1">Enregistrer l\'avis</button></div>' +
      (Object.keys(TF.avis || {}).length ? '<p class="muted small">Avis saisis : ' + Object.entries(TF.avis).sort().map(([y, a]) => y + ' : ' + eu2(a.total)).join(' · ') + '</p>' : '') + '</div></details>';
    return h;
  }

  // ------------------------------------------------------------ épargne : PEE et livret
  function epargne(B) {
    const X = KF().contexte(B);
    let h = '';
    const Lv = KF().livret(B);
    h += '<h4>Livret</h4>' + (Lv ? '<div class="carte bsolde"><b>Solde estimé</b><div class="grand">' + esc(e2(Lv.centimes)) + '</div><small class="muted">saisi ' + esc(e2(Lv.base)) + ' le ' + dfr(Lv.date) + (Lv.n ? ' + ' + Lv.n + ' virement(s) depuis, jusqu\'au ' + dfr(Lv.depuis) : '') + '</small></div>'
      : '<p class="muted">Le solde du livret n\'est pas transmis par la banque : saisissez-le pour le suivre.</p>') +
      '<div class="grp"><label>Solde affiché par la banque<input id="lvBase" inputmode="decimal" placeholder="montant"></label><label>À la date du<input id="lvDate" type="date" value="' + B.auj + '"></label></div><div class="row"><button class="btn small" data-lv="1">Enregistrer le solde</button></div>';
    const C = KF().pee(X);
    h += '<h4>Plan d\'épargne entreprise</h4>';
    if (!C) return h + '<p class="muted">Aucun plan d\'épargne renseigné.</p>' + formPee({ plan: {} });
    const pl = C.PEE.plan;
    if (C.PEE.vers.length) h += '<div class="kpis">' + kpi('Encours', eu(C.val), C.PEE.fonds.length + ' fonds') + kpi('Vos versements', eu(C.perso), 'dont ' + eu(C.volY) + ' en ' + X.Y) +
      kpi('Abondement reçu', eu(C.ab), eu(C.abY) + ' en ' + X.Y) + kpi(C.pv >= 0 ? 'Plus-value' : 'Moins-value', eu(C.pv), C.mt > 0 ? pct1(Math.abs(C.pv) / C.mt * 100) + ' du versé' : '', C.pv >= 0 ? 'ok' : 'bad') +
      kpi('Performance annuelle', C.tri != null ? (C.tri < 0 ? 'baisse de ' : '') + pct1(Math.abs(C.tri) * 100) : '—', 'taux de rendement interne') + '</div>';
    else h += '<p class="note small">Le PEE n\'est pas encore ouvert. Pour démarrer : le règlement du plan et la liste des fonds (documents d\'information clés), la règle d\'abondement ci-dessous, puis les fonds et vos versements.</p>';
    for (const c of C.PEE.closed || []) {
      const d = c.out - c.inv;
      h += '<div class="rangee"><span>Ancien PEE' + (c.emp ? ' ' + esc(c.emp) : '') + ' · soldé le ' + dfr(c.dOut) + '<small class="muted block">' + esc(c.note || '') + ' : ' + eu2(c.inv) + ' placés, ' + eu2(c.out) + ' reçus, soit ' + eu2(Math.abs(d)) + (d < 0 ? ' de moins' : ' de plus') + ' que le montant placé. Aucun impôt : le rachat d\'un PEE est exonéré d\'impôt sur le revenu' + (d <= 0 ? ' et, sans plus-value, de prélèvements sociaux' : '') + '.</small></span><b>' + eu2(c.out) + '</b></div>';
    }
    h += '<ul class="obsl">' + C.conseils.map(alerte).join('') + '</ul>';
    if (C.PEE.fonds.length) h += '<h4>Fonds</h4><ul class="list">' + C.PEE.fonds.map(fd => { const b = C.byF[fd.id]; return '<li><div class="grow"><b>' + esc(fd.nom) + '</b><small>' + esc({ mon: 'Monétaire', obl: 'Obligataire', div: 'Diversifié', act: 'Actions', emp: 'Actionnariat salarié', sol: 'Solidaire' }[fd.cat] || '') + ' · risque ' + (fd.sri || '—') + '/7</small></div><label class="small">Valeur de part<input data-vl="' + esc(fd.id) + '" inputmode="decimal" value="' + (fd.vl ? String(fd.vl).replace('.', ',') : '') + '"></label><span class="m">' + eu(b ? b.val : 0) + '</span></li>'; }).join('') + '</ul>';
    if (C.PEE.vers.length) h += '<h4>Versements</h4><ul class="list">' + C.PEE.vers.slice().sort((a, b) => a.d < b.d ? 1 : -1).map(v => { const fd = C.PEE.fonds.find(x => x.id === v.fid); return '<li><div class="grow">' + dfr(v.d) + ' · ' + esc({ vol: 'Versement volontaire', int: 'Intéressement', part: 'Participation', abond: 'Abondement', transf: 'Transfert' }[v.orig] || v.orig) + '<small>' + esc(fd ? fd.nom : '?') + ' · disponible le ' + dfr(v.dispo || ((+v.d.slice(0, 4) + (pl.dispo || 5)) + v.d.slice(4))) + '</small></div><span class="m">' + eu2(v.mt) + '</span><button class="btn ghost small" data-rmv="' + esc(v.id) + '" aria-label="Retirer">✕</button></li>'; }).join('') + '</ul>';
    return h + formPee(C.PEE);
  }
  function formPee(PEE) {
    const pl = PEE.plan || {};
    const f = (k, l, t, ph) => '<label>' + l + '<input data-pl="' + k + '"' + (t === 'date' ? ' type="date"' : ' inputmode="' + (t === 'n' ? 'decimal' : 'text') + '"') + ' value="' + esc(pl[k] == null ? '' : pl[k]) + '" placeholder="' + esc(ph || '') + '"></label>';
    return '<details class="ccard"><summary><b>Plan, fonds et versements</b><span>modifiables</span></summary><div class="ccb"><div class="grp">' + f('emp', 'Employeur', 't') + f('teneur', 'Teneur de compte', 't', 'ex. gestionnaire du plan') + f('entree', 'Date d\'entrée', 'date') +
      f('anc', 'Ancienneté requise (mois)', 'n', '3') + f('abTaux', 'Abondement (% des versements)', 'n', 'ex. 100') + f('abPlaf', 'Abondement maximal par an (€)', 'n', 'ex. 1 500') + f('dispo', 'Durée de blocage (ans)', 'n', '5') + '</div>' +
      '<h4>Ajouter un fonds</h4><div class="grp"><label>Nom<input id="pfNom"></label><label>Catégorie<select id="pfCat"><option value="mon">Monétaire</option><option value="obl">Obligataire</option><option value="div">Diversifié</option><option value="act">Actions</option><option value="emp">Actionnariat salarié</option><option value="sol">Solidaire</option></select></label><label>Risque (1 à 7)<input id="pfSri" inputmode="numeric"></label><label>Valeur de part<input id="pfVl" inputmode="decimal"></label></div><div class="row"><button class="btn small" data-pf="1">Ajouter le fonds</button></div>' +
      ((PEE.fonds || []).length ? '<h4>Ajouter un versement</h4><div class="grp"><label>Date<input id="pvDate" type="date"></label><label>Origine<select id="pvOrig"><option value="vol">Versement volontaire</option><option value="int">Intéressement</option><option value="part">Participation</option><option value="abond">Abondement</option><option value="transf">Transfert</option></select></label><label>Fonds<select id="pvFonds">' + PEE.fonds.map(fd => '<option value="' + esc(fd.id) + '">' + esc(fd.nom) + '</option>').join('') + '</select></label><label>Montant<input id="pvMt" inputmode="decimal"></label><label>Parts (facultatif)<input id="pvParts" inputmode="decimal"></label></div><div class="row"><button class="btn small" data-pv="1">Ajouter le versement</button></div>' : '') +
      '</div></details>';
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
