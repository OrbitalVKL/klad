// Tests du lot 2.3.0 : widget d'écran d'accueil (données écrites par l'appli) et synchro planifiée (page de fond).
// - données du widget : reste à vivre de la base choisie (sans signe, « epuise »), nombre à vérifier, synchro, banque
//   à reconnecter, mode démo ; écriture seulement si les données changent ;
// - page de fond (www/fond.js) : plugins connus du pont (aucune méthode Java oubliée), réseau relayé, aucune page
//   d'appli ne la charge ;
// - parcours complet dans Chromium avec un faux pont Android : ouverture par l'enveloppe « arrière-plan », synchro
//   d'un compte fictif SANS en-têtes « utilisateur présent », blocs réécrits, widget et journal, fin signalée.
// La partie Chromium est sautée si Playwright n'est pas installé, sauf avec KLAD_PARCOURS=obligatoire.
// Données fictives uniquement.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import vm from 'node:vm';
import { generateKeyPairSync } from 'node:crypto';
import { charge, json, read } from './charge.mjs';
import { playwright } from '../tools/mesures/banc.mjs';

const PW = playwright();
const SAUT = !PW && !process.env.KLAD_PARCOURS && 'Playwright absent';
const NOW = Date.parse('2026-11-09T07:00:00Z');

const ctx = charge(['anon.js', 'eb.js', 'format.js', 'modele.js', 'widget.js']);
const { KladModele: M, KladWidgetDonnees: W } = ctx;

function etat(o = {}) {
  const S = M.vide();
  S.modele.connexions.s1 = { banque: 'Banque Fictive', pays: 'FR', valid_until: new Date(NOW + (o.expire ? -864e5 : 80 * 864e5)).toISOString(), psu: null };
  M.nouveauCompte(S, { libelle: 'Courant', source: { type: 'eb', connexion: 's1', uid: 'uid-fictif-1', empreinte: 'e1', fin4: '0000', intitule: 'COMPTE FICTIF' } });
  S.modele.sync.derniere = NOW - 3600e3;
  return S;
}
// faux KladBudget : ravChoisi renvoie la colonne demandée
const KB = reste => ({ ravChoisi: () => ({ col: { reste } }), baseRav: () => 'salaire' });

test('widget : reste à vivre sans signe, dépassé, à vérifier, synchro, banque à reconnecter, démo', () => {
  const S = etat();
  ctx.KladBudget = KB(112849);
  assert.deepEqual(json(W.construire(S, NOW, { rav: {}, av: 3 })), { v: 1, etat: 'ok', rav: 112849, epuise: false, av: 3, sync: NOW - 3600e3, reconnecter: false });
  ctx.KladBudget = KB(-4200);
  const d = json(W.construire(S, NOW, { rav: {}, av: 0 }));
  assert.equal(d.rav, 4200, 'jamais de montant négatif');
  assert.equal(d.epuise, true);
  ctx.KladBudget = KB(NaN);
  assert.equal(W.construire(S, NOW, { rav: {}, av: 0 }).rav, null, 'non calculable : pas de montant');
  assert.equal(W.construire(S, NOW, { av: 0 }).rav, null);
  assert.equal(W.construire(etat({ expire: true }), NOW, { av: 0 }).reconnecter, true, 'accès bancaire expiré');
  const S2 = etat(); S2.modele.comptes[0].aReassocier = true;
  assert.equal(W.construire(S2, NOW, {}).reconnecter, true, 'compte à réassocier');
  assert.deepEqual(json(W.construire(S, NOW, { demo: true })), { v: 1, etat: 'demo' }, 'mode démo : aucune donnée');
  const t = JSON.stringify(W.construire(S, NOW, { rav: {}, av: 2 }));
  assert.doesNotMatch(t, /Banque|Courant|FICTIF|uid|IBAN|fin4/, 'ni banque, ni compte, ni identifiant');
  delete ctx.KladBudget;
});

test('widget : écrit seulement quand les données changent, refus signalé', async () => {
  const S = etat();
  const ecrits = [];
  let refus = false;
  const L = W.creer({ async ecrire(o) { if (refus) return { ok: false, reason: 'format' }; ecrits.push(o.json); return { ok: true }; } });
  assert.equal(await L.maj(S, NOW, { av: 1 }), 'ecrit');
  assert.equal(await L.maj(S, NOW, { av: 1 }), 'inchange');
  assert.equal(await L.maj(S, NOW, { av: 2 }), 'ecrit');
  assert.equal(ecrits.length, 2);
  assert.equal(await L.maj(null, NOW, {}), 'rien');
  refus = true;
  await assert.rejects(L.maj(S, NOW, { av: 5 }), /refusées \(format\)/);
});

