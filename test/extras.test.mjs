// Tests : extras (Lot 9b) — requêtes Claude (document, format JSON, repli, coût, aperçu), conversions vers les formats
// de Klad, tri des mails d'appels de fonds (fausse boîte de réception), intégration annulable, journal anonyme.
// Aucun réseau : fetch simulé. Données fictives uniquement.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { charge, json } from './charge.mjs';

const X = charge(['anon.js', 'eb.js', 'format.js', 'modele.js', 'classement.js', 'carnet.js', 'budget.js', 'commun.js', 'fisc.js', 'claude.js', 'mail.js', 'extras.js']);
const { KladModele: M, KladBudget: KB, KladClaude: CL, KladMail: ML, KladExtras: EX, KladAnon: AN } = X;
const PDF = Buffer.from('%PDF-1.4 document fictif').toString('base64');
const CLE = 'sk-ant-api03-' + 'x'.repeat(40);

// faux fetch : enregistre les requêtes, répond selon le chemin
function fauxFetch(reponses) {
  const vus = [];
  const f = async (url, o) => {
    vus.push({ url, headers: o.headers, body: JSON.parse(o.body) });
    const r = reponses[url.replace(CL.API, '')];
    const v = typeof r === 'function' ? r(JSON.parse(o.body)) : r;
    return { ok: !v.status, status: v.status || 200, json: async () => v.json };
  };
  f.vus = vus;
  return f;
}

test('Claude : requête d\'un bulletin (document PDF, format JSON strict, repli serveur), en-têtes, aperçu', () => {
  const b = json(CL.corps('bulletin', { pdf: PDF, nom: 'bulletin.pdf' }, 'claude-opus-5-5'));
  assert.equal(b.model, 'claude-opus-5-5');
  assert.deepEqual(b.messages[0].content[0], { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: PDF } });
  assert.equal(b.messages[0].content[1].type, 'text');
  assert.equal(b.output_config.format.type, 'json_schema');
  assert.equal(b.output_config.format.schema.additionalProperties, false);
  assert.deepEqual(b.output_config.format.schema.required.slice(0, 2), ['employeur', 'mois_salaire']);
  assert.equal(b.fallbacks, 'default');
  assert.ok(!('thinking' in b) && !('temperature' in b));
  // le modèle le moins cher n'a pas de repli serveur ; un modèle inconnu revient au défaut
  assert.ok(!('fallbacks' in CL.corps('appel', { pdf: PDF }, 'claude-haiku-5-5')));
  assert.equal(CL.corps('appel', { pdf: PDF }, 'gpt').model, CL.DEFAUT);
  const h = json(CL.entetes(CLE, 'claude-opus-5-5'));
  assert.deepEqual([h['x-api-key'], h['anthropic-version'], h['anthropic-beta']], [CLE, '2026-10-21', 'server-side-fallback-2026-07-01']);
  assert.ok(!('anthropic-beta' in CL.entetes(CLE, 'claude-opus-5-5', true)));
  // aperçu : le document et la consigne, rien d'autre
  const a = CL.apercu('bulletin', { pdf: PDF, nom: 'bulletin.pdf' });
  assert.match(a, /le document « bulletin\.pdf » \(\d+ Ko, PDF\)/);
  assert.match(a, /Rien d'autre/);
  assert.throws(() => CL.corps('bulletin', {}), /Aucun document/);
});

