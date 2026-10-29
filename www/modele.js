// Klad — modèle de données : comptes, connexions bancaires, opérations, soldes ; dédoublonnage ; frontière de reprise ;
// découpage en blocs chiffrés ; migration des données 0.2.
// Fonctions pures (sauf l'empreinte d'IBAN, qui utilise WebCrypto), testées dans node (test/modele.test.mjs).
//
// État en mémoire après déverrouillage :
//   S = { cle, modele, soldes, ops: { <compte>: [opération…] }, carnet, journal }
// Les montants sont des centimes entiers signés (débit < 0). Les dates sont des chaînes AAAA-MM-JJ.
(function (g) {
  'use strict';

  const V = 3;                                   // version du bloc « modele »
  const ROLES = ['courant', 'carte_differee', 'paiement_en_ligne', 'epargne', 'commun'];
  const ISO = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
  const BLOC_OPS = /^ops-([a-z0-9]{8})-(\d{4})$/;
  const PURGE_JOURS = 10;                        // opération en cours disparue : retirée 10 jours après sa date
  const RAPPROCHE_JOURS = 4;                     // en cours → comptabilisée : dates à 4 jours au plus
  const HISTO_MAX = 1500;                        // historique quotidien des soldes : jours gardés par compte
  const SOLDES_PREF = ['CLBD', 'ITAV', 'CLAV', 'XPCD', 'ITBD', 'OPBD', 'PRCD', 'INFO', 'OTHR'];

  const enc = new TextEncoder();

  // ------------------------------------------------------------ outils
  function centimes(txt) {
    const m = String(txt == null ? '' : txt).trim().match(/^([+-]?)(\d*)(?:\.(\d*))?$/);
    if (!m || (!m[2] && !m[3])) return null;
    const frac = m[3] || '';
    let c = parseInt(m[2] || '0', 10) * 100 + parseInt((frac + '00').slice(0, 2), 10);
    if (frac.length > 2 && +frac[2] >= 5) c += 1;          // plus de 2 décimales : arrondi au centime le plus proche
    if (!Number.isSafeInteger(c)) return null;
    return m[1] === '-' && c ? -c : c;
  }

  const jourNum = iso => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 864e5;
  const ecart = (a, b) => jourNum(a) - jourNum(b);
  function plusJours(iso, n) { return new Date((jourNum(iso) + n) * 864e5).toISOString().slice(0, 10); }
  // Date du jour à l'heure du téléphone.
  function jourLocal(now) { const d = new Date(now); return new Date(d.getTime() - d.getTimezoneOffset() * 60e3).toISOString().slice(0, 10); }
  function dateValide(s) { return typeof s === 'string' && ISO.test(s) && plusJours(s, 0) === s; }

  // Clé de comparaison d'un libellé : majuscules sans accents, signes remplacés par des espaces.
  function cleLibelle(s) {
    return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
      .replace(/[^A-Z0-9]+/g, ' ').trim();
  }
  // Références d'un libellé : mots d'au moins 10 caractères contenant un chiffre.
  function references(cle) { return cle.split(' ').filter(w => w.length >= 10 && /\d/.test(w)); }

  // Deux libellés désignent-ils la même opération (en cours puis comptabilisée) ?
  // Oui s'ils partagent une référence, ou si l'un prolonge l'autre. Si chacun porte ses propres références
  // et qu'aucune n'est commune (prélèvements récurrents), non.
  function compatibles(a, b) {
    const ka = cleLibelle(a), kb = cleLibelle(b);
    const ra = references(ka), rb = references(kb);
    if (ra.length && rb.length) return ra.some(x => rb.indexOf(x) >= 0);
    const [s, l] = ka.length <= kb.length ? [ka, kb] : [kb, ka];
    return s.length > 0 && l.slice(0, s.length) === s;
  }

  // Hachage court et synchrone (cyrb53) : sert seulement à fabriquer des identifiants.
  function hash(str) {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
  }

  function nouvelId(existants) {
    const A = 'abcdefghijklmnopqrstuvwxyz0123456789';
    for (;;) {
      const r = new Uint8Array(8); g.crypto.getRandomValues(r);
      const id = Array.from(r, x => A[x % 36]).join('');
      if (!existants || existants.indexOf(id) < 0) return id;
    }
  }

  function aleatoireB64(n) {
    const r = new Uint8Array(n); g.crypto.getRandomValues(r);
    return btoa(String.fromCharCode.apply(null, r));
  }

  // ------------------------------------------------------------ état vide
  function nouveauModele() {
    return {
      v: V, sel: aleatoireB64(16),
      comptes: [], connexions: {}, pending: {}, banks: {}, alias: {},
      sync: { derniere: null }, blocs: {}, reprise: null
    };
  }

  function vide() {
    return { cle: { appId: '', pem: '', redirectUrl: '' }, modele: nouveauModele(), soldes: {}, ops: {}, carnet: null, classement: null, budget: null, journal: { log: [] } };
  }

  // ------------------------------------------------------------ comptes
  const compte = (S, id) => S.modele.comptes.find(c => c.id === id) || null;
  const comptesTries = S => S.modele.comptes.slice().sort((a, b) => a.ordre - b.ordre);
  const opsDe = (S, id) => S.ops[id] || (S.ops[id] = []);

  function roleDefaut(type) {
    return type === 'SVGS' ? 'epargne' : type === 'CARD' ? 'carte_differee' : 'courant';
  }

  function nouveauCompte(S, champs) {
    const ids = S.modele.comptes.map(c => c.id);
    const c = Object.assign({
      id: nouvelId(ids), libelle: 'Compte', role: 'courant', devise: 'EUR', masque: false,
      ordre: S.modele.comptes.reduce((m, x) => Math.max(m, x.ordre + 1), 0),
      source: { type: 'manuel' }, sync: {}
    }, champs);
    S.modele.comptes.push(c);
    return c;
  }

  // Compte d'une session Enable Banking → forme commune. L'IBAN complet n'est gardé que le temps de calculer l'empreinte.
  function compteEB(a) {
    if (typeof a === 'string') a = { uid: a };
    const id = a.account_id || {};
    const iban = String(id.iban || '').replace(/\s/g, '').toUpperCase();
    const other = String((id.other && id.other.identification) || '');
    const fin = (iban || other).replace(/[^A-Za-z0-9]/g, '');
    return {
      uid: a.uid, nom: a.name || a.details || '', produit: a.product || '', type: a.cash_account_type || '',
      devise: a.currency || 'EUR', iban, fin4: fin.length >= 4 ? fin.slice(-4) : '', hash: a.identification_hash || null
    };
  }

  // Empreinte salée d'un compte bancaire (HMAC-SHA256) : retrouve le compte d'une session à l'autre sans garder l'IBAN.
  async function empreinte(sel, a) {
    const src = a.iban ? 'iban:' + a.iban : a.hash ? 'eb:' + a.hash : null;
    if (!src) return null;
    const bin = atob(sel);
    const k = await g.crypto.subtle.importKey('raw', Uint8Array.from(bin, ch => ch.charCodeAt(0)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = new Uint8Array(await g.crypto.subtle.sign('HMAC', k, enc.encode(src)));
    return Array.from(sig.subarray(0, 16), x => x.toString(16).padStart(2, '0')).join('');
  }

  // Nouvelle session (connexion ou renouvellement) : réassocie les comptes Klad par empreinte, crée les autres.
  // info : { banque, pays, valid_until, psu, maxSecondes, renouvelle }. comptesEB : formes communes ; emp : uid → empreinte.
  // → { associes, nouveaux, perdus, orphelines } (orphelines : sessions remplacées, à supprimer chez Enable Banking).
  function associerSession(S, sid, info, comptesEB, emp, now) {
    const M = S.modele;
    const r = { associes: 0, nouveaux: 0, perdus: 0, orphelines: [] };
    M.connexions[sid] = {
      banque: info.banque, pays: info.pays, valid_until: info.valid_until || '', cree: new Date(now).toISOString(),
      psu: Array.isArray(info.psu) ? info.psu : null, maxSecondes: info.maxSecondes || null
    };
    const pris = new Set();
    for (const a of comptesEB) {
      const e = emp[a.uid] || null;
      let c = M.comptes.find(x => !pris.has(x.id) && x.source.type === 'eb' && e && x.source.empreinte === e)
        || M.comptes.find(x => !pris.has(x.id) && x.source.type === 'eb' && x.source.uid === a.uid);
      if (c) {
        Object.assign(c.source, { connexion: sid, uid: a.uid, empreinte: e || c.source.empreinte || null, fin4: a.fin4 || c.source.fin4 || '' });
        delete c.aReassocier;
        r.associes++;
      } else {
        c = nouveauCompte(S, {
          libelle: (a.produit || a.nom || 'Compte').slice(0, 24), role: roleDefaut(a.type), devise: a.devise,
          source: { type: 'eb', connexion: sid, uid: a.uid, empreinte: e, fin4: a.fin4, intitule: (a.produit || a.nom || '').slice(0, 60) },
          aVerifier: true
        });
        r.nouveaux++;
      }
      pris.add(c.id);
    }
    const old = info.renouvelle;
    if (old && old !== sid) {
      for (const c of M.comptes) if (c.source.type === 'eb' && c.source.connexion === old) { c.aReassocier = true; r.perdus++; }
    }
    // Sessions dont tous les comptes sont passés à la nouvelle : à supprimer (ici et chez Enable Banking).
    for (const k of Object.keys(M.connexions)) {
      if (k !== sid && !M.comptes.some(c => c.source.type === 'eb' && c.source.connexion === k)) { delete M.connexions[k]; r.orphelines.push(k); }
    }
    return r;
  }

  // Comptes Klad rattachés à une connexion.
  const comptesDe = (S, sid) => comptesTries(S).filter(c => c.source.type === 'eb' && c.source.connexion === sid);

  function supprimerCompte(S, id) {
    const M = S.modele;
    M.comptes = M.comptes.filter(c => c.id !== id);
    delete S.ops[id]; delete S.soldes[id];
    for (const c of M.comptes) if (c.prelevement && c.prelevement.compte === id) delete c.prelevement.compte;
    if (M.reprise && M.reprise.map) for (const k of Object.keys(M.reprise.map)) if (M.reprise.map[k] === id) delete M.reprise.map[k];
    remplacerCompte(S, id, null);
  }

  // Références à un compte dans le classement (règles) : remplacées par un autre compte, ou retirées (vers null).
  function remplacerCompte(S, ancien, nouveau) {
    const C = S.classement;
    if (!C) return;
    for (const u of C.regles || []) if (u.compte === ancien) { if (nouveau) u.compte = nouveau; else delete u.compte; }
    for (const b of C.base || []) if (b.comptes && b.comptes.indexOf(ancien) >= 0) {
      b.comptes = b.comptes.map(x => x === ancien ? nouveau : x).filter(Boolean);
      if (!b.comptes.length) delete b.comptes;
    }
  }

  // Réassociation manuelle : le compte « à réassocier » (ancien) reprend la source bancaire d'un compte bancaire
  // disponible (nouveau), créé par une connexion. Les opérations du nouveau rejoignent l'ancien (identifiants refaits ;
  // une opération déjà présente n'est pas doublée), ses soldes aussi ; le nouveau compte est retiré.
  // → { deplacees, doublons }.
  function reassocier(S, ancienId, nouveauId) {
    const a = compte(S, ancienId), n = compte(S, nouveauId);
    if (!a || !n || a === n || n.source.type !== 'eb') throw new Error('Réassociation impossible.');
    const r = { deplacees: 0, doublons: 0 };
    const list = opsDe(S, a.id);
    const ids = new Set(list.map(o => o.id));
    for (const o of S.ops[n.id] || []) {
      const id = a.id + o.id.slice(n.id.length);
      if (ids.has(id)) { r.doublons++; continue; }
      if (a.frontiere && o.source === 'eb' && o.date < a.frontiere) { r.doublons++; continue; }
      const x = Object.assign({}, o, { id, compte: a.id });
      if (x.exEnCours && x.exEnCours.indexOf(n.id) === 0) x.exEnCours = a.id + x.exEnCours.slice(n.id.length);
      list.push(x); ids.add(id); r.deplacees++;
    }
    trier(list);
    if (S.soldes[n.id]) S.soldes[a.id] = S.soldes[n.id];
    a.source = Object.assign({}, n.source);
    a.sync = Object.assign({}, n.sync);
    if (!a.soldeType && n.soldeType) a.soldeType = n.soldeType;
    delete a.aReassocier;
    delete S.ops[n.id];
    remplacerCompte(S, n.id, a.id);
    for (const c of S.modele.comptes) if (c.prelevement && c.prelevement.compte === n.id) c.prelevement.compte = a.id;
    supprimerCompte(S, n.id);
    appliquerFrontiere(S, a.id);
    return r;
  }
  // Comptes bancaires disponibles pour réassocier un compte : comptes d'une connexion active, les nouveaux d'abord.
  function disponibles(S, id) {
    return comptesTries(S).filter(c => c.id !== id && c.source.type === 'eb' && !c.aReassocier && S.modele.connexions[c.source.connexion])
      .sort((x, y) => (y.aVerifier ? 1 : 0) - (x.aVerifier ? 1 : 0));
  }

  // ------------------------------------------------------------ opérations
  // Opération Enable Banking → candidate (sans id) ; null si annulée, rejetée ou illisible.
  function depuisEB(t) {
    const st = t.status || 'BOOK';
    if (st === 'CNCL' || st === 'RJCT') return null;
    let m = centimes(t.transaction_amount && t.transaction_amount.amount);
    if (m == null) return null;
    if (t.credit_debit_indicator) m = Math.abs(m) * (t.credit_debit_indicator === 'DBIT' ? -1 : 1) || 0;
    const date = t.booking_date || t.value_date || t.transaction_date || '';
    if (!dateValide(date)) return null;
    const label = g.KladEB.label(t), cp = g.KladEB.counterparty(t);
    return {
      date, dateValeur: dateValide(t.value_date) && t.value_date !== date ? t.value_date : null,
      montant: m, libelle: label, contrepartie: cp || null,
      statut: st === 'BOOK' ? 'comptabilisee' : 'en_cours', ref: t.entry_reference || t.transaction_id || null
    };
  }

  // Identifiants : <compte>:r:<référence> pour une comptabilisée avec référence ; sinon
  // <compte>:<p|h|k>:<empreinte(date|montant|libellé)>:<rang parmi les identiques du même jour>.
  // prefixe : 'h' (Enable Banking) ou 'k' (reprise) ; 'p' pour les opérations en cours. x.idExterne → <compte>:x:<id>.
  function doterIds(cid, cands, prefixe) {
    const rangs = {}, vus = new Set();
    for (const x of cands) {
      let id;
      if (x.idExterne) id = cid + ':x:' + x.idExterne;
      else if (x.statut === 'comptabilisee' && x.ref && prefixe === 'h') id = cid + ':r:' + x.ref;
      else {
        const p = x.statut === 'en_cours' ? 'p' : prefixe;
        const k = p + '|' + x.date + '|' + x.montant + '|' + cleLibelle(x.libelle);
        rangs[k] = (rangs[k] || 0) + 1;
        id = cid + ':' + p + ':' + hash(k) + ':' + (rangs[k] - 1);
      }
      let u = id, n = 1;
      while (vus.has(u)) u = id + '~' + (n++);       // référence répétée par la banque : on garde les deux
      vus.add(u);
      x.id = u;
    }
    return cands;
  }

  const CHAMPS = ['date', 'dateValeur', 'montant', 'libelle', 'contrepartie', 'statut', 'ref'];
  function poser(o, x) {
    let ch = false;
    for (const k of CHAMPS) {
      const v = x[k] == null ? undefined : x[k];
      if (o[k] !== v) { if (v === undefined) delete o[k]; else o[k] = v; ch = true; }
    }
    return ch;
  }

  function nouvelleOp(cid, x, source, jour) {
    const o = { id: x.id, compte: cid };
    poser(o, x);
    o.source = source; o.apparue = jour; o.categorie = null; o.vue = false;
    return o;
  }

  const trier = list => list.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  // En cours → comptabilisée (une pour une, date la plus proche d'abord). Renvoie le nombre de fusions.
  function rapprocher(list) {
    const pend = list.filter(o => o.statut === 'en_cours' && o.source === 'eb').sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const book = list.filter(o => o.statut === 'comptabilisee' && o.source === 'eb');
    const retirer = new Set();
    let n = 0;
    for (const p of pend) {
      if (book.some(b => b.exEnCours === p.id)) { retirer.add(p.id); continue; }   // déjà fusionnée, encore listée
      let best = null, bd = Infinity;
      for (const b of book) {
        if (b.exEnCours || b.montant !== p.montant) continue;
        const d = Math.abs(ecart(b.date, p.date));
        if (d > RAPPROCHE_JOURS || !compatibles(p.libelle, b.libelle)) continue;
        if (d < bd || (d === bd && b.date < best.date)) { best = b; bd = d; }
      }
      if (!best) continue;
      best.exEnCours = p.id;
      if (p.apparue < best.apparue) best.apparue = p.apparue;
      if (best.categorie == null && p.categorie != null) best.categorie = p.categorie;
      if (p.vue) best.vue = true;
      retirer.add(p.id);
      n++;
    }
    if (retirer.size) for (let i = list.length - 1; i >= 0; i--) if (retirer.has(list[i].id)) list.splice(i, 1);
    return n;
  }

  // Jour de la frontière : l'opération Enable Banking x est-elle déjà dans la reprise du compte ? Même jour, même
  // montant, libellés compatibles (même libellé normalisé, l'un prolongeant l'autre, ou référence commune).
  // Une pour une : pris garde les opérations de reprise déjà retrouvées.
  function dejaReprise(list, x, pris) {
    const o = list.find(r => r.source === 'reprise' && !pris.has(r.id) && r.date === x.date && r.montant === x.montant && compatibles(r.libelle, x.libelle));
    if (o) pris.add(o.id);
    return !!o;
  }

  // Intègre un relevé Enable Banking (opérations brutes) dans le compte cid.
  // Frontière de reprise : dates antérieures ignorées ; jour même accepté, sauf opération déjà dans la reprise.
  // Crédit de règlement d'une carte ou d'un portefeuille (« prélèvement automatique … merci », « paiement reçu ») :
  // écarté à l'import, comme dans l'ancienne version. Motif réglé dans la fiche du compte (« remboursements »,
  // pré-rempli par le complément), jamais dans le code ; sans motif, rien n'est écarté.
  function creditDeReglement(c, x) {
    if (!c || (c.role !== 'carte_differee' && c.role !== 'paiement_en_ligne') || !(x.montant > 0)) return false;
    const K = g.KladClasse;
    const mots = K && c.prelevement ? K.motifs(c.prelevement.remboursements) : [];
    if (!mots.length) return false;
    const L = K.fold(x.libelle);
    return mots.some(m => L.indexOf(m) >= 0);
  }

  function integrer(S, cid, raw, now) {
    const c = compte(S, cid);
    const jour = jourLocal(now);
    const front = (c && c.frontiere) || '';
    const st = { lues: (raw || []).length, nouvelles: 0, maj: 0, fusionnees: 0, retirees: 0, ignorees: 0, reprises: 0, ecartees: 0 };
    const cands = [];
    for (const t of raw || []) {
      const x = depuisEB(t);
      if (!x || (front && x.date < front)) { st.ignorees++; continue; }
      if (creditDeReglement(c, x)) { st.ecartees++; continue; }
      cands.push(x);
    }
    doterIds(cid, cands, 'h');
    const list = opsDe(S, cid);
    const parId = new Map(list.map(o => [o.id, o]));
    const absorbees = new Set(list.map(o => o.exEnCours).filter(Boolean));
    const vues = new Set();
    const pris = new Set();
    for (const x of cands) {
      if (x.statut === 'en_cours') vues.add(x.id);
      const o = parId.get(x.id);
      if (o) {
        if (poser(o, x)) st.maj++;
        delete o.absente;
      } else if (front && x.date === front && dejaReprise(list, x, pris)) {
        st.ignorees++; st.reprises++;
      } else if (!absorbees.has(x.id)) {
        const n = nouvelleOp(cid, x, 'eb', jour);
        list.push(n); parId.set(n.id, n);
        st.nouvelles++;
      }
    }
    for (const o of list) if (o.source === 'eb' && o.statut === 'en_cours' && !vues.has(o.id) && !o.absente) o.absente = jour;
    st.fusionnees = rapprocher(list);
    for (let i = list.length - 1; i >= 0; i--) {
      const o = list[i];
      if (o.statut === 'en_cours' && o.absente && ecart(jour, o.date) > PURGE_JOURS) { list.splice(i, 1); st.retirees++; }
    }
    trier(list);
    return st;
  }

  // Début de la prochaine récupération : dernière date comptabilisée (Enable Banking) − 5 jours, jamais avant la
  // frontière de reprise (le jour même est relu, dédoublonné contre la reprise), jamais après aujourd'hui (la banque
  // refuse une date future : erreur 422). from null → la plus longue période acceptée par la banque.
  // → { from, ramenee } ; ramenee : la date calculée était dans le futur.
  function bornesRecuperation(S, c, now) {
    if (c.sync && c.sync.relire) return { from: c.frontiere || null, ramenee: false };     // relecture de tout l'historique
    let max = '';
    for (const o of S.ops[c.id] || []) if (o.source === 'eb' && o.statut === 'comptabilisee' && o.date > max) max = o.date;
    let from = max ? plusJours(max, -5) : null;
    if (c.frontiere && (!from || from < c.frontiere)) from = c.frontiere;
    const auj = jourLocal(now == null ? Date.now() : now);
    if (from && from > auj) return { from: auj, ramenee: true };
    return { from, ramenee: false };
  }
  const debutRecuperation = (S, c, now) => bornesRecuperation(S, c, now).from;

  // Frontière : les opérations Enable Banking datées d'avant la frontière sont retirées, et celles du jour même
  // qui sont déjà dans la reprise.
  function appliquerFrontiere(S, cid) {
    const c = compte(S, cid);
    if (!c || !c.frontiere || !S.ops[cid]) return 0;
    const list = S.ops[cid], f = c.frontiere, pris = new Set();
    S.ops[cid] = list.filter(o => o.source !== 'eb' || o.date > f || (o.date === f && !dejaReprise(list, o, pris)));
    return list.length - S.ops[cid].length;
  }

  // ------------------------------------------------------------ soldes
  function soldePrefere(types, choix) {
    if (!types) return null;
    if (choix && types[choix]) return Object.assign({ type: choix }, types[choix]);
    for (const t of SOLDES_PREF) if (types[t]) return Object.assign({ type: t }, types[t]);
    const k = Object.keys(types)[0];
    return k ? Object.assign({ type: k }, types[k]) : null;
  }

  function soldesLus(S, cid, raw, now) {
    const s = S.soldes[cid] || (S.soldes[cid] = { types: {}, jours: {} });
    const lu = new Date(now).toISOString();
    let n = 0;
    for (const b of raw || []) {
      let m = centimes(b.balance_amount && b.balance_amount.amount);
      if (m == null) continue;
      if (b.credit_debit_indicator === 'DBIT') m = -Math.abs(m);
      s.types[b.balance_type || 'OTHR'] = { centimes: m, dateRef: b.reference_date || null, lu };
      n++;
    }
    const c = compte(S, cid);
    const p = soldePrefere(s.types, c && c.soldeType);
    if (n && p) {
      s.jours[jourLocal(now)] = p.centimes;
      const ks = Object.keys(s.jours).sort();
      for (let i = 0; i < ks.length - HISTO_MAX; i++) delete s.jours[ks[i]];
    }
    return n;
  }

  // Solde affiché d'un compte : { centimes, lu, dateRef } ou null.
  function soldeAffiche(S, c) {
    if (c.source.type === 'manuel') return c.solde ? { centimes: c.solde.centimes, lu: c.solde.date, dateRef: c.solde.date } : null;
    const p = soldePrefere(S.soldes[c.id] && S.soldes[c.id].types, c.soldeType);
    return p ? { centimes: p.centimes, lu: p.lu, dateRef: p.dateRef, type: p.type } : null;
  }

  // Total des comptes courants visibles (en euros) : { centimes, n }.
  function totalCourants(S) {
    let t = 0, n = 0;
    for (const c of S.modele.comptes) {
      if (c.role !== 'courant' || c.masque || c.devise !== 'EUR') continue;
      const s = soldeAffiche(S, c);
      if (s) { t += s.centimes; n++; }
    }
    return { centimes: t, n };
  }

  // ------------------------------------------------------------ alertes
  // Accès bancaire : 'expire', 'bientot' (moins de 14 jours) ou null.
  function etatAcces(cx, now) {
    if (!cx || !cx.valid_until) return null;
    const t = Date.parse(cx.valid_until);
    if (!t) return null;
    if (t <= now) return 'expire';
    return t - now < 14 * 864e5 ? 'bientot' : null;
  }

  // Alerte d'un compte : texte court, ou null.
  function alerteCompte(S, c, now) {
    if (c.source.type !== 'eb') return null;
    const cx = S.modele.connexions[c.source.connexion];
    if (c.aReassocier || !cx) return 'Compte à réassocier';
    const a = etatAcces(cx, now);
    if (a === 'expire') return 'Accès bancaire expiré';
    if (c.sync && c.sync.erreur) return 'Dernière lecture en erreur';
    const lu = c.sync && c.sync.lu ? Date.parse(c.sync.lu) : 0;
    if (!lu || now - lu > 30 * 3600e3) return 'Relevé de plus de 30 h';
    if (a === 'bientot') return 'Accès à renouveler';
    return null;
  }

  // ------------------------------------------------------------ blocs chiffrés
  // cle, modele, soldes, journal, carnet, classement et budget (s'ils existent) et un bloc d'opérations par compte et par année :
  // une synchro ne touche que l'année en cours, l'historique n'est pas réécrit.
  function versBlocs(S) {
    const b = {}, index = {};
    for (const cid of Object.keys(S.ops)) {
      const parAn = {};
      for (const o of S.ops[cid]) (parAn[o.date.slice(0, 4)] || (parAn[o.date.slice(0, 4)] = [])).push(o);
      const ans = Object.keys(parAn).sort();
      if (!ans.length) continue;
      index[cid] = ans;
      for (const y of ans) b['ops-' + cid + '-' + y] = { ops: parAn[y] };
    }
    S.modele.blocs = index;
    b.cle = S.cle; b.modele = S.modele; b.soldes = S.soldes; b.journal = S.journal;
    if (S.carnet != null) b.carnet = { carnet: S.carnet };
    if (S.classement != null) b.classement = S.classement;
    if (S.budget != null) b.budget = S.budget;
    return b;
  }

  function nomsOps(modele) {
    const r = [];
    const idx = (modele && modele.blocs) || {};
    for (const cid of Object.keys(idx)) for (const y of idx[cid]) r.push('ops-' + cid + '-' + y);
    return r;
  }

  function depuisBlocs(blocks) {
    const S = vide();
    if (blocks.cle) S.cle = Object.assign(S.cle, blocks.cle);
    if (blocks.modele) S.modele = blocks.modele;
    if (blocks.soldes) S.soldes = blocks.soldes;
    if (blocks.journal) S.journal = { log: blocks.journal.log || [] };
    if (blocks.carnet) S.carnet = blocks.carnet.carnet;
    if (blocks.classement) S.classement = blocks.classement;
    if (blocks.budget) S.budget = blocks.budget;
    for (const n of Object.keys(blocks)) {
      const m = n.match(BLOC_OPS);
      if (m && blocks[n]) S.ops[m[1]] = (S.ops[m[1]] || []).concat(blocks[n].ops || []);
    }
    for (const cid of Object.keys(S.ops)) trier(S.ops[cid]);
    return S;
  }

  // ------------------------------------------------------------ migration 0.2.x → 0.3.0
  // old : contenu du bloc « comptes » de la 0.2 { sessions, pending, data, banks, alias }.
  // Rien n'est perdu : chaque opération, chaque solde lu et chaque session sont convertis. L'IBAN complet n'est pas repris
  // (empreinte salée + 4 derniers caractères). → S partiel (modele, soldes, ops) et un compte rendu.
  async function depuis02(old, now) {
    const S = vide();
    const M = S.modele;
    M.banks = old.banks || {}; M.alias = old.alias || {};
    for (const st of Object.keys(old.pending || {})) {
      const p = old.pending[st];
      M.pending[st] = { banque: p.name, pays: p.country, ts: p.ts || 0 };
    }
    const r = { sessions: 0, comptes: 0, operations: 0, soldes: 0 };
    for (const sid of Object.keys(old.sessions || {})) {
      const s = old.sessions[sid];
      const ce = (s.accounts || []).map(a => ({
        uid: a.uid, nom: a.name || '', produit: a.product || '', type: a.type || '', devise: a.currency || 'EUR',
        iban: String(a.iban || '').replace(/\s/g, '').toUpperCase(), hash: null
      }));
      ce.forEach(a => { const f = a.iban.replace(/[^A-Za-z0-9]/g, ''); a.fin4 = f.length >= 4 ? f.slice(-4) : ''; });
      const emp = {};
      for (const a of ce) emp[a.uid] = await empreinte(M.sel, a);
      associerSession(S, sid, { banque: s.bank, pays: s.country, valid_until: s.valid_until, psu: null }, ce, emp, now);
      M.connexions[sid].cree = s.created || M.connexions[sid].cree;
      r.sessions++;
    }
    for (const c of M.comptes) {
      r.comptes++;
      const d = (old.data || {})[c.source.uid];
      if (!d) continue;
      const lu = d.fetched ? new Date(d.fetched) : new Date(now);
      const cands = [];
      for (const t of d.txs || []) {
        if (!dateValide(t.date) || typeof t.amount !== 'number' || !isFinite(t.amount)) continue;
        cands.push({ date: t.date, montant: Math.round(t.amount * 100), libelle: String(t.label || 'Opération'),
          statut: t.pending ? 'en_cours' : 'comptabilisee', ref: t.id || null });
      }
      doterIds(c.id, cands, 'h');
      const list = opsDe(S, c.id);
      const jour = jourLocal(lu);
      for (const x of cands) list.push(nouvelleOp(c.id, x, 'eb', jour));
      rapprocher(list);
      trier(list);
      r.operations += list.length;
      r.soldes += soldesLus(S, c.id, d.balances, lu);
      c.sync = { lu: d.fetched ? lu.toISOString() : null, erreur: d.error || null };
    }
    return { S, r };
  }

  // ------------------------------------------------------------ événement « données changées »
  // Point d'accroche unique (synchro, import, réglage, connexion), regroupé sur 300 ms : le résumé Grafit s'y abonne.
  const abonnes = [];
  let attente = null, causes = new Set();
  function surChangement(fn) { abonnes.push(fn); return () => { const i = abonnes.indexOf(fn); if (i >= 0) abonnes.splice(i, 1); }; }
  function signaler(cause, delai) {
    causes.add(cause || 'autre');
    clearTimeout(attente);
    attente = setTimeout(() => {
      const c = [...causes]; causes = new Set(); attente = null;
      abonnes.slice().forEach(fn => { try { fn(c); } catch (e) { /* un abonné défaillant ne bloque pas les autres */ } });
    }, delai == null ? 300 : delai);
  }

  g.KladModele = {
    V, ROLES, centimes, plusJours, jourLocal, dateValide, cleLibelle, references, compatibles, hash, nouvelId,
    vide, nouveauModele, compte, comptesTries, comptesDe, opsDe, roleDefaut, nouveauCompte, compteEB, empreinte,
    associerSession, supprimerCompte, remplacerCompte, reassocier, disponibles, depuisEB, doterIds, nouvelleOp, rapprocher, integrer, bornesRecuperation, debutRecuperation,
    appliquerFrontiere, creditDeReglement, soldePrefere, soldesLus, soldeAffiche, totalCourants, etatAcces, alerteCompte,
    versBlocs, nomsOps, depuisBlocs, BLOC_OPS, depuis02, surChangement, signaler
  };
})(typeof window !== 'undefined' ? window : globalThis);
