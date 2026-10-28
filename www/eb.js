// Klad — client Enable Banking (lecture seule) : clé, JWT RS256, appels API.
// Aucune donnée personnelle ici : la clé et l'identifiant sont fournis par l'utilisateur.
(function (g) {
  'use strict';

  const API = 'https://api.enablebanking.com';

  // ------------------------------------------------------------ base64 / DER
  const b64ToBytes = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const b64u = bytes => {
    let s = '';
    const a = new Uint8Array(bytes);
    for (let i = 0; i < a.length; i++) s += String.fromCharCode(a[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  const utf8 = s => new TextEncoder().encode(s);

  function derLen(n) {
    if (n < 0x80) return [n];
    const out = [];
    while (n > 0) { out.unshift(n & 0xff); n >>= 8; }
    return [0x80 | out.length, ...out];
  }
  function der(tag, content) { return Uint8Array.from([tag, ...derLen(content.length), ...content]); }

  // PKCS#1 (« RSA PRIVATE KEY ») → PKCS#8 (« PRIVATE KEY »), seul format accepté par WebCrypto.
  function pkcs1ToPkcs8(pkcs1) {
    const version = Uint8Array.from([0x02, 0x01, 0x00]);
    const algo = Uint8Array.from([0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00]);
    const oct = der(0x04, pkcs1);
    const body = new Uint8Array(version.length + algo.length + oct.length);
    body.set(version, 0); body.set(algo, version.length); body.set(oct, version.length + algo.length);
    return der(0x30, body);
  }

  // Lit un PEM et renvoie les octets PKCS#8. Lève une erreur claire sinon.
  function pemToPkcs8(pem) {
    const txt = String(pem || '').trim();
    if (!txt) throw new Error('Clé vide.');
    if (/ENCRYPTED PRIVATE KEY/.test(txt)) throw new Error('Clé chiffrée par mot de passe : exportez-la sans mot de passe.');
    if (/BEGIN (PUBLIC KEY|CERTIFICATE)/.test(txt) && !/PRIVATE KEY/.test(txt))
      throw new Error('Ce fichier contient une clé publique ou un certificat, pas la clé privée.');
    const m = txt.match(/-----BEGIN ([A-Z ]+)-----([\s\S]+?)-----END \1-----/);
    const kind = m ? m[1] : 'PRIVATE KEY';
    const body = (m ? m[2] : txt).replace(/[^A-Za-z0-9+/=]/g, '');
    let bytes;
    try { bytes = b64ToBytes(body); } catch (e) { throw new Error('Contenu de clé illisible (base64 invalide).'); }
    if (kind === 'RSA PRIVATE KEY') return pkcs1ToPkcs8(bytes);
    if (kind !== 'PRIVATE KEY') throw new Error('Type de clé non pris en charge : ' + kind);
    return bytes;
  }

  async function importKey(pem) {
    const pkcs8 = pemToPkcs8(pem);
    try {
      return await crypto.subtle.importKey('pkcs8', pkcs8, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
    } catch (e) {
      throw new Error('Clé refusée : ce n\'est pas une clé privée RSA valide (' + (e.message || e.name) + ').');
    }
  }

  async function makeJwt(key, kid, ttl = 3600) {
    const now = Math.floor(Date.now() / 1000);
    const head = b64u(utf8(JSON.stringify({ typ: 'JWT', alg: 'RS256', kid })));
    const body = b64u(utf8(JSON.stringify({ iss: 'enablebanking.com', aud: 'api.enablebanking.com', iat: now, exp: now + ttl })));
    const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, utf8(head + '.' + body));
    return head + '.' + body + '.' + b64u(sig);
  }

  // ------------------------------------------------------------ client
  class Client {
    constructor({ appId, pem, log }) {
      this.appId = String(appId || '').trim();
      this.pem = pem;
      this.log = log || (() => {});
      this._key = null;
      this._jwt = null;
      this._jwtExp = 0;
    }
    async token() {
      if (!this.appId) throw new Error('Identifiant d\'application Enable Banking manquant.');
      if (!this._key) this._key = await importKey(this.pem);
      const now = Date.now() / 1000;
      if (!this._jwt || now > this._jwtExp - 120) {
        this._jwt = await makeJwt(this._key, this.appId, 3600);
        this._jwtExp = now + 3600;
      }
      return this._jwt;
    }
    // extra : en-têtes supplémentaires (en-têtes « utilisateur présent » Psu-*).
    async call(method, path, body, extra) {
      const t0 = Date.now();
      const headers = Object.assign({}, extra || {}, { Authorization: 'Bearer ' + await this.token(), Accept: 'application/json' });
      if (body) headers['Content-Type'] = 'application/json';
      let res, txt;
      try {
        res = await fetch(API + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
        txt = await res.text();
      } catch (e) {
        this.log('err', method + ' ' + path.split('?')[0] + ' → réseau : ' + (e.message || e));
        throw new Error('Réseau injoignable (' + (e.message || e) + ').');
      }
      const ms = Date.now() - t0;
      let data = {};
      try { data = txt ? JSON.parse(txt) : {}; } catch (e) { data = { raw: txt.slice(0, 300) }; }
      if (!res.ok) {
        const detail = data.message || data.detail || data.error || data.raw || '';
        this.log('err', method + ' ' + path.split('?')[0] + ' → ' + res.status + ' (' + ms + ' ms) ' + JSON.stringify(detail).slice(0, 300));
        const err = new Error('Enable Banking ' + res.status + ' : ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)).slice(0, 300));
        err.status = res.status; err.data = data; err.code = typeof data.error === 'string' ? data.error : (data.code || '');
        throw err;
      }
      this.log('ok', method + ' ' + path.split('?')[0] + ' → ' + res.status + ' (' + ms + ' ms)');
      return data;
    }
    application() { return this.call('GET', '/application'); }
    aspsps(country) { return this.call('GET', '/aspsps?country=' + encodeURIComponent(country)).then(r => r.aspsps || []); }
    startAuth({ name, country, maxSeconds, redirectUrl, state }) {
      const secs = Math.min(maxSeconds || 90 * 86400, 180 * 86400);
      return this.call('POST', '/auth', {
        access: { valid_until: new Date(Date.now() + secs * 1000 - 3600e3).toISOString() },
        aspsp: { name, country },
        state,
        redirect_url: redirectUrl,
        psu_type: 'personal'
      });
    }
    createSession(code) { return this.call('POST', '/sessions', { code }); }
    session(id) { return this.call('GET', '/sessions/' + encodeURIComponent(id)); }
    deleteSession(id) { return this.call('DELETE', '/sessions/' + encodeURIComponent(id)); }
    balances(uid, headers) { return this.call('GET', '/accounts/' + encodeURIComponent(uid) + '/balances', null, headers).then(r => r.balances || []); }
    details(uid) { return this.call('GET', '/accounts/' + encodeURIComponent(uid) + '/details'); }
    // opts : date de début (AAAA-MM-JJ) ou { dateFrom, strategy, headers }. Sans date : stratégie « longest »
    // (la plus longue période que la banque accepte).
    async transactions(uid, opts, onPage) {
      const o = typeof opts === 'string' ? { dateFrom: opts } : (opts || {});
      let key = null, all = [], pages = 0;
      do {
        const p = [];
        if (o.dateFrom) p.push('date_from=' + o.dateFrom);
        else p.push('strategy=' + (o.strategy || 'longest'));
        if (key) p.push('continuation_key=' + encodeURIComponent(key));
        const r = await this.call('GET', '/accounts/' + encodeURIComponent(uid) + '/transactions?' + p.join('&'), null, o.headers);
        all = all.concat(r.transactions || []);
        key = r.continuation_key || null;
        if (onPage) onPage(all.length, ++pages);
      } while (key && pages < 50);
      return all;
    }
  }

  // ------------------------------------------------------------ mise en forme d'une opération
  // Contrepartie (créancier d'un débit, débiteur d'un crédit), si la banque la fournit.
  function counterparty(t) { return ((t.credit_debit_indicator === 'CRDT' ? t.debtor : t.creditor) || {}).name || ''; }

  // Libellé normalisé : informations de remise (espaces réduits), précédées de la contrepartie si elle n'y figure pas.
  function label(t) {
    const rem = (t.remittance_information || []).join(' ').replace(/\s+/g, ' ').trim();
    const cp = counterparty(t);
    const base = rem || (t.bank_transaction_code && t.bank_transaction_code.description) || 'Opération';
    return (cp && base.toUpperCase().indexOf(cp.toUpperCase()) < 0 ? cp + ' · ' : '') + base;
  }

  function normalize(t) {
    const raw = parseFloat(t.transaction_amount && t.transaction_amount.amount);
    const amt = isNaN(raw) ? null
      : (t.credit_debit_indicator ? Math.abs(raw) * (t.credit_debit_indicator === 'DBIT' ? -1 : 1) : raw);
    return {
      id: t.entry_reference || t.transaction_id || null,
      date: t.booking_date || t.value_date || t.transaction_date || '',
      label: label(t),
      amount: amt == null ? null : Math.round(amt * 100) / 100,
      currency: (t.transaction_amount && t.transaction_amount.currency) || 'EUR',
      pending: !!(t.status && t.status !== 'BOOK')
    };
  }

  // ------------------------------------------------------------ adresse de retour (site GitHub Pages)
  // Dépôt « <compte>.github.io » : site publié à la racine ; sinon sous /<dépôt>/.
  function redirectUrlFor(owner, repo) {
    const host = String(owner).toLowerCase() + '.github.io';
    const r = String(repo || 'klad');
    return 'https://' + host + (r.toLowerCase() === host ? '' : '/' + r) + '/retour.html';
  }

  g.KladEB = { API, Client, importKey, makeJwt, pemToPkcs8, normalize, label, counterparty, redirectUrlFor, _b64u: b64u };
})(typeof window !== 'undefined' ? window : globalThis);
