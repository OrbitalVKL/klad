// Klad — écrans du Lot 8 : Plus › Impôts (et taxe foncière), Plus › Épargne (livret, PEE), Plus › Observations,
// Budget › Résultats. Chaque modification est annulable (sauf la saisie d'un avis ou d'un fonds, qu'on retire à la main).
(function () {
  'use strict';

  const A = window.KladApp;
  const KB = window.KladBudget;
  const KF = window.KladFisc;
  const KO = window.KladObservations;
  const VF = window.KladVuesFisc;
  const F = window.KladFormat;
  const $ = id => document.getElementById(id);
  const S = () => A.etat();
  const UB = () => (window.KladEcranBudget && window.KladEcranBudget.ui) || { scope: 'perso', nav: null };
  const ui = { annee: null };

  const D = () => KB.donnees(S());
  const fisc = () => { const d = D(); return d.fisc || (d.fisc = { avis: {}, bs: {}, hyp: Object.assign({}, KF.HYP0), soldeBy: {}, year: null }); };
  const nombre = v => { const t = String(v == null ? '' : v).trim().replace(/\s/g, '').replace(',', '.'); return t === '' ? null : isFinite(+t) ? +t : NaN; };
  // Rendu d'un volet en gardant la saisie en cours : le champ actif (même identifiant ou même attribut) reprend le focus.
  function poser(id, html) {
    const el = $(id), a = document.activeElement;
    let sel = null;
    if (a && el.contains(a)) {
      if (a.id) sel = '#' + a.id;
      else for (const k of ['hyp', 'tf', 'pl', 'vl']) if (a.dataset[k]) { sel = '[data-' + k + '="' + a.dataset[k] + '"]'; break; }
    }
    el.innerHTML = html;
    if (sel) { const b = el.querySelector(sel); if (b) { const d = b.closest('details'); if (d) d.open = true; b.focus(); } }
  }
  function modifie(quoi, avant, fn) {
    A.changed('budget');
    A.toastAnnuler(quoi, () => { fn(avant); A.changed('budget'); });
  }

  // ------------------------------------------------------------ impôts
  A.preparer.secImpots = () => { const B = A.budget(); poser('impotsCorps', B ? VF.impots(B, ui) : ''); };
  $('impotsCorps').addEventListener('click', ev => {
    const y = ev.target.closest('[data-txy]');
    if (y) { ui.annee = +y.dataset.txy; A.preparer.secImpots({}); return; }
    if (ev.target.closest('[data-tfavis]')) {
      const an = parseInt($('tfY').value, 10), t = nombre($('tfT').value), b = nombre($('tfB').value);
      if (!(an > 2000) || !(t > 0)) { A.toast('Année et montant de l\'avis sont nécessaires.', true); return; }
      const d = D(); d.tf = d.tf || {}; const avant = JSON.stringify(d.tf);
      d.tf.avis = Object.assign({}, d.tf.avis, { [an]: { total: t, base: b > 0 ? b : null, at: A.budget().auj } });
      A.log('info', 'Avis de taxe foncière enregistré.');
      modifie('Avis de taxe foncière ' + an + ' enregistré.', avant, v => { D().tf = JSON.parse(v); });
    }
  });
  $('impotsCorps').addEventListener('change', ev => {
    const t = ev.target;
    if (t.id === 'txPartage') { const f = fisc(), avant = JSON.stringify(f.hyp); f.hyp.partage = t.value; modifie('Règle de partage modifiée.', avant, v => { fisc().hyp = JSON.parse(v); }); return; }
    if (t.dataset.hyp) {
      const f = fisc(), avant = JSON.stringify(f.hyp), k = t.dataset.hyp;
      if (t.tagName === 'SELECT') f.hyp[k] = t.value;
      else { const n = nombre(t.value); if (Number.isNaN(n)) { A.toast('Nombre illisible.', true); return; } f.hyp[k] = n; }
      modifie('Hypothèse modifiée.', avant, v => { fisc().hyp = JSON.parse(v); });
      return;
    }
    if (t.dataset.soldeby) { const f = fisc(), avant = JSON.stringify(f.soldeBy); f.soldeBy[t.dataset.soldeby] = t.value; modifie('Solde attribué.', avant, v => { fisc().soldeBy = JSON.parse(v); }); return; }
    if (t.dataset.tf) {
      const d = D(); d.tf = d.tf || {}; const avant = JSON.stringify(d.tf), k = t.dataset.tf;
      if (t.tagName === 'SELECT') d.tf[k] = t.value;
      else { const n = nombre(t.value); if (n == null || Number.isNaN(n)) { A.toast('Nombre illisible.', true); return; } d.tf[k] = n; }
      modifie('Taxe foncière : hypothèse modifiée.', avant, v => { D().tf = JSON.parse(v); });
    }
  });

  // ------------------------------------------------------------ épargne
  A.preparer.secEpargne = () => { const B = A.budget(); poser('epargneCorps', B ? VF.epargne(B) : ''); };
  const pee = () => { const d = D(); return d.pee || (d.pee = { plan: {}, fonds: [], vers: [] }); };
  $('epargneCorps').addEventListener('click', ev => {
    const t = ev.target;
    if (t.closest('[data-lv]')) {
      const v = F.saisie($('lvBase').value), dt = $('lvDate').value;
      if (v == null || !window.KladModele.dateValide(dt)) { A.toast('Montant ou date invalide.', true); return; }
      const d = D(), avant = JSON.stringify(d.livret || null);
      d.livret = { base: v / 100, date: dt, at: new Date().toISOString() };
      A.log('info', 'Solde du livret saisi.');
      modifie('Solde du livret enregistré.', avant, x => { D().livret = JSON.parse(x); });
      return;
    }
    if (t.closest('[data-pf]')) {
      const nom = $('pfNom').value.trim().slice(0, 60);
      if (!nom) { A.toast('Nom du fonds ?', true); return; }
      const p = pee(), avant = JSON.stringify(p);
      p.fonds = p.fonds || [];
      p.fonds.push({ id: 'f' + Date.now().toString(36), nom, cat: $('pfCat').value, sri: parseInt($('pfSri').value, 10) || null, vl: nombre($('pfVl').value) || null, vlDate: A.budget().auj });
      modifie('Fonds « ' + nom + ' » ajouté.', avant, x => { D().pee = JSON.parse(x); });
      return;
    }
    if (t.closest('[data-pv]')) {
      const dt = $('pvDate').value, mt = nombre($('pvMt').value), parts = nombre($('pvParts').value);
      if (!window.KladModele.dateValide(dt) || !(mt > 0)) { A.toast('Date et montant sont nécessaires.', true); return; }
      const p = pee(), avant = JSON.stringify(p);
      p.vers = p.vers || [];
      p.vers.push({ id: 'v' + Date.now().toString(36), d: dt, orig: $('pvOrig').value, fid: $('pvFonds').value, mt, parts: parts > 0 ? parts : null });
      modifie('Versement ajouté.', avant, x => { D().pee = JSON.parse(x); });
      return;
    }
    const rm = t.closest('[data-rmv]');
    if (rm) { const p = pee(), avant = JSON.stringify(p); p.vers = p.vers.filter(v => v.id !== rm.dataset.rmv); modifie('Versement retiré.', avant, x => { D().pee = JSON.parse(x); }); }
  });
  $('epargneCorps').addEventListener('change', ev => {
    const t = ev.target;
    if (t.dataset.pl) {
      const p = pee(), avant = JSON.stringify(p), k = t.dataset.pl;
      p.plan = p.plan || {};
      if (['anc', 'abTaux', 'abPlaf', 'dispo'].indexOf(k) >= 0) { const n = nombre(t.value); if (Number.isNaN(n)) { A.toast('Nombre illisible.', true); return; } p.plan[k] = n; }
      else p.plan[k] = t.value.trim().slice(0, 60);
      modifie('Plan d\'épargne modifié.', avant, x => { D().pee = JSON.parse(x); });
      return;
    }
    if (t.dataset.vl) {
      const p = pee(), avant = JSON.stringify(p), fd = (p.fonds || []).find(x => x.id === t.dataset.vl);
      if (!fd) return;
      const n = nombre(t.value);
      if (Number.isNaN(n)) { A.toast('Nombre illisible.', true); return; }
      fd.vl = n; fd.vlDate = A.budget().auj;
      modifie('Valeur de part enregistrée.', avant, x => { D().pee = JSON.parse(x); });
    }
  });

  // ------------------------------------------------------------ observations
  A.preparer.secObs = () => { const B = A.budget(); $('obsCorps').innerHTML = B ? VF.observations(B, UB().scope) : ''; };
  $('obsCorps').addEventListener('click', ev => {
    const f = ev.target.closest('[data-fait]');
    if (f) { const avant = KO.fait(S(), f.dataset.fait); A.log('info', 'Observation marquée faite.'); modifie('Point marqué fait : il reviendra seulement si la situation se reproduit.', avant, x => KO.annulerFait(S(), x)); return; }
    if (ev.target.closest('[data-reafficher]')) { const avant = KO.reafficher(S()); modifie('Points réaffichés.', avant, x => KO.annulerFait(S(), x)); }
  });

  // ------------------------------------------------------------ résultats (Budget)
  A.preparer.secResultats = () => { const B = A.budget(); $('resultatsCorps').innerHTML = B ? VF.resultats(B, UB().scope, UB().nav) : ''; };

  // Plus : sous-titres du menu
  A.rendus.push(() => {
    const B = A.budget();
    if (!B) return;
    try {
      const X = KF.contexte(B), R = KF.annee(X, X.Y);
      $('mImpots').textContent = Object.keys(X.FI.avis).length || Object.keys(X.FI.bs).length ? 'Impôt ' + X.Y + ' : ' + (R.solde >= 0 ? 'solde estimé ' + Math.round(R.solde) + ' €' : 'remboursement estimé ' + Math.round(-R.solde) + ' €') : 'Impôt sur le revenu, taxe foncière';
    } catch (e) { $('mImpots').textContent = 'Impôt sur le revenu, taxe foncière'; }
    try { const n = KO.observations(B, 'perso').faire.length; $('mObs').textContent = n ? n + ' point(s) à faire' : 'Rien à faire'; } catch (e) { $('mObs').textContent = ''; }
  });

  window.KladEcranFisc = { ui };
})();
