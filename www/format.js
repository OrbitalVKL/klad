// Klad — mise en forme pour l'écran : montants en centimes (jamais de signe affiché), dates, durées.
// Fonctions pures, testées dans node (test/format.test.mjs).
(function (g) {
  'use strict';

  // ------------------------------------------------------------ montants
  // Un montant est un nombre entier de centimes, signé (débit < 0, crédit > 0). Le signe ne sort jamais à l'écran :
  // on écrit « débit / crédit » (colonnes) ou « débiteur ».
  const NF = {};
  function nf(cur) {
    if (!NF[cur]) NF[cur] = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: cur, minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return NF[cur];
  }

  // Valeur absolue, toujours positive : « 1 234,56 € ».
  function montant(c, cur) {
    const a = Math.abs(Number(c) || 0);
    try { return nf(cur || 'EUR').format(a / 100); }
    catch (e) { return Math.floor(a / 100) + ',' + String(a % 100).padStart(2, '0') + ' ' + (cur || ''); }
  }

  // Solde : « 1 234,56 € » ou « 1 234,56 € débiteur ».
  function solde(c, cur) { return montant(c, cur) + (c < 0 ? ' débiteur' : ''); }

  // Saisie de l'utilisateur (« 1 234,56 », « 12.5 € ») → centimes positifs ; null si illisible ou signée.
  function saisie(txt) {
    const s = String(txt == null ? '' : txt).replace(/[\s\u00a0\u202f\u20ac]/g, '');
    const m = s.match(/^(\d*)(?:[.,](\d{0,2}))?$/);
    if (!m || (!m[1] && !m[2])) return null;
    const c = parseInt(m[1] || '0', 10) * 100 + parseInt(((m[2] || '') + '00').slice(0, 2), 10);
    return Number.isSafeInteger(c) ? c : null;
  }

  // Centimes → texte de saisie (« 1234,56 »), sans signe.
  function versSaisie(c) {
    const a = Math.abs(Number(c) || 0);
    return Math.floor(a / 100) + ',' + String(a % 100).padStart(2, '0');
  }

  // ------------------------------------------------------------ dates (AAAA-MM-JJ, sans fuseau)
  const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

  const utc = iso => new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)));

  function date(iso) { return iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : ''; }

  // « mardi 3 janvier 2023 » ; l'année est omise si c'est celle de ref (AAAA).
  function jour(iso, annee) {
    const d = utc(iso);
    return JOURS[d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + MOIS[d.getUTCMonth()] +
      (annee && iso.slice(0, 4) === String(annee) ? '' : ' ' + d.getUTCFullYear());
  }

  // Durée écoulée depuis ts (ms ou ISO) : « à l'instant », « il y a 5 min », « il y a 3 h », « il y a 2 j ».
  function ilYa(ts, now) {
    const t = typeof ts === 'number' ? ts : Date.parse(ts);
    if (!t) return 'jamais';
    const s = Math.max(0, Math.floor(((now == null ? Date.now() : +now) - t) / 1000));
    if (s < 60) return 'à l\'instant';
    if (s < 3600) return 'il y a ' + Math.floor(s / 60) + ' min';
    if (s < 86400) return 'il y a ' + Math.floor(s / 3600) + ' h';
    return 'il y a ' + Math.floor(s / 86400) + ' j';
  }

  // « 14:05 »
  function heure(ts) { const d = new Date(ts); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }

  g.KladFormat = { montant, solde, saisie, versSaisie, date, jour, ilYa, heure };
})(typeof window !== 'undefined' ? window : globalThis);
