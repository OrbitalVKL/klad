// Klad — onglets Budget et Commun (comme l'ancienne version) : navigation ◀ ▶ entre cycles, observations, reste à vivre,
// virements du commun, « Budget mensuel » (Suivi / Budget, édition en place, annulable), tendance, contrats,
// catégories et règles ; sections dépliantes avec mémoire de l'état.
(function () {
  'use strict';

  const A = window.KladApp;
  const KB = window.KladBudget;
  const KC = window.KladClasse;
  const KCo = window.KladCommun;
  const VB = window.KladVuesBudget;
  const VC = window.KladVuesCommun;
  const U = window.KladUI;
  const F = window.KladFormat;
  const $ = id => document.getElementById(id);
  const S = () => A.etat();

  const tend = Object.assign({ comptes: 'auto', mode: 'rd' }, U.pref('tendance') || {});
  const ui = { nav: null, mode: 'suivi', ouverts: new Set(), ouvertsPlan: new Set(), cartes: new Set(), ctrEdit: null, edit: null, ajout: null, ravOuvert: false, choixPer: false, catRen: null, sim: {} };
  let scopeRendu = null;

  const PANNEAUX = ['actions', 'cm-plan', 'budget-main', 'tend-panel', 'p-contrats', 'cats-panel', 'rules-panel'];
  function plis(root) { (root || document).querySelectorAll('.panel[id]').forEach(U.appliquerPli); }

  // ------------------------------------------------------------ rendu
  function render() {
    const v = A.vue();
    if (v !== 'budget' && v !== 'commun') return;
    const B = A.budget();
    if (!B) return;
    const scope = A.scope();
    if (scopeRendu !== scope) { ui.nav = null; ui.ouverts.clear(); scopeRendu = scope; }
    const sur = (id, fn) => { try { $(id).innerHTML = fn(); } catch (e) { $(id).innerHTML = '<p class="muted">Calcul impossible.</p>'; A.log('err', 'Budget (' + id + ') : ' + (e.message || e)); } };
    sur('cyc-nav', () => VB.cycNav(B, scope, ui.nav));
    sur('actions', () => VB.observations(B, scope, { analyse: !!(window.KladExtras && window.KladExtras.actif(S(), 'claude')), texteAnalyse: window.KladExtras && window.KladExtras.analyse && window.KladExtras.analyse(scope) }));
    const rav = (() => { try { return VB.ravM(B, scope, ui); } catch (e) { return ''; } })();
    $('rav-m').innerHTML = rav; $('rav-m').hidden = !rav;
    const cm = scope === 'commun' && VC && VC.plan ? (() => { try { return VC.plan(B, ui); } catch (e) { A.log('err', 'Commun : ' + (e.message || e)); return ''; } })() : '';
    $('cm-plan').innerHTML = cm; $('cm-plan').hidden = !cm;
    sur('budget-main', () => VB.teteBudget(B, scope, ui) + (ui.mode === 'plan' ? VB.plan(B, scope, { ouverts: ui.ouvertsPlan }) : VB.suivi(B, scope, ui).html));
    sur('tend-panel', () => VB.tendance(B, scope, tend, periodeTendance(B)));
    sur('ctr-zone', () => '<section class="panel" id="p-contrats">' + VB.contrats(B, scope, ui.ctrEdit) + '</section>');
    sur('cats-panel', () => VB.categories(S(), B, ui.catRen));
    sur('rules-panel', () => VB.regles(S(), B));
    plis($('view-budget'));
  }
  A.rendus.push(o => { if (!o || !o.theme) render(); });
  window.addEventListener('resize', () => { clearTimeout(render.t); render.t = setTimeout(() => { if (A.etat()) render(); }, 250); });

  // Période d'analyse de la tendance (et des opérations) : mois proposés, préréglage.
  function periodeTendance(B) {
    const p = A.periode();
    const mois = [], debut = (B.rows[0] && B.rows[0].date.slice(0, 7)) || B.auj.slice(0, 7);
    for (let m = B.auj.slice(0, 7); m >= debut && mois.length < 240; m = KB.shift(m, -1)) mois.push(m);
    return { from: p.from, to: p.to, n: p.n || null, choix: ui.choixPer, mois };
  }
  function regler(p) { A.choisirPeriode(p); A.rendre(); }

  function annulable(msg, snap) {
    A.changed('budget');
    A.toastAnnuler(msg, () => { KB.annuler(S(), snap); A.changed('budget'); });
  }
  function classementAnnulable(msg, snap) {
    A.changed('classement');
    A.toastAnnuler(msg, () => { KC.restaurer(S(), snap); A.changed('classement'); });
  }

  // ------------------------------------------------------------ sections dépliantes (tous les écrans)
  document.addEventListener('click', ev => {
    const h = ev.target.closest('.panel-h h2.fold');
    if (!h || !ev.target.closest('#appli')) return;
    const p = h.closest('.panel');
    if (!p || !p.id) return;
    const c = !p.classList.contains('collapsed');
    U.plier(p.id, c);
    U.appliquerPli(p);
  });
  document.addEventListener('keydown', ev => {
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    const h = ev.target.closest && ev.target.closest('.panel-h h2.fold');
    if (h) { ev.preventDefault(); h.click(); }
  });

  // ------------------------------------------------------------ actions dans l'onglet
  const vb = $('view-budget');
  vb.addEventListener('click', ev => {
    const t = ev.target;
    const sc = t.closest('[data-scope]');
    if (sc) { A.montrer(sc.dataset.scope === 'commun' ? 'commun' : 'budget', { force: true }); return; }
    const nv = t.closest('[data-nav]');
    if (nv) {
      const per = KB.periode(A.budget(), A.scope(), ui.nav);
      const k = nv.dataset.nav;
      if (k === 'now') ui.nav = null;
      else if (k === 'prev' && per.prev) ui.nav = per.prev;
      else if (k === 'next' && per.next) ui.nav = per.next === 'courant' ? null : per.next;
      ui.ouverts.clear(); render(); A.chrome(); return;
    }
    const bm = t.closest('[data-bmode]');
    if (bm) { ui.mode = bm.dataset.bmode; render(); return; }
    const sg = t.closest('[data-sec]');
    if (sg) { const k = 'm|' + sg.dataset.sec; if (ui.ouverts.has(k)) ui.ouverts.delete(k); else ui.ouverts.add(k); render(); return; }
    const cl = t.closest('[data-classer][data-op]');
    if (cl) { window.KladApp.ouvrirOp(cl.dataset.c, cl.dataset.op); return; }
    const al = t.closest('[data-aligner]');
    if (al) {
      const snap = KB.modifier(S(), A.scope(), al.dataset.aligner, { on: true, amt: +al.dataset.v });
      A.log('info', 'Budget d\'un poste aligné.');
      annulable('Budget aligné sur ' + F.montant(+al.dataset.v) + '.', snap);
      return;
    }
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
    if (ed) { ui.edit = { scope: A.scope(), key: ed.dataset.editer }; A.ouvrirVolet('secPoste'); return; }
    const aj = t.closest('[data-ajout]');
    if (aj) { ui.ajout = { scope: A.scope(), nk: aj.dataset.ajout }; A.ouvrirVolet('secAjout'); return; }
    // mode Budget
    const pa = t.closest('[data-paligner]');
    if (pa) {
      const a = KB.postes(A.budget(), A.scope()).lignes.find(x => x.key === pa.dataset.paligner);
      if (!a) return;
      const snap = KB.modifier(S(), A.scope(), a.key, { on: true, per: a.per, amt: Math.round(a.avg * a.per / 100) * 100 });
      annulable('Budget aligné : ' + KB.eur(a.avg) + ' / mois pour ' + a.label + '.', snap);
      return;
    }
    const pr = t.closest('[data-pretirer]');
    if (pr) {
      if (!A.confirmInline(pr, 'Retirer ?')) return;
      const snap = KB.retirer(S(), A.scope(), pr.dataset.pretirer);
      A.log('info', 'Poste retiré du budget.');
      annulable('« ' + pr.dataset.pretirer.slice(2) + ' » retiré du budget.', snap);
      return;
    }
    const pd = t.closest('[data-pdet]'), pm = t.closest('[data-pmois]');
    if (pd || pm) { const k = pd ? 'd|' + pd.dataset.pdet : 'mo|' + pm.dataset.pmois; if (ui.ouvertsPlan.has(k)) ui.ouvertsPlan.delete(k); else ui.ouvertsPlan.add(k); render(); return; }
    if (t.closest('[data-fuel]')) { if (ui.ouvertsPlan.has('fuel')) ui.ouvertsPlan.delete('fuel'); else ui.ouvertsPlan.add('fuel'); render(); return; }
    const fo = t.closest('[data-fuelok]');
    if (fo) {
      const snap = KB.modifier(S(), 'perso', 'c|Carburant', { on: true, per: 1, amt: +fo.dataset.fuelok });
      annulable('Prévu Carburant : ' + KB.eur(+fo.dataset.fuelok) + '.', snap);
      return;
    }
    if (t.closest('[data-shajout]')) {
      const lab = $('sh-label').value.trim().slice(0, 40), amt = F.saisie($('sh-amt').value), pg = Math.min(100, Math.max(0, parseFloat($('sh-pg').value) || 0));
      if (!lab || amt == null) { A.toast('Indiquez le nom du poste et son montant par mois.', true); return; }
      const snap = KB.modifier(S(), 'commun', 'm|' + lab, { on: true, per: 1, amt, pg });
      annulable('Poste « ' + lab + ' » ajouté au compte commun.', snap);
      return;
    }
    // tendance : période et infobulle
    const st = t.closest('[data-step]');
    if (st) { const p = A.periode(), k = +st.dataset.step; regler({ from: KB.shift(p.from, k), to: KB.shift(p.to, k), n: null }); return; }
    const ps = t.closest('[data-preset]');
    if (ps) {
      const p = A.periode(), k = ps.dataset.preset;
      if (k === 'tout') { const B = A.budget(); regler({ from: (B.rows[0] && B.rows[0].date.slice(0, 7)) || p.to, to: p.to, n: 'tout' }); }
      else regler({ from: KB.shift(p.to, -(+k - 1)), to: p.to, n: +k });
      return;
    }
    if (t.closest('[data-anlab]')) { ui.choixPer = !ui.choixPer; render(); return; }
    // contrats
    const ce = t.closest('[data-ctedit]');
    if (ce) { ui.ctrEdit = ce.dataset.ctedit === 'liste' ? 'liste' : ce.dataset.ctedit || null; render(); const f = $('ctLabel'); if (f) f.focus(); return; }
    const vp = t.closest('[data-versprevu]');
    if (vp) {
      const r = KB.versPrevu(S(), A.scope(), vp.dataset.versprevu);
      A.log('info', 'Budget d\'un poste aligné sur ses contrats.');
      annulable('Prévu « ' + vp.dataset.versprevu.slice(2) + ' » : ' + F.montant(r.amt) + ' par mois.', r.snap);
      return;
    }
    const ct = t.closest('[data-ct]');
    if (ct) { contrat(ct); return; }
    // catégories et règles
    if (t.closest('[data-ncadd]')) {
      try { const snap = KC.creerCategorie(S(), $('nc-name').value, $('nc-nat').value); A.log('info', 'Catégorie ajoutée.'); classementAnnulable('Catégorie créée.', snap); }
      catch (e) { A.toast(e.message, true); }
      return;
    }
    const cr = t.closest('[data-catren]');
    if (cr) { ui.catRen = cr.dataset.catren; render(); const i = $('cat-ren'); if (i) i.focus(); return; }
    if (t.closest('[data-catrenno]')) { ui.catRen = null; render(); return; }
    if (t.closest('[data-catrenok]')) {
      try { const snap = KC.renommerCategorie(S(), ui.catRen, $('cat-ren').value); ui.catRen = null; if (snap) { A.log('info', 'Catégorie renommée.'); classementAnnulable('Catégorie renommée.', snap); } else render(); }
      catch (e) { A.toast(e.message, true); }
      return;
    }
    const cs = t.closest('[data-catsup]');
    if (cs) {
      if (!A.confirmInline(cs, 'Supprimer ?')) return;
      const snap = KC.supprimerCategorie(S(), cs.dataset.catsup);
      A.log('info', 'Catégorie supprimée.');
      classementAnnulable('Catégorie « ' + cs.dataset.catsup + ' » supprimée : ses opérations passent en « Autres ».', snap);
      return;
    }
    if (t.closest('[data-nradd]')) {
      try { const mot = $('nr-kw').value, cat = $('nr-cat').value; const snap = KC.ajouterRegle(S(), mot, cat); A.log('info', 'Règle de classement ajoutée.'); classementAnnulable('Règle « ' + mot.trim() + ' » ajoutée.', snap); }
      catch (e) { A.toast(e.message, true); }
      return;
    }
    const nr = t.closest('[data-nrsup]');
    if (nr) {
      if (!A.confirmInline(nr, 'Supprimer ?')) return;
      const snap = KC.retirerRegle(S(), nr.dataset.nrsup);
      A.log('info', 'Règle de classement supprimée.');
      classementAnnulable('Règle supprimée.', snap);
      return;
    }
    // observations
    const fa = t.closest('[data-fait]');
    if (fa) {
      const avant = window.KladObservations.fait(S(), fa.dataset.fait, Date.now());
      A.changed('budget');
      A.toastAnnuler('Point marqué comme fait : il reviendra seulement si la situation se reproduit.', () => { window.KladObservations.annulerFait(S(), avant); A.changed('budget'); });
      return;
    }
    if (t.closest('[data-reafficher]')) { const avant = window.KladObservations.reafficher(S(), Date.now()); A.changed('budget'); A.toastAnnuler('Points réaffichés.', () => { window.KladObservations.annulerFait(S(), avant); A.changed('budget'); }); return; }
    if (t.closest('[data-audit]')) { A.synchro('manuel'); A.rendre(); A.toast('Audit relancé.'); return; }
    if (t.closest('[data-analyse]') && window.KladExtras) { window.KladExtras.analyser(A.scope()); return; }
    const lm = t.closest('[data-liremails]');
    if (lm && window.KladExtras) { window.KladExtras.lireMails(lm); return; }
    const la = t.closest('[data-lireappel]');
    if (la && window.KladExtras) { window.KladExtras.lireDocument('appel', la); return; }
    // compte commun : cartes dépliées, ordres permanents
    const ov = t.closest('[data-ouvrir]');
    if (ov) { A.ouvrirVolet(ov.dataset.ouvrir); return; }
  });
  // infobulle du graphique de tendance (appui sur un mois)
  vb.addEventListener('pointerdown', ev => {
    const r = ev.target.closest && ev.target.closest('#monthly rect[data-i]');
    if (!r) return;
    const box = $('monthly'), tip = box.querySelector('.tip'), data = JSON.parse((box.querySelector('script.tips') || {}).textContent || '[]');
    const d = data[+r.dataset.i];
    if (!d || !tip) return;
    tip.hidden = false;
    tip.innerHTML = '<b>' + U.esc(d[0]) + '</b>' + d[1].map(([c, l, v]) => '<span><i style="background:' + U.esc(c) + '"></i>' + U.esc(l) + ' <em>' + U.esc(v) + '</em></span>').join('');
    const bx = box.getBoundingClientRect(), x = ev.clientX - bx.left, W = bx.width;
    tip.style.left = Math.min(W - 180, Math.max(0, x + 12 > W - 180 ? x - 192 : x + 12)) + 'px'; tip.style.top = '8px';
  });
  vb.addEventListener('change', ev => {
    const t = ev.target, sc = A.scope();
    if (t.id === 'bref') { choisirRef(t.value); return; }
    if (t.id === 'from' || t.id === 'to') { const p = A.periode(); const f = t.id === 'from' ? t.value : p.from, to = t.id === 'to' ? t.value : p.to; regler({ from: f <= to ? f : to, to: f <= to ? to : f, n: null }); return; }
    if (t.id === 'tend-acc' || t.id === 'tend-mode') {
      tend[t.id === 'tend-acc' ? 'comptes' : 'mode'] = t.value;
      U.pref('tendance', tend);
      render(); return;
    }
    if (t.dataset.pon) { annulable((t.checked ? 'Poste compté' : 'Poste retiré') + ' dans le budget.', KB.modifier(S(), sc, t.dataset.pon, { on: t.checked })); return; }
    if (t.dataset.pamt) {
      const v = t.value.trim(), c = v ? F.saisie(v) : null;
      if (v && c == null) { A.toast('Montant illisible.', true); render(); return; }
      const key = t.dataset.pamt, a = KB.postes(A.budget(), sc).lignes.find(x => x.key === key);
      const ch = key.startsWith('r|') ? { amt: c } : { amt: c, per: a ? a.per : 1 };
      if (key === 'r|Salaire') ch.mode = 'libre';
      annulable('Budget « ' + key.slice(2) + ' » enregistré.', KB.modifier(S(), key.startsWith('r|') ? 'perso' : sc, key, ch)); return;
    }
    if (t.dataset.psal) { annulable('Salaire attendu : ' + KB.MODES_SALAIRE[t.value] + '.', KB.modifier(S(), 'perso', 'r|Salaire', { mode: t.value })); return; }
    if (t.dataset.pper) {
      const a = KB.postes(A.budget(), sc).lignes.find(x => x.key === t.dataset.pper);
      annulable('Périodicité modifiée.', KB.modifier(S(), sc, t.dataset.pper, { per: +t.value, amt: Math.round((a ? a.amt : 0) * (+t.value)) })); return;
    }
    if (t.dataset.ppg) { annulable('Part modifiée.', KB.modifier(S(), 'commun', t.dataset.ppg, { pg: Math.min(100, Math.max(0, parseFloat(t.value) || 0)) })); return; }
    if (t.dataset.pelig) { annulable(t.checked ? 'Poste compté dans l\'équilibre.' : 'Poste retiré de l\'équilibre.', KB.modifier(S(), 'commun', t.dataset.pelig, { elig: t.checked })); return; }
    if (t.dataset.ajoutposte) {
      let key = t.value;
      if (!key) return;
      if (key === '__new') {
        ui.ajout = { scope: sc, nk: 'fixe' }; A.ouvrirVolet('secAjout'); t.value = ''; return;
      }
      annulable('Poste « ' + key.slice(2) + ' » ajouté au budget.', KB.ajouter(S(), sc, key)); return;
    }
    if (t.dataset.fu) {
      const avant = KB.reglerCarburant(S(), { [t.dataset.fu]: parseFloat(String(t.value).replace(',', '.')) || 0 });
      A.changed('budget');
      A.toastAnnuler('Calculateur carburant mis à jour.', () => { KB.annulerCarburant(S(), avant); A.changed('budget'); });
      return;
    }
    if (t.dataset.catnat) {
      const snap = KC.changerNature(S(), t.dataset.catnat, t.value);
      classementAnnulable('Nature de « ' + t.dataset.catnat + ' » modifiée.', snap);
    }
  });
  vb.addEventListener('input', ev => {
    if (ev.target.id !== 'nr-kw') return;
    const v = ev.target.value.trim();
    $('nr-count').textContent = v ? KC.concernees(S(), v, {}).length + ' opération(s) concernée(s)' : '';
  });
  vb.addEventListener('toggle', ev => {
    const d = ev.target;
    if (d.matches && d.matches('details[data-rav]')) ui.ravOuvert = d.open;
    if (d.matches && d.matches('details[data-cc]')) {
      const k = d.dataset.cc, ferme = k.replace(/^cm\|/, 'cm-|');
      if (d.open) { ui.cartes.add(k); ui.cartes.delete(ferme); } else { ui.cartes.delete(k); ui.cartes.add(ferme); }
    }
  }, true);

  function choisirRef(m) {
    const avant = KB.choisirReference(S(), m);
    A.log('info', 'Budget : base de calcul modifiée.');
    A.changed('budget');
    A.toastAnnuler('Base de calcul : ' + (m ? 'depuis ' + KB.nomMois(m) : '6 derniers mois complets') + '.', () => { KB.annulerReference(S(), avant); A.changed('budget'); });
  }

  // ------------------------------------------------------------ contrats
  function contrat(c) {
    const k = c.dataset.ct, form = c.closest('[data-ctid]'), id = form ? form.dataset.ctid : '';
    const fin = (msg, snap) => { ui.ctrEdit = 'liste'; A.changed('budget'); A.toastAnnuler(msg, () => { KB.annulerContrat(S(), snap); A.changed('budget'); }); };
    if (k === 'fermer') { ui.ctrEdit = 'liste'; render(); return; }
    if (k === 'suppr') {
      if (!A.confirmInline(c, 'Confirmer ?')) return;
      const snap = KB.retirerContrat(S(), id);
      A.log('info', 'Contrat supprimé.');
      fin('Contrat supprimé.', snap);
      return;
    }
    const lab = $('ctLabel').value.trim(), mt = $('ctMontant').value.trim();
    const montant = mt ? F.saisie(mt) : 0;
    if (!lab) { A.toast('Indiquez le libellé du contrat.', true); return; }
    if (montant == null) { A.toast('Montant illisible.', true); return; }
    const snap = KB.enregistrerContrat(S(), A.budget(), { id: id || null, sc: A.scope(), label: lab, montant, per: +$('ctPer').value || 1,
      motif: $('ctMotif').value, poste: $('ctPoste').value, src: $('ctSrc').value, note: $('ctNote').value });
    A.log('info', id ? 'Contrat modifié.' : 'Contrat ajouté.');
    fin(id ? 'Contrat enregistré.' : 'Contrat ajouté.', snap);
  }

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
    $('ajoutCorps').innerHTML = '<p class="muted">' + U.esc(KB.NOMS[ui.ajout.nk]) + ' · ' + (ui.ajout.scope === 'commun' ? 'commun' : 'perso') + '</p>' +
      (L.length ? '<ul class="list">' + L.map(x => '<li><div class="grow">' + U.esc(x.label) + '</div><button type="button" class="btn small" data-aj="' + U.esc(x.key) + '">Ajouter</button></li>').join('') + '</ul>'
        : '<p class="muted">Aucun autre poste à ajouter.</p>') +
      (ui.ajout.nk === 'fixe' ? '<label class="sh-l"><span class="sh-lab">Nouveau poste fixe</span><input class="sh-in" id="ajNom" maxlength="40" autocomplete="off" placeholder="ex. Salle de sport"></label><button type="button" class="sh-go" data-aj="__nouveau">Créer le poste</button>' : '');
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

  // Accueil › « Bilan du cycle précédent » : onglet Budget sur le cycle d'avant.
  function cyclePrecedent() {
    const B = A.budget();
    if (!B) return;
    scopeRendu = A.scope();
    const per = KB.periode(B, A.scope(), null);
    if (per.prev) { ui.nav = per.prev; ui.ouverts.clear(); render(); A.chrome(); }
  }
  window.KladEcranBudget = { ui, render, PANNEAUX, cyclePrecedent };
})();
