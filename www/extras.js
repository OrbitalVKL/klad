// Klad — Plus › Extras : fonctions facultatives, toutes désactivées par défaut (« Mail » : appels de fonds lus dans la
// boîte de réception ; « Claude » : lecture de documents et analyses). Désactivé, un extra n'affiche ni bouton ni écran.
// Réglages dans S.modele.extras ; secrets (mot de passe d'application, clé Claude) dans S.cle, chiffrés dans le coffre
// comme la clé Enable Banking ; jamais écrits dans le journal, jamais envoyés ailleurs qu'au serveur concerné.
(function (g) {
  'use strict';

  const KB = () => g.KladBudget, KC = () => g.KladCommun, KF = () => g.KladFisc, CL = () => g.KladClaude, ML = () => g.KladMail;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const eu = c => Math.round(Math.abs(+c || 0) / 100).toLocaleString('fr-FR').replace(/[\s  ]/g, ' ') + ' €';    // centimes, texte envoyé
  const sg = c => (c < 0 ? 'déficit de ' : '') + eu(c);

  // ------------------------------------------------------------ état
  const ex = S => (S && S.modele && S.modele.extras) || {};
  function reglage(S, nom) {
    S.modele.extras = S.modele.extras || {};
    return S.modele.extras[nom] = S.modele.extras[nom] || { on: false };
  }
  function actif(S, nom) {
    const E = ex(S)[nom];
    if (!E || !E.on) return false;
    if (nom === 'claude') return !!(S.cle && S.cle.claude);
    if (nom === 'mail') return !!(S.cle && S.cle.mailMdp && E.adresse && E.hote);
    return false;
  }

  // ------------------------------------------------------------ agrégats envoyés pour une analyse (strict minimum)
  // Ni opération, ni libellé bancaire, ni compte, ni IBAN : totaux et postes du budget, soldes calculés ; les deux
  // personnes sont « personne A » (moi) et « personne B ».
  function agregats(B, scope) {
    const noms = (() => { try { const c = KC().reglages(B); return [c.moi, c.autre].filter(Boolean); } catch (e) { return []; } })();
    const anonyme = t => noms.reduce((x, n, i) => x.split(n).join(i === 0 ? 'personne A' : 'personne B'), String(t));
    const L = [];
    if (scope === 'perso' || scope === 'commun') {
      const s = KB().suivi(B, scope, null);
      L.push((scope === 'perso' ? 'Budget personnel' : 'Budget du compte commun') + ', période en cours (jour ' + s.jour + ' sur ' + s.nbJours + ').');
      L.push('Revenus : prévus ' + eu(s.revenus.p) + ', reçus ' + eu(s.revenus.c) + '.');
      for (const [k, nom] of [['fixe', 'Charges fixes'], ['courante', 'Dépenses courantes'], ['optionnelle', 'Dépenses optionnelles']]) {
        const T = s.T[k];
        L.push(nom + ' : budget ' + eu(T.p) + ', dépensé ' + eu(T.c) + (k !== 'fixe' ? ', projeté en fin de période ' + eu(T.proj) : '') + '.');
      }
      L.push('Hors budget : ' + eu(s.horsBudget.c) + '. Total dépensé ' + eu(s.total.C) + ' pour un budget de ' + eu(s.total.P) + '.');
      const postes = [];
      for (const k of ['fixe', 'courante', 'optionnelle']) for (const a of s.sections[k].lignes) if (a.pm > 0 || a.cur > 0) postes.push(a);
      postes.sort((x, y) => Math.max(y.cur, y.proj || 0) - Math.max(x.cur, x.proj || 0));
      if (postes.length) L.push('Principaux postes (budget / dépensé / projeté) : ' + postes.slice(0, 10).map(a => anonyme(a.label) + ' ' + eu(a.pm) + ' / ' + eu(a.cur) + ' / ' + eu(Math.max(a.cur, a.proj || 0))).join(' ; ') + '.');
      if (s.depasses.length) L.push('Postes dépassés : ' + s.depasses.map(a => anonyme(a.label) + ' (' + eu(a.cur - a.pm) + ' de plus)').join(', ') + '.');
      if (scope === 'perso' && s.rav) {
        const r = s.rav;
        L.push('Reste à vivre jusqu\'au ' + r.fin.slice(8, 10) + '/' + r.fin.slice(5, 7) + ' : ' + sg(r.budget.reste) + ' sur le dernier salaire' + (r.comptes ? ', ' + sg(r.comptes.reste) + ' sur les comptes courants' : '') + '.');
      }
      const to = B.auj.slice(0, 7), from = KB().shift(to, -6);
      const T = KB().tendanceMois(B, { scope, from, to: KB().shift(to, -1), mode: 'rd' });
      L.push('Six derniers mois complets (revenus / dépenses) : ' + T.mois.map((m, i) => m + ' ' + eu(T.rev[i]) + ' / ' + eu(T.dep[i])).join(' ; ') + '.');
      if (scope === 'commun') {
        try {
          const f = KC().finDeMois(B), C = KC().tresorerie(B), E = KC().equilibre(B), A = KC().appels(B);
          if (f) L.push('Compte commun : solde ' + sg(f.solde) + ', prélèvements encore à venir ce mois ' + eu(f.due) + ', virements attendus ' + eu(f.inc) + ', réserve pour échéances ' + eu(f.reserve) + ', fin de mois estimée ' + sg(f.end) + '.');
          if (C) L.push('Trésorerie sur 12 mois : point bas ' + sg(C.min) + ' le ' + C.minAt + (C.negAt ? ', passage sous zéro le ' + C.negAt : '') + '.');
          const reste = Object.values(A || {}).reduce((t, x) => t + Math.max(0, x.reste), 0);
          if (Object.keys(A || {}).length) L.push('Appels de fonds : ' + (reste > 50 ? eu(reste) + ' restent à virer au syndic' : 'tous réglés') + '.');
          if (E) L.push('Équilibre des apports (objectif parts égales) : personne A a investi ' + eu(E.invMoi) + ', personne B ' + eu(E.invAutre) + ' ; écart ' + eu(Math.abs(E.ecart)) + ', rattrapage ' + eu(Math.abs(E.rythme)) + ' par mois' + (E.dateEquilibre ? ', équilibre vers ' + E.dateEquilibre : '') + '.');
        } catch (e) { /* données du commun incomplètes */ }
      }
    } else if (scope === 'impots') {
      const X = KF().contexte(B), R = KF().annee(X, X.Y);
      L.push('Impôt sur le revenu du foyer, revenus ' + X.Y + ' (' + (R.kind === 'est' ? 'estimation' : 'avis') + ') : total ' + eu(R.total * 100) + ', déjà prélevé ' + eu((R.paid || 0) * 100) + ', ' + (R.solde >= 0 ? 'solde à payer ' : 'remboursement ') + eu(Math.abs(R.solde || 0) * 100) + '.');
      if (R.kind === 'est') L.push('Taux du foyer appliqué ' + (Math.round((R.tauxNew || 0) * 10) / 10) + ' % ; tranche marginale ' + R.F.B.tmi + ' % ; ' + R.bg.length + ' bulletin(s) de personne A et ' + R.bs.length + ' de personne B lus.');
      for (const r of KF().regularisations(X)) L.push('Régularisation : ' + anonyme(r.per) + (r.kind === 'avis' ? (r.done ? ', rien à régulariser' : ', ' + (r.from === 'g' ? 'personne A' : 'personne B') + ' verse ' + eu(r.amt * 100) + ' à ' + (r.to === 'g' ? 'personne A' : 'personne B')) : ', ' + anonyme(r.txt)) + '.');
      for (const a of KF().alertes(X, R)) if (a.lvl === 'warn') L.push('Point à suivre : ' + anonyme(a.t) + '.');
    }
    return L.map(anonyme).join('\n');
  }

  // ------------------------------------------------------------ interface (Plus › Extras)
  function init(A) {
    const $ = id => document.getElementById(id);
    const S = () => A.etat();
    const analyses = {};          // analyses de Claude de la session (non gardées)
    const aide = (titre, etapes, fin) => '<details class="bnote"><summary>' + esc(titre) + '</summary><ol class="note">' + etapes.map(e => '<li>' + e + '</li>').join('') + '</ol>' + (fin ? '<p class="note">' + fin + '</p>' : '') + '</details>';
    const bascule = (nom, titre, sous, on) => '<div class="rl"><div><b>' + esc(titre) + '</b><span>' + esc(sous) + '</span></div><button type="button" class="tgl" role="switch" data-extra="' + nom + '" aria-checked="' + !!on + '" aria-label="' + esc(titre) + '"></button></div>';
    const champ = (id, lab, val, o) => '<label class="sh-l"><span class="sh-lab">' + esc(lab) + '</span><input class="sh-in" id="' + id + '" ' + (o || '') + ' value="' + esc(val == null ? '' : val) + '"></label>';

    function renderExtras() {
      const s = S(); if (!s) return;
      const M = reglage(s, 'mail'), C = reglage(s, 'claude'), R = ML().reglages(s);
      let h = '<p class="muted">Fonctions facultatives, désactivées par défaut. Désactivée, une fonction ne montre ni bouton ni écran.</p>';
      h += '<div class="sh-rule">' + bascule('mail', 'Appels de fonds par mail', 'lecture seule de la boîte de réception (IMAP)', M.on);
      if (M.on) {
        h += '<div class="grp">' + champ('exHote', 'Serveur IMAP', M.hote || R.hote, 'autocomplete="off" spellcheck="false"') + champ('exPort', 'Port', M.port || 993, 'inputmode="numeric"') + '</div>' +
          champ('exAdresse', 'Adresse e-mail', M.adresse || '', 'type="email" autocomplete="off" spellcheck="false"') +
          champ('exMdp', 'Mot de passe d\'application', '', 'type="password" autocomplete="off" placeholder="' + (s.cle.mailMdp ? 'enregistré (laisser vide pour le garder)' : '16 lettres') + '"') +
          champ('exExp', 'Expéditeurs (morceau de l\'adresse, séparés par des virgules)', R.expediteurs.join(', '), 'autocomplete="off" spellcheck="false"') +
          champ('exMots', 'Mots-clés (sujet ou texte, séparés par des virgules)', R.motsCles.join(', '), 'autocomplete="off"') +
          champ('exJours', 'Jours lus en arrière', R.jours, 'inputmode="numeric"') +
          '<div class="row"><button type="button" class="btn primary" data-exa="mailok">Enregistrer</button><button type="button" class="btn" data-exa="mailtest">Tester la connexion</button></div>' +
          aide('Créer un mot de passe d\'application Gmail (pas à pas)', [
            'Sur le téléphone ou un ordinateur, ouvre <b>myaccount.google.com</b> › <b>Sécurité</b>.',
            'Active la <b>Validation en deux étapes</b> si ce n\'est pas fait (obligatoire pour l\'étape suivante).',
            'Cherche <b>Mots de passe des applications</b> (barre de recherche du compte), crée-en un nommé « Klad ».',
            'Google affiche 16 lettres : copie-les et colle-les dans « Mot de passe d\'application » ci-dessus, puis <b>Enregistrer</b>.',
            'Dans Gmail › Paramètres › <b>Transfert et POP/IMAP</b>, vérifie que l\'accès IMAP est activé.'],
            'Klad lit seulement : aucun message n\'est marqué lu, déplacé ni supprimé, et rien n\'est envoyé. Connexion chiffrée (TLS) obligatoire. Ton mot de passe Google n\'est jamais demandé ; le mot de passe d\'application se révoque à tout moment au même endroit.');
      }
      h += '</div><div class="sh-rule">' + bascule('claude', 'Claude', 'lire bulletins, avis et appels de fonds ; analyses', C.on);
      if (C.on) {
        h += champ('exCle', 'Clé API Anthropic', '', 'type="password" autocomplete="off" spellcheck="false" placeholder="' + (s.cle.claude ? 'enregistrée (laisser vide pour la garder)' : 'sk-ant-…') + '"') +
          '<label class="sh-l"><span class="sh-lab">Modèle</span><select class="sh-in" id="exModele">' + Object.keys(CL().MODELES).map(m => '<option value="' + m + '"' + ((C.modele || CL().DEFAUT) === m ? ' selected' : '') + '>' + esc(CL().MODELES[m].nom) + ' · ' + String(CL().MODELES[m].entree).replace('.', ',') + ' $ / ' + String(CL().MODELES[m].sortie).replace('.', ',') + ' $ par million de jetons</option>').join('') + '</select></label>' +
          '<div class="row"><button type="button" class="btn primary" data-exa="claudeok">Enregistrer</button><button type="button" class="btn" data-exa="claudetest">Tester la clé</button></div>' +
          aide('Créer une clé Claude (pas à pas)', [
            'Ouvre <b>console.anthropic.com</b> et connecte-toi (compte de la console, distinct de l\'abonnement Claude).',
            '<b>Settings › Billing</b> : ajoute des crédits (quelques dollars suffisent). Chaque appel est <b>facturé sur ces crédits API</b>, pas sur l\'abonnement.',
            '<b>Settings › API keys › Create key</b>, nom « Klad ». Copie la clé (elle commence par « sk-ant- »).',
            'Colle-la dans « Clé API Anthropic » ci-dessus, puis <b>Enregistrer</b> et <b>Tester la clé</b> (le test est gratuit).'],
            'La clé est chiffrée dans le coffre du téléphone et n\'est envoyée qu\'à Anthropic. Avant chaque appel, Klad montre ce qui sera envoyé et son coût estimé.');
      }
      h += '</div>';
      $('extrasCorps').innerHTML = h;
    }
    A.preparer.secExtras = () => renderExtras();

    $('extrasCorps').addEventListener('click', ev => {
      const s = S(); if (!s) return;
      const t = ev.target.closest('[data-extra]');
      if (t) {
        const E = reglage(s, t.dataset.extra);
        E.on = !E.on;
        A.log('info', 'Extra « ' + (t.dataset.extra === 'mail' ? 'Mail' : 'Claude') + ' » ' + (E.on ? 'activé' : 'désactivé') + '.');
        A.changed('extras'); renderExtras();
        return;
      }
      const b = ev.target.closest('[data-exa]');
      if (!b) return;
      const a = b.dataset.exa;
      if (a === 'mailok' || a === 'mailtest') {
        const E = reglage(s, 'mail');
        const hote = $('exHote').value.trim(), port = +$('exPort').value || 993, adr = $('exAdresse').value.trim();
        if (!hote || /[\s/:]/.test(hote)) { A.toast('Serveur IMAP invalide (ex. imap.gmail.com).', true); return; }
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(adr)) { A.toast('Adresse e-mail invalide.', true); return; }
        Object.assign(E, { hote, port, adresse: adr, expediteurs: $('exExp').value, motsCles: $('exMots').value, jours: Math.min(800, Math.max(1, +$('exJours').value || 400)) });
        const mdp = $('exMdp').value.replace(/\s/g, '');
        if (mdp) s.cle.mailMdp = mdp;
        A.changed('extras');
        if (a === 'mailok') { A.log('info', 'Réglages de l\'extra « Mail » enregistrés.'); A.toast('Réglages enregistrés.'); renderExtras(); return; }
        A.busy(b, async () => { const r = await plugin().tester(params(s)); A.toast('Connexion réussie : ' + (r.nb || 0) + ' message(s) dans la boîte de réception, lecture seule.'); A.log('ok', 'Extra « Mail » : connexion testée.'); });
        return;
      }
      if (a === 'claudeok' || a === 'claudetest') {
        const E = reglage(s, 'claude');
        E.modele = $('exModele').value;
        const cle = $('exCle').value.trim();
        if (cle) { if (!/^sk-ant-[\w-]{20,}$/.test(cle)) { A.toast('Clé illisible : elle commence par « sk-ant- ».', true); return; } s.cle.claude = cle; }
        A.changed('extras');
        if (a === 'claudeok') { A.log('info', 'Réglages de l\'extra « Claude » enregistrés.'); A.toast('Réglages enregistrés.'); renderExtras(); return; }
        if (!s.cle.claude) { A.toast('Saisissez d\'abord la clé.', true); return; }
        A.busy(b, async () => { await CL().tester(g.fetch.bind(g), s.cle.claude, E.modele); A.toast('Clé acceptée par Anthropic.'); A.log('ok', 'Extra « Claude » : clé testée.'); });
      }
    });

    // ------------------------------------------------------------ mails (plugin natif KladMail)
    function plugin() {
      const C = g.Capacitor;
      const P = C && C.Plugins && C.Plugins.KladMail;
      if (!P) throw new Error('Lecture des mails disponible seulement dans l\'appli Android.');
      return P;
    }
    function params(s) {
      const E = reglage(s, 'mail'), R = ML().reglages(s);
      return { hote: E.hote, port: E.port || 993, adresse: E.adresse, motDePasse: s.cle.mailMdp || '', expediteurs: R.expediteurs, motsCles: R.motsCles, jours: R.jours, max: R.max };
    }
    async function lireMails(btn) {
      const s = S(); if (!s || !actif(s, 'mail')) return;
      await A.busy(btn, async () => {
        const R = ML().reglages(s);
        const r = await plugin().chercher(params(s));
        const msgs = r.messages || [], textes = {};
        for (const m of msgs) for (const p of m.pieces || []) {
          if (!p.base64 || textes[p.nom] != null) continue;
          try { textes[p.nom] = await g.KladPdf.texte(g.KladCoffre.fromB64(p.base64)); } catch (e) { textes[p.nom] = ''; }
        }
        const cps = Object.keys((s.budget && s.budget.appels) || {}).filter(k => k !== 'mails' && k !== 'pdfs');
        const res = ML().analyser(msgs, R, textes, cps);
        const it = ML().integrer(s, res);
        reglage(s, 'mail').derniere = new Date().toISOString();
        A.log('ok', 'Mails lus : ' + msgs.length + ' message(s) retenu(s), ' + it.mails + ' appel(s) nouveau(x), ' + it.pdfs + ' montant(s) lu(s) dans les PDF.');
        A.changed('appels');
        if (it.mails || it.pdfs) A.toastAnnuler(it.mails + ' appel(s) nouveau(x), ' + it.pdfs + ' montant(s) lu(s).', () => { ML().annuler(S(), it.avant); A.changed('appels'); });
        else A.toast('Aucun nouvel appel de fonds dans les mails.');
      });
    }

    // ------------------------------------------------------------ Claude : envoi confirmé, puis résultat à valider
    let encours = null;            // { tache, entree, etape, estimation, reponse, choix }
    const TITRES = { bulletin: 'Lire un bulletin', avis: 'Lire un avis', appel: 'Lire un appel de fonds', analyse: 'Analyse de Claude' };
    function ouvrir(tache, entree, choix) {
      encours = { tache, entree, etape: 'envoi', estimation: null, choix: choix || {} };
      A.ouvrirVolet('secClaude', { titre: TITRES[tache.split(':')[0]] || 'Claude' });
      const s = S(), E = reglage(s, 'claude');
      CL().estimer(g.fetch.bind(g), s.cle.claude, encours.tache.split(':')[0], entree, E.modele)
        .then(e => { if (encours && encours.entree === entree) { encours.estimation = e.texte; renderClaude(); } })
        .catch(e => { if (encours && encours.entree === entree) { encours.estimation = 'estimation impossible (' + e.message + ')'; renderClaude(); } });
    }
    function renderClaude() {
      const s = S(); if (!s || !encours) return;
      const T = encours.tache.split(':')[0], W = (() => { try { return KC().reglages(A.budget()); } catch (e) { return { moi: 'Personne A', autre: 'Personne B' }; } })();
      const mo = CL().MODELES[reglage(s, 'claude').modele] || CL().MODELES[CL().DEFAUT];
      let h = '';
      if (encours.etape === 'envoi') {
        h += '<p class="muted">Modèle : ' + esc(mo.nom) + ' · coût : <b>' + esc(encours.estimation || 'calcul…') + '</b></p>';
        if (T === 'bulletin') h += '<label class="sh-l"><span class="sh-lab">Bulletin de</span><select class="sh-in" id="clPers"><option value="g">' + esc(W.moi) + '</option><option value="s"' + (encours.choix.p === 's' ? ' selected' : '') + '>' + esc(W.autre) + '</option></select></label>';
        h += '<pre class="cl-ap">' + esc(CL().apercu(T, encours.entree)) + '</pre>' +
          '<button type="button" class="sh-go" data-cl="envoyer">Envoyer à Claude</button><div class="row center"><button type="button" class="btn" data-fermer>Annuler</button></div>';
      } else if (encours.etape === 'resultat') {
        const r = encours.reponse;
        h += '<p class="muted">Coût réel : ' + esc(CL().dollars(r.dollars)) + ' (' + r.jetons.entree + ' jetons envoyés, ' + r.jetons.sortie + ' reçus).</p>';
        if (T === 'analyse') h += '<div class="ai-out">' + esc(r.texte) + '</div><div class="row center"><button type="button" class="btn primary" data-fermer>Fermer</button></div>';
        else {
          h += '<p>Vérifie ce que Claude a lu avant de l\'enregistrer :</p><dl class="op-det">' + Object.keys(r.resultat).map(k => '<dt>' + esc(CL().libelle(k)) + '</dt><dd>' + esc(CL().valeur(r.resultat[k])) + '</dd>').join('') + '</dl>';
          if (T === 'avis') h += '<label class="inline"><input type="checkbox" id="clInv"> le déclarant 1 est ' + esc(W.autre) + ' (sinon ' + esc(W.moi) + ')</label>';
          if (T === 'appel') {
            const cps = Object.keys((s.budget && s.budget.appels) || {}).filter(k => k !== 'mails' && k !== 'pdfs');
            if (cps.length > 1) h += '<label class="sh-l"><span class="sh-lab">Copropriété</span><select class="sh-in" id="clCp">' + cps.map(k => '<option value="' + esc(k) + '">' + esc(s.budget.appels[k].lab || k) + '</option>').join('') + '</select></label>';
          }
          h += '<button type="button" class="sh-go" data-cl="enregistrer">Enregistrer</button><div class="row center"><button type="button" class="btn" data-fermer>Ne pas enregistrer</button></div>';
        }
      }
      $('claudeCorps').innerHTML = h;
    }
    A.preparer.secClaude = o => { if (!o || !o.rendu) renderClaude(); };
    $('claudeCorps').addEventListener('click', ev => {
      const b = ev.target.closest('[data-cl]'); if (!b || !encours) return;
      const s = S(), E = reglage(s, 'claude'), T = encours.tache.split(':')[0];
      if (b.dataset.cl === 'envoyer') {
        if ($('clPers')) encours.choix.p = $('clPers').value;
        A.busy(b, async () => {
          const r = await CL().demander(g.fetch.bind(g), s.cle.claude, T, encours.entree, E.modele);
          A.log('info', 'Claude : ' + TITRES[T].toLowerCase() + ' (' + r.jetons.entree + ' + ' + r.jetons.sortie + ' jetons).');
          encours.reponse = r; encours.etape = 'resultat';
          if (T === 'analyse') { analyses[encours.tache.split(':')[1]] = r.texte; A.rendre(); }
          renderClaude();
        });
        return;
      }
      if (b.dataset.cl === 'enregistrer') {
        try { enregistrer(s, T, encours); } catch (e) { A.toast(e.message, true); return; }
        A.fermerVolet(); encours = null;
      }
    });
    function enregistrer(s, T, e) {
      const D = KB().donnees(s), R = e.reponse.resultat;
      if (T === 'bulletin') {
        const f = D.fisc = D.fisc || { avis: {}, bs: {}, hyp: Object.assign({}, KF().HYP0), soldeBy: {} };
        const avant = JSON.stringify(f.bs || {});
        const b = CL().versBulletin(R, e.choix.p, Date.now());
        f.bs = f.bs || {}; f.bs['c' + Date.now().toString(36)] = b;
        A.log('ok', 'Bulletin de paie lu par Claude et enregistré.');
        A.changed('budget');
        A.toastAnnuler('Bulletin de ' + b.m.slice(5, 7) + '/' + b.m.slice(0, 4) + ' enregistré.', () => { KB().donnees(S()).fisc.bs = JSON.parse(avant); A.changed('budget'); });
      } else if (T === 'avis') {
        const f = D.fisc = D.fisc || { avis: {}, bs: {}, hyp: Object.assign({}, KF().HYP0), soldeBy: {} };
        const avant = JSON.stringify(f.avis || {});
        const a = CL().versAvis(R, $('clInv') && $('clInv').checked);
        if (!(a.rev > 2000 && a.rev < 2100)) throw new Error('Année des revenus illisible sur l\'avis.');
        f.avis = f.avis || {}; f.avis[a.rev] = a;
        A.log('ok', 'Avis d\'impôt lu par Claude et enregistré.');
        A.changed('budget');
        A.toastAnnuler('Avis des revenus ' + a.rev + ' enregistré.', () => { KB().donnees(S()).fisc.avis = JSON.parse(avant); A.changed('budget'); });
      } else if (T === 'appel') {
        const avant = JSON.stringify(D.appels || null);
        const cps = Object.keys(D.appels || {}).filter(k => k !== 'mails' && k !== 'pdfs');
        const p = CL().versAppel(R, $('clCp') ? $('clCp').value : cps[0] || null, e.entree.nom);
        const A0 = D.appels = D.appels || {};
        A0.pdfs = (A0.pdfs || []).filter(x => !(x.name === p.name && x.d === p.d)).concat([p]);
        A.log('ok', 'Appel de fonds lu par Claude et enregistré.');
        A.changed('appels');
        A.toastAnnuler('Appel de fonds du ' + p.d.split('-').reverse().join('/') + ' enregistré.', () => { ML().annuler(S(), avant); A.changed('appels'); });
      }
    }
    async function lireDocument(tache, btn) {
      const s = S(); if (!s || !actif(s, 'claude')) return;
      await A.busy(btn, async () => {
        const o = await A.hooks().choisirOctets('application/pdf');
        if (o == null) return;
        if (!(o[0] === 0x25 && o[1] === 0x50 && o[2] === 0x44 && o[3] === 0x46)) throw new Error('Ce fichier n\'est pas un PDF.');
        if (o.length > 20 * 1024 * 1024) throw new Error('PDF trop lourd (20 Mo au plus).');
        ouvrir(tache, { pdf: g.KladCoffre.toB64(o), nom: tache === 'bulletin' ? 'bulletin.pdf' : tache === 'avis' ? 'avis.pdf' : 'appel.pdf' });
      });
    }
    function analyser(scope) {
      const s = S(), B = A.budget(); if (!s || !B || !actif(s, 'claude')) return;
      let texte;
      try { texte = agregats(B, scope); } catch (e) { A.toast('Données insuffisantes pour une analyse.', true); return; }
      ouvrir('analyse:' + scope, { texte });
    }

    // crochets utilisés par les écrans
    g.KladExtras = {
      actif, agregats, etatMail: s => (actif(s, 'mail') ? ML().etat(s) : ''),
      analyse: scope => analyses[scope] || '', analyser, lireDocument: (t, btn) => lireDocument(t, btn), lireMails,
      resume: s => ['Mail ' + (ex(s).mail && ex(s).mail.on ? 'activé' : 'désactivé'), 'Claude ' + (ex(s).claude && ex(s).claude.on ? 'activé' : 'désactivé')].join(' · ')
    };
  }

  // Sans l'appli (tests) : seules les fonctions de calcul sont disponibles.
  g.KladExtras = { actif, agregats, etatMail: () => '', analyse: () => '', analyser: () => {}, lireDocument: () => {}, lireMails: () => {}, resume: () => '' };
  if (g.document && g.KladApp) init(g.KladApp);
})(typeof window !== 'undefined' ? window : globalThis);
