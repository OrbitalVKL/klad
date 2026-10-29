// Klad — import manuel d'un relevé (CSV ou JSON) dans un compte. Lecture reprise de l'ancienne version (colonnes
// reconnues par leur intitulé, ordre jour/mois deviné, montants « 1 234,56 » ou « 1,234.56 ») ; format choisi selon le
// rôle du compte : relevé bancaire (débit / crédit ou montant signé), carte à débit différé (dépenses en positif,
// règlements écartés), paiement en ligne (colonnes nom / type / net ; virements, approvisionnements et retenues écartés).
// Les opérations déjà présentes (même jour, même montant, libellés compatibles) sont ignorées ; l'import est annulable.
// Aucune donnée n'est journalisée ; aucune règle propre à l'utilisateur.
(function (g) {
  'use strict';

  const M = () => g.KladModele;

  // ------------------------------------------------------------ lecture
  // CSV → tableau de lignes (séparateur « ; » ou « , » deviné sur la première ligne, guillemets gérés).
  function lignesCSV(text) {
    text = String(text || '').replace(/^﻿/, '');
    const l0 = text.split(/\r?\n/)[0];
    const sep = (l0.match(/;/g) || []).length >= (l0.match(/,/g) || []).length ? ';' : ',';
    const out = [];
    let row = [], cur = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
      else if (c === '"') q = true;
      else if (c === sep) { row.push(cur); cur = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); out.push(row); row = []; cur = ''; }
      else cur += c;
    }
    if (cur || row.length) { row.push(cur); out.push(row); }
    return out.filter(r => r.some(x => String(x).trim()));
  }
  const norm = h => String(h || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');
  // Montant lu → euros (nombre) ; 0 si illisible.
  function nombre(s) {
    if (typeof s === 'number') return s;
    s = String(s || '').replace(/[\s  €"]/g, '');
    if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.'); else s = s.replace(/,/g, '');
    const v = parseFloat(s);
    return isNaN(v) ? 0 : v;
  }
  const p2 = s => String(s).padStart(2, '0');
  // Ordre des dates jj/mm ou mm/jj : un nombre > 12 tranche, sinon les dates dans le futur.
  function ordreDates(vals, auj) {
    let a = 0, b = 0, fa = 0, fb = 0;
    const lim = M().plusJours(auj, 2);
    for (const v of vals) {
      const m = String(v || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
      if (!m) continue;
      const y = m[3].length === 2 ? '20' + m[3] : m[3];
      if (+m[1] > 12) a++;
      if (+m[2] > 12) b++;
      const dmy = y + '-' + p2(m[2]) + '-' + p2(m[1]), mdy = y + '-' + p2(m[1]) + '-' + p2(m[2]);
      if (M().dateValide(dmy) && dmy > lim) fa++;
      if (M().dateValide(mdy) && mdy > lim) fb++;
    }
    if (a !== b) return b > a ? 'mdy' : 'dmy';
    if (fa !== fb) return fa > fb ? 'mdy' : 'dmy';
    return 'dmy';
  }
  function versISO(d, ordre) {
    d = String(d || '').trim();
    let m, out = null;
    if ((m = d.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/))) {
      const y = m[3].length === 2 ? '20' + m[3] : m[3];
      const [dd, mm] = ordre === 'mdy' ? [m[2], m[1]] : [m[1], m[2]];
      out = y + '-' + p2(mm) + '-' + p2(dd);
    } else if ((m = d.match(/^(\d{4})-(\d{2})-(\d{2})/))) out = m[0];
    return out && M().dateValide(out) ? out : null;
  }
  const propre = s => String(s || '').replace(/\s+/g, ' ').trim();

  // Tableau → { lignes: [{ date, libelle, montant (centimes) }], stats: { lues, dateIllisible, sansMontant, ecartees, exemple } }.
  // format : 'banque' | 'carte' | 'portefeuille'.
  function depuisTableau(T, format, auj) {
    const st = { lues: 0, dateIllisible: 0, sansMontant: 0, ecartees: 0, exemple: '' };
    const hi = T.findIndex(r => r.some(c => /^date/.test(norm(c))));
    if (hi < 0) return { lignes: [], stats: st, entete: false };
    st.lues = T.length - hi - 1;
    const H = T[hi].map(norm), col = f => H.findIndex(f), out = [];
    const iD = col(h => h === 'date' || (h.startsWith('date') && !h.includes('valeur') && !h.includes('traitement')));
    const iDe = col(h => h.includes('debit')), iCr = col(h => h.includes('credit'));
    const corps = T.slice(hi + 1);
    const ordre = ordreDates(corps.map(r => r[iD]), auj);
    const date = r => { const d = versISO(r[iD], ordre); if (!d) { st.dateIllisible++; if (!st.exemple) st.exemple = String(r[iD] || '').slice(0, 20); } return d; };
    const pousser = (d, lib, eur) => out.push({ date: d, libelle: propre(lib).slice(0, 140) || 'Opération', montant: Math.round(eur * 100) });
    if (format === 'portefeuille') {
      const iN = col(h => h === 'nom'), iT = col(h => h === 'type'), iE = col(h => h === 'etat' || h === 'statut'), iC = col(h => h === 'devise');
      const iNet = col(h => h === 'net'), iB = col(h => h === 'brut' || h === 'montant'), iO = col(h => h.startsWith('titredelobjet') || h === 'objet');
      for (const r of corps) {
        const d = date(r); if (!d) continue;
        if (iC >= 0 && String(r[iC] || '').trim() && String(r[iC]).trim() !== 'EUR') { st.ecartees++; continue; }
        if (iE >= 0 && r[iE] && !/termin|complet/i.test(r[iE])) { st.ecartees++; continue; }
        const type = String(r[iT] || '');
        if (/virement|approvisionnement|compte bancaire|transfert|autorisation|retenue|annulation de la retenue/i.test(type)) { st.ecartees++; continue; }
        const a = nombre(iNet >= 0 ? r[iNet] : r[iB]);
        if (!a) { st.sansMontant++; continue; }
        if (/conversion/i.test(type) && a > 0) continue;
        pousser(d, (r[iN] || (/conversion/i.test(type) ? 'Achat en devise' : type)) + (iO >= 0 && r[iO] ? ' · ' + r[iO] : ''), a);
      }
      return { lignes: out, stats: st, entete: true };
    }
    if (format === 'carte') {
      const iL = col(h => h.startsWith('description') || h.startsWith('libelle')), iM = col(h => h.startsWith('montant'));
      for (const r of corps) {
        const d = date(r); if (!d) continue;
        const lab = propre(r[iL]);
        if (/PAIEMENT RE[CÇ]U|ENREGISTRE-MERCI|PR[EÉ]L[EÈ]VEMENT AUTOMATIQUE/i.test(lab)) { st.ecartees++; continue; }
        const a = iM >= 0 ? -nombre(r[iM]) : (nombre(r[iCr]) ? Math.abs(nombre(r[iCr])) : -Math.abs(nombre(r[iDe])));
        if (!a) { st.sansMontant++; continue; }
        pousser(d, lab, a);
      }
      return { lignes: out, stats: st, entete: true };
    }
    let iL = col(h => h.startsWith('libel'));
    if (iL < 0) iL = col(h => !h.startsWith('date') && (h.includes('operation') || h.startsWith('description') || h.startsWith('intitule')));
    const iM = col(h => h.startsWith('montant'));
    for (const r of corps) {
      const d = date(r); if (!d) continue;
      const a = iM >= 0 ? nombre(r[iM]) : (nombre(r[iCr]) ? Math.abs(nombre(r[iCr])) : -Math.abs(nombre(r[iDe])));
      if (!a) { st.sansMontant++; continue; }
      pousser(d, r[iL], a);
    }
    return { lignes: out, stats: st, entete: true };
  }

  // JSON : liste d'opérations { date, label | libelle, amount (euros) | montant (euros) }, ou opérations Enable Banking
  // (liste, ou objet { transactions: [...] }).
  function depuisJSON(o) {
    const st = { lues: 0, dateIllisible: 0, sansMontant: 0, ecartees: 0, exemple: '' };
    const L = Array.isArray(o) ? o : (o && Array.isArray(o.transactions) ? o.transactions : o && Array.isArray(o.operations) ? o.operations : null);
    if (!L) return { lignes: [], stats: st, entete: false };
    const out = [];
    st.lues = L.length;
    for (const t of L) {
      if (!t || typeof t !== 'object') { st.ecartees++; continue; }
      if (t.transaction_amount) {
        const x = M().depuisEB(t);
        if (!x) { st.ecartees++; continue; }
        if (x.statut !== 'comptabilisee') { st.ecartees++; continue; }
        out.push({ date: x.date, libelle: propre(x.libelle).slice(0, 140) || 'Opération', montant: x.montant });
        continue;
      }
      const d = M().dateValide(t.date) ? t.date : null;
      if (!d) { st.dateIllisible++; if (!st.exemple) st.exemple = String(t.date || '').slice(0, 20); continue; }
      const v = typeof t.amount === 'number' ? t.amount : typeof t.montant === 'number' ? t.montant : nombre(t.amount != null ? t.amount : t.montant);
      if (!v) { st.sansMontant++; continue; }
      out.push({ date: d, libelle: propre(t.label != null ? t.label : t.libelle).slice(0, 140) || 'Opération', montant: Math.round(v * 100) });
    }
    return { lignes: out, stats: st, entete: true };
  }

  const FORMATS = { courant: 'banque', commun: 'banque', epargne: 'banque', carte_differee: 'carte', paiement_en_ligne: 'portefeuille' };
  // Lit un fichier (texte) pour un compte de rôle donné. → { lignes, stats, entete, sorte: 'csv' | 'json' }.
  function lire(texte, role, auj) {
    const t = String(texte || '').replace(/^﻿/, '').trim();
    if (t[0] === '[' || t[0] === '{') {
      let o;
      try { o = JSON.parse(t); } catch (e) { throw new Error('Fichier JSON illisible.'); }
      return Object.assign(depuisJSON(o), { sorte: 'json' });
    }
    return Object.assign(depuisTableau(lignesCSV(t), FORMATS[role] || 'banque', auj), { sorte: 'csv' });
  }

  // ------------------------------------------------------------ intégration
  const cle = s => M().cleLibelle(s);
  const memeOp = (o, x) => o.date === x.date && o.montant === x.montant &&
    (M().compatibles(o.libelle, x.libelle) || cle(o.libelle).endsWith(cle(x.libelle)) || cle(x.libelle).endsWith(cle(o.libelle)));
  // Ajoute les lignes au compte cid. → { ajoutees: [ids], doublons, du, au }.
  function integrer(S, cid, lignes, now) {
    const list = M().opsDe(S, cid);
    const jour = M().jourLocal(now);
    const cands = (lignes || []).map(x => ({ date: x.date, montant: x.montant, libelle: x.libelle, statut: 'comptabilisee' }));
    M().doterIds(cid, cands, 'f');
    const ids = new Set(list.map(o => o.id)), pris = new Set();
    const res = { ajoutees: [], doublons: 0, du: null, au: null };
    for (const x of cands) {
      if (ids.has(x.id)) { res.doublons++; continue; }
      const o = list.find(y => !pris.has(y.id) && memeOp(y, x));
      if (o) { pris.add(o.id); res.doublons++; continue; }
      const n = M().nouvelleOp(cid, x, 'fichier', jour);
      list.push(n); ids.add(n.id); pris.add(n.id);
      res.ajoutees.push(n.id);
      if (!res.du || x.date < res.du) res.du = x.date;
      if (!res.au || x.date > res.au) res.au = x.date;
    }
    list.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    return res;
  }
  // Annule un import : retire les opérations ajoutées.
  function retirer(S, cid, ids) {
    const set = new Set(ids), list = M().opsDe(S, cid);
    for (let i = list.length - 1; i >= 0; i--) if (set.has(list[i].id)) list.splice(i, 1);
  }

  g.KladReleve = { lignesCSV, nombre, ordreDates, versISO, depuisTableau, depuisJSON, lire, integrer, retirer, FORMATS };
})(typeof window !== 'undefined' ? window : globalThis);
