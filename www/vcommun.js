// Klad — rendu du compte commun comme l'ancienne version : « Virements à mettre en place » (par personne : en place,
// demandé, reçu ; virement ponctuel), appels de fonds, trésorerie sur 12 mois, « d'où vient le solde » ; écran
// « Équilibre » (barre vers le 50 / 50, reste à combler, rattrapage, date d'équilibre, simulation, composition,
// investissement cumulé, utilisation du compte commun, dépenses payées en direct, tous les mouvements) ; ordres permanents.
// Chaînes HTML, sans DOM (testées dans node). Jamais de montant négatif affiché : « débiteur », « découvert »,
// « de plus / de moins », « qui doit combien à qui ».
(function (g) {
  'use strict';

  const KC = () => g.KladCommun;
  const KB = () => g.KladBudget;
  const F = () => g.KladFormat;
  const U = () => g.KladUI;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const e0 = c => KB().eur(c);
  const e2 = c => F().montant(c);
  const s2 = c => esc(e2(Math.abs(c))) + (c < 0 ? ' débiteur' : '');
  const dfr = d => U().dfr(d);
  const jjmm = d => U().jjmm(d);
  const mLabel = m => U().mLabel(m);
  const MOIS_L = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const chip = (niv, t) => '<span class="chip ' + niv + '">' + esc(t) + '</span>';
  const pl = (n, s, p) => n + ' ' + (n > 1 ? (p || s + 's') : s);
  // Sous-bloc repliable (cm-sub) ; ouverts : Set des clés dépliées par l'utilisateur, def : ouvert par défaut.
  const cmSub = (ouverts, k, titre, resume, corps, def) => {
    const o = ouverts && ouverts.has('cm|' + k) ? true : ouverts && ouverts.has('cm-|' + k) ? false : !!def;
    return '<details class="cm-sub" data-cc="cm|' + k + '"' + (o ? ' open' : '') + '><summary><span class="cms-t">' + titre + '</span><span class="cms-s">' + resume + '</span></summary><div class="cs-b">' + corps + '</div></details>';
  };

  // ------------------------------------------------------------ « Virements à mettre en place » (cm-plan)
  // ui : { cartes: Set (sous-blocs dépliés) }.
  function plan(B, ui) {
    const MR = KC().margeReelle(B);
    if (!MR) return '<div class="panel-h"><h2>Virements à mettre en place</h2></div><p class="note">Le solde du compte commun n\'est pas encore connu : virements, trésorerie et fin de mois apparaîtront avec le prochain relevé.</p>';
    const R = KC().reglages(B), D = KC().plan(B), V = B.D.virements || [], C = D.C;
    const ouv = ui && ui.cartes;
    const act = (have, want) => { const d = have - want; return Math.abs(d) < 100 ? chip('good', 'à garder') : d < 0 ? chip('bad', 'passer à ' + e0(want)) + ' <span class="subs">' + e0(-d) + ' de plus</span>' : chip('info', 'marge ' + e0(d)) + ' <span class="subs">peut passer à ' + e0(want) + '</span>'; };
    const recu = v => { const x = D.recus.find(y => y.v === v); if (x && x.vu) return Math.abs(x.vu.m - v.montant) > 1 ? chip('warn', 'reçu ' + e2(x.vu.m) + ' le ' + jjmm(x.vu.date) + ' · prévu ' + e0(v.montant)) : chip('good', 'reçu le ' + jjmm(x.vu.date)); return x && x.retard ? chip('bad', 'non reçu') : chip('info', 'attendu le ' + (+v.jour || 1)); };
    const pD = C ? (C.negAt || C.minAt) : '', pDate = !pD ? '' : pD <= KB().plusJours(B.auj, 3) ? 'dès que possible' : 'avant le ' + dfr(pD);
    const vline = (lab, sub, have, want, L) => {
      const diff = want !== null && Math.abs(have - want) >= 100;
      return '<div class="vo"><b class="vo-n">' + esc(lab) + '</b><b class="num vo-a">' + e0(have) + '</b><div class="vo-s"><span class="subs">' + esc(sub) + '</span>' + L.map(recu).join(' ') + '</div>' +
        (diff ? '<div class="vo-d"><span class="subs">en place ' + e0(have) + ' → demandé ' + e0(want) + '</span> ' + act(have, want) + '</div>' : '') + '</div>';
    };
    const card = (qui, nom) => {
      let rows = '';
      if (qui === 'moi') {
        for (const u of ['credit', 'copro', 'fixes']) {
          const have = KC().somme(B, 'moi', u), want = Math.ceil(D.need[u].moi / 100) * 100;
          if (!have && want < 50) continue;
          const L = V.filter(v => v.qui === 'moi' && v.usage === u);
          rows += vline(L.map(v => v.label).join(', ') || KC().USAGES[u], KC().USAGES[u] + (L.length ? ' · le ' + (+L[0].jour || 1) : ''), have, want, L);
        }
        const tout = KC().somme(B, 'moi', 'tout');
        if (tout) rows += vline(KC().USAGES.tout, '', tout, null, V.filter(v => v.qui === 'moi' && v.usage === 'tout'));
      } else {
        const have = KC().somme(B, 'autre'), want = Math.ceil(D.T.autre / 100) * 100, L = V.filter(v => v.qui === 'autre');
        rows += vline(L.map(v => v.label).join(', ') || 'Virement mensuel', KC().USAGES.tout + (L.length ? ' · le ' + (+L[0].jour || 1) : ''), have, want, L);
      }
      const tot = qui === 'moi' ? D.T.moi : D.T.autre, p = qui === 'moi' ? D.ponMoi : D.ponAutre;
      return '<div class="cmp-card"><div class="cmp-h"><b>' + esc(nom) + '</b><span class="subs"><b class="num">' + e0(Math.ceil(tot / 100) * 100) + '</b> / mois demandés par le budget</span></div><div class="vo-list">' + rows + '</div>' +
        (p > 0 ? '<div class="cmp-pon">' + chip('warn', 'virement ponctuel') + ' <b class="num">' + e0(p) + '</b> <span class="subs">une fois, ' + esc(pDate) + '</span></div>' : '') + '</div>';
    };
    let h = '<div class="panel-h"><h2 class="fold" role="button" tabindex="0" title="Replier / déplier">Virements à mettre en place</h2><div class="row"><span class="muted">' +
      (D.changes.length ? pl(D.changes.length, 'ordre') + ' à modifier' : 'ordres permanents conformes au budget') + (D.pon > 0 ? ' · 1 virement ponctuel' : '') + '</span>' +
      '<button class="btn" type="button" data-ouvrir="secVirements">Modifier les ordres</button></div></div>' +
      '<div class="cmp-grid">' + card('moi', R.moi) + card('autre', R.autre) + '</div>' +
      U().comment('« Demandé » = part de chacun des postes du budget commun (colonne « ma part » du mode Budget), regroupée par usage ; les charges trimestrielles comptent pour leur provision mensuelle. Les banques ne transmettent pas les ordres permanents : la liste se tient ici (« Modifier les ordres »), Klad vérifie chaque mois leur arrivée sur le compte commun.');
    h += appels(B, ouv);
    if (C) h += cmSub(ouv, 'cash', 'Trésorerie · 12 mois', '<span class="' + (C.min < 0 ? 'bad-t' : '') + '">plus bas <b class="num">' + s2(C.min) + '</b> le ' + jjmm(C.minAt) + '</span>', tresorerie(B, D, R), false);
    else h += cmSub(ouv, 'cash', 'Trésorerie · 12 mois', '', '<p class="note">Trésorerie indisponible : pas encore de solde pour le compte commun.</p>', false);
    if (D.W) h += origine(B, D, ouv);
    return h;
  }

  function tresorerie(B, D, R) {
    const C = D.C, cur = B.auj.slice(0, 7);
    const Wd = 340, H = 140, pad = { l: 48, r: 8, t: 10, b: 22 };
    const vals = C.months.map(m => m.end).concat(C.months.map(m => m.low), [0, C.start]);
    const lo = Math.min(...vals), hi = Math.max(100, ...vals);
    const step = (() => { const r = (hi - lo) / 5, e = Math.pow(10, Math.floor(Math.log10(Math.max(r, 1)))), f = r / e; return (f <= 1.5 ? 1 : f <= 3 ? 2 : f <= 7 ? 5 : 10) * e; })();
    const top = Math.ceil(hi / step) * step, bot = Math.floor(lo / step) * step;
    const y = v => pad.t + (top - v) / (top - bot || 1) * (H - pad.t - pad.b);
    let sv = '';
    for (let v = bot; v <= top + 1e-6; v += step) sv += '<line x1="' + pad.l + '" x2="' + (Wd - pad.r) + '" y1="' + y(v).toFixed(1) + '" y2="' + y(v).toFixed(1) + '" stroke="var(--line)" stroke-width="1"/><text x="' + (pad.l - 6) + '" y="' + (y(v) + 4).toFixed(1) + '" text-anchor="end" fill="' + U().couleurGraduation(v) + '" font-family="JetBrains Mono, monospace" font-size="10">' + U().graduation(v) + '</text>';
    sv += '<line x1="' + pad.l + '" x2="' + (Wd - pad.r) + '" y1="' + y(0).toFixed(1) + '" y2="' + y(0).toFixed(1) + '" stroke="var(--muted)"/>';
    const n = C.months.length, bw = (Wd - pad.l - pad.r) / n;
    C.months.forEach((mo, i) => {
      const cx = pad.l + i * bw + bw / 2, bwi = Math.max(4, Math.min(26, bw * 0.5)), v = mo.end, tp = Math.min(y(v), y(0)), hh = Math.max(1, Math.abs(y(v) - y(0)));
      sv += '<rect x="' + (cx - bwi / 2).toFixed(1) + '" y="' + tp.toFixed(1) + '" width="' + bwi.toFixed(1) + '" height="' + hh.toFixed(1) + '" rx="2" fill="' + (v < 0 ? 'var(--bad)' : 'var(--good)') + '" opacity=".85"><title>' + esc(mLabel(mo.m)) + ' : fin de mois ' + s2(v) + (mo.low < v - 50 ? ' · point bas ' + s2(mo.low) : '') + '</title></rect>';
      if (mo.low < v - 50) sv += '<line x1="' + (cx - bwi / 2 - 2).toFixed(1) + '" x2="' + (cx + bwi / 2 + 2).toFixed(1) + '" y1="' + y(mo.low).toFixed(1) + '" y2="' + y(mo.low).toFixed(1) + '" stroke="' + (mo.low < 0 ? 'var(--bad)' : 'var(--ink-2)') + '" stroke-width="2"/>';
      if (i % Math.max(1, Math.ceil(56 / bw)) === 0) sv += '<text x="' + cx.toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle" fill="var(--muted)" font-family="JetBrains Mono, monospace" font-size="10">' + esc(mLabel(mo.m)) + '</text>';
    });
    const parts = [];
    parts.push('Solde aujourd\'hui ' + s2(C.start) + (C.start < 0 ? (D.retourPositif ? ' ; il repasse positif ' + (D.retourPositif === cur ? 'ce mois-ci' : 'en ' + MOIS_L[+D.retourPositif.slice(5) - 1]) + ' avec les virements' : ' et ne repasse pas positif sur 12 mois') : '') + '.');
    parts.push(D.prochainBas ? 'Prochain point bas : découvert de ' + e2(-D.prochainBas.v) + ' en ' + MOIS_L[+D.prochainBas.m.slice(5) - 1] + ' ' + D.prochainBas.m.slice(0, 4) + (D.recM > 50 ? ', parce que ' + D.rec.map(x => x.lab.toLowerCase()).join(' et ') + ' coûtent ' + e2(D.recM) + ' de plus par mois que le budget.' : '.') : 'Aucun découvert prévu ensuite sur 12 mois.');
    const Rz = [];
    if (D.pas > 50) Rz.push('<b>Creux passager</b> : ' + e0(D.pas) + ' d\'échéances payées d\'un coup (voir plus bas) ; les mises de côté des mois suivants le comblent.');
    if (D.recM > 50) Rz.push('<b>Manque qui revient</b> : ' + e2(D.recM) + ' de plus par mois de contrats au-dessus du budget → aligner le budget (bouton sous chaque poste) augmente les virements demandés.');
    if (D.pon > 0) Rz.push('Le <b>virement ponctuel de ' + e0(D.pon) + '</b> (' + e0(D.ponMoi) + ' ' + esc(R.moi) + ' · ' + e0(D.ponAutre) + ' ' + esc(R.autre) + ', au prorata des charges non mensuelles : ' + Math.round(D.wG * 100) + ' / ' + Math.round(100 - D.wG * 100) + ') évite le découvert du ' + dfr(C.minAt) + '.');
    if (!Rz.length) Rz.push('La réserve couvre les échéances des 12 prochains mois.');
    const dueTxt = C.due.slice(0, 6).map(d => '<li><span class="du-m">' + esc(mLabel(d.m)) + '</span><span class="du-l">' + esc(String(d.lab).replace(/^Charges de copropriété$/, 'Copropriété').replace(/^Charges parking$/, 'Parking')) + (d.late ? ' ' + chip('bad', 'en retard') : '') + '</span><b class="num du-v">' + e2(d.v) + '</b></li>').join('');
    return '<div class="cm-cash"><div><div class="cm-min ' + (C.min < 0 ? 'neg' : 'pos') + '"><span class="sb-l">Solde le plus bas prévu</span><b class="num">' + s2(C.min) + '</b><span class="subs">le ' + dfr(C.minAt) + (C.min < 0 ? ' — découvert si rien ne change' : ' — pas de découvert prévu') + '</span></div>' +
      '<svg viewBox="0 0 ' + Wd + ' ' + H + '" width="100%" height="' + H + '" preserveAspectRatio="none" role="img" aria-label="Solde du compte commun en fin de mois sur 12 mois">' + sv + '</svg><p class="cm-sit">' + esc(parts.join(' ')) + '</p>' +
      U().comment('Barres : solde en fin de mois ; trait : point le plus bas du mois. Départ : solde réel du compte commun. Virements permanents à leur jour (ceux déjà reçus ce mois sont exclus), prélèvements mensuels au jour du dernier prélèvement et au montant du contrat, échéances trimestrielles aux mois de trimestre ; un paiement de plusieurs échéances couvre autant de trimestres.') + '</div>' +
      '<div class="cm-due"><span class="sb-l">Prochaines échéances non mensuelles</span>' + (dueTxt ? '<ul>' + dueTxt + '</ul>' : '<p class="muted">aucune</p>') +
      '<span class="sb-l" style="margin-top:8px">Réserve · ' + e0(D.pW) + ' mis de côté par mois</span><p class="subs" style="margin:2px 0 0">' + Rz.join(' ') + '</p></div></div>';
  }

  function appels(B, ouv) {
    const A = KC().appels(B), ks = Object.keys(A);
    if (!ks.length) return '';
    const tot = ks.reduce((t, k) => t + Math.max(0, A[k].reste), 0);
    const card = k => {
      const S = A[k], ok = S.reste < 50;
      const quart = it => it.k === 'avance' ? 'Avance de trésorerie' : 'T' + (Math.floor((+it.d.slice(5, 7) - 1) / 3) + 1) + ' ' + it.d.slice(0, 4);
      const row = it => {
        const fait = it.paid >= it.a - 1, part = it.paid > 1 && !fait, late = !fait && it.d < B.auj;
        const src = it.src === 'mail' ? 'mail' + (it.mail ? ' du ' + jjmm(it.mail) : '') + (it.pdf ? ' · PDF lu' : ' · <span class="warn-t">PDF pas encore lu</span>') : '<span class="tag-s" title="Appel présent dans le relevé du syndic mais aucun mail reçu">relevé du syndic</span>';
        return '<div class="ap-r"><div class="ap-l"><b>' + quart(it) + '</b><span class="subs">exigible le ' + jjmm(it.d) + ' · ' + src + '</span></div><div class="ap-v"><b class="num">' + e2(it.a) + '</b>' + (it.est ? '<span class="subs">estimé</span>' : '') +
          (fait ? chip('good', 'réglé' + (it.pay.length ? ' le ' + jjmm(it.pay[it.pay.length - 1]) : '')) : part ? chip('warn', 'reste ' + e2(it.a - it.paid)) : chip(late ? 'bad' : 'info', late ? 'à payer · en retard' : 'à payer')) + '</div></div>';
      };
      const fait = it => it.paid >= it.a - 1, dn = S.items.filter(fait), op = S.items.filter(it => !fait(it));
      const rows = (dn.length ? '<details class="ap-done"><summary>' + pl(dn.length, 'appel') + ' réglé' + (dn.length > 1 ? 's' : '') + ' · ' + e2(dn.reduce((t, it) => t + it.a, 0)) + ' ' + chip('good', '✓') + '</summary>' + dn.map(row).join('') + '</details>' : '') + op.map(row).join('');
      const chk = S.st ? (Math.abs(S.resteSt - S.reste) < 100 ? 'Conforme au relevé du syndic du ' + jjmm(S.st.at) + '.' : '<span class="bad-t">Écart avec le relevé du syndic du ' + jjmm(S.st.at) + ' : ' + e2(Math.abs(S.resteSt)) + ' selon le syndic, ' + e2(Math.abs(S.reste)) + ' selon vos virements.</span>') : '';
      return '<div class="ap-card' + (ok ? '' : ' due') + '"><div class="cmp-h"><b>' + esc(S.lab) + '</b>' + (ok ? chip('good', 'à jour') : chip(S.retard.length ? 'bad' : 'warn', 'reste à payer ' + e2(S.reste))) + '</div>' +
        '<div class="subs">' + e2(S.totA) + ' appelés · ' + e2(S.totP) + ' virés par le compte commun</div><div class="ap-list">' + rows + '</div>' +
        (ok ? '' : '<p class="ap-pay">Virement à faire : <b class="num">' + e2(S.reste) + '</b>' + (S.a ? ' à l\'ordre de <b>' + esc(S.a) + '</b>' : '') + (S.iban ? '<br><span class="num">' + esc(S.iban) + '</span>' : '') + '</p>') +
        (chk ? '<p class="subs" style="margin:6px 0 0">' + chk + '</p>' : '') + '</div>';
    };
    const mail0 = g.KladExtras && g.KladExtras.etatMail ? g.KladExtras.etatMail(B.S) : '';
    // Nom de la résidence et du syndic : données du complément (appels.titre, appels.syndic), jamais dans le code.
    const AR = KC().reglages(B).appels || {};
    const mail = [AR.syndic ? esc(AR.syndic) : '', mail0].filter(Boolean).join(' · ');
    return cmSub(ouv, 'ap', 'Appels de fonds' + (AR.titre ? ' ' + esc(AR.titre) : ''), tot > 50 ? '<b class="bad-t num">' + e2(tot) + ' à virer</b>' : chip('good', 'à jour'),
      (mail ? '<p class="subs" style="margin:0 0 6px">' + mail + '</p>' : '') + '<p class="cm-sit" style="margin:0 0 8px">' + (tot > 50 ? '<b class="bad-t">' + e2(tot) + ' restent à virer au syndic.</b>' : 'Tous les appels reçus sont réglés.') + '</p><div class="cmp-grid">' + ks.map(card).join('') + '</div>' +
      (g.KladExtras && (g.KladExtras.actif(B.S, 'mail') || g.KladExtras.actif(B.S, 'claude')) ? '<div class="row">' +
        (g.KladExtras.actif(B.S, 'mail') ? '<button class="btn" type="button" data-liremails="1">Lire les mails</button>' : '') +
        (g.KladExtras.actif(B.S, 'claude') ? '<button class="btn" type="button" data-lireappel="1">Lire un appel (PDF)</button>' : '') + '</div>' : '') +
      U().comment('Un appel de fonds par mail du syndic ; montant lu dans le PDF joint quand il est connu, sinon estimé d\'après le relevé du syndic ou l\'appel précédent. Les appels du relevé du syndic sans mail sont aussi comptés. Chaque virement du compte commun vers le syndic règle l\'appel le plus ancien en premier.'), tot > 50);
  }

  function origine(B, D, ouv) {
    const W = D.W;
    const tag = k => chip({ passager: 'warn', 'récurrent': 'bad', 'hors budget': 'info', 'écart': 'bad', marge: 'good', 'réserve': 'good' }[k] || 'info', k);
    const pourquoi = x => {
      const w = x.why || {};
      if (w.texte) return w.texte;
      if (w.gros) return w.gros.map(o => e2(o.montant) + ' payés le ' + jjmm(o.date) + ' = ' + o.n + ' échéances d\'un coup').join(' ; ') + (w.plusQue != null ? ' — plus que les ' + w.n + ' mois mis de côté (' + e0(w.plusQue) + ')' : '');
      if (w.contrat != null) return 'contrat ' + e2(w.contrat) + ' / mois pour un budget de ' + e0(w.budget) + ' → ' + e2(w.contrat - w.budget) + ' de plus chaque mois';
      if (w.preleve != null) return 'prélevé ' + e2(w.preleve) + ' en ' + w.n + ' mois pour ' + e0(w.budget) + ' budgétés';
      if (w.horsBudget) return 'hors budget : ' + w.horsBudget.map(o => e2(o.montant) + ' le ' + jjmm(o.date)).join(', ');
      return '';
    };
    const V = (B.D.virements || []).reduce((t, v) => t + (+v.montant || 0), 0);
    const mo = MOIS_L[+W.S.slice(5) - 1];
    const wr = (lab, sub, val, cls, tg, tot) => '<div class="cr-r' + (tot ? ' tot' : '') + '"><span class="cr-l">' + lab + (sub ? '<span class="subs">' + sub + '</span>' : '') + '</span><span class="wr-v">' + (tg || '') + '<b class="num ' + (cls || '') + '">' + val + '</b></span></div>';
    const rows = wr('Solde au 1er ' + mo + ' ' + W.S.slice(0, 4), 'début des virements actuels', s2(W.B0)) +
      wr('+ Apports reçus', W.n + ' mois × ' + e0(V) + ' attendus = ' + e2(W.attendu), '+' + e2(W.credits), 'pos-t', Math.abs(W.credits - W.attendu) < 100 ? '' : tag(W.credits < W.attendu ? 'écart' : 'marge')) +
      wr('− Budget du commun', W.n + ' mois, provisions trimestrielles comprises', e2(W.bud)) +
      W.items.map(x => wr((x.e > 0 ? '− ' : '+ ') + esc(x.lab), esc(pourquoi(x)), (x.e > 0 ? '' : '+') + e2(Math.abs(x.e)), x.e > 0 ? 'bad-t' : 'pos-t', tag(x.sorte))).join('') +
      wr('= Solde aujourd\'hui', '', s2(W.now), W.now < 0 ? 'bad-t' : '', '', true);
    const rec = W.items.filter(x => x.sorte === 'récurrent').reduce((t, x) => t + x.e, 0), hbv = W.items.filter(x => x.sorte === 'hors budget').reduce((t, x) => t + x.e, 0);
    const bits = [D.pas > 50 ? 'd\'échéances payées d\'un coup (' + e0(D.pas) + ', <b>passager</b>)' : '', hbv > 50 ? 'de dépenses hors budget (' + e0(hbv) + ')' : '', rec > 50 ? 'de contrats au-dessus du budget (' + e0(rec) + ' depuis ' + mo + ', <b>revient chaque mois</b>)' : ''].filter(Boolean);
    const concl = W.now < -50 ? (bits.length ? 'Le solde est débiteur à cause ' + bits.join(', ') + '.' : 'Le solde est débiteur : voir le détail poste par poste.') : (bits.length ? 'Écarts depuis ' + mo + ' : ' + bits.join(', ').replace(/^d'|^de /, '') + ', couverts par les marges des autres postes.' : 'Aucun écart notable depuis ' + mo + '.');
    return cmSub(ouv, 'why', D.pon > 0 ? 'Ce que le virement ponctuel compense' : 'D\'où vient le solde', '<span class="num' + (W.now < 0 ? ' bad-t' : '') + '">' + s2(W.now) + '</span>',
      '<p class="subs" style="margin:0 0 6px">Du 1er ' + mo + ' ' + W.S.slice(0, 4) + ' à aujourd\'hui, poste par poste</p><p class="cm-concl">' + concl + '</p><div class="cr-calc why-l">' + rows + '</div>', D.pon > 0);
  }

  // ------------------------------------------------------------ volet : ordres permanents
  function ordres(B) {
    const R = KC().reglages(B);
    const V = B.D.virements || [];
    return '<p class="muted">Ordres permanents vers le compte commun (les banques ne les transmettent pas).</p>' +
      V.map(v => '<div class="ordre-e sh-rule" data-vid="' + esc(v.id) + '"><div class="grp"><label class="sh-l"><span class="sh-lab">Qui</span><select class="sh-in" data-vf="qui"><option value="moi"' + (v.qui === 'moi' ? ' selected' : '') + '>' + esc(R.moi) + '</option><option value="autre"' + (v.qui === 'autre' ? ' selected' : '') + '>' + esc(R.autre) + '</option></select></label>' +
        '<label class="sh-l"><span class="sh-lab">Libellé</span><input class="sh-in" data-vf="label" maxlength="60" value="' + esc(v.label) + '"></label></div>' +
        '<div class="grp"><label class="sh-l"><span class="sh-lab">Montant</span><input class="sh-in" data-vf="montant" inputmode="decimal" value="' + esc(F().versSaisie(v.montant)) + '"></label><label class="sh-l"><span class="sh-lab">Jour</span><input class="sh-in" data-vf="jour" inputmode="numeric" value="' + (+v.jour || 1) + '"></label>' +
        '<label class="sh-l"><span class="sh-lab">Usage</span><select class="sh-in" data-vf="usage">' + Object.keys(KC().USAGES).map(u => '<option value="' + u + '"' + (v.usage === u ? ' selected' : '') + '>' + esc(KC().USAGES[u]) + '</option>').join('') + '</select></label></div>' +
        '<div class="row"><button type="button" class="btn danger small" data-vsuppr="' + esc(v.id) + '">Supprimer</button></div></div>').join('') +
      '<div class="row"><button type="button" class="btn" data-vajout="1">Ajouter un virement</button></div><button type="button" class="sh-go" data-vok="1">Enregistrer</button>';
  }

  // ------------------------------------------------------------ écran « Équilibre » (comme l'ancienne version)
  // ui : { sim: { x, y } (centimes), sorte (filtre des mouvements), equipOuvert }.
  function equilibre(B, ui) {
    const R = KC().equilibre(B), N = KC().reglages(B), o = ui || {};
    if (!R) return '<section class="panel eq-hero" id="eq-hero"><div class="panel-h"><h2>Équilibre de l\'indivision</h2></div><p class="muted">L\'équilibre des apports demande l\'historique du compte commun et les apports initiaux (complément de l\'ancienne version, Plus › Classement).</p></section>';
    const tot = R.invMoi + R.invAutre, pM = tot > 0 ? R.invMoi / tot * 100 : 50;
    const gap = R.ecart, rate = R.rythme, qui = gap > 0 ? N.moi : N.autre, autre = gap > 0 ? N.autre : N.moi;
    const dur = n => { const y = Math.floor(n / 12), m = n % 12; return (y ? y + ' an' + (y > 1 ? 's' : '') : '') + (y && m ? ' et ' : '') + (m ? m + ' mois' : '') || 'ce mois-ci'; };
    // simulation
    const s = o.sim || {};
    let simTxt = '<span class="muted">Saisis un montant pour voir l\'effet sur la date d\'équilibre.</span>';
    if (s.x || s.y) {
      const r = KC().simuler(R, s.x || 0, s.y || 0);
      simTxt = r.immediat ? '<b class="pos-t">Équilibre atteint tout de suite</b> <span class="subs">(le versement couvre l\'écart ; ' + e0(r.surplus) + ' au-delà)</span>' : r.jamais ? '<b class="bad-t">L\'écart ne se réduit pas</b>'
        : 'Équilibre vers <b>' + esc(mLabel(r.date)) + '</b> <span class="subs">dans ' + dur(r.mois) + (r.gain > 0 ? ' · ' + dur(r.gain) + ' plus tôt' : '') + '</span>';
    }
    let h = '<section class="panel eq-hero" id="eq-hero" aria-label="Équilibre de l\'indivision"><div class="panel-h"><h2>Équilibre de l\'indivision</h2><span class="muted">objectif : 50 / 50</span></div>' +
      '<div class="eqh-bar" role="img" aria-label="' + esc(N.moi) + ' ' + Math.round(pM) + ' %, ' + esc(N.autre) + ' ' + Math.round(100 - pM) + ' %"><i class="g" style="width:' + pM.toFixed(1) + '%"><span>' + esc(N.moi) + ' <span class="hide-m">' + e0(R.invMoi) + ' · </span>' + Math.round(pM) + ' %</span></i>' +
      '<i class="s" style="width:' + (100 - pM).toFixed(1) + '%"><span>' + esc(N.autre) + ' <span class="hide-m">' + e0(R.invAutre) + ' · </span>' + Math.round(100 - pM) + ' %</span></i><em title="50 / 50"></em></div>' +
      '<div class="eqh-figs"><div><span class="sb-l">Reste à combler</span><b class="num">' + (Math.abs(gap) < 100 ? '0 €' : e0(Math.abs(gap))) + '</b><span class="subs">' + (Math.abs(gap) < 100 ? 'équilibre atteint' : esc(qui) + ' doit encore investir de plus que ' + esc(autre)) + '</span></div>' +
      '<div><span class="sb-l">Rattrapage par mois</span><b class="num">' + (Math.abs(rate) < 50 ? '0 €' : '+' + e0(Math.abs(rate))) + '</b><span class="subs">' + e0(R.mensMoi) + ' ' + esc(N.moi) + ' − ' + e0(R.mensAutre) + ' ' + esc(N.autre) + ' (postes « Équilibre »)' + (rate < -50 ? ', en faveur de ' + esc(N.autre) : '') + '</span></div>' +
      '<div class="main"><span class="sb-l">Équilibre atteint vers</span><b class="num">' + (R.dateEquilibre ? esc(mLabel(R.dateEquilibre)) : 'jamais') + '</b><span class="subs">' + (R.dateEquilibre ? 'dans ' + dur(R.mois) + ' au rythme actuel' : 'au rythme actuel, l\'écart ne se réduit pas') + '</span></div></div>' +
      '<div class="eqh-sim"><span class="sb-l">Simuler</span><label class="ctl">' + esc(qui) + ' ajoute <input type="text" inputmode="decimal" id="eqSimX" placeholder="0" value="' + (s.x ? esc(F().versSaisie(s.x)) : '') + '"> € / mois</label>' +
      '<label class="ctl">versement ponctuel <input type="text" inputmode="decimal" id="eqSimY" placeholder="0" value="' + (s.y ? esc(F().versSaisie(s.y)) : '') + '"> €</label><span id="eqSimOut">' + simTxt + '</span></div></section>';
    // composition
    const line = (lab, a, b, note, cls) => '<tr' + (cls ? ' class="' + cls + '"' : '') + '><td>' + lab + (note ? '<div class="subs">' + note + '</div>' : '') + '</td><td class="r num">' + e0(Math.abs(a)) + '</td><td class="r num">' + e0(Math.abs(b)) + '</td><td class="r num hide-s">' + e0(Math.abs(b - a)) + '</td></tr>';
    h += '<section class="panel" id="eq-compo-panel">' + U().tete('Comment chacun a investi', '<span class="muted">objectif : parts égales (indivision 50/50)</span>') +
      '<div class="tablewrap"><table class="cats eq-t"><thead><tr><th></th><th class="r">' + esc(N.moi) + '</th><th class="r">' + esc(N.autre) + '</th><th class="r hide-s">Écart</th></tr></thead><tbody id="eq-compo">' +
      line('Apport initial', R.apport.moi, R.apport.autre, 'valeurs fixes') +
      line('+ Versements sur le compte commun', R.versMoi, R.versAutre, 'mis à jour à chaque synchronisation') +
      line('− Part des charges qui ne comptent pas', R.nonElig * R.rNE, R.nonElig * (1 - R.rNE), 'énergie, eau, internet, assurance habitation, frais, impôts et autres dépenses communes, réparties ' + Math.round(100 * R.rNE) + ' / ' + Math.round(100 * (1 - R.rNE)) + ' : elles ne créent pas d\'écart') +
      line('+ Équipements et travaux payés en direct', R.equipMoi, R.equipAutre, 'dépenses cochées plus bas') +
      line('= Investi dans l\'appartement', R.invMoi, R.invAutre, '', 'total') + '<tr class="gsp"><td colspan="4"></td></tr>' +
      '<tr class="total eq-rat"><td>Versé chaque mois sur les postes « Équilibre »<div class="subs">l\'écart mensuel réduit l\'écart d\'investissement</div></td><td class="r num">' + e0(R.mensMoi) + '</td><td class="r num">' + e0(R.mensAutre) + '</td><td class="r num hide-s">' + e0(Math.abs(R.mensMoi - R.mensAutre)) + '</td></tr>' +
      '</tbody></table></div>' + U().comment('Seuls les postes cochés « Équilibre » du budget du compte commun créent le rattrapage. Montants et parts se règlent dans Commun › Budget mensuel › Budget. Les apports initiaux viennent du complément de l\'ancienne version.') + '</section>';
    // graphique cumulé
    h += '<section class="panel" id="eq-chart-panel">' + U().tete('Investissement cumulé de chacun', '<div class="legend" aria-hidden="true"><span><i style="background:var(--rev)"></i>' + esc(N.moi) + '</span><span><i style="background:var(--dep)"></i>' + esc(N.autre) + '</span><span><i class="line" style="background:var(--muted)"></i>Projection</span></div>') +
      '<div class="chartbox" id="eqchart">' + graphique(B, N) + '</div></section>';
    // utilisation du compte commun
    const u = (lab, v, fin) => '<tr><td>' + esc(lab) + '</td><td class="r num">' + e0(Math.abs(v)) + '</td><td>' + esc(fin) + '</td></tr>';
    h += '<section class="panel" id="eq-uses-panel">' + U().tete('Ce que le compte commun a payé, et avec quel argent') +
      '<div class="tablewrap"><table class="cats"><thead><tr><th>Poste</th><th class="r">Montant</th><th>Financé par</th></tr></thead><tbody id="eq-uses">' +
      u('Échéances des prêts et assurance emprunteur', R.pret, 'vos versements mensuels') +
      u('Appels de fonds et travaux', R.travaux, R.debloc > 50 ? 'déblocages du prêt (' + e0(R.debloc) + ')' + (R.travaux - R.debloc > 50 ? ' + ' + e0(R.travaux - R.debloc) + ' de vos versements' : '') : 'vos versements') +
      u(R.libelles.ch, -(R.S.ch || 0), 'vos versements · compte dans l\'équilibre') + u(R.libelles.cp, -(R.S.cp || 0), 'vos versements · compte dans l\'équilibre') +
      u(R.libelles.en, -(R.S.en || 0), 'vos versements · ne compte pas') + u('Frais bancaires, impôt et autres dépenses communes', -((R.S.fb || 0) + (R.S.im || 0) + (R.S.ot || 0)), 'vos versements · ne compte pas') +
      '</tbody></table></div>' + U().comment('Les appels de fonds et travaux passés par le compte commun ont été payés par les déblocages du prêt : ils sont donc remboursés par vos échéances, à hauteur de vos parts de prêt.') + '</section>';
    // dépenses payées en direct
    const on = R.EQ.filter(x => x.on), nMoi = on.reduce((t, x) => t + x.moi, 0), nAutre = on.reduce((t, x) => t + x.autre, 0);
    h += '<section class="panel" id="eq-equip-panel">' + U().tete('Dépenses d\'appartement payées en direct', '<span class="muted">cochez ce qui compte dans l\'équilibre</span>') +
      '<div class="rb-grid addrow"><label for="ma-date">Date<input type="date" id="ma-date"></label><label for="ma-label">Dépense<input type="text" id="ma-label" maxlength="80" placeholder="ex. Peinture salon"></label>' +
      '<label for="ma-amount">Montant (€)<input type="text" inputmode="decimal" id="ma-amount"></label><label for="ma-who">Payé par<select id="ma-who"><option value="moi">' + esc(N.moi) + '</option><option value="autre">' + esc(N.autre) + '</option><option value="moitie">Moitié-moitié</option></select></label>' +
      '<button class="btn primary" type="button" data-eqajout="1">Ajouter</button></div>' +
      '<div id="eq-equip-sum" class="eq-sum"><span><b>' + on.length + '</b> dépense' + (on.length > 1 ? 's' : '') + ' comptée' + (on.length > 1 ? 's' : '') + ' sur ' + R.EQ.length + '</span><span>' + esc(N.moi) + ' <b class="num">' + e0(nMoi) + '</b></span><span>' + esc(N.autre) + ' <b class="num">' + e0(nAutre) + '</b></span>' +
      '<button type="button" class="linkbtn more" data-eqtog="1" aria-expanded="' + !!o.equipOuvert + '">' + (o.equipOuvert ? 'replier ▴' : 'voir les ' + R.EQ.length + ' ▾') + '</button></div>' +
      (o.equipOuvert ? '<div class="tablewrap" id="eq-equip-wrap"><table class="cats"><thead><tr><th>Achat</th><th class="r">Payé par ' + esc(N.moi) + '</th><th class="r">Payé par ' + esc(N.autre) + '</th></tr></thead><tbody id="eq-equip">' +
        R.EQ.slice().sort((a, b) => (a.date || '') < (b.date || '') ? -1 : 1).map(x => '<tr><td><label class="chk"><input type="checkbox" data-eqon="' + esc(x.id) + '"' + (x.on ? ' checked' : '') + '> ' + esc(x.label) + '</label><div class="subs">' +
          esc([x.detail, x.date ? dfr(x.date) : ''].filter(Boolean).join(' · ')) + (x.fixe ? '' : ' · <button class="linkbtn" type="button" data-eqsuppr="' + esc(x.id) + '">retirer</button>') + '</div></td><td class="r num">' + (x.moi ? e2(x.moi) : '') + '</td><td class="r num">' + (x.autre ? e2(x.autre) : '') + '</td></tr>').join('') + '</tbody></table></div>' : '') +
      U().comment('Les dépenses reprises de l\'ancienne version gardent leur réglage. Ajoutez une dépense ci-dessus, ou depuis une opération (volet « Classer » › « Ajouter à l\'équilibre »).') + '</section>';
    // tous les mouvements
    const fk = o.sorte || '';
    const ks = Object.keys(R.libelles).filter(k => Math.abs(R.S[k] || 0) > 50).sort((x, y) => Math.abs(R.S[y]) - Math.abs(R.S[x]));
    const ops = R.OPS.filter(x => !fk || x[3] === fk).slice().reverse();
    h += '<section class="panel" id="eq-ops-panel">' + U().tete('Tous les mouvements du compte commun', '<select id="eq-kind" aria-label="Filtrer par nature"><option value="">Tous</option>' + Object.keys(R.libelles).map(k => '<option value="' + k + '"' + (k === fk ? ' selected' : '') + '>' + esc(R.libelles[k]) + '</option>').join('') + '</select>') +
      '<div id="eq-ops-nat" class="eq-nat">' + ks.map(k => '<button type="button" class="eqn' + (fk === k ? ' on' : '') + '" data-eqk="' + k + '"><span>' + esc(R.libelles[k]) + '</span><b class="num' + (R.S[k] > 0 ? ' pos-t' : '') + '">' + (R.S[k] > 0 ? '+' : '') + e0(Math.abs(R.S[k])) + '</b></button>').join('') + '</div>' +
      '<p class="note" id="eq-ops-sum" style="margin-top:0">' + pl(ops.length, 'mouvement') + ', ' + (() => { const t = ops.reduce((x, y) => x + y[2], 0); return t < 0 ? 'sorties nettes ' + e2(-t) : 'entrées nettes ' + e2(t); })() + '</p>' +
      '<div class="scroll tablewrap"><table class="tx"><thead><tr><th>Date</th><th>Nature</th><th>Libellé</th><th style="text-align:right">Montant</th></tr></thead><tbody id="eq-ops">' +
      ops.slice(0, 600).map(([d, l, a, k]) => '<tr><td class="num">' + dfr(d) + '</td><td>' + esc(R.libelles[k] || k) + '</td><td class="lab">' + esc(l) + '</td><td class="amt' + (a > 0 ? ' pos' : '') + '">' + (a > 0 ? '+' : '') + e2(Math.abs(a)) + '</td></tr>').join('') +
      (ops.length > 600 ? '<tr><td colspan="4" class="muted">et ' + (ops.length - 600) + ' mouvements plus anciens</td></tr>' : '') + '</tbody></table></div>' +
      U().comment('Avant la reprise, les mouvements viennent de l\'historique de l\'ancienne version ; depuis, ils arrivent par la synchronisation bancaire et sont classés automatiquement par sorte.') + '</section>';
    return h;
  }

  // Graphique de l'investissement cumulé (SVG, sans DOM).
  function graphique(B, N) {
    const Sx = KC().serieEquilibre(B);
    if (!Sx) return '<p class="muted" style="padding:20px">Pas encore assez de mouvements.</p>';
    const series = Sx.serie, proj = Sx.projection, all = series.concat(proj), xs = all.map(p => p[0]);
    const Wd = 360, H = 300, pad = { l: 56, r: 12, t: 10, b: 26 };
    const hi = Math.max(100, ...all.map(p => Math.max(p[1], p[2])));
    const step = (() => { const r = hi / 5, e = Math.pow(10, Math.floor(Math.log10(Math.max(r, 1)))), f = r / e; return (f <= 1.5 ? 1 : f <= 3 ? 2 : f <= 7 ? 5 : 10) * e; })();
    const top = Math.ceil(hi / step) * step;
    const y = v => pad.t + (top - v) / (top || 1) * (H - pad.t - pad.b);
    let s = '';
    for (let v = 0; v <= top + 1e-6; v += step) s += '<line x1="' + pad.l + '" x2="' + (Wd - pad.r) + '" y1="' + y(v).toFixed(1) + '" y2="' + y(v).toFixed(1) + '" stroke="var(--line)" stroke-width="1"/><text x="' + (pad.l - 6) + '" y="' + (y(v) + 4).toFixed(1) + '" text-anchor="end" fill="var(--muted)" font-family="JetBrains Mono, monospace" font-size="10.5">' + (v / 100 >= 1000 ? (Math.round(v / 10000) / 10).toLocaleString('fr-FR') + ' k€' : Math.round(v / 100) + ' €') + '</text>';
    const idx = m => { const [a, b] = xs[0].split('-').map(Number), [c, d] = m.split('-').map(Number); return (c - a) * 12 + (d - b); };
    const span = Math.max(1, idx(xs[xs.length - 1])), x = m => pad.l + idx(m) / span * (Wd - pad.l - pad.r);
    const pts = (arr, k) => arr.map(p => x(p[0]).toFixed(1) + ',' + y(p[k]).toFixed(1)).join(' ');
    [...new Set(xs.map(m => m.slice(0, 4)))].forEach(yy => { const m = yy + '-01'; if (m < xs[0]) return; s += '<text x="' + x(m).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle" fill="var(--muted)" font-family="JetBrains Mono, monospace" font-size="10.5">' + yy + '</text><line x1="' + x(m).toFixed(1) + '" x2="' + x(m).toFixed(1) + '" y1="' + pad.t + '" y2="' + (H - pad.b) + '" stroke="var(--line)"/>'; });
    const last = series[series.length - 1];
    if (proj.length) {
      const pr = [last].concat(proj), e = proj[proj.length - 1];
      s += '<polyline fill="none" stroke="var(--rev)" stroke-width="2" stroke-dasharray="5 4" opacity=".7" points="' + pts(pr, 1) + '"/><polyline fill="none" stroke="var(--dep)" stroke-width="2" stroke-dasharray="5 4" opacity=".7" points="' + pts(pr, 2) + '"/>' +
        '<circle cx="' + x(e[0]).toFixed(1) + '" cy="' + y(e[1]).toFixed(1) + '" r="5" fill="var(--ink)" stroke="var(--surface)" stroke-width="2"/><text x="' + (x(e[0]) - 10).toFixed(1) + '" y="' + (y(e[1]) + 20).toFixed(1) + '" text-anchor="end" fill="var(--ink)" font-size="12" font-weight="600">Équilibre ' + esc(mLabel(e[0])) + '</text>';
    }
    s += '<polyline fill="none" stroke="var(--rev)" stroke-width="2.2" points="' + pts(series, 1) + '"/><polyline fill="none" stroke="var(--dep)" stroke-width="2.2" points="' + pts(series, 2) + '"/>' +
      '<circle cx="' + x(last[0]).toFixed(1) + '" cy="' + y(last[1]).toFixed(1) + '" r="4" fill="var(--rev)" stroke="var(--surface)" stroke-width="2"/><circle cx="' + x(last[0]).toFixed(1) + '" cy="' + y(last[2]).toFixed(1) + '" r="4" fill="var(--dep)" stroke="var(--surface)" stroke-width="2"/>';
    const tx = x(last[0]);
    s += '<line x1="' + tx.toFixed(1) + '" x2="' + tx.toFixed(1) + '" y1="' + pad.t + '" y2="' + (H - pad.b) + '" stroke="var(--ink-2)" stroke-dasharray="2 3"/><text x="' + (tx + 4).toFixed(1) + '" y="' + (pad.t + 12) + '" fill="var(--ink-2)" font-size="11" font-weight="600">aujourd\'hui</text>';
    const hv = all, stp = Math.max(1, Math.round(hv.length / 60)), tips = [];
    hv.forEach((p, i) => {
      tips.push([mLabel(p[0]) + (i >= series.length ? ' (projection)' : ''), [['var(--rev)', N.moi, e0(p[1])], ['var(--dep)', N.autre, e0(p[2])], ['var(--ink-2)', 'Écart', e0(Math.abs(p[2] - p[1]))]]]);
      if (i % stp && i !== hv.length - 1) return;
      const x1 = x(p[0]), x2 = i < hv.length - 1 ? x(hv[Math.min(hv.length - 1, i + stp)][0]) : x1 + 6;
      s += '<rect data-i="' + i + '" x="' + (x1 - (x2 - x1) / 2).toFixed(1) + '" y="' + pad.t + '" width="' + Math.max(4, x2 - x1).toFixed(1) + '" height="' + (H - pad.t - pad.b) + '" fill="transparent"/>';
    });
    return '<svg viewBox="0 0 ' + Wd + ' ' + H + '" width="100%" height="' + H + '" preserveAspectRatio="none" role="img" aria-label="Investissement cumulé de chacun">' + s + '</svg><div class="tip" hidden></div>' +
      '<script type="application/json" class="tips">' + JSON.stringify(tips).replace(/</g, '\\u003c') + '</script>';
  }

  // Ancienne présentation en cartes (gardée pour les tests du Lot 7) : marge, fin de mois, virements, trésorerie.
  function cartes(B, ouverts) { return plan(B, { cartes: ouverts }); }

  g.KladVuesCommun = { plan, cartes, ordres, equilibre, graphique, tresorerie, appels, origine };
})(typeof window !== 'undefined' ? window : globalThis);
