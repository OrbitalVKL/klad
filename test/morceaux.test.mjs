// Sauvegarde par morceaux (1.0.1) : format v2 écrit et relu morceau par morceau, sur un jeu fictif plus gros que les
// données réelles (5 000 opérations sur 3 ans, reprise avec des PDF) ; chaque écriture vers Android reste petite ;
// phrase fausse, fichier tronqué, altéré ou réordonné refusés ; sauvegardes de la 1.0.0 (v1) toujours lisibles.
// Données fictives uniquement.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { charge, json } from './charge.mjs';

const { KladModele: M, KladCoffre: C } = charge(['anon.js', 'modele.js', 'coffre.js']);
const ITER = 2000;      // rapide pour les tests ; le téléphone utilise SAUV_ITER

// État fictif : 5 000 opérations sur 3 ans et 4 comptes, carnet de reprise avec 3 Mo de « PDF ».
function grandEtat() {
  const S = M.vide();
  S.cle = { appId: 'app-fictive', pem: '-----BEGIN PRIVATE KEY-----fictive', redirectUrl: '', claude: 'sk-ant-fictive' };
  const comptes = ['Courant', 'Commun', 'Carte', 'Livret'].map((l, i) => M.nouveauCompte(S, { libelle: l, role: i === 1 ? 'commun' : 'courant' }));
  let graine = 7;
  const hasard = () => { graine = (graine * 1664525 + 1013904223) >>> 0; return graine / 4294967296; };
  for (let k = 0; k < 5000; k++) {
    const c = comptes[k % 4];
    const d = new Date(Date.UTC(2023, 10, 1) + Math.floor(hasard() * 3 * 365) * 864e5).toISOString().slice(0, 10);
    (S.ops[c.id] || (S.ops[c.id] = [])).push({ id: c.id + ':t:' + k, compte: c.id, date: d, montant: -Math.round(100 + hasard() * 20000),
      libelle: 'CARTE ' + d.slice(8) + '/' + d.slice(5, 7) + ' ACHAT FICTIF NUMERO ' + k + ' — café « crème » ✓', statut: 'comptabilisee', source: 'eb' });
  }
  const pdf = 'JVBERi0xLjQK' + 'QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVo'.repeat(30000);      // ≈ 1 Mo chacun, fictifs
  S.carnet = { klad: { appels: { titre: 'Résidence fictive' } }, _payload: { pdfs: [pdf, pdf, pdf].map((p, i) => ({ nom: 'appel-' + i + '.pdf', data: p })) } };
  S.budget = { v: 3, reglages: { cycle: 'mois' }, equilibre: { items: Array.from({ length: 300 }, (_, i) => ({ l: 'Équipement ' + i, m: i * 100 })) } };
  return S;
}

async function ecrire(S, bk, morceau) {
  const ecrits = [];
  const r = await C.ecrireSauvegarde(bk, C.contenuSauvegarde(S, { theme: 'sombre', palette: 'grafit' }), async b => { ecrits.push(b.slice()); }, new Date('2026-10-30T10:00:00Z'), morceau);
  const tout = new Uint8Array(ecrits.reduce((t, b) => t + b.length, 0));
  let o = 0; for (const b of ecrits) { tout.set(b, o); o += b.length; }
  return { r, ecrits, tout };
}

// Source qui ne rend que de petits morceaux (comme la lecture par Android).
const source = (b, pas = 100000) => ({ taille: b.length, async lire(d, n) { return b.subarray(d, d + Math.min(n, pas)); } });

