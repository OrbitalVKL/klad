// Klad — lecture d'un classeur Excel (.xlsx) sans bibliothèque ni réseau : ZIP lu à la main (méthodes « stockée » et
// « deflate », décompression par DecompressionStream), XML lu par un petit analyseur maison (pas de DOMParser : marche
// aussi dans Node pour les tests). Rend chaque feuille comme un tableau de lignes de valeurs (texte, nombre, booléen) ;
// les cellules au format date deviennent « AAAA-MM-JJ ». Formules : seule la dernière valeur calculée est lue.
// Refus propre d'un ancien .xls, d'un classeur chiffré ou binaire (.xlsb) ; limites de taille contre les bombes ZIP.
// Aucune donnée n'est journalisée ; les messages d'erreur ne citent jamais le contenu du fichier.
(function (g) {
  'use strict';

  const MAX_FICHIER = 50 * 1024 * 1024;      // fichier reçu
  const MAX_ENTREE = 20 * 1024 * 1024;       // une entrée du ZIP, une fois décompressée
  const MAX_TOTAL = 80 * 1024 * 1024;        // toutes les entrées lues, décompressées
  const MAX_CELLULES = 3000000;              // lignes × colonnes d'une feuille rendue

  const ERR = {
    pasXlsx: 'Ce fichier n\'est pas un classeur Excel (.xlsx) lisible.',
    xls: 'Ancien format Excel (.xls) ou classeur protégé par mot de passe : non pris en charge. Enregistrez-le en .xlsx sans mot de passe, ou exportez-le en CSV.',
    chiffre: 'Classeur chiffré : non pris en charge. Enregistrez-le sans mot de passe, ou exportez-le en CSV.',
    xlsb: 'Classeur Excel binaire (.xlsb) : non pris en charge. Enregistrez-le en .xlsx, ou exportez-le en CSV.',
    abime: 'Classeur Excel endommagé : lecture impossible.',
    gros: 'Classeur trop volumineux pour être lu.',
    methode: 'Classeur compressé d\'une façon non prise en charge. Enregistrez-le à nouveau en .xlsx, ou exportez-le en CSV.',
    appareil: 'Lecture des classeurs Excel impossible sur cet appareil (décompression indisponible). Exportez le relevé en CSV.'
  };
  class ErreurXlsx extends Error {}
  const err = k => new ErreurXlsx(ERR[k]);

  // ------------------------------------------------------------ octets
  function octets(buf) {
    if (buf && ArrayBuffer.isView(buf)) return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    if (buf && Object.prototype.toString.call(buf) === '[object ArrayBuffer]') return new Uint8Array(buf);
    throw err('pasXlsx');
  }
  const commence = (u, sig) => u.length >= sig.length && sig.every((b, i) => u[i] === b);
  const estOLE = u => commence(u, [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]);   // .xls, ou .xlsx chiffré
  const estZip = u => commence(u, [0x50, 0x4B, 0x03, 0x04]) || commence(u, [0x50, 0x4B, 0x05, 0x06]);
  // Le fichier ressemble-t-il à un classeur (ZIP ou ancien format Office) ? Sert à aiguiller l'import.
  function estClasseur(buf) {
    let u;
    try { u = octets(buf); } catch (e) { return false; }
    return estZip(u) || estOLE(u);
  }
  function texte(u) {
    if (u[0] === 0xFF && u[1] === 0xFE) return new TextDecoder('utf-16le').decode(u.subarray(2));
    if (u[0] === 0xFE && u[1] === 0xFF) return new TextDecoder('utf-16be').decode(u.subarray(2));
    return new TextDecoder('utf-8').decode(u).replace(/^﻿/, '');
  }

  // ------------------------------------------------------------ ZIP
  // Répertoire central → Map(nom en minuscules → entrée). ZIP64 compris (rare pour un classeur).
  function lireZip(u) {
    const dv = new DataView(u.buffer, u.byteOffset, u.byteLength), n = u.length;
    const u16 = p => dv.getUint16(p, true), u32 = p => dv.getUint32(p, true), u64 = p => u32(p) + u32(p + 4) * 4294967296;
    if (n < 22) throw err('pasXlsx');
    let e = -1;
    for (let p = n - 22, fin = Math.max(0, n - 22 - 65535); p >= fin; p--) if (u32(p) === 0x06054b50) { e = p; break; }
    if (e < 0) throw err('pasXlsx');
    let nb = u16(e + 10), taille = u32(e + 12), debut = u32(e + 16);
    if (nb === 0xFFFF || taille === 0xFFFFFFFF || debut === 0xFFFFFFFF) {
      if (e < 20 || u32(e - 20) !== 0x07064b50) throw err('abime');
      const z = u64(e - 12);
      if (z + 56 > n || u32(z) !== 0x06064b50) throw err('abime');
      nb = u64(z + 32); taille = u64(z + 40); debut = u64(z + 48);
    }
    if (debut + taille > n) throw err('abime');
    if (nb > 100000) throw err('gros');
    const entrees = new Map(), dec = new TextDecoder('utf-8');
    let p = debut;
    for (let i = 0; i < nb; i++) {
      if (p + 46 > n || u32(p) !== 0x02014b50) throw err('abime');
      const nl = u16(p + 28), xl = u16(p + 30), cl = u16(p + 32);
      if (p + 46 + nl + xl > n) throw err('abime');
      const x = { flags: u16(p + 8), methode: u16(p + 10), csize: u32(p + 20), usize: u32(p + 24), off: u32(p + 42) };
      const nom = dec.decode(u.subarray(p + 46, p + 46 + nl)).replace(/\\/g, '/').replace(/^\/+/, '');
      // champ supplémentaire ZIP64 : tailles et position sur 8 octets quand les champs ordinaires valent 0xFFFFFFFF
      for (let q = p + 46 + nl, fq = q + xl; q + 4 <= fq;) {
        const id = u16(q), lg = u16(q + 2);
        if (id === 1) {
          let r = q + 4;
          if (x.usize === 0xFFFFFFFF && r + 8 <= q + 4 + lg) { x.usize = u64(r); r += 8; }
          if (x.csize === 0xFFFFFFFF && r + 8 <= q + 4 + lg) { x.csize = u64(r); r += 8; }
          if (x.off === 0xFFFFFFFF && r + 8 <= q + 4 + lg) x.off = u64(r);
        }
        q += 4 + lg;
      }
      if (!nom.endsWith('/')) entrees.set(nom.toLowerCase(), x);
      p += 46 + nl + xl + cl;
    }
    return { u, dv, entrees, total: 0 };
  }

  async function inflater(data, max) {
    let ds;
    try { ds = new g.DecompressionStream('deflate-raw'); } catch (e) { throw err('appareil'); }
    const w = ds.writable.getWriter();
    const fin = w.write(data).then(() => w.close()).catch(() => {});
    const r = ds.readable.getReader(), morceaux = [];
    let total = 0;
    try {
      for (;;) {
        const { done, value } = await r.read();
        if (done) break;
        total += value.length;
        if (total > max) { r.cancel().catch(() => {}); throw err('gros'); }
        morceaux.push(value);
      }
    } catch (e) {
      if (e instanceof ErreurXlsx) throw e;
      throw err('abime');
    }
    await fin;
    const out = new Uint8Array(total);
    let p = 0;
    for (const m of morceaux) { out.set(m, p); p += m.length; }
    return out;
  }

  // Contenu décompressé d'une entrée (nom insensible à la casse), ou null si absente.
  async function entree(z, nom) {
    const x = z.entrees.get(String(nom).toLowerCase());
    if (!x) return null;
    if (x.flags & 1 || x.methode === 99) throw err('chiffre');
    const { u, dv } = z;
    if (x.off + 30 > u.length || dv.getUint32(x.off, true) !== 0x04034b50) throw err('abime');
    const d = x.off + 30 + dv.getUint16(x.off + 26, true) + dv.getUint16(x.off + 28, true);
    if (d + x.csize > u.length) throw err('abime');
    const brut = u.subarray(d, d + x.csize);
    const reste = Math.min(MAX_ENTREE, MAX_TOTAL - z.total);
    let out;
    if (x.methode === 0) {
      if (x.csize > reste) throw err('gros');
      out = brut;
    } else if (x.methode === 8) {
      if (x.usize > reste) throw err('gros');
      out = await inflater(brut.slice(), reste);
    } else throw err('methode');
    z.total += out.length;
    return out;
  }
  async function partie(z, nom) { const b = await entree(z, nom); return b == null ? null : texte(b); }

  // ------------------------------------------------------------ XML
  const ENT = { lt: '<', gt: '>', amp: '&', quot: '"', apos: '\'' };
  function cp(n) { return n >= 0 && n <= 0x10FFFF && !(n >= 0xD800 && n <= 0xDFFF) ? String.fromCodePoint(n) : '�'; }
  function entites(s) {
    if (s.indexOf('&') < 0) return s;
    return s.replace(/&(#[xX][0-9a-fA-F]+|#\d+|[A-Za-z]+);/g, (m, e) =>
      e[0] === '#' ? cp(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : (ENT[e] != null ? ENT[e] : m));
  }
  // Texte Office : « _x000D_ » code un caractère, « _x005F_ » un trait bas littéral.
  const xstr = s => s.indexOf('_x') < 0 ? s : s.replace(/_x([0-9A-Fa-f]{4})_/g, (m, h) => String.fromCharCode(parseInt(h, 16)));
  const local = n => { const i = n.indexOf(':'); return i < 0 ? n : n.slice(i + 1); };
  function attributs(s) {
    const o = {};
    const re = /([^\s=/]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
    let m;
    while ((m = re.exec(s))) {
      const v = entites(m[2] != null ? m[2] : m[3]);
      o[m[1]] = v;
      const l = local(m[1]);
      if (!(l in o)) o[l] = v;
    }
    return o;
  }
  // Parcours d'un document : f('o', nom local, attributs bruts, auto-fermant) · f('c', nom local) · f('t', texte décodé).
  function parcourir(x, f) {
    const n = x.length;
    let i = 0;
    while (i < n) {
      const lt = x.indexOf('<', i);
      if (lt < 0) { f('t', null, entites(x.slice(i))); break; }
      if (lt > i) f('t', null, entites(x.slice(i, lt)));
      if (x.startsWith('<!--', lt)) { const e = x.indexOf('-->', lt + 4); if (e < 0) throw err('abime'); i = e + 3; continue; }
      if (x.startsWith('<![CDATA[', lt)) {
        const e = x.indexOf(']]>', lt + 9);
        if (e < 0) throw err('abime');
        f('t', null, x.slice(lt + 9, e)); i = e + 3; continue;
      }
      if (x[lt + 1] === '?') { const e = x.indexOf('?>', lt + 2); if (e < 0) throw err('abime'); i = e + 2; continue; }
      if (x[lt + 1] === '!') {                        // DOCTYPE : ignoré (aucune entité déclarée n'est développée)
        const cr = x.indexOf('[', lt), gt = x.indexOf('>', lt);
        if (gt < 0) throw err('abime');
        i = (cr >= 0 && cr < gt ? (x.indexOf(']>', cr) + 2 || n) : gt + 1);
        if (i < lt) i = n;
        continue;
      }
      let j = lt + 1, q = 0;
      for (; j < n; j++) {
        const c = x.charCodeAt(j);
        if (q) { if (c === q) q = 0; } else if (c === 34 || c === 39) q = c; else if (c === 62) break;
      }
      if (j >= n) throw err('abime');
      const corps = x.slice(lt + 1, j);
      if (corps[0] === '/') f('c', local(corps.slice(1).trim()));
      else {
        const auto = corps.endsWith('/'), b = auto ? corps.slice(0, -1) : corps;
        const m = b.match(/^[^\s/>]+/), nom = m ? local(m[0]) : '';
        f('o', nom, m ? b.slice(m[0].length) : '', auto);
        if (auto) f('c', nom);
      }
      i = j + 1;
    }
  }

  // ------------------------------------------------------------ parties du classeur
  function dossier(p) { const i = p.lastIndexOf('/'); return i < 0 ? '' : p.slice(0, i + 1); }
  function resoudre(base, cible) {
    cible = String(cible || '').replace(/\\/g, '/');
    const segs = (cible[0] === '/' ? cible.slice(1) : dossier(base) + cible).split('/'), out = [];
    for (const s of segs) { if (s === '..') out.pop(); else if (s && s !== '.') out.push(s); }
    return out.join('/');
  }
  const relsDe = p => dossier(p) + '_rels/' + p.slice(dossier(p).length) + '.rels';
  function relations(xml) {
    const out = [];
    if (!xml) return out;
    parcourir(xml, (k, nom, a) => {
      if (k === 'o' && nom === 'Relationship') {
        const o = attributs(a);
        if (!/^external$/i.test(o.TargetMode || '')) out.push({ id: o.Id || '', type: o.Type || '', cible: o.Target || '' });
      }
    });
    return out;
  }
  function classeur(xml) {
    const feuilles = [];
    let d1904 = false;
    parcourir(xml, (k, nom, a) => {
      if (k !== 'o') return;
      if (nom === 'workbookPr') { const v = attributs(a).date1904; d1904 = v === '1' || /^true$/i.test(v || ''); }
      else if (nom === 'sheet') {
        const o = attributs(a);
        const rid = Object.keys(o).find(c => c.includes(':') && local(c) === 'id' && !/^xmlns:/.test(c));
        feuilles.push({ nom: o.name || '', rid: rid ? o[rid] : (o.id || '') });
      }
    });
    return { feuilles, d1904 };
  }
  // Chaînes partagées : texte simple ou riche (<r><t>…</t></r>), sans la phonétique (<rPh>).
  function chaines(xml) {
    const out = [];
    if (!xml) return out;
    let si = false, t = false, ph = 0, cur = '';
    parcourir(xml, (k, nom, v) => {
      if (k === 't') { if (si && t && !ph) cur += v; return; }
      if (nom === 'si') { if (k === 'o') { si = true; cur = ''; } else { si = false; out.push(xstr(cur)); } }
      else if (nom === 't') t = k === 'o';
      else if (nom === 'rPh') ph += k === 'o' ? 1 : -1;
    });
    return out;
  }
  // Formats de date intégrés (14–22, 45–47, et 27–36, 50–58 des variantes asiatiques).
  const DATE_INTEGRE = id => (id >= 14 && id <= 22) || (id >= 27 && id <= 36) || (id >= 45 && id <= 47) || (id >= 50 && id <= 58);
  // Format personnalisé : date si sa première section contient j/m/a (d, m, y) hors texte entre guillemets, caractères
  // échappés et crochets, et n'est pas un format texte (@).
  function formatDate(code) {
    const s = String(code || '').split(';')[0]
      .replace(/"[^"]*"/g, '').replace(/\\./g, '').replace(/[_*]./g, '').replace(/\[[^\]]*\]/g, '').replace(/general/ig, '');
    return !s.includes('@') && /[dmy]/i.test(s);
  }
  function styles(xml) {
    const out = [];
    if (!xml) return out;
    const perso = {}, ids = [];
    let dans = 0;
    parcourir(xml, (k, nom, a) => {
      if (nom === 'cellXfs') { dans = k === 'o' ? 1 : 0; return; }
      if (k !== 'o') return;
      if (nom === 'numFmt') { const o = attributs(a); perso[o.numFmtId] = o.formatCode || ''; }
      else if (nom === 'xf' && dans) ids.push(parseInt(attributs(a).numFmtId || '0', 10) || 0);
    });
    for (const id of ids) out.push(perso[id] != null ? formatDate(perso[id]) : DATE_INTEGRE(id));
    return out;
  }
  // Série Excel → « AAAA-MM-JJ » (base 1900 avec le faux 29/02/1900, ou base 1904) ; null hors plage.
  function serieVersISO(n, d1904) {
    if (!(n >= 0) || n > 2958465) return null;
    const J = 864e5, jours = Math.floor(Math.round(n * J) / J);
    if (!d1904 && jours === 60) return '1900-02-29';
    const base = d1904 ? Date.UTC(1904, 0, 1) : jours < 60 ? Date.UTC(1899, 11, 31) : Date.UTC(1899, 11, 30);
    return new Date(base + jours * J).toISOString().slice(0, 10);
  }
  function colonne(lettres) { let c = 0; for (const ch of lettres.toUpperCase()) c = c * 26 + ch.charCodeAt(0) - 64; return c - 1; }

  // Feuille → lignes (de la première à la dernière ligne remplie, de la première à la dernière colonne remplie ;
  // cellules manquantes et lignes vides intermédiaires comblées par '').
  function feuille(xml, sst, dates, d1904) {
    const R = [];
    let mnR = Infinity, mxR = -1, mnC = Infinity, mxC = -1;
    let data = false, ligne = -1, col = -1, c = null, inV = false, inIs = false, inT = false, ph = 0;
    parcourir(xml, (k, nom, a, auto) => {
      if (k === 't') {
        if (!c) return;
        if (inV) c.v = (c.v || '') + a;
        else if (inIs && inT && !ph) c.is = (c.is || '') + a;
        return;
      }
      if (nom === 'sheetData') { data = k === 'o' && !auto; return; }
      if (!data) return;
      if (k === 'o') {
        if (nom === 'row') {
          const r = parseInt(attributs(a).r, 10);
          ligne = r > 0 ? r - 1 : ligne + 1; col = -1;
        } else if (nom === 'c') {
          const o = attributs(a), m = /^\$?([A-Za-z]{1,3})\$?(\d+)$/.exec(o.r || '');
          if (m) { col = colonne(m[1]); ligne = parseInt(m[2], 10) - 1; } else col++;
          c = { l: ligne, k: col, t: o.t || 'n', s: parseInt(o.s || '0', 10) || 0, v: null, is: null };
        } else if (c && nom === 'v') { inV = true; if (c.v == null) c.v = ''; }
        else if (c && nom === 'is') { inIs = true; if (c.is == null) c.is = ''; }
        else if (inIs && nom === 't') inT = true;
        else if (inIs && nom === 'rPh') ph++;
        return;
      }
      if (nom === 'v') inV = false;
      else if (nom === 'is') inIs = false;
      else if (nom === 't') inT = false;
      else if (nom === 'rPh') ph--;
      else if (nom === 'c' && c) {
        const val = valeur(c, sst, dates, d1904);
        if (val !== undefined && c.l >= 0 && c.l < 1048576 && c.k >= 0 && c.k < 16384) {
          (R[c.l] || (R[c.l] = []))[c.k] = val;
          if (c.l < mnR) mnR = c.l; if (c.l > mxR) mxR = c.l;
          if (c.k < mnC) mnC = c.k; if (c.k > mxC) mxC = c.k;
        }
        c = null; inV = inIs = inT = false; ph = 0;
      }
    });
    if (mxR < 0) return [];
    const larg = mxC - mnC + 1, haut = mxR - mnR + 1;
    if (larg * haut > MAX_CELLULES) throw err('gros');
    const out = [];
    for (let l = mnR; l <= mxR; l++) {
      const src = R[l] || [], row = new Array(larg);
      for (let k = 0; k < larg; k++) { const v = src[mnC + k]; row[k] = v === undefined ? '' : v; }
      out.push(row);
    }
    return out;
  }
  // Valeur d'une cellule ; undefined si vide.
  function valeur(c, sst, dates, d1904) {
    const v = c.v;
    switch (c.t) {
      case 's': { if (v == null || v.trim() === '') return undefined; const s = sst[parseInt(v, 10)]; return s == null ? '' : s; }
      case 'inlineStr': return c.is != null ? xstr(c.is) : v != null ? xstr(v) : undefined;
      case 'str': return v == null ? undefined : xstr(v);
      case 'b': return v == null || v === '' ? undefined : v.trim() === '1' || /^true$/i.test(v.trim());
      case 'e': return v == null ? undefined : v.trim();
      case 'd': { if (v == null || v === '') return undefined; const m = /^\d{4}-\d{2}-\d{2}/.exec(v.trim()); return m ? m[0] : v.trim(); }
      default: {
        if (v == null || v.trim() === '') return undefined;
        const n = Number(v.trim());
        if (!isFinite(n)) return v.trim();
        if (dates[c.s]) { const d = serieVersISO(n, d1904); if (d) return d; }
        return n;
      }
    }
  }

  // ------------------------------------------------------------ lecture
  // ArrayBuffer | Uint8Array → [{ nom, lignes }] dans l'ordre des onglets.
  async function lire(buf) {
    const u = octets(buf);
    if (u.length > MAX_FICHIER) throw err('gros');
    if (estOLE(u)) throw err('xls');
    if (!estZip(u)) throw err('pasXlsx');
    const z = lireZip(u);
    const racine = relations(await partie(z, '_rels/.rels'));
    const doc = racine.find(r => /\/officeDocument$/.test(r.type));
    const wbNom = doc ? resoudre('', doc.cible) : 'xl/workbook.xml';
    if (/\.bin$/i.test(wbNom) || z.entrees.has('xl/workbook.bin')) throw err('xlsb');
    const wbXml = await partie(z, wbNom);
    if (wbXml == null) throw err('pasXlsx');
    const wb = classeur(wbXml);
    const rels = relations(await partie(z, relsDe(wbNom)));
    const relType = (t, def) => { const r = rels.find(x => new RegExp('/' + t + '$').test(x.type)); return r ? resoudre(wbNom, r.cible) : def; };
    const sst = chaines(await partie(z, relType('sharedStrings', 'xl/sharedStrings.xml')));
    const dates = styles(await partie(z, relType('styles', 'xl/styles.xml')));
    const out = [];
    for (let i = 0; i < wb.feuilles.length; i++) {
      const f = wb.feuilles[i], r = rels.find(x => x.id === f.rid);
      if (r && !/\/worksheet$/.test(r.type)) continue;                   // graphique, boîte de dialogue, macro
      const xml = await partie(z, r ? resoudre(wbNom, r.cible) : 'xl/worksheets/sheet' + (i + 1) + '.xml');
      if (xml == null) continue;
      out.push({ nom: f.nom, lignes: feuille(xml, sst, dates, wb.d1904) });
    }
    return out;
  }

  g.KladXlsx = { lire, estClasseur, serieVersISO, formatDate, LIMITES: { MAX_FICHIER, MAX_ENTREE, MAX_TOTAL, MAX_CELLULES } };
})(typeof window !== 'undefined' ? window : globalThis);
