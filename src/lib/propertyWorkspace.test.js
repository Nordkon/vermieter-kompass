import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizePropertySessionState,
  propertyContextToFinanceFilters,
  topPropertyContextMovements,
} from './propertyWorkspace.js';

const transactions = [
  { id: 'z', propertyId: 'p1', unitId: 'u1', tenancyId: 't1', date: '2026-08-02' },
  { id: 'a', propertyId: 'p1', unitId: null, date: '2026-08-02', allocations: [{ unitId: 'u1', tenancyId: 't1' }] },
  { id: 'b', propertyId: 'p1', unitId: 'u1', tenancyId: 't1', date: '2026-08-03' },
  { id: 'c', propertyId: 'p1', unitId: 'u1', tenancyId: 't1', date: '2026-08-01' },
  { id: 'd', propertyId: 'p1', unitId: 'u1', tenancyId: 't1', date: '2026-07-31' },
  { id: 'e', propertyId: 'p1', unitId: 'u1', tenancyId: 't1', date: '2026-07-30' },
  { id: 'foreign', propertyId: 'p2', unitId: 'u2', tenancyId: 't2', date: '2027-01-01' },
];

test('Top-5-Kontextbewegungen sind absteigend und bei gleichem Datum deterministisch', () => {
  const originalOrder = transactions.map((transaction) => transaction.id);
  assert.deepEqual(
    topPropertyContextMovements(transactions, { type: 'property', id: 'p1' }).map((row) => row.id),
    ['b', 'a', 'z', 'c', 'd'],
  );
  assert.deepEqual(transactions.map((transaction) => transaction.id), originalOrder);
});

test('Einheit, Mietverhältnis und Kontakt berücksichtigen Zuordnungsschnappschüsse', () => {
  assert.equal(topPropertyContextMovements(transactions, { type: 'unit', id: 'u1' }).length, 5);
  assert.equal(topPropertyContextMovements(transactions, { type: 'tenancy', id: 't1' }).length, 5);
  assert.equal(topPropertyContextMovements(transactions, { type: 'contact', id: 'c1', tenancyId: 't1' }).length, 5);
  assert.deepEqual(topPropertyContextMovements(transactions, { type: 'unit', id: 'missing' }), []);
});

test('Limit bleibt fachlich auf höchstens fünf Bewegungen begrenzt', () => {
  assert.equal(topPropertyContextMovements(transactions, { type: 'property', id: 'p1' }, 2).length, 2);
  assert.equal(topPropertyContextMovements(transactions, { type: 'property', id: 'p1' }, 99).length, 5);
});

test('Objekt- und Einheitenkontext werden direkt auf Finanzfilter abgebildet', () => {
  const data = { propertyId: 'p1', units: [{ id: 'u1', propertyId: 'p1' }] };
  assert.deepEqual(propertyContextToFinanceFilters({ type: 'property', id: 'p1' }, data), {
    propertyFilter: 'p1', unitFilter: 'all', tenancyFilter: 'all',
  });
  assert.deepEqual(propertyContextToFinanceFilters({ type: 'unit', id: 'u1' }, data), {
    propertyFilter: 'p1', unitFilter: 'u1', tenancyFilter: 'all',
  });
});

test('Mietverhältnis und Kontakt fokussieren den Vertrag über alle zugeordneten Einheiten', () => {
  const data = {
    units: [{ id: 'u1', propertyId: 'p1' }, { id: 'g1', propertyId: 'p1' }],
    tenancies: [{ id: 't1', unitId: 'u1' }],
    tenancyUnits: [
      { tenancyId: 't1', unitId: 'g1', sortOrder: 1 },
      { tenancyId: 't1', unitId: 'u1', sortOrder: 0 },
    ],
  };
  assert.deepEqual(propertyContextToFinanceFilters({ type: 'tenancy', id: 't1' }, data), {
    propertyFilter: 'p1', unitFilter: 'all', tenancyFilter: 't1',
  });
  assert.deepEqual(propertyContextToFinanceFilters({ type: 'contact', id: 'c1', tenancyId: 't1' }, data), {
    propertyFilter: 'p1', unitFilter: 'all', tenancyFilter: 't1',
  });
});

test('Objektarbeitszustand bleibt sitzungsbezogen erhalten und wird gegen gelöschte Referenzen bereinigt', () => {
  const data = {
    propertyId: 'p1',
    years: [2027, 2026],
    units: [{ id: 'u1' }, { id: 'u2' }],
    tenancies: [{ id: 't1' }],
    categories: [{ id: 'c1' }],
    fallbackYear: 2026,
  };
  const restored = normalizePropertySessionState({
    activePropertyTab: 'finances',
    selectedYear: 2026,
    kindFilter: 'expense',
    categoryFilter: 'c1',
    unitFilter: 'u2',
    tenancyFilter: 't1',
    allocationFilter: 'allocatable',
    transactionSearch: 'Wasser',
    selectedContext: { type: 'unit', id: 'u1' },
    treeOpen: false,
    expandedUnitIds: [],
  }, data);
  assert.deepEqual(restored, {
    activePropertyTab: 'finances',
    selectedYear: 2026,
    kindFilter: 'expense',
    categoryFilter: 'c1',
    unitFilter: 'u2',
    tenancyFilter: 't1',
    allocationFilter: 'allocatable',
    transactionSearch: 'Wasser',
    selectedContext: { type: 'unit', id: 'u1' },
    treeOpen: false,
    expandedUnitIds: [],
  });

  const sanitized = normalizePropertySessionState({
    activePropertyTab: 'missing',
    selectedYear: 1999,
    categoryFilter: 'missing',
    unitFilter: 'missing',
    tenancyFilter: 'missing',
    selectedContext: { type: 'unit', id: 'missing' },
    expandedUnitIds: ['u1', 'missing'],
  }, data);
  assert.equal(sanitized.activePropertyTab, 'overview');
  assert.equal(sanitized.selectedYear, 2027);
  assert.equal(sanitized.categoryFilter, 'all');
  assert.equal(sanitized.unitFilter, 'all');
  assert.equal(sanitized.tenancyFilter, 'all');
  assert.deepEqual(sanitized.selectedContext, { type: 'property', id: 'p1' });
  assert.deepEqual(sanitized.expandedUnitIds, ['u1']);
});