test('Claude : estimation (comptage gratuit), demande, refus, erreurs, coût réel ; la clé ne part que dans l\'en-tête', async () => {
  const f = fauxFetch({
    '/messages/count_tokens': { json: { input_tokens: 2500 } },
    '/messages': { json: { model: 'claude-opus-5-5', stop_reason: 'end_turn', content: [{ type: 'text', text: '{"date_exigibilite":"2026-10-01","montant_total":450.5,"nature":"charges"}' }],
      usage: { input_tokens: 2600, output_tokens: 300 } } }
  });
  const e = await CL.estimer(f, CLE, 'appel', { pdf: PDF }, 'claude-opus-5-5');
  assert.deepEqual([e.entree, e.sortie], [2500, 800]);
  assert.ok(Math.abs(e.dollars - (2500 * 4 + 800 * 20) / 1e6) < 1e-9);
  assert.match(e.texte, /environ 0,03 \$ \(crédits API\)/);
  const r = await CL.demander(f, CLE, 'appel', { pdf: PDF }, 'claude-opus-5-5');
  assert.deepEqual(json(r.resultat), { date_exigibilite: '2026-10-01', montant_total: 450.5, nature: 'charges' });
  assert.ok(Math.abs(r.dollars - (2600 * 4 + 300 * 20) / 1e6) < 1e-9);
  assert.equal(f.vus.length, 2);
  for (const v of f.vus) assert.ok(!JSON.stringify(v.body).includes(CLE));
  assert.ok(!('max_tokens' in f.vus[0].body));               // comptage : modèle, système, messages
  // refus, réponse illisible, clé refusée, crédits épuisés
  assert.throws(() => CL.lire('appel', { stop_reason: 'refusal', content: [] }), /refusé/);
  assert.throws(() => CL.lire('appel', { stop_reason: 'end_turn', content: [{ type: 'text', text: 'pas du JSON' }] }), /illisible/);
  await assert.rejects(CL.demander(fauxFetch({ '/messages': { status: 401, json: {} } }), CLE, 'appel', { pdf: PDF }), /Clé Claude refusée/);
  await assert.rejects(CL.demander(fauxFetch({ '/messages': { status: 400, json: { error: { message: 'Your credit balance is too low' } } } }), CLE, 'appel', { pdf: PDF }), /Crédits API épuisés/);
  // analyse : texte libre, sans format JSON
  const an = CL.corps('analyse', { texte: 'Revenus : prévus 2 000 €.' });
  assert.ok(!an.output_config.format);
  assert.equal(an.output_config.effort, 'high');
  assert.match(an.messages[0].content[0].text, /Revenus : prévus 2 000 €\./);
});

test('Claude : conversions vers les formats de Klad (bulletin, avis avec inversion des déclarants, appel de fonds)', () => {
  const b = json(CL.versBulletin({ employeur: 'Société fictive', mois_salaire: '2026-09', date_paiement: '2026-09-30', brut: 3500, net_imposable: 2800.456,
    prelevement_source: -112, taux_pas: 4, type_taux: 'neutre' }, 's', Date.parse('2026-10-28T10:00:00Z')));
  assert.deepEqual(b, { p: 's', emp: 'Société fictive', m: '2026-09', pay: '2026-09-30', ni: 2800.46, pas: 112, taux: 4, type: 'neutre', brut: 3500, src: 'claude', mt: '2026-10-28T10:00:00.000Z' });
  assert.throws(() => CL.versBulletin({ mois_salaire: '', date_paiement: '' }, 'g', 0), /Mois du salaire/);
  const R = { annee_revenus: 2025, parts: 2, salaires_1: 30000, salaires_2: 20000, deduction_1: 3000, deduction_2: 2000, frais_reels_1: false, frais_reels_2: true,
    revenus_fonciers: 820, capitaux_mobiliers: 0, revenu_net_imposable: 45820, impot_bareme: 2580, decote: 316, impot_net: 2264, prelevements_sociaux: 142,
    preleve_source: 2400, reste_a_payer: 6, remboursement: 0, revenu_fiscal_reference: 45820, taux_marginal: 11, plafond_per_1: 3000, plafond_per_2: 2000 };
  const a = json(CL.versAvis(R, false));
  assert.deepEqual([a.rev, a.sal, a.ded, a.fr, a.irNet, a.pas, a.ps, a.solde, a.tmoy], [2025, { g: 30000, s: 20000 }, { g: 3000, s: 2000 }, { g: false, s: true }, 2264, 2400, 142, 6, 4.9]);
  assert.deepEqual(json(CL.versAvis(R, true)).sal, { g: 20000, s: 30000 });
  assert.equal(CL.versAvis(Object.assign({}, R, { reste_a_payer: 0, remboursement: 80 })).solde, -80);
  assert.deepEqual(json(CL.versAppel({ date_exigibilite: '2026-10-01', montant_total: 450.5, nature: 'avance' }, 'H', 'appel.pdf')),
    { cp: 'H', kind: 'avance', d: '2026-10-01', a: 450.5, name: 'appel.pdf', src: 'claude' });
});

// fausse boîte de réception : appels d'un syndic fictif, un message sans rapport
function boite() {
  return [
    { id: '<m1@exemple.test>', date: '2026-09-20', expediteur: 'gestion@syndic.exemple.test', sujet: 'Appel de provisions', texte: 'Lot parking 12. Appel exigible le 01/10/2026.',
      pieces: [{ nom: 'AP_CH_20261001.pdf', type: 'application/pdf', taille: 100, base64: PDF }] },
    { id: '<m2@exemple.test>', date: '2026-06-18', expediteur: 'gestion@syndic.exemple.test', sujet: 'Appel de provisions', texte: 'Logement 4. Avance de trésorerie.',
      pieces: [{ nom: 'AP_AV_20260701.pdf', type: 'application/pdf', taille: 100, base64: PDF }] },
    { id: '<m3@exemple.test>', date: '2026-08-02', expediteur: 'gestion@syndic.exemple.test', sujet: 'Assemblée générale', texte: 'Convocation sans date.', pieces: [] },
    { id: '', date: '2026-08-02', sujet: 'sans identifiant', texte: '', pieces: [] }
  ];
}

