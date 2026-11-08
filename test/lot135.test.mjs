// Tests du correctif 1.3.5 (analyse de l'architecte du 08/11) : reste à vivre « comptes courants » sans la somme due sur
// la carte à débit différé ; projection de fin de période avec les charges fixes réelles ; opération en cours que la
// banque ne renvoie plus : plus comptée ; deux opérations identiques déjà connues jamais fusionnées ; relecture large
// (30 jours) une fois par semaine ; une seule ligne « à vérifier » sur l'Accueil ; recherche par montant ;
// observation « Opérations à classer » sur 3 mois ; enregistrement du coffre après un échec. Données FICTIVES.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { charge, json, read } from './charge.mjs';
import { outils, etatDepuisReprise } from './jeux.mjs';
import { repriseFictive } from './fictif.mjs';

const X = outils(['ui.js', 'vues.js', 'vbudget.js', 'vaccueil.js']);
const { KladModele: M, KladClasse: K, KladBudget: KB, KladObservations: KO, KladVues: Vu, KladVuesBudget: VB } = X;
const FIN = '2026-10-28', NOW = Date.parse(FIN + 'T10:00:00Z');
const ctx = S => KB.contexte(S, NOW, K.contexte(S, NOW));
const etat = () => etatDepuisReprise(X, repriseFictive(FIN), NOW);
const compte = (S, role) => S.modele.comptes.find(c => c.role === role);
const op = (c, id, date, montant, libelle, cat) => ({ id: c.id + ':m:t' + id, compte: c.id, date, montant, libelle, statut: 'comptabilisee', source: 'manuel', vue: true, categorie: cat || null });
const texte = h => String(h).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

test('reste à vivre « comptes courants » : la somme due sur la carte est retirée ; un achat à la carte ne le fait plus monter', async () => {
  const S = await etat();
  const av = KB.suivi(ctx(S), 'perso', null).rav.comptes;
  assert.equal(av.cartes, 0);
  const k = compte(S, 'carte_differee');
  S.ops[k.id].unshift(op(k, 1, FIN, -3000, 'CARTE 28/10 SUPERMARCHE FICTIF', { cat: 'Alimentation', sub: 'Courses' }));
  const ap = KB.suivi(ctx(S), 'perso', null).rav.comptes;
  assert.equal(ap.cartes, 3000, 'somme due sur la carte');
  assert.equal(ap.variable, av.variable - 3000, 'achat compté dans le variable');
  assert.equal(ap.reste, av.reste, 'dans le budget : reste à vivre inchangé (avant la 1.3.5 : +30 €)');
  assert.equal(ap.marge, ap.base - ap.cartes - ap.fixes);
  // détail : ligne « Carte à débit différé » dans la seule colonne des comptes
  const h = texte(VB.detailRav(KB.suivi(ctx(S), 'perso', null).rav, 'comptes'));
  assert.match(h, /− Carte à débit différé .*— 30,00 €/);
  // carte prélevée sur un autre compte qu'un compte courant (commun) : rien n'est retiré des comptes courants
  k.prelevement = Object.assign({}, k.prelevement, { compte: compte(S, 'commun').id });
  assert.equal(KB.suivi(ctx(S), 'perso', null).rav.comptes.cartes, 0);
});

test('projection de fin de période : une charge fixe au-delà de son budget est comptée (avant : budget seul)', async () => {
  const S = await etat();
  const p0 = KB.suivi(ctx(S), 'perso', null);
  const c = compte(S, 'courant');
  S.ops[c.id].unshift(op(c, 2, FIN, -10000, 'PRLV TELEPHONE FICTIF REGUL', { cat: 'Abonnements & télécom', sub: 'Téléphone' }));
  const p1 = KB.suivi(ctx(S), 'perso', null);
  const l = p1.sections.fixe.lignes.find(a => a.key === 'f|Téléphone');
  assert.equal(l.cur, 10000);
  assert.equal(Math.round(p0.solde.pj - p1.solde.pj), 10000 - l.pm, 'dépassement de la charge fixe dans la projection');
  assert.equal(Math.round(p1.T.fixe.proj), Math.round(p1.sections.fixe.lignes.reduce((t, a) => t + Math.max(a.pm, a.cur), 0)));
});

// faux client Enable Banking (comme test/sync.test.mjs)
const Y = charge(['anon.js', 'eb.js', 'modele.js', 'sync.js']);
const tx = (date, montant, label, o = {}) => Object.assign({ booking_date: date, transaction_amount: { amount: String(Math.abs(montant) / 100) },
  credit_debit_indicator: montant < 0 ? 'DBIT' : 'CRDT', remittance_information: [label], status: 'BOOK' }, o);
