import test from 'node:test';
import assert from 'node:assert/strict';

import {
  accountBalance,
  calculateServicePeriodAllocations,
  firstDueDateOnOrAfter,
  normalizeRecurringRuleForTenancy,
  findTenancyOverlaps,
  materializeRecurringEntries,
  migrateV2ToV3,
  tenancyIntervalsOverlap,
  validateV3State,
} from './schemaV3.js';

const migratedAt = '2026-07-13T12:00:00.000Z';

function v2Fixture() {
  return {
    schemaVersion: 2,
    properties: [{ id: 'p1', name: 'Haus', objectType: 'Einfamilienhaus', customFlag: 'bleibt' }],
    units: [{ id: 'u1', propertyId: 'p1', name: 'Gesamtobjekt', usageType: 'Wohnen', area: 100 }],
    contacts: [{
      id: 'c1', kind: 'person', name: 'Max Beispiel', email: 'max@example.de', custom: 42,
      address: { street: 'Hauptstraße 1', houseNumber: '1a', geoHint: 'Hof' },
      communication: { email: 'max@example.de', preferredChannel: 'email' },
    }],
    tenancies: [{
      id: 't1',
      unitId: 'u1',
      contactIds: ['c1'],
      primaryContactId: 'c1',
      startDate: '2020-01-01',
      endDate: '',
      coldRent: 900,
      utilityAdvance: 200,
      deposit: 2700,
      status: 'active',
    }],
    transactions: [{
      id: 'tx1',
      propertyId: 'p1',
      date: '2026-01-02',
      kind: 'expense',
      amount: 1200,
      allocations: [{ unitId: 'u1', tenancyId: 't1', amount: 1200, snapshot: 'bleibt' }],
    }],
    categories: [{ id: 'cat-own', name: 'Eigene Kategorie' }],
    documents: [{ id: 'd1', ownerType: 'transaction', ownerId: 'tx1', dataUrl: 'data:test' }],
  };
}

test('Migration ist rein, deterministisch, idempotent und bewahrt unbekannte Felder', () => {
  const source = v2Fixture();
  const before = structuredClone(source);
  const first = migrateV2ToV3(source, migratedAt);
  const second = migrateV2ToV3(first, migratedAt);

  assert.deepEqual(source, before);
  assert.deepEqual(second, first);
  assert.equal(first.schemaVersion, 3);
  assert.equal(first.properties[0].customFlag, 'bleibt');
  assert.equal(first.contacts[0].custom, 42);
  assert.equal(first.contacts[0].address.houseNumber, '1a');
  assert.equal(first.contacts[0].address.geoHint, 'Hof');
  assert.equal(first.contacts[0].communication.preferredChannel, 'email');
  assert.equal(validateV3State(first), true);
});

test('Kontakte, Parteien und Einheiten werden verlustfrei getrennt', () => {
  const migrated = migrateV2ToV3(v2Fixture(), migratedAt);
  assert.equal(migrated.contacts[0].firstName, 'Max');
  assert.equal(migrated.contacts[0].lastName, 'Beispiel');
  assert.equal(migrated.contacts[0].legacyDisplayName, 'Max Beispiel');
  assert.equal(migrated.tenancyParties.length, 1);
  assert.deepEqual(migrated.tenancyParties[0], {
    id: 'tenancy-party-t1-0', tenancyId: 't1', contactId: 'c1', relationshipType: 'tenant', isPrimaryContact: true, sortOrder: 0,
  });
  assert.equal(migrated.tenancyUnits[0].unitId, 'u1');
  assert.equal(migrated.properties[0].buildingType, 'singleFamily');
  assert.equal(migrated.units[0].unitKind, 'primary');
});

test('Migration erzeugt keine Altschulden und Regeln starten im Folgemonat', () => {
  const migrated = migrateV2ToV3(v2Fixture(), migratedAt);
  assert.deepEqual(migrated.accountEntries, []);
  assert.equal(accountBalance(migrated.accountEntries, 't1'), 0);
  assert.equal(migrated.recurringRules.length, 2);
  assert.ok(migrated.recurringRules.every((rule) => rule.startDate === '2026-08-03'));
  assert.deepEqual(migrated.recurringRules.map((rule) => rule.component), ['coldRent', 'utilityAdvance']);
});

test('Historische Verteilung bleibt wertgleich und Altbuchungen erhalten keinen erfundenen Leistungszeitraum', () => {
  const source = v2Fixture();
  const allocations = structuredClone(source.transactions[0].allocations);
  const migrated = migrateV2ToV3(source, migratedAt);
  assert.deepEqual(migrated.transactions[0].allocations, allocations);
  assert.equal(migrated.transactions[0].servicePeriodStart, null);
  assert.equal(migrated.transactions[0].servicePeriodEnd, null);
  assert.equal(migrated.documents[0].dataUrl, 'data:test');
});

