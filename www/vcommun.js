// Klad — rendu du compte commun (Lot 7) : marge réelle, fin de mois estimée, virements (en place, demandés, reçus),
// virement ponctuel, trésorerie sur 12 mois, échéances non mensuelles, appels de fonds, d'où vient le solde, équilibre
// des apports. Chaînes HTML, sans DOM (testées dans node). Jamais de montant négatif affiché : « débiteur »,
// « découvert », « de plus / de moins », « qui doit combien à qui ».
(function (g) {
  'use strict';

  const KC = () => g.KladCommun;
  const KB = () => g.KladBudget;
  const F = () => g.KladFormat;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const e0 = c => KB().eur(c);
  const e2 = c => F().montant(c);
  const solde = c => '<span class="m' + (c < 0 ? ' debiteur' : '') + '">' + esc(e2(c)) + (c < 0 ? ' débiteur' : '') + '</span>';
  const jjmm = iso => iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) : '';
  const jjmmaa = iso => iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '';
  const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const mois = m => MOIS[+m.slice(5, 7) - 1] + ' ' + m.slice(0, 4);
  const moisC = m => KB().nomMois(m);
  const chip = (niv, t) => '<span class="chip ' + niv + '">' + esc(t) + '</span>';
  const pl = (n, s, p) => n + ' ' + (n > 1 ? (p || s + 's') : s);
  const det = (cle, titre, resume, corps, ouvert) => '<details class="ccard" data-cc="' + cle + '"' + (ouvert ? ' open' : '') + '><summary><b>' + titre + '</b><span>' + resume + '</span></summary><div class="ccb">' + corps + '</div></details>';
  const ligne = (lab, val, sub) => '<div class="rangee"><span>' + lab + (sub ? '<small class="muted block">' + sub + '</small>' : '') + '</span><span>' + val + '</span></div>';

  // ------------------------------------------------------------ cartes du périmètre « Commun »
  // ouverts : Set des cartes dépliées (clé).
  function cartes(B, ouverts) {
    const o = ouverts || new Set();
    const R = KC().reglages(B);
    let h = '';
    const MR = KC().margeReelle(B), FM = KC().finDeMois(B);
    if (!MR) return '<div class="carte bsolde"><b>Compte commun</b><p class="muted">Le solde du compte commun n\'est pas encore connu : marge réelle, trésorerie et fin de mois apparaîtront avec le prochain relevé.</p></div>';
    // marge réelle
    h += '<div class="carte bsolde"><b>Marge réelle du commun</b><div class="grand">' + solde(MR.marge) + '</div>' +
      ligne('Disponible', solde(MR.solde), 'solde du compte commun') +
      ligne('moins charges fixes à venir', esc(e2(MR.fixes)), 'pas encore prélevées ce mois') +
      ligne('moins reste du budget variable', esc(e2(MR.variable)), 'courantes et optionnelles') +
      (MR.attendus > 50 ? ligne('avec les virements attendus (' + esc(e2(MR.attendus)) + ')', solde(MR.avecAttendus)) : '<p class="muted small">Rien d\'autre attendu ce mois.</p>') + '</div>';
    // fin de mois estimée
    h += '<div class="carte bsolde' + (FM.decouvert || FM.end < 0 ? ' alerte' : '') + '"><b>Fin de mois estimée</b><div class="grand">' + solde(FM.end) + '</div>' +
      ligne('Solde', solde(FM.solde)) + ligne('moins prélèvements à venir', esc(e2(FM.due)), FM.aVenir.length ? esc(FM.aVenir.join(', ')) : '') +
      ligne('plus virements attendus', esc(e2(FM.inc))) + (FM.reserve > 50 ? ligne('moins réserve pour échéances', esc(e2(FM.reserve)), esc(FM.reserveDet.map(x => x.label + ' ' + e0(x.montant)).join(', '))) : '') +
      (FM.decouvert ? '<p class="bad small">Découvert si les prélèvements passent avant les virements.</p>' : '') + '</div>';
    // virements à mettre en place
    const D = KC().plan(B);
    const nbCh = D.changes.length;
    h += det('vir', 'Virements', nbCh ? '<span class="bad">' + pl(nbCh, 'ordre') + ' à modifier</span>' : '<span class="ok">conformes au budget</span>', virements(B, D, R), o.has('vir') || nbCh > 0 || D.pon > 0);
    // trésorerie
    const C = D.C;
    if (C) h += det('cash', 'Trésorerie · 12 mois', C.min < 0 ? '<span class="bad">découvert de ' + e2(-C.min) + ' le ' + jjmm(C.minAt) + '</span>' : 'plus bas ' + e2(C.min) + ' le ' + jjmm(C.minAt), tresorerie(B, D), o.has('cash'));
    // appels de fonds
    const A = KC().appels(B), ks = Object.keys(A);
    if (ks.length) {
      const tot = ks.reduce((t, k) => t + Math.max(0, A[k].reste), 0);
      h += det('ap', 'Appels de fonds', tot > 50 ? '<span class="bad">' + e2(tot) + ' à virer</span>' : '<span class="ok">à jour</span>', appels(A), o.has('ap') || tot > 50);
    }
    // d'où vient le solde
    const W = D.W;
    if (W) h += det('why', D.pon > 0 ? 'Ce que le virement ponctuel compense' : 'D\'où vient le solde', solde(W.now), origine(B, W, D), o.has('why') || D.pon > 0);
    return h;
  }

  function virements(B, D, R) {
    const V = B.D.virements || [];
    const recu = v => {
      const x = D.recus.find(y => y.v === v);
      if (x && x.vu) return Math.abs(x.vu.m - v.montant) > 1 ? chip('warn', 'reçu ' + e2(x.vu.m) + ' le ' + jjmm(x.vu.date) + ' · prévu ' + e0(v.montant)) : chip('good', 'reçu le ' + jjmm(x.vu.date));
      return x && x.retard ? chip('bad', 'non reçu') : chip('info', 'attendu le ' + (+v.jour || 1));
    };
    const action = (have, want) => {
      const d = have - want;
      return Math.abs(d) < 100 ? chip('good', 'à garder') : d < 0 ? chip('bad', 'passer à ' + e0(want)) + ' <small class="muted">' + e0(-d) + ' de plus</small>' : chip('info', 'marge ' + e0(d)) + ' <small class="muted">peut passer à ' + e0(want) + '</small>';
    };
    const carte = (qui, nom) => {
      let rows = '';
      if (qui === 'moi') {
        for (const u of ['credit', 'copro', 'fixes']) {
          const have = KC().somme(B, 'moi', u), want = D.need[u].moi;
          if (!have && want < 50) continue;
          const L = V.filter(v => v.qui === 'moi' && v.usage === u);
          rows += '<li><div class="grow"><b>' + esc(L.map(v => v.label).join(', ') || KC().USAGES[u]) + '</b><small>' + esc(KC().USAGES[u]) + (L.length ? ' · le ' + (+L[0].jour || 1) : '') + '</small>' +
            L.map(recu).join(' ') + (Math.abs(have - want) >= 100 ? '<small>en place ' + e0(have) + ' · demandé ' + e0(Math.ceil(want / 100) * 100) + ' ' + action(have, Math.ceil(want / 100) * 100) + '</small>' : '') + '</div><span class="m">' + e0(have) + '</span></li>';
        }
        const tout = KC().somme(B, 'moi', 'tout');
        if (tout) rows += '<li><div class="grow"><b>' + esc(KC().USAGES.tout) + '</b>' + V.filter(v => v.qui === 'moi' && v.usage === 'tout').map(recu).join(' ') + '</div><span class="m">' + e0(tout) + '</span></li>';
      } else {
        const have = KC().somme(B, 'autre'), want = D.T.autre, L = V.filter(v => v.qui === 'autre');
        rows += '<li><div class="grow"><b>' + esc(L.map(v => v.label).join(', ') || 'Virement mensuel') + '</b><small>' + esc(KC().USAGES.tout) + (L.length ? ' · le ' + (+L[0].jour || 1) : '') + '</small>' + L.map(recu).join(' ') +
          (Math.abs(have - want) >= 100 ? '<small>en place ' + e0(have) + ' · demandé ' + e0(Math.ceil(want / 100) * 100) + ' ' + action(have, Math.ceil(want / 100) * 100) + '</small>' : '') + '</div><span class="m">' + e0(have) + '</span></li>';
      }
      const tot = qui === 'moi' ? D.T.moi : D.T.autre, p = qui === 'moi' ? D.ponMoi : D.ponAutre;
      return '<div class="cperso"><div class="rangee"><b>' + esc(nom) + '</b><small class="muted">' + e0(Math.ceil(tot / 100) * 100) + ' par mois demandés par le budget</small></div><ul class="list">' + rows + '</ul>' +
        (p > 0 ? '<p>' + chip('warn', 'virement ponctuel') + ' <b>' + e0(p) + '</b> <small class="muted">une fois, ' + datePonctuel(B, D) + '</small></p>' : '') + '</div>';
    };
    return carte('moi', R.moi) + carte('autre', R.autre) +
      '<div class="row"><button class="btn ghost small" data-ouvrir="secVirements">Modifier les ordres permanents</button></div>' +
      '<p class="muted small">« Demandé » = part de chacun des postes du budget commun (« Ma part » de chaque poste), regroupée par usage ; une charge trimestrielle compte pour sa provision mensuelle. Les banques ne transmettent pas les ordres permanents : la liste se tient ici, Klad vérifie chaque mois leur arrivée.</p>';
  }
  const datePonctuel = (B, D) => { const C = D.C, d = C ? (C.negAt || C.minAt) : ''; return !d ? '' : d <= KB().plusJours(B.auj, 3) ? 'dès que possible' : 'avant le ' + jjmmaa(d); };

  function tresorerie(B, D) {
    const C = D.C, R = KC().reglages(B);
    const W = 340, H = 150, pad = 6, pb = 22;
    const vals = C.months.map(m => m.end).concat(C.months.map(m => m.low), [0, C.start]);
    const lo = Math.min(...vals), hi = Math.max(1, ...vals);
    const y = v => pad + (H - pad - pb) * (hi - v) / Math.max(1, hi - lo);
    const bw = (W - 2 * pad) / C.months.length;
    let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="graph" role="img" aria-label="Solde du compte commun en fin de mois sur 12 mois"><line x1="' + pad + '" x2="' + (W - pad) + '" y1="' + y(0).toFixed(1) + '" y2="' + y(0).toFixed(1) + '" stroke="var(--muted)"/>';
    C.months.forEach((mo, i) => {
      const cx = pad + i * bw + bw / 2, w = Math.max(4, bw * 0.5), v = mo.end, top = Math.min(y(v), y(0)), hh = Math.max(1, Math.abs(y(v) - y(0)));
      s += '<rect x="' + (cx - w / 2).toFixed(1) + '" y="' + top.toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + hh.toFixed(1) + '" rx="2" fill="' + (v < 0 ? 'var(--bad)' : 'var(--ok)') + '" opacity=".85"/>';
      if (mo.low < v - 50) s += '<line x1="' + (cx - w / 2 - 2).toFixed(1) + '" x2="' + (cx + w / 2 + 2).toFixed(1) + '" y1="' + y(mo.low).toFixed(1) + '" y2="' + y(mo.low).toFixed(1) + '" stroke="' + (mo.low < 0 ? 'var(--bad)' : 'var(--ink)') + '" stroke-width="2"/>';
      if (i % 2 === 0) s += '<text x="' + cx.toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle" font-size="9" fill="var(--muted)">' + esc(moisC(mo.m)) + '</text>';
    });
    s += '</svg>';
    const parts = [];
    parts.push('Solde aujourd\'hui ' + (C.start < 0 ? e2(-C.start) + ' débiteur' : e2(C.start)) + (C.start < 0 ? (D.retourPositif ? ' ; il repasse positif ' + (D.retourPositif === B.auj.slice(0, 7) ? 'ce mois-ci' : 'en ' + mois(D.retourPositif)) + ' avec les virements' : ' et ne repasse pas positif sur 12 mois') : '') + '.');
    parts.push(D.prochainBas ? 'Prochain point bas : découvert de ' + e2(-D.prochainBas.v) + ' en ' + mois(D.prochainBas.m) + (D.recM > 50 ? ', parce que ' + D.rec.map(x => x.lab.toLowerCase()).join(' et ') + ' coûtent ' + e2(D.recM) + ' de plus par mois que le budget.' : '.') : 'Aucun découvert prévu ensuite sur 12 mois.');
    const Rz = [];
    if (D.pas > 50) Rz.push('Creux passager : ' + e0(D.pas) + ' d\'échéances payées d\'un coup ; les mises de côté des mois suivants le comblent.');
    if (D.recM > 50) Rz.push('Manque qui revient : ' + e2(D.recM) + ' de plus par mois de contrats au-dessus du budget → aligner le budget des postes concernés augmente les virements demandés.');
    if (D.pon > 0) Rz.push('Le virement ponctuel de ' + e0(D.pon) + ' (' + e0(D.ponMoi) + ' ' + R.moi + ' · ' + e0(D.ponAutre) + ' ' + R.autre + ', au prorata des charges non mensuelles : ' + Math.round(D.wG * 100) + ' / ' + Math.round(100 - D.wG * 100) + ') évite le découvert du ' + jjmmaa(C.minAt) + '.');
    if (!Rz.length) Rz.push('La réserve couvre les échéances des 12 prochains mois.');
    return '<div class="rangee"><span>Solde le plus bas prévu</span><span>' + solde(C.min) + ' <small class="muted">le ' + jjmmaa(C.minAt) + '</small></span></div>' + s +
      '<p class="small">' + esc(parts.join(' ')) + '</p>' +
      '<h4>Prochaines échéances non mensuelles</h4>' + (C.due.length ? '<ul class="list">' + C.due.slice(0, 6).map(d => '<li><div class="grow">' + esc(d.lab) + '<small>' + esc(moisC(d.m)) + '</small></div>' + (d.late ? chip('bad', 'en retard') : '') + '<span class="m">' + esc(e2(d.v)) + '</span></li>').join('') + '</ul>' : '<p class="muted">aucune</p>') +
      '<p class="small">Réserve : ' + e0(D.pW) + ' mis de côté par mois. ' + esc(Rz.join(' ')) + '</p>' +
      '<p class="muted small">Barres : solde en fin de mois ; trait : point le plus bas du mois. Départ : solde réel du compte commun. Virements permanents à leur jour (ceux déjà reçus ce mois sont exclus), prélèvements mensuels au jour du dernier prélèvement et au montant du contrat, échéances trimestrielles aux mois de trimestre ; un paiement de plusieurs échéances couvre autant de trimestres.</p>';
  }

  function appels(A) {
    return Object.keys(A).map(k => {
      const S = A[k], ok = S.reste < 50;
      const ligneAp = it => {
        const fait = it.paid >= it.a - 1, part = it.paid > 1 && !fait, retard = !fait && S.retard.indexOf(it) >= 0;
        const lab = it.k === 'avance' ? 'Avance de trésorerie' : 'T' + (Math.floor((+it.d.slice(5, 7) - 1) / 3) + 1) + ' ' + it.d.slice(0, 4);
        return '<li><div class="grow"><b>' + lab + '</b><small>exigible le ' + jjmmaa(it.d) + ' · ' + (it.src === 'mail' ? 'appel reçu par mail' + (it.pdf ? '' : ' (montant estimé)') : 'relevé du syndic') + '</small></div>' +
          '<span class="m">' + esc(e2(it.a)) + '</span>' + (fait ? chip('good', 'réglé' + (it.pay.length ? ' le ' + jjmm(it.pay[it.pay.length - 1]) : '')) : part ? chip('warn', 'reste ' + e2(it.a - it.paid)) : chip(retard ? 'bad' : 'info', retard ? 'à payer · en retard' : 'à payer')) + '</li>';
      };
      const chk = S.st ? (Math.abs(S.resteSt - S.reste) < 100 ? 'Conforme au relevé du syndic du ' + jjmm(S.st.at) + '.' : 'Écart avec le relevé du syndic du ' + jjmm(S.st.at) + ' : ' + e2(Math.abs(S.resteSt)) + ' selon le syndic, ' + e2(Math.abs(S.reste)) + ' selon vos virements.') : '';
      return '<div class="cperso"><div class="rangee"><b>' + esc(S.lab) + '</b>' + (ok ? chip('good', 'à jour') : chip(S.retard.length ? 'bad' : 'warn', 'reste à payer ' + e2(S.reste))) + '</div>' +
        '<small class="muted">' + e2(S.totA) + ' appelés · ' + e2(S.totP) + ' virés par le compte commun</small><ul class="list">' + S.items.map(ligneAp).join('') + '</ul>' +
        (ok ? '' : '<p class="note small">Virement à faire : <b>' + esc(e2(S.reste)) + '</b>' + (S.a ? ' à l\'ordre de <b>' + esc(S.a) + '</b>' : '') + (S.iban ? '<br>' + esc(S.iban) : '') + '</p>') +
        (chk ? '<p class="muted small">' + esc(chk) + '</p>' : '') + '</div>';
    }).join('') + '<p class="muted small">Appels de fonds repris de l\'ancienne version (mails et relevé du syndic déjà connus). Chaque virement règle l\'appel le plus ancien en premier.</p>';
  }

  function origine(B, W, D) {
    const tag = k => chip({ passager: 'warn', 'récurrent': 'bad', 'hors budget': 'info', 'écart': 'bad', marge: 'good', 'réserve': 'good' }[k] || 'info', k);
    const pourquoi = x => {
      const w = x.why || {};
      if (w.texte) return w.texte;
      if (w.gros) return w.gros.map(o => e2(o.montant) + ' payés le ' + jjmm(o.date) + ' = ' + o.n + ' échéances d\'un coup').join(' ; ') + (w.plusQue != null ? ' — plus que les ' + w.n + ' mois mis de côté (' + e0(w.plusQue) + ')' : '');
      if (w.contrat != null) return 'contrat ' + e2(w.contrat) + ' par mois pour un budget de ' + e0(w.budget) + ' → ' + e2(w.contrat - w.budget) + ' de plus chaque mois';
      if (w.preleve != null) return 'prélevé ' + e2(w.preleve) + ' en ' + w.n + ' mois pour ' + e0(w.budget) + ' budgétés';
      if (w.horsBudget) return 'hors budget : ' + w.horsBudget.map(o => e2(o.montant) + ' le ' + jjmm(o.date)).join(', ');
      return '';
    };
    const V = (B.D.virements || []).reduce((t, v) => t + (+v.montant || 0), 0);
    let h = '<p class="muted small">Du 1er ' + mois(W.S) + ' à aujourd\'hui, poste par poste.</p><div class="calc">';
    h += ligne('Solde au 1er ' + mois(W.S), solde(W.B0), 'début des virements actuels');
    h += ligne('plus apports reçus', esc(e2(W.credits)) + (Math.abs(W.credits - W.attendu) < 100 ? '' : ' ' + tag(W.credits < W.attendu ? 'écart' : 'marge')), W.n + ' mois × ' + e0(V) + ' attendus = ' + e2(W.attendu));
    h += ligne('moins budget du commun', esc(e2(W.bud)), W.n + ' mois, provisions trimestrielles comprises');
    for (const x of W.items) h += ligne((x.e > 0 ? 'moins ' : 'plus ') + esc(x.lab), esc(e2(Math.abs(x.e))) + ' ' + tag(x.sorte), esc(pourquoi(x)));
    h += ligne('<b>= Solde aujourd\'hui</b>', solde(W.now));
    return h + '</div>';
  }

  // ------------------------------------------------------------ volet : ordres permanents
  function ordres(B) {
    const R = KC().reglages(B);
    const V = B.D.virements || [];
    return '<p class="muted">Ordres permanents vers le compte commun (les banques ne les transmettent pas).</p>' +
      V.map(v => '<div class="ordre-e" data-vid="' + esc(v.id) + '"><div class="grp"><label>Qui<select data-vf="qui"><option value="moi"' + (v.qui === 'moi' ? ' selected' : '') + '>' + esc(R.moi) + '</option><option value="autre"' + (v.qui === 'autre' ? ' selected' : '') + '>' + esc(R.autre) + '</option></select></label>' +
        '<label>Libellé<input data-vf="label" maxlength="60" value="' + esc(v.label) + '"></label></div>' +
        '<div class="grp"><label>Montant<input data-vf="montant" inputmode="decimal" value="' + esc(F().versSaisie(v.montant)) + '"></label><label>Jour<input data-vf="jour" inputmode="numeric" value="' + (+v.jour || 1) + '"></label>' +
        '<label>Usage<select data-vf="usage">' + Object.keys(KC().USAGES).map(u => '<option value="' + u + '"' + (v.usage === u ? ' selected' : '') + '>' + esc(KC().USAGES[u]) + '</option>').join('') + '</select></label></div>' +
        '<div class="row"><button class="btn danger small" data-vsuppr="' + esc(v.id) + '">Supprimer</button></div></div>').join('') +
      '<div class="row"><button class="btn ghost small" data-vajout="1">Ajouter un virement</button><button class="btn" data-vok="1">Enregistrer</button></div>';
  }

  // ------------------------------------------------------------ volet : équilibre des apports
  function equilibre(B, sim) {
    const R = KC().equilibre(B), N = KC().reglages(B);
    if (!R) return '<p class="muted">L\'équilibre des apports demande l\'historique du compte commun et les apports initiaux (complément de l\'ancienne version).</p>';
    const tot = R.invMoi + R.invAutre, pM = tot > 0 ? R.invMoi / tot * 100 : 50;
    const ecart = Math.abs(R.ecart), quiDoit = R.ecart > 0 ? N.moi : N.autre, autre = R.ecart > 0 ? N.autre : N.moi;
    const dur = n => { const y = Math.floor(n / 12), m = n % 12; return (y ? y + ' an' + (y > 1 ? 's' : '') : '') + (y && m ? ' et ' : '') + (m ? m + ' mois' : '') || 'ce mois-ci'; };
    let h = '<div class="eqbar" role="img" aria-label="' + esc(N.moi) + ' ' + Math.round(pM) + ' %, ' + esc(N.autre) + ' ' + Math.round(100 - pM) + ' %"><i class="g" style="width:' + pM.toFixed(1) + '%"><span>' + esc(N.moi) + ' ' + Math.round(pM) + ' %</span></i><i class="s" style="width:' + (100 - pM).toFixed(1) + '%"><span>' + esc(N.autre) + ' ' + Math.round(100 - pM) + ' %</span></i><em></em></div>';
    h += '<div class="carte bsolde"><b>Reste à combler</b><div class="grand">' + (ecart < 100 ? '0 €' : esc(e0(ecart))) + '</div><small class="muted">' + (ecart < 100 ? 'équilibre atteint' : esc(quiDoit) + ' doit encore investir ' + esc(e0(ecart)) + ' de plus que ' + esc(autre)) + '</small>' +
      ligne('Rattrapage par mois', esc(e0(Math.abs(R.rythme))) + ' <small class="muted">' + (R.rythme >= 0 ? 'en faveur de ' + esc(N.moi) : 'en faveur de ' + esc(N.autre)) + '</small>', esc(N.moi) + ' ' + e0(R.mensMoi) + ' · ' + esc(N.autre) + ' ' + e0(R.mensAutre) + ' (postes « équilibre »)') +
      ligne('Équilibre atteint vers', R.dateEquilibre ? '<b>' + esc(mois(R.dateEquilibre)) + '</b>' : 'jamais', R.dateEquilibre ? 'dans ' + dur(R.mois) + ' au rythme actuel' : 'au rythme actuel, l\'écart ne se réduit pas') + '</div>';
    const s = sim || {};
    let simTxt = '<span class="muted">Saisissez un montant pour voir l\'effet sur la date d\'équilibre.</span>';
    if (s.x || s.y) {
      const r = KC().simuler(R, s.x || 0, s.y || 0);
      simTxt = r.immediat ? '<b class="ok">Équilibre atteint tout de suite</b> <small>(' + e0(r.surplus) + ' au-delà)</small>' : r.jamais ? '<b class="bad">L\'écart ne se réduit pas</b>' : 'Équilibre vers <b>' + esc(mois(r.date)) + '</b> <small>dans ' + dur(r.mois) + (r.gain > 0 ? ' · ' + dur(r.gain) + ' plus tôt' : '') + '</small>';
    }
    h += '<h4>Simuler</h4><div class="grp"><label>' + esc(quiDoit) + ' ajoute par mois<input id="eqSimX" inputmode="decimal" value="' + (s.x ? F().versSaisie(s.x) : '') + '" placeholder="0"></label><label>Versement ponctuel<input id="eqSimY" inputmode="decimal" value="' + (s.y ? F().versSaisie(s.y) : '') + '" placeholder="0"></label></div><p id="eqSimOut">' + simTxt + '</p>';
    const L = (lab, a, b, note, cls) => '<tr' + (cls ? ' class="' + cls + '"' : '') + '><th>' + lab + (note ? '<small>' + esc(note) + '</small>' : '') + '</th><td>' + esc(e0(Math.abs(a))) + '</td><td>' + esc(e0(Math.abs(b))) + '</td></tr>';
    h += '<h4>Composition</h4><table class="ravt"><thead><tr><th></th><th>' + esc(N.moi) + '</th><th>' + esc(N.autre) + '</th></tr></thead><tbody>' +
      L('Apport initial', R.apport.moi, R.apport.autre, 'valeurs fixes') +
      L('plus versements sur le compte commun', R.versMoi, R.versAutre, 'mis à jour à chaque synchronisation') +
      L('moins part des charges qui ne comptent pas', R.nonElig * R.rNE, R.nonElig * (1 - R.rNE), 'énergie, eau, internet, assurance habitation, frais, impôts et autres, réparties ' + Math.round(100 * R.rNE) + ' / ' + Math.round(100 * (1 - R.rNE))) +
      L('plus équipements et travaux payés en direct', R.equipMoi, R.equipAutre, 'dépenses cochées ci-dessous') +
      L('= Investi', R.invMoi, R.invAutre, '', 'rvt') +
      L('Versé chaque mois sur les postes « équilibre »', R.mensMoi, R.mensAutre, '', 'mg') + '</tbody></table>';
    h += '<h4>Utilisation du compte commun</h4><ul class="list">' +
      [['Échéances des prêts et assurance emprunteur', R.pret], ['Appels de fonds et travaux', R.travaux], [R.libelles.ch, -(R.S.ch || 0)], [R.libelles.cp, -(R.S.cp || 0)],
        [R.libelles.en, -(R.S.en || 0)], ['Frais bancaires, impôt et autres dépenses communes', -((R.S.fb || 0) + (R.S.im || 0) + (R.S.ot || 0))]]
        .map(([l, v]) => '<li><div class="grow">' + esc(l) + '</div><span class="m">' + esc(e0(Math.abs(v))) + '</span></li>').join('') + '</ul>';
    h += '<h4>Équipements et travaux payés en direct</h4><ul class="list">' + R.EQ.map(x => '<li><label class="inline grow"><input type="checkbox" data-eqon="' + esc(x.id) + '"' + (x.on ? ' checked' : '') + '> <span>' + esc(x.label) +
      '<small class="muted block">' + esc([x.detail, x.date ? jjmmaa(x.date) : ''].filter(Boolean).join(' · ')) + '</small></span></label><span class="m small">' + (x.moi ? esc(N.moi) + ' ' + e0(x.moi) : '') + (x.autre ? '<br>' + esc(N.autre) + ' ' + e0(x.autre) : '') + '</span>' +
      (x.fixe ? '' : '<button class="btn ghost small" data-eqsuppr="' + esc(x.id) + '" aria-label="Retirer">✕</button>') + '</li>').join('') + '</ul>' +
      '<details><summary>Ajouter une dépense</summary><div class="grp"><label>Libellé<input id="eqLab" maxlength="80"></label><label>Date<input id="eqDate" type="date"></label></div>' +
      '<div class="grp"><label>Payé par ' + esc(N.moi) + '<input id="eqMoi" inputmode="decimal"></label><label>Payé par ' + esc(N.autre) + '<input id="eqAutre" inputmode="decimal"></label></div><div class="row"><button class="btn small" data-eqajout="1">Ajouter</button></div></details>';
    const ks = Object.keys(R.libelles).filter(k => Math.abs(R.S[k] || 0) > 50).sort((x, y) => Math.abs(R.S[y]) - Math.abs(R.S[x]));
    h += '<h4>Mouvements du compte commun</h4><ul class="list">' + ks.map(k => '<li><div class="grow">' + esc(R.libelles[k]) + '</div><span class="m">' + esc(e0(Math.abs(R.S[k]))) + (R.S[k] > 0 ? ' <small class="muted">reçus</small>' : '') + '</span></li>').join('') + '</ul>' +
      '<p class="muted small">' + R.OPS.length + ' mouvements, du ' + jjmmaa(R.OPS[0][0]) + ' au ' + jjmmaa(R.OPS[R.OPS.length - 1][0]) + '.</p>';
    return h;
  }

  g.KladVuesCommun = { cartes, ordres, equilibre };
})(typeof window !== 'undefined' ? window : globalThis);