test('page de fond : tous les plugins Java connus du pont, chargée par Android seulement', () => {
  const f = read('www/fond.js');
  const java = path.join(new URL('..', import.meta.url).pathname, 'android/app/src/main/java');
  const fichiers = [];
  const parcourir = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) parcourir(p); else if (p.endsWith('.java')) fichiers.push(p); } };
  parcourir(java);
  let n = 0;
  for (const p of fichiers) {
    const src = fs.readFileSync(p, 'utf8');
    const nom = (src.match(/@CapacitorPlugin\(name = "(\w+)"\)/) || [])[1];
    if (!nom) continue;
    const bloc = (f.match(new RegExp(nom + ': \\[([^\\]]*)\\]')) || [])[1];
    assert.ok(bloc, 'plugin ' + nom + ' absent de fond.js');
    for (const m of src.matchAll(/@PluginMethod\s+public void (\w+)/g)) { n++; assert.ok(bloc.includes("'" + m[1] + "'"), nom + '.' + m[1] + ' absent de fond.js'); }
  }
  assert.ok(n > 30, n + ' méthodes vérifiées');
  const ix = read('www/index.html');
  assert.doesNotMatch(ix, /fond\.js/, 'jamais chargée par l\'appli');
  assert.match(ix, /grafit\.js"><\/script>\s*<script src="widget\.js">/);
  assert.match(read('android/app/src/main/java/app/klad/fond/Pages.java'), /<script src=\\"fond\.js\\"><\/script>/);
  // aucun en-tête « utilisateur présent » en arrière-plan
  assert.match(read('www/app.js'), /async function dispoPSU\(\) \{\s*\/\/[^\n]*\n\s*if \(window\.KLAD_FOND\) return \{\};/);
});

test('page de fond : appels des plugins et réseau relayés, rien sans pont', async () => {
  const appels = [], requetes = [];
  const pont = {
    appel(p, m, o) { appels.push([p, m, JSON.parse(o)]); return p === 'KladVault' && m === 'status' ? JSON.stringify({ data: { exists: true, fond: true } }) : JSON.stringify({ erreur: 'non' }); },
    http(m, u, h, b) { requetes.push([m, u, JSON.parse(h), b]); return JSON.stringify({ status: 200, headers: { 'content-type': 'application/json' }, body: '{"a":1}' }); },
    fin() {}
  };
  const g = { KladFondPont: pont, location: { href: 'https://localhost/index.html', origin: 'https://localhost' }, URL, Headers, Response, JSON, setTimeout, clearTimeout, Date };
  g.window = g;
  vm.createContext(g);
  vm.runInContext(read('www/fond.js'), g);
  assert.equal(g.KLAD_FOND, true);
  assert.ok(g.androidBridge, 'plateforme android');
  assert.ok(g.Capacitor.PluginHeaders.find(x => x.name === 'KladVault').methods.find(m => m.name === 'unlockFond'));
  assert.deepEqual(json(await g.Capacitor.nativePromise('KladVault', 'status', {})), { exists: true, fond: true });
  await assert.rejects(g.Capacitor.nativePromise('KladUpdate', 'info', { a: 1 }), /non/);
  const r = await g.fetch('https://api.enablebanking.com/accounts/x/balances', { method: 'GET', headers: { Authorization: 'Bearer t' } });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { a: 1 });
  assert.equal(requetes[0][1], 'https://api.enablebanking.com/accounts/x/balances');
  assert.equal(requetes[0][2].authorization, 'Bearer t');
  // sans pont : page ordinaire, rien n'est changé
  const g2 = { location: g.location }; g2.window = g2; vm.createContext(g2);
  vm.runInContext(read('www/fond.js'), g2);
  assert.equal(g2.KLAD_FOND, undefined);
  assert.equal(g2.Capacitor, undefined);
});

