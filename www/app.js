// Klad — page de test du prototype (étape 2).
// Import de la clé, liste des banques, connexion, retour par lien profond klad://eb, comptes, soldes, opérations.
(function () {
  'use strict';

  const CFG = window.KLAD_CONFIG || {};
  const STORE = 'klad.proto.v1';
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ------------------------------------------------------------ Capacitor (absent dans un navigateur)
  const capX = window.capacitorExports;
  const isNative = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  const plugin = name => (capX && capX.registerPlugin) ? capX.registerPlugin(name)
    : (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins[name]) || null;
  const AppP = isNative ? plugin('App') : null;
  const BrowserP = isNative ? plugin('Browser') : null;

  // ------------------------------------------------------------ état (localStorage, non chiffré : prototype)
  const blank = () => ({ appId: '', pem: '', redirectUrl: '', sessions: {}, pending: {}, data: {}, log: [], banks: {} });
  let S;
  try { S = Object.assign(blank(), JSON.parse(localStorage.getItem(STORE) || '{}')); } catch (e) { S = blank(); }
  const save = () => { try { localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) { toast('Stockage impossible : ' + e.message, true); } };

  function defaultRedirect() {
    if (!CFG.owner) return '';
    return 'https://' + String(CFG.owner).toLowerCase() + '.github.io/klad/retour.html';
  }
  if (!S.redirectUrl) S.redirectUrl = defaultRedirect();

  // ------------------------------------------------------------ journal (sans données financières)
  function log(kind, msg) {
    const t = new Date();
    const hh = t.toTimeString().slice(0, 8);
    S.log.push(hh + (kind === 'err' ? ' ✗ ' : kind === 'ok' ? ' ✓ ' : ' · ') + msg);
    if (S.log.length > 300) S.log = S.log.slice(-300);
    save(); renderLog();
  }
  function renderLog() { const el = $('log'); el.textContent = S.log.join('\n'); el.scrollTop = el.scrollHeight; }

  let toastT;
  function toast(msg, err) {
    const el = $('toast');
    el.textContent = msg; el.className = 'show' + (err ? ' err' : '');
    clearTimeout(toastT); toastT = setTimeout(() => { el.className = ''; }, err ? 6000 : 3000);
  }

  // ------------------------------------------------------------ client
  const client = () => new KladEB.Client({ appId: S.appId, pem: S.pem, log });

  async function busy(btn, fn) {
    if (btn) btn.disabled = true;
    try { return await fn(); }
    catch (e) { toast(e.message || String(e), true); log('err', e.message || String(e)); }
    finally { if (btn) btn.disabled = false; }
  }

  // ------------------------------------------------------------ format
  const fmtDate = iso => iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '';
  const fmtMoney = (n, cur) => {
    try { return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: cur || 'EUR' }).format(n); }
    catch (e) { return n.toFixed(2) + ' ' + (cur || ''); }
  };
  const maskIban = s => s ? '…' + String(s).replace(/\s/g, '').slice(-4) : '';
  const BAL = { CLBD: 'Solde comptable', ITAV: 'Disponible', XPCD: 'Prévisionnel', ITBD: 'Intrajournalier', CLAV: 'Disponible (clôture)', OPBD: 'Ouverture', PRCD: 'Veille', INFO: 'Info', OTHR: 'Autre' };
  const daysAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };

  // ------------------------------------------------------------ 1. clé
  function renderKey() {
    $('appId').value = S.appId || '';
    $('redirectUrl').value = S.redirectUrl || '';
    const k = $('keyState');
    if (S.pem) {
      const kind = (S.pem.match(/BEGIN ([A-Z ]+)-----/) || [])[1] || 'clé';
      k.innerHTML = '<span class="ok">✓</span> Clé enregistrée (' + esc(kind) + ', ' + S.pem.length + ' caractères).';
    } else k.textContent = 'Aucune clé enregistrée.';
  }

  $('pemFile').addEventListener('change', async ev => {
    const f = ev.target.files && ev.target.files[0];
    if (!f) return;
    $('pemText').value = await f.text();
    toast('Fichier lu : ' + f.name + '. Appuyez sur « Enregistrer ».');
  });

  $('btnSaveKey').addEventListener('click', ev => busy(ev.target, async () => {
    const appId = $('appId').value.trim();
    const pem = $('pemText').value.trim() || S.pem;
    if (!appId) throw new Error('Saisissez l\'identifiant d\'application.');
    if (!pem) throw new Error('Choisissez le fichier .pem ou collez la clé.');
    await KladEB.importKey(pem);                       // vérifie le format avant d'enregistrer
    S.appId = appId; S.pem = pem; save();
    $('pemText').value = ''; $('pemFile').value = '';
    renderKey(); log('info', 'Clé enregistrée et lisible.');
    toast('Clé enregistrée.');
  }));

  $('btnTestKey').addEventListener('click', ev => busy(ev.target, async () => {
    const a = await client().application();
    const urls = a.redirect_urls || [];
    const okRedirect = S.redirectUrl && urls.indexOf(S.redirectUrl) >= 0;
    $('appInfo').innerHTML =
      '<p><span class="ok">✓</span> Clé acceptée : <b>' + esc(a.name || '?') + '</b> ' +
      '<span class="chip">' + esc(a.environment || '') + '</span> ' + (a.active === false ? '<span class="bad">inactive</span>' : '') + '</p>' +
      '<p class="muted">Adresses de retour déclarées : ' + (urls.length ? urls.map(esc).join('<br>') : 'aucune') + '</p>' +
      (okRedirect ? '<p class="ok">✓ L\'adresse de retour de Klad est bien déclarée.</p>'
        : '<p class="bad">L\'adresse de retour de Klad (' + esc(S.redirectUrl || 'non réglée') + ') n\'est pas dans la liste : ajoutez-la dans le Control Panel Enable Banking.</p>');
    log('info', 'Application « ' + (a.name || '?') + ' » (' + (a.environment || '?') + '), ' + urls.length + ' adresse(s) de retour, retour Klad ' + (okRedirect ? 'déclaré' : 'ABSENT'));
  }));

  $('redirectUrl').addEventListener('change', ev => { S.redirectUrl = ev.target.value.trim(); save(); });
  $('btnCopyRedirect').addEventListener('click', () => copy($('redirectUrl').value, 'Adresse copiée.'));

  // ------------------------------------------------------------ 2. banques
  let bankList = [];
  function renderBanks() {
    const q = $('bankSearch').value.trim().toLowerCase();
    const items = bankList.filter(b => !q || b.name.toLowerCase().indexOf(q) >= 0);
    $('banks').innerHTML = items.length ? items.slice(0, 200).map((b, i) =>
      '<li><div class="grow">' + esc(b.name) + '<small>' + esc(b.country) +
      (b.maximum_consent_validity ? ' · accès max ' + Math.round(b.maximum_consent_validity / 86400) + ' j' : '') +
      (b.psu_types ? ' · ' + esc(b.psu_types.join(', ')) : '') + '</small></div>' +
      '<button class="btn small" data-bank="' + bankList.indexOf(b) + '">Connecter</button></li>').join('')
      : '<li class="muted">' + (bankList.length ? 'Aucune banque ne correspond.' : 'Appuyez sur « Charger ».') + '</li>';
  }
  $('btnLoadBanks').addEventListener('click', ev => busy(ev.target, async () => {
    const c = $('country').value;
    bankList = await client().aspsps(c);
    S.banks[c] = { at: Date.now(), n: bankList.length }; save();
    log('info', bankList.length + ' banque(s) pour ' + c);
    renderBanks();
  }));
  $('bankSearch').addEventListener('input', renderBanks);
  $('banks').addEventListener('click', ev => {
    const b = ev.target.closest('[data-bank]');
    if (!b) return;
    connect(bankList[+b.dataset.bank], b);
  });

  function newState() {
    const a = new Uint8Array(16); crypto.getRandomValues(a);
    return Array.from(a, x => x.toString(16).padStart(2, '0')).join('');
  }

  async function connect(bank, btn) {
    await busy(btn, async () => {
      if (!S.redirectUrl) throw new Error('Adresse de retour non réglée (section 1, « Adresse de retour bancaire »).');
      const state = newState();
      S.pending[state] = { name: bank.name, country: bank.country, ts: Date.now() };
      save();
      const r = await client().startAuth({
        name: bank.name, country: bank.country, maxSeconds: bank.maximum_consent_validity,
        redirectUrl: S.redirectUrl, state
      });
      if (!r.url) throw new Error('Pas d\'adresse d\'autorisation renvoyée.');
      log('info', 'Autorisation lancée : ' + bank.name + ' (' + bank.country + ')');
      if (BrowserP) await BrowserP.open({ url: r.url });
      else window.location.href = r.url;
    });
  }

  // ------------------------------------------------------------ retour bancaire (klad://eb?code=…&state=…)
  let handled = {};
  async function handleReturn(url) {
    if (!url || handled[url]) return;
    handled[url] = true;
    let u;
    try { u = new URL(url); } catch (e) { log('err', 'Lien de retour illisible'); return; }
    const p = u.searchParams;
    if (!p.get('code') && !p.get('error')) return;
    if (BrowserP) { try { await BrowserP.close(); } catch (e) { /* Android : sans effet */ } }
    const state = p.get('state') || '';
    const pend = S.pending[state];
    if (p.get('error')) {
      delete S.pending[state]; save();
      log('err', 'Autorisation refusée ou annulée : ' + (p.get('error_description') || p.get('error')));
      toast('Autorisation annulée : ' + (p.get('error_description') || p.get('error')), true);
      return;
    }
    if (!pend) {
      log('err', 'Retour bancaire avec un « state » inconnu : ignoré.');
      toast('Retour bancaire inattendu (state inconnu). Relancez la connexion.', true);
      return;
    }
    await busy(null, async () => {
      log('info', 'Retour reçu de ' + pend.name + ', création de la session…');
      const s = await client().createSession(p.get('code'));
      delete S.pending[state];
      const accounts = (s.accounts || []).map(a => typeof a === 'string' ? { uid: a } : a).map(a => ({
        uid: a.uid,
        name: a.name || a.product || a.details || '',
        product: a.product || '',
        type: a.cash_account_type || '',
        currency: a.currency || 'EUR',
        iban: (a.account_id && (a.account_id.iban || (a.account_id.other && a.account_id.other.identification))) || ''
      }));
      S.sessions[s.session_id] = {
        bank: pend.name, country: pend.country,
        valid_until: (s.access && s.access.valid_until) || '',
        created: new Date().toISOString(), accounts
      };
      save();
      log('ok', pend.name + ' : session créée, ' + accounts.length + ' compte(s), accès jusqu\'au ' + fmtDate((s.access && s.access.valid_until) || ''));
      toast(pend.name + ' connecté : ' + accounts.length + ' compte(s).');
      renderSessions();
      $('secAccounts').scrollIntoView({ behavior: 'smooth' });
    });
    // nettoie l'adresse en mode navigateur
    if (!isNative && location.search) history.replaceState(null, '', location.pathname);
  }

  // ------------------------------------------------------------ 3. comptes et opérations
  function renderSessions() {
    const ids = Object.keys(S.sessions);
    $('btnRefreshAll').hidden = !ids.length;
    if (!ids.length) { $('sessions').innerHTML = '<p class="muted">Aucune banque connectée.</p>'; return; }
    const now = new Date().toISOString();
    $('sessions').innerHTML = ids.map(id => {
      const s = S.sessions[id];
      const expired = s.valid_until && s.valid_until < now;
      const soon = s.valid_until && !expired && s.valid_until < new Date(Date.now() + 14 * 864e5).toISOString();
      return '<div class="sess"><div class="row"><b class="grow">' + esc(s.bank) + ' <span class="chip">' + esc(s.country) + '</span></b>' +
        '<button class="btn danger small" data-del="' + esc(id) + '">Déconnecter</button></div>' +
        '<p class="muted">' + (expired ? '<span class="bad">Accès expiré le ' + fmtDate(s.valid_until) + '</span>'
          : 'Accès jusqu\'au ' + fmtDate(s.valid_until) + (soon ? ' <span class="bad">(bientôt expiré)</span>' : '')) + '</p>' +
        (s.accounts.length ? s.accounts.map(a => renderAccount(a)).join('') : '<p class="muted">Aucun compte renvoyé par la banque.</p>') +
        '</div>';
    }).join('');
  }

  function renderAccount(a) {
    const d = S.data[a.uid] || {};
    const bals = (d.balances || []).map(b => {
      const amt = parseFloat(b.balance_amount && b.balance_amount.amount);
      const cur = (b.balance_amount && b.balance_amount.currency) || a.currency;
      const txt = isNaN(amt) ? '?' : fmtMoney(Math.abs(amt), cur) + (amt < 0 ? ' débiteur' : '');
      return '<span>' + esc(BAL[b.balance_type] || b.balance_type || 'Solde') + ' <b>' + esc(txt) + '</b>' +
        (b.reference_date ? ' <small class="muted">au ' + fmtDate(b.reference_date) + '</small>' : '') + '</span>';
    }).join('');
    const txs = d.txs || [];
    const rows = txs.slice().sort((x, y) => (y.date || '').localeCompare(x.date || '')).map(t =>
      '<tr' + (t.pending ? ' class="p"' : '') + '><td class="d">' + fmtDate(t.date).slice(0, 5) + '</td><td>' + esc(t.label) + (t.pending ? ' (en attente)' : '') + '</td>' +
      '<td class="m">' + (t.amount != null && t.amount < 0 ? esc(fmtMoney(-t.amount, t.currency)) : '') + '</td>' +
      '<td class="m c">' + (t.amount != null && t.amount >= 0 ? esc(fmtMoney(t.amount, t.currency)) : '') + '</td></tr>').join('');
    return '<div class="acct"><div class="head"><div class="grow"><b>' + esc(a.name || 'Compte') + '</b>' +
      '<small>' + esc([a.product !== a.name ? a.product : '', a.type, maskIban(a.iban), a.currency].filter(Boolean).join(' · ')) + '</small></div>' +
      '<button class="btn small" data-fetch="' + esc(a.uid) + '">Récupérer</button></div>' +
      (bals ? '<div class="bal">' + bals + '</div>' : '') +
      (d.fetched ? '<p class="muted">' + txs.length + ' opération(s) depuis le ' + fmtDate(d.from) + ' · lu le ' + new Date(d.fetched).toLocaleString('fr-FR') + '</p>' : '') +
      (d.error ? '<p class="bad">' + esc(d.error) + '</p>' : '') +
      (rows ? '<div class="wrapx"><table class="tx"><thead><tr><td class="d">Date</td><td>Libellé</td><td class="m">Débit</td><td class="m">Crédit</td></tr></thead><tbody>' + rows + '</tbody></table></div>' : '') +
      '</div>';
  }

  function findAccount(uid) {
    for (const id of Object.keys(S.sessions)) {
      const a = S.sessions[id].accounts.find(x => x.uid === uid);
      if (a) return { a, s: S.sessions[id] };
    }
    return null;
  }

  async function fetchAccount(uid) {
    const f = findAccount(uid); if (!f) return;
    const c = client();
    const from = $('dateFrom').value || daysAgo(90);
    const d = S.data[uid] = { from, fetched: null, balances: [], txs: [], error: '' };
    const label = f.s.bank + ' / ' + (f.a.name || 'compte') + ' ' + maskIban(f.a.iban);
    try {
      d.balances = await c.balances(uid);
      log('ok', label + ' : ' + d.balances.length + ' solde(s)');
    } catch (e) { d.error = 'Soldes : ' + e.message; }
    try {
      const raw = await c.transactions(uid, from, (n, p) => { if (p > 1) log('info', label + ' : page ' + p + ', ' + n + ' opérations'); });
      d.txs = raw.map(KladEB.normalize);
      const pend = d.txs.filter(t => t.pending).length;
      const withId = d.txs.filter(t => t.id).length;
      log('ok', label + ' : ' + d.txs.length + ' opération(s) depuis le ' + fmtDate(from) + ' (' + pend + ' en attente, ' + withId + ' avec référence)');
    } catch (e) { d.error = (d.error ? d.error + ' · ' : '') + 'Opérations : ' + e.message; }
    d.fetched = Date.now();
    save(); renderSessions();
  }

  $('sessions').addEventListener('click', ev => {
    const fb = ev.target.closest('[data-fetch]');
    if (fb) return busy(fb, () => fetchAccount(fb.dataset.fetch));
    const del = ev.target.closest('[data-del]');
    if (del) return busy(del, async () => {
      const id = del.dataset.del, s = S.sessions[id];
      if (!confirmInline(del, 'Confirmer ?')) return;
      try { await client().deleteSession(id); } catch (e) { if (e.status !== 404) throw e; }
      s.accounts.forEach(a => delete S.data[a.uid]);
      delete S.sessions[id]; save();
      log('info', s.bank + ' : session supprimée');
      renderSessions();
    });
  });

  // Confirmation sans boîte de dialogue : second appui sur le même bouton dans les 4 s.
  function confirmInline(btn, label) {
    if (btn.dataset.armed === '1') return true;
    const old = btn.textContent; btn.dataset.armed = '1'; btn.textContent = label;
    setTimeout(() => { btn.dataset.armed = ''; btn.textContent = old; }, 4000);
    return false;
  }

  $('btnRefreshAll').addEventListener('click', ev => busy(ev.target, async () => {
    for (const id of Object.keys(S.sessions)) for (const a of S.sessions[id].accounts) await fetchAccount(a.uid);
    toast('Récupération terminée.');
  }));

  // ------------------------------------------------------------ 4. journal / effacement
  async function copy(text, msg) {
    try { await navigator.clipboard.writeText(text); toast(msg || 'Copié.'); }
    catch (e) {
      const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select();
      try { document.execCommand('copy'); toast(msg || 'Copié.'); } catch (e2) { toast('Copie impossible.', true); }
      t.remove();
    }
  }
  $('btnCopyLog').addEventListener('click', () => copy('Klad ' + (CFG.version || '') + ' (' + (CFG.build || 'dev') + ')\n' + S.log.join('\n'), 'Journal copié.'));
  $('btnClearLog').addEventListener('click', () => { S.log = []; save(); renderLog(); });
  $('btnWipe').addEventListener('click', ev => {
    if (!confirmInline(ev.target, 'Appuyer encore pour tout effacer')) return;
    try { localStorage.removeItem(STORE); } catch (e) { /* rien */ }
    S = blank(); S.redirectUrl = defaultRedirect(); save();
    bankList = []; renderAll(); toast('Tout est effacé. Pensez à déconnecter les accès dans les banques si besoin.');
  });

  // ------------------------------------------------------------ démarrage
  function renderAll() { renderKey(); renderBanks(); renderSessions(); renderLog(); }

  $('ver').textContent = 'prototype ' + (CFG.version || 'dev') + (isNative ? '' : ' · navigateur');
  $('dateFrom').value = daysAgo(90);
  // nettoie les autorisations restées en suspens plus d'une heure
  Object.keys(S.pending).forEach(k => { if (Date.now() - (S.pending[k].ts || 0) > 3600e3) delete S.pending[k]; });
  save();
  renderAll();

  if (AppP) {
    AppP.addListener('appUrlOpen', ev => handleReturn(ev && ev.url));
    AppP.getLaunchUrl().then(r => r && r.url && handleReturn(r.url)).catch(() => {});
  } else if (location.search.indexOf('code=') >= 0 || location.search.indexOf('error=') >= 0) {
    handleReturn(location.href);   // essai dans un navigateur
  }
  log('info', 'Démarrage ' + (isNative ? 'Android' : 'navigateur') + ', ' + Object.keys(S.sessions).length + ' session(s)');
})();
