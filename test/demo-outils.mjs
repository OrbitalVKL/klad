// Outils du test du mode démo (0.10.10) : jeu fictif « personnel » complété dans la page (banque connectée, intitulé et
// titulaire, messagerie, clé Enable Banking, adresse de retour), liste de ce qui ne doit jamais s'afficher, et relevé
// des fuites dans tout le DOM (textes, y compris cachés et données des infobulles ; infobulles ; valeurs des champs,
// sauf les recherches : ce qu'on y tape soi-même).
// Données fictives uniquement.
import { PERSONNEL } from '../tools/mesures/donnees.mjs';

// Complète l'état (après l'import de la reprise) avec ce que la reprise ne porte pas.
export async function completer(page) {
  await page.evaluate(P => {
    const S = window.KladApp.etat();
    S.modele.connexions.s1 = { banque: P.banque, aspsp: { name: P.banque, country: 'FR' }, valide: '2027-01-01T00:00:00Z' };
    const c = S.modele.comptes[0];
    c.source = Object.assign({}, c.source, { intitule: P.intitule, titulaire: P.personnes[0].toUpperCase(), fin4: P.finCarte });
    S.modele.extras = Object.assign({}, S.modele.extras, { mail: { hote: P.adresses[1], port: 993, adresse: P.adresses[0], expediteurs: 'syndic-mimosas.example', motsCles: 'appel de fonds MIMOSAS', jours: 400 } });
    S.cle = Object.assign({}, S.cle, { appId: P.appId, redirectUrl: 'https://' + P.adresses[2] + '/klad/retour.html' });
    S.classement.regles.push({ mot: 'QUENARD', cat: 'Apports compte commun', sub: 'Basile Quenard', le: new Date().toISOString() });
    // 1.1.1 : Patrimoine saisi (crypto, livret, plan d'épargne), historique des observations, rapprochement à la main
    const X = P.patrimoine, auj = new Date().toISOString().slice(0, 10);
    S.budget.crypto = { positions: X.crypto.map((c, i) => ({ id: 'cr' + i, nom: c[0], investi: c[1], valeur: c[2], le: auj })) };
    S.budget.livret = Object.assign({}, S.budget.livret, { base: X.livret, date: auj.slice(0, 4) + '-01-15', taux: 2.4 });
    S.budget.pee = { plan: { emp: P.employeur, teneur: X.teneur, entree: '2024-01-01', abTaux: 100, abPlaf: 1500, dispo: 5 },
      fonds: [{ id: 'f1', nom: X.fonds, cat: 'div', sri: 4, vl: X.valeurPart, vlDate: auj }],
      vers: [{ id: 'v1', d: auj.slice(0, 4) + '-03-15', orig: 'vol', fid: 'f1', mt: X.versement, parts: 318.5 }],
      closed: [{ emp: P.employeur, note: X.ancienPlan, inv: 1000, out: 1100, dOut: '2023-05-01' }] };
    S.budget.histObs = [{ titre: 'Échéance ' + P.textes[4], le: new Date().toISOString(), niveau: 'warn', scope: 'commun', texte: P.personnes[1] + ' : ' + P.textes[4] + ' n° ' + P.references[0] + ' prélevé.' }];
    const M = window.KladModele, cour = S.modele.comptes.find(c => c.role === 'courant');
    const w = M.nouveauCompte(S, { libelle: X.portefeuille, role: 'paiement_en_ligne', prelevement: { motif: X.motifPortefeuille } });
    const o = (c, id, date, montant, libelle) => ({ id: c.id + ':m:demo' + id, compte: c.id, date, montant, libelle, statut: 'comptabilisee', source: 'manuel', categorie: null, vue: true });
    const j = n => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
    S.ops[w.id] = [o(w, 1, j(12), -5490, X.achat)];
    S.ops[cour.id].push(o(cour, 2, j(8), -5990, 'PRLV ' + X.motifPortefeuille + ' ' + P.references[1]));
    window.__demoRap = { w: w.id, cour: cour.id, achat: w.id + ':m:demo1', prel: cour.id + ':m:demo2' };
    window.KladApp.changed('test');
  }, PERSONNEL);
}

// Ce qui ne doit jamais s'afficher : données personnelles du jeu, libellés des opérations (forme courte, et complète
// quand la forme courte est un mot courant), noms des catégories créées.
export async function interdits(page) {
  return page.evaluate(P => {
    const S = window.KladApp.etat(), D = window.KladDemo, V = window.KladVues;
    const L = new Set();
    const mot = s => { if (s && String(s).trim().length >= 4) L.add(D.fold(s)); };
    P.personnes.forEach(n => { mot(n); n.split(' ').forEach(mot); });
    [P.employeur, 'Zéphyrine', P.banque, 'Mirabelle', P.intitule, P.iban, P.iban.replace(/\s/g, ''), P.appId, ...P.categories, ...P.postes, ...P.references, ...P.adresses, ...P.textes].forEach(mot);
    // 1.1.1 : noms et montants saisis du Patrimoine, portefeuille et achat rapproché
    const X = P.patrimoine;
    [...X.crypto.map(c => c[0]), X.teneur, X.fonds, X.ancienPlan, X.portefeuille, X.motifPortefeuille, X.achat].forEach(mot);
    for (const v of X.montants) L.add(v);
    L.add('…' + P.finCarte); L.add(P.finCarte);
    for (const cid of Object.keys(S.ops)) for (const o of S.ops[cid]) {
      const c = V.libelleCourt(o.libelle);
      if (D.courant(c) || c.length < 4) mot(o.libelle); else mot(c);
    }
    return [...L];
  }, PERSONNEL);
}