test('verrou : synchro planifiée sans écran, attente de la synchro en cours, lien du widget, réglage', () => {
  const v = read('www/verrou.js');
  assert.match(v, /async function start\(\) \{\s*if \(window\.KLAD_FOND\) return fond\(\);/);
  assert.match(v, /if \(!st\.exists \|\| !st\.fond\) return fin\(/);
  assert.match(v, /if \(!B\) \{ key = null; return fin\(\{ raison: 'coffre' \}\); \}/, 'jamais de création de phrase en arrière-plan');
  assert.match(v, /await V\.attendreFond\(\)/);
  assert.match(v, /klad:\\\/\\\/ouvrir\\\/\(trier\|apercu\)/);
  assert.match(read('www/index.html'), /id="btnFond"/);
});

// ------------------------------------------------------------ parcours Chromium avec un faux pont Android
async function coffreFictif() {
  const C = charge(['anon.js', 'eb.js', 'format.js', 'modele.js', 'coffre.js']);
  const S = C.KladModele.vide();
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  S.cle.appId = 'appli-fictive';
  S.cle.pem = privateKey.export({ type: 'pkcs8', format: 'pem' });
  S.modele.connexions.s1 = { banque: 'Banque Fictive', pays: 'FR', valid_until: '2027-01-31T00:00:00Z', psu: ['Psu-Ip-Address'] };
  C.KladModele.nouveauCompte(S, { libelle: 'Courant', source: { type: 'eb', connexion: 's1', uid: 'uid-fictif-1', empreinte: 'e1', fin4: '0000', intitule: 'COMPTE FICTIF' } });
  S.modele.sync.derniere = Date.parse('2026-11-08T13:00:00Z');
  const dek = crypto.getRandomValues(new Uint8Array(32));
  const dekB64 = Buffer.from(dek).toString('base64');
  const key = await C.KladCoffre.importDek(new Uint8Array(dek));
  const blocs = Object.assign(json(C.KladModele.versBlocs(S)), { sauvegarde: { dernier: null } });
  const blobs = {};
  for (const n of Object.keys(blocs)) blobs[n] = C.KladCoffre.toB64(await C.KladCoffre.seal(key, n, blocs[n]));
  return { blobs, dekB64 };
}

const CAPACITOR = path.resolve(new URL('../node_modules/@capacitor/core/dist/capacitor.js', import.meta.url).pathname);
const SAUT_CAP = !fs.existsSync(CAPACITOR) && !fs.existsSync(new URL('../www/vendor/capacitor.js', import.meta.url).pathname) && '@capacitor/core absent (npm install)';

function serveur(WWW) {
  const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.woff2': 'font/woff2' };
  return new Promise(resolve => {
    const s = http.createServer((req, res) => {
      const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/$/, '/index.html');
      let f = path.join(WWW, rel);
      // pont Capacitor : www/vendor/capacitor.js (préparation Android) ou celui de node_modules
      if (rel === '/vendor/capacitor.js' && !fs.existsSync(f)) f = CAPACITOR;
      if ((!f.startsWith(WWW) && f !== CAPACITOR) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { res.writeHead(404); res.end(); return; }
      let b = fs.readFileSync(f);
      // comme app.klad.fond.Pages : fond.js en tête de index.html
      if (rel === '/index.html') b = Buffer.from(String(b).replace('<head>', '<head><script src="fond.js"></script>'));
      res.writeHead(200, { 'Content-Type': T[path.extname(f)] || 'application/octet-stream' });
      res.end(b);
    });
    s.listen(0, '127.0.0.1', () => resolve(s));
  });
}

test('parcours : synchro planifiée complète dans Chromium (faux pont Android, banque fictive)', { skip: SAUT || SAUT_CAP, timeout: 180000 }, async () => {
  const { blobs, dekB64 } = await coffreFictif();
  const WWW = path.resolve(new URL('../www', import.meta.url).pathname);
  const srv = await serveur(WWW);
  const { chromium } = PW;
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const erreurs = [];
    page.on('pageerror', e => erreurs.push(e.message));
    await page.addInitScript(({ blobs, dekB64 }) => {
      const T = window.__fond = { blobs, ecrits: [], effaces: [], widget: null, grafit: null, http: [], fin: null, appels: [] };
      const rep = d => JSON.stringify({ data: d });
      window.KladFondPont = {
        appel(p, m, o) {
          o = JSON.parse(o);
          T.appels.push(p + '.' + m);
          if (p === 'KladVault') {
            if (m === 'status') return rep({ exists: true, bio: 'non', bioAvailable: false, waitMs: 0, failures: 0, strongBox: false, fond: true });
            if (m === 'unlockFond') return rep({ ok: true, dek: dekB64 });
            if (m === 'readBlob') return rep({ ok: true, data: T.blobs[o.name] || null });
            if (m === 'writeBlob') { T.blobs[o.name] = o.data; T.ecrits.push(o.name); return rep({ ok: true }); }
            if (m === 'deleteBlob') { delete T.blobs[o.name]; T.effaces.push(o.name); return rep({ ok: true }); }
            if (m === 'resultatEnregistrement') return rep({ ok: true, resultat: null });
            return rep({ ok: false, reason: 'fond' });
          }
          if (p === 'KladWidget' && m === 'ecrire') { T.widget = JSON.parse(o.json); return rep({ ok: true }); }
          if (p === 'KladGrafit') { if (m === 'ecrire') T.grafit = o.json; return rep({ ok: true, json: null }); }
          if (p === 'App') return rep(m === 'getState' ? { isActive: false } : {});
          return rep({ ok: false, reason: 'fond' });
        },
        http(m, u, h, b) {
          T.http.push({ m, u, h: JSON.parse(h) });
          const ok = body => JSON.stringify({ status: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
          if (/\/balances$/.test(u)) return ok({ balances: [{ balance_type: 'CLBD', balance_amount: { amount: '1500.00', currency: 'EUR' }, reference_date: '2026-11-08' }] });
          if (/\/transactions\?/.test(u)) return ok({ transactions: [
            { booking_date: '2026-11-07', transaction_amount: { amount: '42.10', currency: 'EUR' }, credit_debit_indicator: 'DBIT', remittance_information: ['CB COMMERCE FICTIF'], status: 'BOOK', entry_reference: 'REF-FICTIVE-1' },
            { booking_date: '2026-11-08', transaction_amount: { amount: '12.00', currency: 'EUR' }, credit_debit_indicator: 'DBIT', remittance_information: ['CB AUTRE COMMERCE FICTIF'], status: 'BOOK', entry_reference: 'REF-FICTIVE-2' }] });
          return JSON.stringify({ status: 404, headers: {}, body: '{}' });
        },
        fin(r) { T.fin = JSON.parse(r); }
      };
    }, { blobs, dekB64 });
    await page.goto('http://127.0.0.1:' + srv.address().port + '/');
    await page.waitForFunction(() => window.__fond && window.__fond.fin, null, { timeout: 120000 });
    const T = await page.evaluate(() => window.__fond);
    assert.deepEqual(erreurs, [], 'aucune erreur JavaScript');
    assert.equal(T.fin.raison, 'ok', JSON.stringify(T.fin));
    assert.equal(T.fin.erreurs, 0);
    assert.ok(T.http.length >= 2, 'banque fictive lue');
    for (const r of T.http) {
      assert.ok(!Object.keys(r.h).some(k => /^psu-/i.test(k)), 'aucun en-tête « utilisateur présent »');
      assert.match(r.h.authorization || '', /^Bearer /);
    }
    assert.ok(T.ecrits.some(n => /^ops-/.test(n)), 'opérations enregistrées');
    assert.ok(T.ecrits.includes('modele') && T.ecrits.includes('journal'), 'modèle et journal enregistrés : ' + T.ecrits.join(', '));
    assert.equal(T.widget.etat, 'ok');
    assert.equal(T.widget.av, 2, 'deux opérations à vérifier');
    assert.ok(T.widget.sync > Date.parse('2026-11-09T00:00:00Z') || T.widget.sync > Date.now() - 600e3, 'heure de synchro mise à jour');
    assert.equal(T.grafit, null, 'lien Grafit désactivé : rien écrit');
    assert.ok(!T.appels.some(a => /unlockPin|unlockBio|create/.test(a)), 'jamais de code ni d\'empreinte');
    // journal relu : synchro planifiée notée, anonyme
    const j = await page.evaluate(() => JSON.stringify(window.KladApp.etat().journal));
    assert.match(j, /Synchro planifiée/);
    assert.doesNotMatch(j, /Banque Fictive|COMMERCE FICTIF|Courant/);
  } finally {
    await browser.close();
    srv.close();
  }
});
