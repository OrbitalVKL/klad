// Klad — chiffrement des données (WebCrypto), phrase de récupération, sauvegarde, chargement du modèle,
// migrations (prototype → 0.2, 0.2 → 0.3).
// Fonctions pures, testées dans node (test/coffre.test.mjs). Aucun appel réseau, aucune donnée en clair écrite.
//
// La clé de données (DEK) vient du coffre natif KladVault après déverrouillage. Elle est importée ici en clé
// WebCrypto NON extractible : aucun script ne peut la relire. Les blocs chiffrés sont confiés au plugin, qui les
// écrit dans noBackupFilesDir.
(function (g) {
  'use strict';

  const subtle = () => g.crypto.subtle;
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  // ------------------------------------------------------------ base64
  function toB64(bytes) {
    const a = new Uint8Array(bytes);
    let s = '';
    for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function fromB64(s) {
    const bin = atob(String(s || ''));
    const a = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
    return a;
  }
  function random(n) { const a = new Uint8Array(n); g.crypto.getRandomValues(a); return a; }

  function fail(code, msg) { const e = new Error(msg); e.code = code; return e; }

  // ------------------------------------------------------------ clé de données
  async function importDek(bytes) {
    if (!bytes || bytes.length !== 32) throw fail('cle', 'Clé de données invalide.');
    try { return await subtle().importKey('raw', bytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']); }
    finally { bytes.fill(0); }
  }

  // ------------------------------------------------------------ blocs chiffrés (format v1)
  // « KLD » | version (1 octet) | IV aléatoire (12 octets) | texte chiffré + étiquette GCM (16 octets).
  // Données associées : en-tête + nom du bloc → un bloc ne peut être ni modifié, ni pris pour un autre.
  const MAGIC = [0x4b, 0x4c, 0x44];
  const BLOC_V = 1;
  const IV = 12;
  // Noms de blocs : liste fixe, plus un bloc d'opérations par compte et par année (« ops-<compte>-<année> »).
  // « comptes » : format 0.2, lu une dernière fois par la migration puis supprimé.
  const BLOCS = ['cle', 'modele', 'soldes', 'carnet', 'classement', 'budget', 'journal', 'sauvegarde', 'comptes'];
  const nomValide = name => BLOCS.indexOf(name) >= 0 || /^ops-[a-z0-9]{8}-\d{4}$/.test(String(name));

  function blocAad(version, name) {
    const n = enc.encode('klad.bloc:' + name);
    const a = new Uint8Array(4 + n.length);
    a.set(MAGIC, 0); a[3] = version; a.set(n, 4);
    return a;
  }

  async function seal(key, name, obj) {
    if (!nomValide(name)) throw fail('nom', 'Bloc inconnu : ' + name);
    const iv = random(IV);
    const ct = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: blocAad(BLOC_V, name) },
      key, enc.encode(JSON.stringify(obj))));
    const out = new Uint8Array(4 + IV + ct.length);
    out.set(MAGIC, 0); out[3] = BLOC_V; out.set(iv, 4); out.set(ct, 4 + IV);
    return out;
  }

  async function open(key, name, bytes) {
    const b = new Uint8Array(bytes);
    if (b.length < 4 + IV + 16 || b[0] !== MAGIC[0] || b[1] !== MAGIC[1] || b[2] !== MAGIC[2])
      throw fail('format', 'Bloc « ' + name + ' » : format inconnu.');
    if (b[3] !== BLOC_V) throw fail('version', 'Bloc « ' + name + ' » : version ' + b[3] + ' non prise en charge.');
    let plain;
    try {
      plain = await subtle().decrypt({ name: 'AES-GCM', iv: b.subarray(4, 4 + IV), additionalData: blocAad(b[3], name) },
        key, b.subarray(4 + IV));
    } catch (e) { throw fail('integrite', 'Bloc « ' + name + ' » illisible (clé différente ou fichier altéré).'); }
    return JSON.parse(dec.decode(plain));
  }

  // ------------------------------------------------------------ phrase de récupération
  // 120 bits aléatoires, écrits en 24 caractères Crockford base32 (sans I, L, O, U), en 6 groupes de 4.
  const ALPHA = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  const GROUPS = 6;

  function newPhrase() {
    const bytes = random(15);
    let bits = 0, acc = 0, out = '';
    for (const x of bytes) {
      acc = (acc << 8) | x; bits += 8;
      while (bits >= 5) { bits -= 5; out += ALPHA[(acc >> bits) & 31]; }
      acc &= (1 << bits) - 1;
    }
    return out.match(/.{4}/g).join('-');
  }

  // Tolère minuscules, espaces, tirets, O pour 0, I ou L pour 1.
  function normChars(s) {
    return String(s || '').toUpperCase().replace(/[\s\-–.]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
  }

  function normPhrase(s) {
    const x = normChars(s);
    if (x.length !== GROUPS * 4) throw fail('phrase', 'La phrase compte 24 caractères (6 groupes de 4) ; ici ' + x.length + '.');
    const bad = x.split('').filter(c => ALPHA.indexOf(c) < 0);
    if (bad.length) throw fail('phrase', 'Caractère inattendu dans la phrase : ' + bad[0] + '.');
    return x.match(/.{4}/g).join('-');
  }

  // Deux groupes distincts à ressaisir (indices 0 à 5, croissants).
  function pickGroups() {
    const r = random(2);
    const a = r[0] % GROUPS;
    const b = (a + 1 + (r[1] % (GROUPS - 1))) % GROUPS;
    return [a, b].sort((x, y) => x - y);
  }

  // answers : { indice: saisie }. Vrai si chaque groupe saisi correspond.
  function checkGroups(phrase, answers) {
    const groups = normPhrase(phrase).split('-');
    const keys = Object.keys(answers || {});
    return keys.length > 0 && keys.every(i => groups[+i] !== undefined && normChars(answers[i]) === groups[+i]);
  }

  // ------------------------------------------------------------ clé de sauvegarde (tirée de la phrase)
  // PBKDF2-SHA256 : avec 120 bits de hasard dans la phrase, un essai exhaustif est hors de portée ;
  // les itérations ralentissent encore chaque essai. Valeur fixe (lue dans l'en-tête) : la restauration
  // peut avoir lieu sur un autre téléphone.
  const SAUV_ITER = 600000;

  async function phraseBits(phrase, salt, iter) {
    const base = await subtle().importKey('raw', enc.encode(normPhrase(phrase).replace(/-/g, '')), 'PBKDF2', false, ['deriveBits']);
    return new Uint8Array(await subtle().deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, base, 256));
  }

  // Contenu du bloc « sauvegarde » : { sel, iter, cle } (+ dernier : date du dernier export).
  async function newBackupKey(phrase, iter = SAUV_ITER) {
    const salt = random(16);
    const bits = await phraseBits(phrase, salt, iter);
    return { sel: toB64(salt), iter, cle: toB64(bits), dernier: null };
  }

  // ------------------------------------------------------------ fichier de sauvegarde (format v1, JSON)
  // { format, v, kdf: { nom, iter, sel }, iv, date, ct }. L'en-tête (tout sauf ct) est la donnée associée.
  const SAUV_FORMAT = 'klad-sauvegarde';
  const SAUV_V = 1;

  function headerOf(o) {
    return { format: o.format, v: o.v, kdf: { nom: o.kdf && o.kdf.nom, iter: o.kdf && o.kdf.iter, sel: o.kdf && o.kdf.sel }, iv: o.iv, date: o.date };
  }

  async function backupKey(b64bits) {
    return subtle().importKey('raw', fromB64(b64bits), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  }

  async function exportBackup(bk, payload, now = new Date()) {
    if (!bk || !bk.cle) throw fail('sauvegarde', 'Clé de sauvegarde absente.');
    const iv = random(IV);
    const head = headerOf({ format: SAUV_FORMAT, v: SAUV_V, kdf: { nom: 'PBKDF2-SHA256', iter: bk.iter, sel: bk.sel },
      iv: toB64(iv), date: now.toISOString().slice(0, 10) });
    const ct = await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(JSON.stringify(head)) },
      await backupKey(bk.cle), enc.encode(JSON.stringify(payload)));
    return JSON.stringify(Object.assign({}, head, { ct: toB64(ct) }));
  }

  function readBackupHeader(text) {
    let o;
    try { o = JSON.parse(text); } catch (e) { throw fail('format', 'Ce fichier n\'est pas une sauvegarde Klad.'); }
    if (!o || o.format !== SAUV_FORMAT) throw fail('format', 'Ce fichier n\'est pas une sauvegarde Klad.');
    if (o.v !== SAUV_V) throw fail('version', 'Sauvegarde de version ' + o.v + ' non prise en charge.');
    if (!o.kdf || o.kdf.nom !== 'PBKDF2-SHA256' || !(o.kdf.iter >= 1) || !o.kdf.sel || !o.iv || !o.ct)
      throw fail('format', 'Sauvegarde incomplète.');
    return o;
  }

  // → { payload, bk } ; bk permet d'exporter de nouveau avec la même phrase.
  async function importBackup(text, phrase) {
    const o = readBackupHeader(text);
    const bits = await phraseBits(phrase, fromB64(o.kdf.sel), o.kdf.iter);
    const bk = { sel: o.kdf.sel, iter: o.kdf.iter, cle: toB64(bits), dernier: o.date || null };
    let plain;
    try {
      plain = await subtle().decrypt({ name: 'AES-GCM', iv: fromB64(o.iv), additionalData: enc.encode(JSON.stringify(headerOf(o))) },
        await backupKey(bk.cle), fromB64(o.ct));
    } catch (e) { throw fail('phrase', 'Phrase incorrecte, ou fichier altéré.'); }
    return { payload: JSON.parse(dec.decode(plain)), bk };
  }

  // ------------------------------------------------------------ fichier de sauvegarde (format v2, par morceaux, 1.0.1)
  // La 1.0.0 chiffrait la sauvegarde d'un seul bloc (plusieurs copies complètes en mémoire, puis un seul message
  // vers Android) : avec des données réelles, Klad se fermait à l'export. Le format v2 s'écrit et se lit morceau par
  // morceau ; seul un bloc de données à la fois est en clair en mémoire.
  //   ligne 1 (JSON, ASCII) : { format, v: 2, kdf: { nom, iter, sel }, date, morceau } puis « \n » ;
  //   puis des enregistrements : longueur (4 octets, gros-boutiste) | IV (12 octets) | texte chiffré + étiquette GCM.
  //   Donnée associée de chaque enregistrement : ligne 1 + son rang (4 octets) : ni ordre changé, ni morceau d'un
  //   autre fichier. Clair : en-tête JSON { n: bloc, i: rang dans le bloc, f: dernier morceau du bloc } « \n » octets,
  //   ou { fin: true, app, v, blocs, prefs, n } pour le dernier (sans lui, le fichier est tronqué).
  const SAUV_V2 = 2;
  const MORCEAU = 256 * 1024;            // octets de données par enregistrement (≈ 350 Ko en base64 vers Android)

  function u32(n) { const a = new Uint8Array(4); new DataView(a.buffer).setUint32(0, n >>> 0); return a; }
  function concat(parts, n) {
    const out = new Uint8Array(n == null ? parts.reduce((t, p) => t + p.length, 0) : n);
    let o = 0;
    for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
  }
  function aadV2(ligne, rang) { return concat([ligne, u32(rang)]); }

  // contenu : { app, v, blocs, prefs } (contenuSauvegarde) ; ajouter(octets) : écrit la suite du fichier (async).
  // → { octets, enregistrements }.
  async function ecrireSauvegarde(bk, contenu, ajouter, now = new Date(), morceau = MORCEAU) {
    if (!bk || !bk.cle) throw fail('sauvegarde', 'Clé de sauvegarde absente.');
    const ligne = enc.encode(JSON.stringify({ format: SAUV_FORMAT, v: SAUV_V2, kdf: { nom: 'PBKDF2-SHA256', iter: bk.iter, sel: bk.sel },
      date: now.toISOString().slice(0, 10), morceau }) + '\n');
    const cle = await backupKey(bk.cle);
    let rang = 0, octets = 0;
    const emettre = async (tete, data) => {
      const plain = concat([enc.encode(JSON.stringify(tete) + '\n'), data || new Uint8Array(0)]);
      const iv = random(IV);
      const ct = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: aadV2(ligne, rang) }, cle, plain));
      const rec = concat([u32(IV + ct.length), iv, ct]);
      rang++; octets += rec.length;
      await ajouter(rec);
    };
    await ajouter(ligne); octets += ligne.length;
    const noms = Object.keys(contenu.blocs);
    for (const n of noms) {
      let b = enc.encode(JSON.stringify(contenu.blocs[n]));
      const nb = Math.max(1, Math.ceil(b.length / morceau));
      for (let i = 0; i < nb; i++) await emettre({ n, i, f: i === nb - 1 }, b.subarray(i * morceau, (i + 1) * morceau));
      b = null;
    }
    const fin = { fin: true, app: contenu.app, v: contenu.v, blocs: noms, n: rang };
    if (contenu.prefs) fin.prefs = contenu.prefs;
    await emettre(fin, null);
    return { octets, enregistrements: rang };
  }

  // Lecteur séquentiel d'un fichier : source = { taille, lire(debut, longueur) → Promise<Uint8Array> }.
  function lecteur(source) {
    let pos = 0, buf = new Uint8Array(0);
    return {
      async prendre(n) {
        while (buf.length < n && pos < source.taille) {
          const b = await source.lire(pos, Math.max(MORCEAU, n - buf.length));
          if (!b.length) break;
          pos += b.length;
          buf = buf.length ? concat([buf, b]) : b;
        }
        if (buf.length < n) return null;
        const r = buf.slice(0, n); buf = buf.subarray(n);
        return r;
      },
      fini() { return !buf.length && pos >= source.taille; }
    };
  }

  // En-tête d'un fichier choisi → { v, date, kdf } ; v1 : { v: 1, texte } (fichier entier, format JSON de la 1.0.0).
  async function enteteSauvegarde(source) {
    const pas = 'Ce fichier n\'est pas une sauvegarde Klad.';
    if (!source || !(source.taille > 0)) throw fail('format', pas);
    const debut = await source.lire(0, Math.min(source.taille, 4096));
    if (debut[0] !== 0x7b) throw fail('format', pas);
    const nl = debut.indexOf(0x0a);
    if (nl < 0) {                                            // v1 : un seul objet JSON
      if (source.taille > 256 * 1024 * 1024) throw fail('format', 'Sauvegarde trop grosse.');
      const parts = [];
      for (let p = 0; p < source.taille;) { const b = await source.lire(p, MORCEAU * 2); if (!b.length) break; parts.push(b); p += b.length; }
      const texte = dec.decode(concat(parts));
      const o = readBackupHeader(texte);
      return { v: 1, date: o.date || null, kdf: o.kdf, texte };
    }
    let h;
    try { h = JSON.parse(dec.decode(debut.subarray(0, nl))); } catch (e) { throw fail('format', pas); }
    if (!h || h.format !== SAUV_FORMAT) throw fail('format', pas);
    if (h.v !== SAUV_V2) throw fail('version', 'Sauvegarde de version ' + h.v + ' non prise en charge.');
    if (!h.kdf || h.kdf.nom !== 'PBKDF2-SHA256' || !(h.kdf.iter >= 1) || !h.kdf.sel) throw fail('format', 'Sauvegarde incomplète.');
    return { v: 2, date: h.date || null, kdf: h.kdf, ligne: debut.slice(0, nl + 1) };
  }

  // → { payload, bk } (comme importBackup), en lisant la source morceau par morceau.
  async function ouvrirSauvegarde(source, phrase, entete) {
    const h = entete || await enteteSauvegarde(source);
    if (h.v === 1) return importBackup(h.texte, phrase);
    const bits = await phraseBits(phrase, fromB64(h.kdf.sel), h.kdf.iter);
    const bk = { sel: h.kdf.sel, iter: h.kdf.iter, cle: toB64(bits), dernier: h.date || null };
    const cle = await backupKey(bk.cle);
    const L = lecteur(source);
    await L.prendre(h.ligne.length);
    const blocs = {};
    let parts = [], courant = null, rang = 0, fin = null;
    while (!fin) {
      const lg = await L.prendre(4);
      if (!lg) throw fail('tronque', 'Sauvegarde incomplète : fichier tronqué.');
      const n = new DataView(lg.buffer, lg.byteOffset, 4).getUint32(0);
      if (n < IV + 16 || n > MORCEAU * 4) throw fail('integrite', 'Sauvegarde altérée.');
      const rec = await L.prendre(n);
      if (!rec) throw fail('tronque', 'Sauvegarde incomplète : fichier tronqué.');
      let plain;
      try {
        plain = new Uint8Array(await subtle().decrypt({ name: 'AES-GCM', iv: rec.subarray(0, IV), additionalData: aadV2(h.ligne, rang) }, cle, rec.subarray(IV)));
      } catch (e) {
        if (rang === 0) throw fail('phrase', 'Phrase incorrecte, ou fichier altéré.');
        throw fail('integrite', 'Sauvegarde altérée (morceau ' + (rang + 1) + ').');
      }
      rang++;
      const nl = plain.indexOf(0x0a);
      const t = JSON.parse(dec.decode(plain.subarray(0, nl)));
      if (t.fin) { fin = t; break; }
      if (!nomValide(t.n) && t.n !== 'journal') throw fail('format', 'Sauvegarde : bloc inattendu.');
      if (courant !== t.n || t.i !== parts.length) {
        if (t.i !== 0 || courant != null) throw fail('integrite', 'Sauvegarde altérée (ordre des morceaux).');
        courant = t.n;
      }
      parts.push(plain.subarray(nl + 1));
      if (t.f) { blocs[t.n] = JSON.parse(dec.decode(concat(parts))); parts = []; courant = null; }
    }
    if (courant != null || fin.n !== rang - 1 || !Array.isArray(fin.blocs) || fin.blocs.some(n => !(n in blocs)))
      throw fail('tronque', 'Sauvegarde incomplète.');
    const payload = { app: fin.app, v: fin.v, blocs };
    if (fin.prefs) payload.prefs = fin.prefs;
    return { payload, bk };
  }

  // Source en mémoire (navigateur, tests).
  function sourceOctets(b) { const a = new Uint8Array(b); return { taille: a.length, async lire(d, n) { return a.subarray(d, d + n); } }; }

  // ------------------------------------------------------------ état de l'appli ↔ blocs
  const blank = () => ({ appId: '', pem: '', redirectUrl: '', sessions: {}, pending: {}, data: {}, banks: {}, alias: {}, log: [] });

  function split(S) {
    return {
      cle: { appId: S.appId || '', pem: S.pem || '', redirectUrl: S.redirectUrl || '' },
      comptes: { sessions: S.sessions || {}, pending: S.pending || {}, data: S.data || {}, banks: S.banks || {}, alias: S.alias || {} },
      journal: { log: S.log || [] }
    };
  }

  function join(blocks) {
    const S = blank();
    for (const n of ['cle', 'comptes', 'journal']) if (blocks && blocks[n]) Object.assign(S, blocks[n]);
    return S;
  }

  // ------------------------------------------------------------ migration du prototype (localStorage en clair)
  const PROTO_KEY = 'klad.proto.v1';

  // store : { get(nom) → objet | null, put(nom, objet) } (blocs chiffrés).
  // Écrit les blocs, les relit et les compare, puis seulement efface localStorage.
  async function migrate(storage, store) {
    let raw;
    try { raw = storage.getItem(PROTO_KEY); } catch (e) { return null; }
    if (raw == null) return null;
    if (await store.get('cle') != null) {            // migration déjà écrite (arrêt avant l'effacement)
      storage.removeItem(PROTO_KEY);
      return { deja: true };
    }
    let old;
    try { old = JSON.parse(raw); } catch (e) { old = null; }
    if (!old || typeof old !== 'object') {
      storage.removeItem(PROTO_KEY);
      return { illisible: true };
    }
    if (old.logV !== 2) old.log = [];                // journaux antérieurs : pouvaient contenir des noms
    const parts = split(join({ cle: pick(old, ['appId', 'pem', 'redirectUrl']),
      comptes: pick(old, ['sessions', 'pending', 'data', 'banks', 'alias']), journal: pick(old, ['log']) }));
    for (const n of ['cle', 'comptes', 'journal']) await store.put(n, parts[n]);
    for (const n of ['cle', 'comptes', 'journal']) {
      const back = await store.get(n);
      if (JSON.stringify(back) !== JSON.stringify(parts[n])) throw fail('migration', 'Vérification de la reprise impossible : données du prototype conservées.');
    }
    storage.removeItem(PROTO_KEY);
    return { sessions: Object.keys(parts.comptes.sessions).length, cle: !!parts.cle.pem };
  }

  // ------------------------------------------------------------ chargement du modèle (0.3), migration 0.2 → 0.3
  // store : { get(nom) → objet | null, put(nom, objet), del(nom) }.
  // → { S, ecrits: { nom: JSON lu ou écrit }, migration: compte rendu | null }.
  // Migration : nouveaux blocs écrits (« modele » en dernier), relus et comparés ; seulement ensuite, « comptes » est
  // supprimé. En cas d'échec, les nouveaux blocs sont retirés et l'ancien format reste intact (nouvel essai au
  // prochain déverrouillage).
  async function charger(store, now) {
    const M = g.KladModele;
    const b = { cle: await store.get('cle'), modele: await store.get('modele'), journal: await store.get('journal') };
    const ecrits = {};
    if (b.modele) {
      if (await store.get('comptes') != null) await store.del('comptes');     // migration interrompue après l'écriture
      b.soldes = await store.get('soldes');
      b.carnet = await store.get('carnet');
      b.classement = await store.get('classement');
      b.budget = await store.get('budget');
      for (const n of M.nomsOps(b.modele)) b[n] = await store.get(n);
      for (const n of Object.keys(b)) if (b[n] != null) ecrits[n] = JSON.stringify(b[n]);
      return { S: M.depuisBlocs(b), ecrits, migration: null };
    }
    const S = M.depuisBlocs({ cle: b.cle, journal: b.journal });
    for (const n of ['cle', 'journal']) if (b[n] != null) ecrits[n] = JSON.stringify(b[n]);
    const old = await store.get('comptes');
    if (old == null) return { S, ecrits, migration: null };                    // coffre neuf
    const conv = await M.depuis02(old, now == null ? Date.now() : now);
    S.modele = conv.S.modele; S.soldes = conv.S.soldes; S.ops = conv.S.ops;
    const blocs = M.versBlocs(S);
    const noms = Object.keys(blocs).filter(n => n !== 'cle' && n !== 'journal' && n !== 'modele').concat('modele');
    try {
      for (const n of noms) await store.put(n, blocs[n]);
      for (const n of noms) {
        if (JSON.stringify(await store.get(n)) !== JSON.stringify(blocs[n])) throw fail('migration', 'relecture différente');
      }
    } catch (e) {
      for (const n of noms.slice().reverse()) { try { await store.del(n); } catch (e2) { /* déjà absent */ } }
      throw fail('migration', 'Conversion des données 0.2 impossible (' + (e.message || e) + '). Rien n\'a été effacé : nouvel essai au prochain déverrouillage.');
    }
    await store.del('comptes');
    for (const n of noms) ecrits[n] = JSON.stringify(blocs[n]);
    return { S, ecrits, migration: conv.r };
  }

  // Contenu d'une sauvegarde exportée (v2) : tous les blocs sauf le journal.
  // 1.0 : prefs (facultatif) : préférences d'affichage du téléphone (thème, palette), rendues à la restauration.
  function contenuSauvegarde(S, prefs) {
    const blocs = g.KladModele.versBlocs(S);
    delete blocs.journal;
    const o = { app: 'klad', v: 2, blocs };
    if (prefs) o.prefs = prefs;
    return o;
  }

  // Vérification d'une sauvegarde ouverte (1.0) : chaque bloc comparé aux données actuelles, rien n'est écrasé.
  // → { lisible, complete, manquants: [blocs actuels absents du fichier], differents: [blocs qui diffèrent],
  //     enTrop: [blocs du fichier absents aujourd'hui], cles: { eb, claude, mail } (présentes dans le fichier) }.
  // complete : le fichier contient tous les blocs attendus (clés, comptes, soldes, classement, budget, reprise et
  // complément s'ils existent, opérations de chaque compte) ; une différence de contenu (données changées depuis)
  // n'empêche pas une sauvegarde d'être complète.
  function comparerSauvegarde(payload, S, prefs) {
    if (!payload || payload.app !== 'klad' || payload.v !== 2 || !payload.blocs) return { lisible: false, complete: false, manquants: [], differents: [], enTrop: [], cles: {} };
    const F = payload.blocs, A = contenuSauvegarde(S).blocs;
    const canon = v => JSON.stringify(v, (k, x) => x && typeof x === 'object' && !Array.isArray(x) ? Object.keys(x).sort().reduce((o, c) => { o[c] = x[c]; return o; }, {}) : x);
    const r = { lisible: true, manquants: [], differents: [], enTrop: [], cles: {} };
    for (const n of Object.keys(A)) {
      if (!(n in F)) r.manquants.push(n);
      else if (canon(F[n]) !== canon(A[n])) r.differents.push(n);
    }
    for (const n of Object.keys(F)) if (!(n in A)) r.enTrop.push(n);
    const k = F.cle || {};
    r.cles = { eb: !!(k.appId && k.pem), claude: !!k.claude, mail: !!k.mailMdp };
    // blocs structurels : tous présents ; opérations : au moins un bloc par compte qui en a aujourd'hui
    const struct = ['cle', 'modele', 'soldes', 'classement', 'budget', 'carnet'].filter(n => n in A);
    const comptesOps = new Set(Object.keys(A).filter(n => /^ops-/.test(n)).map(n => n.replace(/-\d{4}$/, '')));
    const comptesF = new Set(Object.keys(F).filter(n => /^ops-/.test(n)).map(n => n.replace(/-\d{4}$/, '')));
    r.complete = struct.every(n => n in F) && [...comptesOps].every(c => comptesF.has(c)) &&
      (!(S.cle && S.cle.appId) || r.cles.eb) && (!(S.cle && S.cle.claude) || r.cles.claude) && (!(S.cle && S.cle.mailMdp) || r.cles.mail);
    if (prefs && canon(payload.prefs || null) !== canon(prefs)) r.differents.push('prefs');
    return r;
  }

  // Sauvegarde ouverte → état. Une sauvegarde 0.2 (v1 : { cle, comptes }) passe par la migration.
  async function depuisSauvegarde(payload, now) {
    const M = g.KladModele;
    if (!payload || payload.app !== 'klad') throw fail('format', 'Contenu de sauvegarde inattendu.');
    if (payload.v === 2) {
      if (!payload.blocs || !payload.blocs.modele) throw fail('format', 'Sauvegarde incomplète.');
      for (const n of Object.keys(payload.blocs)) if (!nomValide(n)) throw fail('format', 'Sauvegarde : bloc inattendu.');
      return M.depuisBlocs(payload.blocs);
    }
    const S = M.depuisBlocs({ cle: payload.cle || {} });
    if (payload.comptes) {
      const conv = await M.depuis02(payload.comptes, now == null ? Date.now() : now);
      S.modele = conv.S.modele; S.soldes = conv.S.soldes; S.ops = conv.S.ops;
    }
    return S;
  }

  function pick(o, keys) {
    const r = {};
    keys.forEach(k => { if (o[k] !== undefined) r[k] = o[k]; });
    return r;
  }

  g.KladCoffre = {
    toB64, fromB64, importDek, seal, open, BLOCS, nomValide, charger, contenuSauvegarde, depuisSauvegarde, comparerSauvegarde,
    newPhrase, normPhrase, pickGroups, checkGroups,
    SAUV_ITER, newBackupKey, exportBackup, readBackupHeader, importBackup,
    MORCEAU, ecrireSauvegarde, enteteSauvegarde, ouvrirSauvegarde, sourceOctets,
    blank, split, join, PROTO_KEY, migrate
  };
})(typeof window !== 'undefined' ? window : globalThis);