function faux(donnees) {
  const appels = [];
  return {
    appels,
    async balances() { return [{ balance_type: 'CLBD', balance_amount: { amount: '1000.00' } }]; },
    async transactions(uid, o) { appels.push({ uid, from: o.dateFrom || null }); return (donnees[uid] || []).filter(t => !o.dateFrom || t.booking_date >= o.dateFrom); }
  };
}
function etatSync() {
  const S = Y.KladModele.vide();
  S.modele.alias = {};
  S.modele.connexions.s1 = { banque: 'Banque Fictive', pays: 'FR', valid_until: '2027-01-01T00:00:00Z', psu: null };
  const a = Y.KladModele.nouveauCompte(S, { libelle: 'A', source: { type: 'eb', connexion: 's1', uid: 'u1' } });
  return { S, a };
}

test('synchro : relecture des 30 derniers jours une fois par semaine (opération comptabilisée en retard avec une date ancienne)', async () => {
  const { S, a } = etatSync();
  const D = { u1: [tx('2026-10-20', -1250, 'CB BOULANGERIE'), tx('2026-10-25', 250000, 'SALAIRE FICTIF')] };
  const cl = faux(D), log = [];
  await Y.KladSync.synchroniser(S, { client: () => cl, log: (k, m) => log.push(m), now: () => NOW });
  assert.equal(cl.appels[0].from, null, 'première lecture : tout l\'historique');
  assert.equal(a.sync.large, FIN, 'compte comme une relecture large');
  // le lendemain : lecture courte (dernière comptabilisée − 5 jours)
  await Y.KladSync.synchroniser(S, { client: () => cl, log: () => {}, now: () => NOW + 864e5 });
  assert.equal(cl.appels[1].from, '2026-10-20');
  // une opération du 10/10 arrive en retard (date ancienne) : la lecture courte ne la voit pas…
  D.u1.push(tx('2026-10-10', -4200, 'CB ETRANGER FICTIF'));
  await Y.KladSync.synchroniser(S, { client: () => cl, log: () => {}, now: () => NOW + 3 * 864e5 });
  assert.equal(S.ops[a.id].length, 2);
  // … la relecture large, 7 jours après la précédente, la retrouve ; sa date est notée
  await Y.KladSync.synchroniser(S, { client: () => cl, log: (k, m) => log.push(m), now: () => NOW + 7 * 864e5 });
  assert.equal(cl.appels[3].from, '2026-10-05');
  assert.equal(S.ops[a.id].length, 3);
  assert.equal(a.sync.large, '2026-11-04');
  assert.match(log.join('\n'), /relecture des 30 derniers jours/);
  assert.doesNotMatch(log.join('\n'), /BOULANGERIE|ETRANGER|1250|4200/);
});

test('synchro : deux opérations identiques déjà connues (même jour, même libellé) ne sont jamais fusionnées ; une relecture avec référence l\'est', () => {
  const MM = Y.KladModele;
  const { S, a } = etatSync();
  const deux = [tx('2026-10-20', -1700, 'CB CAFE FICTIF'), tx('2026-10-20', -1700, 'CB CAFE FICTIF')];
  MM.integrer(S, a.id, deux.concat([tx('2026-10-27', -500, 'CB AUTRE')]), NOW, { depuis: '2026-10-15' });
  assert.equal(S.ops[a.id].length, 3);
  // la banque n'en renvoie plus qu'une : l'autre est gardée (à vérifier), pas fusionnée
  const st = MM.integrer(S, a.id, [deux[0], tx('2026-10-27', -500, 'CB AUTRE')], NOW + 864e5, { depuis: '2026-10-15' });
  assert.equal(st.fusionnees, 0);
  assert.equal(S.ops[a.id].length, 3);
  // relecture à une autre date avec une référence ajoutée (cas de la 1.1.2) : toujours fusionnée
  const { S: S2, a: a2 } = etatSync();
  MM.integrer(S2, a2.id, [tx('2026-10-20', -97500, 'VIR PERMANENT FICTIF')], NOW, { depuis: '2026-10-15' });
  const st2 = MM.integrer(S2, a2.id, [tx('2026-10-21', -97500, 'VIR PERMANENT FICTIF 2630000123456')], NOW + 864e5, { depuis: '2026-10-15' });
  assert.equal(st2.fusionnees, 1);
  assert.equal(S2.ops[a2.id].length, 1);
});

