// Klad — récupération des comptes Enable Banking : incrémentale, compte par compte, une erreur n'arrête pas les autres.
// En-têtes « utilisateur présent » (Psu-*) envoyés pour chaque récupération lancée par l'utilisateur : la banque
// indique ceux qu'elle exige ; il faut les envoyer tous, ou aucun. Testé dans node avec un faux client (test/sync.test.mjs).
(function (g) {
  'use strict';

  const M = () => g.KladModele;
  const AUTO_MS = 2 * 3600e3;                 // récupération au déverrouillage si la dernière date de plus de 2 h

  // En-têtes à envoyer : tous ceux dont on dispose si la banque n'en exige aucun qu'on ne sait pas fournir ; sinon aucun.
  function entetesPSU(requis, dispo) {
    const h = {};
    for (const k of Object.keys(dispo || {})) if (dispo[k]) h[k] = String(dispo[k]);
    const has = n => Object.keys(h).some(k => k.toLowerCase() === String(n).toLowerCase());
    if (Array.isArray(requis) && requis.some(r => !has(r))) return {};
    return h;
  }

  const refusPSU = e => e && (e.status === 422 || e.status === 400) && /PSU_HEADER/i.test((e.code || '') + ' ' + (e.message || ''));

  // 1.0.1 : « 400 Error interacting with ASPSP » = panne passagère côté banque. Pas d'erreur affichée (ni rouge, ni
  // « compte à vérifier ») tant qu'elle ne se répète pas 3 fois de suite ou plus de 24 h.
  const PASSAGER_FOIS = 3;
  const PASSAGER_MS = 24 * 3600e3;
  const MSG_PASSAGER = 'Banque momentanément indisponible, nouvel essai à la prochaine synchro.';
  const passager = e => !!e && e.status === 400 && /ASPSP/i.test((e.code || '') + ' ' + (e.message || ''));
  // → nouvel état sync du compte après une panne passagère (erreur posée seulement au-delà des seuils).
  function etatPassager(sync, now) {
    const p0 = (sync && sync.passager) || null;
    const p = { n: (p0 ? p0.n : 0) + 1, depuis: p0 ? p0.depuis : new Date(now).toISOString() };
    const grave = p.n >= PASSAGER_FOIS || now - Date.parse(p.depuis) > PASSAGER_MS;
    return Object.assign({}, sync, { passager: p, le: new Date(now).toISOString(),
      erreur: grave ? 'Banque indisponible depuis ' + (p.n >= PASSAGER_FOIS ? p.n + ' synchros' : 'plus de 24 h') + ' (erreur de la banque) : vérifiez l\'accès.' : null });
  }

  const aFaire = (S, now) => !S.modele.sync.derniere || now - S.modele.sync.derniere > AUTO_MS;

  // deps : { client() → KladEB.Client, dispo() → Promise<en-têtes disponibles>, log(kind, msg), now() → ms }
  // S : état courant ; garde() → vrai tant que S est le même (l'appli peut se verrouiller pendant la récupération).
  async function synchroniser(S, deps, garde) {
    const now = deps.now ? deps.now() : Date.now();
    const ok = garde || (() => true);
    // Comptes sans connexion (banque déconnectée) ou non retrouvés au renouvellement : signalés sur l'accueil, pas lus.
    const comptes = M().comptesTries(S).filter(c => c.source.type === 'eb' && !c.aReassocier && S.modele.connexions[c.source.connexion]);
    const res = { comptes: comptes.length, erreurs: 0, passagers: 0, nouvelles: 0, fusionnees: 0, retirees: 0 };
    if (!comptes.length) { S.modele.sync.derniere = now; return res; }
    const cl = deps.client();
    let dispo = {};
    try { dispo = (deps.dispo && await deps.dispo()) || {}; } catch (e) { dispo = {}; }
    for (const c of comptes) {
      if (!ok()) return null;
      const cx = S.modele.connexions[c.source.connexion];
      const nom = nomJournal(S, c);
      try {
        if (!cx) throw new Error('Connexion bancaire absente : reconnectez la banque.');
        if (M().etatAcces(cx, now) === 'expire') throw new Error('Accès bancaire expiré : renouvelez-le.');
        const b = M().bornesRecuperation(S, c, now);
        const from = b.from;
        if (b.ramenee) deps.log('info', nom + ' : date de début ramenée à aujourd\'hui');
        let h = entetesPSU(cx.psu, dispo);
        const lire = async hh => ({
          bal: await cl.balances(c.source.uid, hh),
          txs: await cl.transactions(c.source.uid, { dateFrom: from, headers: hh },
            (n, p) => { if (p > 1) deps.log('info', nom + ' : page ' + p + ', ' + n + ' opérations'); })
        });
        let r;
        try { r = await lire(h); }
        catch (e) {
          if (!refusPSU(e) || !Object.keys(h).length) throw e;
          deps.log('info', nom + ' : en-têtes utilisateur refusés, nouvel essai sans.');
          h = {};
          r = await lire(h);
        }
        if (!ok()) return null;
        const t = deps.now ? deps.now() : Date.now();
        M().soldesLus(S, c.id, r.bal, t);
        const st = M().integrer(S, c.id, r.txs, t);
        c.sync = { lu: new Date(t).toISOString(), erreur: null };
        res.nouvelles += st.nouvelles; res.fusionnees += st.fusionnees; res.retirees += st.retirees;
        deps.log('ok', nom + ' : ' + st.lues + ' lue(s) depuis ' + (from ? 'le ' + from.split('-').reverse().join('/') : 'le plus tôt possible') +
          ', ' + st.nouvelles + ' nouvelle(s), ' + st.maj + ' mise(s) à jour, ' + st.fusionnees + ' fusion(s), ' + st.retirees + ' retirée(s), ' +
          st.ignorees + ' ignorée(s)' + (st.reprises ? ' dont ' + st.reprises + ' déjà dans la reprise' : '') + (Object.keys(h).length ? '' : ', sans en-têtes utilisateur'));
      } catch (e) {
        if (!ok()) return null;
        if (passager(e)) {
          c.sync = etatPassager(c.sync, now);
          if (c.sync.erreur) { res.erreurs++; deps.log('err', nom + ' : ' + c.sync.erreur); }
          else { res.passagers++; deps.log('info', nom + ' : banque momentanément indisponible (' + c.sync.passager.n + '/' + PASSAGER_FOIS + '), nouvel essai à la prochaine synchro.'); }
          continue;
        }
        res.erreurs++;
        c.sync = Object.assign({}, c.sync, { erreur: String(e.message || e).slice(0, 200), le: new Date(now).toISOString(), passager: null });
        deps.log('err', nom + ' : ' + (e.message || e));
      }
    }
    S.modele.sync.derniere = now;
    return res;
  }

  // « Banque A · compte 2 » : jamais de nom de banque ni de compte dans le journal.
  function nomJournal(S, c) {
    const cx = S.modele.connexions[c.source.connexion];
    if (!cx) return 'Compte sans connexion';
    const i = M().comptesDe(S, c.source.connexion).indexOf(c);
    return g.KladAnon.accountLabel(S.modele.alias, cx.banque, i < 0 ? 0 : i);
  }

  // Texte d'un compte en panne passagère (sans erreur), ou null.
  const passagerDe = c => c && c.sync && !c.sync.erreur && c.sync.passager ? MSG_PASSAGER : null;

  g.KladSync = { AUTO_MS, entetesPSU, refusPSU, aFaire, synchroniser, nomJournal, passager, etatPassager, passagerDe, MSG_PASSAGER, PASSAGER_FOIS, PASSAGER_MS };
})(typeof window !== 'undefined' ? window : globalThis);
