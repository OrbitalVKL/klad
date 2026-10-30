// Klad — onglet « Plus » : réglages des comptes (libellé, rôle, carte à débit différé, comptes manuels, ordre, masquer)
// et import de la reprise (aperçu, association des comptes, confirmation).
(function () {
  'use strict';

  const A = window.KladApp;
  const M = window.KladModele;
  const F = window.KladFormat;
  const R = window.KladReprise;
  const Vu = window.KladVues;
  const KC = window.KladClasse;
  const CN = window.KladCarnet;
  const U = window.KladUI;
  const $ = id => document.getElementById(id);
  const esc = Vu.esc;
  const S = () => A.etat();

  const optionsRoles = v => M.ROLES.map(r => '<option value="' + r + '"' + (r === v ? ' selected' : '') + '>' + esc(Vu.ROLES[r]) + '</option>').join('');

  // ------------------------------------------------------------ liste des comptes
  function renderComptes() {
    const now = Date.now();
    const list = M.comptesTries(S());
    $('listeComptes').innerHTML = list.length ? list.map((c, i) => {
      const s = M.soldeAffiche(S(), c);
      const cx = c.source.type === 'eb' ? S().modele.connexions[c.source.connexion] : null;
      const info = [Vu.ROLES[c.role], c.source.type === 'eb' ? ((cx ? cx.banque : 'banque déconnectée') + (c.source.fin4 ? ' · …' + c.source.fin4 : '')) : 'manuel',
        c.masque ? 'masqué' : '', c.aVerifier ? 'à vérifier' : '', c.aReassocier ? 'à réassocier' : ''].filter(Boolean).join(' · ');
      const al = M.alerteCompte(S(), c, now);
      return '<li><button class="grow lien-compte" data-edit="' + esc(c.id) + '"><b>' + esc(c.libelle) + '</b>' +
        '<small' + (c.aVerifier || c.aReassocier ? ' class="bad"' : '') + '>' + esc(info) + '</small>' +
        (s ? Vu.solde(s.centimes, c.devise) : '') + (al && c.source.type === 'eb' ? '<small class="muted">' + esc(al) + '</small>' : '') + '</button>' +
        '<span class="ordre"><button class="btn small" data-haut="' + esc(c.id) + '"' + (i ? '' : ' disabled') + ' aria-label="Monter">↑</button>' +
        '<button class="btn small" data-bas="' + esc(c.id) + '"' + (i < list.length - 1 ? '' : ' disabled') + ' aria-label="Descendre">↓</button></span></li>';
    }).join('') : '<li class="muted">Aucun compte : connectez une banque, importez une reprise ou ajoutez un compte manuel.</li>';
  }

  $('listeComptes').addEventListener('click', ev => {
    const e = ev.target.closest('[data-edit]');
    if (e) { A.ouvrirVolet('secCompte', { empiler: true, id: e.dataset.edit, titre: 'Compte' }); return; }
    const h = ev.target.closest('[data-haut]'), b = ev.target.closest('[data-bas]');
    if (!h && !b) return;
    const list = M.comptesTries(S());
    const i = list.findIndex(c => c.id === (h ? h.dataset.haut : b.dataset.bas));
    const j = h ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= list.length) return;
    list.splice(j, 0, list.splice(i, 1)[0]);
    list.forEach((c, k) => { c.ordre = k; });
    A.changed('reglage');
  });

  $('btnNouveauManuel').addEventListener('click', () => {
    A.ouvrirVolet('secCompte', { empiler: true, id: null, titre: 'Nouveau compte manuel' });
  });

  A.preparer.secComptes = () => renderComptes();

  // ------------------------------------------------------------ fiche d'un compte
  let edite = null;          // id du compte affiché (null : nouveau compte manuel)
  A.preparer.secCompte = o => {
    if (o.rendu) return;     // ne pas effacer une saisie en cours à chaque rendu
    edite = o.id || null;
    renderFiche();
  };

  function renderFiche() {
    const c = edite ? M.compte(S(), edite) : null;
    if (edite && !c) { A.retourVolet(); return; }
    const role = c ? c.role : 'epargne';
    const manuel = !c || c.source.type === 'manuel';
    const autres = M.comptesTries(S()).filter(x => !c || x.id !== c.id);
    const optAutres = sel => '<option value="">—</option>' + autres.map(x => '<option value="' + esc(x.id) + '"' + (x.id === sel ? ' selected' : '') + '>' + esc(x.libelle) + '</option>').join('');
    const p = (c && c.prelevement) || {};
    let soldeTypes = '';
    if (c && !manuel) {
      const types = Object.keys((S().soldes[c.id] && S().soldes[c.id].types) || {});
      soldeTypes = '<label>Solde affiché<select id="fSoldeType"><option value="">Automatique (comptable, sinon disponible)</option>' +
        types.map(t => '<option value="' + esc(t) + '"' + (t === c.soldeType ? ' selected' : '') + '>' + esc(NOMS_SOLDES[t] || t) + '</option>').join('') + '</select></label>';
    }
    const cx = c && !manuel ? S().modele.connexions[c.source.connexion] : null;
    $('formCompte').innerHTML =
      (c && !manuel ? '<p class="muted">' + esc((cx ? cx.banque : 'Banque déconnectée') + (c.source.intitule ? ' · ' + c.source.intitule : '') + (c.source.fin4 ? ' · …' + c.source.fin4 : '')) + '</p>' : '') +
      (c && c.aReassocier ? '<p class="note">Compte non retrouvé au dernier renouvellement : son historique est gardé ; il sera réassocié s\'il réapparaît à une prochaine connexion, ' +
        'ou à la main ci-dessous.</p>' + blocReassocier(c) : '') +
      '<label>Libellé court<input id="fLibelle" maxlength="24" autocomplete="off" value="' + esc(c ? c.libelle : '') + '"></label>' +
      '<label>Rôle<select id="fRole">' + optionsRoles(role) + '</select></label>' +
      '<div id="fPrel"><div class="grp"><label><span id="fPrelLab">Prélevé sur</span><select id="fPrelCompte">' + optAutres(p.compte) + '</select></label>' +
      '<label id="fJourL">Le (jour du mois)<input id="fJour" type="number" min="1" max="31" inputmode="numeric" value="' + esc(p.jour || '') + '"></label></div>' +
      '<label><span id="fMotifLab">Libellé du prélèvement</span><input id="fMotif" autocomplete="off" spellcheck="false" maxlength="200" placeholder="mot du libellé" value="' + esc(p.motif || '') + '"></label>' +
      '<div id="fProps" class="puces"></div>' +
      '<label id="fRembL">Libellés des remboursements de la carte (facultatif)<input id="fRemb" autocomplete="off" spellcheck="false" maxlength="200" value="' + esc(p.remboursements || '') + '"></label>' +
      '<p class="muted small">Plusieurs libellés : séparez-les par « | ». Sans majuscules ni accents obligatoires.</p>' +
      (c && c.role === 'carte_differee' ? etatDette(c) : '') + '</div>' +
      (manuel ? '<div class="grp"><label>Solde<input id="fSolde" inputmode="decimal" autocomplete="off" placeholder="0,00" value="' +
        esc(c && c.solde ? F.versSaisie(c.solde.centimes) : '') + '"></label>' +
        '<label>Sens<select id="fSens"><option value="cre">créditeur</option><option value="deb"' + (c && c.solde && c.solde.centimes < 0 ? ' selected' : '') + '>débiteur</option></select></label>' +
        '<label>Date du solde<input id="fSoldeDate" type="date" value="' + esc(c && c.solde ? c.solde.date : M.jourLocal(Date.now())) + '"></label></div>' : soldeTypes) +
      '<label class="inline"><input id="fMasque" type="checkbox"' + (c && c.masque ? ' checked' : '') + '> Masquer ce compte</label>' +
      (c && manuel && window.KladReleve ? '<details class="adv"><summary>Importer un relevé (CSV ou JSON)</summary><p class="muted small">' + esc(TEXTE_RELEVE[KR().FORMATS[c.role] || 'banque']) +
        ' Les opérations déjà présentes sont ignorées ; l\'import est annulable.</p><div class="row"><button class="btn small" data-a="releve">Choisir le fichier</button></div></details>' : '') +
      '<p class="msg bad" id="fMsg"></p>' +
      '<div class="row"><button class="btn primary" data-a="ok">Enregistrer</button>' +
      (c && manuel ? '<span class="grow"></span><button class="btn danger small" data-a="del">Supprimer</button>' : '') + '</div>';
    majPrel();
  }

  const KR = () => window.KladReleve;
  const TEXTE_RELEVE = {
    banque: 'Relevé bancaire : colonnes Date, Libellé, puis Débit et Crédit ou Montant.',
    carte: 'Relevé de carte : colonnes Date, Description, Montant (dépenses en positif) ; les règlements de la carte sont écartés.',
    portefeuille: 'Historique de paiement en ligne : colonnes Date, Nom, Type, Net ; virements, approvisionnements et retenues écartés.'
  };
  A.importerReleve = cid => importerReleve(cid);
  async function importerReleve(cid) {
    const h = A.hooks();
    const octets = h.choisirOctets ? await h.choisirOctets() : null;     // CSV, JSON ou classeur Excel (.xlsx)
    if (octets == null) return;
    const c = M.compte(S(), cid);
    if (!c) return;
    const lu = await KR().lireFichier(octets, c.role, M.jourLocal(Date.now()));
    if (!lu.entete) throw new Error('Aucune colonne « Date » reconnue : ce fichier n\'est pas un relevé lisible.');
    if (!lu.lignes.length) throw new Error('Aucune opération lisible dans ce fichier' + (lu.stats.dateIllisible ? ' (' + lu.stats.dateIllisible + ' date(s) illisible(s))' : '') + '.');
    const r = KR().integrer(S(), cid, lu.lignes, Date.now());
    A.log('info', 'Relevé importé dans un compte manuel : ' + r.ajoutees.length + ' opération(s) ajoutée(s), ' + r.doublons + ' déjà présente(s).');
    A.changed('import');
    let msg = r.ajoutees.length ? r.ajoutees.length + ' opération(s) ajoutée(s), du ' + F.date(r.du) + ' au ' + F.date(r.au) + '.' : 'Toutes les opérations étaient déjà présentes : rien à ajouter.';
    if (r.doublons && r.ajoutees.length) msg += ' ' + r.doublons + ' déjà présente(s).';
    if (lu.stats.ecartees) msg += ' ' + lu.stats.ecartees + ' ligne(s) de règlement ou de virement écartée(s).';
    if (lu.stats.dateIllisible) msg += ' ' + lu.stats.dateIllisible + ' date(s) illisible(s).';
    if (r.ajoutees.length) A.toastAnnuler(msg, () => { KR().retirer(S(), cid, r.ajoutees); A.changed('import'); });
    else A.toast(msg);
  }

  const NOMS_SOLDES = { CLBD: 'Comptable', ITAV: 'Disponible', XPCD: 'Prévisionnel', ITBD: 'Intrajournalier', CLAV: 'Disponible (clôture)', OPBD: 'Ouverture', PRCD: 'Veille', INFO: 'Info', OTHR: 'Autre' };

  function majPrel() {
    const r = $('fRole') && $('fRole').value;
    if (!r) return;
    const carte = r === 'carte_differee';
    $('fPrel').hidden = !carte && r !== 'paiement_en_ligne';
    $('fJourL').hidden = !carte;
    $('fRembL').hidden = !carte;
    $('fPrelLab').textContent = carte ? 'Prélevée sur' : 'Prélevé sur (facultatif)';
    $('fMotifLab').textContent = carte ? 'Libellé du prélèvement de la carte' : 'Libellé des prélèvements du portefeuille';
    majProps();
  }
  // Motifs proposés : débits récurrents du compte de prélèvement (ou des comptes courants).
  function majProps() {
    const c = edite ? M.compte(S(), edite) : null;
    const el = $('fProps');
    if (!el) return;
    const tmp = { prelevement: { compte: $('fPrelCompte').value } };
    const props = c ? KC.propositions(S(), tmp) : [];
    el.innerHTML = props.length ? '<span class="muted small">Proposés :</span>' + props.map(p => '<button type="button" class="puce" data-motif="' + esc(p.motif) + '">' +
      esc(p.motif) + ' <b>' + p.n + '</b></button>').join('') : '';
  }
  function etatDette(c) {
    const d = KC.dette(S(), c, Date.now());
    if (!d) return '<p class="note">Choisissez le libellé du prélèvement de la carte : Klad en déduit la somme à prélever.</p>';
    return '<p class="muted">À prélever' + (d.le ? ' le ' + esc(F.date(d.le)) : '') + ' : <b>' + esc(F.montant(d.centimes, c.devise)) + '</b> (' + d.n + ' opération(s)' +
      (d.depuis ? ' depuis le règlement du ' + esc(F.date(d.depuis)) : ', aucun règlement trouvé') + ').</p>';
  }

  // ------------------------------------------------------------ réassociation manuelle
  function blocReassocier(c) {
    const dispo = M.disponibles(S(), c.id);
    if (!dispo.length) return '<p class="muted">Aucun compte bancaire disponible : connectez ou renouvelez la banque, puis revenez ici.</p>';
    return '<div class="grp"><label>Réassocier à<select id="fReass">' + dispo.map(x => '<option value="' + esc(x.id) + '">' + esc(x.libelle +
      (x.source.fin4 ? ' (…' + x.source.fin4 + ')' : '') + (x.aVerifier ? ' — nouveau' : '')) + '</option>').join('') + '</select></label></div>' +
      '<p class="muted small">Le compte choisi est fusionné dans celui-ci : ses opérations et ses soldes le rejoignent, sans doublon.</p>' +
      '<div class="row"><button class="btn primary small" data-a="reass">Réassocier</button></div>';
  }

  $('formCompte').addEventListener('change', ev => { if (ev.target.id === 'fRole') majPrel(); if (ev.target.id === 'fPrelCompte') majProps(); });
  $('formCompte').addEventListener('click', ev => {
    const m = ev.target.closest('[data-motif]');
    if (m) { $('fMotif').value = m.dataset.motif; return; }
    const b = ev.target.closest('[data-a]');
    if (!b) return;
    if (b.dataset.a === 'ok') enregistrer();
    else if (b.dataset.a === 'releve') { const id = edite; A.busy(b, () => importerReleve(id)); }
    else if (b.dataset.a === 'reass') {
      const cible = $('fReass').value;
      const n = M.compte(S(), cible);
      if (!n || !A.confirmInline(b, 'Fusionner « ' + n.libelle + ' » ici ?')) return;
      try {
        const r = M.reassocier(S(), edite, cible);
        A.log('ok', 'Compte réassocié à la main : ' + r.deplacees + ' opération(s) reprise(s), ' + r.doublons + ' doublon(s) écarté(s).');
        A.toast('Compte réassocié.');
        A.retourVolet();
        A.changed('reglage');
        A.synchro('reassociation');
      } catch (e) { A.toast(e.message, true); }
    }
    else if (b.dataset.a === 'del' && A.confirmInline(b, 'Supprimer ce compte et ses opérations ?')) {
      M.supprimerCompte(S(), edite);
      A.log('info', 'Compte manuel supprimé.');
      A.retourVolet();
      A.changed('reglage');
    }
  });

  function enregistrer() {
    const msg = $('fMsg');
    const libelle = $('fLibelle').value.trim();
    if (!libelle) { msg.textContent = 'Donnez un libellé au compte.'; return; }
    const role = $('fRole').value;
    let prel = null;
    if (role === 'carte_differee' || role === 'paiement_en_ligne') {
      const cpt = $('fPrelCompte').value;
      if (!cpt && role === 'carte_differee') { msg.textContent = 'Choisissez le compte sur lequel la carte est prélevée.'; return; }
      prel = {};
      if (cpt) prel.compte = cpt;
      if (role === 'carte_differee') {
        const j = parseInt($('fJour').value, 10);
        if (!(j >= 1 && j <= 31)) { msg.textContent = 'Indiquez le jour du prélèvement (1 à 31).'; return; }
        prel.jour = j;
        const rb = $('fRemb').value.trim();
        if (rb) prel.remboursements = rb.slice(0, 200);
      }
      const mo = $('fMotif').value.trim();
      if (mo) prel.motif = mo.slice(0, 200);
    }
    let c = edite ? M.compte(S(), edite) : null;
    let solde;
    if (!c || c.source.type === 'manuel') {
      const txt = $('fSolde').value.trim();
      if (txt) {
        const v = F.saisie(txt);
        if (v == null) { msg.textContent = 'Solde illisible : saisissez un montant positif, puis choisissez le sens.'; return; }
        const d = $('fSoldeDate').value;
        if (!M.dateValide(d)) { msg.textContent = 'Date du solde invalide.'; return; }
        solde = { centimes: $('fSens').value === 'deb' ? -v : v, date: d };
      } else solde = null;
    }
    if (!c) c = M.nouveauCompte(S(), { source: { type: 'manuel' } });
    c.libelle = libelle.slice(0, 24);
    c.role = role;
    if (prel) c.prelevement = prel; else delete c.prelevement;
    if (solde !== undefined) { if (solde) c.solde = solde; else delete c.solde; }
    if ($('fSoldeType')) { if ($('fSoldeType').value) c.soldeType = $('fSoldeType').value; else delete c.soldeType; }
    c.masque = $('fMasque').checked;
    delete c.aVerifier;
    A.log('info', edite ? 'Compte mis à jour.' : 'Compte manuel ajouté.');
    A.toast('Compte enregistré.');
    A.retourVolet();
    A.changed('reglage');
  }

  // ------------------------------------------------------------ import de la reprise
  let rep = null;
  function renderRepriseEtat() {
    const r = S().modele.reprise;
    $('repriseEtat').textContent = r
      ? 'Dernier import le ' + F.date(r.importee.slice(0, 10)) + ' : ' + r.nb + ' opération(s)' + (r.creee ? ', fichier du ' + F.date(r.creee.slice(0, 10)) : '') + '.'
      : 'Aucune reprise importée.';
  }
  A.preparer.secReprise = o => {
    renderRepriseEtat();
    if (!o.rendu) { rep = null; $('repriseApercu').innerHTML = ''; }
  };

  $('btnChoisirReprise').addEventListener('click', ev => A.busy(ev.target, async () => {
    const h = A.hooks();
    const texte = h.choisirFichier ? await h.choisirFichier() : null;
    if (texte == null) return;
    try { rep = R.lire(texte); }
    catch (e) {
      rep = null;
      $('repriseApercu').innerHTML = '<p class="bad">' + esc(e.message) + '</p>';
      A.log('err', 'Reprise refusée : ' + e.message);
      return;
    }
    A.log('info', 'Reprise lue : ' + rep.comptes.length + ' compte(s), ' + rep.nb + ' opération(s).');
    renderApercu();
  }));

  function renderApercu() {
    const choix = R.proposer(rep, S());
    const comptes = M.comptesTries(S());
    const opts = sel => comptes.map(c => '<option value="' + esc(c.id) + '"' + (c.id === sel ? ' selected' : '') + '>' + esc(c.libelle) +
      (c.source.type === 'eb' && c.source.fin4 ? ' (…' + esc(c.source.fin4) + ')' : '') + '</option>').join('') +
      '<option value="creer"' + (sel === 'creer' ? ' selected' : '') + '>Créer un compte manuel</option>' +
      '<option value="ignorer">Ignorer ce compte</option>';
    const lignes = R.apercu(rep).map(a =>
      '<li class="assoc"><div><b>' + esc(a.label) + '</b><small>' + esc(Vu.ROLES[a.role]) + ' · ' + a.n + ' opération(s)' +
      (a.n ? ' du ' + F.date(a.debut) + ' au ' + F.date(a.fin) : '') + '</small></div>' +
      '<label>Vers<select data-ref="' + esc(a.ref) + '">' + opts(choix[a.ref]) + '</select></label></li>').join('');
    $('repriseApercu').innerHTML = '<h3>Aperçu</h3><p class="muted">Fichier ' + (rep.created ? 'du ' + F.date(rep.created.slice(0, 10)) : 'sans date') +
      ' · ' + rep.nb + ' opération(s). Associez chaque compte de la reprise à un compte Klad.</p>' +
      '<ul class="list">' + lignes + '</ul>' + '<p class="note" id="repIgnores" hidden></p>' +
      '<label class="inline"><input id="repReglages" type="checkbox" checked> Reprendre libellés, rôles et rattachements de l\'ancienne version</label>' +
      (S().modele.reprise ? '<p class="note">Les opérations de la reprise précédente seront remplacées.</p>' : '') +
      '<p class="msg bad" id="repMsg"></p><div class="row"><button class="btn primary" data-a="importer">Importer</button></div>';
    // Valeur proposée appliquée explicitement à chaque sélecteur (sans dépendre de l'attribut « selected » au rendu,
    // vu ignoré sur le téléphone) ; un compte manuel sans correspondance est toujours « Créer un compte manuel ».
    $('repriseApercu').querySelectorAll('select[data-ref]').forEach(sel => {
      sel.value = choix[sel.dataset.ref];
      if (sel.value !== choix[sel.dataset.ref]) sel.value = 'creer';
    });
    majIgnores();
  }

  // Avant confirmation : nombre de comptes de la reprise qui seront ignorés ; avertissement pour un compte déjà repris
  // (ses opérations de reprise vont disparaître), avec la relecture de l'historique bancaire proposée.
  function choixCourants() {
    const choix = {};
    $('repriseApercu').querySelectorAll('select[data-ref]').forEach(s => { choix[s.dataset.ref] = s.value; });
    return choix;
  }
  function majIgnores() {
    const n = [...$('repriseApercu').querySelectorAll('select[data-ref]')].filter(sel => sel.value === 'ignorer').length;
    const el = $('repIgnores');
    if (!el) return;
    const deja = rep ? R.ignoresDejaRepris(S(), rep, choixCourants()) : [];
    el.hidden = !n;
    el.innerHTML = n ? esc(n + ' compte(s) ignoré(s) : ' + (n > 1 ? 'leurs' : 'ses') + ' opérations ne seront pas importées.') +
      deja.map(d => '<br><b>Attention</b> : « ' + esc(d.label) + ' » avait été repris au dernier import. Ses opérations de reprise seront retirées ' +
        'et l\'historique de ce compte aura un trou.' + (d.eb ? '<label class="inline"><input type="checkbox" data-relire="' + esc(d.compte) + '" checked> ' +
        'Relire tout l\'historique bancaire de ce compte après l\'import</label>' : '')).join('') : '';
  }
  $('repriseApercu').addEventListener('change', ev => { if (ev.target.matches('select[data-ref]')) majIgnores(); });

  $('repriseApercu').addEventListener('click', ev => {
    const b = ev.target.closest('[data-a="importer"]');
    if (!b || !rep) return;
    const choix = choixCourants();
    const deja = R.ignoresDejaRepris(S(), rep, choix);
    if (deja.length && !A.confirmInline(b, 'Confirmer : ' + deja.length + ' compte(s) déjà repris ignoré(s)')) return;
    const relire = [...$('repriseApercu').querySelectorAll('[data-relire]')].filter(x => x.checked).map(x => x.dataset.relire);
    const s0 = S();
    let st;
    try {
      st = R.appliquer(s0, rep, choix, { reglages: $('repReglages').checked, now: Date.now(), relire });
    } catch (e) {
      $('repMsg').textContent = e.message;
      return;
    }
    A.log('ok', 'Reprise importée : ' + st.comptes + ' compte(s) dont ' + st.crees + ' créé(s), ' + st.operations + ' opération(s), ' +
      st.ebRetirees + ' opération(s) bancaire(s) avant la frontière retirée(s), ' + st.ignores + ' compte(s) ignoré(s)' +
      (st.relire ? ', ' + st.relire + ' historique(s) bancaire(s) à relire' : '') + '.');
    A.toast('Reprise importée : ' + st.operations + ' opération(s).');
    rep = null;
    $('repriseApercu').innerHTML = '';
    // Budget, contrats et virements du carnet : repris s'ils ne l'ont pas encore été (les réglages faits dans Klad sont gardés).
    if (!s0.budget && s0.carnet != null && window.KladBudget) {
      try {
        const rb = window.KladBudget.importer(s0, s0.carnet, { now: Date.now(), renommer: CN.renommeur(s0.carnet) });
        A.log('ok', 'Budget repris de l\'ancienne version : ' + rb.postes + ' poste(s), ' + rb.contrats + ' contrat(s), ' + rb.virements + ' virement(s).');
      } catch (e) { A.log('err', 'Budget : ' + (e.message || e)); }
    }
    if (s0.budget && (s0.budget.v || 1) < 2 && s0.carnet != null && window.KladCommun) {
      try { window.KladCommun.importer(s0, s0.carnet); } catch (e) { A.log('err', 'Compte commun : ' + (e.message || e)); }
    }
    if (s0.budget && (s0.budget.v || 1) < 3 && s0.carnet != null && window.KladFisc) {
      try { window.KladFisc.importer(s0, s0.carnet); } catch (e) { A.log('err', 'Impôts : ' + (e.message || e)); }
    }
    A.changed('import');
    reprendreClassement(s0).then(() => { if (st.relire && A.etat() === s0) A.synchro('relecture'); });
  });

  // ------------------------------------------------------------ classement (Plus › Classement)
  async function reprendreClassement(s0) {
    if (s0.carnet == null || !CN.utilisable(s0.carnet)) return null;
    try {
      const r = await CN.convertir(s0, s0.carnet, { now: Date.now() });
      if (A.etat() !== s0) return null;
      A.log('ok', 'Classement repris de l\'ancienne version : ' + r.categories + ' catégorie(s), ' + r.base + ' règle(s) de base, ' + r.regles +
        ' règle(s), ' + r.correctionsRetrouvees + '/' + r.corrections + ' correction(s), ' + r.vuesRetrouvees + '/' + r.vues + ' opération(s) cochée(s).');
      A.changed('classement');
      return r;
    } catch (e) { A.log('err', 'Classement : ' + (e.message || e)); return null; }
  }

  let catEditee = null, ajoutCat = false;
  function renderClassement() {
    const s = S();
    const C = KC.donnees(s);
    const cx = A.ctx();
    const now = Date.now();
    const lim = M.plusJours(M.jourLocal(now), -365);
    const nb = {};
    for (const o of KC.opsVisibles(s)) if (o.date >= lim) { const r = KC.classer(cx, o); nb[r.cat] = (nb[r.cat] || 0) + 1; }
    const imp = C.import;
    const r = imp && imp.rapport;
    const cats = KC.listeCategories(C);
    const natOpts = v => KC.NATURES.map(n => '<option value="' + n + '"' + (n === v ? ' selected' : '') + '>' + esc(KC.NOMS_NATURES[n]) + '</option>').join('');
    const pl = (n, m) => n + ' ' + m + (n > 1 ? 's' : '');
    let h = '<p class="muted">' + (r ? 'Repris de l\'ancienne version le ' + esc(F.date(imp.le.slice(0, 10))) + ' : ' + pl(r.categories, 'catégorie') + ', ' +
      pl(r.base, 'règle') + ' de base, ' + pl(r.regles, 'règle') + ' personnelle' + (r.regles > 1 ? 's' : '') + ', ' + r.correctionsRetrouvees + ' correction(s) retrouvée(s) sur ' + r.corrections +
      (r.depuis ? ', opérations vues jusqu\'au ' + esc(F.date(r.depuis)) : '') + '.' : 'Aucun classement repris de l\'ancienne version.') + '</p>';
    h += '<div class="row">' + (s.carnet != null && CN.utilisable(s.carnet) ? '<button class="btn small" data-a="reprendre">Reprendre depuis l\'ancienne version</button>' : '') +
      '<button class="btn small" data-a="complement">Importer un complément</button></div>';
    // 0.10.7 : « Nouvelle catégorie » en haut de la section ; champs pleine largeur (aucun débordement à 130 %) ;
    // icône et couleur dans le sélecteur (volet du bas).
    h += '<h3>Catégories</h3>' +
      (ajoutCat ? '<div class="nc-form"><label class="sh-l"><span class="sh-lab">Nom de la nouvelle catégorie</span><input class="sh-in" id="ncNom" maxlength="40" autocomplete="off" placeholder="ex. Bien être"></label>' +
        '<label class="sh-l"><span class="sh-lab">Nature</span><select class="sh-in" id="ncNature">' + natOpts('optionnelle') + '</select></label>' +
        '<p class="muted small">Une icône est proposée d\'après le nom ; vous pourrez la changer ensuite.</p>' +
        '<div class="row"><button class="btn primary" data-a="nouvelle">Créer la catégorie</button><button class="btn" data-a="nc-annuler">Annuler</button></div></div>'
        : '<div class="row"><button class="btn primary" data-a="nc-ouvrir">+ Nouvelle catégorie</button></div>') +
      '<p class="muted small">Nombre d\'opérations sur 12 mois. Touchez une catégorie pour changer sa nature, son icône ou sa couleur.</p><ul class="list cats">' +
      cats.map(c => '<li><button class="lien-cat" data-cat="' + esc(c) + '" aria-expanded="' + (catEditee === c) + '">' + U.cico(C, c).replace('class="cico', 'class="cico ico') + '<span class="grow">' + esc(c) +
        '<small>' + esc(KC.NOMS_NATURES[KC.natureDe(C, c)]) + '</small></span><span class="muted">' + (nb[c] || 0) + '</span></button>' +
        (catEditee === c ? '<div class="edcat"><label class="sh-l"><span class="sh-lab">Nature</span><select class="sh-in" data-nature="' + esc(c) + '">' + natOpts(KC.natureDe(C, c)) + '</select></label>' +
          '<button type="button" class="btn ic-choisir" data-iconecat="' + esc(c) + '">' + U.cico(C, c) + ' Icône et couleur…</button></div>' : '') +
        '</li>').join('') + '</ul>';
    const regles = C.regles || [];
    h += '<h3>Vos règles</h3>' + (regles.length ? '<ul class="list">' + regles.map((u, i) => {
      const cpt = u.compte && M.compte(s, u.compte);
      const n = KC.concernees(s, u.mot, { compte: u.compte, sens: u.sens }).length;
      return '<li><div class="grow"><b>' + esc(u.mot) + '</b> → ' + esc(u.cat + (u.sub && u.sub !== u.cat ? ' › ' + u.sub : '')) +
        '<small>' + esc([cpt ? 'seulement ' + cpt.libelle : '', u.sens === 'debit' ? 'débits' : u.sens === 'credit' ? 'crédits' : '', n + ' opération(s)'].filter(Boolean).join(' · ')) +
        '</small></div><button class="btn danger small" data-suppr="' + i + '">Supprimer</button></li>';
    }).join('') + '</ul>' : '<p class="muted">Aucune règle. Classez une opération avec « Classer aussi les autres » pour en créer une.</p>');
    h += '<p class="muted small">' + (C.base || []).length + ' règle(s) de base, reprises de l\'ancienne version.</p>';
    $('classementCorps').innerHTML = h;
  }
  A.preparer.secClassement = () => renderClassement();
  A.rendus.push(() => {
    const C = S().classement;
    ($('mClassement') || {}).textContent = C ? KC.listeCategories(C).length + ' catégories, ' + (C.regles || []).length + ' règle(s)' : 'Catégories et règles';
  });

  $('classementCorps').addEventListener('change', ev => {
    const n = ev.target.closest('[data-nature]');
    if (!n) return;
    const C = KC.donnees(S());
    C.categories[n.dataset.nature] = Object.assign({}, C.categories[n.dataset.nature], { nature: n.value });
    A.changed('classement');
  });
  $('classementCorps').addEventListener('click', ev => {
    const s = S();
    const C = KC.donnees(s);
    const cat = ev.target.closest('[data-cat]');
    if (cat) { catEditee = catEditee === cat.dataset.cat ? null : cat.dataset.cat; renderClassement(); return; }
    const ic = ev.target.closest('[data-iconecat]');
    if (ic) { window.KladSelIcone.ouvrir(ic.dataset.iconecat); return; }
    const sup = ev.target.closest('[data-suppr]');
    if (sup) {
      if (!A.confirmInline(sup, 'Confirmer ?')) return;
      const avant = JSON.stringify(C.regles);
      C.regles.splice(+sup.dataset.suppr, 1);
      A.log('info', 'Règle de classement supprimée.');
      A.changed('classement');
      A.toastAnnuler('Règle supprimée.', () => { KC.donnees(s).regles = JSON.parse(avant); A.changed('classement'); });
      return;
    }
    const b = ev.target.closest('[data-a]');
    if (!b) return;
    if (b.dataset.a === 'nc-ouvrir' || b.dataset.a === 'nc-annuler') {
      ajoutCat = b.dataset.a === 'nc-ouvrir';
      renderClassement();
      if (ajoutCat) { const e = $('ncNom'); if (e) e.focus(); }
    } else if (b.dataset.a === 'nouvelle') {
      const nom = $('ncNom').value.trim().slice(0, 40);
      if (!nom) { A.toast('Indiquez un nom de catégorie.', true); return; }
      const k = KC.fold(nom);
      const dup = KC.listeCategories(C).find(c => KC.fold(c) === k);
      if (dup) { A.toast('La catégorie « ' + dup + ' » existe déjà.', true); return; }
      C.categories[nom] = { nature: $('ncNature').value, icone: KC.iconeDe(C, nom) };
      ajoutCat = false; catEditee = nom;
      A.log('info', 'Catégorie ajoutée.');
      A.changed('classement');
      window.KladSelIcone.ouvrir(nom);           // icône proposée d'après le nom : à confirmer ou changer
    } else if (b.dataset.a === 'reprendre') {
      if (!A.confirmInline(b, 'Confirmer : règles et corrections reprises à nouveau')) return;
      reprendreClassement(s).then(r => { if (r) A.toast('Classement repris : ' + r.base + ' règles de base, ' + r.regles + ' règles.'); });
    } else if (b.dataset.a === 'complement') {
      A.busy(b, async () => {
        const h = A.hooks();
        const texte = h.choisirFichier ? await h.choisirFichier() : null;
        if (texte == null) return;
        let o;
        try { o = JSON.parse(texte); } catch (e) { throw new Error('Fichier illisible (JSON attendu).'); }
        if (!o || o.format !== 'klad-complement' || o.v !== 1 || !o.klad || typeof o.klad !== 'object') throw new Error('Ce fichier n\'est pas un complément de classement Klad.');
        if (s.carnet == null || typeof s.carnet !== 'object') throw new Error('Importez d\'abord la reprise de l\'ancienne version.');
        s.carnet.klad = Object.assign({}, s.carnet.klad, o.klad);
        A.log('info', 'Complément de classement importé.');
        const r = await reprendreClassement(s);
        if (r) A.toast('Complément importé : ' + r.base + ' règles de base.');
      });
    }
  });

  // ------------------------------------------------------------ affichage : thème, palette et mode démo
  const AF = window.KladAffichage;
  function renderAffichage() {
    const t = AF.theme(), p = AF.palette(), d = AF.demoActif();
    $('affichageCorps').innerHTML = '<h3>Thème</h3><div class="seg" role="group" aria-label="Thème">' +
      [['auto', 'Automatique'], ['clair', 'Clair'], ['sombre', 'Sombre']].map(([k, l]) => '<button data-theme-choix="' + k + '" aria-pressed="' + (k === t) + '">' + l + '</button>').join('') + '</div>' +
      '<p class="muted small">Automatique : suit le réglage du téléphone. Gardé sur ce téléphone.</p>' +
      '<h3>Palette</h3><div class="seg" role="group" aria-label="Palette">' +
      [['klad', 'Klad'], ['grafit', 'Grafit']].map(([k, l]) => '<button data-palette-choix="' + k + '" aria-pressed="' + (k === p) + '">' + l + '</button>').join('') + '</div>' +
      '<p class="muted small">Klad : couleurs habituelles. Grafit : noir et rouge, comme l\'icône. Indépendante du thème, gardée sur ce téléphone.</p>' +
      '<h3>Mode démo</h3><p class="muted">Pour montrer l\'appli sans dévoiler vos chiffres : montants multipliés par un facteur pris au hasard, ' +
      'noms des personnes et des banques remplacés, champs de saisie floutés. Rien n\'est modifié dans vos données ; le mode s\'arrête en quittant ou en relançant Klad.</p>' +
      '<div class="row"><button class="btn' + (d ? ' ghost' : '') + ' small" data-demo="' + (d ? 'off' : 'on') + '">' + (d ? 'Quitter le mode démo' : 'Passer en mode démo') + '</button></div>';
  }
  A.preparer.secAffichage = () => renderAffichage();
  AF.surArret = () => { if ($('affichageCorps').isConnected) renderAffichage(); };
  $('affichageCorps').addEventListener('click', ev => {
    const t = ev.target.closest('[data-theme-choix]');
    if (t) { AF.choisirTheme(t.dataset.themeChoix); renderAffichage(); if (A.redessiner) A.redessiner(); return; }
    const p = ev.target.closest('[data-palette-choix]');
    if (p) { AF.choisirPalette(p.dataset.paletteChoix); renderAffichage(); if (A.redessiner) A.redessiner(); return; }
    const d = ev.target.closest('[data-demo]');
    if (!d) return;
    if (d.dataset.demo === 'on') { AF.demarrerDemo(S()); A.log('info', 'Mode démo activé.'); A.fermerVolet(); }
    else { AF.arreterDemo(); A.log('info', 'Mode démo arrêté.'); renderAffichage(); }
  });
})();
