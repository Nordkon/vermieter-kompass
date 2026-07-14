import test from 'node:test';
import assert from 'node:assert/strict';

import {
  migrateV3ToV4,
  splitLegacyPostalCity,
  validateV4State,
} from './schemaV4.js';

const v3State = ({ properties, units }) => ({
  schemaVersion: 3,
  properties,
  units,
  transactions: [],
  categories: [],
  contacts: [],
  tenancies: [],
  documents: [],
  tenancyParties: [],
  tenancyUnits: [],
  recurringRules: [],
  accountEntries: [],
  migrationIssues: [],
});

test('v4 trennt deutsche Legacy-PLZ und bewahrt nicht erkennbare Orte', () => {
  assert.deepEqual(splitLegacyPostalCity('', '04109 Leipzig'), {
    postalCode: '04109', city: 'Leipzig',
  });
  assert.deepEqual(splitLegacyPostalCity('', 'Wien'), {
    postalCode: '', city: 'Wien',
  });
  assert.deepEqual(splitLegacyPostalCity('01067', 'Dresden'), {
    postalCode: '01067', city: 'Dresden',
  });
});

test('v4 übernimmt Legacy-Miete nur bei genau einer Haupteinheit', () => {
  const migrated = migrateV3ToV4(v3State({
    properties: [
      { id: 'single', address: 'A 1', city: '45127 Essen', monthlyRent: 750 },
      { id: 'multi', address: 'B 2', city: '04109 Leipzig', monthlyRent: 1600 },
    ],
    units: [
      { id: 's1', propertyId: 'single', unitKind: 'primary' },
      { id: 'm1', propertyId: 'multi', unitKind: 'primary' },
      { id: 'm2', propertyId: 'multi', unitKind: 'primary' },
    ],
  }), '2026-07-14T12:00:00.000Z');
  assert.equal(migrated.units.find((unit) => unit.id === 's1').targetColdRent, 750);
  assert.equal(migrated.units.find((unit) => unit.id === 'm1').targetColdRent, null);
  assert.equal(migrated.units.find((unit) => unit.id === 'm2').targetColdRent, null);
  assert.equal(migrated.properties.find((property) => property.id === 'single').legacyTargetColdRentTotal, null);
  assert.equal(migrated.properties.find((property) => property.id === 'multi').legacyTargetColdRentTotal, 1600);
  assert.equal(migrated.properties.find((property) => property.id === 'multi').legacyTargetColdRentSource, 'migration-v3');
  assert.equal(validateV4State(migrated), true);
});

test('v4 bewahrt null und bewusst gesetzte 0 und ist idempotent', () => {
  const source = v3State({
    properties: [{ id: 'p1', address: 'Nullweg 1', city: 'Nullstadt', monthlyRent: 999 }],
    units: [{
      id: 'u1', propertyId: 'p1', unitKind: 'primary',
      targetColdRent: 0, targetUtilityAdvance: null,
    }],
  });
  const first = migrateV3ToV4(source, '2026-07-14T12:00:00.000Z');
  const second = migrateV3ToV4(first, '2026-08-01T12:00:00.000Z');
  assert.equal(first.units[0].targetColdRent, 0);
  assert.equal(first.units[0].targetUtilityAdvance, null);
  assert.deepEqual(second, first);
});