test('sauvegarde v2 : 5 000 opérations, 3 ans, PDF → écrite par morceaux, relue à l\'identique', { timeout: 120000 }, async () => {
  const S = grandEtat();
  const phrase = C.newPhrase();
  const bk = await C.newBackupKey(phrase, ITER);
  const { r, ecrits, tout } = await ecrire(S, bk);
  assert.ok(tout.length > 4e6, 'jeu plus gros que les données réelles : ' + tout.length + ' octets');
  const plusGros = Math.max(...ecrits.map(b => b.length));
  assert.ok(plusGros <= C.MORCEAU + 1024, 'chaque écriture vers Android reste petite : ' + plusGros);
  assert.ok(Math.ceil(plusGros / 3) * 4 < 512 * 1024, 'en base64, moins de 512 Ko par message');
  assert.equal(r.enregistrements, ecrits.length - 1);
  const texte = new TextDecoder().decode(tout);
  assert.doesNotMatch(texte, /ACHAT FICTIF|sk-ant|Résidence|JVBERi/, 'fichier chiffré');
  assert.match(texte.slice(0, 200), /^\{"format":"klad-sauvegarde","v":2,/);

  const h = await C.enteteSauvegarde(source(tout));
  assert.deepEqual([h.v, h.date], [2, '2026-10-30']);
  const res = await C.ouvrirSauvegarde(source(tout), phrase.toLowerCase());
  const attendu = json(C.contenuSauvegarde(S, { theme: 'sombre', palette: 'grafit' }));
  assert.deepEqual(json(res.payload), attendu);
  assert.equal(res.bk.cle, bk.cle);
  assert.equal(res.bk.dernier, '2026-10-30');
  const v = C.comparerSauvegarde(res.payload, S, { theme: 'sombre', palette: 'grafit' });
  assert.deepEqual(json([v.lisible, v.complete, v.differents, v.manquants]), [true, true, [], []]);
  const R = await C.depuisSauvegarde(res.payload);
  assert.equal(Object.values(R.ops).reduce((t, l) => t + l.length, 0), 5000);
});

test('sauvegarde v2 : phrase fausse, fichier tronqué, altéré ou réordonné refusés', async () => {
  const S = grandEtat();
  S.carnet = null;
  const phrase = C.newPhrase();
  const bk = await C.newBackupKey(phrase, ITER);
  const { ecrits, tout } = await ecrire(S, bk, 32 * 1024);
  assert.ok(ecrits.length > 10);
  await assert.rejects(C.ouvrirSauvegarde(source(tout), C.newPhrase()), e => e.code === 'phrase');
  // tronqué : à la fin d'un enregistrement (dernier retiré) ou au milieu
  const sansFin = tout.subarray(0, tout.length - ecrits[ecrits.length - 1].length);
  await assert.rejects(C.ouvrirSauvegarde(source(sansFin), phrase), e => e.code === 'tronque');
  await assert.rejects(C.ouvrirSauvegarde(source(tout.subarray(0, Math.floor(tout.length / 2))), phrase), e => e.code === 'tronque');
  // un octet changé au milieu
  const alt = tout.slice(); alt[Math.floor(alt.length / 2)] ^= 1;
  await assert.rejects(C.ouvrirSauvegarde(source(alt), phrase), e => e.code === 'integrite' || e.code === 'tronque');
  // deux enregistrements échangés
  const L = ecrits.slice(); [L[3], L[4]] = [L[4], L[3]];
  const re = new Uint8Array(tout.length); let o = 0; for (const b of L) { re.set(b, o); o += b.length; }
  await assert.rejects(C.ouvrirSauvegarde(source(re), phrase), e => e.code === 'integrite');
  // date de l'en-tête changée : donnée associée de chaque morceau
  const d = new TextDecoder().decode(tout.subarray(0, 300)).indexOf('2026-10-30');
  const dat = tout.slice(); dat[d + 3] = 0x35;
  await assert.rejects(C.ouvrirSauvegarde(source(dat), phrase), e => e.code === 'phrase');
  await assert.rejects(C.enteteSauvegarde(source(new TextEncoder().encode('pas une sauvegarde'))), e => e.code === 'format');
  await assert.rejects(C.enteteSauvegarde(source(new TextEncoder().encode('{"format":"klad-sauvegarde","v":3}\n'))), e => e.code === 'version');
});

test('sauvegarde v1 (1.0.0) toujours lisible par le nouveau lecteur', async () => {
  const S = M.vide();
  const c = M.nouveauCompte(S, { libelle: 'Courant', role: 'courant' });
  S.ops[c.id] = [{ id: c.id + ':t:1', compte: c.id, date: '2026-10-01', montant: -1234, libelle: 'ACHAT FICTIF', statut: 'comptabilisee', source: 'eb' }];
  const phrase = C.newPhrase();
  const bk = await C.newBackupKey(phrase, ITER);
  const texte = await C.exportBackup(bk, C.contenuSauvegarde(S), new Date('2026-03-04T10:00:00Z'));
  const b = new TextEncoder().encode(texte);
  const h = await C.enteteSauvegarde(source(b, 50));
  assert.deepEqual([h.v, h.date], [1, '2026-03-04']);
  const r = await C.ouvrirSauvegarde(source(b, 50), phrase, h);
  assert.deepEqual(json(r.payload), json(C.contenuSauvegarde(S)));
});
