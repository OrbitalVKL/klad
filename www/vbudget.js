// Klad — rendu de l'onglet Budget comme l'ancienne version : navigation entre cycles, « Budget mensuel » (Suivi : postes
// par section, consommé, reste, état, causes ; Budget : réel habituel, prévu, parts du commun, calculateur carburant),
// reste à vivre, plus gros écarts, répartition, tendance, contrats, catégories et règles.
// Chaînes HTML, sans accès au DOM : testées dans node. Jamais de montant négatif affiché : « reste / dépassé de »,
// « de plus / de moins », « déficit ».
(function (g) {
  'use strict';

  const KB = () => g.KladBudget;
  const K = () => g.KladClasse;
  const F = () => g.KladFormat;
  const U = () => g.KladUI;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const DEMI = 50;

  const e0 = c => KB().eur(c);
  const e2 = c => F().montant(c);
  const jjmm = iso => iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) : '';
  const jjmmaa = iso => iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(2, 4) : '';
  const mLabel = m => U().mLabel(m);
  const nomMois = m => KB().nomMois(m);
  const pluriel = (n, s, p) => n + ' ' + (n > 1 ? (p || s + 's') : s);
  const chip = st => U().chip(st);
  const NAT_LABEL = { fixe: 'Charges fixes', courante: 'Dépenses courantes', optionnelle: 'Dépenses optionnelles', revenu: 'Revenus' };
  const NAT_HELP = { fixe: 'prélèvements réguliers', courante: 'le quotidien', optionnelle: 'les envies' };
  const PERLAB = { 1: '/ mois', 3: '/ trim.', 4: '/ 4 mois', 12: '/ an' };
  // Valeur sans signe : « +748 € » ou « déficit 15 € ».
  const sg = v => v < -DEMI ? 'déficit ' + e0(-v) : (v > DEMI ? '+' : '') + e0(Math.max(0, v));
  const cl = v => v < -DEMI ? 'var(--bad)' : 'var(--good)';

  function libellePeriode(per) {
    const c = per.cyc;
    if (per.past) {
      if (c) { const n = Math.round((Date.parse(c.end) - Date.parse(c.start)) / 864e5) + 1; return 'Cycle du ' + jjmm(c.start) + ' au ' + jjmmaa(c.end) + (n < 26 || n > 35 ? ' (' + n + ' j)' : '') + ' · terminé'; }
      return 'Mois de ' + mLabel(per.pm0) + ' · terminé';
    }
    return c ? 'Cycle en cours · du ' + jjmm(c.start) + ' au ' + jjmmaa(c.end) : 'Mois en cours · ' + mLabel(per.pm0);
  }

  // ------------------------------------------------------------ navigation ◀ ▶
  function cycNav(B, scope, nav) {
    const per = KB().periode(B, scope, nav);
    return '<button type="button" class="cn-btn cn-prev" data-nav="prev" aria-label="Période précédente"' + (per.prev ? '' : ' disabled') + '>◀<span class="hide-m"> Précédent</span></button>' +
      '<span class="cn-lab"><b>' + esc(libellePeriode(per)) + '</b><span class="cn-leg only-m">budget · consommé · reste</span></span>' +
      '<button type="button" class="cn-btn cn-next" data-nav="next" aria-label="Période suivante"' + (per.past ? '' : ' disabled') + '><span class="hide-m">Suivant </span>▶</button>' +
      (per.past ? '<button type="button" class="cn-btn cn-now" data-nav="now">Cycle en cours</button>' : '');
  }

  // ------------------------------------------------------------ 2.1 : carte du budget (en-tête, suivi, bilan) dans l'Aperçu
  // Mêmes chiffres et mêmes actions qu'avant (KladBudget.suivi) ; présentation en sections repliables, un poste par ligne
  // (anneau, état, montant), ses opérations et ses actions en dépliant le poste. Aucun montant affiché avec un signe moins.
  const COUL = { good: 'var(--good)', warn: 'var(--warn)', bad: 'var(--bad)', hb: 'var(--hb)', info: 'var(--accent)', muted: 'var(--muted)' };
  function anneau(frac, et, icone, sz) {
    const S = sz || 40, w = 5, r = (S - w) / 2, C = 2 * Math.PI * r, f = Math.max(0, Math.min(1, frac));
    return '<span class="ap-ring" style="width:' + S + 'px;height:' + S + 'px"><svg viewBox="0 0 ' + S + ' ' + S + '" aria-hidden="true" focusable="false"><g transform="rotate(-90 ' + S / 2 + ' ' + S / 2 + ')">' +
      '<circle cx="' + S / 2 + '" cy="' + S / 2 + '" r="' + r + '" class="ap-c0" stroke-width="' + w + '"/>' +
      (f > 0 ? '<circle cx="' + S / 2 + '" cy="' + S / 2 + '" r="' + r + '" fill="none" stroke="' + (COUL[et] || COUL.good) + '" stroke-width="' + w + '" stroke-linecap="round" stroke-dasharray="' + (C * f).toFixed(1) + ' ' + C.toFixed(1) + '"/>' : '') +
      '</g></svg>' + icone + (et === 'bad' ? '<b class="ap-alerte" aria-hidden="true">!</b>' : '') + '</span>';
  }
  // pastille d'état (« conforme », « à venir · le 05/11 », « dépassé »…)
  const pastille = st => !st || !st.texte ? '' : '<em class="ap-pill ' + esc(st.niveau === 'muted' ? '' : st.niveau || 'info') + '">' + esc(st.texte) + '</em>';
  // solde : pastille (excédent / déficit / à l'équilibre) puis le montant, toujours sans signe moins
  const solde = v => '<span class="ap-sv">' + (v < -DEMI ? '<em class="ap-pill bad">déficit</em><b class="num bad-t">' + esc(e0(-v)) + '</b>'
    : v > DEMI ? '<em class="ap-pill good">excédent</em><b class="num pos-t">' + esc(e0(v)) + '</b>' : '<em class="ap-pill">à l\'équilibre</em><b class="num">' + esc(e0(v)) + '</b>') + '</span>';
  const ico = (n, t) => g.KladIcones ? g.KladIcones.svg(n, t || 18) : '';
  const titreBudget = (B, scope, per) => scope === 'commun' ? 'Budget du commun' : per.cyc ? 'Budget du cycle' : 'Budget du mois';

  // ------------------------------------------------------------ en-tête : titre, période ‹ ›, Suivi / Régler le budget
  function teteBudget(B, scope, ui) {
    const plan = ui.mode === 'plan', per = KB().periode(B, scope, ui.nav);
    let droite = '';
    if (!plan && !per.past) { try { const s = KB().suivi(B, scope, ui.nav); droite = 'jour ' + s.jour + '/' + s.nbJours; } catch (e) { droite = ''; } }
    const lab = libellePeriode(per), i = lab.indexOf(' · ');
    let h = '<div class="panel-h bg-tete"><h2 class="fold" role="button" tabindex="0" title="Replier / déplier">' + esc(titreBudget(B, scope, per)) + '</h2>' + (droite ? '<span class="bg-jour num">' + esc(droite) + '</span>' : '') + '</div>';
    if (!plan) {
      const prev = per.salaire || (scope === 'perso' && B.R.cycle !== 'mois') ? 'Cycle précédent' : 'Mois précédent';
      h += '<div class="bg-nav"><button type="button" class="bg-nb" data-nav="prev" aria-label="' + prev + '"' + (per.prev ? '' : ' disabled') + '>‹</button>' +
        '<span class="bg-per"><b>' + esc(i > 0 ? lab.slice(0, i) : lab) + '</b>' + (i > 0 ? ' <span>· ' + esc(lab.slice(i + 3)) + '</span>' : '') + '</span>' +
        '<button type="button" class="bg-nb" data-nav="next" aria-label="Période suivante"' + (per.past ? '' : ' disabled') + '>›</button></div>' +
        (per.past ? '<button type="button" class="bg-now" data-nav="now">Revenir au ' + (per.cyc ? 'cycle' : 'mois') + ' en cours</button>' : '');
    }
    h += '<div class="seg bg-mode" role="group" aria-label="Affichage du budget"><button type="button" data-bmode="suivi" aria-pressed="' + !plan + '">' + ico('list', 16) + 'Suivi</button>' +
      '<button type="button" data-bmode="plan" aria-pressed="' + plan + '">' + ico('scale', 16) + 'Régler le budget</button></div>';
    if (plan) {
      const W = KB().fenetre(B), L = KB().moisReference(B);
      h += '<label class="ctl bg-base" for="bref">Base de calcul depuis <select id="bref">' + L.map(m => '<option value="' + m + '"' + (m === W.start ? ' selected' : '') + '>' + esc(mLabel(m)) + '</option>').join('') + '</select></label>' +
        '<div class="bg-boutons"><button class="ap-ab" type="button" data-alignertout="' + esc(scope) + '">' + ico('wand-sparkles') + '<span>Tout aligner sur le réel habituel</span></button>' +
        '<button class="ap-ab" type="button" data-ouvrir="secReglBudget">' + ico('wrench') + '<span>Réglages du budget</span></button></div>' +
        '<p class="bg-leg2"><span><i class="hab"></i>réel habituel : ce que vous dépensez d\'ordinaire</span><span><i class="bud"></i>budget : votre montant</span></p>';
    }
    return h;
  }

  // ------------------------------------------------------------ Suivi
  // ui : { nav, ouverts: Set (postes dépliés : clé du poste, 'lk|split' ; sections : 'm|<section>' ouverte, 'f|<section>'
  // repliée, sinon l'état par défaut) }. Sections ouvertes par défaut : les dépenses ; repliées : revenus, hors budget.
  const SEC_OUVERTE = { rev: false, fixe: true, courante: true, optionnelle: true, hb: false };
  function suivi(B, scope, ui) {
    const S0 = B.S, C = B.cx.C;
    const s = KB().suivi(B, scope, ui.nav);
    const per = s.per, past = per.past;
    const ouv = ui.ouverts || new Set();
    const secOpen = k => ouv.has('m|' + k) ? true : ouv.has('f|' + k) ? false : SEC_OUVERTE[k];
    const lab = libellePeriode(per);
    const fmt = e0;
    // écart (période terminée) : budget − consommé, ou reçu − budget pour les revenus ; sans signe
    const ecMot = (d, rev) => d < 0 ? (rev ? fmt(-d) + ' de moins' : 'dépassé de ' + fmt(-d)) : d > 0 ? (rev ? fmt(d) + ' de plus' : 'économie ' + fmt(d)) : 'tenu';
    const ecart = (p, c, rev) => { let d = rev ? c - p : p - c; if (Math.abs(d) < DEMI) d = 0; return '<span class="' + (d < 0 ? 'bad-t' : d > 0 ? 'pos-t' : '') + '">' + ecMot(d, rev) + '</span>'; };
    const ici = past ? '' : '<span class="bg-ici" style="left:' + Math.round(Math.min(1, s.frac) * 100) + '%" title="aujourd\'hui : jour ' + s.jour + ' sur ' + s.nbJours + '"></span>';
    const barre = (fr, cls) => '<div class="bg-bar"><i class="' + (cls || '') + '" style="width:' + Math.max(0, Math.min(100, Math.round(fr * 100))) + '%"></i>' + ici + '</div>';
    const sect = (k, cls, titre, chips, droite, fr, bcls, resume, corps) => {
      const o = secOpen(k);
      return '<div class="bg-sec ' + cls + (o ? ' ouvert' : '') + '"><button type="button" class="bg-sh sec-tog" data-sec="' + k + '" aria-expanded="' + o + '"><i class="dot" aria-hidden="true"></i>' +
        '<span class="t">' + titre + chips + '</span><span class="v num">' + droite + '</span><span class="chev" aria-hidden="true"></span></button>' +
        barre(fr, bcls) + '<p class="bg-ss">' + resume + '</p>' + (o ? corps : '') + '</div>';
    };
    const cpt = id => B.comptes.find(x => x.id === id);
    // 1.0 : pastille « récurrent » sur une charge récurrente du compte secondaire (réglé dans Plus › Réglages › Budget)
    const RS = g.KladReglages ? g.KladReglages.recurrentsSecondaire(B) : null;
    const recSec = r => RS && r.m < 0 && r.cid === RS.compte.id && RS.montants.has(-r.m)
      ? ' <span class="chip warn" title="' + esc('Charge récurrente sur le ' + RS.compte.libelle + ' : à basculer sur ' + (RS.principal ? RS.principal.libelle : 'le compte courant principal')) + '">récurrent sur ' + esc(RS.compte.libelle) + '</span>' : '';
    // une ligne dépliée : opération (avec « Classer »), contrat, part du commun, ligne vide
    const opLi = (d, labHtml, amt, r, cls) => '<li class="det' + (cls ? ' ' + cls : '') + '"><span class="d num">' + esc(d) + '</span><span class="l">' + (r ? U().bico(S0, cpt(r.cid), true) + ' ' : '') + labHtml + (r ? recSec(r) : '') + '</span>' +
      '<b class="num">' + amt + '</b>' + (r && !r.ecart ? '<button class="bg-cl" type="button" data-op="' + esc(r.id) + '" data-c="' + esc(r.cid) + '" data-classer="1">Classer</button>' : '') + '</li>';
    const vide = cls => '<li class="det vide' + (cls ? ' ' + cls : '') + '"><span class="l muted">Aucune opération sur cette période.</span></li>';
    // poste : bouton (anneau, nom, état, montant) qui déplie ses opérations ; dessous, cause d'un écart et répartition
    const poste = (k, ico0, label, st, et, fr, val, sous, apres, corps, extra) => {
      const op = ouv.has(k);
      return '<div class="bg-po' + (op ? ' ouvert' : '') + (extra || '') + '"><button class="poste-nom bg-pb" type="button" data-poste="' + esc(k) + '" aria-expanded="' + op + '">' +
        anneau(fr, et, '<span class="ic">' + ico0 + '</span>') + '<span class="t"><span class="n">' + esc(label) + '</span><span class="bg-sub">' + pastille(st) + (sous ? '<small class="' + (et === 'bad' ? 'bad-t' : '') + '">' + sous + '</small>' : '') + '</span></span>' +
        '<span class="v num">' + val + '</span><span class="chev" aria-hidden="true"></span></button>' + (apres || '') + (op ? '<ul class="bg-ops">' + corps + '</ul>' : '') + '</div>';
    };

    // revenus
    const R = s.revenus;
    let rv = '';
    for (const x of R.lignes) {
      const k = 'rev|' + x.key;
      let corps = x.ops.slice().reverse().map(o => opLi(jjmm(o.date), esc(g.KladVues.libelleCourt(o.label)), esc('+' + e2(o.m)), o, 'n-rev')).join('');
      if (!x.ops.length) corps += vide('n-rev');
      if (scope === 'perso' && !past) corps += '<li class="det bg-act"><button class="ap-lien" type="button" data-editer="r|' + esc(x.key) + '">' + ico('pencil', 16) + ' Modifier le revenu attendu</button></li>';
      const recu = x.pm > DEMI && x.got >= x.pm - DEMI;
      const st = x.etat || (x.got > DEMI ? { niveau: 'good', texte: 'reçu' } : null);
      rv += poste(k, U().cico(C, scope === 'commun' ? KB().APPORTS : x.key), x.key, st, recu || !x.pm ? 'good' : st && st.niveau === 'warn' ? 'warn' : 'info', x.pm > DEMI ? x.got / x.pm : x.got > DEMI ? 1 : 0,
        '<span class="pos-t">' + (x.got ? '+' + fmt(x.got) : '0 €') + '</span> <small>/ ' + (x.pm ? fmt(x.pm) : '—') + '</small>',
        past && x.pm > DEMI ? ecart(x.pm, x.got, true) : x.ops.length ? x.ops.length + ' op.' : '', '', corps, ' n-rev');
    }
    const attendu = R.p - R.c;
    let h = sect('rev', 'rev', 'Revenus', '', '<span class="pos-t">' + fmt(R.c) + '</span> <small>/ ' + (R.p > DEMI ? fmt(R.p) : '—') + '</small>', R.p > DEMI ? R.c / R.p : 0, 'rev',
      past ? 'écart : ' + ecart(R.p, R.c, true) : R.p > DEMI ? (attendu > DEMI ? 'attendu encore ' + fmt(attendu) : 'reçu en totalité') : R.lignes.length ? '' : 'aucun revenu attendu', rv || '<p class="ap-note">Aucun revenu sur cette période.</p>');

    // postes de dépenses
    const ligne = (a, nk, sec) => {
      const nOps = (a.ops || []).length, cs = a.contrats || [];
      const isLk = scope === 'perso' && a.lie, lkOp = isLk && ouv.has('lk|split');
      const st = a.etat || null, prov = a.cls === 'prov';
      const et = a.cls === 'over' ? 'bad' : a.cls === 'warn' ? 'warn' : a.cls === 'hb' ? 'hb' : st && st.niveau === 'bad' ? 'bad' : st && st.niveau === 'warn' ? 'warn' : st && st.niveau === 'info' && nk === 'fixe' ? 'info' : 'good';
      const fr = prov ? 1 : a.pm > DEMI ? a.cur / a.pm : a.cur > DEMI ? 1 : 0;
      const left = a.pm - a.cur;
      const sous = (past && a.pm > DEMI ? ecart(a.pm, a.cur) : prov ? 'provisionnés ce mois · réserve' : a.pm > DEMI ? (left >= -DEMI ? 'reste ' + fmt(Math.max(0, left)) : 'dépassé de ' + fmt(-left)) : a.cur > DEMI ? 'hors budget' : '') +
        (a.per > 1 ? ' · échéance ' + fmt(a.ech) : '');
      const val = prov ? fmt(a.pm) + ' <small>provisionnés</small>' : (Math.abs(a.cur) > DEMI ? fmt(a.cur) : '0 €') + ' <small>/ ' + (a.pm ? fmt(a.pm) : '—') + '</small>';
      // repères sous le poste replié : contrats, répartition (contribution au commun)
      let tags = '';
      if (cs.length) tags += '<span class="bg-tag">' + ico('file-text', 13) + (cs.length > 1 ? cs.length + ' contrats' : 'contrat') + '</span>';
      if (nOps && !ouv.has(a.key)) tags += '<span class="bg-tag">' + nOps + ' op.</span>';
      if (isLk) tags += '<button class="bg-tag lk-tog" type="button" data-poste="lk|split" aria-expanded="' + lkOp + '">' + ico('users', 13) + 'répartition ' + (lkOp ? '▴' : '▾') + '</button>';
      if (a.key === 'c|Carburant' && scope === 'perso' && !past) tags += '<button class="bg-tag" type="button" data-fuel="1">' + ico('fuel', 13) + 'calculateur</button>';
      let apres = tags ? '<div class="bg-tags">' + tags + '</div>' : '';
      const c2 = 'n-' + (sec || nk);
      if (lkOp) {
        const parts = KB().postes(B, 'commun').lignes.filter(c => c.on && c.amt > DEMI).map(c => { const pg = KB().partDe(B, c.key).pg; return { c, pg, g: c.amt * pg / 100 }; }).sort((x, y) => y.g - x.g);
        apres += '<ul class="bg-ops lk"><li class="det lk-det lk-h ' + c2 + '"><span class="l"><b>Ma part du compte commun</b> · poste × ma part</span></li>' +
          parts.map(p => '<li class="det lk-det ' + c2 + '"><span class="l">' + esc(p.c.label) + ' <span class="muted">' + fmt(p.c.amt) + (p.c.per > 1 ? ' / mois (échéance ' + fmt(p.c.ech) + ')' : '') + ' × ' + p.pg + ' %</span></span><b class="num">' + e2(p.g) + '</b></li>').join('') +
          '<li class="det lk-det lk-t ' + c2 + '"><span class="l"><b>Total de ma contribution</b></span><b class="num">' + e2(parts.reduce((t, p) => t + p.g, 0)) + '</b></li></ul>';
      }
      if (a.cause) apres += '<p class="bg-cause' + (a.cause.sorte === 'tol' ? ' tol' : '') + '"><span class="cz">' + (a.cause.sorte === 'tol' ? 'Écart' : '⚠ Cause') + '</span> ' + esc(a.cause.texte) +
        (a.cause.aligner && !past && !a.lie ? ' <button class="linkbtn cz-fix" type="button" data-aligner="' + esc(a.key) + '" data-v="' + Math.round(a.cause.aligner) + '">aligner le budget sur le prélevé (' + e2(a.cause.aligner) + ')</button>' : '') + '</p>';
      let corps = cs.map(c => '<li class="det ctr-det ' + c2 + '"><span class="l">' + ico('file-text', 14) + ' <b>' + esc(c.label) + '</b> · contrat ' + e2(c.montant) + ' ' + esc(PERLAB[c.per || 1]) + (c.src ? ' · ' + esc(c.src) : '') + '</span><b class="num">' + e2(c.montant) + '</b></li>').join('');
      // 1.1.1 : écart de rapprochement (prélèvement ≠ achat), sans montant négatif affiché
      for (const r of a.ops || []) corps += r.ecart ? opLi(jjmm(r.od), esc('écart de rapprochement' + (r.m > 0 ? ' (prélèvement plus petit, compté en moins)' : '')), esc(e2(Math.abs(r.m))), r, c2)
        : opLi(jjmm(r.od), esc(g.KladVues.libelleCourt(r.label)), esc(e2(-r.m)), r, c2);
      if (!nOps && !cs.length) corps += vide(c2);
      if (!past && nk !== 'fixe' && a.proj) corps += '<li class="det bg-proj ' + c2 + '"><span class="l muted">Projection fin de période</span><b class="num">' + fmt(a.proj) + '</b></li>';
      if (!past && !a.lie) corps += '<li class="det bg-act ' + c2 + '"><button class="ap-lien" type="button" data-editer="' + esc(a.key) + '">' + ico('pencil', 16) + ' Modifier le budget</button>' +
        (a.key === 'c|Carburant' && scope === 'perso' ? '<button class="ap-lien" type="button" data-fuel="1">' + ico('fuel', 16) + ' Calculateur carburant</button>' : '') + '</li>';
      return poste(a.key, U().icoPoste(C, a), a.label, st, et, fr, val, sous, apres, corps, ' ' + c2 + (a.on ? '' : ' off'));
    };
    for (const nk of KB().NATS) {
      const Sx = s.sections[nk], L = Sx.lignes, nb = Sx.nbDepasses, nw = Sx.nbAVoir;
      const over = Sx.c - Sx.p > DEMI && Sx.p > DEMI;
      const chips = (nb ? ' <b class="ap-chip bad">' + nb + ' dépassé' + (nb > 1 ? 's' : '') + '</b>' : '') + (nw ? ' <b class="ap-chip warn">' + nw + ' ' + (nk === 'fixe' ? 'à vérifier' : 'à surveiller') + '</b>' : '');
      const resume = past ? 'écart : ' + ecart(Sx.p, Sx.c) + ' · ' + pluriel(L.length, 'poste')
        : (nk === 'fixe' ? (Sx.c > DEMI ? 'prélevé ' + fmt(Sx.c) + ' · ' : '') + 'à venir ' + fmt(Math.max(0, Sx.p - Sx.c))
          : (over ? '<span class="bad-t">dépassé de ' + fmt(Sx.c - Sx.p) + '</span>' : 'reste ' + fmt(Math.max(0, Sx.p - Sx.c))) + ' · projection ' + fmt(Sx.proj)) + ' · ' + pluriel(L.length, 'poste');
      h += sect(nk, nk, NAT_LABEL[nk], chips, '<span class="' + (over ? 'bad-t' : '') + '">' + (Math.abs(Sx.c) > DEMI ? fmt(Sx.c) : '0 €') + '</span> <small>/ ' + (Sx.p > DEMI ? fmt(Sx.p) : '—') + '</small>',
        Sx.p > DEMI ? Sx.c / Sx.p : 0, over ? 'bad' : '', resume,
        L.map(a => ligne(a, nk)).join('') + (past ? '' : '<button class="bg-add" type="button" data-ajout="' + nk + '">+ Ajouter un poste</button>'));
    }
    const HB = s.horsBudget;
    if (HB.lignes.length) h += sect('hb', 'hb', 'Hors budget', '', fmt(HB.c), HB.c > DEMI ? 1 : 0, 'hb', past ? 'postes sans budget' : 'postes sans budget · projection ' + fmt(HB.proj), HB.lignes.map(a => ligne(a, a.nat, 'hb')).join(''));

    h = (past ? '<div id="track-sum"><div class="past-band"><span>' + ico('calendar-check', 16) + ' <b>Période clôturée</b> · ' + esc(lab.replace(' · terminé', '')) + ' : budget, reçu ou consommé et écart par poste.</span></div></div>' : '') +
      '<div class="bg-corps" data-mode="suivi">' + h + '</div>' + bilan(B, s);
    // plus gros écarts et répartition (le total de la répartition dans son titre)
    const OV = s.depasses, rep = repartition(B, scope, per.start, per.upto), repTot = /<span class="muted num">([^<]*)<\/span>/.exec(rep);
    const repCorps = rep.replace(/^<div class="sub-h">[\s\S]*?<\/div>/, '');
    h += '<div class="b-extra" id="b-extra"><div class="over bg-ec" id="b-over"><h3>Plus gros écarts' + (past ? '' : ' à date') + '</h3>' +
      (OV.length ? '<ol>' + OV.slice(0, 3).map(a => '<li>' + anneau(1, a.pm > DEMI ? 'bad' : 'hb', '<span class="ic">' + U().icoPoste(C, a) + '</span>', 32) + '<span><b>' + esc(a.label) + '</b> ' +
        (a.pm > DEMI ? '<span class="bad-t num">' + fmt(a.cur - a.pm) + ' de plus</span><small>' + fmt(a.cur) + ' consommés pour ' + fmt(a.pm) + ' de budget</small>' : '<span class="hb-t num">' + fmt(a.cur) + '</span><small>hors budget</small>') + '</span></li>').join('') + '</ol>'
        : '<p class="muted">Aucun dépassement' + (past ? ' : budget tenu.' : ' pour l\'instant.') + '</p>') + '</div>' +
      '<details class="res-split bg-rep" id="split-b" data-pli="rep-' + scope + '"' + (U().replie('rep-' + scope) ? '' : ' open') + '><summary>' + ico('chart-pie', 18) + '<span>Répartition des dépenses</span>' + (repTot ? '<b class="num">' + repTot[1] + '</b>' : '') + '</summary>' +
        (repCorps || '<p class="muted">Aucune dépense sur cette période.</p>') + '</details></div>';
    // accès aux écrans détaillés (sous-vues : un appui, retour en haut à gauche)
    const VAc = g.KladVuesAccueil, dernier = scope === 'perso' && VAc && VAc.bilan && VAc.bilan(s);
    const acc = scope === 'commun' ? [['tresorerie', 'Trésorerie', 'chart-line'], ['equilibre', 'Équilibre', 'scale'], ['contrats-commun', 'Contrats', 'file-text']]
      : [['tendance', 'Tendance', 'trending-up'], ['contrats-perso', 'Contrats', 'file-text']];
    h += '<nav class="ap-act" aria-label="Écrans détaillés">' + acc.map(([k, t, i]) => '<button type="button" class="ap-ab" data-aller="' + k + '">' + ico(i) + '<span>' + t + '</span></button>').join('') +
      (dernier ? '<button type="button" class="ap-ab" data-av="bilan">' + ico('calendar-check') + '<span>Dernier bilan</span></button>' : '') + '</nav>';
    h += U().comment(past ? libellePeriode(per).replace(' · terminé', '') + ' (période terminée) : budget = votre budget actuel, consommé = opérations de la période (paiements carte à leur date de paiement) ; hors budget = postes sans budget et dépassements.'
      : (per.cyc ? 'Cycle du ' + U().dfr(per.cyc.start) + ' (dernier salaire) au ' + U().dfr(per.cyc.end) + ' : ' : 'Suivi de ' + mLabel(per.pm0) + ' : ') +
      'budget = votre budget du mois (les charges trimestrielles ou annuelles ne comptent que le mois de leur échéance' + (scope === 'commun' ? ', sauf au compte commun où elles sont provisionnées chaque mois' : '') +
      '), consommé = opérations depuis le début de la période. Les paiements carte comptent à leur date de paiement (lue dans le libellé), pas à leur date d\'enregistrement. ' +
      'La projection = dépensé à date + rythme habituel du poste (dépenses des 90 jours précédant la période) × jours restants ; l\'anneau montre la consommation du poste, le trait sur les barres la date du jour.');
    return { html: h, s };
  }

  // Bilan du budget : total des dépenses (dans le budget, hors budget, reste), causes d'un dépassement, puis les soldes
  // (prévu par le budget, réel, projeté ; au commun : mouvements du mois et provisions).
  function bilan(B, s) {
    const t = s.total, o = s.solde, per = s.per, fmt = e0;
    const mx = Math.max(t.C, t.P, 1), pc = v => Math.max(0, Math.min(100, v / mx * 100)), e = t.P - t.C;
    const seg = (cls, v, lab) => { const p = pc(Math.max(0, v)); return p > 0.05 ? '<i class="' + cls + '" style="width:' + p.toFixed(1) + '%" title="' + e0(v) + ' ' + lab + '"></i>' : ''; };
    const br = (lab, sub, val, cls) => '<div class="ap-br' + (cls ? ' ' + cls : '') + '"><span>' + lab + (sub ? '<small>' + sub + '</small>' : '') + '</span>' + val + '</div>';
    let h = '<div class="ap-bilan bg-bilan" role="group" aria-label="Bilan">' +
      br('Total des dépenses', past0(per) ? '' : 'jour ' + s.jour + ' sur ' + s.nbJours, '<b class="num' + (e < -DEMI ? ' bad-t' : '') + '">' + fmt(t.C) + ' <small>/ ' + fmt(t.P) + '</small></b>') +
      '<div class="tb-bar bg-tot">' + seg('in', t.IN, 'dans le budget') + seg('out', t.OUT, 'hors budget') + (t.C < t.P ? '<em style="left:' + pc(t.P).toFixed(1) + '%" title="budget ' + e0(t.P) + '"></em>' : '') + '</div>' +
      '<div class="bg-leg"><span><i class="sw in"></i>dans le budget <b class="num">' + fmt(Math.max(0, t.IN)) + '</b></span>' + (t.OUT > DEMI ? '<span><i class="sw out"></i>hors budget <b class="num">' + fmt(t.OUT) + '</b></span>' : '') +
      (e < -DEMI ? '<span class="bad-t">dépassé de <b class="num">' + fmt(-e) + '</b></span>' : '<span>reste <b class="num">' + fmt(Math.max(0, e)) + '</b></span>') + '</div>';
    if (t.C > t.P + DEMI && s.causes.length) {
      h += '<details class="tb-cz bg-cz"><summary><span class="cz">Causes du dépassement (' + s.causes.length + ')</span></summary><div class="tb-czl">' +
        s.causes.slice(0, 8).map(x => '<span><b>' + esc(x.a.label) + '</b> ' + (x.hb ? '<span class="hb-t num">' + fmt(x.v) + '</span> hors budget' : '<span class="bad-t num">' + fmt(x.v) + '</span> de plus') + '</span>').join('') +
        (s.causes.length > 8 ? '<span class="muted">et ' + (s.causes.length - 8) + ' autres</span>' : '') + '</div></details>';
    }
    const projete = () => s.jour < PROJ_JOUR ? '<span class="ap-mu">à partir du ' + PROJ_JOUR + 'e jour</span>' : solde(o.pj);
    if (s.scope === 'commun' && !per.past && o.compte != null) {
      const lu = B.comptes.filter(c => c.role === 'commun').map(c => c.sync && c.sync.lu).filter(Boolean).sort().pop();
      // 1.3.6 : le solde est en tête de l'écran ; ici, ce que le mois a changé (variation réelle) et les provisions
      h += br('Mouvements du mois', 'entrées − sorties réelles depuis le début du mois' + (lu ? ' · relevé bancaire du ' + esc(new Date(lu).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })) : ''), solde(o.variation), 'bg-sep') +
        (o.provisions > DEMI ? br('Provisions du mois', 'part mensuelle des charges trimestrielles : comptée dans le budget, rien n\'est sorti du compte', '<b class="num">' + e0(o.provisions) + '</b>') : '') +
        (o.pj != null ? br('Projeté fin de mois', '', projete()) : '');
    } else if (s.scope === 'perso' && !per.past) {
      h += br('Solde prévu par le budget', 'revenus prévus ' + e0(s.revenus.p) + ' − budget ' + e0(t.P) + (per.cyc ? ' · sur le cycle' : ' · sur le mois'), solde(o.balP), 'bg-sep') +
        br('Réel à ce jour', 'revenus ' + e0(o.revenus) + ' − dépenses ' + e0(o.depenses), solde(o.bal)) +
        br('Projeté fin de mois', '', projete());
    } else {
      h += br('Solde ' + (per.past ? 'de la période' : 'du mois'), 'revenus ' + e0(o.revenus) + ' − dépenses ' + e0(o.depenses) + ' · ' + (o.bal >= -DEMI ? (per.past ? 'resté' : 'restant') + ' sur les revenus' : 'dépensés au-delà des revenus'), solde(o.bal), 'bg-sep') +
        br('Prévu par le budget', 'revenus prévus − budget', solde(o.balP)) +
        (per.past ? br('Écart', '', '<b class="num ' + (o.ecart < -DEMI ? 'bad-t' : 'pos-t') + '">' + (o.ecart < -DEMI ? e0(-o.ecart) + ' moins bien' : e0(Math.max(0, o.ecart)) + ' mieux') + '</b>') : br('Projeté fin de mois', '', projete()));
    }
    return h + '</div>';
  }
  const past0 = per => !!per.past;

  // avant 2.1 (lu par les tests) : bandeau du solde
  const solCls = s => { const o = s.solde; const v = s.scope === 'commun' && !s.per.past && o.compte != null ? o.compte : s.scope === 'perso' && !s.per.past ? o.balP : o.bal; return v < -DEMI ? 'neg' : 'pos'; };
  function soldeBar(B, s) {
    const o = s.solde, per = s.per;
    const mini = (lab, v, tip) => '<span class="sb-m" title="' + esc(tip) + '"><span class="sb-l">' + lab + '</span> <b class="num" style="color:' + cl(v) + '">' + sg(v) + '</b></span>';
    if (s.scope === 'commun' && !per.past && o.compte != null) {
      const lu = B.comptes.filter(c => c.role === 'commun').map(c => c.sync && c.sync.lu).filter(Boolean).sort().pop();
      // 1.3.6 : le solde est en tête de l'écran ; ici, ce que le mois a changé (variation réelle) et les provisions
      return '<div class="solbar"><div class="sb-t"><b>Mouvements du mois</b><span class="subs">entrées − sorties réelles depuis le début du mois' + (lu ? ' · relevé bancaire du ' + esc(new Date(lu).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })) : '') + '</span></div>' +
        '<div class="sb-hero"><b class="num sb-v" style="color:' + cl(o.variation) + '">' + sg(o.variation) + '</b><span class="sb-p">variation réelle</span></div>' +
        (o.provisions > DEMI ? '<div class="sb-sec"><span class="sb-m" title="part mensuelle des charges trimestrielles : comptée dans le budget, mais rien n\'est sorti du compte"><span class="sb-l">Provisions du mois</span> <b class="num">' + e0(o.provisions) + '</b></span></div>' : '') + '</div>';
    }
    if (s.scope === 'perso' && !per.past) {
      return '<div class="solbar"><div class="sb-t"><b>Solde prévu par le budget</b><span class="subs">revenus prévus ' + e0(s.revenus.p) + ' − budget ' + e0(s.total.P) + '</span></div>' +
        '<div class="sb-hero"><b class="num sb-v" style="color:' + cl(o.balP) + '">' + sg(o.balP) + '</b><span class="sb-p">' + (per.cyc ? 'prévu sur le cycle' : 'prévu sur le mois') + '</span></div>' +
        '<div class="sb-sec"><span class="sb-cap">Réel</span>' + mini('À ce jour', o.bal, 'revenus ' + e0(o.revenus) + ' − dépenses ' + e0(o.depenses)) + projete(s) + '</div></div>';
    }
    const hero = o.bal >= -DEMI ? (per.past ? 'resté' : 'restant') + ' sur les revenus' + (per.past ? '' : ' à ce jour') : 'dépensés au-delà des revenus';
    return '<div class="solbar"><div class="sb-t"><b>Solde ' + (per.past ? 'de la période' : 'du mois') + '</b><span class="subs">revenus ' + e0(o.revenus) + ' − dépenses ' + e0(o.depenses) + '</span></div>' +
      '<div class="sb-hero"><b class="num sb-v" style="color:' + cl(o.bal) + '">' + (o.bal < -DEMI ? e0(-o.bal) : sg(o.bal)) + '</b><span class="sb-p">' + hero + '</span></div>' +
      '<div class="sb-sec"><span class="sb-cap">Par rapport au budget</span>' + mini('Prévu', o.balP, 'revenus prévus − budget') +
      (per.past ? '<span class="sb-m"><span class="sb-l">Écart</span> <b class="num" style="color:' + cl(o.ecart) + '">' + (o.ecart < -DEMI ? e0(-o.ecart) + ' moins bien' : e0(Math.max(0, o.ecart)) + ' mieux') + '</b></span>'
        : projete(s)) + '</div></div>';
  }
  // 1.3.6 : projection affichée à partir du 7e jour (avant, quelques jours de dépenses donnaient un chiffre inquiétant sans raison)
  const PROJ_JOUR = 7;
  function projete(s) {
    if (s.jour < PROJ_JOUR) return '<span class="sb-m"><span class="sb-l">Projeté fin de mois</span> <span class="subs">à partir du ' + PROJ_JOUR + 'e jour</span></span>';
    const v = s.solde.pj;
    return '<span class="sb-m" title="revenus − dépenses projetées selon le rythme actuel"><span class="sb-l">Projeté fin de mois</span> <b class="num" style="color:' + cl(v) + '">' + sg(v) + '</b></span>';
  }

  // Total des dépenses : une barre (dans le budget / hors budget) et un repère au niveau du budget.
  function totBar(C, P, IN, OUT, today) {
    const mx = Math.max(C, P, 1), pc = v => Math.max(0, Math.min(100, v / mx * 100)), e = P - C;
    const seg = (cls, v, lab) => { const p = pc(Math.max(0, v)); return p > 0.05 ? '<i class="' + cls + '" style="width:' + p.toFixed(1) + '%" title="' + e0(v) + ' ' + lab + '"></i>' : ''; };
    return '<div class="totbar"><div class="tb-h"><b>Total des dépenses</b><b class="num tb-c">' + e0(C) + '</b><span class="subs">budget ' + e0(P) + '</span><span class="tb-e" style="color:' + (e < -DEMI ? 'var(--bad)' : 'var(--good)') + '">' +
      (e < -DEMI ? 'dépassé de <b class="num">' + e0(-e) + '</b>' : 'reste <b class="num">' + e0(Math.max(0, e)) + '</b>') + '</span></div>' +
      '<div class="tb-bar">' + seg('in', IN, 'dans le budget') + seg('out', OUT, 'hors budget') + (C < P ? '<em style="left:' + pc(P).toFixed(1) + '%" title="budget ' + e0(P) + '"></em>' : '') + '</div>' +
      '<div class="tb-l"><span><i class="sw in"></i>Dans le budget <b class="num">' + e0(Math.max(0, IN)) + '</b></span>' + (OUT > DEMI ? '<span><i class="sw out"></i>Hors budget <b class="num">' + e0(OUT) + '</b></span>' : '') +
      (C < P ? '<span><i class="sw mk"></i>budget</span>' : '') + (today ? '<span class="muted">| aujourd\'hui : ' + today + '</span>' : '') + '</div></div>';
  }

  // Répartition des dépenses d'une période (date de paiement, hors exceptionnelles) : par nature, puis par catégorie.
  function repartition(B, scope, start, end) {
    const cats = {}, nat = { fixe: 0, courante: 0, optionnelle: 0 };
    let dep = 0;
    for (const r of B.rows) {
      if (r.type !== 'depense' || (scope === 'commun' ? r.role !== 'commun' : ['courant', 'carte_differee', 'paiement_en_ligne'].indexOf(r.role) < 0) || B.exc[r.id]) continue;
      if (r.od < start || r.od > end) continue;
      const v = -r.m; dep += v; cats[r.cat] = (cats[r.cat] || 0) + v;
      const n = KB().natureDe(B, r.cat); nat[n] = (nat[n] || 0) + v;
    }
    if (dep < DEMI) return '<div class="sub-h"><h3>Répartition des dépenses</h3><span class="muted">aucune dépense</span></div>';
    const bar = parts => '<div class="split">' + parts.map(p => '<span style="flex:' + p.v + ';background:' + p.c + '" title="' + esc(p.k) + ' : ' + e0(p.v) + '"></span>').join('') + '</div><div class="legend">' +
      parts.map(p => '<span><i style="background:' + p.c + '"></i>' + esc(p.k) + ' <span class="num">' + Math.round(100 * p.v / dep) + ' %</span></span>').join('') + '</div>';
    const NC = { fixe: 'var(--nfix)', courante: 'var(--cour)', optionnelle: 'var(--nopt)' };
    const pn = ['fixe', 'courante', 'optionnelle'].filter(k => nat[k] > DEMI).map(k => ({ k: NAT_LABEL[k], v: nat[k], c: NC[k] }));
    const ent = Object.entries(cats).filter(([, v]) => v > DEMI).sort((a, b) => b[1] - a[1]), rest = ent.slice(7).reduce((t, [, v]) => t + v, 0);
    const CC = ['var(--c1)', '#0e9aa7', '#c2a600', 'var(--c6)', '#a61e4d', '#868e96', '#1864ab'];
    const pc = ent.slice(0, 7).map(([k, v], i) => ({ k, v, c: CC[i] }));
    if (rest > DEMI) pc.push({ k: 'Autres catégories', v: rest, c: 'var(--c8)' });
    return '<div class="sub-h"><h3>Répartition des dépenses</h3><span class="muted num">' + e0(dep) + '</span></div>' + bar(pn) + bar(pc);
  }

  // ------------------------------------------------------------ mode Budget : régler le budget (prévu, parts du commun, carburant)
  // ui : { ouverts: Set ('d|<clé>' détail, 'mo|<clé>' mois par mois, 'ps|<nature>' section repliée) }.
  // 2.1 : une ligne par poste (case, nom, réel habituel comparé au budget, montant, périodicité, « = »), sections repliables.
  function plan(B, scope, ui) {
    const C = B.cx.C, SH = scope === 'commun';
    const P = KB().postes(B, scope), W = P.W, n = P.n;
    const ouv = ui.ouverts || new Set();
    const fmt = e0;
    const span = W.start === W.end ? mLabel(W.start) : mLabel(W.start) + ' → ' + mLabel(W.end);
    const how = a => a.calcul === 'douze' ? 'total des 12 derniers mois ÷ 12' : a.calcul === 'moyenne' ? 'moyenne des ' + n + ' mois ' + span : 'médiane des ' + n + ' mois ' + span + ' (moyenne : ' + fmt(a.mean) + ')';
    const hs = a => a.calcul === 'douze' ? '12 mois ÷ 12' : a.calcul === 'moyenne' ? 'moy. ' + span : 'médiane ' + span;
    const moisCourant = U().mLong(B.auj.slice(0, 7), B.auj);
    const R = B.R.commun;
    const trio = L => '<p class="bg-trio">' + L.filter(Boolean).map(([l, v, cls]) => '<span>' + l + ' <b class="num' + (cls ? ' ' + cls : '') + '">' + v + '</b></span>').join('') + '</p>';
    const reste = v => v < -DEMI ? 'déficit ' + fmt(-v) : fmt(Math.max(0, v));
    // comparaison réel habituel / budget (deux barres sur la même échelle)
    const cmp = (hab, bud) => { const mx = Math.max(hab, bud, 1); return '<div class="bg-cmpb" aria-hidden="true"><i class="hab" style="width:' + (Math.max(0, hab) / mx * 100).toFixed(0) + '%"></i><i class="bud" style="width:' + (Math.max(0, bud) / mx * 100).toFixed(0) + '%"></i></div>'; };
    let h = '', rp = 0;
    if (!SH) {
      const RV = KB().revenusAttendus(B);
      rp = RV.reduce((t, x) => t + (x.on ? x.amt : 0), 0);
      let rows = '';
      for (const x of RV) {
        const id = 'rv-' + x.cat.replace(/\W+/g, '_');
        const champ = x.cat === 'Salaire'
          ? '<span class="planbox"><select class="salmode" data-psal="1" aria-label="Mode de calcul du salaire">' + Object.keys(KB().MODES_SALAIRE).map(k => '<option value="' + k + '"' + (x.mode === k ? ' selected' : '') + '>' + esc(KB().MODES_SALAIRE[k]) + '</option>').join('') + '</select>' +
            (x.mode === 'libre' ? '<input type="text" inputmode="decimal" data-pamt="r|Salaire" value="' + esc(x.amt ? F().versSaisie(x.amt) : '') + '" aria-label="Salaire prévu">' : '<b class="num bg-ro">' + fmt(x.amt) + '</b>') + '</span>'
          : '<span class="planbox"><input type="text" inputmode="decimal" data-pamt="r|' + esc(x.cat) + '" value="' + esc(x.set ? F().versSaisie(x.amt) : '') + '" placeholder="0"' + (x.on ? '' : ' disabled') + ' aria-label="Prévu ' + esc(x.cat) + '"></span>';
        const note = x.cat === 'Salaire' ? (x.mode === 'dernier' && x.sal && x.sal.last ? 'reçu le ' + U().dfr(x.sal.last.date) : x.mode === 'moy3' && x.sal ? 'sur ' + x.sal.n3 + ' mois' : '') : x.cat === 'Autres revenus' ? 'autres apports prévus (saisie libre)' : '';
        rows += '<div class="bg-rg' + (x.on ? '' : ' off') + '"><div class="bg-rg1"><label class="chk" for="' + id + '"><input type="checkbox" id="' + id + '" data-pon="r|' + esc(x.cat) + '"' + (x.on ? ' checked' : '') + '> ' + U().cico(C, x.cat) + ' <span class="n">' + esc(x.cat) + '</span></label></div>' +
          '<div class="bg-rg2">' + champ + '<span class="bg-h">habituel <b class="num">' + fmt(x.avg || 0) + '</b> <small>médiane</small> · ' + esc(moisCourant) + ' <b class="num">' + (x.cur ? '+' + fmt(x.cur) : '—') + '</b>' + (note ? ' · ' + esc(note) : '') + '</span></div></div>';
      }
      h += '<div class="bg-sec rev ouvert"><div class="bg-sh"><i class="dot" aria-hidden="true"></i><span class="t">Revenus <small>point de départ de la cascade</small></span><span class="v num">' + fmt(rp) + '</span></div>' +
        trio([['habituel', fmt(RV.reduce((t, x) => t + (x.on ? x.avg : 0), 0))], [esc(moisCourant), fmt(RV.reduce((t, x) => t + (x.cur || 0), 0))], ['budget', fmt(rp)]]) + rows + '</div>';
    }
    let left = rp;
    const T = {};
    for (const nk of KB().NATS) {
      const grp = P.lignes.filter(a => a.nat === nk && !a.hidden).sort((a, b) => ((b.on ? 1 : 0) - (a.on ? 1 : 0)) || a.label.localeCompare(b.label, 'fr'));
      const on = grp.filter(a => a.on);
      T[nk] = { avg: on.reduce((x, a) => x + a.avg, 0), cur: on.reduce((x, a) => x + a.cur, 0), bud: on.reduce((x, a) => x + a.amt, 0) };
      left -= T[nk].bud;
      const gG = SH ? on.reduce((x, a) => x + Math.max(0, a.amt) * KB().partDe(B, a.key).pg / 100, 0) : 0;
      const addable = KB().ajoutables(B, scope, nk);
      const addSel = '<select class="addpost" data-ajoutposte="' + nk + '" aria-label="Ajouter un poste ' + NAT_LABEL[nk].toLowerCase() + '"><option value="">+ Ajouter un poste</option>' +
        addable.map(c => '<option value="' + esc(c.key) + '">' + esc(c.label) + '</option>').join('') + (nk === 'fixe' ? '<option value="__new">✚ nouveau poste fixe…</option>' : '') + '</select>';
      const ouvert = !ouv.has('ps|' + nk);
      let rows = '';
      for (const a of grp) {
        const id = 'bl-' + scope + '-' + a.key.replace(/\W+/g, '_');
        const det = ouv.has('d|' + a.key) ? KB().detailPoste(B, scope, a.key) : null;
        const cs = KB().contratsDe(B, a.key, scope);
        const nd = (det ? det.length : 1) + cs.length;
        const isFuel = a.key === 'c|Carburant' && !SH;
        const perSel = '<select class="per" data-pper="' + esc(a.key) + '" aria-label="Périodicité ' + esc(a.label) + '"' + (a.on ? '' : ' disabled') + '>' + KB().PER.map(v => '<option value="' + v + '"' + (v === a.per ? ' selected' : '') + '>' + PERLAB[v] + '</option>').join('') + '</select>';
        const part = SH ? KB().partDe(B, a.key) : null, amt = a.on ? Math.max(0, a.amt) : 0, gp = SH ? amt * part.pg / 100 : 0;
        const depasse = a.on && a.amt && a.per === 1 && a.cur > a.amt + DEMI;
        rows += '<div class="bg-rg' + (a.on ? '' : ' off') + ' rmable"><div class="bg-rg1"><label class="chk" for="' + id + '"><input type="checkbox" id="' + id + '" data-pon="' + esc(a.key) + '"' + (a.on ? ' checked' : '') + '> ' + U().icoPoste(C, a) + ' <span class="n">' + esc(a.label) + '</span></label>' +
          (nd ? '<button class="bg-mini" type="button" data-pdet="' + esc(a.key) + '" aria-expanded="' + !!det + '">' + (det ? 'masquer' : 'détail') + '</button>' : '') +
          (isFuel ? '<button class="bg-mini fuelbtn" type="button" data-fuel="1">' + ico('fuel', 13) + ' calculateur</button>' : '') +
          (!a.lie ? '<button class="bg-x rm-line" type="button" data-pretirer="' + esc(a.key) + '" title="Retirer ce poste du budget (la catégorie est conservée)" aria-label="Retirer ' + esc(a.label) + '">✕</button>' : '') + '</div>' +
          '<div class="bg-cmp">' + cmp(a.avg, a.on ? a.amt : 0) + '<button class="refbtn bg-h" type="button" data-pmois="' + esc(a.key) + '" aria-expanded="' + ouv.has('mo|' + a.key) + '" title="' + esc(how(a)) + ' — toucher pour le détail mois par mois">habituel <b class="num">' + fmt(a.avg) + '</b> <small>' + esc(hs(a)) + ' ▾</small></button>' +
          '<span class="bg-h' + (depasse ? ' bad-t' : '') + '">' + esc(moisCourant) + ' <b class="num">' + (a.cur ? fmt(a.cur) : '—') + '</b></span></div>' +
          '<div class="bg-rg2">' + (a.lie ? '<b class="num bg-ro">' + fmt(a.amt) + '</b><button type="button" class="linkbtn golink" data-scope="commun">= ma part du compte commun</button>'
            : '<span class="planbox"><input type="text" inputmode="decimal" id="' + id + '-amt" data-pamt="' + esc(a.key) + '" aria-label="Prévu ' + esc(a.label) + ' par échéance" value="' + esc(a.ech ? F().versSaisie(a.ech) : '') + '" placeholder="0"' + (a.on ? '' : ' disabled') + (a.set ? '' : ' class="auto" title="Proposé : référence de la base de calcul"') + '>' + perSel +
              '<button class="alignbtn" type="button" data-paligner="' + esc(a.key) + '" title="Aligner le prévu sur la référence (' + fmt(a.avg) + ' / mois)" aria-label="Aligner sur la référence"' + (a.on ? '' : ' disabled') + '>=</button></span>' +
              (a.per > 1 ? '<span class="bg-h num">= ' + fmt(a.amt) + ' / mois</span>' : '')) + '</div>' +
          (SH ? '<div class="bg-rg3"><label class="bg-pg">Ma part <input type="number" class="sh-pg" data-ppg="' + esc(a.key) + '" min="0" max="100" step="1" value="' + part.pg + '" aria-label="Ma part pour ' + esc(a.label) + '"' + (a.on ? '' : ' disabled') + '> %</label>' +
            '<span class="bg-h">' + esc(R.moi || 'Moi') + ' <b class="num">' + fmt(gp) + '</b></span><span class="bg-h">' + esc(R.autre || 'Autre') + ' <b class="num">' + fmt(amt - gp) + '</b></span>' +
            '<label class="bg-pg" title="Compte dans l\'équilibre des apports"><input type="checkbox" class="sh-elig" data-pelig="' + esc(a.key) + '"' + (part.elig ? ' checked' : '') + (a.on ? '' : ' disabled') + ' aria-label="' + esc(a.label) + ' compte dans l\'équilibre"> équilibre</label>' +
            (a.per > 1 ? '<span class="bg-h">' + fmt(a.ech) + ' ' + PERLAB[a.per] + ' → ' + fmt(amt) + ' / mois</span>' : '') + '</div>' : '');
        if (ouv.has('mo|' + a.key)) {
          const ms = a.calcul === 'douze' ? (() => { const L = []; for (let m = KB().shift(W.end, -11); m <= W.end; m = KB().shift(m, 1)) L.push([m, (a.m12 || {})[m] || 0]); return L; })() : W.months.map(m => [m, (a.mon || {})[m] || 0]);
          const mx = Math.max(1, ...ms.map(x => x[1]));
          rows += '<div class="months"><div class="mgrid">' + ms.map(([m, v]) => '<div class="mcell' + (v < DEMI ? ' zero' : '') + '"><span class="subs">' + esc(mLabel(m)) + '</span><span class="num">' + (v < DEMI ? '0 €' : fmt(v)) + '</span><i style="width:' + Math.round(100 * Math.max(0, v) / mx) + '%"></i></div>').join('') + '</div>' +
            '<p class="subs" style="margin:6px 0 0">Réel habituel = <b>' + esc(how(a)) + '</b> = ' + fmt(a.avg) + ' / mois. ' + (a.per > 1 ? 'Utilisé car ce poste est payé ' + ({ 3: 'tous les trimestres', 4: 'tous les 4 mois', 12: 'une fois par an' })[a.per] + '.' : 'Les mois viennent de « Base de calcul depuis » en haut du budget.') +
            (a.nat !== 'fixe' && !a.manuel && a.per === 1 ? ' La médiane (le mois du milieu) évite qu\'un mois exceptionnel fausse le chiffre.' : '') + '</p></div>';
        }
        if (det) {
          let L = cs.map(c => '<li class="det ctr-det"><span class="l">' + ico('file-text', 14) + ' <b>' + esc(c.label) + '</b> · contrat ' + e2(c.montant) + ' ' + PERLAB[c.per || 1] + (c.src ? ' · ' + esc(c.src) : '') + '</span><b class="num">' + e2(c.montant / (c.per || 1)) + '</b></li>').join('');
          for (const d of det) {
            const nm = a.nat === 'fixe' ? Object.entries(d.noms).sort((x, y) => y[1] - x[1]).map(x => x[0]).slice(0, 3).join(', ') : d.cle;
            const lab = a.nat === 'fixe' ? fmt(+d.cle * 100) + ' <span class="muted">· ' + (d.n ? d.n + ' fois sur la période' : 'ce mois-ci') + ' — ' + esc(nm) + '</span>' : esc(d.cle) + (d.n ? ' <span class="muted">· ' + d.n + ' × ' + fmt(d.ref / d.n) + '</span>' : '');
            L += '<li class="det"><span class="l">' + lab + '</span><span class="bg-h" title="moyenne sur la base de calcul">habituel <b class="num">' + fmt(d.ref / n) + '</b> · ' + esc(moisCourant) + ' <b class="num">' + (d.cur ? fmt(d.cur) : '—') + '</b></span></li>';
          }
          rows += '<ul class="bg-ops">' + L + '</ul>';
        }
      }
      h += '<div class="bg-sec ' + nk + (ouvert ? ' ouvert' : '') + '"><button type="button" class="bg-sh" data-psec="' + nk + '" aria-expanded="' + ouvert + '"><i class="dot" aria-hidden="true"></i><span class="t">' + NAT_LABEL[nk] +
        (SH ? '' : ' <small>' + NAT_HELP[nk] + '</small>') + '</span><span class="v num">' + fmt(T[nk].bud) + '</span><span class="chev" aria-hidden="true"></span></button>' +
        trio([['habituel', fmt(T[nk].avg)], [esc(moisCourant), fmt(T[nk].cur)], ['budget', fmt(T[nk].bud)], SH ? [esc(R.moi || 'Moi'), fmt(gG)] : ['il reste', reste(left), left < -DEMI ? 'bad-t' : ''], SH ? [esc(R.autre || 'Autre'), fmt(Math.max(0, T[nk].bud) - gG)] : null]) +
        (ouvert ? rows + '<div class="bg-addr">' + addSel + '</div>' : '') + '</div>';
    }
    const TA = T.fixe.avg + T.courante.avg + T.optionnelle.avg, TC = T.fixe.cur + T.courante.cur + T.optionnelle.cur, TB = T.fixe.bud + T.courante.bud + T.optionnelle.bud;
    const ST = SH ? KB().parts(B) : null;
    h += '<div class="ap-bilan bg-bilan">' + (SH
      ? '<div class="ap-br"><span>Total retenu</span><b class="num">' + fmt(TB) + '</b></div>' + trio([['habituel', fmt(TA)], [esc(moisCourant), fmt(TC)], [esc(R.moi || 'Moi'), fmt(ST.moi)], [esc(R.autre || 'Autre'), fmt(ST.autre)]])
      : '<div class="ap-br"><span>= Reste / mois<small>total des dépenses prévues : ' + fmt(TB) + '</small></span>' + solde(left) + '</div>' +
        trio([['habituel', fmt(TA)], [esc(moisCourant), fmt(TC)], ['budget', fmt(TB)], rp ? ['', Math.round(100 * left / rp) + ' % du salaire'] : null])) + '</div>';
    let tete = '';
    if (SH) {
      const vers = g.KladCommun ? g.KladCommun.versementsMoyens(B, W) : null;
      tete = '<div id="share-box"><div class="kpis" id="share-sum">' +
        '<div class="kpi"><span class="eyebrow">Virement mensuel ' + esc(R.moi || 'moi') + '</span><span class="v">' + fmt(ST.moi) + '</span><span class="s">' + (vers ? 'versé en moyenne : ' + fmt(vers.moi) : '') + '</span></div>' +
        '<div class="kpi"><span class="eyebrow">Virement mensuel ' + esc(R.autre || 'autre') + '</span><span class="v">' + fmt(ST.autre) + '</span><span class="s">' + (vers ? 'versé en moyenne : ' + fmt(vers.autre) : '') + '</span></div>' +
        '<div class="kpi"><span class="eyebrow">Rattrapage par mois</span><span class="v">' + fmt(Math.abs(ST.eqMoi - ST.eqAutre)) + '</span><span class="s">postes cochés « Équilibre » : ' + esc(R.moi || 'moi') + ' ' + fmt(ST.eqMoi) + ', ' + esc(R.autre || 'autre') + ' ' + fmt(ST.eqAutre) + '</span></div></div>' +
        '<div class="row addshare"><input type="text" id="sh-label" placeholder="Nouveau poste commun, ex. Courses" aria-label="Nouveau poste commun">' +
        '<input type="text" inputmode="decimal" id="sh-amt" placeholder="€ / mois" aria-label="Montant mensuel"><label class="ctl" for="sh-pg">Ma part <input type="number" id="sh-pg" min="0" max="100" step="1" value="50" style="width:64px"> %</label>' +
        '<button class="btn" type="button" data-shajout="1">Ajouter au compte commun</button></div></div>';
    }
    h = tete + '<div class="bg-corps bg-regl" data-mode="plan">' + h + '</div>';
    h += U().comment((SH ? '' : 'La contribution au compte commun suit automatiquement ma part du budget commun. ') + 'Réel habituel calculé de ' + mLabel(W.start) + ' à ' + mLabel(W.end) + ' (' + pluriel(n, 'mois', 'mois') + ' complets) : moyenne pour les charges fixes, médiane des mois pour les dépenses courantes et optionnelles, réel des 12 derniers mois pour les charges trimestrielles, de 4 mois ou annuelles. ' +
      'Le prévu se saisit par échéance avec sa périodicité ; il est lissé par mois pour la cascade et les virements. Touchez « habituel » pour le détail mois par mois. En gris, le montant proposé tant que vous n\'avez rien saisi ; « = » aligne le prévu sur le réel habituel.');
    return h;
  }

  // Calculateur carburant (1.1) : fenêtre dédiée, ouverte depuis le poste Carburant du Budget (suivi et budget).
  function carburantVolet(B) {
    const R = KB().carburant(B.S), X = KB().calculCarburant(B, R);
    const f = (k, lab) => '<label class="sh-l"><span class="sh-lab">' + lab + '</span><input type="text" inputmode="decimal" class="sh-in" data-fu="' + k + '" value="' + esc(String(R[k]).replace('.', ',')) + '" autocomplete="off"></label>';
    const pl = ((B.D.plan && B.D.plan.perso) || {})['c|Carburant'];
    return '<p class="muted small">Le prévu du poste Carburant d\'après vos trajets. Chaque valeur est enregistrée dès que vous quittez le champ (annulable).</p>' +
      '<div class="fuel-f">' + f('ar', 'Trajet aller-retour travail (km)') + f('jours', 'Jours de trajet par mois') + f('autres', 'Autres kilomètres par mois') + f('conso', 'Consommation (l / 100 km)') + f('prix', 'Prix du litre (€)') + '</div>' +
      '<div class="fuelres" aria-live="polite"><p><b>' + Math.round(X.km).toLocaleString('fr-FR') + ' km par mois → <span class="num">' + e0(X.prevu) + '</span> de carburant par mois</b></p>' +
      '<p class="muted small">Réel des pleins sur la base de calcul : ' + e0(X.reel.mediane) + ' (médiane) · ' + e0(X.reel.moyenne) + ' (moyenne) · ' + pluriel(X.reel.pleins, 'plein') + '.' +
      (pl && pl.on ? ' Prévu actuel : ' + e0(pl.amt) + ' par mois.' : '') + '</p></div>' +
      '<div class="row"><button class="btn primary" type="button" data-fuelok="' + X.prevu + '">Reporter au prévu Carburant (' + e0(X.prevu) + ')</button></div>';
  }
  // ------------------------------------------------------------ reste à vivre (perso) et marge réelle (commun)
  function ravM(B, scope, ui) {
    const S0 = B.S;
    const per = KB().periode(B, scope, ui.nav);
    if (per.past) return '';
    const col = v => v < 0 ? 'var(--bad)' : 'var(--good)';
    const m2 = v => esc(e2(Math.abs(v))) + (v < 0 ? ' <span class="subs">de dépassement</span>' : '');
    if (scope === 'perso') {
      const rav = KB().suivi(B, 'perso', null).rav;
      if (!rav) return '';
      const b = rav.budget, c = rav.comptes;
      if (!c) return '<p class="note" style="margin:0 0 12px">La marge réelle apparaîtra dès que les soldes des comptes courants seront disponibles.</p>';
      const R = (lab, a, x, cls) => (!cls && Math.abs(a - x) < DEMI) ? '<tr class="cm"><th>' + lab + '</th><td class="num mrg" colspan="2">' + m2(a) + '<span class="subs"> commun aux deux</span></td></tr>'
        : '<tr' + (cls ? ' class="' + cls + '"' : '') + '><th>' + lab + '</th><td class="num"' + (cls === 'rv' || cls === 'mg' ? ' style="color:' + col(a) + '"' : '') + '>' + m2(a) + '</td><td class="num"' + (cls === 'rv' || cls === 'mg' ? ' style="color:' + col(x) + '"' : '') + '>' + m2(x) + '</td></tr>';
      const noms = B.comptes.filter(x => x.role === 'courant').map(x => x.libelle).join(' + ');
      return '<details class="mg-det"' + (ui.ravOuvert ? ' open' : '') + ' data-rav="1"><summary><span class="rav">Reste à vivre jusqu\'au ' + jjmm(rav.fin) + '</span> <span class="mg-r"><b class="num" style="color:' + col(b.reste) + '">' + m2(b.reste) + '</b> <span class="subs">sur le dernier salaire</span></span> <span class="sep">·</span> ' +
        '<span class="mg-r"><b class="num" style="color:' + col(c.reste) + '">' + m2(c.reste) + '</b> <span class="subs">sur les comptes courants</span></span> <span class="mg-more">détail</span></summary>' +
        U().interrupteurRav(KB().baseRav(S0), true) +
        '<div class="tablewrap"><table class="rav-t rav-' + KB().baseRav(S0) + '"><thead><tr><th></th><th' + (KB().baseRav(S0) === 'salaire' ? ' class="rav-on"' : '') + '>Dernier salaire' + (b.date ? ' (' + jjmm(b.date) + ')' : '') + '</th><th' + (KB().baseRav(S0) === 'comptes' ? ' class="rav-on"' : '') + '>Comptes courants</th></tr></thead><tbody>' +
        R('Base <span class="subs">salaire / soldes ' + esc(noms) + '</span>', b.base, c.base, 'b') +
        R('− Charges fixes <span class="subs">prélevées / encore à venir</span>', b.fixes, c.fixes, 'b') +
        R('= Marge', b.marge, c.marge, 'mg') +
        R('− Variable <span class="subs">dépensé / reste du budget</span>', b.variable, c.variable, 'b') +
        R('= Reste à vivre', b.reste, c.reste, 'rv') + '</tbody></table></div></details>';
    }
    const Mr = g.KladCommun ? g.KladCommun.margeReelle(B) : null;
    if (!Mr) return '<p class="note" style="margin:0 0 12px">La marge réelle apparaîtra dès que le solde du compte commun sera disponible.</p>';
    const crow = (lab, sub, v, cls) => '<div class="cr-r' + (cls ? ' ' + cls : '') + '"><span class="cr-l">' + lab + (sub ? ' <span class="subs">' + sub + '</span>' : '') + '</span><b class="num"' + (cls === 'tot' ? ' style="color:' + col(v) + '"' : '') + '>' + esc(e2(Math.abs(v))) + (v < 0 && cls !== 'minus' ? ' débiteur' : '') + '</b></div>';
    // 1.1.2 : tant que des virements du mois manquent (en route ou attendus), la marge affichée est la marge prévue
    const prevue = Mr.base === 'prevue';
    // 2.1 : « Où va l'argent du commun » : le solde en barre (charges fixes à venir, reste du budget variable, marge)
    const base = Mr.solde + (Mr.enRoute || 0) + (Mr.attendus || 0);
    const P = [['fix', 'charges fixes à venir', Mr.fixes], ['var', 'reste du budget variable', Mr.variable], ['libre', prevue ? 'marge prévue' : 'marge réelle', Mr.affichee]];
    const barre = base > DEMI ? '<div class="ap-mtete"><span>Solde du compte commun' + (Mr.enRoute || Mr.attendus ? ' et virements attendus' : '') + '</span><b class="num">' + e0(base) + '</b></div><div class="ap-mbar" role="img" aria-label="' + esc(P.map(p => p[1] + ' ' + e0(Math.abs(p[2]))).join(', ')) + '">' + P.filter(p => p[2] > DEMI).map(p => '<i class="m-' + p[0] + '" style="flex:' + Math.round(p[2]) + '"></i>').join('') +
      (Mr.affichee < -DEMI ? '<i class="m-dep" style="flex:' + Math.round(-Mr.affichee) + '"></i>' : '') + '</div>' +
      '<div class="ap-mleg">' + P.map(p => '<span><i class="m-' + (p[2] < -DEMI ? 'dep' : p[0]) + '"></i><b class="num">' + e0(Math.abs(p[2])) + '</b><small>' + esc(p[0] === 'libre' && p[2] < -DEMI ? 'dépassement' : p[1]) + '</small></span>').join('') + '</div>' : '';
    return '<div class="cm-rav ap-card"><h2>Où va l\'argent du commun</h2>' + barre + '<div class="cr-h"><span class="rav">' + (prevue ? 'Marge prévue du commun' : 'Marge réelle du commun') + '</span><b class="num" style="color:' + col(Mr.affichee) + '">' + m2(Mr.affichee) + '</b>' +
      (prevue ? ' <span class="chip info">prévue · en attente de ' + esc(e2(Mr.enAttente)) + '</span>' : '') + '</div><div class="cr-calc">' +
      crow('Disponible', 'solde du compte commun', Mr.solde) +
      (Mr.enRoute ? crow('+ Virements en route', 'partis, pas encore arrivés', Mr.enRoute) : '') +
      (Mr.attendus ? crow('+ Virements attendus', 'pas encore partis', Mr.attendus) : '') +
      crow('− Charges fixes à venir', 'pas encore prélevées ce mois', Mr.fixes, 'minus') +
      crow('− Reste du budget variable', 'courantes + optionnelles', Mr.variable, 'minus') +
      (prevue ? crow('= Marge prévue', 'quand tous les virements du mois seront arrivés', Mr.prevue, 'tot') + crow('Marge réelle', 'sans les virements pas encore arrivés', Mr.marge, 'tot')
        : crow('= Marge réelle', 'rien d\'autre attendu ce mois', Mr.marge, 'tot')) + '</div></div>';
  }

  // ------------------------------------------------------------ tendance (comme l'ancienne version)
  // t : { comptes, mode, from, to } ; options des comptes : comme en haut, mes comptes, compte commun, tous comptes, un compte.
  function niceStep(r) { const e = Math.pow(10, Math.floor(Math.log10(Math.max(r, 1)))); const f = r / e; return (f <= 1.5 ? 1 : f <= 3 ? 2 : f <= 7 ? 5 : 10) * e; }
  function axe(W, H, lo, hi, pad) {
    const step = niceStep((hi - lo) / 5); hi = Math.ceil(hi / step) * step; lo = Math.floor(lo / step) * step;
    const y = v => pad.t + (hi - v) / (hi - lo || 1) * (H - pad.t - pad.b);
    let s = '';
    for (let v = lo; v <= hi + 1e-6; v += step) {
      s += '<line x1="' + pad.l + '" x2="' + (W - pad.r) + '" y1="' + y(v).toFixed(1) + '" y2="' + y(v).toFixed(1) + '" stroke="var(--line)" stroke-width="1"/><text x="' + (pad.l - 6) + '" y="' + (y(v) + 4).toFixed(1) + '" text-anchor="end" fill="' + U().couleurGraduation(v) + '" font-family="JetBrains Mono, monospace" font-size="12">' +
        U().graduation(v) + '</text>';
    }
    return { s, y };
  }
  function tendance(B, scope, t, perSel) {
    const opts = [['auto', 'Comme en haut'], ['perso', 'Mes comptes'], ['commun', 'Compte commun'], ['foyer', 'Tous comptes confondus']].concat(B.comptes.filter(c => c.role !== 'epargne').map(c => [c.id, c.libelle]));
    const cmp = opts.some(o => o[0] === t.comptes) ? t.comptes : 'auto';
    const T = KB().tendanceMois(B, { comptes: cmp, scope, from: perSel.from, to: perSel.to, du: perSel.du, au: perSel.au, mode: t.mode });
    // 1.2.0 : période de moins de 62 jours → un point par jour
    const jour = T.pas === 'jour', lb = k => jour ? jjmm(k) : mLabel(k), unite = jour ? 'jour' : 'mois';
    const mode = t.mode && (t.mode.startsWith('cat:') ? T.categories.indexOf(t.mode.slice(4)) >= 0 : ['rd', 'bal', 'cum', 'solde'].indexOf(t.mode) >= 0) ? t.mode : 'rd';
    const lab = cmp === 'auto' ? (scope === 'commun' ? 'Compte commun' : 'Mes comptes') : (opts.find(o => o[0] === cmp) || [0, ''])[1];
    const rm = T.mois, N = rm.length;
    const Wd = 360, H = 300, pad = { l: 48, r: 10, t: 10, b: 26 };
    const bw = (Wd - pad.l - pad.r) / Math.max(1, N), x0 = i => pad.l + i * bw, every = Math.max(1, Math.ceil(64 / bw));
    let svg = '', titre = '', leg = '', note = '', how = '';
    const sv = v => v < 0 ? 'déficit ' + e0(-v) : '+' + e0(v);
    const tips = [];
    if (mode === 'rd') {
      titre = 'Revenus, dépenses et balance par ' + unite + ' · ' + lab;
      leg = '<span><i style="background:var(--rev)"></i>Revenus</span><span><i style="background:var(--dep)"></i>Dépenses</span><span><i class="line" style="background:var(--sold)"></i>Balance</span>';
      const fr = axe(Wd, H, Math.min(0, ...T.bal), Math.max(100, ...T.rev, ...T.dep, ...T.bal), pad); const y = fr.y; svg = fr.s;
      const barW = Math.max(2, Math.min(18, bw * 0.32));
      svg += '<line x1="' + pad.l + '" x2="' + (Wd - pad.r) + '" y1="' + y(0).toFixed(1) + '" y2="' + y(0).toFixed(1) + '" stroke="var(--muted)" stroke-width="1"/>';
      const bar = (cx, v, dx, col) => { if (v <= 0) return ''; const top = y(v), h = y(0) - top, r = Math.min(4, barW / 2, h); return '<path d="M' + (cx + dx).toFixed(1) + ',' + y(0).toFixed(1) + ' v' + (-(h - r)).toFixed(1) + ' q0,' + (-r).toFixed(1) + ' ' + r.toFixed(1) + ',' + (-r).toFixed(1) + ' h' + (barW - 2 * r).toFixed(1) + ' q' + r.toFixed(1) + ',0 ' + r.toFixed(1) + ',' + r.toFixed(1) + ' v' + (h - r).toFixed(1) + ' z" fill="' + col + '"/>'; };
      rm.forEach((m, i) => { const cx = x0(i) + bw / 2; svg += bar(cx, T.rev[i], -barW - 1, 'var(--rev)') + bar(cx, T.dep[i], 1, 'var(--dep)'); if (i % every === 0) svg += '<text x="' + cx.toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle" fill="var(--muted)" font-family="JetBrains Mono, monospace" font-size="12">' + esc(lb(m)) + '</text>'; });
      svg += '<polyline fill="none" stroke="var(--sold)" stroke-width="2" stroke-linejoin="round" points="' + T.bal.map((v, i) => (x0(i) + bw / 2).toFixed(1) + ',' + y(v).toFixed(1)).join(' ') + '"/>';
      T.bal.forEach((v, i) => { svg += '<circle cx="' + (x0(i) + bw / 2).toFixed(1) + '" cy="' + y(v).toFixed(1) + '" r="4" fill="' + (v >= 0 ? 'var(--good)' : 'var(--bad)') + '" stroke="var(--surface)" stroke-width="2"/>'; });
      rm.forEach((m, i) => tips.push([lb(m), [['var(--rev)', 'Revenus', e0(T.rev[i])], ['var(--dep)', 'Dépenses', e0(T.dep[i])], ['var(--sold)', 'Balance', sv(T.bal[i])]]]));
      const bl = rm.map((m, i) => [m, T.bal[i]]), avg = bl.reduce((s0, x) => s0 + x[1], 0) / Math.max(1, bl.length), neg = bl.filter(x => x[1] < 0);
      const best = bl.slice().sort((a, b) => b[1] - a[1])[0], worst = bl.slice().sort((a, b) => a[1] - b[1])[0];
      note = !bl.length ? '' : bl.length === 1 ? (jour ? U().dLong(bl[0][0]) : U().mLong(bl[0][0], B.auj)) + ' : balance ' + sv(avg) + '.' : 'Balance moyenne ' + sv(avg) + ' par ' + unite +
        (neg.length ? ' ; ' + pluriel(neg.length, unite + ' déficitaire', unite + (jour ? 's' : '') + ' déficitaires') + ' (le pire : ' + lb(worst[0]) + ', déficit ' + e0(-worst[1]) + ')' : ' ; aucun ' + unite + ' déficitaire') + ' ; meilleur ' + unite + ' : ' + lb(best[0]) + ' (' + sv(best[1]) + ').';
      how = 'Comptes : ' + lab + (T.perimetre === 'foyer' ? ' (virements entre comptes et ma part au commun comptés une seule fois)' : '') + '. Virements entre vos comptes, versements sur livrets, règlements de carte ou de portefeuille déjà détaillés et opérations hors budget sont exclus. Balance = revenus − dépenses du ' + unite + '.';
    } else {
      let bars = T.barres || null, line = T.ligne || null, ref = T.ref || null, nom = '', col = 'var(--dep)';
      if (mode === 'bal') { nom = 'Balance'; titre = (jour ? 'Balance par jour' : 'Balance mensuelle') + ' (revenus − dépenses)'; note = 'Vert : ' + unite + ' où les revenus couvrent les dépenses ; rouge : ' + unite + ' déficitaire.'; }
      else if (mode === 'cum') { nom = 'Balance cumulée'; titre = 'Balance cumulée sur la période'; note = jour ? 'Somme des balances de chaque jour depuis le premier jour affiché.' : 'Somme des balances mensuelles depuis le premier mois affiché.'; }
      else if (mode === 'solde') {
        nom = 'Solde'; titre = (jour ? 'Solde en fin de journée · ' : 'Solde fin de mois · ') + (T.soldeComptes || []).join(', ');
        if (!line) return panneauTendance(perSel, opts, cmp, T, mode, titre, '', '<p class="muted" style="padding:20px">Solde actuel non disponible : la courbe apparaîtra avec la prochaine synchronisation.</p>', '', how);
        note = 'Reconstitué à partir du solde actuel (' + F().solde(T.solde) + ') en retirant les opérations postérieures à chaque fin de ' + (jour ? 'journée' : 'mois') + '.';
      } else { nom = T.cat; col = 'var(--c1)'; titre = 'Dépenses par ' + unite + ' · ' + T.cat; note = ref ? 'Pointillés : budget mensuel (' + e0(ref) + ').' : jour ? 'Dépenses de chaque jour (le budget mensuel n\'est pas reporté par jour).' : 'Pas de budget mensuel pour cette catégorie.'; }
      const vals = [...(bars || []), ...(line || []).filter(v => v !== null), ...(ref ? [ref] : [])];
      const fr = axe(Wd, H, Math.min(0, ...vals), Math.max(100, ...vals), pad); const y = fr.y; svg = fr.s;
      const barW = Math.max(3, Math.min(26, bw * 0.55));
      svg += '<line x1="' + pad.l + '" x2="' + (Wd - pad.r) + '" y1="' + y(0).toFixed(1) + '" y2="' + y(0).toFixed(1) + '" stroke="var(--muted)" stroke-width="1"/>';
      if (bars) bars.forEach((v, i) => { const cx = x0(i) + bw / 2, top = Math.min(y(v), y(0)), h = Math.abs(y(v) - y(0)); const c = mode === 'bal' ? (v < 0 ? 'var(--bad)' : 'var(--good)') : (ref && v > ref + DEMI ? 'var(--bad)' : col); svg += '<rect x="' + (cx - barW / 2).toFixed(1) + '" y="' + top.toFixed(1) + '" width="' + barW.toFixed(1) + '" height="' + Math.max(0.5, h).toFixed(1) + '" rx="2" fill="' + c + '"/>'; });
      if (ref) svg += '<line x1="' + pad.l + '" x2="' + (Wd - pad.r) + '" y1="' + y(ref).toFixed(1) + '" y2="' + y(ref).toFixed(1) + '" stroke="var(--ink-2)" stroke-width="1.5" stroke-dasharray="5 4"/>';
      if (line) {
        svg += '<polyline fill="none" stroke="var(--sold)" stroke-width="2" stroke-linejoin="round" points="' + line.map((v, i) => v === null ? '' : (x0(i) + bw / 2).toFixed(1) + ',' + y(v).toFixed(1)).filter(Boolean).join(' ') + '"/>';
        line.forEach((v, i) => { if (v !== null) svg += '<circle cx="' + (x0(i) + bw / 2).toFixed(1) + '" cy="' + y(v).toFixed(1) + '" r="3.5" fill="' + (v >= 0 ? 'var(--good)' : 'var(--bad)') + '" stroke="var(--surface)" stroke-width="2"/>'; });
      }
      rm.forEach((m, i) => { if (i % every === 0) svg += '<text x="' + (x0(i) + bw / 2).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle" fill="var(--muted)" font-family="JetBrains Mono, monospace" font-size="12">' + esc(lb(m)) + '</text>'; });
      rm.forEach((m, i) => tips.push([lb(m), bars ? [[mode === 'bal' ? (bars[i] < 0 ? 'var(--bad)' : 'var(--good)') : col, nom, mode === 'bal' ? sv(bars[i]) : e0(bars[i])]].concat(ref ? [['var(--ink-2)', 'Budget', e0(ref)]] : [])
        : [['var(--sold)', nom, line[i] === null ? '—' : mode === 'solde' ? F().solde(line[i]) : sv(line[i])]]]));
      if (titre.indexOf(lab) < 0 && mode !== 'solde') titre += ' · ' + lab;
      leg = bars ? (mode === 'bal' ? '<span><i style="background:var(--good)"></i>Positive</span><span><i style="background:var(--bad)"></i>Négative</span>' : '<span><i style="background:' + col + '"></i>' + esc(nom) + '</span>' + (ref ? '<span><i class="line" style="background:var(--ink-2)"></i>Budget</span><span><i style="background:var(--bad)"></i>Au-delà</span>' : ''))
        : '<span><i class="line" style="background:var(--sold)"></i>' + esc(nom) + '</span>';
    }
    rm.forEach((m, i) => { svg += '<rect data-i="' + i + '" x="' + x0(i).toFixed(1) + '" y="' + pad.t + '" width="' + bw.toFixed(1) + '" height="' + (H - pad.t - pad.b) + '" fill="transparent"/>'; });
    const box = '<svg viewBox="0 0 ' + Wd + ' ' + H + '" width="100%" height="' + H + '" preserveAspectRatio="none" role="img" aria-label="' + esc(titre) + '">' + svg + '</svg><div class="tip" hidden></div>' +
      '<script type="application/json" class="tips">' + JSON.stringify(tips).replace(/</g, '\\u003c') + '</script>';
    return panneauTendance(perSel, opts, cmp, T, mode, titre, leg, box, note, how);
  }
  function panneauTendance(perSel, opts, cmp, T, mode, titre, leg, box, note, how) {
    // 1.2.0 : période personnalisée au jour près (perSel.n === 'perso')
    const perso = perSel.n === 'perso' && perSel.du && perSel.au;
    const per = perso ? (perSel.du === perSel.au ? jjmmaa(perSel.du) : jjmmaa(perSel.du) + ' → ' + jjmmaa(perSel.au))
      : perSel.from === perSel.to ? mLabel(perSel.from) : mLabel(perSel.from) + ' → ' + mLabel(perSel.to);
    const n = perSel.n;
    return '<div class="panel-h"><h2 class="fold" role="button" tabindex="0" title="Replier / déplier">Tendance</h2><span class="muted an-per">' + esc(per) + '</span></div>' +
      // 1.2.0 : « custom » quand les champs de la période sont ouverts (sans elle, ils restaient cachés sur téléphone)
      '<div class="an-bar' + (perSel.choix ? ' custom' : '') + '"><span class="an-t">Période d\'analyse</span><div class="an-ctl">' +
      '<button type="button" class="per-step" data-step="-1" aria-label="' + (perso ? 'Décaler la période d\'autant en arrière' : 'Décaler la période d\'un mois en arrière') + '">◀</button>' +
      '<button type="button" class="an-lab" id="an-lab" data-anlab="1" aria-expanded="' + !!perSel.choix + '">' + esc(per) + ' ▾</button>' +
      '<button type="button" class="per-step" data-step="1" aria-label="' + (perso ? 'Décaler la période d\'autant en avant' : 'Décaler la période d\'un mois en avant') + '">▶</button>' +
      (perSel.choix ? '<label class="ctl" for="tend-du">Du <input type="date" id="tend-du" value="' + esc(perSel.du || '') + '"' + (perSel.min ? ' min="' + esc(perSel.min) + '"' : '') + (perSel.max ? ' max="' + esc(perSel.max) + '"' : '') + '></label>' +
        '<label class="ctl" for="tend-au">au <input type="date" id="tend-au" value="' + esc(perSel.au || '') + '"' + (perSel.min ? ' min="' + esc(perSel.min) + '"' : '') + (perSel.max ? ' max="' + esc(perSel.max) + '"' : '') + '></label>' +
        '<p class="note an-pas">Moins de 62 jours : un point par jour ; sinon, un point par mois.</p>' : '') +
      '<div class="seg" role="group" aria-label="Période rapide">' + [1, 3, 6, 12].map(k => '<button type="button" data-preset="' + k + '" aria-pressed="' + (n === k) + '">' + k + '<span class="pu"> mois</span><span class="pm">m</span></button>').join('') +
      '<button type="button" data-preset="tout" aria-pressed="' + (n === 'tout') + '">Tout</button></div></div></div>' +
      '<div class="tend-ctl"><label class="ctl" for="tend-acc">Comptes <select id="tend-acc" aria-label="Comptes pris en compte dans la Tendance">' + opts.map(o => '<option value="' + esc(o[0]) + '"' + (o[0] === cmp ? ' selected' : '') + '>' + esc(o[1]) + '</option>').join('') + '</select></label>' +
      '<label class="ctl" for="tend-mode">Afficher <select id="tend-mode" aria-label="Série affichée sur le graphique"><option value="rd"' + (mode === 'rd' ? ' selected' : '') + '>Revenus et dépenses</option><option value="bal"' + (mode === 'bal' ? ' selected' : '') + '>Balance mensuelle</option>' +
      '<option value="cum"' + (mode === 'cum' ? ' selected' : '') + '>Balance cumulée</option><option value="solde"' + (mode === 'solde' ? ' selected' : '') + '>Solde du compte courant</option><optgroup label="Une catégorie">' +
      T.categories.map(c => '<option value="cat:' + esc(c) + '"' + (mode === 'cat:' + c ? ' selected' : '') + '>' + esc(c) + '</option>').join('') + '</optgroup></select></label></div>' +
      '<div class="subpanel tend-chart"><div class="sub-h"><h3 id="tend-title">' + esc(titre) + '</h3><div class="legend" id="tend-leg" aria-hidden="true">' + leg + '</div></div>' +
      '<div class="chartbox" id="monthly">' + box + '</div><p class="note" id="tend-note">' + esc(note) + '</p>' + (how ? U().comment(esc(how)) : '') + '</div>';
  }

  // ------------------------------------------------------------ contrats (montants des documents)
  function contrats(B, scope, ed) {
    const L = KB().contrats(B, scope);
    let h = U().tete('Contrats — montants des documents', '<div class="row"><span class="muted">' + (scope === 'commun' ? 'appartement, compte commun' : 'vos contrats personnels') + '</span>' +
      '<button class="btn" type="button" data-ctedit="' + (ed ? '' : 'liste') + '">' + (ed ? 'Terminer' : 'Modifier la liste') + '</button></div>');
    if (ed === 'nouveau') h += g.KladVuesBudget.formContrat(B, scope, ed);
    // 1.3.3 : trois sous-sections repliables (liste, prévu du poste, échéances), état gardé sur ce téléphone ; en
    // modification, la liste reste ouverte
    const sous = (k, titre, resume, corps, ouvert) => {
      const id = 'p-contrats-' + scope + '-' + k, o = ouvert || !U().replie(id);
      return '<details class="ctr-sub" data-pli="' + id + '"' + (o ? ' open' : '') + '><summary><h3 class="obs-h3">' + esc(titre) + '</h3>' +
        (resume ? '<span class="subs">' + esc(resume) + '</span>' : '') + '</summary>' + corps + '</details>';
    };
    let liste = '';
    if (!L.length) liste += '<p class="muted">Aucun contrat ' + (scope === 'commun' ? 'du compte commun' : 'perso') + '.</p>';
    else liste += '<div class="tablewrap"><table class="cats ctr-t"><thead><tr><th>Contrat</th><th class="r">Montant</th><th>Dernier prélèvement</th><th>État</th></tr></thead><tbody>' +
      L.map(c => ed === c.id ? '<tr><td colspan="4">' + g.KladVuesBudget.formContrat(B, scope, ed) + '</td></tr>'
        : '<tr><td><b>' + esc(c.label) + '</b>' + (c.posteLabel ? '<div class="subs">poste ' + esc(c.posteLabel) + '</div>' : '') +
          // 1.3.4 : numéro et fin du contrat
          (c.num || c.fin ? '<div class="subs">' + esc([c.num ? 'n° ' + c.num : '', c.fin ? 'fin le ' + jjmmaa(c.fin) : ''].filter(Boolean).join(' · ')) + '</div>' : '') + (c.src || c.note ? '<div class="subs">' + esc([c.src, c.note].filter(Boolean).join(' · ')) + '</div>' : '') +
          (ed ? ' <button class="linkbtn" type="button" data-ctedit="' + esc(c.id) + '">modifier</button>' : '') + '</td>' +
          '<td class="r num">' + e2(c.montant) + ' <span class="subs">' + esc(PERLAB[c.per || 1]) + '</span>' + (c.per > 1 ? '<div class="subs">soit ' + e2(c.mensuel) + ' / mois</div>' : '') + '</td>' +
          '<td>' + (c.dernier ? e2(c.dernier.montant) + ' <span class="subs">le ' + jjmmaa(c.dernier.date) + '</span>' : '<span class="muted">aucun trouvé</span>') + (c.prochaine ? '<div class="subs">prochaine échéance le ' + jjmmaa(c.prochaine) + '</div>' : '') + '</td>' +
          '<td>' + chip(c.etat) + '</td></tr>').join('') + '</tbody></table></div>';
    if (ed && ed !== 'nouveau') liste += '<div class="row"><button class="btn" type="button" data-ctedit="nouveau">+ Ajouter un contrat</button></div>';
    const aVoir = L.filter(c => c.etat && c.etat.niveau !== 'good').length;
    h += sous('liste', 'Contrats', L.length + ' contrat' + (L.length > 1 ? 's' : '') + (aVoir ? ' · ' + aVoir + ' à vérifier' : ''), liste, !!ed);
    const PP = KB().contratsParPoste(B, scope);
    if (PP.length) {
      const ecarts = PP.filter(x => x.etat.texte !== 'aligné').length;
      h += sous('postes', 'Prévu du poste et contrats', ecarts ? ecarts + ' poste' + (ecarts > 1 ? 's' : '') + ' à aligner' : 'tout est aligné', '<ul class="list">' + PP.map(x => '<li><div class="grow">' + esc(x.label) +
        '<small>' + (x.budget == null ? 'poste absent du budget' : 'prévu ' + e2(x.budget) + ' par mois') + ' · contrats ' + e2(x.contrats) + ' par mois' + (x.n > 1 ? ' (' + x.n + ')' : '') + '</small>' +
        // 1.3.6 : pastille et bouton sous le texte (à 390 px, le texte tenait dans une colonne de 70 px)
        '<div class="ctr-pp">' + chip(x.etat) + (x.etat.texte !== 'aligné' ? ' <button class="linkbtn" type="button" data-versprevu="' + esc(x.poste) + '">→ prévu</button>' : '') + '</div></div></li>').join('') + '</ul>');
    }
    const E = KB().echeances(B, 31).filter(x => x.scope === scope || x.sorte === 'carte');
    h += sous('echeances', 'Échéances des 31 prochains jours', E.length ? E.length + ' échéance' + (E.length > 1 ? 's' : '') : 'aucune', (E.length ? '<ul class="list">' + E.map(x => '<li><div class="grow">' + esc(x.label) +
      '<small>' + esc(jjmmaa(x.date) + ' · ' + ({ contrat: 'contrat', recurrent: 'prélèvement récurrent', carte: 'carte à débit différé' }[x.sorte])) + '</small></div><span class="num">' + esc(e2(x.montant)) + '</span></li>').join('') + '</ul>'
      : '<p class="muted">Aucune échéance connue.</p>'));
    h += U().comment('Montants des contrats et documents (pas des relevés), comparés au dernier prélèvement trouvé avec le mot du libellé bancaire. « → prévu » reporte le total des contrats du poste dans le budget (annulable).');
    return h;
  }
  // Formulaire d'un contrat (ed : identifiant du contrat, ou 'nouveau').
  function formContrat(B, scope, ed) {
    const c = ed === 'nouveau' ? { id: '', label: '', montant: 0, per: 1, motif: '', poste: '', src: '', note: '' } : (B.D.contrats || []).find(x => x.id === ed);
    if (!c) return '';
    const P = KB().postes(B, scope);
    const keys = [...new Set(P.lignes.filter(a => !a.hidden && !a.lie).map(a => a.key).concat(c.poste ? [c.poste] : []))].filter(k => k[0] !== 'r')
      .sort((a, b) => a.slice(2).localeCompare(b.slice(2), 'fr'));
    return '<div class="ctrform" data-ctid="' + esc(c.id) + '"><b>' + (c.id ? 'Modifier le contrat' : 'Nouveau contrat') + '</b>' +
      '<label class="sh-l"><span class="sh-lab">Libellé</span><input class="sh-in" id="ctLabel" maxlength="80" autocomplete="off" value="' + esc(c.label) + '" placeholder="ex. Assurance habitation"></label>' +
      '<div class="grp"><label class="sh-l"><span class="sh-lab">Montant du document</span><input class="sh-in" id="ctMontant" inputmode="decimal" autocomplete="off" value="' + esc(c.montant ? F().versSaisie(c.montant) : '') + '"></label>' +
      '<label class="sh-l"><span class="sh-lab">Périodicité</span><select class="sh-in" id="ctPer">' + KB().PER.map(p => '<option value="' + p + '"' + (p === (+c.per || 1) ? ' selected' : '') + '>' + esc(PERLAB[p]) + '</option>').join('') + '</select></label></div>' +
      '<label class="sh-l"><span class="sh-lab">Mot du libellé bancaire</span><input class="sh-in" id="ctMotif" maxlength="200" autocomplete="off" spellcheck="false" value="' + esc(c.motif) + '" placeholder="plusieurs possibles, séparés par |"></label>' +
      // 1.3.4 : numéro de contrat (prioritaire sur le mot) avec les numéros trouvés dans les prélèvements ; fin du contrat
      (() => {
        const NP = c.id ? KB().numerosProposes(B, c) : [];
        return '<label class="sh-l"><span class="sh-lab">Numéro de contrat</span><input class="sh-in" id="ctNum" maxlength="40" autocomplete="off" spellcheck="false" value="' + esc(c.num || '') + '" placeholder="facultatif, ex. AB1234567"></label>' +
          '<p class="muted small ct-aide">Reconnu dans le libellé du prélèvement, avant le mot : utile quand plusieurs contrats ont le même organisme.</p>' +
          (NP.length ? '<div class="ct-nums" role="group" aria-label="Numéros trouvés dans les prélèvements"><span class="muted small">Trouvés dans les prélèvements :</span>' +
            NP.map(x => '<button type="button" class="puce' + (x.num === (c.num || '') ? ' on' : '') + '" data-ctnum="' + esc(x.num) + '">' + esc(x.num) +
              ' <span class="subs">' + esc(F().montant(x.montant) + ' le ' + x.date.slice(8, 10) + '/' + x.date.slice(5, 7) + (x.autre ? ' · ' + x.autre : '')) + '</span></button>').join('') + '</div>' : '') +
          '<label class="sh-l"><span class="sh-lab">Fin du contrat (résiliation)</span><input class="sh-in" id="ctFin" type="date" value="' + esc(c.fin || '') + '"></label>' +
          '<p class="muted small ct-aide">Après cette date, un prélèvement de ce contrat est « non prévu » : signalé, et compté à part du poste.</p>';
      })() +
      '<label class="sh-l"><span class="sh-lab">Poste du budget</span><select class="sh-in" id="ctPoste"><option value="">' + (c.id ? '— aucun —' : 'deviner d\'après le libellé') + '</option>' +
      keys.map(k => '<option value="' + esc(k) + '"' + (k === c.poste ? ' selected' : '') + '>' + esc(k.slice(2)) + '</option>').join('') +
      '<option value="__nouveau">Nouveau poste fixe au nom du contrat</option></select></label>' +
      '<label class="sh-l"><span class="sh-lab">Source</span><input class="sh-in" id="ctSrc" maxlength="120" autocomplete="off" value="' + esc(c.src) + '" placeholder="contrat, avis, facture…"></label>' +
      '<label class="sh-l"><span class="sh-lab">Note</span><input class="sh-in" id="ctNote" maxlength="200" autocomplete="off" value="' + esc(c.note) + '"></label>' +
      '<div class="row"><button class="btn primary" type="button" data-ct="ok">Enregistrer</button><button class="btn" type="button" data-ct="fermer">Annuler</button>' +
      (c.id ? '<span class="grow"></span><button class="btn danger small" type="button" data-ct="suppr">Supprimer</button>' : '') + '</div></div>';
  }

  // ------------------------------------------------------------ volets : édition d'un poste, reste à vivre
  function edition(B, scope, key) {
    const C = B.cx.C;
    if (key.startsWith('r|')) {
      const x = KB().revenusAttendus(B).find(r => 'r|' + r.cat === key) || { cat: key.slice(2), amt: 0, on: true, libre: true, avg: 0 };
      let h = '<div class="sh-head op-h">' + U().cico(C, x.cat) + '<div class="t"><b>' + esc(x.cat) + '</b><span>revenu attendu par mois</span></div></div>' +
        '<label class="inline"><input type="checkbox" id="peOn"' + (x.on ? ' checked' : '') + '> Compté dans le budget</label>';
      if (x.cat === 'Salaire') {
        h += '<label class="sh-l"><span class="sh-lab">Calcul du salaire attendu</span><select class="sh-in" id="peMode">' + Object.keys(KB().MODES_SALAIRE).map(m => '<option value="' + m + '"' + (m === x.mode ? ' selected' : '') + '>' + esc(KB().MODES_SALAIRE[m]) + '</option>').join('') + '</select></label>' +
          '<label class="sh-l"><span class="sh-lab">Montant (mode « montant libre »)</span><input class="sh-in" id="peAmt" inputmode="decimal" value="' + esc(x.mode === 'libre' ? F().versSaisie(x.amt) : '') + '"' + (x.mode === 'libre' ? '' : ' disabled') + '></label>' +
          '<p class="muted small">Actuellement : ' + e0(x.amt) + (x.sal && x.sal.last ? ' · dernier salaire ' + e2(x.sal.last.m) + ' le ' + jjmmaa(x.sal.last.date) : '') + '</p>';
      } else h += '<label class="sh-l"><span class="sh-lab">Montant attendu par mois</span><input class="sh-in" id="peAmt" inputmode="decimal" value="' + esc(x.set ? F().versSaisie(x.amt) : '') + '" placeholder="0"></label>';
      return h + '<p class="muted small">Habituel (médiane) : ' + e0(x.avg || 0) + ' par mois.</p><button type="button" class="sh-go" data-pe="ok">Enregistrer</button>';
    }
    const P = KB().postes(B, scope);
    const a = P.lignes.find(x => x.key === key) || { key, label: key.slice(2), nat: key[0] === 'f' ? 'fixe' : K().natureDe(C, key.slice(2)), avg: 0, amt: 0, ech: 0, per: 1, on: true, calcul: 'mediane', set: false };
    const calc = a.calcul === 'douze' ? 'total des 12 derniers mois ÷ 12' : a.calcul === 'moyenne' ? 'moyenne des ' + P.W.months.length + ' mois de référence' : 'médiane des ' + P.W.months.length + ' mois de référence';
    let h = '<div class="sh-head op-h">' + U().icoPoste(C, a) + '<div class="t"><b>' + esc(a.label) + '</b><span>' + esc(KB().NOMS[a.nat] || '') + ' · ' + (scope === 'commun' ? 'commun' : 'perso') + '</span></div></div>';
    if (a.lie) return h + '<p class="muted">Ce poste suit automatiquement ma part du budget du compte commun : ' + e0(a.amt) + ' par mois.</p>';
    h += '<label class="inline"><input type="checkbox" id="peOn"' + (a.on ? ' checked' : '') + '> Dans le budget</label>' +
      '<div class="grp"><label class="sh-l"><span class="sh-lab">Montant par échéance</span><input class="sh-in" id="peAmt" inputmode="decimal" value="' + esc(a.set || a.on ? F().versSaisie(a.per > 1 ? a.ech : a.amt) : '') + '"></label>' +
      '<label class="sh-l"><span class="sh-lab">Périodicité</span><select class="sh-in" id="pePer">' + KB().PER.map(p => '<option value="' + p + '"' + (p === a.per ? ' selected' : '') + '>' + esc(PERLAB[p]) + '</option>').join('') + '</select></label></div>' +
      (a.per > 1 ? '<p class="muted small">Soit ' + e0(a.amt) + ' par mois.</p>' : '') +
      (scope === 'commun' ? '<div class="grp"><label class="sh-l"><span class="sh-lab">Ma part (%)</span><input class="sh-in" id="pePg" inputmode="numeric" value="' + esc(KB().partDe(B, key).pg) + '"></label><label class="inline"><input type="checkbox" id="peElig"' + (KB().partDe(B, key).elig ? ' checked' : '') + '> Compte dans l\'équilibre</label></div>' : '') +
      '<p class="muted small">Réel habituel : ' + e0(a.avg) + ' par mois (' + esc(calc) + ').' + (a.set ? '' : ' Montant proposé tant que vous n\'avez rien saisi.') + '</p>' +
      '<button type="button" class="sh-go" data-pe="ok">Enregistrer</button>' +
      '<div class="row center"><button type="button" class="btn" data-pe="aligner">Aligner sur le réel habituel</button><button type="button" class="btn danger small" data-pe="retirer">' + (key[0] === 'm' ? 'Supprimer le poste' : 'Retirer du budget') + '</button></div>';
    return h;
  }
  // base (0.10.7) : colonne choisie (« salaire » ou « comptes »), mise en avant ; les deux colonnes restent affichées.
  // 1.2.0 : plus de ligne « Par jour » (le troisième paramètre, jours restants, n'est plus lu).
  function detailRav(rav, base) {
    if (!rav) return '<p class="muted">Le reste à vivre se calcule sur le cycle en cours du périmètre perso.</p>';
    const b = rav.budget, c = rav.comptes, x = KB().ravChoisi(rav, base);
    const on = k => x.choix === k ? ' class="rav-on"' : '';
    const cel = x => x == null ? '<td class="muted">—</td>' : '<td class="num">' + (x < -DEMI / 2 ? '<span class="bad">' + esc(e2(-x)) + ' en dépassement</span>' : esc(e2(x))) + '</td>';
    const L = (lab, sub, x, y, cls) => '<tr' + (cls ? ' class="' + cls + '"' : '') + '><th>' + lab + (sub ? '<span class="subs"> ' + sub + '</span>' : '') + '</th>' + cel(x) + cel(y) + '</tr>';
    return '<p class="rav-tete">Affiché sur l\'Accueil et dans Grafit :</p>' + U().interrupteurRav(x.choix, !!c) +
      '<div class="tablewrap"><table class="rav-t rav-' + x.choix + '"><thead><tr><th></th><th' + on('salaire') + '>Dernier salaire' + (b.date ? ' (' + jjmm(b.date) + ')' : '') + '</th><th' + on('comptes') + '>Comptes courants</th></tr></thead><tbody>' +
      L('Base', 'salaire / soldes des comptes courants', b.base, c && c.base, 'b') +
      (c && c.cartes > 0 ? L('− Carte à débit différé', 'déjà comptée dans le dépensé / somme à prélever', null, c.cartes, 'b') : '') +
      L('− Charges fixes', 'prélevées / encore à venir', b.fixes, c && c.fixes, 'b') +
      L('= Marge', '', b.marge, c && c.marge, 'mg') + L('− Variable', 'dépensé / reste du budget', b.variable, c && c.variable, 'b') +
      L('= Reste à vivre', '', b.reste, c && c.reste, 'rv') +
      '</tbody></table></div>' +
      '<p class="muted small">Jusqu\'au ' + esc(jjmmaa(rav.fin)) + '. Colonne « dernier salaire » : le salaire du cycle moins ce qui est déjà dépensé. ' +
      'Colonne « comptes courants » : les soldes des comptes courants moins la somme due sur la carte à débit différé, les charges fixes pas encore prélevées et le reste du budget variable.</p>';
  }
  // Ancienne carte « Reste à vivre » (lue par le résumé Grafit et les tests) : texte simple.
  function carteRav(rav) {
    if (!rav) return '';
    return '<div class="rav-c">Reste à vivre jusqu\'au ' + esc(jjmm(rav.fin)) + ' : ' + esc(e2(Math.abs(rav.budget.reste))) + (rav.budget.reste < 0 ? ' en dépassement' : '') + ' sur le dernier salaire' +
      (rav.comptes ? ', ' + esc(e2(Math.abs(rav.comptes.reste))) + (rav.comptes.reste < 0 ? ' en dépassement' : '') + ' sur les comptes courants' : '') + '</div>';
  }


  // ------------------------------------------------------------ observations et recommandations (comme l'ancienne version)
  // opt : { analyse: bool (extra Claude actif), texteAnalyse }.
  function observations(B, scope, opt) {
    const KO = g.KladObservations;
    if (!KO) return '';
    const O = KO.observations(B, scope);
    const SCL = { perso: 'Perso', commun: 'Commun', all: 'Général' };
    const cnt = sc => O.faire.filter(a => a.scope === sc).length;
    // 2.1 : carte « À faire » en bas de l'Aperçu : les points du périmètre affiché (Moi : perso et général, Nous : commun et
    // général) ; tous les points, les observations, les points faits et leur historique : « Toutes les observations » (volet)
    const ici = O.faire.filter(a => a.scope === scope || a.scope === 'all'), ailleurs = O.faire.length - ici.length;
    const court = a => '<li class="' + esc(a.niveau) + '"><i aria-hidden="true"></i><div><b>' + esc(a.titre) + '</b> <span class="sc-tag sc-' + esc(a.scope) + '">' + SCL[a.scope] + '</span><p>' + esc(a.texte) + '</p>' +
      '<button class="linkbtn obs-done" type="button" data-fait="' + esc(a.titre) + '">c\'est fait</button></div></li>';
    let h = '<div class="panel-h"><h2 class="fold" role="button" tabindex="0" title="Replier / déplier">À faire</h2><div class="obs-head" id="obs-head">' +
      (O.faire.length ? '<span class="chip warn">' + O.faire.length + ' à faire</span><span class="subs">' + ['perso', 'commun', 'all'].filter(k => cnt(k)).map(k => SCL[k] + ' ' + cnt(k)).join(' · ') + '</span>' : '<span class="chip good">rien à faire</span>') + '</div></div>';
    h += '<div id="obs-todo">' + (ici.length ? '<ul class="obs-c">' + ici.map(court).join('') + '</ul>' : '<p class="muted" style="margin:0 0 8px">' + (O.faire.length ? 'Rien à faire ici' + (ailleurs ? ' : ' + pluriel(ailleurs, 'point') + ' ' + (scope === 'commun' ? 'perso' : 'du commun') + ' (Toutes les observations).' : '.') : 'Aucune action en attente, sur vos comptes comme sur le compte commun.') + '</p>') + '</div>';
    h += '<div class="obs-tous"><button class="ap-lien" type="button" data-ouvrir="secObs">Toutes les observations (' + (O.faire.length + O.infos.length) + ') ›</button>' +
      (O.masques.length ? '<button class="ap-lien obs-undo" type="button" data-reafficher="1">Réafficher ' + pluriel(O.masques.length, 'point fait', 'points faits') + '</button>' : '') + '</div>';
    h += '<div class="row obs-act"><button class="btn" type="button" data-audit="1">Relancer l\'audit</button>' + (opt && opt.analyse ? '<button class="btn" type="button" data-analyse="1">Analyse de Claude</button>' : '') +
      '<span class="eyebrow" id="audit-at">audit du ' + esc(U().dfr(B.auj)) + ' · mes comptes et compte commun</span></div>' +
      (opt && opt.texteAnalyse ? '<div class="ai-out" id="ai-out" aria-live="polite">' + esc(opt.texteAnalyse) + '</div>' : '');
    return h;
  }

  g.KladVuesBudget = { observations, libellePeriode, cycNav, teteBudget, suivi, bilan, soldeBar, anneau, plan, carburantVolet, totBar, repartition, ravM, tendance, contrats, formContrat, edition, detailRav, carteRav, PERLAB, NAT_LABEL };
})(typeof window !== 'undefined' ? window : globalThis);