test('Fehlende Referenzen werden deterministisch als prüfbare Platzhalter erhalten', () => {
  const source = v2Fixture();
  source.contacts = [];
  source.units = [];
  const migrated = migrateV2ToV3(source, migratedAt);
  assert.equal(migrated.contacts[0].migrationPlaceholder, true);
  assert.equal(migrated.units[0].migrationPlaceholder, true);
  assert.equal(migrated.tenancyParties[0].contactId, migrated.contacts[0].id);
  assert.equal(migrated.tenancyUnits[0].unitId, migrated.units[0].id);
});

test('Intervallprüfung erkennt auch zukünftige und offene Überschneidungen', () => {
  assert.equal(tenancyIntervalsOverlap(
    { contractStart: '2026-01-01', contractEnd: '' },
    { contractStart: '2027-01-01', contractEnd: '' },
  ), true);
  assert.equal(tenancyIntervalsOverlap(
    { contractStart: '2026-01-01', contractEnd: '2026-12-31' },
    { contractStart: '2027-01-01', contractEnd: '' },
  ), false);
  const overlaps = findTenancyOverlaps(
    [
      { id: 'a', contractStart: '2026-01-01', contractEnd: '' },
      { id: 'b', contractStart: '2027-01-01', contractEnd: '' },
    ],
    [
      { tenancyId: 'a', unitId: 'u1' },
      { tenancyId: 'b', unitId: 'u1' },
    ],
  );
  assert.equal(overlaps.length, 1);
});

test('Wiederholungsregeln erzeugen Sollstellungen exakt einmal', () => {
  const rules = [{
    id: 'rule-1', tenancyId: 't1', frequency: 'monthly', startDate: '2026-08-03', endDate: '',
    status: 'active', amount: 900, description: 'Kaltmiete',
  }];
  const once = materializeRecurringEntries(rules, [], '2026-09-30');
  const twice = materializeRecurringEntries(rules, once, '2026-09-30');
  assert.equal(once.length, 2);
  assert.deepEqual(twice, once);
  assert.deepEqual(once.map((entry) => entry.occurrenceKey), [
    'rule-1:2026-08-03', 'rule-1:2026-09-03',
  ]);
});

test('Fälligkeitstag und Frequenzen bestimmen die echten Solltermine', () => {
  assert.equal(firstDueDateOnOrAfter('2026-07-14', 3), '2026-08-03');
  assert.equal(firstDueDateOnOrAfter('2026-07-01', 3), '2026-07-03');

  const rules = [
    { id: 'monthly', tenancyId: 't1', frequency: 'monthly', startDate: '2026-01-14', endDate: '2026-04-30', dueDay: 3, status: 'active', amount: 10, description: 'Monatlich' },
    { id: 'quarterly', tenancyId: 't1', frequency: 'quarterly', startDate: '2026-01-01', endDate: '2026-06-30', dueDay: 3, status: 'active', amount: 20, description: 'Quartal' },
    { id: 'yearly', tenancyId: 't1', frequency: 'yearly', startDate: '2026-01-01', endDate: '2027-12-31', dueDay: 3, status: 'active', amount: 30, description: 'Jahr' },
  ];
  const entries = materializeRecurringEntries(rules, [], '2027-12-31');
  assert.deepEqual(entries.filter((entry) => entry.sourceId === 'monthly').map((entry) => entry.dueDate), [
    '2026-02-03', '2026-03-03', '2026-04-03',
  ]);
  assert.deepEqual(entries.filter((entry) => entry.sourceId === 'quarterly').map((entry) => entry.dueDate), [
    '2026-01-03', '2026-04-03',
  ]);
  assert.deepEqual(entries.filter((entry) => entry.sourceId === 'yearly').map((entry) => entry.dueDate), [
    '2026-01-03', '2027-01-03',
  ]);
});

test('Manuelle Regel endet spätestens mit dem Vertrag und lehnt ungültige Grenzen ab', () => {
  const tenancy = { id: 't1', contractStart: '2026-01-01', contractEnd: '2026-06-30', status: 'active' };
  const capped = normalizeRecurringRuleForTenancy({
    tenancyId: 't1', startDate: '2026-01-14', endDate: '2027-12-31', dueDay: 3,
  }, tenancy, '2026-01-01');
  assert.equal(capped.valid, true);
  assert.equal(capped.value.startDate, '2026-02-03');
  assert.equal(capped.value.endDate, '2026-06-30');

  assert.equal(normalizeRecurringRuleForTenancy({
    tenancyId: 't1', startDate: '2026-05-01', endDate: '2026-04-30', dueDay: 3,
  }, tenancy, '2026-01-01').valid, false);
  assert.equal(normalizeRecurringRuleForTenancy({
    tenancyId: 't1', startDate: '2026-07-01', endDate: '', dueDay: 3,
  }, tenancy, '2026-01-01').valid, false);
  assert.equal(normalizeRecurringRuleForTenancy({
    tenancyId: 't1', startDate: '2026-01-01', endDate: '', dueDay: 3,
  }, { ...tenancy, status: 'ended' }, '2026-01-01').valid, false);

  const planned = { id: 'planned', contractStart: '2026-09-01', contractEnd: '', status: 'active' };
  const beforeContract = normalizeRecurringRuleForTenancy({
    tenancyId: 'planned', startDate: '2026-01-01', endDate: '', dueDay: 3,
  }, planned, '2026-07-13');
  assert.equal(beforeContract.valid, false);
  assert.match(beforeContract.message, /Vertragsbeginn/);
  assert.equal(materializeRecurringEntries([], [], '2026-08-31').length, 0);
});

