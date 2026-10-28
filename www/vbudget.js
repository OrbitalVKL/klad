// Klad — rendu de l'onglet Budget (suivi du cycle), du reste à vivre, des contrats, des échéances et de la tendance
// (chaînes HTML, sans accès au DOM : testées dans node). Jamais de montant négatif affiché : « reste / dépassé de »,
// « en dépassement », « de plus / de moins ».
(function (g) {
  'use strict';

  const KB = () => g.KladBudget;
  const K = () => g.KladClasse;
  const F = () => g.KladFormat;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const DEMI = 50;

  // Montants : à l'euro dans le suivi (comme l'ancienne version), au centime dans les détails. Jamais de signe.
  const e0 = c => KB().eur(c);
  const e2 = c => F().montant(c);
  const jjmm = iso => iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) : '';
  const jjmmaa = iso => iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(2, 4) : '';
  const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const nomMois = m => { const t = MOIS[+m.slice(5, 7) - 1]; return t[0].toUpperCase() + t.slice(1) + ' ' + m.slice(0, 4); };
  const pluriel = (n, s, p) => n + ' ' + (n > 1 ? (p || s + 's') : s);
  const chip = st => st ? '<span class="chip ' + esc(st.niveau || '') + '">' + esc(st.texte) + '</span>' : '';
  // Valeur qui peut passer sous zéro : « 120 € » ou « 120 € en dépassement ».
  const signeTexte = (c, f) => c < -DEMI / 2 ? '<span class="bad">' + esc((f || e2)(c)) + ' en dépassement</span>' : esc((f || e2)(c));

  function libellePeriode(per) {
    const c = per.cyc;
    if (per.past) {
      if (c) { const n = Math.round((Date.parse(c.end) - Date.parse(c.start)) / 864e5) + 1; return 'Cycle du ' + jjmm(c.start) + ' au ' + jjmmaa(c.end) + (n < 26 || n > 35 ? ' (' + n + ' j)' : '') + ' · terminé'; }
      return nomMois(per.pm0) + ' · terminé';
    }
    return c ? 'Cycle en cours · du ' + jjmm(c.start) + ' au ' + jjmmaa(c.end) : 'Mois en cours · ' + nomMois(per.pm0);
  }

  // Barre de consommation : part consommée du budget, trait du jour (période en cours).
  function barre(cur, pm, cls, frac) {
    const pct = pm > 0 ? cur / pm : (cur > 0 ? 2 : 0);
    return '<div class="tbar"><i class="' + esc(cls || '') + '" style="width:' + Math.max(0, Math.min(100, Math.round(pct * 100))) + '%"></i>' +
      (frac != null ? '<span style="left:' + Math.round(Math.min(1, frac) * 100) + '%"></span>' : '') + '</div>';
  }
  function resteTexte(a, past) {
    if (a.debit !== undefined) return '<span class="muted">provisionnés</span>';
    if (a.pm > DEMI) {
      const left = a.pm - a.cur;
      if (past) return left < -DEMI ? '<span class="bad">dépassé de ' + e0(-left) + '</span>' : '<span class="ok">' + (left > DEMI ? 'reste ' + e0(left) : 'tenu') + '</span>';
      return left >= -DEMI ? '<span class="ok">reste ' + e0(Math.max(0, left)) + '</span>' : '<span class="bad">dépassé de ' + e0(-left) + '</span>';
    }
    return a.cur > DEMI ? '<span class="hb">hors budget</span>' : '';
  }

  // ------------------------------------------------------------ onglet Budget
  // ui : { ouverts: Set de clés de postes dépliés }.
  function ecran(B, scope, nav, ui) {
    const s = KB().suivi(B, scope, nav);
    const per = s.per, past = per.past, C = B.cx.C;
    const ouverts = (ui && ui.ouverts) || new Set();
    let h = '<div class="bhaut"><div class="seg" role="group" aria-label="Périmètre">' +
      ['perso', 'commun'].map(x => '<button data-scope="' + x + '" aria-pressed="' + (x === scope) + '">' + (x === 'perso' ? 'Perso' : 'Commun') + '</button>').join('') + '</div>' +
      '<button class="btn ghost small" data-ouvrir="secContrats">Contrats</button><button class="btn ghost small" data-ouvrir="secTendance">Tendance</button>' +
      (scope === 'commun' && g.KladVuesCommun ? '<button class="btn ghost small" data-ouvrir="secEquilibre">Équilibre</button>' : '') + '</div>';
    h += '<div class="cycnav"><button class="btn ghost small" data-nav="prev"' + (per.prev ? '' : ' disabled') + ' aria-label="Période précédente">◀</button>' +
      '<b>' + esc(libellePeriode(per)) + '</b><button class="btn ghost small" data-nav="next"' + (past ? '' : ' disabled') + ' aria-label="Période suivante">▶</button></div>' +
      (past ? '<div class="row center"><button class="lien" data-nav="now">Revenir au cycle en cours</button></div>' : '');
    // total des dépenses
    const t = s.total, e = t.P - t.C;
    h += '<div class="carte btot"><div class="rangee"><b>Total des dépenses</b><b class="m">' + e0(t.C) + '</b></div>' +
      '<div class="rangee muted"><span>budget ' + e0(t.P) + '</span><span>' + (e < -DEMI ? '<span class="bad">dépassé de ' + e0(-e) + '</span>' : '<span class="ok">reste ' + e0(Math.max(0, e)) + '</span>') + '</span></div>' +
      '<div class="tbar seg2">' + (t.C ? '<i class="in" style="width:' + Math.round(100 * Math.max(0, t.IN) / Math.max(t.C, t.P, 1)) + '%"></i><i class="out" style="width:' + Math.round(100 * t.OUT / Math.max(t.C, t.P, 1)) + '%"></i>' : '') + '</div>' +
      '<div class="rangee muted small"><span>dans le budget ' + e0(Math.max(0, t.IN)) + (t.OUT > DEMI ? ' · <span class="hb">hors budget ' + e0(t.OUT) + '</span>' : '') + '</span><span>' + (past ? '' : 'jour ' + s.jour + ' sur ' + s.nbJours) + '</span></div>';
    if (t.C > t.P + DEMI && s.causes.length) {
      h += '<details class="causes"><summary>Causes du dépassement (' + s.causes.length + ')</summary><ul>' + s.causes.slice(0, 8).map(x =>
        '<li><b>' + esc(x.a.label) + '</b> ' + (x.hb ? '<span class="hb">' + e0(x.v) + ' hors budget</span>' : '<span class="bad">' + e0(x.v) + ' de plus</span>') + '</li>').join('') +
        (s.causes.length > 8 ? '<li class="muted">et ' + (s.causes.length - 8) + ' autres</li>' : '') + '</ul></details>';
    }
    h += '</div>';
    // revenus
    const R = s.revenus;
    h += '<section class="bsec rev"><h3><span class="nat rev"></span>Revenus<span class="gs">' + (R.p > DEMI ? 'budget ' + e0(R.p) + ' · ' : '') + 'reçu ' + e0(R.c) +
      (R.p > DEMI ? (R.c >= R.p - DEMI ? ' · <span class="ok">reçu en totalité</span>' : ' · attendu ' + e0(R.p - R.c)) : '') + '</span></h3>';
    for (const x of R.lignes) {
      const k = 'rev|' + x.key, op = ouverts.has(k);
      h += '<button class="bl" data-poste="' + esc(k) + '" aria-expanded="' + op + '"><span class="ico">' + esc(K().iconeDe(C, scope === 'commun' ? KB().APPORTS : x.key)) + '</span>' +
        '<span class="nm">' + esc(x.key) + '<small>' + (x.pm ? 'budget ' + e0(x.pm) + ' · ' : '') + 'reçu ' + e0(x.got) + '</small></span><span class="et">' + chip(x.etat) + '</span></button>';
      if (op) h += details(B, x.ops.slice().reverse(), [], scope === 'perso' && !s.per.past ? { revenu: x.key } : null);
    }
    h += '</section>';
    // sections
    for (const nk of KB().NATS) {
      const S = s.sections[nk];
      const left = S.p - S.c;
      h += '<section class="bsec ' + nk + '"><h3><span class="nat ' + nk + '"></span>' + esc(KB().NOMS[nk]) +
        (S.nbDepasses ? ' <span class="chip bad">' + pluriel(S.nbDepasses, 'dépassé') + '</span>' : '') +
        (S.nbAVoir ? ' <span class="chip warn">' + S.nbAVoir + (nk === 'fixe' ? ' à vérifier' : ' à surveiller') + '</span>' : '') +
        '<span class="gs">budget ' + e0(S.p) + ' · utilisé ' + e0(S.c) + ' · ' + (left >= -DEMI ? '<span class="ok">reste ' + e0(Math.max(0, left)) + '</span>' : '<span class="bad">dépassé de ' + e0(-left) + '</span>') + '</span></h3>';
      for (const a of S.lignes) h += ligne(B, scope, a, ouverts, s);
      if (!past) h += '<div class="row"><button class="lien" data-ajout="' + nk + '">+ Ajouter un poste</button></div>';
      h += '</section>';
    }
    const HB = s.horsBudget;
    if (HB.lignes.length) {
      h += '<section class="bsec hbs"><h3><span class="nat hb"></span>Hors budget<span class="gs">utilisé ' + e0(HB.c) + ' · <span class="hb">sans budget</span></span></h3>';
      for (const a of HB.lignes) h += ligne(B, scope, a, ouverts, s);
      h += '</section>';
    }
    h += soldeCycle(s);
    if (scope === 'commun' && !past && g.KladVuesCommun) { try { h += g.KladVuesCommun.cartes(B, ui && ui.cartes); } catch (e) { h += '<p class="muted">Compte commun : calcul impossible.</p>'; } }
    h += '<p class="muted small">' + (per.cyc ? 'Cycle du dernier salaire à la veille du suivant. ' : '') +
      'Budget = votre budget mensuel (une charge trimestrielle ou annuelle ne compte que le mois de son échéance' + (scope === 'commun' ? ', sauf au compte commun où elle est provisionnée chaque mois' : '') +
      ') ; utilisé = opérations de la période, les paiements carte à leur date de paiement. Hors budget : postes sans budget.</p>';
    return h;
  }

  function ligne(B, scope, a, ouverts, s) {
    const C = B.cx.C, past = s.per.past;
    const op = ouverts.has(a.key);
    const ico = K().iconeDe(C, a.nat === 'fixe' ? (a.cat || a.label) : a.label);
    let h = '<button class="bl' + (a.on ? '' : ' off') + '" data-poste="' + esc(a.key) + '" aria-expanded="' + op + '"><span class="ico">' + esc(ico) + '</span>' +
      '<span class="nm">' + esc(a.label) + (a.lie ? ' <small class="chip">ma part du commun</small>' : '') +
      '<small>' + (a.pm ? 'budget ' + e0(a.pm) : 'sans budget') + (a.per > 1 ? ' · échéance ' + e0(a.ech) : '') + ' · ' + (a.debit !== undefined ? e0(a.pm) + ' provisionnés' : 'utilisé ' + e0(a.cur)) + '</small>' +
      barre(a.cur, a.pm, a.cls, past || a.nat === 'fixe' ? null : s.frac) + '</span>' +
      '<span class="et">' + resteTexte(a, past) + chip(a.etat) + '</span></button>';
    if (a.cause) {
      h += '<div class="cause"><b>Cause</b> ' + esc(a.cause.texte) + (a.cause.aligner && !past && !a.lie ? ' <button class="lien" data-aligner="' + esc(a.key) + '" data-v="' + Math.round(a.cause.aligner) + '">aligner le budget sur ' + e2(a.cause.aligner) + '</button>' : '') + '</div>';
    }
    if (op) h += details(B, a.ops || [], a.contrats || [], past ? null : { poste: a.key, lie: a.lie });
    return h;
  }

  function details(B, ops, contrats, edit) {
    const cpt = id => { const c = B.S.modele.comptes.find(x => x.id === id); return c ? c.libelle : ''; };
    let h = '<div class="bdet">';
    for (const c of contrats) h += '<div class="bop"><span>📄 ' + esc(c.label) + '<small>contrat ' + e2(c.montant) + ' ' + esc(PERLAB[c.per || 1]) + (c.src ? ' · ' + esc(c.src) : '') + '</small></span></div>';
    for (const r of ops.slice(0, 40)) {
      h += '<button class="bop" data-op="' + esc(r.id) + '" data-c="' + esc(r.cid) + '"><span>' + esc(r.label) + '<small>' + esc(jjmm(r.od) + ' · ' + cpt(r.cid)) + '</small></span><span class="m">' + esc(e2(r.m)) + '</span></button>';
    }
    if (!ops.length && !contrats.length) h += '<p class="muted small">Aucune opération sur la période.</p>';
    if (ops.length > 40) h += '<p class="muted small">et ' + (ops.length - 40) + ' autres opérations</p>';
    if (edit && edit.poste && !edit.lie) h += '<div class="row"><button class="btn ghost small" data-editer="' + esc(edit.poste) + '">Modifier le budget</button></div>';
    if (edit && edit.lie) h += '<p class="muted small">Montant = ma part du budget du compte commun (Budget › Commun).</p>';
    if (edit && edit.revenu) h += '<div class="row"><button class="btn ghost small" data-editer="r|' + esc(edit.revenu) + '">Modifier le revenu attendu</button></div>';
    return h + '</div>';
  }
  const PERLAB = { 1: '/ mois', 3: '/ trimestre', 4: '/ 4 mois', 12: '/ an' };

  function soldeCycle(s) {
    const o = s.solde, per = s.per;
    if (s.scope === 'commun' && !per.past && o.compte != null) {
      return '<div class="carte bsolde"><b>Solde du compte commun</b><div class="grand">' + signeTexte(o.compte) + '</div>' +
        '<div class="rangee muted"><span>Variation réelle depuis le 1er</span><span>' + (o.variation < 0 ? 'en baisse de ' : 'en hausse de ') + e2(Math.abs(o.variation)) + '</span></div>' +
        (o.provisions > DEMI ? '<div class="rangee muted"><span>Provisions du mois (rien n\'est sorti du compte)</span><span>' + e0(o.provisions) + '</span></div>' : '') + '</div>';
    }
    const val = v => v < -DEMI ? '<span class="bad">' + e0(-v) + ' de dépenses au-delà des revenus</span>' : '<span class="ok">' + e0(Math.max(0, v)) + ' restant</span>';
    if (s.scope === 'perso' && !per.past) {
      return '<div class="carte bsolde"><b>Solde prévu par le budget</b><small class="muted">revenus prévus ' + e0(s.revenus.p) + ' moins budget ' + e0(s.total.P) + '</small><div class="grand">' + val(o.balP) + '</div>' +
        '<div class="rangee muted"><span>Réel à ce jour</span><span>' + val(o.bal) + '</span></div>' +
        '<div class="rangee muted"><span>Projeté en fin de ' + (per.cyc ? 'cycle' : 'mois') + '</span><span>' + val(o.pj) + '</span></div></div>';
    }
    return '<div class="carte bsolde"><b>Solde ' + (per.past ? 'de la période' : 'du mois') + '</b><small class="muted">revenus ' + e0(o.revenus) + ' moins dépenses ' + e0(o.depenses) + '</small><div class="grand">' + val(o.bal) + '</div>' +
      '<div class="rangee muted"><span>Prévu par le budget</span><span>' + val(o.balP) + '</span></div>' +
      (per.past ? '<div class="rangee muted"><span>Par rapport au prévu</span><span>' + (o.ecart < -DEMI ? '<span class="bad">' + e0(-o.ecart) + ' moins bien</span>' : '<span class="ok">' + e0(Math.max(0, o.ecart)) + ' mieux</span>') + '</span></div>'
        : '<div class="rangee muted"><span>Projeté en fin de mois</span><span>' + val(o.pj) + '</span></div>') + '</div>';
  }

  // ------------------------------------------------------------ reste à vivre (accueil et détail)
  function carteRav(rav) {
    if (!rav) return '';
    const v = (c, lab) => '<span class="rv"><b class="m' + (c < 0 ? ' debiteur' : '') + '">' + esc(e2(c)) + (c < 0 ? ' <small>en dépassement</small>' : '') + '</b><small>' + lab + '</small></span>';
    return '<button class="carte rav" data-rav="1"><span class="rtit">Reste à vivre jusqu\'au ' + esc(jjmm(rav.fin)) + '<span class="chev">détail ›</span></span><span class="rvs">' +
      v(rav.budget.reste, 'sur le dernier salaire') + (rav.comptes ? v(rav.comptes.reste, 'sur les comptes courants') : '') + '</span></button>';
  }
  function detailRav(rav) {
    if (!rav) return '<p class="muted">Le reste à vivre se calcule sur le cycle en cours du périmètre perso.</p>';
    const b = rav.budget, c = rav.comptes;
    const cel = x => x == null ? '<td class="muted">—</td>' : '<td>' + signeTexte(x) + '</td>';
    const L = (lab, sub, x, y, cls) => '<tr' + (cls ? ' class="' + cls + '"' : '') + '><th>' + lab + (sub ? '<small>' + sub + '</small>' : '') + '</th>' + cel(x) + cel(y) + '</tr>';
    return '<table class="ravt"><thead><tr><th></th><th>Dernier salaire' + (b.date ? ' (' + jjmm(b.date) + ')' : '') + '</th><th>Comptes courants</th></tr></thead><tbody>' +
      L('Base', 'salaire / soldes des comptes courants', b.base, c && c.base) +
      L('moins Charges fixes', 'prélevées / encore à venir', b.fixes, c && c.fixes) +
      L('= Marge', '', b.marge, c && c.marge, 'mg') +
      L('moins Variable', 'dépensé / reste du budget', b.variable, c && c.variable) +
      L('= Reste à vivre', '', b.reste, c && c.reste, 'rvt') + '</tbody></table>' +
      '<p class="muted small">Jusqu\'au ' + esc(jjmmaa(rav.fin)) + '. Colonne « dernier salaire » : le salaire du cycle moins ce qui est déjà dépensé. ' +
      'Colonne « comptes courants » : les soldes des comptes courants moins les charges fixes pas encore prélevées et le reste du budget variable.' +
      (c ? '' : ' Les soldes des comptes courants ne sont pas encore connus.') + '</p>';
  }

  // ------------------------------------------------------------ édition d'un poste (volet)
  function edition(B, scope, key) {
    const C = B.cx.C;
    if (key.startsWith('r|')) {
      const x = KB().revenusAttendus(B).find(r => 'r|' + r.cat === key) || { cat: key.slice(2), amt: 0, on: true, libre: true, avg: 0 };
      let h = '<div class="dtete"><span class="ico grand">' + esc(K().iconeDe(C, x.cat)) + '</span><div><b>' + esc(x.cat) + '</b><small>revenu attendu par mois</small></div></div>' +
        '<label class="inline"><input type="checkbox" id="peOn"' + (x.on ? ' checked' : '') + '> Compté dans le budget</label>';
      if (x.cat === 'Salaire') {
        h += '<label>Calcul du salaire attendu<select id="peMode">' + Object.keys(KB().MODES_SALAIRE).map(m => '<option value="' + m + '"' + (m === x.mode ? ' selected' : '') + '>' + esc(KB().MODES_SALAIRE[m]) + '</option>').join('') + '</select></label>' +
          '<label>Montant (mode « montant libre »)<input id="peAmt" inputmode="decimal" value="' + esc(x.mode === 'libre' ? F().versSaisie(x.amt) : '') + '"' + (x.mode === 'libre' ? '' : ' disabled') + '></label>' +
          '<p class="muted small">Actuellement : ' + e0(x.amt) + (x.sal && x.sal.last ? ' · dernier salaire ' + e2(x.sal.last.m) + ' le ' + jjmmaa(x.sal.last.date) : '') + '</p>';
      } else h += '<label>Montant attendu par mois<input id="peAmt" inputmode="decimal" value="' + esc(x.set ? F().versSaisie(x.amt) : '') + '" placeholder="0"></label>';
      return h + '<p class="muted small">Habituel (médiane) : ' + e0(x.avg || 0) + ' par mois.</p><div class="row"><button class="btn" data-pe="ok">Enregistrer</button></div>';
    }
    const P = KB().postes(B, scope);
    const a = P.lignes.find(x => x.key === key) || { key, label: key.slice(2), nat: key[0] === 'f' ? 'fixe' : K().natureDe(C, key.slice(2)), avg: 0, amt: 0, ech: 0, per: 1, on: true, calcul: 'mediane', set: false };
    const calc = a.calcul === 'douze' ? 'total des 12 derniers mois ÷ 12' : a.calcul === 'moyenne' ? 'moyenne des ' + P.W.months.length + ' mois de référence' : 'médiane des ' + P.W.months.length + ' mois de référence';
    let h = '<div class="dtete"><span class="ico grand">' + esc(K().iconeDe(C, a.nat === 'fixe' ? (a.cat || a.label) : a.label)) + '</span><div><b>' + esc(a.label) + '</b><small>' + esc(KB().NOMS[a.nat] || '') + ' · ' + (scope === 'commun' ? 'commun' : 'perso') + '</small></div></div>';
    if (a.lie) return h + '<p class="muted">Ce poste suit automatiquement ma part du budget du compte commun : ' + e0(a.amt) + ' par mois.</p>';
    h += '<label class="inline"><input type="checkbox" id="peOn"' + (a.on ? ' checked' : '') + '> Dans le budget</label>' +
      '<div class="grp"><label>Montant par échéance<input id="peAmt" inputmode="decimal" value="' + esc(a.set || a.on ? F().versSaisie(a.per > 1 ? a.ech : a.amt) : '') + '"></label>' +
      '<label>Périodicité<select id="pePer">' + KB().PER.map(p => '<option value="' + p + '"' + (p === a.per ? ' selected' : '') + '>' + esc(PERLAB[p]) + '</option>').join('') + '</select></label></div>' +
      (a.per > 1 ? '<p class="muted small">Soit ' + e0(a.amt) + ' par mois.</p>' : '') +
      (scope === 'commun' ? '<div class="grp"><label>Ma part (%)<input id="pePg" inputmode="numeric" value="' + esc(KB().partDe(B, key).pg) + '"></label><label class="inline"><input type="checkbox" id="peElig"' + (KB().partDe(B, key).elig ? ' checked' : '') + '> Compte dans l\'équilibre</label></div>' : '') +
      '<p class="muted small">Réel habituel : ' + e0(a.avg) + ' par mois (' + esc(calc) + ').' + (a.set ? '' : ' Montant proposé tant que vous n\'avez rien saisi.') + '</p>' +
      '<div class="row"><button class="btn" data-pe="ok">Enregistrer</button><button class="btn ghost" data-pe="aligner">Aligner sur le réel habituel</button>' +
      '<button class="btn danger small" data-pe="retirer">' + (key[0] === 'm' ? 'Supprimer le poste' : 'Retirer du budget') + '</button></div>';
    return h;
  }

  // ------------------------------------------------------------ contrats et échéances
  function ecranContrats(B, scope) {
    const L = KB().contrats(B, scope);
    let h = '<p class="muted">Montants des contrats et documents (pas des relevés), comparés au dernier prélèvement trouvé.</p>';
    h += '<div class="seg" role="group">' + ['perso', 'commun'].map(x => '<button data-scope="' + x + '" aria-pressed="' + (x === scope) + '">' + (x === 'perso' ? 'Perso' : 'Commun') + '</button>').join('') + '</div>';
    if (!L.length) h += '<p class="muted">Aucun contrat ' + (scope === 'commun' ? 'du compte commun' : 'perso') + '.</p>';
    h += '<ul class="list ctr">' + L.map(c => '<li><div class="grow"><b>' + esc(c.label) + '</b><small>' + e2(c.montant) + ' ' + esc(PERLAB[c.per || 1]) +
      (c.per > 1 ? ' (soit ' + e2(c.mensuel) + ' par mois)' : '') + (c.posteLabel ? ' · poste ' + esc(c.posteLabel) : '') + '</small>' +
      '<small>' + (c.dernier ? 'dernier prélèvement ' + e2(c.dernier.montant) + ' le ' + jjmmaa(c.dernier.date) : 'aucun prélèvement trouvé') +
      (c.prochaine ? ' · prochaine échéance le ' + jjmmaa(c.prochaine) : '') + '</small>' +
      (c.src || c.note ? '<small>' + esc([c.src, c.note].filter(Boolean).join(' · ')) + '</small>' : '') + '</div>' + chip(c.etat) + '</li>').join('') + '</ul>';
    const E = KB().echeances(B, 31);
    h += '<h3>Échéances des 31 prochains jours</h3>' + (E.length ? '<ul class="list">' + E.map(x => '<li><div class="grow">' + esc(x.label) +
      '<small>' + esc(jjmmaa(x.date) + ' · ' + ({ contrat: 'contrat', recurrent: 'prélèvement récurrent', carte: 'carte à débit différé' }[x.sorte]) + (x.scope === 'commun' ? ' · commun' : '')) + '</small></div><span class="m">' + esc(e2(x.montant)) + '</span></li>').join('') + '</ul>'
      : '<p class="muted">Aucune échéance connue.</p>');
    return h;
  }

  // ------------------------------------------------------------ tendance (12 cycles)
  function ecranTendance(B, scope, cat) {
    const T = KB().tendance(B, scope, 12, cat || null);
    const P = T.periodes;
    let h = '<div class="seg" role="group">' + ['perso', 'commun'].map(x => '<button data-scope="' + x + '" aria-pressed="' + (x === scope) + '">' + (x === 'perso' ? 'Perso' : 'Commun') + '</button>').join('') + '</div>' +
      '<label>Afficher<select id="tdCat"><option value="">Par nature</option><optgroup label="Une catégorie">' + T.categories.map(c => '<option' + (c === T.cat ? ' selected' : '') + '>' + esc(c) + '</option>').join('') + '</optgroup></select></label>';
    const W = 340, H = 200, pl = 8, pb = 34, pt = 10;
    const vals = P.map(p => T.cat ? p.cat : p.total);
    const max = Math.max(1, ...vals, T.budget || 0);
    const bw = (W - pl * 2) / Math.max(1, P.length);
    const y = v => pt + (H - pt - pb) * (1 - v / max);
    let svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="graph" role="img" aria-label="Dépenses par ' + (T.parCycle ? 'cycle' : 'mois') + '">';
    const coul = { fixe: 'var(--nfix)', courante: 'var(--ncour)', optionnelle: 'var(--nopt)' };
    P.forEach((p, i) => {
      const x = pl + i * bw + bw * 0.18, w = bw * 0.64;
      if (T.cat) {
        const over = T.budget && p.cat > T.budget + DEMI;
        svg += '<rect x="' + x.toFixed(1) + '" y="' + y(p.cat).toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + (y(0) - y(p.cat)).toFixed(1) + '" rx="2" fill="' + (over ? 'var(--bad)' : 'var(--accent)') + '"/>';
      } else {
        let base = 0;
        for (const n of ['fixe', 'courante', 'optionnelle']) {
          const v = p[n] || 0;
          if (v <= 0) continue;
          svg += '<rect x="' + x.toFixed(1) + '" y="' + y(base + v).toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + (y(base) - y(base + v)).toFixed(1) + '" fill="' + coul[n] + '"/>';
          base += v;
        }
      }
      if (i % 2 === (P.length - 1) % 2) svg += '<text x="' + (x + w / 2).toFixed(1) + '" y="' + (H - pb + 14) + '" text-anchor="middle" font-size="9" fill="var(--muted)">' + esc(jjmm(p.start)) + '</text>';
    });
    if (T.cat && T.budget) svg += '<line x1="' + pl + '" x2="' + (W - pl) + '" y1="' + y(T.budget).toFixed(1) + '" y2="' + y(T.budget).toFixed(1) + '" stroke="var(--ink)" stroke-dasharray="4 3"/>';
    svg += '</svg>';
    h += svg + '<p class="legende small">' + (T.cat ? '<span><i style="background:var(--accent)"></i>' + esc(T.cat) + '</span>' + (T.budget ? '<span><i class="ligne"></i>budget ' + e0(T.budget) + '</span><span><i style="background:var(--bad)"></i>au-delà</span>' : '')
      : '<span><i style="background:var(--nfix)"></i>Charges fixes</span><span><i style="background:var(--ncour)"></i>Courantes</span><span><i style="background:var(--nopt)"></i>Optionnelles</span>') + '</p>';
    h += '<ul class="list tdl">' + P.slice().reverse().map(p => '<li><div class="grow">' + (T.parCycle ? 'du ' + jjmm(p.start) + ' au ' + jjmmaa(p.end) : nomMois(p.start.slice(0, 7))) + (p.encours ? ' <span class="chip">en cours</span>' : '') +
      (T.cat ? '' : '<small>fixes ' + e0(p.fixe) + ' · courantes ' + e0(p.courante) + ' · optionnelles ' + e0(p.optionnelle) + '</small>') + '</div><span class="m">' + e0(T.cat ? p.cat : p.total) + '</span></li>').join('') + '</ul>' +
      '<p class="muted small">Dépenses par ' + (T.parCycle ? 'cycle de salaire' : 'mois') + ', paiements carte à leur date de paiement ; virements internes, épargne et hors budget exclus.</p>';
    return h;
  }

  g.KladVuesBudget = { ecran, ligne, carteRav, detailRav, edition, ecranContrats, ecranTendance, libellePeriode, PERLAB };
})(typeof window !== 'undefined' ? window : globalThis);
