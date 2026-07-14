import test from 'node:test';
import assert from 'node:assert/strict';

import { ensureRentalSchema, writeRentalSlicesAtomically } from './storage.js';

class LocalStorageFake {
  constructor(seed = {}, failOnKey = '') {
    this.values = new Map(Object.entries(seed));
    this.failOnKey = failOnKey;
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    if (key === this.failOnKey) throw new Error('simulierter Schreibfehler');
    this.values.set(key, String(value));
  }

  removeItem(key) {
    this.values.delete(key);
  }

  key(index) {
    return [...this.values.keys()][index] || null;
  }

  get length() {
    return this.values.size;
  }
}

function seedV2() {
  const rows = {
    properties: [{ id: 'p1', objectType: 'Einfamilienhaus' }],
    transactions: [{ id: 'tx1', allocations: [] }],
    categories: [{ id: 'own' }],
    units: [{ id: 'u1', propertyId: 'p1', usageType: 'Wohnen' }],
    contacts: [{ id: 'c1', name: 'Max Beispiel' }],
    tenancies: [{ id: 't1', unitId: 'u1', contactIds: ['c1'], primaryContactId: 'c1', startDate: '2020-01-01', coldRent: 500, status: 'active' }],
    documents: [{ id: 'd1' }],
  };
  return Object.fromEntries([
    ['vermieter-demo-schema-version', '2'],
    ...Object.entries(rows).map(([key, value]) => [`vermieter-demo-${key}`, JSON.stringify(value)]),
  ]);
}

function freshDefaults() {
  return {
    properties: [{ id: 'p1', objectType: 'Einfamilienhaus' }],
    transactions: [],
    categories: [{ id: 'rent', kind: 'income' }],
    units: [{ id: 'u1', propertyId: 'p1', usageType: 'Wohnen' }],
    contacts: [{ id: 'c1', name: 'Frische Demo' }],
    tenancies: [{
      id: 't1', unitId: 'u1', contactIds: ['c1'], primaryContactId: 'c1',
      startDate: '2026-01-01', coldRent: 700, status: 'active',
    }],
    documents: [],
    generateUnitsForProperty: () => [],
  };
}

test('Leerer Browser wird mit den übergebenen Startdaten direkt auf v4 initialisiert', () => {
  global.window = { localStorage: new LocalStorageFake() };
  ensureRentalSchema(freshDefaults(), '2026-07-13T12:00:00.000Z');

  assert.equal(window.localStorage.getItem('vermieter-demo-schema-version'), '4');
  assert.equal(JSON.parse(window.localStorage.getItem('vermieter-demo-properties'))[0].id, 'p1');
  assert.equal(JSON.parse(window.localStorage.getItem('vermieter-demo-categories'))[0].id, 'rent');
  assert.equal(JSON.parse(window.localStorage.getItem('vermieter-demo-contacts'))[0].id, 'c1');
  assert.equal(JSON.parse(window.localStorage.getItem('vermieter-demo-tenancies'))[0].id, 't1');
});

test('Leerer Browser bleibt fachlich leer und behält nur Kategorien', () => {
  global.window = { localStorage: new LocalStorageFake() };
  ensureRentalSchema({
    properties: [], transactions: [], categories: [{ id: 'rent', kind: 'income' }],
    units: [], contacts: [], tenancies: [], documents: [], generateUnitsForProperty: () => [],
  }, '2026-07-14T12:00:00.000Z');

  assert.equal(window.localStorage.getItem('vermieter-demo-schema-version'), '4');
  for (const name of ['properties', 'transactions', 'units', 'contacts', 'tenancies', 'documents']) {
    assert.deepEqual(JSON.parse(window.localStorage.getItem(`vermieter-demo-${name}`)), [], name);
  }
  assert.equal(JSON.parse(window.localStorage.getItem('vermieter-demo-categories'))[0].id, 'rent');
});

