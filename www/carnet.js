// Klad — classement repris du carnet de l'ancienne version (bloc « carnet » de la reprise, gardé chiffré) :
// catégories (cats), règles de base (P.rules, payload.rules ou _payload.rules) et de l'utilisateur (rules), corrections ponctuelles (singles), opérations
// vues (seen), motifs de règlement des cartes et portefeuilles. Les mots-clés sont des données du carnet, jamais du code.
//
// Les corrections et les opérations vues du carnet sont indexées par la clé d'opération de l'ancienne version
// (« date|montant|compte|libellé sur 30 caractères ») : l'identifiant stable donné par la reprise à chaque opération est
// « k » + SHA-256(clé) (20 premiers caractères hexadécimaux) + « . » + rang. Une clé désigne toutes les opérations de
// même clé (tous les rangs). Les opérations venues de la banque après la reprise sont retrouvées par leur clé.
// Testé dans node (test/carnet.test.mjs), données fictives uniquement.
(function (g) {
  'use strict';

  const M = () => g.KladModele;
  const K = () => g.KladClasse;
  const isObj = o => o != null && typeof o === 'object' && !Array.isArray(o);
  const arr = a => Array.isArray(a) ? a : null;

  // Sémantique propre au format de l'ancienne version (catégories renommées au fil de ses versions, types implicites).
  const RENOMMEES = { 'Soins & divers': 'Santé', 'Voyages': 'Vacances', 'Équipement maison': 'Appartement', 'Loisirs & sorties': 'Events' };
  const TYPES = { 'Revenus': 'revenu', 'Apports compte commun': 'revenu', 'Épargne': 'epargne', 'Virements internes': 'interne', 'Achat appartement': 'horsbudget' };
  const SANS_INVERSION = ['Revenus', 'Apports compte commun', 'Banque'];   // règles qui restent « revenu » sur un crédit
  const BARS = '\\b(BAR|BARS|PUB|BRASSERIE|BRASSE|BIERE|BIER\\w*|BEER|TAVERN\\w*)\\b';
  const ICONES_SVG = { lamp: '🛋️', star: '⭐', dumbbell: '🏋️', parking: '🅿️' };
  const NATURE_DE_TYPE = { revenu: 'revenu', interne: 'interne', epargne: 'epargne', horsbudget: 'hors_budget' };

  // Racine des réglages : le carnet lui-même, ou son objet « state ».
  function racine(carnet) {
    if (!isObj(carnet)) return null;
    return isObj(carnet.state) ? Object.assign({}, carnet.state, carnet) : carnet;
  }

  // Données figées de l'ancienne version (règles de base, budgets par défaut, revenu prévu, mouvements et équipements de
  // l'équilibre) : « P » ou « payload » dans le carnet, « _payload » dans le fichier de reprise.
  function payload(st) {
    if (!isObj(st)) return {};
    return isObj(st.P) ? st.P : isObj(st.payload) ? st.payload : isObj(st._payload) ? st._payload : {};
  }

  // Extension « klad » du carnet, surchargée par les réglages du complément saisis dans Klad (1.0, KladBudget.surcharger).
  function ext(S, st) {
    const X = isObj(st.klad) ? st.klad : {};
    return g.KladBudget && g.KladBudget.surcharger ? g.KladBudget.surcharger(S, X) : X;
  }

  // Le carnet contient-il de quoi classer ?
  function utilisable(carnet) {
    const st = racine(carnet);
    if (!st) return false;
    const P = payload(st);
    return !!(arr(P.rules) || arr(st.baseRules) || arr(st.rules) || arr(st.userRules) || isObj(st.cats) || isObj(st.singles) || isObj(st.seen));
  }

  async function sha256hex(txt) {
    const h = new Uint8Array(await g.crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt)));
    return Array.from(h, x => x.toString(16).padStart(2, '0')).join('');
  }

  // Clé d'opération de l'ancienne version (montant en euros, écrit comme un nombre JavaScript).
  const cleCarnet = (o, i) => o.date + '|' + (o.montant / 100) + '|' + i + '|' + String(o.libelle || '').slice(0, 30);

  // Index des opérations Klad : par empreinte (identifiant de reprise) et par clé de l'ancienne version.
  function indexer(S) {
    const parHash = new Map(), parCle = new Map();
    const map = (S.modele.reprise && S.modele.reprise.map) || {};
    const rang = {};
    for (const ref of Object.keys(map)) { const m = /^r(\d+)$/.exec(ref); if (m) rang[map[ref]] = +m[1]; }
    for (const cid of Object.keys(S.ops)) {
      for (const o of S.ops[cid]) {
        const i = o.id.indexOf(':x:');
        const m = i >= 0 && /^k([0-9a-f]{20})\.\d+$/.exec(o.id.slice(i + 3));
        if (m) (parHash.get(m[1]) || parHash.set(m[1], []).get(m[1])).push(o);
        if (rang[cid] != null) { const k = cleCarnet(o, rang[cid]); (parCle.get(k) || parCle.set(k, []).get(k)).push(o); }
      }
    }
    return async cle => {
      const h = (await sha256hex(cle)).slice(0, 20);
      return parHash.get(h) || parCle.get(cle) || [];
    };
  }

  // Noms de comptes de l'ancienne version → comptes Klad : liste de noms du carnet (rang = référence r<rang> de la
  // reprise), sinon même libellé, sinon par rôle (« commun » dans le nom → compte commun, sinon comptes courants).
  function resolveur(S, st) {
    const kl = ext(S, st);
    const noms = arr(kl.comptes) || arr(st.ACCTS) || arr(st.accts);
    const map = (S.modele.reprise && S.modele.reprise.map) || {};
    const libs = (S.modele.reprise && S.modele.reprise.libelles) || {};
    const F = K().fold;
    return nom => {
      const f = F(nom);
      if (noms) { const i = noms.findIndex(n => F(n) === f); if (i >= 0 && map['r' + i]) return map['r' + i]; }
      for (const ref of Object.keys(libs)) if (map[ref] && F(libs[ref]) === f) return map[ref];
      const c = S.modele.comptes.find(x => F(x.libelle) === f);
      if (c) return c.id;
      return f.indexOf('COMMUN') >= 0 ? '@commun' : '@courant';
    };
  }

  function convertir(S, carnet, opts) {
    return convertirAsync(S, carnet, opts || {});
  }

  async function convertirAsync(S, carnet, opts) {
    const st = racine(carnet);
    if (!st) throw new Error('Carnet absent.');
    const C = S.classement || K().nouveau();
    const P = payload(st);
    // partiel : seulement les règles de base et les catégories qui manquent (complément de la 0.9.3) ; règles de
    // l'utilisateur, corrections, opérations vues et catégories déjà présentes restent comme dans Klad.
    const partiel = !!opts.seulementBase;
    const X = ext(S, st);
    const cats = isObj(st.cats) ? st.cats : {};
    const renommees = Object.assign({}, RENOMMEES, isObj(cats.renamed) ? cats.renamed : {});
    const retirees = arr(cats.removed) || [];
    const bars = typeof X.bars === 'string' && X.bars ? X.bars : BARS;
    const rapport = { categories: 0, base: 0, regles: 0, invalides: 0, corrections: 0, correctionsRetrouvees: 0, vues: 0, vuesRetrouvees: 0,
      depuis: null, cartes: 0, portefeuilles: 0 };

    // Catégorie de l'ancienne version → catégorie Klad (chaînes de renommage, catégories supprimées).
    // libelle : libellé de l'opération (« Restaurants & bars » se partage entre bars et restaurants), ou null.
    function remap(type, cat, sub, libelle) {
      let c = String(cat || ''), s = sub;
      if (c === 'Revenus') c = /^Ventes( |$)/.test(s || '') ? 'Ventes' : (s && s !== 'Revenus' ? s : 'Autres revenus');
      else if (c === 'Transport') c = /^(Carburant|Recharge véhicule)$/.test(s) ? 'Carburant' : s === 'Entretien auto' ? 'Voiture' : 'Transport';
      else if (c === 'Restaurants & bars') { c = libelle != null && new RegExp(bars, 'i').test(libelle) ? 'Bars' : 'Restaurant'; if (s === 'Restaurants & bars') s = c; }
      else if (RENOMMEES[c]) { if (s === c) s = RENOMMEES[c]; c = RENOMMEES[c]; }
      for (let i = 0; renommees[c] && renommees[c] !== c && i < 5; i++) { if (s === c) s = renommees[c]; c = renommees[c]; }
      if (retirees.indexOf(c) >= 0) c = type === 'revenu' ? 'Autres revenus' : 'Autres';
      return { cat: c, sub: s || c };
    }
    const typeCarnet = cat => TYPES[cat] || null;

    // ---------------------------------------------------------- catégories
    const categories = Object.assign({}, C.categories);
    const natureConnue = {};
    const custom = isObj(cats.custom) ? cats.custom : {};
    for (const n of Object.keys(custom)) {
      if (partiel && categories[n]) { natureConnue[n] = true; continue; }
      const nat = isObj(custom[n]) && K().NATURES.indexOf(custom[n].nat) >= 0 ? custom[n].nat : 'optionnelle';
      categories[n] = Object.assign({}, categories[n], { nature: nat, icone: (categories[n] && categories[n].icone) || K().iconeDe(C, n) });
      natureConnue[n] = true;
    }
    const icones = isObj(cats.icons) ? cats.icons : {};
    for (const n of Object.keys(icones)) {
      if (partiel && categories[n]) continue;
      const sp = String(icones[n] || '');
      // 0.10.9 : émojis et icônes reprises → icône dessinée (banque Lucide) ; sans la banque (anciens tests), équivalent émoji.
      const ic = g.KladIcones && g.KladIcones.liste().length ? g.KladIcones.versDessin(sp.slice(0, 8), n) : sp.indexOf('svg:') === 0 ? ICONES_SVG[sp.slice(4)] : sp.slice(0, 8);
      if (ic) categories[n] = Object.assign({ nature: K().natureDe(C, n) }, categories[n], { icone: ic });
    }
    function ajouter(cat, type) {
      if (!cat) return;
      type = TYPES[cat] || type;
      if (!categories[cat]) {
        categories[cat] = { nature: NATURE_DE_TYPE[type] || K().natureDe(C, cat), icone: K().iconeDe(C, cat) };
      } else if (!natureConnue[cat] && NATURE_DE_TYPE[type] && !K().CATEGORIES[cat] && categories[cat].nature === 'optionnelle') {
        categories[cat].nature = NATURE_DE_TYPE[type];
      }
    }
    if (!partiel) for (const n of retirees.concat(Object.keys(renommees))) delete categories[n];
    const avant = new Set(Object.keys(categories));

    // ---------------------------------------------------------- règles de base (ordre de l'ancienne version)
    const resoudre = resolveur(S, st);
    const brutes = [];
    for (const r of arr(X.regles) || []) brutes.push(r);
    brutes.push(['PARKING', 'depense', 'Logement', 'Charges parking', ['Compte commun']]);      // règle intégrée de l'ancienne version
    for (const r of arr(P.rules) || arr(st.baseRules) || []) brutes.push(r);
    const base = [];
    for (const r of brutes) {
      const x = Array.isArray(r) ? { motif: r[0], type: r[1], cat: r[2], sub: r[3], comptes: r[4], sens: r[5] }
        : isObj(r) ? { motif: r.motif || r.pattern, type: r.type, cat: r.cat, sub: r.sub, comptes: r.comptes || r.accounts, sens: r.sens } : null;
      if (!x || typeof x.motif !== 'string' || !x.motif || typeof x.cat !== 'string') { rapport.invalides++; continue; }
      try { new RegExp(x.motif, 'i'); } catch (e) { rapport.invalides++; continue; }
      const type = ['depense', 'revenu', 'interne', 'epargne', 'horsbudget', 'transfert'].indexOf(x.type) >= 0 ? x.type : 'depense';
      const b = { motif: x.motif, type };
      if (Array.isArray(x.comptes) && x.comptes.length) b.comptes = [...new Set(x.comptes.map(String).map(resoudre))];
      if (x.sens === 'debit' || x.sens === 'credit') b.sens = x.sens;
      if (/^A DETAILLER/.test(K().fold(x.cat))) b.horsCartes = true;
      if ((type === 'depense' || type === 'revenu') && SANS_INVERSION.indexOf(x.cat) < 0) b.creditDepense = true;
      if (type === 'transfert') {
        const sc = remap('revenu', 'Revenus', 'Remboursements entre amis', null);
        b.siCredit = { type: 'revenu', cat: sc.cat, sub: sc.sub };
        ajouter(sc.cat, 'revenu');
      }
      const tr = type === 'transfert' ? 'depense' : type;
      if (x.cat === 'Restaurants & bars') {
        for (const [c, et] of [['Bars', bars], ['Restaurant', null]]) {
          const s = x.sub === 'Restaurants & bars' || !x.sub ? c : x.sub;
          const y = Object.assign({}, b, { cat: c, sub: s });
          if (et) y.et = et;
          base.push(y); ajouter(c, tr);
        }
        continue;
      }
      const m = remap(tr, x.cat, x.sub || x.cat, null);
      base.push(Object.assign(b, { cat: m.cat, sub: m.sub }));
      ajouter(m.cat, tr);
    }

    if (partiel) {
      C.categories = categories;
      C.base = base;
      S.classement = C;
      deduireMotifs(S, base);
      C.import = Object.assign({}, C.import, { payload: true });
      return { base: base.length, categories: Object.keys(categories).filter(n => !avant.has(n)).length };
    }

    // ---------------------------------------------------------- règles de l'utilisateur
    const F = K().fold;
    const garder = (C.regles || []).filter(u => u.src !== 'carnet');
    const prises = new Set(garder.map(u => F(u.mot)));
    const regles = [];
    for (const u of arr(st.rules) || arr(st.userRules) || []) {
      if (!isObj(u) || typeof u.kw !== 'string' || !F(u.kw) || typeof u.cat !== 'string') continue;
      const k = F(u.kw);
      if (prises.has(k)) continue;
      prises.add(k);
      const t = typeCarnet(u.cat) || K().typeDeNature(categories[u.cat] ? categories[u.cat].nature : K().natureDe(C, u.cat));
      const m = remap(t, u.cat, u.sub || u.cat, null);
      ajouter(m.cat, t);
      regles.push({ mot: u.kw, cat: m.cat, sub: m.sub, src: 'carnet' });
    }

    C.categories = categories;
    C.base = base;
    C.regles = regles.concat(garder);
    C.revente = { 'Ventes': { cat: 'Shopping', sub: 'Achats en ligne & magasins' } };
    if (!C.categories.Shopping) ajouter('Shopping', 'depense');
    S.classement = C;
    rapport.categories = Object.keys(categories).length;
    rapport.base = base.length;
    rapport.regles = regles.length;

    // ---------------------------------------------------------- corrections ponctuelles et opérations vues
    const chercher = indexer(S);
    const singles = isObj(st.singles) ? st.singles : {};
    for (const cid of Object.keys(S.ops)) for (const o of S.ops[cid]) if (o.categorie && o.categorie.src === 'carnet') o.categorie = null;
    for (const cle of Object.keys(singles)) {
      const v = singles[cle];
      if (!isObj(v) || typeof v.cat !== 'string') continue;
      rapport.corrections++;
      const ops = await chercher(cle);
      if (ops.length) rapport.correctionsRetrouvees++;
      for (const o of ops) {
        const t = typeCarnet(v.cat) || K().typeDeNature(categories[v.cat] ? categories[v.cat].nature : 'optionnelle');
        const m = remap(t, v.cat, v.sub || v.cat, o.libelle);
        ajouter(m.cat, t);
        o.categorie = { cat: m.cat, sub: m.sub, src: 'carnet' };
      }
    }
    const seen = isObj(st.seen) ? st.seen : null;
    if (seen) {
      if (M().dateValide(seen.cut)) { S.modele.vues = { depuis: seen.cut }; rapport.depuis = seen.cut; }
      const k = isObj(seen.k) ? seen.k : {};
      for (const cle of Object.keys(k)) {
        rapport.vues++;
        const ops = await chercher(cle);
        if (ops.length) rapport.vuesRetrouvees++;
        for (const o of ops) o.vue = String(k[cle]).charAt(0) === 'Y' ? true : 0;
      }
    }

    // ---------------------------------------------------------- cartes et portefeuilles : motifs de règlement
    rapport.cartes = 0; rapport.portefeuilles = 0;
    const map = (S.modele.reprise && S.modele.reprise.map) || {};
    for (const [quoi, role] of [['cartes', 'carte_differee'], ['portefeuilles', 'paiement_en_ligne']]) {
      const reglages = isObj(X[quoi]) ? X[quoi] : {};
      for (const ref of Object.keys(reglages)) {
        const c = M().compte(S, map[ref]);
        const v = reglages[ref];
        if (!c || c.role !== role || !isObj(v)) continue;
        c.prelevement = Object.assign({}, c.prelevement);
        if (typeof v.motif === 'string' && v.motif.trim()) c.prelevement.motif = v.motif.trim().slice(0, 200);
        if (typeof v.remboursements === 'string' && v.remboursements.trim()) c.prelevement.remboursements = v.remboursements.trim().slice(0, 200);
      }
    }
    deduireMotifs(S, base);
    for (const c of S.modele.comptes) {
      if (!(c.prelevement && c.prelevement.motif)) continue;
      if (c.role === 'carte_differee') rapport.cartes++;
      if (c.role === 'paiement_en_ligne') rapport.portefeuilles++;
    }
    C.import = { le: new Date(opts.now == null ? Date.now() : opts.now).toISOString(), rapport, payload: true, ext: signature(X) };
    return rapport;
  }

  // ------------------------------------------------------------ reprise à refaire (1.0.1)
  // Bars et règles du complément sont pris en compte à la reprise du classement : après un changement, Klad propose de
  // la refaire (aperçu du nombre d'opérations touchées, annulable).
  function signature(X) {
    const t = JSON.stringify({ bars: (X && X.bars) || null, regles: (X && X.regles) || null });
    let h = 0x811c9dc5;
    for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h.toString(16).padStart(8, '0');
  }
  // Vrai si les bars ou les règles en vigueur ne sont plus ceux de la dernière reprise. Reprise faite avant la 1.0.1
  // (sans signature) : vrai seulement si bars ou règles ont été réglés dans Klad.
  function aReprendre(S) {
    if (S.carnet == null || !utilisable(S.carnet)) return false;
    const imp = S.classement && S.classement.import;
    if (!imp) return false;
    const st = racine(S.carnet);
    if (imp.ext) return imp.ext !== signature(ext(S, st));
    const O = (S.modele.reglages && S.modele.reglages.complement) || {};
    return 'bars' in O || 'regles' in O;
  }
  const signatureActuelle = S => S.carnet == null || !racine(S.carnet) ? null : signature(ext(S, racine(S.carnet)));
  // Ce que la reprise change (classement, opérations classées et vues, motifs des cartes) : pour « Annuler ».
  function instantane(S) {
    const ops = {};
    for (const cid of Object.keys(S.ops)) for (const o of S.ops[cid]) ops[o.id] = [o.categorie === undefined ? null : o.categorie, o.vue === undefined ? null : o.vue];
    return JSON.stringify({ C: S.classement === undefined ? null : S.classement, vues: S.modele.vues === undefined ? null : S.modele.vues,
      prel: S.modele.comptes.map(c => [c.id, c.prelevement === undefined ? null : c.prelevement]), ops });
  }
  function restaurer(S, avant) {
    const o = JSON.parse(avant);
    S.classement = o.C;
    if (o.vues == null) delete S.modele.vues; else S.modele.vues = o.vues;
    for (const [id, p] of o.prel) { const c = S.modele.comptes.find(x => x.id === id); if (c) { if (p == null) delete c.prelevement; else c.prelevement = p; } }
    for (const cid of Object.keys(S.ops)) for (const op of S.ops[cid]) {
      const v = o.ops[op.id];
      if (!v) continue;
      if (v[0] == null) delete op.categorie; else op.categorie = v[0];
      if (v[1] == null) delete op.vue; else op.vue = v[1];
    }
  }
  // Aperçu sans rien changer : reprise faite sur une copie → { touchees, total } (opérations visibles dont la
  // catégorie, la sous-catégorie ou la nature changerait).
  async function apercuReprise(S, now) {
    const K0 = K();
    const t = now == null ? Date.now() : now;
    const copie = JSON.parse(JSON.stringify(S));
    await convertir(copie, copie.carnet, { now: t });
    const a = K0.contexte(S, t), b = K0.contexte(copie, t);
    const idx = {};
    for (const o of K0.opsVisibles(copie)) idx[o.id] = o;
    let touchees = 0, total = 0;
    for (const o of K0.opsVisibles(S)) {
      total++;
      const x = K0.classer(a, o), o2 = idx[o.id];
      const y = o2 ? K0.classer(b, o2) : null;
      if (!y || x.cat !== y.cat || x.sub !== y.sub || x.type !== y.type) touchees++;
    }
    return { touchees, total };
  }

  // Motif de règlement manquant : déduit des règles de base « à détailler » (règlements de carte ou de portefeuille).
  // Portefeuille : le motif dont les prélèvements retrouvent le plus d'opérations du détail (même montant, dates proches).
  // Carte : parmi les motifs restants, celui qui revient le plus de mois sur le compte de prélèvement. Au moins une
  // correspondance ; sinon le motif reste à choisir dans la fiche du compte.
  function deduireMotifs(S, base) {
    const F = K().fold;
    const candidats = [];
    for (const b of base) {
      if (!b.horsCartes || !/^[A-Za-z0-9 &*'.|-]+$/.test(b.motif)) continue;
      if (candidats.indexOf(b.motif) < 0) candidats.push(b.motif);
    }
    if (!candidats.length) return;
    for (const c of S.modele.comptes) if (c.prelevement && c.prelevement.motif) {
      const i = candidats.findIndex(m => F(m) === F(c.prelevement.motif));
      if (i >= 0) candidats.splice(i, 1);
    }
    const courants = S.modele.comptes.filter(K().estCourant);
    const debits = (comptes, motif) => {
      const mots = K().motifs(motif), out = [];
      for (const c of comptes) for (const o of S.ops[c.id] || []) if (o.montant < 0 && mots.some(m => F(o.libelle).indexOf(m) >= 0)) out.push(o);
      return out;
    };
    for (const w of S.modele.comptes.filter(c => c.role === 'paiement_en_ligne' && !(c.prelevement && c.prelevement.motif))) {
      const montants = new Map();
      for (const o of S.ops[w.id] || []) { const k = Math.abs(o.montant); (montants.get(k) || montants.set(k, []).get(k)).push(o.date); }
      let best = null, bn = 0;
      for (const m of candidats) {
        const n = debits(courants, m).filter(o => (montants.get(-o.montant) || []).some(d => {
          const e = (Date.parse(o.date) - Date.parse(d)) / 864e5; return e >= -2 && e <= 7;
        })).length;
        if (n > bn) { best = m; bn = n; }
      }
      if (best) { w.prelevement = Object.assign({}, w.prelevement, { motif: best }); candidats.splice(candidats.indexOf(best), 1); }
    }
    for (const k of S.modele.comptes.filter(c => c.role === 'carte_differee' && !(c.prelevement && c.prelevement.motif))) {
      const p = k.prelevement && M().compte(S, k.prelevement.compte);
      let best = null, bn = 0;
      for (const m of candidats) {
        const n = new Set(debits(p ? [p] : courants, m).map(o => o.date.slice(0, 7))).size;
        if (n > bn) { best = m; bn = n; }
      }
      if (best) { k.prelevement = Object.assign({}, k.prelevement, { motif: best }); candidats.splice(candidats.indexOf(best), 1); }
    }
  }

  // Nom actuel d'une catégorie de l'ancienne version (renommages successifs du carnet et de ses versions).
  function renommeur(carnet) {
    const st = racine(carnet) || {};
    const cats = isObj(st.cats) ? st.cats : {};
    const ren = Object.assign({}, RENOMMEES, isObj(cats.renamed) ? cats.renamed : {});
    return c => { let x = c; for (let i = 0; ren[x] && ren[x] !== x && i < 5; i++) x = ren[x]; return x; };
  }

  g.KladCarnet = { utilisable, convertir, cleCarnet, sha256hex, BARS, renommeur, racine, payload, signature, signatureActuelle, aReprendre, instantane, restaurer, apercuReprise };
})(typeof window !== 'undefined' ? window : globalThis);
