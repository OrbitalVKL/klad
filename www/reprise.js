// Klad — import de la reprise (format « klad-reprise » v1), produite hors du dépôt depuis l'ancienne version.
// Validation stricte (messages sans aucune donnée : seulement des numéros), aperçu, association des comptes,
// import rejouable (les opérations « reprise » sont remplacées), frontière par compte.
// Fonctions pures, testées dans node (test/reprise.test.mjs).
(function (g) {
  'use strict';

  const M = () => g.KladModele;
  const MAX_COMPTES = 100;
  const MAX_OPS = 500000;

  function fail(msg) { const e = new Error(msg); e.code = 'reprise'; return e; }
  const isObj = o => o != null && typeof o === 'object' && !Array.isArray(o);
  const str = (s, max) => typeof s === 'string' && s.trim().length > 0 && s.length <= max;

  // Texte du fichier → reprise vérifiée et mise en forme. Lève une erreur lisible sinon.
  function lire(texte) {
    let o;
    try { o = JSON.parse(texte); } catch (e) { throw fail('Ce fichier n\'est pas un fichier de reprise Klad (JSON illisible).'); }
    return valider(o);
  }

  function valider(o) {
    if (!isObj(o) || o.format !== 'klad-reprise') throw fail('Ce fichier n\'est pas un fichier de reprise Klad.');
    if (o.v !== 1) throw fail('Reprise de version ' + JSON.stringify(o.v) + ' non prise en charge (version 1 attendue).');
    if (!Array.isArray(o.accounts) || !o.accounts.length) throw fail('Reprise sans compte.');
    if (o.accounts.length > MAX_COMPTES) throw fail('Reprise avec trop de comptes (' + o.accounts.length + ').');
    if (o.transactions != null && !Array.isArray(o.transactions)) throw fail('Liste des opérations illisible.');
    const txs = o.transactions || [];
    if (txs.length > MAX_OPS) throw fail('Reprise avec trop d\'opérations (' + txs.length + ').');

    const refs = new Set();
    o.accounts.forEach((a, i) => {
      if (!isObj(a) || !str(a.ref, 32)) throw fail('Compte n° ' + (i + 1) + ' : référence absente.');
      if (refs.has(a.ref)) throw fail('Compte n° ' + (i + 1) + ' : référence en double.');
      refs.add(a.ref);
    });
    const comptes = o.accounts.map((a, i) => {
      const n = 'Compte n° ' + (i + 1) + ' : ';
      if (!str(a.label, 60)) throw fail(n + 'libellé absent ou trop long.');
      if (M().ROLES.indexOf(a.role) < 0) throw fail(n + 'rôle inconnu.');
      if (a.iban_last4 != null && !(typeof a.iban_last4 === 'string' && /^[A-Za-z0-9]{4}$/.test(a.iban_last4))) throw fail(n + 'fin d\'IBAN illisible.');
      let settle = null;
      if (a.settle != null) {
        if (!isObj(a.settle) || !refs.has(a.settle.account) || a.settle.account === a.ref) throw fail(n + 'compte de prélèvement inconnu.');
        if (a.settle.day != null && !(Number.isInteger(a.settle.day) && a.settle.day >= 1 && a.settle.day <= 31)) throw fail(n + 'jour de prélèvement invalide.');
        settle = { account: a.settle.account, day: a.settle.day == null ? null : a.settle.day };
      }
      if (a.manual != null && typeof a.manual !== 'boolean') throw fail(n + 'indicateur « manuel » invalide.');
      let balance = null;
      if (a.balance != null) {
        if (!isObj(a.balance) || !Number.isSafeInteger(a.balance.amount) || !M().dateValide(a.balance.date)) throw fail(n + 'solde invalide (centimes entiers et date attendus).');
        balance = { centimes: a.balance.amount, date: a.balance.date };
      }
      return { ref: a.ref, label: a.label.trim(), role: a.role, fin4: a.iban_last4 || '', settle, manual: !!a.manual, balance };
    });

    const ops = {};
    comptes.forEach(c => { ops[c.ref] = []; });
    const ids = {};
    txs.forEach((t, i) => {
      const n = 'Opération n° ' + (i + 1) + ' : ';
      if (!isObj(t) || !refs.has(t.account)) throw fail(n + 'compte inconnu.');
      if (!M().dateValide(t.date)) throw fail(n + 'date invalide.');
      if (!Number.isSafeInteger(t.amount)) throw fail(n + 'montant non entier (centimes attendus).');
      if (!str(t.label, 500)) throw fail(n + 'libellé absent ou trop long.');
      const statut = t.status == null ? 'comptabilisee' : t.status;
      if (statut !== 'comptabilisee' && statut !== 'en_cours') throw fail(n + 'statut inconnu.');
      const x = { date: t.date, montant: t.amount || 0, libelle: t.label.replace(/\s+/g, ' ').trim(), statut };
      if (t.id != null) {
        if (!(typeof t.id === 'string' && /^[A-Za-z0-9._:-]{1,64}$/.test(t.id))) throw fail(n + 'identifiant invalide.');
        const k = t.account + '\n' + t.id;
        if (ids[k]) throw fail(n + 'identifiant en double.');
        ids[k] = true;
        x.idExterne = t.id;
      }
      if (t.value_date != null) {
        if (!M().dateValide(t.value_date)) throw fail(n + 'date de valeur invalide.');
        if (t.value_date !== t.date) x.dateValeur = t.value_date;
      }
      if (t.counterparty != null) {
        if (!str(t.counterparty, 200)) throw fail(n + 'contrepartie invalide.');
        x.contrepartie = t.counterparty.trim();
      }
      ops[t.account].push(x);
    });
    return {
      created: typeof o.created === 'string' ? o.created.slice(0, 40) : null,
      source: typeof o.source === 'string' ? o.source.slice(0, 40) : null,
      comptes, ops, carnet: o.carnet === undefined ? null : o.carnet, nb: txs.length
    };
  }

  // Aperçu : par compte, nombre d'opérations et période.
  function apercu(rep) {
    return rep.comptes.map(c => {
      const l = rep.ops[c.ref];
      let debut = '', fin = '';
      for (const x of l) { if (!debut || x.date < debut) debut = x.date; if (x.date > fin) fin = x.date; }
      return { ref: c.ref, label: c.label, role: c.role, manual: c.manual, n: l.length, debut, fin };
    });
  }

  // Association proposée : celle de l'import précédent, sinon même fin d'IBAN, sinon même libellé et même rôle,
  // sinon un compte manuel à créer. → { ref: <id de compte Klad> | 'creer' }
  function proposer(rep, S) {
    const comptes = S.modele.comptes;
    const avant = (S.modele.reprise && S.modele.reprise.map) || {};
    const pris = new Set();
    const choix = {};
    const libre = c => c && !pris.has(c.id);
    for (const r of rep.comptes) {
      let c = comptes.find(x => x.id === avant[r.ref]);
      if (!libre(c) && r.fin4) c = comptes.find(x => libre(x) && x.source.fin4 && x.source.fin4.toUpperCase() === r.fin4.toUpperCase());
      if (!libre(c)) c = comptes.find(x => libre(x) && x.role === r.role && M().cleLibelle(x.libelle) === M().cleLibelle(r.label));
      if (libre(c)) { pris.add(c.id); choix[r.ref] = c.id; } else choix[r.ref] = 'creer';
    }
    return choix;
  }

  // Import. choix : { ref: <id Klad> | 'creer' | 'ignorer' } ; opts : { reglages (reprendre libellés, rôles,
  // rattachements), now }. Remplace toutes les opérations « reprise ». → compte rendu (nombres seulement).
  function appliquer(S, rep, choix, opts) {
    const now = (opts && opts.now) || Date.now();
    const reglages = !opts || opts.reglages !== false;
    const cibles = Object.keys(choix).map(k => choix[k]).filter(v => v !== 'creer' && v !== 'ignorer');
    if (new Set(cibles).size !== cibles.length) throw fail('Deux comptes de la reprise sont associés au même compte Klad.');
    for (const id of cibles) if (!M().compte(S, id)) throw fail('Compte Klad introuvable.');

    const st = { comptes: 0, crees: 0, operations: 0, ebRetirees: 0, ignores: 0 };
    const map = {};
    const crees = new Set();
    for (const r of rep.comptes) {
      const v = choix[r.ref] || 'ignorer';
      if (v === 'ignorer') { st.ignores++; continue; }
      if (v === 'creer') {
        const c = M().nouveauCompte(S, { libelle: r.label.slice(0, 24), role: r.role, source: { type: 'manuel' } });
        crees.add(c.id); map[r.ref] = c.id; st.crees++;
      } else map[r.ref] = v;
      st.comptes++;
    }
    // Réglages de l'ancienne version (toujours pour un compte créé).
    for (const r of rep.comptes) {
      const c = M().compte(S, map[r.ref]);
      if (!c || !(reglages || crees.has(c.id))) continue;
      c.libelle = r.label.slice(0, 24);
      c.role = r.role;
      if (r.settle && map[r.settle.account]) {
        c.prelevement = { compte: map[r.settle.account] };
        if (r.settle.day != null) c.prelevement.jour = r.settle.day;
      } else if (r.settle) delete c.prelevement;
      if (c.source.type === 'manuel' && r.balance) c.solde = { centimes: r.balance.centimes, date: r.balance.date };
      delete c.aVerifier;
    }
    // Rejouable : toutes les opérations « reprise » et toutes les frontières sont remplacées.
    for (const cid of Object.keys(S.ops)) S.ops[cid] = S.ops[cid].filter(o => o.source !== 'reprise');
    for (const c of S.modele.comptes) delete c.frontiere;
    const jour = M().jourLocal(now);
    for (const r of rep.comptes) {
      const cid = map[r.ref];
      if (!cid) continue;
      const cands = rep.ops[r.ref].map(x => Object.assign({}, x));
      if (!cands.length) continue;
      M().doterIds(cid, cands, 'k');
      const list = M().opsDe(S, cid);
      let front = '';
      for (const x of cands) { list.push(M().nouvelleOp(cid, x, 'reprise', jour)); if (x.date > front) front = x.date; }
      M().compte(S, cid).frontiere = front;
      st.ebRetirees += M().appliquerFrontiere(S, cid);
      M().opsDe(S, cid).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
      st.operations += cands.length;
    }
    S.carnet = rep.carnet;
    S.modele.reprise = { importee: new Date(now).toISOString(), creee: rep.created, source: rep.source, map, nb: st.operations };
    return st;
  }

  g.KladReprise = { lire, valider, apercu, proposer, appliquer };
})(typeof window !== 'undefined' ? window : globalThis);
