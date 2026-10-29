// Tests : lecture d'un classeur Excel (.xlsx) sans bibliothèque (www/xlsx.js) et import d'un relevé Excel par les mêmes
// règles que le CSV (www/releve.js). Les classeurs sont fabriqués ici (ZIP écrit à la main, entrées stockées et
// compressées). Sans réseau, données fictives uniquement.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { charge, json } from './charge.mjs';

const X = charge(['anon.js', 'eb.js', 'format.js', 'modele.js', 'xlsx.js', 'releve.js'], { DecompressionStream });
const { KladXlsx: XL, KladReleve: RL } = X;
const enc = new TextEncoder();

// ------------------------------------------------------------ fabrication d'un ZIP / d'un classeur
const CRC = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = u => { let c = 0xFFFFFFFF; for (const b of u) c = CRC[(c ^ b) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
async function deflate(u) {
  const s = new Blob([u]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(s).arrayBuffer());
}
// entrees : [{ nom, data (texte ou octets), stocke?, flags?, usize? (taille annoncée, pour mentir) }]
async function zip(entrees) {
  const locaux = [], central = [];
  let off = 0;
  for (const e of entrees) {
    const brut = typeof e.data === 'string' ? enc.encode(e.data) : e.data;
    const methode = e.stocke ? 0 : 8, data = e.stocke ? brut : await deflate(brut), nom = enc.encode(e.nom);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, e.flags || 0, true); h.setUint16(8, methode, true);
    h.setUint32(14, crc32(brut), true); h.setUint32(18, data.length, true); h.setUint32(22, e.usize != null ? e.usize : brut.length, true);
    h.setUint16(26, nom.length, true);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, e.flags || 0, true);
    c.setUint16(10, methode, true); c.setUint32(16, crc32(brut), true); c.setUint32(20, data.length, true);
    c.setUint32(24, e.usize != null ? e.usize : brut.length, true); c.setUint16(28, nom.length, true); c.setUint32(42, off, true);
    locaux.push(new Uint8Array(h.buffer), nom, data);
    central.push(new Uint8Array(c.buffer), nom);
    off += 30 + nom.length + data.length;
  }
  const tc = central.reduce((s, x) => s + x.length, 0);
  const fin = new DataView(new ArrayBuffer(22));
  fin.setUint32(0, 0x06054b50, true); fin.setUint16(8, entrees.length, true); fin.setUint16(10, entrees.length, true);
  fin.setUint32(12, tc, true); fin.setUint32(16, off, true);
  const parts = [...locaux, ...central, new Uint8Array(fin.buffer)];
  const out = new Uint8Array(parts.reduce((s, x) => s + x.length, 0));
  let p = 0;
  for (const x of parts) { out.set(x, p); p += x.length; }
  return out;
}
const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// Classeur : feuilles [{ nom, xml (contenu de <sheetData>) }], sst (liste de <si> déjà écrits), styles (xml), d1904,
// stocke (toutes les entrées stockées), autres entrées.
async function classeur({ feuilles, sst, styles, d1904, stocke, plus }) {
  const e = [
    { nom: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>', stocke: true },
    { nom: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="' + REL + '/officeDocument" Target="xl/workbook.xml"/></Relationships>', stocke: true },
    { nom: 'xl/workbook.xml', data: '<?xml version="1.0" encoding="UTF-8"?><workbook ' + NS + '>' + (d1904 ? '<workbookPr date1904="1"/>' : '<workbookPr/>') +
      '<sheets>' + feuilles.map((f, i) => '<sheet name="' + esc(f.nom) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 10) + '"/>').join('') + '</sheets></workbook>', stocke },
    { nom: 'xl/_rels/workbook.xml.rels', data: '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      feuilles.map((f, i) => '<Relationship Id="rId' + (i + 10) + '" Type="' + REL + '/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>').join('') +
      '<Relationship Id="rId2" Type="' + REL + '/sharedStrings" Target="sharedStrings.xml"/><Relationship Id="rId3" Type="' + REL + '/styles" Target="/xl/styles.xml"/></Relationships>', stocke },
    { nom: 'xl/sharedStrings.xml', data: '<sst ' + NS + ' count="' + (sst || []).length + '">' + (sst || []).join('') + '</sst>', stocke },
    { nom: 'xl/styles.xml', data: styles || '<styleSheet ' + NS + '><cellXfs count="1"><xf numFmtId="0"/></cellXfs></styleSheet>', stocke },
    ...feuilles.map((f, i) => ({ nom: 'xl/worksheets/sheet' + (i + 1) + '.xml', data: '<worksheet ' + NS + '><sheetData>' + f.xml + '</sheetData></worksheet>', stocke })),
    ...(plus || [])
  ];
  return zip(e);
}
const si = t => '<si><t>' + esc(t) + '</t></si>';
// Styles : 0 général, 1 date intégrée (14), 2 « dd/mm/yyyy;@ », 3 « [$-40C]d mmmm yyyy », 4 texte (@), 5 « #,##0.00 € », 6 date-heure (22)
const STYLES = '<styleSheet ' + NS + '><numFmts count="4"><numFmt numFmtId="164" formatCode="dd/mm/yyyy;@"/>' +
  '<numFmt numFmtId="165" formatCode="[$-40C]d\\ mmmm\\ yyyy"/><numFmt numFmtId="166" formatCode="#,##0.00\\ &quot;€&quot;"/>' +
  '<numFmt numFmtId="167" formatCode="&quot;jour&quot;\\ 0"/></numFmts>' +
  '<cellStyleXfs count="1"><xf numFmtId="14"/></cellStyleXfs>' +
  '<cellXfs count="8"><xf numFmtId="0"/><xf numFmtId="14" applyNumberFormat="1"/><xf numFmtId="164"><alignment horizontal="left"/></xf>' +
  '<xf numFmtId="165"/><xf numFmtId="49"/><xf numFmtId="166"/><xf numFmtId="22"/><xf numFmtId="167"/></cellXfs></styleSheet>';
const serie = iso => (Date.parse(iso + 'T00:00:00Z') - Date.UTC(1899, 11, 30)) / 864e5;

// ------------------------------------------------------------ lecture
test('xlsx : chaînes partagées, texte riche, entités, nombres, booléens, cellules manquantes, lignes vides', async () => {
  const sst = [si('Date'), si('Libellé'), '<si><r><rPr><b/></rPr><t>CB </t></r><r><t xml:space="preserve">BOULANGERIE</t></r><rPh sb="0" eb="1"><t>ふりがな</t></rPh></si>',
    si('Fromages & « Cie » <fictif>'), '<si><t>Ligne_x000D_\nsuite</t></si>', '<si/>'];
  const xml = '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="s"><v>1</v></c></row>' +
    '<row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2"><v>-12.5</v></c><c r="C2" t="b"><v>1</v></c><c r="D2" t="s"><v>5</v></c></row>' +
    '<row r="4"><c r="A4" t="s"><v>3</v></c><c r="B4" t="inlineStr"><is><r><t>en </t></r><r><t>ligne</t></r></is></c>' +
    '<c r="C4" t="str"><f>A1&amp;"x"</f><v>Datex</v></c><c r="D4" t="e"><v>#DIV/0!</v></c></row>' +
    '<row r="5"><c r="B5"><v>1.5E3</v></c><c r="C5" s="0"/><c r="D5" t="s"><v>4</v></c></row>' +
    '<row><c><v>7</v></c><c t="b"><v>0</v></c></row>';
  for (const stocke of [false, true]) {
    const f = await XL.lire(await classeur({ feuilles: [{ nom: 'Relevé fictif', xml }], sst, stocke }));
    assert.deepEqual(json(f), [{ nom: 'Relevé fictif', lignes: [
      ['Date', '', 'Libellé', ''],
      ['CB BOULANGERIE', -12.5, true, ''],
      ['', '', '', ''],
      ['Fromages & « Cie » <fictif>', 'en ligne', 'Datex', '#DIV/0!'],
      ['', 1500, '', 'Ligne\r\nsuite'],
      [7, false, '', '']
    ] }]);
  }
});

test('xlsx : dates (formats intégrés et personnalisés, base 1900 et 1904), formats non date', async () => {
  const d = serie('2026-10-02');
  const xml = '<row r="1"><c r="A1" s="1"><v>' + d + '</v></c><c r="B1" s="2"><v>' + (d + 13) + '</v></c><c r="C1" s="3"><v>' + d + '</v></c>' +
    '<c r="D1" s="6"><v>' + (d + 0.75) + '</v></c><c r="E1" s="4"><v>' + d + '</v></c><c r="F1" s="5"><v>1234.5</v></c><c r="G1" s="7"><v>3</v></c>' +
    '<c r="H1" t="d"><v>2026-10-05T00:00:00</v></c></row>';
  const [f] = await XL.lire(await classeur({ feuilles: [{ nom: 'F', xml }], styles: STYLES }));
  assert.deepEqual(json(f.lignes), [['2026-10-02', '2026-10-15', '2026-10-02', '2026-10-02', d, 1234.5, 3, '2026-10-05']]);
  // base 1904 : la même date a une série plus petite de 1462 jours
  const [g] = await XL.lire(await classeur({ feuilles: [{ nom: 'F', xml: '<row r="1"><c r="A1" s="1"><v>' + (d - 1462) + '</v></c><c r="B1" s="1"><v>0</v></c></row>' }], styles: STYLES, d1904: true }));
  assert.deepEqual(json(g.lignes), [['2026-10-02', '1904-01-01']]);
  // séries de référence, faux 29/02/1900 compris
  assert.deepEqual([1, 59, 60, 61, 44197, 44197.999999].map(n => XL.serieVersISO(n, false)), ['1900-01-01', '1900-02-28', '1900-02-29', '1900-03-01', '2021-01-01', '2021-01-01']);
  assert.equal(XL.serieVersISO(44197 - 1462, true), '2021-01-01');
  assert.equal(XL.serieVersISO(-1, false), null);
  assert.deepEqual(['dd/mm/yyyy;@', 'yyyy-mm-dd', '[$-F800]dddd\\,\\ mmmm\\ dd\\,\\ yyyy', '@', '"jour" 0', '#,##0.00 [$€-40C]', 'General', '0.00;[Red]-0.00'].map(XL.formatDate),
    [true, true, true, false, false, false, false, false]);
});

test('xlsx : plusieurs feuilles dans l\'ordre des onglets, graphique ignoré, préfixe d\'espace de noms', async () => {
  const u = await classeur({
    feuilles: [{ nom: 'Notes', xml: '<row r="1"><c r="A1" t="inlineStr"><is><t>Notes fictives</t></is></c></row>' }, { nom: 'Vide', xml: '' }, { nom: 'Opérations', xml: '<row r="2"><c r="B2"><v>42</v></c></row>' }],
    plus: []
  });
  const f = await XL.lire(u.buffer);                                       // ArrayBuffer accepté
  assert.deepEqual(json(f), [{ nom: 'Notes', lignes: [['Notes fictives']] }, { nom: 'Vide', lignes: [] }, { nom: 'Opérations', lignes: [[42]] }]);
  // feuille écrite avec un préfixe (x:) et un onglet graphique
  const wb = '<x:workbook xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="' + REL + '"><x:sheets>' +
    '<x:sheet name="Graphique" sheetId="1" r:id="rId1"/><x:sheet name="Données" sheetId="2" r:id="rId2"/></x:sheets></x:workbook>';
  const z = await zip([
    { nom: '_rels/.rels', data: '<Relationships><Relationship Id="a" Type="' + REL + '/officeDocument" Target="/xl/workbook.xml"/></Relationships>' },
    { nom: 'xl/workbook.xml', data: wb },
    { nom: 'xl/_rels/workbook.xml.rels', data: '<Relationships><Relationship Id="rId1" Type="' + REL + '/chartsheet" Target="chartsheets/sheet1.xml"/><Relationship Id="rId2" Type="' + REL + '/worksheet" Target="./worksheets/../worksheets/data.xml"/></Relationships>' },
    { nom: 'xl/chartsheets/sheet1.xml', data: '<chartsheet/>' },
    { nom: 'xl/worksheets/data.xml', data: '<x:worksheet xmlns:x="m"><x:sheetData><x:row r="1"><x:c r="A1" t="inlineStr"><x:is><x:t>OK</x:t></x:is></x:c><x:c r="B1"><x:v>2</x:v></x:c></x:row></x:sheetData></x:worksheet>', stocke: true }
  ]);
  assert.deepEqual(json(await XL.lire(z)), [{ nom: 'Données', lignes: [['OK', 2]] }]);
});

test('xlsx : refus propres (pas un classeur, ancien .xls, chiffré, binaire, endommagé, trop gros)', async () => {
  assert.equal(XL.estClasseur(enc.encode('Date;Libellé\n')), false);
  await assert.rejects(XL.lire(enc.encode('Date;Libellé;Montant\n02/10/2026;CB BOULANGERIE;-1,20\n')), /n'est pas un classeur Excel/);
  await assert.rejects(XL.lire('texte'), /n'est pas un classeur Excel/);
  const ole = new Uint8Array(512); ole.set([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]);
  assert.equal(XL.estClasseur(ole), true);
  await assert.rejects(XL.lire(ole), /Ancien format Excel \(\.xls\)/);
  await assert.rejects(XL.lire(await zip([{ nom: 'mimetype', data: 'application/vnd.oasis.opendocument.spreadsheet', stocke: true }, { nom: 'content.xml', data: '<x/>' }])), /n'est pas un classeur Excel/);
  const chiffre = await zip([{ nom: '_rels/.rels', data: '<Relationships/>', flags: 1, stocke: true }]);
  await assert.rejects(XL.lire(chiffre), /chiffré/);
  await assert.rejects(XL.lire(await zip([{ nom: 'xl/workbook.bin', data: 'x', stocke: true }])), /binaire \(\.xlsb\)/);
  const tronque = (await classeur({ feuilles: [{ nom: 'F', xml: '' }] })).slice(0, 200);
  await assert.rejects(XL.lire(tronque), /n'est pas un classeur Excel|endommagé/);
  // bombe ZIP : 21 Mo de zéros compressés, taille annoncée exacte, puis taille annoncée mensongère
  const zeros = new Uint8Array(21 * 1024 * 1024);
  const bombe = usize => zip([
    { nom: '_rels/.rels', data: '<Relationships><Relationship Id="a" Type="' + REL + '/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
    { nom: 'xl/workbook.xml', data: zeros, usize }
  ]);
  await assert.rejects(XL.lire(await bombe()), /trop volumineux/);
  await assert.rejects(XL.lire(await bombe(100)), /trop volumineux/);
  // feuille creuse démesurée (une valeur en A1, une autre tout en bas à droite)
  const creuse = await classeur({ feuilles: [{ nom: 'F', xml: '<row r="1"><c r="A1"><v>1</v></c></row><row r="1048576"><c r="XFD1048576"><v>2</v></c></row>' }] });
  await assert.rejects(XL.lire(creuse), /trop volumineux/);
  // flux deflate abîmé
  const abime = await zip([{ nom: '_rels/.rels', data: new Uint8Array([0xFF, 0xFF, 0xFF, 0xFF]), stocke: true }]);
  const dv = new DataView(abime.buffer);
  dv.setUint16(8, 8, true); dv.setUint16(abime.length - 22 - 46 - 11 + 10, 8, true);   // méthode « deflate » sur des octets quelconques
  await assert.rejects(XL.lire(abime), /endommagé/);
});

// ------------------------------------------------------------ import d'un relevé Excel
const CSV = 'Relevé fictif\r\nDate;Date de valeur;Libellé;Débit;Crédit\r\n02/10/2026;02/10/2026;CB BOULANGERIE;12,50;\r\n\r\n' +
  '15/10/2026;15/10/2026;"VIR ""FICTIF""";;1 200,00\r\n16/10/2026;16/10/2026;PRLV ASSURANCE FICTIVE;1 234,56;\r\nxx;;Ligne sans date;1;\r\n';
const s = t => '<c t="inlineStr"><is><t>' + esc(t) + '</t></is></c>';
const dt = iso => '<c s="1"><v>' + serie(iso) + '</v></c>';
const n = v => '<c><v>' + v + '</v></c>';
const RELEVE = '<row r="1">' + s('Relevé fictif') + '</row>' +
  '<row r="2">' + s('Date') + s('Date de valeur') + s('Libellé') + s('Débit') + s('Crédit') + '</row>' +
  '<row r="3">' + dt('2026-10-02') + dt('2026-10-02') + s('CB BOULANGERIE') + n(12.5) + '</row>' +
  '<row r="5"><c r="A5" t="s"><v>0</v></c><c r="B5" s="2"><v>' + serie('2026-10-15') + '</v></c>' + s('VIR "FICTIF"') + '<c r="E5"><v>1200</v></c></row>' +
  '<row r="6">' + s('16/10/2026') + s('16/10/2026') + s('PRLV ASSURANCE FICTIVE') + s('1 234,56') + '</row>' +
  '<row r="7">' + s('xx') + n('') + s('Ligne sans date') + n(1) + '</row>';

test('relevé Excel : mêmes opérations que le même relevé en CSV (feuille sans opérations sautée)', async () => {
  const u = await classeur({
    feuilles: [{ nom: 'Lisez-moi', xml: '<row r="1">' + s('Export fictif') + '</row>' }, { nom: 'Relevé', xml: RELEVE }],
    sst: ['<si><t>15/10/2026</t></si>'], styles: STYLES
  });
  const csv = RL.lire(CSV, 'courant', '2026-10-28');
  assert.equal(csv.lignes.length, 3);
  const xl = await RL.lireFichier(u, 'courant', '2026-10-28');
  assert.equal(xl.sorte, 'xlsx');
  assert.equal(xl.entete, true);
  assert.deepEqual(json(xl.lignes), json(csv.lignes));
  assert.deepEqual(json(xl.lignes), [{ date: '2026-10-02', libelle: 'CB BOULANGERIE', montant: -1250 }, { date: '2026-10-15', libelle: 'VIR "FICTIF"', montant: 120000 },
    { date: '2026-10-16', libelle: 'PRLV ASSURANCE FICTIVE', montant: -123456 }]);
  assert.deepEqual(json(xl.stats), json(csv.stats));
  // lireLignes : même résultat que lire() sur le CSV
  assert.deepEqual(json(RL.lireLignes(RL.lignesCSV(CSV), 'courant', '2026-10-28')), json(Object.assign({}, csv, { sorte: undefined })));
  // carte à débit différé : montants numériques positifs = dépenses ; règlement écarté
  const carte = await classeur({ feuilles: [{ nom: 'Carte', xml: '<row r="1">' + s('Date') + s('Description') + s('Montant') + '</row>' +
    '<row r="2">' + dt('2026-10-03') + s('CB BOULANGERIE') + n(45.9) + '</row><row r="3">' + dt('2026-10-05') + s('PRELEVEMENT AUTOMATIQUE ENREGISTRE-MERCI') + n(-300) + '</row>' }], styles: STYLES });
  const lc = await RL.lireFichier(carte, 'carte_differee', '2026-10-28');
  assert.deepEqual(json(lc.lignes.map(x => [x.date, x.montant])), [['2026-10-03', -4590]]);
  assert.equal(lc.stats.ecartees, 1);
  // aucune feuille lisible : en-tête absent signalé
  const vide = await RL.lireFichier(await classeur({ feuilles: [{ nom: 'A', xml: '<row r="1">' + s('Libellé') + '</row>' }] }), 'courant', '2026-10-28');
  assert.deepEqual([vide.entete, vide.lignes.length, vide.sorte], [false, 0, 'xlsx']);
  assert.equal(RL.lireFeuilles([], 'courant', '2026-10-28').entete, false);
});

test('relevé : fichier texte reçu en octets (UTF-8 ou Windows-1252) toujours lu comme avant', async () => {
  const utf8 = await RL.lireFichier(enc.encode(CSV), 'courant', '2026-10-28');
  assert.equal(utf8.sorte, 'csv');
  assert.deepEqual(json(utf8.lignes), json(RL.lire(CSV, 'courant', '2026-10-28').lignes));
  const w1252 = Uint8Array.from('Date;Libellé;Montant\n02/10/2026;CB BOULANGERIE;-1,20\n', ch => ch === 'é' ? 0xE9 : ch.charCodeAt(0));
  const l = await RL.lireFichier(w1252, 'courant', '2026-10-28');
  assert.deepEqual(json(l.lignes), [{ date: '2026-10-02', libelle: 'CB BOULANGERIE', montant: -120 }]);
  const j = await RL.lireFichier(enc.encode(JSON.stringify([{ date: '2026-10-01', label: 'CB BOULANGERIE', amount: -2.4 }])), 'courant', '2026-10-28');
  assert.deepEqual([j.sorte, j.lignes[0].montant], ['json', -240]);
});