test('mails : réglages (complément puis Klad), tri des appels de fonds, montants lus dans les PDF, intégration annulable', () => {
  const S = M.vide();
  S.carnet = { klad: { mail: { expediteurs: ['syndic.exemple.test'], motsCles: ['appel de provisions'], piece: '^AP_(CH|AV)_(\\d{4})(\\d{2})(\\d{2})', codeAvance: 'AV',
    cp: { P: 'parking', H: 'logement' } } } };
  S.modele.extras = { mail: { on: true, hote: 'imap.exemple.test', adresse: 'moi@exemple.test', motsCles: 'appel, provisions' } };
  const R = ML.reglages(S);
  assert.deepEqual([R.hote, R.port, R.jours, json(R.expediteurs), json(R.motsCles)], ['imap.exemple.test', 993, 400, ['syndic.exemple.test'], ['appel', 'provisions']]);
  const textes = { 'AP_CH_20261001.pdf': 'Résidence fictive\nTotal appel copropriétaire 1 234,56\n', 'AP_AV_20260701.pdf': 'Montant total 300,00' };
  const res = json(ML.analyser(boite(), R, textes, ['H', 'P']));
  assert.deepEqual(res.mails['<m1@exemple.test>'], { mail: '2026-09-20', d: '2026-10-01', cp: 'P', kind: 'charges', fn: 'AP_CH_20261001.pdf' });
  assert.deepEqual(res.mails['<m2@exemple.test>'], { mail: '2026-06-18', d: '2026-07-01', cp: 'H', kind: 'avance', fn: 'AP_AV_20260701.pdf' });
  assert.deepEqual(res.mails['<m3@exemple.test>'].d, '2026-08-02');           // sans date d'exigibilité : date du mail
  assert.equal(Object.keys(res.mails).length, 3);                              // message sans identifiant ignoré
  assert.deepEqual(res.pdfs, [{ cp: 'P', kind: 'charges', d: '2026-10-01', a: 1234.56, name: 'AP_CH_20261001.pdf' }, { cp: 'H', kind: 'avance', d: '2026-07-01', a: 300, name: 'AP_AV_20260701.pdf' }]);
  // intégration : seulement les nouveaux, puis annulation
  S.budget = KB.nouveau();
  const i1 = ML.integrer(S, res);
  assert.deepEqual([i1.mails, i1.pdfs], [3, 2]);
  const i2 = ML.integrer(S, res);
  assert.deepEqual([i2.mails, i2.pdfs], [0, 0]);
  ML.annuler(S, i1.avant);
  assert.ok(!S.budget.appels);
  // sans motif de pièce : date d'exigibilité lue dans le texte, copropriété unique
  const r2 = json(ML.analyser(boite().slice(0, 1), ML.reglages(M.vide()), {}, ['H']));
  assert.deepEqual(r2.mails['<m1@exemple.test>'], { mail: '2026-09-20', d: '2026-10-01', cp: 'H', kind: 'charges', fn: 'AP_CH_20261001.pdf' });
  // état affiché
  S.modele.extras.mail.derniere = '2026-10-28T09:00:00Z';
  ML.integrer(S, res);
  assert.equal(ML.etat(S), 'mails lus le 28/10 · 3 appels reçus par mail');
});

test('extras désactivés par défaut ; actifs seulement avec leur secret ; journal sans clé ni adresse', () => {
  const S = M.vide();
  assert.equal(EX.actif(S, 'claude'), false);
  S.modele.extras = { claude: { on: true }, mail: { on: true, hote: 'imap.exemple.test', adresse: 'moi@exemple.test' } };
  assert.equal(EX.actif(S, 'claude'), false);
  S.cle.claude = CLE; S.cle.mailMdp = 'abcdabcdabcdabcd';
  assert.deepEqual([EX.actif(S, 'claude'), EX.actif(S, 'mail')], [true, true]);
  S.modele.extras.claude.on = false;
  assert.equal(EX.actif(S, 'claude'), false);
  assert.equal(AN.scrub('clé ' + CLE + ' et moi@exemple.test'), 'clé [clé] et [e-mail]');
});
