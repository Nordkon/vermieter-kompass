import test from 'node:test';
import assert from 'node:assert/strict';

import { generateUnitsForProperty, tenancyHasIntervalConflict, validateUnitStructure } from './rentalModel.js';

const house = { id: 'p1', buildingType: 'singleFamily' };
const primary = {
  id: 'u1', propertyId: 'p1', unitKind: 'primary', ancillaryType: null, parentUnitId: null,
};

test('EFH erlaubt genau eine Haupteinheit plus eine Garage oder einen Stellplatz', () => {
  const garage = {
    id: 'g1', propertyId: 'p1', unitKind: 'ancillary', ancillaryType: 'garage', parentUnitId: 'u1',
  };
  assert.equal(validateUnitStructure(house, [primary], garage).valid, true);

  const parking = {
    id: 's1', propertyId: 'p1', unitKind: 'ancillary', ancillaryType: 'parking', parentUnitId: 'u1',
  };
  const result = validateUnitStructure(house, [primary, garage], parking);
  assert.equal(result.valid, false);
  assert.match(result.message, /höchstens eine/);
});

test('EFH weist zweite Haupteinheit und fremde Nebeneinheit zurück', () => {
  const secondPrimary = {
    id: 'u2', propertyId: 'p1', unitKind: 'primary', ancillaryType: null, parentUnitId: null,
  };
  assert.equal(validateUnitStructure(house, [primary], secondPrimary).valid, false);

  const orphan = {
    id: 'g1', propertyId: 'p1', unitKind: 'ancillary', ancillaryType: 'garage', parentUnitId: 'u9',
  };
  assert.equal(validateUnitStructure(house, [primary], orphan).valid, false);
});

test('Intervallprüfung erkennt Konflikte auch auf einer mitvermieteten Nebeneinheit', () => {
  const conflict = tenancyHasIntervalConflict({
    tenancies: [{ id: 't1', contractStart: '2026-01-01', contractEnd: '' }],
    tenancyUnits: [
      { tenancyId: 't1', unitId: 'u1' },
      { tenancyId: 't1', unitId: 'g1' },
    ],
    unitIds: ['g1'],
    contractStart: '2026-08-01',
  });
  assert.equal(conflict, true);
});

test('Intervallprüfung behandelt Umschließung, Einschluss, Identität und Folgetag korrekt', () => {
  const tenancies = [{
    id: 't1', unitId: 'u1', contractStart: '2026-03-01', contractEnd: '2026-08-31',
  }];
  const conflicts = (contractStart, contractEnd) => tenancyHasIntervalConflict({
    tenancies,
    unitIds: ['u1'],
    contractStart,
    contractEnd,
  });

  assert.equal(conflicts('2026-01-01', '2026-12-31'), true, 'neuer Zeitraum umschließt Bestand');
  assert.equal(conflicts('2026-04-01', '2026-05-31'), true, 'neuer Zeitraum liegt im Bestand');
  assert.equal(conflicts('2026-03-01', '2026-08-31'), true, 'identische Zeiträume kollidieren');
  assert.equal(conflicts('2026-09-01', '2027-02-28'), false, 'direkter Folgetag ist zulässig');
});

test('Einzelobjekt übernimmt Planwerte in die Einheit, Mehrfachobjekt verteilt sie nicht', () => {
  const property = {
    id: 'p-plan', type: 'Wohnen', units: 1, area: 120,
    targetColdRent: 750, targetUtilityAdvance: 180,
  };
  const [single] = generateUnitsForProperty(property, 1);
  assert.equal(single.targetColdRent, 750);
  assert.equal(single.targetUtilityAdvance, 180);

  const multiple = generateUnitsForProperty({ ...property, units: 2 }, 2);
  assert.deepEqual(multiple.map((unit) => unit.targetColdRent), [null, null]);
  assert.deepEqual(multiple.map((unit) => unit.targetUtilityAdvance), [null, null]);
});