// Fuites dans le DOM (mots entiers, sans casse ni accents) → [{ ou, mot, extrait }].
export async function fuites(page, L) {
  return page.evaluate(L => {
    const D = window.KladDemo;
    const morceaux = [];
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      const p = n.parentNode;
      if (p && (p.nodeName === 'STYLE' || (p.nodeName === 'SCRIPT' && !p.classList.contains('tips')))) continue;
      morceaux.push(['texte', n.nodeValue]);
    }
    for (const e of document.querySelectorAll('[aria-label],[title],[placeholder]')) for (const a of ['aria-label', 'title', 'placeholder']) if (e.getAttribute(a)) morceaux.push([a, e.getAttribute(a)]);
    for (const i of document.querySelectorAll('input, textarea')) if (i.value && !i.matches('#q, #icQ')) morceaux.push(['champ #' + (i.id || i.name || i.className), i.value]);
    const out = [];
    const bord = (t, i, k) => !/[A-Z0-9]/.test(t[i - 1] || ' ') && !/[A-Z0-9]/.test(t[i + k.length] || ' ');
    for (const [ou, v] of morceaux) {
      const t = D.fold(v);
      for (const k of L) {
        let i = t.indexOf(k);
        while (i >= 0 && !bord(t, i, k)) i = t.indexOf(k, i + 1);
        if (i >= 0) out.push({ ou, mot: k, extrait: v.slice(0, 120) });
      }
    }
    return out;
  }, L);
}

// Parcours de tous les écrans et volets (banc de mesure), plus : postes dépliés de Budget et Commun (chaque sous-vue),
// recherche dans les opérations, comptes de l'accueil, fiches des comptes, catégories de la tendance.
export async function parcoursComplet(B, f) {
  const { page } = B;
  await B.ecransPrincipaux(f);
  await B.ecransPlus(f);
  for (const t of ['budget', 'commun']) {
    await B.onglet(t);
    const sv = await page.$$eval('[data-sousvue]', bs => [...new Set(bs.filter(b => b.offsetParent !== null).map(b => b.dataset.sousvue))]);
    for (const s of [null, ...sv]) {
      if (s) { await page.locator('[data-sousvue="' + s + '"]:visible').first().click(); await B.pause(250); }
      // chaque poste déplié (le rendu est refait à chaque appui)
      for (let i = 0; i < 40; i++) {
        const k = await page.evaluate(i => { const b = [...document.querySelectorAll('#appli .poste-nom[data-poste][aria-expanded="false"]')].filter(x => x.offsetParent !== null)[0]; return b ? b.dataset.poste : null; }, i);
        if (!k) break;
        await page.evaluate(k => { const b = [...document.querySelectorAll('#appli .poste-nom[data-poste]')].find(x => x.dataset.poste === k && x.offsetParent !== null); if (b) b.click(); }, k);
        await B.pause(60);
      }
      await f(t + '›' + (s || 'début') + '›postes');
      // tendance : chaque catégorie proposée
      const sel = page.locator('#appli select#tend-mode:visible');
      if (await sel.count()) {
        // séries et catégories créées par le propriétaire (les catégories d'office n'ont rien de personnel)
        const vals = await sel.first().evaluate(s => [...s.options].map(o => o.value).filter(v => v && (!/^cat:/.test(v) || !(window.KladClasse.CATEGORIES[v.slice(4)]))));
        for (const v of vals) { await page.locator('#appli select#tend-mode:visible').first().selectOption(v, { timeout: 3000 }).catch(() => {}); await B.pause(80); await f(t + '›tendance›' + v); }
      }
    }
  }
  // recherche
  await B.operationsPerso();
  for (const q of ['atlantide', 'courses', 'quenard']) {
    if (!(await page.locator('#q:visible').count())) break;
    await page.evaluate(() => { const b = document.querySelector('[data-perimetre="tout"]'); if (b) b.click(); });
    await page.locator('#q:visible').fill(q, { timeout: 3000 }).catch(() => {});
    await B.pause(400);
    await f('recherche›' + q);
  }
  if (await page.locator('#q:visible').count()) { await page.locator('#q:visible').fill('', { timeout: 3000 }).catch(() => {}); await B.pause(200); }
  // comptes de l'accueil et leurs fiches
  await B.onglet('accueil');
  const comptes = await page.$$eval('#appli [data-compte]', bs => [...new Set(bs.map(b => b.dataset.compte))]);
  for (const c of comptes) {
    await B.onglet('accueil');
    const b = page.locator('#appli [data-compte="' + c + '"]').first();
    if (!(await b.isVisible().catch(() => false))) continue;
    await b.click({ timeout: 3000 }).catch(() => {}); await B.pause(300);
    await f('compte›' + c);
  }
  await B.fermer();
}
