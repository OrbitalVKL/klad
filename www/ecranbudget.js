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

  const ui = { scope: 'perso', nav: null, ouverts: new Set(), tendCat: '', ctrScope: 'perso', edit: null, ajout: null };

  function render() {
    const B = A.budget();
    if (!B) { $('vBudget').innerHTML = ''; return; }
    try { $('vBudget').innerHTML = VB.ecran(B, ui.scope, ui.nav, ui); }
    catch (e) { $('vBudget').innerHTML = '<p class="muted">Budget indisponible.</p>'; A.log('err', 'Budget : ' + (e.message || e)); }
  }
  A.rendus.push(render);

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
    const ed = t.closest('[data-editer]');
    if (ed) { ui.edit = { scope: ui.scope, key: ed.dataset.editer }; A.ouvrirVolet('secPoste'); return; }
    const aj = t.closest('[data-ajout]');
    if (aj) { ui.ajout = { scope: ui.scope, nk: aj.dataset.ajout }; A.ouvrirVolet('secAjout'); return; }
    const op = t.closest('[data-op]');
    if (op) { A.ouvrirOp(op.dataset.c, op.dataset.op); return; }
    const p = t.closest('[data-poste]');
    if (p) { const k = p.dataset.poste; if (ui.ouverts.has(k)) ui.ouverts.delete(k); else ui.ouverts.add(k); render(); }
  });

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
  A.preparer.secContrats = () => { $('contratsCorps').innerHTML = VB.ecranContrats(A.budget(), ui.ctrScope); };
  $('contratsCorps').addEventListener('click', ev => {
    const b = ev.target.closest('[data-scope]');
    if (b) { ui.ctrScope = b.dataset.scope; A.preparer.secContrats(); }
  });
  A.preparer.secTendance = () => { $('tendanceCorps').innerHTML = VB.ecranTendance(A.budget(), ui.scope, ui.tendCat); };
  $('tendanceCorps').addEventListener('click', ev => {
    const b = ev.target.closest('[data-scope]');
    if (b) { ui.scope = b.dataset.scope; ui.nav = null; ui.tendCat = ''; A.preparer.secTendance(); render(); }
  });
  $('tendanceCorps').addEventListener('change', ev => {
    if (ev.target.id === 'tdCat') { ui.tendCat = ev.target.value; A.preparer.secTendance(); }
  });
  A.preparer.secRav = () => {
    const B = A.budget();
    $('ravCorps').innerHTML = VB.detailRav(B ? KB.suivi(B, 'perso', null).rav : null);
  };

  window.KladEcranBudget = { ui, render };
})();
