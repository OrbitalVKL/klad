// Klad — observations et recommandations, résultats d'une période (clôture), répartition des dépenses (Lot 8).
// Mêmes règles que l'ancienne version, rendues génériques : les comptes, motifs et contrats concernés sont des données
// (réglages « observations » du complément, contrats, virements). Fonctions pures, testées dans node.
(function (g) {
  'use strict';

  const M = () => g.KladModele;
  const K = () => g.KladClasse;
  const KB = () => g.KladBudget;
  const KC = () => g.KladCommun;
  const KF = () => g.KladFisc;
  const isObj = o => o != null && typeof o === 'object' && !Array.isArray(o);
  const DEMI = 50;
  const e0 = c => KB().eur(c);
  const e2 = c => g.KladFormat ? g.KladFormat.montant(c) : KB().eur(c, true);
  const dfr = d => d.split('-').reverse().join('/');
  const jjmm = d => d.slice(8, 10) + '/' + d.slice(5, 7);
  const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const mLong = m => MOIS[+m.slice(5, 7) - 1] + ' ' + m.slice(0, 4);
  const jours = (B, d) => Math.round((Date.parse(B.auj) - Date.parse(d)) / 864e5);
  const rxSur = (m, f) => { try { return m ? new RegExp(m, f == null ? 'i' : f) : null; } catch (e) { return null; } };

  function reglages(B) {
    const st = B.S.carnet ? KB().racine(B.S.carnet) : null;
    const X = st && isObj(st.klad) && isObj(st.klad.observations) ? st.klad.observations : {};
    const map = (B.S.modele.reprise && B.S.modele.reprise.map) || {};
    const cpt = r => r ? M().compte(B.S, map[r] || r) : null;
    return { secondaire: cpt(X.secondaire), principal: cpt(X.principal), pret: rxSur(X.motifPret || 'ECH PRET'), salaireMin: Math.round((+X.salaireMin || 1000) * 100) };
  }

  // ------------------------------------------------------------ charges récurrentes sur un compte secondaire
  function recurrentsSecondaire(B, c) {
    const from4 = M().plusJours(B.auj, -122), recent = M().plusJours(B.auj, -45), parK = {}, out = [];
    for (const r of B.rows) {
      if (r.cid !== c.id || r.type !== 'depense' || r.date < from4 || /^VIR\b/i.test(r.label)) continue;
      const k = String(-r.m);
      const x = parK[k] || (parK[k] = { ms: new Set(), rows: [], fixe: false });
      x.ms.add(r.od.slice(0, 7)); x.rows.push(r);
      if (KB().natureDe(B, r.cat) === 'fixe') x.fixe = true;
    }
    for (const x of Object.values(parK)) { const last = x.rows[x.rows.length - 1].date; if (last >= recent && (x.ms.size >= 2 || x.fixe)) out.push(x); }
    return out;
  }

  // ------------------------------------------------------------ observations
  // → [{ niveau: bad | warn | info | good, scope: perso | commun | all, titre, texte, depuis? }]
  function audit(B) {
    if (B.memo.audit) return B.memo.audit;
    const A = [], add = (niveau, scope, titre, texte, depuis) => A.push({ niveau, scope, titre, texte, depuis: depuis || null });
    const RO = reglages(B), RC = KC() ? KC().reglages(B) : { moi: 'Moi', autre: 'L\'autre personne' };
    const nom = q => q === 'moi' ? RC.moi : RC.autre;
    if (RO.secondaire) {
      const R = recurrentsSecondaire(B, RO.secondaire);
      if (R.length) add('warn', 'perso', 'Charges récurrentes sur le ' + RO.secondaire.libelle,
        R.map(x => { const r = x.rows[x.rows.length - 1]; return r.label.replace(/^PAIEMENT (CB|PSC|MOB) \d{4} /, '').slice(0, 28) + ' (' + e2(-r.m) + ', ' + x.ms.size + ' mois)'; }).join(' · ') + ' : à basculer sur ' + (RO.principal ? RO.principal.libelle : 'le compte courant principal') + '.',
        R.map(x => x.rows[x.rows.length - 1].date).sort().pop());
    }
    const late = B.comptes.filter(c => c.source && c.source.type === 'eb').filter(c => { const ref = [B.cover[c.id] ? B.cover[c.id].max : '', c.sync && c.sync.lu ? M().jourLocal(Date.parse(c.sync.lu)) : ''].sort().pop(); return !ref || jours(B, ref) > 3; });
    if (late.length) add('warn', 'all', 'Relevés en retard', late.map(c => c.libelle).join(', ') + ' : pas de synchronisation récente. Tirez l\'accueil vers le bas ; si rien ne change, l\'accès bancaire est peut-être à renouveler (Plus › Banques et accès).');
    // compte commun : virements du mois et échéance du prêt
    const ops = B.rows.filter(r => r.role === 'commun');
    const V = B.D.virements || [];
    const prets = RO.pret ? ops.filter(r => r.m < 0 && RO.pret.test(r.label)) : [];
    if (prets.length && KC()) {
      const L = prets[prets.length - 1], m = L.date.slice(0, 7), lday = +L.date.slice(8, 10), cm = B.auj.slice(0, 7);
      const vus = V.map(v => KC().virementVu(B, v, cm)), tous = V.length && vus.every(Boolean);
      if (tous && m < cm) {
        const last = vus.map(r => r.date).sort().pop();
        add(+last.slice(8, 10) < lday ? 'good' : 'warn', 'commun', 'Compte commun : virements de ' + MOIS[+cm.slice(5) - 1], 'Tous reçus (dernier le ' + jjmm(last) + ')' + (+last.slice(8, 10) < lday ? ', avant l\'échéance du prêt attendue vers le ' + lday + '.' : ' : après le ' + lday + ', jour habituel de l\'échéance du prêt — risque de découvert.'));
      } else {
        const apports = ops.filter(r => r.m > 0 && r.date.slice(0, 7) === m && r.cat === KB().APPORTS), apres = apports.filter(r => r.date > L.date);
        const j1 = [...new Set(V.map(v => +v.jour || 1))], prevus = j1.length && j1.every(d => d < lday);
        if (!apports.length) add('warn', 'commun', 'Compte commun : virements du mois', 'Aucun apport reçu en ' + mLong(m) + ' alors que l\'échéance du prêt est passée le ' + dfr(L.date) + '.');
        else if (apres.length) add(m < cm && prevus ? 'warn' : 'bad', 'commun', 'Compte commun : virements après l\'échéance', 'En ' + mLong(m) + ', ' + apres.length + ' virement(s) sont arrivés après l\'échéance du prêt du ' + dfr(L.date) + ' (dès le ' + dfr(apres[0].date) + ').' + (prevus ? ' Les ordres sont désormais programmés le ' + j1.join(' et ') + ' : à vérifier sur ' + MOIS[+cm.slice(5) - 1] + '.' : ' Avancez les ordres permanents avant le ' + lday + '.'));
        else add('good', 'commun', 'Compte commun : virements à l\'heure', 'En ' + mLong(m) + ', vos virements sont arrivés avant l\'échéance du prêt du ' + dfr(L.date) + '.');
      }
    }
    // contrats résiliés (montant 0) encore prélevés ; prélèvements mensuels du commun absents
    for (const c of B.D.contrats || []) {
      const d = KB().dernierDebit(B, c);
      if (!c.montant && d) {
        if (jours(B, d.date) <= 40) add('bad', c.sc, c.label + ' encore prélevé', e2(-d.m) + ' prélevés le ' + dfr(d.date) + '. Résiliation demandée : si un prélèvement passe encore le mois prochain, relancez l\'organisme.');
        else add('good', c.sc, c.label + ' arrêté', 'Plus de prélèvement depuis le ' + dfr(d.date) + '.');
      } else if (c.sc === 'commun' && c.montant && (c.per || 1) === 1 && d && jours(B, d.date) > 45) add('warn', 'commun', c.label + ' : prélèvement absent', 'Dernier prélèvement le ' + dfr(d.date) + '. Vérifiez la mensualisation.');
    }
    // appels de fonds
    if (KC()) {
      try {
        const AS = KC().appels(B);
        for (const k of Object.keys(AS)) {
          const S = AS[k];
          if (S.reste < DEMI) { add('good', 'commun', 'Appels de fonds ' + S.lab + ' réglés', e2(S.totA) + ' appelés, ' + e2(S.totP) + ' virés' + (S.st ? ' ; relevé du syndic du ' + jjmm(S.st.at) : '') + '.'); continue; }
          const it = S.impayes.map(x => (x.k === 'avance' ? 'avance de trésorerie' : 'T' + (Math.floor((+x.d.slice(5, 7) - 1) / 3) + 1) + ' ' + x.d.slice(0, 4)) + ' (exigible le ' + jjmm(x.d) + ')').join(', ');
          add(S.retard.length ? 'bad' : 'warn', 'commun', 'Virement à faire' + (S.a ? ' vers ' + S.a : '') + ' : ' + e2(S.reste), 'Appel' + (S.impayes.length > 1 ? 's' : '') + ' non réglé' + (S.impayes.length > 1 ? 's' : '') + ' : ' + it + '.' + (S.iban ? ' IBAN ' + S.iban + '.' : '') + (S.st ? ' Relevé du syndic du ' + jjmm(S.st.at) + ' : ' + e2(S.st.solde) + ' dus.' : ''));
        }
      } catch (e) { /* pas d'appels */ }
    }
    // portefeuilles : détail
    for (const w of B.comptes.filter(c => c.role === 'paiement_en_ligne')) {
      const mots = K().motifs(w.prelevement && w.prelevement.motif);
      if (!mots.length) continue;
      const prel = B.rows.filter(r => (r.role === 'courant' || r.role === 'commun') && r.m < 0 && mots.some(m => K().fold(r.label).indexOf(m) >= 0));
      const reste = prel.filter(r => r.type !== 'interne'), cv = B.cover[w.id];
      if (!cv) add('warn', 'perso', w.libelle + ' pas encore détaillé', reste.length + ' prélèvements ' + w.libelle + ' (' + e0(-reste.reduce((t, r) => t + r.m, 0)) + ') sans le nom du commerçant.');
      else {
        const recents = reste.filter(r => r.date >= cv.min);
        if (recents.length) add('warn', 'perso', w.libelle + ' détaillé en partie', recents.length + ' prélèvement(s) ' + w.libelle + ' depuis le ' + dfr(cv.min) + ' restent sans détail (« À vérifier » › à rapprocher).');
        else add('good', 'perso', w.libelle + ' détaillé', 'Détail du ' + dfr(cv.min) + ' au ' + dfr(cv.max) + (reste.length ? ' ; ' + reste.length + ' prélèvements plus anciens restent sans détail.' : '.'));
      }
    }
    const lim60 = M().plusJours(B.auj, -60), nc = B.rows.filter(r => r.date >= lim60 && K().classer(B.cx, r.o).nc && r.type === 'depense');
    if (nc.length) add('info', 'all', 'Opérations à classer', nc.length + ' opération(s) des 60 derniers jours ne sont pas classées : classez-en une dans la liste des opérations, une règle rangera les suivantes.');
    // contrats au-dessus du budget
    const ctrOver = {};
    for (const sc of ['perso', 'commun']) {
      for (const a of KB().postes(B, sc).lignes) {
        if (!a.on || a.per !== 1 || a.lie) continue;
        const cm = KB().contratsDe(B, a.key, sc).filter(c => (+c.per || 1) === 1).reduce((t, c) => t + c.montant, 0);
        if (cm > a.amt + DEMI) { ctrOver[sc + a.key] = 1; add('warn', sc, 'Aligner « ' + a.label + ' » sur le contrat', 'Contrat ' + e2(cm) + ' par mois pour ' + e0(a.amt) + ' au budget : ' + e2(cm - a.amt) + ' par mois non financés' + (sc === 'commun' ? ' (le virement demandé augmente d\'autant, réparti selon la part du poste)' : '') + '. « Aligner » sous le poste dans le Budget.'); }
      }
    }
    // compte commun : virement ponctuel, ordres, virements du mois
    if (KC()) {
      try {
        const D = KC().plan(B);
        if (D.pon > 0) add('warn', 'commun', 'Virement ponctuel de ' + e0(D.pon) + ' vers le commun', RC.moi + ' ' + e0(D.ponMoi) + ' · ' + RC.autre + ' ' + e0(D.ponAutre) + ', ' + ((D.C.negAt || D.C.minAt) <= M().plusJours(B.auj, 3) ? 'dès que possible' : 'avant le ' + dfr(D.C.negAt || D.C.minAt)) + ' : ' +
          (D.C.negAt && D.C.negAt < D.C.minAt ? 'premier découvert prévu le ' + dfr(D.C.negAt) + ' (' + e2(-D.C.negV) + '), puis jusqu\'à ' + e2(-D.C.min) + ' de découvert le ' + dfr(D.C.minAt) + '.' : 'le solde descendrait à ' + e2(-D.C.min) + ' de découvert.') + (D.pas > DEMI ? ' Creux passager (échéances payées d\'un coup, ' + e0(D.pas) + ') : les mises de côté des mois suivants le comblent.' : ''));
        for (const c of D.changes) add('warn', 'commun', 'Ordre permanent à modifier : ' + nom(c.qui), c.label + ' : ' + e0(c.have) + ' → ' + e0(c.want) + ' par mois (' + e0(c.want - c.have) + ' de plus) pour suivre le budget du compte commun.');
        const rc = D.recus.filter(x => x.vu), miss = D.recus.filter(x => !x.vu && x.retard), dif = rc.filter(x => Math.abs(x.vu.m - (+x.v.montant || 0)) > 1);
        if (dif.length) add('warn', 'commun', 'Montant reçu différent de l\'ordre prévu', dif.map(x => nom(x.v.qui) + ' · ' + x.v.label + ' : ' + e2(x.vu.m) + ' reçus le ' + jjmm(x.vu.date) + ' pour ' + e2(+x.v.montant) + ' prévus').join(' · ') + '. Modifiez l\'ordre permanent à la banque pour le mois prochain' + (dif.length > 1 ? ' (ou corrigez la liste)' : '') + '.');
        if (V.length) {
          if (miss.length) add('warn', 'commun', 'Virements du mois non reçus', miss.map(x => nom(x.v.qui) + ' · ' + x.v.label + ' (' + e0(+x.v.montant || 0) + ', prévu le ' + (+x.v.jour || 1) + ')').join(' · ') + '.');
          else if (rc.length === V.length) add('good', 'commun', 'Virements du mois reçus', rc.map(x => nom(x.v.qui) + ' ' + e0(x.vu.m) + ' le ' + jjmm(x.vu.date)).join(' · ') + '.');
          else add('info', 'commun', 'Virements du mois', rc.length + ' sur ' + V.length + ' reçus ; les autres sont attendus le ' + [...new Set(D.recus.filter(x => !x.vu).map(x => +x.v.jour || 1))].join(' et ') + '.');
        }
        if (!D.changes.length && !D.pon) add('good', 'commun', 'Ordres permanents conformes', RC.moi + ' ' + e0(KC().somme(B, 'moi')) + ' · ' + RC.autre + ' ' + e0(KC().somme(B, 'autre')) + ' par mois : ils couvrent le budget du compte commun.');
      } catch (e) { /* compte commun sans solde */ }
      // virement récurrent absent de la liste
      const last3 = [1, 2, 3].map(k => KB().shift(B.auj.slice(0, 7), -k)), grp = {};
      for (const r of ops) {
        if (r.m <= 0 || r.cat !== KB().APPORTS || last3.indexOf(r.date.slice(0, 7)) < 0) continue;
        const w = (RC.motifAutre && RC.motifAutre.test(r.label)) || (RC.nomsConnus && r.sub === RC.autre) ? 'autre' : 'moi';
        const k = w + '|' + r.m;
        (grp[k] = grp[k] || new Set()).add(r.date.slice(0, 7));
      }
      for (const [k, set] of Object.entries(grp)) {
        if (set.size < 2) continue;
        const [w, a] = k.split('|');
        if (!V.some(v => v.qui === w && Math.abs(v.montant - (+a)) <= 0.15 * v.montant)) add('info', 'commun', 'Virement récurrent absent de la liste', nom(w) + ' verse ' + e2(+a) + ' depuis ' + set.size + ' mois : ajoutez-le aux ordres permanents pour suivre son arrivée.');
      }
    }
    // budget du mois dépassé
    for (const sc of ['perso', 'commun']) {
      const over = KB().postes(B, sc).lignes.filter(a => a.on && a.amt > 0 && a.per === 1 && !ctrOver[sc + a.key] && a.cur > a.ech * 1.1 + 500).sort((x, z) => (z.cur - z.ech) - (x.cur - x.ech)).slice(0, 3);
      if (over.length) add('warn', sc, 'Budget du mois dépassé', over.map(a => a.label + ' : ' + e0(a.cur) + ' pour ' + e0(a.ech) + ' de budget').join(' · ') + '.');
    }
    // balance sur 3 mois
    const W = KB().fenetre(B), lf = W.end, m0 = KB().shift(lf, -2);
    let rv = 0, dp = 0;
    for (const r of B.rows) {
      if (['courant', 'carte_differee', 'paiement_en_ligne'].indexOf(r.role) < 0) continue;
      const m = r.date.slice(0, 7);
      if (m < m0 || m > lf) continue;
      if (r.type === 'revenu') rv += r.m; else if (r.type === 'depense') dp -= r.m;
    }
    if (rv - dp < 0) add('warn', 'perso', 'Balance négative sur 3 mois', 'De ' + mLong(m0) + ' à ' + mLong(lf) + ' : ' + e0(rv / 3) + ' de revenus pour ' + e0(dp / 3) + ' de dépenses par mois.');
    else add('good', 'perso', 'Balance positive sur 3 mois', e0((rv - dp) / 3) + ' de plus par mois de ' + mLong(m0) + ' à ' + mLong(lf) + '.');
    // impôts, taxe foncière, régularisations
    if (KF()) {
      try {
        const X = KF().contexte(B);
        for (const a of KF().alertes(X).filter(x => x.lvl === 'warn' && /^(Taux non personnalisé|Solde estimé)/.test(x.t)).slice(0, 2)) add('warn', 'perso', a.t, a.p + ' (Plus › Impôts)');
        for (const a of KF().alertesTF(X)) {
          if (/H2/.test(a.t)) add('warn', 'commun', a.t, a.p);
          else if (/^Taxe foncière \d{4} : /.test(a.t) && !/rien/.test(a.t)) { const y = +a.t.slice(14, 18); if ((Date.parse(y + '-10-15') - Date.parse(B.auj)) / 864e5 <= 120) add(a.lvl, 'commun', a.t, a.p); }
        }
        for (const r of KF().regularisations(X)) {
          if (r.kind === 'avis') { if (!r.done) add('warn', 'all', 'À régulariser : ' + X.noms[r.from] + ' verse ' + KB().eur(r.amt * 100) + ' à ' + X.noms[r.to], r.per + '. Partage : ' + KF().PART_RULES[X.FI.hyp.partage || 'seul'][0].toLowerCase() + ' (Plus › Impôts).'); }
          else add('info', 'all', 'Impôt ' + r.y + ' (estimation) : ' + (r.solde >= 0 ? 'solde ≈ ' + KB().eur(r.solde * 100) : 'remboursement ≈ ' + KB().eur(-r.solde * 100)), r.per + '. ' + r.txt);
        }
      } catch (e) { /* pas de données fiscales */ }
    }
    // salaire
    const sal = B.rows.filter(r => ['courant', 'carte_differee', 'paiement_en_ligne'].indexOf(r.role) >= 0 && r.type === 'revenu' && r.m > RO.salaireMin);
    if (sal.length) { const s = sal[sal.length - 1]; if (jours(B, s.date) > 38) add('warn', 'perso', 'Salaire', 'Aucun salaire reçu depuis le ' + dfr(s.date) + '.'); else add('info', 'perso', 'Dernier salaire', e2(s.m) + ' le ' + dfr(s.date) + ' (' + s.label.split(/\s+/).slice(0, 3).join(' ') + ').'); }
    return (B.memo.audit = A);
  }

  // Points « à faire » masqués par « c'est fait » : jusqu'à ce que la situation se reproduise (date de départ) ou 40 jours.
  function masque(B, a) {
    const DIS = (B.D && B.D.dismiss) || {};
    let d = DIS[a.titre];
    if (!d) return false;
    d = String(d).slice(0, 10);
    return a.depuis ? a.depuis <= d : KB().dDiff(d, B.auj) <= 40;
  }
  // → { faire: [], masques: [], infos: [] } triés (bad, warn, info, good ; le périmètre courant d'abord).
  function observations(B, scope) {
    const ordre = { bad: 0, warn: 1, info: 2, good: 3 };
    const all = audit(B).slice().sort((x, y) => (ordre[x.niveau] - ordre[y.niveau]) || ((x.scope === scope ? 0 : 1) - (y.scope === scope ? 0 : 1)));
    const actifs = all.filter(a => a.niveau === 'bad' || a.niveau === 'warn');
    return { faire: actifs.filter(a => !masque(B, a)), masques: actifs.filter(a => masque(B, a)), infos: all.filter(a => a.niveau === 'good' || a.niveau === 'info') };
  }
  function fait(S, titre, now) { const D = KB().donnees(S); D.dismiss = D.dismiss || {}; const avant = JSON.stringify(D.dismiss); D.dismiss[titre] = new Date(now == null ? Date.now() : now).toISOString(); return avant; }
  function reafficher(S, now) { const D = KB().donnees(S); const avant = JSON.stringify(D.dismiss || {}); D.dismiss = { _reset: new Date(now == null ? Date.now() : now).toISOString() }; return avant; }
  function annulerFait(S, avant) { KB().donnees(S).dismiss = JSON.parse(avant); }

  // ------------------------------------------------------------ résultats d'une période (clôture)
  // Période précédant le cycle en cours (perso : cycle de salaire précédent ; commun : mois précédent), ou la période
  // passée affichée.
  function periodePrecedente(B, scope, nav) {
    const per = KB().periode(B, scope, nav);
    if (per.past) return { start: per.start, end: per.end, titre: 'Bilan de la période affichée', cyc: !!per.cyc };
    if (scope === 'perso') {
      const st = KB().debuts(B);
      const c = st.length >= 2 ? KB().cyclePasse(B, st[st.length - 2].date) : null;
      if (c) return { start: c.start, end: c.end, titre: 'Cycle précédent', cyc: true };
    }
    const cur = scope === 'perso' && KB().cycleCourant(B) ? KB().cycleCourant(B).start.slice(0, 7) : B.auj.slice(0, 7);
    const m = KB().shift(cur, -1);
    return { start: m + '-01', end: KB().finMois(m), titre: 'Mois précédent', cyc: false };
  }
  function resultats(B, scope, P) {
    const dansP = d => d >= P.start && d <= P.end;
    const acc = r => scope === 'commun' ? r.role === 'commun' : ['courant', 'carte_differee', 'paiement_en_ligne'].indexOf(r.role) >= 0;
    const L = KB().postes(B, scope).lignes;
    const real = {};
    let rev = 0, sav = 0;
    for (const r of B.rows) {
      if (!acc(r) || !dansP(r.od)) continue;
      if (r.type === 'depense' && !B.exc[r.id]) { const k = KB().cleDe(B, r); real[k] = (real[k] || 0) - r.m; }
      else if (r.type === 'revenu') rev += r.m;
      else if (r.type === 'epargne') sav -= r.m;
    }
    const expRev = scope === 'commun' ? (() => { const T = KB().parts(B); return T.moi + T.autre; })() : KB().revenusAttendus(B).reduce((t, x) => t + (x.on ? x.amt : 0), 0);
    const G = { fixe: { p: 0, r: 0 }, courante: { p: 0, r: 0 }, optionnelle: { p: 0, r: 0 } }, over = [];
    let OUT = 0, HBR = 0;
    const connus = new Set();
    for (const a of L) {
      connus.add(a.key);
      if (a.hidden && !real[a.key]) continue;
      const pm = !a.on ? 0 : a.per > 1 ? ((real[a.key] || 0) > DEMI ? a.ech : 0) : a.amt, rr = real[a.key] || 0;
      const gg = G[a.nat];
      if (!gg) continue;
      if (a.nat !== 'fixe' && pm <= DEMI) HBR += rr; else { gg.p += pm; gg.r += rr; }
      OUT += Math.max(0, rr - Math.max(0, pm));
      if (rr - pm > 500) over.push({ label: a.label, ecart: rr - pm, budget: pm, reel: rr, cat: a.nat === 'fixe' ? (a.cat || a.label) : a.label });
    }
    for (const [k, v] of Object.entries(real)) {
      if (connus.has(k)) continue;
      const nat = k[0] === 'f' ? 'fixe' : KB().natureDe(B, k.slice(2));
      if (G[nat]) { if (nat === 'fixe') G[nat].r += v; else HBR += v; OUT += Math.max(0, v); if (v > 500) over.push({ label: k.slice(2), ecart: v, budget: 0, reel: v, cat: k.slice(2) }); }
    }
    over.sort((a, b) => b.ecart - a.ecart);
    const depP = G.fixe.p + G.courante.p + G.optionnelle.p, depR = G.fixe.r + G.courante.r + G.optionnelle.r + HBR;
    return { P, scope, rev, expRev, G, HBR, depP, depR, OUT, IN: depR - OUT, net: rev - depR, netP: expRev - depP, sav, over };
  }

  // ------------------------------------------------------------ répartition des dépenses d'une période
  function repartition(B, scope, start, end) {
    const cats = {}, nat = { fixe: 0, courante: 0, optionnelle: 0 };
    let dep = 0;
    for (const r of B.rows) {
      if (r.type !== 'depense' || B.exc[r.id]) continue;
      if (scope === 'commun' ? r.role !== 'commun' : ['courant', 'carte_differee', 'paiement_en_ligne'].indexOf(r.role) < 0) continue;
      if (r.od < start || r.od > end) continue;
      const v = -r.m, n = KB().natureDe(B, r.cat);
      dep += v; cats[r.cat] = (cats[r.cat] || 0) + v; nat[n] = (nat[n] || 0) + v;
    }
    const ent = Object.entries(cats).filter(([, v]) => v > DEMI).sort((a, b) => b[1] - a[1]);
    const autres = ent.slice(7).reduce((t, [, v]) => t + v, 0);
    const parCat = ent.slice(0, 7).map(([k, v]) => ({ k, v }));
    if (autres > DEMI) parCat.push({ k: 'Autres catégories', v: autres });
    return { total: dep, natures: ['fixe', 'courante', 'optionnelle'].filter(k => nat[k] > DEMI).map(k => ({ k, v: nat[k] })), categories: parCat };
  }

  g.KladObservations = { reglages, audit, observations, masque, fait, reafficher, annulerFait, periodePrecedente, resultats, repartition };
})(typeof window !== 'undefined' ? window : globalThis);
