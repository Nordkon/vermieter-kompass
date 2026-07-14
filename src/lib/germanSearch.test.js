import test from 'node:test';
import assert from 'node:assert/strict';

import { matchesGermanSearch, normalizeGermanSearch } from './germanSearch.js';

test('deutsche Suche normalisiert Großschreibung, Umlaute, Akzente und Leerzeichen', () => {
  assert.equal(normalizeGermanSearch('  ÄRGER\t in der  Straße – Café  '), 'arger in der strasse cafe');
});

test('Miet und Miete finden Mietzahlung sowie Kaltmiete', () => {
  assert.equal(matchesGermanSearch('miet', 'August Mietzahlung'), true);
  assert.equal(matchesGermanSearch('Miete', 'August Mietzahlung'), true);
  assert.equal(matchesGermanSearch('miete', 'Kaltmiete'), true);
  assert.equal(matchesGermanSearch('kaltmiete', 'Kaltmiete Wohnen'), true);
  assert.equal(matchesGermanSearch('miete', 'Gebäudeversicherung'), false);
});

test('Kategorienamen und Kategoriehierarchie gehören zum gemeinsamen Suchraum', () => {
  const fields = [
    'Zahlung August 2026',
    ['Einnahmen', ['Mieteinnahmen', 'Kaltmiete']],
  ];

  assert.equal(matchesGermanSearch('miete', fields), true);
  assert.equal(matchesGermanSearch('einnahmen kaltmiete', fields), true);
  assert.equal(matchesGermanSearch('versicherung', fields), false);
});

test('Mehrwortsuche ignoriert zusätzliche Leerzeichen und Großschreibung', () => {
  assert.equal(matchesGermanSearch('  AUGUST   miete ', ['Mietzahlung', 'August 2026']), true);
  assert.equal(matchesGermanSearch('august juli', ['Mietzahlung', 'August 2026']), false);
});

test('leere Suche zeigt alle Datensätze, leere Felder liefern sonst keinen Treffer', () => {
  assert.equal(matchesGermanSearch('   ', null), true);
  assert.equal(matchesGermanSearch('miete', [null, '']), false);
});
