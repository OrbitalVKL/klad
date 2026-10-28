// Tests : montants en centimes (aucune erreur d'arrondi, aucun signe affiché), saisie, dates. Données fictives.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { charge } from './charge.mjs';

const { KladFormat: F, KladModele: M } = charge(['anon.js', 'eb.js', 'format.js', 'modele.js']);
const nb = s => s.replace(/[\u00a0\u202f]/g, ' ');

test('centimes : conversion exacte des montants de la banque, sans virgule flottante', () => {
  const cas = { '12.5': 1250, '-12.50': -1250, '0.1': 10, '0.2': 20, '0.30': 30, '1234': 123400, '.5': 50, '+7.07': 707,
    '1.005': 101, '1.004': 100, '-0.00': 0, '90071992547409.91': 9007199254740991, '0': 0 };
  for (const [s, c] of Object.entries(cas)) assert.equal(M.centimes(s), c, s);
  for (const s of ['90071992547409.92', '', 'abc', '1,5', '1.2.3', '-', '.', null, undefined, '1e3']) assert.equal(M.centimes(s), null, String(s));
  // 0,1 + 0,2 : en centimes, aucune dérive.
  assert.equal(M.centimes('0.1') + M.centimes('0.2'), M.centimes('0.3'));
  let t = 0; for (let i = 0; i < 1000; i++) t += M.centimes('0.01');
  assert.equal(t, 1000);
});

test('affichage : valeur absolue, jamais de signe, « débiteur » pour un solde négatif', () => {
  assert.equal(nb(F.montant(-123456)), '1 234,56 €');
  assert.equal(nb(F.montant(123456)), '1 234,56 €');
  assert.equal(nb(F.montant(5)), '0,05 €');
  assert.equal(nb(F.solde(-1999)), '19,99 € débiteur');
  assert.equal(nb(F.solde(1999)), '19,99 €');
  assert.equal(nb(F.montant(-100, 'USD')), '1,00 $US');
  // tous les centimes de -1000,00 à 1000,00 : deux décimales exactes, aucun signe moins
  for (let c = -100000; c <= 100000; c += 7) {
    const s = nb(F.montant(c));
    const a = Math.abs(c);
    assert.ok(s.endsWith(',' + String(a % 100).padStart(2, '0') + ' €'), s);
    assert.doesNotMatch(s, /[-\u2212\u2012\u2013]/);
  }
});

test('saisie : montants positifs uniquement', () => {
  assert.equal(F.saisie('1 234,56'), 123456);
  assert.equal(F.saisie('12.5 €'), 1250);
  assert.equal(F.saisie('7'), 700);
  assert.equal(F.saisie(',5'), 50);
  for (const s of ['-12', '12,345', 'abc', '', '1 2,3,4']) assert.equal(F.saisie(s), null, s);
  assert.equal(F.versSaisie(-123456), '1234,56');
});

test('dates', () => {
  assert.equal(F.date('2023-01-03'), '03/01/2023');
  assert.equal(F.jour('2023-01-03'), 'mardi 3 janvier 2023');
  assert.equal(F.jour('2026-08-15', 2026), 'samedi 15 août');
  const now = Date.parse('2026-10-28T12:00:00Z');
  assert.equal(F.ilYa(now - 30e3, now), 'à l\'instant');
  assert.equal(F.ilYa(now - 5 * 60e3, now), 'il y a 5 min');
  assert.equal(F.ilYa(new Date(now - 3 * 3600e3).toISOString(), now), 'il y a 3 h');
  assert.equal(F.ilYa(now - 2 * 864e5, now), 'il y a 2 j');
  assert.equal(F.ilYa(null, now), 'jamais');
  assert.equal(M.plusJours('2024-03-01', -1), '2024-02-29');
  assert.equal(M.dateValide('2023-02-29'), false);
  assert.equal(M.dateValide('2024-02-29'), true);
});
