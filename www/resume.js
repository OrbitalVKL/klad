// Klad — résumé lu par Grafit (Lien Grafit, paliers des Lots 4 et 5) : construction à partir de l'état déchiffré, et écritures
// limitées aux vrais changements. Fonctions pures (le plugin est fourni par l'appelant), testées dans node
// (test/resume.test.mjs).
//
// Le résumé ne contient jamais d'IBAN (ni sa fin), d'identifiant bancaire, de jeton, d'opération, de nom de banque
// ni de libellé bancaire brut. Montants en euros (centimes / 100), dates AAAA-MM-JJ, instants en ms.
// Un champ impossible à calculer est omis, jamais remplacé par 0.
(function (g) {
  'use strict';

  const M = () => g.KladModele;
  const K = () => g.KladClasse;
  const KB = () => g.KladBudget;
  const V = 1;
  const MAX_OCTETS = 32 * 1024 - 1;              // moins de 32 Ko (contrôlé aussi par le plugin natif)
  const PERIME_MS = 30 * 3600e3;                 // relevé de plus de 30 h
  const CRIT_JOURS = 3;                          // accès bancaire : critique à 3 jours ou moins
  const KINDS = { courant: 'current', commun: 'current', carte_differee: 'card', paiement_en_ligne: 'wallet', epargne: 'savings' };
  // Libellé d'un compte encore « à vérifier » (jamais confirmé par l'utilisateur) : il peut venir de la banque.
  const GENERIQUES = { courant: 'COMPTE COURANT', commun: 'COMPTE COMMUN', carte_differee: 'CARTE', paiement_en_ligne: 'PAIEMENT EN LIGNE', epargne: 'EPARGNE' };
  const NIVEAUX = { crit: 0, caut: 1, info: 2 };

  const euros = c => c / 100;
  const enEuros = c => (c.devise || 'EUR') === 'EUR';
  const visibles = S => M().comptesTries(S).filter(c => !c.masque);

  // Libellé en majuscules, sans accents, sans rien qui ressemble à un numéro (IBAN, fin d'IBAN, n° de compte, e-mail).
  function libelle(c) {
    const generique = GENERIQUES[c.role] || 'COMPTE';
    let s = String((c.aVerifier ? generique : c.libelle) || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/g, ' ')
      .replace(/\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]){10,30}\b/g, ' ')
      .replace(/\d(?:[\s.]?\d){4,}/g, ' ');
    const fin = c.source && c.source.fin4 ? String(c.source.fin4).toUpperCase() : '';
    if (fin) s = s.split(/\s+/).filter(w => w.replace(/^[^A-Z0-9]+|[^A-Z0-9]+$/g, '') !== fin).join(' ');
    s = s.replace(/\s+/g, ' ').trim().slice(0, 24).trim();
    return s || generique;
  }

  function perime(c, now) {
    const lu = c.sync && c.sync.lu ? Date.parse(c.sync.lu) : 0;
    return !lu || now - lu > PERIME_MS;
  }

  // Âge d'un relevé : « n H » sous 24 h, sinon « n J ».
  function age(ms) { return ms < 864e5 ? Math.floor(ms / 3600e3) + ' H' : Math.floor(ms / 864e5) + ' J'; }

  function compteResume(S, c, now) {
    const r = { id: c.id, label: libelle(c), kind: KINDS[c.role] || 'current' };
    const eb = c.source.type === 'eb';
    const s = M().soldeAffiche(S, c);
    // Carte à débit différé : le solde brut de la carte n'est pas exposé (sa signification varie selon la banque) ;
    // sa dette (somme à prélever, positive) et la date du dernier règlement le sont.
    if (c.role === 'carte_differee' && enEuros(c) && K()) {
      const d = K().dette(S, c, now);
      if (d) { r.due = euros(d.centimes); if (d.depuis) r.due_since = d.depuis; }
    }
    if (c.role !== 'carte_differee' && s && enEuros(c)) {
      r.balance = euros(s.centimes);
      const itav = eb && S.soldes[c.id] && S.soldes[c.id].types && S.soldes[c.id].types.ITAV;
      if (itav && Number.isInteger(itav.centimes) && itav.centimes !== s.centimes) r.available = euros(itav.centimes);
      const ref = typeof s.dateRef === 'string' ? s.dateRef.slice(0, 10) : '';
      const lu = s.lu ? Date.parse(s.lu) : 0;
      const asOf = M().dateValide(ref) ? ref : lu ? M().jourLocal(lu) : null;
      if (asOf) r.as_of = asOf;
    }
    if (eb) r.stale = perime(c, now);
    else r.manual = true;
    return r;
  }

  function alertes(S, comptes, resumes, now, ext) {
    const out = [];
    const at = ext && ext.attention;
    if (at && at.accountsToCheck) out.push({ level: 'caut', code: 'ACCOUNT_CHECK', text: at.accountsToCheck + (at.accountsToCheck > 1 ? ' COMPTES À VÉRIFIER' : ' COMPTE À VÉRIFIER') });
    comptes.forEach((c, i) => {
      const r = resumes[i];
      if ((c.role === 'courant' || c.role === 'commun') && r.balance < 0) out.push({ level: 'crit', code: 'NEGATIVE_BALANCE', text: r.label });
      if (c.source.type !== 'eb') return;
      const cx = S.modele.connexions[c.source.connexion];
      const acces = M().etatAcces(cx, now);
      if (acces) {
        const j = Math.max(0, Math.floor((Date.parse(cx.valid_until) - now) / 864e5));
        out.push({ level: acces === 'expire' || j <= CRIT_JOURS ? 'crit' : 'caut', code: 'BANK_CONSENT_EXPIRING', text: r.label + ' · ' + j + ' J' });
      }
      if (c.sync && c.sync.erreur) out.push({ level: 'caut', code: 'SYNC_FAILED', text: r.label });
      if (r.stale) {
        const lu = c.sync && c.sync.lu ? Date.parse(c.sync.lu) : 0;
        out.push({ level: 'info', code: 'STALE', text: lu ? r.label + ' · ' + age(now - lu) : r.label });
      }
    });
    if (at && at.unseen) out.push({ level: 'info', code: 'TO_REVIEW', text: at.unseen + (at.unseen > 1 ? ' OPÉRATIONS À VOIR' : ' OPÉRATION À VOIR') });
    const sv = ext && ext.sauvegarde;
    if (sv && sv.jours == null) out.push({ level: 'info', code: 'BACKUP_DUE', text: 'SAUVEGARDE · JAMAIS' });
    else if (sv && sv.jours >= 30) out.push({ level: 'info', code: 'BACKUP_DUE', text: 'SAUVEGARDE · ' + sv.jours + ' J' });
    if (ext && ext.maj && /^\d+\.\d+\.\d+$/.test(ext.maj)) out.push({ level: 'info', code: 'UPDATE_AVAILABLE', text: 'KLAD ' + ext.maj });
    for (const b of (ext && ext.budgetOver) || []) out.push({ level: 'caut', code: 'BUDGET_OVER', text: b });
    if (ext && ext.decouvert) out.push({ level: ext.decouvert.niveau === 'crit' ? 'crit' : 'caut', code: 'OVERDRAFT_RISK', text: ext.decouvert.texte });
    return out.map((a, i) => [a, i]).sort((x, y) => NIVEAUX[x[0].level] - NIVEAUX[y[0].level] || x[1] - y[1]).map(x => x[0]);
  }

  // Totaux : épargne ; tous comptes (courants, commun, épargne, moins la dette des cartes à débit différé visibles).
  // Un total dont un compte n'a pas de solde (ou une carte pas de dette) connu est omis. Les comptes hors euros ne sont
  // pas comptés.
  function totaux(S, comptes, now) {
    let ep = 0, nEp = 0, epOk = true, tout = 0, nTout = 0, toutOk = true;
    for (const c of comptes) {
      if (c.role === 'carte_differee' && enEuros(c)) {
        const d = K() ? K().dette(S, c, now) : null;
        if (d) tout -= d.centimes; else toutOk = false;
        continue;
      }
      if (!enEuros(c) || ['courant', 'commun', 'epargne'].indexOf(c.role) < 0) continue;
      const s = M().soldeAffiche(S, c);
      if (s) { tout += s.centimes; nTout++; } else toutOk = false;
      if (c.role === 'epargne') { if (s) { ep += s.centimes; nEp++; } else epOk = false; }
    }
    const t = {};
    if (nTout && toutOk) t.all = euros(tout);
    if (nEp && epOk) t.savings = euros(ep);
    return Object.keys(t).length ? t : null;
  }

  // Fin de la dernière lecture réussie, tous comptes confondus (ms), ou null.
  function dernierReleve(S) {
    let t = 0;
    for (const c of S.modele.comptes) {
      const lu = c.source.type === 'eb' && c.sync && c.sync.lu ? Date.parse(c.sync.lu) : 0;
      if (lu > t) t = lu;
    }
    return t || null;
  }

  // Solde du compte de prélèvement de la première carte à débit différé visible, moins la dette de cette carte.
  function apresCarte(S, comptes, accounts, now) {
    const i = comptes.findIndex(c => c.role === 'carte_differee' && c.prelevement && c.prelevement.compte);
    if (i < 0 || accounts[i].due == null) return null;
    const p = M().compte(S, comptes[i].prelevement.compte);
    const s = p && enEuros(p) ? M().soldeAffiche(S, p) : null;
    return s ? euros(s.centimes - Math.round(accounts[i].due * 100)) : null;
  }

  // « À vérifier » : nombres non nuls et connus seulement.
  function attention(ext) {
    const a = (ext && ext.attention) || {};
    const r = {};
    if (a.unseen) r.unseen = a.unseen;
    if (a.unclassified) r.unclassified = a.unclassified;
    if (a.accountsToCheck) r.accounts_to_check = a.accountsToCheck;
    if (a.toMatch) r.wallet_to_match = a.toMatch;
    const sv = ext && ext.sauvegarde;
    if (sv && sv.jours) r.backup_days = sv.jours;
    return Object.keys(r).length ? r : null;
  }

  // Libellé d'un poste ou d'une échéance : majuscules sans accents, sans numéro ni adresse, sans les mots des noms
  // de banque connus (connexions), 24 caractères au plus.
  function libellePoste(S, txt) {
    const banques = new Set();
    for (const k of Object.keys(S.modele.connexions || {})) {
      for (const w of String(S.modele.connexions[k].banque || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().split(/[^A-Z0-9]+/)) if (w.length >= 3) banques.add(w);
    }
    let s = String(txt || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/g, ' ')
      .replace(/\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]){10,30}\b/g, ' ')
      .replace(/\d(?:[\s.]?\d){3,}/g, ' ');
    s = s.split(/\s+/).filter(w => !banques.has(w.replace(/[^A-Z0-9]/g, ''))).join(' ');
    return s.replace(/\s+/g, ' ').trim().slice(0, 24).trim();
  }

  // Budget du cycle en cours (perso), reste à vivre, échéances à venir, postes dépassés. → { month, upcoming, over } ;
  // champs omis s'ils ne peuvent pas être calculés.
  function budget(S, now, ext) {
    if (!KB() || !K()) return null;
    const B = (ext && ext.budget) || KB().contexte(S, now);
    if (!B.rows.length) return null;
    const s = KB().suivi(B, 'perso', null);
    const per = s.per;
    const postes = [];
    for (const nk of KB().NATS) postes.push(...s.sections[nk].lignes);
    postes.push(...s.horsBudget.lignes);
    const top = postes.filter(a => a.cur > 50 || a.pm > 50).map(a => ({ a, over: a.debit === undefined ? a.cur - a.pm : 0 }))
      .sort((x, y) => (Math.max(0, y.over) - Math.max(0, x.over)) || (y.a.cur - x.a.cur)).slice(0, 5)
      .map(x => ({ label: libellePoste(S, x.a.label) || 'POSTE', spent: euros(Math.round(x.a.cur)), budget: euros(Math.round(x.a.pm)) }));
    const month = { cycle: per.cyc ? 'salary' : 'calendar', from: per.start, to: per.end, spent: euros(Math.round(s.total.C)),
      budget: euros(Math.round(s.total.P)), left: euros(Math.round(s.total.P - s.total.C)), income: euros(Math.round(s.revenus.c)), top };
    // reste à vivre : la colonne choisie par le propriétaire (Réglages › Budget, 0.10.7), « dernier salaire » par défaut
    const rv = KB().ravChoisi(s.rav, KB().baseRav(S));
    if (rv) { month.left_to_live = euros(Math.round(rv.col.reste)); month.left_to_live_basis = rv.base; }
    const comptes = new Map(S.modele.comptes.map(c => [c.libelle, c]));
    const upcoming = KB().echeances(B, 31).slice(0, 10).map(e => ({
      date: e.date, label: e.sorte === 'carte' && comptes.get(e.label) ? libelle(comptes.get(e.label)) : (libellePoste(S, e.poste || e.label) || 'ECHEANCE'),
      amount: -euros(e.montant), kind: { contrat: 'contract', recurrent: 'recurring', carte: 'card' }[e.sorte] }));
    const over = s.depasses.filter(a => a.pm > 50).slice(0, 3).map(a => (libellePoste(S, a.label) || 'POSTE') + ' +' + Math.round(100 * (a.cur - a.pm) / a.pm) + ' %');
    let commun = null;
    let risque = null;
    if (g.KladCommun) { try { commun = g.KladCommun.resume(B); risque = commun && g.KladCommun.risqueDecouvert(B); } catch (e) { commun = null; } }
    return { month, upcoming, over, commun, risque };
  }

  // ext (facultatif) : { attention: { unseen, unclassified, accountsToCheck, toMatch }, sauvegarde: { jours | null }, maj: version,
  //   budget: contexte KladBudget déjà construit }.
  function construire(S, now, ext) {
    const comptes = visibles(S);
    if (!comptes.length) return { v: V, state: 'empty', generated: now };
    let bu = null;
    try { bu = budget(S, now, ext); } catch (e) { bu = null; }
    if (bu && bu.over.length) ext = Object.assign({}, ext, { budgetOver: bu.over });
    // Découvert prévu du commun : « crit » sous 31 jours, « caut » plus tard dans les 12 mois, rien sinon.
    if (bu && bu.risque) {
      const d = bu.risque.date;
      ext = Object.assign({}, ext, { decouvert: { niveau: bu.risque.niveau, texte: 'COMPTE COMMUN · ' + d.slice(8, 10) + '/' + d.slice(5, 7) } });
    }
    const accounts = comptes.map(c => compteResume(S, c, now));
    const r = { v: V, state: 'ok', generated: now };
    const st = dernierReleve(S);
    if (st) r.statement_at = st;
    r.accounts = accounts;
    const t = totaux(S, comptes, now);
    if (t) r.total = t;
    const mac = apresCarte(S, comptes, accounts, now);
    if (mac != null) r.main_after_card = mac;
    const at = attention(ext);
    if (at) r.attention = at;
    if (bu) { r.month = bu.month; r.upcoming = bu.upcoming; if (bu.commun) r.commun = bu.commun; }
    r.alerts = alertes(S, comptes, accounts, now, ext);
    // Filet de sécurité (30 comptes tiennent largement) : alertes, puis comptes en trop retirés.
    while (octets(r) > MAX_OCTETS && r.upcoming && r.upcoming.length) r.upcoming.pop();
    while (octets(r) > MAX_OCTETS && r.alerts.length) r.alerts.pop();
    while (octets(r) > MAX_OCTETS && r.accounts.length > 1) { r.accounts.pop(); delete r.total; }
    return r;
  }

  const octets = o => new TextEncoder().encode(JSON.stringify(o)).length;

  // Résumé sans « generated » : deux résumés de même signature ne valent pas une nouvelle écriture.
  function signature(x) {
    const o = typeof x === 'string' ? JSON.parse(x) : JSON.parse(JSON.stringify(x));
    delete o.generated;
    return JSON.stringify(o);
  }

  const actif = S => !!(S && S.modele.grafit && S.modele.grafit.actif);

  // Écritures du résumé, une à la fois. P : plugin KladGrafit (ou un faux) :
  //   lire() → { json | null }, ecrire({ json }) → { ok, reason }, effacer() → { ok }.
  // Le contenu enregistré est relu une fois, puis suivi en mémoire : rien n'est écrit (ni notifié) s'il n'a pas changé.
  function creerLien(P) {
    let connu;                 // undefined : à relire ; null : aucun résumé enregistré ; sinon sa signature
    let file = Promise.resolve();
    const enFile = fn => (file = file.catch(() => {}).then(fn));
    async function enregistre() {
      if (connu === undefined) {
        const r = await P.lire();
        try { connu = r && r.json ? signature(r.json) : null; } catch (e) { connu = ''; }   // illisible : sera remplacé
      }
      return connu;
    }
    function maj(S, now, ext) {
      return enFile(async () => {
        if (!S) return 'rien';
        if (!actif(S)) {
          if (await enregistre() === null) return 'rien';
          await P.effacer(); connu = null;
          return 'efface';
        }
        const r = construire(S, now, typeof ext === 'function' ? ext() : ext);
        const sig = signature(r);
        if (await enregistre() === sig) return 'inchange';
        const res = await P.ecrire({ json: JSON.stringify(r) });
        if (res && res.ok === false) throw new Error('résumé refusé (' + (res.reason || 'erreur') + ')');
        connu = sig;
        return 'ecrit';
      });
    }
    function effacer() { return enFile(async () => { await P.effacer(); connu = null; return 'efface'; }); }
    return { maj, effacer };
  }

  g.KladResume = { V, MAX_OCTETS, KINDS, libelle, libellePoste, construire, signature, actif, creerLien };
})(typeof window !== 'undefined' ? window : globalThis);