test('Storage-Migration sichert v2 vollständig und setzt Version zuletzt', () => {
  global.window = { localStorage: new LocalStorageFake(seedV2()) };
  ensureRentalSchema({}, '2026-07-13T12:00:00.000Z');
  assert.equal(window.localStorage.getItem('vermieter-demo-schema-version'), '4');
  const backup = JSON.parse(window.localStorage.getItem('vermieter-demo-v2-backup'));
  assert.equal(backup.schemaVersion, 2);
  assert.equal(backup.properties[0].id, 'p1');
  assert.deepEqual(backup.transactions[0].allocations, []);
  assert.deepEqual(JSON.parse(window.localStorage.getItem('vermieter-demo-account-entries')), []);
  assert.equal(JSON.parse(window.localStorage.getItem('vermieter-demo-recurring-rules'))[0].startDate, '2026-08-03');
});

test('Schreibfehler erhöht die Schema-Version nicht', () => {
  global.window = {
    localStorage: new LocalStorageFake(seedV2(), 'vermieter-demo-tenancy-parties'),
  };
  assert.throws(
    () => ensureRentalSchema({}, '2026-07-13T12:00:00.000Z'),
    /simulierter Schreibfehler/,
  );
  assert.equal(window.localStorage.getItem('vermieter-demo-schema-version'), '2');
});

test('Atomarer Zahlungstorno stellt den ersten Slice wieder her, wenn der zweite fehlschlägt', () => {
  const originalEntries = JSON.stringify([{ id: 'account-payment-1' }]);
  const originalTransactions = JSON.stringify([{ id: 'transaction-payment-1' }]);
  global.window = {
    localStorage: new LocalStorageFake({
      'vermieter-demo-account-entries': originalEntries,
      'vermieter-demo-transactions': originalTransactions,
    }, 'vermieter-demo-transactions'),
  };
  assert.throws(() => writeRentalSlicesAtomically({
    accountEntries: [],
    transactions: [],
  }), /simulierter Schreibfehler/);
  assert.equal(window.localStorage.getItem('vermieter-demo-account-entries'), originalEntries);
  assert.equal(window.localStorage.getItem('vermieter-demo-transactions'), originalTransactions);
});

test('Beschädigtes JSON bleibt unangetastet und verhindert den Versionssprung', () => {
  const seed = seedV2();
  seed['vermieter-demo-contacts'] = '{kaputt';
  global.window = { localStorage: new LocalStorageFake(seed) };
  assert.throws(
    () => ensureRentalSchema({}, '2026-07-13T12:00:00.000Z'),
    /ungültiges JSON/,
  );
  assert.equal(window.localStorage.getItem('vermieter-demo-schema-version'), '2');
  assert.equal(window.localStorage.getItem('vermieter-demo-contacts'), '{kaputt');
  assert.equal(window.localStorage.getItem('vermieter-demo-v2-backup'), null);
});

test('Unterbrochene Migration ist wiederaufnehmbar und bewahrt das erste Backup', () => {
  const interrupted = new LocalStorageFake(seedV2(), 'vermieter-demo-tenancy-parties');
  global.window = { localStorage: interrupted };
  assert.throws(
    () => ensureRentalSchema({}, '2026-07-13T12:00:00.000Z'),
    /simulierter Schreibfehler/,
  );
  const originalBackup = interrupted.getItem('vermieter-demo-v2-backup');
  interrupted.failOnKey = '';
  ensureRentalSchema({}, '2026-07-13T12:00:00.000Z');

  const clean = new LocalStorageFake(seedV2());
  global.window = { localStorage: clean };
  ensureRentalSchema({}, '2026-07-13T12:00:00.000Z');

  assert.equal(interrupted.getItem('vermieter-demo-v2-backup'), originalBackup);
  assert.equal(interrupted.getItem('vermieter-demo-schema-version'), '4');
  const keysToCompare = [
    'vermieter-demo-properties',
    'vermieter-demo-transactions',
    'vermieter-demo-units',
    'vermieter-demo-contacts',
    'vermieter-demo-tenancies',
    'vermieter-demo-tenancy-parties',
    'vermieter-demo-tenancy-units',
    'vermieter-demo-recurring-rules',
    'vermieter-demo-account-entries',
  ];
  for (const key of keysToCompare) {
    assert.deepEqual(JSON.parse(interrupted.getItem(key)), JSON.parse(clean.getItem(key)), key);
  }
});
