// Klad — extra « Mail » : appels de fonds lus dans la boîte de réception (IMAP, lecture seule, plugin KladMail).
// Ce fichier trie les messages rendus par le plugin et les verse dans S.budget.appels (format de l'ancienne version :
// mails { id: { mail, d, cp, kind, fn } } et pdfs [{ cp, kind, d, a, name }]), que KladCommun.appels exploite déjà.
// Expéditeurs, mots-clés et motifs propres au propriétaire (syndic, résidence, nommage des pièces) sont des données :
// réglages de l'extra (Plus › Extras), pré-remplis par le complément (klad.mail) ; jamais dans le code.
(function (g) {
  'use strict';

  const KB = () => g.KladBudget;
  const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
  const rx = (s, f) => { if (!s) return null; try { return new RegExp(s, f || 'i'); } catch (e) { return null; } };
  const liste = v => (Array.isArray(v) ? v : String(v || '').split(/[,;\n]/)).map(x => String(x).trim()).filter(Boolean);

  // Réglages par défaut : Gmail, et des motifs génériques (français) pour un appel de fonds de copropriété.
  const DEFAUTS = { hote: 'imap.gmail.com', port: 993, jours: 400, max: 60,
    exigible: 'exigible le (\\d{2})/(\\d{2})/(\\d{4})', total: 'total[^\\d\\n]{0,60}?([\\d .\\u00a0\\u202f]+,\\d{2})',
    avance: 'avance de tr[ée]sorerie|fonds de roulement' };

  // Réglages effectifs : complément (klad.mail) < réglages saisis dans Klad (S.modele.extras.mail).
  function reglages(S) {
    const K0 = S && KB() ? KB().complement(S) : {};
    const C = isObj(K0.mail) ? K0.mail : {};
    const E = (S && S.modele && S.modele.extras && S.modele.extras.mail) || {};
    const R = Object.assign({}, DEFAUTS, C, E);
    R.expediteurs = liste(E.expediteurs != null ? E.expediteurs : C.expediteurs);
    R.motsCles = liste(E.motsCles != null ? E.motsCles : C.motsCles);
    R.cp = isObj(C.cp) ? C.cp : {};                 // copropriété → motif reconnu dans le mail ou le PDF
    R.port = +R.port || 993;
    R.jours = Math.min(800, Math.max(1, +R.jours || 400));
    return R;
  }

  const montant = s => { const t = String(s).replace(/[\s.  ]/g, '').replace(',', '.'); return isFinite(+t) ? Math.round(+t * 100) / 100 : null; };
  const iso = (j, m, a) => a + '-' + m + '-' + j;

  // Un message → { mail, d, cp, kind, fn } (ou null s'il ne correspond pas) et ses PDF lus → pdfs.
  // textes : { nomDePièce: texte extrait } (pdf.js) ; coproprietes : clés connues de S.budget.appels.
  function analyser(messages, R, textes, coproprietes) {
    const out = { mails: {}, pdfs: [] };
    const piece = rx(R.piece), exi = rx(R.exigible), tot = rx(R.total), av = rx(R.avance);
    const cps = Object.keys(R.cp || {}).filter(k => rx(R.cp[k]));
    const seul = (coproprietes || []).length === 1 ? coproprietes[0] : null;
    for (const m of messages || []) {
      if (!m || !m.id) continue;
      const pdfs = (m.pieces || []).filter(p => /\.pdf$/i.test(p.nom || '') || /pdf/i.test(p.type || ''));
      const p = pdfs.find(x => !piece || piece.test(x.nom || '')) || null;
      const tp = p && textes ? String(textes[p.nom] || '') : '';
      const tout = [m.sujet, m.texte, tp].join('\n');
      const it = { mail: String(m.date || '').slice(0, 10), d: null, cp: null, kind: 'charges', fn: p ? p.nom : '' };
      // date d'exigibilité et nature : nom de la pièce (motif du complément, groupes nature / année / mois / jour), sinon texte
      const pm = p && piece ? piece.exec(p.nom || '') : null;
      if (pm && pm.length >= 5) {
        it.d = pm[2] + '-' + pm[3] + '-' + pm[4];
        if (R.codeAvance && String(pm[1]).toUpperCase() === String(R.codeAvance).toUpperCase()) it.kind = 'avance';
      }
      if (!it.d && exi) { const x = exi.exec(m.texte || '') || exi.exec(tp); if (x) it.d = iso(x[1], x[2], x[3]); }
      if (it.kind === 'charges' && av && av.test(tout)) it.kind = 'avance';
      for (const k of cps) if (rx(R.cp[k]).test(tout)) { it.cp = k; break; }
      if (!it.cp) it.cp = seul;
      if (!it.d) it.d = it.mail;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(it.d)) continue;
      out.mails[m.id] = it;
      if (p && tp && tot) {
        const x = tot.exec(tp), a = x ? montant(x[1]) : null;
        if (a != null && a > 0) out.pdfs.push({ cp: it.cp, kind: it.kind, d: it.d, a, name: String(p.nom || '').slice(0, 80) });
      }
    }
    return out;
  }

  // Verse le résultat dans S.budget.appels (mails nouveaux seulement ; PDF remplacés à même nom et même date).
  // → { mails, pdfs, avant } (avant : instantané pour « Annuler »).
  function integrer(S, res) {
    const D = KB().donnees(S);
    const avant = JSON.stringify(D.appels || null);
    const A = D.appels = isObj(D.appels) ? D.appels : {};
    const M = A.mails = isObj(A.mails) ? A.mails : {};
    const P = A.pdfs = Array.isArray(A.pdfs) ? A.pdfs : [];
    let nm = 0, np = 0;
    for (const id of Object.keys(res.mails || {})) if (!M[id]) { M[id] = res.mails[id]; nm++; }
    for (const p of res.pdfs || []) {
      const i = P.findIndex(x => x.name === p.name && x.d === p.d);
      if (i >= 0) { if (P[i].a !== p.a) { P[i] = Object.assign({}, P[i], p); np++; } } else { P.push(p); np++; }
    }
    return { mails: nm, pdfs: np, avant };
  }
  function annuler(S, avant) { const D = KB().donnees(S); if (avant === 'null') delete D.appels; else D.appels = JSON.parse(avant); }

  // Ligne d'état affichée sous « Appels de fonds ».
  function etat(S) {
    const E = (S && S.modele && S.modele.extras && S.modele.extras.mail) || {};
    if (!E.on) return '';
    const n = S.budget && S.budget.appels && isObj(S.budget.appels.mails) ? Object.keys(S.budget.appels.mails).length : 0;
    return E.derniere ? 'mails lus le ' + E.derniere.slice(8, 10) + '/' + E.derniere.slice(5, 7) + ' · ' + n + ' appel' + (n > 1 ? 's' : '') + ' reçu' + (n > 1 ? 's' : '') + ' par mail'
      : 'mails pas encore lus';
  }

  g.KladMail = { DEFAUTS, reglages, analyser, integrer, annuler, etat, montant };
})(typeof window !== 'undefined' ? window : globalThis);
