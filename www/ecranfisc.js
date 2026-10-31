// Klad — écrans ouverts depuis « Plus » (comme l'ancienne version) : Équilibre des apports, Impôts (et taxe foncière),
// Épargne (livret, PEE), Relevés et sauvegarde ; volets Observations et Résultats. Chaque modification est annulable
// (sauf la saisie d'un avis ou d'un fonds, qu'on retire à la main).
(function () {
  'use strict';

  const A = window.KladApp;
  const KB = window.KladBudget;
  const KF = window.KladFisc;
  const KO = window.KladObservations;
  const KC = window.KladCommun;
  const VF = window.KladVuesFisc;
  const VC = window.KladVuesCommun;
  const Vu = window.KladVues;
  const U = window.KladUI;
  const F = window.KladFormat;
  const $ = id => document.getElementById(id);
  const S = () => A.etat();
  const UB = () => (window.KladEcranBudget && window.KladEcranBudget.ui) || { nav: null };
  const ui = { annee: null, eq: { sim: {}, sorte: '', equipOuvert: false } };

  const D = () => KB.donnees(S());
  const fisc = () => { const d = D(); return d.fisc || (d.fisc = { avis: {}, bs: {}, hyp: Object.assign({}, KF.HYP0), soldeBy: {}, year: null }); };
  const nombre = v => { const t = String(v == null ? '' : v).trim().replace(/\s/g, '').replace(',', '.'); return t === '' ? null : isFinite(+t) ? +t : NaN; };
  const extras = () => window.KladExtras || null;
  // Rendu d'un écran en gardant la saisie en cours : le champ actif (même identifiant ou même attribut) reprend le focus.
  function poser(id, html) {
    const el = $(id), a = document.activeElement;
    let sel = null;
    if (a && el.contains(a)) {
      if (a.id) sel = '#' + a.id;
      else for (const k of ['hyp', 'tf', 'pl', 'vl']) if (a.dataset[k]) { sel = '[data-' + k + '="' + a.dataset[k] + '"]'; break; }
    }
    el.innerHTML = html;
    el.querySelectorAll('.panel[id]').forEach(U.appliquerPli);
    if (sel) { const b = el.querySelector(sel); if (b) b.focus(); }
  }
  function modifie(quoi, avant, fn) {
    A.changed('budget');
    A.toastAnnuler(quoi, () => { fn(avant); A.changed('budget'); });
  }

  // ------------------------------------------------------------ sous-vues (0.10.5) : résultats d'abord, paramètres à part
  // 1.1 : onglet Patrimoine en quatre parties (Impôts, Foncier, Épargne, Crypto) ; la taxe foncière quitte les
  // sous-vues des impôts pour sa propre partie.
  const SV = {
    impots: [['resume', 'Résumé'], ['prelevements', 'Prélèvements'], ['parametres', 'Paramètres']],
    epargne: [['livret', 'Livret'], ['plan', 'Plan d\'épargne'], ['parametres', 'Paramètres']]
  };
  const svUi = { impots: 'resume', epargne: 'livret' };
  const PARTIES = [['impots', 'Impôts', 'impots'], ['foncier', 'Foncier', 'impots'], ['epargne', 'Épargne', 'epargne'], ['crypto', 'Crypto', 'crypto']];
  let partie = 'impots', cryptoEdit = null;
  const vuePatrimoine = () => PARTIES.find(p => p[0] === partie)[2];
  const barrePatri = () => '<div class="seg sousvues patri sv-4" role="group" aria-label="Patrimoine">' +
    PARTIES.map(([k, l]) => '<button type="button" data-patri="' + k + '" aria-pressed="' + (partie === k) + '">' + l + '</button>').join('') + '</div>';
  document.addEventListener('click', ev => {
    const b = ev.target.closest('[data-patri]');
    if (!b || !A.etat()) return;
    partie = b.dataset.patri;
    cryptoEdit = null;
    const v = vuePatrimoine();
    if (A.vue() === v) { render(); window.scrollTo(0, 0); } else A.montrer(v, { force: true, haut: true });
  });
  const barreSV = v => '<div class="seg sousvues sv-' + SV[v].length + '" role="group" aria-label="' + (v === 'impots' ? 'Impôts' : 'Épargne') + ' : sous-vues">' +
    SV[v].map(([k, l]) => '<button type="button" data-sousvue="' + k + '" aria-pressed="' + (svUi[v] === k) + '">' + l + '</button>').join('') + '</div>';
  document.addEventListener('click', ev => {
    const b = ev.target.closest('[data-sousvue]');
    const v = A.vue();
    if (!b || !A.etat() || !SV[v] || !SV[v].some(x => x[0] === b.dataset.sousvue)) return;
    svUi[v] = b.dataset.sousvue;
    render();
    window.scrollTo(0, 0);
  });

  // ------------------------------------------------------------ rendu des écrans
  function render() {
    const v = A.vue(), B = A.budget();
    if (!B) return;
    const X = extras(), s = S();
    try {
      if (v === 'appartement') {          // Commun › Équilibre (0.10.4) : barre des sous-vues de Commun au-dessus
        const EB = window.KladEcranBudget;
        $('sv-eq').innerHTML = EB && EB.barre ? EB.barre('commun', 'equilibre') : '';
        poser('appart-corps', VC.equilibre(B, ui.eq));
      }
      else if (v === 'impots') {
        if (partie !== 'impots' && partie !== 'foncier') partie = 'impots';
        $('view-impots').dataset.sv = partie === 'foncier' ? 'foncier' : svUi.impots;
        poser('view-impots', barrePatri() + (partie === 'foncier' ? '' : barreSV('impots')) + VF.impots(B, { annee: ui.annee, lecture: !!(X && X.actif(s, 'claude')), analyse: !!(X && X.actif(s, 'claude')), texteAnalyse: X && X.analyse && X.analyse('impots') }));
      }
      else if (v === 'epargne') { partie = 'epargne'; $('view-epargne').dataset.sv = svUi.epargne; poser('view-epargne', barrePatri() + barreSV('epargne') + VF.epargne(B)); }
      else if (v === 'crypto') { partie = 'crypto'; poser('view-crypto', barrePatri() + VF.crypto(B, cryptoEdit)); }
      else if (v === 'donnees') { $('imp-panel').innerHTML = Vu.releves(s, B, Date.now(), { synchro: false }); U.appliquerPli($('imp-panel')); U.appliquerPli($('save-panel')); }
    } catch (e) { A.log('err', 'Écran ' + v + ' : ' + (e.message || e)); }
  }
  A.rendus.push(o => { if (!o || !o.theme) render(); });

  // ------------------------------------------------------------ équilibre des apports
  const eq = $('view-appart');
  eq.addEventListener('input', ev => {
    if (ev.target.id !== 'eqSimX' && ev.target.id !== 'eqSimY') return;
    ui.eq.sim = { x: F.saisie($('eqSimX').value) || 0, y: F.saisie($('eqSimY').value) || 0 };
    const tmp = document.createElement('div');
    tmp.innerHTML = VC.equilibre(A.budget(), ui.eq);
    const out = tmp.querySelector('#eqSimOut');
    if (out) $('eqSimOut').innerHTML = out.innerHTML;
  });
  eq.addEventListener('change', ev => {
    if (ev.target.id === 'eq-kind') { ui.eq.sorte = ev.target.value; render(); return; }
    const c = ev.target.closest('[data-eqon]');
    if (!c) return;
    const avant = KC.basculerEquipement(S(), c.dataset.eqon, c.checked);
    modifie(c.checked ? 'Dépense comptée dans l\'équilibre.' : 'Dépense retirée de l\'équilibre.', avant, x => KC.annulerEquilibre(S(), x));
  });
  eq.addEventListener('click', ev => {
    const t = ev.target;
    const k = t.closest('[data-eqk]');
    if (k) { ui.eq.sorte = ui.eq.sorte === k.dataset.eqk ? '' : k.dataset.eqk; render(); return; }
    if (t.closest('[data-eqtog]')) { ui.eq.equipOuvert = !ui.eq.equipOuvert; render(); return; }
    const sp = t.closest('[data-eqsuppr]');
    if (sp) { const avant = KC.retirerEquipement(S(), sp.dataset.eqsuppr); modifie('Dépense retirée.', avant, x => KC.annulerEquilibre(S(), x)); return; }
    if (t.closest('[data-eqajout]')) {
      const lab = $('ma-label').value.trim().slice(0, 80), m = F.saisie($('ma-amount').value), qui = $('ma-who').value;
      if (!lab || m == null || !(m > 0)) { A.toast('Indiquez un libellé et un montant positif.', true); return; }
      const part = qui === 'moitie' ? [Math.round(m / 2), m - Math.round(m / 2)] : qui === 'moi' ? [m, 0] : [0, m];
      const avant = KC.ajouterEquipement(S(), { label: lab, date: $('ma-date').value || '', moi: part[0], autre: part[1], src: 'manuel' });
      A.log('info', 'Dépense d\'équipement ajoutée à l\'équilibre.');
      modifie('Dépense ajoutée à l\'équilibre.', avant, x => KC.annulerEquilibre(S(), x));
    }
  });
  eq.addEventListener('pointerdown', ev => {
    const r = ev.target.closest && ev.target.closest('#eqchart rect[data-i]');
    if (!r) return;
    const box = $('eqchart'), tip = box.querySelector('.tip'), data = JSON.parse((box.querySelector('script.tips') || {}).textContent || '[]');
    const d = data[+r.dataset.i];
    if (!d || !tip) return;
    tip.hidden = false;
    tip.innerHTML = '<b>' + U.esc(d[0]) + '</b>' + d[1].map(([c, l, v]) => '<span><i style="background:' + U.esc(c) + '"></i>' + U.esc(l) + ' <em>' + U.esc(v) + '</em></span>').join('');
    const bx = box.getBoundingClientRect(), x = ev.clientX - bx.left, W = bx.width;
    tip.style.left = Math.min(W - 180, Math.max(0, x + 12 > W - 180 ? x - 192 : x + 12)) + 'px'; tip.style.top = '8px';
  });

  // ------------------------------------------------------------ impôts
  const im = $('view-impots');
  im.addEventListener('click', ev => {
    const y = ev.target.closest('[data-txy]');
    if (y) { ui.annee = +y.dataset.txy; render(); return; }
    if (ev.target.closest('[data-tfavis]')) {
      const an = parseInt($('tfY').value, 10), t = nombre($('tfT').value), b = nombre($('tfB').value);
      if (!(an > 2000) || !(t > 0)) { A.toast('Année et montant de l\'avis sont nécessaires.', true); return; }
      const d = D(); d.tf = d.tf || {}; const avant = JSON.stringify(d.tf);
      d.tf.avis = Object.assign({}, d.tf.avis, { [an]: { total: t, base: b > 0 ? b : null, at: A.budget().auj } });
      A.log('info', 'Avis de taxe foncière enregistré.');
      modifie('Avis de taxe foncière ' + an + ' enregistré.', avant, v => { D().tf = JSON.parse(v); });
      return;
    }
    const X = extras();
    if (X && ev.target.closest('[data-lirebs]')) { X.lireDocument('bulletin'); return; }
    if (X && ev.target.closest('[data-lireavis]')) { X.lireDocument('avis'); return; }
    if (X && ev.target.closest('[data-analyseimpots]')) { X.analyser('impots'); }
  });
  im.addEventListener('change', ev => {
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
  const pee = () => { const d = D(); return d.pee || (d.pee = { plan: {}, fonds: [], vers: [] }); };
  const ep = $('view-epargne');
  ep.addEventListener('click', ev => {
    const t = ev.target;
    if (t.closest('[data-lv]')) {
      const v = F.saisie($('lvBase').value), dt = $('lvDate').value;
      if (v == null || !window.KladModele.dateValide(dt)) { A.toast('Montant ou date invalide.', true); return; }
      const d = D(), avant = JSON.stringify(d.livret || null);
      d.livret = Object.assign({}, d.livret, { base: v / 100, date: dt, at: new Date().toISOString() });
      A.log('info', 'Solde du livret saisi.');
      modifie('Solde du livret enregistré.', avant, x => { D().livret = JSON.parse(x); });
      return;
    }
    if (t.closest('[data-lvtaux]')) {
      const n = nombre($('lvTaux').value);
      if (Number.isNaN(n) || (n != null && (n < 0 || n > 20))) { A.toast('Taux illisible (en %, par exemple 1,5).', true); return; }
      const d = D(), avant = JSON.stringify(d.livret || null);
      d.livret = Object.assign({}, d.livret, { taux: n });
      modifie('Taux du livret enregistré.', avant, x => { D().livret = JSON.parse(x); });
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
      if (!$('pvFonds').value) { A.toast('Ajoutez d\'abord un fonds.', true); return; }
      const p = pee(), avant = JSON.stringify(p);
      p.vers = p.vers || [];
      p.vers.push({ id: 'v' + Date.now().toString(36), d: dt, orig: $('pvOrig').value, fid: $('pvFonds').value, mt, parts: parts > 0 ? parts : null });
      modifie('Versement ajouté.', avant, x => { D().pee = JSON.parse(x); });
      return;
    }
    const rm = t.closest('[data-rmv]');
    if (rm) { if (!A.confirmInline(rm, 'Retirer ?')) return; const p = pee(), avant = JSON.stringify(p); p.vers = p.vers.filter(v => v.id !== rm.dataset.rmv); modifie('Versement retiré.', avant, x => { D().pee = JSON.parse(x); }); }
  });
  ep.addEventListener('change', ev => {
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

  // ------------------------------------------------------------ crypto (1.1)
  $('view-crypto').addEventListener('click', ev => {
    const b = ev.target.closest('[data-cr]');
    if (!b) return;
    const k = b.dataset.cr;
    if (k === 'ajout') { cryptoEdit = 'nouvelle'; render(); const n = $('crNom'); if (n) n.focus(); return; }
    if (k === 'edit') { cryptoEdit = b.dataset.crid; render(); return; }
    if (k === 'fermer') { cryptoEdit = null; render(); return; }
    if (k === 'suppr') {
      if (!A.confirmInline(b, 'Retirer ?')) return;
      const avant = KF.cryptoRetirer(S(), b.dataset.crid);
      cryptoEdit = null;
      modifie('Position retirée.', avant, x => KF.annulerCrypto(S(), x));
      return;
    }
    if (k === 'ok') {
      const f = b.closest('[data-crform]'), nom = $('crNom').value.trim(), inv = F.saisie($('crInv').value), val = F.saisie($('crVal').value), le = $('crLe').value;
      if (!nom || val == null || !window.KladModele.dateValide(le)) { A.toast('Indiquez le nom, la valeur actuelle et sa date.', true); return; }
      const avant = KF.cryptoEnregistrer(S(), { id: f.dataset.crform || null, nom, investi: inv || 0, valeur: val, le });
      cryptoEdit = null;
      A.log('info', 'Position crypto enregistrée.');
      modifie('Position « ' + nom + ' » enregistrée.', avant, x => KF.annulerCrypto(S(), x));
    }
  });

  // ------------------------------------------------------------ relevés
  $('view-data').addEventListener('click', ev => {
    const t = ev.target;
    if (t.closest('[data-sync]')) { A.synchro('manuel').then(render); render(); return; }
    const r = t.closest('[data-releve]');
    if (r) {
      const id = r.dataset.releve === '__choix' ? $('imp-acc').value : r.dataset.releve;
      const c = window.KladModele.compte(S(), id);
      if (!c) return;
      if (c.source.type !== 'manuel') { A.toast('Ce compte est lu par la banque : pas d\'import à la main.', true); return; }
      A.busy(r, () => A.importerReleve(id));
      return;
    }
    // Retire les opérations importées à la main (fichiers) ; la reprise et la synchronisation ne sont pas touchées.
    const ri = t.closest('[data-retirerimports]');
    if (ri) {
      const s = S(), M = window.KladModele;
      const n = s.modele.comptes.reduce((k, c) => k + M.opsDe(s, c.id).filter(o => o.source === 'fichier').length, 0);
      if (!n) { A.toast('Aucune opération importée à la main.'); return; }
      if (!A.confirmInline(ri, 'Retirer ' + n + ' opération(s) ?')) return;
      const pris = [];
      for (const c of s.modele.comptes) {
        const list = M.opsDe(s, c.id);
        for (let i = list.length - 1; i >= 0; i--) if (list[i].source === 'fichier') pris.push(list.splice(i, 1)[0]);
      }
      A.changed('import');
      A.toastAnnuler(pris.length + ' opération(s) importée(s) à la main retirée(s).', () => {
        for (const o of pris) window.KladModele.opsDe(S(), o.compte).push(o);
        for (const c of S().modele.comptes) window.KladModele.opsDe(S(), c.id).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
        A.changed('import');
      });
    }
  });

  // ------------------------------------------------------------ volets : observations, résultats
  A.preparer.secObs = () => { const B = A.budget(); $('obsCorps').innerHTML = B ? VF.observations(B, A.scope()) : ''; };
  $('obsCorps').addEventListener('click', ev => {
    const f = ev.target.closest('[data-fait]');
    if (f) { const avant = KO.fait(S(), f.dataset.fait, Date.now(), A.budget()); A.log('info', 'Observation marquée faite.'); modifie('Point marqué fait : il reviendra seulement si la situation se reproduit.', avant, x => KO.annulerFait(S(), x)); return; }
    if (ev.target.closest('[data-reafficher]')) { const avant = KO.reafficher(S()); modifie('Points réaffichés.', avant, x => KO.annulerFait(S(), x)); }
  });

  window.KladEcranFisc = { ui, render, vuePatrimoine, partie: () => partie };
})();
