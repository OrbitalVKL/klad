// Klad — onglet « Budget » : bascule Perso / Commun, navigation ◀ ▶ entre cycles, postes dépliables, édition d'un poste
// (volet du bas, annulable), ajout et retrait de postes, contrats et échéances, tendance, détail du reste à vivre.
(function () {
  'use strict';

  const A = window.KladApp;
  const KB = window.KladBudget;
  const VB = window.KladVuesBudget;
  const F = window.KladFormat;
  const $ = id => document.getElementById(id);
  const esc = A.esc;
  const S = () => A.etat();

  const KC = window.KladCommun;
  const VC = window.KladVuesCommun;
  const ui = { scope: 'perso', nav: null, ouverts: new Set(), cartes: new Set(), tendCat: '', ctrScope: 'perso', ctrEdit: null, edit: null, ajout: null, sim: {} };

  function render() {
    const B = A.budget();
    if (!B) { $('vBudget').innerHTML = ''; return; }
    try { $('vBudget').innerHTML = VB.ecran(B, ui.scope, ui.nav, ui); }
    catch (e) { $('vBudget').innerHTML = '<p class="muted">Budget indisponible.</p>'; A.log('err', 'Budget : ' + (e.message || e)); }
  }
  A.rendus.push(render);
  // cartes du compte commun : dépliées ou repliées, gardé d'un rendu à l'autre
  $('vBudget').addEventListener('toggle', ev => {
    const d = ev.target.closest && ev.target.closest('details[data-cc]');
    if (!d) return;
    if (d.open) ui.cartes.add(d.dataset.cc); else ui.cartes.delete(d.dataset.cc);
  }, true);

  function annulable(msg, snap) {
    A.changed('budget');
    A.toastAnnuler(msg, () => { KB.annuler(S(), snap); A.changed('budget'); });
  }

  $('vBudget').addEventListener('click', ev => {
    const t = ev.target;
    const sc = t.closest('[data-scope]');
    if (sc) { ui.scope = sc.dataset.scope; ui.nav = null; ui.ouverts.clear(); render(); return; }
    const nv = t.closest('[data-nav]');
    if (nv) {
      const per = KB.periode(A.budget(), ui.scope, ui.nav);
      const k = nv.dataset.nav;
      if (k === 'now') ui.nav = null;
      else if (k === 'prev' && per.prev) ui.nav = per.prev;
      else if (k === 'next' && per.next) ui.nav = per.next === 'courant' ? null : per.next;
      ui.ouverts.clear(); render(); $('defil').scrollTop = 0; return;
    }
    const ov = t.closest('[data-ouvrir]');
    if (ov) { if (ov.dataset.ouvrir === 'secContrats') ui.ctrScope = ui.scope; A.ouvrirVolet(ov.dataset.ouvrir); return; }
    const al = t.closest('[data-aligner]');
    if (al) {
      const snap = KB.modifier(S(), ui.scope, al.dataset.aligner, { on: true, amt: +al.dataset.v });
      A.log('info', 'Budget d\'un poste aligné.');
      annulable('Budget aligné sur ' + F.montant(+al.dataset.v) + '.', snap);
      return;
    }
    if (t.closest('[data-refdefaut]')) { choisirRef(null); return; }
    const at = t.closest('[data-alignertout]');
    if (at) {
      if (!A.confirmInline(at, 'Confirmer : tous les postes ?')) return;
      const r = KB.alignerTout(S(), A.budget(), at.dataset.alignertout);
      A.log('info', 'Budget : tous les postes alignés sur le réel habituel.');
      A.changed('budget');
      A.toastAnnuler(r.n + ' poste(s) alignés sur le réel habituel.', () => { KB.annulerAlignement(S(), at.dataset.alignertout, r.snap); A.changed('budget'); });
      return;
    }
    const ed = t.closest('[data-editer]');
    if (ed) { ui.edit = { scope: ui.scope, key: ed.dataset.editer }; A.ouvrirVolet('secPoste'); return; }
    const aj = t.closest('[data-ajout]');
    if (aj) { ui.ajout = { scope: ui.scope, nk: aj.dataset.ajout }; A.ouvrirVolet('secAjout'); return; }
    const op = t.closest('[data-op]');
    if (op) { A.ouvrirOp(op.dataset.c, op.dataset.op); return; }
    const p = t.closest('[data-poste]');
    if (p) { const k = p.dataset.poste; if (ui.ouverts.has(k)) ui.ouverts.delete(k); else ui.ouverts.add(k); render(); }
  });

  function choisirRef(m) {
    const avant = KB.choisirReference(S(), m);
    A.log('info', 'Budget : base de calcul modifiée.');
    A.changed('budget');
    A.toastAnnuler('Base de calcul : ' + (m ? 'depuis ' + KB.nomMois(m) : '6 derniers mois complets') + '.', () => { KB.annulerReference(S(), avant); A.changed('budget'); });
  }
  $('vBudget').addEventListener('change', ev => { if (ev.target.id === 'bRef') choisirRef(ev.target.value); });

  // ------------------------------------------------------------ volet : budget d'un poste
  A.preparer.secPoste = o => {
    if (o.rendu || !ui.edit) return;
    $('posteCorps').innerHTML = VB.edition(A.budget(), ui.edit.scope, ui.edit.key);
  };
  $('posteCorps').addEventListener('change', ev => {
    if (ev.target.id === 'peMode') { const a = $('peAmt'); if (a) a.disabled = ev.target.value !== 'libre'; }
  });
  $('posteCorps').addEventListener('click', ev => {
    const b = ev.target.closest('[data-pe]');
    if (!b || !ui.edit) return;
    const { scope, key } = ui.edit;
    const B = A.budget();
    if (b.dataset.pe === 'retirer') {
      if (!A.confirmInline(b, 'Confirmer ?')) return;
      const snap = KB.retirer(S(), scope, key);
      A.log('info', 'Poste retiré du budget.');
      A.fermerVolet();
      annulable('« ' + key.slice(2) + ' » retiré du budget.', snap);
      return;
    }
    const ch = {};
    const on = $('peOn');
    if (on) ch.on = on.checked;
    if (b.dataset.pe === 'aligner') {
      const a = KB.postes(B, scope).lignes.find(x => x.key === key);
      const per = +($('pePer') ? $('pePer').value : 1) || 1;
      ch.per = per; ch.amt = Math.round((a ? a.avg : 0) * per / 100) * 100; ch.on = true;
    } else if (key.startsWith('r|')) {
      const mode = $('peMode');
      if (mode) ch.mode = mode.value;
      if (!mode || mode.value === 'libre') {
        const v = $('peAmt').value.trim();
        const c = v ? F.saisie(v) : null;
        if (v && c == null) { A.toast('Montant illisible.', true); return; }
        ch.amt = c;
      }
    } else {
      const v = $('peAmt').value.trim();
      const c = v ? F.saisie(v) : null;
      if (v && c == null) { A.toast('Montant illisible.', true); return; }
      ch.amt = c;
      ch.per = +$('pePer').value || 1;
      if ($('pePg')) {
        const pg = parseFloat(String($('pePg').value).replace(',', '.'));
        if (!isNaN(pg)) ch.pg = pg;
        ch.elig = $('peElig').checked;
      }
    }
    const snap = KB.modifier(S(), scope, key, ch);
    A.log('info', 'Budget d\'un poste modifié.');
    A.fermerVolet();
    annulable('Budget « ' + key.slice(2) + ' » enregistré.', snap);
  });

  // ------------------------------------------------------------ volet : ajouter un poste
  A.preparer.secAjout = () => {
    if (!ui.ajout) return;
    const L = KB.ajoutables(A.budget(), ui.ajout.scope, ui.ajout.nk);
    $('ajoutCorps').innerHTML = '<p class="muted">' + esc(KB.NOMS[ui.ajout.nk]) + ' · ' + (ui.ajout.scope === 'commun' ? 'commun' : 'perso') + '</p>' +
      (L.length ? '<ul class="list">' + L.map(x => '<li><div class="grow">' + esc(x.label) + '</div><button class="btn small" data-aj="' + esc(x.key) + '">Ajouter</button></li>').join('') + '</ul>'
        : '<p class="muted">Aucun autre poste à ajouter.</p>') +
      (ui.ajout.nk === 'fixe' ? '<label>Nouveau poste fixe<input id="ajNom" maxlength="40" autocomplete="off" placeholder="ex. Salle de sport"></label><div class="row"><button class="btn small" data-aj="__nouveau">Créer</button></div>' : '');
  };
  $('ajoutCorps').addEventListener('click', ev => {
    const b = ev.target.closest('[data-aj]');
    if (!b || !ui.ajout) return;
    let key = b.dataset.aj;
    if (key === '__nouveau') {
      const n = $('ajNom').value.trim().slice(0, 40);
      if (!n) { A.toast('Indiquez un nom de poste.', true); return; }
      key = 'f|' + n;
    }
    const snap = KB.ajouter(S(), ui.ajout.scope, key);
    A.log('info', 'Poste ajouté au budget.');
    A.fermerVolet();
    ui.edit = { scope: ui.ajout.scope, key };
    annulable('« ' + key.slice(2) + ' » ajouté au budget.', snap);
  });

  // ------------------------------------------------------------ volets : contrats, tendance, reste à vivre
  A.preparer.secContrats = o => { if (o && o.rendu && ui.ctrEdit) return; if (!o || !o.rendu) ui.ctrEdit = null; $('contratsCorps').innerHTML = VB.ecranContrats(A.budget(), ui.ctrScope, ui.ctrEdit); };
  const rendreContrats = () => { $('contratsCorps').innerHTML = VB.ecranContrats(A.budget(), ui.ctrScope, ui.ctrEdit); };
  function contratModifie(msg, snap) {
    ui.ctrEdit = null;
    A.changed('budget');
    rendreContrats();
    A.toastAnnuler(msg, () => { KB.annulerContrat(S(), snap); A.changed('budget'); rendreContrats(); });
  }
  $('contratsCorps').addEventListener('click', ev => {
    const t = ev.target;
    const b = t.closest('[data-scope]');
    if (b) { ui.ctrScope = b.dataset.scope; ui.ctrEdit = null; rendreContrats(); return; }
    const e = t.closest('[data-ctedit]');
    if (e) { ui.ctrEdit = e.dataset.ctedit; rendreContrats(); const f = $('ctLabel'); if (f) f.focus(); return; }
    const vp = t.closest('[data-versprevu]');
    if (vp) {
      const r = KB.versPrevu(S(), ui.ctrScope, vp.dataset.versprevu);
      A.log('info', 'Budget d\'un poste aligné sur ses contrats.');
      A.changed('budget');
      rendreContrats();
      A.toastAnnuler('Prévu « ' + vp.dataset.versprevu.slice(2) + ' » : ' + F.montant(r.amt) + ' par mois.', () => { KB.annuler(S(), r.snap); A.changed('budget'); rendreContrats(); });
      return;
    }
    const c = t.closest('[data-ct]');
    if (!c) return;
    const k = c.dataset.ct, form = c.closest('[data-ctid]'), id = form ? form.dataset.ctid : '';
    if (k === 'fermer') { ui.ctrEdit = null; rendreContrats(); return; }
    if (k === 'suppr') {
      if (!A.confirmInline(c, 'Confirmer ?')) return;
      const snap = KB.retirerContrat(S(), id);
      A.log('info', 'Contrat supprimé.');
      contratModifie('Contrat supprimé.', snap);
      return;
    }
    const lab = $('ctLabel').value.trim(), mt = $('ctMontant').value.trim();
    const montant = mt ? F.saisie(mt) : 0;
    if (!lab) { A.toast('Indiquez le libellé du contrat.', true); return; }
    if (montant == null) { A.toast('Montant illisible.', true); return; }
    const snap = KB.enregistrerContrat(S(), A.budget(), { id: id || null, sc: ui.ctrScope, label: lab, montant, per: +$('ctPer').value || 1,
      motif: $('ctMotif').value, poste: $('ctPoste').value, src: $('ctSrc').value, note: $('ctNote').value });
    A.log('info', id ? 'Contrat modifié.' : 'Contrat ajouté.');
    contratModifie(id ? 'Contrat enregistré.' : 'Contrat ajouté.', snap);
  });
  A.preparer.secTendance = () => { $('tendanceCorps').innerHTML = VB.ecranTendance(A.budget(), ui.scope, ui.tendCat); };
  $('tendanceCorps').addEventListener('click', ev => {
    const b = ev.target.closest('[data-scope]');
    if (b) { ui.scope = b.dataset.scope; ui.nav = null; ui.tendCat = ''; A.preparer.secTendance(); render(); }
  });
  $('tendanceCorps').addEventListener('change', ev => {
    if (ev.target.id === 'tdCat') { ui.tendCat = ev.target.value; A.preparer.secTendance(); }
  });
  // ------------------------------------------------------------ volet : ordres permanents (compte commun)
  let ordresBrouillon = null;
  A.preparer.secVirements = o => {
    if (o.rendu && ordresBrouillon) return;
    ordresBrouillon = JSON.parse(JSON.stringify((S().budget && S().budget.virements) || []));
    renderOrdres();
  };
  function renderOrdres() {
    const B = A.budget();
    const D = Object.assign({}, B.D, { virements: ordresBrouillon });
    $('virementsCorps').innerHTML = VC.ordres(Object.assign({}, B, { D }));
  }
  function lireOrdres() {
    for (const el of $('virementsCorps').querySelectorAll('[data-vid]')) {
      const v = ordresBrouillon.find(x => x.id === el.dataset.vid);
      if (!v) continue;
      for (const f of el.querySelectorAll('[data-vf]')) {
        const k = f.dataset.vf, val = f.value.trim();
        if (k === 'montant') { const c = F.saisie(val); if (c == null) throw new Error('Montant illisible.'); v.montant = c; }
        else if (k === 'jour') v.jour = Math.min(31, Math.max(1, parseInt(val, 10) || 1));
        else v[k] = val;
      }
    }
  }
  $('virementsCorps').addEventListener('click', ev => {
    const t = ev.target;
    try {
      if (t.closest('[data-vajout]')) { lireOrdres(); ordresBrouillon.push({ id: 'v' + Date.now().toString(36), qui: 'moi', montant: 0, jour: 1, usage: 'fixes', label: 'Nouveau virement', depuis: '' }); renderOrdres(); return; }
      const sp = t.closest('[data-vsuppr]');
      if (sp) { lireOrdres(); ordresBrouillon = ordresBrouillon.filter(v => v.id !== sp.dataset.vsuppr); renderOrdres(); return; }
      if (t.closest('[data-vok]')) {
        lireOrdres();
        const D = KB.donnees(S());
        const avant = JSON.stringify(D.virements || []);
        D.virements = ordresBrouillon;
        ordresBrouillon = null;
        A.log('info', 'Ordres permanents du compte commun modifiés.');
        A.fermerVolet();
        A.changed('budget');
        A.toastAnnuler('Ordres permanents enregistrés.', () => { KB.donnees(S()).virements = JSON.parse(avant); A.changed('budget'); });
      }
    } catch (e) { A.toast(e.message || String(e), true); }
  });

  // ------------------------------------------------------------ volet : équilibre des apports
  A.preparer.secEquilibre = () => { $('equilibreCorps').innerHTML = VC.equilibre(A.budget(), ui.sim); };
  $('equilibreCorps').addEventListener('input', ev => {
    if (ev.target.id !== 'eqSimX' && ev.target.id !== 'eqSimY') return;
    ui.sim = { x: F.saisie($('eqSimX').value) || 0, y: F.saisie($('eqSimY').value) || 0 };
    const tmp = document.createElement('div');
    tmp.innerHTML = VC.equilibre(A.budget(), ui.sim);
    const out = tmp.querySelector('#eqSimOut');
    if (out) $('eqSimOut').innerHTML = out.innerHTML;
  });
  $('equilibreCorps').addEventListener('change', ev => {
    const c = ev.target.closest('[data-eqon]');
    if (!c) return;
    const avant = KC.basculerEquipement(S(), c.dataset.eqon, c.checked);
    A.changed('budget');
    A.toastAnnuler(c.checked ? 'Dépense comptée dans l\'équilibre.' : 'Dépense retirée de l\'équilibre.', () => { KC.annulerEquilibre(S(), avant); A.changed('budget'); });
  });
  $('equilibreCorps').addEventListener('click', ev => {
    const sp = ev.target.closest('[data-eqsuppr]');
    if (sp) {
      const avant = KC.retirerEquipement(S(), sp.dataset.eqsuppr);
      A.changed('budget');
      A.toastAnnuler('Dépense retirée.', () => { KC.annulerEquilibre(S(), avant); A.changed('budget'); });
      return;
    }
    if (ev.target.closest('[data-eqajout]')) {
      const lab = $('eqLab').value.trim().slice(0, 80);
      const m = $('eqMoi').value.trim() ? F.saisie($('eqMoi').value) : 0, a = $('eqAutre').value.trim() ? F.saisie($('eqAutre').value) : 0;
      if (!lab || m == null || a == null || !(m || a)) { A.toast('Indiquez un libellé et au moins un montant.', true); return; }
      const avant = KC.ajouterEquipement(S(), { label: lab, date: $('eqDate').value || '', moi: m, autre: a, src: 'manuel' });
      A.log('info', 'Dépense d\'équipement ajoutée à l\'équilibre.');
      A.changed('budget');
      A.toastAnnuler('Dépense ajoutée à l\'équilibre.', () => { KC.annulerEquilibre(S(), avant); A.changed('budget'); });
    }
  });

  A.preparer.secRav = () => {
    const B = A.budget();
    $('ravCorps').innerHTML = VB.detailRav(B ? KB.suivi(B, 'perso', null).rav : null);
  };

  window.KladEcranBudget = { ui, render };
})();