test('Leistungszeitraum verteilt zeitanteilig und centgenau', () => {
  const allocations = calculateServicePeriodAllocations({
    amount: 1200,
    propertyId: 'p1',
    mode: 'area',
    units: [{ id: 'u1', propertyId: 'p1', area: 100 }],
    tenancies: [
      { id: 'old', contractStart: '2020-01-01', contractEnd: '2026-06-30' },
      { id: 'new', contractStart: '2026-07-01', contractEnd: '' },
    ],
    tenancyUnits: [
      { tenancyId: 'old', unitId: 'u1' },
      { tenancyId: 'new', unitId: 'u1' },
    ],
    servicePeriodStart: '2026-01-01',
    servicePeriodEnd: '2026-12-31',
  });
  assert.equal(allocations.length, 2);
  assert.equal(allocations.reduce((sum, row) => sum + row.amount, 0), 1200);
  assert.equal(allocations[0].occupiedDays, 181);
  assert.equal(allocations[1].occupiedDays, 184);
});

test('Leistungszeitraum weist Monate vor Mietbeginn als Leerstand aus', () => {
  const allocations = calculateServicePeriodAllocations({
    amount: 1200,
    propertyId: 'p1',
    mode: 'area',
    units: [{ id: 'u1', propertyId: 'p1', area: 100 }],
    tenancies: [{ id: 'new', contractStart: '2026-09-01', contractEnd: '' }],
    tenancyUnits: [{ tenancyId: 'new', unitId: 'u1' }],
    servicePeriodStart: '2026-01-01',
    servicePeriodEnd: '2026-12-31',
  });

  assert.equal(allocations.length, 2);
  assert.deepEqual(allocations.map((row) => row.tenancyId), [null, 'new']);
  assert.equal(allocations[0].servicePeriodEnd, '2026-08-31');
  assert.equal(allocations[1].servicePeriodStart, '2026-09-01');
  assert.equal(allocations.reduce((sum, row) => sum + row.amount, 0), 1200);
  assert.equal(allocations[1].amount, 401.1);
});

test('Historische Vertragsüberschneidung verdoppelt weder Tage noch Gesamtbetrag', () => {
  const allocations = calculateServicePeriodAllocations({
    amount: 1200,
    propertyId: 'p1',
    mode: 'area',
    units: [{ id: 'u1', propertyId: 'p1', area: 100 }],
    tenancies: [
      { id: 'old', contractStart: '2026-01-01', contractEnd: '2026-06-30' },
      { id: 'overlap', contractStart: '2026-06-01', contractEnd: '2026-12-31' },
    ],
    tenancyUnits: [
      { tenancyId: 'old', unitId: 'u1' },
      { tenancyId: 'overlap', unitId: 'u1' },
    ],
    servicePeriodStart: '2026-01-01',
    servicePeriodEnd: '2026-12-31',
  });

  assert.deepEqual(allocations.map((row) => [row.tenancyId, row.servicePeriodStart, row.servicePeriodEnd]), [
    ['old', '2026-01-01', '2026-06-30'],
    ['overlap', '2026-07-01', '2026-12-31'],
  ]);
  assert.equal(allocations.reduce((sum, row) => sum + row.occupiedDays, 0), 365);
  assert.equal(allocations.reduce((sum, row) => sum + row.amount, 0), 1200);
});

test('Mieterkonto berechnet Soll minus Haben inklusive Teilzahlung', () => {
  assert.equal(accountBalance([
    { tenancyId: 't1', side: 'debit', amount: 1100 },
    { tenancyId: 't1', side: 'credit', amount: 400 },
    { tenancyId: 't1', side: 'credit', amount: 200 },
  ], 't1'), 500);
});

test('Validierung lehnt widersprüchliche Hauptkontakte, Zeiträume und Regelreferenzen ab', () => {
  const migrated = migrateV2ToV3(v2Fixture(), migratedAt);
  migrated.tenancyParties[0].isPrimaryContact = false;
  migrated.tenancies[0].contractEnd = '2019-12-31';
  migrated.tenancies[0].moveInDate = '2026-02-01';
  migrated.tenancies[0].moveOutDate = '2026-01-01';
  migrated.tenancyUnits.push({
    id: 'duplicate-relation', tenancyId: 't1', unitId: 'u1', role: 'ancillary', sortOrder: 1,
  });
  migrated.recurringRules.push({ id: 'orphan-rule', tenancyId: 'missing' });
  assert.throws(() => validateV3State(migrated), /Hauptkontakt|Vertragsende|Auszug|doppelt|Regel/);
});
