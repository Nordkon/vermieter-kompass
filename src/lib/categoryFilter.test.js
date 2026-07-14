import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCategoryFilterRows,
  categoryMatchesFilter,
  categoryPathNames,
} from './categoryFilter.js';

const categories = [
  { id: 'rent', name: 'Miete', kind: 'income', parentId: null },
  { id: 'rent-cold', name: 'Kaltmiete', kind: 'income', parentId: 'rent' },
  { id: 'rent-cold-residential', name: 'Kaltmiete Wohnen', kind: 'income', parentId: 'rent-cold' },
  { id: 'utilities', name: 'Betriebskosten', kind: 'expense', parentId: null },
];

test('Alle Kategorien lässt jede Buchung passieren', () => {
  assert.equal(categoryMatchesFilter('rent-cold', 'all', categories), true);
  assert.equal(categoryMatchesFilter('utilities', '', categories), true);
});

test('Hauptkategorie trifft direkte Buchungen und alle Nachfahren', () => {
  assert.equal(categoryMatchesFilter('rent', 'rent', categories), true);
  assert.equal(categoryMatchesFilter('rent-cold', 'rent', categories), true);
  assert.equal(categoryMatchesFilter('rent-cold-residential', 'rent', categories), true);
});

test('Unterkategorie grenzt Geschwister und andere Zweige aus', () => {
  assert.equal(categoryMatchesFilter('rent-cold-residential', 'rent-cold', categories), true);
  assert.equal(categoryMatchesFilter('rent', 'rent-cold', categories), false);
  assert.equal(categoryMatchesFilter('utilities', 'rent', categories), false);
});

test('Fehlende IDs und zyklische Altdaten führen nicht zu Endlosschleifen', () => {
  const cyclic = [
    { id: 'left', parentId: 'right' },
    { id: 'right', parentId: 'left' },
  ];
  assert.equal(categoryMatchesFilter('', 'left', cyclic), false);
  assert.equal(categoryMatchesFilter('left', 'missing', cyclic), false);
});

test('Kategoriepfad läuft bei tiefer Hierarchie von der Wurzel zum Blatt', () => {
  assert.deepEqual(categoryPathNames('rent-cold-residential', categories), [
    'Miete',
    'Kaltmiete',
    'Kaltmiete Wohnen',
  ]);
  assert.deepEqual(categoryPathNames('missing', categories), []);
});

test('Kategoriepfad bleibt bei Zyklen endlich und enthält jede bekannte Kategorie einmal', () => {
  const cyclic = [
    { id: 'left', name: 'Links', parentId: 'right' },
    { id: 'right', name: 'Rechts', parentId: 'left' },
  ];
  assert.deepEqual(categoryPathNames('left', cyclic), ['Rechts', 'Links']);
});

test('Filterzeilen zeigen normale, verwaiste und zyklische Kategorien ohne Duplikate', () => {
  const rows = buildCategoryFilterRows([
    { id: 'root', name: 'Miete', kind: 'income', parentId: null },
    { id: 'child', name: 'Kaltmiete', kind: 'income', parentId: 'root' },
    { id: 'orphan', name: 'Verwaist', kind: 'income', parentId: 'missing' },
    { id: 'cycle-left', name: 'Zyklus A', kind: 'income', parentId: 'cycle-right' },
    { id: 'cycle-right', name: 'Zyklus B', kind: 'income', parentId: 'cycle-left' },
    { id: 'root', name: 'Doppelt', kind: 'income', parentId: null },
    { id: 'expense', name: 'Ausgabe', kind: 'expense', parentId: null },
  ], 'income');

  assert.deepEqual(rows, [
    { id: 'root', name: 'Miete', depth: 0 },
    { id: 'child', name: 'Kaltmiete', depth: 1 },
    { id: 'orphan', name: 'Verwaist', depth: 0 },
    { id: 'cycle-left', name: 'Zyklus A', depth: 0 },
    { id: 'cycle-right', name: 'Zyklus B', depth: 1 },
  ]);
});
