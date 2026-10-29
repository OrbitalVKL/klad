// Klad — anonymisation du journal : aucun nom (titulaire, banque, compte), identifiant, IBAN ni e-mail.
// Les banques sont désignées par un alias stable (« Banque A »), les comptes par leur rang (« compte 1 »).
(function (g) {
  'use strict';

  // Alias stable d'une banque, mémorisé dans map (nom → alias).
  function bankAlias(map, name) {
    const key = String(name || '?');
    if (!map[key]) {
      const n = Object.keys(map).length;
      map[key] = 'Banque ' + (n < 26 ? String.fromCharCode(65 + n) : n + 1);
    }
    return map[key];
  }

  function accountLabel(map, bank, index) {
    return bankAlias(map, bank) + ' · compte ' + (index + 1);
  }

  // Filet de sécurité appliqué à chaque ligne du journal.
  function scrub(text) {
    return String(text == null ? '' : text)
      .replace(/sk-ant-[\w-]+/g, '[clé]')
      .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[e-mail]')
      .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '…')
      .replace(/\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]){10,30}\b/g, '[IBAN]')
      .replace(/\d(?:[ .]?\d){5,}/g, '[n°]');
  }

  g.KladAnon = { bankAlias, accountLabel, scrub };
})(typeof window !== 'undefined' ? window : globalThis);
