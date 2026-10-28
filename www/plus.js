// Klad — onglet « Plus » : réglages des comptes (libellé, rôle, carte à débit différé, comptes manuels, ordre, masquer)
// et import de la reprise (aperçu, association des comptes, confirmation).
(function () {
  'use strict';

  const A = window.KladApp;
  const M = window.KladModele;
  const F = window.KladFormat;
  const R = window.KladReprise;
  const Vu = window.KladVues;
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
        '<span class="ordre"><button class="btn ghost small" data-haut="' + esc(c.id) + '"' + (i ? '' : ' disabled') + ' aria-label="Monter">↑</button>' +
        '<button class="btn ghost small" data-bas="' + esc(c.id) + '"' + (i < list.length - 1 ? '' : ' disabled') + ' aria-label="Descendre">↓</button></span></li>';
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
      (c && c.aReassocier ? '<p class="note">Compte non retrouvé au dernier renouvellement : son historique est gardé ; il sera réassocié s\'il réapparaît à une prochaine connexion.</p>' : '') +
      '<label>Libellé court<input id="fLibelle" maxlength="24" autocomplete="off" value="' + esc(c ? c.libelle : '') + '"></label>' +
      '<label>Rôle<select id="fRole">' + optionsRoles(role) + '</select></label>' +
      '<div id="fPrel" class="grp"><label>Prélevé sur<select id="fPrelCompte">' + optAutres(p.compte) + '</select></label>' +
      '<label id="fJourL">Le (jour du mois)<input id="fJour" type="number" min="1" max="31" inputmode="numeric" value="' + esc(p.jour || '') + '"></label></div>' +
      (manuel ? '<div class="grp"><label>Solde<input id="fSolde" inputmode="decimal" autocomplete="off" placeholder="0,00" value="' +
        esc(c && c.solde ? F.versSaisie(c.solde.centimes) : '') + '"></label>' +
        '<label>Sens<select id="fSens"><option value="cre">créditeur</option><option value="deb"' + (c && c.solde && c.solde.centimes < 0 ? ' selected' : '') + '>débiteur</option></select></label>' +
        '<label>Date du solde<input id="fSoldeDate" type="date" value="' + esc(c && c.solde ? c.solde.date : M.jourLocal(Date.now())) + '"></label></div>' : soldeTypes) +
      '<label class="inline"><input id="fMasque" type="checkbox"' + (c && c.masque ? ' checked' : '') + '> Masquer ce compte</label>' +
      '<p class="msg bad" id="fMsg"></p>' +
      '<div class="row"><button class="btn" data-a="ok">Enregistrer</button>' +
      (c && manuel ? '<span class="grow"></span><button class="btn danger small" data-a="del">Supprimer</button>' : '') + '</div>';
    majPrel();
  }

  const NOMS_SOLDES = { CLBD: 'Comptable', ITAV: 'Disponible', XPCD: 'Prévisionnel', ITBD: 'Intrajournalier', CLAV: 'Disponible (clôture)', OPBD: 'Ouverture', PRCD: 'Veille', INFO: 'Info', OTHR: 'Autre' };

  function majPrel() {
    const r = $('fRole') && $('fRole').value;
    if (!r) return;
    $('fPrel').hidden = r !== 'carte_differee' && r !== 'paiement_en_ligne';
    $('fJourL').hidden = r !== 'carte_differee';
  }

  $('formCompte').addEventListener('change', ev => { if (ev.target.id === 'fRole') majPrel(); });
  $('formCompte').addEventListener('click', ev => {
    const b = ev.target.closest('[data-a]');
    if (!b) return;
    if (b.dataset.a === 'ok') enregistrer();
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
      if (!cpt) { msg.textContent = 'Choisissez le compte sur lequel ' + (role === 'carte_differee' ? 'la carte est prélevée.' : 'les paiements sont prélevés.'); return; }
      prel = { compte: cpt };
      if (role === 'carte_differee') {
        const j = parseInt($('fJour').value, 10);
        if (!(j >= 1 && j <= 31)) { msg.textContent = 'Indiquez le jour du prélèvement (1 à 31).'; return; }
        prel.jour = j;
      }
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
      '<ul class="list">' + lignes + '</ul>' +
      '<label class="inline"><input id="repReglages" type="checkbox" checked> Reprendre libellés, rôles et rattachements de l\'ancienne version</label>' +
      (S().modele.reprise ? '<p class="note">Les opérations de la reprise précédente seront remplacées.</p>' : '') +
      '<p class="msg bad" id="repMsg"></p><div class="row"><button class="btn" data-a="importer">Importer</button></div>';
  }

  $('repriseApercu').addEventListener('click', ev => {
    const b = ev.target.closest('[data-a="importer"]');
    if (!b || !rep) return;
    const choix = {};
    $('repriseApercu').querySelectorAll('[data-ref]').forEach(s => { choix[s.dataset.ref] = s.value; });
    try {
      const st = R.appliquer(S(), rep, choix, { reglages: $('repReglages').checked, now: Date.now() });
      A.log('ok', 'Reprise importée : ' + st.comptes + ' compte(s) dont ' + st.crees + ' créé(s), ' + st.operations + ' opération(s), ' +
        st.ebRetirees + ' opération(s) bancaire(s) avant la frontière retirée(s), ' + st.ignores + ' compte(s) ignoré(s).');
      A.toast('Reprise importée : ' + st.operations + ' opération(s).');
      rep = null;
      $('repriseApercu').innerHTML = '';
      A.changed('import');
    } catch (e) {
      $('repMsg').textContent = e.message;
    }
  });
})();
