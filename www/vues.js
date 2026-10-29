// Klad — rendu de l'onglet Budget (haut de l'écran : grande carte, cartes des comptes, « à voir », « À vérifier »),
// de la liste des opérations (par jour, comme l'ancienne version), du détail d'une opération et du volet « Classer ».
// Chaînes HTML, sans accès au DOM : testées dans node. Apparence identique à l'ancienne version sur téléphone.
// Aucun montant n'est affiché avec un signe moins : débit « 85,00 € », crédit « +10,00 € », solde « 42,50 € débiteur ».
(function (g) {
  'use strict';

  const F = () => g.KladFormat;
  const M = () => g.KladModele;
  const K = () => g.KladClasse;
  const U = () => g.KladUI;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const ROLES = {
    courant: 'Compte courant', carte_differee: 'Carte à débit différé', paiement_en_ligne: 'Paiement en ligne',
    epargne: 'Épargne', commun: 'Compte commun'
  };
  const SOURCES = { correction: 'classée à la main', regle: 'par une de vos règles', base: 'par une règle de base', defaut: 'non classée',
    reglement: 'règlement détaillé ailleurs, compté une seule fois' };
  const pluriel = (n, s, p) => n + ' ' + (n > 1 ? (p || s + 's') : s);
  const jjmm = iso => iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) : '';
  const hhmm = iso => { if (!iso) return ''; const d = new Date(iso); return isNaN(d) ? '' : String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };

  function solde(c, cur) {
    return '<span class="m' + (c < 0 ? ' debiteur' : '') + '">' + esc(F().solde(c, cur)) + '</span>';
  }

  // Libellé lisible d'une opération (règles génériques de l'ancienne version) : préfixes bancaires, date de paiement
  // carte, références longues et répétitions retirés.
  function libelleCourt(l) {
    let t = String(l || '');
    if (/^ECH PRET/i.test(t)) return 'Échéance prêt';
    if (/^F COTIS/i.test(t)) return 'Cotisation du compte';
    const card = /^(PAIEMENT (CB|PSC|MOB)|CARTE)\s/i.test(t);
    t = t.replace(/^(PAIEMENT (CB|PSC|MOB)|CARTE|PRLV( SEPA)?|VIR( SEPA| INST)?( DE)?|VIREMENT( DE)?)\s+/i, '');
    if (card) t = t.replace(/^\d{2}\/\d{2}\s+/, '').replace(/^\d{4}\s+/, '').replace(/^\d+,\d{2} EUR\s+/, '');
    t = t.replace(/\bCARTE \d{4}\b/g, '').replace(/\bVIR DE\b/g, '').replace(/\s*\/[A-Z]+\b/g, '').replace(/\b(?=[A-Z0-9-]*\d)[A-Z0-9-]{9,}\b/g, '').replace(/\s{2,}/g, ' ').trim();
    const w = t.split(' '), h = w.length / 2;
    if (w.length >= 2 && w.length % 2 === 0 && w.slice(0, h).join(' ').toUpperCase() === w.slice(h).join(' ').toUpperCase()) t = w.slice(0, h).join(' ');
    const m = t.match(/^(.+?)\s+(M |MLE |MME )?\1$/i);
    if (m) t = m[1];
    return t || String(l || '');
  }

  // ------------------------------------------------------------ « À vérifier »
  // ext : { attention: { unseen, unclassified, accountsToCheck, toMatch }, sauvegarde: { jours | null } | null, maj, observations }.
  // → [{ cle, texte, niveau }] ; chaque ligne mène à l'écran concerné (cle).
  function lignesAVerifier(S, now, ext) {
    const e = ext || {};
    const a = e.attention || {};
    const L = [];
    if (a.unseen) L.push({ cle: 'nonvues', texte: pluriel(a.unseen, 'opération') + ' à voir', niveau: 'info' });
    if (a.unclassified) L.push({ cle: 'nonclassees', texte: pluriel(a.unclassified, 'opération non classée', 'opérations non classées') + ' (3 derniers mois)', niveau: 'info' });
    if (a.toMatch) L.push({ cle: 'rapprocher', texte: pluriel(a.toMatch, 'prélèvement') + ' de portefeuille à rapprocher', niveau: 'info' });
    if (e.observations) L.push({ cle: 'observations', texte: pluriel(e.observations, 'observation') + ' à faire', niveau: 'caut' });
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

  // Comptes d'un périmètre (perso : tous les comptes visibles ; commun : comptes communs).
  function comptesDe(S, scope) {
    const L = M().comptesTries(S).filter(c => !c.masque);
    return scope === 'commun' ? L.filter(c => c.role === 'commun') : L;
  }
  const opsDuScope = (S, scope, c) => scope === 'commun' ? c.role === 'commun' : c.role !== 'commun' && c.role !== 'epargne';

  // ------------------------------------------------------------ grande carte (total) et cartes des comptes
  // Perso : comptes courants et compte commun (comme l'ancienne version) ; commun : solde du compte commun.
  function hero(S, scope, now) {
    const L = comptesDe(S, scope).filter(c => scope === 'commun' ? c.role === 'commun' : (c.role === 'courant' || c.role === 'commun'));
    let v = 0, n = 0, lu = '';
    const noms = [];
    for (const c of L) {
      const s = M().soldeAffiche(S, c);
      if (!s) continue;
      v += s.centimes; n++; noms.push(c.libelle);
      const t = c.source.type === 'eb' && c.sync && c.sync.lu;
      if (t && t > lu) lu = t;
    }
    if (!n) {
      const vide = !S.modele.comptes.length;
      return '<span class="hl">' + (scope === 'commun' ? 'Solde du compte commun' : 'Total des comptes courants') + '</span><span class="hv">—</span><span class="hs">' +
        (vide ? 'Connectez une banque (Plus › Banques et accès) ou importez la reprise de l\'ancienne version (Plus › Import de reprise).' : 'Solde pas encore connu : il arrive avec la prochaine synchronisation.') + '</span>';
    }
    const et = noms.length > 1 ? noms.slice(0, -1).join(', ') + ' et ' + noms[noms.length - 1] : noms[0];
    return '<span class="hl">' + (scope === 'commun' ? 'Solde du compte commun' : 'Total des comptes courants') + '</span><span class="hv">' +
      esc(F().montant(Math.abs(v))) + (v < 0 ? '<small class="hd"> débiteur</small>' : '') + '</span><span class="hs">' + esc(et) + (lu ? ' · relevé de ' + hhmm(lu) : '') + '</span>';
  }

  // Une carte de compte (bal-t). ext : { dette, livret } calculés par l'appelant.
  function tuile(S, c, now, ext) {
    const x = ext || {};
    const titre = c.libelle;
    const eb = c.source.type === 'eb';
    const lu = eb && c.sync && c.sync.lu;
    const ancien = eb && (!lu || now - Date.parse(lu) > 30 * 3600e3);
    const ico = U().bico(S, c);
    if (c.role === 'carte_differee') {
      const d = x.dette;
      const v = d ? esc(F().montant(d.centimes)) : '—';
      const s = d ? 'à régler' + (d.depuis ? ' · depuis le ' + jjmm(d.depuis) : '') : 'libellé du prélèvement à choisir';
      return '<button type="button" class="kpi bal-t" data-compte="' + esc(c.id) + '"><span class="eyebrow">' + ico + esc(titre) + '</span><span class="v">' + v + '</span><span class="s">' + esc(s) +
        (ancien ? ' <span class="chip warn">ancien</span>' : '') + '</span></button>';
    }
    const s0 = M().soldeAffiche(S, c);
    // livret : solde estimé (saisi + virements depuis) et intérêts de l'année
    const s = x.livret ? { centimes: x.livret.centimes, dateRef: (s0 && s0.dateRef) || null, estime: true } : s0;
    const sav = c.role === 'epargne';
    if (!s) {
      return '<button type="button" class="kpi bal-t' + (sav ? ' sav' : '') + '" data-compte="' + esc(c.id) + '"><span class="eyebrow">' + ico + esc(titre) + '</span><span class="v">—</span><span class="s">' +
        (c.source.type === 'manuel' ? 'solde à saisir' : 'solde pas encore lu') + '</span></button>';
    }
    const v = s.centimes;
    const col = v < 0 ? 'var(--bad)' : v > 0 ? 'var(--good)' : 'var(--ink)';
    let sub = c.source.type === 'manuel' ? 'saisi le ' + jjmm(s.dateRef || s.lu) : 'au ' + jjmm(s.dateRef || (lu || '').slice(0, 10));
    if (v < 0) sub = 'débiteur · ' + sub;
    if (x.livret) sub = 'estimé · intérêts ' + x.livret.texte;
    return '<button type="button" class="kpi bal-t' + (sav ? ' sav' : '') + (c.role === 'commun' && v < 0 ? ' neg' : '') + '" data-compte="' + esc(c.id) + '"><span class="eyebrow">' + ico + esc(titre) +
      '</span><span class="v" style="color:' + col + '">' + esc(F().montant(Math.abs(v))) + '</span><span class="s">' + esc(sub) + (ancien ? ' <span class="chip warn">ancien</span>' : '') + '</span></button>';
  }

  // Rangée des cartes de comptes. opt : { dettes: { id: dette }, livrets: { id: texte }, fdm (fin de mois du commun) }.
  // Perso : tous les comptes, puis « <compte> − <carte> » après chaque carte à débit différé rattachée.
  function rangee(S, scope, now, opt) {
    const o = opt || {};
    const L = comptesDe(S, scope);
    let h = '';
    for (const c of L) {
      h += tuile(S, c, now, { dette: (o.dettes || {})[c.id], livret: (o.livrets || {})[c.id] });
      if (scope === 'perso' && c.role === 'carte_differee' && c.prelevement && c.prelevement.compte) {
        const p = M().compte(S, c.prelevement.compte), d = (o.dettes || {})[c.id];
        const sp = p && M().soldeAffiche(S, p);
        if (sp && d) {
          const dispo = sp.centimes - d.centimes;
          h += '<div class="kpi bal-sum"><span class="eyebrow">' + U().bico(S, p) + esc(p.libelle + ' − ' + c.libelle) + '</span><span class="v" style="color:' + (dispo < 0 ? 'var(--bad)' : 'var(--good)') + '">' +
            esc(F().montant(Math.abs(dispo))) + '</span><span class="s">' + (dispo < 0 ? 'débiteur · ' : '') + 'après ' + esc(c.libelle) + ' estimée</span></div>';
        }
      }
    }
    if (scope === 'commun' && o.fdm) {
      const f = o.fdm;
      if (f.reserve > 50) h += '<div class="kpi bal-sum"><span class="eyebrow">Réserve pour échéances</span><span class="v">' + esc(F().montant(f.reserve)) + '</span><span class="s">mise de côté : ' + esc((f.reserveDet || []).join(', ')) + '</span></div>';
      h += '<div class="kpi bal-sum"><span class="eyebrow">Fin de mois estimée</span><span class="v" style="color:' + (f.end < 0 || f.decouvert ? 'var(--bad)' : 'var(--good)') + '">' +
        esc(F().montant(Math.abs(f.end))) + (f.end < 0 ? ' débiteur' : '') + '</span><span class="s">solde ' + esc(F().solde(f.solde)) + ' − prélèvements à venir ' + esc(F().montant(f.due)) +
        (f.inc ? ' + virements attendus ' + esc(F().montant(f.inc)) : '') + (f.reserve > 50 ? ' − réserve pour échéances ' + esc(F().montant(f.reserve)) : '') +
        (f.decouvert ? ' · <b class="bad-t">découvert si les prélèvements passent avant les virements</b>' : '') +
        (f.aVenir && f.aVenir.length ? '<br>à venir : ' + esc(f.aVenir.join(', ')) : '') + '</span></div>';
    }
    if (!L.length) return '<div class="panel-h" style="margin-bottom:6px"><h2>Soldes des comptes</h2><span class="chip info">en attente</span></div>';
    return '<div class="bal-row' + (scope === 'perso' ? ' perso' : '') + '">' + h + '</div>';
  }

  // « N opérations à voir » : les plus récentes non vues du périmètre (noms des quatre premières).
  function aVoir(S, scope, ctx) {
    const U2 = [];
    for (const c of comptesDe(S, scope)) {
      if (!opsDuScope(S, scope, c)) continue;
      for (const o of S.ops[c.id] || []) if (!K().vue(S, o)) U2.push(o);
    }
    if (!U2.length) return '';
    U2.sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : 0);
    const nm = [];
    for (const o of U2) { const l = libelleCourt(o.libelle); if (nm.indexOf(l) < 0) nm.push(l); if (nm.length >= 4) break; }
    return '<span class="dot" aria-hidden="true"></span><span class="tx"><b>' + pluriel(U2.length, 'opération') + ' à voir</b><span class="nm">' + esc(nm.join(', ')) + '</span></span><span class="chev" aria-hidden="true">›</span>';
  }

  // Autres points « À vérifier » (même apparence que « à voir ») ; les opérations à voir et les observations ont déjà leur place.
  function aVerifier(S, now, ext) {
    const L = lignesAVerifier(S, now, ext).filter(l => l.cle !== 'nonvues' && l.cle !== 'observations');
    return L.map(l => '<button type="button" class="app-seen av ' + l.niveau + '" data-av="' + esc(l.cle) + '"><span class="dot" aria-hidden="true"></span><span class="tx"><b>' +
      esc(l.texte) + '</b></span><span class="chev" aria-hidden="true">›</span></button>').join('');
  }

  // ------------------------------------------------------------ opérations
  // f : { scope, compte, q, cat ('' | '__nc' | '__rap' | nom), nonVues, depuis (AAAA-MM-JJ) }.
  // « Non classées » : celles des 3 derniers mois (comme « À vérifier »). Tri : date décroissante.
  function filtrer(S, f, ctx) {
    const ids = f.compte ? [f.compte] : comptesDe(S, f.scope || 'perso').filter(c => f.scope ? opsDuScope(S, f.scope, c) : true).map(c => c.id);
    const k = f.q ? M().cleLibelle(f.q) : '';
    const limNc = f.cat === '__nc' && ctx ? M().plusJours(M().jourLocal(ctx.now), -K().NC_JOURS) : '';
    const rap = f.cat === '__rap' && ctx;
    const out = [];
    for (const id of ids) {
      for (const o of S.ops[id] || []) {
        if (f.depuis && o.date < f.depuis) continue;
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

  const COMPTEE = t => t !== 'interne' && t !== 'horsbudget' && t !== 'epargne';
  // Une ligne de la liste (tr.txr) : icône, libellé lisible, catégorie, compte, montant.
  function ligne(S, o, opt) {
    const c = M().compte(S, o.compte);
    const cur = (c && c.devise) || 'EUR';
    const ctx = opt && opt.ctx;
    const r = ctx ? K().classer(ctx, o) : { cat: 'Autres', sub: '', type: o.montant < 0 ? 'depense' : 'revenu' };
    const vue = K().vue(S, o);
    const C = ctx ? ctx.C : null;
    const nc = !COMPTEE(r.type) ? '<span class="tx-tag" title="' + (r.type === 'epargne' ? 'versement d\'épargne' : r.type === 'horsbudget' ? 'hors budget' : 'virement entre vos comptes ou règlement déjà détaillé') + ' : pas compté dans les dépenses">non comptée</span>' : '';
    const cat = esc(r.cat) + (r.sub && r.sub !== r.cat && r.sub !== 'Non classé' ? ' · ' + esc(r.sub) : '');
    const cls = 'txr' + (vue ? '' : ' unseen') + (o.statut === 'en_cours' ? ' encours' : '');
    return '<tr class="' + cls + '" data-op="' + esc(o.id) + '" data-c="' + esc(o.compte) + '"><td class="ic">' + U().icoOp(C, { cat: r.cat, sub: r.sub, label: o.libelle }) + '</td>' +
      '<td class="lab"><div class="tl">' + (vue ? '' : '<span class="sr">Non vue. </span>') + esc(libelleCourt(o.libelle)) + '</div><div class="tm">' +
      (opt && opt.date ? '<span class="num">' + jjmm(o.date) + '</span> · ' : '') +
      '<span class="acct">' + esc(c ? c.libelle : '') + '</span> <button class="tx-cat" type="button" data-classer="1" title="Changer la catégorie">' + cat + ' ▾</button>' +
      (r.src === 'regle' ? '<span class="tx-tag" title="Classée par une de vos règles">règle</span>' : '') + nc +
      (o.statut === 'en_cours' ? '<span class="tx-tag">en cours</span>' : '') + '</div></td>' +
      '<td class="amt' + (o.montant > 0 ? ' pos' : '') + (!COMPTEE(r.type) ? ' nc' : '') + '"><span class="amt-v">' + esc((o.montant > 0 ? '+' : '') + F().montant(Math.abs(o.montant), cur)) + '</span></td></tr>';
  }

  // Tranche de la liste : à partir de l'indice debut, au moins nbJours jours complets ; un en-tête par jour (total du jour
  // compté sur les opérations prises en compte). opt.dernierJour : jour de la dernière ligne déjà posée (pas de nouvel en-tête).
  // → { html, fin }.
  const JOURS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
  function tranche(S, ops, debut, nbJours, opt) {
    let i = debut, jours = 0, h = '';
    const annee = opt && opt.annee;
    const ctx = opt && opt.ctx;
    while (i < ops.length && jours < nbJours) {
      const d = ops[i].date;
      let j = i, tot = 0;
      while (j < ops.length && ops[j].date === d) {
        const r = ctx ? K().classer(ctx, ops[j]) : null;
        if (!r || COMPTEE(r.type)) tot += ops[j].montant;
        j++;
      }
      const dt = new Date(d + 'T12:00:00Z');
      h += '<tr class="tx-day"><td colspan="3"><div class="td-in"><span>' + JOURS[dt.getUTCDay()] + ' ' + jjmm(d) + (annee && +d.slice(0, 4) !== annee ? '/' + d.slice(2, 4) : '') +
        '</span><span class="td-t num">' + (Math.abs(tot) < 1 ? '' : esc((tot > 0 ? '+' : '') + F().montant(Math.abs(tot)))) + '</span></div></td></tr>' +
        ops.slice(i, j).map(o => ligne(S, o, { ctx })).join('');
      i = j; jours++;
    }
    return { html: h, fin: i };
  }

  // Puces des filtres (Toutes, Non vues, Non classées, Catégorie, Compte, Tout marquer vu).
  function filtres(S, f, ctx, nb) {
    const cats = K().listeCategories(ctx.C);
    const toutes = !f.nonVues && !f.cat;
    const comptes = comptesDe(S, f.scope || 'perso').filter(c => opsDuScope(S, f.scope || 'perso', c));
    return '<button type="button" data-f="toutes" aria-pressed="' + toutes + '">Toutes</button>' +
      '<button type="button" data-f="nonVues" class="ch-u" aria-pressed="' + !!f.nonVues + '">Non vues <b>' + nb.unseen + '</b></button>' +
      '<button type="button" data-f="nc" aria-pressed="' + (f.cat === '__nc') + '">Non classées <b>' + nb.nc + '</b></button>' +
      (f.cat === '__rap' ? '<button type="button" data-f="rap" aria-pressed="true">À rapprocher</button>' : '') +
      '<select id="opsCat" aria-label="Filtrer par catégorie" class="' + (f.cat && f.cat[0] !== '_' ? 'on' : '') + '"><option value="">Catégorie</option>' +
      cats.map(c => '<option value="' + esc(c) + '"' + (c === f.cat ? ' selected' : '') + '>' + esc(c) + '</option>').join('') + '</select>' +
      (comptes.length > 1 || f.compte ? '<select id="opsCompte" aria-label="Filtrer par compte" class="' + (f.compte ? 'on' : '') + '"><option value="">Compte</option>' +
        comptes.map(c => '<option value="' + esc(c.id) + '"' + (c.id === f.compte ? ' selected' : '') + '>' + esc(c.libelle) + '</option>').join('') + '</select>' : '') +
      (nb.visiblesNonVues ? '<button type="button" class="ch-link" data-f="toutVu">Tout marquer vu</button>' : '');
  }

  // ------------------------------------------------------------ détail d'une opération (volet)
  function detail(S, o, ctx) {
    const c = M().compte(S, o.compte);
    const cur = (c && c.devise) || 'EUR';
    const r = K().classer(ctx, o);
    const vu = K().vue(S, o);
    const dd = K().dateDepense(o);
    const w = K().aRapprocher(ctx, o);
    const lignes = [
      ['Libellé', o.libelle],
      ['Date', F().jour(o.date) + (o.statut === 'en_cours' ? ' (en cours)' : '')],
      dd && dd !== o.date ? ['Payée le', F().jour(dd)] : null,
      o.dateValeur ? ['Date de valeur', F().date(o.dateValeur)] : null,
      ['Compte', c ? c.libelle : '—'],
      [o.montant < 0 ? 'Débit' : 'Crédit', F().montant(o.montant, cur)],
      o.contrepartie ? ['Contrepartie', o.contrepartie] : null,
      ['Catégorie', r.cat + (r.sub && r.sub !== r.cat ? ' › ' + r.sub : '') + ' (' + (SOURCES[r.src] || '') + ')'],
      ['Vue', vu ? 'oui' : 'non']
    ].filter(Boolean);
    return '<div class="sh-head op-h">' + U().icoOp(ctx.C, { cat: r.cat, sub: r.sub, label: o.libelle }) + '<div class="t"><b>' + esc(libelleCourt(o.libelle)) + '</b><span>' +
      esc(jjmm(o.date) + ' · ' + (c ? c.libelle : '') + ' · ') + '<span class="num">' + esc((o.montant > 0 ? '+' : '') + F().montant(Math.abs(o.montant), cur)) + '</span></span></div></div>' +
      '<dl class="op-det">' + lignes.map(x => '<dt>' + esc(x[0]) + '</dt><dd>' + esc(x[1]) + '</dd>').join('') + '</dl>' +
      (w ? '<p class="note">Prélèvement de ' + esc(w.libelle) + ' sans opération de même montant dans son détail : il est compté comme une dépense. ' +
        'S\'il est déjà détaillé dans ' + esc(w.libelle) + ', marquez-le interne.</p>' : '') +
      '<div class="row"><button type="button" class="btn primary" data-a="classer">Classer</button>' +
      '<button type="button" class="btn" data-a="vue">' + (vu ? 'Marquer non vue' : 'Marquer vue') + '</button>' +
      (w ? '<button type="button" class="btn" data-a="interne">Marquer interne</button>' : '') + '</div>' +
      '<p class="muted small">Sur la liste : glisser une opération vers la droite la marque vue (ou non vue), vers la gauche ouvre « Classer ».</p>';
  }

  // ------------------------------------------------------------ volet « Classer » (comme l'ancienne version)
  // st : { cat, sub, autres (bool), mot, compte (bool), sens ('' | 'debit' | 'credit'), toutes (bool) } ; n : opérations concernées.
  // opt : { equilibre: bool } (bouton « Ajouter à l'équilibre »).
  function classer(S, o, ctx, st, n, opt) {
    const c = M().compte(S, o.compte);
    const cur = (c && c.devise) || 'EUR';
    const top = K().frequentes(ctx, st.cat, 7);
    const liste = st.toutes ? [st.cat].concat(K().listeCategories(ctx.C).filter(x => x !== st.cat)) : (top.indexOf(st.cat) >= 0 ? top : [st.cat].concat(top.slice(0, 6)));
    const btn = x => '<button type="button" class="cat-t" role="radio" aria-checked="' + (x === st.cat) + '" data-cat="' + esc(x) + '">' + U().cico(ctx.C, x) + '<span>' + esc(x) + '</span></button>';
    const comptes = st.autres ? (st.mot.trim() ? pluriel(n, 'opération') + ' ' + (n > 1 ? 'contiennent' : 'contient') + ' « ' + st.mot.trim() + ' »' : 'Saisissez un mot du libellé') : 'Seule cette opération sera classée';
    return '<div class="sh-head op-h">' + U().icoOp(ctx.C, { cat: st.cat, sub: st.sub, label: o.libelle }) + '<div class="t"><b>' + esc(libelleCourt(o.libelle)) + '</b><span>' +
      esc(jjmm(o.date) + (c ? ' · ' + c.libelle : '') + ' · ') + '<span class="num">' + esc((o.montant > 0 ? '+' : '') + F().montant(Math.abs(o.montant), cur)) + '</span></span></div></div>' +
      '<div class="sh-lab" id="clsL">Catégorie</div><div class="cat-grid" role="radiogroup" aria-labelledby="clsL">' + liste.map(btn).join('') +
      (st.toutes ? '' : '<button type="button" class="cat-t more" data-toutes="1"><span class="cico" style="--cc:#8b95a1;color:#8b95a1" aria-hidden="true">⋯</span><span>Toutes</span></button>') + '</div>' +
      '<label class="sh-l"><span class="sh-lab">Sous-catégorie</span><input type="text" class="sh-in" id="clsSub" autocomplete="off" value="' + esc(st.sub) + '"></label>' +
      '<div class="sh-rule"><div class="rl"><div><b>Classer aussi les autres</b><span>Toutes les opérations dont le libellé contient :</span></div>' +
      '<button type="button" class="tgl" role="switch" id="clsAutres" aria-checked="' + !!st.autres + '" aria-label="Créer une règle"></button></div>' +
      '<input type="text" id="clsMot" aria-label="Mot du libellé" autocomplete="off" spellcheck="false" value="' + esc(st.mot) + '"' + (st.autres ? '' : ' disabled style="opacity:.5"') + '>' +
      '<span class="cnt" id="clsN">' + esc(comptes) + '</span>' +
      (st.autres ? '<div class="rl2"><label class="inline"><input type="checkbox" id="clsCompte"' + (st.compte ? ' checked' : '') + '> seulement ' + esc(c ? c.libelle : 'ce compte') + '</label>' +
        '<select id="clsSens" aria-label="Sens"><option value="">débits et crédits</option><option value="debit"' + (st.sens === 'debit' ? ' selected' : '') + '>débits seulement</option>' +
        '<option value="credit"' + (st.sens === 'credit' ? ' selected' : '') + '>crédits seulement</option></select></div>' : '') + '</div>' +
      '<button type="button" class="sh-go" data-a="go">Classer en ' + esc(st.cat) + (st.autres && n > 1 ? ' (' + n + ')' : '') + '</button>' +
      (opt && opt.equilibre ? '<button type="button" class="sh-alt" data-a="equilibre">🏠 Ajouter à l\'équilibre</button>' : '');
  }


  // ------------------------------------------------------------ écran « Relevés » : état de chaque compte (comme l'ancienne version)
  // B : contexte du budget (règlements détaillés) ; opt : { synchro: bool (en cours) }.
  function releves(S, B, now, opt) {
    const dfr = d => d ? d.split('-').reverse().join('/') : '—';
    const jours = iso => Math.round((now - Date.parse(iso)) / 864e5);
    let late = 0;
    const rows = M().comptesTries(S).filter(c => !c.masque).map(c => {
      const ops = S.ops[c.id] || [];
      let min = '', max = '';
      const src = {};
      for (const o of ops) { if (!min || o.date < min) min = o.date; if (o.date > max) max = o.date; src[o.source || 'eb'] = (src[o.source || 'eb'] || 0) + 1; }
      const eb = c.source.type === 'eb';
      const lu = eb && c.sync && c.sync.lu;
      let st, todo;
      if (eb) {
        const a = M().alerteCompte(S, c, now);
        const n = lu ? jours(lu) : null;
        st = !a ? '<span class="chip good">à jour</span>' : c.sync && c.sync.erreur ? '<span class="chip bad">en erreur</span>' : n != null && n <= 7 ? '<span class="chip warn">' + n + ' j</span>' : '<span class="chip bad">' + (n == null ? 'jamais lu' : n + ' j de retard') + '</span>';
        todo = !a ? '<span class="muted">synchronisé automatiquement</span>' : '<span class="subs">' + esc(c.sync && c.sync.erreur ? c.sync.erreur : a) + '</span>';
        if (a) late++;
      } else {
        const ref = [max, c.solde && c.solde.date].filter(Boolean).sort().pop();
        const n = ref ? Math.round((Date.parse(M().jourLocal(now)) - Date.parse(ref)) / 864e5) : null;
        st = n == null ? '<span class="chip warn">jamais importé</span>' : n <= 31 ? '<span class="chip good">à jour</span>' : '<span class="chip warn">' + n + ' j</span>';
        todo = '<button class="linkbtn" type="button" data-releve="' + esc(c.id) + '">Importer un relevé</button>';
      }
      let det = '';
      if ((c.role === 'carte_differee' || c.role === 'paiement_en_ligne') && ops.length && B) {
        const lab = 'Règlement ' + c.libelle + ' (détaillé)';
        const bank = B.rows.filter(r => r.sub === lab).reduce((t, r) => t - r.m, 0), dt = ops.reduce((t, o) => t - o.montant, 0);
        det = '<div class="subs">détail ' + esc(F().montant(Math.abs(dt))) + ' · prélèvements bancaires écartés ' + esc(F().montant(Math.abs(bank))) + '</div>';
      }
      const part = [src.eb ? src.eb + ' banque' : '', src.reprise ? src.reprise + ' reprise' : '', src.fichier ? src.fichier + ' fichier' : ''].filter(Boolean).join(' · ');
      return '<tr><td><b>' + esc(c.libelle) + '</b>' + det + '</td><td class="num">' + dfr(min) + '</td><td class="num">' + dfr(max) + '</td><td class="r num">' + ops.length + (part ? '<div class="subs">' + esc(part) + '</div>' : '') + '</td>' +
        '<td class="num">' + (lu ? dfr(lu.slice(0, 10)) : eb ? '—' : 'manuel') + '</td><td>' + st + '</td><td>' + todo + '</td></tr>';
    }).join('');
    const head = opt && opt.synchro ? '<span class="chip info sync-busy"><span class="ic" aria-hidden="true">↻</span> synchronisation en cours</span>' : late ? '<span class="chip warn">' + late + ' compte(s) en retard</span>' : '<span class="chip good">tout est à jour</span>';
    const manuels = M().comptesTries(S).filter(c => c.source.type === 'manuel');
    return '<div class="panel-h"><h2 class="fold" role="button" tabindex="0" title="Replier / déplier">Relevés des comptes</h2><div class="row"><span class="muted" id="imp-head">' + head + '</span><button class="btn" type="button" data-sync="1"' + (opt && opt.synchro ? ' disabled' : '') + '>' + (opt && opt.synchro ? 'Lecture…' : 'Synchroniser') + '</button></div></div>' +
      '<div class="tablewrap"><table class="cats"><thead><tr><th>Compte</th><th>Du</th><th>Au</th><th class="r">Opérations</th><th>Dernière synchro</th><th>État</th><th>À faire</th></tr></thead><tbody id="imp-table">' + (rows || '<tr><td colspan="7" class="muted">Aucun compte : connectez une banque (Plus › Banques et accès) ou importez la reprise.</td></tr>') + '</tbody></table></div>' +
      (manuels.length ? '<div class="imp-add"><label class="ctl" for="imp-acc">Ajouter un relevé à la main <select id="imp-acc">' + manuels.map(c => '<option value="' + esc(c.id) + '">' + esc(c.libelle) + '</option>').join('') + '</select></label>' +
        '<button class="btn" type="button" data-releve="__choix">Choisir le fichier (CSV, Excel ou JSON)</button></div>' +
        '<div class="row"><button class="btn" type="button" data-retirerimports="1">Retirer les imports manuels</button></div>' : '') +
      '<p class="note" id="imp-status"></p>' +
      '<details class="bnote"><summary>Comment c\'est calculé</summary><p class="note">Les comptes bancaires sont lus automatiquement par Enable Banking (à l\'ouverture de Klad si la dernière lecture a plus de 2 heures, avec la pastille de l\'en-tête ou en tirant l\'écran vers le bas). Un compte manuel (livret, carte non connectée…) se met à jour par l\'import d\'un relevé CSV, Excel (.xlsx) ou JSON : les opérations déjà présentes sont ignorées, l\'import est annulable.</p></details>';
  }

  g.KladVues = { releves, ROLES, esc, solde, libelleCourt, lignesAVerifier, comptesDe, hero, tuile, rangee, aVoir, aVerifier, filtrer, ligne, tranche, filtres, detail, classer, COMPTEE };
})(typeof window !== 'undefined' ? window : globalThis);