test('opération en cours que la banque ne renvoie plus : ni budget, ni dette de carte ; montrée « plus renvoyée »', async () => {
  const S = await etat();
  const k = compte(S, 'carte_differee');
  const B0 = ctx(S), d0 = K.dette(S, k, NOW).centimes;
  const pre = { id: k.id + ':p:pre', compte: k.id, date: FIN, montant: -12000, libelle: 'CARTE 28/10 STATION FICTIVE', statut: 'en_cours', source: 'eb', vue: true, categorie: { cat: 'Carburant', sub: 'Carburant' } };
  S.ops[k.id].unshift(pre);
  assert.equal(K.dette(S, k, NOW).centimes, d0 + 12000, 'en cours renvoyée : comptée');
  assert.ok(ctx(S).rows.some(r => r.id === pre.id));
  pre.absente = FIN;
  assert.equal(K.dette(S, k, NOW).centimes, d0, 'plus renvoyée : plus comptée');
  assert.ok(!ctx(S).rows.some(r => r.id === pre.id));
  assert.equal(KB.suivi(ctx(S), 'perso', null).rav.comptes.reste, KB.suivi(B0, 'perso', null).rav.comptes.reste);
  // liste et détail : toujours visible, signalée
  const cx = K.contexte(S, NOW);
  assert.match(Vu.ligne(S, pre, { ctx: cx }), /class="txr encours absente"[\s\S]*en cours · plus renvoyée/);
  assert.match(texte(Vu.detail(S, pre, cx)), /Plus renvoyée par la banque depuis le 28\/10\/2026 : elle ne compte plus/);
});

test('Accueil : une seule ligne « à vérifier », même nombre que la pastille « Tout » ; observation « à classer » sur 3 mois', async () => {
  const S = await etat();
  const cx = K.contexte(S, NOW), a = K.attention(cx, NOW);
  const L = Vu.lignesAVerifier(S, NOW, { attention: a, ctx: cx });
  const l = L.find(x => x.cle === 'averifier');
  assert.ok(l, 'ligne unique');
  assert.ok(!L.some(x => ['nonvues', 'nonclassees', 'rapprocher'].includes(x.cle)));
  assert.equal(+l.texte.split(' ')[0], Vu.compteursAVerifier(S, cx).tout);
  assert.match(l.texte, /^\d+ opérations à vérifier$/);
  assert.match(l.sous, /non vues · \d+ non classées/);
  const O = KO.observations(ctx(S), 'perso');
  const o = O.faire.concat(O.infos || [], O.masques || []).find(x => x.titre === 'Opérations à classer') || KO.audit(ctx(S)).find(x => x.titre === 'Opérations à classer');
  assert.ok(o);
  assert.match(o.texte, new RegExp('^' + a.unclassified + ' opération\\(s\\) des 3 derniers mois'));
  // appui : la liste « à vérifier » de tous les comptes
  assert.match(read('www/app.js'), /k === 'averifier'\) versOps\(\{ cat: '__av', perimetre: 'tout' \}\)/);
});

test('recherche par montant : « 34,65 », « 34.65 », « 34,65 € » ; un nombre entier reste une recherche de libellé', () => {
  assert.deepEqual([Vu.montantCherche('34,65'), Vu.montantCherche('34.65'), Vu.montantCherche('34,65 €'), Vu.montantCherche('1 234,56'), Vu.montantCherche('12 €')],
    [3465, 3465, 3465, 123456, 1200]);
  assert.deepEqual([Vu.montantCherche('2025'), Vu.montantCherche('CAFE'), Vu.montantCherche('1.234,56')], [null, null, null]);
  const S = M.vide();
  const c = M.nouveauCompte(S, { libelle: 'COURANT', role: 'courant' });
  S.ops[c.id] = [op(c, 1, '2026-11-04', -3465, 'PRLV ASSUREUR FICTIF'), op(c, 2, '2026-11-03', 3465, 'VIR REMBOURSEMENT'), op(c, 3, '2026-11-02', -3466, 'AUTRE 2025'),
    op(c, 4, '2026-11-01', -100, 'REF 2025')];
  const ids = q => json(Vu.filtrer(S, { q }).map(o => o.id.split(':t')[1]));
  assert.deepEqual(ids('34,65'), ['1', '2'], 'débit et crédit');
  assert.deepEqual(ids('34.66'), ['3']);
  assert.deepEqual(ids('2025'), ['3', '4'], 'année : dans le libellé');
});

test('enregistrement du coffre : après un échec, tous les blocs non écrits restent à écrire ; écriture à la mise en arrière-plan ; date du téléphone', () => {
  const v = read('www/verrou.js');
  assert.match(v, /for \(const \[m, jm\] of ecrire\.slice\(i\)\) if \(ecrits\[m\] === jm\) \{ delete ecrits\[m\]; dirty\.add/);
  assert.match(v, /if \(!isActive\) \{[\s\S]{0,300}if \(key && dirty\.size\) \{ try \{ flush\(\); \}/);
  assert.match(v, /'klad-sauvegarde-' \+ KladModele\.jourLocal\(Date\.now\(\)\)/);
});
