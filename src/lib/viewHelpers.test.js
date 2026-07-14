import test from 'node:test';
import assert from 'node:assert/strict';

import {
  contextLabel,
  firstSelectableCategory,
  getMonth,
  getYear,
  initials,
  sum,
  tenancyStateLabel,
} from './viewHelpers.js';

test('sum addiert nur Buchungen der angeforderten Art', () => {
  const transactions = [
    { kind: 'income', amount: 100 },
    { kind: 'expense', amount: 40 },
    { kind: 'income', amount: '25.50' },
  ];

  assert.equal(sum(transactions, 'income'), 125.5);
  assert.equal(sum(transactions, 'expense'), 40);
});

test('getYear und getMonth lesen ISO-Datumswerte wie bisher', () => {
  assert.equal(getYear('2026-07-13'), 2026);
  assert.equal(getMonth('2026-07-13'), 6);
});

test('contextLabel liefert bekannte Labels und reicht unbekannte Typen durch', () => {
  assert.equal(contextLabel('tenancy'), 'Mietverhältnis');
  assert.equal(contextLabel('custom'), 'custom');
});

test('initials erzeugt maximal zwei großgeschriebene Initialen', () => {
  assert.equal(initials('  anna maria meier '), 'AM');
  assert.equal(initials(), '');
});

test('tenancyStateLabel unterscheidet geplant, aktiv und beendet', () => {
  assert.equal(
    tenancyStateLabel({ startDate: '9999-01-01', status: 'planned' }),
    'Geplantes Mietverhältnis',
  );
  assert.equal(
    tenancyStateLabel({ startDate: '2000-01-01', endDate: '', status: 'active' }),
    'Aktives Mietverhältnis',
  );
  assert.equal(
    tenancyStateLabel({ startDate: '2000-01-01', endDate: '', status: 'ended' }),
    'Früheres Mietverhältnis',
  );
});

test('firstSelectableCategory bevorzugt eine Unterkategorie', () => {
  const categories = [
    { id: 'root', kind: 'expense', parentId: null },
    { id: 'child', kind: 'expense', parentId: 'root' },
    { id: 'income', kind: 'income', parentId: null },
  ];

  assert.equal(firstSelectableCategory(categories, 'expense').id, 'child');
  assert.equal(firstSelectableCategory(categories, 'income').id, 'income');
  assert.equal(firstSelectableCategory(categories, 'unknown'), undefined);
});
